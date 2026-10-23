from .restore_studio import RestoreStudio
from .live_preview import LivePreview

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "RestoreStudio": RestoreStudio,
    "LivePreview": LivePreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RestoreStudio": "🎨 Restore Studio",
    "LivePreview": "🖥️ Live Preview",
}

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]