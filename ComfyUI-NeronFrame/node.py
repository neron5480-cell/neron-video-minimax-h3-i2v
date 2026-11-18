# -*- coding: utf-8 -*-
"""🧩 Neron Сборка кадра — герой + место + поза (+ доп. образец) → готовый кадр на MiniMax H3 Image.

Картинки грузятся прямо в ноде (окна, как в 🗂 Картотеке) — без отдельных Load Image и проводов. Новичок видит окна,
одно поле «что происходит», форму кадра, качество, резкость, вариант. Всё тонкое — за ⚙ экспертом.
Шина: вход `cast` — 🗂 Картотека из H3 Story (заполняет пустые окна); выход `cast` — те же образцы дальше в видео.
"""
import hashlib
import logging
import os

import numpy as np
import torch

from . import downloader
from . import engine as E

log = logging.getLogger("Neron.Frame")
NONE = "— нет / none —"
NOT_FOUND = "__not_found__"
AUTO_MODEL = "🤖 авто — из пакета / auto — from pack"
CAST_TYPE = "NERON_H3_CAST"          # шина 🗂 Картотеки H3 Story: [{"image", "name"}, …]
ROLES = {"unet": "diffusion_models", "clip": "text_encoders", "vae": "vae"}
ROLE_NAMES = {"unet": "модель MiniMax H3 Image", "clip": "текстовый энкодер Qwen3-VL 32B (общий с H3)", "vae": "VAE H3 Image"}
SLOTS = [("hero_image", "hero"), ("place_image", "place"), ("extra_image", "extra"), ("pose_image", "pose")]
AUTO_TIP = ("🤖 авто — файл из пакета (или его другая версия, что уже лежит). Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file (or another version you have). Missing — press «📥 Models».")


# ---------------- картинки прямо в ноде (как в 🗂 Картотеке) ----------------

def _input_files():
    try:
        import folder_paths
        d = folder_paths.get_input_directory()
        names = [f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]
        try:
            names = folder_paths.filter_files_content_types(names, ["image"])
        except Exception:
            names = [f for f in names if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"))]
        return sorted(names)
    except Exception:
        return []


def _path(name):
    if not name or name == NONE:
        return None
    try:
        import folder_paths
        p = folder_paths.get_annotated_filepath(name)
        return p if p and os.path.isfile(p) else None
    except Exception:
        return None


def _load(name):
    p = _path(name)
    if p is None:
        return None
    from PIL import Image, ImageOps
    with Image.open(p) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        arr = np.asarray(im).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


def _samplers():
    try:
        import comfy.samplers
        return list(comfy.samplers.KSampler.SAMPLERS), list(comfy.samplers.KSampler.SCHEDULERS)
    except Exception:
        return [E.SAMPLER], [E.SCHEDULER]


def auto_file(role):
    try:
        for e in downloader.default_pack()[1]["files"]:
            if e["role"] == role:
                for n in [downloader.file_name(e)] + list(e.get("alternatives") or []):
                    f = E.find_file(ROLES[role], n)
                    if f:
                        return f
    except Exception:
        pass
    return None


def _main(label, **o):
    return dict(o, neron_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, neron_main=False, display_name=label)


def _model_combo(role, label):
    return ([AUTO_MODEL] + E.files(ROLES[role]), _exp(label, default=AUTO_MODEL, tooltip=AUTO_TIP))


class NeronFrameBuilder:
    CATEGORY = "Neron/Image"
    FUNCTION = "build"
    RETURN_TYPES = ("IMAGE", "STRING", CAST_TYPE)
    RETURN_NAMES = ("image", "prompt", "cast")
    OUTPUT_NODE = False
    DESCRIPTION = ("Сборка кадра: герой + место + поза (+ доп. образец) → кадр, где герой точно тот же. Картинки — "
                   "прямо в ноде. MiniMax H3 Image (официально, Comfy-Org). Выход cast — те же образцы для H3 Story.\n"
                   "Frame builder: hero + place + pose (+ extra) → a frame with the same hero. Pictures load right in "
                   "the node. Output cast — the same references for H3 Story.")

    @classmethod
    def INPUT_TYPES(cls):
        files = [NONE] + _input_files()
        samplers, schedulers = _samplers()
        slot_tip = {"hero_image": "Герой — лучше «паспорт героя»: в полный рост, ровный фон, всё снаряжение видно.",
                    "place_image": "Место — фон, улица, комната. Свет и настроение кадра берутся отсюда.",
                    "extra_image": "Доп. образец — одежда, предмет, второй персонаж. Подпиши ниже, что это.",
                    "pose_image": "Поза — фото, набросок, кадр из фильма, 3D-манекен. Нода её размоет: модель возьмёт "
                                  "только положение тела и ракурс."}
        req = {
            "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                       tooltip="Показать тонкие настройки.\n\nEN: Show fine settings.")),
        }
        for w, _ in SLOTS:     # имена файлов — скрытые списки; на ноде вместо них окна с превью
            req[w] = (files, _main(w, default=NONE, tooltip=slot_tip[w] + "\n\nEN: click a window or drop a file."))
        req.update({
            "extra_label": ("STRING", _main("доп. образец — что это / extra — what is it", default="",
                            tooltip="Коротко, лучше по-английски: «his armour», «a corporate drone», «a red umbrella». "
                                    "Пусто — «ещё один элемент сцены».\n\nEN: briefly, what the extra picture shows.")),
            "scene": ("STRING", _main("что происходит / what happens", default="", multiline=True,
                      placeholder="Например / e.g.: " + E.SCENE_EXAMPLE,
                      tooltip="Только суть сцены: что делает герой, крупность, свет, настроение. Остальное («сохрани "
                              "героя, поставь в место, в позу») нода пишет сама. Лучше по-английски, можно "
                              "по-русски.\n\nEN: Just the gist: action, shot size, light, mood.")),
            "aspect": (E.ASPECT_NAMES, _main("форма кадра / aspect", default=E.ASPECT_NAMES[0],
                       tooltip="🤖 — как у картинки места (нет места — как у героя).\n\nEN: auto — like the place "
                               "picture (or the hero).")),
            "quality": (E.QUALITY_NAMES, _main("качество / quality", default=E.QUALITY_NAMES[1],
                        tooltip="Площадь кадра. Официальный шаблон — 4 Мп. 8 Мп — детальнее, но на 16 ГБ заметно "
                                "дольше.\n\nEN: Frame area; the official template uses 4 MP.")),
            "sharpness": ("FLOAT", _main("резкость / sharpness", default=0.5, min=0.0, max=1.5, step=0.05,
                          display="slider",
                          tooltip="Чётче края после рисования (как в 🖼 Neron Image). 0 — как нарисовала модель.\n\n"
                                  "EN: Crisper edges after drawing; 0 — as drawn.")),
            "seed": ("INT", _main("вариант / seed", default=1, min=0, max=0xffffffffffffffff,
                     control_after_generate=True,
                     tooltip="Другой номер — другой вариант того же кадра.\n\nEN: Another number — another take.")),
            "pose_blur": ("FLOAT", _exp("размытие позы / pose blur", default=1.0, min=0.0, max=3.0, step=0.1,
                          tooltip="1.0 — как в проверенном процессе (≈5 пикс. на 1 Мп): модель берёт позу, но не "
                                  "вид манекена или фото. 0 — без размытия (может скопировать одежду с позы).\n\n"
                                  "EN: 1.0 — as in the proven workflow; 0 — no blur.")),
            "own_prompt": ("STRING", _exp("свой текст целиком / own full prompt", default="", multiline=True,
                           placeholder="пусто — нода пишет сама / empty — the node writes it",
                           tooltip="Профи: свой текст вместо того, что пишет нода. Ссылайся на картинки как "
                                   "<Picture 1>, <Picture 2>… в порядке: герой, место, доп. образец, поза (пустые окна "
                                   "пропускаются).\n\nEN: Your own full prompt; refer to <Picture N> in the order "
                                   "hero, place, extra, pose (empty windows are skipped).")),
            "steps": ("INT", _exp("шаги / steps", default=E.STEPS, min=2, max=20,
                      tooltip="Официально — 6 (модель обучена на этой сетке).\n\nEN: Officially 6.")),
            "sampler": (samplers, _exp("сэмплер / sampler", default=E.SAMPLER if E.SAMPLER in samplers else samplers[0],
                        tooltip="Официально — euler.\n\nEN: Officially euler.")),
            "scheduler": (schedulers, _exp("расписание / scheduler", default=E.SCHEDULER if E.SCHEDULER in schedulers
                          else schedulers[0], tooltip="Официально — simple.\n\nEN: Officially simple.")),
            "keep_loaded": ("BOOLEAN", _exp("держать модели / keep models loaded", default=False,
                            tooltip="Вкл — модель остаётся в памяти между прогонами (серия кадров быстрее). Выкл — "
                                    "память свободна для видео.\n\nEN: On — faster series; off — memory is freed.")),
            "unet_model": _model_combo("unet", "модель H3 Image / model"),
            "clip_model": _model_combo("clip", "текстовый энкодер / text encoder"),
            "vae_model": _model_combo("vae", "VAE"),
            # новое — строго в конец: сохранённые схемы хранят значения по порядку
        })
        return {
            "required": req,
            "optional": {
                "cast": (CAST_TYPE, {"tooltip": "🗂 Картотека из H3 Story: её образцы заполняют ПУСТЫЕ окна (1-й — "
                                                "герой, 2-й — доп. образец). Окна в ноде главнее.\n\nEN: H3 Story Cast "
                                                "fills EMPTY windows."}),
                "hero": ("IMAGE", {"tooltip": "Герой проводом (главнее окна). EN: hero by wire."}),
                "place": ("IMAGE", {"tooltip": "Место проводом. EN: place by wire."}),
                "pose": ("IMAGE", {"tooltip": "Поза проводом. EN: pose by wire."}),
                "width": ("INT", {"forceInput": True, "tooltip": "Внешний размер; форма и качество не работают."}),
                "height": ("INT", {"forceInput": True, "tooltip": "Внешняя высота."}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, **kw):
        return True        # файла из чужой схемы нет — окно просто пустое

    @classmethod
    def IS_CHANGED(cls, **kw):
        h = hashlib.sha256()
        for w, _ in SLOTS:
            v = kw.get(w, "")
            h.update(str(v).encode("utf-8"))
            p = _path(v)
            if p:
                st = os.stat(p)
                h.update(f"{st.st_size}:{st.st_mtime_ns}".encode())
        for k in sorted(kw):
            if k not in dict(SLOTS) and not hasattr(kw[k], "shape") and k != "cast":
                h.update(f"{k}={kw[k]}".encode("utf-8", "ignore"))
        return h.hexdigest()

    def build(self, expert=False, hero_image=NONE, place_image=NONE, extra_image=NONE, pose_image=NONE,
              extra_label="", scene="", aspect=E.ASPECT_NAMES[0], quality=E.QUALITY_NAMES[1], sharpness=0.5, seed=1,
              pose_blur=1.0, own_prompt="", steps=E.STEPS, sampler=E.SAMPLER, scheduler=E.SCHEDULER,
              keep_loaded=False, unet_model=AUTO_MODEL, clip_model=AUTO_MODEL, vae_model=AUTO_MODEL, cast=None,
              hero=None, place=None, pose=None, width=None, height=None):
        notes = []
        if not E.has_node("MiniMaxH3ImageConditioning"):
            raise E.FriendlyError(f"{E.TAG} В ComfyUI нет MiniMax H3 Image. Обнови ComfyUI Desktop.\n\nEN: ComfyUI "
                                  f"has no MiniMax H3 Image support. Update ComfyUI.")

        # ---- образцы: провод → окно → картотека ----
        pics = {"hero": hero, "place": place, "pose": pose, "extra": None}
        for w, role in SLOTS:
            if pics[role] is None:
                pics[role] = _load({"hero_image": hero_image, "place_image": place_image, "extra_image": extra_image,
                                    "pose_image": pose_image}[w])
        cast_names = []
        for item in (cast or []):
            im = item.get("image") if isinstance(item, dict) else None
            if im is None:
                continue
            slot = "hero" if pics["hero"] is None else ("extra" if pics["extra"] is None else None)
            if slot is None:
                break
            pics[slot] = im
            cast_names.append(f"{slot}: {item.get('name') or 'образец'}")
            if slot == "extra" and not (extra_label or "").strip():
                extra_label = item.get("name") or ""
        if cast_names:
            notes.append("Из картотеки: " + ", ".join(cast_names))
        if all(v is None for v in pics.values()) and not (scene or own_prompt or "").strip():
            raise E.FriendlyError(f"{E.TAG} Положи хотя бы героя или место и напиши, что происходит.\n\nEN: Add at "
                                  f"least a hero or a place and write what happens.")

        order = [r for r in ("hero", "place", "extra", "pose") if pics[r] is not None]
        images = []
        for r in order:
            im = pics[r][:1, ..., :3]
            if r == "pose" and float(pose_blur) > 0:
                im = E.gaussian_blur(im, E.pose_blur_px(im, pose_blur))
            images.append(im)
        notes.append("Образцы: " + (" · ".join(f"<Picture {i + 1}> {r}" for i, r in enumerate(order)) or "нет"))

        text = (own_prompt or "").strip() or E.build_prompt(order, scene, extra_label)
        notes.append("Текст: " + ("свой" if (own_prompt or "").strip() else "собран нодой"))

        # ---- размер ----
        if width is not None and height is not None and int(width) > 0 and int(height) > 0:
            w, h = E.wired_size(width, height)
        else:
            ref = pics["place"] if pics["place"] is not None else pics["hero"]
            rw, rh = (int(ref.shape[2]), int(ref.shape[1])) if ref is not None else (None, None)
            w, h = E.frame_size(aspect, quality, rw, rh)
        notes.append(f"Кадр: {w}×{h} ({w * h / 1e6:.1f} Мп) · шаги {int(steps)} · {sampler} / {scheduler}")

        # ---- модели ----
        picked = {"unet": unet_model, "clip": clip_model, "vae": vae_model}
        models = {}
        for role, v in picked.items():
            if v in (None, "", AUTO_MODEL, NOT_FOUND):
                models[role] = auto_file(role)
            else:
                models[role] = E.find_file(ROLES[role], v) or auto_file(role)
        missing = [r for r, f in models.items() if not f]
        if missing:
            raise E.FriendlyError(
                f"{E.TAG} Не хватает моделей: " + ", ".join(ROLE_NAMES[m] for m in missing) + ". Нажми на ноде "
                "«📥 Модели» — она скачает только недостающее.\n\nEN: Missing models. Press «📥 Модели / Models».")

        try:
            image = E.generate(models, text, images, w, h, int(seed), int(steps), sampler, scheduler)
            if float(sharpness) > 0:
                image = E.sharpen(image, float(sharpness))
                notes.append(f"Резкость: {float(sharpness):g}")
        finally:
            if not keep_loaded:
                E.forget_models()

        out_cast = [{"image": pics[r][:1, ..., :3], "name": n} for r, n in
                    (("hero", "the hero"), ("place", "the location")) if pics[r] is not None]
        if pics["extra"] is not None:
            out_cast.append({"image": pics["extra"][:1, ..., :3], "name": (extra_label or "").strip()})
        for line in notes:
            log.info("%s %s", E.TAG, line)
        log.info("%s Текст: %s", E.TAG, text)
        return {"ui": {"neron_prompt": [text], "neron_info": ["\n".join(notes)]}, "result": (image, text, out_cast)}


NODE_CLASS_MAPPINGS = {"NeronFrameBuilder": NeronFrameBuilder}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronFrameBuilder": "🧩 Neron Сборка кадра / Frame Builder (H3 Image)"}
