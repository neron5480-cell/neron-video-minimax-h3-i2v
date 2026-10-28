# Neron Theme 🎨 — темы для всего ComfyUI / themes for the whole ComfyUI

Одна нода. Поставили на стол — **весь ComfyUI в теме**: окно, стол, ноды (каждая роль своим цветом), провода и, если хотите, живость: огни, искры, фон, подсветка работы схемы.
Удалили ноду — всё как было.

One node. Put it on the canvas — **the whole ComfyUI is themed**: window, canvas, nodes (each role in its own color), wires and, if you like, life: lights, sparks, background, run highlights.
Delete the node — everything is back.

---

## 🇷🇺 Русский

### Как поставить

Нода входит в пакет Neron: **ComfyUI Manager → Install via Git URL** → ссылка на репозиторий. Или скопируйте папку `NeronTheme` в `ComfyUI/custom_nodes`.
Найти: двойной клик по столу → `Neron Theme`, или меню **Neron → Neron Theme 🎨**.

### Главное за 30 секунд

1. Поставьте ноду **Neron Theme 🎨** на стол — сразу включится тема «Neron Brown».
2. Наведите мышку на любую карточку — стол на секунду покажет, как будет. Кликните — тема стоит.
3. Сохраните workflow — тема сохранится вместе с ним. Кто скачает вашу схему, увидит её в вашем оформлении.

Нода ни к чему не обязана подключаться. Вход `image` — только для темы «из картинки».

### Что именно красится

| Что | Как |
|---|---|
| **Окно ComfyUI** (меню, панели, списки) | В цвета темы. Можно выключить в ⚙ → «красить окно ComfyUI» |
| **Стол** | Фон и сетка |
| **Ноды** | По **ролям**: у каждой роли свой цвет шапки и лёгкий оттенок тела |
| **Провода** | У каждого типа (MODEL, CLIP, IMAGE…) свой цвет, как в ComfyUI, но в гамме темы — типы по-прежнему легко различать |
| **Поля и текст** | Под тему; текст всегда остаётся читаемым — нода сама следит за контрастом |

**Роли нод:** Модели (загрузка моделей, LoRA, VAE, ControlNet) · Вход (загрузка картинок, видео, звука) · Текст (промпты) · Генерация (KSampler и т. п.) · Латент (латент, VAE Decode/Encode) · Обработка (картинки, маски, видео) · Звук · Выход (сохранение, просмотр) · Прочее.
Роль определяется сама — по тому, что нода делает и что отдаёт. Работает с любыми нодами, не только Neron.

**Ваш цвет главнее темы.** Если вы покрасили ноду вручную (правый клик → Colors), тема её не перекрашивает. Ноды со своим фирменным цветом (например, заметки) тоже не трогаются.
Сам workflow тема не меняет: цвета ролей не записываются в ноды, поэтому без нашей ноды схема выглядит как обычно.

### Вкладка УСТАНОВИТЬ

- **Встроенные:** Обычный ComfyUI (тема выключена), Графит, Neron Brown, Неон, Закат, Океан, Лес, Сакура, Монохром, Бумага (светлая).
- **Мои:** темы, которые вы сохранили. Лежат файлами в `ComfyUI/user/neron_themes` — их можно копировать и пересылать. ✖ на карточке — удалить (нажать дважды).
- **Чужая тема:**
  - **код** — вставьте строчку `NERON-THEME1:…` в поле и нажмите 📥 ПОСТАВИТЬ;
  - **файл** — просто бросьте файл темы (`.json`) прямо на ноду.
  Поставленная так тема сразу сохраняется в **Мои**. Подходит и палитра ComfyUI (`.json` из Настройки → Appearance → Export).

### Вкладка СОЗДАТЬ

**Для всех:**
- **Главный цвет** — выберите цвет, и нода соберёт из него всю тему: фон, шапки, роли, провода. Рядом три вида раскладки цветов по ролям: **СОСЕДНИЕ** (соседние оттенки — спокойно), **РАДУГА** (вся радуга — ноды легко различать), **ОДИН ТОН**. Галочка **светлая** — светлый фон и тёмный текст.
- **🖼 Из картинки** — подключите **Load Image** к входу `image` и нажмите кнопку: тема соберётся из цветов картинки (постер, кадр из фильма, ваша генерация). С Load Image работает сразу; с любой другой нодой-картинкой — после одного Queue.
  - В ноде появится превью картинки. **Тяните рамку** по нужному месту (например, только по неоновой вывеске) — тема возьмёт цвета только с этого участка. **Двойной клик** по превью — снова вся картинка.
  - Под превью — **полоска найденных цветов**. Клик по цвету — он станет главным цветом темы (ещё раз — отменить).
  - Рамка и выбранный цвет сохраняются вместе со схемой; подключили другую картинку — они сбрасываются.
- **Название** и **Автор** — ваш ник будет виден всем, с кем вы поделитесь темой.
- **Живость:** ВЫКЛ · СПОКОЙНО · ЖИВО · НА ПОЛНУЮ.
- **💾 Сохранить в Мои** — тема появится на вкладке УСТАНОВИТЬ.

Всё, что вы меняете, сразу видно на столе.

**⚙ ДЛЯ СПЕЦОВ** — весь набор настроек:
- **Цвета:** фон стола, сетка, шапка ноды, тело ноды, текст, поля, рамки полей, провода, панели окна, главный цвет.
- **Роли нод:** свой цвет каждой из 9 ролей.
- **Сила цвета:** сколько цвета роли в шапке и в теле ноды; **свечение**.
- **Живость подробно:** огни по рамкам · искры по проводам · работа схемы · в такт музыке · тише во время генерации · красить окно ComfyUI; **фон** (нет / переливы / частицы / звёзды); **кадров в секунду** (авто / 30 / 45 / 60); **скорость**.

### Живость

- **Огни по рамкам** — огонёк бежит по рамке каждой ноды цветом её роли.
- **Искры по проводам** — бегут от выхода ко входу.
- **Фон** — плывущие переливы, частицы или мерцающие звёзды.
- **Работа схемы** — нода, которая сейчас считается, **светится и показывает полоску прогресса**, по проводам к ней бегут быстрые искры; готовая нода **вспыхивает**; нода с ошибкой **мигает красным**. Сразу видно, где идёт процесс и где он застрял.
- **В такт музыке** — вспышки на ударах звука нод Neron Audio Studio.

> ⚠️ **Братан, не гонись за анимацией.**
> Анимацию рисует браузер. На больших столах (сотни нод) ComfyUI и без неё бывает неповоротлив, а с режимом «На полную» может подтормаживать при перетаскивании. Если стол подлагивает — поставь «Живость» на «Спокойно» или выключи: тема с цветами останется, уйдёт только движение.

### Поделиться

Внизу ноды, всегда на виду. Делится та тема, что стоит **сейчас**:
- **📋 КОД** — копирует короткую строчку `NERON-THEME1:…`. Кидаете её в чат или комментарий — человек вставляет в свою ноду.
- **💾 ФАЙЛ** — файл темы `.json`. Его бросают на ноду.
- **🎨 ДЛЯ COMFYUI** — палитра для встроенных настроек ComfyUI (**Настройки → Appearance → Color Palette → Import**). Работает **без нашей ноды**, но без живости и цветов по ролям.

В код и файл записываются название и автор темы.

### Хорошо знать

- Если на столе **две ноды** Neron Theme — работает первая, на второй будет предупреждение.
- **«Тема» из Neron Audio Studio** красит ноды студии своим способом. Если на столе обе — оставьте одну (нода предупредит).
- Если в настройках ComfyUI у вас стоит **своя картинка на фоне**, тема фон стола не трогает.
- Переключили палитру в настройках ComfyUI, пока тема включена — тема останется сверху; уберёте ноду — вернётся палитра, которую вы выбрали.
- Тема работает в обычном виде нод ComfyUI. В режиме **Nodes 2.0** (Настройки → «Modern Node Design») ноды рисуются по-другому — цвета по ролям и огни по рамкам там могут не появиться.
- Как проверено: автоматически, в настоящем интерфейсе ComfyUI (frontend 1.58) в браузере Chromium, на подставном сервере без генерации картинок. ComfyUI часто обновляет интерфейс — если после обновления что-то перестало краситься, напишите.

---

## 🇬🇧 English

### Install

Part of the Neron pack: **ComfyUI Manager → Install via Git URL** → the repository link. Or copy the `NeronTheme` folder into `ComfyUI/custom_nodes`.
Find it: double-click the canvas → `Neron Theme`, or the **Neron → Neron Theme 🎨** menu.

### The gist in 30 seconds

1. Put **Neron Theme 🎨** on the canvas — "Neron Brown" turns on right away.
2. Hover any card — the canvas shows how it will look. Click — the theme is on.
3. Save the workflow — the theme is saved with it. Whoever downloads your workflow sees it the way you styled it.

The node does not have to be wired. The `image` input is only for "theme from picture".

### What gets themed

| What | How |
|---|---|
| **ComfyUI window** (menus, panels, lists) | Theme colors. Can be turned off in ⚙ → "theme the ComfyUI window" |
| **Canvas** | Background and grid |
| **Nodes** | By **role**: each role has its own title color and a light body tint |
| **Wires** | Each type (MODEL, CLIP, IMAGE…) keeps its own color as in ComfyUI, but in the theme's palette — types stay easy to tell apart |
| **Fields and text** | Match the theme; text always stays readable — the node watches the contrast |

**Node roles:** Models · Input (image, video, audio loaders) · Text (prompts) · Generate (KSampler etc.) · Latent (latents, VAE Decode/Encode) · Process (images, masks, video) · Audio · Output (save, preview) · Other.
The role is detected automatically from what a node does and outputs. Works with any nodes, not only Neron.

**Your color wins.** A node you colored by hand (right-click → Colors) is not repainted. Nodes with their own signature color (e.g. notes) are left alone too.
The workflow itself is not changed: role colors are not written into nodes, so without our node the workflow looks as usual.

### INSTALL tab

- **Built-in:** Plain ComfyUI (theme off), Graphite, Neron Brown, Neon, Sunset, Ocean, Forest, Sakura, Mono, Paper (light).
- **Mine:** themes you saved. Stored as files in `ComfyUI/user/neron_themes` — copy and send them around. ✖ on a card deletes it (press twice).
- **Someone's theme:** paste a `NERON-THEME1:…` **code** and press 📥 APPLY, or drop a theme **file** (`.json`) right onto the node. It is saved to **Mine** at once. A ComfyUI palette (`.json` from Settings → Appearance → Export) works too.

### CREATE tab

**For everyone:**
- **Main color** — pick a color and the node builds the whole theme from it. Three ways to spread colors over roles: **HARMONY** (neighbouring shades), **RAINBOW** (the whole rainbow — nodes are easy to tell apart), **MONO**. **light** — a light background with dark text.
- **🖼 From picture** — wire **Load Image** to the `image` input and press the button: the theme is built from the picture's colors. Works instantly with Load Image; with any other image node — after one Queue.
  - A preview of the picture appears in the node. **Drag a frame** over the spot you want (e.g. just a neon sign) — the theme takes colors only from that area. **Double-click** the preview — the whole picture again.
  - Under the preview there is a **strip of found colors**. Click a color — it becomes the main theme color (click again to undo).
  - The frame and the chosen color are saved with the workflow; a different picture resets them.
- **Name** and **Author** — your nickname is visible to everyone you share the theme with.
- **Life:** OFF · CALM · LIVELY · FULL.
- **💾 Save to Mine** — the theme shows up under INSTALL.

Everything you change shows on the canvas right away.

**⚙ EXPERT** — the full set: every color (canvas, grid, node title, node body, text, fields, field borders, wires, window panels, main color), each of the 9 role colors, role strength in title and body, glow, and life details: frame lights · wire sparks · workflow run · on the beat · quieter while generating · theme the ComfyUI window; background (none / flow / particles / stars); FPS limit (auto / 30 / 45 / 60); speed.

### Life

- **Frame lights** — a light runs along each node frame in its role color.
- **Wire sparks** — run from output to input.
- **Background** — flowing colors, particles or twinkling stars.
- **Workflow run** — the running node **glows and shows a progress bar**, fast sparks run along the wires into it; a finished node **flashes**; a node with an error **blinks red**. You see at once where the work is and where it got stuck.
- **On the beat** — flashes on the beat of Neron Audio Studio sound.

> ⚠️ **Bro, don't chase the animation.**
> The browser draws it. On big canvases (hundreds of nodes) ComfyUI can feel heavy even without it, and "Full" mode may stutter while dragging. If it lags, set "Life" to "Calm" or off — the colors stay, only the motion goes.

### Share

At the bottom of the node, always visible. It shares the theme that is on **now**:
- **📋 CODE** — copies a short `NERON-THEME1:…` line for a chat or a comment.
- **💾 FILE** — a `.json` theme file to drop on the node.
- **🎨 FOR COMFYUI** — a palette for ComfyUI's own settings (**Settings → Appearance → Color Palette → Import**). Works **without our node**, but without life and role colors.

The code and the file carry the theme's name and author.

### Good to know

- **Two** Neron Theme nodes on the canvas — the first one is in charge; the other shows a warning.
- The **Neron Audio Studio "Theme"** node paints the studio nodes its own way. If both are on the canvas, keep one (the node warns you).
- If you have **your own background picture** in ComfyUI settings, the theme leaves the canvas background alone.
- Switching the ComfyUI palette while the theme is on keeps the theme on top; remove the node and your chosen palette comes back.
- The theme works with the classic ComfyUI node look. In **Nodes 2.0** mode (Settings → "Modern Node Design") nodes are drawn differently — role colors and frame lights may not appear there.
- How it was tested: automatically, in the real ComfyUI interface (frontend 1.58) in Chromium, on a stand-in server without image generation. ComfyUI updates its interface often — if something stops being themed after an update, let us know.
