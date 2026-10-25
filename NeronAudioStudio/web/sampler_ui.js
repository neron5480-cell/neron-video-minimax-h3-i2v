import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { makeUserSized, peakOf, meterStep, drawMeter, meterTap } from "./neron_common.js";

// ============================================================================
//  Neron Sampler / Сэмплер
//  RU: Между «Звук ×8» и Пультом. Две части:
//      ИСТОЧНИКИ — каждый звук целиком; мышкой выделяете кусок «откуда — докуда».
//      ПОЛЕ — сетка по тактам, 4 слоя; выделенный кусок становится кирпичиком
//      (кнопка ➜ В ПОЛЕ или просто перетащить вниз). Кирпичики двигают, копируют,
//      обрезают. Пульт слышит только поле. ⏭ ПРОПУСТИТЬ — все звуки идут в Пульт как есть.
//  EN: Between "Sound ×8" and the Pult. SOURCES — every sound in full; select a piece
//      with the mouse. FIELD — a bar grid with 4 layers; a selected piece becomes a brick
//      (➜ TO FIELD or drag it down). The Pult hears only the field. ⏭ BYPASS — all
//      sounds go to the Pult as they are.
// ============================================================================

const NODE = "NeronSampler";
const MAX_SRC = 8, LAYERS = 4, MAX_BRICKS = 128;
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const LCOLORS = ["#ffd166", "#4dabf7", "#69db7c", "#f783ac"];
const SNAPS = [["bar", 4], ["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25], ["off", 0]];
const SRC_H = 36, HEAD_W = 190, RULER_H = 20, PEAK_BLOCK = 256, HANDLE = 10;
const T = (ru, en) => `${ru} / ${en}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`; };

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}
let uidN = 0;
const uid = () => Date.now().toString(36) + (uidN++).toString(36);
function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}
// координаты мыши внутри холста с учётом зума схемы ComfyUI (иначе клик «мимо»)
function pt(e, cv) {
    const r = cv.getBoundingClientRect();
    const kx = cv.clientWidth / (r.width || 1), ky = cv.clientHeight / (r.height || 1);
    return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
}

function injectStyles() {
    if (document.getElementById("neron-sampler-styles2")) return;
    const s = document.createElement("style");
    s.id = "neron-sampler-styles2";
    s.textContent = `
.nsp-outer{box-sizing:border-box;width:100%;padding-bottom:10px}
.nsp-root{box-sizing:border-box;width:100%;height:100%;padding:8px 10px;background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:5px;overflow:hidden;position:relative}
.nsp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:none}
.nsp-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;background:#4a4e5a;
  white-space:nowrap;line-height:24px;flex:none;font-family:inherit}
.nsp-btn:hover{filter:brightness(1.18)}
.nsp-btn:disabled{opacity:.4;cursor:default;filter:none}
.nsp-btn.sm{height:20px;line-height:20px;padding:0 7px;font-size:10px}
.nsp-byp{background:#3a3e48;color:#cfd2d8}
.nsp-byp.on{background:#d9a72b;color:#1b1d23}
.nsp-g{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.4px}
.nsp-g input[type=range]{width:80px;height:12px;margin:0;cursor:pointer;accent-color:#ff9f43}
.nsp-num{width:42px;height:20px;box-sizing:border-box;background:#23252b;color:#e6e8ee;border:1px solid #33363e;border-radius:4px;font-size:11px;text-align:center;outline:none}
.nsp-sel{height:20px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;font-size:10px;outline:none}
.nsp-status{flex:1;min-width:100px;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.nsp-status.err{color:#ff8a80}
.nsp-mm{width:120px;height:14px;flex:none;background:#101216;border-radius:3px}
.nsp-cap{flex:none;font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.5px;display:flex;align-items:center;gap:8px}
.nsp-cap i{font-style:normal;font-weight:400;color:#6b7080}
.nsp-srcs{flex:none;display:flex;flex-direction:column;gap:3px}
.nsp-src{display:flex;align-items:center;gap:6px;height:${SRC_H}px;background:#20232a;border-radius:6px;padding:0 6px;box-sizing:border-box}
.nsp-sname{width:${HEAD_W - 70}px;flex:none;display:flex;flex-direction:column;justify-content:center;min-width:0}
.nsp-sname b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nsp-sname span{font-size:9px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nsp-meter{width:12px;height:${SRC_H - 8}px;flex:none;background:#101216;border-radius:3px}
.nsp-wave{flex:1;min-width:60px;height:${SRC_H - 6}px;background:#15171c;border-radius:4px;cursor:text;display:block}
.nsp-field{flex:1;min-height:90px;display:flex;background:#15171c;border-radius:6px;overflow:hidden;position:relative}
.nsp-heads{flex:none;width:${HEAD_W}px;display:flex;flex-direction:column;background:#20232a}
.nsp-hcorner{flex:none;height:${RULER_H}px;border-bottom:1px solid #2a2d35;font-size:9px;color:#6b7080;display:flex;align-items:center;padding:0 6px}
.nsp-head{flex:1;min-height:0;box-sizing:border-box;border-bottom:1px solid #2a2d35;display:flex;align-items:center;gap:4px;padding:0 5px;overflow:hidden;cursor:pointer}
.nsp-head.cur{background:#272b34;box-shadow:inset 3px 0 0 var(--c)}
.nsp-head b{flex:1;min-width:0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nsp-head input[type=range]{width:44px;height:12px;margin:0;cursor:pointer}
.nsp-ms{width:19px;height:18px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:10px;font-weight:700;cursor:pointer;flex:none}
.nsp-ms.on-m{background:#b3414a;color:#fff}
.nsp-ms.on-s{background:#d9a72b;color:#1b1d23}
.nsp-grid{flex:1;min-width:0;position:relative}
.nsp-grid canvas{position:absolute;left:0;top:0}
.nsp-hs{flex:none;width:100%;height:10px;margin:0;accent-color:#6b7080}
.nsp-selp{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;min-height:22px;font-size:10px;color:#9aa0ae}
.nsp-selp b{color:#e6e8ee;font-size:11px}
.nsp-selp input[type=range]{width:90px;height:12px;margin:0;cursor:pointer;accent-color:#ffd166}
.nsp-byover{position:absolute;inset:0;background:rgba(21,23,28,.8);display:none;align-items:center;justify-content:center;text-align:center;
  font-size:12px;font-weight:700;color:#d9a72b;padding:12px;line-height:1.6;z-index:3}
.nsp-empty{font-size:11px;color:#6b7080;padding:6px 8px;background:#20232a;border-radius:6px}
`;
    document.head.appendChild(s);
}

const HELP = `NERON SAMPLER
===================================================
Sits between "Sound ×8" and the Pult (Neron Mixer).

⏭ BYPASS (on) — the sampler does nothing: every sound goes to the Pult as it is.
⏭ BYPASS (off) — the Pult hears only the FIELD (one channel).

SOURCES (top) — every sound in full
  • Drag the mouse along a waveform — select a piece "from — to".
  • Double click — select the whole sound. A click without dragging — clear.
  • ▶ in the row — listen to the piece (or the whole sound).
  • ➜ — put the piece into the FIELD, right after the last brick of the
    current layer. Or just drag the selected piece down into the field.

FIELD (bottom) — the result, a bar grid with 4 layers
  • Bricks: drag to move (also to another layer), drag edges to trim,
    white squares at the top corners — fade in / fade out.
  • Click a layer name — new bricks go to that layer.
  • GRID — bricks snap to bars / beats. BPM — tempo (the Pult syncs it).
  • Layer: M, S, volume, level meter. Top right — overall level.
  • Bottom panel: brick volume, fades, ✂ split, ⧉ copy, 🗑 delete.

MOUSE AND KEYS
  Wheel — zoom in / out · Shift+wheel or the bar below — scroll · ⤢ — fit all
  Space — play / stop · S — split at the cursor · Delete — delete
  Ctrl+D — copy right after · Ctrl+Z / Ctrl+Y — undo / redo
  Everything works while playing too.

The field plays in whole bars, so it loops evenly in the Pult.

===================================================
🇷🇺 РУССКИЙ
===================================================
Стоит между «Звук ×8» и Пультом (Neron Mixer).

⏭ ПРОПУСТИТЬ (нажата) — сэмплер не работает: все звуки идут в Пульт как есть.
⏭ ПРОПУСТИТЬ (отжата) — Пульт слышит только ПОЛЕ (одним каналом).

ИСТОЧНИКИ (вверху) — каждый звук целиком
  • Ведите мышкой по волне — выделяется кусок «откуда — докуда».
  • Двойной клик — выделить весь звук. Просто клик — снять выделение.
  • ▶ в строке — послушать кусок (или весь звук).
  • ➜ — положить кусок в ПОЛЕ, сразу за последним кирпичиком текущего слоя.
    Или просто перетащите выделенный кусок вниз, в поле.

ПОЛЕ (внизу) — результат, сетка по тактам, 4 слоя
  • Кирпичики: тяните — двигаются (и на другой слой), края — обрезка,
    белые квадратики в верхних углах — появление и затухание.
  • Клик по имени слоя — новые кирпичики пойдут в этот слой.
  • СЕТКА — кирпичики прилипают к тактам и долям. BPM — темп (Пульт подстраивает сам).
  • У слоя: M, S, громкость, индикатор уровня. Справа вверху — общий уровень.
  • Панель внизу: громкость кирпичика, появление, затухание, ✂ разрезать, ⧉ копия, 🗑 удалить.

МЫШЬ И КЛАВИШИ
  Колёсико — приблизить / отдалить · Shift+колёсико или полоса внизу — прокрутка · ⤢ — показать всё
  Пробел — играть / стоп · S — разрезать по курсору · Delete — удалить
  Ctrl+D — копия сразу после · Ctrl+Z / Ctrl+Y — отмена / повтор
  Всё работает и во время игры.

Поле играет целыми тактами, поэтому в Пульте повторяется ровно.
`;

function showHelp() {
    const overlay = el("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";
    const box = el("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;max-width:820px;max-height:85vh;" +
        "overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP;
    const btn = el("button", "", "Close / Закрыть");
    btn.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;border:none;border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

// ---------- звук источников: общий кеш на страницу ----------
const bufCache = new Map();
function computePeaks(buf) {
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const n = Math.ceil(buf.length / PEAK_BLOCK);
    const out = new Float32Array(n);
    for (let b = 0; b < n; b++) {
        let p = 0;
        for (let i = b * PEAK_BLOCK, e = Math.min(buf.length, i + PEAK_BLOCK); i < e; i += 2) {
            const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (v > p) p = v;
        }
        out[b] = p;
    }
    return out;
}
const soundSpec = (s) => ({ type: "file", name: s.name, subfolder: s.subfolder || "", kind: s.type || "input", start: s.start || 0, end: s.end || 0 });
function loadSound(s) {
    const key = JSON.stringify(soundSpec(s));
    let e = bufCache.get(key);
    if (e) return e;
    e = { state: "loading", buf: null, peaks: null };
    bufCache.set(key, e);
    e.p = (async () => {
        try {
            const res = await api.fetchApi("/neron/preview_wav", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(soundSpec(s)), cache: "no-store" });
            if (!res.ok) throw new Error(await res.text());
            e.buf = await getCtx().decodeAudioData(await res.arrayBuffer());
            e.peaks = computePeaks(e.buf);
            e.state = "ok";
        } catch (err) { e.state = "err"; e.err = String(err.message || err); }
        if (bufCache.size > 48) { for (const k of bufCache.keys()) { if (bufCache.size <= 40) break; if (bufCache.get(k).state !== "loading") bufCache.delete(k); } }
        return e;
    })();
    return e;
}

function blank() {
    return { version: 2, bypass: true, snap: "1/4", master: 1.0, zoom: 30, cur: 0,
        layers: Array.from({ length: LAYERS }, () => ({ vol: 0.8, pan: 0, mute: false, solo: false })), bricks: [], sel: {} };
}
function normalize(o) {
    const S = blank();
    if (!o || typeof o !== "object") return S;
    S.bypass = o.bypass !== false;
    if (SNAPS.some(([k]) => k === o.snap)) S.snap = o.snap;
    if (typeof o.master === "number") S.master = clamp(o.master, 0, 1.5);
    if (typeof o.zoom === "number") S.zoom = clamp(o.zoom, 4, 240);
    S.cur = clamp(Math.round(Number(o.cur) || 0), 0, LAYERS - 1);
    (Array.isArray(o.layers) ? o.layers : []).slice(0, LAYERS).forEach((l, i) => {
        if (!l) return;
        S.layers[i] = { vol: typeof l.vol === "number" ? clamp(l.vol, 0, 1.5) : 0.8, pan: typeof l.pan === "number" ? clamp(l.pan, -1, 1) : 0, mute: !!l.mute, solo: !!l.solo };
    });
    for (const c of (Array.isArray(o.bricks) ? o.bricks : []).slice(0, MAX_BRICKS)) {
        if (!c) continue;
        S.bricks.push({ id: c.id || uid(), src: clamp(Math.round(Number(c.src) || 0), 0, MAX_SRC - 1), layer: clamp(Math.round(Number(c.layer) || 0), 0, LAYERS - 1),
            beat: Math.max(0, Number(c.beat) || 0), in: Math.max(0, Number(c.in) || 0), len: Math.max(0.02, Number(c.len) || 1),
            gain: typeof c.gain === "number" ? clamp(c.gain, 0, 2) : 1, fin: Math.max(0, Number(c.fin) || 0), fout: Math.max(0, Number(c.fout) || 0) });
    }
    if (o.sel && typeof o.sel === "object") for (const [k, v] of Object.entries(o.sel)) if (v && v.b > v.a) S.sel[k] = { a: Number(v.a), b: Number(v.b) };
    return S;
}

function setupSampler(node) {
    injectStyles();
    const wJson = (node.widgets || []).find((x) => x.name === "sampler_json");
    const wBpm = (node.widgets || []).find((x) => x.name === "bpm");
    for (const w of [wJson, wBpm]) if (w) { w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4]; }

    let S = blank();
    let items = [];
    let selB = null;                 // выделенный кирпичик
    const undoS = [], redoS = [];
    let disposed = false;
    const bpm = () => clamp(Math.round(Number(wBpm ? wBpm.value : 90) || 90), 40, 300);
    const spb = () => 60 / bpm();
    const snapBeats = () => (SNAPS.find(([k]) => k === S.snap) || SNAPS[2])[1];

    const loadState = () => { let o = null; try { o = JSON.parse(wJson ? wJson.value : "{}"); } catch (e) { o = null; } S = normalize(o); };
    let saveT = null;
    const save = () => {
        if (saveT) return;
        saveT = setTimeout(() => {
            saveT = null;
            if (!wJson) return;
            wJson.value = JSON.stringify(S);
            if (typeof wJson.callback === "function") { try { wJson.callback(wJson.value); } catch (e) { /* ок */ } }
        }, 120);
    };
    const pushUndo = () => { undoS.push(JSON.stringify(S)); if (undoS.length > 60) undoS.shift(); redoS.length = 0; };
    const undo = () => { if (!undoS.length) return; redoS.push(JSON.stringify(S)); S = normalize(JSON.parse(undoS.pop())); changed(); };
    const redo = () => { if (!redoS.length) return; undoS.push(JSON.stringify(S)); S = normalize(JSON.parse(redoS.pop())); changed(); };

    // ---------- что пришло по проводу ----------
    function getLink(id) { const g = node.graph; if (!g || !g.links) return null; return g.links instanceof Map ? g.links.get(id) : g.links[id]; }
    function upstream() {
        const inp = (node.inputs || []).find((x) => x.name === "sounds");
        if (!inp || inp.link === null || inp.link === undefined) return [];
        let id = inp.link;
        for (let hop = 0; hop < 6; hop++) {
            const l = getLink(id);
            if (!l) return [];
            const o = node.graph.getNodeById(l.origin_id);
            if (!o) return [];
            if (o.type === "Reroute") { const i0 = o.inputs && o.inputs[0]; if (i0 && i0.link != null) { id = i0.link; continue; } return []; }
            if (typeof o.neronCube === "function") { const c = o.neronCube(); return c && c.kind === "sounds" && !c.spec ? c.items.slice(0, MAX_SRC) : []; }
            return [];
        }
        return [];
    }
    const keyOf = (s) => (s ? JSON.stringify(soundSpec(s)) : "");

    node.neronCube = () => ({
        kind: "sounds", bypass: S.bypass, items: items.map((x) => ({ ...x })),
        spec: S.bypass ? null : { type: "sampler", json: JSON.stringify(S), sounds: items.map((x) => ({ ...x })), bpm: bpm() },
        bpm: bpm(),
    });

    // ---------- каркас ----------
    const outer = el("div", "nsp-outer");
    const root = el("div", "nsp-root");
    outer.appendChild(root);
    const mk = (t, c, title, cls) => { const b = el("button", "nsp-btn" + (cls ? " " + cls : ""), t); if (c) b.style.background = c; if (title) b.title = title; return b; };

    const bar = el("div", "nsp-bar");
    const byp = mk("⏭ " + T("ПРОПУСТИТЬ", "BYPASS"), null, T("Нажата — все звуки идут в Пульт как есть. Отжата — Пульт слышит только ПОЛЕ.",
        "On — all sounds go to the Pult as they are. Off — the Pult hears only the FIELD."), "nsp-byp");
    const playB = mk("▶", "#3fa34d", T("Играть поле по кругу (Пробел)", "Play the field in a loop (Space)"));
    const stopB = mk("■", "#b3414a", T("Стоп", "Stop"));
    const gB = el("div", "nsp-g");
    gB.appendChild(document.createTextNode("BPM"));
    const bpmR = el("input"); bpmR.type = "range"; bpmR.min = "40"; bpmR.max = "300"; bpmR.step = "1";
    const bpmN = el("input", "nsp-num"); bpmN.type = "text";
    gB.appendChild(bpmR); gB.appendChild(bpmN);
    gB.title = T("Темп поля. Пульт подстраивает его сам (СИНХР.)", "Field tempo. The Pult syncs it (SYNC)");
    const gS = el("div", "nsp-g");
    gS.appendChild(document.createTextNode(T("СЕТКА", "GRID")));
    const snapSel = el("select", "nsp-sel");
    for (const [k] of SNAPS) { const o = el("option", "", k === "bar" ? T("такт", "bar") : k === "off" ? T("без сетки", "free") : k); o.value = k; snapSel.appendChild(o); }
    gS.appendChild(snapSel);
    const fitB = mk("⤢", null, T("Показать всё поле", "Fit the whole field"), "sm");
    const status = el("div", "nsp-status", "");
    const mMeter = el("canvas", "nsp-mm");
    mMeter.title = T("Общий уровень L/R. Красное — перегруз", "Overall level L/R. Red — clipping");
    const helpB = mk("📖", null, T("Справка", "Help"), "sm");
    [byp, playB, stopB, gB, gS, fitB, status, mMeter, helpB].forEach((x) => bar.appendChild(x));
    root.appendChild(bar);

    const cap1 = el("div", "nsp-cap");
    cap1.appendChild(document.createTextNode("① " + T("ИСТОЧНИКИ", "SOURCES")));
    cap1.appendChild(el("i", "", T("ведите мышкой по волне — выделится кусок; ➜ или перетащите его вниз", "drag along a wave to select a piece; ➜ or drag it down")));
    root.appendChild(cap1);
    const srcBox = el("div", "nsp-srcs");
    root.appendChild(srcBox);
    const cap2 = el("div", "nsp-cap");
    cap2.appendChild(document.createTextNode("② " + T("ПОЛЕ", "FIELD")));
    cap2.appendChild(el("i", "", T("результат — его слышит Пульт", "the result — the Pult hears it")));
    root.appendChild(cap2);
    const field = el("div", "nsp-field");
    const heads = el("div", "nsp-heads");
    const grid = el("div", "nsp-grid");
    const cv = el("canvas"), ov = el("canvas");
    ov.style.pointerEvents = "none";
    grid.appendChild(cv); grid.appendChild(ov);
    const byOver = el("div", "nsp-byover", T("⏭ ПРОПУСТИТЬ включена: все звуки идут в Пульт как есть, каждый своим каналом. Отожмите, чтобы собрать поле.",
        "⏭ BYPASS is on: all sounds go to the Pult as they are. Turn it off to build the field."));
    field.appendChild(heads); field.appendChild(grid); field.appendChild(byOver);
    root.appendChild(field);
    const hs = el("input", "nsp-hs");
    hs.type = "range"; hs.min = "0"; hs.max = "1000"; hs.value = "0";
    hs.title = T("Прокрутка (Shift+колёсико)", "Scroll (Shift+wheel)");
    root.appendChild(hs);
    const selp = el("div", "nsp-selp");
    root.appendChild(selp);
    // клавиши принимает скрытое поле: ComfyUI их не трогает (Delete не удалит ноду, Ctrl+Z не откатит граф)
    const keys = el("textarea");
    keys.readOnly = true; keys.tabIndex = -1;
    keys.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    root.appendChild(keys);
    const refocus = () => setTimeout(() => { if (!disposed) keys.focus({ preventScroll: true }); }, 0);

    function setStatus(t, err) { status.textContent = t || ""; status.title = t || ""; status.className = "nsp-status" + (err ? " err" : ""); }

    // ---------- звук: слои поля, предпрослушивание источника, индикаторы ----------
    const A = { master: null, mtap: null, layers: [], prev: null, ptap: null };
    function audio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!A.master) {
            A.master = ctx.createGain();
            A.master.connect(ctx.destination);
            A.mtap = meterTap(ctx, A.master);
            for (let i = 0; i < LAYERS; i++) {
                const inp = ctx.createGain(); inp.channelCount = 2; inp.channelCountMode = "explicit";
                const sp = ctx.createChannelSplitter(2), gl = ctx.createGain(), gr = ctx.createGain(), mg = ctx.createChannelMerger(2), vol = ctx.createGain();
                inp.connect(sp); sp.connect(gl, 0); sp.connect(gr, 1); gl.connect(mg, 0, 0); gr.connect(mg, 0, 1); mg.connect(vol); vol.connect(A.master);
                A.layers.push({ inp, gl, gr, vol, tap: meterTap(ctx, vol), mL: {}, mR: {} });
            }
            A.prev = ctx.createGain();
            A.prev.connect(A.master);
            A.ptap = meterTap(ctx, A.prev);
        }
        mix();
        return ctx;
    }
    function mix() {
        if (!A.master) return;
        const ctx = getCtx();
        A.master.gain.setTargetAtTime(S.master, ctx.currentTime, 0.01);
        const solo = S.layers.some((l) => l.solo);
        S.layers.forEach((l, i) => {
            const c = A.layers[i];
            // ▶ у слоя: играет только он (M и S при этом не мешают)
            const on = P.only >= 0 ? i === P.only : !l.mute && (!solo || l.solo);
            c.vol.gain.setTargetAtTime(on ? l.vol : 0, ctx.currentTime, 0.01);
            c.gl.gain.value = Math.min(1, 1 - l.pan); c.gr.gain.value = Math.min(1, 1 + l.pan);
        });
    }

    // поле по кругу
    const P = { on: false, c0: 0, t0: 0, L: 0, next: 0, srcs: [], timer: null, raf: null, only: -1 };
    let pos = 0;
    // предпрослушивание куска источника
    const PV = { src: null, i: -1, c0: 0, a: 0, b: 0 };
    function piece(ctx, buf, c, cycleStart, from) {
        const start = c.beat * spb(), len = c.len;
        if (start + len <= from) return;
        const skip = Math.max(0, from - start);
        const off = c.in + skip;
        if (off >= buf.duration) return;
        const dur = Math.min(len - skip, buf.duration - off);
        const when = cycleStart + Math.max(start, from), cs = cycleStart + start;
        const env = (t) => { let v = 1; if (c.fin > 0 && t < c.fin) v = Math.min(v, t / c.fin); if (c.fout > 0 && t > len - c.fout) v = Math.min(v, (len - t) / c.fout); return Math.max(0, v) * c.gain; };
        const s = ctx.createBufferSource(); s.buffer = buf;
        const gn = ctx.createGain();
        s.connect(gn); gn.connect(A.layers[c.layer].inp);
        gn.gain.setValueAtTime(env(skip), when);
        if (c.fin > 0 && skip < c.fin) gn.gain.linearRampToValueAtTime(env(c.fin), cs + c.fin);
        if (c.fout > 0) { const fs = len - c.fout; if (skip < fs) gn.gain.setValueAtTime(env(fs), cs + fs); gn.gain.linearRampToValueAtTime(0, cs + len); }
        s.start(Math.max(when, ctx.currentTime), off, dur);
        P.srcs.push({ s, end: cs + len });
    }
    function scheduleCycle(k) {
        const ctx = getCtx();
        const cycleStart = P.c0 - P.t0 + k * P.L;
        const from = k === 0 ? P.t0 : 0;
        for (const c of S.bricks) {
            const snd = items[c.src];
            const e = snd ? loadSound(snd) : null;
            if (e && e.state === "ok") piece(ctx, e.buf, c, cycleStart, from);
        }
    }
    function pump() {
        if (!P.on) return;
        const now = getCtx().currentTime;
        while (P.c0 - P.t0 + P.next * P.L < now + 0.5) { scheduleCycle(P.next); P.next++; }
        P.srcs = P.srcs.filter((x) => x.end > now - 0.5);
    }
    const patternBeats = () => { let e = 0; for (const c of S.bricks) e = Math.max(e, c.beat + c.len / spb()); return Math.max(4, Math.ceil(e / 4 - 1e-6) * 4); };
    async function play() {
        if (S.bypass) { setStatus(T("Включена ⏭ ПРОПУСТИТЬ: слушайте в Пульте", "⏭ BYPASS is on: listen in the Pult")); return; }
        if (P.on) return;
        stopPreview();
        if (!S.bricks.length) { setStatus(T("Поле пустое: выделите кусок в источнике и нажмите ➜", "The field is empty: select a piece in a source and press ➜"), true); return; }
        const waits = items.map((s) => loadSound(s)).filter((e) => e.state === "loading").map((e) => e.p);
        if (waits.length) { setStatus(T("Готовлю звук...", "Preparing sound...")); await Promise.all(waits); }
        if (disposed || P.on) return;
        const ctx = audio();
        P.L = patternBeats() * spb();
        P.t0 = ((pos % P.L) + P.L) % P.L;
        P.c0 = ctx.currentTime + 0.05;
        P.next = 0;
        P.on = true;
        pump();
        P.timer = setInterval(pump, 100);
        startLoop();
        playB.style.background = "#2e8b3d";
        setStatus(T("Играет по кругу — можно править прямо во время игры", "Playing in a loop — you can edit while it plays"));
    }
    function stopField() {
        if (P.on) pos = curPos();
        P.on = false;
        for (const x of P.srcs) { try { x.s.stop(); } catch (e) { /* ок */ } }
        P.srcs = [];
        if (P.timer) { clearInterval(P.timer); P.timer = null; }
        playB.style.background = "#3fa34d";
        P.only = -1;
        mix();
        showLayerPlay();
        drawHead();
    }
    // кнопки ▶ / ■ у слоёв
    function showLayerPlay() {
        heads.querySelectorAll("button[data-lplay]").forEach((b) => {
            const i = Number(b.dataset.lplay);
            const act = P.on && P.only === i;
            b.textContent = act ? "■" : "▶";
            b.style.background = act ? "#2e8b3d" : "#2f4a35";
            b.style.color = act ? "#fff" : "#9ad8a4";
        });
    }
    function playLayer(i) {
        if (P.on && P.only === i) { stopField(); return; }
        P.only = i;
        mix();
        showLayerPlay();
        if (!P.on) play().then(showLayerPlay);
        else setStatus(T(`Играет только слой ${i + 1}`, `Playing only layer ${i + 1}`));
    }
    function curPos() {
        if (!P.on) return pos;
        const t = getCtx().currentTime - P.c0 + P.t0;
        return P.L > 0 ? ((t % P.L) + P.L) % P.L : t;
    }
    // правка во время игры: звук пересобирается с того же места, без паузы для глаза
    let restartT = null;
    function restartSoon() {
        if (!P.on) return;
        if (restartT) clearTimeout(restartT);
        restartT = setTimeout(() => {
            restartT = null;
            if (!P.on) return;
            const t = curPos();
            for (const x of P.srcs) { try { x.s.stop(); } catch (e) { /* ок */ } }
            P.srcs = [];
            const ctx = getCtx();
            P.L = patternBeats() * spb();
            P.t0 = ((t % P.L) + P.L) % P.L;
            P.c0 = ctx.currentTime + 0.03;
            P.next = 0;
            pump();
        }, 80);
    }
    function seek(t) {
        pos = Math.max(0, t);
        if (P.on) {
            for (const x of P.srcs) { try { x.s.stop(); } catch (e) { /* ок */ } }
            P.srcs = [];
            const ctx = getCtx();
            P.L = patternBeats() * spb();
            P.t0 = ((pos % P.L) + P.L) % P.L;
            P.c0 = ctx.currentTime + 0.03;
            P.next = 0;
            pump();
        }
        drawHead();
    }

    // слушать источник: выделенный кусок, иначе от курсора (или с места клика) до конца
    function preview(i, from) {
        if (PV.src && PV.i === i && from === undefined) { stopPreview(); return; }
        stopPreview();
        const s = items[i];
        const e = s ? loadSound(s) : null;
        if (!e || e.state !== "ok") { setStatus(T("Звук ещё загружается", "The sound is still loading")); return; }
        const ctx = audio();
        const sel = S.sel[i];
        const a = from !== undefined ? from : sel ? sel.a : (curs[i] || 0);
        const b = sel && from === undefined ? sel.b : e.buf.duration;
        if (b - a < 0.02) return;
        const src = ctx.createBufferSource();
        src.buffer = e.buf;
        src.connect(A.prev);
        src.start(ctx.currentTime + 0.02, a, b - a);
        src.onended = () => { if (PV.src === src) stopPreview(); };
        Object.assign(PV, { src, i, c0: ctx.currentTime + 0.02, a, b });
        startLoop();
        drawSources();
    }
    function stopPreview() {
        if (PV.src) { try { PV.src.stop(); } catch (e) { /* ок */ } }
        PV.src = null; PV.i = -1;
        drawSources();
    }

    // один цикл анимации: курсор, индикаторы. Пока ничего не играет — останавливается сам.
    let loopRaf = null;
    const meters = { mL: {}, mR: {}, sL: {}, sR: {} };
    function startLoop() { if (!loopRaf) loopRaf = requestAnimationFrame(tickAnim); }
    function tickAnim() {
        loopRaf = null;
        if (disposed || !A.master) return;
        const now = performance.now();
        let alive = P.on || !!PV.src;
        meterStep(meters.mL, peakOf(A.mtap.aL), now); meterStep(meters.mR, peakOf(A.mtap.aR), now);
        drawMeter(mMeter, meters.mL, meters.mR, false);
        if (meters.mL.v > 0.002 || meters.mR.v > 0.002) alive = true;
        A.layers.forEach((L, i) => {
            meterStep(L.mL, peakOf(L.tap.aL), now); meterStep(L.mR, peakOf(L.tap.aR), now);
            const cvm = heads.querySelector(`canvas[data-layer="${i}"]`);
            if (cvm) drawMeter(cvm, L.mL, L.mR, true);
            if (L.mL.v > 0.002 || L.mR.v > 0.002) alive = true;
        });
        meterStep(meters.sL, peakOf(A.ptap.aL), now); meterStep(meters.sR, peakOf(A.ptap.aR), now);
        srcBox.querySelectorAll("canvas.nsp-meter").forEach((c) => {
            const on = PV.src && Number(c.dataset.src) === PV.i;
            drawMeter(c, on ? meters.sL : {}, on ? meters.sR : {}, true);
        });
        if (meters.sL.v > 0.002) alive = true;
        if (P.on) drawHead();
        if (PV.src) drawSourceHead();
        if (alive && !document.hidden) loopRaf = requestAnimationFrame(tickAnim);
    }

    // ---------- ИСТОЧНИКИ ----------
    // RU: Клик — курсор «играть отсюда». Повести вбок — выделить кусок (всегда новый).
    //     Края выделения тянутся. Выделенный кусок повести вниз — уходит в поле.
    //     Колёсико над волной — приблизить этот звук вокруг мышки, Shift — сдвинуть.
    // EN: Click — "play from here" cursor. Drag sideways — a new selection. Selection
    //     edges can be dragged. Drag the selection down — into the field. Wheel zooms.
    const srcRows = [];      // {cv, info}
    const curs = {};         // курсор «играть отсюда» у каждого источника (секунды)
    const sv = {};           // видимое окно каждого источника {t0, t1}
    const durOf = (i) => { const s = items[i]; const e = s && loadSound(s); return e && e.state === "ok" ? e.buf.duration : 0; };
    const win = (i) => { const d = durOf(i); const w = sv[i]; return w && w.t1 > w.t0 && w.t1 <= d + 1e-6 ? w : { t0: 0, t1: d }; };
    const tOfX = (i, x, W) => { const w = win(i); return clamp(w.t0 + (x / W) * (w.t1 - w.t0), 0, durOf(i)); };
    const xOfT = (i, t, W) => { const w = win(i); return ((t - w.t0) / (w.t1 - w.t0)) * W; };

    function buildSources() {
        srcBox.innerHTML = "";
        srcRows.length = 0;
        if (!items.length) {
            srcBox.appendChild(el("div", "nsp-empty", T("Подключите «Звук ×8» ко входу sounds — здесь появятся звуки.", "Wire \"Sound ×8\" into the sounds input — the sounds appear here.")));
            return;
        }
        items.forEach((s, i) => {
            const row = el("div", "nsp-src");
            const nm = el("div", "nsp-sname");
            const b = el("b", "", `${i + 1}. ${s.name}`);
            b.style.color = COLORS[i];
            b.title = s.name;
            const info = el("span", "", "");
            nm.appendChild(b); nm.appendChild(info);
            const pl = mk("▶", "#3fa34d", T("Играть: выделенный кусок, а если его нет — от курсора", "Play: the selected piece, or from the cursor if there is none"), "sm");
            pl.addEventListener("click", () => preview(i));
            const meter = el("canvas", "nsp-meter");
            meter.dataset.src = String(i);
            const wave = el("canvas", "nsp-wave");
            wave.title = T("Клик — играть отсюда · вбок — выделить · края выделения тянутся · выделенное вниз — в поле · колёсико — приблизить",
                "Click — play from here · sideways — select · drag selection edges · drag the selection down — into the field · wheel — zoom");
            const go = mk("➜", "#6b4fb3", T("Положить кусок в поле (за последним кирпичиком слоя)", "Put the piece into the field (after the last brick of the layer)"), "sm");
            go.addEventListener("click", () => toField(i));
            [nm, pl, meter, wave, go].forEach((x) => row.appendChild(x));
            srcBox.appendChild(row);
            srcRows[i] = { cv: wave, info, play: pl };
            wave.addEventListener("pointerdown", (e) => srcDown(e, i));
            wave.addEventListener("pointermove", (e) => { if (!sdrag) wave.style.cursor = edgeAt(i, pt(e, wave).x, wave.clientWidth) ? "ew-resize" : "text"; });
            wave.addEventListener("dblclick", () => {
                const d = durOf(i);
                if (!d) return;
                const w = win(i);
                S.sel[i] = { a: w.t0, b: w.t1 };
                save(); drawSources();
            });
            wave.addEventListener("wheel", (e) => {
                e.preventDefault(); e.stopPropagation();
                const d = durOf(i);
                if (!d) return;
                const W = wave.clientWidth;
                const w = win(i);
                const span = w.t1 - w.t0;
                if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    const sh = ((e.shiftKey ? e.deltaY : e.deltaX) / W) * span;
                    const t0 = clamp(w.t0 + sh, 0, d - span);
                    sv[i] = { t0, t1: t0 + span };
                } else {
                    const tm = tOfX(i, pt(e, wave).x, W);
                    const ns = clamp(span * (e.deltaY < 0 ? 1 / 1.25 : 1.25), Math.min(d, 0.25), d);
                    const k = (tm - w.t0) / span;
                    const t0 = clamp(tm - k * ns, 0, d - ns);
                    sv[i] = { t0, t1: t0 + ns };
                }
                drawSources();
            }, { passive: false });
        });
        drawSources();
    }
    function edgeAt(i, x, W) {
        const sel = S.sel[i];
        if (!sel) return null;
        if (Math.abs(x - xOfT(i, sel.a, W)) <= 5) return "a";
        if (Math.abs(x - xOfT(i, sel.b, W)) <= 5) return "b";
        return null;
    }
    function drawSources() {
        items.forEach((s, i) => {
            const r = srcRows[i];
            if (!r) return;
            const cvw = r.cv;
            const W = cvw.clientWidth, H = cvw.clientHeight;
            if (W < 4) return;
            const d = window.devicePixelRatio || 1;
            if (cvw.width !== Math.round(W * d) || cvw.height !== Math.round(H * d)) { cvw.width = Math.round(W * d); cvw.height = Math.round(H * d); }
            const g = cvw.getContext("2d");
            g.setTransform(d, 0, 0, d, 0, 0);
            g.clearRect(0, 0, W, H);
            const e = loadSound(s);
            if (e.state !== "ok") {
                g.fillStyle = "#6b7080"; g.font = "10px Segoe UI, Arial"; g.textBaseline = "middle";
                g.fillText(e.state === "err" ? T("ошибка: ", "error: ") + e.err : T("загрузка...", "loading..."), 6, H / 2);
                if (e.state === "loading") e.p.then(() => { drawSources(); draw(); });
                cvw._base = null;
                return;
            }
            const dur = e.buf.duration, w = win(i), sr = e.buf.sampleRate;
            const sel = S.sel[i];
            if (sel) {
                g.fillStyle = "rgba(255,255,255,0.12)";
                g.fillRect(xOfT(i, sel.a, W), 0, xOfT(i, sel.b, W) - xOfT(i, sel.a, W), H);
            }
            for (let x = 0; x < W; x++) {
                const ta = w.t0 + (x / W) * (w.t1 - w.t0), tb = w.t0 + ((x + 1) / W) * (w.t1 - w.t0);
                const ia = Math.floor((ta * sr) / PEAK_BLOCK), ib = Math.max(ia + 1, Math.floor((tb * sr) / PEAK_BLOCK));
                let p = 0;
                for (let k = Math.max(0, ia); k < Math.min(ib, e.peaks.length); k++) if (e.peaks[k] > p) p = e.peaks[k];
                g.fillStyle = sel && ta >= sel.a && ta <= sel.b ? COLORS[i] : "rgba(160,165,180,0.45)";
                const h = Math.max(1, p * H * 0.9);
                g.fillRect(x, (H - h) / 2, 1, h);
            }
            if (sel) {
                g.fillStyle = "#fff";
                g.fillRect(Math.round(xOfT(i, sel.a, W)), 0, 2, H);
                g.fillRect(Math.round(xOfT(i, sel.b, W)) - 2, 0, 2, H);
            }
            // курсор «играть отсюда»
            if (curs[i] !== undefined && !sel) {
                g.fillStyle = "#ffd166";
                const cx = Math.round(xOfT(i, curs[i], W));
                g.fillRect(cx - 1, 0, 2, H);
                g.beginPath(); g.moveTo(cx - 5, 0); g.lineTo(cx + 5, 0); g.lineTo(cx, 6); g.closePath(); g.fill();
            }
            // приближено — показать, какая часть звука на экране
            if (w.t1 - w.t0 < dur - 0.01) {
                g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, H - 4, W, 4);
                g.fillStyle = "#8b90a0"; g.fillRect((w.t0 / dur) * W, H - 4, Math.max(3, ((w.t1 - w.t0) / dur) * W), 4);
            }
            r.info.textContent = sel ? `${fmt(sel.a)} – ${fmt(sel.b)} · ${(sel.b - sel.a).toFixed(2)} ${T("с", "s")}`
                : curs[i] !== undefined ? `▶ ${T("от", "from")} ${fmt(curs[i])} · ${fmt(dur)}` : `${T("весь звук", "whole sound")} · ${fmt(dur)}`;
            r.play.textContent = PV.src && PV.i === i ? "■" : "▶";
            cvw._base = null;          // подложка для курсора прослушивания — пересоберётся
        });
        drawSourceHead();
    }
    function drawSourceHead() {
        if (!PV.src || !srcRows[PV.i]) return;
        const i = PV.i;
        if (!durOf(i)) return;
        const cvw = srcRows[i].cv;
        const t = PV.a + (getCtx().currentTime - PV.c0);
        const W = cvw.clientWidth, H = cvw.clientHeight;
        const g = cvw.getContext("2d");
        if (!cvw._base || cvw._base.width !== cvw.width) { cvw._base = document.createElement("canvas"); cvw._base.width = cvw.width; cvw._base.height = cvw.height; cvw._base.getContext("2d").drawImage(cvw, 0, 0); }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(cvw._base, 0, 0);
        const d = window.devicePixelRatio || 1;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.fillStyle = "#fff";
        g.fillRect(Math.round(xOfT(i, t, W)) - 1, 0, 2, H);
    }

    // мышь на волне источника
    let sdrag = null;
    function srcDown(e, i) {
        refocus();
        if (e.button !== 0) return;
        const dur = durOf(i);
        if (!dur) return;
        const cvw = srcRows[i].cv;
        const W = cvw.clientWidth;
        const p = pt(e, cvw);
        const t = tOfX(i, p.x, W);
        const sel = S.sel[i];
        const edge = edgeAt(i, p.x, W);
        sdrag = { i, cvw, W, t0: t, x0: e.clientX, y0: e.clientY, mode: edge ? "edge" + edge : "pending",
            inSel: !!(sel && t >= sel.a && t <= sel.b), ghost: null };
        cvw.setPointerCapture(e.pointerId);
        const mv = (ev) => srcMove(ev);
        const up = (ev) => { cvw.removeEventListener("pointermove", mv); cvw.removeEventListener("pointerup", up); cvw.removeEventListener("pointercancel", up); srcUp(ev); };
        cvw.addEventListener("pointermove", mv);
        cvw.addEventListener("pointerup", up);
        cvw.addEventListener("pointercancel", up);
    }
    function srcMove(e) {
        const d = sdrag;
        if (!d) return;
        const p = pt(e, d.cvw);
        const t = tOfX(d.i, p.x, d.W);
        if (d.mode === "pending") {
            const dx = Math.abs(e.clientX - d.x0), dy = Math.abs(e.clientY - d.y0);
            // выделенный кусок повели вниз — тащим в поле; вбок — новое выделение
            if (d.inSel && dy > 12 && dy > dx && !S.bypass) d.mode = "grab";
            else if (dx > 3) d.mode = "select";
            else return;
        }
        if (d.mode === "edgea" || d.mode === "edgeb") {
            const sel = S.sel[d.i];
            if (!sel) return;
            if (d.mode === "edgea") sel.a = clamp(t, 0, sel.b - 0.01); else sel.b = clamp(t, sel.a + 0.01, durOf(d.i));
            drawSources();
        } else if (d.mode === "select") {
            const a = Math.min(d.t0, t), b = Math.max(d.t0, t);
            if (b - a >= 0.01) S.sel[d.i] = { a, b }; else delete S.sel[d.i];
            drawSources();
        } else if (d.mode === "grab") {
            const q = pt(e, cv);
            d.ghost = q.inside && q.y > RULER_H ? { beat: Math.max(0, snapB(beatAt(q.x))), layer: clamp(Math.floor((q.y - RULER_H) / laneH()), 0, LAYERS - 1) } : null;
            draw();
        }
    }
    function srcUp() {
        const d = sdrag;
        sdrag = null;
        if (!d) return;
        if (d.mode === "pending") {
            // просто клик: курсор «играть отсюда»; клик мимо выделения снимает его
            if (!d.inSel) delete S.sel[d.i];
            curs[d.i] = d.t0;
            if (PV.src && PV.i === d.i) { stopPreview(); preview(d.i, d.t0); }
            save(); drawSources();
        } else if (d.mode === "grab") {
            if (d.ghost) toField(d.i, d.ghost.beat, d.ghost.layer);
            draw();
        } else save();
        refocus();
    }

    // кусок источника -> кирпичик в поле
    function toField(i, beat, layer) {
        if (S.bypass) { setStatus(T("Сначала отожмите ⏭ ПРОПУСТИТЬ", "Turn ⏭ BYPASS off first"), true); return; }
        const s = items[i];
        const e = s ? loadSound(s) : null;
        if (!e || e.state !== "ok") { setStatus(T("Звук ещё загружается", "The sound is still loading"), true); return; }
        if (S.bricks.length >= MAX_BRICKS) { setStatus(T("Не больше 128 кирпичиков", "No more than 128 bricks"), true); return; }
        const sel = S.sel[i] || { a: curs[i] || 0, b: e.buf.duration };
        pushUndo();
        const L = layer === undefined ? S.cur : layer;
        let at = beat;
        if (at === undefined) {
            // сразу за последним кирпичиком слоя, по сетке
            let end = 0;
            for (const c of S.bricks) if (c.layer === L) end = Math.max(end, c.beat + c.len / spb());
            const sb = snapBeats() || 0.25;
            at = Math.ceil(end / sb - 1e-6) * sb;
        }
        const c = { id: uid(), src: i, layer: L, beat: at, in: sel.a, len: Math.max(0.02, sel.b - sel.a), gain: 1, fin: 0, fout: 0 };
        S.bricks.push(c);
        selB = c.id;
        // поле стало длиннее видимого — показать всё
        if ((c.beat + c.len / spb()) * S.zoom - view.sx > grid.clientWidth - 10) fitView();
        changed();
        setStatus(T(`Кирпичик в слой ${L + 1}: ${(c.len).toFixed(2)} с`, `Brick into layer ${L + 1}: ${(c.len).toFixed(2)} s`));
    }

    // ---------- ПОЛЕ: геометрия ----------
    const view = { sx: 0 };
    const laneH = () => Math.max(14, (grid.clientHeight - RULER_H) / LAYERS);
    const pxb = () => S.zoom;
    const xAt = (beat) => beat * pxb() - view.sx;
    const beatAt = (x) => (x + view.sx) / pxb();
    const lenB = (c) => c.len / spb();
    const viewBeats = () => Math.max(patternBeats() + 4, 16);
    const snapB = (b) => { const s = snapBeats(); return s > 0 ? Math.round(b / s) * s : b; };
    function fitView() {
        const W = grid.clientWidth;
        if (W < 20) return;
        S.zoom = clamp((W - 20) / (patternBeats() + 1), 4, 240);
        view.sx = 0;
        save();
    }

    function buildHeads() {
        heads.innerHTML = "";
        const corner = el("div", "nsp-hcorner", T("слои", "layers"));
        corner.title = T("Клик по слою — новые кирпичики пойдут в него", "Click a layer — new bricks go into it");
        heads.appendChild(corner);
        for (let i = 0; i < LAYERS; i++) {
            const l = S.layers[i];
            const h = el("div", "nsp-head" + (S.cur === i ? " cur" : ""));
            h.style.setProperty("--c", LCOLORS[i]);
            h.title = T("Клик — новые кирпичики пойдут в этот слой", "Click — new bricks go to this layer");
            const n = el("b", "", `${i + 1}`);
            n.style.fontSize = "13px";
            n.style.color = LCOLORS[i];
            const lp = el("button", "nsp-ms", "▶");
            lp.dataset.lplay = String(i);
            lp.title = T("Играть только этот слой (ещё раз — стоп)", "Play only this layer (again — stop)");
            lp.addEventListener("click", (e) => { e.stopPropagation(); playLayer(i); });
            const m = el("button", "nsp-ms" + (l.mute ? " on-m" : ""), "M");
            m.title = T("Выключить слой", "Mute");
            const s = el("button", "nsp-ms" + (l.solo ? " on-s" : ""), "S");
            s.title = T("Только этот слой", "Solo");
            const v = el("input");
            v.type = "range"; v.min = "0"; v.max = "1.2"; v.step = "0.01"; v.value = String(l.vol);
            v.style.accentColor = LCOLORS[i];
            v.title = T("Громкость слоя (двойной клик — сброс)", "Layer volume (double click — reset)");
            const met = el("canvas", "nsp-meter");
            met.dataset.layer = String(i);
            met.style.height = "70%";
            // клик по слою (не по кнопкам) — новые кирпичики пойдут в него
            h.addEventListener("click", (e) => { if (!["INPUT", "BUTTON"].includes(e.target.tagName)) { S.cur = i; save(); buildHeads(); draw(); } });
            m.addEventListener("click", () => { l.mute = !l.mute; m.classList.toggle("on-m", l.mute); mix(); save(); draw(); });
            s.addEventListener("click", () => { l.solo = !l.solo; s.classList.toggle("on-s", l.solo); mix(); save(); draw(); });
            v.addEventListener("input", () => { l.vol = parseFloat(v.value); mix(); save(); });
            v.addEventListener("dblclick", () => { v.value = "0.8"; l.vol = 0.8; mix(); save(); });
            [n, lp, m, s, v, met].forEach((x) => h.appendChild(x));
            heads.appendChild(h);
        }
        showLayerPlay();
    }

    // ---------- ПОЛЕ: рисование ----------
    let pending = false;
    function draw() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; if (!disposed) drawNow(); }); }
    function size(c, w, h) {
        const d = window.devicePixelRatio || 1;
        if (c.width !== Math.round(w * d) || c.height !== Math.round(h * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
        c.style.width = w + "px"; c.style.height = h + "px";
        const g = c.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); return g;
    }
    function drawNow() {
        const W = grid.clientWidth, H = grid.clientHeight;
        if (W < 10 || H < 10) return;
        const maxSx = Math.max(0, viewBeats() * pxb() - W);
        view.sx = clamp(view.sx, 0, maxSx);
        hs.style.visibility = maxSx > 1 ? "visible" : "hidden";
        hs.value = String(maxSx ? Math.round((view.sx / maxSx) * 1000) : 0);
        const g = size(cv, W, H);
        size(ov, W, H);
        g.fillStyle = "#15171c"; g.fillRect(0, 0, W, H);
        const lh = laneH();
        for (let i = 0; i < LAYERS; i++) {
            g.fillStyle = i === S.cur ? "#1c2028" : (i % 2 ? "#1a1c22" : "#17191e");
            g.fillRect(0, RULER_H + i * lh, W, lh);
        }
        const b0 = Math.floor(beatAt(0)), b1 = Math.ceil(beatAt(W));
        const sb = snapBeats();
        if (sb > 0 && sb < 1 && pxb() * sb >= 6) {
            g.fillStyle = "rgba(255,255,255,0.03)";
            for (let b = Math.floor(beatAt(0) / sb) * sb; b <= b1; b += sb) g.fillRect(Math.round(xAt(b)), RULER_H, 1, H);
        }
        const beatStep = pxb() >= 6 ? 1 : 4;
        for (let b = Math.floor(b0 / beatStep) * beatStep; b <= b1; b += beatStep) {
            g.fillStyle = b % 4 === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
            g.fillRect(Math.round(xAt(b)), RULER_H, 1, H);
        }
        const pb = patternBeats();
        g.fillStyle = "rgba(255,209,102,0.05)"; g.fillRect(xAt(pb), RULER_H, W, H);
        g.fillStyle = "#ffd166"; g.fillRect(Math.round(xAt(pb)), RULER_H, 2, H);
        g.fillStyle = "#1f2229"; g.fillRect(0, 0, W, RULER_H);
        g.font = "10px Segoe UI, Arial"; g.textBaseline = "middle";
        const barStep = pxb() * 4 >= 28 ? 4 : pxb() * 16 >= 28 ? 16 : 64;
        for (let b = Math.floor(b0 / barStep) * barStep; b <= b1; b += barStep) {
            const x = Math.round(xAt(b));
            g.fillStyle = "#8b90a0"; g.fillRect(x, 10, 1, RULER_H - 10);
            g.fillText(String(b / 4 + 1), x + 3, RULER_H / 2);
        }
        const solo = S.layers.some((l) => l.solo);
        for (const c of S.bricks) {
            const x0 = xAt(c.beat), x1 = xAt(c.beat + lenB(c));
            if (x1 < 0 || x0 > W) continue;
            const y = RULER_H + c.layer * lh + 2, h = lh - 4;
            const col = COLORS[c.src % COLORS.length];
            const L = S.layers[c.layer];
            const on = !L.mute && (!solo || L.solo);
            g.fillStyle = on ? "#2a2f3a" : "#22252c";
            g.fillRect(x0, y, x1 - x0, h);
            g.globalAlpha = on ? 1 : 0.35;
            g.fillStyle = col;
            const hh = Math.min(13, h);
            g.fillRect(x0, y, x1 - x0, hh);
            const snd = items[c.src];
            const e = snd ? loadSound(snd) : null;
            if (e && e.state === "ok" && h > hh + 3) {
                g.save(); g.beginPath(); g.rect(x0, y + hh, x1 - x0, h - hh); g.clip();
                const mid = y + hh + (h - hh) / 2, sr = e.buf.sampleRate;
                for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
                    const ta = c.in + ((x - x0) / pxb()) * spb(), tb = c.in + ((x + 1 - x0) / pxb()) * spb();
                    const ia = Math.floor((ta * sr) / PEAK_BLOCK), ib = Math.max(ia + 1, Math.floor((tb * sr) / PEAK_BLOCK));
                    if (ia >= e.peaks.length) break;
                    let p = 0;
                    for (let k = Math.max(0, ia); k < Math.min(ib, e.peaks.length); k++) if (e.peaks[k] > p) p = e.peaks[k];
                    const ph = Math.max(1, p * (h - hh) * 0.9);
                    g.fillRect(x, mid - ph / 2, 1, ph);
                }
                g.restore();
            }
            g.globalAlpha = 1;
            // появление / затухание — тёмные клинья
            const fx = (c.fin / spb()) * pxb(), gx = (c.fout / spb()) * pxb();
            g.fillStyle = "rgba(0,0,0,0.4)";
            if (c.fin > 0) { g.beginPath(); g.moveTo(x0, y + hh); g.lineTo(x0 + fx, y + hh); g.lineTo(x0, y + h); g.closePath(); g.fill(); }
            if (c.fout > 0) { g.beginPath(); g.moveTo(x1, y + hh); g.lineTo(x1 - gx, y + hh); g.lineTo(x1, y + h); g.closePath(); g.fill(); }
            const isSel = selB === c.id;
            g.strokeStyle = isSel ? "#fff" : "rgba(0,0,0,.6)"; g.lineWidth = isSel ? 2 : 1;
            g.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
            if (x1 - x0 > 2 * HANDLE + 6) {
                g.fillStyle = "#fff";
                g.fillRect(x0 + fx, y, HANDLE, HANDLE);
                g.fillRect(x1 - gx - HANDLE, y, HANDLE, HANDLE);
            }
            g.save(); g.beginPath(); g.rect(x0 + HANDLE + 4, y, Math.max(0, x1 - x0 - 2 * HANDLE - 8), hh); g.clip();
            g.fillStyle = "#111"; g.font = "bold 9px Segoe UI, Arial"; g.textBaseline = "top";
            const label = (snd ? snd.name : "—") + ` ${fmt(c.in)}` + (Math.abs(c.gain - 1) > 0.005 ? `  ${Math.round(c.gain * 100)}%` : "");
            g.fillText(label, Math.max(x0, 0) + HANDLE + 4, y + 2);
            g.restore();
        }
        // призрак куска, который тащат из источника
        if (sdrag && sdrag.mode === "grab" && sdrag.ghost) {
            const s = items[sdrag.i];
            const e = s && loadSound(s);
            const sel = S.sel[sdrag.i];
            if (e && e.state === "ok" && sel) {
                const x0 = xAt(sdrag.ghost.beat), w = ((sel.b - sel.a) / spb()) * pxb();
                g.fillStyle = COLORS[sdrag.i]; g.globalAlpha = 0.45;
                g.fillRect(x0, RULER_H + sdrag.ghost.layer * lh + 2, w, lh - 4);
                g.globalAlpha = 1;
            }
        }
        drawHead();
    }
    function drawHead() {
        const W = grid.clientWidth, H = grid.clientHeight;
        const g = ov.getContext("2d");
        const d = window.devicePixelRatio || 1;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.clearRect(0, 0, W, H);
        const x = Math.round(xAt(curPos() / spb()));
        if (x >= -2 && x <= W + 2) {
            g.fillStyle = "#fff"; g.fillRect(x - 1, 0, 2, H);
            g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x, 8); g.closePath(); g.fill();
        }
    }

    // ---------- ПОЛЕ: мышь ----------
    const findB = (id) => S.bricks.find((c) => c.id === id);
    function hit(x, y) {
        if (y < RULER_H) return { type: "ruler" };
        const lh = laneH();
        const layer = clamp(Math.floor((y - RULER_H) / lh), 0, LAYERS - 1);
        for (let i = S.bricks.length - 1; i >= 0; i--) {
            const c = S.bricks[i];
            if (c.layer !== layer) continue;
            const x0 = xAt(c.beat), x1 = xAt(c.beat + lenB(c));
            if (x < x0 - 3 || x > x1 + 3) continue;
            const yy = y - RULER_H - layer * lh - 2;
            const fx = (c.fin / spb()) * pxb(), gx = (c.fout / spb()) * pxb();
            if (yy <= HANDLE + 3 && x1 - x0 > 2 * HANDLE + 6) {
                if (x >= x0 + fx - 3 && x <= x0 + fx + HANDLE + 3) return { type: "fin", c };
                if (x >= x1 - gx - HANDLE - 3 && x <= x1 - gx + 3) return { type: "fout", c };
            }
            if (x - x0 <= 6) return { type: "edgeL", c };
            if (x1 - x <= 6) return { type: "edgeR", c };
            return { type: "body", c };
        }
        return { type: "empty", layer };
    }
    const CURS = { body: "grab", edgeL: "w-resize", edgeR: "e-resize", fin: "ew-resize", fout: "ew-resize", ruler: "pointer" };
    let drag = null;
    cv.addEventListener("pointermove", (e) => { if (!drag && !sdrag) { const p = pt(e, cv); cv.style.cursor = CURS[hit(p.x, p.y).type] || "default"; } });
    cv.addEventListener("pointerdown", (e) => {
        refocus();
        if (S.bypass) return;
        const p = pt(e, cv);
        const h = hit(p.x, p.y);
        if (e.button === 2) { if (h.c) { selB = h.c.id; deleteSel(); } return; }
        if (e.button !== 0) return;
        cv.setPointerCapture(e.pointerId);
        if (h.type === "ruler" || h.type === "empty") {
            selB = null; buildSel();
            if (h.type === "empty") { S.cur = h.layer; buildHeads(); save(); }
            seek(Math.max(0, beatAt(p.x)) * spb());
            drag = { type: "seek" };
            draw();
            return;
        }
        selB = h.c.id;
        buildSel();
        drag = { type: h.type, c: h.c, x0: p.x, y0: p.y, o: { beat: h.c.beat, in: h.c.in, len: h.c.len, fin: h.c.fin, fout: h.c.fout }, moved: false };
        draw();
    });
    cv.addEventListener("pointermove", (e) => {
        const d = drag;
        if (!d) return;
        const p = pt(e, cv);
        if (d.type === "seek") { seek(Math.max(0, beatAt(p.x)) * spb()); return; }
        if (!d.moved && Math.abs(p.x - d.x0) < 3 && Math.abs(p.y - d.y0) < 3) return;
        if (!d.moved) { pushUndo(); d.moved = true; }
        const c = d.c, o = d.o;
        const db = (p.x - d.x0) / pxb();
        const sd = (() => { const s = items[c.src]; const en = s ? loadSound(s) : null; return en && en.state === "ok" ? en.buf.duration : Infinity; })();
        if (d.type === "body") {
            c.beat = Math.max(0, snapB(o.beat + db));
            c.layer = clamp(Math.floor((p.y - RULER_H) / laneH()), 0, LAYERS - 1);
        } else if (d.type === "edgeL") {
            const nb = clamp(snapB(o.beat + db), Math.max(0, o.beat - o.in / spb()), o.beat + (o.len - 0.05) / spb());
            const k = (nb - o.beat) * spb();
            c.beat = nb; c.in = o.in + k; c.len = o.len - k; c.fin = Math.min(c.fin, c.len - c.fout);
        } else if (d.type === "edgeR") {
            const ne = snapB(o.beat + o.len / spb() + db);
            c.len = clamp((ne - o.beat) * spb(), 0.05, Math.min(3600, sd - o.in));
            c.fout = Math.min(c.fout, c.len - c.fin);
        } else if (d.type === "fin") {
            c.fin = clamp(o.fin + db * spb(), 0, c.len - c.fout);
            setStatus(`${T("Появление", "Fade in")}: ${c.fin.toFixed(2)} ${T("с", "s")}`);
        } else if (d.type === "fout") {
            c.fout = clamp(o.fout - db * spb(), 0, c.len - c.fin);
            setStatus(`${T("Затухание", "Fade out")}: ${c.fout.toFixed(2)} ${T("с", "s")}`);
        }
        draw();
        restartSoon();
    });
    const endDrag = () => { const d = drag; drag = null; if (d && d.moved) changed(); refocus(); };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });
    // колёсико — приблизить / отдалить вокруг мышки; Shift — прокрутка
    cv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        const p = pt(e, cv);
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { view.sx += e.shiftKey ? e.deltaY : e.deltaX; draw(); return; }
        const b = beatAt(p.x);
        S.zoom = clamp(S.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 4, 240);
        view.sx = b * pxb() - p.x;
        save();
        draw();
    }, { passive: false });
    hs.addEventListener("input", () => { view.sx = (Number(hs.value) / 1000) * Math.max(0, viewBeats() * pxb() - grid.clientWidth); draw(); });
    for (const x of [hs, bpmN, snapSel]) x.addEventListener("keydown", (e) => e.stopPropagation());

    // ---------- действия с кирпичиками ----------
    function changed() { save(); buildHeads(); buildSel(); draw(); restartSoon(); }
    function deleteSel() { const c = findB(selB); if (!c) return; pushUndo(); S.bricks = S.bricks.filter((x) => x !== c); selB = null; changed(); }
    function dupSel() {
        const c = findB(selB); if (!c || S.bricks.length >= MAX_BRICKS) return;
        pushUndo();
        const sb = snapBeats() || 0.25;
        const d = { ...c, id: uid(), beat: Math.ceil((c.beat + lenB(c)) / sb - 1e-6) * sb };
        S.bricks.push(d);
        selB = d.id;
        changed();
        setStatus(T("Копия поставлена сразу после", "Copy placed right after"));
    }
    function splitSel() {
        const c = findB(selB);
        if (!c) { setStatus(T("Выделите кирпичик, потом S", "Select a brick, then S"), true); return; }
        const t = curPos(), st = c.beat * spb();
        if (t <= st + 0.02 || t >= st + c.len - 0.02) { setStatus(T("Поставьте курсор внутрь кирпичика (клик по линейке)", "Put the cursor inside the brick (click the ruler)"), true); return; }
        pushUndo();
        const k = t - st;
        const d = { ...c, id: uid(), beat: t / spb(), in: c.in + k, len: c.len - k, fin: 0 };
        c.len = k; c.fout = 0; c.fin = Math.min(c.fin, c.len); d.fout = Math.min(d.fout, d.len);
        S.bricks.push(d);
        selB = d.id;
        changed();
    }
    keys.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const k = e.key, ctrl = e.ctrlKey || e.metaKey;
        if (k === " ") { e.preventDefault(); if (P.on) stopField(); else { P.only = -1; play(); } }
        else if (k === "Delete" || k === "Backspace") { e.preventDefault(); deleteSel(); }
        else if (ctrl && /^[zZяЯ]$/.test(k)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if (ctrl && /^[yYнН]$/.test(k)) { e.preventDefault(); redo(); }
        else if (ctrl && /^[dDвВ]$/.test(k)) { e.preventDefault(); dupSel(); }
        else if (!ctrl && /^[sSыЫ]$/.test(k)) { e.preventDefault(); splitSel(); }
    });
    keys.addEventListener("keyup", (e) => e.stopPropagation());

    // ---------- панель выделенного кирпичика ----------
    function rng(label, min, max, step, val, f, set) {
        const w = el("label", "");
        w.style.cssText = "display:flex;align-items:center;gap:4px";
        w.appendChild(document.createTextNode(label));
        const r = el("input"); r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val);
        const v = el("span", "", f(val));
        let pushed = false;
        r.addEventListener("input", () => { if (!pushed) { pushUndo(); pushed = true; } const x = parseFloat(r.value); v.textContent = f(x); set(x); draw(); restartSoon(); });
        r.addEventListener("change", () => { pushed = false; save(); });
        r.addEventListener("keydown", (e) => e.stopPropagation());
        w.appendChild(r); w.appendChild(v);
        return w;
    }
    function buildSel() {
        selp.innerHTML = "";
        const c = findB(selB);
        if (!c || S.bypass) {
            selp.appendChild(document.createTextNode(S.bypass
                ? T("⏭ ПРОПУСТИТЬ включена — все звуки идут в Пульт как есть", "⏭ BYPASS is on — all sounds go to the Pult as they are")
                : T("Колёсико — масштаб · клик по полю — курсор · Пробел — играть · Delete — удалить · Ctrl+D — копия · S — разрезать",
                    "Wheel — zoom · click the field — cursor · Space — play · Delete — delete · Ctrl+D — copy · S — split")));
            return;
        }
        const nm = el("b", "", `${items[c.src] ? items[c.src].name : "—"} · ${fmt(c.in)}–${fmt(c.in + c.len)}`);
        nm.style.color = COLORS[c.src % COLORS.length];
        selp.appendChild(nm);
        selp.appendChild(rng(T("Громкость", "Volume"), 0, 2, 0.01, c.gain, (x) => Math.round(x * 100) + "%", (x) => { c.gain = x; }));
        const fm = Math.max(0.01, Math.min(10, c.len));
        selp.appendChild(rng(T("Появление", "Fade in"), 0, fm, 0.01, c.fin, (x) => x.toFixed(2) + " с/s", (x) => { c.fin = Math.min(x, c.len - c.fout); }));
        selp.appendChild(rng(T("Затухание", "Fade out"), 0, fm, 0.01, c.fout, (x) => x.toFixed(2) + " с/s", (x) => { c.fout = Math.min(x, c.len - c.fin); }));
        const b1 = mk("✂", null, T("Разрезать по курсору (S)", "Split at the cursor (S)"), "sm"); b1.addEventListener("click", splitSel);
        const b2 = mk("⧉", null, T("Копия сразу после (Ctrl+D)", "Copy right after (Ctrl+D)"), "sm"); b2.addEventListener("click", dupSel);
        const b3 = mk("🗑", "#7a3b3b", T("Удалить (Delete)", "Delete (Delete)"), "sm"); b3.addEventListener("click", deleteSel);
        [b1, b2, b3].forEach((b) => selp.appendChild(b));
    }

    // ---------- верхняя панель ----------
    function showTop() {
        byp.classList.toggle("on", S.bypass);
        byOver.style.display = S.bypass ? "flex" : "none";
        bpmR.value = String(bpm());
        if (document.activeElement !== bpmN) bpmN.value = String(bpm());
        snapSel.value = S.snap;
    }
    function setBpm(v) {
        v = clamp(Math.round(v), 40, 300);
        if (!wBpm) return;
        wBpm.value = v;
        if (typeof wBpm.callback === "function") { try { wBpm.callback(v); } catch (e) { /* ок */ } }
        showTop(); draw(); restartSoon();
    }
    byp.addEventListener("click", () => {
        pushUndo();
        S.bypass = !S.bypass;
        if (S.bypass) stopField();
        save(); showTop(); buildSel(); draw();
        setStatus(S.bypass ? T("Пульт видит все звуки по отдельности", "The Pult sees every sound separately")
            : T("Пульт слышит только поле. Выделите кусок в источнике и нажмите ➜", "The Pult hears only the field. Select a piece in a source and press ➜"));
    });
    // верхний ▶ — всё поле; если играл один слой — переключиться на всё поле
    playB.addEventListener("click", () => {
        if (P.on && P.only >= 0) { P.only = -1; mix(); showLayerPlay(); setStatus(T("Играет всё поле", "Playing the whole field")); return; }
        P.on ? stopField() : play();
    });
    stopB.addEventListener("click", () => { stopField(); stopPreview(); seek(0); });
    fitB.addEventListener("click", () => { fitView(); draw(); });
    helpB.addEventListener("click", showHelp);
    bpmR.addEventListener("input", () => setBpm(parseFloat(bpmR.value)));
    bpmN.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = parseFloat(bpmN.value); if (Number.isFinite(v)) setBpm(v); bpmN.blur(); } });
    bpmN.addEventListener("blur", () => { const v = parseFloat(bpmN.value); if (Number.isFinite(v) && v !== bpm()) setBpm(v); else showTop(); });
    snapSel.addEventListener("change", () => { S.snap = snapSel.value; save(); draw(); });

    // ---------- нода ----------
    const dom = node.addDOMWidget("neron_sampler", "neron_sampler", outer, { serialize: false, hideOnZoom: false });
    const autoH = () => 34 + 18 + Math.max(1, items.length) * (SRC_H + 3) + 18 + 200 + 14 + 26 + 20;
    const sizer = makeUserSized(node, dom, outer, { minH: 260, autoH, margin: 4, onLayout: () => { drawSources(); draw(); } });
    outer.style.overflow = "hidden";
    new ResizeObserver(() => { drawSources(); draw(); }).observe(root);
    const wanted = node.computeSize ? node.computeSize() : [960, 460];
    node.setSize([Math.max(wanted[0], 960), Math.max(wanted[1], 200)]);

    function syncItems() {
        const cur = upstream();
        if (cur.map(keyOf).join("|") === items.map(keyOf).join("|")) return;
        items = cur;
        for (const k of Object.keys(S.sel)) if (Number(k) >= items.length) delete S.sel[k];
        buildSources();
        items.forEach((s) => loadSound(s).p.then(() => { drawSources(); draw(); }));
        sizer.fit();
        draw();
        restartSoon();
    }
    let lastBpm = bpm();
    const poll = setInterval(() => {
        if (document.hidden || disposed) return;
        syncItems();
        if (bpm() !== lastBpm) { lastBpm = bpm(); showTop(); draw(); restartSoon(); }
    }, 400);

    node.neronReload = () => { stopField(); stopPreview(); loadState(); items = []; syncItems(); showTop(); buildHeads(); buildSel(); buildSources(); draw(); };
    node.neronDispose = () => { disposed = true; stopField(); stopPreview(); clearInterval(poll); };

    loadState();
    showTop();
    buildHeads();
    buildSel();
    buildSources();
    syncItems();
    setTimeout(() => { if (!S.bricks.length) fitView(); draw(); }, 80);
}

app.registerExtension({
    name: "NeronAudio.SamplerUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () { const r = created ? created.apply(this, arguments) : undefined; setupSampler(this); return r; };
        const conf = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () { const r = conf ? conf.apply(this, arguments) : undefined; const self = this; setTimeout(() => { if (self.neronReload) self.neronReload(); }, 0); return r; };
        const rem = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () { if (this.neronDispose) this.neronDispose(); return rem ? rem.apply(this, arguments) : undefined; };
    },
});
