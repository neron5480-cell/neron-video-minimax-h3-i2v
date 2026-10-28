# -*- coding: utf-8 -*-
"""
Neron Theme 🎨 — темы для всего ComfyUI / themes for the whole ComfyUI

RU: Нода ни к чему не обязана подключаться. Есть на столе — весь ComfyUI в выбранной
    теме: окно, стол, ноды по ролям (модели, промпты, генерация, выход...), провода,
    живость. Удалили ноду — всё как было. Тема сохраняется вместе с workflow, поэтому
    кто скачал вашу схему, видит её в вашем оформлении.
    Три части: УСТАНОВИТЬ (библиотека), СОЗДАТЬ (из цвета, из картинки, всё вручную),
    ПОДЕЛИТЬСЯ (код, файл, палитра ComfyUI).
    Вход image (необязательно): картинка, из цветов которой собирается тема.
EN: Not required to be wired. On the canvas — the whole ComfyUI takes the theme: window,
    canvas, nodes by role (models, prompts, sampling, output...), wires, life. Delete the
    node — everything is back. The theme is saved with the workflow, so whoever downloads
    your workflow sees it the way you styled it.
    Three parts: INSTALL (library), CREATE (from a color, from a picture, everything by
    hand), SHARE (code, file, ComfyUI palette).
    image input (optional): a picture whose colors become a theme.
"""

import os
import re
import json
import time

import numpy as np
import folder_paths
from aiohttp import web
from server import PromptServer

TAG = "[Neron Theme]"
MAX_THEME_BYTES = 64 * 1024
MAX_THEMES = 500
ID_RE = re.compile(r"^[\w\-]{1,60}$")


def _themes_dir():
    base = None
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
    return json.dumps({"v": 1, "theme": None, "tab": "install"})


# ----------------------------------------------------------------------------
#  Мои темы: файлы в ComfyUI/user/neron_themes / My themes: files in ComfyUI/user/neron_themes
# ----------------------------------------------------------------------------

routes = PromptServer.instance.routes


def _read_theme_file(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("neron_theme", data) if isinstance(data, dict) else None


@routes.get("/neron_theme/list")
async def neron_theme_list(request):
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
async def neron_theme_save(request):
    try:
        raw = await request.read()
        if len(raw) > MAX_THEME_BYTES:
            return web.json_response({"ok": False, "error": "theme too big / тема слишком большая"}, status=413)
        data = json.loads(raw.decode("utf-8"))
        t = data.get("theme") if isinstance(data, dict) else None
        if not isinstance(t, dict) or not isinstance(t.get("c"), dict):
            return web.json_response({"ok": False, "error": "no theme / нет темы"}, status=400)
        name = str(t.get("name") or "theme")
        clean = re.sub(r"[^\w\-]+", "_", name, flags=re.UNICODE).strip("_")[:40] or "theme"
        tid = str(data.get("id") or "")
        if not ID_RE.match(tid):
            tid = clean + time.strftime("_%Y%m%d_%H%M%S")
        t.pop("id", None)
        path = os.path.join(_themes_dir(), tid + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"neron_theme": t, "app": "Neron Theme"}, f, ensure_ascii=False, indent=1)
        return web.json_response({"ok": True, "id": tid, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron_theme/delete")
async def neron_theme_delete(request):
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


# ----------------------------------------------------------------------------
#  Нода / Node
# ----------------------------------------------------------------------------

class NeronThemeStudio:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {"theme_json": ("STRING", {"default": _default_json()})},
            "optional": {
                "image": ("IMAGE", {"tooltip": "Необязательно: картинка для темы «из картинки» / "
                                             "Optional: a picture for \"theme from picture\""}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "Neron"
    OUTPUT_NODE = True
    DESCRIPTION = ("Темы для всего ComfyUI: установить, создать, поделиться. Ни к чему не обязана подключаться. / "
                   "Themes for the whole ComfyUI: install, create, share. Does not have to be wired.")

    def run(self, theme_json, image=None, unique_id=None):
        if image is None:
            return {"ui": {}}
        # маленькая копия картинки для интерфейса: из неё берутся цвета темы
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


NODE_CLASS_MAPPINGS = {"NeronThemeStudio": NeronThemeStudio}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronThemeStudio": "Neron Theme 🎨 / Темы ComfyUI"}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
