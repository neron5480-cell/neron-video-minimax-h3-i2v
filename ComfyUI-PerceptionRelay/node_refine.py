# -*- coding: utf-8 -*-
"""Доводчик: процесс после процесса. Берёт уже вылизанный кадр, сам находит расплывшиеся детали
и лечит только их. По желанию — увеличивает видео (×2, до 1080p, до 1440p).

Порядок работы с каждым кадром:
  1. Сканер (core_scan) — карта-кандидат: где есть фактура без мелочи. Плоское, плавные тени,
     контуры предметов и лица — вне карты.
  2. Генератор (SeedVR2, встроен в ComfyUI, модель скачивается сама) перерисовывает кадры окнами.
  3. Берём у генератора ТОЛЬКО слой мелкой детали яркости — и только если он прошёл проверки:
       • генератор действительно добавил мелочь (а не просто перерисовал то же самое);
       • деталь не сильнее формы, которая её несёт (так не бывает «чёрных губ» и «мазков кистью»);
       • деталь держится во времени: сверяем с прошлым кадром по движению (свой Поток, без скачивания).
     Принятая деталь «едет» по движению, а не рисуется заново — поэтому не кипит.
  4. Зерно и точки внимания — уже после, в Финише: иначе генератор принял бы зерно за грязь.
"""
import time

import numpy as np
import torch
import torch.nn.functional as F

from . import core_io, core_journal, core_comfy, core_ops, core_scan
from .core_seedvr import MODELS, SeedVR2Runner, WindowGenerator, _round4n1
from .node_scout import load_faces

SIZES = ["×1 — only fix detail / только довести детали", "×2", "to 1080p / до 1080p", "to 1440p / до 1440p"]


def _smooth(x, a, b):
    t = ((x - a) / max(b - a, 1e-6)).clamp(0, 1)
    return t * t * (3 - 2 * t)


def _luma(x):
    return 0.2126 * x[:, 0:1] + 0.7152 * x[:, 1:2] + 0.0722 * x[:, 2:3]


def _even(v):
    return max(16, int(round(v / 2)) * 2)


def out_size(w, h, mode):
    if mode.startswith("×2"):
        return _even(w * 2), _even(h * 2)
    for tag, target in (("1080", 1080), ("1440", 1440)):
        if tag in mode:
            k = target / min(w, h)
            return (_even(w * k), _even(h * k)) if k > 1.01 else (w, h)
    return w, h


def scale_rows(rows, k):
    """Строки лиц Разведки (в пикселях исходника) → в пиксели текущего кадра."""
    if rows is None or k == 1:
        return rows
    r = np.array(rows, dtype=np.float32).copy()
    r[:, :14] *= k
    return r


class _Motion:
    """Своё движение между соседними кадрами (DIS из OpenCV — без скачивания), с уверенностью."""

    def __init__(self, dev):
        self.dev = dev
        try:
            import cv2
            self.cv2 = cv2
            self.dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        except Exception:
            self.dis = None
        self.prev = None

    def step(self, x, H, W):
        """x [1,3,h,w] → (поток текущий→прошлый [1,2,H,W], уверенность [1,1,H,W]) или None."""
        if self.dis is None:
            return None
        y = _luma(x)
        y = F.interpolate(y, scale_factor=0.5, mode="area") if min(y.shape[-2:]) > 400 else y
        g = (y[0, 0].clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)
        prev, self.prev = self.prev, g
        if prev is None:
            return None
        from .node_flow import _confidence
        f_cp = torch.from_numpy(self.dis.calc(g, prev, None)).permute(2, 0, 1)[None].to(self.dev)
        f_pc = torch.from_numpy(self.dis.calc(prev, g, None)).permute(2, 0, 1)[None].to(self.dev)
        conf = _confidence(f_cp, f_pc)
        return core_ops.upsample_flow(f_cp, H, W), core_ops.upsample_map(conf, H, W)


class RelayRefine:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = ("Доводчик: сам находит расплывшиеся детали в готовом видео и лечит только их генератором "
                   "(SeedVR2). Может увеличить видео. Модель скачивается сама при первом запуске.")

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "gen_model": (list(MODELS), {"default": list(MODELS)[0],
                          "tooltip": "Модель-генератор. Скачается сама при первом запуске (HuggingFace, Comfy-Org). "
                                     "NVFP4 — для видеокарт RTX 50, int8 — для любых"}),
            "size": (SIZES, {"default": SIZES[2],
                     "tooltip": "До 1080p / ×2 / до 1440p — увеличиваем видео, и генератор дорисовывает мелочь, "
                                "которой в исходном разрешении просто нет места (волосинки, нитки). Это его главная "
                                "работа. ×1 — размер тот же, лечим только явное мыло: на чётком ролике сканер почти "
                                "ничего не найдёт, и это нормально"}),
            "sensitivity": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05,
                            "tooltip": "Чувствительность сканера: 0 — лечить только явно мыльное, 1 — всё, где мелочи "
                                       "меньше нормы. Карту видно в живом окне в режиме «карта»"}),
            "refine_strength": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 1.5, "step": 0.05,
                                "tooltip": "Сколько детали генератора брать в найденных местах"}),
            "upscale_detail": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05,
                               "tooltip": "Только при увеличении: сколько детали генератора брать вне карты (по всему "
                                          "кадру), чтобы увеличенное не было мыльным. При ×1 не используется"}),
            "stick": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 0.95, "step": 0.05,
                      "tooltip": "Склейка по движению: насколько деталь «едет» вместе с картинкой, а не рисуется "
                                 "заново. Выше — меньше кипения"}),
            "protect_edges": ("BOOLEAN", {"default": True,
                              "tooltip": "Не лечить контуры предметов, губы, рамы — это скелет кадра, а не фактура"}),
            "face_detail": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.05,
                            "tooltip": "Доля детали на лицах. 0 — лица не трогать (генератор может менять черты)"}),
            "window": ("INT", {"default": 21, "min": 5, "max": 81, "step": 4,
                       "tooltip": "Сколько кадров генератор видит за раз (4n+1). Не хватит памяти — нода уменьшит сама"}),
        }}

    def run(self, relay, gen_model, size, sensitivity, refine_strength, upscale_detail, stick,
            protect_edges, face_detail, window):
        t0 = time.time()
        v = core_journal.video(relay)
        cur = relay["current"]
        w, h = core_journal.size(relay)
        n = int(cur.get("frames", v["frames"]))
        ts = cur.get("time_scale", 1)
        W2, H2 = out_size(w, h, size)
        up = (W2, H2) != (w, h)
        dev = core_ops.device()
        k_face = w / v["w"]
        faces = load_faces(relay)
        limit = 0.10 if up else 0.06       # предохранитель: насколько деталь может сдвинуть яркость точки
        sigma = 1.4 if up else 1.2         # размер «мелочи», которую берём у генератора
        base_w = float(upscale_detail) if up else 0.0

        try:
            import comfy.model_management as mm
            mm.unload_all_models()
        except Exception:
            pass
        core_ops.free_vram()
        runner = SeedVR2Runner(MODELS.get(gen_model, list(MODELS.values())[0]))
        wg = WindowGenerator(runner, W2, H2, window)
        motion = _Motion(dev)

        out_path = core_journal.stage_path(relay, "refine.mkv")
        log = core_journal.stage_path(relay, "ffmpeg.log")
        fps = cur.get("fps", v["fps"])
        writer = core_io.FrameWriter(out_path, W2, H2, fps, "lossless", log_path=log)
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        st = {"t": 0, "prev_s": None, "prev_d": None, "prev_w": None}
        acc = {"area": [], "taken": [], "amount": [], "boil_raw": [], "boil_glued": [], "held": []}

        def emit(x_np, g):
            t = st["t"]
            x = core_ops.to_t(x_np, dev)
            B = F.interpolate(x, size=(H2, W2), mode="bicubic", align_corners=False).clamp(0, 1) if up else x
            G = g.to(dev).permute(2, 0, 1).unsqueeze(0).float()
            yb, yg = _luma(B), _luma(G)
            hb = yb - core_ops.blur(yb, sigma)
            hg = yg - core_ops.blur(yg, sigma)
            d = hg - hb                                       # что генератор добавил в мелочи

            # 1. карта-кандидат сканера (в размере входа → до выхода)
            ft = int(round(t / ts)) if ts != 1 else t
            rows = scale_rows(faces.get(ft), k_face) if faces else None
            cand, info = core_scan.scan(x, sensitivity, protect_edges, rows, dev)
            if up:
                cand = F.interpolate(cand, size=(H2, W2), mode="bilinear", align_corners=False)
            acc["area"].append(info.get("area_pct", 0.0))
            # 2. генератор правда добавил мелочь там, где её не хватало
            e_b = torch.sqrt(core_ops.blur(hb * hb, 4.0) + 1e-8)
            e_g = torch.sqrt(core_ops.blur(hg * hg, 4.0) + 1e-8)
            adds = _smooth(e_g / (e_b + 2e-3), 1.1, 1.7)
            wmap = cand * adds
            if base_w > 0:                                    # при увеличении — понемногу везде
                fmask = torch.zeros_like(wmap)
                if rows is not None and len(rows):
                    eyes, face, _ = core_ops.face_masks(scale_rows(rows, W2 / w), H2, W2, dev)
                    fmask = core_ops.blur(torch.maximum(face, eyes), 6.0).clamp(0, 1)
                wmap = torch.maximum(wmap, base_w * (1 - fmask * (1 - face_detail)))
            # 3. деталь не сильнее формы, которая её несёт: предел от средней фактуры кадра
            mid = core_ops.blur(yb, 1.6) - core_ops.blur(yb, 4.0)
            e_mid = torch.sqrt(core_ops.blur(mid * mid, 4.0) + 1e-8)
            cap = 1.2 * e_mid + 0.004
            d = torch.maximum(torch.minimum(d, cap), -cap)

            # 4. время: деталь едет по движению; что не держится — не берём
            s = d
            mo = motion.step(x, H2, W2)
            if mo is not None and st["prev_s"] is not None:
                flow, conf = mo
                ps, ins = core_ops.warp(st["prev_s"], flow, "bicubic")
                pd, _ = core_ops.warp(st["prev_d"], flow, "bicubic")
                pw, _ = core_ops.warp(st["prev_w"], flow)
                trust = conf * ins
                held = torch.exp(-((d - pd) ** 2) / (2 * 0.02 ** 2))
                held = core_ops.blur(held, 2.0)
                hold_w = 0.35 + 0.65 * _smooth(held, 0.15, 0.6)
                wmap = wmap * (1 - trust + trust * hold_w)
                wmap = 0.4 * wmap + 0.6 * trust * pw + 0.6 * (1 - trust) * wmap   # карта не мигает
                if stick > 0:
                    a = stick * trust
                    s = (1 - a) * d + a * ps
                den = float(trust.sum()) + 1e-6
                acc["boil_raw"].append(float((trust * (d - pd).abs()).sum()) / den)
                acc["boil_glued"].append(float((trust * (s - ps).abs()).sum()) / den)
                if float(cand.sum()) > 50:                       # есть что мерить
                    acc["held"].append(float((held * cand).sum() / cand.sum()))
            add = (refine_strength * wmap * s).clamp(-limit, limit)
            out = (B + add).clamp(0, 1)
            writer.write(core_ops.to_np(out))
            acc["taken"].append(float((wmap > 0.25).float().mean()) * 100)
            acc["amount"].append(float(add.abs().mean()))
            st["prev_s"], st["prev_d"], st["prev_w"] = s, d, wmap
            st["t"] = t + 1
            bar.step()

        ok = False
        try:
            with torch.inference_mode():
                wg.run(reader, emit)
            ok = True
        finally:
            runner.close()
            if not ok:
                reader.close()
                try:
                    writer.close()
                except Exception:
                    pass
        writer.close()

        new_cur = {"path": out_path, "kind": "rgb", "w": W2, "h": H2, "fps": fps, "frames": st["t"]}
        if "time_scale" in cur:
            new_cur["time_scale"] = cur["time_scale"]
        relay = core_journal.advance(relay, "refine", new_cur)
        mean = lambda a: float(np.mean(a)) if a else 0.0   # noqa: E731
        summary = [f"Генератор: {gen_model}, окно {wg.win_min} кадров"
                   + (" (уменьшено из-за нехватки видеопамяти)" if wg.win_min < _round4n1(window) else ""),
                   (f"Размер: {w}x{h} → {W2}x{H2}" if up else f"Размер не менялся: {w}x{h}"),
                   f"Сканер нашёл зону лечения: {mean(acc['area']):.1f}% кадра в среднем",
                   f"Взято детали генератора: на {mean(acc['taken']):.1f}% кадра, в среднем "
                   f"{mean(acc['amount']) * 255:.2f} из 255 по яркости"]
        if not up and mean(acc["area"]) < 2:
            summary.append("Сканер почти ничего не нашёл: в своём разрешении ролик уже чёткий. Чтобы дорисовать "
                           "волосинки и нитки, выбери размер «до 1080p» или «×2» — там для них появляется место")
        stats = {"area_pct": mean(acc["area"]), "taken_pct": mean(acc["taken"]),
                 "added": mean(acc["amount"]) * 255, "out_size": [W2, H2], "windows": wg.windows}
        if acc["boil_raw"]:
            br, bg = mean(acc["boil_raw"]), mean(acc["boil_glued"])
            cut = (1 - bg / br) * 100 if br > 0 else 0.0
            stats["boil_cut_pct"] = cut
            if acc["held"]:
                stats["held_pct"] = mean(acc["held"]) * 100
                summary.append(f"Деталь генератора держится во времени на {stats['held_pct']:.0f}% зоны лечения "
                               f"(что не держится — не взято)")
            summary.append(f"Склейка по движению: кипение снижено на {cut:.0f}%" if stick > 0 else
                           "Склейка по движению выключена (stick = 0)")
        else:
            summary.append("⚠ Движение не посчиталось (нет OpenCV) — без проверки во времени, может кипеть")
        summary.append(("Лица не трогал" if face_detail == 0 else f"На лицах доля детали ×{face_detail}")
                       if faces else "Разведки нет — лица защищены только сканером (контуры)")
        task = {"gen_model": gen_model, "size": size, "sensitivity": sensitivity, "refine_strength": refine_strength,
                "upscale_detail": upscale_detail, "stick": stick, "protect_edges": protect_edges,
                "face_detail": face_detail, "window": window}
        core_journal.write_stage(relay, "refine", task, summary, stats=stats,
                                 files={"video": out_path}, seconds=time.time() - t0)
        return (relay,)
