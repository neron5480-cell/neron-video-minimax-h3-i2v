# neron — ComfyUI custom nodes & workflows

> ru Русская версия — ниже. en English version — at the bottom.

Сборник кастомных узлов и воркфлоу для ComfyUI. 
Здесь собраны как новые монолитные комбайны (Neron Studio), так и старые вспомогательные ноды.

---

## 🚀 NERON STUDIO PIPELINE (V1.0)

Наш главный пайплайн для генерации видео и звука (MiniMax H3). 
Полный цикл: от подготовки кадра до финальной склейки. Без «лапши» из проводов.

**Состав пайплайна (5 нод):**
1. **Start Frame (Interactive Image Processor)** — подготовка стартового кадра. Живое превью, ресайз, цветокор.
2. **Neron AutoPrompter** — LLM-режиссер и камера-оператор. Генерирует идеальный промпт.
3. **Neron MiniMax H3 Generator** — сердце системы. Вся генерация видео/звука в одной ноде.
4. **Neron Video Clarity** — пост-обработка (стабилизация, дефликер, RIFE). Работает без апскейла.
5. **Video Combine** — финальная склейка (стандартная нода VideoHelperSuite).

---

## 📦 Что внутри (Все пакеты)

| Пакет (Папка) | Описание | Статус |
| :--- | :--- | :--- |
| **[neron_minimax_h3_generator](./neron_minimax_h3_generator)** | 🎥 Генератор H3 (Все в одном: UNET, CLIP, VAE, LoRA) | **Новое** |
| **[NeronVideoClarity](./NeronVideoClarity)** | 🎬 Пост-обработка видео (Стабилизация, RIFE) | **Новое** |
| **[ComfyUI-Interactive-Processor](./ComfyUI-Interactive-Processor)** | 🖼 Умная загрузка и ресайз кадра (Start Frame) | **Новое** |
| **[neron_dialog_autoprompter](./neron_dialog_autoprompter)** | 🤖 Автопромптер (LLM + Управление камерой) | Активно |
| **[ComfyUI-H3-Lora-Selector](./ComfyUI-H3-Lora-Selector)** | Селектор LoRA для H3 | Старое |
| **[ComfyUI-H3-Static-Camera](./ComfyUI-H3-Static-Camera)** | Статичная камера для H3 | Старое |
| **[restore_studio](./restore_studio)** | Реставрация, раскраска и апскейл старых фото | Старое |
| **[workflow](./workflow)** | Готовые воркфлоу (JSON) для ComfyUI | Обновляется |

---

## 💻 Установка
1. Склонируй репозиторий или скачай ZIP.
2. Закинь нужные папки в `ComfyUI/custom_nodes/`.
3. Перезапусти ComfyUI.

---

## 👨‍💻 Автор
* **Neron** (GitHub: [neron5480-cell](https://github.com/neron5480-cell), Civitai: [neron5480922](https://civitai.com/user/neron5480922))
* Свободно для использования. Ссылка на автора приветствуется.

---
---

# English version

## 🚀 NERON STUDIO PIPELINE (V1.0)
Our main pipeline for video and audio generation (MiniMax H3). 
Full cycle: from start frame preparation to final combining. No spaghetti wiring.

**Pipeline Nodes (5):**
1. **Start Frame (Interactive Image Processor)** — start frame prep. Live preview, resize, color.
2. **Neron AutoPrompter** — LLM director & camera operator. Generates the perfect prompt.
3. **Neron MiniMax H3 Generator** — the core. All video/audio generation in one node.
4. **Neron Video Clarity** — post-processing (stabilization, deflicker, RIFE). No upscale.
5. **Video Combine** — final combine (standard VideoHelperSuite node).

## 📦 What's inside
*(See table above / Смотри таблицу выше)*

## 💻 Installation
1. Clone this repo or download ZIP.
2. Move the desired folders into `ComfyUI/custom_nodes/`.
3. Restart ComfyUI.
