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
QUALITY = [
    ("⚡ 2 Мп — черновик, быстрее / draft, faster", 2.0),
    ("🎯 4 Мп — как в официальном шаблоне / official", 4.0),
    ("💎 8 Мп — максимум для 16 ГБ, дольше / maximum, slower", 8.0),
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
    """roles: роли в порядке <Picture N> ('hero', 'place', 'extra', 'pose'). Возвращает английский текст."""
    num = {r: i + 1 for i, r in enumerate(roles)}
    scene = (scene or "").strip()
    parts = []
    keep = ("face, hair, outfit, equipment, colors and body proportions, exactly as they are in that picture")
    if roles and roles[0] == "place" and "hero" in num:
        p, h = num["place"], num["hero"]
        line = f"Edit <Picture {p}>: add the single character from <Picture {h}> into this scene"
        if "pose" in num:
            line += f", in the body pose and camera angle shown in <Picture {num['pose']}>"
        parts.append(line + ".")
        parts.append(f"Keep the scene of <Picture {p}> as it is: the same layout, furniture, objects and lighting. "
                     "Put the character at a believable spot in it with correct scale and perspective, in real "
                     "contact with the surfaces — feet on the ground, sitting on a seat that exists in the scene — lit "
                     "by the scene's own light, with matching shadows.")
        parts.append(f"Preserve the exact appearance of the character from <Picture {h}>: {keep}.")
        if scene:
            scene = f"Where and how the character is placed: {scene}"
    elif "hero" in num:
        h = num["hero"]
        line = f"Generate a high quality shot of the single character in <Picture {h}>"
        if "pose" in num:
            line += f" with the body pose and camera angle shown in <Picture {num['pose']}>"
        parts.append(line + ".")
        # 18.11, первый прогон Романа: «dirt and wear» в общем тексте → модель вымазала грязью ноги чистой девушке.
        # Износ и грязь — только если они есть на самом образце или в сцене; общий текст — без них.
        parts.append(f"Preserve the exact appearance of the character in <Picture {h}>: {keep}.")
        if "place" in num:
            parts.append(f"Place the character naturally in the location shown in <Picture {num['place']}>, "
                         "matching its lighting, perspective, weather and atmosphere.")
    elif "place" in num:
        parts.append(f"Generate a high quality shot set in the location shown in <Picture {num['place']}>, "
                     "keeping its look, lighting and atmosphere.")
        if "pose" in num:
            parts.append(f"A figure takes the body pose and camera angle shown in <Picture {num['pose']}>.")
    if "extra" in num:
        what = (extra_label or "").strip() or "an additional element of the scene"
        parts.append(f"<Picture {num['extra']}> shows {what}; include it exactly as it looks there.")
    if "pose" in num:
        parts.append(f"<Picture {num['pose']}> is only a guide for the position of the body and the camera angle; "
                     "take nothing else from it.")
    if scene:
        parts.append(scene)
    return " ".join(parts) if parts else scene


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
