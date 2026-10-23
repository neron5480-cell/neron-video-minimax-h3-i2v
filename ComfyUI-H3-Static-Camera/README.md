# ⚡ H3 Static Camera

[🇬🇧 English below](#english)

Три ноды для MiniMax H3 (меню `AIVideoPostprocessing`):

| Нода | Что делает |
|---|---|
| **⚡ Fixed Camera H3 Presets** | Управление камерой H3: авто или пресеты (фронт, слева, справа, сзади, сверху, снизу), план (общий / средний / крупный), дистанция. Работает с автопромтером или сама по себе, без LLM. Выдаёт готовый промпт, раскадровку и число кадров. |
| **Smart Load & Resize Image** | Загрузка картинки и подгонка размера: пресеты, соотношение сторон, вручную или по мегапикселям, с кратностью. |
| **Manual Color & Upscale Panel** | Яркость, контраст, насыщенность, резкость и необязательный AI-апскейл. Апскейл работает, только если выбрано **Enabled / Вкл**. |

Системный промпт для режима камеры лежит в папке `prompts`.

**Модели апскейла** кладутся в `ComfyUI/models/upscale_models/`.

**Установка:** одной ссылкой через Manager (см. [README в корне](../README.md)) или скопируйте папку `ComfyUI-H3-Static-Camera` в `ComfyUI/custom_nodes/`.

**Воркфлоу:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.

---

## English

Three nodes for MiniMax H3 (menu `AIVideoPostprocessing`):

| Node | What it does |
|---|---|
| **⚡ Fixed Camera H3 Presets** | H3 camera control: auto or presets (front, left, right, back, top, bottom), framing (wide / medium / close-up), distance. Works with the autoprompter or on its own, without an LLM. Outputs a ready prompt, a storyboard and the frame count. |
| **Smart Load & Resize Image** | Loads an image and fits its size: presets, aspect ratio, manual or by megapixels, with a size multiple. |
| **Manual Color & Upscale Panel** | Brightness, contrast, saturation, sharpness and optional AI upscale. The upscale runs only when **Enabled / Вкл** is selected. |

The system prompt for the camera mode is in the `prompts` folder.

**Upscale models** go to `ComfyUI/models/upscale_models/`.

**Install:** one link via Manager (see the [root README](../README.md)) or copy the `ComfyUI-H3-Static-Camera` folder into `ComfyUI/custom_nodes/`.

**Workflows:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.
