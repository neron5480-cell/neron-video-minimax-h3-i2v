# -*- coding: utf-8 -*-
"""🎬 Neron LTX Engine — генератор LTX 2.5 одной нодой / LTX 2.5 generator in one node."""
from .node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import downloader

downloader.register_routes()

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
