# restore_studio

> 🇷🇺 Русская версия — ниже. 🇬🇧 English version — at the bottom.

Кастомные узлы для ComfyUI: реставрация, раскраска и апскейл старых фотографий.

## Что внутри

| Узел | Назначение |
|---|---|
| `Restore Studio` | Основная обработка: апскейл, шумодав, автокоррекция, раскраска, восстановление лиц |
| `Live Preview` | Предпросмотр результата в реальном времени, без нажатия Queue |

Оба узла автономны. Их можно вытащить и вставить в любой другой воркфлоу — внешних зависимостей нет.

## Возможности Restore Studio

- Апскейл (модель подключается снаружи через `UpscaleModelLoader`)
- Авто-баланс белого и авто-уровни
- Шумодав и удаление точек/царапин
- Восстановление лиц через CodeFormer
- Раскраска чёрно-белых фото через DDColor
- Яркость, контраст, насыщенность, резкость
- Баланс RGB-каналов
- Пресеты: Old B&W Photo, Portrait, Landscape, Film Look, Vintage, Manual

## Возможности Live Preview

- Показывает результат в большом окне
- Реагирует на движение ползунков в реальном времени
- Не требует нажатия Queue
- Работает через собственный HTTP-эндпоинт

## Установка

1. Скачай репозиторий: кнопка **Code → Download ZIP**
2. Распакуй архив
3. Скопируй папку `restore_studio` в:

```
ComfyUI/custom_nodes/
```

Должно получиться:

```
ComfyUI/custom_nodes/restore_studio/
```

4. Перезапусти ComfyUI

## Модели CodeFormer

Все файлы из релиза [v0.1.0](https://github.com/sczhou/CodeFormer/releases/tag/v0.1.0) кладутся в:

```
ComfyUI/custom_nodes/restore_studio/models/
```

| Файл | Ссылка |
|---|---|
| `codeformer.pth` | [скачать](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth) |
| `detection_Resnet50_Final.pth` | [скачать](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/detection_Resnet50_Final.pth) |
| `parsing_parsenet.pth` | [скачать](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/parsing_parsenet.pth) |
| `yolov5l-face.pth` | [скачать](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/yolov5l-face.pth) |

Папку `models` создай вручную, если её нет.

Итоговая структура:

```
ComfyUI/custom_nodes/restore_studio/
  models/
    codeformer.pth
    detection_Resnet50_Final.pth
    parsing_parsenet.pth
    yolov5l-face.pth
```

## Параметры Restore Studio

| Параметр | Описание |
|---|---|
| `preset` | Готовый пресет или Manual для ручного управления |
| `FACE RESTORE / ЛИЦА` | Вкл/выкл восстановление лиц |
| `FACE STRENGTH` | Сила восстановления лиц |
| `FACE SHARPEN` | Резкость лиц |
| `AUTO WB` | Авто-баланс белого |
| `AUTO LEVELS` | Авто-уровни |
| `DENOISE` | Шумоподавление |
| `DESPECKLE` | Удаление точек и царапин |
| `COLORIZE` | Раскраска чёрно-белых фото |
| `COLORIZE STRENGTH` | Насыщенность раскраски |
| `BRIGHTNESS` | Яркость |
| `CONTRAST` | Контраст |
| `SATURATION` | Насыщенность |
| `SHARPNESS` | Резкость |
| `RGB RED / GREEN / BLUE` | Баланс каналов |
| `UPSCALE SCALE` | Коэффициент увеличения (2 = x2) |
| `UPSCALE SHARPEN` | Резкость после апскейла |

## Использование

1. Добавь узел `Restore Studio` на холст
2. Подключи `image` (обязательно) и `upscale_model` (опционально)
3. Настрой параметры
4. Подключи выход `IMAGE` к следующему узлу или к `SaveImage`
5. Для предпросмотра добавь `Live Preview` и соедини с выходом `Restore Studio`

## Примечания

- Если `FACE RESTORE` выключен — модели CodeFormer не задействуются, их можно не скачивать
- `Live Preview` может замедлять работу на слабой видеокарте. Отключается через правый клик → **Mute** или **Bypass**
- Для других узлов (например, Facerestore CF или ReActor) те же модели иногда кладут в `ComfyUI/models/facerestore_models/`. Для этого узла путь другой — внутри его собственной папки в `custom_nodes`

## Лицензия

MIT — см. [LICENSE](../LICENSE).

## Благодарности

- [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) — модели восстановления лиц

---

# restore_studio (EN)

> 🇬🇧 English version. 🇷🇺 Русская версия — выше.

Custom nodes for ComfyUI: restoration, colorization and upscaling of old photos.

## Contents

| Node | Purpose |
|---|---|
| `Restore Studio` | Main processing: upscaling, denoising, auto-correction, colorization, face restoration |
| `Live Preview` | Real-time preview without pressing Queue |

Both nodes are self-contained. You can pull them out and drop them into any other workflow — no external dependencies.

## Restore Studio features

- Upscaling (model is connected from outside via `UpscaleModelLoader`)
- Auto white balance and auto levels
- Denoise and despeckle
- Face restoration via CodeFormer
- Colorization of black-and-white photos via DDColor
- Brightness, contrast, saturation, sharpness
- RGB channel balance
- Presets: Old B&W Photo, Portrait, Landscape, Film Look, Vintage, Manual

## Live Preview features

- Shows the result in a large window
- Reacts to slider movement in real time
- No need to press Queue
- Works via its own HTTP endpoint

## Installation

1. Download the repository: **Code → Download ZIP**
2. Unpack the archive
3. Copy the `restore_studio` folder into:

```
ComfyUI/custom_nodes/
```

The result should be:

```
ComfyUI/custom_nodes/restore_studio/
```

4. Restart ComfyUI

## CodeFormer models

All files from release [v0.1.0](https://github.com/sczhou/CodeFormer/releases/tag/v0.1.0) go into:

```
ComfyUI/custom_nodes/restore_studio/models/
```

| File | Link |
|---|---|
| `codeformer.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth) |
| `detection_Resnet50_Final.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/detection_Resnet50_Final.pth) |
| `parsing_parsenet.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/parsing_parsenet.pth) |
| `yolov5l-face.pth` | [download](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/yolov5l-face.pth) |

Create the `models` folder manually if it does not exist.

Full structure:

```
ComfyUI/custom_nodes/restore_studio/
  models/
    codeformer.pth
    detection_Resnet50_Final.pth
    parsing_parsenet.pth
    yolov5l-face.pth
```

## Restore Studio parameters

| Parameter | Description |
|---|---|
| `preset` | Ready-made preset or Manual for full control |
| `FACE RESTORE` | Enable/disable face restoration |
| `FACE STRENGTH` | Face restoration strength |
| `FACE SHARPEN` | Face sharpening |
| `AUTO WB` | Auto white balance |
| `AUTO LEVELS` | Auto levels |
| `DENOISE` | Denoising |
| `DESPECKLE` | Remove specks and scratches |
| `COLORIZE` | Colorize black-and-white photos |
| `COLORIZE STRENGTH` | Colorization saturation |
| `BRIGHTNESS` | Brightness |
| `CONTRAST` | Contrast |
| `SATURATION` | Saturation |
| `SHARPNESS` | Sharpness |
| `RGB RED / GREEN / BLUE` | Channel balance |
| `UPSCALE SCALE` | Upscale factor (2 = x2) |
| `UPSCALE SHARPEN` | Sharpening after upscale |

## Usage

1. Add the `Restore Studio` node to the canvas
2. Connect `image` (required) and `upscale_model` (optional)
3. Adjust the parameters
4. Connect the `IMAGE` output to the next node or to `SaveImage`
5. For preview, add `Live Preview` and connect it to the `Restore Studio` output

## Notes

- If `FACE RESTORE` is off, CodeFormer models are not used and do not need to be downloaded
- `Live Preview` may slow down weak GPUs. Disable via right-click → **Mute** or **Bypass**
- For other nodes (such as Facerestore CF or ReActor), the same models are sometimes placed in `ComfyUI/models/facerestore_models/`. For this node the path is different — inside its own folder in `custom_nodes`

## License

MIT — see [LICENSE](../LICENSE).

## Credits

- [sczhou/CodeFormer](https://github.com/sczhou/CodeFormer) — face restoration models
