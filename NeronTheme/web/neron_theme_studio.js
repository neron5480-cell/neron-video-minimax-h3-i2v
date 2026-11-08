import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import {
    T, clamp, mix, ROLES, ROLE_IDS, C_KEYS, LIFE_LEVELS, BGFX, BUILTIN, normalizeTheme, generateFromColor, paletteFromImage,
    themeFromPalette, fixReadable, encodeCode, decodeAny, themeFile, toComfyPalette, isLight, hexOk, WIRE_TYPES, WIRE_MODES, wireColor,
} from "./nts_core.js";
import { registerType, setCurrent, setPreview, getApplied, engineState, themeVarsForNode } from "./nts_engine.js";

// ============================================================================
//  Neron Theme 🎨 — нода / the node
//  RU: УСТАНОВИТЬ (библиотека: встроенные, мои, код или файл) · СОЗДАТЬ (из цвета,
//      из картинки, всё вручную в ⚙) · ПОДЕЛИТЬСЯ (код, файл, палитра ComfyUI).
//  EN: INSTALL (library: built-in, mine, code or file) · CREATE (from a color, from a
//      picture, everything by hand in ⚙) · SHARE (code, file, ComfyUI palette).
// ============================================================================

const NODE = "NeronThemeStudio";
const OLD_NODE = "NeronTheme";          // тема Neron Audio Studio (красит только ноды студии)
const DEFAULT_ID = "brown";

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectStyles() {
    if (document.getElementById("nts-styles")) return;
    const s = document.createElement("style");
    s.id = "nts-styles";
    s.textContent = `
.nts-root{box-sizing:border-box;width:100%;padding:10px;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;user-select:none;
  background:var(--nts-panel,#1b1d23);color:var(--nts-text,#d6d8dc);--nts-acc0:var(--nts-acc,#b388ff)}
.nts-wrap{display:flex;flex-direction:column;gap:8px}
.nts-head{display:flex;align-items:center;gap:8px;min-width:0}
.nts-head b{font-size:14px;letter-spacing:1px;white-space:nowrap}
.nts-head .nts-sub{flex:1;min-width:0;font-size:10px;color:var(--nts-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nts-btn{height:24px;padding:0 10px;border:none;border-radius:6px;background:var(--nts-btn,#3a3d46);color:var(--nts-text,#fff);font-size:11px;font-weight:800;
  cursor:pointer;white-space:nowrap;flex:none;letter-spacing:.3px}
.nts-btn:hover{filter:brightness(1.2)}
.nts-btn.on,.nts-btn.acc{background:var(--nts-acc0);color:#111}
.nts-help{display:none;font-size:11px;line-height:1.55;background:var(--nts-card,#22252b);border-radius:7px;padding:8px 10px}
.nts-help b{color:var(--nts-acc0)}
.nts-warn{display:none;font-size:11px;font-weight:700;color:#ffd166;background:rgba(217,167,43,.12);border-radius:6px;padding:6px 8px;line-height:1.45}
.nts-tabs{display:flex;gap:6px}
.nts-tab{flex:1;height:30px;border:1px solid var(--nts-line,#3a3d46);border-radius:8px;background:var(--nts-input,#17181c);color:var(--nts-muted,#9aa0ae);
  font-size:12px;font-weight:900;letter-spacing:.6px;cursor:pointer}
.nts-tab.on{background:var(--nts-acc0);border-color:var(--nts-acc0);color:#111}
.nts-pane{display:flex;flex-direction:column;gap:8px}
.nts-sec{font-size:10px;font-weight:900;letter-spacing:.7px;color:var(--nts-muted,#8b90a0);margin-top:2px}
.nts-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
.nts-card{position:relative;border-radius:9px;padding:5px;cursor:pointer;border:2px solid transparent;background:var(--nts-card,#22252b);display:flex;
  flex-direction:column;gap:4px;transition:transform .12s}
.nts-card:hover{transform:translateY(-2px)}
.nts-card.on{border-color:var(--nts-acc0)}
.nts-card b{font-size:10px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nts-card small{font-size:9px;text-align:center;color:var(--nts-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-3px}
.nts-prev{position:relative;height:56px;border-radius:6px;overflow:hidden}
.nts-prev i{position:absolute;border-radius:3px;display:block}
.nts-x{position:absolute;top:3px;right:3px;width:18px;height:18px;border:none;border-radius:5px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;
  cursor:pointer;display:none;padding:0;line-height:18px}
.nts-card:hover .nts-x{display:block}
.nts-x.armed{display:block;background:#c0392b;width:auto;padding:0 5px}
.nts-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nts-lbl{font-size:10px;font-weight:800;color:var(--nts-muted,#8b90a0);letter-spacing:.4px;white-space:nowrap}
.nts-in{flex:1;min-width:80px;height:24px;box-sizing:border-box;background:var(--nts-input,#17181c);color:var(--nts-text,#ddd);border:1px solid var(--nts-line,#3a3d46);
  border-radius:5px;font-size:11px;padding:0 7px;outline:none}
.nts-in:focus{border-color:var(--nts-acc0)}
.nts-color{width:34px;height:24px;padding:0;border:1px solid var(--nts-line,#3a3d46);border-radius:5px;background:none;cursor:pointer;flex:none}
.nts-big{width:58px;height:40px}
.nts-seg{display:flex;border-radius:7px;overflow:hidden;border:1px solid var(--nts-line,#3a3d46)}
.nts-seg button{height:24px;padding:0 9px;border:none;background:var(--nts-input,#17181c);color:var(--nts-muted,#9aa0ae);font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
.nts-seg button.on{background:var(--nts-acc0);color:#111}
.nts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:5px 10px}
.nts-cell{display:flex;align-items:center;gap:6px;min-width:0}
.nts-cell span{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nts-xp{display:none;flex-direction:column;gap:8px;border-top:1px dashed var(--nts-line,#3a3d46);padding-top:8px}
.nts-range{flex:1;min-width:80px;accent-color:var(--nts-acc0)}
.nts-chk{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap}
.nts-chk input{accent-color:var(--nts-acc0)}
.nts-sel{height:24px;background:var(--nts-input,#17181c);color:var(--nts-text,#ddd);border:1px solid var(--nts-line,#3a3d46);border-radius:5px;font-size:10px;outline:none}
.nts-share{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--nts-line,#3a3d46);padding-top:8px}
.nts-code{font-family:Consolas,monospace;font-size:10px}
.nts-status{font-size:10px;color:var(--nts-muted,#8b90a0);min-height:13px;line-height:1.4}
.nts-status.err{color:#ff8f93}
.nts-drop{outline:2px dashed var(--nts-acc0);outline-offset:-4px}
.nts-hint{font-size:10px;color:var(--nts-muted,#8b90a0);line-height:1.45}
.nts-pic{display:none;flex-direction:column;gap:6px;background:var(--nts-card,#22252b);border-radius:8px;padding:7px}
.nts-pic canvas{display:block;max-width:100%;border-radius:5px;cursor:crosshair;touch-action:none;align-self:flex-start}
.nts-sw{display:flex;gap:5px;flex-wrap:wrap}
.nts-sw button{width:26px;height:22px;border-radius:5px;border:2px solid transparent;cursor:pointer;padding:0}
.nts-sw button.on{border-color:var(--nts-text,#fff);box-shadow:0 0 0 1px #000 inset}
`;
    document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
//  Размер ноды задаёт пользователь / The user sets the node size
// ---------------------------------------------------------------------------
function makeUserSized(node, domWidget, root, opts) {
    const minH = opts.minH || 160;
    node.properties = node.properties || {};
    const manual = () => node.properties.nts_manual_size === true;
    const curH = () => {
        if (!manual()) return opts.autoH();
        const h = Number(node.properties.nts_panel_h);
        return h > 0 ? Math.max(minH, h) : opts.autoH();
    };
    const o = domWidget.options || (domWidget.options = {});
    o.getMinHeight = () => (manual() ? minH : curH());
    o.getHeight = () => curH();
    o.getMaxHeight = () => curH();
    domWidget.computeSize = (width) => [width, manual() && app.canvas?.resizing_node === node ? minH : curH()];
    let fitting = false, tries = 0;
    const apply = () => { root.style.height = curH() + "px"; };
    const fit = () => {
        apply();
        const top = domWidget.last_y;
        if (top == null && tries++ < 30) { setTimeout(fit, 100); return; }
        if (fitting || top == null || !node.size) return;
        tries = 0;
        const need = Math.round(top + curH() + 14);
        if (manual() ? node.size[1] < need : Math.abs(node.size[1] - need) > 2) { fitting = true; node.setSize([node.size[0], need]); fitting = false; }
        node.setDirtyCanvas && node.setDirtyCanvas(true, true);
    };
    const onResize0 = node.onResize;
    node.onResize = function () {
        const r = onResize0 ? onResize0.apply(this, arguments) : undefined;
        if (!fitting && app.canvas?.resizing_node === node) {
            node.properties.nts_manual_size = true;
            const top = domWidget.last_y;
            if (top != null) node.properties.nts_panel_h = Math.max(minH, Math.round(node.size[1] - top - 14));
            requestAnimationFrame(apply);
        } else if (!fitting && !manual()) requestAnimationFrame(fit);
        else requestAnimationFrame(apply);
        return r;
    };
    const menu0 = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        const r = menu0 ? menu0.apply(this, arguments) : undefined;
        if (manual() && Array.isArray(options)) options.push(null, { content: "↕ Авто-размер / Auto size", callback: () => { node.properties.nts_manual_size = false; fit(); } });
        return r;
    };
    root.style.overflow = "auto";
    apply();
    setTimeout(fit, 60);
    return { fit, apply };
}

// ---------------------------------------------------------------------------
//  Какая нода темы главная на столе / Which theme node is in charge
// ---------------------------------------------------------------------------
function themeNodes() {
    const nodes = (app.graph && app.graph._nodes) || [];
    return nodes.filter((n) => (n.comfyClass || n.type) === NODE);
}
function readState(n) {
    const w = (n.widgets || []).find((x) => x.name === "theme_json");
    let o = {};
    try { o = JSON.parse(w ? w.value : "{}") || {}; } catch (e) { o = {}; }
    return typeof o === "object" ? o : {};
}
const parsedCache = { raw: null, theme: null };
function themeOfNode(n) {
    const w = (n.widgets || []).find((x) => x.name === "theme_json");
    const raw = w ? w.value : "";
    if (raw === parsedCache.raw) return parsedCache.theme;
    const st = readState(n);
    parsedCache.raw = raw;
    parsedCache.theme = st.theme && typeof st.theme === "object" ? normalizeTheme(st.theme) : null;
    return parsedCache.theme;
}
// раз в полсекунды: есть ли нода темы, какая тема на ней
function pollGraph() {
    try {
        // примерка живёт, только пока курсор на карточке (карточка могла исчезнуть вместе с нодой)
        if (engineState.preview && !document.querySelector(".nts-card:hover")) setPreview(null);
        const list = themeNodes();
        setCurrent(list.length ? themeOfNode(list[0]) : null);
        for (const n of list) if (n.__ntsPaint) n.__ntsPaint(list[0] === n);
    } catch (e) { /* ок */ }
}
setInterval(pollGraph, 500);

// ---------------------------------------------------------------------------
//  Карточка темы с маленьким превью / A theme card with a tiny preview
// ---------------------------------------------------------------------------
function previewBox(t) {
    const p = el("div", "nts-prev");
    p.style.background = t ? t.c.bg : "#202020";
    const add = (css) => { const i = el("i"); Object.assign(i.style, css); p.appendChild(i); return i; };
    if (!t) {
        add({ left: "10%", top: "18%", width: "38%", height: "60%", background: "#353535" });
        add({ left: "10%", top: "18%", width: "38%", height: "14%", background: "#222" });
        add({ left: "58%", top: "28%", width: "32%", height: "52%", background: "#353535" });
        add({ left: "58%", top: "28%", width: "32%", height: "14%", background: "#222" });
        return p;
    }
    const roles = ROLE_IDS.map((r) => t.roles[r]);
    const nodes = [[8, 14, 36, 34, 0], [56, 10, 36, 30, 3], [56, 56, 36, 30, 7], [8, 60, 36, 28, 2]];
    for (const [x, y, w, h, r] of nodes) {
        add({ left: x + "%", top: y + "%", width: w + "%", height: h + "%", background: mix(t.c.body, roles[r], t.btint), boxShadow: t.glow > 0.5 ? `0 0 6px ${roles[r]}` : "" });
        add({ left: x + "%", top: y + "%", width: w + "%", height: "9%", background: mix(t.c.title, roles[r], Math.max(0.5, t.tint)) });
    }
    add({ left: "44%", top: "30%", width: "12%", height: "2px", background: t.c.link, borderRadius: "1px" });
    add({ left: "44%", top: "70%", width: "12%", height: "2px", background: roles[4], borderRadius: "1px" });
    return p;
}

// ---------------------------------------------------------------------------
//  Мои темы (на сервере) / My themes (on the server)
// ---------------------------------------------------------------------------
const MINE = { list: [], loaded: false, listeners: new Set() };
async function loadMine() {
    try {
        const r = await api.fetchApi("/neron_theme/list?t=" + Date.now());
        const d = await r.json();
        MINE.list = d.ok ? (d.themes || []).map((t) => { const n = normalizeTheme(t); n.id = t.id; return n; }) : [];
        MINE.dir = d.dir || "";
    } catch (e) { MINE.list = []; }
    MINE.loaded = true;
    for (const f of MINE.listeners) try { f(); } catch (e) { /* ок */ }
}
async function saveMine(t, id) {
    const body = JSON.stringify({ theme: { ...t, id: undefined }, id });
    const r = await api.fetchApi("/neron_theme/save", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "HTTP " + r.status);
    await loadMine();
    return d;
}
async function deleteMine(id) {
    const r = await api.fetchApi("/neron_theme/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "HTTP " + r.status);
    await loadMine();
}

// ---------------------------------------------------------------------------
//  Картинка со входа image / The picture from the image input
// ---------------------------------------------------------------------------
function getLink(node, id) {
    const g = node.graph;
    if (!g || !g.links) return null;
    return g.links instanceof Map ? g.links.get(id) : g.links[id];
}
function upstreamImage(node) {
    const inp = (node.inputs || []).find((x) => x.name === "image");
    if (!inp || inp.link == null) return null;
    let id = inp.link;
    for (let hop = 0; hop < 6; hop++) {
        const l = getLink(node, id);
        if (!l) return null;
        const o = node.graph.getNodeById(l.origin_id);
        if (!o) return null;
        if (o.type === "Reroute") { const i0 = o.inputs && o.inputs[0]; if (i0 && i0.link != null) { id = i0.link; continue; } return null; }
        return o;
    }
    return null;
}
function loadImageUrl(o) {
    const cls = o.comfyClass || o.type;
    if (cls !== "LoadImage" && cls !== "LoadImageMask") return null;
    const w = (o.widgets || []).find((x) => x.name === "image");
    let s = String(w ? w.value : "").trim();
    if (!s) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    const k = s.lastIndexOf("/");
    const q = `filename=${encodeURIComponent(k >= 0 ? s.slice(k + 1) : s)}&subfolder=${encodeURIComponent(k >= 0 ? s.slice(0, k) : "")}&type=${encodeURIComponent(type)}`;
    return api.apiURL("/view?" + q);
}
function loadImg(url) {
    return new Promise((res, rej) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => res(im);
        im.onerror = () => rej(new Error(T("картинка не загрузилась", "the picture did not load")));
        im.src = url;
    });
}

// ============================================================================
//  Интерфейс ноды / Node UI
// ============================================================================
function setupNode(node) {
    injectStyles();
    const getW = (name) => (node.widgets || []).find((x) => x.name === name);
    const stW = getW("theme_json");
    if (stW) { stW.type = "hidden"; stW.hidden = true; stW.computeSize = () => [0, -4]; }

    // ---------- состояние ----------
    const S = { theme: null, tab: "install" };
    function load() {
        let o = {};
        try { o = JSON.parse(stW ? stW.value : "{}") || {}; } catch (e) { o = {}; }
        S.theme = o.theme && typeof o.theme === "object" ? normalizeTheme(o.theme) : null;
        S.tab = o.tab === "create" ? "create" : "install";
        S.lastImg = o.lastImg || null;
        S.sel = o.sel && typeof o.sel === "object" ? o.sel : null;
        S.pick = typeof o.pick === "string" ? o.pick : null;
        S.picKey = typeof o.picKey === "string" ? o.picKey : null;
    }
    function save() {
        if (stW) stW.value = JSON.stringify({ v: 1, theme: S.theme, tab: S.tab, lastImg: S.lastImg || null, sel: S.sel || null, pick: S.pick || null, picKey: S.picKey || null });
        pollGraph();
    }
    load();
    const isActive = () => themeNodes()[0] === node;

    function setTheme(t, msg) {
        S.theme = t ? normalizeTheme(t) : null;
        if (S.theme) fixReadable(S.theme);
        save();
        paintAll();
        if (msg) status(msg);
    }

    // ---------- корень ----------
    const root = el("div", "nts-root");
    const wrap = el("div", "nts-wrap");
    root.appendChild(wrap);
    root.addEventListener("pointerdown", (e) => { if (e.target.closest("input,select,button,.nts-card")) e.stopPropagation(); });
    root.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

    const head = el("div", "nts-head");
    head.appendChild(el("b", "", "🎨 NERON THEME"));
    const sub = el("span", "nts-sub");
    head.appendChild(sub);
    const xBtn = el("button", "nts-btn", "⚙ " + T("ДЛЯ СПЕЦОВ", "EXPERT"));
    xBtn.title = T("Все настройки темы: каждый цвет, роли нод, свечение, живость", "Every theme setting: each color, node roles, glow, life");
    const helpBtn = el("button", "nts-btn", "📖");
    helpBtn.title = T("Помощь", "Help");
    head.appendChild(xBtn); head.appendChild(helpBtn);
    wrap.appendChild(head);

    const help = el("div", "nts-help");
    help.innerHTML =
        "<b>RU:</b> Пока эта нода на столе — <b>весь ComfyUI в теме</b>: окно, стол, ноды и провода. Удалите ноду — всё как было. "
        + "Тема сохраняется вместе с workflow: кто скачает вашу схему, увидит её в вашем оформлении. Цвет, который вы задали ноде вручную (правый клик → Colors), всегда главнее темы.<br>"
        + "<b>УСТАНОВИТЬ</b> — наведите на карточку, чтобы примерить, кликните, чтобы поставить. «Мои» — ваши сохранённые темы. Чужую тему ставят кодом (поле внизу вкладки) или файлом — просто бросьте файл .json на эту ноду.<br>"
        + "<b>СОЗДАТЬ</b> — выберите главный цвет, и нода соберёт тему сама. Или <b>🖼 Из картинки</b>: подключите Load Image ко входу <b>image</b>; тяните рамку по превью, чтобы взять цвета с одного места, клик по цвету в полоске — сделать его главным. "
        + "<b>Прозрачность нод</b> — сквозь ноды видно сетку и провода. <b>Подсветка нод</b> — свечение из-под каждой ноды её цветом. <b>Провода</b>: по типу, одним цветом или свои цвета по типам (в ⚙). "
        + "<b>Живость</b>: огоньки по рамкам нод, искры по проводам, фон; нода, которая сейчас считается, светится, готовая — вспыхивает, ошибка — мигает красным. "
        + "<b>⚙ ДЛЯ СПЕЦОВ</b> — каждый цвет и каждая роль вручную. <b>💾 Сохранить в Мои</b> — тема появится на вкладке УСТАНОВИТЬ.<br>"
        + "<b>ПОДЕЛИТЬСЯ</b> — то, что стоит сейчас: <b>📋 Код</b> (строчка для чата), <b>💾 Файл</b>, <b>🎨 Для ComfyUI</b> (палитра для Настройки → Appearance → Color Palette, без нашей ноды, но без живости и ролей).<br>"
        + "⚠️ <b>Братан, не гонись за анимацией.</b> Её рисует браузер. На больших столах ComfyUI и без неё бывает неповоротлив; если подлагивает — поставьте живость «Спокойно» или «Выкл».<br><br>"
        + "<b>EN:</b> While this node is on the canvas the <b>whole ComfyUI is themed</b>: window, canvas, nodes and wires. Delete the node — everything is back. "
        + "The theme is saved with the workflow. A color you set on a node by hand (right-click → Colors) always wins over the theme.<br>"
        + "<b>INSTALL</b> — hover a card to try it on, click to apply. \"Mine\" — your saved themes. Someone else's theme: paste its code or drop its .json file on this node.<br>"
        + "<b>CREATE</b> — pick a main color and the node builds the theme. Or <b>🖼 From picture</b>: wire Load Image to the <b>image</b> input; drag a frame on the preview to take colors from one spot, click a color in the strip to make it the main one. "
        + "<b>Node opacity</b> — see the grid and wires through nodes. <b>Node backlight</b> — a glow under each node in its color. <b>Wires</b>: by type, one color, or your own per type (in ⚙). "
        + "<b>Life</b>: lights on node frames, sparks on wires, background; the running node glows, a finished one flashes, an error blinks red. "
        + "<b>⚙ EXPERT</b> — every color and role by hand. <b>💾 Save to Mine</b> — it shows up under INSTALL.<br>"
        + "<b>SHARE</b> — whatever is on now: <b>📋 Code</b>, <b>💾 File</b>, <b>🎨 For ComfyUI</b> (a palette for Settings → Appearance → Color Palette; works without our node, but without life and roles).<br>"
        + "⚠️ <b>Bro, don't chase the animation.</b> The browser draws it. On big canvases ComfyUI can feel heavy even without it; if it lags, set Life to Calm or Off.";
    wrap.appendChild(help);

    const warn = el("div", "nts-warn");
    wrap.appendChild(warn);

    const tabs = el("div", "nts-tabs");
    const tabI = el("button", "nts-tab", T("УСТАНОВИТЬ", "INSTALL"));
    const tabC = el("button", "nts-tab", T("СОЗДАТЬ", "CREATE"));
    tabs.appendChild(tabI); tabs.appendChild(tabC);
    wrap.appendChild(tabs);
    tabI.addEventListener("click", () => { S.tab = "install"; save(); paintTabs(); });
    tabC.addEventListener("click", () => { S.tab = "create"; save(); paintTabs(); paintCreate(); });

    // ======================================================================
    //  УСТАНОВИТЬ / INSTALL
    // ======================================================================
    const paneI = el("div", "nts-pane");
    wrap.appendChild(paneI);

    paneI.appendChild(el("div", "nts-sec", T("ВСТРОЕННЫЕ", "BUILT-IN")));
    const cardsB = el("div", "nts-cards");
    paneI.appendChild(cardsB);
    paneI.appendChild(el("div", "nts-sec", T("МОИ", "MINE")));
    const cardsM = el("div", "nts-cards");
    paneI.appendChild(cardsM);
    const mineEmpty = el("div", "nts-hint", T("Здесь появятся ваши темы: вкладка СОЗДАТЬ → 💾 Сохранить в Мои. Темы, поставленные кодом или файлом, тоже попадают сюда.",
        "Your themes appear here: CREATE → 💾 Save to Mine. Themes added by code or file land here too."));
    paneI.appendChild(mineEmpty);

    paneI.appendChild(el("div", "nts-sec", T("ЧУЖАЯ ТЕМА: КОД ИЛИ ФАЙЛ", "SOMEONE'S THEME: CODE OR FILE")));
    const pasteRow = el("div", "nts-row");
    const pasteIn = el("input", "nts-in nts-code");
    pasteIn.placeholder = T("вставьте код NERON-THEME1:…", "paste a NERON-THEME1:… code");
    pasteIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") pasteBtn.click(); });
    const pasteBtn = el("button", "nts-btn acc", "📥 " + T("ПОСТАВИТЬ", "APPLY"));
    pasteBtn.title = T("Поставить тему из кода и сохранить её в Мои", "Apply the theme from the code and save it to Mine");
    pasteRow.appendChild(pasteIn); pasteRow.appendChild(pasteBtn);
    paneI.appendChild(pasteRow);
    paneI.appendChild(el("div", "nts-hint", T("…или просто бросьте файл темы (.json) прямо на эту ноду.", "…or just drop a theme file (.json) right onto this node.")));

    async function importText(text, from) {
        try {
            const t = await decodeAny(text);
            setTheme(t);
            try { await saveMine(t); } catch (e) { /* не страшно: тема уже стоит */ }
            status(T(`Тема «${t.name}»${t.author ? " (" + t.author + ")" : ""} поставлена и сохранена в Мои`, `Theme "${t.name}"${t.author ? " (" + t.author + ")" : ""} applied and saved to Mine`) + (from ? " · " + from : ""));
            return true;
        } catch (e) {
            status(T("Не получилось прочитать тему: ", "Could not read the theme: ") + (e.message || e), true);
            return false;
        }
    }
    pasteBtn.addEventListener("click", async () => { if (await importText(pasteIn.value)) pasteIn.value = ""; });

    function card(t, opts = {}) {
        const c = el("div", "nts-card");
        c.appendChild(previewBox(t));
        c.appendChild(el("b", "", t ? t.name : T("Обычный ComfyUI", "Plain ComfyUI")));
        if (opts.sub) c.appendChild(el("small", "", opts.sub));
        let hoverT = null;
        c.addEventListener("mouseenter", () => { hoverT = setTimeout(() => setPreview(t || { __none: true }), 280); });
        c.addEventListener("mouseleave", () => { clearTimeout(hoverT); setPreview(null); });
        c.addEventListener("click", () => {
            clearTimeout(hoverT); setPreview(null);
            setTheme(t ? { ...t } : null, t ? T(`Тема «${t.name}» поставлена`, `Theme "${t.name}" applied`) : T("Тема выключена — обычный ComfyUI", "Theme off — plain ComfyUI"));
        });
        if (opts.onDelete) {
            const x = el("button", "nts-x", "✖");
            x.title = T("Удалить из Моих (нажать дважды)", "Delete from Mine (press twice)");
            let armed = null;
            x.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!armed) { x.classList.add("armed"); x.textContent = T("точно?", "sure?"); armed = setTimeout(() => { armed = null; x.classList.remove("armed"); x.textContent = "✖"; }, 2200); return; }
                clearTimeout(armed); armed = null;
                opts.onDelete();
            });
            c.appendChild(x);
        }
        c.__theme = t;
        return c;
    }
    function sameTheme(a, b) {
        if (!a || !b) return a === b;
        return JSON.stringify(a.c) === JSON.stringify(b.c) && JSON.stringify(a.roles) === JSON.stringify(b.roles);
    }
    function paintCards() {
        cardsB.innerHTML = "";
        cardsB.appendChild(card(null));
        for (const t of BUILTIN) cardsB.appendChild(card(t));
        cardsM.innerHTML = "";
        for (const t of MINE.list) {
            cardsM.appendChild(card(t, {
                sub: t.author ? "✍ " + t.author : "",
                onDelete: async () => {
                    try { await deleteMine(t.id); status(T(`«${t.name}» удалена из Моих`, `"${t.name}" deleted from Mine`)); }
                    catch (e) { status(T("Не удалилось: ", "Not deleted: ") + e.message, true); }
                },
            }));
        }
        mineEmpty.style.display = MINE.list.length ? "none" : "";
        markCards();
    }
    function markCards() {
        for (const box of [cardsB, cardsM]) for (const c of box.children) c.classList.toggle("on", sameTheme(c.__theme, S.theme));
    }
    const onMine = () => { paintCards(); relayout(); };
    MINE.listeners.add(onMine);

    // ======================================================================
    //  СОЗДАТЬ / CREATE
    // ======================================================================
    const paneC = el("div", "nts-pane");
    wrap.appendChild(paneC);

    const r1 = el("div", "nts-row");
    r1.appendChild(el("span", "nts-lbl", T("ГЛАВНЫЙ ЦВЕТ", "MAIN COLOR")));
    const mainC = el("input", "nts-color nts-big");
    mainC.type = "color";
    mainC.title = T("Выберите цвет — тема соберётся из него сама", "Pick a color — the theme builds itself from it");
    r1.appendChild(mainC);
    const schemeSeg = el("div", "nts-seg");
    const SCHEMES = [["harmony", "СОСЕДНИЕ", "HARMONY", T("Роли — соседние оттенки главного цвета", "Roles — neighbouring shades of the main color")],
        ["rainbow", "РАДУГА", "RAINBOW", T("Роли — все цвета радуги, ноды легко различать", "Roles — the whole rainbow, nodes are easy to tell apart")],
        ["mono", "ОДИН ТОН", "MONO", T("Всё в одном оттенке", "Everything in one hue")]];
    const schemeBtns = {};
    for (const [id, ru, en, tip] of SCHEMES) {
        const b = el("button", "", T(ru, en)); b.title = tip;
        b.addEventListener("click", () => { node.properties.nts_scheme = id; regenFromColor(); });
        schemeSeg.appendChild(b); schemeBtns[id] = b;
    }
    r1.appendChild(schemeSeg);
    const lightChk = el("label", "nts-chk");
    const lightIn = el("input"); lightIn.type = "checkbox";
    lightChk.appendChild(lightIn); lightChk.appendChild(document.createTextNode(T("светлая", "light")));
    lightChk.title = T("Светлая тема (светлый фон, тёмный текст)", "Light theme (light background, dark text)");
    lightIn.addEventListener("change", () => { node.properties.nts_light = lightIn.checked; regenFromColor(); });
    r1.appendChild(lightChk);
    paneC.appendChild(r1);

    // автор новой темы — вы (ник запоминается), а не автор встроенной темы
    const myAuthor = () => node.properties.nts_author || (S.theme && !BUILTIN.some((x) => x.author === S.theme.author && x.name === S.theme.name) && S.theme.author !== "Neron" ? S.theme.author : "");
    let colorT = null;
    mainC.addEventListener("input", () => { clearTimeout(colorT); colorT = setTimeout(regenFromColor, 60); });
    function regenFromColor() {
        const keepName = S.theme && !BUILTIN.some((b) => b.name === S.theme.name) ? S.theme.name : T("Моя тема", "My theme");
        const t = generateFromColor(mainC.value, { scheme: node.properties.nts_scheme || "harmony", light: !!node.properties.nts_light, name: keepName, level: S.theme ? S.theme.life.level : 1 });
        if (S.theme) { t.life = { ...S.theme.life }; t.ui = S.theme.ui; }
        t.author = myAuthor();
        setTheme(t);
        paintCreate();
    }

    const r2 = el("div", "nts-row");
    const imgBtn = el("button", "nts-btn acc", "🖼 " + T("ИЗ КАРТИНКИ", "FROM PICTURE"));
    imgBtn.title = T("Тема из цветов картинки со входа image (подключите Load Image)", "A theme from the colors of the picture on the image input (wire Load Image)");
    const imgInfo = el("span", "nts-hint");
    r2.appendChild(imgBtn); r2.appendChild(imgInfo);
    paneC.appendChild(r2);
    imgBtn.addEventListener("click", () => themeFromWiredImage());

    // превью картинки: тянуть рамку — цвета только с этого участка; двойной клик — вся картинка
    const pic = el("div", "nts-pic");
    const picCv = el("canvas");
    const picHint = el("div", "nts-hint", T("Тяните рамку по картинке — тема возьмёт цвета только с этого места. Двойной клик — вся картинка. Клик по цвету ниже — он станет главным.",
        "Drag a frame on the picture — the theme takes colors only from there. Double-click — the whole picture. Click a color below — it becomes the main one."));
    const sw = el("div", "nts-sw");
    pic.appendChild(picCv); pic.appendChild(sw); pic.appendChild(picHint);
    paneC.insertBefore(pic, r2.nextSibling);
    let picImg = null, picPal = [], drag = null;
    function drawPic(live) {
        if (!picImg) return;
        const maxW = Math.max(160, Math.min(420, (root.clientWidth || 500) - 40)), maxH = 190;
        const iw = picImg.naturalWidth || picImg.width, ih = picImg.naturalHeight || picImg.height;
        const k = Math.min(maxW / iw, maxH / ih);
        const w = Math.max(40, Math.round(iw * k)), h = Math.max(30, Math.round(ih * k));
        if (picCv.width !== w || picCv.height !== h) { picCv.width = w; picCv.height = h; picCv.style.width = w + "px"; picCv.style.height = h + "px"; }
        const g = picCv.getContext("2d");
        g.drawImage(picImg, 0, 0, w, h);
        const s = live || S.sel;
        if (s && s.w > 0.005 && s.h > 0.005) {
            const x = s.x * w, y = s.y * h, rw = s.w * w, rh = s.h * h;
            g.fillStyle = "rgba(0,0,0,.55)";
            g.fillRect(0, 0, w, y); g.fillRect(0, y + rh, w, h - y - rh); g.fillRect(0, y, x, rh); g.fillRect(x + rw, y, w - x - rw, rh);
            g.strokeStyle = "#fff"; g.lineWidth = 2; g.setLineDash([5, 3]);
            g.strokeRect(x + 1, y + 1, rw - 2, rh - 2); g.setLineDash([]);
        }
    }
    function paintSwatches() {
        sw.innerHTML = "";
        for (const p of picPal.slice(0, 8)) {
            const b = el("button");
            b.style.background = p.hex;
            b.title = T(`Сделать главным цветом: ${p.hex} (${Math.round(p.share * 100)}% участка)`, `Make it the main color: ${p.hex} (${Math.round(p.share * 100)}% of the area)`);
            b.classList.toggle("on", S.pick === p.hex);
            b.addEventListener("click", () => { S.pick = S.pick === p.hex ? null : p.hex; rebuildFromPicture(); });
            sw.appendChild(b);
        }
    }
    const relPos = (e) => {
        const r = picCv.getBoundingClientRect();
        return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
    };
    picCv.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        picCv.setPointerCapture(e.pointerId);
        const [x, y] = relPos(e);
        drag = { x0: x, y0: y, sel: null };
    });
    picCv.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const [x, y] = relPos(e);
        drag.sel = { x: Math.min(drag.x0, x), y: Math.min(drag.y0, y), w: Math.abs(x - drag.x0), h: Math.abs(y - drag.y0) };
        drawPic(drag.sel);
    });
    const endDrag = () => {
        if (!drag) return;
        const s = drag.sel;
        drag = null;
        if (s && s.w > 0.02 && s.h > 0.02) { S.sel = s; S.pick = null; rebuildFromPicture(); }
        else drawPic();
    };
    picCv.addEventListener("pointerup", endDrag);
    picCv.addEventListener("pointercancel", endDrag);
    picCv.addEventListener("dblclick", (e) => { e.stopPropagation(); S.sel = null; S.pick = null; rebuildFromPicture(); });

    const r3 = el("div", "nts-row");
    r3.appendChild(el("span", "nts-lbl", T("НАЗВАНИЕ", "NAME")));
    const nameIn = el("input", "nts-in");
    nameIn.maxLength = 40;
    r3.appendChild(nameIn);
    r3.appendChild(el("span", "nts-lbl", T("АВТОР", "AUTHOR")));
    const authIn = el("input", "nts-in");
    authIn.maxLength = 40;
    authIn.placeholder = T("ваш ник — увидят все, с кем поделитесь", "your nickname — everyone you share with sees it");
    r3.appendChild(authIn);
    paneC.appendChild(r3);
    for (const [inp, key] of [[nameIn, "name"], [authIn, "author"]]) {
        inp.addEventListener("keydown", (e) => e.stopPropagation());
        inp.addEventListener("input", () => {
            if (!S.theme) return;
            S.theme[key] = inp.value.slice(0, 40);
            if (key === "author") node.properties.nts_author = inp.value.slice(0, 40);
            save(); paintHead();
        });
    }

    const r4 = el("div", "nts-row");
    r4.appendChild(el("span", "nts-lbl", T("ЖИВОСТЬ", "LIFE")));
    const lifeSeg = el("div", "nts-seg");
    const lifeBtns = LIFE_LEVELS.map(([ru, en], i) => {
        const b = el("button", "", T(ru, en));
        b.title = [T("Без анимации — только цвета", "No animation — colors only"), T("Медленный огонёк по рамкам, искры по проводам", "A slow light on frames, sparks on wires"),
            T("Больше огней, свечение, фон", "More lights, glow, background"), T("Всё на полную. На больших столах может подтормаживать", "Everything at full. May stutter on big canvases")][i];
        b.addEventListener("click", () => { if (!S.theme) return; S.theme.life.level = i; if (i >= 2 && S.theme.life.bgfx === "none") S.theme.life.bgfx = "particles"; save(); paintCreate(); });
        lifeSeg.appendChild(b);
        return b;
    });
    r4.appendChild(lifeSeg);
    paneC.appendChild(r4);

    const sliders = {};
    function slider(label, tip, key, min, max, step, fmt, parent) {
        const row = el("div", "nts-row");
        row.title = tip;
        row.appendChild(el("span", "nts-lbl", label));
        const r = el("input", "nts-range"); r.type = "range"; r.min = min; r.max = max; r.step = step;
        const v = el("span", "nts-lbl");
        r.addEventListener("input", () => { if (!S.theme) return; setPath(S.theme, key, Number(r.value)); v.textContent = fmt(Number(r.value)); saveSoon(); });
        row.appendChild(r); row.appendChild(v);
        (parent || xp).appendChild(row);
        r.addEventListener("pointerdown", (e) => e.stopPropagation());
        sliders[key] = { r, v, fmt };
    }
    const getPath = (o, p) => p.split(".").reduce((a, k) => (a ? a[k] : undefined), o);
    const setPath = (o, p, val) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = val; };
    const pct = (v) => Math.round(v * 100) + "%";

    // прозрачность нод, подсветка, провода — для всех (без ⚙)
    const look = el("div", "nts-pane");
    look.style.gap = "4px";
    paneC.appendChild(look);
    slider(T("ПРОЗРАЧНОСТЬ НОД", "NODE OPACITY"), T("Тело нод становится полупрозрачным — сквозь него видно сетку и провода. 100% — обычные ноды",
        "Node bodies become see-through — the grid and wires show through. 100% — normal nodes"), "opacity", 0.2, 1, 0.01, (v) => (v >= 0.995 ? T("нет", "off") : Math.round(v * 100) + "%"), look);
    slider(T("ПОДСВЕТКА НОД", "NODE BACKLIGHT"), T("Мягкое свечение из-под каждой ноды цветом её роли (без анимации)", "A soft glow under each node in its role color (no animation)"),
        "halo", 0, 1, 0.01, (v) => (v <= 0.005 ? T("нет", "off") : Math.round(v * 100) + "%"), look);
    const wRow = el("div", "nts-row");
    wRow.appendChild(el("span", "nts-lbl", T("ПРОВОДА", "WIRES")));
    const wSeg = el("div", "nts-seg");
    const wBtns = {};
    for (const [id, ru, en, tip] of WIRE_MODES) {
        const b = el("button", "", T(ru, en)); b.title = tip;
        b.addEventListener("click", () => {
            if (!S.theme) return;
            S.theme.wires.mode = id;
            if (id === "custom") { node.properties.nts_expert = true; paintExpert(); }
            save(); paintCreate();
        });
        wSeg.appendChild(b); wBtns[id] = b;
    }
    wRow.appendChild(wSeg);
    const wOne = el("input", "nts-color");
    wOne.type = "color";
    wOne.title = T("Цвет всех проводов", "The color of all wires");
    wOne.addEventListener("input", () => { if (!S.theme) return; S.theme.c.link = wOne.value; saveSoon(); });
    wRow.appendChild(wOne);
    look.appendChild(wRow);

    // ---------- для спецов ----------
    const xp = el("div", "nts-xp");
    paneC.appendChild(xp);
    xp.appendChild(el("div", "nts-sec", T("ЦВЕТА", "COLORS")));
    const gridC = el("div", "nts-grid");
    xp.appendChild(gridC);
    const colorIns = {};
    function colorCell(grid, label, tip, get, set) {
        const cell = el("label", "nts-cell");
        const ci = el("input", "nts-color"); ci.type = "color";
        ci.addEventListener("input", () => { if (!S.theme) return; set(ci.value); saveSoon(); });
        cell.title = tip || label;
        cell.appendChild(ci); cell.appendChild(el("span", "", label));
        grid.appendChild(cell);
        return { ci, get };
    }
    let saveT = null;
    const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => { save(); markCards(); }, 80); };
    for (const [k, ru, en] of C_KEYS) colorIns["c." + k] = colorCell(gridC, T(ru, en), null, () => S.theme.c[k], (v) => { S.theme.c[k] = v; });
    xp.appendChild(el("div", "nts-sec", T("РОЛИ НОД — СВОЙ ЦВЕТ У КАЖДОЙ", "NODE ROLES — EACH HAS ITS COLOR")));
    const gridR = el("div", "nts-grid");
    xp.appendChild(gridR);
    for (const r of ROLES) colorIns["r." + r.id] = colorCell(gridR, T(r.ru, r.en), r.tip, () => S.theme.roles[r.id], (v) => { S.theme.roles[r.id] = v; });
    xp.appendChild(el("div", "nts-sec", T("ЦВЕТ ПРОВОДОВ ПО ТИПАМ (РЕЖИМ «СВОИ»)", "WIRE COLOR BY TYPE (\"CUSTOM\" MODE)")));
    const gridW = el("div", "nts-grid");
    xp.appendChild(gridW);
    for (const type of WIRE_TYPES) {
        colorIns["w." + type] = colorCell(gridW, type, T(`Цвет проводов ${type}. Меняете — провода переходят в режим «Свои»`, `${type} wire color. Changing it switches wires to "Custom"`),
            () => wireColor(S.theme, type), (v) => { S.theme.wires.custom[type] = v; if (S.theme.wires.mode !== "custom") { S.theme.wires.mode = "custom"; paintWires(); } });
    }

    xp.appendChild(el("div", "nts-sec", T("СИЛА ЦВЕТА И СВЕЧЕНИЕ", "COLOR STRENGTH AND GLOW")));
    slider(T("ЦВЕТ РОЛИ В ШАПКЕ", "ROLE IN TITLE"), T("Насколько шапка ноды окрашена цветом её роли", "How much the node title takes its role color"), "tint", 0, 1, 0.01, pct);
    slider(T("ЦВЕТ РОЛИ В ТЕЛЕ", "ROLE IN BODY"), T("Насколько тело ноды окрашено цветом роли", "How much the node body takes its role color"), "btint", 0, 0.6, 0.01, pct);
    slider(T("СВЕЧЕНИЕ", "GLOW"), T("Сила свечения огней и искр", "Glow strength of lights and sparks"), "glow", 0, 1, 0.01, pct);

    xp.appendChild(el("div", "nts-sec", T("ЖИВОСТЬ — ПОДРОБНО", "LIFE — DETAILS")));
    const lifeRow = el("div", "nts-row");
    const checks = {};
    for (const [k, ru, en, tip] of [
        ["life.frame", "огни по рамкам", "frame lights", T("Бегущие огоньки по рамкам нод", "Running lights on node frames")],
        ["life.wires", "искры по проводам", "wire sparks", T("Искры бегут по проводам", "Sparks run along the wires")],
        ["life.work", "работа схемы", "workflow run", T("Нода, которая считается, светится; готовая вспыхивает; ошибка мигает", "The running node glows, a finished one flashes, an error blinks")],
        ["life.beat", "в такт музыке", "on the beat", T("Вспышки на ударах музыки (звук нод Neron Audio Studio)", "Flashes on the beat (sound of Neron Audio Studio nodes)")],
        ["life.quietRun", "тише во время генерации", "quieter while generating", T("Пока идёт генерация, украшения замирают, остаются только сигналы работы", "While generating, decorations pause and only the run signals stay")],
        ["ui", "красить окно ComfyUI", "theme the ComfyUI window", T("Красить не только стол, но и меню и панели ComfyUI", "Theme the menus and panels too, not only the canvas")],
    ]) {
        const l = el("label", "nts-chk");
        const i = el("input"); i.type = "checkbox";
        i.addEventListener("change", () => { if (!S.theme) return; setPath(S.theme, k, i.checked); save(); });
        l.title = tip;
        l.appendChild(i); l.appendChild(document.createTextNode(T(ru, en)));
        lifeRow.appendChild(l);
        checks[k] = i;
    }
    xp.appendChild(lifeRow);
    const lifeRow2 = el("div", "nts-row");
    lifeRow2.appendChild(el("span", "nts-lbl", T("ФОН", "BACKGROUND")));
    const bgSel = el("select", "nts-sel");
    for (const [v, ru, en] of BGFX) { const o = el("option", "", T(ru, en)); o.value = v; bgSel.appendChild(o); }
    bgSel.addEventListener("change", () => { if (!S.theme) return; S.theme.life.bgfx = bgSel.value; save(); });
    lifeRow2.appendChild(bgSel);
    lifeRow2.appendChild(el("span", "nts-lbl", T("КАДРОВ В СЕКУНДУ", "FPS LIMIT")));
    const fpsSel = el("select", "nts-sel");
    for (const [v, txt] of [[0, T("авто", "auto")], [30, "30"], [45, "45"], [60, "60"]]) { const o = el("option", "", txt); o.value = String(v); fpsSel.appendChild(o); }
    fpsSel.title = T("Меньше кадров — меньше нагрузка на больших столах", "Fewer frames — less load on big canvases");
    fpsSel.addEventListener("change", () => { if (!S.theme) return; S.theme.life.fps = Number(fpsSel.value); save(); });
    lifeRow2.appendChild(fpsSel);
    xp.appendChild(lifeRow2);
    slider(T("СКОРОСТЬ", "SPEED"), T("Скорость огней, искр и фона", "Speed of lights, sparks and background"), "life.speed", 0.25, 3, 0.05, (v) => "×" + v.toFixed(2));
    for (const s of [lifeRow2, ...Object.values(sliders).map((x) => x.r)]) s.addEventListener("pointerdown", (e) => e.stopPropagation());

    const r5 = el("div", "nts-row");
    const saveMineBtn = el("button", "nts-btn acc", "💾 " + T("СОХРАНИТЬ В МОИ", "SAVE TO MINE"));
    saveMineBtn.title = T("Тема появится на вкладке УСТАНОВИТЬ → Мои", "The theme shows up under INSTALL → Mine");
    saveMineBtn.addEventListener("click", async () => {
        if (!S.theme) return status(T("Сначала выберите или создайте тему", "Pick or create a theme first"), true);
        try {
            const d = await saveMine(S.theme);
            status(T(`«${S.theme.name}» сохранена в Мои (${d.path})`, `"${S.theme.name}" saved to Mine (${d.path})`));
        } catch (e) { status(T("Не сохранилось: ", "Not saved: ") + e.message, true); }
    });
    r5.appendChild(saveMineBtn);
    r5.appendChild(el("span", "nts-hint", T("Всё, что вы меняете, сразу видно на столе.", "Everything you change shows on the canvas right away.")));
    paneC.appendChild(r5);

    function rebuildFromPicture() {
        if (!picImg) return;
        picPal = paletteFromImage(picImg, 8, S.sel);
        const t = themeFromPalette(picPal, { light: !!node.properties.nts_light, level: S.theme ? S.theme.life.level : 1, main: S.pick });
        t.name = T("Из картинки", "From picture");
        if (S.theme) { t.life = { ...S.theme.life }; t.ui = S.theme.ui; }
        t.author = myAuthor();
        setTheme(t);
        pic.style.display = "flex";
        drawPic(); paintSwatches(); relayout();
        status(S.sel ? T("Тема из выбранного участка. Понравилась — 💾 Сохранить в Мои", "Theme from the selected area. Like it — 💾 Save to Mine")
            : T("Тема собрана из картинки. Тяните рамку, чтобы взять цвета с одного места", "Theme built from the picture. Drag a frame to take colors from one spot"));
    }
    async function themeFromWiredImage() {
        const o = upstreamImage(node);
        let url = null;
        if (o) url = loadImageUrl(o);
        if (!url && S.lastImg) url = api.apiURL(`/view?filename=${encodeURIComponent(S.lastImg.filename)}&subfolder=${encodeURIComponent(S.lastImg.subfolder || "")}&type=${encodeURIComponent(S.lastImg.type || "temp")}&t=${Date.now()}`);
        if (!o && !url) return status(T("Подключите Load Image (или любую картинку) ко входу image этой ноды", "Wire Load Image (or any picture) to this node's image input"), true);
        if (!url) return status(T("Это не Load Image — нажмите Queue один раз, и картинка подтянется", "This is not Load Image — press Queue once and the picture will load"), true);
        try {
            const im = await loadImg(url);
            // другая картинка — рамка и выбранный цвет сбрасываются; та же — остаются (и после перезапуска)
            const key = url.replace(/[?&]t=\d+/, "");
            if (S.picKey !== key) { S.sel = null; S.pick = null; S.picKey = key; }
            picImg = im;
            rebuildFromPicture();
            paintCreate();
        } catch (e) { status(T("Не получилось: ", "Failed: ") + (e.message || e), true); }
    }

    // ======================================================================
    //  ПОДЕЛИТЬСЯ / SHARE
    // ======================================================================
    const share = el("div", "nts-share");
    wrap.appendChild(share);
    const shRow = el("div", "nts-row");
    const shName = el("span", "nts-lbl");
    shName.style.flex = "1";
    shRow.appendChild(el("span", "nts-sec", T("ПОДЕЛИТЬСЯ", "SHARE")));
    shRow.appendChild(shName);
    const codeBtn = el("button", "nts-btn acc", "📋 " + T("КОД", "CODE"));
    codeBtn.title = T("Скопировать код темы — строчку для чата или комментария", "Copy the theme code — a line for a chat or comment");
    const fileBtn = el("button", "nts-btn", "💾 " + T("ФАЙЛ", "FILE"));
    fileBtn.title = T("Скачать файл темы (.json) — его можно бросить на ноду", "Download the theme file (.json) — it can be dropped on the node");
    const palBtn = el("button", "nts-btn", "🎨 " + T("ДЛЯ COMFYUI", "FOR COMFYUI"));
    palBtn.title = T("Палитра для Настройки → Appearance → Color Palette → Import. Работает без нашей ноды, но без живости и цветов ролей",
        "A palette for Settings → Appearance → Color Palette → Import. Works without our node, but without life and role colors");
    shRow.appendChild(codeBtn); shRow.appendChild(fileBtn); shRow.appendChild(palBtn);
    share.appendChild(shRow);
    const codeOut = el("input", "nts-in nts-code");
    codeOut.readOnly = true;
    codeOut.style.display = "none";
    codeOut.addEventListener("focus", () => codeOut.select());
    share.appendChild(codeOut);

    function needTheme() {
        if (S.theme) return true;
        status(T("Сейчас тема выключена — делиться нечем. Выберите тему на вкладке УСТАНОВИТЬ", "The theme is off — nothing to share. Pick one under INSTALL"), true);
        return false;
    }
    function download(name, text) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    const fname = (s) => (String(s || "theme").replace(/[\\/:*?"<>|]+/g, "_").trim() || "theme");
    codeBtn.addEventListener("click", async () => {
        if (!needTheme()) return;
        if (!S.theme.author && node.properties.nts_author) S.theme.author = node.properties.nts_author;
        const code = await encodeCode(S.theme);
        codeOut.value = code;
        codeOut.style.display = "";
        relayout();
        let ok = false;
        try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { codeOut.focus(); codeOut.select(); try { ok = document.execCommand("copy"); } catch (e2) { ok = false; } }
        status(ok ? T(`Код темы скопирован (${code.length} символов). Вставьте его в чат — человек вставит в свою ноду`, `Theme code copied (${code.length} characters). Paste it in a chat — they paste it into their node`)
            : T("Скопируйте код из поля ниже (Ctrl+C)", "Copy the code from the field below (Ctrl+C)"));
    });
    fileBtn.addEventListener("click", () => {
        if (!needTheme()) return;
        download(fname(S.theme.name) + ".neron-theme.json", themeFile(S.theme));
        status(T("Файл темы скачан. Его можно бросить на ноду Neron Theme", "Theme file downloaded. It can be dropped on a Neron Theme node"));
    });
    palBtn.addEventListener("click", () => {
        if (!needTheme()) return;
        const p = toComfyPalette(S.theme);
        download(fname(S.theme.name) + ".comfy-palette.json", JSON.stringify(p, null, 2));
        status(T("Палитра скачана: Настройки → Appearance → Color Palette → Import", "Palette downloaded: Settings → Appearance → Color Palette → Import"));
    });

    const stat = el("div", "nts-status");
    wrap.appendChild(stat);
    let statT = null;
    function status(text, err) {
        stat.textContent = text || "";
        stat.classList.toggle("err", !!err);
        clearTimeout(statT);
        if (text) statT = setTimeout(() => { stat.textContent = ""; stat.classList.remove("err"); }, 9000);
    }

    // ---------- бросить файл на ноду ----------
    const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    root.addEventListener("dragover", (e) => { if (!isFileDrag(e)) return; e.preventDefault(); e.stopPropagation(); root.classList.add("nts-drop"); });
    root.addEventListener("dragleave", () => root.classList.remove("nts-drop"));
    root.addEventListener("drop", async (e) => {
        root.classList.remove("nts-drop");
        if (!isFileDrag(e)) return;
        e.preventDefault(); e.stopPropagation();
        const f = e.dataTransfer.files[0];
        if (!f) return;
        if (f.size > 256 * 1024) return status(T("Файл слишком большой для темы", "The file is too big for a theme"), true);
        await importText(await f.text(), f.name);
    });
    // файл, брошенный на ноду мимо панели (на шапку) — ComfyUI спрашивает ноду
    node.onDragOver = (e) => isFileDrag(e) && [...(e.dataTransfer?.items || [])].some((i) => i.kind === "file");
    node.onDragDrop = async (e) => {
        const f = e.dataTransfer?.files?.[0];
        if (!f || !/\.json$/i.test(f.name)) return false;
        await importText(await f.text(), f.name);
        return true;
    };

    // ======================================================================
    //  Отрисовка / Painting
    // ======================================================================
    function paintTabs() {
        tabI.classList.toggle("on", S.tab === "install");
        tabC.classList.toggle("on", S.tab === "create");
        paneI.style.display = S.tab === "install" ? "flex" : "none";
        paneC.style.display = S.tab === "create" ? "flex" : "none";
        relayout();
    }
    function paintHead() {
        const t = S.theme;
        sub.textContent = t ? `${t.name}${t.author ? " · ✍ " + t.author : ""}` : T("обычный ComfyUI (тема выключена)", "plain ComfyUI (theme off)");
        shName.textContent = t ? `${T("сейчас", "now")}: ${t.name}${t.author ? " · ✍ " + t.author : ""}` : T("тема выключена", "theme off");
    }
    function paintWires() {
        const t = S.theme;
        for (const [id, btn] of Object.entries(wBtns)) btn.classList.toggle("on", !!t && t.wires.mode === id);
        wOne.style.display = t && t.wires.mode === "one" ? "" : "none";
        if (t) wOne.value = t.c.link;
    }
    function paintCreate() {
        const t = S.theme;
        const off = !t;
        for (const x of [mainC, nameIn, authIn, imgBtn, saveMineBtn]) x.disabled = false;
        mainC.value = t ? t.c.accent : "#b388ff";
        for (const [id, b] of Object.entries(schemeBtns)) b.classList.toggle("on", (node.properties.nts_scheme || "harmony") === id);
        lightIn.checked = !!node.properties.nts_light;
        nameIn.value = t ? t.name : "";
        authIn.value = t ? t.author : (node.properties.nts_author || "");
        lifeBtns.forEach((b, i) => b.classList.toggle("on", !!t && t.life.level === i));
        if (t) {
            for (const [k, o] of Object.entries(colorIns)) o.ci.value = o.get();
            for (const [k, s] of Object.entries(sliders)) { const v = getPath(t, k); s.r.value = String(v); s.v.textContent = s.fmt(v); }
            for (const [k, i] of Object.entries(checks)) i.checked = !!getPath(t, k);
            bgSel.value = t.life.bgfx; fpsSel.value = String(t.life.fps || 0);
            paintWires();
        }
        // что подключено ко входу image
        const o = upstreamImage(node);
        imgInfo.textContent = o ? T("подключено: ", "wired: ") + (o.title || o.type) + (loadImageUrl(o) ? "" : T(" — нажмите Queue один раз", " — press Queue once"))
            : T("подключите Load Image ко входу image", "wire Load Image to the image input");
        if (off) status(T("Тема выключена. Выберите главный цвет — и тема появится", "The theme is off. Pick a main color and a theme appears"));
    }
    function paintExpert() {
        const on = node.properties.nts_expert === true;
        xp.style.display = on ? "flex" : "none";
        xBtn.classList.toggle("on", on);
        if (on && S.tab !== "create") { S.tab = "create"; save(); paintTabs(); }
        relayout();
    }
    function paintLook() {
        const t = getApplied();
        const vars = t ? themeVarsForNode(t) : {};
        for (const k of ["--nts-panel", "--nts-card", "--nts-input", "--nts-line", "--nts-text", "--nts-muted", "--nts-acc", "--nts-btn"]) {
            if (vars[k]) root.style.setProperty(k, vars[k]); else root.style.removeProperty(k);
        }
        if (t) root.style.setProperty("--nts-acc0", t.c.accent); else root.style.removeProperty("--nts-acc0");
    }
    function paintAll() { paintHead(); markCards(); paintCreate(); paintLook(); relayout(); }

    // главная ли эта нода (если на столе две ноды темы, работает первая)
    node.__ntsPaint = (main) => {
        const msgs = [];
        if (!main) msgs.push(T("⚠ На столе несколько нод Neron Theme — работает первая. Эту можно удалить.", "⚠ Several Neron Theme nodes on the canvas — the first one is in charge. This one can be deleted."));
        const old = ((app.graph && app.graph._nodes) || []).some((n) => (n.comfyClass || n.type) === OLD_NODE);
        if (old) msgs.push(T("⚠ На столе есть «Тема» из Neron Audio Studio — она тоже красит ноды студии. Оставьте одну из двух.", "⚠ The Audio Studio \"Theme\" node is also on the canvas — it paints the studio nodes too. Keep only one."));
        const txt = msgs.join(" ");
        if (warn.textContent !== txt) { warn.textContent = txt; warn.style.display = txt ? "block" : "none"; relayout(); }
        paintLook();
    };

    xBtn.addEventListener("click", () => { node.properties.nts_expert = !(node.properties.nts_expert === true); paintExpert(); });
    helpBtn.addEventListener("click", () => { help.style.display = help.style.display === "block" ? "none" : "block"; relayout(); });

    let sizer = null;
    function relayout() {
        if (sizer) { sizer.fit(); sizer.apply(); }
        node.setDirtyCanvas && node.setDirtyCanvas(true, true);
    }
    const dom = node.addDOMWidget("neron_theme", "neron_theme", root, { serialize: false, hideOnZoom: false });
    sizer = makeUserSized(node, dom, root, { minH: 200, autoH: () => Math.max(260, wrap.offsetHeight + 22) });

    node.properties = node.properties || {};
    paintCards(); paintTabs(); paintExpert(); paintAll();
    if (!MINE.loaded) loadMine();
    const wanted = node.computeSize ? node.computeSize() : [560, 600];
    node.setSize([Math.max(wanted[0], 560), Math.max(wanted[1], 420)]);

    node.__ntsReload = () => { load(); paintCards(); paintTabs(); paintExpert(); paintAll(); };
    node.__ntsSetDefault = () => {
        // новая нода на столе: сразу видно, что она делает
        if (!S.theme && !node.__ntsConfigured) setTheme({ ...BUILTIN.find((b) => b.id === DEFAULT_ID) }, T("Тема «Neron Brown» поставлена. Наведите на карточки, чтобы примерить другие", "Theme \"Neron Brown\" applied. Hover the cards to try others"));
    };
    node.__ntsImage = (f) => {
        S.lastImg = f; save();
        status(T("Картинка получена — нажмите 🖼 Из картинки", "Picture received — press 🖼 From picture"));
        paintCreate();
    };
    node.__ntsDispose = () => { MINE.listeners.delete(onMine); setPreview(null); };
    const onChange0 = engineState.onChange;
    engineState.onChange = (t) => { if (onChange0) try { onChange0(t); } catch (e) { /* ок */ } paintLook(); };
}

app.registerExtension({
    name: "Neron.ThemeStudio",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        registerType(nodeType, nodeData);              // роль каждой ноды — для цвета по ролям
        if (nodeData.name !== NODE) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created ? created.apply(this, arguments) : undefined;
            setupNode(this);
            const self = this;
            setTimeout(() => { if (self.__ntsSetDefault) self.__ntsSetDefault(); }, 0);
            return r;
        };
        const configure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = configure ? configure.apply(this, arguments) : undefined;
            this.__ntsConfigured = true;
            const self = this;
            setTimeout(() => { if (self.__ntsReload) self.__ntsReload(); }, 0);
            return r;
        };
        const executed = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (msg) {
            const r = executed ? executed.apply(this, arguments) : undefined;
            const f = msg && msg.neron_theme_img && msg.neron_theme_img[0];
            if (f && this.__ntsImage) this.__ntsImage(f);
            return r;
        };
        const removed = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.__ntsDispose) this.__ntsDispose();
            return removed ? removed.apply(this, arguments) : undefined;
        };
    },
});
