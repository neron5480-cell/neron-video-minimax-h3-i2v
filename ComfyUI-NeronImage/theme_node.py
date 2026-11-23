# -*- coding: utf-8 -*-
"""Тема по умолчанию внутри самостоятельного процесса Neron Image.

Это та же самая кухня тем, что и в отдельном пакете Neron Theme, но вшита сюда:
поставлен только этот процесс — и тема работает. Имена путей закачки сделаны
своими, чтобы не спорить с отдельно установленным пакетом тем.
"""

import os
import re
import json
import time

import numpy as np
import folder_paths
from aiohttp import web
from server import PromptServer

TAG = "[Neron Image Theme]"
MAX_THEME_BYTES = 64 * 1024
MAX_THEMES = 500
ID_RE = re.compile(r"^[\w\-]{1,60}$")

# Тема «Neron Brown» — та, что включается по умолчанию и в самом пакете тем.
DEFAULT_THEME = {
    "v": 1,
    "theme": {
        "v": 1, "id": "brown", "name": "Neron Brown", "author": "Neron",
        "c": {"bg": "#170e07", "grid": "#21150c", "title": "#4a2f1e", "body": "#2e1c10",
              "text": "#eedcc6", "widget": "#1c120b", "line": "#5e412b", "link": "#d9904a",
              "menu": "#22160e", "accent": "#f3a453"},
        "roles": {"model": "#e090d8", "input": "#7fb2e0", "text": "#ffcf70", "gen": "#f3a453",
                  "latent": "#f29ab4", "image": "#97d17f", "audio": "#97d17f",
                  "output": "#c9e07f", "util": "#c9ab8c"},
        "tint": 0.32, "btint": 0.05, "glow": 0.35,
        "ui": True, "opacity": 1, "halo": 0,
        "wires": {"mode": "type", "custom": {}},
        "life": {"level": 1, "frame": True, "wires": True, "bgfx": "none", "work": True,
                 "beat": True, "speed": 1, "fps": 0, "quietRun": False},
    },
    "tab": "install",
}
DEFAULT_JSON = json.dumps(DEFAULT_THEME, ensure_ascii=False, separators=(",", ":"))


def _themes_dir():
    try:
        base = folder_paths.get_user_directory()
    except Exception:
        base = None
    if not base:
        base = os.path.join(folder_paths.get_output_directory(), "..", "user")
    d = os.path.join(base, "neron_themes")
    os.makedirs(d, exist_ok=True)
    return d


def _default_json():
    return DEFAULT_JSON


routes = PromptServer.instance.routes


def _read_theme_file(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("neron_theme", data) if isinstance(data, dict) else None


@routes.get("/neron_theme/list")
async def neron_image_theme_list(request):
    try:
        d = _themes_dir()
        out = []
        names = sorted((n for n in os.listdir(d) if n.lower().endswith(".json")),
                       key=lambda n: os.path.getmtime(os.path.join(d, n)), reverse=True)
        for name in names[:MAX_THEMES]:
            try:
                t = _read_theme_file(os.path.join(d, name))
                if isinstance(t, dict) and isinstance(t.get("c"), dict):
                    t["id"] = name[:-5]
                    out.append(t)
            except Exception as e:
                print(f"{TAG} skip broken theme file / пропускаю битый файл темы: {name}: {e}")
        return web.json_response({"ok": True, "themes": out, "dir": d})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron_theme/save")
async def neron_image_theme_save(request):
    try:
        raw = await request.read()
        if len(raw) > MAX_THEME_BYTES:
            return web.json_response({"ok": False, "error": "тема слишком большая / theme too big"}, status=413)
        data = json.loads(raw.decode("utf-8"))
        t = data.get("theme") if isinstance(data, dict) else None
        if not isinstance(t, dict) or not isinstance(t.get("c"), dict):
            return web.json_response({"ok": False, "error": "нет темы / no theme"}, status=400)
        name = str(t.get("name") or "theme")
        clean = re.sub(r"[^\w\-]+", "_", name, flags=re.UNICODE).strip("_")[:40] or "theme"
        tid = str(data.get("id") or "")
        if not ID_RE.match(tid):
            tid = clean + time.strftime("_%Y%m%d_%H%M%S")
        t.pop("id", None)
        path = os.path.join(_themes_dir(), tid + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"neron_theme": t, "app": "Neron Image"}, f, ensure_ascii=False, indent=1)
        return web.json_response({"ok": True, "id": tid, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron_theme/delete")
async def neron_image_theme_delete(request):
    try:
        data = await request.json()
        tid = str(data.get("id") or "")
        if not ID_RE.match(tid):
            return web.json_response({"ok": False, "error": "bad id"}, status=400)
        path = os.path.join(_themes_dir(), tid + ".json")
        if os.path.isfile(path):
            os.remove(path)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


class NeronImageTheme:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"theme_json": ("STRING", {"default": _default_json()})},
            "optional": {
                "image": ("IMAGE", {"tooltip": "Необязательно: картинка, из цветов которой собрать тему."}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "Neron"
    OUTPUT_NODE = True
    DESCRIPTION = "Тема для всего ComfyUI, вшитая в процесс Neron Image. Ни к чему не подключается."

    def run(self, theme_json, image=None, unique_id=None):
        if image is None:
            return {"ui": {}}
        try:
            from PIL import Image
            arr = image[0].detach().cpu().numpy() if hasattr(image, "detach") else np.asarray(image)[0]
            arr = np.clip(np.asarray(arr, dtype=np.float32) * 255.0, 0, 255).astype(np.uint8)
            if arr.ndim == 3 and arr.shape[2] == 1:
                arr = np.repeat(arr, 3, axis=2)
            img = Image.fromarray(arr[:, :, :3])
            img.thumbnail((160, 160))
            sub = "neron_theme"
            d = os.path.join(folder_paths.get_temp_directory(), sub)
            os.makedirs(d, exist_ok=True)
            key = re.sub(r"[^\w]", "_", str(unique_id or "0"))[:40]
            name = f"theme_src_{key}.png"
            img.save(os.path.join(d, name))
            return {"ui": {"neron_theme_img": [{"filename": name, "subfolder": sub, "type": "temp"}]}}
        except Exception as e:
            print(f"{TAG} picture not read / картинка не прочиталась: {e}")
            return {"ui": {}}


NODE_CLASS_MAPPINGS = {"NeronThemeStudio": NeronImageTheme}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronThemeStudio": "🎨 Тема"}
