import os
import traceback


NODE_ROOT = os.path.dirname(os.path.abspath(__file__))

# Системный промпт H3 — одна копия в NeronStudio-AutoPrompter/prompts (None, если папки нет).
# The H3 system prompt — one copy in NeronStudio-AutoPrompter/prompts (None if missing).
try:
    from ._neron_shared import shared_prompts_dir as _spd

    _PROMPTS = _spd()
    PROMPT_PATH = os.path.join(_PROMPTS, "H3_NSFW_Engine 1.txt") if _PROMPTS else None
except Exception:
    PROMPT_PATH = None


NODE_CLASS_MAPPINGS = {}

NODE_DISPLAY_NAME_MAPPINGS = {}


# Smart Load & Resize Image
try:
    from ._neron_shared import load as _core

    MySmartLoadImage = _core("loader").MySmartLoadImage

    NODE_CLASS_MAPPINGS["SmartLoadAndResizeImage"] = MySmartLoadImage
    NODE_DISPLAY_NAME_MAPPINGS[
        "SmartLoadAndResizeImage"
    ] = "Smart Load & Resize Image (legacy → Interactive Image Processor)"

    print("[H3 Nodes] Smart Load loaded successfully.")

except Exception:
    print("[H3 Nodes] ERROR loading Smart Load:")
    traceback.print_exc()


# Fixed Camera H3
try:
    from .h3_static_camera import MyH3StaticCamera

    NODE_CLASS_MAPPINGS["FixedCameraH3Presets"] = MyH3StaticCamera
    NODE_DISPLAY_NAME_MAPPINGS[
        "FixedCameraH3Presets"
    ] = "Fixed Camera H3 Presets"

    print("[H3 Nodes] Fixed Camera loaded successfully.")

except Exception:
    print("[H3 Nodes] ERROR loading Fixed Camera:")
    traceback.print_exc()


# Turbo Color Fix
# Ошибка этой ноды больше не блокирует остальные ноды.
try:
    from ._neron_shared import load as _core

    MyTurboColorFix = _core("color").MyTurboColorFix

    NODE_CLASS_MAPPINGS["TurboColorFixAdaIN"] = MyTurboColorFix
    NODE_DISPLAY_NAME_MAPPINGS[
        "TurboColorFixAdaIN"
    ] = "Manual Color & Upscale Panel (legacy → Interactive Image Processor)"

    print("[H3 Nodes] Turbo Color Fix loaded successfully.")

except Exception:
    print("[H3 Nodes] ERROR loading Turbo Color Fix:")
    traceback.print_exc()


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "PROMPT_PATH",
]