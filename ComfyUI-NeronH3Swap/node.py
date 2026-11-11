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
         "turbo_lora": "loras", "swap_lora": "loras", "sam": "checkpoints", "pose": "checkpoints"}
ROLE_NAMES = {"unet": "модель H3 Ref2VA / H3 Ref2VA model", "clip": "текстовый энкодер / text encoder",
              "vae_video": "VAE видео / video VAE", "vae_audio": "VAE звука / audio VAE",
              "turbo_lora": "турбо-LoRA / turbo LoRA", "swap_lora": "LoRA замены / swap LoRA",
              "sam": "SAM 3.1 (маска человека / person mask)",
              "pose": "SDPose (скелет для режима 🦴 / skeleton for 🦴 mode)"}

WHAT = ["🧍 весь облик / whole look", "🙂 лицо и причёска / face & hair"]
QUALITY = ["⚡ 480p — быстрее, для 16 ГБ / faster", "🎯 768p — как у автора LoRA, тяжелее / heavier"]
SHORT = {QUALITY[0]: 480, QUALITY[1]: 768}
SOUND = ["🎵 оригинал / original", "✨ сгенерировать / generate"]
TARGET = {E.WHO[0]: "the main person", E.WHO[1]: "the person on the left", E.WHO[2]: "the person on the right",
          E.WHO[3]: "the person in the center", E.WHO[4]: "every person"}

AUTO_TIP = ("🤖 авто — файл из пакета (или его другая версия, что уже лежит). Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file (or another version you have). Missing — press «📥 Models».")


def silhouette_prompt(who, what, fill, hint=""):
    """Текст для режима «силуэт»: в <Video 1> человек закрашен — модель заполняет его человеком с <Picture 1>."""
    shape = {E.FILL[0]: "a solid black silhouette", E.FILL[1]: "a flat gray silhouette",
             E.FILL[2]: "a blurred silhouette"}.get(fill, "a silhouette")
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


def skeleton_prompt(who, what, hint="", black=False):
    """Текст для режима «🦴 скелет»: в <Video 1> человека нет — пустая сцена и цветной скелет позы поверх."""
    t = TARGET.get(who, "the main person")
    if what == WHAT[1]:
        look = "facial features, face shape, skin tone and hairstyle from <Picture 1>; clothing that suits the scene"
    else:
        look = "facial features, face shape, hairstyle, hair color, skin tone, body build and clothing from <Picture 1>"
    hint = (hint or "").strip()
    return (
        f"In <Video 1>, {t} has been erased from the scene; only "
        + ("a thick black stick figure" if black else "a colored pose skeleton (a stick figure with joints, hands "
           "and face points)")
        + " remains, showing where the person is and how they move. Put the person shown in <Picture 1> onto this "
        "skeleton.\n\n"
        "subject_definitions:\n"
        f"<Subject 1> is the person from <Picture 1> ({look}). <Subject 1> stands exactly on the skeleton in "
        "<Video 1>, in every frame: head on the head points, shoulders, elbows, wrists, hips, knees and feet on the "
        "joints.\n"
        "<Subject 2> is the scene of <Video 1>: background, lighting, objects and other people.\n"
        "<Video 1> is the source video: the skeleton gives the exact position, scale, pose and movement over time; "
        "the face points give head turns and mouth opening; the soundtrack gives the timing of speech or singing.\n\n"
        "summary:\n"
        "[pose-driven video editing + reference generation] An edited version of <Video 1> in which <Subject 1>, a "
        "real person, performs exactly the movements of the skeleton, while <Subject 2> stays unchanged.\n\n"
        "retention_analysis:\n"
        "<Subject 1>: fully_preserved - the look and the clothing of <Picture 1> in every frame and from every angle.\n"
        "<Subject 2>: fully_preserved - unchanged.\n"
        "<Video 1>: partially_preserved - keep framing, camera motion, timing and the skeleton's motion; the skeleton "
        "lines and dots themselves are never drawn in the result.\n\n"
        "detailed_description:\n"
        "[Shot 1] Same composition and camera as <Video 1>. <Subject 1> is a natural, fully detailed person whose "
        "body follows the skeleton moment by moment: posture, gestures, head turns and steps. The body shape and "
        "clothing come from <Picture 1>, not from the empty area around the skeleton. The face is expressive, with "
        "mouth movements that follow the speech or singing in the soundtrack. Lighting and color of <Subject 1> "
        "match the scene. Do not copy the background or pose of <Picture 1>. One continuous shot, no cuts."
        + (f"\n\n{hint}" if hint else ""))


def swap_prompt(who, what, hint=""):
    """Текст для модели — в РОДНОМ формате брифа MiniMax H3 (subject_definitions / summary / retention_analysis /
    detailed_description): так пишет её собственный улучшатель промптов, на таких текстах она и LoRA замены
    учились. Слова — наши: облик — с фото, игра — из клипа, сцена — нетронута."""
    t = TARGET.get(who, "the main person")
    if what == WHAT[1]:
        look = ("facial features, face shape, skin tone and hairstyle from <Picture 1>; the body, clothing and "
                "accessories stay as worn by the original person in <Video 1>")
        keep_look = "face and hairstyle"
    else:
        look = ("facial features, face shape, hairstyle, hair color, skin tone, body build and clothing from "
                "<Picture 1>")
        keep_look = "face, hairstyle, body build and clothing"
    hint = (hint or "").strip()
    return (
        f"Replace {t} in <Video 1> with the person shown in <Picture 1>.\n\n"
        "subject_definitions:\n"
        f"<Subject 1> is the new person: appearance comes from <Picture 1> ({look}); the performance comes from "
        f"{t} in <Video 1>. <Picture 1> supplies appearance only, not its pose, expression, background or framing.\n"
        "<Subject 2> is everything else in <Video 1>: the background, lighting, objects and all other people.\n"
        "<Video 1> is the source video being edited; it supplies the composition, camera movement, timing and "
        "every action.\n\n"
        "summary:\n"
        f"[video editing + reference generation] An edited version of <Video 1> in which {t} is replaced by "
        "<Subject 1>, who performs exactly the same movements, while <Subject 2> and the camera stay unchanged.\n\n"
        "retention_analysis:\n"
        f"<Subject 1>: fully_preserved - keep the {keep_look} of <Picture 1> in every frame, from every angle and "
        "with every expression; do not drift back to the original person's look.\n"
        "<Subject 2>: fully_preserved - unchanged.\n"
        "<Video 1>: partially_preserved - keep framing, camera motion, timing and duration; change only the "
        "replaced person's appearance.\n\n"
        "detailed_description:\n"
        "[Shot 1] Same composition and viewpoint as <Video 1>. <Subject 1> stands where the original person "
        "stands, at the same scale, and matches the original performance moment by moment: posture, gestures, "
        "head turns, gaze, blinking, facial expressions and mouth movements. Lighting, shading and color of "
        "<Subject 1> follow the scene of <Video 1>. Hair and clothing move naturally. Keep the crop and shot "
        "scale of <Video 1>; do not copy the background or pose of <Picture 1>. One continuous shot, no cuts."
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
                "quality": (QUALITY, _main("качество / quality", default=QUALITY[0],
                            tooltip="480p — быстрее и легче для видеокарты 16 ГБ. 768p — как у автора LoRA, заметно "
                                    "тяжелее (клип идёт в расчёт целиком рядом с роликом).\n\nEN: 480p — faster, "
                                    "lighter on 16 GB; 768p — the LoRA author's size, much heavier.")),
                "seconds": ("FLOAT", _main("не длиннее, с / max seconds", default=5.0, min=2.0, max=15.0, step=0.5,
                            display="slider",
                            tooltip="Сколько секунд клипа взять (от начала). Начни с 5 с — проверь, что замена "
                                    "держится, потом длиннее. H3 обучена до 15 с.\n\nEN: Seconds of the clip to use, "
                                    "from the start. Start with 5 s.")),
                "sound": (SOUND, _main("звук / sound", default=SOUND[0],
                          tooltip="🎵 оригинал — звук клипа как есть, байт в байт. ✨ сгенерировать — звук делает H3.\n\n"
                                  "EN: original — the clip's sound as is; generate — H3 makes it.")),
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
                "expand_px": ("INT", _exp("запас маски, пикс. / mask margin, px", default=64, min=0, max=256,
                              tooltip="На сколько расширить маску человека (при 768p; для 480p — пропорционально). "
                                      "Мало — обрежет волосы и одежду; много — заденет фон.\n\nEN: Mask growth (at "
                                      "768p).")),
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
                "ref_fill": (E.FILL, _exp("человек в образце / person in reference", default=E.FILL[0],
                             tooltip="Идея Романа: ДО генерации закрасить человека в видео-образце. Модели нечего "
                                     "копировать — облик берётся с фото, а силуэт по-прежнему задаёт движение.\n"
                                     "⬛ чёрный — по умолчанию; ◻ серый или 🌫 размытие — если модель рисует тёмную "
                                     "фигуру; «оригинал» — как в 0.1 (для сравнения).\n\nEN: Blank out the person in "
                                     "the reference video before generation, so the model cannot copy them; the "
                                     "silhouette still drives the motion.\n\n🦴 скелет (0.3): человек стёрт "
                                     "в фон, поверх — его скелет (SDPose). Форма платья не видна, только поза: "
                                     "одежда берётся с фото. Нужна модель SDPose («📥 Модели»).\n\nEN: 🦴 skeleton: "
                                     "the person is erased, only their pose skeleton remains; clothing comes from "
                                     "the photo. Needs the SDPose model.\n\n🦴⬛ чёрный скелет: то же, но скелет — толстыми "
                                     "чёрными палками (силуэт толщиной в скелет).\nEN: the same, drawn as a thick "
                                     "black stick figure.")),
                "pose_model": _model_combo("pose", "SDPose (скелет / skeleton)"),
                "blur_strength": ("FLOAT", _exp("сила размытия / blur strength", default=1.0, min=0.1, max=1.0,
                                  step=0.05, tooltip="Только для 🌫 размытия. 1.0 — черт не видно совсем. Меньше — "
                                  "проступают контуры лица и свет: новое лицо ложится естественнее, но если слишком "
                                  "мало — модель начнёт повторять лицо оригинала. Пробуй 0.5–0.8.\n\nEN: Only for 🌫 "
                                  "blur. 1.0 — no features visible. Lower — face contours show through: a more "
                                  "natural fit, but too low and the model copies the original face. Try 0.5–0.8.")),
                "tight_edges": ("BOOLEAN", _exp("точные края / tight edges", default=True,
                                tooltip="После генерации SAM ещё раз находит НОВОГО человека, и вклеивается только "
                                        "он. Полоса запаса вокруг снова — настоящие резкие пиксели клипа: края не "
                                        "«плывут». +ещё один короткий проход SAM.\n\nEN: After generation SAM finds "
                                        "the NEW person and only they are pasted in; the margin band becomes the "
                                        "clip's real sharp pixels again. One more short SAM pass.")),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True,
                                      "tooltip": "Профи: свой текст целиком вместо текста ноды. Назови <Video 1> и "
                                                 "<Picture 1>.\n\nEN: Your own full prompt; mention <Video 1> and "
                                                 "<Picture 1>."}),
            },
        }

    def generate(self, video, photo, expert=False, who=E.WHO[0], what=WHAT[0], quality=QUALITY[0], seconds=5.0,
                 sound=SOUND[0], hint="", seed=904234, steps=8, swap_strength=1.0, expand_px=64, keep_outside=True,
                 feather_px=12, threshold=0.35, ref_quality="match", fast_attention=True, unet_model=AUTO_MODEL,
                 clip_model=AUTO_MODEL, vae_video_model=AUTO_MODEL, vae_audio_model=AUTO_MODEL,
                 turbo_lora_model=AUTO_MODEL, swap_lora_model=AUTO_MODEL, sam_model=AUTO_MODEL, ref_fill=None,
                 pose_model=AUTO_MODEL, blur_strength=1.0, tight_edges=True,
                 prompt=None):
        notes = []
        ref_fill = ref_fill if ref_fill in E.FILL else E.FILL[0]
        skeleton = ref_fill in E.SKELETONS
        needs = ["MiniMaxH3ReferenceToVideo", "MiniMaxH3AddGuide", "SAM3_Detect", "SAM3_VideoTrack"]
        if skeleton:
            needs += ["SDPoseKeypointExtractor", "SDPoseDrawKeypoints"]
        for need in needs:
            if not E.has_node(need):
                raise E.FriendlyError(f"{E.TAG} В ComfyUI нет ноды «{need}». Обнови ComfyUI — нужны MiniMax H3 и "
                                      f"SAM3.\n\nEN: ComfyUI lacks «{need}». Update ComfyUI.")

        # ---- модели ----
        picked = {"unet": unet_model, "clip": clip_model, "vae_video": vae_video_model, "vae_audio": vae_audio_model,
                  "turbo_lora": turbo_lora_model, "swap_lora": swap_lora_model, "sam": sam_model}
        if skeleton:
            picked["pose"] = pose_model
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

        if (prompt or "").strip():
            text = prompt.strip()
        elif ref_fill == E.FILL[3]:
            text = swap_prompt(who, what, hint)
        elif skeleton:
            text = skeleton_prompt(who, what, hint, ref_fill == E.BLACK_SKELETON)
        else:
            text = silhouette_prompt(who, what, ref_fill, hint)
        notes.append("Текст: " + ("свой" if (prompt or "").strip() else f"{what.split(' / ')[0]} · "
                                  f"{who.split(' / ')[0]}"))
        try:
            out, out_audio, preview, report = E.generate(
                frames, audio, photo, text, SHORT.get(quality, 480), int(seed), int(steps), float(swap_strength),
                models, who, float(threshold), int(expand_px), bool(keep_outside), int(feather_px), ref_quality,
                bool(fast_attention), sound == SOUND[0], ref_fill, what == WHAT[1],
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
