# -*- coding: utf-8 -*-
"""Движок LTX 2.5: схема из процесса Neron «LTX 2.5 Pure 2K/3K», собранная в одну ноду.

Порядок (в памяти только то, что нужно этапу):
  1. Подготовка кадров: по желанию апскейл модели входа + резкость (как в процессе Neron).
  2. Текст: энкодер Gemma → условия → энкодер выгружается.
  3. Заготовка: пустое видео 8·n+1 кадров + звук; первый кадр вписывается в начало,
     промежуточные и последний — ключевыми кадрами (LTXVAddGuide) на свои места.
  4. Генерация, проход 1: 8 шагов distilled (CFG 1, euler_ancestral, сигмы Lightricks).
  5. Качество, проход 2: первый кадр вписывается заново на полной силе и ролик дочищается
     (сигмы второго этапа Lightricks 0.85 → 0) — так в процессе Neron.
  6. Раскодировка плитками 512 (если не хватит памяти — плитки мельче), звук отдельно.
  7. Резкость выхода + плавность ×2 (RIFE, встроенная нода ComfyUI) → готовое видео со звуком.

Все шаги — встроенные ноды ComfyUI, без чужих паков.
"""
import gc
import logging
import time

import torch

from . import sizing

log = logging.getLogger("Neron.LTX.Engine")
TAG = "[LTX Engine]"

# Сигмы быстрой (distilled) LTX 2.5 — из официальных шаблонов Lightricks (8 шагов, затем 3 шага дочистки).
SIGMAS_PASS1 = "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
SIGMAS_PASS2 = "0.85, 0.7250, 0.4219, 0.0"
SAMPLER = "euler_ancestral"
CFG = 1.0                    # distilled работает при CFG 1 (карточка модели)
CLIP_TYPE = "ltxv"

UNET_NAME = "ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors"
CLIP_NAME = "gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors"
VAE_VIDEO_NAME = "ltx-2.5-video-vae-bf16.safetensors"
VAE_AUDIO_NAME = "ltx-2.5-audio-vae-bf16.safetensors"
INTERP_NAME = "rife_v4.26.safetensors"
UPSCALE_HINT = "swin2sr"     # апскейл входа из процесса Neron — подхватывается сам, если лежит в upscale_models

MODES = ["Качество / Quality", "Быстро / Fast"]

REQUIRED_NODES = ["EmptyLTXVLatentVideo", "LTXVImgToVideoInplace", "LTXVAddGuide", "LTXVCropGuides",
                  "LTXVConditioning", "LTXVEmptyLatentAudio", "LTXVConcatAVLatent", "LTXVSeparateAVLatent",
                  "LTXVAudioVAEDecode", "ManualSigmas", "CFGGuider", "KSamplerSelect", "RandomNoise",
                  "SamplerCustomAdvanced", "CLIPLoader", "CLIPTextEncode", "UNETLoader", "VAELoader",
                  "VAEDecodeTiled", "CreateVideo"]


class FriendlyError(RuntimeError):
    """Ошибка, которую человек поймёт: что случилось и что сделать, на двух языках."""


# ---------------- служебное ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("neron_ltx.progress", {"stage": stage, "i": int(i), "total": int(total)})
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


def node(class_name, **kw):
    """Вызов встроенной ноды ComfyUI по имени (как в Neron H3 Engine)."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise FriendlyError(f"{TAG} В твоём ComfyUI нет встроенной ноды «{class_name}». Обнови ComfyUI до свежей "
                            f"версии и перезапусти.\n\nEN: Your ComfyUI has no built-in node «{class_name}». "
                            f"Update ComfyUI and restart.")
    r = getattr(cls(), cls.FUNCTION)(**kw)
    if hasattr(r, "args") and not isinstance(r, (tuple, list)):     # новые ноды ComfyUI отдают NodeOutput
        r = tuple(r.args)
    elif isinstance(r, dict) and "result" in r:
        r = tuple(r["result"])
    return r


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def missing_core_nodes():
    return [n for n in REQUIRED_NODES if not has_node(n)]


def find_file(kind, name):
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if f.replace("\\", "/").split("/")[-1] == name or f == name:
                return f
    except Exception:
        pass
    return None


def is_oom(e):
    try:
        import comfy.model_management as mm
        if mm.is_oom(e):
            return True
    except Exception:
        pass
    return isinstance(e, torch.cuda.OutOfMemoryError) or "out of memory" in str(e).lower()


def looks_like_wrong_model(e):
    s = str(e).lower()
    return any(k in s for k in ("size mismatch", "error(s) in loading state_dict", "unexpected key",
                                "missing key", "shape", "could not detect model type"))


def system_memory():
    vram = ram = None
    if torch.cuda.is_available():
        try:
            vram = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
        except Exception:
            pass
    try:
        import psutil
        ram = psutil.virtual_memory().total / 1024 ** 3
    except Exception:
        pass
    return vram, ram


def _lora(model, name, strength):
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


def sharpen(images, strength, chunk=16):
    """Резкость как GLSL-шейдер в процессе Neron: центр·4 − соседи, добавить с силой strength."""
    if not strength or strength <= 0 or images is None:
        return images
    out = []
    for s in range(0, images.shape[0], chunk):
        x = images[s:s + chunk].movedim(-1, 1)                    # B,C,H,W
        p = torch.nn.functional.pad(x, (1, 1, 1, 1), mode="replicate")
        c = p[:, :, 1:-1, 1:-1]
        edges = c * 4 - p[:, :, :-2, 1:-1] - p[:, :, 2:, 1:-1] - p[:, :, 1:-1, :-2] - p[:, :, 1:-1, 2:]
        out.append((c + edges * float(strength)).clamp(0.0, 1.0).movedim(1, -1))
    return torch.cat(out, dim=0)


# плитки на случай нехватки памяти при раскодировке: (сторона, кадров за раз, перекрытие кадров)
TILES = [(512, 64, 8), (384, 32, 8), (256, 16, 4), (192, 8, 4)]


def decode_video(video_latent, vae):
    """Плитками 512 (как в процессе Neron и шаблоне Lightricks); не влезло — мельче, с чисткой памяти."""
    for k, (tile, t_size, t_over) in enumerate(TILES):
        if k:
            free(f"раскодировка плитками {tile}")
            send(f"Раскодировка плитками {tile} / Tiled decode {tile}")
        try:
            img = node("VAEDecodeTiled", samples=video_latent, vae=vae, tile_size=tile, overlap=tile // 8,
                       temporal_size=t_size, temporal_overlap=t_over)[0]
            return img, f"плитками {tile}"
        except Exception as e:
            if not is_oom(e):
                raise
            log.warning("%s плитка %s не влезла, пробую меньше", TAG, tile)
    raise FriendlyError(f"{TAG} Не хватило видеопамяти даже на раскодировку мелкими плитками. Закрой лишние программы "
                        f"на видеокарте, выбери ступень видеокарты пониже или уменьши длительность.\n\nEN: Not enough "
                        f"VRAM even for small-tile decoding. Close other GPU apps, pick a lower GPU tier or shorten "
                        f"the clip.")


def first_frame(img):
    if img is None:
        return None
    return img[:1] if img.dim() == 4 else img.unsqueeze(0)


# ---------------- главное ----------------

def generate(prompt, camera_prompt, frames, s, models, user_loras=()):
    """frames: {"first","mid1","mid2","last"} → IMAGE или None.
    s: настройки (dict). → (video, audio, кадры, fps, отчёт)."""
    t0 = time.time()
    report, notes = [], []
    quality = s["mode"] != MODES[1]
    fps = float(s["fps"])

    miss = missing_core_nodes()
    if miss:
        raise FriendlyError(f"{TAG} Твой ComfyUI слишком старый для LTX 2.5 — нет встроенных нод: {', '.join(miss)}. "
                            f"Обнови ComfyUI и перезапусти.\n\nEN: Your ComfyUI is too old for LTX 2.5 (missing: "
                            f"{', '.join(miss)}). Update ComfyUI and restart.")

    # --- промпт: основной + камера (полноценный контроль камеры — следующим шагом) ---
    text = (prompt or "").strip()
    cam = (camera_prompt or "").strip()
    if cam:
        text = (text.rstrip(". ") + ". " + cam) if text else cam
        report.append("Камера: фраза из входа camera_prompt добавлена в конец промпта")

    # --- кадры, форма и размер ---
    imgs = {k: first_frame(v) for k, v in frames.items()}
    shape_src = next((imgs[k] for k in ("first", "mid1", "mid2", "last") if imgs[k] is not None), None)
    if shape_src is not None:
        aspect = sizing.aspect_of(shape_src.shape)
    else:
        aspect = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1.0}.get(s["t2v_aspect"].split(" ")[0], 16 / 9)
    for k in ("mid1", "mid2", "last"):
        if imgs[k] is not None and shape_src is not None and imgs[k] is not shape_src:
            if sizing.aspect_mismatch(sizing.aspect_of(imgs[k].shape), aspect):
                notes.append(f"⚠ Кадр «{k}» другой формы, чем первый — он будет подогнан (обрезан по центру). "
                             f"EN: frame «{k}» has a different shape and will be center-cropped.")
    vram, ram = system_memory()
    if s["megapixels"] and s["megapixels"] > 0:
        mp, tier_note = float(s["megapixels"]), f"площадь задана вручную: {s['megapixels']:.2f} Мп"
    else:
        mp, label, tier_note = sizing.megapixels_for(s["gpu"], vram, ram)
    if tier_note:
        report.append("Видеокарта: " + tier_note)
    w, h = sizing.size_for(aspect, mp)
    n = sizing.frames_for(s["seconds"], fps)
    report.append(f"Размер {w}×{h}, {n} кадров ({(n - 1) / fps:.2f} с при {fps:g} к/с)")
    mids = sizing.guide_frames(n, fps, (s["mid1_sec"], s["mid2_sec"]),
                               (imgs["mid1"] is not None, imgs["mid2"] is not None))
    free("перед стартом")

    # --- 1. подготовка кадров ---
    up_name = s.get("input_upscale")
    if up_name and any(v is not None for v in imgs.values()):
        send("Подготовка кадров / Preparing frames")
        try:
            up = node("UpscaleModelLoader", model_name=up_name)[0]
            for k in imgs:
                if imgs[k] is not None:
                    imgs[k] = node("ImageUpscaleWithModel", upscale_model=up, image=imgs[k])[0]
            del up
            report.append(f"Вход: апскейл {up_name}")
        except FriendlyError:
            raise
        except Exception as e:
            if not is_oom(e):
                raise
            notes.append("⚠ На апскейл входа не хватило видеопамяти — кадры пошли без него. "
                         "EN: input upscale skipped (out of VRAM).")
        free("апскейл входа выгружен")
    if up_name and s["input_sharpen"] > 0:            # резкость — в паре с апскейлом, как в процессе Neron
        for k in imgs:
            if imgs[k] is not None:
                imgs[k] = sharpen(imgs[k], s["input_sharpen"])
    if s["img_compression"] > 0 and has_node("LTXVPreprocess"):
        for k in imgs:
            if imgs[k] is not None:
                imgs[k] = node("LTXVPreprocess", image=imgs[k], img_compression=int(s["img_compression"]))[0]

    # --- 2. текст ---
    send("Текст / Text")
    clip = node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    pos = node("CLIPTextEncode", clip=clip, text=text)[0]
    neg = node("CLIPTextEncode", clip=clip, text="")[0]     # при CFG 1 негатив не участвует (математика CFG)
    pos, neg = node("LTXVConditioning", positive=pos, negative=neg, frame_rate=fps)
    del clip
    free("текстовый энкодер выгружен")

    # --- 3. заготовка ---
    send("Заготовка / Latent")
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    avae = node("VAELoader", vae_name=models["vae_audio"])[0]
    lat = node("EmptyLTXVLatentVideo", width=w, height=h, length=n, batch_size=1)[0]
    if imgs["first"] is not None:
        lat = node("LTXVImgToVideoInplace", vae=vae, image=imgs["first"], latent=lat,
                   strength=float(s["first_strength"]), bypass=False)[0]
        report.append(f"Первый кадр: сила {s['first_strength']:g}")
    else:
        report.append("Первого кадра нет — «текст → видео»")
    for key, idx, strength in (("mid1", mids[0], s["mid_strength"]), ("mid2", mids[1], s["mid_strength"]),
                               ("last", -1, s["last_strength"])):
        if imgs[key] is None or idx is None:
            continue
        pos, neg, lat = node("LTXVAddGuide", positive=pos, negative=neg, vae=vae, latent=lat, image=imgs[key],
                             frame_idx=int(idx), strength=float(strength))
        where = "последний кадр" if idx == -1 else f"кадр {idx} (~{idx / fps:.1f} с)"
        report.append(f"Ключевой кадр «{key}»: {where}, сила {strength:g}")
    alat = node("LTXVEmptyLatentAudio", frames_number=n, frame_rate=fps, batch_size=1, audio_vae=avae)[0]
    av = node("LTXVConcatAVLatent", video_latent=lat, audio_latent=alat)[0]
    del lat, alat

    # --- 4–5. генерация ---
    send("Загрузка модели / Loading model")
    try:
        model = node("UNETLoader", unet_name=models["unet"], weight_dtype="default")[0]
    except FriendlyError:
        raise
    except Exception as e:
        if looks_like_wrong_model(e):
            raise FriendlyError(f"{TAG} Модель «{models['unet']}» не похожа на LTX 2.5. Выбери в эксперте файл "
                                f"LTX 2.5 или скачай пакет кнопкой 📥.\n\nEN: «{models['unet']}» does not look like "
                                f"LTX 2.5. Pick an LTX 2.5 file in expert mode or download the pack with 📥.") from e
        raise
    for name, strength in user_loras:
        model = _lora(model, name, float(strength))
        report.append(f"LoRA: {name} ×{strength:g}")
    sampler = node("KSamplerSelect", sampler_name=SAMPLER)[0]
    guider = node("CFGGuider", model=model, positive=pos, negative=neg, cfg=CFG)[0]
    seed = int(s["seed"])

    def run(latent, sigmas_txt, sd, label, steps):
        send(label, 0, steps)
        sig = node("ManualSigmas", sigmas=sigmas_txt)[0]
        noise = node("RandomNoise", noise_seed=sd)[0]
        try:
            return node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sig,
                        latent_image=latent)[0]
        except Exception as e:
            if is_oom(e):
                raise FriendlyError(f"{TAG} Не хватило видеопамяти на генерацию {w}×{h}, {n} кадров. Выбери ступень "
                                    f"видеокарты пониже или уменьши длительность.\n\nEN: Out of VRAM generating "
                                    f"{w}×{h}, {n} frames. Pick a lower GPU tier or shorten the clip.") from e
            if looks_like_wrong_model(e):
                raise FriendlyError(f"{TAG} Модель или LoRA не подходит к LTX 2.5 (не сходятся размеры весов). "
                                    f"Проверь файлы в эксперте.\n\nEN: The model or a LoRA does not match LTX 2.5. "
                                    f"Check the files in expert mode.") from e
            raise

    t_gen = time.time()
    out = run(av, SIGMAS_PASS1, seed, "Генерация / Generating", 8)
    report.append(f"Проход 1: 8 шагов, {time.time() - t_gen:.0f} с")
    if quality:
        t2 = time.time()
        v_lat, a_lat = node("LTXVSeparateAVLatent", av_latent=out)
        if imgs["first"] is not None:
            v_lat = node("LTXVImgToVideoInplace", vae=vae, image=imgs["first"], latent=v_lat, strength=1.0,
                         bypass=False)[0]
        av2 = node("LTXVConcatAVLatent", video_latent=v_lat, audio_latent=a_lat)[0]
        out = run(av2, SIGMAS_PASS2, seed + 1, "Дочистка / Refining", 3)
        report.append(f"Проход 2 (дочистка): 3 шага, {time.time() - t2:.0f} с")
        del v_lat, a_lat, av2
    del model, guider, sampler, av
    free("основная модель выгружена")

    # --- 6. раскодировка ---
    v_lat, a_lat = node("LTXVSeparateAVLatent", av_latent=out)
    pos, neg, v_lat = node("LTXVCropGuides", positive=pos, negative=neg, latent=v_lat)
    send("Раскодировка видео / Decoding video")
    video, how = decode_video(v_lat, vae)
    report.append("Раскодировка: " + how)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = video.cpu()
    del vae, v_lat
    free("видео-VAE выгружен")
    send("Раскодировка звука / Decoding audio")
    audio = node("LTXVAudioVAEDecode", samples=a_lat, audio_vae=avae)[0]
    del avae, a_lat, out
    free("аудио-VAE выгружен")

    # --- 7. резкость и плавность ---
    if s["output_sharpen"] > 0:
        video = sharpen(video, s["output_sharpen"])
    out_fps = fps
    if s["smooth"]:
        interp = models.get("interp")
        if interp and has_node("FrameInterpolate") and has_node("FrameInterpolationModelLoader"):
            send("Плавность ×2 / Smoothing ×2")
            try:
                im = node("FrameInterpolationModelLoader", model_name=interp)[0]
                video = node("FrameInterpolate", interp_model=im, images=video, multiplier=2)[0].cpu()
                out_fps = fps * 2
                report.append(f"Плавность: ×2 → {out_fps:g} к/с ({interp})")
                del im
            except Exception as e:
                if not is_oom(e):
                    raise
                notes.append("⚠ На плавность не хватило памяти — видео без неё. EN: smoothing skipped (out of memory).")
            free("плавность выгружена")
        else:
            notes.append("⚠ Плавность выключена: нет модели RIFE (скачай пакет 📥) или ComfyUI старый. "
                         "EN: smoothing off — no RIFE model or old ComfyUI.")

    send("Сборка видео / Building video")
    vid = node("CreateVideo", images=video, fps=float(out_fps), audio=audio)[0]
    report.append(f"Готово: {int(video.shape[0])} кадров, {out_fps:g} к/с, за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    return vid, audio, video, float(out_fps), notes + report
