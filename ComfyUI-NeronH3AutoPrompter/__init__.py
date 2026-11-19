# -*- coding: utf-8 -*-
"""🎬 Neron H3 AutoPrompter — Бланк: бланк промпта + автопромтер H3 в одной ноде.
Свой пакет: свой код LLM (папка llm/, порт 8767), ни от одной другой папки Neron не зависит.

EN: 🎬 Neron H3 AutoPrompter — Form: prompt form + H3 autoprompter in one node. Self-contained (own LLM code, port 8767)."""
from . import node

NODE_CLASS_MAPPINGS = dict(node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(node.NODE_DISPLAY_NAME_MAPPINGS)
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
