# -*- coding: utf-8 -*-
"""📝 Neron H3 Story AutoPrompter — автопромтер, сделанный только под 🎬 Neron H3 Story.

Входы: главный сценарий на весь ролик (работает и без блоков), первый кадр, ноды 🎞 Блок (картинки, текст и LoRA
каждой сцены), общая LoRA. Длину ролика и блока задаёт он — план уходит в движок по шине.
Два прохода LLM:
  1. ПЛАН — весь сюжет сразу: по строке на блок + точное состояние на каждом стыке (откуда начнётся следующий).
  2. БЛОК — подробный промпт каждого блока отдельно: продолжение стыка, действия по секундам, физика, звук,
     ссылки на картинки <Picture N> — ровно в той нумерации, которую соберёт движок.
Выход story — шина в движок (план, промпты, картинки, LoRA). Выход prompts — текст для глаз.
Сервер LLM, модели, скачивание и надёжный повтор — от нашего 🎬 Neron AutoPrompter (папка NeronStudio-AutoPrompter):
Story ничего в нём не меняет, только пользуется.
"""
import logging
import math
import os
import re
import time

import sys
from pathlib import Path
from types import SimpleNamespace

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


NEEDED = ["NeronMultiImageLLM", "_ask_reliably", "_image_to_data_uri_small", "_stop_llama_server",
          "_find_llama_server", "_ensure_server_running", "_llm_list", "NeronLTXAutoPrompter"]
_AP_MISSING = []


def _ap():
    """Код нашего 🎬 Neron AutoPrompter (папка NeronStudio-AutoPrompter), уже загруженный ComfyUI.
    Своей копии сервера LLM у Story нет — иначе два llama-server спорили бы за один порт.
    Модули этой папки импортируют функции друг у друга, поэтому каждое нужное имя берём из ЛЮБОГО её модуля:
    это один и тот же объект, где бы он ни лежал."""
    got = {}
    for m in list(sys.modules.values()):
        f = str(getattr(m, "__file__", "") or "").replace("\\", "/")
        if "/NeronStudio-AutoPrompter/" not in f:
            continue
        for name in NEEDED:
            if name not in got and hasattr(m, name):
                got[name] = getattr(m, name)
    for m in list(sys.modules.values()):                     # камера H3 — нода Fixed Camera H3 (одна копия в пакете)
        f = str(getattr(m, "__file__", "") or "").replace("\\", "/")
        if "camera" not in got and ("/ComfyUI-H3-Static-Camera/" in f or "/NeronStudio-AutoPrompter/" in f) \
                and hasattr(m, "MyH3StaticCamera"):
            got["camera"] = m.MyH3StaticCamera
    _AP_MISSING[:] = [n for n in NEEDED if n not in got]
    if _AP_MISSING:
        return None
    ns = SimpleNamespace(**got)
    ns.LTX = got["NeronLTXAutoPrompter"]
    return ns


def _need_ap():
    ap = _ap()
    if ap is None:
        raise RuntimeError("[H3 Story AutoPrompter] Не найден 🎬 Neron AutoPrompter (папка NeronStudio-AutoPrompter): "
                           "Story AutoPrompter пользуется его сервером LLM и моделями. Поставь пакет Neron целиком "
                           "(Manager → Install via Git URL) или папку NeronStudio-AutoPrompter в custom_nodes и "
                           "перезапусти ComfyUI. Если папка стоит — она старая: обнови её (нужен LTX AutoPrompter от "
                           "04.11). Не найдено: " + ", ".join(_AP_MISSING) + "\n\nEN: 🎬 Neron AutoPrompter "
                           "(NeronStudio-AutoPrompter folder) not found or outdated — the Story AutoPrompter uses its LLM "
                           "server. Missing: " + ", ".join(_AP_MISSING))
    return ap

log = logging.getLogger("Neron.H3.StoryAutoPrompter")
TAG = "[H3 Story AutoPrompter]"
DEFAULT_PROMPT_FILE = "H3_Story_Director_EN.txt"
AUTO = "🤖 авто / auto"

# типы проводов — те же строки, что в ComfyUI-NeronH3Story/bus.py (папки ставятся отдельно — не импортируем)
LORA_TYPE = "NERON_H3_LORAS"
BLOCK_TYPE = "NERON_H3_BLOCK"
STORY_TYPE = "NERON_H3_STORY"
MAX_BLOCKS = 12
FPS = 24
SEAM = 22                  # стык по умолчанию у движка (кусок + звук)
MIN_TRAINED = 124
MAX_PLAN_IMAGES = 10       # сколько картинок показываем модели в проходе ПЛАН (окно памяти не резиновое)

BLOCK_MARK = re.compile(r"^#{2,}\s*БЛОК\s*(\d+)[^\n]*$", re.M | re.I)


def _grid(n):
    n = max(22, int(n))
    while n % 17 != 5:
        n += 1
    return min(n, 362)


def plan(total_seconds, block_seconds, seam=SEAM):
    """То же, что bus.plan в движке: ровные блоки не длиннее block_seconds. → (блоков, кадров в блоке, кадров всего)."""
    T = int(round(min(45.0, max(5.0, float(total_seconds))) * FPS))
    n_max = _grid(round(min(15.0, max(5.0, float(block_seconds))) * FPS))
    if T <= n_max:
        return 1, _grid(T), T
    blocks = math.ceil((T - seam) / (n_max - seam))
    return blocks, min(_grid(max(MIN_TRAINED, math.ceil((T + (blocks - 1) * seam) / blocks))), n_max), T


CAM_MODES = ["AUTO (Listen to autoprompter) / АВТО", "FRONT (Straight view) / ФРОНТ", "LEFT (Side view) / СЛЕВА",
             "RIGHT (Side view) / СПРАВА", "BACK (From behind) / СЗАДИ", "TOP (High angle) / СВЕРХУ",
             "BOTTOM (Low angle) / СНИЗУ"]
FRAMING_AS_FIRST = "🖼 как на первом кадре / as in the first frame"
FRAMINGS = [FRAMING_AS_FIRST, "wide shot", "medium shot", "close-up"]


def camera_header(ap, scenario, mode, framing, distance, frames):
    """Жёсткая шапка камеры — та же, что делает наша нода ⚡ Fixed Camera H3 (её код и берём).
    «Как на первом кадре» — Story-вариант: крупность и дистанция не меняются от блока к блоку."""
    cls = getattr(ap, "camera", None) if ap else None
    fr = "medium shot" if framing == FRAMING_AS_FIRST else framing
    if cls is not None:
        head = cls().generate_static_data("[LLM] Autoprompter (Naxdy Brief) / Автопромтер", mode, fr, int(frames), FPS,
                                          float(distance), autoprompt_text="", subject_details=scenario or "")[0]
    else:   # запасной текст, если ноды камеры в этой установке нет
        head = ("[CAMERA] [Static shot] A completely locked-off camera remains fixed in a front view. The framing is a "
                f"rigid {fr} at distance {float(distance):g}. Absolutely no zoom, no camera parallax, no dolly, and no "
                "tracking. All background elements and furniture are anchored and perfectly rigid.")
    if framing == FRAMING_AS_FIRST:
        # до «at distance 1.0.» включительно — точка внутри числа не конец фразы
        head = re.sub(r"The framing is a rigid .*? at distance [\d.]*\d\.", "The framing stays exactly as in the opening "
                      "frame, at the same distance and height, for the whole video.", head)
    return head.strip()


def _main(label, **o):
    return dict(o, story_main=True, display_name=label)


def _exp(label, **o):
    return dict(o, display_name=label)


def _block_pictures(k, blk, has_opening):
    """Картинки блока k в ТОЙ ЖЕ нумерации, что соберёт движок:
    <Picture 1> — внешность (первый кадр ролика), дальше — «кто/где» (только блоки 2+), навигаторы. → [(тег, роль, картинка)]."""
    out, no = [], 2 if has_opening else 1
    if k > 0 and blk.get("first") is not None:
        out.append((f"<Picture {no}>", "who / where reference for this block", blk["first"]))
        no += 1
    for i, m in enumerate(blk.get("mid") or []):
        out.append((f"<Picture {no}>", f"navigator {i + 1}: the place or object the action moves to", m))
        no += 1
    return out


def _parse_plan(text, blocks):
    """Строки «BLOCK k / END k / RU k» → список словарей. Чего нет — пусто (потом подстрахуем)."""
    res = [{"block": "", "end": "", "ru": ""} for _ in range(blocks)]
    for kind, num, val in re.findall(r"^\s*(BLOCK|END|RU)\s*(\d+)\s*:\s*(.+)$", text, re.M | re.I):
        k = int(num) - 1
        if 0 <= k < blocks:
            res[k][{"block": "block", "end": "end", "ru": "ru"}[kind.lower()]] = val.strip()
    return res


def _split_edit(text):
    """Своя правка: «### БЛОК 1 ###» … → [промпт блока 1, …]."""
    marks = list(BLOCK_MARK.finditer(text))
    if not marks:
        return [text.strip()]
    out = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        body = text[m.end():end].strip()
        # строку «план: …» (для глаз) в промпт не берём
        body = "\n".join(l for l in body.splitlines()
                         if not l.strip().lower().startswith(("план:", "plan:", "💬"))).strip()
        out[int(m.group(1))] = body
    return [out.get(k, "") for k in range(1, max(out) + 1)]


def _join(prompts, summaries, n):
    secs = n / FPS
    parts = []
    for k, p in enumerate(prompts):
        a, b = k * (n - SEAM) / FPS, k * (n - SEAM) / FPS + secs
        head = f"### БЛОК {k + 1} / BLOCK {k + 1} · {a:.1f}–{b:.1f} с ###"
        ru = summaries[k] if k < len(summaries) and summaries[k] else ""
        parts.append(head + (f"\n💬 для тебя, в модель не идёт / for you, not sent: {ru}" if ru else "") + "\n" + p.strip())
    return "\n\n".join(parts)


class NeronH3StoryAutoPrompter:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = (STORY_TYPE, "STRING")
    RETURN_NAMES = ("story", "prompts")
    OUTPUT_TOOLTIPS = ("Шина в 🎬 Neron H3 Story: план, промпты, картинки и LoRA всех блоков одним проводом. "
                       "/ Bus into the Story engine.",
                       "Все промпты блоков текстом — посмотреть или сохранить. / All block prompts as text.")
    DESCRIPTION = ("Автопромтер под Neron H3 Story: сценарий + картинки блоков → план с точными стыками и подробный "
                   "промпт каждого блока. AutoPrompter for Neron H3 Story: scenario + block pictures → a plan with "
                   "exact seams and a detailed prompt per block.")

    ORDER = ["expert", "total_seconds", "block_seconds", "camera_mode", "framing", "camera_distance", "model", "mmproj", "auto_download", "system_prompt",
             "max_tokens", "temperature", "n_ctx", "n_gpu_layers", "unload_after", "edited_prompt"]

    @classmethod
    def INPUT_TYPES(cls):
        ap = _ap()
        try:
            ggufs = ap._llm_list() if ap else []
        except Exception:
            ggufs = []
        models = [AUTO] + [m for m in ggufs if "mmproj" not in m.lower()]
        mmprojs = [AUTO] + [m for m in ggufs if "mmproj" in m.lower()]
        try:
            prompt_list = sorted(f for f in os.listdir(PROMPTS_DIR) if f.endswith(".txt"))
        except Exception:
            prompt_list = []
        if DEFAULT_PROMPT_FILE not in prompt_list:
            prompt_list.insert(0, DEFAULT_PROMPT_FILE)
        req = {
            "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                       tooltip="Показать выбор LLM и её параметры. Скрытое работает на «авто».\n\nEN: Show the LLM "
                               "choice and parameters. Hidden settings work on auto.")),
            "total_seconds": ("FLOAT", _main("длина ролика, с / video seconds", default=30.0, min=5.0, max=45.0,
                              step=0.5, display="slider",
                              tooltip="Весь ролик, 5–45 с. План (сколько блоков и какой длины) уходит в движок по шине "
                                      "— на движке длину больше не трогаешь.\n\nEN: Whole video, 5–45 s. The plan goes "
                                      "to the engine through the bus.")),
            "block_seconds": ("FLOAT", _main("длина блока, с / block seconds", default=10.0, min=5.0, max=15.0,
                              step=0.5, display="slider",
                              tooltip="Максимум одного блока. Ролик делится на ровные блоки не длиннее него.\n\nEN: "
                                      "Maximum block length; the video is split into equal blocks.")),
            "camera_mode": (CAM_MODES, _main("🎥 ракурс / camera", default=CAM_MODES[0],
                            tooltip="Как в ноде ⚡ Fixed Camera H3. АВТО — ракурс по словам сценария («слева», «сзади», "
                                    "«сверху»…), иначе фронт. Камера стоит неподвижно ВЕСЬ ролик: одна и та же шапка "
                                    "камеры ставится в начало каждого блока.\n\nEN: Same as Fixed Camera H3. The camera "
                                    "stays locked for the whole video: one camera header starts every block.")),
            "framing": (FRAMINGS, _main("🎥 план / framing", default=FRAMING_AS_FIRST,
                        tooltip="«Как на первом кадре» — крупность и дистанция не меняются от блока к блоку (надёжнее "
                                "всего для цепочки). Или общий / средний / крупный план.\n\nEN: As in the first frame "
                                "keeps the same framing across blocks; or wide / medium / close-up.")),
            "camera_distance": ("FLOAT", _exp("🎥 дистанция / distance", default=1.0, min=0.1, max=3.0, step=0.05)),
            "model": (models, _exp("модель LLM / LLM model", default=AUTO,
                      tooltip="Авто — модель класса Qwen 3.5 9B; нет — скачает сама.\n\nEN: Auto — a Qwen 3.5 9B class "
                              "model; downloads it if missing.")),
            "mmproj": (mmprojs, _exp("зрение LLM (mmproj) / vision (mmproj)", default=AUTO)),
            "auto_download": ("BOOLEAN", _exp("скачивать LLM сама / auto download", default=True)),
            "system_prompt": (prompt_list, _exp("системник / system prompt", default=DEFAULT_PROMPT_FILE,
                              tooltip="Системники из папки prompts этой ноды.\n\nEN: System prompts from this "
                                      "node's prompts folder.")),
            "max_tokens": ("INT", _exp("лимит ответа / max_tokens", default=6144, min=512, max=32768)),
            "temperature": ("FLOAT", _exp("температура / temperature", default=0.7, min=0.0, max=2.0, step=0.05)),
            "n_ctx": ("INT", _exp("окно памяти / n_ctx", default=16384, min=4096, max=65536,
                      tooltip="Картинки блоков занимают место в памяти модели. Много картинок — увеличь.\n\nEN: Block "
                              "pictures take context; raise it for many pictures.")),
            "n_gpu_layers": ("INT", _exp("слоёв на видеокарте / n_gpu_layers", default=-1, min=-1, max=999)),
            "unload_after": ("BOOLEAN", _exp("выгружать LLM после / unload after", default=True,
                             tooltip="Включено: сразу после промптов LLM уходит из видеопамяти — H3 нужна вся. "
                                     "\n\nEN: On: the LLM leaves VRAM right after the prompts — H3 needs all of it.")),
            "edited_prompt": ("STRING", _main("✏ своя правка (пусто = писать заново) / your edit (empty = new)",
                              multiline=True, default="",
                              tooltip="Есть текст — он идёт в движок как есть, LLM не запускается. Блоки разделяются "
                                      "строками «### БЛОК 1 ###». «✏ В правку» копирует сюда последний ответ.\n\nEN: "
                                      "If not empty it goes to the engine as is; blocks are split by «### БЛОК k ###».")),
        }
        opt = {
            "scenario": ("STRING", {"forceInput": True,
                                    "tooltip": "Главный сценарий на весь ролик — своими словами, любой язык. Работает и "
                                               "без нод блоков.\n\nEN: The main scenario for the whole video."}),
            "first_frame": ("IMAGE", {"tooltip": "Первый кадр ролика — начало и образец внешности <Picture 1>.\n\nEN: "
                                                 "The opening frame and the appearance reference <Picture 1>."}),
            "lora_all": (LORA_TYPE, {"tooltip": "🎨 LoRA на весь ролик (стиль). / LoRAs for the whole video."}),
        }
        for k in range(1, MAX_BLOCKS + 1):
            opt[f"block_{k}"] = (BLOCK_TYPE, {"tooltip": f"🎞 Блок {k}: картинки, текст-подсказка и LoRA. / Block {k}."})
        return {"required": {k: req[k] for k in cls.ORDER}, "optional": opt}

    @classmethod
    def VALIDATE_INPUTS(cls, model, mmproj, system_prompt):
        return True

    # ------------------------------------------------------------------
    def generate(self, expert=False, total_seconds=30.0, block_seconds=10.0, camera_mode=CAM_MODES[0],
                 framing=FRAMING_AS_FIRST, camera_distance=1.0, model=AUTO, mmproj=AUTO,
                 auto_download=True, system_prompt=None, max_tokens=6144, temperature=0.7, n_ctx=16384,
                 n_gpu_layers=-1, unload_after=True, edited_prompt="", scenario=None, first_frame=None,
                 lora_all=None, **kw):
        blocks, n, T = plan(total_seconds, block_seconds)
        given = [kw.get(f"block_{k}") or {} for k in range(1, MAX_BLOCKS + 1)]
        opening = first_frame if first_frame is not None else given[0].get("first")
        scenario = (scenario or "").strip()
        notes = [f"план: {T / FPS:g} с = {blocks} блок(а) по {n / FPS:.1f} с"]
        extra = [k + 1 for k in range(blocks, MAX_BLOCKS) if given[k]]
        if extra:
            notes.append(f"блоки {', '.join(map(str, extra))} не влезли в {T / FPS:g} с — увеличь длину ролика")

        cam = camera_header(_ap(), scenario, camera_mode, framing, camera_distance, n)
        edited = (edited_prompt or "").strip()
        if edited:
            prompts = _split_edit(edited)
            summaries = []
            notes.insert(0, "✏ своя правка — LLM не запускался / your edit, LLM skipped")
        else:
            if not scenario and not any(g.get("text") for g in given[:blocks]):
                raise RuntimeError(f"{TAG} Нет ни сценария, ни текста в блоках. Подключи вход scenario (текстовая нода) "
                                   f"или напиши, что происходит, в нодах 🎞 Блок.\n\nEN: No scenario and no block text. "
                                   f"Connect the scenario input or write in the 🎞 Block nodes.")
            ap = _need_ap()
            try:
                llm_model, llm_mm, picked = ap.LTX._resolve_llm(self, model, mmproj, bool(auto_download))
                prompts, summaries, note = self._write(llm_model, llm_mm, system_prompt, int(max_tokens),
                                                       float(temperature), int(n_ctx), int(n_gpu_layers), scenario,
                                                       opening, given[:blocks], blocks, n, cam)
                prompts = [f"{cam}\n\n{p.strip()}" for p in prompts]   # камера — кодом, одинаково в каждом блоке
                notes.append(note + (f"; {picked}" if picked else ""))
            finally:
                if unload_after:
                    ap._stop_llama_server()
        story = {"total_seconds": float(total_seconds), "block_seconds": float(block_seconds),
                 "first_frame": opening, "appearance": None, "lora_all": list(lora_all or []), "blocks": []}
        for k in range(blocks):
            g = given[k]
            p = prompts[k] if k < len(prompts) and prompts[k] else (prompts[-1] if prompts else "")
            story["blocks"].append({"prompt": p, "text": g.get("text", ""), "first": g.get("first"),
                                    "mid": list(g.get("mid") or []), "last": g.get("last"),
                                    "loras": list(g.get("loras") or [])})
        text = _join([b["prompt"] for b in story["blocks"]], summaries, n)
        note = "; ".join(notes)
        log.info("%s %s", TAG, note)
        return {"ui": {"text": [text], "note": [note]}, "result": (story, text)}

    # ------------------------------------------------------------------
    def _write(self, model, mmproj, system_prompt, max_tokens, temperature, n_ctx, n_gpu_layers, scenario,
               opening, given, blocks, n, cam=""):
        ap = _need_ap()
        helper = ap.NeronMultiImageLLM()
        model_path = helper._resolve_model_path(model)
        mmproj_path = helper._resolve_mmproj_path(mmproj)
        server = ap._find_llama_server()
        if server is None:
            raise RuntimeError(f"{TAG} Не найден llama-server (программа, которая запускает LLM). Нода пробует скачать "
                               f"его сама — причина неудачи в консоли ComfyUI.\n\nEN: llama-server not found; see the "
                               f"ComfyUI console.")
        try:
            ap._ensure_server_running(server, model_path, mmproj_path, n_gpu_layers, n_ctx)
        except Exception as e:
            raise RuntimeError(f"{TAG} LLM не запустилась: {e}\n\nEN: The LLM failed to start: {e}") from None
        if not system_prompt or not (PROMPTS_DIR / system_prompt).is_file():
            system_prompt = DEFAULT_PROMPT_FILE
        system_text = (PROMPTS_DIR / system_prompt).read_text(encoding="utf-8")
        see = bool(mmproj_path)
        secs = n / FPS
        t0 = time.time()

        def picture_msgs(items):
            msgs = []
            if not see:
                return msgs
            for label, img in items:
                msgs.append({"role": "user", "content": [
                    {"type": "text", "text": label},
                    {"type": "image_url", "image_url": {"url": ap._image_to_data_uri_small(img, max_size=768)}}]})
                msgs.append({"role": "assistant", "content": "I see it."})
            return msgs

        def ask(messages, what):
            answer, tries = ap._ask_reliably(messages, max_tokens, temperature)
            if not answer:
                raise RuntimeError(f"{TAG} Модель не ответила ({what}) и после трёх попыток:\n" + "\n".join(tries) +
                                   "\n\nЧто сделать: в эксперте увеличь «лимит ответа» или «окно памяти».\n\nEN: The "
                                   "model gave no answer after 3 tries. Raise max_tokens or n_ctx in expert mode.")
            return answer.strip()

        opening_item = [("Picture 1 — the opening frame of the video and the identity reference <Picture 1>:",
                         opening)] if opening is not None else []
        # ---------- проход 1: план ----------
        plan_imgs, block_lines = list(opening_item), []
        for k, g in enumerate(given):
            pics = _block_pictures(k, g, opening is not None)
            desc = [f"Block {k + 1} ({k * (n - SEAM) / FPS:.1f}–{k * (n - SEAM) / FPS + secs:.1f} s of the video)"]
            if g.get("text"):
                desc.append(f"user note: {g['text']}")
            for tag, role, img in pics:
                desc.append(f"{tag} = {role}")
                if len(plan_imgs) < MAX_PLAN_IMAGES:
                    plan_imgs.append((f"{tag} (block {k + 1}, {role}):", img))
            if g.get("last") is not None:
                desc.append("has an exact END FRAME picture")
                if len(plan_imgs) < MAX_PLAN_IMAGES:
                    plan_imgs.append((f"End frame of block {k + 1} (the block must end exactly like this):", g["last"]))
            block_lines.append("; ".join(desc))
        user = ["TASK \"PLAN\".", f"The video is {blocks} block(s), each {secs:.1f} seconds; every block after the "
                f"first begins with ~1 second that repeats the previous block's ending."]
        user.append(f"Camera for the whole video (fixed, already decided): {cam}")
        user.append(f"Scenario for the whole video: {scenario}" if scenario else
                    "No overall scenario: build the story from the block notes and the pictures.")
        user += block_lines
        if not see:
            user.append("No pictures can be shown to you: rely on the text.")
        messages = [{"role": "system", "content": system_text}] + picture_msgs(plan_imgs) + \
                   [{"role": "user", "content": "\n".join(user)}]
        plan_text = ask(messages, "план / plan")
        steps = _parse_plan(plan_text, blocks)
        look = (re.search(r"^\s*LOOK\s*:\s*(.+)$", plan_text, re.M | re.I) or [None, ""])[1].strip()
        for k, st in enumerate(steps):              # подстраховка: пустой пункт плана — из заметки или сценария
            if not st["block"]:
                st["block"] = given[k].get("text") or (scenario if k == 0 else "The story continues naturally.")
        log.info("%s план:\n%s", TAG, plan_text)

        # ---------- проход 2: каждый блок ----------
        prompts = []
        whole = "\n".join(f"Block {i + 1}: {s['block']} END: {s['end']}" for i, s in enumerate(steps))
        for k, g in enumerate(given):
            pics = _block_pictures(k, g, opening is not None)
            items = list(opening_item) + [(f"{tag} — {role}:", img) for tag, role, img in pics]
            if g.get("last") is not None:
                items.append(("END FRAME of this block — it must end exactly like this:", g["last"]))
            tags = ["<Picture 1> = identity reference (faces, hair, bodies, clothing, colors only)"] \
                if opening is not None else []
            tags += [f"{tag} = {role}" for tag, role, _ in pics]
            u = ["TASK \"BLOCK\".", f"Whole plan:\n{whole}", "",
                 f"Write block {k + 1} of {blocks}: {steps[k]['block']}",
                 f"It lasts {secs:.1f} seconds; time the actions from 0 to {secs:.1f} s and not beyond."]
            if look:
                u.append(f"Exact look (keep it, never change it): {look}")
            if cam:
                u.append("The camera is fixed by this header that will precede your text — do not describe camera "
                         f"moves, zoom, reframing or a new shot: {cam}")
            if k > 0:
                u.append(f"It starts exactly from the end of block {k}: {steps[k - 1]['end'] or 'as block ' + str(k) + ' ended'}. "
                         f"The first second repeats that moment; the new action starts after it.")
            if steps[k]["end"]:
                u.append(f"It must end exactly in this state: {steps[k]['end']}")
            if g.get("text"):
                u.append(f"User note for this block: {g['text']}")
            if tags:
                u.append("Picture tags to use: " + "; ".join(tags))
            if scenario:
                u.append(f"Overall scenario: {scenario}")
            messages = [{"role": "system", "content": system_text}] + picture_msgs(items) + \
                       [{"role": "user", "content": "\n".join(u)}]
            prompts.append(ask(messages, f"блок {k + 1} / block {k + 1}"))
        note = f"LLM: {time.time() - t0:.0f} с, проходов {1 + blocks}" + ("" if see else ", без зрения — кадры не видела")
        return prompts, [s["ru"] for s in steps], note


NODE_CLASS_MAPPINGS = {"NeronH3StoryAutoPrompter": NeronH3StoryAutoPrompter}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3StoryAutoPrompter": "📝 Neron H3 Story AutoPrompter / Автопромтер Story"}
