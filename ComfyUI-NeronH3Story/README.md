# 🎬 Neron H3 Story — длинный ролик MiniMax H3 / long MiniMax H3 video

## 🇷🇺 Русский

**Что это.** Ролик MiniMax H3 длиной **5–45 секунд со звуком**. Сама H3 делает до ~15 с, длиннее — «уплывает». Нода
делает ролик **цепочкой блоков** и склеивает их так, что стыков не видно — ни в картинке, ни в звуке: каждый
следующий блок начинается с последних ~0,9 с прошлого **вместе с их звуком** (родная нода ComfyUI «Add Guide for
MiniMax H3»), перехлёст вырезается, звук сводится плавно.

**Ноды**
- **🎬 Neron H3 Story** — движок: длина ролика 5–45 с, блок 5–15 с (максимум, ролик делится на ровные блоки, до 12),
  модель грузится один раз на весь ролик. 🔒 Сохранить внешний вид — первый кадр идёт образцом во все блоки.
- **🖼 Neron H3 Кадры** — четыре окна прямо в ноде: первый кадр, два промежуточных, последний. Нажми на окно или
  перетащи файл; картинки любого размера. Один провод вместо четырёх «Загрузить изображение».
- **📝 Neron H3 Story AutoPrompter** — один сценарий своими словами (любой язык) → план и промпт каждого отрезка:
  продолжение стыка, действия по секундам, физика, звук. Камера как в ⚡ Fixed Camera H3: АВТО — стоит, пока в
  сценарии не попросишь движение («камера огибает её и встаёт сбоку»). Промежуточные картинки появляются там, где
  сказано в сценарии («изображение 3»), и держат свой облик до конца. Пользуется сервером LLM нашего
  🎬 Neron AutoPrompter (Qwen 3.5 9B, скачается сам).
- **🎞 Neron H3 Блок** — один отрезок: свой текст, свои картинки, свои LoRA.
- **🎨 Neron H3 Набор LoRA** — до 3 LoRA с силой, наборы цепляются друг за друга.

**Три способа работать** (процессы в `workflows/`)
1. **С автопромтером** — `Neron_H3_Story_AutoPrompter.json`: 🖼 Кадры + сценарий + 🎨 LoRA на весь ролик →
   📝 AutoPrompter → движок. Самый простой путь.
2. **Без автопромтера, блоками** — `Neron_H3_Story_Expert.json`: каждый отрезок пишешь сам в ноде 🎞 Блок, у каждого
   блока свои картинки и свои LoRA. Полный контроль.
3. **Совсем просто** — `Neron_H3_Story.json`: картинка + по тексту на блок прямо в движок.

Можно и смешать: с автопромтером в эксперте движка подключи 🎞 Блок к нужному отрезку — пустой текст оставляет
промпт автопромтера и добавляет LoRA этого блока, свой текст — заменяет промпт.

**Модели.** Качает сама: кнопка «📥 Модели» на движке (окно открывается само, если чего-то не хватает), докачка
после обрыва, проверка места. Модель H3 — официальная страница Comfy-Org, турбо-LoRA — авторы lightx2v. Что уже
лежит (даже другая версия) — не качает. Все модели на «🤖 авто».

**Режимы**
- 🚀 **Быстро** — быстрая LoRA, 6 шагов (в эксперте 4 / 6 / 8 / 10). Мультики, 3D, проба сюжета.
- ⚡ **Турбо** — 12 шагов, по умолчанию.
- **Качество** — 40 шагов. **Максимум** — 50 шагов + модель bf16.

**Про скорость — честно.** Процесс настроен на **качество**: на «авто» движок берёт самую полную модель, что у тебя
есть (bf16, если скачана), и даже 🚀 Быстро работает на ней. Поэтому это долго. Замеры на компьютере автора
(RTX 5070 Ti 16 ГБ): Турбо int8, ролик 30 с (4 блока) вместе с автопромтером — 1 ч 18 мин; Турбо на полных
моделях (bf16) — 1 ч 30 мин; 🚀 Быстро 6 шагов,
вертикальный ролик 30 с — 44 мин. Ускорить можно:
- в ⚙ эксперте движка поставить свою, более лёгкую модель (int8 / fp8 — всё, что грузит обычный Load Diffusion
  Model);
- включить «быстрое внимание INT8»;
- 🚀 Быстро и меньше шагов; размер кадра поменьше; ролик короче или блоки длиннее (меньше стыков).

**Совет.** В сложных сценах (несколько героев, существо с картинки) первый кадр лучше давать **горизонтальным**:
с вертикальным H3 иногда чудит — например, белый тигр с картинки становится рыжим. Горизонтальный — держит.

**Нужно:** свежий ComfyUI (с нодой «Add Guide for MiniMax H3»), для автопромтера — папка 🎬 Neron AutoPrompter.

---

## 🇬🇧 English

**What it is.** A MiniMax H3 video **5–45 seconds long, with sound**. H3 itself makes up to ~15 s; longer, it
"drifts". The node builds the video as a **chain of blocks** and joins them so that no seams are visible — neither
in the picture nor in the sound: every next block starts from the last ~0.9 s of the previous one **together with
their sound** (the native ComfyUI node "Add Guide for MiniMax H3"); the overlap is cut out and the sound is blended
smoothly.

**Nodes**
- **🎬 Neron H3 Story** — the engine: video length 5–45 s, block 5–15 s (a maximum; the video is split into even
  blocks, up to 12); the model loads once for the whole video. 🔒 Keep appearance — the first frame goes as a
  reference into every block.
- **🖼 Neron H3 Frames** — four windows right inside the node: first frame, two middle frames, last frame. Click a
  window or drop a file onto it; pictures of any size. One wire instead of four "Load Image" nodes.
- **📝 Neron H3 Story AutoPrompter** — one scenario in your own words (any language) → a plan and a prompt for every
  part: continuation of the seam, actions by the second, physics, sound. Camera as in ⚡ Fixed Camera H3: AUTO — it
  stays still until the scenario asks for a move ("the camera circles her and stops at her side"). Middle pictures
  appear where the scenario says ("image 3") and keep their look to the end. It uses the LLM server of our
  🎬 Neron AutoPrompter (Qwen 3.5 9B, downloads itself).
- **🎞 Neron H3 Block** — one part: its own text, its own pictures, its own LoRAs.
- **🎨 Neron H3 LoRA Set** — up to 3 LoRAs with strength; sets chain into each other.

**Three ways to work** (workflows in `workflows/`)
1. **With the AutoPrompter** — `Neron_H3_Story_AutoPrompter.json`: 🖼 Frames + scenario + 🎨 LoRAs for the whole
   video → 📝 AutoPrompter → engine. The simplest way.
2. **Without the AutoPrompter, by blocks** — `Neron_H3_Story_Expert.json`: you write every part yourself in a
   🎞 Block node; every block has its own pictures and its own LoRAs. Full control.
3. **Very simple** — `Neron_H3_Story.json`: a picture + one text per block straight into the engine.

You can mix them too: with the AutoPrompter, in the engine's expert mode plug a 🎞 Block into the part you need —
an empty text keeps the AutoPrompter's prompt and adds that block's LoRAs; your own text replaces the prompt.

**Models.** Downloads them itself: the "📥 Models" button on the engine (the window opens by itself if something is
missing), resumes after a dropped connection, checks free space. The H3 model comes from the official Comfy-Org
page, the turbo LoRA from its authors, lightx2v. Whatever is already there (even another version) is not downloaded
again. All models are on "🤖 auto".

**Modes**
- 🚀 **Fast** — fast LoRA, 6 steps (4 / 6 / 8 / 10 in expert mode). Cartoons, 3D, trying out a story.
- ⚡ **Turbo** — 12 steps, the default.
- **Quality** — 40 steps. **Maximum** — 50 steps + the bf16 model.

**About speed — honestly.** The workflow is tuned for **quality**: on "auto" the engine takes the fullest model you
have (bf16, if downloaded), and even 🚀 Fast runs on it. That is why it takes long. Measured on the author's PC
(RTX 5070 Ti 16 GB): Turbo int8, a 30 s video (4 blocks) together with the AutoPrompter — 1 h 18 min; Turbo on full
models (bf16) — 1 h 30 min; 🚀 Fast 6 steps, a 30 s portrait video — 44 min. You can speed it up:
- in the engine's ⚙ expert mode pick your own lighter model (int8 / fp8 — anything the usual Load Diffusion Model
  loads);
- turn on "fast INT8 attention";
- 🚀 Fast and fewer steps; a smaller frame; a shorter video or longer blocks (fewer seams).

**Tip.** In complex scenes (several characters, a creature from a picture) it is better to give a **landscape**
first frame: with a portrait one H3 sometimes goes off — for example, a white tiger from the picture turns orange.
A landscape one holds.

**Needs:** a recent ComfyUI (with the "Add Guide for MiniMax H3" node); for the AutoPrompter — the
🎬 Neron AutoPrompter folder.

---

Нашёл ошибку или есть идея — напиши в комментариях на Civitai, это правда помогает.
Found a bug or have an idea — leave a comment on Civitai, it really helps.
