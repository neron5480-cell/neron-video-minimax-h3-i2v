// 🎬 Neron LTX AutoPrompter — оформление Neron, режим эксперта, окно предпросмотра ответа,
// кнопки «✏ В правку» / «🗑 Очистить правку» и справка на двух языках.
import { app } from "../../scripts/app.js";

const NODE = "NeronLTXAutoPrompter";
const NODE_COLOR = "#3a2a1a";
const NODE_BGCOLOR = "#22180e";
const GROUP_GAP = 18;

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ГЛАВНОЕ / MAIN", widgets: ["seconds", "model", "mmproj"],
      fill: "rgba(200, 150,  90, 0.15)", border: "rgba(200, 150,  90, 0.75)", label: "rgba(255, 220, 170, 1.0)" },
    { name: "LLM", widgets: ["system_prompt", "max_tokens", "temperature", "n_ctx", "n_gpu_layers", "unload_after"],
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
        const hide = !ex && !o.ltx_main;
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

// ---------- окно предпросмотра ----------
function makePreview(node) {
    const box = document.createElement("textarea");
    box.readOnly = true;
    box.placeholder = "Здесь появится промпт, который написала модель.\nEN: The prompt written by the model appears here.";
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
🎬 NERON LTX AUTOPROMPTER
===================================================

📌 WHAT IT IS 📌
An AutoPrompter built for LTX 2.5 and the Neron LTX Engine.
You write a short brief and the camera behaviour; the LLM
looks at your frames and writes a long, detailed prompt:
the frame in fine detail, every movement with its physics
(cause → weight → reaction of materials → settling), paths
around obstacles, exact poses, and the sound.

📌 WIRING 📌
brief         ← a text node (any language, short).
camera_prompt ← a text node: how the camera behaves.
                The LLM puts it as the FIRST sentence and
                repeats it at the end. If it forgets — the
                node adds your sentence itself.
first / mid 1 / mid 2 / last frame ← Load Image.
Outputs go straight into the Neron LTX Engine:
prompt → prompt, seconds → seconds_in, frames → frames.
(Don't wire camera_prompt to the engine as well — it is
already inside the prompt.)

📌 WANT IT GOOD? ADD FRAMES 📌
Words alone can't hold complex motion: a spinning sword,
a dance, a run, hands working with objects. LTX invents
whatever you didn't show it — and gets it wrong.
The rule: want it good — give middle and last frames.
Make the final pose as a picture (edit the first frame
in any image model) and wire it into last_frame. The
model then heads to your picture instead of guessing.
No frames — you're on your own.

📌 PREVIEW AND EDIT 📌
The preview shows what the model wrote.
"✏ To edit" copies it into "your edit". While "your edit"
has text, it goes to the engine as is and the LLM does
not run — fix a word and generate again.
"🗑 Clear edit" — back to writing a new prompt.

📌 EXPERT 📌
system prompt, max_tokens (6144 — Qwen 3.5 thinks first
and LTX prompts are long), temperature, n_ctx, GPU layers,
unload the LLM after the prompt (frees VRAM for LTX).

📌 "THE MODEL GAVE NO ANSWER" 📌
The node retries: normal → answer without thinking →
without thinking with a 2× limit. Still nothing — raise
max_tokens / n_ctx or use a bigger model.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Автопромтер под LTX 2.5 и Neron LTX Engine. Ты пишешь
коротко, что происходит, и как ведёт себя камера; LLM
смотрит на кадры и пишет длинный подробный промпт: кадр
до мелочей, каждое движение с физикой (причина → вес →
ответ материалов → затухание), путь вокруг препятствий,
точные позы и звук.

📌 ПОДКЛЮЧЕНИЕ 📌
brief         ← текстовая нода (любой язык, коротко).
camera_prompt ← текстовая нода: как ведёт себя камера.
                Модель ставит это ПЕРВОЙ фразой и
                повторяет в конце. Забыла — нода сама
                вставит твою фразу.
кадры первый / промежуточные 1–2 / последний ← Load Image.
Выходы — прямо в Neron LTX Engine:
prompt → prompt, seconds → seconds_in, кадры → кадры.
(camera_prompt в движок второй раз не подключай — он
уже внутри промпта.)

📌 ХОЧЕШЬ ХОРОШО — СТАВЬ КАДРЫ 📌
Словами сложное движение не удержать: вращение меча,
танец, бег, руки с предметами. Что ты модели не
показал — она додумает сама, и обычно криво.
Правило: хочешь хорошо — ставь промежуточные и
последний кадр. Сделай финальную позу картинкой
(правкой первого кадра в любой модели картинок) и
подай в last_frame. Тогда модель ведёт к твоей
картинке, а не гадает. Не ставишь — сам себе бяка 🙂

📌 ПРЕДПРОСМОТР И ПРАВКА 📌
В окне — то, что написала модель.
«✏ В правку» копирует текст в «свою правку». Пока там
есть текст, он идёт в движок как есть, LLM не
запускается — поправил слово и генерируй снова.
«🗑 Очистить правку» — снова писать новый промпт.

📌 ЭКСПЕРТ 📌
системник, лимит ответа (6144 — Qwen 3.5 сначала думает,
а промпты LTX длинные), температура, окно памяти, слои на
видеокарте, выгрузка LLM после промпта (освобождает
видеопамять под LTX).

📌 «МОДЕЛЬ НЕ ОТВЕТИЛА» 📌
Нода повторяет сама: обычно → без раздумий → без раздумий
с двойным лимитом. Не помогло — увеличь лимит ответа или
окно памяти, либо возьми модель побольше.

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
    name: "Neron.LTX.AutoPrompter",
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
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(node, specs), t);
            return r;
        };
        nodeType.prototype.onConfigure = function () {
            const r = oConfigure?.apply(this, arguments);
            for (const t of [50, 300, 800]) setTimeout(() => applyExpert(this, specs), t);
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
                const maxW = rr.w - 24;
                while (label.length > 8 && ctx.measureText(label).width > maxW) label = label.slice(0, -2) + "…";
                ctx.fillText(label, rr.x + 12, rr.y + 9);
            }
            ctx.restore();
        };
    },
});
