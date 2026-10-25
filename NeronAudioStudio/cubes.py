# -*- coding: utf-8 -*-
"""
Кубики для Пульта / Cubes for the Pult

RU: Видео ×3 — одна нода, в ней до трёх загрузчиков видео. Загрузили ролик —
    открывается следующий слот. Звук ×8 — одна нода, в ней до восьми загрузчиков
    звука. Оба кубика одним проводом идут в Пульт (Neron Mixer), а Пульт сам
    показывает, что пришло и сколько.
EN: Video ×3 — one node with up to three video loaders. Load a clip and the next
    slot opens. Sound ×8 — one node with up to eight audio loaders. Each cube goes
    into the Pult (Neron Mixer) with a single wire; the Pult shows what arrived.
"""

import json

from .drum_machine import _num
from .mixer import AUDIO_EXTS, VIDEO_EXTS, media_path

MAX_VIDEOS = 3
MAX_SOUNDS = 8


def _ref(v, exts, with_trim=False):
    if not isinstance(v, dict) or not isinstance(v.get("name"), str) or not v["name"]:
        return None
    ref = {"name": v["name"], "subfolder": str(v.get("subfolder") or ""), "type": str(v.get("type") or "input")}
    if ref["type"] not in ("input", "output", "temp"):
        ref["type"] = "input"
    if not ref["name"].lower().endswith(exts):
        return None
    if with_trim:
        ref["start"] = _num(v.get("start", 0), 0.0, 0.0, 36000.0)
        ref["end"] = _num(v.get("end", 0), 0.0, 0.0, 36000.0)
    return ref


def _load(cube_json):
    try:
        raw = json.loads(cube_json) if isinstance(cube_json, str) else cube_json
    except Exception:
        raw = {}
    return raw if isinstance(raw, dict) else {}


def parse_video_cube(cube_json):
    out = []
    for c in (_load(cube_json).get("clips") or [])[:MAX_VIDEOS]:
        r = _ref(c, VIDEO_EXTS)
        if r:
            out.append(r)
    return out


def parse_sound_cube(cube_json):
    out = []
    for c in (_load(cube_json).get("sounds") or [])[:MAX_SOUNDS]:
        r = _ref(c, AUDIO_EXTS, with_trim=True)
        if r:
            out.append(r)
    return out


class NeronVideoCube:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"cube_json": ("STRING", {"default": json.dumps({"clips": []})})}}

    RETURN_TYPES = ("NERON_VIDEOS",)
    RETURN_NAMES = ("videos",)
    OUTPUT_TOOLTIPS = ("Ролики для Пульта (Neron Mixer, вход video) / Clips for the Pult (Neron Mixer, video input)",)
    FUNCTION = "load"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "До 3 роликов в одной ноде. Up to 3 clips in one node."

    def load(self, cube_json):
        clips = parse_video_cube(cube_json)
        for c in clips:
            if not media_path(c, VIDEO_EXTS):
                raise RuntimeError(f"[Neron] Видео ×3: файл не найден / file not found: {c['name']}")
        if not clips:
            raise RuntimeError("[Neron] Видео ×3: не выбран ни один ролик / no clip selected")
        return ({"neron": "videos", "clips": clips},)


class NeronSoundCube:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"cube_json": ("STRING", {"default": json.dumps({"sounds": []})})}}

    RETURN_TYPES = ("NERON_SOUNDS",)
    RETURN_NAMES = ("sounds",)
    OUTPUT_TOOLTIPS = ("Звуки для Пульта (Neron Mixer, вход audio_N): каждый станет своим каналом / "
                       "Sounds for the Pult (Neron Mixer, audio_N input): each becomes its own channel",)
    FUNCTION = "load"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "До 8 звуков в одной ноде. Up to 8 sounds in one node."

    def load(self, cube_json):
        sounds = parse_sound_cube(cube_json)
        for c in sounds:
            if not media_path(c, AUDIO_EXTS):
                raise RuntimeError(f"[Neron] Звук ×8: файл не найден / file not found: {c['name']}")
        if not sounds:
            raise RuntimeError("[Neron] Звук ×8: не выбран ни один звук / no sound selected")
        return ({"neron": "sounds", "sounds": sounds},)


NODE_CLASS_MAPPINGS = {"NeronVideoCube": NeronVideoCube, "NeronSoundCube": NeronSoundCube}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronVideoCube": "Neron Video ×3 / Видео ×3", "NeronSoundCube": "Neron Sound ×8 / Звук ×8"}
