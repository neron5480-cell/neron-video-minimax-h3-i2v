# -*- coding: utf-8 -*-
"""Генерация H3 по ОФИЦИАЛЬНОМУ рецепту ComfyUI (шаблоны video_minimax_h3_i2v / t2v / r2v), с быстрыми деталями Lite.

Почему (находка 19.11): Lite подаёт картинку модели fl2va как «образец» (MiniMaxH3ReferenceToVideo) — так эта модель
не обучена: кадр ничем не закреплён, со 2–5-й секунды модель «уплывает». Плюс всегда INT8-внимание и сдвиг 6/3.
Официально:
  • картинка (± последний кадр) или без картинок → модель fl2va + MiniMaxH3ImageToVideo(first_frame, last_frame) —
    картинка — ЯКОРНЫЙ кадр 0; турбо-LoRA fl2v 8step ×1.0; без MiniMaxH3SigmaShift;
  • несколько образцов / видео- или звук-образец → ДРУГАЯ модель ref2va + LoRA ref2v_turbo_4step +
    MiniMaxH3ReferenceToVideo (match).
От Lite берём то, что даёт скорость и не трогает картинку: раскодировку плитками под свободную VRAM, кэш LoRA в
оперативке, очистку памяти по этапам (pipeline.py — без изменений, вызываем его функции).
Внимание — на выбор: sparse (официальный «Model Sparse Attention», sol-attn: первые 20% шагов — полное), полное
(pytorch), INT8 (comfy kitchen, как в Lite).
Все вызовы родных нод — через pipeline._call_node, поэтому полоса хода видит этапы."""
import logging

import folder_paths

from . import pipeline
from .memory import free_between_stages, log_vram

log = logging.getLogger("Neron.H3.Official")

ATTN = ["⚡ sparse (sol-attn)", "полное / full (pytorch)", "INT8 (comfy kitchen)"]
ATTN_DEFAULT = ATTN[0]
SPARSE_TAU = 1.3
SPARSE_START = 0.2

REF2VA_UNET = "minimax_h3_ref2va_pruned_int8_convrot.safetensors"
REF2VA_LORA = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"
REF2VA_TURBO_STEPS = 4


def _find(kind, name):
    try:
        for f in folder_paths.get_filename_list(kind):
            if f.replace("\\", "/").split("/")[-1] == name:
                return f
    except Exception:
        pass
    return None


def _attention(model, attention, notes):
    """Внимание на выбор. Не вышло (нет нод / ядер) — полное, с запиской в отчёте."""
    if attention == ATTN[2]:
        try:
            m = pipeline._call_node("ModelAttentionBackend", model=model, attention="comfy kitchen attention")[0]
            notes.append("Внимание: INT8 (comfy kitchen)")
            return m
        except Exception as e:
            notes.append(f"Внимание: INT8 недоступно ({e}) — полное")
            return model
    if attention == ATTN[0]:
        try:
            m = pipeline._call_node("BlockSparseAttention", model=model,
                                    selection={"selection": "sol-attn", "tau": SPARSE_TAU},
                                    start_percent=SPARSE_START, end_percent=1.0)[0]
            notes.append(f"Внимание: sparse sol-attn (τ {SPARSE_TAU:g}, с {int(SPARSE_START * 100)}% шагов)")
            return m
        except Exception as e:
            notes.append(f"Внимание: sparse недоступно ({e}) — полное")
            return model
    notes.append("Внимание: полное (pytorch)")
    return model


def generate(prompt, images, last_frame, width, height, length, is_turbo, steps, seed, user_loras, models,
             attention=ATTN_DEFAULT, decode_tile_size=0, ref_video=None, ref_video_audio=None, ref_audio=None):
    """→ (video, audio, last_frame, frames_count, notes)."""
    notes = []
    pics = [im for im in images if im is not None]
    use_ref = len(pics) > 1 or ref_video is not None or ref_audio is not None
    unet, turbo_lora = models["unet"], models["turbo_lora"]
    if use_ref:
        r_unet = _find("diffusion_models", REF2VA_UNET)
        if r_unet is None:
            notes.append(f"⚠ Несколько образцов: нужна модель {REF2VA_UNET} (официальная, Comfy-Org) — её нет в "
                         f"diffusion_models. Беру только первую картинку как первый кадр.")
            use_ref = False
            pics = pics[:1]
        else:
            unet = r_unet
            r_lora = _find("loras", REF2VA_LORA)
            if is_turbo and r_lora is None:
                notes.append(f"⚠ Нет турбо-LoRA {REF2VA_LORA} — образцы идут в режиме «Обычный»")
                is_turbo = False
                steps = 20
            elif is_turbo:
                turbo_lora, steps = r_lora, REF2VA_TURBO_STEPS
    if use_ref:
        notes.append(f"Путь: по образцам (ref2va), картинок {len(pics)}" + (", видео-образец" if ref_video is not None
                                                                            else "") +
                     (", звук-образец" if ref_audio is not None else ""))
    elif pics:
        notes.append("Путь: картинка → видео (якорный первый кадр)" + (" + последний кадр" if last_frame is not None
                                                                     else ""))
    else:
        notes.append("Путь: текст → видео" + (" + последний кадр" if last_frame is not None else ""))

    # ---- 1. текст и кадры ----
    clip = pipeline._load_clip(models["clip"], models["clip_type"])
    vae_video = pipeline._load_vae(models["vae_video"])
    if use_ref:
        params = {"clip": clip, "vae": vae_video, "prompt": prompt, "width": int(width), "height": int(height),
                  "length": int(length), "ref_image_size": "match"}
        if pics:
            params["ref_images"] = {f"ref_image_{i}": im for i, im in enumerate(pics)}
        if ref_video is not None:
            params["ref_videos"] = {"ref_video_0": ref_video}
            if ref_video_audio is not None:
                params["ref_video_audios"] = {"ref_video_audio_0": ref_video_audio}
        if ref_audio is not None:
            params["ref_audios"] = {"ref_audio_0": ref_audio}
        if ref_audio is not None or ref_video_audio is not None:
            params["audio_vae"] = pipeline._load_vae(models["vae_audio"])
        res = pipeline._call_node("MiniMaxH3ReferenceToVideo", **params)
        positive, latent = res[0], res[1]
    else:
        kw = {}
        if pics:
            kw["first_frame"] = pics[0]
        if last_frame is not None:
            kw["last_frame"] = last_frame
        res = pipeline._call_node("MiniMaxH3ImageToVideo", clip=clip, vae=vae_video, prompt=prompt,
                                  width=int(width), height=int(height), length=int(length), **kw)
        positive, latent = res[0], res[1]
    clip = None
    free_between_stages("Официальный путь: текст готов")
    log_vram("After encode")

    # ---- 2. модель ----
    model = pipeline._load_unet(unet)
    if is_turbo:
        model = pipeline._apply_lora(model, turbo_lora, 1.0)
    for name, st in user_loras:
        model = pipeline._apply_lora(model, name, float(st))
    model = _attention(model, attention, notes)
    notes.append(f"Модель: {str(unet).split('/')[-1]}" + (f", турбо-LoRA ×1.0 ({str(turbo_lora).split('/')[-1]})"
                                                           if is_turbo else "") + f", шагов {int(steps)}")

    # ---- 3. генерация (как в официальном шаблоне, без SigmaShift) ----
    sampler = pipeline._sampler_select("res_multistep")
    noise = pipeline._random_noise(seed)
    sigmas = pipeline._basic_scheduler(model, steps)
    guider = pipeline._basic_guider(model, positive)
    out = pipeline._sampler_advanced(noise=noise, guider=guider, sampler=sampler, sigmas=sigmas, latent=latent)
    model = guider = sigmas = None
    free_between_stages("Официальный путь: после сэмплинга")

    # ---- 4. раскодировка — быстрая, как в Lite ----
    video = pipeline._vae_decode_video_smart(out, vae_video, decode_tile_size=int(decode_tile_size or 0))
    vae_audio = pipeline._load_vae(models["vae_audio"])
    audio = pipeline._vae_decode_audio(out, vae_audio)
    vae_video = vae_audio = out = None
    free_between_stages("Официальный путь: после раскодировки")
    last = pipeline._last_frame(video)
    return video, audio, last, int(video.shape[0]), notes
