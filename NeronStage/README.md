# 🎬 Neron Stage — Площадка режиссёра

[🇬🇧 English below](#english)

**Версия 0.1 (тестовая).** Вы ставите сцену мышкой, а не пишете её словами.

* Фото места (поляна, комната, улица) становится **объёмной сценой**.
* По ней ходит **скелет-дублёр** от точки к точке.
* В каждой точке — **поза** и **подсказка словами** («наклонилась и сорвала цветок»).
* Позу можно **гнуть мышкой**: тянуть за кисти, локти, колени, стопы, голову.
* **Камера** ставится готовым ракурсом или мышкой в виде «🎥 Камера».
* **▶ Репетиция** — проиграть движение прямо на холсте, видеокарта при этом отдыхает.

## Входы

| Вход | Что подключить |
|---|---|
| `scene` | **Load Image** с фото места |
| `actor` | **Load Image** с фото героя (необязательно) |

## Выходы

| Выход | Куда |
|---|---|
| `pose_video` | видео скелета позы глазами камеры → **H3 Fun ControlNet** (поза) или просмотр |
| `storyboard` | раскадровка по секундам → **автопромтер** |
| `frames`, `fps`, `width`, `height` | числа для генератора (сетка кадров H3: 17·n+5, 5 с = 124 кадра) |
| `scene`, `actor` | те же фото дальше — как образцы для H3 |

## Что нужно

* Модель глубины **Depth Anything V2 Small (метрическая)** скачивается **сама** при первом подключении фото, около 100 МБ, в `ComfyUI/models/neron_stage`. Нужен интернет один раз.
* «🏠 Комната» и «🌳 Улица» — две модели глубины, каждая точнее в своём.
* После работы модель глубины выгружается из видеопамяти и генерации не мешает.

## Честно о границах

* Сцена из **одного фото** — это макет. Если сильно повернуть вбок, видны «рваные» края и пустота за предметами. В ролик это не попадает: фон дорисует генерация.
* Камера в ролике пока **неподвижная**.
* Серые болванки предметов (стул, стол…) — в следующей версии.

---

<a name="english"></a>
# 🎬 Neron Stage — Director's Stage

**Version 0.1 (test).** You stage the scene with the mouse instead of describing it in words.

* The place photo becomes a **3D scene**; a **stand-in skeleton** walks from point to point.
* Each point has a **pose** and a **text hint**. Bend poses by dragging hands, elbows, knees, feet, head.
* Place the **camera** with a preset or by mouse in the “🎥 Camera” view. **▶** rehearses on the canvas.

**Inputs:** `scene` — Load Image with the place photo; `actor` — Load Image with the character (optional).

**Outputs:** `pose_video` → H3 Fun ControlNet (pose) or preview; `storyboard` → autoprompter; `frames/fps/width/height` → generator (H3 grid 17·n+5); `scene/actor` → references.

The depth model (Depth Anything V2 Small, metric, ~100 MB) downloads automatically into `ComfyUI/models/neron_stage` the first time and is unloaded from VRAM after use.

**Limits:** a one-photo scene is a mock-up (torn edges at far angles are expected); the clip camera is static for now; grey object blockouts come in the next version.

Three.js (MIT) is included in `web/lib`.
