# -*- coding: utf-8 -*-
"""Склейка бланка в один промпт. Та же логика — в web/prompt_form.js (предпросмотр на ноде).
Меняешь здесь — поменяй и там (тест test_form.py сверяет обе).

Два формата (⚙ эксперт):
  • «h3» (по умолчанию) — родной формат H3: служебные поля (summary, subject_definitions,
    integrated_multimodal_description, overall_soundscape, non_diegetic_music) по-английски, содержимое — как
    написано. Реплики — только через (S1) <d>…</d>; нет реплик — нет <d>. Музыки нет — N/A.
  • «text» — простой связный текст со связками («В кадре:», «Камера:»…).

EN: Joins the form into one prompt. The same logic lives in web/prompt_form.js (live preview);
keep both in sync (test_form.py compares them). Formats: native H3 fields (default) or plain text."""
import json
import re

SECTIONS = ["place", "heroes", "action", "camera", "sound", "speech", "music", "pictures"]

LINKS = {
    "RU": {"hero1": "В кадре: ", "heroN": "Также в кадре: ", "first": "Сначала: ", "then": "Затем: ",
           "last": "В конце: ", "camera": "Камера: ", "sound": "Звук сцены: ", "speech": "Речь: ",
           "music": "Музыка: ", "no_music": "Без музыки.", "pictures": "Образцы: ",
           "camera_word": ("камер",), "is": " — ", "static": "Камера неподвижна.",
           "no_speech": "Голосов и речи нет."},
    "EN": {"hero1": "In the frame: ", "heroN": "Also in the frame: ", "first": "First: ", "then": "Then: ",
           "last": "Finally: ", "camera": "Camera: ", "sound": "Scene sound: ", "speech": "Speech: ",
           "music": "Music: ", "no_music": "No music.", "pictures": "References: ",
           "camera_word": ("camera",), "is": " is ", "static": "The camera remains static.",
           "no_speech": "No voices or speech."},
}

_BULLET = re.compile(r"^\s*(?:\d{1,2}\s*[).]|[-–—•*])\s+")
_TIME = re.compile(r"^\s*\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:с|сек|s|sec)(?!\w)", re.I)
_TAG = re.compile(r"<\s*(?:картинка|картинке|изображение|фото|picture|image|pic|img)\s*(\d+)\s*>", re.I)
_QUOTE = re.compile(r"«([^»]*)»|“([^”]*)”|\"([^\"]*)\"")
_END = ".!?…"
_NEG = {"нет", "не", "без", "ничего", "никакой", "никакая", "никакой музыки", "без музыки", "без речи", "тишина",
        "no", "none", "nothing", "n/a", "na", "-", "—", "–", "0"}


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


def negative(ls):
    """«нет», «no», «-» и т. п. — участок пуст, но человек явно сказал «не надо»."""
    t = " ".join(ls).strip().lower().strip(".!…,; ")
    return t in _NEG


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
FPS = 24


def seconds(data):
    try:
        v = int(round(float(data.get("seconds", SEC_DEFAULT))))
    except Exception:
        v = SEC_DEFAULT
    return max(SEC_MIN, min(SEC_MAX, v))


def grid_frames(sec):
    """Кадры, как их считает движок: сетка модели 17k+5 при 24 к/с, вверх (5 с → 124, 10 с → 243)."""
    n = max(5, sec * FPS)
    while n % 17 != 5:
        n += 1
    return n


def grid_seconds_text(sec):
    """Длина ролика по сетке кадров с двумя знаками: 5 → «5.17», 10 → «10.13» (целочисленно, без ошибок округления)."""
    c = (grid_frames(sec) * 200 + FPS) // (2 * FPS)
    return f"{c // 100}.{c % 100:02d}"


def duration_line(n, lang):
    """Длительность — в начало промпта: движки любят, когда им говорят время ролика."""
    if lang == "EN":
        return f"Video duration: {n} second{'' if n == 1 else 's'} (0–{n} s)."
    word = "секунда" if n % 10 == 1 and n % 100 != 11 else \
        "секунды" if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14) else "секунд"
    return f"Длительность ролика — {n} {word} (0–{n} с)."


def dialogue(line, k):
    """Реплика в формате H3: (S1) …, слова в кавычках → <d>слова</d> (кавычки H3 рисует субтитрами)."""
    if _QUOTE.search(line):
        body = _QUOTE.sub(lambda m: "<d>" + next(g for g in m.groups() if g is not None).strip() + "</d>", line)
    else:
        body = line
    return f"(S{k}) " + end(body)


def _joined(ls):
    return " ".join(end(x) for x in ls)


def compile_text(data, f, lang):
    L = LINKS[lang]
    use_links = data.get("links", True) is not False
    no_music = data.get("no_music", True) is not False
    no_speech = data.get("no_speech", True) is not False
    parts = []
    if f["place"]:
        parts.append(_joined(f["place"]))
    if f["heroes"]:
        if use_links:
            parts.append(" ".join(end((L["hero1"] if i == 0 else L["heroN"]) + h) for i, h in enumerate(f["heroes"])))
        else:
            parts.append(_joined(f["heroes"]))
    if f["action"]:
        a = f["action"]
        if not use_links or len(a) == 1 or any(_TIME.match(x) for x in a):
            parts.append(_joined(a))
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
        text = _joined(ls)
        if use_links:
            if key == "camera" and text.lower().startswith(L["camera_word"]):
                parts.append(text)
                continue
            text = L[key] + text
        parts.append(text)
    if use_links and no_speech and not f["speech"] and parts:
        parts.append(L["no_speech"])
    if use_links and no_music and not f["music"] and parts:
        parts.append(L["no_music"])
    if parts and data.get("time", True) is not False:
        parts.insert(0, duration_line(seconds(data), lang))
    return " ".join(parts)


def compile_h3(data, f, lang):
    L = LINKS[lang]
    no_music = data.get("no_music", True) is not False
    no_speech = data.get("no_speech", True) is not False
    if not any(f[k] for k in ("place", "heroes", "action", "camera", "sound", "speech", "music")):
        return ""
    blocks = []
    head = []
    if f["pictures"]:
        head.append("How the reference pictures align with the target video - " + _joined(f["pictures"]))
    if data.get("time", True) is not False:
        head.append(f"Target duration {grid_seconds_text(seconds(data))} seconds.")
    if head:
        blocks.append(" ".join(head))
    summary = _joined(f["place"] + f["action"][:1])
    if summary:
        blocks.append("summary:\n" + summary)
    if f["heroes"]:
        blocks.append("subject_definitions:\n" + "\n".join(
            end(f"<Subject {i + 1}>{L['is']}{h.rstrip('.')}") for i, h in enumerate(f["heroes"])))
    shot = []
    shot.append(_joined(f["camera"]) if f["camera"] else L["static"])
    if f["action"]:
        shot.append(_joined(f["action"]))
    for i, s in enumerate(f["speech"]):
        shot.append(dialogue(s, i + 1))
    blocks.append("integrated_multimodal_description: [Shot 1] " + " ".join(shot))
    sound = _joined(f["sound"])
    if no_speech and not f["speech"]:
        sound = (sound + " " + L["no_speech"]).strip()
    if sound:
        blocks.append("overall_soundscape: " + sound)
    if f["music"]:
        blocks.append("non_diegetic_music: " + _joined(f["music"]))
    elif no_music:
        blocks.append("non_diegetic_music: N/A")
    return "\n\n".join(blocks)


def compile_form(data):
    """data — dict бланка: lang, format, time, seconds, links, no_music, no_speech и тексты участков.
    → готовый промпт (str)."""
    lang = text_lang(data)
    f = {k: lines(data.get(k, "")) for k in SECTIONS}
    for k in ("speech", "music"):                     # «нет», «no», «-» — значит, пусто
        if negative(f[k]):
            f[k] = []
    if str(data.get("format", "h3")) == "text":
        out = compile_text(data, f, lang)
    else:
        out = compile_h3(data, f, lang)
    return tags(out).strip()


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
    return {"action": raw, "format": "text", "links": False, "time": False}


# ---------------- бриф для LLM (🎬 Neron H3 AutoPrompter — Бланк) ----------------

def build_brief(data, pictures=0, last_frame=False):
    """Бланк → бриф по полям для системника H3_Blank_Director_EN.txt. Подписи полей — английские (их читает LLM),
    текст человека — как написан (LLM переведёт). pictures — сколько картинок подано (image_0..2 по порядку)."""
    f = {k: lines(data.get(k, "")) for k in SECTIONS}
    for k in ("speech", "music"):
        if negative(f[k]):
            f[k] = []
    out = [f"TARGET DURATION: {grid_seconds_text(seconds(data))} seconds."]
    refs = [f"Picture {i + 1}" for i in range(int(pictures))] + (["Last frame"] if last_frame else [])
    out.append("REFERENCES: " + (", ".join(refs) + " attached (shown above)." if refs
                                 else "no pictures attached — text-to-video."))
    if f["place"]:
        out.append("PLACE AND TIME: " + " ".join(f["place"]))
    if f["heroes"]:
        out.append("SUBJECTS:\n" + "\n".join(f"{i + 1}. {h}" for i, h in enumerate(f["heroes"])))
    if f["action"]:
        out.append(timeline(f["action"], grid_frames(seconds(data)) / FPS, grid_seconds_text(seconds(data))))
    out.append("CAMERA: " + (" ".join(f["camera"]) if f["camera"] else "not specified — the camera remains static."))
    out.append("SOUND: " + (" ".join(f["sound"]) if f["sound"] else "not specified — only the quiet natural "
                                                                    "ambience of the place."))
    out.append("SPEECH (one line per utterance, in order; the speaker is the subject named in the line):\n"
               + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(f["speech"])) if f["speech"]
               else "SPEECH: no lines given — nobody says clear words. If the ACTION has people talking, they talk "
                    "quietly and indistinctly: lips move, a low murmur, no words can be made out.")
    out.append("MUSIC: " + (" ".join(f["music"]) if f["music"] else "none."))
    if f["pictures"]:
        out.append("NOTES ON PICTURES: " + " ".join(f["pictures"]))
    return tags("\n".join(out))


BEAT_SEC = 3.5            # примерно столько секунд на один отрезок действия
CONTINUE = "continues the same activity with new small, concrete movements; nothing new happens"


def _t(x):
    return f"{x:.2f}"


_AT = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:-?\s*(?:й|ой|ю|ую|ей))?\s*"
                 r"(?:секунд[аеуы]?|секунде|сек|с|seconds?|secs?|s)(?![^\W\d_])", re.I)


def moment(line):
    """«на 7 секунде», «at 7 s», «с 5 по 8 секунду» → 7.0 / 5.0 (первая названная секунда) или None."""
    m = _AT.search(line)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", "."))
    except ValueError:
        return None


def timeline(actions, total, end=None):
    """Действие → разметка по секундам на ВСЮ длину ролика (маленькая LLM слушается готовых цифр).
    Свои секунды у человека — оставляем, последний отрезок дотягиваем до конца. Иначе — ровные отрезки:
    строка действия на отрезок; не хватает строк — «продолжает то же занятие» (иначе модель досочиняет события)."""
    end = end or _t(total)
    if any(_TIME.match(a) for a in actions):
        return ("ACTION — TIMELINE (the person's own timings; keep them, and the last beat ends exactly at "
                f"{end} seconds):\n" + "\n".join(f"- {a}" for a in actions))
    marks = [moment(a) for a in actions]
    if any(m is not None for m in marks):
        # события «на N секунде» — ровно туда; строки без секунд — поровну между соседями; первая — с нуля
        t = list(marks)
        if t[0] is None:
            t[0] = 0.0
        i = 0
        while i < len(t):
            if t[i] is None:
                j = i
                while j < len(t) and t[j] is None:
                    j += 1
                lo, hi = t[i - 1], (t[j] if j < len(t) else total)
                for k in range(i, j):
                    t[k] = lo + (hi - lo) * (k - i + 1) / (j - i + 1)
                i = j
            else:
                i += 1
        t = [min(max(0.0, x), total) for x in t]
        rows = []
        for i, a in enumerate(actions):
            b = end if i == len(actions) - 1 else _t(max(t[i], t[i + 1]))
            rows.append(f"- {_t(t[i])}–{b} s: {a}")
        return ("ACTION — TIMELINE (each event starts exactly at its time; write every beat as \"From A to B "
                f"seconds, ...\"; the last beat ends exactly at {end} seconds):\n" + "\n".join(rows))
    n = max(len(actions), min(5, max(1, round(total / BEAT_SEC))))
    step = total / n
    rows = []
    for i in range(n):
        a, b = _t(i * step), (end if i == n - 1 else _t((i + 1) * step))
        rows.append(f"- {a}–{b} s: {actions[i] if i < len(actions) else CONTINUE}")
    return ("ACTION — TIMELINE (write every beat as \"From A to B seconds, ...\"; the last beat ends exactly at "
            f"{end} seconds):\n" + "\n".join(rows))


def has_content(data):
    return any(lines(data.get(k, "")) for k in ("place", "heroes", "action", "camera", "sound", "speech"))


_THINK = re.compile(r"<think>.*?</think>", re.S | re.I)
_FENCE = re.compile(r"^```[a-z]*\s*|\s*```$", re.I)


def clean_answer(text):
    """Ответ LLM → чистый промпт: без «размышлений», рамок кода и болтовни перед форматом."""
    t = _THINK.sub("", str(text or "")).strip()
    t = _FENCE.sub("", t).strip()
    for start in ("How the reference", "Target duration"):
        i = t.find(start)
        if i > 0:
            t = t[i:]
            break
    return tags(t).strip()


def alignment(pictures, last_frame, dur):
    """Шапка родного формата H3 — по тому, что реально подано (LLM в ней путается)."""
    if not pictures and not last_frame:
        return f"Target duration {dur} seconds.", "[text-to-video generation]"
    parts = []
    if pictures:
        parts.append("<Picture 1> aligns with the 0.00-second mark of the target video and is the leading first frame")
    if last_frame:
        parts.append(f"<Last frame> aligns with the {dur}-second mark of the target video and is the final frame")
    extra = [f"<Picture {i}>" for i in range(2, int(pictures) + 1)]
    if extra:
        parts.append(" and ".join(extra) + (" supplies" if len(extra) == 1 else " supply") +
                     " additional visual references that are integrated into the same continuous scene")
    head = "How the reference pictures align with the target video - " + "; ".join(parts) + \
           f". Target duration {dur} seconds."
    if extra:
        tag = "[reference generation" + (" + morphing narrative]" if last_frame else "]")
    elif last_frame:
        tag = "[keyframe completion + morphing narrative]"
    else:
        tag = "[keyframe completion + reference generation]"
    return head, tag


_PIC = re.compile(r"(?<![<\w])Picture (\d+)(?![>\w])")


def fix_header(text, pictures, last_frame, dur):
    """Ответ LLM → правильная шапка и метка summary; «Picture 1» → «<Picture 1>» (только поданные картинки)."""
    i = text.find("summary:")
    if i < 0:
        return text
    head, tag = alignment(pictures, last_frame, dur)
    body = re.sub(r"Summary tag:\s*", "", text[i:], flags=re.I)
    m = re.match(r"summary:\s*(\[[^\]\n]*\]\s*)?", body)
    body = "summary:\n" + tag + " " + body[m.end():].lstrip()
    body = _PIC.sub(lambda mm: f"<Picture {mm.group(1)}>" if 1 <= int(mm.group(1)) <= int(pictures) else mm.group(0),
                    body)
    if last_frame:
        body = re.sub(r"(?<![<\w])Last frame(?![>\w])", "<Last frame>", body)
    return head + "\n\n" + body


_SPK = re.compile(r"\(S(\d+)\)")


def renumber_speakers(text):
    """(S2) … (S1) → кто заговорил первым — S1, второй — S2: номер за человеком, по порядку появления."""
    order = {}
    for m in _SPK.finditer(text):
        order.setdefault(m.group(1), str(len(order) + 1))
    if all(k == v for k, v in order.items()):
        return text
    return _SPK.sub(lambda m: f"(S{order[m.group(1)]})", text)
