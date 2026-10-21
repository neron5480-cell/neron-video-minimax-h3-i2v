# -*- coding: utf-8 -*-
"""Пульт: центральная нода. Карточки этапов втыкаются в неё по одному проводу.

Карточка этапа ничего не считает — она только отдаёт свои ползунки. Пульт сам прогоняет
эстафету в правильном порядке (не важно, какую карточку в какой вход воткнули), пропускает
неподключённые этапы и сам добавляет нужных помощников (Судье — Поток, точкам внимания — Разведку).
Уже посчитанные этапы запоминаются: подвинул ползунок в Полировке — Судья и Поток не пересчитываются.

Выходы: кадры + звук + частота (в Video Combine / Create Video), последний кадр (для склейки),
путь к видео-сравнению (и оно же — превью прямо в пульте), обезличенный файл настроек «для нас».
"""
import copy
import hashlib
import json
import os
import re
import subprocess
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy
from .node_start import RelayStart
from .node_scout import RelayScout
from .node_flow import RelayFlow
from .node_judge import RelayJudge
from .node_edge import RelayEdge
from .node_tone import RelayTone
from .node_seam import RelaySeam
from .node_polish import RelayPolish
from .node_basic import RelayBasic
from .node_finish import RelayFinish
from .node_compare import RelayCompare, LAYOUTS

VERSION = "1.0"
STAGE_TYPE = "PR_STAGE"
ORDER = ["scout", "flow", "judge", "edge", "tone", "seam", "polish", "basic", "points"]
CLASSES = {"scout": RelayScout, "flow": RelayFlow, "judge": RelayJudge, "edge": RelayEdge,
           "tone": RelayTone, "seam": RelaySeam, "polish": RelayPolish, "basic": RelayBasic}
TITLES = {"scout": "Разведка", "flow": "Поток", "judge": "Судья", "edge": "Огранка",
          "tone": "Тональный скелет", "seam": "Цветовой шов", "polish": "Полировка", "basic": "Основное",
          "points": "Точки внимания"}
SLOTS = 10
LIVE_VIEWS = ["after / после", "before / до", "split / шторка"]
LIVE_KEYS = ("live", "live_frame", "live_view")
NO_COMPARE = "none / не делать"


# ---------- карточки этапов ----------

class PointsCard:
    """Точки внимания (глаза и контур лица) + зерно — то, что раньше жило в Финише."""
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    RETURN_TYPES = (STAGE_TYPE,)
    RETURN_NAMES = ("в пульт",)
    DESCRIPTION = "Точки внимания: глаза и контур до «фокуса объектива». Втыкается в Пульт."

    @classmethod
    def INPUT_TYPES(cls):
        req = RelayFinish.INPUT_TYPES()["required"]
        keep = ["eye_sharp", "eye_contrast", "contour_sharp", "grain", "grain_size", "seed"]
        return {"required": {k: req[k] for k in keep}}

    def run(self, **kw):
        return ({"stage": "points", "params": kw},)


def _make_card(stage, base, title, desc):
    def INPUT_TYPES(cls):
        req = dict(base.INPUT_TYPES()["required"])
        req.pop("relay", None)
        return {"required": req}

    def run(self, **kw):
        return ({"stage": stage, "params": kw},)

    return type(f"Card_{stage}", (), {
        "CATEGORY": "Эстафета восприятия", "FUNCTION": "run",
        "RETURN_TYPES": (STAGE_TYPE,), "RETURN_NAMES": ("в пульт",),
        "DESCRIPTION": desc + " Втыкается в Пульт одним проводом.",
        "INPUT_TYPES": classmethod(INPUT_TYPES), "run": run})


CARDS = {
    "scout": _make_card("scout", RelayScout, "Разведка", "Лица и глаза — реперные точки."),
    "flow": _make_card("flow", RelayFlow, "Поток", "Движение между кадрами и его уверенность."),
    "judge": _make_card("judge", RelayJudge, "Судья", "Физика или дрейф: гасит ползущие псевдодетали."),
    "edge": _make_card("edge", RelayEdge, "Огранка", "Резкость скелета (RCAS) со сверкой во времени."),
    "tone": _make_card("tone", RelayTone, "Тональный скелет", "Тени и чёрное как каркас картинки."),
    "seam": _make_card("seam", RelaySeam, "Цветовой шов", "Чистые цветовые границы без кайм."),
    "polish": _make_card("polish", RelayPolish, "Полировка", "Свет, дефликер, плавность."),
    "basic": _make_card("basic", RelayBasic, "Основное", "Яркость, контраст, резкость, насыщенность всей картинки."),
}


def defaults(cls):
    out = {}
    for k, spec in cls.INPUT_TYPES()["required"].items():
        if k == "relay":
            continue
        kind = spec[0]
        opts = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
        if isinstance(kind, (list, tuple)):
            out[k] = opts.get("default", kind[0])
        else:
            out[k] = opts.get("default")
    return out


def _sig(*parts):
    return hashlib.sha1(json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def _source_sig(video, video_path):
    try:
        s = video.get_stream_source() if video is not None else None
    except Exception:
        s = None
    p = s if isinstance(s, str) else (video_path or "").strip().strip('"')
    try:
        st = os.stat(p)
        return f"{p}|{st.st_mtime}|{st.st_size}"
    except OSError:
        return f"mem|{time.time()}"  # видео в памяти — честно считаем новым


def _load_audio(path):
    if not path or not os.path.isfile(path):
        return None
    cmd = [core_io.ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-i", path,
           "-f", "f32le", "-ac", "2", "-ar", "48000", "-"]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=core_io._NO_WINDOW)
    a = np.frombuffer(p.stdout, dtype="<f4")
    if a.size < 2:
        return None
    a = a[: a.size // 2 * 2].reshape(-1, 2).T.copy()
    return {"waveform": torch.from_numpy(a)[None], "sample_rate": 48000}


def resolve_cards(card_list):
    """Карточки из входов → {этап: параметры} + помощники, без которых этапы не работают."""
    notes = []
    cards = {}
    for c in card_list:
        if isinstance(c, dict) and c.get("stage") in ORDER:
            if c["stage"] in cards:
                notes.append(f"Карточка «{TITLES[c['stage']]}» подключена дважды — взята последняя")
            cards[c["stage"]] = dict(c["params"])
    heavy = any(s in cards for s in ("judge", "edge", "tone", "seam", "polish"))
    if heavy and "flow" not in cards:
        cards["flow"] = defaults(RelayFlow)
        notes.append("Поток добавлен автоматически (нужен Судье и сверкам во времени)")
    need_scout = ("points" in cards or "judge" in cards or
                  cards.get("tone", {}).get("face_fill", 0) > 0 or cards.get("edge", {}).get("skip_faces"))
    if need_scout and "scout" not in cards:
        cards["scout"] = defaults(RelayScout)
        notes.append("Разведка добавлена автоматически (нужна точкам внимания и защите лиц)")
    return cards, notes


def ensure_stages(job_name, video, video_path, cards, only=None):
    """Прогоняет этапы по порядку с памятью (hub_cache.json). only — посчитать только эти этапы
    (для подготовки живого окна: Разведка и Поток). Память общая с полным прогоном Пульта."""
    from .node_start import _safe
    src_sig = _source_sig(video, video_path)
    start_sig = _sig("start", src_sig, job_name)
    cache_path = None
    cache = {}
    probe_name = job_name.strip()
    if not probe_name:
        s = None
        try:
            s = video.get_stream_source() if video is not None else None
        except Exception:
            pass
        p = s if isinstance(s, str) else (video_path or "")
        probe_name = os.path.splitext(os.path.basename(p.strip().strip('"')))[0] if p else ""
    if probe_name:
        cache_path = os.path.join(core_comfy.output_dir(), "perception_relay", _safe(probe_name), "hub_cache.json")
        if os.path.isfile(cache_path):
            try:
                cache = json.load(open(cache_path, encoding="utf-8"))
            except Exception:
                cache = {}
    if cache.get("start", {}).get("sig") == start_sig and os.path.isfile(cache["start"]["relay"]["journal"]):
        relay = cache["start"]["relay"]
        reused = ["Старт"]
    else:
        relay, = RelayStart().run(job_name, video, video_path)
        cache = {"start": {"sig": start_sig, "relay": relay}}
        reused = []
        cache_path = os.path.join(relay["job_dir"], "hub_cache.json")
    prev = start_sig
    ran = []
    for stage in ORDER:
        if stage == "points" or stage not in cards:
            continue
        if only is not None and stage not in only:
            break
        params = cards[stage]
        sig = _sig(prev, stage, params)
        hit = cache.get(stage)
        ok = hit and hit.get("sig") == sig and os.path.isfile(hit["relay"]["current"]["path"]) \
            and stage in hit["relay"].get("chain", [])
        if ok:
            relay = hit["relay"]
            reused.append(TITLES[stage])
        else:
            relay, = CLASSES[stage]().run(relay, **params)
            cache[stage] = {"sig": sig, "relay": relay}
            ran.append(TITLES[stage])
            for later in ORDER[ORDER.index(stage) + 1:]:
                cache.pop(later, None)
        prev = sig
    if cache_path:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=1)
    return relay, ran, reused


# ---------- сам пульт ----------

class RelayHub:
    CATEGORY = "Эстафета восприятия"
    FUNCTION = "run"
    OUTPUT_NODE = True
    RETURN_TYPES = ("IMAGE", "AUDIO", "FLOAT", "IMAGE", "STRING", "STRING")
    RETURN_NAMES = ("кадры", "звук", "fps", "последний_кадр", "сравнение", "отчёт_для_нас")
    DESCRIPTION = ("Центральный пульт: втыкай карточки этапов (по одному проводу, в любом порядке), "
                   "на выходе — видео для сохранения, сравнение и файл настроек для обмена.")

    @classmethod
    def INPUT_TYPES(cls):
        opt = {"video": ("VIDEO", {"tooltip": "Стандартная нода Load Video"}),
               "video_path": ("STRING", {"default": "", "tooltip": "Запасной вариант: путь к файлу"})}
        for i in range(1, SLOTS + 1):
            opt[f"этап_{i}"] = (STAGE_TYPE, {"tooltip": "Любая карточка этапа — порядок пульт наведёт сам"})
        return {
            "required": {
                "job_name": ("STRING", {"default": "", "tooltip": "Имя задачи. Пусто — по имени файла"}),
                "compare": (LAYOUTS + [NO_COMPARE], {"default": LAYOUTS[0]}),
                "codec": (["h264", "h265 10bit"], {"default": "h264"}),
                "crf": ("INT", {"default": 16, "min": 0, "max": 40}),
                "frames_out": ("BOOLEAN", {"default": True,
                                           "tooltip": "Отдавать кадры на выход (для Video Combine). На длинных "
                                                      "видео это много памяти — можно выключить, итог всё равно "
                                                      "сохраняется файлом"}),
                "rating": (["—", "great / отлично", "good / хорошо", "so-so / так себе", "bad / плохо"], {"default": "—",
                           "tooltip": "Твоя оценка — попадёт в файл для нас"}),
                "comment": ("STRING", {"default": "", "tooltip": "Пара слов о результате — попадёт в файл для нас"}),
                "live": ("BOOLEAN", {"default": True,
                                     "tooltip": "Живое окно: крутишь ползунки карточек — сразу видишь кадр"}),
                "live_frame": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.001, "display": "slider",
                                         "tooltip": "Какой момент ролика показывать в живом окне (0 — начало, 1 — конец)"}),
                "live_view": (LIVE_VIEWS, {"default": LIVE_VIEWS[0]}),
            },
            "optional": opt,
        }

    @classmethod
    def IS_CHANGED(cls, **kw):
        try:
            return _source_sig(kw.get("video"), kw.get("video_path", "")) + _sig(
                {k: v for k, v in kw.items() if k != "video" and k not in LIVE_KEYS})
        except Exception:
            return ""

    def run(self, job_name, compare, codec, crf, frames_out, rating, comment, live=True, live_frame=0.5,
            live_view="", video=None, video_path="", **slots):
        t0 = time.time()
        cards, notes = resolve_cards([slots[k] for k in sorted(slots)])
        relay, ran, reused = ensure_stages(job_name, video, video_path, cards)

        # Финиш: точки внимания (если карточка есть) + итоговый файл со звуком
        pts = cards.get("points") or {"eye_sharp": 0.0, "eye_contrast": 0.0, "contour_sharp": 0.0,
                                      "grain": 0.0, "grain_size": 0.7, "seed": 0}
        fin = RelayFinish().run(relay, codec=codec, crf=crf, filename_prefix="pult", **pts)
        relay, final = fin["result"]

        cmp_path = ""
        preview = []
        if compare != NO_COMPARE:
            res = RelayCompare().run(relay, compare, False, True)
            cmp_path = res["result"][0]
            preview = res["ui"]["images"]

        share = self._share_file(relay, cards, notes, rating, comment)
        text = core_journal.render_text(relay)
        head = [f"Пульт: посчитано заново — {', '.join(ran) or 'ничего'}; из памяти — {', '.join(reused) or 'ничего'}"]
        head += notes
        head.append(f"Итог: {final}")
        head.append(f"Отчёт для отправки / report to send: {share}")
        text = "\n".join(head) + "\n\n" + text

        # выходы для сохранения
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        fps = core_io.fps_float(relay["current"].get("fps", v["fps"]))
        last = None
        frames = None
        if frames_out:
            arr = [torch.from_numpy(f) for f in core_io.FrameReader(final, w, h, "yuv", "bt709", "tv")]
            frames = torch.stack(arr).float() if arr else torch.zeros(1, h, w, 3)
            last = frames[-1:].clone()
        else:
            n = relay["current"].get("frames", v["frames"])
            got = core_io.read_frames_at(final, w, h, [max(0, n - 1)], "yuv", "bt709", "tv")
            last = torch.from_numpy(list(got.values())[-1])[None].float() if got else torch.zeros(1, h, w, 3)
            frames = last
        audio = _load_audio(final) if v.get("has_audio") else None
        if audio is None:
            audio = {"waveform": torch.zeros(1, 2, 1), "sample_rate": 48000}

        ui = {"text": [text]}
        if preview:
            ui["images"] = preview
            ui["animated"] = (True,)
        return {"ui": ui, "result": (frames, audio, fps, last, cmp_path, share)}

    def _share_file(self, relay, cards, notes, rating, comment):
        """Обезличенный файл: настройки + паспорт источника. Никаких путей, имён и самого видео."""
        data = core_journal.load(relay)
        v = data["video"]
        rep = data["reports"]
        chain = relay.get("chain", [])

        def st(stage, key):
            r = rep.get(stage) if stage in chain else None
            return None if not r else r.get("stats", {}).get(key)

        passport = {
            "resolution": [v["w"], v["h"]], "fps": v["fps"], "frames": v["frames"],
            "seconds": round(v["frames"] / core_io.fps_float(v["fps"]), 2), "audio": bool(v.get("has_audio")),
            "faces_tracks": st("scout", "tracks"), "faces_coverage": st("scout", "coverage"),
            "flow_confidence": st("flow", "conf_mean"), "motion_px_per_frame": st("flow", "motion_mean"),
            "judge_change": st("judge", "change_mean"), "judge_trust": st("judge", "trust_mean"),
            "edge_gain_pct": st("edge", "edge_gain_pct"), "edge_jitter_pct": st("edge", "boil_delta_pct"),
            "black_breath": st("tone", "black_breath"), "seam_jitter_pct": st("seam", "jitter_delta_pct"),
            "deflicker_max_pct": st("polish", "deflicker_max_pct"),
        }
        job = os.path.basename(relay["job_dir"])
        stem = os.path.splitext(job)[0]

        def clean(text):
            """Убрать пути, имя ролика и папки — файл можно смело пересылать."""
            t = str(text)
            t = re.sub(r"[A-Za-z]:[\\/][^\s,;'\"]*", "<путь>", t)
            t = re.sub(r"(?<![\w<])/(?:[^\s/,;'\"]+/)+[^\s,;'\"]*", "<путь>", t)
            for name in {job, stem}:
                if name and len(name) > 2:
                    t = t.replace(name, "<ролик>")
            return t

        stages = []
        for stg in chain:
            r = rep.get(stg)
            if not r:
                continue
            stages.append({"stage": stg, "title": core_journal.STAGE_TITLES.get(stg, stg),
                           "seconds": r.get("seconds"), "summary": [clean(x) for x in r.get("summary", [])],
                           "settings": data["tasks"].get(stg, {})})
        warnings = [f"{x['title']}: {line}" for x in stages for line in x["summary"] if "⚠" in line]
        stamp = time.strftime("%Y%m%d_%H%M%S")
        out = {"tool": "Perception Relay", "version": VERSION, "date": time.strftime("%Y-%m-%d %H:%M"),
               "rating": rating, "comment": clean(comment), "settings": cards,
               "auto_notes": [clean(x) for x in notes], "source": passport,
               "stages": stages, "warnings": warnings}
        folder = os.path.join(core_comfy.output_dir(), "perception_relay", "для_отправки")
        os.makedirs(folder, exist_ok=True)
        jpath = os.path.join(folder, f"relay_отчёт_{stamp}.json")
        with open(jpath, "w", encoding="utf-8") as f:
            f.write(clean(json.dumps(out, ensure_ascii=False, indent=2)))   # чистим весь файл целиком

        # читаемая версия — чтобы открыть и понять глазами
        L = ["PERCEPTION RELAY — отчёт о прогоне / run report",
             f"Версия {VERSION} · {out['date']}",
             f"Оценка / rating: {rating}" + (f" · {out['comment']}" if out["comment"] else ""), "",
             "ИСТОЧНИК / SOURCE",
             f"  {v['w']}x{v['h']}, {v['fps']} к/с, {v['frames']} кадров ({passport['seconds']} с), "
             f"звук: {'есть' if passport['audio'] else 'нет'}"]
        for k, val in passport.items():
            if k in ("resolution", "fps", "frames", "seconds", "audio") or val is None:
                continue
            L.append(f"  {k}: {round(val, 4) if isinstance(val, float) else val}")
        L += ["", "ПОЛЗУНКИ КАРТОЧЕК / CARD SETTINGS"]
        for stg in ORDER:
            if stg in cards:
                L.append(f"  [{TITLES.get(stg, stg)}]")
                for k, val in cards[stg].items():
                    L.append(f"      {k} = {val}")
        if out["auto_notes"]:
            L += ["", "ПУЛЬТ / PULT"] + [f"  {x}" for x in out["auto_notes"]]
        L += ["", "ЭТАПЫ / STAGES"]
        for x in stages:
            sec = f", {x['seconds']} с" if x.get("seconds") is not None else ""
            L.append(f"  ■ {x['title']}{sec}")
            L += [f"      {line}" for line in x["summary"]]
        if warnings:
            L += ["", "ВНИМАНИЕ / WARNINGS"] + [f"  {w}" for w in warnings]
        L += ["", "Путей, имён файлов и самого видео в отчёте нет — его можно пересылать.",
              "No paths, file names or video in this report — safe to share."]
        tpath = os.path.join(folder, f"relay_отчёт_{stamp}.txt")
        with open(tpath, "w", encoding="utf-8") as f:
            f.write("\n".join(L))
        return tpath
