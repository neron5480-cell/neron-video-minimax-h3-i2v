from .h3_lora_selector import H3LoraSelector


NODE_CLASS_MAPPINGS = {
    "H3LoraSelector5": H3LoraSelector,
}


NODE_DISPLAY_NAME_MAPPINGS = {
    "H3LoraSelector5": "H3 LoRA Selector - 5 Slots",
}


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]