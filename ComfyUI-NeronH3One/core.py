# -*- coding: utf-8 -*-
"""Ядро 🎬 Neron H3 One: общее для всех режимов (и потом — для Story).

Здесь только проверенное в наших движках:
  • вызов родных нод ComfyUI по имени (Story / Engine);
  • память по этапам: что не нужно этапу — выгружено (Engine);
  • раскодировка целым кадром, при нехватке памяти — плитки всё мельче (Engine);
  • кэш текстового энкодера между прогонами (H3 Studio) — один на весь пакет;
  • обрезка картинки под формат кадра, чтобы ключевой кадр не растягивался (H3 Studio);
  • защита от «двоения»: LoRA на сжатой (int8/fp8) модели ComfyUI пересжимает со случайным
    округлением (comfy/ops.py → set_weight → requantize_from_float) — тонкая турбо-LoRA тонет в шуме.
    Если рядом лежит та же модель в bf16 — берём её.
"""
import gc
import logging
import re
import time

import torch

log = logging.getLogger("Neron.H3.One")
TAG = "[H3 One]"
EVENT = "neron_h3one.progress"
CLIP_TYPE = "minimax"


class FriendlyError(Exception):
    """Понятная ошибка: что случилось и что сделать — на двух языках."""


# ---------------- связь с интерфейсом ----------------

def send(stage, i=0, total=0):
    """Этап и прогресс — на часы ноды."""
    try:
        from server import PromptServer
        PromptServer.instance.send_sync(EVENT, {"stage": stage, "i": int(i), "total": int(total)})
    except Exception:
        pass


# ---------------- память ----------------

def free(reason=""):
    """Всё из видеопамяти — в оперативку, почистить. Объекты, на которые есть ссылки, с диска заново не читаются."""
    if reason:
        log.info("%s Память: %s", TAG, reason)
    try:
        import comfy.model_management as mm
        mm.unload_all_models()
        mm.soft_empty_cache()
    except Exception as e:
        log.warning("%s выгрузка: %s", TAG, e)
    gc.collect()
    if torch.cuda.is_available():
        try:
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
        except Exception:
            pass


def vram_log(tag):
    if not torch.cuda.is_available():
        return
    try:
        free_b, total_b = torch.cuda.mem_get_info()
        log.info("%s %s | VRAM занято %.1f из %.1f ГБ", TAG, tag, (total_b - free_b) / 2 ** 30, total_b / 2 ** 30)
    except Exception:
        pass


def free_ram_gb():
    try:
        import psutil
        return psutil.virtual_memory().available / 1024 ** 3
    except Exception:
        return None


def is_oom(e):
    try:
        import comfy.model_management as mm
        if mm.is_oom(e):
            return True
    except Exception:
        pass
    return isinstance(e, torch.cuda.OutOfMemoryError) or "out of memory" in str(e).lower()


# ---------------- родные ноды ComfyUI ----------------

def has_node(class_name):
    try:
        import nodes as comfy_nodes
        return class_name in comfy_nodes.NODE_CLASS_MAPPINGS
    except Exception:
        return False


def node(class_name, **kw):
    """Вызов встроенной ноды ComfyUI по имени. Новые ноды (V3) отдают NodeOutput — приводим к кортежу."""
    import nodes as comfy_nodes
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise FriendlyError(f"{TAG} В твоём ComfyUI нет встроенной ноды «{class_name}». Обнови ComfyUI до свежей "
                            f"версии и перезапусти.\n\nEN: Your ComfyUI has no built-in node «{class_name}». "
                            f"Update ComfyUI and restart.")
    r = getattr(cls(), cls.FUNCTION)(**kw)
    if hasattr(r, "args") and not isinstance(r, (tuple, list)):
        r = tuple(r.args)
    elif isinstance(r, dict) and "result" in r:
        r = tuple(r["result"])
    return r


NEEDED_NODES = ["MiniMaxH3ImageToVideo", "MiniMaxH3ReferenceToVideo", "MiniMaxH3AddGuide", "MiniMaxH3SigmaShift",
                "EmptyMiniMaxH3LatentAV", "CreateVideo"]


def check_comfy():
    missing = [n for n in NEEDED_NODES if not has_node(n)]
    if missing:
        raise FriendlyError(f"{TAG} В твоём ComfyUI нет родных нод MiniMax H3: {', '.join(missing)}. "
                            f"Обнови ComfyUI и перезапусти.\n\nEN: Your ComfyUI lacks native MiniMax H3 nodes: "
                            f"{', '.join(missing)}. Update ComfyUI and restart.")


# ---------------- файлы моделей ----------------

def base(name):
    return str(name).replace("\\", "/").split("/")[-1]


def find_file(kind, name):
    """Имя файла в списке ComfyUI (вдруг лежит в подпапке) или None."""
    try:
        import folder_paths
        for f in folder_paths.get_filename_list(kind):
            if base(f) == name:
                return f
    except Exception:
        pass
    return None


_QUANT = re.compile(r"(int8_convrot|int8|fp8_scaled|fp8_e4m3fn|fp8|nvfp4_awq|nvfp4|w6a8|w4a4)", re.I)


def is_quantized(name):
    """Сжатая модель (int8 / fp8 / nvfp4 / w6a8) — по имени файла. bf16/fp16/fp32 — нет."""
    return bool(_QUANT.search(base(name or "")))


def bf16_twin(name):
    """Та же модель без сжатия, если лежит рядом: «…_int8_convrot.safetensors» → «…_bf16.safetensors»."""
    b = base(name or "")
    if not is_quantized(b):
        return None
    cand = {_QUANT.sub("bf16", b, count=1)}
    stem = _QUANT.split(b)[0].rstrip("_-. ")
    if stem:
        cand.add(stem + "_bf16.safetensors")
        cand.add(stem + ".safetensors")
    for c in cand:
        if c != b:
            f = find_file("diffusion_models", c)
            if f:
                return f
    return None


# ---------------- LoRA ----------------

def lora(model, name, strength):
    """LoRA только на модель. Файл не кэшируем: после прогона он не должен висеть в оперативке."""
    import comfy.sd
    import comfy.utils
    import folder_paths
    path = folder_paths.get_full_path_or_raise("loras", name)
    try:
        data, meta = comfy.utils.load_torch_file(path, safe_load=True, return_metadata=True)
    except TypeError:
        data, meta = comfy.utils.load_torch_file(path, safe_load=True), None
    try:
        patched, _ = comfy.sd.load_lora_for_models(model, None, data, strength, 0.0, lora_metadata=meta)
    except TypeError:
        patched, _ = comfy.sd.load_lora_for_models(model, None, data, strength, 0.0)
    del data
    return patched


# ---------------- текстовый энкодер: один кэш на весь пакет ----------------

_CLIP_CACHE = {"key": None, "clip": None}
KEEP_CLIP_AUTO_GB = 25.0          # столько свободной RAM нужно, чтобы «авто» держал энкодер (~14 ГБ) между прогонами


def load_clip(clip_name, keep="auto"):
    """→ (clip, из памяти ли). keep: 'auto' — держать, если хватает RAM; 'always'; 'never'."""
    key = (clip_name, CLIP_TYPE)
    if keep != "never" and _CLIP_CACHE["key"] == key and _CLIP_CACHE["clip"] is not None:
        return _CLIP_CACHE["clip"], True
    _CLIP_CACHE.update(key=None, clip=None)          # старый энкодер не держим, пока грузим новый
    clip = node("CLIPLoader", clip_name=clip_name, type=CLIP_TYPE, device="default")[0]
    hold = keep == "always"
    if keep == "auto":
        ram = free_ram_gb()
        hold = ram is not None and ram >= KEEP_CLIP_AUTO_GB
    if hold:
        _CLIP_CACHE.update(key=key, clip=clip)
    return clip, False


def drop_clip_cache():
    _CLIP_CACHE.update(key=None, clip=None)


# ---------------- картинки ----------------

def crop_to_aspect(img, width, height):
    """Обрезать по центру под формат ролика: ComfyUI растягивает первый кадр под холст один в один,
    и при другом формате лицо «плывёт». Режем лишнее сами — кадр остаётся в пропорциях."""
    if img is None:
        return None
    try:
        _, h, w, _ = img.shape
    except Exception:
        return img
    target, cur = float(width) / float(height), float(w) / float(h)
    if abs(cur - target) < 1e-3:
        return img
    if cur > target:
        nw = max(1, int(round(h * target)))
        x0 = max(0, (w - nw) // 2)
        return img[:, :, x0:x0 + nw, :]
    nh = max(1, int(round(w / target)))
    y0 = max(0, (h - nh) // 2)
    return img[:, y0:y0 + nh, :, :]


# ---------------- сэмплер и раскодировка ----------------

def sample(model, positive, latent, seed, steps, denoise=1.0, sampler="res_multistep", scheduler="simple"):
    smp = node("KSamplerSelect", sampler_name=sampler)[0]
    noise = node("RandomNoise", noise_seed=int(seed))[0]
    sigmas = node("BasicScheduler", model=model, scheduler=scheduler, steps=int(steps), denoise=float(denoise))[0]
    guider = node("BasicGuider", model=model, conditioning=positive)[0]
    return node("SamplerCustomAdvanced", noise=noise, guider=guider, sampler=smp, sigmas=sigmas,
                latent_image=latent)[0]


TILES = [(768, 64), (512, 48), (384, 32), (256, 16), (192, 8)]


def decode_video(out, vae):
    """Целым кадром (декодер видит кадр полностью — качественнее). ComfyUI сам перейдёт на плитки при нехватке
    памяти; не влезло и так — плитки всё мельче с чисткой памяти. Генерацию на раскодировке не теряем."""
    try:
        return node("VAEDecode", samples=out, vae=vae)[0], "целиком / whole frame"
    except Exception as e:
        if not is_oom(e):
            raise
        log.warning("%s раскодировка: не хватило памяти — режу плитками", TAG)
    for tile, t_size in TILES:
        free(f"раскодировка плитками {tile}")
        send(f"Раскодировка плитками {tile} / Tiled decode {tile}")
        try:
            img = node("VAEDecodeTiled", samples=out, vae=vae, tile_size=tile, overlap=tile // 4,
                       temporal_size=t_size, temporal_overlap=min(8, t_size // 2))[0]
            return img, f"плитками {tile} / tiles {tile}"
        except Exception as e:
            if not is_oom(e):
                raise
    raise FriendlyError(f"{TAG} Не хватило видеопамяти на раскодировку даже мелкими плитками. Закрой лишние "
                        f"программы на видеокарте или уменьши длину.\n\nEN: Not enough VRAM to decode even with small "
                        f"tiles. Close other GPU apps or shorten the clip.")


def decode_audio(out, vae_audio_name):
    avae = node("VAELoader", vae_name=vae_audio_name)[0]
    try:
        audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
    except Exception as e:
        if not is_oom(e):
            raise
        free("звук: повтор с чистой памятью")
        audio = node("VAEDecodeAudio", samples=out, vae=avae)[0]
    del avae
    return {"waveform": audio["waveform"].cpu(), "sample_rate": int(audio["sample_rate"])}


# ---------------- замер ----------------

class Clock:
    """Время по этапам — для отчёта «⏱ Замер». Только цифры, ни слова из промпта."""

    def __init__(self):
        self.t0 = self.t = time.time()
        self.rows = []

    def mark(self, label, extra=""):
        now = time.time()
        self.rows.append((label, now - self.t, extra))
        self.t = now

    def table(self):
        total = time.time() - self.t0
        lines = ["⏱ Замер / Timing:"]
        for label, sec, extra in self.rows:
            lines.append(f"  {label}: {sec:.0f} с" + (f" · {extra}" if extra else ""))
        lines.append(f"  Всего / Total: {total:.0f} с ({total / 60:.1f} мин)")
        return lines
