# 🖼 Interactive Image Processor

[🇬🇧 English below](#english)

Подготовка стартового кадра в одной ноде: загрузка картинки, изменение размера, цветокоррекция, **живой предпросмотр** прямо на ноде и необязательный AI-апскейл.

- Размер: пресеты, соотношение сторон, вручную или по мегапикселям, с кратностью.
- Цвет: яркость, контраст, насыщенность, резкость.
- AI-апскейл запускается, только если выбрано **Enabled / Вкл** и подключена модель апскейла.

**Выходы:** `IMAGE`, `MASK`, `width`, `height` · **Меню:** `AIVideoPostprocessing`

**Модели апскейла** кладутся в `ComfyUI/models/upscale_models/`.

**Установка:** одной ссылкой через Manager (см. [README в корне](../README.md)) или скопируйте папку `ComfyUI-Interactive-Processor` в `ComfyUI/custom_nodes/`.

**Воркфлоу:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.

> В пайплайне Neron Studio H3 используется своя, доработанная версия этой ноды — **🖼 Neron Studio Image Processor**. Это две разные ноды, они не мешают друг другу.

---

## English

Start-frame preparation in one node: image loading, resizing, colour correction, a **live preview** right on the node and optional AI upscale.

- Size: presets, aspect ratio, manual or by megapixels, with a size multiple.
- Colour: brightness, contrast, saturation, sharpness.
- AI upscale runs only when **Enabled / Вкл** is selected and an upscale model is connected.

**Outputs:** `IMAGE`, `MASK`, `width`, `height` · **Menu:** `AIVideoPostprocessing`

**Upscale models** go to `ComfyUI/models/upscale_models/`.

**Install:** one link via Manager (see the [root README](../README.md)) or copy the `ComfyUI-Interactive-Processor` folder into `ComfyUI/custom_nodes/`.

**Workflows:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.

> The Neron Studio H3 pipeline uses its own improved version of this node — **🖼 Neron Studio Image Processor**. They are two separate nodes and do not interfere with each other.
