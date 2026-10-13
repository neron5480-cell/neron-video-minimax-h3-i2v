import logging
import os

import comfy.sd
import comfy.utils
import folder_paths


NO_LORA = "None / Не выбрано"


class H3LoraSelector:
    """
    Применяет до пяти LoRA только к MODEL.

    Каждый слот можно включать и выключать независимо.
    Активные LoRA применяются последовательно:
    слот 1, затем слот 2, затем слот 3 и так далее.
    """

    def __init__(self):
        # Кэш предотвращает повторное чтение LoRA с диска.
        # В кэше хранится не более пяти файлов.
        self.loaded_loras = {}

    @classmethod
    def INPUT_TYPES(cls):
        lora_files = folder_paths.get_filename_list("loras")

        # Добавляем безопасный пустой вариант первым.
        lora_choices = [NO_LORA] + lora_files

        enabled_widget = {
            "default": False,
            "label_on": "ON / Вкл",
            "label_off": "OFF / Откл",
        }

        weight_widget = {
            "default": 1.0,
            "min": -3.0,
            "max": 3.0,
            "step": 0.05,
            "round": 0.01,
            "display": "slider",
        }

        return {
            "required": {
                "model": ("MODEL",),

                "slot_1_enabled": (
                    "BOOLEAN",
                    enabled_widget.copy(),
                ),
                "slot_1_lora": (
                    lora_choices,
                    {"default": NO_LORA},
                ),
                "slot_1_strength": (
                    "FLOAT",
                    weight_widget.copy(),
                ),

                "slot_2_enabled": (
                    "BOOLEAN",
                    enabled_widget.copy(),
                ),
                "slot_2_lora": (
                    lora_choices,
                    {"default": NO_LORA},
                ),
                "slot_2_strength": (
                    "FLOAT",
                    weight_widget.copy(),
                ),

                "slot_3_enabled": (
                    "BOOLEAN",
                    enabled_widget.copy(),
                ),
                "slot_3_lora": (
                    lora_choices,
                    {"default": NO_LORA},
                ),
                "slot_3_strength": (
                    "FLOAT",
                    weight_widget.copy(),
                ),

                "slot_4_enabled": (
                    "BOOLEAN",
                    enabled_widget.copy(),
                ),
                "slot_4_lora": (
                    lora_choices,
                    {"default": NO_LORA},
                ),
                "slot_4_strength": (
                    "FLOAT",
                    weight_widget.copy(),
                ),

                "slot_5_enabled": (
                    "BOOLEAN",
                    enabled_widget.copy(),
                ),
                "slot_5_lora": (
                    lora_choices,
                    {"default": NO_LORA},
                ),
                "slot_5_strength": (
                    "FLOAT",
                    weight_widget.copy(),
                ),
            }
        }

    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("model",)

    FUNCTION = "apply_loras"
    CATEGORY = "H3-Static-Camera/LoRA"

    DESCRIPTION = (
        "Applies up to five LoRA files to MODEL. "
        "Each slot has an independent switch and strength."
    )

    @staticmethod
    def _get_lora_path(lora_name):
        """
        Получает безопасный полный путь через ComfyUI.

        Этот способ также работает с подпапками внутри
        каталога models/loras.
        """

        if lora_name == NO_LORA:
            raise ValueError("LoRA is not selected.")

        return folder_paths.get_full_path_or_raise(
            "loras",
            lora_name,
        )

    def _load_lora_file(self, lora_name):
        """
        Загружает файл LoRA и сохраняет его в кэш.

        Если файл был заменён на диске, кэш обновляется.
        """

        lora_path = self._get_lora_path(lora_name)
        modified_time = os.path.getmtime(lora_path)

        cached_lora = self.loaded_loras.get(lora_path)

        if cached_lora is not None:
            cached_modified_time = cached_lora[0]

            if cached_modified_time == modified_time:
                return cached_lora[1], cached_lora[2]

            del self.loaded_loras[lora_path]

        try:
            lora_data, lora_metadata = (
                comfy.utils.load_torch_file(
                    lora_path,
                    safe_load=True,
                    return_metadata=True,
                )
            )

        except TypeError:
            # Совместимость с версиями ComfyUI,
            # не поддерживающими return_metadata.
            lora_data = comfy.utils.load_torch_file(
                lora_path,
                safe_load=True,
            )
            lora_metadata = None

        # Для этой ноды достаточно кэшировать максимум
        # пять последних использованных файлов.
        if len(self.loaded_loras) >= 5:
            oldest_path = next(iter(self.loaded_loras))
            del self.loaded_loras[oldest_path]

        self.loaded_loras[lora_path] = (
            modified_time,
            lora_data,
            lora_metadata,
        )

        return lora_data, lora_metadata

    @staticmethod
    def _apply_one_lora(
        model,
        lora_data,
        lora_metadata,
        strength,
    ):
        """
        Применяет LoRA только к diffusion MODEL.

        CLIP передаётся как None, а его сила равна 0.
        """

        try:
            patched_model, _ = comfy.sd.load_lora_for_models(
                model,
                None,
                lora_data,
                strength,
                0.0,
                lora_metadata=lora_metadata,
            )

        except TypeError:
            # Совместимость с более старыми версиями ComfyUI.
            patched_model, _ = comfy.sd.load_lora_for_models(
                model,
                None,
                lora_data,
                strength,
                0.0,
            )

        return patched_model

    def apply_loras(
        self,
        model,
        slot_1_enabled,
        slot_1_lora,
        slot_1_strength,
        slot_2_enabled,
        slot_2_lora,
        slot_2_strength,
        slot_3_enabled,
        slot_3_lora,
        slot_3_strength,
        slot_4_enabled,
        slot_4_lora,
        slot_4_strength,
        slot_5_enabled,
        slot_5_lora,
        slot_5_strength,
    ):
        slots = [
            (
                1,
                slot_1_enabled,
                slot_1_lora,
                slot_1_strength,
            ),
            (
                2,
                slot_2_enabled,
                slot_2_lora,
                slot_2_strength,
            ),
            (
                3,
                slot_3_enabled,
                slot_3_lora,
                slot_3_strength,
            ),
            (
                4,
                slot_4_enabled,
                slot_4_lora,
                slot_4_strength,
            ),
            (
                5,
                slot_5_enabled,
                slot_5_lora,
                slot_5_strength,
            ),
        ]

        current_model = model
        active_count = 0

        for (
            slot_number,
            enabled,
            lora_name,
            strength,
        ) in slots:
            # Полностью выключенный слот пропускается.
            if not enabled:
                continue

            # Включённый слот без выбранного файла
            # также безопасно пропускается.
            if lora_name == NO_LORA:
                logging.warning(
                    "[H3 LoRA Selector] Slot %s is enabled, "
                    "but no LoRA is selected.",
                    slot_number,
                )
                continue

            # Нулевой вес ничего не меняет.
            if float(strength) == 0.0:
                logging.info(
                    "[H3 LoRA Selector] Slot %s has zero "
                    "strength and was skipped.",
                    slot_number,
                )
                continue

            logging.info(
                "[H3 LoRA Selector] Applying slot %s: "
                "%s, strength=%.2f",
                slot_number,
                lora_name,
                float(strength),
            )

            try:
                lora_data, lora_metadata = (
                    self._load_lora_file(lora_name)
                )

                patched_model = self._apply_one_lora(
                    model=current_model,
                    lora_data=lora_data,
                    lora_metadata=lora_metadata,
                    strength=float(strength),
                )

                if patched_model is None:
                    raise RuntimeError(
                        "ComfyUI returned an empty MODEL."
                    )

                current_model = patched_model
                active_count += 1

            except Exception:
                logging.exception(
                    "[H3 LoRA Selector] Error in slot %s: %s",
                    slot_number,
                    lora_name,
                )

                # Ошибка одной LoRA не отменяет остальные.
                continue

        if active_count == 0:
            logging.info(
                "[H3 LoRA Selector] No active LoRA. "
                "The original model was returned."
            )
        else:
            logging.info(
                "[H3 LoRA Selector] Finished. "
                "Applied LoRA files: %s.",
                active_count,
            )

        return (current_model,)