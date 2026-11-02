# -*- coding: utf-8 -*-
"""
Neron Video Sampler / Видео-сэмплер

RU: Стоит между «Видео ×3» и Пультом. Сверху три дорожки — три ролика: выделяете
    кусок «откуда — докуда» и кладёте его в монтаж. Внизу — монтажная лента: куски
    идут друг за другом, их можно резать, переставлять, обрезать. Экран показывает
    результат. ⏭ ПРОПУСТИТЬ — ролики идут в Пульт как есть. 🔇 — без звука роликов.
    Монтаж собирается в настоящий mp4 (точно по кадрам) и уходит в Пульт одним роликом.
    Переходы: надвиньте кусок на предыдущий — на сколько надвинули, столько длится
    переход (наплыв, через тьму/свет, шторка, растворение, круг, проявление). Звук
    на стыке тоже перетекает плавно.
EN: Sits between Video ×3 and the Pult. Three source rows (three clips): select a
    piece and put it into the edit. The edit strip below: pieces play one after
    another; cut, reorder, trim them. ⏭ BYPASS — clips go to the Pult as they are.
    🔇 — no clip sound. The edit is built into a real frame-accurate mp4.
    Transitions: slide a piece over the previous one — the overlap is the transition
    (dissolve, dip to black/white, wipe, pixel dissolve, circle, reveal); audio
    crossfades too.
"""

import os
import json
import hashlib
import asyncio
import numpy as np
from ._deps import sf
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, _num
from .mixer import video_path
from .arrange import probe_video, clip_video_wave, _f
from .mixer import _ffmpeg_exe

# переход → фильтр ffmpeg xfade / transition → ffmpeg xfade filter
TRANS = {
    "fade": "fade",               # наплыв / dissolve
    "dip": "fadeblack",           # через тьму / dip to black
    "white": "fadewhite",         # через свет / dip to white
    "wipe": "smoothleft",         # шторка / wipe
    "dissolve": "dissolve",       # растворение (крупинками) / pixel dissolve
    "circle": "circleopen",       # круг / circle
    "reveal": "custom",           # проявление: сначала тёмное, как карандаш / reveal: dark first
}
# проявление: P идёт 1→0; сначала проступают тёмные места нового кадра, мягкий край 0.25
# reveal: P goes 1→0; dark parts of the new frame come first, soft edge 0.25
REVEAL_EXPR = "A*(1-st(0,clip((1.25*(1-P)-B/255)/0.25,0,1)))+B*ld(0)"

MAX_SRC = 24             # столько роликов даёт «Видео ×24» / as many clips as the Video cube gives
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
            # переход ИЗ предыдущего куска в этот: вид и длина наложения / transition from the previous piece
            "tr": p.get("tr") if p.get("tr") in TRANS else "fade",
            "td": _num(p.get("td", 0), 0.0, 0.0, 10.0),
        })
    return {"bypass": bool(raw.get("bypass", True)), "mute": bool(raw.get("mute", False)), "pieces": pieces}


def _edit_plan(items, pieces):
    """Куски -> план сборки: где каждый кусок стоит в монтаже и сколько он наложен на предыдущий.
    Pieces -> build plan: where each piece sits and how much it overlaps the previous one."""
    segs, first = [], None
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
        segs.append({"k": len(segs), "src_a": a, "len": ln, "dur": info["duration"], "path": path,
                     "ref": items[p["src"]], "tr": p["tr"], "td": p["td"]})
    if not segs:
        return None
    fps = float(first.get("fps") or 24.0)
    fr = 1.0 / fps
    # длины и наложения — ровно по кадрам; наложение не больше половины соседних кусков
    # lengths and overlaps snapped to frames; an overlap is at most half of either neighbour
    for s in segs:
        s["n"] = max(1, int(round(s["len"] * fps)))
    t = 0
    for i, s in enumerate(segs):
        if i == 0:
            s["tdn"] = 0
        else:
            cap = min(segs[i - 1]["n"], s["n"]) // 2
            s["tdn"] = max(0, min(cap, int(round(s["td"] * fps))))
        s["start_n"] = t - s["tdn"]
        t = s["start_n"] + s["n"]
    for s in segs:
        s["a"] = s["start_n"] * fr
        s["b"] = (s["start_n"] + s["n"]) * fr
        s["len"] = s["n"] * fr
        s["td"] = s["tdn"] * fr
    return {"width": int(first.get("width") or 1280) // 2 * 2, "height": int(first.get("height") or 720) // 2 * 2,
            "fps": fps, "segments": segs, "length": t * fr}


def _edit_audio(plan, mute):
    """Звук монтажа: на наложении — плавный переход (один стихает, другой нарастает).
    Edit audio: crossfade on overlaps, 5 ms ramps on hard cuts."""
    total = int(round(plan["length"] * SAMPLE_RATE))
    mix = np.zeros((total, 2), dtype=np.float32)
    if mute:
        return mix
    segs = plan["segments"]
    for i, s in enumerate(segs):
        w = clip_video_wave(s["ref"])
        if w is None or not len(w):
            continue
        i0 = int(round(s["src_a"] * SAMPLE_RATE))
        n = int(round(s["len"] * SAMPLE_RATE))
        piece = w[i0:i0 + n].copy()
        o = int(round(s["a"] * SAMPLE_RATE))
        k = min(len(piece), total - o)
        if k <= 0:
            continue
        piece = piece[:k]
        fin = int(round(s["td"] * SAMPLE_RATE)) if s["td"] > 0 else 220
        nxt = segs[i + 1]["td"] if i + 1 < len(segs) else 0.0
        fout = int(round(nxt * SAMPLE_RATE)) if nxt > 0 else 220
        fin, fout = min(fin, k // 2), min(fout, k // 2)
        if fin > 0:
            piece[:fin] *= np.linspace(0.0, 1.0, fin, dtype=np.float32)[:, None]
        if fout > 0:
            piece[-fout:] *= np.linspace(1.0, 0.0, fout, dtype=np.float32)[:, None]
        mix[o:o + k] += piece
    return mix


def _ffmpeg_version(exe):
    import subprocess
    try:
        r = subprocess.run([exe, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        return r.stdout.decode("utf-8", "ignore").splitlines()[0][:80]
    except Exception:
        return "?"


def _reason(err):
    """Самая полезная строка ошибки ffmpeg (причина обычно в начале, а не в хвосте).
    The most useful ffmpeg error line (the cause is usually first, not last)."""
    lines = [x.strip() for x in err.splitlines() if x.strip()]
    keys = ("do not match", "Invalid", "invalid", "Error", "error", "not", "failed", "Unable")
    for ln in lines:
        if any(k in ln for k in keys) and "Task finished" not in ln and "Conversion failed" not in ln:
            return ln[:300]
    return " | ".join(lines[-3:])[:300]


def build_edit(plan, wav_path, out_path, preset="veryfast"):
    """Монтаж с переходами. Сначала обычная сборка; если ffmpeg ругается — строгая (единая
    частота и шкала времени у каждого звена цепочки). Полный текст ошибки — в консоль.
    The edit with transitions. Normal build first; on failure a strict one (same frame rate
    and time base on every link). The full ffmpeg error goes to the console."""
    exe = _ffmpeg_exe()
    if not exe:
        raise RuntimeError("ffmpeg не найден / ffmpeg not found")
    errs = []
    for strict in (False, True):
        ok, err = _build_edit_try(exe, plan, wav_path, out_path, preset, strict)
        if ok:
            if strict:
                print("[Neron Video Sampler] собрано в строгом режиме / built in strict mode")
            return out_path
        errs.append(err)
    ver = _ffmpeg_version(exe)
    print(f"[Neron Video Sampler] ffmpeg: {exe} ({ver})\n--- ошибка / error (обычная / normal) ---\n{errs[0][-4000:]}"
          f"\n--- ошибка / error (строгая / strict) ---\n{errs[1][-4000:]}")
    raise RuntimeError(f"ffmpeg не смог собрать монтаж / ffmpeg could not build the edit: {_reason(errs[1])} "
                       f"[{ver}; полный текст — в консоли ComfyUI / full text in the ComfyUI console]")


def _build_edit_try(exe, plan, wav_path, out_path, preset, strict):
    W, H, F = plan["width"], plan["height"], plan["fps"]
    segs = plan["segments"]
    # строгий режим: точная дробь частоты и общая шкала времени у всех звеньев
    # strict mode: exact frame-rate fraction and one shared time base on every link
    from fractions import Fraction
    Fq = Fraction(F).limit_denominator(1001)
    fr_s = f"{Fq.numerator}/{Fq.denominator}"
    norm = f",fps={fr_s},settb=AVTB" if strict else ""
    args = [exe, "-y", "-v", "error"]
    chains = []
    for s in segs:
        ln = s["len"]
        ts, te = s["src_a"], min(s["dur"], s["src_a"] + ln)
        post = max(0.0, ln - (te - ts))
        args += ["-i", s["path"]]
        chains.append(
            f"[{s['k']}:v]trim=start={_f(ts)}:end={_f(te)},setpts=PTS-STARTPTS,fps={F},"
            f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,"
            f"setsar=1,format=yuv420p,tpad=stop_duration={_f(post)}:stop_mode=clone,"
            f"trim=duration={_f(ln)},setpts=PTS-STARTPTS{norm}[v{s['k']}]")
    a_in = len(segs)
    args += ["-i", wav_path]
    cur, acc = "v0", segs[0]["len"]
    for s in segs[1:]:
        k = s["k"]
        out = f"x{k}"
        if s["td"] > 0:
            tr = TRANS.get(s["tr"], "fade")
            off = acc - s["td"]
            if tr == "custom":
                chains.append(f"[{cur}]format=gbrp[ga{k}];[v{k}]format=gbrp[gb{k}];"
                              f"[ga{k}][gb{k}]xfade=transition=custom:expr='{REVEAL_EXPR}':duration={_f(s['td'])}:"
                              f"offset={_f(off)},format=yuv420p{norm}[{out}]")
            else:
                chains.append(f"[{cur}][v{k}]xfade=transition={tr}:duration={_f(s['td'])}:offset={_f(off)}{norm}[{out}]")
            acc = acc + s["len"] - s["td"]
        else:
            chains.append(f"[{cur}][v{k}]concat=n=2:v=1:a=0{norm}[{out}]")
            acc = acc + s["len"]
        cur = out
    chains.append(f"[{cur}]null[vout]")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    args += ["-filter_complex", ";".join(chains), "-map", "[vout]", "-map", f"{a_in}:a:0",
             "-c:v", "libx264", "-preset", preset, "-crf", "17", "-pix_fmt", "yuv420p", "-r", fr_s,
             "-c:a", "aac", "-b:a", "192k", "-t", _f(plan["length"]), "-movflags", "+faststart", out_path]
    import subprocess
    try:
        if os.path.isfile(out_path):
            os.remove(out_path)
    except OSError:
        pass
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0 or not os.path.isfile(out_path) or os.path.getsize(out_path) == 0:
        return False, r.stderr.decode("utf-8", "ignore")
    return True, ""


def _edit_key(items, pieces, mute):
    parts = []
    for p in pieces:
        path = video_path(items[p["src"]]) if p["src"] < len(items) else None
        st = os.stat(path) if path else None
        parts.append([path, st.st_mtime if st else 0, st.st_size if st else 0, round(p["in"], 4), round(p["len"], 4),
                      p["tr"], round(p["td"], 4)])
    return hashlib.sha1(json.dumps([parts, bool(mute)]).encode("utf-8")).hexdigest()[:14]


def render_edit(items, pieces, mute):
    """Собрать монтаж в mp4 (или взять уже собранный). -> (ref, длина) или (None, 0)."""
    key = _edit_key(items, pieces, mute)
    name = f"edit_{key}.mp4"
    out_dir = os.path.join(folder_paths.get_output_directory(), *EDIT_SUB.split("/"))
    out = os.path.join(out_dir, name)
    ref = {"name": name, "subfolder": EDIT_SUB, "type": "output", "label": "🎬 Монтаж / Edit"}
    plan = _edit_plan(items, pieces)
    if not plan:
        return None, 0.0
    if os.path.isfile(out) and os.path.getsize(out) > 0:
        return ref, plan["length"]
    os.makedirs(out_dir, exist_ok=True)
    wav = os.path.join(out_dir, f"edit_{key}.wav")
    sf.write(wav, _edit_audio(plan, mute), SAMPLE_RATE, subtype="PCM_16")
    tmp = os.path.join(out_dir, f"edit_{key}.part.mp4")
    try:
        build_edit(plan, wav, tmp, preset="veryfast")
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
