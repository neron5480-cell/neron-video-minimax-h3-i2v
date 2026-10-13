import torch
import torch.nn.functional as F

import numpy as np
from PIL import Image, ImageFilter

import comfy.utils
import comfy.model_management


def _to_pil(tensor):
    arr = (tensor[0].cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _from_pil(pil_img, ref_tensor):
    arr = np.array(pil_img.convert("RGB"), dtype=np.float32) / 255.0
    t = torch.from_numpy(arr).unsqueeze(0)
    return t.to(device=ref_tensor.device, dtype=ref_tensor.dtype)


def _curve(strength):
    return float(min(1.0, max(0.0, strength))) ** 0.5


def sharpen_tensor(image, amount):
    if amount <= 0.0:
        return image

    amount = float(min(3.0, max(0.0, amount)))
    frames = image.movedim(-1, 1).float()
    ch = frames.shape[1]

    k = torch.tensor([
        [1,  4,  6,  4, 1],
        [4, 16, 24, 16, 4],
        [6, 24, 36, 24, 6],
        [4, 16, 24, 16, 4],
        [1,  4,  6,  4, 1],
    ], dtype=frames.dtype, device=frames.device)
    k = k / k.sum()
    k = k.view(1, 1, 5, 5).repeat(ch, 1, 1, 1)

    padded = F.pad(frames, (2, 2, 2, 2), mode="reflect")
    blurred = F.conv2d(padded, k, groups=ch)
    sharpened = frames + (frames - blurred) * amount
    sharpened = sharpened.clamp(0.0, 1.0)
    return sharpened.movedim(1, -1).contiguous()


def denoise(image, strength):
    if strength <= 0.0:
        return image

    blend = _curve(strength)
    strength_raw = float(min(1.0, max(0.0, strength)))

    results = []
    for i in range(image.shape[0]):
        single = image[i:i+1]
        pil = _to_pil(single)
        filtered = pil.filter(ImageFilter.MedianFilter(size=3))
        if strength_raw > 0.6:
            filtered = filtered.filter(ImageFilter.MedianFilter(size=3))
        mixed = Image.blend(pil, filtered, blend)
        results.append(_from_pil(mixed, single))

    return torch.cat(results, dim=0)


def despeckle(image, strength):
    if strength <= 0.0:
        return image

    blend = _curve(strength)

    results = []
    for i in range(image.shape[0]):
        single = image[i:i+1]
        pil = _to_pil(single)
        filtered = pil.filter(ImageFilter.MedianFilter(size=5))
        mixed = Image.blend(pil, filtered, blend)
        results.append(_from_pil(mixed, single))

    return torch.cat(results, dim=0)


def auto_levels(image, strength):
    if strength <= 0.0:
        return image

    blend = _curve(strength)

    results = []
    for i in range(image.shape[0]):
        single = image[i:i+1]
        arr = (single[0].cpu().numpy() * 255.0)

        low = np.percentile(arr, 0.5)
        high = np.percentile(arr, 99.5)

        if high - low < 1.0:
            results.append(single)
            continue

        stretched = (arr - low) / (high - low)
        stretched = np.clip(stretched, 0, 1)

        original = arr / 255.0
        mixed = original * (1.0 - blend) + stretched * blend

        t = torch.from_numpy(mixed.astype(np.float32)).unsqueeze(0)
        t = t.to(device=single.device, dtype=single.dtype)
        results.append(t)

    return torch.cat(results, dim=0)


def auto_white_balance(image, strength):
    if strength <= 0.0:
        return image

    blend = _curve(strength)

    results = []
    for i in range(image.shape[0]):
        single = image[i:i+1]
        arr = single[0].cpu().numpy()

        avg_r = arr[..., 0].mean()
        avg_g = arr[..., 1].mean()
        avg_b = arr[..., 2].mean()

        avg_gray = (avg_r + avg_g + avg_b) / 3.0

        if avg_r < 1e-6 or avg_g < 1e-6 or avg_b < 1e-6:
            results.append(single)
            continue

        scale_r = avg_gray / avg_r
        scale_g = avg_gray / avg_g
        scale_b = avg_gray / avg_b

        scale_r = 1.0 + (scale_r - 1.0) * blend
        scale_g = 1.0 + (scale_g - 1.0) * blend
        scale_b = 1.0 + (scale_b - 1.0) * blend

        corrected = arr.copy()
        corrected[..., 0] = np.clip(corrected[..., 0] * scale_r, 0, 1)
        corrected[..., 1] = np.clip(corrected[..., 1] * scale_g, 0, 1)
        corrected[..., 2] = np.clip(corrected[..., 2] * scale_b, 0, 1)

        t = torch.from_numpy(corrected.astype(np.float32)).unsqueeze(0)
        t = t.to(device=single.device, dtype=single.dtype)
        results.append(t)

    return torch.cat(results, dim=0)


def apply_color(image, brightness, contrast, saturation, sharpness):
    frames = image.movedim(-1, 1).float()

    if brightness != 0.0:
        frames = frames + brightness

    if contrast != 1.0:
        mean = frames.mean(dim=(2, 3), keepdim=True)
        frames = (frames - mean) * contrast + mean

    if saturation != 1.0 and frames.shape[1] >= 3:
        gray = (
            frames[:, 0:1] * 0.299 +
            frames[:, 1:2] * 0.587 +
            frames[:, 2:3] * 0.114
        )
        rgb = frames[:, :3]
        rgb = gray + (rgb - gray) * saturation
        if frames.shape[1] > 3:
            frames = torch.cat((rgb, frames[:, 3:]), dim=1)
        else:
            frames = rgb

    if sharpness > 0.0 and frames.shape[1] >= 3:
        ch = frames.shape[1]
        kernel = torch.full(
            (ch, 1, 3, 3), 1.0 / 9.0,
            device=frames.device, dtype=frames.dtype,
        )
        padded = F.pad(frames, (1, 1, 1, 1), mode="reflect")
        blurred = F.conv2d(padded, kernel, groups=ch)
        frames = frames + (frames - blurred) * sharpness

    frames = frames.clamp(0.0, 1.0)
    return frames.movedim(1, -1).contiguous()


def rgb_tint(image, r, g, b):
    frames = image.clone().float()
    if frames.shape[-1] >= 3:
        frames[..., 0] *= r
        frames[..., 1] *= g
        frames[..., 2] *= b
    return frames.clamp(0.0, 1.0)


_PARAM_GOOD_VALUES = {
    "model": ["codeformer", "gfpgan", "RestoreFormer"],
    "facedetection": ["retinaface_resnet50", "retinaface_mobile0.25"],
}

_STRENGTH_KEYS = (
    "strength", "intensity", "alpha", "blend",
    "visibility", "codeformer_weight", "fidelity",
)


def _pick_good_value(choices, param_name):
    if not isinstance(choices, list) or not choices:
        return None

    lname = param_name.lower()

    for keyword, priorities in _PARAM_GOOD_VALUES.items():
        if keyword in lname:
            for pref in priorities:
                for c in choices:
                    if pref.lower() in str(c).lower():
                        return c

    bad_tokens = ("none", "disabled", "off", "нет", "не выбрано")
    for c in choices:
        c_low = str(c).lower()
        if any(b in c_low for b in bad_tokens):
            continue
        return c

    return choices[0]


def _auto_value_for_spec(spec, param_name):
    if not isinstance(spec, (list, tuple)) or len(spec) == 0:
        return None

    type_or_list = spec[0]
    options = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}

    if isinstance(type_or_list, list):
        return _pick_good_value(type_or_list, param_name)

    type_str = str(type_or_list).upper()
    default = options.get("default", None)

    if type_str in ("INT", "FLOAT"):
        if default is not None:
            return default
        if "size" in param_name.lower():
            return 512
        return 0

    if type_str == "BOOLEAN":
        if default is not None:
            return default
        return False

    if type_str == "STRING":
        if default is not None:
            return default
        return ""

    return None


def _build_kwargs(cls, image, strength):
    inputs = cls.INPUT_TYPES()
    required = inputs.get("required", {})
    optional = inputs.get("optional", {})

    kwargs = {"image": image}
    log_used = []

    for param_name, spec in required.items():
        if param_name == "image":
            continue
        if param_name in _STRENGTH_KEYS:
            kwargs[param_name] = float(strength)
            log_used.append(f"{param_name}=strength")
            continue
        val = _auto_value_for_spec(spec, param_name)
        if val is not None:
            kwargs[param_name] = val
            log_used.append(f"{param_name}={val!r}")

    for param_name, spec in optional.items():
        if param_name in kwargs:
            continue
        if not isinstance(spec, (list, tuple)) or len(spec) == 0:
            continue
        if "default" in (spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}):
            val = _auto_value_for_spec(spec, param_name)
            if val is not None:
                kwargs[param_name] = val
                log_used.append(f"{param_name}={val!r} (opt)")

    print(f"[RestoreStudio] Auto-filled kwargs: {log_used}")
    return kwargs


def _apply_result(image, result, strength):
    if isinstance(result, tuple):
        result = result[0]
    if not torch.is_tensor(result):
        raise RuntimeError(f"Node returned non-tensor: {type(result)}")

    if result.shape[1:3] != image.shape[1:3]:
        result = F.interpolate(
            result.movedim(-1, 1),
            size=image.shape[1:3],
            mode="bilinear",
            align_corners=False,
        ).movedim(1, -1)

    result = result.to(device=image.device, dtype=image.dtype)
    s = float(max(0.0, min(1.0, strength)))
    return (image * (1.0 - s) + result * s).clamp(0.0, 1.0)


def _ensure_prompt_server_ready():
    try:
        from server import PromptServer
        if not hasattr(PromptServer.instance, "last_prompt_id"):
            PromptServer.instance.last_prompt_id = "restore_studio_direct"
        elif PromptServer.instance.last_prompt_id is None:
            PromptServer.instance.last_prompt_id = "restore_studio_direct"
    except Exception as e:
        print(f"[RestoreStudio] Cannot patch PromptServer: {e}")


_COLORIZE_KEYWORDS = (
    "ddcolor", "colorize", "colourize", "colorizer",
    "deoldify", "colorization", "recolor",
)

_colorize_cache = None


def _discover_colorize_nodes():
    global _colorize_cache
    if _colorize_cache is not None:
        return _colorize_cache

    result = {"colorizers": []}
    try:
        import nodes
    except Exception as e:
        print(f"[RestoreStudio] Cannot import nodes: {e}")
        _colorize_cache = result
        return result

    all_names = list(nodes.NODE_CLASS_MAPPINGS.keys())
    matching = [n for n in all_names if any(k in n.lower() for k in _COLORIZE_KEYWORDS)]
    print(f"[RestoreStudio] Nodes matching colorize keywords: {matching}")

    for name in matching:
        cls = nodes.NODE_CLASS_MAPPINGS[name]
        try:
            inputs = cls.INPUT_TYPES()
        except Exception:
            continue
        required = inputs.get("required", {})
        optional = inputs.get("optional", {})
        all_inputs = {**required, **optional}
        if "image" in all_inputs:
            result["colorizers"].append((name, cls))

    print(f"[RestoreStudio] Colorizers: {[n for n, _ in result['colorizers']]}")
    _colorize_cache = result
    return result


def is_ddcolor_available():
    return bool(_discover_colorize_nodes()["colorizers"])


def colorize(image, strength=1.0):
    discovery = _discover_colorize_nodes()
    colorizers = discovery["colorizers"]

    if not colorizers:
        raise RuntimeError("No colorize node found.")

    last_error = None
    for cname, ccls in colorizers:
        try:
            inst = ccls()
            func_name = getattr(ccls, "FUNCTION", "inference")
            func = getattr(inst, func_name)
            kwargs = _build_kwargs(ccls, image, strength)

            print(f"[RestoreStudio] Calling {cname}.{func_name} ...")
            result = func(**kwargs)

            applied = _apply_result(image, result, strength)
            print(f"[RestoreStudio] Colorize via {cname} succeeded")
            return applied
        except Exception as e:
            last_error = e
            print(f"[RestoreStudio] Colorizer {cname} failed: {e}")
            continue

    raise RuntimeError(f"All colorize attempts failed. Last error: {last_error}")


_FACE_RESTORE_KEYWORDS = (
    "restoreface", "face_restore", "face-restore",
    "facerestore", "codeformer", "gfpgan", "gfp_gan",
)

_face_cache = None


def _discover_face_restore_nodes():
    global _face_cache
    if _face_cache is not None:
        return _face_cache

    result = {"restorers": []}
    try:
        import nodes
    except Exception as e:
        print(f"[RestoreStudio] Cannot import nodes: {e}")
        _face_cache = result
        return result

    all_names = list(nodes.NODE_CLASS_MAPPINGS.keys())
    matching = [n for n in all_names if any(k in n.lower() for k in _FACE_RESTORE_KEYWORDS)]
    print(f"[RestoreStudio] Nodes matching face restore keywords: {matching}")

    for name in matching:
        cls = nodes.NODE_CLASS_MAPPINGS[name]
        try:
            inputs = cls.INPUT_TYPES()
        except Exception:
            continue
        required = inputs.get("required", {})
        optional = inputs.get("optional", {})
        all_inputs = {**required, **optional}
        if "image" in all_inputs:
            result["restorers"].append((name, cls))

    print(f"[RestoreStudio] Face restorers: {[n for n, _ in result['restorers']]}")
    _face_cache = result
    return result


def is_face_restore_available():
    return bool(_discover_face_restore_nodes()["restorers"])


def face_restore_raw(image, strength=0.5):
    discovery = _discover_face_restore_nodes()
    restorers = discovery["restorers"]

    if not restorers:
        raise RuntimeError("No face restore node found.")

    _ensure_prompt_server_ready()

    last_error = None
    for cname, ccls in restorers:
        try:
            inst = ccls()
            func_name = getattr(ccls, "FUNCTION", "restore_face")
            func = getattr(inst, func_name)
            kwargs = _build_kwargs(ccls, image, strength)

            print(f"[RestoreStudio] Calling {cname}.{func_name} ...")
            result = func(**kwargs)

            applied = _apply_result(image, result, 1.0)
            print(f"[RestoreStudio] Face restore via {cname} succeeded")
            return applied
        except Exception as e:
            last_error = e
            print(f"[RestoreStudio] Face restorer {cname} failed: {e}")
            continue

    raise RuntimeError(f"All face restore attempts failed. Last error: {last_error}")


def face_restore(image, strength=0.5, sharpen=0.3):
    restored = face_restore_raw(image, strength=strength)
    if sharpen > 0.0:
        restored = sharpen_tensor(restored, sharpen)
    return restored


# ============================================================
# UPSCALE
# ============================================================
def apply_upscale_model(image, upscale_model, target_scale=2.0, sharpen_after=0.0):
    """Применяет модель апскейла, загружая её в VRAM через ComfyUI."""
    if upscale_model is None:
        raise RuntimeError("No upscale model.")

    device = comfy.model_management.get_torch_device()

    # Просим ComfyUI загрузить модель в VRAM (внутри patcher).
    patcher = getattr(upscale_model, "patcher", None)
    if patcher is not None:
        try:
            comfy.model_management.load_models_gpu(
                [patcher],
                memory_required=0,
                force_full_load=True,
            )
            print("[RestoreStudio] Upscale model pushed to VRAM.")
        except Exception as e:
            print(f"[RestoreStudio] load_models_gpu failed: {e}")

    model_scale = float(getattr(upscale_model, "scale", 4.0))
    print(f"[RestoreStudio] Upscale native scale: {model_scale}")

    prescale = 1.0
    if target_scale < model_scale:
        prescale = target_scale / model_scale

    frames = image.movedim(-1, 1).float()

    if prescale < 1.0:
        new_h = max(1, int(round(frames.shape[2] * prescale)))
        new_w = max(1, int(round(frames.shape[3] * prescale)))
        frames = F.interpolate(
            frames, size=(new_h, new_w),
            mode="bicubic", align_corners=False, antialias=True,
        )

    # Определяем, на каком устройстве сама модель.
    # Если у модели есть .model, смотрим его параметры.
    inner = getattr(upscale_model, "model", None)
    if inner is not None:
        try:
            inner_device = next(inner.parameters()).device
            print(f"[RestoreStudio] Upscale inner device: {inner_device}")
        except Exception:
            inner_device = None
    else:
        inner_device = None

    # Если модель на CPU — работаем на CPU.
    # Если на GPU — работаем на GPU.
    if inner_device is not None and inner_device.type == "cpu":
        work_device = torch.device("cpu")
        print("[RestoreStudio] Running upscale on CPU (model on CPU).")
    else:
        work_device = device
        print("[RestoreStudio] Running upscale on GPU.")

    frames = frames.to(work_device)

    tile = 512
    overlap = 32

    def run(x):
        if x.ndim == 3:
            x = x.unsqueeze(0)
        return upscale_model(x)

    while True:
        try:
            print(f"[RestoreStudio] Upscale tile={tile}, device={work_device}")
            steps = (
                frames.shape[0]
                * comfy.utils.get_tiled_scale_steps(
                    frames.shape[3], frames.shape[2],
                    tile_x=tile, tile_y=tile, overlap=overlap,
                )
            )
            pbar = comfy.utils.ProgressBar(steps)
            upscaled = comfy.utils.tiled_scale(
                frames, run,
                tile_x=tile, tile_y=tile, overlap=overlap,
                upscale_amount=model_scale,
                pbar=pbar,
                output_device=work_device,
            )
            break
        except Exception as e:
            oom_cls = getattr(comfy.model_management, "OOM_EXCEPTION", torch.cuda.OutOfMemoryError)
            if not isinstance(e, (oom_cls, torch.cuda.OutOfMemoryError)):
                raise
            comfy.model_management.soft_empty_cache()
            tile //= 2
            if tile < 128:
                raise
            print(f"[RestoreStudio] OOM. Retry tile={tile}")

    upscaled = upscaled.clamp(0.0, 1.0).movedim(1, -1).contiguous()

    orig_h = image.shape[1]
    orig_w = image.shape[2]
    target_h = max(1, int(round(orig_h * target_scale)))
    target_w = max(1, int(round(orig_w * target_scale)))

    if upscaled.shape[1] != target_h or upscaled.shape[2] != target_w:
        upscaled = F.interpolate(
            upscaled.movedim(-1, 1),
            size=(target_h, target_w),
            mode="bicubic", align_corners=False, antialias=True,
        ).movedim(1, -1).contiguous().clamp(0.0, 1.0)

    if sharpen_after > 0.0:
        upscaled = sharpen_tensor(upscaled, sharpen_after)

    return upscaled


def list_upscale_models():
    return []