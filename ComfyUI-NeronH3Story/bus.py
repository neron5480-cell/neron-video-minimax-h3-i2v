# -*- coding: utf-8 -*-
"""Общий язык нод Neron H3 Story: типы проводов, план блоков, сборка блока.

Провода:
  NERON_H3_LORAS — список {"name", "strength"} (нода 🎨 Набор LoRA).
  NERON_H3_BLOCK — одна сцена (нода 🎞 Блок): {"text", "first", "mid", "last", "loras"}.
  NERON_H3_STORY — шина от Story AutoPrompter в движок:
      {"total_seconds", "block_seconds", "first_frame", "appearance", "lora_all",
       "blocks": [{"prompt", "first", "mid", "last", "loras"}, …]}
"""
import math

LORA_TYPE = "NERON_H3_LORAS"
BLOCK_TYPE = "NERON_H3_BLOCK"
STORY_TYPE = "NERON_H3_STORY"

FPS = 24
MAX_BLOCKS = 12
TOTAL_MIN, TOTAL_MAX = 5.0, 45.0
BLOCK_MIN, BLOCK_MAX = 5.0, 15.0
MIN_TRAINED = 124          # 5 с — меньше модель не обучена; блоки цепочки не короче


def grid(n):
    """Кадры на сетку модели 17k+5, в пределах 22…362."""
    n = max(22, int(n))
    while n % 17 != 5:
        n += 1
    return min(n, 362)


def plan(total_seconds, block_seconds, seam_frames):
    """→ (блоков, кадров в блоке, кадров всего, предел блока в кадрах).
    Длина блока — максимум: ролик делится на РОВНЫЕ блоки не длиннее неё (стык съедает seam_frames)."""
    total = min(TOTAL_MAX, max(TOTAL_MIN, float(total_seconds)))
    T = int(round(total * FPS))
    n_max = grid(round(min(BLOCK_MAX, max(BLOCK_MIN, float(block_seconds))) * FPS))
    S = int(seam_frames)
    if T <= n_max:
        return 1, grid(T), T, n_max
    blocks = math.ceil((T - S) / (n_max - S))
    n = min(grid(max(MIN_TRAINED, math.ceil((T + (blocks - 1) * S) / blocks))), n_max)
    return blocks, n, T, n_max


def block(text="", first=None, mid=(), last=None, loras=()):
    return {"text": (text or "").strip(), "first": first, "mid": [m for m in mid if m is not None],
            "last": last, "loras": list(loras or [])}


def loras_pairs(loras):
    return [(d["name"], float(d["strength"])) for d in (loras or [])]
