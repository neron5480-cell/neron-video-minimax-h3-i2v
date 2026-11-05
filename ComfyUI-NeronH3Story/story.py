# -*- coding: utf-8 -*-
"""Движок Neron H3 Story: длинный ролик MiniMax H3 цепочкой блоков (прототип).

Как держится цепочка (всё — родные ноды ComfyUI):
  • Блок 1 начинается с первого кадра (MiniMaxH3AddGuide, кадр 0).
  • Блок 2, 3… начинаются с ХВОСТА прошлого блока: последние 22 кадра (~0,9 с) вместе с их звуком
    прикалываются к началу нового блока (MiniMaxH3AddGuide умеет клип + звук). Модель продолжает
    и движение, и звук, а не стартует с картинки. При склейке этот перехлёст убирается из видео,
    а звук на нём плавно сводится.
  • 🔒 Сохранить внешний вид: исходная картинка идёт образцом <Picture 1> в КАЖДЫЙ блок
    (MiniMaxH3ReferenceToVideo). Даже если в конце блока лица спрятаны, следующий рисует тех же.

Память — как в Neron H3 Engine, по очереди:
  1. Текстовый энкодер кодирует промпты ВСЕХ блоков сразу → выгрузка (32B, самый тяжёлый в оперативке).
  2. Основная модель грузится один раз и живёт в оперативке до конца; между этапами она уходит из
     видеопамяти (VAE нужно место), но с диска заново не читается.
  3. Каждый блок: прикрепить хвост → сэмплер → раскодировать видео и звук → склеить.
"""
import gc
import logging
import time

import torch

log = logging.getLogger("Neron.H3.Story")
TAG = "[H3 Story]"
EVENT = "neron_h3story.progress"

SHIFT_VIDEO = 12.0
SHIFT_AUDIO = 3.0
SAMPLER = "res_multistep"
SCHEDULER = "simple"
QUALITY_STEPS = 40
MAX_STEPS = 50
TURBO_STEPS = 12
TURBO_STRENGTH = 0.8

UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
UNET_BF16 = "minimax_h3_fl2va_pruned_bf16.safetensors"
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"

ATTN_FULL = "pytorch attention"
ATTN_FAST = "comfy kitchen attention"

MODES = ["⚡ Турбо / Turbo", "Качество / Quality", "Максимум / Maximum"]
SEAMS = ["🎬 кусок + звук / clip + sound", "🖼 один кадр / single frame"]
SEAM_FRAMES = [22, 5, 39]          # сетка модели для клипа-якоря: 5, 22, 39… (17k + 5)

APPEARANCE_LINE = (" Every person, creature and object keeps exactly the same appearance as in <Picture 1>: "
                   "the same face, body, hair, clothing, colors and proportions.")

NEEDED_NODES = ["MiniMaxH3ImageToVideo", "MiniMaxH3ReferenceToVideo", "MiniMaxH3AddGuide", "MiniMaxH3SigmaShift",
                "CreateVideo"]


class FriendlyError(Exception):
    """Понятная ошибка: что случилось и что сделать — на двух языках."""


# ---------------- служебное ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync(EVENT, {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


def free(reason=""):
    """Всё, что ComfyUI держит в видеопамяти, — в оперативку, и почистить память. Объекты моделей,
    на которые у нас есть ссылки, остаются в оперативке (с диска заново не читаются)."""
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


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def node(class_name, **kw):
    """Вызов встроенной ноды ComfyUI по имени (как в Neron H3 / LTX Engine)."""
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


def check_comfy():
    missing = [n for n in NEEDED_NODES if not has_node(n)]
    if missing:
        raise FriendlyError(f"{TAG} В твоём ComfyUI нет родных нод MiniMax H3: {', '.join(missing)}. "
                            f"Цепочке нужна нода «Add Guide for MiniMax H3» — она есть в свежих версиях. "
                            f"Обнови ComfyUI и перезапусти.\n\nEN: Your ComfyUI lacks native MiniMax H3 nodes: "
                            f"{', '.join(missing)}. Update ComfyUI and restart.")


def find_file(kind, name):
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if f.replace("\\", "/").split("/")[-1] == name:
                return f
    except Exception:
        pass
    return None


def base(name):
    return str(name).replace("\\", "/").split("/")[-1]


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
    """Как в H3 Engine: целым кадром, при нехватке памяти — плитки всё мельче. Блок не теряем."""
    try:
        return node("VAEDecode", samples=out, vae=vae)[0], "целиком"
    except Exception as e:
        if not is_oom(e):
            raise
        log.warning("%s раскодировка: не хватило памяти — режу плитками", TAG)
    for tile, t_size in TILES:
        free(f"раскодировка плитками {tile}")
        try:
            img = node("VAEDecodeTiled", samples=out, vae=vae, tile_size=tile, overlap=tile // 4,
                       temporal_size=t_size, temporal_overlap=min(8, t_size // 2))[0]
            return img, f"плитками {tile}"
        except Exception as e:
            if not is_oom(e):
                raise
    raise FriendlyError(f"{TAG} Не хватило видеопамяти на раскодировку даже мелкими плитками. Закрой лишние "
                        f"программы на видеокарте или уменьши длину блока.\n\nEN: Not enough VRAM to decode even "
                        f"with small tiles. Close other GPU apps or shorten the block.")


# ---------------- звук ----------------

def audio_slice(audio, sec0, sec1):
    """Кусок звука по времени [sec0, sec1) → AUDIO."""
    wf, sr = audio["waveform"], int(audio["sample_rate"])
    a = max(0, int(round(sec0 * sr)))
    b = min(wf.shape[-1], int(round(sec1 * sr)))
    return {"waveform": wf[..., a:max(a + 1, b)].clone(), "sample_rate": sr}


def audio_join(full, new, overlap_sec):
    """Склейка: последние overlap_sec прошлого плавно переходят в первые overlap_sec нового
    (на этом отрезке оба звучат одно и то же — модель продолжила хвост)."""
    if full is None:
        return new
    sr = int(full["sample_rate"])
    a, b = full["waveform"], new["waveform"]
    if int(new["sample_rate"]) != sr:
        import comfy.audio
        b = comfy.audio.resample(b, int(new["sample_rate"]), sr)
    if b.shape[1] != a.shape[1]:                        # моно/стерео — приводим к прошлому
        b = b.mean(1, keepdim=True).expand(-1, a.shape[1], -1) if a.shape[1] > 1 else b.mean(1, keepdim=True)
    n = int(round(overlap_sec * sr))
    n = max(1, min(n, a.shape[-1], b.shape[-1]))
    fade = torch.linspace(0.0, 1.0, n, dtype=a.dtype, device=a.device)
    mix = a[..., -n:] * (1.0 - fade) + b[..., :n].to(a) * fade
    wf = torch.cat([a[..., :-n], mix, b[..., n:].to(a)], dim=-1)
    return {"waveform": wf, "sample_rate": sr}


# ---------------- главное ----------------

def with_appearance(prompt):
    return prompt if "<Picture" in prompt else prompt.rstrip() + APPEARANCE_LINE


def generate(prompts, width, height, length, mode, seed, models, first_frame=None, appearance=None,
             keep_appearance=True, seam=SEAMS[0], seam_frames=22, ref_quality="auto", fast_attention=False,
             user_loras=()):
    """→ (видео [T,H,W,3] float32, звук, последний кадр, число кадров, отчёт-строки)."""
    check_comfy()
    t0 = time.time()
    report = []
    blocks = len(prompts)
    turbo = mode == MODES[0]
    best = mode == MODES[2]
    steps = TURBO_STEPS if turbo else MAX_STEPS if best else QUALITY_STEPS
    if ref_quality == "auto":
        ref_quality = "match" if turbo else "max"
    clip_seam = seam == SEAMS[0]
    S = int(seam_frames) if clip_seam else 1
    if S >= length:
        raise FriendlyError(f"{TAG} Хвост-перехлёст ({S} кадров) не короче самого блока ({length}). Сделай блок "
                            f"длиннее.\n\nEN: The seam clip is not shorter than the block. Make blocks longer.")
    ref = appearance if appearance is not None else first_frame
    use_ref = bool(keep_appearance) and ref is not None
    report.append(f"Ролик: {blocks} блок(а) по {length} кадров ({length / 24:.2f} с), {width}×{height}")
    report.append(f"Режим: {mode.split(' / ')[0]} — {steps} шагов" + (f", турбо-LoRA ×{TURBO_STRENGTH}" if turbo else ""))
    report.append("Стык: " + (f"кусок {S} кадров ({S / 24:.2f} с) + его звук" if clip_seam else "один кадр"))
    if keep_appearance and ref is None:
        report.append("🔒 Внешний вид: картинки нет — нечего сохранять, блоки идут по тексту")
    elif use_ref:
        report.append("🔒 Внешний вид: " + ("отдельный образец" if appearance is not None else "первый кадр")
                      + " → <Picture 1> в каждом блоке")
    free("перед стартом")
    vram_log("старт")

    # ---- 1. тексты всех блоков разом ----
    send("Тексты всех блоков / Encoding all blocks")
    clip = node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    conds = []
    for k, p in enumerate(prompts):
        send(f"Текст блока {k + 1}/{blocks} / Text {k + 1}/{blocks}")
        if use_ref:
            positive, latent = node("MiniMaxH3ReferenceToVideo", clip=clip, vae=vae, prompt=with_appearance(p),
                                    width=int(width), height=int(height), length=int(length),
                                    ref_image_size=ref_quality, ref_images={"ref_image_0": ref})
        else:
            positive, latent = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=p, width=int(width),
                                    height=int(height), length=int(length))
        conds.append((positive, latent))
    del clip, vae
    free("текстовый энкодер выгружен")
    vram_log("после текста")

    # ---- 2. модель — один раз на весь ролик ----
    send("Загрузка модели / Loading model")
    unet = models["unet"]
    if best and base(unet) == UNET_NAME:
        bf16 = find_file("diffusion_models", UNET_BF16)
        if bf16:
            unet = bf16
            report.append("Максимум: взята модель bf16")
        else:
            report.append("Максимум: модели bf16 нет — работаю на int8")
    model = node("UNETLoader", unet_name=unet, weight_dtype="default")[0]
    if turbo:
        model = lora(model, models["turbo_lora"], TURBO_STRENGTH)
    for name, strength in user_loras:
        model = lora(model, name, float(strength))
        report.append(f"LoRA: {base(name)} ×{strength:g}")
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=SHIFT_VIDEO, shift_audio=SHIFT_AUDIO)[0]
    attn = ATTN_FAST if fast_attention else ATTN_FULL
    if has_node("ModelAttentionBackend"):
        try:
            model = node("ModelAttentionBackend", model=model, attention=attn)[0]
        except Exception as e:
            log.warning("%s внимание %s недоступно (%s)", TAG, attn, e)
    report.append(f"Модель: {base(unet)}")

    # ---- 3. блоки по цепочке ----
    chunks = []              # видео по блокам без перехлёста, float16 на процессоре (экономим оперативку)
    full_audio = None
    prev_video = prev_audio = None
    last = None
    for k in range(blocks):
        tb = time.time()
        label = f"Блок {k + 1}/{blocks}"
        positive, latent = conds[k]
        conds[k] = None
        # прикрепить начало блока
        if k == 0 and first_frame is not None:
            send(f"{label}: первый кадр / first frame")
            vae = node("VAELoader", vae_name=models["vae_video"])[0]
            positive = node("MiniMaxH3AddGuide", positive=positive, latent=latent, frame_idx=0, vae=vae,
                            image=first_frame[:1])[0]
            del vae
        elif k > 0:
            send(f"{label}: хвост прошлого блока / previous tail")
            vae = node("VAELoader", vae_name=models["vae_video"])[0]
            kw = {"positive": positive, "latent": latent, "frame_idx": 0, "vae": vae,
                  "image": prev_video[-S:].float()}
            if clip_seam and prev_audio is not None:
                n_prev = prev_video.shape[0]
                kw["audio"] = audio_slice(prev_audio, (n_prev - S) / 24.0, n_prev / 24.0)
                kw["audio_vae"] = node("VAELoader", vae_name=models["vae_audio"])[0]
            positive = node("MiniMaxH3AddGuide", **kw)[0]
            del vae, kw
        free(f"{label}: начало прикреплено")

        send(f"{label}: генерация / generating", 0, steps)
        sampler = node("KSamplerSelect", sampler_name=SAMPLER)[0]
        noise = node("RandomNoise", noise_seed=int(seed) + k)[0]
        sigmas = node("BasicScheduler", model=model, scheduler=SCHEDULER, steps=int(steps), denoise=1.0)[0]
        guider = node("BasicGuider", model=model, conditioning=positive)[0]
        out = node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas,
                   latent_image=latent)[0]
        del guider, sigmas, positive, latent, noise, sampler
        free(f"{label}: модель в оперативку")

        send(f"{label}: раскодировка / decoding")
        vae = node("VAELoader", vae_name=models["vae_video"])[0]
        video, how = decode_video(out, vae)
        if video.dim() == 5:
            video = video.reshape(-1, *video.shape[-3:])
        video = video.cpu()
        del vae
        free(f"{label}: видео-VAE выгружен")
        avae = node("VAELoader", vae_name=models["vae_audio"])[0]
        try:
            audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
        except Exception as e:
            if not is_oom(e):
                raise
            free("звук: повтор с чистой памятью")
            audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
        audio = {"waveform": audio["waveform"].cpu(), "sample_rate": int(audio["sample_rate"])}
        del avae, out
        free(f"{label}: аудио-VAE выгружен")

        # склейка: у блоков 2+ первые S кадров повторяют хвост прошлого — в ролик не идут
        if k == 0:
            chunks.append(video.half())
            full_audio = audio
        else:
            chunks.append(video[S:].half())
            full_audio = audio_join(full_audio, audio, S / 24.0)
        prev_video, prev_audio = video, audio
        last = video[-1:].clone()
        report.append(f"{label}: {time.time() - tb:.0f} с, раскодировка {how}")

    del model
    free("всё выгружено")
    send("Склейка / Joining")
    video = torch.cat([c.float() for c in chunks], dim=0)
    del chunks
    n = int(video.shape[0])
    report.append(f"Готово: {n} кадров ({n / 24:.1f} с) за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    vram_log("финиш")
    return video, full_audio, last, n, report
