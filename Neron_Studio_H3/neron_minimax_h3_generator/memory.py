# -*- coding: utf-8 -*-
"""
Управление памятью для движка H3.

Принцип: "гострабайтер" — пришёл, сделал, ушёл.
Между этапами пайплайна освобождаем всё, что больше не нужно.
Внутрь сэмплера и VAE-декода не лезем.
"""

import gc
import logging

import torch

import comfy.model_management


log = logging.getLogger("Neron.H3.Memory")


def free_between_stages(reason: str = ""):
    """
    Освобождает VRAM и RAM между этапами пайплайна.

    Вызывается только там, где точно знаем: предыдущий
    этап свою работу закончил, следующий — ещё не начал.
    """
    if reason:
        log.info("[H3 Memory] Free: %s", reason)

    try:
        comfy.model_management.unload_all_models()
    except Exception as error:
        log.warning("[H3 Memory] unload_all_models failed: %s", error)

    try:
        comfy.model_management.soft_empty_cache()
    except Exception as error:
        log.warning("[H3 Memory] soft_empty_cache failed: %s", error)

    gc.collect()

    if torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        except Exception as error:
            log.warning("[H3 Memory] cuda cleanup failed: %s", error)


def vram_free_gb() -> float:
    """Сколько VRAM свободно прямо сейчас (в гигабайтах)."""
    if not torch.cuda.is_available():
        return 0.0
    try:
        free_bytes, _ = torch.cuda.mem_get_info()
        return free_bytes / (1024 ** 3)
    except Exception:
        return 0.0


def log_vram(tag: str):
    """Логирует текущее состояние VRAM — для отладки."""
    if torch.cuda.is_available():
        try:
            free_gb = vram_free_gb()
            total_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
            used_gb = total_gb - free_gb
            log.info(
                "[H3 Memory] %s | VRAM: %.1f / %.1f GB (free %.1f)",
                tag, used_gb, total_gb, free_gb,
            )
        except Exception:
            pass