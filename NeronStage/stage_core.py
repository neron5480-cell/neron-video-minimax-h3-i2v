# -*- coding: utf-8 -*-
"""
Neron Stage — математика площадки / stage math.

RU: Тут всё, что считает Площадка без видеокарты:
      * скелет из углов суставов (как кукла на шарнирах);
      * план движения: точки маршрута → где стоит героиня и какая у неё поза
        в любую секунду ролика;
      * проекция через камеру и рисование кадров «скелета позы» (OpenPose);
      * раскадровка текстом для промта.
    Тот же самый расчёт повторяет интерфейс (stage_ui.js), чтобы превью на
    холсте совпадало с тем, что уйдёт в генерацию. Если меняешь тут — меняй и там.

EN: Everything the stage computes without a GPU: the skeleton from joint
    angles, the motion plan (route points → position and pose at any moment),
    camera projection, OpenPose frame drawing and the text storyboard.
    stage_ui.js repeats the same math so the canvas preview matches the output.
"""

import json
import math
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
POSES_FILE = os.path.join(_HERE, "web", "stage_poses.json")

ANGLE_KEYS = ["tp", "ty", "tr", "hp", "hy",
              "lsp", "lsr", "le", "rsp", "rsr", "re",
              "lhp", "lhr", "lk", "rhp", "rhr", "rk"]

WALK_SPEED = {"walk": 1.25, "run": 3.0}          # м/с, до подгонки под длину ролика
STRIDE = {"walk": 1.35, "run": 2.4}              # метров на полный цикл шагов
BLEND_T = 0.35                                    # секунды на плавный переход позы
FPS = 24

# OpenPose 18: нос, шея, П-плечо, П-локоть, П-кисть, Л-плечо, Л-локоть, Л-кисть,
# П-бедро, П-колено, П-щиколотка, Л-бедро, Л-колено, Л-щиколотка, П-глаз, Л-глаз, П-ухо, Л-ухо
LIMBS = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9), (9, 10),
         (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16), (0, 15), (15, 17)]
COLORS = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0), (85, 255, 0),
          (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
          (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255), (255, 0, 170), (255, 0, 85)]

_POSES = None


def poses():
    global _POSES
    if _POSES is None:
        with open(POSES_FILE, "r", encoding="utf-8") as f:
            _POSES = json.load(f)
    return _POSES


def frames_for(seconds, fps=FPS):
    """Сетка кадров H3: 17·n + 5 (5 с = 124 кадра). H3 frame grid."""
    n = max(1, round((float(seconds) * fps - 5) / 17))
    return 17 * n + 5


# ---------------------------------------------------------------- вращения
def _rx(a, v):
    c, s = math.cos(a), math.sin(a)
    return (v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c)


def _ry(a, v):
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c)


def _rz(a, v):
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _mul(v, k):
    return (v[0] * k, v[1] * k, v[2] * k)


def _chain(v, ops):
    """Применяет повороты справа налево: ops = [(ось, угол), ...] как запись R1·R2·…·v."""
    for axis, ang in reversed(ops):
        v = _rx(ang, v) if axis == "x" else _ry(ang, v) if axis == "y" else _rz(ang, v)
    return v


def fk(ang, height=1.7):
    """Углы (градусы) → 18 точек OpenPose в системе тела.
    Система тела: +x — левая сторона героини, +y — вверх, +z — куда она смотрит.
    Ноги сами встают на пол (y = 0)."""
    b = poses()["body"]
    k = float(height) / b["height"]
    g = {key: math.radians(float(ang.get(key, 0) or 0)) for key in ANGLE_KEYS}
    torso = [("y", g["ty"]), ("x", g["tp"]), ("z", g["tr"])]
    head = torso + [("y", g["hy"]), ("x", g["hp"])]

    P = (0.0, 0.0, 0.0)
    neck = _add(P, _chain((0, b["pelvis_to_neck"] * k, 0), torso))
    head_c = _add(neck, _chain((0, b["neck_to_head"] * k, 0), torso))
    pts = [None] * 18
    pts[1] = neck
    pts[0] = _add(head_c, _chain((0, -0.01 * k, 0.10 * k), head))
    pts[15] = _add(head_c, _chain((0.035 * k, 0.03 * k, 0.085 * k), head))   # Л-глаз
    pts[14] = _add(head_c, _chain((-0.035 * k, 0.03 * k, 0.085 * k), head))  # П-глаз
    pts[17] = _add(head_c, _chain((0.075 * k, 0.0, 0.0), head))              # Л-ухо
    pts[16] = _add(head_c, _chain((-0.075 * k, 0.0, 0.0), head))             # П-ухо

    down = (0, -1, 0)
    for side, (sh, el, wr, sp, sr, ek) in ((1, (5, 6, 7, "lsp", "lsr", "le")),
                                            (-1, (2, 3, 4, "rsp", "rsr", "re"))):
        shoulder = _add(neck, _chain((side * b["shoulder_half"] * k, -0.02 * k, 0), torso))
        upper = torso + [("x", -g[sp]), ("z", side * g[sr])]
        elbow = _add(shoulder, _mul(_chain(down, upper), b["upper_arm"] * k))
        wrist = _add(elbow, _mul(_chain(down, upper + [("x", -g[ek])]), b["forearm"] * k))
        pts[sh], pts[el], pts[wr] = shoulder, elbow, wrist

    for side, (hp_, kn, an, pp, pr, kk) in ((1, (11, 12, 13, "lhp", "lhr", "lk")),
                                             (-1, (8, 9, 10, "rhp", "rhr", "rk"))):
        hip = _add(P, (side * b["hip_half"] * k, 0, 0))
        thigh = [("x", -g[pp]), ("z", side * g[pr])]
        knee = _add(hip, _mul(_chain(down, thigh), b["thigh"] * k))
        ankle = _add(knee, _mul(_chain(down, thigh + [("x", g[kk])]), b["shin"] * k))
        pts[hp_], pts[kn], pts[an] = hip, knee, ankle

    floor = min(pts[10][1] - b["ankle_h"] * k, pts[13][1] - b["ankle_h"] * k,
                pts[9][1] - 0.05 * k, pts[12][1] - 0.05 * k)
    return [(p[0], p[1] - floor, p[2]) for p in pts]


# ---------------------------------------------------------------- план движения
def _pose_def(name):
    return poses()["poses"].get(name) or poses()["poses"]["stand"]


def _lerp_ang(a, b, t):
    return {k: (a.get(k, 0) or 0) * (1 - t) + (b.get(k, 0) or 0) * t for k in ANGLE_KEYS}


def _smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _cycle(pd, u, period):
    """Поза с двумя вариантами (a/b) — качается между ними. Pose that swings a↔b."""
    a = pd.get("a", {})
    if "b" not in pd:
        return dict(a)
    w = (1 - math.cos(2 * math.pi * u / max(0.05, period))) / 2
    return _lerp_ang(a, pd["b"], w)


def _mid(pd):
    a = pd.get("a", {})
    return _lerp_ang(a, pd.get("b", a), 0.5)


def target_angles(point, u=0.0):
    """Поза точки в момент u секунд от начала остановки (с поправками пользователя)."""
    pd = _pose_def(point.get("pose", "stand"))
    period = pd.get("cycle", 1.0)
    ang = _cycle(pd, u, period)
    for k2, v in (point.get("adj") or {}).items():
        if k2 in ANGLE_KEYS:
            ang[k2] = (ang.get(k2, 0) or 0) + float(v)
    return {k: ang.get(k, 0) or 0 for k in ANGLE_KEYS}


def hold_of(p, i):
    h = p.get("hold")
    if h is not None and float(h) > 0:
        return float(h)
    return 0.6 if (p.get("pose", "stand") == "stand" and not str(p.get("text", "")).strip()) else 1.6


def _yaw_to(a, b):
    dx, dz = b["x"] - a["x"], b["z"] - a["z"]
    if abs(dx) + abs(dz) < 1e-6:
        return None
    return math.degrees(math.atan2(dx, dz))


def _lerp_yaw(a, b, t):
    d = ((b - a + 180) % 360) - 180
    return a + d * t


def plan(state):
    """Раскладывает точки по времени ролика. → список отрезков.
    Каждый отрезок: kind 'hold'|'move', t0, t1, i (точка), …"""
    pts = [p for p in (state.get("points") or []) if isinstance(p, dict)]
    seconds = float(state.get("seconds", 5) or 5)
    if not pts:
        pts = [{"x": 0.0, "z": -3.0, "pose": "stand"}]
    raw = []
    for i, p in enumerate(pts):
        raw.append({"kind": "hold", "i": i, "d": hold_of(p, i)})
        if i + 1 < len(pts):
            q = pts[i + 1]
            dist = math.hypot(q["x"] - p["x"], q["z"] - p["z"])
            mv = q.get("move", "walk") if q.get("move", "walk") in WALK_SPEED else "walk"
            raw.append({"kind": "move", "i": i, "d": dist / WALK_SPEED[mv], "dist": dist, "move": mv})
    total = sum(s["d"] for s in raw) or 1.0
    k = seconds / total
    t = 0.0
    for s in raw:
        s["t0"] = t
        s["d"] *= k
        t += s["d"]
        s["t1"] = t
    raw[-1]["t1"] = seconds
    # куда героиня смотрит на каждой остановке
    yaws = []
    for i, p in enumerate(pts):
        if p.get("yaw") is not None:
            yaws.append(float(p["yaw"]))
            continue
        y_in = _yaw_to(pts[i - 1], p) if i > 0 else None
        y_out = _yaw_to(p, pts[i + 1]) if i + 1 < len(pts) else None
        y = y_in if y_in is not None else y_out
        yaws.append(y if y is not None else 180.0)       # одна точка — лицом к камере «как на фото»
    return {"segments": raw, "points": pts, "yaws": yaws, "speed_k": k, "seconds": seconds}


def sample(pl, t):
    """Где героиня, куда смотрит и в какой позе в момент t.
    → (x, z, yaw_deg, angles)"""
    segs, pts, yaws = pl["segments"], pl["points"], pl["yaws"]
    seg = segs[-1]
    for s in segs:
        if t < s["t1"]:
            seg = s
            break
    i = seg["i"]
    p = pts[i]
    u = max(0.0, t - seg["t0"])
    D = max(1e-6, seg["t1"] - seg["t0"])
    if seg["kind"] == "move":
        q = pts[i + 1]
        f = min(1.0, u / D)
        x, z = p["x"] + (q["x"] - p["x"]) * f, p["z"] + (q["z"] - p["z"]) * f
        yaw = _yaw_to(p, q)
        mv = seg["move"]
        phase = (seg["dist"] * f) / STRIDE[mv]
        ang = _cycle(_pose_def(mv), phase, 1.0)
        return x, z, yaw, ang
    # остановка
    tgt = target_angles(p, u)
    yaw = yaws[i]
    idx = segs.index(seg)
    prev_move = segs[idx - 1] if idx > 0 and segs[idx - 1]["kind"] == "move" else None
    next_move = segs[idx + 1] if idx + 1 < len(segs) and segs[idx + 1]["kind"] == "move" else None
    tau = min(BLEND_T, D / 2)
    ang = tgt
    if prev_move and u < tau:
        ang = _lerp_ang(_mid(_pose_def(prev_move["move"])), tgt, _smooth(u / tau))
    if next_move:
        left = D - u
        if left < tau:
            w = _smooth(1 - left / tau)
            ang = _lerp_ang(tgt, _mid(_pose_def(next_move["move"])), w)
            y_out = _yaw_to(p, pts[i + 1])
            if y_out is not None:
                yaw = _lerp_yaw(yaw, y_out, w)
    return p["x"], p["z"], yaw, ang


def world_points(pl, t, height=1.7):
    x, z, yaw, ang = sample(pl, t)
    a = math.radians(yaw)
    return [_add(_ry(a, q), (x, 0.0, z)) for q in fk(ang, height)]


# ---------------------------------------------------------------- камера и кадры
def _norm(v):
    n = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2) or 1.0
    return (v[0] / n, v[1] / n, v[2] / n)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def camera_basis(cam):
    C = tuple(cam.get("pos", (0, 1.6, 0)))
    T = tuple(cam.get("target", (0, 1.0, -3)))
    f = _norm((T[0] - C[0], T[1] - C[1], T[2] - C[2]))
    r = _norm(_cross(f, (0, 1, 0)))
    if abs(_dot(f, (0, 1, 0))) > 0.999:
        r = (1, 0, 0)
    u = _cross(r, f)
    return C, f, r, u


def project(points, cam, w, h):
    """3D → пиксели кадра (как PerspectiveCamera в three.js, fov по вертикали)."""
    C, f, r, u = camera_basis(cam)
    fov = math.radians(float(cam.get("fov", 45)))
    focal = (h / 2) / math.tan(fov / 2)
    out = []
    for P in points:
        d = (P[0] - C[0], P[1] - C[1], P[2] - C[2])
        zc = _dot(d, f)
        if zc < 0.05:
            out.append(None)
            continue
        out.append((w / 2 + _dot(d, r) * focal / zc, h / 2 - _dot(d, u) * focal / zc))
    return out


def draw_openpose(kp, w, h):
    """Кадр «скелета позы» в цветах OpenPose на чёрном фоне → numpy uint8 [h, w, 3]."""
    import numpy as np
    from PIL import Image, ImageDraw

    stick = max(2, round(4 * min(w, h) / 512))
    limbs = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(limbs)
    for n, (a, b) in enumerate(LIMBS):
        pa, pb = kp[a], kp[b]
        if pa is None or pb is None:
            continue
        col = COLORS[n]
        d.line([pa, pb], fill=col, width=stick * 2)
        for q in (pa, pb):
            d.ellipse([q[0] - stick, q[1] - stick, q[0] + stick, q[1] + stick], fill=col)
    arr = (np.asarray(limbs, dtype=np.float32) * 0.6).astype(np.uint8)
    img = Image.fromarray(arr)
    d = ImageDraw.Draw(img)
    rad = max(2, round(4 * min(w, h) / 512))
    for n, q in enumerate(kp):
        if q is None:
            continue
        d.ellipse([q[0] - rad, q[1] - rad, q[0] + rad, q[1] + rad], fill=COLORS[n])
    return np.asarray(img, dtype=np.uint8)


def render_pose_video(state, w, h, fps=FPS, progress=None):
    """Все кадры позы. → numpy float32 [T, h, w, 3] в 0..1 (формат IMAGE в ComfyUI)."""
    import numpy as np
    pl = plan(state)
    n = frames_for(pl["seconds"], fps)
    height = float(state.get("actor_h", 1.7) or 1.7)
    cam = state.get("camera") or {}
    frames = np.zeros((n, h, w, 3), dtype=np.float32)
    for i in range(n):
        t = min(pl["seconds"], i / fps)
        kp = project(world_points(pl, t, height), cam, w, h)
        frames[i] = draw_openpose(kp, w, h).astype(np.float32) / 255.0
        if progress:
            progress(i + 1, n)
    return frames, n


# ---------------------------------------------------------------- раскадровка
def _shot(cam, pl):
    C, f, r, u = camera_basis(cam)
    xs = [p["x"] for p in pl["points"]]
    zs = [p["z"] for p in pl["points"]]
    cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
    dist = math.hypot(cx - C[0], cz - C[2])
    shot = "close-up" if dist < 2.2 else "medium shot" if dist < 4.5 else "wide shot"
    angle = "high angle, looking down" if C[1] > 2.6 else "low angle, looking up" if C[1] < 0.8 else "eye level"
    return shot, angle


def _dir_words(cam, p, q):
    C, f, r, u = camera_basis(cam)
    d = (q["x"] - p["x"], 0.0, q["z"] - p["z"])
    sx, sz = _dot(d, r), _dot(d, f)
    words = []
    if abs(sz) > 0.35 * (abs(sx) + abs(sz)):
        words.append("away from the camera" if sz > 0 else "toward the camera")
    if abs(sx) > 0.35 * (abs(sx) + abs(sz)):
        words.append("to the right of the frame" if sx > 0 else "to the left of the frame")
    return " and ".join(words) or "forward"


def storyboard(state):
    """Раскадровка по секундам — сырьё для автопромтера. Storyboard by seconds."""
    pl = plan(state)
    cam = state.get("camera") or {}
    shot, angle = _shot(cam, pl)
    lines = [f"Duration: {pl['seconds']:g} s. Static locked-off camera, {shot}, {angle}. "
             f"The scene is the reference background picture; the character is the reference person.",
             "Timeline:"]
    pts = pl["points"]
    for s in pl["segments"]:
        span = f"{s['t0']:.1f}-{s['t1']:.1f}s"
        if s["kind"] == "move":
            q = pts[s["i"] + 1]
            verb = "runs" if s["move"] == "run" else "walks"
            lines.append(f"{span}: the character {verb} {_dir_words(cam, pts[s['i']], q)}.")
        else:
            p = pts[s["i"]]
            txt = str(p.get("text", "")).strip()
            verb = _pose_def(p.get("pose", "stand")).get("verb", "stands")
            lines.append(f"{span}: {txt if txt else 'the character ' + verb + '.'}")
    return "\n".join(lines)
