# -*- coding: utf-8 -*-
"""🎬 Neron LTX Engine — генератор LTX 2.5 одной нодой / LTX 2.5 generator in one node."""
from .node import NODE_CLASS_MAPPINGS as _ENGINE_NODES, NODE_DISPLAY_NAME_MAPPINGS as _ENGINE_NAMES
from . import downloader
from . import autoprompter  # noqa: F401  (свой код LLM — без соседних папок)
from .autoprompter.ltx_autoprompter import NeronLTXAutoPrompter

# 🎬 LTX AutoPrompter живёт рядом со своим движком (раньше — в Neron_Studio_H3/NeronStudio-AutoPrompter)
NODE_CLASS_MAPPINGS = dict(_ENGINE_NODES, NeronLTXAutoPrompter=NeronLTXAutoPrompter)
NODE_DISPLAY_NAME_MAPPINGS = dict(_ENGINE_NAMES, NeronLTXAutoPrompter="🎬 Neron LTX AutoPrompter / Автопромтер LTX")

downloader.register_routes()

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
