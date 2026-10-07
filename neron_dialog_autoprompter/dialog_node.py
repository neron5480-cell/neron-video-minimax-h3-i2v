import os
import json
import time
import re
import atexit
import base64
import io
import ctypes
import platform
import subprocess
import threading
import zipfile
import shutil
import tempfile
import urllib.request
import urllib.error
from collections import deque
from pathlib import Path

import numpy as np
import torch
from PIL import Image
import folder_paths


# ============================================================
#  ПУТИ
# ============================================================
_NODE_DIR = Path(__file__).resolve().parent
_VENDOR_DIR = _NODE_DIR / "vendor"
_PROMPTS_DIR = _NODE_DIR / "prompts"
_SESSIONS_DIR = _NODE_DIR / "sessions"
_SELECTION_FILE = _NODE_DIR / "last_selection.json"

os.makedirs(_PROMPTS_DIR, exist_ok=True)
os.makedirs(_SESSIONS_DIR, exist_ok=True)


# ============================================================
#  ПРЕСЕТЫ РАЗРЕШЕНИЯ
# ============================================================
_RESOLUTION_PRESETS = {
    "Кино 16:9 (1344×768)":  (1344, 768),
    "Телефон 9:16 (768×1344)": (768, 1344),
    "Квадрат 1:1 (1024×1024)": (1024, 1024),
    "Классика 4:3 (1024×768)": (1024, 768),
    "Широкий 21:9 (1536×640)": (1536, 640),
    "Вертикаль 3:4 (768×1024)": (768, 1024),
}

_RESOLUTION_MODE_PRESETS = "Пресеты"
_RESOLUTION_MODE_MANUAL = "Ручной"


def _round_to_divisible(value, by=32):
    v = int(value)
    b = max(1, int(by))
    if b <= 1:
        return max(1, v)
    rounded = (v + b // 2) // b * b
    return max(b, rounded)


# ============================================================
#  ОПРЕДЕЛЕНИЕ ЯЗЫКА ПО ИМЕНИ СИСТЕМНИКА
# ============================================================
def _detect_language_from_prompt(prompt_file: str) -> str:
    if not prompt_file:
        return "ru"

    name = prompt_file.lower()

    if "_en" in name or "english" in name or "_eng" in name:
        return "en"
    if "_ru" in name or "russian" in name or "_rus" in name:
        return "ru"

    try:
        path = _PROMPTS_DIR / prompt_file
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                head = f.read(500)
            if re.search(r"[а-яА-ЯёЁ]", head):
                return "ru"
    except Exception:
        pass

    return "en"


# ============================================================
#  ПРОВЕРКА RAM
# ============================================================
def _get_available_ram_gb() -> float:
    try:
        if platform.system() == "Windows":
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                return stat.ullAvailPhys / (1024 ** 3)
        else:
            try:
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        if line.startswith("MemAvailable:"):
                            kb = int(line.split()[1])
                            return kb / (1024 ** 2)
            except Exception:
                pass
            page_size = os.sysconf("SC_PAGE_SIZE")
            avail_pages = os.sysconf("SC_AVPHYS_PAGES")
            return (page_size * avail_pages) / (1024 ** 3)
    except Exception as e:
        print(f"[Neron Dialog] Не удалось получить RAM: {e}")
    return 0.0


def _get_total_ram_gb() -> float:
    try:
        if platform.system() == "Windows":
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                return stat.ullTotalPhys / (1024 ** 3)
        else:
            try:
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        if line.startswith("MemTotal:"):
                            kb = int(line.split()[1])
                            return kb / (1024 ** 2)
            except Exception:
                pass
            page_size = os.sysconf("SC_PAGE_SIZE")
            total_pages = os.sysconf("SC_PHYS_PAGES")
            return (page_size * total_pages) / (1024 ** 3)
    except Exception:
        pass
    return 0.0


def _get_file_size_gb(path: str) -> float:
    try:
        return os.path.getsize(path) / (1024 ** 3)
    except Exception:
        return 0.0


def _find_lighter_quants(models: list, current_model: str) -> list:
    def base_name(name):
        return re.split(r"[-_.](?:I?Q\d)", name, maxsplit=1)[0].lower()

    base = base_name(current_model)
    if not base:
        return []

    candidates = []
    for m in models:
        if m == current_model:
            continue
        if base_name(m) == base:
            candidates.append(m)

    def size_key(name):
        try:
            llm_dir = Path(folder_paths.models_dir) / "LLM"
            return os.path.getsize(llm_dir / name)
        except Exception:
            return 999999999

    return sorted(candidates, key=size_key)


# ============================================================
#  АВТОВЫБОР
# ============================================================
_VISION_KEYWORDS = (
    "vl", "vision", "llava", "minicpm", "moondream",
    "qwen2-vl", "qwen2.5-vl", "qwen3-vl", "qwen3.5",
    "gemma-3-vision", "gemma3-vision", "gemma-4", "paligemma",
    "idefics", "smolvlm", "phi-3-vision", "phi-4-vision",
)


def _looks_like_vision(name: str) -> bool:
    n = name.lower()
    return any(k in n for k in _VISION_KEYWORDS)


def _auto_pick_model(models: list) -> str:
    if not models or models == ["No_GGUF_Models_Found"]:
        return "No_GGUF_Models_Found"
    vision_models = [m for m in models if _looks_like_vision(m)]
    if vision_models:
        return sorted(vision_models)[0]
    return sorted(models)[0]


def _auto_pick_mmproj(mmprojs: list, model_name: str) -> str:
    candidates = [m for m in mmprojs if m != "No_mmproj_Found"]
    if not candidates:
        return "No_mmproj_Found"
    if len(candidates) == 1:
        return candidates[0]
    model_lower = model_name.lower()
    for kw in ["qwen", "gemma", "llava", "minicpm", "moondream", "idefics", "smolvlm", "phi"]:
        if kw in model_lower:
            matching = [m for m in candidates if kw in m.lower()]
            if matching:
                return sorted(matching)[0]
    f16 = [m for m in candidates if "f16" in m.lower()]
    if f16:
        return sorted(f16)[0]
    return sorted(candidates)[0]


def _auto_pick_prompt(prompts: list) -> str:
    if not prompts or prompts == ["No_prompt_Found"]:
        return "No_prompt_Found"
    if len(prompts) == 1:
        return prompts[0]
    if "director_H3_ru.txt" in prompts:
        return "director_H3_ru.txt"
    if "director_debug.txt" in prompts:
        return "director_debug.txt"
    director = [p for p in prompts if p.lower().startswith("director")]
    if director:
        return sorted(director)[0]
    return sorted(prompts)[0]


def _load_last_selection() -> dict:
    try:
        if _SELECTION_FILE.exists():
            with open(_SELECTION_FILE, "r", encoding="utf-8") as f:
                return json.load(f) or {}
    except Exception as e:
        print(f"[Neron Dialog] last_selection.json не прочитан: {e}")
    return {}


def _save_last_selection(model: str, mmproj: str, director_prompt: str):
    try:
        with open(_SELECTION_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "model": model,
                    "mmproj": mmproj,
                    "director_prompt": director_prompt,
                },
                f, ensure_ascii=False, indent=2,
            )
    except Exception as e:
        print(f"[Neron Dialog] last_selection.json не сохранён: {e}")


# ============================================================
#  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
# ============================================================
_SERVER_PROCESS = None
_SERVER_MODEL_PATH = ""
_SERVER_MMPROJ_PATH = ""
_SERVER_PORT = 8765

# Лог сервера (последние 300 строк), чтобы при крахе видеть причину
_SERVER_LOG = deque(maxlen=300)
_SERVER_LOG_THREAD = None

# Кулдаун после краха — чтобы JS-панель не долбила сервер каждые 1.5 сек
_SERVER_LAST_CRASH = 0.0
_SERVER_CRASH_COOLDOWN = 30.0

# Модель и язык — для человеческой диагностики на нужном языке
_LAST_MODEL_NAME_FOR_DIAG = ""
_DIAG_LANG = "ru"

# Защита от повторных попыток скачать llama-server
_DOWNLOAD_ATTEMPTED = False

_SESSIONS = {}
_DIALOG_LOGS = {}
_LAST_IMAGES = {}
_LAST_IMAGE_SIGNATURES = {}
_LAST_PARAMS = {}
_FINAL_PROMPTS = {}
_MEMORY_WARNED = {}


def _reset_session(session_key: str):
    _SESSIONS.pop(session_key, None)
    _DIALOG_LOGS.pop(session_key, None)
    _FINAL_PROMPTS.pop(session_key, None)
    _MEMORY_WARNED.pop(session_key, None)
    print(f"[Neron Dialog] Сессия '{session_key}' сброшена")


# ============================================================
#  СТРИМИНГ ЛОГА СЕРВЕРА
# ============================================================
def _reader_thread(proc):
    """Читает stdout/stderr llama-server и печатает в консоль ComfyUI."""
    try:
        for raw in iter(proc.stdout.readline, b""):
            try:
                line = raw.decode("utf-8", errors="replace").rstrip()
            except Exception:
                line = repr(raw)
            _SERVER_LOG.append(line)
            print(f"[llama-server] {line}")
    except Exception as e:
        print(f"[Neron Dialog] Ошибка чтения лога сервера: {e}")


# ============================================================
#  ДИАГНОСТИКА КРАХА — ПОНЯТНЫЙ ТЕКСТ RU/EN
# ============================================================
def _diagnose_server_crash(model_name: str = "", lang: str = "ru") -> str:
    """Превращает лог llama-server в понятное сообщение для чата (RU/EN)."""
    log_lines = [ln for ln in _SERVER_LOG if ln.strip()]
    log_text = "\n".join(log_lines)
    low = log_text.lower()
    en = (lang == "en")

    # 1. mmproj не подходит к модели
    m = re.search(
        r"text model \(n_embd = (\d+)\).*?mmproj \(n_embd = (\d+)\)",
        log_text, re.IGNORECASE | re.DOTALL,
    )
    if m:
        short = model_name[:25] if model_name else ("MODEL" if en else "МОДЕЛЬ")
        if en:
            return (
                f"❌ mmproj doesn't match the model.\n\n"
                f"Model dimension: {m.group(1)}, mmproj: {m.group(2)}.\n"
                f"These are files from different models.\n\n"
                f"What to do:\n"
                f"1. Open the page where you downloaded the model"
                + (f' "{model_name}"' if model_name else "") + "\n"
                f"2. Download mmproj FROM THE SAME REPO "
                f"(usually mmproj-F16.gguf or mmproj-BF16.gguf)\n"
                f"3. RENAME it when saving, e.g.: mmproj-{short}-F16.gguf\n"
                f"   (otherwise models with the same filename overwrite each other)\n"
                f"4. Put it in models/LLM/ and select it in the node (expert_mode = true)"
            )
        return (
            f"❌ mmproj не подходит к модели.\n\n"
            f"У модели размерность {m.group(1)}, у mmproj — {m.group(2)}.\n"
            f"Это файлы от разных моделей.\n\n"
            f"Что делать:\n"
            f"1. Открой страницу, откуда качал модель"
            + (f" «{model_name}»" if model_name else "") + "\n"
            f"2. Скачай mmproj ИЗ ТОЙ ЖЕ РЕПЫ "
            f"(обычно mmproj-F16.gguf или mmproj-BF16.gguf)\n"
            f"3. При сохранении ПЕРЕИМЕНУЙ его, например: mmproj-{short}-F16.gguf\n"
            f"   (иначе разные модели с одинаковым именем затирают друг друга)\n"
            f"4. Положи в models/LLM/ и выбери его в ноде (expert_mode = true)"
        )

    # 2. Мало видеопамяти
    if "out of memory" in low or "cuda_error_out_of_memory" in low:
        if en:
            return (
                "❌ Not enough VRAM for this model.\n\n"
                "Options:\n"
                "• Use a lighter quantization (Q4_K_M instead of Q6/Q8)\n"
                "• Or reduce n_ctx (context) — currently 8192, try 4096"
            )
        return (
            "❌ Не хватило видеопамяти под эту модель.\n\n"
            "Варианты:\n"
            "• Возьми более лёгкую квантизацию (Q4_K_M вместо Q6/Q8)\n"
            "• Или уменьши n_ctx (контекст) — сейчас стоит 8192, попробуй 4096"
        )

    # 3. Старый llama-server не знает модель
    if "unknown model architecture" in low or "unsupported architecture" in low:
        if en:
            return (
                "❌ llama-server is too old for this model.\n\n"
                "Update it:\n"
                "1. Download the latest release: "
                "https://github.com/ggerganov/llama.cpp/releases\n"
                "2. Unpack into this node's vendor/ folder"
            )
        return (
            "❌ llama-server слишком старый для этой модели.\n\n"
            "Обнови:\n"
            "1. Скачай свежий релиз: https://github.com/ggerganov/llama.cpp/releases\n"
            "2. Распакуй в папку vendor/ этой ноды"
        )

    # 4. Нет DLL
    if ("dll" in low) and ("not found" in low or "load failed" in low or "cannot load" in low):
        if en:
            return (
                "❌ Missing system libraries.\n\n"
                "Install Visual C++ Redistributable:\n"
                "https://aka.ms/vs/17/release/vc_redist.x64.exe\n"
                "Then restart ComfyUI."
            )
        return (
            "❌ Не хватает системных библиотек.\n\n"
            "Установи Visual C++ Redistributable:\n"
            "https://aka.ms/vs/17/release/vc_redist.x64.exe\n"
            "Перезапусти ComfyUI."
        )

    # 5. Модель/файл не найден
    if "no such file" in low or "file not found" in low or "can't open" in low:
        if en:
            return (
                "❌ Model or mmproj file not found.\n\n"
                "Check that both files are in models/LLM/ "
                "and their names match the ones selected in the node."
            )
        return (
            "❌ Файл модели или mmproj не найден.\n\n"
            "Проверь, что оба файла лежат в models/LLM/ "
            "и имена совпадают с выбранными в ноде."
        )

    # 6. Что-то другое — показываем последние 5 строк лога
    tail = log_lines[-5:] if log_lines else []
    if tail:
        if en:
            return (
                "❌ llama-server crashed on startup.\n\n"
                "Last log lines:\n"
                + "\n".join(tail) + "\n\n"
                "If unclear — send these lines to the node author."
            )
        return (
            "❌ llama-server упал при загрузке.\n\n"
            "Последние строки лога:\n"
            + "\n".join(tail) + "\n\n"
            "Если не понятно — скинь эти строки автору ноды."
        )

    return "❌ llama-server crashed. Log is empty." if en else "❌ llama-server упал. Лог пуст."


# ============================================================
#  АВТО-СКАЧИВАНИЕ LLAMA-SERVER
# ============================================================
_LLAMA_RELEASE_URL = "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"


def _detect_llama_asset_patterns():
    """Возвращает список подстрок для поиска подходящего zip-ассета в релизе."""
    system = platform.system()
    machine = platform.machine().lower()

    has_nvidia = shutil.which("nvidia-smi") is not None

    if system == "Windows":
        if machine not in ("amd64", "x86_64"):
            return None
        if has_nvidia:
            return [
                "win-cuda-12.4-x64",
                "win-cuda-12.1-x64",
                "win-cuda-x64",
                "win-avx2-x64",
            ]
        return ["win-avx2-x64", "win-avx-x64"]
    if system == "Linux":
        return ["ubuntu-x64", "linux-x64"]
    return None


def _download_llama_server(vendor_dir: Path):
    """Скачивает свежий релиз llama.cpp и распаковывает в vendor_dir."""
    global _DOWNLOAD_ATTEMPTED
    if _DOWNLOAD_ATTEMPTED:
        return None
    _DOWNLOAD_ATTEMPTED = True

    vendor_dir.mkdir(parents=True, exist_ok=True)
    print("[Neron Dialog] llama-server не найден — пробую скачать свежий релиз...")

    try:
        req = urllib.request.Request(
            _LLAMA_RELEASE_URL,
            headers={"User-Agent": "neron-dialog-autoprompter"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            release = json.loads(r.read())
    except Exception as e:
        print(f"[Neron Dialog] Не удалось получить список релизов: {e}")
        return None

    assets = release.get("assets", [])
    patterns = _detect_llama_asset_patterns()
    if not patterns:
        print("[Neron Dialog] Не могу определить подходящую сборку для этой системы")
        return None

    chosen = None
    for pat in patterns:
        for a in assets:
            if pat in a["name"] and a["name"].endswith(".zip"):
                chosen = a
                break
        if chosen:
            break

    if not chosen:
        print(f"[Neron Dialog] В релизе нет подходящего ассета. Искал: {patterns}")
        return None

    print(f"[Neron Dialog] Скачиваю {chosen['name']} "
          f"({chosen.get('size', 0) / 1024 / 1024:.0f} МБ)...")

    tmp_path = None
    try:
        fd, tmp_name = tempfile.mkstemp(suffix=".zip")
        os.close(fd)
        tmp_path = Path(tmp_name)
        urllib.request.urlretrieve(chosen["browser_download_url"], tmp_path)

        print(f"[Neron Dialog] Распаковываю в {vendor_dir}...")
        with zipfile.ZipFile(tmp_path) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
            top_dirs = set(n.split("/")[0] for n in names if "/" in n)
            if len(top_dirs) == 1 and all("/" in n for n in names):
                prefix = list(top_dirs)[0] + "/"
                for member in names:
                    if not member.startswith(prefix):
                        continue
                    target = vendor_dir / member[len(prefix):]
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(member) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
            else:
                zf.extractall(vendor_dir)

        exe_name = "llama-server.exe" if platform.system() == "Windows" else "llama-server"
        exe = vendor_dir / exe_name
        if not exe.exists():
            hits = list(vendor_dir.rglob(exe_name))
            if hits:
                exe = hits[0]
        if exe.exists():
            print(f"[Neron Dialog] ✅ llama-server установлен: {exe}")
            return exe
        print("[Neron Dialog] В архиве не нашёл llama-server")
        return None
    except Exception as e:
        print(f"[Neron Dialog] Ошибка скачивания: {e}")
        return None
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except Exception:
                pass


# ============================================================
#  ПОИСК БИНАРНИКА
# ============================================================
def _find_llama_server():
    # 1. Своя папка vendor
    if _VENDOR_DIR.exists():
        hits = list(_VENDOR_DIR.rglob("llama-server.exe"))
        if hits:
            print(f"[Neron Dialog] llama-server найден в ноде: {hits[0]}")
            return hits[0]

    # 2. Соседняя нода ComfyUI-LLM-text-processor*
    custom_nodes = _NODE_DIR.parent
    for ext_folder in custom_nodes.glob("ComfyUI-LLM-text-processor*"):
        vendor = ext_folder / "vendor"
        if not vendor.exists():
            continue
        hits = list(vendor.rglob("llama-server.exe"))
        if hits:
            print(f"[Neron Dialog] llama-server найден во внешней ноде: {hits[0]}")
            return hits[0]

    # 3. Авто-скачивание в свою vendor
    return _download_llama_server(_VENDOR_DIR)


# ============================================================
#  СЕРВЕР
# ============================================================
def _wait_for_server(port, timeout=180):
    url = f"http://127.0.0.1:{port}/health"
    start = time.time()
    while time.time() - start < timeout:
        if _SERVER_PROCESS is not None and _SERVER_PROCESS.poll() is not None:
            print("[Neron Dialog] ❌ llama-server упал при загрузке. Последние строки вывода:")
            for ln in list(_SERVER_LOG)[-40:]:
                print(f"[llama-server] {ln}")
            raise RuntimeError(
                _diagnose_server_crash(_LAST_MODEL_NAME_FOR_DIAG, _DIAG_LANG)
            )
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    print(f"[Neron Dialog] llama-server готов за {time.time() - start:.1f} сек")
                    return
        except Exception:
            pass
        time.sleep(0.5)
    if _DIAG_LANG == "en":
        raise RuntimeError(f"llama-server didn't start within {timeout} sec.")
    raise RuntimeError(f"llama-server не поднялся за {timeout} сек")


def _start_server(server_exe, model_path, mmproj_path, n_gpu_layers, n_ctx, port=8765):
    global _SERVER_PROCESS, _SERVER_MODEL_PATH, _SERVER_MMPROJ_PATH, _SERVER_LOG_THREAD
    global _SERVER_LAST_CRASH, _LAST_MODEL_NAME_FOR_DIAG

    cmd = [
        str(server_exe),
        "-m", str(model_path),
        "--host", "127.0.0.1",
        "--port", str(port),
        "-ngl", str(n_gpu_layers if n_gpu_layers >= 0 else 999),
        "-c", str(n_ctx),
    ]
    if mmproj_path:
        cmd.extend(["--mmproj", str(mmproj_path)])

    print(f"[Neron Dialog] Запуск: {' '.join(cmd)}")
    _LAST_MODEL_NAME_FOR_DIAG = Path(model_path).stem

    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

    _SERVER_LOG.clear()

    _SERVER_PROCESS = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
        cwd=str(server_exe.parent),
    )
    _SERVER_MODEL_PATH = str(model_path)
    _SERVER_MMPROJ_PATH = str(mmproj_path) if mmproj_path else ""

    _SERVER_LOG_THREAD = threading.Thread(
        target=_reader_thread, args=(_SERVER_PROCESS,), daemon=True,
    )
    _SERVER_LOG_THREAD.start()

    try:
        _wait_for_server(port)
    except Exception:
        _SERVER_LAST_CRASH = time.time()
        raise


def _stop_server():
    global _SERVER_PROCESS, _SERVER_MODEL_PATH, _SERVER_MMPROJ_PATH
    if _SERVER_PROCESS is None:
        return
    print("[Neron Dialog] Остановка llama-server...")
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(_SERVER_PROCESS.pid)],
                capture_output=True,
            )
        else:
            _SERVER_PROCESS.terminate()
            _SERVER_PROCESS.wait(timeout=10)
    except Exception as e:
        print(f"[Neron Dialog] Ошибка остановки: {e}")
    _SERVER_PROCESS = None
    _SERVER_MODEL_PATH = ""
    _SERVER_MMPROJ_PATH = ""
    time.sleep(2)


atexit.register(_stop_server)


def _ensure_server_running(server_exe, model_path, mmproj_path, n_gpu_layers, n_ctx):
    global _SERVER_PROCESS, _SERVER_LAST_CRASH

    if _SERVER_LAST_CRASH and (time.time() - _SERVER_LAST_CRASH) < _SERVER_CRASH_COOLDOWN:
        remaining = int(_SERVER_CRASH_COOLDOWN - (time.time() - _SERVER_LAST_CRASH))
        if _DIAG_LANG == "en":
            raise RuntimeError(
                f"llama-server crashed recently. Retry in {remaining} sec. "
                f"See console above for details."
            )
        raise RuntimeError(
            f"llama-server недавно падал. Повторная попытка через {remaining} сек. "
            f"Причина — в консоли выше."
        )

    same_model = (
        _SERVER_PROCESS is not None
        and _SERVER_PROCESS.poll() is None
        and _SERVER_MODEL_PATH == str(model_path)
        and _SERVER_MMPROJ_PATH == (str(mmproj_path) if mmproj_path else "")
    )
    if same_model:
        print("[Neron Dialog] Сервер уже запущен на этой модели")
        return
    if _SERVER_PROCESS is not None:
        _stop_server()
    _start_server(server_exe, model_path, mmproj_path, n_gpu_layers, n_ctx)


# ============================================================
#  HTTP
# ============================================================
def _chat_completion(messages, max_tokens, temperature, port=8765):
    url = f"http://127.0.0.1:{port}/v1/chat/completions"
    payload = {
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    body = json.dumps(payload).encode("utf-8")

    print(f"[Neron Dialog] Размер запроса: {len(body) / 1024 / 1024:.2f} МБ")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        print(f"[Neron Dialog] HTTP {e.code} от llama-server. Тело ответа:")
        print(error_body[:2000])
        raise RuntimeError(
            f"llama-server returned {e.code}. See console above."
            if _DIAG_LANG == "en"
            else f"llama-server вернул {e.code}. Смотри консоль выше."
        ) from e


# ============================================================
#  УТИЛИТЫ
# ============================================================
def _comfy_image_to_data_uri(image_tensor, max_size: int = 768, quality: int = 85) -> str:
    img_np = (image_tensor[0].cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
    pil_img = Image.fromarray(img_np)

    w, h = pil_img.size
    if max(w, h) > max_size:
        scale = max_size / max(w, h)
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        pil_img = pil_img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=quality, optimize=True)
    data = buf.getvalue()
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def _load_system_prompt(prompt_file: str) -> str:
    if not prompt_file or prompt_file == "No_prompt_Found":
        return "You are a helpful assistant." if _DIAG_LANG == "en" else "Ты — полезный ассистент."
    path = _PROMPTS_DIR / prompt_file
    if not path.exists():
        print(f"[Neron Dialog] Системник не найден: {path}")
        return "You are a helpful assistant." if _DIAG_LANG == "en" else "Ты — полезный ассистент."
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        print(f"[Neron Dialog] Системник загружен: {prompt_file} ({len(text)} символов)")
        return text if text else (
            "You are a helpful assistant." if _DIAG_LANG == "en"
            else "Ты — полезный ассистент."
        )
    except Exception as e:
        print(f"[Neron Dialog] Ошибка чтения системника: {e}")
        return "You are a helpful assistant." if _DIAG_LANG == "en" else "Ты — полезный ассистент."


def _log_message(session_key: str, role: str, content: str):
    if session_key not in _DIALOG_LOGS:
        _DIALOG_LOGS[session_key] = []
    _DIALOG_LOGS[session_key].append({"role": role, "content": content})


def _check_memory_and_warn(session_key: str, model_name: str, models_list: list, lang: str = "ru"):
    if _MEMORY_WARNED.get(session_key):
        return

    try:
        llm_dir = Path(folder_paths.models_dir) / "LLM"
    except Exception:
        llm_dir = _NODE_DIR / ".." / ".." / "models" / "LLM"

    model_path = llm_dir / model_name
    if not model_path.exists():
        return

    model_size = _get_file_size_gb(str(model_path))
    avail_ram = _get_available_ram_gb()
    total_ram = _get_total_ram_gb()

    if model_size <= 0 or avail_ram <= 0:
        return

    reserve = 4.0
    needed = model_size + reserve

    if needed > avail_ram:
        lighter = _find_lighter_quants(models_list, model_name)
        lighter_hint = ""
        if lighter:
            examples = ", ".join(f"«{m}»" for m in lighter[:3])
            if lang == "en":
                lighter_hint = f" For example: {examples}."
            else:
                lighter_hint = f" Например: {examples}."
        else:
            if lang == "en":
                lighter_hint = " Search online for a Q2 or Q3 version."
            else:
                lighter_hint = " Поищи в интернете версию с пометкой Q2 или Q3."

        if lang == "en":
            warn_text = (
                f"⚠ Listen, there's one problem. You have {avail_ram:.1f} GB "
                f"of available RAM (total {total_ram:.1f} GB), but the model "
                f"«{model_name}» weighs {model_size:.1f} GB. With system overhead "
                f"and buffer you need at least {needed:.1f} GB.\n\n"
                f"It will likely lag or crash. Take something lighter — "
                f"Q2 or Q3 will work just as well, without choking your system."
                f"{lighter_hint}\n\n"
                f"You can change it in expert_mode. Let me know when you're ready."
            )
        else:
            warn_text = (
                f"⚠ Слушай, тут одна проблема. У тебя доступно {avail_ram:.1f} ГБ "
                f"оперативки (всего {total_ram:.1f} ГБ), а модель «{model_name}» "
                f"весит {model_size:.1f} ГБ. С учётом системы и буфера нужно "
                f"минимум {needed:.1f} ГБ.\n\n"
                f"Скорее всего будет тормозить или падать. Возьми что-то полегче — "
                f"Q2 или Q3 справятся не хуже, но не будут душить систему."
                f"{lighter_hint}\n\n"
                f"Поменять можно в expert_mode. Как надумаешь — пиши, продолжим."
            )

        _log_message(session_key, "assistant", warn_text)
        _MEMORY_WARNED[session_key] = True
        print(f"[Neron Dialog] ⚠ Предупреждение о нехватке RAM: "
              f"{model_size:.1f} + {reserve} > {avail_ram:.1f} ГБ")
    else:
        print(f"[Neron Dialog] RAM в порядке: модель {model_size:.1f} ГБ, "
              f"доступно {avail_ram:.1f} ГБ")


def _build_first_user_messages(user_text: str, images: dict, lang: str = "ru") -> list:
    messages = []

    order = ["ref_image_0", "ref_image_1", "ref_image_2", "last_frame"]
    present = [s for s in order if s in images]

    if not present:
        return [{"role": "user", "content": user_text}]

    if lang == "en":
        header_lines = [f"Attached pictures: {len(present)}."]
        pic_idx = 1
        for slot in present:
            if slot == "ref_image_0":
                header_lines.append(f"Picture {pic_idx} — main (first frame).")
                pic_idx += 1
            elif slot == "last_frame":
                header_lines.append("Last frame — the final frame.")
            else:
                header_lines.append(f"Picture {pic_idx} — extra reference.")
                pic_idx += 1
        ack_text = "Understood, I see the attached pictures."
        img_prefix = "Picture"
        last_prefix = "Last frame (final frame):"
        last_ack = "I see the last frame."
    else:
        header_lines = [f"К сообщению приложено картинок: {len(present)}."]
        pic_idx = 1
        for slot in present:
            if slot == "ref_image_0":
                header_lines.append(f"Picture {pic_idx} — основная (первый кадр).")
                pic_idx += 1
            elif slot == "last_frame":
                header_lines.append("Last frame — последний кадр (финал).")
            else:
                header_lines.append(f"Picture {pic_idx} — дополнительный референс.")
                pic_idx += 1
        ack_text = "Понял, вижу приложенные картинки."
        img_prefix = "Picture"
        last_prefix = "Last frame (финальный кадр):"
        last_ack = "Вижу последний кадр."

    messages.append({"role": "user", "content": " ".join(header_lines)})
    messages.append({"role": "assistant", "content": ack_text})

    pic_idx = 1
    for slot in present:
        if slot == "last_frame":
            label = last_prefix
            ack = last_ack
        else:
            label = f"{img_prefix} {pic_idx}:"
            if lang == "en":
                ack = f"I see {label.lower()}"
            else:
                ack = f"Вижу {label.lower()}"
            pic_idx += 1

        try:
            data_uri = _comfy_image_to_data_uri(images[slot])
        except Exception as e:
            print(f"[Neron Dialog] Ошибка обработки {slot}: {e}")
            continue

        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": label},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        })
        messages.append({"role": "assistant", "content": ack})

    messages.append({"role": "user", "content": user_text})

    return messages


# ============================================================
#  ОБЩАЯ ЛОГИКА ДИАЛОГА
# ============================================================
def _process_message(session_key: str, user_text: str, params: dict,
                     images: dict = None, hidden=False):
    global _DIAG_LANG

    model_path = params["model_path"]
    mmproj_path = params["mmproj_path"]
    n_gpu_layers = params["n_gpu_layers"]
    n_ctx = params["n_ctx"]
    max_tokens = params["max_tokens"]
    temperature = params["temperature"]
    director_prompt = params["director_prompt"]

    if not model_path or not Path(model_path).exists():
        if _DIAG_LANG == "en":
            raise RuntimeError(f"Model not found: {model_path}")
        raise RuntimeError(f"Модель не найдена: {model_path}")

    # Определяем язык ДО старта сервера — чтобы диагностика была на нужном языке
    _DIAG_LANG = _detect_language_from_prompt(director_prompt)

    server_exe = _find_llama_server()
    if server_exe is None:
        if _DIAG_LANG == "en":
            raise RuntimeError("llama-server.exe not found and could not be downloaded.")
        raise RuntimeError("llama-server.exe не найден и не удалось скачать.")

    _ensure_server_running(server_exe, model_path, mmproj_path, n_gpu_layers, n_ctx)

    if session_key not in _SESSIONS:
        _SESSIONS[session_key] = []

    history = _SESSIONS[session_key]

    if not history:
        system_text = _load_system_prompt(director_prompt)
        history.append({"role": "system", "content": system_text})

    is_first_user = not any(m["role"] == "user" for m in history)
    lang = _DIAG_LANG

    if is_first_user and images and mmproj_path:
        try:
            first_msgs = _build_first_user_messages(user_text, images, lang)
            history.extend(first_msgs)
            print(f"[Neron Dialog] Прикреплено картинок: {len(images)} (отдельными сообщениями)")
        except Exception as e:
            print(f"[Neron Dialog] Ошибка сборки контента: {e}")
            history.append({"role": "user", "content": user_text})
    else:
        history.append({"role": "user", "content": user_text})

    if not hidden:
        _log_message(session_key, "user", user_text)

    print(f"[Neron Dialog] История: {len(history)} сообщений. Отправка...")
    t0 = time.time()
    try:
        response = _chat_completion(history, max_tokens, temperature, _SERVER_PORT)
        answer = response["choices"][0]["message"]["content"]
        gen_time = time.time() - t0

        if not answer or not answer.strip():
            answer = "⚠ MODEL RETURNED EMPTY" if lang == "en" else "⚠ МОДЕЛЬ ОТВЕТИЛА ПУСТО"

        history.append({"role": "assistant", "content": answer})
        _log_message(session_key, "assistant", answer)

        print(f"[Neron Dialog] Готово за {gen_time:.2f} сек")
        print(f"[Neron Dialog] === ОТВЕТ МОДЕЛИ ===")
        print(answer)
        print(f"[Neron Dialog] ====================")

        return answer

    except Exception as e:
        answer = f"Request error: {e}" if lang == "en" else f"Ошибка запроса: {e}"
        print(f"[Neron Dialog] {answer}")
        if is_first_user and images:
            history.clear()
        elif len(history) > 0 and history[-1]["role"] == "user":
            history.pop()
        _log_message(session_key, "error", answer)
        return answer


# ============================================================
#  НОДА
# ============================================================
class NeronDialogAutoprompter:

    @classmethod
    def INPUT_TYPES(cls):
        try:
            llm_dir = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            llm_dir = _NODE_DIR / ".." / ".." / "models" / "LLM"
        llm_dir.mkdir(parents=True, exist_ok=True)

        all_gguf = [f for f in os.listdir(llm_dir) if f.endswith(".gguf")]
        models = [m for m in all_gguf if "mmproj" not in m.lower()]
        if not models:
            models = ["No_GGUF_Models_Found"]

        mmprojs = ["No_mmproj_Found"] + [m for m in all_gguf if "mmproj" in m.lower()]
        prompts = [f for f in os.listdir(_PROMPTS_DIR) if f.endswith(".txt")]
        if not prompts:
            prompts = ["No_prompt_Found"]

        last = _load_last_selection()

        if last.get("model") in models:
            default_model = last["model"]
        else:
            default_model = _auto_pick_model(models)

        if last.get("mmproj") in mmprojs:
            default_mmproj = last["mmproj"]
        else:
            default_mmproj = _auto_pick_mmproj(mmprojs, default_model)

        if last.get("director_prompt") in prompts:
            default_prompt = last["director_prompt"]
        else:
            default_prompt = _auto_pick_prompt(prompts)

        return {
            "required": {
                "model": (models, {"default": default_model}),
                "mmproj": (mmprojs, {"default": default_mmproj}),
                "director_prompt": (prompts, {"default": default_prompt}),
                "dialog_mode": ("BOOLEAN", {"default": True}),
                "clear_history": ("BOOLEAN", {"default": False}),
                "max_tokens": ("INT", {"default": 4096, "min": 1, "max": 8192}),
                "temperature": ("FLOAT", {"default": 0.70, "min": 0.0, "max": 2.0, "step": 0.01}),
                "n_ctx": ("INT", {"default": 8192, "min": 512, "max": 32768}),
                "n_gpu_layers": ("INT", {"default": -1, "min": -1, "max": 200}),
                "session_id": ("STRING", {"default": "default"}),
                "save_session": ("BOOLEAN", {"default": False}),

                "resolution_mode": ([_RESOLUTION_MODE_PRESETS, _RESOLUTION_MODE_MANUAL],
                                    {"default": _RESOLUTION_MODE_PRESETS}),
                "resolution_preset": (list(_RESOLUTION_PRESETS.keys()),
                                      {"default": "Кино 16:9 (1344×768)"}),
                "manual_width": ("INT", {"default": 1344, "min": 64, "max": 4096, "step": 32}),
                "manual_height": ("INT", {"default": 768, "min": 64, "max": 4096, "step": 32}),
                "divisible_by": ([8, 16, 32, 64, 128], {"default": 32}),

                "user_message": ("STRING", {
                    "multiline": True,
                    "default": "Привет! Что на картинке?",
                }),
                "expert_mode": ("BOOLEAN", {"default": False}),
                "run_trigger": ("INT", {"default": 0, "min": 0, "max": 999999, "step": 1}),
            },
            "optional": {
                "ref_image_0": ("IMAGE",),
                "ref_image_1": ("IMAGE",),
                "ref_image_2": ("IMAGE",),
                "last_frame": ("IMAGE",),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ("STRING", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "INT", "INT")
    RETURN_NAMES = ("prompt", "ref_image_0", "ref_image_1", "ref_image_2", "last_frame", "width", "height")
    FUNCTION = "process"
    CATEGORY = "Neron/Dialog"

    def process(
        self,
        model, mmproj, director_prompt, dialog_mode,
        clear_history, max_tokens, temperature, n_ctx, n_gpu_layers,
        session_id, save_session,
        resolution_mode, resolution_preset, manual_width, manual_height, divisible_by,
        user_message, expert_mode, run_trigger,
        ref_image_0=None, ref_image_1=None, ref_image_2=None,
        last_frame=None, width=None, height=None,
    ):
        global _DIAG_LANG

        _save_last_selection(model, mmproj, director_prompt)
        _DIAG_LANG = _detect_language_from_prompt(director_prompt)

        source = "default"

        if width is not None and height is not None:
            W, H = int(width), int(height)
            source = "from_input (photoshop)"
        elif resolution_mode == _RESOLUTION_MODE_MANUAL:
            W, H = int(manual_width), int(manual_height)
            source = "manual"
        else:
            W, H = _RESOLUTION_PRESETS.get(
                resolution_preset, (1344, 768)
            )
            source = f"preset: {resolution_preset}"

        W = _round_to_divisible(W, divisible_by)
        H = _round_to_divisible(H, divisible_by)

        print(f"[Neron Dialog] Размер: {W}x{H} ({source}, кратно {divisible_by})")

        if ref_image_0 is None:
            ref_image_0 = torch.zeros((1, H, W, 3), dtype=torch.float32)
            print(f"[Neron Dialog] Нет ref_image_0 → чёрный кадр {W}x{H}")

        if model == "No_GGUF_Models_Found":
            return (
                "No models in models/LLM/" if _DIAG_LANG == "en" else "Ошибка: нет моделей в models/LLM/",
                ref_image_0, ref_image_1, ref_image_2, last_frame, W, H,
            )

        try:
            llm_dir = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            llm_dir = _NODE_DIR / ".." / ".." / "models" / "LLM"

        model_path = llm_dir / model
        mmproj_path = ""
        if mmproj and mmproj != "No_mmproj_Found":
            mmproj_path = str(llm_dir / mmproj)

        sid = (session_id or "default").strip() or "default"
        session_key = f"{sid}|{model}|{mmproj}"

        if clear_history:
            _reset_session(session_key)

        images = {"ref_image_0": ref_image_0}
        if ref_image_1 is not None:
            images["ref_image_1"] = ref_image_1
        if ref_image_2 is not None:
            images["ref_image_2"] = ref_image_2
        if last_frame is not None:
            images["last_frame"] = last_frame

        _LAST_IMAGES[session_key] = images
        _LAST_PARAMS[session_key] = {
            "model_path": str(model_path),
            "mmproj_path": mmproj_path,
            "n_gpu_layers": n_gpu_layers,
            "n_ctx": n_ctx,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "director_prompt": director_prompt,
        }

        try:
            llm_dir_models = [f for f in os.listdir(llm_dir) if f.endswith(".gguf")]
            llm_dir_models = [m for m in llm_dir_models if "mmproj" not in m.lower()]
            lang = _detect_language_from_prompt(director_prompt)
            _check_memory_and_warn(session_key, model, llm_dir_models, lang)
        except Exception as e:
            print(f"[Neron Dialog] Ошибка проверки RAM: {e}")

        ready_prompt = _FINAL_PROMPTS.pop(session_key, "")
        if ready_prompt:
            print(f"[Neron Dialog] Отдаю готовый промпт ({len(ready_prompt)} символов)")
            return (ready_prompt, ref_image_0, ref_image_1, ref_image_2, last_frame, W, H)

        return ("", ref_image_0, ref_image_1, ref_image_2, last_frame, W, H)


# ============================================================
#  HTTP-ЭНДПОИНТЫ
# ============================================================
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/neron_dialog/history")
    async def neron_dialog_history(request):
        session_key = request.query.get("session_key", "")
        log = _DIALOG_LOGS.get(session_key, [])
        return web.json_response({"log": log})

    @PromptServer.instance.routes.post("/neron_dialog/set_params")
    async def neron_dialog_set_params(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        params = data.get("params", {})
        if not session_key:
            return web.json_response({"error": "no session_key"}, status=400)

        try:
            llm_dir = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            llm_dir = _NODE_DIR / ".." / ".." / "models" / "LLM"

        model = params.get("model", "")
        mmproj = params.get("mmproj", "")
        director_prompt = params.get("director_prompt", "")

        if model:
            _save_last_selection(model, mmproj, director_prompt)

        _LAST_PARAMS[session_key] = {
            "model_path": str(llm_dir / model) if model else "",
            "mmproj_path": str(llm_dir / mmproj) if mmproj and mmproj != "No_mmproj_Found" else "",
            "n_gpu_layers": int(params.get("n_gpu_layers", -1)),
            "n_ctx": int(params.get("n_ctx", 8192)),
            "max_tokens": int(params.get("max_tokens", 4096)),
            "temperature": float(params.get("temperature", 0.7)),
            "director_prompt": director_prompt,
        }
        return web.json_response({"ok": True})

    @PromptServer.instance.routes.post("/neron_dialog/set_images")
    async def neron_dialog_set_images(request):
        try:
            data = await request.json()
        except Exception as e:
            print(f"[Neron Dialog] set_images: bad json — {e}")
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        images_info = data.get("images", {})

        if not session_key:
            return web.json_response({"error": "no session_key"}, status=400)

        try:
            input_dir = Path(folder_paths.get_input_directory())
            output_dir = Path(folder_paths.get_output_directory())
            temp_dir = Path(folder_paths.get_temp_directory())

            loaded = {}
            signature_parts = []

            for slot in ["ref_image_0", "ref_image_1", "ref_image_2", "last_frame"]:
                info = images_info.get(slot)
                if not info:
                    continue
                filename = info.get("filename", "")
                if not filename:
                    continue

                type_ = info.get("type", "input")
                subfolder = info.get("subfolder", "")

                base = input_dir
                if type_ == "output":
                    base = output_dir
                elif type_ == "temp":
                    base = temp_dir

                path = base / subfolder / filename
                if not path.exists():
                    print(f"[Neron Dialog] Файл не найден: {path}")
                    continue

                img = Image.open(path).convert("RGB")
                arr = np.array(img, dtype=np.float32) / 255.0
                tensor = torch.from_numpy(arr).unsqueeze(0)
                loaded[slot] = tensor

                signature_parts.append(f"{slot}:{filename}")

            signature = "|".join(sorted(signature_parts))
            old_sig = _LAST_IMAGE_SIGNATURES.get(session_key)
            changed = (old_sig != signature)

            _LAST_IMAGES[session_key] = loaded
            _LAST_IMAGE_SIGNATURES[session_key] = signature

            if changed:
                _reset_session(session_key)
                print(f"[Neron Dialog] Набор картинок изменился → сессия сброшена")
                print(f"[Neron Dialog] Слотов: {list(loaded.keys())}")

            return web.json_response({
                "ok": True,
                "changed": changed,
                "slots": list(loaded.keys()),
            })
        except Exception as e:
            print(f"[Neron Dialog] Ошибка загрузки картинок: {e}")
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/neron_dialog/start")
    async def neron_dialog_start(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        if not session_key:
            return web.json_response({"error": "no session_key"}, status=400)
        if session_key not in _LAST_PARAMS or not _LAST_PARAMS[session_key].get("model_path"):
            return web.json_response({"error": "no params"}, status=400)

        existing = _SESSIONS.get(session_key, [])
        if any(m["role"] == "assistant" for m in existing):
            return web.json_response({"ok": True, "skipped": True})

        director_prompt = _LAST_PARAMS[session_key].get("director_prompt", "")
        lang = _detect_language_from_prompt(director_prompt)
        greeting = "hi" if lang == "en" else "привет"

        print(f"[Neron Dialog] Язык системника: {lang} → приветствие: '{greeting}'")

        try:
            answer = _process_message(
                session_key, greeting, _LAST_PARAMS[session_key],
                images=_LAST_IMAGES.get(session_key),
                hidden=True,
            )
            return web.json_response({"response": answer})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/neron_dialog/send")
    async def neron_dialog_send(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        message = (data.get("message") or "").strip()

        if not session_key:
            return web.json_response({"error": "no session_key"}, status=400)
        if not message:
            return web.json_response({"error": "empty message"}, status=400)
        if session_key not in _LAST_PARAMS or not _LAST_PARAMS[session_key].get("model_path"):
            return web.json_response(
                {"error": "Model not selected yet. Wait a couple of seconds."
                 if _DIAG_LANG == "en"
                 else "Модель ещё не выбрана. Подожди пару секунд."},
                status=400,
            )

        try:
            answer = _process_message(
                session_key, message, _LAST_PARAMS[session_key],
                images=_LAST_IMAGES.get(session_key),
            )
            return web.json_response({"response": answer})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    @PromptServer.instance.routes.post("/neron_dialog/finalize")
    async def neron_dialog_finalize(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        prompt = (data.get("prompt") or "").strip()

        if not session_key:
            return web.json_response({"error": "no session_key"}, status=400)
        if not prompt:
            return web.json_response({"error": "empty prompt"}, status=400)

        _FINAL_PROMPTS[session_key] = prompt

        log = _DIALOG_LOGS.get(session_key, [])
        cleared = 0
        for msg in log:
            if msg.get("role") == "assistant" and "[ARTISTIC_PROMPT]" in msg.get("content", ""):
                msg["content"] = re.sub(
                    r"\[ARTISTIC_PROMPT\][\s\S]*?\[/ARTISTIC_PROMPT\]",
                    "",
                    msg["content"],
                ).strip()
                cleared += 1

        for msg in log:
            if msg.get("role") == "assistant" and not msg.get("content", "").strip():
                msg["content"] = (
                    "(prompt sent to generation)" if _DIAG_LANG == "en"
                    else "(промпт отправлен в генерацию)"
                )

        print(f"[Neron Dialog] Готовый промпт сохранён ({len(prompt)} символов)")
        print(f"[Neron Dialog] Блок [ARTISTIC_PROMPT] вырезан из {cleared} сообщений лога")
        return web.json_response({"ok": True})

    @PromptServer.instance.routes.post("/neron_dialog/reset")
    async def neron_dialog_reset(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        session_key = data.get("session_key", "")
        if session_key:
            _reset_session(session_key)
        return web.json_response({"ok": True})

    print("[Neron Dialog] HTTP-эндпоинты зарегистрированы")

except Exception as e:
    print(f"[Neron Dialog] Не удалось зарегистрировать HTTP-эндпоинты: {e}")