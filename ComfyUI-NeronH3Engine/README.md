# 🌀 Neron H3 Engine — движок MiniMax H3

## 🇷🇺 Установка

1. Положи папку `ComfyUI-NeronH3Engine` в `ComfyUI/custom_nodes/`. У Comfy Desktop своя папка `custom_nodes` — открой её через меню программы.
2. Перезапусти Comfy Desktop.
3. Открой `workflows/Neron_H3_Engine.json`. Больше ничего настраивать не надо: модели найдутся сами, недостающие докачаются с места обрыва.

Нужна ComfyUI **0.46.2 или новее** — движок использует встроенные ноды MiniMax H3.

## 🇷🇺 Как работать

В схема прост: одна нода и одна кнопка запуска. Всё остальное — внутри панели ноды.

- **RU / EN** меняет весь процесс целиком: подписи, статусы, справку и цвета. Тема включается вместе со схемой и уходит, когда схемы нет. Другие процессы не трогаются.
- **Пресет** — быстрый выбор: обычный, быстрый, качество, кино, стык кадров. Если потом двигать ползунки, ручное значение главнее пресета.
- **Ползунки** — длительность и резкость. Точные числа, шаги, размер и прочее живут в разделе **⚙ эксперт**; там же можно включить свой размер кадра.
- **⚙ эксперт** — не только числа. Здесь выбираются файлы основной модели, текстового движка, видео- и звукового кодеков, турбо-LoRA и до пяти дополнительных лор. У каждой лоры свой переключатель, файл и сила от −3 до 3; включённые лоры ложатся на модель по порядку. Неподходящий файл пропускается, остальные продолжают работать. Если ничего не трогать, всё остаётся «по умолчанию» — как в проверенном готовом процессе.
- **Четыре окна кадров.** Положи картинки в окна «Первый», «Промежуточный 1», «Промежуточный 2», «Последний» — или просто перетащи файл в окно. Можно подключить и проводом. Один общий канал кадров устроен по принципу шины: один хозяин состояния, остальные читают.
- **Последний кадр** — отдельный выход. Подай его в следующий прогон, чтобы продолжить ролик той же сценой.
- **Длительность** от 5 до 15 секунд. Короче модель не умеет; 24 кадра в секунду, звук родной стерео.
- **Резкость** применяется к готовым кадрам перед сохранением. Значение `1.0` ничего не меняет и будет проверенным по умолчанию.

Итог видео появляется прямо в ноде, файл сохраняется в `output/NeronH3`. Раскадровка во время счёта показывает, как ролик складывается, и на само видео не влияет.

### 🇷🇺 Если в кадре двое

MiniMax H3 плохо понимает слова «разные», «несколько», «разного возраста». Опиши каждого отдельным предложением: где стоит, возраст, телосложение, лицо, волосы, одежда, что делает. Не пиши «two different men» — лучше «A man in a grey coat … Another man, older, in a dark jacket …». Ветку reference-видео движок не использует — она тянет к клонированию.

### 🇷🇺 Модели

| Файл | Папка | Размер |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | 19,5 ГБ |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | 14,6 ГБ |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | `models/text_encoders` | 25,3 ГБ, только качество |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | 3,0 ГБ |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | 577 МБ |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras` | 1,8 ГБ, только турбо |

Всё официальное, от Comfy-Org и LightX2V. Если файл уже лежит в любой папке моделей — он будет использован. Обрывы докачки продолжаются с того же места. Списки в режиме эксперта берутся из установленных папок моделей; кнопка «Обновить списки» показывает свежие файлы без перезапуска ComfyUI.

---

## 🇬🇧 Install

1. Put the `ComfyUI-NeronH3Engine` folder into `ComfyUI/custom_nodes/`. Comfy Desktop has its own `custom_nodes` folder; open it from the app menu.
2. Restart Comfy Desktop.
3. Open `workflows/Neron_H3_Engine.json`. Nothing else to set up: models are found automatically and missing files resume downloading.

ComfyUI **0.46.2 or newer** is required.

## 🇬🇧 How to use

The workflow is simple: one node, one run button. Everything else lives inside the node panel.

- **RU / EN** switches the whole process: labels, statuses, help and colours. The look follows this workflow and leaves when it is gone. Other processes are untouched.
- **Preset** is a quick choice: ordinary, fast, quality, cinema, seam. Moving a slider afterwards overrides the preset.
- **Sliders** set duration and sharpness. Exact numbers, steps and size live under **⚙ expert**; custom frame size is there too.
- **⚙ expert** is not only numbers. It holds the main diffusion model, text encoder, video and audio VAE, turbo LoRA and up to five extra LoRAs. Each extra LoRA has its own on/off switch, file and weight from −3 to 3; enabled LoRAs are applied to the model in order. A file that does not fit is skipped and the rest keep working. If you change nothing, everything stays on default — exactly like the tested ready workflow.
- **Four frame windows.** Drop pictures into First, Middle 1, Middle 2 and Last, or connect wires. The shared frame channel works like a bus: one owner of the state, everyone else reads it.
- **Last frame** is a separate output. Feed it into the next run to continue the same scene.
- **Duration** runs from 5 to 15 seconds. Shorter clips are not supported; 24 fps and native stereo audio.
- **Sharpness** is applied to finished frames before saving. `1.0` changes nothing and is the tested default.

The finished clip appears inside the node and the file is saved under `output/NeronH3`. The storyboard during rendering shows the clip taking shape and never changes the video.

### 🇬🇧 Avoiding cloned characters

MiniMax H3 does not understand words like "different", "several" or "of different ages". Describe each person in a separate sentence: where they stand, age, build, face, hair, clothes and action. Do not write "two different men" — write "A man in a grey coat … Another man, older, in a dark jacket …". The reference-video branch is never used because it pulls the model toward cloning.

### 🇬🇧 Models

| File | Folder | Size |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | 19.5 GB |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | 14.6 GB |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | `models/text_encoders` | 25.3 GB, quality only |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | 3.0 GB |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | 577 MB |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras` | 1.8 GB, turbo only |

All files are official, from Comfy-Org and LightX2V. Existing files in any model folder are reused. Interrupted downloads resume from the same place. Expert lists come from the installed model folders; the Refresh button shows newly added files without restarting ComfyUI.
