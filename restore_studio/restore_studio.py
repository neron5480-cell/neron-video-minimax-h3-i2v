import hashlib
import json

from . import image_ops as ops


DESCRIPTION_TEXT = """🎨 Restore Studio — all-in-one photo restoration pipeline.

INPUTS:
• image — source image
• upscale_model (optional) — upscale model from UpscaleModelLoader

PIPELINE (applied in this order):
1. FACE RESTORE — restore faces via ReActor (CodeFormer / GFPGAN)
2. AUTO WB      — auto white balance
3. AUTO LEVELS  — auto levels (contrast stretch)
4. DENOISE      — noise reduction
5. DESPECKLE    — remove dots / scratches
6. COLORIZE     — colorize B&W (DDColor)
7. RGB TINT     — color tint
8. BRIGHTNESS / CONTRAST / SATURATION
9. SHARPNESS
10. UPSCALE     — via external model

PRESETS: Old B&W / Portrait / Landscape / Film / Vintage / Manual.

For small inputs (<1000 px), use progressive upscaling.
See README for details."""


class RestoreStudio:
    DESCRIPTION = DESCRIPTION_TEXT

    PRESETS = [
        "✋ Manual / Вручную",
        "📷 Old B&W Photo / Старое ч/б",
        "👤 Portrait / Портрет",
        "🏞 Landscape / Пейзаж",
        "🎞 Film Look / Кино",
        "📼 Vintage / Винтаж",
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "preset": (cls.PRESETS, {"default": "✋ Manual / Вручную"}),

                "FACE RESTORE / ЛИЦА": ("BOOLEAN", {"default": False}),
                "FACE STRENGTH / СИЛА ЛИЦ": ("FLOAT", {
                    "default": 0.5, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),
                "FACE SHARPEN / РЕЗКОСТЬ ЛИЦ": ("FLOAT", {
                    "default": 0.3, "min": 0.0, "max": 2.0, "step": 0.01,
                    "display": "slider",
                }),

                "AUTO WB / БАЛАНС БЕЛОГО": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),
                "AUTO LEVELS / УРОВНИ": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),
                "DENOISE / ШУМОДАВ": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),
                "DESPECKLE / ТОЧКИ": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),

                "COLORIZE / РАСКРАСКА": ("BOOLEAN", {"default": False}),
                "COLORIZE STRENGTH / СИЛА РАСКРАСКИ": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),

                "BRIGHTNESS / ЯРКОСТЬ": ("FLOAT", {
                    "default": 0.0, "min": -1.0, "max": 1.0, "step": 0.01,
                    "display": "slider",
                }),
                "CONTRAST / КОНТРАСТ": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 3.0, "step": 0.01,
                    "display": "slider",
                }),
                "SATURATION / НАСЫЩЕННОСТЬ": ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 3.0, "step": 0.01,
                    "display": "slider",
                }),
                "SHARPNESS / РЕЗКОСТЬ": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 3.0, "step": 0.01,
                    "display": "slider",
                }),

                "RGB RED / КРАСНЫЙ": ("FLOAT", {
                    "default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
                    "display": "slider",
                }),
                "RGB GREEN / ЗЕЛЁНЫЙ": ("FLOAT", {
                    "default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
                    "display": "slider",
                }),
                "RGB BLUE / СИНИЙ": ("FLOAT", {
                    "default": 1.0, "min": 0.5, "max": 1.5, "step": 0.01,
                    "display": "slider",
                }),

                "UPSCALE SCALE / МАСШТАБ": ("FLOAT", {
                    "default": 2.0, "min": 1.0, "max": 4.0, "step": 0.25,
                    "display": "slider",
                }),
                "UPSCALE SHARPEN / РЕЗКОСТЬ АПСКЕЙЛА": ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 2.0, "step": 0.01,
                    "display": "slider",
                }),
            },
            "optional": {
                "upscale_model": ("UPSCALE_MODEL",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "process"
    CATEGORY = "MyTools/Studio"

    def process(self, image, upscale_model=None, **kwargs):
        face_restore = kwargs.get("FACE RESTORE / ЛИЦА", False)
        face_restore_strength = float(kwargs.get("FACE STRENGTH / СИЛА ЛИЦ", 0.5))
        face_restore_sharpen = float(kwargs.get("FACE SHARPEN / РЕЗКОСТЬ ЛИЦ", 0.3))

        auto_wb = float(kwargs.get("AUTO WB / БАЛАНС БЕЛОГО", 0.0))
        auto_levels = float(kwargs.get("AUTO LEVELS / УРОВНИ", 0.0))
        denoise = float(kwargs.get("DENOISE / ШУМОДАВ", 0.0))
        despeckle = float(kwargs.get("DESPECKLE / ТОЧКИ", 0.0))

        colorize = kwargs.get("COLORIZE / РАСКРАСКА", False)
        colorize_strength = float(kwargs.get("COLORIZE STRENGTH / СИЛА РАСКРАСКИ", 1.0))

        brightness = float(kwargs.get("BRIGHTNESS / ЯРКОСТЬ", 0.0))
        contrast = float(kwargs.get("CONTRAST / КОНТРАСТ", 1.0))
        saturation = float(kwargs.get("SATURATION / НАСЫЩЕННОСТЬ", 1.0))
        sharpness = float(kwargs.get("SHARPNESS / РЕЗКОСТЬ", 0.0))

        rgb_r = float(kwargs.get("RGB RED / КРАСНЫЙ", 1.0))
        rgb_g = float(kwargs.get("RGB GREEN / ЗЕЛЁНЫЙ", 1.0))
        rgb_b = float(kwargs.get("RGB BLUE / СИНИЙ", 1.0))

        upscale_scale = float(kwargs.get("UPSCALE SCALE / МАСШТАБ", 2.0))
        upscale_sharpen = float(kwargs.get("UPSCALE SHARPEN / РЕЗКОСТЬ АПСКЕЙЛА", 0.0))

        if face_restore and ops.is_face_restore_available():
            try:
                print("[RestoreStudio] Running face restore...")
                image = ops.face_restore(image, face_restore_strength, face_restore_sharpen)
                print("[RestoreStudio] Face restore done.")
            except Exception as e:
                print(f"[RestoreStudio] Face restore failed: {e}")

        image = ops.auto_white_balance(image, auto_wb)
        image = ops.auto_levels(image, auto_levels)
        image = ops.denoise(image, denoise)
        image = ops.despeckle(image, despeckle)

        if colorize and ops.is_ddcolor_available():
            try:
                print("[RestoreStudio] Running DDColor colorize...")
                image = ops.colorize(image, colorize_strength)
                print("[RestoreStudio] Colorize done.")
            except Exception as e:
                print(f"[RestoreStudio] Colorize failed: {e}")

        image = ops.rgb_tint(image, rgb_r, rgb_g, rgb_b)
        image = ops.apply_color(image, brightness, contrast, saturation, sharpness)

        if upscale_model is not None:
            try:
                print("[RestoreStudio] Running upscale (model from input)...")
                image = ops.apply_upscale_model(
                    image, upscale_model,
                    target_scale=upscale_scale,
                    sharpen_after=upscale_sharpen,
                )
                print("[RestoreStudio] Upscale done.")
            except Exception as e:
                print(f"[RestoreStudio] Upscale failed: {e}")

        return (image,)

    @classmethod
    def IS_CHANGED(cls, image=None, preset=None, upscale_model=None, **kwargs):
        payload = {"preset": preset, "has_upscale_model": upscale_model is not None}
        for k, v in kwargs.items():
            try:
                payload[k] = v
            except Exception:
                payload[k] = str(v)

        try:
            blob = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            return hashlib.sha256(blob).hexdigest()
        except Exception as e:
            print(f"[RestoreStudio] IS_CHANGED error: {e}")
            return float("nan")


NODE_CLASS_MAPPINGS = {
    "RestoreStudio": RestoreStudio,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RestoreStudio": "🎨 Restore Studio",
}