# -*- coding: utf-8 -*-
"""🎬 Neron LTX Engine — генератор LTX 2.5 одной нодой.

Новичок видит: режим, длительность, видеокарту — и кнопку 📥 моделей. Всё остальное — под ⚙ экспертом.
Входы — проводами: промпт, промпт камеры, первый, два промежуточных и последний кадр.
Выходы: готовое видео со звуком, звук отдельно, кадры, частота кадров.
"""
import logging

from . import engine, sizing

log = logging.getLogger("Neron.LTX.Engine")
NO_LORA = "— нет / none —"
NO_UPSCALE = "— нет / none —"
NOT_FOUND = "__not_found__"
AUTO_MODEL = "🤖 авто — из пакета / auto — from pack"


def _files(kind, extra_first=None):
    try:
        import folder_paths
        files = list(folder_paths.get_filename_list(kind))
    except Exception:
        files = []
    out = ([extra_first] if extra_first else []) + files
    return out or [NOT_FOUND]


def _pick(files, wanted):
    if wanted in files:
        return wanted
    for f in files:
        if f.replace("\\", "/").split("/")[-1] == wanted:
            return f
    return files[0]


def _pick_hint(files, hint, fallback):
    for f in files:
        if hint in f.lower():
            return f
    return fallback


def _main(label, **o):
    return dict(o, ltx_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


class NeronLTXEngine:
    CATEGORY = "Neron/LTX"
    FUNCTION = "generate"
    RETURN_TYPES = ("VIDEO", "AUDIO", "IMAGE", "FLOAT", "STRING")
    RETURN_NAMES = ("video", "audio", "frames", "fps", "prompt_used")
    OUTPUT_TOOLTIPS = ("Готовое видео со звуком / ready video with sound", "Звук отдельно / audio",
                       "Кадры картинками / frames", "Частота кадров / fps",
                       "Текст, который ушёл в модель: промпт + камера в начале и в конце. "
                       "EN: the exact text sent to the model, with the camera sentence.")
    DESCRIPTION = ("Генератор LTX 2.5 одной нодой: первый, промежуточные и последний кадр, звук, плавность. "
                   "LTX 2.5 generator in one node: first, middle and last frames, audio, smoothness.")

    ORDER = ["expert",
             "mode", "seconds", "gpu",                                                  # ГЛАВНОЕ / MAIN
             "size", "manual_width", "manual_height", "megapixels", "fps", "t2v_aspect",  # РАЗМЕР / SIZE
             "first_strength", "mid_strength", "last_strength", "mid1_sec", "mid2_sec",  # КАДРЫ / FRAMES
             "input_upscale", "input_sharpen", "img_compression", "output_sharpen", "smooth",  # КАЧЕСТВО
             "lora_1", "lora_1_strength", "lora_2", "lora_2_strength",                  # LORA
             "unet_model", "clip_model", "vae_video_model", "vae_audio_model", "interp_model",  # МОДЕЛИ
             "seed"]

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._input_types_raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req)
        return d

    @classmethod
    def _input_types_raw(cls):
        unets, clips, vaes = _files("diffusion_models", AUTO_MODEL), _files("text_encoders", AUTO_MODEL), \
            _files("vae", AUTO_MODEL)
        loras = _files("loras", NO_LORA)
        ups = _files("upscale_models", NO_UPSCALE)
        if ups == [NOT_FOUND]:
            ups = [NO_UPSCALE]
        interps = _files("frame_interpolation", AUTO_MODEL)
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать тонкие настройки: размер, силу кадров, резкость, LoRA, модели, сид. "
                                   "Скрытое всё равно работает со своими значениями.\n\nEN: Show fine settings. "
                                   "Hidden settings still work with their values.")),
                "mode": (engine.MODES, _main("режим / mode", default=engine.MODES[0],
                         tooltip="Качество — два прохода, как в процессе Neron: 8 шагов + дочистка с первым кадром "
                                 "на полной силе. Быстро — один проход 8 шагов, для черновиков.\n\nEN: Quality — two "
                                 "passes (8 steps + refine with the first frame at full strength). Fast — one 8-step "
                                 "pass, for drafts.")),
                "seconds": ("FLOAT", _main("длительность, с / seconds", default=5.0, min=1.0,
                            max=sizing.MAX_SECONDS, step=0.5, display="slider",
                            tooltip="Лучше всего 5–10 с: дольше детали (например, руки) постепенно проседают. "
                                    "Кадры подгоняются к правилу модели 8·n+1.\n\nEN: 5–10 s works best; longer "
                                    "clips slowly lose detail. Frames snap to the model rule 8·n+1.")),
                "gpu": (sizing.GPU_CHOICES, _main("видеокарта / GPU", default=sizing.AUTO,
                        tooltip="Авто — нода сама узнаёт, сколько памяти у видеокарты, и подбирает размер кадра. "
                                "Если не хватает памяти — выбери ступень пониже.\n\nEN: Auto detects your VRAM and "
                                "picks the frame size. Out of memory? Pick a lower tier.")),
                "size": (sizing.SIZE_CHOICES, _main("размер / size", default=sizing.SIZE_AUTO,
                         tooltip="Авто — по видеокарте, форма как у первого кадра. Пресеты — готовые размеры "
                                 "(стороны кратны 32). По площади — свои мегапиксели, форма от кадра. Ручной — своя "
                                 "ширина и высота. Если подключены провода width/height — главнее всего этого.\n\n"
                                 "EN: Auto = by GPU, shape of the first frame. Presets = ready sizes. By area = your "
                                 "megapixels. Manual = your width and height. Wired width/height override all of it.")),
                "manual_width": ("INT", _exp("ручной · ширина / manual width", default=1280, min=256, max=4096,
                                 step=32, tooltip="Только при размере «Ручной». Кратно 32.\n\nEN: Only with size = "
                                                  "Manual. Multiple of 32.")),
                "manual_height": ("INT", _exp("ручной · высота / manual height", default=704, min=256, max=4096,
                                  step=32, tooltip="Только при размере «Ручной». Кратно 32.\n\nEN: Only with size = "
                                                   "Manual. Multiple of 32.")),
                "megapixels": ("FLOAT", _exp("площадь, Мп / megapixels", default=1.0, min=0.2, max=4.0, step=0.05,
                               tooltip="Только при размере «По площади». Форма берётся из первого кадра, стороны "
                                       "кратны 32.\n\nEN: Only with size = By area. Shape from the first frame.")),
                "fps": ("FLOAT", _exp("кадров в секунду / fps", default=24.0, min=8.0, max=60.0, step=1.0,
                        tooltip="Для диалогов и кино — 24 или 25. Плавность ×2 удвоит эту цифру на выходе.\n\nEN: "
                                "24 or 25 for film and dialogue. Smoothness ×2 doubles it at the output.")),
                "t2v_aspect": (["16:9 горизонталь / landscape", "9:16 вертикаль / portrait", "1:1 квадрат / square"],
                               _exp("форма без картинок / shape without images", default="16:9 горизонталь / landscape",
                                    tooltip="Только когда ни одного кадра не подключено (текст → видео).\n\nEN: Only "
                                            "when no frame is connected (text to video).")),
                "first_strength": ("FLOAT", _exp("сила первого кадра / first frame strength", default=0.7, min=0.0,
                                   max=1.0, step=0.05,
                                   tooltip="0.7 — как в процессе Neron и шаблоне Lightricks. Выше — кадр держится "
                                           "крепче, но движения меньше.\n\nEN: 0.7 as in the Neron workflow and the "
                                           "Lightricks template. Higher holds the frame tighter, less motion.")),
                "mid_strength": ("FLOAT", _exp("сила промежуточных / middle frames strength", default=1.0, min=0.0,
                                 max=1.0, step=0.05)),
                "last_strength": ("FLOAT", _exp("сила последнего / last frame strength", default=1.0, min=0.0,
                                  max=1.0, step=0.05)),
                "mid1_sec": ("FLOAT", _exp("промежуточный 1, секунда (0 = сам) / middle 1 at, s (0 = auto)",
                             default=0.0, min=0.0, max=sizing.MAX_SECONDS, step=0.1,
                             tooltip="0 — сам: на трети ролика.\n\nEN: 0 = auto, at one third of the clip.")),
                "mid2_sec": ("FLOAT", _exp("промежуточный 2, секунда (0 = сам) / middle 2 at, s (0 = auto)",
                             default=0.0, min=0.0, max=sizing.MAX_SECONDS, step=0.1,
                             tooltip="0 — сам: на двух третях ролика.\n\nEN: 0 = auto, at two thirds of the clip.")),
                "input_upscale": (ups, _exp("апскейл входа / input upscale",
                                  default=_pick_hint(ups, engine.UPSCALE_HINT, NO_UPSCALE),
                                  tooltip="Апскейл кадров перед генерацией (в процессе Neron — Swin2SR ×2): модель "
                                          "сжимает уже плотную картинку и меньше портит детали. Подхватывается сам, "
                                          "если файл swin2sr лежит в upscale_models.\n\nEN: Upscale frames before "
                                          "generation (Swin2SR ×2 in the Neron workflow). Picked automatically if a "
                                          "swin2sr file is in upscale_models.")),
                "input_sharpen": ("FLOAT", _exp("резкость входа / input sharpen", default=0.5, min=0.0, max=2.0,
                                  step=0.05, tooltip="Работает в паре с апскейлом входа.\n\nEN: Works together "
                                                     "with the input upscale.")),
                "img_compression": ("INT", _exp("сжатие кадра / image compression", default=0, min=0, max=100,
                                    tooltip="0 — выключено (процесс Neron). Шаблон Lightricks ставит 18: кадр "
                                            "чуть «сжимается» под видео, иногда это добавляет движения.\n\nEN: 0 = off "
                                            "(Neron workflow). Lightricks template uses 18; sometimes adds motion.")),
                "output_sharpen": ("FLOAT", _exp("резкость выхода / output sharpen", default=0.1, min=0.0, max=1.0,
                                   step=0.05, tooltip="0.1 — как в процессе Neron. Больше — может «пережечь».\n\n"
                                                      "EN: 0.1 as in the Neron workflow. More can overburn.")),
                "smooth": ("BOOLEAN", _exp("плавность ×2 (RIFE) / smoothness ×2", default=True,
                           tooltip="Удваивает кадры встроенной нодой ComfyUI: 24 → 48 к/с. Нужна модель RIFE "
                                   "(есть в пакете 📥).\n\nEN: Doubles frames with ComfyUI's built-in node: 24 → 48 "
                                   "fps. Needs a RIFE model (in the 📥 pack).")),
                "lora_1": (loras, _exp("LoRA 1", default=NO_LORA, tooltip="Своя LoRA для LTX 2.5 (или 2.3 — большая "
                                                                         "часть подходит).\n\nEN: Your LoRA.")),
                "lora_1_strength": ("FLOAT", _exp("LoRA 1 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "lora_2": (loras, _exp("LoRA 2", default=NO_LORA)),
                "lora_2_strength": ("FLOAT", _exp("LoRA 2 · сила / strength", default=1.0, min=-2.0, max=2.0, step=0.05)),
                "unet_model": (unets, _exp("модель / model", default=AUTO_MODEL,
                               tooltip="Авто — нода сама берёт файл из пакета 📥 (даже если его скачали после запуска ComfyUI). "
                                       "Свой файл — выбери из списка.\n\nEN: Auto takes the file from the 📥 pack "
                                       "(even if downloaded after ComfyUI started). Or pick your own file.")),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=AUTO_MODEL)),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=AUTO_MODEL)),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=AUTO_MODEL)),
                "interp_model": (interps, _exp("модель плавности / smoothness model", default=AUTO_MODEL)),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFF)),
            },
            "optional": {
                "prompt": ("STRING", {"forceInput": True, "tooltip": "Что происходит: прозой, в настоящем времени, "
                                                                     "со звуком. EN: what happens, as prose, with sound."}),
                "camera_prompt": ("STRING", {"forceInput": True, "tooltip": "Как ведёт себя камера — отдельной фразой. "
                                                                            "EN: camera behaviour, as one sentence."}),
                "first_frame": ("IMAGE", {"tooltip": "Первый кадр. Нет — «текст → видео». EN: first frame; none = text to video."}),
                "mid_frame_1": ("IMAGE", {"tooltip": "Промежуточный кадр 1. EN: middle frame 1."}),
                "mid_frame_2": ("IMAGE", {"tooltip": "Промежуточный кадр 2. EN: middle frame 2."}),
                "last_frame": ("IMAGE", {"tooltip": "Последний кадр — самый сильный рычаг: модель ведёт к твоей "
                                                     "картинке, а не выдумывает концовку. EN: last frame — "
                                                     "the strongest lever."}),
                "width": ("INT", {"forceInput": True, "tooltip": "Внешняя ширина (например, от процессора картинки). "
                                                                 "Подключены width и height — внутренний выбор размера "
                                                                 "отключается. EN: external width; wired width+height "
                                                                 "override the internal size."}),
                "height": ("INT", {"forceInput": True, "tooltip": "Внешняя высота. EN: external height."}),
                "seconds_in": ("FLOAT", {"forceInput": True, "tooltip": "Длительность с провода (например, от "
                                                                       "LTX AutoPrompter) — главнее ползунка. "
                                                                       "EN: wired duration, overrides the slider."}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, unet_model, clip_model, vae_video_model, vae_audio_model, interp_model, input_upscale,
                        lora_1, lora_2):
        # Файла из чужой схемы здесь нет — не красное окно: модели уходят на «авто», остальное отключается.
        # A saved file that doesn't exist here is not a red error: models fall back to auto, the rest is skipped.
        return True

    def generate(self, expert=False, mode=None, seconds=5.0, gpu=sizing.AUTO, size=sizing.SIZE_AUTO,
                 manual_width=1280, manual_height=704, megapixels=1.0, fps=24.0,
                 t2v_aspect="16:9", first_strength=0.7, mid_strength=1.0, last_strength=1.0, mid1_sec=0.0,
                 mid2_sec=0.0, input_upscale=NO_UPSCALE, input_sharpen=0.5, img_compression=0, output_sharpen=0.1,
                 smooth=True, lora_1=NO_LORA, lora_1_strength=1.0, lora_2=NO_LORA, lora_2_strength=1.0,
                 unet_model=None, clip_model=None, vae_video_model=None, vae_audio_model=None, interp_model=None,
                 seed=1, prompt=None, camera_prompt=None, first_frame=None, mid_frame_1=None, mid_frame_2=None,
                 last_frame=None, width=None, height=None, seconds_in=None):
        if not (prompt or "").strip():
            raise ValueError("[LTX Engine] Нет промпта: подключи вход prompt (например, текстовую ноду или "
                             "автопромтер).\n\nEN: No prompt: connect the prompt input.")

        notes = []

        def model(v, kind, default):
            # авто (или пусто) — файл из пакета, ищем прямо сейчас, а не по списку со старта ComfyUI
            if not v or v in (AUTO_MODEL, NOT_FOUND):
                return engine.find_file(kind, default)
            found = engine.find_file(kind, v.replace("\\", "/").split("/")[-1])
            if not found:
                notes.append(f"⚠ Файла «{v}» нет — взят «авто». EN: «{v}» not found, using auto.")
                return engine.find_file(kind, default)
            if kind in ("diffusion_models", "text_encoders", "vae") and "ltx" not in found.lower() \
                    and "gemma" not in found.lower():
                notes.append(f"⚠ Выбран свой файл «{found}» — по имени не похож на LTX 2.5. Если будет ошибка, "
                             f"поставь «авто». EN: «{found}» doesn't look like LTX 2.5 by name; use auto on error.")
            return found

        models = {"unet": model(unet_model, "diffusion_models", engine.UNET_NAME),
                  "clip": model(clip_model, "text_encoders", engine.CLIP_NAME),
                  "vae_video": model(vae_video_model, "vae", engine.VAE_VIDEO_NAME),
                  "vae_audio": model(vae_audio_model, "vae", engine.VAE_AUDIO_NAME),
                  "interp": model(interp_model, "frame_interpolation", engine.INTERP_NAME)}
        missing = [k for k in ("unet", "clip", "vae_video", "vae_audio") if not models[k]]
        if missing:
            raise engine.FriendlyError(
                "[LTX Engine] Моделей LTX 2.5 нет. Нажми на ноде кнопку «📥 Модели / Models» — она скачает всё сама "
                "и разложит по папкам.\n\nEN: No LTX 2.5 models found. Press «📥 Модели / Models» on the node — it "
                "downloads everything and puts it in the right folders.")
        loras = []
        for nm, st in ((lora_1, lora_1_strength), (lora_2, lora_2_strength)):
            if not nm or nm in (NO_LORA, NOT_FOUND) or abs(float(st)) <= 1e-6:
                continue
            if engine.find_file("loras", nm.replace("\\", "/").split("/")[-1]):
                loras.append((nm, st))
            else:
                notes.append(f"⚠ LoRA «{nm}» нет — пропущена. EN: LoRA «{nm}» not found, skipped.")
        if input_upscale not in (NO_UPSCALE, NOT_FOUND, None) and not engine.find_file(
                "upscale_models", input_upscale.replace("\\", "/").split("/")[-1]):
            notes.append(f"⚠ Апскейла «{input_upscale}» нет — вход без апскейла. EN: upscale model not found, skipped.")
            input_upscale = NO_UPSCALE
        if seconds_in is not None:
            seconds = max(1.0, min(float(seconds_in), sizing.MAX_SECONDS))
            notes.append(f"Длительность с провода seconds_in: {seconds:g} с (ползунок не используется)")
        settings = {"mode": mode if mode in engine.MODES else engine.MODES[0], "seconds": float(seconds),
                    "gpu": gpu, "fixed_size": sizing.fixed_size(size, manual_width, manual_height, width, height),
                    "megapixels": float(megapixels) if size == sizing.SIZE_AREA else 0.0,
                    "fps": float(fps), "t2v_aspect": t2v_aspect,
                    "first_strength": float(first_strength), "mid_strength": float(mid_strength),
                    "last_strength": float(last_strength), "mid1_sec": float(mid1_sec), "mid2_sec": float(mid2_sec),
                    "input_upscale": None if input_upscale in (NO_UPSCALE, NOT_FOUND, None) else input_upscale,
                    "input_sharpen": float(input_sharpen), "img_compression": int(img_compression),
                    "output_sharpen": float(output_sharpen), "smooth": bool(smooth), "seed": int(seed)}
        frames = {"first": first_frame, "mid1": mid_frame_1, "mid2": mid_frame_2, "last": last_frame}
        try:
            video, audio, imgs, out_fps, report, used = engine.generate(prompt, camera_prompt, frames, settings, models,
                                                                         loras)
        except Exception:
            engine.free("после ошибки / after error")
            raise
        report = notes + report
        for line in report:
            log.info("[LTX Engine] %s", line)
        return {"ui": {"text": ["\n".join(report)]}, "result": (video, audio, imgs, out_fps, used)}


NODE_CLASS_MAPPINGS = {"NeronLTXEngine": NeronLTXEngine}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronLTXEngine": "🎬 Neron LTX Engine / Генератор LTX 2.5"}
