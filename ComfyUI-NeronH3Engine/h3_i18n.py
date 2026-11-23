"""RU: Все human-readable строки движка. Один язык на весь процесс, без смешения.
EN: All human-facing strings of the engine. One language for the whole process.

RU: Язык приходит из кнопки RU/EN в узле и живет в браузере; сюда он передаётся
    вместе с запросом на генерацию.
EN: The language comes from the RU/EN button in the node and travels with the prompt.
"""

TEXT = {
    "ru": {
        "checking": "Проверяю модели H3…",
        "downloading": "Скачиваю недостающее:",
        "resume": "Продолжаю с места обрыва.",
        "loading": "Гружу модель в память…",
        "encoding": "Готовлю кадр и текст…",
        "sampling": "Считаю кадры:",
        "decoding": "Собираю видео…",
        "saving": "Сохраняю ролик…",
        "done": "Готово. Ролик сохранён.",
        "turbo": "турбо",
        "power": "мощный",
        "auto": "авто",
        "no_image": "Пустой кадр: считаю по тексту.",
        "with_image": "Есть стартовый кадр: считаю по картинке.",
        "mid_image": "Есть промежуточные кадры: ставлю их по ходу ролика.",
        "last_image": "Есть конечный кадр: свяжу его с первым.",
        "mode_turbo": "Выбран турбо-режим: 8 шагов, лёгкий текстовый движок.",
        "mode_power": "Выбран мощный режим: 20 шагов, полный текстовый движок.",
        "no_geometry": "Размер и длительность приведены к шагам модели.",
        "lora_ok": "Лора {n}: {name}, сила {w:.2f}.",
        "lora_skip": "Лора {n}: файл не подошёл, пропускаю.",
        "turbo_ok": "Турбо-лора: {name}, сила {w:.2f}.",
        "turbo_skip": "Турбо-лора не подошла, считаю без неё.",
        "preview": "Промежуточный кадр",
        "err_space": "На диске не хватило места под модели H3.",
        "err_net": "Не удалось скачать модель. Проверьте интернет; следующий запуск продолжит с обрыва.",
        "err_model": "Не удалось загрузить модель H3.",
        "err_prompt": "Напишите, что должно происходить в кадре.",
        "err_files": "Выберите файлы моделей в режиме эксперта или оставьте «по умолчанию».",
        "err_version": "Нужна ComfyUI 0.46.2 или новее (встроенные ноды MiniMax H3).",
    },
    "en": {
        "checking": "Checking H3 models…",
        "downloading": "Downloading missing files:",
        "resume": "Resuming from the last byte.",
        "loading": "Loading the model into memory…",
        "encoding": "Preparing the frame and text…",
        "sampling": "Rendering frames:",
        "decoding": "Building the video…",
        "saving": "Saving the clip…",
        "done": "Done. The clip is saved.",
        "turbo": "turbo",
        "power": "power",
        "auto": "auto",
        "no_image": "Empty frame: generating from text.",
        "with_image": "Starting frame present: generating from the image.",
        "mid_image": "Middle frames present: placing them along the clip.",
        "last_image": "Ending frame present: linking it to the first one.",
        "mode_turbo": "Turbo mode: 8 steps, light text encoder.",
        "mode_power": "Power mode: 20 steps, full text encoder.",
        "no_geometry": "Size and duration were snapped to the model grid.",
        "lora_ok": "Extra LoRA {n}: {name}, weight {w:.2f}.",
        "lora_skip": "Extra LoRA {n}: file did not fit, skipped.",
        "turbo_ok": "Turbo LoRA: {name}, weight {w:.2f}.",
        "turbo_skip": "Turbo LoRA did not fit, continuing without it.",
        "preview": "Intermediate frame",
        "err_space": "Not enough disk space for the H3 models.",
        "err_net": "Could not download the model. Check the connection; the next run resumes.",
        "err_model": "Could not load the H3 model.",
        "err_prompt": "Describe what should happen in the frame.",
        "err_files": "Pick model files in expert mode or leave them on default.",
        "err_version": "ComfyUI 0.46.2 or newer is required (built-in MiniMax H3 nodes).",
    },
}


def t(lang: str, key: str, **kw) -> str:
    lang = "ru" if str(lang).lower().startswith("ru") else "en"
    value = TEXT.get(lang, TEXT["en"]).get(key, TEXT["en"].get(key, key))
    try:
        return value.format(**kw)
    except Exception:
        return value
