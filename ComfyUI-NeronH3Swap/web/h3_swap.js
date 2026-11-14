// 🎭 Neron H3 Замена героя — оформление в стиле Neron (как H3 Story / H3 Engine):
// режим эксперта, часы генерации, окно «📥 Модели» и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3HeroSwap";
const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";
const FRAME_BOTTOM = 8;
const GROUP_GAP = 18 + FRAME_BOTTOM;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";
const EVENT_PROGRESS = "neron_h3swap.progress";
const EVENT_DOWNLOAD = "neron_h3swap.download";
const ROUTE = "/neron_h3swap";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ЗАМЕНА / SWAP", widgets: ["who", "what", "seconds", "sound"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "РАЗМЕР / SIZE", widgets: ["quality"],
      fill: "rgba(120, 170, 120, 0.15)", border: "rgba(120, 170, 120, 0.75)", label: "rgba(200, 245, 200, 1.0)" },
    { name: "ТЕКСТ И СИЛА / TEXT & STRENGTH", widgets: ["hint", "swap_strength", "steps", "seed", "control_after_generate"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "МАСКА / MASK", widgets: ["expand_px", "keep_outside", "feather_px", "threshold"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
    { name: "ТОНКАЯ НАСТРОЙКА / ADVANCED", widgets: ["ref_quality", "fast_attention"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["unet_model", "clip_model", "vae_video_model", "vae_audio_model",
                                          "turbo_lora_model", "swap_lora_model", "sam_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "РАЗМЫТИЕ И КРАЯ / BLUR & EDGES", widgets: ["blur_strength", "tight_edges", "draw"],
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

// ---------- эксперт: главное видно всегда, остальное — по переключателю ----------
const SIZE_WIDGETS = ["quality"];
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
        let hide = !ex && !o.h3_main;
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
                      "📥 Модели для Замены героя / Models for Hero Swap"));
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
                "👋 Каких-то моделей для замены героя у тебя пока нет. Не беда — нажми «Скачать пакет»: нода скачает недостающее " +
                "сама и разложит по папкам. Что уже лежит — не трогает.\n\n" +
                "EN: Some models for Hero Swap are missing. Press «Download pack» — the node downloads what is missing and " +
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
                          "✅ Всё на месте! Подключи клип (Load Video) и фото (Load Image) и жми Run.\nEN: All set! Connect a clip (Load Video) and a photo (Load Image) and press Run."));
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
                "Токен от H3 Story и LTX Engine подхватывается сам.\n\n" +
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

// ---------- справка ----------
const HELP_TEXT = `
🎭 NERON H3 ЗАМЕНА ГЕРОЯ / HERO SWAP
===================================================

⚠ ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ
АВТОР НЕ НЕСЁТ ОТВЕТСТВЕННОСТИ ЗА ИСПОЛЬЗОВАНИЕ ЭТОГО ИНСТРУМЕНТА И ЗА СОЗДАННЫЙ С ЕГО ПОМОЩЬЮ
КОНТЕНТ — В ТОМ ЧИСЛЕ ФЕЙКИ, ПОДМЕНУ ЛИЧНОСТИ И ЭРОТИЧЕСКИЙ КОНТЕНТ. ЭТО ТОЛЬКО ИНСТРУМЕНТ.
ВСЯ ОТВЕТСТВЕННОСТЬ — НА ПОЛЬЗОВАТЕЛЕ. ИСПОЛЬЗУЙТЕ ТОЛЬКО С СОГЛАСИЯ ЛЮДЕЙ НА ФОТО И В ВИДЕО
И В РАМКАХ ЗАКОНА.

⚠ DISCLAIMER
THE AUTHOR IS NOT RESPONSIBLE FOR HOW THIS TOOL IS USED OR FOR CONTENT MADE WITH IT, INCLUDING
DEEPFAKES, IDENTITY SUBSTITUTION AND EROTIC CONTENT. IT IS ONLY A TOOL. ALL RESPONSIBILITY LIES
WITH THE USER. USE IT ONLY WITH THE CONSENT OF THE PEOPLE IN THE PHOTO AND VIDEO AND WITHIN THE LAW.

===================================================

🇷🇺 ЧТО ДЕЛАЕТ
Меняет человека в клипе на человека с фото. Движение, камера, свет и звук — из клипа.
• 🧍 весь облик — человек целиком с фото; одежда по форме и цвету клипа.
• 🙂 лицо и причёска — голова с фото (с волосами); тело и одежда — из клипа.
• 👤 только лицо — лицо с фото; причёска, тело и одежда — из клипа.

КАК ПОЛЬЗОВАТЬСЯ
1. Load Video — клип (любая частота кадров, нода переводит в 24 к/с).
2. Load Image — фото: лицо хорошо видно, ровный свет; для «весь облик» — в полный рост.
3. Кого менять, что менять, качество, длина. Run.
4. «Маска»: слева — кого нашла нода (оранжевым), справа — что получила модель.

ВРЕМЯ (16 ГБ, 5 с клипа): 480p — 5–7 мин; 768p — дольше, резче.
Проба на 480p → понравился сид (⚙ «управление после генерации» = fixed) → тот же сид на 768p.

УМОЛЧАНИЯ (проверены)
• рисовать = авто: весь облик → весь кадр; лицо, лицо и причёска → только человека.
• быстрое внимание = выкл — чище, время почти то же.
• сила размытия 0.5; запас маски 0 = авто (голова и лицо 1, весь облик 25).

⚙ ЭКСПЕРТ
• Сила размытия 0.4–1.0: насколько размыт оригинал в образце. 0.5 — норма, 1.0 — больше от фото,
  0.4 — смесь оригинала и фото. На крупном плане — не ниже 0.5.
• Рисовать: 🎯 только человека — вокруг пиксели клипа; 🖼 весь кадр — модель рисует кадр целиком
  (нет краёв и ореола, фон нарисован заново; для лица может взять с фото причёску и одежду).
• Быстрое внимание INT8: вкл — легче для памяти, но бывают огрехи и возврат к оригиналу.
• Запас маски: больше — модели свободнее (пышная причёска, банты); меньше — ближе к клипу.
• Точные края (вкл): после генерации вклеивается только новый человек, фон — пиксели клипа.
• Качество фото-образца: match — быстрее; max — лицо узнаётся лучше, медленнее.
• Входы width / height: кадр не больше width × height, форма клипа; «качество» отключается.

ПОДГОНКА ПОД ФОТО И КЛИП (сравнивайте на одном сиде)
• Тень, «призрак» вокруг всей фигуры → рисовать = 🖼 весь кадр.
• Лицо «подмешивается», мелкие огрехи → быстрое внимание = выкл.
• «Только лицо» берёт с фото причёску и одежду → рисовать = 🎯 только человека.
• Пышная причёска, банты, заколки срезаны («лицо и причёска») → запас маски 25–40.
• Подбородок или шея не на месте → сообщите: правится в самой ноде.

КАК УСТРОЕНО
• SAM 3.1 находит человека и ведёт маску по клипу; голова, волосы, лицо — на каждом кадре.
• Человек (голова, лицо) в образце размывается: черт оригинала модель не видит, свет и движение
  остаются. Сила — по крупности плана на каждом кадре. Силуэт и скелет модель копирует буквально.
• Фото: человек вырезан на серый фон — фон фото не попадает в кадр.
• MiniMax H3 Ref2VA: клип — <Video 1>, фото — <Picture 1>, звук клипа — образец (губы по звуку).
• LoRA Character Swap V1.5 + турбо-LoRA, 8 шагов, CFG 1.
• Звук — оригинал клипа, байт в байт.

МОДЕЛИ — «📥 Модели» на ноде: H3 Ref2VA (не fl2va от Story / Engine), энкодер и VAE (общие с H3),
турбо-LoRA, LoRA замены (Akatz Labs), SAM 3.1.

ОГРАНИЧЕНИЯ
• До 15 с клипа за прогон. Пара в кадре — два прогона («⬅ левый», потом «➡ правый»).
• Быстрые движения, профиль, руки перед лицом — возможны огрехи. 768p тяжёл для 16 ГБ.

Идея процесса и LoRA замены — Akatz Labs («H3 Character Swap», MiniMax H3 Community License).

===================================================

🇬🇧 WHAT IT DOES
Replaces the person in a clip with the person from a photo. Motion, camera, light and sound come from the clip.
• 🧍 whole look — the whole person from the photo; clothing follows the clip's shape and colors.
• 🙂 face & hair — the head from the photo (with hair); body and clothes from the clip.
• 👤 face only — the face from the photo; hair, body and clothes from the clip.

HOW TO USE
1. Load Video — the clip (any frame rate, converted to 24 fps).
2. Load Image — the photo: face clearly visible, even light; full body for «whole look».
3. Who, what, quality, length. Run.
4. «Mask»: left — who was found (orange), right — what the model got.

TIME (16 GB, 5 s clip): 480p — 5–7 min; 768p — longer, sharper.
Try at 480p → keep the seed you like (⚙ «control after generate» = fixed) → the same seed at 768p.

DEFAULTS (tested)
• draw = auto: whole look → whole frame; face, face & hair → person only.
• fast attention = off — cleaner, about the same time.
• blur strength 0.5; mask margin 0 = auto (head and face 1, whole look 25).

⚙ EXPERT
• Blur strength 0.4–1.0: how blurred the original is in the reference. 0.5 — normal, 1.0 — more from
  the photo, 0.4 — a mix of original and photo. On a close-up keep 0.5+.
• Draw: 🎯 person only — clip pixels around; 🖼 whole frame — the model paints the full frame
  (no edges or halo, background re-painted; for a face it may take the photo's hair and clothes).
• Fast attention INT8: on — lighter on memory, but glitches and drifting back to the original happen.
• Mask margin: more — more room (big hair, bows); less — closer to the clip.
• Tight edges (on): after generation only the new person is pasted in; the background is clip pixels.
• Photo quality: match — faster; max — better likeness, slower.
• width / height inputs: the frame fits inside width × height, clip shape; «quality» is ignored.

FITTING YOUR PHOTO AND CLIP (compare on one seed)
• A shadow, a «ghost» around the whole figure → draw = 🖼 whole frame.
• The face «blends», small glitches → fast attention = off.
• «Face only» takes the photo's hair and clothes → draw = 🎯 person only.
• Big hair, bows, clips are cut («face & hair») → mask margin 25–40.
• The chin or neck is off → report it: it is tuned inside the node.

HOW IT WORKS
• SAM 3.1 finds the person and tracks the mask; head, hair and face are searched on every frame.
• The person (head, face) in the reference is blurred: the model cannot see the original's features,
  light and motion stay. Strength follows the shot size per frame. Silhouettes and skeletons are copied literally.
• Photo: the person is cut out onto gray — the photo's background does not get into the frame.
• MiniMax H3 Ref2VA: clip — <Video 1>, photo — <Picture 1>, clip sound — a reference (lips follow it).
• Character Swap V1.5 LoRA + turbo LoRA, 8 steps, CFG 1.
• Sound — the clip's original, byte for byte.

MODELS — «📥 Models» on the node: H3 Ref2VA (not the fl2va of Story / Engine), encoder and VAEs
(shared with H3), turbo LoRA, swap LoRA (Akatz Labs), SAM 3.1.

LIMITS
• Up to 15 s of clip per run. A couple in frame — two runs («⬅ leftmost», then «➡ rightmost»).
• Fast moves, profile, hands in front of the face — glitches are possible. 768p is heavy for 16 GB.

Workflow idea and swap LoRA — Akatz Labs («H3 Character Swap», MiniMax H3 Community License).
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
        console.warn(`[Neron H3 Swap] самолечение (${why}): ` + fixed.join("; "));
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
    name: "Neron.H3.HeroSwap",
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
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(node, specs), t);
            setupClock(node);
            hookDownload();
            DL.nodes.add(node);
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
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
