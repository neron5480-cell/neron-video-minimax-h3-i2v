# -*- coding: utf-8 -*-
"""📥 Скачивание пакета моделей для 🎬 Neron LTX Engine — прямо из ноды, с прогрессом на ней.

Правила:
  • качаем только с официальных страниц (Lightricks, Comfy-Org на Hugging Face);
  • пишем в *.part и переименовываем, только когда файл скачан целиком и похож на модель —
    оборванная загрузка никогда не выдаёт себя за готовую;
  • оборвалась связь — следующий запуск докачивает с места обрыва (Range), а не с нуля;
  • до начала проверяем место на диске;
  • модели LTX 2.5 закрыты регистрацией: нужен токен Hugging Face и принятая лицензия.
    Токен хранится только на этом компьютере (папка user ComfyUI), никуда кроме Hugging Face не уходит.
"""
import json
import logging
import os
import shutil
import struct
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

log = logging.getLogger("Neron.LTX.Engine")
_HERE = os.path.dirname(os.path.abspath(__file__))
EVENT = "neron_ltx.download"
LICENSE_URL = "https://huggingface.co/Lightricks/LTX-2.5"
TOKEN_URL = "https://huggingface.co/settings/tokens"
CHUNK = 8 * 1024 * 1024
DISK_MARGIN = 2 * 1024 ** 3          # оставляем 2 ГБ запаса на диске

STATE = {"state": "idle", "file": "", "file_i": 0, "files_n": 0, "done": 0, "total": 0, "speed": 0.0,
         "error": "", "message": ""}
_LOCK = threading.Lock()
_CANCEL = threading.Event()
_THREAD = None


# ---------------- пакеты и файлы ----------------

def load_packs():
    with open(os.path.join(_HERE, "packs.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def default_pack():
    d = load_packs()
    return d["default"], d["packs"][d["default"]]


def file_name(entry):
    return entry["path"].split("/")[-1]


def hf_url(repo, path):
    base = (os.environ.get("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
    return f"{base}/{repo}/resolve/main/{path}"


def find(kind, name):
    """Полный путь к модели, если она уже лежит в любой папке ComfyUI этого вида (в т.ч. в подпапке)."""
    try:
        import folder_paths
        p = folder_paths.get_full_path(kind, name)
        if p and os.path.isfile(p):
            return p
        for f in folder_paths.get_filename_list(kind):
            if f.replace("\\", "/").split("/")[-1] == name:
                p = folder_paths.get_full_path(kind, f)
                if p and os.path.isfile(p):
                    return p
    except Exception:
        pass
    return None


def target_dir(kind):
    import folder_paths
    paths = folder_paths.get_folder_paths(kind)
    if not paths:
        raise RuntimeError(f"ComfyUI не знает папку моделей «{kind}» — обнови ComfyUI / update ComfyUI")
    os.makedirs(paths[0], exist_ok=True)
    return paths[0]


def pack_status(pack=None):
    if pack is None:
        _, pack = default_pack()
    files = []
    for e in pack["files"]:
        n = file_name(e)
        p = find(e["kind"], n)
        part = None
        try:
            part_path = os.path.join(target_dir(e["kind"]), n + ".part")
            if os.path.isfile(part_path):
                part = os.path.getsize(part_path)
        except Exception:
            pass
        files.append({"role": e["role"], "kind": e["kind"], "name": n, "present": bool(p),
                      "gated": bool(e.get("gated")), "partial_bytes": part})
    return files


# ---------------- токен ----------------

def _token_file():
    try:
        import folder_paths
        d = folder_paths.get_user_directory()
    except Exception:
        d = _HERE
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "neron_ltx_engine.json")


def get_token():
    env = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if env:
        return env.strip()
    try:
        with open(_token_file(), "r", encoding="utf-8") as f:
            return (json.load(f).get("hf_token") or "").strip()
    except Exception:
        return ""


def set_token(token):
    path = _token_file()
    data = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        pass
    data["hf_token"] = (token or "").strip()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


# ---------------- сеть ----------------

class _DropAuthOnRedirect(urllib.request.HTTPRedirectHandler):
    """Hugging Face перенаправляет на хранилище файлов (другой адрес). Токен туда не отправляем."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            if urllib.parse.urlparse(newurl).netloc != urllib.parse.urlparse(req.full_url).netloc:
                for h in ("Authorization", "authorization"):
                    new.headers.pop(h, None)
                    new.unredirected_hdrs.pop(h, None)
        return new


_OPENER = urllib.request.build_opener(_DropAuthOnRedirect)


def _request(url, token, start=None, probe=False):
    headers = {"User-Agent": "ComfyUI-Neron-LTX-Engine"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if probe:
        headers["Range"] = "bytes=0-0"
    elif start:
        headers["Range"] = f"bytes={start}-"
    return _OPENER.open(urllib.request.Request(url, headers=headers), timeout=60)


def _probe_size(url, token):
    """Размер файла на сервере (байты) без скачивания."""
    with _request(url, token, probe=True) as r:
        cr = r.headers.get("Content-Range") or ""
        if "/" in cr:
            tail = cr.rsplit("/", 1)[1]
            if tail.isdigit():
                return int(tail)
        return int(r.headers.get("Content-Length") or 0)


def _looks_like_safetensors(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8)
            if len(head) < 8:
                return False
            n = struct.unpack("<Q", head)[0]
            if n <= 0 or n > 200 * 1024 * 1024:
                return False
            json.loads(f.read(n).decode("utf-8"))
        return True
    except Exception:
        return False


# ---------------- состояние и события ----------------

def _send():
    try:
        from server import PromptServer
        PromptServer.instance.send_sync(EVENT, dict(STATE))
    except Exception:
        pass


def _set(**kw):
    with _LOCK:
        STATE.update(kw)
    _send()


class _Fail(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def _gated_message(name):
    return ("Нет доступа к модели «{n}». Модели LTX 2.5 закрыты регистрацией:\n"
            "1) открой {lic} и нажми «Agree and access» (принять лицензию);\n"
            "2) создай токен на {tok} (тип Read) и вставь его в окно скачивания.\n\n"
            "EN: No access to «{n}». LTX 2.5 models are gated: accept the license at {lic}, "
            "create a Read token at {tok} and paste it into the download window."
            ).format(n=name, lic=LICENSE_URL, tok=TOKEN_URL)


def _http_fail(e, name, url):
    if e.code in (401, 403):
        return _Fail("gated", _gated_message(name))
    if e.code == 404:
        return _Fail("not_found", f"Файл «{name}» не найден на сервере (HTTP 404). Возможно, авторы его переименовали.\n"
                                  f"{url}\n\nEN: File not found on the server (HTTP 404).")
    return _Fail("http", f"Сервер ответил ошибкой HTTP {e.code} на «{name}». Попробуй ещё раз позже.\n\n"
                         f"EN: Server error HTTP {e.code}. Try again later.")


def _net_fail(e):
    return _Fail("network", f"Нет связи с Hugging Face ({getattr(e, 'reason', e)}). Проверь интернет. Если сайт "
                            f"заблокирован — можно задать зеркало переменной окружения HF_ENDPOINT.\n\n"
                            f"EN: Cannot reach Hugging Face. Check your connection or set an HF_ENDPOINT mirror.")


# ---------------- скачивание ----------------

def _run(pack):
    token = get_token()
    todo = []
    try:
        _set(state="probing", file="", file_i=0, files_n=0, done=0, total=0, speed=0.0, error="",
             message="Проверяю файлы… / Checking files…")
        for e in pack["files"]:
            n = file_name(e)
            if find(e["kind"], n):
                continue
            if e.get("gated") and not token:
                raise _Fail("no_token", _gated_message(n))
            url = hf_url(e["repo"], e["path"])
            try:
                size = _probe_size(url, token if e.get("gated") else "")
            except urllib.error.HTTPError as he:
                raise _http_fail(he, n, url)
            except urllib.error.URLError as ue:
                raise _net_fail(ue)
            d = target_dir(e["kind"])
            part = os.path.join(d, n + ".part")
            have = os.path.getsize(part) if os.path.isfile(part) else 0
            if size and have > size:
                os.remove(part)
                have = 0
            todo.append({"entry": e, "name": n, "url": url, "size": size, "dir": d, "part": part, "have": have})
        if not todo:
            _set(state="done", message="Все модели на месте ✅ / All models present ✅")
            return

        # место на диске: считаем по каждому диску отдельно
        need_by_dev = {}
        for t in todo:
            dev = os.stat(t["dir"]).st_dev
            need_by_dev.setdefault(dev, [t["dir"], 0])[1] += max(0, t["size"] - t["have"])
        for dev, (d, need) in need_by_dev.items():
            free = shutil.disk_usage(d).free
            if need + DISK_MARGIN > free:
                raise _Fail("no_space",
                            f"Мало места на диске: нужно {need / 1024 ** 3:.1f} ГБ (+2 ГБ запаса), свободно "
                            f"{free / 1024 ** 3:.1f} ГБ.\nПапка: {d}\n\nEN: Not enough disk space: need "
                            f"{need / 1024 ** 3:.1f} GB (+2 GB margin), free {free / 1024 ** 3:.1f} GB.")

        total = sum(t["size"] for t in todo)
        done_all = sum(t["have"] for t in todo)
        t0, b0 = time.time(), done_all
        last_send = 0.0
        for i, t in enumerate(todo, 1):
            _set(state="downloading", file=t["name"], file_i=i, files_n=len(todo), done=done_all, total=total,
                 message="")
            tok = token if t["entry"].get("gated") else ""
            start = t["have"]
            try:
                resp = _request(t["url"], tok, start=start or None)
            except urllib.error.HTTPError as he:
                if he.code == 416 and start:          # сервер не понял докачку — начнём файл заново
                    os.remove(t["part"])
                    done_all -= start
                    start = 0
                    resp = _request(t["url"], tok)
                else:
                    raise _http_fail(he, t["name"], t["url"])
            except urllib.error.URLError as ue:
                raise _net_fail(ue)
            with resp:
                if start and resp.status != 206:      # докачка не поддержана — с нуля
                    done_all -= start
                    start = 0
                mode = "ab" if start else "wb"
                with open(t["part"], mode) as f:
                    while True:
                        if _CANCEL.is_set():
                            raise _Fail("cancelled", "Скачивание остановлено. Нажми ещё раз — продолжу с того же места.\n\n"
                                                     "EN: Download stopped. Press again to resume.")
                        try:
                            chunk = resp.read(CHUNK)
                        except Exception as re_:
                            raise _Fail("network", f"Связь оборвалась ({re_}). Нажми ещё раз — докачаю с места обрыва.\n\n"
                                                   "EN: Connection dropped. Press again to resume.")
                        if not chunk:
                            break
                        f.write(chunk)
                        done_all += len(chunk)
                        now = time.time()
                        if now - last_send > 0.5:
                            last_send = now
                            _set(done=done_all, speed=(done_all - b0) / max(now - t0, 1e-3) / 1024 ** 2)
            got = os.path.getsize(t["part"])
            if t["size"] and got != t["size"]:
                raise _Fail("network", f"«{t['name']}»: скачано {got} байт из {t['size']}. Нажми ещё раз — докачаю.\n\n"
                                       "EN: Incomplete file. Press again to resume.")
            if not _looks_like_safetensors(t["part"]):
                os.remove(t["part"])
                raise _Fail("broken", f"«{t['name']}» скачался, но не похож на модель (сайт мог вернуть страницу "
                                      "ошибки). Файл удалён, попробуй ещё раз.\n\nEN: Downloaded file is not a valid model.")
            os.replace(t["part"], os.path.join(t["dir"], t["name"]))
            log.info("[LTX Engine] модель готова / model ready: %s", t["name"])
        _set(state="done", done=total, total=total, file="", message="Готово! Все модели на месте ✅ / Done ✅")
    except _Fail as f:
        _set(state="cancelled" if f.code == "cancelled" else "error", error=f.code, message=f.message)
        log.warning("[LTX Engine] скачивание: %s", f.message.splitlines()[0])
    except Exception as e:                             # непредвиденное — тоже понятным текстом
        _set(state="error", error="unknown", message=f"Скачивание не удалось: {e}\n\nEN: Download failed: {e}")
        log.exception("[LTX Engine] скачивание")


def start(pack_id=None):
    global _THREAD
    packs = load_packs()
    pack = packs["packs"].get(pack_id or packs["default"])
    if pack is None:
        return False, "Нет такого пакета / no such pack"
    with _LOCK:
        if _THREAD is not None and _THREAD.is_alive():
            return False, "Уже качаю / already downloading"
        _CANCEL.clear()
        _THREAD = threading.Thread(target=_run, args=(pack,), daemon=True, name="neron-ltx-download")
        _THREAD.start()
    return True, ""


def cancel():
    _CANCEL.set()


# ---------------- маршруты для окна в ноде ----------------

def _system_info():
    vram = ram = None
    try:
        import torch
        if torch.cuda.is_available():
            vram = torch.cuda.get_device_properties(0).total_memory / 1024 ** 3
    except Exception:
        pass
    try:
        import psutil
        ram = psutil.virtual_memory().total / 1024 ** 3
    except Exception:
        pass
    return vram, ram


def register_routes():
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return
    routes = PromptServer.instance.routes
    if getattr(PromptServer.instance, "_neron_ltx_routes", False):
        return
    PromptServer.instance._neron_ltx_routes = True

    @routes.get("/neron_ltx/status")
    async def _status(request):
        pid, pack = default_pack()
        files = pack_status(pack)
        vram, ram = _system_info()
        free = None
        try:
            free = shutil.disk_usage(target_dir("diffusion_models")).free / 1024 ** 3
        except Exception:
            pass
        with _LOCK:
            st = dict(STATE)
        return web.json_response({
            "pack_id": pid, "pack_title": pack["title"], "pack_description": pack.get("description", ""),
            "size_note": pack.get("known_size_note", ""), "files": files,
            "all_present": all(f["present"] for f in files), "token_set": bool(get_token()),
            "token_from_env": bool(os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")),
            "free_gb": free, "vram_gb": vram, "ram_gb": ram, "download": st,
            "license_url": LICENSE_URL, "token_url": TOKEN_URL})

    @routes.post("/neron_ltx/token")
    async def _token(request):
        data = await request.json()
        set_token(data.get("token", ""))
        return web.json_response({"ok": True, "token_set": bool(get_token())})

    @routes.post("/neron_ltx/download")
    async def _download(request):
        try:
            data = await request.json()
        except Exception:
            data = {}
        ok, msg = start(data.get("pack"))
        return web.json_response({"ok": ok, "message": msg})

    @routes.post("/neron_ltx/cancel")
    async def _cancel(request):
        cancel()
        return web.json_response({"ok": True})
