import torch
import torch.nn.functional as F
import importlib
import sys
import os
import gc
import math

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

# Опциональная очистка моделей после прогона
try:
    import comfy.model_management as mm
    HAS_MM = True
except ImportError:
    HAS_MM = False


_RIFE_CLASS = None
_RIFE_TRIED = False


def _get_rife_class():
    global _RIFE_CLASS, _RIFE_TRIED
    if _RIFE_TRIED:
        return _RIFE_CLASS
    _RIFE_TRIED = True

    try:
        import folder_paths
        cn_dir = os.path.join(os.path.dirname(folder_paths.__file__), "custom_nodes")
        if cn_dir not in sys.path:
            sys.path.insert(0, cn_dir)
    except Exception:
        pass

    for mod_name in [
        "vfi_models.rife",
        "ComfyUI_Frame_Interpolation.vfi_models.rife",
        "custom_nodes.ComfyUI_Frame_Interpolation.vfi_models.rife",
        "custom_nodes.ComfyUI-Frame-Interpolation.vfi_models.rife",
    ]:
        try:
            mod = importlib.import_module(mod_name)
            _RIFE_CLASS = getattr(mod, "RIFE_VFI")
            print(f"[NeronClarity] RIFE engine loaded from '{mod_name}'")
            return _RIFE_CLASS
        except (ImportError, AttributeError):
            continue

    print("[NeronClarity] RIFE not found. Interpolation will fall back to warp.")
    return None


def free_all_memory():
    """Force ComfyUI to unload all models, free VRAM, and run GC."""
    print("[NeronClarity] FREE AFTER RUN: unloading models and clearing caches...")
    try:
        if HAS_MM:
            # Выгружаем ВСЕ модели из RAM и VRAM
            mm.unload_all_models()
            # Очищаем кэш CUDA
            mm.soft_empty_cache()
            print("[NeronClarity]   model_management: models unloaded, cache cleared")
    except Exception as e:
        print(f"[NeronClarity]   model_management failed: {e}")

    # Python garbage collector
    gc.collect()

    # Освобождаем CUDA кэш (явно)
    if torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        except Exception as e:
            print(f"[NeronClarity]   cuda cleanup failed: {e}")

    print("[NeronClarity] FREE AFTER RUN: done")


DEFLICKER_WINDOW = 7
PRESET_MAX_CHUNK = {"8": 24, "12": 48, "16": 96, "16+": 256, "custom": 4096}
MEM_MULTIPLIER = 12
MIN_CHUNK = 8
SAFETY_MARGIN = 1 * 1024 ** 3

BASS_LO, BASS_HI = 20.0, 250.0
MID_LO, MID_HI = 250.0, 4000.0
TREBLE_LO, TREBLE_HI = 4000.0, 20000.0


class NeronVideoClarity:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "MODE / РЕЖИМ": (["Simple", "Expert"], {
                    "default": "Simple",
                    "tooltip": "Simple = основные ползунки. Expert = все настройки."
                }),
                "PRESET / ПРЕСЕТ": ([
                    "✋ Manual / Вручную",
                    "📼 Хроника / Old Footage",
                    "🤖 AI Gen / AI-генерация",
                    "🎬 Мягко / Soft",
                    "🔥 Сильно / Strong",
                    "👤 Портрет / Portrait",
                    "🔊 Звук+ / Audio Boost",
                ], {
                    "default": "✋ Manual / Вручную",
                    "tooltip": "Готовые наборы настроек. Меняешь ползунок — пресет сбрасывается на Manual."
                }),

                "STABILIZE / СТАБИЛИЗАЦИЯ": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Временная стабилизация. Убирает дрожание деталей между кадрами."
                }),
                "MOTION COMP / КОМПЕНСАЦИЯ": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Учитывать движение при стабилизации. ВКЛ = сглаживает подвижные элементы."
                }),
                "DEFLICKER / ДЕФЛИКЕР": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Убирает мерцание яркости между кадрами."
                }),
                "BRIGHTNESS / ЯРКОСТЬ": ("FLOAT", {
                    "default": 1.00, "min": 0.5, "max": 1.5, "step": 0.01,
                    "tooltip": "Общая яркость. 1.0 = без изменений."
                }),
                "SATURATION / НАСЫЩЕННОСТЬ": ("FLOAT", {
                    "default": 1.00, "min": 0.0, "max": 2.0, "step": 0.01,
                    "tooltip": "0 = ч/б, 1 = как есть, 1.3+ = сочно."
                }),
                "SHARPEN / РЕЗКОСТЬ": ("FLOAT", {
                    "default": 0.30, "min": 0.0, "max": 1.0, "step": 0.05,
                    "tooltip": "Усиление краёв. Слишком много = белые ореолы на контурах."
                }),
                "CONTRAST / ОБЪЁМ": ("FLOAT", {
                    "default": 0.20, "min": 0.0, "max": 1.0, "step": 0.05,
                    "tooltip": "Локальный контраст. Даёт объём и плотность."
                }),
                "DETAILS / ДЕТАЛИЗАЦИЯ": ("FLOAT", {
                    "default": 0.30, "min": 0.0, "max": 1.0, "step": 0.05,
                    "tooltip": "Усиление мелких текстур (ресницы, ворс, кожа)."
                }),

                "INTERPOLATE / ИНТЕРПОЛЯЦИЯ": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "RIFE-интерполяция кадров. ВКЛ = больше fps."
                }),
                "ENGINE / ДВИЖОК": (["rife", "warp"], {
                    "default": "rife",
                    "tooltip": "rife = нейросеть, качество. warp = без зависимостей, быстрее."
                }),
                "MULTIPLIER / МНОЖИТЕЛЬ": ("INT", {
                    "default": 2, "min": 2, "max": 4, "step": 2,
                    "tooltip": "Во сколько раз увеличить fps. 2 = x2, 4 = x4."
                }),

                "AUDIO / ЗВУК": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "ВКЛ = обработка звука. ВЫКЛ = звук проходит нетронутым."
                }),
                "VOLUME / ГРОМКОСТЬ": ("FLOAT", {
                    "default": 0.0, "min": -20.0, "max": 20.0, "step": 0.5,
                    "tooltip": "Общая громкость в дБ. +6 ≈ ×2. Лечит тихий MiniMax."
                }),
                "BASS / БАСЫ": ("FLOAT", {
                    "default": 0.0, "min": -12.0, "max": 12.0, "step": 0.5,
                    "tooltip": "Низкие частоты (20-250 Hz)."
                }),
                "MID / СЕРЕДИНА": ("FLOAT", {
                    "default": 0.0, "min": -12.0, "max": 12.0, "step": 0.5,
                    "tooltip": "Средние частоты (250-4000 Hz)."
                }),
                "TREBLE / ВЕРХА": ("FLOAT", {
                    "default": 0.0, "min": -12.0, "max": 12.0, "step": 0.5,
                    "tooltip": "Высокие частоты (4000-20000 Hz)."
                }),
                "BALANCE / БАЛАНС": ("FLOAT", {
                    "default": 0.0, "min": -1.0, "max": 1.0, "step": 0.05,
                    "tooltip": "-1 = всё влево, +1 = всё вправо."
                }),

                "VRAM PRESET / ПАМЯТЬ": (["8", "12", "16", "16+", "custom"], {
                    "default": "16",
                    "tooltip": "Сколько VRAM у видеокарты. Ограничивает размер чанка."
                }),
                "DEVICE / УСТРОЙСТВО": (["auto", "cpu", "gpu"], {
                    "default": "gpu",
                    "tooltip": "Где обрабатывать. GPU быстрее, CPU не жрёт VRAM."
                }),
                "AUTO CHUNK / АВТО-ЧАНК": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Автоматически подбирать размер чанка под свободную VRAM."
                }),
                "CHUNK SIZE / РАЗМЕР": ("INT", {
                    "default": 64, "min": 8, "max": 4096, "step": 8,
                    "tooltip": "Кадров на один проход. Меньше = меньше VRAM, но медленнее."
                }),
                "FLOW SCALE / ТОЧНОСТЬ": ("FLOAT", {
                    "default": 0.5, "min": 0.25, "max": 1.0, "step": 0.25,
                    "tooltip": "Разрешение для расчёта движения. Меньше = быстрее, но грубее."
                }),
                "STAB WINDOW / ОКНО": ("INT", {
                    "default": 5, "min": 3, "max": 15, "step": 2,
                    "tooltip": "Сколько кадров вокруг анализировать. Больше = стабильнее."
                }),
                "STAB STRENGTH / СИЛА": ("FLOAT", {
                    "default": 0.35, "min": 0.0, "max": 1.0, "step": 0.05,
                    "tooltip": "Сила сглаживания. Больше = стабильнее, но может залипать движение."
                }),
                "MOTION THR / ПОРОГ": ("FLOAT", {
                    "default": 0.08, "min": 0.01, "max": 0.30, "step": 0.01,
                    "tooltip": "Порог детекции движения. Меньше = агрессивнее сохраняет движение."
                }),
                "DEFLICK STR / СИЛА ДЕФЛИКЕРА": ("FLOAT", {
                    "default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05,
                    "tooltip": "Сила выравнивания яркости."
                }),
                "RIFE MODEL / МОДЕЛЬ": ("STRING", {
                    "default": "rife49.pth",
                    "tooltip": "Имя файла RIFE-модели."
                }),

                # === НОВОЕ ===
                "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Если ВКЛ — после обработки выгружаются ВСЕ модели из RAM и VRAM. "
                               "Следующий прогон будет дольше (загрузка с диска), но RAM свободна. "
                               "Полезно при серийных прогонах разных видео."
                }),
            },
            "optional": {
                "audio": ("AUDIO",),
            },
        }

    RETURN_TYPES = ("IMAGE", "AUDIO", "IMAGE")
    RETURN_NAMES = ("image", "audio", "last_frame")
    FUNCTION = "process"
    CATEGORY = "Neron/Video"

    def _resolve_device(self, mode, tensor):
        if mode == "cpu":
            return torch.device("cpu")
        if mode == "gpu" and torch.cuda.is_available():
            return torch.device("cuda")
        return tensor.device

    def _vram_free_bytes(self, device):
        if device.type != "cuda":
            return None
        try:
            free, _ = torch.cuda.mem_get_info(device)
            return free
        except Exception:
            return None

    def _resolve_chunk_size(self, vram_preset, auto_chunk, chunk_size, H, W, C, device):
        ceiling = PRESET_MAX_CHUNK.get(vram_preset, 4096)
        effective = min(int(chunk_size), ceiling)
        if effective < int(chunk_size):
            print(f"[NeronClarity] chunk_size capped by preset '{vram_preset}': "
                  f"{chunk_size} -> {effective}")

        if auto_chunk and device.type == "cuda":
            free = self._vram_free_bytes(device)
            if free is not None:
                usable = free - SAFETY_MARGIN
                if usable > 0:
                    per_frame = H * W * C * 4 * MEM_MULTIPLIER
                    max_by_vram = max(MIN_CHUNK, int(usable // per_frame))
                    if max_by_vram < effective:
                        print(f"[NeronClarity] auto-chunk: free VRAM {free / 1024**3:.2f} GB, "
                              f"safe frames {max_by_vram}, "
                              f"chunk_size {effective} -> {max_by_vram}")
                        effective = max_by_vram
                    else:
                        print(f"[NeronClarity] auto-chunk: free VRAM {free / 1024**3:.2f} GB, "
                              f"chunk_size {effective} fits comfortably")
                else:
                    print(f"[NeronClarity] auto-chunk: only {free / 1024**3:.2f} GB free, "
                          f"falling back to MIN_CHUNK={MIN_CHUNK}")
                    effective = MIN_CHUNK

        return max(MIN_CHUNK, effective)

    def process(self, image, **kw):
        stabilize = kw["STABILIZE / СТАБИЛИЗАЦИЯ"]
        motion_compensated = kw["MOTION COMP / КОМПЕНСАЦИЯ"]
        deflicker = kw["DEFLICKER / ДЕФЛИКЕР"]
        brightness = kw["BRIGHTNESS / ЯРКОСТЬ"]
        saturation = kw["SATURATION / НАСЫЩЕННОСТЬ"]
        sharpen = kw["SHARPEN / РЕЗКОСТЬ"]
        local_contrast = kw["CONTRAST / ОБЪЁМ"]
        detail_boost = kw["DETAILS / ДЕТАЛИЗАЦИЯ"]

        interpolate = kw["INTERPOLATE / ИНТЕРПОЛЯЦИЯ"]
        engine = kw["ENGINE / ДВИЖОК"]
        interp_multiplier = kw["MULTIPLIER / МНОЖИТЕЛЬ"]

        audio_eq = kw["AUDIO / ЗВУК"]
        volume_db = kw["VOLUME / ГРОМКОСТЬ"]
        bass_db = kw["BASS / БАСЫ"]
        mid_db = kw["MID / СЕРЕДИНА"]
        treble_db = kw["TREBLE / ВЕРХА"]
        balance = kw["BALANCE / БАЛАНС"]

        vram_preset = kw["VRAM PRESET / ПАМЯТЬ"]
        device = kw["DEVICE / УСТРОЙСТВО"]
        auto_chunk = kw["AUTO CHUNK / АВТО-ЧАНК"]
        chunk_size = kw["CHUNK SIZE / РАЗМЕР"]
        flow_scale = kw["FLOW SCALE / ТОЧНОСТЬ"]
        stabilize_window = kw["STAB WINDOW / ОКНО"]
        stabilize_strength = kw["STAB STRENGTH / СИЛА"]
        motion_threshold = kw["MOTION THR / ПОРОГ"]
        deflicker_strength = kw["DEFLICK STR / СИЛА ДЕФЛИКЕРА"]
        rife_model = kw["RIFE MODEL / МОДЕЛЬ"]
        free_after = kw["FREE AFTER RUN / ОЧИСТКА ПОСЛЕ"]

        audio = kw.get("audio", None)

        orig_device = image.device
        orig_dtype = image.dtype
        work_device = self._resolve_device(device, image)

        N, H, W, C = image.shape
        has_audio = audio is not None
        print(f"[NeronClarity] Input: {N} frames, {W}x{H}, device={work_device}, "
              f"vram={vram_preset}, audio={'yes' if has_audio else 'no'}, "
              f"free_after={free_after}")

        effective_chunk = self._resolve_chunk_size(
            vram_preset, auto_chunk, chunk_size, H, W, C, work_device
        )
        print(f"[NeronClarity] Effective chunk_size: {effective_chunk}")

        if N <= effective_chunk:
            chunk = image.to(work_device, dtype=torch.float32)
            processed = self._process_chunk(
                chunk, stabilize, motion_compensated, flow_scale,
                stabilize_window, stabilize_strength, motion_threshold,
                deflicker, deflicker_strength,
                brightness, saturation, sharpen, local_contrast, detail_boost
            )
        else:
            processed = self._chunked_process(
                image, work_device, effective_chunk,
                stabilize, motion_compensated, flow_scale,
                stabilize_window, stabilize_strength, motion_threshold,
                deflicker, deflicker_strength,
                brightness, saturation, sharpen, local_contrast, detail_boost
            )

        if interpolate:
            print(f"[NeronClarity] Interpolation (engine={engine}, x{interp_multiplier})")
            n_passes = int(math.log2(interp_multiplier))
            for p in range(n_passes):
                processed = self._interpolate_once(processed, engine, rife_model)
                print(f"[NeronClarity]   pass {p+1}/{n_passes}: {processed.shape[0]} frames")

        if has_audio and audio_eq:
            audio = self._process_audio(audio, volume_db, bass_db, mid_db, treble_db, balance)
            print(f"[NeronClarity] Audio EQ: vol={volume_db} bass={bass_db} "
                  f"mid={mid_db} treble={treble_db} bal={balance}")
        elif has_audio:
            print(f"[NeronClarity] Audio passthrough")

        print(f"[NeronClarity] Output: {processed.shape[0]} frames")

        # === ФИНАЛЬНАЯ ОЧИСТКА ===
        result_image = processed.to(orig_device, dtype=orig_dtype)
        
        # Берем последний кадр (сохраняя размерность батча [1, H, W, C])
        last_frame = result_image[-1:]

        if free_after:
            # И аудио тоже на CPU (если тензор)
            if has_audio and isinstance(audio, dict) and "waveform" in audio:
                audio = {
                    "waveform": audio["waveform"].detach().cpu() if torch.is_tensor(audio["waveform"]) else audio["waveform"],
                    "sample_rate": audio["sample_rate"],
                }
            # Чистим всё
            del processed
            free_all_memory()
            return (result_image, audio, last_frame)

        return (result_image, audio, last_frame)

    def _process_audio(self, audio, volume_db, bass_db, mid_db, treble_db, balance):
        try:
            waveform = audio["waveform"].clone().to(torch.float32)
            sample_rate = int(audio["sample_rate"])
        except Exception as e:
            print(f"[NeronClarity]   Audio format not recognized: {e}")
            return audio

        if abs(volume_db) > 1e-3:
            waveform = waveform * (10.0 ** (volume_db / 20.0))

        if waveform.shape[1] == 2 and abs(balance) > 1e-3:
            left_gain = 1.0 - max(0.0, float(balance))
            right_gain = 1.0 - max(0.0, -float(balance))
            waveform[:, 0, :] *= left_gain
            waveform[:, 1, :] *= right_gain

        if any(abs(x) > 1e-3 for x in (bass_db, mid_db, treble_db)):
            try:
                n_samples = waveform.shape[-1]
                spec = torch.fft.rfft(waveform, dim=-1)
                freqs = torch.fft.rfftfreq(n_samples, d=1.0 / sample_rate).to(spec.device)

                gain = torch.ones_like(freqs, dtype=torch.float32)
                if abs(bass_db) > 1e-3:
                    m = (freqs >= BASS_LO) & (freqs < BASS_HI)
                    gain = torch.where(m, gain * (10.0 ** (bass_db / 20.0)), gain)
                if abs(mid_db) > 1e-3:
                    m = (freqs >= MID_LO) & (freqs < MID_HI)
                    gain = torch.where(m, gain * (10.0 ** (mid_db / 20.0)), gain)
                if abs(treble_db) > 1e-3:
                    m = (freqs >= TREBLE_LO) & (freqs < TREBLE_HI)
                    gain = torch.where(m, gain * (10.0 ** (treble_db / 20.0)), gain)

                spec = spec * gain
                waveform = torch.fft.irfft(spec, n=n_samples, dim=-1)
            except Exception as e:
                print(f"[NeronClarity]   Audio EQ failed: {e}")

        waveform = torch.clamp(waveform, -1.0, 1.0)
        return {"waveform": waveform, "sample_rate": sample_rate}

    def _chunked_process(self, image, work_device, chunk_size,
                         stabilize, motion_compensated, flow_scale,
                         stabilize_window, stabilize_strength, motion_threshold,
                         deflicker, deflicker_strength,
                         brightness, saturation, sharpen, local_contrast, detail_boost):
        N, H, W, C = image.shape
        overlap = min(max(stabilize_window, DEFLICKER_WINDOW) + 4, max(4, chunk_size // 2))
        print(f"[NeronClarity]   multi-chunk: overlap={overlap}")

        output_sum = torch.zeros(N, H, W, C, dtype=torch.float32)
        weight_sum = torch.zeros(N, dtype=torch.float32)

        i = 0
        chunk_idx = 0
        total_chunks = (N + chunk_size - 1) // chunk_size

        while i < N:
            end = min(i + chunk_size, N)
            ext_start = max(0, i - overlap)
            ext_end = min(N, end + overlap)

            chunk_idx += 1
            print(f"[NeronClarity]   chunk {chunk_idx}/{total_chunks}: "
                  f"deliver [{i}:{end}], ext [{ext_start}:{ext_end}]")

            chunk = image[ext_start:ext_end].to(work_device, dtype=torch.float32)
            processed = self._process_chunk(
                chunk, stabilize, motion_compensated, flow_scale,
                stabilize_window, stabilize_strength, motion_threshold,
                deflicker, deflicker_strength,
                brightness, saturation, sharpen, local_contrast, detail_boost
            )

            local_n = processed.shape[0]
            w = torch.ones(local_n, dtype=torch.float32)
            if ext_start > 0:
                left_n = min(overlap, local_n)
                w[:left_n] = torch.linspace(0, 1, left_n + 1, dtype=torch.float32)[1:]
            if ext_end < N:
                right_n = min(overlap, local_n)
                w[-right_n:] = torch.linspace(1, 0, right_n + 1, dtype=torch.float32)[:-1]

            processed_cpu = processed.to("cpu", dtype=torch.float32)
            output_sum[ext_start:ext_end] += processed_cpu * w[:, None, None, None]
            weight_sum[ext_start:ext_end] += w

            del chunk, processed, processed_cpu
            gc.collect()
            if work_device.type == "cuda":
                torch.cuda.empty_cache()

            i = end

        return output_sum / weight_sum.clamp(min=1e-6)[:, None, None, None]

    def _process_chunk(self, frames,
                       stabilize, motion_compensated, flow_scale,
                       stabilize_window, stabilize_strength, motion_threshold,
                       deflicker, deflicker_strength,
                       brightness, saturation, sharpen, local_contrast, detail_boost):
        if stabilize and frames.shape[0] >= 3:
            if motion_compensated and HAS_CV2:
                frames = self._mc_stabilize(frames, stabilize_window, stabilize_strength,
                                            motion_threshold, flow_scale)
            else:
                frames = self._temporal_stabilize(frames, stabilize_window,
                                                   stabilize_strength, motion_threshold)

        if deflicker and frames.shape[0] >= 3:
            frames = self._deflicker(frames, deflicker_strength)

        if abs(brightness - 1.0) > 1e-4:
            frames = torch.clamp(frames * brightness, 0.0, 1.0)
        if abs(saturation - 1.0) > 1e-4:
            frames = self._saturate(frames, saturation)
        if local_contrast > 0.0:
            frames = self._local_contrast(frames, local_contrast)
        if sharpen > 0.0:
            frames = self._sharpen(frames, sharpen)
        if detail_boost > 0.0:
            frames = self._detail_boost(frames, detail_boost)

        return frames

    def _interpolate_once(self, frames, engine, rife_model):
        if engine == "rife":
            out = self._interpolate_rife(frames, rife_model)
            if out is not None:
                return out
            print("[NeronClarity]   RIFE unavailable -> warp fallback")
        return self._interpolate_warp(frames)

    def _interpolate_rife(self, frames, rife_model):
        cls = _get_rife_class()
        if cls is None:
            return None
        try:
            node = cls()
            result = node.vfi(ckpt_name=rife_model, frames=frames.detach().cpu(),
                              clear_cache_after_n_frames=10, multiplier=2,
                              fast_mode=True, ensemble=False, scale_factor=1.0)
            return result[0].to(frames.device, dtype=frames.dtype)
        except Exception as e:
            print(f"[NeronClarity]   RIFE error: {e}")
            return None

    def _interpolate_warp(self, frames):
        N, H, W, C = frames.shape
        if N < 2:
            return frames
        frames_np = (frames.detach().cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
        small_w = max(32, int(W * 0.5)); small_h = max(32, int(H * 0.5))
        small_gray = []
        for i in range(N):
            g = cv2.cvtColor(frames_np[i], cv2.COLOR_RGB2GRAY)
            g = cv2.resize(g, (small_w, small_h), interpolation=cv2.INTER_AREA)
            small_gray.append(g)
        grid_x, grid_y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
        scale_x = W / small_w; scale_y = H / small_h
        out = []
        for i in range(N):
            out.append(frames[i])
            if i < N - 1:
                f = cv2.calcOpticalFlowFarneback(small_gray[i], small_gray[i+1], None,
                    pyr_scale=0.5, levels=3, winsize=13, iterations=3,
                    poly_n=5, poly_sigma=1.2, flags=0)
                f_full = cv2.resize(f, (W, H), interpolation=cv2.INTER_LINEAR)
                f_full[..., 0] *= scale_x; f_full[..., 1] *= scale_y
                map_x = (grid_x + f_full[..., 0] * 0.5).astype(np.float32)
                map_y = (grid_y + f_full[..., 1] * 0.5).astype(np.float32)
                mid = cv2.remap(frames_np[i], map_x, map_y,
                    interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                out.append(torch.from_numpy(mid.astype(np.float32) / 255.0).to(frames.device))
        return torch.stack(out, dim=0)

    def _mc_stabilize(self, frames, window, strength, motion_threshold, flow_scale):
        N, H, W, C = frames.shape
        if window % 2 == 0: window += 1
        half = window // 2
        frames_np = (frames.detach().cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
        small_w = max(32, int(W * flow_scale)); small_h = max(32, int(H * flow_scale))
        small_gray = []
        for i in range(N):
            g = cv2.cvtColor(frames_np[i], cv2.COLOR_RGB2GRAY)
            g = cv2.resize(g, (small_w, small_h), interpolation=cv2.INTER_AREA)
            small_gray.append(g)
        forward_flows = []
        for i in range(N - 1):
            f = cv2.calcOpticalFlowFarneback(small_gray[i], small_gray[i+1], None,
                pyr_scale=0.5, levels=3, winsize=13, iterations=3,
                poly_n=5, poly_sigma=1.2, flags=0)
            forward_flows.append(f)
        grid_x, grid_y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))

        def warp_to(idx_from, idx_to):
            total = np.zeros((small_h, small_w, 2), dtype=np.float32)
            step = 1 if idx_to > idx_from else -1
            for k in range(idx_from, idx_to, step):
                if step == 1: total = total + forward_flows[k]
                else: total = total - forward_flows[k - 1]
            scale_x = W / small_w; scale_y = H / small_h
            total_full = cv2.resize(total, (W, H), interpolation=cv2.INTER_LINEAR)
            total_full[..., 0] *= scale_x; total_full[..., 1] *= scale_y
            map_x = (grid_x + total_full[..., 0]).astype(np.float32)
            map_y = (grid_y + total_full[..., 1]).astype(np.float32)
            warped = cv2.remap(frames_np[idx_from], map_x, map_y,
                interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            return torch.from_numpy(warped.astype(np.float32) / 255.0).to(frames.device)

        result = torch.empty_like(frames)
        sigma = motion_threshold
        for i in range(N):
            lo = max(0, i - half); hi = min(N, i + half + 1)
            stack = []
            for j in range(lo, hi):
                if j == i: stack.append(frames[i])
                else: stack.append(warp_to(j, i))
            stack = torch.stack(stack, dim=0)
            median = stack.median(dim=0).values
            del stack
            diff = (frames[i] - median).abs().mean(dim=-1, keepdim=True)
            weight = torch.exp(-(diff ** 2) / (sigma ** 2 + 1e-8))
            blend = strength * weight
            result[i] = frames[i] * (1.0 - blend) + median * blend
        return result

    def _temporal_stabilize(self, frames, window, strength, motion_threshold):
        N, H, W, C = frames.shape
        if window % 2 == 0: window += 1
        half = window // 2
        padded = torch.cat([frames[:1].expand(half, H, W, C), frames,
                            frames[-1:].expand(half, H, W, C)], dim=0)
        result = torch.empty_like(frames)
        sigma = motion_threshold
        for i in range(N):
            wf = padded[i:i + window]
            median = wf.median(dim=0).values
            diff = (frames[i] - median).abs().mean(dim=-1, keepdim=True)
            weight = torch.exp(-(diff ** 2) / (sigma ** 2 + 1e-8))
            blend = strength * weight
            result[i] = frames[i] * (1.0 - blend) + median * blend
        return result

    def _deflicker(self, frames, strength):
        N, H, W, C = frames.shape
        if C >= 3:
            lum = (frames[..., 0] * 0.299 + frames[..., 1] * 0.587 + frames[..., 2] * 0.114)
        else:
            lum = frames[..., 0]
        frame_lum = lum.mean(dim=(1, 2))
        del lum
        win = min(DEFLICKER_WINDOW, N if N % 2 == 1 else N - 1)
        if win < 3: return frames
        half = win // 2
        padded = torch.cat([frame_lum[:1].expand(half), frame_lum,
                            frame_lum[-1:].expand(half)])
        smoothed = torch.empty_like(frame_lum)
        for i in range(N):
            smoothed[i] = padded[i:i + win].median()
        eps = 1e-6
        correction = smoothed / (frame_lum + eps)
        correction = 1.0 + (correction - 1.0) * strength
        correction = torch.clamp(correction, 0.85, 1.15)
        return torch.clamp(frames * correction.view(-1, 1, 1, 1), 0.0, 1.0)

    def _saturate(self, frames, saturation):
        if frames.shape[-1] < 3: return frames
        gray = (frames[..., 0:1] * 0.299 + frames[..., 1:2] * 0.587 + frames[..., 2:3] * 0.114)
        rgb = frames[..., :3]
        out_rgb = torch.clamp(gray + (rgb - gray) * saturation, 0.0, 1.0)
        if frames.shape[-1] > 3:
            return torch.cat([out_rgb, frames[..., 3:]], dim=-1)
        return out_rgb

    def _local_contrast(self, frames, amount):
        N, H, W, C = frames.shape
        x = frames.permute(0, 3, 1, 2)
        small = F.interpolate(x, scale_factor=0.25, mode="bilinear", align_corners=False)
        blurred_small = F.avg_pool2d(small, kernel_size=9, stride=1, padding=4)
        blurred = F.interpolate(blurred_small, size=(H, W), mode="bilinear", align_corners=False)
        out = torch.clamp(x + amount * (x - blurred), 0.0, 1.0)
        return out.permute(0, 2, 3, 1)

    def _detail_boost(self, frames, amount):
        N, H, W, C = frames.shape
        x = frames.permute(0, 3, 1, 2)
        blurred = F.avg_pool2d(x, kernel_size=3, stride=1, padding=1)
        detail = x - blurred
        edge_mag = detail.abs().mean(dim=1, keepdim=True)
        mask = torch.clamp(edge_mag * 8.0, 0.0, 1.0)
        out = torch.clamp(x + amount * detail * mask, 0.0, 1.0)
        return out.permute(0, 2, 3, 1)

    def _sharpen(self, frames, amount):
        N, H, W, C = frames.shape
        x = frames.permute(0, 3, 1, 2)
        blurred = F.avg_pool2d(x, kernel_size=3, stride=1, padding=1)
        sharp = torch.clamp(x + amount * (x - blurred), 0.0, 1.0)
        return sharp.permute(0, 2, 3, 1)


NODE_CLASS_MAPPINGS = {
    "NeronVideoClarity": NeronVideoClarity,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeronVideoClarity": "🎬 Neron Video Clarity",
}