# -*- coding: utf-8 -*-
"""5. Финиш: точки внимания (глаза и контур лица), носитель-зерно, итоговое сжатие, звук обратно.

Порядок важен: сначала точки, зерно строго последним — иначе резкость его раздует.
Резкость с ограничителем: значение не выходит за пределы соседей, поэтому нет ореолов («подводки»).
"""
import os
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy, core_ops, core_frame
from .node_scout import load_faces


def _sharpen_clamped(y, sigma, amount):
    s = y + amount * (y - core_ops.blur(y, sigma))
    mn, mx = core_ops.local_minmax(y, 1)
    return torch.minimum(torch.maximum(s, mn), mx)


class RelayFinish:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY", "STRING")
    RETURN_NAMES = ("эстафета", "путь_к_видео")
    OUTPUT_NODE = True
    DESCRIPTION = "Глаза и контур до «фокуса объектива», зерно-носитель, итоговый файл со звуком."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "eye_sharp": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 2.0, "step": 0.05,
                                    "tooltip": "Резкость глаз. Перебор = «подводка»"}),
            "eye_contrast": ("FLOAT", {"default": 0.25, "min": 0.0, "max": 1.0, "step": 0.05,
                                       "tooltip": "Локальный контраст глаз (живость взгляда)"}),
            "contour_sharp": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 2.0, "step": 0.05,
                                        "tooltip": "Резкость по краю лица. Перебор = «наклейка»"}),
            "grain": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 0.08, "step": 0.001,
                                "tooltip": "Зерно-носитель. По умолчанию выключено: замеры показали, что даже "
                                           "0.006 добавляет мерцание и съедает работу Судьи. Только для стилизации"}),
            "grain_size": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.5, "step": 0.1,
                                     "tooltip": "Размер зерна, пикс."}),
            "seed": ("INT", {"default": 0, "min": 0, "max": 2 ** 31 - 1}),
            "codec": (["h264", "h265 10bit"], {"default": "h264"}),
            "crf": ("INT", {"default": 16, "min": 0, "max": 40,
                            "tooltip": "Качество сжатия: меньше — лучше и тяжелее. 14–18 — хорошо"}),
            "filename_prefix": ("STRING", {"default": "relay"}),
        }}

    def run(self, relay, eye_sharp, eye_contrast, contour_sharp, grain, grain_size, seed,
            codec, crf, filename_prefix):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        n = relay["current"].get("frames", v["frames"])
        out_fps = relay["current"].get("fps", v["fps"])
        ts = relay["current"].get("time_scale", 1)  # после Полировки ×2 кадр t — это момент t/2 исходника
        dev = core_ops.device()
        faces = load_faces(relay)
        use_points = faces is not None and len(faces) > 0 and (eye_sharp + eye_contrast + contour_sharp) > 0

        out_dir = os.path.join(core_comfy.output_dir(), "perception_relay")
        os.makedirs(out_dir, exist_ok=True)
        base = os.path.join(out_dir, os.path.basename(relay["job_dir"]) + "_" + filename_prefix)
        k = 1
        while os.path.exists(f"{base}_{k:03d}.mp4"):
            k += 1
        final = f"{base}_{k:03d}.mp4"
        silent = final if not v.get("has_audio") else core_journal.stage_path(relay, "final_noaudio.mp4")
        log = core_journal.stage_path(relay, "ffmpeg.log")
        mode = "h265" if codec.startswith("h265") else "h264"
        writer = core_io.FrameWriter(silent, w, h, out_fps, mode, crf=crf, log_path=log)

        cur = relay["current"]
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        gen = torch.Generator(device="cpu")
        frames_with_points = 0
        t = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                x = core_ops.to_t(frame, dev)
                ft = int(round(t / ts)) if ts != 1 else t
                rows = faces.get(ft) if (use_points and faces is not None) else None
                P = {"eye_sharp": eye_sharp, "eye_contrast": eye_contrast, "contour_sharp": contour_sharp,
                     "grain": grain, "grain_size": grain_size, "seed": seed}
                out, used = core_frame.points_frame(x, P, rows, t, h, w, dev, gen)
                frames_with_points += int(used)
                writer.write(core_ops.to_np(out))
                t += 1
                bar.step()
        writer.close()

        audio_ok = None
        if v.get("has_audio") and v.get("audio") and os.path.isfile(v["audio"]):
            code, _ = core_io.run(["-y", "-i", silent, "-i", v["audio"], "-map", "0:v:0", "-map", "1:a:0",
                                   "-c", "copy", "-shortest", "-movflags", "+faststart", final], log)
            if code != 0:  # кодек звука не лезет в mp4 — перекодируем в AAC
                code, _ = core_io.run(["-y", "-i", silent, "-i", v["audio"], "-map", "0:v:0", "-map", "1:a:0",
                                       "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest",
                                       "-movflags", "+faststart", final], log)
            audio_ok = code == 0
            if audio_ok:
                os.remove(silent)
            else:
                os.replace(silent, final)

        new_cur = {"path": final, "kind": "yuv"}
        for key in ("fps", "frames", "time_scale"):  # частота после Полировки идёт дальше по эстафете
            if key in relay["current"]:
                new_cur[key] = relay["current"][key]
        relay = core_journal.advance(relay, "finish", new_cur)
        summary = [f"Итог: {final}",
                   f"Кодек {codec}, crf {crf}",
                   (f"Точки внимания на {frames_with_points} кадрах: глаза резкость {eye_sharp}, "
                    f"контраст {eye_contrast}; контур {contour_sharp}") if use_points
                   else "Точки внимания не применялись (нет лиц или разведки)",
                   (f"⚠ ЗЕРНО ВКЛЮЧЕНО: сила {grain}, размер {grain_size} — добавляет мерцание и «шагрень» по всему кадру. "
                    f"Если это не стилизация — поставь grain = 0") if grain > 0 else "Зерно выключено"]
        if audio_ok is True:
            summary.append("Звук возвращён без изменений")
        elif audio_ok is False:
            summary.append("Звук вернуть не удалось — видео без звука (см. ffmpeg.log)")
        task = {"eye_sharp": eye_sharp, "eye_contrast": eye_contrast, "contour_sharp": contour_sharp,
                "grain": grain, "grain_size": grain_size, "seed": seed, "codec": codec, "crf": crf}
        core_journal.write_stage(relay, "finish", task, summary, files={"final": final},
                                 seconds=time.time() - t0)
        return {"ui": {"text": [final]}, "result": (relay, final)}
