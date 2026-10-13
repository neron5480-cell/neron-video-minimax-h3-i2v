import os
import traceback


NODE_ROOT = os.path.dirname(os.path.abspath(__file__))

PROMPT_PATH = os.path.join(
    NODE_ROOT,
    "prompts",
    "H3_NSFW_Engine 1.txt",
)


NODE_CLASS_MAPPINGS = {}

NODE_DISPLAY_NAME_MAPPINGS = {}


# Smart Load & Resize Image
try:
    from .my_smart_load_image import MySmartLoadImage

    NODE_CLASS_MAPPINGS["SmartLoadAndResizeImage"] = MySmartLoadImage
    NODE_DISPLAY_NAME_MAPPINGS[
        "SmartLoadAndResizeImage"
    ] = "Smart Load & Resize Image"

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
    from .my_turbo_color_fix import MyTurboColorFix

    NODE_CLASS_MAPPINGS["TurboColorFixAdaIN"] = MyTurboColorFix
    NODE_DISPLAY_NAME_MAPPINGS[
        "TurboColorFixAdaIN"
    ] = "Manual Color & Upscale Panel"

    print("[H3 Nodes] Turbo Color Fix loaded successfully.")

except Exception:
    print("[H3 Nodes] ERROR loading Turbo Color Fix:")
    traceback.print_exc()


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "PROMPT_PATH",
]