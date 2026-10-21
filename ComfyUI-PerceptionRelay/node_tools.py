# -*- coding: utf-8 -*-
"""Служебные ноды: Журнал (отчёты текстом) и Превью (кадры, сравнение, маски, карта изменений)."""
import numpy as np
import torch

from . import core_io, core_journal, core_ops
from .node_scout import load_faces


class RelayJournal:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("текст",)
    OUTPUT_NODE = True
    DESCRIPTION = "Показывает бортовой журнал: что делал каждый этап и как."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"relay": ("RELAY",)}}

    @classmethod
    def IS_CHANGED(cls, relay):
        return float("nan")  # журнал всегда перечитываем

    def run(self, relay):
        text = core_journal.render_text(relay)
        return {"ui": {"text": [text]}, "result": (text,)}


MODES = ["vs source / сравнение с исходником", "current / текущее", "attention masks / маски точек внимания",
         "judge change map / карта изменений судьи"]


class RelayPreview:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("кадры",)
    DESCRIPTION = "Несколько кадров текущего этапа: как есть, рядом с исходником, маски или карта изменений."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "mode": (MODES, {"default": MODES[0]}),
            "count": ("INT", {"default": 4, "min": 1, "max": 16}),
            "crop_to_face": ("BOOLEAN", {"default": False,
                                         "tooltip": "Показать крупно область вокруг первого лица"}),
        }}

    def run(self, relay, mode, count, crop_to_face):
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        n = relay["current"].get("frames", v["frames"])
        ts = relay["current"].get("time_scale", 1)
        idx = sorted(set(int(round(i)) for i in np.linspace(0, n - 1, count)))
        cur = relay["current"]
        frames = core_io.read_frames_at(cur["path"], w, h, idx, cur["kind"], v["matrix"], v["range"])
        src_idx = {i: min(int(round(i / ts)), v["frames"] - 1) for i in idx}
        faces = load_faces(relay)
        src = None
        if mode == MODES[0]:
            raw = core_io.read_frames_at(core_journal.stage_path(relay, "source.mkv"), w, h,
                                         list(src_idx.values()), "yuv", v["matrix"], v["range"])
            src = {i: raw[j] for i, j in src_idx.items() if j in raw}
        change = None
        if mode == MODES[3]:
            rep = core_journal.report(relay, "judge")
            if rep:
                change = np.load(rep["files"]["change"], mmap_mode="r")
        out = []
        for i in idx:
            if i not in frames:
                continue
            f = frames[i]
            if mode == MODES[2]:
                x = torch.from_numpy(f).permute(2, 0, 1)[None]
                eyes, face, ring = core_ops.face_masks(faces.get(src_idx[i]) if faces else None, h, w, x.device)
                dark = x * 0.45
                tint = torch.cat([ring, eyes, face * 0.35], 1)
                f = (dark + tint * 0.8).clamp(0, 1)[0].permute(1, 2, 0).numpy()
            elif mode == MODES[3]:
                if change is not None and src_idx[i] < change.shape[0]:
                    m = torch.from_numpy(change[src_idx[i]].astype(np.float32) / 255.0)[None, None]
                    m = torch.nn.functional.interpolate(m, size=(h, w), mode="bilinear")[0, 0].numpy()
                    gray = f.mean(2, keepdims=True) * 0.5
                    heat = np.stack([m, m * 0.6, np.zeros_like(m)], 2)
                    f = np.clip(gray + heat, 0, 1)
            if crop_to_face and faces and src_idx[i] in faces:
                fx, fy, fw, fh = faces[src_idx[i]][0][:4]
                cx, cy = fx + fw / 2, fy + fh / 2
                side = int(max(fw, fh) * 2.2)
                x0 = int(np.clip(cx - side / 2, 0, max(0, w - side)))
                y0 = int(np.clip(cy - side / 2, 0, max(0, h - side)))
                crop = lambda a: a[y0:y0 + side, x0:x0 + side]
                f = crop(f)
                if src is not None and i in src:
                    src[i] = crop(src[i])
            if src is not None and i in src:
                s = src[i]
                gap = np.ones((f.shape[0], 6, 3), np.float32)
                f = np.concatenate([s, gap, f], 1)
            out.append(f)
        # кадры могут быть разного размера при кропе — выравниваем по первому
        H, W = out[0].shape[:2]
        fixed = []
        for f in out:
            if f.shape[:2] != (H, W):
                t = torch.from_numpy(np.ascontiguousarray(f)).permute(2, 0, 1)[None]
                f = torch.nn.functional.interpolate(t, size=(H, W), mode="bilinear")[0].permute(1, 2, 0).numpy()
            fixed.append(f)
        return (torch.from_numpy(np.stack(fixed)).float(),)
