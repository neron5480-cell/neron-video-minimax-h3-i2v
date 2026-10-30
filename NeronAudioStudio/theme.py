# -*- coding: utf-8 -*-
"""
Neron Theme / Тема 🎨

RU: Нода ни к чему не подключается. Есть на столе — ноды Neron окрашены в выбранную
    тему (Графит, Neron Brown, Неон) и, если включена «живость», по их рамкам бегут
    огоньки, по проводам — искры, а на ударах музыки всё вспыхивает. Нет ноды —
    обычный серый вид. Тема сохраняется вместе со схемой.
EN: Not wired to anything. On the canvas — Neron nodes take the chosen theme
    (Graphite, Neron Brown, Neon) and, with "life" on, lights run along their frames,
    sparks along the wires and everything flashes on the beat. No node — the plain grey
    look. The theme is saved with the workflow.
"""

import json


class NeronTheme:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"theme_json": ("STRING", {"default": json.dumps({"theme": "brown", "life": 1})})}}

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "NeronAudio"
    DESCRIPTION = "Тема оформления нод Neron (ни к чему не подключается). Theme for Neron nodes (not wired to anything)."

    def noop(self, theme_json):
        return ()


NODE_CLASS_MAPPINGS = {"NeronTheme": NeronTheme}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronTheme": "Тема Audio Studio (legacy → Neron Theme 🎨) / Old theme"}
