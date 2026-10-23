import os
import io

import numpy as np
import torch
from PIL import Image

import folder_paths

from . import image_ops as ops


_IMAGE_CACHE = {}
_MAX_CACHE = 5

_FACE_RAW_CACHE = {}
_COLORIZE_CACHE = {}


def _load_cached(path):
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        mtime = 0
    key = (path, mtime)

    cached = _IMAGE_CACHE.get(key)
    if cached is not None:
        return cached, mtime

    img = Image.open(path).convert("RGB")
    arr = np.array(img, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(arr).unsqueeze(0)

    if len(_IMAGE_CACHE) >= _MAX_CACHE:
        _IMAGE_CACHE.clear()
    _IMAGE_CACHE[key] = tensor
    return tensor, mtime


def _get_face_raw(path, mtime, tensor, strength):
    key = (path, mtime, round(float(strength), 3))
    cached = _FACE_RAW_CACHE.get(key)
    if cached is not None:
        return cached

    restored = ops.face_restore_raw(tensor, strength=strength)
    _FACE_RAW_CACHE.clear()
    _FACE_RAW_CACHE[key] = restored
    return restored


def _get_colorized(path, mtime, tensor, clean_hash):
    key = (path, mtime, clean_hash)
    cached = _COLORIZE_CACHE.get(key)
    if cached is not None:
        return cached

    colored = ops.colorize(tensor, 1.0)
    _COLORIZE_CACHE.clear()
    _COLORIZE_CACHE[key] = colored
    return colored


class LivePreview:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "max_size": ("INT", {
                    "default": 1024, "min": 256, "max": 4096, "step": 64,
                    "display": "slider",
                }),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "preview"
    CATEGORY = "MyTools/Studio"

    def preview(self, image, max_size=1024):
        return (image,)


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/restore_studio/preview")
    async def restore_preview(request):
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "bad json"}, status=400)

        filename = data.get("filename", "")
        settings = data.get("settings", {})

        if not filename:
            return web.json_response({"error": "no filename"}, status=400)

        path = None
        for base in (
            folder_paths.get_input_directory(),
            folder_paths.get_output_directory(),
            folder_paths.get_temp_directory(),
        ):
            candidate = os.path.join(base, filename)
            if os.path.exists(candidate):
                path = candidate
                break

        if path is None:
            return web.json_response({"error": f"not found: {filename}"}, status=404)

        try:
            tensor, mtime = _load_cached(path)

            if settings.get("face_restore", False):
                if ops.is_face_restore_available():
                    try:
                        strength = float(settings.get("face_restore_strength", 0.5))
                        sharpen = float(settings.get("face_restore_sharpen", 0.3))
                        tensor = _get_face_raw(path, mtime, tensor, strength)
                        if sharpen > 0.0:
                            tensor = ops.sharpen_tensor(tensor, sharpen)
                    except Exception as e:
                        print(f"[LivePreview] Face restore failed: {e}")

            auto_wb = float(settings.get("auto_wb", 0.0))
            auto_levels = float(settings.get("auto_levels", 0.0))
            denoise = float(settings.get("denoise", 0.0))
            despeckle = float(settings.get("despeckle", 0.0))

            tensor = ops.auto_white_balance(tensor, auto_wb)
            tensor = ops.auto_levels(tensor, auto_levels)
            tensor = ops.denoise(tensor, denoise)
            tensor = ops.despeckle(tensor, despeckle)

            if settings.get("colorize", False):
                if ops.is_ddcolor_available():
                    try:
                        clean_hash = f"{auto_wb:.3f}|{auto_levels:.3f}|{denoise:.3f}|{despeckle:.3f}"
                        full_color = _get_colorized(path, mtime, tensor, clean_hash)
                        strength = float(settings.get("colorize_strength", 1.0))
                        strength = max(0.0, min(1.0, strength))
                        tensor = tensor * (1.0 - strength) + full_color * strength
                    except Exception as e:
                        print(f"[LivePreview] Colorize failed: {e}")

            tensor = ops.rgb_tint(
                tensor,
                float(settings.get("rgb_r", 1.0)),
                float(settings.get("rgb_g", 1.0)),
                float(settings.get("rgb_b", 1.0)),
            )

            tensor = ops.apply_color(
                tensor,
                float(settings.get("brightness", 0.0)),
                float(settings.get("contrast", 1.0)),
                float(settings.get("saturation", 1.0)),
                float(settings.get("sharpness", 0.0)),
            )

            max_size = int(settings.get("max_size", 1024))
            h, w = tensor.shape[1], tensor.shape[2]

            out_np = (tensor[0].cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
            out_img = Image.fromarray(out_np)

            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                new_h = max(1, int(h * scale))
                new_w = max(1, int(w * scale))
                out_img = out_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            out_img.save(buf, format="JPEG", quality=85)

            return web.Response(
                body=buf.getvalue(),
                content_type="image/jpeg",
                headers={"Cache-Control": "no-store"},
            )

        except Exception as e:
            print(f"[LivePreview] error: {e}")
            return web.json_response({"error": str(e)}, status=500)

    print("[LivePreview] Endpoint registered")

except Exception as e:
    print(f"[LivePreview] Failed to register endpoint: {e}")


NODE_CLASS_MAPPINGS = {
    "LivePreview": LivePreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LivePreview": "🖥️ Live Preview",
}