# -*- coding: utf-8 -*-
"""Движок 🎭 Замены героя на MiniMax H3 — только родные ноды ComfyUI, свой код — склейка и маски.

Как работает (идея — процесс Akatz Labs «H3 Character Swap»; код наш, с нашими правками):
  1. Клип → 24 к/с, длина по сетке H3 (17k+5), размер — в паспорте модели (480p или 768p).
  2. SAM 3.1 (родные ноды SAM3_Detect / SAM3_VideoTrack / SAM3_TrackToMask) находит человека в первом кадре
     и ведёт его маской по всему клипу. Маску расширяем (волосы, одежда, движение) — модели нужен запас.
  2б. ИДЕЯ РОМАНА: человек (или голова) в клипе-образце РАЗМЫТ — черт оригинала модель не видит, копировать
     нечего; свет, цвета и движение остаются. (Чёрный/серый силуэт и скелет проверены — размытие лучше.)
  3. Условия: MiniMaxH3ReferenceToVideo — <Video 1> = размытый клип, <Picture 1> = фото «на кого»,
     звук клипа — образцом (губы и движения ложатся на речь/музыку). MiniMaxH3AddGuide — звук ещё и целью.
  4. ДОРИСОВКА ПО МАСКЕ: латент = закодированный исходный клип, noise_mask = маска человека (в размере латента).
     Сэмплер меняет только то, что под маской, — фон и остальные люди остаются клипом.
  5. Модель H3 **Ref2VA** (отдельный файл, не fl2va!) + турбо-LoRA 8 шагов + LoRA замены V1.5, er_sde / normal.
  6. НАША ПРАВКА: точные края — SAM по готовому видео находит нового человека, вклеиваем только его (и место
     старого), остальное — НАСТОЯЩИЕ пиксели клипа. Звук — оригинал клипа байт в байт.
Память — по очереди, как в Neron H3 Engine: SAM → выгрузка → текст → выгрузка → модель → выгрузка → VAE.
"""
import gc
import logging
import math
import time

import torch
import torch.nn.functional as F

log = logging.getLogger("Neron.H3.Swap")
TAG = "[H3 Swap]"
FPS = 24
MIN_FRAMES = 48                 # 2 с — меньше H3 видео-образец не читает
MAX_FRAMES = 362                # паспорт H3: ≈15 с
MAX_AREA = 1344 * 768
SHIFT_VIDEO, SHIFT_AUDIO = 12.0, 3.0
SAMPLER, SCHEDULER = "er_sde", "normal"      # рецепт автора LoRA (проверенный)
CLIP_TYPE = "minimax"
ATTN_FAST = "comfy kitchen attention"
ATTN_FULL = "pytorch attention"


class FriendlyError(Exception):
    """Понятная ошибка: что случилось и что сделать — на двух языках."""


# ---------------- служебное (как в Neron H3 Engine) ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("neron_h3swap.progress", {"stage": stage, "i": int(i), "total": int(total)})
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
    """Вызов родной ноды ComfyUI по имени."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise FriendlyError(f"{TAG} В ComfyUI нет ноды «{class_name}». Обнови ComfyUI (нужны MiniMax H3 и SAM3).\n\n"
                            f"EN: ComfyUI has no «{class_name}» node. Update ComfyUI (MiniMax H3 and SAM3 support).")
    return getattr(cls(), cls.FUNCTION)(**kw)


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def base(name):
    return str(name or "").replace("\\", "/").split("/")[-1]


def find_file(kind, name):
    """Имя модели для загрузчика ComfyUI или None.
    1) ищем в списке ComfyUI (вдруг лежит в подпапке); 2) список бывает неполным (кэш, лишние папки моделей
    Comfy Desktop) — тогда спрашиваем ComfyUI напрямую по имени: окно «Модели» видит файл именно так."""
    try:
        import folder_paths
    except Exception:
        return None
    try:
        for f in folder_paths.get_filename_list(kind):
            if base(f).lower() == base(name).lower():          # Windows: регистр букв в имени не важен
                return f
    except Exception as e:
        log.warning("%s список «%s»: %s", TAG, kind, e)
    for n in (name, base(name)):
        try:
            p = folder_paths.get_full_path(kind, n)
            if p and __import__("os").path.isfile(p):
                log.info("%s «%s» нет в списке ComfyUI, но файл на месте: %s", TAG, n, p)
                return n
        except Exception:
            pass
    return None


def lora(model, name, strength):
    """LoRA только на модель; файл не держим в памяти после."""
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
    """Целиком; не влезло — плитками всё мельче (готовую генерацию не теряем)."""
    try:
        return node("VAEDecode", samples=out, vae=vae)[0], "целиком / whole frame"
    except Exception as e:
        if not is_oom(e):
            raise
    for tile, t_size in TILES:
        free(f"раскодировка плитками {tile}")
        try:
            img = node("VAEDecodeTiled", samples=out, vae=vae, tile_size=tile, overlap=tile // 4,
                       temporal_size=t_size, temporal_overlap=min(8, t_size // 2))[0]
            return img, f"плитками {tile} пикс."
        except Exception as e:
            if not is_oom(e):
                raise
    raise FriendlyError(f"{TAG} Не хватило видеопамяти на раскодировку даже плитками. Возьми 480p или клип короче.\n\n"
                        f"EN: Not enough VRAM to decode even in tiles. Use 480p or a shorter clip.")


# ---------------- клип: частота, длина, размер ----------------

def to_24(frames, fps):
    """Любая частота кадров → 24 к/с по времени (скорость движения не меняется)."""
    n = int(frames.shape[0])
    if not fps or abs(fps - FPS) < 0.01:
        return frames
    m = max(1, int(math.floor(n / fps * FPS + 1e-6)))
    idx = torch.clamp(torch.round(torch.arange(m, dtype=torch.float64) * fps / FPS).long(), 0, n - 1)
    return frames[idx]


def grid_down(n):
    """Наибольшее 17k+5, не больше n и паспорта (362). Меньше 2 с — 0."""
    n = min(int(n), MAX_FRAMES)
    if n < MIN_FRAMES:
        return 0
    while n % 17 != 5:
        n -= 1
    return n


def grid_fit(want, have):
    """Длина по сетке 17k+5: ближайшая к желаемой (5 с → 124 кадра = 5,17 с), но не длиннее клипа и паспорта."""
    up = min(int(want), MAX_FRAMES)
    while up % 17 != 5:
        up += 1
    if up <= min(int(have), MAX_FRAMES):
        return up
    return grid_down(min(int(want), int(have)))


def canvas(w, h, short):
    """Размер генерации: короткая сторона short, пропорции клипа, кратно 32, площадь не больше паспорта H3."""
    k = short / float(min(w, h))
    cw, ch = w * k, h * k
    if cw * ch > MAX_AREA:
        s = math.sqrt(MAX_AREA / (cw * ch))
        cw, ch = cw * s, ch * s
    return max(32, int(round(cw / 32)) * 32), max(32, int(round(ch / 32)) * 32)


def resize(frames, w, h):
    """Кадры → w×h (центр, без растяжения), кусками — не держим лишнего в памяти."""
    import comfy.utils
    if frames.shape[1] == h and frames.shape[2] == w:
        return frames
    out = []
    for i in range(0, frames.shape[0], 16):
        chunk = frames[i:i + 16, ..., :3].movedim(-1, 1)
        out.append(comfy.utils.common_upscale(chunk, w, h, "lanczos", "center").movedim(1, -1).clamp(0, 1).cpu())
    return torch.cat(out, 0)


def fit_audio(audio, seconds):
    """Звук ровно под длину ролика: длиннее — обрезать, короче — тишина в конце."""
    if audio is None:
        return None
    wf, sr = audio["waveform"], int(audio["sample_rate"])
    if wf.dim() == 2:
        wf = wf.unsqueeze(0)
    need = int(round(seconds * sr))
    wf = wf[..., :need] if wf.shape[-1] >= need else F.pad(wf, (0, need - wf.shape[-1]))
    return {"waveform": wf.contiguous(), "sample_rate": sr}


# ---------------- маска человека (SAM 3.1) ----------------

WHO = ["🔝 самый крупный / largest", "⬅ левый / leftmost", "➡ правый / rightmost", "🎯 в центре / center",
       "👥 все люди / everyone"]


def _pick(masks, who):
    """Кого менять — по маскам первого кадра. → список индексов."""
    area = masks.flatten(1).sum(1)
    ok = [i for i in range(masks.shape[0]) if float(area[i]) > 0]
    if who == WHO[4]:
        return ok
    W = masks.shape[2]
    xs = torch.arange(W, dtype=torch.float32)

    def cx(i):
        col = masks[i].float().sum(0)
        return float((col * xs).sum() / col.sum().clamp(min=1))
    if who == WHO[1]:
        return [min(ok, key=cx)]
    if who == WHO[2]:
        return [max(ok, key=cx)]
    if who == WHO[3]:
        return [min(ok, key=lambda i: abs(cx(i) - W / 2))]
    return [max(ok, key=lambda i: float(area[i]))]


def _fill_gaps(m):
    """Кадр, где трекер потерял человека, берёт маску ближайшего кадра, где он был (без дыр в замене)."""
    has = m.flatten(1).amax(1) > 0
    if bool(has.all()) or not bool(has.any()):
        return m, 0
    idx = torch.nonzero(has).flatten()
    out = m.clone()
    holes = 0
    for t in range(m.shape[0]):
        if not has[t]:
            j = int(idx[torch.argmin((idx - t).abs())])
            out[t] = m[j]
            holes += 1
    return out, holes


def _disk(r):
    y, x = torch.meshgrid(torch.arange(-r, r + 1), torch.arange(-r, r + 1), indexing="ij")
    return ((x * x + y * y) <= r * r + r).float()[None, None]


def dilate(m, px, frames_r=2):
    """Расширить маску на px пикселей (КРУГЛО, по контуру — без ступенек) и на ±frames_r кадров.
    Большой запас считаем на уменьшенной маске: быстро, а точность края ±несколько пикс. прячет мягкий край."""
    m = m.float()
    if px > 0:
        s = max(1, px // 8)
        r = max(1, int(round(px / s)))
        disk = _disk(r)
        out = []
        for i in range(0, m.shape[0], 16):
            c = m[i:i + 16, None]
            h, w = c.shape[-2:]
            small = F.max_pool2d(c, s, ceil_mode=True) if s > 1 else c
            g = (F.conv2d(small, disk.to(small.dtype), padding=r) > 0.5).float()
            if s > 1:
                g = F.interpolate(g, scale_factor=s, mode="nearest")[..., :h, :w]
            out.append(torch.maximum(g, c)[:, 0])
        m = torch.cat(out, 0)
    if frames_r > 0 and m.shape[0] > 1:
        m = F.max_pool1d(m.permute(1, 2, 0).reshape(-1, 1, m.shape[0]), 2 * frames_r + 1, stride=1,
                         padding=frames_r).reshape(m.shape[1], m.shape[2], -1).permute(2, 0, 1)
    return (m > 0.5).float()


def feather(m, px):
    """Мягкий край для вклейки оригинала (без «наклейки»)."""
    if px <= 0:
        return m
    k = 2 * px + 1
    out = []
    for i in range(0, m.shape[0], 16):
        out.append(F.avg_pool2d(m[i:i + 16, None], k, stride=1, padding=px, count_include_pad=False)[:, 0])
    return torch.cat(out, 0).clamp(0, 1)


def _heads_for(people, heads):
    """Каждому выбранному человеку — его голова: та, что больше всего лежит внутри его маски.
    Головы не нашлось — верх фигуры (≈ 22 % роста): лучше грубая голова, чем весь человек."""
    out = []
    for p in people:
        best, score = None, 0.3
        for h in heads:
            a = float(h.sum())
            if a <= 0:
                continue
            sc = float((h * p).sum()) / a
            if sc > score:
                best, score = h, sc
        if best is None:
            ys = torch.nonzero(p.sum(1) > 0).flatten()
            best = torch.zeros_like(p)
            if ys.numel():
                y1, y2 = int(ys.min()), int(ys.max()) + 1
                top = y1 + max(1, int((y2 - y1) * 0.22))
                best[y1:top] = p[y1:top]
        out.append(best)
    return torch.stack(out, 0)


def new_person_mask(video, sam_name, zone, threshold, head, report):
    """Точные края (0.5): SAM ещё раз — уже по ГОТОВОМУ видео, ищет нового человека (или голову) там, где был
    старый. → маска [N,H,W] или None. Нужна, чтобы вклеивать сгенерированное только по человеку, а полоса запаса
    вокруг снова стала настоящими резкими пикселями клипа."""
    send("Уточняю края / Refining edges", 0, int(video.shape[0]))
    model, clip = node("CheckpointLoaderSimple", ckpt_name=sam_name)[:2]
    found = []
    for text in (("head", "hair") if head else ("person",)):        # голова — вместе с волосами до плеч
        cond = node("CLIPTextEncode", clip=clip, text=text)[0]
        det = node("SAM3_Detect", model=model, image=video[:1], conditioning=cond, threshold=float(threshold),
                   refine_iterations=2, individual_masks=True)[0]
        if det.dim() == 2:
            det = det[None]
        det = (det.float().cpu() > 0.5).float()
        z = zone[0]
        found += [det[i] for i in range(det.shape[0]) if float(det[i].sum()) > 0 and
                  float((det[i] * z).sum()) / float(det[i].sum()) > 0.5]       # лежит в зоне замены
    if not found:
        del model, clip
        free("SAM выгружен")
        report.append("Точные края: нового человека SAM не нашла — вклейка по зоне маски")
        return None
    track = node("SAM3_VideoTrack", images=video, model=model, initial_mask=torch.stack(found, 0),
                 detection_threshold=0.5, max_objects=len(found), detect_interval=1)[0]
    masks = node("SAM3_TrackToMask", track_data=track, object_indices="")[0]
    del model, clip, track
    free("SAM выгружен")
    masks = (masks.float().cpu() > 0.5).float()
    if masks.shape[0] != video.shape[0] or float(masks.sum()) == 0:
        return None
    masks, _ = _fill_gaps(masks)
    return masks


def person_mask(frames, sam_name, who, threshold, expand_px, report, head=False):
    """→ маска [N,H,W] 0/1 (расширенная), картинка-проверка первого кадра и точная маска.
    head=True — «лицо и причёска»: маска только по голове выбранного человека, тело и одежда — из клипа."""
    send("Ищу человека / Finding the person")
    model, clip = node("CheckpointLoaderSimple", ckpt_name=sam_name)[:2]
    cond = node("CLIPTextEncode", clip=clip, text="person")[0]
    det = node("SAM3_Detect", model=model, image=frames[:1], conditioning=cond, threshold=float(threshold),
               refine_iterations=2, individual_masks=True)[0]
    if det.dim() == 2:
        det = det[None]
    det = (det.float().cpu() > 0.5).float()
    if det.shape[0] == 0 or float(det.sum()) == 0:
        free("SAM выгружен")
        raise FriendlyError(f"{TAG} В первом кадре не нашла человека. Возьми клип, где человек виден с первого кадра, "
                            f"или в ⚙ эксперте снизь «порог поиска».\n\nEN: No person found in the first frame. Use a "
                            f"clip where the person is visible from the start, or lower the detection threshold.")
    chosen = _pick(det, who)
    report.append(f"Людей в первом кадре: {det.shape[0]}, меняю: {len(chosen)} ({who.split(' / ')[0]})")
    init = det[chosen]
    if head:
        hcond = node("CLIPTextEncode", clip=clip, text="head")[0]
        hd = node("SAM3_Detect", model=model, image=frames[:1], conditioning=hcond, threshold=float(threshold),
                  refine_iterations=2, individual_masks=True)[0]
        if hd.dim() == 2:
            hd = hd[None]
        hd = (hd.float().cpu() > 0.5).float()
        init = _heads_for(init, list(hd))
        report.append(f"Только голова: голов в кадре {hd.shape[0]}, маска — по голове, тело и одежда из клипа")
    send("Веду маску по клипу / Tracking the person", 0, int(frames.shape[0]))
    track = node("SAM3_VideoTrack", images=frames, model=model, initial_mask=init,
                 detection_threshold=0.5, max_objects=len(chosen), detect_interval=1)[0]
    masks = node("SAM3_TrackToMask", track_data=track, object_indices="")[0]
    del model, clip, cond, track
    free("SAM выгружен")
    masks = (masks.float().cpu() > 0.5).float()
    if masks.shape[0] != frames.shape[0]:
        raise FriendlyError(f"{TAG} Маска и клип разной длины ({masks.shape[0]} и {frames.shape[0]}). Обнови ComfyUI.\n\n"
                            f"EN: Mask and clip lengths differ. Update ComfyUI.")
    masks, holes = _fill_gaps(masks)
    if holes:
        report.append(f"Трекер терял человека на {holes} кадрах — взяла маску соседних кадров")
    if float(masks.sum()) == 0:
        raise FriendlyError(f"{TAG} Трекер не удержал человека ни на одном кадре.\n\nEN: The tracker lost the person "
                            f"on every frame.")
    px = max(0, int(round(expand_px * min(masks.shape[1], masks.shape[2]) / 768.0)))
    grown = dilate(masks, px)
    share = float(grown.mean()) * 100
    report.append(f"Маска: расширена на {px} пикс., занимает {share:.0f}% кадра")
    preview = frames[:1].clone()
    tint = torch.tensor([1.0, 0.45, 0.1])
    preview[0] = preview[0] * (1 - 0.45 * grown[0, ..., None]) + tint * 0.45 * grown[0, ..., None]
    return grown, preview, masks


# ---------------- образец без оригинала: человек размыт ----------------

def blur_person(frames, mask, blur=0.5):
    """Идея Романа: ДО генерации спрятать облик исходного человека в видео-образце — модели нечего копировать.
    Размытие (лучшее из проверенных: чёрный, серый, скелет) прячет черты, но оставляет свет, тон, цвета одежды,
    положение и движение — модель вписывает человека с фото естественно и чётче.
    blur — сила: 1.0 черт не видно; ~0.4 и ниже — модель узнаёт оригинал и начинает его повторять."""
    m = mask[..., None]
    out = []
    for i in range(0, frames.shape[0], 16):
        c = frames[i:i + 16].movedim(-1, 1)
        k = max(3, int(round(min(c.shape[2], c.shape[3]) / 12 * max(0.05, float(blur)))) | 1)
        b = F.avg_pool2d(F.avg_pool2d(c, k, stride=1, padding=k // 2), k, stride=1, padding=k // 2)
        out.append(b.movedim(1, -1))
    return frames * (1 - m) + torch.cat(out, 0) * m


# ---------------- главное ----------------

def generate(frames, audio, photo, prompt, size_short, seed, steps, swap_strength, models, who, threshold,
             expand_px, keep_outside, feather_px, ref_quality, fast_attention, sound_original, head=False, blur=0.5,
             tight_edges=True):
    """frames [N,H,W,3] уже 24 к/с и обрезаны по сетке. → (кадры, звук, превью маски, отчёт)."""
    t0 = time.time()
    report = []
    n = int(frames.shape[0])
    w, h = canvas(int(frames.shape[2]), int(frames.shape[1]), size_short)
    report.append(f"Размер генерации {w}×{h}, {n} кадров ({n / FPS:.2f} с), {steps} шагов")
    free("перед стартом")

    send("Подготовка клипа / Preparing the clip")
    src = resize(frames, w, h)
    mask, preview, tight = person_mask(src, models["sam"], who, threshold, expand_px, report, head)
    ref = blur_person(src, mask, blur)
    report.append(f"Образец: {'голова' if head else 'человек'} размыт(а), сила {float(blur):.2f} — черт оригинала "
                  f"модель не видит, свет и движение остаются")
    preview = torch.cat([preview, ref[:1]], 0)

    # ---- 1. условия: текст + клип + фото + звук ----
    send("Текст и образцы / Text & references")
    clip = node("CLIPLoader", clip_name=models["clip"], type=CLIP_TYPE, device="default")[0]
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    avae = node("VAELoader", vae_name=models["vae_audio"])[0]
    params = {"clip": clip, "vae": vae, "audio_vae": avae, "prompt": prompt, "width": w, "height": h, "length": n,
              "ref_image_size": ref_quality, "ref_images": {"ref_image_0": photo[:1]},
              "ref_videos": {"ref_video_0": ref}}
    clip_audio = fit_audio(audio, n / FPS) if audio is not None else None
    if clip_audio is not None:
        params["ref_audios"] = {"ref_audio_0": clip_audio}
    positive, latent = node("MiniMaxH3ReferenceToVideo", **params)
    if clip_audio is not None:
        positive = node("MiniMaxH3AddGuide", positive=positive, latent=latent, frame_idx=0, audio_vae=avae,
                        audio=clip_audio)[0]
        report.append("Звук клипа — образец и цель (губы и движения ложатся на звук)")

    # ---- 2. дорисовка по маске: исходный клип в латенте, меняется только человек ----
    send("Кодирую клип / Encoding the clip")
    video_lat, audio_lat = latent["samples"].tensors
    src_lat = vae.encode(ref)                       # и в латенте под маской оригинала нет
    if tuple(src_lat.shape) != tuple(video_lat.shape):
        raise FriendlyError(f"{TAG} Размер латента клипа {tuple(src_lat.shape)} не совпал с ожидаемым "
                            f"{tuple(video_lat.shape)}. Обнови ComfyUI.\n\nEN: Clip latent shape mismatch. Update ComfyUI.")
    lat_mask = F.adaptive_max_pool3d(mask[None, None], tuple(video_lat.shape[2:]))        # [1,1,T,h,w]
    import comfy.nested_tensor as nt
    latent = {**latent, "samples": nt.NestedTensor((src_lat.to(video_lat.device, video_lat.dtype), audio_lat)),
              "noise_mask": nt.NestedTensor((lat_mask.to(video_lat.device), torch.ones_like(audio_lat)))}
    report.append(f"Дорисовка по маске: меняется {float(lat_mask.mean()) * 100:.0f}% латента, остальное — клип")
    del clip, vae, avae, src_lat
    free("текст и VAE выгружены")

    # ---- 3. генерация ----
    send("Загрузка модели / Loading model")
    model = node("UNETLoader", unet_name=models["unet"], weight_dtype="default")[0]
    model = node("MiniMaxH3SigmaShift", model=model, shift_video=SHIFT_VIDEO, shift_audio=SHIFT_AUDIO)[0]
    attn = ATTN_FAST if fast_attention else ATTN_FULL
    if has_node("ModelAttentionBackend"):
        try:
            model = node("ModelAttentionBackend", model=model, attention=attn)[0]
        except Exception as e:
            log.warning("%s внимание %s недоступно (%s)", TAG, attn, e)
            attn = "по умолчанию / default"
    model = lora(model, models["turbo_lora"], 1.0)
    model = lora(model, models["swap_lora"], float(swap_strength))
    report.append(f"Модель: {base(models['unet'])} · турбо ×1 · замена ×{float(swap_strength):g} · внимание: {attn}")
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
    free("модель выгружена")

    # ---- 4. раскодировка ----
    send("Раскодировка / Decoding")
    vae = node("VAELoader", vae_name=models["vae_video"])[0]
    video, how = decode_video(out, vae)
    if video.dim() == 5:
        video = video.reshape(-1, *video.shape[-3:])
    video = video.float().cpu()
    report.append("Раскодировка: " + how)
    del vae
    free("VAE выгружен")
    if sound_original and audio is not None:
        out_audio = fit_audio(audio, video.shape[0] / FPS)
        report.append("Звук: оригинал клипа, байт в байт")
    else:
        avae = node("VAELoader", vae_name=models["vae_audio"])[0]
        out_audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
        del avae
        free("аудио-VAE выгружен")
        report.append("Звук: сгенерирован H3" + ("" if audio is not None else " (в клипе звука не было)"))
    del out

    # ---- 5. наша правка: вне маски — настоящие пиксели клипа ----
    m = min(int(video.shape[0]), int(src.shape[0]))
    video, src_m, msk = video[:m], src[:m], mask[:m]
    if keep_outside:
        paste = msk
        fpx = max(0, int(round(feather_px * min(w, h) / 768.0)))
        if tight_edges:
            try:
                new = new_person_mask(video[:m, ..., :3].contiguous(), models["sam"], msk, threshold, head,
                                      report)
                if new is not None:
                    # мягкий переход — целиком СНАРУЖИ человека (по сгенерированному фону), а не по волосам:
                    # иначе край волос смешивается с фоном клипа и «плывёт»
                    edge = max(2, int(round(6 * min(w, h) / 768.0))) + fpx
                    paste = dilate(torch.maximum(tight[:m], new[:m]), edge, frames_r=1) * msk
                    report.append(f"Точные края: вклеиваю только человека ({float(paste.mean()) * 100:.0f}% кадра "
                                  f"вместо {float(msk.mean()) * 100:.0f}%), полоса запаса — снова клип")
            except Exception as e:
                free("после ошибки SAM")
                log.warning("%s точные края: %s", TAG, e)
                report.append(f"Точные края не вышли ({e}) — вклейка по зоне маски")
        soft = feather(paste, fpx)[..., None]
        video = src_m * (1 - soft) + video[..., :3] * soft
        report.append("Вне маски — настоящие пиксели клипа (фон как в оригинале)")
    report.append(f"Готово: {m} кадров за {time.time() - t0:.0f} с")
    send("Готово / Done", 1, 1)
    return video.clamp(0, 1), out_audio, preview, report
