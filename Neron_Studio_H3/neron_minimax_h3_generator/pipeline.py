# -*- coding: utf-8 -*-
"""
Сборка пайплайна генерации MiniMax H3.
"""

import logging

import torch

import comfy.model_management

from .frames import DEFAULT_FPS
from .lora_cache import NO_LORA, get_lora_cache
from .memory import free_between_stages, log_vram, vram_free_gb


log = logging.getLogger("Neron.H3.Pipeline")


# ================================================================
# Определение OOM (Out of Memory).
# ================================================================
OOM_EXC = getattr(
    comfy.model_management,
    "OOM_EXCEPTION",
    torch.cuda.OutOfMemoryError,
)


def _is_oom(error):
    return isinstance(error, (OOM_EXC, torch.cuda.OutOfMemoryError))


# ================================================================
# ДЕФОЛТНЫЕ МОДЕЛИ.
# ================================================================
UNET_NAME = "minimax_h3_fl2va_pruned_int8_convrot.safetensors"
CLIP_NAME = "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"
CLIP_TYPE = "minimax"

VAE_VIDEO_NAME = "minimax_h3_video_vae_fp16.safetensors"
VAE_AUDIO_NAME = "minimax_h3_audio_vae_fp32.safetensors"

TURBO_LORA_NAME = (
    "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"
)


def _get_node_class(class_name):
    try:
        import nodes as comfy_nodes
    except ImportError:
        raise RuntimeError(
            "[H3 Pipeline] Не удалось импортировать модуль nodes."
        )

    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_name)
    if cls is None:
        raise RuntimeError(
            "[H3 Pipeline] Не найдена нода ComfyUI: "
            "'" + class_name + "'."
        )
    return cls


def _call_node(class_name, **kwargs):
    cls = _get_node_class(class_name)
    instance = cls()
    func_name = getattr(cls, "FUNCTION", None)
    if func_name is None:
        raise RuntimeError(
            "[H3 Pipeline] У ноды '" + class_name + "' "
            "нет атрибута FUNCTION."
        )
    func = getattr(instance, func_name)
    return func(**kwargs)


# ================================================================
# ЗАГРУЗЧИКИ
# ================================================================
def _load_unet(name):
    log.info("[H3 Pipeline] Загружаю UNET: %s", name)
    result = _call_node(
        "UNETLoader",
        unet_name=name,
        weight_dtype="default",
    )
    return result[0]


def _load_clip(name, clip_type):
    log.info("[H3 Pipeline] Загружаю CLIP: %s", name)
    result = _call_node(
        "CLIPLoader",
        clip_name=name,
        type=clip_type,
        device="default",
    )
    return result[0]


def _load_vae(name):
    log.info("[H3 Pipeline] Загружаю VAE: %s", name)
    result = _call_node(
        "VAELoader",
        vae_name=name,
    )
    return result[0]


# ================================================================
# LoRA
# ================================================================
def _apply_lora(model, lora_name, strength):
    cache = get_lora_cache()
    data, meta = cache.load(lora_name)
    return cache.apply(model, data, meta, float(strength))


# ================================================================
# Sigma Shift
# ================================================================
def _sigma_shift(model, shift_video, shift_audio):
    log.info(
        "[H3 Pipeline] Sigma Shift: video=%s audio=%s",
        shift_video, shift_audio,
    )
    result = _call_node(
        "MiniMaxH3SigmaShift",
        model=model,
        shift_video=int(shift_video),
        shift_audio=int(shift_audio),
    )
    return result[0]


# ================================================================
# Attention backend
# ================================================================
def _attention_backend(model):
    result = _call_node(
        "ModelAttentionBackend",
        model=model,
        attention="comfy kitchen attention",
    )
    return result[0]


# ================================================================
# Кодирование промпта + референсов
# ================================================================
def _reference_to_video(
    clip, vae, ref_images, prompt, width, height, length,
    ref_video=None, ref_video_audio=None, ref_audio=None,
):
    log.info("[H3 Pipeline] Кодирую промпт и референсы")

    params = {
        "clip": clip,
        "vae": vae,
        "prompt": prompt,
        "width": int(width),
        "height": int(height),
        "length": int(length),
        "ref_image_size": "match",
    }

    ref_images_dict = {}
    for index, image in enumerate(ref_images):
        if image is not None:
            ref_images_dict["ref_image_" + str(index)] = image
    if ref_images_dict:
        params["ref_images"] = ref_images_dict

    if ref_video is not None:
        params["ref_videos"] = {"ref_video_0": ref_video}
    if ref_video_audio is not None:
        params["ref_video_audios"] = {
            "ref_video_audio_0": ref_video_audio,
        }
    if ref_audio is not None:
        params["ref_audios"] = {"ref_audio_0": ref_audio}

    log.info(
        "[H3 Pipeline] ref_images слоты: %s",
        list(ref_images_dict.keys()),
    )

    result = _call_node("MiniMaxH3ReferenceToVideo", **params)
    return result[0], result[1]


# ================================================================
# Сэмплинг
# ================================================================
def _sampler_select(name="res_multistep"):
    result = _call_node("KSamplerSelect", sampler_name=name)
    return result[0]


def _random_noise(seed):
    result = _call_node("RandomNoise", noise_seed=int(seed))
    return result[0]


def _basic_scheduler(model, steps):
    result = _call_node(
        "BasicScheduler",
        model=model,
        scheduler="simple",
        steps=int(steps),
        denoise=1.0,
    )
    return result[0]


def _basic_guider(model, positive):
    result = _call_node(
        "BasicGuider",
        model=model,
        conditioning=positive,
    )
    return result[0]


def _sampler_advanced(noise, guider, sampler, sigmas, latent):
    result = _call_node(
        "SamplerCustomAdvanced",
        noise=noise,
        guider=guider,
        sampler=sampler,
        sigmas=sigmas,
        latent_image=latent,
    )
    return result[0]


# ================================================================
# ДЕКОДИРОВАНИЕ
# ================================================================
def _pick_auto_tile_size(free_gb):
    """
    Авто-подбор tile_size для VAE decode.

    Логика: больше свободной VRAM → больше tile → меньше
    проходов → быстрее. Меньше VRAM → меньше tile → не упадёт.
    """
    if free_gb > 12.0:
        return 1024
    if free_gb > 8.0:
        return 768
    if free_gb > 5.0:
        return 512
    if free_gb > 3.0:
        return 384
    return 256


def _vae_decode_video_smart(latent, vae, decode_tile_size=0):
    """
    Умный VAE decode видео с адаптивным tile_size.

    decode_tile_size=0  → авто-подбор по свободной VRAM.
    decode_tile_size>0  → использовать указанное значение
                          (с fallback вниз на OOM).
    """
    free_gb = vram_free_gb()
    log.info(
        "[H3 Pipeline] VAE decode video. Свободно VRAM: %.2f ГБ",
        free_gb,
    )

    # Стартовый tile_size.
    if decode_tile_size and int(decode_tile_size) > 0:
        tile_size = int(decode_tile_size)
        log.info(
            "[H3 Pipeline] Ручной tile_size: %s", tile_size,
        )
    else:
        tile_size = _pick_auto_tile_size(free_gb)
        log.info(
            "[H3 Pipeline] Авто tile_size: %s (VRAM %.2f ГБ)",
            tile_size, free_gb,
        )

    overlap = 64
    temporal_size = 64
    temporal_overlap = 8

    while tile_size >= 128:
        try:
            log.info(
                "[H3 Pipeline] VAEDecodeTiled: tile=%s "
                "overlap=%s temporal=%s temporal_overlap=%s",
                tile_size, overlap, temporal_size, temporal_overlap,
            )
            result = _call_node(
                "VAEDecodeTiled",
                samples=latent,
                vae=vae,
                tile_size=int(tile_size),
                overlap=int(overlap),
                temporal_size=int(temporal_size),
                temporal_overlap=int(temporal_overlap),
            )
            log.info(
                "[H3 Pipeline] VAE decode успешно (tile=%s)",
                tile_size,
            )
            return result[0]
        except Exception as error:
            if not _is_oom(error) or tile_size <= 128:
                raise
            log.warning(
                "[H3 Pipeline] OOM на tile=%s → уменьшаю вдвое",
                tile_size,
            )
            free_between_stages("OOM VAE, чистка")
            tile_size //= 2
            temporal_size = max(16, temporal_size // 2)

    raise RuntimeError(
        "[H3 Pipeline] Не удалось декодировать VAE "
        "даже с tile=128."
    )


def _vae_decode_audio(latent, vae):
    result = _call_node("VAEDecodeAudio", samples=latent, vae=vae)
    return result[0]


def _last_frame(images):
    result = _call_node(
        "ImageFromBatch",
        image=images,
        batch_index=-1,
        length=1,
    )
    return result[0]


# ================================================================
# ГЛАВНАЯ ФУНКЦИЯ
# ================================================================
def generate(
    prompt,
    ref_images,
    width,
    height,
    length,
    is_turbo,
    steps,
    shift_video,
    shift_audio,
    seed,
    user_loras,
    models,
    decode_tile_size=0,
    ref_video=None,
    ref_video_audio=None,
    ref_audio=None,
):
    log_vram("Start pipeline")

    # ---- 1. ЗАГРУЗКА ----
    model = _load_unet(models["unet"])
    clip = _load_clip(models["clip"], models["clip_type"])
    vae_video = _load_vae(models["vae_video"])
    vae_audio = _load_vae(models["vae_audio"])
    log_vram("After load")

    try:
        # ---- 2. TURBO LORA ----
        if is_turbo:
            log.info("[H3 Pipeline] Применяю turbo LoRA")
            model = _apply_lora(model, models["turbo_lora"], 1.0)
            log_vram("After turbo LoRA")

        # ---- 3. USER LORA ----
        for lora_name, strength in user_loras:
            if not lora_name or lora_name == NO_LORA:
                continue
            if abs(float(strength)) < 1e-6:
                continue
            log.info(
                "[H3 Pipeline] Применяю LoRA: %s (%.2f)",
                lora_name, strength,
            )
            model = _apply_lora(model, lora_name, float(strength))
        log_vram("After user LoRA")

        # ---- 4. SIGMA SHIFT ----
        model = _sigma_shift(model, shift_video, shift_audio)

        # ---- 5. ATTENTION ----
        model = _attention_backend(model)
        log_vram("After attention setup")

        # ---- 6. ENCODE ----
        positive, latent = _reference_to_video(
            clip=clip,
            vae=vae_video,
            ref_images=ref_images,
            prompt=prompt,
            width=width,
            height=height,
            length=length,
            ref_video=ref_video,
            ref_video_audio=ref_video_audio,
            ref_audio=ref_audio,
        )

        clip = None
        free_between_stages("После кодирования промпта")
        log_vram("After encode (CLIP unloaded)")

        # ---- 7. SAMPLING ----
        sampler = _sampler_select("res_multistep")
        noise = _random_noise(seed)
        sigmas = _basic_scheduler(model, steps)
        guider = _basic_guider(model, positive)

        output_latent = _sampler_advanced(
            noise=noise,
            guider=guider,
            sampler=sampler,
            sigmas=sigmas,
            latent=latent,
        )

        model = None
        guider = None
        sigmas = None
        free_between_stages("После сэмплинга")
        log_vram("After sampling (UNET unloaded)")

        # ---- 8. DECODE ----
        # VAE видео — умный tiled decode с адаптивным tile_size.
        video = _vae_decode_video_smart(
            output_latent, vae_video,
            decode_tile_size=int(decode_tile_size or 0),
        )
        # VAE аудио — простой decode (он маленький).
        audio = _vae_decode_audio(output_latent, vae_audio)

        vae_video = None
        vae_audio = None
        output_latent = None
        free_between_stages("После декодирования")
        log_vram("After decode (VAE unloaded)")

        # ---- 9. LAST FRAME ----
        last_frame = _last_frame(video)

        frames_count = int(video.shape[0])

        log.info(
            "[H3 Pipeline] Готово. Кадров: %s (%s сек при %s fps)",
            frames_count,
            round(frames_count / DEFAULT_FPS, 2),
            DEFAULT_FPS,
        )
        log_vram("End pipeline")

        return video, audio, last_frame, frames_count

    except Exception as error:
        log.exception("[H3 Pipeline] Ошибка генерации: %s", error)
        free_between_stages("После ошибки")
        raise