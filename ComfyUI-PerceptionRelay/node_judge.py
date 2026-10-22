# -*- coding: utf-8 -*-
"""4. Судья: «физика или дрейф».

Кадр раскладывается на частоты:
  крупное (скелет, массы, свет, честное движение) — не трогаем никогда;
  среднее (где живут ползущие псевдодетали) — сверяем с соседями, совмещёнными по потоку;
  мелкое — тоже сверяем и частично приглушаем (место под носитель на финише).
Правило: то, что держится в соседних кадрах, — правда; то, что есть только в одном
и движением не объясняется, — дрейф; где поток не уверен — не трогаем.
"""
import os
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy, core_ops
from .node_scout import load_faces


class _FlowStore:
    def __init__(self, rep, h, w, dev):
        f = rep["files"]
        self.fw = np.load(f["fw"], mmap_mode="r")
        self.bw = np.load(f["bw"], mmap_mode="r")
        self.cfw = np.load(f["cfw"], mmap_mode="r")
        self.cbw = np.load(f["cbw"], mmap_mode="r")
        self.pairs = int(rep["stats"].get("pairs", self.fw.shape[0]))
        self.h, self.w, self.dev = h, w, dev
        self.cache = {}

    def _get(self, kind, k):
        key = (kind, k)
        if key not in self.cache:
            if kind in ("fw", "bw"):
                a = getattr(self, kind)[k].astype(np.float32)
                t = torch.from_numpy(a)[None].to(self.dev)
                t = core_ops.upsample_flow(t, self.h, self.w)
            else:
                a = getattr(self, kind)[k].astype(np.float32) / 255.0
                t = torch.from_numpy(a)[None, None].to(self.dev)
                t = core_ops.upsample_map(t, self.h, self.w)
            self.cache[key] = t
        return self.cache[key]

    def close(self):
        """Отпустить файлы потока. Пока они открыты, Windows не даёт их перезаписать или удалить."""
        self.cache.clear()
        for name in ("fw", "bw", "cfw", "cbw"):
            m = getattr(self, name, None)
            mm = getattr(m, "_mmap", None)
            setattr(self, name, None)
            del m
            if mm is not None:
                try:
                    mm.close()
                except Exception:
                    pass

    def drop_before(self, k):
        for key in [key for key in self.cache if key[1] < k]:
            del self.cache[key]

    def to(self, t, d):
        """Поток из кадра t в кадр t+d и уверенность. None — если нельзя."""
        if d == 1 and t <= self.pairs - 1:
            return self._get("fw", t), self._get("cfw", t)
        if d == -1 and t - 1 >= 0 and t - 1 <= self.pairs - 1:
            return self._get("bw", t - 1), self._get("cbw", t - 1)
        if d == 2 and t + 1 <= self.pairs - 1:
            f1, c1 = self._get("fw", t), self._get("cfw", t)
            f, inside = core_ops.compose(f1, self._get("fw", t + 1))
            c2, _ = core_ops.warp(self._get("cfw", t + 1), f1)
            return f, c1 * c2 * inside
        if d == -2 and t - 2 >= 0 and t - 1 <= self.pairs - 1:
            f1, c1 = self._get("bw", t - 1), self._get("cbw", t - 1)
            f, inside = core_ops.compose(f1, self._get("bw", t - 2))
            c2, _ = core_ops.warp(self._get("cbw", t - 2), f1)
            return f, c1 * c2 * inside
        return None


def judge_frame(buf, t, flows, faces, P, unstable, h, w, dev):
    """Судья для одного кадра t. buf — кадры {индекс: [1,3,H,W]} вокруг t. Общее для прогона и живого окна.
    Возвращает (кадр, яркость после, яркость до, сумма доверия к соседям)."""
    x = buf[t]
    y, c = core_ops.rgb_to_ycc(x)
    g1 = core_ops.blur(y, 1.0)
    low = core_ops.blur(y, P["detail_size"])
    mid, fine = g1 - low, y - g1
    acc_m = torch.zeros_like(mid)
    acc_f = torch.zeros_like(fine)
    acc_c = torch.zeros_like(c)
    acc_w = torch.zeros_like(y)
    for d in range(-P["radius"], P["radius"] + 1):
        if d == 0 or (t + d) not in buf:
            continue
        fl = flows.to(t, d)
        if fl is None:
            continue
        flow, conf = fl
        nb, inside = core_ops.warp(buf[t + d], flow, "bicubic")
        yn, cn = core_ops.rgb_to_ycc(nb)
        g1n = core_ops.blur(yn, 1.0)
        lown = core_ops.blur(yn, P["detail_size"])
        # если «скелет» соседа не совпал — это перекрытие или физика, соседу не верим
        wp = torch.exp(-((lown - low) / 0.03) ** 2)
        # дрейф — тихая рябь; резкий перепад после совмещения — это край или неточный поток
        ws = torch.exp(-((g1n - g1) / P["tolerance"]) ** 2)
        ws = -torch.nn.functional.max_pool2d(-ws, 3, stride=1, padding=1)  # недоверие чуть шире края
        wgt = conf * inside * wp * ws * (1.0 if abs(d) == 1 else 0.6)
        acc_m += wgt * (g1n - lown)
        acc_f += wgt * (yn - g1n)
        acc_c += wgt * cn
        acc_w += wgt
    mid_c = (mid + acc_m) / (1 + acc_w)
    fine_c = (fine + acc_f) / (1 + acc_w)
    c_c = (c + acc_c) / (1 + acc_w)

    prot = torch.ones_like(y)
    if faces is not None:
        eyes, face, _ = core_ops.face_masks(faces.get(t), h, w, dev)
        prot = (1 - face * (1 - P["face_keep"])) * (1 - eyes * (1 - P["eye_keep"]))
    a = 0.5 if t in unstable else 1.0
    mid_o = mid + P["strength_mid"] * a * prot * (mid_c - mid)
    fine_o = fine + P["strength_fine"] * a * prot * (fine_c - fine)
    # мелочь срезаем только в фактуре: на крае (скелет) мелочь — это и есть резкость края
    edge = (core_ops.gradient_mag(g1) / 0.03).clamp(0, 1)
    edge = torch.nn.functional.max_pool2d(edge, 3, stride=1, padding=1)
    fine_o = fine_o * (1 - P["fine_cut"] * a * prot * (1 - edge))
    c_o = c + P["chroma"] * a * (c_c - c)
    y_o = low + mid_o + fine_o
    # цветовой шум гасим, но по краям яркости: цвет не растекается через границы предметов
    c_o = c_o + 0.5 * P["chroma"] * a * (core_ops.guided_joint(y_o.clamp(0, 1), c_o, 1, 1e-4) - c_o)
    out = core_ops.ycc_to_rgb(y_o, c_o)
    return out, y_o, y, acc_w


class RelayJudge:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Гасит ползущие псевдодетали (дрейф), не трогая скелет и честное движение."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "strength_mid": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0, "step": 0.05,
                                       "tooltip": "Сила успокоения средней фактуры — главный ползунок"}),
            "strength_fine": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 1.0, "step": 0.05,
                                        "tooltip": "Сила успокоения мелочи"}),
            "fine_cut": ("FLOAT", {"default": 0.3, "min": 0.0, "max": 1.0, "step": 0.05,
                                   "tooltip": "Сколько мелочи убрать совсем — её место займёт зерно-носитель"}),
            "chroma": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 1.0, "step": 0.05,
                                 "tooltip": "Успокоение цветового шума (глаз видит цвет грубо, можно смело)"}),
            "radius": ("INT", {"default": 2, "min": 1, "max": 2,
                               "tooltip": "Сколько соседей с каждой стороны сверять"}),
            "detail_size": ("FLOAT", {"default": 4.0, "min": 1.5, "max": 12.0, "step": 0.5,
                                      "tooltip": "Граница между «скелетом» и «фактурой», в пикселях. "
                                                 "Больше — судья трогает более крупные вещи"}),
            "face_keep": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 1.0, "step": 0.05,
                                    "tooltip": "Доля силы внутри лица (мимика — это физика)"}),
            "eye_keep": ("FLOAT", {"default": 0.25, "min": 0.0, "max": 1.0, "step": 0.05,
                                   "tooltip": "Доля силы в глазах — пусть моргают и живут"}),
            "tolerance": ("FLOAT", {"default": 0.035, "min": 0.005, "max": 0.2, "step": 0.005,
                                    "tooltip": "Насколько сильное отличие ещё считать дрейфом. Больше отличие — "
                                               "это уже край/структура, её не трогаем. Меньше — бережнее к краям"}),
            "trust_flow_report": ("BOOLEAN", {"default": True,
                                              "tooltip": "На неустойчивых участках из отчёта Потока работать вполсилы"}),
        }}

    def run(self, relay, strength_mid, strength_fine, fine_cut, chroma, radius, detail_size,
            face_keep, eye_keep, tolerance, trust_flow_report):
        t0 = time.time()
        frep = core_journal.report(relay, "flow")
        if not frep:
            raise RuntimeError("Эстафета/Судья: нужен этап «Поток» перед Судьёй")
        v = core_journal.video(relay)
        w, h, n = v["w"], v["h"], v["frames"]
        dev = core_ops.device()
        flows = _FlowStore(frep, h, w, dev)
        faces = load_faces(relay)

        unstable = set()
        if trust_flow_report:
            for a, b in frep["stats"].get("unstable_segments", []):
                unstable.update(range(a, b + 2))

        out_path = core_journal.stage_path(relay, "judge.mkv")
        log = core_journal.stage_path(relay, "ffmpeg.log")
        writer = core_io.FrameWriter(out_path, w, h, v["fps"], "lossless", log_path=log)
        cw, ch = max(1, w // 4), max(1, h // 4)
        change_path = core_journal.stage_path(relay, "judge_change.npy")
        change_mm = np.lib.format.open_memmap(change_path, "w+", np.uint8, (n, ch, cw))

        cur = relay["current"]
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        buf = {}
        stats_change, stats_trust = [], []
        max_w = sum(1.0 if abs(d) == 1 else 0.6 for d in range(-radius, radius + 1) if d)

        P = {"strength_mid": strength_mid, "strength_fine": strength_fine, "fine_cut": fine_cut, "chroma": chroma,
             "radius": radius, "detail_size": detail_size, "face_keep": face_keep, "eye_keep": eye_keep,
             "tolerance": tolerance}

        def process(t):
            out, y_o, y, acc_w = judge_frame(buf, t, flows, faces, P, unstable, h, w, dev)
            dy = (y_o - y).abs()
            stats_change.append(float(dy.mean()))
            stats_trust.append(float(acc_w.mean()) / max_w)
            small = torch.nn.functional.interpolate(dy, size=(ch, cw), mode="area")
            if t < n:
                change_mm[t] = (small[0, 0] * (255 / 0.08)).clamp(0, 255).byte().cpu().numpy()
            writer.write(core_ops.to_np(out))

        i = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                buf[i] = core_ops.to_t(frame, dev)
                t = i - radius
                if t >= 0:
                    process(t)
                    buf.pop(t - radius, None)
                    flows.drop_before(t - radius - 1)
                    bar.step()
                i += 1
            for t in range(max(0, i - radius), i):
                process(t)
                bar.step()
        writer.close()
        flows.close()
        change_mm.flush()
        del change_mm
        core_ops.free_vram()

        ch_arr = np.array(stats_change) if stats_change else np.zeros(1)
        tr_arr = np.array(stats_trust) if stats_trust else np.zeros(1)
        careful = len([t for t in range(i) if t in unstable])
        relay = core_journal.advance(relay, "judge", {"path": out_path, "kind": "rgb"})
        summary = [f"Обработано кадров: {i}, соседей с каждой стороны: {radius}",
                   f"Среднее изменение яркости: {ch_arr.mean() * 255:.2f} из 255 "
                   f"(максимум по кадру {ch_arr.max() * 255:.2f})",
                   f"Доверие к соседям в среднем: {tr_arr.mean() * 100:.0f}% "
                   f"(ниже — значит, много движения и судья больше доверял текущему кадру)",
                   ("Лица защищены: внутри лица сила ×%.2f, в глазах ×%.2f" % (face_keep, eye_keep))
                   if faces is not None else "Разведки не было — защиты лиц нет",
                   f"Работал вполсилы на {careful} кадрах (по отчёту Потока)" if careful
                   else "Неустойчивых участков не было, работал везде в полную силу",
                   "Карта изменений: judge_change.npy (смотри нодой Превью)"]
        task = {"strength_mid": strength_mid, "strength_fine": strength_fine, "fine_cut": fine_cut,
                "chroma": chroma, "radius": radius, "detail_size": detail_size,
                "face_keep": face_keep, "eye_keep": eye_keep, "tolerance": tolerance, "trust_flow_report": trust_flow_report}
        core_journal.write_stage(relay, "judge", task, summary,
                                 stats={"change_mean": float(ch_arr.mean()), "trust_mean": float(tr_arr.mean()),
                                        "careful_frames": careful},
                                 files={"video": out_path, "change": change_path},
                                 seconds=time.time() - t0)
        return (relay,)
