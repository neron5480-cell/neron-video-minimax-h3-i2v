# 🎬 NERON STUDIO — MiniMax H3 Pipeline

---

## 🇷🇺 РУССКИЙ

**Полноценный пайплайн для генерации видео и звука в ComfyUI. Собрано с нуля под H3.**

### 📖 О ПРОЕКТЕ
**Neron Studio** — это набор кастомных нод для ComfyUI, объединенных в единый конвейер. Мы убрали 30+ стандартных нод, заменив их на 4 мощных комбайна. Никакой «лапши» из проводов, только функционал, скорость и чистота.

### ✨ ГЛАВНЫЕ ПРИНЦИПЫ
*   **Одна нода = один комбайн.** Максимальная концентрация функционала.
*   **Гострабайтер (Go-on-Worker).** Ноды не держат память. Загрузили, отработали, выгрузили (VRAM и RAM чистые).
*   **Только H3.** Заточка под MiniMax H3, а не универсальная «солянка».
*   **Красота.** Фирменный стиль Neron Studio (коричневый бренд, цветные группы, двуязычный интерфейс).
*   **Кратность.** Видео всегда кратно 17 кадрам, картинка — 32 пикселям.

### 📦 ЧТО ВНУТРИ
1. **🖼 Interactive Image Processor (Start Frame)** — Подготовка кадра: ресайз, цветокоррекция, живое превью. Всегда кратно 32.
2. **🎬 Neron Dialog AutoPrompter** — LLM-режиссер. Пишет технический промпт, понимает первый/последний кадр, имеет сквозные выходы для картинок. Работает автономно (подходит для LTX, Wan, Flux).
3. **🎥 Neron MiniMax H3 Generator** — Сердце пайплайна. Внутри — UNET, CLIP, VAE, LoRA. Режимы Turbo (8 шагов) и Normal (20). Умный VAE-декод. Включает жесткий контроль памяти (Гострабайтер).
4. **🎬 Neron Video Clarity** — Пост-обработка. Стабилизация, дефликер, цвет, резкость. RIFE строго ПОСЛЕ стабилизации. Идеально вытягивает низкие разрешения (320х320, 384х512). Выдает очищенный `last_frame` для бесшовной склейки видео.

### 🚀 ВОРКФЛОУ
*   **`Neron_H3_Full_Pipeline.json`** — Флагманская сборка. Включает LLM-автопромптер, Генератор и Clarity.
*   **`Neron_H3_Raw_Engine.json`** — Базовый процесс. Чистый Генератор без LLM и постобработки. Для ручного ввода промптов.

*Инструкция по моделям, ссылкам на скачивание и настройкам находится прямо на холсте воркфлоу (нода Note "ВНИМАНИЕ! ПРОЧТИ МЕНЯ!").*

### 📜 ЛИЦЕНЗИЯ
Свободно для использования, модификации и публикации. Ссылка на автора приветствуется.

---
---

## 🇬🇧 ENGLISH

**A complete video & audio generation pipeline for ComfyUI. Built from scratch for H3.**

### 📖 ABOUT
**Neron Studio** is a suite of custom ComfyUI nodes combined into a single pipeline. We replaced 30+ standard nodes with 4 powerful machines. No spaghetti wiring, just function, speed, and beauty.

### ✨ CORE PRINCIPLES
*   **One node = one machine.** Maximum concentration of functionality.
*   **Go-on-Worker.** Nodes do not hold memory. Load, process, unload (clean VRAM and RAM).
*   **H3 Only.** Tailored for MiniMax H3, not a universal "hodgepodge".
*   **Beauty.** Neron Studio brand style (brown theme, colored groups, bilingual interface).
*   **Multiples.** Video is always a multiple of 17 frames, image — 32 pixels.

### 📦 WHAT'S INSIDE
1. **🖼 Interactive Image Processor (Start Frame)** — Frame preparation: resize, color correction, live preview. Always a multiple of 32.
2. **🎬 Neron Dialog AutoPrompter** — LLM director. Writes technical prompts, understands first/last frames, has passthrough image outputs. Works autonomously (suitable for LTX, Wan, Flux).
3. **🎥 Neron MiniMax H3 Generator** — The heart of the pipeline. Inside — UNET, CLIP, VAE, LoRA. Turbo (8 steps) and Normal (20) modes. Smart VAE decode. Includes strict memory control (Go-on-Worker).
4. **🎬 Neron Video Clarity** — Post-processing. Stabilization, deflicker, color, sharpness. RIFE strictly AFTER stabilization. Perfectly pulls low resolutions (320x320, 384x512). Outputs a cleaned `last_frame` for seamless video stitching.

### 🚀 WORKFLOWS
*   **`Neron_H3_Full_Pipeline.json`** — Flagship build. Includes LLM auto-prompter, Generator, and Clarity.
*   **`Neron_H3_Raw_Engine.json`** — Base process. Pure Generator without LLM and post-processing. For manual prompt entry.

*Instructions on models, download links, and settings are located directly on the workflow canvas (Note node "ATTENTION! READ ME!").*

### 📜 LICENSE
Free to use, modify and publish. Credit appreciated.
