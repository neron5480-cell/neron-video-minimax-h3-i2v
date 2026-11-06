// 📝 Neron H3 Story AutoPrompter — оформление Neron, режим эксперта, план ролика на ноде, окно предпросмотра,
// кнопки «✏ В правку» / «🗑 Очистить правку» и справка на двух языках.
import { app } from "../../scripts/app.js";

const NODE = "NeronH3StoryAutoPrompter";
const NODE_COLOR = "#2a3a1e";
const NODE_BGCOLOR = "#172210";
const GROUP_GAP = 18;
const FRAME_BOTTOM = 8;      // воздух между последним виджетом и низом рамки

const GROUPS = [
    { name: "⚙️ EXPERT MODE / ЭКСПЕРТ", widgets: ["expert"],
      fill: "rgba(255, 200, 100, 0.22)", border: "rgba(255, 200, 100, 0.95)", label: "rgba(255, 235, 160, 1.0)", thick: 2.5 },
    { name: "ГЛАВНОЕ / MAIN", widgets: ["total_seconds", "block_seconds"],
      fill: "rgba(200, 150,  90, 0.15)", border: "rgba(200, 150,  90, 0.75)", label: "rgba(255, 220, 170, 1.0)" },
    { name: "🎥 КАМЕРА / CAMERA", widgets: ["camera_mode", "framing", "camera_distance"],
      fill: "rgba( 90, 200, 200, 0.15)", border: "rgba( 90, 200, 200, 0.75)", label: "rgba(180, 255, 255, 1.0)" },
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
    // Текстовые поля ComfyUI рисует почти до края ноды — рамку делаем шире, чтобы поле было ВНУТРИ неё
    const flex = g.widgets.some((n) => { const w = node.widgets?.find((x) => x.name === n); return isFlexible(w); });
    const padX = flex ? 4 : 10;
    return { x: padX, y: y0 - 16, w: node.size[0] - padX * 2, h: (y1 - y0) + 16 + FRAME_BOTTOM };
}

// Окна, которые растягиваются вместе с нодой (предпросмотр, правка), нельзя трогать отступом:
// ComfyUI растягивает только виджеты БЕЗ computeSize. Им отступ дают отдельные распорки.
function isFlexible(w) {
    return !!w && (typeof w.computeLayoutSize === "function" || !!w.element) && !w.__neronOrigSize;
}

// Отступы между панелями — отдельные невидимые распорки (_gap_*), а не «добавка» к высоте последнего виджета:
// часть сборок ComfyUI считает высоту списков по-своему и добавку игнорирует — панели наезжали друг на друга.
const GAPS = [["_gap_main", "total_seconds"], ["_gap_cam", "camera_mode"], ["_gap_llm", "model"],
              ["_gap_prev", "_ltx_preview"], ["_gap_edit", "edited_prompt"]];

function applyGroupGaps(node) {
    for (const w of node.widgets || []) clearBottomPadding(w);      // старые сохранённые ноды
    const ex = wv(node, "expert") === true;
    for (const w of node.widgets || []) {
        if (w.name === "_gap_llm") w.hidden = !ex;                    // LLM спрятан — его распорка тоже
    }
}

// Невидимая распорка: свой тип виджета, клик по ней ничего не открывает (у текстового — окошко «Value»)
function blank(node, name, height) {
    return node.addCustomWidget({ name, type: "neron_blank", value: "", serialize: false,
                                  options: { serialize: false }, draw() {}, computeSize: () => [0, height],
                                  mouse() { return false; } });
}

function addGap(node, name, beforeName) {
    const gap = blank(node, name, GROUP_GAP + 6 + FRAME_BOTTOM);
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

// ---------- входы: сценарий, 🖼 кадры одним проводом, LoRA на весь ролик ----------
// Старые входы (first_frame, block_1…) из прошлых версий убираем — теперь картинки идут через 🖼 Кадры,
// а 🎞 Блоки подключаются прямо к движку.
function canon() {
    return [["scenario", "STRING"], ["frames", "NERON_H3_FRAMES"], ["lora_all", "NERON_H3_LORAS"]];
}
function legacy(name) { return name === "first_frame" || /^block_\d+$/.test(name); }
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
        for (let i = node.inputs.length - 1; i >= 0; i--) if (legacy(node.inputs[i].name)) node.removeInput(i);
        const names = node.inputs.map((x) => x.name);
        for (const [name, type] of canon()) if (!names.includes(name)) node.addInput(name, type);
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
    box.placeholder = "Здесь появится промпт ролика — по отрезкам, с секундами.\nEN: The video prompt appears here, part by part with seconds.";
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
scenario ← a text node: the whole video in your words,
           any language. This is the main thing.
frames   ← 🖼 Frames node: all pictures in ONE wire —
           first frame (start + appearance <Picture 1>),
           two middle pictures, last frame.
lora_all ← 🎨 LoRA set: style for the whole video.
story  → the engine's 'story' input. That's all.
prompts → (optional) all block prompts as text.
Per-block LoRAs or your own text for one block —
🎞 Block nodes straight on the ENGINE (expert).

📌 CAMERA 📌
Works like our ⚡ Fixed Camera H3 node:
• AUTO — the AutoPrompter decides. No camera words in
  the scenario → the camera is locked. You wrote a
  move ("the camera circles her and stops over her
  shoulder") → it is written by seconds: direction,
  speed, where it ends; then the camera holds. The
  next block starts with the camera where it ended.
• FRONT / LEFT / RIGHT / BACK / TOP / BOTTOM — a fixed
  angle: the program puts the camera header (from
  Fixed Camera H3) into every block and removes any
  camera words of the LLM.
Framing "as in the first frame" — safest for a chain.
A moving camera holds seams a bit worse than a locked
one — keep moves short and clear.

📌 LENGTH 📌
Video 5–45 s and block 5–15 s (maximum) are set HERE.
The plan is shown live on the node, e.g.
"30 s = 4 blocks of 8.7 s", and goes to the engine.

📌 SCENARIO AND PICTURES 📌
The scenario is the backbone: the whole story, spread
over the blocks in its order.
Middle pictures (a tiger, a crater, a room) appear
where the scenario says; if it doesn't say — at
about 1/3 and 2/3 of the video. The 🖼 line under
each block in the preview shows its pictures.
Last frame — strict: the very end of the video looks
exactly like it. Use a frame of the same scene and
angle.
In the prompts pictures become <Picture N> in the
engine's numbering (<Picture 1> = appearance).

📌 PREVIEW AND EDIT 📌
The preview shows all prompts, split by
"### БЛОК k ###" lines. The "💬" line is a short
summary for you — it is NOT sent to the model.
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
scenario ← текстовая нода: весь ролик своими словами,
           любой язык. Это главное.
frames   ← нода 🖼 Кадры: все картинки ОДНИМ проводом
           — первый кадр (начало + внешность
           <Picture 1>), два промежуточных, последний.
lora_all ← 🎨 Набор LoRA: стиль на весь ролик.
story  → вход 'story' движка. И всё.
prompts → (по желанию) все промпты текстом.
LoRA отдельных блоков или свой текст для блока —
ноды 🎞 Блок прямо на ДВИЖКЕ (эксперт).

📌 КАМЕРА 📌
Работает как наша нода ⚡ Fixed Camera H3:
• АВТО — решает AutoPrompter. В сценарии о камере ни
  слова → камера стоит. Написал движение («камера
  огибает её и застывает над плечом») → оно
  расписывается по секундам: куда, как быстро, где
  останавливается; дальше камера стоит. Следующий
  блок начинается с камерой там, где она встала.
• ФРОНТ / СЛЕВА / СПРАВА / СЗАДИ / СВЕРХУ / СНИЗУ —
  жёсткий ракурс: программа ставит шапку камеры (из
  Fixed Camera H3) в каждый блок и вычищает слова LLM
  про камеру.
План «как на первом кадре» — самый надёжный для
цепочки. Подвижная камера держит стыки чуть хуже
неподвижной — делай движения короткими и ясными.

📌 ДЛИНА 📌
Ролик 5–45 с и блок 5–15 с (максимум) задаются ЗДЕСЬ.
План виден на ноде сразу, например «30 с = 4 блока по
8,7 с», и уходит в движок.

📌 СЦЕНАРИЙ И КАРТИНКИ 📌
Сценарий — хребет: вся история, разложенная по
блокам по порядку.
Промежуточные картинки (тигр, воронка, комната)
появляются там, где это сказано в сценарии; не
сказано — примерно на 1/3 и 2/3 ролика. Строка 🖼 под
каждым блоком в предпросмотре — его картинки.
Последний кадр — жёсткий: самый конец ролика будет
ровно таким. Ставь кадр той же сцены и ракурса.
В промптах картинки — <Picture N> в нумерации движка
(<Picture 1> — внешность).

📌 ПРЕДПРОСМОТР И ПРАВКА 📌
В окне — все промпты, разделённые строками
«### БЛОК k ###». Строка «💬» — краткий пересказ
для тебя, в модель она НЕ идёт.
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
            const spacer = blank(node, "_spacer", 20);
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
            for (const [gn, before] of GAPS) addGap(node, gn, before);   // подписи панелей не налезают на соседей
            node.addWidget("button", "✏ В правку / To edit", null, () => {
                const w = node.widgets.find((x) => x.name === "edited_prompt");
                if (w && node.__ltxLast) { w.value = node.__ltxLast; app.graph?.setDirtyCanvas(true, true); }
            });
            node.addWidget("button", "🗑 Очистить правку / Clear edit", null, () => {
                const w = node.widgets.find((x) => x.name === "edited_prompt");
                if (w) { w.value = ""; app.graph?.setDirtyCanvas(true, true); }
            });
            node.addWidget("button", "📖 Help / Справка", null, () => showHelp());
            addGap(node, "_gap_btn", "✏ В правку / To edit");   // рамка «ПРАВКА» не налезает на кнопки
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
