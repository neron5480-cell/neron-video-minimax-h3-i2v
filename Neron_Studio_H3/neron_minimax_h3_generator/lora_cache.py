# -*- coding: utf-8 -*-
"""
Кэш LoRA для движка H3.

LoRA — маленькие файлы (50–500 МБ), их кэш безопасен.
UNET / CLIP / VAE — большие, их не кэшируем никогда.
"""

import logging
import os

import comfy.sd
import comfy.utils
import folder_paths


log = logging.getLogger("Neron.H3.LoRA")

NO_LORA = "None / Не выбрано"
MAX_CACHE = 5


class LoRACache:
    """Кэширует до 5 LoRA-файлов с проверкой mtime."""

    def __init__(self):
        self._cache = {}

    def load(self, lora_name: str):
        """Загружает LoRA-файл (или берёт из кэша)."""
        if lora_name == NO_LORA:
            raise ValueError("LoRA не выбрана.")

        path = folder_paths.get_full_path_or_raise("loras", lora_name)
        mtime = os.path.getmtime(path)

        cached = self._cache.get(path)
        if cached and cached[0] == mtime:
            return cached[1], cached[2]

        # Файл обновился — перечитываем.
        if cached:
            del self._cache[path]

        try:
            data, meta = comfy.utils.load_torch_file(
                path, safe_load=True, return_metadata=True,
            )
        except TypeError:
            # Старые версии ComfyUI без return_metadata.
            data = comfy.utils.load_torch_file(path, safe_load=True)
            meta = None

        # Ограничиваем кэш.
        if len(self._cache) >= MAX_CACHE:
            self._cache.pop(next(iter(self._cache)))

        self._cache[path] = (mtime, data, meta)
        log.info("[H3 LoRA] Загружено: %s", lora_name)
        return data, meta

    @staticmethod
    def apply(model, data, meta, strength: float):
        """Применяет LoRA только к MODEL. CLIP не трогаем."""
        try:
            patched, _ = comfy.sd.load_lora_for_models(
                model, None, data, strength, 0.0,
                lora_metadata=meta,
            )
        except TypeError:
            patched, _ = comfy.sd.load_lora_for_models(
                model, None, data, strength, 0.0,
            )
        return patched


_lora_cache = LoRACache()


def get_lora_cache() -> LoRACache:
    return _lora_cache