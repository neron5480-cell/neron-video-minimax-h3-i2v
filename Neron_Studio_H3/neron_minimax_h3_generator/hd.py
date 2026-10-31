# -*- coding: utf-8 -*-
"""HD-режимы генератора: черновик → увеличение → чистовик (перенесено из ⚡ H3 Engine Fast).

Идея: дорого рисовать большой кадр на многих шагах. Поэтому
  1. ЧЕРНОВИК — маленький кадр (часть площади), быстрая модель Fast H3 (8 шагов)
     или базовая + турбо-LoRA. Здесь рождаются сюжет, движение и звук.
  2. УВЕЛИЧЕНИЕ — латент до полного размера (модель-апскейлер H3, если ComfyUI её умеет; иначе растяжение).
  3. ЧИСТОВИК — полный размер, базовая модель + быстрая LoRA (Taomate 3-step или турбо),
     3–6 шагов частичной перерисовки: движение от черновика, деталь — заново.
Образцы (ref_image_0…3, <Picture N>) кодируются ОДИН раз: в ComfyUI они лежат отдельно от размера кадра,
поэтому одно и то же условие годится и черновику, и чистовику.

Значения режимов — из тестов на RTX 5070 Ti 16 ГБ (10 с в полном размере модели, модели int8):
Быстро 7–9 мин, Баланс 8–12, Чисто 12–14. Площадь черновика ниже 0.4 — модель дорисовывает
ленточки и рюшечки и не слушает промпт.
"""
import logging
import math
import time

import torch

from .memory import free_between_stages, log_vram
from . import pipeline

log = logging.getLogger("Neron.H3.HD")

FAST_HD = "⚡ Быстро HD / Fast HD"
BALANCE_HD = "Баланс HD / Balance HD"
CLEAN_HD = "Чисто HD / Clean HD"
# (площадь черновика, шаги черновика, шаги чистовика, сила чистовика)
PRESETS = {
    FAST_HD: (0.45, 8, 3, 0.5),
    BALANCE_HD: (0.5, 8, 3, 0.5),
    CLEAN_HD: (0.6, 8, 6, 0.6),
}
MODES = list(PRESETS)

FAST_UNET_NAME = "fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors"
TAOMATE_LORA_NAME = "minimax_h3_taomate_fl2va_3step_ema_comfyui.safetensors"
SHIFT_DRAFT_FAST = 10.0
SHIFT_DRAFT_TURBO = 12.0
SHIFT_REFINE = 12.0
SHIFT_AUDIO = 3.0
TURBO_STRENGTH = 0.8
ATTN_FULL = "pytorch attention"   # полноточное: быстрое INT8 у нас давало морфинг в конце ролика

GRID = 32
BASE_SHORT = 768
MAX_PIXELS = 768 * 1344
MIN_SIDE = 256


# ---------------- размер ----------------

def _snap(v):
    return max(GRID, int(math.floor(v / GRID + 0.5)) * GRID)


def canvas(width, height):
    """Паспорт H3 той же формы: короткая сторона 768, площадь ≤ 768×1344, кратно 32."""
    w, h = max(1.0, float(width)), max(1.0, float(height))
    r = w / h
    nw, nh = (BASE_SHORT * r, BASE_SHORT) if r >= 1 else (BASE_SHORT, BASE_SHORT / r)
    if nw * nh > MAX_PIXELS:
        s = math.sqrt(MAX_PIXELS / (nw * nh))
        nw, nh = nw * s, nh * s
    w2, h2 = _snap(nw), _snap(nh)
    while w2 * h2 > MAX_PIXELS:
        if w2 >= h2:
            w2 -= GRID
        else:
            h2 -= GRID
    return w2, h2


def draft_size(width, height, area):
    k = math.sqrt(max(0.4, min(1.0, float(area))))
    return max(MIN_SIDE, _snap(width * k)), max(MIN_SIDE, _snap(height * k))


# ---------------- служебное ----------------

def _base(name):
    return str(name).replace("\\", "/").split("/")[-1]


def _find(kind, name):
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if _base(f) == name:
                return f
    except Exception:
        pass
    return None


def _has_node(name):
    try:
        import nodes as comfy_nodes
        return name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def _upscaler_file():
    try:
        import folder_paths
        for f in folder_paths.get_filename_list("latent_upscale_models"):
            b = _base(f).lower()
            if "minimax" in b or "h3" in b:
                return f
    except Exception:
        pass
    return None


def _split(latent):
    s = latent["samples"]
    if getattr(s, "is_nested", False):
        return s.tensors[0], s.tensors[1]
    return s, None


def _join(latent, video, audio):
    import comfy.nested_tensor
    out = dict(latent)
    out["samples"] = comfy.nested_tensor.NestedTensor((video, audio)) if audio is not None else video
    out.pop("noise_mask", None)
    return out


def _stretch(latent, w, h):
    video, audio = _split(latent)
    size = (video.shape[2], h // 16, w // 16)
    up = torch.nn.functional.interpolate(video.float(), size=size, mode="trilinear", align_corners=False)
    return _join(latent, up.to(video.dtype), audio)


def _upscale(latent, w, h, report):
    name = _upscaler_file()
    missing = [n for n in ("LatentUpscaleModelLoader", "MiniMaxH3LatentUpscaleWithModel") if not _has_node(n)]
    if name and not missing:
        try:
            up = pipeline._call_node("LatentUpscaleModelLoader", model_name=name)[0]
            out = pipeline._call_node("MiniMaxH3LatentUpscaleWithModel", model=up, samples=latent,
                                      width=int(w), height=int(h))[0]
            report.append(f"Увеличение: модель {_base(name)}")
            return out
        except Exception as e:
            log.warning("[H3 HD] апскейлер %s не подошёл (%s) — растягиваю", name, e)
            report.append(f"Увеличение: {_base(name)} не подошла ({type(e).__name__}) — простое растяжение")
    elif name:
        report.append(f"Увеличение: файл {_base(name)} есть, но в этом ComfyUI нет родной ноды "
                      f"{', '.join(missing)} — простое растяжение")
    else:
        report.append("Увеличение: простое растяжение латента")
    return _stretch(latent, w, h)


def _prepare(model, shift, report, label):
    model = pipeline._call_node("MiniMaxH3SigmaShift", model=model, shift_video=float(shift),
                                shift_audio=SHIFT_AUDIO)[0]
    if _has_node("ModelAttentionBackend"):
        try:
            model = pipeline._call_node("ModelAttentionBackend", model=model, attention=ATTN_FULL)[0]
        except Exception as e:
            log.warning("[H3 HD] внимание %s недоступно (%s)", ATTN_FULL, e)
    return model


def _sample(model, positive, latent, seed, steps, denoise):
    sampler = pipeline._call_node("KSamplerSelect", sampler_name="res_multistep")[0]
    noise = pipeline._call_node("RandomNoise", noise_seed=int(seed))[0]
    sigmas = pipeline._call_node("BasicScheduler", model=model, scheduler="simple", steps=int(steps),
                                 denoise=float(denoise))[0]
    guider = pipeline._call_node("BasicGuider", model=model, conditioning=positive)[0]
    return pipeline._call_node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler,
                               sigmas=sigmas, latent_image=latent)[0]


# ---------------- главное ----------------

def generate(mode, prompt, ref_images, width, height, length, seed, user_loras, models,
             decode_tile_size=0, ref_video=None, ref_video_audio=None, ref_audio=None):
    """→ (видео, звук, последний кадр, число кадров, отчёт-строки)."""
    t0 = time.time()
    report = []
    area, d_steps, r_steps, r_strength = PRESETS[mode]
    dw, dh = draft_size(width, height, area)
    report.append(f"Режим {mode.split(' / ')[0]}: черновик {dw}×{dh} ({d_steps} шагов) → финал "
                  f"{width}×{height}, чистовик {r_steps} {'шага' if r_steps in (2, 3, 4) else 'шагов'}, сила {r_strength:g}; "
                  f"{length} кадров "
                  f"({length / 24:.2f} с)")
    log_vram("HD start")

    # ---- 1. текст и образцы (один раз) ----
    clip = pipeline._load_clip(models["clip"], models["clip_type"])
    vae_video = pipeline._load_vae(models["vae_video"])
    refs = [r for r in ref_images if r is not None]
    positive, _ = pipeline._reference_to_video(
        clip=clip, vae=vae_video, ref_images=refs, prompt=prompt, width=width, height=height,
        length=length, ref_video=ref_video, ref_video_audio=ref_video_audio, ref_audio=ref_audio)
    report.append(f"Образцы: {len(refs)}" + ("" if refs else " — честный «текст → видео»"))
    clip = None
    free_between_stages("HD: текстовый энкодер выгружен")
    draft_latent = pipeline._call_node("EmptyMiniMaxH3LatentAV", width=int(dw), height=int(dh),
                                       length=int(length))[0]

    # ---- 2. черновик ----
    t = time.time()
    fast = _find("diffusion_models", FAST_UNET_NAME)
    if fast:
        model = pipeline._load_unet(fast)
        shift = SHIFT_DRAFT_FAST
        report.append(f"Черновик: {_base(fast)}")
    else:
        model = pipeline._load_unet(models["unet"])
        model = pipeline._apply_lora(model, models["turbo_lora"], TURBO_STRENGTH)
        shift = SHIFT_DRAFT_TURBO
        report.append(f"Черновик: {_base(models['unet'])} + турбо-LoRA ×{TURBO_STRENGTH} "
                      f"(Fast H3 не найден — скачай {FAST_UNET_NAME}, будет быстрее)")
    for name, st in user_loras:
        model = pipeline._apply_lora(model, name, float(st))
    model = _prepare(model, shift, report, "Черновик")
    out = _sample(model, positive, draft_latent, seed, d_steps, 1.0)
    model = None
    free_between_stages("HD: модель черновика выгружена")
    report.append(f"Черновик: {time.time() - t:.0f} с (с загрузкой модели)")
    _, draft_audio = _split(out)

    # ---- 3. увеличение ----
    out = _upscale(out, width, height, report)

    # ---- 4. чистовик ----
    t = time.time()
    model = pipeline._load_unet(models["unet"])
    taomate = _find("loras", TAOMATE_LORA_NAME)
    if taomate:
        model = pipeline._apply_lora(model, taomate, 1.0)
        report.append(f"Чистовик: {_base(models['unet'])} + {TAOMATE_LORA_NAME}")
    else:
        model = pipeline._apply_lora(model, models["turbo_lora"], TURBO_STRENGTH)
        report.append(f"Чистовик: {_base(models['unet'])} + турбо-LoRA ×{TURBO_STRENGTH}")
    for name, st in user_loras:
        model = pipeline._apply_lora(model, name, float(st))
    model = _prepare(model, SHIFT_REFINE, report, "Чистовик")
    out = _sample(model, positive, out, int(seed) + 1, r_steps, r_strength)
    model = None
    positive = None
    if draft_audio is not None:                      # звук — из черновика, чистовик рисует только картинку
        video_lat, _ = _split(out)
        out = _join(out, video_lat, draft_audio)
    free_between_stages("HD: модель чистовика выгружена")
    report.append(f"Чистовик: {time.time() - t:.0f} с (с загрузкой модели)")

    # ---- 5. раскодировка (как в обычных режимах) ----
    video = pipeline._vae_decode_video_smart(out, vae_video, decode_tile_size=int(decode_tile_size or 0))
    vae_video = None
    free_between_stages("HD: видео-VAE выгружен")
    vae_audio = pipeline._load_vae(models["vae_audio"])
    audio = pipeline._vae_decode_audio(out, vae_audio)
    vae_audio = None
    out = None
    free_between_stages("HD: аудио-VAE выгружен")

    last = pipeline._last_frame(video)
    n = int(video.shape[0])
    report.append(f"Готово: {n} кадров за {time.time() - t0:.0f} с")
    for line in report:
        log.info("[H3 HD] %s", line)
    return video, audio, last, n, report
