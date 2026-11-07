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
# 🚀 Быстро — 4-шаговая LoRA lightx2v. Настройки авторов (euler, сдвиг 6, 4 шага) на живом прогоне дали грязную
# картинку — берём то, что проверено в Турбо: res_multistep, сдвиг 12/3, и по умолчанию 6 шагов (4…10 — в эксперте).
FAST_STEPS = [4, 6, 8, 10]
FAST_DEFAULT_STEPS = 6
FAST_STRENGTH = 1.0
FAST_SAMPLER = SAMPLER
FAST_SHIFT_VIDEO = SHIFT_VIDEO
FAST_SHIFT_AUDIO = SHIFT_AUDIO
REF_AUDIO_MAX_SEC = 15.0

UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
UNET_BF16 = "minimax_h3_fl2va_pruned_bf16.safetensors"
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"
FAST_LORA_NAME = "minimax_h3_fl2v_turbo_4step_v1.3_768p_comfyui_bf16.safetensors"

ATTN_FULL = "pytorch attention"
ATTN_FAST = "comfy kitchen attention"

MODES = ["🚀 Быстро / Fast", "⚡ Турбо / Turbo", "Качество / Quality", "Максимум / Maximum"]
FAST, TURBO, QUALITY, BEST = MODES
SEAMS = ["🎬 кусок + звук / clip + sound", "🖼 один кадр / single frame"]
SEAM_FRAMES = [22, 5, 39]          # сетка модели для клипа-якоря: 5, 22, 39… (17k + 5)

APPEARANCE_LINE = (" <Picture 1> is only an identity reference for the people, creatures and objects: take from it "
                   "their faces, hair, bodies, clothing and colors, nothing else. Ignore the background, framing, "
                   "camera angle and poses of <Picture 1>.")
# H3 умеет склейки (смену плана): без этой строки блок может «срезать» на новый план по образцу.
FIRST_LINE = "A single continuous shot with no cuts and no scene changes."
NEXT_LINE = ("A single continuous shot with no cuts and no scene changes: it continues directly from the opening "
             "frames, in the same place, with the same camera position and framing, and the action flows on from "
             "them.")

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


def with_audio_refs(prompt, n):
    """Звуковые образцы без упоминания в промпте модель может не заметить — называем их сами."""
    tags = ", ".join(f"<Audio {i + 1}>" for i in range(n))
    return (prompt.rstrip() + f" The sound of this video follows {tags}: keep the same voice, music and ambience "
            f"as in {'this reference' if n == 1 else 'these references'}.")


def with_continuity(prompt, k):
    """Первая строка: один непрерывный кадр; для блоков 2+ — продолжение прикреплённого хвоста."""
    line = FIRST_LINE if k == 0 else NEXT_LINE
    return line + " " + prompt.lstrip()


def block_refs_prompt(prompt, start_no, who, mids):
    """Ссылки на картинки блока: что не упомянуто в промпте как <Picture N> — дописываем одной фразой.
    who — образец «кто / где» (первый кадр блоков 2+), mids — навигаторы «куда идём»."""
    lines, n = [], start_no
    if who is not None:
        if f"<Picture {n}>" not in prompt:
            lines.append(f"Also use <Picture {n}> as a reference for who and what appears in this part.")
        n += 1
    for _ in mids:
        if f"<Picture {n}>" not in prompt:
            lines.append(f"The action moves toward the place or object shown in <Picture {n}>.")
        n += 1
    return (prompt.rstrip() + " " + " ".join(lines)) if lines else prompt


def generate(prompts, width, height, length, mode, seed, models, first_frame=None, appearance=None,
             keep_appearance=True, seam=SEAMS[0], seam_frames=22, ref_quality="auto", fast_attention=False,
             global_loras=(), block_loras=None, total_frames=None, block_images=None, fast_steps=6, ref_audios=()):
    """→ (видео [T,H,W,3] float32, звук, последний кадр, число кадров, отчёт-строки).
    global_loras — [(имя, сила)] на весь ролик; block_loras[k] — [(имя, сила)] только для блока k;
    total_frames — обрезать готовый ролик ровно до этой длины;
    block_images[k] — {"who": образец «кто/где» (только блоки 2+), "mid": [навигаторы], "last": кадр конца};
    ref_audios — до 3 звуковых образцов (голос, музыка, фон) → <Audio 1..3> в КАЖДЫЙ блок."""
    check_comfy()
    t0 = time.time()
    report = []
    blocks = len(prompts)
    fast = mode == FAST
    turbo = mode == TURBO
    best = mode == BEST
    fast_steps = int(fast_steps) if int(fast_steps or 0) in FAST_STEPS else FAST_DEFAULT_STEPS
    steps = fast_steps if fast else TURBO_STEPS if turbo else MAX_STEPS if best else QUALITY_STEPS
    if ref_quality == "auto":
        ref_quality = "match" if (turbo or fast) else "max"
    auds = []
    for a in ref_audios or ():
        if a is None:
            continue
        sr = int(a["sample_rate"])
        w = a["waveform"][:1]
        if w.shape[-1] > REF_AUDIO_MAX_SEC * sr:
            w = w[..., :int(REF_AUDIO_MAX_SEC * sr)]
            report.append(f"Звуковой образец {len(auds) + 1}: длиннее {REF_AUDIO_MAX_SEC:g} с — взято начало")
        auds.append({"waveform": w, "sample_rate": sr})
    clip_seam = seam == SEAMS[0]
    S = int(seam_frames) if clip_seam else 1
    if S >= length:
        raise FriendlyError(f"{TAG} Хвост-перехлёст ({S} кадров) не короче самого блока ({length}). Сделай блок "
                            f"длиннее.\n\nEN: The seam clip is not shorter than the block. Make blocks longer.")
    ref = appearance if appearance is not None else first_frame
    use_ref = bool(keep_appearance) and ref is not None
    report.append(f"Ролик: {blocks} блок(а) по {length} кадров ({length / 24:.2f} с), {width}×{height}")
    report.append(f"Режим: {mode.split(' / ')[0]} — {steps} шагов" + (f", турбо-LoRA ×{TURBO_STRENGTH}" if turbo else "")
                  + (f", быстрая LoRA ×{FAST_STRENGTH:g}, {FAST_SAMPLER}, сдвиг {FAST_SHIFT_VIDEO:g}/{FAST_SHIFT_AUDIO:g}"
                     if fast else ""))
    if auds:
        report.append("🔊 Звуковые образцы: " + ", ".join(f"<Audio {i + 1}>" for i in range(len(auds)))
                      + " — в каждый блок")
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
    block_images = list(block_images or [])
    block_images += [{}] * (blocks - len(block_images))
    conds = []
    for k, p in enumerate(prompts):
        send(f"Текст блока {k + 1}/{blocks} / Text {k + 1}/{blocks}")
        bi = block_images[k] or {}
        who = bi.get("who") if k > 0 else None
        mids = [m for m in (bi.get("mid") or []) if m is not None]
        refs = ([ref] if use_ref else []) + ([who] if who is not None else []) + mids
        p = with_continuity(p, k)
        if use_ref:
            p = with_appearance(p)
        if auds and "<Audio" not in p:
            p = with_audio_refs(p, len(auds))
        if who is not None or mids:
            p = block_refs_prompt(p, 2 if use_ref else 1, who, mids)
            tags, no = [], 1
            if use_ref:
                tags.append("<Picture 1> внешность")
                no += 1
            if who is not None:
                tags.append(f"<Picture {no}> образец «кто/где»")
                no += 1
            for i in range(len(mids)):
                tags.append(f"<Picture {no}> навигатор {i + 1}")
                no += 1
            report.append(f"Блок {k + 1}: " + ", ".join(tags))
        if refs or auds:
            kw = {}
            if refs:
                kw["ref_images"] = {f"ref_image_{i}": im for i, im in enumerate(refs)}
            if auds:
                kw["ref_audios"] = {f"ref_audio_{i}": a for i, a in enumerate(auds)}
                kw["audio_vae"] = node("VAELoader", vae_name=models["vae_audio"])[0]
            positive, latent = node("MiniMaxH3ReferenceToVideo", clip=clip, vae=vae, prompt=p,
                                    width=int(width), height=int(height), length=int(length),
                                    ref_image_size=ref_quality, **kw)
            del kw
        else:
            positive, latent = node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=p, width=int(width),
                                    height=int(height), length=int(length))
        conds.append((positive, latent))
    del clip, vae
    free("текстовый энкодер выгружен")
    vram_log("после текста")

    # ---- 2. модель — один раз на весь ролик; LoRA накладываются на неё по блокам ----
    send("Загрузка модели / Loading model")
    unet = models["unet"]
    if best and base(unet) == UNET_NAME:
        bf16 = find_file("diffusion_models", UNET_BF16)
        if bf16:
            unet = bf16
            report.append("Максимум: взята модель bf16")
        else:
            report.append("Максимум: модели bf16 нет — работаю на int8")
    base_model = node("UNETLoader", unet_name=unet, weight_dtype="default")[0]
    report.append(f"Модель: {base(unet)}")
    block_loras = list(block_loras or [])
    block_loras += [[]] * (blocks - len(block_loras))
    global_loras = list(global_loras or [])
    if global_loras:
        report.append("LoRA на весь ролик: " + ", ".join(f"{base(n)} ×{st:g}" for n, st in global_loras))
    attn = ATTN_FAST if fast_attention else ATTN_FULL

    def build(extra):
        """Базовая модель + турбо + общие LoRA + LoRA блока. С диска базу заново не читаем —
        LoRA ложатся «накладкой» на ту же модель."""
        m = base_model
        if turbo:
            m = lora(m, models["turbo_lora"], TURBO_STRENGTH)
        if fast:
            m = lora(m, models["fast_lora"], FAST_STRENGTH)
        for name, st in global_loras + list(extra):
            m = lora(m, name, float(st))
        m = node("MiniMaxH3SigmaShift", model=m, shift_video=FAST_SHIFT_VIDEO if fast else SHIFT_VIDEO,
                 shift_audio=FAST_SHIFT_AUDIO if fast else SHIFT_AUDIO)[0]
        if has_node("ModelAttentionBackend"):
            try:
                m = node("ModelAttentionBackend", model=m, attention=attn)[0]
            except Exception as e:
                log.warning("%s внимание %s недоступно (%s)", TAG, attn, e)
        return m

    model, model_key = None, None

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
        last_img = (block_images[k] or {}).get("last")
        if last_img is not None:
            send(f"{label}: кадр конца / end frame")
            vae = node("VAELoader", vae_name=models["vae_video"])[0]
            positive = node("MiniMaxH3AddGuide", positive=positive, latent=latent, frame_idx=-1, vae=vae,
                            image=last_img[:1])[0]
            del vae
            report.append(f"{label}: конец прикреплён к последнему кадру блока")
        free(f"{label}: начало прикреплено")

        key = tuple(block_loras[k])
        if model is None or key != model_key:
            send(f"{label}: LoRA блока / block LoRAs")
            model = None
            model = build(block_loras[k])
            model_key = key
            if block_loras[k]:
                report.append(f"{label} LoRA: " + ", ".join(f"{base(n)} ×{st:g}" for n, st in block_loras[k]))
        send(f"{label}: генерация / generating", 0, steps)
        sampler = node("KSamplerSelect", sampler_name=FAST_SAMPLER if fast else SAMPLER)[0]
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

    del model, base_model
    free("всё выгружено")
    send("Склейка / Joining")
    video = torch.cat([c.float() for c in chunks], dim=0)
    del chunks
    if total_frames and video.shape[0] > int(total_frames):          # ровно под общую длину ролика
        video = video[:int(total_frames)]
        last = video[-1:].clone()
        sr = int(full_audio["sample_rate"])
        full_audio = {"waveform": full_audio["waveform"][..., :int(round(int(total_frames) / 24.0 * sr))],
                      "sample_rate": sr}
    n = int(video.shape[0])
    report.append(f"Готово: {n} кадров ({n / 24:.1f} с) за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    vram_log("финиш")
    return video, full_audio, last, n, report
