# neron — ComfyUI custom nodes & workflows

> ru Русская версия — ниже. en English version — at the bottom.

Сборник кастомных узлов и воркфлоу для ComfyUI. 
Репозиторий разделен на две части: **новый пайплайн Neron Studio** (в отдельной папке) и **старые вспомогательные ноды** (в корне).

---

## 🚀 NERON STUDIO H3 PIPELINE (V1.0) — НОВОЕ

👉 **Все новые комбайны, воркфлоу и инструкции теперь лежат в папке [`Neron_Studio_H3`](./Neron_Studio_H3).**

Наш главный пайплайн для генерации видео и звука (MiniMax H3). Полный цикл: от подготовки кадра до финальной склейки. Без «лапши» из проводов.

**Состав нового пайплайна (5 нод):**
1.  **Start Frame (Interactive Image Processor)** — подготовка стартового кадра.
2.  **Neron AutoPrompter** — LLM-режиссер и камера-оператор.
3.  **Neron MiniMax H3 Generator** — сердце системы (вся генерация в одной ноде).
4.  **Neron Video Clarity** — пост-обработка (стабилизация, дефликер, без апскейла).
5.  **Video Combine** — финальная склейка.

*Инструкция по установке и модели — в README внутри папки `Neron_Studio_H3`.*

---

## 📦 Старые ноды (Legacy) — В КОРНЕ

Эти ноды остаются в корне репозитория для обратной совместимости. Если у вас уже настроены старые воркфлоу, они будут работать как прежде.

| Пакет (Папка в корне) | Описание | Статус |
| :--- | :--- | :--- |
| **[ComfyUI-H3-Lora-Selector](./ComfyUI-H3-Lora-Selector)** | Селектор LoRA для H3 | Старое |
| **[ComfyUI-H3-Static-Camera](./ComfyUI-H3-Static-Camera)** | Статичная камера для H3 | Старое |
| **[restore_studio](./restore_studio)** | Реставрация, раскраска и апскейл старых фото | Старое |
| **[workflow](./workflow)** | Готовые воркфлоу (JSON) для старых нод | Архив |

*(Обратите внимание: ноды `Interactive-Processor`, `dialog_autoprompter`, `minimax_h3_generator` и `NeronVideoClarity` в корне — это **старые версии**. Новые, переработанные версии этих же нод лежат в папке `Neron_Studio_H3`).*

---

## 💻 Установка
1. Склонируй репозиторий или скачай ZIP.
2. Для **нового пайплайна**: закинь папки из `Neron_Studio_H3` в `ComfyUI/custom_nodes/`.
3. Для **старых нод**: закинь нужные папки из корня в `ComfyUI/custom_nodes/`.
4. Перезапусти ComfyUI.

---

## 👨‍💻 Автор
* **Neron** (GitHub: [neron5480-cell](https://github.com/neron5480-cell), Civitai: [neron5480922](https://civitai.com/user/neron5480922))
* Свободно для использования. Ссылка на автора приветствуется.

---
---

# English version

## 🚀 NERON STUDIO H3 PIPELINE (V1.0) — NEW
👉 **All new combo-nodes, workflows, and instructions are now in the [`Neron_Studio_H3`](./Neron_Studio_H3) folder.**

Our main pipeline for video and audio generation (MiniMax H3). Full cycle: from start frame preparation to final combining. No spaghetti wiring.

**Pipeline Nodes (5):**
1.  **Start Frame**
2.  **Neron AutoPrompter**
3.  **Neron MiniMax H3 Generator**
4.  **Neron Video Clarity**
5.  **Video Combine**

## 📦 Legacy Nodes — IN THE ROOT
These nodes remain in the repository root for backward compatibility. 
*(Note: The `Interactive-Processor`, `dialog_autoprompter`, `minimax_h3_generator`, and `NeronVideoClarity` folders in the root are **old versions**. The new, refined versions are in `Neron_Studio_H3`).*

## 💻 Installation
1. Clone this repo or download ZIP.
2. For the **new pipeline**: move folders from `Neron_Studio_H3` into `ComfyUI/custom_nodes/`.
3. For **legacy nodes**: move desired folders from the root into `ComfyUI/custom_nodes/`.
4. Restart ComfyUI.
