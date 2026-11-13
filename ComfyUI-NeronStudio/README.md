# 🖥 Neron Studio — свой рабочий стол внутри ComfyUI / your own desktop inside ComfyUI

## 🇷🇺 Русский

**Что это.** Рабочий стол Neron прямо внутри ComfyUI: плитки, папки и свой фон — и все процессы Neron в один клик.
Нод не добавляет. 📖 Подробно, со скриншотами: [статья на Civitai](https://civitai.com/articles/38373).

**Как открыть.** Монета **«N»** на холсте (её можно перетащить в любое место) или меню **Neron → Neron Studio**.
Закрыть — «✕ В ComfyUI» или Esc.

**Папки.** Стол › **Видео** · **Картинки** · **Звук**; внутри — плитки по задачам (Фото → видео,
Длинный ролик, Диалог…), а в них — варианты процесса. Путь «Стол › Видео › …» сверху: нажми на любое звено, чтобы
вернуться. Назад — «‹ Назад» или Esc. Папка, в которой не установлен ни один процесс, сама прячется.

**Вид.** Светлый и спокойный: серо-белый с лёгкой синевой. На каждой плитке — иконка, название и одна строка
простыми словами, что она делает. Тёмные темы (Аурей и другие) — в «🎨 Тема».

**Плитки.** Тянуть, растягивать, убирать и возвращать, «⊞ Выровнять». Раскладка своя у каждой папки и
запоминается в браузере. Размер плиток — 50–140 %, свой цвет плиток и акцента.

**«Открыть» на плитке** загружает настоящий процесс Neron в ComfyUI новой вкладкой — текущая работа не трогается.
Процесса нет — плитка пишет «Не установлено». Проверенные процессы лежат внутри как есть
(`ComfyUI-NeronStudio/workflows`); модели к ним — по заметкам в самих процессах.

**Процесс в оформлении стола.** Сверху — полоса Neron Studio: название процесса, «▶ Создать», «■ Стоп», часы,
«⤴ Наверх» (выход из подграфа), «🏠 Стол» и «✕». Ноды «стеклянные» в цветах стола (тема Neron Studio из Neron Theme).
Меню, вкладки, мини-карта и кнопки масштаба прячутся штатными выключателями ComfyUI — остаются холст, фон и полоса.
Оформление живёт только во вкладках, открытых со стола. «✕» на полосе — обычный ComfyUI, всё возвращается как было
(и стол забывает свои вкладки).

**🖼 Свой фон** — фото, гифка или видео на весь экран (перетащить на стол или «🎨 Тема» → «📂 Выбрать файл…»), с
затемнением, размытием и «стеклянными» плитками. С нодой Neron Theme фон виден и **под холстом ComfyUI**. Файл
хранится только в этом браузере. Видео-фон немного нагружает видеокарту: на мощном компьютере это незаметно; если
компьютер слабый или каждая секунда генерации на счету — поставьте фото или гифку.

**🎨 Тема** — те же темы, что у ноды Neron Theme (Графит, Neon, Океан, светлая «Бумага» и др.), или «🔗 Как в
ComfyUI» — стол сам переключается вместе с темой, которую ставит нода Neron Theme.

**RU / EN** — по языку системы, плюс переключатель на столе. Полоса процесса тоже двуязычная.

**Установка.** Одной ссылкой (ComfyUI Manager → Install via Git URL →
`https://github.com/neron5480-cell/neron-video-minimax-h3-i2v`) или вручную: папку `ComfyUI-NeronStudio` — в
`ComfyUI/custom_nodes`, перезапустить ComfyUI. Comfy Desktop запоминает старые файлы стола: при ручном обновлении
сначала удалите старую папку, потом кладите новую.

---

## 🇬🇧 English

**What it is.** The Neron desktop right inside ComfyUI: tiles, folders and your own background — and every Neron
workflow one click away. Adds no nodes. 📖 Details with screenshots: [article on Civitai](https://civitai.com/articles/38373).

**How to open.** The **«N»** coin on the canvas (you can drag it anywhere) or the menu **Neron → Neron Studio**.
Close with «✕ To ComfyUI» or Esc.

**Folders.** Desktop › **Video** · **Images** · **Sound**; inside — tiles by task (Photo → video,
Long video, Dialogue…), and inside those — workflow variants. The path "Desktop › Video › …" is at the top: click any
part of it to go back. Back — «‹ Back» or Esc. A folder with no installed workflow hides itself.

**Look.** Light and calm: gray-white with a cool blue tint. Every tile has an icon, a name and one plain line
about what it does. Dark themes (Aureus and others) are in «🎨 Theme».

**Tiles.** Drag, resize, remove and bring back, «⊞ Tidy up». Every folder has its own layout, remembered in the
browser. Tile size 50–140 %, your own tile and accent colors.

**«Open» on a tile** loads the real Neron workflow into ComfyUI in a new tab — your current work is not touched.
No workflow installed — the tile says «Not installed». Tested workflows ship inside as they are
(`ComfyUI-NeronStudio/workflows`); their models — see the notes inside each workflow.

**Workflow in the desk look.** At the top — the Neron Studio strip: workflow name, «▶ Create», «■ Stop», a clock,
«⤴ Up» (out of a subgraph), «🏠 Desktop» and «✕». Nodes are "glass" in the desk colors (the Neron Studio theme from
Neron Theme). The menu, tabs, minimap and zoom buttons are hidden with ComfyUI's own switches — the canvas, background
and strip remain. The look lives only in tabs opened from the desk. «✕» on the strip — plain ComfyUI, everything comes
back as it was (and the desk forgets its tabs).

**🖼 Your own background** — a photo, GIF or video, full screen (drop it on the desk or «🎨 Theme» → «📂 Choose a file…»),
with dimming, blur and "glass" tiles. With the Neron Theme node the background also shows **under the ComfyUI
canvas**. The file is stored only in this browser. A video background puts a little load on the GPU: on a strong
computer you won't notice; if the computer is weak or every second of generation counts — use a photo or a GIF.

**🎨 Theme** — the same themes as the Neron Theme node (Graphite, Neon, Ocean, the light «Paper» and others), or
«🔗 As in ComfyUI» — the desk switches together with the theme set by the Neron Theme node.

**RU / EN** — from the system language, plus a switch on the desk. The workflow strip is bilingual too.

**Installation.** By one link (ComfyUI Manager → Install via Git URL →
`https://github.com/neron5480-cell/neron-video-minimax-h3-i2v`) or manually: put the `ComfyUI-NeronStudio` folder into
`ComfyUI/custom_nodes` and restart ComfyUI. Comfy Desktop remembers old desk files: when updating by hand, delete the
old folder first, then put in the new one.
