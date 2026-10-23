 🎬 NERON STUDIO — MiniMax H3 Pipeline

---

## 🇷🇺 РУССКИЙ

**Набор кастомных нод для ComfyUI под генерацию видео и звука на MiniMax H3.**

### 📖 О ПРОЕКТЕ
Сборка из 4 кастомных нод, которые заменяют 30+ стандартных узлов. Провода не путаются, память не забивается.

### ✨ ОСОБЕННОСТИ
*   **Автономность.** Все ноды (кроме Генератора) работают независимо. `AutoPrompter` можно подключать к LTX, Wan, Flux. `Clarity` — к любому видео. `Start Frame` — к любому пайплайну.
*   **Минимум нод.** 4 штуки вместо 30+.
*   **Очистка памяти (Гострабайтер).** Загрузили модель, отработали, выгрузили. Память не копится от прогона к прогону.
*   **Удобный интерфейс.** Цветовые группы для настроек, встроенная справка на двух языках.
*   **Соблюдение кратности.** Видео всегда кратно 17 кадрам, картинка — 32 пикселям.

### ⚙️ ВАЖНЫЕ НЮАНСЫ
*   **Легкие модели.** Если ваше железо не тянет стандартные файлы, зайдите в `EXPERT MODE` и выберите более легкие версии (например, квант `Q4_K_M` для LLM, `FP8` или `GGUF` для H3).
*   **Управление камерой.** В `AutoPrompter` есть жесткие пресеты (`FRONT`, `LEFT`, `TOP` и т.д.). Для режима `AUTO` требуется загрузить системный промпт, заточенный под конкретную модель (для H3 это `H3_NSFW_Engine 1.txt`).

### 📦 ЧТО ВНУТРИ
1. **🖼 Neron Studio Image Processor (Start Frame)** — Подготовка кадра: ресайз, цветокоррекция, живое превью.
2. **🎬 Neron AutoPrompter** — LLM-режиссер. Генерирует технический промпт по картинке и тексту. Понимает первый и последний кадр. Имеет сквозные выходы для картинок.
3. **🎥 Neron MiniMax H3 Generator** — Сам генератор (единственная нода, заточенная под MiniMax H3). Внутри — UNET, CLIP, VAE, LoRA. Режимы Turbo (8 шагов) и Normal (20). Умный VAE-декод.
4. **🎬 Neron Video Clarity** — Пост-обработка. Стабилизация, дефликер, цвет, резкость. RIFE строго ПОСЛЕ стабилизации. Вытягивает качество на низких разрешениях (320х320, 384х512). Выдает очищенный `last_frame` для склейки видео.

### 🧩 УСТАНОВКА
*   **Проще всего — одной ссылкой** через ComfyUI Manager → Install via Git URL (см. [README в корне](../README.md)). Встанут все ноды сразу.
*   **Вручную:** скопируйте в `ComfyUI/custom_nodes/` **папки изнутри** `Neron_Studio_H3`, каждую отдельно:

| Папка | Нода |
|---|---|
| `NeronStudio-Image-Processor` | 🖼 Neron Studio Image Processor |
| `NeronStudio-AutoPrompter` | 🎬 Neron AutoPrompter |
| `neron_minimax_h3_generator` | 🎥 Neron MiniMax H3 Generator |
| `NeronVideoClarity` | 🎬 Neron Video Clarity |

> ⚠️ **Обновляетесь со старой версии?** Раньше две папки здесь назывались `ComfyUI-Interactive-Processor` и `neron_dialog_autoprompter` — **так же, как самостоятельные ноды в корне**. Из-за этого при ручной установке одна папка молча заменяла другую. Теперь у студийных нод свои имена. Удалите из `custom_nodes` папки `ComfyUI-Interactive-Processor` и `neron_dialog_autoprompter` и поставьте заново то, что нужно: студийные ноды из этой папки, а самостоятельные из корня — если вы ими пользуетесь. Ваши сохранённые воркфлоу студии откроются как раньше: старая нода сама переведётся на новое имя.

### 🚀 ВОРКФЛОУ
*   **`Neron_H3_Full_Pipeline.json`** — Полный процесс с LLM-автопромптером, Генератором и Clarity.
*   **`Neron_H3_Raw_Engine.json`** — Базовый процесс. Только Генератор без LLM и постобработки. Для ручного ввода промптов.

*Инструкция по моделям, ссылкам на скачивание и настройкам находится прямо на холсте воркфлоу (нода Note).*

### 📜 ЛИЦЕНЗИЯ
Свободно для использования, модификации и публикации. Ссылка на автора приветствуется.

---
---

## 🇬🇧 ENGLISH

**A set of custom ComfyUI nodes for video and audio generation on MiniMax H3.**

### 📖 ABOUT
A build of 4 custom nodes that replace 30+ standard nodes. No messy wires, no memory bloat.

### ✨ FEATURES
*   **Autonomy.** All nodes (except the Generator) work independently. `AutoPrompter` can be connected to LTX, Wan, Flux. `Clarity` — to any video. `Start Frame` — to any pipeline.
*   **Fewer nodes.** 4 instead of 30+.
*   **Memory Management (Go-on-Worker).** Load model, process, unload. Memory doesn't accumulate between runs.
*   **Clean UI.** Colored setting groups, built-in bilingual help.
*   **Correct Multiples.** Video is always a multiple of 17 frames, image — 32 pixels.

### ⚙️ IMPORTANT NOTES
*   **Lighter models.** If your hardware struggles with the default files, open `EXPERT MODE` and select lighter versions (e.g., `Q4_K_M` quantization for LLM, `FP8` or `GGUF` for H3).
*   **Camera control.** `AutoPrompter` has hardcoded presets (`FRONT`, `LEFT`, `TOP`, etc.). For `AUTO` mode, you need to load a system prompt tailored to the specific model (for H3 it's `H3_NSFW_Engine 1.txt`).

### 📦 WHAT'S INSIDE
1. **🖼 Neron Studio Image Processor (Start Frame)** — Frame prep: resize, color correction, live preview.
2. **🎬 Neron AutoPrompter** — LLM director. Generates technical prompts based on image and text. Understands first/last frames. Has passthrough image outputs.
3. **🎥 Neron MiniMax H3 Generator** — The generator itself (the only node tailored specifically for MiniMax H3). Inside — UNET, CLIP, VAE, LoRA. Turbo (8 steps) and Normal (20) modes. Smart VAE decode.
4. **🎬 Neron Video Clarity** — Post-processing. Stabilization, deflicker, color, sharpness. RIFE strictly AFTER stabilization. Pulls quality at low resolutions (320x320, 384x512). Outputs a cleaned `last_frame` for video stitching.

### 🧩 INSTALLATION
*   **Easiest — one link** via ComfyUI Manager → Install via Git URL (see the [root README](../README.md)). All nodes are installed at once.
*   **Manually:** copy the **folders inside** `Neron_Studio_H3` into `ComfyUI/custom_nodes/`, each one separately:

| Folder | Node |
|---|---|
| `NeronStudio-Image-Processor` | 🖼 Neron Studio Image Processor |
| `NeronStudio-AutoPrompter` | 🎬 Neron AutoPrompter |
| `neron_minimax_h3_generator` | 🎥 Neron MiniMax H3 Generator |
| `NeronVideoClarity` | 🎬 Neron Video Clarity |

> ⚠️ **Updating from an older version?** Two folders here used to be called `ComfyUI-Interactive-Processor` and `neron_dialog_autoprompter` — **the same as the standalone nodes in the root**, so with a manual install one folder silently replaced the other. The Studio nodes now have their own names. Delete the `ComfyUI-Interactive-Processor` and `neron_dialog_autoprompter` folders from `custom_nodes` and install again what you need: the Studio nodes from this folder, and the standalone ones from the root if you use them. Your saved Studio workflows open as before: the old node switches to the new name by itself.

### 🚀 WORKFLOWS
*   **`Neron_H3_Full_Pipeline.json`** — Full process with LLM auto-prompter, Generator, and Clarity.
*   **`Neron_H3_Raw_Engine.json`** — Base process. Generator only, no LLM or post-processing. For manual prompt entry.

*Instructions on models, download links, and settings are located directly on the workflow canvas (Note node).*

### 📜 LICENSE
Free to use, modify and publish. Credit appreciated.
