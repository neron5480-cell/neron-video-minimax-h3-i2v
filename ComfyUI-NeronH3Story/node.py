# -*- coding: utf-8 -*-
"""🎬 Neron H3 Story — длинный ролик MiniMax H3 цепочкой блоков (прототип, ветка dev).

Новичок видит: эксперт, режим, длину блока, 🔒 «сохранить внешний вид», размер. Длина ролика и блока — ползунки;
блоков нода насчитает сама. Промпт и LoRA каждого блока — проводами (prompt_k + lora_k), общая LoRA — lora_all. Остальное — под ⚙ экспертом.
"""
import logging

import math

from . import passport, story
from .lora_pack import LORA_TYPE

log = logging.getLogger("Neron.H3.Story")
NOT_FOUND = "__not_found__"
NO_LORA = "— нет / none —"
AUTO_SIZE = "Авто — по первому кадру / Auto — from first frame"
MAX_BLOCKS = 12
TOTAL_MIN, TOTAL_MAX = 5.0, 45.0
MIN_TRAINED = 124          # 5 с — меньше модель не обучена; блоки цепочки не короче


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


def _has(files, name):
    return any(f.replace("\\", "/").split("/")[-1] == name for f in files)


def _main(label, **o):
    return dict(o, h3_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


class NeronH3Story:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("VIDEO", "IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "frames", "audio", "last_frame", "frames_count")
    OUTPUT_NODE = False
    DESCRIPTION = ("Длинный ролик MiniMax H3 цепочкой блоков: каждый следующий блок продолжает хвост прошлого "
                   "вместе со звуком, внешний вид держится образцом. "
                   "Long MiniMax H3 video as a chain of blocks with seamless tails and kept appearance.")

    ORDER = ["expert",
             "mode", "total_seconds", "block_seconds", "keep_appearance",   # РОЛИК / STORY
             "size", "manual_width", "manual_height",                       # РАЗМЕР / SIZE
             "seam", "seam_frames",                                         # СТЫК / SEAM
             "unet_model", "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model",
             "seed", "ref_quality", "fast_attention"]

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req)
        return d

    @classmethod
    def _raw(cls):
        unets, clips, vaes = _files("diffusion_models"), _files("text_encoders"), _files("vae")
        sizes = [AUTO_SIZE] + list(passport.PRESETS)
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать стык, модели, LoRA, ручной размер и сид. Скрытое всё равно работает.\n\n"
                                   "EN: Show seam, models, LoRA, manual size and seed. Hidden settings still work.")),
                "mode": (story.MODES, _main("режим / mode", default=story.MODES[0],
                         tooltip="⚡ Турбо — 12 шагов, черновик. Качество — 40 шагов, ~3× дольше. Максимум — 50 шагов + "
                                 "bf16, если скачана. Время умножается на число блоков.\n\nEN: Turbo 12 steps · Quality "
                                 "40 · Maximum 50 + bf16. Time is multiplied by the number of blocks.")),
                "total_seconds": ("FLOAT", _main("длина ролика, с / video seconds", default=30.0, min=TOTAL_MIN,
                                  max=TOTAL_MAX, step=0.5, display="slider",
                                  tooltip="Сколько секунд будет весь ролик (5–45). Блоков нода насчитает сама: ролик "
                                          "делится на блоки по «длине блока», каждый стык съедает ~0,9 с. Готовый "
                                          "ролик обрезается ровно под эту длину.\n\nEN: Whole video length (5–45 s). "
                                          "The node works out the number of blocks itself.")),
                "block_seconds": ("FLOAT", _main("длина блока, с / block seconds", default=10.0, min=5.0, max=15.0,
                                  step=0.5, display="slider",
                                  tooltip="Длина одного блока (5–15 с — на этом обучена H3). Короче блок — меньше "
                                          "«уплывает» внутри, но больше стыков.\n\nEN: One block (5–15 s, the "
                                          "model's trained range). Shorter drifts less, but more seams.")),
                "keep_appearance": ("BOOLEAN", _main("🔒 сохранить внешний вид / keep appearance", default=True,
                                    tooltip="Исходная картинка (или вход appearance) идёт образцом <Picture 1> в КАЖДЫЙ "
                                            "блок, чтобы люди и предметы не менялись между блоками. Особенно важно, "
                                            "когда в конце блока лиц не видно (обнялись, отвернулись). Сними, если "
                                            "объект по сюжету должен измениться.\n\nEN: The source picture rides as "
                                            "<Picture 1> into every block so people and objects stay the same. "
                                            "Turn off if the subject must change by the story.")),
                "size": (sizes, _main("размер / size", default=AUTO_SIZE,
                         tooltip="Авто — форма первого кадра в паспорте модели (короткая сторона 768). Пресеты — ровно "
                                 "паспорт H3.\n\nEN: Auto — first frame's shape within the model passport.")),
                "manual_width": ("INT", _exp("ручной · ширина / manual width", default=1344, min=256, max=8192,
                                 step=32)),
                "manual_height": ("INT", _exp("ручной · высота / manual height", default=768, min=256, max=8192,
                                  step=32)),
                "seam": (story.SEAMS, _exp("стык / seam", default=story.SEAMS[0],
                         tooltip="Кусок + звук — к началу блока прикалываются последние кадры прошлого вместе с их "
                                 "звуком: модель продолжает движение и звук без рывка. Один кадр — только последний "
                                 "кадр, звук стыкуется плавным переходом.\n\nEN: Clip + sound continues motion and "
                                 "audio from the previous block's tail. Single frame anchors only the last frame.")),
                "seam_frames": (["22", "5", "39"], _exp("длина стыка, кадров / seam frames", default="22",
                                tooltip="22 кадра ≈ 0,9 с — по умолчанию. 5 — короче, 39 ≈ 1,6 с — больше «памяти» о "
                                        "движении. Только сетка модели.\n\nEN: 22 ≈ 0.9 s default; 5 shorter; "
                                        "39 ≈ 1.6 s more motion memory.")),
                "unet_model": (unets, _exp("модель / model",
                               default=_pick(unets, story.UNET_BF16 if _has(unets, story.UNET_BF16) else story.UNET_NAME))),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=_pick(clips, story.CLIP_NAME))),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=_pick(vaes, story.VAE_VIDEO_NAME))),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=_pick(vaes, story.VAE_AUDIO_NAME))),
                "turbo_lora_model": (_files("loras"), _exp("турбо-LoRA / turbo LoRA",
                                     default=_pick(_files("loras"), story.TURBO_LORA_NAME))),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFFFFFF)),
                "ref_quality": (["auto", "max", "match"], _exp("качество образца / reference quality",
                                default="auto", tooltip="auto: Турбо — match, Качество/Максимум — max.")),
                "fast_attention": ("BOOLEAN", _exp("быстрое внимание INT8 / fast attention", default=False)),
            },
            "optional": {
                "first_frame": ("IMAGE", {"tooltip": "Первый кадр ролика (LoadImage). Нет — блок 1 по тексту.\n\n"
                                                     "EN: First frame of the video. None — block 1 from text."}),
                "appearance": ("IMAGE", {"tooltip": "Образец внешности, если нужен другой, чем первый кадр. Не "
                                                    "подключён — образцом служит первый кадр.\n\nEN: Appearance "
                                                    "reference; defaults to the first frame."}),
                "lora_all": (LORA_TYPE, {"tooltip": "LoRA на ВЕСЬ ролик (стиль, персонаж) — 🎨 Набор LoRA.\n\n"
                                                    "EN: LoRAs for the WHOLE video — a 🎨 LoRA set node."}),
                "prompt_1": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 1 / Block 1 prompt"}),
                "lora_1": (LORA_TYPE, {"tooltip": "LoRA только для блока 1 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 1 only."}),
                "prompt_2": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 2 / Block 2 prompt"}),
                "lora_2": (LORA_TYPE, {"tooltip": "LoRA только для блока 2 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 2 only."}),
                "prompt_3": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 3 / Block 3 prompt"}),
                "lora_3": (LORA_TYPE, {"tooltip": "LoRA только для блока 3 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 3 only."}),
                "prompt_4": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 4 / Block 4 prompt"}),
                "lora_4": (LORA_TYPE, {"tooltip": "LoRA только для блока 4 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 4 only."}),
                "prompt_5": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 5 / Block 5 prompt"}),
                "lora_5": (LORA_TYPE, {"tooltip": "LoRA только для блока 5 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 5 only."}),
                "prompt_6": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 6 / Block 6 prompt"}),
                "lora_6": (LORA_TYPE, {"tooltip": "LoRA только для блока 6 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 6 only."}),
                "prompt_7": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 7 / Block 7 prompt"}),
                "lora_7": (LORA_TYPE, {"tooltip": "LoRA только для блока 7 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 7 only."}),
                "prompt_8": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 8 / Block 8 prompt"}),
                "lora_8": (LORA_TYPE, {"tooltip": "LoRA только для блока 8 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 8 only."}),
                "prompt_9": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 9 / Block 9 prompt"}),
                "lora_9": (LORA_TYPE, {"tooltip": "LoRA только для блока 9 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 9 only."}),
                "prompt_10": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 10 / Block 10 prompt"}),
                "lora_10": (LORA_TYPE, {"tooltip": "LoRA только для блока 10 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 10 only."}),
                "prompt_11": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 11 / Block 11 prompt"}),
                "lora_11": (LORA_TYPE, {"tooltip": "LoRA только для блока 11 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 11 only."}),
                "prompt_12": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 12 / Block 12 prompt"}),
                "lora_12": (LORA_TYPE, {"tooltip": "LoRA только для блока 12 — 🎨 Набор LoRA.\n\nEN: LoRAs for block 12 only."}),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
            },
        }

    def generate(self, expert=False, mode=None, total_seconds=30.0, block_seconds=10.0, keep_appearance=True,
                 size=AUTO_SIZE, manual_width=1344, manual_height=768, seam=None, seam_frames="22", unet_model=None,
                 clip_model=None, vae_video_model=None, vae_audio_model=None, turbo_lora_model=None, seed=1,
                 ref_quality="auto", fast_attention=False, first_frame=None, appearance=None, lora_all=None,
                 width=None, height=None, **kw):
        given = [((kw.get(f"prompt_{k}") or "").strip(), list(kw.get(f"lora_{k}") or []))
                 for k in range(1, MAX_BLOCKS + 1)]
        if not any(p for p, _ in given):
            raise story.FriendlyError("[H3 Story] Нет ни одного промпта блока. Подключи prompt_1 (и prompt_2, "
                                      "prompt_3…) — по промпту на блок.\n\nEN: No block prompts. Connect prompt_1 "
                                      "(and more) — one prompt per block.")
        notes = []
        if width is not None and height is not None:
            w, h, note = passport.fit(int(width), int(height))
        elif size == AUTO_SIZE:
            if first_frame is not None:
                w, h = passport.canvas(int(first_frame.shape[2]), int(first_frame.shape[1]))
                note = f"по первому кадру {int(first_frame.shape[2])}×{int(first_frame.shape[1])} → {w}×{h}"
            else:
                (w, h), note = passport.preset_size(list(passport.PRESETS)[0]), "кадра нет — 16:9"
        elif passport.PRESETS.get(size) is None:
            w, h, note = passport.fit(int(manual_width), int(manual_height))
        else:
            (w, h), note = passport.preset_size(size), ""
        if note:
            notes.append("Размер: " + note)
        seam_ok = seam if seam in story.SEAMS else story.SEAMS[0]
        S = int(seam_frames or 22) if seam_ok == story.SEAMS[0] else 1
        total = min(TOTAL_MAX, max(TOTAL_MIN, float(total_seconds)))
        T = int(round(total * passport.FPS))
        # длина блока — максимум: ролик делится на РОВНЫЕ блоки не длиннее неё (стыки съедают S кадров),
        # чтобы не гнать лишний полный блок ради последней секунды
        n_max, _, note = passport.frames(seconds=float(block_seconds))
        if note:
            notes.append("Длина блока: " + note)
        if T <= n_max:
            blocks = 1
            n = passport.frames(seconds=total)[0]
        else:
            blocks = math.ceil((T - S) / (n_max - S))
            n = passport.frames(length=max(MIN_TRAINED, math.ceil((T + (blocks - 1) * S) / blocks)))[0]
            n = min(n, n_max)
        if blocks > MAX_BLOCKS:
            raise story.FriendlyError(f"[H3 Story] {total:g} с при блоке {block_seconds:g} с — это {blocks} блоков, "
                                      f"а нода умеет до {MAX_BLOCKS}. Сделай блок длиннее.\n\nEN: {blocks} blocks "
                                      f"needed, max is {MAX_BLOCKS}. Make blocks longer.")
        notes.append(f"План: {total:g} с = {blocks} блок(а) по {n / passport.FPS:.1f} с (не длиннее "
                     f"{n_max / passport.FPS:.1f} с), стык {S} кадр.")
        # промпт и LoRA для каждого блока; нет своего промпта — повторяем предыдущий (честно пишем об этом)
        prompts, block_loras, prev = [], [], None
        for k in range(blocks):
            p, loras_k = given[k]
            if not p:
                if prev is None:
                    p = next(x for x, _ in given if x)
                    notes.append(f"Блок {k + 1}: своего промпта нет — взят первый подключённый")
                else:
                    p = prev
                    notes.append(f"Блок {k + 1}: своего промпта нет — повторён промпт блока {k}")
            prompts.append(p)
            block_loras.append([(d["name"], d["strength"]) for d in loras_k])
            prev = p
        extra = [k + 1 for k in range(blocks, MAX_BLOCKS) if given[k][0]]
        if extra:
            notes.append(f"Промпты блоков {', '.join(map(str, extra))} не пошли в дело: ролику хватило {blocks} "
                         f"блок(ов). Увеличь длину ролика, если они нужны.")
        global_loras = [(d["name"], d["strength"]) for d in (lora_all or [])]

        def model(v, default):
            return default if not v or v == NOT_FOUND else v
        default_unet = story.UNET_BF16 if story.find_file("diffusion_models", story.UNET_BF16) else story.UNET_NAME
        models = {"unet": model(unet_model, default_unet), "clip": model(clip_model, story.CLIP_NAME),
                  "vae_video": model(vae_video_model, story.VAE_VIDEO_NAME),
                  "vae_audio": model(vae_audio_model, story.VAE_AUDIO_NAME),
                  "turbo_lora": model(turbo_lora_model, story.TURBO_LORA_NAME)}
        try:
            frames, audio, last, count, report = story.generate(
                prompts, w, h, n, mode if mode in story.MODES else story.MODES[0], int(seed), models,
                first_frame=first_frame, appearance=appearance, keep_appearance=bool(keep_appearance),
                seam=seam_ok, seam_frames=int(seam_frames or 22), ref_quality=ref_quality,
                fast_attention=bool(fast_attention), global_loras=global_loras, block_loras=block_loras,
                total_frames=T)
        except Exception:
            story.free("после ошибки / after error")
            raise
        video = story.node("CreateVideo", images=frames, fps=24.0, audio=audio)[0]
        for line in notes + report:
            log.info("[H3 Story] %s", line)
        return {"ui": {"text": ["\n".join(notes + report)]}, "result": (video, frames, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3Story": NeronH3Story}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Story": "🎬 Neron H3 Story / Длинный ролик H3 (прототип)"}

