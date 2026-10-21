# -*- coding: utf-8 -*-
"""Покадровое ядро: каждый этап как функция «обработать один кадр (с памятью о прошлом)».

Эти функции зовут и ноды полного прогона, и живое окно Пульта — поэтому живой кадр
и итоговое видео считаются одной и той же математикой и не могут разойтись.
"""
import math

import torch
import torch.nn.functional as F

from . import core_ops


# ---------- Огранка ----------

def edge_frame(x, t, P, faces, flows, prev_delta, h, w, dev):
    """→ (кадр, y до, y после, перепад, сырая добавка для следующего кадра)"""
    from .node_edge import rcas
    y, c = core_ops.rgb_to_ycc(x)
    ys = y
    for _ in range(int(P["passes"])):
        ys = rcas(ys.clamp(0, 1), P["strength"], P["denoise"])
    g1 = core_ops.blur(y, 1.0)
    gm = core_ops.gradient_mag(g1)
    edge = (gm / P["edge_level"]).clamp(0, 1)
    edge = F.max_pool2d(edge, 3, stride=1, padding=1)
    mask = edge + (1 - edge) * P["texture_keep"]
    if faces is not None and t in faces:
        _, face, _ = core_ops.face_masks(faces[t], h, w, dev)
        mask = mask * (1 - face)
    delta = mask * (ys - y)
    raw_delta = delta
    # точим только то, что держится во времени (minmod с добавкой прошлого кадра по потоку)
    if P["temporal"] > 0 and flows is not None and prev_delta is not None:
        fl = flows.to(t, -1)
        if fl is not None:
            flow, conf = fl
            pd, ins = core_ops.warp(prev_delta, flow, "bicubic")
            same = (delta * pd) > 0
            common = torch.where(same, torch.sign(delta) * torch.minimum(delta.abs(), pd.abs()),
                                 torch.zeros_like(delta))
            wgt = (conf * ins * P["temporal"]).clamp(0, 1)
            delta = delta + wgt * (common - delta)
    y_o = y + delta
    return core_ops.ycc_to_rgb(y_o, c), y, y_o, gm, raw_delta


# ---------- Тональный скелет ----------

def tone_frame(x, t, P, faces, flows, state, anchor, target, h, w, dev, ts=1):
    """state — {"prev_b", "cast_ema"} (память между кадрами). anchor/target — опора чёрного кадра.
    → (кадр, y, c, y_out, c_out, m_sh, дрожь света или None)"""
    from .node_tone import guided_self, _band, EPS, STOP
    r = P["light_scale"] or max(4, int(round(min(w, h) / 60)))
    y, c = core_ops.rgb_to_ycc(x)
    y = y.clamp(0, 1)
    L = torch.log(y + EPS)
    B = guided_self(L, r, P["edge_keep"] ** 2)
    D = L - B
    jitter = None
    prev_b = state.get("prev_b")
    if flows is not None and prev_b is not None and P["temporal"] > 0:
        fl = flows.to(t, -1)
        if fl is not None:
            flow, conf = fl
            pb, ins = core_ops.warp(prev_b, flow)
            agree = torch.exp(-((B - pb) / 0.08) ** 2)
            sh_zone = _band(torch.exp(B) - EPS, 0.0, 0.4)
            k = (P["temporal"] * conf * ins * agree * sh_zone).clamp(0, 0.95)
            jitter = float(((B - pb).abs() * conf * ins).mean())
            B = B + k * (pb - B)
    state["prev_b"] = B
    s = torch.exp(B) - EPS
    Bn = B.clone()
    if P["stabilize_black"] > 0 and anchor is not None:
        shift = (target - anchor) * P["stabilize_black"]
        Bn = Bn + _band(s, 0.0, 0.08) * (torch.log((s + shift).clamp(min=0) + EPS) - B)
    if P["black_point"] != 0:
        off = 0.03 * P["black_point"]
        s2 = ((s - off) / (1 - off)).clamp(min=0) if off > 0 else (s - off) / (1 - off)
        Bn = Bn + _band(s, 0.0, 0.25) * (torch.log(s2 + EPS) - torch.log(s + EPS))
    if P["black_density"] > 0:
        pivot = math.log(0.08 + EPS)
        Bn = Bn + P["black_density"] * _band(s, 0.0, 0.08) * (B - pivot) * 0.6
    for val, lo, hi in ((P["deep_shadows"], 0.0, 0.05), (P["shadows"], 0.05, 0.16),
                        (P["transition"], 0.16, 0.38)):
        if val != 0:
            Bn = Bn + val * STOP * _band(s, lo, hi)
    if faces is not None and P["face_fill"] > 0:
        ft = int(round(t / ts)) if ts != 1 else t
        if ft in faces:
            _, face, _ = core_ops.face_masks(faces[ft], h, w, dev)
            Bn = Bn + P["face_fill"] * STOP * face * _band(s, 0.0, 0.3)
    y_out = (torch.exp(Bn + D) - EPS).clamp(0, 1)
    c_out = c * ((y_out + EPS) / (y + EPS)).clamp(0, 4)
    m_sh = _band(s, 0.0, 0.25)
    if P["shadow_neutral"] > 0:
        m_mid = _band(s, 0.25, 0.65)
        tint = (c * m_mid).sum((2, 3), keepdim=True) / ((y * m_mid).sum() + 1e-6)
        wsum = m_sh.sum() + 1e-6
        sh_c = (c_out * m_sh).sum((2, 3), keepdim=True) / wsum
        tn = torch.sqrt((tint ** 2).sum(1, keepdim=True))
        if float(tn) > 0.02:
            t_hat = tint / tn
            cast = sh_c - (sh_c * t_hat).sum(1, keepdim=True) * t_hat
        else:
            cast = sh_c
        ce = state.get("cast_ema")
        ce = cast if ce is None else ce + 0.15 * (cast - ce)
        state["cast_ema"] = ce
        c_out = c_out - P["shadow_neutral"] * m_sh * ce
    if P["shadow_saturation"] != 0:
        c_out = c_out * (1 + P["shadow_saturation"] * 0.6 * m_sh)
    return core_ops.ycc_to_rgb(y_out, c_out), y, c, y_out, c_out, m_sh, jitter


# ---------- Цветовой шов ----------

def seam_frame(x, t, P, flows, prev_delta):
    """→ (кадр, y до, y после, сырая добавка для следующего кадра)"""
    from .node_seam import narrow_edges
    y, c = core_ops.rgb_to_ycc(x)
    y = y.clamp(0, 1)
    delta = narrow_edges(y, P["narrow"], P["narrow_radius"], P["edge_level"]) if P["narrow"] > 0 \
        else torch.zeros_like(y)
    raw = delta
    if P["temporal"] > 0 and flows is not None and prev_delta is not None:
        fl = flows.to(t, -1)
        if fl is not None:
            flow, conf = fl
            pd, ins = core_ops.warp(prev_delta, flow, "bicubic")
            same = (delta * pd) > 0
            common = torch.where(same, torch.sign(delta) * torch.minimum(delta.abs(), pd.abs()),
                                 torch.zeros_like(delta))
            k = (conf * ins * P["temporal"]).clamp(0, 1)
            delta = delta + k * (common - delta)
    y2 = (y + delta).clamp(0, 1)
    c1 = c * ((y2 + 0.004) / (y + 0.004)).clamp(0, 4)
    c2 = c1
    if P["color_snap"] > 0:
        snapped = core_ops.guided_joint(y2, c1, P["snap_radius"], 1e-4)
        c2 = c1 + P["color_snap"] * (snapped - c1)
    return core_ops.ycc_to_rgb(y2, c2), y, y2, raw


# ---------- Полировка: свет и тени (без плавности) ----------

def polish_tone(x, P):
    y, c = core_ops.rgb_to_ycc(x)
    if P["exposure"] != 1.0:
        y = y * P["exposure"]
        c = c * P["exposure"]
    if P["shadow_contrast"] > 0 or P["shadow_depth"] != 0:
        y_before = y
        base = core_ops.blur(y, 12.0)
        t = ((P["shadow_level"] - base) / P["shadow_level"]).clamp(0, 1)
        m_sh = t * t * (3 - 2 * t)
        if P["shadow_contrast"] > 0:
            y = y + P["shadow_contrast"] * m_sh * (core_ops.blur(y, 2.0) - base)
        if P["shadow_depth"] != 0:
            y = y - P["shadow_depth"] * m_sh * y * 0.6
        c = c * ((y.clamp(0, 1) + 0.004) / (y_before.clamp(0, 1) + 0.004)).clamp(0, 4)
    if P["saturation"] != 1.0:
        c = c * P["saturation"]
    return core_ops.ycc_to_rgb(y.clamp(0, 1), c)


# ---------- Точки внимания (+ зерно) ----------

def points_frame(x, P, face_rows, t, h, w, dev, gen=None):
    """face_rows — лица этого кадра (или None). → (кадр, были ли точки)"""
    from .node_finish import _sharpen_clamped
    y, c = core_ops.rgb_to_ycc(x)
    used = False
    if face_rows is not None and (P["eye_sharp"] + P["eye_contrast"] + P["contour_sharp"]) > 0:
        eyes, _, ring = core_ops.face_masks(face_rows, h, w, dev)
        if P["eye_contrast"] > 0:
            lc = y + P["eye_contrast"] * (y - core_ops.blur(y, 6.0))
            y = y + eyes * (lc.clamp(0, 1) - y)
        sharp = _sharpen_clamped(y, 1.0, 1.0)
        edge = (core_ops.gradient_mag(core_ops.blur(y, 1.0)) / 0.04).clamp(0, 1)
        amt = eyes * P["eye_sharp"] + ring * edge * P["contour_sharp"]
        y = y + amt * (sharp - y)
        used = True
    if P["grain"] > 0:
        if gen is None:
            gen = torch.Generator(device="cpu")
        gen.manual_seed(int(P["seed"]) * 100003 + t)
        g = torch.randn(1, 1, h, w, generator=gen).to(dev)
        if P["grain_size"] > 0.05:
            g = core_ops.blur(g, P["grain_size"])
            g = g / (g.std() + 1e-6)
        amp = P["grain"] * (0.4 + 2.4 * y * (1 - y)) * (1 - 0.5 * y * y)
        y = y + amp * g
    return core_ops.ycc_to_rgb(y, c), used


# ---------- Основное: яркость, контраст, резкость, насыщенность всей картинки ----------

def basic_frame(x, P):
    """Простые общие правки. Яркость — гамма-кривой (чёрное и белое остаются на месте),
    контраст — S-кривой в логитах (ничего не обрезается), резкость — с ограничителем по соседям
    (без ореолов). Цвет идёт за яркостью — без перенасыщения."""
    y, c = core_ops.rgb_to_ycc(x)
    y0 = y.clamp(0, 1)
    y = y0
    if P["brightness"] != 0:
        y = y.clamp(1e-4, 1) ** (2.0 ** (-P["brightness"]))
    if P["contrast"] != 0:
        e = 1e-4
        yc = y.clamp(e, 1 - e)
        L = torch.log(yc / (1 - yc)) * (1.0 + P["contrast"])
        y = torch.sigmoid(L)
    if P["sharpness"] > 0:
        s = y + P["sharpness"] * 1.5 * (y - core_ops.blur(y, 1.0))
        mn, mx = core_ops.local_minmax(y, 1)
        y = torch.minimum(torch.maximum(s, mn), mx)
    c = c * ((y + 0.004) / (y0 + 0.004)).clamp(0, 4)
    if P["saturation"] != 1.0:
        c = c * P["saturation"]
    return core_ops.ycc_to_rgb(y.clamp(0, 1), c)
