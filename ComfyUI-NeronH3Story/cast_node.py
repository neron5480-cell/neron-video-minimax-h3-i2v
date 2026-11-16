# -*- coding: utf-8 -*-
"""🗂 Neron H3 Картотека — образцы для ВСЕГО ролика: герой, второй герой или существо, место или предмет.
Три окна (картинка + подпись «кто это»). Один провод `cast` в движок 🎬 Neron H3 Story: каждый образец идёт
<Picture N> в КАЖДЫЙ блок, и подпись говорит модели, кто на нём. Так герой не «плывёт» от блока к блоку, даже если в
кадрах-навигаторах его нет. Загрузка прямо в ноде, как в 🖼 Кадрах."""
import hashlib
import os

from . import bus
from .frames_node import NONE, _input_files, _load, _path

SLOTS = ["cast_image_1", "cast_image_2", "cast_image_3"]
NAMES = ["cast_name_1", "cast_name_2", "cast_name_3"]


class NeronH3Cast:
    CATEGORY = "Neron/H3"
    FUNCTION = "make"
    RETURN_TYPES = (bus.CAST_TYPE,)
    RETURN_NAMES = ("cast",)
    DESCRIPTION = ("Картотека ролика: до трёх образцов (герой, существо, место) с подписью — идут в КАЖДЫЙ блок. "
                   "Один провод в 🎬 Neron H3 Story. Cast: up to three references (hero, creature, place) with a "
                   "label — they go into EVERY block. One wire into the Story engine.")

    @classmethod
    def INPUT_TYPES(cls):
        files = [NONE] + _input_files()
        req = {}
        tip_name = ("Кто или что на картинке — коротко, можно по-русски: «парень в тёмном капюшоне и респираторе», "
                    "«летающий дрон корпорации», «тёмный переулок». Пусто — просто образец внешности.\n\nEN: Who or "
                    "what is on the picture, briefly. Empty — just an appearance reference.")
        for i, n in enumerate(NAMES, 1):            # подписи — сверху, окна с картинками — под ними
            req[n] = ("STRING", {"default": "", "multiline": False, "tooltip": tip_name,
                                 "display_name": f"{i} · кто это / who"})
        for i, w in enumerate(SLOTS, 1):
            req[w] = (files, {"default": NONE, "tooltip": f"Образец {i}. / Reference {i}."})
        return {"required": req}

    @classmethod
    def VALIDATE_INPUTS(cls, **kw):
        return True          # файла из чужой схемы нет — окно просто пустое, в отчёте записка

    @classmethod
    def IS_CHANGED(cls, **kw):
        h = hashlib.sha256()
        for w in SLOTS + NAMES:
            v = kw.get(w, "")
            h.update(str(v).encode("utf-8"))
            p = _path(v) if w in SLOTS else None
            if p:
                st = os.stat(p)
                h.update(f"{st.st_size}:{st.st_mtime_ns}".encode())
        return h.hexdigest()

    def make(self, **kw):
        items, parts, lost = [], [], []
        for i, (w, n) in enumerate(zip(SLOTS, NAMES), 1):
            name = kw.get(w, NONE)
            img = _load(name)
            if img is None and name and name != NONE:
                lost.append(name)
            label = (kw.get(n) or "").strip()
            items.append((img, label))
            if img is not None:
                parts.append(f"{i}: {label or 'образец'} {int(img.shape[2])}×{int(img.shape[1])}")
        text = " · ".join(parts) if parts else "картотека пуста / empty"
        if lost:
            text += " · ⚠ нет файла / missing: " + ", ".join(lost)
        return {"ui": {"text": [text]}, "result": (bus.cast(items),)}


NODE_CLASS_MAPPINGS = {"NeronH3Cast": NeronH3Cast}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Cast": "🗂 Neron H3 Картотека / Cast"}
