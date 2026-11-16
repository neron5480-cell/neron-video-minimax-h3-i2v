# -*- coding: utf-8 -*-
"""🖼 Neron Image — картинка по тексту на Krea 2 (официальные модели Comfy-Org), с автопромтером.

Новичок видит: промпт, автопромтер, форму кадра, качество, вариант. Всё тонкое — за ⚙ экспертом.
Модели — «🤖 авто» и кнопка «📥 Модели» (качает только то, что нужно этой ноде).
"""
import logging

from . import downloader
from . import engine as E

log = logging.getLogger("Neron.Image")
NOT_FOUND = "__not_found__"
AUTO_MODEL = "🤖 авто — из пакета / auto — from pack"
ROLES = {"unet": "diffusion_models", "clip": "text_encoders", "vae": "vae"}
ROLE_NAMES = {"unet": "модель Krea 2 / Krea 2 model", "clip": "текстовый энкодер (он же автопромтер) / text encoder",
              "vae": "VAE"}
# если bf16 нет — берём сжатую версию Turbo (в порядке качества) и честно пишем об этом
UNET_FALLBACK = ["krea2_turbo_bf16.safetensors", "krea2_turbo_fp8_scaled.safetensors",
                 "krea2_turbo_mxfp8.safetensors", "krea2_turbo_int8_convrot.safetensors",
                 "krea2_turbo_fp8.safetensors", "krea2_turbo_nvfp4.safetensors"]

AUTO_TIP = ("🤖 авто — файл из пакета. Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file. Missing — press «📥 Models».")


def _samplers():
    try:
        import comfy.samplers
        return list(comfy.samplers.KSampler.SAMPLERS), list(comfy.samplers.KSampler.SCHEDULERS)
    except Exception:
        return [E.SAMPLER], [E.SCHEDULER]


def auto_file(role):
    """Файл для роли прямо сейчас: из пакета; для модели — ещё и сжатые версии Turbo."""
    names = []
    try:
        for e in downloader.default_pack()[1]["files"]:
            if e["role"] == role:
                names = [downloader.file_name(e)] + list(e.get("alternatives") or [])
    except Exception:
        pass
    if role == "unet":
        names += [n for n in UNET_FALLBACK if n not in names]
    for n in names:
        f = E.find_file(ROLES[role], n)
        if f:
            return f
    return None


def _main(label, **o):
    return dict(o, neron_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, neron_main=False, display_name=label)


def _model_combo(role, label):
    return ([AUTO_MODEL] + E.files(ROLES[role]), _exp(label, default=AUTO_MODEL, tooltip=AUTO_TIP))


class NeronImage:
    CATEGORY = "Neron/Image"
    FUNCTION = "generate"
    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "prompt")
    OUTPUT_NODE = False
    DESCRIPTION = ("Картинка по тексту на Krea 2 (официальные модели Comfy-Org). Пиши как хочешь, хоть по-русски — "
                   "автопромтер переведёт и распишет. Выход prompt — готовый английский промпт.\n"
                   "Text to image on Krea 2 (official Comfy-Org models) with a built-in prompter.")

    @classmethod
    def INPUT_TYPES(cls):
        samplers, schedulers = _samplers()
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать тонкие настройки.\n\nEN: Show fine settings.")),
                "text": ("STRING", _main("что нарисовать / what to draw", default="", multiline=True,
                         placeholder="Например: рыжий кот-астронавт в стеклянном шлеме на фоне Земли, 3D мультфильм\n"
                                     "EN: e.g. a ginger cat astronaut in a glass helmet, Earth behind, 3D cartoon",
                         tooltip="Опиши картинку своими словами — по-русски или по-английски. Текст, который должен "
                                 "быть НА картинке, бери в кавычки: вывеска \"Neron\".\n\nEN: Describe the picture in "
                                 "any language. Words to be written IN the image go in quotes.")),
                "prompter": (E.PROMPTER, _main("автопромтер / prompter", default=E.MODE_DETAIL,
                             tooltip="🎨 до мелочей — всё, что ты написал, остаётся как есть; всё, чего не написал "
                                     "(одежда, материалы, детали механизмов, место, свет, объектив, стиль), промптер "
                                     "придумает конкретно. Flux и Krea лучше всего рисуют по таким промптам.\n"
                                     "✨ расписать — официальная инструкция Krea: сдержанно, без выдуманных деталей.\n"
                                     "🌐 подправить — только перевод и лёгкая шлифовка.\n"
                                     "✍ как есть — текст уходит в модель без изменений (пиши по-английски).\n"
                                     "⚠ Промптер маленький: лёгкие сцены — отлично; много персонажей, каждого надо прописать — "
                                     "напиши промпт сам или попроси большую ИИ (Gemini, ChatGPT…) и вставь с «✍ как "
                                     "есть» (готовая просьба — в 📖 Справке).\n"
                                     "Готовый промпт видно внизу ноды и на выходе prompt. Тот же текст и режим — "
                                     "промптер второй раз не гоняется.\n\nEN: every detail — your words stay, gaps "
                                     "are filled with concrete details; expand — the official, restrained Krea "
                                     "instruction; polish — translate and lightly fix; as is — unchanged. The prompter is "
                                     "small: busy scenes with many characters — write the prompt yourself or use a big AI "
                                     "and paste it with «as is».")),
                "aspect": (E.ASPECT_NAMES, _main("форма кадра / aspect", default=E.ASPECT_NAMES[0],
                           tooltip="Соотношение сторон картинки.\n\nEN: Picture aspect ratio.")),
                "quality": (E.QUALITY_NAMES, _main("качество / quality", default=E.QUALITY_NAMES[2],
                            tooltip="Сколько деталей (площадь кадра): 1K ≈ 1 Мп, 1.5K ≈ 2,3 Мп, 2K ≈ 4 Мп. Krea 2 "
                                    "Turbo по словам авторов рисует от 1K до 2K — 2K максимум.\n\nEN: Detail level "
                                    "(frame area): 1K ≈ 1 MP, 1.5K ≈ 2.3 MP, 2K ≈ 4 MP — the Turbo maximum.")),
                "sharpness": ("FLOAT", _main("резкость / sharpness", default=1.0, min=0.0, max=1.5, step=0.05,
                              display="slider",
                              tooltip="Чётче края после рисования (мягкая нерезкая маска). Деталей не придумывает. "
                                      "1.0 — по умолчанию (проверено на 2K). Подбирай под сюжет: крупный портрет — "
                                      "меньше (0.5–0.8), чтобы кожа не «песочила»; пейзаж, ткань, техника — можно "
                                      "1.0–1.3. 0 — как нарисовала модель.\n\nEN: Crisper edges after drawing (gentle "
                                      "unsharp mask). 1.0 by default; close-up portraits — less (0.5–0.8); landscapes, "
                                      "fabric, machines — 1.0–1.3; 0 — as drawn.")),
                "seed": ("INT", _main("вариант / seed", default=1, min=0, max=0xffffffffffffffff, control_after_generate=True,
                         tooltip="Номер варианта. Другой номер — другая картинка по тому же промпту. Понравилась — "
                                 "поставь «управление» = fixed и меняй только промпт.\n\nEN: Variant number. Another "
                                 "number — another picture from the same prompt.")),
                "count": ("INT", _exp("картинок за раз / images per run", default=1, min=1, max=4,
                          tooltip="Сколько вариантов за один прогон. На 2K и 16 ГБ — лучше по одной.\n\nEN: Variants "
                                  "per run. At 2K on 16 GB — one at a time is best.")),
                "steps": ("INT", _exp("шаги / steps", default=E.STEPS, min=4, max=30,
                          tooltip="Krea 2 Turbo сделана на 8 шагов (рецепт авторов). Больше — не обязательно лучше."
                                  "\n\nEN: Krea 2 Turbo is made for 8 steps (the authors' recipe).")),
                "cfg": ("FLOAT", _exp("CFG", default=E.CFG, min=1.0, max=8.0, step=0.1,
                        tooltip="Turbo — 1.0 (авторы: CFG выключен). Выше — для модели RAW, не для Turbo.\n\nEN: "
                                "Turbo — 1.0 (the authors disable CFG). Higher is for RAW, not Turbo.")),
                "sampler": (samplers, _exp("сэмплер / sampler", default=E.SAMPLER if E.SAMPLER in samplers
                            else samplers[0], tooltip="Рецепт авторов — euler.\n\nEN: The authors' recipe — euler.")),
                "scheduler": (schedulers, _exp("расписание / scheduler", default=E.SCHEDULER if E.SCHEDULER in
                              schedulers else schedulers[0],
                              tooltip="Рецепт авторов — simple.\n\nEN: The authors' recipe — simple.")),
                "prompter_instruction": ("STRING", _exp("своя инструкция промптеру / own prompter instruction",
                                         default="", multiline=True,
                                         placeholder="пусто — официальная инструкция Krea / empty — official",
                                         tooltip="Пусто — официальная инструкция (Comfy-Org / Krea). Можно вписать "
                                                 "свою — по-английски.\n\nEN: Empty — the official instruction.")),
                "prompter_seed": ("INT", _exp("вариант промпта / prompt variant", default=0, min=0, max=999999,
                                  tooltip="Другой номер — автопромтер распишет иначе. Сам промпт меняется только от "
                                          "этого номера, а не от «варианта» картинки.\n\nEN: Another number — the "
                                          "prompter writes it differently.")),
                "prompter_creativity": ("FLOAT", _exp("фантазия промптера / prompter creativity", default=0.7,
                                        min=0.1, max=1.5, step=0.05,
                                        tooltip="Ниже — ближе к твоим словам, выше — смелее придумывает.\n\nEN: Lower "
                                                "— closer to your words; higher — bolder.")),
                "style_lora": ([E.NO_LORA] + E.files("loras"), _exp("стиль (LoRA) / style (LoRA)", default=E.NO_LORA,
                               tooltip="Необязательно. Официальные стили Krea 2 (Comfy-Org/Krea-2, папка loras): "
                                       "krea2_darkbrush, krea2_retroanime, krea2_softwatercolor… Слова-ключ стиля "
                                       "нода допишет сама.\n\nEN: Optional style LoRA; the official Krea 2 styles' "
                                       "trigger words are added automatically.")),
                "style_strength": ("FLOAT", _exp("сила стиля / style strength", default=1.0, min=0.0, max=2.0,
                                   step=0.05, tooltip="Авторы советуют 1.0.\n\nEN: Recommended 1.0.")),
                "keep_loaded": ("BOOLEAN", _exp("держать модели / keep models loaded", default=False,
                                tooltip="Вкл — модели остаются в памяти между прогонами: серия картинок быстрее. "
                                        "Выкл (по умолчанию) — память освобождается: потом спокойно идёт видео H3. "
                                        "bf16 весит 26 ГБ — вместе с видео оперативки не хватит.\n\nEN: On — models "
                                        "stay loaded between runs (faster series). Off — memory is freed for other "
                                        "work (video).")),
                "unet_model": _model_combo("unet", "модель Krea 2 / model"),
                "clip_model": _model_combo("clip", "текстовый энкодер / text encoder"),
                "vae_model": _model_combo("vae", "VAE"),
                # новое — строго в конец: сохранённые схемы хранят значения по порядку
            },
            "optional": {
                "width": ("INT", {"forceInput": True,
                                  "tooltip": "Внешний размер (провод). С проводами width + height «форма кадра» и "
                                             "«качество» не работают. Больше 2K по площади не будет.\n\nEN: External "
                                             "size; aspect and quality are ignored."}),
                "height": ("INT", {"forceInput": True, "tooltip": "Внешняя высота. EN: External height."}),
                "prompt_text": ("STRING", {"forceInput": True,
                                           "tooltip": "Свой промпт проводом — например, из большой текстовой ноды, где "
                                                      "текст видно целиком. Подключён — поле «что нарисовать» не "
                                                      "используется. С автопромтером «✍ как есть» уходит в модель "
                                                      "без изменений.\n\nEN: Your prompt by wire (e.g. from a big text "
                                                      "node); replaces the «what to draw» field."}),
            },
        }

    def generate(self, text, expert=False, prompter=E.MODE_DETAIL, aspect=E.ASPECT_NAMES[0],
                 quality=E.QUALITY_NAMES[2], sharpness=1.0, seed=1, count=1, steps=E.STEPS, cfg=E.CFG, sampler=E.SAMPLER,
                 scheduler=E.SCHEDULER, prompter_seed=0, prompter_creativity=0.7, prompter_instruction="",
                 style_lora=E.NO_LORA, style_strength=1.0, keep_loaded=False, unet_model=AUTO_MODEL,
                 clip_model=AUTO_MODEL, vae_model=AUTO_MODEL, width=None, height=None, prompt_text=None):
        notes = []
        if (prompt_text or "").strip():
            text = prompt_text
            notes.append("Промпт — с провода prompt_text")
        if not (text or "").strip():
            raise E.FriendlyError(f"{E.TAG} Напиши, что нарисовать.\n\nEN: Write what to draw.")
        if not E.comfy_has_krea2():
            raise E.FriendlyError(f"{E.TAG} Этот ComfyUI ещё не знает Krea 2. Обнови ComfyUI Desktop.\n\nEN: This "
                                  f"ComfyUI does not support Krea 2 yet. Update ComfyUI.")

        # ---- модели ----
        picked = {"unet": unet_model, "clip": clip_model, "vae": vae_model}
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
        un = E.base(models["unet"]).lower()
        raw = "raw" in un
        if raw:
            notes.append("⚠ Выбрана RAW — сырая база для обучения LoRA, не «богаче» Turbo (тот же размер; Turbo — это "
                         "RAW + доводка по красоте). Для картинок авторы советуют krea2_turbo_bf16. EN: RAW is the "
                         "untuned base; the authors recommend Turbo for pictures.")
            if int(steps) == E.STEPS and float(cfg) == E.CFG:        # рецепт Turbo не годится — берём рецепт авторов для RAW
                steps, cfg = E.RAW_STEPS, E.RAW_CFG
                notes.append(f"RAW: рецепт авторов — {steps} шага, CFG {cfg:g}, негатив пустой (дольше в ~13 раз)")
        elif "bf16" not in un:
            notes.append(f"ℹ Модель: {E.base(models['unet'])} — сжатая. Максимум качества — krea2_turbo_bf16 "
                         "(«📥 Модели»). EN: a compressed model; bf16 is the maximum.")

        # ---- размер ----
        if width is not None and height is not None and int(width) > 0 and int(height) > 0:
            w, h = E.wired_size(width, height)
            notes.append(f"Размер с проводов: {int(width)}×{int(height)} → {w}×{h}")
        else:
            w, h = E.frame_size(aspect, quality)
        if raw and w * h > E.RAW_MAX_AREA * 1.02:
            w, h = E.cap_area(w, h, E.RAW_MAX_AREA)
            notes.append(f"RAW обучена до 1K — кадр уменьшен до {w}×{h}")
        notes.append(f"Кадр: {w}×{h} ({w * h / 1e6:.1f} Мп) · шаги {int(steps)} · CFG {float(cfg):g} · "
                     f"{sampler} / {scheduler}")

        try:
            # ---- автопромтер ----
            clip = E.load_clip(models["clip"])
            final, cached = E.autoprompt(clip, text, prompter, int(prompter_seed), float(prompter_creativity),
                                         prompter_instruction)
            prompter = E.OLD_MODES.get(prompter, prompter)
            if prompter == E.MODE_ASIS:
                notes.append("Промпт: как есть")
                if E.has_cyrillic(final):
                    notes.append("⚠ В промпте русские буквы — Krea лучше понимает английский. Включи автопромтер "
                                 "«подправить». EN: Cyrillic in the prompt — turn the prompter on.")
            else:
                notes.append("Промпт: " + prompter.split(" — ")[0] + (" (из памяти)" if cached else ""))

            # ---- стиль ----
            lora = None
            if style_lora and style_lora != E.NO_LORA and float(style_strength) > 0:
                lora = E.find_file("loras", style_lora)
                if not lora:
                    notes.append(f"⚠ LoRA «{style_lora}» не найдена — без стиля. EN: LoRA not found.")
                else:
                    trig = E.trigger_for(lora)
                    if trig and trig.lower() not in final.lower():
                        final = f"{final.rstrip()}, {trig}"
                    notes.append(f"Стиль: {E.base(lora)} × {float(style_strength):g}" + (f" · «{trig}»" if trig else ""))

            image = E.generate(models, final, w, h, int(count), int(seed), int(steps), float(cfg), sampler,
                               scheduler, lora, float(style_strength))
            if float(sharpness) > 0:
                image = E.sharpen(image, float(sharpness))
                notes.append(f"Резкость: {float(sharpness):g}")
        finally:
            if not keep_loaded:
                E.forget_models()

        for line in notes:
            log.info("%s %s", E.TAG, line)
        log.info("%s Итоговый промпт: %s", E.TAG, final)
        return {"ui": {"neron_prompt": [final], "neron_info": ["\n".join(notes)]}, "result": (image, final)}


NODE_CLASS_MAPPINGS = {"NeronImage": NeronImage}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronImage": "🖼 Neron Image / Картинка (Krea 2)"}
