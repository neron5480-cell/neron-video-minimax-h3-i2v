# -*- coding: utf-8 -*-
"""🖼 Neron H3 Кадры — все картинки ролика в ОДНОЙ ноде, без отдельных «Загрузить изображение» и лапши:
четыре окна (первый кадр, промежуточный 1, промежуточный 2, последний кадр) — у каждого своя загрузка и превью.
Один провод `frames` уходит в 📝 Story AutoPrompter.

Картинки могут быть любого разрешения и формы — движок сам сводит всё к размеру ролика.
Входов-проводов нет: всё загружается прямо в ноде."""
import hashlib
import os

import numpy as np
import torch

from . import bus

NONE = "— нет / none —"
SLOTS = [("first_image", "first_frame"), ("mid_image_1", "mid_frame_1"), ("mid_image_2", "mid_frame_2"),
         ("last_image", "last_frame")]


def _input_files():
    try:
        import folder_paths
        d = folder_paths.get_input_directory()
        files = [f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]
        try:
            files = folder_paths.filter_files_content_types(files, ["image"])
        except Exception:
            files = [f for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"))]
        return sorted(files)
    except Exception:
        return []


def _path(name):
    if not name or name == NONE:
        return None
    try:
        import folder_paths
        p = folder_paths.get_annotated_filepath(name)
        return p if p and os.path.isfile(p) else None
    except Exception:
        return None


def _load(name):
    """Файл из папки input → IMAGE [1, H, W, 3] (поворот по EXIF, прозрачность — на белом не нужна: просто RGB)."""
    p = _path(name)
    if p is None:
        return None
    from PIL import Image, ImageOps
    with Image.open(p) as im:
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        arr = np.asarray(im).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


class NeronH3Frames:
    CATEGORY = "Neron/H3"
    FUNCTION = "make"
    RETURN_TYPES = (bus.FRAMES_TYPE,)
    RETURN_NAMES = ("frames",)
    DESCRIPTION = ("Кадры ролика в одной ноде: первый, два промежуточных и последний — загрузка прямо в ноде, один "
                   "провод в 📝 Story AutoPrompter. Video frames in one node: first, two middle and last, loaded right "
                   "here, one wire into the Story AutoPrompter.")

    @classmethod
    def INPUT_TYPES(cls):
        files = [NONE] + _input_files()
        tips = {
            "first_image": "Первый кадр — начало ролика и образец внешности <Picture 1> во всех блоках.\n\nEN: The "
                           "opening frame, also the appearance reference <Picture 1>.",
            "mid_image_1": "Промежуточный кадр — что появится по ходу (место, существо, предмет). Когда — решит "
                           "AutoPrompter по сценарию.\n\nEN: A middle picture; the AutoPrompter decides when.",
            "mid_image_2": "Ещё один промежуточный кадр.\n\nEN: Another middle picture.",
            "last_image": "Последний кадр — чем ролик закончится. Ставь кадр той же сцены и ракурса.\n\nEN: The last "
                          "frame — how the video ends; same scene and angle.",
        }
        req = {w: (files, {"default": NONE, "tooltip": tips[w]}) for w, _ in SLOTS}
        return {"required": req}

    @classmethod
    def VALIDATE_INPUTS(cls, first_image, mid_image_1, mid_image_2, last_image):
        # Файла из чужой схемы у человека нет — не красное окно: окно просто пустое, в отчёте записка.
        return True

    @classmethod
    def IS_CHANGED(cls, first_image=NONE, mid_image_1=NONE, mid_image_2=NONE, last_image=NONE, **kw):
        h = hashlib.sha256()
        for name in (first_image, mid_image_1, mid_image_2, last_image):
            p = _path(name)
            h.update(str(name).encode("utf-8"))
            if p:
                st = os.stat(p)
                h.update(f"{st.st_size}:{st.st_mtime_ns}".encode())
        return h.hexdigest()

    def make(self, first_image=NONE, mid_image_1=NONE, mid_image_2=NONE, last_image=NONE):
        names = {"first_image": first_image, "mid_image_1": mid_image_1, "mid_image_2": mid_image_2,
                 "last_image": last_image}
        got, lost = {}, []
        for w, i in SLOTS:
            img = _load(names[w])
            if img is None and names[w] and names[w] != NONE:
                lost.append(names[w])
            got[i] = img
        f = bus.frames(got["first_frame"], (got["mid_frame_1"], got["mid_frame_2"]), got["last_frame"])
        labels = {"first_frame": "первый", "mid_frame_1": "промеж. 1", "mid_frame_2": "промеж. 2",
                  "last_frame": "последний"}
        parts = [f"{labels[i]} {int(got[i].shape[2])}×{int(got[i].shape[1])}" for _, i in SLOTS if got[i] is not None]
        text = " · ".join(parts) if parts else "кадров нет / no frames"
        if lost:
            text += " · ⚠ нет файла / missing: " + ", ".join(lost)
        return {"ui": {"text": [text]}, "result": (f,)}


NODE_CLASS_MAPPINGS = {"NeronH3Frames": NeronH3Frames}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Frames": "🖼 Neron H3 Кадры / Frames"}
