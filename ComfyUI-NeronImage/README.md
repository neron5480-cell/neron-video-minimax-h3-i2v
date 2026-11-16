# 🖼 Neron Image — картинка по тексту (Krea 2)

## 🇷🇺 Русский

Одна нода: пишешь, что нарисовать (можно по-русски), получаешь картинку до 2K на **Krea 2 Turbo**. Модели официальные, от Comfy-Org.

**Что видно сразу:** что нарисовать · автопромтер · форма кадра · качество (1K / 1.5K / **2K**) · вариант.
**За ⚙ экспертом:** число картинок, шаги, CFG, сэмплер, настройки автопромтера, стиль (LoRA), «держать модели», выбор файлов.

### Автопромтер
- **✨ расписать** (по умолчанию) — переводит на английский и подробно расписывает: свет, кадр, материалы. Krea 2 лучше всего рисует по длинным подробным промптам.
- **🌐 подправить** — только перевод и лёгкая шлифовка.
- **✍ как есть** — текст уходит в модель без изменений.

Автопромтер — это тот же Qwen3-VL 4B, что кодирует текст для Krea, так что качать ничего не надо. Инструкция официальная (Comfy-Org / Krea), наши правки две:
- текст на картинке — как у авторов Krea: только слова в кавычках;
- любой язык на входе превращается в английский промпт.

Готовый промпт видно внизу ноды и на выходе `prompt`. Если текст и режим не менялись, промптер второй раз не запускается. Кнопка **✏ Править итоговый промпт** ставит готовый промпт в поле для ручной правки.

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

**Always visible:** what to draw · prompter · aspect · quality (1K / 1.5K / **2K**) · seed.
**Behind ⚙ expert:** image count, steps, CFG, sampler, prompter settings, style LoRA, keep models loaded, model files.

### Prompter
- **✨ expand** (default) — translates to English and describes in detail: light, framing, materials.
- **🌐 polish** — translation and light polishing only.
- **✍ as is** — your text goes to the model unchanged.

It is the same Qwen3-VL 4B that encodes text for Krea, so there is nothing extra to download. The instruction is the official one (Comfy-Org / Krea) with two changes:
- text in the picture follows the Krea authors' rule: only words in quotes;
- input in any language becomes an English prompt.

The final prompt is shown at the bottom of the node and on the `prompt` output. If the text and mode have not changed, the prompter does not run again. **✏ Edit final prompt** puts the prompt into the text field so you can edit it by hand.

### Models — the «📥 Models» button (Comfy-Org/Krea-2)
- `krea2_turbo_bf16` — 26.3 GB, goes to `models/diffusion_models`;
- `qwen3vl_4b_fp8_scaled` — 4.9 GB, goes to `models/text_encoders`;
- `qwen_image_vae` — 242 MB, goes to `models/vae`.

If bf16 is missing, the node uses a compressed Turbo (fp8 / int8 / nvfp4) when one is present and says so.

**Why Turbo, not RAW.** The Krea authors' advice: «train on RAW, run on Turbo». Turbo is tuned for looks and draws up to 2K in 8 steps. RAW is a base model for training LoRAs: up to 1K, 52 steps, CFG 3.5.

**Recipe** (Krea 2 Turbo authors): 8 steps, CFG 1, euler / simple, shift 1.15. ComfyUI sets the shift itself.

**Krea 2 license:** the authors' community license. Personal use is allowed; commercial use needs a separate license from Krea.
