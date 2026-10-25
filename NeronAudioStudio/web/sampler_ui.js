import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { makeUserSized } from "./neron_common.js";

// ============================================================================
//  Neron Sampler / Сэмплер
//  RU: Между «Звук ×8» и Пультом. Вид как у Piano Roll: слева дорожки, справа
//      сетка по тактам, каждый звук — блок. Блоки двигают, копируют, обрезают,
//      кладут друг на друга. ⏭ ПРОПУСТИТЬ — сэмплер не работает, все звуки идут
//      в Пульт как есть. Выключено — Пульт видит только результат сэмплера.
//  EN: Between "Sound ×8" and the Pult. Looks like the Piano Roll: tracks on the
//      left, a bar grid on the right, every sound is a block. ⏭ BYPASS — the
//      sampler does nothing; off — the Pult sees only the sampler result.
// ============================================================================

const NODE = "NeronSampler";
const LANES = 8;
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const SNAPS = [["bar", 4], ["1/2", 2], ["1/4", 1], ["1/8", 0.5], ["1/16", 0.25], ["off", 0]];
const HEAD_W = 172, RULER_H = 20, PEAK_BLOCK = 256;
const T = (ru, en) => `${ru} / ${en}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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

function injectStyles() {
    if (document.getElementById("neron-sampler-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-sampler-styles";
    s.textContent = `
.nsp-outer{box-sizing:border-box;width:100%;padding-bottom:10px}
.nsp-root{box-sizing:border-box;width:100%;height:100%;padding:8px 10px;background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:6px;overflow:hidden;position:relative}
.nsp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:none}
.nsp-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;background:#4a4e5a;
  white-space:nowrap;line-height:24px;flex:none;font-family:inherit}
.nsp-btn:hover{filter:brightness(1.18)}
.nsp-btn.sm{height:20px;line-height:20px;padding:0 7px;font-size:10px}
.nsp-byp{background:#3a3e48;color:#cfd2d8}
.nsp-byp.on{background:#d9a72b;color:#1b1d23}
.nsp-g{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.4px}
.nsp-g input[type=range]{width:90px;height:12px;margin:0;cursor:pointer;accent-color:#ff9f43}
.nsp-num{width:42px;height:20px;box-sizing:border-box;background:#23252b;color:#e6e8ee;border:1px solid #33363e;border-radius:4px;font-size:11px;text-align:center;outline:none}
.nsp-sel{height:20px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;font-size:10px;outline:none}
.nsp-status{flex:1;min-width:100px;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.nsp-status.err{color:#ff8a80}
.nsp-main{flex:1;min-height:0;display:flex;position:relative;background:#15171c;border-radius:6px;overflow:hidden}
.nsp-heads{flex:none;width:${HEAD_W}px;display:flex;flex-direction:column;background:#20232a}
.nsp-hcorner{flex:none;height:${RULER_H}px;border-bottom:1px solid #2a2d35;font-size:9px;color:#6b7080;display:flex;align-items:center;padding:0 6px}
.nsp-head{flex:1;min-height:0;box-sizing:border-box;border-bottom:1px solid #2a2d35;display:flex;align-items:center;gap:4px;padding:0 5px;overflow:hidden}
.nsp-head b{flex:1;min-width:0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nsp-head input[type=range]{width:46px;height:12px;margin:0;cursor:pointer}
.nsp-ms{width:19px;height:18px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:10px;font-weight:700;cursor:pointer;flex:none}
.nsp-ms.on-m{background:#b3414a;color:#fff}
.nsp-ms.on-s{background:#d9a72b;color:#1b1d23}
.nsp-grid{flex:1;min-width:0;position:relative}
.nsp-grid canvas{position:absolute;left:0;top:0}
.nsp-hs{flex:none;width:100%;height:10px;margin:0;accent-color:#6b7080}
.nsp-selp{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;min-height:24px;font-size:10px;color:#9aa0ae}
.nsp-selp b{color:#e6e8ee;font-size:11px}
.nsp-selp input[type=range]{width:90px;height:12px;margin:0;cursor:pointer;accent-color:#ffd166}
.nsp-byover{position:absolute;inset:0;background:rgba(21,23,28,.78);display:none;align-items:center;justify-content:center;text-align:center;
  font-size:12px;font-weight:700;color:#d9a72b;padding:12px;line-height:1.6;z-index:3}
`;
    document.head.appendChild(s);
}

const HELP = `NERON SAMPLER
===================================================
Sits between "Sound ×8" and the Pult (Neron Mixer).

⏭ BYPASS (on) — the sampler does nothing: every sound goes to the Pult as it is,
  each one its own channel.
⏭ BYPASS (off) — the sampler works: the Pult sees only its result, one channel.

THE GRID (like the Piano Roll)
  • Left: tracks. Right: bars and beats. Every sound is a block.
  • A new sound appears on its own track at the start by itself.
  • Drag a block to move it (also to another track — stack sounds).
  • Drag its edges to trim. Small squares at the top corners — fade in / out.
  • Double click an empty place — put the sound of that track there.
  • GRID — blocks snap to bars / beats. BPM — the tempo (the Pult syncs it).
  • Track: M (mute), S (solo), volume.
  • Bottom panel: block volume, fades, ✂ split, ⧉ copy, 🗑 delete.

KEYS (click the grid first)
  Space — play/stop · S — split at the cursor · Delete — delete
  Ctrl+D — copy right after · Ctrl+Z / Ctrl+Y — undo / redo
  Wheel — scroll · Ctrl+wheel — zoom

The result loops in whole bars, so it repeats evenly in the Pult.

===================================================
🇷🇺 РУССКИЙ
===================================================
Стоит между «Звук ×8» и Пультом (Neron Mixer).

⏭ ПРОПУСТИТЬ (нажата) — сэмплер не работает: все звуки идут в Пульт как есть,
  каждый своим каналом.
⏭ ПРОПУСТИТЬ (отжата) — сэмплер работает: Пульт видит только его результат,
  одним каналом.

СЕТКА (как у Piano Roll)
  • Слева дорожки, справа такты и доли. Каждый звук — блок.
  • Новый звук сам появляется на своей дорожке в начале.
  • Тяните блок — двигается (и на другую дорожку: звуки можно класть друг на друга).
  • Тяните края — обрезка. Квадратики в верхних углах — появление и затухание.
  • Двойной клик по пустому месту — поставить туда звук этой дорожки.
  • СЕТКА — блоки прилипают к тактам и долям. BPM — темп (Пульт синхронизирует сам).
  • У дорожки: M (выключить), S (только она), громкость.
  • Панель внизу: громкость блока, появление, затухание, ✂ разрезать, ⧉ копия, 🗑 удалить.

КЛАВИШИ (сначала щёлкните по сетке)
  Пробел — играть/стоп · S — разрезать по курсору · Delete — удалить
  Ctrl+D — копия сразу после · Ctrl+Z / Ctrl+Y — отмена / повтор
  Колёсико — прокрутка · Ctrl+колёсико — масштаб

Результат идёт целыми тактами, поэтому в Пульте повторяется ровно.
`;

function showHelp() {
    const overlay = el("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";
    const box = el("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;max-width:800px;max-height:85vh;" +
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
const bufCache = new Map();     // key -> {state, buf, peaks, p}
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
function soundSpec(s) { return { type: "file", name: s.name, subfolder: s.subfolder || "", kind: s.type || "input", start: s.start || 0, end: s.end || 0 }; }
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
    return { version: 1, bypass: true, snap: "1/4", master: 1.0, zoom: 36,
        lanes: Array.from({ length: LANES }, () => ({ vol: 0.8, pan: 0, mute: false, solo: false })), clips: [], known: [] };
}
function normalize(o) {
    const S = blank();
    if (!o || typeof o !== "object") return S;
    S.bypass = o.bypass !== false;
    if (SNAPS.some(([k]) => k === o.snap)) S.snap = o.snap;
    if (typeof o.master === "number") S.master = clamp(o.master, 0, 1.5);
    if (typeof o.zoom === "number") S.zoom = clamp(o.zoom, 8, 200);
    (Array.isArray(o.lanes) ? o.lanes : []).slice(0, LANES).forEach((l, i) => {
        if (!l) return;
        S.lanes[i] = { vol: typeof l.vol === "number" ? clamp(l.vol, 0, 1.5) : 0.8, pan: typeof l.pan === "number" ? clamp(l.pan, -1, 1) : 0, mute: !!l.mute, solo: !!l.solo };
    });
    for (const c of (Array.isArray(o.clips) ? o.clips : []).slice(0, 128)) {
        if (!c) continue;
        S.clips.push({ id: c.id || uid(), src: clamp(Math.round(Number(c.src) || 0), 0, LANES - 1), lane: clamp(Math.round(Number(c.lane) || 0), 0, LANES - 1),
            beat: Math.max(0, Number(c.beat) || 0), in: Math.max(0, Number(c.in) || 0), len: Math.max(0.02, Number(c.len) || 1),
            gain: typeof c.gain === "number" ? clamp(c.gain, 0, 2) : 1, fin: Math.max(0, Number(c.fin) || 0), fout: Math.max(0, Number(c.fout) || 0), autoLen: !!c.autoLen });
    }
    S.known = Array.isArray(o.known) ? o.known.slice(0, LANES).map(String) : [];
    return S;
}

function setupSampler(node) {
    injectStyles();
    const wJson = (node.widgets || []).find((x) => x.name === "sampler_json");
    const wBpm = (node.widgets || []).find((x) => x.name === "bpm");
    for (const w of [wJson, wBpm]) if (w) { w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4]; }

    let S = blank();
    let items = [];          // звуки, пришедшие по проводу из «Звук ×8»
    let sel = null;          // id выделенного блока
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
    const undo = () => { if (!undoS.length) return; redoS.push(JSON.stringify(S)); S = normalize(JSON.parse(undoS.pop())); changed(true); };
    const redo = () => { if (!redoS.length) return; undoS.push(JSON.stringify(S)); S = normalize(JSON.parse(redoS.pop())); changed(true); };

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
            if (typeof o.neronCube === "function") { const c = o.neronCube(); return c && c.kind === "sounds" && !c.spec ? c.items.slice(0, LANES) : []; }
            return [];
        }
        return [];
    }
    const keyOf = (s) => (s ? JSON.stringify(soundSpec(s)) : "");

    // Пульт читает сэмплер отсюда (без Queue)
    node.neronCube = () => ({
        kind: "sounds", bypass: S.bypass, items: items.map((x) => ({ ...x })),
        spec: S.bypass ? null : { type: "sampler", json: JSON.stringify(S), sounds: items.map((x) => ({ ...x })), bpm: bpm() },
        bpm: bpm(),
    });

    // ---------- каркас ----------
    const outer = el("div", "nsp-outer");
    const root = el("div", "nsp-root");
    outer.appendChild(root);
    const bar = el("div", "nsp-bar");
    const mk = (t, c, title, cls) => { const b = el("button", "nsp-btn" + (cls ? " " + cls : ""), t); if (c) b.style.background = c; if (title) b.title = title; return b; };
    const byp = mk("⏭ " + T("ПРОПУСТИТЬ", "BYPASS"), null, T("Нажата — сэмплер не работает, все звуки идут в Пульт как есть. Отжата — Пульт слышит только сэмплер.",
        "On — the sampler does nothing, all sounds go to the Pult as they are. Off — the Pult hears only the sampler."), "nsp-byp");
    const playB = mk("▶", "#3fa34d", T("Играть по кругу (Пробел)", "Play in a loop (Space)"));
    const stopB = mk("■", "#b3414a", T("Стоп", "Stop"));
    const gB = el("div", "nsp-g");
    gB.appendChild(document.createTextNode("BPM"));
    const bpmR = el("input"); bpmR.type = "range"; bpmR.min = "40"; bpmR.max = "300"; bpmR.step = "1";
    const bpmN = el("input", "nsp-num"); bpmN.type = "text";
    gB.appendChild(bpmR); gB.appendChild(bpmN);
    gB.title = T("Темп сетки. Пульт подстраивает его сам (СИНХР.)", "Grid tempo. The Pult syncs it (SYNC)");
    const gS = el("div", "nsp-g");
    gS.appendChild(document.createTextNode(T("СЕТКА", "GRID")));
    const snapSel = el("select", "nsp-sel");
    for (const [k] of SNAPS) {
        const o = el("option", "", k === "bar" ? T("такт", "bar") : k === "off" ? T("без сетки", "free") : k);
        o.value = k;
        snapSel.appendChild(o);
    }
    gS.appendChild(snapSel);
    gS.title = T("К чему прилипают блоки", "What blocks snap to");
    const gZ = el("div", "nsp-g");
    gZ.appendChild(document.createTextNode(T("ЗУМ", "ZOOM")));
    const zoomR = el("input"); zoomR.type = "range"; zoomR.min = "8"; zoomR.max = "200"; zoomR.step = "1";
    gZ.appendChild(zoomR);
    gZ.title = T("Масштаб (Ctrl+колёсико)", "Zoom (Ctrl+wheel)");
    const status = el("div", "nsp-status", "");
    const helpB = mk("📖", null, T("Справка", "Help"), "sm");
    [byp, playB, stopB, gB, gS, gZ, status, helpB].forEach((x) => bar.appendChild(x));
    root.appendChild(bar);

    const main = el("div", "nsp-main");
    const heads = el("div", "nsp-heads");
    const grid = el("div", "nsp-grid");
    const cv = el("canvas"), ov = el("canvas");
    ov.style.pointerEvents = "none";
    grid.appendChild(cv); grid.appendChild(ov);
    const byOver = el("div", "nsp-byover", T("⏭ ПРОПУСТИТЬ включена: все звуки идут в Пульт как есть, каждый своим каналом. Отожмите, чтобы собрать их здесь.",
        "⏭ BYPASS is on: all sounds go to the Pult as they are, each its own channel. Turn it off to arrange them here."));
    main.appendChild(heads); main.appendChild(grid); main.appendChild(byOver);
    root.appendChild(main);
    const hs = el("input", "nsp-hs");
    hs.type = "range"; hs.min = "0"; hs.max = "1000"; hs.value = "0";
    hs.title = T("Прокрутка", "Scroll");
    root.appendChild(hs);
    const selp = el("div", "nsp-selp");
    root.appendChild(selp);
    // клавиши принимает скрытое поле: ComfyUI их не трогает (Delete не удалит ноду, Ctrl+Z не откатит граф)
    const keys = el("textarea");
    keys.readOnly = true; keys.tabIndex = -1;
    keys.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    root.appendChild(keys);

    function setStatus(t, err) { status.textContent = t || ""; status.title = t || ""; status.className = "nsp-status" + (err ? " err" : ""); }

    // ---------- геометрия ----------
    const view = { sx: 0 };
    let lanesN = 1;
    const laneH = () => Math.max(16, (grid.clientHeight - RULER_H) / lanesN);
    const pxb = () => S.zoom;                             // пикселей на долю
    const xAt = (beat) => beat * pxb() - view.sx;
    const beatAt = (x) => (x + view.sx) / pxb();
    const lenBeats = (c) => c.len / spb();
    function patternBeats() {
        let e = 0;
        for (const c of S.clips) e = Math.max(e, c.beat + lenBeats(c));
        return Math.max(4, Math.ceil(e / 4 - 1e-6) * 4);
    }
    const viewBeats = () => Math.max(patternBeats() + 4, 32);
    const snapB = (b) => { const s = snapBeats(); return s > 0 ? Math.round(b / s) * s : b; };
    // дорожек столько, сколько звуков (и занятых строк) + одна пустая — чтобы было куда сложить звуки
    function computeLanes() {
        let n = Math.max(1, items.length);
        for (const c of S.clips) n = Math.max(n, c.lane + 1);
        lanesN = clamp(n + 1, 1, LANES);
    }

    // ---------- заголовки дорожек ----------
    function buildHeads() {
        computeLanes();
        heads.innerHTML = "";
        heads.appendChild(el("div", "nsp-hcorner", T("дорожки", "tracks")));
        for (let i = 0; i < lanesN; i++) {
            const l = S.lanes[i];
            const h = el("div", "nsp-head");
            const n = el("b", "", `${i + 1}. ${items[i] ? items[i].name : "—"}`);
            n.style.color = COLORS[i];
            n.title = items[i] ? items[i].name : T("пусто — двойной клик по сетке ставит выделенный звук", "empty — double click puts the selected sound");
            const m = el("button", "nsp-ms" + (l.mute ? " on-m" : ""), "M");
            m.title = T("Выключить дорожку", "Mute");
            const s = el("button", "nsp-ms" + (l.solo ? " on-s" : ""), "S");
            s.title = T("Только эта дорожка", "Solo");
            const v = el("input");
            v.type = "range"; v.min = "0"; v.max = "1.2"; v.step = "0.01"; v.value = String(l.vol);
            v.style.accentColor = COLORS[i];
            v.title = T("Громкость дорожки (двойной клик — сброс)", "Track volume (double click — reset)");
            m.addEventListener("click", () => { l.mute = !l.mute; m.classList.toggle("on-m", l.mute); mix(); save(); });
            s.addEventListener("click", () => { l.solo = !l.solo; s.classList.toggle("on-s", l.solo); mix(); save(); });
            v.addEventListener("input", () => { l.vol = parseFloat(v.value); mix(); save(); });
            v.addEventListener("dblclick", () => { v.value = "0.8"; l.vol = 0.8; mix(); save(); });
            [n, m, s, v].forEach((x) => h.appendChild(x));
            heads.appendChild(h);
        }
    }

    // ---------- рисование ----------
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
        computeLanes();
        if (heads.childElementCount !== lanesN + 1) buildHeads();
        const maxSx = Math.max(0, viewBeats() * pxb() - W);
        view.sx = clamp(view.sx, 0, maxSx);
        hs.style.display = maxSx > 1 ? "" : "none";
        hs.value = String(maxSx ? Math.round((view.sx / maxSx) * 1000) : 0);
        const g = size(cv, W, H);
        size(ov, W, H);
        g.fillStyle = "#15171c"; g.fillRect(0, 0, W, H);
        const lh = laneH();
        for (let i = 0; i < lanesN; i++) {
            g.fillStyle = i % 2 ? "#1a1c22" : "#17191e";
            g.fillRect(0, RULER_H + i * lh, W, lh);
        }
        // сетка: такты, доли, мелкие деления
        const b0 = Math.floor(beatAt(0)), b1 = Math.ceil(beatAt(W));
        const sb = snapBeats();
        if (sb > 0 && sb < 1 && pxb() * sb >= 6) {
            g.fillStyle = "rgba(255,255,255,0.03)";
            for (let b = Math.floor(beatAt(0) / sb) * sb; b <= b1; b += sb) g.fillRect(Math.round(xAt(b)), RULER_H, 1, H);
        }
        for (let b = b0; b <= b1; b++) {
            const x = Math.round(xAt(b));
            g.fillStyle = b % 4 === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
            g.fillRect(x, RULER_H, 1, H);
        }
        // длина результата
        const pb = patternBeats();
        g.fillStyle = "rgba(255,209,102,0.06)";
        g.fillRect(xAt(pb), RULER_H, W, H);
        g.fillStyle = "#ffd166"; g.fillRect(Math.round(xAt(pb)), RULER_H, 2, H);
        // линейка
        g.fillStyle = "#1f2229"; g.fillRect(0, 0, W, RULER_H);
        g.font = "10px Segoe UI, Arial"; g.textBaseline = "middle";
        for (let b = Math.floor(b0 / 4) * 4; b <= b1; b += 4) {
            const x = Math.round(xAt(b));
            g.fillStyle = "#8b90a0"; g.fillRect(x, 10, 1, RULER_H - 10);
            g.fillText(String(b / 4 + 1), x + 3, RULER_H / 2);
        }
        // блоки
        for (const c of S.clips) {
            if (c.lane >= lanesN) continue;
            const x0 = xAt(c.beat), x1 = xAt(c.beat + lenBeats(c));
            if (x1 < 0 || x0 > W) continue;
            const y = RULER_H + c.lane * lh + 2, h = lh - 4;
            const col = COLORS[c.src % COLORS.length];
            const lane = S.lanes[c.lane];
            const solo = S.lanes.some((l) => l.solo);
            const on = !lane.mute && (!solo || lane.solo);
            g.fillStyle = on ? "#2a2f3a" : "#22252c";
            g.fillRect(x0, y, x1 - x0, h);
            g.globalAlpha = on ? 1 : 0.35;
            g.fillStyle = col;
            g.fillRect(x0, y, x1 - x0, Math.min(12, h));
            const snd = items[c.src];
            const e = snd ? loadSound(snd) : null;
            if (e && e.state === "ok") {
                g.save(); g.beginPath(); g.rect(x0, y + 12, x1 - x0, h - 12); g.clip();
                const mid = y + 12 + (h - 12) / 2, sr = e.buf.sampleRate;
                for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
                    const ta = c.in + ((x - x0) / pxb()) * spb(), tb = c.in + ((x + 1 - x0) / pxb()) * spb();
                    let ia = Math.floor((ta * sr) / PEAK_BLOCK), ib = Math.max(ia + 1, Math.floor((tb * sr) / PEAK_BLOCK));
                    if (ia >= e.peaks.length) break;
                    let p = 0;
                    for (let i = Math.max(0, ia); i < Math.min(ib, e.peaks.length); i++) if (e.peaks[i] > p) p = e.peaks[i];
                    const hh = Math.max(1, p * (h - 12) * 0.9);
                    g.fillRect(x, mid - hh / 2, 1, hh);
                }
                g.restore();
            } else if (e && e.state === "loading") e.p.then(() => { fixAuto(); draw(); });
            g.globalAlpha = 1;
            g.fillStyle = "rgba(0,0,0,0.35)";
            const fx = c.fin / spb() * pxb(), gx = c.fout / spb() * pxb();
            if (c.fin > 0) { g.beginPath(); g.moveTo(x0, y + 12); g.lineTo(x0 + fx, y + 12); g.lineTo(x0, y + h); g.closePath(); g.fill(); }
            if (c.fout > 0) { g.beginPath(); g.moveTo(x1, y + 12); g.lineTo(x1 - gx, y + 12); g.lineTo(x1, y + h); g.closePath(); g.fill(); }
            const isSel = sel === c.id;
            g.strokeStyle = isSel ? "#fff" : "rgba(0,0,0,.6)"; g.lineWidth = isSel ? 2 : 1;
            g.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
            if (x1 - x0 > 22) { g.fillStyle = "#fff"; g.fillRect(x0 + fx - 3, y + 1, 6, 6); g.fillRect(x1 - gx - 3, y + 1, 6, 6); }
            g.save(); g.beginPath(); g.rect(x0 + 8, y, Math.max(0, x1 - x0 - 16), 12); g.clip();
            g.fillStyle = "#111"; g.font = "bold 9px Segoe UI, Arial"; g.textBaseline = "top";
            g.fillText((snd ? snd.name : T("нет звука", "no sound")) + (Math.abs(c.gain - 1) > 0.005 ? `  ${Math.round(c.gain * 100)}%` : ""), Math.max(x0, 0) + 8, y + 1);
            g.restore();
        }
        drawHead();
    }
    function drawHead(t) {
        const W = grid.clientWidth, H = grid.clientHeight;
        const g = ov.getContext("2d");
        const d = window.devicePixelRatio || 1;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.clearRect(0, 0, W, H);
        const b = (t === undefined ? curPos() : t) / spb();
        const x = Math.round(xAt(b));
        if (x >= -2 && x <= W + 2) { g.fillStyle = "#fff"; g.fillRect(x - 1, 0, 2, H); }
    }

    // ---------- проигрывание по кругу ----------
    const P = { on: false, c0: 0, t0: 0, L: 0, next: 0, srcs: [], timer: null, raf: null, chains: new Map(), master: null };
    let pos = 0;
    function audio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!P.master) { P.master = ctx.createGain(); P.master.connect(ctx.destination); }
        return ctx;
    }
    function chain(i) {
        const ctx = audio();
        let c = P.chains.get(i);
        if (!c) {
            const inp = ctx.createGain(); inp.channelCount = 2; inp.channelCountMode = "explicit";
            const sp = ctx.createChannelSplitter(2), gl = ctx.createGain(), gr = ctx.createGain(), mg = ctx.createChannelMerger(2), vol = ctx.createGain();
            inp.connect(sp); sp.connect(gl, 0); sp.connect(gr, 1); gl.connect(mg, 0, 0); gr.connect(mg, 0, 1); mg.connect(vol); vol.connect(P.master);
            c = { inp, gl, gr, vol };
            P.chains.set(i, c);
        }
        return c;
    }
    function mix() {
        if (!P.master) return;
        const ctx = getCtx();
        P.master.gain.setTargetAtTime(S.master, ctx.currentTime, 0.01);
        const solo = S.lanes.some((l) => l.solo);
        S.lanes.forEach((l, i) => {
            const c = P.chains.get(i); if (!c) return;
            c.vol.gain.setTargetAtTime(!l.mute && (!solo || l.solo) ? l.vol : 0, ctx.currentTime, 0.01);
            c.gl.gain.value = Math.min(1, 1 - l.pan); c.gr.gain.value = Math.min(1, 1 + l.pan);
        });
        draw();
    }
    function piece(ctx, buf, c, cycleStart, from) {
        // cycleStart — время движка, когда начинается этот круг; from — с какой секунды круга начинаем
        const start = c.beat * spb(), len = c.len, end = start + len;
        if (end <= from) return;
        const skip = Math.max(0, from - start);
        const off = c.in + skip;
        if (off >= buf.duration) return;
        const dur = Math.min(len - skip, buf.duration - off);
        const when = cycleStart + Math.max(start, from);
        const cs = cycleStart + start;
        const env = (t) => { let v = 1; if (c.fin > 0 && t < c.fin) v = Math.min(v, t / c.fin); if (c.fout > 0 && t > len - c.fout) v = Math.min(v, (len - t) / c.fout); return Math.max(0, v) * c.gain; };
        const s = ctx.createBufferSource(); s.buffer = buf;
        const gn = ctx.createGain();
        s.connect(gn); gn.connect(chain(c.lane).inp);
        gn.gain.setValueAtTime(env(skip), when);
        if (c.fin > 0 && skip < c.fin) gn.gain.linearRampToValueAtTime(env(c.fin), cs + c.fin);
        if (c.fout > 0) { const fs = len - c.fout; if (skip < fs) gn.gain.setValueAtTime(env(fs), cs + fs); gn.gain.linearRampToValueAtTime(0, cs + len); }
        s.start(Math.max(when, ctx.currentTime), off, dur);
        P.srcs.push({ s, end: cs + len });
    }
    // круг k начинается во времени движка в P.c0 - P.t0 + k * P.L
    function scheduleCycle(k) {
        const ctx = getCtx();
        const cycleStart = P.c0 - P.t0 + k * P.L;
        const from = k === 0 ? P.t0 : 0;
        for (const c of S.clips) {
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
    async function play() {
        if (S.bypass) { setStatus(T("Включена ⏭ ПРОПУСТИТЬ: слушайте в Пульте", "⏭ BYPASS is on: listen in the Pult")); return; }
        if (P.on) return;
        const waits = items.map((s) => loadSound(s)).filter((e) => e.state === "loading").map((e) => e.p);
        if (waits.length) { setStatus(T("Готовлю звук...", "Preparing sound...")); await Promise.all(waits); }
        if (disposed) return;
        const ctx = audio();
        mix();
        for (let i = 0; i < LANES; i++) chain(i);
        mix();
        P.L = patternBeats() * spb();
        P.t0 = pos % P.L;
        P.c0 = ctx.currentTime + 0.05;
        P.next = 0;
        P.on = true;
        pump();
        P.timer = setInterval(pump, 120);
        if (!P.raf) P.raf = requestAnimationFrame(frame);
        playB.style.background = "#2e8b3d";
        setStatus(T("Играет по кругу", "Playing in a loop"));
    }
    function stop() {
        if (P.on) pos = curPos();
        P.on = false;
        for (const x of P.srcs) { try { x.s.stop(); } catch (e) { /* ок */ } }
        P.srcs = [];
        if (P.timer) { clearInterval(P.timer); P.timer = null; }
        if (P.raf) { cancelAnimationFrame(P.raf); P.raf = null; }
        playB.style.background = "#3fa34d";
        drawHead();
    }
    function curPos() {
        if (!P.on) return pos;
        const t = getCtx().currentTime - P.c0 + P.t0;
        return P.L > 0 ? ((t % P.L) + P.L) % P.L : t;
    }
    function frame() { P.raf = null; if (!P.on || disposed) return; drawHead(); P.raf = requestAnimationFrame(frame); }
    function restart() { if (P.on) { const t = curPos(); stop(); pos = t; play(); } }
    let restartT = null;
    const restartSoon = () => { if (!P.on) return; if (restartT) clearTimeout(restartT); restartT = setTimeout(() => { restartT = null; restart(); }, 150); };

    // ---------- блоки ----------
    const findClip = (id) => S.clips.find((c) => c.id === id);
    function srcDur(c) { const s = items[c.src]; const e = s ? loadSound(s) : null; return e && e.state === "ok" ? e.buf.duration : Infinity; }
    function fixAuto() {
        let any = false;
        for (const c of S.clips) {
            if (!c.autoLen) continue;
            const s = items[c.src];
            const e = s ? loadSound(s) : null;
            if (e && e.state === "ok") { c.len = Math.max(0.05, e.buf.duration - c.in); delete c.autoLen; any = true; }
            else if (!s || (e && e.state === "err")) { delete c.autoLen; any = true; }
        }
        if (any) { save(); draw(); }
    }
    // новый звук в «Звук ×8» — сам ложится на свою дорожку в начало
    function syncItems() {
        const cur = upstream();
        const sig = cur.map(keyOf).join("|");
        const was = items.map(keyOf).join("|");
        if (sig === was) return false;
        items = cur;
        let added = false;
        items.forEach((s, i) => {
            const k = keyOf(s);
            if (S.known[i] === k) return;
            if (!S.clips.some((c) => c.src === i)) {
                S.clips.push({ id: uid(), src: i, lane: i, beat: 0, in: 0, len: 4 * spb(), gain: 1, fin: 0, fout: 0, autoLen: true });
                added = true;
            } else {
                for (const c of S.clips) if (c.src === i) { c.in = 0; c.autoLen = true; }
            }
            S.known[i] = k;
            loadSound(s).p.then(() => { fixAuto(); draw(); });
        });
        S.known.length = Math.min(S.known.length, LANES);
        save(); buildHeads(); draw();
        void added;
        restartSoon();
        return true;
    }

    function changed(structural) {
        save();
        if (structural) buildHeads();
        buildSel();
        draw();
        restartSoon();
    }

    function deleteSel() { const c = findClip(sel); if (!c) return; pushUndo(); S.clips = S.clips.filter((x) => x !== c); sel = null; changed(true); }
    function dupSel() {
        const c = findClip(sel); if (!c) return;
        if (S.clips.length >= 128) return;
        pushUndo();
        const sb = snapBeats() || 0.25;
        const nb = Math.ceil((c.beat + lenBeats(c)) / sb - 1e-6) * sb;
        const d = { ...c, id: uid(), beat: nb };
        S.clips.push(d);
        sel = d.id;
        changed(true);
        setStatus(T("Копия поставлена сразу после", "Copy placed right after"));
    }
    function splitSel() {
        const c = findClip(sel); if (!c) { setStatus(T("Выделите блок, потом S", "Select a block, then S"), true); return; }
        const t = curPos(), st = c.beat * spb();
        if (t <= st + 0.02 || t >= st + c.len - 0.02) { setStatus(T("Поставьте курсор внутрь блока (клик по линейке)", "Put the cursor inside the block (click the ruler)"), true); return; }
        pushUndo();
        const k = t - st;
        const d = { ...c, id: uid(), beat: t / spb(), in: c.in + k, len: c.len - k, fin: 0 };
        c.len = k; c.fout = 0; c.fin = Math.min(c.fin, c.len); d.fout = Math.min(d.fout, d.len);
        S.clips.push(d);
        sel = d.id;
        changed(true);
    }

    // ---------- мышь ----------
    const lp = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function hit(x, y) {
        if (y < RULER_H) return { type: "ruler" };
        const lh = laneH();
        const lane = Math.floor((y - RULER_H) / lh);
        for (let i = S.clips.length - 1; i >= 0; i--) {
            const c = S.clips[i];
            if (c.lane !== lane) continue;
            const x0 = xAt(c.beat), x1 = xAt(c.beat + lenBeats(c));
            if (x < x0 - 2 || x > x1 + 2) continue;
            const yy = y - RULER_H - lane * lh;
            const fx = c.fin / spb() * pxb(), gx = c.fout / spb() * pxb();
            if (yy <= 12 && x1 - x0 > 22) {
                if (Math.abs(x - (x0 + fx)) <= 6) return { type: "fin", c };
                if (Math.abs(x - (x1 - gx)) <= 6) return { type: "fout", c };
            }
            if (x - x0 <= 6) return { type: "edgeL", c };
            if (x1 - x <= 6) return { type: "edgeR", c };
            return { type: "body", c };
        }
        return { type: "empty", lane };
    }
    const CURS = { body: "grab", edgeL: "w-resize", edgeR: "e-resize", fin: "pointer", fout: "pointer", ruler: "pointer" };
    cv.addEventListener("pointermove", (e) => { if (!drag) cv.style.cursor = CURS[hit(lp(e).x, lp(e).y).type] || "default"; });
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
        keys.focus({ preventScroll: true });
        if (S.bypass) return;
        const p = lp(e);
        const h = hit(p.x, p.y);
        if (e.button === 2) { if (h.c) { sel = h.c.id; deleteSel(); } return; }
        if (e.button !== 0) return;
        cv.setPointerCapture(e.pointerId);
        if (h.type === "ruler" || h.type === "empty") {
            sel = null; buildSel();
            pos = Math.max(0, beatAt(p.x)) * spb();
            if (P.on) restart(); else drawHead();
            drag = { type: "seek" };
            draw();
            return;
        }
        sel = h.c.id;
        buildSel();
        drag = { type: h.type, c: h.c, x0: p.x, y0: p.y, o: { beat: h.c.beat, in: h.c.in, len: h.c.len, fin: h.c.fin, fout: h.c.fout, lane: h.c.lane }, moved: false };
        draw();
    });
    cv.addEventListener("pointermove", (e) => {
        const d = drag;
        if (!d) return;
        const p = lp(e);
        if (d.type === "seek") { pos = Math.max(0, beatAt(p.x)) * spb(); if (!P.on) drawHead(); return; }
        if (!d.moved && Math.abs(p.x - d.x0) < 3 && Math.abs(p.y - d.y0) < 3) return;
        if (!d.moved) { pushUndo(); d.moved = true; }
        const c = d.c, o = d.o;
        const db = (p.x - d.x0) / pxb();
        const sDur = srcDur(c);
        if (d.type === "body") {
            c.beat = Math.max(0, snapB(o.beat + db));
            const lane = clamp(Math.floor((p.y - RULER_H) / laneH()), 0, LANES - 1);
            c.lane = clamp(lane, 0, Math.min(LANES - 1, lanesN - 1));
        } else if (d.type === "edgeL") {
            let nb = snapB(o.beat + db);
            const minB = o.beat - o.in / spb(), maxB = o.beat + o.len / spb() - 0.05 / spb();
            nb = clamp(nb, Math.max(0, minB), maxB);
            const k = (nb - o.beat) * spb();
            c.beat = nb; c.in = o.in + k; c.len = o.len - k; c.fin = Math.min(c.fin, c.len - c.fout);
        } else if (d.type === "edgeR") {
            let ne = snapB(o.beat + o.len / spb() + db);
            const nl = clamp((ne - o.beat) * spb(), 0.05, Math.min(3600, sDur - o.in));
            c.len = nl; c.fout = Math.min(c.fout, c.len - c.fin); delete c.autoLen;
        } else if (d.type === "fin") {
            c.fin = clamp(o.fin + db * spb(), 0, c.len - c.fout);
            setStatus(`${T("Появление", "Fade in")}: ${c.fin.toFixed(2)} ${T("с", "s")}`);
        } else if (d.type === "fout") {
            c.fout = clamp(o.fout - db * spb(), 0, c.len - c.fin);
            setStatus(`${T("Затухание", "Fade out")}: ${c.fout.toFixed(2)} ${T("с", "s")}`);
        }
        draw();
    });
    // ComfyUI после отпускания мыши может снять фокус — возвращаем его, чтобы клавиши работали
    const refocus = () => setTimeout(() => { if (!disposed) keys.focus({ preventScroll: true }); }, 0);
    const endDrag = () => { const d = drag; drag = null; if (d && d.moved) changed(true); refocus(); };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });
    cv.addEventListener("dblclick", (e) => {
        if (S.bypass) return;
        const p = lp(e);
        const h = hit(p.x, p.y);
        if (h.type !== "empty") return;
        const selC = findClip(sel);
        const src = items[h.lane] ? h.lane : selC ? selC.src : -1;
        if (src < 0 || !items[src]) { setStatus(T("На этой дорожке нет звука: выделите блок, потом двойной клик", "No sound on this track: select a block, then double click"), true); return; }
        if (S.clips.length >= 128) return;
        pushUndo();
        const c = { id: uid(), src, lane: h.lane, beat: Math.max(0, snapB(beatAt(p.x))), in: 0, len: srcDur({ src }) < Infinity ? srcDur({ src }) : 4 * spb(), gain: 1, fin: 0, fout: 0 };
        S.clips.push(c);
        sel = c.id;
        changed(true);
    });
    const onWheel = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            const r = cv.getBoundingClientRect(); const x = e.clientX - r.left; const b = beatAt(x);
            S.zoom = clamp(S.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 8, 200); zoomR.value = String(Math.round(S.zoom));
            view.sx = b * pxb() - x; save();
        } else view.sx += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        draw();
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    hs.addEventListener("input", () => { const W = grid.clientWidth; view.sx = (Number(hs.value) / 1000) * Math.max(0, viewBeats() * pxb() - W); draw(); });
    for (const x of [hs, bpmN, snapSel]) x.addEventListener("keydown", (e) => e.stopPropagation());

    keys.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const k = e.key, ctrl = e.ctrlKey || e.metaKey;
        if (k === " ") { e.preventDefault(); P.on ? stop() : play(); }
        else if (k === "Delete" || k === "Backspace") { e.preventDefault(); deleteSel(); }
        else if (ctrl && /^[zZяЯ]$/.test(k)) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if (ctrl && /^[yYнН]$/.test(k)) { e.preventDefault(); redo(); }
        else if (ctrl && /^[dDвВ]$/.test(k)) { e.preventDefault(); dupSel(); }
        else if (!ctrl && /^[sSыЫ]$/.test(k)) { e.preventDefault(); splitSel(); }
    });
    keys.addEventListener("keyup", (e) => e.stopPropagation());

    // ---------- панель выделенного ----------
    function rng(label, min, max, step, val, fmt, set) {
        const f = el("label", "");
        f.style.cssText = "display:flex;align-items:center;gap:4px";
        f.appendChild(document.createTextNode(label));
        const r = el("input"); r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val);
        const v = el("span", "", fmt(val));
        let pushed = false;
        r.addEventListener("input", () => { if (!pushed) { pushUndo(); pushed = true; } const x = parseFloat(r.value); v.textContent = fmt(x); set(x); draw(); });
        r.addEventListener("change", () => { pushed = false; save(); restartSoon(); });
        r.addEventListener("keydown", (e) => e.stopPropagation());
        f.appendChild(r); f.appendChild(v);
        return f;
    }
    function buildSel() {
        selp.innerHTML = "";
        const c = findClip(sel);
        if (!c || S.bypass) {
            selp.appendChild(document.createTextNode(S.bypass
                ? T("⏭ ПРОПУСТИТЬ включена — все звуки идут в Пульт как есть", "⏭ BYPASS is on — all sounds go to the Pult as they are")
                : T("Тяните блоки · края — обрезка · двойной клик по пустому — поставить звук · Пробел — играть · Delete — удалить · Ctrl+D — копия",
                    "Drag blocks · edges — trim · double click empty — place a sound · Space — play · Delete — delete · Ctrl+D — copy")));
            return;
        }
        const nm = el("b", "", (items[c.src] ? items[c.src].name : "—"));
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
        zoomR.value = String(Math.round(S.zoom));
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
        if (S.bypass) stop();
        save(); showTop(); buildSel(); draw();
        setStatus(S.bypass ? T("Пульт видит все звуки по отдельности", "The Pult sees every sound separately") : T("Пульт видит только результат сэмплера", "The Pult sees only the sampler result"));
    });
    playB.addEventListener("click", () => (P.on ? stop() : play()));
    stopB.addEventListener("click", () => { stop(); pos = 0; drawHead(); });
    helpB.addEventListener("click", showHelp);
    bpmR.addEventListener("input", () => setBpm(parseFloat(bpmR.value)));
    bpmN.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = parseFloat(bpmN.value); if (Number.isFinite(v)) setBpm(v); bpmN.blur(); } });
    bpmN.addEventListener("blur", () => { const v = parseFloat(bpmN.value); if (Number.isFinite(v) && v !== bpm()) setBpm(v); else showTop(); });
    snapSel.addEventListener("change", () => { S.snap = snapSel.value; save(); draw(); });
    zoomR.addEventListener("input", () => { S.zoom = parseFloat(zoomR.value); save(); draw(); });

    // ---------- нода ----------
    const dom = node.addDOMWidget("neron_sampler", "neron_sampler", outer, { serialize: false, hideOnZoom: false });
    makeUserSized(node, dom, outer, { minH: 200, autoH: () => 360, margin: 4, onLayout: () => draw() });
    outer.style.overflow = "hidden";
    new ResizeObserver(() => draw()).observe(grid);
    const wanted = node.computeSize ? node.computeSize() : [900, 400];
    node.setSize([Math.max(wanted[0], 900), Math.max(wanted[1], 200)]);

    let lastBpm = bpm();
    const poll = setInterval(() => {
        if (document.hidden || disposed) return;
        syncItems();
        if (bpm() !== lastBpm) { lastBpm = bpm(); showTop(); draw(); restartSoon(); }   // Пульт поменял темп
    }, 400);

    node.neronReload = () => { stop(); loadState(); items = []; syncItems(); showTop(); buildHeads(); buildSel(); draw(); };
    node.neronDispose = () => { disposed = true; stop(); clearInterval(poll); };

    loadState();
    showTop();
    buildHeads();
    buildSel();
    syncItems();
    setTimeout(draw, 50);
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
