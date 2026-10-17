# 🎬 NERON STUDIO — MiniMax H3 Pipeline

**Полноценный пайплайн для генерации видео и звука в ComfyUI. Собрано с нуля под H3.**
**A complete video & audio generation pipeline for ComfyUI. Built from scratch for H3.**

---

## 📖 О ПРОЕКТЕ / ABOUT

**Neron Studio** — это набор кастомных нод для ComfyUI, объединенных в единый конвейер. Мы убрали 30+ стандартных нод, заменив их на пять мощных комбайнов. Никакой «лапши» из проводов, только функционал, скорость и красота.

**Neron Studio** is a suite of custom ComfyUI nodes combined into a single pipeline. We replaced 30+ standard nodes with five powerful machines. No spaghetti wiring, just function, speed, and beauty.

### ✨ Главные принципы / Core Principles

*   **Одна нода = один комбайн.** Максимальная концентрация функционала.
*   **Гострабайтер (Go-on-Worker).** Ноды не держат память. Загрузили, отработали, выгрузили (VRAM и RAM чистые).
*   **Только H3.** Заточка под MiniMax H3, а не универсальная «солянка».
*   **Красота.** Фирменный стиль Neron Studio (коричневый бренд, цветные группы, двуязычный интерфейс).
*   **Кратность.** Видео всегда кратно 17 кадрам, картинка — 32 пикселям.

---

## ⛓ СОСТАВ ПАЙПЛАЙНА / PIPELINE

1. **Start Frame (Interactive Image Processor)** — загрузка, ресайз, цветокор, живое превью.
2. **Neron AutoPrompter** — LLM-режиссер + камера-оператор. Пишет промпт за тебя.
3. **Neron MiniMax H3 Generator** — сердце системы. Вся генерация в одной ноде (UNET, CLIP, VAE, LoRA, Sampler).
4. **Neron Video Clarity** — пост-обработка. Стабилизация, дефликер, RIFE (без апскейла).
5. **Video Combine** — склейка видео и звука (стандартная нода из VideoHelperSuite).

---

## 💻 ТРЕБОВАНИЯ / REQUIREMENTS

*   **VRAM:** Оптимум 16 GB (RTX 5070 Ti и выше).
*   **RAM:** 32 GB+ (именно столько жрет 15 секунд генерации).
*   **Диск:** NVMe SSD.
*   **Софт:** ComfyUI, ComfyUI-VideoHelperSuite (для склейки), ComfyUI-Frame-Interpolation (для RIFE в Clarity), ComfyUI-LLM-text-processor (движок для LLM).

---

## 📦 УСТАНОВКА / INSTALLATION

1. Скопируй папки `ComfyUI-Interactive-Processor`, `neron_dialog_autoprompter`, `neron_minimax_h3_generator`, `NeronVideoClarity` в `ComfyUI/custom_nodes/`.
2. Установи остальные зависимости через ComfyUI Manager (VideoHelperSuite, LLM-text-processor).
3. **Перезапусти ComfyUI** (не просто Refresh!).
4. Ищи ноды в меню: `Neron/H3`, `Neron/Video`, `AIVideoPostprocessing`.

---

## 🚀 БЫСТРЫЙ СТАРТ / QUICK START

1. Загрузи воркфлоу `Neron_H3_Optimized_Pipeline.json` или `neron_h3_mini.json`.
2. Поставь ноду `Start Frame`. Загрузи картинку, выставь размер.
3. Поставь `AutoPrompter` и подключи туда картинку. Опиши сцену словами.
4. Поставь `Generator`. Подключи промпт из Автопромптера. Выставь `Turbo` и `15` секунд.
5. Поставь `Clarity`. Подключи видео.
6. Жми **Queue**.

---

## ⚠️ ВАЖНО
*   **Апскейл не нужен.** H3 сама дорисовывает окружение под нужный формат.
*   **Память.** `FREE AFTER RUN` включен по умолчанию. Не отключайте его на картах 8-12 ГБ.
*   **Длина.** Рабочий диапазон — 5-15 секунд. Дальше 15 модель теряет связность сцены.

---

## 👨‍💻 АВТОР / AUTHOR

*   **Neron** — идеи, архитектура, тестирование.
*   **GitHub:** [neron5480-cell](https://github.com/neron5480-cell)
*   **Civitai:** [neron5480922](https://civitai.com/user/neron5480922)
