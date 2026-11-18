# -*- coding: utf-8 -*-
"""Движок 🧩 Neron Сборка кадра на MiniMax H3 Image — только родные ноды ComfyUI, свой код — склейка, размер, текст.

Как работает (по официальному шаблону Comfy-Org «MiniMax H3 Image Edit» и идее процесса FoxFurEssence «H3 Image Edit»:
персонаж + место + поза; код наш):
  1. Образцы идут в родную MiniMaxH3ImageConditioning как <Picture 1>, <Picture 2>…: герой, место, доп. образец, поза.
  2. Поза размывается — модель берёт только положение тела и ракурс, а не вид манекена / фото (приём FoxFurEssence;
     у нас то же самое в 🎭 Замене героя — размытый образец).
  3. Текст задания нода пишет сама по тому, какие окна заполнены; человек дописывает только суть сцены.
  4. KSampler: 6 шагов, CFG 1, euler / simple, негатив — ConditioningZeroOut (как в официальном шаблоне).
  5. Резкость после проявки — та же мягкая нерезкая маска, что в 🖼 Neron Image.
Память — по очереди: энкодер (32B) → выгрузка → модель → VAE. Модели между прогонами по умолчанию не держим.
"""
import logging
import math
import re

log = logging.getLogger("Neron.Frame")
TAG = "[Neron Frame]"
CLIP_TYPE = "minimax"
STEPS, CFG, SAMPLER, SCHEDULER = 6, 1.0, "euler", "simple"     # официальный шаблон Comfy-Org
GRID = 32                                                       # холст H3 Image кратен 32


class FriendlyError(Exception):
    """Понятная ошибка: что случилось и что сделать — на двух языках."""


# ---------------- служебное (как в 🖼 Neron Image) ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("neron_frame.progress", {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


def node(class_name, **kw):
    """Вызов родной ноды ComfyUI по имени."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise FriendlyError(f"{TAG} В ComfyUI нет ноды «{class_name}». Обнови ComfyUI (нужна поддержка MiniMax H3 "
                            f"Image).\n\nEN: ComfyUI has no «{class_name}» node. Update ComfyUI (MiniMax H3 Image).")
    return getattr(cls(), cls.FUNCTION)(**kw)


def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def base(name):
    return str(name or "").replace("\\", "/").split("/")[-1]


def find_file(kind, name):
    try:
        import folder_paths
    except Exception:
        return None
    try:
        for f in folder_paths.get_filename_list(kind):
            if base(f).lower() == base(name).lower():
                return f
    except Exception as e:
        log.warning("%s список «%s»: %s", TAG, kind, e)
    for n in (name, base(name)):
        try:
            p = folder_paths.get_full_path(kind, n)
            if p and __import__("os").path.isfile(p):
                return n
        except Exception:
            pass
    return None


def files(kind):
    try:
        import folder_paths
        return list(folder_paths.get_filename_list(kind))
    except Exception:
        return []


def free(reason=""):
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache()
    except Exception as e:
        log.warning("%s выгрузка (%s): %s", TAG, reason, e)


_LOADED = {}


def _cached(role, key, make):
    have = _LOADED.get(role)
    if have and have[0] == key:
        return have[1]
    _LOADED.pop(role, None)
    obj = make()
    _LOADED[role] = (key, obj)
    return obj


def load_unet(name):
    return _cached("unet", name, lambda: node("UNETLoader", unet_name=name, weight_dtype="default")[0])


def load_clip(name):
    return _cached("clip", name, lambda: node("CLIPLoader", clip_name=name, type=CLIP_TYPE, device="default")[0])


def load_vae(name):
    return _cached("vae", name, lambda: node("VAELoader", vae_name=name)[0])


def forget_models():
    _LOADED.clear()


# ---------------- размер кадра ----------------
AUTO_ASPECT = "🤖 как у места (или героя) / like the place (or hero)"
ASPECTS = [
    (AUTO_ASPECT, 0, 0),
    ("🖥 16:9 широкий / wide", 16, 9),
    ("📱 9:16 вертикаль / vertical", 9, 16),
    ("⬜ 1:1 квадрат / square", 1, 1),
    ("📷 4:3", 4, 3),
    ("📷 3:4", 3, 4),
    ("🎞 3:2", 3, 2),
    ("🎞 2:3", 2, 3),
    ("🎬 21:9 кино / cinema", 21, 9),
]
ASPECT_NAMES = [a[0] for a in ASPECTS]
QUALITY = [         # 18.11 УГОВОР С РОМАНОМ: для картинок время НЕ важно — главное качество
    ("🎯 4 Мп — как в официальном шаблоне / official", 4.0),
    ("💎 8 Мп — детальнее / more detail", 8.0),
    ("👑 16 Мп — лучшее по словам авторов H3 Image / best per the authors", 16.0),
]
QUALITY_NAMES = [q[0] for q in QUALITY]


def _grid(v):
    return max(GRID * 8, int(round(v / GRID)) * GRID)


def frame_size(aspect, quality, ref_w=None, ref_h=None):
    """Площадь по качеству, форма — по выбору (или как у картинки места / героя)."""
    mp = next((q[1] for q in QUALITY if q[0] == quality), 4.0)
    aw, ah = next(((a[1], a[2]) for a in ASPECTS if a[0] == aspect), (0, 0))
    if not aw or not ah:
        aw, ah = (ref_w, ref_h) if ref_w and ref_h else (1, 1)
    r = math.sqrt(aw / float(ah))
    side = math.sqrt(mp * 1e6)
    return _grid(side * r), _grid(side / r)


def wired_size(width, height, max_mp=16.0):
    w, h = max(256, int(width)), max(256, int(height))
    k = min(1.0, math.sqrt(max_mp * 1e6 / float(w * h)))
    return _grid(w * k), _grid(h * k)


# ---------------- картинки ----------------

def gaussian_blur(image, sigma):
    """Размытие картинки [B, H, W, C] (для позы). sigma — в пикселях."""
    if sigma <= 0:
        return image
    import torch
    import torch.nn.functional as F
    b, h, w, c = image.shape
    r = max(1, int(math.ceil(sigma * 2.5)))
    x = torch.arange(-r, r + 1, dtype=torch.float32, device=image.device)
    k = torch.exp(-(x ** 2) / (2 * sigma ** 2))
    k = (k / k.sum()).to(image.dtype)
    t = image[..., :3].permute(0, 3, 1, 2)
    p = F.pad(t, (r, r, r, r), mode="reflect")
    p = F.conv2d(p, k.view(1, 1, 1, -1).repeat(3, 1, 1, 1), groups=3)
    p = F.conv2d(p, k.view(1, 1, -1, 1).repeat(3, 1, 1, 1), groups=3)
    return p.permute(0, 2, 3, 1).contiguous()


def sharpen(image, amount):
    """Мягкая нерезкая маска (как в 🖼 Neron Image)."""
    if amount <= 0:
        return image
    b, h, w, c = image.shape
    blur = gaussian_blur(image, max(0.6, min(h, w) / 1536.0))
    return (image[..., :3] + float(amount) * (image[..., :3] - blur)).clamp(0, 1)


REF_MP = 4.0      # официальный шаблон: каждый образец сначала приводится к 4 Мп (кратно 32) — «модель плохо работает
                  # на малом разрешении». 18.11 Роман: «портит лица» — у нас образцы шли как есть (герой 0,7 Мп).


def to_ref_size(image, mp=REF_MP):
    """Образец → ≈ mp мегапикселей, стороны кратны 32, форма сохраняется (как ResizeImageMaskNode в шаблоне)."""
    b, h, w, c = image.shape
    k = math.sqrt(mp * 1e6 / float(w * h))
    nw, nh = max(GRID, int(round(w * k / GRID)) * GRID), max(GRID, int(round(h * k / GRID)) * GRID)
    if (nw, nh) == (w, h):
        return image[..., :3]
    t = image[..., :3].movedim(-1, 1)
    try:
        import comfy.utils
        t = comfy.utils.common_upscale(t, nw, nh, "lanczos", "disabled")
    except Exception:
        import torch.nn.functional as F
        t = F.interpolate(t, size=(nh, nw), mode="bicubic", align_corners=False).clamp(0, 1)
    return t.movedim(1, -1)


def pose_blur_px(image, strength):
    """Сила размытия позы → сигма в пикселях по размеру картинки (FoxFurEssence: 5 пикс. на ~1 Мп)."""
    h, w = int(image.shape[1]), int(image.shape[2])
    return float(strength) * 5.0 * math.sqrt((w * h) / 1.0e6)


# ---------------- текст задания ----------------
SCENE_EXAMPLE = ("he crouches in a dark alley, examining a broken drone, cold light from a single lamp")


BASE = ["🤖 место (если есть) — кладём героя в сцену / place", "👤 герой — рисуем героя заново / hero"]


def order_roles(present, base=BASE[0]):
    """Порядок <Picture N>. 18.11 (Роман): «модель не поняла, куда переместить девушку» — при герое первым модель
    рисует героя и «пристраивает» фон. Родная нода считает image_1 картинкой, которую правят, — поэтому при месте
    основа кадра — МЕСТО (<Picture 1>), а героя в него вставляем."""
    first = ["place", "hero"] if (base != BASE[1] and "place" in present) else ["hero", "place"]
    return [r for r in first + ["extra", "pose"] if r in present]


def build_prompt(roles, scene, extra_label=""):
    """Нейтральный текст: только РОЛИ картинок + просьба человека как есть.
    18.11 Роман: «ты строишь системник под конкретную сцену — это неверно, картинки разные». Никаких «сидит», «грязь»,
    «ноги на земле» — всё, что делает герой, где он и во что одет, приходит только из просьбы."""
    num = {r: i + 1 for i, r in enumerate(roles)}
    scene = (scene or "").strip()
    roles_text = {}
    place_base = bool(roles) and roles[0] == "place"
    if "place" in num:
        roles_text["place"] = (f"<Picture {num['place']}> is the scene to edit." if place_base
                               else f"<Picture {num['place']}> shows the location.")
    if "hero" in num:
        who = "the person to add to the scene" if place_base else "the main character"
        roles_text["hero"] = (f"<Picture {num['hero']}> shows {who}: keep the same face, hair, skin tone and body "
                              "proportions, and the same outfit unless the request asks for other clothing.")
    if "extra" in num:
        what = (extra_label or "").strip() or "an additional element of the scene"
        roles_text["extra"] = f"<Picture {num['extra']}> shows {what}."
    if "pose" in num:
        roles_text["pose"] = (f"<Picture {num['pose']}> shows only the body pose and camera angle to use; take nothing "
                              "else from it.")
    parts = [roles_text[r] for r in roles if r in roles_text]          # по порядку номеров
    if not scene:
        if place_base and "hero" in num:
            scene = f"Place the person from <Picture {num['hero']}> naturally in the scene."
        elif "hero" in num and "place" in num:
            scene = f"Show the character from <Picture {num['hero']}> in the location from <Picture {num['place']}>."
        elif "hero" in num:
            scene = f"A high quality photo of the character from <Picture {num['hero']}>."
    if scene:
        parts.append(f"Request: {scene}")
    return " ".join(parts)


# ---------------- перевод просьбы ----------------
# 18.11 по фактам (Роман): та же просьба по-английски — героиня легла и переоделась; по-русски — модель её не
# поняла и скопировала героиню с фото. Переводим русскую просьбу маленьким Qwen3-VL 4B (тот, что у 🖼 Neron Image /
# Krea 2) — загрузить, перевести, выгрузить; потом уже большой энкодер H3.
TRANSLATOR = "qwen3vl_4b_fp8_scaled.safetensors"
TRANSLATE_SYSTEM = ("Translate the user's text into natural English for an image-editing model. Translate faithfully "
                    "and completely: keep every detail, keep tags like <Picture 1> exactly as they are, add nothing, "
                    "explain nothing. If the text is already English, return it unchanged. Output only the "
                    "translation.")
_CYR = re.compile("[А-Яа-яЁё]")
_TR_CACHE = {}


def has_cyrillic(text):
    return bool(_CYR.search(text or ""))


def _clean(text):
    t = (text or "").strip()
    _, sep, rest = t.partition("</think>")
    if sep:
        t = rest
    t = t.replace("<think>", "").replace("**", "").strip()
    t = re.sub(r"^\s*(english\s+)?translation\s*:\s*", "", t, flags=re.I)
    if len(t) > 2 and t[0] == t[-1] and t[0] in "\"'«":
        t = t[1:-1].strip()
    return t


def translate(text):
    """Русский → английский. Возвращает (текст, заметка). Нет переводчика — текст как есть и честная заметка."""
    text = (text or "").strip()
    if not has_cyrillic(text):
        return text, ""
    if text in _TR_CACHE:
        return _TR_CACHE[text], "Просьба переведена (из памяти)"
    name = find_file("text_encoders", TRANSLATOR)
    if not name:
        return text, ("⚠ Просьба по-русски, а переводчика нет (qwen3vl_4b_fp8_scaled — ставится с 🖼 Neron Image). "
                      "Модель лучше понимает английский — напиши просьбу по-английски. EN: write the request in English.")
    send("🌐 перевод просьбы / translating")
    clip = node("CLIPLoader", clip_name=name, type="krea2", device="default")[0]
    try:
        try:
            tokens = clip.tokenize(text, min_length=1, thinking=False, system_prompt=TRANSLATE_SYSTEM)
        except TypeError:
            tokens = clip.tokenize(TRANSLATE_SYSTEM + "\n\nText:\n" + text, min_length=1)
        kw = dict(do_sample=True, max_length=600, temperature=0.2, top_k=20, top_p=0.9, min_p=0.05,
                  repetition_penalty=1.05, seed=0)
        try:
            ids = clip.generate(tokens, presence_penalty=0.0, mtp=True, **kw)
        except TypeError:
            ids = clip.generate(tokens, **kw)
        out = _clean(clip.decode(ids))
    finally:
        del clip
        free("переводчик → энкодер H3")
    if len(out) < 3 or has_cyrillic(out):
        return text, "⚠ Перевод не вышел — просьба ушла как есть. EN: translation failed, sent as is."
    if len(_TR_CACHE) > 64:
        _TR_CACHE.clear()
    _TR_CACHE[text] = out
    return out, "Просьба переведена на английский"


# ---------------- сборка ----------------

def generate(models, prompt, images, width, height, seed, steps, sampler, scheduler):
    """images — список картинок в порядке <Picture N>."""
    clip = load_clip(models["clip"])
    vae = load_vae(models["vae"])
    send("🧩 образцы и текст / references and text")
    refs = {f"image_{i + 1}": im[:1] for i, im in enumerate(images)}
    pos, latent = node("MiniMaxH3ImageConditioning", clip=clip, vae=vae, prompt=prompt, width=int(width),
                       height=int(height), images=refs)[:2]
    neg = node("ConditioningZeroOut", conditioning=pos)[0]
    _LOADED.pop("clip", None)          # энкодер 32B больше не нужен — освобождаем место под модель
    del clip
    free("энкодер → модель")
    model = load_unet(models["unet"])
    send("🎨 рисую / drawing", 0, int(steps))
    out = node("KSampler", model=model, seed=int(seed), steps=int(steps), cfg=CFG, sampler_name=sampler,
               scheduler=scheduler, positive=pos, negative=neg, latent_image=latent, denoise=1.0)[0]
    send("🖼 проявляю / decoding")
    return node("VAEDecode", samples=out, vae=vae)[0]
