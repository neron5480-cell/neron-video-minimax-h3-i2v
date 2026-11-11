# -*- coding: utf-8 -*-
"""🎭 Neron H3 Замена героя / Hero Swap — тот же клип, другой человек.

Входы — штатные Load Video и Load Image проводами. Новичок видит: кого менять, что менять, качество, длину, звук.
Всё тонкое — за ⚙ экспертом. Модели — «🤖 авто» и кнопка «📥 Модели» (качает только то, что нужно этой ноде).
"""
import logging

from . import downloader
from . import engine as E

log = logging.getLogger("Neron.H3.Swap")
NOT_FOUND = "__not_found__"
AUTO_MODEL = "🤖 авто — из пакета / auto — from pack"
ROLES = {"unet": "diffusion_models", "clip": "text_encoders", "vae_video": "vae", "vae_audio": "vae",
         "turbo_lora": "loras", "swap_lora": "loras", "sam": "checkpoints"}
ROLE_NAMES = {"unet": "модель H3 Ref2VA / H3 Ref2VA model", "clip": "текстовый энкодер / text encoder",
              "vae_video": "VAE видео / video VAE", "vae_audio": "VAE звука / audio VAE",
              "turbo_lora": "турбо-LoRA / turbo LoRA", "swap_lora": "LoRA замены / swap LoRA",
              "sam": "SAM 3.1 (маска человека / person mask)"}

WHAT = ["🧍 весь облик / whole look", "🙂 лицо и причёска / face & hair"]
QUALITY = ["⚡ 480p — быстрее, для 16 ГБ / faster", "🎯 768p — как у автора LoRA, тяжелее / heavier"]
SHORT = {QUALITY[0]: 480, QUALITY[1]: 768}
SOUND = ["🎵 оригинал / original", "✨ сгенерировать / generate"]
SHAPES = {"🎬 как в клипе / as in clip": None,
          "16:9 · кино / cinema": (16, 9),
          "9:16 · телефон / phone": (9, 16),
          "1:1 · квадрат / square": (1, 1),
          "4:3 · классика / classic": (4, 3),
          "3:4 · портрет / portrait": (3, 4),
          "21:9 · широкий / wide": (21, 9),
          "✏ ручной / manual": "manual"}
SHAPE_NAMES = list(SHAPES)
TARGET = {E.WHO[0]: "the main person", E.WHO[1]: "the person on the left", E.WHO[2]: "the person on the right",
          E.WHO[3]: "the person in the center", E.WHO[4]: "every person"}

AUTO_TIP = ("🤖 авто — файл из пакета (или его другая версия, что уже лежит). Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file (or another version you have). Missing — press «📥 Models».")


def blur_prompt(who, what, hint=""):
    """Текст ноды: в <Video 1> человек (или голова) размыт — модель заполняет его человеком с <Picture 1>.
    Формулировка проверена Романом 11.11 (лучшие прогоны) — менять только с проверкой."""
    shape = "a blurred silhouette"
    t = TARGET.get(who, "the main person")
    hint = (hint or "").strip()
    if what == WHAT[1]:
        return head_prompt(t, shape, hint)
    look = "facial features, face shape, hairstyle, hair color, skin tone, body build and clothing from <Picture 1>"
    return (
        f"In <Video 1>, {t} has been removed and replaced by {shape}. Fill the silhouette with the person shown in "
        "<Picture 1>.\n\n"
        "subject_definitions:\n"
        f"<Subject 1> is the person from <Picture 1> ({look}). <Subject 1> occupies exactly the silhouette in "
        "<Video 1>, in every frame.\n"
        "<Subject 2> is everything outside the silhouette in <Video 1>: background, lighting, objects and other "
        "people.\n"
        "<Video 1> is the source video: the silhouette gives the exact position, scale, body shape, pose and "
        "movement over time; the soundtrack gives the timing of speech or singing.\n\n"
        "summary:\n"
        "[video editing + reference generation] An edited version of <Video 1> in which the silhouette becomes "
        "<Subject 1>, a real person who moves exactly as the silhouette moves, while <Subject 2> stays unchanged.\n\n"
        "retention_analysis:\n"
        "<Subject 1>: fully_preserved - the look of <Picture 1> in every frame and from every angle.\n"
        "<Subject 2>: fully_preserved - unchanged.\n"
        "<Video 1>: partially_preserved - keep framing, camera motion, timing and the silhouette's motion; no "
        "black, gray or blurred areas remain in the result.\n\n"
        "detailed_description:\n"
        "[Shot 1] Same composition and camera as <Video 1>. <Subject 1> is a natural, fully detailed person filling "
        "the silhouette: body posture, gestures, head turns and steps follow the silhouette moment by moment; the "
        "face is expressive, with mouth movements that follow the speech or singing in the soundtrack. Lighting and "
        "color of <Subject 1> match the scene. Do not copy the background or pose of <Picture 1>. One continuous "
        "shot, no cuts."
        + (f"\n\n{hint}" if hint else ""))


def head_prompt(t, shape, hint=""):
    """«Лицо и причёска»: в <Video 1> закрашена только голова — модель рисует голову с <Picture 1>."""
    return (
        f"In <Video 1>, the head of {t} has been replaced by {shape}. Fill it with the head of the person shown in "
        "<Picture 1>; the body, clothing and everything else stay exactly as in <Video 1>.\n\n"
        "subject_definitions:\n"
        "<Subject 1> is the head of the person from <Picture 1>: facial features, face shape, skin tone, hairstyle "
        "and hair color.\n"
        f"<Subject 2> is the body and clothing of {t} in <Video 1>, plus the background, lighting and other people.\n"
        "<Video 1> is the source video: the shape gives the exact position, size, tilt and turns of the head over "
        "time; the soundtrack gives the timing of speech or singing.\n\n"
        "summary:\n"
        "[video editing + reference generation] An edited version of <Video 1> in which the head becomes "
        "<Subject 1>, naturally joined to the neck and shoulders of <Subject 2>, while <Subject 2> stays unchanged.\n\n"
        "retention_analysis:\n"
        "<Subject 1>: fully_preserved - the face and hair of <Picture 1> in every frame and from every angle.\n"
        "<Subject 2>: fully_preserved - unchanged body, clothing, pose and background.\n"
        "<Video 1>: partially_preserved - keep framing, camera motion, timing and head motion; no black, gray or "
        "blurred areas remain in the result.\n\n"
        "detailed_description:\n"
        "[Shot 1] Same composition and camera as <Video 1>. The head of <Subject 1> turns, tilts and nods exactly "
        "as in <Video 1>; skin tone of the face matches the neck; the face is expressive, with mouth movements that "
        "follow the speech or singing in the soundtrack. Lighting and color match the scene. One continuous shot, "
        "no cuts."
        + (f"\n\n{hint}" if hint else ""))


def _files(kind):
    try:
        import folder_paths
        return list(folder_paths.get_filename_list(kind))
    except Exception:
        return []


def auto_file(role):
    """Файл для роли прямо сейчас: из пакета или любая его замена, что уже лежит."""
    try:
        for e in downloader.default_pack()[1]["files"]:
            if e["role"] == role:
                for n in [downloader.file_name(e)] + list(e.get("alternatives") or []):
                    f = E.find_file(e["kind"], n)
                    if f:
                        return f
    except Exception:
        pass
    return None


def _main(label, **o):
    return dict(o, h3_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, h3_main=False, display_name=label)


def _model_combo(role, label):
    return ([AUTO_MODEL] + _files(ROLES[role]), _exp(label, default=AUTO_MODEL, tooltip=AUTO_TIP))


class NeronH3HeroSwap:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("VIDEO", "IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "frames", "audio", "mask_preview", "frames_count")   # mask_preview: маска + образец
    OUTPUT_NODE = False
    DESCRIPTION = ("Замена героя: тот же клип (танец, камера, фон, звук), но с человеком с фото. Меняется только "
                   "человек под маской, всё остальное — пиксели оригинала. Заменяйте себя и тех, кто согласен.\n"
                   "Hero Swap: the same clip with the person from the photo. Only the masked person changes; "
                   "everything else stays the original. Swap yourself and people who agreed.")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video": ("VIDEO", {"tooltip": "Клип, где меняем героя (штатный Load Video). Любая частота кадров — "
                                               "нода сама приведёт к 24 к/с.\n\nEN: The clip (standard Load Video)."}),
                "photo": ("IMAGE", {"tooltip": "Фото «на кого» (штатный Load Image). Лучше: лицо хорошо видно, ровный "
                                               "свет; для «весь облик» — человек в полный рост.\n\nEN: Photo of the new "
                                               "person. Face clearly visible; full body for «whole look»."}),
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать тонкие настройки.\n\nEN: Show fine settings.")),
                "who": (E.WHO, _main("кого менять / who", default=E.WHO[0],
                        tooltip="Кого ищем в первом кадре: самого крупного, левого, правого, в центре или всех.\n"
                                "«Все люди» с одним фото — все станут одним человеком. Пару по очереди: сначала левого "
                                "(фото 1), потом результат — ещё раз, правого (фото 2).\n\nEN: Who to swap. For a "
                                "couple — run twice: left with photo 1, then the result again, right with photo 2.")),
                "what": (WHAT, _main("что менять / what", default=WHAT[0],
                         tooltip="🧍 весь облик — лицо, причёска, телосложение и одежда с фото.\n🙂 лицо и причёска — "
                                 "одежда и тело остаются из клипа.\n\nEN: whole look — face, hair, body and clothes "
                                 "from the photo; face & hair — clothes and body stay from the clip.")),
                "seconds": ("FLOAT", _main("не длиннее, с / max seconds", default=5.0, min=2.0, max=15.0, step=0.5,
                            display="slider",
                            tooltip="Сколько секунд клипа взять (от начала). Начни с 5 с — проверь, что замена "
                                    "держится, потом длиннее. H3 обучена до 15 с.\n\nEN: Seconds of the clip to use, "
                                    "from the start. Start with 5 s.")),
                "sound": (SOUND, _main("звук / sound", default=SOUND[0],
                          tooltip="🎵 оригинал — звук клипа как есть, байт в байт. ✨ сгенерировать — звук делает H3.\n\n"
                                  "EN: original — the clip's sound as is; generate — H3 makes it.")),
                "quality": (QUALITY, _main("качество / quality", default=QUALITY[0],
                            tooltip="480p — быстрее и легче для видеокарты 16 ГБ. 768p — как у автора LoRA, заметно "
                                    "тяжелее (клип идёт в расчёт целиком рядом с роликом).\n\nEN: 480p — faster, "
                                    "lighter on 16 GB; 768p — the LoRA author's size, much heavier.")),
                "shape": (SHAPE_NAMES, _main("форма кадра / frame shape", default=SHAPE_NAMES[0],
                          tooltip="🎬 как в клипе — без изменений. Другая форма — клип встаёт в кадр целиком, а пустые "
                                  "края модель дорисует (например, из вертикального видео со смартфона — широкий "
                                  "кадр 16:9). Размер — по «качеству» (короткая сторона 480 или 768).\n✏ ручной — "
                                  "свои ширина и высота.\nПровода width/height главнее — тогда эти поля не работают.\n\n"
                                  "EN: as in clip — unchanged. Another shape — the clip fits inside and the model "
                                  "paints the empty borders (phone vertical → 16:9). Size follows «quality». Manual — "
                                  "your own width/height. Wired width/height win over these fields.")),
                "manual_width": ("INT", _main("ручной · ширина / manual width", default=1344, min=256, max=4096,
                                 step=32, tooltip="Только при «✏ ручной». Больше паспорта H3 (1344×768 по площади) "
                                                  "не будет — уменьшится с той же формой.\n\nEN: Only with manual; "
                                                  "clamped to the H3 passport area, same shape.")),
                "manual_height": ("INT", _main("ручной · высота / manual height", default=768, min=256, max=4096,
                                  step=32, tooltip="Только при «✏ ручной».\n\nEN: Only with manual.")),
                "hint": ("STRING", _exp("уточнение / hint", default="", multiline=True,
                         tooltip="Необязательно, лучше по-английски. Например: «She wears the red dress from "
                                 "<Picture 1>». Дописывается к тексту, который нода пишет сама.\n\nEN: Optional, "
                                 "appended to the node's own prompt.")),
                "seed": ("INT", _exp("сид / seed", default=904234, min=0, max=0xffffffffffffffff,
                         tooltip="Другой сид — другой вариант. EN: Another seed — another take.")),
                "steps": ("INT", _exp("шаги / steps", default=8, min=4, max=20,
                          tooltip="Турбо-LoRA рассчитана на 8 шагов (рецепт автора). EN: The turbo LoRA is made for 8.")),
                "swap_strength": ("FLOAT", _exp("сила замены / swap strength", default=1.0, min=0.0, max=1.5,
                                  step=0.05, tooltip="LoRA замены. Автор: 1.0. 0 — для сравнения без неё.\n\nEN: The "
                                                     "swap LoRA strength. Author: 1.0.")),
                "expand_px": ("INT", _exp("запас маски, пикс. (0 — авто) / mask margin, px (0 — auto)", default=0,
                              min=0, max=256,
                              tooltip="0 — авто по проверкам: лицо — 5, весь облик — 25.\nМеньше — одежда ближе к "
                                      "форме клипа; больше — модели свободнее (одежда больше с фото).\n\nEN: 0 — auto "
                                      "(face 5, whole look 25). Less — clothing follows the clip; more — freer.")),
                "keep_outside": ("BOOLEAN", _exp("вне маски — оригинал / keep outside", default=True,
                                 tooltip="После генерации вне маски вклеить настоящие пиксели клипа — фон совпадёт с "
                                         "оригиналом точно.\n\nEN: Paste the real clip pixels outside the mask.")),
                "feather_px": ("INT", _exp("мягкий край, пикс. / soft edge, px", default=12, min=0, max=64,
                               tooltip="Ширина мягкого перехода у края маски.\n\nEN: Soft edge width.")),
                "threshold": ("FLOAT", _exp("порог поиска / detection threshold", default=0.35, min=0.05, max=0.95,
                              step=0.05, tooltip="Ниже — находит людей увереннее, но может схватить лишнее.\n\nEN: Lower "
                                                 "finds people more easily.")),
                "ref_quality": (["match", "max"], _exp("качество фото-образца / photo quality", default="match",
                                tooltip="match — фото под размер кадра (быстрее, так у автора). max — в полном качестве: "
                                        "лицо узнаётся лучше, медленнее.\n\nEN: match — faster (author's); max — better "
                                        "likeness, slower.")),
                "fast_attention": ("BOOLEAN", _exp("быстрое внимание INT8 / fast attention", default=True,
                                   tooltip="Как у автора LoRA: быстрее и легче для памяти. Выключи, если видишь "
                                           "морфинг.\n\nEN: As the LoRA author: faster, lighter. Turn off on morphing.")),
                "unet_model": _model_combo("unet", "модель H3 Ref2VA / model"),
                "clip_model": _model_combo("clip", "текстовый энкодер / text encoder"),
                "vae_video_model": _model_combo("vae_video", "VAE видео / video VAE"),
                "vae_audio_model": _model_combo("vae_audio", "VAE звука / audio VAE"),
                "turbo_lora_model": _model_combo("turbo_lora", "турбо-LoRA / turbo LoRA"),
                "swap_lora_model": _model_combo("swap_lora", "LoRA замены / swap LoRA"),
                "sam_model": _model_combo("sam", "SAM 3.1"),
                # новое — строго в конец: сохранённые схемы хранят значения по порядку
                "blur_strength": ("FLOAT", _exp("сила размытия / blur strength", default=0.5, min=0.1, max=1.0,
                                  step=0.05, tooltip="Идея Романа: ДО генерации человек (или голова) в клипе-образце "
                                  "размывается — модели нечего копировать, а свет, цвета и движение остаются.\n"
                                  "0.5 — лучшее по проверкам. 1.0 — черт не видно совсем, больше от фото. 0.4 — "
                                  "смесь оригинала и фото («двойник»). Ниже 0.4 модель повторяет оригинал.\n\nEN: The "
                                  "person (or head) in the reference clip is blurred before generation — nothing to "
                                  "copy, light, colors and motion stay. 0.5 — best in tests; 1.0 — more of the photo; "
                                  "0.4 — a mix of original and photo; below 0.4 the original returns.")),
                "tight_edges": ("BOOLEAN", _exp("точные края / tight edges", default=True,
                                tooltip="После генерации SAM ещё раз находит НОВОГО человека, и вклеивается только "
                                        "он. Полоса запаса вокруг снова — настоящие резкие пиксели клипа: края не "
                                        "«плывут». +ещё один короткий проход SAM.\n\nEN: After generation SAM finds "
                                        "the NEW person and only they are pasted in; the margin band becomes the "
                                        "clip's real sharp pixels again. One more short SAM pass.")),
            },
            "optional": {
                "width": ("INT", {"forceInput": True,
                                  "tooltip": "Внешняя ширина. С проводами width + height качество, форма и ручной "
                                             "размер не работают. Больше паспорта H3 не будет.\n\nEN: External "
                                             "width; with width + height wired, quality/shape/manual are ignored."}),
                "height": ("INT", {"forceInput": True, "tooltip": "Внешняя высота. EN: External height."}),
                "prompt": ("STRING", {"forceInput": True,
                                      "tooltip": "Профи: свой текст целиком вместо текста ноды. Назови <Video 1> и "
                                                 "<Picture 1>.\n\nEN: Your own full prompt; mention <Video 1> and "
                                                 "<Picture 1>."}),
            },
        }

    def generate(self, video, photo, expert=False, who=E.WHO[0], what=WHAT[0], quality=QUALITY[0], seconds=5.0,
                 sound=SOUND[0], hint="", seed=904234, steps=8, swap_strength=1.0, expand_px=0, keep_outside=True,
                 feather_px=12, threshold=0.35, ref_quality="match", fast_attention=True, unet_model=AUTO_MODEL,
                 clip_model=AUTO_MODEL, vae_video_model=AUTO_MODEL, vae_audio_model=AUTO_MODEL,
                 turbo_lora_model=AUTO_MODEL, swap_lora_model=AUTO_MODEL, sam_model=AUTO_MODEL,
                 blur_strength=0.5, tight_edges=True, shape=None, manual_width=1344, manual_height=768,
                 width=None, height=None, prompt=None):
        notes = []
        for need in ("MiniMaxH3ReferenceToVideo", "MiniMaxH3AddGuide", "SAM3_Detect", "SAM3_VideoTrack"):
            if not E.has_node(need):
                raise E.FriendlyError(f"{E.TAG} В ComfyUI нет ноды «{need}». Обнови ComfyUI — нужны MiniMax H3 и "
                                      f"SAM3.\n\nEN: ComfyUI lacks «{need}». Update ComfyUI.")

        # ---- модели ----
        picked = {"unet": unet_model, "clip": clip_model, "vae_video": vae_video_model, "vae_audio": vae_audio_model,
                  "turbo_lora": turbo_lora_model, "swap_lora": swap_lora_model, "sam": sam_model}
        models = {}
        for role, v in picked.items():
            if v in (None, "", AUTO_MODEL, NOT_FOUND):
                models[role] = auto_file(role)
            else:
                models[role] = E.find_file(ROLES[role], v)
                if not models[role]:
                    notes.append(f"⚠ Файла «{v}» нет — взят «авто». EN: «{v}» not found, using auto.")
                    models[role] = auto_file(role)
        missing = [r for r, f in models.items() if not f]
        if missing:
            raise E.FriendlyError(
                f"{E.TAG} Не хватает моделей: " + ", ".join(ROLE_NAMES[m] for m in missing) + ". Нажми на ноде "
                "«📥 Модели» — она скачает только недостающее и разложит по папкам.\n\nEN: Missing models. Press "
                "«📥 Модели / Models» on the node — it downloads only what is missing.")
        if "fl2va" in E.base(models["unet"]).lower():
            notes.append("⚠ Выбрана модель fl2va — для замены нужна Ref2VA, результат будет хуже. EN: fl2va selected — "
                         "Ref2VA is needed for swaps.")

        # ---- клип ----
        comp = video.get_components()
        frames, fps, audio = comp.images, float(comp.frame_rate), comp.audio
        frames = E.to_24(frames.float(), fps)
        n_src = int(frames.shape[0])
        length = E.grid_fit(int(round(float(seconds) * E.FPS)), n_src)
        if not length:
            raise E.FriendlyError(f"{E.TAG} Клип слишком короткий: нужно хотя бы 2 секунды.\n\nEN: The clip is too "
                                  f"short — at least 2 seconds.")
        frames = frames[:length]
        notes.append(f"Клип: {n_src / E.FPS:.2f} с при {fps:g} к/с → взято {length} кадров ({length / E.FPS:.2f} с, "
                     f"сетка H3 17k+5)")
        if audio is not None:
            audio = E.fit_audio(audio, length / E.FPS)

        text = prompt.strip() if (prompt or "").strip() else blur_prompt(who, what, hint)
        head = what == WHAT[1]
        margin = int(expand_px) if int(expand_px) > 0 else (5 if head else 25)
        notes.append(f"Запас маски: {margin} пикс." + ("" if int(expand_px) > 0 else " (авто)"))
        notes.append("Текст: " + ("свой" if (prompt or "").strip() else f"{what.split(' / ')[0]} · "
                                  f"{who.split(' / ')[0]}"))
        # ---- размер кадра: провода → ручной → форма → как в клипе ----
        short = SHORT.get(quality, 480)
        form = SHAPES.get(shape)
        if width is not None and height is not None and int(width) > 0 and int(height) > 0:
            size = E.fit_size(int(width), int(height))
            notes.append(f"Размер с проводов: {int(width)}×{int(height)} → {size[0]}×{size[1]} (качество и форма "
                         f"на ноде не работают)")
        elif form == "manual":
            size = E.fit_size(int(manual_width), int(manual_height))
            notes.append(f"Ручной размер: {int(manual_width)}×{int(manual_height)} → {size[0]}×{size[1]}")
        elif form:
            size = E.shape_size(form[0], form[1], short)
            notes.append(f"Форма кадра {shape.split(' / ')[0]} → {size[0]}×{size[1]}")
        else:
            size = short
        try:
            out, out_audio, preview, report = E.generate(
                frames, audio, photo, text, size, int(seed), int(steps), float(swap_strength),
                models, who, float(threshold), margin, bool(keep_outside), int(feather_px), ref_quality,
                bool(fast_attention), sound == SOUND[0], head,
                float(blur_strength), bool(tight_edges))
        except Exception:
            E.free("после ошибки / after error")
            raise
        vid = E.node("CreateVideo", images=out, fps=float(E.FPS), audio=out_audio)[0]
        lines = notes + report
        for line in lines:
            log.info("%s %s", E.TAG, line)
        return {"ui": {"text": ["\n".join(lines)]}, "result": (vid, out, out_audio, preview, int(out.shape[0]))}


NODE_CLASS_MAPPINGS = {"NeronH3HeroSwap": NeronH3HeroSwap}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3HeroSwap": "🎭 Neron H3 Замена героя / Hero Swap"}
