# restore_studio

Английская версия: [README_EN.md](README_EN.md).

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
