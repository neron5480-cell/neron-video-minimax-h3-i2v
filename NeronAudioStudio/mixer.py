import io
import os
import re
import json
import asyncio
import shutil
import subprocess
import numpy as np
from ._deps import sf
import torch
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, save_wav, render_pattern, _num, _resample
from .piano_roll import render_project
from .fx import parse_fx, apply_fx, fx_defaults

MAX_CHANNELS = 8
MAX_REPEATS = 8
MAX_FIT_SECONDS = 3600.0
VIDEO_EXTS = (".mp4", ".webm", ".mov", ".m4v", ".ogv")
AUDIO_EXTS = (".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".aif", ".aiff")
# audio_3 — провод; audio_3/2 — 2-й звук кубика «Звук ×8», подключённого к audio_3
SLOT_RE = re.compile(r"^audio_(\d+)(?:/(\d+))?$")
VIDEO_SLOT = "video_audio"   # канал со звуком самого видео
PREVIEW_SR = 22050


# ----------------------------------------------------------------------------
#  Микшер. Ноды (драм-машина, пианино, ...) подключаются проводами ко входам
#  audio_1, audio_2, ... Настройки каналов (громкость, баланс, M, S) хранятся
#  в mixer_json. Короткие лупы повторяются, пока не закончится самый длинный.
# ----------------------------------------------------------------------------

def _default_mixer_json():
    return json.dumps({"version": 3, "repeats": 1, "master": 0.9, "bpm": 90, "tracks": []}, ensure_ascii=False)


def parse_mixer(mixer_json):
    try:
        raw = json.loads(mixer_json) if isinstance(mixer_json, str) else mixer_json
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    settings = {}
    raw_tracks = raw.get("tracks")
    for t in raw_tracks if isinstance(raw_tracks, list) else []:
        if not isinstance(t, dict):
            continue
        slot = t.get("slot")
        if not isinstance(slot, str) or not (SLOT_RE.match(slot) or slot == VIDEO_SLOT):
            continue
        settings[slot] = {
            "vol": _num(t.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(t.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(t.get("mute", False)),
            "solo": bool(t.get("solo", False)),
            "fx": parse_fx(t),
            # с какого места трека начинается звук под роликом (секунды)
            "off": _num(t.get("off", 0), 0.0, 0.0, 36000.0),
        }
    def vref(v):
        if isinstance(v, dict) and isinstance(v.get("name"), str):
            return {"name": v["name"], "subfolder": str(v.get("subfolder") or ""), "type": str(v.get("type") or "input")}
        return None
    video = vref(raw.get("video"))
    videos = [x for x in (vref(v) for v in (raw.get("videos") or [])[:3]) if x]
    if not videos and video:
        videos = [video]
    return {
        "video": video,
        "videos": videos,
        "repeats": int(_num(raw.get("repeats", 1), 1, 1, MAX_REPEATS)),
        "master": _num(raw.get("master", 0.9), 0.9, 0.0, 1.5),
        "bpm": int(_num(raw.get("bpm", 90), 90, 40, 300)),
        # если больше 0 - итоговый звук ровно такой длины (под видео)
        "fit_sec": _num(raw.get("fit_sec", 0), 0.0, 0.0, MAX_FIT_SECONDS),
        # мягкое затухание в конце ролика (секунды; только в режиме «по длине видео»)
        "fade": _num(raw.get("fade", 1.5), 1.5, 0.0, 10.0),
        "settings": settings,
    }


def _default_setting():
    return {"vol": 0.8, "pan": 0.0, "mute": False, "solo": False, "fx": fx_defaults()}


def audio_to_stereo(audio):
    """AUDIO из ComfyUI -> массив (отсчёты, 2) с частотой 44100."""
    wf = audio["waveform"]
    arr = wf.detach().cpu().numpy() if hasattr(wf, "detach") else np.asarray(wf)
    arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 3:
        arr = arr[0]
    if arr.ndim == 1:
        arr = arr[None, :]
    data = arr.T  # (отсчёты, каналы)
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    else:
        data = data[:, :2]
    sr = int(audio.get("sample_rate", SAMPLE_RATE))
    if sr != SAMPLE_RATE and len(data):
        data = _resample(data, sr, SAMPLE_RATE)
    return np.ascontiguousarray(data, dtype=np.float32)


def mix_channels(channels, repeats, master, fit_sec=0.0, fade_sec=0.0):
    """channels: список {wave (отсчёты, 2), vol, pan, mute, solo}.
    fit_sec > 0: итоговая длина ровно столько секунд (короткие лупы повторяются, длинные обрезаются)."""
    solo_any = any(c["solo"] for c in channels)
    waves = []
    for c in channels:
        if c["mute"] or (solo_any and not c["solo"]) or c["wave"] is None or len(c["wave"]) == 0:
            continue
        gains = np.array(
            [c["vol"] * min(1.0, 1.0 - c["pan"]), c["vol"] * min(1.0, 1.0 + c["pan"])],
            dtype=np.float32,
        )
        waves.append((c["wave"], gains, c.get("fx"), int(round(float(c.get("off") or 0.0) * SAMPLE_RATE))))

    if not waves:
        raise RuntimeError("[Neron] Микшер: нет ни одного звучащего канала (подключите ноды к входам audio_N или снимите Mute)")

    one_pass = max(len(w[0]) for w in waves)
    total = one_pass * repeats
    if fit_sec and fit_sec > 0:
        total = max(1, int(round(fit_sec * SAMPLE_RATE)))
    mix = np.zeros((total, 2), dtype=np.float32)
    for w, gains, fx, off in waves:
        tiled = w[(np.arange(total) + off) % len(w)]
        # эквалайзер и эхо канала (после повторов — хвост эха переходит в следующий круг)
        tiled = apply_fx(tiled, fx) if fx else tiled
        mix += tiled * gains

    mix *= master
    if fit_sec and fit_sec > 0 and fade_sec and fade_sec > 0:
        n = min(int(round(fade_sec * SAMPLE_RATE)), total // 2)
        if n > 0:
            mix[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)[:, None]
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= 0.99 / peak
    return mix


# ----------------------------------------------------------------------------
#  Звук из видеофайла (чтобы смешивать его с музыкой или отключать)
# ----------------------------------------------------------------------------

def media_path(v, exts):
    """Путь к файлу из input / output / temp. Выход за пределы этих папок запрещён."""
    if not isinstance(v, dict) or not isinstance(v.get("name"), str):
        return None
    kind = v.get("type") or "input"
    if kind == "output":
        base = folder_paths.get_output_directory()
    elif kind == "temp" and hasattr(folder_paths, "get_temp_directory"):
        base = folder_paths.get_temp_directory()
    else:
        base = folder_paths.get_input_directory()
    sub = str(v.get("subfolder") or "").replace("\\", "/")
    parts = [x for x in sub.split("/") if x]
    name = v["name"].replace("\\", "/")
    if ".." in parts or ".." in name.split("/") or os.path.isabs(name) or os.path.isabs(sub) or not name.lower().endswith(exts):
        return None
    full = os.path.realpath(os.path.join(base, *parts, name))
    if not full.startswith(os.path.realpath(base) + os.sep) or not os.path.isfile(full):
        return None
    return full


def video_path(v):
    return media_path(v, VIDEO_EXTS)


def _decode_with_av(path):
    import av
    with av.open(path) as container:
        stream = next((x for x in container.streams if x.type == "audio"), None)
        if stream is None:
            return None
        resampler = av.AudioResampler(format="fltp", layout="stereo", rate=SAMPLE_RATE)
        chunks = []

        def take(frames):
            if frames is None:
                return
            if not isinstance(frames, (list, tuple)):
                frames = [frames]
            for fr in frames:
                arr = fr.to_ndarray()
                if arr.ndim == 2 and arr.shape[0] == 2:
                    chunks.append(arr.T.astype(np.float32))
                elif arr.ndim == 2:
                    chunks.append(arr.reshape(-1, 2).astype(np.float32))

        for frame in container.decode(stream):
            take(resampler.resample(frame))
        take(resampler.resample(None))
    if not chunks:
        return None
    return np.ascontiguousarray(np.concatenate(chunks, axis=0), dtype=np.float32)


def _decode_with_ffmpeg(path):
    exe = shutil.which("ffmpeg")
    if not exe:
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            exe = None
    if not exe:
        raise RuntimeError("не найден ни модуль av, ни ffmpeg - звук из видео достать нельзя")
    probe = subprocess.run([exe, "-v", "error", "-i", path, "-vn", "-f", "f32le", "-ac", "2", "-ar", str(SAMPLE_RATE), "-"],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    data = np.frombuffer(probe.stdout, dtype=np.float32)
    if data.size < 2:
        return None
    return np.ascontiguousarray(data[: (data.size // 2) * 2].reshape(-1, 2))


def decode_video_audio(path):
    """Звук видеофайла как массив (отсчёты, 2) на 44100 Гц или None, если звуковой дорожки нет."""
    try:
        return _decode_with_av(path)
    except ImportError:
        return _decode_with_ffmpeg(path)
    except Exception:
        try:
            return _decode_with_ffmpeg(path)
        except Exception:
            return None


def load_audio_file(path):
    """Любой звуковой файл -> массив (отсчёты, 2) на 44100 Гц."""
    data = None
    try:
        arr, sr = sf.read(path, dtype="float32", always_2d=True)
        if arr.shape[1] == 1:
            arr = np.repeat(arr, 2, axis=1)
        else:
            arr = arr[:, :2]
        if int(sr) != SAMPLE_RATE and len(arr):
            arr = _resample(arr, int(sr), SAMPLE_RATE)
        data = np.ascontiguousarray(arr, dtype=np.float32)
    except Exception:
        data = decode_video_audio(path)
    if data is None or len(data) == 0:
        raise RuntimeError("не удалось прочитать звуковой файл (формат не поддерживается?)")
    return data


def trim_audio(data, start, end):
    a = int(max(0.0, float(start or 0.0)) * SAMPLE_RATE)
    b = int(float(end) * SAMPLE_RATE) if end and float(end) > 0 else len(data)
    b = min(len(data), b)
    if b - a < 64:
        raise RuntimeError("пустой отрезок: проверьте начало и конец")
    return data[a:b]


def render_file(src):
    path = media_path({"name": src.get("name", ""), "subfolder": src.get("subfolder", ""), "type": src.get("kind", "input")}, AUDIO_EXTS)
    if not path:
        raise RuntimeError("звуковой файл не найден: " + str(src.get("name")))
    return trim_audio(load_audio_file(path), src.get("start", 0), src.get("end", 0))


def _ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if not exe:
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            exe = None
    return exe


def video_fps(path):
    try:
        import av
        with av.open(path) as c:
            st = next((x for x in c.streams if x.type == "video"), None)
            if st is not None:
                rate = st.average_rate or st.guessed_rate
                if rate:
                    return float(rate)
    except Exception:
        pass
    exe = _ffmpeg_exe()
    if exe:
        try:
            r = subprocess.run([exe, "-hide_banner", "-i", path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            m = re.search(r"(\d+(?:\.\d+)?)\s*fps", r.stderr.decode("utf-8", "ignore"))
            if m:
                return float(m.group(1))
        except Exception:
            pass
    return 24.0


def mux_video(vpath, wav_path, out_path):
    """Видео + готовый звук -> mp4 (картинка без перекодирования, звук AAC). True, если получилось."""
    exe = _ffmpeg_exe()
    if not exe:
        return False
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    base = [exe, "-y", "-v", "error", "-i", vpath, "-i", wav_path, "-map", "0:v:0", "-map", "1:a:0"]
    tail = ["-af", "apad", "-c:a", "aac", "-b:a", "192k", "-shortest", out_path]
    for vcodec in (["-c:v", "copy"], ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18"]):
        r = subprocess.run(base + vcodec + tail, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if r.returncode == 0 and os.path.isfile(out_path):
            return True
    return False


def save_mix_wav(mix, save_name):
    d = os.path.join(folder_paths.get_output_directory(), "Neron_Mixes")
    os.makedirs(d, exist_ok=True)
    clean = re.sub(r"[^\w\-. ]", "_", str(save_name or "")).strip(" .") or "neron_mix"
    path = os.path.join(d, clean + ".wav")
    sf.write(path, mix, SAMPLE_RATE, subtype="PCM_16")
    return path, clean


def make_video_file(video, wav_path, clean):
    """Склеивает видео с готовым звуком. Возвращает путь к mp4 или None."""
    vp = video_path(video)
    if not vp:
        return None
    out = os.path.join(folder_paths.get_output_directory(), "Neron_Videos", clean + ".mp4")
    return out if mux_video(vp, wav_path, out) else None


def render_source(src):
    """Отрисовка звука драм-машины или пианино по их настройкам (для предпрослушивания)."""
    kind = src.get("type")
    kit = (src.get("kit_name") or "default")
    bpm = src.get("bpm", 90)
    if kind == "drum":
        return render_pattern(kit, bpm, src.get("json", "{}"))
    if kind == "piano":
        return render_project(kit, bpm, src.get("json", "{}"))
    if kind == "file":
        return render_file(src)
    if kind == "sampler":
        from .sampler import render_sampler_spec   # поздний импорт
        return render_sampler_spec(src)
    if kind == "studio":
        from .studio import render_studio_spec   # поздний импорт
        return render_studio_spec(src)
    if kind == "arrange":
        from .arrange import render_arrange_spec   # поздний импорт: arrange сам опирается на mixer
        return render_arrange_spec(src)
    raise RuntimeError("Неизвестный источник: " + str(kind))


# ----------------------------------------------------------------------------
#  API для интерфейса (работает без нажатия Queue)
# ----------------------------------------------------------------------------

routes = PromptServer.instance.routes


def _wav_bytes_sr(mix, sr):
    buf = io.BytesIO()
    sf.write(buf, np.clip(mix, -1.0, 1.0), sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def _wav_bytes(mix):
    return _wav_bytes_sr(mix, SAMPLE_RATE)


@routes.post("/neron/preview_wav")
async def neron_preview_wav(request):
    try:
        src = await request.json()
        loop = asyncio.get_running_loop()
        mix = await loop.run_in_executor(None, render_source, src)
        data = await loop.run_in_executor(None, _wav_bytes, mix)
        return web.Response(body=data, content_type="audio/wav", headers={"Cache-Control": "no-store"})
    except Exception as e:
        return web.Response(status=500, text=str(e))


@routes.get("/neron/video_audio")
async def neron_video_audio(request):
    """Звук видео для предпрослушивания в микшере (WAV, облегчённый)."""
    try:
        v = {"name": request.query.get("filename", ""), "subfolder": request.query.get("subfolder", ""), "type": request.query.get("type", "input")}
        path = video_path(v)
        if not path:
            return web.Response(status=404, text="видеофайл не найден")
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, decode_video_audio, path)
        if data is None or len(data) == 0:
            return web.Response(status=404, text="в видео нет звуковой дорожки")
        light = _resample(data, SAMPLE_RATE, PREVIEW_SR)
        body = await loop.run_in_executor(None, lambda: _wav_bytes_sr(light, PREVIEW_SR))
        return web.Response(body=body, content_type="audio/wav", headers={"Cache-Control": "no-store"})
    except Exception as e:
        return web.Response(status=500, text=str(e))


def _video_channel(video, st):
    """Канал со звуком видео (или None, если видео нет / в нём нет звука)."""
    path = video_path(video)
    if not path:
        return None
    wave = decode_video_audio(path)
    if wave is None or len(wave) == 0:
        return None
    st = st if isinstance(st, dict) else {}
    return {
        "wave": wave,
        "vol": _num(st.get("vol", 0.8), 0.8, 0.0, 1.5),
        "pan": _num(st.get("pan", 0.0), 0.0, -1.0, 1.0),
        "mute": bool(st.get("mute", False)),
        "solo": bool(st.get("solo", False)),
        "fx": st["fx"] if isinstance(st.get("fx"), dict) else parse_fx(st),
    }


def _clip_len(path):
    from .arrange import probe_video          # поздний импорт: arrange сам опирается на mixer
    info = probe_video(path)
    return float(info["duration"]) if info else 0.0


def videos_wave(videos):
    """Звук нескольких роликов подряд (1 -> 2 -> 3). Где у ролика нет звука — тишина его длины."""
    parts = []
    for v in videos:
        path = video_path(v)
        if not path:
            continue
        n = int(round(_clip_len(path) * SAMPLE_RATE))
        w = decode_video_audio(path)
        if n <= 0:
            n = len(w) if w is not None else 0
        piece = np.zeros((n, 2), dtype=np.float32)
        if w is not None and len(w):
            k = min(len(w), len(piece))
            piece[:k] = w[:k]
        parts.append(piece)
    if not parts:
        return None
    return np.ascontiguousarray(np.concatenate(parts, axis=0))


def _videos_channel(videos, st):
    if not videos:
        return None
    wave = decode_video_audio(video_path(videos[0])) if len(videos) == 1 and video_path(videos[0]) else videos_wave(videos)
    if wave is None or len(wave) == 0:
        return None
    st = st if isinstance(st, dict) else {}
    return {
        "wave": wave,
        "vol": _num(st.get("vol", 0.8), 0.8, 0.0, 1.5),
        "pan": _num(st.get("pan", 0.0), 0.0, -1.0, 1.0),
        "mute": bool(st.get("mute", False)),
        "solo": bool(st.get("solo", False)),
        "fx": st["fx"] if isinstance(st.get("fx"), dict) else parse_fx(st),
    }


def videos_length(videos):
    total = 0.0
    for v in videos:
        p = video_path(v)
        if p:
            total += _clip_len(p)
    return total


def make_videos_file(videos, wav_path, clean):
    """1 ролик — как раньше (картинка без перекодирования). 2-3 ролика — подряд, точно по кадрам."""
    videos = [v for v in videos if video_path(v)]
    if not videos:
        return None
    if len(videos) == 1:
        return make_video_file(videos[0], wav_path, clean)
    from .arrange import video_plan, build_video
    field = {"video": {"clips": [{"src": v, "offset": 0.0} for v in videos], "cuts": [], "trans": "cut", "trans_dur": 0.5}}
    off = 0.0
    for c in field["video"]["clips"]:
        c["offset"] = off
        off += _clip_len(video_path(c["src"]))
    plan = video_plan(field)
    out = os.path.join(folder_paths.get_output_directory(), "Neron_Videos", clean + ".mp4")
    try:
        return build_video(plan, wav_path, out)
    except Exception as e:
        print("[Neron] Пульт: не удалось склеить ролики / could not join the clips:", e)
        return None


@routes.post("/neron/videos_audio")
async def neron_videos_audio(request):
    """Звук нескольких роликов подряд — для прослушивания в Пульте."""
    try:
        data = await request.json()
        vids = [v for v in (data.get("videos") or [])[:3] if isinstance(v, dict)]
        loop = asyncio.get_running_loop()
        wave = await loop.run_in_executor(None, videos_wave, vids)
        if wave is None or len(wave) == 0:
            return web.Response(status=404, text="в роликах нет звука / the clips have no sound")
        light = _resample(wave, SAMPLE_RATE, PREVIEW_SR)
        body = await loop.run_in_executor(None, lambda: _wav_bytes_sr(light, PREVIEW_SR))
        return web.Response(body=body, content_type="audio/wav", headers={"Cache-Control": "no-store"})
    except Exception as e:
        return web.Response(status=500, text=str(e))


def _render_from_request(data):
    channels = []
    for c in (data.get("channels") or [])[:MAX_CHANNELS]:
        src = c.get("src")
        if not isinstance(src, dict):
            continue
        channels.append({
            "wave": render_source(src),
            "vol": _num(c.get("vol", 0.8), 0.8, 0.0, 1.5),
            "pan": _num(c.get("pan", 0.0), 0.0, -1.0, 1.0),
            "mute": bool(c.get("mute", False)),
            "solo": bool(c.get("solo", False)),
            "fx": parse_fx(c),
            "off": _num(c.get("off", 0), 0.0, 0.0, 36000.0),
        })
    vids = [v for v in (data.get("videos") or []) if isinstance(v, dict)][:3] or ([data["video"]] if isinstance(data.get("video"), dict) else [])
    vch = _videos_channel(vids, data.get("video_audio"))
    if vch:
        channels.append(vch)
    repeats = int(_num(data.get("repeats", 1), 1, 1, MAX_REPEATS))
    master = _num(data.get("master", 0.9), 0.9, 0.0, 1.5)
    fit_sec = _num(data.get("fit_sec", 0), 0.0, 0.0, MAX_FIT_SECONDS)
    fade = _num(data.get("fade", 0), 0.0, 0.0, 10.0)
    return mix_channels(channels, repeats, master, fit_sec, fade)


@routes.post("/neron/mixer_render")
async def neron_mixer_render(request):
    try:
        data = await request.json()
        loop = asyncio.get_running_loop()
        mix = await loop.run_in_executor(None, _render_from_request, data)
        path, clean = save_mix_wav(mix, data.get("save_name", "neron_mix"))
        resp = {"ok": True, "path": path}
        if data.get("with_video"):
            vids = [v for v in (data.get("videos") or []) if isinstance(v, dict)][:3] or ([data["video"]] if isinstance(data.get("video"), dict) else [])
            vout = await loop.run_in_executor(None, make_videos_file, vids, path, clean)
            if vout:
                resp["video_path"] = vout
            else:
                resp["video_error"] = "не удалось склеить видео (нет видеофайла или не найден ffmpeg)"
        return web.json_response(resp)
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.get("/neron/list_videos")
async def neron_list_videos(request):
    """Видеофайлы из папок input и output ComfyUI - для плеера в микшере."""
    items = []
    for kind, base in (("input", folder_paths.get_input_directory()), ("output", folder_paths.get_output_directory())):
        base_depth = base.rstrip("\\/").count(os.sep)
        for dirpath, dirnames, filenames in os.walk(base):
            if dirpath.rstrip("\\/").count(os.sep) - base_depth >= 3:
                dirnames[:] = []
            for n in filenames:
                if n.lower().endswith(VIDEO_EXTS):
                    full = os.path.join(dirpath, n)
                    try:
                        mtime = os.path.getmtime(full)
                    except OSError:
                        continue
                    sub = os.path.relpath(dirpath, base)
                    sub = "" if sub == "." else sub.replace("\\", "/")
                    items.append((mtime, {"name": n, "subfolder": sub, "type": kind}))
            if len(items) > 600:
                break
    items.sort(key=lambda x: x[0], reverse=True)
    return web.json_response({"ok": True, "videos": [i for _, i in items[:300]]})


# ----------------------------------------------------------------------------
#  Нода
# ----------------------------------------------------------------------------

try:
    from comfy_api.input_impl import VideoFromFile
except Exception:
    try:
        from comfy_api.latest import InputImpl
        VideoFromFile = InputImpl.VideoFromFile
    except Exception:
        VideoFromFile = None
VIDEO_OUT_TYPE = "VIDEO" if VideoFromFile is not None else "STRING"


class NeronMixer:
    @classmethod
    def INPUT_TYPES(s):
        # video: сюда можно подключить любой загрузчик видео - в микшере появится плеер для сверки звука с картинкой
        optional = {"video": ("*",), "bpm": ("INT", {"forceInput": True})}
        # audio_N принимает обычный звук или кубик «Звук ×8» (каждый его звук — свой канал)
        optional.update({f"audio_{i}": ("AUDIO,NERON_SOUNDS",) for i in range(1, MAX_CHANNELS + 1)})
        return {
            "required": {
                "mixer_json": ("STRING", {"default": _default_mixer_json()}),
                "save_name": ("STRING", {"default": "neron_mix"}),
            },
            # видимые входы добавляет интерфейс: подключили один - появился следующий
            "optional": optional,
        }

    # video: готовое видео (картинка из подключённого ролика + свёденный звук); fps: частота кадров ролика
    RETURN_TYPES = ("AUDIO", "STRING", "INT", VIDEO_OUT_TYPE, "FLOAT")
    RETURN_NAMES = ("audio", "saved_path", "bpm", "video", "fps")
    FUNCTION = "generate"
    CATEGORY = "NeronAudio"
    OUTPUT_NODE = True     # Пульт сам сохраняет звук и клип: Queue работает и без нод после него

    def generate(self, mixer_json, save_name, **audios):
        proj = parse_mixer(mixer_json)
        channels = []
        for slot in sorted(audios, key=lambda k: int(SLOT_RE.match(k).group(1)) if SLOT_RE.match(k) else 0):
            if not SLOT_RE.match(slot) or audios[slot] is None:
                continue
            val = audios[slot]
            if isinstance(val, dict) and val.get("neron") == "sounds":
                # кубик «Звук ×8»: каждый звук — отдельный канал audio_N/1, audio_N/2, ...
                for k, snd in enumerate(val.get("sounds") or []):
                    st = proj["settings"].get(f"{slot}/{k + 1}", _default_setting())
                    # готовый звук (результат Сэмплера) или файл из «Звук ×8»
                    wave = np.asarray(snd["wave"], dtype=np.float32) if snd.get("wave") is not None else \
                        render_file({"name": snd["name"], "subfolder": snd.get("subfolder", ""), "kind": snd.get("type", "input"),
                                     "start": snd.get("start", 0), "end": snd.get("end", 0)})
                    if snd.get("wave") is not None and len(val.get("sounds") or []) == 1:
                        st = proj["settings"].get(slot, st)      # канал Сэмплера в Пульте — audio_N
                    channels.append({"wave": wave,
                                     "vol": st["vol"], "pan": st["pan"], "mute": st["mute"], "solo": st["solo"], "fx": st.get("fx"), "off": st.get("off", 0.0)})
                continue
            st = proj["settings"].get(slot, _default_setting())
            channels.append({
                "wave": audio_to_stereo(val),
                "vol": st["vol"], "pan": st["pan"], "mute": st["mute"], "solo": st["solo"], "fx": st.get("fx"), "off": st.get("off", 0.0),
            })
        # видео: кубик «Видео ×3» по проводу, иначе то, что выбрано в Пульте
        vin = audios.get("video")
        videos = vin["clips"] if isinstance(vin, dict) and vin.get("neron") == "videos" else proj["videos"]
        vst = proj["settings"].get(VIDEO_SLOT, _default_setting())
        # 🔇 в видео-сэмплере: звука роликов в миксе нет
        vmute = isinstance(vin, dict) and bool(vin.get("mute"))
        vch = None if vmute else _videos_channel(videos, vst)
        if vch:
            channels.append(vch)
        # только видео (звук роликов выключен, музыки нет) — тишина длиной в видео, а не ошибка
        if videos and not any(not c["mute"] for c in channels):
            vlen = videos_length(videos)
            if vlen > 0:
                channels.append({"wave": np.zeros((max(1, int(round(vlen * SAMPLE_RATE))), 2), dtype=np.float32),
                                 "vol": 1.0, "pan": 0.0, "mute": False, "solo": False, "fx": None})
        if videos and proj["fit_sec"] > 0:
            proj["fit_sec"] = videos_length(videos) or proj["fit_sec"]
        mix = mix_channels(channels, proj["repeats"], proj["master"], proj["fit_sec"], proj["fade"])
        out_path, clean = save_mix_wav(mix, save_name)
        bpm_in = audios.get("bpm")
        out_bpm = int(_num(bpm_in, proj["bpm"], 40, 300)) if bpm_in is not None else proj["bpm"]
        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        vp = video_path(videos[0]) if videos else None
        fps = video_fps(vp) if vp else 24.0
        video_out = None
        if vp:
            vout = make_videos_file(videos, out_path, clean)
            if vout:
                video_out = VideoFromFile(vout) if VideoFromFile is not None else vout
            else:
                print("[Neron] Микшер: не удалось склеить видео (нет ffmpeg?) - отдаю исходный ролик без нового звука")
                video_out = VideoFromFile(vp) if VideoFromFile is not None else vp
        elif VIDEO_OUT_TYPE == "STRING":
            video_out = ""
        return ({"waveform": waveform, "sample_rate": SAMPLE_RATE}, out_path, out_bpm, video_out, fps)


NODE_CLASS_MAPPINGS = {"NeronMixer": NeronMixer}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronMixer": "Neron Mixer"}
