# -*- coding: utf-8 -*-
"""Автозагрузка моделей: проверили — есть, работаем; нет — скачали сами из официального источника.

Правило: пользователь не должен искать файлы по интернету и раскладывать их по папкам.
  * качаем только с официального репозитория (HuggingFace, Comfy-Org);
  * пишем во временный файл *.part и переименовываем, только когда скачалось целиком —
    оборванная загрузка никогда не выдаёт себя за готовую модель;
  * после загрузки проверяем, что это настоящий safetensors, а не страница с ошибкой;
  * если HuggingFace недоступен — понятное сообщение: откуда скачать руками и куда положить.
    Можно задать зеркало переменной окружения HF_ENDPOINT (например, https://hf-mirror.com).
"""
import json
import os
import struct
import time
import urllib.error
import urllib.request

HF_REPO = "Comfy-Org/SeedVR2"


def hf_url(repo, path):
    base = (os.environ.get("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
    return f"{base}/{repo}/resolve/main/{path}"


def _folder(kind):
    """Папка моделей Comfy нужного вида (diffusion_models, vae …) — первая из списка."""
    import folder_paths
    paths = folder_paths.get_folder_paths(kind)
    if not paths:
        raise RuntimeError(f"Эстафета: Comfy не знает папку моделей «{kind}»")
    os.makedirs(paths[0], exist_ok=True)
    return paths[0]


def find(kind, name):
    """Полный путь к модели, если она уже лежит в любой из папок Comfy этого вида."""
    try:
        import folder_paths
        p = folder_paths.get_full_path(kind, name)
        if p and os.path.isfile(p):
            return p
    except Exception:
        pass
    return None


def _looks_like_safetensors(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8)
            if len(head) < 8:
                return False
            n = struct.unpack("<Q", head)[0]
            if n <= 0 or n > 100 * 1024 * 1024:
                return False
            json.loads(f.read(n).decode("utf-8"))
        return True
    except Exception:
        return False


def _progress(cb, done, total):
    if cb is None:
        return
    try:
        cb(done, total)
    except Exception:
        pass


def ensure(kind, name, repo_path, repo=HF_REPO, progress=None, check_interrupt=None):
    """Вернуть путь к модели; если её нет — скачать. progress(done_bytes, total_bytes)."""
    p = find(kind, name)
    if p:
        return p
    url = hf_url(repo, repo_path)
    dst = os.path.join(_folder(kind), name)
    part = dst + ".part"
    manual = (f"Скачай вручную / download manually:\n  {url}\n"
              f"и положи сюда / and put it here:\n  {dst}")
    print(f"[PerceptionRelay] скачиваю модель / downloading model: {name}\n  {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-PerceptionRelay"})
    t0 = time.time()
    last_print = 0.0
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            total = int(r.headers.get("Content-Length") or 0)
            done = 0
            with open(part, "wb") as f:
                while True:
                    if check_interrupt:
                        check_interrupt()
                    chunk = r.read(8 * 1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    done += len(chunk)
                    _progress(progress, done, total)
                    try:
                        from . import core_comfy
                        if time.time() - getattr(ensure, "_t", 0) > 0.5:
                            ensure._t = time.time()
                            core_comfy.send("perception_relay.progress",
                                            {"stage": f"скачиваю модель / downloading: {name} (МБ / MB)",
                                             "i": done // 1048576, "total": max(1, total // 1048576)})
                    except Exception:
                        pass
                    now = time.time()
                    if now - last_print > 5:
                        last_print = now
                        mb = done / 1048576
                        sp = mb / max(now - t0, 1e-3)
                        tot = f" из {total / 1048576:.0f}" if total else ""
                        print(f"[PerceptionRelay]   {name}: {mb:.0f}{tot} МБ, {sp:.1f} МБ/с")
        if total and done != total:
            raise RuntimeError(f"скачано {done} байт из {total} — связь оборвалась")
        if not _looks_like_safetensors(part):
            raise RuntimeError("скачанный файл не похож на модель (возможно, сайт вернул страницу ошибки)")
        os.replace(part, dst)
    except urllib.error.HTTPError as e:
        _cleanup(part)
        raise RuntimeError(f"Эстафета: не удалось скачать {name} (HTTP {e.code}).\n{manual}") from None
    except urllib.error.URLError as e:
        _cleanup(part)
        raise RuntimeError(f"Эстафета: нет доступа к HuggingFace ({e.reason}). Если сайт заблокирован — "
                           f"задай зеркало переменной HF_ENDPOINT или скачай руками.\n{manual}") from None
    except Exception as e:
        _cleanup(part)
        if type(e).__name__ in ("InterruptProcessingException",):
            raise
        raise RuntimeError(f"Эстафета: загрузка {name} не удалась ({e}).\n{manual}") from None
    print(f"[PerceptionRelay] модель готова / model ready: {dst} ({time.time() - t0:.0f} с)")
    return dst


def _cleanup(path):
    try:
        os.remove(path)
    except OSError:
        pass
