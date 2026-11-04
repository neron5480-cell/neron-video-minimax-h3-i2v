// 🎬 Neron LTX Engine — оформление в стиле Neron, режим эксперта, часы генерации,
// окно скачивания моделей (📥) и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronLTXEngine";
const NODE_COLOR = "#1d3a48";
const NODE_BGCOLOR = "#102530";
const GROUP_GAP = 18;
const LABEL_FONT = "bold 10px sans-serif";
const MODELS_BTN = "📥 Модели / Models";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ГЛАВНОЕ / MAIN", widgets: ["mode", "seconds", "gpu"],
      fill: "rgba( 90, 170, 200, 0.15)", border: "rgba( 90, 170, 200, 0.75)", label: "rgba(180, 230, 255, 1.0)" },
    { name: "РАЗМЕР / SIZE", widgets: ["size", "manual_width", "manual_height", "megapixels", "fps", "t2v_aspect"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "КАДРЫ / FRAMES", widgets: ["first_strength", "mid_strength", "last_strength", "mid1_sec", "mid2_sec"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
    { name: "КАЧЕСТВО / QUALITY", widgets: ["input_upscale", "input_sharpen", "img_compression", "output_sharpen", "smooth"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "LORA", widgets: ["lora_1", "lora_1_strength", "lora_2", "lora_2_strength"],
      fill: "rgba(160,  90, 200, 0.15)", border: "rgba(160,  90, 200, 0.75)", label: "rgba(225, 180, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["unet_model", "clip_model", "vae_video_model", "vae_audio_model", "interp_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "СИД / SEED", widgets: ["seed", "control_after_generate"],
      fill: "rgba(150, 150, 150, 0.12)", border: "rgba(170, 170, 170, 0.6)", label: "rgba(220, 220, 220, 1.0)" },
];

function wv(node, name) {
    const w = node.widgets?.find((x) => x.name === name);
    return w ? w.value : undefined;
}

function isHidden(w) { return !w || w.hidden === true; }

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ---------- отступы и панели групп ----------
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

// ---------- эксперт ----------
function applyExpert(node, specs) {
    const ex = wv(node, "expert") === true;
    const size = String(wv(node, "size") || "");
    let prevHidden = false;
    for (const w of node.widgets || []) {
        if (w.name === "control_after_generate" || w.name === "control_before_generate") {
            if (w.hidden !== prevHidden) w.hidden = prevHidden;
            continue;
        }
        const o = specs[w.name];
        if (!o) { prevHidden = false; continue; }
        let hide = !ex && !o.ltx_main;
        // ширина/высота — только при «Ручной», площадь — только при «По площади» (даже без эксперта)
        if (w.name === "manual_width" || w.name === "manual_height") hide = !size.startsWith("Ручной");
        if (w.name === "megapixels") hide = !size.startsWith("По площади");
        // форма нужна, только когда размер считается сам (Авто / По площади); при пресете и ручном — не влияет
        if (w.name === "t2v_aspect") hide = hide || !(size.startsWith("Авто") || size.startsWith("По площади"));
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
function fmt(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (x) => String(x).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

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
        if (!CLOCK.running) clockStart(true);
        CLOCK.current = id;
    });
    api.addEventListener("execution_success", () => clockFinish("ok"));
    api.addEventListener("execution_error", () => clockFinish("error"));
    api.addEventListener("execution_interrupted", () => clockFinish("stop"));
    api.addEventListener("neron_ltx.progress", (e) => {
        const d = e.detail || {};
        if (d.stage !== CLOCK.stage) { CLOCK.stage = d.stage; CLOCK.stageT0 = Date.now(); }
        CLOCK.i = d.i || 0; CLOCK.total = d.total || 0;
    });
    api.addEventListener("progress", (e) => {
        const d = e.detail || {};
        if (!d.max || String(d.node) !== String(CLOCK.current)) return;
        if (app.graph?.getNodeById?.(d.node)?.type !== NODE) return;
        if (d.max !== CLOCK.total || d.value < CLOCK.i) CLOCK.stageT0 = Date.now() - 1;
        CLOCK.i = d.value; CLOCK.total = d.max;
    });
}

function drawClock(node, ctx) {
    const c = CLOCK;
    const mine = c.current != null && String(c.current) === String(node.id);
    const cx = node.size[0] * 0.68, maxW = node.size[0] * 0.56;
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
    ctx.fillStyle = color; ctx.font = "bold 24px monospace";
    ctx.fillText(big, cx, 112);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#b0bec5";
    if (l2) ctx.fillText(fit(l2), cx, 132);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#90a4ae";
    if (l3) ctx.fillText(fit(l3), cx, 148);
    ctx.restore();
}

// ---------- 📥 модели ----------
const DL = { status: null, hooked: false, dialog: null, autoShown: false, nodes: new Set() };

function gb(b) { return (b / 1024 ** 3).toFixed(1); }

async function fetchStatus() {
    try {
        const r = await api.fetchApi("/neron_ltx/status");
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
        const b = node.__ltxModelsBtn;
        if (b) { b.name = label; b.label = label; }
    }
    app.graph?.setDirtyCanvas(true, false);
}

function hookDownload() {
    if (DL.hooked) return;
    DL.hooked = true;
    api.addEventListener("neron_ltx.download", (e) => {
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
                      "📥 Модели для LTX 2.5 / Models for LTX 2.5"));
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
                "👋 Моделей LTX 2.5 у тебя пока нет. Не беда — нода скачает всё сама и разложит по папкам. " +
                "Нужно только один раз получить доступ на Hugging Face (ниже по шагам).\n\n" +
                "EN: You don't have the LTX 2.5 models yet. The node downloads everything and puts it in the right " +
                "folders. You only need Hugging Face access once (steps below)."));
            box.lastChild.style.whiteSpace = "pre-wrap";
        }
        box.append(el("div", "font:bold 14px sans-serif;margin-top:10px;", s.pack_title));
        const desc = el("div", "color:#b0bec5;white-space:pre-wrap;margin:4px 0 8px;", s.pack_description);
        box.append(desc);
        const list = el("div", "background:#0d171e;border-radius:6px;padding:8px 12px;margin:6px 0;font:12px monospace;");
        for (const f of s.files) {
            const part = (!f.present && f.partial_bytes) ? `  (скачано ${gb(f.partial_bytes)} ГБ — докачаю)` : "";
            list.append(el("div", f.present ? "color:#9be7a0;" : "color:#ffcc80;",
                           `${f.present ? "✅" : "❌"} ${f.name}${part}`));
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
                          "✅ Всё на месте! Подключи картинку и промпт и жми Run.\nEN: All set! Connect an image and a prompt and press Run."));
            box.lastChild.style.whiteSpace = "pre-wrap";
            box.append(btn("Закрыть / Close", "#2a5d9c", close));
            return;
        }

        // доступ к Hugging Face
        const needToken = missing.some((f) => f.gated);
        if (needToken) {
            const t = el("div", "border:1px solid #3d6273;border-radius:6px;padding:10px 12px;margin:8px 0;");
            t.append(el("div", "font:bold 13px sans-serif;margin-bottom:4px;",
                        s.token_set ? "🔑 Доступ к Hugging Face: токен сохранён ✅ / token saved"
                                    : "🔑 Доступ к Hugging Face — один раз / one time only"));
            t.append(el("div", "color:#b0bec5;white-space:pre-wrap;",
                "Авторы закрыли модели LTX 2.5 регистрацией. Это бесплатно:\n" +
                "1) Открой страницу модели, войди (можно через Google) и нажми «Agree and access».\n" +
                "2) Открой страницу токенов → «Create new token» → тип «Read» → скопируй.\n" +
                "3) Вставь токен сюда и нажми «Сохранить». Он хранится только на твоём компьютере.\n\n" +
                "EN: LTX 2.5 is gated (free): 1) open the model page, sign in, press «Agree and access»; " +
                "2) create a Read token; 3) paste it here and save. It stays on your computer."));
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
                    await api.fetchApi("/neron_ltx/token", { method: "POST", body: JSON.stringify({ token: v }) });
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
                await api.fetchApi("/neron_ltx/cancel", { method: "POST", body: "{}" });
            }));
        } else {
            const resume = s.files.some((f) => !f.present && f.partial_bytes);
            row.append(btn(resume ? "⏬ Докачать / Resume" : "⏬ Скачать пакет / Download pack", "#2a7fc4", async () => {
                if (needToken && !s.token_set && tokenInput && tokenInput.value.trim()) {
                    await api.fetchApi("/neron_ltx/token", { method: "POST", body: JSON.stringify({ token: tokenInput.value.trim() }) });
                }
                await api.fetchApi("/neron_ltx/download", { method: "POST", body: JSON.stringify({ pack: s.pack_id }) });
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
🎬 NERON LTX ENGINE
===================================================

📌 WHAT IT IS 📌
An LTX 2.5 generator in one node, built on the Neron
"LTX 2.5 Pure 2K/3K" workflow. Video and audio in one
pass. No third-party node packs inside.

📌 FIRST RUN 📌
No models? Press "📥 Models" — the node downloads the
pack itself, with progress, and puts every file in the
right folder. LTX 2.5 is gated on Hugging Face: once,
accept the license and paste a Read token (the window
explains it step by step). Interrupted? Press again —
it resumes where it stopped.

📌 INPUTS (wires) 📌
prompt        — what happens. Prose, present tense,
                with sound (see tips below).
camera_prompt — camera behaviour as one sentence. It is
                put at the START of the prompt and repeated
                at the end. Write it positively, in English:
                "Static locked-off camera on a tripod, the
                framing stays exactly the same."
first_frame   — first frame. None = text to video.
mid_frame_1/2 — middle keyframes. Auto: at 1/3 and 2/3
                of the clip (expert: your own second).
last_frame    — last frame.

📌 WANT IT GOOD? ADD FRAMES 📌
Complex motion (a spinning sword, a dance, a run) can't
be held by words alone — LTX invents what it isn't shown.
Give it middle and last frames: the model heads to your
pictures instead of guessing. The last frame is the
strongest lever.

📌 OUTPUTS 📌
video  — ready video with sound (Save Video).
audio  — sound separately (Pult, mixer…).
frames — frames as images (Neron Video Combine…).
fps    — frame rate of the frames (48 with smoothness).

📌 MAIN 📌
Mode    Quality — two passes as in the Neron workflow:
                  8 steps, then a refine pass with the
                  first frame at full strength.
        Fast    — one 8-step pass, for drafts.
Seconds 5–10 s works best. Up to 20 s is possible but
        detail (hands) slowly degrades.
GPU     Auto detects your VRAM and picks the frame size.
        Starting values: 6–8 GB 0.5 MP, 12 GB 0.9 MP,
        16 GB 1.3 MP, 24+ GB 2.0 MP — they will be tuned
        by tests. Under 32 GB RAM the size is capped
        at 0.9 MP so ComfyUI does not swap.

📌 EXPERT 📌
Size (main): Auto by GPU, presets 16:9 / 9:16 / 1:1 /
      4:3 / 3:4 / 21:9, By area (MP) or Manual
      width × height. Wired width/height inputs (e.g.
      from an image processor) override all of it.
Expert size: fps, shape for text-to-video.
Frames: strength of first / middle / last, middle
        positions in seconds.
Quality: input upscale (Swin2SR is picked up by
        itself if present) + input sharpen, image
        compression (Lightricks uses 18, Neron 0),
        output sharpen 0.1, smoothness ×2 (RIFE).
LoRA, models, seed.

📌 PROMPT TIPS (official LTX guidance) 📌
• Prose, not tags. One paragraph, present tense,
  4–8 sentences.
• With a first frame: don't re-describe the picture —
  describe motion, camera and sound.
• Always describe sound, with a source in the frame.
  No sound in the prompt = the model invents it.
• Dialogue in quotes, name the language/accent.
• One light logic per shot. Emotions through the body.
• Camera move + where it ends ("…until her face fills
  the frame").
• Negative prompt does nothing at CFG 1 (distilled),
  so the node doesn't ask for one.

📌 MEMORY 📌
Models load one stage at a time: text encoder →
unload → model → unload → decode. Decode in tiles 512;
if VRAM runs out, smaller tiles automatically.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Генератор LTX 2.5 одной нодой, собранный по процессу
Neron «LTX 2.5 Pure 2K/3K». Видео и звук за один проход.
Внутри никаких чужих паков нод.

📌 ПЕРВЫЙ ЗАПУСК 📌
Моделей нет? Жми «📥 Модели» — нода сама скачает пакет
с прогрессом и разложит каждый файл по своей папке.
LTX 2.5 закрыта регистрацией на Hugging Face: один раз
принять лицензию и вставить токен (окно объясняет по
шагам). Оборвалось? Жми снова — докачает с места обрыва.

📌 ВХОДЫ (провода) 📌
prompt        — что происходит. Прозой, в настоящем
                времени, со звуком (советы ниже).
camera_prompt — поведение камеры одной фразой. Ставится
                в НАЧАЛО промпта и повторяется в конце.
                Пиши без отрицаний, лучше по-английски:
                "Static locked-off camera on a tripod, the
                framing stays exactly the same."
first_frame   — первый кадр. Нет — «текст → видео».
mid_frame_1/2 — промежуточные кадры. Сами встают на
                треть и две трети ролика (в эксперте —
                своя секунда).
last_frame    — последний кадр.

📌 ХОЧЕШЬ ХОРОШО — СТАВЬ КАДРЫ 📌
Сложное движение (меч, танец, бег) словами не
удержать: чего модель не видит — додумывает сама.
Дай ей промежуточные и последний кадр — она пойдёт к
твоим картинкам, а не будет гадать. Последний кадр —
самый сильный рычаг. Не ставишь — сам себе бяка 🙂

📌 ВЫХОДЫ 📌
video  — готовое видео со звуком (Save Video).
audio  — звук отдельно (пульт, микшер…).
frames — кадры картинками (Neron Video Combine…).
fps    — частота кадров (48 с плавностью).

📌 ГЛАВНОЕ 📌
Режим     Качество — два прохода, как в процессе
                     Neron: 8 шагов, затем дочистка с
                     первым кадром на полной силе.
          Быстро   — один проход 8 шагов, черновики.
Секунды   Лучше всего 5–10 с. До 20 с можно, но детали
          (руки) постепенно проседают.
Видеокарта Авто — нода сама узнаёт память и подбирает
          размер кадра. Стартовые значения: 6–8 ГБ —
          0,5 Мп, 12 ГБ — 0,9 Мп, 16 ГБ — 1,3 Мп,
          24+ ГБ — 2,0 Мп; уточним тестами. Если
          оперативки меньше 32 ГБ — не больше 0,9 Мп,
          чтобы ComfyUI не ушёл в своп.

📌 ЭКСПЕРТ 📌
Размер (главное): Авто по видеокарте, пресеты 16:9 /
       9:16 / 1:1 / 4:3 / 3:4 / 21:9, По площади (Мп)
       или Ручной — ширина × высота. Провода width/height
       (например, от процессора картинки) главнее всего.
Эксперт: к/с, форма для «текст → видео».
Кадры: сила первого / промежуточных / последнего,
       секунды промежуточных.
Качество: апскейл входа (Swin2SR подхватывается сам,
       если лежит) + резкость входа, сжатие кадра
       (Lightricks — 18, Neron — 0), резкость выхода
       0,1, плавность ×2 (RIFE).
LoRA, модели, сид.

📌 СОВЕТЫ ПО ПРОМПТУ (официальные правила LTX) 📌
• Проза, а не теги. Один абзац, настоящее время,
  4–8 предложений.
• Есть первый кадр — не пересказывай картинку,
  описывай движение, камеру и звук.
• Всегда описывай звук, с источником в кадре. Нет
  звука в промпте — модель придумает его сама.
• Реплики в кавычках, укажи язык и акцент.
• Один источник света на план. Эмоции — через тело.
• Движение камеры + где оно заканчивается («…пока лицо
  не займёт весь кадр»).
• Негатив при CFG 1 (distilled) ничего не делает,
  поэтому нода его не просит.

📌 ПАМЯТЬ 📌
Модели грузятся по очереди: энкодер → выгрузка →
модель → выгрузка → раскодировка. Раскодировка
плитками 512; не хватит памяти — плитки мельче сами.

===================================================
`;

function showHelpDialog() {
    const overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;");
    const box = el("div", "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;" +
        "max-width:820px;max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);", HELP_TEXT);
    const b = btn("Close / Закрыть", "#2a5d9c", () => overlay.remove());
    b.style.display = "block"; b.style.margin = "16px auto 0";
    box.append(b);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

function resetAll(node, specs) {
    for (const w of node.widgets || []) {
        const o = specs[w.name];
        if (!o || w.name === "input_upscale" || !("default" in o)) continue;
        w.value = o.default;
        try { w.callback?.(w.value, app.canvas, node, [0, 0], null); } catch (_) {}
    }
    applyExpert(node, specs);
}

app.registerExtension({
    name: "Neron.LTX.Engine",
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

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;
            node.resizable = true;
            // распорка сверху: под входами место для часов, подпись первой панели не наезжает на входы
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.draw = function () {};
            spacer.computeSize = () => [0, 40];
            node.widgets.splice(node.widgets.indexOf(spacer), 1);
            node.widgets.unshift(spacer);
            for (const w of node.widgets || []) {
                if (w.name !== "expert" && w.name !== "size") continue;
                const cb = w.callback;
                w.callback = function () { const rr = cb?.apply(this, arguments); applyExpert(node, specs); return rr; };
            }
            node.__ltxModelsBtn = node.addWidget("button", MODELS_BTN, null, () => openModelsDialog(false));
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(node, specs), t);
            hookClock();
            hookDownload();
            DL.nodes.add(node);
            // первый запуск: моделей нет — окно само, один раз за сессию
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(this, specs), t);
            return r;
        };
        nodeType.prototype.onRemoved = function () {
            DL.nodes.delete(this);
            return origRemoved?.apply(this, arguments);
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
            if (this.flags?.collapsed) return;
            drawGroupLabels(this, ctx);
            drawClock(this, ctx);
        };
    },
});
