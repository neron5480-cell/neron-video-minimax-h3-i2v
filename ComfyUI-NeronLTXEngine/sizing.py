# -*- coding: utf-8 -*-
"""Арифметика движка LTX 2.5: кадры, размеры, места ключевых кадров, видеокарта.

Только чистые функции — без torch и ComfyUI, чтобы их можно было проверить отдельно.

Жёсткие правила модели (карточка LTX-2.5 на Hugging Face):
  • число кадров = 8·n + 1 (1, 9, 17 … 121 …);
  • ширина и высота кратны 32.
"""
import math

# Видеокарта → площадь кадра (мегапиксели). Это СТАРТОВЫЕ значения для тестов, не замеры:
# после проверки на реальных картах цифры уточняются здесь, в одном месте.
VRAM_TIERS = [
    # (ярлык, порог VRAM в ГБ, мегапиксели)
    ("6–8 ГБ / GB", 0, 0.5),
    ("12 ГБ / GB", 11, 0.9),
    ("16 ГБ / GB", 15, 1.3),
    ("24+ ГБ / GB", 23, 2.0),
]
AUTO = "Авто / Auto"
GPU_CHOICES = [AUTO] + [t[0] for t in VRAM_TIERS]

LOW_RAM_GB = 32          # меньше — режем площадь, иначе ComfyUI уходит в своп (наблюдение автора процесса)
LOW_RAM_MP = 0.9

MAX_SECONDS = 20.0       # быстрая (distilled) версия LTX 2.5 — до 20 с
MIN_SIDE = 256


def frames_for(seconds, fps):
    """Секунды → кадры по правилу модели 8·n + 1 (та же формула, что в официальном шаблоне Lightricks)."""
    seconds = max(0.0, min(float(seconds), MAX_SECONDS))
    fps = max(1.0, float(fps))
    return 1 + int(math.floor(seconds * fps / 8.0)) * 8


def round32(v):
    return max(32, int(round(float(v) / 32.0)) * 32)


def size_for(aspect, megapixels):
    """Форма кадра (ширина/высота) + площадь → ширина и высота, кратные 32."""
    aspect = float(aspect) if aspect and aspect > 0 else 16.0 / 9.0
    mp = max(0.1, float(megapixels))
    area = mp * 1_000_000
    w = math.sqrt(area * aspect)
    h = w / aspect
    w, h = round32(w), round32(h)
    # не уходим ниже разумного минимума по короткой стороне
    if min(w, h) < MIN_SIDE:
        k = MIN_SIDE / float(min(w, h))
        w, h = round32(w * k), round32(h * k)
    return w, h


def tier_by_vram(vram_gb):
    """Ярлык ступени по объёму видеопамяти. None/0 → самая лёгкая ступень."""
    label = VRAM_TIERS[0][0]
    for name, need, _ in VRAM_TIERS:
        if vram_gb is not None and vram_gb >= need:
            label = name
    return label


def megapixels_for(choice, vram_gb, ram_gb=None):
    """Выбор пользователя (или «Авто») → (мегапиксели, ярлык ступени, заметка)."""
    note = ""
    label = choice
    if choice == AUTO or choice not in [t[0] for t in VRAM_TIERS]:
        label = tier_by_vram(vram_gb)
        note = (f"определена сама: {vram_gb:.0f} ГБ → «{label}»" if vram_gb
                else f"определить не удалось → «{label}»")
    mp = dict((t[0], t[2]) for t in VRAM_TIERS)[label]
    if ram_gb is not None and ram_gb < LOW_RAM_GB and mp > LOW_RAM_MP:
        mp = LOW_RAM_MP
        note = (note + "; " if note else "") + (f"оперативки {ram_gb:.0f} ГБ (меньше {LOW_RAM_GB}) — "
                                                f"размер снижен до {LOW_RAM_MP} Мп, чтобы не было свопа")
    return mp, label, note


def guide_frames(n_frames, fps, mid_seconds=(0.0, 0.0), has_mid=(False, False)):
    """Где стоят промежуточные кадры. 0 с = само: первый на трети ролика, второй на двух третях.

    Возвращает список индексов кадров (или None для неподключённого). Индекс всегда внутри ролика
    и не совпадает с первым и последним кадром.
    """
    out = []
    last = n_frames - 1
    for k, (sec, present) in enumerate(zip(mid_seconds, has_mid)):
        if not present:
            out.append(None)
            continue
        if sec and sec > 0:
            idx = int(round(float(sec) * float(fps)))
        else:
            idx = int(round(last * (k + 1) / 3.0))
        out.append(max(1, min(last - 1, idx)) if last >= 2 else 0)
    return out


def aspect_of(image_shape):
    """Форма картинки ComfyUI [B, H, W, C] → ширина/высота."""
    try:
        h, w = int(image_shape[1]), int(image_shape[2])
        return w / float(h) if h > 0 else None
    except Exception:
        return None


def aspect_mismatch(a, b, tolerance=0.25):
    """Сильно ли расходятся формы кадров (например, горизонталь и вертикаль)."""
    if not a or not b:
        return False
    return abs(math.log(a / b)) > tolerance
