// 🎬 Neron H3 Story — оформление в стиле Neron (как Neron H3 Engine):
// режим эксперта, часы генерации и справка на двух языках.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Story";
const NODE_COLOR = "#4a2f1e";
const NODE_BGCOLOR = "#2e1c10";
const GROUP_GAP = 18;
const LABEL_FONT = "bold 10px sans-serif";

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
    return Math.max(node.inputs?.length || 0, node.outputs?.length || 0) * h + 6;
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
    return list.concat([["width", "INT"], ["height", "INT"]]);
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

// ---------- справка ----------
const HELP_TEXT = `
🎬 NERON H3 STORY (prototype)
===================================================

📌 WHAT IT IS 📌
A long MiniMax H3 video made as a chain of blocks.
H3 is trained on up to 15 s; this node glues blocks
so the seams are hard to see. One model load for the
whole video. Output: ready VIDEO with sound.

📌 LENGTH 📌
Video seconds 5–45 and block seconds 5–15 — both are
sliders. Block seconds is the MAXIMUM: the video is cut
into equal blocks no longer than that (e.g. 30 s with
10 s blocks = 4 blocks of ~8.7 s). The node works out the number of blocks
itself (up to 12) and cuts the finished video exactly
to the video length. Each seam takes ~0.9 s.

📌 THREE STATES OF THE NODE 📌
• 'story' connected (📝 Story AutoPrompter) — only
  story → video is shown: plan, prompts, pictures and
  LoRAs come through that one wire.
• Beginner (no story) — first_frame + prompt_1, 2…
  (the next appears when you connect the previous).
  Each prompt goes to the model as is.
• ⚙ Expert (no story) — everything: 🎞 Block nodes
  (block_k: pictures, text and LoRAs of a block),
  lora_all (🎨 style for the whole video), sizes,
  seam, models and all outputs.
A wire connected straight to the engine wins over
what came through 'story'. Connected inputs are
never hidden.

📌 🎞 BLOCK PICTURES 📌
Block 1 first frame — the opening frame.
Blocks 2+ first frame — a "who / where" reference
(the start is always the previous tail).
Middle frames — navigators "the action goes here".
Last frame — pinned to the block's last frame.
They become <Picture 2>, <Picture 3>… in that block
(<Picture 1> = appearance); the report lists them.

📌 HOW THE SEAM WORKS 📌
Block 2, 3… do not start from a picture. The last
~0.9 s of the previous block (22 frames) WITH ITS
SOUND is pinned to the start of the new block (native
ComfyUI node "Add Guide for MiniMax H3"). The model
continues motion and sound instead of restarting.
On joining, that overlap is removed from the picture
and the sound is crossfaded over it.
Seam (expert): clip + sound (default) or single frame.

📌 🔒 KEEP APPEARANCE (on by default) 📌
What for: people, cars, creatures — anything — look
the same in every block.
Why: the last frame of a block can be "empty" —
they hugged, turned away, hid their faces. Without a
sample the next block may draw other people.
How: the first frame (or the 'appearance' input) goes
as <Picture 1> into EVERY block, and the prompt gets
a line "same appearance as <Picture 1>". If you write
<Picture 1> in your prompt yourself, the line is not
added. Turn it off when the subject must change by
the story (changes clothes, transforms).

📌 BLOCK SECONDS 📌
5–15 s, default 10. Shorter — less drift inside a
block, but more seams.

📌 MODE 📌
⚡ Turbo 12 steps · Quality 40 · Maximum 50 + bf16.
Time ≈ one H3 Engine run × number of blocks.
Real timings for this node are not measured yet.

📌 OUTPUTS 📌
video — with sound, straight into Save Video.
frames / audio — separately. last_frame — the end,
to continue in the next run.

📌 PROTOTYPE 📌
Test build in the dev branch. Next: the Story
AutoPrompter and the plan strip on this node.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Длинный ролик MiniMax H3 цепочкой блоков. H3 обучена
до 15 с — нода склеивает блоки так, чтобы стыков не
было видно. Модель грузится один раз на весь ролик.
На выходе — готовое ВИДЕО со звуком.

📌 ДЛИНА 📌
Длина ролика 5–45 с и длина блока 5–15 с — оба
ползунка. Длина блока — это МАКСИМУМ: ролик делится
на ровные блоки не длиннее неё (например, 30 с при
блоке 10 с = 4 блока по ~8,7 с). Сколько нужно блоков (до 12), нода считает
сама, а готовый ролик обрезает ровно под длину
ролика. Каждый стык съедает ~0,9 с.

📌 ТРИ СОСТОЯНИЯ НОДЫ 📌
• Подключён 'story' (📝 Story AutoPrompter) — видно
  только story → video: план, промпты, картинки и
  LoRA приходят по этому одному проводу.
• «Чайник» (без story) — first_frame + prompt_1, 2…
  (следующий появляется, когда подключён прошлый).
  Каждый промпт идёт в модель как есть.
• ⚙ Эксперт (без story) — всё: ноды 🎞 Блок
  (block_k: картинки, текст и LoRA блока), lora_all
  (🎨 стиль на весь ролик), размеры, стык, модели и
  все выходы.
Провод, подключённый к движку напрямую, главнее
того, что пришло по 'story'. Подключённое никогда
не прячется.

📌 КАРТИНКИ 🎞 БЛОКА 📌
Первый кадр блока 1 — начало ролика.
Первый кадр блоков 2+ — образец «кто / где»
(старт там всегда — хвост прошлого блока).
Промежуточные — навигаторы «действие идёт сюда».
Последний — прикалывается к концу блока.
В блоке они становятся <Picture 2>, <Picture 3>…
(<Picture 1> — внешность); список — в отчёте.

📌 КАК РАБОТАЕТ СТЫК 📌
Блоки 2, 3… начинаются не с картинки. Последние
~0,9 с прошлого блока (22 кадра) ВМЕСТЕ СО ЗВУКОМ
прикалываются к началу нового (родная нода ComfyUI
«Add Guide for MiniMax H3»). Модель продолжает
движение и звук, а не начинает заново. При склейке
этот перехлёст убирается из картинки, а звук на нём
плавно сводится.
Стык (эксперт): кусок + звук (по умолчанию) или
один кадр.

📌 🔒 СОХРАНИТЬ ВНЕШНИЙ ВИД (вкл. по умолчанию) 📌
Для чего: люди, машины, звери — что угодно — выглядят
одинаково во всех блоках.
Почему важно: последний кадр блока бывает «пустым» —
обнялись, отвернулись, спрятали лица. Без образца
следующий блок может нарисовать других людей.
Как: первый кадр (или вход 'appearance') идёт
образцом <Picture 1> в КАЖДЫЙ блок, а к промпту
добавляется фраза «внешность как на <Picture 1>».
Написал <Picture 1> в промпте сам — фраза не
добавляется. Сними галочку, если объект по сюжету
должен измениться (переоделся, превратился).

📌 ДЛИНА БЛОКА 📌
5–15 с, по умолчанию 10. Короче — меньше «уплывает»
внутри блока, но больше стыков.

📌 РЕЖИМ 📌
⚡ Турбо 12 шагов · Качество 40 · Максимум 50 + bf16.
Время ≈ один прогон H3 Engine × число блоков.
Реальные замеры этой ноды ещё не сделаны.

📌 ВЫХОДЫ 📌
video — со звуком, сразу в Save Video.
frames / audio — отдельно. last_frame — конец ролика,
чтобы продолжить в следующем прогоне.

📌 ПРОТОТИП 📌
Тестовая сборка в ветке dev. Дальше — Story
AutoPrompter и полоска плана на этой ноде.

📌 БЫСТРЫЙ СТАРТ 📌
1. LoadImage > first_frame
2. Три текста > prompt_1, prompt_2, prompt_3
3. РЕЖИМ = Турбо (сначала проверь стыки на черновике)
4. ДЛИНА РОЛИКА = 30, ДЛИНА БЛОКА = 10
   (LoRA и картинки блоков — ⚙ эксперт, ноды 🎞 Блок)
5. video > Save Video
6. Queue

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
            node.addWidget("button", "🔄 Reset to Defaults / Сброс", null, () => resetAll(node, specs));
            node.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            for (const t of [50, 300, 800]) setTimeout(() => { updateBlockInputs(node); applyExpert(node, specs); }, t);
            setupClock(node);
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
