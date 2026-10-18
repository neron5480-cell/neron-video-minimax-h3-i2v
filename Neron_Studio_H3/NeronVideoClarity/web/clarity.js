import { app } from "../../scripts/app.js";

const NODE_NAME = "NeronVideoClarity";
const MODE_WIDGET = "MODE / РЕЖИМ";
const PRESET_WIDGET = "PRESET / ПРЕСЕТ";

const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";

const GROUP_GAP = 18;

console.log("[NeronClarity] clarity.js loaded (v5.3)");

const ADVANCED_WIDGETS = [
    "VRAM PRESET / ПАМЯТЬ",
    "DEVICE / УСТРОЙСТВО",
    "AUTO CHUNK / АВТО-ЧАНК",
    "CHUNK SIZE / РАЗМЕР",
    "FLOW SCALE / ТОЧНОСТЬ",
    "STAB WINDOW / ОКНО",
    "STAB STRENGTH / СИЛА",
    "MOTION THR / ПОРОГ",
    "DEFLICK STR / СИЛА ДЕФЛИКЕРА",
    "RIFE MODEL / МОДЕЛЬ",
];

const W = {
    stabilize:   "STABILIZE / СТАБИЛИЗАЦИЯ",
    motionComp:  "MOTION COMP / КОМПЕНСАЦИЯ",
    deflicker:   "DEFLICKER / ДЕФЛИКЕР",
    brightness:  "BRIGHTNESS / ЯРКОСТЬ",
    saturation:  "SATURATION / НАСЫЩЕННОСТЬ",
    sharpen:     "SHARPEN / РЕЗКОСТЬ",
    contrast:    "CONTRAST / ОБЪЁМ",
    details:     "DETAILS / ДЕТАЛИЗАЦИЯ",
    interp:      "INTERPOLATE / ИНТЕРПОЛЯЦИЯ",
    engine:      "ENGINE / ДВИЖОК",
    multiplier:  "MULTIPLIER / МНОЖИТЕЛЬ",
    audio:       "AUDIO / ЗВУК",
    volume:      "VOLUME / ГРОМКОСТЬ",
    bass:        "BASS / БАСЫ",
    mid:         "MID / СЕРЕДИНА",
    treble:      "TREBLE / ВЕРХА",
    balance:     "BALANCE / БАЛАНС",
    vram:        "VRAM PRESET / ПАМЯТЬ",
    device:      "DEVICE / УСТРОЙСТВО",
    autoChunk:   "AUTO CHUNK / АВТО-ЧАНК",
    chunkSize:   "CHUNK SIZE / РАЗМЕР",
    flowScale:   "FLOW SCALE / ТОЧНОСТЬ",
    stabWindow:  "STAB WINDOW / ОКНО",
    stabStr:     "STAB STRENGTH / СИЛА",
    motionThr:   "MOTION THR / ПОРОГ",
    deflickStr:  "DEFLICK STR / СИЛА ДЕФЛИКЕРА",
    rifeModel:   "RIFE MODEL / МОДЕЛЬ",
    freeAfter:   "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ",
};

const DEFAULTS = {
    [W.stabilize]: true, [W.motionComp]: true, [W.deflicker]: true,
    [W.brightness]: 1.00, [W.saturation]: 1.00, [W.sharpen]: 0.30,
    [W.contrast]: 0.20, [W.details]: 0.30,
    [W.interp]: false, [W.engine]: "rife", [W.multiplier]: 2,
    [W.audio]: false, [W.volume]: 0.0, [W.bass]: 0.0, [W.mid]: 0.0,
    [W.treble]: 0.0, [W.balance]: 0.0,
    [W.vram]: "16", [W.device]: "gpu", [W.autoChunk]: true,
    [W.chunkSize]: 64, [W.flowScale]: 0.5, [W.stabWindow]: 5,
    [W.stabStr]: 0.35, [W.motionThr]: 0.08, [W.deflickStr]: 0.5,
    [W.rifeModel]: "rife49.pth",
    [W.freeAfter]: false,
};

const P = {
    manual:   "✋ Manual / Вручную",
    oldFoot:  "📼 Хроника / Old Footage",
    aiGen:    "🤖 AI Gen / AI-генерация",
    soft:     "🎬 Мягко / Soft",
    strong:   "🔥 Сильно / Strong",
    portrait: "👤 Портрет / Portrait",
    audioP:   "🔊 Звук+ / Audio Boost",
};

const PRESETS = {
    [P.manual]: null,
    [P.oldFoot]: {
        [W.stabilize]: true, [W.motionComp]: true, [W.deflicker]: true,
        [W.brightness]: 1.00, [W.saturation]: 1.00, [W.sharpen]: 0.35,
        [W.contrast]: 0.25, [W.details]: 0.35, [W.interp]: false,
    },
    [P.aiGen]: {
        [W.stabilize]: true, [W.motionComp]: true, [W.deflicker]: true,
        [W.brightness]: 1.00, [W.saturation]: 1.00, [W.sharpen]: 0.25,
        [W.contrast]: 0.15, [W.details]: 0.25, [W.interp]: false,
    },
    [P.soft]: {
        [W.stabilize]: false, [W.motionComp]: false, [W.deflicker]: false,
        [W.brightness]: 1.00, [W.saturation]: 1.00, [W.sharpen]: 0.15,
        [W.contrast]: 0.10, [W.details]: 0.15, [W.interp]: false,
    },
    [P.strong]: {
        [W.stabilize]: true, [W.motionComp]: true, [W.deflicker]: true,
        [W.brightness]: 1.00, [W.saturation]: 1.02, [W.sharpen]: 0.45,
        [W.contrast]: 0.35, [W.details]: 0.50, [W.interp]: false,
    },
    [P.portrait]: {
        [W.stabilize]: true, [W.motionComp]: true, [W.deflicker]: true,
        [W.brightness]: 1.02, [W.saturation]: 1.05, [W.sharpen]: 0.25,
        [W.contrast]: 0.15, [W.details]: 0.35, [W.interp]: false,
    },
    [P.audioP]: {
        [W.audio]: true, [W.volume]: 6.0, [W.bass]: 3.0,
        [W.mid]: 0.0, [W.treble]: 2.0, [W.balance]: 0.0,
    },
};

const HELP_TEXT = `
🎬 NERON VIDEO CLARITY
═══════════════════════════════════════════════

━━━ WHAT IT DOES ━━━
Turns "dirty" video into clean video WITHOUT upscaling.
Input resolution = output resolution.
Works: stabilization, deflicker, color, contrast,
sharpness, detail, interpolation, audio.

━━━ WHAT IT DOES NOT ━━━
It does NOT add pixels. It does NOT invent details.
It does NOT replace Topaz or latent pass.

━━━ MODES ━━━
Simple — main knobs only
Expert — plus advanced (VRAM, chunk, flow, RIFE model)

━━━ PRESETS ━━━
📼 Old Footage — shaky, grainy old video
🤖 AI Gen — generated video (MiniMax, SVD, AnimateDiff)
🎬 Soft — good source, light touch
🔥 Strong — very bad source, aggressive
👤 Portrait — faces in close-up
🔊 Audio Boost — pull up quiet audio only
✋ Manual — everything by hand

━━━ MAIN KNOBS ━━━
STABILIZE — removes detail jitter between frames
MOTION COMP — respect motion (important for video!)
DEFLICKER — removes brightness flicker
BRIGHTNESS — overall brightness (1.0 = as-is)
SATURATION — 0 = B&W, 1.0 = normal, 1.3+ = punchy
SHARPEN — edge enhancement (0.3 = normal)
CONTRAST — local contrast, gives volume (0.2 = normal)
DETAILS — micro textures (lashes, fur, skin pores)
INTERPOLATE — RIFE x2 fps (works perfectly HERE!)
VOLUME — loudness in dB (+6 = x2). Fixes quiet MiniMax.

━━━ RIFE ORDER — THE SECRET SAUCE ━━━
This is CRITICAL and most people get it wrong.

RIFE must run AFTER stabilization — and in this node it does.

If you put RIFE BEFORE stabilization, it "invents" frames
between already-jittery frames. Each synthetic frame becomes
an average of two different jitter states. Result: rippling
and artifacts that CANNOT be fixed afterwards — because
stabilization cannot tell synthetic jitter from real motion.

In this node the order is:
  stabilize -> deflicker -> color -> sharpen -> RIFE

That's why interpolation here does NOT produce artifacts.
We learned this the hard way. Enjoy.

━━━ FREE AFTER RUN ━━━
If ON: after processing, ALL models are unloaded from RAM
and VRAM. Next run will be slower (models reload from disk),
but RAM stays clean. Useful for batch processing different
videos, or on systems with limited RAM.

━━━ PITFALLS ━━━
• SHARPEN 0.5+ = white halos on edges.
• DETAILS 0.5+ = "sand" look on skin.
• VOLUME +12 dB and above = clipping (crackle).
• Too large STAB WINDOW = "frozen" motion.

━━━ HARDWARE ━━━
Minimum: 8 GB VRAM / 32 GB RAM / NVMe
Optimum: 16 GB VRAM
Auto-chunk fits chunk size to free memory.

━━━ TIP ━━━
Start with a preset. If you like the result —
fine-tune individual knobs.

═══════════════════════════════════════════════
🇷🇺 РУССКИЙ
═══════════════════════════════════════════════

━━━ ЧТО ДЕЛАЕТ ━━━
Превращает "грязное" видео в чистое БЕЗ апскейла.
Разрешение на входе = разрешение на выходе.
Работает: стабилизация, дефликер, цвет, контраст,
резкость, детализация, интерполяция, звук.

━━━ ЧЕГО НЕ ДЕЛАЕТ ━━━
Не добавляет пиксели. Не дорисовывает детали.
Не заменяет Topaz или латентный проход.

━━━ РЕЖИМЫ ━━━
Simple — основные ползунки
Expert — плюс продвинутые (VRAM, chunk, flow, RIFE)

━━━ ПРЕСЕТЫ ━━━
📼 Хроника — старое дёрганое зернистое видео
🤖 AI Gen — сгенерированное (MiniMax, SVD, AnimateDiff)
🎬 Мягко — хороший исходник, лёгкая обработка
🔥 Сильно — очень плохой исходник, жёстко
👤 Портрет — лица крупным планом
🔊 Звук+ — только подтянуть тихий звук
✋ Manual — все ползунки вручную

━━━ ГЛАВНЫЕ ПОЛЗУНКИ ━━━
STABILIZE — убирает дрожание деталей между кадрами
MOTION COMP — учитывать движение (важно для видео!)
DEFLICKER — убирает мерцание яркости
BRIGHTNESS — общая яркость (1.0 = как есть)
SATURATION — 0 = ч/б, 1.0 = норма, 1.3+ = сочно
SHARPEN — резкость краёв (0.3 = норма)
CONTRAST — локальный объём (0.2 = норма)
DETAILS — мелкие текстуры (ресницы, ворс, поры)
INTERPOLATE — RIFE x2 fps (тут работает ИДЕАЛЬНО!)
VOLUME — громкость в дБ (+6 = x2). Лечит тихий MiniMax.

━━━ ПОРЯДОК RIFE — НАШ СЕКРЕТ ━━━
Это КРИТИЧНО, и большинство делает это неправильно.

RIFE должен идти ПОСЛЕ стабилизации — у нас так и есть.

Если поставить RIFE ДО стабилизации, он "придумывает"
кадры между уже дрожащими кадрами. Каждый синтетический
кадр становится средним между двумя разными состояниями
джиттера. Результат: рябь и артефакты, которые НЕЛЬЗЯ
вылечить — потому что стабилизация не может отличить
синтетический джиттер от реального движения.

В нашей ноде порядок такой:
  stabilize -> deflicker -> color -> sharpen -> RIFE

Именно поэтому интерполяция здесь НЕ даёт артефактов.
Мы выяснили это на собственном опыте. Наслаждайся.

━━━ FREE AFTER RUN ━━━
Если ВКЛ: после обработки ВСЕ модели выгружаются из RAM
и VRAM. Следующий прогон будет медленнее (модели
загрузятся с диска), но RAM останется чистой. Полезно
при серийной обработке разных видео или на слабых
системах.

━━━ ГРАБЛИ ━━━
• SHARPEN 0.5+ даёт белые ореолы на контурах.
• DETAILS 0.5+ даёт "песочность" на коже.
• VOLUME +12 дБ и выше = клиппинг (треск).
• Слишком большое STAB WINDOW = "залипание" движения.

━━━ ЖЕЛЕЗО ━━━
Минимум: 8 GB VRAM / 32 GB RAM / NVMe
Оптимум: 16 GB VRAM
Auto-chunk подбирает размер под свободную память.

━━━ СОВЕТ ━━━
Начни с пресета. Если результат нравится —
докрути отдельные ползунки.
`;

function getWidget(node, name) {
    return node.widgets?.find(w => w.name === name);
}

function setWidgetValue(node, name, value) {
    const w = getWidget(node, name);
    if (!w) return;
    w.value = value;
    try {
        w.callback?.(value, app.canvas, node, [0, 0], null);
    } catch (_) {}
}

function showHelpDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;" +
        "display:flex;align-items:center;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText =
        "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
        "border-radius:8px;padding:20px;max-width:720px;max-height:80vh;" +
        "overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP_TEXT;
    const btn = document.createElement("button");
    btn.textContent = "Close / Закрыть";
    btn.style.cssText =
        "display:block;margin:16px auto 0;padding:8px 24px;" +
        "background:#2a5d9c;color:#fff;border:none;border-radius:4px;" +
        "cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

function hideWidget(widget) {
    if (widget.__neronHidden) return;
    widget.__neronHidden = true;
    widget.__neronOrigType = widget.type;
    widget.__neronOrigComputeSize = widget.computeSize;
    widget.type = "hidden";
    widget.computeSize = () => [0, -4];
}

function showWidget(widget) {
    if (!widget.__neronHidden) return;
    widget.__neronHidden = false;
    widget.type = widget.__neronOrigType;
    if (widget.__neronOrigComputeSize) {
        widget.computeSize = widget.__neronOrigComputeSize;
    } else {
        delete widget.computeSize;
    }
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

function applyGroupGaps(node) {
    if (!node.widgets) return;

    for (const w of node.widgets) clearBottomPadding(w);

    const presetW = node.widgets.find(w => w.name === PRESET_WIDGET);
    if (presetW) setBottomPadding(presetW, GROUP_GAP);

    const visibleGroups = [];
    for (const g of GROUPS) {
        const hasVisible = g.widgets.some(name => {
            const w = node.widgets.find(x => x.name === name);
            return w && !w.__neronHidden;
        });
        if (hasVisible) visibleGroups.push(g);
    }

    for (let gi = 0; gi < visibleGroups.length - 1; gi++) {
        const g = visibleGroups[gi];
        let lastVisible = null;
        for (const name of g.widgets) {
            const w = node.widgets.find(x => x.name === name);
            if (w && !w.__neronHidden) lastVisible = w;
        }
        if (lastVisible) setBottomPadding(lastVisible, GROUP_GAP);
    }

    const lastGroup = visibleGroups[visibleGroups.length - 1];
    if (lastGroup) {
        let lastVisible = null;
        for (const name of lastGroup.widgets) {
            const w = node.widgets.find(x => x.name === name);
            if (w && !w.__neronHidden) lastVisible = w;
        }
        if (lastVisible) setBottomPadding(lastVisible, GROUP_GAP);
    }
}

function applyMode(node, mode) {
    if (!node.widgets) return;
    const isExpert = (mode === "Expert");
    let changed = false;

    for (const w of node.widgets) {
        if (ADVANCED_WIDGETS.includes(w.name)) {
            if (isExpert) {
                if (w.__neronHidden) { showWidget(w); changed = true; }
            } else {
                if (!w.__neronHidden) { hideWidget(w); changed = true; }
            }
        }
    }

    console.log(`[NeronClarity] applyMode: mode=${mode}, changed=${changed}, widgets=${node.widgets.length}`);

    applyGroupGaps(node);

    const sz = node.computeSize();
    node.setSize([Math.max(sz[0], node.size[0]), sz[1]]);
    node.setDirtyCanvas(true, true);
}

let applyingPreset = false;

function applyPreset(node, presetName) {
    const values = PRESETS[presetName];
    if (!values) return;
    applyingPreset = true;
    for (const [name, value] of Object.entries(values)) {
        setWidgetValue(node, name, value);
    }
    applyingPreset = false;
    node.setDirtyCanvas?.(true, true);
}

function resetAllWidgets(node) {
    applyingPreset = true;
    for (const [name, value] of Object.entries(DEFAULTS)) {
        setWidgetValue(node, name, value);
    }
    setWidgetValue(node, MODE_WIDGET, "Simple");
    setWidgetValue(node, PRESET_WIDGET, P.manual);
    applyingPreset = false;
    applyMode(node, "Simple");
    node.setDirtyCanvas?.(true, true);
}

const GROUPS = [
    {
        name: "ВИДЕО / VIDEO",
        widgets: [
            "STABILIZE / СТАБИЛИЗАЦИЯ",
            "MOTION COMP / КОМПЕНСАЦИЯ",
            "DEFLICKER / ДЕФЛИКЕР",
        ],
        fill:   "rgba( 90, 140, 200, 0.15)",
        border: "rgba( 90, 140, 200, 0.75)",
        label:  "rgba(180, 215, 255, 1.0)",
    },
    {
        name: "ЦВЕТ И ДЕТАЛИ / COLOR & DETAIL",
        widgets: [
            "BRIGHTNESS / ЯРКОСТЬ",
            "SATURATION / НАСЫЩЕННОСТЬ",
            "SHARPEN / РЕЗКОСТЬ",
            "CONTRAST / ОБЪЁМ",
            "DETAILS / ДЕТАЛИЗАЦИЯ",
        ],
        fill:   "rgba(200, 160,  90, 0.15)",
        border: "rgba(200, 160,  90, 0.75)",
        label:  "rgba(255, 225, 170, 1.0)",
    },
    {
        name: "ИНТЕРПОЛЯЦИЯ / INTERPOLATION",
        widgets: [
            "INTERPOLATE / ИНТЕРПОЛЯЦИЯ",
            "ENGINE / ДВИЖОК",
            "MULTIPLIER / МНОЖИТЕЛЬ",
        ],
        fill:   "rgba(160,  90, 200, 0.15)",
        border: "rgba(160,  90, 200, 0.75)",
        label:  "rgba(225, 180, 255, 1.0)",
    },
    {
        name: "ЗВУК / AUDIO",
        widgets: [
            "AUDIO / ЗВУК",
            "VOLUME / ГРОМКОСТЬ",
            "BASS / БАСЫ",
            "MID / СЕРЕДИНА",
            "TREBLE / ВЕРХА",
            "BALANCE / БАЛАНС",
        ],
        fill:   "rgba( 90, 200, 160, 0.15)",
        border: "rgba( 90, 200, 160, 0.75)",
        label:  "rgba(180, 255, 225, 1.0)",
    },
    {
        name: "ПРОДВИНУТЫЕ / ADVANCED",
        widgets: [
            "VRAM PRESET / ПАМЯТЬ",
            "DEVICE / УСТРОЙСТВО",
            "AUTO CHUNK / АВТО-ЧАНК",
            "CHUNK SIZE / РАЗМЕР",
            "FLOW SCALE / ТОЧНОСТЬ",
            "STAB WINDOW / ОКНО",
            "STAB STRENGTH / СИЛА",
            "MOTION THR / ПОРОГ",
            "DEFLICK STR / СИЛА ДЕФЛИКЕРА",
            "RIFE MODEL / МОДЕЛЬ",
        ],
        fill:   "rgba(200,  90,  90, 0.15)",
        border: "rgba(200,  90,  90, 0.75)",
        label:  "rgba(255, 180, 180, 1.0)",
    },
];

function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
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

function drawGroups(node, ctx) {
    if (!node.widgets) return;
    const nodeW = node.size[0];
    const padX = 10;
    const labelH = 16;
    const cornerR = 10;

    ctx.save();

    for (const g of GROUPS) {
        const vis = [];
        for (const w of node.widgets) {
            if (g.widgets.includes(w.name) && !w.__neronHidden) vis.push(w);
        }
        if (vis.length === 0) continue;

        let y0 = Infinity, y1 = -Infinity;
        for (const w of vis) {
            const y = w.last_y;
            if (y === undefined) continue;
            let h = 24;
            try {
                if (w.computeSize) {
                    const s = w.computeSize(node.size[0]);
                    if (s && s[1] != null) h = s[1];
                }
            } catch (e) {}
            const pad = w.__neronBottomPadding || 0;
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y + h - pad);
        }
        if (!isFinite(y0) || y1 <= y0) continue;

        const rectX = padX;
        const rectY = y0 - labelH;
        const rectW = nodeW - padX * 2;
        const rectH = (y1 - y0) + labelH;

        ctx.fillStyle = g.fill;
        roundRect(ctx, rectX, rectY, rectW, rectH, cornerR);
        ctx.fill();

        ctx.strokeStyle = g.border;
        ctx.lineWidth = 1.5;
        roundRect(ctx, rectX, rectY, rectW, rectH, cornerR);
        ctx.stroke();

        ctx.fillStyle = g.label;
        ctx.font = "bold 10px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(g.name, rectX + 12, rectY + labelH / 2 + 1);
    }

    const resetW = node.widgets.find(w => w.name && w.name.startsWith("🔄 Reset"));
    if (resetW && resetW.last_y !== undefined) {
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

app.registerExtension({
    name: "Neron.VideoClarity.v5.3",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;

            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;

            const modeWidget = getWidget(node, MODE_WIDGET);
            if (modeWidget) {
                const origCb = modeWidget.callback;
                modeWidget.callback = function (value, ...args) {
                    const res = origCb?.apply(this, [value, ...args]);
                    applyMode(node, value);
                    return res;
                };
            }

            const presetWidget = getWidget(node, PRESET_WIDGET);
            if (presetWidget) {
                const origCb = presetWidget.callback;
                presetWidget.callback = function (value, ...args) {
                    const res = origCb?.apply(this, [value, ...args]);
                    if (!applyingPreset && value && value !== P.manual) {
                        applyingPreset = true;
                        applyPreset(node, value);
                        applyingPreset = false;
                    }
                    return res;
                };
            }

            const WATCHED = [
                W.stabilize, W.motionComp, W.deflicker,
                W.brightness, W.saturation, W.sharpen, W.contrast, W.details,
                W.interp, W.engine, W.multiplier,
                W.audio, W.volume, W.bass, W.mid, W.treble, W.balance,
                W.vram, W.device, W.autoChunk, W.chunkSize,
                W.flowScale, W.stabWindow, W.stabStr, W.motionThr,
                W.deflickStr, W.rifeModel, W.freeAfter,
            ];
            for (const name of WATCHED) {
                const w = getWidget(node, name);
                if (!w) continue;
                const origCb = w.callback;
                w.callback = function (value, ...args) {
                    const res = origCb?.apply(this, [value, ...args]);
                    if (!applyingPreset) {
                        const pw = getWidget(node, PRESET_WIDGET);
                        if (pw && pw.value !== P.manual) {
                            pw.value = P.manual;
                            try { pw.callback?.(P.manual, app.canvas, node, [0, 0], null); } catch (_) {}
                        }
                    }
                    return res;
                };
            }

            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => {
                resetAllWidgets(node);
            });
            node.addWidget("button", "📖 Help / Справка", null, () => {
                showHelpDialog();
            });

            setTimeout(() => applyMode(node, modeWidget?.value || "Simple"), 100);
            return r;
        };

        const origConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            const node = this;
            setTimeout(() => {
                const modeWidget = getWidget(node, MODE_WIDGET);
                if (modeWidget) applyMode(node, modeWidget.value);
            }, 200);
            return r;
        };

        const onDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (onDrawBackground) onDrawBackground.apply(this, arguments);
            if (this.flags && this.flags.collapsed) return;
            drawGroups(this, ctx);
        };
    },
});