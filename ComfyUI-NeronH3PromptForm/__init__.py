# -*- coding: utf-8 -*-
"""📝 Neron H3 Бланк промпта — подробный промпт по участкам, без автопромтера.
Свой пакет: ни от одной другой папки Neron не зависит.

EN: 📝 Neron H3 Prompt Form — a detailed prompt filled in by sections, no autoprompter. Self-contained."""
from . import node

NODE_CLASS_MAPPINGS = dict(node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(node.NODE_DISPLAY_NAME_MAPPINGS)
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
