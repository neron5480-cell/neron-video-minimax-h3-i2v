import os
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
import folder_paths

from .dialog_node import (
    _find_llama_server,
    _ensure_server_running,
    _chat_completion,
    _detect_language_from_prompt,
    _SERVER_PORT,
    _PROMPTS_DIR,
)


def _image_to_data_uri_small(tensor, max_size: int = 512, quality: int = 80) -> str:
    """Своя, более компактная версия. Для 4 картинок — критично."""
    import io
    import base64
    img_np = (tensor[0].cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
    pil = Image.fromarray(img_np)
    w, h = pil.size
    if max(w, h) > max_size:
        scale = max_size / max(w, h)
        pil = pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    print(f"[Neron MultiLLM]   картинка: {pil.size[0]}x{pil.size[1]}, "
          f"{len(buf.getvalue()) / 1024:.0f} КБ → base64 {len(b64) / 1024:.0f} КБ")
    return f"data:image/jpeg;base64,{b64}"


class NeronMultiImageLLM:
    """
    Многокартиночный LLM-процессор — независимая нода.
    Принимает до 4 картинок + промпт + системник. Возвращает текст.
    Использует общий llama-server с Neron Dialog Autoprompter.
    """

    @classmethod
    def INPUT_TYPES(cls):
        try:
            llm_dir = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            llm_dir = Path(__file__).resolve().parent / ".." / ".." / "models" / "LLM"
        llm_dir.mkdir(parents=True, exist_ok=True)

        all_gguf = [f for f in os.listdir(llm_dir) if f.endswith(".gguf")]
        models = [m for m in all_gguf if "mmproj" not in m.lower()]
        if not models:
            models = ["No_GGUF_Models_Found"]

        mmprojs = ["No_mmproj_Found"] + [m for m in all_gguf if "mmproj" in m.lower()]

        prompts = []
        try:
            if _PROMPTS_DIR.exists():
                prompts.extend([f for f in os.listdir(_PROMPTS_DIR) if f.endswith(".txt")])
        except Exception:
            pass
        try:
            llm_prompts_dir = llm_dir / "prompts"
            if llm_prompts_dir.exists():
                for f in os.listdir(llm_prompts_dir):
                    if f.endswith(".txt") and f not in prompts:
                        prompts.append(f)
        except Exception:
            pass
        if not prompts:
            prompts = ["No_prompt_Found"]

        return {
            "required": {
                "model": (models,),
                "mmproj": (mmprojs,),
                "system_prompt": (prompts,),
                "prompt": ("STRING", {
                    "multiline": True,
                    "default": "",
                }),
                "max_tokens": ("INT", {"default": 4096, "min": 1, "max": 32768}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.05}),
                "n_ctx": ("INT", {"default": 8192, "min": 512, "max": 32768}),
                "n_gpu_layers": ("INT", {"default": -1, "min": -1, "max": 999}),
            },
            "optional": {
                "prompt_in": ("STRING", {"forceInput": True}),
                "image_0": ("IMAGE",),
                "image_1": ("IMAGE",),
                "image_2": ("IMAGE",),
                "last_frame": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("RESPONSE",)
    FUNCTION = "generate"
    CATEGORY = "Neron/LLM"

    def _resolve_model_path(self, model_name: str) -> Path:
        try:
            base = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            base = Path(__file__).resolve().parent / ".." / ".." / "models" / "LLM"
        return base / model_name

    def _resolve_mmproj_path(self, mmproj_name: str) -> str:
        if not mmproj_name or mmproj_name == "No_mmproj_Found":
            return ""
        try:
            base = Path(folder_paths.models_dir) / "LLM"
        except Exception:
            base = Path(__file__).resolve().parent / ".." / ".." / "models" / "LLM"
        path = base / mmproj_name
        return str(path) if path.exists() else ""

    def _load_system_text(self, system_prompt: str) -> str:
        if not system_prompt or system_prompt == "No_prompt_Found":
            return "Ты — полезный ассистент."

        try:
            path = _PROMPTS_DIR / system_prompt
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read().strip()
                if text:
                    return text
        except Exception as e:
            print(f"[Neron MultiLLM] Ошибка чтения {system_prompt}: {e}")

        try:
            llm_prompts = Path(folder_paths.models_dir) / "LLM" / "prompts" / system_prompt
            if llm_prompts.exists():
                with open(llm_prompts, "r", encoding="utf-8") as f:
                    text = f.read().strip()
                if text:
                    return text
        except Exception:
            pass

        return "Ты — полезный ассистент."

    def _build_messages(self, user_text: str, images: dict, lang: str) -> list:
        messages = []

        order = ["image_0", "image_1", "image_2", "last_frame"]
        present = [s for s in order if s in images]

        if lang == "en":
            img_prefix = "Picture"
            last_prefix = "Last frame (final frame):"
            ack_suffix = "I see"
        else:
            img_prefix = "Picture"
            last_prefix = "Last frame (финальный кадр):"
            ack_suffix = "Вижу"

        pic_idx = 1
        for slot in present:
            if slot == "last_frame":
                label = last_prefix
                ack = "I see the last frame." if lang == "en" else "Вижу последний кадр."
            else:
                label = f"{img_prefix} {pic_idx}:"
                ack = f"{ack_suffix} {label.lower()}"
                pic_idx += 1

            try:
                data_uri = _image_to_data_uri_small(images[slot])
            except Exception as e:
                print(f"[Neron MultiLLM] Ошибка картинки {slot}: {e}")
                continue

            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": label},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            })
            messages.append({"role": "assistant", "content": ack})

        messages.append({"role": "user", "content": user_text})

        return messages

    def generate(
        self,
        model, mmproj, system_prompt,
        prompt, max_tokens, temperature, n_ctx, n_gpu_layers,
        prompt_in=None,
        image_0=None, image_1=None, image_2=None, last_frame=None,
    ):
        if model == "No_GGUF_Models_Found":
            return ("Ошибка: нет моделей в models/LLM/",)

        model_path = self._resolve_model_path(model)
        mmproj_path = self._resolve_mmproj_path(mmproj)

        server_exe = _find_llama_server()
        if server_exe is None:
            return ("Ошибка: llama-server.exe не найден.",)

        try:
            _ensure_server_running(server_exe, model_path, mmproj_path, n_gpu_layers, n_ctx)
        except Exception as e:
            return (f"Ошибка запуска llama-server: {e}",)

        system_text = self._load_system_text(system_prompt)
        lang = _detect_language_from_prompt(system_prompt)

        # ── prompt_in имеет приоритет над виджетом prompt ──
        if prompt_in and prompt_in.strip():
            user_text = prompt_in.strip()
            print(f"[Neron MultiLLM] Промпт из входа (prompt_in), {len(user_text)} символов")
        else:
            user_text = (prompt or "").strip()
            if user_text:
                print(f"[Neron MultiLLM] Промпт из виджета, {len(user_text)} символов")

        if not user_text:
            user_text = "Опиши, что видишь." if lang == "ru" else "Describe what you see."
            print("[Neron MultiLLM] ⚠ Промпт пустой — использую заглушку")

        images = {}
        if image_0 is not None:
            images["image_0"] = image_0
        if image_1 is not None:
            images["image_1"] = image_1
        if image_2 is not None:
            images["image_2"] = image_2
        if last_frame is not None:
            images["last_frame"] = last_frame

        messages = [{"role": "system", "content": system_text}]

        if images and mmproj_path:
            print(f"[Neron MultiLLM] Собираю {len(images)} картинок (512px, JPEG 80)...")
            messages.extend(self._build_messages(user_text, images, lang))
        else:
            messages.append({"role": "user", "content": user_text})

        print(f"[Neron MultiLLM] Отправка. Модель: {model}")
        t0 = time.time()
        try:
            response = _chat_completion(messages, max_tokens, temperature, _SERVER_PORT)
            answer = response["choices"][0]["message"]["content"]
            gen_time = time.time() - t0

            if not answer or not answer.strip():
                answer = "⚠ МОДЕЛЬ ОТВЕТИЛА ПУСТО"

            print(f"[Neron MultiLLM] Готово за {gen_time:.2f} сек")
            print(f"[Neron MultiLLM] === ОТВЕТ ===")
            print(answer)
            print(f"[Neron MultiLLM] ================")

            return (answer,)

        except Exception as e:
            answer = f"Ошибка запроса: {e}"
            print(f"[Neron MultiLLM] {answer}")
            return (answer,)