# 🌀 Neron H3 Engine — движок MiniMax H3

## 🇷🇺 Установка — три шага

1. Положи папку `ComfyUI-NeronH3Engine` в `ComfyUI/custom_nodes/` (у Comfy Desktop это своя папка custom_nodes; открой её через меню программы).
2. Перезапусти Comfy Desktop.
3. Открой `workflows/Neron_H3_Engine.json`. Больше ничего не надо настраивать: модели найдутся сами, недостающие докачаются с места обрыва.

Нужна ComfyUI **0.46.2 или новее** — движок использует встроенные ноды MiniMax H3.

**Кнопки на ноде:** **RU / EN** меняет весь процесс целиком (подписи, статусы, оформление), **▶ Создать видео** запускает генерацию. Всё остальное спрятано в штатном разделе ⚙ — туда зайти можно, но начинать не надо.

**Тема уже включена.** Она приходит вместе с процессом и уходит вместе с ним: открыл другую схему — ComfyUI снова обычный, без остаточных цветов. Тема переключается той же кнопкой RU/EN.

## 🇬🇧 Install — three steps

1. Put the `ComfyUI-NeronH3Engine` folder into `ComfyUI/custom_nodes/` (Comfy Desktop has its own custom_nodes folder; open it from the app menu).
2. Restart Comfy Desktop.
3. Open `workflows/Neron_H3_Engine.json`. Nothing else to set up: models are found automatically, missing ones resume downloading.

ComfyUI **0.46.2 or newer** is required — the engine uses the built-in MiniMax H3 nodes.

**Buttons on the node:** **RU / EN** switches the whole process (labels, statuses, look), **▶ Create video** runs the generation. Everything else lives in the native ⚙ section — you can open it, but you do not need to.

**The theme is already on.** It comes with the process and leaves with it: open another workflow and ComfyUI returns to its normal look with no leftover colours. The theme follows the RU/EN button.

---

## 🇷🇺 Что умеет движок

Это **только движок**. Автопромптера нет: напиши, что должно происходить в кадре, сам. Английский промпт даёт самый стабильный результат.

- **Пустой кадр** — ничего не подключай: получится видео по тексту (T2V).
- **Картинка** — подключи `Первый кадр`: получится видео, которое начинается с неё (I2V).
- **Первый и последний кадр** — подключи оба: движок свяжет их плавным движением.
- **Промежуточные кадры** — во время счёта в правом нижнем углу появляется раскадровка: начало, середина, конец. Видно, как ролик складывается, ещё до конца расчёта. На само видео превью не влияет.
- **Турбо и мощный режим.** Турбо — 8 шагов и лёгкий текстовый движок, быстро. Мощный — 20 шагов и полный текстовый движок, подробнее и медленнее. **Авто** выбирает сам по видеопамяти и оперативке; на 16 ГБ видеокарты это турбо.
- **Железо процесс определяет сам.** Размер кадра и число кадров приводятся к сетке модели; в обычном режиме их подбирать не надо.
- **Звук** родной, стерео, считается вместе с картинкой — отдельно подключать не надо. 24 кадра/сек, от ~5 до ~15 секунд: короче модель не умеет.

### Чтобы не клонировало героев

MiniMax H3 плохо понимает слова «разные», «несколько», «разного возраста». Если в кадре двое, описывай **каждого отдельным предложением**: где стоит, возраст, телосложение, лицо, волосы, одежда, что делает. Не пиши «two different men» — лучше «A man in a grey coat … Another man, older, in a dark jacket …». Имена и описания не должны конфликтовать. Ветку reference-видео движок не использует вообще — она как раз тянет к клонированию.

### Модели

| Файл | Папка | Размер |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | 19,5 ГБ |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | 14,6 ГБ |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | `models/text_encoders` | 25,3 ГБ (только мощный режим) |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | 3,0 ГБ |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | 577 МБ |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras` | 1,8 ГБ (только турбо) |

Всё официальное, от Comfy-Org и LightX2V. Если файл уже лежит в любой папке моделей — он будет использован. Обрывы докачки продолжаются с того же места; готовый файл переименовывается только после проверки.

---

## 🇬🇧 What the engine does

This is **the engine only**. There is no autoprompter: write what should happen in the frame yourself. An English prompt gives the most stable result.

- **Empty frame** — connect nothing: text-to-video (T2V).
- **Image** — connect `Starting frame`: the clip begins with it (I2V).
- **Both frames** — connect first and last: the engine links them with smooth motion.
- **Intermediate frames** — while rendering, a storyboard appears in the bottom-right corner: beginning, middle, end. You see the clip taking shape before the calculation finishes. Previews never change the video.
- **Turbo and power.** Turbo is 8 steps with the light text encoder — fast. Power is 20 steps with the full text encoder — more detailed and slower. **Auto** decides from VRAM and RAM; on a 16 GB card it picks turbo.
- **Hardware is detected by the process.** Frame size and length are snapped to the model grid; you do not need to tune them in normal use.
- **Audio** is native stereo, generated together with the picture — nothing extra to connect. 24 fps, from about 5 to about 15 seconds: the model cannot make anything shorter.

### Avoiding cloned characters

MiniMax H3 does not understand words like "different", "several", "of different ages". If there are two people in the shot, describe **each one in a separate sentence**: where they stand, age, build, face, hair, clothes, what they do. Do not write "two different men" — write "A man in a grey coat … Another man, older, in a dark jacket …". Names and descriptions must not conflict. The reference-video branch is never used — it is exactly what pulls the model toward cloning.

### Models

| File | Folder | Size |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | 19.5 GB |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | 14.6 GB |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | `models/text_encoders` | 25.3 GB (power only) |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | 3.0 GB |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | 577 MB |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras` | 1.8 GB (turbo only) |

All files are official, from Comfy-Org and LightX2V. If a file already exists in any model folder, it is reused. Interrupted downloads resume; a file is renamed into place only after it passes validation.
