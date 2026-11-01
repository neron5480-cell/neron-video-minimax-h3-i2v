# -*- coding: utf-8 -*-
"""
Neron Video Editor — AI-кусок через MiniMax H3 / AI piece via MiniMax H3.

RU: Событие «✨ AI» пульта: модель рисует кусок ролика, а к его кадрам «прибиты»
    (MiniMaxH3AddGuide) настоящие кадры видео 1 — в начале (движение, чтобы стык был
    гладким), картинка — на нужной секунде, и при «вернуться» — снова настоящие кадры
    в конце. Так переход начинается из оригинала и (по желанию) в него возвращается.
    Память — строго по очереди, как в H3 Engine: текст → генерация → раскодировка.
    Готовые куски запоминаются на диске (temp) — повторная «Очередь» их не пересчитывает.
EN: The pult's “✨ AI” event: the model paints a piece of the clip while real frames
    of video 1 are anchored (MiniMaxH3AddGuide) at its start (motion, for a smooth
    seam), the picture at the chosen second, and — with “return” — real frames at the
    end. Staged memory as in H3 Engine. Finished pieces are cached on disk (temp).
"""

import gc
import hashlib
import logging
import math
import os
import time

import torch
import torch.nn.functional as F

log = logging.getLogger("Neron.VideoEditor.AI")

FPS = 24
GRID = 32
MAX_FRAMES = 362            # 15 с — верх обучения модели / training max
MIN_FRAMES = 124            # ~5 с — низ обучения модели / training min
ANCHOR = 22                 # кусок-якорь: 22 кадра ≈ 0.9 с (сетка 17k+5) / anchor clip

SHIFT_VIDEO, SHIFT_AUDIO = 12.0, 3.0
SAMPLER, SCHEDULER = "res_multistep", "simple"
QUALITY_STEPS, TURBO_STEPS, TURBO_STRENGTH = 40, 12, 0.8

UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"

MODES = ["⚡ Турбо / Turbo", "Качество / Quality"]
SIZES = {"Полный / Full (768)": 768, "Средний / Medium (640)": 640, "Черновик / Draft (512)": 512}

# Готовые фразы перехода (английский — язык гайда MiniMax) / transition phrases
STYLES = {
    "dissolve": "The live-action footage slowly and seamlessly dissolves into the new image, which then comes to life.",
    "pencil": ("A graphite pencil starts sketching over the live-action footage; pencil lines spread across the frame "
               "until the whole scene becomes a black-and-white pencil drawing on white paper, which then comes alive. "
               "Keep the hand-drawn pencil look: graphite strokes, white paper, no colour, no photorealism."),
    "drain": ("The colours drain out of the live-action footage, leaving only outlines, and the scene turns into "
              "a hand-drawn illustration, which then comes alive."),
    "ink": ("Black ink spreads across the frame like on wet paper and forms the new image, which then comes alive. "
            "Keep the ink drawing style."),
    "paper": ("Paper texture shows through the live-action footage and the scene turns into an illustration on paper, "
              "which then comes alive."),
    "custom": "",
}


# ---------------------------------------------------------------- размеры / sizes
def _snap(v):
    return max(GRID, int(math.floor(v / GRID + 0.5)) * GRID)


def canvas(width, height, short=768):
    """Холст модели той же формы: короткая сторона short, площадь ≤ 768×1344, кратно 32."""
    w, h = max(1.0, float(width)), max(1.0, float(height))
    r = w / h
    nw, nh = (short * r, short) if r >= 1 else (short, short / r)
    cap = 768 * 1344
    if nw * nh > cap:
        s = math.sqrt(cap / (nw * nh))
        nw, nh = nw * s, nh * s
    w2, h2 = _snap(nw), _snap(nh)
    while w2 * h2 > cap:
        if w2 >= h2:
            w2 -= GRID
        else:
            h2 -= GRID
    return w2, h2


def frames_for(seconds):
    n = max(MIN_FRAMES, int(round(float(seconds) * FPS)))
    while n % 17 != 5:
        n += 1
    return min(MAX_FRAMES, n)


# ---------------------------------------------------------------- служебное / helpers
def _node(class_name, **kw):
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise RuntimeError(f"[Neron Video Editor] нет ноды ComfyUI «{class_name}» — обновите ComfyUI "
                           f"/ ComfyUI node “{class_name}” is missing — update ComfyUI")
    out = getattr(cls(), cls.FUNCTION)(**kw)
    # новые ноды (io.ComfyNode) отдают NodeOutput / new-style nodes return NodeOutput
    if hasattr(out, "result"):
        out = out.result
    return out


def free(reason=""):
    if reason:
        log.info("[Neron Video Editor AI] память / memory: %s", reason)
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache()
    except Exception:
        pass
    gc.collect()
    if torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
        except Exception:
            pass


def _is_oom(e):
    try:
        import comfy.model_management as mm
        if mm.is_oom(e):
            return True
    except Exception:
        pass
    return "out of memory" in str(e).lower()


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


def _decode(out, vae):
    try:
        return _node("VAEDecode", samples=out, vae=vae)[0]
    except Exception as e:
        if not _is_oom(e):
            raise
    for tile, ts in ((512, 48), (384, 32), (256, 16)):
        free(f"раскодировка плитками {tile}")
        try:
            return _node("VAEDecodeTiled", samples=out, vae=vae, tile_size=tile, overlap=tile // 4,
                         temporal_size=ts, temporal_overlap=min(8, ts // 2))[0]
        except Exception as e:
            if not _is_oom(e):
                raise
    raise RuntimeError("[Neron Video Editor] не хватило видеопамяти на раскодировку — уменьшите длину или размер "
                       "/ not enough VRAM to decode — shorten the piece or lower the size")


# ---------------------------------------------------------------- якоря / anchors
def _rgb(x):
    x = x[..., :3].float()
    if x.shape[-1] == 1:
        x = x.expand(*x.shape[:-1], 3)
    return x


def _frames_at(src, times):
    """Кадры источника по секундам → [k,H,W,3]."""
    return torch.stack([_rgb(src.at(max(0.0, t))) for t in times]).cpu()


def plan(ev, main, images, n):
    """Что и куда прибиваем / what gets anchored where. → [(frame_idx, frames [k,H,W,3]), …], отчёт."""
    guides, notes = [], []
    t0, dur = ev["t"], n / FPS
    end_room = ANCHOR if ev["back"] else 0
    if ev["start"] == "motion":
        clip = _frames_at(main, [t0 + j / FPS for j in range(ANCHOR)])
        guides.append((0, clip))
        notes.append(f"начало: {ANCHOR} настоящих кадров (движение) / start: {ANCHOR} real frames (motion)")
    elif ev["start"] == "frame":
        guides.append((0, _frames_at(main, [t0])))
        notes.append("начало: 1 настоящий кадр / start: 1 real frame")
    pic = images.get(ev["pic"]) if ev["pic"] else None
    if pic is not None:
        lo = ANCHOR if ev["start"] == "motion" else 1 if ev["start"] == "frame" else 0
        hi = n - 1 - end_room
        idx = int(round(ev["pic_at"] * FPS))
        idx = max(lo, min(hi, idx))
        guides.append((idx, _rgb(pic).unsqueeze(0).cpu()))
        notes.append(f"картинка {ev['pic']} на кадре {idx} ({idx / FPS:.1f} с) / picture at frame {idx}")
    if ev["back"]:
        t1 = t0 + dur
        clip = _frames_at(main, [t1 - (ANCHOR - j) / FPS for j in range(ANCHOR)])
        guides.append((n - ANCHOR, clip))
        notes.append("конец: возврат в настоящее видео / end: back to the real footage")
    return guides, notes


def prompt_for(ev):
    parts = [STYLES.get(ev["style"], "")]
    txt = ev["text"].strip()
    if txt:
        parts.append(txt if txt[-1] in ".!?…" else txt + ".")
    if ev["start"] != "none":
        parts.append("The clip starts as a direct continuation of the original live-action footage: same camera, "
                     "same people, same motion.")
    if ev["back"]:
        parts.append("At the end the scene returns to the original live-action footage.")
    return " ".join(p for p in parts if p).strip()


def _keep_bw(frames, idx_from, ramp=12):
    """Ч/б как у рисунка: от картинки и дальше — без цвета (плавно за ramp кадров)."""
    g = frames[..., 0] * 0.299 + frames[..., 1] * 0.587 + frames[..., 2] * 0.114
    n = frames.shape[0]
    k = torch.clamp((torch.arange(n, dtype=torch.float32) - (idx_from - ramp)) / max(1, ramp), 0.0, 1.0)
    k = k.view(n, 1, 1, 1)
    return frames * (1 - k) + g.unsqueeze(-1) * k


def is_gray(img, tol=0.03):
    x = _rgb(img)
    return float((x.max(-1).values - x.min(-1).values).mean()) < tol


# ---------------------------------------------------------------- генерация / generation
_MEM = {}


def _hash(*parts):
    h = hashlib.sha1()
    for p in parts:
        if torch.is_tensor(p):
            flat = p.reshape(-1)
            k = min(4097, flat.numel())  # отпечаток — целыми числами / integer sample points (float linspace overflowed)
            idx = torch.arange(k, dtype=torch.int64) * (flat.numel() - 1) // max(1, k - 1)
            h.update(flat[idx].float().cpu().numpy().tobytes())
            h.update(str(tuple(p.shape)).encode())
        else:
            h.update(repr(p).encode())
    return h.hexdigest()[:20]


def _cache_dir():
    import folder_paths
    d = os.path.join(folder_paths.get_temp_directory(), "neron_ve", "ai")
    os.makedirs(d, exist_ok=True)
    return d


def piece(ev, main, images, engine, aspect_wh, progress_note=None):
    """Готовый AI-кусок: dict(frames [n,h,w,3] float 0..1 CPU, audio|None, fps, notes, cached).
    aspect_wh — размер видео 1 (кусок той же формы)."""
    short = SIZES.get(engine.get("size"), 768)
    w, h = canvas(aspect_wh[0], aspect_wh[1], short)
    n = frames_for(ev["dur"])
    guides, notes = plan(ev, main, images, n)
    prompt = prompt_for(ev)
    if not prompt:
        raise RuntimeError("[Neron Video Editor] AI: опишите словами, что происходит, или выберите вид перехода "
                           "/ AI: describe what happens or pick a transition style")
    models = engine["models"]
    seed = int(engine.get("seed", 1)) + int(ev.get("seed", 0))
    key = _hash(prompt, w, h, n, engine["mode"], seed, models, ev["sound"] == "ai",
                *[g for _, g in guides], *[i for i, _ in guides])
    notes.insert(0, f"размер {w}×{h}, {n} кадров ({n / FPS:.1f} с) / size, frames")

    if key in _MEM:
        r = _MEM[key]
        return dict(r, notes=notes + ["взято из памяти — без генерации / reused, no generation"], cached=True)
    path = os.path.join(_cache_dir(), key + ".pt")
    if os.path.isfile(path):
        try:
            d = torch.load(path, map_location="cpu", weights_only=False)
            r = {"frames": d["frames"].float() / 255.0, "audio": d.get("audio"), "fps": FPS}
            _MEM.clear()
            _MEM[key] = r
            return dict(r, notes=notes + ["взято с диска — без генерации / reused from disk"], cached=True)
        except Exception:
            pass

    t_all = time.time()
    turbo = engine["mode"] == MODES[0]
    steps = TURBO_STEPS if turbo else QUALITY_STEPS
    free("перед AI-куском / before the AI piece")

    # 1. текст + якоря / text + anchors
    clip = _node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = _node("VAELoader", vae_name=models["vae_video"])[0]
    positive, latent = _node("MiniMaxH3ImageToVideo", clip=clip, vae=vae, prompt=prompt,
                             width=int(w), height=int(h), length=int(n))
    del clip
    free("текстовый энкодер выгружен / text encoder unloaded")
    for idx, frames in guides:
        positive = _node("MiniMaxH3AddGuide", positive=positive, vae=vae, latent=latent,
                         image=frames, frame_idx=int(idx))[0]
    del vae
    free("якоря готовы / anchors ready")

    # 2. генерация / sampling
    model = _node("UNETLoader", unet_name=models["unet"], weight_dtype="default")[0]
    if turbo:
        model = _lora(model, models["turbo_lora"], TURBO_STRENGTH)
    model = _node("MiniMaxH3SigmaShift", model=model, shift_video=SHIFT_VIDEO, shift_audio=SHIFT_AUDIO)[0]
    try:
        import nodes as comfy_nodes
        if "ModelAttentionBackend" in comfy_nodes.NODE_CLASS_MAPPINGS:
            model = _node("ModelAttentionBackend", model=model, attention="pytorch attention")[0]
    except Exception:
        pass
    sampler = _node("KSamplerSelect", sampler_name=SAMPLER)[0]
    noise = _node("RandomNoise", noise_seed=seed)[0]
    sigmas = _node("BasicScheduler", model=model, scheduler=SCHEDULER, steps=int(steps), denoise=1.0)[0]
    guider = _node("BasicGuider", model=model, conditioning=positive)[0]
    t_gen = time.time()
    out = _node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas,
                latent_image=latent)[0]
    gen_s = time.time() - t_gen
    del model, guider, sigmas, positive, latent, noise, sampler
    free("основная модель выгружена / model unloaded")

    # 3. раскодировка / decode
    vae = _node("VAELoader", vae_name=models["vae_video"])[0]
    video = _decode(out, vae)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = _rgb(video).cpu()
    del vae
    free("видео-VAE выгружен / video VAE unloaded")
    audio = None
    if ev["sound"] == "ai":
        avae = _node("VAELoader", vae_name=models["vae_audio"])[0]
        audio = _node("VAEDecodeAudio", samples=out, vae=avae)[0]
        del avae
        free("аудио-VAE выгружен / audio VAE unloaded")
    del out

    pic_idx = next((i for i, g in guides if g.shape[0] == 1 and i > 0), None)
    if ev["keep_bw"] and pic_idx is not None and ev["pic"] in images and is_gray(images[ev["pic"]]):
        video = _keep_bw(video, pic_idx)
        notes.append("ч/б рисунка удержан / drawing kept black-and-white")

    r = {"frames": video, "audio": audio, "fps": FPS}
    try:
        torch.save({"frames": (video.clamp(0, 1) * 255 + 0.5).to(torch.uint8), "audio": audio}, path)
    except Exception as e:
        log.warning("[Neron Video Editor AI] не сохранил кусок на диск: %s", e)
    _MEM.clear()
    _MEM[key] = r
    notes.append(f"генерация {gen_s:.0f} с, всего {time.time() - t_all:.0f} с ({steps} шагов) / generation time")
    return dict(r, notes=notes, cached=False)
