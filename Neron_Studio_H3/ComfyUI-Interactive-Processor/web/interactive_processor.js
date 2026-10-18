import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "InteractiveImageProcessor";

const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";

const GROUP_GAP = 18;

const MIN_PREVIEW_HEIGHT = 320;
const INFO_HEIGHT = 30;
const UPDATE_DELAY_MS = 40;
const MAX_RENDER_SCALE = 4;

const LABEL_FONT = "bold 10px sans-serif";

const PRESET_SIZES = {
    "1024x1024 (1:1 Square)": [1024, 1024],
    "1216x832 (3:2 Landscape)": [1216, 832],
    "832x1216 (2:3 Portrait)": [832, 1216],
    "1344x768 (16:9 Cinema)": [1344, 768],
    "768x1344 (9:16 Vertical)": [768, 1344],
    "1536x640 (21:9 UltraWide)": [1536, 640],
};

const ASPECT_RATIOS = {
    "1:1": 1,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "3:2": 3 / 2,
    "21:9": 21 / 9,
};

const MEGAPIXELS = {
    "0.5 MP": 524288,
    "1.0 MP (1024x1024)": 1048576,
    "2.0 MP": 2097152,
    "4.0 MP": 4194304,
    "8.0 MP": 8388608,
};

const MODE_WIDGETS = [
    ["Standard Presets", ["ai_preset"]],
    ["Aspect Ratio", ["aspect_ratio", "max_dimension"]],
    ["Manual", ["manual_width", "manual_height"]],
    ["Megapixels", ["megapixels"]],
];
const ALL_SIZE_WIDGETS = MODE_WIDGETS.flatMap(([, names]) => names);
const UPSCALE_WIDGETS = ["upscale_scale", "upscale_precision", "upscale_speed"];
const COLOR_WIDGETS = [
    "BRIGHTNESS / ЯРКОСТЬ",
    "CONTRAST / КОНТРАСТ",
    "SATURATION / НАСЫЩЕННОСТЬ",
    "SHARPNESS / РЕЗКОСТЬ",
];

const WATCHED = new Set([
    "image", "resize_mode", "divisible_by",
    ...ALL_SIZE_WIDGETS,
    ...COLOR_WIDGETS,
    "upscale", "upscale_scale",
]);

const GROUPS = [
    {
        name: "ИЗОБРАЖЕНИЕ / IMAGE",
        widgets: ["image", "resize_mode"],
        fill:   "rgba( 90, 140, 200, 0.15)",
        border: "rgba( 90, 140, 200, 0.75)",
        label:  "rgba(180, 215, 255, 1.0)",
    },
    {
        name: "РАЗМЕР / SIZE",
        widgets: [
            "ai_preset", "aspect_ratio", "max_dimension",
            "manual_width", "manual_height",
            "megapixels", "divisible_by",
        ],
        fill:   "rgba(200, 160,  90, 0.15)",
        border: "rgba(200, 160,  90, 0.75)",
        label:  "rgba(255, 225, 170, 1.0)",
    },
    {
        name: "ЦВЕТ / COLOR",
        widgets: COLOR_WIDGETS,
        fill:   "rgba(160,  90, 200, 0.15)",
        border: "rgba(160,  90, 200, 0.75)",
        label:  "rgba(225, 180, 255, 1.0)",
    },
    {
        name: "АПСКЕЙЛ / UPSCALE",
        widgets: ["upscale", ...UPSCALE_WIDGETS],
        fill:   "rgba(120, 200, 160, 0.15)",
        border: "rgba(120, 200, 160, 0.75)",
        label:  "rgba(190, 255, 220, 1.0)",
    },
];

const getWidget = (node, name) => node.widgets?.find((w) => w.name === name);

const getValue = (node, name, fallback) => getWidget(node, name)?.value ?? fallback;

const roundToDivisible = (value, d) => Math.max(d, Math.floor((value + Math.floor(d / 2)) / d) * d);

function setWidgetValue(node, name, value) {
    const w = getWidget(node, name);
    if (!w) return;
    w.value = value;
    try {
        w.callback?.(value, app.canvas, node, [0, 0], null);
    } catch (_) {}
}

function toggleWidget(widget, show) {
    if (!widget) return;
    if (widget.__origType === undefined) {
        widget.__origType = widget.type;
        widget.__origComputeSize = widget.computeSize;
    }
    widget.type = show ? widget.__origType : "converted-widget";
    widget.computeSize = show ? widget.__origComputeSize : () => [0, -4];
    widget.hidden = !show;
}

function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return;
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

function isWidgetVisible(w) {
    return w && !w.hidden && w.type !== "converted-widget";
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
        if (g.widgets.includes(w.name) && isWidgetVisible(w)) vis.push(w);
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

    return {
        x: padX,
        y: y0 - labelH,
        w: nodeW - padX * 2,
        h: (y1 - y0) + labelH,
    };
}

function applyGroupGaps(node) {
    if (!node.widgets) return;

    for (const w of node.widgets) clearBottomPadding(w);

    const visibleGroups = [];
    for (const g of GROUPS) {
        const hasVisible = g.widgets.some((name) => {
            const w = node.widgets.find((x) => x.name === name);
            return isWidgetVisible(w);
        });
        if (hasVisible) visibleGroups.push(g);
    }

    for (let gi = 0; gi < visibleGroups.length; gi++) {
        const g = visibleGroups[gi];
        let lastVisible = null;
        for (const name of g.widgets) {
            const w = node.widgets.find((x) => x.name === name);
            if (isWidgetVisible(w)) lastVisible = w;
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
        ctx.lineWidth = 1.5;
        roundRect(ctx, rect.x, rect.y, rect.w, rect.h, cornerR);
        ctx.stroke();
    }

    const resetW = node.widgets.find((w) => w.name && w.name.indexOf("Reset") !== -1);
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

function updateVisibility(node) {
    try {
        const mode = String(getValue(node, "resize_mode", ""));
        const active = new Set(MODE_WIDGETS.find(([key]) => mode.includes(key))?.[1] ?? []);

        for (const name of ALL_SIZE_WIDGETS) {
            toggleWidget(getWidget(node, name), active.has(name));
        }

        const upscaleOn = String(getValue(node, "upscale", "")).trim() === "Enabled / Вкл";

        for (const name of UPSCALE_WIDGETS) {
            toggleWidget(getWidget(node, name), upscaleOn);
        }

        applyGroupGaps(node);
        node.setDirtyCanvas?.(true, true);
    } catch (error) {
        console.warn("[Interactive Image Processor] visibility:", error);
    }
}

function calculateOutputSize(node, origW, origH) {
    const mode = String(getValue(node, "resize_mode", ""));
    const divisibleBy = Math.max(1, Number(getValue(node, "divisible_by", 32)));

    let width = origW;
    let height = origH;

    if (mode.includes("Standard Presets")) {
        [width, height] = PRESET_SIZES[getValue(node, "ai_preset", "")] ?? [1024, 1024];
    } else if (mode.includes("Aspect Ratio")) {
        const ratio = ASPECT_RATIOS[getValue(node, "aspect_ratio", "1:1")] ?? 1;
        const maxDim = Number(getValue(node, "max_dimension", 1024));
        if (ratio >= 1) {
            width = maxDim;
            height = Math.round(maxDim / ratio);
        } else {
            height = maxDim;
            width = Math.round(maxDim * ratio);
        }
    } else if (mode.includes("Manual")) {
        width = Number(getValue(node, "manual_width", 1024));
        height = Number(getValue(node, "manual_height", 1024));
    } else if (mode.includes("Megapixels")) {
        const pixels = MEGAPIXELS[getValue(node, "megapixels", "")] ?? 1048576;
        const ratio = origW / origH;
        width = Math.round(Math.sqrt(pixels * ratio));
        height = Math.round(Math.sqrt(pixels / ratio));
    }

    if (divisibleBy > 1) {
        width = roundToDivisible(width, divisibleBy);
        height = roundToDivisible(height, divisibleBy);
    }

    width = Math.max(divisibleBy, width);
    height = Math.max(divisibleBy, height);

    const upscaleOn = String(getValue(node, "upscale", "")).trim() === "Enabled / Вкл";
    const scale = Number(getValue(node, "upscale_scale", 2));
    const modelConnected = node.inputs?.find((i) => i.name === "upscale_model")?.link != null;

    const doUpscale = upscaleOn && modelConnected;

    return {
        baseWidth: width,
        baseHeight: height,
        finalWidth: doUpscale ? Math.max(1, Math.round(width * scale)) : width,
        finalHeight: doUpscale ? Math.max(1, Math.round(height * scale)) : height,
        upscaleOn,
        modelConnected,
        scale,
        divisibleBy,
    };
}

function parseImageValue(value) {
    let filename = String(value ?? "");
    let type = "input";

    const annotation = filename.match(/\s+\[(input|output|temp)\]$/i);
    if (annotation) {
        type = annotation[1].toLowerCase();
        filename = filename.slice(0, annotation.index);
    }

    filename = filename.replaceAll("\\", "/");
    const slash = filename.lastIndexOf("/");
    const subfolder = slash >= 0 ? filename.slice(0, slash) : "";
    if (slash >= 0) filename = filename.slice(slash + 1);

    return { filename, subfolder, type };
}

function buildImageUrl(value) {
    const { filename, subfolder, type } = parseImageValue(value);
    if (!filename) return null;

    const params = new URLSearchParams({
        filename, type, subfolder, _preview: String(Date.now()),
    });
    return api.apiURL(`/view?${params.toString()}`);
}

function makeCanvas(width, height, readable = false) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: readable,
    });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { canvas, ctx };
}

function resample(source, srcW, srcH, dstW, dstH) {
    let current = source;
    let curW = srcW;
    let curH = srcH;

    while (curW / 2 >= dstW || curH / 2 >= dstH) {
        const nextW = Math.max(dstW, Math.ceil(curW / 2));
        const nextH = Math.max(dstH, Math.ceil(curH / 2));
        const step = makeCanvas(nextW, nextH);
        step.ctx.drawImage(current, 0, 0, curW, curH, 0, 0, nextW, nextH);
        current = step.canvas;
        curW = nextW;
        curH = nextH;
    }

    const last = makeCanvas(dstW, dstH, true);
    last.ctx.fillStyle = "#000";
    last.ctx.fillRect(0, 0, dstW, dstH);
    last.ctx.drawImage(current, 0, 0, curW, curH, 0, 0, dstW, dstH);
    return last;
}

function channelMeans(imageData) {
    const d = imageData.data;
    const n = d.length / 4;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
    }
    return [r / n, g / n, b / n];
}

function sharpen(buf, w, h, amount) {
    const tmp = new Float32Array(buf.length);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const x0 = Math.max(x - 1, 0);
            const x2 = Math.min(x + 1, w - 1);
            const i = (y * w + x) * 3;
            const a = (y * w + x0) * 3;
            const c = (y * w + x2) * 3;
            for (let ch = 0; ch < 3; ch++) {
                tmp[i + ch] = (buf[a + ch] + buf[i + ch] + buf[c + ch]) / 3;
            }
        }
    }

    for (let y = 0; y < h; y++) {
        const y0 = Math.max(y - 1, 0);
        const y2 = Math.min(y + 1, h - 1);
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;
            const a = (y0 * w + x) * 3;
            const c = (y2 * w + x) * 3;
            for (let ch = 0; ch < 3; ch++) {
                const blurred = (tmp[a + ch] + tmp[i + ch] + tmp[c + ch]) / 3;
                buf[i + ch] += (buf[i + ch] - blurred) * amount;
            }
        }
    }
}

function processPixels(base, s) {
    const { imageData, means } = base;
    const { width, height, data } = imageData;
    const count = width * height;
    const buf = new Float32Array(count * 3);

    const bright = s.brightness * 255;

    for (let p = 0; p < count; p++) {
        const i = p * 4;
        const o = p * 3;

        let r = (data[i] - means[0]) * s.contrast + means[0] + bright;
        let g = (data[i + 1] - means[1]) * s.contrast + means[1] + bright;
        let b = (data[i + 2] - means[2]) * s.contrast + means[2] + bright;

        if (s.saturation !== 1) {
            const gray = r * 0.299 + g * 0.587 + b * 0.114;
            r = gray + (r - gray) * s.saturation;
            g = gray + (g - gray) * s.saturation;
            b = gray + (b - gray) * s.saturation;
        }

        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
    }

    if (s.sharpness > 0) sharpen(buf, width, height, s.sharpness);

    const out = new ImageData(width, height);
    const od = out.data;
    for (let p = 0; p < count; p++) {
        const i = p * 4;
        const o = p * 3;
        od[i] = buf[o];
        od[i + 1] = buf[o + 1];
        od[i + 2] = buf[o + 2];
        od[i + 3] = 255;
    }
    return out;
}

function getRenderScale() {
    const dpr = window.devicePixelRatio || 1;
    const zoom = app.canvas?.ds?.scale || 1;
    const scale = Math.min(MAX_RENDER_SCALE, Math.max(1, dpr * zoom));
    return Math.round(scale * 2) / 2;
}

function createPreview(node) {
    const root = document.createElement("div");
    const area = document.createElement("div");
    const canvas = document.createElement("canvas");
    const message = document.createElement("div");
    const info = document.createElement("div");

    root.style.cssText =
        "display:flex;flex-direction:column;width:100%;" +
        "min-width:0;box-sizing:border-box;overflow:hidden;" +
        "background:#1a0e08;border:1px solid #4a2f1e";

    area.style.cssText =
        "position:relative;flex:1 1 auto;min-height:0;min-width:0;" +
        "overflow:hidden;background:#1a0e08";

    canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;display:block";

    message.textContent = "Выберите изображение";
    message.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;" +
        "justify-content:center;padding:12px;color:#aa8877;" +
        "font:13px sans-serif;text-align:center;pointer-events:none";

    info.style.cssText =
        `flex:0 0 ${INFO_HEIGHT}px;display:flex;align-items:center;` +
        "justify-content:center;padding:0 8px;box-sizing:border-box;" +
        "overflow:hidden;color:#e0d5c5;background:#2e1c10;" +
        "font:12px sans-serif;white-space:nowrap;text-overflow:ellipsis";

    area.append(canvas, message);
    root.append(area, info);

    const ctx = canvas.getContext("2d", { alpha: false });

    let sourceImage = null;
    let loadedValue = null;
    let base = null;
    let timer = null;
    let renderToken = 0;
    let lastScale = 0;

    async function loadSelectedImage() {
        const value = getValue(node, "image", "");

        if (!value) {
            sourceImage = null;
            loadedValue = null;
            base = null;
            message.textContent = "Выберите изображение";
            message.style.display = "flex";
            info.textContent = "";
            return;
        }

        const serialized = JSON.stringify(value);
        if (serialized === loadedValue && sourceImage) return;

        const url = buildImageUrl(value);
        if (!url) return;

        const image = new Image();
        image.crossOrigin = "anonymous";

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = url;
        });

        sourceImage = image;
        loadedValue = serialized;
        base = null;
        message.style.display = "none";
    }

    function getBase(width, height) {
        const key = `${loadedValue}|${width}x${height}`;
        if (base?.key === key) return base;

        const { ctx: c } = resample(
            sourceImage,
            sourceImage.naturalWidth,
            sourceImage.naturalHeight,
            width,
            height,
        );
        const imageData = c.getImageData(0, 0, width, height);

        base = { key, imageData, means: channelMeans(imageData) };
        return base;
    }

    async function render() {
        const token = ++renderToken;

        try {
            await loadSelectedImage();
            if (token !== renderToken) return;

            const cssW = area.clientWidth;
            const cssH = area.clientHeight;
            if (!cssW || !cssH) return;

            const scale = getRenderScale();
            lastScale = scale;

            const W = Math.round(cssW * scale);
            const H = Math.round(cssH * scale);

            if (canvas.width !== W || canvas.height !== H) {
                canvas.width = W;
                canvas.height = H;
            }

            ctx.fillStyle = "#1a0e08";
            ctx.fillRect(0, 0, W, H);

            if (!sourceImage) return;

            const out = calculateOutputSize(
                node,
                sourceImage.naturalWidth,
                sourceImage.naturalHeight,
            );

            const ratio = out.baseWidth / out.baseHeight;
            let dw = W;
            let dh = Math.round(W / ratio);
            if (dh > H) {
                dh = H;
                dw = Math.round(H * ratio);
            }
            dw = Math.max(1, dw);
            dh = Math.max(1, dh);

            const frame = processPixels(getBase(dw, dh), {
                brightness: Number(getValue(node, "BRIGHTNESS / ЯРКОСТЬ", 0)),
                contrast: Number(getValue(node, "CONTRAST / КОНТРАСТ", 1)),
                saturation: Number(getValue(node, "SATURATION / НАСЫЩЕННОСТЬ", 1)),
                sharpness: Number(getValue(node, "SHARPNESS / РЕЗКОСТЬ", 0)),
            });

            ctx.putImageData(
                frame,
                Math.floor((W - dw) / 2),
                Math.floor((H - dh) / 2),
            );

            let text =
                `${sourceImage.naturalWidth} x ${sourceImage.naturalHeight}` +
                ` → ${out.finalWidth} x ${out.finalHeight}`;

            if (
                out.baseWidth !== sourceImage.naturalWidth ||
                out.baseHeight !== sourceImage.naturalHeight
            ) {
                text += ` (кратно ${out.divisibleBy})`;
            }
            if (out.upscaleOn && out.modelConnected) {
                text += ` | AI-апскейл ${out.scale.toFixed(2)}x при запуске`;
            } else if (out.upscaleOn) {
                text += " | апскейл включён, но модель не подключена";
            }

            info.textContent = text;
        } catch (error) {
            console.error("[Interactive Image Processor] Preview error:", error);
            message.textContent = "Не удалось показать изображение";
            message.style.display = "flex";
        }
    }

    function scheduleRender() {
        window.clearTimeout(timer);
        timer = window.setTimeout(render, UPDATE_DELAY_MS);
    }

    function checkScale() {
        if (sourceImage && getRenderScale() !== lastScale) scheduleRender();
    }

    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(scheduleRender);
        observer.observe(area);
    }

    return {
        root,
        scheduleRender,
        checkScale,
        destroy() {
            window.clearTimeout(timer);
            observer?.disconnect();
        },
    };
}

const DEFAULTS = {
    "resize_mode": "Standard Presets / Пресеты",
    "ai_preset": "1024x1024 (1:1 Square)",
    "aspect_ratio": "1:1",
    "max_dimension": 1024,
    "manual_width": 1024,
    "manual_height": 1024,
    "megapixels": "1.0 MP (1024x1024)",
    "divisible_by": 32,
    "BRIGHTNESS / ЯРКОСТЬ": 0.0,
    "CONTRAST / КОНТРАСТ": 1.0,
    "SATURATION / НАСЫЩЕННОСТЬ": 1.0,
    "SHARPNESS / РЕЗКОСТЬ": 0.0,
    "upscale": "Disabled / Откл",
    "upscale_scale": 2.0,
    "upscale_precision": "Fast fp16 / Быстро",
    "upscale_speed": "Quality / Качество",
};

const HELP_TEXT = `
🖼 INTERACTIVE IMAGE PROCESSOR
═══════════════════════════════════════════════════

━━━ WHAT IT IS ━━━
A single node for preparing the start frame:
load → resize → color → upscale (optional).
Live preview right inside the node.

━━━ IMAGE ━━━
Pick a file. Any size, any format.

━━━ SIZE ━━━
Four modes:
  • Presets          — 1024x1024, 16:9, 9:16, 21:9 etc.
  • Aspect Ratio     — keep proportion, set limit.
  • Manual           — exact width and height.
  • Megapixels       — size by pixel count.

divisible_by — rounding to a multiple
(32 = MiniMax H3 requirement).

━━━ COLOR ━━━
Brightness, contrast, saturation, sharpness.
Preview updates on the fly — no Queue needed.

━━━ UPSCALE ━━━
Optional AI upscale. Connect a model
to the 'upscale_model' input.

━━━ LIVE PREVIEW ━━━
The bottom window shows the processed frame.
Drag any slider — the preview updates instantly.
Resolution is NOT artificially cut — full size.

━━━ OUTPUTS ━━━
IMAGE, MASK, width, height.

═══════════════════════════════════════════════════
🇷🇺 РУССКИЙ
═══════════════════════════════════════════════════

━━━ ЧТО ЭТО ━━━
Одна нода для подготовки стартового кадра:
загрузка → ресайз → цвет → апскейл (опционально).
Живое превью прямо внутри ноды.

━━━ ИЗОБРАЖЕНИЕ ━━━
Выбери файл. Любой размер, любой формат.

━━━ РАЗМЕР / SIZE ━━━
Четыре режима:
  • Пресеты          — 1024x1024, 16:9, 9:16, 21:9 и т.д.
  • Соотношение      — сохранить пропорцию, задать предел.
  • Ручной           — точная ширина и высота.
  • Мегапиксели      — размер по количеству пикселей.

divisible_by — округление до кратности
(32 = требование MiniMax H3).

━━━ ЦВЕТ / COLOR ━━━
Яркость, контраст, насыщенность, резкость.
Превью обновляется на лету — Queue не нужен.

━━━ АПСКЕЙЛ / UPSCALE ━━━
Опциональный AI-апскейл. Подключи модель
ко входу 'upscale_model'.

━━━ ЖИВОЕ ПРЕВЬЮ ━━━
В нижнем окне — обработанный кадр.
Двигай любой ползунок — превью обновляется мгновенно.
Разрешение НЕ урезается искусственно — полный размер.

━━━ ВЫХОДЫ ━━━
IMAGE, MASK, width, height.

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

function resetAllWidgets(node) {
    for (const [name, value] of Object.entries(DEFAULTS)) {
        setWidgetValue(node, name, value);
    }
    updateVisibility(node);
    node.setDirtyCanvas?.(true, true);
}

app.registerExtension({
    name: "Neron.InteractiveImageProcessor",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origRemoved = nodeType.prototype.onRemoved;
        const origDrawBg = nodeType.prototype.onDrawBackground;
        const origDrawFg = nodeType.prototype.onDrawForeground;

        nodeType.prototype.onNodeCreated = function () {
            const result = origCreated?.apply(this, arguments);
            const node = this;

            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;

            // === ФИКС НАЛОЖЕНИЯ ===
            // Невидимая распорка сверху, чтобы сдвинуть виджеты вниз
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.draw = function() {}; 
            spacer.computeSize = () => [0, 20]; 
            node.widgets.unshift(spacer);
            // =======================

            const preview = createPreview(node);
            node.__interactivePreview = preview;

            const domWidget = node.addDOMWidget(
                "interactive_preview",
                "preview",
                preview.root,
                {
                    serialize: false,
                    hideOnZoom: false,
                    getMinHeight: () => MIN_PREVIEW_HEIGHT + INFO_HEIGHT,
                },
            );

            if (domWidget) {
                const originalComputeSize = domWidget.computeSize;
                domWidget.computeSize = function (width) {
                    return [width, MIN_PREVIEW_HEIGHT + INFO_HEIGHT];
                };
            }

            for (const widget of node.widgets ?? []) {
                if (!WATCHED.has(widget.name)) continue;

                const original = widget.callback;
                widget.callback = function () {
                    const r = original?.apply(this, arguments);
                    if (widget.name === "resize_mode" || widget.name === "upscale") {
                        updateVisibility(node);
                    }
                    preview.scheduleRender();
                    return r;
                };
            }

            node.addWidget("button", "🔄 Reset to Defaults / Сброс",
                null, () => resetAllWidgets(node));
            node.addWidget("button", "📖 Help / Справка",
                null, () => showHelpDialog());

            const origConfigure = node.onConfigure;
            node.onConfigure = function () {
                const r = origConfigure?.apply(this, arguments);
                window.setTimeout(() => {
                    updateVisibility(node);
                    preview.scheduleRender();
                }, 100);
                return r;
            };

            window.setTimeout(preview.scheduleRender, 150);

            return result;
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

        nodeType.prototype.onRemoved = function () {
            this.__interactivePreview?.destroy();
            return origRemoved?.apply(this, arguments);
        };
    },
});