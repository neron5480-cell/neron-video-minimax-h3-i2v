# -*- coding: utf-8 -*-
"""Сравнение: исходник и результат в одном видео — рядом, шторкой или друг над другом.

Видео надо сравнивать видео, а не стоп-кадрами: судья работает во времени.
Слева/сверху всегда исходник, справа/снизу — результат текущего этапа.
"""
import os

from . import core_io, core_journal, core_comfy

LAYOUTS = ["side by side / рядом (исходник | результат)", "split / шторка (половина | половина)",
           "stacked / друг над другом", "face close-up / рядом, по лицу крупно"]


def _even(x):
    return max(2, int(x) // 2 * 2)


class RelayCompare:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("путь_к_сравнению",)
    OUTPUT_NODE = True
    DESCRIPTION = "Собирает видео «исходник | результат» для сравнения в движении."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "layout": (LAYOUTS, {"default": LAYOUTS[0]}),
            "keep_size": ("BOOLEAN", {"default": False,
                                      "tooltip": "Ужать итог до размера исходного кадра (удобно для больших видео)"}),
            "line": ("BOOLEAN", {"default": True, "tooltip": "Белая разделительная линия"}),
        }}

    def run(self, relay, layout, keep_size, line):
        v = core_journal.video(relay)
        w, h = core_journal.size(relay)           # если Доводчик увеличил видео — сравниваем в новом размере
        k = w / v["w"]                            # исходник растягиваем до него (честно: lanczos против Доводчика)
        src = core_journal.stage_path(relay, "source.mkv")
        res = relay["current"]["path"]
        job = os.path.basename(relay["job_dir"])
        out_dir = os.path.join(core_comfy.output_dir(), "perception_relay")
        num = 1
        while os.path.exists(os.path.join(out_dir, f"{job}_compare_{num:03d}.mp4")):
            num += 1
        name = f"{job}_compare_{num:03d}.mp4"
        out = os.path.join(out_dir, name)

        # вырез по лицу: берём среднее положение первого лица за всё видео
        crop = None
        if layout == LAYOUTS[3]:
            from .node_scout import load_faces
            faces = load_faces(relay)
            if faces:
                import numpy as np
                boxes = np.array([f[0][:4] for f in faces.values()])
                fx, fy, fw, fh = boxes.mean(0) * k
                side = _even(min(max(fw, fh) * 2.4, w, h))
                x0 = _even(min(max(fx + fw / 2 - side / 2, 0), w - side))
                y0 = _even(min(max(fy + fh / 2 - side / 2, 0), h - side))
                crop = (side, side, x0, y0)
            else:
                layout = LAYOUTS[0]

        lw = 4 if line else 0
        sws = core_io._SWS
        # оба входа — на одну ровную временную сетку: кадр N в момент N/fps.
        # Иначе метки времени у рабочей копии (mkv) и итога (mp4) не совпадают,
        # склейка выдаёт лишние кадры с неровным шагом и видео идёт «слайдами».
        fps_a = v["fps"]
        fps = relay["current"].get("fps", v["fps"])  # после Полировки ×2 у результата своя частота
        pre_a = f"[0:v]settb=AVTB,setpts=N/({fps_a})/TB"
        pre_b = f"[1:v]settb=AVTB,setpts=N/({fps})/TB"
        if fps_a != fps:
            pre_a += f",fps={fps}"
        if k != 1:
            pre_a += f",scale={w}:{h}:flags=lanczos"
        if crop:
            cw, ch, x0, y0 = crop
            big = _even(h)  # лупа: вырез растягиваем до высоты кадра
            pre_a += f",crop={cw}:{ch}:{x0}:{y0},scale={big}:{big}:flags=lanczos"
            pre_b += f",crop={cw}:{ch}:{x0}:{y0},scale={big}:{big}:flags=lanczos"
            cw_, ch_ = big, big
        else:
            cw_, ch_ = w, h
        # цветовые матрицы задаём явно: иначе ffmpeg угадывает по-разному и половины разъезжаются по цвету
        cur_kind = relay["current"].get("kind", "yuv")
        in_a = f"in_color_matrix={v['matrix']}:in_range={v['range']}:"
        in_b = "in_color_matrix=bt709:in_range=tv:" if cur_kind == "yuv" else ""
        fmt_a = f",scale={in_a}out_color_matrix=bt709:out_range=tv:flags={sws},format=yuv444p"
        fmt_b = f",scale={in_b}out_color_matrix=bt709:out_range=tv:flags={sws},format=yuv444p"
        if layout == LAYOUTS[1]:
            half = _even(w / 2)
            fc = (f"{pre_a}{fmt_a},crop={half}:{h}:0:0[a];"
                  f"{pre_b}{fmt_b},crop={w - half}:{h}:{half}:0[b];[a][b]hstack=inputs=2:shortest=1[s]")
            final_w, final_h = w, h
            if lw:
                fc += f";[s]drawbox=x={half - lw // 2}:y=0:w={lw}:h={h}:color=white@0.9:t=fill[s]"
        elif layout == LAYOUTS[2]:
            fc = f"{pre_a}{fmt_a}[a];{pre_b}{fmt_b}[b]"
            if lw:
                fc += f";[a]pad={cw_}:{ch_ + lw}:0:0:white[a]"
            fc += ";[a][b]vstack=inputs=2:shortest=1[s]"
            final_w, final_h = cw_, ch_ * 2 + lw
        else:
            fc = f"{pre_a}{fmt_a}[a];{pre_b}{fmt_b}[b]"
            if lw:
                fc += f";[a]pad={cw_ + lw}:{ch_}:0:0:white[a]"
            fc += ";[a][b]hstack=inputs=2:shortest=1[s]"
            final_w, final_h = cw_ * 2 + lw, ch_
        if keep_size and layout != LAYOUTS[1]:
            if final_w >= final_h:
                tw, th = _even(w), _even(final_h * w / final_w)
            else:
                tw, th = _even(final_w * h / final_h), _even(h)
            fc += f";[s]scale={tw}:{th}:flags=lanczos+{sws}[s]"
        fc += f";[s]pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p[out]"

        args = ["-y", "-i", src, "-i", res, "-filter_complex", fc, "-map", "[out]"]
        if v.get("has_audio") and res.lower().endswith(".mp4"):
            args += ["-map", "1:a:0?", "-c:a", "copy"]
        args += ["-r", str(fps), "-c:v", "libx264", "-crf", "14", "-preset", "medium",
                 "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                 "-movflags", "+faststart", out]
        code, err = core_io.run(args, core_journal.stage_path(relay, "ffmpeg.log"))
        if code != 0:
            raise RuntimeError("Эстафета/Сравнение: ffmpeg не смог собрать видео (см. ffmpeg.log в папке задачи)\n"
                               + err[-600:])
        # предпросмотр прямо в ноде (как у стандартной Save Video)
        preview = [{"filename": name, "subfolder": "perception_relay", "type": "output", "format": "video/h264-mp4"}]
        return {"ui": {"images": preview, "animated": (True,), "text": [out]}, "result": (out,)}
