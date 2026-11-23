"""RU: Neron H3 Engine — отдельный самостоятельный процесс.
EN: Neron H3 Engine - a standalone process.
"""

from .h3_catalog import register_shared_paths

register_shared_paths()

from .node import NeronH3Extension, NeronH3EngineNode, comfy_entrypoint

WEB_DIRECTORY = "./web"
__all__ = ["WEB_DIRECTORY", "comfy_entrypoint", "NeronH3Extension", "NeronH3EngineNode"]
