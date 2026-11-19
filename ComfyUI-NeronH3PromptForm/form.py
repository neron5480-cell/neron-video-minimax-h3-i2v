# -*- coding: utf-8 -*-
"""Склейка бланка в один промпт. Та же логика — в web/prompt_form.js (предпросмотр на ноде).
Меняешь здесь — поменяй и там (тест test_form.py сверяет обе).

EN: Joins the form into one prompt. The same logic lives in web/prompt_form.js (live preview);
keep both in sync (test_form.py compares them)."""
import json
import re

SECTIONS = ["place", "heroes", "action", "camera", "sound", "speech", "music", "pictures"]

LINKS = {
    "RU": {"hero1": "В кадре: ", "heroN": "Также в кадре: ", "first": "Сначала: ", "then": "Затем: ",
           "last": "В конце: ", "camera": "Камера: ", "sound": "Звук сцены: ", "speech": "Речь: ",
           "music": "Музыка: ", "no_music": "Без музыки.", "pictures": "Образцы: ",
           "camera_word": ("камер",)},
    "EN": {"hero1": "In the frame: ", "heroN": "Also in the frame: ", "first": "First: ", "then": "Then: ",
           "last": "Finally: ", "camera": "Camera: ", "sound": "Scene sound: ", "speech": "Speech: ",
           "music": "Music: ", "no_music": "No music.", "pictures": "References: ",
           "camera_word": ("camera",)},
}

_BULLET = re.compile(r"^\s*(?:\d{1,2}\s*[).]|[-–—•*])\s+")
_TIME = re.compile(r"^\s*\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:с|сек|s|sec)(?!\w)", re.I)
_TAG = re.compile(r"<\s*(?:картинка|картинке|изображение|фото|picture|image|pic|img)\s*(\d+)\s*>", re.I)
_END = ".!?…"


def end(s):
    """Предложение с точкой в конце (если знака ещё нет, в том числе перед закрывающей кавычкой)."""
    s = s.strip()
    if not s:
        return s
    if s[-1] in _END:
        return s
    if s[-1] in "»\"”)'" and len(s) > 1 and s[-2] in _END:
        return s
    return s + "."


def lines(text):
    out = []
    for ln in str(text or "").replace("\r", "").split("\n"):
        ln = _BULLET.sub("", ln).strip()
        if ln:
            out.append(ln)
    return out


def tags(text):
    """<Картинка 1>, <image 2>… → <Picture N> — так энкодер H3 узнаёт образцы."""
    return _TAG.sub(lambda m: f"<Picture {m.group(1)}>", text)


_CYR = re.compile(r"[а-яё]", re.I)
_LAT = re.compile(r"[a-z]", re.I)


def text_lang(data):
    """Язык связок — по самому тексту: кириллицы больше — RU, латиницы — EN. Нет букв — язык надписей ноды.
    Так плашка RU / EN меняет только надписи, а промпт не превращается в смесь языков."""
    allt = " ".join(str(data.get(k) or "") for k in SECTIONS)
    allt = _TAG.sub(" ", allt)
    cyr, lat = len(_CYR.findall(allt)), len(_LAT.findall(allt))
    if cyr or lat:
        return "RU" if cyr >= lat else "EN"
    return "EN" if str(data.get("lang", "RU")).upper() == "EN" else "RU"


SEC_MIN, SEC_MAX, SEC_DEFAULT = 1, 15, 5


def seconds(data):
    try:
        v = int(round(float(data.get("seconds", SEC_DEFAULT))))
    except Exception:
        v = SEC_DEFAULT
    return max(SEC_MIN, min(SEC_MAX, v))


def duration_line(n, lang):
    """Длительность — в начало промпта: движки любят, когда им говорят время ролика."""
    if lang == "EN":
        return f"Video duration: {n} second{'' if n == 1 else 's'} (0–{n} s)."
    word = "секунда" if n % 10 == 1 and n % 100 != 11 else \
        "секунды" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "секунд"
    return f"Длительность ролика — {n} {word} (0–{n} с)."


def compile_form(data):
    """data — dict бланка: lang, links, no_music и тексты участков. → готовый промпт (str)."""
    lang = text_lang(data)
    L = LINKS[lang]
    use_links = data.get("links", True) is not False
    no_music = data.get("no_music", True) is not False
    f = {k: lines(data.get(k, "")) for k in SECTIONS}
    parts = []

    def joined(ls):
        return " ".join(end(x) for x in ls)

    if f["place"]:
        parts.append(joined(f["place"]))
    if f["heroes"]:
        if use_links:
            parts.append(" ".join(end((L["hero1"] if i == 0 else L["heroN"]) + h) for i, h in enumerate(f["heroes"])))
        else:
            parts.append(joined(f["heroes"]))
    if f["action"]:
        a = f["action"]
        if not use_links or len(a) == 1 or any(_TIME.match(x) for x in a):
            parts.append(joined(a))
        else:
            out = []
            for i, x in enumerate(a):
                pre = L["first"] if i == 0 else L["last"] if i == len(a) - 1 else L["then"]
                out.append(end(pre + x))
            parts.append(" ".join(out))
    for key in ("camera", "sound", "speech", "music", "pictures"):
        ls = f[key]
        if not ls:
            continue
        text = joined(ls)
        if use_links:
            if key == "camera" and text.lower().startswith(L["camera_word"]):
                parts.append(text)
                continue
            text = L[key] + text
        parts.append(text)
    if use_links and no_music and not f["music"] and parts:
        parts.append(L["no_music"])
    if parts and data.get("time", True) is not False:
        parts.insert(0, duration_line(seconds(data), lang))
    return tags(" ".join(parts)).strip()


def parse(raw):
    """Значение скрытого поля ноды → dict. Не JSON (старый процесс, ручной ввод) — весь текст как «Действие»."""
    raw = str(raw or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {"action": raw, "links": False}
