# -*- coding: utf-8 -*-
"""
Neron Studio / Студия

RU: Посредник между «Музыкой» (или «Звук ×8», сэмплером) и Пультом. Каждая дорожка —
    свой канал: громкость, баланс, M/S, НИЗ / СЕР / ВЕРХ и ЭХО. На выходе — общий
    эквалайзер на 10 полос. ⏭ ПРОПУСТИТЬ — всё идёт в Пульт как было.
EN: Sits between Music (or Sound ×8, the sampler) and the Pult. Every track is its own
    channel: volume, pan, M/S, LOW / MID / HIGH and REVERB. A 10-band master EQ on
    the output. ⏭ BYPASS — everything goes to the Pult as it was.
"""

import json
import numpy as np
import torch

from .drum_machine import SAMPLE_RATE, _num
from .fx import parse_fx, apply_fx, parse_eq10, apply_eq10

MAX_CH = 16


def _default_json():
    return json.dumps({"version": 1, "bypass": False, "master": 1.0, "eq_on": True, "eq": [0] * 10, "ch": {}})


def parse_studio(js):
    try:
        raw = json.loads(js) if isinstance(js, str) else js
    except Exception:
        raw = {}
    raw = raw if isinstance(raw, dict) else {}
    ch = {}
    for k, v in (raw.get("ch") or {}).items() if isinstance(raw.get("ch"), dict) else []:
        if not isinstance(v, dict):
            continue
        ch[str(k)] = {
            "vol": _num(v.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(v.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(v.get("mute", False)),
            "solo": bool(v.get("solo", False)),
            "fx": parse_fx(v),
        }
    arr = []
    for b in (raw.get("arr") or [])[:400] if isinstance(raw.get("arr"), list) else []:
        if isinstance(b, dict) and isinstance(b.get("ch"), str):
            arr.append({"ch": b["ch"], "bar": int(_num(b.get("bar", 0), 0, 0, 4096)), "len": int(_num(b.get("len", 1), 1, 1, 4096))})
    return {
        "arr": arr,
        "bpm": _num(raw.get("bpm", 90), 90, 40, 300),
        "bypass": bool(raw.get("bypass", False)),
        "master": _num(raw.get("master", 1.0), 1.0, 0.0, 1.5),
        "eq_on": raw.get("eq_on", True) is not False,
        "eq": parse_eq10(raw.get("eq") or []),
        "ch": ch,
    }


def channel_keys(names):
    """Ключ канала — имя дорожки; одинаковые имена получают #2, #3 (так же в браузере)."""
    seen, out = {}, []
    for n in names:
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n} #{seen[n]}")
    return out


def render_studio(waves, names, sp):
    waves = [np.asarray(w, dtype=np.float32) if w is not None else None for w in waves][:MAX_CH]
    keys = channel_keys(names[:len(waves)])
    live = [(w, sp["ch"].get(k)) for w, k in zip(waves, keys) if w is not None and len(w)]
    if not live:
        return np.zeros((SAMPLE_RATE, 2), dtype=np.float32)
    # 🧱 поле: блоки дорожек по тактам (если есть хоть один блок существующей дорожки)
    live_keys = [k for w, k in zip(waves, keys) if w is not None and len(w)]
    arr = [b for b in sp.get("arr") or [] if b["ch"] in live_keys]
    bar_n = 240.0 / float(sp.get("bpm") or 90) * SAMPLE_RATE
    if arr:
        n = max(1, int(round(max(b["bar"] + b["len"] for b in arr) * bar_n)))
    else:
        n = max(len(w) for w, _ in live)
    solo = any(st and st["solo"] for _, st in live)
    mix = np.zeros((n, 2), dtype=np.float32)
    lk = [k for w, k in zip(waves, keys) if w is not None and len(w)]
    for (w, st), key in zip(live, lk):
        st = st or {"vol": 0.8, "pan": 0.0, "mute": False, "solo": False, "fx": None}
        if st["mute"] or (solo and not st["solo"]):
            continue
        if arr:
            tiled = np.zeros((n, 2), dtype=np.float32)
            blocks = [b for b in arr if b["ch"] == key]
            if not blocks:
                continue
            for b in blocks:
                s0 = int(round(b["bar"] * bar_n))
                m = min(int(round(b["len"] * bar_n)), n - s0)
                if m <= 0:
                    continue
                seg = w[np.arange(m) % len(w)].copy()      # блок: луп дорожки с начала блока
                r = min(96, m // 2)
                if r > 0:
                    ramp = np.linspace(0.0, 1.0, r, dtype=np.float32)[:, None]
                    seg[-r:] *= ramp[::-1]
                tiled[s0:s0 + m] += seg
        else:
            tiled = w[np.arange(n) % len(w)]          # короткие лупы повторяются до самого длинного
        if st["fx"]:
            tiled = apply_fx(tiled, st["fx"])
        g = np.array([st["vol"] * min(1.0, 1.0 - st["pan"]), st["vol"] * min(1.0, 1.0 + st["pan"])], dtype=np.float32)
        mix += tiled * g
    if sp["eq_on"]:
        mix = apply_eq10(mix, sp["eq"])
    mix *= np.float32(sp["master"])
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= np.float32(0.99 / peak)
    return mix


def render_studio_spec(spec):
    """Для Пульта: прослушать Студию без Queue (каждый источник рисуется отдельно)."""
    from .mixer import render_source      # поздний импорт: mixer сам импортирует studio
    srcs = [s for s in (spec.get("sources") or []) if isinstance(s, dict)][:MAX_CH]
    waves, names = [], []
    for s in srcs:
        try:
            waves.append(render_source(s["spec"]))
        except Exception as e:
            print("[Neron] Студия: не удалось отрисовать", s.get("name"), e)
            waves.append(None)
        names.append(str(s.get("name") or ""))
    return render_studio(waves, names, parse_studio(spec.get("json", "{}")))


def _input_channels(sounds):
    """Дорожки по проводу: у «Музыки» — каждая дорожка (stems), иначе — каждый звук."""
    from .mixer import render_file
    if not isinstance(sounds, dict):
        return [], []
    items = sounds.get("stems") or sounds.get("sounds") or []
    waves, names = [], []
    for it in items[:MAX_CH]:
        if it.get("wave") is not None:
            waves.append(np.asarray(it["wave"], dtype=np.float32))
        else:
            waves.append(render_file({"name": it["name"], "subfolder": it.get("subfolder", ""), "kind": it.get("type", "input"),
                                      "start": it.get("start", 0), "end": it.get("end", 0)}))
        names.append(str(it.get("name") or ""))
    return waves, names


class NeronStudio:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {"studio_json": ("STRING", {"default": _default_json()})},
            "optional": {"sounds": ("NERON_SOUNDS",)},
        }

    RETURN_TYPES = ("NERON_SOUNDS", "AUDIO")
    RETURN_NAMES = ("sounds", "audio")
    OUTPUT_TOOLTIPS = (
        "В Пульт (audio_N): сведённая студия одним каналом, или всё как было (⏭) / To the Pult: the studio mix as one channel, or as it was (⏭)",
        "Сведённая студия одним звуком / The studio mix as one sound",
    )
    FUNCTION = "process"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "Студия: каждая дорожка — свой канал с эквалайзером и эхом; общий эквалайзер на выходе."

    def process(self, studio_json, sounds=None):
        sp = parse_studio(studio_json)
        waves, names = _input_channels(sounds)
        mix = render_studio(waves, names, sp)
        if sp["bypass"] and isinstance(sounds, dict):
            out = sounds
        else:
            out = {"neron": "sounds", "sounds": [{"name": "Студия / Studio", "wave": mix}]}
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        return (out, {"waveform": waveform, "sample_rate": SAMPLE_RATE})


NODE_CLASS_MAPPINGS = {"NeronStudio": NeronStudio}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronStudio": "Neron Studio / Студия 🎛"}
