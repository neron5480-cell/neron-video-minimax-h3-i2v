// 🎬 Neron H3 One — оформление в стиле Neron (как H3 Story / H3 Engine):
// режим эксперта, часы генерации, окно моделей по режиму, 📋 отчёт с замером и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3One";
const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";
const FRAME_BOTTOM = 8;      // воздух между последним виджетом и низом рамки
const GROUP_GAP = 18 + FRAME_BOTTOM;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "РОЛИК / CLIP", widgets: ["mode", "seconds", "first_as"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "РАЗМЕР / SIZE", widgets: ["size", "manual_width", "manual_height"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "LoRA", widgets: ["lora_1", "strength_1", "lora_2", "strength_2", "lora_3", "strength_3"],
      fill: "rgba(180, 120, 220, 0.15)", border: "rgba(180, 120, 220, 0.75)", label: "rgba(230, 200, 255, 1.0)" },
    { name: "⚡ УСКОРЕНИЕ / SPEED", widgets: ["attention", "sparse", "sparse_tau"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["unet_model", "clip_model", "vae_video_model", "vae_audio_model",
                                         "turbo_lora_model", "fast_lora_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ТОНКАЯ НАСТРОЙКА / ADVANCED", widgets: ["seed", "control_after_generate", "fast_steps", "fast_kind",
                                                     "balance_clean", "protect_lora", "keep_clip", "ref_quality"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
];

const G = (name, widgets, rgb, label, thick) => ({ name, widgets, fill: `rgba(${rgb}, 0.15)`,
    border: `rgba(${rgb}, 0.75)`, label, thick });
const GROUPS_SWAP = [
    GROUPS[0],
    G("🎭 ПОДМЕНА / SWAP", ["_swap_windows", "what", "sound"], "220, 120, 160", "rgba(255, 200, 225, 1.0)"),
    G("РЕЖИМ / MODE", ["mode"], " 90, 140, 200", "rgba(180, 215, 255, 1.0)"),
    G("ТОНКО / FINE", ["hold", "extra", "size", "max_seconds", "lora_1", "strength_1"], "200, 160,  90",
      "rgba(255, 225, 170, 1.0)"),
    GROUPS[4], GROUPS[5],
    G("ТОНКАЯ НАСТРОЙКА / ADVANCED", ["seed", "control_after_generate", "fast_steps", "fast_kind", "balance_clean",
      "protect_lora", "keep_clip", "ref_quality"], "120, 200, 160", "rgba(190, 255, 220, 1.0)"),
];
// у каждой ноды пакета — свои группы и справка; оформление, часы, модели и отчёт — общие
const CONFIG = {
    NeronH3One: { groups: GROUPS, title: "📖 Neron H3 One", help: () => HELP_TEXT },
    NeronH3Swap: { groups: GROUPS_SWAP, title: "📖 Neron H3 Подмена / Swap", help: () => HELP_SWAP,
                   alwaysHidden: ["video", "photo", "own_audio"], windows: true },
};
function groupsOf(node) { return CONFIG[node?.type]?.groups || GROUPS; }

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
    const ws = node.widgets || [];
    for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        const wy = w.last_y ?? w.y;                    // в разных сборках ComfyUI — last_y или y
        if (!g.widgets.includes(w.name) || isHidden(w) || wy === undefined) continue;
        let bottom = wy + widgetHeight(w, node.size[0]) - (w.__neronBottomPadding || 0);
        // Низ виджета — по месту, которое ему реально отдал ComfyUI (до следующего виджета): в некоторых сборках
        // виджеты выше, чем говорит computeSize, и рамка «не доставала» до низа последнего виджета.
        for (let j = i + 1; j < ws.length; j++) {
            const nx = ws[j], ny = nx.last_y ?? nx.y;
            if (isHidden(nx) || ny === undefined || ny <= wy) continue;
            bottom = Math.max(bottom, ny - (w.__neronBottomPadding || 0) - 2);
            break;
        }
        y0 = Math.min(y0, wy); y1 = Math.max(y1, bottom);
    }
    if (!isFinite(y0) || y1 <= y0) return null;
    const padX = 10, labelH = 16;
    return { x: padX, y: y0 - labelH, w: node.size[0] - padX * 2, h: (y1 - y0) + labelH + FRAME_BOTTOM };
}

function applyGroupGaps(node) {
    for (const w of node.widgets || []) clearBottomPadding(w);
    for (const g of groupsOf(node)) {
        let last = null;
        for (const w of node.widgets || []) if (g.widgets.includes(w.name) && !isHidden(w)) last = w;
        if (last) setBottomPadding(last, GROUP_GAP);
    }
}

function drawGroupRects(node, ctx) {
    ctx.save();
    for (const g of groupsOf(node)) {
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
    for (const g of groupsOf(node)) {
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
        if (w.name === "seconds" && linked(node, "length_in")) hide = true;         // длина пришла проводом
        if (w.name === "sparse_tau" && String(wv(node, "sparse") || "").startsWith("выкл")) hide = true;
        if (CONFIG[node.type]?.alwaysHidden?.includes(w.name)) hide = true;      // вместо них — окна в ноде
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
// Часы стоят СРАЗУ ПОД входами/выходами, а распорка CLOCK_ROOM держит под ними место.
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
    api.addEventListener("neron_h3one.progress", (e) => {
        const d = e.detail || {};
        if (d.stage !== CLOCK.stage) { CLOCK.stage = d.stage; CLOCK.stageT0 = Date.now(); }
        CLOCK.i = d.i || 0; CLOCK.total = d.total || 0;
    });
    api.addEventListener("progress", (e) => {         // шаги сэмплера — штатное событие Comfy
        const d = e.detail || {};
        if (!d.max || String(d.node) !== String(CLOCK.current)) return;
        if (!(app.graph?.getNodeById?.(d.node)?.type in CONFIG)) return;
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

// ---------- 📥 модели ----------
const DL = { status: null, hooked: false, dialog: null, autoShown: false, nodes: new Set(), pack: "standard" };

function gb(b) { return (b / 1024 ** 3).toFixed(1); }

// у каждого режима свой пакет моделей — окно показывает пакет режима последней тронутой ноды
const MODE_PACK = { "🔥": "extreme", "🚀": "standard", "⚖": "standard", "✨": "quality", "👑": "maximum" };
function packOf(node) {
    const m = String(wv(node, "mode") || "");
    for (const [k, v] of Object.entries(MODE_PACK)) if (m.startsWith(k)) return v;
    return "standard";
}

async function fetchStatus() {
    try {
        const r = await api.fetchApi("/neron_h3one/status?pack=" + encodeURIComponent(DL.pack || "standard"));
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
    api.addEventListener("neron_h3one.download", (e) => {
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
                      "📥 Модели для H3 One / Models for H3 One"));
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
                          "✅ Всё на месте для этого режима! Подключи промпт (и картинку) и жми Run.\nEN: All set for this mode! Connect a prompt (and a picture) and press Run."));
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
                "Токен от H3 Story / H3 Studio / LTX Engine подхватывается сам.\n\n" +
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
                    await api.fetchApi("/neron_h3one/token", { method: "POST", body: JSON.stringify({ token: v }) });
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
                await api.fetchApi("/neron_h3one/cancel", { method: "POST", body: "{}" });
            }));
        } else {
            const resume = s.files.some((f) => !f.present && f.partial_bytes);
            row.append(btn(resume ? "⏬ Докачать / Resume" : "⏬ Скачать пакет / Download pack", "#2a7fc4", async () => {
                if (needToken && !s.token_set && tokenInput && tokenInput.value.trim()) {
                    await api.fetchApi("/neron_h3one/token", { method: "POST", body: JSON.stringify({ token: tokenInput.value.trim() }) });
                }
                await api.fetchApi("/neron_h3one/download", { method: "POST", body: JSON.stringify({ pack: s.pack_id }) });
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


// ---------- 📋 отчёт: что движок взял и почему + ⏱ замер ----------
const REPORT = { text: "" };
function showText(title, text) {
    const overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;");
    const box = el("div", "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;" +
        "max-width:820px;max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);");
    box.append(el("div", "font:bold 16px sans-serif;margin-bottom:10px;color:#bfe9ff;", title));
    box.append(el("div", "", text));
    const row = el("div", "margin-top:14px;text-align:center;");
    row.append(btn("📋 Копировать / Copy", "#2e7d32", () => { try { navigator.clipboard.writeText(text); } catch (_) {} }));
    row.append(btn("Close / Закрыть", "#2a5d9c", () => overlay.remove()));
    box.append(row);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

// ---------- справка ----------
const HELP_TEXT = `
🎬 NERON H3 ONE — ЕДИНЫЙ ДВИЖОК / SINGLE ENGINE
===================================================

Один ролик MiniMax H3 со звуком (1–15 с). Собран из проверенного в H3 Engine, H3 Story,
Studio HD и H3 Studio. Ставится рядом со старыми нодами — ничего не ломает и не перекачивает.

РЕЖИМЫ / MODES
---------------------------------------------------
🔥 Экстрим  — самое быстрое из установленного:
             Fast H3 (8 шагов + разреженное внимание vsa) или база + быстрая LoRA, 4 шага.
             Деталь проще. Своя модель (например, дообученная) НЕ подменяется на Fast H3.
🚀 Быстро   — наш проверенный: быстрая LoRA, 6 шагов (⚙: 4…10 или турбо-LoRA 12 шагов).
⚖ Баланс    — HD: маленький черновик → увеличение → короткий чистовик в полном размере.
             ⚙ «Баланс чище» — как «Чисто HD».
✨ Качество — полная модель (bf16, если лежит), 40 шагов, без LoRA скорости.
👑 Максимум — bf16 + точный энкодер (int8), 50 шагов, образцы в полном качестве.

КАРТИНКИ / PICTURES
---------------------------------------------------
ref_image_0  — первый кадр, он же <Picture 1> (img_0 автопромтера).
ref_image_1…3 — образцы <Picture 2…4>: вид героя, предмета, места. Не кадры.
last_frame   — последний кадр ролика.
⚙ «первый кадр»: 🎯 кадр + образец (настоящий кадр 0.00 с) или 🖼 только образец (как Raw Engine).

🛡 ЗАЩИТА ОТ ДВОЕНИЯ / ANTI-GHOSTING
---------------------------------------------------
LoRA на сжатой модели (int8/fp8) ComfyUI пересжимает со случайным округлением —
отсюда двоение и артефакты на турбо. Положи рядом ту же модель в bf16
(…_bf16.safetensors) — нода возьмёт её сама, когда есть LoRA. Нет — предупредит.

⚡ УСКОРЕНИЕ / SPEED (⚙)
---------------------------------------------------
Внимание: PyTorch (точно) · Sage (если уже установлен) · Kitchen INT8 (мягче деталь).
Разреженное: штатная нода ComfyUI «Model Sparse Attention».
  sol-attn — без дообучения, порог tau (выше — быстрее и дальше от точного);
  vsa — только для Fast H3.
Нода НИЧЕГО не устанавливает в систему. Любое ускорение — сравни на одном сиде.

📋 ОТЧЁТ И ⏱ ЗАМЕР / REPORT & TIMING
---------------------------------------------------
После прогона кнопка «📋 Отчёт»: какие модели взяты и почему, и время каждого этапа
(текст, загрузка, генерация с секундами на шаг, раскодировка). Ни слова из промпта —
можно смело присылать.

📥 МОДЕЛИ / MODELS
---------------------------------------------------
У каждого режима свой пакет: кнопка «📥 Модели» качает только то, что нужно выбранному
режиму. Докачка с места обрыва, что лежит — не трогает.

H3 понимает только свой текстовый энкодер (Qwen3-VL-32B) — в любом сжатии
(nvfp4 лёгкий, int8 точнее). Другие энкодеры не подойдут — это не баг.

===================================================
`;

function showHelpDialog(node) { const c = CONFIG[node?.type] || CONFIG.NeronH3One; showText(c.title, c.help()); }

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

function linked(node, name) {
    const i = (node.inputs || []).find((x) => x.name === name);
    return !!(i && i.link != null);
}

// ---------- 🎭 окна подмены: видео · на кого · свой звук (клик или перетащить файл, ✕ — убрать) ----------
const NONE_FILE = "— нет / none —";
const SWAP_SLOTS = [
    { widget: "video", kind: "video", ru: "🎬 ОПОРНОЕ ВИДЕО", en: "source video", color: "#5fd0ff", part: 0.44,
      accept: "video/*" },
    { widget: "photo", kind: "image", ru: "🖼 НА КОГО", en: "who", color: "#ffd166", part: 0.34, accept: "image/*" },
    { widget: "own_audio", kind: "audio", ru: "🔊 СВОЙ ЗВУК", en: "own sound", color: "#c39bff", part: 0.22,
      accept: "audio/*" },
];
const SW_PAD = 10, SW_GAP = 8, SW_CAP = 30, SW_INFO = 18, SW_CLOSE = 18;
const MEDIA = new Map();

function swHeight(width) { return SW_CAP + Math.round(Math.max(120, (width - 40) * 0.30)) + SW_INFO; }

function swRect(node, i, top) {
    const W = node.size[0] - SW_PAD * 2 - SW_GAP * (SWAP_SLOTS.length - 1);
    let x = SW_PAD;
    for (let k = 0; k < i; k++) x += W * SWAP_SLOTS[k].part + SW_GAP;
    const w = W * SWAP_SLOTS[i].part, h = swHeight(node.size[0]);
    return { x, y: top, w, h, img: { x: x + 4, y: top + SW_CAP, w: w - 8, h: h - SW_CAP - SW_INFO },
             close: { x: x + w - 4 - SW_CLOSE - 3, y: top + SW_CAP + 3, w: SW_CLOSE, h: SW_CLOSE } };
}

function inRect(p, r) { return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h; }

function fitT(ctx, t, maxW) {
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 2 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}

function viewURL(name) {
    const i = name.lastIndexOf("/");
    const sub = i >= 0 ? name.slice(0, i) : "", file = i >= 0 ? name.slice(i + 1) : name;
    return api.apiURL(`/view?filename=${encodeURIComponent(file)}&type=input&subfolder=${encodeURIComponent(sub)}`);
}

function media(kind, name) {
    if (!name || name === NONE_FILE) return null;
    const key = kind + ":" + name;
    let m = MEDIA.get(key);
    if (m) return m;
    const redraw = () => app.graph?.setDirtyCanvas(true, false);
    if (kind === "image") {
        m = new Image(); m.onload = redraw; m.onerror = () => { m.__failed = true; redraw(); };
        m.src = viewURL(name);
    } else if (kind === "video") {
        m = document.createElement("video");
        m.muted = true; m.preload = "auto"; m.crossOrigin = "anonymous";
        m.onloadeddata = () => { try { m.currentTime = Math.min(0.5, (m.duration || 1) / 3); } catch (_) {} redraw(); };
        m.onseeked = redraw; m.onerror = () => { m.__failed = true; redraw(); };
        m.src = viewURL(name);
    } else {
        m = document.createElement("audio");
        m.preload = "metadata"; m.onloadedmetadata = redraw; m.onerror = () => { m.__failed = true; redraw(); };
        m.src = viewURL(name);
    }
    MEDIA.set(key, m);
    return m;
}

function swTop(node) { const g = node.widgets?.find((w) => w.name === "_swap_windows"); return g ? (g.last_y ?? g.y ?? 0) : 0; }

function drawSwap(node, ctx, top) {
    const soundOwn = String(wv(node, "sound") || "").startsWith("🔊");
    for (let i = 0; i < SWAP_SLOTS.length; i++) {
        const s = SWAP_SLOTS[i], R = swRect(node, i, top), A = R.img;
        const val = wv(node, s.widget);
        const wired = linked(node, { video: "video_in", image: "photo_in", audio: "audio_in" }[s.kind]);
        const dim = s.kind === "audio" && !soundOwn;
        ctx.save();
        ctx.globalAlpha = dim ? 0.45 : 1;
        ctx.fillStyle = "rgba(10, 20, 28, 0.85)"; roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.stroke();
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = s.color; ctx.font = "bold 11px sans-serif";
        ctx.fillText(fitT(ctx, s.ru, R.w - 8), R.x + R.w / 2, R.y + 14);
        ctx.fillStyle = "rgba(200, 220, 230, 0.75)"; ctx.font = "10px sans-serif";
        ctx.fillText(fitT(ctx, s.en, R.w - 8), R.x + R.w / 2, R.y + 26);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)"; roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.fill();
        ctx.save(); roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.clip();
        let info = "";
        const center = (lines, color, font) => {
            ctx.fillStyle = color; ctx.font = font; ctx.textBaseline = "middle";
            lines.forEach((t, k) => ctx.fillText(fitT(ctx, t, A.w - 8), A.x + A.w / 2,
                                                A.y + A.h / 2 + (k - (lines.length - 1) / 2) * 16));
        };
        const m = wired ? null : media(s.kind, val);
        if (wired) {
            center(["🔌 с провода", "from wire"], "#9be7a0", "12px sans-serif"); info = "провод / wire";
        } else if (m && m.__failed) {
            center(["⚠ файла нет", "missing file"], "#ff8a80", "11px sans-serif"); info = String(val);
        } else if (m && s.kind === "image" && m.complete && m.naturalWidth) {
            const k = Math.min(A.w / m.naturalWidth, A.h / m.naturalHeight), dw = m.naturalWidth * k, dh = m.naturalHeight * k;
            ctx.drawImage(m, A.x + (A.w - dw) / 2, A.y + (A.h - dh) / 2, dw, dh);
            info = `${m.naturalWidth}×${m.naturalHeight}`;
        } else if (m && s.kind === "video" && m.readyState >= 2 && m.videoWidth) {
            const k = Math.min(A.w / m.videoWidth, A.h / m.videoHeight), dw = m.videoWidth * k, dh = m.videoHeight * k;
            try { ctx.drawImage(m, A.x + (A.w - dw) / 2, A.y + (A.h - dh) / 2, dw, dh); } catch (_) {}
            const d = m.duration || 0;
            info = `${m.videoWidth}×${m.videoHeight} · ${d.toFixed(1)} с` + (d > 15.1 ? " → 15 с" : "");
        } else if (m && s.kind === "audio") {
            center(["🔊", fitT(ctx, String(val).split("/").pop(), A.w - 8)], "#d7c4ff", "13px sans-serif");
            info = m.duration ? `${m.duration.toFixed(1)} с` : "";
        } else if (m) {
            center(["…"], "#90a4ae", "12px sans-serif");
        } else {
            center(["＋", "нажми или перетащи", "click or drop"], "rgba(180, 200, 210, 0.6)", "11px sans-serif");
            if (dim) info = "для «🔊 свой файл» / for «own file»";
        }
        ctx.restore();
        if (!wired && val && val !== NONE_FILE) {
            const C = R.close;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; roundRect(ctx, C.x, C.y, C.w, C.h, 4); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
            ctx.fillText("✕", C.x + C.w / 2, C.y + C.h / 2 + 1);
        }
        if (info) {
            ctx.fillStyle = "rgba(200, 220, 230, 0.85)"; ctx.font = "10px monospace"; ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(fitT(ctx, info, R.w - 8), R.x + R.w / 2, A.y + A.h + SW_INFO / 2);
        }
        ctx.restore();
    }
}

function swapSlotAt(node, pos) {
    const top = swTop(node);
    for (let i = 0; i < SWAP_SLOTS.length; i++) {
        const R = swRect(node, i, top);
        if (inRect(pos, R)) return { i, R };
    }
    return null;
}

function swapSet(node, slot, value) {
    const w = getWidget(node, slot.widget);
    if (!w) return;
    const vals = w.options?.values;
    if (Array.isArray(vals) && !vals.includes(value)) vals.push(value);
    w.value = value;
    try { w.callback?.(value); } catch (_) {}
    if (slot.kind === "audio" && value !== NONE_FILE) {          // загрузил свой звук — значит, он и нужен
        const snd = getWidget(node, "sound");
        const own = snd?.options?.values?.find((v) => String(v).startsWith("🔊"));
        if (snd && own) { snd.value = own; try { snd.callback?.(own); } catch (_) {} }
    }
    app.graph?.setDirtyCanvas(true, true);
}

async function swapUpload(node, slot, file) {
    if (!file) return;
    const body = new FormData();
    body.append("image", file);                 // штатная загрузка ComfyUI — так же грузятся видео и звук
    body.append("type", "input");
    try {
        const r = await api.fetchApi("/upload/image", { method: "POST", body });
        if (r.status !== 200) { console.warn("[Neron Swap] upload", r.status); return; }
        const d = await r.json();
        const value = d.subfolder ? `${d.subfolder}/${d.name}` : d.name;
        MEDIA.delete(slot.kind + ":" + value);
        swapSet(node, slot, value);
    } catch (e) { console.warn("[Neron Swap] upload failed", e); }
}

function swapPick(node, slot) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = slot.accept; inp.style.display = "none";
    inp.onchange = () => { if (inp.files?.[0]) swapUpload(node, slot, inp.files[0]); inp.remove(); };
    document.body.append(inp); inp.click();
}

let swLastClick = 0;
function swapClick(node, pos) {
    const hit = swapSlotAt(node, pos);
    if (!hit) return false;
    const now = Date.now();
    if (now - swLastClick < 400) return true;
    swLastClick = now;
    const s = SWAP_SLOTS[hit.i], val = wv(node, s.widget);
    if (val && val !== NONE_FILE && inRect(pos, hit.R.close)) { swapSet(node, s, NONE_FILE); return true; }
    swapPick(node, s);
    return true;
}

function swapDrop(node, e) {
    const files = [...(e?.dataTransfer?.files || [])];
    if (!files.length) return false;
    for (const f of files) {
        const kind = f.type?.split("/")[0];
        const slot = SWAP_SLOTS.find((s) => s.kind === kind);
        if (slot) swapUpload(node, slot, f);
    }
    return true;
}

function setupSwapWindows(node) {
    const win = node.addCustomWidget({
        name: "_swap_windows", type: "neron_swap", value: "", serialize: false, options: { serialize: false },
        draw(ctx, n, width, y) { drawSwap(n, ctx, y); },
        computeSize(width) { return [width, swHeight(width ?? node.size[0])]; },
        mouse(e, pos, n) {
            const t = e?.type || "";
            if (t === "pointerdown" || t === "mousedown") return swapClick(n, pos);
            return true;
        },
    });
    node.widgets.splice(node.widgets.indexOf(win), 1);
    const at = node.widgets.findIndex((w) => w.name === "expert");
    node.widgets.splice(at + 1, 0, win);
    try { node.setSize([Math.max(node.size[0], 560), node.size[1]]); } catch (_) {}
    // видео-превью: пока грузится — перерисовывать
    const t = setInterval(() => { if (!node.graph) clearInterval(t); else app.graph?.setDirtyCanvas(true, false); }, 1500);
    setTimeout(() => clearInterval(t), 15000);
}

const HELP_SWAP = `
🎭 NERON H3 ПОДМЕНА / SWAP  (альфа)
===================================================

Опорное видео + фото «на кого» → тот же ролик с другим
человеком. До 15 с, со звуком. Модель — MiniMax H3.

КАК / HOW
---------------------------------------------------
1. 🎬 Опорное видео — нажми окно или перетащи файл.
   Оттуда берутся движение, сцена, камера, свет, звук.
   Длиннее 15 с — возьмётся начало (⚙ «не длиннее»).
2. 🖼 На кого — фото человека. Лицо хорошо видно,
   ровный свет. Для «полностью» — в полный рост.
3. Заменить: 🙂 лицо (тело, одежда — из видео)
   или 🧍 полностью (весь облик — с фото).
4. Звук: 🎵 оригинал — звук видео байт в байт;
   🔊 свой файл — окно «свой звук»;
   ✨ сгенерировать — звук делает H3.
5. Run. Текст для модели нода пишет сама.

Можно сразу бросить на ноду и видео, и фото, и звук —
каждый файл ляжет в своё окно.

⚙ ЭКСПЕРТ
---------------------------------------------------
движение — строго (повторить видео) / свободнее;
уточнение — что дописать, лучше по-английски;
размер, длина, LoRA, ускорение, модели, сид.
Профи: входы video_in / photo_in / audio_in / prompt
(свой текст — назови <Video 1> и <Picture 1>).

РЕЖИМЫ — как в 🎬 H3 One: 🔥 Экстрим · 🚀 Быстро ·
⚖ Баланс · ✨ Качество · 👑 Максимум.

⚠ Заменяй себя и тех, кто согласен.

АЛЬФА: что «уплывает» (движение, лицо, губы) — пришли
📋 Отчёт и пару кадров: подкрутим. Если движение не
держится — следующим шагом подключим штатный
Fun ControlNet H3 (поза/глубина из опорного видео).
===================================================
`;

app.registerExtension({
    name: "Neron.H3.One",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!(nodeData.name in CONFIG)) return;
        const cfg = CONFIG[nodeData.name];
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
        const origExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onRemoved = function () {
            DL.nodes.delete(this);
            return origRemoved?.apply(this, arguments);
        };
        nodeType.prototype.onExecuted = function (message) {
            const r = origExecuted?.apply(this, arguments);
            const t = message?.text;
            this.__h3Report = Array.isArray(t) ? t.join("\n") : (t || "");
            REPORT.text = this.__h3Report;
            return r;
        };

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;
            const spacer = node.addCustomWidget({ name: "_spacer", type: "neron_blank", value: "", serialize: false,
                                                  options: { serialize: false }, draw() {},
                                                  computeSize: () => [0, CLOCK_ROOM], mouse() { return false; } });
            node.widgets.splice(node.widgets.indexOf(spacer), 1);
            node.widgets.unshift(spacer);
            if (cfg.windows) setupSwapWindows(node);
            for (const w of node.widgets || []) {
                if (!["expert", "size", "sparse", "mode"].includes(w.name)) continue;
                const cb = w.callback;
                w.callback = function () {
                    const rr = cb?.apply(this, arguments);
                    applyExpert(node, specs);
                    if (w.name === "mode") { DL.pack = packOf(node); fetchStatus(); }
                    return rr;
                };
            }
            const openModels = () => { DL.pack = packOf(node); fetchStatus().then(() => openModelsDialog(false)); };
            node.__h3ModelsBtn = node.addWidget("button", MODELS_BTN, null, openModels);
            node.addWidget("button", "📋 Отчёт и замер / Report & timing", null, () =>
                showText("📋 Отчёт / Report", node.__h3Report || REPORT.text ||
                         "Отчёта пока нет — запусти генерацию.\nEN: No report yet — run a generation."));
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog(node));
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(node, specs), t);
            setupClock(node);
            hookDownload();
            DL.nodes.add(node);
            DL.pack = packOf(node);
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        if (cfg.windows) {
            nodeType.prototype.onDragOver = function (e) { return !!e?.dataTransfer?.types?.includes?.("Files"); };
            nodeType.prototype.onDragDrop = function (e) { return swapDrop(this, e); };
            const origMouse = nodeType.prototype.onMouseDown;
            nodeType.prototype.onMouseDown = function (e, pos) {
                if (swapSlotAt(this, pos)) return swapClick(this, pos);
                return origMouse?.apply(this, arguments);
            };
        }
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(this, specs), t);
            return r;
        };
        const origConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = origConn?.apply(this, arguments);
            clearTimeout(this.__neronInputs);
            this.__neronInputs = setTimeout(() => applyExpert(this, specs), 30);
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
