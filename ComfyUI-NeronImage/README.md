# 🖼 Neron Image — картинка по тексту (Krea 2)

## 🇷🇺 Русский

Одна нода: пишешь, что нарисовать (можно по-русски), получаешь картинку до 2K на **Krea 2 Turbo**. Модели официальные, от Comfy-Org.

**Что видно сразу:** что нарисовать · автопромтер · форма кадра · качество (1K / 1.5K / **2K**) · резкость · вариант.
**За ⚙ экспертом:** число картинок, шаги, CFG, сэмплер, настройки автопромтера, стиль (LoRA), «держать модели», выбор файлов.

### Автопромтер
- **🎨 до мелочей** (по умолчанию) — твои слова остаются как есть и идут первыми. Остальное промптер дописывает по правилам:
  - логика вместо клише: материалы и свет такие, какими были бы на самом деле;
  - эпоха и настроение держатся до конца;
  - **каждый** названный человек и механизм описан отдельно;
  - без отрицаний и пустых слов.
- **✨ расписать** — официальная инструкция Krea: сдержанно, без выдуманных деталей.
- **🌐 подправить** — только перевод и лёгкая шлифовка.
- **✍ как есть** — текст уходит в модель без изменений.

Автопромтер — это тот же Qwen3-VL 4B, что кодирует текст для Krea, так что качать ничего не надо. В режиме «расписать» инструкция официальная (Comfy-Org / Krea), наши правки две:
- текст на картинке — как у авторов Krea: только слова в кавычках;
- любой язык на входе превращается в английский промпт.

Готовый промпт видно внизу ноды и на выходе `prompt`. Если текст и режим не менялись, промптер второй раз не запускается. Кнопка **✏ Править итоговый промпт** ставит готовый промпт в поле для ручной правки. Длинный промпт удобно писать в **📝 Большом редакторе**: он открывается кнопкой под полем и сам, когда выбираешь «✍ как есть». Свой промпт можно подать и проводом во вход `prompt_text`.

> ⚠ **Где автопромтер не справится** (проверено вживую). Он маленький (4B) и отлично расписывает лёгкие сцены: один-два героя, пейзаж, предмет, механизм. Насыщенная сцена, где много персонажей и каждого надо прописать отдельно, ему не по силам: люди выходят похожими, и правками инструкции это не лечится. Для таких сцен напишите промпт сами (по-английски) или попросите большую ИИ (Gemini, ChatGPT, Claude…) и вставьте ответ с **✍ как есть**. Просьба для ИИ:
>
> *Перепиши мою идею в промпт для генератора картинок Krea 2 / FLUX, на английском. Правила: 1) мои слова — свято, главное — первым. 2) Логика, а не клише: материалы, машины, свет и одежда — как было бы на самом деле в этом мире и при его технике, а не «как обычно рисуют этот жанр». 3) Эпоха и настроение держатся до конца (будущее — значит электрический свет; мрачно — значит без тёплого уюта). 4) Всё, что названо, описано отдельно: КАЖДЫЙ человек — своим предложением (где в кадре, возраст, телосложение, лицо, волосы, одежда: крой, ткань, цвет, состояние; что делает); КАЖДЫЙ механизм — своим предложением (из чего, что двигает, куда идёт, в каком состоянии). Слова «разные», «непохожие», «несколько», «разного возраста» не писать — модель их не рисует. 5) Описывай, а не указывай; без отрицаний «no …». 6) Фон осмысленный, но остаётся фоном. Объём — сколько нужно. Только промпт, без пояснений. Идея: …*

### Резкость
После рисования края становятся чётче благодаря мягкой нерезкой маске. Новых деталей она не добавляет. По умолчанию **1.0**, проверено на 2K. Подбирайте под сюжет:
- крупный портрет — 0.5–0.8, чтобы кожа не «песочила»;
- пейзаж, ткань, техника — 1.0–1.3;
- 0 — картинка ровно как нарисовала модель.

### Модели — кнопка «📥 Модели» (Comfy-Org/Krea-2)
| Файл | Папка | Размер |
|---|---|---|
| `krea2_turbo_bf16.safetensors` | `models/diffusion_models` | 26,3 ГБ |
| `qwen3vl_4b_fp8_scaled.safetensors` | `models/text_encoders` | 4,9 ГБ |
| `qwen_image_vae.safetensors` | `models/vae` | 242 МБ |

Если bf16 нет, нода возьмёт сжатую Turbo (fp8 / int8 / nvfp4), если такая лежит, и напишет об этом.

**Почему Turbo, а не RAW.** Совет авторов Krea: «обучай на RAW, рисуй на Turbo». Turbo доведена по красоте и рисует до 2K за 8 шагов. RAW — сырая база для обучения LoRA: до 1K, 52 шага, CFG 3.5.

**Рецепт** (авторы Krea 2 Turbo): 8 шагов, CFG 1, euler / simple, сдвиг 1.15. Сдвиг ComfyUI ставит сам.

**Лицензия Krea 2:** community license авторов. Личное использование разрешено, для коммерции нужна отдельная лицензия у Krea.

---

## 🇬🇧 English

One node: write what to draw (in any language) and get a picture up to 2K with **Krea 2 Turbo**. The models are official, from Comfy-Org.

**Always visible:** what to draw · prompter · aspect · quality (1K / 1.5K / **2K**) · sharpness · seed.
**Behind ⚙ expert:** image count, steps, CFG, sampler, prompter settings, style LoRA, keep models loaded, model files.

### Prompter
- **🎨 every detail** (default) — your words stay as written and come first. The prompter adds the rest by these rules:
  - logic instead of clichés: materials and light are what they would really be;
  - the era and the mood hold to the end;
  - **every** named person and machine is described on its own;
  - no negations and no empty words.
- **✨ expand** — the official Krea instruction: restrained, no invented details.
- **🌐 polish** — translation and light polishing only.
- **✍ as is** — your text goes to the model unchanged.

It is the same Qwen3-VL 4B that encodes text for Krea, so there is nothing extra to download. In «expand» the instruction is the official one (Comfy-Org / Krea) with two changes:
- text in the picture follows the Krea authors' rule: only words in quotes;
- input in any language becomes an English prompt.

The final prompt is shown at the bottom of the node and on the `prompt` output. If the text and mode have not changed, the prompter does not run again. **✏ Edit final prompt** puts the prompt into the text field so you can edit it by hand. Long prompts are easiest in the **📝 Big prompt editor**: it opens from the button under the field, and by itself when you pick «✍ as is». A prompt can also come by wire into the `prompt_text` input.

> ⚠ **Where the prompter falls short** (tested live). It is small (4B) and great for light scenes: one or two characters, a landscape, an object, a machine. A busy scene with many characters, each described separately, is beyond it: the people come out alike, and no instruction tweak fixes that. For such scenes write the prompt yourself (in English) or ask a big AI (Gemini, ChatGPT, Claude…) to describe *every character separately and differently*, then paste its answer with **✍ as is**.

### Sharpness
After drawing, a gentle unsharp mask makes the edges crisper without adding new detail. The default is **1.0**, tested at 2K. Tune it to the picture:
- close-up portraits — 0.5–0.8, so the skin does not look grainy;
- landscapes, fabric, machines — 1.0–1.3;
- 0 — exactly as the model drew it.

### Models — the «📥 Models» button (Comfy-Org/Krea-2)
- `krea2_turbo_bf16` — 26.3 GB, goes to `models/diffusion_models`;
- `qwen3vl_4b_fp8_scaled` — 4.9 GB, goes to `models/text_encoders`;
- `qwen_image_vae` — 242 MB, goes to `models/vae`.

If bf16 is missing, the node uses a compressed Turbo (fp8 / int8 / nvfp4) when one is present and says so.

**Why Turbo, not RAW.** The Krea authors' advice: «train on RAW, run on Turbo». Turbo is tuned for looks and draws up to 2K in 8 steps. RAW is a base model for training LoRAs: up to 1K, 52 steps, CFG 3.5.

**Recipe** (Krea 2 Turbo authors): 8 steps, CFG 1, euler / simple, shift 1.15. ComfyUI sets the shift itself.

**Krea 2 license:** the authors' community license. Personal use is allowed; commercial use needs a separate license from Krea.
