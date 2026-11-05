# -*- coding: utf-8 -*-
"""🎞 Neron H3 Блок — одна сцена ролика Neron H3 Story: картинки, текст и LoRA одним проводом.

Подключается к Story AutoPrompter (текст — подсказка, он развернёт её в полный промпт)
или прямо к движку в режиме эксперта (текст идёт в модель как есть).
"""
from . import bus


class NeronH3Block:
    CATEGORY = "Neron/H3"
    FUNCTION = "make"
    RETURN_TYPES = (bus.BLOCK_TYPE,)
    RETURN_NAMES = ("block",)
    DESCRIPTION = ("Одна сцена Neron H3 Story: первый / промежуточные / последний кадр, что происходит и LoRA — "
                   "одним проводом. One Neron H3 Story scene: frames, what happens and LoRAs in one wire.")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": "",
                                    "placeholder": "что здесь происходит… / what happens here…",
                                    "tooltip": "Своими словами, на любом языке. С AutoPrompter — подсказка, он развернёт "
                                               "её в полный промпт блока. Прямо в движке — это и есть промпт блока.\n\n"
                                               "EN: In your own words. With the AutoPrompter it's a hint; straight into "
                                               "the engine it is the block prompt."}),
            },
            "optional": {
                "first_frame": ("IMAGE", {"tooltip": "Блок 1 — с чего начинается ролик (обязательно). Блоки 2+ "
                                                     "начинаются с хвоста прошлого блока, тут — образец «кто / где».\n\n"
                                                     "EN: Block 1 — the opening frame. Blocks 2+ start from the "
                                                     "previous tail; here it's a 'who / where' reference."}),
                "mid_frame_1": ("IMAGE", {"tooltip": "Промежуточный кадр — навигатор «куда идём»: другая комната, "
                                                     "место, предмет.\n\nEN: Middle frame — where the action goes."}),
                "mid_frame_2": ("IMAGE", {"tooltip": "Ещё один навигатор.\n\nEN: Another navigator."}),
                "last_frame": ("IMAGE", {"tooltip": "Чем этот блок должен закончиться — прикалывается к концу блока.\n\n"
                                                    "EN: How this block must end — anchored at its last frame."}),
                "loras": (bus.LORA_TYPE, {"tooltip": "LoRA только для этого блока — 🎨 Набор LoRA.\n\n"
                                                     "EN: LoRAs for this block only."}),
            },
        }

    def make(self, text="", first_frame=None, mid_frame_1=None, mid_frame_2=None, last_frame=None, loras=None):
        b = bus.block(text, first_frame, (mid_frame_1, mid_frame_2), last_frame, loras)
        parts = [f"{nm}: ✔" for nm, img in (("первый", first_frame), ("промеж. 1", mid_frame_1),
                                            ("промеж. 2", mid_frame_2), ("последний", last_frame)) if img is not None]
        if b["loras"]:
            parts.append("LoRA: " + ", ".join(d["name"].replace("\\", "/").split("/")[-1] for d in b["loras"]))
        return {"ui": {"text": [" · ".join(parts) or "только текст / text only"]}, "result": (b,)}


NODE_CLASS_MAPPINGS = {"NeronH3Block": NeronH3Block}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Block": "🎞 Neron H3 Блок / Block"}
