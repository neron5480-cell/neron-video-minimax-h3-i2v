# ✂ Neron Video Editor — видео → видео (v0.3, тест)

**RU** · [EN ниже](#-neron-video-editor--video--video-v03-test)

Правка готового видео без порчи остального: видео 1 идёт как есть, кадр в кадр, а в нужные секунды поверх проявляются картинки и куски других видео.

## Ноды

| Нода | Что делает |
|---|---|
| **🎬 Neron Video ×3 / Видео ×3** | До трёх видео. **Видео 1 — ведущее** (его меняем), 2 и 3 — откуда берём врезки. Подключите IMAGE от **Load Video** — звук и fps (video_info) подключатся сами. Следующий слот открывается после подключения. |
| **🖼 Neron Pictures ×4 / Картинки ×4** | До четырёх картинок (рисунки, кадры) через **Load Image**. |
| **✨ Neron Edit AI / AI-движок** | Настройки AI-кусков (MiniMax H3: лучше ref2va, можно fl2va; файлы находит по названию): ⚡ Турбо / Качество, размер, сид; модели — под «⚙ эксперт». Выход — во вход `ai` пульта. |
| **🎛 Neron Edit Pult / Монтажный пульт** | Предпросмотр, полоска времени с событиями, области и переходы. Выходы: `images`, `audio`, `fps`, `frame_count` — как у видео 1. Сам сохраняет ролик в `output/Neron_Videos` (галочка 💾). |

Готовая схема: [`workflow/Neron_Video_Editor_v0.2.json`](workflow/Neron_Video_Editor_v0.2.json) (выберите свои файлы в Load Video / Load Image).

## Как пользоваться

1. Load Video → кубик **🎬 Видео ×3** (`video_1`), картинки → **🖼 Картинки ×4**, оба кубика → **🎛 Пульт**.
2. Предпросмотр появляется сразу по файлу; **точный** — после первого «Очереди» (Queue).
3. Бегунок на нужную секунду → **+ 🖼 Картинка** или **+ 🎬 Врезка**. Событие на полоске можно тащить и растягивать за края.
4. Справа: как **появится** и **уйдёт** (Сразу, Наплыв, Проявление, Шторка, Через тьму), **где** (весь кадр или область — двигается и растягивается прямо на кадре, Shift — с пропорцией), **✂ Участок** — какой кусок источника взять, **подогнать цвет**, **звук врезки**.
5. «Очередь» → вкладки **Результат** и **До/После** (шторка сравнения).

**✨ AI-правка** (кнопка «+ ✨ AI»): растяните кусок на полоске (2–15 с) и напишите, **что сделать** — например, «над спиной спасателя расправляются прозрачные белые крылья ангела». Модель MiniMax H3 (лучше ref2va) получает кусок как `<Video 1>`. Нужен образец — положите **картинку внутрь куска**: она станет `<Picture 1>`, а время её появления и исчезновения пульт впишет в промпт сам (по её месту на полоске, от начала куска). Промпт собирается в формате правки H3 (`[video editing]`, оригинал сохранить); написали полный промпт сами — уйдёт как есть. **Область** — из AI берётся только она, остальное оригинал. Вне куска видео не меняется. Готовые куски запоминаются; ушедший в модель промпт виден в «🔧 эксперт».

**Проявление** сначала показывает тёмные линии, потом остальное — как будто рисуют карандашом. В «Монтаже» оно показано примерно, точно — в «Результате».

**🔧 Эксперт:** мягкость края, прозрачность, «Заполнить / Вписать», сила подгонки цвета, скорость врезки, свой fps видео 1, громкости.

## Честно о пределах

* AI-правка ещё не проверена на настоящей модели: у разработчика нет видеокарты с H3. Проверено, что нода образцов ComfyUI принимает кусок и картинки, и весь путь пульта. Время генерации — в строке состояния пульта после прогона.
* Всё видео держится в памяти ComfyUI: 15 с Full HD 30 fps ≈ 11 ГБ ОЗУ на вход и столько же на выход. Длинные ролики режьте в Load Video (`frame_load_cap`, `skip_first_frames`).
* Если `video_info` не подключён, fps видео 1 берётся 24 (пульт предупредит); в эксперте можно задать свой.
* У скачанных и телефонных роликов «паспорт» файла часто врёт о частоте кадров (30 вместо ~28), и Load Video ускоряет видео. Кубик сверяет частоту с настоящими метками времени и берёт настоящую — в строке состояния пульта будут оба числа.

---

# ✂ Neron Video Editor — video → video (v0.3, test)

Edit a ready video without spoiling the rest: video 1 plays as is, frame for frame, and pictures and pieces of other videos appear on top at chosen seconds.

| Node | What it does |
|---|---|
| **🎬 Neron Video ×3** | Up to three videos. **Video 1 is the lead** (edited); 2 and 3 are insert sources. Connect IMAGE from **Load Video** — audio and fps (video_info) wire themselves. |
| **🖼 Neron Pictures ×4** | Up to four pictures via **Load Image**. |
| **🎛 Neron Edit Pult** | Preview, timeline with events, areas and transitions. Outputs `images`, `audio`, `fps`, `frame_count` matching video 1. Saves the clip to `output/Neron_Videos` (💾 checkbox). |

**How to use:** Load Video → **🎬 Video ×3**, pictures → **🖼 Pictures ×4**, both cubes → **🎛 Pult**. Put the playhead where you need and press **+ 🖼 Picture** or **+ 🎬 Insert**; drag and stretch the event on the strip. On the right choose how it **appears** and **leaves** (Cut, Dissolve, Reveal, Wipe, Dip to black), **where** (full frame or an area you move on the frame), **✂ Piece** of the source, **match colour**, **insert sound**. Queue → **Result** and **Before/After** tabs.

**✨ AI edit** (“+ ✨ AI”, needs **✨ Neron Edit AI** on the pult's `ai` input): stretch the piece (2–15 s) and write what to do. MiniMax H3 (ref2va best) gets it as `<Video 1>`; a picture placed inside the piece becomes `<Picture 1>` and its appear/disappear times go into the prompt automatically. **Area** keeps everything else original. Pieces are cached.

**Limits:** the AI edit is not yet tested on the real model (no H3-capable GPU here); ComfyUI's reference node accepting the piece and pictures was verified. The whole video is held in memory: 15 s Full HD 30 fps ≈ 11 GB RAM in and the same out — trim long clips in Load Video. Without `video_info`, video 1 fps is taken as 24 (the pult warns); set your own in expert mode. Downloaded/phone clips often have a wrong fps in the header, which makes Load Video speed them up; the cube checks the real timestamps and uses the real rate (both numbers are shown in the pult status).
