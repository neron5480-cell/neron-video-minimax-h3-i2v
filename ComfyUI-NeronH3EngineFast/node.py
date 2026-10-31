# -*- coding: utf-8 -*-
"""⚡ Neron H3 Engine Fast — скорость + качество: черновик → увеличение → чистовик.

Новичок видит: режим (Быстро / Баланс / Чисто), длительность, размер. Всё остальное — под ⚙ экспертом.
Опытная нода для поиска баланса; когда найдём его — войдёт опцией в H3 Engine.
"""
import logging

from . import engine_fast as ef, passport

log = logging.getLogger("Neron.H3.Fast")
NO_LORA = "— нет / none —"
NOT_FOUND = "__not_found__"


def _files(kind, extra_first=()):
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list(kind))
    except Exception:
        files = []
    out = list(extra_first) + files
    return out or [NOT_FOUND]


def _pick(files, *wanted):
    """Первое найденное из желаемых (вдруг лежит в подпапке), иначе первое в списке."""
    for name in wanted:
        for f in files:
            if f == name or ef.base(f) == name:
                return f
    return files[0]


def _main(label, **o):
    return dict(o, h3_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


class NeronH3EngineFast:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "audio", "last_frame", "frames_count")
    DESCRIPTION = ("Быстрый генератор MiniMax H3: маленький черновик → увеличение → короткий чистовик в размере паспорта. "
                   "Fast MiniMax H3 generator: small draft → upscale → short refine at the passport size.")

    ORDER = ["expert",
             "mode", "seconds",                                                  # РЕЖИМ / MODE
             "size", "manual_width", "manual_height",                            # РАЗМЕР / SIZE
             "draft_area", "draft_steps", "refine_steps", "refine_strength",     # БАЛАНС / BALANCE
             "lora_1", "lora_1_strength", "lora_2", "lora_2_strength",           # LORA
             "draft_model", "unet_model", "refine_lora_model", "upscaler_model",
             "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model",   # МОДЕЛИ
             "seed", "keep_draft_audio", "draft_fast_attention"]                 # ТОНКАЯ НАСТРОЙКА

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._input_types_raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req)
        return d

    @classmethod
    def VALIDATE_INPUTS(cls, draft_model=None, unet_model=None, refine_lora_model=None, upscaler_model=None,
                        clip_model=None, vae_video_model=None, vae_audio_model=None, turbo_lora_model=None):
        """Файлы моделей не сверяем со списком строго: в чужой схеме файл может лежать в другой подпапке
        («Minimax H3\\имя» против «имя»). Нода сама найдёт его по имени, а нет — возьмёт запасной."""
        return True

    @classmethod
    def _input_types_raw(cls):
        unets, clips, vaes = _files("diffusion_models"), _files("text_encoders"), _files("vae")
        drafts = _files("diffusion_models", [ef.DRAFT_TURBO])
        loras = _files("loras", [NO_LORA])
        lora_files = _files("loras")
        ups = [ef.UPSCALER_AUTO, ef.UPSCALER_NONE] + ef.upscaler_files()
        presets = list(passport.PRESETS)
        draft_default = _pick(drafts, ef.FAST_UNET_NAME)
        if ef.base(draft_default) != ef.FAST_UNET_NAME:
            draft_default = ef.DRAFT_TURBO
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать баланс черновика и чистовика, модели, LoRA и сид. Скрытое всё равно работает.\n\n"
                                   "EN: Show draft/refine balance, models, LoRAs and seed. Hidden settings still work.")),
                "mode": (ef.MODES, _main("режим / mode", default=ef.MODES[1],
                          tooltip="Сколько времени отдать чистовику (он рисует деталь в полном размере):\n"
                                  "⚡ Быстро — черновик меньше (0.45 площади), чистовик 3 шага.\n"
                                  "Баланс — черновик 0.5 площади, чистовик 3 шага, сила 0.5 (проверено).\n"
                                  "Чисто — черновик крупнее, чистовик 6 шагов.\n"
                                  "Свой — значения из ползунков эксперта.\n"
                                  "Замер (RTX 5070 Ti 16 ГБ, 48 ГБ ОЗУ, модели int8, без апскейлера), 10 с в полном размере модели: "
                                  "Быстро 7–9 мин, Баланс 8–12, Чисто 12–14.\n\n"
                                  "EN: How much time the refine gets (it draws detail at full size). "
                                  "Fast — smaller draft (0.45 area), 3 refine steps; Balance — 0.5 draft area, 3 refine steps at 0.5 (tested); Clean — bigger draft, 6 steps; "
                                  "Custom — expert sliders. Measured (RTX 5070 Ti 16 GB, 48 GB RAM, int8 models, no upscaler), 10 s at full "
                                  "model size: Fast 7–9 min, Balance 8–12, Clean 12–14.")),
                "seconds": ("FLOAT", _main("длительность, с / seconds", default=10.0, min=1.0, max=15.0, step=0.5,
                            display="slider", tooltip="До 15 с — на этом обучена модель. Кадры подгоняются к её сетке "
                                                       "(17k+5).\n\nEN: Up to 15 s — what the model was trained on.")),
                "size": (presets, _main("размер / size", default=passport.FROM_IMAGE,
                         tooltip="По кадру — форма первого кадра, размер паспорта (короткая сторона 768, до 1344×768). "
                                 "Без кадра — 16:9. Остальные пресеты — ровно паспорт модели.\n\n"
                                 "EN: From image — the first frame's shape at passport size; no frame → 16:9. "
                                 "Other presets match the model passport.")),
                "manual_width": ("INT", _exp("ручной размер · ширина / manual width", default=1344, min=256,
                                 max=8192, step=32, tooltip="Только при размере «Ручной». Больше паспорта не будет.\n\n"
                                                            "EN: Only with size = Manual. Clamped to the passport.")),
                "manual_height": ("INT", _exp("ручной размер · высота / manual height", default=768, min=256,
                                  max=8192, step=32, tooltip="Только при размере «Ручной».\n\nEN: Only with size = Manual.")),
                "draft_area": ("FLOAT", _exp("черновик · площадь / draft area", default=0.5, min=0.4, max=1.0,
                               step=0.05, display="slider",
                               tooltip="Режим «Свой». Доля площади финального кадра: 0.5 → 1344×768 становится 960×544. "
                                       "Меньше — быстрее, но чистовику больше работы. Ниже 0.4 модель начинает дорисовывать лишнее "
                                       "(ленточки, рюшечки) и не слушает промпт — поэтому 0.4 — нижний предел.\n\nEN: Custom mode. "
                                       "Share of the final area for the draft. Smaller = faster, more work for the refine. Below "
                                       "0.4 the model invents extra details (ribbons, frills) and ignores the prompt, so 0.4 is the floor.")),
                "draft_steps": ("INT", _exp("черновик · шаги / draft steps", default=8, min=4, max=20,
                                tooltip="Режим «Свой». Быстрые модели обучены на 8 шагов.\n\nEN: Custom mode. "
                                        "Fast models are trained for 8 steps.")),
                "refine_steps": ("INT", _exp("чистовик · шаги / refine steps", default=3, min=1, max=12,
                                 tooltip="Режим «Свой». Шаги в полном размере — самые дорогие.\n\nEN: Custom mode. "
                                         "Full-size steps — the expensive ones.")),
                "refine_strength": ("FLOAT", _exp("чистовик · сила / refine strength", default=0.5, min=0.1,
                                    max=0.9, step=0.05, display="slider",
                                    tooltip="Режим «Свой». Насколько чистовик перерисовывает черновик. Мало — остаётся мыло и "
                                            "«удары» черновика; много — может поменять движение.\n\nEN: Custom mode. How much "
                                            "the refine redraws the draft. Low keeps draft blur; high may change motion.")),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFFFFFF)),
                "keep_draft_audio": ("BOOLEAN", _exp("звук из черновика / draft audio", default=True,
                                     tooltip="Вкл — звук берётся из черновика, чистовик рисует только картинку. "
                                             "Выкл — чистовик перерисовывает и звук.\n\nEN: On — audio comes from the draft, "
                                             "the refine touches only the picture. Off — the refine redraws audio too.")),
                "draft_fast_attention": ("BOOLEAN", _exp("быстрое внимание в черновике / fast draft attention",
                                         default=False,
                                         tooltip="INT8-внимание только в черновике: быстрее, но может давать морфинг к концу "
                                                 "ролика. Чистовик всегда на полноточном.\n\nEN: INT8 attention in the draft "
                                                 "only: faster, may morph the end of the clip. The refine always uses full "
                                                 "precision.")),
                "lora_1": (loras, _exp("LoRA 1", default=NO_LORA,
                           tooltip="Своя LoRA (стиль, персонаж) — в черновике и чистовике.\n\nEN: Your LoRA, both passes.")),
                "lora_1_strength": ("FLOAT", _exp("LoRA 1 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "lora_2": (loras, _exp("LoRA 2", default=NO_LORA)),
                "lora_2_strength": ("FLOAT", _exp("LoRA 2 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "draft_model": (drafts, _exp("модель черновика / draft model", default=draft_default,
                                tooltip="Fast H3 (8 шагов) — если скачана. Иначе — базовая модель + турбо-LoRA.\n\n"
                                        "EN: Fast H3 (8 steps) if downloaded, otherwise base model + turbo LoRA.")),
                "unet_model": (unets, _exp("модель чистовика / refine model", default=_pick(unets, ef.UNET_NAME),
                               tooltip="Базовая модель H3 (fl2va).\n\nEN: The base H3 model (fl2va).")),
                "refine_lora_model": (lora_files, _exp("LoRA чистовика / refine LoRA",
                                      default=_pick(lora_files, ef.TAOMATE_LORA_NAME, ef.TURBO_LORA_NAME),
                                      tooltip="Быстрая LoRA для коротких шагов чистовика: Taomate 3-step, если есть, "
                                              "иначе наша турбо-LoRA (×0.8).\n\nEN: Fast LoRA for the short refine: "
                                              "Taomate 3-step if present, else the turbo LoRA (×0.8).")),
                "upscaler_model": (ups, _exp("апскейлер / upscaler", default=ef.UPSCALER_AUTO,
                                   tooltip="Модель увеличения латента H3 из models/latent_upscale_models. "
                                           "Нет модели — простое растяжение (тогда чистовику нужна сила побольше).\n\n"
                                           "EN: H3 latent upscale model from models/latent_upscale_models. "
                                           "None — a plain stretch (give the refine more strength).")),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=_pick(clips, ef.CLIP_NAME))),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=_pick(vaes, ef.VAE_VIDEO_NAME),
                                    tooltip="Лучше fp16, а не int8: раскодировка — малая часть времени, а грязь на финале "
                                            "от сжатого VAE заметна.\n\nEN: Prefer fp16 over int8.")),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=_pick(vaes, ef.VAE_AUDIO_NAME))),
                "turbo_lora_model": (lora_files, _exp("турбо-LoRA (черновик без Fast H3) / turbo LoRA",
                                     default=_pick(lora_files, ef.TURBO_LORA_NAME))),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True}),
                "first_frame": ("IMAGE", {"tooltip": "Первый кадр (из LoadImage, Image Processor, AutoPrompter img_0). "
                                                     "Без кадров — «текст → видео».\n\nEN: First frame. None — text-to-video."}),
                "last_frame": ("IMAGE", {"tooltip": "Последний кадр (необязательно).\n\nEN: Last frame (optional)."}),
                "width": ("INT", {"forceInput": True, "tooltip": "Задаёт форму кадра; размер всегда максимальный по паспорту "
                                                  "(например, 1200×720 → 1280×768).\n\nEN: Sets the frame shape; "
                                                  "the size is always the passport maximum."}),
                "height": ("INT", {"forceInput": True}),
                "length_in": ("INT", {"forceInput": True, "tooltip": "Внешняя длина в кадрах. Не больше 362."}),
            },
        }

    def generate(self, expert=False, mode=None, seconds=10.0, size=None, manual_width=1344, manual_height=768,
                 draft_area=0.5, draft_steps=8, refine_steps=3, refine_strength=0.5, seed=1, keep_draft_audio=True,
                 draft_fast_attention=False, lora_1=NO_LORA, lora_1_strength=1.0, lora_2=NO_LORA,
                 lora_2_strength=1.0, draft_model=None, unet_model=None, refine_lora_model=None,
                 upscaler_model=None, clip_model=None, vae_video_model=None, vae_audio_model=None,
                 turbo_lora_model=None, prompt=None, first_frame=None, last_frame=None, width=None, height=None,
                 length_in=None):
        prompt = (prompt or "").strip()
        if not prompt:
            raise ValueError("[H3 Fast] Нет промпта: подключи вход prompt / connect the prompt input")
        notes = []
        if width is not None and height is not None:
            # цель этой ноды — максимальный размер модели: провода задают ФОРМУ, размер — паспортный
            w, h = passport.canvas(int(width), int(height))
            note = f"форма с проводов {int(width)}×{int(height)} → паспорт {w}×{h}"
        elif size == passport.FROM_IMAGE:
            if first_frame is not None:
                w, h = passport.canvas(int(first_frame.shape[2]), int(first_frame.shape[1]))
                note = f"по первому кадру {int(first_frame.shape[2])}×{int(first_frame.shape[1])} → {w}×{h}"
            else:
                w, h = passport.canvas(16, 9)
                note = "кадра нет — 16:9"
        elif size not in passport.PRESETS or passport.PRESETS[size] is None:
            w, h, note = passport.fit(int(manual_width), int(manual_height))
        else:
            (w, h), note = passport.preset_size(size), ""
        if note:
            notes.append("Размер: " + note)
        n, _, note = passport.frames(seconds=seconds, length=length_in)
        if note:
            notes.append("Длина: " + note)

        if mode in ef.PRESETS:
            area, d_steps, r_steps, r_str = ef.PRESETS[mode]
        else:
            area, d_steps, r_steps, r_str = draft_area, draft_steps, refine_steps, refine_strength
        settings = {"draft_area": float(area), "draft_steps": int(d_steps), "refine_steps": int(r_steps),
                    "refine_strength": float(r_str), "keep_draft_audio": bool(keep_draft_audio),
                    "draft_fast_attention": bool(draft_fast_attention)}

        def model(kind, v, *defaults, label=""):
            """Файл по имени (в любой подпапке); нет — первый найденный из запасных; нет и их — понятная ошибка."""
            for name in ([v] if v and v != NOT_FOUND else []) + list(defaults):
                f = ef.find_file(kind, ef.base(name))
                if f:
                    if v and v != NOT_FOUND and ef.base(f) != ef.base(v):
                        notes.append(f"{label}: {ef.base(v)} не найден — беру {ef.base(f)}")
                    return f
            raise ValueError(f"[H3 Fast] {label}: нет файла {ef.base(v or defaults[0])} в models/{kind}. "
                             f"Ссылки — в заметке на холсте. / No {label} file in models/{kind}.")

        draft = draft_model or ef.DRAFT_TURBO
        if draft != ef.DRAFT_TURBO:
            found = ef.find_file("diffusion_models", ef.base(draft))
            if found:
                draft = found
            else:
                notes.append(f"Модели черновика {ef.base(draft)} нет — беру базовую + турбо-LoRA")
                draft = ef.DRAFT_TURBO
        ups = upscaler_model or ef.UPSCALER_AUTO
        if ups not in (ef.UPSCALER_AUTO, ef.UPSCALER_NONE):
            ups = ef.find_file("latent_upscale_models", ef.base(ups)) or ef.UPSCALER_AUTO
        models = {"draft_unet": draft,
                  "unet": model("diffusion_models", unet_model, ef.UNET_NAME, label="модель чистовика"),
                  "refine_lora": model("loras", refine_lora_model, ef.TAOMATE_LORA_NAME, ef.TURBO_LORA_NAME,
                                       label="LoRA чистовика"),
                  "upscaler": ups,
                  "clip": model("text_encoders", clip_model, ef.CLIP_NAME, label="текстовый энкодер"),
                  "vae_video": model("vae", vae_video_model, ef.VAE_VIDEO_NAME, label="VAE видео"),
                  "vae_audio": model("vae", vae_audio_model, ef.VAE_AUDIO_NAME, label="VAE звука"),
                  "turbo_lora": None}
        if draft == ef.DRAFT_TURBO:
            models["turbo_lora"] = model("loras", turbo_lora_model, ef.TURBO_LORA_NAME, label="турбо-LoRA")
        loras = [(nm, st) for nm, st in ((lora_1, lora_1_strength), (lora_2, lora_2_strength))
                 if nm and nm not in (NO_LORA, NOT_FOUND) and abs(float(st)) > 1e-6]
        try:
            video, audio, last, count, report = ef.generate(prompt, w, h, n, int(seed), models, settings,
                                                            first_frame, last_frame, loras)
        except Exception:
            ef.free("после ошибки / after error")
            raise
        for line in notes + report:
            log.info("[H3 Fast] %s", line)
        return {"ui": {"text": ["\n".join(notes + report)]}, "result": (video, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3EngineFast": NeronH3EngineFast}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3EngineFast": "⚡ Neron H3 Engine Fast / Быстрый генератор MiniMax H3"}
