# -*- coding: utf-8 -*-
"""
Neron Stage — объём из фото / depth from a photo.

RU: Делает из фото сцены объёмную «декорацию» для Площадки.
    * Модель глубины Depth Anything V2 (Small, метрическая — считает в метрах).
      «Комната» и «Улица» — две разные модели, каждая лучше в своём.
      Скачивается сама при первом нажатии (около 100 МБ) в ComfyUI/models/neron_stage.
    * Находит пол и ставит сцену так, чтобы пол был на высоте 0 —
      по этому полу и ходит скелет.
    * После работы модель выгружается из видеопамяти: генерации она не мешает.
EN: Turns the scene photo into a 3D backdrop. Depth Anything V2 Small (metric,
    in meters), indoor/outdoor models, auto-download (~100 MB) into
    ComfyUI/models/neron_stage. Finds the floor and puts it at height 0.
    The model is unloaded after use so it never competes with generation.
"""

import base64
import hashlib
import math
import os
import threading

MODELS = {
    "indoor": "depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf",
    "outdoor": "depth-anything/Depth-Anything-V2-Metric-Outdoor-Small-hf",
}
GRID_W = 192            # ширина сетки декорации (точек) / backdrop grid width
_lock = threading.Lock()
_cache = {}


def _models_dir():
    try:
        import folder_paths
        d = os.path.join(folder_paths.models_dir, "neron_stage")
    except Exception:
        d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(d, exist_ok=True)
    return d


def _run_depth(img, env):
    """→ карта глубины в метрах (numpy, размер как у img)."""
    import numpy as np
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    name = MODELS.get(env, MODELS["outdoor"])
    cache = _models_dir()
    proc = AutoImageProcessor.from_pretrained(name, cache_dir=cache)
    model = AutoModelForDepthEstimation.from_pretrained(name, cache_dir=cache)
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    try:
        model.to(dev).eval()
        inp = proc(images=img, return_tensors="pt").to(dev)
        with torch.no_grad():
            pred = model(**inp).predicted_depth          # [1, h, w]
        pred = torch.nn.functional.interpolate(pred.unsqueeze(1), size=(img.height, img.width),
                                               mode="bicubic", align_corners=False)
        depth = pred[0, 0].float().cpu().numpy()
    finally:
        del model
        if dev == "cuda":
            torch.cuda.empty_cache()                     # видеопамять — обратно генерации
    return np.clip(depth, 0.1, 200.0)


def _fit_floor(P, rows, h):
    """Ищет пол среди нижней части кадра (RANSAC). → (нормаль, точка) или None."""
    import numpy as np
    cand = P[rows > 0.55 * h]
    if len(cand) < 50:
        return None
    rng = np.random.default_rng(7)
    best, best_n = None, 0
    for _ in range(300):
        a, b, c = cand[rng.choice(len(cand), 3, replace=False)]
        n = np.cross(b - a, c - a)
        ln = np.linalg.norm(n)
        if ln < 1e-6:
            continue
        n = n / ln
        if n[1] < 0:
            n = -n
        if n[1] < 0.75:                                  # пол — почти горизонтальный
            continue
        dist = np.abs((cand - a) @ n)
        thr = 0.04 + 0.01 * float(np.median(np.abs(cand[:, 2])))
        cnt = int((dist < thr).sum())
        if cnt > best_n:
            best, best_n = (n, a), cnt
    if best is None or best_n < 0.15 * len(cand):
        return None
    return best


def build(image_path, env="outdoor", fov=60.0):
    """Фото → сетка точек декорации в мировых координатах (пол = 0).
    → dict для интерфейса."""
    import numpy as np
    from PIL import Image

    st = os.stat(image_path)
    key = hashlib.md5(f"{image_path}|{st.st_mtime}|{st.st_size}|{env}|{fov:.1f}".encode()).hexdigest()
    if key in _cache:
        return _cache[key]

    img = Image.open(image_path).convert("RGB")
    with _lock:
        depth = _run_depth(img, env)

    # Небо и самое дальнее — на одну «стену-задник»: иначе облака рвутся на дырки.
    # Sky and the farthest parts go onto one backdrop wall, otherwise clouds tear into holes.
    cap = float(np.clip(2.5 * np.median(depth), 15.0, 80.0))
    depth = np.where(depth > 0.6 * cap, cap, depth)

    W, H = img.width, img.height
    gw = min(GRID_W, W)
    gh = max(2, round(gw * H / W))
    us = np.linspace(0, W - 1, gw)
    vs = np.linspace(0, H - 1, gh)
    uu, vv = np.meshgrid(us, vs)
    z = depth[vv.round().astype(int), uu.round().astype(int)]
    f = (W / 2) / math.tan(math.radians(fov) / 2)        # fov — по горизонтали
    x = (uu - W / 2) / f * z
    y = -(vv - H / 2) / f * z
    P = np.stack([x, y, -z], -1).reshape(-1, 3)           # камера фото смотрит в −z

    fl = _fit_floor(P, vv.reshape(-1), H)
    ground_ok = fl is not None
    if ground_ok:
        n, p0 = fl
        # поворот: нормаль пола → +y
        up = np.array([0.0, 1.0, 0.0])
        v = np.cross(n, up)
        s, c = np.linalg.norm(v), float(n @ up)
        if s > 1e-6:
            vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
            R = np.eye(3) + vx + vx @ vx * ((1 - c) / (s * s))
        else:
            R = np.eye(3)
        P = P @ R.T
        cam = np.zeros(3) @ R.T
        look = np.array([0.0, 0.0, -1.0]) @ R.T
        shift = float((p0 @ R.T)[1])
    else:
        # пол не нашёлся: считаем, что фото снято с высоты 1.6 м
        cam, look, shift = np.zeros(3), np.array([0.0, 0.0, -1.0]), -1.6
    P[:, 1] -= shift
    cam = cam - np.array([0, shift, 0])

    out = {
        "ok": True, "gw": int(gw), "gh": int(gh), "ground_ok": ground_ok, "env": env, "fov": fov,
        "far": 0.4 * cap,                     # дальше этого — гладкий задник, без разрывов

        "photo_cam": {"pos": [float(v) for v in cam], "dir": [float(v) for v in look]},
        "pos": base64.b64encode(P.astype("<f4").tobytes()).decode("ascii"),
    }
    _cache[key] = out
    return out
