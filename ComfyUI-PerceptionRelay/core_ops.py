# -*- coding: utf-8 -*-
"""Общие операции на torch: размытие, цвет, перенос по потоку, маски точек внимания."""
import math

import numpy as np
import torch
import torch.nn.functional as F


def device():
    try:
        import comfy.model_management as mm
        return mm.get_torch_device()
    except Exception:
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def free_vram():
    try:
        import comfy.model_management as mm
        mm.soft_empty_cache()
    except Exception:
        pass
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def to_t(frame, dev):
    """numpy [H,W,3] -> torch [1,3,H,W]"""
    return torch.from_numpy(np.ascontiguousarray(frame)).to(dev).permute(2, 0, 1).unsqueeze(0)


def to_np(t):
    return t.squeeze(0).permute(1, 2, 0).clamp(0, 1).float().cpu().numpy()


_KCACHE = {}


def _kernel(sigma, dev):
    key = (round(float(sigma), 4), str(dev))
    k = _KCACHE.get(key)
    if k is None:
        r = max(1, int(math.ceil(sigma * 3)))
        x = torch.arange(-r, r + 1, dtype=torch.float32, device=dev)
        k = torch.exp(-(x * x) / (2 * sigma * sigma))
        k = k / k.sum()
        _KCACHE[key] = k
    return k


def blur(x, sigma):
    """Гауссово размытие [B,C,H,W], отражение на краях."""
    if sigma <= 0.01:
        return x
    k = _kernel(sigma, x.device)
    r = (k.numel() - 1) // 2
    c = x.shape[1]
    kh = k.view(1, 1, 1, -1).repeat(c, 1, 1, 1)
    kv = k.view(1, 1, -1, 1).repeat(c, 1, 1, 1)
    mode = "reflect" if (x.shape[-1] > r and x.shape[-2] > r) else "replicate"
    x = F.conv2d(F.pad(x, (r, r, 0, 0), mode=mode), kh, groups=c)
    x = F.conv2d(F.pad(x, (0, 0, r, r), mode=mode), kv, groups=c)
    return x


# BT.709, полный диапазон — внутренняя кухня, туда-обратно без потерь
def rgb_to_ycc(x):
    r, g, b = x[:, 0:1], x[:, 1:2], x[:, 2:3]
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    cb = (b - y) / 1.8556
    cr = (r - y) / 1.5748
    return y, torch.cat([cb, cr], 1)


def ycc_to_rgb(y, c):
    cb, cr = c[:, 0:1], c[:, 1:2]
    r = y + 1.5748 * cr
    b = y + 1.8556 * cb
    g = (y - 0.2126 * r - 0.0722 * b) / 0.7152
    return torch.cat([r, g, b], 1)


def _base_grid(h, w, dev):
    ys, xs = torch.meshgrid(torch.arange(h, device=dev, dtype=torch.float32),
                            torch.arange(w, device=dev, dtype=torch.float32), indexing="ij")
    return xs, ys


def warp(img, flow, mode="bilinear"):
    """Берём img в точках x+flow. img [1,C,H,W], flow [1,2,H,W] в пикселях.
    mode="bicubic" — для картинок: билинейная интерполяция сама мылит, бикубика держит резкость.
    Возвращает (результат, маска «точка внутри кадра»)."""
    _, _, h, w = img.shape
    xs, ys = _base_grid(h, w, img.device)
    gx = xs + flow[:, 0]
    gy = ys + flow[:, 1]
    inside = ((gx >= 0) & (gx <= w - 1) & (gy >= 0) & (gy <= h - 1)).float().unsqueeze(1)
    grid = torch.stack([2 * gx / max(w - 1, 1) - 1, 2 * gy / max(h - 1, 1) - 1], dim=-1)
    out = F.grid_sample(img, grid, mode=mode, padding_mode="border", align_corners=True)
    return out, inside


def compose(f1, f2):
    """Поток t->a (f1) и a->b (f2) → поток t->b."""
    f2w, inside = warp(f2, f1)
    return f1 + f2w, inside


def upsample_flow(flow, h, w):
    fh, fw = flow.shape[-2:]
    if fh == h and fw == w:
        return flow
    up = F.interpolate(flow, size=(h, w), mode="bilinear", align_corners=False)
    up[:, 0] *= w / fw
    up[:, 1] *= h / fh
    return up


def upsample_map(m, h, w):
    if m.shape[-2:] == (h, w):
        return m
    return F.interpolate(m, size=(h, w), mode="bilinear", align_corners=False)


def local_minmax(x, r=1):
    k = 2 * r + 1
    mx = F.max_pool2d(F.pad(x, (r, r, r, r), mode="replicate"), k, stride=1)
    mn = -F.max_pool2d(F.pad(-x, (r, r, r, r), mode="replicate"), k, stride=1)
    return mn, mx


def gradient_mag(y):
    gx = y[..., :, 2:] - y[..., :, :-2]
    gy = y[..., 2:, :] - y[..., :-2, :]
    gx = F.pad(gx, (1, 1, 0, 0), mode="replicate")
    gy = F.pad(gy, (0, 0, 1, 1), mode="replicate")
    return torch.sqrt(gx * gx + gy * gy + 1e-12) * 0.5


# ---------- маски точек внимания (из данных разведки) ----------
# строка лица: x, y, w, h, глаз_пр(x,y), глаз_лев(x,y), нос(x,y), рот_пр(x,y), рот_лев(x,y), score

def _ellipse_r(xs, ys, cx, cy, ax, ay, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = xs - cx, ys - cy
    u = (dx * ca + dy * sa) / max(ax, 1e-3)
    v = (-dx * sa + dy * ca) / max(ay, 1e-3)
    return torch.sqrt(u * u + v * v)


def _smooth_inside(r, inner=0.55, outer=1.0):
    t = ((outer - r) / max(outer - inner, 1e-3)).clamp(0, 1)
    return t * t * (3 - 2 * t)


def face_masks(faces, h, w, dev):
    """Возвращает (глаза, лицо, контур) — [1,1,H,W] от 0 до 1."""
    eyes = torch.zeros(1, 1, h, w, device=dev)
    face = torch.zeros(1, 1, h, w, device=dev)
    ring = torch.zeros(1, 1, h, w, device=dev)
    if faces is None or len(faces) == 0:
        return eyes, face, ring
    xs, ys = _base_grid(h, w, dev)
    for f in faces:
        x, y, fw, fh = [float(v) for v in f[0:4]]
        rex, rey, lex, ley = [float(v) for v in f[4:8]]
        d = math.hypot(lex - rex, ley - rey)
        if d < 2:
            continue
        ang = math.atan2(ley - rey, lex - rex)
        for ex, ey in ((rex, rey), (lex, ley)):
            r = _ellipse_r(xs, ys, ex, ey, 0.30 * d, 0.19 * d, ang)
            eyes = torch.maximum(eyes, _smooth_inside(r, 0.5, 1.0)[None, None])
        cx, cy = x + fw / 2, y + fh / 2
        r = _ellipse_r(xs, ys, cx, cy, 0.56 * fw, 0.62 * fh, ang)
        face = torch.maximum(face, _smooth_inside(r, 0.75, 1.15)[None, None])
        rg = torch.exp(-((r - 0.97) / 0.13) ** 2)
        ring = torch.maximum(ring, rg[None, None])
    return eyes, face, ring


# ---------- guided filter: цвет по краям яркости ----------

def box(x, r):
    k = 2 * r + 1
    mode = "reflect" if (x.shape[-1] > r and x.shape[-2] > r) else "replicate"
    return F.avg_pool2d(F.pad(x, (r, r, r, r), mode=mode), k, stride=1)


def guided_joint(guide, src, r, eps):
    """Guided filter (He et al.): src сглаживается, но его края подстраиваются под края guide.
    guide [1,1,H,W] (яркость), src [1,C,H,W] (цвет)."""
    mi = box(guide, r)
    vi = box(guide * guide, r) - mi * mi
    ms = box(src, r)
    cov = box(guide * src, r) - mi * ms
    a = cov / (vi + eps)
    b = ms - a * mi
    return box(a, r) * guide + box(b, r)
