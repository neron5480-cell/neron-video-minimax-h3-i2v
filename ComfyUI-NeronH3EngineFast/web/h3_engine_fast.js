// ⚡ Neron H3 Engine Fast — оформление как у H3 Engine: режим эксперта, часы генерации, справка RU/EN.
// Ползунки баланса видны в режиме «Свой» (и в эксперте).
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

const NODE = "NeronH3EngineFast";
const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";
const GROUP_GAP = 18;
const LABEL_FONT = "bold 10px sans-serif";

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "РЕЖИМ / MODE", widgets: ["mode", "seconds"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "РАЗМЕР / SIZE", widgets: ["size", "manual_width", "manual_height"],
      fill: "rgba(200, 160,  90, 0.15)", border: "rgba(200, 160,  90, 0.75)", label: "rgba(255, 225, 170, 1.0)" },
    { name: "БАЛАНС (режим «Свой») / BALANCE (Custom)", widgets: ["draft_area", "draft_steps", "refine_steps", "refine_strength"],
      fill: "rgba(230, 120,  60, 0.15)", border: "rgba(230, 120,  60, 0.80)", label: "rgba(255, 200, 160, 1.0)" },
    { name: "LORA", widgets: ["lora_1", "lora_1_strength", "lora_2", "lora_2_strength"],
      fill: "rgba(160,  90, 200, 0.15)", border: "rgba(160,  90, 200, 0.75)", label: "rgba(225, 180, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["draft_model", "unet_model", "refine_lora_model", "upscaler_model",
                                       "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ТОНКАЯ НАСТРОЙКА / ADVANCED", widgets: ["seed", "control_after_generate", "keep_draft_audio", "draft_fast_attention"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
];

const BALANCE = ["draft_area", "draft_steps", "refine_steps", "refine_strength"];

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
    const custom = String(wv(node, "mode") || "").startsWith("Свой");
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
        if (BALANCE.includes(w.name)) hide = !(custom || ex);                          // баланс — в «Свой» и эксперте
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
    api.addEventListener("neron_h3fast.progress", (e) => {
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
        // место справа под выходами: входов 12, выходов 4 — там пусто
        const cx = this.size[0] * 0.66, maxW = this.size[0] * 0.6;
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
        ctx.fillText(big, cx, 128);
        ctx.font = "13px sans-serif"; ctx.fillStyle = "#b0bec5";
        if (l2) ctx.fillText(fit(l2), cx, 152);
        ctx.font = "12px sans-serif"; ctx.fillStyle = "#90a4ae";
        if (l3) ctx.fillText(fit(l3), cx, 171);
        ctx.restore();
        return r;
    };
}

// ---------- справка ----------
const HELP_TEXT = `
⚡ NERON H3 ENGINE FAST
===================================================

📌 WHAT IT IS 📌
A test node for one goal: faster MiniMax H3 without
the "soap". Three stages inside one node:
1. DRAFT  — a small frame (half the area), the fast
            8-step model. Story, motion and sound
            are born here.
2. UPSCALE — the draft is enlarged to the passport
            size (1344×768 max) in latent space.
3. REFINE — full size, base model + a fast LoRA,
            a few steps that redraw the detail.
The output is ready VIDEO + AUDIO.
When we find the best balance, it becomes an option
of H3 Engine.

📌 INPUTS 📌
prompt      — from CR Prompt Text, AutoPrompter…
first_frame — first frame (LoadImage, Image
              Processor, AutoPrompter img_0).
last_frame  — last frame (optional).
No frames — pure text-to-video.
width/height/length_in — optional, they win over
the widgets and are clamped to the passport.

📌 MODE / РЕЖИМ 📌
How much time the refine gets:
⚡ Fast    — refine 3 steps, light redraw.
Balance   — refine 4 steps, stronger redraw.
Clean     — bigger draft, refine 6 steps.
Custom    — your own values (BALANCE sliders).
These are starting points for our tests,
not measurements.

📌 SECONDS / SIZE 📌
Up to 15 s, frames on the model grid (17k+5).
From image — the shape of the first frame at the
passport size (768 short edge, area ≤ 1344×768).
No frame — 16:9. Never bigger than the passport.

📌 BALANCE (Custom / expert) 📌
draft area      — share of the final area for the
                  draft. Smaller = faster, more work
                  for the refine.
draft steps     — fast models are trained on 8.
refine steps    — full-size steps, the expensive ones.
refine strength — how much the refine redraws.
                  Low: draft blur and hits remain.
                  High: it may change the motion.

📌 MODELS (expert) 📌
draft model  — Fast H3 (fastvideo_fasth3_8step…) if
               present, else base model + turbo LoRA.
refine model — base H3 (minimax_h3_fl2va…).
refine LoRA  — Taomate 3-step if present, else our
               turbo LoRA (×0.8).
upscaler     — an H3 latent upscale model from
               models/latent_upscale_models. None or
               not compatible — a plain stretch (the
               report says so; give more strength).
video VAE    — fp16 is better than int8.

📌 ADVANCED (expert) 📌
draft audio  — on: sound comes from the draft, the
               refine draws only the picture.
fast draft attention — INT8 attention in the draft
               only. Faster, may morph the end of the
               clip. The refine is always full
               precision.

📌 REPORT 📌
After a run the node writes what it did: sizes,
steps, which upscaler, time of every stage.
Send me this report together with the video —
that is how we find the balance.

📌 QUICK START 📌
1. Image > first_frame
2. CR Prompt Text / AutoPrompter > prompt
3. MODE = Balance, SECONDS = 10, SIZE = From image
4. video + audio > Video Combine (h264-mp4)
5. Queue

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Опытная нода с одной целью: быстрый MiniMax H3
без «мыла». Внутри одной ноды три этапа:
1. ЧЕРНОВИК — маленький кадр (половина площади),
              быстрая 8-шаговая модель. Здесь
              рождаются сюжет, движение и звук.
2. УВЕЛИЧЕНИЕ — черновик растягивается до
              размера паспорта (до 1344×768).
3. ЧИСТОВИК — полный размер, базовая модель +
              быстрая LoRA, несколько шагов, которые
              перерисовывают деталь.
На выходе — готовое ВИДЕО + ЗВУК.
Когда найдём лучший баланс — войдёт опцией
в H3 Engine.

📌 ВХОДЫ 📌
prompt      — из CR Prompt Text, AutoPrompter…
first_frame — первый кадр (LoadImage, Image
              Processor, AutoPrompter img_0).
last_frame  — последний кадр (необязательно).
Без кадров — «текст → видео».
width/height/length_in — необязательные, главнее
виджетов и тоже ограничены паспортом.

📌 РЕЖИМ / MODE 📌
Сколько времени отдать чистовику:
⚡ Быстро — чистовик 3 шага, лёгкая перерисовка.
Баланс   — 4 шага, перерисовка посильнее.
Чисто    — черновик крупнее, чистовик 6 шагов.
Свой     — свои значения (ползунки БАЛАНС).
Это стартовые точки для наших тестов,
а не замеры.

📌 СЕКУНДЫ / РАЗМЕР 📌
До 15 с, кадры по сетке модели (17k+5).
По кадру — форма первого кадра в размере
паспорта (короткая сторона 768, площадь до
1344×768). Без кадра — 16:9. Больше паспорта
не бывает.

📌 БАЛАНС («Свой» / эксперт) 📌
площадь черновика — доля площади финала.
                  Меньше — быстрее, но чистовику
                  больше работы.
шаги черновика    — быстрые модели обучены на 8.
шаги чистовика    — шаги в полном размере, самые
                  дорогие.
сила чистовика    — насколько он перерисовывает.
                  Мало — остаются мыло и «удары»
                  черновика. Много — может поменять
                  движение.

📌 МОДЕЛИ (эксперт) 📌
черновик   — Fast H3 (fastvideo_fasth3_8step…),
             если есть, иначе базовая + турбо-LoRA.
чистовик   — базовая H3 (minimax_h3_fl2va…).
LoRA чистовика — Taomate 3-step, если есть, иначе
             наша турбо-LoRA (×0.8).
апскейлер  — модель увеличения латента H3 из
             models/latent_upscale_models. Нет или
             не подошла — простое растяжение (отчёт
             скажет; тогда силу чистовика побольше).
VAE видео  — лучше fp16, а не int8.

📌 ТОНКАЯ НАСТРОЙКА (эксперт) 📌
звук из черновика — вкл: звук из черновика,
             чистовик рисует только картинку.
быстрое внимание в черновике — INT8 только в
             черновике. Быстрее, но может давать
             морфинг к концу ролика. Чистовик всегда
             на полноточном.

📌 ОТЧЁТ 📌
После прогона нода пишет, что сделала: размеры,
шаги, какой апскейлер, время каждого этапа.
Присылай мне этот отчёт вместе с видео — так
мы и найдём баланс.

📌 БЫСТРЫЙ СТАРТ 📌
1. Картинка > first_frame
2. CR Prompt Text / AutoPrompter > prompt
3. РЕЖИМ = Баланс, СЕКУНДЫ = 10, РАЗМЕР = По кадру
4. video + audio > Video Combine (h264-mp4)
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
    name: "Neron.H3.EngineFast",
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
        const origExecuted = nodeType.prototype.onExecuted;

        // отчёт прогона — поле внизу ноды (появляется после первого прогона), его можно скопировать
        nodeType.prototype.onExecuted = function (message) {
            const r = origExecuted?.apply(this, arguments);
            const text = (message?.text || []).join("\n");
            if (!text) return r;
            let w = getWidget(this, "report");
            if (!w) {
                w = ComfyWidgets["STRING"](this, "report", ["STRING", { multiline: true }], app).widget;
                w.serialize = false;
                if (w.inputEl) { w.inputEl.readOnly = true; w.inputEl.style.opacity = 0.85; w.inputEl.style.fontSize = "11px"; }
            }
            w.value = "📋 Отчёт / Report\n" + text;
            try {
                const sz = this.computeSize();
                this.setSize([Math.max(this.size[0], sz[0]), Math.max(this.size[1], sz[1])]);
            } catch (_) {}
            app.graph?.setDirtyCanvas(true, true);
            return r;
        };

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR;
            node.bgcolor = NODE_BGCOLOR;
            // невидимая распорка сверху — подпись первой панели не наезжает на входы
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.draw = function () {};
            spacer.computeSize = () => [0, 20];
            node.widgets.splice(node.widgets.indexOf(spacer), 1);
            node.widgets.unshift(spacer);
            for (const w of node.widgets || []) {
                if (w.name !== "expert" && w.name !== "size" && w.name !== "mode") continue;
                const cb = w.callback;
                w.callback = function () { const rr = cb?.apply(this, arguments); applyExpert(node, specs); return rr; };
            }
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(node, specs), t);
            setupClock(node);
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(this, specs), t);
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
