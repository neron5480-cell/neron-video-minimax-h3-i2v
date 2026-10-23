# -*- coding: utf-8 -*-
"""5. Полировка: свет, тени и плавность — сильные стороны Clarity, переработанные под нашу базу.

Свет: дефликер общей яркости (ИИ-видео «дышит» яркостью), экспозиция, насыщенность.
Тени: локальный контраст только в тёмных местах (тёмные детали отделяются, появляется объём)
      и отдельно глубина теней. Работает по крупным формам — фактуру и дрейф не поднимает.
Плавность: без погони за кадрами. Либо одна промежуточная «полкадра» между соседями (×2),
      либо кадров столько же, но с лёгким смазом по движению, как от выдержки камеры.
      Промежуточный кадр строится по нашему же потоку с уверенностью: где поток не уверен,
      берём ближайший настоящий кадр — не выдумываем.
"""
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy, core_ops, core_frame
from .node_judge import _FlowStore

SMOOTH_MODES = ["×2: half-frame between frames / полкадра между кадрами",
                "motion blur, same frames / смаз по движению (кадров столько же)", "off / нет"]


def _fps_mul(fps_str, k):
    if "/" in fps_str:
        a, b = fps_str.split("/")
        return f"{int(a) * k}/{b}"
    v = float(fps_str) * k
    return str(int(v)) if v == int(v) else f"{v:.3f}"


def _between(i0, i1, f01, f10, c01, c10, a):
    """Кадр в момент a (0..1) между i0 и i1 по двунаправленному потоку."""
    ft0 = -(1 - a) * a * f01 + a * a * f10
    ft1 = (1 - a) * (1 - a) * f01 - a * (1 - a) * f10
    w0, in0 = core_ops.warp(i0, ft0, "bicubic")
    w1, in1 = core_ops.warp(i1, ft1, "bicubic")
    v0, _ = core_ops.warp(c01, ft0)
    v1, _ = core_ops.warp(c10, ft1)
    v0, v1 = v0 * in0, v1 * in1
    k0 = (1 - a) * v0 + 1e-4
    k1 = a * v1 + 1e-4
    blend = (k0 * w0 + k1 * w1) / (k0 + k1)
    # смешиваем только там, где оба сдвинутых кадра согласны. Где спорят (быстрое движение,
    # неточный поток) — смешивание дало бы полупрозрачный призрак, двойной контур. Там берём
    # один кадр — тот, которому поток доверяет больше. Решение сглажено, чтобы не было пятен.
    agree = torch.exp(-((w0 - w1).abs().mean(1, keepdim=True) / 0.04) ** 2)
    agree = core_ops.blur(agree, 1.5)
    pick0 = core_ops.blur((k0 >= k1).float(), 2.0)
    pick = pick0 * w0 + (1 - pick0) * w1
    mid = pick + agree * (blend - pick)
    # где обоим потокам не верим — честно берём ближайший настоящий кадр (по доверию, а не наугад)
    trust = torch.maximum(v0, v1).clamp(0, 1)
    near = i0 if (a < 0.5 or (a == 0.5 and float(v0.mean()) >= float(v1.mean()))) else i1
    return near + trust * (mid - near)


class RelayPolish:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Свет, контраст теней, дефликер и мягкая плавность (полкадра или смаз по движению)."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "smoothness": (SMOOTH_MODES, {"default": SMOOTH_MODES[0],
                           "tooltip": "×2 — одна промежуточная полкадра (24→48). Смаз — кадров столько же, "
                                      "движение мягче, как от выдержки. Бешеные ×4 не нужны"}),
            "shutter": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05,
                                  "tooltip": "Только для смаза: длина «выдержки» (0.5 ≈ классические 180°)"}),
            "deflicker": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 1.0, "step": 0.05,
                                    "tooltip": "Выравнивание «дыхания» общей яркости между кадрами"}),
            "exposure": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
                                   "tooltip": "Общая яркость (1 — как есть)"}),
            "saturation": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01}),
            "shadow_contrast": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.5, "step": 0.05,
                                          "tooltip": "Локальный контраст в тенях: тёмные детали отделяются, "
                                                     "появляется объём. Света не трогает"}),
            "shadow_depth": ("FLOAT", {"default": 0.0, "min": -0.5, "max": 0.5, "step": 0.02,
                                       "tooltip": "Глубина теней: плюс — гуще, минус — приоткрыть"}),
            "shadow_level": ("FLOAT", {"default": 0.35, "min": 0.1, "max": 0.7, "step": 0.05,
                                       "tooltip": "До какой яркости считать место тенью"}),
        }}

    def run(self, relay, smoothness, shutter, deflicker, exposure, saturation,
            shadow_contrast, shadow_depth, shadow_level):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h = core_journal.size(relay)          # после Доводчика кадр может быть крупнее
        cur = relay["current"]
        n = cur.get("frames", v["frames"])
        fps = cur.get("fps", v["fps"])
        dev = core_ops.device()
        frep = core_journal.report(relay, "flow")
        mode = smoothness
        if mode != SMOOTH_MODES[2] and not frep:
            mode = SMOOTH_MODES[2]  # без потока плавность честно не построить
        flows = _FlowStore(frep, h, w, dev) if frep else None

        # проход 1: общая яркость каждого кадра (дёшево, на уменьшенной копии)
        gains = np.ones(n, np.float32)
        if deflicker > 0:
            means = []
            for f in core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"]):
                core_comfy.check_interrupt()
                small = f[::8, ::8]
                y = 0.2126 * small[..., 0] + 0.7152 * small[..., 1] + 0.0722 * small[..., 2]
                means.append(float(np.log(y.mean() + 0.02)))
            m = np.array(means)
            n = len(m)
            sig = 3.0
            r = int(sig * 3)
            k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sig * sig))
            sm = np.convolve(np.pad(m, r, mode="edge"), k / k.sum(), mode="valid")
            gains = np.clip(np.exp((sm - m) * deflicker), 0.9, 1.1).astype(np.float32)

        PT = {"exposure": exposure, "saturation": saturation, "shadow_contrast": shadow_contrast,
              "shadow_depth": shadow_depth, "shadow_level": shadow_level}

        def tone(x):
            return core_frame.polish_tone(x, PT)

        out_path = core_journal.stage_path(relay, "polish.mkv")
        mul = 2 if mode == SMOOTH_MODES[0] else 1
        out_fps = _fps_mul(fps, mul)
        writer = core_io.FrameWriter(out_path, w, h, out_fps, "lossless",
                                     log_path=core_journal.stage_path(relay, "ffmpeg.log"))
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)

        def flow_pair(k):
            """Потоки и уверенность между кадрами k и k+1 (или None)."""
            if flows is None or k < 0 or k > flows.pairs - 1:
                return None
            return (flows._get("fw", k), flows._get("bw", k), flows._get("cfw", k), flows._get("cbw", k))

        buf = {}
        written = 0
        synth = 0
        i = 0

        def emit(x):
            nonlocal written
            writer.write(core_ops.to_np(tone(x)))
            written += 1

        def process(t):
            nonlocal synth
            x = buf[t]
            if mode == SMOOTH_MODES[1] and shutter > 0:
                # «выдержка»: усредняем моменты вокруг t по движению (3 точки с каждой стороны)
                acc, wsum = x.clone(), 1.0
                for side in (-1, 1):
                    k = t if side == 1 else t - 1
                    fp = flow_pair(k)
                    if fp is None or (t + side) not in buf:
                        continue
                    f01, f10, c01, c10 = fp
                    i0, i1 = (x, buf[t + 1]) if side == 1 else (buf[t - 1], x)
                    for s in (1, 2, 3):
                        off = shutter * 0.5 * s / 3.0
                        a = off if side == 1 else 1 - off
                        acc = acc + _between(i0, i1, f01, f10, c01, c10, a)
                        wsum += 1.0
                emit(acc / wsum)
            else:
                emit(x)
            if mode == SMOOTH_MODES[0] and (t + 1) in buf:
                fp = flow_pair(t)
                if fp is not None:
                    emit(_between(x, buf[t + 1], *fp, 0.5))
                    synth += 1
                else:
                    emit(x)  # без потока — повтор, а не выдумка
            flows and flows.drop_before(t - 2)

        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                g = float(gains[i]) if i < len(gains) else 1.0
                buf[i] = core_ops.to_t(frame, dev) * g
                if i >= 1:
                    process(i - 1)
                    buf.pop(i - 2, None)
                    bar.step()
                i += 1
            if i >= 1:
                process(i - 1)
                bar.step()
        writer.close()
        core_ops.free_vram()

        new_cur = {"path": out_path, "kind": "rgb", "fps": out_fps, "frames": written,
                   "time_scale": cur.get("time_scale", 1) * mul, "w": w, "h": h}
        relay = core_journal.advance(relay, "polish", new_cur)
        flick = float(np.abs(gains - 1).max() * 100) if deflicker > 0 else 0.0
        summary = [f"Плавность: {mode}" + (f" → {out_fps} к/с, кадров {written} (из них построено {synth})"
                                           if mul == 2 else ""),
                   f"Дефликер {deflicker}: наибольшая поправка яркости {flick:.1f}%" if deflicker > 0
                   else "Дефликер выключен",
                   f"Тени: контраст {shadow_contrast}, глубина {shadow_depth:+.2f} (ниже {shadow_level})",
                   f"Экспозиция ×{exposure}, насыщенность ×{saturation}"]
        if smoothness != mode:
            summary.insert(1, "Плавность отключена: нет этапа «Поток» в цепочке")
        task = {"smoothness": smoothness, "shutter": shutter, "deflicker": deflicker, "exposure": exposure,
                "saturation": saturation, "shadow_contrast": shadow_contrast, "shadow_depth": shadow_depth,
                "shadow_level": shadow_level}
        core_journal.write_stage(relay, "polish", task, summary,
                                 stats={"frames_out": written, "fps_out": out_fps, "deflicker_max_pct": flick},
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
