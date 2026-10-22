# -*- coding: utf-8 -*-
"""Цветовой шов: чистые границы между цветами — без «бритвы».

Проблема: на границе (кожа ↔ чёрное платье) не край, а мутная полоса. Две причины:
1. Цвет в видео хранится вполовину (4:2:0): пиксели края берут яркость свою, а цвет — соседа.
   Отсюда бурый ободок: кожа «затекает» в чёрное.
   Лечение — цвет по краям яркости (guided filter): мозг сам «заливает» цвет в области,
   очерченные яркостью, — делаем так же. Цвет прилипает к настоящему краю.
2. Сам переход широкий. Резкость тут не поможет — она даёт каймы по обе стороны.
   Лечение — СЖАТИЕ полутона: каждый пиксель полосы мягко тянется к ближайшей стороне
   (светлый — к коже, тёмный — к платью). Новых значений не появляется — только в пределах
   соседей, поэтому каймы невозможны. Считается в линейном свете, чтобы середина не проваливалась.
   Сжимаем только сильные края и только те, что стоят во времени (сверка по потоку).
"""
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy, core_ops, core_frame
from .node_judge import _FlowStore
from .node_edge import _bands

GAMMA = 2.2


def narrow_edges(y, strength, r, edge_level):
    """Сжатие полутона на сильных краях. y [1,1,H,W] 0..1 (гамма). Возвращает добавку к y."""
    yl = y.clamp(0, 1) ** GAMMA
    mn, mx = core_ops.local_minmax(yl, r)
    rng = mx - mn
    t = ((yl - mn) / (rng + 1e-6)).clamp(0, 1)
    g = 1.0 + 3.0 * strength                     # крутизна: 0,½,1 остаются на месте
    tg, ug = t ** g, (1 - t) ** g
    t2 = tg / (tg + ug + 1e-12)
    yl2 = mn + t2 * rng
    # только сильные края (перепад в гамме), фактуру и полутона внутри областей не трогаем
    mn_g, mx_g = core_ops.local_minmax(y, r)
    edge = ((mx_g - mn_g) / edge_level - 1.0).clamp(0, 1)
    y2 = yl2.clamp(0, 1) ** (1.0 / GAMMA)
    return edge * (y2 - y)


class RelaySeam:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Чистые цветовые границы: цвет по краям яркости + сжатие полутона без кайм."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "color_snap": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0, "step": 0.05,
                                     "tooltip": "Цвет по краям яркости: убирает затекание цвета через границу "
                                                "(бурый ободок кожи на чёрном)"}),
            "snap_radius": ("INT", {"default": 2, "min": 1, "max": 6,
                                    "tooltip": "На сколько пикселей цвет может «затекать» и откуда его собирать"}),
            "narrow": ("FLOAT", {"default": 0.4, "min": 0.0, "max": 1.0, "step": 0.05,
                                 "tooltip": "Сжатие полутона на сильных краях: переход уже, кайм нет"}),
            "narrow_radius": ("INT", {"default": 2, "min": 1, "max": 4,
                                      "tooltip": "Ширина полосы перехода, которую сжимаем"}),
            "edge_level": ("FLOAT", {"default": 0.12, "min": 0.03, "max": 0.5, "step": 0.01,
                                     "tooltip": "С какого перепада яркости считать край сильным. "
                                                "Меньше — сжимает больше краёв (и рискует задеть фактуру)"}),
            "temporal": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05,
                                   "tooltip": "Сжимать только края, которые стоят во времени (без дрожи границ)"}),
        }}

    def run(self, relay, color_snap, snap_radius, narrow, narrow_radius, edge_level, temporal):
        narrow_s = narrow
        t0 = time.time()
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        cur = relay["current"]
        n = cur.get("frames", v["frames"])
        ts = cur.get("time_scale", 1)
        dev = core_ops.device()
        frep = core_journal.report(relay, "flow")
        flows = _FlowStore(frep, h, w, dev) if (frep and ts == 1) else None

        out_path = core_journal.stage_path(relay, "seam.mkv")
        writer = core_io.FrameWriter(out_path, w, h, cur.get("fps", v["fps"]), "lossless",
                                     log_path=core_journal.stage_path(relay, "ffmpeg.log"))
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        prev_delta = prev_in = prev_out = None
        jit_in, jit_out = [], []
        t = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                x = core_ops.to_t(frame, dev)
                P = {"color_snap": color_snap, "snap_radius": snap_radius, "narrow": narrow_s,
                     "narrow_radius": narrow_radius, "edge_level": edge_level, "temporal": temporal}
                out, y, y2, raw = core_frame.seam_frame(x, t, P, flows, prev_delta)
                writer.write(core_ops.to_np(out))

                # самопроверка: дрожь деталей до/после
                if flows is not None and prev_in is not None:
                    fl = flows.to(t, -1)
                    if fl is not None:
                        flow, conf = fl
                        for cy, py, acc in ((y, prev_in, jit_in), (y2, prev_out, jit_out)):
                            m0, f0 = _bands(cy)
                            pw, ins = core_ops.warp(py, flow, "bicubic")
                            m1, f1 = _bands(pw)
                            wg = conf * ins
                            acc.append(float((wg * ((m0 - m1).abs() + (f0 - f1).abs())).sum() /
                                             ((wg * (m0.abs() + f0.abs())).sum() + 1e-6)))
                    flows.drop_before(t - 2)
                prev_delta, prev_in, prev_out = raw, y, y2
                t += 1
                bar.step()
        writer.close()
        core_ops.free_vram()

        new_cur = dict(cur)
        new_cur.update({"path": out_path, "kind": "rgb"})
        relay = core_journal.advance(relay, "seam", new_cur)
        summary = [f"Цвет по краям яркости: {color_snap} (радиус {snap_radius})",
                   f"Сжатие полутона: {narrow_s} (полоса {narrow_radius} пикс, края от перепада {edge_level})"]
        stats = {}
        if jit_in:
            d = (np.mean(jit_out) / np.mean(jit_in) - 1) * 100
            stats["jitter_delta_pct"] = d
            summary.append(("⚠ " if d > 5 else "") + f"Дрожь деталей: {d:+.1f}%" +
                           (" — границы начали дрожать, убавь narrow или подними edge_level" if d > 5
                            else " — в норме"))
        elif narrow_s > 0 and temporal > 0:
            summary.append("Сверка во времени не делалась: нет Потока (или стоит после ×2)")
        task = {"color_snap": color_snap, "snap_radius": snap_radius, "narrow": narrow_s,
                "narrow_radius": narrow_radius, "edge_level": edge_level, "temporal": temporal}
        core_journal.write_stage(relay, "seam", task, summary, stats=stats,
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
