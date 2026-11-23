"""RU: Общий канал PROCESS для H3: кадры, промт, длительность. Один источник — шина.

EN: One shared process channel for H3: frames, prompt and duration. One source - the bus.
"""

from __future__ import annotations

import os

import numpy as np
import torch

NONE = "— нет —"

FRAMES_TYPE = "NERON_H3_FRAMES"
BUNDLE_TYPE = "NERON_H3_BUNDLE"

SLOTS = (
    ("first_image", "first"),
    ("mid_image_1", "mid_1"),
    ("mid_image_2", "mid_2"),
    ("last_image", "last"),
)


def input_files() -> list[str]:
    """RU: картинки из input/ для четырёх окон; файл можно загрузить прямо в ноде."""
    try:
        import folder_paths

        d = folder_paths.get_input_directory()
        files = [f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]
        try:
            files = folder_paths.filter_files_content_types(files, ["image"])
        except Exception:
            files = [f for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"))]
        return [NONE] + sorted(files)
    except Exception:
        return [NONE]


def load_frame(name):
    """RU: имя файла из input/ → IMAGE [1,H,W,3]. Уже готовый тензор пропускаем."""
    if name is None or name == "" or name == NONE:
        return None
    if torch.is_tensor(name):
        return name
    try:
        import folder_paths
        from PIL import Image, ImageOps

        p = folder_paths.get_annotated_filepath(str(name))
        if not p or not os.path.isfile(p):
            return None
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            arr = np.asarray(im).astype(np.float32) / 255.0
        return torch.from_numpy(arr)[None, ...]
    except Exception:
        return None


def frames(first=None, mid_1=None, mid_2=None, last=None) -> dict:
    """RU: одно сообщение шины: все четыре кадра в точных адресах."""
    return {"first": first, "mid_1": mid_1, "mid_2": mid_2, "last": last,
            "mid_win": [2 if mid_1 is not None else None, 3 if mid_2 is not None else None]}


def bundle(prompt=None, seconds=None, frame_count=None, frames_data=None, source="process") -> dict:
    """RU: сообщение будущего автопромптера: промт, длительность, кадры.

    EN: a future autoprompter message: prompt, duration and frames.
    """
    return {"source": source, "prompt": prompt, "seconds": seconds,
            "frame_count": frame_count, "frames": frames_data or {}}


def _pick(bus_value, manual_value):
    """RU: провод главнее ручного; пустое сообщение ничего не перебивает."""
    return bus_value if bus_value not in (None, "", NONE) else manual_value


def resolve(bus=None, prompt=None, seconds=None, frame_count=None, manual_frames=None):
    """RU: один ответ для движка. Приоритет: шина → ручное → авто."""
    bus = bus if isinstance(bus, dict) else {}
    got = dict(bus.get("frames") or {})
    manual_frames = manual_frames or {}
    for _widget, key in SLOTS:
        got[key] = _pick(got.get(key), manual_frames.get(key))
    return {
        "prompt": _pick(bus.get("prompt"), prompt),
        "seconds": _pick(bus.get("seconds"), seconds),
        "frame_count": _pick(bus.get("frame_count"), frame_count),
        "frames": got,
        "source": bus.get("source", "manual"),
    }
