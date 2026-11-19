# 🎬 Neron H3 AutoPrompter — Бланк / Form

## 🇷🇺 Русский

**Что это.** Бланк промпта и автопромтер H3 в одной ноде. H3 слушается только **очень подробного** промпта, и лучше
всего **по-английски**: русский текст модель начинает «проговаривать» вслух (проверено). Ты коротко заполняешь
участки — хоть по-русски, — а LLM расписывает их в подробный английский промпт в **родном формате H3**
(`summary`, `subject_definitions`, `integrated_multimodal_description`, `overall_soundscape`, `non_diegetic_music`).

**Новичок видит только бланк:**
- ⏱ **Длина ролика** (1–15 с). Кадры по сетке модели уходят в движок сами: `frames_count` → `length_in`.
- 🌍 Место и время · 👤 Герои и механизмы (каждый с новой строки; у машин — стоит / едет) · 🎬 Действие (можно
  по секундам) · 🎥 Камера (словами — как написал, так и снимет; пусто — неподвижна) · 🔊 Звук сцены ·
  🗣 Речь (слова в кавычках; пусто или «нет» — никто не говорит) · 🎵 Музыка (пусто — нет) · 🖼 Картинки.
- Внизу **«Что уйдёт в движок»** — после ▶ Run здесь готовый промпт от LLM и кнопка «Копировать».
- Плашка **RU / EN** — язык надписей. Пресетов камеры и выбора режима нет: что написано в бланке — то и в промпте.
  Нет картинок — текст → видео.

**⚙ эксперт:** LLM вкл/выкл (выкл — бланк сразу в движок, без расписывания), модель, зрение (mmproj), системник,
лимит ответа, температура, окно памяти, слои на видеокарте, **выгрузка LLM после запуска (включена)**,
автоскачивание LLM; очистить бланк.

**Входы:** `image_0…2` (= `<Picture 1…3>`), `last_frame` — по желанию.
**Выходы:** `minimax_prompt` → `prompt` движка, `frames_count` → `length_in`, `img_0…2`, `last_frm` — дальше по схеме.
Те же, что у 🎬 Neron AutoPrompter (кроме `storyboard_json`), — встаёт на его место провод в провод.

**Мотор.** Своя копия проверенного кода автопромтера Neron (папка `llm/`): LLM **Qwen 3.5 9B** со зрением
(unsloth, Apache 2.0) качается сама в `models/LLM/`, `llama-server` скачивается и запускается сам, порт **8767**
(не мешает H3 Story и LTX). Системник — `llm/prompts/H3_Blank_Director_EN.txt`, написан под поля бланка. Свои
системники клади в ту же папку — они появятся в списке.

**Установка.** Скопируй папку `ComfyUI-NeronH3AutoPrompter` в `ComfyUI/custom_nodes/` и перезапусти ComfyUI.
Нода в меню **Neron/H3**.

---

## 🇬🇧 English

**What it is.** A prompt form and an H3 autoprompter in one node. H3 follows only **very detailed** prompts, best **in
English**: with Russian text the model starts speaking the prompt aloud (tested). You fill in the sections briefly —
in any language — and the LLM expands them into a detailed English prompt in **H3's native format**
(`summary`, `subject_definitions`, `integrated_multimodal_description`, `overall_soundscape`, `non_diegetic_music`).

**A beginner sees only the form:**
- ⏱ **Clip length** (1–15 s). Frames on the model's grid go to the engine by themselves: `frames_count` → `length_in`.
- 🌍 Place and time · 👤 Characters and machines (each on a new line; machines — parked / moving) · 🎬 Action
  (per second is fine) · 🎥 Camera (in words — shot as written; empty — static) · 🔊 Scene sound · 🗣 Speech (words
  in quotes; empty or "no" — nobody speaks) · 🎵 Music (empty — none) · 🖼 Pictures.
- At the bottom, **"What goes to the engine"** — after ▶ Run, the finished LLM prompt and a "Copy" button.
- The **RU / EN** switch — label language. No camera presets and no mode picker: what the form says is what the
  prompt says. No pictures — text to video.

**⚙ expert:** LLM on/off (off — the form goes straight to the engine, unexpanded), model, vision (mmproj), system
prompt, answer limit, temperature, context, GPU layers, **unload the LLM after the run (on)**, LLM auto download;
clear the form.

**Inputs:** `image_0…2` (= `<Picture 1…3>`), `last_frame` — optional.
**Outputs:** `minimax_prompt` → engine `prompt`, `frames_count` → `length_in`, `img_0…2`, `last_frm` — passed on.
Same as 🎬 Neron AutoPrompter (except `storyboard_json`), so it drops into its place wire for wire.

**Engine.** Its own copy of the proven Neron autoprompter code (`llm/` folder): the **Qwen 3.5 9B** vision LLM
(unsloth, Apache 2.0) downloads itself into `models/LLM/`, `llama-server` downloads and starts by itself, port
**8767** (does not clash with H3 Story or LTX). System prompt — `llm/prompts/H3_Blank_Director_EN.txt`, written for
the form's fields. Put your own system prompts in the same folder — they appear in the list.

**Install.** Copy the `ComfyUI-NeronH3AutoPrompter` folder into `ComfyUI/custom_nodes/` and restart ComfyUI.
The node is in the **Neron/H3** menu.
