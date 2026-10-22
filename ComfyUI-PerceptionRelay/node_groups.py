# -*- coding: utf-8 -*-
"""Карточки-группы: вместо 10 карточек — 4. Каждая собирает несколько этапов по смыслу.

  ⚖ Стабилизация  = Судья + Поток
  🖼 Картинка     = Огранка + Тональный скелет + Цветовой шов + Основное
  🎬 Движение и лицо = Полировка + Точки внимания + Разведка
  🛠 Доводчик     — своя карточка (node_refine)

Главные ползунки видны всегда; тонкие — под переключателем «эксперт». Скрытые ползунки
всё равно работают — эксперт их только показывает. Пульт раскладывает карточку обратно
на этапы (expand), поэтому расчёты и память Пульта — те же, что у старых карточек.
"""
from .node_scout import RelayScout
from .node_flow import RelayFlow
from .node_judge import RelayJudge
from .node_edge import RelayEdge
from .node_tone import RelayTone
from .node_seam import RelaySeam
from .node_polish import RelayPolish
from .node_basic import RelayBasic
from .node_finish import RelayFinish
from .i18n import EN

STAGE_TYPE = "PR_STAGE"
EXPERT = "expert"

SECTION = {"judge": "Судья / Judge", "flow": "Поток / Flow", "edge": "Огранка / Edge",
           "tone": "Скелет / Tone", "seam": "Шов / Seam", "basic": "Основное / Basic",
           "polish": "Полировка / Polish", "points": "Точки / Points", "scout": "Разведка / Scout"}

POINTS_KEYS = ["eye_sharp", "eye_contrast", "contour_sharp", "grain", "grain_size", "seed"]


def _spec(stage):
    if stage == "points":
        req = RelayFinish.INPUT_TYPES()["required"]
        return {k: req[k] for k in POINTS_KEYS}
    cls = {"judge": RelayJudge, "flow": RelayFlow, "edge": RelayEdge, "tone": RelayTone, "seam": RelaySeam,
           "basic": RelayBasic, "polish": RelayPolish, "scout": RelayScout}[stage]
    return {k: v for k, v in cls.INPUT_TYPES()["required"].items() if k != "relay"}


# main: (этап, параметр, подпись на двух языках) — видны всегда
# toggles: этапы, которые эксперт может выключить внутри карточки
GROUPS = {
    "stabilize": {
        "parts": ["judge", "flow"],
        "main": [("judge", "strength_mid", "сила стабилизации / stabilize strength"),
                 ("judge", "face_keep", "сила на лицах / on faces")],
        "toggles": [],
        "title": "⚖ Stabilize / Стабилизация",
        "desc": "Убирает ползущие псевдодетали (дрейф): Судья + Поток. Removes crawling pseudo-detail.",
    },
    "picture": {
        "parts": ["edge", "tone", "seam", "basic"],
        "main": [("edge", "strength", "резкость краёв / edge sharpness"),
                 ("tone", "black_density", "глубина чёрного / black depth"),
                 ("basic", "brightness", "яркость / brightness"),
                 ("basic", "contrast", "контраст / contrast"),
                 ("basic", "saturation", "насыщенность / saturation")],
        "toggles": ["edge", "tone", "seam"],
        "title": "🖼 Picture / Картинка",
        "desc": "Резкость скелета, тени и чёрное, чистые цветовые границы, яркость и контраст. "
                "Edges, shadows, clean colour borders, brightness and contrast.",
    },
    "motion": {
        "parts": ["polish", "points", "scout"],
        "main": [("polish", "smoothness", "плавность / smoothness"),
                 ("polish", "deflicker", "убрать мерцание / deflicker"),
                 ("points", "eye_sharp", "резкость глаз / eye sharpness")],
        "toggles": ["polish", "points"],
        "title": "🎬 Motion & face / Движение и лицо",
        "desc": "Плавность и мерцание, глаза и контур лица, поиск лиц. Smoothness, flicker, eyes, face search.",
    },
}


def widget_map(group):
    """[(имя_виджета, этап, параметр)] в порядке показа: главные, потом этапы по порядку."""
    g = GROUPS[group]
    used, out = set(), []
    mains = {(s, p) for s, p, _ in g["main"]}
    for s, p, _ in g["main"]:
        used.add(p)
        out.append((p, s, p))
    for s in g["parts"]:
        if s in g["toggles"]:
            out.append((f"use_{s}", s, None))
        for p in _spec(s):
            if (s, p) in mains:
                continue
            name = p if p not in used else f"{s}_{p}"
            used.add(name)
            out.append((name, s, p))
    return out


def expand(group, params):
    """Значения карточки-группы → {этап: параметры} (выключенные экспертом этапы — пропущены)."""
    out = {}
    g = GROUPS[group]
    for name, s, p in widget_map(group):
        if p is None:
            continue
        if params.get(f"use_{s}", True) is False:
            continue
        if name in params:
            out.setdefault(s, {})[p] = params[name]
        else:
            out.setdefault(s, {})
    for s in g["toggles"]:
        if params.get(f"use_{s}", True) is False:
            out.pop(s, None)
    # Основное с нейтральными значениями — пустой проход по всему видео, пропускаем
    b = out.get("basic")
    if b is not None and abs(b.get("brightness", 0)) < 1e-6 and abs(b.get("contrast", 0)) < 1e-6 \
            and abs(b.get("sharpness", 0)) < 1e-6 and abs(b.get("saturation", 1) - 1) < 1e-6:
        out.pop("basic")
    return out


def _input_types(group):
    g = GROUPS[group]
    labels = {(s, p): lab for s, p, lab in g["main"]}
    req = {EXPERT: ("BOOLEAN", {"default": False, "relay_main": True, "display_name": "⚙ эксперт / expert",
                                "tooltip": "Показать тонкие настройки всех этапов карточки. Скрытые настройки всё "
                                           "равно работают — эксперт их только показывает.\n\nEN: Show the fine "
                                           "settings of every stage. Hidden settings still work."})}
    specs = {s: _spec(s) for s in g["parts"]}
    for name, s, p in widget_map(group):
        if p is None:
            req[name] = ("BOOLEAN", {"default": True, "relay_section": SECTION[s],
                                     "display_name": f"▣ {SECTION[s]}: вкл / on",
                                     "tooltip": f"Включить этап «{SECTION[s]}» внутри карточки.\n\n"
                                                f"EN: Turn the {SECTION[s].split(' / ')[1]} stage on/off."})
            continue
        spec = specs[s][p]
        opts = dict(spec[1]) if len(spec) > 1 and isinstance(spec[1], dict) else {}
        en = EN.get(p)
        if en and "EN:" not in opts.get("tooltip", ""):
            tip = opts.get("tooltip", "")
            opts["tooltip"] = (tip + "\n\nEN: " + en) if tip else "EN: " + en
        if (s, p) in labels:
            opts["relay_main"] = True
            opts["display_name"] = labels[(s, p)]
        else:
            opts["relay_section"] = SECTION[s]
            opts["display_name"] = f"{SECTION[s].split(' / ')[0]} · {p}"
        req[name] = (spec[0], opts) + tuple(spec[2:])
    return {"required": req}


def _make(group):
    def INPUT_TYPES(cls):
        return _input_types(group)

    def run(self, **kw):
        return ({"stage": group, "params": kw},)

    g = GROUPS[group]
    return type(f"Group_{group}", (), {
        "CATEGORY": "Эстафета восприятия", "FUNCTION": "run",
        "RETURN_TYPES": (STAGE_TYPE,), "RETURN_NAMES": ("в пульт",),
        "DESCRIPTION": g["desc"] + " Втыкается в Пульт одним проводом. / One wire into the Pult.",
        "INPUT_TYPES": classmethod(INPUT_TYPES), "run": run})


GROUP_CARDS = {k: _make(k) for k in GROUPS}
