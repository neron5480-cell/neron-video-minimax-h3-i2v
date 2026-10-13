import hashlib
import json

import torch
import torch.nn.functional as F
import folder_paths

from .my_smart_load_image import MySmartLoadImage
from .my_turbo_color_fix import MyTurboColorFix


WEB_DIRECTORY = "./web"


def make_cache_value(value):
    """
    Преобразует входное значение в стабильный формат
    для проверки изменения параметров ноды.
    """

    if value is None:
        return None

    if isinstance(
        value,
        (
            str,
            int,
            float,
            bool,
        ),
    ):
        return value

    if isinstance(value, (list, tuple)):
        return [
            make_cache_value(item)
            for item in value
        ]

    if isinstance(value, dict):
        return {
            str(key): make_cache_value(item)
            for key, item in sorted(
                value.items(),
                key=lambda pair: str(pair[0]),
            )
        }

    if hasattr(value, "model"):
        model = value.model

        result = {
            "type": (
                model.__class__.__module__ +
                "." +
                model.__class__.__name__
            ),
        }

        for attribute in (
            "name",
            "filename",
            "model_path",
            "scale",
        ):
            if hasattr(value, attribute):
                result[attribute] = str(
                    getattr(value, attribute)
                )

            if hasattr(model, attribute):
                result[
                    f"model_{attribute}"
                ] = str(
                    getattr(model, attribute)
                )

        return result

    return {
        "type": (
            value.__class__.__module__ +
            "." +
            value.__class__.__name__
        ),
    }


class InteractiveImageProcessor:
    """
    Интерактивный обработчик изображения.

    Объединяет:
    - загрузку изображения;
    - изменение размера;
    - яркость;
    - контраст;
    - насыщенность;
    - резкость;
    - дополнительный AI-апскейл.
    """

    def __init__(self):
        self.image_loader = MySmartLoadImage()
        self.color_processor = MyTurboColorFix()

    @classmethod
    def INPUT_TYPES(cls):
        loader_inputs = dict(
            MySmartLoadImage.INPUT_TYPES()[
                "required"
            ]
        )

        color_inputs = dict(
            MyTurboColorFix.INPUT_TYPES()[
                "required"
            ]
        )

        color_inputs.pop(
            "image",
            None,
        )

        return {
            "required": {
                **loader_inputs,
                **color_inputs,
            },
            "optional": {
                "upscale_model": (
                    "UPSCALE_MODEL",
                ),
            },
        }

    RETURN_TYPES = (
        "IMAGE",
        "MASK",
        "INT",
        "INT",
    )

    RETURN_NAMES = (
        "IMAGE",
        "MASK",
        "width",
        "height",
    )

    FUNCTION = "process"
    CATEGORY = "AIVideoPostprocessing"

    def process(
        self,
        image,
        resize_mode,
        ai_preset,
        aspect_ratio,
        max_dimension,
        manual_width,
        manual_height,
        megapixels,
        divisible_by,
        **kwargs,
    ):
        loaded_image, mask, width, height = (
            self.image_loader.load_and_resize(
                image=image,
                resize_mode=resize_mode,
                ai_preset=ai_preset,
                aspect_ratio=aspect_ratio,
                max_dimension=max_dimension,
                manual_width=manual_width,
                manual_height=manual_height,
                megapixels=megapixels,
                divisible_by=divisible_by,
            )
        )

        processed_image = (
            self.color_processor.apply_manual_color(
                loaded_image,
                **kwargs,
            )[0]
        )

        final_height = int(
            processed_image.shape[1]
        )

        final_width = int(
            processed_image.shape[2]
        )

        if mask.shape[-2:] != (
            final_height,
            final_width,
        ):
            mask = F.interpolate(
                mask.unsqueeze(1),
                size=(
                    final_height,
                    final_width,
                ),
                mode="bilinear",
                align_corners=False,
            ).squeeze(1)

        mask = mask.to(
            device=processed_image.device,
            dtype=torch.float32,
        )

        return (
            processed_image,
            mask,
            final_width,
            final_height,
        )

    @classmethod
    def IS_CHANGED(cls, image, **kwargs):
        """
        Формирует уникальный ключ кеша из:
        - содержимого изображения;
        - настроек размера;
        - настроек цвета;
        - режима апскейла;
        - масштаба апскейла;
        - выбранной модели.
        """

        try:
            image_path = (
                folder_paths.get_annotated_filepath(
                    image
                )
            )

            with open(image_path, "rb") as file:
                image_hash = hashlib.sha256(
                    file.read()
                ).hexdigest()

            settings = {
                key: make_cache_value(value)
                for key, value in sorted(
                    kwargs.items()
                )
            }

            settings_json = json.dumps(
                settings,
                ensure_ascii=True,
                sort_keys=True,
                separators=(",", ":"),
            )

            complete_value = (
                image_hash +
                "|" +
                settings_json
            )

            return hashlib.sha256(
                complete_value.encode("utf-8")
            ).hexdigest()

        except Exception as error:
            print(
                "[Interactive Image Processor] "
                f"Cache check error: {error}"
            )

            # Если определить ключ не получилось,
            # заставляем ComfyUI выполнить ноду заново.
            return float("nan")

    @classmethod
    def VALIDATE_INPUTS(cls, image, **kwargs):
        """
        Проверяет наличие выбранного изображения.
        """

        if not image:
            return (
                "Сначала выберите изображение "
                "внутри ноды."
            )

        if not folder_paths.exists_annotated_filepath(
            image
        ):
            return (
                "Файл изображения не найден: "
                f"{image}"
            )

        return True


NODE_CLASS_MAPPINGS = {
    "InteractiveImageProcessor": (
        InteractiveImageProcessor
    ),
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "InteractiveImageProcessor": (
        "Interactive Image Processor"
    ),
}