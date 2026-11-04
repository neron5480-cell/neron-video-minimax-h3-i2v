# -*- coding: utf-8 -*-
"""📥 Своя LLM для LTX AutoPrompter: найти подходящую или скачать сама.

Пакет — Qwen 3.5 9B (с зрением) от unsloth на Hugging Face: лицензия Apache 2.0, без регистрации и токена.
Качается в models/LLM/Qwen3.5-9B/ — модель и её зрение (mmproj) лежат в одной папке, чтобы не перепутать
с чужим mmproj.

Правила те же, что у движка: *.part и переименование только после полной загрузки, докачка с места обрыва,
проверка места на диске, проверка, что файл — настоящий GGUF, понятные ошибки на двух языках.
"""
import logging
import os
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

log = logging.getLogger("Neron.LTX.AutoPrompter")
TAG = "[LTX AutoPrompter]"

PACK_REPO = "unsloth/Qwen3.5-9B-GGUF"
PACK_DIR = "Qwen3.5-9B"
PACK_MODEL = "Qwen3.5-9B-Q4_K_M.gguf"
PACK_MMPROJ = "mmproj-F16.gguf"
PACK_PAGE = f"https://huggingface.co/{PACK_REPO}"
CHUNK = 8 * 1024 * 1024
DISK_MARGIN = 2 * 1024 ** 3

QWEN35 = ("qwen3.5", "qwen3_5", "qwen35", "qwen-3.5")


class PackError(RuntimeError):
    pass


def _url(name):
    base = (os.environ.get("HF_ENDPOINT") or "https://huggingface.co").rstrip("/")
    return f"{base}/{PACK_REPO}/resolve/main/{name}"


# ---------------- выбор ----------------

def model_score(name):
    """Насколько модель подходит под системник LTX (написан под Qwen 3.5 9B с зрением)."""
    n = name.lower()
    if "mmproj" in n:
        return -1
    s = 0
    if any(k in n for k in QWEN35):
        s += 100
    if "9b" in n:
        s += 40
    if "q4_k_m" in n:
        s += 3
    return s


def best_model(models):
    """Лучшая из лежащих моделей класса Qwen 3.5, или None."""
    scored = sorted(((model_score(m), m) for m in models), key=lambda x: (-x[0], x[1].lower()))
    if scored and scored[0][0] >= 100:
        return scored[0][1]
    return None


def mmproj_for(model, mmprojs):
    """Зрение к модели: из той же папки → с Qwen 3.5 в имени → None (тогда скачаем из пакета)."""
    folder = model.replace("\\", "/").rsplit("/", 1)[0] if "/" in model.replace("\\", "/") else ""
    same = [m for m in mmprojs if (m.replace("\\", "/").rsplit("/", 1)[0] if "/" in m.replace("\\", "/") else "")
            == folder]
    if same:
        f16 = [m for m in same if "f16" in m.lower()]
        return sorted(f16 or same, key=str.lower)[0]
    named = [m for m in mmprojs if any(k in m.lower() for k in QWEN35)]
    if named:
        return sorted(named, key=str.lower)[0]
    return None


# ---------------- скачивание ----------------

def _is_gguf(path):
    try:
        with open(path, "rb") as f:
            return f.read(4) == b"GGUF"
    except Exception:
        return False


def _probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-Neron-LTX-AutoPrompter", "Range": "bytes=0-0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        cr = r.headers.get("Content-Range") or ""
        if "/" in cr and cr.rsplit("/", 1)[1].isdigit():
            return int(cr.rsplit("/", 1)[1])
        return int(r.headers.get("Content-Length") or 0)


def _fail_http(e, name):
    if e.code == 404:
        return PackError(f"{TAG} Файл «{name}» не найден на {PACK_PAGE} (HTTP 404) — возможно, его переименовали. "
                         f"Скачай Qwen 3.5 9B (GGUF) и mmproj руками в models/LLM, в одну папку.\n\nEN: «{name}» not "
                         f"found (HTTP 404). Download a Qwen 3.5 9B GGUF and its mmproj into models/LLM, one folder.")
    return PackError(f"{TAG} Сервер ответил HTTP {e.code} на «{name}». Попробуй позже.\n\nEN: Server error HTTP {e.code}.")


def _fail_net(e):
    return PackError(f"{TAG} Нет связи с Hugging Face ({getattr(e, 'reason', e)}). Проверь интернет или задай зеркало "
                     f"переменной HF_ENDPOINT.\n\nEN: Cannot reach Hugging Face. Check the connection or set HF_ENDPOINT.")


def ensure_pack(llm_root, need_model=True, need_mmproj=True):
    """Докачать недостающее из пакета. → (имя модели, имя mmproj) в формате списка моделей (Qwen3.5-9B/...)."""
    root = Path(llm_root) / PACK_DIR
    root.mkdir(parents=True, exist_ok=True)
    want = ([PACK_MODEL] if need_model else []) + ([PACK_MMPROJ] if need_mmproj else [])
    todo = []
    for name in want:
        dst = root / name
        if dst.is_file() and _is_gguf(dst):
            continue
        try:
            size = _probe(_url(name))
        except urllib.error.HTTPError as e:
            raise _fail_http(e, name)
        except urllib.error.URLError as e:
            raise _fail_net(e)
        part = root / (name + ".part")
        have = part.stat().st_size if part.is_file() else 0
        if size and have > size:
            part.unlink()
            have = 0
        todo.append((name, size, part, have, dst))

    if todo:
        need = sum(max(0, s - h) for _, s, _, h, _ in todo)
        free = shutil.disk_usage(root).free
        if need + DISK_MARGIN > free:
            raise PackError(f"{TAG} Мало места на диске для LLM: нужно {need / 1024 ** 3:.1f} ГБ (+2 ГБ запаса), "
                            f"свободно {free / 1024 ** 3:.1f} ГБ.\nПапка: {root}\n\nEN: Not enough disk space for the "
                            f"LLM: need {need / 1024 ** 3:.1f} GB, free {free / 1024 ** 3:.1f} GB.")
        total = sum(s for _, s, _, _, _ in todo)
        done = sum(h for _, _, _, h, _ in todo)
        pbar = None
        try:
            import comfy.utils
            pbar = comfy.utils.ProgressBar(max(1, total // 1048576))     # полоска на самой ноде, в МБ
            pbar.update_absolute(done // 1048576)
        except Exception:
            pass
        try:
            import comfy.model_management as mm
            check = mm.throw_exception_if_processing_interrupted
        except Exception:
            check = None
        t0, last = time.time(), 0.0
        for name, size, part, have, dst in todo:
            print(f"{TAG} 📥 скачиваю LLM / downloading: {name} ({size / 1024 ** 3:.2f} ГБ) из {PACK_PAGE}")
            headers = {"User-Agent": "ComfyUI-Neron-LTX-AutoPrompter"}
            if have:
                headers["Range"] = f"bytes={have}-"
            try:
                resp = urllib.request.urlopen(urllib.request.Request(_url(name), headers=headers), timeout=60)
            except urllib.error.HTTPError as e:
                raise _fail_http(e, name)
            except urllib.error.URLError as e:
                raise _fail_net(e)
            with resp:
                if have and resp.status != 206:
                    done -= have
                    have = 0
                with open(part, "ab" if have else "wb") as f:
                    while True:
                        if check:
                            check()          # кнопка «Стоп» в ComfyUI; .part остаётся — докачаем потом
                        try:
                            chunk = resp.read(CHUNK)
                        except Exception as e:
                            raise PackError(f"{TAG} Связь оборвалась ({e}). Запусти ещё раз — докачаю с места "
                                            f"обрыва.\n\nEN: Connection dropped. Run again to resume.")
                        if not chunk:
                            break
                        f.write(chunk)
                        done += len(chunk)
                        if pbar:
                            pbar.update_absolute(done // 1048576)
                        now = time.time()
                        if now - last > 5:
                            last = now
                            sp = (done / 1048576) / max(now - t0, 1e-3)
                            print(f"{TAG}   {done / 1024 ** 3:.2f} / {total / 1024 ** 3:.2f} ГБ, {sp:.0f} МБ/с")
            got = part.stat().st_size
            if size and got != size:
                raise PackError(f"{TAG} «{name}»: скачано {got} из {size} байт. Запусти ещё раз — докачаю.\n\n"
                                f"EN: Incomplete download. Run again to resume.")
            if not _is_gguf(part):
                part.unlink()
                raise PackError(f"{TAG} «{name}» скачался, но это не GGUF (сайт мог вернуть страницу ошибки). Файл "
                                f"удалён, запусти ещё раз.\n\nEN: The downloaded file is not a GGUF.")
            os.replace(part, dst)
            print(f"{TAG} ✅ готово / ready: {dst}")
    return f"{PACK_DIR}/{PACK_MODEL}", f"{PACK_DIR}/{PACK_MMPROJ}"
