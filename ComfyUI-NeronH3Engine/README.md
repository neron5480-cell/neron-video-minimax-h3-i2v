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

The second release of Raw Engine. If v1.0 is the light engine for low resolutions and speed,
v2.0 is the "hard" one: the maximum quality MiniMax H3 can give on an ordinary home
computer. No upscales, no tricks, no post-processing — honest generation inside the model passport.

### ⚡ WHAT'S NEW
* **New Neron H3 Engine node.** Our own, written from scratch; the old generator is untouched.
* **Three modes:**
  - ⚡ Turbo — 12 steps with the turbo LoRA. Drafts, motion, composition.
  - Quality — the full model, 40 steps. Small details and sound are noticeably cleaner.
  - Maximum — 50 steps + the uncompressed model (bf16), if downloaded.
* **Model passport.** Presets made exactly for H3: up to 1344×768, up to 15 seconds.
  Give it more (even 8K) — the node shrinks it to the model's maximum by itself, without errors.
* **Memory in turns.** Models are loaded one at a time and unloaded after their stage.
* **Protected VAE.** Not enough video memory to decode — the node retries in tiles,
  smaller and smaller. A finished generation is not lost at the last step.
* **Generation clock** right on the node: time, stage, step and how much is left.
* **Expert mode:** models, 2 LoRAs of your own, seed, manual size, fine settings.
  A beginner sees only the mode, size and duration.
* **Help in two languages** — the 📖 button right on the node.

### 🪶 WORKS WITH LIGHT MODELS TOO
Heavy models are not required. The engine also works with quantized versions
(int8, fp8 and others) — and even with them the quality is higher than in Lite, though generation
takes somewhat longer. This is a way out for those who have no room or memory for the full models
but want better quality: in our tests, on the same quantized models
the picture gets better by 20–35% on average.

### 🔬 ENGINE PRINCIPLES
The node does not invent a new model — it removes everything that cuts quality and lets
H3 work the way it was trained.

* **No upscale.** No latent upscale, no pixel upscale, no second "small → big" pass.
  One sampler pass straight at the target size. What the model drew is what you get.
* **Strictly the model passport.** Short side 768, area ≤ 1344×768, sides divisible by 32,
  24 fps, frames on the 17k+5 grid, up to 362 frames (15 s). Anything bigger is shrunk,
  keeping the proportions.
* **Full-precision attention** (pytorch attention). INT8 attention is faster but causes morphing
  at the end of the clip and crooked text — off by default, can be turned on in expert mode.
* **Sigma shift 12 / 3** (video / audio) via MiniMaxH3SigmaShift.
* **Sampling:** res_multistep + simple, BasicGuider, SamplerCustomAdvanced, denoise 1.0.
  Turbo — 12 steps, turbo LoRA ×0.8. Quality — 40 steps without the LoRA.
  Maximum — 50 steps + bf16 instead of int8.
* **References at full resolution** (ref_image_size = max in Quality and Maximum).
  Without references — pure text-to-video.
* **Whole-frame decoding**, no seams. Tiles 768 → 192 — only when memory runs short.
* **Memory by stages:** CLIP → unload → UNET → unload → video VAE → unload →
  audio VAE → unload.
* **Native ComfyUI nodes only.** No home-made samplers and no model patches.

### ⏱ HONESTLY ABOUT TIME
Measured on an RTX 5070 Ti 16 GB, 48 GB RAM, 5 seconds 1344×768:
* Turbo — ~7 min
* Quality — ~21 min
This node is for those who value quality over time. With heavy models in Maximum
it brings even an RTX 5090 to its knees. Need speed — take v1.0 Lite.

### 📦 WHAT YOU NEED
* A recent ComfyUI with MiniMax H3 support.
* The Neron H3 Engine node, VideoHelperSuite, Comfyroll.
* H3 models (UNET, CLIP, video and audio VAE, turbo LoRA) — links are on the canvas.
  Quantized versions work too.
* For Maximum mode — the bf16 model (40 GB) and spare RAM / a page file on a fast drive.
* Save in Video Combine as video/h264-mp4 (not gif — it kills the quality).


### 🧩 INSTALLATION
* **One link:** ComfyUI Manager → Install via Git URL →
  `https://github.com/neron5480-cell/neron-video-minimax-h3-i2v` → restart ComfyUI.
  All Neron nodes are installed, this one included.
* **Manually:** copy the `ComfyUI-NeronH3Engine` folder into `ComfyUI/custom_nodes/` and restart ComfyUI.
* The node is in the **Neron/H3** menu. Ready workflow: `workflows/Neron_H3_Engine.json`.
* The folder used to be called `NeronH3Engine Full`. If you have it installed, delete it so there are no two copies.
