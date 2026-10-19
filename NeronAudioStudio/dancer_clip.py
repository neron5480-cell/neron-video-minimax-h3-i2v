import os
import re
import folder_paths
from aiohttp import web
from server import PromptServer

# ----------------------------------------------------------------------------
#  Neron Dancer Clip - танцовщица из вашего видеоролика.
#  Ролики лежат в папке input/Neron_Dancers. Подгонка под темп музыки делается
#  в браузере (нода сама ничего не считает и в очереди не участвует).
#
#  Правила, чтобы не перегружать браузер:
#    * размер файла до 40 МБ
#    * длина до 20 секунд
#    * картинка не больше 1280 пикселей по большей стороне
# ----------------------------------------------------------------------------

DANCER_SUBDIR = "Neron_Dancers"
CLIP_EXTS = (".webm", ".mp4", ".m4v", ".mov", ".gif")
MAX_BYTES = 40 * 1024 * 1024
MAX_SEC = 20.0
MAX_SIDE = 1280

routes = PromptServer.instance.routes


def _folder():
    d = os.path.join(folder_paths.get_input_directory(), DANCER_SUBDIR)
    os.makedirs(d, exist_ok=True)
    return d


def _probe(path):
    """(секунды, ширина, высота) или None, если определить не удалось."""
    try:
        import av
        with av.open(path) as c:
            vs = next((s for s in c.streams if s.type == "video"), None)
            if vs is None:
                return None
            dur = None
            if c.duration:
                dur = float(c.duration) / 1000000.0
            elif vs.duration and vs.time_base:
                dur = float(vs.duration * vs.time_base)
            return dur, int(vs.codec_context.width or 0), int(vs.codec_context.height or 0)
    except Exception:
        return None


@routes.get("/neron/list_dancers")
async def neron_list_dancers(request):
    items = []
    base = _folder()
    for n in os.listdir(base):
        if n.lower().endswith(CLIP_EXTS):
            full = os.path.join(base, n)
            try:
                items.append((os.path.getmtime(full), {"name": n, "subfolder": DANCER_SUBDIR, "type": "input"}))
            except OSError:
                pass
    items.sort(key=lambda x: x[0], reverse=True)
    return web.json_response({"ok": True, "files": [i for _, i in items[:300]],
                              "rules": {"mb": MAX_BYTES // (1024 * 1024), "sec": MAX_SEC, "side": MAX_SIDE}})


@routes.post("/neron/upload_dancer")
async def neron_upload_dancer(request):
    path = None
    try:
        reader = await request.multipart()
        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"ok": False, "error": "файл не получен"}, status=400)
        raw_name = os.path.basename(str(field.filename or "dance.webm").replace("\\", "/"))
        stem, ext = os.path.splitext(raw_name)
        ext = ext.lower()
        if ext not in CLIP_EXTS:
            return web.json_response({"ok": False, "error": "нужен ролик: " + ", ".join(CLIP_EXTS)}, status=400)
        stem = re.sub(r"[^\w\-. ]", "_", stem).strip(" .") or "dance"
        folder = _folder()
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
                if size > MAX_BYTES:
                    f.close()
                    os.remove(path)
                    return web.json_response({"ok": False, "error": f"файл больше {MAX_BYTES // (1024 * 1024)} МБ: уменьшите разрешение или длину"}, status=400)
                f.write(chunk)
        info = _probe(path)
        warn = ""
        if info:
            dur, w, h = info
            if dur and dur > MAX_SEC + 0.5:
                os.remove(path)
                return web.json_response({"ok": False, "error": f"ролик длиннее {MAX_SEC:.0f} секунд ({dur:.1f} с): обрежьте"}, status=400)
            if max(w, h) > MAX_SIDE:
                os.remove(path)
                return web.json_response({"ok": False, "error": f"картинка {w}x{h}: больше {MAX_SIDE} пикселей по большей стороне, уменьшите"}, status=400)
        else:
            warn = "не удалось проверить длину и размер картинки"
        return web.json_response({"ok": True, "name": name, "subfolder": DANCER_SUBDIR, "type": "input", "warn": warn})
    except Exception as e:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
        return web.json_response({"ok": False, "error": str(e)}, status=500)


class NeronDancerClip:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # выбор ролика делает интерфейс (список + кнопка ЗАГРУЗИТЬ)
                "clip": ("STRING", {"default": ""}),
                "beats": ("INT", {"default": 8, "min": 1, "max": 64, "step": 1}),
                "shift": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "remove_bg": ("BOOLEAN", {"default": False}),
                "bg_tolerance": ("INT", {"default": 30, "min": 1, "max": 100, "step": 1}),
                "background": (["нет", "полосы", "сетка", "лучи"], {"default": "полосы"}),
                "bg_color": (["розовая", "голубая", "сиреневая", "рыжая", "серебро"], {"default": "сиреневая"}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    OUTPUT_NODE = False
    CATEGORY = "NeronAudio"

    def noop(self, **kwargs):
        return ()


NODE_CLASS_MAPPINGS = {"NeronDancerClip": NeronDancerClip}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronDancerClip": "Neron Dancer (видео)"}
