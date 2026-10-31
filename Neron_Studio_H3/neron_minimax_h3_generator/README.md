### ⚠️ ФИЗИЧЕСКИЕ ОГРАНИЧЕНИЯ МОДЕЛИ (Очень важно!)

MiniMax H3 — это **локальная, квантованная модель**. У нее есть жесткие пределы вычислительной мощности. 

- **Конфликт пропорций в Turbo-режиме:** Если вы подаете на вход вертикальную картинку (например, 9:16), а на выходе задаете горизонтальный формат (16:9), модель вынуждена сжимать исходник. На **8 шагах (Turbo)** у нее физически не хватает итераций, чтобы вылизать потерянные пиксели. Результат — «мыло» и пластилиновая кожа.
- **Как лечить:** 
  1. Давайте на вход картинки, близкие по пропорциям к выходу (горизонталь к горизонтали, вертикаль к вертикали).
  2. Если смена формата критична — переключайтесь в режим **Normal (20 шагов)**. Это даст модели время дорисовать детали.
  3. Не пытайтесь обмануть физику костылями (падинги, черные полосы). Модель просто отрендерит эти полосы.

---

### ⚠️ PHYSICAL MODEL LIMITATIONS (Very Important!)

MiniMax H3 is a **local, quantized model**. It has strict compute limits.

- **Aspect Ratio Conflict in Turbo Mode:** If you feed a portrait image (e.g., 9:16) but request a landscape output (16:9), the model is forced to compress the source. At **8 steps (Turbo)**, it physically lacks the iterations to redraw lost pixels. The result is blur and plastic-looking skin.
- **How to fix:**
  1. Feed images that match the target aspect ratio (landscape to landscape, portrait to portrait).
  2. If changing format is critical, switch to **Normal (20 steps)** mode. This gives the model time to redraw details.
  3. Do not try to cheat physics with crutches (padding, black bars). The model will just render those bars.

---

### ⚡ HD-РЕЖИМЫ (dev, тест) / HD MODES

**RU:** В списке «РЕЖИМ» добавлены ⚡ Быстро HD, Баланс HD и Чисто HD — полный размер модели за один прогон:
маленький черновик на быстрой модели → увеличение → короткий чистовик в полном размере. Размер — максимум
паспорта для формы пресета (16:9 → 1344×768). Образцы (`ref_image_0…3`) и AutoPrompter работают как раньше.
Замер (RTX 5070 Ti 16 ГБ, модели int8, 10 с в полном размере): Быстро 7–9 мин, Баланс 8–12, Чисто 12–14.
Для черновика нужна Fast H3 (`fastvideo_fasth3_8step_v2_pruned_int8_convrot.safetensors` в `models/diffusion_models`),
без неё — базовая модель + турбо-LoRA (медленнее). Для чистовика — Taomate 3-step LoRA, если есть, иначе турбо.
Turbo и Normal не изменились, старые схемы открываются как раньше.

**EN:** The MODE list gains Fast HD, Balance HD and Clean HD — the model's full size in one run: small draft on a fast
model → upscale → short refine at full size. References and AutoPrompter work as before. Measured (RTX 5070 Ti 16 GB,
int8 models, 10 s full size): Fast 7–9 min, Balance 8–12, Clean 12–14. Turbo and Normal are unchanged.
