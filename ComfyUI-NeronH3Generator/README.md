# 🎥 Neron H3 Generator — Бланк / Form

## 🇷🇺 Русский

**Что это.** Генератор видео со звуком на MiniMax H3 в стиле бланка, с полосой хода работы.

**Мотор (⚙, по умолчанию — официальный).** Официальный — по рецепту шаблонов ComfyUI: картинка — **якорный первый
кадр** (`MiniMaxH3ImageToVideo`, модель fl2va), без картинки — текст → видео, несколько образцов — модель **ref2va**
со своей турбо-LoRA (`MiniMaxH3ReferenceToVideo`); без сдвига сигм. От Lite взято только то, что даёт скорость:
раскодировка плитками под свободную видеопамять, кэш LoRA, очистка памяти (`pipeline.py` и др. — копии Lite без
изменений). Почему: Lite подаёт картинку модели fl2va как «образец» — со 2–5-й секунды модель «уплывает».
«Lite (как раньше)» оставлен для сравнения. HD-режимы пока работают на моторе Lite.
**Внимание (⚙):** sparse — официальный ускоритель H3 «Model Sparse Attention» (sol-attn; первые 20% шагов полные,
текст и звук — точно), полное — как в штатном процессе, INT8 — как в Lite.

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

**What it is.** A video-with-sound generator on MiniMax H3 with a form-style look and a progress bar.

**Engine (⚙, default — official).** Official follows the ComfyUI templates: a picture is an **anchored first frame**
(`MiniMaxH3ImageToVideo`, fl2va model), no picture — text to video, several references — the **ref2va** model with its
turbo LoRA (`MiniMaxH3ReferenceToVideo`); no sigma shift. From Lite only the speed parts: tiled decoding sized to free
VRAM, LoRA cache, memory cleanup (`pipeline.py` etc. are unchanged Lite copies). Why: Lite feeds the picture to the
fl2va model as a "reference" and the model drifts after 2–5 s. "Lite (as before)" is kept for comparison. HD modes
still run on the Lite engine.
**Attention (⚙):** sparse — the official H3 accelerator "Model Sparse Attention" (sol-attn; first 20% of steps full,
text and sound exact), full — as in the stock workflow, INT8 — as in Lite.

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
