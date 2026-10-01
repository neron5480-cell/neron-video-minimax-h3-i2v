import os
import torch
import numpy as np
from PIL import Image, ImageOps
import folder_paths

class MySmartLoadImage:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = [f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))]
        return {
            "required": {
                "image": (sorted(files), {"image_upload": True}),
                "resize_mode": ([
                    "Disabled / Отключено", 
                    "Standard Presets / Пресеты", 
                    "Aspect Ratio / Соотношение сторон", 
                    "Manual / Вручную", 
                    "Megapixels / Мегапиксели"
                ], {"default": "Standard Presets / Пресеты"}),
                "ai_preset": ([
                    "1024x1024 (1:1 Square)",
                    "1216x832 (3:2 Landscape)",
                    "832x1216 (2:3 Portrait)",
                    "1344x768 (16:9 Cinema)",
                    "768x1344 (9:16 Vertical)",
                    "1536x640 (21:9 UltraWide)"
                ], {"default": "1024x1024 (1:1 Square)"}),
                "aspect_ratio": (["1:1", "16:9", "9:16", "4:3", "3:2", "21:9"], {"default": "1:1"}),
                "max_dimension": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 64}),
                "manual_width": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8}),
                "manual_height": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8}),
                "megapixels": (["0.5 MP", "1.0 MP (1024x1024)", "2.0 MP", "4.0 MP", "8.0 MP"], {"default": "1.0 MP (1024x1024)"}),
                "divisible_by": ([8, 16, 32, 64, 128], {"default": 32}),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT")
    RETURN_NAMES = ("IMAGE", "MASK", "width", "height")
    FUNCTION = "load_and_resize"
    CATEGORY = "AIVideoPostprocessing"

    def load_and_resize(self, image, resize_mode, ai_preset, aspect_ratio, max_dimension, manual_width, manual_height, megapixels, divisible_by):
        image_path = folder_paths.get_annotated_filepath(image)
        img = Image.open(image_path)
        img = ImageOps.exif_transpose(img)
        
        orig_w, orig_h = img.size
        new_w, new_h = orig_w, orig_h

        # 1. МАТЕМАТИЧЕСКИЙ РАССЧЕТ РАЗМЕРОВ
        if "Standard Presets" in resize_mode:
            preset_dict = {
                "1024x1024 (1:1 Square)": (1024, 1024),
                "1216x832 (3:2 Landscape)": (1216, 832),
                "832x1216 (2:3 Portrait)": (832, 1216),
                "1344x768 (16:9 Cinema)": (1344, 768),
                "768x1344 (9:16 Vertical)": (768, 1344),
                "1536x640 (21:9 UltraWide)": (1536, 640)
            }
            new_w, new_h = preset_dict[ai_preset]

        elif "Aspect Ratio" in resize_mode:
            ratio_dict = {"1:1": 1.0, "16:9": 16/9, "9:16": 9/16, "4:3": 4/3, "3:2": 3/2, "21:9": 21/9}
            target_ratio = ratio_dict[aspect_ratio]
            
            if target_ratio >= 1.0:
                new_w = max_dimension
                new_h = int(max_dimension / target_ratio)
            else:
                new_h = max_dimension
                new_w = int(max_dimension * target_ratio)

        elif "Manual" in resize_mode:
            new_w = manual_width
            new_h = manual_height

        elif "Megapixels" in resize_mode:
            mp_dict = {"0.5 MP": 524288, "1.0 MP (1024x1024)": 1048576, "2.0 MP": 2097152, "4.0 MP": 4194304, "8.0 MP": 8388608}
            target_pixels = mp_dict[megapixels]
            
            current_ratio = float(orig_w) / float(orig_h)
            new_w = int(np.round(np.sqrt(target_pixels * current_ratio)))
            new_h = int(np.round(np.sqrt(target_pixels / current_ratio)))

        # 2. ЖЕСТКАЯ ФИЛЬТРАЦИЯ КРАТНОСТИ
        if divisible_by > 1:
            if any(x in resize_mode for x in ["Standard Presets", "Aspect Ratio", "Manual"]):
                new_w = (new_w + divisible_by // 2) // divisible_by * divisible_by
                new_h = (new_h + divisible_by // 2) // divisible_by * divisible_by
            elif "Megapixels" in resize_mode:
                temp_w = max(divisible_by, (new_w + divisible_by // 2) // divisible_by * divisible_by)
                current_ratio = float(orig_w) / float(orig_h)
                temp_h = int(np.round(temp_w / current_ratio))
                new_h = max(divisible_by, (temp_h + divisible_by // 2) // divisible_by * divisible_by)
                new_w = temp_w
            elif "Disabled" in resize_mode:
                new_w = (orig_w // divisible_by) * divisible_by
                new_h = (orig_h // divisible_by) * divisible_by

        new_w = max(divisible_by, new_w)
        new_h = max(divisible_by, new_h)

        # 3. ИЗМЕНЕНИЕ РАЗМЕРА И УМНЫЙ КРОП
        if (new_w, new_h) != (orig_w, orig_h):
            if any(x in resize_mode for x in ["Standard Presets", "Aspect Ratio"]):
                img = ImageOps.fit(img, (new_w, new_h), Image.Resampling.LANCZOS)
            elif "Disabled" in resize_mode:
                img = img.crop((0, 0, new_w, new_h))
            else:
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # 4. ПОДГОТОВКА СТАНДАРТНЫХ ТЕНЗОРОВ ДЛЯ COMFYUI
        image_np = np.array(img).astype(np.float32) / 255.0
        if len(image_np.shape) == 2:
            image_np = np.stack([image_np, image_np, image_np], axis=-1)
        elif image_np.shape[2] == 4:
            image_np = image_np[:, :, :3]
            
        image_tensor = torch.from_numpy(image_np).unsqueeze(0)

        if 'A' in img.getbands():
            mask = np.array(img.getchannel('A')).astype(np.float32) / 255.0
            mask_tensor = torch.from_numpy(mask).unsqueeze(0)
            mask_tensor = 1.0 - mask_tensor
        else:
            mask_tensor = torch.zeros((1, new_h, new_w), dtype=torch.float32)

        return (image_tensor, mask_tensor, int(new_w), int(new_h))

NODE_CLASS_MAPPINGS = {
    "SmartLoadAndResizeImage": MySmartLoadImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartLoadAndResizeImage": "⚡ Smart Load & Resize Image"
}
