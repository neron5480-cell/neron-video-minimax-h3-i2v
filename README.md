# Neron's ComfyUI Projects

[🇷🇺 Русская версия — ниже. 🇬🇧 English version — at the bottom.](#english-version)

Привет, друзья!

В этом репозитории живут мои кастомные ноды для ComfyUI. Здесь собраны **независимые проекты**: генерация видео, пост-обработка видео и музыка. Используйте их по отдельности или вместе, как вам удобно.

---

## 🚀 Установка (2 минуты)

### Способ 1. Одной ссылкой через ComfyUI Manager (проще всего)

1. Откройте **Manager** → **Install via Git URL**.
2. Вставьте ссылку:
   ```
   https://github.com/neron5480-cell/neron-video-minimax-h3-i2v
   ```
3. Дождитесь окончания установки и **полностью перезапустите ComfyUI**.
4. Обновите страницу: **Ctrl + F5**.

Встанут **сразу все ноды** из этого репозитория. В консоли ComfyUI появится строка:
```
[Neron pack] loaded / загружено: ...
```
со списком загруженных нод.

> ℹ️ Поиск по названию в Manager ноды не найдёт: пакет пока не зарегистрирован в общем каталоге. Ставьте по ссылке.

### Способ 2. Вручную (только нужные ноды)

1. Нажмите зелёную кнопку **Code** → **Download ZIP** и распакуйте архив.
2. Скопируйте **нужные папки нод** прямо в `ComfyUI/custom_nodes/`. В ComfyUI Desktop это обычно:
   `C:\Users\<имя>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\custom_nodes\`
3. Перезапустите ComfyUI.

Папка ноды должна лежать **сразу** в `custom_nodes`, без лишней вложенности:
```
✅ custom_nodes/ComfyUI-NeronH3Engine/__init__.py
❌ custom_nodes/neron-video-minimax-h3-i2v-main/ComfyUI-NeronH3Engine/__init__.py
```
Ноды из папки `Neron_Studio_H3` копируются **по отдельности** (папки внутри неё), а не вся папка целиком.

**Общий код — одна копия.** Некоторые папки берут код у соседей, поэтому копируйте их вместе:
- `ComfyUI-H3-Static-Camera` и `NeronStudio-Image-Processor` → нужна `ComfyUI-Interactive-Processor` (загрузка и цвет картинки);
- `NeronStudio-AutoPrompter` → нужна `ComfyUI-H3-Static-Camera` (камера H3).

Не хватит соседа — в консоли будет понятная ошибка с именем нужной папки.

### ⚠️ Не смешивайте способы

Если раньше вы ставили ноды вручную, а теперь ставите по ссылке, **удалите старые ручные копии** из `custom_nodes`. Пакет сам пропускает ноды, которые уже стоят отдельно, и пишет об этом в консоли. Но если старая копия лежит под другим именем папки, две версии одной ноды будут мешать друг другу.

### Нода не появилась?

1. Полностью закройте ComfyUI (в Desktop — и из трея) и откройте снова.
2. Посмотрите консоль при запуске: строки `[Neron pack]` и `IMPORT FAILED` подскажут, что случилось.
3. Проверьте, что папка ноды лежит правильно (см. схему выше).
4. Напишите мне в комментариях на Civitai и приложите кусок консоли.

---

## 🎬 Проект 1: NERON H3 ENGINE v2.0 «Hard» (Видео-генерация, новый)

👋 Нода и воркфлоу лежат в папке **[`ComfyUI-NeronH3Engine`](ComfyUI-NeronH3Engine/)**.

Максимум качества, который MiniMax H3 может дать на домашнем компьютере. Без апскейлов и трюков: честная генерация в паспорте модели.

* Режимы **⚡ Турбо / Качество / Максимум**.
* Паспорт модели: до 1344×768 и до 15 секунд; всё, что больше, нода сама ужимает.
* Модели грузятся по очереди, раскодировка защищена от нехватки памяти.
* Часы генерации, режим эксперта и справка 📖 на двух языках прямо на ноде.
* Работает и с лёгкими (квантованными) моделями.

*Подробности — в [README внутри папки](ComfyUI-NeronH3Engine/README.md).*

---

## 🎬 Проект 2: NERON STUDIO H3 (Готовый процесс видео-генерации, v1.0 «Lite»)

👋 Все ноды, воркфлоу и инструкции лежат в папке **[`Neron_Studio_H3`](Neron_Studio_H3/)**.

Готовый пайплайн для генерации видео и звука (MiniMax H3) с уже настроенными нодами. Полный цикл: от подготовки стартового кадра до финальной склейки. Без «лапши» из проводов.

**Состав пайплайна:**
1. **Start Frame (🖼 Neron Studio Image Processor)** — подготовка стартового кадра.
2. **Neron AutoPrompter** — LLM-режиссёр и камера-оператор.
3. **Neron MiniMax H3 Generator** — сердце системы (вся генерация в одной ноде).
4. **Neron Video Clarity** — пост-обработка (стабилизация, дефликер, без апскейла).
5. **Video Combine** — финальная склейка.

*Инструкция по установке и модели — в [README внутри папки](Neron_Studio_H3/README.md).*

---

## 🎛 Проект 3: PERCEPTION RELAY — Эстафета восприятия (Пост-обработка видео)

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

⚠️ **Важно:** проект в стадии **Alpha**. Возможны баги, ваши отчёты очень помогут. Установка, описание всех ползунков и «что делать, если…» — в **[README внутри ComfyUI-PerceptionRelay](ComfyUI-PerceptionRelay/README.md)**.

---

## 🎹 Проект 4: NERONAUDIOSTUDIO (Музыкальная студия)

👋 Все аудио-ноды лежат в папке **[`NeronAudioStudio`](NeronAudioStudio/)**.

Это отдельный проект, который превращает ComfyUI в маленькую музыкальную студию (DAW).

**Что внутри:**
*   **Drum Machine:** пошаговый секвенсор ударных (как в FL Studio) с поддержкой ваших сэмплов.
*   **Piano Roll:** рисуем мелодии мышкой, внутри 9 встроенных синтезаторов.
*   **Audio Loader:** загрузка, прослушивание и обрезка любого звукового файла.
*   **Mixer:** до 8 каналов. Громкость, баланс, Mute/Solo, синхронизация BPM и работа с видео (полная замена/вырезание звука, наложение своих дорожек, синхронизация по длине).
*   **Video Combine:** умная склейка видео (или пачки кадров) со сведённым звуком.
*   **Video ×3 и Sound ×8 (кубики):** до 3 роликов и до 8 звуков в одной ноде, одним проводом в Пульт (Mixer). Пульт показывает сводку, ролики рядом или на весь экран, каждый звук — свой канал.
*   **Field / Поле:** общее поле, как Playlist в FL Studio. Склейка до 3 роликов с точностью до кадра (сдвиг мышкой, два разделителя, склейка или наплыв) и дорожки со звуком: двигать, обрезать, резать, появление и затухание. Большое окно открывается поверх холста, на холсте остаётся аккуратная карточка.
*   **Dancer:** для настроения — героиня (или ваш ролик с танцем), которая танцует в такт музыке.

**🆕 Версия 2.0 — модульная студия: кубики + Пульт-сердце.**
*   **Пульт:** у каждого канала эквалайзер НИЗ / СЕР / ВЕРХ и ЭХО (комната / зал / собор), прыгающие индикаторы; музыка сама подстраивается под длину ролика и мягко затихает в конце; жёлтая рамка на волне — какой кусок трека звучит под роликом; ⚙ для спецов — темп под видео.
*   **Видео-сэмплер:** режем куски из 3 роликов и собираем монтаж точно по кадрам; ⏭ пропустить, 🔇 без звука роликов, 🧲 резать в долю.
*   **Сэмплер:** собираем звук из кусков дорожек на сетке по тактам, 4 слоя, у каждого слоя свой ▶.
*   **Музыка:** барабаны и пианино в одной ноде, общий темп, ▶ всё вместе.
*   **Студия:** каждая дорожка — свой канал с эквалайзером и эхом, поле сборки как в FL Studio, общий эквалайзер на 10 полос с живым спектром.
*   **Тема 🎨:** в готовой схеме теперь стоит новая **Neron Theme** (Проект 5) — она красит и ноды студии, и DJ Пульт; огни по рамкам и искры по проводам в такт бочке. Старая «Тема» оставлена для старых схем.

Готовые схемы: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json` (новая) и `Neron_Audio_Studio_v1.0_Beta.json` (прежняя).

Главная фишка: **звук играет сразу на ноде, кнопка Queue для прослушивания не нужна!** Всё работает в браузере и не нагружает видеокарту.

⚠️ **Важно:** проект в стадии **Beta**. Интерфейс пока только на русском (английский будет позже), но всё интуитивно понятно. Возможны баги. Подробная инструкция по всем кнопкам и папкам — в **[README внутри NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 🎨 Проект 5: NERON THEME (Темы для всего ComfyUI)

👋 Нода лежит в папке **[`NeronTheme`](NeronTheme/)**.

Одна нода — и **весь ComfyUI в теме**: окно, стол, ноды и провода. Удалили ноду — всё как было.

*   **Ноды по ролям:** модели, промпты, генерация, латент, обработка, звук, выход — у каждой роли свой цвет. Работает с любыми нодами, не только Neron. Ваш ручной цвет ноды всегда главнее.
*   **УСТАНОВИТЬ:** 10 встроенных тем (Графит, Neron Brown, Неон, Подсветка, Закат, Океан, Лес, Сакура, Монохром, светлая Бумага) + ваши. Навели на карточку — примерили, кликнули — поставили.
*   **СОЗДАТЬ:** тема из одного цвета, **тема из картинки** (Load Image → вход `image`), полупрозрачные ноды, подсветка нод, цвет проводов (по типу / один / свои), а в ⚙ — каждый цвет вручную.
*   **ПОДЕЛИТЬСЯ:** 📋 код (строчка для чата), 💾 файл, 🎨 палитра для встроенных настроек ComfyUI.
*   **Живость:** огни по рамкам, искры по проводам, фон; нода, которая считается, светится с полоской прогресса, готовая вспыхивает, ошибка мигает красным.
*   Тема **сохраняется вместе с workflow**: кто скачал вашу схему, видит её в вашем оформлении.

⚠️ **Братан, не гонись за анимацией.** Её рисует браузер; на больших столах может подтормаживать — тогда «Живость» на «Спокойно» или «Выкл».

Подробно — в **[README внутри NeronTheme](NeronTheme/README.md)**.

---

## 🎬 Проект 6: NERON STAGE — Площадка режиссёра (v0.1, тест)

👋 Нода лежит в папке **[`NeronStage`](NeronStage/)**.

*   Фото места становится **объёмной сценой**, по ней ходит **скелет-дублёр** от точки к точке.
*   В каждой точке — **поза** и **подсказка словами**; позу можно гнуть мышкой.
*   **Камера** — готовым ракурсом или мышкой в виде «🎥 Камера». **▶** — репетиция на холсте.
*   На выходе: **видео скелета позы** (для H3 Fun ControlNet) и **раскадровка по секундам** (для автопромтера).

Подробно — в **[README внутри NeronStage](NeronStage/README.md)**.

---

## 🗺 Карта: какую ноду брать

| Задача | Берите | Ещё есть (для старых воркфлоу) |
|---|---|---|
| Подготовить первый кадр | **🖼 Neron Studio Image Processor** — пресеты подрезаются по центру, Сброс и Справка | Interactive Image Processor (пресеты растягивают картинку); Smart Load & Resize Image и Manual Color & Upscale Panel — *legacy*, тот же код |
| Сгенерировать видео H3 | **🎬 Neron H3 Engine** — качество; **⚡ Neron H3 Engine Fast** — скорость (тест, ветка dev) | 🎥 Neron MiniMax H3 Generator (Lite) — для воркфлоу Neron Studio H3 |
| Написать промпт | **🎬 Neron AutoPrompter** — промпт под H3 по картинке и брифу | 🎬 Neron Dialog Autoprompter и 🧠 Multi-Image LLM — диалоговый режим |
| Камера H3 | **⚡ Fixed Camera H3** | — |
| Тема оформления | **Neron Theme 🎨 / Темы ComfyUI** | «Тема Audio Studio (legacy)» — чтобы открывались старые схемы студии |

Код загрузки и цвета картинки — **один на все четыре ноды обработки**: исправление в нём сразу работает везде.
В Image Processor режим «Отключено» = картинка как есть; **резкость 0 = выключено**.

## 📦 Самостоятельные ноды (в корне)

Эти ноды остаются в корне для обратной совместимости: старые воркфлоу продолжают работать.

| Папка | Что это | Воркфлоу |
|---|---|---|
| [`ComfyUI-H3-Lora-Selector`](ComfyUI-H3-Lora-Selector/) | H3 LoRA Selector — 5 слотов LoRA | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`ComfyUI-H3-Static-Camera`](ComfyUI-H3-Static-Camera/) | Fixed Camera H3 Presets; Smart Load & Resize Image и Manual Color & Upscale Panel (*legacy*, код берут из `ComfyUI-Interactive-Processor`) | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`ComfyUI-Interactive-Processor`](ComfyUI-Interactive-Processor/) | Interactive Image Processor + **общий код картинки** для всех нод обработки | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`neron_dialog_autoprompter`](neron_dialog_autoprompter/) | Neron Dialog Autoprompter, Neron Multi-Image LLM | `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`restore_studio`](restore_studio/) | Restore Studio, Live Preview | `workflow/Neron_Restore_Studio_Photoshop.json` |

---
<br><br>

# English version

Hi friends!

This repository contains my custom nodes for ComfyUI. It holds **independent projects**: video generation, video post-processing and music. Use them separately or together, however you like.

---

## 🚀 Installation (2 minutes)

### Option 1. One link via ComfyUI Manager (easiest)

1. Open **Manager** → **Install via Git URL**.
2. Paste the link:
   ```
   https://github.com/neron5480-cell/neron-video-minimax-h3-i2v
   ```
3. Wait for the install to finish and **restart ComfyUI completely**.
4. Refresh the page: **Ctrl + F5**.

**All nodes** from this repository are installed at once. The ComfyUI console will show:
```
[Neron pack] loaded / загружено: ...
```
with the list of loaded nodes.

> ℹ️ Searching by name in Manager will not find the pack: it is not listed in the public registry yet. Install by link.

### Option 2. Manually (only the nodes you need)

1. Click the green **Code** button → **Download ZIP** and unpack it.
2. Copy the **node folders you need** straight into `ComfyUI/custom_nodes/`. In ComfyUI Desktop this is usually:
   `C:\Users\<name>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\custom_nodes\`
3. Restart ComfyUI.

A node folder must sit **directly** in `custom_nodes`, with no extra level:
```
✅ custom_nodes/ComfyUI-NeronH3Engine/__init__.py
❌ custom_nodes/neron-video-minimax-h3-i2v-main/ComfyUI-NeronH3Engine/__init__.py
```
Nodes from `Neron_Studio_H3` are copied **one by one** (the folders inside it), not the whole folder.

**Shared code lives in one copy.** Some folders use code from their neighbours, so copy them together:
- `ComfyUI-H3-Static-Camera` and `NeronStudio-Image-Processor` → need `ComfyUI-Interactive-Processor` (image loading and color);
- `NeronStudio-AutoPrompter` → needs `ComfyUI-H3-Static-Camera` (the H3 camera).

If a neighbour is missing, the console names the folder you need.

### ⚠️ Do not mix the two options

If you installed nodes manually before and now install by link, **delete the old manual copies** from `custom_nodes`. The pack skips nodes that are already installed on their own and says so in the console. But if an old copy sits under a different folder name, two versions of the same node will get in each other's way.

### The node did not show up?

1. Close ComfyUI completely (in Desktop, also from the tray) and open it again.
2. Check the startup console: the `[Neron pack]` and `IMPORT FAILED` lines tell what happened.
3. Check that the node folder sits in the right place (see above).
4. Write to me in the comments on Civitai and attach a piece of the console.

---

## 🎬 Project 1: NERON H3 ENGINE v2.0 "Hard" (Video Generation, new)

👋 The node and workflow live in the **[`ComfyUI-NeronH3Engine`](ComfyUI-NeronH3Engine/)** folder.

The best quality MiniMax H3 can give on a home PC. No upscales, no tricks: honest generation inside the model passport.

* **⚡ Turbo / Quality / Maximum** modes.
* Model passport: up to 1344×768 and up to 15 seconds; anything bigger is clamped by the node.
* Models load one at a time, the VAE decode is protected from running out of memory.
* Run clock, expert mode and bilingual 📖 Help right on the node.
* Works with light (quantized) models too.

*Details are in the [README inside the folder](ComfyUI-NeronH3Engine/README.md).*

---

## 🎬 Project 2: NERON STUDIO H3 (Ready-made video pipeline, v1.0 "Lite")

👋 All nodes, workflows and instructions live in the **[`Neron_Studio_H3`](Neron_Studio_H3/)** folder.

A ready-made pipeline for video and audio generation (MiniMax H3) with pre-tuned nodes. Full cycle: from initial frame preparation to final muxing. No "spaghetti" wires.

**Pipeline contents:**
1. **Start Frame (🖼 Neron Studio Image Processor)** — initial frame preparation.
2. **Neron AutoPrompter** — LLM director and camera operator.
3. **Neron MiniMax H3 Generator** — the core system (all generation in one node).
4. **Neron Video Clarity** — post-processing (stabilization, deflicker, no upscale).
5. **Video Combine** — final muxing.

*Installation and model instructions are in the [README inside the folder](Neron_Studio_H3/README.md).*

---

## 🎛 Project 3: PERCEPTION RELAY (Video Post-processing)

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

⚠️ **Important:** the project is in **Alpha**. Bugs are possible, and your reports help a lot. Installation, every slider and troubleshooting are in the **[README inside ComfyUI-PerceptionRelay](ComfyUI-PerceptionRelay/README.md)**.

---

## 🎹 Project 4: NERONAUDIOSTUDIO (Music Studio)

👋 All audio nodes live in the **[`NeronAudioStudio`](NeronAudioStudio/)** folder.

This is a separate project that turns ComfyUI into a small digital audio workstation (DAW).

**What's inside:**
*   **Drum Machine:** step sequencer for drums (like FL Studio) with custom sample support.
*   **Piano Roll:** draw melodies with your mouse, 9 built-in synths.
*   **Audio Loader:** load, listen to and trim any audio file.
*   **Mixer:** up to 8 channels. Volume, pan, Mute/Solo, BPM sync, and video support (fully replace/mute video audio, overlay multiple tracks, sync by length).
*   **Video Combine:** smart muxing of video (or image batches) with the mixed audio.
*   **Video ×3 and Sound ×8 (cubes):** up to 3 clips and 8 sounds in one node, one wire into the Pult (Mixer). The Pult shows a summary, clips side by side or full screen, each sound as its own channel.
*   **Field:** a shared field like the FL Studio Playlist. Frame-accurate cutting of up to 3 clips (drag to shift, two dividers, cut or dissolve) plus audio tracks: move, trim, split, fade in and out. The big window opens above the canvas; the canvas keeps a tidy card.
*   **Dancer:** just for fun — a little dancer (or your own dance clip) that moves in time with the music.

**🆕 Version 2.0 — a modular studio: cubes + the Pult as the heart.**
*   **Pult:** LOW / MID / HIGH EQ and REVERB (room / hall / cathedral) on every channel, live meters; music fits the clip length and fades out at the end; a yellow frame on the wave picks which part of the track plays; ⚙ expert — tempo to video.
*   **Video Sampler:** cut pieces from 3 clips into a frame-accurate edit; ⏭ bypass, 🔇 no clip sound, 🧲 cut on the beat.
*   **Sampler:** build sound from track pieces on a bar grid, 4 layers, ▶ per layer.
*   **Music:** drums and piano in one node, one tempo, ▶ play all.
*   **Studio:** every track is a channel with EQ and reverb, an FL-Studio-like arrange field, a 10-band master EQ with a live spectrum.
*   **Theme 🎨:** the ready workflow now uses the new **Neron Theme** (Project 5) — it themes the studio nodes and the DJ Controller too; lights on the frames and sparks on the wires follow the kick. The old "Theme" node is kept for old workflows.

Ready workflows: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json` (new) and `Neron_Audio_Studio_v1.0_Beta.json` (previous).

Main feature: **audio plays directly on the node, no need to hit Queue just to listen!** Everything runs in the browser and doesn't load your GPU.

⚠️ **Important:** the project is in **Beta**. The interface is currently in Russian only (English will be added later), but it's highly intuitive. Bugs are possible. Detailed instructions for all buttons and folders are in the **[README inside NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 🎨 Project 5: NERON THEME (Themes for the whole ComfyUI)

👋 The node lives in the **[`NeronTheme`](NeronTheme/)** folder.

One node — and the **whole ComfyUI is themed**: window, canvas, nodes and wires. Delete the node — everything is back.

*   **Nodes by role:** models, prompts, sampling, latent, processing, audio, output — each role has its own color. Works with any nodes, not only Neron. A color you set by hand always wins.
*   **INSTALL:** 10 built-in themes (Graphite, Neron Brown, Neon, Backlight, Sunset, Ocean, Forest, Sakura, Mono, light Paper) + your own. Hover a card to try it, click to apply.
*   **CREATE:** a theme from one color, a **theme from a picture** (Load Image → the `image` input), see-through nodes, node backlight, wire colors (by type / one / custom), and every color by hand in ⚙.
*   **SHARE:** 📋 code (a line for a chat), 💾 file, 🎨 a palette for ComfyUI's own settings.
*   **Life:** lights on frames, sparks on wires, background; the running node glows with a progress bar, a finished one flashes, an error blinks red.
*   The theme is **saved with the workflow**: whoever downloads your workflow sees it the way you styled it.

⚠️ **Bro, don't chase the animation.** The browser draws it; big canvases may stutter — then set Life to Calm or Off.

Details in the **[README inside NeronTheme](NeronTheme/README.md)**.

---

## 🎬 Project 6: NERON STAGE — Director's Stage (v0.1, test)

👋 The node lives in the **[`NeronStage`](NeronStage/)** folder.

*   The place photo becomes a **3D scene**; a **stand-in skeleton** walks from point to point.
*   Each point has a **pose** and a **text hint**; bend poses with the mouse.
*   **Camera** by preset or by mouse in the “🎥 Camera” view. **▶** rehearses on the canvas.
*   Outputs: a **pose skeleton video** (for H3 Fun ControlNet) and a **per-second storyboard** (for the autoprompter).

Details in the **[README inside NeronStage](NeronStage/README.md)**.

---

## 🗺 Map: which node to use

| Task | Use | Also there (for old workflows) |
|---|---|---|
| Prepare the first frame | **🖼 Neron Studio Image Processor** — presets are center-cropped, Reset and Help | Interactive Image Processor (presets stretch the picture); Smart Load & Resize Image and Manual Color & Upscale Panel — *legacy*, same code |
| Generate H3 video | **🎬 Neron H3 Engine** — quality; **⚡ Neron H3 Engine Fast** — speed (test, dev branch) | 🎥 Neron MiniMax H3 Generator (Lite) — for the Neron Studio H3 workflows |
| Write the prompt | **🎬 Neron AutoPrompter** — an H3 prompt from a picture and a brief | 🎬 Neron Dialog Autoprompter and 🧠 Multi-Image LLM — dialog mode |
| H3 camera | **⚡ Fixed Camera H3** | — |
| UI theme | **Neron Theme 🎨 / Темы ComfyUI** | "Old Audio Studio theme (legacy)" — so old studio workflows open |

The image loading and color code is **one for all four image nodes**: a fix there works everywhere at once.
In Image Processor, Disabled = the picture as is; **sharpness 0 = off**.

## 📦 Standalone nodes (in the root)

These nodes stay in the root for backward compatibility: old workflows keep working.

| Folder | What it is | Workflow |
|---|---|---|
| [`ComfyUI-H3-Lora-Selector`](ComfyUI-H3-Lora-Selector/) | H3 LoRA Selector — 5 LoRA slots | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`ComfyUI-H3-Static-Camera`](ComfyUI-H3-Static-Camera/) | Fixed Camera H3 Presets; Smart Load & Resize Image and Manual Color & Upscale Panel (*legacy*, code from `ComfyUI-Interactive-Processor`) | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`ComfyUI-Interactive-Processor`](ComfyUI-Interactive-Processor/) | Interactive Image Processor + **shared image code** for all image nodes | `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`neron_dialog_autoprompter`](neron_dialog_autoprompter/) | Neron Dialog Autoprompter, Neron Multi-Image LLM | `workflow/neronSmartMiniMaxH3_v1.0.json` |
| [`restore_studio`](restore_studio/) | Restore Studio, Live Preview | `workflow/Neron_Restore_Studio_Photoshop.json` |

---

📜 License: MIT. Author: **neron5480922** on Civitai · [neron5480-cell](https://github.com/neron5480-cell) on GitHub.
