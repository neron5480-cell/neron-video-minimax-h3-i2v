# -*- coding: utf-8 -*-
"""🎬 Neron H3 AutoPrompter — Бланк.

Лицо — бланк (участки: место и время, герои, действие, камера, звук, речь, музыка, картинки + ⏱ длина).
Мотор — проверенный автопромтер Neron: своя копия кода LLM в llm/ (Qwen через llama-server, порт 8767), модель
качается сама, сервер поднимается сам, выгрузка после запуска включена.
LLM расписывает бланк в подробный АНГЛИЙСКИЙ промпт в родном формате H3 (системник llm/prompts/H3_Blank_Director_EN.txt).
Камеры-пресетов нет: какая камера написана в бланке — такая и в промпте. Нет картинок — текст → видео.
Всё тонкое (модель, системник, токены…) — за ⚙ экспертом; там же «без LLM» (бланк сразу в движок).

EN: The face is the form, the engine is the proven Neron autoprompter (own LLM copy, port 8767). The LLM expands the
form into a detailed ENGLISH prompt in H3's native format. No camera presets: the camera is what the form says.
"""
import logging
import time

from . import form as F

log = logging.getLogger("Neron.H3.AutoPrompterBlank")
TAG = "[H3 AutoPrompter Бланк]"
AUTO = "🤖 авто / auto"
DEFAULT_PROMPT_FILE = "H3_Blank_Director_EN.txt"

_LLM = None
_LLM_ERR = ""


def _llm():
    """Свой код LLM (папка llm/). Грузим лениво: без него нода всё равно работает в режиме «без LLM»."""
    global _LLM, _LLM_ERR
    if _LLM is None:
        try:
            from .llm import dialog_node, multi_llm, llm_pack
            _LLM = (dialog_node, multi_llm, llm_pack)
        except Exception as e:
            _LLM_ERR = str(e)
            log.warning("%s код LLM не загрузился: %s", TAG, e)
            _LLM = False
    return _LLM or None


def _lists():
    m = _llm()
    models, mmprojs, prompts = [], [], []
    if m:
        dn = m[0]
        try:
            g = dn._llm_list()
            models = [x for x in g if "mmproj" not in x.lower()]
            mmprojs = [x for x in g if "mmproj" in x.lower()]
        except Exception as e:
            log.warning("%s список моделей: %s", TAG, e)
        try:
            prompts = sorted(p.name for p in dn._PROMPTS_DIR.glob("*.txt"))
        except Exception:
            pass
    if DEFAULT_PROMPT_FILE not in prompts:
        prompts = [DEFAULT_PROMPT_FILE] + prompts
    return [AUTO] + models, [AUTO] + mmprojs, prompts


class NeronH3AutoPrompterBlank:
    CATEGORY = "Neron/H3"
    FUNCTION = "generate"
    RETURN_TYPES = ("STRING", "INT", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("minimax_prompt", "frames_count", "img_0", "img_1", "img_2", "last_frm")
    OUTPUT_TOOLTIPS = ("Готовый промпт → вход prompt движка H3. EN: the finished prompt → the H3 engine's prompt input.",
                       "Число кадров по ⏱ длине (сетка модели 17k+5) → вход length_in движка. EN: frame count → length_in.",
                       "image_0 дальше по схеме / passed through", "image_1 дальше / passed through",
                       "image_2 дальше / passed through", "last_frame дальше / passed through")
    DESCRIPTION = ("Бланк промпта + автопромтер H3. Заполни участки (можно по-русски) — LLM распишет их в подробный "
                   "английский промпт в родном формате H3. Нет картинок — текст → видео.\n\nEN: Prompt form + H3 "
                   "autoprompter. Fill in the sections (any language) — the LLM expands them into a detailed English "
                   "prompt in H3's native format. No pictures — text to video.")

    @classmethod
    def INPUT_TYPES(cls):
        models, mmprojs, prompts = _lists()
        return {
            "required": {
                "form": ("STRING", {"default": "{}", "multiline": False}),
                "model": (models, {"default": AUTO}),
                "mmproj": (mmprojs, {"default": AUTO}),
                "system_prompt": (prompts, {"default": DEFAULT_PROMPT_FILE}),
                "max_tokens": ("INT", {"default": 6144, "min": 512, "max": 32768, "step": 256}),
                "temperature": ("FLOAT", {"default": 0.6, "min": 0.0, "max": 2.0, "step": 0.05}),
                "n_ctx": ("INT", {"default": 16384, "min": 2048, "max": 131072, "step": 1024}),
                "n_gpu_layers": ("INT", {"default": -1, "min": -1, "max": 999}),
                "unload_after": ("BOOLEAN", {"default": True}),
                "auto_download": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "image_0": ("IMAGE",), "image_1": ("IMAGE",), "image_2": ("IMAGE",), "last_frame": ("IMAGE",),
            },
        }

    @classmethod
    def VALIDATE_INPUTS(cls, model=None, mmproj=None, system_prompt=None):
        # Файла из чужой схемы здесь нет — не красное окно: уходит на «авто» / системник по умолчанию.
        return True

    # ------------------------------------------------------------------
    def generate(self, form="{}", model=AUTO, mmproj=AUTO, system_prompt=DEFAULT_PROMPT_FILE, max_tokens=6144,
                 temperature=0.6, n_ctx=16384, n_gpu_layers=-1, unload_after=True, auto_download=True,
                 image_0=None, image_1=None, image_2=None, last_frame=None):
        data = F.parse(form)
        if not F.has_content(data):
            raise ValueError(f"{TAG} Бланк пуст — заполни хотя бы «Действие».\n\nEN: The form is empty — fill in at "
                             f"least «Action».")
        sec = F.seconds(data)
        frames = F.grid_frames(sec)
        pics = [im for im in (image_0, image_1, image_2) if im is not None]

        if data.get("llm", True) is False:
            text = F.compile_form(dict(data, format="h3"))
            note = "без LLM — бланк сразу в движок / no LLM"
        else:
            m = _llm()
            if not m:
                raise RuntimeError(f"{TAG} Не загрузился свой код LLM (папка llm/): {_LLM_ERR}. Переустанови папку "
                                   f"ComfyUI-NeronH3AutoPrompter целиком. Или включи в ⚙ «без LLM».\n\nEN: the node's "
                                   f"LLM code failed to load: {_LLM_ERR}")
            brief = F.build_brief(data, len(pics), last_frame is not None)
            try:
                text, note = self._ask(m, model, mmproj, system_prompt, int(max_tokens), float(temperature),
                                       int(n_ctx), int(n_gpu_layers), bool(auto_download), brief, pics, last_frame)
            finally:
                if unload_after:
                    try:
                        m[1]._stop_llama_server()
                    except Exception as e:
                        log.warning("%s выгрузка LLM: %s", TAG, e)
        log.info("%s %s; %d с → %d кадров; промпт %d знаков", TAG, note, sec, frames, len(text))
        return {"ui": {"text": [text], "note": [note]},
                "result": (text, int(frames), image_0, image_1, image_2, last_frame)}

    # ------------------------------------------------------------------
    def _resolve(self, m, model, mmproj, auto_download):
        """«Авто» → подходящая модель и зрение к ней; нет — скачать пакет (Qwen 3.5 9B). Как в LTX AutoPrompter."""
        dn, _, pack = m
        g = dn._llm_list()
        models = [x for x in g if "mmproj" not in x.lower()]
        mmprojs = [x for x in g if "mmproj" in x.lower()]
        picked = []
        if not model or model == AUTO or model not in models:
            if model and model != AUTO:
                picked.append(f"«{model}» не найдена — взял авто")
            model = pack.best_model(models)
            if model is None:
                if not auto_download:
                    if models:
                        model = models[0]
                        picked.append(f"взял {model.split('/')[-1]}")
                    else:
                        raise RuntimeError(f"{TAG} Нет LLM в models/LLM. Включи в ⚙ «скачивать LLM сама» или положи "
                                           f"GGUF-модель.\n\nEN: No LLM in models/LLM. Turn on auto download or add "
                                           f"a GGUF model.")
                else:
                    model, pack_mm = pack.ensure_pack(dn._llm_roots()[0], need_model=True, need_mmproj=True)
                    picked.append("📥 скачана Qwen 3.5 9B")
                    if not mmproj or mmproj == AUTO:
                        mmproj = pack_mm
            else:
                picked.append(f"авто: {model.split('/')[-1]}")
        if not mmproj or mmproj == AUTO or mmproj not in mmprojs + [f"{pack.PACK_DIR}/{pack.PACK_MMPROJ}"]:
            mm = pack.mmproj_for(model, mmprojs)
            if mm is None and auto_download:
                _, mm = pack.ensure_pack(dn._llm_roots()[0], need_model=False, need_mmproj=True)
                picked.append("📥 скачано зрение")
            mmproj = mm or "No_mmproj_Found"
        return model, mmproj, ", ".join(picked)

    def _ask(self, m, model, mmproj, system_prompt, max_tokens, temperature, n_ctx, n_gpu_layers, auto_download,
             brief, pics, last_frame):
        dn, ml, _ = m
        model, mmproj, picked = self._resolve(m, model, mmproj, auto_download)
        helper = ml.NeronMultiImageLLM()
        model_path = helper._resolve_model_path(model)
        mmproj_path = helper._resolve_mmproj_path(mmproj)
        server = dn._find_llama_server()
        if server is None:
            raise RuntimeError(f"{TAG} Не найден llama-server (программа, которая запускает LLM). Нода пробует скачать "
                               f"его сама — причина неудачи в консоли ComfyUI. Проверь интернет и перезапусти "
                               f"ComfyUI.\n\nEN: llama-server not found; see the ComfyUI console.")
        try:
            dn._ensure_server_running(server, model_path, mmproj_path, n_gpu_layers, n_ctx)
        except Exception as e:
            raise RuntimeError(f"{TAG} LLM не запустилась: {e}\n\nEN: The LLM failed to start: {e}") from None

        if not system_prompt or not (dn._PROMPTS_DIR / system_prompt).is_file():
            system_prompt = DEFAULT_PROMPT_FILE
        messages = [{"role": "system", "content": helper._load_system_text(system_prompt)}]
        shown = []
        if (pics or last_frame is not None) and not mmproj_path:
            log.warning("%s зрения (mmproj) нет — модель не увидит картинки", TAG)
        elif pics or last_frame is not None:
            items = [(f"Picture {i + 1}:", im) for i, im in enumerate(pics)]
            if last_frame is not None:
                items.append(("Last frame (the final frame of the video):", last_frame))
            for label, im in items:
                messages.append({"role": "user", "content": [
                    {"type": "text", "text": label},
                    {"type": "image_url", "image_url": {"url": ml._image_to_data_uri_small(im, max_size=768)}}]})
                messages.append({"role": "assistant", "content": "I see it."})
                shown.append(label.split(" (")[0].rstrip(":"))
        messages.append({"role": "user", "content": "Brief:\n" + brief})
        brief_dur = brief.split(" seconds", 1)[0].replace("TARGET DURATION:", "").strip()

        t0 = time.time()
        answer, tries = ml._ask_reliably(messages, max_tokens, temperature)
        if not answer:
            raise RuntimeError(f"{TAG} Модель не ответила и после трёх попыток:\n" + "\n".join(tries) +
                               "\n\nЧто сделать: в ⚙ увеличь «лимит ответа» (например, до 8192) или «окно памяти», "
                               "либо возьми модель побольше.\n\nEN: The model gave no answer after 3 tries. Raise "
                               "max_tokens or n_ctx in expert mode, or use a bigger model.")
        text = F.clean_answer(answer)
        head = text[:20].lower()
        if not text or head.startswith(("ошибка", "error", "❌", "⚠")):
            raise RuntimeError(f"{TAG} LLM не сработала / LLM failed:\n{answer}")
        # шапку и метку ставим сами — по тому, что реально подано (маленькая LLM в них путается)
        text = F.fix_header(text, len(pics), last_frame is not None, brief_dur)
        text = F.renumber_speakers(text)
        note = f"LLM {time.time() - t0:.0f} с, {model.split('/')[-1]}" + (f" ({picked})" if picked else "") + \
               f", картинки: {', '.join(shown) or 'нет — текст → видео'}"
        if tries:
            note += f", попыток {len(tries) + 1}"
        return text, note


NODE_CLASS_MAPPINGS = {"NeronH3AutoPrompterBlank": NeronH3AutoPrompterBlank}
NODE_DISPLAY_NAME_MAPPINGS = {"NeronH3AutoPrompterBlank": "🎬 Neron H3 AutoPrompter — Бланк / Form"}
