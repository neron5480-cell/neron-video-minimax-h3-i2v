# -*- coding: utf-8 -*-
"""Библиотека soundfile — с запасным путём / soundfile with a fallback.

RU: Раньше без библиотеки soundfile не загружалась вся папка Audio Studio, и все её ноды
    (в том числе Neron Video Combine) становились красными «не найдено». Теперь:
      * soundfile есть — работает она, как раньше;
      * нет — WAV пишется и читается встроенным модулем Python (wave), остальное
        честно сообщает, чего не хватает, а ноды загружаются.
EN: Without soundfile the whole Audio Studio folder used to fail to load. Now WAV files are
    written and read with Python's built-in wave module, and anything else reports clearly.
"""
import io
import logging
import wave

import numpy as np

log = logging.getLogger("Neron.AudioStudio")

MISSING = ("[Neron] Нет библиотеки soundfile — установите её: Manager → Install PIP packages → soundfile "
           "(или pip install soundfile) и перезапустите ComfyUI. / The soundfile library is missing: "
           "pip install soundfile, then restart ComfyUI.")


class _WaveFallback:
    """Тот же вызов, что у soundfile, для того, что нужно студии: write(PCM_16 WAV) и read(WAV)."""

    available = False

    @staticmethod
    def write(file, data, samplerate, subtype="PCM_16", format=None, **_):
        if format not in (None, "WAV", "wav") or subtype not in (None, "PCM_16"):
            raise RuntimeError(MISSING)
        if isinstance(file, (str, bytes)) or hasattr(file, "__fspath__"):
            name = str(file)
            if not name.lower().endswith(".wav") and format is None:
                raise RuntimeError(MISSING)
        arr = np.asarray(data, dtype=np.float32)
        if arr.ndim == 1:
            arr = arr[:, None]
        pcm = (np.clip(arr, -1.0, 1.0) * 32767.0).round().astype("<i2")
        with wave.open(file, "wb") as w:
            w.setnchannels(int(pcm.shape[1]))
            w.setsampwidth(2)
            w.setframerate(int(samplerate))
            w.writeframes(pcm.tobytes())

    @staticmethod
    def read(file, dtype="float32", always_2d=False, **_):
        try:
            w = wave.open(file, "rb")
        except (wave.Error, EOFError) as e:
            raise RuntimeError(MISSING + f" ({e})")
        with w:
            ch, width, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            raw = w.readframes(n)
        if width == 2:
            arr = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
        elif width == 4:
            arr = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
        elif width == 1:
            arr = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
        elif width == 3:
            b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
            v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
            v = np.where(v & 0x800000, v - 0x1000000, v)
            arr = v.astype(np.float32) / 8388608.0
        else:
            raise RuntimeError(MISSING)
        arr = arr.reshape(-1, ch)
        if not always_2d and ch == 1:
            arr = arr[:, 0]
        return arr.astype(dtype), sr


try:
    import soundfile as sf  # noqa: F401
except Exception:  # нет библиотеки или не грузится её DLL
    sf = _WaveFallback()
    log.warning("[Neron] soundfile не найден — WAV через встроенный модуль wave. / soundfile missing — "
                "using Python's wave module for WAV.")
