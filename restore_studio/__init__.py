from .restore_studio import RestoreStudio
from .live_preview import LivePreview
from .color_upscale import MyTurboColorFix  # своя копия (была в Interactive Processor) — процесс Restore Studio не зависит от соседей

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "RestoreStudio": RestoreStudio,
    "LivePreview": LivePreview,
    "TurboColorFixAdaIN": MyTurboColorFix,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RestoreStudio": "🎨 Restore Studio",
    "LivePreview": "🖥️ Live Preview",
    "TurboColorFixAdaIN": "Manual Color & Upscale Panel",
}

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]