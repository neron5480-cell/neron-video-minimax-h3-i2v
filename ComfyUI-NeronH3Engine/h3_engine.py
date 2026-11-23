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

import comfy.model_management
import comfy.sample
import comfy.samplers
import folder_paths
import latent_preview
import nodes
from comfy_api.latest import Types
from comfy_extras.nodes_audio import VAEDecodeAudio
from comfy_extras.nodes_custom_sampler import BasicGuider, RandomNoise
from comfy_extras.nodes_minimax_h3 import MiniMaxH3ImageToVideo
from comfy_extras.nodes_video import CreateVideo

from . import h3_catalog as catalog
from . import h3_hw as hw
from . import h3_i18n as i18n
from .h3_preview import Storyboard

FPS = 24


def _base(path: str) -> str:
    return os.path.basename(path)


def _as_image(value):
    """RU: из UI приходит тензор, из API — имя файла из input/; принимаем оба вида."""
    if isinstance(value, str) and value.strip():
        return nodes.LoadImage().load_image(value.strip())[0]
    return value


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

    def _files(self, mode: str):
        keys = ["diffusion", "vae_video", "vae_audio"]
        keys.append("text_turbo" if mode == "turbo" else "text_power")
        if mode == "turbo":
            keys.append("turbo_lora")
        self.status(self.t("checking"), 1)

        def local_status(text, pct=None):
            name = _base(text.split(":")[-1].strip())
            self.status(self.t("downloading") + " " + name if name else self.t("downloading"), pct)

        return catalog.ensure_many(keys, local_status)

    def _load(self, paths: dict, mode: str):
        self.status(self.t("loading"), 25)
        model = nodes.UNETLoader().load_unet(_base(paths["diffusion"]), "default")[0]
        text_key = "text_turbo" if mode == "turbo" else "text_power"
        clip = nodes.CLIPLoader().load_clip(_base(paths[text_key]), "minimax", "default")[0]
        vae = nodes.VAELoader().load_vae(_base(paths["vae_video"]))[0]
        audio_vae = nodes.VAELoader().load_vae(_base(paths["vae_audio"]))[0]
        if mode == "turbo":
            # RU: официальный шаблон вешает турбо-LoRA только на модель, не на текст.
            model = nodes.LoraLoaderModelOnly().load_lora_model_only(
                model, _base(paths["turbo_lora"]), 1.0
            )[0]
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

    def run(self, prompt, first_frame=None, last_frame=None, seconds=5.0, mode="auto",
            seed=0, width=None, height=None, steps=0, video_name="NeronH3/H3"):
        if not str(prompt or "").strip():
            raise ValueError(self.t("err_prompt"))
        first_frame = _as_image(first_frame)
        last_frame = _as_image(last_frame)
        mode = hw.choose_mode(mode)
        steps = int(steps) if steps and int(steps) >= 4 else (8 if mode == "turbo" else 20)
        length = hw.snap_length(seconds)
        width, height = hw.snap_size(width, height, mode)
        self.status(self.t("mode_turbo" if mode == "turbo" else "mode_power"), 2)

        files = self._files(mode)
        self._load(files, mode)
        self.board = Storyboard(self.loaded["vae"], self.node_id, steps, self.lang, self.previews)

        self.status(self.t("encoding"), 30)
        if first_frame is not None:
            self.status(self.t("with_image"), 34)
        else:
            self.status(self.t("no_image"), 34)
        if last_frame is not None:
            self.status(self.t("last_image"), 35)

        cond, latent = MiniMaxH3ImageToVideo.execute(
            clip=self.loaded["clip"], vae=self.loaded["vae"], prompt=prompt,
            width=width, height=height, length=length,
            first_frame=first_frame, last_frame=last_frame,
        ).result
        self.status(self.t("no_geometry"), 38)

        self.status(self.t("sampling"), 40)
        samples = self._sample(cond, latent, seed, steps)

        self.status(self.t("decoding"), 92)
        frames = nodes.VAEDecode().decode(self.loaded["vae"], samples)[0]
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
        return frames, os.path.relpath(path, folder_paths.get_output_directory()).replace("\\", "/")

    def close(self):
        if self.board:
            self.board.close()
        self.loaded.clear()
        gc.collect()
        comfy.model_management.soft_empty_cache()
