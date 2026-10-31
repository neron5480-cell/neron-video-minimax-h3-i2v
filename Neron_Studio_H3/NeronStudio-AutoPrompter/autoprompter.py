# -*- coding: utf-8 -*-
"""
🎬 Neron AutoPrompter
"""

import logging

from .multi_llm import NeronMultiImageLLM
from ._neron_shared import load_camera  # камера H3 — одна копия в ComfyUI-H3-Static-Camera

MyH3StaticCamera = load_camera().MyH3StaticCamera
from .dialog_node import (
    _auto_pick_model, 
    _auto_pick_mmproj, 
    _auto_pick_prompt, 
    _load_last_selection
)


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

        last = _load_last_selection()

        if last.get("model") in model_choices:
            default_model = last["model"]
        else:
            default_model = _auto_pick_model(model_choices)

        last_mmproj = last.get("mmproj")
        if last_mmproj and last_mmproj != "No_mmproj_Found" and last_mmproj in mmproj_choices:
            default_mmproj = last_mmproj
        else:
            default_mmproj = _auto_pick_mmproj(mmproj_choices, default_model)

        if last.get("director_prompt") in prompt_choices:
            default_prompt = last["director_prompt"]
        else:
            default_prompt = _auto_pick_prompt(prompt_choices)

        return {
            "required": {
                "expert_mode": ("BOOLEAN", {"default": False}),

                "workflow_mode": (
                    [
                        "[LLM] Autoprompter (Naxdy Brief) / Автопромтер",
                        "[LLM] Text Only (no images) / Только текст",
                        "[Manual] Regular Text (Direct Input) / Ручной ввод",
                    ],
                    {"default": "[LLM] Autoprompter (Naxdy Brief) / Автопромтер"},
                ),

                "camera_mode": (
                    [
                        "AUTO / АВТО",
                        "FRONT (Straight view) / ФРОНТ",
                        "LEFT (Side view) / СЛЕВА",
                        "RIGHT (Side view) / СПРАВА",
                        "BACK (From behind) / СЗАДИ",
                        "TOP (High angle) / СВЕРХУ",
                        "BOTTOM (Low angle) / СНИЗУ",
                    ],
                    {"default": "AUTO / АВТО"},
                ),
                "framing_type": (
                    ["wide shot", "medium shot", "close-up"],
                    {"default": "medium shot"},
                ),
                "fixed_distance": ("FLOAT", {
                    "default": 1.00, "min": 0.10, "max": 3.00,
                    "step": 0.05, "display": "slider",
                }),

                "seconds": ("FLOAT", {
                    "default": DEFAULT_SECONDS,
                    "min": 1.0, "max": 15.0, "step": 0.5,
                    "display": "slider",
                }),
                "fps": ("INT", {
                    "default": DEFAULT_FPS, "min": 1, "max": 60, "step": 1,
                }),

                "model": (model_choices, {"default": default_model,
                          "tooltip": "Системный промпт написан под Qwen 3.5 9B (с картинками). Модели поменьше "
                                     "(например, Qwen2.5-VL 7B) часто просто переводят бриф и почти не описывают "
                                     "камеру — это модель, а не нода.\n\nEN: The system prompt is written for "
                                     "Qwen 3.5 9B (vision). Smaller models (e.g. Qwen2.5-VL 7B) often just translate "
                                     "the brief and barely describe the camera — that is the model, not the node."}),
                "mmproj": (mmproj_choices, {"default": default_mmproj}),
                "system_prompt": (prompt_choices, {"default": default_prompt}),

                "max_tokens": ("INT", {
                    "default": 4096, "min": 1, "max": 32768,
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7, "min": 0.0, "max": 2.0, "step": 0.05,
                }),
                "n_ctx": ("INT", {
                    "default": 16384, "min": 512, "max": 32768,
                }),
                "n_gpu_layers": ("INT", {
                    "default": -1, "min": -1, "max": 999,
                }),
                "UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Гострабайтер: после генерации промпта "
                               "llama-server убивается. ВНИМАНИЕ: частая очистка "
                               "может вызвать конфликт портов.",
                }),

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

    RETURN_TYPES = ("STRING", "INT", "STRING", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("minimax_prompt", "frames_count", "storyboard_json", "img_0", "img_1", "img_2", "last_frm")
    FUNCTION = "generate"
    CATEGORY = "Neron/AutoPrompter"

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
        n_ctx = int(kwargs.get("n_ctx", 16384))
        n_gpu_layers = int(kwargs.get("n_gpu_layers", -1))
        unload_after = kwargs.get("UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ", False)
        manual_prompt = str(kwargs.get("manual_prompt", ""))
        subject_details = str(kwargs.get("subject_details", ""))

        prompt_in = kwargs.get("prompt_in")
        image_0 = kwargs.get("image_0")
        image_1 = kwargs.get("image_1")
        image_2 = kwargs.get("image_2")
        last_frame = kwargs.get("last_frame")

        total_frames = seconds_to_frames(seconds, fps)
        log.info(
            "[AutoPrompter] %.2f сек × %s fps → %s кадров",
            seconds, fps, total_frames,
        )

        is_llm = "[LLM]" in workflow_mode
        is_text_only = (
            "Text Only" in workflow_mode
            or "Только текст" in workflow_mode
        )

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

            if is_text_only:
                log.info(
                    "[AutoPrompter] Text Only — "
                    "все картинки игнорируются.",
                )
                llm_image_0 = None
                llm_image_1 = None
                llm_image_2 = None
                llm_last_frame = None
            else:
                log.info(
                    "[AutoPrompter] Multi-Image mode — картинки идут в LLM.",
                )
                llm_image_0 = image_0
                llm_image_1 = image_1
                llm_image_2 = image_2
                llm_last_frame = last_frame

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
                image_0=llm_image_0,
                image_1=llm_image_1,
                image_2=llm_image_2,
                last_frame=llm_last_frame,
                **{"UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ": unload_after},
            )

            autoprompt_text = result[0] if isinstance(result, tuple) else str(result)
            # Ошибку LLM нельзя отдавать в генератор как промпт: остановиться и показать её.
            # Never pass an LLM error on to the video generator as a prompt — stop and show it.
            head = str(autoprompt_text).lstrip()[:20].lower()
            if not head or head.startswith(("ошибка", "error", "❌", "⚠")):
                raise RuntimeError("[AutoPrompter] LLM не сработал / LLM failed:\n" + str(autoprompt_text))
            log.info(
                "[AutoPrompter] LLM ответ (%s символов)",
                len(autoprompt_text),
            )
        else:
            log.info("[AutoPrompter] Режим Manual. LLM не запускается.")
            autoprompt_text = ""

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

        return (
            minimax_prompt, 
            int(frames_count), 
            storyboard_json, 
            image_0, 
            image_1, 
            image_2, 
            last_frame
        )


NODE_CLASS_MAPPINGS = {
    "NeronAutoPrompter": NeronAutoPrompter,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronAutoPrompter": "🎬 Neron Auto Prompter",
}