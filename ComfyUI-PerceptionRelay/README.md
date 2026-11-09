# Perception Relay — ComfyUI video post-processing

*English first, Russian below / Сначала английский, ниже — русский.*

## English

**Idea.** AI video looks "fake" not because of low resolution but because the brain cannot complete it:
reference points (eyes, face edge, object edges) crawl, shadows are flat, colour leaks across borders.
Perception Relay does not invent detail. It removes what disturbs the viewer's brain and lets the brain
do the rest: it stabilises drifting texture, keeps edges steady, gives shadows real depth and keeps colour
inside its borders. No heavy models (optional RAFT optical flow, ~20 MB; a 230 KB face detector).

**Main way: 🎛 Pult (live preview).** Drag `workflows/perception_relay_pult.json` into ComfyUI.
Stage cards plug into the Pult with **one wire each, in any order**:
👁 Scout · 🌊 Flow · ⚖ Judge (drift) · 💎 Edge cut · 🌑 Tone skeleton · 🎨 Colour seam · ✨ Polish · 🎯 Attention points.

- **Live window:** move any slider on any card — the Pult shows that frame within a fraction of a second.
  `live_frame` picks the moment, `live_view` = after / before / split. First time per video, motion and faces
  are prepared once (a minute or two for 20 s of video); the full render then reuses that work.
  The ×2 smoothness cannot be shown on a single frame — you see it in the final video.
- **Live window tools:** hover = magnifier at the frame's real resolution (mouse wheel = zoom),
  **▶ play 1 s** = one second of the video in a loop (to see shimmer and motion, not a still),
  **↺ reset** on every card restores its defaults.
- **🎚 Basic card:** simple brightness, contrast, sharpness and saturation of the whole picture.
- **⏳ Live window preparation takes time — this is normal.** For every new clip, motion (Flow) and faces
  (Scout) are computed once over the whole video. **The longer the clip and the higher the resolution, the
  longer it takes:** a short 720p clip — seconds, 20 s of 1080p — a couple of minutes, longer clips —
  proportionally longer. The very first run also downloads models (~20 MB). Flow scale 1.0 and the DIS
  engine on CPU are slower. While preparing, the window is empty and the status line shows
  "подготовка… кадр N из M" (preparing… frame N of M) — **nothing is broken, just wait.** After that,
  frames come in a fraction of a second.
- **⚠ Changed the video — reload the canvas.** After picking another clip in Load Video, reload the ComfyUI
  page (F5) or the workflow, then press "🔄 refresh live" on the Pult. Otherwise the live window may keep
  showing the previous clip.
- **Outputs:** frames + audio + fps (→ Create Video / Video Combine), last frame (for stitching scenes),
  comparison video (plays inside the Pult), and a **run report** in `output/perception_relay/для_отправки/`
  (readable .txt + .json: settings, source passport, every stage's report, timings, warnings). Paths,
  file names and the clip name are stripped — safe to share. Send it to help build presets.
- **Memory:** only the stages you change are recomputed.
- **Disk space:** every clip gets a work folder in `output/perception_relay/<clip>/` with each stage saved
  losslessly (about 5 GB per 10 s of video) — that is what makes slider tweaks fast. Only the **2 most recent
  clips** keep their work folders; older ones are deleted automatically after a run, and stage files no longer
  in the chain are removed. Final videos (`…_pult_001.mp4`) and the report folder are never deleted.
  Change the number in `output/perception_relay/settings.json` → `"keep_jobs"` (0 = never delete).
  **Long clips and RAM:** the `frames_out` output loads the whole finished clip into RAM (1 min at 48 fps ≈ 36 GB).
  If there is not enough memory, the Pult skips that output (the video is still saved to a file) and says so in
  the report. For long clips turn `frames_out` off in expert mode.
  **Don't need a clip any more? Delete its work folder by hand** — `output/perception_relay/<clip>/`. It is safe:
  final videos sit next to it in `perception_relay`, not inside. If you tweak that clip again, the Pult simply
  recomputes the stages.

Expert chain (Start → … → Finish) is in the "chain, expert" submenu.

---

### What it does to the picture
- **reference points** — eyes and the face contour are pulled up to "lens focus";
- **drift** — crawling pseudo-details are damped, while the frame's skeleton and honest motion are left alone;
- **carrier** — grain. Tested in practice: on AI video it adds flicker over the whole frame and eats the Judge's
  work, so it is **off** by default (`grain` = 0). Kept only for stylisation.

### Installation
1. Copy the `ComfyUI-PerceptionRelay` folder into `ComfyUI/custom_nodes/`.
2. You need `opencv-python` (or `-headless`, or `-contrib`, version 4.8 or newer) and `imageio-ffmpeg`.
   They are almost always installed already (VideoHelperSuite and many other packs install them).
   If not: `pip install imageio-ffmpeg opencv-python-headless`.
   **Do not install a second opencv variant** if one is already there: they conflict.
3. Restart Comfy.

Models download by themselves on the first run into `ComfyUI/models/perception_relay/`:
- YuNet face detector — 230 KB;
- RAFT large — about 20 MB (RAFT small — about 4 MB).

No internet — pick the **DIS** engine in "Flow", it downloads nothing.

Ready workflow: drag `workflows/perception_relay_basic.json` into the Comfy window and pick a video in the standard
**Load Video** node — it is wired to the `video` input of "Start". You can also do without it: type the full path into
the `video_path` field.

### 🧩 4 cards instead of 10 (new)

| Card | What is inside | Always visible |
|---|---|---|
| ⚖ **Stabilize** | Judge + Flow | stabilisation strength, strength on faces |
| 🖼 **Picture** | Edge cut + Tone skeleton + Colour seam + Basic | edge sharpness, black depth, brightness, contrast, saturation |
| 🎬 **Motion & face** | Polish + Attention points + Scout | smoothness, remove flicker, eye sharpness |
| 🛠 **Refiner** | built into the Pult: the «🛠 Refiner» switch | size, strength (visible when it is on) |

- The **⚙ expert** switch on every card opens the fine settings of all its stages
  (labelled «Edge cut · …», «Seam · …»). Hidden settings still work.
- In expert mode you can turn off a single stage inside a card (▣ … on).
- The quick variant — only Stabilize and Picture.
- The old single-stage cards work as before (menu → «legacy cards»).

**The Pult is simpler too:** a beginner sees the Refiner switch, the comparison and the live window; codec, crf,
job name, scoring and the Refiner's fine settings are under **⚙ expert**. A separate Refiner card stays in
«legacy cards» (if both are on, the Pult's settings are used).

**⏱ The Pult clock.** In the centre of the Pult — the run time: it ticks during generation, shows the current stage
with progress and an approximate «remaining», and afterwards the total time (green — done, red — error).

### 🛠 Refiner — a workflow after the workflow (new, alpha)

The **Refiner** card runs last, on the already polished video: it finds by itself the places where fine detail is
smeared (hair, fabric, texture) and fixes **only those**. Optionally it enlarges the video.

- The **scanner** builds a "where to fix" map without any model. You can see it in the live window: `live_view` →
  **map**. Flat areas (a wall), smooth shadows, object contours, lips and faces do not get into the map.
- The **generator** is SeedVR2, built into ComfyUI (0.40+ needed). **The model downloads by itself** on the first run
  from the official Comfy-Org on HuggingFace. No access — set an `HF_ENDPOINT` mirror or download it by hand (the
  link and the folder will be in the message).
- The generator's detail is taken only if: it really added fine detail; it is not stronger than the form carrying it;
  it **holds over time** (the Refiner computes motion itself). Accepted detail rides along with the motion — it does
  not boil.
- **Size:** ×1 (fix only), ×2, up to 1080p, up to 1440p. Finish, the comparison and the Pult's outputs pick up the
  new size by themselves.
- Grain and attention points — after the Refiner, in Finish.
- Not needed — Ctrl+B on the card: everything else is taken from the Pult's memory.

### The chain (how it works inside)

```
🎬 1. Start → 👁 2. Scout → 🌊 3. Flow → ⚖ 4. Judge → 💎 4½. Edge cut → 🌑 Tone skeleton → 🎨 Colour seam → ✨ 4¾. Polish → 🏁 5. Finish
                 📓 Log, 🖼 Preview and 🎞 Comparison (video) — to any point of the chain
```

- **Start** — the video from Load Video (or a file path). The sound is set aside, a lossless working copy is made.
- **Scout** — faces and eyes, tracking, smoothing the trajectories in both directions.
- **Flow** — motion between frames and confidence (a "there and back" check).
- **Judge** — "physics or drift". The main slider is `strength_mid`.
- **Edge cut** — skeleton sharpening based on AMD RCAS, reworked: edges only, no halos, and it sharpens only what
  holds over time (edges that "breathe" are not blown up). It measures detail jitter before/after by itself and
  writes it to the log. Optional — can be turned off (Bypass).
- **Tone skeleton** — shadows and black as the frame of the picture. The frame is split into a light layer and a
  surface layer (guided filter; shadow edges and highlights are not blurred); all changes go to the light only, the
  object's details are not touched. Black point, black density, zones "deep shadows / shadows / transition" with ±
  for each, fill light on faces. The light layer is checked against the previous frame by the flow — shadows do not
  breathe, changes ride with the object. Colour follows brightness proportionally (no oversaturation); the "cast" is
  only a hue shift relative to the scene light, the honest warmth of a warm scene is not removed.
- **Colour seam** — clean borders between colours without a "razor". Halftone compression on strong edges (the
  transition gets narrower, no new values — so no fringes; computed in linear light), colour follows brightness (no
  brown rim on the dark side) and sticks to the brightness edges (cures colour bleeding from the 4:2:0 format). It
  compresses only edges that stay steady over time.
- **Polish** — light and smoothness (the strong sides of Neron Video Clarity, reworked): overall brightness
  deflicker, exposure, saturation, **shadow contrast** (volume in dark places, fine texture untouched) and shadow
  depth. Smoothness without chasing frames: one in-between "half frame" (×2, 24→48) or motion blur at the same frames.
  The half frame is built from our flow: where frames disagree — no translucent ghosts, where the flow is unsure —
  the real frame is taken.
- **Finish** — attention points, the final mp4 with sound (grain — optional, off by default).
- **Comparison (video)** — source and result in one clip: side by side, with a curtain, one above the other or a
  close-up of the face. Compare videos, not stills: the Judge works over time. It can be plugged in after any stage,
  for example after the Judge, to watch its work without grain.

Everything lives in `ComfyUI/output/perception_relay/<job name>/`, the result — in `ComfyUI/output/perception_relay/`.
Between stages — only lossless compression (FFV1, 16 bit). The video is never loaded into memory whole.

Any stage can be turned off (Bypass) — the relay understands it: the next stages read the reports only of those that
really ran.

### If something is wrong
- Eyes look like they have eyeliner → lower `eye_sharp` in Finish.
- The contour looks like a sticker → lower `contour_sharp`.
- The picture looks waxy → lower `strength_mid` in the Judge or reduce `detail_size`.
- Still boiling → raise `strength_mid`, `radius` = 2, Flow scale 0.75–1.0.
- Read the **Log**: every stage writes what it did, where it hesitated and how much it changed.

---

# Эстафета восприятия (ComfyUI)

Постобработка ИИ-видео. Видео не «улучшается», а перестаёт мешать мозгу зрителя:
- **реперы** — глаза и контур лица подтягиваются до «фокуса объектива»;
- **дрейф** — ползущие псевдодетали гасятся, а скелет кадра и честное движение не трогаются;
- **носитель** — зерно. Проверено на деле: на ИИ-видео оно добавляет мерцание по всему кадру и
  съедает работу Судьи, поэтому по умолчанию **выключено** (`grain` = 0). Оставлено только для стилизации.

## Установка

1. Скопируй папку `ComfyUI-PerceptionRelay` в `ComfyUI/custom_nodes/`.
2. Нужны `opencv-python` (или `-headless`, или `-contrib`, версия 4.8 и выше) и `imageio-ffmpeg`.
   Почти всегда они уже стоят (их ставят VideoHelperSuite и многие другие пакеты).
   Если нет: `pip install imageio-ffmpeg opencv-python-headless`.
   **Не ставь второй вариант opencv**, если один уже есть: они конфликтуют.
3. Перезапусти Comfy.

Модели качаются сами при первом запуске в `ComfyUI/models/perception_relay/`:
- детектор лиц YuNet — 230 КБ;
- RAFT large — около 20 МБ (RAFT small — около 4 МБ).

Если интернета нет — выбери в «Потоке» движок **DIS**, он не качает ничего.

Готовая схема: перетащи `workflows/perception_relay_basic.json` в окно Comfy и выбери видео в стандартной ноде
**Load Video (Загрузить видео)** — она подключена ко входу `video` у «Старта». Можно и без неё:
вписать полный путь в поле `video_path`.

## 🎛 Пульт — основной способ (рекомендуется)

Перетащи `workflows/perception_relay_pult.json` в окно Comfy.

```
[карточки этапов] ──по одному проводу──► [🎛 Пульт (предпросмотр)] ──► кадры + звук + fps → Create Video → Save Video
  👁 Разведка   🌊 Поток   ⚖ Судья            ▲                      ──► сравнение (видео прямо в пульте)
  💎 Огранка   🌑 Скелет  🎨 Шов          [Load Video]               ──► файл для нас (настройки + паспорт)
  ✨ Полировка 🎯 Точки внимания                                     ──► последний кадр (для склейки сцен)
```

- **Живое окно:** крутишь любой ползунок любой карточки — Пульт за долю секунды показывает кадр.
  `live_frame` — какой момент ролика, `live_view` — после / до / шторка. Для нового ролика сначала один раз
  считаются движение и лица (минута-две на 20 секунд видео), потом всё живое, а полный прогон по кнопке
  берёт эту подготовку готовой. Плавность ×2 в окне не показать — это свойство движения, она видна в итоге.
- **Инструменты окна:** наведи мышку — лупа в настоящем разрешении кадра (колесо — сила увеличения);
  **▶ проиграть 1 с** — секунда ролика по кругу, чтобы видеть дрожь и движение, а не стоп-кадр;
  **↺ сброс** на каждой карточке возвращает её значения по умолчанию.
- **🎚 Основное:** простые яркость, контраст, резкость и насыщенность всей картинки.
- **⏳ Подготовка живого окна занимает время — это нормально.** Для каждого нового ролика сначала один раз
  считаются движение (Поток) и лица (Разведка) по всему видео. **Чем длиннее ролик и выше разрешение, тем
  дольше:** короткий ролик 720p — секунды, 20 секунд 1080p — пара минут, длинные ролики — пропорционально
  дольше. Самый первый запуск ещё и скачивает модели (~20 МБ). Масштаб Потока 1.0 и движок DIS на
  процессоре работают медленнее. Пока идёт подготовка, окно пустое, а в строке статуса бежит
  «подготовка… кадр N из M» — **ничего не сломалось, просто подожди.** Потом кадры идут за доли секунды.
- **⚠ Сменил видео — перезагрузи стол.** После выбора другого ролика в «Загрузить видео» обнови страницу
  Comfy (F5) или перезагрузи схему, затем нажми «🔄 обновить окно» в Пульте. Иначе живое окно может
  продолжать показывать прежний ролик.
- **Карточки ничего не считают** — только отдают свои ползунки. Втыкай в любой вход пульта, в любом
  порядке: пульт сам выстроит эстафету. Не подключил карточку — этап пропущен.
- **Помощники добавляются сами:** Судье нужен Поток, точкам внимания — Разведка. Пульт пишет об этом.
- **Память:** подвинул ползунок в Полировке — пересчитается только Полировка, остальное из памяти.
- **Отчёт для нас** — после каждого прогона в папке `output/perception_relay/для_отправки/` появляются
  `relay_отчёт_ДАТА_ВРЕМЯ.txt` (читаемый: оценка, паспорт источника, ползунки всех карточек, отчёт каждого
  этапа, время, предупреждения) и `.json` (то же для автоматической сводки). **Пути, имена файлов и
  имя ролика вырезаются, видео нет** — отчёт можно смело пересылать. Из таких отчётов соберём пресеты.

Старая цепочка нод (Старт → … → Финиш) осталась для экспертов в подпапке «цепочка (эксперт)».

## 🧩 4 карточки вместо 10 (новое)

| Карточка | Что внутри | Видно всегда |
|---|---|---|
| ⚖ **Стабилизация** | Судья + Поток | сила стабилизации, сила на лицах |
| 🖼 **Картинка** | Огранка + Тональный скелет + Цветовой шов + Основное | резкость краёв, глубина чёрного, яркость, контраст, насыщенность |
| 🎬 **Движение и лицо** | Полировка + Точки внимания + Разведка | плавность, убрать мерцание, резкость глаз |
| 🛠 **Доводчик** | встроен в Пульт: выключатель «🛠 Доводчик» | размер, сила (видны, когда включён) |

- Переключатель **⚙ эксперт** в каждой карточке открывает тонкие настройки всех её этапов
  (подписаны: «Огранка · …», «Шов · …»). Скрытые настройки всё равно работают.
- В режиме эксперта можно выключить отдельный этап внутри карточки (▣ … вкл / on).
- Быстрый вариант — только Стабилизация и Картинка.
- Старые карточки по одному этапу работают как раньше (меню → «старые карточки»).

**Пульт тоже упрощён:** новичок видит выключатель Доводчика, сравнение и живое окно; кодек, crf, имя
задачи, оценка и тонкие настройки Доводчика — под **⚙ эксперт**. Отдельная карточка Доводчика осталась
в «старых карточках» (если включены обе — берутся настройки Пульта).

**⏱ Часы Пульта.** В центре Пульта — время прогона: тикает во время генерации, показывает текущий
этап с прогрессом и примерное «осталось», после — итоговое время (зелёное — готово, красное — ошибка).

## 🛠 Доводчик — процесс после процесса (новое, альфа)

Карточка **Доводчик** работает последней, по уже вылизанному видео: сама находит места, где мелкая
деталь расплылась (волосы, ткань, фактура), и лечит **только их**. По желанию увеличивает видео.

- **Сканер** строит карту «где лечить» без всякой модели. Её видно в живом окне: `live_view` → **карта**.
  Плоское (стена), плавные тени, контуры предметов, губы и лица в карту не попадают.
- **Генератор** — SeedVR2, встроенный в ComfyUI (нужна 0.40+). **Модель скачивается сама** при первом
  запуске с официального Comfy-Org на HuggingFace. Нет доступа — задай зеркало `HF_ENDPOINT`
  или скачай руками (ссылка и папка будут в сообщении).
- Деталь генератора берётся, только если: он правда добавил мелочь; она не сильнее формы, которая её несёт;
  она **держится во времени** (Доводчик сам считает движение). Принятая деталь едет по движению — не кипит.
- **Размер:** ×1 (только лечим), ×2, до 1080p, до 1440p. Финиш, сравнение и выходы Пульта сами
  подхватывают новый размер.
- Зерно и точки внимания — после Доводчика, в Финише.
- Не нужен — Ctrl+B по карточке: всё остальное возьмётся из памяти Пульта.

## Цепочка (как устроено внутри)

```
🎬 1. Старт → 👁 2. Разведка → 🌊 3. Поток → ⚖ 4. Судья → 💎 4½. Огранка → 🌑 Тональный скелет → 🎨 Цветовой шов → ✨ 4¾. Полировка → 🏁 5. Финиш
                 📓 Журнал, 🖼 Превью и 🎞 Сравнение (видео) — к любой точке цепочки
```

- **Старт** — видео из Load Video (или путь к файлу). Звук откладывается, делается рабочая копия без потерь.
- **Разведка** — лица и глаза, трекинг, сглаживание траекторий в обе стороны.
- **Поток** — движение между кадрами и уверенность (проверка «туда-обратно»).
- **Судья** — «физика или дрейф». Главный ползунок — `strength_mid`.
- **Огранка** — резкость скелета по мотивам AMD RCAS, переработанная: только края, без ореолов,
  и точит только то, что держится во времени (края, которые «дышат», не раздувает). Сама меряет
  дрожь деталей до/после и пишет в журнал. Необязательна — можно отключить (Bypass).
- **Тональный скелет** — тени и чёрное как каркас картинки. Кадр делится на слой света и слой
  поверхности (guided filter, края теней и блики не размываются); все правки — только по свету,
  детали объекта не трогаются. Чёрная точка, плотность чёрного, зоны «глухие тени / тени /
  переход» с ± у каждой, заполняющий свет на лицах. Слой света сверяется с прошлым кадром по
  потоку — тени не дышат, правки едут вместе с объектом. Цвет идёт пропорционально яркости
  (без перенасыщения); «налёт» — только сдвиг оттенка относительно света сцены, законное тепло
  тёплой сцены не снимается.
- **Цветовой шов** — чистые границы между цветами без «бритвы». Сжатие полутона на сильных
  краях (переход уже, новых значений нет — значит, нет кайм; считается в линейном свете), цвет
  идёт за яркостью (без бурого ободка на тёмной стороне) и прилипает к краям яркости (лечит
  затекание цвета из формата 4:2:0). Сжимает только края, которые стоят во времени.
- **Полировка** — свет и плавность (сильные стороны Neron Video Clarity, переработанные):
  дефликер общей яркости, экспозиция, насыщенность, **контраст теней** (объём в тёмных местах,
  мелкую фактуру не трогает) и глубина теней. Плавность без погони за кадрами: одна
  промежуточная «полкадра» (×2, 24→48) или смаз по движению при тех же кадрах. Полукадр строится
  по нашему потоку: где кадры спорят — без полупрозрачных призраков, где поток не уверен —
  берётся настоящий кадр.
- **Финиш** — точки внимания, итоговый mp4 со звуком (зерно — по желанию, по умолчанию выкл.).
- **Сравнение (видео)** — исходник и результат в одном ролике: рядом, шторкой, друг над другом
  или крупно по лицу. Сравнивать надо видео, а не стоп-кадры: судья работает во времени.
  Можно подключить после любого этапа, например после Судьи, чтобы смотреть его работу без зерна.

Всё лежит в `ComfyUI/output/perception_relay/<имя задачи>/`, итог — в `ComfyUI/output/perception_relay/`.
Между этапами только сжатие без потерь (FFV1, 16 бит). Видео в память целиком не грузится.

Любой этап можно отключить (Bypass) — эстафета это понимает: следующие этапы читают отчёты
только тех, кто реально отработал.

## 💾 Место на диске

Для каждого ролика Эстафета создаёт рабочую папку `output/perception_relay/<имя ролика>/` и сохраняет
в ней результат каждого этапа без потерь (примерно **5 ГБ на 10 секунд** видео). Благодаря этому при
смене одного ползунка пересчитываются только этапы после него.

- Рабочие папки хранятся только для **2 последних роликов**. Более старые удаляются сами после прогона.
- Файлы этапов, которых больше нет в цепочке (например, карточку отключили), тоже удаляются.
- **Готовые видео** (`…_pult_001.mp4`, `…_compare_001.mp4`) и папка с отчётами **«для_отправки»**
  не удаляются никогда.
- Сколько роликов хранить — в файле `output/perception_relay/settings.json`, параметр `"keep_jobs"`
  (0 — не удалять ничего).
- **Длинные ролики и оперативка.** Выход «кадры» (`frames_out`) загружает весь готовый ролик в ОЗУ: минута
  при 48 к/с — около 36 ГБ. Если памяти не хватает, Пульт сам пропустит этот выход (ролик всё равно сохранится
  в файл) и напишет об этом в отчёте. Для длинных роликов лучше выключить `frames_out` в режиме эксперта.
- **Ролик больше не нужен? Удалите его рабочую папку вручную** — `output/perception_relay/<имя ролика>/`.
  Это безопасно: готовые видео лежат рядом, в самой `perception_relay`, а не внутри папки. Если потом
  понадобится снова подстроить этот ролик, Пульт просто посчитает этапы заново.

## Если что-то не так

- Глаза как с подводкой → убавь `eye_sharp` в Финише.
- Контур как наклейка → убавь `contour_sharp`.
- Картинка восковая → убавь `strength_mid` в Судье или уменьши `detail_size`.
- Всё ещё кипит → прибавь `strength_mid`, `radius` = 2, в Потоке масштаб 0.75–1.0.
- Смотри **Журнал**: каждый этап пишет, что делал, где сомневался и сколько изменил.
