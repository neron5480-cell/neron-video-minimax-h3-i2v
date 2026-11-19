# Neron's ComfyUI Projects

[🇷🇺 Русская версия — ниже. 🇬🇧 English version — at the bottom.](#english-version)

Привет, друзья!

В этом репозитории живут мои кастомные ноды для ComfyUI. Здесь собраны **независимые проекты**: видео (H3 Story, LTX), картинки (Krea 2, реставрация), пост-обработка видео, музыка, темы и рабочий стол. **Каждая папка работает сама по себе** — у неё свои ноды и свой код, соседи не нужны.

---

## 🚀 Установка (2 минуты)

### Способ 1. Сам ComfyUI (Desktop и браузер) — проще всего

Пакет есть в официальном каталоге ComfyUI (Comfy Registry, издатель **neron**).

- **Открыли наш процесс, а ноды красные?** ComfyUI сам предложит установить недостающие ноды — согласитесь,
  потом **полностью перезапустите ComfyUI** (в Desktop — и из трея).
- **Или через Manager:** откройте **Manager** (в Comfy Desktop он встроен) → поиск **Neron** → **Install** →
  перезапуск.

Встанут **сразу все ноды** из этого репозитория. В консоли ComfyUI появится строка:
```
[Neron pack] loaded / загружено: ...
```
со списком загруженных нод.

### Способ 1б. По ссылке (браузерная версия с ComfyUI Manager)

**Manager** → **Install via Git URL** → вставьте ссылку и перезапустите ComfyUI:
```
https://github.com/neron5480-cell/neron-video-minimax-h3-i2v
```
> ℹ️ В Comfy Desktop этого пункта может не быть или он закрыт настройкой безопасности — тогда Способ 1 или 2.

### Способ 2. Вручную (только нужные ноды)

1. Нажмите зелёную кнопку **Code** → **Download ZIP** и распакуйте архив.
2. Скопируйте **нужные папки нод** прямо в `ComfyUI/custom_nodes/`. В ComfyUI Desktop это обычно:
   `C:\Users\<имя>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\custom_nodes\`
3. Перезапустите ComfyUI.

Папка ноды должна лежать **сразу** в `custom_nodes`, без лишней вложенности:
```
✅ custom_nodes/ComfyUI-NeronH3Story/__init__.py
❌ custom_nodes/neron-video-minimax-h3-i2v-main/ComfyUI-NeronH3Story/__init__.py
```
**Каждая папка самостоятельна** — копируйте только ту, что нужна: соседние папки ей не нужны.

### ⚠️ Не смешивайте способы

Если раньше вы ставили ноды вручную, а теперь ставите по ссылке, **удалите старые ручные копии** из `custom_nodes`. Пакет сам пропускает ноды, которые уже стоят отдельно, и пишет об этом в консоли. Но если старая копия лежит под другим именем папки, две версии одной ноды будут мешать друг другу.

### Нода не появилась?

1. Полностью закройте ComfyUI (в Desktop — и из трея) и откройте снова.
2. Посмотрите консоль при запуске: строки `[Neron pack]` и `IMPORT FAILED` подскажут, что случилось.
3. Проверьте, что папка ноды лежит правильно (см. схему выше).
4. Напишите мне в комментариях на Civitai и приложите кусок консоли.

---

## 🖥 NERON STUDIO — свой рабочий стол внутри ComfyUI (новое)

Плитки, папки и свой фон — и все процессы Neron в один клик. 📖 Подробно, со скриншотами: [статья на Civitai](https://civitai.com/articles/38373/neron-studio-svoj-rabochij-stol-vnutri-comfyui-your-own-desktop-inside-comfyui). После установки на холсте появится золотая монета **N** (её можно перетащить), или меню **Neron → Neron Studio**.

- **Папки:** Видео · Картинки · Звук · Модели; внутри — плитки по задачам и варианты процесса. Путь сверху, назад — «‹ Назад» или Esc.
- **Живые плитки:** перетаскиваются, растягиваются, убираются и возвращаются; раскладка запоминается.
- **Свой фон:** фото, гифка или видео — и на столе, и под холстом ComfyUI (нужна Neron Theme). Размер плиток 50–140 %, свой цвет плиток и акцента.
- **Процесс в оформлении стола:** «▶ Создать», «■ Стоп», часы, «⤴ Наверх» из подграфа, «🏠 Стол»; «✕» — обычный ComfyUI.
- **RU / EN** — по языку системы, переключатель на столе.
- Проверенные процессы лежат внутри как есть (`ComfyUI-NeronStudio/workflows`). Модели к ним — по заметкам в самих процессах.

## 🎬 NERON H3 STORY — длинные ролики MiniMax H3 до 45 секунд (новое)

👋 Ноды и воркфлоу лежат в папке **[`ComfyUI-NeronH3Story`](ComfyUI-NeronH3Story/)**.

Тот же качественный движок H3, только ролик **5–45 секунд со звуком** — цепочкой блоков, склеенных без видимых стыков: каждый следующий блок продолжает хвост прошлого **вместе со звуком**.

* **🖼 Кадры** — первый, два промежуточных и последний кадр загружаются прямо в одну ноду, без лапши.
* **📝 Story AutoPrompter** — один сценарий своими словами → промпт каждого отрезка с секундами, физикой и звуком; камера стоит, пока в сценарии не попросишь движение.
* Можно и **без автопромтера** — нодами **🎞 Блок** (свой текст, картинки и LoRA у каждого отрезка).
* Режимы **🚀 Быстро / ⚡ Турбо / Качество / Максимум**; модели качает сам.
* Настроено на качество — это долго (30 с ≈ 45 мин – 1,5 ч на RTX 5070 Ti); как ускорить — в README.

*Подробности — в [README внутри папки](ComfyUI-NeronH3Story/README.md).*

---

## 🖼 NERON IMAGE — картинка по тексту на Krea 2 (новое)

👋 Нода и воркфлоу лежат в папке **[`ComfyUI-NeronImage`](ComfyUI-NeronImage/)**.

Пишете, что нарисовать, хоть по-русски, — получаете картинку до **2K**. Одна нода вместо двадцати в официальном шаблоне.

* Модель — **Krea 2 Turbo bf16** (официально, Comfy-Org): 8 шагов, ≈ 1 мин на 2K на 16 ГБ.
* **Автопромтер** на том же Qwen3-VL, качать ничего не надо. По умолчанию **🎨 до мелочей**: ваши слова остаются как есть, а одежду, материалы, детали механизмов, свет и камеру он дописывает сам. Готовый промпт видно на ноде.
* Форма кадра, качество 1K / 1.5K / 2K, **резкость** (ползунок), официальные стили-LoRA.
* Модели качает сама (кнопка **📥 Модели**).

*Подробности — в [README внутри папки](ComfyUI-NeronImage/README.md).*

---

## 🎬 NERON LTX ENGINE — видео LTX 2.5 одной нодой

👋 Папка **[`ComfyUI-NeronLTXEngine`](ComfyUI-NeronLTXEngine/)**.

* **🎬 Neron LTX Engine** — первый / промежуточные / последний кадр, звук, модели качает сам.
* **🎬 Neron LTX AutoPrompter** — промпт под LTX с физикой и камерой; живёт в той же папке, LLM качает сам.

---

## 🎨 RESTORE STUDIO — реставрация старых фото

👋 Папка **[`restore_studio`](restore_studio/)**, процесс `restore_studio/workflows/Neron_Restore_Studio_Photoshop.json`.

* Баланс белого, уровни, шумодав, царапины, цвет, резкость, апскейл; пресеты; 🖥 Live Preview — результат вживую.
* Восстановление лиц и раскраска — через установленные у вас пакеты (CodeFormer / DDColor), если они есть.

---

## 🎛 PERCEPTION RELAY — Эстафета восприятия (Пост-обработка видео)

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

## 🎹 NERON AUDIO STUDIO (Музыкальная студия)

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

## 🎨 NERON THEME (Темы для всего ComfyUI)

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

## 🗺 Карта: какую ноду брать

| Задача | Берите | Папка |
|---|---|---|
| Длинный ролик H3 (5–45 с) | **🎬 Neron H3 Story** + **🖼 Кадры** + **📝 Story AutoPrompter** (или **🎞 Блок**) | `ComfyUI-NeronH3Story` |
| Видео LTX 2.5 | **🎬 Neron LTX Engine** + **🎬 Neron LTX AutoPrompter** | `ComfyUI-NeronLTXEngine` |
| Картинка по тексту | **🖼 Neron Image / Картинка (Krea 2)** | `ComfyUI-NeronImage` |
| Реставрация фото | **🎨 Restore Studio** + 🖥 Live Preview | `restore_studio` |
| Улучшить видео | **Perception Relay** — пульт и карточки | `ComfyUI-PerceptionRelay` |
| Музыка и звук | **Neron Audio Studio** | `NeronAudioStudio` |
| Тема оформления | **Neron Theme 🎨 / Темы ComfyUI** | `NeronTheme` |
| Рабочий стол | **🖥 Neron Studio** | `ComfyUI-NeronStudio` |

## ❓ Частые вопросы

**Автопромтер не пишет откровенные сцены. Какую модель взять «без цензуры»?**
Советов по моделям без цензуры я не даю: ноды Neron сделаны для обычного творческого видео — природа, люди,
сценки, клипы. Автопромтер работает с любой vision-моделью GGUF, которую вы положите в `models/LLM`, так что
выбор модели — ваше решение и ваша ответственность.

---
<br><br>

# English version

Hi friends!

This repository contains my custom nodes for ComfyUI. It holds **independent projects**: video (H3 Story, LTX), images (Krea 2, restoration), video post-processing, music, themes and a desktop. **Every folder works on its own** — its own nodes and code, no neighbours needed.

---

## 🚀 Installation (2 minutes)

### Option 1. ComfyUI itself (Desktop and browser) — easiest

The pack is in the official ComfyUI catalog (Comfy Registry, publisher **neron**).

- **Opened our workflow and the nodes are red?** ComfyUI offers to install the missing nodes — accept, then
  **restart ComfyUI completely** (in Desktop, also from the tray).
- **Or via Manager:** open **Manager** (built into Comfy Desktop) → search **Neron** → **Install** → restart.

**All nodes** from this repository are installed at once. The ComfyUI console will show:
```
[Neron pack] loaded / загружено: ...
```
with the list of loaded nodes.

### Option 1b. By link (browser version with ComfyUI Manager)

**Manager** → **Install via Git URL** → paste the link and restart ComfyUI:
```
https://github.com/neron5480-cell/neron-video-minimax-h3-i2v
```
> ℹ️ Comfy Desktop may not have this item, or a security setting blocks it — use Option 1 or 2 then.

### Option 2. Manually (only the nodes you need)

1. Click the green **Code** button → **Download ZIP** and unpack it.
2. Copy the **node folders you need** straight into `ComfyUI/custom_nodes/`. In ComfyUI Desktop this is usually:
   `C:\Users\<name>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\custom_nodes\`
3. Restart ComfyUI.

A node folder must sit **directly** in `custom_nodes`, with no extra level:
```
✅ custom_nodes/ComfyUI-NeronH3Story/__init__.py
❌ custom_nodes/neron-video-minimax-h3-i2v-main/ComfyUI-NeronH3Story/__init__.py
```
**Every folder is self-contained** — copy only the one you need; it does not need its neighbours.

### ⚠️ Do not mix the two options

If you installed nodes manually before and now install by link, **delete the old manual copies** from `custom_nodes`. The pack skips nodes that are already installed on their own and says so in the console. But if an old copy sits under a different folder name, two versions of the same node will get in each other's way.

### The node did not show up?

1. Close ComfyUI completely (in Desktop, also from the tray) and open it again.
2. Check the startup console: the `[Neron pack]` and `IMPORT FAILED` lines tell what happened.
3. Check that the node folder sits in the right place (see above).
4. Write to me in the comments on Civitai and attach a piece of the console.

---

## 🖥 NERON STUDIO — your own desktop inside ComfyUI (new)

Tiles, folders and your own background — and every Neron workflow one click away. 📖 Details with screenshots: [article on Civitai](https://civitai.com/articles/38373/neron-studio-svoj-rabochij-stol-vnutri-comfyui-your-own-desktop-inside-comfyui). After install a golden **N** coin appears on the canvas (drag it anywhere), or use the menu **Neron → Neron Studio**.

- **Folders:** Video · Images · Sound · Models; inside — tiles by task and workflow variants. A path on top; go back with «‹ Back» or Esc.
- **Live tiles:** drag, resize, remove and bring back; the layout is remembered.
- **Your own background:** a photo, GIF or video — on the desk and under the ComfyUI canvas (needs Neron Theme). Tile size 50–140 %, your own tile and accent colors.
- **Workflow in the desk look:** «▶ Create», «■ Stop», a clock, «⤴ Up» out of a subgraph, «🏠 Desktop»; «✕» — plain ComfyUI.
- **RU / EN** — from the system language, with a switch on the desk.
- Tested workflows ship inside as they are (`ComfyUI-NeronStudio/workflows`). Their models — see the notes inside each workflow.

## 🎬 NERON H3 STORY — long MiniMax H3 videos up to 45 seconds (new)

👋 The nodes and workflows live in the **[`ComfyUI-NeronH3Story`](ComfyUI-NeronH3Story/)** folder.

The same quality H3 engine, but a **5–45 s video with sound** — a chain of blocks joined without visible seams: every next block continues the previous one's tail **with its sound**.

* **🖼 Frames** — first, two middle and last frames loaded right inside one node, no spaghetti.
* **📝 Story AutoPrompter** — one scenario in your words → a prompt per part with timing, physics and sound; the camera stays locked unless the scenario asks for a move.
* Or **without the AutoPrompter** — with **🎞 Block** nodes (own text, pictures and LoRAs per part).
* **🚀 Fast / ⚡ Turbo / Quality / Maximum** modes; downloads its models.
* Tuned for quality — it takes time (30 s ≈ 45 min – 1.5 h on an RTX 5070 Ti); how to speed up — in the README.

*Details are in the [README inside the folder](ComfyUI-NeronH3Story/README.md).*

---

## 🖼 NERON IMAGE — text to image with Krea 2 (new)

👋 The node and workflow live in the **[`ComfyUI-NeronImage`](ComfyUI-NeronImage/)** folder.

Write what to draw, in any language, and get a picture up to **2K**. One node instead of twenty in the official template.

* Model — **Krea 2 Turbo bf16** (official, Comfy-Org): 8 steps, ≈ 1 min at 2K on 16 GB.
* A **prompter** runs on the same Qwen3-VL, so there is nothing extra to download. By default it uses **🎨 every detail**: your words stay as written, and it adds clothing, materials, mechanism parts, light and camera. The final prompt is shown on the node.
* Aspect, quality 1K / 1.5K / 2K, a **sharpness** slider, official style LoRAs.
* Downloads its models (the **📥 Models** button).

*Details are in the [README inside the folder](ComfyUI-NeronImage/README.md).*

---

## 🎬 NERON LTX ENGINE — LTX 2.5 video in one node

👋 Folder **[`ComfyUI-NeronLTXEngine`](ComfyUI-NeronLTXEngine/)**.

* **🎬 Neron LTX Engine** — first / middle / last frames, audio, downloads its models.
* **🎬 Neron LTX AutoPrompter** — an LTX prompt with physics and camera; lives in the same folder, downloads its LLM.

---

## 🎨 RESTORE STUDIO — old photo restoration

👋 Folder **[`restore_studio`](restore_studio/)**, workflow `restore_studio/workflows/Neron_Restore_Studio_Photoshop.json`.

* White balance, levels, denoise, scratches, color, sharpness, upscale; presets; 🖥 Live Preview.
* Face restore and colorization use packs you have installed (CodeFormer / DDColor), if present.

---

## 🎛 PERCEPTION RELAY (Video Post-processing)

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

## 🎹 NERON AUDIO STUDIO (Music Studio)

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

## 🎨 NERON THEME (Themes for the whole ComfyUI)

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

## 🗺 Map: which node to use

| Task | Use | Folder |
|---|---|---|
| Long H3 video (5–45 s) | **🎬 Neron H3 Story** + **🖼 Frames** + **📝 Story AutoPrompter** (or **🎞 Block**) | `ComfyUI-NeronH3Story` |
| LTX 2.5 video | **🎬 Neron LTX Engine** + **🎬 Neron LTX AutoPrompter** | `ComfyUI-NeronLTXEngine` |
| Text to image | **🖼 Neron Image (Krea 2)** | `ComfyUI-NeronImage` |
| Photo restoration | **🎨 Restore Studio** + 🖥 Live Preview | `restore_studio` |
| Enhance video | **Perception Relay** — pult and cards | `ComfyUI-PerceptionRelay` |
| Music and sound | **Neron Audio Studio** | `NeronAudioStudio` |
| UI theme | **Neron Theme 🎨** | `NeronTheme` |
| Desktop | **🖥 Neron Studio** | `ComfyUI-NeronStudio` |

## ❓ FAQ

**The AutoPrompter refuses explicit scenes. Which "uncensored" model should I use?**
I don't give advice on uncensored models: Neron nodes are made for general creative video — nature, people,
scenes, music clips. The AutoPrompter works with any vision GGUF model you put in `models/LLM`, so which model
to use is your own choice and responsibility.

---

📜 License: MIT. Author: **neron5480922** on Civitai · [neron5480-cell](https://github.com/neron5480-cell) on GitHub.
