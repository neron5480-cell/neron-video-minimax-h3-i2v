import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

const NODE_NAME = "NeronMiniMaxH3Generator";

const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";

const GROUP_GAP = 18;

const EXPERT_WIDGETS = [
    "slot_1_enabled", "slot_1_lora", "slot_1_strength",
    "slot_2_enabled", "slot_2_lora", "slot_2_strength",
    "slot_3_enabled", "slot_3_lora", "slot_3_strength",
    "unet_model", "clip_model",
    "vae_video_model", "vae_audio_model",
    "turbo_lora_model",
    "normal_steps", "turbo_steps", "seed",
    "control_after_generate",
    "decode_tile_size",
];

const MANUAL_ONLY_WIDGETS = ["manual_width", "manual_height"];
const PRESET_ONLY_WIDGETS = ["resolution_preset"];

console.log("[H3 Generator] generator.js loaded");

const GROUPS = [
    {
        name: "⚙️ EXPERT MODE / ЭКСПЕРТ",
        widgets: ["expert_mode"],
        fill:   "rgba(255, 200, 100, 0.22)",
        border: "rgba(255, 200, 100, 0.95)",
        label:  "rgba(255, 235, 160, 1.0)",
        thick:  2.5,
    },
    {
        name: "РЕЖИМ / MODE",
        widgets: ["MODE / РЕЖИМ", "SECONDS / СЕКУНДЫ"],
        fill:   "rgba( 90, 140, 200, 0.15)",
        border: "rgba( 90, 140, 200, 0.75)",
        label:  "rgba(180, 215, 255, 1.0)",
    },
    {
        name: "РАЗМЕР / SIZE",
        widgets: [
            "resolution_mode",
            "resolution_preset",
            "manual_width",
            "manual_height",
            "divisible_by",
        ],
        fill:   "rgba(200, 160,  90, 0.15)",
        border: "rgba(200, 160,  90, 0.75)",
        label:  "rgba(255, 225, 170, 1.0)",
    },
    {
        name: "LORA",
        widgets: [
            "slot_1_enabled", "slot_1_lora", "slot_1_strength",
            "slot_2_enabled", "slot_2_lora", "slot_2_strength",
            "slot_3_enabled", "slot_3_lora", "slot_3_strength",
        ],
        fill:   "rgba(160,  90, 200, 0.15)",
        border: "rgba(160,  90, 200, 0.75)",
        label:  "rgba(225, 180, 255, 1.0)",
    },
    {
        name: "ПАМЯТЬ / MEMORY",
        widgets: [
            "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ",
            "decode_tile_size",
        ],
        fill:   "rgba(200, 200, 100, 0.15)",
        border: "rgba(200, 200, 100, 0.75)",
        label:  "rgba(255, 255, 170, 1.0)",
    },
    {
        name: "МОДЕЛИ / MODELS",
        widgets: [
            "unet_model", "clip_model",
            "vae_video_model", "vae_audio_model",
            "turbo_lora_model",
        ],
        fill:   "rgba(200, 120, 120, 0.15)",
        border: "rgba(200, 120, 120, 0.75)",
        label:  "rgba(255, 190, 190, 1.0)",
    },
    {
        name: "ТОНКАЯ НАСТРОЙКА / ADVANCED",
        widgets: [
            "normal_steps", "turbo_steps", "seed",
            "control_after_generate",
        ],
        fill:   "rgba(120, 200, 160, 0.15)",
        border: "rgba(120, 200, 160, 0.75)",
        label:  "rgba(190, 255, 220, 1.0)",
    },
];

const LABEL_FONT = "bold 10px sans-serif";

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function setWidgetValue(node, name, value) {
    const w = getWidget(node, name);
    if (!w) return;
    w.value = value;
    try {
        w.callback?.(value, app.canvas, node, [0, 0], null);
    } catch (_) {}
}

function hideWidget(widget) {
    if (!widget || widget.__neronHidden) return;
    widget.__neronHidden = true;
    widget.__neronOrigType = widget.type;
    widget.__neronOrigComputeSize = widget.computeSize;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
}

function showWidget(widget) {
    if (!widget || !widget.__neronHidden) return;
    widget.__neronHidden = false;
    widget.type = widget.__neronOrigType;
    if (widget.__neronOrigComputeSize) {
        widget.computeSize = widget.__neronOrigComputeSize;
    } else {
        delete widget.computeSize;
    }
}

function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function setBottomPadding(widget, amount) {
    if (!widget) return;
    if (!widget.__neronOrigSize) {
        widget.__neronOrigSize = widget.computeSize;
    }
    widget.__neronBottomPadding = amount;

    const orig = widget.__neronOrigSize;
    widget.computeSize = function (width) {
        const sz = orig ? orig.call(this, width) : [width, 24];
        return [sz[0], sz[1] + amount];
    };
}

function clearBottomPadding(widget) {
    if (!widget) return;
    if (widget.__neronOrigSize) {
        widget.computeSize = widget.__neronOrigSize;
        delete widget.__neronOrigSize;
    }
    delete widget.__neronBottomPadding;
}

function isHidden(w) {
    return !w || w.__neronHidden;
}

function widgetHeight(w, nodeWidth) {
    try {
        if (w.computeSize) {
            const s = w.computeSize(nodeWidth);
            if (s && s[1] != null && s[1] > 0) return s[1];
        }
    } catch (e) {}
    return 24;
}

function groupRect(node, g) {
    const vis = [];
    for (const w of node.widgets) {
        if (g.widgets.includes(w.name) && !isHidden(w)) vis.push(w);
    }
    if (vis.length === 0) return null;

    let y0 = Infinity, y1 = -Infinity;
    for (const w of vis) {
        const y = w.last_y;
        if (y === undefined) continue;
        const h = widgetHeight(w, node.size[0]);
        const pad = w.__neronBottomPadding || 0;
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + h - pad);
    }
    if (!isFinite(y0) || y1 <= y0) return null;

    const padX = 10;
    const labelH = 16;
    const nodeW = node.size[0];

    let rectX = padX;
    let rectY = y0 - labelH;
    let rectW = nodeW - padX * 2;
    let rectH = (y1 - y0) + labelH;

    return { x: rectX, y: rectY, w: rectW, h: rectH };
}

function applyGroupGaps(node) {
    if (!node.widgets) return;

    for (const w of node.widgets) clearBottomPadding(w);

    const visibleGroups = [];
    for (const g of GROUPS) {
        const hasVisible = g.widgets.some((name) => {
            const w = node.widgets.find((x) => x.name === name);
            return w && !isHidden(w);
        });
        if (hasVisible) visibleGroups.push(g);
    }

    for (let gi = 0; gi < visibleGroups.length; gi++) {
        const g = visibleGroups[gi];
        let lastVisible = null;
        for (const name of g.widgets) {
            const w = node.widgets.find((x) => x.name === name);
            if (w && !isHidden(w)) lastVisible = w;
        }
        if (lastVisible) setBottomPadding(lastVisible, GROUP_GAP);
    }
}

function drawGroupRects(node, ctx) {
    if (!node.widgets) return;
    const cornerR = 10;

    ctx.save();

    for (const g of GROUPS) {
        const rect = groupRect(node, g);
        if (!rect) continue;

        ctx.fillStyle = g.fill;
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, cornerR);
        ctx.fill();

        ctx.strokeStyle = g.border;
        ctx.lineWidth = g.thick || 1.5;
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, cornerR);
        ctx.stroke();
    }

    const resetW = node.widgets.find(
        (w) => w.name && w.name.indexOf("Reset") !== -1,
    );
    if (resetW && resetW.last_y !== undefined) {
        const padX = 10;
        const nodeW = node.size[0];
        const lineY = resetW.last_y - 10;
        const x0 = padX + 4;
        const x1 = nodeW - padX - 4;
        const grad = ctx.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0.00, "rgba(255, 255, 255, 0.00)");
        grad.addColorStop(0.15, "rgba(255, 220, 180, 0.35)");
        grad.addColorStop(0.50, "rgba(255, 220, 180, 0.60)");
        grad.addColorStop(0.85, "rgba(255, 220, 180, 0.35)");
        grad.addColorStop(1.00, "rgba(255, 255, 255, 0.00)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, lineY);
        ctx.lineTo(x1, lineY);
        ctx.stroke();
    }

    ctx.restore();
}

function drawGroupLabels(node, ctx) {
    if (!node.widgets) return;
    const labelH = 16;

    ctx.save();
    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (const g of GROUPS) {
        const rect = groupRect(node, g);
        if (!rect) continue;

        ctx.fillStyle = g.label;
        ctx.fillText(g.name, rect.x + 12, rect.y + labelH / 2 + 1);
    }

    ctx.restore();
}

function applyExpertMode(node, expert) {
    if (!node.widgets) return;

    for (const name of EXPERT_WIDGETS) {
        const w = getWidget(node, name);
        if (!w) continue;
        if (expert) showWidget(w);
        else hideWidget(w);
    }

    const modeW = getWidget(node, "resolution_mode");
    const modeStr = String(modeW?.value || "");
    const isManual = modeStr.indexOf("Manual") !== -1
                  || modeStr.indexOf("\u0420\u0443\u0447\u043d\u043e\u0439") !== -1;

    for (const name of MANUAL_ONLY_WIDGETS) {
        const w = getWidget(node, name);
        if (!w) continue;
        if (isManual) showWidget(w);
        else hideWidget(w);
    }
    for (const name of PRESET_ONLY_WIDGETS) {
        const w = getWidget(node, name);
        if (!w) continue;
        if (isManual) hideWidget(w);
        else showWidget(w);
    }

    applyGroupGaps(node);

    const sz = node.computeSize();
    node.setSize([Math.max(sz[0], node.size[0]), sz[1]]);
    node.setDirtyCanvas(true, true);
}

const HELP_TEXT = `
🎥 NERON MINIMAX H3 GENERATOR
===================================================

📌 WHAT IT IS 📌
A single node that does everything the old 30-node
subgraph did: loading models, LoRA, Sigma Shift,
sampling, VAE decode (video + audio) — all in one place.

The output is ready-to-use VIDEO + AUDIO.

📌 PROMPT 📌
The prompt comes ONLY from outside — via the 'prompt'
input. Connect it from the auto-prompter (Neron
Multi-Image LLM) or from CR Prompt Text.

There is no text field inside the node. This is
intentional: it keeps the node focused on generation.

📌 EXPERT MODE 📌
Toggle at the top of the node.

OFF > you see only the essentials:
      MODE, SECONDS, SIZE, MEMORY.
ON  > additional groups appear:
      LORA, MODELS, ADVANCED.

📌 MODE / РЕЖИМ 📌
Turbo  — 8 steps, fast, good for tests and drafts.
Normal — 20 steps, better quality.

Both modes use the same model. Turbo just applies
a special 8-step LoRA on top.

⚡ HD modes — the model's FULL size in one run:
a small draft (fast model) → upscale → a short
refine at full size. Size = the passport maximum
for your preset's shape (e.g. 16:9 → 1344×768).
⚡ Fast HD    — draft 0.45 area, refine 3 steps.
Balance HD    — draft 0.5 area, refine 3 steps.
Clean HD      — draft 0.6 area, refine 6 steps.
Measured: RTX 5070 Ti 16 GB, int8 models, 10 s at
full size: Fast 7–9 min, Balance 8–12, Clean 12–14.
Draft model: Fast H3 if downloaded
(fastvideo_fasth3_8step_v2_pruned_int8_convrot),
otherwise base model + turbo LoRA (slower).
Refine LoRA: Taomate 3-step if present, else turbo.
After a run the node shows a 📋 Report with the
time of every stage.

📌 SECONDS / СЕКУНДЫ 📌
Working range: 1 to 15 seconds.
15 seconds is the safety margin — not a limit.
Beyond 15 the model starts losing consistency:
faces drift, backgrounds shift, details blur.

If 'length_in' is connected, SECONDS is ignored
and the exact number of frames comes from the input.

📌 SIZE / РАЗМЕР 📌
Two modes:
• Пресеты / Presets — ready-made formats:
  Кино 16:9 (1344x768), Телефон 9:16, Квадрат 1:1,
  Классика 4:3, Широкий 21:9, Вертикаль 3:4.
• Ручной / Manual — set width and height by hand.

divisible_by — forces dimensions to a multiple
(32 is the MiniMax H3 requirement).

IMPORTANT: you can drop ANY image into the node —
H3 will EXPAND the scene to fit the target format.
A 399x501 portrait becomes a 21:9 wide shot with
the environment drawn around it. No preprocessing.

If 'width' and 'height' inputs are connected —
they OVERRIDE the widget values.

📌 LORA (expert) 📌
Three slots: style, character, motion.
Each slot has its own on/off and strength.

The turbo LoRA is applied automatically in Turbo mode
and is NOT visible in the slots.

📌 MEMORY / ПАМЯТЬ 📌
FREE AFTER RUN — after generation, unloads all models
from RAM and VRAM. Next run reloads from disk (a few
seconds on M.2). Clean memory.

decode_tile_size — VAE decode tile size.
  0  = auto-pick based on free VRAM
  >0 = fixed value (1024 = fastest, 512 = safe)
  On OOM the tile size is reduced automatically.

📌 MODELS (expert) 📌
Five slots to pick your own model files:
UNET, CLIP, video VAE, audio VAE, turbo LoRA.

Defaults match the standard MiniMax H3 files.

📌 ADVANCED (expert) 📌
normal_steps — steps for Normal mode (default 20).
turbo_steps  — steps for Turbo mode (default 8).
seed         — random seed (fixed or randomize).

📌 GO-ON-WORKER / ГОСТРАБАЙТЕР 📌
This is the core of the engine.

• CLIP goes away right after prompt encoding.
• UNET + LoRA + wrappers go away right after sampling.
• VAE goes away right after decode.

Nothing is kept "just in case". Each stage gets the
full VRAM. That's why a 15-second 1024x1024 video
uses about 32 GB of RAM instead of 40+.

And no cumulative degradation: the 100th run is as
fast as the 1st.

📌 QUICK START 📌
1. LoadImage > ref_image_0
2. Auto-prompter (or CR Prompt Text) > prompt
3. MODE = Turbo
4. SECONDS = 15
5. SIZE = Кино 16:9 (1344x768)
6. Queue

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Одна нода, которая делает всё, что раньше делал
субграф из 30+ нод: загрузка моделей, LoRA, Sigma
Shift, сэмплинг, VAE-декод (видео + звук) — всё в
одном месте.

На выходе — готовое ВИДЕО + ЗВУК.

📌 ПРОМПТ 📌
Промпт приходит ТОЛЬКО извне — через вход 'prompt'.
Подключи его от автопромта (Neron Multi-Image LLM)
или от CR Prompt Text.

Текстового поля внутри ноды нет. Это сделано
специально: нода занимается только генерацией.

📌 ЭКСПЕРТНЫЙ РЕЖИМ 📌
Тумблер вверху ноды.

ВЫКЛ > видно только главное:
       РЕЖИМ, СЕКУНДЫ, РАЗМЕР, ПАМЯТЬ.
ВКЛ  > появляются дополнительные группы:
       LORA, МОДЕЛИ, ТОНКАЯ НАСТРОЙКА.

📌 РЕЖИМ / MODE 📌
Turbo  — 8 шагов, быстро. Для тестов и черновиков.
Normal — 20 шагов, качество выше.

Оба режима работают с одной моделью. Turbo просто
накладывает сверху специальную 8-шаговую LoRA.

⚡ HD-режимы — ПОЛНЫЙ размер модели за один прогон:
маленький черновик (быстрая модель) → увеличение →
короткий чистовик в полном размере. Размер —
максимум паспорта для формы пресета
(например, 16:9 → 1344×768).
⚡ Быстро HD — черновик 0.45 площади, чистовик 3 шага.
Баланс HD   — черновик 0.5, чистовик 3 шага.
Чисто HD    — черновик 0.6, чистовик 6 шагов.
Замер: RTX 5070 Ti 16 ГБ, модели int8, 10 с в полном
размере: Быстро 7–9 мин, Баланс 8–12, Чисто 12–14.
Модель черновика: Fast H3, если скачана
(fastvideo_fasth3_8step_v2_pruned_int8_convrot),
иначе базовая + турбо-LoRA (медленнее).
LoRA чистовика: Taomate 3-step, если есть, иначе турбо.
После прогона на ноде появляется 📋 Отчёт со
временем каждого этапа.

📌 СЕКУНДЫ / SECONDS 📌
Рабочий диапазон: от 1 до 15 секунд.
15 секунд — это запас прочности, а не предел.
Дальше 15 модель начинает терять связность:
лица уплывают, фон меняется, детали размываются.

Если подключён вход 'length_in' — SECONDS
игнорируется, и точное количество кадров берётся
из входа.

📌 РАЗМЕР / SIZE 📌
Два режима:
• Пресеты — готовые форматы: Кино 16:9 (1344x768),
  Телефон 9:16, Квадрат 1:1, Классика 4:3,
  Широкий 21:9, Вертикаль 3:4.
• Ручной — сам задаёшь ширину и высоту.

divisible_by — заставляет размеры быть кратными
(32 — требование MiniMax H3).

ВАЖНО: можно кинуть ЛЮБУЮ картинку — H3 САМА
расширит сцену под нужный формат. Портрет 399x501
превращается в горизонтальный кадр 21:9 с
дорисованным окружением. Никакой подготовки.

Если подключены входы 'width' и 'height' — они
ПЕРЕОПРЕДЕЛЯЮТ значения виджетов.

📌 LORA (эксперт) 📌
Три слота: стиль, персонаж, движение.
У каждого — свой вкл/выкл и своя сила.

Turbo LoRA применяется автоматически в режиме
Turbo и в слотах НЕ отображается.

📌 ПАМЯТЬ / MEMORY 📌
FREE AFTER RUN — после генерации выгружает все
модели из RAM и VRAM. Следующий прогон подгрузит
их с диска (несколько секунд на M.2). Память чистая.

decode_tile_size — размер тайла VAE-декода.
  0  = авто-подбор по свободной VRAM
  >0 = фиксированное значение (1024 = быстро,
       512 = безопасно)
  При OOM размер тайла уменьшается сам.

📌 МОДЕЛИ / MODELS (эксперт) 📌
Пять слотов для выбора своих файлов модели:
UNET, CLIP, video VAE, audio VAE, turbo LoRA.

По умолчанию — стандартные файлы MiniMax H3.

📌 ТОНКАЯ НАСТРОЙКА (эксперт) 📌
normal_steps — шаги для Normal режима (по умолч. 20).
turbo_steps  — шаги для Turbo режима (по умолч. 8).
seed         — сид (фиксированный или случайный).

📌 ГОСТРАБАЙТЕР 📌
Это сердце движка.

• CLIP уходит сразу после кодирования промпта.
• UNET + LoRA + обёртки уходят сразу после сэмплинга.
• VAE уходит сразу после декода.

Ничего не держится «на всякий случай». Каждый этап
получает всю VRAM. Именно поэтому видео 15 секунд
1024x1024 жрёт около 32 ГБ RAM, а не 40+.

И никакой накопительной деградации: 100-й прогон
такой же быстрый, как 1-й.

📌 БЫСТРЫЙ СТАРТ 📌
1. LoadImage > ref_image_0
2. Автопромт (или CR Prompt Text) > prompt
3. РЕЖИМ = Turbo
4. СЕКУНДЫ = 15
5. РАЗМЕР = Кино 16:9 (1344x768)
6. Queue

===================================================
`;

function showHelpDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.7);" +
        "z-index:99999;display:flex;align-items:center;" +
        "justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText =
        "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
        "border-radius:8px;padding:20px;max-width:820px;" +
        "max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;" +
        "white-space:pre-wrap;box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP_TEXT;
    const btn = document.createElement("button");
    btn.textContent = "Close / Закрыть";
    btn.style.cssText =
        "display:block;margin:16px auto 0;padding:8px 24px;" +
        "background:#2a5d9c;color:#fff;border:none;" +
        "border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

const DEFAULTS = {
    "MODE / РЕЖИМ": "Turbo / Турбо",
    "SECONDS / СЕКУНДЫ": 15.0,
    "resolution_mode": "Пресеты / Presets",
    "resolution_preset": "Кино 16:9 (1344x768)",
    "manual_width": 1344,
    "manual_height": 768,
    "divisible_by": 32,
    "slot_1_enabled": false,
    "slot_2_enabled": false,
    "slot_3_enabled": false,
    "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ": true,
    "expert_mode": false,
    "normal_steps": 20,
    "turbo_steps": 8,
    "seed": 1,
    "decode_tile_size": 0,
};

function resetAllWidgets(node) {
    for (const [name, value] of Object.entries(DEFAULTS)) {
        setWidgetValue(node, name, value);
    }
    applyExpertMode(node, false);
    node.setDirtyCanvas?.(true, true);
}

function scheduleReapply(node) {
    if (node.__reapplyTimer) clearTimeout(node.__reapplyTimer);
    node.__reapplyTimer = setTimeout(() => {
        const expertW = getWidget(node, "expert_mode");
        applyExpertMode(node, !!expertW?.value);
    }, 50);
}

app.registerExtension({
    name: "Neron.H3Generator.Interface",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origConfigure = nodeType.prototype.onConfigure;
        const origDrawBg = nodeType.prototype.onDrawBackground;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        const origResize = nodeType.prototype.onResize;
        const origRemoved = nodeType.prototype.onRemoved;
        const origExecuted = nodeType.prototype.onExecuted;

        // 📋 отчёт HD-режимов — поле внизу ноды (не сохраняется в схему)
        nodeType.prototype.onExecuted = function (message) {
            const r = origExecuted?.apply(this, arguments);
            const text = (message?.text || []).join("\n");
            if (!text) return r;
            let w = getWidget(this, "report");
            if (!w) {
                w = ComfyWidgets["STRING"](this, "report", ["STRING", { multiline: true }], app).widget;
                w.serialize = false;
                if (w.inputEl) { w.inputEl.readOnly = true; w.inputEl.style.opacity = 0.85; w.inputEl.style.fontSize = "11px"; }
            }
            w.value = "📋 Отчёт / Report\n" + text;
            try {
                const sz = this.computeSize();
                this.setSize([Math.max(this.size[0], sz[0]), Math.max(this.size[1], sz[1])]);
            } catch (_) {}
            app.graph?.setDirtyCanvas(true, true);
            return r;
        };

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;

            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;

            // === ФИКС НАЛОЖЕНИЯ ===
            // Невидимая распорка сверху, чтобы сдвинуть виджеты вниз
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.draw = function() {}; 
            spacer.computeSize = () => [0, 20]; 
            node.widgets.unshift(spacer);

            const watch = ["expert_mode", "resolution_mode"];
            for (const name of watch) {
                const w = getWidget(node, name);
                if (!w) continue;
                const orig = w.callback;
                w.callback = function () {
                    const result = orig?.apply(this, arguments);
                    const expertW = getWidget(node, "expert_mode");
                    applyExpertMode(node, !!expertW?.value);
                    return result;
                };
            }

            node.addWidget("button", "🔄 Reset to Defaults / Сброс",
                null, () => resetAllWidgets(node));
            node.addWidget("button", "📖 Help / Справка",
                null, () => showHelpDialog());

            const expertW = getWidget(node, "expert_mode");
            const runApply = () => {
                applyExpertMode(node, !!expertW?.value);
            };
            setTimeout(runApply, 100);
            setTimeout(runApply, 400);
            setTimeout(runApply, 900);

            return r;
        };

        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            const node = this;
            const expertW = getWidget(node, "expert_mode");
            const runApply = () => {
                applyExpertMode(node, !!expertW?.value);
            };
            setTimeout(runApply, 100);
            setTimeout(runApply, 400);
            setTimeout(runApply, 900);
            return r;
        };

        nodeType.prototype.onResize = function () {
            const r = origResize?.apply(this, arguments);
            scheduleReapply(this);
            return r;
        };

        nodeType.prototype.onRemoved = function () {
            if (this.__reapplyTimer) {
                clearTimeout(this.__reapplyTimer);
                this.__reapplyTimer = null;
            }
            return origRemoved?.apply(this, arguments);
        };

        nodeType.prototype.onDrawBackground = function (ctx) {
            if (origDrawBg) origDrawBg.apply(this, arguments);
            if (this.flags && this.flags.collapsed) return;
            drawGroupRects(this, ctx);
        };

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (origDrawFg) origDrawFg.apply(this, arguments);
            if (this.flags && this.flags.collapsed) return;
            drawGroupLabels(this, ctx);
        };
    },
});