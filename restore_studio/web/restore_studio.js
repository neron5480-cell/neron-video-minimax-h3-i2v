import { app } from "../../scripts/app.js";

const NODE_NAME = "RestoreStudio";

const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";

const W = {
    preset:      "preset",
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
    upScale:     "UPSCALE SCALE / МАСШТАБ",
    upSharpen:   "UPSCALE SHARPEN / РЕЗКОСТЬ АПСКЕЙЛА",
};

const P = {
    manual:    "✋ Manual / Вручную",
    oldBw:     "📷 Old B&W Photo / Старое ч/б",
    portrait:  "👤 Portrait / Портрет",
    landscape: "🏞 Landscape / Пейзаж",
    film:      "🎞 Film Look / Кино",
    vintage:   "📼 Vintage / Винтаж",
};

const DEFAULTS = {
    preset: P.manual,
    [W.faceRestore]: false,
    [W.faceStrength]: 0.5,
    [W.faceSharpen]: 0.3,
    [W.autoWb]: 0.0,
    [W.autoLevels]: 0.0,
    [W.denoise]: 0.0,
    [W.despeckle]: 0.0,
    [W.colorize]: false,
    [W.colorStr]: 1.0,
    [W.brightness]: 0.0,
    [W.contrast]: 1.0,
    [W.saturation]: 1.0,
    [W.sharpness]: 0.0,
    [W.rgbR]: 1.0,
    [W.rgbG]: 1.0,
    [W.rgbB]: 1.0,
    [W.upScale]: 2.0,
    [W.upSharpen]: 0.0,
};

const PRESETS = {
    [P.manual]: null,

    [P.oldBw]: {
        [W.faceRestore]: true, [W.faceStrength]: 0.5, [W.faceSharpen]: 0.4,
        [W.autoWb]: 0.3, [W.autoLevels]: 0.5, [W.denoise]: 0.4, [W.despeckle]: 0.3,
        [W.colorize]: true, [W.colorStr]: 0.8,
        [W.brightness]: 0.05, [W.contrast]: 1.15, [W.saturation]: 1.0, [W.sharpness]: 0.3,
        [W.rgbR]: 1.0, [W.rgbG]: 1.0, [W.rgbB]: 1.0,
    },

    [P.portrait]: {
        [W.faceRestore]: true, [W.faceStrength]: 0.5, [W.faceSharpen]: 0.3,
        [W.autoWb]: 0.2, [W.autoLevels]: 0.3, [W.denoise]: 0.2, [W.despeckle]: 0.0,
        [W.colorize]: false, [W.colorStr]: 1.0,
        [W.brightness]: 0.0, [W.contrast]: 1.05, [W.saturation]: 1.1, [W.sharpness]: 0.3,
        [W.rgbR]: 1.0, [W.rgbG]: 1.0, [W.rgbB]: 1.0,
    },

    [P.landscape]: {
        [W.faceRestore]: false, [W.faceStrength]: 0.5, [W.faceSharpen]: 0.3,
        [W.autoWb]: 0.3, [W.autoLevels]: 0.4, [W.denoise]: 0.1, [W.despeckle]: 0.0,
        [W.colorize]: false, [W.colorStr]: 1.0,
        [W.brightness]: 0.0, [W.contrast]: 1.15, [W.saturation]: 1.2, [W.sharpness]: 0.5,
        [W.rgbR]: 1.0, [W.rgbG]: 1.0, [W.rgbB]: 1.0,
    },

    [P.film]: {
        [W.faceRestore]: false, [W.faceStrength]: 0.5, [W.faceSharpen]: 0.3,
        [W.autoWb]: 0.1, [W.autoLevels]: 0.2, [W.denoise]: 0.15, [W.despeckle]: 0.0,
        [W.colorize]: false, [W.colorStr]: 1.0,
        [W.brightness]: -0.02, [W.contrast]: 1.2, [W.saturation]: 0.95, [W.sharpness]: 0.2,
        [W.rgbR]: 1.05, [W.rgbG]: 1.0, [W.rgbB]: 0.95,
    },

    [P.vintage]: {
        [W.faceRestore]: false, [W.faceStrength]: 0.5, [W.faceSharpen]: 0.3,
        [W.autoWb]: 0.2, [W.autoLevels]: 0.3, [W.denoise]: 0.3, [W.despeckle]: 0.2,
        [W.colorize]: false, [W.colorStr]: 1.0,
        [W.brightness]: 0.05, [W.contrast]: 0.9, [W.saturation]: 0.7, [W.sharpness]: 0.1,
        [W.rgbR]: 1.1, [W.rgbG]: 1.0, [W.rgbB]: 0.85,
    },
};

const HELP_TEXT = `
🎨 RESTORE STUDIO

━━━ PRESETS ━━━
📷 Old B&W Photo — for old black & white photos
👤 Portrait — portraits with face restore
🏞 Landscape — landscapes with strong contrast
🎞 Film Look — warm cinematic tone
📼 Vintage — faded vintage look
✋ Manual — everything by hand

━━━ FACE RESTORE ━━━
Face restoration via ReActor.

FACE STRENGTH — 0.3 soft, 0.5 balanced, 0.7 strong.
FACE SHARPEN — auto-sharpen AFTER restore.
  Compensates for the "plastic" look of GFPGAN.
  0.3 subtle. 0.5 noticeable. 1.0+ aggressive.

━━━ RESTORATION ━━━
AUTO WB / AUTO LEVELS / DENOISE / DESPECKLE (0–1).

━━━ COLORIZE ━━━
COLORIZE — colorize B&W photos (requires DDColor).
COLORIZE STRENGTH — 0.5 subtle, 1.0 full.

━━━ COLOR ━━━
BRIGHTNESS / CONTRAST / SATURATION / SHARPNESS
RGB RED / RGB GREEN / RGB BLUE — color tint.

━━━ UPSCALE ━━━
Connect UpscaleModelLoader to the "upscale_model"
input. Pick a model, set scale (1.0 – 4.0).

━━━ TIPS ━━━
• Use Live Preview — see results instantly.
• First colorize / face restore is slow (loads models).
• After that — cached, fast.
• Progressive upscaling for small images — see README.
`;


function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function showHelpDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;" +
        "display:flex;align-items:center;justify-content:center;";

    const box = document.createElement("div");
    box.style.cssText =
        "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
        "border-radius:8px;padding:20px;max-width:640px;max-height:80vh;" +
        "overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);";

    box.textContent = HELP_TEXT;

    const btn = document.createElement("button");
    btn.textContent = "Close";
    btn.style.cssText =
        "display:block;margin:16px auto 0;padding:8px 24px;" +
        "background:#2a5d9c;color:#fff;border:none;border-radius:4px;" +
        "cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    overlay.append(box);
    document.body.append(overlay);
}

function setWidgetValue(node, name, value) {
    const w = getWidget(node, name);
    if (!w) return;
    w.value = value;
    try {
        w.callback?.(value, app.canvas, node, [0, 0], null);
    } catch (_) {}
}

let applyingPreset = false;

function applyPreset(node, presetName) {
    const values = PRESETS[presetName];
    if (!values) return;

    for (const [name, value] of Object.entries(values)) {
        setWidgetValue(node, name, value);
    }

    const lp = node.graph?._nodes?.find((n) => n.type === "LivePreview");
    if (lp?.__viewer) lp.__viewer.refresh();
}

function resetAllWidgets(node) {
    applyingPreset = true;
    for (const [name, value] of Object.entries(DEFAULTS)) {
        setWidgetValue(node, name, value);
    }
    applyingPreset = false;

    node.setDirtyCanvas?.(true, true);

    const lp = node.graph?._nodes?.find((n) => n.type === "LivePreview");
    if (lp?.__viewer) lp.__viewer.refresh();
}

app.registerExtension({
    name: "RestoreStudio.Buttons",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;

            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;

            const presetWidget = getWidget(node, W.preset);
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

            const PRESET_WATCHED = [
                W.faceRestore, W.faceStrength, W.faceSharpen,
                W.autoWb, W.autoLevels, W.denoise, W.despeckle,
                W.colorize, W.colorStr,
                W.brightness, W.contrast, W.saturation, W.sharpness,
                W.rgbR, W.rgbG, W.rgbB,
                W.upScale, W.upSharpen,
            ];

            for (const name of PRESET_WATCHED) {
                const w = getWidget(node, name);
                if (!w) continue;
                const origCb = w.callback;
                w.callback = function (value, ...args) {
                    const res = origCb?.apply(this, [value, ...args]);
                    if (!applyingPreset) {
                        const pw = getWidget(node, W.preset);
                        if (pw && pw.value !== P.manual) {
                            pw.value = P.manual;
                            try {
                                pw.callback?.(P.manual, app.canvas, node, [0, 0], null);
                            } catch (_) {}
                        }
                    }
                    return res;
                };
            }

            node.addWidget("button", "🔄 Reset to Defaults", null, () => {
                resetAllWidgets(node);
            });

            node.addWidget("button", "📖 Help", null, () => {
                showHelpDialog();
            });

            return r;
        };
    },
});