# -*- coding: utf-8 -*-
"""
Neron Video Editor — AI-правка видео по маске / masked AI video edit (MiniMax H3 Fun ControlNet).

RU: Правим само видео, а не делаем новое. Модель MiniMax H3 (ref2va) с патчем
    Fun ControlNet Union перерисовывает ТОЛЬКО обведённую область, а всё вне её берёт
    из настоящего видео (source_video) — и видит его, поэтому новое встаёт в сцену и
    движется вместе с ней. Картинки на полоске внутри куска — образцы <Picture N>,
    время их появления пульт пишет в промпт сам. Вне области и вне куска итог —
    оригинал кадр в кадр (пульт ещё раз накладывает область поверх оригинала).
EN: We edit the real video. MiniMax H3 (ref2va) + Fun ControlNet Union patch repaints
    ONLY the outlined area and takes everything else from the real video, which it also
    sees, so the new element sits in the scene and moves with it. Pictures inside the
    piece are <Picture N> references with auto timing. Outside the area — the original.
"""

import gc
import hashlib
import logging
import math
import os
import time

import torch

log = logging.getLogger("Neron.VideoEditor.AI")

FPS = 24
GRID = 32
MAX_FRAMES = 362            # 15 с — верх обучения модели / training max
MIN_FRAMES = 48             # 2 с — короче образец-видео модель не берёт / ref video min 2 s

SHIFT_VIDEO, SHIFT_AUDIO = 12.0, 3.0
SAMPLER, SCHEDULER = "res_multistep", "simple"
QUALITY_STEPS = 40
TURBO_STEPS, TURBO_STRENGTH = 4, 1.0        # турбо-LoRA ref2v — «4-step mode» по документации Comfy
MIN_GEN = 124                               # 5 с — от стольких модель обучена / trained from 5 s
PATCH_STRENGTH = 1.0

UNET_NAME = "minimax_h3_ref2va_pruned_int8_convrot.safetensors"     # правка по образцам / reference editing
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"
VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"
TURBO_LORA_NAME = "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"
PATCH_NAME = "minimax_h3_fun_controlnet_union_pruned_int8_convrot.safetensors"
HF = "https://huggingface.co/Comfy-Org/MiniMax-H3/blob/main/"
PATCH_URL = HF + "model_patches/" + PATCH_NAME
TURBO_URL = HF + "loras/" + TURBO_LORA_NAME
UNET_URL = HF + "diffusion_models/" + UNET_NAME

MODES = ["⚡ Турбо / Turbo", "Качество / Quality"]
SIZES = {"Полный / Full (768)": 768, "Средний / Medium (640)": 640, "Черновик / Draft (512)": 512}


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


def frames_for_len(L):
    """Длина генерации на сетке модели (17k+5), не короче образца. / Model grid length, not shorter than the ref."""
    n = max(5, int(L))
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
    if hasattr(out, "result"):      # новые ноды отдают NodeOutput / new-style nodes return NodeOutput
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


# ---------------------------------------------------------------- образцы и промпт / references & prompt
def _rgb(x):
    x = x[..., :3].float()
    if x.shape[-1] == 1:
        x = x.expand(*x.shape[:-1], 3)
    return x


def segment(main, t0, n):
    """n кадров видео 1 с секунды t0 в 24 к/с (за концом ролика — последний кадр).
    n frames of video 1 from t0 at 24 fps (the last frame is held past the end)."""
    return torch.stack([_rgb(main.at(t0 + j / FPS)) for j in range(n)]).cpu()


_APPEAR = {"cut": "appears", "dissolve": "gradually materializes", "reveal": "gradually materializes",
           "wipe": "gradually materializes", "dip": "gradually materializes"}
_LEAVE = {"cut": "disappears", "dissolve": "smoothly fades away", "reveal": "smoothly fades away",
          "wipe": "smoothly fades away", "dip": "smoothly fades away"}


def prompt_for(ev, pics):
    """Промпт перерисовки: что появляется в области + время картинок (от начала куска).
    Свой полный промпт (есть <Picture или subject_definitions) уходит как есть.
    Inpaint prompt: what appears in the area + picture timing. A full own prompt is used verbatim."""
    txt = ev["text"].strip()
    if "subject_definitions" in txt or "<Picture" in txt:
        return txt
    if txt and txt[-1] not in ".!?…":
        txt += "."
    dur = ev["dur"]
    subj, timing = [], []
    for n, a, b, tin, tout in pics:
        subj.append(f"<Picture {n}> is a reference image: use only its main object, not its background or frame.")
        line = f"At {a:.1f} s the element from <Picture {n}> {_APPEAR.get(tin, 'appears')}"
        if b < dur - 0.05:
            line += f"; at {b:.1f} s it {_LEAVE.get(tout, 'disappears')}"
        timing.append(line + ".")
    parts = [" ".join(subj)] if subj else []
    parts.append("Live-action footage. " + " ".join(p for p in [txt] + timing if p))
    parts.append("The new element is physically attached to the scene, lit by the same light, and moves naturally "
                 "with the people. Everything else in the footage stays exactly as it is.")
    return "\n".join(p for p in parts if p)


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


def piece(ev, main, pics, engine, aspect_wh, ref_audio=None):
    """AI-правка по маске. pics: [(n, image, a, b, tin, tout)] — картинки внутри куска (время от его начала).
    → dict(frames [n,h,w,3] 0..1 CPU, audio|None, fps, notes, cached, prompt)."""
    from . import ve_core
    if not ev.get("area"):
        raise RuntimeError("[Neron Video Editor] ✨ AI: обведите на кадре область, где менять (рамка «Где менять») "
                           "/ ✨ AI: outline the area to change on the frame")
    if not ev["text"].strip() and not pics:
        raise RuntimeError("[Neron Video Editor] ✨ AI: напишите, что сделать, или положите внутрь куска картинку "
                           "/ ✨ AI: write what to do or put a picture inside the piece")
    short = SIZES.get(engine.get("size"), 768)
    w, h = canvas(aspect_wh[0], aspect_wh[1], short)
    # модель обучена на 5–15 с: короткому куску даём досмотреть настоящее продолжение
    # trained on 5–15 s: a short piece gets the real continuation as extra context
    n = frames_for_len(max(MIN_GEN, int(round(ev["dur"] * FPS))))
    src = segment(main, ev["t"], n)
    mask = ve_core.area_mask(dict(ev["area"], feather=0.0), h, w, "cpu")
    mask = (mask > 0.5).float().unsqueeze(0).expand(n, h, w).contiguous()
    prompt = prompt_for(ev, [(k, a, b, ti, to) for k, _, a, b, ti, to in pics])
    models = engine["models"]
    seed = int(engine.get("seed", 1)) + int(ev.get("seed", 0))
    turbo = engine["mode"] == MODES[0]
    want_audio = ev["sound"] == "ai"
    key = _hash("inpaint", prompt, w, h, n, engine["mode"], seed, models, want_audio, src, mask[0],
                *[p[1] for p in pics])
    notes = [f"размер {w}×{h}, {n} кадров ({n / FPS:.1f} с) / size, frames",
             f"перерисовка по маске, образцов-картинок {len(pics)} / masked repaint, {len(pics)} pictures"]

    if key in _MEM:
        r = _MEM[key]
        return dict(r, notes=notes + ["взято из памяти — без генерации / reused"], cached=True, prompt=prompt)
    path = os.path.join(_cache_dir(), key + ".pt")
    if os.path.isfile(path):
        try:
            d = torch.load(path, map_location="cpu", weights_only=False)
            r = {"frames": d["frames"].float() / 255.0, "audio": d.get("audio"), "fps": FPS}
            _MEM.clear()
            _MEM[key] = r
            return dict(r, notes=notes + ["взято с диска — без генерации / reused from disk"], cached=True,
                        prompt=prompt)
        except Exception:
            pass

    t_all = time.time()
    steps = TURBO_STEPS if turbo else QUALITY_STEPS
    free("перед AI-куском / before the AI piece")

    # 1. текст + картинки-образцы / text + reference pictures
    clip = _node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = _node("VAELoader", vae_name=models["vae_video"])[0]
    params = {"clip": clip, "vae": vae, "prompt": prompt, "width": int(w), "height": int(h), "length": int(n),
              "ref_image_size": "match" if turbo else "max"}
    if pics:
        params["ref_images"] = {f"ref_image_{i}": _rgb(p[1]).unsqueeze(0).cpu() for i, p in enumerate(pics)}
    res = _node("MiniMaxH3ReferenceToVideo", **params)
    positive, latent = res[0], res[1]
    del clip, params, res
    free("текст готов / text ready")

    # 2. модель + патч перерисовки по маске / model + masked-repaint patch
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
    patch = _node("ModelPatchLoader", name=models["patch"])[0]
    model = _node("MiniMaxH3FunControlNetApply", model=model, model_patch=patch, vae=vae,
                  strength=PATCH_STRENGTH, start_percent=0.0, end_percent=1.0, mask=mask, source_video=src)[0]
    sampler = _node("KSamplerSelect", sampler_name=SAMPLER)[0]
    noise = _node("RandomNoise", noise_seed=seed)[0]
    sigmas = _node("BasicScheduler", model=model, scheduler=SCHEDULER, steps=int(steps), denoise=1.0)[0]
    guider = _node("BasicGuider", model=model, conditioning=positive)[0]
    t_gen = time.time()
    out = _node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas,
                latent_image=latent)[0]
    gen_s = time.time() - t_gen
    del model, patch, guider, sigmas, positive, latent, noise, sampler
    free("модель выгружена / model unloaded")

    # 3. раскодировка / decode
    video = _decode(out, vae)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = _rgb(video).cpu()
    del vae
    free("видео-VAE выгружен / video VAE unloaded")
    audio = None
    if want_audio:
        avae = _node("VAELoader", vae_name=models["vae_audio"])[0]
        audio = _node("VAEDecodeAudio", samples=out, vae=avae)[0]
        del avae
        free("аудио-VAE выгружен / audio VAE unloaded")
    del out

    r = {"frames": video, "audio": audio, "fps": FPS}
    try:
        torch.save({"frames": (video.clamp(0, 1) * 255 + 0.5).to(torch.uint8), "audio": audio}, path)
    except Exception as e:
        log.warning("[Neron Video Editor AI] не сохранил кусок на диск: %s", e)
    _MEM.clear()
    _MEM[key] = r
    notes.append(f"генерация {gen_s:.0f} с, всего {time.time() - t_all:.0f} с ({steps} шагов) / generation time")
    return dict(r, notes=notes, cached=False, prompt=prompt)
