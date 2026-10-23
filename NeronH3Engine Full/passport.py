# -*- coding: utf-8 -*-
"""Паспорт MiniMax H3 (открытые веса): за его пределы движок не выходит никаким путём.

Разрешение — по собственной функции ComfyUI для H3 (adapt_canvas в comfy_extras/nodes_minimax_h3.py):
короткая сторона 768, площадь не больше 768×1344, каждая сторона кратна 32.
Длина — 24 кадра/с, сетка модели «17k + 5» кадров, обучена на 5–15 с (124–362 кадра).
Меньше паспорта — можно (черновики). Больше — нельзя: просьба 8K вернёт паспортный размер той же формы.
"""
import math

FPS = 24
GRID = 32
BASE_SHORT = 768
MAX_PIXELS = 768 * 1344
MIN_SIDE = 256
MAX_FRAMES = 362            # 15 с — верх обучения модели
MIN_FRAMES = 22             # ~1 с на сетке 17k+5

PRESETS = {
    "16:9 · 1344×768 (кино / cinema)": (16, 9),
    "9:16 · 768×1344 (телефон / phone)": (9, 16),
    "1:1 · 768×768 (квадрат / square)": (1, 1),
    "4:3 · 1024×768 (классика / classic)": (4, 3),
    "3:4 · 768×1024 (портрет / portrait)": (3, 4),
    "3:2 · 1152×768 (фото / photo)": (3, 2),
    "21:9 · 1536×672 (широкий / wide)": (21, 9),
    "Ручной / Manual": None,
}


def _snap(v):
    return max(GRID, int(round(v / GRID)) * GRID)


def canvas(width, height):
    """Паспортный холст той же формы: короткая сторона 768, площадь ≤ 768×1344, кратно 32."""
    w, h = max(1.0, float(width)), max(1.0, float(height))
    r = w / h
    if r >= 1:
        nw, nh = BASE_SHORT * r, BASE_SHORT
    else:
        nw, nh = BASE_SHORT, BASE_SHORT / r
    if nw * nh > MAX_PIXELS:
        s = math.sqrt(MAX_PIXELS / (nw * nh))
        nw, nh = nw * s, nh * s
    w2, h2 = _snap(nw), _snap(nh)
    while w2 * h2 > MAX_PIXELS:         # округление вверх могло вылезти за площадь
        if w2 >= h2:
            w2 -= GRID
        else:
            h2 -= GRID
    return w2, h2


def fit(width, height):
    """Запрошенный размер → (ширина, высота, пояснение). Меньше паспорта — оставляем (кратно 32),
    больше — паспортный холст той же формы."""
    pw, ph = canvas(width, height)
    w, h = _snap(width), _snap(height)
    if w * h <= pw * ph and max(w, h) <= max(pw, ph):
        w, h = max(MIN_SIDE // GRID * GRID, w), max(MIN_SIDE // GRID * GRID, h)
        note = "" if (w, h) == (int(width), int(height)) else f"{width}×{height} → {w}×{h} (кратно 32)"
        return w, h, note
    return pw, ph, f"запрошено {width}×{height} → паспорт модели {pw}×{ph} / model passport"


def preset_size(name):
    ratio = PRESETS.get(name)
    if ratio is None:
        return None
    return canvas(*ratio)


def frames(seconds=None, length=None):
    """Секунды или кадры → (кадров, секунд, пояснение) на сетке 17k+5, не больше 362."""
    if length is not None and int(length) > 0:
        raw = int(length)
        src = f"{raw} кадров"
    else:
        raw = int(round(float(seconds) * FPS))
        src = f"{seconds} с"
    n = max(MIN_FRAMES, raw)
    while n % 17 != 5:
        n += 1
    note = ""
    if n > MAX_FRAMES:
        n = MAX_FRAMES
        note = f"запрошено {src} → паспорт модели {MAX_FRAMES} кадров (15 с)"
    return n, round(n / FPS, 2), note
