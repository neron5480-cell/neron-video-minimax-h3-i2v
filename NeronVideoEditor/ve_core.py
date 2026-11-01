# -*- coding: utf-8 -*-
"""
Neron Video Editor — движок монтажа / editing engine.

RU: Здесь нет нейросети: только честная склейка кадров. Ведущее видео (видео 1)
    идёт как есть, кадр в кадр. Поверх него в нужные секунды проявляются
    картинки и куски из видео 2 и 3 — во весь кадр или в своей области.
    Всё, что вне события и вне области, остаётся оригиналом без изменений.
EN: No neural network here — plain frame compositing. The lead video (video 1)
    passes through frame by frame. Pictures and pieces of videos 2/3 appear on
    top at the chosen seconds, full frame or inside their own area. Everything
    outside an event and outside its area stays the untouched original.

Событие / event (координаты 0..1 от кадра / coordinates are 0..1 of the frame):
    {"kind": "picture"|"insert", "src": 1..4 | 2..3, "t": сек начала / start sec,
     "dur": длительность / duration, "s": начало в источнике (врезка) / source start,
     "tin": переход входа / in transition, "din": сек, "tout": выход / out, "dout": сек,
     "area": {"x","y","w","h","shape":"rect"|"ellipse","feather"} | None (весь кадр),
     "crop": {"x","y","w","h"} | None (участок источника), "fit": "cover"|"contain",
     "match": bool (подогнать цвет), "opacity": 0..1, "sound": bool (звук врезки)}
"""

import math

import numpy as np
import torch
import torch.nn.functional as F

TRANSITIONS = ("cut", "dissolve", "reveal", "wipe", "dip")
DEFAULT_FPS = 24.0
MAX_EVENTS = 32


# ---------------------------------------------------------------- проверка данных
def _f(v, d, lo=None, hi=None):
    try:
        x = float(v)
        if not math.isfinite(x):
            x = d
    except Exception:
        x = d
    if lo is not None:
        x = max(lo, x)
    if hi is not None:
        x = min(hi, x)
    return x


def _box(b, allow_none=True):
    if not isinstance(b, dict):
        return None if allow_none else {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    x = _f(b.get("x"), 0.0, -1.0, 1.0)
    y = _f(b.get("y"), 0.0, -1.0, 1.0)
    w = _f(b.get("w"), 1.0, 0.02, 2.0)
    h = _f(b.get("h"), 1.0, 0.02, 2.0)
    out = {"x": x, "y": y, "w": w, "h": h}
    out["shape"] = "ellipse" if b.get("shape") == "ellipse" else "rect"
    out["feather"] = _f(b.get("feather"), 0.04, 0.0, 0.5)
    out["rot"] = _f(b.get("rot"), 0.0, -180.0, 180.0)
    return out


def norm_event(e):
    if not isinstance(e, dict):
        return None
    kind = e.get("kind")
    if kind not in ("picture", "insert"):
        return None
    ev = {
        "kind": kind,
        "src": int(_f(e.get("src"), 1 if kind == "picture" else 2, 1, 4)),
        "t": _f(e.get("t"), 0.0, 0.0, 36000.0),
        "dur": _f(e.get("dur"), 3.0, 0.04, 36000.0),
        "s": _f(e.get("s"), 0.0, 0.0, 36000.0),
        "tin": e.get("tin") if e.get("tin") in TRANSITIONS else "dissolve",
        "tout": e.get("tout") if e.get("tout") in TRANSITIONS else "dissolve",
        "din": _f(e.get("din"), 1.0, 0.0, 30.0),
        "dout": _f(e.get("dout"), 1.0, 0.0, 30.0),
        "area": _box(e.get("area")),
        "crop": _box(e.get("crop")),
        "fit": "contain" if e.get("fit") == "contain" else "cover",
        "match": bool(e.get("match", False)),
        "match_k": _f(e.get("match_k"), 0.7, 0.0, 1.0),
        "opacity": _f(e.get("opacity"), 1.0, 0.0, 1.0),
        "sound": bool(e.get("sound", False)),
        "speed": _f(e.get("speed"), 1.0, 0.1, 8.0),
        "off": bool(e.get("off", False)),
    }
    if kind == "insert":
        ev["src"] = int(_f(e.get("src"), 2, 2, 3))
    # переходы не длиннее самого события / transitions never longer than the event
    if ev["tin"] == "cut":
        ev["din"] = 0.0
    if ev["tout"] == "cut":
        ev["dout"] = 0.0
    tot = ev["din"] + ev["dout"]
    if tot > ev["dur"] and tot > 0:
        k = ev["dur"] / tot
        ev["din"] *= k
        ev["dout"] *= k
    return ev


def norm_state(state):
    if not isinstance(state, dict):
        state = {}
    evs = [norm_event(e) for e in (state.get("events") or [])[:MAX_EVENTS]]
    return {
        "events": [e for e in evs if e and not e["off"]],
        "audio": state.get("audio") if state.get("audio") in ("main", "external", "mix", "none") else "main",
        "ext_gain": _f(state.get("ext_gain"), 1.0, 0.0, 2.0),
        "main_gain": _f(state.get("main_gain"), 1.0, 0.0, 2.0),
        "fps1": _f(state.get("fps1"), 0.0, 0.0, 240.0),   # эксперт: свой fps видео 1 / expert override
    }


# ---------------------------------------------------------------- время / timing
def phase(ev, t):
    """Где событие во времени: None — неактивно; иначе (стадия, p 0..1).
    stage: 'in' — входит, 'hold' — на экране, 'out' — уходит."""
    t0, t1 = ev["t"], ev["t"] + ev["dur"]
    if t < t0 or t >= t1:
        return None
    if ev["din"] > 0 and t < t0 + ev["din"]:
        return "in", (t - t0) / ev["din"]
    if ev["dout"] > 0 and t >= t1 - ev["dout"]:
        return "out", (t1 - t) / ev["dout"]
    return "hold", 1.0


def envelope(ev, t):
    """Общая сила события 0..1 (для звука и простых переходов)."""
    ph = phase(ev, t)
    if ph is None:
        return 0.0
    stage, p = ph
    if stage == "hold":
        return 1.0
    return _smooth(p)


def _smooth(p):
    p = max(0.0, min(1.0, p))
    return p * p * (3.0 - 2.0 * p)


# ---------------------------------------------------------------- маски / masks
def area_mask(area, H, W, device):
    """Маска области 0..1 размером HxW (мягкий край). None → весь кадр."""
    if area is None:
        return torch.ones((H, W), device=device)
    ys = (torch.arange(H, device=device, dtype=torch.float32) + 0.5) / H
    xs = (torch.arange(W, device=device, dtype=torch.float32) + 0.5) / W
    yy, xx = torch.meshgrid(ys, xs, indexing="ij")
    cx, cy = area["x"] + area["w"] / 2, area["y"] + area["h"] / 2
    hw, hh = max(area["w"] / 2, 1e-4), max(area["h"] / 2, 1e-4)
    dx, dy = xx - cx, yy - cy
    rot = math.radians(area.get("rot", 0.0))
    if rot:
        # кадр не квадратный: поворот считаем в пикселях / rotate in pixel space
        ax = W / max(H, W)
        ay = H / max(H, W)
        px, py = dx * ax, dy * ay
        c, s = math.cos(-rot), math.sin(-rot)
        dx, dy = (px * c - py * s) / ax, (px * s + py * c) / ay
    fe = max(area.get("feather", 0.0), 1e-4)
    if area.get("shape") == "ellipse":
        r = torch.sqrt((dx / hw) ** 2 + (dy / hh) ** 2)
        # мягкий край внутрь: feather в долях от меньшей полуоси / soft edge inward
        k = fe / max(min(hw, hh), 1e-4)
        m = torch.clamp((1.0 - r) / max(k, 1e-4), 0.0, 1.0)
    else:
        mx = torch.clamp((hw - dx.abs()) / fe, 0.0, 1.0)
        my = torch.clamp((hh - dy.abs()) / fe, 0.0, 1.0)
        m = mx * my
    return m * m * (3.0 - 2.0 * m)


# ---------------------------------------------------------------- слой в коробку / layer into box
def _crop(img, crop):
    """img: [H,W,3]. Участок источника (0..1)."""
    if crop is None:
        return img
    H, W = img.shape[0], img.shape[1]
    x0 = int(round(max(0.0, crop["x"]) * W))
    y0 = int(round(max(0.0, crop["y"]) * H))
    x1 = int(round(min(1.0, crop["x"] + crop["w"]) * W))
    y1 = int(round(min(1.0, crop["y"] + crop["h"]) * H))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return img
    return img[y0:y1, x0:x1]


def _resize(img, h, w):
    h, w = max(1, int(h)), max(1, int(w))
    if img.shape[0] == h and img.shape[1] == w:
        return img
    x = img.permute(2, 0, 1).unsqueeze(0)
    down = h < img.shape[0] or w < img.shape[1]
    x = F.interpolate(x, size=(h, w), mode="bilinear", align_corners=False, antialias=down)
    return x.squeeze(0).permute(1, 2, 0)


def place(img, box, fit, H, W):
    """Кладёт картинку img в коробку box кадра HxW.
    Возвращает (слой [H,W,3], покрытие [H,W] — где у слоя есть картинка)."""
    dev = img.device
    b = box or {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    bx, by = b["x"] * W, b["y"] * H
    bw, bh = max(2.0, b["w"] * W), max(2.0, b["h"] * H)
    ih, iw = img.shape[0], img.shape[1]
    if fit == "contain":
        k = min(bw / iw, bh / ih)
    else:
        k = max(bw / iw, bh / ih)
    tw, th = max(1, round(iw * k)), max(1, round(ih * k))
    small = _resize(img, th, tw)
    # где картинка встанет в кадре / where it lands in the frame
    ox = int(round(bx + (bw - tw) / 2))
    oy = int(round(by + (bh - th) / 2))
    layer = torch.zeros((H, W, 3), device=dev, dtype=img.dtype)
    cover = torch.zeros((H, W), device=dev, dtype=img.dtype)
    # пересечение с кадром и с коробкой / clip to frame and to the box
    x0 = max(ox, int(math.floor(bx)), 0)
    y0 = max(oy, int(math.floor(by)), 0)
    x1 = min(ox + tw, int(math.ceil(bx + bw)), W)
    y1 = min(oy + th, int(math.ceil(by + bh)), H)
    if x1 > x0 and y1 > y0:
        layer[y0:y1, x0:x1] = small[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        cover[y0:y1, x0:x1] = 1.0
    return layer, cover


# ---------------------------------------------------------------- цвет / colour
def color_fit(src_stats, dst_stats, k):
    """Перенос среднего и разброса по каналам: врезка подстраивается под сцену."""
    (sm, ss), (dm, ds) = src_stats, dst_stats
    scale = torch.clamp(ds / torch.clamp(ss, min=1e-3), 0.5, 2.0)
    scale = 1.0 + (scale - 1.0) * k
    # x' = (x - sm) * scale + sm + (dm - sm) * k
    return lambda x: torch.clamp((x - sm) * scale + sm + (dm - sm) * k, 0.0, 1.0)


def masked_stats(img, mask):
    w = mask.unsqueeze(-1)
    tot = torch.clamp(w.sum(), min=1.0)
    m = (img * w).sum(dim=(0, 1)) / tot
    v = (((img - m) ** 2) * w).sum(dim=(0, 1)) / tot
    return m, torch.sqrt(v + 1e-8)


# ---------------------------------------------------------------- переходы / transitions
def _luma(x):
    return x[..., 0] * 0.299 + x[..., 1] * 0.587 + x[..., 2] * 0.114


def trans_alpha(kind, p, layer, H, W, device, entering):
    """Сила слоя по пикселям для перехода. p: 0 → слоя нет, 1 → слой целиком.
    Возвращает (alpha [H,W] или число, затемнение базы 0..1)."""
    p = max(0.0, min(1.0, p))
    if kind == "cut":
        return 1.0, 0.0
    if kind == "dissolve":
        return _smooth(p), 0.0
    if kind == "dip":
        # через затемнение: база гаснет, потом проявляется слой / through black
        if p < 0.5:
            return 0.0, _smooth(p * 2.0)
        return _smooth((p - 0.5) * 2.0), 1.0 - _smooth((p - 0.5) * 2.0)
    soft = 0.22
    if kind == "wipe":
        xs = (torch.arange(W, device=device, dtype=torch.float32) + 0.5) / W
        key = xs.unsqueeze(0).expand(H, W)
        if not entering:
            key = 1.0 - key        # уходит в ту же сторону / leaves the same way
    else:  # reveal: сначала проявляются тёмные линии (карандаш) / dark strokes first
        key = _luma(layer)
    a = torch.clamp((p * (1.0 + soft) - key) / soft, 0.0, 1.0)
    return a, 0.0


# ---------------------------------------------------------------- сборка / render
class Source:
    """Кадры источника + его fps. frames: тензор [N,H,W,C] (на CPU)."""

    def __init__(self, frames, fps):
        self.frames = frames
        self.fps = float(fps) if fps and fps > 0 else DEFAULT_FPS
        self.n = int(frames.shape[0])

    def at(self, sec):
        i = int(math.floor(sec * self.fps + 1e-6))
        return self.frames[max(0, min(self.n - 1, i))]


def _rgb(x):
    x = x[..., :3]
    if x.shape[-1] == 1:
        x = x.expand(*x.shape[:-1], 3)
    return x.float()


def render(state, main, videos, images, device, progress=None):
    """main: Source видео 1. videos: {2: Source, 3: Source}. images: {1..4: [H,W,3]}.
    Возвращает тензор кадров [N,H,W,3] на CPU — та же длина и размер, что у видео 1."""
    N = main.n
    H, W = int(main.frames.shape[1]), int(main.frames.shape[2])
    out = torch.empty((N, H, W, 3), dtype=torch.float32)
    evs = []
    for ev in state["events"]:
        if ev["kind"] == "picture" and ev["src"] not in images:
            continue
        if ev["kind"] == "insert" and ev["src"] not in videos:
            continue
        evs.append(ev)

    masks = {}
    cache = {}         # картинка, уже уложенная в коробку / picture already placed
    colors = {}

    def layer_for(k, ev, t):
        if ev["kind"] == "picture":
            if k not in cache:
                img = _rgb(images[ev["src"]]).to(device)
                cache[k] = place(_crop(img, ev["crop"]), ev["area"], ev["fit"], H, W)
            return cache[k]
        src = videos[ev["src"]]
        st = ev["s"] + (t - ev["t"]) * ev["speed"]
        img = _rgb(src.at(st)).to(device)
        return place(_crop(img, ev["crop"]), ev["area"], ev["fit"], H, W)

    for i in range(N):
        t = i / main.fps
        base = _rgb(main.frames[i]).to(device)
        frame = base
        for k, ev in enumerate(evs):
            ph = phase(ev, t)
            if ph is None:
                continue
            stage, p = ph
            layer, cover = layer_for(k, ev, t)
            if k not in masks:
                masks[k] = area_mask(ev["area"], H, W, device)
            m = masks[k] * cover * ev["opacity"]
            if ev["match"]:
                if k not in colors:
                    colors[k] = color_fit(masked_stats(layer, m), masked_stats(frame, m), ev["match_k"])
                layer = colors[k](layer)
            kind = ev["tin"] if stage == "in" else ev["tout"] if stage == "out" else "cut"
            a, dark = trans_alpha(kind, p if stage != "hold" else 1.0, layer, H, W, device, stage != "out")
            if dark:
                # затемнение только внутри области события / darken only inside the area
                frame = frame * (1.0 - (masks[k] * cover * dark).unsqueeze(-1))
            mm = (m * a) if torch.is_tensor(a) else (m * float(a))
            frame = frame * (1.0 - mm.unsqueeze(-1)) + layer * mm.unsqueeze(-1)
        out[i] = frame.clamp(0.0, 1.0).cpu()
        if progress and (i % 8 == 0 or i == N - 1):
            progress(i + 1, N)
    return out


# ---------------------------------------------------------------- звук / audio
def _audio_np(audio):
    """AUDIO ComfyUI → (np [C,S] float32, sr).
    Load Video (VHS) отдаёт «ленивый» словарь (Mapping) — читаем через ключи.
    VHS passes a lazy Mapping, so read it by key, not by isinstance(dict)."""
    if audio is None:
        return None
    try:
        wf = audio["waveform"]
        sr = audio["sample_rate"]
    except Exception:
        return None
    if wf is None:
        return None
    if hasattr(wf, "detach"):
        wf = wf.detach().cpu().float().numpy()
    wf = np.asarray(wf, dtype=np.float32)
    if wf.ndim == 3:
        wf = wf[0]
    if wf.ndim == 1:
        wf = wf[None]
    if wf.size == 0:
        return None
    return wf, int(sr or 44100)


def _stereo(x):
    if x.shape[0] == 1:
        return np.repeat(x, 2, axis=0)
    return x[:2]


def _resample(x, sr, to_sr):
    if sr == to_sr or x.shape[1] < 2:
        return x
    n = max(1, int(round(x.shape[1] * to_sr / sr)))
    try:
        import torchaudio.functional as AF
        return AF.resample(torch.from_numpy(np.ascontiguousarray(x)), sr, to_sr).numpy()[:, :n]
    except Exception:
        src = np.linspace(0.0, 1.0, x.shape[1])
        dst = np.linspace(0.0, 1.0, n)
        return np.stack([np.interp(dst, src, c) for c in x]).astype(np.float32)


def _fit_len(x, n):
    if x.shape[1] >= n:
        return x[:, :n]
    return np.pad(x, ((0, 0), (0, n - x.shape[1])))


def mix_audio(state, duration, main_audio, video_audio, ext_audio, sr=44100):
    """Звук итогового ролика: длина = длина видео 1.
    video_audio: {2: AUDIO, 3: AUDIO} — для врезок со звуком."""
    n = max(1, int(round(duration * sr)))

    def prep(a):
        r = _audio_np(a)
        if r is None:
            return None
        x, asr = r
        return _stereo(_resample(_stereo(x), asr, sr)).astype(np.float32)

    main = prep(main_audio)
    ext = prep(ext_audio)
    mode = state["audio"]
    out = np.zeros((2, n), dtype=np.float32)
    if mode in ("main", "mix") and main is not None:
        out += _fit_len(main, n) * state["main_gain"]
    if mode in ("external", "mix") and ext is not None:
        out += _fit_len(ext, n) * state["ext_gain"]
    if mode == "external" and ext is None and main is not None:
        out += _fit_len(main, n) * state["main_gain"]   # внешнего нет — оставляем родной / fallback

    # врезки со звуком: плавно перехватывают звук на время события
    times = np.arange(n, dtype=np.float64) / sr
    for ev in state["events"]:
        if ev["kind"] != "insert" or not ev["sound"]:
            continue
        a = prep(video_audio.get(ev["src"]))
        if a is None:
            continue
        i0 = int(round(ev["t"] * sr))
        i1 = min(n, int(round((ev["t"] + ev["dur"]) * sr)))
        if i1 <= i0:
            continue
        seg_t = times[i0:i1]
        env = np.array([envelope(ev, float(tt)) for tt in seg_t[:: max(1, sr // 200)]], dtype=np.float32)
        env = np.interp(np.arange(i1 - i0), np.arange(0, i1 - i0, max(1, sr // 200))[: len(env)], env).astype(np.float32)
        s0 = int(round(ev["s"] * sr))
        if ev["speed"] != 1.0:
            idx = (s0 + (np.arange(i1 - i0) * ev["speed"])).astype(np.int64)
            idx = np.clip(idx, 0, a.shape[1] - 1)
            seg = a[:, idx]
        else:
            seg = _fit_len(a[:, s0:], i1 - i0)
        out[:, i0:i1] = out[:, i0:i1] * (1.0 - env) + seg * env
    peak = float(np.abs(out).max()) if out.size else 0.0
    if peak > 1.0:
        out /= peak
    return {"waveform": torch.from_numpy(out).unsqueeze(0), "sample_rate": sr}
