# -*- coding: utf-8 -*-
"""🎭 Neron H3 Подмена / Swap — опорное видео + фото «на кого» → тот же ролик с другим человеком.

Всё грузится прямо в ноду (видео, фото, свой звук) — без отдельных нод загрузки. Для профи — входы-провода.
Под капотом — ядро H3 One: режимы, защита от двоения, ускорение, ⏱ замер, автоскачивание моделей.

Как это устроено (только родные ноды ComfyUI):
  • опорное видео → <Video 1> (MiniMaxH3ReferenceToVideo, ref_videos): движение, сцена, камера, свет;
  • фото → <Picture 1>: кто будет в кадре — только лицо или весь облик;
  • звук опорного видео идёт образцом (<Video 1> со звуком), чтобы губы и движения легли на речь;
  • текст для модели нода пишет сама (подмена лица / полная подмена); своё уточнение — дописывается.
Звук на выходе: 🎵 оригинал (байт в байт), 🔊 свой файл или ✨ сгенерированный H3.
"""
import logging
import math

import torch

from . import passport, speed
from . import engine as E
from .core import FriendlyError, free, node
from .node import (AUTO_MODEL, AUTO_TIP, LORA_TYPE, NO_LORA, NOT_FOUND, _exp, _files, _main, resolve_loras,
                   resolve_models)

log = logging.getLogger("Neron.H3.One")
TAG = "[H3 Swap]"
NO_FILE = "— нет / none —"

WHAT = ["🙂 лицо / face", "🧍 полностью / whole person"]
FACE, WHOLE = WHAT
SOUND = ["🎵 оригинал / original", "🔊 свой файл / own file", "✨ сгенерировать / generate"]
SND_ORIG, SND_OWN, SND_GEN = SOUND
HOLD = ["строго / strict", "свободнее / looser"]
STRICT, LOOSE = HOLD
MAX_SEC = 15.0
MIN_FRAMES = 48            # 2 с при 24 к/с

FACE_TEXT = ("<Video 1> is the source performance. Recreate it exactly: the same motion, gestures, timing, body, "
             "clothing, camera position, framing, lighting, background and every other detail of <Video 1>. "
             "Replace ONLY the face and hair of the main person with the identity from <Picture 1>: the face, facial "
             "features, skin tone and hairstyle follow <Picture 1>. Facial expressions, head turns, blinking and "
             "mouth movements follow <Video 1> frame by frame.")
WHOLE_TEXT = ("<Video 1> is the source performance. Recreate its exact motion, gestures, poses, timing, camera "
              "position, framing, lighting and background. Replace the main person ENTIRELY with the person from "
              "<Picture 1>: face, hair, body build, skin tone and clothing follow <Picture 1>, while every movement, "
              "pose, facial expression and mouth movement follows <Video 1> frame by frame.")
STRICT_TEXT = " Do not add, remove or change any action, object or camera move. A single continuous shot with no cuts."
LOOSE_TEXT = " A single continuous shot with no cuts."


def _input_files(kind):
    try:
        import folder_paths
        files = [f for f in folder_paths.get_filename_list("input") if f]
    except Exception:
        try:
            import os
            import folder_paths
            d = folder_paths.get_input_directory()
            files = sorted(f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))
        except Exception:
            files = []
    ext = {"video": (".mp4", ".webm", ".mov", ".mkv", ".avi", ".gif", ".m4v"),
           "image": (".png", ".jpg", ".jpeg", ".webp", ".bmp"),
           "audio": (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".opus")}[kind]
    return [f for f in files if f.lower().endswith(ext)]


def _path(name):
    import folder_paths
    return folder_paths.get_annotated_filepath(name)


def load_video(name):
    """Файл видео → (кадры [T,H,W,3] float, кадров/с, звук или None)."""
    from comfy_api.latest import InputImpl
    comp = InputImpl.VideoFromFile(_path(name)).get_components()
    return comp.images, float(comp.frame_rate), comp.audio


def load_image(name):
    import numpy as np
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(_path(name))).convert("RGB")
    return torch.from_numpy(np.asarray(im).astype("float32") / 255.0)[None]


def load_audio(name):
    from comfy_extras.nodes_audio import load
    wf, sr = load(_path(name))
    return {"waveform": wf.unsqueeze(0) if wf.dim() == 2 else wf, "sample_rate": int(sr)}


def video_from_input(video):
    """Вход VIDEO (провод от Load Video) → (кадры, к/с, звук)."""
    comp = video.get_components()
    return comp.images, float(comp.frame_rate), comp.audio


def to_24(frames, fps):
    """Кадры с любой частотой → 24 к/с (H3 читает видео-образец именно так)."""
    n = int(frames.shape[0])
    if not fps or abs(fps - 24.0) < 0.01:
        return frames
    dur = n / fps
    m = max(1, int(math.floor(dur * 24.0 + 1e-6)))
    idx = torch.clamp(torch.round(torch.arange(m, dtype=torch.float64) * fps / 24.0).long(), 0, n - 1)
    return frames[idx]


def grid_down(n):
    """Наибольшее 17k+5 не больше n и не больше паспорта (362 кадра ≈ 15 с). Меньше 2 с — 0:
    видео-образец H3 читает от 2 до 15 с."""
    n = min(int(n), passport.MAX_FRAMES)
    if n < MIN_FRAMES:
        return 0
    while n % 17 != 5:
        n -= 1
    return n


def fit_audio(audio, seconds):
    """Звук ровно под длину ролика: длиннее — обрезать, короче — тишина в конце."""
    if audio is None:
        return None
    wf, sr = audio["waveform"], int(audio["sample_rate"])
    if wf.dim() == 2:
        wf = wf.unsqueeze(0)
    need = int(round(seconds * sr))
    if wf.shape[-1] >= need:
        wf = wf[..., :need]
    else:
        wf = torch.nn.functional.pad(wf, (0, need - wf.shape[-1]))
    return {"waveform": wf.contiguous(), "sample_rate": sr}


def swap_prompt(what, hold, extra=""):
    p = (FACE_TEXT if what == FACE else WHOLE_TEXT) + (STRICT_TEXT if hold == STRICT else LOOSE_TEXT)
    extra = (extra or "").strip()
    return p + (" " + extra if extra else "")


class NeronH3Swap:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("VIDEO", "IMAGE", "AUDIO", "IMAGE", "INT")
    RETURN_NAMES = ("video", "frames", "audio", "last_frame", "frames_count")
    DESCRIPTION = ("Подмена: опорное видео + фото «на кого» → тот же ролик с другим человеком (лицо или полностью), "
                   "со звуком оригинала. До 15 с. Заменяйте себя и тех, кто согласен.\nSwap: a source video + a photo of "
                   "who → the same clip with another person (face or whole), with the original sound. Up to 15 s.")

    ORDER = ["expert",
             "video", "photo", "what", "sound", "own_audio",                       # ПОДМЕНА / SWAP
             "mode",                                                               # РЕЖИМ / MODE
             "hold", "extra", "size", "max_seconds",                               # ТОНКО / FINE
             "lora_1", "strength_1",
             "attention", "sparse", "sparse_tau",
             "unet_model", "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model", "fast_lora_model",
             "seed", "fast_steps", "fast_kind", "balance_clean", "protect_lora", "keep_clip", "ref_quality"]

    @classmethod
    def INPUT_TYPES(cls):
        d = cls._raw()
        req = d["required"]
        d["required"] = {k: req[k] for k in cls.ORDER}
        assert len(d["required"]) == len(req), "ORDER и поля разошлись"
        return d

    @classmethod
    def _raw(cls):
        from .node import NeronH3One
        one = NeronH3One._raw()["required"]
        videos = _input_files("video") or [NO_FILE]
        images = _input_files("image") or [NO_FILE]
        audios = [NO_FILE] + _input_files("audio")
        sizes = ["Авто — как у видео / Auto — like the video"] + list(passport.PRESETS)
        req = {
            "expert": one["expert"],
            "video": (videos, _main("🎬 опорное видео / source video",
                      tooltip="Видео, которое повторяем: движение, сцена, камера, свет, звук. До 15 с (длиннее — "
                              "возьмём начало). Нажми «choose file» или перетащи файл.\n\nEN: The video to recreate: "
                              "motion, scene, camera, light, sound. Up to 15 s.")),
            "photo": (images, _main("🖼 на кого / who",
                      tooltip="Фото человека, которым заменяем. Лучше: лицо хорошо видно, ровный свет, анфас или "
                              "чуть вбок. Для «полностью» — человек в полный рост.\n\nEN: Photo of the new person. "
                              "Face clearly visible; full body for «whole person».")),
            "what": (WHAT, _main("заменить / replace", default=FACE,
                     tooltip="🙂 лицо — от фото только лицо и причёска; тело, одежда, движения и сцена — из видео.\n"
                             "🧍 полностью — от фото весь облик (лицо, телосложение, одежда); из видео — движения, "
                             "сцена и камера.\n\nEN: face — only face and hair from the photo; whole person — the "
                             "whole look from the photo.")),
            "sound": (SOUND, _main("звук / sound", default=SND_ORIG,
                      tooltip="🎵 оригинал — звук опорного видео как есть, байт в байт.\n🔊 свой файл — звучит файл "
                              "из поля ниже.\n✨ сгенерировать — звук делает H3, видео служит ему образцом.\n\nEN: "
                              "original — the source video's sound as is; own file; generate — H3 makes it.")),
            "own_audio": (audios, _main("🔊 свой звук / own sound", default=NO_FILE,
                          tooltip="Только для «🔊 свой файл»: голос, музыка — что угодно. Обрежется под длину.\n\nEN: "
                                  "Only for «own file». Trimmed to the clip length.")),
            "mode": one["mode"],
            "hold": (HOLD, _exp("движение / motion", default=STRICT,
                     tooltip="Строго — модель просят повторить видео без единой отсебятины. Свободнее — можно "
                             "дописать в «уточнении», что изменить.\n\nEN: strict — repeat the video exactly; looser — "
                             "lets your hint change things.")),
            "extra": ("STRING", _exp("уточнение / hint", default="", multiline=True,
                      tooltip="Необязательно, по-английски лучше. Например: «She smiles at the end». Дописывается к "
                              "тексту, который нода пишет сама.\n\nEN: Optional hint, appended to the node's own text.")),
            "size": (sizes, _exp("размер / size", default=sizes[0],
                     tooltip="Авто — форма опорного видео в паспорте H3 (до 1344×768).\n\nEN: Auto — the video's "
                             "shape within the H3 passport.")),
            "max_seconds": ("FLOAT", _exp("не длиннее, с / max seconds", default=MAX_SEC, min=1.0, max=MAX_SEC,
                            step=0.5, display="slider",
                            tooltip="Сколько секунд видео брать (от начала). H3 обучена до 15 с.\n\nEN: How many "
                                    "seconds of the video to use, from the start.")),
            "lora_1": one["lora_1"], "strength_1": one["strength_1"],
        }
        req["lora_1"] = (one["lora_1"][0], dict(one["lora_1"][1], h3_main=False))
        req["strength_1"] = (one["strength_1"][0], dict(one["strength_1"][1], h3_main=False))
        for k in ("attention", "sparse", "sparse_tau", "unet_model", "clip_model", "vae_video_model",
                  "vae_audio_model", "turbo_lora_model", "fast_lora_model", "seed", "fast_steps", "fast_kind",
                  "balance_clean", "protect_lora", "keep_clip"):
            req[k] = one[k]
        req["ref_quality"] = (["max", "match"], _exp("качество фото-образца / photo quality", default="max",
                              tooltip="max — фото идёт в полном качестве (лицо узнаётся лучше). match — под размер "
                                      "кадра, чуть быстрее.\n\nEN: max — full quality (better likeness); match — "
                                      "frame size, a bit faster."))
        return {
            "required": req,
            "optional": {
                "video_in": ("VIDEO", {"tooltip": "Профи: видео проводом (Load Video) — главнее окна в ноде.\n\nEN: "
                                                  "Video by wire — wins over the node's own window."}),
                "photo_in": ("IMAGE", {"tooltip": "Профи: фото проводом — главнее окна в ноде.\n\nEN: Photo by wire."}),
                "audio_in": ("AUDIO", {"tooltip": "Профи: свой звук проводом (для «🔊 свой файл»).\n\nEN: Own sound "
                                                  "by wire."}),
                "prompt": ("STRING", {"forceInput": True, "tooltip": "Профи: свой текст целиком — вместо текста ноды. "
                                      "Назови <Video 1> и <Picture 1>.\n\nEN: Your own full prompt instead of the "
                                      "node's — mention <Video 1> and <Picture 1>."}),
                "loras": (LORA_TYPE, {"tooltip": "🎨 Набор LoRA.\n\nEN: LoRA pack."}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, **kw):
        return True

    @classmethod
    def IS_CHANGED(cls, video=None, photo=None, own_audio=None, **kw):
        import hashlib
        import os
        h = hashlib.sha256()
        for n in (video, photo, own_audio):
            try:
                p = _path(n)
                h.update(f"{n}:{os.path.getmtime(p)}".encode())
            except Exception:
                h.update(str(n).encode())
        return h.hexdigest()

    def generate(self, expert=False, video=None, photo=None, what=FACE, sound=SND_ORIG, own_audio=NO_FILE,
                 mode=E.DEFAULT_MODE, hold=STRICT, extra="", size=None, max_seconds=MAX_SEC, lora_1=NO_LORA,
                 strength_1=1.0, attention=speed.AUTO, sparse=speed.AUTO, sparse_tau=E.SPARSE_TAU, unet_model=None,
                 clip_model=None, vae_video_model=None, vae_audio_model=None, turbo_lora_model=None,
                 fast_lora_model=None, seed=1, fast_steps="6", fast_kind=E.FAST_LORA_KIND, balance_clean=False,
                 protect_lora=True, keep_clip="auto", ref_quality="max", video_in=None, photo_in=None, audio_in=None,
                 prompt=None, loras=None):
        notes = []
        mode = E.mode_key(mode)

        # ---- опорное видео ----
        if video_in is not None:
            frames, fps, v_audio = video_from_input(video_in)
            notes.append("Видео: по проводу / video by wire")
        elif video and video != NO_FILE:
            frames, fps, v_audio = load_video(video)
        else:
            raise FriendlyError(f"{TAG} Нет опорного видео. Загрузи его в окно «🎬 опорное видео» на ноде.\n\nEN: No "
                                f"source video. Upload it into the «source video» window on the node.")
        frames = to_24(frames.float(), fps)
        n_src = int(frames.shape[0])
        limit = min(n_src, int(round(float(max_seconds) * 24.0)))
        length = grid_down(limit)
        if not length:
            raise FriendlyError(f"{TAG} Видео слишком короткое: нужно хотя бы 2 с (H3 читает видео-образец от 2 до "
                                f"15 с).\n\nEN: The video is too short — needs at least 2 s.")
        frames = frames[:length]
        notes.append(f"Опорное видео: {n_src / 24:.2f} с при {fps:g} к/с → взято {length} кадров ({length / 24:.2f} с, "
                     f"сетка H3 17k+5)" + (" — длиннее 15 с, взято начало" if n_src > length + 17 else ""))

        # ---- фото ----
        if photo_in is not None:
            person = photo_in[:1]
        elif photo and photo != NO_FILE:
            person = load_image(photo)
        else:
            raise FriendlyError(f"{TAG} Нет фото «на кого». Загрузи его в окно «🖼 на кого».\n\nEN: No photo of who. "
                                f"Upload it into the «who» window.")

        # ---- звук ----
        own = None
        if sound == SND_OWN:
            if audio_in is not None:
                own = audio_in
            elif own_audio and own_audio != NO_FILE:
                own = load_audio(own_audio)
            else:
                notes.append("🔊 Свой звук не выбран — звучит оригинал / no own sound chosen — using the original")
                sound = SND_ORIG
        src_audio = fit_audio(v_audio, length / 24.0) if v_audio is not None else None
        if src_audio is None and sound == SND_ORIG:
            notes.append("🎵 В видео нет звука — звук сгенерирует H3 / the video has no sound — H3 generates it")
            sound = SND_GEN

        # ---- размер ----
        if size and passport.PRESETS.get(size) is not None:
            (w, h) = passport.preset_size(size)
        else:
            w, h = passport.canvas(int(frames.shape[2]), int(frames.shape[1]))
            notes.append(f"Размер: как у видео {int(frames.shape[2])}×{int(frames.shape[1])} → {w}×{h}")

        # ---- текст ----
        text = (prompt or "").strip() or swap_prompt(what, hold, extra)
        notes.append("Подмена: " + ("свой текст" if (prompt or "").strip() else what.split(" / ")[0]) +
                     f" · движение {hold.split(' / ')[0]}")

        models, chosen = resolve_models(notes, mode, unet_model, clip_model, vae_video_model, vae_audio_model,
                                        turbo_lora_model, fast_lora_model, tag=TAG)
        user_loras = resolve_loras(notes, ((lora_1, strength_1),), loras)
        imgs = {"ref_1": person, "ref_video": frames}
        if sound == SND_OWN and own is not None:
            imgs["ref_audio"] = fit_audio(own, length / 24.0)
        elif src_audio is not None:
            imgs["ref_video_audio"] = src_audio
        opt = {"first_as": E.FIRST_REF_ONLY, "protect_lora": bool(protect_lora), "keep_clip": keep_clip,
               "ref_quality": ref_quality if ref_quality in ("max", "match") else "max", "attention": attention,
               "sparse": sparse, "tau": float(sparse_tau), "fast_steps": int(fast_steps or E.FAST_DEFAULT_STEPS),
               "fast_kind": fast_kind, "clean": bool(balance_clean), "unet_chosen": chosen}
        try:
            out, audio, last, count, report = E.generate(mode, text, w, h, length, int(seed), models, imgs,
                                                         user_loras, opt)
        except Exception:
            free("после ошибки / after error")
            raise
        if sound == SND_ORIG and src_audio is not None:
            audio = fit_audio(src_audio, count / 24.0)
            notes.append("🎵 Звук: оригинал опорного видео, байт в байт")
        elif sound == SND_OWN and own is not None:
            audio = fit_audio(own, count / 24.0)
            notes.append("🔊 Звук: свой файл")
        else:
            notes.append("✨ Звук: сгенерирован H3")
        vid = node("CreateVideo", images=out, fps=float(passport.FPS), audio=audio)[0]
        lines = notes + report
        for line in lines:
            log.info("%s %s", TAG, line)
        return {"ui": {"text": ["\n".join(lines)]}, "result": (vid, out, audio, last, count)}


NODE_CLASS_MAPPINGS = {"NeronH3Swap": NeronH3Swap}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3Swap": "🎭 Neron H3 Подмена / Swap"}
