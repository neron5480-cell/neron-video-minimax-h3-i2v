# -*- coding: utf-8 -*-
"""🎬 Neron H3 Story — длинный ролик MiniMax H3 цепочкой блоков / long MiniMax H3 video as a chain of blocks.
Ноды: движок, 🎞 Блок, 🎨 Набор LoRA (и Story AutoPrompter — следующим шагом)."""
from . import block_node, lora_pack, node

NODE_CLASS_MAPPINGS = {**node.NODE_CLASS_MAPPINGS, **block_node.NODE_CLASS_MAPPINGS, **lora_pack.NODE_CLASS_MAPPINGS}
NODE_DISPLAY_NAME_MAPPINGS = {**node.NODE_DISPLAY_NAME_MAPPINGS, **block_node.NODE_DISPLAY_NAME_MAPPINGS,
                              **lora_pack.NODE_DISPLAY_NAME_MAPPINGS}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
