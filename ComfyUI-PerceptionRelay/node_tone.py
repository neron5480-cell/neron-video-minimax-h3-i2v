# -*- coding: utf-8 -*-
"""Тональный скелет: тени и чёрное как каркас картинки.

Мозг берёт форму, края и объём из тона, а не из цвета (быстрый путь зрения почти не видит цвет).
Поэтому чёрное и тени — скелет. Сдвинул тон тени — сдвинулся весь каркас.

Как устроено:
1. Кадр раскладывается на СВЕТ (мягкая карта освещения, края сохраняются — guided filter
   в логарифме яркости) и ПОВЕРХНОСТЬ (фактура и детали объекта). Все правки — только по свету:
   объект и его детали не трогаются, дрейф не поднимается (в слое света его нет).
2. Слой света сверяется с прошлым кадром по потоку — тени не дышат, правки едут вместе с объектом.
3. Опора чёрного (нижние проценты яркости, блики туда не попадают) сглаживается во времени —
   уровень чёрного не плавает.
4. Тёмная часть шкалы делится на зоны: глухие тени / тени / переход. У каждой свой «±».
5. Цвет идёт пропорционально яркости — углубили тень, цвет не стал «гуще» сам собой.
   Насыщенность и налёт в тенях — отдельными ползунками.
"""
import math
import time

import numpy as np
import torch
import torch.nn.functional as F

from . import core_io, core_journal, core_comfy, core_ops, core_frame
from .node_scout import load_faces
from .node_judge import _FlowStore

EPS = 0.004          # «пол» логарифма, чтобы чёрное не уходило в минус бесконечность
STOP = 0.5 * math.log(2.0)   # ползунок 1.0 = полступени экспозиции


def _box(x, r):
    k = 2 * r + 1
    return F.avg_pool2d(F.pad(x, (r, r, r, r), mode="reflect"), k, stride=1)


def guided_self(i, r, eps):
    """Guided filter (He et al.) по самому себе: сглаживает, но не переходит через края."""
    m = _box(i, r)
    v = _box(i * i, r) - m * m
    a = v / (v + eps)
    b = m - a * m
    return _box(a, r) * i + _box(b, r)


def _band(s, lo, hi, soft=0.6):
    """Плавная зона по яркости света s (в логарифме): 1 внутри [lo, hi], мягкие края."""
    ls = torch.log(s + EPS)
    a, b = math.log(lo + EPS), math.log(hi + EPS)
    up = torch.sigmoid((ls - a) / (soft * 0.25))
    dn = torch.sigmoid((b - ls) / (soft * 0.25))
    return up * dn


class RelayTone:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Скелет теней: чёрная опора, зоны теней ±, плотность и цвет чёрного — только по слою света."

    @classmethod
    def INPUT_TYPES(cls):
        Z = {"min": -1.0, "max": 1.0, "step": 0.05}
        return {"required": {
            "relay": ("RELAY",),
            "black_point": ("FLOAT", {"default": 0.0, **Z,
                                      "tooltip": "Чёрная точка: плюс — чёрное плотнее (рамки, края), минус — приоткрыть"}),
            "black_density": ("FLOAT", {"default": 0.2, "min": 0.0, "max": 1.0, "step": 0.05,
                                        "tooltip": "Плотность чёрного: насколько «чернильно» садятся провалы. "
                                                   "Средние тона не трогает"}),
            "deep_shadows": ("FLOAT", {"default": 0.0, **Z, "tooltip": "Глухие тени: + светлее, − темнее"}),
            "shadows": ("FLOAT", {"default": 0.0, **Z, "tooltip": "Тени: + светлее, − темнее"}),
            "transition": ("FLOAT", {"default": 0.0, **Z, "tooltip": "Переход из тени в свет: + светлее, − темнее"}),
            "face_fill": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.05,
                                    "tooltip": "Заполняющий свет на лицах: мягко приоткрыть тени только на лицах "
                                               "(маски из Разведки, едут вместе с лицом)"}),
            "shadow_saturation": ("FLOAT", {"default": 0.0, **Z,
                                            "tooltip": "Цвет в тенях: + сочнее (кино), − чище и строже"}),
            "shadow_neutral": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05,
                                         "tooltip": "Убрать цветной налёт в тенях (молочно-синий, коричневый — "
                                                    "любимая грязь ИИ)"}),
            "stabilize_black": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0, "step": 0.05,
                                          "tooltip": "Держать уровень чёрного ровным во времени (без бликов)"}),
            "temporal": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 0.95, "step": 0.05,
                                   "tooltip": "Сверка слоя света с прошлым кадром по потоку: тени не дышат"}),
            "light_scale": ("INT", {"default": 0, "min": 0, "max": 64,
                                    "tooltip": "Размер «слоя света» в пикселях. 0 — авто по разрешению"}),
            "edge_keep": ("FLOAT", {"default": 0.15, "min": 0.02, "max": 0.6, "step": 0.01,
                                    "tooltip": "Какие перепады света считать краем и не размывать. "
                                               "Меньше — края теней чётче держатся"}),
        }}

    def run(self, relay, black_point, black_density, deep_shadows, shadows, transition, face_fill,
            shadow_saturation, shadow_neutral, stabilize_black, temporal, light_scale, edge_keep):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        cur = relay["current"]
        n = cur.get("frames", v["frames"])
        ts = cur.get("time_scale", 1)
        dev = core_ops.device()
        faces = load_faces(relay) if face_fill > 0 else None
        frep = core_journal.report(relay, "flow")
        flows = _FlowStore(frep, h, w, dev) if (frep and temporal > 0 and ts == 1) else None
        r = light_scale or max(4, int(round(min(w, h) / 60)))
        geps = edge_keep ** 2

        # проход 1: опора чёрного по каждому кадру (0.5% снизу — блики туда не попадают)
        anchors = []
        for f in core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"]):
            core_comfy.check_interrupt()
            small = f[::4, ::4]
            y = 0.2126 * small[..., 0] + 0.7152 * small[..., 1] + 0.0722 * small[..., 2]
            anchors.append(float(np.percentile(y, 0.5)))
        a = np.array(anchors) if anchors else np.zeros(1)
        n = len(a)
        sig = 4.0
        rr = int(sig * 3)
        kern = np.exp(-np.arange(-rr, rr + 1) ** 2 / (2 * sig * sig))
        a_s = np.convolve(np.pad(a, rr, mode="edge"), kern / kern.sum(), mode="valid")
        target = a_s if stabilize_black > 0 else a

        out_path = core_journal.stage_path(relay, "tone.mkv")
        writer = core_io.FrameWriter(out_path, w, h, cur.get("fps", v["fps"]), "lossless",
                                     log_path=core_journal.stage_path(relay, "ffmpeg.log"))
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        state = {}
        sat_before, sat_after, light_jitter = [], [], []
        t = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                x = core_ops.to_t(frame, dev)
                P = {"black_point": black_point, "black_density": black_density, "deep_shadows": deep_shadows,
                     "shadows": shadows, "transition": transition, "face_fill": face_fill,
                     "shadow_saturation": shadow_saturation, "shadow_neutral": shadow_neutral,
                     "stabilize_black": stabilize_black, "temporal": temporal, "light_scale": light_scale,
                     "edge_keep": edge_keep}
                anc, tgt = (a[t], target[t]) if t < n else (None, None)
                out, y, c, y_out, c_out, m_sh, jit = core_frame.tone_frame(
                    x, t, P, faces, flows, state, anc, tgt, h, w, dev, ts)
                if jit is not None:
                    light_jitter.append(jit)
                sat_before.append(float((c.abs().sum(1, keepdim=True) * m_sh).sum() / (m_sh.sum() + 1e-6)))
                sat_after.append(float((c_out.abs().sum(1, keepdim=True) * m_sh).sum() / (m_sh.sum() + 1e-6)))
                writer.write(core_ops.to_np(out))
                if flows is not None:
                    flows.drop_before(t - 2)
                t += 1
                bar.step()
        writer.close()
        core_ops.free_vram()

        new_cur = dict(cur)
        new_cur.update({"path": out_path, "kind": "rgb"})
        relay = core_journal.advance(relay, "tone", new_cur)
        breath = float((a.max() - a.min()) * 255)
        sb, sa = (np.mean(sat_before) if sat_before else 0), (np.mean(sat_after) if sat_after else 0)
        summary = [f"Слой света: масштаб {r} пикс, края держит от перепада {edge_keep}",
                   f"Опора чёрного гуляла на {breath:.1f}/255 — "
                   + (f"выровнена на {stabilize_black * 100:.0f}%" if stabilize_black > 0 else "не выравнивалась"),
                   f"Чёрная точка {black_point:+.2f}, плотность чёрного {black_density}",
                   f"Зоны: глухие {deep_shadows:+.2f}, тени {shadows:+.2f}, переход {transition:+.2f}",
                   f"Цвет в тенях: {(sa / sb - 1) * 100 if sb > 0 else 0:+.0f}% "
                   f"(налёт убран на {shadow_neutral * 100:.0f}%, насыщенность {shadow_saturation:+.2f})"]
        if face_fill > 0:
            summary.append(f"Заполняющий свет на лицах: {face_fill}" if faces else
                           "Заполняющий свет не применён: нет лиц или Разведки")
        if light_jitter:
            summary.append(f"Слой света сверялся с прошлым кадром (сила {temporal}): тени не дышат")
        elif temporal > 0:
            summary.append("Сверка слоя света во времени не делалась: нет Потока (или стоит после ×2)")
        task = {k: val for k, val in locals().items() if k in (
            "black_point", "black_density", "deep_shadows", "shadows", "transition", "face_fill",
            "shadow_saturation", "shadow_neutral", "stabilize_black", "temporal", "light_scale", "edge_keep")}
        core_journal.write_stage(relay, "tone", task, summary,
                                 stats={"black_breath": breath, "sat_change_pct": (sa / sb - 1) * 100 if sb else 0},
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
