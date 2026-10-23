# -*- coding: utf-8 -*-
"""
Neron pack loader / Загрузчик пакета Neron

RU: Нужен, чтобы весь репозиторий ставился одной ссылкой:
    ComfyUI Manager -> Install via Git URL. ComfyUI сам видит только папки
    прямо в custom_nodes, а ноды Neron лежат внутри пакета. Этот файл находит
    их, загружает и подключает их оформление (папки web).

    Защита от дублей:
      * если нода уже стоит отдельно в custom_nodes (ручная установка),
        копия из пакета пропускается;
      * если имя ноды уже занято, пакетная копия пропускается целиком,
        а в консоли появляется предупреждение.

    При ручной установке (папки скопированы прямо в custom_nodes) этот файл
    не участвует и ничего не меняет.

EN: Lets the whole repository be installed with one link:
    ComfyUI Manager -> Install via Git URL. ComfyUI only sees folders placed
    directly in custom_nodes, while Neron nodes live inside the pack. This file
    finds them, loads them and registers their web (JS) folders.

    Duplicate protection:
      * a node already installed on its own in custom_nodes is skipped;
      * if a node name is already taken, the pack copy is skipped and a
        warning is printed.

    With a manual install (folders copied straight into custom_nodes) this
    file is not involved.
"""

import os
import sys
import importlib.util
import traceback

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

_TAG = "[Neron pack]"
_ROOT = os.path.dirname(os.path.abspath(__file__))

# Старые имена папок: если нода стоит отдельно под старым именем, пакетную копию
# не грузим. Old folder names of the same node.
_ALIASES = {
    "ComfyUI-NeronH3Engine": ["NeronH3Engine Full", "NeronH3Engine"],
}


def _custom_nodes_dirs():
    dirs = [os.path.dirname(_ROOT)]
    try:
        import folder_paths
        for d in folder_paths.get_folder_paths("custom_nodes"):
            d = os.path.abspath(d)
            if d not in dirs:
                dirs.append(d)
    except Exception:
        pass
    return dirs


def _is_pkg(path):
    return os.path.isfile(os.path.join(path, "__init__.py"))


def _visible(name):
    return not name.startswith((".", "_"))


def _find_packages():
    """Сначала ноды верхнего уровня, потом ноды внутри папок-наборов
    (например, Neron_Studio_H3). Top-level nodes first, then nodes inside
    bundle folders."""
    top, nested = [], []
    for entry in sorted(os.listdir(_ROOT), key=str.lower):
        p = os.path.join(_ROOT, entry)
        if not _visible(entry) or not os.path.isdir(p):
            continue
        if _is_pkg(p):
            top.append(p)
            continue
        for sub in sorted(os.listdir(p), key=str.lower):
            sp = os.path.join(p, sub)
            if _visible(sub) and os.path.isdir(sp) and _is_pkg(sp):
                nested.append(sp)
    return top + nested


def _installed_separately(name):
    names = [name] + _ALIASES.get(name, [])
    for d in _custom_nodes_dirs():
        for n in names:
            p = os.path.join(d, n)
            if os.path.abspath(p) != os.path.abspath(_ROOT) and os.path.isdir(p):
                return n
    return None


def _taken_names():
    taken = set(NODE_CLASS_MAPPINGS)
    try:
        import nodes  # ComfyUI
        taken |= set(nodes.NODE_CLASS_MAPPINGS)
    except Exception:
        pass
    return taken


def _register_web(module, pkg_path, key):
    web = getattr(module, "WEB_DIRECTORY", None)
    if not web:
        return
    web_path = os.path.abspath(os.path.join(pkg_path, web))
    if not os.path.isdir(web_path):
        return
    try:
        import nodes  # ComfyUI
        # Ключ = имя папки, поэтому адреса /extensions/<папка>/ такие же,
        # как при ручной установке. Key = folder name: same URLs as a manual install.
        nodes.EXTENSION_WEB_DIRS[key] = web_path
    except Exception:
        print(f"{_TAG} web folder not registered / web-папка не подключена: {web_path}")


def _load(pkg_path):
    name = os.path.basename(pkg_path)

    found = _installed_separately(name)
    if found:
        print(f"{_TAG} skip '{name}': already installed as custom_nodes/{found} "
              f"/ уже установлена отдельно")
        return None

    mod_name = "neron_pack." + "".join(c if c.isalnum() else "_" for c in name)
    spec = importlib.util.spec_from_file_location(
        mod_name,
        os.path.join(pkg_path, "__init__.py"),
        submodule_search_locations=[pkg_path],
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(mod_name, None)
        raise

    classes = dict(getattr(module, "NODE_CLASS_MAPPINGS", {}) or {})
    names = dict(getattr(module, "NODE_DISPLAY_NAME_MAPPINGS", {}) or {})

    clash = sorted(set(classes) & _taken_names())
    if clash:
        print(f"{_TAG} skip '{name}': node name already taken / имя ноды уже занято: "
              f"{', '.join(clash)}. Remove the old copy from custom_nodes "
              f"/ удалите старую копию из custom_nodes.")
        return None

    NODE_CLASS_MAPPINGS.update(classes)
    NODE_DISPLAY_NAME_MAPPINGS.update(names)
    _register_web(module, pkg_path, name)
    return len(classes)


# Пустой родительский модуль для имён вида neron_pack.<нода>
# Empty parent module for neron_pack.<node> names.
if "neron_pack" not in sys.modules:
    import types
    _parent = types.ModuleType("neron_pack")
    _parent.__path__ = []
    sys.modules["neron_pack"] = _parent

_ok, _fail = [], []
for _p in _find_packages():
    _n = os.path.basename(_p)
    try:
        _count = _load(_p)
        if _count:
            _ok.append(f"{_n} ({_count})")
    except Exception:
        _fail.append(_n)
        print(f"{_TAG} FAILED / ОШИБКА: {_n}")
        traceback.print_exc()

print(f"{_TAG} loaded / загружено: {', '.join(_ok) if _ok else '-'}")
if _fail:
    print(f"{_TAG} failed / не загрузились: {', '.join(_fail)}")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
