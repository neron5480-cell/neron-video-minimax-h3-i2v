# -*- coding: utf-8 -*-
"""📝 Neron H3 Бланк промпта / Prompt Form.
Весь бланк живёт в одном скрытом поле «form» (JSON) — его рисует web/prompt_form.js.
EN: The whole form is stored in one hidden field «form» (JSON), drawn by web/prompt_form.js."""
import logging

from . import form as _form

log = logging.getLogger("Neron.H3.PromptForm")


class NeronH3PromptForm:
    CATEGORY = "Neron/H3"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    OUTPUT_TOOLTIPS = ("Готовый промпт — в вход prompt движка H3.\n\nEN: The finished prompt — into the H3 engine's "
                       "prompt input.",)
    DESCRIPTION = ("Подробный промпт по участкам: место и время, герои, действие, камера, звук, речь, музыка, образцы. "
                   "Пишешь сам, нода склеивает в один текст. Язык любой — H3 понимает и русский, и английский.\n\n"
                   "EN: A detailed prompt by sections. You write it yourself, the node joins it into one text. "
                   "Any language — H3 understands Russian and English alike.")

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"form": ("STRING", {"default": "{}", "multiline": False,
                                                 "tooltip": "Бланк целиком (заполняется окнами ноды). "
                                                            "EN: The whole form (filled by the node's boxes)."})}}

    def build(self, form="{}"):
        prompt = _form.compile_form(_form.parse(form))
        if not prompt:
            raise ValueError("[Neron H3 Бланк] Бланк пуст — заполни хотя бы «Действие».\n\n"
                             "EN: The form is empty — fill in at least «Action».")
        log.info("[H3 Бланк] промпт: %d знаков", len(prompt))
        return {"ui": {"text": [prompt]}, "result": (prompt,)}


NODE_CLASS_MAPPINGS = {"NeronH3PromptForm": NeronH3PromptForm}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3PromptForm": "📝 Neron H3 Бланк промпта / Prompt Form"}
