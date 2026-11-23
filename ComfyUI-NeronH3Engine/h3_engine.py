"""RU: Самостоятельный движок MiniMax H3: пустой кадр, картинка, турбо и мощный режим.
EN: Standalone MiniMax H3 engine: empty frame, image input, turbo and power modes.

RU: Граф собран по официальному шаблону ComfyUI 0.46.2: res_multistep, simple,
    BasicGuider, cfg 1, без негативного промпта, 24 fps. Движок сам находит
    и докачивает модели, сам выбирает режим по железу.
EN: The graph follows the official ComfyUI 0.46.2 template: res_multistep, simple,
    BasicGuider, cfg 1, no negative prompt, 24 fps. The engine finds/downloads its
    own models and picks the mode from the hardware.
"""

from __future__ import annotations

import gc
import os

import numpy as np
import torch
from PIL import Image, ImageFilter

import comfy.model_management
import comfy.sample
import comfy.samplers
import folder_paths
import latent_preview
import nodes
from comfy_api.latest import Types
from comfy_extras.nodes_audio import VAEDecodeAudio
from comfy_extras.nodes_custom_sampler import BasicGuider, RandomNoise
from comfy_extras.nodes_minimax_h3 import MiniMaxH3AddGuide, MiniMaxH3ImageToVideo
from comfy_extras.nodes_video import CreateVideo

from . import h3_bus as bus
from . import h3_catalog as catalog
from . import h3_hw as hw
from .h3_loras import LoraStack
from . import h3_i18n as i18n
from .h3_preview import Storyboard

FPS = 24


def _base(path: str) -> str:
    return os.path.basename(path)


def _as_image(value):
    """RU: из UI приходит тензор, из API — имя файла из input/; пустое имя — нет кадра."""
    if isinstance(value, str):
        name = value.strip()
        if not name or name == bus.NONE:
            return None
        return nodes.LoadImage().load_image(name)[0]
    return value


def _sharpen(frames, amount: float):
    """RU: лёгкая резкость по готовым кадрам. 1.0 — честно ничего не меняет."""
    try:
        value = float(amount)
    except Exception:
        value = 1.0
    if value <= 1.0 or not torch.is_tensor(frames):
        return frames
    percent = max(1, min(180, int(round((value - 1.0) * 140))))
    device = frames.device
    out = []
    for frame in frames:
        arr = frame.detach().clamp(0, 1).cpu().numpy()
        if arr.ndim == 3 and arr.shape[0] in (3, 4):
            arr = np.moveaxis(arr[:3], 0, -1)
        img = Image.fromarray((arr * 255).astype(np.uint8), "RGB")
        img = img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=percent, threshold=2))
        out.append(torch.from_numpy(np.asarray(img).astype(np.float32) / 255.0))
    return torch.stack(out).to(device)


class Engine:
    def __init__(self, node_id: str, lang: str = "ru", previews: bool = True):
        self.node_id = str(node_id or "")
        self.lang = "ru" if str(lang).lower().startswith("ru") else "en"
        self.previews = bool(previews)
        self.board = None
        self.loaded = {}

    def t(self, key, **kw):
        return i18n.t(self.lang, key, **kw)

    def status(self, text, pct=None):
        """RU: статус и на узле, и в панели превью — один и тот же текст."""
        try:
            from server import PromptServer
            if self.node_id and PromptServer.instance:
                PromptServer.instance.send_progress_text(text, self.node_id)
        except Exception:
            pass
        if self.board:
            self.board.send(text, 0, None, pct)

    def _files(self, mode: str, options: dict | None = None):
        options = options or {}
        auto = (None, "", catalog.AUTO)
        text_key = "text_turbo" if mode == "turbo" else "text_power"
        keys = []
        if options.get("diffusion_model") in auto:
            keys.append("diffusion")
        if options.get(text_key + "_model") in auto:
            keys.append(text_key)
        if options.get("video_vae_model") in auto:
            keys.append("vae_video")
        if options.get("audio_vae_model") in auto:
            keys.append("vae_audio")
        if mode == "turbo" and options.get("turbo_lora", catalog.AUTO) in auto:
            keys.append("turbo_lora")
        self.status(self.t("checking"), 1)

        def local_status(text, pct=None):
            name = _base(text.split(":")[-1].strip())
            self.status(self.t("downloading") + " " + name if name else self.t("downloading"), pct)

        return catalog.ensure_many(keys, local_status)

    @staticmethod
    def _pick(options: dict, key: str, paths: dict, fallback_key: str,
              allow_none: bool = False) -> str:
        choice = options.get(key)
        if choice in (None, "", catalog.AUTO):
            return _base(paths.get(fallback_key, ""))
        if choice == catalog.NONE:
            return "" if not allow_none else catalog.NONE
        return str(choice)

    def _load(self, paths: dict, mode: str, options: dict | None = None):
        self.status(self.t("loading"), 25)
        options = options or {}
        text_key = "text_turbo" if mode == "turbo" else "text_power"
        diffusion = self._pick(options, "diffusion_model", paths, "diffusion")
        text = self._pick(options, text_key + "_model", paths, text_key)
        video_vae = self._pick(options, "video_vae_model", paths, "vae_video")
        audio_vae_name = self._pick(options, "audio_vae_model", paths, "vae_audio")
        if not all((diffusion, text, video_vae, audio_vae_name)):
            raise ValueError(self.t("err_files"))

        model = nodes.UNETLoader().load_unet(diffusion, "default")[0]
        clip = nodes.CLIPLoader().load_clip(text, "minimax", "default")[0]
        vae = nodes.VAELoader().load_vae(video_vae)[0]
        audio_vae = nodes.VAELoader().load_vae(audio_vae_name)[0]

        def report(index, name, weight, ok):
            key = ("turbo_ok" if ok else "turbo_skip") if index == 0 else (
                "lora_ok" if ok else "lora_skip"
            )
            self.status(self.t(key, n=index, name=os.path.basename(name), w=weight), 28)

        stack = LoraStack(status=report)
        slots = []
        if mode == "turbo":
            turbo = self._pick(options, "turbo_lora", paths, "turbo_lora", allow_none=True)
            try:
                turbo_weight = float(options.get("turbo_lora_strength", 1.0))
            except Exception:
                turbo_weight = 1.0
            slots.append({
                "enabled": True,
                "name": turbo,
                "strength": turbo_weight,
                "index": 0,
            })
        for i in range(1, 6):
            slots.append({
                "enabled": bool(options.get(f"lora_{i}_enabled")),
                "name": options.get(f"lora_{i}_name", catalog.NONE),
                "strength": options.get(f"lora_{i}_strength", 1.0),
                "index": i,
            })
        model, _ = stack.apply(model, slots)

        self.loaded = {"model": model, "clip": clip, "vae": vae, "audio_vae": audio_vae}
        return self.loaded

    def _sample(self, cond, latent, seed: int, steps: int):
        model = self.loaded["model"]
        guider = BasicGuider.execute(model, cond).result[0]
        sampler = comfy.samplers.sampler_object("res_multistep")
        sigmas = comfy.samplers.calculate_sigmas(
            model.get_model_object("model_sampling"), "simple", steps
        ).cpu()
        noise = RandomNoise.execute(int(seed) & 0xFFFFFFFFFFFFFFFF).result[0]

        work = latent.copy()
        work["samples"] = comfy.sample.fix_empty_latent_channels(model, latent["samples"])

        self.board.steps = steps
        self.board.points = sorted({0, max(1, steps // 2), steps - 1})
        self.board.set_base(latent_preview.prepare_callback(model, steps))

        samples = guider.sample(
            noise.generate_noise(work), work["samples"], sampler, sigmas,
            callback=self.board, disable_pbar=False, seed=noise.seed,
        ).to(comfy.model_management.intermediate_device())
        result = work.copy()
        result["samples"] = samples
        return result

    def run(self, prompt=None, first_frame=None, mid_1=None, mid_2=None, last_frame=None,
            seconds=5.0, frame_count=None, mode="auto", seed=0, width=None, height=None,
            steps=0, sharpness=1.0, frame_format="auto", previews=True,
            bus_data=None, video_name="NeronH3/H3", options=None):
        got = bus.resolve(
            bus_data, prompt, seconds, frame_count,
            {"first": first_frame, "mid_1": mid_1, "mid_2": mid_2, "last": last_frame},
            width, height,
        )
        prompt = got["prompt"]
        if not str(prompt or "").strip():
            raise ValueError(self.t("err_prompt"))

        first_frame = _as_image(got["frames"].get("first"))
        mid_1 = _as_image(got["frames"].get("mid_1"))
        mid_2 = _as_image(got["frames"].get("mid_2"))
        last_frame = _as_image(got["frames"].get("last"))

        mode = hw.choose_mode(mode)
        steps = int(steps) if steps and int(steps) >= 4 else (8 if mode == "turbo" else 20)
        length = hw.snap_length(float(got["frame_count"]) / FPS if got["frame_count"] else got["seconds"])
        fw, fh = hw.size_from_format(frame_format)
        width, height = hw.snap_size(got["width"] or fw, got["height"] or fh, mode)
        self.status(self.t("mode_turbo" if mode == "turbo" else "mode_power"), 2)

        files = self._files(mode, options)
        self._load(files, mode, options)
        self.board = Storyboard(self.loaded["vae"], self.node_id, steps, self.lang, self.previews)

        self.status(self.t("encoding"), 30)
        if first_frame is not None:
            self.status(self.t("with_image"), 34)
        else:
            self.status(self.t("no_image"), 34)
        if mid_1 is not None or mid_2 is not None:
            self.status(self.t("mid_image"), 35)
        if last_frame is not None:
            self.status(self.t("last_image"), 36)

        cond, latent = MiniMaxH3ImageToVideo.execute(
            clip=self.loaded["clip"], vae=self.loaded["vae"], prompt=prompt,
            width=width, height=height, length=length,
            first_frame=first_frame, last_frame=last_frame,
        ).result
        if mid_1 is not None:
            cond = MiniMaxH3AddGuide.execute(
                cond, latent, max(1, length // 3), vae=self.loaded["vae"], image=mid_1[:1]
            ).result[0]
        if mid_2 is not None:
            cond = MiniMaxH3AddGuide.execute(
                cond, latent, max(2, (2 * length) // 3), vae=self.loaded["vae"], image=mid_2[:1]
            ).result[0]
        self.status(self.t("no_geometry"), 38)

        self.status(self.t("sampling"), 40)
        samples = self._sample(cond, latent, seed, steps)

        self.status(self.t("decoding"), 92)
        frames = nodes.VAEDecode().decode(self.loaded["vae"], samples)[0]
        frames = _sharpen(frames, sharpness)
        audio = VAEDecodeAudio.execute(vae=self.loaded["audio_vae"], samples=samples).result[0]

        self.status(self.t("saving"), 96)
        video = CreateVideo.execute(
            frames, float(FPS), audio, 8, "sRGB", "none", "auto"
        ).result[0]

        folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
            video_name or "NeronH3/H3", folder_paths.get_output_directory(), width, height
        )
        path = os.path.join(folder, f"{filename}_{counter:05}_.mp4")
        video.save_to(path, format=Types.VideoContainer("mp4"), codec=Types.VideoCodec("auto"))

        self.status(self.t("done"), 100)
        return frames, os.path.relpath(path, folder_paths.get_output_directory()).replace("\\", "/"), frames[-1:]

    def close(self):
        if self.board:
            self.board.close()
        self.loaded.clear()
        gc.collect()
        comfy.model_management.soft_empty_cache()
