# -*- coding: utf-8 -*-
"""🎬 Neron H3 One — нода «один ролик». Интерфейс: главное видно сразу, остальное — за ⚙ экспертом.

Входы совместимы с прежними движками (Raw Engine / MiniMax H3 Generator / H3 Studio): prompt, ref_image_0..3,
last_frame, ref_video, ref_video_audio, ref_audio, width, height, length_in — провода переставляются как есть.
"""
import logging

from . import downloader, passport, speed
from . import engine as E
from .core import FriendlyError, base, find_file, free, node

log = logging.getLogger("Neron.H3.One")
NOT_FOUND = "__not_found__"
NO_LORA = "— нет / none —"
AUTO_MODEL = "🤖 авто / auto"
AUTO_SIZE = "Авто — по первому кадру / Auto — from first frame"
LORA_TYPE = "NERON_H3_LORAS"          # 🎨 Набор LoRA из H3 Story подключается сюда же

# роль → (папка, имена по порядку предпочтения)
ROLES = {
    "unet": ("diffusion_models", [E.STD_UNET, "minimax_h3_fl2va_pruned_fp8_scaled.safetensors",
                                  "minimax_h3_fl2va_pruned_w6a8.safetensors",
                                  "minimax_h3_fl2va_pruned_bf16.safetensors"]),
    "unet_fast": ("diffusion_models", ["fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors"]),
    "clip": ("text_encoders", ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
                               "qwen3vl_32b_minimax_h3_int8_convrot.safetensors"]),
    "clip_precise": ("text_encoders", ["qwen3vl_32b_minimax_h3_int8_convrot.safetensors"]),
    "vae_video": ("vae", ["minimax_h3_video_vae_fp16.safetensors"]),
    "vae_audio": ("vae", ["minimax_h3_audio_vae_fp32.safetensors"]),
    "turbo_lora": ("loras", ["minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors",
                             "minimax_h3_fl2v_turbo_8step_v1.1_768p_comfyui_bf16.safetensors",
                             "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors"]),
    "fast_lora": ("loras", ["minimax_h3_fl2v_turbo_4step_v1.3_768p_comfyui_bf16.safetensors",
                            "minimax_h3_fl2v_turbo_4step_v1.2_768p_comfyui_bf16.safetensors",
                            "minimax_h3_fl2v_turbo_4step_v1.1_768p_comfyui_bf16.safetensors",
                            "minimax_h3_fl2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors"]),
}


def auto_file(role):
    kind, names = ROLES[role]
    for n in names:
        f = find_file(kind, n)
        if f:
            return f
    if role == "vae_video":                       # любая видео-VAE H3, что лежит (например, int8)
        try:
            import folder_paths
            for f in folder_paths.get_filename_list("vae"):
                b = base(f).lower()
                if "minimax_h3_video_vae" in b:
                    return f
        except Exception:
            pass
    return None


def _files(kind, first=None):
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list(kind))
    except Exception:
        files = []
    out = ([first] if first else []) + files
    return out or [NOT_FOUND]


def _main(label, **o):
    return dict(o, h3_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


AUTO_TIP = ("🤖 авто — файл из пакета (или его другая версия, что уже лежит). Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file (or another version you have). Missing — press «📥 Models».")
MODE_TIP = ("🔥 Экстрим — самое быстрое из того, что установлено: Fast H3 (8 шагов + разреженное внимание) или база + "
            "быстрая LoRA, 4 шага. Деталь проще.\n"
            "🚀 Быстро — наш проверенный: быстрая LoRA, 6 шагов.\n"
            "⚖ Баланс — HD: маленький черновик → увеличение → короткий чистовик в полном размере.\n"
            "✨ Качество — полная модель (bf16, если есть), 40 шагов.\n"
            "👑 Максимум — bf16 + точный энкодер, 50 шагов. Прощай, 5090.\n\n"
            "EN: Extreme — fastest installed · Fast — our tested 6 steps · Balance — HD draft→refine · "
            "Quality — bf16, 40 steps · Maximum — everything at max, 50 steps.")


def resolve_models(notes, mode, unet_model, clip_model, vae_video_model, vae_audio_model, turbo_lora_model,
                   fast_lora_model, tag="[H3 One]"):
    """Файлы моделей по выбору на ноде («авто» — из пакета). → (models, своя ли модель выбрана)."""
    def pick(v, role):
        if not v or v in (AUTO_MODEL, NOT_FOUND):
            return auto_file(role), False
        found = find_file(ROLES[role][0], base(v))
        if not found:
            notes.append(f"⚠ Файла «{v}» нет — взят «авто» / not found, using auto")
            return auto_file(role), False
        return found, True

    models = {}
    models["unet"], chosen = pick(unet_model, "unet")
    models["clip"], _ = pick(clip_model, "clip")
    models["vae_video"], _ = pick(vae_video_model, "vae_video")
    models["vae_audio"], _ = pick(vae_audio_model, "vae_audio")
    models["turbo_lora"], _ = pick(turbo_lora_model, "turbo_lora")
    models["fast_lora"], _ = pick(fast_lora_model, "fast_lora")
    models["unet_fast"] = auto_file("unet_fast")
    models["clip_precise"] = auto_file("clip_precise")
    need = {"unet": "модель H3", "clip": "текстовый энкодер", "vae_video": "VAE видео", "vae_audio": "VAE звука"}
    if mode == E.EXTREME and models["unet_fast"] and not chosen:
        need.pop("unet")
    missing = [v for k, v in need.items() if not models.get(k)]
    if missing:
        raise FriendlyError(f"{tag} Не хватает файлов: " + ", ".join(missing) + ". Нажми на ноде «📥 Модели» — "
                            "она скачает всё сама и разложит по папкам.\n\nEN: Missing model files. Press "
                            "«📥 Models» on the node — it downloads everything.")
    return models, chosen


def resolve_loras(notes, pairs, pack=None):
    """LoRA со слотов ноды + 🎨 Набор LoRA. Нет файла — пропуск с запиской."""
    out = [(n, float(s)) for n, s in pairs if n and n not in (NO_LORA, NOT_FOUND)]
    out += [(d["name"], float(d["strength"])) for d in (pack or [])]
    keep = []
    for n, st in out:
        if find_file("loras", base(n)):
            keep.append((n, st))
        else:
            notes.append(f"⚠ LoRA «{n}» не найдена — пропущена / LoRA not found, skipped")
    return keep


class NeronH3One:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("VIDEO", "IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "frames", "audio", "last_frame", "frames_count")
    DESCRIPTION = ("Один ролик MiniMax H3 со звуком — единый движок Neron: пять режимов от Экстрима до Максимума, "
                   "модели качает сам, ⏱ замер в отчёте.\nOne MiniMax H3 clip with sound — Neron's single engine: "
                   "five modes from Extreme to Maximum, downloads its models, ⏱ timing in the report.")

    ORDER = ["expert",
             "mode", "seconds", "first_as",                                              # РОЛИК / CLIP
             "size", "manual_width", "manual_height",                                    # РАЗМЕР / SIZE
             "lora_1", "strength_1", "lora_2", "strength_2", "lora_3", "strength_3",     # LoRA
             "attention", "sparse", "sparse_tau",                                        # ⚡ УСКОРЕНИЕ / SPEED
             "unet_model", "clip_model", "vae_video_model", "vae_audio_model",           # МОДЕЛИ / MODELS
             "turbo_lora_model", "fast_lora_model",
             "seed", "fast_steps", "fast_kind", "balance_clean", "protect_lora",         # ТОНКАЯ НАСТРОЙКА
             "keep_clip", "ref_quality"]

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req), "ORDER и поля разошлись"
        return d

    @classmethod
    def _raw(cls):
        unets, clips, vaes = (_files("diffusion_models", AUTO_MODEL), _files("text_encoders", AUTO_MODEL),
                              _files("vae", AUTO_MODEL))
        loras_auto = _files("loras", AUTO_MODEL)
        loras_user = [NO_LORA] + [f for f in _files("loras") if f != NOT_FOUND]
        sizes = [AUTO_SIZE] + list(passport.PRESETS)
        lora_tip = ("Своя LoRA (стиль, персонаж, действие). «— нет —» — выключена.\n\nEN: Your LoRA. «none» — off.")
        strength = dict(default=1.0, min=-2.0, max=2.0, step=0.05)
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать ускорение, модели, LoRA 2–3, сид и тонкие настройки. Скрытое всё равно "
                                   "работает.\n\nEN: Show speed, models, LoRA 2–3, seed and fine settings.")),
                "mode": (E.MODES, _main("режим / mode", default=E.DEFAULT_MODE, tooltip=MODE_TIP)),
                "seconds": ("FLOAT", _main("длина, с / seconds", default=5.0, min=1.0, max=15.0, step=0.5,
                            display="slider",
                            tooltip="Длина ролика (H3 обучена на 5–15 с). Кадры встают на сетку модели 17k+5 — "
                                    "точная длина будет в отчёте и в промпте автопромтера.\n\nEN: Clip length "
                                    "(trained on 5–15 s); frames snap to the model grid 17k+5.")),
                "first_as": (E.FIRST_AS, _exp("первый кадр / first frame", default=E.FIRST_FRAME_REF,
                             tooltip="🎯 кадр + образец — картинка становится НАСТОЯЩИМ первым кадром ролика и "
                                     "<Picture 1> для текста (так задумано в ComfyUI).\n🖼 только образец — как "
                                     "в Raw Engine и HD: картинка задаёт вид, но кадр 0.00 модель рисует сама.\n\n"
                                     "EN: frame + reference — the picture IS the first frame and <Picture 1>; "
                                     "reference only — as in Raw Engine/HD.")),
                "size": (sizes, _main("размер / size", default=AUTO_SIZE,
                         tooltip="Авто — форма первого кадра в паспорте модели (короткая сторона 768, площадь до "
                                 "1344×768). Пресеты — ровно паспорт H3.\n\nEN: Auto — the first frame's shape within "
                                 "the model passport.")),
                "manual_width": ("INT", _exp("ширина / width", default=1344, min=256, max=8192, step=32)),
                "manual_height": ("INT", _exp("высота / height", default=768, min=256, max=8192, step=32)),
                "lora_1": (loras_user, _main("LoRA 1", default=NO_LORA, tooltip=lora_tip)),
                "strength_1": ("FLOAT", _main("сила 1 / strength 1", **strength)),
                "lora_2": (loras_user, _exp("LoRA 2", default=NO_LORA, tooltip=lora_tip)),
                "strength_2": ("FLOAT", _exp("сила 2 / strength 2", **strength)),
                "lora_3": (loras_user, _exp("LoRA 3", default=NO_LORA, tooltip=lora_tip)),
                "strength_3": ("FLOAT", _exp("сила 3 / strength 3", **strength)),
                "attention": ([speed.AUTO] + speed.ATTN, _exp("⚡ внимание / attention", default=speed.AUTO,
                              tooltip="Каким ядром считать внимание. Авто: 🔥 Экстрим — Sage (если стоит), остальные — "
                                      "PyTorch (точно). Sage квантует внимание: быстрее, отличия малы, но есть. "
                                      "Kitchen INT8 мягчит деталь. Ничего не устанавливается — только то, что уже "
                                      "есть.\n\nEN: Attention kernel. Auto: Extreme — Sage if installed, others — "
                                      "PyTorch (exact). Nothing gets installed.")),
                "sparse": ([speed.AUTO] + speed.SPARSE, _exp("⚡ разреженное внимание / sparse attention",
                           default=speed.AUTO,
                           tooltip="Штатная нода ComfyUI «Model Sparse Attention»: точно считаются только важные куски "
                                   "кадра. Чем длиннее ролик и больше кадр — тем больше выигрыш. Авто: включено "
                                   "только в 🔥 Экстриме (vsa для Fast H3, иначе sol-attn). Это приближение — "
                                   "сравни на одном сиде.\n\nEN: ComfyUI's Model Sparse Attention. Auto: only in "
                                   "Extreme. It is an approximation — compare on one seed.")),
                "sparse_tau": ("FLOAT", _exp("порог sol-attn / sol-attn tau", default=E.SPARSE_TAU, min=0.5,
                               max=3.0, step=0.05,
                               tooltip="Выше — разреженнее и быстрее, но дальше от точного: 1.0 — точно считается ~16% "
                                       "кусков, 1.5 — ~7%, 2.0 — ~2.7% (по описанию ноды ComfyUI).\n\nEN: Higher is "
                                       "sparser and faster: 1.0 ≈ 16% exact, 1.5 ≈ 7%, 2.0 ≈ 2.7%.")),
                "unet_model": (unets, _exp("модель / model", default=AUTO_MODEL,
                               tooltip=AUTO_TIP + "\n\nВыбрана своя модель (например, дообученная) — Экстрим и Баланс "
                                       "НЕ подменят её на Fast H3.\nEN: your own model is never swapped for Fast H3.")),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=AUTO_MODEL,
                               tooltip=AUTO_TIP + "\n\nH3 понимает только свой энкодер (Qwen3-VL-32B, слой 50) — "
                                       "в любом сжатии: nvfp4 (лёгкий) или int8 (точнее). Другие не подойдут.\n"
                                       "EN: H3 only understands its own encoder, in any compression.")),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "turbo_lora_model": (loras_auto, _exp("⚡ турбо-LoRA / turbo LoRA", default=AUTO_MODEL,
                                     tooltip=AUTO_TIP)),
                "fast_lora_model": (loras_auto, _exp("🚀 быстрая LoRA / fast LoRA", default=AUTO_MODEL,
                                    tooltip=AUTO_TIP)),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFFFFFF)),
                "fast_steps": (E.FAST_STEPS, _exp("🚀 шаги «Быстро» / Fast steps", default=str(E.FAST_DEFAULT_STEPS),
                               tooltip="6 — по умолчанию; 4 — быстрее, грязнее; 8–10 — чище, дольше.\n\nEN: 6 by "
                                       "default; 4 faster but dirtier; 8–10 cleaner.")),
                "fast_kind": (E.FAST_KIND, _exp("🚀 чем ускорять «Быстро» / Fast uses", default=E.FAST_LORA_KIND,
                              tooltip="Быстрая 4-шаговая LoRA (6 шагов) или турбо-LoRA (12 шагов, сила 0.8 — как "
                                      "«⚡ Турбо» в Story).\n\nEN: 4-step Fast LoRA or the Turbo LoRA (12 steps).")),
                "balance_clean": ("BOOLEAN", _exp("⚖ Баланс чище (дольше) / Balance cleaner", default=False,
                                  tooltip="Чистовик 6 шагов вместо 3 и черновик крупнее — «Чисто HD».\n\nEN: «Clean "
                                          "HD»: 6 refine steps, bigger draft.")),
                "protect_lora": ("BOOLEAN", _exp("🛡 защита от двоения / anti-ghosting", default=True,
                                 tooltip="LoRA на сжатой модели (int8/fp8) ComfyUI пересжимает со случайным "
                                         "округлением — бывают двоение и артефакты. Если рядом лежит та же модель в "
                                         "bf16 (…_bf16.safetensors) — нода возьмёт её. Нет — предупредит в отчёте.\n\n"
                                         "EN: LoRA on a compressed model gets re-quantized and may ghost. If the same "
                                         "model in bf16 lies next to it, the node uses it.")),
                "keep_clip": (["auto", "always", "never"], _exp("энкодер в памяти / keep encoder", default="auto",
                              tooltip="Держать текстовый энкодер (~14 ГБ) в оперативке между прогонами — второй "
                                      "запуск быстрее. auto — если свободно ≥ 25 ГБ RAM.\n\nEN: keep the text encoder "
                                      "in RAM between runs; auto — if ≥ 25 GB RAM is free.")),
                "ref_quality": (["auto", "max", "match"], _exp("качество образцов / reference quality",
                                default="auto",
                                tooltip="auto: Экстрим/Быстро/Баланс — под размер кадра (match), Качество/Максимум — "
                                        "полное (max).\n\nEN: auto: match for fast modes, max for Quality/Maximum.")),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True, "tooltip": "Промпт — от автопромтера или свой. Идёт в "
                                      "модель дословно.\n\nEN: The prompt, passed to the model verbatim."}),
                "ref_image_0": ("IMAGE", {"tooltip": "Первый кадр ролика (img_0 автопромтера) — <Picture 1>.\n\n"
                                                     "EN: The first frame — <Picture 1>."}),
                "ref_image_1": ("IMAGE", {"tooltip": "Образец <Picture 2>: вид героя, предмета, места.\n\nEN: Reference "
                                                     "<Picture 2>."}),
                "ref_image_2": ("IMAGE", {"tooltip": "Образец <Picture 3>.\n\nEN: Reference <Picture 3>."}),
                "ref_image_3": ("IMAGE", {"tooltip": "Образец <Picture 4>.\n\nEN: Reference <Picture 4>."}),
                "last_frame": ("IMAGE", {"tooltip": "Последний кадр ролика.\n\nEN: The last frame."}),
                "loras": (LORA_TYPE, {"tooltip": "🎨 Набор LoRA (из H3 Story) — добавляется к LoRA 1–3.\n\nEN: LoRA pack, "
                                                 "added to LoRA 1–3."}),
                "ref_video": ("IMAGE", {"tooltip": "Видео-образец (кадры, 24 к/с, 2–15 с).\n\nEN: Reference video."}),
                "ref_video_audio": ("AUDIO", {"tooltip": "Звук видео-образца.\n\nEN: The reference video's sound."}),
                "ref_audio": ("AUDIO", {"tooltip": "Звуковой образец <Audio 1>: голос, музыка, фон.\n\nEN: Sound "
                                                   "reference."}),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
                "length_in": ("INT", {"forceInput": True, "tooltip": "Кадров (например, frames_count автопромтера) — "
                                                                     "главнее «длины».\n\nEN: Frame count, wins over "
                                                                     "seconds."}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, **kw):
        # Файла из чужой схемы здесь нет — не красное окно: модель уходит на «авто», с запиской в отчёте.
        return True

    def generate(self, expert=False, mode=E.DEFAULT_MODE, seconds=5.0, first_as=E.FIRST_FRAME_REF, size=AUTO_SIZE,
                 manual_width=1344, manual_height=768, lora_1=NO_LORA, strength_1=1.0, lora_2=NO_LORA,
                 strength_2=1.0, lora_3=NO_LORA, strength_3=1.0, attention=speed.AUTO, sparse=speed.AUTO,
                 sparse_tau=E.SPARSE_TAU, unet_model=None, clip_model=None, vae_video_model=None,
                 vae_audio_model=None, turbo_lora_model=None, fast_lora_model=None, seed=1, fast_steps="6",
                 fast_kind=E.FAST_LORA_KIND, balance_clean=False, protect_lora=True, keep_clip="auto",
                 ref_quality="auto", prompt=None, ref_image_0=None, ref_image_1=None, ref_image_2=None,
                 ref_image_3=None, last_frame=None, loras=None, ref_video=None, ref_video_audio=None, ref_audio=None,
                 width=None, height=None, length_in=None):
        notes = []
        text = (prompt or "").strip()
        if not text:
            raise FriendlyError("[H3 One] Нет промпта. Подключи вход prompt — от автопромтера (minimax_prompt) или "
                                "свой текст.\n\nEN: No prompt. Connect the prompt input (AutoPrompter's "
                                "minimax_prompt or your own text).")
        mode = E.mode_key(mode)

        # ---- размер ----
        first = ref_image_0
        if width is not None and height is not None:
            w, h, note = passport.fit(int(width), int(height))
        elif size == AUTO_SIZE:
            if first is not None:
                w, h = passport.canvas(int(first.shape[2]), int(first.shape[1]))
                note = f"по первому кадру {int(first.shape[2])}×{int(first.shape[1])} → {w}×{h}"
            else:
                (w, h), note = passport.preset_size(list(passport.PRESETS)[0]), "кадра нет — 16:9 / no frame — 16:9"
        elif passport.PRESETS.get(size) is None:
            w, h, note = passport.fit(int(manual_width), int(manual_height))
        else:
            (w, h), note = passport.preset_size(size), ""
        if note:
            notes.append("Размер: " + note)

        # ---- длина ----
        length, secs, lnote = passport.frames(seconds=None if length_in else seconds,
                                              length=int(length_in) if length_in else None)
        if lnote:
            notes.append("Длина: " + lnote)

        # ---- модели и LoRA ----
        models, chosen = resolve_models(notes, mode, unet_model, clip_model, vae_video_model, vae_audio_model,
                                        turbo_lora_model, fast_lora_model)
        user_loras = resolve_loras(notes, ((lora_1, strength_1), (lora_2, strength_2), (lora_3, strength_3)), loras)

        imgs = {"first": first, "ref_1": ref_image_1, "ref_2": ref_image_2, "ref_3": ref_image_3, "last": last_frame,
                "ref_video": ref_video, "ref_video_audio": ref_video_audio, "ref_audio": ref_audio}
        opt = {"first_as": first_as, "protect_lora": bool(protect_lora), "keep_clip": keep_clip,
               "ref_quality": ref_quality, "attention": attention, "sparse": sparse, "tau": float(sparse_tau),
               "fast_steps": int(fast_steps or E.FAST_DEFAULT_STEPS), "fast_kind": fast_kind,
               "clean": bool(balance_clean), "unet_chosen": chosen}
        try:
            frames, audio, last, count, report = E.generate(mode, text, w, h, length, int(seed), models, imgs,
                                                            user_loras, opt)
        except Exception:
            free("после ошибки / after error")
            raise
        video = node("CreateVideo", images=frames, fps=float(passport.FPS), audio=audio)[0]
        lines = notes + report
        for line in lines:
            log.info("[H3 One] %s", line)
        return {"ui": {"text": ["\n".join(lines)]}, "result": (video, frames, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3One": NeronH3One}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3One": "🎬 Neron H3 One / Единый движок H3"}
