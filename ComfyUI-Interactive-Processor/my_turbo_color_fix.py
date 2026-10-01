import torch
import torch.nn.functional as F


try:
    from comfy_extras.nodes_upscale_model import (
        ImageUpscaleWithModel,
    )
except Exception:
    ImageUpscaleWithModel = None


class MyTurboColorFix:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": (
                    "IMAGE",
                ),
                "BRIGHTNESS / ЯРКОСТЬ": (
                    "FLOAT",
                    {
                        "default": 0.0,
                        "min": -0.50,
                        "max": 0.50,
                        "step": 0.01,
                        "display": "slider",
                    },
                ),
                "CONTRAST / КОНТРАСТ": (
                    "FLOAT",
                    {
                        "default": 1.0,
                        "min": 0.50,
                        "max": 1.80,
                        "step": 0.01,
                        "display": "slider",
                    },
                ),
                "SATURATION / НАСЫЩЕННОСТЬ": (
                    "FLOAT",
                    {
                        "default": 1.0,
                        "min": 0.00,
                        "max": 1.80,
                        "step": 0.01,
                        "display": "slider",
                    },
                ),
                "SHARPNESS / РЕЗКОСТЬ": (
                    "FLOAT",
                    {
                        "default": 0.0,
                        "min": 0.00,
                        "max": 2.00,
                        "step": 0.05,
                        "display": "slider",
                    },
                ),
                "upscale": (
                    [
                        "Disabled / Откл",
                        "Enabled / Вкл",
                    ],
                    {
                        "default": (
                            "Disabled / Откл"
                        ),
                    },
                ),
                "upscale_scale": (
                    "FLOAT",
                    {
                        "default": 2.00,
                        "min": 1.00,
                        "max": 4.00,
                        "step": 0.25,
                    },
                ),
            },
            "optional": {
                "upscale_model": (
                    "UPSCALE_MODEL",
                ),
            },
        }

    RETURN_TYPES = (
        "IMAGE",
    )

    FUNCTION = "apply_manual_color"
    CATEGORY = "AIVideoPostprocessing"

    @staticmethod
    def extract_tensor_from_result(result):
        """
        Извлекает Tensor из результата стандартной
        ноды ComfyUI.

        В разных версиях ComfyUI результат может быть:
        - Tensor;
        - tuple/list с Tensor;
        - объект NodeOutput;
        - объект с полем result.
        """

        if torch.is_tensor(result):
            return result

        result_value = getattr(
            result,
            "result",
            None,
        )

        if result_value is not None:
            result = result_value

        if isinstance(
            result,
            dict,
        ):
            if "result" in result:
                result = result["result"]

            elif "image" in result:
                result = result["image"]

        if isinstance(
            result,
            (tuple, list),
        ):
            if len(result) == 0:
                raise RuntimeError(
                    "Апскейлер вернул пустой результат."
                )

            result = result[0]

        if not torch.is_tensor(result):
            raise TypeError(
                "Стандартный апскейлер ComfyUI "
                "не вернул изображение Tensor."
            )

        return result

    @staticmethod
    def convert_to_bhwc(
        image,
    ):
        """
        Приводит изображение к формату ComfyUI:

        [B, H, W, C]
        """

        if not torch.is_tensor(image):
            raise TypeError(
                "Результат апскейла не является Tensor."
            )

        if image.ndim != 4:
            raise ValueError(
                "Результат апскейла должен иметь "
                "четыре измерения."
            )

        # Уже формат [B, H, W, C].
        if image.shape[-1] in (
            1,
            3,
            4,
        ):
            return image

        # Формат [B, C, H, W].
        if image.shape[1] in (
            1,
            3,
            4,
        ):
            return image.movedim(
                1,
                -1,
            )

        raise ValueError(
            "Не удалось определить формат "
            "результата апскейлера."
        )

    @staticmethod
    def resize_exact(
        image,
        target_width,
        target_height,
    ):
        """
        Приводит изображение к выбранному
        точному размеру.
        """

        current_height = int(
            image.shape[1]
        )

        current_width = int(
            image.shape[2]
        )

        if (
            current_width == target_width and
            current_height == target_height
        ):
            return image

        image_nchw = image.movedim(
            -1,
            1,
        ).contiguous()

        resized = F.interpolate(
            image_nchw,
            size=(
                target_height,
                target_width,
            ),
            mode="bilinear",
            align_corners=False,
        )

        return resized.movedim(
            1,
            -1,
        ).contiguous()

    @staticmethod
    def apply_sharpness(
        frames,
        sharpness_val,
    ):
        """
        Применяет резкость к изображению
        в формате [B, C, H, W].
        """

        if sharpness_val <= 0.0:
            return frames

        channels = int(
            frames.shape[1]
        )

        if channels < 3:
            return frames

        dtype = frames.dtype
        device = frames.device

        kernel = torch.tensor(
            [
                [1 / 9, 1 / 9, 1 / 9],
                [1 / 9, 1 / 9, 1 / 9],
                [1 / 9, 1 / 9, 1 / 9],
            ],
            dtype=dtype,
            device=device,
        )

        kernel = kernel / kernel.sum()

        kernel = kernel.view(
            1,
            1,
            3,
            3,
        ).repeat(
            3,
            1,
            1,
            1,
        )

        rgb_frames = frames[:, :3, :, :]

        blurred = F.conv2d(
            rgb_frames,
            kernel,
            padding=1,
            groups=3,
        )

        sharpened = (
            rgb_frames +
            (
                rgb_frames -
                blurred
            ) * sharpness_val
        )

        if channels == 3:
            return sharpened

        return torch.cat(
            (
                sharpened,
                frames[:, 3:, :, :],
            ),
            dim=1,
        )

    @staticmethod
    def get_upscale_callable():
        """
        Возвращает стандартный метод ComfyUI.

        В новых версиях используется execute.
        В старых версиях может использоваться upscale.
        """

        if ImageUpscaleWithModel is None:
            return None

        execute_method = getattr(
            ImageUpscaleWithModel,
            "execute",
            None,
        )

        if callable(execute_method):
            return execute_method

        upscale_method = getattr(
            ImageUpscaleWithModel,
            "upscale",
            None,
        )

        if callable(upscale_method):
            return upscale_method

        return None

    def apply_manual_color(
        self,
        image,
        **kwargs,
    ):
        brightness_val = float(
            kwargs.get(
                "BRIGHTNESS / ЯРКОСТЬ",
                0.0,
            )
        )

        contrast_val = float(
            kwargs.get(
                "CONTRAST / КОНТРАСТ",
                1.0,
            )
        )

        saturation_val = float(
            kwargs.get(
                "SATURATION / НАСЫЩЕННОСТЬ",
                1.0,
            )
        )

        sharpness_val = float(
            kwargs.get(
                "SHARPNESS / РЕЗКОСТЬ",
                0.0,
            )
        )

        upscale = str(
            kwargs.get(
                "upscale",
                "Disabled / Откл",
            )
        ).strip()

        upscale_scale = float(
            kwargs.get(
                "upscale_scale",
                2.00,
            )
        )

        upscale_model = kwargs.get(
            "upscale_model",
            None,
        )

        upscale_enabled = (
            upscale == "Enabled / Вкл"
        )

        # Изображение ComfyUI имеет формат:
        #
        # [B, H, W, C]
        #
        # Для цветовой обработки используем:
        #
        # [B, C, H, W]
        frames = image.movedim(
            -1,
            1,
        ).contiguous()

        # Яркость.
        if brightness_val != 0.0:
            frames = frames + brightness_val

        # Контраст.
        if contrast_val != 1.0:
            mean_val = torch.mean(
                frames,
                dim=(2, 3),
                keepdim=True,
            )

            frames = (
                frames - mean_val
            ) * contrast_val + mean_val

        # Насыщенность.
        if saturation_val != 1.0:
            if frames.shape[1] >= 3:
                grayscale = (
                    frames[:, 0:1, :, :] * 0.299 +
                    frames[:, 1:2, :, :] * 0.587 +
                    frames[:, 2:3, :, :] * 0.114
                )

                rgb_frames = frames[:, :3, :, :]

                corrected_rgb = (
                    grayscale +
                    (
                        rgb_frames -
                        grayscale
                    ) * saturation_val
                )

                if frames.shape[1] > 3:
                    frames = torch.cat(
                        (
                            corrected_rgb,
                            frames[:, 3:, :, :],
                        ),
                        dim=1,
                    )
                else:
                    frames = corrected_rgb

        # Резкость.
        frames = self.apply_sharpness(
            frames,
            sharpness_val,
        )

        frames = torch.clamp(
            frames,
            0.0,
            1.0,
        )

        final_output = frames.movedim(
            1,
            -1,
        ).contiguous()

        # Если апскейл выключен или модель
        # не подключена, возвращаем обычный результат.
        if (
            not upscale_enabled or
            upscale_model is None
        ):
            return (
                torch.clamp(
                    final_output,
                    0.0,
                    1.0,
                ),
            )

        upscale_method = (
            self.get_upscale_callable()
        )

        if upscale_method is None:
            raise RuntimeError(
                "В этой версии ComfyUI "
                "не найден стандартный "
                "ImageUpscaleWithModel."
            )

        original_height = int(
            final_output.shape[1]
        )

        original_width = int(
            final_output.shape[2]
        )

        target_width = max(
            1,
            int(
                original_width *
                upscale_scale
            ),
        )

        target_height = max(
            1,
            int(
                original_height *
                upscale_scale
            ),
        )

        patcher = getattr(
            upscale_model,
            "patcher",
            None,
        )

        load_device = getattr(
            patcher,
            "load_device",
            None,
        )

        print(
            "[Turbo Color Fix] "
            "Запуск стандартного "
            "ComfyUI AI-апскейла."
        )

        print(
            "[Turbo Color Fix] "
            f"Устройство модели: {load_device}"
        )

        try:
            with torch.inference_mode():
                # ВАЖНО:
                # Стандартный ComfyUI сам:
                #
                # 1. загружает модель;
                # 2. выбирает GPU;
                # 3. переносит изображение;
                # 4. выполняет тайловый апскейл.
                #
                # .contiguous() предотвращает
                # ошибки stride после movedim.
                upscale_input = (
                    final_output
                    .contiguous()
                )

                upscale_result = (
                    upscale_method(
                        upscale_model,
                        upscale_input,
                    )
                )

            upscaled = (
                self.extract_tensor_from_result(
                    upscale_result,
                )
            )

            upscaled = (
                self.convert_to_bhwc(
                    upscaled,
                )
            )

            upscaled = upscaled.contiguous()

            upscaled = self.resize_exact(
                upscaled,
                target_width,
                target_height,
            )

            final_output = torch.clamp(
                upscaled,
                0.0,
                1.0,
            )

            print(
                "[Turbo Color Fix] "
                "AI-апскейл успешно завершён."
            )

            return (
                final_output,
            )

        except Exception as error:
            print(
                "[Turbo Color Fix] "
                "ОШИБКА GPU AI-АПСКЕЙЛА:"
            )

            print(
                repr(error)
            )

            raise RuntimeError(
                "GPU-апскейл не запустился. "
                "CPU fallback отключён. "
                "Подробная причина указана "
                "в консоли ComfyUI."
            ) from error


NODE_CLASS_MAPPINGS = {
    "TurboColorFixAdaIN": (
        MyTurboColorFix
    ),
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "TurboColorFixAdaIN": (
        "⚡ Manual Color & Upscale Panel"
    ),
}