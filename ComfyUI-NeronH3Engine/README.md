# 🎬 Neron H3 Engine v2.0 — Hard

Вторая версия Raw Engine. Если v1.0 — лёгкий движок под низкие разрешения и скорость,
то v2.0 — «хард»: максимум качества, который MiniMax H3 может дать на обычном домашнем
компьютере. Без апскейлов, без трюков, без постобработки — честная генерация в паспорте модели.

### ⚡ ЧТО НОВОГО
* **Новая нода Neron H3 Engine.** Своя, написана с нуля, старый генератор не тронут.
* **Три режима:**
  - ⚡ Турбо — 12 шагов с турбо-LoRA. Черновики, движение, композиция.
  - Качество — полная модель, 40 шагов. Заметно чище мелкие детали и звук.
  - Максимум — 50 шагов + модель без сжатия (bf16), если скачана.
* **Паспорт модели.** Пресеты ровно под H3: до 1344×768, до 15 секунд.
  Подадите больше (хоть 8K) — нода сама ужмёт до максимума модели, без ошибок.
* **Память по очереди.** Модели грузятся по одной и выгружаются после своего этапа.
* **Защищённый VAE.** Не хватило видеопамяти на раскодировку — нода повторит плитками
  всё мельче. Готовая генерация на последнем шаге не теряется.
* **Часы генерации** прямо на ноде: время, этап, шаг и сколько осталось.
* **Режим эксперта:** модели, 2 своих LoRA, сид, ручной размер, тонкие настройки.
  Новичок видит только режим, размер и длительность.
* **Справка на двух языках** — кнопка 📖 прямо на ноде.

### 🪶 РАБОТАЕТ И С ЛЁГКИМИ МОДЕЛЯМИ
Тяжёлые модели не обязательны. Движок работает и с квантованными версиями
(int8, fp8 и другие) — и даже с ними качество выше, чем в Lite, хотя генерация
несколько дольше. Это выход для тех, у кого нет места или памяти под полные модели,
но хочется поднять качество: по нашим тестам на тех же квантованных моделях
картинка становится лучше в среднем на 20–35%.

### 🔬 ПРИНЦИПЫ ДВИЖКА
Нода не придумывает новую модель — она убирает всё, что режет качество, и оставляет
H3 работать так, как её обучали.

* **Без апскейла.** Ни латентного, ни пиксельного, ни второго прохода «малое → большое».
  Один проход сэмплера сразу в целевом размере. Что модель нарисовала — то и на выходе.
* **Строго паспорт модели.** Короткая сторона 768, площадь ≤ 1344×768, стороны кратны 32,
  24 fps, кадры по сетке 17k+5, до 362 кадров (15 с). Всё, что больше, ужимается
  с сохранением пропорций.
* **Полноточное внимание** (pytorch attention). INT8-внимание быстрее, но даёт морфинг
  в конце ролика и кривой текст — по умолчанию выключено, включается в эксперте.
* **Сдвиг сигм 12 / 3** (видео / звук) через MiniMaxH3SigmaShift.
* **Сэмплинг:** res_multistep + simple, BasicGuider, SamplerCustomAdvanced, denoise 1.0.
  Турбо — 12 шагов, турбо-LoRA ×0.8. Качество — 40 шагов без LoRA.
  Максимум — 50 шагов + bf16 вместо int8.
* **Образцы в полном разрешении** (ref_image_size = max в Качестве и Максимуме).
  Без образцов — чистый text-to-video.
* **Раскодировка целым кадром**, без швов. Плитки 768 → 192 — только при нехватке памяти.
* **Память по этапам:** CLIP → выгрузка → UNET → выгрузка → VAE видео → выгрузка →
  VAE звука → выгрузка.
* **Только родные ноды ComfyUI.** Никаких самописных сэмплеров и патчей модели.

### ⏱ ЧЕСТНО О ВРЕМЕНИ
Замер на RTX 5070 Ti 16 ГБ, 48 ГБ ОЗУ, 5 секунд 1344×768:
* Турбо — ~7 мин
* Качество — ~21 мин
Это нода для тех, кому качество важнее времени. На тяжёлых моделях в Максимуме
поставит на колени даже RTX 5090. Нужна скорость — берите v1.0 Lite.

### 📦 ЧТО НУЖНО
* Свежий ComfyUI с поддержкой MiniMax H3.
* Нода Neron H3 Engine, VideoHelperSuite, Comfyroll.
* Модели H3 (UNET, CLIP, VAE видео и звука, турбо-LoRA) — ссылки на холсте.
  Подойдут и квантованные версии.
* Для режима Максимум — bf16 модель (40 ГБ) и запас оперативки / файл подкачки на быстром диске.
* Сохраняйте в Video Combine как video/h264-mp4 (не gif — он убивает качество).


### 🧩 УСТАНОВКА
* **Одной ссылкой:** ComfyUI Manager → Install via Git URL →
  `https://github.com/neron5480-cell/neron-video-minimax-h3-i2v` → перезапуск ComfyUI.
  Встанут все ноды Neron, включая эту.
* **Вручную:** скопируйте папку `ComfyUI-NeronH3Engine` в `ComfyUI/custom_nodes/` и перезапустите ComfyUI.
* Нода в меню **Neron/H3**. Готовый воркфлоу — `workflows/Neron_H3_Engine.json`.
* Раньше папка называлась `NeronH3Engine Full`. Если она у вас стоит — удалите её, чтобы не было двух копий.

---

# 🎬 Neron H3 Engine v2.0 — Hard (EN)

The second release of Raw Engine. v1.0 is the light engine for low resolutions and speed;
v2.0 is the "hard" one — the best quality MiniMax H3 can give on a regular home PC.
No upscales, no tricks, no post-processing — honest generation inside the model passport.

### ⚡ WHAT'S NEW
* New standalone node **Neron H3 Engine** (the old generator is untouched).
* Modes: ⚡ Turbo (12 steps, turbo LoRA) · Quality (40 steps) · Maximum (50 steps + bf16 model).
* Model passport presets: up to 1344×768, up to 15 s. Anything bigger is clamped, no errors.
* Staged memory, protected VAE decode, live run clock, expert mode, bilingual 📖 Help.

### 🪶 WORKS WITH LIGHT MODELS TOO
Heavy models are optional. The engine works with quantized versions (int8, fp8 and others),
and even with them the quality is higher than in Lite, at the cost of somewhat longer
generation. A way to raise quality without room or memory for full models: in our tests,
on the same quantized models the picture improves by 20–35% on average.

### 🔬 ENGINE PRINCIPLES
* **No upscale.** No latent or pixel upscale, no second "small → big" pass.
  One sampler pass straight at the target size.
* **Strict model passport.** 768 short edge, area ≤ 1344×768, multiples of 32, 24 fps,
  frames on the 17k+5 grid, up to 362 frames (15 s).
* **Full-precision attention** (pytorch attention). INT8 attention is optional.
* **Sigma shift 12 / 3** (video / audio) via MiniMaxH3SigmaShift.
* **Sampling:** res_multistep + simple, BasicGuider, SamplerCustomAdvanced, denoise 1.0.
  Turbo 12 steps + turbo LoRA ×0.8 · Quality 40 · Maximum 50 + bf16.
* **References at full resolution.** No references → pure text-to-video.
* **Whole-frame VAE decode**, tiled fallback 768 → 192 only on OOM.
* **Staged memory:** one model in memory at a time.
* **Native ComfyUI nodes only** — no custom samplers or model patches.

### ⏱ TIMING
RTX 5070 Ti 16 GB, 48 GB RAM, 5 s 1344×768: Turbo ~7 min, Quality ~21 min.
Quality over time. Need speed — use v1.0 Lite.

### 📦 REQUIREMENTS
* Recent ComfyUI with MiniMax H3 support.
* Neron H3 Engine node, VideoHelperSuite, Comfyroll.
* H3 models (UNET, CLIP, video & audio VAE, turbo LoRA) — links on the canvas.
  Quantized versions work too.
* Maximum mode: bf16 model (40 GB) and plenty of RAM / pagefile on a fast drive.
* Save as video/h264-mp4 in Video Combine, not gif.

### 🧩 INSTALLATION
* **One link:** ComfyUI Manager → Install via Git URL →
  `https://github.com/neron5480-cell/neron-video-minimax-h3-i2v` → restart ComfyUI.
  All Neron nodes are installed, this one included.
* **Manually:** copy the `ComfyUI-NeronH3Engine` folder into `ComfyUI/custom_nodes/` and restart ComfyUI.
* The node is in the **Neron/H3** menu. Ready workflow: `workflows/Neron_H3_Engine.json`.
* The folder used to be called `NeronH3Engine Full`. If you have it installed, delete it to avoid two copies.
