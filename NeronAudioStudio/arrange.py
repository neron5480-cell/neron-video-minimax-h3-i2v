# -*- coding: utf-8 -*-
"""
Neron Field / Поле

RU: Общее поле в духе Playlist из FL Studio. Сверху склейка до трёх роликов
    (каждый ролик можно сдвигать по кадрам, два разделителя решают, где какой
    ролик идёт), под ней дорожки со звуком: куски из файлов и из нод студии.
    Куски можно двигать, накладывать, обрезать, резать; у куска и у дорожки
    своя громкость, баланс, появление и затухание.
    Слушать и смотреть можно прямо на ноде (без Queue). Кнопка «Собрать»
    сохраняет звук (WAV) и видео (mp4). Queue отдаёт то же самое дальше по схеме.

EN: A shared field in the spirit of the FL Studio Playlist. On top: up to three
    video clips (each can be shifted frame by frame, two dividers decide which
    clip plays where). Below: audio tracks with pieces from files and from studio
    nodes. Pieces can be moved, overlapped, trimmed and split; every piece and
    track has its own volume, pan, fade in and fade out.
    Watch and listen right on the node (no Queue). "Build" saves the sound (WAV)
    and the video (mp4). Queue passes the same result down the graph.
"""

import os
import re
import json
import time
import asyncio
import subprocess
import threading
from collections import OrderedDict

import numpy as np
import soundfile as sf
import torch
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, _num
from .mixer import (
    AUDIO_EXTS, VIDEO_EXTS, media_path, video_path, load_audio_file, decode_video_audio,
    audio_to_stereo, render_source, _ffmpeg_exe, VideoFromFile, VIDEO_OUT_TYPE,
)

MAX_VIDEO_CLIPS = 3
MAX_TRACKS = 8
MAX_CLIPS = 96
MAX_INPUTS = 6
MAX_SECONDS = 15 * 60.0          # длина поля не больше 15 минут (бережём память)
INPUT_RE = re.compile(r"^audio_(\d+)$")
VIDEO_UPLOAD_SUBDIR = "Neron_Video"
MAX_VIDEO_UPLOAD = 2 * 1024 * 1024 * 1024
CUT_EDGE = 0.005                  # 5 мс: мягкий стык звука на склейке, чтобы не щёлкало

routes = PromptServer.instance.routes


def _t(ru, en):
    return f"{ru} / {en}"


# ----------------------------------------------------------------------------
#  Сведения о видео (длина, кадры в секунду, размер). Кешируются по файлу.
# ----------------------------------------------------------------------------

_info_cache = {}
_info_lock = threading.Lock()


def probe_video(path):
    """{'duration', 'fps', 'width', 'height', 'audio'} или None."""
    try:
        st = os.stat(path)
    except OSError:
        return None
    key = (path, st.st_mtime, st.st_size)
    with _info_lock:
        if key in _info_cache:
            return _info_cache[key]
    info = None
    try:
        import av
        with av.open(path) as c:
            vs = next((x for x in c.streams if x.type == "video"), None)
            has_audio = any(x.type == "audio" for x in c.streams)
            if vs is not None:
                rate = vs.average_rate or vs.guessed_rate
                fps = float(rate) if rate else 24.0
                dur = None
                if vs.duration is not None and vs.time_base is not None:
                    dur = float(vs.duration * vs.time_base)
                if not dur and c.duration:
                    dur = float(c.duration) / 1_000_000.0
                if not dur and vs.frames:
                    dur = vs.frames / fps
                info = {
                    "duration": float(dur or 0.0), "fps": fps,
                    "width": int(vs.codec_context.width or 0), "height": int(vs.codec_context.height or 0),
                    "audio": bool(has_audio),
                }
    except Exception:
        info = None
    if info is None:
        exe = _ffmpeg_exe()
        if exe:
            try:
                r = subprocess.run([exe, "-hide_banner", "-i", path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                txt = r.stderr.decode("utf-8", "ignore")
                m_d = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", txt)
                m_f = re.search(r"(\d+(?:\.\d+)?)\s*fps", txt)
                m_s = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", txt)
                if m_d:
                    dur = int(m_d.group(1)) * 3600 + int(m_d.group(2)) * 60 + float(m_d.group(3))
                    info = {
                        "duration": dur, "fps": float(m_f.group(1)) if m_f else 24.0,
                        "width": int(m_s.group(1)) if m_s else 0, "height": int(m_s.group(2)) if m_s else 0,
                        "audio": "Audio:" in txt,
                    }
            except Exception:
                info = None
    with _info_lock:
        if len(_info_cache) > 64:
            _info_cache.clear()
        _info_cache[key] = info
    return info


# ----------------------------------------------------------------------------
#  Кеш звука (файлы и звук роликов): одно и то же не читаем с диска дважды.
#  Небольшой, чтобы не держать в памяти лишнее.
# ----------------------------------------------------------------------------

_wave_cache = OrderedDict()
_wave_lock = threading.Lock()
_WAVE_CACHE_ITEMS = 8


def _cached(key, loader):
    with _wave_lock:
        if key in _wave_cache:
            _wave_cache.move_to_end(key)
            return _wave_cache[key]
    data = loader()
    with _wave_lock:
        _wave_cache[key] = data
        _wave_cache.move_to_end(key)
        while len(_wave_cache) > _WAVE_CACHE_ITEMS:
            _wave_cache.popitem(last=False)
    return data


def _file_key(path):
    try:
        st = os.stat(path)
        return (path, st.st_mtime, st.st_size)
    except OSError:
        return (path, 0, 0)


def file_wave(src):
    path = media_path({"name": src.get("name", ""), "subfolder": src.get("subfolder", ""), "type": src.get("type", "input")}, AUDIO_EXTS)
    if not path:
        raise RuntimeError(_t("звуковой файл не найден: ", "audio file not found: ") + str(src.get("name")))
    return _cached(("file",) + _file_key(path), lambda: load_audio_file(path))


def clip_video_wave(vsrc):
    """Звук ролика (или None, если звука нет)."""
    path = video_path(vsrc)
    if not path:
        return None
    return _cached(("video",) + _file_key(path), lambda: decode_video_audio(path))


# ----------------------------------------------------------------------------
#  Разбор и проверка описания поля
# ----------------------------------------------------------------------------

def _default_field_json():
    return json.dumps({"version": 1, "master": 0.9, "video": {"clips": [], "cuts": []}, "tracks": []}, ensure_ascii=False)


def _media_ref(v, exts):
    if not isinstance(v, dict) or not isinstance(v.get("name"), str):
        return None
    ref = {"name": v["name"], "subfolder": str(v.get("subfolder") or ""), "type": str(v.get("type") or "input")}
    if ref["type"] not in ("input", "output", "temp"):
        ref["type"] = "input"
    if not ref["name"].lower().endswith(exts):
        return None
    return ref


def parse_field(field_json):
    try:
        raw = json.loads(field_json) if isinstance(field_json, str) else field_json
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}

    vraw = raw.get("video") if isinstance(raw.get("video"), dict) else {}
    vclips = []
    for c in (vraw.get("clips") or [])[:MAX_VIDEO_CLIPS]:
        if not isinstance(c, dict):
            continue
        ref = _media_ref(c.get("src"), VIDEO_EXTS)
        if not ref:
            continue
        vclips.append({"src": ref, "offset": _num(c.get("offset", 0), 0.0, -MAX_SECONDS, MAX_SECONDS)})
    cuts = []
    for x in (vraw.get("cuts") or [])[:MAX_VIDEO_CLIPS - 1]:
        try:
            cuts.append(float(x))
        except Exception:
            pass
    trans = vraw.get("trans") if vraw.get("trans") in ("cut", "fade") else "cut"
    aud = vraw.get("audio") if isinstance(vraw.get("audio"), dict) else {}
    video = {
        "clips": vclips,
        "cuts": cuts,
        "trans": trans,
        "trans_dur": _num(vraw.get("trans_dur", 0.5), 0.5, 0.04, 3.0),
        "audio": {
            "vol": _num(aud.get("vol", 0.8), 0.8, 0.0, 1.5),
            "mute": bool(aud.get("mute", False)),
            "solo": bool(aud.get("solo", False)),
        },
    }

    tracks = []
    n_clips = 0
    for t in (raw.get("tracks") or [])[:MAX_TRACKS]:
        if not isinstance(t, dict):
            continue
        clips = []
        for c in (t.get("clips") or []):
            if n_clips >= MAX_CLIPS or not isinstance(c, dict):
                continue
            s = c.get("src") if isinstance(c.get("src"), dict) else {}
            if s.get("kind") == "input" and isinstance(s.get("slot"), str) and INPUT_RE.match(s["slot"]):
                src = {"kind": "input", "slot": s["slot"]}
            else:
                ref = _media_ref(s, AUDIO_EXTS)
                if not ref:
                    continue
                src = dict(ref, kind="file")
            length = _num(c.get("len", 0), 0.0, 0.0, MAX_SECONDS)
            if length <= 0.001:
                continue
            clips.append({
                "src": src,
                "start": _num(c.get("start", 0), 0.0, 0.0, MAX_SECONDS),
                "in": _num(c.get("in", 0), 0.0, 0.0, MAX_SECONDS),
                "len": length,
                "gain": _num(c.get("gain", 1.0), 1.0, 0.0, 2.0),
                "fin": _num(c.get("fin", 0), 0.0, 0.0, 30.0),
                "fout": _num(c.get("fout", 0), 0.0, 0.0, 30.0),
            })
            n_clips += 1
        tracks.append({
            "vol": _num(t.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(t.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(t.get("mute", False)),
            "solo": bool(t.get("solo", False)),
            "clips": clips,
        })
    return {"master": _num(raw.get("master", 0.9), 0.9, 0.0, 1.5), "video": video, "tracks": tracks}


# ----------------------------------------------------------------------------
#  Склейка видео: какие куски каких роликов идут в итог
# ----------------------------------------------------------------------------

def video_plan(field):
    """Отрезки итогового видео. Возвращает None, если роликов нет.
    {'fps','width','height','length','segments':[{k, a, b, off, dur, path, info}]}"""
    v = field["video"]
    items = []
    for c in v["clips"]:
        path = video_path(c["src"])
        if not path:
            raise RuntimeError(_t("видео не найдено: ", "video not found: ") + c["src"]["name"])
        info = probe_video(path)
        if not info or info["duration"] <= 0:
            raise RuntimeError(_t("не удалось прочитать видео: ", "cannot read video: ") + c["src"]["name"])
        items.append({"path": path, "info": info, "off": c["offset"], "src": c["src"]})
    if not items:
        return None
    fps = items[0]["info"]["fps"] or 24.0
    fr = 1.0 / fps
    snap = lambda x: round(x / fr) * fr          # всё по целым кадрам
    for it in items:
        it["off"] = snap(it["off"])
    end = snap(items[-1]["off"] + items[-1]["info"]["duration"])
    if len(items) == 1:
        end = snap(items[0]["off"] + items[0]["info"]["duration"])
    min_seg = 2 * fr
    cuts = sorted(snap(x) for x in v["cuts"])[: len(items) - 1]
    # если разделителей не хватает — ставим их на стыки роликов
    while len(cuts) < len(items) - 1:
        k = len(cuts)
        cuts.append(snap(items[k]["off"] + items[k]["info"]["duration"]))
    bounds = [0.0]
    for x in cuts:
        bounds.append(max(bounds[-1] + min_seg, x))
    if end < bounds[-1] + min_seg:
        end = bounds[-1] + min_seg
    end = min(end, MAX_SECONDS)
    bounds.append(end)
    segs = []
    for k, it in enumerate(items):
        segs.append({"k": k, "a": bounds[k], "b": bounds[k + 1], "off": it["off"],
                     "dur": it["info"]["duration"], "path": it["path"], "info": it["info"], "src": it["src"]})
    w = int(items[0]["info"]["width"] or 1280) // 2 * 2
    h = int(items[0]["info"]["height"] or 720) // 2 * 2
    return {"fps": fps, "width": max(2, w), "height": max(2, h), "length": end, "segments": segs,
            "trans": v["trans"], "trans_dur": min(v["trans_dur"], max(fr, (end / max(1, len(items))) / 2))}


# ----------------------------------------------------------------------------
#  Сведение звука
# ----------------------------------------------------------------------------

def _ramp(n, up=True):
    if n <= 0:
        return None
    r = np.linspace(0.0, 1.0, n, dtype=np.float32)
    return r if up else r[::-1]


def _place(buf, wave, start_sample, gain=1.0, fin=0, fout=0):
    """Положить кусок звука в буфер (с появлением и затуханием)."""
    if wave is None or len(wave) == 0:
        return
    n = len(wave)
    a = int(start_sample)
    if a >= len(buf):
        return
    piece = wave[: max(0, min(n, len(buf) - a))] if a >= 0 else wave[-a:][: len(buf)]
    a = max(0, a)
    if len(piece) == 0:
        return
    piece = piece * np.float32(gain)
    m = len(piece)
    if fin > 0:
        k = min(m, int(fin))
        piece[:k] *= _ramp(k, True)[:, None]
    if fout > 0:
        k = min(m, int(fout))
        piece[m - k:] *= _ramp(k, False)[:, None]
    buf[a: a + m] += piece


def field_length(field, plan):
    if plan:
        return plan["length"]
    end = 0.0
    for t in field["tracks"]:
        for c in t["clips"]:
            end = max(end, c["start"] + c["len"])
    return min(end, MAX_SECONDS)


def render_field(field, get_input, plan=None):
    """Свести всё поле. get_input(slot) -> массив (отсчёты, 2) или None.
    Возвращает (звук (отсчёты, 2), длина в секундах)."""
    if plan is None:
        plan = video_plan(field)
    L = field_length(field, plan)
    if L <= 0.01:
        raise RuntimeError(_t("поле пустое: добавьте видео или звук", "the field is empty: add a video or a sound"))
    total = int(round(L * SAMPLE_RATE))
    mix = np.zeros((total, 2), dtype=np.float32)

    va = field["video"]["audio"]
    solo_any = va["solo"] or any(t["solo"] for t in field["tracks"])

    def audible(mute, solo):
        return not mute and (not solo_any or solo)

    # звук роликов: каждый отрезок со своего ролика, стыки мягкие
    if plan and audible(va["mute"], va["solo"]):
        buf = np.zeros_like(mix)
        ext = plan["trans_dur"] / 2.0 if plan["trans"] == "fade" else CUT_EDGE
        last = len(plan["segments"]) - 1
        for s in plan["segments"]:
            wave = clip_video_wave(s["src"])
            if wave is None or len(wave) == 0:
                continue
            el = ext if s["k"] > 0 else 0.0
            er = ext if s["k"] < last else 0.0
            t0, t1 = s["a"] - el, s["b"] + er               # время в итоге
            src0 = t0 - s["off"]                            # то же время внутри ролика
            i0 = int(round(src0 * SAMPLE_RATE))
            n = int(round((t1 - t0) * SAMPLE_RATE))
            lo, hi = max(0, i0), min(len(wave), i0 + n)
            if hi <= lo or n <= 0:
                continue
            # кусок ровно на длину отрезка; где у ролика нет звука — тишина
            piece = np.zeros((n, 2), dtype=np.float32)
            piece[lo - i0: hi - i0] = wave[lo:hi]
            _place(buf, piece, int(round(t0 * SAMPLE_RATE)), 1.0,
                   int(2 * el * SAMPLE_RATE), int(2 * er * SAMPLE_RATE))
        mix += buf * np.float32(va["vol"])

    # дорожки
    for t in field["tracks"]:
        if not audible(t["mute"], t["solo"]) or not t["clips"]:
            continue
        buf = np.zeros_like(mix)
        for c in t["clips"]:
            src = c["src"]
            wave = get_input(src["slot"]) if src["kind"] == "input" else file_wave(src)
            if wave is None or len(wave) == 0:
                continue
            i0 = int(round(c["in"] * SAMPLE_RATE))
            n = int(round(c["len"] * SAMPLE_RATE))
            piece = wave[i0: i0 + n]
            _place(buf, piece, int(round(c["start"] * SAMPLE_RATE)), c["gain"],
                   int(c["fin"] * SAMPLE_RATE), int(c["fout"] * SAMPLE_RATE))
        gl = t["vol"] * min(1.0, 1.0 - t["pan"])
        gr = t["vol"] * min(1.0, 1.0 + t["pan"])
        mix += buf * np.array([gl, gr], dtype=np.float32)

    mix *= np.float32(field["master"])
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= np.float32(0.99 / peak)
    return mix, L


# ----------------------------------------------------------------------------
#  Сборка видео (ffmpeg): отрезки роликов + готовый звук -> mp4
# ----------------------------------------------------------------------------

def _f(x):
    return f"{max(0.0, float(x)):.6f}"


def build_video(plan, wav_path, out_path, preset="medium"):
    exe = _ffmpeg_exe()
    if not exe:
        raise RuntimeError(_t("не найден ffmpeg: видео собрать нельзя", "ffmpeg not found: cannot build the video"))
    W, H, F = plan["width"], plan["height"], plan["fps"]
    segs = plan["segments"]
    fade = plan["trans"] == "fade" and len(segs) > 1
    d = plan["trans_dur"] if fade else 0.0
    last = len(segs) - 1

    args = [exe, "-y", "-v", "error"]
    chains = []
    lens = []
    n_in = 0
    for s in segs:
        el = d / 2 if (fade and s["k"] > 0) else 0.0
        er = d / 2 if (fade and s["k"] < last) else 0.0
        t0, t1 = s["a"] - el, s["b"] + er
        seg_len = t1 - t0
        lens.append(seg_len)
        src0, src1 = t0 - s["off"], t1 - s["off"]
        pre = max(0.0, -src0)
        post = max(0.0, src1 - s["dur"])
        ts, te = max(0.0, src0), min(s["dur"], src1)
        if te - ts < 1.0 / F:
            # у ролика нет кадров для этого места — честная чёрная вставка
            args += ["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={F}:d={_f(seg_len)}"]
            chains.append(f"[{n_in}:v]setsar=1,format=yuv420p,trim=duration={_f(seg_len)},setpts=PTS-STARTPTS[v{s['k']}]")
        else:
            args += ["-i", s["path"]]
            chains.append(
                f"[{n_in}:v]trim=start={_f(ts)}:end={_f(te)},setpts=PTS-STARTPTS,fps={F},"
                f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,"
                f"setsar=1,format=yuv420p,"
                f"tpad=start_duration={_f(pre)}:stop_duration={_f(post)}:start_mode=add:stop_mode=add:color=black,"
                f"trim=duration={_f(seg_len)},setpts=PTS-STARTPTS[v{s['k']}]"
            )
        n_in += 1
    a_in = n_in
    args += ["-i", wav_path]

    if len(segs) == 1:
        chains.append("[v0]null[vout]")
    elif fade:
        cur, acc = "v0", lens[0]
        for k in range(1, len(segs)):
            out = "vout" if k == last else f"x{k}"
            chains.append(f"[{cur}][v{k}]xfade=transition=fade:duration={_f(d)}:offset={_f(acc - d)}[{out}]")
            acc = acc + lens[k] - d
            cur = out
    else:
        chains.append("".join(f"[v{k}]" for k in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[vout]")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    args += [
        "-filter_complex", ";".join(chains),
        "-map", "[vout]", "-map", f"{a_in}:a:0",
        "-c:v", "libx264", "-preset", preset, "-crf", "17", "-pix_fmt", "yuv420p",
        "-r", str(F), "-c:a", "aac", "-b:a", "192k",
        "-t", _f(plan["length"]), "-movflags", "+faststart", out_path,
    ]
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0 or not os.path.isfile(out_path):
        msg = r.stderr.decode("utf-8", "ignore").strip().splitlines()[-3:]
        raise RuntimeError(_t("ffmpeg не смог собрать видео: ", "ffmpeg could not build the video: ") + " | ".join(msg))
    return out_path


def _clean_name(save_name, fallback="neron_field"):
    return re.sub(r"[^\w\-. ]", "_", str(save_name or "")).strip(" .")[:80] or fallback


def save_outputs(mix, plan, save_name, with_video):
    clean = _clean_name(save_name)
    wav_dir = os.path.join(folder_paths.get_output_directory(), "Neron_Mixes")
    os.makedirs(wav_dir, exist_ok=True)
    wav_path = os.path.join(wav_dir, clean + ".wav")
    sf.write(wav_path, mix, SAMPLE_RATE, subtype="PCM_16")
    vid = None
    if with_video and plan:
        vid = build_video(plan, wav_path, os.path.join(folder_paths.get_output_directory(), "Neron_Videos", clean + ".mp4"))
    return wav_path, vid


# ----------------------------------------------------------------------------
#  API для интерфейса (работает без Queue)
# ----------------------------------------------------------------------------

def _spec_getter(specs):
    cache = {}

    def get(slot):
        if slot in cache:
            return cache[slot]
        sp = specs.get(slot) if isinstance(specs, dict) else None
        wave = None
        if isinstance(sp, dict) and sp.get("type") in ("drum", "piano", "file"):
            try:
                wave = render_source(sp)
            except Exception as e:
                print(f"[Neron] Поле: вход {slot} не удалось отрисовать: {e}")
        cache[slot] = wave
        return wave
    return get


def render_arrange_spec(spec):
    """Для микшера: звук поля по описанию из интерфейса (предпрослушивание)."""
    field = parse_field(spec.get("json", "{}"))
    mix, _ = render_field(field, _spec_getter(spec.get("inputs") or {}))
    return mix


@routes.get("/neron/video_info")
async def neron_video_info(request):
    v = {"name": request.query.get("filename", ""), "subfolder": request.query.get("subfolder", ""), "type": request.query.get("type", "input")}
    path = video_path(v)
    if not path:
        return web.json_response({"ok": False, "error": _t("видео не найдено", "video not found")}, status=404)
    loop = asyncio.get_running_loop()
    info = await loop.run_in_executor(None, probe_video, path)
    if not info:
        return web.json_response({"ok": False, "error": _t("не удалось прочитать видео", "cannot read the video")}, status=500)
    return web.json_response({"ok": True, **info})


@routes.post("/neron/upload_video")
async def neron_upload_video(request):
    """Загрузка ролика с компьютера в input/Neron_Video."""
    try:
        reader = await request.multipart()
        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"ok": False, "error": _t("файл не получен", "no file received")}, status=400)
        raw_name = os.path.basename(str(field.filename or "video.mp4").replace("\\", "/"))
        stem, ext = os.path.splitext(raw_name)
        ext = ext.lower()
        if ext not in VIDEO_EXTS:
            return web.json_response({"ok": False, "error": _t("это не видео: ", "not a video: ") + ext}, status=400)
        stem = re.sub(r"[^\w\-. ]", "_", stem).strip(" .") or "video"
        folder = os.path.join(folder_paths.get_input_directory(), VIDEO_UPLOAD_SUBDIR)
        os.makedirs(folder, exist_ok=True)
        name = stem + ext
        k = 1
        while os.path.exists(os.path.join(folder, name)):
            name = f"{stem}_{k}{ext}"
            k += 1
        path = os.path.join(folder, name)
        size = 0
        with open(path, "wb") as f:
            while True:
                chunk = await field.read_chunk(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_VIDEO_UPLOAD:
                    f.close()
                    os.remove(path)
                    return web.json_response({"ok": False, "error": _t("файл больше 2 ГБ", "file is larger than 2 GB")}, status=400)
                f.write(chunk)
        return web.json_response({"ok": True, "name": name, "subfolder": VIDEO_UPLOAD_SUBDIR, "type": "input"})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


def _render_request(data):
    field = parse_field(data.get("json", "{}"))
    plan = video_plan(field)
    mix, L = render_field(field, _spec_getter(data.get("inputs") or {}), plan)
    t0 = time.time()
    wav, vid = save_outputs(mix, plan, data.get("save_name"), bool(data.get("with_video")))
    return {"ok": True, "path": wav, "video_path": vid, "seconds": round(L, 3), "build_sec": round(time.time() - t0, 1)}


@routes.post("/neron/arrange_render")
async def neron_arrange_render(request):
    try:
        data = await request.json()
        loop = asyncio.get_running_loop()
        resp = await loop.run_in_executor(None, _render_request, data)
        return web.json_response(resp)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ----------------------------------------------------------------------------
#  Нода
# ----------------------------------------------------------------------------

class NeronArrange:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # всё поле хранится здесь; поле рисует интерфейс
                "field_json": ("STRING", {"default": _default_field_json()}),
                "save_name": ("STRING", {"default": "neron_field",
                                         "tooltip": "Имя файлов в output/Neron_Mixes и Neron_Videos / File name in output/Neron_Mixes and Neron_Videos"}),
            },
            # входы audio_N показывает интерфейс: подключили один — появился следующий
            "optional": {f"audio_{i}": ("AUDIO",) for i in range(1, MAX_INPUTS + 1)},
        }

    RETURN_TYPES = ("AUDIO", VIDEO_OUT_TYPE, "FLOAT", "FLOAT")
    RETURN_NAMES = ("audio", "video", "fps", "seconds")
    OUTPUT_TOOLTIPS = (
        "Сведённый звук всего поля / Mixed sound of the whole field",
        "Склеенное видео со звуком поля / The cut video with the field sound",
        "Кадров в секунду итогового видео / Frames per second of the video",
        "Длина в секундах / Length in seconds",
    )
    FUNCTION = "build"
    CATEGORY = "NeronAudio"
    OUTPUT_NODE = True        # сама сохраняет звук и видео: Queue работает и без нод после неё
    DESCRIPTION = ("Поле: склейка до 3 роликов и дорожки со звуком в одном окне. "
                   "Field: up to 3 video clips and audio tracks in one window.")

    def build(self, field_json, save_name, **inputs):
        field = parse_field(field_json)
        waves = {}

        def get_input(slot):
            if slot not in waves:
                a = inputs.get(slot)
                waves[slot] = audio_to_stereo(a) if a is not None else None
            return waves[slot]

        plan = video_plan(field)
        mix, L = render_field(field, get_input, plan)
        wav, vid = save_outputs(mix, plan, save_name, plan is not None)
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        fps = float(plan["fps"]) if plan else 24.0
        if vid:
            video_out = VideoFromFile(vid) if VideoFromFile is not None else vid
        else:
            video_out = None if VIDEO_OUT_TYPE == "VIDEO" else ""
        print(f"[Neron] Поле / Field: {L:.2f} с/s -> {wav}" + (f" + {vid}" if vid else ""))
        return ({"waveform": waveform, "sample_rate": SAMPLE_RATE}, video_out, fps, float(L))


NODE_CLASS_MAPPINGS = {"NeronArrange": NeronArrange}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronArrange": "Neron Field / Поле"}
