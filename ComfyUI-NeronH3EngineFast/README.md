# ⚡ Neron H3 Engine Fast — тестовая версия (dev)

Опытная нода: **скорость + качество** для MiniMax H3. Цель — 10 секунд видео в максимальном
размере модели (1344×768) заметно быстрее нашего Турбо и без «мыла» быстрых схем.
Когда найдём баланс — войдёт опцией в H3 Engine.

### ⚙️ КАК УСТРОЕНА
Одна нода, внутри три этапа:
1. **Черновик** — маленький кадр (часть площади паспорта), быстрая 8-шаговая модель Fast H3
   (если её нет — базовая модель + турбо-LoRA). Здесь рождаются сюжет, движение и звук.
2. **Увеличение** — латент черновика до размера паспорта: модель-апскейлер H3 из
   `models/latent_upscale_models`, если есть и подходит; иначе простое растяжение.
3. **Чистовик** — полный размер, базовая модель + быстрая LoRA (Taomate 3-step или наша турбо),
   несколько шагов частичной перерисовки: движение от черновика, деталь — заново.

Что взято у H3 Engine: паспорт модели (до 1344×768, до 15 с, сетка 17k+5), память по этапам,
полноточное внимание по умолчанию (быстрое INT8 у нас давало морфинг в конце ролика),
защищённая раскодировка, часы генерации, справка RU/EN. Только родные ноды ComfyUI.

### 🎚 НАСТРОЙКИ
* Новичок видит: **режим** (⚡ Быстро / Баланс / Чисто / Свой), **длительность**, **размер**.
  «По кадру» — форма первого кадра в размере паспорта.
* «Свой» и ⚙ эксперт открывают баланс: площадь черновика, шаги черновика, шаги и сила чистовика.
* Значения режимов — стартовые точки для тестов, а не замеры.
* После прогона на ноде появляется **📋 Отчёт**: размеры, шаги, апскейлер, время каждого этапа.

### 🔌 ВХОДЫ
`prompt`, `first_frame`, `last_frame` (необязательно), `width`/`height`/`length_in` (необязательно).
Выходы: `video`, `audio`, `last_frame`, `frames_count`.

Готовый воркфлоу — `workflows/Neron_H3_Engine_Fast.json` (ссылки на модели — в заметке на холсте).

---

# ⚡ Neron H3 Engine Fast — test build (dev)

A test node for **speed + quality** with MiniMax H3. Goal: 10 s at the model's max size (1344×768),
clearly faster than our Turbo and without the blur of fast workflows. Once the balance is found it
becomes an option of H3 Engine.

* **Draft** — small frame, Fast H3 (8 steps) or base model + turbo LoRA.
* **Upscale** — H3 latent upscale model from `models/latent_upscale_models` if present and compatible,
  otherwise a plain latent stretch.
* **Refine** — full size, base model + fast LoRA (Taomate 3-step or our turbo), a few partial steps.
* Beginners see mode / seconds / size; Custom and ⚙ expert show the balance sliders.
  Mode values are starting points for testing, not measurements.
* After a run the node shows a **📋 Report** with sizes, steps, upscaler and the time of each stage.

Ready workflow — `workflows/Neron_H3_Engine_Fast.json` (model links in the note on the canvas).
