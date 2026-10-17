# -*- coding: utf-8 -*-
"""
🎬 Neron AutoPrompter

Объединяет две ноды в одну:
  • Neron Multi-Image LLM  — мозг (4 картинки + мысль → промпт)
  • Camera Operator        — камера (промпт + ракурс → minimax_prompt)

Один сервер, одна сессия, один вызов — гострабайтер.

Режимы работы:
  [LLM]       — LLM читает картинки + мысль → промпт.
  [LLM] Text  — LLM читает ТОЛЬКО мысль, картинки игнорируются.
                Generator получит чёрный кадр → text-to-video.
  [Manual]    — LLM не запускается. Текст из виджетов.
"""

import logging

from .multi_llm import NeronMultiImageLLM
from .h3_static_camera import MyH3StaticCamera


log = logging.getLogger("Neron.AutoPrompter")


DEFAULT_FPS = 24
DEFAULT_SECONDS = 15.0
MIN_FRAMES = 5


def seconds_to_frames(seconds, fps=DEFAULT_FPS):
    raw = max(MIN_FRAMES, round(float(seconds) * int(fps)))
    remainder = raw % 17
    if remainder != 5:
        if remainder < 5:
            raw += (5 - remainder)
        else:
            raw += (5 - remainder) + 17
    return int(raw)


class NeronAutoPrompter:

    @classmethod
    def INPUT_TYPES(cls):
        multi_inputs = NeronMultiImageLLM.INPUT_TYPES()
        req = multi_inputs["required"]
        model_choices = req["model"][0]
        mmproj_choices = req["mmproj"][0]
        prompt_choices = req["system_prompt"][0]

        return {
            "required": {
                # === 1. EXPERT MODE ===
                "expert_mode": ("BOOLEAN", {"default": False}),

                # === 2. РЕЖИМ ===
                "workflow_mode": (
                    [
                        "[LLM] Autoprompter (Naxdy Brief) / Автопромтер",
                        "[LLM] Text Only (no images) / Только текст",
                        "[Manual] Regular Text (Direct Input) / Ручной ввод",
                    ],
                    {"default": "[LLM] Autoprompter (Naxdy Brief) / Автопромтер"},
                ),

                # === 3. КАМЕРА ===
                "camera_mode": (
                    [
                        "AUTO (Listen to autoprompter) / АВТО",
                        "FRONT (Straight view) / ФРОНТ",
                        "LEFT (Side view) / СЛЕВА",
                        "RIGHT (Side view) / СПРАВА",
                        "BACK (From behind) / СЗАДИ",
                        "TOP (High angle) / СВЕРХУ",
                        "BOTTOM (Low angle) / СНИЗУ",
                    ],
                    {"default": "AUTO (Listen to autoprompter) / АВТО"},
                ),
                "framing_type": (
                    ["wide shot", "medium shot", "close-up"],
                    {"default": "medium shot"},
                ),
                "fixed_distance": ("FLOAT", {
                    "default": 1.00, "min": 0.10, "max": 3.00,
                    "step": 0.05, "display": "slider",
                }),

                # === 4. ДЛИНА ===
                "seconds": ("FLOAT", {
                    "default": DEFAULT_SECONDS,
                    "min": 1.0, "max": 15.0, "step": 0.5,
                    "display": "slider",
                }),
                "fps": ("INT", {
                    "default": DEFAULT_FPS, "min": 1, "max": 60, "step": 1,
                }),

                # === 5. МОДЕЛЬ LLM (expert) ===
                "model": (model_choices,),
                "mmproj": (mmproj_choices,),
                "system_prompt": (prompt_choices,),

                # === 6. ПАРАМЕТРЫ LLM (expert) ===
                "max_tokens": ("INT", {
                    "default": 4096, "min": 1, "max": 32768,
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7, "min": 0.0, "max": 2.0, "step": 0.05,
                }),
                "n_ctx": ("INT", {
                    "default": 8192, "min": 512, "max": 32768,
                }),
                "n_gpu_layers": ("INT", {
                    "default": -1, "min": -1, "max": 999,
                }),
                "UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Гострабайтер: после генерации промпта "
                               "llama-server убивается.",
                }),

                # === 7. ТЕКСТ ВРУЧНУЮ ===
                "manual_prompt": ("STRING", {
                    "multiline": True,
                    "default": "",
                }),
                "subject_details": ("STRING", {
                    "multiline": True,
                    "default": "",
                }),
            },
            "optional": {
                "prompt_in": ("STRING", {"forceInput": True}),
                "image_0": ("IMAGE",),
                "image_1": ("IMAGE",),
                "image_2": ("IMAGE",),
                "last_frame": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING", "INT", "STRING")
    RETURN_NAMES = ("minimax_prompt", "frames_count", "storyboard_json")
    FUNCTION = "generate"
    CATEGORY = "Neron/AutoPrompter"

    # ------------------------------------------------------------------
    def generate(self, **kwargs):
        workflow_mode = str(kwargs.get("workflow_mode", ""))
        camera_mode = str(kwargs.get("camera_mode", ""))
        framing_type = str(kwargs.get("framing_type", "medium shot"))
        fixed_distance = float(kwargs.get("fixed_distance", 1.0))
        seconds = float(kwargs.get("seconds", DEFAULT_SECONDS))
        fps = int(kwargs.get("fps", DEFAULT_FPS))

        model = kwargs.get("model")
        mmproj = kwargs.get("mmproj")
        system_prompt = kwargs.get("system_prompt")
        max_tokens = int(kwargs.get("max_tokens", 4096))
        temperature = float(kwargs.get("temperature", 0.7))
        n_ctx = int(kwargs.get("n_ctx", 8192))
        n_gpu_layers = int(kwargs.get("n_gpu_layers", -1))
        unload_after = kwargs.get("UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ", True)
        manual_prompt = str(kwargs.get("manual_prompt", ""))
        subject_details = str(kwargs.get("subject_details", ""))

        prompt_in = kwargs.get("prompt_in")
        image_0 = kwargs.get("image_0")
        image_1 = kwargs.get("image_1")
        image_2 = kwargs.get("image_2")
        last_frame = kwargs.get("last_frame")

        # Кадры по кратности 17.
        total_frames = seconds_to_frames(seconds, fps)
        log.info(
            "[AutoPrompter] %.2f сек × %s fps → %s кадров",
            seconds, fps, total_frames,
        )

        # === Определяем режим ===
        is_llm = "[LLM]" in workflow_mode
        is_text_only = (
            "Text Only" in workflow_mode
            or "Только текст" in workflow_mode
        )

        # === ШАГ 1: получаем текст от LLM (только в LLM-режимах) ===
        if is_llm:
            log.info("[AutoPrompter] Режим LLM. Запускаю Multi-Image LLM.")

            llm = NeronMultiImageLLM()

            user_prompt = ""
            if prompt_in is not None and str(prompt_in).strip():
                user_prompt = str(prompt_in).strip()

            log.info(
                "[AutoPrompter] Промпт (%s символов): %s",
                len(user_prompt), user_prompt[:120],
            )

            # === В Text Only — картинки игнорируются ===
            if is_text_only:
                log.info(
                    "[AutoPrompter] Text Only — "
                    "все картинки игнорируются.",
                )
                image_0 = None
                image_1 = None
                image_2 = None
                last_frame = None
            else:
                log.info(
                    "[AutoPrompter] Multi-Image mode — картинки идут в LLM.",
                )

            result = llm.generate(
                model=model,
                mmproj=mmproj,
                system_prompt=system_prompt,
                prompt="",
                max_tokens=max_tokens,
                temperature=temperature,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                prompt_in=user_prompt if user_prompt else None,
                image_0=image_0,
                image_1=image_1,
                image_2=image_2,
                last_frame=last_frame,
                **{"UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ": unload_after},
            )

            autoprompt_text = result[0] if isinstance(result, tuple) else str(result)
            log.info(
                "[AutoPrompter] LLM ответ (%s символов)",
                len(autoprompt_text),
            )
        else:
            log.info("[AutoPrompter] Режим Manual. LLM не запускается.")
            autoprompt_text = ""

        # === ШАГ 2: прогоняем текст через Camera Operator ===
        log.info("[AutoPrompter] Camera Operator.")

        camera = MyH3StaticCamera()
        camera_result = camera.generate_static_data(
            workflow_mode=workflow_mode,
            camera_mode=camera_mode,
            framing_type=framing_type,
            total_frames=total_frames,
            fps=fps,
            fixed_distance=fixed_distance,
            autoprompt_text=autoprompt_text,
            manual_prompt=manual_prompt,
            subject_details=subject_details,
        )

        minimax_prompt = camera_result[0]
        storyboard_json = camera_result[1]
        frames_count = camera_result[3]

        log.info(
            "[AutoPrompter] Готово. Промпт %s символов, %s кадров.",
            len(minimax_prompt), frames_count,
        )

        return minimax_prompt, int(frames_count), storyboard_json


NODE_CLASS_MAPPINGS = {
    "NeronAutoPrompter": NeronAutoPrompter,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronAutoPrompter": "🎬 Neron AutoPrompter",
}