 Neron's ComfyUI Projects

[ru Русская версия — ниже. en English version — at the bottom.](#english-version)

Привет, друзья! 

В этом репозитории живут мои кастомные ноды для ComfyUI. Здесь собраны **три абсолютно независимых проекта**: генерация видео, пост-обработка видео и музыка. Вы можете использовать их по отдельности или вместе, как вам удобно.

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

## 🎛 Проект 2: PERCEPTION RELAY — Эстафета восприятия (Пост-обработка видео)

👋 Все ноды, воркфлоу и инструкции лежат в папке **[`ComfyUI-PerceptionRelay`](ComfyUI-PerceptionRelay/)**.

ИИ-видео выглядит «неживым» не из-за разрешения. Причина в том, что мозгу зрителя мешают: детали «кипят» и ползут, глаза и контур лица дрожат, тени плоские, цвет растекается за границы. **Эстафета не дорисовывает ни одной детали.** Она убирает то, что мешает, а дальше мозг сам видит картинку чёткой и живой. Работает с любым видео, в том числе с роликами из H3.

**Главная фишка — 🎛 Пульт с живым предпросмотром.** Крутишь любой ползунок, и через долю секунды видишь кадр до 2K. Есть шторка «до / после», лупа в полном разрешении и кнопка **▶ проиграть 1 с**: она показывает секунду ролика по кругу, чтобы видеть дрожь, а не стоп-кадр.

**Карточки этапов** (каждая втыкается в Пульт одним проводом, в любом порядке):
*   **👁 Разведка** — находит лица и глаза, следит за ними.
*   **🌊 Поток** — движение между кадрами (RAFT или DIS без скачивания).
*   **⚖ Судья** — отличает физику от дрейфа и гасит «кипение» деталей. Честное движение не трогает.
*   **💎 Огранка** — резкость только по краям и только там, где край стоит во времени.
*   **🌑 Тональный скелет** — тени и чёрное как каркас картинки: глубина и объём без потери деталей.
*   **🎨 Цветовой шов** — чистые границы цвета без кайм и «бритвы».
*   **✨ Полировка** — дефликер, свет, плавность (×2 полукадр или смаз по движению).
*   **🎚 Основное** — простые яркость, контраст, резкость, насыщенность.
*   **🎯 Точки внимания** — глаза и контур лица до «фокуса объектива».

**На выходе:** кадры, звук и fps для Create Video, видео-сравнение «до / после» и **отчёт** с настройками и работой каждого этапа. В отчёте нет путей, имён файлов и самого видео, поэтому его можно смело присылать мне. Из ваших отчётов соберём пресеты.

**Железо:** 12–16 ГБ видеопамяти, 32–48 ГБ ОЗУ. Модели крошечные: детектор лиц 230 КБ и RAFT ~20 МБ, качаются сами. Ноды на русском и английском.

⚠️ **Важно:** проект в стадии **Alpha**. Возможны баги, ваши отчёты очень помогут. Установка, описание всех ползунков и «что делать, если…» — в **[README внутри ComfyUI-PerceptionRelay](ComfyUI-PerceptionRelay/README.md)** и в **[HELP.md](ComfyUI-PerceptionRelay/HELP.md)**.

---

## 🎹 Проект 3: NERONAUDIOSTUDIO (Музыкальная студия)

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

This repository contains my custom nodes for ComfyUI. It holds **three completely independent projects**: video generation, video post-processing and music. You can use them separately or together, however you like.

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

## 🎛 Project 2: PERCEPTION RELAY (Video Post-processing)

👋 All nodes, workflows and instructions live in the **[`ComfyUI-PerceptionRelay`](ComfyUI-PerceptionRelay/)** folder.

AI video looks "fake" not because of resolution. It looks fake because the viewer's brain keeps getting disturbed: details boil and crawl, eyes and the face edge jitter, shadows are flat, colour leaks across borders. **Perception Relay does not invent a single detail.** It removes what disturbs the eye, and the brain sees the picture as sharp and alive on its own. It works with any video, including clips from H3.

**Main feature — 🎛 the Pult with a live preview.** Move any slider and see the frame (up to 2K) within a fraction of a second. You get a before/after split, a full-resolution magnifier and a **▶ play 1 s** button that loops one second of the clip, so you see shimmer, not just a still.

**Stage cards** (each plugs into the Pult with one wire, in any order):
*   **👁 Scout** — finds and tracks faces and eyes.
*   **🌊 Flow** — motion between frames (RAFT, or DIS with no download).
*   **⚖ Judge** — tells physics from drift and calms boiling detail. Honest motion is left alone.
*   **💎 Edge cut** — sharpens edges only, and only where the edge holds steady in time.
*   **🌑 Tone skeleton** — shadows and blacks as the frame of the picture: depth and volume, no detail loss.
*   **🎨 Colour seam** — clean colour borders, no halos, no "razor" look.
*   **✨ Polish** — deflicker, light, smoothness (×2 half-frame or motion blur).
*   **🎚 Basic** — simple brightness, contrast, sharpness, saturation.
*   **🎯 Attention points** — eyes and face edge pulled to "lens focus".

**Outputs:** frames, audio and fps for Create Video, a before/after comparison video, and a **run report** with all settings and how each stage worked. The report contains no paths, file names or video, so it is safe to send to me. Your reports will become presets.

**Hardware:** 12–16 GB VRAM, 32–48 GB RAM. Models are tiny (face detector 230 KB, RAFT ~20 MB) and download automatically. Nodes are in English and Russian.

⚠️ **Important:** the project is in **Alpha**. Bugs are possible, and your reports help a lot. Installation, every slider and troubleshooting are in the **[README inside ComfyUI-PerceptionRelay](ComfyUI-PerceptionRelay/README.md)** and in **[HELP.md](ComfyUI-PerceptionRelay/HELP.md)**.

---

## 🎹 Project 3: NERONAUDIOSTUDIO (Music Studio)

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
