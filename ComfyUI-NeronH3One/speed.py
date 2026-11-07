# -*- coding: utf-8 -*-
"""⚡ Ускорение — только официальными путями ComfyUI, ничего в систему не ставим.

Два независимых рычага:
  1. ВНИМАНИЕ (плотное) — каким ядром считать:
     • PyTorch — эталон, точно;
     • Sage — если пакет sageattention уже стоит; квантует внимание (INT8/FP8) — быстрее, отличия малы, но есть;
     • Kitchen INT8 — штатная нода «Model Attention Backend»; заметнее мягчит деталь (у нас давало морфинг
       в конце ролика), поэтому только по выбору.
  2. РАЗРЕЖЕННОЕ внимание — штатная нода ComfyUI «Model Sparse Attention» (BlockSparseAttention), у неё
     отдельная поддержка MiniMax H3:
     • sol-attn — без дообучения: каждой части кадра считает точно только важные куски (порог tau);
       выигрыш тем больше, чем длиннее ролик и больше кадр. Это приближение — подбираем tau на одном сиде;
     • vsa — только для Fast H3 (FastVideo): модель обучена ровно под это, 10% кубов.
     Первые 20% шагов идут плотно, звук не трогается (exact_kv_and_rows) — как советуют авторы ноды.
"""
import logging

from .core import TAG, has_node, node

log = logging.getLogger("Neron.H3.One")

ATTN = ["🎯 PyTorch — точно / exact", "⚡ Sage — если установлен / if installed",
        "🍳 Kitchen INT8 — быстрее, мягче деталь / faster, softer detail"]
ATT_PYTORCH, ATT_SAGE, ATT_KITCHEN = ATTN

SPARSE = ["выкл / off", "🧮 sol-attn — без дообучения / training-free", "🧊 vsa — только Fast H3 / Fast H3 only"]
SP_OFF, SP_SOL, SP_VSA = SPARSE
AUTO = "🤖 авто по режиму / auto by mode"


def _attention_module():
    try:
        import comfy.ldm.modules.attention as A
        return A
    except Exception:
        return None


def available():
    """Что есть на этой машине: {'sage': bool, 'kitchen': bool, 'sparse': bool}."""
    A = _attention_module()
    out = {"sage": False, "kitchen": False, "sparse": has_node("BlockSparseAttention")}
    if A is not None:
        try:
            out["sage"] = A.get_attention_function("sage", None) is not None
        except Exception:
            pass
        out["kitchen"] = bool(getattr(A, "COMFY_KITCHEN_INT8_ATTENTION_IS_AVAILABLE", False))
    return out


def apply(model, attention, sparse, tau, keep_percent, is_fast_h3, report):
    """Надеть выбранное на модель. Не вышло — пишем в отчёт почему и едем дальше на PyTorch."""
    have = available()
    att_name = "PyTorch"
    if attention == ATT_SAGE:
        if have["sage"]:
            try:
                fn = _attention_module().get_attention_function("sage", None)
                m = model.clone()
                m.set_model_optimized_attention(fn)
                model, att_name = m, "Sage"
            except Exception as e:
                report.append(f"⚡ Sage не применился ({type(e).__name__}) — PyTorch / Sage failed — PyTorch")
        else:
            report.append("⚡ Sage не установлен — внимание PyTorch / Sage is not installed — PyTorch attention")
    elif attention == ATT_KITCHEN:
        if have["kitchen"] and has_node("ModelAttentionBackend"):
            try:
                model = node("ModelAttentionBackend", model=model, attention="comfy kitchen attention")[0]
                att_name = "Kitchen INT8"
            except Exception as e:
                report.append(f"⚡ Kitchen INT8 не применился ({type(e).__name__}) — PyTorch")
        else:
            report.append("⚡ Kitchen INT8 недоступен на этой машине — PyTorch / not available — PyTorch")
    elif has_node("ModelAttentionBackend"):
        try:
            model = node("ModelAttentionBackend", model=model, attention="pytorch attention")[0]
        except Exception as e:
            log.warning("%s внимание PyTorch: %s", TAG, e)

    sp_name = "выкл / off"
    if sparse in (SP_SOL, SP_VSA):
        if sparse == SP_VSA and not is_fast_h3:
            report.append("🧊 vsa работает только с Fast H3 — включаю sol-attn / vsa needs Fast H3 — using sol-attn")
            sparse = SP_SOL
        if not have["sparse"]:
            report.append("🧮 Разреженного внимания нет в этом ComfyUI (нода «Model Sparse Attention») — обнови "
                          "ComfyUI / no sparse attention node — update ComfyUI")
        else:
            sel = ({"selection": "vsa", "keep_percent": float(keep_percent)} if sparse == SP_VSA
                   else {"selection": "sol-attn", "tau": float(tau)})
            try:
                model = node("BlockSparseAttention", model=model, selection=sel, start_percent=0.2, end_percent=1.0,
                             dense_blocks="", min_tokens=12288, extra_tokens=256,
                             sink_conditioning="exact_kv_and_rows", verbose=False)[0]
                sp_name = (f"vsa {float(keep_percent):g}%" if sparse == SP_VSA else f"sol-attn tau {float(tau):g}")
            except Exception as e:
                report.append(f"🧮 Разреженное внимание не применилось ({type(e).__name__}: {e}) — плотное "
                              f"/ sparse attention failed — dense")
    report.append(f"⚡ Внимание: {att_name} · разреженное: {sp_name} / attention: {att_name} · sparse: {sp_name}")
    return model
