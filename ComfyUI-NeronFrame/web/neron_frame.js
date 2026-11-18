// 🧩 Neron Сборка кадра — оформление в стиле Neron (как 🖼 Neron Image, 🎭 Замена героя):
// окна с картинками прямо в ноде (как в 🗂 Картотеке), режим эксперта, часы, «📥 Модели», итоговый текст на ноде,
// большой редактор, справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronFrameBuilder";
const NODE_COLOR = "#2d2a52";
const NODE_BGCOLOR = "#191730";
const FRAME_BOTTOM = 8;
const GROUP_GAP = 18 + FRAME_BOTTOM;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";
const EVENT_PROGRESS = "neron_frame.progress";
const EVENT_DOWNLOAD = "neron_frame.download";
const ROUTE = "/neron_frame";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ОБРАЗЦЫ / REFERENCES", widgets: ["_frames_grid", "extra_label"],
      fill: "rgba(150, 120, 230, 0.13)", border: "rgba(150, 120, 230, 0.75)", label: "rgba(215, 200, 255, 1.0)" },
    { name: "ЧТО ПРОИСХОДИТ / SCENE", widgets: ["scene", "📝 Большой редактор промпта / Big prompt editor"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "КАДР / FRAME", widgets: ["aspect", "quality", "sharpness", "seed", "control_after_generate"],
      fill: "rgba(120, 170, 120, 0.15)", border: "rgba(120, 170, 120, 0.75)", label: "rgba(200, 245, 200, 1.0)" },
    { name: "ТЕКСТ И ПОЗА / TEXT & POSE", widgets: ["own_prompt", "pose_blur"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
    { name: "РИСОВАНИЕ / SAMPLING", widgets: ["steps", "sampler", "scheduler"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["keep_loaded", "unet_model", "clip_model", "vae_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ОСНОВА И ПЕРЕВОД / BASE & TRANSLATION", widgets: ["base", "translate_request"],
      fill: "rgba(150, 120, 230, 0.13)", border: "rgba(150, 120, 230, 0.75)", label: "rgba(215, 200, 255, 1.0)" },
    { name: "ИТОГОВЫЙ ТЕКСТ / FINAL PROMPT", widgets: ["neron_final_prompt"],
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
function promptWired(node) { return false; }
const SLOT_WIDGETS = ["hero_image", "place_image", "extra_image", "pose_image"];
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
        if (SLOT_WIDGETS.includes(w.name)) hide = true;          // вместо списков файлов — окна с превью
        if (w.hidden !== hide) w.hidden = hide;
        prevHidden = hide;
    }
    const eb = getWidget(node, EDITOR_BTN);
    if (eb) eb.hidden = promptWired(node);
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
                      "📥 Модели для Сборки кадра / Models for Frame Builder"));
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
                "👋 Каких-то моделей для сборки кадра у тебя пока нет. Не беда — нажми «Скачать пакет»: нода скачает недостающее " +
                "сама и разложит по папкам. Что уже лежит — не трогает.\n\n" +
                "EN: Some models for Frame Builder are missing. Press «Download pack» — the node downloads what is missing and " +
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
                          "✅ Всё на месте! Положи героя и место в окна, напиши, что происходит, и жми Run.\nEN: All set! Put the hero and the place into the windows, write what happens and press Run."));
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
const TEXT_FIELDS = ["scene", "own_prompt"];
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

// ---------- большой редактор промпта (16.11, Роман: «в таком узком окне нормальный промпт не написать —
// человек должен видеть весь текст») ----------
const EDITOR_BTN = "📝 Большой редактор промпта / Big prompt editor";
function openPromptEditor(node) {
    const tw = getWidget(node, "scene");
    if (!tw) return;
    const overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;");
    const box = el("div", "background:#101a2b;color:#e0e0e0;border:1px solid #2f4870;border-radius:10px;padding:16px 18px;" +
        "width:min(1100px,94vw);height:min(820px,90vh);display:flex;flex-direction:column;gap:10px;" +
        "box-shadow:0 10px 40px rgba(0,0,0,0.85);font:13px sans-serif;");
    box.append(el("div", "font:bold 16px sans-serif;color:#bfe0ff;", "📝 Промпт целиком / The whole prompt"));
    box.append(el("div", "color:#90a4ae;", "Что происходит в кадре — пиши свободно. «Сохрани героя, поставь в место, " +
        "в позу» нода допишет сама. Ctrl+Enter — сохранить, Esc — отмена.  EN: Ctrl+Enter — save, Esc — cancel."));
    const ta = el("textarea", "flex:1;width:100%;box-sizing:border-box;resize:none;background:#0b1320;color:#e8f0ff;" +
        "border:1px solid #2f4870;border-radius:8px;padding:14px 16px;font:15px/1.65 sans-serif;outline:none;");
    ta.value = tw.value || "";
    ta.spellcheck = false;
    box.append(ta);
    const foot = el("div", "display:flex;align-items:center;gap:8px;");
    const count = el("div", "flex:1;color:#78909c;font:12px monospace;");
    const upd = () => {
        const t = ta.value.trim();
        count.textContent = `${t ? t.split(/\s+/).length : 0} слов / words · ${ta.value.length} знаков / chars`;
    };
    ta.addEventListener("input", upd); upd();
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey, true); };
    const save = () => {
        tw.value = ta.value;
        try { tw.callback?.(tw.value, app.canvas, node, [0, 0], null); } catch (_) {}
        app.graph?.setDirtyCanvas(true, true);
        close();
    };
    const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); save(); }
    };
    document.addEventListener("keydown", onKey, true);
    foot.append(count);
    foot.append(btn("Отмена / Cancel", "#455a64", close));
    foot.append(btn("✅ Сохранить / Save", "#2e7d32", save));
    box.append(foot);
    overlay.append(box);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.append(overlay);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
}
function addEditorButton(node) {
    const b = node.addWidget("button", EDITOR_BTN, null, () => openPromptEditor(node));
    // поставить кнопку сразу под полем «что нарисовать»
    const ws = node.widgets;
    ws.splice(ws.indexOf(b), 1);
    const ti = ws.findIndex((w) => w.name === "scene");
    ws.splice(ti >= 0 ? ti + 1 : ws.length, 0, b);
    // выбрали «✍ как есть» — сразу открыть большой редактор
    const pw = getWidget(node, "prompter");
    if (pw) {
        const cb = pw.callback;
        pw.callback = function (v) {
            const r = cb?.apply(this, arguments);
            if (String(pw.value).startsWith("✍") && !promptWired(node) && !node.__neronEditing) openPromptEditor(node);
            return r;
        };
    }
}


// ---------- окна с картинками прямо в ноде (как в 🗂 Картотеке H3 Story) ----------
const NONE = "— нет / none —";
const SLOTS = [
    { widget: "hero_image", input: "hero", ru: "ГЕРОЙ", en: "hero", color: "#7ee0a8" },
    { widget: "place_image", input: "place", ru: "МЕСТО", en: "place", color: "#ffb37a" },
    { widget: "extra_image", input: null, ru: "ДОП. ОБРАЗЕЦ", en: "extra", color: "#b9a7ff" },
    { widget: "pose_image", input: "pose", ru: "ПОЗА", en: "pose (blurred)", color: "#5fd0ff" },
];
const GPAD = 14, GGAP = 8, CAP_H = 30, INFO_H = 18, CLOSE = 18;
function glayout(width) {
    const n = SLOTS.length;
    const cols = width >= 560 ? n : 2;
    const rows = Math.ceil(n / cols);
    const slotW = Math.max(60, (width - GPAD * 2 - GGAP * (cols - 1)) / cols);
    const imgH = Math.round(slotW * 1.2);
    const slotH = CAP_H + imgH + INFO_H;
    return { cols, rows, slotW, imgH, slotH, height: rows * slotH + (rows - 1) * GGAP + 6 };
}
function slotRect(node, i, top) {
    const L = glayout(node.size[0]);
    const c = i % L.cols, r = Math.floor(i / L.cols);
    const x = GPAD + c * (L.slotW + GGAP), y = top + r * (L.slotH + GGAP);
    return { x, y, w: L.slotW, h: L.slotH, img: { x: x + 4, y: y + CAP_H, w: L.slotW - 8, h: L.imgH },
             close: { x: x + L.slotW - 4 - CLOSE - 3, y: y + CAP_H + 3, w: CLOSE, h: CLOSE } };
}
function inside(p, r) { return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h; }
function fitText(ctx, t, maxW) {
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 2 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
}
const PCACHE = new Map();
function preview(name) {
    if (!name || name === NONE) return null;
    let im = PCACHE.get(name);
    if (!im) {
        const i = name.lastIndexOf("/");
        const sub = i >= 0 ? name.slice(0, i) : "", file = i >= 0 ? name.slice(i + 1) : name;
        im = new Image();
        im.onload = () => app.graph?.setDirtyCanvas(true, false);
        im.onerror = () => { im.__failed = true; app.graph?.setDirtyCanvas(true, false); };
        im.src = api.apiURL(`/view?filename=${encodeURIComponent(file)}&type=input&subfolder=${encodeURIComponent(sub)}`);
        PCACHE.set(name, im);
    }
    return im;
}
function slotWired(node, s) {
    if (!s.input) return false;
    return (node.inputs || []).some((i) => i.name === s.input && i.link != null);
}
function setSlot(node, slot, value) {
    const w = getWidget(node, slot.widget);
    if (!w) return;
    const vals = w.options?.values;
    if (Array.isArray(vals) && !vals.includes(value)) vals.push(value);
    w.value = value;
    try { w.callback?.(value); } catch (_) {}
    app.graph?.setDirtyCanvas(true, true);
}
async function uploadTo(node, slot, file) {
    if (!file || !file.type?.startsWith("image/")) return;
    const body = new FormData();
    body.append("image", file);
    body.append("type", "input");
    try {
        const r = await api.fetchApi("/upload/image", { method: "POST", body });
        if (r.status !== 200) { console.warn("[Neron Frame] upload", r.status); return; }
        const d = await r.json();
        const value = d.subfolder ? `${d.subfolder}/${d.name}` : d.name;
        PCACHE.delete(value);
        setSlot(node, slot, value);
    } catch (e) { console.warn("[Neron Frame] upload failed", e); }
}
function pickFile(node, slot) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif";
    inp.style.display = "none";
    inp.onchange = () => { if (inp.files?.[0]) uploadTo(node, slot, inp.files[0]); inp.remove(); };
    document.body.append(inp);
    inp.click();
}
function gridTop(node) {
    const g = getWidget(node, "_frames_grid");
    return g ? (g.last_y ?? g.y ?? 0) : 0;
}
function drawGrid(node, ctx, top) {
    for (let i = 0; i < SLOTS.length; i++) {
        const s = SLOTS[i], R = slotRect(node, i, top);
        const val = getWidget(node, s.widget)?.value;
        const wired = slotWired(node, s);
        ctx.save();
        ctx.fillStyle = "rgba(14, 12, 30, 0.85)";
        roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.fill();
        ctx.strokeStyle = s.color; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
        roundRect(ctx, R.x, R.y, R.w, R.h, 8); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillStyle = s.color; ctx.font = "bold 11px sans-serif";
        ctx.fillText(fitText(ctx, `${i + 1} · ${s.ru}`, R.w - 8), R.x + R.w / 2, R.y + 14);
        ctx.fillStyle = "rgba(210, 210, 235, 0.75)"; ctx.font = "10px sans-serif";
        ctx.fillText(fitText(ctx, s.en, R.w - 8), R.x + R.w / 2, R.y + 26);
        const A = R.img;
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.fill();
        ctx.save();
        roundRect(ctx, A.x, A.y, A.w, A.h, 6); ctx.clip();
        let info = "";
        if (wired) {
            ctx.fillStyle = "#9be7a0"; ctx.font = "12px sans-serif"; ctx.textBaseline = "middle";
            ctx.fillText(fitText(ctx, "🔌 с провода", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 - 8);
            ctx.fillText(fitText(ctx, "from wire", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 10);
            info = "провод / wire";
        } else {
            const im = preview(val);
            if (im && im.complete && im.naturalWidth > 0) {
                const k = Math.min(A.w / im.naturalWidth, A.h / im.naturalHeight);
                const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
                if (s.widget === "pose_image") ctx.filter = "blur(2px)";      // так её и увидит модель — размытой
                ctx.drawImage(im, A.x + (A.w - dw) / 2, A.y + (A.h - dh) / 2, dw, dh);
                ctx.filter = "none";
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
                ctx.fillStyle = "rgba(190, 190, 220, 0.55)"; ctx.textBaseline = "middle";
                ctx.font = "26px sans-serif"; ctx.fillText("＋", A.x + A.w / 2, A.y + A.h / 2 - 16);
                ctx.font = "10px sans-serif";
                ctx.fillText(fitText(ctx, "нажми или перетащи", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 10);
                ctx.fillText(fitText(ctx, "click or drop", A.w - 8), A.x + A.w / 2, A.y + A.h / 2 + 24);
            }
        }
        ctx.restore();
        if (!wired && val && val !== NONE) {
            const C = R.close;
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            roundRect(ctx, C.x, C.y, C.w, C.h, 4); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px sans-serif"; ctx.textBaseline = "middle";
            ctx.fillText("✕", C.x + C.w / 2, C.y + C.h / 2 + 1);
        }
        if (info) {
            ctx.fillStyle = "rgba(210, 210, 235, 0.8)"; ctx.font = "10px monospace"; ctx.textBaseline = "middle";
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
let lastSlotClick = 0;
function clickSlot(node, pos) {
    const hit = slotAt(node, pos);
    if (!hit) return false;
    const now = Date.now();
    if (now - lastSlotClick < 400) return true;
    lastSlotClick = now;
    const s = SLOTS[hit.i];
    if (slotWired(node, s)) return true;
    const val = getWidget(node, s.widget)?.value;
    if (val && val !== NONE && inside(pos, hit.R.close)) { setSlot(node, s, NONE); return true; }
    pickFile(node, s);
    return true;
}
function addGrid(node) {
    const g = node.addCustomWidget({
        name: "_frames_grid", type: "neron_frames", value: "", serialize: false, options: { serialize: false },
        draw(ctx, n, width, y) { drawGrid(n, ctx, y); },
        computeSize(width) { return [width, glayout(width ?? node.size[0]).height]; },
        mouse(e, pos, n) {
            const t = e?.type || "";
            if (t === "pointerdown" || t === "mousedown") return clickSlot(n, pos);
            return true;
        },
    });
    const ws = node.widgets;
    ws.splice(ws.indexOf(g), 1);
    const ei = ws.findIndex((w) => w.name === "expert");
    ws.splice(ei >= 0 ? ei + 1 : 0, 0, g);
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
    } catch (e) { console.warn("[Neron Frame] окно промпта:", e); }
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
    openPromptEditor(node);
}

// ---------- справка ----------
const HELP_TEXT = `
🧩 NERON СБОРКА КАДРА — ГЕРОЙ + МЕСТО + ПОЗА (MINIMAX H3 IMAGE)
===================================================

🇷🇺 ЧТО ДЕЛАЕТ
Собирает кадр из картинок-образцов: твой герой, в нужном месте, в нужной позе — и
это точно тот же герой (лицо, одежда, снаряжение, износ). Для картотеки фильма:
героя делаешь один раз — потом ставишь его куда угодно.

КАК ПОЛЬЗОВАТЬСЯ
1. Окна (нажми или перетащи файл; ✕ — убрать). Все необязательные:
   • ГЕРОЙ — лучше «паспорт героя»: в полный рост, ровный фон, всё видно;
   • МЕСТО — улица, переулок, комната; свет и настроение берутся отсюда;
   • ДОП. ОБРАЗЕЦ — одежда, предмет, второй персонаж; ниже подпиши, что это;
   • ПОЗА — фото, набросок, кадр из фильма, 3D-манекен. Нода её РАЗМОЕТ: модель
     возьмёт только положение тела и ракурс, а не вид манекена.
2. «Что происходит» — твоя просьба: что делает герой, где именно, во что одет, свет.
   Нода сама пишет ТОЛЬКО, какая картинка что значит (сцена, человек, доп. образец,
   поза) — ничего не додумывает. Длинный текст — «📝 Большой редактор».
   Можно по-русски: нода сама переведёт просьбу на английский (по прогонам русскую
   просьбу модель почти не понимает). Переводчик — Qwen3-VL 4B от 🖼 Neron Image.
3. Форма кадра (🤖 — как у места), качество (по умолчанию 16 Мп — лучшее по словам
   авторов H3 Image; для картинок время не важно), Run.
4. Внизу — итоговый текст, что ушло в модель (там видно, кто какой <Picture N>).

ШИНА (минимум проводов)
• Вход cast — 🗂 Картотека из H3 Story: её образцы заполняют ПУСТЫЕ окна
  (1-й — герой, 2-й — доп. образец). Окна в ноде главнее.
• Выход cast — герой, место и доп. образец этой сборки: одним проводом в 🎬 H3 Story,
  чтобы в видео был тот же герой. Выход image — готовый кадр (первый кадр сцены).
• Входы hero / place / pose — картинки проводом (главнее окон).

⚙ ЭКСПЕРТ
• Размытие позы 1.0 — как в проверенном процессе; 0 — без размытия.
• Основа кадра: 🤖 место (по умолчанию) — картинка места становится основой, героя
  ВСТАВЛЯЮТ в сцену: перспектива и мебель сохраняются, герой садится на то, что есть.
  👤 герой — рисуется герой, место только образец фона (свободнее, но фон «плывёт»).
  В «что происходит» пиши, КУДА поставить: «сидит на диване в беседке слева».
• Свой текст целиком — вместо того, что пишет нода; порядок <Picture N> смотри
  в итоговом тексте внизу (с местом: место, герой, доп. образец, поза).
• Шаги 6, euler / simple — официальный шаблон Comfy-Org.
• Держать модели — для серии кадров. Выкл — память свободна для видео.

МОДЕЛИ — «📥 Модели» (официально, Comfy-Org):
• minimax_h3_image_pruned_bf16 — полная точность, 40,2 ГБ (качество важнее времени);
  нет её — нода возьмёт сжатую (int8 21 ГБ / w4a8 12,5 ГБ), если лежит, и напишет об этом;
• minimax_h3_image_vae_fp16;
• текстовый энкодер Qwen3-VL 32B — ОБЩИЙ с H3 Story / Engine / Заменой героя:
  если уже лежит (nvfp4 или int8) — не качается.

Идея «герой + место + поза» и размытие позы — из процесса FoxFurEssence
«H3 Image Edit»; код наш, только родные ноды ComfyUI.

===================================================

🇬🇧 WHAT IT DOES
Builds a frame from reference pictures: your hero, in the right place, in the right pose
— and it is exactly the same hero (face, outfit, gear, wear). Make the hero once, then
put him anywhere.

HOW TO USE
1. Windows (click or drop a file; ✕ removes it), all optional: HERO (a full-body
   «hero passport», plain background), PLACE (light and mood come from it), EXTRA
   (clothing, object, second character — label it below), POSE (photo, sketch, film
   frame, 3D mannequin — the node BLURS it, so only the body position and camera angle
   are taken).
2. «What happens» — your request: action, where, clothing, light. The node only says which
   picture is what (scene, person, extra, pose) and adds nothing else. English is best.
3. Aspect (auto — like the place), quality, Run.
4. The final prompt (with the <Picture N> order) is shown at the bottom.

BUS: input cast — H3 Story Cast fills EMPTY windows; output cast — the hero, place and
extra of this frame, one wire into 🎬 H3 Story so the video keeps the same hero.

⚙ EXPERT: frame base (auto — the place picture is the base and the hero is inserted into
it; hero — the hero is drawn, the place is only a background reference), pose blur (1.0
proven; 0 — none), own full prompt (see the <Picture N> order in the final prompt), 6 steps euler / simple (official), keep models loaded.

MODELS — «📥 Models» (official, Comfy-Org): minimax_h3_image_pruned_bf16 (40.2 GB, full precision;
compressed int8 / w4a8 are used if it is missing),
its VAE, and the Qwen3-VL 32B text encoder shared with H3 (skipped if you have it).
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
        console.warn(`[Neron Frame] самолечение (${why}): ` + fixed.join("; "));
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
    name: "Neron.FrameBuilder",
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
            addGrid(node);
            addEditorButton(node);
            addPromptBox(node);
            try { node.setSize([Math.max(node.size[0], 640), node.size[1]]); } catch (_) {}
            for (const t of [50, 300, 800]) setTimeout(() => { applyExpert(node, specs); tidyTextareas(node); }, t);
            setupClock(node);
            hookDownload();
            DL.nodes.add(node);
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        const origMouse = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (e, pos) {
            if (slotAt(this, pos)) return clickSlot(this, pos);
            return origMouse?.apply(this, arguments);
        };
        nodeType.prototype.onDragOver = function (e) { return !!e?.dataTransfer?.types?.includes?.("Files"); };
        nodeType.prototype.onDragDrop = function (e) {
            const file = [...(e?.dataTransfer?.files || [])].find((f) => f.type?.startsWith("image/"));
            if (!file) return false;
            let slot = null;
            try {
                const gm = app.canvas.graph_mouse;
                const hit = slotAt(this, [gm[0] - this.pos[0], gm[1] - this.pos[1]]);
                if (hit) slot = SLOTS[hit.i];
            } catch (_) {}
            if (!slot) slot = SLOTS.find((s) => { const v = getWidget(this, s.widget)?.value; return !v || v === NONE; }) || SLOTS[0];
            uploadTo(this, slot, file);
            return true;
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
