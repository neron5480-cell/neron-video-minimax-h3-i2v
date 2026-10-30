# -*- coding: utf-8 -*-
"""Движок «скорость + качество» для MiniMax H3: черновик → увеличение → чистовик.

Идея: дорого рисовать большой кадр на многих шагах. Поэтому
  1. ЧЕРНОВИК — маленький кадр (часть площади паспорта), быстрая модель (Fast H3, 8 шагов).
     Здесь рождаются сюжет, движение и звук. Мелкая деталь тут не важна.
  2. УВЕЛИЧЕНИЕ — латент черновика растягивается до размера паспорта
     (модель-апскейлер для H3, если есть; иначе простое растяжение латента).
  3. ЧИСТОВИК — полный размер, базовая модель + быстрая LoRA, несколько шагов с частичной
     перерисовкой (сила 0.3–0.7): движение остаётся от черновика, деталь рисуется заново.
  4. Раскодировка, как в H3 Engine: целым кадром, плитки только при нехватке памяти.

Что взято у H3 Engine и не меняется: паспорт модели, память по этапам, полноточное внимание
по умолчанию (быстрое INT8 давало у нас морфинг в конце ролика), защищённая раскодировка.
Только родные ноды ComfyUI — никаких своих сэмплеров и патчей модели.
"""
import gc
import logging
import time

import torch

from . import passport

log = logging.getLogger("Neron.H3.Fast")
TAG = "[H3 Fast]"
EVENT = "neron_h3fast.progress"

SAMPLER = "res_multistep"
SCHEDULER = "simple"
SHIFT_AUDIO = 3.0
SHIFT_DRAFT_FAST = 10.0     # Fast H3 (дистиллированная 8-шаговая модель)
SHIFT_DRAFT_TURBO = 12.0    # базовая модель + турбо-LoRA (как в Engine)
SHIFT_REFINE = 12.0

FAST_UNET_NAME = "fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors"
UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"
TAOMATE_LORA_NAME = "minimax_h3_taomate_fl2va_3step_ema_comfyui.safetensors"
TURBO_STRENGTH = 0.8

ATTN_FULL = "pytorch attention"
ATTN_FAST = "comfy kitchen attention"

DRAFT_TURBO = "базовая + турбо-LoRA / base + turbo LoRA"
UPSCALER_AUTO = "авто / auto"
UPSCALER_NONE = "без модели (растяжение) / no model (stretch)"

# Режимы для новичка: (площадь черновика, шаги черновика, шаги чистовика, сила чистовика).
# Это стартовые точки для тестов, а не замеры. «Свой» — берёт ползунки эксперта.
MODES = ["⚡ Быстро / Fast", "Баланс / Balance", "Чисто / Clean", "Свой / Custom"]
PRESETS = {
    MODES[0]: (0.5, 8, 3, 0.35),
    MODES[1]: (0.5, 8, 4, 0.5),
    MODES[2]: (0.6, 8, 6, 0.6),
}


# ---------------- служебное (как в H3 Engine) ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync(EVENT, {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


def free(reason=""):
    if reason:
        log.info("%s Память: %s", TAG, reason)
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache()
    except Exception as e:
        log.warning("%s выгрузка: %s", TAG, e)
    gc.collect()
    if torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        except Exception:
            pass


def vram_log(tag):
    if not torch.cuda.is_available():
        return
    try:
        free_b, total_b = torch.cuda.mem_get_info()
        log.info("%s %s | VRAM занято %.1f из %.1f ГБ", TAG, tag, (total_b - free_b) / 2 ** 30, total_b / 2 ** 30)
    except Exception:
        pass


def node(class_name, **kw):
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise RuntimeError(f"{TAG} нет ноды ComfyUI «{class_name}» — обнови ComfyUI / update ComfyUI")
    return getattr(cls(), cls.FUNCTION)(**kw)


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def base(name):
    return str(name).replace("\\", "/").split("/")[-1]


def find_file(kind, name):
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if base(f) == name:
                return f
    except Exception:
        pass
    return None


def upscaler_files():
    """Файлы в models/latent_upscale_models, похожие на апскейлер H3."""
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list("latent_upscale_models"))
    except Exception:
        files = []
    return [f for f in files if "minimax" in base(f).lower() or "h3" in base(f).lower()]


def lora(model, name, strength):
    import comfy.sd
    import comfy.utils
    import folder_paths
    path = folder_paths.get_full_path_or_raise("loras", name)
    try:
        data, meta = comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)
    except TypeError:
        data, meta = comfy.utils.load_torch_file(path, safe_load=True), None
    try:
        patched, _ = comfy.sd.load_lora_for_models(model, None, data, strength, 0.0, lora_metadata=meta)
    except TypeError:
        patched, _ = comfy.sd.load_lora_for_models(model, None, data, strength, 0.0)
    del data
    return patched


def is_oom(e):
    try:
        import comfy.model_management as mm
        if mm.is_oom(e):
            return True
    except Exception:
        pass
    return isinstance(e, torch.cuda.OutOfMemoryError) or "out of memory" in str(e).lower()


TILES = [(768, 64), (512, 48), (384, 32), (256, 16), (192, 8)]


def decode_video(out, vae):
    try:
        return node("VAEDecode", samples=out, vae=vae)[0], "целиком / whole frame"
    except Exception as e:
        if not is_oom(e):
            raise
        log.warning("%s раскодировка: не хватило памяти — режу плитками", TAG)
    for tile, t_size in TILES:
        free(f"раскодировка плитками {tile}")
        send(f"Раскодировка плитками {tile} / Tiled decode {tile}")
        try:
            img = node("VAEDecodeTiled", samples=out, vae=vae, tile_size=tile, overlap=tile // 4,
                       temporal_size=t_size, temporal_overlap=min(8, t_size // 2))[0]
            return img, f"плитками {tile} пикс. (не хватило видеопамяти на целиком)"
        except Exception as e:
            if not is_oom(e):
                raise
    raise RuntimeError(f"{TAG} Не хватило видеопамяти на раскодировку даже мелкими плитками. "
                       "Закрой лишние программы на видеокарте или уменьши длительность.")


def set_attention(model, fast, report, label):
    attn = ATTN_FAST if fast else ATTN_FULL
    if has_node("ModelAttentionBackend"):
        try:
            model = node("ModelAttentionBackend", model=model, attention=attn)[0]
        except Exception as e:
            log.warning("%s внимание %s недоступно (%s)", TAG, attn, e)
            attn = "по умолчанию / default"
    report.append(f"{label}: внимание {attn}")
    return model


def sample(model, positive, latent, seed, steps, denoise):
    sampler = node("KSamplerSelect", sampler_name=SAMPLER)[0]
    noise = node("RandomNoise", noise_seed=int(seed))[0]
    sigmas = node("BasicScheduler", model=model, scheduler=SCHEDULER, steps=int(steps), denoise=float(denoise))[0]
    guider = node("BasicGuider", model=model, conditioning=positive)[0]
    return node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas,
                latent_image=latent)[0]


# ---------------- латенты и кадры ----------------

def _resize(image, w, h, crop):
    import comfy.utils
    s = image[..., :3].movedim(-1, 1)
    s = comfy.utils.common_upscale(s, int(w), int(h), "lanczos", crop)
    return s.movedim(1, -1)


def keyframes(vae, first, last, w, h, frame_count):
    """Ключевые кадры под размер w×h — так же, как это делает родная нода MiniMaxH3ImageToVideo:
    первый кадр растягивается на холст (форму холста мы уже взяли по кадру), последний — обрезка по центру."""
    kfs = []
    if first is not None:
        kfs.append({"resolved_frame_index": 0, "latent": vae.encode(_resize(first[:1], w, h, "disabled"))})
    if last is not None:
        kfs.append({"resolved_frame_index": frame_count - 1, "latent": vae.encode(_resize(last[:1], w, h, "center"))})
    return kfs


def with_keyframes(cond, kfs):
    if not kfs:
        return cond
    import node_helpers
    return node_helpers.conditioning_set_values(cond, {"minimax_keyframes": kfs})


def split(latent):
    s = latent["samples"]
    if getattr(s, "is_nested", False):
        return s.tensors[0], s.tensors[1]
    return s, None


def join(latent, video, audio):
    import comfy.nested_tensor
    out = dict(latent)
    out["samples"] = comfy.nested_tensor.NestedTensor((video, audio)) if audio is not None else video
    out.pop("noise_mask", None)
    return out


def stretch(latent, w, h):
    """Запасной путь без модели-апскейлера: растянуть латент видео (звук не трогаем)."""
    video, audio = split(latent)
    size = (video.shape[2], h // 16, w // 16)
    up = torch.nn.functional.interpolate(video.float(), size=size, mode="trilinear", align_corners=False)
    return join(latent, up.to(video.dtype), audio)


def upscale(latent, w, h, choice, report):
    send("Увеличение / Upscale")
    files = upscaler_files()
    name = None
    if choice == UPSCALER_AUTO:
        name = files[0] if files else None
    elif choice and choice != UPSCALER_NONE:
        name = choice
    if name and has_node("LatentUpscaleModelLoader") and has_node("MiniMaxH3LatentUpscaleWithModel"):
        try:
            up_model = node("LatentUpscaleModelLoader", model_name=name)[0]
            out = node("MiniMaxH3LatentUpscaleWithModel", model=up_model, samples=latent, width=int(w),
                       height=int(h))[0]
            del up_model
            report.append(f"Увеличение: модель {base(name)}")
            return out
        except Exception as e:
            if is_oom(e):
                free("апскейлер: не хватило памяти")
            log.warning("%s апскейлер %s не подошёл (%s) — растягиваю латент", TAG, name, e)
            report.append(f"Увеличение: модель {base(name)} не подошла ({type(e).__name__}) — простое растяжение")
    elif choice == UPSCALER_AUTO:
        report.append("Увеличение: модели-апскейлера H3 нет в models/latent_upscale_models — простое растяжение "
                      "(чистовику нужна сила побольше)")
    else:
        report.append("Увеличение: простое растяжение латента")
    return stretch(latent, w, h)


# ---------------- главное ----------------

def generate(prompt, width, height, length, seed, models, settings, first_frame=None, last_frame=None,
             user_loras=()):
    """→ (видео [T,H,W,3], звук, последний кадр, число кадров, отчёт)."""
    t0 = time.time()
    report = []
    area, d_steps, r_steps, r_strength = settings["draft_area"], settings["draft_steps"], \
        settings["refine_steps"], settings["refine_strength"]
    dw, dh = passport.draft_size(width, height, area)
    report.append(f"Размер: черновик {dw}×{dh} → финал {width}×{height}, {length} кадров ({length / 24:.2f} с)")
    report.append(f"Черновик {d_steps} шагов · чистовик {r_steps} шагов, сила {r_strength:g}")
    free("перед стартом")
    vram_log("старт")

    # ---- 1. текст и кадры ----
    send("Текст и кадры / Text & frames")
    clip = node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    # текст кодируем ОДИН раз (энкодер 32B — самый дорогой в загрузке), картинки видит в полном размере
    positive, _ = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=prompt, width=int(width),
                       height=int(height), length=int(length), first_frame=first_frame, last_frame=last_frame)
    del clip
    free("текстовый энкодер выгружен")
    # кадры полного размера родная нода уже вложила в условия; для черновика кодируем их ещё раз в его размере
    kf_draft = keyframes(vae, first_frame, last_frame, dw, dh, length)
    del vae
    cond_full = positive
    cond_draft = with_keyframes(positive, kf_draft)
    report.append("Кадры: " + (", ".join(x for x, y in (("первый", first_frame), ("последний", last_frame))
                                         if y is not None) or "нет — честный «текст → видео»"))
    draft_latent = node("EmptyMiniMaxH3LatentAV", width=int(dw), height=int(dh), length=int(length))[0]
    free("кадры закодированы")

    # ---- 2. черновик ----
    send("Загрузка черновика / Loading draft model")
    draft_unet = models["draft_unet"]
    use_fast = draft_unet != DRAFT_TURBO
    same_unet = not use_fast          # черновик и чистовик на одной базовой модели — грузим её один раз
    t = time.time()
    base_model = node("UNETLoader", unet_name=models["unet"], weight_dtype="default")[0] if same_unet else None
    if use_fast:
        model = node("UNETLoader", unet_name=draft_unet, weight_dtype="default")[0]
        shift = SHIFT_DRAFT_FAST
        report.append(f"Черновик: {base(draft_unet)}")
    else:
        model = lora(base_model, models["turbo_lora"], TURBO_STRENGTH)
        shift = SHIFT_DRAFT_TURBO
        report.append(f"Черновик: {base(models['unet'])} + турбо-LoRA ×{TURBO_STRENGTH}")
    for name, st in user_loras:
        model = lora(model, name, float(st))
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=shift, shift_audio=SHIFT_AUDIO)[0]
    model = set_attention(model, settings["draft_fast_attention"], report, "Черновик")
    send("Черновик / Draft", 0, d_steps)
    out = sample(model, cond_draft, draft_latent, seed, d_steps, 1.0)
    report.append(f"Черновик: {time.time() - t:.0f} с")
    del model, draft_latent, cond_draft
    if not same_unet:
        free("модель черновика выгружена")
    vram_log("после черновика")
    _, draft_audio = split(out)

    # ---- 3. увеличение ----
    t = time.time()
    out = upscale(out, width, height, models["upscaler"], report)
    report.append(f"Увеличение: {time.time() - t:.0f} с")
    try:
        import comfy.model_management as mm
        mm.soft_empty_cache()
    except Exception:
        pass

    # ---- 4. чистовик ----
    send("Загрузка чистовика / Loading refine model")
    t = time.time()
    if base_model is None:
        base_model = node("UNETLoader", unet_name=models["unet"], weight_dtype="default")[0]
    rl = models["refine_lora"]
    rl_strength = TURBO_STRENGTH if base(rl) == TURBO_LORA_NAME else 1.0
    model = lora(base_model, rl, rl_strength)
    del base_model
    for name, st in user_loras:
        model = lora(model, name, float(st))
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=SHIFT_REFINE, shift_audio=SHIFT_AUDIO)[0]
    model = set_attention(model, False, report, "Чистовик")
    report.append(f"Чистовик: {base(models['unet'])} + {base(rl)} ×{rl_strength:g}")
    send("Чистовик / Refine", 0, r_steps)
    out = sample(model, cond_full, out, int(seed) + 1, r_steps, r_strength)
    report.append(f"Чистовик: {time.time() - t:.0f} с")
    del model, cond_full
    if settings["keep_draft_audio"] and draft_audio is not None:
        video_lat, _ = split(out)
        out = join(out, video_lat, draft_audio)
        report.append("Звук: из черновика (не перерисовывался)")
    free("модель чистовика выгружена")
    vram_log("после чистовика")

    # ---- 5. раскодировка ----
    send("Раскодировка видео / Decoding video")
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    video, how = decode_video(out, vae)
    report.append("Раскодировка: " + how)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = video.cpu()
    del vae
    free("видео-VAE выгружен")
    send("Раскодировка звука / Decoding audio")
    avae = node("VAELoader", vae_name=models["vae_audio"])[0]
    try:
        audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
    except Exception as e:
        if not is_oom(e):
            raise
        free("звук: повтор с чистой памятью")
        audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
    del avae, out
    free("аудио-VAE выгружен")

    n = int(video.shape[0])
    last = video[-1:].clone()
    report.append(f"Готово: {n} кадров за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    vram_log("финиш")
    return video, audio, last, n, report
