# Perception Relay — ComfyUI video post-processing

*English summary below the Russian text / Русский текст — ниже английской сводки.*

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
  **Don't need a clip any more? Delete its work folder by hand** — `output/perception_relay/<clip>/`. It is safe:
  final videos sit next to it in `perception_relay`, not inside. If you tweak that clip again, the Pult simply
  recomputes the stages.

Expert chain (Start → … → Finish) is in the "chain, expert" submenu.

---

### 🧩 4 cards instead of 10, expert mode, clock (new)
Stabilize (Judge + Flow), Picture (Edge + Tone + Seam + Basic), Motion & face (Polish + Attention points + Scout)
and the Refiner. Each card shows a few main sliders; **⚙ expert** reveals every fine setting (hidden ones still
work). Old single-stage cards still work (menu → legacy cards). The Pult shows a **run clock** in its centre:
elapsed time, current stage with progress and an estimate, then the total.

### 🛠 Refiner (new, alpha)
The **Refiner** card runs last, on the already processed video: a scanner finds where fine detail is smeared
(hair, fabric, texture — see the 'map' live view) and only those areas are fixed with **SeedVR2** built into
ComfyUI (0.40+). The model **downloads by itself** (Comfy-Org on HuggingFace; `HF_ENDPOINT` for a mirror).
Generator detail is accepted only if it really adds detail, is not stronger than the form carrying it, and holds
over time. Optional upscale: ×2, to 1080p, to 1440p. Now built into the Pult as an on/off switch (🛠 Refiner).

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
- **Ролик больше не нужен? Удалите его рабочую папку вручную** — `output/perception_relay/<имя ролика>/`.
  Это безопасно: готовые видео лежат рядом, в самой `perception_relay`, а не внутри папки. Если потом
  понадобится снова подстроить этот ролик, Пульт просто посчитает этапы заново.

## Если что-то не так

- Глаза как с подводкой → убавь `eye_sharp` в Финише.
- Контур как наклейка → убавь `contour_sharp`.
- Картинка восковая → убавь `strength_mid` в Судье или уменьши `detail_size`.
- Всё ещё кипит → прибавь `strength_mid`, `radius` = 2, в Потоке масштаб 0.75–1.0.
- Смотри **Журнал**: каждый этап пишет, что делал, где сомневался и сколько изменил.
