# 🎬 Neron AutoPrompter (Neron Studio H3)

[🇬🇧 English below](#english)

LLM-режиссёр и камера-оператор для пайплайна Neron Studio H3. По картинке и тексту пишет технический промпт для MiniMax H3, сам считает число кадров (сетка 17k+5) и пропускает картинки дальше по схеме.

- **Режимы:** автопромтер по картинкам · только текст · ручной ввод.
- **Камера:** АВТО или пресеты (фронт, слева, справа, сзади, сверху, снизу), план и дистанция.
- **Длительность** до 15 с, fps.
- **Режим эксперта:** модель LLM, mmproj, системный промпт, токены, температура, контекст.
- Модель, mmproj и системный промпт подбираются автоматически и запоминаются.

**Выходы:** `minimax_prompt`, `frames_count`, `storyboard_json`, `img_0`, `img_1`, `img_2`, `last_frm` · **Меню:** `Neron/AutoPrompter`

**Модели LLM (GGUF)** кладутся в `ComfyUI/models/LLM/`. `llama-server` скачивается сам при первом запуске.

**Для режима АВТО** нужен системный промпт под модель (для H3 — `prompts/H3_NSFW_Engine 1.txt`).

> ℹ️ Файлы `dialog_node.py` и `multi_llm.py` в этой папке — подсобный код, из которого AutoPrompter берёт функции. Как отдельные ноды они здесь **не** регистрируются. Самостоятельные **Neron Dialog Autoprompter** и **Neron Multi-Image LLM** лежат в папке `neron_dialog_autoprompter` в корне репозитория.

---

## English

LLM director and camera operator for the Neron Studio H3 pipeline. From an image and text it writes a technical prompt for MiniMax H3, works out the frame count (17k+5 grid) and passes the images further down the graph.

- **Modes:** autoprompter from images · text only · manual input.
- **Camera:** AUTO or presets (front, left, right, back, top, bottom), framing and distance.
- **Duration** up to 15 s, fps.
- **Expert mode:** LLM model, mmproj, system prompt, tokens, temperature, context.
- Model, mmproj and system prompt are picked automatically and remembered.

**Outputs:** `minimax_prompt`, `frames_count`, `storyboard_json`, `img_0`, `img_1`, `img_2`, `last_frm` · **Menu:** `Neron/AutoPrompter`

**LLM models (GGUF)** go to `ComfyUI/models/LLM/`. `llama-server` downloads itself on the first run.

**AUTO camera mode** needs a system prompt for the model (for H3 — `prompts/H3_NSFW_Engine 1.txt`).

> ℹ️ `dialog_node.py` and `multi_llm.py` in this folder are helper code that AutoPrompter takes functions from. They are **not** registered as separate nodes here. The standalone **Neron Dialog Autoprompter** and **Neron Multi-Image LLM** live in the `neron_dialog_autoprompter` folder at the repository root.
