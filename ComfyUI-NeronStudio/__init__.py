# -*- coding: utf-8 -*-
"""🖥 Neron Studio — рабочий стол Neron внутри ComfyUI.

Нод не добавляет. Даёт страницу /neron_studio, кнопку-монету «N» на холсте и пункт меню Neron → Neron Studio.
«Открыть» на плитке загружает НАСТОЯЩИЙ процесс Neron в ComfyUI (новой вкладкой) — процессы берутся из
установленных пакетов Neron (из каталога ComfyUI или ручной установки), ничего не скачивается.
Только официальные пути ComfyUI: маршруты сервера и web-расширение.
"""
import logging
import os

log = logging.getLogger("Neron.Studio")
_HERE = os.path.dirname(os.path.abspath(__file__))
_STATIC = os.path.join(_HERE, "static")

# плитка → процессы Neron по порядку предпочтения (путь внутри пакета Neron)
_ONE = "ComfyUI-NeronH3One/workflows/Neron_H3_One.json"
_STORY = "ComfyUI-NeronH3Story/workflows/Neron_H3_Story_AutoPrompter.json"
_RESTORE = "workflow/Neron_Restore_Studio_Photoshop.json"
WORKFLOWS = {
    "one": [_ONE, "Neron_Studio_H3/Neron_H3_Full_Pipeline.json"],
    "timing": [_ONE, "Neron_Studio_H3/Neron_H3_Full_Pipeline.json"],
    "models": [_ONE, _STORY],
    "story": [_STORY, "ComfyUI-NeronH3Story/workflows/Neron_H3_Story.json"],
    "swap": ["ComfyUI-NeronH3One/workflows/Neron_H3_Swap.json"],
    "ltx": ["ComfyUI-NeronLTXEngine/workflows/Neron_LTX_AutoPrompter.json",
            "ComfyUI-NeronLTXEngine/workflows/Neron_LTX_Engine.json"],
    "clarity": ["ComfyUI-PerceptionRelay/workflows/perception_relay_pult.json",
                "ComfyUI-PerceptionRelay/workflows/perception_relay_basic.json"],
    "audio": ["NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json"],
    "restore": [_RESTORE],
    "outpaint": ["workflow/Neron_Flux_Fill_PreProcessor.json", _RESTORE],   # свой процесс: фото → широкий кадр
    "upscale": [_RESTORE],
}


def _roots():
    roots = [os.path.dirname(_HERE)]
    try:
        import folder_paths
        for d in folder_paths.get_folder_paths("custom_nodes"):
            d = os.path.abspath(d)
            if d not in roots:
                roots.append(d)
    except Exception:
        pass
    return roots


def find_workflow(tid):
    """Путь к процессу плитки: пакет Neron целиком (custom_nodes/<пакет>/…) или папка ноды отдельно."""
    for rel in WORKFLOWS.get(tid, []):
        parts = rel.split("/")
        for root in _roots():
            cand = [os.path.join(root, *parts)]                      # папка ноды отдельно: custom_nodes/<папка>/…
            try:
                for child in sorted(os.listdir(root)):               # пакет Neron целиком: custom_nodes/<пакет>/<папка>/…
                    p = os.path.join(root, child)
                    if os.path.isdir(p):
                        cand.append(os.path.join(p, *parts))
            except Exception:
                pass
            for c in cand:
                if os.path.isfile(c):
                    return c
    return None


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
        return web.FileResponse(os.path.join(_STATIC, "index.html"), headers={"Cache-Control": "no-cache"})

    @srv.routes.get("/neron_studio/available")
    async def _available(request):
        return web.json_response({tid: bool(find_workflow(tid)) for tid in WORKFLOWS})

    @srv.routes.get("/neron_studio/workflow/{tid}")
    async def _workflow(request):
        tid = request.match_info.get("tid", "")
        path = find_workflow(tid)
        if not path:
            return web.json_response({"error": "not_installed"}, status=404)
        return web.FileResponse(path, headers={"Cache-Control": "no-cache",
                                               "X-Neron-Workflow": os.path.basename(path)})

    log.info("[Neron Studio] стол: /neron_studio / desktop at /neron_studio")


_register()

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
