# -*- coding: utf-8 -*-
"""
Neron Music / Музыка

RU: Барабаны и пианино в одной ноде — вкладки 🥁 / 🎹, общий темп, кнопка «играть всё».
    В Пульт идут ДВА канала (барабаны и пианино отдельно — у каждого свой звук,
    громкость, эквалайзер, эхо). Выход audio — всё вместе одним звуком.
EN: Drums and piano in one node — 🥁 / 🎹 tabs, one tempo, a "play all" button.
    The Pult gets TWO channels (drums and piano, each with its own volume, EQ,
    reverb). The audio output is everything mixed into one sound.
"""

import numpy as np
import torch

from .drum_machine import SAMPLE_RATE, render_pattern, save_wav, _num, _default_pattern_json
from .piano_roll import render_project, _default_project_json


def render_music(kit_name, bpm, pattern_json, project_json):
    drums = render_pattern(kit_name, bpm, pattern_json)
    piano = render_project(kit_name, bpm, project_json)
    return drums, piano


def mix_loops(waves):
    """Свести лупы разной длины: короткий повторяется до длины самого длинного."""
    waves = [w for w in waves if w is not None and len(w)]
    if not waves:
        return np.zeros((SAMPLE_RATE, 2), dtype=np.float32)
    n = max(len(w) for w in waves)
    mix = np.zeros((n, 2), dtype=np.float32)
    for w in waves:
        mix += w[np.arange(n) % len(w)]
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= np.float32(0.99 / peak)
    return mix


class NeronMusic:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "kit_name": ("STRING", {"default": "default"}),
                "bpm": ("INT", {"default": 90, "min": 40, "max": 300}),
                "pattern_json": ("STRING", {"default": _default_pattern_json()}),
                "project_json": ("STRING", {"default": _default_project_json()}),
                "save_name": ("STRING", {"default": "neron_music"}),
            }
        }

    RETURN_TYPES = ("NERON_SOUNDS", "AUDIO", "INT")
    RETURN_NAMES = ("sounds", "audio", "bpm")
    OUTPUT_TOOLTIPS = (
        "В Пульт (вход audio_N): два канала — барабаны и пианино / To the Pult (audio_N): two channels — drums and piano",
        "Всё вместе одним звуком / Everything as one sound",
        "Темп / Tempo",
    )
    FUNCTION = "generate"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "Барабаны + пианино в одной ноде. Drums + piano in one node."

    def generate(self, kit_name, bpm, pattern_json, project_json, save_name):
        drums, piano = render_music(kit_name, bpm, pattern_json, project_json)
        mix = mix_loops([drums, piano])
        save_wav(mix, save_name)
        sounds = {"neron": "sounds", "sounds": [
            {"name": "Барабаны / Drums", "wave": drums},
            {"name": "Пианино / Piano", "wave": piano},
        ]}
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        return (sounds, {"waveform": waveform, "sample_rate": SAMPLE_RATE}, int(_num(bpm, 90, 40, 300)))


NODE_CLASS_MAPPINGS = {"NeronMusic": NeronMusic}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronMusic": "Neron Music / Музыка 🥁🎹"}
