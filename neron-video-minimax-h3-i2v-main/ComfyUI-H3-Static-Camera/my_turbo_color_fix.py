import logging
import time

import torch
import torch.nn.functional as F

import comfy.model_management
import comfy.utils

OOM_EXC = getattr(
    comfy.model_management,
    "OOM_EXCEPTION",
    torch.cuda.OutOfMemoryError,
)


def _is_oom(error):
    return isinstance(error, (OOM_EXC, torch.cuda.OutOfMemoryError))


class MyTurboColorFix:
    """
    Цветокоррекция изображения и опциональный AI-апскейл.

    Кадры обрабатываются ПОРЦИЯМИ (chunks), а не всем батчем сразу,
    поэтому видеопамять не переполняется на длинных видео.
    Готовые кадры сразу уходят в ОЗУ.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "BRIGHTNESS / ЯРКОСТЬ": (
                    "FLOAT",
                    {"default": 0.0, "min": -1.0, "max": 1.0,
                     "step": 0.05, "display": "slider"},
                ),
                "CONTRAST / КОНТРАСТ": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 3.0,
                     "step": 0.05, "display": "slider"},
                ),
                "SATURATION / НАСЫЩЕННОСТЬ": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 3.0,
                     "step": 0.05, "display": "slider"},
                ),
                "SHARPNESS / РЕЗКОСТЬ": (
                    "FLOAT",
                    {"default": 0.0, "min": 0.0, "max": 3.0,
                     "step": 0.05, "display": "slider"},
                ),
                "upscale": (
                    ["Disabled / Откл", "Enabled / Вкл"],
                    {"default": "Disabled / Откл"},
                ),
                "upscale_scale": (
                    "FLOAT",
                    {"default": 2.0, "min": 1.0, "max": 4.0,
                     "step": 0.25, "display": "slider"},
                ),
                "upscale_precision": (
                    ["Fast fp16 / Быстро", "Precise fp32 / Точно"],
                    {"default": "Fast fp16 / Быстро"},
                ),
                "upscale_speed": (
                    ["Quality / Качество", "Fast / Быстро"],
                    {"default": "Quality / Качество"},
                ),
            },
            "optional": {
                "upscale_model": ("UPSCALE_MODEL",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("IMAGE",)
    FUNCTION = "apply_manual_color"
    CATEGORY = "AIVideoPostprocessing"

    # ------------------------------------------------------------------
    # Цветокоррекция одной порции кадров (на GPU)
    # ------------------------------------------------------------------
    @staticmethod
    def _apply_color_correction(
        chunk, brightness, contrast, saturation, sharpness, device
    ):
        # BHWC -> BCHW, float32, на GPU (это новая копия, дальше можно in-place)
        frames = chunk.to(device=device, dtype=torch.float32)
        frames = frames.movedim(-1, 1).contiguous()

        alpha = None
        if frames.shape[1] == 4:
            alpha = frames[:, 3:4]
            rgb = frames[:, :3]
        else:
            rgb = frames

        if brightness != 0.0:
            rgb = rgb + brightness

        if contrast != 1.0:
            mean_value = rgb.mean(dim=(2, 3), keepdim=True)
            rgb = (rgb - mean_value) * contrast + mean_value

        if saturation != 1.0 and rgb.shape[1] >= 3:
            gray = (
                rgb[:, 0:1] * 0.299
                + rgb[:, 1:2] * 0.587
                + rgb[:, 2:3] * 0.114
            )
            rgb = gray + (rgb - gray) * saturation

        if sharpness > 0.0:
            ch = rgb.shape[1]
            kernel = torch.full(
                (ch, 1, 3, 3), 1.0 / 9.0,
                device=rgb.device, dtype=rgb.dtype,
            )
            # reflect-паддинг, чтобы не темнели края кадра
            padded = F.pad(rgb, (1, 1, 1, 1), mode="reflect")
            blurred = F.conv2d(padded, kernel, groups=ch)
            rgb = rgb + (rgb - blurred) * sharpness

        rgb = rgb.clamp(0.0, 1.0)

        if alpha is not None:
            rgb = torch.cat((rgb, alpha.clamp(0.0, 1.0)), dim=1)

        return rgb.movedim(1, -1).contiguous()

    # ------------------------------------------------------------------
    # AI-апскейл одной порции кадров (на GPU)
    # ------------------------------------------------------------------
    @staticmethod
    def _run_upscale_model(image, upscale_model, tile_state, fp16=True):
        device = upscale_model.patcher.load_device

        alpha = None
        if image.shape[-1] == 4:
            alpha = image[..., 3:4]
            rgb_image = image[..., :3]
        else:
            rgb_image = image

        input_tensor = (
            rgb_image.movedim(-1, 1)
            .to(device=device, dtype=torch.float32)
            .contiguous()
        )

        # размер тайла запоминается между порциями, чтобы не
        # повторять неудачные попытки с 512 на каждой порции
        tile_size = tile_state["size"]
        overlap = 32

        use_fp16 = bool(fp16) and device.type == "cuda"

        def run_tile(tile):
            with torch.autocast(
                device_type=device.type,
                dtype=torch.float16,
                enabled=use_fp16,
            ):
                out = upscale_model(tile.float())
            return out.float()

        while True:
            try:
                steps = (
                    input_tensor.shape[0]
                    * comfy.utils.get_tiled_scale_steps(
                        input_tensor.shape[3],
                        input_tensor.shape[2],
                        tile_x=tile_size,
                        tile_y=tile_size,
                        overlap=overlap,
                    )
                )
                pbar = comfy.utils.ProgressBar(steps)

                # output_device=device: результат остаётся на GPU,
                # дальше ресайз тоже на GPU (быстро)
                upscaled = comfy.utils.tiled_scale(
                    input_tensor,
                    run_tile,
                    tile_x=tile_size,
                    tile_y=tile_size,
                    overlap=overlap,
                    upscale_amount=upscale_model.scale,
                    pbar=pbar,
                    output_device=device,
                )
                break

            except Exception as error:
                if not _is_oom(error):
                    raise
                comfy.model_management.soft_empty_cache()
                tile_size //= 2
                tile_state["size"] = max(tile_size, 128)
                if tile_size < 128:
                    raise
                logging.warning(
                    "[Turbo Color Fix] Not enough VRAM. "
                    "Retrying with tile size %s.", tile_size,
                )

        upscaled = upscaled.clamp(0.0, 1.0).movedim(1, -1).contiguous()

        if alpha is not None:
            alpha_bchw = alpha.movedim(-1, 1).to(
                device=upscaled.device, dtype=upscaled.dtype
            )
            alpha_bchw = comfy.utils.common_upscale(
                alpha_bchw,
                upscaled.shape[2],
                upscaled.shape[1],
                "bilinear",
                "disabled",
            )
            upscaled = torch.cat(
                (upscaled, alpha_bchw.movedim(1, -1)), dim=-1
            )

        return upscaled

    # ------------------------------------------------------------------
    # Приведение к нужному масштабу (модель может делать 4x, а нужно 2x)
    # ------------------------------------------------------------------
    @staticmethod
    def _prescale(image, factor):
        """
        Уменьшает кадры ПЕРЕД моделью, чтобы модель 4x не считала
        лишнее, когда нужен, например, только 1.8x.
        """
        h = max(1, round(image.shape[1] * factor))
        w = max(1, round(image.shape[2] * factor))
        resized = F.interpolate(
            image.movedim(-1, 1),
            size=(h, w),
            mode="bicubic",
            align_corners=False,
            antialias=True,
        )
        return resized.movedim(1, -1).contiguous().clamp(0.0, 1.0)

    @staticmethod
    def _resize_to_requested_scale(
        image, original_width, original_height, requested_scale
    ):
        target_w = max(1, round(original_width * requested_scale))
        target_h = max(1, round(original_height * requested_scale))

        if image.shape[2] == target_w and image.shape[1] == target_h:
            return image

        resized = F.interpolate(
            image.movedim(-1, 1),
            size=(target_h, target_w),
            mode="bicubic",
            align_corners=False,
            antialias=True,
        )
        return resized.movedim(1, -1).contiguous().clamp(0.0, 1.0)

    # ------------------------------------------------------------------
    # Главная функция
    # ------------------------------------------------------------------
    def apply_manual_color(self, image, upscale_model=None, **kwargs):
        brightness = float(kwargs.get("BRIGHTNESS / ЯРКОСТЬ", 0.0))
        contrast = float(kwargs.get("CONTRAST / КОНТРАСТ", 1.0))
        saturation = float(kwargs.get("SATURATION / НАСЫЩЕННОСТЬ", 1.0))
        sharpness = float(kwargs.get("SHARPNESS / РЕЗКОСТЬ", 0.0))
        upscale_mode = str(kwargs.get("upscale", "Disabled / Откл")).strip()
        requested_scale = float(kwargs.get("upscale_scale", 2.0))

        upscale_enabled = upscale_mode == "Enabled / Вкл"
        fast_mode = str(
            kwargs.get("upscale_speed", "Quality / Качество")
        ).startswith("Fast")
        fp16 = "fp16" in str(
            kwargs.get("upscale_precision", "Fast fp16 / Быстро")
        )

        if upscale_enabled and upscale_model is None:
            logging.warning(
                "[Turbo Color Fix] Upscale enabled, but UPSCALE_MODEL "
                "is not connected. Only color correction will be applied."
            )
            upscale_enabled = False

        if upscale_enabled and not (
            hasattr(upscale_model, "patcher")
            and hasattr(upscale_model, "scale")
        ):
            raise RuntimeError("Unsupported UPSCALE_MODEL object.")

        # Ничего не меняем и апскейла нет: отдаём вход как есть,
        # без копии кадров в оперативной памяти.
        if (
            not upscale_enabled
            and brightness == 0.0
            and contrast == 1.0
            and saturation == 1.0
            and sharpness == 0.0
        ):
            return (image,)

        device = comfy.model_management.get_torch_device()
        out_device = comfy.model_management.intermediate_device()

        total, orig_h, orig_w = image.shape[0], image.shape[1], image.shape[2]
        channels = image.shape[3]

        # Сколько кадров за раз. Для апскейла порции маленькие.
        if upscale_enabled:
            model_scale = float(upscale_model.scale)
            if model_scale <= 1.0:
                chunk_size = 8
            elif model_scale <= 2.0:
                chunk_size = 4
            else:
                chunk_size = 2
        else:
            chunk_size = 16
        chunk_size = max(1, min(chunk_size, total))

        # Освобождаем VRAM (выгружаем диффузионную модель и т.п.),
        # чтобы хватило места под нашу порцию.
        frame_bytes = orig_h * orig_w * channels * 4
        need = frame_bytes * chunk_size * 8
        if upscale_enabled:
            need *= max(2.0, float(upscale_model.scale) ** 2)
        try:
            comfy.model_management.free_memory(int(need), device)
        except Exception as error:
            logging.warning("[Turbo Color Fix] free_memory failed: %s", error)

        if upscale_enabled:
            comfy.model_management.load_models_gpu(
                [upscale_model.patcher],
                memory_required=int(need),
                force_full_load=True,
            )

        results = []
        tile_state = {"size": 512}

        # В режиме Fast кадры уменьшаются до модели так, чтобы после
        # неё получился ровно нужный масштаб (без лишних вычислений).
        shrink_factor = 1.0
        if upscale_enabled and fast_mode:
            shrink_factor = min(
                1.0,
                requested_scale / max(float(upscale_model.scale), 1.0),
            )
        i = 0

        with torch.inference_mode():
            while i < total:
                try:
                    t0 = time.time()
                    part = image[i:i + chunk_size]

                    part = self._apply_color_correction(
                        part, brightness, contrast,
                        saturation, sharpness, device,
                    )

                    if upscale_enabled:
                        if shrink_factor < 1.0:
                            part = self._prescale(part, shrink_factor)
                        part = self._run_upscale_model(
                            part, upscale_model, tile_state, fp16
                        )
                        part = self._resize_to_requested_scale(
                            part, orig_w, orig_h, requested_scale
                        )

                    # Сразу уносим готовые кадры с GPU
                    n = min(chunk_size, total - i)
                    results.append(part.to(out_device))
                    del part
                    i += chunk_size
                    logging.info(
                        "[Turbo Color Fix] %d/%d frames, %.2f s/frame, "
                        "chunk=%d, tile=%d",
                        min(i, total), total, (time.time() - t0) / n,
                        chunk_size, tile_state["size"],
                    )

                except Exception as error:
                    if not _is_oom(error) or chunk_size == 1:
                        raise
                    comfy.model_management.soft_empty_cache()
                    chunk_size = max(1, chunk_size // 2)
                    logging.warning(
                        "[Turbo Color Fix] Out of VRAM. "
                        "Retrying with %s frame(s) per chunk.", chunk_size,
                    )

        comfy.model_management.soft_empty_cache()

        return (torch.cat(results, dim=0),)


NODE_CLASS_MAPPINGS = {
    "TurboColorFixAdaIN": MyTurboColorFix,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TurboColorFixAdaIN": "Manual Color & Upscale Panel",
}
