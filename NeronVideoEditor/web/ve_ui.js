import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ============================================================================
//  Neron Video Editor — видео → видео / video → video
//
//  RU: 🎬 Видео ×3 и 🖼 Картинки ×4 — кубики входов (слоты открываются по мере
//      подключения). 🎛 Монтажный пульт — предпросмотр, полоска времени с
//      событиями, области и переходы. Видео 1 вне событий не трогается.
//  EN: 🎬 Video ×3 and 🖼 Pictures ×4 are input cubes (slots open as you wire).
//      🎛 Edit Pult — preview, timeline with events, areas and transitions.
//      Video 1 is untouched outside events.
// ============================================================================

const T = (ru, en) => `${ru} / ${en}`;
const ACC = "#b388ff";
const COL = { picture: "#9b6cff", insert: "#2fa79a" };
const TR = [
    ["cut", "Сразу", "Cut"],
    ["dissolve", "Наплыв", "Dissolve"],
    ["reveal", "Проявление", "Reveal"],
    ["wipe", "Шторка", "Wipe"],
    ["dip", "Через тьму", "Dip to black"],
];
const TR_TIP = {
    cut: T("Появляется сразу, без перехода", "Appears at once"),
    dissolve: T("Плавный наплыв: одно перетекает в другое", "Smooth cross-dissolve"),
    reveal: T("Проявление: сначала тёмные линии, потом всё остальное — как будто рисуют карандашом. В «Монтаже» показано примерно, точно — в «Результате»",
        "Reveal: dark strokes first, then the rest — like a pencil drawing. Approximate in “Edit”, exact in “Result”"),
    wipe: T("Шторка слева направо", "Wipe left to right"),
    dip: T("Через затемнение: кадр гаснет и проявляется новое", "Dip to black: the frame fades out, the new one fades in"),
};

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtT = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
};
const smooth = (p) => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };

// ---------------------------------------------------------------- стили
function injectStyles() {
    if (document.getElementById("nve-styles")) return;
    const s = document.createElement("style");
    s.id = "nve-styles";
    s.textContent = `
.nve-root{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:5px;font-family:"Segoe UI",Arial,sans-serif;
  color:var(--nt-text,#cfd2d8);user-select:none;overflow:hidden;position:relative}
.nve-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;flex:none}
.nve-title{font-size:12px;font-weight:800;color:${ACC};letter-spacing:.6px;margin-right:4px;white-space:nowrap}
.nve-btn{height:24px;padding:0 9px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;
  background:var(--nt-btn,#4a4e5a);white-space:nowrap;flex:none}
.nve-btn:hover{filter:brightness(1.18)}
.nve-btn:disabled{opacity:.4;cursor:default;filter:none}
.nve-btn.on{background:#6b4fb3;box-shadow:0 0 0 1px ${ACC} inset}
.nve-btn.go{background:#2f7d4f}
.nve-btn.pic{background:#5b3fa8}
.nve-btn.ins{background:#1f7a70}
.nve-btn.warn{background:#7a3b3b}
.nve-btn.sm{height:20px;padding:0 6px;font-size:10px}
.nve-time{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--nt-bright,#fff);min-width:96px;text-align:center}
.nve-sp{flex:1}
.nve-seg{display:flex;border-radius:5px;overflow:hidden;border:1px solid var(--nt-line,#33363e);flex:none}
.nve-seg button{border:none;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer}
.nve-seg button.on{background:#6b4fb3;color:#fff}
.nve-seg button:disabled{opacity:.4;cursor:default}
.nve-body{display:flex;gap:6px;flex:1;min-height:0}
.nve-view{position:relative;flex:1;min-width:220px;background:#0b0c10;border-radius:6px;overflow:hidden;border:1px solid var(--nt-line,#33363e)}
.nve-view canvas{display:block;width:100%;height:100%;touch-action:none}
.nve-tag{position:absolute;left:8px;top:6px;font-size:10px;font-weight:700;color:#fff;background:rgba(107,79,179,.8);padding:2px 7px;border-radius:4px;pointer-events:none}
.nve-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;font-size:12px;
  color:var(--nt-muted,#8b90a0);line-height:1.6;pointer-events:none}
.nve-side{width:290px;flex:none;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.nve-sec{background:var(--nt-card,#1c1e24);border:1px solid var(--nt-line,#33363e);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:5px}
.nve-h{font-size:10px;font-weight:800;color:${ACC};letter-spacing:.5px;display:flex;align-items:center;gap:4px}
.nve-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.nve-lbl{font-size:10px;color:var(--nt-muted,#8b90a0);min-width:74px}
.nve-small{font-size:10px;color:var(--nt-muted,#8b90a0);line-height:1.35}
.nve-in,.nve-sel{box-sizing:border-box;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);border:1px solid var(--nt-line,#33363e);
  border-radius:4px;font-size:11px;outline:none;font-family:inherit}
.nve-in{height:22px;padding:0 4px;width:52px}
.nve-sel{height:22px;flex:1;min-width:0}
.nve-sel option{background:var(--nt-input,#23252b)}
.nve-in:focus,.nve-sel:focus{border-color:#6b4fb3}
.nve-range{flex:1;min-width:60px;accent-color:${ACC}}
.nve-chk{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--nt-muted2,#9aa0ae);cursor:pointer}
.nve-src{display:flex;align-items:center;gap:5px;font-size:10px;padding:2px 0}
.nve-dot{width:8px;height:8px;border-radius:50%;flex:none;background:#3a3d46}
.nve-dot.ok{background:#3fbf5a}
.nve-thumb{width:34px;height:22px;object-fit:cover;border-radius:3px;background:#000;flex:none}
.nve-tl{flex:none;width:100%;display:block;border-radius:5px;cursor:pointer;background:var(--nt-deep,#15171c);touch-action:none}
.nve-status{flex:none;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:13px}
.nve-status.err{color:#e5787b}
.nve-status.warn{color:#e0b030}
.nve-status.ok{color:#5fd07a}
.nve-help{position:absolute;inset:0;background:rgba(12,13,17,.97);overflow:auto;padding:12px 16px;font-size:12px;line-height:1.5;color:#dcdfe6;
  display:none;user-select:text;z-index:5}
.nve-help h3{margin:6px 0 4px;color:${ACC};font-size:13px}
.nve-help b{color:#fff}
.nve-help .x{position:sticky;top:0;float:right}
.nve-expert{display:none !important}
.nve-root.expert .nve-expert{display:flex !important}
.nve-cube{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:5px;font-family:"Segoe UI",Arial,sans-serif;
  font-size:10px;color:var(--nt-muted,#8b90a0);overflow:hidden;position:relative}
.nve-cube .nve-sp{flex:1}
.nve-pop{position:fixed;z-index:10000;max-width:460px;max-height:70vh;overflow:auto;background:#121318;border:1px solid #6b4fb3;border-radius:8px;
  padding:12px 14px;font:12px/1.5 "Segoe UI",Arial,sans-serif;color:#dcdfe6;box-shadow:0 8px 30px rgba(0,0,0,.6)}
.nve-pop h3{margin:6px 0 4px;color:${ACC};font-size:13px}
.nve-pop b{color:#fff}
`;
    document.head.appendChild(s);
}

// ---------------------------------------------------------------- справка / help
const HELP_PULT = `
<h3>🎛 Монтажный пульт — как пользоваться</h3>
<b>1.</b> Подключите <b>Load Video</b> к кубику <b>🎬 Видео ×3</b>: <b>видео 1</b> — ведущее, его меняем. Видео 2 и 3 — откуда берём врезки. Звук и fps подтягиваются сами.<br>
<b>2.</b> Картинки (рисунки, кадры) — через <b>Load Image</b> в кубик <b>🖼 Картинки ×4</b>.<br>
<b>3.</b> Оба кубика — в пульт. Предпросмотр появляется сразу; <b>точный</b> — после первого нажатия «Очередь» (Queue).<br>
<b>4.</b> Поставьте бегунок на нужную секунду и нажмите <b>+ 🖼 Картинка</b> или <b>+ 🎬 Врезка</b>. На полоске появится событие: его можно <b>тащить</b> и <b>растягивать за края</b>.<br>
<b>5.</b> Справа выберите, <b>как появится</b> и <b>как уйдёт</b> (наплыв, проявление, шторка, через тьму) и <b>где</b>: весь кадр или <b>область</b>. Область двигается и растягивается прямо на кадре.<br>
<b>6.</b> У врезки кнопкой <b>✂ Участок</b> выберите, какой кусок второго видео взять (на кадре источника), и с какой секунды источника.<br>
<b>7.</b> Нажмите «Очередь». Вкладка <b>Результат</b> — готовый ролик, <b>До/После</b> — шторка для сравнения с оригиналом.<br><br>
<b>Главное правило:</b> всё вне событий и вне их областей — оригинал видео 1, кадр в кадр. Размер, длина и fps — как у видео 1.<br>
<b>Звук:</b> видео 1, свой (провод <i>audio</i>, например из Audio Studio), смешать или без звука. У врезки можно включить её звук — он плавно перехватит звук на время врезки.<br>
<b>Выходы:</b> <i>images, audio, fps</i> → Neron Video Combine или Video Combine. Пульт и сам сохраняет ролик в <i>output/Neron_Videos</i> (галочка 💾).<br>
<b>🔧 Эксперт:</b> мягкость края, прозрачность, «вписать/заполнить», сила подгонки цвета, скорость врезки, свой fps, громкости.<br>
<b>Длина:</b> монтаж работает с любой длиной, но всё видео держится в памяти: 15 с Full HD ≈ 11 ГБ ОЗУ. Длинные ролики лучше резать в Load Video (frame_load_cap / skip_first_frames).
<h3>🎛 Edit Pult — how to use</h3>
<b>1.</b> Connect <b>Load Video</b> to the <b>🎬 Video ×3</b> cube: <b>video 1</b> is the lead (the one we edit); videos 2 and 3 are sources for inserts. Audio and fps wire themselves.<br>
<b>2.</b> Pictures (drawings, frames) go through <b>Load Image</b> into <b>🖼 Pictures ×4</b>.<br>
<b>3.</b> Both cubes into the pult. A preview appears at once; the <b>exact</b> one after the first Queue.<br>
<b>4.</b> Put the playhead on the second you need and press <b>+ 🖼 Picture</b> or <b>+ 🎬 Insert</b>. An event appears on the strip: <b>drag</b> it and <b>stretch its edges</b>.<br>
<b>5.</b> On the right choose <b>how it appears</b> and <b>leaves</b> (dissolve, reveal, wipe, dip) and <b>where</b>: full frame or an <b>area</b> you move and resize right on the frame.<br>
<b>6.</b> For an insert, <b>✂ Piece</b> selects which part of the source video to take, and from which source second.<br>
<b>7.</b> Press Queue. <b>Result</b> shows the finished clip, <b>Before/After</b> a compare shutter.<br><br>
<b>Main rule:</b> everything outside events and their areas is video 1, frame for frame. Size, length and fps match video 1.<br>
<b>Length:</b> any length works, but the whole video is held in memory: 15 s Full HD ≈ 11 GB RAM. Trim long clips in Load Video.
`;
const HELP_VIDEOS = `
<h3>🎬 Видео ×3</h3>
Подключите <b>IMAGE</b> от <b>Load Video</b> к <b>video_1</b> — звук (<i>audio</i>) и частота кадров (<i>video_info</i>) подключатся сами. Подключили — открылся следующий слот.<br>
<b>Видео 1</b> — ведущее: его меняем, итог будет его размера, длины и fps. <b>Видео 2 и 3</b> — откуда брать врезки.<br>
Выход <b>videos</b> — в 🎛 Монтажный пульт.
<h3>🎬 Video ×3</h3>
Connect <b>IMAGE</b> from <b>Load Video</b> to <b>video_1</b> — <i>audio</i> and <i>video_info</i> (fps) wire themselves. The next slot opens once one is used.<br>
<b>Video 1</b> is the lead: the result keeps its size, length and fps. <b>Videos 2 and 3</b> are sources for inserts.<br>
The <b>videos</b> output goes to the 🎛 Edit Pult.
`;
const HELP_IMAGES = `
<h3>🖼 Картинки ×4</h3>
Подключите <b>Load Image</b> к <b>image_1</b>, <b>image_2</b>… Пустые слоты, кроме одного свободного, скрыты.<br>
Это рисунки, кадры, образцы — в пульте они проявляются поверх видео 1. Выход <b>images</b> — в 🎛 Монтажный пульт.
<h3>🖼 Pictures ×4</h3>
Connect <b>Load Image</b> to <b>image_1</b>, <b>image_2</b>… Empty slots except one free slot stay hidden.<br>
Drawings, frames, samples — in the pult they appear over video 1. The <b>images</b> output goes to the 🎛 Edit Pult.
`;

function showPop(html, anchor) {
    document.querySelectorAll(".nve-pop").forEach((p) => p.remove());
    const p = el("div", "nve-pop");
    p.innerHTML = html + `<div style="text-align:right;margin-top:8px"><button class="nve-btn">✕ ${T("Закрыть", "Close")}</button></div>`;
    p.querySelector("button").onclick = () => p.remove();
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    p.style.left = clamp(r.left, 8, window.innerWidth - 470) + "px";
    p.style.top = clamp(r.bottom + 6, 8, window.innerHeight - 200) + "px";
    const off = (e) => { if (!p.contains(e.target) && e.target !== anchor) { p.remove(); document.removeEventListener("pointerdown", off, true); } };
    setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
}

// ---------------------------------------------------------------- провода / wires
function linkOf(graph, id) {
    if (!graph || !graph.links || id == null) return null;
    return graph.links instanceof Map ? graph.links.get(id) : graph.links[id];
}
function upstream(node, inputName) {
    const inp = (node.inputs || []).find((i) => i.name === inputName);
    if (!inp || inp.link == null) return null;
    const l = linkOf(node.graph, inp.link);
    if (!l) return null;
    const n = node.graph.getNodeById(l.origin_id);
    return n ? { node: n, slot: l.origin_slot } : null;
}
const VID_RE = /\.(mp4|webm|mov|mkv|avi|m4v|gif)$/i;
const IMG_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;
function parseFile(raw, re) {
    let s = String(raw || "").trim();
    if (!s) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    if (s.startsWith("/") || /^[A-Za-z]:/.test(s) || s.split("/").includes("..")) return null;
    const k = s.lastIndexOf("/");
    const name = k >= 0 ? s.slice(k + 1) : s;
    if (!name || !re.test(name)) return null;
    return { filename: name, subfolder: k >= 0 ? s.slice(0, k) : "", type: ["input", "output", "temp"].includes(type) ? type : "input" };
}
function wv(n, name) {
    const w = (n.widgets || []).find((x) => x.name === name);
    return w ? w.value : undefined;
}
// по проводу вверх до загрузчика (через ноды-обработчики тоже)
function findFile(startNode, inputName, re, widgetNames) {
    let hop = upstream(startNode, inputName);
    for (let d = 0; hop && d < 8; d++) {
        const cur = hop.node;
        for (const wn of widgetNames) {
            const spec = parseFile(wv(cur, wn), re);
            if (spec) {
                // VHS: если кадры обрезаны/прорежены — время по файлу примерное
                const approx = (Number(wv(cur, "skip_first_frames")) || 0) > 0 || (Number(wv(cur, "frame_load_cap")) || 0) > 0
                    || (Number(wv(cur, "select_every_nth")) || 1) > 1;
                return { spec, approx, via: cur.title || cur.type };
            }
        }
        const up = (cur.inputs || []).find((i) => i.link != null && /IMAGE|VIDEO/i.test(String(i.type)));
        if (!up) break;
        hop = upstream(cur, up.name);
    }
    return null;
}
function viewUrl(ref, bust) {
    const p = `/view?filename=${encodeURIComponent(ref.filename)}&subfolder=${encodeURIComponent(ref.subfolder || "")}&type=${encodeURIComponent(ref.type || "input")}${bust ? "&t=" + bust : ""}`;
    return typeof api.apiURL === "function" ? api.apiURL(p) : p;
}

// ---------------------------------------------------------------- размер ноды
function makeUserSized(node, domWidget, root, opts) {
    const minH = opts.minH || 200;
    node.properties = node.properties || {};
    const manual = () => node.properties.neron_manual_size === true;
    const curH = () => {
        if (!manual()) return opts.autoH;
        const h = Number(node.properties.neron_panel_h);
        return h > 0 ? Math.max(minH, h) : opts.autoH;
    };
    const o = domWidget.options || (domWidget.options = {});
    o.getMinHeight = () => (manual() ? minH : curH());
    o.getHeight = () => curH();
    o.getMaxHeight = () => curH();
    domWidget.computeSize = (width) => [width, manual() && app.canvas?.resizing_node === node ? minH : curH()];
    const apply = () => { root.style.height = curH() + "px"; opts.onLayout?.(); };
    let fitting = false, tries = 0;
    const fit = () => {
        apply();
        const top = domWidget.last_y;
        if (top == null && tries++ < 30) { setTimeout(fit, 100); return; }
        if (fitting || top == null || !node.size) return;
        const need = Math.round(top + curH() + 14);
        if (manual() ? node.size[1] < need : Math.abs(node.size[1] - need) > 2) {
            fitting = true; node.setSize([node.size[0], need]); fitting = false;
        }
        node.setDirtyCanvas?.(true, true);
    };
    const onResize0 = node.onResize;
    node.onResize = function () {
        const r = onResize0 ? onResize0.apply(this, arguments) : undefined;
        if (!fitting && app.canvas?.resizing_node === node) {
            node.properties.neron_manual_size = true;
            const top = domWidget.last_y;
            if (top != null) node.properties.neron_panel_h = Math.max(minH, Math.round(node.size[1] - top - 14));
        }
        requestAnimationFrame(apply);
        return r;
    };
    const menu0 = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        const r = menu0 ? menu0.apply(this, arguments) : undefined;
        if (manual() && Array.isArray(options)) {
            options.push(null, { content: "↕ Авто-размер / Auto size", callback: () => { node.properties.neron_manual_size = false; fit(); } });
        }
        return r;
    };
    apply();
    setTimeout(fit, 60);
    return { fit, apply };
}

// ============================================================================
//  Кубики входов / input cubes
// ============================================================================
function setupCube(node, cfg) {
    injectStyles();
    // полоска с подсказкой и справкой
    const bar = el("div", "nve-cube");
    const info = el("span", "", cfg.hint);
    bar.appendChild(info);
    bar.appendChild(el("span", "nve-sp"));
    const hb = el("button", "nve-btn sm", "📖 Help");
    hb.title = T("Справка", "Help");
    hb.onclick = (e) => { e.stopPropagation(); showPop(cfg.help, hb); };
    bar.appendChild(hb);
    const dw = node.addDOMWidget("nve_cube_bar", "nve_cube_bar", bar, { serialize: false, hideOnZoom: false });
    dw.computeSize = (w) => [w, 26];
    const o = dw.options || (dw.options = {});
    o.getMinHeight = () => 26; o.getHeight = () => 26; o.getMaxHeight = () => 26;

    let syncing = false;
    const groupOf = (name) => { const m = cfg.re.exec(name || ""); return m ? parseInt(m[2], 10) : null; };
    const linked = (inp) => inp && inp.link != null;

    function sync() {
        if (syncing || !node.graph) return;
        syncing = true;
        try {
            // какая последняя группа занята / last used group
            let last = 0;
            for (const inp of node.inputs || []) {
                const g = groupOf(inp.name);
                if (g && linked(inp)) last = Math.max(last, g);
            }
            const want = clamp(Math.max(last + 1, cfg.min), 1, cfg.max);
            // лишние пустые — убрать / remove extra empty slots
            for (let i = (node.inputs || []).length - 1; i >= 0; i--) {
                const inp = node.inputs[i];
                const g = groupOf(inp.name);
                if (g && g > want && !linked(inp)) node.removeInput(i);
            }
            // недостающие — добавить по порядку / add missing ones in order
            for (let g = 1; g <= want; g++) {
                for (const [base, type] of cfg.slots) {
                    const name = `${base}_${g}`;
                    if (!(node.inputs || []).some((i) => i.name === name)) {
                        node.addInput(name, type);
                        const inp = node.inputs[node.inputs.length - 1];
                        if (cfg.tips[base]) inp.tooltip = cfg.tips[base](g);
                    }
                }
            }
            // порядок: группа, потом вид / order by group then kind
            const order = (n) => { const g = groupOf(n) || 99; const k = cfg.slots.findIndex(([b]) => n.startsWith(b + "_")); return g * 10 + k; };
            const sorted = [...node.inputs].sort((a, b) => order(a.name) - order(b.name));
            if (sorted.some((x, i) => x !== node.inputs[i])) {
                // перестановка без потери проводов / reorder keeping links
                const g = node.graph;
                node.inputs.splice(0, node.inputs.length, ...sorted);
                node.inputs.forEach((inp, i) => {
                    const l = linkOf(g, inp.link);
                    if (l) l.target_slot = i;
                });
            }
            const used = (node.inputs || []).filter((i) => i.name.startsWith(cfg.slots[0][0] + "_") && linked(i)).length;
            info.textContent = cfg.count(used);
            const sz = node.computeSize();
            node.setSize([Math.max(node.size[0], sz[0]), Math.max(sz[1], 60)]);
            node.setDirtyCanvas?.(true, true);
        } finally {
            syncing = false;
        }
    }
    node.__nveSync = sync;
    setTimeout(sync, 0);
}

function autoWireVideo(node, index) {
    // подключили IMAGE от Load Video — звук и video_info подключаем сами
    const inp = node.inputs?.[index];
    if (!inp || inp.link == null) return;
    const m = /^video_(\d)$/.exec(inp.name);
    if (!m) return;
    const g = m[1];
    const l = linkOf(node.graph, inp.link);
    const src = l && node.graph.getNodeById(l.origin_id);
    if (!src) return;
    const pairs = [["audio_" + g, /^audio$/i, "AUDIO"], ["info_" + g, /^video_info$/i, "VHS_VIDEOINFO"]];
    for (const [tName, re, type] of pairs) {
        const ti = (node.inputs || []).findIndex((i) => i.name === tName);
        if (ti < 0 || node.inputs[ti].link != null) continue;
        const oi = (src.outputs || []).findIndex((o) => re.test(o.name || "") || String(o.type) === type);
        if (oi < 0 || String(src.outputs[oi].type) !== type) continue;
        try { src.connect(oi, node, ti); } catch (e) { /* не страшно */ }
    }
}

// ============================================================================
//  Монтажный пульт / Edit Pult
// ============================================================================
function defaultState() {
    return { v: 1, events: [], audio: "main", save: true, main_gain: 1, ext_gain: 1, fps1: 0 };
}
function newId() { return Math.random().toString(36).slice(2, 9); }

function setupPult(node) {
    injectStyles();
    node.properties = node.properties || {};

    // ---------- скрытое поле с монтажом ----------
    const jw = (node.widgets || []).find((w) => w.name === "edit_json");
    if (jw) { jw.type = "hidden"; jw.hidden = true; jw.computeSize = () => [0, -4]; }
    let state;
    try { state = Object.assign(defaultState(), JSON.parse(jw?.value || "{}")); } catch (e) { state = defaultState(); }
    if (!Array.isArray(state.events)) state.events = [];
    state.events.forEach((e) => { if (!e.id) e.id = newId(); });
    const save = () => { if (jw) jw.value = JSON.stringify(state); node.setDirtyCanvas?.(true, false); };
    save();

    // ---------- что подключено / sources ----------
    // src: {1..3: {url, approx, dur, fps, w, h, el(video), exact}}, pics: {1..4: {url, img, w, h}}
    const S = { vids: {}, pics: {}, result: null, saved: null, notes: [] };
    const exact = { vids: {}, pics: {} };          // от последнего запуска / from the last run

    // ---------- разметка ----------
    const root = el("div", "nve-root");
    if (node.properties.neron_expert) root.classList.add("expert");
    root.addEventListener("keydown", (e) => e.stopPropagation());

    const bar = el("div", "nve-bar");
    bar.appendChild(el("span", "nve-title", "🎛 МОНТАЖ · EDIT"));
    const playBtn = el("button", "nve-btn go", "▶");
    playBtn.title = T("Играть / пауза (пробел — когда мышь над кадром)", "Play / pause (space while hovering the frame)");
    bar.appendChild(playBtn);
    const timeLbl = el("span", "nve-time", "00:00.0 / 00:00.0");
    bar.appendChild(timeLbl);
    const modeSeg = el("div", "nve-seg");
    const modeBtns = {};
    for (const [k, ru, en, tip] of [
        ["edit", "Монтаж", "Edit", T("Живой предпросмотр монтажа: видно сразу, без Очереди", "Live edit preview, no Queue needed")],
        ["result", "Результат", "Result", T("Готовый ролик после «Очереди» — точно как на выходе", "The finished clip after Queue — exactly the output")],
        ["compare", "До/После", "Before/After", T("Шторка: слева оригинал, справа результат. Тяните мышкой", "Shutter: original left, result right. Drag it")],
    ]) {
        const b = el("button", "", T(ru, en));
        b.title = tip;
        b.onclick = () => setMode(k);
        modeBtns[k] = b; modeSeg.appendChild(b);
    }
    bar.appendChild(modeSeg);
    bar.appendChild(el("span", "nve-sp"));
    const addPic = el("button", "nve-btn pic", "+ 🖼 " + T("Картинка", "Picture"));
    addPic.title = T("Картинка появится с текущей секунды", "A picture appears from the current second");
    const addIns = el("button", "nve-btn ins", "+ 🎬 " + T("Врезка", "Insert"));
    addIns.title = T("Кусок видео 2 или 3 появится с текущей секунды", "A piece of video 2 or 3 appears from the current second");
    bar.appendChild(addPic); bar.appendChild(addIns);
    const expBtn = el("button", "nve-btn" + (node.properties.neron_expert ? " on" : ""), "🔧");
    expBtn.title = T("Режим эксперта: тонкие настройки", "Expert mode: fine settings");
    bar.appendChild(expBtn);
    const helpBtn = el("button", "nve-btn", "📖 Help");
    bar.appendChild(helpBtn);
    root.appendChild(bar);

    const body = el("div", "nve-body");
    const view = el("div", "nve-view");
    const cv = el("canvas");
    view.appendChild(cv);
    const tag = el("div", "nve-tag", "");
    view.appendChild(tag);
    const empty = el("div", "nve-empty", "");
    view.appendChild(empty);
    body.appendChild(view);
    const side = el("div", "nve-side");
    body.appendChild(side);
    root.appendChild(body);

    const tl = el("canvas", "nve-tl");
    root.appendChild(tl);
    const status = el("div", "nve-status", "");
    root.appendChild(status);

    const help = el("div", "nve-help");
    help.innerHTML = `<button class="nve-btn x">✕</button>` + HELP_PULT;
    help.querySelector(".x").onclick = () => { help.style.display = "none"; };
    root.appendChild(help);
    helpBtn.onclick = () => { help.style.display = help.style.display === "block" ? "none" : "block"; };

    function setStatus(text, kind) {
        status.textContent = text || "";
        status.title = text || "";
        status.className = "nve-status" + (kind ? " " + kind : "");
    }

    // ---------- медиа-элементы / media elements ----------
    function mkVideo() {
        const v = document.createElement("video");
        v.preload = "auto"; v.playsInline = true; v.crossOrigin = "anonymous"; v.muted = true;
        v.addEventListener("loadeddata", () => { dirty = true; refreshMeta(); });
        v.addEventListener("seeked", () => { dirty = true; });
        return v;
    }
    const vEls = { 1: mkVideo(), 2: mkVideo(), 3: mkVideo() };
    const rEl = mkVideo();
    rEl.addEventListener("loadeddata", () => { dirty = true; updateUI(); });
    const imgEls = {};
    function imgEl(slot) {
        if (!imgEls[slot]) {
            const im = new Image();
            im.crossOrigin = "anonymous";
            im.onload = () => { dirty = true; renderSide(); };
            imgEls[slot] = im;
        }
        return imgEls[slot];
    }
    const setSrc = (m, url) => { if (url && m.__url !== url) { m.__url = url; m.src = url; } else if (!url && m.__url) { m.__url = null; m.removeAttribute("src"); try { m.load?.(); } catch (e) { /* ок */ } } };

    // ---------- что подключено: по проводам и по последнему запуску ----------
    function cubeNode(inputName) { const u = upstream(node, inputName); return u ? u.node : null; }
    function scanSources() {
        const vc = cubeNode("videos"), ic = cubeNode("images");
        for (const s of [1, 2, 3]) {
            let url = null, approx = false, wired = false;
            if (vc) {
                const inp = (vc.inputs || []).find((i) => i.name === "video_" + s);
                wired = !!(inp && inp.link != null);
                if (wired) {
                    const ex = exact.vids[s];
                    if (ex && ex.ref) { url = viewUrl(ex.ref); }
                    else {
                        const f = findFile(vc, "video_" + s, VID_RE, ["video", "file", "filename"]);
                        if (f) { url = viewUrl(f.spec); approx = f.approx; }
                    }
                }
            }
            S.vids[s] = wired ? { url, approx, exact: !!(exact.vids[s] && url === viewUrl(exact.vids[s].ref || {})), meta: exact.vids[s] || null } : null;
            setSrc(vEls[s], wired ? url : null);
        }
        for (const s of [1, 2, 3, 4]) {
            let url = null, wired = false;
            if (ic) {
                const inp = (ic.inputs || []).find((i) => i.name === "image_" + s);
                wired = !!(inp && inp.link != null);
                if (wired) {
                    const ex = exact.pics[s];
                    if (ex && ex.ref) url = viewUrl(ex.ref);
                    else {
                        const f = findFile(ic, "image_" + s, IMG_RE, ["image"]);
                        if (f) url = viewUrl(f.spec);
                    }
                }
            }
            S.pics[s] = wired ? { url } : null;
            if (wired && url) setSrc(imgEl(s), url);
        }
        refreshMeta();
    }
    function refreshMeta() {
        for (const s of [1, 2, 3]) {
            const v = S.vids[s];
            if (!v) continue;
            const m = v.meta, e = vEls[s];
            v.dur = m && v.exact ? m.dur : (isFinite(e.duration) ? e.duration : 0);
            v.fps = m ? m.fps : 0;
            v.w = (m && m.w) || e.videoWidth || 16;
            v.h = (m && m.h) || e.videoHeight || 9;
        }
        updateUI();
    }
    const dur1 = () => (S.vids[1] && S.vids[1].dur) || 15;
    const aspect1 = () => (S.vids[1] ? S.vids[1].w / Math.max(1, S.vids[1].h) : 16 / 9);

    // ---------- время и воспроизведение / time & playback ----------
    let mode = "edit";
    let curT = 0;
    let playing = false;
    let dirty = true;
    let sel = null;            // id выбранного события / selected event id
    let cropMode = false;      // ✂ правим участок источника / editing the source piece
    let shutter = 0.5;

    const evById = (id) => state.events.find((e) => e.id === id) || null;
    const selEv = () => (sel ? evById(sel) : null);
    const master = () => (mode === "edit" ? vEls[1] : rEl);
    const hasMaster = () => !!(master().__url && master().readyState >= 1);

    function setMode(m) {
        if ((m === "result" || m === "compare") && !S.result) return;
        pause();
        mode = m;
        cropMode = false;
        for (const k in modeBtns) modeBtns[k].classList.toggle("on", k === m);
        seek(curT);
        updateUI();
    }
    function seek(t) {
        curT = clamp(t, 0, dur1());
        for (const e of [vEls[1], rEl]) if (e.__url && e.readyState >= 1) { try { e.currentTime = Math.min(curT, (e.duration || 1e9) - 0.001); } catch (x) { /* ок */ } }
        syncInserts(true);
        dirty = true;
    }
    function play() {
        if (!hasMaster()) { setStatus(T("Нечего играть: подключите видео 1", "Nothing to play: connect video 1"), "warn"); return; }
        const m = master();
        if (curT >= dur1() - 0.05) seek(0);
        vEls[1].muted = mode !== "edit";
        rEl.muted = mode === "edit";
        const p = m.play();
        if (p && p.catch) p.catch(() => {});
        playing = true;
        playBtn.textContent = "⏸";
        loop();
    }
    function pause() {
        playing = false;
        playBtn.textContent = "▶";
        for (const e of [vEls[1], vEls[2], vEls[3], rEl]) { try { e.pause(); } catch (x) { /* ок */ } }
        dirty = true;
    }
    playBtn.onclick = () => (playing ? pause() : play());
    for (const e of [vEls[1], rEl]) e.addEventListener("ended", () => { if (master() === e) pause(); });

    // фаза события — как в ve_core.py / event phase, same as ve_core.py
    function phase(ev, t) {
        const t0 = ev.t, t1 = ev.t + ev.dur;
        if (t < t0 || t >= t1) return null;
        const din = ev.tin === "cut" ? 0 : Math.min(ev.din, ev.dur), dout = ev.tout === "cut" ? 0 : Math.min(ev.dout, ev.dur);
        const k = din + dout > ev.dur && din + dout > 0 ? ev.dur / (din + dout) : 1;
        if (din > 0 && t < t0 + din * k) return ["in", (t - t0) / (din * k)];
        if (dout > 0 && t >= t1 - dout * k) return ["out", (t1 - t) / (dout * k)];
        return ["hold", 1];
    }
    function envelope(ev, t) {
        const ph = phase(ev, t);
        if (!ph) return 0;
        return ph[0] === "hold" ? 1 : smooth(ph[1]);
    }
    // врезки идут следом за главным видео / inserts follow the master clock
    function syncInserts(force) {
        if (mode !== "edit") { for (const s of [2, 3]) try { vEls[s].pause(); } catch (e) { /* ок */ } return; }
        const want = { 2: null, 3: null };
        let soundEnv = 0;
        for (const ev of state.events) {
            if (ev.kind !== "insert" || ev.off) continue;
            const ph = phase(ev, curT);
            if (!ph) continue;
            want[ev.src] = { t: ev.s + (curT - ev.t) * (ev.speed || 1), ev };
            if (ev.sound) soundEnv = Math.max(soundEnv, envelope(ev, curT));
        }
        if (!want[2] && !want[3] && cropMode && selEv()?.kind === "insert") want[selEv().src] = { t: selEv().s, ev: selEv() };
        for (const s of [2, 3]) {
            const e = vEls[s], w = want[s];
            if (!e.__url || e.readyState < 1) continue;
            if (!w) { if (!e.paused) e.pause(); continue; }
            const tt = clamp(w.t, 0, Math.max(0, (e.duration || 0) - 0.05));
            if (playing) {
                e.playbackRate = clamp(w.ev.speed || 1, 0.25, 4);
                e.muted = !w.ev.sound;
                e.volume = clamp(envelope(w.ev, curT), 0, 1);
                if (Math.abs(e.currentTime - tt) > 0.2 || force) e.currentTime = tt;
                if (e.paused) { const p = e.play(); if (p && p.catch) p.catch(() => {}); }
            } else {
                if (!e.paused) e.pause();
                if (Math.abs(e.currentTime - tt) > 0.02) e.currentTime = tt;
            }
        }
        vEls[1].volume = clamp(1 - soundEnv, 0, 1);
    }

    // ---------- рисование кадра / drawing ----------
    const g = cv.getContext("2d");
    const lay = document.createElement("canvas");
    const lg = lay.getContext("2d");
    const msk = document.createElement("canvas");
    const mg = msk.getContext("2d");
    let fr = { x: 0, y: 0, w: 1, h: 1 };       // где кадр на холсте (CSS px) / frame rect

    function layoutCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(10, view.clientWidth), h = Math.max(10, view.clientHeight);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        let a = aspect1();
        if (cropMode && selEv()) a = srcAspect(selEv());
        let fw = w - 16, fh = fw / a;
        if (fh > h - 16) { fh = h - 16; fw = fh * a; }
        fr = { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
        return { w, h };
    }

    function srcEl(ev) {
        if (ev.kind === "picture") { const im = imgEls[ev.src]; return im && im.complete && im.naturalWidth ? im : null; }
        const e = vEls[ev.src];
        return e.__url && e.readyState >= 2 ? e : null;
    }
    function srcAspect(ev) {
        const s = srcEl(ev);
        if (!s) return 16 / 9;
        const w = s.naturalWidth || s.videoWidth || 16, h = s.naturalHeight || s.videoHeight || 9;
        return w / Math.max(1, h);
    }

    // слой события в размере кадра / the event layer at frame size
    function drawLayer(ev, alphaKind, p, entering) {
        const s = srcEl(ev);
        if (!s) return false;
        const W = Math.max(2, Math.round(fr.w)), H = Math.max(2, Math.round(fr.h));
        if (lay.width !== W || lay.height !== H) { lay.width = W; lay.height = H; }
        lg.setTransform(1, 0, 0, 1, 0, 0);
        lg.globalCompositeOperation = "source-over";
        lg.globalAlpha = 1;
        lg.clearRect(0, 0, W, H);
        const sw0 = s.naturalWidth || s.videoWidth, sh0 = s.naturalHeight || s.videoHeight;
        const c = ev.crop || { x: 0, y: 0, w: 1, h: 1 };
        const sx = clamp(c.x, 0, 1) * sw0, sy = clamp(c.y, 0, 1) * sh0;
        const sw = Math.max(2, Math.min(1, c.x + c.w) * sw0 - sx), sh = Math.max(2, Math.min(1, c.y + c.h) * sh0 - sy);
        const b = ev.area || { x: 0, y: 0, w: 1, h: 1 };
        const bx = b.x * W, by = b.y * H, bw = b.w * W, bh = b.h * H;
        const k = ev.fit === "contain" ? Math.min(bw / sw, bh / sh) : Math.max(bw / sw, bh / sh);
        const tw = sw * k, th = sh * k;
        lg.save();
        lg.beginPath(); lg.rect(bx, by, bw, bh); lg.clip();
        lg.drawImage(s, sx, sy, sw, sh, bx + (bw - tw) / 2, by + (bh - th) / 2, tw, th);
        lg.restore();
        // маска области с мягким краем / soft area mask
        if (ev.area) {
            if (msk.width !== W || msk.height !== H) { msk.width = W; msk.height = H; }
            mg.setTransform(1, 0, 0, 1, 0, 0);
            mg.clearRect(0, 0, W, H);
            const fe = (ev.area.feather ?? 0.04) * Math.min(W, H);
            mg.filter = fe > 0.5 ? `blur(${(fe / 2).toFixed(1)}px)` : "none";
            mg.fillStyle = "#fff";
            mg.beginPath();
            const ins = fe * 0.5;
            if (ev.area.shape === "ellipse") mg.ellipse(bx + bw / 2, by + bh / 2, Math.max(1, bw / 2 - ins), Math.max(1, bh / 2 - ins), 0, 0, Math.PI * 2);
            else mg.rect(bx + ins, by + ins, Math.max(1, bw - ins * 2), Math.max(1, bh - ins * 2));
            mg.fill();
            mg.filter = "none";
            lg.globalCompositeOperation = "destination-in";
            lg.drawImage(msk, 0, 0);
        }
        // шторка / wipe
        if (alphaKind === "wipe" && p < 1) {
            const soft = 0.22;
            const grd = lg.createLinearGradient(0, 0, W, 0);
            const edge = p * (1 + soft);
            const a0 = clamp(edge - soft, 0, 1), a1 = clamp(edge, 0, 1);
            if (entering) { grd.addColorStop(0, "#fff"); grd.addColorStop(a0, "#fff"); grd.addColorStop(Math.max(a0, a1), "rgba(255,255,255,0)"); grd.addColorStop(1, "rgba(255,255,255,0)"); }
            else { grd.addColorStop(0, "rgba(255,255,255,0)"); grd.addColorStop(1 - Math.max(a0, a1), "rgba(255,255,255,0)"); grd.addColorStop(1 - a0, "#fff"); grd.addColorStop(1, "#fff"); }
            lg.globalCompositeOperation = "destination-in";
            lg.fillStyle = grd; lg.fillRect(0, 0, W, H);
        }
        lg.globalCompositeOperation = "source-over";
        return true;
    }

    function drawFrame() {
        const { w, h } = layoutCanvas();
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#0b0c10"; g.fillRect(0, 0, w, h);
        const ev = selEv();
        if (cropMode && ev) {
            // кадр источника целиком: выбираем участок / whole source frame: pick the piece
            const s = srcEl(ev);
            if (s) g.drawImage(s, fr.x, fr.y, fr.w, fr.h);
            drawBox(ev.crop || { x: 0, y: 0, w: 1, h: 1, shape: "rect" }, "#ffd24a", "✂");
            return;
        }
        if (mode === "result" || mode === "compare") {
            if (rEl.readyState >= 2) g.drawImage(rEl, fr.x, fr.y, fr.w, fr.h);
            if (mode === "compare" && vEls[1].readyState >= 2) {
                const x = fr.x + fr.w * shutter;
                g.save(); g.beginPath(); g.rect(fr.x, fr.y, x - fr.x, fr.h); g.clip();
                g.drawImage(vEls[1], fr.x, fr.y, fr.w, fr.h);
                g.restore();
                g.fillStyle = "#fff"; g.fillRect(x - 1, fr.y, 2, fr.h);
                g.beginPath(); g.arc(x, fr.y + fr.h / 2, 9, 0, Math.PI * 2); g.fill();
                g.fillStyle = "#6b4fb3"; g.font = "bold 10px Segoe UI, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
                g.fillText("⇔", x, fr.y + fr.h / 2 + 1);
                g.textAlign = "left"; g.textBaseline = "alphabetic";
                g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(fr.x + 6, fr.y + fr.h - 22, 80, 16); g.fillRect(fr.x + fr.w - 86, fr.y + fr.h - 22, 80, 16);
                g.fillStyle = "#fff"; g.font = "bold 10px Segoe UI, Arial";
                g.fillText(T("До", "Before"), fr.x + 12, fr.y + fr.h - 10); g.fillText(T("После", "After"), fr.x + fr.w - 80, fr.y + fr.h - 10);
            }
            return;
        }
        // монтаж вживую / live edit
        const b = vEls[1];
        if (b.__url && b.readyState >= 2) g.drawImage(b, fr.x, fr.y, fr.w, fr.h);
        else { g.fillStyle = "#15171c"; g.fillRect(fr.x, fr.y, fr.w, fr.h); }
        for (const e of state.events) {
            if (e.off) continue;
            const ph = phase(e, curT);
            if (!ph) continue;
            const [stage, p] = ph;
            const kind = stage === "in" ? e.tin : stage === "out" ? e.tout : "cut";
            if (!drawLayer(e, kind, p, stage !== "out")) continue;
            let a = 1, dark = 0;
            if (kind === "dissolve" || kind === "reveal") a = smooth(p);
            else if (kind === "dip") { if (p < 0.5) { a = 0; dark = smooth(p * 2); } else { a = smooth((p - 0.5) * 2); dark = 1 - a; } }
            if (dark > 0) {
                g.save(); g.globalAlpha = dark; g.fillStyle = "#000";
                if (e.area) {
                    const A = e.area; g.beginPath();
                    if (A.shape === "ellipse") g.ellipse(fr.x + (A.x + A.w / 2) * fr.w, fr.y + (A.y + A.h / 2) * fr.h, A.w / 2 * fr.w, A.h / 2 * fr.h, 0, 0, Math.PI * 2);
                    else g.rect(fr.x + A.x * fr.w, fr.y + A.y * fr.h, A.w * fr.w, A.h * fr.h);
                    g.fill();
                } else g.fillRect(fr.x, fr.y, fr.w, fr.h);
                g.restore();
            }
            g.save(); g.globalAlpha = a * (e.opacity ?? 1);
            g.drawImage(lay, fr.x, fr.y, fr.w, fr.h);
            g.restore();
        }
        if (ev && ev.area && !playing) drawBox(ev.area, ev.kind === "picture" ? COL.picture : COL.insert, ev.kind === "picture" ? "🖼" : "🎬");
    }

    // рамка области с ручками / area box with handles
    const HANDLE = 7;
    function boxPx(b) { return { x: fr.x + b.x * fr.w, y: fr.y + b.y * fr.h, w: b.w * fr.w, h: b.h * fr.h }; }
    function drawBox(b, color, icon) {
        const r = boxPx(b);
        g.save();
        g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([6, 4]);
        g.beginPath();
        if (b.shape === "ellipse") g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
        g.rect(r.x, r.y, r.w, r.h);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = color;
        for (const [hx, hy] of corners(r)) g.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
        g.font = "bold 11px Segoe UI, Arial"; g.fillText(icon, r.x + 4, r.y + 14);
        g.restore();
    }
    const corners = (r) => [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];

    // мышь на кадре / mouse on the frame
    let drag = null;
    const editBox = () => {
        const ev = selEv();
        if (!ev || playing || mode !== "edit") return null;
        if (cropMode) return { ev, key: "crop", b: ev.crop || { x: 0, y: 0, w: 1, h: 1 } };
        return ev.area ? { ev, key: "area", b: ev.area } : null;
    };
    cv.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const rc = cv.getBoundingClientRect();
        const mx = e.clientX - rc.left, my = e.clientY - rc.top;
        if (mode === "compare") { drag = { kind: "shutter" }; shutter = clamp((mx - fr.x) / fr.w, 0, 1); dirty = true; cv.setPointerCapture(e.pointerId); return; }
        const eb = editBox();
        if (!eb) return;
        const r = boxPx(eb.b);
        let hit = -1;
        corners(r).forEach(([hx, hy], i) => { if (Math.abs(mx - hx) <= HANDLE + 3 && Math.abs(my - hy) <= HANDLE + 3) hit = i; });
        if (hit < 0 && !(mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h)) return;
        drag = { kind: "box", eb, corner: hit, mx, my, b0: Object.assign({}, eb.b) };
        cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
        const rc = cv.getBoundingClientRect();
        const mx = e.clientX - rc.left, my = e.clientY - rc.top;
        if (!drag) {
            const eb = editBox();
            let cur = "default";
            if (mode === "compare") cur = "ew-resize";
            else if (eb) {
                const r = boxPx(eb.b);
                if (corners(r).some(([hx, hy]) => Math.abs(mx - hx) <= HANDLE + 3 && Math.abs(my - hy) <= HANDLE + 3)) cur = "nwse-resize";
                else if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) cur = "move";
            }
            cv.style.cursor = cur;
            return;
        }
        if (drag.kind === "shutter") { shutter = clamp((mx - fr.x) / fr.w, 0, 1); dirty = true; return; }
        const dx = (mx - drag.mx) / fr.w, dy = (my - drag.my) / fr.h;
        const b0 = drag.b0, nb = Object.assign({}, b0);
        const lim = drag.eb.key === "crop";
        if (drag.corner < 0) { nb.x = b0.x + dx; nb.y = b0.y + dy; }
        else {
            const left = drag.corner === 0 || drag.corner === 2, top = drag.corner === 0 || drag.corner === 1;
            let x0 = b0.x, y0 = b0.y, x1 = b0.x + b0.w, y1 = b0.y + b0.h;
            if (left) x0 += dx; else x1 += dx;
            if (top) y0 += dy; else y1 += dy;
            if (e.shiftKey) { // сохранить пропорцию / keep proportion
                const ar = b0.w / b0.h, nw = Math.abs(x1 - x0);
                const nh = nw / ar;
                if (top) y0 = y1 - nh; else y1 = y0 + nh;
            }
            nb.x = Math.min(x0, x1); nb.y = Math.min(y0, y1);
            nb.w = Math.max(0.03, Math.abs(x1 - x0)); nb.h = Math.max(0.03, Math.abs(y1 - y0));
        }
        if (lim) {
            nb.w = Math.min(1, nb.w); nb.h = Math.min(1, nb.h);
            nb.x = clamp(nb.x, 0, 1 - nb.w); nb.y = clamp(nb.y, 0, 1 - nb.h);
        } else {
            nb.x = clamp(nb.x, -nb.w + 0.03, 0.97); nb.y = clamp(nb.y, -nb.h + 0.03, 0.97);
        }
        drag.eb.ev[drag.eb.key] = nb;
        dirty = true;
    });
    const endDrag = () => { if (drag) { drag = null; save(); renderSide(); } };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    view.addEventListener("pointerenter", () => { view.__hover = true; });
    view.addEventListener("pointerleave", () => { view.__hover = false; });
    window.addEventListener("keydown", (e) => {
        if (!view.__hover || !root.isConnected) return;
        if (e.code === "Space") { e.preventDefault(); e.stopPropagation(); playing ? pause() : play(); }
    }, true);

    // ---------- полоска времени / timeline ----------
    const TL_RULER = 16, LANE_H = 20, TL_PAD = 6;
    let lanes = {};
    function layoutLanes() {
        lanes = {};
        const ends = [];
        const sorted = [...state.events].sort((a, b) => a.t - b.t);
        for (const e of sorted) {
            let L = ends.findIndex((x) => x <= e.t + 1e-6);
            if (L < 0) { L = ends.length; ends.push(0); }
            ends[L] = e.t + e.dur;
            lanes[e.id] = L;
        }
        return Math.max(1, ends.length);
    }
    function tlHeight() { return TL_RULER + 14 + Math.max(2, layoutLanes()) * (LANE_H + 3) + TL_PAD; }
    const tX = (t, w) => 8 + (t / dur1()) * (w - 16);
    const xT = (x, w) => ((x - 8) / (w - 16)) * dur1();

    function drawTimeline() {
        const dpr = window.devicePixelRatio || 1;
        const H = tlHeight();
        tl.style.height = H + "px";
        const w = Math.max(50, tl.clientWidth);
        if (tl.width !== Math.round(w * dpr) || tl.height !== Math.round(H * dpr)) { tl.width = Math.round(w * dpr); tl.height = Math.round(H * dpr); }
        const c = tl.getContext("2d");
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, H);
        // линейка / ruler
        const D = dur1();
        const step = D <= 12 ? 1 : D <= 30 ? 2 : D <= 90 ? 5 : D <= 300 ? 15 : 60;
        c.fillStyle = "#7f8496"; c.font = "9px Segoe UI, Arial"; c.strokeStyle = "#3a3d47";
        for (let s = 0; s <= D + 1e-6; s += step) {
            const x = tX(s, w);
            c.beginPath(); c.moveTo(x + 0.5, TL_RULER - 5); c.lineTo(x + 0.5, H); c.stroke();
            c.fillText(s >= 60 ? fmtT(s).replace(/\.\d$/, "") : s + "s", x + 2, 10);
        }
        // дорожка видео 1 / video 1 track
        const y1 = TL_RULER;
        c.fillStyle = S.vids[1] ? "#2a3550" : "#25272e";
        c.fillRect(tX(0, w), y1, tX(D, w) - tX(0, w), 11);
        c.fillStyle = "#cfd8f0"; c.font = "bold 9px Segoe UI, Arial";
        c.fillText(S.vids[1] ? T("Видео 1 — оригинал", "Video 1 — original") + (S.vids[1].approx ? " ≈" : "") : T("Видео 1 не подключено", "Video 1 not connected"), tX(0, w) + 4, y1 + 9);
        // события / events
        for (const e of state.events) {
            const L = lanes[e.id] || 0;
            const y = TL_RULER + 14 + L * (LANE_H + 3);
            const x0 = tX(e.t, w), x1 = Math.max(x0 + 4, tX(e.t + e.dur, w));
            const col = COL[e.kind];
            c.globalAlpha = e.off ? 0.35 : 1;
            c.fillStyle = col;
            c.beginPath(); c.roundRect ? c.roundRect(x0, y, x1 - x0, LANE_H, 4) : c.rect(x0, y, x1 - x0, LANE_H); c.fill();
            // переходы — светлые клинья / transitions as light wedges
            const kIn = e.tin === "cut" ? 0 : e.din, kOut = e.tout === "cut" ? 0 : e.dout;
            const sc = kIn + kOut > e.dur && kIn + kOut > 0 ? e.dur / (kIn + kOut) : 1;
            c.fillStyle = "rgba(255,255,255,.28)";
            if (kIn > 0) { const xi = tX(e.t + kIn * sc, w); c.beginPath(); c.moveTo(x0, y + LANE_H); c.lineTo(xi, y); c.lineTo(x0, y); c.fill(); }
            if (kOut > 0) { const xo = tX(e.t + e.dur - kOut * sc, w); c.beginPath(); c.moveTo(x1, y + LANE_H); c.lineTo(xo, y); c.lineTo(x1, y); c.fill(); }
            if (e.id === sel) { c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(x0 + 1, y + 1, x1 - x0 - 2, LANE_H - 2); }
            c.fillStyle = "#fff"; c.font = "bold 10px Segoe UI, Arial";
            const label = (e.kind === "picture" ? "🖼 " + e.src : "🎬 " + T("видео", "video") + " " + e.src) + (e.area ? " ▣" : "") + (e.sound ? " 🔊" : "");
            c.save(); c.beginPath(); c.rect(x0, y, x1 - x0, LANE_H); c.clip();
            c.fillText(label, x0 + 5, y + 14);
            c.restore();
            c.globalAlpha = 1;
        }
        // бегунок / playhead
        const px = tX(curT, w);
        c.fillStyle = "#ff5a5a"; c.fillRect(px - 1, 0, 2, H);
        c.beginPath(); c.moveTo(px - 5, 0); c.lineTo(px + 5, 0); c.lineTo(px, 6); c.fill();
    }
    let tdrag = null;
    function tlHit(mx, my, w) {
        for (const e of [...state.events].reverse()) {
            const L = lanes[e.id] || 0;
            const y = TL_RULER + 14 + L * (LANE_H + 3);
            const x0 = tX(e.t, w), x1 = Math.max(x0 + 4, tX(e.t + e.dur, w));
            if (my >= y && my <= y + LANE_H && mx >= x0 - 4 && mx <= x1 + 4) {
                const edge = mx - x0 < 7 ? "l" : x1 - mx < 7 ? "r" : "m";
                return { e, edge };
            }
        }
        return null;
    }
    tl.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation();
        const rc = tl.getBoundingClientRect(), w = rc.width;
        const mx = ev.clientX - rc.left, my = ev.clientY - rc.top;
        const hit = my > TL_RULER + 12 ? tlHit(mx, my, w) : null;
        if (hit) {
            select(hit.e.id);
            tdrag = { kind: hit.edge, e: hit.e, t0: hit.e.t, d0: hit.e.dur, x: mx, moved: false };
        } else {
            if (my > TL_RULER + 12) select(null);
            pause();
            seek(xT(mx, w));
            tdrag = { kind: "seek" };
        }
        tl.setPointerCapture(ev.pointerId);
    });
    tl.addEventListener("pointermove", (ev) => {
        const rc = tl.getBoundingClientRect(), w = rc.width;
        const mx = ev.clientX - rc.left, my = ev.clientY - rc.top;
        if (!tdrag) {
            const hit = my > TL_RULER + 12 ? tlHit(mx, my, w) : null;
            tl.style.cursor = hit ? (hit.edge === "m" ? "grab" : "ew-resize") : "pointer";
            return;
        }
        if (tdrag.kind === "seek") { seek(xT(mx, w)); return; }
        const dt = xT(mx, w) - xT(tdrag.x, w);
        const e = tdrag.e, D = dur1();
        const snap = (v) => (ev.shiftKey ? v : Math.round(v * 10) / 10);
        if (tdrag.kind === "m") e.t = snap(clamp(tdrag.t0 + dt, 0, Math.max(0, D - 0.1)));
        else if (tdrag.kind === "l") { const end = tdrag.t0 + tdrag.d0; e.t = snap(clamp(tdrag.t0 + dt, 0, end - 0.2)); e.dur = end - e.t; }
        else e.dur = snap(clamp(tdrag.d0 + dt, 0.2, Math.max(0.2, D - e.t)));
        tdrag.moved = true;
        dirty = true;
        renderSideValues();
    });
    const tEnd = () => { if (tdrag) { if (tdrag.moved) save(); tdrag = null; } };
    tl.addEventListener("pointerup", tEnd);
    tl.addEventListener("pointercancel", tEnd);

    // ---------- события: добавить / выбрать / удалить ----------
    function select(id) {
        sel = id;
        cropMode = false;
        dirty = true;
        renderSide();
    }
    function addEvent(kind) {
        if (kind === "picture" && !Object.values(S.pics).some(Boolean)) {
            setStatus(T("Сначала подключите картинку к кубику 🖼 Картинки ×4", "First connect a picture to the 🖼 Pictures ×4 cube"), "warn");
            return;
        }
        if (kind === "insert" && !S.vids[2] && !S.vids[3]) {
            setStatus(T("Сначала подключите видео 2 к кубику 🎬 Видео ×3", "First connect video 2 to the 🎬 Video ×3 cube"), "warn");
            return;
        }
        if (mode !== "edit") setMode("edit");
        const D = dur1();
        const src = kind === "picture" ? Number(Object.keys(S.pics).find((k) => S.pics[k])) : (S.vids[2] ? 2 : 3);
        const t = clamp(Math.round(curT * 10) / 10, 0, Math.max(0, D - 0.5));
        const ev = {
            id: newId(), kind, src, t, dur: Math.min(kind === "picture" ? 4 : 3, Math.max(0.5, D - t)),
            s: 0, tin: "dissolve", din: 1, tout: "dissolve", dout: 1,
            area: null, crop: null, fit: "cover", match: false, match_k: 0.7, opacity: 1, sound: false, speed: 1,
        };
        state.events.push(ev);
        save();
        select(ev.id);
        setStatus(T("Событие добавлено. Тяните его на полоске, настройте справа", "Event added. Drag it on the strip, set it up on the right"), "ok");
    }
    addPic.onclick = () => addEvent("picture");
    addIns.onclick = () => addEvent("insert");
    expBtn.onclick = () => {
        node.properties.neron_expert = !node.properties.neron_expert;
        root.classList.toggle("expert", !!node.properties.neron_expert);
        expBtn.classList.toggle("on", !!node.properties.neron_expert);
    };

    // ---------- правая панель / side panel ----------
    let valueHooks = [];
    function renderSideValues() { for (const f of valueHooks) f(); }
    function numIn(get, setv, step, min, max, tip) {
        const i = el("input", "nve-in");
        i.type = "number"; i.step = step; if (min != null) i.min = min; if (max != null) i.max = max;
        i.title = tip || "";
        const upd = () => { if (document.activeElement !== i) i.value = (Math.round(get() * 100) / 100).toString(); };
        upd(); valueHooks.push(upd);
        i.addEventListener("change", () => { const v = parseFloat(i.value); if (isFinite(v)) { setv(clamp(v, min ?? -1e9, max ?? 1e9)); save(); dirty = true; renderSideValues(); } });
        i.addEventListener("pointerdown", (e) => e.stopPropagation());
        return i;
    }
    function seg(opts, get, setv) {
        const s = el("div", "nve-seg");
        const bs = opts.map(([v, label, tip, disabled]) => {
            const b = el("button", "", label);
            if (tip) b.title = tip;
            if (disabled) b.disabled = true;
            b.onclick = () => { setv(v); save(); dirty = true; renderSide(); };
            s.appendChild(b);
            return [v, b];
        });
        for (const [v, b] of bs) b.classList.toggle("on", get() === v);
        return s;
    }
    function slider(label, get, setv, min, max, step, tip, fmt) {
        const r = el("div", "nve-row nve-expert");
        const l = el("span", "nve-lbl", label);
        l.title = tip || "";
        const i = el("input", "nve-range");
        i.type = "range"; i.min = min; i.max = max; i.step = step; i.value = get(); i.title = tip || "";
        const v = el("span", "nve-small", fmt ? fmt(get()) : String(get()));
        i.addEventListener("input", () => { setv(parseFloat(i.value)); v.textContent = fmt ? fmt(get()) : String(get()); dirty = true; });
        i.addEventListener("change", save);
        i.addEventListener("pointerdown", (e) => e.stopPropagation());
        r.append(l, i, v);
        return r;
    }
    function check(label, get, setv, tip, cls) {
        const l = el("label", "nve-chk" + (cls ? " " + cls : ""));
        const c = el("input"); c.type = "checkbox"; c.checked = !!get();
        c.onchange = () => { setv(c.checked); save(); dirty = true; renderSide(); };
        l.title = tip || "";
        l.append(c, document.createTextNode(label));
        return l;
    }
    function trSelect(get, setv) {
        const s = el("select", "nve-sel");
        for (const [k, ru, en] of TR) { const o = el("option", "", T(ru, en)); o.value = k; o.title = TR_TIP[k]; s.appendChild(o); }
        s.value = get();
        s.title = TR_TIP[get()] || "";
        s.onchange = () => { setv(s.value); save(); dirty = true; renderSide(); };
        s.addEventListener("pointerdown", (e) => e.stopPropagation());
        return s;
    }

    function renderSide() {
        valueHooks = [];
        side.innerHTML = "";
        const ev = selEv();
        if (ev) side.appendChild(eventPanel(ev));
        else side.appendChild(globalPanel());
        side.appendChild(sourcesPanel());
        updateUI();
    }

    function eventPanel(ev) {
        const box = el("div", "nve-sec");
        const h = el("div", "nve-h", ev.kind === "picture" ? "🖼 " + T("КАРТИНКА", "PICTURE") : "🎬 " + T("ВРЕЗКА", "INSERT"));
        h.appendChild(el("span", "nve-sp"));
        const offB = el("button", "nve-btn sm", ev.off ? "🚫" : "👁");
        offB.title = T("Выключить/включить событие (не удаляя)", "Disable/enable the event (keeps it)");
        offB.onclick = () => { ev.off = !ev.off; save(); dirty = true; renderSide(); };
        const delB = el("button", "nve-btn sm warn", "🗑");
        delB.title = T("Удалить событие", "Delete the event");
        delB.onclick = () => { state.events = state.events.filter((x) => x !== ev); sel = null; save(); dirty = true; renderSide(); };
        const doneB = el("button", "nve-btn sm", "✓");
        doneB.title = T("Готово — к общим настройкам", "Done — back to general settings");
        doneB.onclick = () => select(null);
        h.append(offB, delB, doneB);
        box.appendChild(h);

        // что / source
        const r1 = el("div", "nve-row");
        r1.appendChild(el("span", "nve-lbl", ev.kind === "picture" ? T("Картинка", "Picture") : T("Из видео", "From video")));
        if (ev.kind === "picture") r1.appendChild(seg([1, 2, 3, 4].map((n) => [n, String(n), "", !S.pics[n]]), () => ev.src, (v) => { ev.src = v; }));
        else r1.appendChild(seg([2, 3].map((n) => [n, String(n), "", !S.vids[n]]), () => ev.src, (v) => { ev.src = v; }));
        box.appendChild(r1);

        // когда / when
        const r2 = el("div", "nve-row");
        r2.appendChild(el("span", "nve-lbl", T("Начало, с", "Start, s")));
        r2.appendChild(numIn(() => ev.t, (v) => { ev.t = v; }, 0.1, 0, 36000, T("С какой секунды видео 1", "From which second of video 1")));
        const goB = el("button", "nve-btn sm", "⏱");
        goB.title = T("Поставить начало на бегунок", "Set the start at the playhead");
        goB.onclick = () => { ev.t = Math.round(curT * 10) / 10; save(); dirty = true; renderSideValues(); };
        r2.appendChild(goB);
        box.appendChild(r2);
        const r3 = el("div", "nve-row");
        r3.appendChild(el("span", "nve-lbl", T("Длина, с", "Length, s")));
        r3.appendChild(numIn(() => ev.dur, (v) => { ev.dur = v; }, 0.1, 0.2, 36000, T("Сколько секунд держится", "How many seconds it stays")));
        box.appendChild(r3);
        if (ev.kind === "insert") {
            const r4 = el("div", "nve-row");
            r4.appendChild(el("span", "nve-lbl", T("Источник с, с", "Source from, s")));
            r4.appendChild(numIn(() => ev.s, (v) => { ev.s = v; }, 0.1, 0, 36000, T("С какой секунды видео-источника брать кусок", "From which second of the source video")));
            box.appendChild(r4);
        }

        // переходы / transitions
        const r5 = el("div", "nve-row");
        r5.appendChild(el("span", "nve-lbl", T("Появление", "Appears")));
        r5.appendChild(trSelect(() => ev.tin, (v) => { ev.tin = v; }));
        if (ev.tin !== "cut") r5.appendChild(numIn(() => ev.din, (v) => { ev.din = v; }, 0.1, 0, 30, T("Длина перехода, с", "Transition length, s")));
        box.appendChild(r5);
        const r6 = el("div", "nve-row");
        r6.appendChild(el("span", "nve-lbl", T("Уход", "Leaves")));
        r6.appendChild(trSelect(() => ev.tout, (v) => { ev.tout = v; }));
        if (ev.tout !== "cut") r6.appendChild(numIn(() => ev.dout, (v) => { ev.dout = v; }, 0.1, 0, 30, T("Длина перехода, с", "Transition length, s")));
        box.appendChild(r6);

        // где / where
        const r7 = el("div", "nve-row");
        r7.appendChild(el("span", "nve-lbl", T("Где", "Where")));
        r7.appendChild(seg([
            ["full", T("Весь кадр", "Full"), T("Во весь кадр", "Full frame")],
            ["area", T("Область", "Area"), T("Только в области: двигайте и тяните её на кадре. Shift — сохранить пропорцию", "Only in an area: move and resize it on the frame. Shift keeps proportion")],
        ], () => (ev.area ? "area" : "full"), (v) => {
            if (v === "full") ev.area = null;
            else if (!ev.area) ev.area = { x: 0.3, y: 0.15, w: 0.4, h: 0.5, shape: "rect", feather: 0.04 };
        }));
        box.appendChild(r7);
        if (ev.area) {
            const r8 = el("div", "nve-row");
            r8.appendChild(el("span", "nve-lbl", T("Форма", "Shape")));
            r8.appendChild(seg([["rect", "▭ " + T("Прямоуг.", "Rect")], ["ellipse", "◯ " + T("Овал", "Oval")]], () => ev.area.shape, (v) => { ev.area.shape = v; }));
            box.appendChild(r8);
            box.appendChild(slider(T("Мягкий край", "Soft edge"), () => ev.area.feather ?? 0.04, (v) => { ev.area.feather = v; }, 0, 0.3, 0.01,
                T("Насколько мягко край области переходит в оригинал", "How softly the area edge blends into the original"), (v) => Math.round(v * 100) + "%"));
        }
        // участок источника / source piece
        const r9 = el("div", "nve-row");
        const cropB = el("button", "nve-btn sm" + (cropMode ? " on" : ""), "✂ " + T("Участок", "Piece"));
        cropB.title = T("Какой кусок картинки или видео-источника взять: рамка на кадре источника", "Which part of the source to take: a box on the source frame");
        cropB.onclick = () => { if (mode !== "edit") setMode("edit"); pause(); cropMode = !cropMode; if (cropMode && !ev.crop) ev.crop = { x: 0, y: 0, w: 1, h: 1 }; dirty = true; syncInserts(true); renderSide(); };
        r9.appendChild(cropB);
        if (ev.crop) {
            const rb = el("button", "nve-btn sm", "↺");
            rb.title = T("Взять источник целиком", "Take the whole source");
            rb.onclick = () => { ev.crop = null; cropMode = false; save(); dirty = true; renderSide(); };
            r9.appendChild(rb);
        }
        r9.appendChild(el("span", "nve-small", cropMode ? T("рамка на кадре источника", "box on the source frame") : ev.crop ? T("взят участок", "piece selected") : T("источник целиком", "whole source")));
        box.appendChild(r9);

        // цвет и звук / colour and sound
        const r10 = el("div", "nve-row");
        r10.appendChild(check(T("Подогнать цвет", "Match colour"), () => ev.match, (v) => { ev.match = v; },
            T("Яркость и тон вставки подстроятся под сцену видео 1 — чтобы не выглядело наклеенным. Видно в «Результате»", "Brightness and tone adapt to video 1 so it doesn't look pasted. Visible in “Result”")));
        if (ev.kind === "insert") r10.appendChild(check("🔊 " + T("Звук врезки", "Insert sound"), () => ev.sound, (v) => { ev.sound = v; },
            T("Звук врезки плавно перехватит звук видео 1 на её время", "The insert's sound smoothly takes over for its duration")));
        box.appendChild(r10);

        // эксперт / expert
        const rf = el("div", "nve-row nve-expert");
        rf.appendChild(el("span", "nve-lbl", T("Уложить", "Fit")));
        rf.appendChild(seg([["cover", T("Заполнить", "Fill"), T("Заполнить всю область (края обрежутся)", "Fill the whole area (edges are cut)")],
            ["contain", T("Вписать", "Fit in"), T("Вписать целиком (по краям — оригинал)", "Fit entirely (original shows at the sides)")]], () => ev.fit, (v) => { ev.fit = v; }));
        box.appendChild(rf);
        box.appendChild(slider(T("Прозрачность", "Opacity"), () => ev.opacity ?? 1, (v) => { ev.opacity = v; }, 0, 1, 0.01,
            T("Насколько плотно слой лежит поверх", "How solid the layer is"), (v) => Math.round(v * 100) + "%"));
        if (ev.match) box.appendChild(slider(T("Сила цвета", "Colour strength"), () => ev.match_k ?? 0.7, (v) => { ev.match_k = v; }, 0, 1, 0.05,
            T("Насколько сильно подгонять цвет", "How strongly to match colour"), (v) => Math.round(v * 100) + "%"));
        if (ev.kind === "insert") box.appendChild(slider(T("Скорость", "Speed"), () => ev.speed ?? 1, (v) => { ev.speed = v; }, 0.25, 4, 0.05,
            T("Скорость врезки: 0.5 — замедленно, 2 — быстрее", "Insert speed: 0.5 slow motion, 2 faster"), (v) => "×" + v.toFixed(2)));
        return box;
    }

    function globalPanel() {
        const box = el("div", "nve-sec");
        box.appendChild(el("div", "nve-h", "🎚 " + T("ОБЩЕЕ", "GENERAL")));
        if (!state.events.length) {
            box.appendChild(el("div", "nve-small", T("Поставьте бегунок на нужную секунду и нажмите «+ 🖼 Картинка» или «+ 🎬 Врезка».",
                "Put the playhead where you need and press “+ 🖼 Picture” or “+ 🎬 Insert”.")));
        } else {
            box.appendChild(el("div", "nve-small", T(`Событий: ${state.events.length}. Клик по событию на полоске — его настройки.`,
                `Events: ${state.events.length}. Click an event on the strip for its settings.`)));
        }
        const r1 = el("div", "nve-row");
        r1.appendChild(el("span", "nve-lbl", "🔊 " + T("Звук", "Sound")));
        box.appendChild(r1);
        const extWired = !!upstream(node, "audio");
        box.appendChild(seg([
            ["main", T("Видео 1", "Video 1"), T("Родной звук видео 1", "Video 1's own sound")],
            ["external", T("Свой", "Own"), T("Звук с провода audio (например, Audio Studio)", "Sound from the audio wire (e.g. Audio Studio)"), !extWired],
            ["mix", T("Смешать", "Mix"), T("Видео 1 + свой звук вместе", "Video 1 + your sound together"), !extWired],
            ["none", T("Без", "None"), T("Без звука", "No sound")],
        ], () => state.audio, (v) => { state.audio = v; }));
        if (!extWired) box.appendChild(el("div", "nve-small", T("«Свой» и «Смешать» — когда подключён провод audio.", "“Own” and “Mix” need the audio wire.")));
        box.appendChild(slider(T("Громк. видео 1", "Video 1 vol"), () => state.main_gain ?? 1, (v) => { state.main_gain = v; }, 0, 2, 0.05, "", (v) => Math.round(v * 100) + "%"));
        box.appendChild(slider(T("Громк. своего", "Own vol"), () => state.ext_gain ?? 1, (v) => { state.ext_gain = v; }, 0, 2, 0.05, "", (v) => Math.round(v * 100) + "%"));
        const r2 = el("div", "nve-row");
        r2.appendChild(check("💾 " + T("Сохранять ролик в output/Neron_Videos", "Save the clip to output/Neron_Videos"), () => state.save !== false, (v) => { state.save = v; },
            T("Пульт сам сохранит готовый ролик в полном качестве. Выключите, если сохраняете через Video Combine", "The pult saves the finished clip at full quality. Turn off if you save via Video Combine")));
        box.appendChild(r2);
        const r3 = el("div", "nve-row nve-expert");
        r3.appendChild(el("span", "nve-lbl", T("fps видео 1", "Video 1 fps")));
        r3.appendChild(numIn(() => state.fps1 || 0, (v) => { state.fps1 = v; }, 0.01, 0, 240,
            T("0 — взять из video_info (обычно так и надо). Своё число — если fps неизвестен", "0 — take from video_info (usually right). A number — if fps is unknown")));
        box.appendChild(r3);
        return box;
    }

    function sourcesPanel() {
        const box = el("div", "nve-sec");
        box.appendChild(el("div", "nve-h", "🔌 " + T("ПОДКЛЮЧЕНО", "CONNECTED")));
        for (const s of [1, 2, 3]) {
            const v = S.vids[s];
            const r = el("div", "nve-src");
            r.appendChild(el("span", "nve-dot" + (v ? " ok" : "")));
            let txt = (s === 1 ? T("Видео 1 (ведущее)", "Video 1 (lead)") : T("Видео", "Video") + " " + s);
            if (v) {
                txt += " · " + (v.dur ? fmtT(v.dur) : "…");
                if (v.fps && v.exact) txt += ` · ${Math.round(v.fps * 100) / 100} fps`;
                if (v.w && v.exact) txt += ` · ${v.w}×${v.h}`;
                if (!v.exact) txt += " · " + T("по файлу ≈", "by file ≈");
                if (!v.url) txt += " · " + T("предпросмотр после Очереди", "preview after Queue");
            } else txt += " — " + T("нет", "none");
            r.appendChild(el("span", "", txt));
            box.appendChild(r);
        }
        const r = el("div", "nve-src");
        r.appendChild(el("span", "nve-lbl", T("Картинки", "Pictures")));
        let any = false;
        for (const s of [1, 2, 3, 4]) {
            if (!S.pics[s]) continue;
            any = true;
            const im = el("img", "nve-thumb");
            if (S.pics[s].url) im.src = S.pics[s].url;
            im.title = T("Картинка", "Picture") + " " + s;
            r.appendChild(im);
        }
        if (!any) r.appendChild(el("span", "nve-small", T("нет", "none")));
        box.appendChild(r);
        if (S.saved) {
            const sv = el("div", "nve-small", "💾 output/" + S.saved.subfolder + "/" + S.saved.filename);
            sv.title = sv.textContent;
            box.appendChild(sv);
        }
        return box;
    }

    // ---------- общий вид / overall UI ----------
    function updateUI() {
        const has1 = !!(S.vids[1] && S.vids[1].url);
        modeBtns.result.disabled = !S.result;
        modeBtns.compare.disabled = !S.result;
        for (const k in modeBtns) modeBtns[k].classList.toggle("on", k === mode);
        addPic.disabled = !Object.values(S.pics).some(Boolean);
        addIns.disabled = !S.vids[2] && !S.vids[3];
        tag.textContent = cropMode ? "✂ " + T("Участок источника", "Source piece")
            : mode === "edit" ? T("Монтаж (примерно)", "Edit (approx.)") : mode === "result" ? T("Результат", "Result") : T("До / После", "Before / After");
        tag.style.display = has1 || mode !== "edit" ? "block" : "none";
        if (!S.vids[1]) {
            empty.innerHTML = T("Подключите кубик <b>🎬 Видео ×3</b> к входу <b>videos</b>,<br>а в кубик — <b>Load Video</b> (видео 1 — ведущее).",
                "Connect the <b>🎬 Video ×3</b> cube to <b>videos</b>,<br>and a <b>Load Video</b> into the cube (video 1 is the lead).");
            empty.style.display = "flex";
        } else if (!has1 && mode === "edit") {
            empty.innerHTML = T("Видео 1 подключено. Нажмите <b>Очередь (Queue)</b> — появится предпросмотр.", "Video 1 is connected. Press <b>Queue</b> to get the preview.");
            empty.style.display = "flex";
        } else empty.style.display = "none";
        dirty = true;
    }

    // ---------- главный цикл / main loop ----------
    let raf = 0;
    function loop() {
        if (raf) return;
        const step = () => {
            raf = 0;
            if (!root.isConnected && !node.graph) return;
            if (playing) {
                const m = master();
                curT = m.currentTime || 0;
                if (mode === "compare" && vEls[1].readyState >= 1 && Math.abs(vEls[1].currentTime - curT) > 0.08) vEls[1].currentTime = curT;
                syncInserts(false);
                dirty = true;
            }
            if (dirty) {
                dirty = false;
                if (!playing) syncInserts(false);
                drawFrame();
                drawTimeline();
                timeLbl.textContent = `${fmtT(curT)} / ${fmtT(dur1())}`;
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
    }

    // ---------- после «Очереди» / after Queue ----------
    node.__nveExecuted = (msg) => {
        if (!msg) return;
        exact.vids = {}; exact.pics = {};
        for (const s of msg.sources || []) exact.vids[s.slot] = { ref: s.ref, fps: s.fps, dur: s.dur, w: s.w, h: s.h, frames: s.frames };
        for (const p of msg.images || []) exact.pics[p.slot] = { ref: p.ref, w: p.w, h: p.h };
        S.result = msg.result || null;
        S.saved = msg.saved || null;
        setSrc(rEl, S.result ? viewUrl(S.result, Date.now()) : null);
        scanSources();
        renderSide();
        const notes = msg.notes || [];
        if (notes.length) setStatus(notes.join(" · "), "warn");
        else setStatus(T("Готово. Вкладка «Результат» — готовый ролик, «До/После» — сравнение.", "Done. “Result” shows the clip, “Before/After” compares."), "ok");
        if (S.result && mode === "edit" && state.events.length) setMode("result");
    };
    node.__nveScan = () => { scanSources(); renderSide(); };
    node.__nveReload = (raw) => {
        try { state = Object.assign(defaultState(), JSON.parse(raw || "{}")); } catch (e) { state = defaultState(); }
        if (!Array.isArray(state.events)) state.events = [];
        state.events.forEach((e) => { if (!e.id) e.id = newId(); });
        sel = null; cropMode = false;
        save(); renderSide();
    };
    node.__nveDispose = () => {
        pause();
        if (raf) cancelAnimationFrame(raf);
        for (const e of [vEls[1], vEls[2], vEls[3], rEl]) { try { e.removeAttribute("src"); e.load(); } catch (x) { /* ок */ } }
    };

    // ---------- DOM-виджет / DOM widget ----------
    const dom = node.addDOMWidget("nve_pult", "nve_pult", root, { serialize: false, hideOnZoom: false });
    makeUserSized(node, dom, root, { minH: 380, autoH: 560, onLayout: () => { dirty = true; } });
    if (!node.properties.neron_manual_size) node.setSize([Math.max(node.size[0], 1040), node.size[1]]);
    new ResizeObserver(() => { dirty = true; }).observe(view);

    setMode("edit");
    renderSide();
    setTimeout(() => { scanSources(); renderSide(); }, 200);
    loop();
}

// ============================================================================
//  Регистрация / registration
// ============================================================================
const CUBES = {
    NeronVEVideos: {
        re: /^(video|audio|info)_(\d)$/, slots: [["video", "IMAGE,VIDEO"], ["audio", "AUDIO"], ["info", "VHS_VIDEOINFO"]], min: 1, max: 3,
        hint: T("видео 1 — ведущее", "video 1 is the lead"), help: HELP_VIDEOS,
        count: (n) => (n ? T(`подключено видео: ${n}`, `videos: ${n}`) : T("видео 1 — ведущее", "video 1 is the lead")),
        tips: {
            video: (g) => (g === 1 ? T("Видео 1 — ведущее, его меняем (IMAGE от Load Video)", "Video 1 — the lead we edit (IMAGE from Load Video)") : T(`Видео ${g} — врезки (IMAGE от Load Video)`, `Video ${g} — inserts (IMAGE from Load Video)`)),
            audio: (g) => T(`Звук видео ${g} — подключится сам`, `Audio of video ${g} — wires itself`),
            info: (g) => T(`video_info видео ${g} — точный fps, подключится сам`, `video_info of video ${g} — exact fps, wires itself`),
        },
    },
    NeronVEImages: {
        re: /^(image)_(\d)$/, slots: [["image", "IMAGE"]], min: 2, max: 4,
        hint: T("рисунки, кадры", "drawings, frames"), help: HELP_IMAGES,
        count: (n) => (n ? T(`подключено картинок: ${n}`, `pictures: ${n}`) : T("рисунки, кадры", "drawings, frames")),
        tips: { image: (g) => T(`Картинка ${g} (Load Image)`, `Picture ${g} (Load Image)`) },
    },
};

// пульт узнаёт, что поменялось в кубиках / the pult learns about cube changes
function pokePults(graph) {
    if (!graph) return;
    for (const n of graph._nodes || graph.nodes || []) if (n.__nveScan) setTimeout(() => n.__nveScan(), 50);
}

app.registerExtension({
    name: "Neron.VideoEditor",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const cfg = CUBES[nodeData.name];
        if (cfg) {
            const onCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onCreated ? onCreated.apply(this, arguments) : undefined;
                setupCube(this, cfg);
                return r;
            };
            const onConn = nodeType.prototype.onConnectionsChange;
            nodeType.prototype.onConnectionsChange = function (type, index, connected) {
                const r = onConn ? onConn.apply(this, arguments) : undefined;
                if (type === 1 && connected && nodeData.name === "NeronVEVideos") {
                    const name = this.inputs?.[index]?.name;
                    setTimeout(() => {
                        this.__nveSync?.();
                        const i = (this.inputs || []).findIndex((x) => x.name === name);
                        if (i >= 0) autoWireVideo(this, i);
                        this.__nveSync?.();
                        pokePults(this.graph);
                    }, 0);
                } else {
                    setTimeout(() => { this.__nveSync?.(); pokePults(this.graph); }, 0);
                }
                return r;
            };
            const onConf = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function () {
                const r = onConf ? onConf.apply(this, arguments) : undefined;
                setTimeout(() => this.__nveSync?.(), 50);
                return r;
            };
            return;
        }
        if (nodeData.name !== "NeronVEPult") return;
        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated ? onCreated.apply(this, arguments) : undefined;
            setupPult(this);
            return r;
        };
        const onExec = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const r = onExec ? onExec.apply(this, arguments) : undefined;
            const list = message && message.neron_ve;
            if (Array.isArray(list) && list.length) this.__nveExecuted?.(list[0]);
            return r;
        };
        const onConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function () {
            const r = onConn ? onConn.apply(this, arguments) : undefined;
            setTimeout(() => this.__nveScan?.(), 50);
            return r;
        };
        const onConf = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            const r = onConf ? onConf.apply(this, arguments) : undefined;
            // монтаж из сохранённой схемы / edit data from the saved workflow
            const jw = (this.widgets || []).find((w) => w.name === "edit_json");
            if (jw && this.__nveReload) this.__nveReload(jw.value);
            setTimeout(() => this.__nveScan?.(), 300);
            return r;
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            this.__nveDispose?.();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
    // загрузчик видео поменял файл — пульт обновит предпросмотр
    async nodeCreated(node) {
        if (!/LoadVideo|LoadImage/i.test(node.comfyClass || node.type || "")) return;
        for (const w of node.widgets || []) {
            const cb = w.callback;
            w.callback = function () { const r = cb ? cb.apply(this, arguments) : undefined; pokePults(node.graph); return r; };
        }
    },
});
