# 🎚 H3 LoRA Selector — 5 Slots

[🇬🇧 English below](#english)

Подключает до **пяти LoRA** к модели одной нодой вместо цепочки из пяти.

У каждого слота есть:
- отдельный переключатель **ON / OFF**;
- выбор файла LoRA;
- своя сила (от −3 до 3).

Включённые LoRA применяются по порядку, со слота 1 по слот 5. Работают в режимах 8 и 20 шагов.

**Вход:** `model` · **Выход:** `model` · **Меню:** `H3-Static-Camera/LoRA`

**Файлы LoRA** кладутся в `ComfyUI/models/loras/`.

**Установка:** одной ссылкой через Manager (см. [README в корне](../README.md)) или скопируйте папку `ComfyUI-H3-Lora-Selector` в `ComfyUI/custom_nodes/`.

**Воркфлоу:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.

---

## English

Applies up to **five LoRAs** to a model with one node instead of a chain of five.

Every slot has:
- its own **ON / OFF** switch;
- a LoRA file selector;
- its own strength (−3 to 3).

Enabled LoRAs are applied in order, slot 1 to slot 5. They work in both 8-step and 20-step modes.

**Input:** `model` · **Output:** `model` · **Menu:** `H3-Static-Camera/LoRA`

**LoRA files** go to `ComfyUI/models/loras/`.

**Install:** one link via Manager (see the [root README](../README.md)) or copy the `ComfyUI-H3-Lora-Selector` folder into `ComfyUI/custom_nodes/`.

**Workflows:** `workflow/neronVideoMinimaxH3_v2.0.json`, `workflow/neronSmartMiniMaxH3_v1.0.json`.
