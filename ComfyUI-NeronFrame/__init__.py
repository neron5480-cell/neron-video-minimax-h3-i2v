# -*- coding: utf-8 -*-
"""🧩 Neron Сборка кадра — герой + место + поза (+ доп. образец) → кадр на MiniMax H3 Image (официально, Comfy-Org).
Свой пакет: ни от одной другой папки Neron не зависит (с 🗂 Картотекой H3 Story дружит по шине NERON_H3_CAST)."""
from . import downloader, node

downloader.register_routes()

NODE_CLASS_MAPPINGS = dict(node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(node.NODE_DISPLAY_NAME_MAPPINGS)
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
