// 📝 Neron H3 Story AutoPrompter — оформление Neron, режим эксперта, план ролика на ноде, окно предпросмотра,
// кнопки «✏ В правку» / «🗑 Очистить правку» и справка на двух языках.
import { app } from "../../scripts/app.js";

const NODE = "NeronH3StoryAutoPrompter";
const NODE_COLOR = "#2a3a1e";
const NODE_BGCOLOR = "#172210";
const GROUP_GAP = 18;

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ГЛАВНОЕ / MAIN", widgets: ["total_seconds", "block_seconds"],
      fill: "rgba(200, 150,  90, 0.15)", border: "rgba(200, 150,  90, 0.75)", label: "rgba(255, 220, 170, 1.0)" },
    { name: "LLM", widgets: ["model", "mmproj", "auto_download", "system_prompt", "max_tokens", "temperature",
                             "n_ctx", "n_gpu_layers", "unload_after"],
      fill: "rgba(120, 200, 160, 0.15)", border: "rgba(120, 200, 160, 0.75)", label: "rgba(190, 255, 220, 1.0)" },
    { name: "ПРЕДПРОСМОТР / PREVIEW", widgets: ["_ltx_preview"],
      fill: "rgba( 90, 140, 200, 0.15)", border: "rgba( 90, 140, 200, 0.75)", label: "rgba(180, 215, 255, 1.0)" },
    { name: "✏ ПРАВКА / EDIT", widgets: ["edited_prompt"],
      fill: "rgba(200, 120, 160, 0.15)", border: "rgba(200, 120, 160, 0.75)", label: "rgba(255, 190, 220, 1.0)" },
];

function wv(node, name) { return node.widgets?.find((w) => w.name === name)?.value; }
function isHidden(w) { return !w || w.hidden === true; }

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.rect(x, y, w, h);
}

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
    // растягивающиеся окна: реальная высота, которую им выдал ComfyUI при раскладке
    if (!w.computeSize && w.computedHeight > 0) return w.computedHeight - 4;
    try {
        if (w.computeSize) {
            const s = w.computeSize(nodeWidth);
            if (s && s[1] > 0) return s[1];
        }
    } catch (_) {}
    return 24;
}

function groupRect(node, g) {
    let y0 = Infinity, y1 = -Infinity;
    for (const w of node.widgets || []) {
        if (!g.widgets.includes(w.name) || isHidden(w) || w.last_y === undefined) continue;
        const h = widgetHeight(w, node.size[0]) - (w.__neronBottomPadding || 0);
        y0 = Math.min(y0, w.last_y); y1 = Math.max(y1, w.last_y + h);
    }
    if (!isFinite(y0) || y1 <= y0) return null;
    // Текстовые поля ComfyUI рисует почти до края ноды — рамку делаем шире, чтобы поле было ВНУТРИ неё
    const flex = g.widgets.some((n) => { const w = node.widgets?.find((x) => x.name === n); return isFlexible(w); });
    const padX = flex ? 4 : 10;
    return { x: padX, y: y0 - 16, w: node.size[0] - padX * 2, h: (y1 - y0) + 16 };
}

// Окна, которые растягиваются вместе с нодой (предпросмотр, правка), нельзя трогать отступом:
// ComfyUI растягивает только виджеты БЕЗ computeSize. Им отступ дают отдельные распорки.
function isFlexible(w) {
    return !!w && (typeof w.computeLayoutSize === "function" || !!w.element) && !w.__neronOrigSize;
}

function applyGroupGaps(node) {
    for (const w of node.widgets || []) clearBottomPadding(w);
    for (const g of GROUPS) {
        let last = null;
        for (const w of node.widgets || []) if (g.widgets.includes(w.name) && !isHidden(w)) last = w;
        if (last && !isFlexible(last)) setBottomPadding(last, GROUP_GAP);
    }
}

function addGap(node, name, beforeName) {
    const gap = node.addWidget("text", name, "", () => {});
    gap.serialize = false;
    gap.draw = function () {};
    gap.computeSize = () => [0, GROUP_GAP + 6];
    node.widgets.splice(node.widgets.indexOf(gap), 1);
    const i = node.widgets.findIndex((w) => w.name === beforeName);
    node.widgets.splice(i >= 0 ? i : node.widgets.length, 0, gap);
    return gap;
}

function applyExpert(node, specs) {
    const ex = wv(node, "expert") === true;
    for (const w of node.widgets || []) {
        const o = specs[w.name];
        if (!o) continue;
        const hide = !ex && !o.story_main;
        if (w.hidden !== hide) w.hidden = hide;
    }
    applyGroupGaps(node);
    try {
        const sz = node.computeSize();
        node.setSize([Math.max(node.size[0], sz[0]), Math.max(node.size[1], sz[1])]);
        node.setDirtyCanvas?.(true, true);
    } catch (_) {}
    app.graph?.setDirtyCanvas(true, true);
}


// ---------- живой план: сколько блоков и какой длины (то же, что посчитает движок) ----------
function grid(n) { n = Math.max(22, Math.floor(n)); while (n % 17 !== 5) n++; return Math.min(n, 362); }
function planText(node) {
    const total = Math.min(45, Math.max(5, Number(wv(node, "total_seconds") ?? 30)));
    const block = Math.min(15, Math.max(5, Number(wv(node, "block_seconds") ?? 10)));
    const T = Math.round(total * 24), nMax = grid(Math.round(block * 24)), S = 22;
    if (T <= nMax) return `${total} с = 1 блок / 1 block`;
    const b = Math.ceil((T - S) / (nMax - S));
    const n = Math.min(grid(Math.max(124, Math.ceil((T + (b - 1) * S) / b))), nMax);
    return `${total} с = ${b} блок(а) по ${(n / 24).toFixed(1)} с / ${b} blocks`;
}

// ---------- входы блоков появляются по мере подключения ----------
const MAX_BLOCKS = 12;
function canon() {
    const list = [["scenario", "STRING"], ["first_frame", "IMAGE"], ["lora_all", "NERON_H3_LORAS"]];
    for (let k = 1; k <= MAX_BLOCKS; k++) list.push([`block_${k}`, "NERON_H3_BLOCK"]);
    return list;
}
function linkedIn(node, name) { const i = node.inputs?.find((x) => x.name === name); return !!(i && i.link != null); }
function sortInputs(node) {
    const rank = new Map(canon().map(([n], i) => [n, i]));
    const before = node.inputs.slice();
    const sorted = before.slice().sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999));
    if (sorted.every((x, i) => x === before[i])) return;
    node.inputs.length = 0; node.inputs.push(...sorted);
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
        let n = 1;
        for (let k = 1; k <= MAX_BLOCKS; k++) if (linkedIn(node, `block_${k}`)) n = Math.min(MAX_BLOCKS, k + 1);
        const want = new Set(["scenario", "first_frame", "lora_all"]);
        for (let k = 1; k <= n; k++) want.add(`block_${k}`);
        for (const inp of node.inputs) if (inp.link != null) want.add(inp.name);
        for (let i = node.inputs.length - 1; i >= 0; i--) {
            const inp = node.inputs[i];
            if (canon().some(([nm]) => nm === inp.name) && !want.has(inp.name) && inp.link == null) node.removeInput(i);
        }
        const names = node.inputs.map((x) => x.name);
        for (const [name, type] of canon()) if (want.has(name) && !names.includes(name)) node.addInput(name, type);
        sortInputs(node);
    } catch (e) { console.warn("[Neron Story AutoPrompter] входы:", e); }
    finally { node.__neronUpdating = false; }
    try { node.setSize([node.size[0], Math.max(node.size[1], node.computeSize()[1])]); } catch (_) {}
    app.graph?.setDirtyCanvas(true, true);
}

// ---------- окно предпросмотра ----------
function makePreview(node) {
    const box = document.createElement("textarea");
    box.readOnly = true;
    box.placeholder = "Здесь появятся промпты всех блоков.\nEN: The prompts of all blocks appear here.";
    box.style.cssText = "width:100%;height:100%;box-sizing:border-box;resize:none;background:#0e1418;color:#d8e6ee;" +
        "margin:0;border:1px solid #2f4a5a;border-radius:6px;padding:6px 8px;font:11px/1.45 monospace;";
    const w = node.addDOMWidget("_ltx_preview", "ltx_preview", box,
                                { serialize: false, hideOnZoom: false, getMinHeight: () => 120 });
    w.serialize = false;
    node.__ltxPreview = box;
    node.__ltxNote = "";
    return w;
}

function setPreview(node, text, note) {
    if (node.__ltxPreview) node.__ltxPreview.value = text || "";
    node.__ltxNote = note || "";
    node.__ltxLast = text || "";
    app.graph?.setDirtyCanvas(true, false);
}

const HELP_TEXT = `
📝 NERON H3 STORY AUTOPROMPTER
===================================================

📌 WHAT IT IS 📌
The AutoPrompter made only for 🎬 Neron H3 Story.
It writes the whole video as a chain of blocks:
first the PLAN (what happens in every block and the
exact state at every seam — where the next block
starts), then a detailed prompt for EACH block:
continuity with the previous block, actions by
seconds with physics, a detailed ending, sound.

📌 WIRING 📌
scenario    ← a text node: the whole video in your
              words, any language. Works on its own,
              without any blocks.
first_frame ← Load Image: the opening frame and the
              appearance reference <Picture 1>.
block_1, 2… ← 🎞 Block nodes (optional): pictures, a
              short note and LoRAs of that block. The
              next input appears when you connect one.
lora_all    ← 🎨 LoRA set: style for the whole video.
story  → the engine's 'story' input. That's all: the
         engine then shows only story → video.
prompts → (optional) all block prompts as text.

📌 LENGTH 📌
Video 5–45 s and block 5–15 s (maximum) are set HERE.
The plan is shown live on the node, e.g.
"30 s = 4 blocks of 8.7 s", and goes to the engine.

📌 PICTURES 📌
The LLM sees the opening frame and each block's
pictures and refers to them as <Picture N> in the
same numbering the engine builds: <Picture 1> =
appearance, then the block's "who/where" reference
(blocks 2+), then its navigators. The end frame of a
block is pinned by the engine itself.

📌 PREVIEW AND EDIT 📌
The preview shows all prompts, split by
"### БЛОК k ###" lines, with the plan line.
"✏ To edit" copies it into "your edit". While it has
text, it goes to the engine as is (LLM skipped) —
fix a block and run again. Keep the ### lines.

📌 FIRST RUN 📌
Everything is on auto: Qwen 3.5 9B + vision are found
or downloaded (~6.6 GB, Apache 2.0, no login).
The LLM is unloaded after the prompts by default —
H3 needs the whole video card.

📌 TIME 📌
1 + (number of blocks) LLM passes. With pictures it
takes longer — see the time in the preview title.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Автопромтер, сделанный только под 🎬 Neron H3 Story.
Пишет весь ролик цепочкой блоков: сначала ПЛАН (что
происходит в каждом блоке и точное состояние на
каждом стыке — откуда начнётся следующий), потом
подробный промпт КАЖДОГО блока: продолжение прошлого
блока, действия по секундам с физикой, подробная
концовка, звук.

📌 ПОДКЛЮЧЕНИЕ 📌
scenario    ← текстовая нода: весь ролик своими
              словами, любой язык. Работает и сам,
              без блоков.
first_frame ← Load Image: начало ролика и образец
              внешности <Picture 1>.
block_1, 2… ← ноды 🎞 Блок (по желанию): картинки,
              короткая заметка и LoRA блока. Подключил
              — появился вход для следующего.
lora_all    ← 🎨 Набор LoRA: стиль на весь ролик.
story  → вход 'story' движка. И всё: на движке тогда
         видно только story → video.
prompts → (по желанию) все промпты текстом.

📌 ДЛИНА 📌
Ролик 5–45 с и блок 5–15 с (максимум) задаются ЗДЕСЬ.
План виден на ноде сразу, например «30 с = 4 блока по
8,7 с», и уходит в движок.

📌 КАРТИНКИ 📌
LLM видит первый кадр и картинки каждого блока и
ссылается на них как <Picture N> — в той же нумерации,
что соберёт движок: <Picture 1> — внешность, дальше
образец «кто/где» блока (блоки 2+), дальше его
навигаторы. Кадр конца блока движок прикалывает сам.

📌 ПРЕДПРОСМОТР И ПРАВКА 📌
В окне — все промпты, разделённые строками
«### БЛОК k ###», и строка плана.
«✏ В правку» копирует их в «свою правку». Пока там
есть текст, он идёт в движок как есть (LLM не
запускается) — поправил блок и запустил снова.
Строки ### не удаляй.

📌 ПЕРВЫЙ ЗАПУСК 📌
Всё на «авто»: Qwen 3.5 9B + зрение находятся или
скачиваются сами (~6,6 ГБ, Apache 2.0, без
регистрации). После промптов LLM по умолчанию
выгружается — H3 нужна вся видеокарта.

📌 ВРЕМЯ 📌
1 + (число блоков) проходов LLM. С картинками дольше —
время видно в заголовке предпросмотра.

===================================================
`;

function showHelp() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;" +
        "max-width:820px;max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;";
    box.textContent = HELP_TEXT;
    const b = document.createElement("button");
    b.textContent = "Close / Закрыть";
    b.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;border:none;" +
        "border-radius:4px;cursor:pointer;";
    b.onclick = () => overlay.remove();
    box.append(b);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

app.registerExtension({
    name: "Neron.H3.StoryAutoPrompter",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const specs = {};
        for (const grp of ["required", "optional"])
            for (const [k, s] of Object.entries(nodeData.input?.[grp] || {}))
                specs[k] = (Array.isArray(s) && s[1] && typeof s[1] === "object") ? s[1] : {};

        const oCreated = nodeType.prototype.onNodeCreated;
        const oConfigure = nodeType.prototype.onConfigure;
        const oExecuted = nodeType.prototype.onExecuted;
        const oBg = nodeType.prototype.onDrawBackground;
        const oFg = nodeType.prototype.onDrawForeground;
        const oResize = nodeType.prototype.onResize;

        nodeType.prototype.onNodeCreated = function () {
            const r = oCreated?.apply(this, arguments);
            const node = this;
            node.color = NODE_COLOR; node.bgcolor = NODE_BGCOLOR; node.resizable = true;
            const spacer = node.addWidget("text", "_spacer", "", () => {});
            spacer.serialize = false;
            spacer.draw = function () {}; spacer.computeSize = () => [0, 20];
            node.widgets.splice(node.widgets.indexOf(spacer), 1); node.widgets.unshift(spacer);
            const ex = node.widgets.find((w) => w.name === "expert");
            if (ex) {
                const cb = ex.callback;
                ex.callback = function () { const rr = cb?.apply(this, arguments); applyExpert(node, specs); return rr; };
            }
            // предпросмотр — перед правкой
            const prev = makePreview(node);
            const ei = node.widgets.findIndex((w) => w.name === "edited_prompt");
            if (ei >= 0) { node.widgets.splice(node.widgets.indexOf(prev), 1); node.widgets.splice(ei, 0, prev); }
            addGap(node, "_gap_edit", "edited_prompt");      // подпись «ПРАВКА» больше не налезает на окно
            node.addWidget("button", "✏ В правку / To edit", null, () => {
                const w = node.widgets.find((x) => x.name === "edited_prompt");
                if (w && node.__ltxLast) { w.value = node.__ltxLast; app.graph?.setDirtyCanvas(true, true); }
            });
            node.addWidget("button", "🗑 Очистить правку / Clear edit", null, () => {
                const w = node.widgets.find((x) => x.name === "edited_prompt");
                if (w) { w.value = ""; app.graph?.setDirtyCanvas(true, true); }
            });
            node.addWidget("button", "📖 Help / Справка", null, () => showHelp());
            for (const t of [50, 300, 800]) setTimeout(() => { updateBlockInputs(node); applyExpert(node, specs); }, t);
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = oConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => { updateBlockInputs(this); applyExpert(this, specs); }, t);
            return r;
        };
        const oConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = oConn?.apply(this, arguments);
            clearTimeout(this.__neronInputs);
            this.__neronInputs = setTimeout(() => updateBlockInputs(this), 30);
            return r;
        };
        nodeType.prototype.onExecuted = function (msg) {
            const r = oExecuted?.apply(this, arguments);
            const text = Array.isArray(msg?.text) ? msg.text.join("") : (msg?.text || "");
            const note = Array.isArray(msg?.note) ? msg.note.join(" ") : (msg?.note || "");
            setPreview(this, text, note);
            return r;
        };
        nodeType.prototype.onResize = function () {
            const r = oResize?.apply(this, arguments);
            clearTimeout(this.__neronReapply);
            this.__neronReapply = setTimeout(() => applyGroupGaps(this), 50);
            return r;
        };
        nodeType.prototype.onDrawBackground = function (ctx) {
            oBg?.apply(this, arguments);
            if (this.flags?.collapsed) return;
            ctx.save();
            for (const g of GROUPS) {
                const rr = groupRect(this, g);
                if (!rr) continue;
                ctx.fillStyle = g.fill; roundRect(ctx, rr.x, rr.y, rr.w, rr.h, 10); ctx.fill();
                ctx.strokeStyle = g.border; ctx.lineWidth = g.thick || 1.5;
                roundRect(ctx, rr.x, rr.y, rr.w, rr.h, 10); ctx.stroke();
            }
            ctx.restore();
        };
        nodeType.prototype.onDrawForeground = function (ctx) {
            oFg?.apply(this, arguments);
            if (this.flags?.collapsed) return;
            ctx.save();
            ctx.font = "bold 10px sans-serif"; ctx.textBaseline = "middle";
            for (const g of GROUPS) {
                const rr = groupRect(this, g);
                if (!rr) continue;
                ctx.fillStyle = g.label;
                let label = g.name;
                if (g.widgets[0] === "_ltx_preview" && this.__ltxNote) label += " · " + this.__ltxNote;
                if (g.widgets[0] === "total_seconds") label += " · " + planText(this);
                const maxW = rr.w - 24;
                while (label.length > 8 && ctx.measureText(label).width > maxW) label = label.slice(0, -2) + "…";
                ctx.fillText(label, rr.x + 12, rr.y + 9);
            }
            ctx.restore();
        };
    },
});
