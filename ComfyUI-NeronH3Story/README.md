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

**What it is.** A MiniMax H3 video **5–45 s long, with sound**, made as a **chain of blocks** joined without visible
seams: every next block starts from the last ~0.9 s of the previous one **with its sound** (native "Add Guide for
MiniMax H3"); the overlap is cut and the audio crossfaded.

**Nodes:** 🎬 engine (5–45 s video, 5–15 s blocks, one model load, keep appearance) · 🖼 Frames (four windows inside
the node: first / two middle / last, click or drop, any size) · 📝 Story AutoPrompter (one scenario → a prompt per
part with timing, physics, sound; camera like Fixed Camera H3 — locked unless the scenario asks for a move; middle
pictures appear where the scenario says and keep their look) · 🎞 Block (own text, pictures, LoRAs) · 🎨 LoRA set.

**Three ways:** with the AutoPrompter (`Neron_H3_Story_AutoPrompter.json`), without it using 🎞 Blocks
(`Neron_H3_Story_Expert.json`), or simple prompts (`Neron_H3_Story.json`).

**Models** download themselves (📥 Models). **Modes:** 🚀 Fast 6 steps · ⚡ Turbo 12 (default) · Quality 40 ·
Maximum 50 + bf16.

**Speed, honestly:** tuned for **quality** — on auto it uses the fullest model you have (bf16 if present), even in
Fast. Author's PC (RTX 5070 Ti 16 GB): Turbo int8, 30 s (4 blocks) incl. AutoPrompter — 1 h 18 min; Turbo on full (bf16) models — 1 h 30 min; Fast 6 steps,
30 s portrait — 44 min. To speed up: a lighter model of your own in expert mode (int8 / fp8), INT8 fast attention,
Fast with fewer steps, a smaller frame, fewer seams.

**Tip:** in complex scenes give a **landscape** first frame — with a portrait one H3 sometimes drifts (e.g. a white
tiger from a picture turns orange); landscape holds.

**Needs:** a recent ComfyUI; for the AutoPrompter — the 🎬 Neron AutoPrompter folder.

---

Нашёл ошибку или есть идея — напиши в комментариях на Civitai, это правда помогает.
Found a bug or have an idea — leave a comment on Civitai, it really helps.
