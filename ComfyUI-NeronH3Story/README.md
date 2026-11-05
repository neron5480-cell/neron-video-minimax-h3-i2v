# 🎬 Neron H3 Story — прототип / prototype (dev)

**RU.** Длинный ролик MiniMax H3 цепочкой блоков (до 4 блоков по 3–15 с).
- Блок 1 — с первого кадра. Блоки 2+ продолжают **хвост прошлого блока (~0,9 с) вместе со звуком**
  через родную ноду ComfyUI «Add Guide for MiniMax H3». При склейке перехлёст убирается, звук сводится плавно.
- **🔒 Сохранить внешний вид** (вкл.): первый кадр (или вход `appearance`) идёт образцом `<Picture 1>` в каждый блок.
- Модель грузится один раз на весь ролик, текстовый энкодер — один раз на все блоки.
- Промпты — проводами `prompt_1…prompt_4`: сколько подключено, столько блоков.
- Нужен свежий ComfyUI с нодой «Add Guide for MiniMax H3» и модели H3 (те же, что у Neron H3 Engine).
- Процесс: `workflows/Neron_H3_Story.json`. Замеров времени ещё нет.

**EN.** Long MiniMax H3 video as a chain of blocks. Blocks 2+ continue the previous block's tail (~0.9 s) with its
sound via the native "Add Guide for MiniMax H3" node; overlap removed, audio crossfaded. Keep appearance (on):
the first frame rides as `<Picture 1>` into every block. One model load per video. Needs a recent ComfyUI and the
H3 models used by Neron H3 Engine. Workflow: `workflows/Neron_H3_Story.json`. Not timed yet.
