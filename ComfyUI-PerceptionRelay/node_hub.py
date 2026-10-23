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
import threading
import time

import numpy as np
import torch

from . import core_io, core_journal, core_comfy
from .node_start import RelayStart
from .node_scout import RelayScout
from .node_flow import RelayFlow
from .node_judge import RelayJudge
from .node_refine import RelayRefine
from .node_groups import GROUPS, GROUP_CARDS, expand as expand_group
from .node_edge import RelayEdge
from .node_tone import RelayTone
from .node_seam import RelaySeam
from .node_polish import RelayPolish
from .node_basic import RelayBasic
from .node_finish import RelayFinish
from .node_compare import RelayCompare, LAYOUTS

VERSION = "1.0"
STAGE_TYPE = "PR_STAGE"
ORDER = ["scout", "flow", "judge", "edge", "tone", "seam", "refine", "polish", "basic", "points"]
CLASSES = {"scout": RelayScout, "flow": RelayFlow, "judge": RelayJudge, "refine": RelayRefine, "edge": RelayEdge,
           "tone": RelayTone, "seam": RelaySeam, "polish": RelayPolish, "basic": RelayBasic}
TITLES = {"scout": "Разведка", "flow": "Поток", "judge": "Судья", "refine": "Доводчик", "edge": "Огранка",
          "tone": "Тональный скелет", "seam": "Цветовой шов", "polish": "Полировка", "basic": "Основное",
          "points": "Точки внимания"}
SLOTS = 10
STAGE_EN = {"scout": "Разведка / Scout", "flow": "Поток / Flow", "judge": "Судья / Judge", "edge": "Огранка / Edge",
            "tone": "Скелет / Tone", "seam": "Шов / Seam", "polish": "Полировка / Polish",
            "basic": "Основное / Basic", "refine": "Доводчик / Refiner"}
LIVE_VIEWS = ["after / после", "before / до", "split / шторка", "map / карта доводки"]
LIVE_KEYS = ("live", "live_frame", "live_view", "expert")
NO_COMPARE = "none / не делать"
_STAGES_LOCK = threading.Lock()   # этапы считает кто-то один: основной прогон или подготовка живого окна


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


PULT_REFINE = {"refine_size": "size", "refine_strength": "refine_strength", "refine_model": "gen_model",
               "refine_sensitivity": "sensitivity", "refine_upscale_detail": "upscale_detail", "refine_stick": "stick",
               "refine_protect_edges": "protect_edges", "refine_face_detail": "face_detail", "refine_window": "window"}
PULT_REFINE_MAIN = {"refine_size": "Доводчик · размер / size", "refine_strength": "Доводчик · сила / strength"}
REFINE_MAIN = {"size": "размер / size", "refine_strength": "сила / strength",
               "sensitivity": "чувствительность / sensitivity"}


def _make_card(stage, base, title, desc, mains=None):
    def INPUT_TYPES(cls):
        req = dict(base.INPUT_TYPES()["required"])
        req.pop("relay", None)
        if not mains:
            return {"required": req}
        out = {"expert": ("BOOLEAN", {"default": False, "relay_main": True, "display_name": "⚙ эксперт / expert",
                                      "tooltip": "Показать тонкие настройки. Скрытые всё равно работают.\n\n"
                                                 "EN: Show fine settings. Hidden ones still work."})}
        for k in list(mains) + [k for k in req if k not in mains]:
            spec = req[k]
            opts = dict(spec[1]) if len(spec) > 1 and isinstance(spec[1], dict) else {}
            if k in mains:
                opts.update(relay_main=True, display_name=mains[k])
            else:
                opts["relay_section"] = title
            out[k] = (spec[0], opts) + tuple(spec[2:])
        return {"required": out}

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
    "refine": _make_card("refine", RelayRefine, "Доводчик / Refiner", "Процесс после процесса: сам находит расплывшиеся "
                         "детали и лечит только их генератором (SeedVR2), может увеличить видео. Модель скачивается сама.",
                         REFINE_MAIN),
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
        # один и тот же файл живое окно и основной прогон могут назвать по-разному (слэши, регистр)
        p = os.path.normcase(os.path.abspath(p))
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


def _stage_spec(stage):
    if stage == "points":
        return PointsCard.INPUT_TYPES()["required"]
    return {k: v for k, v in CLASSES[stage].INPUT_TYPES()["required"].items() if k != "relay"}


def normalize_params(stage, params):
    """Ползунки к одному виду, откуда бы они ни пришли.

    Живое окно берёт значения из браузера (там 2.0 превращается в 2), основной прогон —
    из Comfy (там 2.0). Для памяти Пульта это были «разные настройки», и основной прогон
    пересчитывал Поток заново поверх файлов, которые держит окно. Теперь вид один.
    """
    try:
        spec = _stage_spec(stage)
    except Exception:
        return dict(params)
    out = {}
    for k, sp in spec.items():
        kind = sp[0]
        opts = sp[1] if len(sp) > 1 and isinstance(sp[1], dict) else {}
        v = params.get(k, opts.get("default", kind[0] if isinstance(kind, (list, tuple)) and kind else None))
        try:
            if isinstance(kind, (list, tuple)):
                v = str(v)
            elif kind == "FLOAT":
                v = float(v)
            elif kind == "INT":
                v = int(round(float(v)))
            elif kind == "BOOLEAN":
                v = (v.strip().lower() in ("true", "1", "yes")) if isinstance(v, str) else bool(v)
            elif kind == "STRING":
                v = "" if v is None else str(v)
        except Exception:
            pass
        out[k] = v
    return out


def stage_order(cards):
    """Порядок этапов. Доводчик — перед Полировкой: генератор рисует только настоящие кадры, а полукадры
    плавности ×2 Полировка строит уже из доведённых (иначе работы генератору вдвое больше).
    Зерно и точки внимания — в Финише, после всех."""
    return list(ORDER)


def resolve_cards(card_list):
    """Карточки из входов → {этап: параметры} + помощники, без которых этапы не работают."""
    notes = []
    cards = {}
    for c in card_list:
        if not isinstance(c, dict):
            continue
        if c.get("stage") in GROUPS:          # карточка-группа → её этапы
            parts = expand_group(c["stage"], c.get("params") or {})
        elif c.get("stage") in ORDER:
            parts = {c["stage"]: c.get("params") or {}}
        else:
            continue
        for stage, params in parts.items():
            if stage in cards:
                notes.append(f"Этап «{TITLES[stage]}» подключён дважды (двумя карточками) — взята последняя")
            cards[stage] = normalize_params(stage, params)
    heavy = any(s in cards for s in ("judge", "edge", "tone", "seam", "polish"))
    if heavy and "flow" not in cards:
        cards["flow"] = normalize_params("flow", defaults(RelayFlow))
        notes.append("Поток добавлен автоматически (нужен Судье и сверкам во времени)")
    need_scout = ("points" in cards or "judge" in cards or cards.get("refine", {}).get("face_detail", 1) < 1 or
                  cards.get("tone", {}).get("face_fill", 0) > 0 or cards.get("edge", {}).get("skip_faces"))
    if need_scout and "scout" not in cards:
        cards["scout"] = normalize_params("scout", defaults(RelayScout))
        notes.append("Разведка добавлена автоматически (нужна точкам внимания и защите лиц)")
    return cards, notes


def ensure_stages(job_name, video, video_path, cards, only=None):
    """Прогоняет этапы по порядку с памятью (hub_cache.json). only — посчитать только эти этапы
    (для подготовки живого окна: Разведка и Поток). Память общая с полным прогоном Пульта.

    Одновременно считает кто-то один: если окно ещё готовится, основной прогон дождётся его
    и возьмёт готовое из памяти, а не будет считать то же самое параллельно."""
    with _STAGES_LOCK:
        return _ensure_stages(job_name, video, video_path, cards, only)


def _release_live(job_dir):
    """Перед пересчётом этапа — попросить живое окно отпустить файлы этой задачи."""
    if getattr(core_comfy.LOCAL, "live", False):
        return   # это и есть подготовка окна — отпускать нечего
    try:
        from . import core_live
        core_live.release_job(job_dir)
    except Exception as e:
        print(f"[PerceptionRelay] не удалось отпустить файлы живого окна: {e}")


def _ensure_stages(job_name, video, video_path, cards, only=None):
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
        if probe_name:
            _release_live(os.path.join(core_comfy.output_dir(), "perception_relay", _safe(probe_name)))
        core_comfy.stage("Старт / Start")
        relay, = RelayStart().run(job_name, video, video_path)
        cache = {"start": {"sig": start_sig, "relay": relay}}
        reused = []
        cache_path = os.path.join(relay["job_dir"], "hub_cache.json")
    prev = start_sig
    ran = []
    order = stage_order(cards)
    for stage in order:
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
            _release_live(relay["job_dir"])
            core_comfy.stage(STAGE_EN.get(stage, TITLES[stage]))
            relay, = CLASSES[stage]().run(relay, **params)
            cache[stage] = {"sig": sig, "relay": relay}
            ran.append(TITLES[stage])
            for later in order[order.index(stage) + 1:]:
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
        from .i18n import EN
        opt = {"video": ("VIDEO", {"tooltip": "Стандартная нода Load Video"}),
               "video_path": ("STRING", {"default": "", "tooltip": "Запасной вариант: путь к файлу",
                                         "relay_section": "Пульт / Pult"})}
        for i in range(1, SLOTS + 1):
            opt[f"этап_{i}"] = (STAGE_TYPE, {"tooltip": "Любая карточка этапа — порядок пульт наведёт сам"})

        def main(label, **o):
            return dict(o, relay_main=True, display_name=label)

        req = {
            "expert": ("BOOLEAN", main("⚙ эксперт / expert", default=False,
                       tooltip="Показать все настройки Пульта и Доводчика. Скрытые всё равно работают.\n\n"
                               "EN: Show every Pult and Refiner setting. Hidden ones still work.")),
            "refine": ("BOOLEAN", main("🛠 Доводчик / Refiner", default=False,
                       tooltip="Процесс после процесса: генератор (SeedVR2) дорисовывает мелкие детали и может "
                               "увеличить видео. Долго, но заметно детальнее. Выключено — как раньше, быстро. "
                               "Модель скачается сама при первом включении.\n\nEN: Refiner — the generator draws "
                               "fine detail and can upscale. Slow but more detailed. Off = fast as before.")),
        }
        rspec = RelayRefine.INPUT_TYPES()["required"]
        for pname, rname in PULT_REFINE.items():
            spec = rspec[rname]
            o = dict(spec[1]) if len(spec) > 1 and isinstance(spec[1], dict) else {}
            en = EN.get(rname)
            if en and "EN:" not in o.get("tooltip", ""):
                o["tooltip"] = o.get("tooltip", "") + "\n\nEN: " + en
            o["relay_requires"] = "refine"
            if pname in PULT_REFINE_MAIN:
                o.update(relay_main=True, display_name=PULT_REFINE_MAIN[pname])
            else:
                o.update(relay_section="Доводчик / Refiner", display_name="Доводчик · " + rname)
            req[pname] = (spec[0], o)
            if pname == "refine_strength":       # главное Пульта — сразу после главного Доводчика
                req["compare"] = (LAYOUTS + [NO_COMPARE], main("сравнение / compare", default=LAYOUTS[0],
                                  tooltip="Видео «исходник | результат» для сравнения в движении.\n\nEN: " + EN["compare"]))
                req["live"] = ("BOOLEAN", main("живое окно / live", default=True,
                               tooltip="Живое окно: крутишь ползунки карточек — сразу видишь кадр\n\nEN: " + EN["live"]))
                req["live_frame"] = ("FLOAT", main("момент ролика / moment", default=0.5, min=0.0, max=1.0,
                                     step=0.001, display="slider",
                                     tooltip="Какой момент ролика показывать в живом окне (0 — начало, 1 — конец)"
                                             "\n\nEN: " + EN["live_frame"]))
                req["live_view"] = (LIVE_VIEWS, main("вид окна / view", default=LIVE_VIEWS[0],
                                    tooltip="После / до / шторка / карта Доводчика\n\nEN: " + EN["live_view"]))
        sec = {"relay_section": "Пульт / Pult"}
        req["job_name"] = ("STRING", dict(sec, default="", tooltip="Имя задачи. Пусто — по имени файла"))
        req["codec"] = (["h264", "h265 10bit"], dict(sec, default="h264"))
        req["crf"] = ("INT", dict(sec, default=16, min=0, max=40))
        req["frames_out"] = ("BOOLEAN", dict(sec, default=True,
                             tooltip="Отдавать кадры на выход (для Video Combine). На длинных видео это много "
                                     "памяти — можно выключить, итог всё равно сохраняется файлом"))
        req["rating"] = (["—", "great / отлично", "good / хорошо", "so-so / так себе", "bad / плохо"],
                         dict(sec, default="—", tooltip="Твоя оценка — попадёт в файл для нас"))
        req["comment"] = ("STRING", dict(sec, default="", tooltip="Пара слов о результате — попадёт в файл для нас"))
        # порядок: сначала главное Доводчика, потом главное Пульта, потом тонкие
        order = ["expert", "refine", "refine_size", "refine_strength", "compare", "live", "live_frame", "live_view"]
        ordered = {k: req[k] for k in order}
        ordered.update({k: v for k, v in req.items() if k not in ordered})
        return {"required": ordered, "optional": opt}

    @classmethod
    def IS_CHANGED(cls, **kw):
        try:
            return _source_sig(kw.get("video"), kw.get("video_path", "")) + _sig(
                {k: v for k, v in kw.items() if k != "video" and k not in LIVE_KEYS})
        except Exception:
            return ""

    def run(self, job_name, compare, codec, crf, frames_out, rating, comment, live=True, live_frame=0.5,
            live_view="", video=None, video_path="", expert=False, refine=False, **kw):
        t0 = time.time()
        slots = {k: v for k, v in kw.items() if k.startswith("этап_")}
        cards, notes = resolve_cards([slots[k] for k in sorted(slots, key=lambda x: int(x.split("_")[1]))])
        if refine:                       # Доводчик, встроенный в Пульт (выключатель «с Доводчиком / без»)
            if "refine" in cards:
                notes.append("Доводчик включён и в Пульте, и отдельной карточкой — взяты настройки Пульта")
            cards["refine"] = normalize_params("refine", {r: kw[p] for p, r in PULT_REFINE.items() if p in kw})
        relay, ran, reused = ensure_stages(job_name, video, video_path, cards)

        # Финиш: точки внимания (если карточка есть) + итоговый файл со звуком
        pts = cards.get("points") or {"eye_sharp": 0.0, "eye_contrast": 0.0, "contour_sharp": 0.0,
                                      "grain": 0.0, "grain_size": 0.7, "seed": 0}
        core_comfy.stage("Финиш / Finish")
        fin = RelayFinish().run(relay, codec=codec, crf=crf, filename_prefix="pult", **pts)
        relay, final = fin["result"]

        cmp_path = ""
        preview = []
        if compare != NO_COMPARE:
            core_comfy.stage("Сравнение / Compare")
            res = RelayCompare().run(relay, compare, False, True)
            cmp_path = res["result"][0]
            preview = res["ui"]["images"]

        share = self._share_file(relay, cards, notes, rating, comment)
        text = core_journal.render_text(relay)
        head = [f"Пульт: посчитано заново — {', '.join(ran) or 'ничего'}; из памяти — {', '.join(reused) or 'ничего'}"]
        head += notes
        head.append(f"Итог: {final}")
        head.append(f"Отчёт для отправки / report to send: {share}")
        head.append(f"Рабочая папка / work folder: {relay['job_dir']} — если ролик больше не нужен, её можно удалить "
                    f"(готовые видео лежат рядом и не пострадают) / if the clip is no longer needed you can delete it "
                    f"(final videos are next to it and stay safe)")
        text = "\n".join(head) + "\n\n" + text

        # выходы для сохранения
        v = core_journal.video(relay)
        w, h = core_journal.size(relay)
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

        try:                                     # лишние файлы этапов этой задачи / unused stage files
            from . import core_cleanup
            core_cleanup.prune_unused_stages(relay["job_dir"])
        except Exception as e:
            print(f"[PerceptionRelay] уборка пропущена / cleanup skipped: {e}")

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
            "refine_area_pct": st("refine", "area_pct"), "refine_added": st("refine", "added"),
            "refine_boil_cut_pct": st("refine", "boil_cut_pct"), "refine_out_size": st("refine", "out_size"),
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
        for stg in stage_order(cards):
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
