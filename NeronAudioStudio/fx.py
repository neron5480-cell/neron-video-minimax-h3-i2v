# -*- coding: utf-8 -*-
"""
Эквалайзер и эхо для каналов Пульта / EQ and reverb for the Pult channels.

RU: Три ручки эквалайзера (НИЗ 200 Гц, СЕРЕДИНА 1 кГц, ВЕРХ 4 кГц, ±12 дБ) и эхо
    (одна ручка «сколько» + комната / зал / собор). Здесь — то же самое, что Пульт
    делает в браузере (WebAudio), только для готового файла после Queue.
EN: Three EQ knobs (LOW 200 Hz, MID 1 kHz, HIGH 4 kHz, ±12 dB) and reverb (one
    "amount" knob + room / hall / cathedral). The same thing the Pult does in the
    browser (WebAudio), but for the final file after Queue.
"""

import numpy as np

SR = 44100
EQ_BANDS = (("low", "lowshelf", 200.0), ("mid", "peaking", 1000.0), ("high", "highshelf", 4000.0))
EQ_MAX_DB = 12.0
MID_Q = 0.9
# длина хвоста эха в секундах / reverb tail length
ROOMS = {"room": 0.9, "hall": 2.2, "cathedral": 4.5}
ROOM_PREDELAY = {"room": 0.008, "hall": 0.02, "cathedral": 0.035}


def fx_defaults():
    return {"low": 0.0, "mid": 0.0, "high": 0.0, "rev": 0.0, "room": "hall"}


def parse_fx(t):
    """Настройки эффектов канала из json (всё необязательно)."""
    t = t if isinstance(t, dict) else {}
    out = fx_defaults()
    for k in ("low", "mid", "high"):
        try:
            out[k] = float(np.clip(float(t.get(k, 0.0)), -EQ_MAX_DB, EQ_MAX_DB))
        except Exception:
            pass
    try:
        out["rev"] = float(np.clip(float(t.get("rev", 0.0)), 0.0, 1.0))
    except Exception:
        pass
    if t.get("room") in ROOMS:
        out["room"] = t["room"]
    return out


def has_fx(fx):
    return bool(fx) and (any(abs(fx.get(k, 0.0)) > 0.05 for k in ("low", "mid", "high")) or fx.get("rev", 0.0) > 0.005)


def _biquad_mag(kind, f0, gain_db, freqs, sr=SR, q=MID_Q):
    """|H(f)| фильтра по формулам RBJ — так же считает BiquadFilterNode в браузере."""
    A = 10.0 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    cw, sw = np.cos(w0), np.sin(w0)
    if kind == "peaking":
        alpha = sw / (2.0 * q)
        b0, b1, b2 = 1 + alpha * A, -2 * cw, 1 - alpha * A
        a0, a1, a2 = 1 + alpha / A, -2 * cw, 1 - alpha / A
    else:
        # полка с наклоном S = 1 (как в WebAudio)
        alpha = sw / 2.0 * np.sqrt(2.0)
        sa = 2.0 * np.sqrt(A) * alpha
        if kind == "lowshelf":
            b0 = A * ((A + 1) - (A - 1) * cw + sa)
            b1 = 2 * A * ((A - 1) - (A + 1) * cw)
            b2 = A * ((A + 1) - (A - 1) * cw - sa)
            a0 = (A + 1) + (A - 1) * cw + sa
            a1 = -2 * ((A - 1) + (A + 1) * cw)
            a2 = (A + 1) + (A - 1) * cw - sa
        else:
            b0 = A * ((A + 1) + (A - 1) * cw + sa)
            b1 = -2 * A * ((A - 1) + (A + 1) * cw)
            b2 = A * ((A + 1) + (A - 1) * cw - sa)
            a0 = (A + 1) - (A - 1) * cw + sa
            a1 = 2 * ((A - 1) - (A + 1) * cw)
            a2 = (A + 1) - (A - 1) * cw - sa
    z = np.exp(-1j * 2.0 * np.pi * freqs / sr)
    h = (b0 + b1 * z + b2 * z * z) / (a0 + a1 * z + a2 * z * z)
    return np.abs(h)


def _mulberry32(seed):
    """Тот же генератор шума, что и в браузере — эхо звучит одинаково."""
    a = seed & 0xFFFFFFFF
    while True:
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        yield ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0


_IR_CACHE = {}


def impulse(room, sr=SR):
    """Отклик помещения: шум, который плавно затухает (стерео, слегка разный слева и справа)."""
    key = (room, sr)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    dur = ROOMS.get(room, ROOMS["hall"])
    pre = int(ROOM_PREDELAY.get(room, 0.02) * sr)
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float64) / sr
    env = np.exp(-6.9 * t / dur)                       # -60 дБ к концу
    env *= np.minimum(1.0, t / 0.004 + 0.05)           # мягкое начало
    ir = np.zeros((pre + n, 2), dtype=np.float64)
    for ch, seed in ((0, 1234 + len(room)), (1, 5678 + len(room))):
        g = _mulberry32(seed)
        noise = np.fromiter((next(g) * 2.0 - 1.0 for _ in range(n)), dtype=np.float64, count=n)
        # чем дальше — тем глуше: простое сглаживание хвоста
        ir[pre:, ch] = noise * env
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-9
    ir = ir.astype(np.float32)
    _IR_CACHE[key] = ir
    return ir


def wet_gain(rev):
    return 0.9 * rev


def dry_gain(rev):
    return 1.0 - 0.35 * rev


def apply_fx(wave, fx):
    """wave: (отсчёты, 2) float32 -> тот же размер с эквалайзером и эхом."""
    if wave is None or not len(wave) or not has_fx(fx):
        return wave
    x = np.asarray(wave, dtype=np.float32)
    n = len(x)
    eq_on = any(abs(fx[k]) > 0.05 for k in ("low", "mid", "high"))
    rev = fx["rev"]
    ir = impulse(fx["room"]) if rev > 0.005 else None
    size = n + (len(ir) if ir is not None else 0)
    nfft = 1 << int(np.ceil(np.log2(max(2, size))))
    X = np.fft.rfft(x, n=nfft, axis=0)
    if eq_on:
        freqs = np.fft.rfftfreq(nfft, 1.0 / SR)
        mag = np.ones_like(freqs)
        for key, kind, f0 in EQ_BANDS:
            if abs(fx[key]) > 0.05:
                mag *= _biquad_mag(kind, f0, fx[key], freqs)
        X *= mag[:, None]
    if ir is not None:
        Y = X * dry_gain(rev) + X * np.fft.rfft(ir, n=nfft, axis=0) * wet_gain(rev)
    else:
        Y = X
    y = np.fft.irfft(Y, n=nfft, axis=0)[:n]
    return np.ascontiguousarray(y, dtype=np.float32)


# ----------------------------------------------------------------------------
#  Общий эквалайзер на 10 полос (Студия) — те же фильтры, что в браузере
# ----------------------------------------------------------------------------
EQ10 = (31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)
EQ10_Q = 1.1


def eq10_kind(i):
    return "lowshelf" if i == 0 else ("highshelf" if i == len(EQ10) - 1 else "peaking")


def parse_eq10(v):
    out = []
    for i in range(len(EQ10)):
        try:
            out.append(float(np.clip(float(v[i]), -12.0, 12.0)))
        except Exception:
            out.append(0.0)
    return out


def apply_eq10(wave, gains):
    if wave is None or not len(wave) or not any(abs(g) > 0.05 for g in gains):
        return wave
    x = np.asarray(wave, dtype=np.float32)
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(max(2, n))))
    X = np.fft.rfft(x, n=nfft, axis=0)
    freqs = np.fft.rfftfreq(nfft, 1.0 / SR)
    mag = np.ones_like(freqs)
    for i, g in enumerate(gains):
        if abs(g) > 0.05:
            mag *= _biquad_mag(eq10_kind(i), EQ10[i], g, freqs, q=EQ10_Q)
    y = np.fft.irfft(X * mag[:, None], n=nfft, axis=0)[:n]
    return np.ascontiguousarray(y, dtype=np.float32)
