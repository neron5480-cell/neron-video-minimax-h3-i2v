import os
import re
import shutil
import tempfile
import subprocess
import numpy as np
import soundfile as sf
import folder_paths

from .drum_machine import SAMPLE_RATE, _num
from .mixer import _ffmpeg_exe, audio_to_stereo

# ----------------------------------------------------------------------------
#  Neron Video Combine - собирает и сохраняет готовое видео и показывает его
#  на самой ноде (с перемоткой).
#  Что можно подключить:
#    video  - готовое видео (например, выход video микшера, любой загрузчик видео)
#    images + fps - кадры (например, из генерации) - тогда видео собирается из них
#    audio  - звук: он ложится на видео (заменяет прежний)
#  Нужен ffmpeg (есть в ComfyUI вместе с VideoHelperSuite / imageio-ffmpeg).
# ----------------------------------------------------------------------------

FORMATS = [
    "mp4 (как есть, без перекодирования)",
    "mp4 (h264)",
    "webm (vp9)",
    "mov (h264)",
]


def _next_path(prefix, ext):
    out_root = folder_paths.get_output_directory()
    parts = [re.sub(r"[^\w\-. ]", "_", p).strip(" .") for p in str(prefix or "").replace("\\", "/").split("/")]
    parts = [p for p in parts if p and p != ".."]
    if not parts:
        parts = ["Neron_Video"]
    folder = os.path.join(out_root, "Neron_Videos", *parts[:-1])
    os.makedirs(folder, exist_ok=True)
    stem = parts[-1]
    top = 0
    pat = re.compile(r"^" + re.escape(stem) + r"_(\d+)\.[A-Za-z0-9]+$")
    for n in os.listdir(folder):
        m = pat.match(n)
        if m:
            top = max(top, int(m.group(1)))
    name = f"{stem}_{top + 1:05d}.{ext}"
    sub = os.path.relpath(folder, out_root).replace("\\", "/")
    return os.path.join(folder, name), name, sub


def _to_numpy(t):
    return t.detach().cpu().numpy() if hasattr(t, "detach") else np.asarray(t)


def _video_source(video, tmp_dir):
    """Путь к файлу видео из того, что пришло по проводу (VIDEO-объект или путь)."""
    if isinstance(video, str):
        return video if os.path.isfile(video) else None
    fn = getattr(video, "get_stream_source", None)
    if callable(fn):
        try:
            src = fn()
            if isinstance(src, str) and os.path.isfile(src):
                return src
            if hasattr(src, "read"):
                p = os.path.join(tmp_dir, "in_video.mp4")
                try:
                    src.seek(0)
                except Exception:
                    pass
                with open(p, "wb") as f:
                    f.write(src.read())
                return p
        except Exception:
            pass
    for attr in ("_VideoFromFile__file", "file", "_file", "path"):
        val = getattr(video, attr, None)
        if isinstance(val, str) and os.path.isfile(val):
            return val
    save = getattr(video, "save_to", None)
    if callable(save):
        try:
            p = os.path.join(tmp_dir, "in_video.mp4")
            save(p)
            if os.path.isfile(p):
                return p
        except Exception:
            pass
    return None


def _codec_args(fmt, crf):
    if fmt.startswith("webm"):
        return "webm", ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf), "-pix_fmt", "yuv420p"], ["-c:a", "libopus", "-b:a", "160k"]
    ext = "mov" if fmt.startswith("mov") else "mp4"
    return ext, ["-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-pix_fmt", "yuv420p"], ["-c:a", "aac", "-b:a", "192k"]


PAD = "pad=ceil(iw/2)*2:ceil(ih/2)*2"


class NeronVideoCombine:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "filename_prefix": ("STRING", {"default": "Neron_Video"}),
                "format": (FORMATS, {"default": FORMATS[0]}),
                "quality_crf": ("INT", {"default": 18, "min": 0, "max": 51, "step": 1}),
                "fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 0.01}),
            },
            "optional": {
                "video": ("*",),
                "images": ("IMAGE",),
                "audio": ("AUDIO",),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("saved_path",)
    FUNCTION = "combine"
    OUTPUT_NODE = True
    CATEGORY = "NeronAudio"

    def combine(self, filename_prefix, format, quality_crf, fps, video=None, images=None, audio=None):
        exe = _ffmpeg_exe()
        if not exe:
            raise RuntimeError("[Neron] Video Combine: не найден ffmpeg. Установите VideoHelperSuite или imageio-ffmpeg (pip install imageio-ffmpeg)")
        crf = int(_num(quality_crf, 18, 0, 51))
        fps = float(_num(fps, 24.0, 1.0, 120.0))
        copy_mode = format.startswith("mp4 (как есть")
        ext, vargs, aargs = _codec_args("mp4 (h264)" if copy_mode else format, crf)
        out_path, out_name, out_sub = _next_path(filename_prefix, ext)

        with tempfile.TemporaryDirectory(prefix="neron_vc_") as tmp:
            wav = None
            if audio is not None:
                wav = os.path.join(tmp, "audio.wav")
                sf.write(wav, audio_to_stereo(audio), SAMPLE_RATE, subtype="PCM_16")

            if images is not None and len(images) > 0:
                n = len(images)
                first = _to_numpy(images[0:1])[0]
                h, w = int(first.shape[0]), int(first.shape[1])
                cmd = [exe, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-"]
                if wav:
                    cmd += ["-i", wav]
                cmd += ["-map", "0:v:0"]
                if wav:
                    cmd += ["-map", "1:a:0"]
                cmd += ["-vf", PAD] + vargs
                if wav:
                    cmd += aargs + ["-af", "apad", "-shortest"]
                cmd += [out_path]
                proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
                try:
                    for i in range(0, n, 16):
                        chunk = _to_numpy(images[i:i + 16])[..., :3]
                        data = (np.clip(chunk, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
                        proc.stdin.write(np.ascontiguousarray(data).tobytes())
                    proc.stdin.close()
                    err = proc.stderr.read().decode("utf-8", "ignore")
                    code = proc.wait()
                finally:
                    if proc.poll() is None:
                        proc.kill()
                if code != 0 or not os.path.isfile(out_path):
                    raise RuntimeError("[Neron] Video Combine: ffmpeg не смог собрать видео: " + err[-400:])
            elif video is not None:
                src = _video_source(video, tmp)
                if not src:
                    raise RuntimeError("[Neron] Video Combine: не удалось получить файл из входа video")
                base = [exe, "-y", "-v", "error", "-i", src]
                if wav:
                    base += ["-i", wav]
                base += ["-map", "0:v:0"]
                base += ["-map", "1:a:0"] if wav else ["-map", "0:a:0?"]
                tail_a = (aargs + ["-af", "apad", "-shortest"]) if wav else (["-c:a", "copy"] if copy_mode else aargs)
                attempts = []
                if copy_mode:
                    attempts.append(["-c:v", "copy"])
                attempts.append(["-vf", PAD] + vargs)
                ok, err = False, ""
                for vc in attempts:
                    if copy_mode and vc[:2] == ["-c:v", "copy"] and not wav:
                        ta = ["-c:a", "copy"]
                    else:
                        ta = aargs + (["-af", "apad", "-shortest"] if wav else [])
                    r = subprocess.run(base + vc + ta + [out_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    if r.returncode == 0 and os.path.isfile(out_path):
                        ok = True
                        break
                    err = r.stderr.decode("utf-8", "ignore")
                if not ok:
                    raise RuntimeError("[Neron] Video Combine: ffmpeg не смог обработать видео: " + err[-400:])
            else:
                raise RuntimeError("[Neron] Video Combine: подключите video (готовое видео) или images (кадры)")

        ui = {"neron_video": [{"filename": out_name, "subfolder": out_sub, "type": "output"}]}
        return {"ui": ui, "result": (out_path,)}


NODE_CLASS_MAPPINGS = {"NeronVideoCombine": NeronVideoCombine}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronVideoCombine": "Neron Video Combine"}
