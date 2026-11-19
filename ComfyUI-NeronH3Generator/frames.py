# -*- coding: utf-8 -*-
"""
Расчёт количества кадров под MiniMax H3.

H3 принимает длину видео только в формате, где
количество кадров удовлетворяет условию: length % 17 == 5.

Пример: 124 % 17 = 5 → корректная длина.
"""

DEFAULT_FPS = 24
MIN_FRAMES = 5
DEFAULT_SECONDS = 15.0
MAX_SECONDS = 15.0


def seconds_to_frames(seconds: float, fps: int = DEFAULT_FPS) -> int:
    """
    Переводит секунды в корректное количество кадров для H3.

    Формула:
        1. Берём max(5, round(seconds * fps))
        2. Округляем до ближайшего числа, где value % 17 == 5
    """
    raw = max(MIN_FRAMES, round(float(seconds) * int(fps)))

    # Остаток от деления на 17 должен быть равен 5.
    remainder = raw % 17
    if remainder != 5:
        if remainder < 5:
            raw += (5 - remainder)
        else:
            raw += (5 - remainder) + 17

    return int(raw)


def frames_to_seconds(frames: int, fps: int = DEFAULT_FPS) -> float:
    """Обратный перевод — для отображения в UI."""
    return round(int(frames) / int(fps), 2)


def clamp_seconds(seconds: float) -> float:
    """Ограничивает длительность рабочим диапазоном."""
    return max(1.0, min(float(seconds), MAX_SECONDS))