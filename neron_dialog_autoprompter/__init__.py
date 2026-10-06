from .dialog_node import NeronDialogAutoprompter
from .multi_llm import NeronMultiImageLLM

# Папка, откуда ComfyUI подтянет JS-расширение
WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "NeronDialogAutoprompter": NeronDialogAutoprompter,
    "NeronMultiImageLLM": NeronMultiImageLLM,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronDialogAutoprompter": "🎬 Neron Dialog Autoprompter",
    "NeronMultiImageLLM": "🧠 Neron Multi-Image LLM",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]