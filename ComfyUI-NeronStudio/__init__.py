# -*- coding: utf-8 -*-
"""🖥 Neron Studio — рабочий стол Neron внутри ComfyUI (прототип).

Нод не добавляет. Даёт страницу /neron_studio и кнопку на холсте ComfyUI (монета «N» слева внизу,
а также пункт меню Neron → Neron Studio), которая открывает стол поверх ComfyUI.
Только официальные пути ComfyUI: маршрут сервера и web-расширение.
"""
import logging
import os

log = logging.getLogger("Neron.Studio")
_HERE = os.path.dirname(os.path.abspath(__file__))
_STATIC = os.path.join(_HERE, "static")


def _register():
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return
    srv = PromptServer.instance
    if getattr(srv, "_neron_studio_routes", False):
        return
    srv._neron_studio_routes = True

    @srv.routes.get("/neron_studio")
    async def _page(request):
        return web.FileResponse(os.path.join(_STATIC, "index.html"),
                                headers={"Cache-Control": "no-cache"})

    log.info("[Neron Studio] стол: /neron_studio / desktop at /neron_studio")


_register()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
