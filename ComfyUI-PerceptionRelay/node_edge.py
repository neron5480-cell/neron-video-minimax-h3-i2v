# -*- coding: utf-8 -*-
"""4½. Огранка: резкость скелета по мотивам AMD FSR RCAS, переработанная под нашу базу.

Что взято из RCAS: резкость «крестом» из 4 соседей с ограничителем — результат никогда не выходит
за пределы соседей, поэтому нет ореолов; плюс детектор шума — на шумной точке резкость падает.
Что добавлено: точим ТОЛЬКО края (скелет), фактуру не трогаем — иначе поднимем дрейф, который
погасил Судья; только яркость — без цветных кайм; лицо можно пропустить (там точки внимания Финиша);
самопроверка: меряем кипение до и после и честно пишем в журнал.
"""
import time

import numpy as np
import torch
import torch.nn.functional as F

from . import core_io, core_journal, core_comfy, core_ops, core_frame
from .node_scout import load_faces
from .node_judge import _FlowStore

RCAS_LIMIT = 0.25 - 1.0 / 16.0


def rcas(y, sharp, denoise=True):
    """RCAS по одному каналу [1,1,H,W], sharp 0..1 (1 — максимум)."""
    p = F.pad(y, (1, 1, 1, 1), mode="replicate")
    b = p[..., 0:-2, 1:-1]
    d = p[..., 1:-1, 0:-2]
    f = p[..., 1:-1, 2:]
    h = p[..., 2:, 1:-1]
    e = y
    mn4 = torch.minimum(torch.minimum(b, d), torch.minimum(f, h))
    mx4 = torch.maximum(torch.maximum(b, d), torch.maximum(f, h))
    eps = 1e-5
    hit_min = mn4 / (4.0 * mx4 + eps)
    hit_max = (1.0 - mx4) / (4.0 * mn4 - 4.0 - eps)
    lobe = torch.maximum(-hit_min, hit_max)
    lobe = torch.clamp(lobe, min=-RCAS_LIMIT, max=0.0) * sharp
    if denoise:
        nz = 0.25 * (b + d + f + h) - e
        rng = torch.maximum(mx4, e) - torch.minimum(mn4, e)
        nz = (nz.abs() / (rng + eps)).clamp(0, 1)
        lobe = lobe * (1.0 - 0.5 * nz)
    out = (lobe * (b + d + f + h) + e) / (4.0 * lobe + 1.0)
    # наш ограничитель: не выходить за пределы соседей 3x3 — никаких ореолов
    mn, mx = core_ops.local_minmax(y, 1)
    return torch.minimum(torch.maximum(out, mn), mx)


def _bands(y):
    g1 = core_ops.blur(y, 1.0)
    return g1 - core_ops.blur(y, 4.0), y - g1


class RelayEdge:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Резкость скелета (по мотивам RCAS): только края, без ореолов, с самопроверкой кипения."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "strength": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0, "step": 0.05,
                                   "tooltip": "Сила резкости (1 — максимум RCAS)"}),
            "passes": ("INT", {"default": 1, "min": 1, "max": 3,
                               "tooltip": "Сколько раз пройти. Больше — резче, но выше риск"}),
            "edge_level": ("FLOAT", {"default": 0.03, "min": 0.005, "max": 0.2, "step": 0.005,
                                     "tooltip": "С какого перепада считать место краем. Меньше — точит больше мест "
                                                "(и рискует задеть фактуру)"}),
            "texture_keep": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.05,
                                       "tooltip": "Доля резкости в фактуре (не на краях). 0 — фактуру не трогать"}),
            "skip_faces": ("BOOLEAN", {"default": True,
                                       "tooltip": "Не трогать лица — там работают точки внимания Финиша"}),
            "denoise": ("BOOLEAN", {"default": True, "tooltip": "Детектор шума RCAS: не точить шумные точки"}),
            "temporal": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05,
                                   "tooltip": "Точить только то, что держится во времени. 1 — строго, "
                                              "0 — как обычный RCAS (края, которые «дышат», будут дрожать сильнее)"}),
        }}

    def run(self, relay, strength, passes, edge_level, texture_keep, skip_faces, denoise, temporal):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h, n = v["w"], v["h"], v["frames"]
        dev = core_ops.device()
        faces = load_faces(relay) if skip_faces else None
        frep = core_journal.report(relay, "flow")
        flows = _FlowStore(frep, h, w, dev) if frep else None

        out_path = core_journal.stage_path(relay, "edge.mkv")
        log = core_journal.stage_path(relay, "ffmpeg.log")
        writer = core_io.FrameWriter(out_path, w, h, v["fps"], "lossless", log_path=log)
        cur = relay["current"]
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)

        prev_in = prev_out = prev_delta = None
        boil_in, boil_out, edge_gain = [], [], []
        t = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                x = core_ops.to_t(frame, dev)
                P = {"strength": strength, "passes": passes, "edge_level": edge_level,
                     "texture_keep": texture_keep, "denoise": denoise, "temporal": temporal}
                out, y, y_o, gm, raw_delta = core_frame.edge_frame(x, t, P, faces, flows, prev_delta, h, w, dev)
                writer.write(core_ops.to_np(out))

                # самопроверка: резкость на краях и кипение фактуры до/после
                strong = gm > edge_level
                if strong.any():
                    edge_gain.append(float(core_ops.gradient_mag(y_o)[strong].mean() /
                                           (core_ops.gradient_mag(y)[strong].mean() + 1e-6)))
                if flows is not None and prev_in is not None:
                    fl = flows.to(t, -1)
                    if fl is not None:
                        flow, conf = fl
                        # дрожь деталей относительно их силы: стало резче на 10% и разница на 10% —
                        # это не новый дрейф; дрейф — когда дрожь растёт быстрее самих деталей
                        for cur_y, prv, acc in ((y, prev_in, boil_in), (y_o, prev_out, boil_out)):
                            m0, f0 = _bands(cur_y)
                            pw, ins = core_ops.warp(prv, flow, "bicubic")
                            m1, f1 = _bands(pw)
                            wg = conf * ins
                            diff = (wg * ((m0 - m1).abs() + (f0 - f1).abs())).sum()
                            energy = (wg * (m0.abs() + f0.abs())).sum()
                            acc.append(float(diff / (energy + 1e-6)))
                        flows.drop_before(t - 2)
                prev_in, prev_out, prev_delta = y, y_o, raw_delta
                t += 1
                bar.step()
        writer.close()
        core_ops.free_vram()

        gain = (np.mean(edge_gain) - 1) * 100 if edge_gain else 0.0
        relay = core_journal.advance(relay, "edge", {"path": out_path, "kind": "rgb"})
        summary = [f"RCAS: сила {strength}, проходов {passes}, детектор шума {'вкл' if denoise else 'выкл'}, "
                   f"сверка во времени {temporal}",
                   f"Точит только края (порог {edge_level})" + (f", фактуру ×{texture_keep}" if texture_keep else
                                                                 ", фактуру не трогает"),
                   "Лица пропущены — там точки внимания Финиша" if faces is not None else "Лица не пропускались",
                   f"Резкость на краях: +{gain:.1f}%"]
        stats = {"edge_gain_pct": gain}
        if boil_in:
            bi, bo = float(np.mean(boil_in)), float(np.mean(boil_out))
            delta = (bo / bi - 1) * 100 if bi > 0 else 0.0
            stats["boil_delta_pct"] = delta
            if delta > max(3.0, 1.5 * gain):  # дрожь растёт заметно быстрее резкости — это уже дрейф
                summary.append(f"⚠ Дрожь деталей выросла на {delta:.1f}% — резкость поднимает дрейф. "
                               f"Убавь strength или подними edge_level")
            else:
                summary.append(f"Дрожь деталей (относительно их силы): {delta:+.1f}% — в норме, дрейф не поднят")
        else:
            summary.append("Самопроверку кипения не делал: нет этапа «Поток» в цепочке")
        task = {"strength": strength, "passes": passes, "edge_level": edge_level,
                "texture_keep": texture_keep, "skip_faces": skip_faces, "denoise": denoise,
                "temporal": temporal}
        core_journal.write_stage(relay, "edge", task, summary, stats=stats,
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
