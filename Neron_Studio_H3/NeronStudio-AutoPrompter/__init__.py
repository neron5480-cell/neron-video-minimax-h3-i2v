# -*- coding: utf-8 -*-
"""
🎬 Neron AutoPrompter (Neron Studio H3)

RU: Здесь регистрируется только Neron AutoPrompter.
    dialog_node.py и multi_llm.py остаются в папке как подсобный код
    (AutoPrompter берёт из них функции), но как ноды НЕ регистрируются.
    Самостоятельные Dialog Autoprompter и Multi-Image LLM живут в папке
    neron_dialog_autoprompter в корне репозитория.

EN: Only Neron AutoPrompter is registered here.
    dialog_node.py and multi_llm.py stay as helper code (AutoPrompter uses
    their functions) but are NOT registered as nodes. The standalone
    Dialog Autoprompter and Multi-Image LLM live in the
    neron_dialog_autoprompter folder at the repository root.
"""
import os

# Сказать dialog_node.py, что HTTP-адреса /neron_dialog/* ему регистрировать не нужно:
# их регистрирует самостоятельный Dialog Autoprompter. Иначе две копии спорят.
# Tell dialog_node.py not to register the /neron_dialog/* routes:
# the standalone Dialog Autoprompter owns them.
os.environ["NERON_STUDIO_NO_DIALOG_ROUTES"] = "1"

from .autoprompter import NeronAutoPrompter  # noqa: E402

WEB_DIRECTORY = "./web"

NODE_CLASS_MAPPINGS = {
    "NeronAutoPrompter": NeronAutoPrompter,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronAutoPrompter": "🎬 Neron AutoPrompter",
}

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
