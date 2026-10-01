# Neron Video MiniMax H3 I2V

**Готовый воркфлоу для генерации видео из картинки на модели MiniMax H3 в ComfyUI.**

Привет! Представляю рабочий процесс для генерации видео на модели MiniMax H3 в ComfyUI.

Это не набор разрозненных нод, а собранная схема — от загрузки картинки до готового видео. Всё протестировано вручную, в разных режимах, на разном железе. Ничего не падает, ничего не вылетает по памяти.

Внутри используются кастомные ноды. Я писал их сам, потому что нормальных аналогов не нашёл — либо не хватало функционала, либо работали нестабильно.

---

## Что внутри

- **Автопромптер** — короткий текст превращается в технический промпт для MiniMax H3.
- **Контроль камеры** — модель больше не летает, куда вздумается. Вы управляете.
- **Interactive Image Processor** — мини-фотошоп прямо в ноде. Превью в реальном времени.
- **Manual Color & Upscale Panel** — цветокоррекция и AI-апскейл с обработкой порциями.
- **До 5 слотов LoRA** — каждый включается отдельно, со своей силой.
- **RIFE** — интерполяция кадров 24 → 48 fps.
- **Режимы 8 / 20 шагов** — турбо (быстро) или обычный (стабильно).

---

## Требования к железу

| Уровень | VRAM | RAM |
|---|---|---|
| Минимум | **8 ГБ** | 16 ГБ + быстрый NVMe |
| Стандарт | 12 ГБ | 32 ГБ |
| Рекомендуется | 16 ГБ и больше | 32 ГБ и больше |

> **Проверено лично:** 8 ГБ VRAM / 16 ГБ RAM — базовый пайплайн работает.
> **Рекомендуется:** 12 ГБ VRAM — комфортная работа со всеми функциями.

**Скорость** (RTX 5070 Ti 16 ГБ, 48 ГБ RAM): 15 секунд, 1024×1024, без апскейла — около 6 минут.

---

## Установка

**1.** Полностью закройте ComfyUI.

**2.** Скопируйте три папки в `ComfyUI\custom_nodes\`:

- `ComfyUI-H3-Lora-Selector`
- `ComfyUI-H3-Static-Camera`
- `ComfyUI-Interactive-Processor`

**3.** Запустите ComfyUI заново.

**4.** Обновите интерфейс: `Ctrl + Shift + R`.

**5.** Откройте воркфлоу из папки `workflow/`.

**📥 Скачать:** https://github.com/neron5480-cell/neron-video-minimax-h3-i2v/releases/latest

**Полная инструкция** (модели, внешние ноды, troubleshooting) — в файле `README_INSTALL.txt`.

---

## Что нового в v3.0

- **Manual Color & Upscale Panel:** обработка порциями (без вылетов по памяти), автоматическое уменьшение порции при нехватке VRAM, fp16, режим `Fast`.
- **Interactive Image Processor:** чёткое превью, превью на всю высоту ноды, скрытие неиспользуемых полей.
- **Воркфлоу:** апскейл выполняется до RIFE (вдвое меньше кадров), RIFE вынесен в отдельный сабграф, очистка видеопамяти встроена в цепочку данных.
- **Контроль камеры:** перехват промпта после автопромптера, вписывание координат без переписывания текста.
- **5 слотов LoRA:** каждый включается отдельно, со своей силой.

---

## Лицензия

MIT License. Используйте свободно.

---

## Автор

**Roman (neron5480-cell)**
- GitHub: https://github.com/neron5480-cell
- Civitai: https://civitai.com/user/neron5480922

Если что-то не работает — пишите в комментариях. Я читаю.

---
---

# Neron Video MiniMax H3 I2V

**Complete MiniMax H3 Image-to-Video workflow for ComfyUI.**

Hi! This is a working workflow for generating video from an image using the MiniMax H3 model in ComfyUI.

It's not a pile of unrelated nodes — it's a complete pipeline from image upload to final video. Tested manually, in different modes, on different hardware. No crashes, no out-of-memory errors.

Custom nodes are included. I wrote them myself because I couldn't find any working alternatives — either functionality was missing or they were unstable.

---

## What's inside

- **Autoprompter** — short text turns into a technical MiniMax H3 prompt.
- **Camera control** — the model no longer flies wherever it wants. You decide.
- **Interactive Image Processor** — a mini-Photoshop right inside the node, with live preview.
- **Manual Color & Upscale Panel** — color correction and AI upscaling with chunked processing.
- **Up to 5 LoRA slots** — each one toggles independently with its own strength.
- **RIFE** — frame interpolation 24 → 48 fps.
- **8 / 20 step modes** — turbo (fast) or normal (stable).

---

## Hardware requirements

| Tier | VRAM | RAM |
|---|---|---|
| Minimum | **8 GB** | 16 GB + fast NVMe |
| Standard | 12 GB | 32 GB |
| Recommended | 16 GB or more | 32 GB or more |

> **Verified personally:** 8 GB VRAM / 16 GB RAM — base pipeline works.
> **Recommended:** 12 GB VRAM — comfortable operation with all features.

**Speed** (RTX 5070 Ti 16 GB, 48 GB RAM): 15 seconds, 1024×1024, no upscale — about 6 minutes.

---

## Installation

**1.** Close ComfyUI completely.

**2.** Copy the three folders into `ComfyUI\custom_nodes\`:

- `ComfyUI-H3-Lora-Selector`
- `ComfyUI-H3-Static-Camera`
- `ComfyUI-Interactive-Processor`

**3.** Start ComfyUI again.

**4.** Refresh the interface: `Ctrl + Shift + R`.

**5.** Open the workflow from the `workflow/` folder.

**📥 Download:** https://github.com/neron5480-cell/neron-video-minimax-h3-i2v/releases/latest

**Full instructions** (models, external nodes, troubleshooting) — in `README_INSTALL.txt`.

---

## What's new in v3.0

- **Manual Color & Upscale Panel:** chunked processing (no out-of-memory crashes), automatic chunk reduction on low VRAM, fp16, `Fast` mode.
- **Interactive Image Processor:** sharp preview, preview fills the node height, unused fields hidden.
- **Workflow:** upscaling now runs before RIFE (half the frames), RIFE moved into its own subgraph, VRAM cleanup wired into the data chain.
- **Camera control:** intercepts the prompt after the autoprompter, writes coordinates without rewriting your text.
- **5 LoRA slots:** each one toggles independently with its own strength.

---

## License

MIT License. Use freely.

---

## Author

**Roman (neron5480-cell)**
- GitHub: https://github.com/neron5480-cell
- Civitai: https://civitai.com/user/neron5480922

If something doesn't work — leave a comment. I read them.
