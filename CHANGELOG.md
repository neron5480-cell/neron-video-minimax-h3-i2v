# Changelog / История изменений

## 🎭 Замена героя 0.13 — три варианта: весь облик / лицо и причёска / только лицо (dev, 12.11.2026)

**0.13.1 RU:** проверки Романа: размытие 1.0 даёт сильное лицо во всех режимах; «низ срезан» — маска SAM «face» обрывается над подбородком (в «лицо и причёска» подбородок вообще считался волосами и стирался). Маска лица продлевается вниз на ~18 % её высоты. **EN:** the face mask is extended down ~18 % to include the chin.

**RU:** Роман: «у нас разные причёски — модель их смешивает, вот и артефакты». В режиме лица размывалась голова с длинными волосами оригинала: черты прятались, а очертание причёски оставалось и спорило с косой на фото. Теперь в «что менять» три пункта: 🧍 весь облик; 🙂 лицо и причёска — вся голова с фото, а волосы оригинала в образце СТИРАЮТСЯ в фон (не размываются), лицо размыто; 👤 только лицо (новое) — маска по лицу на каждом кадре, причёска, тело и одежда — из клипа, свой текст для модели. Плюс 0.12.1: дырки в маске (открытый рот) заливаются. **EN:** three choices — whole look / face & hair (the original's hair is erased, not blurred, so it no longer mixes with the photo's hairstyle) / face only (new: only the face changes, the clip's hair stays).

## 🎭 Замена героя 0.12 — фон фото не попадает в кадр (dev, 12.11.2026)

**0.12.1 RU:** проверка Романа: вырезание фото сработало (стена — из клипа). В «лицо и причёска» на крупном плане — тёмная клякса на губах: SAM не включил открытый рот с языком в «голову», дырка не размывалась, модель рисовала тёмный рот оригинала. Теперь дырки внутри маски (рот, глаза) заливаются; большие просветы (рука — тело) не трогаются. **EN:** holes inside the mask (an open mouth) are filled, so the original's mouth is blurred too.

**RU:** Роман сравнил: 🖼 «весь кадр» — «идеально, огрехи надо прям искать»; с «лицо и причёска» — одежда и движения из клипа, ореолов нет, но фон стал деревянным, как на фото (модель подсмотрела фон на <Picture 1>). Теперь на фото SAM вырезает человека, а фон фото заменяется ровным серым — фона на фото нет, брать неоткуда. В текст для модели добавлено: «фон, стены, предметы и свет — только из <Video 1>; <Picture 1> — человек на сером фоне, только облик». **EN:** the photo's background no longer leaks: SAM cuts the person out of the photo onto plain gray, and the prompt says the background comes only from <Video 1>.

## 🎭 Замена героя 0.11 — режим «весь кадр» (dev, 12.11.2026)

**RU:** Роман: у 0.10 замена держится весь клип, но в начале фон стал деревянным (с фото), а на спокойной части — белёсая вуаль у головы. Вывод из разговора: H3 и так умеет «видео-образец + фото → человек в этом движении»; маска, вклейка и чистый фон нужны ради точных пикселей вокруг — и все огрехи краёв родились из этого стыка. Новый переключатель в ⚙ «рисовать»: 🎯 только человека — точно (как было) / 🖼 весь кадр — чисто (идея Романа): тот же размытый образец, фото, LoRA и текст, но в латенте ничего не закреплено и ничего не вклеивается — модель рисует кадр целиком. Стыка нет → нет ореола, вуали, призраков; фон — пересказ клипа, не пиксель в пиксель. Для сравнения на одном клипе. **EN:** new «draw» switch: person only (exact clip pixels around) / whole frame (the model paints the full frame — no seams; the background is re-painted).

## 🎭 Замена героя 0.10 — разведка: размытие под крупность плана (dev, 12.11.2026)

**RU:** Разбор с Романом: на спокойных клипах (лицо относительно далеко) всё работает чётко; ломаются клипы с резкой сменой плана (сверхкрупный → средний). Одна сила размытия на весь клип не годится: на сверхкрупном черты огромные, то же окно для них слабое — модель узнаёт оригинал. Идея Романа — сначала «разведка», потом маска по кадрам (вариант А): нода ищет лицо на каждом кадре (SAM «face»), меряет его размер и на крупном плане размывает сильнее (до ×2,5; на «обычном» среднем плане — ровно как раньше, ×1). В логе: «Разведка: лицо по кадрам … крупный план на N кадрах». **EN:** scouting: the face size is measured on every frame and the blur scales with it (up to ×2.5 on close-ups; ×1 — exactly as before on a normal medium shot).

## 🎭 Замена героя 0.9 — маска не теряет голову (dev, 12.11.2026)

**0.9.6 RU:** у Романа чистый фон собрался (92 %), со 2-й секунды кадры чистые. Осталась белёсая обводка в первые 1–1,5 с: клип начинается с наезда камеры, и собранный фон там не совпадает со стеной. Теперь фон проверяется по КАЖДОМУ кадру (стена сразу за краем зоны против собранного фона); где камера ещё едет — фон на этом кадре не используется, переход по времени плавный. **EN:** the clean plate is now checked per frame; frames where the camera still zooms skip it, with a smooth transition.

**0.9.5 RU:** у Романа чистый фон не собрался («человек закрывает больше половины кадра»): закрытым я считал всю зону с запасом +5 % — на крупном плане это почти весь кадр. Теперь закрыт только сам человек с волосами (+2 %), а проверка — хватает ли открытых точек ВОКРУГ человека (≥ 60 %). **EN:** the clean plate was skipped: the whole zone counted as covered. Now only the person (+2 %) is covered, and coverage is checked around the person only.

**0.9.4 RU:** ореол на самом деле — «призрак» оригинала: белёсые пятна с серыми разводами вокруг нового человека — тонкие разлетающиеся волосы брюнетки, которых SAM не видит (и в образце для модели, и при вклейке). Новое: **чистый фон из самого клипа** — для каждой точки берётся кадр, где её не закрывает человек (медиана). В образце вокруг размытого человека — чистая стена; при вклейке вокруг нового человека — чистая стена, дальше — пиксели клипа. Камера движется (фон «плывёт») — нода это замечает и работает как раньше (пишет в лог). 480p — 0,4 с, 768p — 1,4 с. **EN:** the halo was a ghost of the original's flying hair. New: a clean background plate built from the clip itself (per-pixel median over frames where the person does not cover it), used around the person both in the reference and when pasting. A moving camera is detected and skipped.

**0.9.3 RU:** Роман: «это ОРЕОЛ» — вокруг человека полоса мыльной стены. Лог показал «вклеиваю 73% кадра вместо 73%»: вклеивалась вся зона, а в образце была размыта вся зона вместе с фоном вокруг — модель честно повторяла размытую стену. Теперь в образце размыт ТОЛЬКО сам человек (точная маска + пара пикселей), фон в полосе запаса — резкий; правки 0.9.2 (шире место старого, чувствительные волосы) откатаны — они раздували вклейку. **EN:** the halo was the blurred background ring: the whole mask zone was blurred in the reference. Now only the person is blurred; 0.9.2 widening reverted.

**0.9.2 RU:** проверка Романа: на стене вокруг головы — тёмные волосинки. Это тонкие разлетающиеся пряди оригинала: SAM их не брал, они оставались вне маски и вклеивались как пиксели клипа. Теперь волосы ищутся чувствительнее (порог ×0.6), а место старого человека при вклейке берётся на ≈2 % кадра шире. Сила размытия — от 0.4 (на крупном плане не ниже 0.5 — иначе лицо теряется, Роман). В справке: для всего облика запас мало не ставить. **EN:** thin flying strands of the original's hair stayed on the wall: hair is now detected more sensitively and the old person's place is pasted ~2 % wider. Blur strength from 0.4 (0.5+ on close-ups).

**0.9.1 RU:** проверка Романа: поиск по кадрам убрал лишние волосы оригинала. Остался светлый ореол вокруг головы и плеч — полоса перехода (≈20 пикс. на 480p, сгенерированный фон в ней светлее стены). Полоса сужена до ≈11 пикс.; на самом человеке вклейка по-прежнему 100 %. Режим «лицо» на очень крупном плане (лицо на весь кадр) модель игнорирует — особенность, при лице не целиком в кадре работает. **EN:** a light halo around head and shoulders — the transition band narrowed from ~20 to ~11 px at 480p; the person stays fully opaque. Face mode is ignored on extreme close-ups (a quirk).

**RU:** Роман погонял разные видео: в «лицо и причёска» замена держалась 1–2 с, потом возвращался оригинал; в «весь облик» по краям — пряди волос оригинала. Причина: трекер SAM ведёт объект только от первого кадра и, потеряв (клип начинается с крупного плана, потом камера отъезжает; волосы в танце), сам его не находит; голова уходила из маски, а вне маски вклеивается оригинал. Теперь: (1) кадры, где трекер потерял человека, — SAM ищет людей заново и берёт ближайшего к прошлому месту; (2) в режиме лица голова и волосы ищутся на КАЖДОМ кадре рядом с человеком; (3) в режиме всего облика волосы тоже ищутся на каждом кадре; (4) точные края по готовому видео — тоже поиском на каждом кадре. Цена — немного дольше подготовка маски.

**EN:** Face mode held for 1–2 s then reverted; whole look left strands of the original hair. The SAM tracker never re-finds a lost object (close-up then zoom-out, flying hair). Now lost frames are re-linked to the nearest detected person, and head/hair are detected on EVERY frame near the person; tight edges also per frame. Mask prep takes a bit longer.

## 🎭 Замена героя 0.8 — настройки больше не слетают (dev, 11.11.2026)

**RU:** Роман: при смене вкладки или выходе из трея примерно в половине случаев настройки слетали, нода краснела, в «секундах» — длинное число. Причина: ComfyUI раскладывает сохранённые значения по номерам полей, и иногда они сдвигались. Теперь нода хранит значения ещё и по ИМЕНАМ и после загрузки раскладывает их по именам; каждое поле проверяется — мусор (чужое слово в списке, число вне диапазона) заменяется умолчанием, а не красным. Смена формы кадра убрана (решили с Романом: отдельная задача, внутри замены даёт швы); размер — «качество» или провода width/height (не больше рамки, форма клипа). Авто-запас для лица — 1 (проверено Романом на разных видео). Открыть процесс заново.

**EN:** Settings no longer scramble on tab switch / tray: values are also stored by NAME and restored by name; every field is validated (garbage → default, not red). Frame-shape change removed (a separate task; seams inside a swap). Size — «quality» or wired width/height (fits inside, clip shape). Auto margin for the face — 1. Reopen the workflow.

## 🎭 Замена героя 0.7 — размер кадра (dev, 11.11.2026)

**0.7.2:** у Романа 0.7 «зависла» после трекинга (видеокарта стоит) — подготовка кадра на процессоре. Размытие человека теперь двумя проходами (строка + столбец): результат тот же до 1e-6, а 768p 16:9, 124 кадра — 23 с вместо долгих минут. **EN:** 0.7 hung after tracking (CPU prep); the person blur is now separable — identical result, seconds instead of minutes.

**0.7.1:** размытие дорисовываемых краёв считается на уменьшенной картинке — в 0.7 оно было очень медленным. Сквозная проверка движка на заглушках: как в клипе, 16:9 из вертикального, 1:1 — 15 из 15. **EN:** border blur computed at 1/8 size (0.7 was very slow); end-to-end mock test 15/15.

**RU:** Проверка Романа: 768p, лицо, размытие 0.5 — «качество огонь». Просьба: управлять размером. Новая группа «РАЗМЕР»: качество 480p/768p; **форма кадра** — как в клипе, 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 или ✏ ручной (ширина и высота). Если форма другая, клип встаёт в кадр целиком, а пустые края модель дорисует (вертикальное видео со смартфона → широкий кадр). Входы **width / height**: с проводами качество, форма и ручной размер прячутся и не работают. Всё в паспорте H3 (площадь до 1344×768, кратно 32). Открыть процесс заново — поля изменились.

**EN:** New «SIZE» group: quality 480p/768p; **frame shape** — as in clip, 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 or manual width/height. A different shape fits the whole clip inside and the model paints the empty borders (phone vertical → wide shot). **width / height** inputs: when wired, quality/shape/manual hide and are ignored. Clamped to the H3 passport. Reopen the workflow.

## 🎭 Замена героя 0.6 — только размытие, умолчания по проверкам (dev, 11.11.2026)

**RU:** По проверкам Романа (лучшее — 768p, лицо, размытие 0.5, запас 5, точные края: «шикарно») оставлено только размытие. Убраны чёрный и серый силуэт, «оригинал», оба скелета и модель SDPose — они проиграли размытию. Умолчания: сила размытия 0.5; запас маски «0 — авто» (лицо 5, весь облик 25); точные края вкл. Группа «РАЗМЫТИЕ И КРАЯ». Справка, README и заметка в процессе переписаны: рецепт «480p — проба, тот же сид на 768p — чистовик». Открыть процесс заново — поля изменились.

**EN:** Based on Roman's tests (best — 768p, face, blur 0.5, margin 5, tight edges) only the blur stays; black/gray silhouettes, «original», both skeletons and SDPose are removed. Defaults: blur 0.5; mask margin «0 — auto» (face 5, whole look 25); tight edges on. Help, README and the workflow note rewritten, with the recipe «480p to try, the same seed at 768p for the final». Reopen the workflow — the fields changed.

## 🎭 Замена героя 0.5 — точные края (dev, 11.11.2026)

**0.5.1 RU:** проверка Романа: в режиме «лицо» края головы плыли. Причины: мягкий край вклейки заходил внутрь — на волосы (волосы смешивались с фоном клипа), а SAM искал только «голову» без волос до плеч. Теперь мягкий переход целиком снаружи человека, по сгенерированному фону; голова ищется как «head» + «hair» в зоне замены. **EN:** head edges were soft: the feather ate into the hair and SAM looked for «head» only. Now the soft transition lies fully outside the person, and the head is found as «head» + «hair».

**RU:** Проверки Романа: 🌫 размытие — лучший образец; ⭐ эталон — весь облик, размытие 0.5, запас 25. «Сила размытия» — это смесь оригинал ↔ фото (ниже 0.4 возвращается оригинал). Огрех: модель перерисовывает всю полосу запаса вместе с улицей — края кажутся чуть расплывчатыми. Теперь **две маски**: модель рисует в широкой зоне, а после генерации SAM ещё раз находит НОВОГО человека в готовом видео, и вклеивается только он (плюс место старого); полоса запаса снова — настоящие резкие пиксели клипа. Переключатель «точные края» в ⚙ (вкл.). Запас маски теперь круглый, по контуру, без ступенек.

**EN:** Roman's tests: blur is the best reference; ⭐ reference run — whole look, blur 0.5, margin 25. «Blur strength» mixes original ↔ photo. Fix for soft edges: two masks — the model paints in the wide zone, then SAM finds the NEW person in the result and only they (plus the old person's place) are pasted; the margin band is the clip's real sharp pixels again. Expert «tight edges» (on). The mask margin is now round, following the contour.

## 🎭 Замена героя 0.4 — «лицо и причёска» по-настоящему (dev, 11.11.2026)

**0.4.1 RU:** проверка Романа — для головы лучший 🌫 размытие (лицо с фото, свет и поворот как в клипе, без «бантика», картинка чётче). Новая ручка в ⚙ эксперте «сила размытия» 0.1–1.0 (идея Романа: слабее — проступают контуры лица). **EN:** blur is the best for the head; new expert «blur strength» 0.1–1.0.

**RU:** Проверки Романа: скелет Ref2VA не понимает (переносит палки в кадр буквально, и чёрные, и цветные). Лучший прогон — ◻ серый силуэт + запас маски 12: без ореола, одежда с фото. Вопрос Романа «а если только лицо?» нашёл огрех: режим «🙂 лицо и причёска» менял только текст, а маска закрывала всего человека. Теперь маска — только по голове (SAM ищет «head» у выбранного человека; не нашла — верх фигуры), тело и одежда — пиксели клипа. Свой текст: «закрашена только голова — нарисуй голову с фото, тело и одежда без изменений».

**EN:** Roman's tests: Ref2VA does not understand a skeleton (copies the sticks literally). Best run — gray silhouette + mask margin 12. Roman's question «what about only the face?» found a flaw: «face & hair» changed only the prompt while the mask covered the whole person. Now the mask covers only the head (SAM «head» of the chosen person; fallback — the top of the figure); body and clothes stay the clip's pixels. A dedicated head prompt.

## 🎭 Замена героя 0.3 — 🦴 скелет (dev, 11.11.2026)

**0.3.1 RU:** ещё вариант (идея Романа) — **🦴⬛ чёрный скелет**: скелет толстыми чёрными палками, «силуэт толщиной в скелет» (толщина ≈ 7 % роста человека в кадре). **EN:** one more variant — a thick black stick figure, a silhouette as thin as the skeleton.

**RU:** Проверка Романа: 0.2 (чёрный силуэт) **заменяет человека полностью** — лицо с фото, движение, губы под песню. Но силуэт задаёт и форму одежды (пышные рукава и юбка → модель рисует шубу), а широкая маска даёт тёмный ореол. Новый режим в ⚙ эксперте «человек в образце» → **🦴 скелет** (идея Романа): человек стирается в фон (цветами улицы вокруг), поверх рисуется его скелет — родные ноды SDPose (тело, кисти, ступни, точки лица), поза ищется в рамке из маски SAM. Свой текст: «натяни человека с фото на скелет, линий скелета в результате нет». Модель SDPose (`sdpose_wholebody_fp16`, Comfy-Org) — в «📥 Модели», нужна только для этого режима. По умолчанию по-прежнему чёрный силуэт.

**EN:** Roman's test: 0.2 (black silhouette) **swaps the person completely** — face from the photo, motion, lips to the song. But the silhouette also sets the clothing shape (puffy sleeves and skirt → the model draws a fur coat), and the wide mask leaves a dark halo. New expert mode «person in reference» → **🦴 skeleton** (Roman's idea): the person is erased into the background and their pose skeleton is drawn on top — native SDPose nodes (body, hands, feet, face points), searched inside the SAM mask box. A dedicated prompt. The SDPose model (`sdpose_wholebody_fp16`, Comfy-Org) is in «📥 Models», needed only for this mode. Black silhouette stays the default.

## 🎭 Замена героя 0.2 — силуэт вместо оригинала (dev, 11.11.2026)

**RU:** Идея Романа: до генерации человек в видео-образце закрашивается чёрным силуэтом — модели нечего копировать, облик она берёт с фото, а силуэт задаёт движение. Свой текст для модели под силуэт. В ⚙ эксперте «человек в образце»: чёрный / серый / размытие / оригинал. mask_preview показывает маску и кадр с силуэтом. В 0.1 H3 повторяла оригинал и брала с фото только цвет.

**EN:** Roman's idea: the person in the reference video is blanked to a black silhouette before generation — nothing to copy, the look comes from the photo, the silhouette drives the motion. A dedicated prompt. Expert «person in reference»: black / gray / blur / original. mask_preview shows the mask and the silhouette frame.

## 🧹 Порядок в движках H3 (dev, 09.11.2026)

**RU:**
- Оставляем пять процессов H3, у каждого своя роль: ⚡ **Full Pipeline** (быстро, автопромтер, низкие разрешения), 🎥 **MiniMax H3 I2V v3.0** (камера, LoRA), 💎 **H3 Engine v2.0 «Хард»** (максимум качества), 🎞 **H3 Story** (до 45 с), 🎬 **Smart MiniMax «Диалог»** (режиссёр сцены разговора).
- Сняты из dev: **H3 One** (вместе с 🎭 Подменой / Swap) и **⚡ H3 Engine Fast**. В main их не было — у людей ничего не меняется. Код Swap и заметки — `docs/archive/H3_Swap/`.
- Neron Studio 2026.11.09·1: со стола убраны плитки H3 One, «Последний замер», «Замена героя», папка «Тест» (пока пустая) и «Для профи · H3 Raw» (Raw Engine остаётся в main и на Civitai). «📥 Модели» открывает H3 Story.

**EN:**
- Five H3 workflows stay, each with its own role: Full Pipeline (fast), MiniMax H3 I2V v3.0 (camera), H3 Engine v2.0 "Hard" (max quality), H3 Story (up to 45 s), Smart MiniMax "Dialogue".
- Removed from dev: H3 One (with Swap) and H3 Engine Fast. They were never in main. Swap code and notes: `docs/archive/H3_Swap/`.
- Neron Studio 2026.11.09·1: desk tiles for H3 One, Last benchmark, Hero swap, the Test folder (empty for now) and H3 Raw removed (Raw Engine stays in main and on Civitai).

## 🎭 Neron H3 Подмена / Swap — альфа (dev, 07.11.2026)

**RU:**
- Новая нода **🎭 Neron H3 Подмена / Swap** (в пакете `ComfyUI-NeronH3One`) и процесс `Neron_H3_Swap.json`: опорное видео + фото «на кого» → тот же ролик с другим человеком, до 15 с, на MiniMax H3.
- Без лапши: три окна прямо в ноде (🎬 видео с кадром-превью и длительностью, 🖼 на кого, 🔊 свой звук) — клик или перетащить, можно бросить все файлы разом.
- 🙂 лицо / 🧍 полностью; звук 🎵 оригинал (байт в байт) / 🔊 свой / ✨ сгенерировать; видео любой частоты → 24 к/с, длиннее 15 с — берётся начало.
- Текст для модели нода пишет сама; ⚙ — уточнение, «движение строго/свободнее», размер, длина, LoRA, ускорение; профи — входы-провода и свой prompt.
- Тесты подмены добавлены в `tests/test_one.py` (все проходят). *На настоящей H3 ещё не проверено.*

## 🎬 Neron H3 One — единый движок H3 / single H3 engine (dev, 07.11.2026)

**RU:**
- Новый пакет `ComfyUI-NeronH3One` — один движок вместо пяти похожих (H3 Engine, Engine Fast, Studio HD, H3 Studio, движок Story). Ставится **рядом** со старыми: свои имена нод, маршрутов и событий; модели и токен Hugging Face общие.
- **Пять режимов:** 🔥 Экстрим (Fast H3 + разреженное vsa, или база + быстрая LoRA 4 шага + sol-attn) · 🚀 Быстро (быстрая LoRA, 6 шагов; ⚙ турбо-LoRA 12) · ⚖ Баланс (HD: черновик → чистовик; ⚙ «чище») · ✨ Качество (bf16, 40 шагов) · 👑 Максимум (bf16 + энкодер int8, 50 шагов).
- **🛡 Защита от двоения:** LoRA на int8/fp8-модели ComfyUI пересжимает со случайным округлением — отсюда двоение на турбо. Есть рядом та же модель в bf16 — нода берёт её; нет — предупреждает.
- **⚡ Ускорение (⚙)** только штатными нодами ComfyUI: внимание PyTorch / Sage (если стоит) / Kitchen INT8; разреженное «Model Sparse Attention» (sol-attn, vsa). Ничего не устанавливается.
- **📋 Отчёт и ⏱ замер:** модели и почему, время этапов, секунды на шаг — без слов промпта.
- Первый кадр — настоящий кадр ролика + <Picture 1> (⚙ можно «только образец», как в Raw Engine); обрезка под формат вместо растяжения; кэш текстового энкодера между прогонами.
- У каждого режима свой пакет «📥 Модели». Своя модель (дообученная) не подменяется на Fast H3.
- Проверка `tests/test_one.py` (17 сценариев, без ComfyUI). *На настоящей H3 ещё не проверено.*

## 🎬 Neron H3 Story — прототип длинного ролика / long-video prototype (dev, 05.11.2026)

**RU:**
- **Герои с промежуточных картинок не «линяют» (06.11):** план пишет строку `ASSET A2: 3-4 | облик` — картинка идёт образцом во ВСЕ блоки, пока её герой на экране, а облик (цвета, свечение, молнии) повторяется в каждом промпте. На живом прогоне белый тигр в молниях к концу ролика становился обычным рыжим — теперь держится. Предпросмотр: одна строка-заголовок на отрезок, без строк «💬».
- **🚀 Быстро мягче (06.11):** на живом прогоне 4 шага с настройками lightx2v (euler, сдвиг 6) дали грязную картинку → теперь сэмплер и сдвиг как в проверенном Турбо (res_multistep, 12/3) и по умолчанию 6 шагов; в эксперте 4 / 6 / 8 / 10.
- **Story AutoPrompter без блоков (06.11):** входы только `scenario`, `frames`, `lora_all`. Новая нода **🖼 Neron H3 Кадры** — четыре окна загрузки прямо в ноде (подписи: первый кадр, промежуточный 1 и 2, последний), клик или перетаскивание файла, ✕ — убрать; картинки любого размера вписываются в своё окно, высота ноды подстраивается сама; без входов-проводов — один выход `frames`. Промежуточные появляются там, где сказано в сценарии (не сказано — на ~1/3 и ~2/3 ролика), последний — конец всего ролика. Камера АВТО (облёт по сценарию) сохранена.
- **🎞 Блоки — на движке:** в эксперте движка они подключаются и вместе с AutoPrompter: свой текст заменяет промпт блока, пустой — оставляет промпт AutoPrompter; LoRA блока добавляются, lora_all — поверх. Процесс `Neron_H3_Story_AutoPrompter.json` переделан под 🖼 Кадры.
- **Story AutoPrompter — камера как в ⚡ Fixed Camera H3:** АВТО — камерой правит AutoPrompter (о камере ни слова — стоит; написал движение — облёт, «застывает над плечом» — расписывает по секундам с конечной точкой, следующий блок начинается оттуда же). ФРОНТ / СЛЕВА / … — жёсткая шапка камеры в каждый блок, слова LLM про камеру вычищаются. Раньше шапка «заморозки» ставилась всегда.
- **🎞 Блоки дополняют сценарий:** сценарий — хребет всего ролика, заметки и картинки нод 🎞 Блок ложатся в тот блок, где это происходит по сюжету (план пишет строки USE; тигр с block_1 уезжает в блок 2, если появляется там). Жёсткий только last_frame. Раскладка видна в предпросмотре (строка 🖼) и сохраняется при своей правке. Первый кадр 🎞 Блока 1 больше не теряется — становится образцом.
- Наплыв панелей Story AutoPrompter исправлен (распорки вместо добавки к высоте).
- **📥 Модели качает сам** (как Neron LTX Engine): окно открывается само, если чего-то не хватает; прогресс, докачка после обрыва, проверка места, раскладка по папкам. Модель H3 — с официальной Comfy-Org, турбо- и быстрая LoRA — от авторов lightx2v. Другая версия уже лежит (например, модель bf16 или LoRA v1.1) — не качает. Токен Hugging Face спрашивает только если сайт попросит; токен от LTX Engine подхватывается. Все модели на «🤖 авто», чужое имя из схемы — не красная ошибка, а «авто» с запиской.
- **🚀 Быстро:** 4-шаговая турбо-LoRA lightx2v (v1.3, 768p) с настройками авторов — euler, сдвиг 6/3, сила 1.0. Для мультиков, 3D и пробы сюжета. В эксперте — 4 / 6 / 8 шагов (группа «🚀 БЫСТРО»). ⚡ Турбо — по-прежнему основной и по умолчанию. *На настоящей H3 ещё не проверено.*
- **🔊 Звуковые образцы (эксперт):** ref_audio_1…3 (голос, музыка, фон) — <Audio 1…3> в каждый блок, до 15 с; нет <Audio 1> в промпте — движок допишет сам. AutoPrompter не участвует. *Не проверено на H3.*
- **📖 Справка переписана:** что такое блок, как склеиваются (кусок + звук), звук, внешность, LoRA, режимы с реальными замерами, первый запуск.
- Новые настройки добавлены в конец ноды — старые сохранённые схемы открываются без сдвига значений.
- Новая нода **🎬 Neron H3 Story**: ролик MiniMax H3 цепочкой до 4 блоков по 3–15 с (по умолчанию 10 с). Промпты блоков — проводами prompt_1…prompt_4.
- **Стык без рывка:** блоки 2+ начинаются не с картинки, а с хвоста прошлого блока (22 кадра ≈ 0,9 с) **вместе с его звуком** — родная нода ComfyUI «Add Guide for MiniMax H3». Перехлёст при склейке убирается, звук на нём плавно сводится. В эксперте — стык «один кадр» и длина стыка 5 / 22 / 39.
- **🔒 Сохранить внешний вид** (вкл. по умолчанию): первый кадр (или вход appearance) — образец <Picture 1> в каждом блоке; объясняется в 📖 Справке.
- Модель грузится один раз на весь ролик, тексты всех блоков кодируются разом.
- **Длина ролика 5–45 с и длина блока 5–15 с** — оба ползунка. Длина блока — максимум: ролик делится на ровные блоки (до 12), готовый ролик обрезается ровно под длину; лишний полный блок ради последней секунды не гонится.
- **LoRA по блокам:** у каждого блока пара входов prompt_k + lora_k (появляются по мере подключения), новая нода **🎨 Набор LoRA** (3 слота с силой, наборы цепляются друг за друга); **lora_all** — LoRA на весь ролик. Модель грузится один раз, LoRA меняются по блокам; одинаковые подряд — без пересборки. Нет файла LoRA — пропуск с пояснением.
- **Прогон 1 на настоящей H3** (3 блока, bf16, Турбо): без ошибок, **звук сквозной через стыки**; блок 3 вернулся к исходнику → строка «один непрерывный кадр без склеек / продолжение с прикреплённых кадров» и «<Picture 1> — только внешность».
- **🎞 Neron H3 Блок** — одна сцена одним проводом: первый (у блоков 2+ — образец «кто/где»), 2 промежуточных (навигаторы), последний (якорь конца блока), текст, LoRA.
- **Движок — три состояния:** подключён `story` (шина от будущего Story AutoPrompter) — видно только story → video; «чайник» — первый кадр + промпты блоков; ⚙ эксперт — ноды 🎞 Блок, lora_all, размеры, все выходы. Провод на движке главнее шины. Входы всегда по порядку, подключённое не прячется.
- **📝 Neron H3 Story AutoPrompter** (внутри папки ComfyUI-NeronH3Story; сервером LLM и моделями пользуется у нашего 🎬 Neron AutoPrompter, ничего в нём не меняя): сценарий на весь ролик + первый кадр + ноды 🎞 Блок + lora_all → два прохода LLM: **план** (по строке на блок и точное состояние на каждом стыке) и **промпт каждого блока** (продолжение стыка, действия по секундам, физика, концовка под план, звук, <Picture N> в нумерации движка). Длина ролика и блока задаются здесь, план виден на ноде. Выходы: `story` → движок, `prompts` — текст. Предпросмотр и своя правка по блокам («### БЛОК k ###»). LLM по умолчанию выгружается после — H3 нужна вся видеокарта. Свой системник `ComfyUI-NeronH3Story/prompts/H3_Story_Director_EN.txt`.
- Процессы: `Neron_H3_Story.json` (чайник), `Neron_H3_Story_Expert.json` (блоки), `Neron_H3_Story_AutoPrompter.json` (сценарий → AutoPrompter → движок).
- Логика проверена на макете ComfyUI (длины, стыки, звук, LoRA, картинки блоков, шина, AutoPrompter → движок). План: `docs/PLAN_Neron_H3_Story.md`.

**EN:**
- 📥 Downloads missing models itself (Comfy-Org H3 + lightx2v LoRAs), skips other versions you have; models on auto. 🚀 Fast mode: lightx2v 4-step LoRA (euler, shift 6/3), 4/6/8 steps in expert. Expert sound references ref_audio_1…3 → <Audio N> in every block. Rewritten help. Fast and sound refs not yet run on real H3.
- New **🎬 Neron H3 Story** node: MiniMax H3 video as a chain of up to 4 blocks (3–15 s each), one prompt wire per block.
- Seamless joins: blocks 2+ continue the previous tail (22 frames ≈ 0.9 s) with its sound via the native "Add Guide for MiniMax H3" node; overlap removed, audio crossfaded.
- Keep appearance (on by default): first frame as <Picture 1> in every block. One model load per video.
- Chain logic verified on a ComfyUI mock; not yet run on real H3.

## 🎬 LTX 2.5 v2.0 — Neron LTX Engine + Neron LTX AutoPrompter (main, 04.11.2026)

**RU:**
- **🎬 Neron LTX Engine** — генератор LTX 2.5 одной нодой по процессу Neron «LTX 2.5 Pure 2K/3K»: два прохода, плавность ×2 встроенной нодой ComfyUI, только встроенные ноды. Входы: промпт, камера, первый / два промежуточных / последний кадр, width/height и seconds_in с проводов. Выходы: видео со звуком, звук, кадры, к/с, prompt_used.
- **📥 Модели качает сам:** окно открывается само, токен Hugging Face по шагам, прогресс, докачка, проверка места, раскладка по папкам. Модели на «авто».
- Размер: Авто по видеокарте, 16 пресетов, по площади, ручной. Камера из camera_prompt — в начало и конец промпта.
- **🎬 Neron LTX AutoPrompter** — промпт под LTX: кадр до мелочей, физика каждого движения, препятствия, точные позы, подробная концовка, звук; камеру модель ставит первой фразой, длину ролика нода пишет первой строкой. Предпросмотр и своя правка в ноде. LLM (Qwen 3.5 9B + зрение) и llama-server находит или качает сам.
- AutoPrompter: «модель ответила пусто» почти исчезло — повтор без раздумий и с двойным лимитом; с LTX-системником H3-камера не подмешивается.
- Нет красного окна из-за чужой схемы: отсутствующие файлы → «авто» или пропуск, с сообщением.
- Понятные ошибки на двух языках. 💡 Хочешь хорошо — ставь промежуточные и последний кадр.
- Процессы: `ComfyUI-NeronLTXEngine/workflows/Neron_LTX_AutoPrompter.json` и `Neron_LTX_Engine.json`.

**EN:**
- **🎬 Neron LTX Engine** — LTX 2.5 in one node (Neron two-pass recipe, built-in ×2 smoothness), first / middle / last frames, wired size and seconds, video + audio + frames + prompt_used; downloads its models (HF token steps, resume, disk check); size presets; camera at the start and end.
- **🎬 Neron LTX AutoPrompter** — detailed LTX prompts with physics, obstacles, exact poses and sound; camera as the first sentence, clip length on the first line; in-node preview and edit; finds or downloads its LLM and llama-server.
- AutoPrompter retries empty answers; no red errors from missing saved files; clear bilingual errors.

## 🤖 LTX AutoPrompter сам по себе / self-sufficient LTX AutoPrompter (dev, 04.11.2026)

**RU:**
- Новичок видит только длительность, предпросмотр и правку. Модель, зрение и системник — под экспертом, по умолчанию **«🤖 авто»**.
- Авто ищет LLM класса **Qwen 3.5 9B** и **зрение из той же папки** (чужое зрение к модели не подходит). Нет — **скачивает сама**: Qwen 3.5 9B Q4_K_M (~5,7 ГБ) и mmproj-F16 (~0,9 ГБ) от unsloth на Hugging Face в `models/LLM/Qwen3.5-9B`. Без регистрации (Apache 2.0), прогресс на ноде, докачка, проверка места, проверка GGUF. llama-server тоже ставится сам (как в H3).
- В списке системников — только LTX-шные.
- Первой строкой промпта — длина ролика с ползунка («A N-second single continuous shot.»), действия по секундам.
- **Нет красного окна** из-за чужой схемы: если сохранённого файла модели/системника/LoRA/апскейла нет, нода берёт «авто» или пропускает и пишет об этом (и в AutoPrompter, и в движке).
- Окна предпросмотра и правки растягиваются с нодой, рамки не налезают. Правило «хочешь хорошо — ставь кадры» в справке и подсказках.
- Системник: подробная концовка, предметы сохраняют форму, точные позы, препятствия, только то, что на картинке.

**EN:**
- Beginners see only seconds, preview and edit; LLM, vision and system prompt are under expert, on **auto**.
- Auto finds a Qwen 3.5 9B class LLM and the vision file from the same folder, or downloads Qwen 3.5 9B Q4_K_M + mmproj-F16 (unsloth, Apache 2.0, no login) with progress and resume. llama-server installs itself.
- Only LTX system prompts listed; clip length on the first line; no red errors from missing saved files (auto fallback) in both nodes.

## 🎬 Neron LTX AutoPrompter — автопромтер под LTX 2.5 / AutoPrompter for LTX 2.5 (dev, 04.11.2026)

**RU:**
- Новая нода рядом с H3 AutoPrompter (тот же сервер LLM, модели и надёжный повтор). Входы как у движка: бриф, камера, первый / промежуточные 1–2 / последний кадр. H3-камеры нет.
- **Камера идёт прямо в LLM:** модель ставит её первой фразой (по-английски, без отрицаний) и коротко повторяет в конце; забыла — нода сама подставляет фразу.
- Выходы прямо в движок: prompt, seconds (новый вход движка **seconds_in** — длительность задаётся в одном месте), кадры насквозь.
- **Окно предпросмотра** ответа в ноде, кнопка «✏ В правку»: пока в «своей правке» есть текст, он идёт в движок как есть, LLM не запускается.
- Системник LTX: физика как цепочка «причина → вес и путь → ответ материалов → затухание», **препятствия** (ничто не проходит сквозь ничто), **точные позы** (стойка — стоя, без «low/sinks»), **только то, что есть на картинке**, звуки под эпоху, без «или».
- Движок: выход **prompt_used** (что реально ушло в модель); камера из camera_prompt — в начало и конец промпта.
- Новый процесс `workflows/Neron_LTX_AutoPrompter.json`.

**EN:**
- New node next to the H3 AutoPrompter (same LLM server, models and retries), inputs matching the engine, no H3 camera.
- The camera goes into the LLM: first sentence (positive English) + short repeat at the end; a safety net adds it if forgotten.
- Outputs wire straight into the engine (new **seconds_in** input), in-node preview and "✏ To edit".
- LTX system prompt: physics chain, obstacles, exact poses, only what is in the picture.
- Engine: **prompt_used** output; camera_prompt at the start and end. New workflow.

## ✍️ AutoPrompter для LTX 2.5 + надёжный ответ модели / AutoPrompter for LTX 2.5 + reliable answers (dev, 04.11.2026)

**RU:**
- Новый системный промпт **LTX25_Director_EN.txt** по официальным правилам LTX 2.5: проза в настоящем времени, детали — в движении и материалах (а не пересказ картинки), физика по шагам, эмоции через тело, обязательный звук с источниками, реплики в кавычках. Промежуточные и последний кадр — ключевые кадры, к которым идёт действие. Камеру не описывает: у Neron LTX Engine для неё своё окно.
- С LTX-системником AutoPrompter сам сообщает модели длительность, не подмешивает H3-камеру и считает кадры по правилу LTX (8·n+1).
- «Модель ответила пусто» почти исчезает: думающие модели (Qwen 3.5) тратили весь лимит на рассуждения. Теперь — повтор, со второй попытки модель отвечает сразу без рассуждений, с третьей — без рассуждений и с двойным лимитом. Если не помогло — понятная ошибка, что именно случилось и что сделать.
- LTX Engine: «форма без картинок» видна, только когда влияет (размер «Авто» или «По площади»).

**EN:**
- New system prompt **LTX25_Director_EN.txt** following the official LTX 2.5 rules: present-tense prose, detail placed in motion and materials, step-by-step physics, body-language emotion, mandatory sound with sources, quoted dialogue; middle/last frames as keyframes; no camera (LTX Engine has its own camera input).
- With the LTX prompt the AutoPrompter passes the duration, skips the H3 camera block and counts frames as 8·n+1.
- "Model answered empty" is mostly gone: retries, then no-thinking, then no-thinking with 2× limit; otherwise a clear error.
- LTX Engine: "shape without images" shows only when it matters.

## 🎬 Neron LTX Engine v0.1 — генератор LTX 2.5 одной нодой / LTX 2.5 generator in one node (dev, 03.11.2026)

**RU:**
- Новая нода по процессу Neron «LTX 2.5 Pure 2K/3K»: два прохода (8 шагов + дочистка с первым кадром на полной силе), раскодировка плитками, резкость выхода, плавность ×2 через **встроенную** ноду ComfyUI (RIFE). Чужих паков внутри нет.
- Входы проводами: промпт, промпт камеры (пока добавляется в конец промпта), первый, два промежуточных (сами на 1/3 и 2/3) и последний кадр. Выходы: видео со звуком, звук, кадры, к/с.
- Новичку видно: режим, длительность, видеокарта (Авто — нода сама узнаёт память). Остальное — под экспертом.
- **📥 Модели:** моделей нет — окно открывается само; токен Hugging Face по шагам; скачивание с прогрессом, докачкой после обрыва и проверкой места на диске; файлы раскладываются по папкам. Список пакета — в `packs.json`.
- Понятные ошибки на двух языках: старый ComfyUI, нет моделей, не та модель, не хватило памяти.
- Стартовый процесс `workflows/Neron_LTX_Engine.json` с заметкой «Первый запуск» для тех, у кого всё красное.

**EN:**
- New node based on the Neron "LTX 2.5 Pure 2K/3K" workflow: two passes, tiled decode, output sharpen, ×2 smoothness via ComfyUI's **built-in** RIFE node. No third-party packs inside.
- Wired inputs: prompt, camera prompt, first / two middle / last frames. Outputs: video with sound, audio, frames, fps.
- Beginners see mode, seconds, GPU (Auto). The rest is under expert.
- **📥 Models:** opens by itself when models are missing; Hugging Face token steps; resumable download with progress and disk check.
- Clear bilingual errors. Starter workflow with a "First run" note.

## 🎬 Видео ×24 / Video ×24 (dev, 01.11.2026)

**RU:** Кубик «Видео» теперь держит **до 24 роликов** (было 3): короткие куски по 5–10 с на пару минут. Следующий слот открывается после загрузки, карточки переносятся на новые строки. Видео-сэмплер видит все 24 — дорожки роликов прокручиваются колёсиком (видно четыре). Пульт по-прежнему показывает до трёх роликов рядом, поэтому много роликов — через Видео-сэмплер: он отдаёт Пульту один готовый монтаж. Если сэмплер на «⏭» и роликов больше трёх, он и Пульт об этом подскажут. Старые схемы открываются как раньше.

**EN:** The Video cube now holds **up to 24 clips** (was 3). The Video Sampler sees all of them (source rows scroll). The Pult still shows up to three clips side by side, so many clips go through the Video Sampler as one finished edit; with ⏭ and more than three clips the sampler and the Pult say so. Old workflows open unchanged.

## 🎬 Видео-сэмплер: плавные переходы / Video Sampler: smooth transitions (dev, 01.11.2026)

**RU:** В монтаже Видео-сэмплера появились переходы. **Надвиньте кусок на предыдущий** — на сколько надвинули, столько длится переход (жёлтый клин на ленте); утащили дальше — кусок переставляется, как раньше. Вид перехода — внизу у выделенного куска: **наплыв, через тьму, через свет, шторка, растворение, круг, проявление** (сначала тёмное — как карандашный рисунок) или «сразу». Звук на стыке тоже перетекает плавно. Как только монтаж собран («Монтаж готов»), окно сэмплера показывает и играет **собранный ролик — с переходами и звуком** (подпись «🎬 Монтаж с переходами»); пока собирается — куски без переходов. Старые схемы открываются как раньше (без наложений — резкие склейки).

**EN:** The Video Sampler edit gets transitions. **Slide a piece over the previous one** — the overlap is the transition (yellow wedge); drag further to reorder as before. Pick the type below for the selected piece: dissolve, dip to black/white, wipe, pixel dissolve, circle, reveal (dark first, like a pencil drawing) or cut. Audio crossfades too. Once the edit is built, the sampler monitor shows and plays it with transitions and sound. Old workflows open unchanged.

## ✨ Neron Video Editor v0.4: AI-правка видео по маске / masked AI video edit (dev, 01.11.2026)

**RU:**
- Цель — править само видео, а не делать новое. AI-кусок теперь — **перерисовка внутри рамки**: MiniMax H3 (ref2va) + патч **Fun ControlNet Union** (`MiniMaxH3FunControlNetApply`, mask + source_video, по документации Comfy). Модель видит ваше видео вокруг рамки и перерисовывает только её; пульт ещё раз накладывает рамку на оригинал — вне её кадр в кадр.
- «Где менять» (рамка) у AI-куска обязательна. Картинки внутри куска — образцы `<Picture N>` с автоматическим временем.
- Короткому куску модель досматривает настоящее продолжение (генерация от 5 с — на этом она обучена), в ролик идёт только сам кусок.
- AI-движок: новый выбор патча (`models/model_patches`), турбо-LoRA для ref2va (4 шага). Нет файла — ошибка со ссылкой, что и куда скачать.

**EN:**
- Goal: edit the real video. The AI piece is now a **masked repaint**: MiniMax H3 (ref2va) + the **Fun ControlNet Union** patch with mask + source_video (per Comfy docs). Only the box is repainted; outside it — the original, frame for frame.
- The “where to change” box is required. Pictures inside the piece are `<Picture N>` references with automatic timing.
- Short pieces get the real continuation as context (generation from 5 s); only the piece goes into the clip.
- AI Engine: patch picker, ref2va turbo LoRA (4 steps); missing files give an error with the download link.

## ✨ Neron Video Editor v0.3: AI-правка куска / AI edit of a piece (dev, 01.11.2026)

**RU:**
- AI-событие переделано по отзыву: вместо «ключевых кадров» (модель рисовала картинку целиком, как кадр) — **правка по образцам**, как в обычном генераторе. Выбрали кусок (2–15 с) → написали, что сделать → всё. Кусок уходит модели как `<Video 1>`, картинки, лежащие на полоске внутри куска, — как `<Picture N>` (не наклеиваются), время их появления/исчезновения пульт пишет в промпт сам. Промпт — в формате правки H3; свой полный промпт уходит как есть и виден в эксперте.
- «Область» у AI-куска: из AI берётся только она. Длину куска теперь можно сжать до 2 с.
- AI-движок сначала ищет модель **ref2va**, потом fl2va.
- Исправлено: падение на больших видео (IndexError 60825600) и выбор чужих моделей.

**EN:**
- The AI event is reworked after feedback: instead of keyframes (the model painted the picture as a whole frame) it is now **reference editing**, like the regular generator. Pick a piece (2–15 s) → write what to do. The piece is `<Video 1>`, pictures inside it are `<Picture N>` (not pasted), their times go into the prompt automatically. H3 edit-format prompt; a full own prompt is used verbatim.
- “Area” for AI pieces; pieces can be as short as 2 s. The engine prefers **ref2va**, then fl2va.
- Fixed: crash on big videos and picking foreign models.

## ✨ Neron Video Editor v0.2: AI-переход / AI transition (dev, 01.11.2026)

**RU:**
- Новая нода **✨ Neron Edit AI / AI-движок** (MiniMax H3 fl2va — те же модели, что у H3 Engine): ⚡ Турбо / Качество, размер, сид; модели под «⚙ эксперт». Подключается ко входу `ai` пульта.
- В пульте — кнопка **+ ✨ AI**: модель рисует кусок 5–15 с, а к нему через **MiniMaxH3AddGuide** «прибиты» настоящие кадры видео 1 (≈1 с в начале — стык продолжает движение), картинка на нужной секунде и, с «↩ Вернуться», настоящие кадры в конце. Виды: наплыв, карандаш, цвет вытекает, чернила, бумага, свои слова. «Держать ч/б рисунка». Звук: оригинал или звук модели.
- Готовые AI-куски запоминаются (память + `temp`): правка монтажа их не пересчитывает. До «Очереди» в «Монтаже» виден набросок.
- Исправлено: видео ускорялось, если «паспорт» файла врёт о частоте кадров (скачанные/телефонные ролики) — кубик сверяет с настоящими метками времени. Мышь совпадает с кадром и полоской при любом масштабе холста.
- Проверено без модели (у разработчика нет видеокарты с H3): якоря расставлены и приняты настоящими нодами ComfyUI, весь путь пульта, вне AI-куска — оригинал кадр в кадр. На модели — нужен тест.

**EN:**
- New **✨ Neron Edit AI** node (MiniMax H3 fl2va, same models as H3 Engine) for the pult's `ai` input.
- **+ ✨ AI** in the pult: a 5–15 s piece with real video 1 frames anchored via **MiniMaxH3AddGuide** at the start (smooth seam), the picture at the chosen second and, with “↩ Return”, real frames at the end. Styles: dissolve, pencil, colour drain, ink, paper, own words. “Keep drawing B/W”. Sound: original or the model's.
- AI pieces are cached (memory + `temp`); editing the cut doesn't regenerate them.
- Fixed: speed-up from a wrong fps header in downloaded/phone clips; mouse matches the frame and timeline at any canvas zoom.
- Verified without the model (no H3-capable GPU here): anchors accepted by ComfyUI's real nodes, full pult path, original untouched outside the AI piece. Needs a test on the model.

## ✂ Neron Video Editor — видео → видео, v0.1 / video → video, v0.1 (dev, 01.11.2026)

**RU:**
- Новый проект в папке `NeronVideoEditor`, меню **Neron/Video Editor**: кубики **🎬 Видео ×3** и **🖼 Картинки ×4** + **🎛 Монтажный пульт**.
- Видео 1 идёт как есть, кадр в кадр; поверх в нужные секунды проявляются **картинки** и **куски видео 2/3** — во весь кадр или в области (прямоугольник/овал, мягкий край), с переходами **Сразу / Наплыв / Проявление / Шторка / Через тьму**. У врезки — **✂ участок** источника, секунда источника, скорость, **свой звук** (плавно перехватывает звук), **подгонка цвета** под сцену.
- Проверено: вне событий и областей изменено 0 пикселей; итог того же размера, длины и fps, что видео 1.
- Подключили IMAGE от Load Video — звук и video_info подключаются сами; слоты открываются по мере подключения.
- Пульт: живой предпросмотр, полоска времени (тащить, растягивать), вкладки **Результат** и **До/После**, сохранение в `output/Neron_Videos`, 📖 справка на двух языках, 🔧 эксперт, размер ноды меняется мышкой.
- Пока без нейросети. Только в dev — для тестов.

**EN:**
- New project in `NeronVideoEditor`, menu **Neron/Video Editor**: **🎬 Video ×3** and **🖼 Pictures ×4** cubes + **🎛 Edit Pult**.
- Video 1 passes frame for frame; **pictures** and **pieces of videos 2/3** appear on top at chosen seconds — full frame or in an area (rect/oval, soft edge), with **Cut / Dissolve / Reveal / Wipe / Dip to black**. Inserts get a source **✂ piece**, source second, speed, **own sound** (smooth takeover) and **colour matching**.
- Verified: 0 pixels changed outside events and areas; output has video 1's size, length and fps.
- Wiring IMAGE from Load Video auto-wires audio and video_info; slots open as you connect.
- Pult: live preview, draggable timeline, **Result** and **Before/After** tabs, saving to `output/Neron_Videos`, bilingual 📖 help, 🔧 expert mode, resizable node.
- No neural network yet. dev only — for testing.

## 🖼 Image Processor: превью = выход / preview = output (dev, 31.10.2026)

**RU (обе ноды):**
- **Что видит глаз — то и уходит в генератор.** Пока двигаешь ползунок — быстрое превью браузера, но уже в полном размере выхода и той же математикой (раньше резкость считалась на уменьшенной копии и выглядела иначе). Через ~0.3 с после остановки нода берёт **точный кадр у сервера — тем же кодом, что и при запуске** (размер + цвет + резкость) и показывает его; в подписи появляется «✓». Проверено: превью и реальный выход совпадают до 1 уровня яркости из 255 во всех режимах. Точное превью считается на процессоре и не трогает видеокарту — можно двигать даже во время генерации. AI-апскейл в превью не входит.
- Превью **чёткое при любом приближении** холста (раньше после приближения колёсиком оно растягивалось и мылилось).
- После **загрузки картинки** нода больше не разъезжается: лишние поля остаются спрятанными, рамки групп на месте, дубль превью ComfyUI убран.

**EN (both nodes):** **What you see is what goes downstream**: a fast full-size browser preview while dragging, then the **exact frame rendered by the same Python code** as the real run (marked ✓) — verified to match within 1/255. Sharp at any canvas zoom; no layout breakage after uploading an image.

## 🎥 MiniMax H3 Generator (Lite): HD-режимы / HD modes (dev, 31.10.2026)

**RU:** В Lite-генератор встроены режимы из ⚡ H3 Engine Fast: **⚡ Быстро HD, Баланс HD, Чисто HD** — полный размер модели за один прогон (черновик → увеличение → чистовик). Добавлены в конец списка режимов, новых полей нет — старые воркфлоу (в том числе Neron Studio H3 Full Pipeline) открываются как раньше. После прогона на ноде — 📋 отчёт со временем этапов. Площадь черновика не ниже 0.4 (ниже модель дорисовывает ленточки и не слушает промпт).

**EN:** The Lite generator gets the H3 Engine Fast modes: **Fast HD, Balance HD, Clean HD** — full model size in one run (draft → upscale → refine). Appended to the mode list with no new fields, so old workflows open as before. A 📋 run report appears on the node.

## Автопромтеры: где искать модели / Autoprompters: model folders (dev, 30.10.2026)

**RU:** **llama-server снова скачивается сам**: llama.cpp поменял имена файлов в релизах (cuda-12.4 → cuda-13.x), и старый поиск ничего не находил. Теперь сборка ищется по образцу, под версию CUDA твоего драйвера, вместе с CUDA-библиотеками; нет NVIDIA — Vulkan или CPU. **AutoPrompter больше не отдаёт ошибку LLM в генератор как промпт** — останавливается и показывает её. AutoPrompter и Dialog Autoprompter **делят один llama-server**: если одна нода уже скачала его, вторая берёт тот же (раньше AutoPrompter мог не найти сервер, скачанный диалоговым). Ошибка «сервер не найден» теперь объясняет, что делать (RU/EN). AutoPrompter, Dialog Autoprompter и Multi-Image LLM видят GGUF-модели не только прямо в `models/LLM`, но и **в подпапках** (`models/LLM/Qwen/…`) в папках `LLM` из `extra_model_paths` (модели на другом диске) и в папке `LLM` рядом с **каждой** папкой моделей, которую знает ComfyUI (Desktop держит модели в нескольких местах). Новые файлы появляются в списке после перезапуска ComfyUI.

**EN:** **llama-server downloads again**: llama.cpp renamed its release files; the build is now matched by pattern for the driver's CUDA version (with the CUDA runtime), Vulkan/CPU without NVIDIA. **AutoPrompter no longer passes an LLM error to the generator as a prompt.** AutoPrompter and Dialog Autoprompter **share one llama-server** (one downloads, the other reuses it); the "server not found" error explains what to do. AutoPrompter, Dialog Autoprompter and Multi-Image LLM find GGUF models in `models/LLM` **subfolders** in `LLM` folders from `extra_model_paths` and in `LLM` next to **every** models folder ComfyUI knows (Desktop keeps models in several places). Restart ComfyUI to see new files.

## 🧹 Порядок в пакете / Pack cleanup (dev, 30.10.2026)

**RU:**
- **Один код картинки на четыре ноды**: Interactive Image Processor, 🖼 Neron Studio Image Processor, Smart Load & Resize Image и Manual Color & Upscale Panel. Раньше было три разные копии, и старые ноды из воркфлоу v1.0/v2.0 всё ещё растягивали картинку при «Отключено». Теперь у всех «Отключено» = как есть, резкость 0 = выкл. Поля нод не изменились — старые воркфлоу открываются как раньше. Студия по-прежнему подрезает пресеты по центру, простая нода — растягивает.
- **Камера H3 — одна копия** (в `ComfyUI-H3-Static-Camera`); AutoPrompter берёт её оттуда.
- **Системный промпт H3 — одна копия**, самая новая и полная (в `NeronStudio-AutoPrompter/prompts`). Две старые копии удалены; Dialog Autoprompter и Multi-Image LLM видят её в своём списке под тем же именем, так что старые воркфлоу работают. Свои файлы в `prompts` диалогового автопромтера по-прежнему видны.
- Старые ноды подписаны в меню «(legacy → …)»: Smart Load, Color Panel, старая тема Audio Studio. Ничего не удалено.
- В README — **карта**: какую ноду брать для какой задачи, и какие папки ставить вместе при ручной установке.

**EN:**
- **One image code for four nodes** (Interactive, Studio, Smart Load, Color Panel). Old v1.0/v2.0 nodes no longer stretch in Disabled. Node fields are unchanged; old workflows open as before.
- **One copy of the H3 camera**; AutoPrompter uses it from `ComfyUI-H3-Static-Camera`.
- **One copy of the H3 system prompt** — the newest, fullest one (in `NeronStudio-AutoPrompter/prompts`). The two old copies are removed; Dialog Autoprompter and Multi-Image LLM list it under the same name, so old workflows work.
- Legacy nodes are labelled "(legacy → …)" in the menu; nothing removed.
- README has a **map** of which node to use and which folders go together in a manual install.

## Убран режим «⚡ Быстро» / "Fast" mode removed (dev, 02.11.2026)

**RU:** В ⚡ H3 Engine Fast убран режим «⚡ Быстро», в Lite-генераторе — «⚡ Быстро HD»: на живой съёмке давали пережог и лишние детали, а выигрыш по времени был около минуты. Остались Баланс, Чисто, Свой. Старые схемы с «Быстро» сами открываются в «Балансе».

**EN:** "Fast" removed from H3 Engine Fast and "Fast HD" from the Lite generator: they overcooked live footage and added extra details for about a minute of saving. Balance, Clean and Custom remain. Old workflows with Fast open as Balance.

## ⚡ Neron H3 Engine Fast — тестовая версия / test build (dev, 30.10.2026)

**RU:**
- Новая опытная нода **⚡ Neron H3 Engine Fast** (меню Neron/H3), папка `ComfyUI-NeronH3EngineFast`: черновик в маленьком кадре на быстрой модели → увеличение латента → короткий чистовик в размере паспорта (до 1344×768). Цель — 10 с быстро и без «мыла».
- Режимы ⚡ Быстро / Баланс / Чисто / Свой; размер «По кадру»; баланс черновика и чистовика — в «Свой» и эксперте; 📋 отчёт прогона на ноде.
- Готовый воркфлоу `ComfyUI-NeronH3EngineFast/workflows/Neron_H3_Engine_Fast.json`. Пока только в dev — для тестов.

**EN:**
- New test node **⚡ Neron H3 Engine Fast** (Neron/H3 menu), folder `ComfyUI-NeronH3EngineFast`: small draft on a fast model → latent upscale → short refine at the passport size (up to 1344×768). Goal: 10 s fast and without blur.
- Modes Fast / Balance / Clean / Custom; "From image" size; draft/refine balance in Custom and expert; 📋 run report on the node.
- Ready workflow `ComfyUI-NeronH3EngineFast/workflows/Neron_H3_Engine_Fast.json`. dev only — for testing.

**Установка на чистую систему / Fresh install:**
- RU: Если Manager или ComfyUI Desktop не поставили библиотеки из `requirements.txt` (soundfile, imageio-ffmpeg), пакет Neron ставит их сам при запуске (в консоли — строка `[Neron pack] ставлю недостающие библиотеки`). Отключить: переменная `NERON_NO_AUTOINSTALL=1`.
- RU: Audio Studio без soundfile больше не падает целиком (раньше все её ноды, включая Neron Video Combine, становились красными): WAV пишется и читается встроенным модулем Python, а если нужно что-то сверх этого — нода прямо пишет, что поставить.
- EN: Missing `requirements.txt` libraries are installed automatically at startup (disable with `NERON_NO_AUTOINSTALL=1`). Audio Studio no longer fails as a whole without soundfile: WAV goes through Python's built-in wave module, anything beyond that reports what to install.

**Image Processor (обе версии / both versions):**
- RU: «Отключено» теперь значит «картинка как есть» — без округления до кратного 32 и без пересчёта пикселей (раньше 1200×720 молча растягивалось до 1216×736). Если форма та же и разница только от округления — края подрезаются на несколько пикселей вместо растяжения, люди не вытягиваются. Подпись под превью говорит, что произошло.
- EN: "Disabled" now means "as is" — no rounding to 32 and no resampling (1200×720 used to be silently stretched to 1216×736). When the shape is the same and only rounding differs, a few edge pixels are trimmed instead of stretching. The preview caption says what happened.

## Neron Stage 🎬 v0.1 — Площадка режиссёра / Director's Stage (28.10.2026, ветка dev)

**RU:**
- Новая нода **🎬 Neron Stage / Площадка** (меню Neron/Stage): фото места → объёмная сцена (Depth Anything V2 Small, метрическая; «Комната» / «Улица»; пол находится сам), скелет-дублёр ходит по точкам маршрута.
- Точки: клик по полу — новая, тащить мышкой; в каждой поза (13 готовых) и подсказка словами; позу можно гнуть мышкой за кисти, локти, колени, стопы, голову.
- Камера: «как на фото», спереди, слева, справа, сзади, сверху, снизу; планы общий / средний / крупный; вид «🎥 Камера» — мышь двигает саму камеру, кадр с полями ровно в пропорциях ролика.
- ▶ Репетиция и шкала времени; длина 5–15 с (сетка H3 17·n+5); форматы 16:9, 9:16, 1:1, 4:3, 3:4 (размеры кратны 32).
- Выходы: `pose_video` (OpenPose глазами камеры), `storyboard` (раскадровка по секундам), `frames`, `fps`, `width`, `height`, `scene`, `actor`.

**EN:**
- New **🎬 Neron Stage** node (Neron/Stage menu): place photo → 3D scene (Depth Anything V2 Small, metric; Room / Outdoor; floor found automatically), a stand-in skeleton walks along route points.
- Points: click the floor to add, drag to move; each has a pose (13 presets) and a text hint; bend poses by dragging hands, elbows, knees, feet, head.
- Camera presets, shot sizes and a “🎥 Camera” view where the mouse moves the camera, letterboxed to the clip aspect.
- ▶ rehearsal and a timeline; 5–15 s (H3 grid 17·n+5); 16:9, 9:16, 1:1, 4:3, 3:4 (sizes are multiples of 32).
- Outputs: `pose_video` (OpenPose from the camera), `storyboard`, `frames`, `fps`, `width`, `height`, `scene`, `actor`.

## Neron DJ Пульт / DJ Controller 🎧 v1.0 + Neron Theme для Audio Studio (28.10.2026)

**RU:**
- Новая нода **Neron DJ Пульт** (меню NeronAudio): две деки с джогами и волнами, ▶ / CUE / SYNC, ползунки темпа, 8 пэдов на деку в трёх режимах (точки, звуки, петли), фильтр, громкость, кроссфейдер, индикаторы.
- Треки — проводами `deck_a`, `deck_b`; свои звуки для пэдов — `pad_sounds` (Звук ×8). Без провода пэды играют 8 встроенных звуков (без файлов).
- **⏺ ЗАПИСЬ** сета: по Queue запись идёт на выход `audio` и сохраняется в `output/Neron_DJ`. Без записи — авто-переход A → B.
- Темп и удары находятся сами; SYNC подгоняет и темп, и удары.
- Пульт и все ноды студии красятся **новой Neron Theme**: панели, ручки, индикаторы, джоги и волны — в цветах темы, в том числе светлой. В готовой схеме Audio Studio v2.0 устаревшая «Тема» заменена на Neron Theme (старая нода оставлена, чтобы открывались старые схемы; её цвета, записанные в ноды схемы, убраны).

**EN:**
- New **Neron DJ Controller** node (NeronAudio menu): two decks with jog wheels and waves, ▶ / CUE / SYNC, tempo sliders, 8 pads per deck in three modes (cues, samples, loops), filter, volume, crossfader, meters.
- Tracks by wire `deck_a`, `deck_b`; your own pad sounds — `pad_sounds` (Sound ×8). Without it the pads play 8 built-in sounds (no files).
- **⏺ REC** a set: on Queue it goes out on `audio` and is saved in `output/Neron_DJ`. No recording — an auto transition A → B.
- Tempo and beats are detected automatically; SYNC matches both tempo and beats.
- The controller and all studio nodes follow the **new Neron Theme**: panels, knobs, meters, jogs and waves take the theme colors, light themes included. The ready Audio Studio v2.0 workflow now uses Neron Theme instead of the legacy "Theme" (the old node is kept so old workflows open; the colors it had written into the workflow's nodes are removed).

## Neron Theme 🎨 v1.0 — темы для всего ComfyUI / themes for the whole ComfyUI (28.10.2026)

**RU:**
- Новая папка **NeronTheme**, нода **Neron Theme 🎨** (меню Neron). Пока нода на столе — весь ComfyUI в теме: окно, стол, ноды по 9 ролям, провода. Удалили — всё возвращается как было (проверено сравнением настроек до и после).
- **УСТАНОВИТЬ:** 9 встроенных тем, «Мои» (файлы в `ComfyUI/user/neron_themes`), примерка наведением, чужая тема кодом или файлом (бросить на ноду).
- **СОЗДАТЬ:** тема из одного цвета (соседние оттенки / радуга / один тон, светлая), тема из картинки (вход `image`) — с рамкой по нужному участку и выбором главного цвета из найденных, ⚙ — все цвета, роли, свечение, живость. Текст всегда читаемый — нода сама следит за контрастом.
- **ПОДЕЛИТЬСЯ:** код `NERON-THEME1:…`, файл темы, палитра для Настройки → Appearance → Color Palette.
- **Живость:** огни по рамкам, искры по проводам, фон (переливы / частицы / звёзды), подсветка работы схемы (идёт / готово / ошибка + прогресс), вспышки в такт звуку Neron Audio Studio, «тише во время генерации», ограничение кадров.
- Ручной цвет ноды и ноды с фирменным цветом не перекрашиваются; сам workflow тема не меняет.
- **Прозрачность нод**, **подсветка нод** (свечение из-под ноды цветом роли), **цвет проводов**: по типу / один цвет / свой цвет каждого типа. Новая встроенная тема **«Подсветка»**.

**EN:**
- New **NeronTheme** folder, **Neron Theme 🎨** node (Neron menu). While it is on the canvas the whole ComfyUI is themed: window, canvas, nodes by 9 roles, wires. Remove it and everything is restored (checked by comparing settings before and after).
- **INSTALL:** 9 built-in themes, "Mine" (files in `ComfyUI/user/neron_themes`), hover to try on, someone's theme by code or file (drop onto the node).
- **CREATE:** a theme from one color (harmony / rainbow / mono, light), a theme from a picture (`image` input) — with a frame over the area you want and a choice of the main color from the found ones, ⚙ — every color, role, glow, life. Text always stays readable.
- **SHARE:** a `NERON-THEME1:…` code, a theme file, a palette for Settings → Appearance → Color Palette.
- **Life:** frame lights, wire sparks, background (flow / particles / stars), workflow run highlights (running / done / error + progress), beat flashes from Neron Audio Studio sound, "quieter while generating", FPS limit.
- Hand-set node colors and nodes with their own signature color are not repainted; the workflow itself is not changed.
- **Node opacity**, **node backlight** (a glow under each node in its role color), **wire colors**: by type / one color / your own per type. New built-in theme **"Backlight"**.

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
