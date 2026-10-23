# -*- coding: utf-8 -*-
"""🎬 Neron H3 Engine — генератор MiniMax H3: максимум качества в паспорте модели.

Новичок видит: ⚡ Турбо, размер, длительность (и часы сверху). Всё остальное — под ⚙ экспертом.
Шаги, сдвиг, сэмплер, внимание — не настройки, а работа движка.
"""
import logging

from . import engine, passport

log = logging.getLogger("Neron.H3.Engine")
NO_LORA = "— нет / none —"
NOT_FOUND = "__not_found__"


def _files(kind, extra_first=None):
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list(kind))
    except Exception:
        files = []
    out = ([extra_first] if extra_first else []) + files
    return out or [NOT_FOUND]


def _pick(files, wanted):
    """Модель по умолчанию: точное имя, иначе похожее (вдруг лежит в подпапке), иначе первое."""
    if wanted in files:
        return wanted
    for f in files:
        if f.replace("\\", "/").split("/")[-1] == wanted:
            return f
    return files[0]


def _has(files, name):
    return any(f.replace("\\", "/").split("/")[-1] == name for f in files)


def _main(label, **o):
    return dict(o, h3_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


class NeronH3Engine:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "audio", "last_frame", "frames_count")
    DESCRIPTION = ("Генератор MiniMax H3: максимум качества в паспорте модели (до ~1 Мп, до 15 с), память по очереди. "
                   "MiniMax H3 generator: best quality within the model passport, staged memory.")

    # порядок = группы оформления (панель рисуется вокруг подряд идущих ползунков своей группы)
    ORDER = ["expert",
             "mode", "seconds",                                      # РЕЖИМ / MODE
             "size", "manual_width", "manual_height",                # РАЗМЕР / SIZE
             "lora_1", "lora_1_strength", "lora_2", "lora_2_strength",            # LORA
             "unet_model", "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model",  # МОДЕЛИ
             "seed", "ref_quality", "fast_attention"]                # ТОНКАЯ НАСТРОЙКА

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._input_types_raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req)
        return d

    @classmethod
    def _input_types_raw(cls):
        unets, clips, vaes = _files("diffusion_models"), _files("text_encoders"), _files("vae")
        loras = _files("loras", NO_LORA)
        presets = list(passport.PRESETS)
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать модели, LoRA, ручной размер и сид. Скрытое всё равно работает.\n\n"
                                   "EN: Show models, LoRAs, manual size and seed. Hidden settings still work.")),
                "mode": (engine.MODES, _main("режим / mode", default=engine.MODES[0],
                          tooltip="⚡ Турбо — быстро (12 шагов через турбо-LoRA): хорошо для движения, композиции и "
                                  "черновиков. Но на мелких узорах (кованые решётки, кружево, волосы, листва) ускоритель "
                                  "«плавит» детали — им нужны шаги, а турбо их срезает.\n"
                                  "Качество — полная модель, 40 шагов, примерно в 3 раза дольше Турбо, заметно чище "
                                  "деталь и звук.\n"
                                  "Максимум — 50 шагов (до стольких растёт мелкая деталь) и модель без сжатия весов "
                                  "(bf16), если она скачана. Самое долгое, самое точное.\n\n"
                                  "EN: Turbo — fast (12 steps, turbo LoRA), good for drafts, melts fine patterns. "
                                  "Quality — full model, 40 steps, ~3× slower, cleaner detail and audio. Maximum — 50 "
                                  "steps and the uncompressed bf16 model if downloaded. Slowest, most precise.")),
                "size": (presets, _main("размер / size", default=presets[0],
                         tooltip="Пресеты — ровно паспорт модели (короткая сторона 768, до 1344×768). Больше модель "
                                 "не обучена: просьба выше вернёт паспортный размер той же формы.\n\nEN: Presets match "
                                 "the model passport (768 short edge, up to 1344×768). Larger requests are clamped.")),
                "seconds": ("FLOAT", _main("длительность, с / seconds", default=15.0, min=1.0, max=15.0, step=0.5,
                            display="slider", tooltip="До 15 с — на этом обучена модель. Кадры подгоняются к её сетке "
                                                       "(17k+5).\n\nEN: Up to 15 s — what the model was trained on.")),
                "manual_width": ("INT", _exp("ручной размер · ширина / manual width", default=1344, min=256,
                                 max=8192, step=32, tooltip="Только при размере «Ручной». Больше паспорта не будет.\n\n"
                                                            "EN: Only with size = Manual. Clamped to the passport.")),
                "manual_height": ("INT", _exp("ручной размер · высота / manual height", default=768, min=256,
                                  max=8192, step=32, tooltip="Только при размере «Ручной».\n\nEN: Only with size = Manual.")),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFFFFFF)),
                "lora_1": (loras, _exp("LoRA 1", default=NO_LORA, tooltip="Своя LoRA (стиль, персонаж).\n\nEN: Your LoRA.")),
                "lora_1_strength": ("FLOAT", _exp("LoRA 1 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "lora_2": (loras, _exp("LoRA 2", default=NO_LORA)),
                "lora_2_strength": ("FLOAT", _exp("LoRA 2 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "ref_quality": (["auto", "max", "match"], _exp("качество образцов / reference quality", default="auto",
                                tooltip="auto: в Качестве и Максимуме — max (образцы до 2048 по короткой стороне — точнее лица и "
                                        "одежда, но дольше), в Турбо — match (под размер кадра).\n\nEN: auto = max in "
                                        "Quality mode, match in Turbo.")),
                "fast_attention": ("BOOLEAN", _exp("быстрое внимание INT8 / fast attention", default=False,
                                   tooltip="Быстрее, но INT8-внимание может давать морфинг в конце ролика и кривой текст. "
                                           "Для максимума качества — выключено.\n\nEN: Faster, but INT8 attention can "
                                           "cause end-of-clip morphing and garbled text.")),
                "unet_model": (unets, _exp("модель / model",
                               default=_pick(unets, engine.UNET_BF16 if _has(unets, engine.UNET_BF16) else engine.UNET_NAME),
                               tooltip="По умолчанию — bf16 без сжатия весов, если скачана: заметно чище лица и однотонные "
                                       "поверхности, примерно в 1,5 раза дольше. int8 — если мало оперативки (bf16 весит 40 ГБ "
                                       "и подгружается частями).\n\nEN: Default is the uncompressed bf16 model if present: "
                                       "cleaner faces and flat surfaces, ~1.5× slower. Use int8 if RAM is short.")),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=_pick(clips, engine.CLIP_NAME))),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=_pick(vaes, engine.VAE_VIDEO_NAME))),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=_pick(vaes, engine.VAE_AUDIO_NAME))),
                "turbo_lora_model": (loras, _exp("турбо-LoRA / turbo LoRA",
                                                 default=_pick(loras, engine.TURBO_LORA_NAME))),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True}),
                "ref_image_0": ("IMAGE", {"tooltip": "Образец. Подключённые картинки нумеруются по порядку: первая "
                                                     "подключённая — <Picture 1>, вторая — <Picture 2>…"}),
                "ref_image_1": ("IMAGE",),
                "ref_image_2": ("IMAGE",),
                "ref_image_3": ("IMAGE",),
                "ref_video": ("IMAGE", {"tooltip": "Видео-образец <Video 1> (2–15 с, 24 к/с)"}),
                "ref_video_audio": ("AUDIO", {"tooltip": "Звук видео-образца"}),
                "ref_audio": ("AUDIO", {"tooltip": "Звук-образец <Audio 1>"}),
                "width": ("INT", {"forceInput": True, "tooltip": "Внешний размер. Больше паспорта не будет."}),
                "height": ("INT", {"forceInput": True}),
                "length_in": ("INT", {"forceInput": True, "tooltip": "Внешняя длина в кадрах. Не больше 362."}),
            },
        }

    def generate(self, expert=False, mode=None, size=None, seconds=15.0, manual_width=1344, manual_height=768,
                 seed=1, lora_1=NO_LORA, lora_1_strength=1.0, lora_2=NO_LORA, lora_2_strength=1.0,
                 ref_quality="auto", fast_attention=False, unet_model=None, clip_model=None, vae_video_model=None,
                 vae_audio_model=None, turbo_lora_model=None, prompt=None, ref_image_0=None, ref_image_1=None,
                 ref_image_2=None, ref_image_3=None, ref_video=None, ref_video_audio=None, ref_audio=None,
                 width=None, height=None, length_in=None):
        prompt = (prompt or "").strip()
        if not prompt:
            raise ValueError("[H3 Engine] Нет промпта: подключи вход prompt / connect the prompt input")
        notes = []
        # размер: внешний → ручной → пресет; всё через паспорт
        if width is not None and height is not None:
            w, h, note = passport.fit(int(width), int(height))
        elif size not in passport.PRESETS or passport.PRESETS[size] is None:
            w, h, note = passport.fit(int(manual_width), int(manual_height))
        else:
            (w, h), note = passport.preset_size(size), ""
        if note:
            notes.append("Размер: " + note)
        n, secs, note = passport.frames(seconds=seconds, length=length_in)
        if note:
            notes.append("Длина: " + note)

        def model(v, default):
            return default if not v or v == NOT_FOUND else v
        default_unet = engine.UNET_BF16 if engine._find_file("diffusion_models", engine.UNET_BF16) else engine.UNET_NAME
        models = {"unet": model(unet_model, default_unet), "clip": model(clip_model, engine.CLIP_NAME),
                  "vae_video": model(vae_video_model, engine.VAE_VIDEO_NAME),
                  "vae_audio": model(vae_audio_model, engine.VAE_AUDIO_NAME),
                  "turbo_lora": model(turbo_lora_model, engine.TURBO_LORA_NAME)}
        loras = [(nm, st) for nm, st in ((lora_1, lora_1_strength), (lora_2, lora_2_strength))
                 if nm and nm not in (NO_LORA, NOT_FOUND) and abs(float(st)) > 1e-6]
        try:
            video, audio, last, count, report = engine.generate(
                prompt, w, h, n, mode if mode in engine.MODES else engine.MODES[0], int(seed), models, loras,
                [ref_image_0, ref_image_1, ref_image_2, ref_image_3], ref_video, ref_video_audio, ref_audio,
                ref_quality, bool(fast_attention))
        except Exception:
            engine.free("после ошибки / after error")
            raise
        for line in notes + report:
            log.info("[H3 Engine] %s", line)
        return {"ui": {"text": ["\n".join(notes + report)]}, "result": (video, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3Engine": NeronH3Engine}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Engine": "🎬 Neron H3 Engine / Генератор MiniMax H3"}
