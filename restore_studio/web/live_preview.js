import { app } from "../../scripts/app.js";

const NODE_NAME = "LivePreview";
const POLL_INTERVAL_MS = 150;
const MIN_HEIGHT = 400;

// Двуязычные имена виджетов на ноде RestoreStudio
const W = {
    faceRestore: "FACE RESTORE / ЛИЦА",
    faceStrength:"FACE STRENGTH / СИЛА ЛИЦ",
    faceSharpen: "FACE SHARPEN / РЕЗКОСТЬ ЛИЦ",
    autoWb:      "AUTO WB / БАЛАНС БЕЛОГО",
    autoLevels:  "AUTO LEVELS / УРОВНИ",
    denoise:     "DENOISE / ШУМОДАВ",
    despeckle:   "DESPECKLE / ТОЧКИ",
    colorize:    "COLORIZE / РАСКРАСКА",
    colorStr:    "COLORIZE STRENGTH / СИЛА РАСКРАСКИ",
    brightness:  "BRIGHTNESS / ЯРКОСТЬ",
    contrast:    "CONTRAST / КОНТРАСТ",
    saturation:  "SATURATION / НАСЫЩЕННОСТЬ",
    sharpness:   "SHARPNESS / РЕЗКОСТЬ",
    rgbR:        "RGB RED / КРАСНЫЙ",
    rgbG:        "RGB GREEN / ЗЕЛЁНЫЙ",
    rgbB:        "RGB BLUE / СИНИЙ",
};

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function getValue(node, name, fallback) {
    return getWidget(node, name)?.value ?? fallback;
}

function findUpstreamLoadImage(node) {
    const input = node.inputs?.find((i) => i.name === "image");
    if (!input || input.link == null) return null;

    const link = node.graph?.links?.[input.link];
    if (!link) return null;

    let current = node.graph.getNodeById(link.origin_id);
    const visited = new Set();

    while (current && !visited.has(current.id)) {
        visited.add(current.id);

        for (const w of current.widgets ?? []) {
            if (["image", "filename", "file"].includes(w.name) && w.value) {
                return { node: current, filename: String(w.value) };
            }
        }

        const firstInput = current.inputs?.[0];
        if (!firstInput || firstInput.link == null) break;

        const nextLink = node.graph?.links?.[firstInput.link];
        if (!nextLink) break;

        current = node.graph.getNodeById(nextLink.origin_id);
    }

    return null;
}

function findUpstreamRestoreStudio(node) {
    const input = node.inputs?.find((i) => i.name === "image");
    if (!input || input.link == null) return null;

    const link = node.graph?.links?.[input.link];
    if (!link) return null;

    let current = node.graph.getNodeById(link.origin_id);
    const visited = new Set();

    while (current && !visited.has(current.id)) {
        visited.add(current.id);

        if (current.type === "RestoreStudio") {
            return current;
        }

        const firstInput = current.inputs?.[0];
        if (!firstInput || firstInput.link == null) break;

        const nextLink = node.graph?.links?.[firstInput.link];
        if (!nextLink) break;

        current = node.graph.getNodeById(nextLink.origin_id);
    }

    return null;
}

function collectSettings(node, studio) {
    // Ключи объекта — внутренние, для HTTP-обмена с Python.
    // Имена виджетов на ноде — двуязычные.
    const settings = {
        max_size: Number(getValue(node, "max_size", 1024)),
    };

    if (studio) {
        settings.face_restore = !!getValue(studio, W.faceRestore, false);
        settings.face_restore_strength = Number(getValue(studio, W.faceStrength, 0.5));
        settings.face_restore_sharpen = Number(getValue(studio, W.faceSharpen, 0.3));
        settings.auto_wb = Number(getValue(studio, W.autoWb, 0));
        settings.auto_levels = Number(getValue(studio, W.autoLevels, 0));
        settings.denoise = Number(getValue(studio, W.denoise, 0));
        settings.despeckle = Number(getValue(studio, W.despeckle, 0));
        settings.colorize = !!getValue(studio, W.colorize, false);
        settings.colorize_strength = Number(getValue(studio, W.colorStr, 1));
        settings.brightness = Number(getValue(studio, W.brightness, 0));
        settings.contrast = Number(getValue(studio, W.contrast, 1));
        settings.saturation = Number(getValue(studio, W.saturation, 1));
        settings.sharpness = Number(getValue(studio, W.sharpness, 0));
        settings.rgb_r = Number(getValue(studio, W.rgbR, 1));
        settings.rgb_g = Number(getValue(studio, W.rgbG, 1));
        settings.rgb_b = Number(getValue(studio, W.rgbB, 1));
    }

    return settings;
}

function hashState(filename, settings) {
    return JSON.stringify({ filename, settings });
}

function createViewer(node) {
    const root = document.createElement("div");
    root.style.cssText =
        "display:flex;flex-direction:column;width:100%;height:100%;" +
        "background:#0a0a0a;border:1px solid #333;box-sizing:border-box;overflow:hidden;";

    const status = document.createElement("div");
    status.textContent = "Waiting for connection...";
    status.style.cssText =
        "flex:0 0 26px;display:flex;align-items:center;justify-content:center;" +
        "color:#888;background:#181818;font:12px sans-serif;";

    const area = document.createElement("div");
    area.style.cssText =
        "flex:1 1 auto;position:relative;display:flex;align-items:center;" +
        "justify-content:center;overflow:hidden;background:#050505;";

    const img = document.createElement("img");
    img.style.cssText =
        "max-width:100%;max-height:100%;object-fit:contain;display:block;";

    area.append(img);
    root.append(status, area);

    let lastHash = "";
    let inflight = false;
    let pending = false;
    let pollTimer = null;

    async function refresh() {
        if (inflight) {
            pending = true;
            return;
        }

        const load = findUpstreamLoadImage(node);
        const studio = findUpstreamRestoreStudio(node);

        if (!load || !load.filename) {
            status.textContent = "Connect an image";
            if (img.getAttribute("src")) img.removeAttribute("src");
            lastHash = "";
            return;
        }

        const settings = collectSettings(node, studio);
        const h = hashState(load.filename, settings);

        if (h === lastHash) return;

        inflight = true;
        status.textContent = "Processing...";

        try {
            const resp = await fetch("/restore_studio/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: load.filename,
                    settings: settings,
                }),
            });

            if (!resp.ok) {
                let msg = "HTTP " + resp.status;
                try {
                    const j = await resp.json();
                    if (j.error) msg = j.error;
                } catch (_) {}
                status.textContent = "Error: " + msg.slice(0, 80);
                return;
            }

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);

            const oldSrc = img.getAttribute("src");
            if (oldSrc && oldSrc.startsWith("blob:")) {
                URL.revokeObjectURL(oldSrc);
            }

            img.src = url;
            lastHash = h;

            status.textContent = load.filename;
        } catch (e) {
            status.textContent = "Error: " + String(e).slice(0, 80);
        } finally {
            inflight = false;
            if (pending) {
                pending = false;
                setTimeout(refresh, 0);
            }
        }
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    return { root, refresh, startPolling, stopPolling };
}

app.registerExtension({
    name: "RestoreStudio.LivePreview",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origRemoved = nodeType.prototype.onRemoved;

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            const viewer = createViewer(node);
            node.__viewer = viewer;

            node.addDOMWidget("preview_view", "preview", viewer.root, {
                serialize: false,
                hideOnZoom: false,
                getMinHeight: () => MIN_HEIGHT,
            });

            node.setSize([
                Math.max(Number(node.size?.[0] ?? 600), 600),
                Math.max(Number(node.size?.[1] ?? 520), 520),
            ]);

            setTimeout(() => {
                viewer.refresh();
                viewer.startPolling();
            }, 400);

            return r;
        };

        nodeType.prototype.onRemoved = function () {
            this.__viewer?.stopPolling();
            return origRemoved?.apply(this, arguments);
        };
    },
});