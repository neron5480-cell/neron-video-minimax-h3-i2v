# -*- coding: utf-8 -*-
"""🎭 Neron H3 Замена героя / Hero Swap — тот же клип, другой человек (MiniMax H3 Ref2VA + SAM 3.1).
Свой пакет: ни от одной другой папки Neron не зависит."""
from . import downloader, node

downloader.register_routes()

NODE_CLASS_MAPPINGS = dict(node.NODE_CLASS_MAPPINGS)
NODE_DISPLAY_NAME_MAPPINGS = dict(node.NODE_DISPLAY_NAME_MAPPINGS)
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
