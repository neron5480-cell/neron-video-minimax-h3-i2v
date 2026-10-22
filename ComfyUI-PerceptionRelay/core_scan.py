# -*- coding: utf-8 -*-
"""Сканер Доводчика: где в кадре «расплылась» мелкая деталь. Без модели, мгновенно.

Закономерность живого кадра: если в месте есть средние формы (пряди, складки, волокна),
то внутри них есть и мелочь. Формы есть, а мелочи нет — это мыло, туда и пойдёт генератор.
  * плоское (стена, небо) не трогаем: там нет и средних форм — оно гладкое честно;
  * одиночные сильные края (контур, губы, рама) не трогаем: это скелет, а не фактура;
  * лица и глаза не трогаем (если Разведка их нашла).
Возвращает карту 0..1 размером с кадр: 1 — «здесь лечить».
"""
import torch
import torch.nn.functional as F

from . import core_ops


def _smooth(x, a, b):
    t = ((x - a) / max(b - a, 1e-6)).clamp(0, 1)
    return t * t * (3 - 2 * t)


def bands(y):
    """Средние формы и мелочь (по яркости). y [1,1,H,W]."""
    b1 = core_ops.blur(y, 0.9)
    b2 = core_ops.blur(y, 2.2)
    b3 = core_ops.blur(y, 5.0)
    fine = y - b1
    mid = b2 - b3
    return mid, fine


def scan(x, sensitivity=0.5, protect_edges=True, faces_rows=None, dev=None):
    """x [1,3,H,W] 0..1 → (карта [1,1,H,W], сведения)."""
    dev = dev or x.device
    h, w = x.shape[-2:]
    y = 0.2126 * x[:, 0:1] + 0.7152 * x[:, 1:2] + 0.0722 * x[:, 2:3]
    # работаем в «перцептивной» яркости: в тенях глаз чувствительнее
    y = y.clamp(0, 1) ** (1 / 2.2)
    mid, fine = bands(y)
    em = torch.sqrt(core_ops.blur(mid * mid, 4.0) + 1e-8)
    ef = torch.sqrt(core_ops.blur(fine * fine, 4.0) + 1e-8)

    # 1. есть ли средние формы (иначе место честно гладкое)
    structure = _smooth(em, 0.004, 0.016)
    # 2. это фактура (много мелких колебаний), а не плавная тень или мягкий край:
    #    у тени/складки сильный плавный наклон, у фактуры наклон гасится колебаниями
    slope = core_ops.blur(core_ops.gradient_mag(core_ops.blur(y, 4.0)), 4.0)
    texture = _smooth(em / (slope + 1e-4), 3.0, 4.6)
    # 3. сколько мелочи «положено» при таких формах и сколько есть.
    #    sensitivity 0 → лечим только явно мыльное, 1 → всё, где мелочи меньше нормы.
    #    Это только подсказка: окончательно решает проверка того, что добавил генератор
    #    Замер: у мыльных прядей мелочи ~0.15 от средних форм, у живых ~0.4, у ткани ~0.55
    ratio = 0.25 + 0.5 * float(sensitivity)
    deficit = ((ratio * em - ef) / (ratio * em + 1e-6)).clamp(0, 1)
    m = structure * texture * _smooth(deficit, 0.25, 0.6)

    info = {}
    if protect_edges:
        # контур предмета: перепад крупного масштаба сильнее ряби вокруг него.
        # Расширяем зону запрета на несколько пикселей — генератор любит рисовать ореолы у краев
        gm = core_ops.gradient_mag(core_ops.blur(y, 1.5))
        g_loc = core_ops.blur(gm, 8.0)
        g_max = F.max_pool2d(F.pad(gm, (5, 5, 5, 5), mode="replicate"), 11, stride=1)
        lonely = _smooth(g_max / (g_loc * 2.0 + 1e-4), 1.0, 1.6) * _smooth(g_max, 0.03, 0.07)
        lonely = F.max_pool2d(F.pad(lonely, (3, 3, 3, 3), mode="replicate"), 7, stride=1)
        edge = core_ops.blur(lonely, 2.5).clamp(0, 1)
        m = m * (1 - edge)
        info["edges_pct"] = float((edge > 0.5).float().mean()) * 100
    if faces_rows is not None and len(faces_rows):
        eyes, face, _ = core_ops.face_masks(faces_rows, h, w, dev)
        fm = core_ops.blur(torch.maximum(face, eyes), 6.0)
        m = m * (1 - fm.clamp(0, 1))
    # мягкие границы зоны лечения — иначе на стыке будет виден «шов»
    m = core_ops.blur(m, 3.0).clamp(0, 1)
    info["area_pct"] = float((m > 0.25).float().mean()) * 100
    return m, info


def overlay(x, m):
    """Подсветка для живого окна: лечить — пурпурным, сила — яркостью подсветки."""
    tint = torch.tensor([1.0, 0.15, 0.85], device=x.device).view(1, 3, 1, 1)
    a = (m * 0.65).clamp(0, 0.65)
    gray = (0.2126 * x[:, 0:1] + 0.7152 * x[:, 1:2] + 0.0722 * x[:, 2:3]).expand_as(x)
    base = 0.55 * x + 0.45 * gray                 # кадр чуть приглушён, чтобы подсветка читалась
    return (base * (1 - a) + tint * a).clamp(0, 1)
