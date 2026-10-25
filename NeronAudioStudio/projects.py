import os
import re
import json
import time
import folder_paths
from aiohttp import web
from server import PromptServer

# ----------------------------------------------------------------------------
#  Проекты: сохранить / открыть (как проект во FL Studio).
#  Файлы лежат в  output/Neron_Projects/<тип>/<название>.json
#  Тип: drum (драм-машина), piano (пианино), mixer (микшер), arrange (поле).
# ----------------------------------------------------------------------------

KINDS = ("drum", "piano", "mixer", "arrange")

routes = PromptServer.instance.routes


def _project_dir(kind):
    return os.path.join(folder_paths.get_output_directory(), "Neron_Projects", kind)


def _clean_name(value):
    if not isinstance(value, str):
        return None
    value = re.sub(r"[^\w\-. ]", "_", value).strip(" .")
    return value[:80] or None


def _kind(value):
    return value if value in KINDS else None


@routes.get("/neron/project_list")
async def neron_project_list(request):
    kind = _kind(request.query.get("kind"))
    if kind is None:
        return web.json_response({"ok": False, "error": "Неизвестный тип проекта"}, status=400)
    folder = _project_dir(kind)
    items = []
    try:
        for n in os.listdir(folder):
            if n.lower().endswith(".json"):
                p = os.path.join(folder, n)
                if os.path.isfile(p):
                    items.append((os.path.getmtime(p), n[:-5]))
    except OSError:
        pass
    items.sort(reverse=True)
    return web.json_response({"ok": True, "dir": folder, "names": [n for _, n in items]})


@routes.post("/neron/project_save")
async def neron_project_save(request):
    try:
        body = await request.json()
        kind = _kind(body.get("kind"))
        name = _clean_name(body.get("name"))
        if kind is None or name is None:
            return web.json_response({"ok": False, "error": "Недопустимое название"}, status=400)
        folder = _project_dir(kind)
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, name + ".json")
        payload = {"app": "NeronAudio", "kind": kind, "saved": int(time.time()), "data": body.get("data")}
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        os.replace(tmp, path)
        return web.json_response({"ok": True, "name": name, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.get("/neron/project_load")
async def neron_project_load(request):
    try:
        kind = _kind(request.query.get("kind"))
        name = _clean_name(request.query.get("name"))
        if kind is None or name is None:
            return web.json_response({"ok": False, "error": "Недопустимое название"}, status=400)
        path = os.path.join(_project_dir(kind), name + ".json")
        if not os.path.isfile(path):
            return web.json_response({"ok": False, "error": "Проект не найден: " + name}, status=404)
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        return web.json_response({"ok": True, "name": name, "data": payload.get("data")})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron/project_delete")
async def neron_project_delete(request):
    try:
        body = await request.json()
        kind = _kind(body.get("kind"))
        name = _clean_name(body.get("name"))
        if kind is None or name is None:
            return web.json_response({"ok": False, "error": "Недопустимое название"}, status=400)
        path = os.path.join(_project_dir(kind), name + ".json")
        if os.path.isfile(path):
            os.remove(path)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)
