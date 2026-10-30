# -*- coding: utf-8 -*-
"""Общий код Neron в одном месте / Shared Neron code in one place.

RU: Загрузка картинки (размер) и цвет с апскейлом живут в ОДНОМ месте — в папке
    ComfyUI-Interactive-Processor. Этот файл находит её рядом (в пакете Neron или
    в custom_nodes) и отдаёт код нодам Smart Load, Color Panel и Studio Image Processor.
    Так исправление сразу работает во всех нодах, а не в одной из трёх копий.
    Так же — камера H3 (папка ComfyUI-H3-Static-Camera) для AutoPrompter.
EN: Image loading and color/upscale live in ONE place — ComfyUI-Interactive-Processor.
    This file finds it next door (in the Neron pack or custom_nodes) and shares the code.
"""
import importlib.util
import os
import sys

CORE_DIR = "ComfyUI-Interactive-Processor"
FILES = {"loader": "my_smart_load_image.py", "color": "my_turbo_color_fix.py"}
PACK_DIR = "neron-video-minimax-h3-i2v"


def _candidates(folder_name):
    d = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):
        d = os.path.dirname(d)
        yield os.path.join(d, folder_name)
        yield os.path.join(d, "Neron_Studio_H3", folder_name)
        yield os.path.join(d, PACK_DIR, folder_name)
        yield os.path.join(d, PACK_DIR, "Neron_Studio_H3", folder_name)
    try:
        import folder_paths
        for root in folder_paths.get_folder_paths("custom_nodes"):
            yield os.path.join(root, folder_name)
            for sub in sorted(os.listdir(root)):
                yield os.path.join(root, sub, folder_name)
                yield os.path.join(root, sub, "Neron_Studio_H3", folder_name)
    except Exception:
        pass


def load(part):
    """part = "loader" или "color" → модуль с MySmartLoadImage / MyTurboColorFix."""
    return load_file(CORE_DIR, FILES[part], "neron_image_core_" + part)


def load_camera():
    """Камера H3 (MyH3StaticCamera) из папки ComfyUI-H3-Static-Camera."""
    return load_file("ComfyUI-H3-Static-Camera", "h3_static_camera.py", "neron_h3_static_camera")


def load_file(folder_name, file_name, name):
    if name in sys.modules:
        return sys.modules[name]
    here = os.path.dirname(os.path.abspath(__file__))
    own = os.path.join(here, file_name)
    if os.path.basename(here) == folder_name and os.path.isfile(own):
        candidates = [here]
    else:
        candidates = _candidates(folder_name)
    for folder in candidates:
        path = os.path.join(folder, file_name)
        if os.path.isfile(path):
            spec = importlib.util.spec_from_file_location(name, path)
            module = importlib.util.module_from_spec(spec)
            sys.modules[name] = module
            try:
                spec.loader.exec_module(module)
            except Exception:
                sys.modules.pop(name, None)
                raise
            return module
    raise ImportError(
        f"[Neron] Не найдена папка {folder_name} (общий код Neron). Она входит в пакет Neron: поставьте "
        f"пакет целиком (Manager → Install via Git URL) или скопируйте эту папку в custom_nodes рядом. / "
        f"{folder_name} (shared Neron code) not found: install the whole Neron pack or copy that folder "
        f"into custom_nodes.")


PROMPTS_HOME = "NeronStudio-AutoPrompter"   # единственная папка с системными промптами Neron


def shared_prompts_dir():
    """Папка с системными промптами Neron (одна на все ноды) или None.
    The one folder with Neron system prompts, or None."""
    here = os.path.dirname(os.path.abspath(__file__))
    if os.path.basename(here) == PROMPTS_HOME and os.path.isdir(os.path.join(here, "prompts")):
        return os.path.join(here, "prompts")
    for folder in _candidates(PROMPTS_HOME):
        p = os.path.join(folder, "prompts")
        if os.path.isdir(p):
            return p
    return None


def find_folder(folder_name):
    """Папка соседней ноды Neron (в пакете или в custom_nodes) или None.
    A neighbouring Neron node folder (in the pack or custom_nodes), or None."""
    here = os.path.dirname(os.path.abspath(__file__))
    if os.path.basename(here) == folder_name:
        return here
    for folder in _candidates(folder_name):
        if os.path.isdir(folder):
            return folder
    return None
