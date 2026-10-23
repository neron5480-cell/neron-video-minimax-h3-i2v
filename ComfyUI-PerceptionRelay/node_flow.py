# -*- coding: utf-8 -*-
"""3. Поток: как сдвигается картинка между соседними кадрами и насколько этому можно верить.

Пишет на диск: fw[t] (t→t+1), bw[t] (t+1→t) и уверенность для каждого.
Уверенность — проверка «туда-обратно»: если сдвинуть точку вперёд и потом назад
и она не вернулась на место, значит, там перекрытие, моргание или поток врёт.
"""
import os
import time

import numpy as np
import torch
import torch.nn.functional as F

from . import core_io, core_journal, core_comfy, core_ops

RAFT_FILES = {
    "RAFT large": ("raft_large", "Raft_Large_Weights"),
    "RAFT small": ("raft_small", "Raft_Small_Weights"),
}


def _load_raft(kind, dev):
    import torchvision.models.optical_flow as of
    fn_name, w_name = RAFT_FILES[kind]
    weights = getattr(of, w_name).DEFAULT
    model = getattr(of, fn_name)(weights=None)
    try:
        sd = torch.hub.load_state_dict_from_url(weights.url, model_dir=core_comfy.models_dir(),
                                                progress=True, map_location="cpu")
    except Exception as e:
        fname = os.path.basename(weights.url)
        raise RuntimeError(
            f"Эстафета/Поток: не удалось скачать веса {kind} ({e}).\n"
            f"Скачай вручную {weights.url} и положи в {core_comfy.models_dir()} как {fname}. "
            f"Или выбери движок DIS — он работает без скачивания.")
    model.load_state_dict(sd)
    return model.eval().to(dev)


def _pad8(x):
    h, w = x.shape[-2:]
    ph, pw = (8 - h % 8) % 8, (8 - w % 8) % 8
    if ph or pw:
        x = F.pad(x, (0, pw, 0, ph), mode="replicate")
    return x, h, w


def _confidence(f_ab, f_ba):
    """Уверенность для потока a→b по проверке туда-обратно."""
    back, inside = core_ops.warp(f_ba, f_ab)
    err = torch.sqrt(((f_ab + back) ** 2).sum(1, keepdim=True))
    mag = torch.sqrt((f_ab ** 2).sum(1, keepdim=True))
    tau = 0.6 + 0.05 * mag
    return torch.exp(-(err / tau) ** 2) * inside


def _remove_old_flow_files(d, keep):
    """Убрать прошлые файлы потока, чтобы не копились на диске. Занятые — пропускаем молча,
    их уберёт следующий расчёт."""
    keep = {os.path.normcase(os.path.abspath(p)) for p in keep}
    try:
        names = os.listdir(d)
    except OSError:
        return
    for name in names:
        if not (name.startswith("flow_") and name.endswith(".npy")):
            continue
        p = os.path.join(d, name)
        if os.path.normcase(os.path.abspath(p)) in keep:
            continue
        try:
            os.remove(p)
        except OSError:
            pass


class RelayFlow:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = ("RELAY",)
    RETURN_NAMES = ("эстафета",)
    DESCRIPTION = "Оптический поток между кадрами и его уверенность — глаза для Судьи."

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "relay": ("RELAY",),
            "engine": (["RAFT large", "RAFT small", "DIS (no download / без скачивания)"], {"default": "RAFT large"}),
            "scale": (["0.5", "0.75", "1.0"], {"default": "0.5",
                      "tooltip": "В каком масштабе считать поток. 1.0 точнее, но дольше и больше места на диске"}),
            "iterations": ("INT", {"default": 12, "min": 4, "max": 32,
                                   "tooltip": "Шаги уточнения RAFT"}),
            "free_vram_before": ("BOOLEAN", {"default": True,
                                             "tooltip": "Выгрузить модели Comfy из видеопамяти перед стартом"}),
        }}

    def run(self, relay, engine, scale, iterations, free_vram_before):
        t0 = time.time()
        v = core_journal.video(relay)
        w, h, n = v["w"], v["h"], v["frames"]
        s = float(scale)
        fw_, fh_ = max(8, int(round(w * s))), max(8, int(round(h * s)))
        dev = core_ops.device()
        use_dis = engine.startswith("DIS")
        if free_vram_before and not getattr(core_comfy.LOCAL, "live", False):  # в фоне окна чужое не выгружаем
            try:
                import comfy.model_management as mm
                mm.unload_all_models()
            except Exception:
                pass
            core_ops.free_vram()
        model = None
        dis = None
        if use_dis:
            import cv2
            dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        else:
            model = _load_raft(engine, dev)

        d = relay["job_dir"]
        # каждый расчёт пишет в новые файлы: старые может держать открытыми живое окно,
        # а Windows не даёт перезаписать открытый файл (OSError: Invalid argument)
        stamp = f"{int(time.time() * 1000):x}"
        paths = {k: os.path.join(d, f"flow_{k}_{stamp}.npy") for k in ("fw", "bw", "cfw", "cbw")}
        mm_fw = np.lib.format.open_memmap(paths["fw"], "w+", np.float16, (n - 1, 2, fh_, fw_))
        mm_bw = np.lib.format.open_memmap(paths["bw"], "w+", np.float16, (n - 1, 2, fh_, fw_))
        mm_cf = np.lib.format.open_memmap(paths["cfw"], "w+", np.uint8, (n - 1, fh_, fw_))
        mm_cb = np.lib.format.open_memmap(paths["cbw"], "w+", np.uint8, (n - 1, fh_, fw_))

        cur = relay["current"]
        reader = core_io.FrameReader(cur["path"], w, h, cur["kind"], v["matrix"], v["range"])
        bar = core_comfy.Progress(n)
        prev = None
        conf_mean = []
        motion = []
        t = 0
        with torch.inference_mode():
            for frame in reader:
                core_comfy.check_interrupt()
                x = core_ops.to_t(frame, dev)
                x = F.interpolate(x, size=(fh_, fw_), mode="area") if s != 1.0 else x
                if prev is not None and t - 1 < n - 1:
                    if use_dis:
                        import cv2
                        a = (prev[0].mean(0).cpu().numpy() * 255).astype(np.uint8)
                        b = (x[0].mean(0).cpu().numpy() * 255).astype(np.uint8)
                        f_ab = torch.from_numpy(dis.calc(a, b, None)).permute(2, 0, 1)[None].to(dev)
                        f_ba = torch.from_numpy(dis.calc(b, a, None)).permute(2, 0, 1)[None].to(dev)
                    else:
                        i1 = torch.cat([prev, x], 0) * 2 - 1
                        i2 = torch.cat([x, prev], 0) * 2 - 1
                        i1, hh, ww = _pad8(i1)
                        i2, _, _ = _pad8(i2)
                        flows = model(i1, i2, num_flow_updates=iterations)[-1][..., :hh, :ww]
                        f_ab, f_ba = flows[0:1], flows[1:2]
                    c_ab = _confidence(f_ab, f_ba)
                    c_ba = _confidence(f_ba, f_ab)
                    k = t - 1
                    mm_fw[k] = f_ab[0].half().cpu().numpy()
                    mm_bw[k] = f_ba[0].half().cpu().numpy()
                    mm_cf[k] = (c_ab[0, 0] * 255).round().byte().cpu().numpy()
                    mm_cb[k] = (c_ba[0, 0] * 255).round().byte().cpu().numpy()
                    conf_mean.append(float(c_ab.mean()))
                    motion.append(float(torch.sqrt((f_ab ** 2).sum(1)).mean()) / s)
                prev = x
                t += 1
                bar.step()
        for m in (mm_fw, mm_bw, mm_cf, mm_cb):
            m.flush()
        del mm_fw, mm_bw, mm_cf, mm_cb, model
        core_ops.free_vram()
        _remove_old_flow_files(d, set(paths.values()))

        conf = np.array(conf_mean) if conf_mean else np.zeros(1)
        mot = np.array(motion) if motion else np.zeros(1)
        # нестабильные участки: поток не уверен или резкое движение
        unstable = [i for i in range(len(conf)) if conf[i] < 0.55 or mot[i] > max(8.0, 4 * np.median(mot))]
        segments = []
        for i in unstable:
            if segments and i - segments[-1][1] <= 2:
                segments[-1][1] = i + 1
            else:
                segments.append([i, i + 1])
        relay = core_journal.advance(relay, "flow")
        summary = [f"Движок: {engine}, масштаб {scale} ({fw_}x{fh_})",
                   f"Средняя уверенность потока: {conf.mean() * 100:.0f}%",
                   f"Среднее движение: {mot.mean():.1f} пикс/кадр, максимум {mot.max():.1f}"]
        if segments:
            seg_txt = ", ".join(f"{a}–{b}" for a, b in segments[:12])
            summary.append(f"Неустойчивые участки (кадры): {seg_txt}" + (" …" if len(segments) > 12 else ""))
            summary.append("Судья будет там осторожнее")
        else:
            summary.append("Неустойчивых участков нет")
        task = {"engine": engine, "scale": s, "iterations": iterations}
        core_journal.write_stage(relay, "flow", task, summary,
                                 stats={"pairs": len(conf_mean), "conf_mean": float(conf.mean()), "motion_mean": float(mot.mean()),
                                        "per_pair_conf": [round(c, 3) for c in conf.tolist()],
                                        "unstable_segments": segments, "flow_size": [fw_, fh_]},
                                 files=paths, seconds=time.time() - t0)
        return (relay,)
