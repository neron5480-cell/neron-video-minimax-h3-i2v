# -*- coding: utf-8 -*-
"""
Neron Stage — Площадка режиссёра / Director's Stage.

RU: Нода-площадка. На холсте: объёмная сцена из фото, скелет-дублёр, точки
    маршрута с подсказками и камера. По нажатию «Очередь» нода отдаёт:
      * pose_video — видео «скелета позы» (OpenPose) глазами камеры, для H3 Fun ControlNet;
      * storyboard — раскадровку по секундам (в автопромтер или прямо в промт);
      * frames / fps / width / height — числа для генератора;
      * scene / actor — те же фото, проводами дальше (образцы для H3).
EN: The director's stage node. Outputs a pose (OpenPose) video seen through the
    stage camera, a per-second storyboard, numbers for the generator and the
    scene/actor photos passed through.
"""

import json
import os

from . import stage_core as core

try:
    from server import PromptServer
    from aiohttp import web
except Exception:          # проверка вне ComfyUI / outside ComfyUI
    PromptServer = None

# размеры кратны 32 — как требует генератор H3 / multiples of 32, as the H3 generator needs
ASPECTS = {"16:9": (1280, 704), "9:16": (704, 1280), "1:1": (960, 960), "4:3": (1024, 768), "3:4": (768, 1024)}


def _default_state():
    return {
        "v": 1, "seconds": 5, "aspect": "16:9", "env": "outdoor", "photo_fov": 60, "actor_h": 1.7,
        "points": [{"x": 0.0, "z": -4.0, "pose": "stand", "text": ""}],
        "camera": {"pos": [0.0, 1.6, 0.0], "target": [0.0, 1.0, -4.0], "fov": 45, "preset": "photo"},
    }


def _size(state):
    w, h = ASPECTS.get(state.get("aspect", "16:9"), ASPECTS["16:9"])
    q = float(state.get("quality", 1.0) or 1.0)          # эксперт: масштаб размера
    w, h = int(w * q / 32 + 0.5) * 32, int(h * q / 32 + 0.5) * 32
    return max(256, w), max(256, h)


class NeronStage:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "stage_json": ("STRING", {"default": json.dumps(_default_state()), "multiline": False}),
            },
            "optional": {
                "scene": ("IMAGE", {"tooltip": "Фото сцены (Load Image) / Scene photo (Load Image)"}),
                "actor": ("IMAGE", {"tooltip": "Фото героя (Load Image) / Character photo (Load Image)"}),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "INT", "INT", "INT", "INT", "IMAGE", "IMAGE")
    RETURN_NAMES = ("pose_video", "storyboard", "frames", "fps", "width", "height", "scene", "actor")
    OUTPUT_TOOLTIPS = (
        "Видео скелета позы глазами камеры (для H3 Fun ControlNet) / Pose skeleton video from the stage camera",
        "Раскадровка по секундам — в автопромтер / Per-second storyboard — for the autoprompter",
        "Число кадров (сетка H3: 17·n+5) / Frame count (H3 grid 17·n+5)",
        "Кадров в секунду / Frames per second",
        "Ширина кадра / Frame width",
        "Высота кадра / Frame height",
        "Фото сцены — дальше как образец / Scene photo, passed on as a reference",
        "Фото героя — дальше как образец / Character photo, passed on as a reference",
    )
    FUNCTION = "run"
    CATEGORY = "Neron/Stage"
    DESCRIPTION = ("Площадка режиссёра: сцена из фото, скелет по точкам, камера → видео позы и раскадровка. "
                   "/ Director's stage: scene from a photo, skeleton along points, camera → pose video and storyboard.")

    def run(self, stage_json, scene=None, actor=None):
        import torch
        try:
            state = json.loads(stage_json or "{}")
        except Exception:
            raise ValueError("Площадка: испорчены данные сцены, нажмите «Новая сцена». "
                             "/ Stage: scene data is broken, press “New scene”.")
        if not state.get("points"):
            raise ValueError("Площадка: поставьте хотя бы одну точку. / Stage: place at least one point.")
        w, h = _size(state)
        try:
            import comfy.utils
            bar = comfy.utils.ProgressBar(core.frames_for(state.get("seconds", 5)))
            progress = lambda i, n: bar.update_absolute(i, n)
        except Exception:
            progress = None
        frames, n = core.render_pose_video(state, w, h, core.FPS, progress)
        empty = torch.zeros((1, 64, 64, 3))
        return (torch.from_numpy(frames), core.storyboard(state), int(n), core.FPS, w, h,
                scene if scene is not None else empty, actor if actor is not None else empty)


# ---------------------------------------------------------------- адреса для интерфейса
def _image_path(spec):
    import folder_paths
    name = str(spec.get("name", "")).replace("\\", "/")
    sub = str(spec.get("subfolder", "")).replace("\\", "/")
    kind = spec.get("type", "input")
    if kind not in ("input", "output", "temp") or ".." in name.split("/") + sub.split("/"):
        raise ValueError("bad path")
    base = folder_paths.get_directory_by_type(kind)
    p = os.path.abspath(os.path.join(base, sub, name))
    if not p.startswith(os.path.abspath(base)) or not os.path.isfile(p):
        raise FileNotFoundError(name)
    return p


if PromptServer is not None:
    routes = PromptServer.instance.routes

    @routes.post("/neron/stage/depth")
    async def _depth(request):
        import asyncio
        from . import stage_depth
        try:
            body = await request.json()
            path = _image_path(body.get("image") or {})
            env = body.get("env", "outdoor")
            fov = float(body.get("fov", 60))
            loop = asyncio.get_running_loop()
            out = await loop.run_in_executor(None, stage_depth.build, path, env, fov)
            return web.json_response(out)
        except FileNotFoundError:
            return web.json_response({"ok": False, "error": "Фото не найдено / Photo not found"})
        except ImportError as e:
            return web.json_response({"ok": False, "error":
                f"Не хватает библиотеки ({e}). Обновите ComfyUI. / Missing library ({e}). Update ComfyUI."})
        except Exception as e:
            msg = str(e)
            low = msg.lower()
            if any(k in low for k in ("connect", "resolve", "huggingface", "timed out", "offline", "ssl")):
                msg = ("Не удалось скачать модель глубины — нужен интернет при первом запуске. "
                       "/ Could not download the depth model — internet is needed the first time.")
            return web.json_response({"ok": False, "error": msg})


NODE_CLASS_MAPPINGS = {"NeronStage": NeronStage}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronStage": "🎬 Neron Stage / Площадка"}
