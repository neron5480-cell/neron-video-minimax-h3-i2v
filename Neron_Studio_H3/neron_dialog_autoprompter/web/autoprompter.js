import { app } from "../../scripts/app.js";

const NODE_NAME = "NeronAutoPrompter";

const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";

const GROUP_GAP = 18;

const EXPERT_WIDGETS = [
    "model", "mmproj", "system_prompt",
    "max_tokens", "temperature", "n_ctx", "n_gpu_layers",
    "UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ",
];

const MANUAL_WIDGETS = [
    "manual_prompt", "subject_details",
];

console.log("[Neron AutoPrompter] autoprompter.js loaded");

// Порядок GROUPS совпадает с порядком виджетов в INPUT_TYPES.
const GROUPS = [
    {
        name: "👑 EXPERT MODE / ЭКСПЕРТ",
        widgets: ["expert_mode"],
        fill:   "rgba(255, 200, 100, 0.22)",
        border: "rgba(255, 200, 100, 0.95)",
        label:  "rgba(255, 235, 160, 1.0)",
        thick:  2.5,
        hasLabelAbove: false,
    },
    {
        name: "РЕЖИМ / MODE",
        widgets: ["workflow_mode"],
        fill:   "rgba( 90, 140, 200, 0.15)",
        border: "rgba( 90, 140, 200, 0.75)",
        label:  "rgba(180, 215, 255, 1.0)",
    },
    {
        name: "КАМЕРА / CAMERA",
        widgets: ["camera_mode", "framing_type", "fixed_distance"],
        fill:   "rgba(200, 160,  90, 0.15)",
        border: "rgba(200, 160,  90, 0.75)",
        label:  "rgba(255, 225, 170, 1.0)",
    },
    {
        name: "ДЛИНА / DURATION",
        widgets: ["seconds", "fps"],
        fill:   "rgba(160,  90, 200, 0.15)",
        border: "rgba(160,  90, 200, 0.75)",
        label:  "rgba(225, 180, 255, 1.0)",
    },
    {
        name: "МОДЕЛЬ LLM / LLM MODEL",
        widgets: ["model", "mmproj", "system_prompt"],
        fill:   "rgba(200, 120, 120, 0.15)",
        border: "rgba(200, 120, 120, 0.75)",
        label:  "rgba(255, 190, 190, 1.0)",
    },
    {
        name: "ПАРАМЕТРЫ LLM / LLM PARAMS",
        widgets: [
            "max_tokens", "temperature", "n_ctx", "n_gpu_layers",
            "UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ",
        ],
        fill:   "rgba(120, 200, 160, 0.15)",
        border: "rgba(120, 200, 160, 0.75)",
        label:  "rgba(190, 255, 220, 1.0)",
    },
    {
        name: "ТЕКСТ ВРУЧНУЮ / MANUAL TEXT",
        widgets: ["manual_prompt", "subject_details"],
        fill:   "rgba(200, 200, 100, 0.15)",
        border: "rgba(200, 200, 100, 0.75)",
        label:  "rgba(255, 255, 170, 1.0)",
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
    widget.computedHeight = 0;
}

function clearBottomPadding(widget) {
    if (!widget) return;
    if (widget.__neronOrigSize) {
        widget.computeSize = widget.__neronOrigSize;
        delete widget.__neronOrigSize;
    }
    delete widget.__neronBottomPadding;
    if (typeof widget.computedHeight === "number") {
        widget.computedHeight = 0;
    }
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
    if (typeof w.computedHeight === "number" && w.computedHeight > 0) {
        return w.computedHeight;
    }
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

    let rectX, rectY, rectW, rectH;

    if (g.hasLabelAbove === false) {
        rectX = padX;
        rectY = y0 - 2;
        rectW = nodeW - padX * 2;
        rectH = (y1 - y0) + 4;
    } else {
        rectX = padX;
        rectY = y0 - labelH;
        rectW = nodeW - padX * 2;
        rectH = (y1 - y0) + labelH;
    }

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

        if (g.hasLabelAbove === false) {
            ctx.textBaseline = "top";
            ctx.fillText(g.name, rect.x + 12, rect.y + 3);
        } else {
            ctx.textBaseline = "middle";
            ctx.fillText(g.name, rect.x + 12, rect.y + labelH / 2 + 1);
        }
    }

    ctx.restore();
}

function applyVisibility(node) {
    if (!node.widgets) return;

    const expertW = getWidget(node, "expert_mode");
    const expert = !!expertW?.value;

    for (const name of EXPERT_WIDGETS) {
        const w = getWidget(node, name);
        if (!w) continue;
        if (expert) showWidget(w);
        else hideWidget(w);
    }

    const wmW = getWidget(node, "workflow_mode");
    const wmStr = String(wmW?.value || "");
    const isManual = wmStr.indexOf("[Manual]") !== -1
                  || wmStr.indexOf("Manual") !== -1;

    for (const name of MANUAL_WIDGETS) {
        const w = getWidget(node, name);
        if (!w) continue;
        if (isManual) showWidget(w);
        else hideWidget(w);
    }

    applyGroupGaps(node);

    const sz = node.computeSize();
    node.setSize([Math.max(sz[0], node.size[0]), sz[1]]);
    node.setDirtyCanvas(true, true);
}

const HELP_TEXT = `
🎬 NERON AUTOPROMPTER
═══════════════════════════════════════════════════

━━━ ЧТО ЭТО ━━━
Объединённая нода: мозг + камера.

Внутри — две логики, которые раньше были отдельными
нодами:
  • Multi-Image LLM  — читает картинки и мысль юзера,
                       пишет художественный промпт.
  • Camera Operator  — вписывает в промпт ракурс камеры.

На выходе — готовый minimax_prompt + число кадров.

━━━ ПРОМПТ ━━━
Промпт приходит ТОЛЬКО извне — через вход 'prompt_in'.
Это мысль юзера: «девушка ведёт блог, рекламирует
шампунь», «парень идёт по улице», и так далее.

LLM возьмёт эту мысль, посмотрит на картинки (если
подключены) и напишет подробный промпт.

━━━ КАРТИНКИ ━━━
До 4 слотов:
  • image_0 — основная (первый кадр)
  • image_1, image_2 — доп. референсы
  • last_frame — последний кадр (финал)

Если картинок нет — Multi-Image LLM переходит в режим
text-to-video: чёрный кадр + описание словами.

━━━ РЕЖИМ / MODE ━━━
[LLM]    — LLM пишет промпт (обычный режим).
[Manual] — LLM не запускается, текст берётся из
           widget'ов 'manual_prompt' + 'subject_details'.

━━━ КАМЕРА / CAMERA ━━━
camera_mode    — AUTO / FRONT / LEFT / RIGHT / BACK /
                 TOP / BOTTOM.
                 AUTO читает ракурс из текста промпта.
framing_type   — wide shot / medium shot / close-up.
fixed_distance — дистанция до камеры (0.10–3.00).

━━━ ДЛИНА / DURATION ━━━
seconds — от 1 до 15 (запас прочности, не предел).
fps     — по умолчанию 24.

Кадры считаются автоматически по кратности 17 —
требование MiniMax H3.

━━━ ЭКСПЕРТНЫЙ РЕЖИМ ━━━
Тумблер EXPERT MODE вверху ноды.

ВЫКЛ → видны: РЕЖИМ, КАМЕРА, ДЛИНА.
ВКЛ  → появляются: МОДЕЛЬ LLM, ПАРАМЕТРЫ LLM,
       и (в Manual режиме) ТЕКСТ ВРУЧНУЮ.

━━━ ГОСТРАБАЙТЕР ━━━
UNLOAD AFTER RUN = true по умолчанию.
После генерации промпта llama-server убивается.
RAM освобождается. Следующий вызов — новый сервер.

═══════════════════════════════════════════════════
🇷🇺 РУССКИЙ
═══════════════════════════════════════════════════

━━━ ЧТО ЭТО ━━━
Объединённая нода: мозг + камера.

Внутри две логики, которые раньше были отдельными
нодами:
  • Multi-Image LLM  — читает картинки и мысль юзера,
                       пишет художественный промпт.
  • Camera Operator  — вписывает в промпт ракурс камеры.

На выходе — готовый minimax_prompt + число кадров.

━━━ ПРОМПТ ━━━
Промпт приходит ТОЛЬКО извне — через вход 'prompt_in'.

━━━ КАРТИНКИ ━━━
До 4 слотов. Если картинок нет — text-to-video.

━━━ РЕЖИМ / MODE ━━━
[LLM]    — LLM пишет промпт.
[Manual] — текст берётся из widget'ов.

━━━ КАМЕРА / CAMERA ━━━
AUTO читает ракурс из текста. Или задаёшь вручную.

━━━ ДЛИНА / DURATION ━━━
seconds 1–15. fps 24. Кадры — кратно 17.

━━━ ГОСТРАБАЙТЕР ━━━
UNLOAD AFTER RUN = true. После генерации промпта
llama-server убит. Память чистая.

═══════════════════════════════════════════════════
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
    "expert_mode": false,
    "workflow_mode": "[LLM] Autoprompter (Naxdy Brief) / Автопромтер",
    "camera_mode": "AUTO (Listen to autoprompter) / АВТО",
    "framing_type": "medium shot",
    "fixed_distance": 1.0,
    "seconds": 15.0,
    "fps": 24,
    "max_tokens": 4096,
    "temperature": 0.7,
    "n_ctx": 8192,
    "n_gpu_layers": -1,
    "UNLOAD AFTER RUN / ВЫГРУЖАТЬ ПОСЛЕ": true,
    "manual_prompt": "",
    "subject_details": "",
};

function resetAllWidgets(node) {
    for (const [name, value] of Object.entries(DEFAULTS)) {
        setWidgetValue(node, name, value);
    }
    applyVisibility(node);
    node.setDirtyCanvas?.(true, true);
}

function scheduleReapply(node) {
    if (node.__reapplyTimer) clearTimeout(node.__reapplyTimer);
    node.__reapplyTimer = setTimeout(() => {
        applyVisibility(node);
    }, 50);
}

app.registerExtension({
    name: "Neron.AutoPrompter.Interface",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origConfigure = nodeType.prototype.onConfigure;
        const origDrawBg = nodeType.prototype.onDrawBackground;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        const origResize = nodeType.prototype.onResize;
        const origRemoved = nodeType.prototype.onRemoved;

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;

            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;

            const watch = ["expert_mode", "workflow_mode"];
            for (const name of watch) {
                const w = getWidget(node, name);
                if (!w) continue;
                const orig = w.callback;
                w.callback = function () {
                    const result = orig?.apply(this, arguments);
                    applyVisibility(node);
                    return result;
                };
            }

            node.addWidget("button", "🔄 Reset to Defaults / Сброс",
                null, () => resetAllWidgets(node));
            node.addWidget("button", "📖 Help / Справка",
                null, () => showHelpDialog());

            const runApply = () => applyVisibility(node);
            setTimeout(runApply, 100);
            setTimeout(runApply, 400);
            setTimeout(runApply, 900);

            return r;
        };

        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            const node = this;
            const runApply = () => applyVisibility(node);
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