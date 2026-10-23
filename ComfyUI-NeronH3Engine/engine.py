# -*- coding: utf-8 -*-
"""Движок MiniMax H3: максимум качества в паспорте модели, память — строго по очереди.

Очередь (в памяти — только то, что нужно этому этапу):
  1. Текст и образцы: текстовый энкодер (+ видео-VAE / аудио-VAE, если есть образцы) → условия.
     Энкодер (Qwen3-VL-32B) — самый тяжёлый в оперативке: выгружаем полностью сразу после.
  2. Генерация: основная модель + LoRA → один проход сэмплера → выгружаем.
  3. Раскодировка: видео-VAE → кадры → выгружаем; аудио-VAE → звук → выгружаем.

Качество (по документации Comfy и исходнику модели):
  • сдвиг шума 12 / звук 3 — на нём обучены модель и турбо-LoRA;
  • один проход res_multistep + simple (деление расписания сбрасывает историю сэмплера);
  • Качество — 40 шагов (мелкая деталь растёт примерно до 50), Турбо — 12 шагов при силе LoRA 0.8
    (больше шагов и сила ниже 1 возвращают турбо к качеству полной модели; звуку нужно 12+);
  • полноточное внимание PyTorch (INT8-внимание даёт морфинг в конце и кривой текст);
  • раскодировка целиком — ComfyUI сам перейдёт на плитки, только если не хватит памяти;
  • нет образцов — честный «текст → видео» (нода Image to Video без кадров), без подставных картинок.
"""
import gc
import logging
import time

import torch

log = logging.getLogger("Neron.H3.Engine")

SHIFT_VIDEO = 12.0
SHIFT_AUDIO = 3.0
SAMPLER = "res_multistep"
SCHEDULER = "simple"
QUALITY_STEPS = 40
MAX_STEPS = 50              # документация: мелкая деталь растёт примерно до 50 шагов
TURBO_STEPS = 12
TURBO_STRENGTH = 0.8

UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
UNET_BF16 = "minimax_h3_fl2va_pruned_bf16.safetensors"      # без сжатия весов — для «Максимума»
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"

ATTN_FULL = "pytorch attention"
ATTN_FAST = "comfy kitchen attention"


# ---------------- служебное ----------------

def send(stage, i=0, total=0):
    """Этап и прогресс — в интерфейс (часы ноды)."""
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("neron_h3.progress", {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


def free(reason=""):
    """Выгрузить всё, что ComfyUI держит, и почистить память — между этапами."""
    if reason:
        log.info("[H3 Engine] Память: %s", reason)
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache()
    except Exception as e:
        log.warning("[H3 Engine] выгрузка: %s", e)
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
        log.info("[H3 Engine] %s | VRAM занято %.1f из %.1f ГБ", tag, (total_b - free_b) / 2 ** 30, total_b / 2 ** 30)
    except Exception:
        pass


def node(class_name, **kw):
    """Вызов встроенной ноды ComfyUI по имени (тот же путь, что проверен в нашем прошлом генераторе)."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise RuntimeError(f"[H3 Engine] нет ноды ComfyUI «{class_name}» — обнови ComfyUI / update ComfyUI")
    return getattr(cls(), cls.FUNCTION)(**kw)


def _find_file(kind, name):
    """Имя файла модели в списке ComfyUI (вдруг лежит в подпапке) или None."""
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if f.replace("\\", "/").split("/")[-1] == name:
                return f
    except Exception:
        pass
    return None


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def _lora(model, name, strength):
    """LoRA только на модель. Файл не кэшируем: после прогона он не должен висеть в оперативке."""
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


# плитки на случай, если не хватило даже штатного запасного плана ComfyUI: (сторона, по времени)
TILES = [(768, 64), (512, 48), (384, 32), (256, 16), (192, 8)]


def decode_video(out, vae):
    """Видео целиком (декодер видит кадр полностью — так качественнее). ComfyUI сам переходит на плитки
    при нехватке видеопамяти; если и это не влезло — вторая линия: плитки всё мельче, с чисткой памяти
    между попытками. Генерацию после 20 минут работы на раскодировке не теряем."""
    try:
        return node("VAEDecode", samples=out, vae=vae)[0], "целиком / whole frame"
    except Exception as e:
        if not is_oom(e):
            raise
        log.warning("[H3 Engine] раскодировка: не хватило памяти даже штатному запасному плану — режу плитками")
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
            log.warning("[H3 Engine] плитка %s не влезла, пробую меньше", tile)
    raise RuntimeError("[H3 Engine] Не хватило видеопамяти на раскодировку даже мелкими плитками. "
                       "Закрой лишние программы на видеокарте или уменьши длительность.")


# ---------------- главное ----------------

MODES = ["⚡ Турбо / Turbo", "Качество / Quality", "Максимум / Maximum"]


def generate(prompt, width, height, length, mode, seed, models, user_loras=(),
             ref_images=(), ref_video=None, ref_video_audio=None, ref_audio=None,
             ref_quality="auto", fast_attention=False):
    """→ (видео [T,H,W,3], звук, последний кадр, число кадров, отчёт-строки)."""
    t0 = time.time()
    report = []
    turbo = mode == MODES[0]
    best = mode == MODES[2]
    steps = TURBO_STEPS if turbo else MAX_STEPS if best else QUALITY_STEPS
    named = [(f"ref_image_{i}", img) for i, img in enumerate(ref_images) if img is not None]
    refs = [img for _, img in named]
    has_refs = bool(refs) or ref_video is not None or ref_audio is not None
    if ref_quality == "auto":
        ref_quality = "match" if turbo else "max"
    report.append(f"Режим: {mode.split(' / ')[0]} — {steps} шагов, сдвиг {SHIFT_VIDEO:g}/{SHIFT_AUDIO:g}"
                  + (f", турбо-LoRA ×{TURBO_STRENGTH}" if turbo else ""))
    report.append(f"Размер {width}×{height}, {length} кадров ({length / 24:.2f} с)")
    free("перед стартом")
    vram_log("старт")

    # ---- 1. текст и образцы ----
    send("Текст и образцы / Text & references")
    clip = node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    if has_refs:
        params = {"clip": clip, "vae": vae, "prompt": prompt, "width": int(width), "height": int(height),
                  "length": int(length), "ref_image_size": ref_quality}
        tags = []
        if refs:
            params["ref_images"] = {f"ref_image_{i}": img for i, img in enumerate(refs)}
            tags += [f"{slot} → <Picture {i + 1}>" for i, (slot, _) in enumerate(named)]
        if ref_video is not None:
            params["ref_videos"] = {"ref_video_0": ref_video}
            tags.append("ref_video → <Video 1>")
            if ref_video_audio is not None:
                params["ref_video_audios"] = {"ref_video_audio_0": ref_video_audio}
        if ref_audio is not None:
            params["ref_audios"] = {"ref_audio_0": ref_audio}
            tags.append("ref_audio → <Audio …>")
        audio_vae = None
        if ref_audio is not None or ref_video_audio is not None:
            audio_vae = node("VAELoader", vae_name=models["vae_audio"])[0]
            params["audio_vae"] = audio_vae
        positive, latent = node("MiniMaxH3ReferenceToVideo", **params)
        report.append(f"Образцы ({'полное качество' if ref_quality == 'max' else 'под размер кадра'}): "
                      + ", ".join(tags))
        del audio_vae
    else:
        positive, latent = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=prompt, width=int(width),
                                height=int(height), length=int(length))
        report.append("Образцов нет — честный «текст → видео»")
    del clip, vae
    free("текстовый энкодер выгружен")
    vram_log("после текста")

    # ---- 2. генерация ----
    send("Загрузка модели / Loading model")
    unet = models["unet"]
    if best and unet.replace("\\", "/").split("/")[-1] == UNET_NAME:
        bf16 = _find_file("diffusion_models", UNET_BF16)
        if bf16:
            unet = bf16
            report.append("Максимум: взята модель без сжатия весов (bf16) — медленнее, точнее")
        else:
            report.append("Максимум: модели bf16 нет — работаю на выбранной (int8). Для максимума скачай "
                          + UNET_BF16)
    report.append(f"Модель: {unet}")
    model = node("UNETLoader", unet_name=unet, weight_dtype="default")[0]
    if turbo:
        model = _lora(model, models["turbo_lora"], TURBO_STRENGTH)
    for name, strength in user_loras:
        model = _lora(model, name, float(strength))
        report.append(f"LoRA: {name} ×{strength:g}")
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=SHIFT_VIDEO, shift_audio=SHIFT_AUDIO)[0]
    attn = ATTN_FAST if fast_attention else ATTN_FULL
    if has_node("ModelAttentionBackend"):
        try:
            model = node("ModelAttentionBackend", model=model, attention=attn)[0]
        except Exception as e:                       # INT8-внимание есть не на всех картах
            log.warning("[H3 Engine] внимание %s недоступно (%s) — оставляю по умолчанию", attn, e)
            attn = "по умолчанию / default"
    report.append(f"Внимание: {attn}")
    send("Генерация / Generating", 0, steps)
    sampler = node("KSamplerSelect", sampler_name=SAMPLER)[0]
    noise = node("RandomNoise", noise_seed=int(seed))[0]
    sigmas = node("BasicScheduler", model=model, scheduler=SCHEDULER, steps=int(steps), denoise=1.0)[0]
    guider = node("BasicGuider", model=model, conditioning=positive)[0]
    t_gen = time.time()
    out = node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas,
               latent_image=latent)[0]
    report.append(f"Генерация: {time.time() - t_gen:.0f} с")
    del model, guider, sigmas, positive, latent, noise, sampler
    free("основная модель выгружена")
    vram_log("после генерации")

    # ---- 3. раскодировка ----
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
        free("звук: не хватило памяти — повтор с чистой памятью")
        audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
    del avae, out
    free("аудио-VAE выгружен")

    n = int(video.shape[0])
    last = video[-1:].clone()
    report.append(f"Готово: {n} кадров за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    vram_log("финиш")
    return video, audio, last, n, report
