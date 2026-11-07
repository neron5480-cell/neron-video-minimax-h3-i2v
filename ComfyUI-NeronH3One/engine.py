# -*- coding: utf-8 -*-
"""🎬 Движок Neron H3 One — один ролик MiniMax H3 (видео + звук), пять режимов.

  🔥 Экстрим  — что установлено самое быстрое: Fast H3 (8 шагов, разреженное vsa) или база + быстрая LoRA (4 шага);
  🚀 Быстро   — наш проверенный: быстрая LoRA, 6 шагов (⚙: 4…10 или турбо-LoRA 12 шагов);
  ⚖ Баланс    — HD: маленький черновик → увеличение → короткий чистовик в полном размере;
  ✨ Качество — полная модель (bf16, если есть), 40 шагов, без LoRA скорости;
  👑 Максимум — bf16 + точный энкодер (int8), 50 шагов, образцы в полном качестве.

Порядок в памяти (Engine): текст и образцы → выгрузка энкодера → модель + сэмплер → выгрузка →
видео-VAE → выгрузка → аудио-VAE → выгрузка.

Картинки:
  • first (окно 1 / img_0) — первый кадр. «🎯 кадр + образец»: он и настоящий кадр 0.00 с (MiniMaxH3AddGuide /
    first_frame), и <Picture 1> для текста. «🖼 только образец» — как в Raw Engine и HD: только <Picture 1>;
  • ref_1..3 — образцы <Picture 2..4>: вид героя, предмета, места; не кадры;
  • last — настоящий последний кадр ролика.
Промпт идёт в модель ДОСЛОВНО: движок в нём ничего не переписывает.
"""
import logging
import math
import time

import torch

from . import speed
from .core import (TAG, Clock, FriendlyError, base, bf16_twin, check_comfy, crop_to_aspect, decode_audio,
                   decode_video, find_file, free, has_node, is_quantized, load_clip, lora, node, sample, send,
                   vram_log)

log = logging.getLogger("Neron.H3.One")

# ---------------- режимы ----------------
MODES = ["🔥 Экстрим / Extreme", "🚀 Быстро / Fast", "⚖ Баланс / Balance", "✨ Качество / Quality",
         "👑 Максимум / Maximum"]
EXTREME, FAST, BALANCE, QUALITY, MAXIMUM = MODES
DEFAULT_MODE = FAST
MODE_PACK = {EXTREME: "extreme", FAST: "standard", BALANCE: "standard", QUALITY: "quality", MAXIMUM: "maximum"}

FIRST_AS = ["🎯 кадр + образец (рекомендуется) / frame + reference", "🖼 только образец (как Raw Engine) / reference only"]
FIRST_FRAME_REF, FIRST_REF_ONLY = FIRST_AS

FAST_KIND = ["🚀 быстрая LoRA (4-шаговая) / Fast LoRA", "⚡ турбо-LoRA (8-шаговая), 12 шагов / Turbo LoRA"]
FAST_LORA_KIND, TURBO_LORA_KIND = FAST_KIND
FAST_STEPS = ["4", "6", "8", "10"]
FAST_DEFAULT_STEPS = 6

SHIFT_VIDEO, SHIFT_AUDIO = 12.0, 3.0          # на этом обучены модель и турбо-LoRA
SHIFT_FAST_H3 = 10.0                          # Fast H3 (как в HD-черновике)
QUALITY_STEPS, MAX_STEPS, TURBO_STEPS, EXTREME_STEPS, FAST_H3_STEPS = 40, 50, 12, 4, 8
TURBO_STRENGTH, FAST_STRENGTH = 0.8, 1.0
SPARSE_TAU, VSA_KEEP = 1.3, 10.0

# Баланс (HD): (площадь черновика, шаги черновика, шаги чистовика, сила чистовика) — замеры HD на 5070 Ti
BALANCE_HD = (0.5, 8, 3, 0.5)
BALANCE_CLEAN = (0.6, 8, 6, 0.6)
TAOMATE_LORA = "minimax_h3_taomate_fl2va_3step_ema_comfyui.safetensors"

STD_UNET = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"


def mode_key(mode):
    return mode if mode in MODES else DEFAULT_MODE


# ---------------- выбор модели ----------------

def _protect(unet, use_lora, protect, report, why):
    """LoRA на сжатой модели → берём ту же модель в bf16, если лежит. Нет — честно пишем, чем грозит."""
    if not use_lora or not is_quantized(unet):
        return unet
    twin = bf16_twin(unet)
    if protect and twin:
        report.append(f"🛡 LoRA ({why}) на сжатой модели двоит — взята та же модель без сжатия: {base(twin)} "
                      f"/ LoRA on a compressed model ghosts — using its bf16 twin")
        return twin
    if protect:
        report.append(f"⚠ LoRA ({why}) ложится на сжатую модель {base(unet)}: ComfyUI пересжимает её веса, бывает "
                      f"двоение и артефакты. Помогает та же модель в bf16 рядом (…_bf16.safetensors). "
                      f"/ LoRA on a compressed model may ghost; put its bf16 twin next to it.")
    return unet


def _quality_unet(unet, report):
    twin = bf16_twin(unet)
    if twin:
        report.append(f"Модель без сжатия: {base(twin)} / uncompressed model")
        return twin
    if is_quantized(unet):
        report.append(f"Модели bf16 рядом нет — работаю на {base(unet)}. Для чистой детали положи её bf16-версию "
                      f"(кнопка «📥 Модели» качает стандартную). / no bf16 twin — using the compressed model")
    return unet


def _load_unet(name):
    try:
        return node("UNETLoader", unet_name=name, weight_dtype="default")[0]
    except Exception as e:
        from .core import is_oom
        if not is_oom(e):
            raise
        free("не хватило памяти под модель — повтор с чистой памятью")
        return node("UNETLoader", unet_name=name, weight_dtype="default")[0]


def _speed(model, opt, mode, is_fast_h3, report):
    att = opt.get("attention") or speed.AUTO
    if att == speed.AUTO:
        att = speed.ATT_SAGE if (mode == EXTREME and speed.available()["sage"]) else speed.ATT_PYTORCH
    sp = opt.get("sparse") or speed.AUTO
    if sp == speed.AUTO:
        sp = (speed.SP_VSA if is_fast_h3 else speed.SP_SOL) if mode == EXTREME else speed.SP_OFF
    return speed.apply(model, att, sp, opt.get("tau", SPARSE_TAU), VSA_KEEP, is_fast_h3, report)


def _build(unet_name, speed_lora, user_loras, shift_video, opt, mode, is_fast_h3, report, label=""):
    model = _load_unet(unet_name)
    if speed_lora:
        model = lora(model, speed_lora[0], speed_lora[1])
        report.append(f"{label}LoRA скорости: {base(speed_lora[0])} ×{speed_lora[1]:g}")
    for name, st in user_loras:
        model = lora(model, name, float(st))
    if user_loras:
        report.append(f"{label}LoRA: " + ", ".join(f"{base(n)} ×{s:g}" for n, s in user_loras))
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=float(shift_video), shift_audio=SHIFT_AUDIO)[0]
    return _speed(model, opt, mode, is_fast_h3, report)


# ---------------- условия: текст + картинки ----------------

def _conditioning(clip, vae, prompt, w, h, length, imgs, first_as, ref_quality, vae_audio, report, keyframes=True):
    """→ (positive, latent). keyframes=False — без настоящих кадров (для HD: черновик и чистовик разного размера)."""
    first = crop_to_aspect(imgs.get("first"), w, h)
    last = crop_to_aspect(imgs.get("last"), w, h)
    extras = [imgs.get(k) for k in ("ref_1", "ref_2", "ref_3") if imgs.get(k) is not None]
    media = {k: imgs.get(k) for k in ("ref_video", "ref_video_audio", "ref_audio") if imgs.get(k) is not None}
    frame = keyframes and first_as == FIRST_FRAME_REF

    if frame and not extras and not media:
        # официальный путь «картинка → видео»: первый (и последний) кадр — настоящие кадры и <Picture N> для текста
        positive, latent = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=prompt, width=int(w),
                                height=int(h), length=int(length), first_frame=first,
                                last_frame=last if keyframes else None)
        if first is not None:
            report.append("Первый кадр: настоящий кадр 0.00 с + <Picture 1> / first frame: keyframe + <Picture 1>")
        if last is not None and keyframes:
            report.append("Последний кадр: настоящий кадр конца / last frame: keyframe")
        return positive, latent

    refs = ([first] if first is not None else []) + extras
    if refs or media:
        kw = {}
        if refs:
            kw["ref_images"] = {f"ref_image_{i}": im for i, im in enumerate(refs)}
        if "ref_video" in media:
            kw["ref_videos"] = {"ref_video_0": media["ref_video"]}
            if "ref_video_audio" in media:
                kw["ref_video_audios"] = {"ref_video_audio_0": media["ref_video_audio"]}
        if "ref_audio" in media:
            kw["ref_audios"] = {"ref_audio_0": media["ref_audio"]}
        if "ref_audio" in media or "ref_video_audio" in media:
            kw["audio_vae"] = node("VAELoader", vae_name=vae_audio)[0]
        positive, latent = node("MiniMaxH3ReferenceToVideo", clip=clip, vae=vae, prompt=prompt, width=int(w),
                                height=int(h), length=int(length), ref_image_size=ref_quality, **kw)
        del kw
        tags = []
        if first is not None:
            tags.append("<Picture 1> первый кадр")
        tags += [f"<Picture {i + (2 if first is not None else 1)}> образец" for i in range(len(extras))]
        if tags:
            report.append("Образцы / references: " + ", ".join(tags) +
                          f" ({'полное качество' if ref_quality == 'max' else 'под размер кадра'})")
        if media:
            report.append("Медиа-образцы / media refs: " + ", ".join(media))
    else:
        positive, latent = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=prompt, width=int(w),
                                height=int(h), length=int(length))
        report.append("Картинок нет — честный «текст → видео» / no pictures — text to video")

    if keyframes and has_node("MiniMaxH3AddGuide"):
        if frame and first is not None:
            positive = node("MiniMaxH3AddGuide", positive=positive, latent=latent, vae=vae, image=first[:1],
                            frame_idx=0)[0]
            report.append("Первый кадр: ещё и настоящий кадр 0.00 с / first frame is also the 0.00 s keyframe")
        if last is not None:
            positive = node("MiniMaxH3AddGuide", positive=positive, latent=latent, vae=vae, image=last[:1],
                            frame_idx=-1)[0]
            report.append("Последний кадр: настоящий кадр конца / last frame: keyframe")
    elif not keyframes and (first is not None or last is not None):
        report.append("⚖ Баланс: картинки идут образцами (черновик и чистовик разного размера) / Balance: pictures "
                      "are references only")
    return positive, latent


# ---------------- HD: увеличение латента ----------------

def _draft_size(w, h, area):
    k = math.sqrt(max(0.4, min(1.0, float(area))))
    snap = lambda v: max(32, int(math.floor(v / 32 + 0.5)) * 32)
    return max(256, snap(w * k)), max(256, snap(h * k))


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


def _upscale(latent, w, h, report):
    name = None
    try:
        import folder_paths
        for f in folder_paths.get_filename_list("latent_upscale_models"):
            b = base(f).lower()
            if "minimax" in b or "h3" in b:
                name = f
                break
    except Exception:
        pass
    if name and has_node("LatentUpscaleModelLoader") and has_node("MiniMaxH3LatentUpscaleWithModel"):
        try:
            up = node("LatentUpscaleModelLoader", model_name=name)[0]
            out = node("MiniMaxH3LatentUpscaleWithModel", model=up, samples=latent, width=int(w), height=int(h))[0]
            report.append(f"Увеличение: модель {base(name)} / upscale model")
            return out
        except Exception as e:
            report.append(f"Увеличение: {base(name)} не подошла ({type(e).__name__}) — растяжение латента")
    else:
        report.append("Увеличение: растяжение латента / latent stretch")
    video, audio = _split(latent)
    up = torch.nn.functional.interpolate(video.float(), size=(video.shape[2], h // 16, w // 16), mode="trilinear",
                                         align_corners=False)
    return _join(latent, up.to(video.dtype), audio)


# ---------------- главное ----------------

def generate(mode, prompt, width, height, length, seed, models, imgs, user_loras=(), opt=None):
    """models: {роль: файл или None}; imgs: first, ref_1..3, last, ref_video, ref_video_audio, ref_audio;
    opt: first_as, protect_lora, keep_clip, ref_quality, attention, sparse, tau, fast_steps, fast_kind, clean,
    unet_chosen (человек сам выбрал модель — не подменяем её на Fast H3).
    → (видео [T,H,W,3], звук, последний кадр, число кадров, отчёт-строки)."""
    check_comfy()
    opt = dict(opt or {})
    mode = mode_key(mode)
    clock = Clock()
    report = []
    user_loras = list(user_loras or [])
    protect = bool(opt.get("protect_lora", True))
    unet = models["unet"]
    fast_h3 = models.get("unet_fast") if not opt.get("unet_chosen") else None
    hd = mode == BALANCE

    # ---- план режима ----
    speed_lora, shift, is_fast_h3 = None, SHIFT_VIDEO, False
    if mode == EXTREME:
        if fast_h3:
            unet, steps, shift, is_fast_h3 = fast_h3, FAST_H3_STEPS, SHIFT_FAST_H3, True
            report.append(f"🔥 Экстрим: Fast H3, {steps} шагов, без LoRA скорости")
        else:
            steps = EXTREME_STEPS
            speed_lora = (models.get("fast_lora"), FAST_STRENGTH)
            report.append(f"🔥 Экстрим: {base(unet)} + быстрая LoRA, {steps} шага"
                          + ("" if opt.get("unet_chosen") else " (Fast H3 нет — «📥 Модели» скачает, будет быстрее)"))
    elif mode == FAST:
        if opt.get("fast_kind") == TURBO_LORA_KIND:
            steps, speed_lora = TURBO_STEPS, (models.get("turbo_lora"), TURBO_STRENGTH)
        else:
            fs = int(opt.get("fast_steps") or FAST_DEFAULT_STEPS)
            steps = fs if str(fs) in FAST_STEPS else FAST_DEFAULT_STEPS
            speed_lora = (models.get("fast_lora"), FAST_STRENGTH)
        report.append(f"🚀 Быстро: {steps} шагов")
    elif mode == QUALITY:
        steps = QUALITY_STEPS
        unet = _quality_unet(unet, report)
        report.append(f"✨ Качество: {steps} шагов")
    elif mode == MAXIMUM:
        steps = MAX_STEPS
        unet = _quality_unet(unet, report)
        report.append(f"👑 Максимум: {steps} шагов")
    else:
        steps = 0
    if speed_lora and not speed_lora[0]:
        need = "быстрая LoRA (🚀)" if speed_lora[1] == FAST_STRENGTH else "турбо-LoRA (⚡)"
        raise FriendlyError(f"{TAG} Для этого режима нужна {need}, а её нет в models/loras. Нажми на ноде «📥 Модели» "
                            f"или выбери «✨ Качество».\n\nEN: This mode needs the {need} in models/loras. Press "
                            f"«📥 Models» on the node or switch to Quality.")
    if mode == EXTREME:
        # в Экстриме скорость главнее: bf16 не подставляем, но честно предупреждаем
        if (speed_lora or user_loras) and is_quantized(unet):
            report.append("⚠ Экстрим: LoRA на сжатой модели — возможны двоение и артефакты; чище — 🚀 Быстро "
                          "/ Extreme: LoRA on a compressed model may ghost")
    elif speed_lora:
        unet = _protect(unet, True, protect, report, "скорости")
    elif user_loras:
        unet = _protect(unet, True, protect, report, "твои")

    ref_quality = opt.get("ref_quality") or "auto"
    if ref_quality == "auto":
        ref_quality = "match" if mode in (EXTREME, FAST, BALANCE) else "max"
    clip_name = models["clip"]
    if mode == MAXIMUM and models.get("clip_precise"):
        clip_name = models["clip_precise"]
    report.append(f"Размер {width}×{height}, {length} кадров ({length / 24:.2f} с) / size, frames")
    free("перед стартом")
    vram_log("старт")

    # ---- 1. текст и образцы ----
    send("Текст и образцы / Text & references")
    clip, cached = load_clip(clip_name, opt.get("keep_clip", "auto"))
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    positive, latent = _conditioning(clip, vae, prompt, width, height, length, imgs,
                                     opt.get("first_as", FIRST_FRAME_REF), ref_quality, models["vae_audio"], report,
                                     keyframes=not hd)
    del clip
    free("текстовый энкодер выгружен")
    clock.mark("Текст и образцы / text", f"энкодер {'из памяти' if cached else 'с диска'} · {base(clip_name)}")

    # ---- 2. генерация ----
    if not hd:
        send("Загрузка модели / Loading model")
        model = _build(unet, speed_lora, user_loras, shift, opt, mode, is_fast_h3, report)
        report.append(f"Модель: {base(unet)}")
        clock.mark("Загрузка модели / load")
        send("Генерация / Generating", 0, steps)
        t = time.time()
        out = sample(model, positive, latent, seed, steps)
        gen = time.time() - t
        clock.mark("Генерация / sampling", f"{steps} шагов · {gen / max(1, steps):.1f} с/шаг")
        del model, positive, latent
        free("модель выгружена")
    else:
        out = _balance(unet, fast_h3, models, user_loras, positive, width, height, length, seed, opt, protect,
                       report, clock)
        del positive, latent
    vram_log("после генерации")

    # ---- 3. раскодировка ----
    send("Раскодировка видео / Decoding video")
    try:
        video, how = decode_video(out, vae)
    except Exception as e:
        from .core import is_oom
        if not is_oom(e):
            raise
        free("видео-VAE: повтор с чистой памятью")
        vae = node("VAELoader", vae_name=models["vae_video"])[0]
        video, how = decode_video(out, vae)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = video.cpu()
    del vae
    free("видео-VAE выгружен")
    clock.mark("Раскодировка видео / video decode", how)
    send("Раскодировка звука / Decoding audio")
    audio = decode_audio(out, models["vae_audio"])
    del out
    free("аудио-VAE выгружен")
    clock.mark("Раскодировка звука / audio decode")

    n = int(video.shape[0])
    last = video[-1:].clone()
    report += clock.table()
    send("Готово / Done", 1, 1)
    vram_log("финиш")
    return video, audio, last, n, report


def _balance(unet, fast_h3, models, user_loras, positive, w, h, length, seed, opt, protect, report, clock):
    """⚖ Баланс (HD): черновик маленький → увеличение → чистовик полного размера. Звук — из черновика."""
    area, d_steps, r_steps, r_strength = BALANCE_CLEAN if opt.get("clean") else BALANCE_HD
    dw, dh = _draft_size(w, h, area)
    report.append(f"⚖ Баланс{' (чище)' if opt.get('clean') else ''}: черновик {dw}×{dh}, {d_steps} шагов → чистовик "
                  f"{w}×{h}, {r_steps} шага, сила {r_strength:g}")
    draft_latent = node("EmptyMiniMaxH3LatentAV", width=int(dw), height=int(dh), length=int(length))[0]

    # черновик
    send("Черновик / Draft", 0, d_steps)
    if fast_h3:
        model = _build(fast_h3, None, user_loras, SHIFT_FAST_H3, opt, BALANCE, True, report, "Черновик: ")
        report.append(f"Черновик: {base(fast_h3)}")
    else:
        if not models.get("turbo_lora"):
            raise FriendlyError(f"{TAG} Для ⚖ Баланса нужна турбо-LoRA — нажми «📥 Модели».\n\nEN: Balance needs the "
                                f"Turbo LoRA — press «📥 Models».")
        d_unet = _protect(unet, True, protect, report, "черновик")
        model = _build(d_unet, (models["turbo_lora"], TURBO_STRENGTH), user_loras, SHIFT_VIDEO, opt, BALANCE, False,
                       report, "Черновик: ")
        report.append(f"Черновик: {base(d_unet)}")
    out = sample(model, positive, draft_latent, seed, d_steps)
    del model
    free("модель черновика выгружена")
    clock.mark("Черновик / draft", f"{dw}×{dh} · {d_steps} шагов")
    _, draft_audio = _split(out)

    out = _upscale(out, w, h, report)

    # чистовик
    send("Чистовик / Refine", 0, r_steps)
    taomate = find_file("loras", TAOMATE_LORA)
    r_lora = (taomate, 1.0) if taomate else (models.get("turbo_lora"), TURBO_STRENGTH)
    r_unet = _protect(unet, True, protect, report, "чистовик")
    model = _build(r_unet, r_lora, user_loras, SHIFT_VIDEO, opt, BALANCE, False, report, "Чистовик: ")
    report.append(f"Чистовик: {base(r_unet)}")
    out = sample(model, positive, out, int(seed) + 1, r_steps, denoise=r_strength)
    del model
    if draft_audio is not None:                      # звук — из черновика, чистовик рисует только картинку
        video_lat, _ = _split(out)
        out = _join(out, video_lat, draft_audio)
    free("модель чистовика выгружена")
    clock.mark("Чистовик / refine", f"{r_steps} шагов · сила {r_strength:g}")
    return out
