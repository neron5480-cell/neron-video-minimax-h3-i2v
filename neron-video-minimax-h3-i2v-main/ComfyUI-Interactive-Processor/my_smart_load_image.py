import os

import numpy as np
import torch
from PIL import Image, ImageOps

import folder_paths


class MySmartLoadImage:
    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()

        files = [
            file_name
            for file_name in os.listdir(input_dir)
            if os.path.isfile(
                os.path.join(input_dir, file_name)
            )
        ]

        return {
            "required": {
                "image": (
                    sorted(files),
                    {
                        "image_upload": True,
                    },
                ),
                "resize_mode": (
                    [
                        "Disabled / Отключено",
                        "Standard Presets / Пресеты",
                        "Aspect Ratio / Соотношение сторон",
                        "Manual / Вручную",
                        "Megapixels / Мегапиксели",
                    ],
                    {
                        "default": (
                            "Standard Presets / Пресеты"
                        ),
                    },
                ),
                "ai_preset": (
                    [
                        "1024x1024 (1:1 Square)",
                        "1216x832 (3:2 Landscape)",
                        "832x1216 (2:3 Portrait)",
                        "1344x768 (16:9 Cinema)",
                        "768x1344 (9:16 Vertical)",
                        "1536x640 (21:9 UltraWide)",
                    ],
                    {
                        "default": (
                            "1024x1024 (1:1 Square)"
                        ),
                    },
                ),
                "aspect_ratio": (
                    [
                        "1:1",
                        "16:9",
                        "9:16",
                        "4:3",
                        "3:2",
                        "21:9",
                    ],
                    {
                        "default": "1:1",
                    },
                ),
                "max_dimension": (
                    "INT",
                    {
                        "default": 1024,
                        "min": 64,
                        "max": 8192,
                        "step": 64,
                    },
                ),
                "manual_width": (
                    "INT",
                    {
                        "default": 1024,
                        "min": 64,
                        "max": 8192,
                        "step": 8,
                    },
                ),
                "manual_height": (
                    "INT",
                    {
                        "default": 1024,
                        "min": 64,
                        "max": 8192,
                        "step": 8,
                    },
                ),
                "megapixels": (
                    [
                        "0.5 MP",
                        "1.0 MP (1024x1024)",
                        "2.0 MP",
                        "4.0 MP",
                        "8.0 MP",
                    ],
                    {
                        "default": (
                            "1.0 MP (1024x1024)"
                        ),
                    },
                ),
                "divisible_by": (
                    [8, 16, 32, 64, 128],
                    {
                        "default": 32,
                    },
                ),
            }
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

    FUNCTION = "load_and_resize"
    CATEGORY = "AIVideoPostprocessing"

    @staticmethod
    def round_to_divisible(value, divisible_by):
        value = int(value)
        divisible_by = int(divisible_by)

        rounded = (
            value + divisible_by // 2
        ) // divisible_by * divisible_by

        return max(divisible_by, rounded)

    def calculate_size(
        self,
        orig_w,
        orig_h,
        resize_mode,
        ai_preset,
        aspect_ratio,
        max_dimension,
        manual_width,
        manual_height,
        megapixels,
        divisible_by,
    ):
        new_w = int(orig_w)
        new_h = int(orig_h)

        if "Standard Presets" in resize_mode:
            preset_dict = {
                "1024x1024 (1:1 Square)": (
                    1024,
                    1024,
                ),
                "1216x832 (3:2 Landscape)": (
                    1216,
                    832,
                ),
                "832x1216 (2:3 Portrait)": (
                    832,
                    1216,
                ),
                "1344x768 (16:9 Cinema)": (
                    1344,
                    768,
                ),
                "768x1344 (9:16 Vertical)": (
                    768,
                    1344,
                ),
                "1536x640 (21:9 UltraWide)": (
                    1536,
                    640,
                ),
            }

            new_w, new_h = preset_dict.get(
                ai_preset,
                (1024, 1024),
            )

        elif "Aspect Ratio" in resize_mode:
            ratio_dict = {
                "1:1": 1.0,
                "16:9": 16 / 9,
                "9:16": 9 / 16,
                "4:3": 4 / 3,
                "3:2": 3 / 2,
                "21:9": 21 / 9,
            }

            target_ratio = ratio_dict.get(
                aspect_ratio,
                1.0,
            )

            if target_ratio >= 1.0:
                new_w = int(max_dimension)
                new_h = int(
                    round(
                        max_dimension /
                        target_ratio
                    )
                )
            else:
                new_h = int(max_dimension)
                new_w = int(
                    round(
                        max_dimension *
                        target_ratio
                    )
                )

        elif "Manual" in resize_mode:
            new_w = int(manual_width)
            new_h = int(manual_height)

        elif "Megapixels" in resize_mode:
            megapixels_dict = {
                "0.5 MP": 524288,
                "1.0 MP (1024x1024)": 1048576,
                "2.0 MP": 2097152,
                "4.0 MP": 4194304,
                "8.0 MP": 8388608,
            }

            target_pixels = megapixels_dict.get(
                megapixels,
                1048576,
            )

            original_ratio = (
                float(orig_w) /
                float(orig_h)
            )

            new_w = int(
                np.round(
                    np.sqrt(
                        target_pixels *
                        original_ratio
                    )
                )
            )

            new_h = int(
                np.round(
                    np.sqrt(
                        target_pixels /
                        original_ratio
                    )
                )
            )

        divisible_by = max(
            1,
            int(divisible_by),
        )

        if divisible_by > 1:
            new_w = self.round_to_divisible(
                new_w,
                divisible_by,
            )

            new_h = self.round_to_divisible(
                new_h,
                divisible_by,
            )

        new_w = max(
            divisible_by,
            int(new_w),
        )

        new_h = max(
            divisible_by,
            int(new_h),
        )

        return new_w, new_h

    def load_and_resize(
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
    ):
        image_path = (
            folder_paths.get_annotated_filepath(
                image
            )
        )

        source_image = Image.open(image_path)
        source_image = ImageOps.exif_transpose(
            source_image
        )

        orig_w, orig_h = source_image.size

        new_w, new_h = self.calculate_size(
            orig_w=orig_w,
            orig_h=orig_h,
            resize_mode=resize_mode,
            ai_preset=ai_preset,
            aspect_ratio=aspect_ratio,
            max_dimension=max_dimension,
            manual_width=manual_width,
            manual_height=manual_height,
            megapixels=megapixels,
            divisible_by=divisible_by,
        )

        has_alpha = (
            "A" in source_image.getbands()
        )

        if has_alpha:
            alpha_image = source_image.getchannel(
                "A"
            )
        else:
            alpha_image = None

        rgb_image = source_image.convert("RGB")

        # ВАЖНО:
        # Изображение всегда используется целиком.
        # Никакой обрезки по центру нет.
        #
        # Если исходные пропорции отличаются
        # от выбранных, изображение растягивается
        # или сжимается до нового разрешения.
        if rgb_image.size != (new_w, new_h):
            rgb_image = rgb_image.resize(
                (new_w, new_h),
                Image.Resampling.LANCZOS,
            )

        image_np = np.asarray(
            rgb_image,
            dtype=np.float32,
        ) / 255.0

        image_tensor = torch.from_numpy(
            image_np.copy()
        ).unsqueeze(0)

        if alpha_image is not None:
            if alpha_image.size != (
                new_w,
                new_h,
            ):
                alpha_image = alpha_image.resize(
                    (new_w, new_h),
                    Image.Resampling.LANCZOS,
                )

            mask_np = np.asarray(
                alpha_image,
                dtype=np.float32,
            ) / 255.0

            mask_tensor = 1.0 - torch.from_numpy(
                mask_np.copy()
            ).unsqueeze(0)
        else:
            mask_tensor = torch.zeros(
                (
                    1,
                    new_h,
                    new_w,
                ),
                dtype=torch.float32,
            )

        return (
            image_tensor,
            mask_tensor,
            int(new_w),
            int(new_h),
        )


NODE_CLASS_MAPPINGS = {
    "SmartLoadAndResizeImage": (
        MySmartLoadImage
    ),
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartLoadAndResizeImage": (
        "⚡ Smart Load & Resize Image"
    ),
}