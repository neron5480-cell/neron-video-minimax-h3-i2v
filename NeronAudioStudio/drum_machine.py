import os
import re
import sys
import json
import subprocess
import numpy as np
import soundfile as sf
import torch
import folder_paths
from server import PromptServer
from aiohttp import web

try:
    import torchaudio
except Exception:  # torchaudio не обязателен
    torchaudio = None


SAMPLE_RATE = 44100
STEPS = 16
MAX_BARS = 8
AUDIO_EXTS = (".wav", ".flac", ".ogg", ".mp3")
NODE_DIR = os.path.dirname(os.path.abspath(__file__))


# ----------------------------------------------------------------------------
#  Вспомогательные функции
# ----------------------------------------------------------------------------

def _default_pattern_json():
    # Дорожки создаёт интерфейс ноды (по умолчанию - по папкам с сэмплами)
    return json.dumps({"version": 4, "bars": 1, "tracks": []}, ensure_ascii=False)


def _num(value, default, lo, hi):
    try:
        value = float(value)
    except Exception:
        value = default
    if value != value:  # NaN
        value = default
    return max(lo, min(hi, value))


def _safe_part(value):
    """Имя папки или файла без путей. Если имя подозрительное - возвращает None."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or value in (".", "..") or "/" in value or "\\" in value or "\0" in value:
        return None
    return value


def _safe_rel(value):
    """Путь к папке внутри кита, например "KICKS" или "Packs/808/Kicks". Выход за пределы кита невозможен."""
    if not isinstance(value, str):
        return None
    parts = [p for p in re.split(r"[\\/]+", value.strip()) if p != ""]
    if not parts or any(p in (".", "..") or "\0" in p for p in parts):
        return None
    return os.path.join(*parts)


def list_folders(kit_dir, max_depth=4, limit=300):
    """Все папки кита: папки первого уровня всегда, вложенные - если в них есть звуки."""
    result = {}

    def walk(path, rel, depth):
        try:
            names = sorted(os.listdir(path), key=str.lower)
        except OSError:
            return
        for n in names:
            sub = os.path.join(path, n)
            if not os.path.isdir(sub) or len(result) >= limit:
                continue
            r = rel + "/" + n if rel else n
            files = list_audio_files(sub)
            if depth == 0 or files:
                result[r] = files
            if depth + 1 < max_depth:
                walk(sub, r, depth + 1)

    walk(kit_dir, "", 0)
    return result


def _clean_folder_name(value):
    """Имя новой папки-дорожки: убираем символы, запрещённые в Windows."""
    if not isinstance(value, str):
        return None
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", value).strip(" .")
    return value or None


def _kit_candidates(kit_name):
    kit_name = (kit_name or "default").strip() or "default"
    # Можно указать полный путь к папке кита прямо в поле kit_name
    if os.path.isabs(kit_name):
        return [kit_name]
    parts = re.split(r"[\\/]+", kit_name)
    if any(p in ("", ".", "..") for p in parts):
        return []
    return [
        os.path.join(folder_paths.get_input_directory(), "Neron_Drums", kit_name),
        os.path.join(NODE_DIR, "Neron_Drums", kit_name),
    ]


def find_kit_dir(kit_name):
    candidates = _kit_candidates(kit_name)
    for path in candidates:
        if os.path.isdir(path):
            return path, candidates
    return None, candidates


def list_audio_files(folder):
    try:
        names = os.listdir(folder)
    except OSError:
        return []
    files = [
        n for n in names
        if n.lower().endswith(AUDIO_EXTS) and os.path.isfile(os.path.join(folder, n))
    ]
    return sorted(files, key=str.lower)


def _raw_pattern(pattern_json):
    try:
        raw = json.loads(pattern_json) if isinstance(pattern_json, str) else pattern_json
    except Exception:
        raw = {}
    return raw if isinstance(raw, dict) else {}


def parse_pattern(pattern_json):
    """Список дорожек. Понимает все форматы: новый (список с папкой, названием и цветом),
    версию 3 (словарь папка -> дорожка) и самый старый (папка -> список шагов)."""
    raw = _raw_pattern(pattern_json)
    src = raw.get("tracks") if isinstance(raw.get("tracks"), (dict, list)) else raw

    items = []
    if isinstance(src, list):
        for t in src:
            if isinstance(t, dict):
                items.append((t.get("folder"), t))
    elif isinstance(src, dict):
        for name, t in src.items():
            if isinstance(t, list):
                t = {"steps": t}
            if isinstance(t, dict):
                items.append((name, t))

    tracks = []
    for folder, t in items:
        steps = t.get("steps")
        if not isinstance(steps, list) or not isinstance(folder, str):
            continue
        sample = t.get("sample")
        tracks.append({
            "folder": folder,
            "steps": [1 if s else 0 for s in steps],
            "vol": _num(t.get("vol", 0.8), 0.8, 0.0, 2.0),
            "pan": _num(t.get("pan", 0.0), 0.0, -1.0, 1.0),
            "sample": sample if isinstance(sample, str) else "",
            "hidden": bool(t.get("hidden", False)),
        })
    return tracks


def parse_bars(pattern_json, tracks):
    """Сколько тактов в бите. Если не указано - по самой длинной дорожке."""
    bars = _raw_pattern(pattern_json).get("bars")
    if isinstance(bars, (int, float)) and bars == bars:
        return int(max(1, min(MAX_BARS, bars)))
    longest = max([len(t["steps"]) for t in tracks] or [STEPS])
    return int(max(1, min(MAX_BARS, -(-longest // STEPS))))


def _read_audio(path):
    try:
        data, sr = sf.read(path, dtype="float32", always_2d=True)
        return data, sr
    except Exception as first_error:
        if torchaudio is not None:
            try:
                wav, sr = torchaudio.load(path)
                return wav.numpy().T.astype(np.float32), sr
            except Exception:
                pass
        print(f"[Neron] Не удалось прочитать {path}: {first_error}")
        return None, None


def _resample(data, sr, target):
    try:
        tensor = torch.from_numpy(np.ascontiguousarray(data.T))
        tensor = torchaudio.functional.resample(tensor, sr, target)
        return np.ascontiguousarray(tensor.numpy().T, dtype=np.float32)
    except Exception:
        n_new = max(1, int(round(len(data) * target / sr)))
        x_old = np.linspace(0.0, 1.0, len(data), endpoint=False)
        x_new = np.linspace(0.0, 1.0, n_new, endpoint=False)
        channels = [np.interp(x_new, x_old, data[:, c]) for c in range(data.shape[1])]
        return np.stack(channels, axis=1).astype(np.float32)


def _load_sample(kit_dir, inst, wanted):
    folder = os.path.join(kit_dir, inst)
    files = list_audio_files(folder)
    if not files:
        return None
    name = wanted if wanted in files else files[0]
    data, sr = _read_audio(os.path.join(folder, name))
    if data is None or len(data) == 0:
        return None
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    else:
        data = data[:, :2]
    if sr != SAMPLE_RATE:
        data = _resample(data, sr, SAMPLE_RATE)
    return np.ascontiguousarray(data, dtype=np.float32)


def render_pattern(kit_name, bpm, pattern_json):
    kit_dir, searched = find_kit_dir(kit_name)
    if kit_dir is None:
        raise RuntimeError(
            "[Neron] Папка кита не найдена. Искал здесь: " + " | ".join(searched)
        )

    tracks = parse_pattern(pattern_json)
    bpm = _num(bpm, 90, 40, 300)
    step_duration = 60.0 / bpm / 4.0

    n_steps = parse_bars(pattern_json, tracks) * STEPS
    total = max(1, int(round(n_steps * step_duration * SAMPLE_RATE)))
    mix = np.zeros((total, 2), dtype=np.float32)

    for track in tracks:
        if track["hidden"] or not any(track["steps"][:n_steps]):
            continue
        inst_name = _safe_rel(track["folder"])
        if inst_name is None:
            continue
        sample = _load_sample(kit_dir, inst_name, track["sample"])
        if sample is None:
            print(f"[Neron] Нет сэмплов для {inst_name} в {kit_dir}")
            continue

        pan = track["pan"]
        gains = np.array(
            [track["vol"] * min(1.0, 1.0 - pan), track["vol"] * min(1.0, 1.0 + pan)],
            dtype=np.float32,
        )
        wave = sample * gains

        for i, on in enumerate(track["steps"][:n_steps]):
            if not on:
                continue
            start = int(round(i * step_duration * SAMPLE_RATE))
            if start >= total:
                continue
            end = start + len(wave)
            if end <= total:
                mix[start:end] += wave
            else:
                first = total - start
                mix[start:total] += wave[:first]
                # хвост звука переходит в начало лупа - получается бесшовный цикл
                rest = wave[first:first + total]
                mix[:len(rest)] += rest

    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= 0.99 / peak
    return mix


def save_wav(mix, save_name):
    loops_dir = os.path.join(folder_paths.get_output_directory(), "Neron_Loops")
    os.makedirs(loops_dir, exist_ok=True)
    clean = re.sub(r"[^\w\-. ]", "_", str(save_name or "")).strip(" .")
    if not clean:
        clean = "neron_beat_01"
    out_path = os.path.join(loops_dir, clean + ".wav")
    sf.write(out_path, mix, SAMPLE_RATE, subtype="PCM_16")
    return out_path


# ----------------------------------------------------------------------------
#  API для интерфейса (работает без нажатия Queue)
# ----------------------------------------------------------------------------

routes = PromptServer.instance.routes


@routes.get("/neron/list_samples")
async def neron_list_samples(request):
    kit_dir, searched = find_kit_dir(request.query.get("kit", "default"))
    if kit_dir is None:
        return web.json_response(
            {"ok": False, "kit_dir": None, "searched": searched, "instruments": {}}
        )
    instruments = list_folders(kit_dir)
    return web.json_response(
        {"ok": True, "kit_dir": kit_dir, "searched": searched, "instruments": instruments}
    )


@routes.get("/neron/get_sample")
async def neron_get_sample(request):
    kit_dir, _ = find_kit_dir(request.query.get("kit", "default"))
    inst = _safe_rel(request.query.get("inst", ""))
    if kit_dir is None or inst is None:
        return web.Response(status=404, text="Kit or instrument not found")

    folder = os.path.join(kit_dir, inst)
    files = list_audio_files(folder)
    if not files:
        return web.Response(status=404, text="No audio files found")

    wanted = _safe_part(request.query.get("file", ""))
    name = wanted if wanted in files else files[0]
    return web.FileResponse(os.path.join(folder, name))


@routes.post("/neron/render")
async def neron_render(request):
    try:
        data = await request.json()
        mix = render_pattern(
            data.get("kit_name", "default"),
            data.get("bpm", 90),
            data.get("pattern_json", "{}"),
        )
        path = save_wav(mix, data.get("save_name", "neron_beat_01"))
        return web.json_response({"ok": True, "path": path})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron/add_instrument")
async def neron_add_instrument(request):
    try:
        data = await request.json()
        name = _clean_folder_name(data.get("name", ""))
        if name is None:
            return web.json_response({"ok": False, "error": "Недопустимое имя папки"}, status=400)
        kit_name = (data.get("kit_name") or "default").strip() or "default"
        kit_dir, candidates = find_kit_dir(kit_name)
        if kit_dir is None:
            if not candidates:
                return web.json_response({"ok": False, "error": "Недопустимое имя кита"}, status=400)
            kit_dir = candidates[0]
        path = os.path.join(kit_dir, name)
        os.makedirs(path, exist_ok=True)
        return web.json_response({"ok": True, "path": path, "folder": name})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


@routes.post("/neron/open_folder")
async def neron_open_folder(request):
    """Открыть папку с сэмплами в проводнике (ComfyUI работает на вашем компьютере)."""
    target = None
    try:
        data = await request.json()
        kit_name = (data.get("kit_name") or "default").strip() or "default"
        kit_dir, candidates = find_kit_dir(kit_name)
        if kit_dir is None:
            if not candidates:
                return web.json_response({"ok": False, "error": "Недопустимое имя кита"}, status=400)
            kit_dir = candidates[0]
            os.makedirs(kit_dir, exist_ok=True)
        target = kit_dir
        rel = _safe_rel(data.get("folder")) if data.get("folder") else None
        if rel:
            sub = os.path.join(kit_dir, rel)
            if os.path.isdir(sub):
                target = sub
        if hasattr(os, "startfile"):
            os.startfile(target)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen(["xdg-open", target])
        return web.json_response({"ok": True, "path": target})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e), "path": target}, status=500)


# ----------------------------------------------------------------------------
#  Нода
# ----------------------------------------------------------------------------

class NeronDrumMachine:
    def __init__(self):
        os.makedirs(os.path.join(folder_paths.get_input_directory(), "Neron_Drums"), exist_ok=True)
        os.makedirs(os.path.join(folder_paths.get_output_directory(), "Neron_Loops"), exist_ok=True)

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "kit_name": ("STRING", {"default": "default"}),
                "bpm": ("INT", {"default": 90, "min": 40, "max": 300}),
                "pattern_json": ("STRING", {"default": _default_pattern_json()}),
                "save_name": ("STRING", {"default": "neron_beat_01"}),
            }
        }

    RETURN_TYPES = ("AUDIO", "STRING", "INT")
    RETURN_NAMES = ("audio", "saved_path", "bpm")
    FUNCTION = "generate"
    CATEGORY = "NeronAudio"

    def generate(self, kit_name, bpm, pattern_json, save_name):
        mix = render_pattern(kit_name, bpm, pattern_json)
        out_path = save_wav(mix, save_name)

        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        audio = {"waveform": waveform, "sample_rate": SAMPLE_RATE}
        return (audio, out_path, int(_num(bpm, 90, 40, 300)))


NODE_CLASS_MAPPINGS = {"NeronDrumMachine": NeronDrumMachine}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronDrumMachine": "Neron Drum Machine"}
