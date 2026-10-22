# -*- coding: utf-8 -*-
"""SeedVR2 (встроен в ComfyUI) для Эстафеты: модели, автозагрузка и прогон окна кадров.

Тот же путь, что официальная схема Comfy «Upscale Video (SeedVR2)»:
Preprocess → VAE encode (тайлами) → conditioning → 1 шаг euler → VAE decode (тайлами).
"""
import numpy as np
import torch

from . import core_comfy, core_ops, core_download

# подпись → (файл, примерный размер). Все — из официального Comfy-Org/SeedVR2
MODELS = {
    "3B int8 · 3.5 GB (default / по умолчанию)": "seedvr2_3b_int8_convrot.safetensors",
    "3B NVFP4 · 2 GB (RTX 50: fastest / быстрее всех)": "seedvr2_3b_nvfp4.safetensors",
    "7B NVFP4 · 4.8 GB (RTX 50: better detail / детальнее)": "seedvr2_7b_nvfp4.safetensors",
    "7B sharp NVFP4 · 4.8 GB (RTX 50: sharpest / резче)": "seedvr2_7b_sharp_nvfp4.safetensors",
    "7B int8 · 8.3 GB (any GPU, slower / любая карта, медленнее)": "seedvr2_7b_int8_convrot.safetensors",
}
VAE_FILE = "seedvr2_ema_vae_fp16.safetensors"


def _round4n1(n):
    n = max(1, int(n))
    return 1 if n < 5 else 4 * ((n - 1) // 4) + 1


class SeedVR2Runner:
    """Тонкая обёртка над встроенным в ComfyUI SeedVR2 — тот же путь, что официальная схема
    «Upscale Video (SeedVR2)»: Preprocess → VAE encode → conditioning → 1 шаг euler → VAE decode."""

    def __init__(self, model_file, progress_cb=None):
        try:
            import nodes
            from comfy_extras import nodes_seedvr  # noqa: F401 — проверка, что ComfyUI достаточно новый
        except Exception:
            raise RuntimeError("Эстафета/Доводчик: в этой версии ComfyUI нет SeedVR2. Обнови ComfyUI "
                               "(нужна 0.40 или новее) / update ComfyUI")
        chk = core_comfy.check_interrupt
        core_download.ensure("diffusion_models", model_file, f"diffusion_models/{model_file}",
                             progress=progress_cb, check_interrupt=chk)
        core_download.ensure("vae", VAE_FILE, f"vae/{VAE_FILE}", progress=progress_cb, check_interrupt=chk)
        self.nodes = nodes
        self.model = nodes.UNETLoader().load_unet(model_file, "default")[0]
        self.vae = nodes.VAELoader().load_vae(VAE_FILE)[0]
        dm = self.model.model.diffusion_model
        self.pos_cond, self.neg_cond = dm.positive_conditioning, dm.negative_conditioning

    def run(self, frames, seed=0):
        """frames: torch [T,H,W,3] 0..1 (CPU) → тот же размер [T,H,W,3]."""
        from comfy_extras.nodes_seedvr import _seedvr2_pad
        t, h, w = frames.shape[0], frames.shape[1], frames.shape[2]
        px = _seedvr2_pad(frames, min(h, w), "PerceptionRelay").result[0]      # [1,T',H',W',3]
        nodes = self.nodes
        latent = nodes.VAEEncodeTiled().encode(self.vae, px, 512, 128, 64, 8)[0]
        lat = latent["samples"]
        vc = lat.movedim(1, -1).contiguous()
        cond = torch.cat((vc, vc.new_ones(vc.shape[:-1] + (1,))), dim=-1).movedim(-1, 1)
        positive = [[self.pos_cond.unsqueeze(0), {"condition": cond}]]
        negative = [[self.neg_cond.unsqueeze(0), {"condition": cond}]]
        out = nodes.common_ksampler(self.model, seed, 1, 1.0, "euler", "simple",
                                    positive, negative, latent, denoise=1.0)[0]
        img = nodes.VAEDecodeTiled().decode(self.vae, out, 512, 128, 64, 8)[0]
        if img.dim() == 5:
            img = img.reshape(-1, img.shape[-3], img.shape[-2], img.shape[-1])
        return img[:t, :h, :w, :3].float().cpu().clamp(0, 1)

    def close(self):
        try:
            import comfy.model_management as mm
            mm.unload_all_models()
        except Exception:
            pass
        self.model = self.vae = None
        core_ops.free_vram()


class WindowGenerator:
    """Окна кадров через генератор: увеличение до нужного размера, нехватка памяти → окно меньше,
    плавная сшивка соседних окон (у них общие кадры по краям)."""

    def __init__(self, runner, out_w, out_h, window, log=print):
        self.runner = runner
        self.out_w, self.out_h = out_w, out_h
        self.win = _round4n1(window)
        self.overlap = 4 if self.win >= 9 else 0
        self.win_min = self.win
        self.windows = 0
        self.log = log

    def generate(self, frames_np):
        import comfy.model_management as mm
        import torch.nn.functional as F
        x = torch.from_numpy(np.stack(frames_np))                                  # [T,H,W,3]
        if x.shape[1] != self.out_h or x.shape[2] != self.out_w:
            x = F.interpolate(x.permute(0, 3, 1, 2), size=(self.out_h, self.out_w), mode="bicubic",
                              align_corners=False).clamp(0, 1).permute(0, 2, 3, 1)
        parts, i, step = [], 0, len(frames_np)
        while i < x.shape[0]:
            core_comfy.check_interrupt()
            piece = x[i:i + step]
            try:
                parts.append(self.runner.run(piece))
                i += piece.shape[0]
            except Exception as e:
                if not mm.is_oom(e) or step <= 1:
                    raise
                mm.soft_empty_cache()
                step = _round4n1(max(1, step // 2))
                self.win = min(self.win, step)
                self.overlap = 4 if self.win >= 9 else 0
                self.win_min = min(self.win_min, step)
                self.log(f"[PerceptionRelay] не хватило видеопамяти, окно → {step} кадров / VRAM: window → {step}")
        self.windows += 1
        return torch.cat(parts, 0)                                                 # [T,H2,W2,3] CPU

    def run(self, reader, emit):
        """Прогнать все кадры: emit(кадр_numpy, сгенерированный [H2,W2,3]) — строго по порядку."""
        buf, tail = [], None
        for frame in reader:
            buf.append(frame)
            if len(buf) < self.win:
                continue
            tail = self._flush(buf, tail, emit, final=False)
            buf = list(tail[0]) if tail else []
        if buf or tail:
            self._flush(buf, tail, emit, final=True)

    def _flush(self, buf, tail, emit, final):
        import math
        if not buf:
            if tail:
                for x, g in zip(tail[0], tail[1]):
                    emit(x, g)
            return None
        g = self.generate(buf)
        k = len(tail[0]) if tail else 0
        for i in range(k):
            wgt = 0.5 - 0.5 * math.cos(math.pi * (i + 1) / (k + 1))   # плавно от прошлого окна к новому
            emit(buf[i], tail[1][i] * (1 - wgt) + g[i] * wgt)
        keep = 0 if final else min(self.overlap, len(buf) - k)
        end = len(buf) - keep
        for i in range(k, end):
            emit(buf[i], g[i])
        if keep <= 0:
            return None
        return (buf[end:], g[end:])
