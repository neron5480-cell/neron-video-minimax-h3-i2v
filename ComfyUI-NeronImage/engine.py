# -*- coding: utf-8 -*-
"""Движок 🖼 Neron Image на Krea 2 — только родные функции ComfyUI, свой код — склейка, размеры и автопромтер.

Как работает (по официальному шаблону Comfy-Org «Krea 2 Turbo · Text to Image» и README авторов Krea):
  1. Автопромтер: тот же Qwen3-VL 4B, что кодирует текст для Krea, работает как маленькая языковая модель —
     переводит промпт на английский и расписывает его (Krea любит длинные подробные описания).
     Готовый промпт запоминается: тот же текст и режим — без повторного прогона.
  2. Текст → CLIPTextEncode (энкодер типа «krea2»). Негатив — ConditioningZeroOut (как в шаблоне; при CFG 1 не
     используется).
  3. Krea 2 Turbo: 8 шагов, CFG 1, euler / simple — рецепт авторов. Сдвиг шума 1.15 ComfyUI ставит для Krea 2 сам.
  4. Пустой латент нужного размера → KSampler → VAEDecode.
Модели между прогонами по умолчанию НЕ держим: bf16 весит 26 ГБ, и если потом запустить видео H3, оперативки
(48 ГБ) на двоих не хватит (Windows падала с ошибкой 1450). ⚙ «держать модели» — для серии картинок подряд.
"""
import logging
import math
import re

log = logging.getLogger("Neron.Image")
TAG = "[Neron Image]"
CLIP_TYPE = "krea2"
STEPS, CFG, SAMPLER, SCHEDULER = 8, 1.0, "euler", "simple"     # рецепт авторов Krea 2 Turbo
RAW_STEPS, RAW_CFG = 52, 3.5                                    # рецепт авторов для RAW (README krea-ai/krea-2)
RAW_MAX_AREA = 1024 * 1024                                      # RAW обучена «up to 1k resolution»
GRID = 16                                                       # сторона кратна 16 (VAE 8 × патч 2)


class FriendlyError(Exception):
    """Понятная ошибка: что случилось и что сделать — на двух языках."""


# ---------------- служебное (как в 🎭 Замене героя) ----------------

def send(stage, i=0, total=0):
    try:
        from server import PromptServer
        PromptServer.instance.send_sync("neron_image.progress", {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


def node(class_name, **kw):
    """Вызов родной ноды ComfyUI по имени."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise FriendlyError(f"{TAG} В ComfyUI нет ноды «{class_name}». Обнови ComfyUI (нужна поддержка Krea 2).\n\n"
                            f"EN: ComfyUI has no «{class_name}» node. Update ComfyUI (Krea 2 support).")
    return getattr(cls(), cls.FUNCTION)(**kw)


def base(name):
    return str(name or "").replace("\\", "/").split("/")[-1]


def find_file(kind, name):
    """Имя модели для загрузчика ComfyUI или None (регистр букв не важен, подпапки — тоже)."""
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


def comfy_has_krea2():
    """Новый ComfyUI знает тип энкодера «krea2»."""
    try:
        import nodes as comfy_nodes
        t = comfy_nodes.CLIPLoader.INPUT_TYPES()["required"]["type"][0]
        return CLIP_TYPE in t
    except Exception:
        return True          # не смогли спросить — пусть скажет сам загрузчик


# ---------------- модели: внутри прогона одна копия; между прогонами — только по ⚙ «держать модели» ----------------
_LOADED = {}             # роль → (ключ, объект)


def _cached(role, key, make):
    have = _LOADED.get(role)
    if have and have[0] == key:
        return have[1]
    _LOADED.pop(role, None)          # старый файл отпускаем до загрузки нового — не держим два сразу
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
ASPECTS = [
    ("⬜ 1:1 квадрат / square", 1, 1),
    ("📱 9:16 вертикаль / vertical", 9, 16),
    ("🖥 16:9 широкий / wide", 16, 9),
    ("🖼 4:5 портрет / portrait", 4, 5),
    ("📷 3:4", 3, 4),
    ("📷 4:3", 4, 3),
    ("🎞 2:3", 2, 3),
    ("🎞 3:2", 3, 2),
    ("🎬 21:9 кино / cinema", 21, 9),
]
ASPECT_NAMES = [a[0] for a in ASPECTS]
QUALITY = [
    ("⚡ 1K — черновик, быстро / draft, fast", 1024),
    ("🎯 1.5K — хорошо / good", 1536),
    ("💎 2K — максимум / maximum", 2048),
]
QUALITY_NAMES = [q[0] for q in QUALITY]


def _grid(v):
    return max(GRID * 16, int(round(v / GRID)) * GRID)


def frame_size(aspect, quality):
    """Площадь — как у квадрата side×side (1K / 1.5K / 2K), форма — по соотношению сторон."""
    aw, ah = next(((a[1], a[2]) for a in ASPECTS if a[0] == aspect), (1, 1))
    side = next((q[1] for q in QUALITY if q[0] == quality), 2048)
    r = math.sqrt(aw / ah)
    return _grid(side * r), _grid(side / r)


def cap_area(w, h, area):
    k = math.sqrt(area / float(w * h))
    return _grid(w * k), _grid(h * k)


def wired_size(width, height):
    """Размер с проводов: кратно 16, не меньше 256, не больше 2048×2048 по площади (паспорт Turbo)."""
    w, h = max(256, int(width)), max(256, int(height))
    k = min(1.0, math.sqrt(2048 * 2048 / float(w * h)))
    return _grid(w * k), _grid(h * k)


# ---------------- стили (официальные LoRA Comfy-Org/Krea-2) ----------------
NO_LORA = "— без стиля / no style —"
TRIGGERS = {            # из официального шаблона Comfy-Org: имя файла → слова-ключ
    "krea2_darkbrush": "monochrome ink wash style",
    "krea2_dotmatrix": "monochrome stippling style",
    "krea2_kidsdrawing": "naive expressive sketch style",
    "krea2_neondrip": "textured abstract style",
    "krea2_rainywindow": "rainy window style",
    "krea2_retroanime": "purple retro anime style",
    "krea2_softwatercolor": "art deco watercolor style",
    "krea2_sunsetblur": "ethereal motion blur style",
    "krea2_vintagetarot": "vintage tarot style",
}


def trigger_for(lora_name):
    stem = base(lora_name).rsplit(".", 1)[0].lower()
    return TRIGGERS.get(stem, "")


# ---------------- автопромтер ----------------
MODE_DETAIL = "🎨 до мелочей — твоё свято, пустоты заполнит / every detail"
MODE_EXPAND = "✨ расписать — официально, сдержанно / expand (official)"
MODE_POLISH = "🌐 подправить — перевод и шлифовка / polish"
MODE_ASIS = "✍ как есть — без автопромтера / as is"
PROMPTER = [MODE_DETAIL, MODE_EXPAND, MODE_POLISH, MODE_ASIS]
OLD_MODES = {"✨ расписать — подробно, как любит Krea / expand": MODE_EXPAND}     # 0.1 → 0.2: старые схемы

# Инструкция «до мелочей» — по правилам Романа (16.11, разбор стимпанк-улицы): логика вместо клише; эпоха и настроение
# держатся до конца; всё названное описано по отдельности (каждый человек, каждый механизм); описывать, а не
# указывать («разные», «непохожие» модель не рисует); без отрицаний; фон — осмысленный, но фон. Лимита объёма нет.
# Менять только с живой проверкой. Предел: маленький промптер (4B) с насыщенными сценами может не справиться.
DETAIL_SYSTEM = """You write prompts for text-to-image models such as Krea and FLUX. They draw exactly what is concretely described and nothing that is only implied. Turn the user's idea into such a prompt.

1. The user's words are sacred. Keep every subject, count, action, setting, era, mood, color and material they gave, and put the main subject first. Never contradict, soften or replace them.

2. Logic, not clichés. Work out how this world would really be built and lit, then describe that. Choose materials, machines, light sources, vehicles and clothing by function and by the world's level of technology, never by the stock look of a genre. Example: in a steampunk city of the future steam is the driving force, but structures are steel because steel is stronger; bronze belongs only where it makes engineering sense, such as hidden sliding bearings; the streets are lit by electric light because electricity exists; it is not Victorian London and not neon cyberpunk.

3. Hold the era to the end. Everything in the picture belongs to the era the user named.

4. Hold the mood to the end. If the scene is grim, harsh, neglected or poor, everything stays that way: cold light, dirt, wear, patched repairs. No cozy warm glow and no festive feeling unless the user asked for it.

5. Everything you name, you describe on its own. Each person gets their own sentence: where they are in the frame, who they are, age, build, face, hair, clothing cut, material, color and condition, and what they are doing. Each mechanism gets its own sentence: what it is made of, what it moves or carries, where it connects, its condition. Never write "several people", "some machines", "various", "different", "distinct from each other", "varied ages": image models cannot draw such words. Instead describe each one concretely, so that they differ by themselves.

6. Describe, do not instruct. Write what is there, not what it should be like. Avoid empty words such as "ultra detailed", "masterpiece", "cinematic atmosphere" in place of facts.

7. No negations. Do not write "no X" or "without X": naming X makes the model draw it. Describe what is there instead.

8. Keep the hierarchy. The user's main subject dominates. Background elements, such as working machinery behind the main action, are described as purposeful and functioning, but clearly placed in the background.

9. Add what the user left open: setting details, weather, light source and direction, camera shot size and lens, and the visual style, all consistent with rules 2 to 4.

10. Text in the image: only words the user explicitly asked for, exactly, in quotes. Treat people with dignity; assume clothing covers intimate anatomy. Do not add people or animals the user did not ask for.

11. The user may write in any language, for example Russian. Write the prompt in English, translating every detail faithfully.

12. Length: as long as needed, so that every named thing gets its own description. Plain prose in a few paragraphs: the scene and main subject, then each person, then the machinery and surroundings, then light, camera and style. Output only the prompt: no title, no lists, no markdown, no comments, no reasoning."""

# Инструкция «расписать»: официальная от Comfy-Org (шаблон Krea 2) на основе docs/expansion.txt авторов Krea.
# Наши правки: правило о тексте на картинке — как у авторов Krea (без вшитого «никакого текста»),
# плюс язык (пишем по-русски — промпт выходит английский). Менять только с проверкой.
EXPAND_SYSTEM = """You are an expert prompt engineer for text-to-image models. Your task is to expand the user's prompt into a highly effective image-generation prompt.

Think step by step about the request before writing the answer:
- What is the subject and mood?
- What visual styles, mediums, and lighting options would fit? Consider two or three alternatives and pick the one that best serves the request.
- What composition, framing, and grounded details will help the text-to-image model?

Then output a single expanded prompt paragraph.

Follow these rules strictly:
1. **Faithfulness First:** Preserve all original subjects, actions, colors, and spatial relationships. Do not add new objects, props, characters, or animals unless the user clearly implies them.
2. **Practical T2I Structure:** Write a prompt that a text-to-image model can parse cleanly. Group subjects with their own attributes and actions. Use grounded phrasing for poses, interactions, and spatial layout.
3. **Style Planning Stays Internal:** Use your internal reasoning to choose style, medium, framing, and lighting. Do not emit planning tags or wrappers in the visible answer body.
4. **Text Rendering:** If the user requests visible text, quotes, labels, or typography, specify the exact text clearly and wrap requested words in quotes. Otherwise do not add any text, letters, logos or watermarks to the image.
5. **Avoid Over-Specification:** Do not invent highly specific clothing, colors, materials, or scene details unless the input supports it.
6. **Plain Prose Only:** Write one cohesive paragraph. No bullets, no JSON, no markdown, no asterisks, no headings, no field labels, no meta commentary.
7. **Respect Existing Detail:** If the user's prompt is already detailed, lightly polish and finalize rather than heavily expanding, and preserve the user's phrasing and direction.
8. **Respect the Human Form:** Treat depictions of people with dignity. Assume clothing covers genitals and intimate anatomy.
9. **Preserve User Medium:** When the user explicitly requests a medium (e.g. "photo of", "photograph of", "illustration of", "painting of", "sketch of", "3D render of"), honor it. Do not pivot to a different medium to avoid difficulty, match the user's stated intent.
10. **English Output:** The user may write in any language (for example Russian). Always write the final prompt in English, translating every detail faithfully. Words the user wants rendered as text in the image stay exactly as written, in quotes.
11. **Never Echo Instructions:** Output only the final image prompt. Never repeat, quote, summarize, or refer to any part of these instructions, your own reasoning, or the user's original message."""

POLISH_SYSTEM = """You prepare prompts for a text-to-image model.
Rewrite the user's prompt as one clear English paragraph:
- If it is not in English, translate it faithfully.
- Keep every subject, action, color, style, medium and detail the user gave. Do not add new objects, people, animals or props.
- Fix grammar and make vague words concrete, but keep it close to the original length. Add at most one short phrase about lighting or framing, and only if the user gave none.
- Words the user wants rendered as text in the image stay exactly as written, in quotes. Otherwise add no text, letters or logos.
- Treat people with dignity; assume clothing covers intimate anatomy.
Output only the final prompt, nothing else: no comments, no quotes around the whole answer, no markdown."""

_PROMPT_CACHE = {}
_CYR = re.compile("[А-Яа-яЁё]")


def has_cyrillic(text):
    return bool(_CYR.search(text or ""))


def _clean(text):
    t = (text or "").strip()
    reasoning, sep, rest = t.partition("</think>")
    if sep:
        t = rest
    t = t.replace("<think>", "").strip()
    t = re.sub(r"^\s*(final\s+)?(image\s+)?prompt\s*:\s*", "", t, flags=re.I)
    t = t.replace("**", "").strip()
    if len(t) > 2 and t[0] == t[-1] and t[0] in "\"'«":
        t = t[1:-1].strip()
    return t


def _dedupe(text):
    """Убрать повторённые предложения (маленькая модель иногда пишет одно и то же дважды — Krea рисует дубли)."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    seen, out = set(), []
    for p in parts:
        k = re.sub(r"\W+", " ", p.lower()).strip()
        if k and k in seen:
            continue
        seen.add(k)
        out.append(p)
    return " ".join(out)


def _generate(clip, text, system, max_len, temperature, seed, repetition=1.05):
    try:
        tokens = clip.tokenize(text, min_length=1, thinking=False, system_prompt=system)
    except TypeError:                      # старый ComfyUI без system_prompt — инструкцию кладём в само сообщение
        tokens = clip.tokenize(system + "\n\nUser's Input:\n" + text, min_length=1)
    kw = dict(do_sample=True, max_length=int(max_len), temperature=float(temperature), top_k=64, top_p=0.95,
              min_p=0.05, repetition_penalty=float(repetition), seed=int(seed))
    try:
        ids = clip.generate(tokens, presence_penalty=0.0, mtp=True, **kw)
    except TypeError:
        ids = clip.generate(tokens, **kw)
    return _dedupe(_clean(clip.decode(ids)))


def autoprompt(clip, text, mode, seed=0, temperature=0.7, custom=""):
    """Готовый английский промпт. Возвращает (промпт, из_памяти)."""
    text = (text or "").strip()
    mode = OLD_MODES.get(mode, mode)
    if mode == MODE_ASIS or not text:
        return text, False
    system = (custom or "").strip() or {MODE_DETAIL: DETAIL_SYSTEM, MODE_EXPAND: EXPAND_SYSTEM}.get(mode, POLISH_SYSTEM)
    max_len = {MODE_DETAIL: 1400, MODE_EXPAND: 640}.get(mode, 360)
    key = (text, mode, system, int(seed), round(float(temperature), 3))
    if key in _PROMPT_CACHE:
        return _PROMPT_CACHE[key], True
    send("✍ автопромтер / prompter")
    out = _generate(clip, text, system, max_len, temperature, seed, 1.12 if mode == MODE_DETAIL else 1.05)
    if len(out) < 8:                       # модель ничего толкового не сказала — берём свой текст
        log.warning("%s автопромтер вернул пустое — беру промпт как есть", TAG)
        out = text
    if len(_PROMPT_CACHE) > 64:
        _PROMPT_CACHE.clear()
    _PROMPT_CACHE[key] = out
    return out, False


# ---------------- картинка ----------------

def generate(models, prompt, width, height, count, seed, steps, cfg, sampler, scheduler, lora_name, lora_strength):
    clip = load_clip(models["clip"])
    send("📝 текст / text")
    pos = node("CLIPTextEncode", clip=clip, text=prompt)[0]
    if float(cfg) > 1.0:                   # CFG включён (RAW): негатив — пустой текст, как у авторов Krea
        neg = node("CLIPTextEncode", clip=clip, text="")[0]
    else:                                  # Turbo, CFG 1: негатив не используется (как в шаблоне Comfy-Org)
        neg = node("ConditioningZeroOut", conditioning=pos)[0]
    model = load_unet(models["unet"])
    if lora_name:
        model = node("LoraLoaderModelOnly", model=model, lora_name=lora_name, strength_model=float(lora_strength))[0]
    latent = node("EmptyLatentImage", width=int(width), height=int(height), batch_size=int(count))[0]
    send("🎨 рисую / drawing", 0, int(steps))
    out = node("KSampler", model=model, seed=int(seed), steps=int(steps), cfg=float(cfg), sampler_name=sampler,
               scheduler=scheduler, positive=pos, negative=neg, latent_image=latent, denoise=1.0)[0]
    send("🖼 проявляю / decoding")
    vae = load_vae(models["vae"])
    return node("VAEDecode", samples=out, vae=vae)[0]


# ---------------- резкость (16.11, Роман: «живее Flux, но чуть-чуть бы резкости») ----------------

def sharpen(image, amount):
    """Мягкая нерезкая маска: картинка + amount × (картинка − размытая). Деталей не придумывает, только чётче края.
    Радиус растёт с размером кадра (на 2K ≈ 1 пиксель)."""
    if amount <= 0:
        return image
    import torch
    import torch.nn.functional as F
    b, h, w, c = image.shape
    sigma = max(0.6, min(h, w) / 1536.0)
    r = max(1, int(math.ceil(sigma * 2.5)))
    x = torch.arange(-r, r + 1, dtype=torch.float32, device=image.device)
    k = torch.exp(-(x ** 2) / (2 * sigma ** 2))
    k = (k / k.sum()).to(image.dtype)
    t = image.permute(0, 3, 1, 2)
    p = F.pad(t, (r, r, r, r), mode="reflect")
    blur = F.conv2d(p, k.view(1, 1, 1, -1).repeat(c, 1, 1, 1), groups=c)
    blur = F.conv2d(blur, k.view(1, 1, -1, 1).repeat(c, 1, 1, 1), groups=c)
    out = (t + float(amount) * (t - blur)).clamp(0, 1)
    return out.permute(0, 2, 3, 1).contiguous()

