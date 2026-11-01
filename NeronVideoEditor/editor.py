# -*- coding: utf-8 -*-
"""
Neron Video Editor — ноды / nodes.

RU: 🎬 Видео ×3   — кубик входов: до трёх видео по проводам (Load Video).
    🖼 Картинки ×4 — кубик входов: до четырёх картинок (Load Image).
    🎛 Монтажный пульт — сердце: предпросмотр, полоска времени с событиями,
       переходы, области, звук. На выходе — кадры, звук и fps, как у видео 1.
EN: 🎬 Video ×3 — input cube: up to three videos by wire (Load Video).
    🖼 Pictures ×4 — input cube: up to four pictures (Load Image).
    🎛 Edit Pult — the heart: preview, a timeline with events, transitions,
       areas, sound. Outputs frames, audio and fps matching video 1.
"""

import hashlib
import json
import os
import re
import subprocess
import tempfile

import numpy as np
import torch

from . import ve_core as core

MAX_VIDEOS = 3
MAX_IMAGES = 4
PROXY_W = 640          # ширина предпросмотра / preview width


# ---------------------------------------------------------------- ffmpeg
def _ffmpeg():
    try:
        import imageio_ffmpeg
        p = imageio_ffmpeg.get_ffmpeg_exe()
        if p and os.path.isfile(p):
            return p
    except Exception:
        pass
    import shutil
    return shutil.which("ffmpeg")


def _err(ru, en):
    return RuntimeError(f"[Neron Video Editor] {ru} / {en}")


def _write_wav(path, audio):
    import wave
    x = audio["waveform"][0].detach().cpu().numpy() if hasattr(audio["waveform"], "detach") else np.asarray(audio["waveform"])[0]
    x = np.clip(x, -1.0, 1.0)
    if x.shape[0] == 1:
        x = np.repeat(x, 2, axis=0)
    pcm = (x[:2].T * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(int(audio["sample_rate"]))
        w.writeframes(pcm.tobytes())


def encode(frames, fps, path, audio=None, max_w=None, crf=20, preset="veryfast"):
    """Кадры [N,H,W,3] (+звук) → mp4. max_w — уменьшить для предпросмотра."""
    exe = _ffmpeg()
    if not exe:
        raise _err("не найден ffmpeg — поставьте imageio-ffmpeg (pip install imageio-ffmpeg)",
                   "ffmpeg not found — install imageio-ffmpeg")
    n, h, w = int(frames.shape[0]), int(frames.shape[1]), int(frames.shape[2])
    vf = "pad=ceil(iw/2)*2:ceil(ih/2)*2"
    if max_w and w > max_w:
        vf = f"scale={max_w}:-2:flags=bilinear"
    with tempfile.TemporaryDirectory(prefix="neron_ve_") as tmp:
        wav = None
        if audio is not None:
            wav = os.path.join(tmp, "a.wav")
            _write_wav(wav, audio)
        cmd = [exe, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
               "-r", f"{fps}", "-i", "-"]
        if wav:
            cmd += ["-i", wav, "-map", "0:v:0", "-map", "1:a:0"]
        cmd += ["-vf", vf, "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p",
                "-movflags", "+faststart"]
        if wav:
            cmd += ["-c:a", "aac", "-b:a", "160k", "-af", "apad", "-shortest"]
        cmd += [path]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            for i in range(0, n, 16):
                chunk = frames[i:i + 16][..., :3]
                chunk = chunk.detach().cpu().numpy() if hasattr(chunk, "detach") else np.asarray(chunk)
                data = (np.clip(chunk, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
                if data.shape[-1] == 1:
                    data = np.repeat(data, 3, axis=-1)
                proc.stdin.write(np.ascontiguousarray(data).tobytes())
            proc.stdin.close()
            err = proc.stderr.read().decode("utf-8", "ignore")
            code = proc.wait()
        finally:
            if proc.poll() is None:
                proc.kill()
    if code != 0 or not os.path.isfile(path):
        raise _err("ffmpeg не смог собрать видео: " + err[-300:], "ffmpeg failed: " + err[-300:])


# ---------------------------------------------------------------- кубики / cubes
def _fps_from_info(info):
    if isinstance(info, dict):
        for k in ("loaded_fps", "source_fps", "fps", "frame_rate"):
            try:
                v = float(info.get(k))
                if v > 0:
                    return v
            except Exception:
                pass
    return None


def _real_fps(path):
    """Настоящая средняя частота по меткам времени файла (кадров / секунд).
    Real average frame rate from the file's timestamps (frames / seconds)."""
    try:
        import av
        with av.open(path) as c:
            s = c.streams.video[0]
            r = s.average_rate
            if r and float(r) > 0:
                return float(r)
            if s.frames and s.duration and s.time_base:
                return s.frames / float(s.duration * s.time_base)
    except Exception:
        pass
    return None


def _check_fps(fps, info, audio, slot):
    """Load Video (VHS) берёт fps из «паспорта» файла (OpenCV). У скачанных и телефонных
    роликов паспорт часто врёт (30 вместо ~28): видео выходит ускоренным. Сверяем с
    настоящими метками времени и при расхождении берём настоящую частоту.
    VHS reads fps from the file header via OpenCV; downloaded/phone clips often lie
    (30 instead of ~28), which speeds the video up. Compare with real timestamps."""
    if not fps or not isinstance(info, dict):
        return fps, None
    path = getattr(audio, "file", None)          # VHS: ленивый звук знает путь / lazy audio knows the path
    try:
        nominal = float(info.get("source_fps") or 0)
    except Exception:
        nominal = 0.0
    if not path or not isinstance(path, str) or not os.path.isfile(path) or nominal <= 0:
        return fps, None
    real = _real_fps(path)
    if not real or abs(real - nominal) / nominal < 0.005:
        return fps, None
    fixed = fps * real / nominal
    note = (f"видео {slot}: в файле написано {nominal:.3f} fps, а по настоящему времени {real:.3f} — "
            f"взято {fixed:.3f}, чтобы не ускорялось / video {slot}: header says {nominal:.3f} fps, "
            f"real timing {real:.3f} — using {fixed:.3f} so it isn't sped up")
    return fixed, note


def _from_video_obj(v):
    """VIDEO (ядро ComfyUI, Load Video) → (кадры, звук, fps)."""
    get = getattr(v, "get_components", None)
    if not callable(get):
        return None
    c = get()
    fps = getattr(c, "frame_rate", None)
    try:
        fps = float(fps)
    except Exception:
        fps = None
    return c.images, getattr(c, "audio", None), fps


class NeronVEVideos:
    @classmethod
    def INPUT_TYPES(cls):
        opt = {}
        for i in range(1, MAX_VIDEOS + 1):
            lead = "ведущее, его меняем" if i == 1 else "врезка"
            lead_en = "lead, the one we edit" if i == 1 else "insert"
            opt[f"video_{i}"] = ("IMAGE,VIDEO", {"tooltip": f"Видео {i} ({lead}): IMAGE от Load Video / Video {i} ({lead_en}): IMAGE from Load Video"})
            opt[f"audio_{i}"] = ("AUDIO", {"tooltip": f"Звук видео {i} (подключится сам) / Audio of video {i} (auto-wired)"})
            opt[f"info_{i}"] = ("VHS_VIDEOINFO", {"tooltip": f"video_info видео {i} — для точного fps (подключится сам) / for the exact fps (auto-wired)"})
        return {"required": {}, "optional": opt}

    RETURN_TYPES = ("NERON_VE_VIDEOS",)
    RETURN_NAMES = ("videos",)
    OUTPUT_TOOLTIPS = ("Видео для Монтажного пульта / Videos for the Edit Pult",)
    FUNCTION = "pack"
    CATEGORY = "Neron/Video Editor"
    DESCRIPTION = ("До трёх видео одной нодой. Видео 1 — ведущее (его меняем), 2 и 3 — врезки. "
                   "/ Up to three videos in one node. Video 1 is the lead (edited), 2 and 3 are inserts.")

    def pack(self, **kw):
        out = {}
        for i in range(1, MAX_VIDEOS + 1):
            v = kw.get(f"video_{i}")
            if v is None:
                continue
            audio, fps = kw.get(f"audio_{i}"), _fps_from_info(kw.get(f"info_{i}"))
            fps, note = _check_fps(fps, kw.get(f"info_{i}"), audio, i)
            if not torch.is_tensor(v):
                r = _from_video_obj(v)
                if r is None:
                    raise _err(f"видео {i}: непонятный вход, подключите IMAGE от Load Video",
                               f"video {i}: unknown input, connect IMAGE from Load Video")
                v, a2, f2 = r
                audio = audio if audio is not None else a2
                fps = fps or f2
            if v.ndim != 4 or v.shape[0] < 1:
                raise _err(f"видео {i}: нет кадров", f"video {i}: no frames")
            out[i] = {"frames": v, "audio": audio, "fps": fps, "fps_known": fps is not None, "note": note}
        return ({"neron": "ve_videos", "videos": out},)


class NeronVEImages:
    @classmethod
    def INPUT_TYPES(cls):
        opt = {f"image_{i}": ("IMAGE", {"tooltip": f"Картинка {i}: рисунок, кадр, образец (Load Image) / Picture {i}: drawing, frame, sample (Load Image)"})
               for i in range(1, MAX_IMAGES + 1)}
        return {"required": {}, "optional": opt}

    RETURN_TYPES = ("NERON_VE_IMAGES",)
    RETURN_NAMES = ("images",)
    OUTPUT_TOOLTIPS = ("Картинки для Монтажного пульта / Pictures for the Edit Pult",)
    FUNCTION = "pack"
    CATEGORY = "Neron/Video Editor"
    DESCRIPTION = "До четырёх картинок одной нодой. / Up to four pictures in one node."

    def pack(self, **kw):
        out = {}
        for i in range(1, MAX_IMAGES + 1):
            im = kw.get(f"image_{i}")
            if im is not None and torch.is_tensor(im) and im.ndim == 4 and im.shape[0] > 0:
                out[i] = im[0]
        return ({"neron": "ve_images", "images": out},)



# ---------------------------------------------------------------- ✨ AI-движок / AI engine
NOT_FOUND = "__not_found__"


def _files(kind):
    try:
        import folder_paths
        f = list(folder_paths.get_filename_list(kind))
    except Exception:
        f = []
    return f or [NOT_FOUND]


def _pick(files, wanted):
    if wanted in files:
        return wanted
    for f in files:
        if f.replace("\\", "/").split("/")[-1] == wanted:
            return f
    return files[0]


class NeronVEAI:
    @classmethod
    def INPUT_TYPES(cls):
        from . import ve_ai
        unets, clips, vaes, loras = _files("diffusion_models"), _files("text_encoders"), _files("vae"), _files("loras")
        return {"required": {
            "mode": (ve_ai.MODES, {"default": ve_ai.MODES[0], "tooltip":
                     "⚡ Турбо — быстро (12 шагов, турбо-LoRA), для проб и черновиков. Качество — 40 шагов, примерно "
                     "в 3 раза дольше, чище деталь.\n\nEN: Turbo — fast (12 steps, turbo LoRA) for tries and drafts. "
                     "Quality — 40 steps, about 3× slower, cleaner detail."}),
            "size": (list(ve_ai.SIZES), {"default": list(ve_ai.SIZES)[0], "tooltip":
                     "Размер AI-куска (короткая сторона). Форма — как у видео 1. Меньше — быстрее; в пульте кусок всё "
                     "равно растянется до размера видео 1.\n\nEN: AI piece size (short side), same shape as video 1. "
                     "Smaller is faster; the pult scales it to video 1 anyway."}),
            "seed": ("INT", {"default": 1, "min": 0, "max": 0xFFFFFFFF, "tooltip":
                     "Другое число — другой вариант того же перехода. / Another number — another take."}),
            "expert": ("BOOLEAN", {"default": False, "label_on": "⚙ эксперт / expert", "label_off": "⚙ эксперт / expert",
                       "tooltip": "Показать выбор моделей. / Show model files."}),
            "unet_model": (unets, {"default": _pick(unets, ve_ai.UNET_NAME), "tooltip":
                           "Модель MiniMax H3 fl2va (та же, что в H3 Engine). / The MiniMax H3 fl2va model."}),
            "clip_model": (clips, {"default": _pick(clips, ve_ai.CLIP_NAME)}),
            "vae_video_model": (vaes, {"default": _pick(vaes, ve_ai.VAE_VIDEO_NAME)}),
            "vae_audio_model": (vaes, {"default": _pick(vaes, ve_ai.VAE_AUDIO_NAME)}),
            "turbo_lora_model": (loras, {"default": _pick(loras, ve_ai.TURBO_LORA_NAME)}),
        }}

    RETURN_TYPES = ("NERON_VE_AI",)
    RETURN_NAMES = ("ai",)
    OUTPUT_TOOLTIPS = ("В пульт, вход ai / Into the pult's ai input",)
    FUNCTION = "pack"
    CATEGORY = "Neron/Video Editor"
    DESCRIPTION = ("Настройки AI-кусков пульта (MiniMax H3). Генерирует сам пульт — только те ✨ AI-события, что "
                   "изменились. / Settings for the pult's AI pieces (MiniMax H3); the pult generates only changed events.")

    def pack(self, mode, size, seed, expert=False, unet_model=None, clip_model=None, vae_video_model=None,
             vae_audio_model=None, turbo_lora_model=None):
        from . import ve_ai
        need = {"unet": (unet_model, "diffusion_models"), "clip": (clip_model, "text_encoders"),
                "vae_video": (vae_video_model, "vae"), "vae_audio": (vae_audio_model, "vae")}
        if mode == ve_ai.MODES[0]:
            need["turbo_lora"] = (turbo_lora_model, "loras")
        models = {}
        for k, (v, kind) in need.items():
            if not v or v == NOT_FOUND:
                raise _err(f"не найдена модель ({k}) в папке models/{kind}", f"model not found ({k}) in models/{kind}")
            models[k] = v
        models.setdefault("turbo_lora", turbo_lora_model)
        return ({"neron": "ve_ai", "mode": mode, "size": size, "seed": int(seed), "models": models},)

# ---------------------------------------------------------------- предпросмотр / preview proxies
_PROXY = {}


def _key(t, extra=""):
    try:
        flat = t.reshape(-1)
        idx = torch.linspace(0, flat.numel() - 1, steps=min(257, flat.numel())).long()
        sample = flat[idx].float().cpu().numpy().tobytes()
    except Exception:
        sample = b""
    h = hashlib.sha1(sample + str(tuple(t.shape)).encode() + str(extra).encode()).hexdigest()[:16]
    return h


def _temp_dir():
    import folder_paths
    d = os.path.join(folder_paths.get_temp_directory(), "neron_ve")
    os.makedirs(d, exist_ok=True)
    return d


def _ref(name):
    return {"filename": name, "subfolder": "neron_ve", "type": "temp"}


def _proxy_video(frames, fps, audio):
    k = "v_" + _key(frames, f"{fps}|{audio is not None}")
    name = k + ".mp4"
    path = os.path.join(_temp_dir(), name)
    if not os.path.isfile(path):
        encode(frames, fps, path, audio=audio, max_w=PROXY_W, crf=26)
    return _ref(name)


def _proxy_image(img):
    k = "i_" + _key(img)
    name = k + ".png"
    path = os.path.join(_temp_dir(), name)
    if not os.path.isfile(path):
        from PIL import Image
        a = (np.clip(img[..., :3].detach().cpu().numpy(), 0, 1) * 255 + 0.5).astype(np.uint8)
        if a.shape[-1] == 1:
            a = np.repeat(a, 3, axis=-1)
        im = Image.fromarray(a)
        if im.width > PROXY_W * 1.5:
            im = im.resize((int(PROXY_W * 1.5), max(1, round(im.height * PROXY_W * 1.5 / im.width))), Image.BILINEAR)
        im.save(path)
    return _ref(name)


def _next_output(prefix="Neron_Edit"):
    import folder_paths
    root = folder_paths.get_output_directory()
    folder = os.path.join(root, "Neron_Videos")
    os.makedirs(folder, exist_ok=True)
    pat = re.compile(r"^" + re.escape(prefix) + r"_(\d+)\.mp4$")
    top = 0
    for n in os.listdir(folder):
        m = pat.match(n)
        if m:
            top = max(top, int(m.group(1)))
    name = f"{prefix}_{top + 1:05d}.mp4"
    return os.path.join(folder, name), name


# ---------------------------------------------------------------- пульт / pult
def _default_state():
    return {"v": 1, "events": [], "audio": "main", "save": True}


class NeronVEPult:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"edit_json": ("STRING", {"default": json.dumps(_default_state())})},
            "optional": {
                "videos": ("NERON_VE_VIDEOS", {"tooltip": "От кубика 🎬 Видео ×3 / From the 🎬 Video ×3 cube"}),
                "images": ("NERON_VE_IMAGES", {"tooltip": "От кубика 🖼 Картинки ×4 / From the 🖼 Pictures ×4 cube"}),
                "audio": ("AUDIO", {"tooltip": "Свой звук: музыка из Audio Studio и т.п. (необязательно) / Your own sound, e.g. from Audio Studio (optional)"}),
                "ai": ("NERON_VE_AI", {"tooltip": "От ноды ✨ AI-движок — для событий ✨ AI / From ✨ AI Engine — for ✨ AI events"}),
            },
        }

    RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "INT")
    RETURN_NAMES = ("images", "audio", "fps", "frame_count")
    OUTPUT_TOOLTIPS = (
        "Готовые кадры — тот же размер и длина, что у видео 1 / Finished frames — same size and length as video 1",
        "Готовый звук / Finished audio",
        "Кадров в секунду (как у видео 1) / Frames per second (same as video 1)",
        "Число кадров / Frame count",
    )
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "Neron/Video Editor"
    DESCRIPTION = ("Монтажный пульт: видео 1 идёт как есть, поверх в нужные секунды проявляются картинки и куски "
                   "видео 2/3. Вне событий — оригинал кадр в кадр. / Edit Pult: video 1 plays as is; pictures and "
                   "pieces of videos 2/3 appear on top at chosen seconds. Outside events — the untouched original.")

    def run(self, edit_json, videos=None, images=None, audio=None, ai=None):
        try:
            raw = json.loads(edit_json or "{}")
        except Exception:
            raise _err("испорчены данные монтажа — нажмите «Новый»", "edit data is broken — press “New”")
        state = core.norm_state(raw)
        vids = (videos or {}).get("videos") or {}
        imgs = (images or {}).get("images") or {}
        if 1 not in vids:
            raise _err("подключите видео 1 (ведущее) к кубику 🎬 Видео ×3",
                       "connect video 1 (the lead) to the 🎬 Video ×3 cube")

        notes = [v["note"] for _, v in sorted(vids.items()) if v.get("note")]
        v1 = vids[1]
        fps1 = state["fps1"] or v1["fps"] or core.DEFAULT_FPS
        if not v1["fps"] and not state["fps1"]:
            notes.append("fps видео 1 неизвестен — взято 24. Подключите video_info или задайте fps в эксперте "
                         "/ video 1 fps unknown — using 24")
        main = core.Source(v1["frames"], fps1)
        others = {i: core.Source(v["frames"], v["fps"] or fps1) for i, v in vids.items() if i != 1}
        device = _device()

        try:
            import comfy.utils
            bar = comfy.utils.ProgressBar(main.n)
            prog = lambda i, n: bar.update_absolute(i, n)
        except Exception:
            prog = None

        ai_src, ai_audio, ai_ui, info = {}, {}, {}, []
        ai_events = [e for e in state["events"] if e["kind"] == "ai"]
        if ai_events:
            if not ai:
                raise _err("есть события ✨ AI — подключите ноду ✨ AI-движок ко входу ai пульта",
                           "there are ✨ AI events — connect the ✨ AI Engine node to the pult's ai input")
            from . import ve_ai
            w1, h1 = int(v1["frames"].shape[2]), int(v1["frames"].shape[1])
            for k, ev in enumerate(ai_events):
                if ev["pic"] and ev["pic"] not in imgs:
                    raise _err(f"✨ AI: картинка {ev['pic']} не подключена к кубику 🖼 Картинки ×4",
                               f"✨ AI: picture {ev['pic']} is not connected to the 🖼 Pictures ×4 cube")
                r = ve_ai.piece(ev, main, imgs, ai, (w1, h1))
                ai_src[ev["id"]] = core.Source(r["frames"], r["fps"])
                if r["audio"] is not None:
                    ai_audio[ev["id"]] = r["audio"]
                info.append(f"✨ AI {k + 1}: " + "; ".join(r["notes"]))
                try:
                    ai_ui[ev["id"]] = _proxy_video(r["frames"], r["fps"], None)
                except Exception:
                    pass

        frames = (core.render(state, main, others, imgs, device, prog, ai=ai_src) if state["events"]
                  else _plain(v1["frames"]))
        duration = main.n / fps1
        has_any_audio = v1["audio"] is not None or audio is not None or any(
            v.get("audio") is not None for v in vids.values())
        out_audio = core.mix_audio(state, duration, v1["audio"], {i: v.get("audio") for i, v in vids.items()}, audio,
                                   ai_audio=ai_audio)
        if not has_any_audio or state["audio"] == "none":
            out_audio["waveform"] = torch.zeros_like(out_audio["waveform"])

        # предпросмотр для пульта / previews for the pult
        ui = {"sources": [], "images": [], "notes": notes, "info": info, "ai": ai_ui}
        for i, v in sorted(vids.items()):
            src = main if i == 1 else others[i]
            try:
                ref = _proxy_video(v["frames"], src.fps, v["audio"])
            except Exception as e:
                ref = None
                notes.append(f"нет предпросмотра видео {i}: {e}")
            ui["sources"].append({"slot": i, "ref": ref, "fps": src.fps, "frames": src.n,
                                  "w": int(v["frames"].shape[2]), "h": int(v["frames"].shape[1]),
                                  "dur": src.n / src.fps, "fps_known": bool(v["fps"])})
        for i, im in sorted(imgs.items()):
            ui["images"].append({"slot": i, "ref": _proxy_image(im), "w": int(im.shape[1]), "h": int(im.shape[0])})
        res_name = "r_" + _key(frames, f"{fps1}|{json.dumps(state, sort_keys=True)}") + ".mp4"
        res_path = os.path.join(_temp_dir(), res_name)
        if not os.path.isfile(res_path):
            encode(frames, fps1, res_path, audio=out_audio if has_any_audio else None, max_w=PROXY_W, crf=24)
        ui["result"] = _ref(res_name)
        if raw.get("save", True):
            path, name = _next_output()
            encode(frames, fps1, path, audio=out_audio if has_any_audio else None, crf=17, preset="medium")
            ui["saved"] = {"filename": name, "subfolder": "Neron_Videos", "type": "output"}

        return {"ui": {"neron_ve": [ui]},
                "result": (frames, out_audio, float(fps1), int(frames.shape[0]))}


def _plain(frames):
    x = frames[..., :3].float()
    if x.shape[-1] == 1:
        x = x.expand(*x.shape[:-1], 3)
    return x.contiguous()


def _device():
    try:
        import comfy.model_management as mm
        d = mm.get_torch_device()
        # кадры небольшие, но видеопамять может быть занята моделью — тогда процессор
        if d.type == "cuda":
            free = mm.get_free_memory(d)
            if free < 1.5 * 1024 ** 3:
                return torch.device("cpu")
        return d
    except Exception:
        return torch.device("cpu")


NODE_CLASS_MAPPINGS = {
    "NeronVEAI": NeronVEAI,
    "NeronVEVideos": NeronVEVideos,
    "NeronVEImages": NeronVEImages,
    "NeronVEPult": NeronVEPult,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronVEAI": "✨ Neron Edit AI / AI-движок",
    "NeronVEVideos": "🎬 Neron Video ×3 / Видео ×3 (Editor)",
    "NeronVEImages": "🖼 Neron Pictures ×4 / Картинки ×4",
    "NeronVEPult": "🎛 Neron Edit Pult / Монтажный пульт",
}
