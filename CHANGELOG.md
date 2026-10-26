# Changelog / История изменений

## dev · Neron DJ Пульт / DJ Controller 🎧 (в работе, ветка dev / in progress, dev branch)

**RU:**
- Новая нода **Neron DJ Пульт** (меню NeronAudio): две деки с джогами и волнами, ▶ / CUE / SYNC, ползунки темпа, 8 пэдов на деку в трёх режимах (точки, звуки, петли), фильтр, громкость, кроссфейдер, индикаторы.
- Треки — проводами `deck_a`, `deck_b`; свои звуки для пэдов — `pad_sounds` (Звук ×8). Без провода пэды играют 8 встроенных звуков (без файлов).
- **⏺ ЗАПИСЬ** сета: по Queue запись идёт на выход `audio` и сохраняется в `output/Neron_DJ`. Без записи — авто-переход A → B.
- Темп и удары находятся сами; SYNC подгоняет и темп, и удары.

**EN:**
- New **Neron DJ Controller** node (NeronAudio menu): two decks with jog wheels and waves, ▶ / CUE / SYNC, tempo sliders, 8 pads per deck in three modes (cues, samples, loops), filter, volume, crossfader, meters.
- Tracks by wire `deck_a`, `deck_b`; your own pad sounds — `pad_sounds` (Sound ×8). Without it the pads play 8 built-in sounds (no files).
- **⏺ REC** a set: on Queue it goes out on `audio` and is saved in `output/Neron_DJ`. No recording — an auto transition A → B.
- Tempo and beats are detected automatically; SYNC matches both tempo and beats.

## v2.0 — Neron Audio Studio 2 (25.10.2026)

**RU:** Модульная студия: кубики (Видео ×3, Звук ×8, Музыка) → посредники (Видео-сэмплер, Сэмплер, Студия) → Пульт-сердце. Эквалайзер и эхо, музыка под ролик, монтаж по кадрам, поле сборки, общий эквалайзер со спектром, темы с живыми огнями. Новая схема: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json`; прежняя `Neron_Audio_Studio_v1.0_Beta.json` оставлена. Подробности — в записях ниже.

**EN:** A modular studio: cubes (Video ×3, Sound ×8, Music) → middle nodes (Video Sampler, Sampler, Studio) → the Pult as the heart. EQ and reverb, music to the clip, frame-accurate editing, an arrange field, a master EQ with a spectrum, themes with live lights. New workflow: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json`; the previous `Neron_Audio_Studio_v1.0_Beta.json` is kept. Details below.

## v2.0 · Neron Audio Studio: темы и «живость» / themes and "life" (вошло в v2.0 / part of v2.0)

**RU:**
- **Neron Theme / Тема 🎨** — нода ни к чему не подключается. Есть на столе — ноды Neron в теме; удалили — снова обычный серый вид. Тема сохраняется вместе со схемой: кто скачал workflow, видит его таким, как задумано.
- Три темы карточками с превью: **Графит** (спокойный серый), **Neron Brown** (фирменная тёплая), **Неон** (яркая, светящаяся).
- У каждого кубика свой цвет: видео — синий, звук — зелёный, музыка и студия — оранжевый, Пульт — фиолетовый. В этот цвет окрашены шапка ноды, рамка панели и **провода** по типу (видео / звуки / AUDIO). Группы рабочего стола (🎬 🎵 🥁 🎚 🎨) — в тон теме.
- **✨ Живость**: ВЫКЛ — без анимации; СПОКОЙНО — огонёк медленно ползёт по рамкам нод, искры бегут по проводам, пока играет музыка; НА ПОЛНУЮ — по рамкам бегут по два огня со светящимся хвостом, искры по проводам всегда, а **на каждом ударе музыки** рамки и панели вспыхивают. Музыку «слышит» общая шина уровня: туда отводится звук Пульта, Студии, сэмплера, барабанов, пианино, загрузчиков.
- Все панели переведены на «цвета темы» (с запасным серым) — без ноды темы вид ровно прежний.
- Рабочий стол: добавлена нода «Тема» (Neron Brown, спокойно).
- **Огни в такт**: удары ловятся по басам (бочка 40–160 Гц), а не по общей громкости — хэты не мешают, в плотной музыке удары не теряются (тест: 6 из 6 на простом бите, 7 из 8 на плотном треке). На каждом ударе огни по рамкам и искры по проводам делают заметный рывок вперёд и вспыхивают, между ударами — замедляются. Если басов нет совсем (пианино, хэты), удар берётся по громкости.
- Огни стали плавными: вспышка мягко разгорается (~0,06 с) и долго тает (~0,9 с), рывок огня набирается и сходит на нет плавно, свечение панелей гаснет за 0,35 с — стол «дышит», а не дёргается.
- «Видео ×3»: пока большой ролик грузится — надпись «⏳ загружаю ролик…» вместо пустого плеера; превью и экран Видео-сэмплера показывают кадр из ~10% ролика (начало клипов часто тёмное).

**EN:**
- **Neron Theme 🎨** — not wired to anything. On the canvas — Neron nodes take the theme; delete it — back to the plain grey look. The theme is saved with the workflow.
- Three theme cards with previews: **Graphite**, **Neron Brown** (the warm signature one), **Neon** (bright, glowing).
- Every cube has its colour (video blue, sound green, music/studio orange, Pult purple) for the title, the panel frame and the **wires** by type. Desk groups follow the theme.
- **✨ Life**: OFF; CALM — a slow light on node frames and wire sparks while music plays; FULL — two running lights with glowing tails, sparks always, and frames and panels **flash on every beat** (a shared level bus hears the Pult, Studio, sampler, drums, piano and loaders).
- All panels now use theme colours with grey fallbacks — without the Theme node everything looks exactly as before. The ready desk has a Theme node (Neron Brown, calm).
- **Lights on the beat**: beats are detected from the bass (kick, 40–160 Hz), not overall loudness — hats do not trigger, dense music keeps its beats (test: 6/6 on a simple beat, 7/8 on a dense track). On every beat the frame lights and wire sparks jump forward and flash, then slow down until the next one.
- Smoother lights: the flash rises softly (~0.06 s) and fades slowly (~0.9 s), light jumps ease in and out, panel glow fades over 0.35 s — the desk breathes instead of twitching.
- Video ×3 shows "⏳ loading the clip…" while a big file loads; the preview and the Video Sampler screen show a frame from ~10% of the clip (clip starts are often dark).

## v2.0 · Neron Audio Studio: Студия / Studio (вошло в v2.0 / part of v2.0)

**RU:**
- **Neron Studio / Студия 🎛** — посредник между «Музыкой» (или «Звук ×8», сэмплером) и Пультом. **Каждая дорожка студии** (HIHATS, KICKS, каждая дорожка пианино, каждый звук) — свой канал: ▶ (слушать только её), M, S, громкость, баланс, **НИЗ / СЕР / ВЕРХ**, **ЭХО** + помещение, ↺, индикатор уровня и волна с бегунком.
- **Общий эквалайзер на выходе — 10 полос** (31 Гц … 16 кГц, ±12 дБ): тяните точки вверх-вниз, колёсико — точнее, двойной клик — в ноль. Под кривой — **живой спектр** звука. Готовые настройки: Ровно, Больше баса, Ярче, Тёплый, Голос впереди, Улыбка, Клуб, Старое радио. **ВКЛ / ВЫКЛ** — сравнить «с ним / без него».
- ⏭ ПРОПУСТИТЬ — Пульт видит всё, как будто Студии нет (у «Музыки» — барабаны и пианино). Отжата — Пульт слышит Студию одним каналом «🎛 СТУДИЯ» (и заранее, без Queue).
- «Музыка» теперь отдаёт каждую дорожку отдельно (для Студии); Пульт по-прежнему видит два канала.
- Ручки и эхо вынесены в общий файл — в Пульте и Студии они одинаковые. Рабочий стол: Музыка → Студия → Пульт.
- **🧱 ПОЛЕ сборки в Студии** (как плейлист FL Studio): по горизонтали такты, у каждой дорожки своя полоса. Клик по полосе — блок (длина = луп дорожки), тянуть — двигать, край — длина, двойной клик / Delete — убрать, Ctrl+D — копия следом, Ctrl+Z — отменить, клик по линейке — откуда играть, колёсико — масштаб. Внутри блоков видна волна дорожки, тёмные черточки — где луп начинается заново. ⊞ ВСЕ ДОРОЖКИ — каждая дорожка блоком с 1-го такта. Пустое поле — всё по кругу, как раньше; есть блоки — Студия (и Пульт, и файл) играет собранный трек ровно по тактам.

**EN:**
- **Neron Studio 🎛** — between Music (or Sound ×8, the sampler) and the Pult. **Every studio track** is its own channel: ▶ (solo listen), M, S, volume, pan, **LOW / MID / HIGH**, **REVERB** + room, ↺, a level meter and a wave with a playhead.
- **10-band master EQ** (31 Hz … 16 kHz, ±12 dB): drag the points, wheel for fine steps, double-click resets. A **live spectrum** under the curve. Presets: Flat, More bass, Brighter, Warm, Voice up front, Smile, Club, Old radio. **ON / OFF** to compare.
- ⏭ BYPASS — the Pult sees everything as if the Studio weren't there. Off — the Pult hears the Studio as one "🎛 STUDIO" channel (also before Queue).
- Music now also outputs every track separately (for the Studio); the Pult still sees two channels. Knobs and reverb live in a shared file. Ready desk: Music → Studio → Pult.
- **🧱 ARRANGE field in the Studio** (like the FL Studio playlist): bars across, one lane per track. Click a lane to put a block (track loop length), drag to move, edge — length, double-click / Delete — remove, Ctrl+D — copy after, Ctrl+Z — undo, click the ruler to set the start, wheel zooms. Blocks show the track wave. ⊞ ALL TRACKS puts every track from bar 1. An empty field loops everything as before; with blocks the Studio (the Pult and the file too) plays the arranged track bar-exact.

## v2.0 · Neron Audio Studio: музыка под ролик / music to the clip (вошло в v2.0 / part of v2.0)

**RU:**
- **ПО ДЛИНЕ ВИДЕО** в новом Пульте включено сразу: короткая музыка повторяется до конца ролика, длинная обрезается — и теперь **мягко затихает в конце** (1,5 с; и при прослушивании, и в файле).
- **Рамка на волне:** если трек длиннее ролика, на его волне жёлтая рамка «▶ 0:18» — тяните её, чтобы выбрать, какой кусок трека звучит под роликом (например, припев). Клик мимо рамки — перемотка, как раньше.
- **⚙ ДЛЯ СПЕЦОВ** в Пульте: длина затухания (0–6 с, двойной клик — 1,5), **🎯 ТЕМП ПОД ВИДЕО** — Пульт чуть меняет BPM, чтобы в ролик входило целое число тактов (для барабанов, пианино, «Музыки», сэмплера; пишет, насколько точно), **⇤ РАМКИ В НАЧАЛО**.
- **⚙ ДЛЯ СПЕЦОВ** в Видео-сэмплере: **🧲 РЕЗАТЬ В ДОЛЮ** — склейки, края кусков и курсор прилипают к долям темпа Пульта (сиреневые линии — доли, яркие — такты); новый кусок — целое число долей.
- Склейки монтажа считаются от начала (концы кусков округляются к кадру по общему времени) — на длинном монтаже ошибка не копится.
- В Пульте появилась кнопка **📖** с помощью на двух языках.

**EN:**
- **FIT TO VIDEO** is on by default in a new Pult: short music repeats, long music is cut — and now **fades out at the end** (1.5 s, in preview and in the file).
- **Frame on the wave:** a track longer than the clip shows a yellow frame "▶ 0:18" — drag it to choose which part plays under the clip. A click outside the frame seeks as before.
- **⚙ EXPERT** in the Pult: fade length, **🎯 TEMPO TO VIDEO** (nudges the BPM so a whole number of bars fits the clip, reports the accuracy), **⇤ FRAMES TO START**.
- **⚙ EXPERT** in the Video Sampler: **🧲 CUT ON THE BEAT** — cuts, piece edges and the cursor stick to the Pult tempo beats; a new piece is a whole number of beats.
- Edit cuts are rounded to frames on the overall timeline, so long edits don't drift. The Pult got a bilingual **📖** help.

## v2.0 · Neron Audio Studio: Видео-сэмплер / Video Sampler (вошло в v2.0 / part of v2.0)

**RU:**
- **Neron Video Sampler / Видео-сэмплер 🎬** — между «Видео ×3» и Пультом. Слева экран, справа три дорожки — три ролика с кадрами-превью: мышкой выделяете кусок «откуда — докуда» (края тянутся, двойной клик — весь ролик), ▶ — посмотреть кусок, **➜** или перетащить вниз (можно наискосок) — кусок встаёт в **МОНТАЖ**.
- **Монтаж** — куски идут друг за другом: тянуть кусок — переставить, тянуть края — обрезать, клик — курсор (экран показывает этот кадр), **✂ / S** — разрезать на курсоре (точно по кадру), **⧉ / Ctrl+D** — копия, **◀ ▶** — переставить, **🗑 / Delete** — убрать, **Ctrl+Z / Ctrl+Y** — отменить / вернуть, ←/→ — по кадру, колёсико — масштаб, Shift+колёсико — прокрутка, пробел — смотреть.
- **⏭ ПРОПУСТИТЬ** — ролики идут в Пульт как есть. Положили первый кусок — пропуск выключается сам, Пульт видит монтаж.
- **🔇 / 🔊 звук роликов** — убрать звук роликов совсем (в просмотре, в Пульте и в готовом видео).
- Монтаж сам собирается в точный по кадрам mp4 (через 1,5 с после правки) и уходит в Пульт одним роликом «🎬 Монтаж». Старые черновые сборки удаляются сами.
- Пульт: если в нём только видео без звука — отдаёт ролик с тишиной, а не ошибку.
- Рабочий стол обновлён: Видео ×3 → Видео-сэмплер → Пульт.
- Исправлено: ⏭ работает всегда (и во время просмотра). Отжата — в Пульте ровно один блок «🎬 Монтаж»; пока монтаж пуст или собирается, в этом блоке так и написано (раньше при пустом монтаже в Пульт шли исходные ролики).

**EN:**
- **Neron Video Sampler 🎬** — between Video ×3 and the Pult. A screen on the left, three clip rows with thumbnails: select a piece (drag edges, double-click = whole clip), ▶ watches it, **➜** or drag it down (diagonal is fine) puts it into the **EDIT**.
- **Edit**: pieces play one after another — drag to reorder, drag edges to trim, click to set the cursor, **✂ / S** cuts at the cursor (frame-exact), **⧉ / Ctrl+D** copies, **◀ ▶** moves, **🗑 / Delete** removes, Ctrl+Z / Ctrl+Y, ←/→ step a frame, wheel zooms, Shift+wheel scrolls, space plays.
- **⏭ BYPASS** sends the clips as they are; the first piece you add turns it off. **🔇** removes the clip sound everywhere.
- The edit is built into a frame-accurate mp4 automatically and goes to the Pult as one clip "🎬 Edit". Old draft builds are cleaned up.
- The Pult with video only and no sound now outputs the clip with silence instead of an error. The ready desk now has Video ×3 → Video Sampler → Pult.
- Fixed: ⏭ always works (also while playing). Off — the Pult shows exactly one "🎬 Edit" block; while the edit is empty or building, the block says so (before, an empty edit passed the original clips).

## v2.0 · Neron Audio Studio: эквалайзер и эхо в Пульте, модуль «Музыка», готовый рабочий стол (вошло в v2.0 / part of v2.0)

**RU:**
- **Пульт:** у каждого канала (и у звука видео) — эквалайзер из трёх ручек **НИЗ / СЕР / ВЕРХ** (±12 дБ: 200 Гц, 1 кГц, 4 кГц) и **ЭХО** (одна ручка «сколько» + кнопка помещения **КОМН → ЗАЛ → СОБОР**). Ручки крутятся мышкой вверх-вниз или колёсиком, Shift — точнее, двойной клик — сброс; ↺ — сбросить все эффекты канала. Слышно сразу при прослушивании, и ровно так же сводится в файл после Queue / SAVE.
- **Neron Music / Музыка 🥁🎹** — барабаны и пианино в одной ноде: вкладки 🥁 / 🎹, общий темп, **▶ ВСЁ ВМЕСТЕ** играет обе части, на вкладке мигает точка, если часть играет. Выход **sounds** → Пульт: **два канала** (барабаны и пианино отдельно). Выход **audio** — всё одним звуком. Размер ноды меняется, как у всех.
- Пустые «Видео ×3», «Звук ×8» и сэмплер без звуков больше не роняют Queue.
- Готовый рабочий стол: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json` — группы ВИДЕО, МУЗЫКА, ЗВУК, СЭМПЛЕР и ПУЛЬТ, всё уже соединено.

**EN:**
- **Pult:** every channel (and the video sound) gets a 3-knob EQ **LOW / MID / HIGH** (±12 dB at 200 Hz, 1 kHz, 4 kHz) and **REVERB** (one amount knob + a **ROOM → HALL → CATHEDRAL** button). Drag knobs up/down or use the wheel, Shift for fine steps, double-click resets; ↺ resets the channel's effects. Heard live and rendered the same into the file after Queue / SAVE.
- **Neron Music / Музыка 🥁🎹** — drums and piano in one node: 🥁 / 🎹 tabs, one tempo, **▶ ALL** plays both, a blinking dot shows which part is playing. **sounds** → Pult gives **two channels**; **audio** is everything as one sound. Resizable like every node.
- Empty Video ×3, Sound ×8 and a sampler without sounds no longer break Queue.
- Ready desk: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json` — groups VIDEO, MUSIC, SOUND, SAMPLER and PULT, all wired.

## v2.0 · Neron Audio Studio: Сэмплер, вторая версия / Sampler v2 (вошло в v2.0 / part of v2.0)

**RU:**
- Сэмплер теперь из двух частей. **① ИСТОЧНИКИ** — каждый звук целиком, вся волна; мышкой выделяете кусок «откуда — докуда» (видны секунды), ▶ — послушать кусок. **➜** или просто перетащить выделенное вниз — кусок становится кирпичиком. **② ПОЛЕ** — сетка по тактам, 4 слоя; кирпичики складываются друг за другом, Пульт слышит только поле.
- Колёсико мыши — приблизить / отдалить (Shift + колёсико — прокрутка), ⤢ — показать всё.
- Клики попадают точно при любом зуме схемы (раньше курсор и блоки «промахивались»).
- Во время игры можно двигать кирпичики, ставить курсор, менять громкость — звук подхватывает сразу.
- Квадратики появления и затухания крупнее и работают всегда.
- Индикаторы уровня: у источника при прослушивании, у каждого слоя и общий L/R.
- Пустое поле не роняет Пульт: звучит один такт тишины.
- У каждого слоя поля своя кнопка ▶ / ■: играет только этот слой; можно сразу переключиться на другой слой его ▶; верхний ▶ — снова всё поле.
- Строка источника переделана: клик — курсор «играть отсюда» (▶ играет от него, во время игры клик перескакивает); повести вбок — всегда новое выделение (раньше при выделенном целиком треке всё «зависало»); края выделения тянутся; выделенное вниз — в поле; колёсико над волной — приблизить звук вокруг мышки (полоска внизу показывает, где вы), Shift — сдвинуть.

**EN:**
- The sampler now has two parts: **① SOURCES** — every sound in full, select a piece with the mouse, ▶ to listen, **➜** or drag it down; **② FIELD** — a bar grid with 4 layers where bricks are assembled; the Pult hears only the field.
- Mouse wheel zooms (Shift+wheel scrolls), ⤢ fits all. Clicks are exact at any canvas zoom. Everything can be edited while playing. Bigger, reliable fade handles. Level meters for sources, layers and master. An empty field gives one bar of silence instead of an error.
- Every field layer has its own ▶ / ■: plays only that layer; switch layers on the fly; the top ▶ plays the whole field again.
- Source row reworked: click sets a play-from cursor; dragging sideways always makes a new selection (a full selection no longer locks it); selection edges drag; dragging the selection down puts it in the field; the wheel zooms the source around the mouse, Shift scrolls.

## v2.0 · Neron Audio Studio: Сэмплер, первая версия / Sampler v1 (вошло в v2.0 / part of v2.0)

**RU:**
- **Neron Sampler / Сэмплер** — нода между «Звук ×8» и Пультом. Вид как у Piano Roll: слева дорожки, справа сетка по тактам, каждый звук — блок.
- **⏭ ПРОПУСТИТЬ** нажата — сэмплер не работает, все звуки идут в Пульт как есть, каждый своим каналом. Отжата — Пульт видит только результат сэмплера, одним каналом «🎛 СЭМПЛЕР».
- Новый звук сам ложится на свою дорожку в начало. Блоки двигаются (и на другую дорожку — звуки складываются), края обрезаются, квадратики в углах — появление и затухание, двойной клик по пустому — поставить звук, ⧉ копия сразу после (Ctrl+D), ✂ разрезать (S), отмена (Ctrl+Z).
- Сетка: такт, 1/2, 1/4, 1/8, 1/16 или без сетки. BPM синхронизирует Пульт. У дорожки M, S, громкость.
- Результат идёт целыми тактами, поэтому в Пульте луп повторяется ровно. Пульт слышит сэмплер сразу, без Queue.

**EN:**
- **Neron Sampler** — sits between Sound ×8 and the Pult. Looks like the Piano Roll: tracks on the left, a bar grid on the right, every sound is a block.
- **⏭ BYPASS** on — all sounds go to the Pult as they are; off — the Pult sees only the sampler result as one channel.
- A new sound places itself on its own track at the start. Move blocks (also between tracks), trim edges, fades, double click to place, copy (Ctrl+D), split (S), undo.
- Grid: bar, 1/2, 1/4, 1/8, 1/16 or free; BPM synced by the Pult; tracks have M, S, volume. The result is whole bars, so it loops evenly; the Pult hears it without Queue.

## 2026-10-25 — Neron Audio Studio: кубики и Пульт / cubes and the Pult

**RU:**
- **Neron Video ×3 / Видео ×3** — одна нода, в ней до трёх загрузчиков видео. Загрузили ролик — открылся следующий слот. Каждый ролик виден прямо в ноде. Файлы можно перетащить на слот.
- **Neron Sound ×8 / Звук ×8** — одна нода, до восьми загрузчиков звука. Пустые строки скрыты, у каждого звука ▶ и волна.
- **Пульт (Neron Mixer) понимает кубики:** «Видео ×3» — во вход `video`, «Звук ×8» — в любой `audio_N` (каждый звук становится своим каналом с громкостью, балансом, M/S и индикатором уровня).
- **Сводка вверху Пульта:** сколько роликов, сколько звуковых каналов, общая длина.
- **Ролики в Пульте:** все рядом; клик по ролику — он на весь экран и звук переходит к его началу; во время игры экран сам переключается на следующий ролик; «◀ ВСЕ РОЛИКИ» — снова рядом. В сохранённом клипе ролики идут друг за другом (1 → 2 → 3), склейка точна до кадра; звук роликов склеивается так же.
- Пульт стал выходной нодой: Queue работает и без нод после него.
- Кубики аккуратнее: панель не упирается в край ноды, высота считается по содержимому (и при смене ширины), в списках только имя файла (папка — во всплывающей подсказке).

**EN:**
- **Neron Video ×3** — one node with up to three video loaders; the next slot opens when a clip is loaded; each clip is visible in the node; files can be dropped onto a slot.
- **Neron Sound ×8** — one node with up to eight audio loaders; empty rows stay hidden; each sound has ▶ and a waveform.
- **The Pult (Neron Mixer) understands cubes:** Video ×3 → the `video` input, Sound ×8 → any `audio_N` (every sound becomes its own channel with volume, pan, M/S and a level meter).
- **Summary at the top of the Pult:** number of clips, sound channels, total length.
- **Clips in the Pult:** side by side; click one — it fills the screen and playback jumps to its start; during playback the screen follows the playing clip; "◀ ALL CLIPS" — side by side again. In the saved clip they play one after another (1 → 2 → 3), frame-accurate, with their sound joined the same way.
- The Pult is now an output node: Queue works without nodes after it.
- Tidier cubes: the panel no longer touches the node edge, the height follows the content (also when the width changes), lists show just the file name (folder in the tooltip).

## 2026-10-25 — Neron Audio Studio: размер нод и индикаторы уровня / node size and level meters

**RU:**
- **Размер задаёт пользователь** у Piano Roll, Drum Machine, Микшера, Audio Loader и Video Combine. Раньше высота была жёсткой (Piano Roll был огромным и не уменьшался). Теперь ноду можно растянуть или сжать: содержимое подстраивается, лишнее прокручивается, размер запоминается в схеме. Пока ноду не трогали, она, как раньше, подстраивается сама. Правый клик → «↕ Авто-размер» возвращает подгонку.
- **Индикаторы уровня в Микшере:** прыгающие столбики у каждого канала (левый и правый) и общий L/R рядом с MASTER. Зелёный — нормально, жёлтый — громко, красный — перегруз; пиковая метка держится секунду. Пока звук не играет, индикаторы ничего не нагружают.
- Исправлено: «Поле» и Audio Loader использовали одинаковые имена стилей и могли портить вид друг другу на одной схеме.

**EN:**
- **The user sets the size** of Piano Roll, Drum Machine, Mixer, Audio Loader and Video Combine. The height used to be fixed (Piano Roll was huge and could not shrink). Now the content adapts and scrolls, the size is saved in the workflow; an untouched node still fits itself. Right click → "↕ Auto size" restores fitting.
- **Level meters in the Mixer:** bouncing bars per channel (left and right) and a master L/R meter next to MASTER. Green — fine, yellow — loud, red — clipping; the peak mark holds for a second. No load while nothing plays.
- Fixed: the Field and the Audio Loader shared style names and could spoil each other's look on one canvas.

## 2026-10-25 — Neron Audio Studio: новая нода «Поле» / new node "Field"

**RU:**
- **Neron Field / Поле** — общее поле в духе Playlist из FL Studio. На холсте — маленькая карточка (картинка, обзор, ▶ / ■, «Открыть»), которую можно растягивать как угодно. Большое окно открывается поверх всего, двигается, тянется, разворачивается на весь экран и помнит своё место.
- **Видео:** до 3 роликов. Ролик сдвигается мышкой или по кадру (◀ / ▶, стрелки), два разделителя решают, где какой ролик идёт. Склейка или наплыв. Где у ролика нет кадров — красная штриховка (в итоге чёрный экран). Родной звук роликов режется по тем же разделителям и выключается кнопкой M.
- **Звук:** куски из файлов и из нод студии (входы `audio_N`). Двигать, переносить между дорожками, обрезать, резать (S), копия (Ctrl+D), появление и затухание, громкость куска; у дорожки M, S, громкость, баланс. Прилипание к краям и разделителям. Отмена и повтор.
- Файлы можно просто перетащить на окно. Слушать и смотреть — сразу, без Queue.
- **💾 СОБРАТЬ** сохраняет WAV и mp4 (H.264 CRF 17) без Queue; Queue отдаёт `audio`, `video`, `fps`, `seconds`. Итог точен до кадра и ровно по длине видео.
- Микшер слышит Поле сразу, без Queue.
- Пока окно Поля активно, клавиши не уходят в ComfyUI: Ctrl+Z не откатывает граф, Delete не удаляет ноду.
- **Оптимизация:** все ноды студии теперь используют один общий звуковой движок на страницу (раньше у каждой был свой). Окно Поля ничего не рисует, пока закрыто; во время игры двигается только курсор.

**EN:**
- **Neron Field** — a shared field in the spirit of the FL Studio Playlist. On the canvas: a small, freely resizable card (picture, overview, ▶ / ■, "Open"). The big window opens above everything; it can be moved, resized, made full screen and remembers its place.
- **Video:** up to 3 clips, shifted by mouse or frame by frame; two dividers decide which clip plays where; cut or dissolve. Missing frames are shown with red stripes (black in the result). The clips' own sound follows the same dividers and can be muted.
- **Sound:** pieces from files and from studio nodes (`audio_N` inputs): move, move between tracks, trim, split, copy, fades, piece volume; tracks have M, S, volume, pan. Snapping, undo / redo.
- Drop files onto the window. Watch and listen at once, no Queue.
- **💾 BUILD** saves WAV and mp4 without Queue; Queue outputs `audio`, `video`, `fps`, `seconds`. Frame-accurate, exactly as long as the video.
- The Mixer hears the Field without Queue.
- While the Field window is focused, keys stay in it: Ctrl+Z does not undo the graph, Delete does not delete the node.
- **Performance:** all studio nodes now share one audio engine per page. The Field window draws nothing while closed; during playback only the cursor moves.

## 2026-10-23 — Perception Relay: защита от нехватки памяти / out-of-memory guard

**RU:** Если выход «кадры» (`frames_out`) не влезает в оперативку (нужно больше половины свободной), Пульт его пропускает вместо вылета; готовый ролик сохраняется в файл, в отчёте — пояснение.

**EN:** If the `frames_out` output would not fit in RAM (more than half of the free memory), the Pult skips it instead of crashing; the final video is still saved to a file and the report explains why.

## 2026-10-23 — Perception Relay: место на диске / disk space

**RU:** Рабочие папки задач (~5 ГБ на 10 с видео) больше не копятся бесконечно. Хранятся только 2 последних ролика, старые удаляются сами после прогона; файлы этапов, которых нет в цепочке, тоже удаляются. Готовые видео и отчёты не трогаются. Настройка: `output/perception_relay/settings.json` → `keep_jobs`.

**EN:** Work folders (~5 GB per 10 s of video) no longer pile up. Only the 2 most recent clips keep them, older ones are deleted after a run, and stage files no longer in the chain are removed. Final videos and reports are untouched. Setting: `output/perception_relay/settings.json` → `keep_jobs`.

## 2026-10-23 — Perception Relay: растягивание Пульта / Pult resizing

**RU:** Пульт больше не «борется» с мышью. Раньше при растягивании нода сама возвращала свою высоту, и раскладка разваливалась (окно уезжало, внизу оставалось пустое поле). Теперь размер задаёте вы: окно заполняет всё свободное место, кадр вписывается с сохранением пропорций. Размер запоминается в схеме и не меняется при включении режима эксперта. Новая нода, пока её не трогали руками, по-прежнему подстраивается под кадр сама.

**EN:** The Pult no longer fights the mouse. It used to snap its height back while being resized, breaking the layout (the window shifted, an empty area stayed below). Now you own the size: the live window fills the free space and the frame keeps its aspect ratio. The size is saved in the workflow and is kept when expert mode is toggled. A new, untouched node still fits itself to the frame.

## 2026-10-23 — порядок в репозитории / repository cleanup

### 🇷🇺 Что изменилось

**Установка**
- Весь репозиторий теперь ставится **одной ссылкой**: ComfyUI Manager → Install via Git URL. Раньше ComfyUI после такой установки не видел ни одной ноды.
- Добавлен корневой загрузчик (`__init__.py`). Он находит все ноды, подключает их оформление и пропускает ноды, которые уже стоят отдельно. При ручной установке он не участвует.
- Добавлен общий `requirements.txt` (`imageio-ffmpeg`, `soundfile`): Manager поставит их сам.

**Переименования**
| Было | Стало | Почему |
|---|---|---|
| `NeronH3Engine Full/` | `ComfyUI-NeronH3Engine/` | пробел в имени папки мешает ссылкам и установке |
| `Neron_Studio_H3/ComfyUI-Interactive-Processor/` | `Neron_Studio_H3/NeronStudio-Image-Processor/` | совпадало с самостоятельной нодой в корне: одна папка затирала другую |
| `Neron_Studio_H3/neron_dialog_autoprompter/` | `Neron_Studio_H3/NeronStudio-AutoPrompter/` | то же самое |
| нода `InteractiveImageProcessor` (в студии) | нода `NeronStudioImageProcessor` | две разные ноды носили одно имя |
| `workflow/фотошоп.json` | `workflow/Neron_Restore_Studio_Photoshop.json` | русские буквы в имени файла ломаются в архивах |
| `NeronH3Engine Full.json` | `Neron_H3_Engine.json` | без пробелов |

**Исправления**
- Студийный AutoPrompter больше не регистрирует Dialog Autoprompter и Multi-Image LLM: их регистрирует самостоятельная нода из корня. Раньше обе копии занимали одни и те же адреса `/neron_dialog/*`, и одна из них работала не так, как ожидалось.
- У студийного Image Processor своё имя расширения интерфейса: раньше две копии с одним именем мешали друг другу.
- Старые сохранения студийного пайплайна открываются как раньше: нода сама переводится на новое имя.
- Dialog Autoprompter находит `ComfyUI-LLM-text-processor` и при установке через Manager.
- Из `requirements.txt` автопромтера убран `torch`: его нельзя ставить поверх ComfyUI Desktop.
- AudioStudio получил свой `requirements.txt` (`soundfile`, `imageio-ffmpeg`): раньше `soundfile` не был указан нигде.
- Добавлены README на двух языках для Lora Selector, Static Camera, Interactive Processor и студийного AutoPrompter, раздел установки в README H3 Engine и Neron Studio.

**Что не тронуто**
- Код самих нод (генерация, обработка, интерфейс) не менялся.
- Самостоятельные ноды в корне и их воркфлоу v1.0 / v2.0 работают как раньше.

### 🇬🇧 What changed

**Installation**
- The whole repository now installs with **one link**: ComfyUI Manager → Install via Git URL. Before, ComfyUI saw no nodes after such an install.
- Added a root loader (`__init__.py`). It finds all nodes, registers their UI and skips nodes already installed on their own. It is not involved in a manual install.
- Added a shared `requirements.txt` (`imageio-ffmpeg`, `soundfile`): Manager installs them automatically.

**Renames**
| Was | Now | Why |
|---|---|---|
| `NeronH3Engine Full/` | `ComfyUI-NeronH3Engine/` | the space in the folder name gets in the way of links and installs |
| `Neron_Studio_H3/ComfyUI-Interactive-Processor/` | `Neron_Studio_H3/NeronStudio-Image-Processor/` | same name as the standalone root node: one folder overwrote the other |
| `Neron_Studio_H3/neron_dialog_autoprompter/` | `Neron_Studio_H3/NeronStudio-AutoPrompter/` | same reason |
| node `InteractiveImageProcessor` (Studio) | node `NeronStudioImageProcessor` | two different nodes had one id |
| `workflow/фотошоп.json` | `workflow/Neron_Restore_Studio_Photoshop.json` | Cyrillic file names break in archives |
| `NeronH3Engine Full.json` | `Neron_H3_Engine.json` | no spaces |

**Fixes**
- The Studio AutoPrompter no longer registers Dialog Autoprompter and Multi-Image LLM: the standalone root node does. Before, both copies took the same `/neron_dialog/*` routes.
- The Studio Image Processor has its own UI extension name: before, two copies with one name got in each other's way.
- Old Studio pipeline saves open as before: the node switches to the new id by itself.
- Dialog Autoprompter finds `ComfyUI-LLM-text-processor` when installed via Manager too.
- Removed `torch` from the autoprompter `requirements.txt`: it must not be installed over ComfyUI Desktop.
- AudioStudio got its own `requirements.txt` (`soundfile`, `imageio-ffmpeg`): `soundfile` was not listed anywhere before.
- Added bilingual READMEs for Lora Selector, Static Camera, Interactive Processor and the Studio AutoPrompter, plus install sections in the H3 Engine and Neron Studio READMEs.

**Untouched**
- The nodes' own code (generation, processing, UI) did not change.
- The standalone root nodes and their v1.0 / v2.0 workflows work as before.
