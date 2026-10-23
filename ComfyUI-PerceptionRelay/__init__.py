# -*- coding: utf-8 -*-
"""Perception Relay / Эстафета восприятия — video post-processing that works with the viewer's brain,
not with pixels. Постобработка видео: не «улучшение пикселей», а работа на мозг зрителя.

Main way / основной способ: 🎛 Pult + stage cards (one wire each) with a live window.
Expert chain / цепочка для экспертов: Start → … → Finish.
"""
from .node_start import RelayStart
from .node_scout import RelayScout
from .node_flow import RelayFlow
from .node_judge import RelayJudge
from .node_refine import RelayRefine
from .node_edge import RelayEdge
from .node_tone import RelayTone
from .node_seam import RelaySeam
from .node_polish import RelayPolish
from .node_basic import RelayBasic
from .node_finish import RelayFinish
from .node_tools import RelayJournal, RelayPreview
from .node_compare import RelayCompare
from . import i18n

_CHAIN = (RelayStart, RelayScout, RelayFlow, RelayJudge, RelayEdge, RelayTone, RelaySeam,
          RelayPolish, RelayBasic, RelayRefine, RelayFinish, RelayJournal, RelayPreview, RelayCompare)
i18n.apply(_CHAIN)          # сначала база — карточки наследуют двуязычные подсказки
for _c in _CHAIN:
    _c.CATEGORY = i18n.CATEGORY_EXPERT

from .node_hub import RelayHub, CARDS, PointsCard, GROUP_CARDS  # noqa: E402

_PULT = (RelayHub,) + tuple(GROUP_CARDS.values())
_LEGACY = (PointsCard,) + tuple(CARDS.values())      # Доводчик теперь внутри Пульта — карточка тоже в «старых»
i18n.apply(_PULT + _LEGACY)
for _c in _PULT:
    _c.CATEGORY = i18n.CATEGORY
for _c in _LEGACY:      # старые карточки по одному этапу: работают, но в меню — отдельно
    _c.CATEGORY = i18n.CATEGORY_LEGACY

NODE_CLASS_MAPPINGS = {
    # pult and cards / пульт и карточки
    "PerceptionRelayHub": RelayHub,
    "PerceptionRelayCardStabilize": GROUP_CARDS["stabilize"],
    "PerceptionRelayCardPicture": GROUP_CARDS["picture"],
    "PerceptionRelayCardMotion": GROUP_CARDS["motion"],
    "PerceptionRelayCardScout": CARDS["scout"],
    "PerceptionRelayCardFlow": CARDS["flow"],
    "PerceptionRelayCardJudge": CARDS["judge"],
    "PerceptionRelayCardEdge": CARDS["edge"],
    "PerceptionRelayCardTone": CARDS["tone"],
    "PerceptionRelayCardSeam": CARDS["seam"],
    "PerceptionRelayCardPolish": CARDS["polish"],
    "PerceptionRelayCardBasic": CARDS["basic"],
    "PerceptionRelayCardRefine": CARDS["refine"],
    "PerceptionRelayCardPoints": PointsCard,
    # expert chain / цепочка для экспертов
    "PerceptionRelayStart": RelayStart,
    "PerceptionRelayScout": RelayScout,
    "PerceptionRelayFlow": RelayFlow,
    "PerceptionRelayJudge": RelayJudge,
    "PerceptionRelayEdge": RelayEdge,
    "PerceptionRelayTone": RelayTone,
    "PerceptionRelaySeam": RelaySeam,
    "PerceptionRelayPolish": RelayPolish,
    "PerceptionRelayBasic": RelayBasic,
    "PerceptionRelayRefine": RelayRefine,
    "PerceptionRelayFinish": RelayFinish,
    "PerceptionRelayJournal": RelayJournal,
    "PerceptionRelayPreview": RelayPreview,
    "PerceptionRelayCompare": RelayCompare,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PerceptionRelayHub": "🎛 Pult · live preview / Пульт · живой предпросмотр",
    "PerceptionRelayCardStabilize": "⚖ Stabilize / Стабилизация",
    "PerceptionRelayCardPicture": "🖼 Picture / Картинка",
    "PerceptionRelayCardMotion": "🎬 Motion & face / Движение и лицо",
    "PerceptionRelayCardScout": "👁 Scout (faces) / Разведка",
    "PerceptionRelayCardFlow": "🌊 Flow (motion) / Поток",
    "PerceptionRelayCardJudge": "⚖ Judge (drift) / Судья",
    "PerceptionRelayCardEdge": "💎 Edge cut / Огранка",
    "PerceptionRelayCardTone": "🌑 Tone skeleton / Тональный скелет",
    "PerceptionRelayCardSeam": "🎨 Colour seam / Цветовой шов",
    "PerceptionRelayCardPolish": "✨ Polish / Полировка",
    "PerceptionRelayCardBasic": "🎚 Basic: brightness, contrast, sharpness / Основное",
    "PerceptionRelayCardRefine": "🛠 Refiner / Доводчик",
    "PerceptionRelayCardPoints": "🎯 Attention points / Точки внимания",
    "PerceptionRelayStart": "🎬 1. Start / Старт",
    "PerceptionRelayScout": "👁 2. Scout / Разведка",
    "PerceptionRelayFlow": "🌊 3. Flow / Поток",
    "PerceptionRelayJudge": "⚖ 4. Judge / Судья",
    "PerceptionRelayEdge": "💎 4½. Edge cut / Огранка",
    "PerceptionRelayTone": "🌑 Tone skeleton (chain) / Тональный скелет",
    "PerceptionRelaySeam": "🎨 Colour seam (chain) / Цветовой шов",
    "PerceptionRelayPolish": "✨ 4¾. Polish / Полировка",
    "PerceptionRelayBasic": "🎚 Basic (chain) / Основное",
    "PerceptionRelayRefine": "🛠 Refiner (chain) / Доводчик",
    "PerceptionRelayFinish": "🏁 5. Finish / Финиш",
    "PerceptionRelayJournal": "📓 Journal / Журнал",
    "PerceptionRelayPreview": "🖼 Frames preview / Превью кадров",
    "PerceptionRelayCompare": "🎞 Compare video / Сравнение",
}

try:
    from .core_live import register_routes
    register_routes()
except Exception as _e:  # без сервера Comfy (тесты) — просто нет живого окна
    print(f"[PerceptionRelay] live window unavailable / живое окно недоступно: {_e}")

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
