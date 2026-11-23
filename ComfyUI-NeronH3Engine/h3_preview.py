"""RU: Промежуточные кадры во время счёта. Не ждём конца — видим раскадровку.
EN: Intermediate frames while sampling. A storyboard arrives before the render ends.

RU: Берём картинку из x0 (denoised estimate) прямо в callback сэмплера. x0 не меняем:
    копируем на CPU перед декодом. На финальный латент превью никак не влияет.
EN: Frames come from x0 inside the sampler callback. x0 is never mutated: we copy it
    to CPU before decoding. Previews cannot change the final latent.
"""

from __future__ import annotations

import base64
import io
import logging

import torch
from PIL import Image

import comfy.model_management
import comfy.utils
import folder_paths
import latent_preview

try:
    from server import PromptServer
except Exception:
    PromptServer = None


def _to_jpeg(image: Image.Image, max_side: int = 512) -> str:
    image = image.convert("RGB")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode("ascii")


class Storyboard:
    """RU: наблюдатель за сэмплером: три кадра в начале, середине и конце."""

    def __init__(self, vae, node_id: str, steps: int, lang: str = "ru", enabled: bool = True):
        self.vae = vae
        self.node_id = str(node_id or "")
        self.steps = max(1, int(steps))
        self.lang = "ru" if str(lang).startswith("ru") else "en"
        self.enabled = bool(enabled)
        self.fast = self._fast_decoder()
        self.base = None
        self.last = -1
        self.points = sorted({0, max(1, self.steps // 2), self.steps - 1})

    def set_base(self, callback):
        """RU: оставляем штатный прогресс ComfyUI нетронутым."""
        self.base = callback

    def close(self):
        self.fast = None
        self.base = None

    def _fast_decoder(self):
        """RU: лёгкий H3-декодер, если он рядом; иначе обычная VAE."""
        try:
            names = folder_paths.get_filename_list("vae_approx") or []
            name = next((n for n in names if n == "taeh3.safetensors"), None)
            if not name:
                return None
            path = folder_paths.get_full_path("vae_approx", name)
            sd = comfy.utils.load_torch_file(path)
            # RU: временный TAEHV отличается ключом decoder.22.bias.
            if not any(k.startswith("decoder.22.bias") for k in sd.keys()):
                return None
            from comfy.sd import VAE
            v = VAE(sd)
            v.first_stage_model.show_progress_bar = False
            return v
        except Exception as e:
            logging.debug("Neron H3 tiny decoder skipped: %s", e)
            return None

    def _video(self, x0):
        video = x0.tensors[0] if getattr(x0, "is_nested", False) else x0
        return video.detach()

    def _frame(self, x0, idx: int):
        video = self._video(x0)
        t = min(int(idx), video.shape[2] - 1) if video.ndim == 5 else 0
        sample = video[:, :, t:t + 1] if video.ndim == 5 else video[:1]
        sample = sample.clone().to(comfy.model_management.intermediate_device())
        out = (self.fast or self.vae).decode(sample)
        img = out[0]
        if getattr(img, "ndim", 0) == 4:
            img = img[0]
        if torch.is_tensor(img):
            if img.ndim == 3 and img.shape[0] in (3, 4):
                img = img[:3].movedim(0, -1)
            img = ((img.clamp(-1, 1) + 1) / 2 * 255).to(torch.uint8).cpu().numpy()
        return Image.fromarray(img).convert("RGB")

    def send(self, text: str, step: int, image: Image.Image | None = None, pct: int | None = None):
        if PromptServer is None:
            return
        payload = {"id": self.node_id, "text": text, "step": int(step), "total": self.steps}
        if pct is not None:
            payload["pct"] = int(pct)
        if image is not None:
            payload["image"] = _to_jpeg(image)
        try:
            PromptServer.instance.send_sync("neron_h3_status", payload)
        except Exception as e:
            logging.warning("Neron H3 status send failed: %s", e)

    def __call__(self, step, x0, x, total_steps):
        try:
            if self.base:
                self.base(step, x0, x, total_steps)
        except Exception:
            pass
        if not self.enabled or step not in self.points or step == self.last:
            return
        self.last = step
        label = "Промежуточный кадр" if self.lang == "ru" else "Intermediate frame"
        try:
            video = self._video(x0)
            count = video.shape[2] if video.ndim == 5 else 1
            picks = [0, count // 2, max(0, count - 1)] if count > 1 else [0]
            tiles = [self._frame(x0, p) for p in picks]
            w, h = tiles[0].size
            board = Image.new("RGB", (w * len(tiles), h), (16, 16, 16))
            for i, tile in enumerate(tiles):
                board.paste(tile, (i * w, 0))
            self.send(
                f"{label} {step + 1}/{self.steps}", step, board,
                int(100 * (step + 1) / self.steps),
            )
        except Exception:
            logging.exception("Neron H3 preview skipped")
