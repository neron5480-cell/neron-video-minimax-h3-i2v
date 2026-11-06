# -*- coding: utf-8 -*-
"""🖼 Neron H3 Кадры — все картинки ролика одним проводом в 📝 Story AutoPrompter:
первый кадр, два промежуточных (навигаторы) и последний кадр."""
from . import bus


class NeronH3Frames:
    CATEGORY = "Neron/H3"
    FUNCTION = "make"
    RETURN_TYPES = (bus.FRAMES_TYPE,)
    RETURN_NAMES = ("frames",)
    DESCRIPTION = ("Кадры ролика одним проводом: первый, два промежуточных и последний — в 📝 Story AutoPrompter. "
                   "Video frames in one wire: first, two middle and last — into the Story AutoPrompter.")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "first_frame": ("IMAGE", {"tooltip": "С чего начинается ролик. Он же образец внешности <Picture 1> во "
                                                     "всех блоках.\n\nEN: The opening frame, also the appearance "
                                                     "reference <Picture 1> in every block."}),
                "mid_frame_1": ("IMAGE", {"tooltip": "Промежуточный кадр — что появится по ходу ролика (место, существо, "
                                                     "предмет). Когда — решит AutoPrompter по сценарию.\n\nEN: A middle "
                                                     "picture — what appears during the video; the AutoPrompter "
                                                     "decides when, by the scenario."}),
                "mid_frame_2": ("IMAGE", {"tooltip": "Ещё один промежуточный кадр.\n\nEN: Another middle picture."}),
                "last_frame": ("IMAGE", {"tooltip": "Чем ролик должен закончиться — прикалывается к самому последнему "
                                                    "кадру. Ставь кадр той же сцены и ракурса.\n\nEN: How the video must "
                                                    "end — pinned to its very last frame. Use a frame of the same scene "
                                                    "and angle."}),
            },
        }

    def make(self, first_frame=None, mid_frame_1=None, mid_frame_2=None, last_frame=None):
        f = bus.frames(first_frame, (mid_frame_1, mid_frame_2), last_frame)
        parts = [nm for nm, img in (("первый", first_frame), ("промеж. 1", mid_frame_1), ("промеж. 2", mid_frame_2),
                                    ("последний", last_frame)) if img is not None]
        return {"ui": {"text": [" · ".join(parts) + " ✔" if parts else "кадров нет / no frames"]}, "result": (f,)}


NODE_CLASS_MAPPINGS = {"NeronH3Frames": NeronH3Frames}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Frames": "🖼 Neron H3 Кадры / Frames"}
