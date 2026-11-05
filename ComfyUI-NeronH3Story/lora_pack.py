# -*- coding: utf-8 -*-
"""🎨 Neron H3 LoRA — набор LoRA для блока (или для всего ролика) Neron H3 Story.

Нода ничего не грузит: только собирает «какие LoRA и с какой силой». Движок применит их к своему блоку.
Набор можно наращивать: вход pack ← выход другого набора (больше трёх LoRA на блок).
"""
NO_LORA = "— нет / none —"
LORA_TYPE = "NERON_H3_LORAS"


def _loras():
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list("loras"))
    except Exception:
        files = []
    return [NO_LORA] + files


class NeronH3LoraPack:
    CATEGORY = "Neron/H3"
    FUNCTION = "pack"
    RETURN_TYPES = (LORA_TYPE,)
    RETURN_NAMES = ("loras",)
    DESCRIPTION = ("Набор LoRA для одного блока Neron H3 Story (или для всего ролика — во вход lora_all). "
                   "LoRA set for one Neron H3 Story block (or for the whole video via lora_all).")

    @classmethod
    def INPUT_TYPES(cls):
        loras = _loras()
        req = {}
        for i in (1, 2, 3):
            req[f"lora_{i}"] = (loras, {"default": NO_LORA, "display_name": f"LoRA {i}",
                                        "tooltip": "Своя LoRA: стиль, персонаж, свет, движение.\n\nEN: Your LoRA."})
            req[f"strength_{i}"] = ("FLOAT", {"default": 1.0, "min": -2.0, "max": 2.0, "step": 0.05,
                                              "display_name": f"LoRA {i} · сила / strength"})
        return {"required": req,
                "optional": {"pack": (LORA_TYPE, {"tooltip": "Ещё один набор — если нужно больше трёх LoRA.\n\n"
                                                             "EN: Another set — for more than three LoRAs."})}}

    @classmethod
    def VALIDATE_INPUTS(cls, lora_1=None, lora_2=None, lora_3=None):
        # Чужая схема с LoRA, которой у тебя нет, не должна давать красное окно — пропустим с пояснением.
        return True

    def pack(self, lora_1=NO_LORA, strength_1=1.0, lora_2=NO_LORA, strength_2=1.0, lora_3=NO_LORA,
             strength_3=1.0, pack=None):
        have = set(_loras())
        out, notes = list(pack or []), []
        for name, st in ((lora_1, strength_1), (lora_2, strength_2), (lora_3, strength_3)):
            if not name or name == NO_LORA or abs(float(st)) < 1e-6:
                continue
            if name not in have:
                notes.append(f"нет файла «{name}» — пропущена / missing file, skipped")
                continue
            out.append({"name": name, "strength": float(st)})
        text = "\n".join([f"{d['name'].replace(chr(92), '/').split('/')[-1]} ×{d['strength']:g}" for d in out]
                         + notes) or "пусто / empty"
        return {"ui": {"text": [text]}, "result": (out,)}


NODE_CLASS_MAPPINGS = {"NeronH3LoraPack": NeronH3LoraPack}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3LoraPack": "🎨 Neron H3 LoRA / Набор LoRA"}
