# -*- coding: utf-8 -*-
"""🖼 Neron Image — картинка по тексту на Krea 2 (официальные модели Comfy-Org) с автопромтером.
Свой пакет: ни от одной другой папки Neron не зависит."""
from . import downloader, node, theme_node

downloader.register_routes()

NODE_CLASS_MAPPINGS = dict(node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(node.NODE_DISPLAY_NAME_MAPPINGS)
# Тема вшита в сам процесс: отдельный пакет Neron Theme не нужен.
NODE_CLASS_MAPPINGS.update(theme_node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS.update(theme_node.NODE_DISPLAY_NAME_MAPPINGS)
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
