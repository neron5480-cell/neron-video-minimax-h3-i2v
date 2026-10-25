# -*- coding: utf-8 -*-
"""
Neron Sampler / Сэмплер

RU: Стоит между «Звук ×8» и Пультом. Вид как у Piano Roll: слева дорожки,
    справа сетка по тактам, каждый звук — блок, который можно двигать,
    копировать, обрезать, класть друг на друга. Кнопка «ПРОПУСТИТЬ»: сэмплер
    не работает, все звуки идут в Пульт как есть (каждый своим каналом).
    Выключена — Пульт видит только результат сэмплера (одним каналом).
EN: Sits between "Sound ×8" and the Pult. Looks like the Piano Roll: tracks on
    the left, a bar grid on the right, every sound is a block you can move,
    copy, trim and stack. "BYPASS": the sampler does nothing and all sounds go
    to the Pult as they are. Off — the Pult sees only the sampler result.
"""

import json
import numpy as np
import torch

from .drum_machine import SAMPLE_RATE, _num
from .mixer import AUDIO_EXTS, media_path, audio_to_stereo
from .arrange import file_wave, _place

MAX_LANES = 8              # источников (звуков из «Звук ×8»)
LAYERS = 4                 # слоёв в поле
MAX_CLIPS = 128
MAX_BEATS = 4 * 64          # до 64 тактов


def _default_json():
    return json.dumps({"version": 2, "bypass": True, "snap": "1/4", "master": 1.0, "layers": [], "bricks": []})


def parse_sampler(sampler_json):
    try:
        raw = json.loads(sampler_json) if isinstance(sampler_json, str) else sampler_json
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    # поле: слои (раньше назывались lanes) и кирпичики (раньше clips)
    lanes = []
    for t in (raw.get("layers") or raw.get("lanes") or [])[:LAYERS]:
        t = t if isinstance(t, dict) else {}
        lanes.append({
            "vol": _num(t.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(t.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(t.get("mute", False)),
            "solo": bool(t.get("solo", False)),
        })
    while len(lanes) < LAYERS:
        lanes.append({"vol": 0.8, "pan": 0.0, "mute": False, "solo": False})
    clips = []
    for c in (raw.get("bricks") or raw.get("clips") or [])[:MAX_CLIPS]:
        if not isinstance(c, dict):
            continue
        ln = _num(c.get("len", 0), 0.0, 0.0, 3600.0)
        if ln <= 0.005:
            continue
        clips.append({
            "src": int(_num(c.get("src", 0), 0, 0, MAX_LANES - 1)),
            "lane": int(_num(c.get("layer", c.get("lane", 0)), 0, 0, LAYERS - 1)),
            "beat": _num(c.get("beat", 0), 0.0, 0.0, MAX_BEATS),
            "in": _num(c.get("in", 0), 0.0, 0.0, 3600.0),
            "len": ln,
            "gain": _num(c.get("gain", 1.0), 1.0, 0.0, 2.0),
            "fin": _num(c.get("fin", 0), 0.0, 0.0, 30.0),
            "fout": _num(c.get("fout", 0), 0.0, 0.0, 30.0),
        })
    return {
        "bypass": bool(raw.get("bypass", True)),
        "master": _num(raw.get("master", 1.0), 1.0, 0.0, 1.5),
        "lanes": lanes,
        "clips": clips,
    }


def sound_wave(snd):
    """Звук из «Звук ×8» (с его обрезкой) или уже готовый массив."""
    if isinstance(snd, dict) and snd.get("wave") is not None:
        return np.asarray(snd["wave"], dtype=np.float32)
    w = file_wave(snd)
    a = int(max(0.0, float(snd.get("start", 0) or 0)) * SAMPLE_RATE)
    e = float(snd.get("end", 0) or 0)
    b = int(e * SAMPLE_RATE) if e > 0 else len(w)
    return w[a:min(len(w), b)]


def render_sampler(sp, sounds, bpm):
    """Свести блоки сэмплера. Длина — до конца последнего блока, округлённая до целого такта
    (чтобы в Пульте луп повторялся ровно)."""
    spb = 60.0 / float(_num(bpm, 90, 40, 300))
    if not sp["clips"]:
        # поле пустое — один такт тишины (Пульт не падает, просто ничего не слышно)
        return np.zeros((int(round(4 * spb * SAMPLE_RATE)), 2), dtype=np.float32)
    waves = {}
    end = 0.0
    for c in sp["clips"]:
        end = max(end, c["beat"] * spb + c["len"])
    bar = 4 * spb
    total_sec = max(bar, np.ceil(end / bar - 1e-6) * bar)
    total = int(round(total_sec * SAMPLE_RATE))
    mix = np.zeros((total, 2), dtype=np.float32)
    solo_any = any(l["solo"] for l in sp["lanes"])
    for li, lane in enumerate(sp["lanes"]):
        if lane["mute"] or (solo_any and not lane["solo"]):
            continue
        buf = None
        for c in sp["clips"]:
            if c["lane"] != li or c["src"] >= len(sounds):
                continue
            if c["src"] not in waves:
                waves[c["src"]] = sound_wave(sounds[c["src"]])
            w = waves[c["src"]]
            i0 = int(round(c["in"] * SAMPLE_RATE))
            piece = w[i0: i0 + int(round(c["len"] * SAMPLE_RATE))]
            if not len(piece):
                continue
            if buf is None:
                buf = np.zeros_like(mix)
            _place(buf, piece, int(round(c["beat"] * spb * SAMPLE_RATE)), c["gain"],
                   int(c["fin"] * SAMPLE_RATE), int(c["fout"] * SAMPLE_RATE))
        if buf is not None:
            gl = lane["vol"] * min(1.0, 1.0 - lane["pan"])
            gr = lane["vol"] * min(1.0, 1.0 + lane["pan"])
            mix += buf * np.array([gl, gr], dtype=np.float32)
    mix *= np.float32(sp["master"])
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= np.float32(0.99 / peak)
    return mix


def render_sampler_spec(spec):
    """Для Пульта: предпрослушивание сэмплера без Queue."""
    sounds = [s for s in (spec.get("sounds") or []) if isinstance(s, dict) and media_path(s, AUDIO_EXTS)]
    return render_sampler(parse_sampler(spec.get("json", "{}")), sounds, spec.get("bpm", 90))


class NeronSampler:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "sampler_json": ("STRING", {"default": _default_json()}),
                "bpm": ("INT", {"default": 90, "min": 40, "max": 300,
                                "tooltip": "Темп сетки (Пульт синхронизирует его сам) / Grid tempo (the Pult syncs it)"}),
            },
            "optional": {"sounds": ("NERON_SOUNDS",)},
        }

    RETURN_TYPES = ("NERON_SOUNDS", "AUDIO")
    RETURN_NAMES = ("sounds", "audio")
    OUTPUT_TOOLTIPS = (
        "В Пульт (вход audio_N): «пропустить» — все звуки как есть; иначе — один свёденный звук / "
        "To the Pult (audio_N): bypass — all sounds as they are; otherwise one mixed sound",
        "Результат одним звуком (для других нод) / The result as one sound (for other nodes)",
    )
    FUNCTION = "process"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "Сэмплер между «Звук ×8» и Пультом. Sampler between Sound ×8 and the Pult."

    def process(self, sampler_json, bpm, sounds=None):
        items = list((sounds or {}).get("sounds") or []) if isinstance(sounds, dict) else []
        sp = parse_sampler(sampler_json)
        if sp["bypass"]:
            if not items:
                raise RuntimeError("[Neron] Сэмплер: подключите «Звук ×8» ко входу sounds / wire Sound ×8 into sounds")
            waves = [sound_wave(s) for s in items]
            n = max(len(w) for w in waves)
            mix = np.zeros((n, 2), dtype=np.float32)
            for w in waves:
                mix[: len(w)] += w
            peak = float(np.max(np.abs(mix))) if mix.size else 0.0
            if peak > 0.99:
                mix *= np.float32(0.99 / peak)
            out = {"neron": "sounds", "sounds": items}
        else:
            mix = render_sampler(sp, items, bpm)
            out = {"neron": "sounds", "sounds": [{"name": "Сэмплер / Sampler", "wave": mix}]}
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        return (out, {"waveform": waveform, "sample_rate": SAMPLE_RATE})


NODE_CLASS_MAPPINGS = {"NeronSampler": NeronSampler}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronSampler": "Neron Sampler / Сэмплер"}
