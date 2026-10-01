import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "InteractiveImageProcessor";

const MIN_PREVIEW_HEIGHT = 300;
const INFO_HEIGHT = 30;
const UPDATE_DELAY_MS = 40;
const MAX_RENDER_SCALE = 3;
const MAX_PREVIEW_PIXELS = 4_000_000;

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

// Какие виджеты нужны в каком режиме изменения размера.
const MODE_WIDGETS = [
    ["Standard Presets", ["ai_preset"]],
    ["Aspect Ratio", ["aspect_ratio", "max_dimension"]],
    ["Manual", ["manual_width", "manual_height"]],
    ["Megapixels", ["megapixels"]],
];
const ALL_SIZE_WIDGETS = MODE_WIDGETS.flatMap(([, names]) => names);
const UPSCALE_WIDGETS = ["upscale_scale", "upscale_precision", "upscale_speed"];

// Виджеты, изменение которых перерисовывает превью.
const WATCHED = new Set([
    "image", "resize_mode", "divisible_by",
    ...ALL_SIZE_WIDGETS,
    "BRIGHTNESS / ЯРКОСТЬ", "CONTRAST / КОНТРАСТ",
    "SATURATION / НАСЫЩЕННОСТЬ", "SHARPNESS / РЕЗКОСТЬ",
    "upscale", "upscale_scale",
]);


// ---------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------

const getWidget = (node, name) =>
    node.widgets?.find((w) => w.name === name);

const getValue = (node, name, fallback) =>
    getWidget(node, name)?.value ?? fallback;

const roundToDivisible = (value, d) =>
    Math.max(d, Math.floor((value + Math.floor(d / 2)) / d) * d);


// Показать / спрятать виджет (способ, проверенный в других расширениях).
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


function updateVisibility(node) {
    try {
        const mode = String(getValue(node, "resize_mode", ""));
        const active = new Set(
            MODE_WIDGETS.find(([key]) => mode.includes(key))?.[1] ?? [],
        );

        for (const name of ALL_SIZE_WIDGETS) {
            toggleWidget(getWidget(node, name), active.has(name));
        }

        const upscaleOn = String(getValue(node, "upscale", "")).trim()
            === "Enabled / Вкл";

        for (const name of UPSCALE_WIDGETS) {
            toggleWidget(getWidget(node, name), upscaleOn);
        }

        node.setDirtyCanvas?.(true, true);
    } catch (error) {
        // Если что-то пошло не так, виджеты просто остаются видимыми.
        console.warn("[Interactive Image Processor] visibility:", error);
    }
}


// ---------------------------------------------------------------
// Расчёт итогового размера (повторяет логику Python-части)
// ---------------------------------------------------------------

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

    const upscaleOn = String(getValue(node, "upscale", "")).trim()
        === "Enabled / Вкл";
    const scale = Number(getValue(node, "upscale_scale", 2));
    const modelConnected =
        node.inputs?.find((i) => i.name === "upscale_model")?.link != null;

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


// ---------------------------------------------------------------
// Загрузка файла
// ---------------------------------------------------------------

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


// ---------------------------------------------------------------
// Качественное уменьшение (по шагам в 2 раза) и цветокоррекция
// ---------------------------------------------------------------

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


// Нерезкая маска 3x3 (как в Python-части), на вещественных числах.
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


// Тот же порядок и та же математика, что в Python:
// яркость -> контраст (вокруг среднего) -> насыщенность -> резкость.
// Обрезка до 0..255 только в самом конце.
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
        od[i] = buf[o];       // Uint8ClampedArray сама обрежет и округлит
        od[i + 1] = buf[o + 1];
        od[i + 2] = buf[o + 2];
        od[i + 3] = 255;
    }
    return out;
}


// ---------------------------------------------------------------
// Превью
// ---------------------------------------------------------------

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
        "display:flex;flex-direction:column;width:100%;height:100%;" +
        "min-width:0;box-sizing:border-box;overflow:hidden;" +
        "background:#151515;border:1px solid #383838";

    area.style.cssText =
        "position:relative;flex:1 1 auto;min-height:0;min-width:0;" +
        "overflow:hidden;background:#101010";

    canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;display:block";

    message.textContent = "Выберите изображение";
    message.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;" +
        "justify-content:center;padding:12px;color:#aaa;" +
        "font:13px sans-serif;text-align:center;pointer-events:none";

    info.style.cssText =
        `flex:0 0 ${INFO_HEIGHT}px;display:flex;align-items:center;` +
        "justify-content:center;padding:0 8px;box-sizing:border-box;" +
        "overflow:hidden;color:#d0d0d0;background:#202020;" +
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
        node.imgs = []; // убираем штатное превью ComfyUI
    }

    // Уменьшенная копия исходника под размер экрана (кешируется:
    // при движении ползунков пересчитывается только цвет).
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

            let W = Math.round(cssW * scale);
            let H = Math.round(cssH * scale);
            const pixels = W * H;
            if (pixels > MAX_PREVIEW_PIXELS) {
                const k = Math.sqrt(MAX_PREVIEW_PIXELS / pixels);
                W = Math.floor(W * k);
                H = Math.floor(H * k);
            }

            if (canvas.width !== W || canvas.height !== H) {
                canvas.width = W;
                canvas.height = H;
            }

            ctx.fillStyle = "#101010";
            ctx.fillRect(0, 0, W, H);

            if (!sourceImage) return;

            const out = calculateOutputSize(
                node,
                sourceImage.naturalWidth,
                sourceImage.naturalHeight,
            );

            // Вписываем кадр в область превью 1:1 по пикселям.
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
            node.imgs = [];
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

    // Зум графа не меняет размер элемента, поэтому следим отдельно.
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


// ---------------------------------------------------------------
// Регистрация ноды
// ---------------------------------------------------------------

app.registerExtension({
    name: "Neron.InteractiveImageProcessor",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origRemoved = nodeType.prototype.onRemoved;
        const origDraw = nodeType.prototype.onDrawForeground;

        nodeType.prototype.onNodeCreated = function () {
            const result = origCreated?.apply(this, arguments);
            const node = this;
            const preview = createPreview(node);
            node.__interactivePreview = preview;

            // Без getMaxHeight: превью занимает всё свободное место ноды.
            node.addDOMWidget("interactive_preview", "preview", preview.root, {
                serialize: false,
                hideOnZoom: false,
                getMinHeight: () => MIN_PREVIEW_HEIGHT + INFO_HEIGHT,
            });

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

            const origConfigure = node.onConfigure;
            node.onConfigure = function () {
                const r = origConfigure?.apply(this, arguments);
                window.setTimeout(() => {
                    updateVisibility(node);
                    preview.scheduleRender();
                }, 100);
                return r;
            };

            node.setSize([
                Math.max(Number(node.size?.[0] ?? 420), 420),
                Math.max(Number(node.size?.[1] ?? 640), 640),
            ]);

            updateVisibility(node);
            window.setTimeout(preview.scheduleRender, 150);

            return result;
        };

        nodeType.prototype.onDrawForeground = function () {
            const r = origDraw?.apply(this, arguments);
            this.__interactivePreview?.checkScale();
            return r;
        };

        nodeType.prototype.onRemoved = function () {
            this.__interactivePreview?.destroy();
            return origRemoved?.apply(this, arguments);
        };
    },
});
