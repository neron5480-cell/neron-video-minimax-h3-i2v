# -*- coding: utf-8 -*-
"""🎬 Neron H3 Story — длинный ролик MiniMax H3 цепочкой блоков (прототип, ветка dev).

Три состояния (их показывает интерфейс, движок принимает всё всегда):
  • подключён story (📝 Story AutoPrompter) — план, промпты, картинки и LoRA приходят по шине;
  • «чайник» — первый кадр + промпт блока 1, 2… проводами;
  • ⚙ эксперт — ноды 🎞 Блок, lora_all, длины, размер, стык, модели.
Провод, подключённый к движку напрямую, главнее того, что пришло по шине.
"""
import logging

from . import bus, downloader, passport
from . import story as story_mod

log = logging.getLogger("Neron.H3.Story")
NOT_FOUND = "__not_found__"
NO_LORA = "— нет / none —"
AUTO_SIZE = "Авто — по первому кадру / Auto — from first frame"
AUTO_MODEL = "🤖 авто — из пакета / auto — from pack"
# роль в packs.json → вид папки, имя по умолчанию
ROLES = {"unet": ("diffusion_models", story_mod.UNET_NAME), "clip": ("text_encoders", story_mod.CLIP_NAME),
         "vae_video": ("vae", story_mod.VAE_VIDEO_NAME), "vae_audio": ("vae", story_mod.VAE_AUDIO_NAME),
         "turbo_lora": ("loras", story_mod.TURBO_LORA_NAME), "fast_lora": ("loras", story_mod.FAST_LORA_NAME)}


def auto_file(role):
    """Файл для роли прямо сейчас: из пакета или любая его замена (alternatives), что уже лежит.
    Для модели bf16 — она первая, если скачана (качество лучше, а нода сама по себе тяжёлая)."""
    kind, default = ROLES[role]
    names = [default]
    try:
        for e in downloader.default_pack()[1]["files"]:
            if e["role"] == role:
                names = [downloader.file_name(e)] + list(e.get("alternatives") or [])
    except Exception:
        pass
    if role == "unet":
        names = [story_mod.UNET_BF16] + [n for n in names if n != story_mod.UNET_BF16]
    for n in names:
        f = story_mod.find_file(kind, n)
        if f:
            return f
    return None
MAX_BLOCKS = bus.MAX_BLOCKS
TOTAL_MIN, TOTAL_MAX = bus.TOTAL_MIN, bus.TOTAL_MAX
FPS = bus.FPS


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


AUTO_TIP = ("🤖 авто — файл из пакета (или его другая версия, что уже лежит). Нет файла — нажми «📥 Модели».\n\n"
            "EN: auto — the pack's file (or another version you have). Missing — press «📥 Models».")


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
             "seed", "ref_quality", "fast_attention",
             # новое — строго в конец: старые сохранённые схемы хранят значения по порядку
             "fast_steps", "fast_lora_model"]                               # 🚀 БЫСТРО / FAST

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req)
        return d

    @classmethod
    def _raw(cls):
        unets, clips, vaes = (_files("diffusion_models", AUTO_MODEL), _files("text_encoders", AUTO_MODEL),
                              _files("vae", AUTO_MODEL))
        loras = _files("loras", AUTO_MODEL)
        sizes = [AUTO_SIZE] + list(passport.PRESETS)
        return {
            "required": {
                "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                           tooltip="Показать стык, модели, LoRA, ручной размер и сид. Скрытое всё равно работает.\n\n"
                                   "EN: Show seam, models, LoRA, manual size and seed. Hidden settings still work.")),
                "mode": (story_mod.MODES, _main("режим / mode", default=story_mod.TURBO,
                         tooltip="🚀 Быстро — 4 шага на быстрой LoRA: мультики, 3D, проба сюжета. ⚡ Турбо — 12 шагов, "
                                 "основной режим. Качество — 40 шагов, ~3× дольше. Максимум — 50 шагов + bf16, если "
                                 "скачана. Время умножается на число блоков.\n\nEN: Fast 4 steps (cartoons, 3D, story "
                                 "drafts) · Turbo 12 · Quality 40 · Maximum 50 + bf16. Time × number of blocks.")),
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
                "seam": (story_mod.SEAMS, _exp("стык / seam", default=story_mod.SEAMS[0],
                         tooltip="Кусок + звук — к началу блока прикалываются последние кадры прошлого вместе с их "
                                 "звуком: модель продолжает движение и звук без рывка. Один кадр — только последний "
                                 "кадр, звук стыкуется плавным переходом.\n\nEN: Clip + sound continues motion and "
                                 "audio from the previous block's tail. Single frame anchors only the last frame.")),
                "seam_frames": (["22", "5", "39"], _exp("длина стыка, кадров / seam frames", default="22",
                                tooltip="22 кадра ≈ 0,9 с — по умолчанию. 5 — короче, 39 ≈ 1,6 с — больше «памяти» о "
                                        "движении. Только сетка модели.\n\nEN: 22 ≈ 0.9 s default; 5 shorter; "
                                        "39 ≈ 1.6 s more motion memory.")),
                "fast_steps": (["4", "6", "8"], _exp("🚀 шаги «Быстро» / Fast steps", default="4",
                               tooltip="Сколько шагов в режиме 🚀 Быстро. 4 — как задумано авторами LoRA, 6–8 — "
                                       "чуть чище детали, дольше.\n\nEN: Steps in 🚀 Fast mode. 4 is what the LoRA "
                                       "was made for; 6–8 a bit cleaner, slower.")),
                "unet_model": (unets, _exp("модель / model", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "clip_model": (clips, _exp("текстовый энкодер / text encoder", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "vae_video_model": (vaes, _exp("VAE видео / video VAE", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "vae_audio_model": (vaes, _exp("VAE звука / audio VAE", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "turbo_lora_model": (loras, _exp("⚡ турбо-LoRA / turbo LoRA", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "fast_lora_model": (loras, _exp("🚀 быстрая LoRA / fast LoRA", default=AUTO_MODEL, tooltip=AUTO_TIP)),
                "seed": ("INT", _exp("сид / seed", default=1, min=0, max=0xFFFFFFFFFFFFFFFF)),
                "ref_quality": (["auto", "max", "match"], _exp("качество образца / reference quality",
                                default="auto", tooltip="auto: Турбо — match, Качество/Максимум — max.")),
                "fast_attention": ("BOOLEAN", _exp("быстрое внимание INT8 / fast attention", default=False)),
            },
            "optional": {
                "story": (bus.STORY_TYPE, {"tooltip": "Шина от 📝 Story AutoPrompter: план, промпты, картинки и LoRA всех "
                                                      "блоков одним проводом. Подключена — лишнее на ноде прячется.\n\n"
                                                      "EN: Bus from the Story AutoPrompter: plan, prompts, pictures and "
                                                      "LoRAs of all blocks in one wire."}),
                "first_frame": ("IMAGE", {"tooltip": "Первый кадр ролика (LoadImage). Он же образец внешности (🔒).\n\n"
                                                     "EN: First frame of the video, also the appearance sample."}),
                "appearance": ("IMAGE", {"tooltip": "Отдельный образец внешности, если нужен не первый кадр.\n\n"
                                                    "EN: Separate appearance reference."}),
                "lora_all": (bus.LORA_TYPE, {"tooltip": "LoRA на ВЕСЬ ролик (стиль) — 🎨 Набор LoRA.\n\n"
                                                        "EN: LoRAs for the WHOLE video (style)."}),
                "prompt_1": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 1 — как есть, в модель. / Block 1 prompt, as is."}),
                "block_1": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 1: картинки, текст и LoRA блока. / Block 1 node."}),
                "lora_1": (bus.LORA_TYPE, {"tooltip": "LoRA блока 1 (старый вход; теперь — через 🎞 Блок). / Block 1 LoRAs (legacy)."}),
                "prompt_2": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 2 — как есть, в модель. / Block 2 prompt, as is."}),
                "block_2": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 2: картинки, текст и LoRA блока. / Block 2 node."}),
                "lora_2": (bus.LORA_TYPE, {"tooltip": "LoRA блока 2 (старый вход; теперь — через 🎞 Блок). / Block 2 LoRAs (legacy)."}),
                "prompt_3": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 3 — как есть, в модель. / Block 3 prompt, as is."}),
                "block_3": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 3: картинки, текст и LoRA блока. / Block 3 node."}),
                "lora_3": (bus.LORA_TYPE, {"tooltip": "LoRA блока 3 (старый вход; теперь — через 🎞 Блок). / Block 3 LoRAs (legacy)."}),
                "prompt_4": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 4 — как есть, в модель. / Block 4 prompt, as is."}),
                "block_4": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 4: картинки, текст и LoRA блока. / Block 4 node."}),
                "lora_4": (bus.LORA_TYPE, {"tooltip": "LoRA блока 4 (старый вход; теперь — через 🎞 Блок). / Block 4 LoRAs (legacy)."}),
                "prompt_5": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 5 — как есть, в модель. / Block 5 prompt, as is."}),
                "block_5": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 5: картинки, текст и LoRA блока. / Block 5 node."}),
                "lora_5": (bus.LORA_TYPE, {"tooltip": "LoRA блока 5 (старый вход; теперь — через 🎞 Блок). / Block 5 LoRAs (legacy)."}),
                "prompt_6": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 6 — как есть, в модель. / Block 6 prompt, as is."}),
                "block_6": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 6: картинки, текст и LoRA блока. / Block 6 node."}),
                "lora_6": (bus.LORA_TYPE, {"tooltip": "LoRA блока 6 (старый вход; теперь — через 🎞 Блок). / Block 6 LoRAs (legacy)."}),
                "prompt_7": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 7 — как есть, в модель. / Block 7 prompt, as is."}),
                "block_7": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 7: картинки, текст и LoRA блока. / Block 7 node."}),
                "lora_7": (bus.LORA_TYPE, {"tooltip": "LoRA блока 7 (старый вход; теперь — через 🎞 Блок). / Block 7 LoRAs (legacy)."}),
                "prompt_8": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 8 — как есть, в модель. / Block 8 prompt, as is."}),
                "block_8": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 8: картинки, текст и LoRA блока. / Block 8 node."}),
                "lora_8": (bus.LORA_TYPE, {"tooltip": "LoRA блока 8 (старый вход; теперь — через 🎞 Блок). / Block 8 LoRAs (legacy)."}),
                "prompt_9": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 9 — как есть, в модель. / Block 9 prompt, as is."}),
                "block_9": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 9: картинки, текст и LoRA блока. / Block 9 node."}),
                "lora_9": (bus.LORA_TYPE, {"tooltip": "LoRA блока 9 (старый вход; теперь — через 🎞 Блок). / Block 9 LoRAs (legacy)."}),
                "prompt_10": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 10 — как есть, в модель. / Block 10 prompt, as is."}),
                "block_10": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 10: картинки, текст и LoRA блока. / Block 10 node."}),
                "lora_10": (bus.LORA_TYPE, {"tooltip": "LoRA блока 10 (старый вход; теперь — через 🎞 Блок). / Block 10 LoRAs (legacy)."}),
                "prompt_11": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 11 — как есть, в модель. / Block 11 prompt, as is."}),
                "block_11": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 11: картинки, текст и LoRA блока. / Block 11 node."}),
                "lora_11": (bus.LORA_TYPE, {"tooltip": "LoRA блока 11 (старый вход; теперь — через 🎞 Блок). / Block 11 LoRAs (legacy)."}),
                "prompt_12": ("STRING", {"forceInput": True, "tooltip": "Промпт блока 12 — как есть, в модель. / Block 12 prompt, as is."}),
                "block_12": (bus.BLOCK_TYPE, {"tooltip": "🎞 Блок 12: картинки, текст и LoRA блока. / Block 12 node."}),
                "lora_12": (bus.LORA_TYPE, {"tooltip": "LoRA блока 12 (старый вход; теперь — через 🎞 Блок). / Block 12 LoRAs (legacy)."}),
                "ref_audio_1": ("AUDIO", {"tooltip": "⚙ Звуковой образец <Audio 1> — голос, музыка или фон (LoadAudio). Идёт "
                                                     "в КАЖДЫЙ блок, до 15 с. AutoPrompter про него не знает — если "
                                                     "в промпте нет <Audio 1>, движок сам допишет «звук как в образце».\n\n"
                                                     "EN: Sound reference <Audio 1> (voice, music, ambience) for every "
                                                     "block, up to 15 s."}),
                "ref_audio_2": ("AUDIO", {"tooltip": "⚙ Звуковой образец <Audio 2>. / Sound reference <Audio 2>."}),
                "ref_audio_3": ("AUDIO", {"tooltip": "⚙ Звуковой образец <Audio 3>. / Sound reference <Audio 3>."}),
                "width": ("INT", {"forceInput": True}),
                "height": ("INT", {"forceInput": True}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, unet_model, clip_model, vae_video_model, vae_audio_model, turbo_lora_model,
                        fast_lora_model):
        # Файла из чужой схемы здесь нет — не красное окно: модель уходит на «авто», с запиской в отчёте.
        # A saved file that doesn't exist here is not a red error: it falls back to auto, with a note.
        return True

    def generate(self, expert=False, mode=None, total_seconds=30.0, block_seconds=10.0, keep_appearance=True,
                 size=AUTO_SIZE, manual_width=1344, manual_height=768, seam=None, seam_frames="22", unet_model=None,
                 clip_model=None, vae_video_model=None, vae_audio_model=None, turbo_lora_model=None,
                 fast_lora_model=None, fast_steps="4", ref_audio_1=None, ref_audio_2=None, ref_audio_3=None, seed=1,
                 ref_quality="auto", fast_attention=False, story=None, first_frame=None, appearance=None,
                 lora_all=None, width=None, height=None, **kw):
        notes = []
        bus_ = story or {}
        sb = list(bus_.get("blocks") or [])
        # провод, подключённый к движку напрямую, главнее шины
        first = first_frame if first_frame is not None else bus_.get("first_frame")
        appear = appearance if appearance is not None else bus_.get("appearance")
        g_loras = lora_all if lora_all is not None else bus_.get("lora_all")
        if story is not None:
            total_seconds = bus_.get("total_seconds", total_seconds)
            block_seconds = bus_.get("block_seconds", block_seconds)
            notes.append(f"План из Story AutoPrompter: {float(total_seconds):g} с, блок до {float(block_seconds):g} с")

        given = []
        for k in range(MAX_BLOCKS):
            b = kw.get(f"block_{k + 1}") or (sb[k] if k < len(sb) else None) or {}
            text = (kw.get(f"prompt_{k + 1}") or b.get("prompt") or b.get("text") or "").strip()
            loras = list(b.get("loras") or []) + list(kw.get(f"lora_{k + 1}") or [])
            given.append({"prompt": text, "loras": loras, "first": b.get("first"), "mid": list(b.get("mid") or []),
                          "last": b.get("last")})
        if first is None and given[0]["first"] is not None:
            first = given[0]["first"]
        if not any(g["prompt"] for g in given):
            raise story_mod.FriendlyError("[H3 Story] Нет ни одного промпта блока. Подключи prompt_1 (и дальше), ноды "
                                          "🎞 Блок с текстом или 📝 Story AutoPrompter.\n\nEN: No block prompts. "
                                          "Connect prompt_1, 🎞 Block nodes with text, or the Story AutoPrompter.")

        if width is not None and height is not None:
            w, h, note = passport.fit(int(width), int(height))
        elif size == AUTO_SIZE:
            if first is not None:
                w, h = passport.canvas(int(first.shape[2]), int(first.shape[1]))
                note = f"по первому кадру {int(first.shape[2])}×{int(first.shape[1])} → {w}×{h}"
            else:
                (w, h), note = passport.preset_size(list(passport.PRESETS)[0]), "кадра нет — 16:9"
        elif passport.PRESETS.get(size) is None:
            w, h, note = passport.fit(int(manual_width), int(manual_height))
        else:
            (w, h), note = passport.preset_size(size), ""
        if note:
            notes.append("Размер: " + note)

        seam_ok = seam if seam in story_mod.SEAMS else story_mod.SEAMS[0]
        S = int(seam_frames or 22) if seam_ok == story_mod.SEAMS[0] else 1
        blocks, n, T, n_max = bus.plan(total_seconds, block_seconds, S)
        if blocks > MAX_BLOCKS:
            raise story_mod.FriendlyError(f"[H3 Story] Нужно {blocks} блоков, а нода умеет до {MAX_BLOCKS}. Сделай блок "
                                          f"длиннее.\n\nEN: {blocks} blocks needed, max is {MAX_BLOCKS}.")
        notes.append(f"План: {T / FPS:g} с = {blocks} блок(а) по {n / FPS:.1f} с (не длиннее {n_max / FPS:.1f} с), "
                     f"стык {S} кадр.")
        prompts, block_loras, block_images, prev = [], [], [], None
        for k in range(blocks):
            g = given[k]
            p = g["prompt"]
            if not p:
                if prev is None:
                    p = next(x["prompt"] for x in given if x["prompt"])
                    notes.append(f"Блок {k + 1}: своего промпта нет — взят первый")
                else:
                    p = prev
                    notes.append(f"Блок {k + 1}: своего промпта нет — повторён промпт блока {k}")
            prompts.append(p)
            block_loras.append(bus.loras_pairs(g["loras"]))
            block_images.append({"who": g["first"] if k > 0 else None, "mid": g["mid"], "last": g["last"]})
            prev = p
        extra = [k + 1 for k in range(blocks, MAX_BLOCKS) if given[k]["prompt"]]
        if extra:
            notes.append(f"Блоки {', '.join(map(str, extra))} не пошли в дело: ролику хватило {blocks}. "
                         f"Увеличь длину ролика, если они нужны.")

        mode = mode if mode in story_mod.MODES else story_mod.TURBO

        def model(v, role):
            # авто (или пусто) — файл из пакета, ищем прямо сейчас, а не по списку со старта ComfyUI
            if not v or v in (AUTO_MODEL, NOT_FOUND):
                return auto_file(role)
            kind = ROLES[role][0]
            found = story_mod.find_file(kind, story_mod.base(v))
            if not found:
                notes.append(f"⚠ Файла «{v}» нет — взят «авто». EN: «{v}» not found, using auto.")
                return auto_file(role)
            return found
        need = ["unet", "clip", "vae_video", "vae_audio"] + (["turbo_lora"] if mode == story_mod.TURBO else []) \
            + (["fast_lora"] if mode == story_mod.FAST else [])
        picked = {"unet": unet_model, "clip": clip_model, "vae_video": vae_video_model, "vae_audio": vae_audio_model,
                  "turbo_lora": turbo_lora_model, "fast_lora": fast_lora_model}
        models = {role: model(picked[role], role) for role in ROLES}
        missing = [role for role in need if not models[role]]
        if missing:
            names = {"unet": "модель H3", "clip": "текстовый энкодер", "vae_video": "VAE видео",
                     "vae_audio": "VAE звука", "turbo_lora": "турбо-LoRA (⚡)", "fast_lora": "быстрая LoRA (🚀)"}
            raise story_mod.FriendlyError(
                "[H3 Story] Не хватает файлов: " + ", ".join(names[m] for m in missing) + ". Нажми на ноде "
                "«📥 Модели / Models» — она скачает всё сама и разложит по папкам.\n\nEN: Missing model files: "
                + ", ".join(missing) + ". Press «📥 Модели / Models» on the node — it downloads everything.")
        try:
            frames, audio, last, count, report = story_mod.generate(
                prompts, w, h, n, mode, int(seed), models,
                first_frame=first, appearance=appear, keep_appearance=bool(keep_appearance), seam=seam_ok,
                seam_frames=int(seam_frames or 22), ref_quality=ref_quality, fast_attention=bool(fast_attention),
                global_loras=bus.loras_pairs(g_loras), block_loras=block_loras, total_frames=T,
                block_images=block_images, fast_steps=int(fast_steps or 4),
                ref_audios=[a for a in (ref_audio_1, ref_audio_2, ref_audio_3) if a is not None])
        except Exception:
            story_mod.free("после ошибки / after error")
            raise
        video = story_mod.node("CreateVideo", images=frames, fps=float(FPS), audio=audio)[0]
        for line in notes + report:
            log.info("[H3 Story] %s", line)
        return {"ui": {"text": ["\n".join(notes + report)]}, "result": (video, frames, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3Story": NeronH3Story}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Story": "🎬 Neron H3 Story / Длинный ролик H3 (прототип)"}

