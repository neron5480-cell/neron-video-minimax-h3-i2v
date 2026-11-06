// 🖼 Neron H3 Кадры — четыре окна загрузки прямо в ноде (первый, промежуточный 1, промежуточный 2, последний),
// с подписью и превью. Картинки любого размера вписываются в своё окно и никогда не вылезают за него.
// Нажми на окно — выбрать файл; можно перетащить файл прямо на окно; ✕ — убрать.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Frames";
const NONE = "— нет / none —";
const SLOTS = [
    { widget: "first_image", input: "first_frame", ru: "1 · ПЕРВЫЙ КАДР", en: "first frame", color: "#5fd0ff" },
    { widget: "mid_image_1", input: "mid_frame_1", ru: "2 · ПРОМЕЖУТОЧНЫЙ", en: "middle 1", color: "#ffd166" },
    { widget: "mid_image_2", input: "mid_frame_2", ru: "3 · ПРОМЕЖУТОЧНЫЙ", en: "middle 2", color: "#ffd166" },
    { widget: "last_image", input: "last_frame", ru: "4 · ПОСЛЕДНИЙ КАДР", en: "last frame", color: "#ff8fa3" },
];
const PAD = 10, GAP = 8, CAP_H = 30, INFO_H = 18, CLOSE = 18;

const HELP_TEXT = `
🖼 NERON H3 FRAMES
===================================================

📌 WHAT IT IS 📌
All pictures of the video in ONE node — no separate
Load Image nodes, no wires. One wire 'frames' goes
into the 📝 Story AutoPrompter.

📌 HOW TO LOAD 📌
Click a window — pick a file. Or drag a file from
your folder straight onto a window. ✕ in the corner
removes it. Pictures of ANY size and shape are fine:
each fits inside its window, the engine brings all of
them to the video size itself.

📌 THE FOUR WINDOWS (all optional) 📌
1 · first frame — the opening frame. It is also the
    appearance reference <Picture 1> in every block
    (faces, hair, clothes). In complex scenes use a
    LANDSCAPE first frame: with a portrait one H3
    sometimes drifts (a white tiger turns orange).
2, 3 · middle — what appears during the video: a
    place, a creature, an object. WHEN — the
    AutoPrompter decides by the scenario (if it
    doesn't say — about 1/3 and 2/3 of the video).
4 · last frame — how the video ends; pinned to the
    very last frame. Use a frame of the same scene and
    angle, otherwise the picture "morphs" into it.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Все картинки ролика в ОДНОЙ ноде — без отдельных
«Загрузить изображение» и без проводов. Один провод
'frames' уходит в 📝 Story AutoPrompter.

📌 КАК ЗАГРУЗИТЬ 📌
Нажми на окно — выбери файл. Или перетащи файл из
папки прямо на окно. ✕ в углу — убрать. Картинки
ЛЮБОГО размера и формы: каждая вписывается в своё
окно, а движок сам сводит всё к размеру ролика.

📌 ЧЕТЫРЕ ОКНА (все необязательные) 📌
1 · первый кадр — начало ролика. Он же образец
    внешности <Picture 1> во всех блоках (лица,
    волосы, одежда). В сложных сценах ставь его
    ГОРИЗОНТАЛЬНЫМ: с вертикальным H3 иногда чудит
    (белый тигр становится рыжим).
2, 3 · промежуточные — что появится по ходу ролика:
    место, существо, предмет. КОГДА — решает
    AutoPrompter по сценарию (не сказано — примерно
    на 1/3 и 2/3 ролика).
4 · последний кадр — чем ролик закончится;
    прикалывается к самому последнему кадру. Ставь
    кадр той же сцены и ракурса, иначе картинка
    «перетечёт» в него.

===================================================
`;

function showHelpDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;" +
        "max-width:820px;max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP_TEXT;
    const btn = document.createElement("button");
    btn.textContent = "Close / Закрыть";
    btn.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;" +
        "border:none;border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

// ---------- раскладка: 4 в ряд на широкой ноде, 2×2 на узкой ----------
function layout(width) {
    const cols = width >= 560 ? 4 : 2;
    const rows = 4 / cols;
    const slotW = Math.max(60, (width - PAD * 2 - GAP * (cols - 1)) / cols);
    const imgH = Math.round(slotW * 1.25);
    const slotH = CAP_H + imgH + INFO_H;
    return { cols, rows, slotW, imgH, slotH, height: rows * slotH + (rows - 1) * GAP + 6 };
}

function slotRect(node, i, top) {
    const L = layout(node.size[0]);
    const c = i % L.cols, r = Math.floor(i / L.cols);
    const x = PAD + c * (L.slotW + GAP), y = top + r * (L.slotH + GAP);
    return { x, y, w: L.slotW, h: L.slotH, img: { x: x + 4, y: y + CAP_H, w: L.slotW - 8, h: L.imgH },
             close: { x: x + L.slotW - 4 - CLOSE - 3, y: y + CAP_H + 3, w: CLOSE, h: CLOSE } };
}

function inside(p, r) { return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h; }

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.rect(x, y, w, h);
}

function fitText(ctx, t, maxW) {
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 2 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}

// ---------- превью ----------
const CACHE = new Map();       // имя файла → Image
function preview(name) {
    if (!name || name === NONE) return null;
    let im = CACHE.get(name);
    if (!im) {
        const i = name.lastIndexOf("/");
        const sub = i >= 0 ? name.slice(0, i) : "", file = i >= 0 ? name.slice(i + 1) : name;
        im = new Image();
        im.onload = () => app.graph?.setDirtyCanvas(true, false);
        im.onerror = () => { im.__failed = true; app.graph?.setDirtyCanvas(true, false); };
        im.src = api.apiURL(`/view?filename=${encodeURIComponent(file)}&type=input&subfolder=${encodeURIComponent(sub)}`);
        CACHE.set(name, im);
    }
    return im;
}

// Невидимая распорка: свой тип виджета, клик по ней ничего не открывает (у текстового — окошко «Value»)
function addBlank(node, name, height) {
    return node.addCustomWidget({ name, type: "neron_blank", value: "", serialize: false,
                                  options: { serialize: false }, draw() {}, computeSize: () => [0, height],
                                  mouse() { return false; } });
}

function widgetOf(node, name) { return node.widgets?.find((w) => w.name === name); }

function setSlot(node, slot, value) {
    const w = widgetOf(node, slot.widget);
    if (!w) return;
    const vals = w.options?.values;
    if (Array.isArray(vals) && !vals.includes(value)) vals.push(value);
    w.value = value;
    try { w.callback?.(value); } catch (_) {}
    node.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas(true, true);
}

async function upload(node, slot, file) {
    if (!file || !file.type?.startsWith("image/")) return;
    const body = new FormData();
    body.append("image", file);
    body.append("type", "input");
    try {
        const r = await api.fetchApi("/upload/image", { method: "POST", body });
        if (r.status !== 200) { console.warn("[Neron Frames] upload", r.status); return; }
        const d = await r.json();
        const value = d.subfolder ? `${d.subfolder}/${d.name}` : d.name;
        CACHE.delete(value);
        setSlot(node, slot, value);
    } catch (e) {
        console.warn("[Neron Frames] upload failed", e);
    }
}

function pickFile(node, slot) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif";
    inp.style.display = "none";
    inp.onchange = () => { if (inp.files?.[0]) upload(node, slot, inp.files[0]); inp.remove(); };
    document.body.append(inp);
    inp.click();
}

// ---------- окно-сетка ----------
function gridTop(node) {
    const g = widgetOf(node, "_frames_grid");
    return g ? (g.last_y ?? g.y ?? 0) : 0;
}

function drawGrid(node, ctx, top) {
    for (let i = 0; i < SLOTS.length; i++) {
        const s = SLOTS[i], R = slotRect(node, i, top);
        const w = widgetOf(node, s.widget);
        const val = w?.value;
        const fromWire = false;
        ctx.save();
        // рамка окна
        ctx.fillStyle = "rgba(10, 20, 28, 0.85)";
        roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.fill();
        ctx.strokeStyle = s.color; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5;
        roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.stroke();
        ctx.globalAlpha = 1;
        // подпись: по-русски крупно, по-английски мельче
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = s.color; ctx.font = "bold 11px sans-serif";
        ctx.fillText(fitText(ctx, s.ru, R.w - 8), R.x + R.w / 2, R.y + 14);
        ctx.fillStyle = "rgba(200, 220, 230, 0.75)"; ctx.font = "10px sans-serif";
        ctx.fillText(fitText(ctx, s.en, R.w - 8), R.x + R.w / 2, R.y + 26);
        // поле картинки — всё рисуем строго внутри него
        const A = R.img;
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.fill();
        ctx.save();
        roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.clip();
        let info = "";
        if (fromWire) {
            ctx.fillStyle = "#9be7a0"; ctx.font = "12px sans-serif"; ctx.textBaseline = "middle";
            ctx.fillText(fitText(ctx, "🔌 с провода", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 - 8);
            ctx.fillText(fitText(ctx, "from wire", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 10);
            info = "провод / wire";
        } else {
            const im = preview(val);
            if (im && im.complete && im.naturalWidth > 0) {
                const k = Math.min(A.w / im.naturalWidth, A.h / im.naturalHeight);
                const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
                ctx.drawImage(im, A.x + (A.w - dw) / 2, A.y + (A.h - dh) / 2, dw, dh);
                info = `${im.naturalWidth}×${im.naturalHeight}`;
            } else if (im && im.__failed) {
                ctx.fillStyle = "#ff8a80"; ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
                ctx.fillText(fitText(ctx, "⚠ файла нет", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 - 8);
                ctx.fillText(fitText(ctx, "missing file", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 10);
                info = fitText(ctx, String(val), R.w - 8);
            } else if (im) {
                ctx.fillStyle = "#90a4ae"; ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
                ctx.fillText("…", A.x + A.w / 2, A.y + A.h / 2);
            } else {
                ctx.fillStyle = "rgba(180, 200, 210, 0.55)"; ctx.textBaseline = "middle";
                ctx.font = "26px sans-serif"; ctx.fillText("＋", A.x + A.w / 2, A.y + A.h / 2 - 16);
                ctx.font = "10px sans-serif";
                ctx.fillText(fitText(ctx, "нажми или перетащи", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 10);
                ctx.fillText(fitText(ctx, "click or drop", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 24);
            }
        }
        ctx.restore();
        // ✕ — убрать
        if (!fromWire && val && val !== NONE) {
            const C = R.close;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            roundRect(ctx, C.x, C.y, C.w, C.h, 4); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px sans-serif"; ctx.textBaseline = "middle";
            ctx.fillText("✕", C.x + C.w / 2, C.y + C.h / 2 + 1);
        }
        // размер под картинкой
        if (info) {
            ctx.fillStyle = "rgba(200, 220, 230, 0.8)"; ctx.font = "10px monospace"; ctx.textBaseline = "middle";
            ctx.fillText(fitText(ctx, info, R.w - 8), R.x + R.w / 2, A.y + A.h + INFO_H / 2);
        }
        ctx.restore();
    }
}

function slotAt(node, pos) {
    const top = gridTop(node);
    for (let i = 0; i < SLOTS.length; i++) {
        const R = slotRect(node, i, top);
        if (inside(pos, R)) return { i, R };
    }
    return null;
}

let lastClick = 0;
function clickAt(node, pos) {
    const hit = slotAt(node, pos);
    if (!hit) return false;
    const now = Date.now();
    if (now - lastClick < 400) return true;      // виджет и нода могут сообщить об одном клике дважды
    lastClick = now;
    const s = SLOTS[hit.i];
    const val = widgetOf(node, s.widget)?.value;
    if (val && val !== NONE && inside(pos, hit.R.close)) { setSlot(node, s, NONE); return true; }
    pickFile(node, s);
    return true;
}

// Высота ноды — ровно по окнам: ширину тянешь сам, высота подстраивается (без пустого хвоста и без наплыва)
function fixHeight(node) {
    try {
        const g = widgetOf(node, "_frames_grid");
        const top = g ? (g.last_y ?? g.y) : undefined;
        let need = node.computeSize()[1];
        if (top !== undefined) {
            const btn = node.widgets.find((w) => w.type === "button");
            need = top + layout(node.size[0]).height + 6 + (btn ? 28 : 0) + 16 + 8;
        }
        if (Math.abs(node.size[1] - need) > 2) node.setSize([node.size[0], need]);
        app.graph?.setDirtyCanvas(true, true);
    } catch (_) {}
}

app.registerExtension({
    name: "Neron.H3.Frames",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const origCreated = nodeType.prototype.onNodeCreated;
        const origConfigure = nodeType.prototype.onConfigure;
        const origExecuted = nodeType.prototype.onExecuted;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        const origMouse = nodeType.prototype.onMouseDown;
        const origResize = nodeType.prototype.onResize;

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = "#1e3a4a";
            node.bgcolor = "#10232e";
            node.resizable = true;
            node.__neronSummary = "";
            // имена файлов храним в обычных списках (сохраняются со схемой), но не показываем — вместо них окна
            for (const s of SLOTS) {
                const w = widgetOf(node, s.widget);
                if (w) w.hidden = true;
            }
            // четыре окна — свой виджет: клик по окну = выбрать файл, ✕ = убрать
            node.addCustomWidget({
                name: "_frames_grid", type: "neron_frames", value: "", serialize: false,
                options: { serialize: false },
                draw(ctx, n, width, y) { drawGrid(n, ctx, y); },
                computeSize(width) { return [width, layout(width ?? node.size[0]).height]; },
                mouse(e, pos, n) {
                    const t = e?.type || "";
                    if (t === "pointerdown" || t === "mousedown") return clickAt(n, pos);
                    return true;
                },
            });
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            addBlank(node, "_frames_info", 16);       // место под строку отчёта
            try {
                node.setSize([Math.max(node.size[0], 620), node.size[1]]);
                node.setSize([node.size[0], node.computeSize()[1]]);
            } catch (_) {}
            for (const t of [60, 300]) setTimeout(() => fixHeight(node), t);
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            for (const s of SLOTS) { const w = widgetOf(this, s.widget); if (w) w.hidden = true; }
            setTimeout(() => fixHeight(this), 50);
            return r;
        };
        nodeType.prototype.onResize = function () {
            const r = origResize?.apply(this, arguments);
            clearTimeout(this.__neronFix);
            this.__neronFix = setTimeout(() => fixHeight(this), 30);   // ширина поменялась — окна выше/ниже
            return r;
        };
        nodeType.prototype.onMouseDown = function (e, pos) {
            if (slotAt(this, pos)) return clickAt(this, pos);
            return origMouse?.apply(this, arguments);
        };
        // перетащить файл прямо на окно
        nodeType.prototype.onDragOver = function (e) {
            return !!e?.dataTransfer?.types?.includes?.("Files");
        };
        nodeType.prototype.onDragDrop = function (e) {
            const file = [...(e?.dataTransfer?.files || [])].find((f) => f.type?.startsWith("image/"));
            if (!file) return false;
            let slot = null;
            try {
                const gm = app.canvas.graph_mouse;
                const hit = slotAt(this, [gm[0] - this.pos[0], gm[1] - this.pos[1]]);
                if (hit) slot = SLOTS[hit.i];
            } catch (_) {}
            if (!slot) slot = SLOTS.find((s) => { const v = widgetOf(this, s.widget)?.value; return !v || v === NONE; }) || SLOTS[0];
            upload(this, slot, file);
            return true;
        };
        nodeType.prototype.onExecuted = function (msg) {
            const r = origExecuted?.apply(this, arguments);
            this.__neronSummary = (msg?.text || []).join(" ");
            app.graph?.setDirtyCanvas(true, false);
            return r;
        };
        nodeType.prototype.onDrawForeground = function (ctx) {
            const r = origDrawFg?.apply(this, arguments);
            if (this.flags?.collapsed || !this.__neronSummary) return r;
            ctx.save();
            ctx.textAlign = "left"; ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(170, 210, 230, 0.9)";
            ctx.fillText(fitText(ctx, this.__neronSummary, this.size[0] - 20), 10, this.size[1] - 6);
            ctx.restore();
            return r;
        };
    },
});
