# -*- coding: utf-8 -*-
"""
🎥 Neron MiniMax H3 Generator

Единый движок генерации видео + звука через MiniMax H3.
Промпт приходит ТОЛЬКО извне.
"""

import logging

import torch

from .frames import (
    DEFAULT_FPS,
    DEFAULT_SECONDS,
    clamp_seconds,
    seconds_to_frames,
)
from .memory import free_between_stages, log_vram
from .lora_cache import NO_LORA
from . import pipeline
from . import hd


log = logging.getLogger("Neron.H3.Generator")


RESOLUTION_PRESETS = {
    "Кино 16:9 (1344x768)":        (1344, 768),
    "Телефон 9:16 (768x1344)":     (768, 1344),
    "Квадрат 1:1 (1024x1024)":     (1024, 1024),
    "Классика 4:3 (1024x768)":     (1024, 768),
    "Широкий 21:9 (1536x640)":     (1536, 640),
    "Вертикаль 3:4 (768x1024)":    (768, 1024),
}

RESOLUTION_MODE_PRESETS = "Пресеты / Presets"
RESOLUTION_MODE_MANUAL = "Ручной / Manual"


def _list_files(folder_key):
    import folder_paths
    try:
        files = folder_paths.get_filename_list(folder_key)
    except Exception as error:
        log.warning(
            "[H3 Generator] Не удалось получить список %s: %s",
            folder_key, error,
        )
        return ["__not_found__"]
    if not files:
        return ["__not_found__"]
    return list(files)


def _lora_choices():
    return [NO_LORA] + _list_files("loras")


def _unet_choices():
    return _list_files("diffusion_models")


def _clip_choices():
    return _list_files("text_encoders")


def _vae_choices():
    return _list_files("vae")


def _round_to_divisible(value, by=32):
    value = int(value)
    by = max(1, int(by))
    if by <= 1:
        return max(1, value)
    rounded = (value + by // 2) // by * by
    return max(by, rounded)


class NeronMiniMaxH3Generator:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "expert_mode": ("BOOLEAN", {"default": False}),

                # HD-режимы добавлены В КОНЕЦ списка: старые схемы (Turbo / Normal) открываются как раньше.
                "MODE / РЕЖИМ": (
                    ["Turbo / Турбо", "Normal / Обычный"] + hd.MODES,
                    {"default": "Turbo / Турбо",
                     "tooltip": "Turbo — 8 шагов, Normal — 20 шагов, в выбранном размере.\n"
                                "HD-режимы — полный размер модели за один прогон: маленький черновик → "
                                "увеличение → короткий чистовик. ⚡ Быстро HD ≈ 1 мин на секунду видео, "
                                "Баланс HD — чище, Чисто HD — ещё чище и дольше (замер на RTX 5070 Ti 16 ГБ).\n\n"
                                "EN: Turbo — 8 steps, Normal — 20 steps at the chosen size. HD modes — full model "
                                "size in one run: small draft → upscale → short refine. Fast HD ≈ 1 min per "
                                "second of video; Balance HD cleaner; Clean HD cleanest and slowest."},
                ),
                "SECONDS / СЕКУНДЫ": ("FLOAT", {
                    "default": DEFAULT_SECONDS,
                    "min": 1.0, "max": 15.0, "step": 0.5,
                    "display": "slider",
                }),

                "resolution_mode": (
                    [RESOLUTION_MODE_PRESETS, RESOLUTION_MODE_MANUAL],
                    {"default": RESOLUTION_MODE_PRESETS},
                ),
                "resolution_preset": (
                    list(RESOLUTION_PRESETS.keys()),
                    {"default": "Кино 16:9 (1344x768)"},
                ),
                "manual_width": ("INT", {
                    "default": 1344, "min": 64, "max": 4096, "step": 32,
                }),
                "manual_height": ("INT", {
                    "default": 768, "min": 64, "max": 4096, "step": 32,
                }),
                "divisible_by": ([8, 16, 32, 64], {"default": 32}),

                "slot_1_enabled": ("BOOLEAN", {
                    "default": False,
                    "label_on": "ON / Вкл",
                    "label_off": "OFF / Откл",
                }),
                "slot_1_lora": (_lora_choices(), {"default": NO_LORA}),
                "slot_1_strength": ("FLOAT", {
                    "default": 1.0, "min": -1.0, "max": 2.0, "step": 0.05,
                }),

                "slot_2_enabled": ("BOOLEAN", {
                    "default": False,
                    "label_on": "ON / Вкл",
                    "label_off": "OFF / Откл",
                }),
                "slot_2_lora": (_lora_choices(), {"default": NO_LORA}),
                "slot_2_strength": ("FLOAT", {
                    "default": 1.0, "min": -1.0, "max": 2.0, "step": 0.05,
                }),

                "slot_3_enabled": ("BOOLEAN", {
                    "default": False,
                    "label_on": "ON / Вкл",
                    "label_off": "OFF / Откл",
                }),
                "slot_3_lora": (_lora_choices(), {"default": NO_LORA}),
                "slot_3_strength": ("FLOAT", {
                    "default": 1.0, "min": -1.0, "max": 2.0, "step": 0.05,
                }),

                "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ": ("BOOLEAN", {
                    "default": True,
                }),
                "decode_tile_size": ("INT", {
                    "default": 0, "min": 0, "max": 2048, "step": 128,
                }),

                "unet_model": (_unet_choices(), {
                    "default": pipeline.UNET_NAME,
                }),
                "clip_model": (_clip_choices(), {
                    "default": pipeline.CLIP_NAME,
                }),
                "vae_video_model": (_vae_choices(), {
                    "default": pipeline.VAE_VIDEO_NAME,
                }),
                "vae_audio_model": (_vae_choices(), {
                    "default": pipeline.VAE_AUDIO_NAME,
                }),
                "turbo_lora_model": (_lora_choices(), {
                    "default": pipeline.TURBO_LORA_NAME,
                }),

                "normal_steps": ("INT", {
                    "default": 20, "min": 1, "max": 100,
                }),
                "turbo_steps": ("INT", {
                    "default": 8, "min": 1, "max": 50,
                }),
                "seed": ("INT", {
                    "default": 1, "min": 0, "max": 0xFFFFFFFFFFFFFFFF,
                }),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True}),
                "ref_image_0": ("IMAGE",),
                "ref_image_1": ("IMAGE",),
                "ref_image_2": ("IMAGE",),
                "ref_image_3": ("IMAGE",),
                "ref_video": ("IMAGE",),
                "ref_video_audio": ("AUDIO",),
                "ref_audio": ("AUDIO",),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
                "length_in": ("INT", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "audio", "last_frame", "frames_count")
    FUNCTION = "generate"
    CATEGORY = "Neron/H3"

    # ------------------------------------------------------------------
    def _make_black_frame(self, width, height):
        log.info(
            "[H3 Generator] Нет стартового кадра → "
            "создаю чёрный %sx%s", width, height,
        )
        return torch.zeros(
            (1, int(height), int(width), 3),
            dtype=torch.float32,
        )

    def _collect_loras(self, kwargs):
        loras = []
        for slot in (1, 2, 3):
            enabled = kwargs.get(
                "slot_" + str(slot) + "_enabled", False,
            )
            name = kwargs.get(
                "slot_" + str(slot) + "_lora", NO_LORA,
            )
            strength = kwargs.get(
                "slot_" + str(slot) + "_strength", 1.0,
            )
            if not enabled:
                continue
            if name == NO_LORA:
                continue
            loras.append((name, float(strength)))
        return loras

    def _resolve_size(self, kwargs):
        width_in = kwargs.get("width")
        height_in = kwargs.get("height")
        divisible_by = int(kwargs.get("divisible_by", 32))

        if width_in is not None and height_in is not None:
            w = int(width_in)
            h = int(height_in)
            source = "from_input"
        else:
            mode = str(kwargs.get(
                "resolution_mode", RESOLUTION_MODE_PRESETS,
            ))
            if mode == RESOLUTION_MODE_MANUAL:
                w = int(kwargs.get("manual_width", 1344))
                h = int(kwargs.get("manual_height", 768))
                source = "manual"
            else:
                preset_name = str(kwargs.get(
                    "resolution_preset",
                    "Кино 16:9 (1344x768)",
                ))
                w, h = RESOLUTION_PRESETS.get(
                    preset_name, (1344, 768),
                )
                source = "preset: " + preset_name

        w = _round_to_divisible(w, divisible_by)
        h = _round_to_divisible(h, divisible_by)
        log.info(
            "[H3 Generator] Размер: %sx%s (источник: %s, кратно %s)",
            w, h, source, divisible_by,
        )
        return w, h

    def _resolve_models(self, kwargs):
        def pick(key, default):
            val = kwargs.get(key, None)
            if val is None or val == "" or val == "__not_found__":
                return default
            return val

        return {
            "unet": pick("unet_model", pipeline.UNET_NAME),
            "clip": pick("clip_model", pipeline.CLIP_NAME),
            "clip_type": pipeline.CLIP_TYPE,
            "vae_video": pick(
                "vae_video_model", pipeline.VAE_VIDEO_NAME,
            ),
            "vae_audio": pick(
                "vae_audio_model", pipeline.VAE_AUDIO_NAME,
            ),
            "turbo_lora": pick(
                "turbo_lora_model", pipeline.TURBO_LORA_NAME,
            ),
        }

    # ------------------------------------------------------------------
    def generate(self, **kwargs):
        prompt_raw = kwargs.get("prompt", None)
        prompt = str(prompt_raw).strip() if prompt_raw else ""

        if not prompt:
            raise ValueError(
                "[H3 Generator] Промпт не подключён. "
                "Подключи вход 'prompt'."
            )

        mode = str(kwargs.get("MODE / РЕЖИМ", "Turbo / Турбо"))
        seconds = clamp_seconds(
            kwargs.get("SECONDS / СЕКУНДЫ", DEFAULT_SECONDS)
        )

        length_in = kwargs.get("length_in")
        if length_in is not None and int(length_in) > 0:
            total_frames = int(length_in)
        else:
            total_frames = seconds_to_frames(seconds, DEFAULT_FPS)

        width, height = self._resolve_size(kwargs)

        if mode in hd.PRESETS:
            return self._generate_hd(mode, prompt, width, height, total_frames, kwargs)

        is_turbo = mode.startswith("Turbo")
        steps = (
            int(kwargs.get("turbo_steps", 8)) if is_turbo
            else int(kwargs.get("normal_steps", 20))
        )
        shift_video, shift_audio = (6, 3) if is_turbo else (12, 3)

        seed = int(kwargs.get("seed", 1))
        models = self._resolve_models(kwargs)
        decode_tile_size = int(kwargs.get("decode_tile_size", 0) or 0)

        log.info(
            "[H3 Generator] mode=%s steps=%s shift=%s/%s "
            "size=%sx%s frames=%s seed=%s decode_tile=%s",
            "Turbo" if is_turbo else "Normal",
            steps, shift_video, shift_audio,
            width, height, total_frames, seed,
            decode_tile_size if decode_tile_size > 0 else "auto",
        )

        ref_image_0 = kwargs.get("ref_image_0")
        if ref_image_0 is None:
            ref_image_0 = self._make_black_frame(width, height)

        ref_images = [
            ref_image_0,
            kwargs.get("ref_image_1"),
            kwargs.get("ref_image_2"),
            kwargs.get("ref_image_3"),
        ]

        user_loras = self._collect_loras(kwargs)

        ref_video = kwargs.get("ref_video")
        ref_video_audio = kwargs.get("ref_video_audio")
        ref_audio = kwargs.get("ref_audio")

        log_vram("Before generation")
        free_between_stages("Перед стартом генерации")
        log_vram("After pre-clean")

        try:
            video, audio, last_frame, frames_count = pipeline.generate(
                prompt=prompt,
                ref_images=ref_images,
                width=width,
                height=height,
                length=total_frames,
                is_turbo=is_turbo,
                steps=steps,
                shift_video=shift_video,
                shift_audio=shift_audio,
                seed=seed,
                user_loras=user_loras,
                models=models,
                decode_tile_size=decode_tile_size,
                ref_video=ref_video,
                ref_video_audio=ref_video_audio,
                ref_audio=ref_audio,
            )
        finally:
            free_after = kwargs.get(
                "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ", True,
            )
            if free_after:
                free_between_stages(
                    "После генерации (FREE AFTER RUN)",
                )

        return video, audio, last_frame, frames_count

    # ------------------------------------------------------------------
    def _generate_hd(self, mode, prompt, width, height, total_frames, kwargs):
        """HD: форма — из размера (пресет / ручной / провода), размер — максимальный по паспорту модели."""
        w, h = hd.canvas(width, height)
        if (w, h) != (width, height):
            log.info("[H3 Generator] HD: %sx%s → паспорт модели %sx%s", width, height, w, h)
        refs = [kwargs.get("ref_image_" + str(i)) for i in range(4)]
        free_between_stages("HD: перед стартом")
        try:
            video, audio, last_frame, frames_count, report = hd.generate(
                mode=mode, prompt=prompt, ref_images=refs, width=w, height=h, length=total_frames,
                seed=int(kwargs.get("seed", 1)), user_loras=self._collect_loras(kwargs),
                models=self._resolve_models(kwargs),
                decode_tile_size=int(kwargs.get("decode_tile_size", 0) or 0),
                ref_video=kwargs.get("ref_video"), ref_video_audio=kwargs.get("ref_video_audio"),
                ref_audio=kwargs.get("ref_audio"))
        except Exception:
            free_between_stages("HD: после ошибки")
            raise
        finally:
            if kwargs.get("FREE AFTER RUN / ОЧИСТКА ПОСЛЕ", True):
                free_between_stages("После генерации (FREE AFTER RUN)")
        return {"ui": {"text": ["\n".join(report)]},
                "result": (video, audio, last_frame, frames_count)}


NODE_CLASS_MAPPINGS = {
    "NeronMiniMaxH3Generator": NeronMiniMaxH3Generator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronMiniMaxH3Generator": "🎥 Neron MiniMax H3 Generator",
}