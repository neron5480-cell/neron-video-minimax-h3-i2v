# neron — ComfyUI custom nodes & workflows

[ru Русская версия — ниже. en English version — at the bottom.](#english-version)

Сборник кастомных узлов и воркфлоу для ComfyUI. Изначально это был пайплайн для генерации видео (Neron Studio H3), но теперь репозиторий разросся, и у нас появилась полноценная музыкальная студия! Репозиторий разделен на три части: пайплайн **Neron Studio H3**, новая аудио-студия **NeronAudioStudio** и старые вспомогательные ноды (в корне).

---

## 🚀 NERON STUDIO H3 PIPELINE (V1.0) — ВИДЕО

👋 Все новые комбайны, воркфлоу и инструкции теперь лежат в папке **[`Neron_Studio_H3`](Neron_Studio_H3/)**.

Наш главный пайплайн для генерации видео и звука (MiniMax H3). Полный цикл: от подготовки кадра до финальной склейки. Без «лапши» из проводов.

**Состав нового пайплайна (5 нод):**
1. **Start Frame (Interactive Image Processor)** — подготовка стартового кадра.
2. **Neron AutoPrompter** — LLM-режиссер и камера-оператор.
3. **Neron MiniMax H3 Generator** — сердце системы (вся генерация в одной ноде).
4. **Neron Video Clarity** — пост-обработка (стабилизация, дефликер, без апскейла).
5. **Video Combine** — финальная склейка.

*Инструкция по установке и модели — в README внутри папки `Neron_Studio_H3`.*

---

## 🎹 NERONAUDIOSTUDIO (BETA) — МУЗЫКА

👋 Все новые аудио-ноды теперь лежат в папке **[`NeronAudioStudio`](NeronAudioStudio/)**.

Мы превратили ComfyUI в маленькую музыкальную студию (DAW). Главная фишка: **звук играет сразу на ноде, кнопка Queue для прослушивания не нужна!** Всё работает в браузере и не нагружает видеокарту.

**Что внутри:**
*   **Drum Machine:** Пошаговый секвенсор ударных с поддержкой ваших сэмплов.
*   **Piano Roll:** Рисуем мелодии мышкой, внутри 9 синтезаторов.
*   **Audio Loader:** Загрузка и обрезка любого звука.
*   **Mixer:** До 8 каналов, громкость, баланс, Mute/Solo, синхронизация BPM и работа с видео.
*   **Video Combine:** Умная склейка видео (или пачки кадров) со звуком.

⚠️ **Важно:** Проект в стадии **Beta**. Интерфейс пока только на русском (английский будет позже), но всё интуитивно понятно. Возможны баги и сбои. Подробная инструкция по всем кнопкам и папкам лежит в **[README внутри NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 📦 Старые ноды (Legacy) — В КОРНЕ

Эти ноды остаются в корне репозитория для обратной совместимости. Если у вас уже настроены старые воркфлоу — они продолжат работать.

---

<br><br>

# English version

A collection of custom nodes and workflows for ComfyUI. What started as a video generation pipeline (Neron Studio H3) now includes a full-fledged music studio! The repository is divided into three parts: the **Neron Studio H3** pipeline, the new **NeronAudioStudio**, and legacy nodes (in the root).

---

## 🚀 NERON STUDIO H3 PIPELINE (V1.0) — VIDEO

👋 All new workflows and instructions now live in the **[`Neron_Studio_H3`](Neron_Studio_H3/)** folder.

Our main pipeline for video and audio generation (MiniMax H3). Full cycle: from frame preparation to final muxing. No "spaghetti" wires.

**New pipeline contents (5 nodes):**
1. **Start Frame (Interactive Image Processor)** — initial frame preparation.
2. **Neron AutoPrompter** — LLM director and camera operator.
3. **Neron MiniMax H3 Generator** — the core system (all generation in one node).
4. **Neron Video Clarity** — post-processing (stabilization, deflicker, no upscale).
5. **Video Combine** — final muxing.

*Installation and model instructions are in the README inside the `Neron_Studio_H3` folder.*

---

## 🎹 NERONAUDIOSTUDIO (BETA) — MUSIC

👋 All new audio nodes now live in the **[`NeronAudioStudio`](NeronAudioStudio/)** folder.

We've turned ComfyUI into a small digital audio workstation (DAW). Main feature: **audio plays directly on the node, no need to hit Queue just to listen!** Everything runs in the browser and doesn't load your GPU.

**What's inside:**
*   **Drum Machine:** Step sequencer for drums with custom sample support.
*   **Piano Roll:** Draw melodies with your mouse, 9 built-in synths.
*   **Audio Loader:** Load and trim any audio file.
*   **Mixer:** Up to 8 channels, volume, pan, Mute/Solo, BPM sync, and video support.
*   **Video Combine:** Smart muxing of video (or image batches) with audio.

⚠️ **Important:** The project is in **Beta**. The interface is currently in Russian only (English will be added later), but it's highly intuitive. Bugs and glitches are possible. Detailed instructions for all buttons and folders are in the **[README inside NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 📦 Legacy Nodes — IN ROOT

These nodes remain in the repository root for backward compatibility. If you already have old workflows set up, they will continue to work.
