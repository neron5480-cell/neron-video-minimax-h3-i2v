// 🎬 Neron H3 Engine — оформление в стиле Neron (как AutoPrompter и прошлый генератор),
// режим эксперта, часы генерации и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Engine";
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
    { name: "LORA", widgets: ["lora_1", "lora_1_strength", "lora_2", "lora_2_strength"],
      fill: "rgba(160,  90, 200, 0.15)", border: "rgba(160,  90, 200, 0.75)", label: "rgba(225, 180, 255, 1.0)" },
    { name: "МОДЕЛИ / MODELS", widgets: ["unet_model", "clip_model", "vae_video_model", "vae_audio_model", "turbo_lora_model"],
      fill: "rgba(200, 120, 120, 0.15)", border: "rgba(200, 120, 120, 0.75)", label: "rgba(255, 190, 190, 1.0)" },
    { name: "ТОНКАЯ НАСТРОЙКА / ADVANCED", widgets: ["seed", "control_after_generate", "ref_quality", "fast_attention"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
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
    api.addEventListener("neron_h3.progress", (e) => {
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
🎬 NERON H3 ENGINE
===================================================

📌 WHAT IT IS 📌
A MiniMax H3 generator built for one goal: the best
picture the model can give inside its passport.
No upscales, no tricks — honest generation.
The output is ready VIDEO + AUDIO.

📌 PROMPT 📌
Comes only from outside — the 'prompt' input
(CR Prompt Text, an auto-prompter, anything).

📌 REFERENCES 📌
ref_image_0…3 — pictures the model uses as samples.
They are numbered in the order they are connected:
the first connected = <Picture 1>, the next = <Picture 2>…
The node's report shows which input became which tag.
ref_video = <Video 1> (2–15 s), ref_audio = <Audio …>.
No references at all — pure text-to-video.

📌 MODE / РЕЖИМ 📌
⚡ Turbo  — 12 steps with the turbo LoRA (×0.8).
           Fast; good for motion, layout and drafts,
           but melts fine patterns: wrought iron, lace,
           hair, foliage.
Quality  — full model, 40 steps, references in full
           resolution. ~3× slower than Turbo, clearly
           cleaner detail and audio.
Maximum  — 50 steps (fine detail grows up to ~50) and
           the uncompressed bf16 model if downloaded.
           Slowest, most precise.
Measured (5 s, 1344×768, RTX 5070 Ti 16 GB):
Turbo ~7 min, Quality ~21 min.

📌 SECONDS / СЕКУНДЫ 📌
1 to 15 s — what the model was trained on. Frames snap
to the model grid (17k+5). 'length_in' (frames) wins
over the slider but can't exceed 362 (15 s).

📌 SIZE / РАЗМЕР 📌
Presets match the model passport exactly:
768 short edge, area up to 1344×768, multiples of 32.
Manual — your own width/height; anything bigger than
the passport is shrunk to the same shape.
Wired 'width'/'height' win over the widgets — and are
also clamped: 8K in → 1344×768 out.

📌 LORA (expert) 📌
Two slots for your own LoRAs with strength.
The turbo LoRA is applied automatically in Turbo.

📌 MODELS (expert) 📌
Picks your files automatically. Default main model —
the uncompressed bf16 if it is downloaded (cleaner
faces and flat surfaces, ~1.5× slower), otherwise int8.
Download bf16 (40 GB) into models/diffusion_models:
huggingface.co/Comfy-Org/MiniMax-H3 →
diffusion_models/minimax_h3_fl2va_pruned_bf16.safetensors

📌 ADVANCED (expert) 📌
seed            — fixed or random.
reference quality — auto: max in Quality/Maximum,
                  match in Turbo.
fast attention  — INT8: faster, but can morph the end
                  of the clip and garble text. Off = max
                  quality.

📌 MEMORY 📌
Models load one stage at a time, never all at once:
text encoder → unload → main model → unload →
video VAE → unload → audio VAE → unload.
Decode runs on the whole frame; if VRAM runs out,
ComfyUI tiles it, and if even that fails the node
retries with smaller and smaller tiles — a finished
generation is never lost on the last step.

📌 CLOCK 📌
Top right: run time, current stage, sampler step and
an estimate of what is left. Green — done,
red — error, yellow — stopped.

📌 FOR WHOM 📌
For those who put quality above time. With heavy
models at full size in Maximum it will bring even an
RTX 5090 to its knees. Works with light models too,
but even Turbo is slower than the standard workflow:
that is the price of quality.

📌 QUICK START 📌
1. LoadImage > ref_image_0
2. CR Prompt Text (or an auto-prompter) > prompt
3. MODE = Turbo (draft) or Quality (final)
4. SECONDS = 5
5. SIZE = 16:9 · 1344×768
6. Video Combine: format video/h264-mp4 (not gif!)
7. Queue

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Генератор MiniMax H3, заточенный под одну цель:
лучшая картинка, на которую способна модель в
своём паспорте. Без апскейлов и трюков — честная
генерация. На выходе — готовое ВИДЕО + ЗВУК.

📌 ПРОМПТ 📌
Только извне — вход 'prompt' (CR Prompt Text,
автопромтер, что угодно).

📌 ОБРАЗЦЫ 📌
ref_image_0…3 — картинки-образцы для модели.
Нумеруются по порядку подключённых: первая
подключённая = <Picture 1>, следующая = <Picture 2>…
Отчёт ноды показывает, какой вход каким тегом стал.
ref_video = <Video 1> (2–15 с), ref_audio = <Audio …>.
Образцов нет — честный «текст → видео».

📌 РЕЖИМ / MODE 📌
⚡ Турбо   — 12 шагов с турбо-LoRA (×0.8).
            Быстро; хорошо для движения, композиции
            и черновиков, но «плавит» мелкие узоры:
            кованые решётки, кружево, волосы, листву.
Качество  — полная модель, 40 шагов, образцы в полном
            разрешении. Примерно в 3 раза дольше Турбо,
            заметно чище деталь и звук.
Максимум  — 50 шагов (до стольких растёт мелкая
            деталь) и модель без сжатия весов (bf16),
            если скачана. Самое долгое, самое точное.
Замер (5 с, 1344×768, RTX 5070 Ti 16 ГБ):
Турбо ~7 мин, Качество ~21 мин.

📌 СЕКУНДЫ / SECONDS 📌
От 1 до 15 с — на этом обучена модель. Кадры
подгоняются к её сетке (17k+5). Вход 'length_in'
(в кадрах) главнее ползунка, но больше 362 (15 с)
не бывает.

📌 РАЗМЕР / SIZE 📌
Пресеты — ровно паспорт модели: короткая сторона
768, площадь до 1344×768, стороны кратны 32.
Ручной — свои ширина и высота; всё, что больше
паспорта, ужимается до той же формы.
Провода 'width'/'height' главнее виджетов — и тоже
ограничены: на входе 8K → на выходе 1344×768.

📌 LORA (эксперт) 📌
Два слота для своих LoRA с силой.
Турбо-LoRA в режиме Турбо включается сама.

📌 МОДЕЛИ / MODELS (эксперт) 📌
Файлы находятся сами. Основная модель по умолчанию —
bf16 без сжатия весов, если скачана (чище лица и
однотонные поверхности, примерно в 1,5 раза дольше),
иначе int8.
Скачать bf16 (40 ГБ) в models/diffusion_models:
huggingface.co/Comfy-Org/MiniMax-H3 →
diffusion_models/minimax_h3_fl2va_pruned_bf16.safetensors

📌 ТОНКАЯ НАСТРОЙКА (эксперт) 📌
seed             — фиксированный или случайный.
качество образцов — auto: max в Качестве и Максимуме,
                   match в Турбо.
быстрое внимание — INT8: быстрее, но может давать
                   морфинг в конце ролика и кривой
                   текст. Выключено — максимум качества.

📌 ПАМЯТЬ 📌
Модели грузятся по очереди, а не все сразу:
текстовый энкодер → выгрузка → основная модель →
выгрузка → VAE видео → выгрузка → VAE звука →
выгрузка. Раскодировка — целым кадром; не хватит
видеопамяти — ComfyUI перейдёт на плитки, а если и
это не влезет — нода повторит плитками всё мельче.
Готовая генерация на последнем шаге не теряется.

📌 ЧАСЫ 📌
Справа вверху: время прогона, текущий этап, шаг
генерации и «≈ осталось». Зелёные — готово,
красные — ошибка, жёлтые — остановлено.

📌 ДЛЯ КОГО 📌
Для тех, кому качество важнее времени. С тяжёлыми
моделями на полном размере в Максимуме поставит на
колени даже RTX 5090. С лёгкими тоже работает, но
даже Турбо дольше стандартной схемы — это плата за
качество.

📌 БЫСТРЫЙ СТАРТ 📌
1. LoadImage > ref_image_0
2. CR Prompt Text (или автопромтер) > prompt
3. РЕЖИМ = Турбо (черновик) или Качество (чистовая)
4. СЕКУНДЫ = 5
5. РАЗМЕР = 16:9 · 1344×768
6. Video Combine: format video/h264-mp4 (не gif!)
7. Queue

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
    name: "Neron.H3.Engine",
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
                if (w.name !== "expert" && w.name !== "size") continue;
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
