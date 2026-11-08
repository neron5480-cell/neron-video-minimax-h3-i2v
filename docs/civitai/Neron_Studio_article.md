# Civitai: статья + пост про Neron Studio / article + post

Как вставлять: в Civitai → Articles → Create. Заголовок — в поле Title, текст — блоками ниже
(подзаголовки делайте кнопкой «Heading» в редакторе, списки — кнопкой списка).
Сначала идёт русская часть, потом английская — целиком, одна под другой.
Места для картинок помечены [📷 …].

Теги: comfyui, workflow, tool, ui, desktop, minimax, h3, ltx, flux, audio, neron

=====================================================================
ЗАГОЛОВОК / TITLE
=====================================================================

Neron Studio — свой рабочий стол внутри ComfyUI / your own desktop inside ComfyUI

=====================================================================
ОБЛОЖКА / COVER
=====================================================================

[📷 Стартовый экран: папки Видео · Картинки · Звук · Модели на вашем фоне (девушка в жёлтом плаще)]

=====================================================================
🇷🇺 РУССКИЙ
=====================================================================

## Что это

Neron Studio — рабочий стол прямо внутри ComfyUI. Не процесс и не нода, а пространство: плитки, папки, свой фон — и все процессы Neron в одном месте.

Открыли стол → выбрали папку → нажали «Открыть» → процесс загрузился в ComfyUI уже в оформлении стола: сверху одна полоса с кнопками «▶ Создать», «■ Стоп» и часами, лишние панели спрятаны, под нодами — ваш фон.

Сделано для тех, кто открыл ComfyUI впервые и не хочет разбираться в лапше. Профи ничего не теряют: «✕» — и перед вами обычный ComfyUI.

[📷 Процесс, открытый со стола: полоса NERON STUDIO сверху, ноды на фоне]

## Что умеет

**Папки вместо каши.** На стартовом экране — только Видео, Картинки, Звук и Модели. Внутри папок — плитки по задачам, внутри задач — варианты процесса и модели. Сверху путь «Стол › Видео › Фото → видео», назад — по пути, кнопкой «‹ Назад» или Esc.

**Живые плитки.** Каждая плитка показывает, что делает процесс: плёнка крутится, кадр расширяется, эквалайзер играет. Плитки можно перетаскивать, растягивать за уголок, убирать ✕ и возвращать через «＋ Плитка». «⊞ Выровнять» убирает дыры. Раскладка запоминается — своя у каждой папки.

**Свой фон.** Фото, гифка или видео на весь экран — просто перетащите файл на стол. Тот же фон встаёт и под холст ComfyUI, ноды становятся «стеклом». Затемнение, размытие и прозрачность плиток — ползунками.

**Темы, размер и цвет.** Темы из Neron Theme (или «как в ComfyUI»), размер плиток 50–140 %, свой цвет плиток и акцента. Текст на плитках сам становится читаемым на любом цвете.

**Два языка.** Русский или английский — сам, по языку системы. Переключатель RU | EN рядом с «Темой».

**Своё оформление процесса.** «▶ Создать» запускает, часы показывают этап и время, «⤴ Наверх» выводит из подграфа, «🏠 Стол» — обратно на стол, «✕» — обычный ComfyUI.

[📷 Папка «Видео»: Фото → видео, Длинный ролик, Диалог, Движение по видео, Улучшить видео, Для профи]

## Что внутри (проверенные процессы Neron)

🎬 **Видео**
• Фото → видео: MiniMax H3 I2V v3.0 · LTX Engine (автопромтер) · LTX 2.3 Image-to-Video
• Длинный ролик: H3 Story (до 45 с) · Full Pipeline (Auto Director)
• Диалог: Smart MiniMax H3 v1.0
• Движение по видео: SCAIL (Wan 2.1)
• Улучшить видео: Perception Relay
• Для профи: H3 Raw Engine

🖼 **Картинки**
• Расширение изображения (Flux-Fill Pre-Processor v1.1)
• Реставрация и раскраска · Улучшить качество (Restore Studio)
• Скоро: генератор кадра, редактор словами, примерочная, удаление фона

🎵 **Звук** — Audio Studio 2.0 (DJ-пульт, сведение, клип со звуком)

Процессы лежат внутри пакета как есть — те же, что выложены на Civitai.

## Установка — 3 шага

1. ComfyUI → **Manager** → **Custom Nodes Manager** → в поиске **Neron** → **Install** (уже стоит — **Update**).
2. Полностью перезапустите ComfyUI.
3. На холсте появится золотая монета **N** (её можно перетащить куда удобно) — щёлкните. Или меню **Neron → Neron Studio**.

Не нашли в Manager? **Manager → Install via Git URL** и вставьте:
https://github.com/neron5480-cell/neron-video-minimax-h3-i2v

## Важно знать

• Стол не скачивает модели сам. Нужные модели и ноды для каждого процесса — в заметках внутри процесса (у многих есть 📥 «Модели», которые качают сами).
• Если процесса нет в вашей установке, на плитке будет «Не установлено» — обновите пакет Neron.
• Ваш фон хранится только в вашем браузере и никуда не отправляется.
• Проверено на ComfyUI Desktop 0.44.2 (Windows, RTX 5070 Ti 16 ГБ).

## Частые вопросы

**Нет монеты N.** Перезапустите ComfyUI полностью и обновите страницу (Ctrl+F5). Ставили архивом вручную — удалите старую папку перед распаковкой новой.

**Пропали меню и вкладки ComfyUI.** Это оформление стола. Нажмите «✕» на полосе сверху — вернётся обычный ComfyUI.

**Зашёл в подграф и не выйти.** Кнопка «⤴ Наверх» на полосе.

**Плитки слишком большие.** «🎨 Тема» → «🔲 Плитки» → «Размер плиток».

**Хочу менять процесс, а не просто запускать.** «✕» — и правьте в обычном ComfyUI, как всегда.

---

Автор: neron5480922. Отзывы и идеи — в комментариях. 🙏

=====================================================================
🇬🇧 ENGLISH
=====================================================================

## What it is

Neron Studio is a desktop right inside ComfyUI. Not a workflow and not a node — a space: tiles, folders, your own background, and every Neron workflow in one place.

Open the desk → pick a folder → press «Open» → the workflow loads into ComfyUI already in the desk look: one bar on top with «▶ Create», «■ Stop» and a clock, extra panels hidden, your background under the nodes.

Made for people who open ComfyUI for the first time and don't want to untangle the spaghetti. Pros lose nothing: press «✕» and it's plain ComfyUI again.

[📷 A workflow opened from the desk: the NERON STUDIO bar on top, nodes over the background]

## What it does

**Folders instead of chaos.** The start screen has only Video, Images, Sound and Models. Folders hold tiles by task; tasks hold the workflow and model variants. A path on top — «Desktop › Video › Photo → video»; go back via the path, «‹ Back» or Esc.

**Live tiles.** Every tile shows what the workflow does: film rolls, a frame expands, an equalizer plays. Drag tiles, resize them by the corner, remove with ✕ and bring back with «＋ Tile». «⊞ Tidy up» closes the gaps. The layout is remembered — per folder.

**Your own background.** A photo, GIF or video, full screen — just drop the file on the desk. The same background goes under the ComfyUI canvas, nodes turn to glass. Dimming, blur and tile transparency — with sliders.

**Themes, size and color.** Neron Theme themes (or «as in ComfyUI»), tile size 50–140 %, your own tile and accent color. Tile text stays readable on any color.

**Two languages.** Russian or English — picked automatically from your system language. RU | EN switch next to «Theme».

**Its own workflow look.** «▶ Create» runs it, the clock shows the stage and time, «⤴ Up» leaves a subgraph, «🏠 Desktop» goes back to the desk, «✕» — plain ComfyUI.

[📷 The Video folder: Photo → video, Long video, Dialogue, Motion from video, Enhance video, For pros]

## What's inside (tested Neron workflows)

🎬 **Video**
• Photo → video: MiniMax H3 I2V v3.0 · LTX Engine (autoprompter) · LTX 2.3 Image-to-Video
• Long video: H3 Story (up to 45 s) · Full Pipeline (Auto Director)
• Dialogue: Smart MiniMax H3 v1.0
• Motion from video: SCAIL (Wan 2.1)
• Enhance video: Perception Relay
• For pros: H3 Raw Engine

🖼 **Images**
• Expand an image (Flux-Fill Pre-Processor v1.1)
• Restore & colorize · Improve quality (Restore Studio)
• Coming: image generator, edit with words, try-on, background removal

🎵 **Sound** — Audio Studio 2.0 (DJ pult, mixing, clip with sound)

The workflows ship inside the pack as they are — the same ones published on Civitai.

## Install — 3 steps

1. ComfyUI → **Manager** → **Custom Nodes Manager** → search **Neron** → **Install** (already installed — **Update**).
2. Fully restart ComfyUI.
3. A golden **N** coin appears on the canvas (drag it anywhere) — click it. Or the menu **Neron → Neron Studio**.

Not in Manager? **Manager → Install via Git URL** and paste:
https://github.com/neron5480-cell/neron-video-minimax-h3-i2v

## Good to know

• The desk doesn't download models by itself. The models and nodes each workflow needs are listed in the notes inside it (many have a 📥 «Models» window that downloads them for you).
• If a workflow isn't in your install, its tile says «Not installed» — update the Neron pack.
• Your background is kept only in your browser and is never sent anywhere.
• Tested on ComfyUI Desktop 0.44.2 (Windows, RTX 5070 Ti 16 GB).

## FAQ

**No N coin.** Fully restart ComfyUI and refresh the page (Ctrl+F5). Installed from a zip by hand — delete the old folder before unpacking the new one.

**ComfyUI menus and tabs are gone.** That's the desk look. Press «✕» on the top bar — plain ComfyUI is back.

**Went into a subgraph and can't get out.** The «⤴ Up» button on the bar.

**Tiles are too big.** «🎨 Theme» → «🔲 Tiles» → «Tile size».

**I want to edit the workflow, not just run it.** Press «✕» and edit in plain ComfyUI as usual.

---

Author: neron5480922. Feedback and ideas — in the comments. 🙏

=====================================================================
ПОСТ-ВИТРИНА / SHOWCASE POST (Civitai → Posts)
=====================================================================

Картинки (по порядку) / Images (in order):
1. Стартовый экран с вашим фоном / start screen with your background
2. Папка «Видео» / the Video folder
3. «🎨 Тема»: фон, размер, цвета / Theme panel: background, size, colors
4. Процесс в оформлении стола / a workflow in the desk look
5. Тот же стол на другой теме / the same desk with another theme

Текст поста / Post text:

🖥 Neron Studio — свой рабочий стол внутри ComfyUI. Папки вместо каши, живые плитки, свой фон (фото / гифка / видео) — и все процессы Neron в один клик. RU / EN.
Установка: Manager → Neron → Update → перезапуск → золотая монета N.
Подробно — в статье: [ссылка на статью]

🖥 Neron Studio — your own desktop inside ComfyUI. Folders instead of chaos, live tiles, your own background (photo / GIF / video) — and every Neron workflow one click away. RU / EN.
Install: Manager → Neron → Update → restart → golden N coin.
Details in the article: [article link]
