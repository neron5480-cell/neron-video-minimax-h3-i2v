# -*- coding: utf-8 -*-
"""🎬 Neron H3 One — единый движок MiniMax H3 / Neron's single MiniMax H3 engine.

Собран из проверенного в H3 Engine, H3 Story, Studio HD и H3 Studio. Ставится РЯДОМ со старыми пакетами:
свои имена нод, маршрутов и событий, общие модели и токен Hugging Face — ничего не перекачивается.
"""
from . import downloader, node

downloader.register_routes()

NODE_CLASS_MAPPINGS = {**node.NODE_CLASS_MAPPINGS}
NODE_DISPLAY_NAME_MAPPINGS = {**node.NODE_DISPLAY_NAME_MAPPINGS}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
