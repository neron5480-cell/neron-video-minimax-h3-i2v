// 🎬 Neron H3 Story — оформление в стиле Neron (как Neron H3 Engine):
// режим эксперта, часы генерации и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Story";
const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";
const GROUP_GAP = 18;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "РОЛИК / STORY", widgets: ["mode", "total_seconds", "block_seconds", "keep_appearance"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "РАЗМЕР / SIZE", widgets: ["size", "manual_width", "manual_height"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "СТЫК / SEAM", widgets: ["seam", "seam_frames"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["unet_model", "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ТОНКАЯ НАСТРОЙКА / ADVANCED", widgets: ["seed", "control_after_generate", "ref_quality", "fast_attention"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
    { name: "🚀 БЫСТРО / FAST", widgets: ["fast_steps", "fast_lora_model"],
      fill: "rgba(180, 120, 220, 0.15)", border: "rgba(180, 120, 220, 0.75)", label: "rgba(230, 200, 255, 1.0)" },
];

function wv(node, name) {
    const w = node.widgets?.find((x) => x.name === name);
    return w ? w.value : undefined;
}

function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

function isHidden(w) {
    return !w || w.hidden === true;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ---------- отступы между группами ----------
function setBottomPadding(widget, amount) {
    if (!widget) return;
    if (!widget.__neronOrigSize) widget.__neronOrigSize = widget.computeSize || null;
    widget.__neronBottomPadding = amount;
    const orig = widget.__neronOrigSize;
    widget.computeSize = function (width) {
        const sz = orig ? orig.call(this, width) : [width, 24];
        return [sz[0], sz[1] + amount];
    };
}

function clearBottomPadding(widget) {
    if (!widget || !("__neronBottomPadding" in widget)) return;
    if (widget.__neronOrigSize) widget.computeSize = widget.__neronOrigSize;
    else delete widget.computeSize;
    delete widget.__neronOrigSize;
    delete widget.__neronBottomPadding;
}

function widgetHeight(w, nodeWidth) {
    try {
        if (w.computeSize) {
            const s = w.computeSize(nodeWidth);
            if (s && s[1] != null && s[1] > 0) return s[1];
        }
    } catch (_) {}
    return 24;
}

function groupRect(node, g) {
    let y0 = Infinity, y1 = -Infinity;
    for (const w of node.widgets || []) {
        if (!g.widgets.includes(w.name) || isHidden(w) || w.last_y === undefined) continue;
        const h = widgetHeight(w, node.size[0]) - (w.__neronBottomPadding || 0);
        y0 = Math.min(y0, w.last_y);
        y1 = Math.max(y1, w.last_y + h);
    }
    if (!isFinite(y0) || y1 <= y0) return null;
    const padX = 10, labelH = 16;
    return { x: padX, y: y0 - labelH, w: node.size[0] - padX * 2, h: (y1 - y0) + labelH };
}

function applyGroupGaps(node) {
    for (const w of node.widgets || []) clearBottomPadding(w);
    for (const g of GROUPS) {
        let last = null;
        for (const w of node.widgets || []) if (g.widgets.includes(w.name) && !isHidden(w)) last = w;
        if (last) setBottomPadding(last, GROUP_GAP);
    }
}

function drawGroupRects(node, ctx) {
    ctx.save();
    for (const g of GROUPS) {
        const r = groupRect(node, g);
        if (!r) continue;
        ctx.fillStyle = g.fill;
        roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.strokeStyle = g.border; ctx.lineWidth = g.thick || 1.5;
        roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
    }
    const resetW = node.widgets?.find((w) => w.name && w.name.indexOf("Reset") !== -1);
    if (resetW && resetW.last_y !== undefined) {
        const x0 = 14, x1 = node.size[0] - 14, y = resetW.last_y - 10;
        const grad = ctx.createLinearGradient(x0, 0, x1, 0);
        grad.addColorStop(0.00, "rgba(255, 255, 255, 0.00)");
        grad.addColorStop(0.15, "rgba(255, 220, 180, 0.35)");
        grad.addColorStop(0.50, "rgba(255, 220, 180, 0.60)");
        grad.addColorStop(0.85, "rgba(255, 220, 180, 0.35)");
        grad.addColorStop(1.00, "rgba(255, 255, 255, 0.00)");
        ctx.strokeStyle = grad; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
    ctx.restore();
}

function drawGroupLabels(node, ctx) {
    ctx.save();
    ctx.font = LABEL_FONT; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    for (const g of GROUPS) {
        const r = groupRect(node, g);
        if (!r) continue;
        ctx.fillStyle = g.label;
        ctx.fillText(g.name, r.x + 12, r.y + 9);
    }
    ctx.restore();
}

// ---------- эксперт: главное видно всегда, остальное — по переключателю ----------
function applyExpert(node, specs) {
    const ex = wv(node, "expert") === true;
    const manual = String(wv(node, "size") || "").startsWith("Ручной");
    let prevHidden = false;
    for (const w of node.widgets || []) {
        if (w.name === "control_after_generate" || w.name === "control_before_generate") {
            if (w.hidden !== prevHidden) w.hidden = prevHidden;
            continue;
        }
        const o = specs[w.name];
        if (!o) { prevHidden = false; continue; }
        let hide = !ex && !o.h3_main;
        if (w.name === "manual_width" || w.name === "manual_height") hide = !manual;   // только при «Ручной»
        if ((w.name === "total_seconds" || w.name === "block_seconds") && storyLinked(node)) hide = true;  // план — из story
        if (w.hidden !== hide) w.hidden = hide;
        prevHidden = hide;
    }
    applyGroupGaps(node);
    try {
        const sz = node.computeSize();
        node.setSize([Math.max(node.size[0], sz[0]), sz[1]]);
    } catch (_) {}
    app.graph?.setDirtyCanvas(true, true);
}

// ---------- часы ----------
// Часы стоят СРАЗУ ПОД входами/выходами (их число меняется: story / чайник / эксперт), а распорка CLOCK_ROOM
// держит под ними место — подпись больше не налезает на панели.
const CLOCK_ROOM = 84;
function slotsBottom(node) {
    const h = (globalThis.LiteGraph?.NODE_SLOT_HEIGHT) || 20;
    // у нового ComfyUI каждый виджет держит скрытый «вход» в node.inputs — считаем только настоящие гнёзда
    const ins = (node.inputs || []).filter((i) => !i.widget).length;
    return Math.max(ins, node.outputs?.length || 0) * h + 6;
}
function fmt(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (x) => String(x).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// Состояние часов — одно на всю страницу, а не в ноде: ComfyUI иногда пересоздаёт ноду (переключение вкладок
// со схемами, Ctrl+Z, смена значения в списке), и тогда часы «забывали», что прогон идёт, и показывали «--:--».
// События тоже слушаем один раз на страницу — без утечек от старых копий ноды.
const CLOCK = { start: null, end: null, running: false, result: "", stage: "", i: 0, total: 0, stageT0: 0,
                current: null, timer: null, approx: false, hooked: false };

function clockRedraw() { app.graph?.setDirtyCanvas(true, false); }

function clockFinish(r) {
    if (!CLOCK.running) return;
    CLOCK.running = false; CLOCK.end = Date.now(); CLOCK.result = r; CLOCK.current = null;
    clearInterval(CLOCK.timer); CLOCK.timer = null; clockRedraw();
}

function clockStart(approx) {
    Object.assign(CLOCK, { start: Date.now(), end: null, running: true, result: "", stage: "", i: 0, total: 0,
                           current: null, approx });
    clearInterval(CLOCK.timer); CLOCK.timer = setInterval(clockRedraw, 500); clockRedraw();
}

function hookClock() {
    if (CLOCK.hooked) return;
    CLOCK.hooked = true;
    api.addEventListener("execution_start", () => clockStart(false));
    api.addEventListener("executing", (e) => {
        const d = e.detail;
        const id = (d && typeof d === "object") ? (d.display_node ?? d.node) : d;
        if (id == null) { clockFinish("ok"); return; }
        if (!CLOCK.running) clockStart(true);      // страницу открыли посреди прогона
        CLOCK.current = id;
    });
    api.addEventListener("execution_success", () => clockFinish("ok"));
    api.addEventListener("execution_error", () => clockFinish("error"));
    api.addEventListener("execution_interrupted", () => clockFinish("stop"));
    api.addEventListener("status", (e) => {           // очередь не пуста, а старт мы пропустили
        const q = e.detail?.exec_info?.queue_remaining;
        if (q > 0 && !CLOCK.running && CLOCK.start == null) clockStart(true);
    });
    api.addEventListener("neron_h3story.progress", (e) => {
        const d = e.detail || {};
        if (d.stage !== CLOCK.stage) { CLOCK.stage = d.stage; CLOCK.stageT0 = Date.now(); }
        CLOCK.i = d.i || 0; CLOCK.total = d.total || 0;
    });
    api.addEventListener("progress", (e) => {         // шаги сэмплера — штатное событие Comfy
        const d = e.detail || {};
        if (!d.max || String(d.node) !== String(CLOCK.current)) return;
        if (app.graph?.getNodeById?.(d.node)?.type !== NODE) return;
        if (d.max !== CLOCK.total || d.value < CLOCK.i) CLOCK.stageT0 = Date.now() - 1;
        CLOCK.i = d.value; CLOCK.total = d.max;
    });
}

function setupClock(node) {
    hookClock();
    node.__h3Clock = CLOCK;
    const odf = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        const r = odf?.apply(this, arguments);
        if (this.flags?.collapsed) return r;
        const c = CLOCK;
        const mine = c.current != null && String(c.current) === String(this.id);
        // место справа под выходами: входов 8, выходов 5 — там пусто
        const cx = this.size[0] * 0.5, maxW = this.size[0] * 0.9;
        const fit = (t) => {
            if (ctx.measureText(t).width <= maxW) return t;
            while (t.length > 4 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
            return t + "…";
        };
        const now = Date.now();
        let big, l2 = "", l3 = "", color = "#cfd8dc";
        if (c.running) {
            big = (c.approx ? "⏱ ≥" : "⏱ ") + fmt(now - c.start); color = "#ffffff";
            if (mine && c.stage) {
                l2 = c.total > 1 ? `${c.stage} · ${c.i}/${c.total}` : c.stage;
                if (c.i > 0 && c.total > c.i) l3 = `≈ ещё ${fmt((now - c.stageT0) / c.i * (c.total - c.i))} / left`;
            } else if (!mine) {
                l2 = "ждёт своей очереди / waiting";
            }
        } else if (c.start) {
            big = "⏱ " + fmt(c.end - c.start);
            color = c.result === "ok" ? "#9be7a0" : c.result === "error" ? "#ff8a80" : "#ffd180";
            l2 = c.result === "ok" ? "весь прогон / total run" :
                 c.result === "error" ? "ошибка — время до неё / failed after" : "остановлено / stopped";
        } else {
            big = "⏱ --:--"; color = "#78909c"; l2 = "время генерации / run time";
        }
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = color; ctx.font = "bold 28px monospace";
        const y0 = slotsBottom(this);
        ctx.fillText(big, cx, y0 + 30);
        ctx.font = "13px sans-serif"; ctx.fillStyle = "#b0bec5";
        if (l2) ctx.fillText(fit(l2), cx, y0 + 52);
        ctx.font = "12px sans-serif"; ctx.fillStyle = "#90a4ae";
        if (l3) ctx.fillText(fit(l3), cx, y0 + 70);
        ctx.restore();
        return r;
    };
}


// ---------- три состояния: story / «чайник» / эксперт ----------
// story подключён — видно только story → video. Без story: «чайник» — первый кадр + промпты блоков,
// эксперт — всё (🎞 Блок, lora_all, размеры, все выходы). Подключённое никогда не прячем.
const MAX_BLOCKS = 12;
const LORA_TYPE = "NERON_H3_LORAS";
const BLOCK_TYPE = "NERON_H3_BLOCK";
const STORY_TYPE = "NERON_H3_STORY";
const EXTRA_OUTPUTS = [["frames", "IMAGE"], ["audio", "AUDIO"], ["last_frame", "IMAGE"], ["frames_count", "INT"]];

function canon() {
    const list = [["story", STORY_TYPE], ["first_frame", "IMAGE"], ["appearance", "IMAGE"], ["lora_all", LORA_TYPE]];
    for (let k = 1; k <= MAX_BLOCKS; k++)
        list.push([`prompt_${k}`, "STRING"], [`block_${k}`, BLOCK_TYPE], [`lora_${k}`, LORA_TYPE]);
    return list.concat([["ref_audio_1", "AUDIO"], ["ref_audio_2", "AUDIO"], ["ref_audio_3", "AUDIO"],
                        ["width", "INT"], ["height", "INT"]]);
}

function linked(node, name) {
    const i = node.inputs?.find((x) => x.name === name);
    return !!(i && i.link != null);
}

function storyLinked(node) { return linked(node, "story"); }

function wantedBlocks(node) {
    let n = 1;
    for (let k = 1; k <= MAX_BLOCKS; k++) {
        if (["prompt", "block", "lora"].some((p) => linked(node, `${p}_${k}`))) n = Math.max(n, Math.min(MAX_BLOCKS, k + 1));
    }
    return n;
}

function wantedSet(node) {
    const ex = wv(node, "expert") === true;
    const st = storyLinked(node);
    const n = wantedBlocks(node);
    const want = new Set(["story"]);
    if (!st) {
        want.add("first_frame");
        for (let k = 1; k <= n; k++) want.add(`prompt_${k}`);
        if (ex) {
            ["appearance", "lora_all", "width", "height"].forEach((x) => want.add(x));
            for (let k = 1; k <= n; k++) want.add(`block_${k}`);
        }
    }
    if (ex) {   // звуковые образцы — только эксперт, и со story тоже: AutoPrompter про них не знает
        want.add("ref_audio_1");
        if (linked(node, "ref_audio_1")) want.add("ref_audio_2");
        if (linked(node, "ref_audio_2")) want.add("ref_audio_3");
    }
    for (const inp of node.inputs || []) if (inp.link != null) want.add(inp.name);   // подключённое — всегда
    return want;
}

function updateOutputs(node) {
    if (!node.outputs) return;
    const all = wv(node, "expert") === true && !storyLinked(node);
    const extraLinked = node.outputs.slice(1).some((o) => o.links && o.links.length);
    if (all || extraLinked) {
        // индексы выходов важны для ComfyUI — добавляем только недостающий хвост и строго по порядку
        for (let i = node.outputs.length - 1; i < EXTRA_OUTPUTS.length; i++) {
            const [name, type] = EXTRA_OUTPUTS[i];
            if (node.outputs.length === i + 1) node.addOutput(name, type);
        }
    } else {
        for (let i = node.outputs.length - 1; i >= 1; i--) node.removeOutput(i);   // все четыре разом
    }
}

// Входы по порядку canon(). Провода переносим вместе со входом: у каждого провода поправляем номер слота.
function sortInputs(node) {
    const rank = new Map(canon().map(([n], i) => [n, i]));
    const before = node.inputs.slice();
    const sorted = before.slice().sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999));
    if (sorted.every((x, i) => x === before[i])) return;
    node.inputs.length = 0;
    node.inputs.push(...sorted);
    sorted.forEach((inp, slot) => {
        if (inp.link == null) return;
        const l = app.graph?.links?.[inp.link] ?? app.graph?.links?.get?.(inp.link);
        if (l) l.target_slot = slot;
    });
}

function updateBlockInputs(node) {
    if (!node.inputs || node.__neronUpdating) return;
    node.__neronUpdating = true;
    try {
        const want = wantedSet(node);
        const order = canon().filter(([name]) => want.has(name));
        for (let i = node.inputs.length - 1; i >= 0; i--) {
            const inp = node.inputs[i];
            if (canon().some(([nm]) => nm === inp.name) && !want.has(inp.name) && inp.link == null) node.removeInput(i);
        }
        const names = () => node.inputs.map((x) => x.name);
        for (const [name, type] of order) if (!names().includes(name)) node.addInput(name, type);
        sortInputs(node);
        updateOutputs(node);
    } catch (e) {
        console.warn("[Neron H3 Story] входы:", e);
    } finally {
        node.__neronUpdating = false;
    }
    try { node.setSize([node.size[0], Math.max(node.size[1], node.computeSize()[1])]); } catch (_) {}
    app.graph?.setDirtyCanvas(true, true);
}

// ---------- 📥 модели ----------
const DL = { status: null, hooked: false, dialog: null, autoShown: false, nodes: new Set() };

function gb(b) { return (b / 1024 ** 3).toFixed(1); }

async function fetchStatus() {
    try {
        const r = await api.fetchApi("/neron_h3story/status");
        DL.status = await r.json();
    } catch (_) { DL.status = null; }
    refreshButtons();
    return DL.status;
}

function refreshButtons() {
    const s = DL.status;
    let label = MODELS_BTN;
    if (s) {
        const miss = s.files.filter((f) => !f.present).length;
        const st = s.download?.state;
        if (st === "downloading" || st === "probing") label = "⏬ Качаю модели… / Downloading…";
        else if (miss === 0) label = "✅ Модели на месте / Models OK";
        else label = `📥 Скачать модели (нет ${miss} из ${s.files.length}) / Download models`;
    }
    for (const node of DL.nodes) {
        const b = node.__h3ModelsBtn;
        if (b) { b.name = label; b.label = label; }
    }
    app.graph?.setDirtyCanvas(true, false);
}

function hookDownload() {
    if (DL.hooked) return;
    DL.hooked = true;
    api.addEventListener("neron_h3story.download", (e) => {
        if (DL.status) DL.status.download = e.detail || {};
        const st = e.detail?.state;
        if (st === "done") {
            // новые файлы — сразу в списки моделей, без перезапуска ComfyUI
            try { app.refreshComboInNodes?.(); } catch (_) {}
            fetchStatus().then(() => DL.dialog?.render());
        }
        else { refreshButtons(); DL.dialog?.render(); }
    });
}

function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
}

function btn(text, bg, onClick) {
    const b = el("button", `padding:8px 16px;background:${bg};color:#fff;border:none;border-radius:5px;` +
        "cursor:pointer;font:13px sans-serif;margin:4px 6px 4px 0;", text);
    b.onclick = onClick;
    return b;
}

function openModelsDialog(greeting) {
    if (DL.dialog) { DL.dialog.render(); return; }
    const overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;");
    const box = el("div", "background:#14202a;color:#e0e0e0;border:1px solid #3d6273;border-radius:10px;padding:20px 22px;" +
        "width:min(680px,92vw);max-height:88vh;overflow-y:auto;font:13px/1.5 sans-serif;" +
        "box-shadow:0 10px 40px rgba(0,0,0,0.85);");
    overlay.append(box);
    const close = () => { overlay.remove(); DL.dialog = null; };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    let tokenInput = null;

    const render = () => {
        const s = DL.status;
        box.innerHTML = "";
        box.append(el("div", "font:bold 17px sans-serif;margin-bottom:6px;color:#bfe9ff;",
                      "📥 Модели для H3 Story / Models for H3 Story"));
        if (!s) {
            box.append(el("div", "color:#ff8a80;margin:10px 0;", "Не удалось узнать состояние моделей. Перезапусти ComfyUI.\n" +
                          "EN: Could not read model status. Restart ComfyUI."));
            box.append(btn("Закрыть / Close", "#455a64", close));
            return;
        }
        const missing = s.files.filter((f) => !f.present);
        const d = s.download || {};
        if (greeting && missing.length) {
            box.append(el("div", "background:#1f3a2a;border:1px solid #3f7a52;border-radius:6px;padding:10px 12px;margin:8px 0;",
                "👋 Каких-то моделей H3 у тебя пока нет. Не беда — нажми «Скачать пакет»: нода скачает недостающее " +
                "сама и разложит по папкам. Что уже лежит — не трогает.\n\n" +
                "EN: Some H3 models are missing. Press «Download pack» — the node downloads what is missing and " +
                "puts it in the right folders. What you already have is left alone."));
            box.lastChild.style.whiteSpace = "pre-wrap";
        }
        box.append(el("div", "font:bold 14px sans-serif;margin-top:10px;", s.pack_title));
        const desc = el("div", "color:#b0bec5;white-space:pre-wrap;margin:4px 0 8px;", s.pack_description);
        box.append(desc);
        const list = el("div", "background:#0d171e;border-radius:6px;padding:8px 12px;margin:6px 0;font:12px monospace;");
        for (const f of s.files) {
            const part = (!f.present && f.partial_bytes) ? `  (скачано ${gb(f.partial_bytes)} ГБ — докачаю)` : "";
            const alt = (f.present && f.have && f.have !== f.name) ? `  (есть замена / have: ${f.have})` : "";
            list.append(el("div", f.present ? "color:#9be7a0;" : "color:#ffcc80;",
                           `${f.present ? "✅" : "❌"} ${f.name}${alt}${part}`));
        }
        box.append(list);
        const info = [];
        if (s.size_note) info.push(`Объём пакета / pack size: ${s.size_note}`);
        if (s.free_gb != null) info.push(`Свободно на диске моделей / free disk: ${s.free_gb.toFixed(0)} ГБ`);
        if (s.vram_gb) info.push(`Видеокарта / GPU: ${s.vram_gb.toFixed(0)} ГБ` + (s.ram_gb ? `, оперативка / RAM: ${s.ram_gb.toFixed(0)} ГБ` : ""));
        box.append(el("div", "color:#90a4ae;white-space:pre-wrap;margin-bottom:8px;", info.join("\n")));

        const busy = d.state === "downloading" || d.state === "probing";
        if (!missing.length) {
            box.append(el("div", "color:#9be7a0;font:bold 14px sans-serif;margin:10px 0;",
                          "✅ Всё на месте! Подключи картинку и промпты блоков (или Story AutoPrompter) и жми Run.\nEN: All set! Connect an image and block prompts (or the Story AutoPrompter) and press Run."));
            box.lastChild.style.whiteSpace = "pre-wrap";
            box.append(btn("Закрыть / Close", "#2a5d9c", close));
            return;
        }

        // доступ к Hugging Face
        const needToken = missing.some((f) => f.gated) || ["gated", "no_token"].includes(d.error);
        if (needToken) {
            const t = el("div", "border:1px solid #3d6273;border-radius:6px;padding:10px 12px;margin:8px 0;");
            t.append(el("div", "font:bold 13px sans-serif;margin-bottom:4px;",
                        s.token_set ? "🔑 Доступ к Hugging Face: токен сохранён ✅ / token saved"
                                    : "🔑 Доступ к Hugging Face — один раз / one time only"));
            t.append(el("div", "color:#b0bec5;white-space:pre-wrap;",
                "Hugging Face попросил вход. Это бесплатно и один раз:\n" +
                "1) Открой страницу модели, войди (можно через Google); если есть «Agree and access» — нажми.\n" +
                "2) Открой страницу токенов → «Create new token» → тип «Read» → скопируй.\n" +
                "3) Вставь токен сюда и нажми «Сохранить», потом «Докачать». Он хранится только на твоём компьютере.\n" +
                "Токен от Neron LTX Engine подхватывается сам.\n\n" +
                "EN: Hugging Face asked for a sign-in (free, once): 1) open the model page, sign in, accept if asked; " +
                "2) create a Read token; 3) paste it here, save, resume. It stays on your computer."));
            const row = el("div", "margin-top:6px;");
            row.append(btn("1. Страница модели / Model page", "#37474f", () => window.open(s.license_url, "_blank")));
            row.append(btn("2. Страница токенов / Tokens page", "#37474f", () => window.open(s.token_url, "_blank")));
            t.append(row);
            if (!s.token_from_env) {
                const r2 = el("div", "display:flex;gap:6px;align-items:center;margin-top:4px;");
                tokenInput = el("input", "flex:1;padding:7px;background:#0d171e;color:#e0e0e0;border:1px solid #3d6273;" +
                    "border-radius:4px;font:12px monospace;");
                tokenInput.type = "password";
                tokenInput.placeholder = s.token_set ? "токен уже сохранён — можно заменить / saved, can replace" : "hf_…";
                r2.append(tokenInput);
                r2.append(btn("3. Сохранить / Save", "#2e7d32", async () => {
                    const v = tokenInput.value.trim();
                    if (!v) return;
                    await api.fetchApi("/neron_h3story/token", { method: "POST", body: JSON.stringify({ token: v }) });
                    await fetchStatus(); render();
                }));
                t.append(r2);
            }
            box.append(t);
        }

        // прогресс и ошибки
        if (busy || d.state === "error" || d.state === "cancelled") {
            const p = el("div", "margin:8px 0;");
            if (busy) {
                const pct = d.total ? Math.min(100, d.done / d.total * 100) : 0;
                p.append(el("div", "", d.state === "probing" ? "Проверяю файлы… / Checking files…"
                    : `Файл ${d.file_i} из ${d.files_n}: ${d.file}`));
                const bar = el("div", "height:14px;background:#0d171e;border-radius:7px;overflow:hidden;margin:6px 0;");
                bar.append(el("div", `height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,#2a8fc4,#5fd0ff);`));
                p.append(bar);
                if (d.total) p.append(el("div", "color:#90a4ae;font:12px monospace;",
                    `${gb(d.done)} / ${gb(d.total)} ГБ · ${pct.toFixed(1)}% · ${(d.speed || 0).toFixed(1)} МБ/с` +
                    (d.speed > 0 ? ` · ≈ ещё ${fmt((d.total - d.done) / (d.speed * 1024 * 1024) * 1000)}` : "")));
                p.append(el("div", "color:#78909c;font-size:12px;margin-top:4px;",
                    "Окно можно закрыть — скачивание продолжится. EN: You can close this window, the download continues."));
            } else {
                p.append(el("div", "color:#ff8a80;white-space:pre-wrap;background:#2a1414;border-radius:6px;padding:8px 10px;",
                            d.message || "Ошибка / Error"));
            }
            box.append(p);
        }

        const row = el("div", "margin-top:10px;");
        if (busy) {
            row.append(btn("⏹ Остановить / Stop", "#8e3b3b", async () => {
                await api.fetchApi("/neron_h3story/cancel", { method: "POST", body: "{}" });
            }));
        } else {
            const resume = s.files.some((f) => !f.present && f.partial_bytes);
            row.append(btn(resume ? "⏬ Докачать / Resume" : "⏬ Скачать пакет / Download pack", "#2a7fc4", async () => {
                if (needToken && !s.token_set && tokenInput && tokenInput.value.trim()) {
                    await api.fetchApi("/neron_h3story/token", { method: "POST", body: JSON.stringify({ token: tokenInput.value.trim() }) });
                }
                await api.fetchApi("/neron_h3story/download", { method: "POST", body: JSON.stringify({ pack: s.pack_id }) });
                await fetchStatus(); render();
            }));
        }
        row.append(btn("Закрыть / Close", "#455a64", close));
        box.append(row);
    };

    DL.dialog = { render };
    document.body.append(overlay);
    fetchStatus().then(render);
    render();
}

// ---------- справка ----------
const HELP_TEXT = `
🎬 NERON H3 STORY
===================================================

📌 WHAT IT IS 📌
A long MiniMax H3 video (5–45 s) with sound, made as
a chain of BLOCKS. H3 itself makes at most ~15 s; a
longer clip "drifts". So the node makes short pieces
one after another and glues them so the seams are
hard to see — picture AND sound. The model loads once
for the whole video. Output: a ready VIDEO with sound.

📌 FIRST RUN 📌
No models? The 📥 window opens by itself (or press
"📥 Models"): the node downloads what is missing and
puts each file in the right folder — with progress,
resume after a dropped connection and a disk check.
Files you already have (even another version, e.g.
the bf16 model) are not downloaded again.
Models: official Comfy-Org page; Turbo/Fast LoRAs:
their authors lightx2v. All models are on "🤖 auto".
The Story AutoPrompter needs the 🎬 Neron AutoPrompter
folder — it downloads its LLM and server itself.

📌 WHAT A BLOCK IS 📌
One scene of the video, 5–15 s. 30 s with 10 s blocks
= 4 blocks of ~8.7 s. "Block seconds" is the MAXIMUM:
the video is split into EQUAL blocks no longer than
that. The node counts blocks itself (up to 12) and
cuts the finished video exactly to the video length.
Shorter blocks drift less, but there are more seams.
Each block has its own prompt, pictures and LoRAs.

📌 HOW BLOCKS ARE GLUED (THE SEAM) 📌
Block 1 starts from your first frame.
Block 2, 3… do NOT start from a picture: the last
~0.9 s of the previous block (22 frames) together WITH
ITS SOUND is pinned to the start of the next one. The
model sees the motion and hears the sound and simply
carries on — steps, speech, music don't restart.
When joining, that overlap is cut from the picture
and the sound is crossfaded over it.
Each block also gets "a single continuous shot, no
cuts" — otherwise H3 likes to cut to a new angle.
Seam (expert): clip + sound (default) or one frame;
length 22 frames, 5 (shorter) or 39 (~1.6 s, more
"memory" of the motion).

📌 SOUND 📌
H3 makes picture and sound together — voices, steps,
music, ambience — from your prompt. The seam carries
the sound on, so the video sounds like one take.
Write sound into the prompt: "Sound: rain on the
roof, soft piano". The AutoPrompter adds a Sound line
to every block itself.
⚙ Expert: ref_audio_1…3 — sound samples (LoadAudio):
a voice, music or ambience. They go as <Audio 1…3>
into EVERY block (up to 15 s each). If the prompt has
no <Audio 1>, the engine adds "the sound follows
<Audio 1>". The AutoPrompter doesn't know about them —
this is your own call: try it, listen, decide.

📌 🔒 KEEP APPEARANCE (on by default) 📌
People, cars, creatures look the same in every block.
The end of a block can be "empty" (they hugged, turned
away) — without a sample the next block may draw
other people. The first frame (or 'appearance') goes
as <Picture 1> into EVERY block, as an identity-only
sample: faces, hair, clothes — not its background or
poses. Turn off if the subject must change by story.

📌 🎞 BLOCK PICTURES (expert) 📌
Block 1 first frame — the opening frame.
Blocks 2+ first frame — a "who / where" sample.
Middle frames — navigators "the action goes here".
Last frame — pinned to the block's last frame.
In the block they become <Picture 2>, <Picture 3>…

📌 LORA 📌
🎨 LoRA set > lora_all — for the WHOLE video (style).
🎨 LoRA set > 🎞 Block > loras — only that block.
Up to 3 per set, sets can be chained.

📌 MODE 📌
🚀 Fast — 4 steps on the 4-step LoRA (lightx2v
   settings: euler, shift 6/3). Cartoons, 3D, trying
   out a story. Expert: 4 / 6 / 8 steps.
⚡ Turbo — 12 steps on the 8-step LoRA. Main mode.
Quality — 40 steps, ~3× longer than Turbo.
Maximum — 50 steps + the bf16 model if you have it.
Measured on the author's PC, 1344×768: Turbo int8,
30 s video (4 blocks) incl. AutoPrompter — 1 h 18 min;
Turbo bf16 — ~30 min per 10 s block. Time grows with
the number of blocks.

📌 THREE STATES OF THE NODE 📌
• 'story' connected — only story → video: plan,
  prompts, pictures and LoRAs come through one wire.
• Beginner — first_frame + prompt_1, 2… (the next
  appears when you connect the previous).
• ⚙ Expert — everything: 🎞 Block nodes, lora_all,
  sound samples, sizes, seam, models, all outputs.
A wire straight into the engine wins over 'story'.
Connected inputs are never hidden.

📌 OUTPUTS 📌
video — with sound, straight into Save Video.
frames / audio — separately. last_frame — the end,
to continue in the next run.

📌 QUICK START 📌
1. Open workflow Neron_H3_Story_AutoPrompter
2. LoadImage — your first frame
3. Scenario — what happens, in your own words
4. Video 30 s, block 10 s, mode ⚡ Turbo
5. Queue

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Длинный ролик MiniMax H3 (5–45 с) со звуком, собранный
цепочкой БЛОКОВ. Сама H3 делает максимум ~15 с, а
длинный кусок «уплывает». Поэтому нода делает короткие
куски один за другим и склеивает их так, что стыков
не видно — ни в картинке, ни в звуке. Модель грузится
один раз на весь ролик. На выходе — готовое ВИДЕО со
звуком.

📌 ПЕРВЫЙ ЗАПУСК 📌
Нет моделей? Окно 📥 откроется само (или нажми
«📥 Модели»): нода скачает недостающее и разложит по
папкам — с прогрессом, докачкой после обрыва и
проверкой места на диске. Что уже лежит (даже другая
версия, например модель bf16) — заново не качает.
Модель — с официальной страницы Comfy-Org, LoRA
Турбо/Быстро — от их авторов lightx2v. Все модели
стоят на «🤖 авто».
Story AutoPrompter'у нужна папка 🎬 Neron AutoPrompter
— свою LLM и сервер она скачивает сама.

📌 ЧТО ТАКОЕ БЛОК 📌
Одна сцена ролика, 5–15 с. 30 с при блоке 10 с =
4 блока по ~8,7 с. «Длина блока» — это МАКСИМУМ: ролик
делится на РОВНЫЕ блоки не длиннее неё. Сколько
блоков (до 12), нода считает сама, а готовый ролик
обрезает ровно под длину ролика. Короче блок — меньше
«уплывает», но больше стыков.
У каждого блока свой промпт, картинки и LoRA.

📌 КАК СКЛЕИВАЮТСЯ БЛОКИ (СТЫК) 📌
Блок 1 начинается с твоего первого кадра.
Блоки 2, 3… начинаются НЕ с картинки: последние
~0,9 с прошлого блока (22 кадра) ВМЕСТЕ СО ЗВУКОМ
прикалываются к началу следующего. Модель видит
движение, слышит звук и просто продолжает — шаги,
речь, музыка не начинаются заново.
При склейке этот перехлёст вырезается из картинки, а
звук на нём плавно сводится.
Каждому блоку добавляется «один непрерывный план, без
склеек» — иначе H3 любит перескочить на новый ракурс.
Стык (эксперт): кусок + звук (по умолчанию) или один
кадр; длина 22 кадра, 5 (короче) или 39 (~1,6 с,
больше «памяти» о движении).

📌 ЗВУК 📌
H3 делает картинку и звук вместе — голоса, шаги,
музыку, фон — по твоему промпту. Стык переносит звук
дальше, поэтому ролик звучит как один дубль.
Пиши звук в промпте: «Звук: дождь по крыше, тихое
пианино». AutoPrompter сам добавляет строку Sound в
каждый блок.
⚙ Эксперт: ref_audio_1…3 — звуковые образцы
(LoadAudio): голос, музыка или фон. Идут как
<Audio 1…3> в КАЖДЫЙ блок (до 15 с каждый). Нет в
промпте <Audio 1> — движок сам допишет «звук как в
образце». AutoPrompter про них не знает — это твоё
решение: пробуй, слушай, решай.

📌 🔒 СОХРАНИТЬ ВНЕШНИЙ ВИД (вкл. по умолчанию) 📌
Люди, машины, звери выглядят одинаково во всех
блоках. Конец блока бывает «пустым» (обнялись,
отвернулись) — без образца следующий блок может
нарисовать других людей. Первый кадр (или вход
'appearance') идёт <Picture 1> в КАЖДЫЙ блок — только
как образец внешности: лица, волосы, одежда, а не его
фон и позы. Сними, если объект по сюжету меняется.

📌 КАРТИНКИ 🎞 БЛОКА (эксперт) 📌
Первый кадр блока 1 — начало ролика.
Первый кадр блоков 2+ — образец «кто / где».
Промежуточные — навигаторы «действие идёт сюда».
Последний — прикалывается к концу блока.
В блоке они становятся <Picture 2>, <Picture 3>…

📌 LORA 📌
🎨 Набор LoRA > lora_all — на ВЕСЬ ролик (стиль).
🎨 Набор LoRA > 🎞 Блок > loras — только этот блок.
До 3 в наборе, наборы можно цеплять цепочкой.

📌 РЕЖИМ 📌
🚀 Быстро — 4 шага на 4-шаговой LoRA (настройки
   авторов lightx2v: euler, сдвиг 6/3). Мультики, 3D,
   проба сюжета. Эксперт: 4 / 6 / 8 шагов.
⚡ Турбо — 12 шагов на 8-шаговой LoRA. Основной.
Качество — 40 шагов, ~3× дольше Турбо.
Максимум — 50 шагов + модель bf16, если скачана.
Замеры на компьютере автора, 1344×768: Турбо int8,
ролик 30 с (4 блока) вместе с AutoPrompter — 1 ч 18 мин;
Турбо bf16 — ~30 мин на блок 10 с. Время растёт с
числом блоков.

📌 ТРИ СОСТОЯНИЯ НОДЫ 📌
• Подключён 'story' — видно только story → video:
  план, промпты, картинки и LoRA идут одним проводом.
• «Чайник» — first_frame + prompt_1, 2… (следующий
  появляется, когда подключён прошлый).
• ⚙ Эксперт — всё: ноды 🎞 Блок, lora_all, звуковые
  образцы, размеры, стык, модели, все выходы.
Провод прямо в движок главнее 'story'. Подключённое
никогда не прячется.

📌 ВЫХОДЫ 📌
video — со звуком, сразу в Save Video.
frames / audio — отдельно. last_frame — конец ролика,
чтобы продолжить в следующем прогоне.

📌 БЫСТРЫЙ СТАРТ 📌
1. Открой процесс Neron_H3_Story_AutoPrompter
2. LoadImage — твой первый кадр
3. Сценарий — что происходит, своими словами
4. Ролик 30 с, блок 10 с, режим ⚡ Турбо
5. Queue

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

// сброс: всё к заводским, кроме выбранных файлов моделей (их пользователь подбирал сам)
function resetAll(node, specs) {
    for (const w of node.widgets || []) {
        const o = specs[w.name];
        if (!o || w.name.endsWith("_model") || !("default" in o)) continue;
        w.value = o.default;
        try { w.callback?.(w.value, app.canvas, node, [0, 0], null); } catch (_) {}
    }
    applyExpert(node, specs);
}

app.registerExtension({
    name: "Neron.H3.Story",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const specs = {};
        for (const grp of ["required", "optional"])
            for (const [k, s] of Object.entries(nodeData.input?.[grp] || {}))
                specs[k] = (Array.isArray(s) && s[1] && typeof s[1] === "object") ? s[1] : {};

        const origCreated = nodeType.prototype.onNodeCreated;
        const origConfigure = nodeType.prototype.onConfigure;
        const origDrawBg = nodeType.prototype.onDrawBackground;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        const origResize = nodeType.prototype.onResize;
        const origRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            DL.nodes.delete(this);
            return origRemoved?.apply(this, arguments);
        };

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;
            // невидимая распорка сверху — подпись первой панели не наезжает на входы
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.draw = function () {};
            spacer.computeSize = () => [0, CLOCK_ROOM];   // место под часы — сразу под входами/выходами
            node.widgets.splice(node.widgets.indexOf(spacer), 1);
            node.widgets.unshift(spacer);
            for (const w of node.widgets || []) {
                if (w.name !== "expert" && w.name !== "size") continue;
                const cb = w.callback;
                w.callback = function () { const rr = cb?.apply(this, arguments); updateBlockInputs(node); applyExpert(node, specs); return rr; };
            }
            node.__h3ModelsBtn = node.addWidget("button", MODELS_BTN, null, () => openModelsDialog(false));
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            for (const t of [50, 300, 800]) setTimeout(() => { updateBlockInputs(node); applyExpert(node, specs); }, t);
            setupClock(node);
            hookDownload();
            DL.nodes.add(node);
            // первый запуск: чего-то не хватает — окно само, один раз за сессию
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => { updateBlockInputs(this); applyExpert(this, specs); }, t);
            return r;
        };
        const origConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = origConn?.apply(this, arguments);
            clearTimeout(this.__neronInputs);
            this.__neronInputs = setTimeout(() => { updateBlockInputs(this); applyExpert(this, specs); }, 30);
            return r;
        };
        nodeType.prototype.onResize = function () {
            const r = origResize?.apply(this, arguments);
            clearTimeout(this.__neronReapply);
            this.__neronReapply = setTimeout(() => applyGroupGaps(this), 50);
            return r;
        };
        nodeType.prototype.onDrawBackground = function (ctx) {
            origDrawBg?.apply(this, arguments);
            if (!this.flags?.collapsed) drawGroupRects(this, ctx);
        };
        nodeType.prototype.onDrawForeground = function (ctx) {
            origDrawFg?.apply(this, arguments);
            if (!this.flags?.collapsed) drawGroupLabels(this, ctx);
        };
    },
});
