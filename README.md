# Neron's ComfyUI Projects

[ru Русская версия — ниже. en English version — at the bottom.](#english-version)

Привет, друзья! 

В этом репозитории живут мои кастомные ноды для ComfyUI. Здесь собраны **два абсолютно независимых проекта**: один для видео, другой для музыки. Вы можете использовать их по отдельности или вместе, как вам удобно.

---

## 🎬 Проект 1: NERON STUDIO H3 (Видео-генерация)

👋 Все комбайны, воркфлоу и инструкции лежат в папке **[`Neron_Studio_H3`](Neron_Studio_H3/)**.

Это мой основной пайплайн для генерации видео и звука (MiniMax H3). Полный цикл: от подготовки стартового кадра до финальной склейки. Без «лапши» из проводов.

**Состав пайплайна (5 нод):**
1. **Start Frame (Interactive Image Processor)** — подготовка стартового кадра.
2. **Neron AutoPrompter** — LLM-режиссер и камера-оператор.
3. **Neron MiniMax H3 Generator** — сердце системы (вся генерация в одной ноде).
4. **Neron Video Clarity** — пост-обработка (стабилизация, дефликер, без апскейла).
5. **Video Combine** — финальная склейка.

*Инструкция по установке и модели — в README внутри папки `Neron_Studio_H3`.*

---

## 🎹 Проект 2: NERONAUDIOSTUDIO (Музыкальная студия)

👋 Все аудио-ноды лежат в папке **[`NeronAudioStudio`](NeronAudioStudio/)**.

Это отдельный проект, который превращает ComfyUI в маленькую музыкальную студию (DAW). 

**Что внутри:**
*   **Drum Machine:** Пошаговый секвенсор ударных (как в FL Studio) с поддержкой ваших сэмплов.
*   **Piano Roll:** Рисуем мелодии мышкой, внутри 9 встроенных синтезаторов.
*   **Audio Loader:** Загрузка, прослушивание и обрезка любого звукового файла.
*   **Mixer:** До 8 каналов. Громкость, баланс, Mute/Solo, синхронизация BPM и работа с видео (полная замена/вырезание звука, наложение своих дорожек, синхронизация по длине).
*   **Video Combine:** Умная склейка видео (или пачки кадров) со сведенным звуком.

Главная фишка: **звук играет сразу на ноде, кнопка Queue для прослушивания не нужна!** Всё работает в браузере и не нагружает видеокарту.

⚠️ **Важно:** Проект в стадии **Beta**. Интерфейс пока только на русском (английский будет позже), но всё интуитивно понятно. Возможны баги. Подробная инструкция по всем кнопкам и папкам лежит в **[README внутри NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 📦 Старые ноды (Legacy) — В КОРНЕ

Эти ноды (например, Lora-Selector, Static-Camera) остаются в корне репозитория для обратной совместимости. Если у вас уже настроены старые воркфлоу — они продолжат работать.

---
<br><br>

# English version

Hi friends!

This repository contains my custom nodes for ComfyUI. It holds **two completely independent projects**: one for video, one for music. You can use them separately or together, however you like.

---

## 🎬 Project 1: NERON STUDIO H3 (Video Generation)

👋 All workflows and instructions live in the **[`Neron_Studio_H3`](Neron_Studio_H3/)** folder.

This is my main pipeline for video and audio generation (MiniMax H3). Full cycle: from initial frame preparation to final muxing. No "spaghetti" wires.

**Pipeline contents (5 nodes):**
1. **Start Frame (Interactive Image Processor)** — initial frame preparation.
2. **Neron AutoPrompter** — LLM director and camera operator.
3. **Neron MiniMax H3 Generator** — the core system (all generation in one node).
4. **Neron Video Clarity** — post-processing (stabilization, deflicker, no upscale).
5. **Video Combine** — final muxing.

*Installation and model instructions are in the README inside the `Neron_Studio_H3` folder.*

---

## 🎹 Project 2: NERONAUDIOSTUDIO (Music Studio)

👋 All audio nodes live in the **[`NeronAudioStudio`](NeronAudioStudio/)** folder.

This is a separate project that turns ComfyUI into a small digital audio workstation (DAW).

**What's inside:**
*   **Drum Machine:** Step sequencer for drums (like FL Studio) with custom sample support.
*   **Piano Roll:** Draw melodies with your mouse, 9 built-in synths.
*   **Audio Loader:** Load, listen, and trim any audio file.
*   **Mixer:** Up to 8 channels. Volume, pan, Mute/Solo, BPM sync, and video support (fully replace/mute video audio, overlay multiple tracks, sync by length).
*   **Video Combine:** Smart muxing of video (or image batches) with the mixed audio.

Main feature: **audio plays directly on the node, no need to hit Queue just to listen!** Everything runs in the browser and doesn't load your GPU.

⚠️ **Important:** The project is in **Beta**. The interface is currently in Russian only (English will be added later), but it's highly intuitive. Bugs are possible. Detailed instructions for all buttons and folders are in the **[README inside NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 📦 Legacy Nodes — IN ROOT

These nodes (e.g., Lora-Selector, Static-Camera) remain in the repository root for backward compatibility. If you already have old workflows set up, they will continue to work.
