# -*- coding: utf-8 -*-
"""2. Разведка: лица и глаза в каждом кадре, трекинг, сглаживание траекторий вперёд-назад."""
import os
import time
import urllib.request

import numpy as np

from . import core_io, core_journal, core_comfy

YUNET_FILE = "face_detection_yunet_2023mar.onnx"
YUNET_URLS = [
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/" + YUNET_FILE,
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/" + YUNET_FILE,
]


def yunet_path():
    p = os.path.join(core_comfy.models_dir(), YUNET_FILE)
    if os.path.isfile(p) and os.path.getsize(p) > 100_000:
        return p
    last = None
    for url in YUNET_URLS:
        try:
            tmp = p + ".part"
            urllib.request.urlretrieve(url, tmp)
            if os.path.getsize(tmp) > 100_000:
                os.replace(tmp, p)
                return p
        except Exception as e:
            last = e
    raise RuntimeError(
        f"Эстафета/Разведка: не удалось скачать детектор лиц ({last}).\n"
        f"Скачай вручную {YUNET_FILE} (230 КБ) из github.com/opencv/opencv_zoo "
        f"и положи в {core_comfy.models_dir()}")


def _iou(a, b):
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0.0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0.0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    u = a[2] * a[3] + b[2] * b[3] - inter
    return inter / u if u > 0 else 0.0


def _smooth_track(frames, params, sigma):
    """Заполняем дыры линейно и сглаживаем гауссом по времени в обе стороны (без запаздывания)."""
    f0, f1 = frames[0], frames[-1]
    full_f = np.arange(f0, f1 + 1)
    out = np.empty((len(full_f), params.shape[1]), np.float64)
    for j in range(params.shape[1]):
        out[:, j] = np.interp(full_f, frames, params[:, j])
    if sigma > 0.01 and len(full_f) > 2:
        r = int(np.ceil(sigma * 3))
        x = np.arange(-r, r + 1)
        k = np.exp(-x * x / (2 * sigma * sigma))
        pad = np.pad(out, ((r, r), (0, 0)), mode="edge")
        sm = np.empty_like(out)
        for j in range(out.shape[1]):
            sm[:, j] = np.convolve(pad[:, j], k / k.sum(), mode="valid")
        out = sm
    return full_f, out


def load_faces(relay):
    """{кадр: массив [N,15]} из scout.npz — для следующих этапов."""
    rep = core_journal.report(relay, "scout")
    if not rep:
        return None
    data = np.load(rep["files"]["faces"])
    rows = data["rows"]
    out = {}
    for r in rows:
        out.setdefault(int(r[0]), []).append(r[2:])
    return {k: np.array(v) for k, v in out.items()}


class RelayScout:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Находит лица и глаза (реперные точки), ведёт их по кадрам и сглаживает траектории."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "score_threshold": ("FLOAT", {"default": 0.6, "min": 0.3, "max": 0.95, "step": 0.05,
                                          "tooltip": "Уверенность детектора. Выше — меньше ложных лиц"}),
            "smooth": ("FLOAT", {"default": 2.0, "min": 0.0, "max": 8.0, "step": 0.5,
                                 "tooltip": "Сглаживание траекторий, в кадрах. Убирает дрожь детектора"}),
            "min_track": ("INT", {"default": 8, "min": 1, "max": 120,
                                  "tooltip": "Лицо короче стольких кадров считаем ложным (отражения, мусор)"}),
            "max_gap": ("INT", {"default": 6, "min": 0, "max": 48,
                                "tooltip": "Сколько кадров лицо может пропасть и считаться тем же"}),
        }}

    def run(self, relay, score_threshold, smooth, min_track, max_gap):
        import cv2
        t0 = time.time()
        v = core_journal.video(relay)
        w, h, n = v["w"], v["h"], v["frames"]
        scale = min(1.0, 1920.0 / max(w, h))
        dw, dh = int(round(w * scale)), int(round(h * scale))
        det = cv2.FaceDetectorYN.create(yunet_path(), "", (dw, dh), score_threshold, 0.3, 50)

        cur = relay["current"]
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        tracks = []  # {"frames": [], "p": [], "last": idx}
        raw_count = 0
        fi = 0
        for frame in reader:
            core_comfy.check_interrupt()
            img = (np.clip(frame, 0, 1) * 255).astype(np.uint8)[:, :, ::-1]
            if scale < 1.0:
                img = cv2.resize(img, (dw, dh), interpolation=cv2.INTER_AREA)
            _, faces = det.detect(np.ascontiguousarray(img))
            dets = [] if faces is None else [f.astype(np.float64) for f in faces]
            for d in dets:
                d[:14] /= scale
            raw_count += len(dets)
            # жадное сопоставление с живыми треками по пересечению рамок
            alive = [t for t in tracks if fi - t["last"] <= max_gap + 1]
            pairs = sorted(((_iou(t["p"][-1], d), ti, di) for ti, t in enumerate(alive)
                            for di, d in enumerate(dets)), reverse=True)
            used_t, used_d = set(), set()
            for iou, ti, di in pairs:
                if iou < 0.25 or ti in used_t or di in used_d:
                    continue
                used_t.add(ti)
                used_d.add(di)
                alive[ti]["frames"].append(fi)
                alive[ti]["p"].append(dets[di])
                alive[ti]["last"] = fi
            for di, d in enumerate(dets):
                if di not in used_d:
                    tracks.append({"frames": [fi], "p": [d], "last": fi})
            fi += 1
            bar.step()
        n = fi

        rows = []
        kept = 0
        dropped = 0
        filled = 0
        frames_with_face = set()
        for tid, t in enumerate(tracks):
            fr = np.array(t["frames"])
            pr = np.array(t["p"])
            # короткие вспышки и «лица», в которых детектор всё время сомневался, — мусор
            if len(fr) < min_track or pr[:, 14].mean() < score_threshold + 0.1:
                dropped += 1
                continue
            full_f, sm = _smooth_track(fr, pr, smooth)
            filled += len(full_f) - len(fr)
            for f, p in zip(full_f, sm):
                rows.append(np.concatenate([[f, kept], p]))
                frames_with_face.add(int(f))
            kept += 1
        rows = np.array(rows, np.float32) if rows else np.zeros((0, 17), np.float32)
        out = core_journal.stage_path(relay, "scout.npz")
        np.savez(out, rows=rows, frames=n)

        relay = core_journal.advance(relay, "scout")
        cover = len(frames_with_face) / max(n, 1)
        summary = [f"Лиц (треков): {kept}" + (f", отброшено ложных/коротких: {dropped}" if dropped else ""),
                   f"Кадров с лицами: {len(frames_with_face)} из {n} ({cover * 100:.0f}%)",
                   f"Заполнено пропусков детектора: {filled} кадро-лиц",
                   f"Траектории сглажены: {smooth} кадра в обе стороны"]
        if kept == 0:
            summary.append("Лиц нет — точки внимания на финише применяться не будут")
        task = {"score_threshold": score_threshold, "smooth": smooth,
                "min_track": min_track, "max_gap": max_gap}
        core_journal.write_stage(relay, "scout", task, summary,
                                 stats={"tracks": kept, "dropped": dropped, "coverage": cover,
                                        "raw_detections": raw_count},
                                 files={"faces": out}, seconds=time.time() - t0)
        return (relay,)
