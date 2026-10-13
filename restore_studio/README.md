# 🎨 Restore Studio

[English version below](#-english-version)  
*(Нажмите на ссылку выше, чтобы сразу перейти к английскому тексту)*

---

Комбайн для реставрации и обработки фотографий в ComfyUI. 
Собирает в одной ноде то, что обычно требует десятка сторонних блоков: чистку, цветокоррекцию, восстановление лиц, раскраску ч/б и качественный апскейл.

---

## ✨ Что умеет

### 🔬 Реставрация
- **auto_wb** — автоматический баланс белого. Эффективно убирает желтизну архивных снимков или паразитный синий оттенок.
- **auto_levels** — автоуровни. Умная растяжка контраста по перцентилям для возвращения глубины теням и свету.
- **denoise** — шумоподавление. Убирает пленочное зерно, цифровой шум и артефакты.
- **despeckle** — удаление мелких точек, пыли и царапин со сканов.

### 👤 Восстановление лиц
- **face_restore** — встроенное восстановление лиц через ReActor (поддерживает CodeFormer / GFPGAN).
- **face_restore_strength** — плавная регулировка силы восстановления.
- **face_restore_sharpen** — авторезкость ПОСЛЕ восстановления. Компенсирует «пластиковость» GFPGAN, возвращая текстуру кожи.

### 🎨 Раскраска
- **colorize** — автоматическая раскраска ч/б снимков через DDColor.
- **colorize_strength** — управление интенсивностью цвета (0.5 — приглушённо, 1.0 — полностью).

### 🎛 Цвет и тон
- **brightness / contrast / saturation / sharpness** — классический ползунковый фоторедактор.
- **rgb_r / rgb_g / rgb_b** — точечное смещение по каналам для настройки цветового оттенка (теплее/холоднее).

### 📐 Апскейл
- Модель подключается **снаружи** через стандартный блок `UpscaleModelLoader`.
- **upscale_scale** — во сколько раз увеличить изображение (от 1.0 до 4.0).
- **upscale_sharpen** — финальная резкость после масштабирования (обычно оставляется на 0).

### 🎁 Пресеты (Пакетные настройки в один клик)
- **📷 Old B&W Photo** — база для архивных снимков с автоматическим включением раскраски.
- **👤 Portrait** — фокус на идеальное восстановление и резкость лица.
- **A 🏞 Landscape** — пейзажи с усиленным контрастом и сочностью.
- **🎬 Film Look** — тёплое, глубокое кинематографичное тонирование.
- **📼 Vintage** — благородный выцветший винтажный эффект.
- **✋ Manual** — ручной режим, все ползунки разблокированы.

### 🖥 Live Preview (Интерактивный движок)
Отдельная нода, идущая в комплекте. Показывает результат в **большом окне** и реагирует на любые сдвиги ползунков **в реальном времени** — *без нажатия кнопки Queue*. Работает автономно через собственный HTTP-эндпоинт.

---

## 📦 Установка

1. Скопируйте папку `restore_studio` с вашего компьютера.
2. Вставьте её прямо в папку с кастомными нодами вашего ComfyUI:
   `ComfyUI/custom_nodes/`
3. Перезапустите ComfyUI. Папка интерфейса подтянется автоматически.

---
---

# 🎨 Restore Studio (English Version)

An all-in-one suite for photo restoration and processing inside ComfyUI. 
It combines tools that usually require ten separate nodes into a single block: cleaning, color correction, face restoration, b&w colorization, and high-quality upscaling.

---

## ✨ Features

### 🔬 Restoration
- **auto_wb** — Automatic white balance. Efficiently removes age-related yellowing or unwanted blue tints.
- **auto_levels** — Auto levels. Smart contrast stretching by percentiles to bring back depth to highlights and shadows.
- **denoise** — Noise reduction. Cleans up film grain, digital noise, and artifacts.
- **despeckle** — Removes tiny dots, dust, and micro-scratches from scans.

### 👤 Face Restoration
- **face_restore** — Built-in face restoration powered by ReActor (supports CodeFormer / GFPGAN).
- **face_restore_strength** — Smooth control over the face restoration intensity.
- **face_restore_sharpen** — Auto-sharpness applied AFTER face restoration. Compensates for the artificial "plastic" look of GFPGAN, restoring natural skin texture.

### 🎨 Colorization
- **colorize** — Automatic black-and-white image colorization via DDColor.
- **colorize_strength** — Controls color saturation (0.5 for muted retro tones, 1.0 for full color).

### 🎛 Color & Tone
- **brightness / contrast / saturation / sharpness** — Classic slider-based photo editor.
- **rgb_r / rgb_g / rgb_b** — Per-channel shifts to adjust the color temperature (warmer/cooler).

### 📐 Upscaling
- The upscale model connects **externally** via a standard `UpscaleModelLoader` node.
- **upscale_scale** — Determines how many times to enlarge the image (from 1.0 to 4.0).
- **upscale_sharpen** — Final sharpness filter applied after upscaling (usually kept at 0).

### 🎁 Presets (One-Click Batch Settings)
- **📷 Old B&W Photo** — Optimized baseline for archival photos with colorization enabled.
- **👤 Portrait** — Focused on perfect face restoration and crisp facial details.
- **A 🏞 Landscape** — Enhanced contrast and vibrant saturation for nature shots.
- **🎬 Film Look** — Warm, deep, and cinematic color grading.
- **📼 Vintage** — A beautiful faded retro effect with a warm tint.
- **✋ Manual** — Manual control mode, unlocking all sliders.

### 🖥 Live Preview (Interactive Engine)
A separate node included in the package. It displays the results in a **large window** and responds to any slider adjustments **instantly in real time** — *without having to click Queue*. Operates autonomously via a dedicated HTTP endpoint.

---

## 📦 Installation

1. Copy the `restore_studio` folder from your computer.
2. Paste it directly into your ComfyUI custom nodes directory:
   `ComfyUI/custom_nodes/`
3. Restart ComfyUI. The web interface folder will load automatically.
