# -*- coding: utf-8 -*-
"""
Neron DJ Pult / Пульт сведения

RU: Диджейский пульт: две деки (A и B), кроссфейдер, пэды. Треки приходят
    проводами (deck_a, deck_b) от любой ноды со звуком: Load Audio,
    Neron Audio Loader, Drum Machine, Музыка... Играть можно прямо в ноде,
    без Queue. Кнопка ⏺ ЗАПИСЬ пишет всё, что вы слышите (сет), и по Queue
    нода отдаёт эту запись на выход audio. Нет записи — нода сама сводит
    A → B плавным переходом (авто-переход).
EN: A DJ controller: two decks (A and B), a crossfader, pads. Tracks come by
    wire (deck_a, deck_b) from any node with sound: Load Audio, Neron Audio
    Loader, Drum Machine, Music... You play right inside the node, no Queue
    needed. ⏺ REC records everything you hear (your set) and on Queue the node
    outputs that recording. No recording — the node mixes A → B with a smooth
    crossfade (auto transition).
"""

import os
import re
import json
import time
import asyncio
import numpy as np
import soundfile as sf
import torch
import folder_paths
from aiohttp import web
from server import PromptServer

from .drum_machine import SAMPLE_RATE, _num, _resample
from .mixer import audio_to_stereo, load_audio_file, media_path, AUDIO_EXTS

TAG = "[Neron DJ]"
REC_DIR = "Neron_DJ"                 # output/Neron_DJ — записанные сеты
TEMP_DIR = "neron_dj"                # temp/neron_dj — черновики записи и деки для интерфейса
MAX_CHUNK = 16 * 1024 * 1024         # одна порция записи (байт)
MAX_REC_BYTES = 900 * 1024 * 1024    # ~78 минут стерео 48 кГц 16 бит
ID_RE = re.compile(r"^[a-f0-9]{8,40}$")
MAX_XFADE = 60.0


def _default_json():
    return json.dumps({"version": 1, "rec": None, "xfade": 8.0})


def parse_dj(dj_json):
    try:
        raw = json.loads(dj_json) if isinstance(dj_json, str) else dj_json
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    rec = raw.get("rec")
    if not (isinstance(rec, dict) and isinstance(rec.get("name"), str)):
        rec = None
    return {
        "rec": rec,
        "xfade": _num(raw.get("xfade", 8.0), 8.0, 0.0, MAX_XFADE),
    }


def _clean_name(value, fallback):
    clean = re.sub(r"[^\w\-. ]", "_", str(value or "")).strip(" .")
    return clean[:80] or fallback


def _temp_dir():
    base = folder_paths.get_temp_directory() if hasattr(folder_paths, "get_temp_directory") else folder_paths.get_output_directory()
    d = os.path.join(base, TEMP_DIR)
    os.makedirs(d, exist_ok=True)
    return d


# ----------------------------------------------------------------------------
#  Авто-переход: A целиком, в конце плавно перетекает в B
#  Auto transition: A in full, its end blends into B
# ----------------------------------------------------------------------------

def auto_mix(a, b, xfade_sec):
    """a, b: массивы (отсчёты, 2) на 44100 Гц или None."""
    if a is None or len(a) == 0:
        return b
    if b is None or len(b) == 0:
        return a
    n = int(round(xfade_sec * SAMPLE_RATE))
    n = max(0, min(n, len(a) // 2, len(b) // 2))
    total = len(a) + len(b) - n
    mix = np.zeros((total, 2), dtype=np.float32)
    mix[:len(a)] += a
    if n > 0:
        t = np.linspace(0.0, 1.0, n, dtype=np.float32)[:, None]
        # равная мощность: громкость не проваливается посередине перехода
        mix[len(a) - n:len(a)] *= np.cos(t * np.pi / 2)
        mix[len(a) - n:len(a)] += b[:n] * np.sin(t * np.pi / 2)
        mix[len(a):] += b[n:]
    else:
        mix[len(a):] += b
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 0.99:
        mix *= 0.99 / peak
    return mix


def load_recording(rec):
    path = media_path({"name": rec.get("name", ""), "subfolder": rec.get("subfolder", REC_DIR),
                       "type": rec.get("type", "output")}, AUDIO_EXTS)
    if not path:
        return None, None
    return load_audio_file(path), path


# ----------------------------------------------------------------------------
#  Запись сета из браузера: порции сырого звука (16 бит, стерео) -> WAV
#  Set recording from the browser: raw 16-bit stereo parts -> WAV
# ----------------------------------------------------------------------------

routes = PromptServer.instance.routes


def _raw_path(rec_id):
    return os.path.join(_temp_dir(), rec_id + ".raw")


@routes.post("/neron/dj_rec_part")
async def neron_dj_rec_part(request):
    try:
        rec_id = request.query.get("id", "")
        part = int(request.query.get("part", "-1"))
        if not ID_RE.match(rec_id) or part < 0:
            return web.json_response({"ok": False, "error": "bad id"}, status=400)
        data = await request.read()
        if len(data) > MAX_CHUNK or len(data) % 4:
            return web.json_response({"ok": False, "error": "bad chunk"}, status=400)
        path = _raw_path(rec_id)
        if part > 0 and os.path.isfile(path) and os.path.getsize(path) + len(data) > MAX_REC_BYTES:
            return web.json_response({"ok": False, "error": "too long / слишком длинная запись"}, status=413)
        with open(path, "wb" if part == 0 else "ab") as f:
            f.write(data)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


def _finish_recording(rec_id, sr, name):
    raw = _raw_path(rec_id)
    if not os.path.isfile(raw) or os.path.getsize(raw) < 4:
        raise RuntimeError("пустая запись / empty recording")
    pcm = np.memmap(raw, dtype="<i2", mode="r").reshape(-1, 2)
    out_dir = os.path.join(folder_paths.get_output_directory(), REC_DIR)
    os.makedirs(out_dir, exist_ok=True)
    fname = _clean_name(name, "neron_dj_set") + time.strftime("_%Y%m%d_%H%M%S") + ".wav"
    sf.write(os.path.join(out_dir, fname), pcm, int(sr), subtype="PCM_16")
    seconds = len(pcm) / float(sr)
    del pcm
    try:
        os.remove(raw)
    except OSError:
        pass
    return {"name": fname, "subfolder": REC_DIR, "type": "output", "seconds": round(seconds, 2)}


@routes.post("/neron/dj_rec_done")
async def neron_dj_rec_done(request):
    try:
        data = await request.json()
        rec_id = str(data.get("id", ""))
        if not ID_RE.match(rec_id):
            return web.json_response({"ok": False, "error": "bad id"}, status=400)
        sr = int(_num(data.get("sr", 48000), 48000, 8000, 192000))
        loop = asyncio.get_running_loop()
        rec = await loop.run_in_executor(None, _finish_recording, rec_id, sr, data.get("name"))
        return web.json_response({"ok": True, "rec": rec})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ----------------------------------------------------------------------------
#  Нода / Node
# ----------------------------------------------------------------------------

def _save_temp_deck(wave, key):
    name = f"deck_{key}.wav"
    sf.write(os.path.join(_temp_dir(), name), np.clip(wave, -1.0, 1.0), SAMPLE_RATE, subtype="PCM_16")
    return {"filename": name, "subfolder": TEMP_DIR, "type": "temp"}


class NeronDJPult:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "dj_json": ("STRING", {"default": _default_json()}),
                "save_name": ("STRING", {"default": "neron_dj_set"}),
            },
            "optional": {
                "deck_a": ("AUDIO", {"tooltip": "Трек для деки A / Track for deck A"}),
                "deck_b": ("AUDIO", {"tooltip": "Трек для деки B / Track for deck B"}),
                "pad_sounds": ("AUDIO,NERON_SOUNDS", {"tooltip": "Свои звуки для пэдов (Звук ×8 или один звук). Без провода — встроенные / "
                                                                "Your own pad sounds (Sound ×8 or one sound). No wire — built-in sounds"}),
            },
            "hidden": {"unique_id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ("AUDIO", "STRING")
    RETURN_NAMES = ("audio", "saved_path")
    FUNCTION = "generate"
    CATEGORY = "NeronAudio"
    OUTPUT_NODE = True
    DESCRIPTION = ("Диджейский пульт: две деки, кроссфейдер, пэды, запись сета. / "
                   "DJ controller: two decks, crossfader, pads, set recording.")

    def generate(self, dj_json, save_name, deck_a=None, deck_b=None, pad_sounds=None, unique_id=None):
        st = parse_dj(dj_json)
        key = re.sub(r"[^\w]", "_", str(unique_id or "0"))[:40]
        a = audio_to_stereo(deck_a) if deck_a is not None else None
        b = audio_to_stereo(deck_b) if deck_b is not None else None

        # треки для интерфейса: так пульт слышит любой источник после первого Queue
        ui_decks = []
        for name, wave in (("a", a), ("b", b)):
            if wave is not None and len(wave):
                try:
                    f = _save_temp_deck(wave, f"{key}_{name}")
                    f["deck"] = name
                    ui_decks.append(f)
                except Exception as e:
                    print(f"{TAG} deck {name}: temp file not saved / не сохранён: {e}")

        # свои звуки пэдов: один звук или кубик «Звук ×8» (до 8 штук)
        pads = []
        if isinstance(pad_sounds, dict) and pad_sounds.get("neron") == "sounds":
            for snd in (pad_sounds.get("sounds") or [])[:8]:
                try:
                    if snd.get("wave") is not None:
                        pads.append(np.asarray(snd["wave"], dtype=np.float32))
                    else:
                        p = media_path({"name": snd.get("name", ""), "subfolder": snd.get("subfolder", ""),
                                        "type": snd.get("type", "input")}, AUDIO_EXTS)
                        pads.append(load_audio_file(p) if p else None)
                except Exception as e:
                    print(f"{TAG} pad sound skipped / звук пэда пропущен: {e}")
                    pads.append(None)
        elif isinstance(pad_sounds, dict) and "waveform" in pad_sounds:
            pads.append(audio_to_stereo(pad_sounds))
        for k, wave in enumerate(pads):
            if wave is not None and len(wave):
                try:
                    f = _save_temp_deck(wave[:SAMPLE_RATE * 30], f"{key}_pad{k}")
                    f["deck"] = f"pad{k}"
                    ui_decks.append(f)
                except Exception as e:
                    print(f"{TAG} pad {k}: temp file not saved / не сохранён: {e}")

        mix, path = None, ""
        if st["rec"]:
            mix, path = load_recording(st["rec"])
            if mix is None:
                print(f"{TAG} запись не найдена, делаю авто-переход / recording not found, using auto transition: {st['rec'].get('name')}")
        if mix is None:
            mix = auto_mix(a, b, st["xfade"])
            if mix is None or len(mix) == 0:
                raise RuntimeError("[Neron DJ] Нет звука: подключите трек к deck_a или deck_b, или запишите сет кнопкой ⏺ / "
                                   "No sound: wire a track to deck_a or deck_b, or record a set with ⏺")
            out_dir = os.path.join(folder_paths.get_output_directory(), REC_DIR)
            os.makedirs(out_dir, exist_ok=True)
            path = os.path.join(out_dir, _clean_name(save_name, "neron_dj_set") + "_auto.wav")
            sf.write(path, mix, SAMPLE_RATE, subtype="PCM_16")

        waveform = torch.from_numpy(np.ascontiguousarray(mix.T)).float().unsqueeze(0)
        return {"ui": {"neron_dj": ui_decks},
                "result": ({"waveform": waveform, "sample_rate": SAMPLE_RATE}, path)}


NODE_CLASS_MAPPINGS = {"NeronDJPult": NeronDJPult}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronDJPult": "Neron DJ Пульт / DJ Controller 🎧"}
