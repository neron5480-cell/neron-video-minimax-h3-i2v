NERON VIDEO MINIMAX H3 I2V v2.0
Installation Guide / Инструкция по установке

==================================================
РУССКИЙ
==================================================

1. Полностью закройте ComfyUI.

2. Скопируйте эти три папки:

ComfyUI-H3-Lora-Selector
ComfyUI-H3-Static-Camera
ComfyUI-Interactive-Processor

в каталог:

ComfyUI\custom_nodes\

После копирования должно получиться:

ComfyUI\custom_nodes\ComfyUI-H3-Lora-Selector
ComfyUI\custom_nodes\ComfyUI-H3-Static-Camera
ComfyUI\custom_nodes\ComfyUI-Interactive-Processor

Не создавайте дополнительный уровень вложенности.

3. Запустите ComfyUI заново.

4. Обновите интерфейс сочетанием:

Ctrl + Shift + R

5. Откройте workflow:

workflow\neronVideoMinimaxH3_v2.0.json


НОВЫЕ И ОБНОВЛЕННЫЕ НОДЫ

Interactive Image Processor

Загрузка изображения, изменение размера, коррекция цвета,
предпросмотр и дополнительный AI-апскейл в одной ноде.


Fixed Camera H3 Presets

Автоматическое или ручное управление камерой MiniMax H3.
Может работать с автопромптером или автономно, без LLM.


Manual Color & Upscale Panel

Коррекция яркости, контраста, насыщенности и резкости.
AI-апскейл выполняется только при выборе Enabled / Вкл.
При выборе Disabled / Откл апскейлер не запускается.


H3 LoRA Selector - 5 Slots

Позволяет выбрать до пяти LoRA.

Для каждого слота доступны:

- отдельное включение и отключение;
- выбор файла LoRA;
- отдельная сила модели.

Активные LoRA применяются в порядке от слота 1 до слота 5.
LoRA работают в режимах генерации 8 и 20 шагов.


ВАЖНО

LoRA-файлы должны находиться в:

ComfyUI\models\loras\

Модели AI-апскейла должны находиться в:

ComfyUI\models\upscale_models\

Если ноды не появились, полностью перезапустите ComfyUI
и проверьте журнал загрузки custom nodes.


==================================================
ENGLISH
==================================================

1. Close ComfyUI completely.

2. Copy these three folders:

ComfyUI-H3-Lora-Selector
ComfyUI-H3-Static-Camera
ComfyUI-Interactive-Processor

into:

ComfyUI\custom_nodes\

The resulting paths must be:

ComfyUI\custom_nodes\ComfyUI-H3-Lora-Selector
ComfyUI\custom_nodes\ComfyUI-H3-Static-Camera
ComfyUI\custom_nodes\ComfyUI-Interactive-Processor

Do not create an additional nested folder.

3. Start ComfyUI again.

4. Refresh the interface with:

Ctrl + Shift + R

5. Open the workflow:

workflow\neronVideoMinimaxH3_v2.0.json


NEW AND UPDATED NODES

Interactive Image Processor

Combines image loading, resizing, color correction,
interactive preview and optional AI upscaling.


Fixed Camera H3 Presets

Automatic or manual MiniMax H3 camera control.
It can work with the autoprompter or independently without an LLM.


Manual Color & Upscale Panel

Controls brightness, contrast, saturation and sharpness.
AI upscaling runs only when Enabled is selected.
When Disabled is selected, the upscale model is not executed.


H3 LoRA Selector - 5 Slots

Supports up to five LoRA files.

Every slot has:

- an independent ON/OFF switch;
- a LoRA file selector;
- an individual model strength.

Active LoRAs are applied from slot 1 through slot 5.
User LoRAs work in both 8-step and 20-step generation modes.


IMPORTANT

Place LoRA files in:

ComfyUI\models\loras\

Place AI upscale models in:

ComfyUI\models\upscale_models\

If the nodes do not appear, restart ComfyUI completely
and check the custom-node startup log.


Version: 2.0
Release date: September 29, 2026
Author: neron5480-cell