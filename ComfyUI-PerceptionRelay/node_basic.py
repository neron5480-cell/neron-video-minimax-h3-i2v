# -*- coding: utf-8 -*-
"""Основное: общая яркость, контраст, резкость и насыщенность всей картинки — просто и понятно."""
import time

import torch

from . import core_io, core_journal, core_comfy, core_ops, core_frame


class RelayBasic:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Яркость, контраст, резкость, насыщенность всей картинки."

    @classmethod
    def INPUT_TYPES(cls):
        Z = {"min": -1.0, "max": 1.0, "step": 0.01}
        return {"required": {
            "relay": ("RELAY",),
            "brightness": ("FLOAT", {"default": 0.0, **Z,
                                     "tooltip": "Яркость: + светлее, − темнее. Чёрное и белое остаются на месте"}),
            "contrast": ("FLOAT", {"default": 0.0, **Z,
                                   "tooltip": "Контраст: + сочнее, − мягче. Света и тени не обрезаются"}),
            "sharpness": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                                    "tooltip": "Резкость всей картинки, без ореолов. Внимание: поднимает и дрожь фактуры"}),
            "saturation": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01,
                                     "tooltip": "Насыщенность: 1 — как есть, 0 — ч/б"}),
        }}

    def run(self, relay, brightness, contrast, sharpness, saturation):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h = core_journal.size(relay)
        cur = relay["current"]
        n = cur.get("frames", v["frames"])
        dev = core_ops.device()
        P = {"brightness": brightness, "contrast": contrast, "sharpness": sharpness, "saturation": saturation}
        out_path = core_journal.stage_path(relay, "basic.mkv")
        writer = core_io.FrameWriter(out_path, w, h, cur.get("fps", v["fps"]), "lossless",
                                     log_path=core_journal.stage_path(relay, "ffmpeg.log"))
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                writer.write(core_ops.to_np(core_frame.basic_frame(core_ops.to_t(frame, dev), P)))
                bar.step()
        writer.close()
        new_cur = dict(cur)
        new_cur.update({"path": out_path, "kind": "rgb"})
        relay = core_journal.advance(relay, "basic", new_cur)
        core_journal.write_stage(relay, "basic", P,
                                 [f"Яркость {brightness:+.2f}, контраст {contrast:+.2f}, "
                                  f"резкость {sharpness:.2f}, насыщенность ×{saturation:.2f}"],
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
