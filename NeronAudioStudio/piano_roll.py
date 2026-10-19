import io
import os
import json
import math
import asyncio
from collections import OrderedDict

import numpy as np
import soundfile as sf
import torch
from aiohttp import web
from server import PromptServer

from .drum_machine import (
    SAMPLE_RATE,
    find_kit_dir,
    list_audio_files,
    save_wav,
    _num,
    _read_audio,
    _resample,
    _safe_rel,
)

STEPS_PER_BAR = 16
MAX_BARS = 16
MAX_TRACKS = 8
MAX_NOTE_SECONDS = 30.0
CACHE_LIMIT_BYTES = 256 * 1024 * 1024


# ----------------------------------------------------------------------------
#  Синтезатор. Один и тот же движок звучит и при предпрослушивании в браузере,
#  и при сохранении файла, поэтому звук везде одинаковый.
# ----------------------------------------------------------------------------

def _midi_freq(midi):
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def _envelope(n, n_gate, attack, tau, sustain, release):
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    attack = max(attack, 0.001)
    tau = max(tau, 0.001)
    env = np.where(
        t < attack,
        t / attack,
        sustain + (1.0 - sustain) * np.exp(-np.maximum(t - attack, 0.0) / tau),
    )
    tg = min(n_gate, n - 1) / SAMPLE_RATE
    if tg < attack:
        level = tg / attack
    else:
        level = sustain + (1.0 - sustain) * math.exp(-(tg - attack) / tau)
    tail = t >= tg
    env[tail] = level * np.exp(-(t[tail] - tg) * 4.6 / max(release, 0.01))
    fade = min(int(0.006 * SAMPLE_RATE), n // 2)
    if fade > 0:
        env[-fade:] *= np.linspace(1.0, 0.0, fade)
    return env


def _pan_gains(pan):
    angle = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0
    return math.cos(angle), math.sin(angle)


def _additive(freq, t, spec):
    """Сложение гармоник. Фильтр и затухание яркости считаются для каждой гармоники."""
    n = len(t)
    left = np.zeros(n)
    right = np.zeros(n)
    nyq = SAMPLE_RATE * 0.45
    vt = 0.0
    vib = spec.get("vib")
    if vib:
        rate, depth, delay = vib
        ramp = np.clip((t - delay) / 0.5, 0.0, 1.0)
        vt = depth * (1.0 - np.cos(2.0 * np.pi * rate * t)) / (2.0 * np.pi * rate) * ramp
    fc = spec.get("fc")
    order = spec.get("order", 2)
    inh = spec.get("inh", 0.0)
    hd = spec.get("hd", 0.0)
    amps = spec["amps"]

    for cents, pan in spec["voices"]:
        fv = freq * 2.0 ** (cents / 1200.0)
        theta = 2.0 * np.pi * fv * (t + vt)
        sig = np.zeros(n)
        for h in range(1, spec.get("nh", 32) + 1):
            m = h * math.sqrt(1.0 + inh * h * h)
            fh = fv * m
            if fh > nyq:
                break
            a = amps(h)
            if a < 1e-4:
                continue
            if fc is not None:
                fc0, fc1, ftau = fc
                if ftau is None:
                    a = a / math.sqrt(1.0 + (fh / fc0) ** (2 * order))
                    if a < 1e-4:
                        continue
                    g = a
                else:
                    fct = fc1 + (fc0 - fc1) * np.exp(-t / ftau)
                    g = a / np.sqrt(1.0 + (fh / fct) ** (2 * order))
            else:
                g = a
            if hd:
                g = g * np.exp(-t * hd * (h - 1))
            sig += g * np.sin(m * theta)
        for ratio, amp in spec.get("extra", []):
            sig += amp * np.sin(ratio * theta)
        gl, gr = _pan_gains(pan)
        left += sig * gl
        right += sig * gr
    return left, right


def _fm(freq, t, spec):
    """Электропиано (FM) и колокольчик (негармонические обертоны)."""
    nyq = SAMPLE_RATE * 0.45
    left = np.zeros(len(t))
    right = np.zeros(len(t))
    bright = float(np.clip(1.0 - (freq - 500.0) / 3000.0, 0.25, 1.0))
    for cents, pan in spec["voices"]:
        fv = freq * 2.0 ** (cents / 1200.0)
        th = 2.0 * np.pi * fv * t
        if spec["fm"] == "epiano":
            idx = (1.1 * np.exp(-t / 0.8) + 0.25) * bright
            y = np.sin(th + idx * np.sin(th)) + 0.35 * np.sin(th)
            if 14.0 * fv < nyq:
                y = y + 0.12 * np.sin(14.0 * th) * np.exp(-t * 22.0)
        else:  # bell
            y = np.zeros(len(t))
            for ratio, amp, decay in ((1.0, 1.0, 2.2), (2.0, 0.55, 1.6), (2.76, 0.5, 1.2),
                                      (4.07, 0.3, 0.8), (5.4, 0.25, 0.6), (8.93, 0.12, 0.35)):
                if fv * ratio < nyq:
                    y += amp * np.exp(-t / decay) * np.sin(ratio * th)
        gl, gr = _pan_gains(pan)
        left += y * gl
        right += y * gr
    return left, right


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


PRESETS = {
    "piano": dict(
        kind="add", voices=[(-1.5, -0.25), (1.5, 0.25)], nh=30,
        amps=lambda h: (1.0 / h ** 1.1) * (0.35 + 0.65 * abs(math.sin(math.pi * h * 0.14))),
        hd=2.0, inh=0.00012, attack=0.004, sus=0.0, rel=0.35,
        tau=lambda f: _clamp(3.2 * (261.6 / f) ** 0.55, 0.5, 7.0),
    ),
    "epiano": dict(
        kind="fm", fm="epiano", voices=[(-2.0, -0.35), (2.0, 0.35)],
        attack=0.003, sus=0.12, rel=0.3,
        tau=lambda f: _clamp(1.8 * (261.6 / f) ** 0.3, 0.4, 3.0),
    ),
    "bell": dict(
        kind="fm", fm="bell", voices=[(0.0, 0.0)],
        attack=0.001, sus=0.0, rel=0.6, tau=lambda f: 2.8,
    ),
    "organ": dict(
        kind="add", voices=[(-3.0, -0.2), (3.0, 0.2)], nh=8,
        amps=lambda h: {1: 1.0, 2: 0.6, 3: 0.45, 4: 0.3, 6: 0.2, 8: 0.12}.get(h, 0.0),
        extra=[(0.5, 0.5)], vib=(6.2, 0.0015, 0.0),
        attack=0.006, sus=1.0, rel=0.07, tau=lambda f: 0.02,
    ),
    "pluck": dict(
        kind="add", voices=[(-3.0, -0.2), (3.0, 0.2)], nh=40,
        amps=lambda h: 1.0 / h, fc=(4500.0, 700.0, 0.35), order=2,
        attack=0.002, sus=0.0, rel=0.12,
        tau=lambda f: _clamp(1.0 * (261.6 / f) ** 0.3, 0.25, 2.0),
    ),
    "bass": dict(
        kind="add", voices=[(-7.0, -0.1), (7.0, 0.1)], nh=40,
        amps=lambda h: 1.0 / h, extra=[(0.5, 0.7)], fc=(2200.0, 280.0, 0.22), order=2,
        attack=0.004, sus=0.75, rel=0.09, tau=lambda f: 0.5,
    ),
    "lead": dict(
        kind="add", voices=[(-10.0, -0.5), (0.0, 0.0), (10.0, 0.5)], nh=40,
        amps=lambda h: (1.0 / h) * (1.0 + 0.5 * (h % 2)),
        fc=(6000.0, 3200.0, 0.4), order=2, vib=(5.3, 0.0035, 0.25),
        attack=0.008, sus=0.85, rel=0.18, tau=lambda f: 0.3,
    ),
    "pad": dict(
        kind="add", voices=[(-14.0, -0.7), (-5.0, -0.3), (5.0, 0.3), (14.0, 0.7)], nh=36,
        amps=lambda h: 1.0 / h, fc=(1600.0, 1600.0, None), order=2,
        attack=0.45, sus=0.85, rel=1.1, tau=lambda f: 0.6,
    ),
    "sine": dict(
        kind="add", voices=[(0.0, 0.0)], nh=1, amps=lambda h: 1.0,
        attack=0.008, sus=1.0, rel=0.08, tau=lambda f: 0.01,
    ),
}
SYNTH_LEVEL = 0.35  # пиковая громкость одной ноты до громкости дорожки (запас под аккорды)


def _render_synth(name, midi, dur):
    p = PRESETS.get(name) or PRESETS["piano"]
    freq = _midi_freq(midi)
    n_gate = int(dur * SAMPLE_RATE)
    n = max(int((dur + p["rel"]) * SAMPLE_RATE), int(0.05 * SAMPLE_RATE))
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE
    env = _envelope(n, n_gate, p["attack"], p["tau"](freq), p["sus"], p["rel"])
    if p["kind"] == "fm":
        left, right = _fm(freq, t, p)
    else:
        left, right = _additive(freq, t, p)
    out = np.stack([left * env, right * env], axis=1)
    peak = float(np.max(np.abs(out))) if out.size else 0.0
    if peak > 1e-9:
        out *= SYNTH_LEVEL / peak
    return out.astype(np.float32)


# ----------------------------------------------------------------------------
#  Сэмплы из папок кита (клавесин, орган, гитара - любые папки)
# ----------------------------------------------------------------------------

_sample_cache = OrderedDict()


def _get_sample(path):
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    cached = _sample_cache.get(path)
    if cached and cached[0] == mtime:
        _sample_cache.move_to_end(path)
        return cached[1]
    data, sr = _read_audio(path)
    if data is None or len(data) == 0:
        return None
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    else:
        data = data[:, :2]
    if sr != SAMPLE_RATE:
        data = _resample(data, sr, SAMPLE_RATE)
    data = np.ascontiguousarray(data, dtype=np.float32)
    _sample_cache[path] = (mtime, data)
    while len(_sample_cache) > 24:
        _sample_cache.popitem(last=False)
    return data


def _render_sample(data, midi, root, dur, gate):
    ratio = 2.0 ** ((midi - root) / 12.0)
    n_src = len(data)
    n_out = max(2, min(int(n_src / ratio), SAMPLE_RATE * 20))
    pos = np.arange(n_out, dtype=np.float64) * ratio
    pos = pos[pos < n_src - 1]
    if len(pos) < 2:
        return np.zeros((int(0.05 * SAMPLE_RATE), 2), dtype=np.float32)
    i0 = pos.astype(np.int64)
    frac = (pos - i0)[:, None].astype(np.float32)
    out = data[i0] * (1.0 - frac) + data[i0 + 1] * frac
    n_gate = int(dur * SAMPLE_RATE)
    if gate:
        total = min(len(out), n_gate + int(0.08 * SAMPLE_RATE))
        out = out[:total].copy()
        if len(out) > n_gate:
            out[n_gate:] *= np.linspace(1.0, 0.0, len(out) - n_gate, dtype=np.float32)[:, None]
    fin = min(int(0.002 * SAMPLE_RATE), len(out) // 2)
    fout = min(int(0.004 * SAMPLE_RATE), len(out) // 2)
    if fin > 0:
        out[:fin] *= np.linspace(0.0, 1.0, fin, dtype=np.float32)[:, None]
    if fout > 0:
        out[-fout:] *= np.linspace(1.0, 0.0, fout, dtype=np.float32)[:, None]
    return (out * 0.9).astype(np.float32)


# ----------------------------------------------------------------------------
#  Отрисовка одной ноты (с кэшем)
# ----------------------------------------------------------------------------

_note_cache = OrderedDict()
_note_cache_bytes = 0


def render_note(inst, midi, dur, sample="", root=60, gate=False, kit_name="default"):
    global _note_cache_bytes
    midi = int(_clamp(int(midi), 0, 127))
    dur = float(_clamp(float(dur), 0.02, MAX_NOTE_SECONDS))
    dur_ms = int(round(dur * 1000))
    is_synth = inst.startswith("synth:")
    gate = bool(gate)
    key = (
        inst,
        "" if is_synth else kit_name,
        "" if is_synth else sample,
        midi,
        dur_ms if (is_synth or gate) else 0,
        0 if is_synth else int(root),
        False if is_synth else gate,
    )
    cached = _note_cache.get(key)
    if cached is not None:
        _note_cache.move_to_end(key)
        return cached

    if is_synth:
        arr = _render_synth(inst[6:], midi, dur_ms / 1000.0)
    elif inst.startswith("kit:"):
        folder = _safe_rel(inst[4:])
        kit_dir, _ = find_kit_dir(kit_name)
        if folder is None or kit_dir is None:
            raise RuntimeError("Папка кита или инструмента не найдена")
        folder_path = os.path.join(kit_dir, folder)
        files = list_audio_files(folder_path)
        if not files:
            raise RuntimeError(f"В папке {folder} нет звуковых файлов")
        name = sample if sample in files else files[0]
        data = _get_sample(os.path.join(folder_path, name))
        if data is None:
            raise RuntimeError(f"Не удалось прочитать {name}")
        arr = _render_sample(data, midi, int(root), dur_ms / 1000.0, gate)
    else:
        raise RuntimeError("Неизвестный инструмент: " + inst)

    _note_cache[key] = arr
    _note_cache_bytes += arr.nbytes
    while _note_cache_bytes > CACHE_LIMIT_BYTES and len(_note_cache) > 1:
        _, old = _note_cache.popitem(last=False)
        _note_cache_bytes -= old.nbytes
    return arr


# ----------------------------------------------------------------------------
#  Проект: дорожки, ноты, сведение
# ----------------------------------------------------------------------------

def _default_project_json():
    return json.dumps({"version": 1, "bars": 2, "tracks": []}, ensure_ascii=False)


def parse_project(project_json):
    try:
        raw = json.loads(project_json) if isinstance(project_json, str) else project_json
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    bars = int(_num(raw.get("bars", 2), 2, 1, MAX_BARS))
    master = _num(raw.get("master", 0.9), 0.9, 0.0, 1.5)
    tracks = []
    raw_tracks = raw.get("tracks")
    if not isinstance(raw_tracks, list):
        raw_tracks = []
    for t in raw_tracks[:MAX_TRACKS]:
        if not isinstance(t, dict):
            continue
        notes = []
        raw_notes = t.get("notes")
        for n in raw_notes if isinstance(raw_notes, list) else []:
            try:
                m = int(n["m"])
                s = float(n["s"])
                l = float(n["l"])
            except Exception:
                continue
            if 0 <= m <= 127 and s >= 0 and l > 0:
                notes.append((m, s, l))
        sample = t.get("sample")
        tracks.append({
            "inst": str(t.get("inst", "synth:piano")),
            "sample": sample if isinstance(sample, str) else "",
            "root": int(_num(t.get("root", 60), 60, 0, 127)),
            "gate": bool(t.get("gate", False)),
            "vol": _num(t.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(t.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(t.get("mute", False)),
            "solo": bool(t.get("solo", False)),
            "notes": notes,
        })
    return {"bars": bars, "master": master, "tracks": tracks}


def render_project(kit_name, bpm, project_json):
    proj = parse_project(project_json)
    bpm = _num(bpm, 90, 40, 300)
    step = 60.0 / bpm / 4.0
    total_steps = proj["bars"] * STEPS_PER_BAR
    total = max(1, int(round(total_steps * step * SAMPLE_RATE)))
    mix = np.zeros((total, 2), dtype=np.float32)
    solo_any = any(t["solo"] for t in proj["tracks"])

    for t in proj["tracks"]:
        if t["mute"] or (solo_any and not t["solo"]) or not t["notes"]:
            continue
        gains = np.array(
            [t["vol"] * min(1.0, 1.0 - t["pan"]), t["vol"] * min(1.0, 1.0 + t["pan"])],
            dtype=np.float32,
        )
        for m, s, l in t["notes"]:
            if s >= total_steps:
                continue
            l = min(l, total_steps - s)
            try:
                buf = render_note(t["inst"], m, l * step, t["sample"], t["root"], t["gate"], kit_name)
            except Exception as e:
                print(f"[Neron] Пропускаю ноту ({t['inst']}): {e}")
                continue
            wave = buf * gains
            start = int(round(s * step * SAMPLE_RATE))
            end = start + len(wave)
            if end <= total:
                mix[start:end] += wave
            else:
                first = total - start
                mix[start:total] += wave[:first]
                # хвост звука переходит в начало лупа - получается бесшовный цикл
                rest = wave[first:first + total]
                mix[:len(rest)] += rest

    mix *= proj["master"]
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= 0.99 / peak
    return mix


# ----------------------------------------------------------------------------
#  API для интерфейса (работает без нажатия Queue)
# ----------------------------------------------------------------------------

routes = PromptServer.instance.routes


def _note_to_wav_bytes(q):
    inst = q.get("inst", "synth:piano")
    kit = (q.get("kit") or "default").strip() or "default"
    arr = render_note(
        inst,
        int(float(q.get("midi", 60))),
        float(q.get("dur", 0.5)),
        q.get("sample", ""),
        int(float(q.get("root", 60))),
        q.get("gate", "0") in ("1", "true", "True"),
        kit,
    )
    buf = io.BytesIO()
    sf.write(buf, arr, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@routes.get("/neron/piano_note")
async def neron_piano_note(request):
    try:
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, _note_to_wav_bytes, dict(request.query))
        return web.Response(body=data, content_type="audio/wav", headers={"Cache-Control": "no-store"})
    except Exception as e:
        return web.Response(status=404, text=str(e))


@routes.post("/neron/piano_render")
async def neron_piano_render(request):
    try:
        data = await request.json()
        loop = asyncio.get_running_loop()
        mix = await loop.run_in_executor(
            None,
            render_project,
            (data.get("kit_name") or "default"),
            data.get("bpm", 90),
            data.get("project_json", "{}"),
        )
        path = save_wav(mix, data.get("save_name", "neron_piano"))
        return web.json_response({"ok": True, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ----------------------------------------------------------------------------
#  Нода
# ----------------------------------------------------------------------------

class NeronPianoRoll:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "kit_name": ("STRING", {"default": "default"}),
                "bpm": ("INT", {"default": 90, "min": 40, "max": 300}),
                "project_json": ("STRING", {"default": _default_project_json()}),
                "save_name": ("STRING", {"default": "neron_piano"}),
            }
        }

    RETURN_TYPES = ("AUDIO", "STRING", "INT")
    RETURN_NAMES = ("audio", "saved_path", "bpm")
    FUNCTION = "generate"
    CATEGORY = "NeronAudio"

    def generate(self, kit_name, bpm, project_json, save_name):
        mix = render_project(kit_name, bpm, project_json)
        out_path = save_wav(mix, save_name)
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        return ({"waveform": waveform, "sample_rate": SAMPLE_RATE}, out_path, int(_num(bpm, 90, 40, 300)))


NODE_CLASS_MAPPINGS = {"NeronPianoRoll": NeronPianoRoll}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronPianoRoll": "Neron Piano Roll"}
