# 🎬 Neron LTX Engine

**RU** · Генератор **LTX 2.5** одной нодой, собранный по процессу Neron «LTX 2.5 Pure 2K/3K». Видео и звук за один проход, первый / два промежуточных / последний кадр, плавность ×2. Внутри только встроенные ноды ComfyUI — никаких чужих паков.

**EN** · An **LTX 2.5** generator in one node, built on the Neron "LTX 2.5 Pure 2K/3K" workflow. Video and audio in one pass, first / two middle / last frames, smoothness ×2. Only ComfyUI built-in nodes inside — no third-party packs.

## Первый запуск / First run

1. Открой `workflows/Neron_LTX_Engine.json`.
2. Моделей нет — окно **📥 Модели** откроется само. Один раз: прими лицензию LTX 2.5 на Hugging Face и вставь токен (окно ведёт по шагам). Дальше нода сама скачает пакет (≈ 36 ГБ) с прогрессом и докачкой, и разложит файлы по папкам.
3. Подключи картинку, промпт — и **Run**.

EN: open the workflow; the **📥 Models** window opens by itself, accept the LTX 2.5 license once and paste a Hugging Face token; the node downloads the pack (≈ 36 GB, resumable) into the right folders.

## Входы и выходы / Inputs & outputs

| Вход / input | |
|---|---|
| `prompt` | что происходит — прозой, со звуком / what happens, as prose, with sound |
| `camera_prompt` | поведение камеры одной фразой (в начало промпта + повтор в конце) / camera sentence (start + end) |
| `first_frame` | первый кадр; нет — «текст → видео» / first frame; none = text to video |
| `mid_frame_1`, `mid_frame_2` | промежуточные кадры (сами — на 1/3 и 2/3) / middle frames (auto at 1/3, 2/3) |
| `last_frame` | последний кадр / last frame |

Выходы / outputs: `video` (готовое со звуком / ready, with sound), `audio`, `frames`, `fps`.

## Новичку видно / Beginner sees

Режим (Качество / Быстро), длительность, видеокарта (Авто). Всё остальное — под **⚙ эксперт**.

## Пакет моделей / Model pack

Список файлов — в `packs.json` (можно добавлять пакеты без правки кода):
`ltx-2.5-22b-distilled-transformer-comfy-int8-convrot`, `gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot`, `ltx-2.5-video-vae-bf16`, `ltx-2.5-audio-vae-bf16` (Lightricks/LTX-2.5) и `rife_v4.26` (Comfy-Org/Frame-Interpolation).

Токен Hugging Face хранится только на твоём компьютере: `ComfyUI/user/neron_ltx_engine.json` (или переменная `HF_TOKEN`).
