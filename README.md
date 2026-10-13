# neron — ComfyUI custom nodes & workflows

> 🇷🇺 Русская версия — ниже. 🇬🇧 English version — at the bottom.

Сборник кастомных узлов и воркфлоу для ComfyUI.

## Что внутри

| Пакет | Описание |
|---|---|
| [ComfyUI-H3-Lora-Selector](./ComfyUI-H3-Lora-Selector) | Селектор LoRA для H3 |
| [ComfyUI-H3-Static-Camera](./ComfyUI-H3-Static-Camera) | Статичная камера для H3 |
| [ComfyUI-Interactive-Processor](./ComfyUI-Interactive-Processor) | Интерактивный процессор |
| [neron_dialog_autoprompter](./neron_dialog_autoprompter) | Автопромптер для диалогов |
| [restore_studio](./restore_studio) | Реставрация, раскраска и апскейл старых фото |
| [workflow](./workflow) | Готовые воркфлоу |

## Установка

Каждый пакет ставится отдельно. Скопируй нужную папку в:

```
ComfyUI/custom_nodes/
```

Затем перезапусти ComfyUI.

## Требования

Зависимости у каждого пакета свои — смотри README внутри его папки. Общие требования:

- ComfyUI актуальной версии
- ComfyUI-Manager (рекомендуется)
- Python 3.10+

## Пакеты

### ComfyUI-H3-Lora-Selector

Селектор LoRA для моделей H3.

### ComfyUI-H3-Static-Camera

Узел статичной камеры для H3.

### ComfyUI-Interactive-Processor

Интерактивный процессор изображений.

### neron_dialog_autoprompter

Автопромптер для диалоговых сцен.

### restore_studio

Реставрация старых фотографий: апскейл, шумодав, удаление царапин, раскраска ч/б, восстановление лиц через CodeFormer, генеративная доработка через Flux Fill.

Включает узлы:
- `Restore Studio` — основная обработка
- `Live Preview` — предпросмотр в реальном времени без нажатия Queue

Полная инструкция по моделям и путям — в [README внутри папки](./restore_studio).

### workflow

Готовые воркфлоу для импорта в ComfyUI. Файлы `.json` перетаскиваются прямо в окно ComfyUI.

## Лицензия

MIT — см. [LICENSE](./LICENSE).

## Благодарности

- [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) — модели восстановления лиц
- [Comfy-Org](https://github.com/comfyanonymous/ComfyUI) — ComfyUI

---

# nerON — ComfyUI custom nodes & workflows (EN)

> 🇬🇧 English version. 🇷🇺 Русская версия — выше.

A collection of custom nodes and workflows for ComfyUI.

## Contents

| Package | Description |
|---|---|
| [ComfyUI-H3-Lora-Selector](./ComfyUI-H3-Lora-Selector) | LoRA selector for H3 |
| [ComfyUI-H3-Static-Camera](./ComfyUI-H3-Static-Camera) | Static camera for H3 |
| [ComfyUI-Interactive-Processor](./ComfyUI-Interactive-Processor) | Interactive processor |
| [neron_dialog_autoprompter](./neron_dialog_autoprompter) | Auto-prompter for dialogues |
| [restore_studio](./restore_studio) | Restoration, colorization and upscaling of old photos |
| [workflow](./workflow) | Ready-to-use workflows |

## Installation

Each package is installed separately. Copy the desired folder into:

```
ComfyUI/custom_nodes/
```

Then restart ComfyUI.

## Requirements

Dependencies differ per package — see the README inside each folder. General requirements:

- Up-to-date ComfyUI
- ComfyUI-Manager (recommended)
- Python 3.10+

## Packages

### ComfyUI-H3-Lora-Selector

LoRA selector for H3 models.

### ComfyUI-H3-Static-Camera

Static camera node for H3.

### ComfyUI-Interactive-Processor

Interactive image processor.

### neron_dialog_autoprompter

Auto-prompter for dialogue scenes.

### restore_studio

Restoration of old photos: upscaling, denoising, scratch removal, B&W colorization, face restoration via CodeFormer, generative refinement via Flux Fill.

Includes the nodes:
- `Restore Studio` — main processing
- `Live Preview` — real-time preview without pressing Queue

Full instructions on models and paths — in the [README inside the folder](./restore_studio).

### workflow

Ready-to-use workflows for import into ComfyUI. `.json` files can be dragged directly into the ComfyUI window.

## License

MIT — see [LICENSE](./LICENSE).

## Credits

- [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) — face restoration models
- [Comfy-Org](https://github.com/comfyanonymous/ComfyUI) — ComfyUI
