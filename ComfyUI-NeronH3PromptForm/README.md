# 📝 Neron H3 Бланк промпта / Prompt Form

## 🇷🇺 Русский

**Что это.** H3 лучше всего работает с подробным промптом. Обычно его пишут одной «простынёй» и теряют половину:
забыли звук, не сказали про камеру, смешали двух героев в одну фразу. Бланк делит промпт на участки, и у каждого видно,
**что** сюда писать и **зачем**. Пишешь сам — это не автопромтер: ни моделей, ни сервера, ни видеопамяти.
Нода склеивает всё в один связный текст и отдаёт его проводом `prompt` в движок.

**Участки**
| | что сюда | зачем |
|---|---|---|
| 🌍 Место и время | эпоха, место, свет, погода, настроение | держит эпоху и настроение до конца ролика |
| 👤 Герои и механизмы | каждый с новой строки: внешность, одежда по эпохе | без этого модель путает и клонирует людей |
| 🎬 Действие | что происходит, по порядку; можно по секундам «0–2 с: …» | логика и порядок событий |
| 🎥 Камера | стоит, едет, откуда смотрит | иначе H3 сама гуляет камерой или режет план |
| 🔊 Звук сцены | что реально слышно в кадре | без этого ролик немой или звук не тот |
| 🗣 Речь | кто, что и каким голосом | |
| 🎵 Музыка | есть ли и какая; пусто — «Без музыки.» | отдельно от шумов |
| 🖼 Картинки | кто или что на `<Picture 1>`, `<Picture 2>`… | модель понимает, зачем ей образец |

- **⏱ Длина ролика** — ползунок сверху (1–15 с). Нода сама пишет её в начало промпта: «Длительность ролика —
  5 секунд (0–5 с).» Движки любят знать время. Ставь ту же длину, что в движке.
- Пустые участки в промпт не идут.
- Внизу — **«Что уйдёт в движок»**: ровно тот текст, что получит модель, и кнопка «Копировать».
- **Язык любой** — H3 одинаково понимает русский и английский. Плашка **RU / EN** меняет только надписи ноды
  (по умолчанию — язык твоего ComfyUI). Связки между участками нода берёт на языке твоего текста — промпт не
  превратится в смесь языков.
- `<Картинка 1>`, `<image 2>` нода сама превращает в `<Picture 1>`, `<Picture 2>` — так их узнаёт модель.
- ⚙ эксперт: выключить длину в начале промпта, связки («В кадре:», «Камера:»…) и «Без музыки.»; очистить бланк.

**Куда подключать.** Выход `prompt` → вход `prompt` движка H3 (например, 🎬 Neron H3 Engine — Hard).
Нода в меню **Neron/H3**.

**Установка.** Скопируй папку `ComfyUI-NeronH3PromptForm` в `ComfyUI/custom_nodes/` и перезапусти ComfyUI.
Нода ни от чего не зависит.

---

## 🇬🇧 English

**What it is.** H3 works best with a detailed prompt. People usually write one long wall of text and lose half of it:
forgot the sound, said nothing about the camera, merged two characters into one phrase. The form splits the prompt
into sections, each showing **what** goes there and **why**. You write it yourself — this is not an autoprompter:
no models, no server, no VRAM. The node joins everything into one coherent text and sends it by the `prompt` wire to
the engine.

**Sections**
| | what goes here | why |
|---|---|---|
| 🌍 Place and time | era, place, light, weather, mood | keeps the era and mood to the end of the clip |
| 👤 Characters and machines | each on a new line: look, period clothing | otherwise the model mixes and clones people |
| 🎬 Action | what happens, in order; per second is fine "0–2 s: …" | logic and order of events |
| 🎥 Camera | static, moving, where it looks from | otherwise H3 moves the camera or cuts on its own |
| 🔊 Scene sound | what is really heard in the frame | otherwise the clip is silent or sounds wrong |
| 🗣 Speech | who says what, in what voice | |
| 🎵 Music | whether there is any and what; empty — "No music." | kept apart from noises |
| 🖼 Pictures | who or what is on `<Picture 1>`, `<Picture 2>`… | the model understands what each reference is for |

- **⏱ Clip length** — the slider at the top (1–15 s). The node writes it at the start of the prompt: "Video duration:
  5 seconds (0–5 s)." Engines like to know the time. Set the same length as in the engine.
- Empty sections are skipped.
- At the bottom, **"What goes to the engine"** shows exactly the text the model gets, with a "Copy" button.
- **Any language** — H3 understands Russian and English equally. The **RU / EN** switch changes only the node's labels
  (default — your ComfyUI language). The links between sections follow the language of your text, so the prompt
  never becomes a mix of languages.
- `<Картинка 1>`, `<image 2>` become `<Picture 1>`, `<Picture 2>` — that is how the model recognises them.
- ⚙ expert: turn off the clip length at the start, the links ("In the frame:", "Camera:"…) and "No music."; clear the form.

**Where to connect.** The `prompt` output → the `prompt` input of an H3 engine (e.g. 🎬 Neron H3 Engine — Hard).
The node is in the **Neron/H3** menu.

**Install.** Copy the `ComfyUI-NeronH3PromptForm` folder into `ComfyUI/custom_nodes/` and restart ComfyUI.
The node depends on nothing else.
