# 🧩 Neron Сборка кадра — герой + место + поза (MiniMax H3 Image)

## 🇷🇺 Русский

Собирает кадр из картинок-образцов: **твой герой — в нужном месте — в нужной позе**, и это точно тот же герой (лицо, одежда, снаряжение, износ). Для картотеки фильма: героя делаешь один раз — дальше ставишь его куда угодно.

**Окна прямо в ноде** (нажми или перетащи файл, ✕ — убрать), без Load Image и проводов:
- **ГЕРОЙ** — лучше «паспорт героя» в полный рост;
- **МЕСТО** — свет и настроение кадра берутся отсюда;
- **ДОП. ОБРАЗЕЦ** — одежда, предмет, второй персонаж (подпиши, что это);
- **ПОЗА** — фото, набросок, кадр из фильма, 3D-манекен; нода её **размывает** — модель берёт только положение тела и ракурс.

**Новичку:** окна · «что происходит» (твоя просьба: что делает герой, где, во что одет — нода пишет только, какая картинка что значит) · форма кадра (🤖 как у места) · качество (2 / **4** / 8 Мп) · резкость · вариант. Длинный текст — **📝 Большой редактор**.
**⚙ Эксперт:** размытие позы, свой текст целиком, шаги / сэмплер, держать модели, файлы моделей.

**Шина (минимум проводов):** вход `cast` — 🗂 Картотека из H3 Story заполняет пустые окна; выход `cast` — герой, место и доп. образец одним проводом в 🎬 H3 Story (в видео тот же герой); выход `image` — первый кадр сцены.

**Модели — «📥 Модели»** (официально, Comfy-Org): `minimax_h3_image_pruned_bf16` (полная точность, 40,2 ГБ; нет её — берётся сжатая int8 / w4a8), `minimax_h3_image_vae_fp16`, текстовый энкодер Qwen3-VL 32B — **общий** с H3 Story / Engine / Заменой героя (есть — не качается). Рецепт официального шаблона: 6 шагов, CFG 1, euler / simple.

Идея «персонаж + место + поза» и размытие позы — из процесса FoxFurEssence «H3 Image Edit»; код наш, только родные ноды ComfyUI.

---

## 🇬🇧 English

Builds a frame from reference pictures: **your hero — in the right place — in the right pose**, and it is exactly the same hero. Make the hero once, then put him anywhere.

**Windows right in the node** (click or drop a file): HERO, PLACE, EXTRA (label it), POSE (blurred by the node, so only the body position and camera angle are taken).

**Beginner:** windows · «what happens» (just the gist; the node writes «keep the hero, put him into the place and the pose») · aspect (auto — like the place) · quality (2 / **4** / 8 MP) · sharpness · seed. **⚙ Expert:** pose blur, own full prompt, steps / sampler, keep models loaded, model files.

**Bus:** input `cast` (H3 Story Cast fills empty windows); output `cast` (the same references, one wire into 🎬 H3 Story); output `image` (the first frame).

**Models — «📥 Models»** (official, Comfy-Org): the MiniMax H3 Image model in bf16 (40.2 GB, full precision), its VAE, and the Qwen3-VL 32B text encoder shared with H3 (skipped if present). Official recipe: 6 steps, CFG 1, euler / simple.
