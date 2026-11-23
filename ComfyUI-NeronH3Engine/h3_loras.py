"""RU: Аккуратный слой дополнительных лор для одного движка H3.

EN: A careful extra-LoRA layer for the single H3 engine.

RU: Пять независимых слотов, свой вес, порядок применения и маленький кэш.
    Лоры идут только на модель_; текст не трогается. Один плохой файл
    пропускается молча, остальные слои продолжают работать.
"""

from __future__ import annotations

import os

import comfy.sd
import comfy.utils
import folder_paths

from .h3_catalog import AUTO, NONE

MAX_CACHE = 5


def _wanted(slot: dict) -> tuple[str, float] | None:
    if not isinstance(slot, dict) or not slot.get("enabled"):
        return None
    name = str(slot.get("name") or "").strip()
    if not name or name in (NONE, AUTO):
        return None
    try:
        weight = float(slot.get("strength", 1.0))
    except Exception:
        weight = 1.0
    if weight == 0.0:
        return None
    return name, weight


class LoraStack:
    def __init__(self, status=None):
        self.cache: dict[str, tuple[float, dict, object]] = {}
        self.status = status or (lambda *a: None)

    def _load(self, name: str):
        path = folder_paths.get_full_path_or_raise("loras", name)
        changed = os.path.getmtime(path)
        hit = self.cache.get(path)
        if hit and hit[0] == changed:
            return hit[1], hit[2]
        try:
            data, meta = comfy.utils.load_torch_file(
                path, safe_load=True, return_metadata=True
            )
        except TypeError:
            data = comfy.utils.load_torch_file(path, safe_load=True)
            meta = None
        if len(self.cache) >= MAX_CACHE:
            self.cache.pop(next(iter(self.cache)))
        self.cache[path] = (changed, data, meta)
        return data, meta

    def apply(self, model, slots: list[dict]):
        current = model
        names = []
        for index, slot in enumerate(slots or [], 1):
            wanted = _wanted(slot)
            if not wanted:
                continue
            name, weight = wanted
            try:
                data, meta = self._load(name)
                try:
                    current, _ = comfy.sd.load_lora_for_models(
                        current, None, data, weight, 0.0,
                        lora_metadata=meta,
                    )
                except TypeError:
                    current, _ = comfy.sd.load_lora_for_models(
                        current, None, data, weight, 0.0
                    )
                if current is None:
                    raise RuntimeError("Empty model")
                names.append(name)
                self.status(slot.get("index", index), name, weight, True)
            except Exception:
                self.status(slot.get("index", index), name, weight, False)
        return current, names
