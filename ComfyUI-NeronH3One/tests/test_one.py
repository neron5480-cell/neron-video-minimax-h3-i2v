# -*- coding: utf-8 -*-
"""🧪 Проверка 🎬 Neron H3 One без ComfyUI и без моделей: настоящий torch, ComfyUI — заглушки.

Ловим то, что ломается чаще всего: импорт, поля ноды, длина по сетке 17k+5, выбор моделей по режимам,
защиту от двоения, путь картинок (кадр / образец / последний кадр), Баланс (черновик → чистовик),
ускорение и понятные ошибки.
Запуск: python tests/test_one.py   (нужен только torch)
"""
import importlib
import os
import shutil
import sys
import tempfile
import types

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
PKG_SRC = os.path.dirname(HERE)
TMP = tempfile.mkdtemp(prefix="h3one_test_")
shutil.copytree(PKG_SRC, os.path.join(TMP, "NeronH3One"), ignore=shutil.ignore_patterns("__pycache__", "tests"))
sys.path.insert(0, TMP)

CALLS = []
FILES = {}


def set_files(**kinds):
    FILES.clear()
    base = {
        "diffusion_models": ["minimax_h3_fl2va_pruned_int8_convrot.safetensors"],
        "text_encoders": ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"],
        "vae": ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"],
        "loras": ["minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors",
                  "minimax_h3_fl2v_turbo_4step_v1.3_768p_comfyui_bf16.safetensors", "style.safetensors"],
        "latent_upscale_models": [],
    }
    for k, v in kinds.items():
        base[k] = v
    FILES.update(base)


set_files()

# ─────────── заглушки ComfyUI ───────────
folder_paths = types.ModuleType("folder_paths")
folder_paths.models_dir = TMP
folder_paths.get_filename_list = lambda kind: list(FILES.get(kind, []))
folder_paths.get_folder_paths = lambda kind: [os.path.join(TMP, kind)]
folder_paths.get_user_directory = lambda: os.path.join(TMP, "user")
folder_paths.get_full_path = lambda kind, name: os.path.join(TMP, kind, name)
folder_paths.get_full_path_or_raise = lambda kind, name: os.path.join(TMP, kind, name)
sys.modules["folder_paths"] = folder_paths

T_FRAMES = {"n": 124}


class _Fake:
    FUNCTION = "run"

    def run(self, **kw):
        name = self.__class__.__name__
        CALLS.append((name, kw))
        if name in ("CLIPLoader", "VAELoader", "KSamplerSelect", "RandomNoise", "LatentUpscaleModelLoader"):
            return ("obj_" + name,)
        if name == "UNETLoader":
            return (_Model(kw["unet_name"]),)
        if name in ("MiniMaxH3SigmaShift", "ModelAttentionBackend", "BlockSparseAttention"):
            return (kw["model"],)
        if name == "BasicScheduler":
            return ("sigmas",)
        if name == "BasicGuider":
            return ("guider",)
        if name == "SamplerCustomAdvanced":
            return (kw["latent_image"],)
        if name in ("MiniMaxH3ImageToVideo", "MiniMaxH3ReferenceToVideo"):
            return ("COND", {"samples": torch.zeros(1, 4, 8, kw["height"] // 16, kw["width"] // 16)})
        if name == "EmptyMiniMaxH3LatentAV":
            return ({"samples": torch.zeros(1, 4, 8, kw["height"] // 16, kw["width"] // 16)},)
        if name == "MiniMaxH3AddGuide":
            return ("COND",)
        if name in ("VAEDecode", "VAEDecodeTiled"):
            return (torch.zeros(1, T_FRAMES["n"], 16, 16, 3),)
        if name == "VAEDecodeAudio":
            return ({"waveform": torch.zeros(1, 2, 100), "sample_rate": 44100},)
        if name == "CreateVideo":
            return ("VIDEO",)
        return ()


class _Model:
    def __init__(self, name):
        self.name = name

    def clone(self):
        return self

    def set_model_optimized_attention(self, fn):
        self.attn = fn


nodes = types.ModuleType("nodes")
nodes.NODE_CLASS_MAPPINGS = {n: type(n, (_Fake,), {}) for n in (
    "CLIPLoader", "VAELoader", "UNETLoader", "KSamplerSelect", "RandomNoise", "BasicScheduler", "BasicGuider",
    "SamplerCustomAdvanced", "VAEDecode", "VAEDecodeTiled", "VAEDecodeAudio", "MiniMaxH3ImageToVideo",
    "MiniMaxH3ReferenceToVideo", "MiniMaxH3AddGuide", "MiniMaxH3SigmaShift", "EmptyMiniMaxH3LatentAV",
    "CreateVideo", "ModelAttentionBackend", "BlockSparseAttention", "LatentUpscaleModelLoader",
    "MiniMaxH3LatentUpscaleWithModel")}
sys.modules["nodes"] = nodes

server = types.ModuleType("server")


class _Routes:
    def __getattr__(self, name):
        return lambda *a, **k: (lambda f: f)


class _PS:
    class instance:
        routes = _Routes()

        @staticmethod
        def send_sync(*a, **k):
            pass


server.PromptServer = _PS
sys.modules["server"] = server

comfy = types.ModuleType("comfy")
for sub in ("model_management", "sd", "utils", "nested_tensor"):
    m = types.ModuleType("comfy." + sub)
    setattr(comfy, sub, m)
    sys.modules["comfy." + sub] = m
sys.modules["comfy"] = comfy
comfy.model_management.unload_all_models = lambda: None
comfy.model_management.soft_empty_cache = lambda: None
comfy.model_management.is_oom = lambda e: False
comfy.sd.load_lora_for_models = lambda model, clip, lora, sm, sc, **kw: (model, None)
comfy.utils.load_torch_file = lambda path, **kw: ({"w": 1}, None)
comfy.nested_tensor.NestedTensor = lambda t: t

# ─────────── импорт ───────────
pkg = importlib.import_module("NeronH3One")
N = pkg.NODE_CLASS_MAPPINGS["NeronH3One"]
E = importlib.import_module("NeronH3One.engine")
S = importlib.import_module("NeronH3One.speed")
print("✅ импорт, нода:", list(pkg.NODE_CLASS_MAPPINGS))

it = N.INPUT_TYPES()
assert list(it["required"]) == N.ORDER
for k, v in it["required"].items():
    if isinstance(v[0], list):
        assert v[1].get("default") in v[0], f"{k}: дефолт не из списка"
    assert v[1].get("display_name"), f"{k}: нет подписи RU/EN"
for k in ("prompt", "ref_image_0", "ref_image_1", "ref_image_2", "ref_image_3", "last_frame", "ref_video",
          "ref_video_audio", "ref_audio", "width", "height", "length_in"):
    assert k in it["optional"], f"нет входа {k} — контракт прежних движков сломан"
print("✅ поля: порядок, подписи RU/EN у всех, дефолты валидны, входы как у прежних движков")

img = lambda h=768, w=1344: torch.rand(1, h, w, 3)


def run(**kw):
    CALLS.clear()
    args = dict(prompt="test", seed=1)
    args.update(kw)
    out = N().generate(**args)
    return out["result"], out["ui"]["text"][0]


def names():
    return [c[0] for c in CALLS]


def calls(name):
    return [kw for n, kw in CALLS if n == name]


# ─────────── длина ───────────
(_, _, _, _, count), rep = run(mode=E.FAST, seconds=5.0, ref_image_0=img())
assert calls("MiniMaxH3ImageToVideo")[0]["length"] == 124, "5 с → 124 кадра (сетка 17k+5)"
print("✅ 5 с → 124 кадра; отчёт с замером:", "⏱ Замер" in rep)
assert "⏱ Замер" in rep and "с/шаг" in rep

# ─────────── 🚀 Быстро: только первый кадр → официальный I2V, быстрая LoRA, 6 шагов ───────────
i2v = calls("MiniMaxH3ImageToVideo")[0]
assert i2v["first_frame"] is not None and "MiniMaxH3ReferenceToVideo" not in names()
assert calls("BasicScheduler")[0]["steps"] == 6
assert "MiniMaxH3AddGuide" not in names(), "в I2V первый кадр уже ключевой — второй раз не прикалываем"
print("✅ 🚀 Быстро: первый кадр — настоящий кадр (MiniMaxH3ImageToVideo), 6 шагов")

# ─────────── образцы + последний кадр → ReferenceToVideo + AddGuide(0) + AddGuide(-1) ───────────
run(mode=E.QUALITY, ref_image_0=img(), ref_image_1=img(), last_frame=img())
ref = calls("MiniMaxH3ReferenceToVideo")[0]
assert list(ref["ref_images"]) == ["ref_image_0", "ref_image_1"], ref["ref_images"].keys()
assert ref["ref_image_size"] == "max"
g = calls("MiniMaxH3AddGuide")
assert [x["frame_idx"] for x in g] == [0, -1], g
assert calls("BasicScheduler")[0]["steps"] == 40
print("✅ ✨ Качество: образцы по порядку <Picture 1..2>, кадр 0 и кадр конца, 40 шагов, образцы max")

# «только образец» — без настоящего первого кадра
run(mode=E.FAST, ref_image_0=img(), first_as=E.FIRST_REF_ONLY)
assert "MiniMaxH3ReferenceToVideo" in names() and "MiniMaxH3AddGuide" not in names()
print("✅ 🖼 только образец: как Raw Engine — без ключевого кадра")

# обрезка под формат: вертикальная картинка в кадр 16:9 не растягивается
run(mode=E.FAST, ref_image_0=img(1344, 768), size=list(pkg.node.passport.PRESETS)[0])
ff = calls("MiniMaxH3ImageToVideo")[0]["first_frame"]
assert abs(ff.shape[2] / ff.shape[1] - 1344 / 768) < 0.01, ff.shape
print("✅ первый кадр обрезан под формат 16:9, а не растянут")

# ─────────── 🛡 защита от двоения ───────────
set_files(diffusion_models=["10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors",
                            "10Eros_Max_h3_fl2va_pruned_bf16.safetensors"])
_, rep = run(mode=E.FAST, unet_model="10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors")
assert calls("UNETLoader")[0]["unet_name"] == "10Eros_Max_h3_fl2va_pruned_bf16.safetensors"
assert "🛡" in rep
_, rep = run(mode=E.FAST, unet_model="10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors", protect_lora=False)
assert calls("UNETLoader")[0]["unet_name"].endswith("int8_convrot.safetensors")
set_files(diffusion_models=["10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors"])
_, rep = run(mode=E.FAST, unet_model="10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors")
assert calls("UNETLoader")[0]["unet_name"].endswith("int8_convrot.safetensors") and "⚠ LoRA" in rep
print("✅ 🛡 LoRA на int8: есть bf16-двойник — берётся он; нет — честное предупреждение; выключатель работает")

# ✨ Качество берёт bf16-двойник стандартной модели
set_files(diffusion_models=["minimax_h3_fl2va_pruned_int8_convrot.safetensors",
                            "minimax_h3_fl2va_pruned_bf16.safetensors"])
run(mode=E.QUALITY)
assert calls("UNETLoader")[0]["unet_name"] == "minimax_h3_fl2va_pruned_bf16.safetensors"
run(mode=E.MAXIMUM)
assert calls("BasicScheduler")[0]["steps"] == 50
print("✅ ✨/👑 берут модель без сжатия; 👑 — 50 шагов")

# ─────────── 🔥 Экстрим ───────────
FAST_H3 = "fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors"
set_files(diffusion_models=["minimax_h3_fl2va_pruned_int8_convrot.safetensors", FAST_H3])
run(mode=E.EXTREME, ref_image_0=img())
assert calls("UNETLoader")[0]["unet_name"] == FAST_H3
assert calls("BasicScheduler")[0]["steps"] == 8
sp = calls("BlockSparseAttention")[0]["selection"]
assert sp == {"selection": "vsa", "keep_percent": 10.0}, sp
assert not [c for c in CALLS if c[0] == "MiniMaxH3SigmaShift" and c[1]["shift_video"] != 10.0]
print("✅ 🔥 Экстрим: Fast H3, 8 шагов, сдвиг 10, разреженное vsa 10%")

set_files(diffusion_models=["10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors", FAST_H3])
_, rep = run(mode=E.EXTREME, unet_model="10Eros_Max_h3_fl2va_pruned_int8_convrot.safetensors")
assert calls("UNETLoader")[0]["unet_name"].startswith("10Eros"), "своя модель не подменяется на Fast H3"
assert calls("BasicScheduler")[0]["steps"] == 4
assert calls("BlockSparseAttention")[0]["selection"]["selection"] == "sol-attn"
print("✅ 🔥 Экстрим со своей моделью: она и остаётся (не Fast H3), быстрая LoRA 4 шага, sol-attn")

set_files(diffusion_models=[FAST_H3])
run(mode=E.EXTREME)
assert calls("UNETLoader")[0]["unet_name"] == FAST_H3
print("✅ 🔥 Экстрим работает, даже если есть только Fast H3")

# ─────────── ⚖ Баланс ───────────
set_files()
run(mode=E.BALANCE, ref_image_0=img(), seconds=10.0)
d = calls("EmptyMiniMaxH3LatentAV")[0]
assert (d["width"], d["height"]) == (960, 544), d
smp = calls("BasicScheduler")
assert [s["steps"] for s in smp] == [8, 3] and smp[1]["denoise"] == 0.5, smp
assert "MiniMaxH3AddGuide" not in names()
run(mode=E.BALANCE, balance_clean=True)
assert [s["steps"] for s in calls("BasicScheduler")] == [8, 6]
print("✅ ⚖ Баланс: черновик 960×544 / 8 шагов → чистовик 3 шага, сила 0.5; «чище» — 6 шагов")

# ─────────── ⚡ ускорение по выбору ───────────
run(mode=E.FAST, sparse=S.SP_SOL, sparse_tau=1.5)
assert calls("BlockSparseAttention")[0]["selection"] == {"selection": "sol-attn", "tau": 1.5}
_, rep = run(mode=E.FAST, sparse=S.SP_VSA)
assert calls("BlockSparseAttention")[0]["selection"]["selection"] == "sol-attn" and "vsa работает только" in rep
run(mode=E.FAST)
assert "BlockSparseAttention" not in names(), "в 🚀 Быстро по умолчанию — без разреженного"
print("✅ ⚡ разреженное: по выбору; vsa без Fast H3 → sol-attn с объяснением; по умолчанию выкл. (кроме Экстрима)")

# ─────────── ошибки и мелочи ───────────
set_files(loras=[])
try:
    run(mode=E.FAST)
    raise AssertionError("ждали понятную ошибку")
except Exception as e:
    assert "📥" in str(e) and "EN:" in str(e), e
print("✅ нет быстрой LoRA → понятная ошибка RU/EN с кнопкой «📥 Модели»")
set_files()
try:
    run(mode=E.FAST, prompt="  ")
    raise AssertionError("ждали ошибку про промпт")
except Exception as e:
    assert "промпт" in str(e).lower(), e
_, rep = run(mode=E.FAST, lora_1="style.safetensors", strength_1=0.7, lora_2="нет-такой.safetensors")
assert "style.safetensors ×0.7" in rep and "не найдена" in rep
run(mode=E.FAST, length_in=200)
assert calls("MiniMaxH3ImageToVideo")[0]["length"] == 209
print("✅ пустой промпт, своя LoRA, пропуск несуществующей LoRA, длина проводом (200 → 209 кадров)")

# ─────────── пакеты моделей ───────────
D = importlib.import_module("NeronH3One.downloader")
for pid in ("standard", "extreme", "quality", "maximum"):
    _, p = D.get_pack(pid)
    assert p["files"], pid
assert set(E.MODE_PACK.values()) <= set(D.load_packs()["packs"])
print("✅ у каждого режима свой пакет моделей")

# ─────────── 🎭 Подмена ───────────
from fractions import Fraction
W = importlib.import_module("NeronH3One.swap")
SW = pkg.NODE_CLASS_MAPPINGS["NeronH3Swap"]
it = SW.INPUT_TYPES()
assert list(it["required"]) == SW.ORDER
for k, v in it["required"].items():
    if isinstance(v[0], list):
        assert v[1].get("default", v[0][0]) in v[0], f"swap {k}: дефолт не из списка"
    assert v[1].get("display_name"), f"swap {k}: нет подписи RU/EN"


class _Comp:
    def __init__(self, n, fps, audio):
        self.images, self.frame_rate, self.audio = torch.rand(n, 360, 640, 3), Fraction(fps), audio


class _Video:
    def __init__(self, n, fps, audio):
        self.c = _Comp(n, fps, audio)

    def get_components(self):
        return self.c


src_audio = {"waveform": torch.ones(1, 2, 44100 * 20), "sample_rate": 44100}
# фото — из файла в input (как будто загружено окном ноды)
os.makedirs(os.path.join(TMP, "input"), exist_ok=True)
from PIL import Image as _I
_I.new("RGB", (512, 768), (200, 150, 120)).save(os.path.join(TMP, "input", "me.png"))
folder_paths.get_annotated_filepath = lambda name: os.path.join(TMP, "input", name)
folder_paths.get_input_directory = lambda: os.path.join(TMP, "input")


def swap(n_out=107, **kw):
    CALLS.clear()
    T_FRAMES["n"] = n_out                       # столько кадров «раскодирует» заглушка
    args = dict(seed=1, mode=E.FAST, photo="me.png")
    args.update(kw)
    out = SW().generate(**args)
    return out["result"], out["ui"]["text"][0]


# 20 с при 30 к/с → 24 к/с, не длиннее 15 с → 345 кадров (17k+5)
(_, _, aud, _, count), rep = swap(n_out=345, video_in=_Video(600, 30, src_audio))
ref = calls("MiniMaxH3ReferenceToVideo")[0]
assert ref["length"] == 345 and ref["ref_videos"]["ref_video_0"].shape[0] == 345, ref["length"]
assert list(ref["ref_images"]) == ["ref_image_0"] and "ref_video_audios" in ref and "audio_vae" in ref
assert "MiniMaxH3AddGuide" not in names(), "в подмене фото — образец, а не кадр"
assert "<Video 1>" in ref["prompt"] and "<Picture 1>" in ref["prompt"] and "ONLY the face" in ref["prompt"]
assert ref["width"] == 1344 and ref["height"] == 768, (ref["width"], ref["height"])
assert ref["ref_image_size"] == "max"
assert aud["waveform"].shape[-1] == int(round(345 / 24 * 44100)) and float(aud["waveform"].mean()) == 1.0
assert "взято начало" in rep and "оригинал" in rep
print("✅ 🎭 подмена лица: 30 к/с → 24, до 15 с (345 кадров), <Video 1> + <Picture 1>, звук — оригинал байт в байт")

swap(video_in=_Video(120, 24, src_audio), what=W.WHOLE, hold=W.LOOSE, extra="She smiles at the end.")
p = calls("MiniMaxH3ReferenceToVideo")[0]["prompt"]
assert "ENTIRELY" in p and "She smiles at the end." in p and "Do not add" not in p
assert calls("MiniMaxH3ReferenceToVideo")[0]["length"] == 107       # 5 с = 120 кадров → 107 (17k+5 вниз)
print("✅ 🧍 полностью + свободнее + уточнение; 5 с → 107 кадров (сетка вниз — не длиннее видео)")

own = {"waveform": torch.full((1, 1, 44100 * 3), 0.5), "sample_rate": 44100}
(_, _, aud, _, count), rep = swap(video_in=_Video(120, 24, src_audio), sound=W.SND_OWN, audio_in=own)
r = calls("MiniMaxH3ReferenceToVideo")[0]
assert "ref_audios" in r and "ref_video_audios" not in r
assert abs(float(aud["waveform"][..., :44100].mean()) - 0.5) < 1e-6 and float(aud["waveform"][..., -10:].abs().sum()) == 0
print("✅ 🔊 свой звук: идёт образцом и на выход, короче ролика — дополнен тишиной")

(_, _, aud, _, _), rep = swap(video_in=_Video(120, 24, None))
assert "нет звука" in rep and "сгенерирован" in rep
print("✅ видео без звука → звук генерирует H3, с пояснением")

(_, _, aud, _, _), rep = swap(video_in=_Video(120, 24, src_audio), sound=W.SND_GEN)
assert "сгенерирован" in rep and "ref_video_audios" in calls("MiniMaxH3ReferenceToVideo")[0]
run_ok = True
for bad in (dict(video_in=_Video(10, 24, None)), dict(video_in=None, video=W.NO_FILE), dict(video_in=_Video(120, 24, None), photo=W.NO_FILE)):
    try:
        swap(**bad)
        run_ok = False
    except Exception as e:
        assert "EN:" in str(e), e
assert run_ok
swap(video_in=_Video(120, 24, src_audio), mode=E.BALANCE)
assert [s["steps"] for s in calls("BasicScheduler")] == [8, 3]
print("✅ ✨ сгенерировать, понятные ошибки (короткое видео, нет видео, нет фото), ⚖ Баланс работает и в подмене")

shutil.rmtree(TMP, ignore_errors=True)
print("\n🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ / ALL CHECKS PASSED")
