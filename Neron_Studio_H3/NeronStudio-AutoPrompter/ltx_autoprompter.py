# -*- coding: utf-8 -*-
"""🎬 Neron LTX AutoPrompter — автопромтер, заточенный под LTX 2.5 и 🎬 Neron LTX Engine.

Отличия от H3 AutoPrompter:
  • входы — как у движка: бриф, камера, первый / промежуточные 1–2 / последний кадр;
  • камера идёт прямо в LLM, и модель ставит её первой фразой промпта (и коротко в конце);
    если модель забыла камеру — нода сама подставляет фразу пользователя (страховка);
  • никакой H3-камеры (camera_mode, framing, distance) — у LTX свой принцип;
  • длительность — одна на всю схему: выход seconds идёт в движок;
  • окно предпросмотра в ноде и своя правка: текст правки, если он есть, идёт вместо ответа LLM.

Сервер LLM, модели и надёжный повтор — общие с H3 AutoPrompter (dialog_node, multi_llm).
"""
import logging
import os
import time

from .multi_llm import NeronMultiImageLLM, _ask_reliably, _image_to_data_uri_small, _stop_llama_server
from .dialog_node import _find_llama_server, _ensure_server_running, _llm_list, _llm_roots, _PROMPTS_DIR
from . import llm_pack

log = logging.getLogger("Neron.LTX.AutoPrompter")
TAG = "[LTX AutoPrompter]"
DEFAULT_PROMPT_FILE = "LTX25_Director_EN.txt"
AUTO = "🤖 авто / auto"

# подписи картинок для LLM — совпадают с системником LTX25_Director_EN.txt
SLOTS = [
    ("first_frame", "Picture 1 (first frame of the video):"),
    ("mid_frame_1", "Picture 2 (middle keyframe, reached about one third into the clip):"),
    ("mid_frame_2", "Picture 3 (middle keyframe, reached about two thirds into the clip):"),
    ("last_frame", "Last frame (the video must end exactly here):"),
]


def _exp(label, **o):
    return dict(o, display_name=label)


def _main(label, **o):
    return dict(o, ltx_main=True, display_name=label)


def _duration_line(seconds):
    s = f"{seconds:g}"
    return f"A {s}-second single continuous shot."


def _finalize(text, camera, seconds):
    """Гарантии кодом, а не надеждой на модель:
    • первой строкой — длина ролика (по ползунку ноды), чтобы LTX расставил действия по времени;
    • камера в начале и в конце (если модель забыла — фраза пользователя).
    → (текст, заметки)."""
    notes = []
    body = text.strip()
    head = body[:200].lower()
    # длительность: убираем то, что модель могла написать сама в первой строке, и ставим точную
    first, _, rest = body.partition("\n")
    if "-second" in first.lower() and len(first) < 120:
        body = rest.strip()
    if camera and "camera" not in head:
        cam = camera.rstrip()
        if cam[-1:] not in ".!?":
            cam += "."
        body = f"{cam}\n\n{body}\n\n{cam}"
        notes.append("модель забыла камеру — фраза поставлена в начало и конец / camera sentence added")
    return f"{_duration_line(seconds)}\n{body}", notes


class NeronLTXAutoPrompter:
    CATEGORY = "Neron/LTX"
    FUNCTION = "generate"
    RETURN_TYPES = ("STRING", "FLOAT", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("prompt", "seconds", "first_frame", "mid_frame_1", "mid_frame_2", "last_frame")
    OUTPUT_TOOLTIPS = ("Готовый промпт с камерой — в движок / ready prompt with camera, to the engine",
                       "Длительность — в движок (вход seconds_in) / duration, to the engine",
                       "Кадры насквозь — в движок / frames passed through to the engine", "", "", "")
    DESCRIPTION = ("Автопромтер для LTX 2.5: бриф + камера + кадры → подробный промпт с физикой и звуком. "
                   "AutoPrompter for LTX 2.5: brief + camera + frames → a detailed prompt with physics and sound.")

    ORDER = ["expert", "seconds", "model", "mmproj", "auto_download", "system_prompt",
             "max_tokens", "temperature", "n_ctx", "n_gpu_layers", "unload_after", "edited_prompt"]

    @classmethod
    def INPUT_TYPES(cls):
        try:
            ggufs = _llm_list()
        except Exception:
            ggufs = []
        models = [AUTO] + [m for m in ggufs if "mmproj" not in m.lower()]
        mmprojs = [AUTO] + [m for m in ggufs if "mmproj" in m.lower()]
        try:
            prompt_list = sorted(f for f in os.listdir(_PROMPTS_DIR) if f.endswith(".txt") and "ltx" in f.lower())
        except Exception:
            prompt_list = []
        if DEFAULT_PROMPT_FILE not in prompt_list:
            prompt_list.insert(0, DEFAULT_PROMPT_FILE)
        req = {
            "expert": ("BOOLEAN", _main("⚙ эксперт / expert", default=False,
                       tooltip="Показать выбор LLM и её параметры. Скрытое всё равно работает — на «авто».\n\nEN: "
                               "Show the LLM choice and parameters. Hidden settings still work, on auto.")),
            "seconds": ("FLOAT", _main("длительность, с / seconds", default=8.0, min=1.0, max=20.0, step=0.5,
                        display="slider",
                        tooltip="Встаёт первой строкой промпта, и под неё модель расставляет действия по секундам. "
                                "Подключи выход seconds к движку (вход seconds_in).\n\nEN: Goes on the first line "
                                "of the prompt; actions are timed to it. Wire seconds to the engine's seconds_in.")),
            "model": (models, _exp("модель LLM / LLM model", default=AUTO,
                      tooltip="Авто — нода сама берёт модель класса Qwen 3.5 9B (под неё написан системник). Нет "
                              "такой — скачает сама (если включено «скачивать LLM сама»).\n\nEN: Auto picks a Qwen "
                              "3.5 9B class model; if none, downloads it (when auto download is on).")),
            "mmproj": (mmprojs, _exp("зрение LLM (mmproj) / vision (mmproj)", default=AUTO,
                       tooltip="Авто — зрение из той же папки, что и модель (чужое зрение к модели не подходит). "
                               "Нет — скачает из пакета.\n\nEN: Auto takes the vision file from the model's folder; "
                               "none — downloads it from the pack.")),
            "auto_download": ("BOOLEAN", _exp("скачивать LLM сама / auto download", default=True,
                              tooltip="Нет подходящей LLM — нода скачает Qwen 3.5 9B (Q4_K_M, ~5,7 ГБ) и зрение к "
                                      "ней (~0,9 ГБ) в models/LLM/Qwen3.5-9B. Без регистрации, лицензия Apache 2.0, "
                                      "прогресс на ноде, докачка после обрыва.\n\nEN: No suitable LLM — downloads "
                                      "Qwen 3.5 9B (Q4_K_M, ~5.7 GB) + vision (~0.9 GB). No login, Apache 2.0.")),
            "system_prompt": (prompt_list, _exp("системник / system prompt", default=DEFAULT_PROMPT_FILE,
                              tooltip="Здесь только системники LTX (в имени файла есть «ltx»).\n\nEN: Only LTX "
                                      "system prompts (file name contains «ltx»).")),
            "max_tokens": ("INT", _exp("лимит ответа / max_tokens", default=6144, min=512, max=32768,
                           tooltip="Промпт для LTX длинный, а Qwen 3.5 ещё и думает про себя. 6144 — с запасом. "
                                   "Если модель «не отвечает» — увеличь.\n\nEN: LTX prompts are long and Qwen 3.5 "
                                   "thinks first. Raise it if the model gives no answer.")),
            "temperature": ("FLOAT", _exp("температура / temperature", default=0.7, min=0.0, max=2.0, step=0.05)),
            "n_ctx": ("INT", _exp("окно памяти / n_ctx", default=16384, min=2048, max=65536)),
            "n_gpu_layers": ("INT", _exp("слоёв на видеокарте / n_gpu_layers", default=-1, min=-1, max=999)),
            "unload_after": ("BOOLEAN", _exp("выгружать LLM после / unload after", default=False,
                             tooltip="Освободить видеопамять под LTX сразу после промпта. Следующий запуск LLM "
                                     "будет дольше.\n\nEN: Free VRAM for LTX right after the prompt; the next LLM "
                                     "start is slower.")),
            "edited_prompt": ("STRING", _main("✏ своя правка (пусто = писать заново) / your edit (empty = new)",
                              multiline=True, default="",
                              tooltip="Если здесь есть текст — он идёт в движок как есть, LLM не запускается. "
                                      "Кнопка «✏ В правку» копирует сюда последний ответ модели.\n\nEN: If not "
                                      "empty, this text goes to the engine as is and the LLM is skipped.")),
        }
        return {
            "required": {k: req[k] for k in cls.ORDER},
            "optional": {
                "brief": ("STRING", {"forceInput": True, "tooltip": "Коротко, что происходит — на любом языке. "
                                                                    "EN: what happens, short, any language."}),
                "camera_prompt": ("STRING", {"forceInput": True, "tooltip": "Как ведёт себя камера. Модель поставит "
                                                                            "это первой фразой. EN: camera behaviour."}),
                "first_frame": ("IMAGE",),
                "mid_frame_1": ("IMAGE", {"tooltip": "Промежуточный кадр — ориентир для модели посреди ролика. Сложное движение (меч, танец, бег) без ориентиров LTX додумывает сам. EN: a middle keyframe — a guide for complex motion."}),
                "mid_frame_2": ("IMAGE", {"tooltip": "Промежуточный кадр — ориентир для модели посреди ролика. Сложное движение (меч, танец, бег) без ориентиров LTX додумывает сам. EN: a middle keyframe — a guide for complex motion."}),
                "last_frame": ("IMAGE", {"tooltip": "Последний кадр — самый сильный рычаг: модель ведёт к готовой картинке, а не выдумывает концовку. Хочешь хорошо — ставь промежуточные и последний кадр. EN: the strongest lever — the model heads to your picture instead of inventing the ending."}),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, model, mmproj, system_prompt):
        # Имя модели/системника из чужой схемы, которого здесь нет, — не красное окно, а «авто» внутри ноды.
        # A saved name that doesn't exist here is not a red error: the node falls back to auto.
        return True

    def generate(self, expert=False, seconds=8.0, model=AUTO, mmproj=AUTO, auto_download=True, system_prompt=None,
                 max_tokens=6144,
                 temperature=0.7, n_ctx=16384, n_gpu_layers=-1, unload_after=False, edited_prompt="",
                 brief=None, camera_prompt=None, first_frame=None, mid_frame_1=None, mid_frame_2=None,
                 last_frame=None):
        frames = (first_frame, mid_frame_1, mid_frame_2, last_frame)
        camera = (camera_prompt or "").strip()
        edited = (edited_prompt or "").strip()
        if edited:
            text, extra = _finalize(edited, camera, float(seconds))
            note = "; ".join(["✏ своя правка — LLM не запускался / your edit, LLM skipped"] + extra)
            log.info("%s %s", TAG, note)
            return {"ui": {"text": [text], "note": [note]}, "result": (text, float(seconds)) + frames}

        brief = (brief or "").strip()
        if not brief:
            raise RuntimeError(f"{TAG} Нет брифа: подключи вход brief (текстовая нода) или впиши текст в «своя "
                               f"правка».\n\nEN: No brief: connect the brief input or type your own text.")
        try:
            model, mmproj, picked = self._resolve_llm(model, mmproj, bool(auto_download))
            text, note = self._ask_llm(model, mmproj, system_prompt, max_tokens, temperature, n_ctx, n_gpu_layers,
                                       brief, camera, float(seconds), frames)
            if picked:
                note += "; " + picked
        finally:
            if unload_after:
                _stop_llama_server()
        text, extra = _finalize(text, camera, float(seconds))
        if last_frame is None:
            extra.append("💡 хочешь точно — добавь последний кадр / want it exact? add a last frame")
        note = "; ".join([note] + extra)
        log.info("%s %s (%s символов)", TAG, note, len(text))
        return {"ui": {"text": [text], "note": [note]}, "result": (text, float(seconds)) + frames}

    # ------------------------------------------------------------------
    def _resolve_llm(self, model, mmproj, auto_download):
        """«Авто» → подходящая модель и зрение к ней; нет — скачать пакет. Ищем по папкам ПРЯМО СЕЙЧАС."""
        ggufs = _llm_list()
        models = [m for m in ggufs if "mmproj" not in m.lower()]
        mmprojs = [m for m in ggufs if "mmproj" in m.lower()]
        picked = []
        if not model or model == AUTO or model not in models:
            if model and model != AUTO:
                picked.append(f"«{model}» не найдена — взял авто / not found, using auto")
            model = llm_pack.best_model(models)
            if model is None:
                if not auto_download:
                    raise RuntimeError(f"{TAG} Нет LLM класса Qwen 3.5 9B в models/LLM. Включи в эксперте «скачивать "
                                       f"LLM сама» или выбери свою модель.\n\nEN: No Qwen 3.5 9B class LLM in "
                                       f"models/LLM. Turn on auto download in expert mode or pick your model.")
                model, pack_mm = llm_pack.ensure_pack(_llm_roots()[0], need_model=True, need_mmproj=True)
                picked.append("📥 скачана Qwen 3.5 9B / downloaded")
                if not mmproj or mmproj == AUTO:
                    mmproj = pack_mm
            else:
                picked.append(f"авто: {model.split('/')[-1]}")
        if not mmproj or mmproj == AUTO or mmproj not in mmprojs + [f"{llm_pack.PACK_DIR}/{llm_pack.PACK_MMPROJ}"]:
            mm = llm_pack.mmproj_for(model, mmprojs)
            if mm is None and auto_download:
                _, mm = llm_pack.ensure_pack(_llm_roots()[0], need_model=False, need_mmproj=True)
                picked.append("📥 скачано зрение / vision downloaded")
            mmproj = mm or "No_mmproj_Found"
        return model, mmproj, ", ".join(picked)

    # ------------------------------------------------------------------
    def _ask_llm(self, model, mmproj, system_prompt, max_tokens, temperature, n_ctx, n_gpu_layers,
                 brief, camera, seconds, frames):
        helper = NeronMultiImageLLM()
        if not model or model == "No_GGUF_Models_Found":
            raise RuntimeError(f"{TAG} Нет LLM-моделей в models/LLM. Положи туда GGUF-модель (например, Qwen 3.5 9B) "
                               f"и mmproj к ней.\n\nEN: No LLM models in models/LLM. Put a GGUF model (e.g. Qwen 3.5 "
                               f"9B) and its mmproj there.")
        model_path = helper._resolve_model_path(model)
        mmproj_path = helper._resolve_mmproj_path(mmproj)
        server = _find_llama_server()
        if server is None:
            raise RuntimeError(f"{TAG} Не найден llama-server (программа, которая запускает LLM). Нода пробует "
                               f"скачать его сама — причина неудачи в консоли ComfyUI. Проверь интернет и "
                               f"перезапусти ComfyUI.\n\nEN: llama-server not found; see the ComfyUI console, check "
                               f"the internet and restart ComfyUI.")
        try:
            _ensure_server_running(server, model_path, mmproj_path, n_gpu_layers, n_ctx)
        except Exception as e:
            raise RuntimeError(f"{TAG} LLM не запустилась: {e}\n\nEN: The LLM failed to start: {e}") from None
        if not mmproj_path:
            log.warning("%s зрения (mmproj) нет — модель не увидит кадры / no mmproj, frames unseen", TAG)

        if not system_prompt or not (_PROMPTS_DIR / system_prompt).is_file():
            system_prompt = DEFAULT_PROMPT_FILE
        system_text = helper._load_system_text(system_prompt)
        messages = [{"role": "system", "content": system_text}]
        attached = []
        if any(f is not None for f in frames):
            if not mmproj_path:
                log.warning("%s mmproj не выбран — модель не увидит кадры", TAG)
            else:
                for (slot, label), img in zip(SLOTS, frames):
                    if img is None:
                        continue
                    messages.append({"role": "user", "content": [
                        {"type": "text", "text": label},
                        {"type": "image_url", "image_url": {"url": _image_to_data_uri_small(img)}}]})
                    messages.append({"role": "assistant", "content": "I see it."})
                    attached.append(slot)

        user = [f"Brief: {brief}"]
        if camera:
            user.append(f"Camera: {camera}")
        user.append(f"Duration: {seconds:g} seconds.")
        if not attached:
            user.append("No frames are attached: this is text to video, describe the whole look yourself.")
        messages.append({"role": "user", "content": "\n\n".join(user)})

        t0 = time.time()
        answer, tries = _ask_reliably(messages, int(max_tokens), float(temperature))
        if not answer:
            raise RuntimeError(f"{TAG} Модель не ответила и после трёх попыток:\n" + "\n".join(tries) +
                               "\n\nЧто сделать: в эксперте увеличь «лимит ответа» (например, до 8192) или «окно "
                               "памяти», либо возьми модель побольше.\n\nEN: The model gave no answer after 3 tries. "
                               "Raise max_tokens or n_ctx in expert mode, or use a bigger model.")
        note = f"LLM: {time.time() - t0:.0f} с, кадры: {', '.join(attached) or 'нет'}"
        if tries:
            note += f", попыток {len(tries) + 1}"
        return answer.strip(), note


NODE_CLASS_MAPPINGS = {"NeronLTXAutoPrompter": NeronLTXAutoPrompter}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronLTXAutoPrompter": "🎬 Neron LTX AutoPrompter / Автопромтер LTX"}
