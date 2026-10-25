# -*- coding: utf-8 -*-
"""
Neron Video Sampler / Видео-сэмплер

RU: Стоит между «Видео ×3» и Пультом. Сверху три дорожки — три ролика: выделяете
    кусок «откуда — докуда» и кладёте его в монтаж. Внизу — монтажная лента: куски
    идут друг за другом, их можно резать, переставлять, обрезать. Экран показывает
    результат. ⏭ ПРОПУСТИТЬ — ролики идут в Пульт как есть. 🔇 — без звука роликов.
    Монтаж собирается в настоящий mp4 (точно по кадрам) и уходит в Пульт одним роликом.
EN: Sits between Video ×3 and the Pult. Three source rows (three clips): select a
    piece and put it into the edit. The edit strip below: pieces play one after
    another; cut, reorder, trim them. ⏭ BYPASS — clips go to the Pult as they are.
    🔇 — no clip sound. The edit is built into a real frame-accurate mp4.
"""

import os
import json
import hashlib
import asyncio
import numpy as np
import soundfile as sf
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, _num
from .mixer import video_path
from .arrange import probe_video, clip_video_wave, build_video

MAX_SRC = 3
MAX_PIECES = 200
EDIT_SUB = "Neron_Videos/_edits"


def _default_json():
    return json.dumps({"version": 1, "bypass": True, "mute": False, "pieces": []})


def parse_vsampler(js):
    try:
        raw = json.loads(js) if isinstance(js, str) else js
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    pieces = []
    for p in (raw.get("pieces") or [])[:MAX_PIECES]:
        if not isinstance(p, dict):
            continue
        ln = _num(p.get("len", 0), 0.0, 0.0, 36000.0)
        if ln < 0.04:
            continue
        pieces.append({
            "src": int(_num(p.get("src", 0), 0, 0, MAX_SRC - 1)),
            "in": _num(p.get("in", 0), 0.0, 0.0, 36000.0),
            "len": ln,
        })
    return {"bypass": bool(raw.get("bypass", True)), "mute": bool(raw.get("mute", False)), "pieces": pieces}


def _edit_plan(items, pieces):
    """Куски -> план для build_video (тот же точный по кадрам сборщик, что и в «Поле»)."""
    segs, waves_src = [], []
    t = 0.0
    first = None
    for p in pieces:
        if p["src"] >= len(items):
            continue
        path = video_path(items[p["src"]])
        info = probe_video(path) if path else None
        if not info or info["duration"] <= 0:
            continue
        a = min(p["in"], max(0.0, info["duration"] - 0.04))
        ln = min(p["len"], info["duration"] - a)
        if ln < 0.04:
            continue
        first = first or info
        segs.append({"k": len(segs), "a": t, "b": t + ln, "off": t - a, "dur": info["duration"], "path": path})
        waves_src.append((items[p["src"]], a, ln))
        t += ln
    if not segs:
        return None, None
    fps = float(first.get("fps") or 24.0)
    # кадр — ровно 1/fps: края кусков ставим на кадры, чтобы склейка была точной
    t = 0.0
    for s in segs:
        ln = max(1.0 / fps, round((s["b"] - s["a"]) * fps) / fps)
        src_a = s["a"] - s["off"]
        s["a"], s["b"] = t, t + ln
        s["off"] = t - src_a
        t += ln
    plan = {"width": int(first.get("width") or 1280) // 2 * 2, "height": int(first.get("height") or 720) // 2 * 2, "fps": fps,
            "segments": segs, "trans": "cut", "trans_dur": 0.0, "length": t}
    return plan, waves_src


def _edit_audio(plan, waves_src, mute):
    total = int(round(plan["length"] * SAMPLE_RATE))
    mix = np.zeros((total, 2), dtype=np.float32)
    if mute:
        return mix
    for s, (ref, a, ln) in zip(plan["segments"], waves_src):
        w = clip_video_wave(ref)
        if w is None or not len(w):
            continue
        i0 = int(round(a * SAMPLE_RATE))
        n = int(round((s["b"] - s["a"]) * SAMPLE_RATE))
        piece = w[i0:i0 + n]
        o = int(round(s["a"] * SAMPLE_RATE))
        k = min(len(piece), total - o)
        if k > 0:
            # 5 мс сглаживания на стыках — без щелчков
            piece = piece[:k].copy()
            r = min(220, k // 2)
            if r > 0:
                ramp = np.linspace(0.0, 1.0, r, dtype=np.float32)[:, None]
                piece[:r] *= ramp
                piece[-r:] *= ramp[::-1]
            mix[o:o + k] += piece
    return mix


def _edit_key(items, pieces, mute):
    parts = []
    for p in pieces:
        path = video_path(items[p["src"]]) if p["src"] < len(items) else None
        st = os.stat(path) if path else None
        parts.append([path, st.st_mtime if st else 0, st.st_size if st else 0, round(p["in"], 4), round(p["len"], 4)])
    return hashlib.sha1(json.dumps([parts, bool(mute)]).encode("utf-8")).hexdigest()[:14]


def render_edit(items, pieces, mute):
    """Собрать монтаж в mp4 (или взять уже собранный). -> (ref, длина) или (None, 0)."""
    key = _edit_key(items, pieces, mute)
    name = f"edit_{key}.mp4"
    out_dir = os.path.join(folder_paths.get_output_directory(), *EDIT_SUB.split("/"))
    out = os.path.join(out_dir, name)
    ref = {"name": name, "subfolder": EDIT_SUB, "type": "output", "label": "🎬 Монтаж / Edit"}
    plan, waves_src = _edit_plan(items, pieces)
    if not plan:
        return None, 0.0
    if os.path.isfile(out) and os.path.getsize(out) > 0:
        return ref, plan["length"]
    os.makedirs(out_dir, exist_ok=True)
    wav = os.path.join(out_dir, f"edit_{key}.wav")
    sf.write(wav, _edit_audio(plan, waves_src, mute), SAMPLE_RATE, subtype="PCM_16")
    tmp = os.path.join(out_dir, f"edit_{key}.part.mp4")
    try:
        build_video(plan, wav, tmp, preset="veryfast")
        os.replace(tmp, out)
        _prune(out_dir, keep=24)
    finally:
        for f in (wav, tmp):
            try:
                if os.path.isfile(f):
                    os.remove(f)
            except OSError:
                pass
    return ref, plan["length"]


def _prune(folder, keep=24):
    """Старые черновые сборки монтажа удаляются — папка не разрастается."""
    try:
        files = sorted((os.path.join(folder, f) for f in os.listdir(folder) if f.startswith("edit_") and f.endswith(".mp4")),
                       key=os.path.getmtime, reverse=True)
        for f in files[keep:]:
            os.remove(f)
    except OSError:
        pass


_render_lock = asyncio.Lock()


@PromptServer.instance.routes.post("/neron/vsampler_render")
async def neron_vsampler_render(request):
    try:
        data = await request.json()
        items = [v for v in (data.get("videos") or [])[:MAX_SRC] if isinstance(v, dict)]
        vs = parse_vsampler(data.get("json", "{}"))
        if not vs["pieces"]:
            return web.json_response({"ok": True, "ref": None, "length": 0})
        loop = asyncio.get_running_loop()
        async with _render_lock:
            ref, length = await loop.run_in_executor(None, render_edit, items, vs["pieces"], vs["mute"])
        return web.json_response({"ok": True, "ref": ref, "length": length})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


class NeronVideoSampler:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {"vsampler_json": ("STRING", {"default": _default_json()})},
            "optional": {"videos": ("NERON_VIDEOS",)},
        }

    RETURN_TYPES = ("NERON_VIDEOS",)
    RETURN_NAMES = ("videos",)
    OUTPUT_TOOLTIPS = ("В Пульт (вход video): монтаж одним роликом, или ролики как есть (⏭) / "
                       "To the Pult (video input): the edit as one clip, or the clips as they are (⏭)",)
    FUNCTION = "process"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "Видео-сэмплер между «Видео ×3» и Пультом. Video sampler between Video ×3 and the Pult."

    def process(self, vsampler_json, videos=None):
        items = list((videos or {}).get("clips") or []) if isinstance(videos, dict) else []
        vs = parse_vsampler(vsampler_json)
        if vs["bypass"]:
            return ({"neron": "videos", "clips": items, "mute": vs["mute"]},)
        if not vs["pieces"]:
            # сэмплер включён, но монтаж пуст — в Пульт не идёт ни одного ролика
            return ({"neron": "videos", "clips": [], "mute": vs["mute"]},)
        ref, _ = render_edit(items, vs["pieces"], vs["mute"])
        return ({"neron": "videos", "clips": [ref] if ref else [], "mute": vs["mute"]},)


NODE_CLASS_MAPPINGS = {"NeronVideoSampler": NeronVideoSampler}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronVideoSampler": "Neron Video Sampler / Видео-сэмплер 🎬"}
