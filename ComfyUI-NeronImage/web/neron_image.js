// 🖼 Neron Image — оформление в стиле Neron (как 🎭 Замена героя, H3 Story / H3 Engine):
// режим эксперта, часы генерации, окно «📥 Модели», итоговый промпт на ноде и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronImage";
const NODE_COLOR = "#23345a";
const NODE_BGCOLOR = "#141e33";
const FRAME_BOTTOM = 8;
const GROUP_GAP = 18 + FRAME_BOTTOM;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";
const EVENT_PROGRESS = "neron_image.progress";
const EVENT_DOWNLOAD = "neron_image.download";
const ROUTE = "/neron_image";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ЧТО НАРИСОВАТЬ / PROMPT", widgets: ["text", "prompter"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "КАДР / FRAME", widgets: ["aspect", "quality", "sharpness", "seed", "control_after_generate"],
      fill: "rgba(120, 170, 120, 0.15)", border: "rgba(120, 170, 120, 0.75)", label: "rgba(200, 245, 200, 1.0)" },
    { name: "РИСОВАНИЕ / SAMPLING", widgets: ["count", "steps", "cfg", "sampler", "scheduler"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "АВТОПРОМТЕР / PROMPTER", widgets: ["prompter_seed", "prompter_creativity", "prompter_instruction"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
    { name: "СТИЛЬ / STYLE", widgets: ["style_lora", "style_strength"],
      fill: "rgba(180, 120, 220, 0.15)", border: "rgba(180, 120, 220, 0.75)", label: "rgba(230, 200, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["keep_loaded", "unet_model", "clip_model", "vae_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ИТОГОВЫЙ ПРОМПТ / FINAL PROMPT", widgets: ["neron_final_prompt", "✏ Править итоговый промпт / Edit final prompt"],
      fill: "rgba(150, 150, 170, 0.12)", border: "rgba(150, 150, 170, 0.60)", label: "rgba(215, 215, 235, 1.0)" },
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
    const ws = node.widgets || [];
    for (const w of ws) clearBottomPadding(w);
    for (const g of GROUPS) {
        let last = null;
        for (const w of ws) if (g.widgets.includes(w.name) && !isHidden(w)) last = w;
        if (last) setBottomPadding(last, GROUP_GAP);
    }
    // над первой строкой каждой группы — место под подпись, даже если выше стоит виджет без группы (кнопки)
    for (const g of GROUPS) {
        const i = ws.findIndex((w) => g.widgets.includes(w.name) && !isHidden(w));
        if (i <= 0) continue;
        let j = i - 1;
        while (j >= 0 && isHidden(ws[j])) j--;
        if (j >= 0 && !("__neronBottomPadding" in ws[j]) && ws[j].name !== "_spacer") setBottomPadding(ws[j], GROUP_GAP);
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

// ---------- эксперт: главное видно всегда, остальное — по переключателю ----------
const SIZE_WIDGETS = ["aspect", "quality"];
function wiredSize(node) {
    // провода width + height главнее — тогда качество, форма и ручной размер не работают и прячутся
    const linked = (n) => (node.inputs || []).some((i) => i.name === n && i.link != null);
    return linked("width") && linked("height");
}
function applyExpert(node, specs) {
    const ex = wv(node, "expert") === true;
    const wired = wiredSize(node);
    let prevHidden = false;
    for (const w of node.widgets || []) {
        if (w.name === "control_after_generate" || w.name === "control_before_generate") {
            if (w.hidden !== prevHidden) w.hidden = prevHidden;
            continue;
        }
        const o = specs[w.name];
        if (!o) { prevHidden = false; continue; }
        let hide = !ex && !o.neron_main;
        if (wired && SIZE_WIDGETS.includes(w.name)) hide = true;
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
// Часы стоят СРАЗУ ПОД входами/выходами , а распорка CLOCK_ROOM
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
    api.addEventListener(EVENT_PROGRESS, (e) => {
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


// ---------- 📥 модели ----------
const DL = { status: null, hooked: false, dialog: null, autoShown: false, nodes: new Set() };

function gb(b) { return (b / 1024 ** 3).toFixed(1); }

async function fetchStatus() {
    try {
        const r = await api.fetchApi(ROUTE + "/status");
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
    api.addEventListener(EVENT_DOWNLOAD, (e) => {
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
                      "📥 Модели для Neron Image / Models for Neron Image"));
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
                "👋 Каких-то моделей для картинок у тебя пока нет. Не беда — нажми «Скачать пакет»: нода скачает недостающее " +
                "сама и разложит по папкам. Что уже лежит — не трогает.\n\n" +
                "EN: Some models for Neron Image are missing. Press «Download pack» — the node downloads what is missing and " +
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
                          "✅ Всё на месте! Напиши, что нарисовать, и жми Run.\nEN: All set! Write what to draw and press Run."));
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
                "Токен от Замены героя, H3 Story и LTX Engine подхватывается сам.\n\n" +
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
                    await api.fetchApi(ROUTE + "/token", { method: "POST", body: JSON.stringify({ token: v }) });
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
                await api.fetchApi(ROUTE + "/cancel", { method: "POST", body: "{}" });
            }));
        } else {
            const resume = s.files.some((f) => !f.present && f.partial_bytes);
            row.append(btn(resume ? "⏬ Докачать / Resume" : "⏬ Скачать пакет / Download pack", "#2a7fc4", async () => {
                if (needToken && !s.token_set && tokenInput && tokenInput.value.trim()) {
                    await api.fetchApi(ROUTE + "/token", { method: "POST", body: JSON.stringify({ token: tokenInput.value.trim() }) });
                }
                await api.fetchApi(ROUTE + "/download", { method: "POST", body: JSON.stringify({ pack: s.pack_id }) });
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

// ---------- многострочные поля ComfyUI: внутрь рамки (Роман 16.11: поле промпта вылезало за края рамки) ----------
const TEXT_FIELDS = ["text", "prompter_instruction"];
function tidyTextareas(node) {
    for (const name of TEXT_FIELDS) {
        const w = getWidget(node, name);
        const el = w?.inputEl || w?.element;
        const ta = el?.tagName === "TEXTAREA" ? el : el?.querySelector?.("textarea");
        if (!ta || ta.__neronTidy) continue;
        ta.__neronTidy = true;
        ta.style.boxSizing = "border-box";
        ta.style.marginLeft = "12px";
        ta.style.marginRight = "12px";
        ta.style.width = "calc(100% - 24px)";
        ta.style.borderRadius = "6px";
        ta.style.border = "1px solid #2f4870";
    }
}

// ---------- итоговый промпт на ноде ----------
const EDIT_BTN = "✏ Править итоговый промпт / Edit final prompt";
const PROMPT_BOX_H = 130;
function addPromptBox(node) {
    const ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.placeholder = "Здесь появится промпт, который ушёл в модель.\nEN: The prompt sent to the model appears here.";
    ta.style.cssText = "width:100%;height:100%;box-sizing:border-box;resize:none;background:#0d1626;color:#cfe3ff;" +
        "border:1px solid #2f4870;border-radius:6px;padding:6px 8px;font:12px/1.45 sans-serif;";
    let w = null;
    try {
        w = node.addDOMWidget("neron_final_prompt", "neron_text", ta, {
            serialize: false, hideOnZoom: false,
            getValue: () => ta.value, setValue: (v) => { ta.value = v || ""; },
            getMinHeight: () => PROMPT_BOX_H, getHeight: () => PROMPT_BOX_H,
        });
    } catch (e) { console.warn("[Neron Image] окно промпта:", e); }
    if (w) {
        w.serialize = false;
        w.computeSize = (width) => [width, PROMPT_BOX_H];
    }
    node.__neronPromptBox = ta;
    if (node.__neronFinal) ta.value = node.__neronFinal;
}
function editFinalPrompt(node) {
    const p = node.__neronPrompt;
    if (!p) { alert("Сначала сделай картинку — тогда появится итоговый промпт.\nEN: Make a picture first."); return; }
    const tw = getWidget(node, "text");
    const pw = getWidget(node, "prompter");
    if (tw) tw.value = p;
    if (pw) {
        const list = comboList(pw) || [];
        const asis = list.find((x) => String(x).startsWith("✍")) || pw.value;
        pw.value = asis;
    }
    app.graph?.setDirtyCanvas(true, true);
}

// ---------- справка ----------
const HELP_TEXT = `
🖼 NERON IMAGE — КАРТИНКА ПО ТЕКСТУ (KREA 2)
===================================================

🇷🇺 ЧТО ДЕЛАЕТ
Рисует картинку по твоему описанию на Krea 2 Turbo — официальные модели Comfy-Org.
Пиши своими словами, хоть по-русски: автопромтер переведёт и распишет.

КАК ПОЛЬЗОВАТЬСЯ
1. «Что нарисовать» — опиши картинку. Текст, который должен быть НА картинке, — в кавычках.
2. Автопромтер — «🎨 до мелочей» (по умолчанию). Форма кадра, качество (2K — максимум).
3. Run. Выход image подключи к Save Image (в готовом процессе уже подключено).
4. Внизу ноды — итоговый промпт: что на самом деле ушло в модель.

АВТОПРОМТЕР
• 🎨 до мелочей (по умолчанию) — всё, что ты написал, остаётся как есть и идёт первым;
  всё, чего не написал, промптер придумает конкретно: одежда и ткани, материалы, детали
  механизмов (шестерни, валы, заклёпки, следы износа), место, свет, объектив, стиль.
  Flux и Krea лучше всего рисуют по длинным подробным промптам.
• ✨ расписать — официальная инструкция Krea: сдержанно, без выдуманных деталей.
• 🌐 подправить — только перевод и лёгкая шлифовка, близко к твоим словам.
• ✍ как есть — текст уходит в модель без изменений (пиши по-английски).
• Это тот же Qwen3-VL 4B, что кодирует текст для Krea, — отдельно ничего качать не надо.
• Тот же текст и режим — промптер второй раз не гоняется: «вариант» меняет только картинку.
• Хочешь поправить промпт руками — кнопка «✏ Править итоговый промпт»: он встанет в поле,
  а автопромтер переключится на «как есть».

РЕЗКОСТЬ
• После рисования — мягкая нерезкая маска: края чётче, деталей не добавляет.
  1.0 — по умолчанию (проверено на 2K). Подбирай под сюжет: крупный портрет — меньше
  (0.5–0.8), чтобы кожа не «песочила»; пейзаж, ткань, техника — 1.0–1.3; 0 — как нарисовала модель.

ВАРИАНТЫ
• «вариант» — номер картинки. Другой номер — другая картинка по тому же промпту.
• Понравилась — «управление после генерации» = fixed, и меняй только слова.

⚙ ЭКСПЕРТ
• Шаги 8, CFG 1, euler / simple — рецепт авторов Krea 2 Turbo. Менять не обязательно.
• Вариант промпта, фантазия промптера, своя инструкция (по-английски; пусто — официальная).
• Стиль (LoRA) — официальные стили Krea 2 (Comfy-Org/Krea-2, папка loras): слова-ключ
  нода допишет сама. Сила 1.0.
• Держать модели — для серии картинок подряд. Выкл — память свободна для видео.
• Входы width / height — внешний размер; форма кадра и качество отключаются.

МОДЕЛИ — «📥 Модели» на ноде (официально, Comfy-Org/Krea-2):
• krea2_turbo_bf16 — полная точность, 26,3 ГБ. Нет её — нода возьмёт сжатую версию
  Turbo (fp8 / int8 / nvfp4), если лежит, и напишет об этом;
• qwen3vl_4b_fp8_scaled — текстовый энкодер и автопромтер, 4,9 ГБ;
• qwen_image_vae — 242 МБ.
Почему Turbo, а не RAW: авторы Krea — «обучай на RAW, рисуй на Turbo». Turbo доведена
по красоте и рисует до 2K; RAW — сырая база для обучения LoRA, до 1K, 52 шага.

ЛИЦЕНЗИЯ: Krea 2 — community license авторов: личное использование можно;
для коммерции — отдельная лицензия у Krea (opensource@krea.ai).

===================================================

🇬🇧 WHAT IT DOES
Draws a picture from your description with Krea 2 Turbo — official Comfy-Org models.
Write in any language: the prompter translates and expands it.

HOW TO USE
1. «What to draw» — describe the picture. Words to appear IN the picture go in quotes.
2. Prompter — «every detail» (default). Aspect, quality (2K is the maximum).
3. Run. Connect image to Save Image (already connected in the ready workflow).
4. The bottom of the node shows the final prompt — what actually went to the model.

PROMPTER
• every detail (default) — your words stay as written and come first; everything you did
  not specify is filled with concrete details: clothing and fabrics, materials, mechanism
  parts (gears, shafts, rivets, wear), setting, light, lens, style.
• expand — the official Krea instruction: restrained, no invented details.
• polish — translation and light polishing only, close to your words.
• as is — your text goes to the model unchanged (write in English).
• It is the same Qwen3-VL 4B that encodes text for Krea — nothing extra to download.
• Same text and mode — the prompter is not run again: «seed» only changes the picture.
• To edit the prompt by hand — «✏ Edit final prompt»: it goes into the text field and
  the prompter switches to «as is».

SHARPNESS — a gentle unsharp mask after drawing: 1.0 by default (tested at 2K). Tune it per
picture: close-up portraits — less (0.5–0.8); landscapes, fabric, machines — 1.0–1.3; 0 — as drawn.

⚙ EXPERT
• 8 steps, CFG 1, euler / simple — the Krea 2 Turbo authors' recipe.
• Prompt variant, prompter creativity, own instruction (English; empty — official).
• Style (LoRA) — official Krea 2 styles; trigger words are added automatically.
• Keep models loaded — for a series of pictures. Off — memory is free for video.
• width / height inputs — external size; aspect and quality are ignored.

MODELS — «📥 Models» on the node (official, Comfy-Org/Krea-2): krea2_turbo_bf16 (26.3 GB,
full precision; a compressed Turbo is used if bf16 is missing), qwen3vl_4b_fp8_scaled
(text encoder and prompter, 4.9 GB), qwen_image_vae (242 MB).
Why Turbo, not RAW: the Krea authors say «train on RAW, run on Turbo».

LICENSE: Krea 2 community license — personal use is fine; commercial use needs a separate
license from Krea (opensource@krea.ai).
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
// ---------- значения по ИМЕНАМ ----------
// ComfyUI раскладывает сохранённые значения по полям по НОМЕРАМ. При смене вкладки / выходе из трея это иногда
// сдвигалось на одно поле (в «секундах» — сид, в списках — чужие слова, нода краснела). Поэтому храним ещё и
// по именам (properties.neron_values), после загрузки раскладываем по именам и проверяем каждое поле.
const NAMED = "neron_values";
function comboList(w) {
    const v = w.options?.values;
    try { return typeof v === "function" ? v(w) : v; } catch (_) { return null; }
}
function saneWidget(w, o) {
    if (w.type === "combo") {
        const list = comboList(w);
        if (Array.isArray(list) && list.length && !list.includes(w.value))
            w.value = (o && list.includes(o.default)) ? o.default : list[0];
        return;
    }
    if (!o || !("default" in o)) return;
    const d = o.default;
    if (typeof d === "number") {
        const v = typeof w.value === "number" ? w.value : NaN;
        if (!isFinite(v) || (o.min != null && v < o.min) || (o.max != null && v > o.max)) w.value = d;
    } else if (typeof d === "boolean") {
        if (typeof w.value !== "boolean") w.value = d;
    } else if (typeof d === "string") {
        if (typeof w.value !== "string") w.value = d;
    }
}
// ---------- самолечение (13.11, Роман: «делаешь ещё прогон, а нода красная — стоят не те значения», NaN после
// сворачивания) ----------
// Раз в секунду, при возврате окна и ПЕРЕД КАЖДЫМ «Запустить» нода проверяет свои поля. Сломанное (NaN, чужое слово
// в списке, число вне диапазона) возвращается к ПОСЛЕДНЕМУ ХОРОШЕМУ значению, а не к умолчанию. В консоль браузера
// пишется, какое поле сломалось и когда — чтобы найти виновника.
function validValue(w, o, v) {
    if (w.type === "combo") {
        const list = comboList(w);
        return !(Array.isArray(list) && list.length) || list.includes(v);
    }
    if (!o || !("default" in o)) return true;
    const d = o.default;
    if (typeof d === "number")
        return typeof v === "number" && isFinite(v) && !(o.min != null && v < o.min) && !(o.max != null && v > o.max);
    if (typeof d === "boolean") return typeof v === "boolean";
    if (typeof d === "string") return typeof v === "string";
    return true;
}
const HEAL_SPECS = new Map();                       // нода → описания полей
function healNode(node, why) {
    const specs = HEAL_SPECS.get(node);
    if (!specs || !node.widgets) return;
    const good = node.__neronGood || {};
    const fixed = [];
    for (const w of node.widgets) {
        if (!w.name || !(specs[w.name] || w.name === "control_after_generate")) continue;
        const o = specs[w.name];
        if (validValue(w, o, w.value)) continue;
        const was = w.value;
        if (Object.prototype.hasOwnProperty.call(good, w.name) && validValue(w, o, good[w.name])) w.value = good[w.name];
        else saneWidget(w, o);
        fixed.push(`${w.name}: ${String(was)} → ${String(w.value)}`);
    }
    if (fixed.length) {
        console.warn(`[Neron Image] самолечение (${why}): ` + fixed.join("; "));
        try { node.setDirtyCanvas?.(true, true); app.graph?.setDirtyCanvas?.(true, true); } catch (_) {}
    }
    node.__neronGood = namedValues(node, specs);     // запомнить хорошие
}
function healAll(why) {
    for (const n of HEAL_SPECS.keys()) { try { healNode(n, why); } catch (_) {} }
}
let HEAL_HOOKED = false;
function hookHeal() {
    if (HEAL_HOOKED) return;
    HEAL_HOOKED = true;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) healAll("окно вернулось"); });
    window.addEventListener("focus", () => healAll("окно в фокусе"));
    const orig = app.graphToPrompt?.bind(app);
    if (orig) app.graphToPrompt = async function (...args) { healAll("перед запуском"); return orig(...args); };
}

function namedValues(node, specs) {
    const out = {};
    for (const w of node.widgets || [])
        if (w.name && (specs[w.name] || w.name === "control_after_generate")) out[w.name] = w.value;
    return out;
}
function restoreNamed(node, specs, named) {
    for (const w of node.widgets || []) {
        if (!w.name || !(specs[w.name] || w.name === "control_after_generate")) continue;
        if (named && Object.prototype.hasOwnProperty.call(named, w.name)) w.value = named[w.name];
        saneWidget(w, specs[w.name]);
    }
}

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
    name: "Neron.Image",
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
            clearInterval(this.__neronHeal);
            HEAL_SPECS.delete(this);
            return origRemoved?.apply(this, arguments);
        };

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;
            HEAL_SPECS.set(node, specs);
            hookHeal();
            clearInterval(node.__neronHeal);
            node.__neronHeal = setInterval(() => { try { healNode(node, "проверка"); } catch (_) {} }, 1000);
            const spacer = node.addCustomWidget({ name: "_spacer", type: "neron_blank", value: "", serialize: false,
                                                  options: { serialize: false }, draw() {},
                                                  computeSize: () => [0, CLOCK_ROOM], mouse() { return false; } });
            node.widgets.splice(node.widgets.indexOf(spacer), 1);
            node.widgets.unshift(spacer);
            for (const name of ["expert"]) {
                const ew = getWidget(node, name);
                if (!ew) continue;
                const cb = ew.callback;
                ew.callback = function () { const rr = cb?.apply(this, arguments); applyExpert(node, specs); return rr; };
            }
            node.__h3ModelsBtn = node.addWidget("button", MODELS_BTN, null, () => openModelsDialog(false));
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            addPromptBox(node);
            node.addWidget("button", EDIT_BTN, null, () => editFinalPrompt(node));
            for (const t of [50, 300, 800]) setTimeout(() => { applyExpert(node, specs); tidyTextareas(node); }, t);
            setupClock(node);
            hookDownload();
            DL.nodes.add(node);
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        const origExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const r = origExecuted?.apply(this, arguments);
            const p = message?.neron_prompt?.[0];
            const info = message?.neron_info?.[0];
            if (p != null) {
                this.__neronPrompt = String(p);
                this.__neronFinal = String(p) + (info ? "\n\n— — —\n" + String(info) : "");
                if (this.__neronPromptBox) this.__neronPromptBox.value = this.__neronFinal;
            }
            return r;
        };
        const origConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = origConn?.apply(this, arguments);
            clearTimeout(this.__neronWire);
            this.__neronWire = setTimeout(() => applyExpert(this, specs), 30);
            return r;
        };
        const origSerialize = nodeType.prototype.onSerialize;
        nodeType.prototype.onSerialize = function (o) {
            const r = origSerialize?.apply(this, arguments);
            try {
                o.properties = o.properties || {};
                o.properties[NAMED] = namedValues(this, specs);
            } catch (_) {}
            return r;
        };
        nodeType.prototype.onConfigure = function (info) {
            const r = origConfigure?.apply(this, arguments);
            const named = info?.properties?.[NAMED] || this.properties?.[NAMED];
            const fix = () => { restoreNamed(this, specs, named); applyExpert(this, specs); this.__neronGood = namedValues(this, specs); };
            fix();
            for (const t of [0, 50, 300, 800]) setTimeout(fix, t);
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
