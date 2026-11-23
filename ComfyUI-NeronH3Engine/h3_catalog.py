"""RU: Каталог файлов MiniMax H3 и их поиск/докачка.
EN: MiniMax H3 file catalogue, local discovery and resumable download.

RU: Ничего не спрашиваем у человека: нашли файл в любой папке моделей — берём его,
    нет — докачиваем с места обрыва во временный файл и только потом переименовываем.
EN: Never asks the user. A matching file in any model folder is reused; otherwise
    the file is downloaded with resume into a .part file and renamed only when complete.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import time
import urllib.request
from dataclasses import dataclass

import folder_paths

HF = "https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main"
LIGHTX2V = "https://huggingface.co/lightx2v/Minimax-h3-Turbo/resolve/main"


@dataclass(frozen=True)
class FileSpec:
    folder: str          # folder_paths category
    name: str            # preferred exact file name
    url: str
    size: int            # expected size in bytes, tolerance below
    tokens: tuple        # fallback recognition for renamed files
    note: str = ""


CATALOG: dict[str, FileSpec] = {
    "diffusion": FileSpec(
        "diffusion_models",
        "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
        f"{HF}/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors",
        20_970_379_616,
        ("fl2va", "int8_convrot"),
        "основная модель H3; годится и для пустого кадра, и по картинке",
    ),
    "text_turbo": FileSpec(
        "text_encoders",
        "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
        f"{HF}/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
        15_687_142_551,
        ("qwen3vl", "32b", "h3", "nvfp4"),
        "лёгкий текстовый движок для турбо",
    ),
    "text_power": FileSpec(
        "text_encoders",
        "qwen3vl_32b_minimax_h3_int8_convrot.safetensors",
        f"{HF}/text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors",
        27_141_342_152,
        ("qwen3vl", "32b", "h3", "int8_convrot"),
        "полный текстовый движок для мощного режима",
    ),
    "vae_video": FileSpec(
        "vae",
        "minimax_h3_video_vae_int8_convrot.safetensors",
        f"{HF}/vae/minimax_h3_video_vae_int8_convrot.safetensors",
        3_171_670_912,
        ("h3", "video_vae", "int8"),
        "видео-VAE",
    ),
    "vae_audio": FileSpec(
        "vae",
        "minimax_h3_audio_vae_fp32.safetensors",
        f"{HF}/vae/minimax_h3_audio_vae_fp32.safetensors",
        605_254_808,
        ("h3", "audio_vae"),
        "звуковая VAE",
    ),
    "turbo_lora": FileSpec(
        "loras",
        "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
        f"{LIGHTX2V}/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors",
        1_956_193_000,
        ("fl2v", "turbo", "8step"),
        "турбо-LoRA на 8 шагов",
    ),
}


def _near(size: int, expected: int) -> bool:
    return abs(size - expected) <= max(64 * 1024 * 1024, expected * 0.02)


def _writable_dir(kind: str) -> str:
    """RU: папка, куда реально можно писать; в Desktop это обычно ComfyUI-Shared/models."""
    paths = list(folder_paths.get_folder_paths(kind) or [])
    paths.append(os.path.join(folder_paths.get_output_directory(), "neron_models", kind))
    for p in paths:
        try:
            os.makedirs(p, exist_ok=True)
            probe = os.path.join(p, ".neron_write_test")
            with open(probe, "wb") as f:
                f.write(b"ok")
            os.remove(probe)
            return p
        except Exception:
            continue
    raise RuntimeError("Не нашёл папку моделей, куда можно записать файл H3")


def register_shared_paths():
    """RU: Comfy Desktop держит общие модели вне install-папки; регистрируем их сами.

    EN: Comfy Desktop keeps shared models outside the install folder. Register them
    so that the official loaders can resolve plain file names.
    """
    try:
        base = os.path.realpath(folder_paths.get_output_directory())
        for _ in range(5):
            base = os.path.dirname(base)
            if not base or base == os.path.dirname(base):
                break
            shared = os.path.join(base, "ComfyUI-Shared", "models")
            if os.path.isdir(shared):
                for kind in ("diffusion_models", "text_encoders", "vae", "loras", "vae_approx"):
                    path = os.path.join(shared, kind)
                    if os.path.isdir(path):
                        folder_paths.add_model_folder_path(kind, path)
                return True
    except Exception:
        pass
    return False


def all_model_dirs(kind: str) -> list[str]:
    """RU: смотрим все папки этого типа, включая нестандартные пути Comfy Desktop."""
    out = []
    for p in folder_paths.get_folder_paths(kind) or []:
        if p not in out:
            out.append(p)
    # RU: Desktop держит общие модели рядом с install-папкой, а не всегда внутри неё.
    # EN: Comfy Desktop keeps shared models next to the install folder.
    try:
        base = os.path.realpath(folder_paths.get_output_directory())
        for _ in range(5):
            base = os.path.dirname(base)
            if not base or base == os.path.dirname(base):
                break
            shared = os.path.join(base, "ComfyUI-Shared", "models", kind)
            if os.path.isdir(shared) and shared not in out:
                out.append(shared)
    except Exception:
        pass
    return out


def find_local(spec: FileSpec) -> str | None:
    """RU: точное имя важнее; потом файл с тем же размером и понятными словами в имени."""
    folders = all_model_dirs(spec.folder)
    for d in folders:
        candidate = os.path.join(d, spec.name)
        if os.path.isfile(candidate) and _near(os.path.getsize(candidate), spec.size):
            return candidate

    aliases = []
    for d in folders:
        try:
            names = os.listdir(d)
        except Exception:
            continue
        for name in names:
            low = name.lower()
            if not low.endswith(".safetensors") or low.endswith(".part"):
                continue
            if not all(t in low for t in spec.tokens):
                continue
            full = os.path.join(d, name)
            try:
                if os.path.isfile(full) and _near(os.path.getsize(full), spec.size):
                    aliases.append((name != spec.name, full))
            except Exception:
                continue
    if aliases:
        aliases.sort(key=lambda x: (x[0], x[1]))
        return aliases[0][1]
    return None


def _valid_safetensors(path: str) -> bool:
    """RU: проверяем заголовок safetensors — это отсекает страницы ошибок и обрывы."""
    try:
        with open(path, "rb") as f:
            raw = f.read(8)
            if len(raw) != 8:
                return False
            n = int.from_bytes(raw, "little")
            if n <= 0 or n > 100_000_000:
                return False
            head = json.loads(f.read(n).decode("utf-8"))
            return isinstance(head, dict) and bool(head)
    except Exception:
        return False


def ensure(key: str, status=lambda text, pct=None: None) -> str:
    """RU: вернуть путь к файлу, скачав его при необходимости. Докачка с места обрыва."""
    spec = CATALOG[key]
    local = find_local(spec)
    if local:
        status(f"Файл на месте: {os.path.basename(local)}")
        return local

    target_dir = _writable_dir(spec.folder)
    target = os.path.join(target_dir, spec.name)
    part = target + ".part"
    if os.path.isfile(target) and _near(os.path.getsize(target), spec.size) and _valid_safetensors(target):
        return target

    total = 0
    try:
        req = urllib.request.Request(spec.url, method="HEAD", headers={"User-Agent": "NeronH3Engine/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            total = int(r.headers.get("Content-Length") or spec.size)
    except Exception:
        total = spec.size

    free = shutil.disk_usage(target_dir).free
    have = os.path.getsize(part) if os.path.isfile(part) else 0
    if free + have < total * 1.05:
        raise RuntimeError(
            f"На диске мало места: нужно примерно {total / 1e9:.1f} ГБ, свободно {free / 1e9:.1f} ГБ"
        )

    start = have if 0 < have < total else 0
    if start == 0 and have:
        try:
            os.remove(part)
        except Exception:
            pass

    status(f"Качаю {spec.name}: {start / 1e9:.1f} из {total / 1e9:.1f} ГБ", 0)
    mode = "ab" if start else "wb"
    last_report = 0.0
    done = start
    try:
        headers = {"User-Agent": "NeronH3Engine/1.0"}
        if start:
            headers["Range"] = f"bytes={start}-"
        req = urllib.request.Request(spec.url, headers=headers)
        with urllib.request.urlopen(req, timeout=120) as r, open(part, mode) as f:
            length = int(r.headers.get("Content-Length") or 0)
            if start and r.status != 206:
                f.close()
                os.remove(part)
                return ensure(key, status)
            while True:
                chunk = r.read(8 * 1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                now = time.monotonic()
                if now - last_report > 1.5:
                    pct = min(99, int(100 * done / max(total, length + start, 1)))
                    status(f"Качаю {spec.name}: {done / 1e9:.1f} / {total / 1e9:.1f} ГБ", pct)
                    last_report = now
    except Exception:
        status("Закачка прервалась. При следующем запуске продолжу с того же места.")
        raise

    if done < total * 0.98 or not _valid_safetensors(part):
        raise RuntimeError(f"Файл {spec.name} скачан не полностью — удалять не буду, continuing с места обрыва")
    os.replace(part, target)
    status(f"Готово: {spec.name}", 100)
    return target


def ensure_many(keys, status=lambda text, pct=None: None) -> dict[str, str]:
    """RU: качаем по одному, чтобы не съесть память и не потерять прогресс."""
    result = {}
    for i, key in enumerate(keys):
        one = lambda text, pct=None, i=i: status(f"[{i + 1}/{len(keys)}] {text}", pct)
        result[key] = ensure(key, one)
    return result
