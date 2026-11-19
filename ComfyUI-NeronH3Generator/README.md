# 🎥 Neron H3 Generator — Бланк / Form

## 🇷🇺 Русский

**Что это.** Генератор видео со звуком на MiniMax H3. **Мотор — Neron MiniMax H3 Generator (Lite) без изменений**
(файлы `pipeline.py`, `hd.py`, `frames.py`, `memory.py`, `lora_cache.py` — копии один в один). Новое — вид в стиле
бланка и полоса хода работы.

**Новичок видит:**
- 🎬 **Режим** — Турбо (8 шагов) · Обычный (20) · Баланс HD · Чисто HD.
- 📐 **Размер** — пресеты по паспорту модели (короткая сторона 768). Нестандартный размер даёт глюки.
- ⏱ **Длина.** Подключил к `prompt` автопромтер (🎬 Neron H3 AutoPrompter — Бланк или 🎬 Neron AutoPrompter) —
  нода **сама протягивает** его `frames_count` → `length_in`, свой ползунок прячет и пишет «10 с · 243 кадра».
  Длина задаётся в одном месте — на бланке. Без автопромтера — свой ползунок секунд.
- 🖼 **Картинки** — сначала один слот `ref_image_0`; подключил — появляется следующий (до 4). Нет картинок — текст → видео.
- ⏳ **Ход работы** — этапы (модель → текст → генерация → раскодировка → звук; в HD ещё увеличение), полоса с
  бегущим бликом, шаг сэмплера, сколько прошло и примерно сколько осталось, в конце «Готово за …» и короткий отчёт.

**⚙ эксперт:** свой размер, 3 LoRA, модели, шаги, сид, плитка раскодировки, очистка памяти после запуска; сверху
появляются входы видео-образца, звука-образца и размера.

**Имена полей те же, что у Lite** — схема переносится значениями один в один. Выходы: `video`, `audio`,
`last_frame`, `frames_count`.

**Установка.** Скопируй папку `ComfyUI-NeronH3Generator` в `ComfyUI/custom_nodes/` и перезапусти ComfyUI.
Нода в меню **Neron/H3**. Ни от одной другой папки не зависит.

---

## 🇬🇧 English

**What it is.** A video-with-sound generator on MiniMax H3. **The engine is Neron MiniMax H3 Generator (Lite),
unchanged** (`pipeline.py`, `hd.py`, `frames.py`, `memory.py`, `lora_cache.py` are exact copies). New: a form-style
look and a progress bar.

**A beginner sees:**
- 🎬 **Mode** — Turbo (8 steps) · Normal (20) · Balance HD · Clean HD.
- 📐 **Size** — presets on the model passport (short side 768). Odd sizes cause glitches.
- ⏱ **Length.** Connect an autoprompter to `prompt` (🎬 Neron H3 AutoPrompter — Form or 🎬 Neron AutoPrompter) — the
  node **wires** its `frames_count` → `length_in` by itself, hides its own slider and shows "10 s · 243 frames". The
  length is set in one place — on the form. Without an autoprompter — its own seconds slider.
- 🖼 **Pictures** — one `ref_image_0` slot at first; connect it and the next appears (up to 4). No pictures — text to video.
- ⏳ **Progress** — stages (model → text → generating → decoding → sound; HD also upscale), a bar with a moving
  shine, the sampler step, elapsed and estimated time left, and at the end "Done in …" with a short report.

**⚙ expert:** custom size, 3 LoRAs, models, steps, seed, decode tile, memory cleanup after the run; reference video,
reference audio and size inputs appear at the top.

**Same field names as Lite** — a workflow carries over value for value. Outputs: `video`, `audio`, `last_frame`,
`frames_count`.

**Install.** Copy the `ComfyUI-NeronH3Generator` folder into `ComfyUI/custom_nodes/` and restart ComfyUI. The node
is in the **Neron/H3** menu. Depends on no other folder.
