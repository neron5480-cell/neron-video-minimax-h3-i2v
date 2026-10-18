# 🎬 NERON STUDIO — MiniMax H3 Pipeline

---

## 🇷🇺 РУССКИЙ

**Набор кастомных нод для ComfyUI под генерацию видео и звука на MiniMax H3.**

### 📖 О ПРОЕКТЕ
Сборка из 4 кастомных нод, которые заменяют 30+ стандартных узлов. Провода не путаются, память не забивается.

### ✨ ОСОБЕННОСТИ
*   **Минимум нод.** 4 штуки вместо 30+.
*   **Очистка памяти (Гострабайтер).** Загрузили модель, отработали, выгрузили. Память не копится от прогона к прогону.
*   **Заточка под MiniMax H3.** Без лишних универсальных функций.
*   **Удобный интерфейс.** Цветовые группы для настроек, встроенная справка на двух языках.
*   **Соблюдение кратности.** Видео всегда кратно 17 кадрам, картинка — 32 пикселям.

### 📦 ЧТО ВНУТРИ
1. **🖼 Interactive Image Processor (Start Frame)** — Подготовка кадра: ресайз, цветокоррекция, живое превью.
2. **🎬 Neron Dialog AutoPrompter** — LLM-режиссер. Генерирует технический промпт по картинке и тексту. Понимает первый и последний кадр. Имеет сквозные выходы для картинок (работает автономно).
3. **🎥 Neron MiniMax H3 Generator** — Сам генератор. Внутри — UNET, CLIP, VAE, LoRA. Режимы Turbo (8 шагов) и Normal (20). Умный VAE-декод.
4. **🎬 Neron Video Clarity** — Пост-обработка. Стабилизация, дефликер, цвет, резкость. RIFE строго ПОСЛЕ стабилизации. Вытягивает качество на низких разрешениях (320х320, 384х512). Выдает очищенный `last_frame` для склейки видео.

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
*   **Fewer nodes.** 4 instead of 30+.
*   **Memory Management (Go-on-Worker).** Load model, process, unload. Memory doesn't accumulate between runs.
*   **H3 Specific.** No unnecessary universal features.
*   **Clean UI.** Colored setting groups, built-in bilingual help.
*   **Correct Multiples.** Video is always a multiple of 17 frames, image — 32 pixels.

### 📦 WHAT'S INSIDE
1. **🖼 Interactive Image Processor (Start Frame)** — Frame prep: resize, color correction, live preview.
2. **🎬 Neron Dialog AutoPrompter** — LLM director. Generates technical prompts based on image and text. Understands first/last frames. Has passthrough image outputs (works autonomously).
3. **🎥 Neron MiniMax H3 Generator** — The generator itself. Inside — UNET, CLIP, VAE, LoRA. Turbo (8 steps) and Normal (20) modes. Smart VAE decode.
4. **🎬 Neron Video Clarity** — Post-processing. Stabilization, deflicker, color, sharpness. RIFE strictly AFTER stabilization. Pulls quality at low resolutions (320x320, 384x512). Outputs a cleaned `last_frame` for video stitching.

### 🚀 WORKFLOWS
*   **`Neron_H3_Full_Pipeline.json`** — Full process with LLM auto-prompter, Generator, and Clarity.
*   **`Neron_H3_Raw_Engine.json`** — Base process. Generator only, no LLM or post-processing. For manual prompt entry.

*Instructions on models, download links, and settings are located directly on the workflow canvas (Note node).*

### 📜 LICENSE
Free to use, modify and publish. Credit appreciated.
