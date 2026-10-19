import os
import re
import torch
import numpy as np
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, _num
from .mixer import AUDIO_EXTS, media_path, load_audio_file, trim_audio

# ----------------------------------------------------------------------------
#  Neron Audio Loader - загрузка любого звукового файла с прослушиванием на самой
#  ноде (без Queue) и обрезкой. Подключается к входу audio_N микшера, и там
#  файл слышно сразу.
# ----------------------------------------------------------------------------

UPLOAD_SUBDIR = "Neron_Audio"
MAX_UPLOAD_BYTES = 400 * 1024 * 1024

routes = PromptServer.instance.routes


def _parse_name(value):
    """'папка/файл.mp3 [input]' -> {name, subfolder, type}"""
    s = str(value or "").strip()
    kind = "input"
    m = re.search(r"\s*\[(\w+)\]$", s)
    if m:
        kind = m.group(1).lower()
        s = s[: m.start()]
    s = s.replace("\\", "/")
    k = s.rfind("/")
    name = s[k + 1:] if k >= 0 else s
    sub = s[:k] if k >= 0 else ""
    return {"name": name, "subfolder": sub, "type": kind if kind in ("input", "output", "temp") else "input"}


@routes.get("/neron/list_audio")
async def neron_list_audio(request):
    items = []
    for kind, base in (("input", folder_paths.get_input_directory()), ("output", folder_paths.get_output_directory())):
        base_depth = base.rstrip("\\/").count(os.sep)
        for dirpath, dirnames, filenames in os.walk(base):
            if dirpath.rstrip("\\/").count(os.sep) - base_depth >= 4:
                dirnames[:] = []
            if kind == "input":
                # папки с сэмплами драм-машины не показываем: это не песни
                dirnames[:] = [d for d in dirnames if d != "Neron_Drums"]
            for n in filenames:
                if n.lower().endswith(AUDIO_EXTS):
                    full = os.path.join(dirpath, n)
                    try:
                        mtime = os.path.getmtime(full)
                    except OSError:
                        continue
                    sub = os.path.relpath(dirpath, base)
                    sub = "" if sub == "." else sub.replace("\\", "/")
                    items.append((mtime, {"name": n, "subfolder": sub, "type": kind}))
            if len(items) > 800:
                break
    items.sort(key=lambda x: x[0], reverse=True)
    return web.json_response({"ok": True, "files": [i for _, i in items[:300]]})


@routes.post("/neron/upload_audio")
async def neron_upload_audio(request):
    """Загрузка звукового файла с компьютера пользователя в input/Neron_Audio."""
    try:
        reader = await request.multipart()
        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"ok": False, "error": "файл не получен"}, status=400)
        raw_name = os.path.basename(str(field.filename or "audio.wav").replace("\\", "/"))
        stem, ext = os.path.splitext(raw_name)
        ext = ext.lower()
        if ext not in AUDIO_EXTS:
            return web.json_response({"ok": False, "error": "это не звуковой файл: " + ext}, status=400)
        stem = re.sub(r"[^\w\-. ]", "_", stem).strip(" .") or "audio"
        folder = os.path.join(folder_paths.get_input_directory(), UPLOAD_SUBDIR)
        os.makedirs(folder, exist_ok=True)
        name = stem + ext
        k = 1
        while os.path.exists(os.path.join(folder, name)):
            name = f"{stem}_{k}{ext}"
            k += 1
        path = os.path.join(folder, name)
        size = 0
        with open(path, "wb") as f:
            while True:
                chunk = await field.read_chunk(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    f.close()
                    os.remove(path)
                    return web.json_response({"ok": False, "error": "файл больше 400 МБ"}, status=400)
                f.write(chunk)
        return web.json_response({"ok": True, "name": name, "subfolder": UPLOAD_SUBDIR, "type": "input"})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


class NeronAudioLoader:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # выбор файла делает интерфейс (список + кнопка ЗАГРУЗИТЬ)
                "audio_file": ("STRING", {"default": ""}),
                "start_sec": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 36000.0, "step": 0.01}),
                "end_sec": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 36000.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("AUDIO", "FLOAT")
    RETURN_NAMES = ("audio", "seconds")
    FUNCTION = "load"
    CATEGORY = "NeronAudio"

    def load(self, audio_file, start_sec, end_sec):
        v = _parse_name(audio_file)
        path = media_path(v, AUDIO_EXTS)
        if not path:
            raise RuntimeError("[Neron] Audio Loader: файл не выбран или не найден: " + str(audio_file))
        data = trim_audio(load_audio_file(path), _num(start_sec, 0, 0, 36000), _num(end_sec, 0, 0, 36000))
        waveform = torch.from_numpy(np.ascontiguousarray(data.T)).float().unsqueeze(0)
        return ({"waveform": waveform, "sample_rate": SAMPLE_RATE}, float(len(data)) / SAMPLE_RATE)


NODE_CLASS_MAPPINGS = {"NeronAudioLoader": NeronAudioLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronAudioLoader": "Neron Audio Loader"}
