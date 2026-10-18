from .dialog_node import NeronDialogAutoprompter
from .multi_llm import NeronMultiImageLLM
from .autoprompter import NeronAutoPrompter

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "NeronDialogAutoprompter": NeronDialogAutoprompter,
    "NeronMultiImageLLM": NeronMultiImageLLM,
    "NeronAutoPrompter": NeronAutoPrompter,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronDialogAutoprompter": "🎬 Neron Dialog Autoprompter",
    "NeronMultiImageLLM": "🧠 Neron Multi-Image LLM",
    "NeronAutoPrompter": "🎬 Neron AutoPrompter",
}

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]