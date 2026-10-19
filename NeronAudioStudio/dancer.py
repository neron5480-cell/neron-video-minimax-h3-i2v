# ----------------------------------------------------------------------------
#  Neron Dancer - просто для настроения: маленькая героиня на рабочем столе,
#  которая слушает звук Neron-нод и танцует под музыку. Никуда не подключается
#  и ничего не считает.
# ----------------------------------------------------------------------------

PALETTES = ["розовая", "голубая", "сиреневая", "рыжая", "серебро"]


class NeronDancer:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "palette": (PALETTES, {"default": PALETTES[0]}),
                "energy": ("FLOAT", {"default": 1.0, "min": 0.2, "max": 2.0, "step": 0.05}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "NeronAudio"

    def noop(self, palette, energy):
        return ()


NODE_CLASS_MAPPINGS = {"NeronDancer": NeronDancer}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronDancer": "Neron Dancer"}
