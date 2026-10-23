# -*- coding: utf-8 -*-
"""1. Старт: принимает видеофайл, откладывает звук, делает рабочую копию без потерь, пишет шапку журнала."""
import os
import re
import time

from . import core_io, core_journal, core_comfy


def _safe(name):
    name = re.sub(r"[^\w\-.]+", "_", name, flags=re.UNICODE).strip("._")
    return name or "job"


def _resolve_source(video, video_path):
    """Откуда берём файл: вход VIDEO (стандартная Load Video) или запасной путь."""
    if video is not None:
        # обычно Load Video держит путь к файлу — читаем прямо его, без лишних копий
        try:
            s = video.get_stream_source()
        except Exception:
            s = None
        if isinstance(s, str) and os.path.isfile(s):
            return os.path.abspath(s)
        inbox = os.path.join(core_comfy.output_dir(), "perception_relay", "_incoming")
        os.makedirs(inbox, exist_ok=True)
        dst = os.path.join(inbox, f"video_{int(time.time() * 1000)}.mp4")
        if s is not None and hasattr(s, "read"):  # видео в памяти — сохраняем байты как есть
            try:
                s.seek(0)
            except Exception:
                pass
            with open(dst, "wb") as f:
                f.write(s.read())
            return dst
        try:
            video.save_to(dst)
            return dst
        except Exception as e:
            raise RuntimeError(f"Эстафета/Старт: не удалось получить файл из входа video ({e})")
    p = (video_path or "").strip().strip('"')
    if not p:
        raise RuntimeError("Эстафета/Старт: подключи ноду Load Video ко входу video или впиши путь к файлу")
    return os.path.abspath(p)


class RelayStart:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Начало эстафеты: видео из Load Video (или по пути) → рабочая копия без потерь, звук отдельно, журнал."

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "job_name": ("STRING", {"default": "", "tooltip": "Имя папки задачи. Пусто — по имени файла"}),
            },
            "optional": {
                "video": ("VIDEO", {"tooltip": "Сюда — стандартная нода Load Video (Загрузить видео)"}),
                "video_path": ("STRING", {"default": "",
                                          "tooltip": "Запасной вариант: полный путь к файлу, "
                                                     "если вход video не подключён"}),
            },
        }

    @classmethod
    def IS_CHANGED(cls, job_name, video=None, video_path=""):
        if video is not None:
            return f"video|{job_name}"  # изменения ноды загрузки Comfy отслеживает сам
        p = (video_path or "").strip().strip('"')
        try:
            st = os.stat(p)
            return f"{p}|{st.st_mtime}|{st.st_size}|{job_name}"
        except OSError:
            return f"{p}|missing|{job_name}"

    def run(self, job_name, video=None, video_path=""):
        t0 = time.time()
        src = _resolve_source(video, video_path)
        info = core_io.probe(src)
        name = _safe(job_name.strip() or os.path.splitext(os.path.basename(src))[0])
        job_dir = os.path.join(core_comfy.output_dir(), "perception_relay", name)
        os.makedirs(job_dir, exist_ok=True)
        log = os.path.join(job_dir, "ffmpeg.log")
        if os.path.exists(log):
            os.remove(log)

        # рабочая копия: декодированный кадр как есть, без потерь, без звука
        work = os.path.join(job_dir, "source.mkv")
        code, _ = core_io.run(["-y", "-i", src, "-map", "0:v:0", "-an", "-sn",
                               "-fps_mode", "passthrough", "-c:v", "ffv1", "-level", "3", work], log)
        if code != 0:  # старый ffmpeg не знает -fps_mode
            code, _ = core_io.run(["-y", "-i", src, "-map", "0:v:0", "-an", "-sn",
                                   "-vsync", "passthrough", "-c:v", "ffv1", "-level", "3", work], log)
        if code != 0:
            raise RuntimeError("Эстафета/Старт: не удалось сделать рабочую копию (см. ffmpeg.log)")

        audio = None
        if info["has_audio"]:
            audio = os.path.join(job_dir, "audio.mka")
            code, _ = core_io.run(["-y", "-i", src, "-map", "0:a:0", "-vn", "-c:a", "copy", audio], log)
            if code != 0:
                audio = None

        frames = core_io.count_frames(work)
        if frames < 2:
            raise RuntimeError("Эстафета/Старт: в видео меньше двух кадров")

        video = {"w": info["w"], "h": info["h"], "fps": info["fps"], "frames": frames,
                 "matrix": info["matrix"], "range": info["range"],
                 "has_audio": audio is not None, "audio": audio}
        journal = os.path.join(job_dir, "journal.json")
        core_journal.new_journal(journal, src, video)
        relay = {"job_dir": job_dir, "journal": journal,
                 "current": {"path": work, "kind": "yuv"}, "chain": []}
        relay = core_journal.advance(relay, "start")
        summary = [f"Видео {info['w']}x{info['h']}, {info['fps']} к/с, {frames} кадров "
                   f"({frames / core_io.fps_float(info['fps']):.1f} с)",
                   f"Цвет: {info['matrix']}, диапазон {info['range']}",
                   "Звук: отложен в audio.mka, вернётся на финише" if audio else "Звука нет",
                   "Рабочая копия без потерь: source.mkv"]
        core_journal.write_stage(relay, "start", {"video_path": src}, summary,
                                 stats={"frames": frames}, files={"source": work, "audio": audio},
                                 seconds=time.time() - t0)
        return (relay,)
