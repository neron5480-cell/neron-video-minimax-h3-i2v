"""RU: Железо определяет процесс сам. Никаких вопросов человеку.
EN: The process inspects the hardware itself and never asks the user.

RU: Два честных режима: турбо (8 шагов) и мощный (20 шагов, полный текстовый движок).
    Auto выбирает их по реальной видеопамяти и оперативке, а не по «на глаз».
EN: Two honest modes: turbo (8 steps) and power (20 steps, full text encoder).
    Auto picks one from real VRAM and RAM rather than a guess.
"""

from __future__ import annotations

import torch

try:
    import psutil
except Exception:
    psutil = None

BASE_PIXELS = 768 * 1344
FPS = 24

# RU: понятные формы кадра для панели; точные числа прячутся в «эксперте».
FORMATS = {
    "auto": (1344, 768),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "1:1": (1024, 1024),
    "4:3": (1216, 896),
    "3:2": (1344, 896),
}


def size_from_format(fmt: str) -> tuple[int | None, int | None]:
    """RU: форма кадра → пиксели; авто оставляет размер за движком."""
    if not fmt or fmt == "auto":
        return None, None
    return FORMATS.get(str(fmt), FORMATS["auto"])


def size_from_frame(frame) -> tuple[int, int]:
    """RU: пропорции первого кадра → размер H3 без растягивания."""
    from comfy_extras.nodes_minimax_h3 import adapt_canvas

    shape = getattr(frame, "shape", None)
    if not shape or len(shape) < 2:
        return FORMATS["auto"]
    try:
        h, w = int(shape[-3]), int(shape[-2]) if len(shape) >= 3 else (int(shape[0]), int(shape[1]))
        if w > 0 and h > 0:
            return adapt_canvas(w, h)
    except Exception:
        pass
    return FORMATS["auto"]


def target_size(width=None, height=None, frame_format="auto", mode="auto",
                first_frame=None) -> tuple[int, int]:
    """RU: шина/ручной размер → формат → первый кадр → стандарт, затем паспорт H3."""
    w, h = int(width or 0), int(height or 0)
    fmt = str(frame_format or "auto").lower()
    if (not w or not h) and fmt != "auto":
        w, h = size_from_format(fmt)
    if (not w or not h) and first_frame is not None:
        w, h = size_from_frame(first_frame)
    if not w or not h:
        w, h = FORMATS["auto"]
    return snap_size(w, h, mode)


def gpu_info() -> dict:
    vram = 0
    free = 0
    name = "CPU"
    try:
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            vram = int(props.total_memory / (1024 ** 2))
            free = int((props.total_memory - torch.cuda.memory_reserved(0)) / (1024 ** 2))
            name = props.name
    except Exception:
        pass
    ram = 0
    try:
        if psutil:
            ram = int(psutil.virtual_memory().total / (1024 ** 3))
    except Exception:
        pass
    return {"vram_mb": vram, "free_mb": free, "ram_gb": ram, "name": name}


def choose_mode(requested: str = "auto") -> str:
    req = str(requested or "auto").lower()
    if req.startswith("tur") or "8" in req:
        return "turbo"
    if req.startswith("pow") or "20" in req:
        return "power"
    hw = gpu_info()
    if hw["vram_mb"] >= 24000 and hw["ram_gb"] >= 64:
        return "power"
    return "turbo"


def snap_length(seconds: float) -> int:
    """RU: H3 считает кадры по сетке 17k+5, 24 кадра в секунду."""
    want = max(3.0, min(15.0, float(seconds))) * FPS
    frames = 5 + 17 * max(1, round((want - 5) / 17))
    return max(124, min(362, int(frames)))


def snap_size(width: int | None, height: int | None, mode: str = "auto") -> tuple[int, int]:
    """RU: паспорт H3 — короткая сторона 768, площадь ≤ 1344×768, шаг 32.

    EN: the H3 passport — short edge 768, area <= 1344x768, step 32.

    RU: размер не зависит от железа и не уменьшается в турбо. Больше модель —
        только дольше; память берётся ступенями видеокарта → оперативка → M.2.
    """
    from comfy_extras.nodes_minimax_h3 import adapt_canvas

    # RU: режим оставлен в подписи для совместимости, на кадр он больше не влияет.
    return adapt_canvas(int(width or 1344), int(height or 768))
