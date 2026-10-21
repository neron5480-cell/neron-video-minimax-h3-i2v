# -*- coding: utf-8 -*-
"""Ввод-вывод видео через ffmpeg: поиск ffmpeg, разбор параметров, чтение и запись кадров потоком.

Видео в память целиком не грузится никогда: кадры идут по трубе по одному.
"""
import os
import re
import shutil
import subprocess

import numpy as np

# точное округление: без него ffmpeg при пересчёте цвета темнит картинку на ~1.5/255
_SWS = "accurate_rnd+full_chroma_int+bitexact"
_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
_FFMPEG = None


def ffmpeg_exe():
    """Ищем ffmpeg: сначала imageio-ffmpeg (его ставит VideoHelperSuite), потом системный."""
    global _FFMPEG
    if _FFMPEG:
        return _FFMPEG
    exe = None
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        exe = None
    if not exe or not os.path.isfile(exe):
        exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError(
            "Эстафета: не найден ffmpeg. Установи пакет imageio-ffmpeg "
            "(pip install imageio-ffmpeg) или положи ffmpeg в PATH."
        )
    _FFMPEG = exe
    return exe


def run(args, log_path=None):
    """Запуск ffmpeg с ожиданием. Возвращает (код, stderr-текст)."""
    cmd = [ffmpeg_exe(), "-hide_banner"] + args
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       creationflags=_NO_WINDOW)
    err = p.stderr.decode("utf-8", "replace")
    if log_path:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write("$ " + " ".join(cmd) + "\n" + err + "\n")
    return p.returncode, err


_KNOWN_FPS = {"23.98": "24000/1001", "23.976": "24000/1001", "29.97": "30000/1001",
              "59.94": "60000/1001", "47.95": "48000/1001", "119.88": "120000/1001"}


def probe(path):
    """Разбираем вывод `ffmpeg -i`: размер, fps, цветовая матрица, диапазон, есть ли звук."""
    if not os.path.isfile(path):
        raise RuntimeError(f"Эстафета: файл не найден: {path}")
    _, err = run(["-i", path])
    vline = None
    has_audio = False
    for line in err.splitlines():
        if "Stream #" in line and "Video:" in line and vline is None:
            vline = line
        if "Stream #" in line and "Audio:" in line:
            has_audio = True
    if vline is None:
        raise RuntimeError(f"Эстафета: в файле нет видеопотока: {path}")
    m = re.search(r",\s*(\d{2,5})x(\d{2,5})", vline)
    if not m:
        raise RuntimeError("Эстафета: не удалось прочитать разрешение видео")
    w, h = int(m.group(1)), int(m.group(2))
    fps_str = "24"
    m = re.search(r"([\d.]+)\s*fps", vline) or re.search(r"([\d.]+)\s*tbr", vline)
    if m:
        v = m.group(1)
        fps_str = _KNOWN_FPS.get(v, v)
    low = vline.lower()
    if "bt2020" in low:
        matrix = "bt2020"
    elif "bt709" in low:
        matrix = "bt709"
    elif "bt470bg" in low or "smpte170m" in low or "bt601" in low:
        matrix = "bt601"
    else:
        # без метки плееры считают HD как bt709 — делаем так же, чтобы цвет не съехал
        matrix = "bt709" if h >= 720 else "bt601"
    rng = "pc" if ("(pc" in low or "full" in low or "yuvj" in low) else "tv"
    return {"w": w, "h": h, "fps": fps_str, "matrix": matrix, "range": rng,
            "has_audio": has_audio, "stream": vline.strip()}


def count_frames(path):
    """Честный подсчёт: декодируем видео в никуда (stream copy в null кадры не печатает)."""
    _, err = run(["-nostdin", "-i", path, "-map", "0:v:0", "-f", "null", "-"])
    found = re.findall(r"frame=\s*(\d+)", err)
    return int(found[-1]) if found else 0


def fps_float(fps_str):
    if "/" in fps_str:
        a, b = fps_str.split("/")
        return float(a) / float(b)
    return float(fps_str)


class FrameReader:
    """Читает кадры как float32 RGB [H,W,3] в диапазоне 0..1 (16 бит на канал внутри).

    kind="yuv" — исходник, нужна цветовая матрица; kind="rgb" — наши промежуточные файлы.
    """

    def __init__(self, path, w, h, kind="rgb", matrix="bt709", rng="tv"):
        self.w, self.h = w, h
        self.frame_bytes = w * h * 3 * 2
        if kind == "yuv":
            vf = f"scale=in_color_matrix={matrix}:in_range={rng}:flags={_SWS},format=rgb48le"
        else:
            vf = "format=rgb48le"
        cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-i", path,
               "-map", "0:v:0", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"]
        self.p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  bufsize=self.frame_bytes * 2, creationflags=_NO_WINDOW)

    def read(self):
        buf = self.p.stdout.read(self.frame_bytes)
        if buf is None or len(buf) < self.frame_bytes:
            return None
        a = np.frombuffer(buf, dtype="<u2").reshape(self.h, self.w, 3)
        return a.astype(np.float32) / 65535.0

    def __iter__(self):
        while True:
            f = self.read()
            if f is None:
                break
            yield f
        self.close()

    def close(self):
        try:
            self.p.stdout.close()
        except Exception:
            pass
        try:
            self.p.kill()
        except Exception:
            pass
        self.p.wait()


class FrameWriter:
    """Пишет кадры float RGB 0..1.

    mode="lossless" — FFV1, 16 бит RGB, без потерь (между этапами эстафеты);
    mode="h264" / "h265" — итоговый файл.
    """

    def __init__(self, path, w, h, fps, mode="lossless", crf=16, preset="slow", log_path=None):
        self.w, self.h, self.mode = w, h, mode
        self.path = path
        args = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                "-f", "rawvideo", "-pix_fmt", "rgb48le", "-s", f"{w}x{h}", "-r", str(fps),
                "-i", "-"]
        if mode == "lossless":
            args += ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "gbrp16le", path]
        else:
            tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
            if mode == "h265":
                vf = f"scale=out_color_matrix=bt709:out_range=tv:flags={_SWS},format=yuv420p10le"
                args += ["-vf", vf, "-c:v", "libx265", "-crf", str(crf), "-preset", preset,
                         "-tag:v", "hvc1", "-x265-params", "log-level=error"]
            else:
                vf = f"scale=out_color_matrix=bt709:out_range=tv:flags={_SWS},format=yuv420p"
                args += ["-vf", vf, "-c:v", "libx264", "-crf", str(crf), "-preset", preset]
            args += tags + ["-movflags", "+faststart", path]
        self.log = open(log_path, "ab") if log_path else subprocess.DEVNULL
        self.p = subprocess.Popen(args, stdin=subprocess.PIPE, stderr=self.log,
                                  creationflags=_NO_WINDOW)

    def write(self, frame):
        a = np.clip(frame, 0.0, 1.0)
        a = (a * 65535.0 + 0.5).astype("<u2")
        self.p.stdin.write(a.tobytes())

    def close(self):
        try:
            self.p.stdin.close()
        except Exception:
            pass
        code = self.p.wait()
        if self.log is not subprocess.DEVNULL:
            self.log.close()
        if code != 0:
            raise RuntimeError(f"Эстафета: ffmpeg завершился с ошибкой ({code}) при записи {self.path}. "
                               f"Подробности в ffmpeg.log в папке задачи.")


def read_frames_at(path, w, h, indices, kind="rgb", matrix="bt709", rng="tv"):
    """Достаём несколько конкретных кадров последовательным чтением."""
    want = sorted(set(int(i) for i in indices))
    out = {}
    if not want:
        return out
    r = FrameReader(path, w, h, kind, matrix, rng)
    i = 0
    for f in r:
        if i in want:
            out[i] = f
            if len(out) == len(want):
                r.close()
                break
        i += 1
    return out


def read_window(path, w, h, start, count, fps_str, kind="rgb", matrix="bt709", rng="tv"):
    """Кадры [start, start+count) быстрым поиском (рабочие копии — FFV1, каждый кадр ключевой,
    поэтому поиск точный). Возвращает список float32 [H,W,3]."""
    start = max(0, int(start))
    t = start / fps_float(fps_str)
    if kind == "yuv":
        vf = f"scale=in_color_matrix={matrix}:in_range={rng}:flags={_SWS},format=rgb48le"
    else:
        vf = "format=rgb48le"
    cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-ss", f"{t:.6f}", "-i", path,
           "-map", "0:v:0", "-frames:v", str(int(count)), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=_NO_WINDOW)
    fb = w * h * 3 * 2
    n = len(p.stdout) // fb
    return [np.frombuffer(p.stdout[i * fb:(i + 1) * fb], dtype="<u2").reshape(h, w, 3).astype(np.float32) / 65535.0
            for i in range(n)]
