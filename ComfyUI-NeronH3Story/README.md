# 🎬 Neron H3 Story — прототип / prototype (dev)

**RU.** Длинный ролик MiniMax H3 цепочкой блоков: длина ролика 5–45 с, длина блока 5–15 с (максимум; ролик делится на ровные блоки, до 12).
- Блок 1 — с первого кадра. Блоки 2+ продолжают **хвост прошлого блока (~0,9 с) вместе со звуком**
  через родную ноду ComfyUI «Add Guide for MiniMax H3». При склейке перехлёст убирается, звук сводится плавно.
- **🔒 Сохранить внешний вид** (вкл.): первый кадр (или вход `appearance`) идёт образцом `<Picture 1>` в каждый блок.
- Модель грузится один раз на весь ролик, текстовый энкодер — один раз на все блоки.
- Промпт и LoRA каждого блока — проводами `prompt_k` + `lora_k` (пара появляется по мере подключения). LoRA — новой нодой **🎨 Набор LoRA**; `lora_all` — LoRA на весь ролик. Модель грузится один раз, LoRA меняются по блокам.
- **🎞 Блок** — картинки, текст и LoRA блока одним проводом; движок: подключён `story` / «чайник» (картинка + промпты) / ⚙ эксперт (всё).
- Нужен свежий ComfyUI с нодой «Add Guide for MiniMax H3». Модели H3 нода качает сама (кнопка «📥 Модели», окно открывается само при нехватке): Comfy-Org/MiniMax-H3 + турбо-LoRA lightx2v/Minimax-h3-Turbo (8 шагов для ⚡ Турбо, 4-шаговая LoRA для 🚀 Быстро).
- Режимы: 🚀 Быстро (6 шагов на быстрой LoRA) · ⚡ Турбо (12, по умолчанию) · Качество (40) · Максимум (50 + bf16).
- Эксперт: звуковые образцы ref_audio_1…3 → <Audio N> в каждый блок.
- Процесс: `workflows/Neron_H3_Story.json`. Замеров времени ещё нет.

**EN.** Long MiniMax H3 video (5–45 s) as a chain of equal blocks (5–15 s max, up to 12) with per-block prompts and LoRA sets (🎨 LoRA set node; lora_all for the whole video). Blocks 2+ continue the previous block's tail (~0.9 s) with its
sound via the native "Add Guide for MiniMax H3" node; overlap removed, audio crossfaded. Keep appearance (on):
the first frame rides as `<Picture 1>` into every block. One model load per video. Needs a recent ComfyUI and the
H3 models used by Neron H3 Engine. Workflow: `workflows/Neron_H3_Story.json`. Not timed yet.
