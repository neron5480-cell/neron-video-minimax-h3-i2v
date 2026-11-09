# 🎬 Neron Dialog Autoprompter — режиссёр в чате / a director in a chat

## 🇷🇺 Русский

**Что это.** Нода, которая **разговаривает с вами**, как опытный кинорежиссёр, и сама собирает промпт для
MiniMax H3. Не нужно писать промпт и искать образцы: рассказываете своими словами, режиссёр переспрашивает и
предлагает, а в конце выдаёт готовый промпт. На ней построен процесс **Smart MiniMax H3 «Диалог»**.

В пакете две ноды:
- **🎬 Neron Dialog Autoprompter** — сам режиссёр: чат прямо на ноде.
- **🧠 Neron Multi-Image LLM** — превращает художественное описание в технический промпт для MiniMax H3.
  Видит несколько картинок сразу.

**Что умеет**
- 💬 **Разговор с режиссёром** — простыми словами, по-русски или по-английски.
- 🖼 **До 4 картинок-образцов** — главный кадр, 2 дополнительных образца, последний кадр. Картинки проходят через
  ноду дальше, к генератору.
- 🌫 **Работает и без картинок** — подставляет чёрный кадр-заглушку, генератор рисует с нуля (режим «текст → видео»).
- 📝 **Карточка промпта** — готовый промпт появляется в карточке с кнопками «✏️ Исправить» и «✅ Готово».
- 📐 **Размер кадра** — пресеты (по умолчанию «Кино 16:9 (1344×768)») или вручную; ширина и высота выходят из ноды
  проводами.
- 🧠 **Автовыбор** — модель, mmproj и системный промпт подбираются сами, последний выбор запоминается.
- 🌐 **Два языка режиссёра** — системные промпты `director_H3_ru.txt` и `director_H3_en.txt` (папка `prompts`).
- 💾 **Сессии** — разговор можно сохранить под своим именем и продолжить позже; «очистить историю» — начать заново.
- ⚙ **Режим эксперта** — длина ответа, температура, размер контекста, слои на видеокарте.

**Сервер LLM (llama-server) — сам.** Нода ищет llama-server по порядку: в своей папке `vendor`, в соседнем пакете
ComfyUI-LLM-text-processor (если он у вас стоит), у соседнего автопромтера Neron. Не нашла — **скачивает сама** свежий
llama.cpp под вашу видеокарту (сборка CUDA под версию драйвера; если не подходит — Vulkan или процессор). Оба
автопромтера Neron делят один сервер — видеопамять не удваивается.

**Что нужно**
- Свежий ComfyUI.
- Vision-модель в формате GGUF (Qwen 2.5-VL, Qwen 3.5, LLaVA, MiniCPM-V и др.) и подходящий к ней файл `mmproj` —
  в папку `models/LLM`. **Модель сама не скачивается** — положите её туда вручную (обе — с одной страницы модели).
- Видеопамять: от 8 ГБ для модели 7B, от 16 ГБ для 9B.

**Установка.** Одной ссылкой (ComfyUI Manager → Install via Git URL →
`https://github.com/neron5480-cell/neron-video-minimax-h3-i2v`) — встанут все ноды Neron, эта тоже. Или вручную:
папку `neron_dialog_autoprompter` — в `ComfyUI/custom_nodes/`, перезапустить ComfyUI. Нода — в меню **Neron/Dialog**.

---

## 🇬🇧 English

**What it is.** A node that **talks to you** like an experienced film director and builds the MiniMax H3 prompt
itself. No prompt writing and no hunting for references: you tell it in your own words, the director asks back and
suggests, and at the end gives you a finished prompt. The **Smart MiniMax H3 "Dialogue"** workflow is built on it.

The pack has two nodes:
- **🎬 Neron Dialog Autoprompter** — the director itself: a chat right on the node.
- **🧠 Neron Multi-Image LLM** — turns the artistic description into a technical prompt for MiniMax H3. It sees
  several pictures at once.

**What it can do**
- 💬 **A talk with the director** — in plain words, in Russian or English.
- 🖼 **Up to 4 reference pictures** — main frame, 2 extra references, last frame. The pictures pass through the node
  on to the generator.
- 🌫 **Works without pictures too** — puts in a black placeholder frame, and the generator draws from scratch
  (text-to-video mode).
- 📝 **Prompt card** — the finished prompt appears in a card with «✏️ Исправить» (edit) and «✅ Готово» (done) buttons.
- 📐 **Frame size** — presets (by default «Кино 16:9 (1344×768)», cinema 16:9) or manual; width and height leave the
  node as wires.
- 🧠 **Auto-select** — model, mmproj and system prompt are picked by themselves; the last choice is remembered.
- 🌐 **Two director languages** — system prompts `director_H3_ru.txt` and `director_H3_en.txt` (the `prompts` folder).
- 💾 **Sessions** — save a conversation under your own name and continue later; «clear history» starts over.
- ⚙ **Expert mode** — answer length, temperature, context size, layers on the GPU.

**LLM server (llama-server) — by itself.** The node looks for llama-server in order: in its own `vendor` folder, in
the neighbouring ComfyUI-LLM-text-processor pack (if you have it), at the neighbouring Neron autoprompter. Not found —
it **downloads by itself** a fresh llama.cpp for your GPU (a CUDA build for your driver's version; if that does not
fit — Vulkan or CPU). Both Neron autoprompters share one server — video memory is not doubled.

**What you need**
- A recent ComfyUI.
- A vision model in GGUF format (Qwen 2.5-VL, Qwen 3.5, LLaVA, MiniCPM-V, etc.) and the `mmproj` file that matches
  it — into the `models/LLM` folder. **The model is not downloaded by itself** — put it there by hand (both files from
  the same model page).
- Video memory: 8 GB or more for a 7B model, 16 GB or more for 9B.

**Installation.** By one link (ComfyUI Manager → Install via Git URL →
`https://github.com/neron5480-cell/neron-video-minimax-h3-i2v`) — all Neron nodes are installed, this one included.
Or manually: put the `neron_dialog_autoprompter` folder into `ComfyUI/custom_nodes/` and restart ComfyUI. The node is
in the **Neron/Dialog** menu.
