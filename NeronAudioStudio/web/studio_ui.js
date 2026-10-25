import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { neronTap, makeUserSized, peakOf, meterStep, drawMeter, meterTap, ROOMS, ROOM_ORDER, ROOM_NAME, roomImpulse, makeKnob } from "./neron_common.js";

// ============================================================================
//  Neron Studio / Студия
//  RU: Посредник между «Музыкой» (или «Звук ×8», сэмплером) и Пультом. Каждая дорожка
//      студии — свой канал: громкость, баланс, M/S, НИЗ / СЕР / ВЕРХ, ЭХО. На выходе —
//      общий эквалайзер на 10 полос с живым спектром и готовыми настройками.
//      ⏭ ПРОПУСТИТЬ — всё идёт в Пульт как было.
//  EN: Between Music (or Sound ×8, the sampler) and the Pult. Every studio track is its
//      own channel: volume, pan, M/S, LOW / MID / HIGH, REVERB. A 10-band master EQ with
//      a live spectrum and presets. ⏭ BYPASS — everything goes to the Pult as it was.
// ============================================================================

const NODE = "NeronStudio";
const MAX_CH = 16;
const EQF = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_Q = 1.1;
const ROW_H = 46, EQ_H = 150;
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const PRESETS = [
    ["flat", "Ровно", "Flat", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["bass", "Больше баса", "More bass", [6, 5, 3, 1, 0, 0, 0, 0, 0, 0]],
    ["bright", "Ярче", "Brighter", [0, 0, 0, 0, 0, 1, 2, 3, 4, 5]],
    ["warm", "Тёплый", "Warm", [3, 3, 2, 1, 0, -1, -1, -2, -3, -3]],
    ["voice", "Голос впереди", "Voice up front", [-3, -2, -1, 0, 1, 3, 4, 3, 1, 0]],
    ["smile", "Улыбка (V)", "Smile (V)", [5, 4, 2, 0, -2, -2, 0, 2, 4, 5]],
    ["club", "Клуб", "Club", [6, 5, 2, 0, -1, 0, 1, 2, 3, 2]],
    ["radio", "Старое радио", "Old radio", [-12, -12, -8, -2, 2, 4, 4, 0, -8, -12]],
];
const GROUP = { drums: "🥁", piano: "🎹", sound: "🎵", sampler: "🎛" };
const T = (ru, en) => `${ru} / ${en}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}
function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}
function toStereo(ctx, buf) {
    const out = ctx.createBuffer(2, buf.length, buf.sampleRate);
    out.copyToChannel(buf.getChannelData(0), 0);
    out.copyToChannel(buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0), 1);
    return out;
}
function pt(e, cv) {
    const r = cv.getBoundingClientRect();
    const kx = cv.clientWidth / (r.width || 1), ky = cv.clientHeight / (r.height || 1);
    return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
}
function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
}
const parseJ = (v) => { try { const o = JSON.parse(v); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } };
// 1 такт, 2 такта, 5 тактов
const ruBars = (n) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? "такт" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "такта" : "тактов"; };
const fLabel = (f) => (f >= 1000 ? (f / 1000) + "k" : String(f));

// ключ канала — имя дорожки; одинаковые имена: «#2», «#3» (так же на сервере)
function channelKeys(names) {
    const seen = {};
    return names.map((n) => { seen[n] = (seen[n] || 0) + 1; return seen[n] === 1 ? n : `${n} #${seen[n]}`; });
}

// что пришло по проводу -> дорожки (то же, что считает сервер)
function sourcesOf(o) {
    if (!o) return [];
    const cls = o.comfyClass || o.type;
    const wv = (n) => (o.widgets || []).find((w) => w.name === n)?.value;
    if (cls === "NeronMusic") {
        const kit = String(wv("kit_name") || "default").trim() || "default";
        const bpm = clamp(Number(wv("bpm")) || 90, 40, 300);
        const out = [];
        const pj = parseJ(wv("pattern_json")), rj = parseJ(wv("project_json"));
        (Array.isArray(pj.tracks) ? pj.tracks : []).forEach((t, i) => {
            if (!t || typeof t !== "object") return;
            out.push({ name: String(t.name || t.folder || `Track ${i + 1}`), group: "drums", color: t.color,
                spec: { type: "drum", kit_name: kit, bpm, json: JSON.stringify({ ...pj, tracks: [{ ...t, solo: false }] }) } });
        });
        (Array.isArray(rj.tracks) ? rj.tracks : []).forEach((t, i) => {
            if (!t || typeof t !== "object") return;
            out.push({ name: String(t.name || t.folder || `Track ${i + 1}`), group: "piano", color: t.color,
                spec: { type: "piano", kit_name: kit, bpm, json: JSON.stringify({ ...rj, tracks: [{ ...t, solo: false }] }) } });
        });
        return out.slice(0, MAX_CH);
    }
    const fileSrc = (f) => ({ name: f.name, group: "sound", spec: { type: "file", name: f.name, subfolder: f.subfolder || "", kind: f.type || "input", start: f.start || 0, end: f.end || 0 } });
    if (cls === "NeronSoundCube" && typeof o.neronCube === "function") return o.neronCube().items.slice(0, MAX_CH).map(fileSrc);
    if (cls === "NeronSampler" && typeof o.neronCube === "function") {
        const st = o.neronCube();
        if (st.bypass) return st.items.slice(0, MAX_CH).map(fileSrc);
        return st.spec ? [{ name: "Сэмплер / Sampler", group: "sampler", spec: st.spec }] : [];
    }
    return [];
}

function injectStyles() {
    if (document.getElementById("neron-studio-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-studio-styles";
    s.textContent = `
.nst-outer{box-sizing:border-box;width:100%;padding-bottom:10px}
.nst-root{box-sizing:border-box;width:100%;height:100%;padding:8px 10px;background:var(--nt-panel,#1b1d23);border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:var(--nt-text,#cfd2d8);user-select:none;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.nst-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:none}
.nst-btn{height:26px;padding:0 11px;border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;background:var(--nt-btn,#4a4e5a);
  white-space:nowrap;line-height:26px;flex:none;font-family:inherit}
.nst-btn:hover{filter:brightness(1.18)}
.nst-btn.sm{height:22px;line-height:22px;padding:0 8px;font-size:10px}
.nst-byp.on{background:#d9a72b;color:var(--nt-panel,#1b1d23)}
.nst-lbl{font-size:10px;font-weight:700;color:var(--nt-muted,#8b90a0);letter-spacing:.5px;white-space:nowrap}
.nst-status{flex:1;min-width:100px;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.nst-status.err{color:#ff8a80}
.nst-mm{width:130px;height:16px;flex:none;background:var(--nt-well,#101216);border-radius:3px}
.nst-help{display:none;flex:none;background:var(--nt-card,#20232a);border-radius:7px;padding:8px 10px;font-size:11px;line-height:1.55}
.nst-help b{color:#ffd166}
.nst-list{display:flex;flex-direction:column;gap:4px;flex:1;min-height:40px;overflow-y:auto;overflow-x:hidden}
.nst-row{display:flex;align-items:center;gap:7px;height:${ROW_H}px;box-sizing:border-box;background:var(--nt-row,#242831);border-radius:7px;padding:0 8px;flex:none}
.nst-dot{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
.nst-name{width:132px;flex:none;display:flex;flex-direction:column;min-width:0}
.nst-name b{font-size:12px;color:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nst-name span{font-size:9px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nst-meter{width:14px;height:36px;flex:none;background:var(--nt-well,#101216);border-radius:3px}
.nst-ms{width:22px;height:20px;padding:0;border:none;border-radius:4px;background:var(--nt-btn2,#363a44);color:var(--nt-muted2,#9aa0ae);font-size:10px;font-weight:700;cursor:pointer;flex:none}
.nst-ms.on-m{background:#b3414a;color:#fff}
.nst-ms.on-s{background:#d9a72b;color:var(--nt-panel,#1b1d23)}
.nst-ms.on-p{background:#2e8b3d;color:#fff}
.nst-mini{display:flex;align-items:center;gap:4px;font-size:9px;color:var(--nt-muted,#8b90a0);flex:none}
.nst-mini input{width:66px;height:14px;margin:0;accent-color:var(--c)}
.nst-wave{position:relative;flex:1;min-width:60px;height:34px;background:var(--nt-deep,#15171c);border-radius:4px;overflow:hidden}
.nst-wave canvas{position:absolute;inset:0;width:100%;height:100%}
.nst-wave i{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.85;display:none}
.nst-wave span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--nt-muted,#8b90a0)}
.nst-fx{display:flex;align-items:center;gap:2px;flex:none;padding:0 4px;border-left:1px solid var(--nt-line,#33363e);border-right:1px solid var(--nt-line,#33363e)}
.nst-empty{padding:14px 10px;font-size:11px;color:var(--nt-muted,#8b90a0);line-height:1.55;background:var(--nt-card,#20232a);border-radius:7px}
.nst-eqhead{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:none}
.nst-eqhead b{font-size:11px;font-weight:800;color:var(--nt-bright,#e6e8ee);letter-spacing:.5px}
.nst-sel{height:22px;box-sizing:border-box;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);border:1px solid var(--nt-line,#33363e);border-radius:4px;font-size:11px;outline:none}
.nst-sel option{background:var(--nt-input,#23252b)}
.nst-fcv{width:100%;display:block;border-radius:7px;background:var(--nt-well,#121318);touch-action:none;flex:none}
.nst-eq{width:100%;height:${EQ_H}px;display:block;border-radius:7px;background:var(--nt-well,#121318);touch-action:none;cursor:ns-resize;flex:none}
.nm-knob{display:flex;flex-direction:column;align-items:center;width:30px;flex:none;cursor:ns-resize}
.nm-knob canvas{width:26px;height:26px;display:block;touch-action:none}
.nm-knob span{font-size:8px;font-weight:700;color:var(--nt-muted,#8b90a0);line-height:9px;letter-spacing:.3px;white-space:nowrap}
.nm-room{width:40px;height:20px;padding:0;border:none;border-radius:4px;background:var(--nt-btn2,#363a44);color:var(--nt-muted2,#9aa0ae);font-size:9px;font-weight:700;cursor:pointer;flex:none}
.nm-room.on{background:#6b4fb3;color:#fff}
.nm-fxreset{width:16px;height:16px;padding:0;border:none;border-radius:3px;background:transparent;color:#6c7180;font-size:11px;cursor:pointer;flex:none;visibility:hidden}
.nm-fxreset:hover{color:#fff}
`;
    document.head.appendChild(s);
}

function setupStudio(node) {
    injectStyles();
    const jw = (node.widgets || []).find((w) => w.name === "studio_json");
    if (jw) { jw.type = "hidden"; jw.hidden = true; jw.computeSize = () => [0, -4]; }

    function normalize(o) {
        o = o && typeof o === "object" ? o : {};
        const S = {
            version: 1, bypass: o.bypass === true, master: typeof o.master === "number" ? clamp(o.master, 0, 1.5) : 1,
            eq_on: o.eq_on !== false, eq: EQF.map((_, i) => clamp(Number((o.eq || [])[i]) || 0, -12, 12)),
            preset: typeof o.preset === "string" ? o.preset : "flat", ch: {},
            // 🧲 поле сборки: блоки дорожек по тактам (пусто — всё играет по кругу)
            arr: [], bpm: clamp(Number(o.bpm) || 90, 40, 300), fz: Number(o.fz) > 0 ? Number(o.fz) : 0, fx0: Math.max(0, Number(o.fx0) || 0),
            fcur: Math.max(0, Number(o.fcur) || 0),
        };
        for (const b of Array.isArray(o.arr) ? o.arr.slice(0, 400) : []) {
            if (!b || typeof b.ch !== "string") continue;
            S.arr.push({ id: b.id || Math.random().toString(36).slice(2), ch: b.ch, bar: Math.max(0, Math.round(Number(b.bar) || 0)), len: Math.max(1, Math.round(Number(b.len) || 1)) });
        }
        if (o.ch && typeof o.ch === "object") {
            for (const [k, v] of Object.entries(o.ch)) {
                if (!v || typeof v !== "object") continue;
                S.ch[k] = {
                    vol: typeof v.vol === "number" ? clamp(v.vol, 0, 1.5) : 0.8, pan: typeof v.pan === "number" ? clamp(v.pan, -1, 1) : 0,
                    mute: !!v.mute, solo: !!v.solo, low: clamp(Number(v.low) || 0, -12, 12), mid: clamp(Number(v.mid) || 0, -12, 12),
                    high: clamp(Number(v.high) || 0, -12, 12), rev: clamp(Number(v.rev) || 0, 0, 1), room: ROOMS[v.room] ? v.room : "hall",
                };
            }
        }
        return S;
    }
    let S = normalize(parseJ(jw ? jw.value : "{}"));
    let disposed = false;
    const save = () => { if (jw) jw.value = JSON.stringify(S); };
    const chSet = (key) => (S.ch[key] || (S.ch[key] = { vol: 0.8, pan: 0, mute: false, solo: false, low: 0, mid: 0, high: 0, rev: 0, room: "hall" }));

    // ---------- провод ----------
    function getLink(id) { const g = node.graph; if (!g || !g.links) return null; return g.links instanceof Map ? g.links.get(id) : g.links[id]; }
    function upstreamNode() {
        const inp = (node.inputs || []).find((x) => x.name === "sounds");
        if (!inp || inp.link === null || inp.link === undefined) return null;
        let id = inp.link;
        for (let hop = 0; hop < 6; hop++) {
            const l = getLink(id);
            if (!l) return null;
            const o = node.graph.getNodeById(l.origin_id);
            if (!o) return null;
            if (o.type === "Reroute") { const i0 = o.inputs && o.inputs[0]; if (i0 && i0.link != null) { id = i0.link; continue; } return null; }
            return o;
        }
        return null;
    }
    let chans = [];      // {key, name, group, color, spec, specKey}
    node.neronStudio = () => ({
        bypass: S.bypass, upstream: upstreamNode(), json: JSON.stringify(S),
        sources: chans.map((c) => ({ name: c.name, spec: c.spec })),
    });

    // ---------- каркас ----------
    const outer = el("div", "nst-outer");
    const root = el("div", "nst-root");
    outer.appendChild(root);
    const bar = el("div", "nst-bar");
    const bypBtn = el("button", "nst-btn nst-byp", "⏭ ПРОПУСТИТЬ / BYPASS");
    bypBtn.title = T("Нажата: всё идёт в Пульт как было. Отжата: Пульт слышит Студию одним каналом", "On: everything goes to the Pult as it was. Off: the Pult hears the Studio as one channel");
    const playBtn = el("button", "nst-btn", "▶ PLAY");
    playBtn.style.background = "#3fa34d";
    playBtn.title = T("Слушать все дорожки вместе по кругу", "Play all tracks together in a loop");
    const stopBtn = el("button", "nst-btn", "■ STOP");
    stopBtn.style.background = "#b3414a";
    const mLbl = el("span", "nst-lbl", "MASTER");
    const master = el("input");
    master.type = "range"; master.min = "0"; master.max = "1.5"; master.step = "0.01"; master.style.cssText = "width:90px;accent-color:#ff9f43";
    master.title = T("Общая громкость (двойной клик — сброс)", "Master volume (double-click — reset)");
    const mm = el("canvas", "nst-mm");
    mm.title = T("Общий уровень L/R", "Master level L/R");
    const status = el("div", "nst-status");
    const helpBtn = el("button", "nst-btn sm", "📖");
    [bypBtn, playBtn, stopBtn, mLbl, master, mm, status, helpBtn].forEach((x) => bar.appendChild(x));
    root.appendChild(bar);
    const help = el("div", "nst-help");
    help.innerHTML =
        "<b>RU:</b> Студия стоит между «Музыкой» (или «Звук ×8», сэмплером) и Пультом. Каждая дорожка — свой канал: ▶ (слушать только её), M, S, громкость, баланс, "
        + "<b>НИЗ / СЕР / ВЕРХ</b>, <b>ЭХО</b> + помещение (клик — комната / зал / собор), ↺ — сброс. "
        + "Внизу <b>ОБЩИЙ ЭКВАЛАЙЗЕР</b> на 10 полос: тяните точки вверх-вниз (колёсико — точнее, двойной клик — в ноль), справа готовые настройки; "
        + "<b>ВКЛ / ВЫКЛ</b> — сравнить «с ним / без него». Цветная заливка — живой спектр звука. "
        + "<b>🧱 ПОЛЕ</b>: клик по полосе дорожки — блок (тянуть — двигать, край — длина, двойной клик / Delete — убрать, Ctrl+D — копия следом, Ctrl+Z — отменить); "
        + "клик по линейке — откуда играть; колёсико — масштаб. Пустое поле — всё по кругу; есть блоки — Пульт слышит собранный трек. ⊞ — все дорожки разом. "
        + "<b>⏭ ПРОПУСТИТЬ</b> — всё идёт в Пульт как было; отжата — Пульт слышит Студию одним каналом.<br>"
        + "<b>EN:</b> The Studio sits between Music (or Sound ×8, the sampler) and the Pult. Every track is its own channel: ▶ (listen alone), M, S, volume, pan, "
        + "<b>LOW / MID / HIGH</b>, <b>REVERB</b> + room, ↺ resets. Below — a 10-band <b>MASTER EQ</b>: drag the points up/down (wheel — fine, double-click — zero), "
        + "presets on the right, <b>ON / OFF</b> to compare. The colour fill is the live spectrum. "
        + "<b>🧱 ARRANGE</b>: click a track lane to put a block (drag to move, edge — length, double-click / Delete — remove, Ctrl+D — copy after, Ctrl+Z — undo); "
        + "click the ruler to set where to play from. An empty field loops everything; with blocks the Pult hears the arranged track. <b>⏭ BYPASS</b> — everything goes to the Pult as it was.";
    root.appendChild(help);
    const list = el("div", "nst-list");
    root.appendChild(list);

    // ---------- 🧱 поле сборки ----------
    const FR = 18, LANE = 34, FHEAD = 120;
    const fhead = el("div", "nst-eqhead");
    fhead.appendChild(el("b", "", "🧱 ПОЛЕ / ARRANGE"));
    const fFill = el("button", "nst-btn sm", "⊞ " + T("ВСЕ ДОРОЖКИ", "ALL TRACKS"));
    fFill.title = T("Поставить каждую дорожку блоком с 1-го такта", "Put every track as a block from bar 1");
    const fDup = el("button", "nst-btn sm", "⧉");
    fDup.title = T("Копия блока следом (Ctrl+D)", "Copy the block right after it (Ctrl+D)");
    const fDel = el("button", "nst-btn sm", "✕ " + T("БЛОК", "BLOCK"));
    fDel.title = T("Убрать выделенный блок (Delete)", "Remove the selected block (Delete)");
    const fUndo = el("button", "nst-btn sm", "↶");
    fUndo.title = T("Отменить (Ctrl+Z)", "Undo (Ctrl+Z)");
    const fClear = el("button", "nst-btn sm", "🗑 " + T("ОЧИСТИТЬ", "CLEAR"));
    fClear.title = T("Убрать все блоки — дорожки снова играют по кругу", "Remove all blocks — tracks loop again");
    const fInfo = el("span", "nst-lbl", "");
    fInfo.style.cssText = "flex:1;text-align:right;font-weight:400";
    [fFill, fDup, fDel, fUndo, fClear, fInfo].forEach((x) => fhead.appendChild(x));
    root.appendChild(fhead);
    const fcv = el("canvas", "nst-fcv");
    root.appendChild(fcv);
    const fkeys = el("textarea");
    fkeys.readOnly = true; fkeys.tabIndex = -1;
    fkeys.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    root.appendChild(fkeys);
    const frefocus = () => setTimeout(() => { if (!disposed) fkeys.focus({ preventScroll: true }); }, 0);

    const eqHead = el("div", "nst-eqhead");
    eqHead.appendChild(el("b", "", "🎚 ОБЩИЙ ЭКВАЛАЙЗЕР / MASTER EQ"));
    const eqOn = el("button", "nst-btn sm", "");
    eqOn.title = T("Сравнить: с эквалайзером / без него", "Compare: with the EQ / without it");
    const presetSel = el("select", "nst-sel");
    const reset = el("button", "nst-btn sm", "⟲ " + T("РОВНО", "FLAT"));
    reset.title = T("Все полосы в ноль", "All bands to zero");
    const eqInfo = el("span", "nst-lbl", "");
    eqInfo.style.cssText = "flex:1;text-align:right;font-weight:400";
    [eqOn, presetSel, reset, eqInfo].forEach((x) => eqHead.appendChild(x));
    root.appendChild(eqHead);
    const eqCv = el("canvas", "nst-eq");
    root.appendChild(eqCv);
    function fillPresets() {
        presetSel.innerHTML = "";
        const custom = el("option", "", "— " + T("своя", "custom") + " —");
        custom.value = "custom";
        presetSel.appendChild(custom);
        for (const [id, ru, en] of PRESETS) { const o = el("option", "", T(ru, en)); o.value = id; presetSel.appendChild(o); }
        presetSel.value = PRESETS.some((p) => p[0] === S.preset) ? S.preset : "custom";
    }

    function setStatus(t, err) { status.textContent = t || ""; status.title = t || ""; status.className = "nst-status" + (err ? " err" : ""); }

    // ---------- звук ----------
    const A = { master: null, eq: [], an: null, mtap: null, mL: {}, mR: {}, chains: new Map() };
    function audio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!A.master) {
            A.in = ctx.createGain();
            let prev = A.in;
            EQF.forEach((f, i) => {
                const b = ctx.createBiquadFilter();
                b.type = i === 0 ? "lowshelf" : i === EQF.length - 1 ? "highshelf" : "peaking";
                b.frequency.value = f; b.Q.value = EQ_Q; b.gain.value = 0;
                prev.connect(b); prev = b; A.eq.push(b);
            });
            A.master = ctx.createGain();
            prev.connect(A.master);
            const lim = ctx.createDynamicsCompressor();
            lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
            A.master.connect(lim);
            lim.connect(ctx.destination); neronTap(ctx, lim);
            A.an = ctx.createAnalyser();
            A.an.fftSize = 4096; A.an.smoothingTimeConstant = 0.8;
            lim.connect(A.an);
            A.mtap = meterTap(ctx, lim);
            applyEq(true); applyMaster();
        }
        return ctx;
    }
    function applyEq(now) {
        if (!A.master) return;
        const ctx = getCtx();
        A.eq.forEach((b, i) => {
            const v = S.eq_on ? S.eq[i] : 0;
            if (now) b.gain.value = v; else b.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
        });
    }
    function applyMaster() { if (A.master) A.master.gain.setTargetAtTime(S.master, getCtx().currentTime, 0.02); }
    function chain(key) {
        let c = A.chains.get(key);
        if (c) return c;
        const ctx = audio();
        const input = ctx.createGain(); input.channelCount = 2; input.channelCountMode = "explicit";
        const lo = ctx.createBiquadFilter(); lo.type = "lowshelf"; lo.frequency.value = 200;
        const mi = ctx.createBiquadFilter(); mi.type = "peaking"; mi.frequency.value = 1000; mi.Q.value = 0.9;
        const hi = ctx.createBiquadFilter(); hi.type = "highshelf"; hi.frequency.value = 4000;
        const dry = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain(), sum = ctx.createGain();
        conv.normalize = false; wet.gain.value = 0;
        input.connect(lo); lo.connect(mi); mi.connect(hi);
        hi.connect(dry); dry.connect(sum); hi.connect(conv); conv.connect(wet); wet.connect(sum);
        const sp = ctx.createChannelSplitter(2), gl = ctx.createGain(), gr = ctx.createGain(), mg = ctx.createChannelMerger(2), vol = ctx.createGain();
        sum.connect(sp); sp.connect(gl, 0); sp.connect(gr, 1); gl.connect(mg, 0, 0); gr.connect(mg, 0, 1); mg.connect(vol); vol.connect(A.in);
        c = { input, lo, mi, hi, dry, conv, wet, gl, gr, vol, tap: meterTap(ctx, vol), room: null, mL: {}, mR: {} };
        A.chains.set(key, c);
        applyCh(key, true);
        return c;
    }
    const anySolo = () => chans.some((c) => chSet(c.key).solo);
    const audible = (key) => {
        if (P.only) return key === P.only;
        const st = chSet(key);
        return !st.mute && (!anySolo() || st.solo);
    };
    function applyCh(key, now) {
        const c = A.chains.get(key);
        if (!c) return;
        const st = chSet(key), ctx = getCtx();
        const set = (p, v) => { if (now) p.value = v; else p.setTargetAtTime(v, ctx.currentTime, 0.015); };
        set(c.vol.gain, audible(key) ? st.vol : 0);
        set(c.gl.gain, Math.min(1, 1 - st.pan)); set(c.gr.gain, Math.min(1, 1 + st.pan));
        set(c.lo.gain, st.low); set(c.mi.gain, st.mid); set(c.hi.gain, st.high);
        if (st.rev > 0.005 && c.room !== st.room) { c.conv.buffer = roomImpulse(ctx, st.room); c.room = st.room; }
        set(c.wet.gain, st.rev > 0.005 ? 0.9 * st.rev : 0);
        set(c.dry.gain, 1 - 0.35 * st.rev);
    }
    const applyAll = () => chans.forEach((c) => applyCh(c.key, false));

    // ---------- буферы ----------
    const bufs = new Map();     // specKey -> AudioBuffer
    const loading = new Map();
    async function load(c) {
        if (bufs.has(c.specKey)) return bufs.get(c.specKey);
        if (loading.has(c.specKey)) return loading.get(c.specKey);
        const pr = (async () => {
            const res = await api.fetchApi("/neron/preview_wav", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.spec), cache: "no-store" });
            if (!res.ok) throw new Error((await res.text()) || "HTTP " + res.status);
            const ctx = getCtx();
            const b = toStereo(ctx, await ctx.decodeAudioData(await res.arrayBuffer()));
            bufs.set(c.specKey, b);
            return b;
        })();
        loading.set(c.specKey, pr);
        try { return await pr; } catch (e) { setStatus(`${c.name}: ${e.message}`, true); return null; } finally { loading.delete(c.specKey); }
    }

    // ---------- проигрывание ----------
    const P = { on: false, only: null, t0: 0, items: [], raf: null, token: 0 };
    async function start() {
        if (!chans.length) { setStatus(T("Подключите «Музыку», «Звук ×8» или сэмплер ко входу sounds", "Wire Music, Sound ×8 or the sampler into sounds"), true); return; }
        const tok = ++P.token;
        setStatus(T("Готовлю звук…", "Preparing sound…"));
        audio();
        await Promise.all(chans.map(load));
        if (tok !== P.token) return;
        stopSources();
        if (P.timer) { clearInterval(P.timer); P.timer = null; }
        const ctx = getCtx();
        if (arrOn()) {
            // собранный трек: каждая дорожка звучит только в своих блоках; трек играет по кругу
            P.arr = true;
            P.bs = barSec();
            P.L = Math.max(1, songBars()) * P.bs;
            let off = Math.min(S.fcur || 0, songBars()) * P.bs;
            if (off >= P.L - 0.01) off = 0;
            P.tReal = ctx.currentTime + 0.06;
            P.t0 = P.tReal - off;
            P.k = 0;
            P.on = true;
            pumpArr();
            P.timer = setInterval(pumpArr, 100);
            applyAll();
            setStatus(P.only ? T("Играет только: ", "Playing only: ") + P.only : T("Играет собранный трек", "Playing the arranged track"));
            paintRows();
            if (!P.raf) P.raf = requestAnimationFrame(loop);
            return;
        }
        P.arr = false;
        P.t0 = ctx.currentTime + 0.06;
        for (const c of chans) {
            const b = bufs.get(c.specKey);
            if (!b) continue;
            const src = ctx.createBufferSource();
            src.buffer = b; src.loop = true;
            src.connect(chain(c.key).input);
            src.start(P.t0);
            P.items.push(src);
        }
        P.on = true;
        applyAll();
        setStatus(P.only ? T("Играет только: ", "Playing only: ") + P.only : T("Играют все дорожки", "All tracks playing"));
        paintRows();
        if (!P.raf) P.raf = requestAnimationFrame(loop);
    }
    P.fpos = () => { const t = getCtx().currentTime - P.t0; return (((t % P.L) + P.L) % P.L) / P.bs; };
    function pumpArr() {
        if (!P.on || !P.arr) return;
        const ctx = getCtx(), now = ctx.currentTime;
        while (P.t0 + P.k * P.L < now + 0.6) {
            const base = P.t0 + P.k * P.L;
            for (const bl of liveArr()) {
                const c = chans.find((x) => x.key === bl.ch);
                const buf = c && bufs.get(c.specKey);
                if (!buf) continue;
                const bs = base + bl.bar * P.bs, be = bs + bl.len * P.bs;
                if (be <= P.tReal + 0.01) continue;
                const at = Math.max(bs, P.tReal);
                const src = ctx.createBufferSource();
                src.buffer = buf; src.loop = true;
                src.connect(chain(c.key).input);
                src.start(at, (at - bs) % buf.duration);
                src.stop(be);
                src.onended = () => { const i = P.items.indexOf(src); if (i >= 0) P.items.splice(i, 1); };
                P.items.push(src);
            }
            P.k++;
        }
    }
    function stopSources() { for (const s of P.items) { try { s.stop(); } catch (e) { /* ок */ } } P.items = []; }
    function stop() {
        P.token++;
        P.on = false; P.only = null; P.arr = false;
        if (P.timer) { clearInterval(P.timer); P.timer = null; }
        stopSources();
        drawField();
        applyAll(); paintRows();
        setStatus("");
    }
    const restartIfPlaying = () => { if (P.on) start(); };
    playBtn.addEventListener("click", () => { P.only = null; start(); });
    stopBtn.addEventListener("click", stop);

    // ---------- каналы ----------
    const rows = new Map();
    function buildRows() {
        list.innerHTML = "";
        rows.clear();
        if (!chans.length) {
            list.appendChild(el("div", "nst-empty", T("Подключите выход sounds «Музыки» (или «Звук ×8», сэмплера) ко входу sounds — каждая дорожка появится здесь своим каналом.",
                "Wire the sounds output of Music (or Sound ×8, the sampler) into sounds — every track appears here as its own channel.")));
            return;
        }
        chans.forEach((c, idx) => {
            const st = chSet(c.key);
            const color = c.color || COLORS[idx % COLORS.length];
            const row = el("div", "nst-row");
            row.style.setProperty("--c", color);
            row.appendChild(el("div", "nst-dot"));
            const nm = el("div", "nst-name");
            nm.appendChild(el("b", "", `${GROUP[c.group] || "🎵"} ${c.key}`));
            nm.appendChild(el("span", "", { drums: T("барабаны", "drums"), piano: T("пианино", "piano"), sound: T("звук", "sound"), sampler: T("сэмплер", "sampler") }[c.group] || ""));
            nm.title = c.key;
            row.appendChild(nm);
            const meter = el("canvas", "nst-meter");
            row.appendChild(meter);
            const pb = el("button", "nst-ms", "▶");
            pb.title = T("Слушать только эту дорожку", "Listen to this track alone");
            const mb = el("button", "nst-ms" + (st.mute ? " on-m" : ""), "M");
            mb.title = T("Выключить (Mute)", "Mute");
            const sb = el("button", "nst-ms" + (st.solo ? " on-s" : ""), "S");
            sb.title = T("Только эта (Solo)", "Solo");
            [pb, mb, sb].forEach((x) => row.appendChild(x));
            const mk = (lbl, min, max, step, val, title, fn, def) => {
                const g = el("div", "nst-mini");
                g.appendChild(el("span", "", lbl));
                const r = el("input");
                r.type = "range"; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val);
                r.title = title;
                r.addEventListener("input", () => fn(parseFloat(r.value)));
                r.addEventListener("dblclick", () => { r.value = String(def); fn(def); });
                g.appendChild(r);
                row.appendChild(g);
            };
            mk("VOL", 0, 1.2, 0.01, st.vol, T("Громкость (двойной клик — сброс)", "Volume (double-click — reset)"), (v) => { st.vol = v; applyCh(c.key); save(); }, 0.8);
            mk("PAN", -1, 1, 0.05, st.pan, T("Баланс (двойной клик — центр)", "Pan (double-click — centre)"), (v) => { st.pan = v; applyCh(c.key); save(); }, 0);
            // эквалайзер канала + эхо
            const fx = el("div", "nst-fx");
            const fxReset = el("button", "nm-fxreset", "↺");
            fxReset.title = T("Сбросить эквалайзер и эхо", "Reset EQ and reverb");
            const showReset = () => { fxReset.style.visibility = st.low || st.mid || st.high || st.rev ? "visible" : "hidden"; };
            const dB = (x) => (x > 0 ? "+" : "") + x.toFixed(1) + " dB";
            const knobs = {};
            const band = (key, label, title) => {
                knobs[key] = makeKnob({ label, title, min: -12, max: 12, def: 0, step: 0.5, wheel: 1, bipolar: true, color, value: st[key], fmt: dB,
                    onChange: (x) => { st[key] = x; applyCh(c.key); showReset(); }, onEnd: save });
                fx.appendChild(knobs[key]);
            };
            band("low", "НИЗ", T("НИЗ — бас, 200 Гц", "LOW — bass, 200 Hz"));
            band("mid", "СЕР", T("СЕРЕДИНА, 1 кГц", "MID, 1 kHz"));
            band("high", "ВЕРХ", T("ВЕРХ — блеск, 4 кГц", "HIGH — brightness, 4 kHz"));
            const roomBtn = el("button", "nm-room");
            const showRoom = () => {
                roomBtn.textContent = ROOM_NAME[st.room][0];
                roomBtn.classList.toggle("on", st.rev > 0.005);
                roomBtn.title = T("Где звучит эхо: комната → зал → собор", "Where the echo sounds: room → hall → cathedral") + "\n" + ROOM_NAME[st.room].join(" / ");
            };
            knobs.rev = makeKnob({ label: "ЭХО", title: T("ЭХО — сколько", "REVERB — amount"), min: 0, max: 1, def: 0, step: 0.01, wheel: 0.05, color: "#b197fc", value: st.rev,
                fmt: (x) => Math.round(x * 100) + "%", onChange: (x) => { st.rev = x; applyCh(c.key); showRoom(); showReset(); }, onEnd: save });
            fx.appendChild(knobs.rev);
            roomBtn.addEventListener("click", () => {
                st.room = ROOM_ORDER[(ROOM_ORDER.indexOf(st.room) + 1) % ROOM_ORDER.length];
                if (!(st.rev > 0.005)) { st.rev = 0.3; knobs.rev.setValue(0.3); }
                applyCh(c.key); showRoom(); showReset(); save();
            });
            fx.appendChild(roomBtn);
            fxReset.addEventListener("click", () => { st.low = st.mid = st.high = st.rev = 0; ["low", "mid", "high", "rev"].forEach((k) => knobs[k].setValue(0)); applyCh(c.key); showRoom(); showReset(); save(); });
            fx.appendChild(fxReset);
            showRoom(); showReset();
            row.appendChild(fx);
            const wave = el("div", "nst-wave");
            const wcv = el("canvas");
            const head = el("i");
            const note = el("span", "", T("готовлю звук…", "preparing…"));
            [wcv, head, note].forEach((x) => wave.appendChild(x));
            row.appendChild(wave);
            pb.addEventListener("click", () => { if (P.on && P.only === c.key) { stop(); return; } P.only = c.key; start(); });
            mb.addEventListener("click", () => { st.mute = !st.mute; mb.classList.toggle("on-m", st.mute); applyAll(); save(); });
            sb.addEventListener("click", () => { st.solo = !st.solo; sb.classList.toggle("on-s", st.solo); applyAll(); save(); });
            list.appendChild(row);
            rows.set(c.key, { meter, pb, wcv, head, note, color, mL: {}, mR: {} });
            load(c).then((b) => { if (b) drawWave(c.key, b); });
        });
        paintRows();
    }
    function drawWave(key, b) {
        const r = rows.get(key);
        if (!r) return;
        r.note.style.display = "none";
        const W = 400, H = 34;
        r.wcv.width = W; r.wcv.height = H;
        const g = r.wcv.getContext("2d");
        const L = b.getChannelData(0), R = b.getChannelData(1), per = Math.max(1, Math.floor(b.length / W));
        g.fillStyle = r.color; g.globalAlpha = 0.85;
        for (let x = 0; x < W; x++) {
            let p = 0;
            for (let i = x * per, e = Math.min(b.length, i + per); i < e; i += 8) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
            const h = Math.max(1, p * H * 0.95);
            g.fillRect(x, (H - h) / 2, 1, h);
        }
    }
    function paintRows() {
        for (const [key, r] of rows) {
            const on = P.on && P.only === key;
            r.pb.classList.toggle("on-p", on);
            r.pb.textContent = on ? "■" : "▶";
        }
        bypBtn.classList.toggle("on", S.bypass);
        eqOn.textContent = S.eq_on ? "● " + T("ВКЛ", "ON") : "○ " + T("ВЫКЛ", "OFF");
        eqOn.style.background = S.eq_on ? "#2e8b3d" : "#4a4e5a";
        master.value = String(S.master);
    }

    // ---------- 🧱 поле: такты, блоки ----------
    function bpmNow() {
        const up = upstreamNode();
        const w = up && (up.widgets || []).find((x) => x.name === "bpm");
        return clamp(Number(w ? w.value : S.bpm) || 90, 40, 300);
    }
    const barSec = () => 240 / bpmNow();
    // волна дорожки для блоков: 256 пиков на один луп
    const peaksCache = new Map();
    function peaksOf(c) {
        const b = c && bufs.get(c.specKey);
        if (!b) return null;
        if (peaksCache.has(c.specKey)) return peaksCache.get(c.specKey);
        const N = 256, L = b.getChannelData(0), R = b.getChannelData(1), per = Math.max(1, Math.floor(b.length / N));
        const pk = new Float32Array(N);
        for (let x = 0; x < N; x++) { let m = 0; for (let i = x * per, e = Math.min(b.length, i + per); i < e; i += 4) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); pk[x] = m; }
        peaksCache.set(c.specKey, pk);
        return pk;
    }
    const loopBars = (c) => { const b = c && bufs.get(c.specKey); return b ? Math.max(1, Math.round(b.duration / barSec())) : 1; };
    const liveArr = () => S.arr.filter((b) => chans.some((c) => c.key === b.ch));
    const arrOn = () => liveArr().length > 0;
    const songBars = () => liveArr().reduce((m, b) => Math.max(m, b.bar + b.len), 0);
    let fsel = null, fdrag = null;
    const fUndoS = [];
    const fPush = () => { fUndoS.push(JSON.stringify(S.arr)); if (fUndoS.length > 80) fUndoS.shift(); };
    const ppb = () => (S.fz > 0 ? S.fz : Math.max(8, (fcv.clientWidth - FHEAD - 10) / Math.max(8, songBars() + 2)));
    const fX = (bar) => FHEAD + (bar - S.fx0) * ppb();
    const fBar = (x) => S.fx0 + (x - FHEAD) / ppb();
    function fieldChanged() {
        S.bpm = bpmNow();
        save();
        drawField();
        if (P.on) start();
    }
    function drawField() {
        const n = Math.max(1, chans.length);
        const hh = FR + n * LANE;
        if (fcv.style.height !== hh + "px") fcv.style.height = hh + "px";
        const { g, w, h } = fitCanvas(fcv);
        g.clearRect(0, 0, w, h);
        const k = ppb();
        // полосы дорожек
        chans.forEach((c, i) => {
            const y = FR + i * LANE;
            g.fillStyle = i % 2 ? "#17191f" : "#1a1c23"; g.fillRect(FHEAD, y, w - FHEAD, LANE);
            g.fillStyle = "#20232a"; g.fillRect(0, y, FHEAD - 2, LANE - 1);
            const col = rows.get(c.key)?.color || COLORS[i % COLORS.length];
            g.fillStyle = col; g.fillRect(4, y + 7, 10, 10);
            g.fillStyle = "#cfd2d8"; g.font = "bold 10px Segoe UI"; g.textBaseline = "middle";
            g.save(); g.beginPath(); g.rect(18, y, FHEAD - 22, LANE); g.clip(); g.fillText(c.key, 19, y + LANE / 2); g.restore();
        });
        // линейка и такты
        g.fillStyle = "#1e2027"; g.fillRect(FHEAD, 0, w - FHEAD, FR);
        const step = k < 14 ? 4 : k < 26 ? 2 : 1;
        for (let b = Math.floor(S.fx0); fX(b) < w; b++) {
            const x = Math.round(fX(b)) + 0.5;
            if (x < FHEAD) continue;
            g.fillStyle = b % 4 === 0 ? "#3a3e4a" : "#262931"; g.fillRect(x, FR, 1, h - FR);
            if (b % step === 0) { g.fillStyle = "#8b90a0"; g.font = "9px Segoe UI"; g.textBaseline = "middle"; g.fillText(String(b + 1), x + 3, FR / 2); }
        }
        // блоки
        g.save(); g.beginPath(); g.rect(FHEAD, 0, w - FHEAD, h); g.clip();
        for (const bl of liveArr()) {
            const i = chans.findIndex((c) => c.key === bl.ch);
            const c = chans[i];
            const col = rows.get(c.key)?.color || COLORS[i % COLORS.length];
            const x0 = fX(bl.bar), x1 = fX(bl.bar + bl.len), y = FR + i * LANE + 3, hb = LANE - 6;
            if (x1 < FHEAD || x0 > w) continue;
            g.globalAlpha = 0.85; g.fillStyle = col; g.fillRect(x0 + 1, y, x1 - x0 - 2, hb); g.globalAlpha = 1;
            // волна дорожки внутри блока (луп повторяется)
            const pk = peaksOf(c);
            if (pk) {
                const lb0 = loopBars(c), dur = bufs.get(c.specKey).duration, bs = barSec();
                g.fillStyle = "rgba(10,11,14,.55)";
                const xa = Math.max(x0 + 2, FHEAD), xb = Math.min(x1 - 2, w);
                for (let x = xa; x < xb; x += 1) {
                    const tSec = ((x - x0) / k) * bs;
                    const v = pk[Math.min(pk.length - 1, Math.floor(((tSec % dur) / dur) * pk.length))];
                    const hh2 = Math.max(1, v * (hb - 6));
                    g.fillRect(x, y + hb / 2 - hh2 / 2, 1, hh2);
                }
                void lb0;
            }
            // где луп начинается заново
            const lb = loopBars(c);
            g.fillStyle = "rgba(0,0,0,.35)";
            for (let r = lb; r < bl.len; r += lb) g.fillRect(fX(bl.bar + r) - 1, y + 2, 2, hb - 4);
            g.strokeStyle = bl.id === fsel ? "#fff" : "rgba(0,0,0,.6)"; g.lineWidth = bl.id === fsel ? 2 : 1;
            g.strokeRect(x0 + 1.5, y + 0.5, x1 - x0 - 3, hb - 1);
            g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x1 - 7, y + 4, 3, hb - 8);
            if (x1 - x0 > 40) { g.fillStyle = "#111"; g.font = "bold 9px Segoe UI"; g.textBaseline = "middle"; g.fillText(`${bl.len} ${T("т.", "b.")}`.split(" / ")[0], x0 + 6, y + hb / 2); }
        }
        g.restore();
        if (!arrOn()) {
            g.fillStyle = "rgba(18,19,24,.6)"; g.fillRect(FHEAD, FR, w - FHEAD, h - FR);
            g.fillStyle = "#ffd166"; g.font = "bold 11px Segoe UI"; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(chans.length ? T("Поле пустое — все дорожки играют по кругу. Кликните по полосе дорожки — встанет блок", "Empty field — all tracks loop. Click a track lane to put a block")
                : T("Подключите «Музыку» — здесь появятся её дорожки", "Wire Music — its tracks appear here"), FHEAD + (w - FHEAD) / 2, FR + (h - FR) / 2);
            g.textAlign = "left";
        }
        // курсор / бегунок
        const pos = P.on && P.arr ? P.fpos() : S.fcur;
        const cx = fX(pos);
        if (cx >= FHEAD - 1) {
            g.fillStyle = P.on && P.arr ? "#ffd166" : "#fff";
            g.fillRect(cx - 1, 0, 2, h);
            g.beginPath(); g.moveTo(cx - 6, 0); g.lineTo(cx + 6, 0); g.lineTo(cx, 8); g.fill();
        }
        const sb = songBars();
        fInfo.textContent = arrOn() ? T(`${sb} ${ruBars(sb)} · ${(sb * barSec()).toFixed(1)} с · ${bpmNow()} BPM`, `${sb} bars · ${(sb * barSec()).toFixed(1)} s · ${bpmNow()} BPM`)
            : T("всё по кругу", "everything loops");
        fDel.disabled = fDup.disabled = !fsel;
        fUndo.disabled = !fUndoS.length;
    }
    function fHit(p) {
        if (p.y < FR || p.x < FHEAD) return null;
        const i = Math.floor((p.y - FR) / LANE);
        const c = chans[i];
        if (!c) return null;
        const bar = fBar(p.x);
        const bl = liveArr().find((b) => b.ch === c.key && bar >= b.bar && bar < b.bar + b.len);
        return { i, c, bar, bl, edge: bl && fX(bl.bar + bl.len) - p.x < 9 };
    }
    fcv.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        fcv.setPointerCapture(e.pointerId);
        const p = pt(e, fcv);
        frefocus();
        if (p.y < FR && p.x >= FHEAD) {           // линейка: откуда играть
            S.fcur = Math.max(0, Math.round(fBar(p.x)));
            save(); drawField();
            if (P.on && P.arr) start();
            return;
        }
        const h = fHit(p);
        if (!h) return;
        if (h.bl) {
            fsel = h.bl.id;
            fdrag = { bl: h.bl, mode: h.edge ? "len" : "move", x: p.x, bar0: h.bl.bar, len0: h.bl.len, moved: false };
        } else {
            fPush();
            const bl = { id: Math.random().toString(36).slice(2), ch: h.c.key, bar: Math.max(0, Math.floor(h.bar)), len: loopBars(h.c) };
            S.arr.push(bl);
            fsel = bl.id;
            fdrag = { bl, mode: "len", x: p.x, bar0: bl.bar, len0: bl.len, moved: true, fresh: true };
            fieldChanged();
        }
        drawField();
    });
    fcv.addEventListener("pointermove", (e) => {
        const p = pt(e, fcv);
        if (!fdrag) {
            const h = fHit(p);
            fcv.style.cursor = p.y < FR ? "pointer" : h && h.bl ? (h.edge ? "ew-resize" : "grab") : (h ? "copy" : "default");
            return;
        }
        const d = Math.round((p.x - fdrag.x) / ppb());
        if (!fdrag.moved && d === 0) return;
        if (!fdrag.moved) { fPush(); fdrag.moved = true; }
        if (fdrag.mode === "move") fdrag.bl.bar = Math.max(0, fdrag.bar0 + d);
        else fdrag.bl.len = Math.max(1, fdrag.len0 + d);
        drawField();
    });
    const fUp = () => { if (!fdrag) return; const m = fdrag.moved; fdrag = null; if (m) fieldChanged(); else drawField(); };
    fcv.addEventListener("pointerup", fUp);
    fcv.addEventListener("pointercancel", fUp);
    fcv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        const k = ppb();
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { if (!(S.fz > 0)) S.fz = k; S.fx0 = Math.max(0, S.fx0 + (e.shiftKey ? e.deltaY : e.deltaX) / k); }
        else { const p = pt(e, fcv), bm = fBar(p.x); S.fz = clamp(k * (e.deltaY < 0 ? 1.25 : 0.8), 6, 300); S.fx0 = Math.max(0, bm - (p.x - FHEAD) / S.fz); }
        save(); drawField();
    }, { passive: false });
    fcv.addEventListener("dblclick", (e) => { const h = fHit(pt(e, fcv)); if (h && h.bl) { fPush(); S.arr = S.arr.filter((b) => b.id !== h.bl.id); fsel = null; fieldChanged(); } });
    const delSel = () => { if (!fsel) return; fPush(); S.arr = S.arr.filter((b) => b.id !== fsel); fsel = null; fieldChanged(); };
    const dupSel = () => {
        const bl = S.arr.find((b) => b.id === fsel);
        if (!bl) return;
        fPush();
        const c = { ...bl, id: Math.random().toString(36).slice(2), bar: bl.bar + bl.len };
        S.arr.push(c); fsel = c.id; fieldChanged();
    };
    const undoF = () => { if (!fUndoS.length) return; S.arr = JSON.parse(fUndoS.pop()); fsel = null; fieldChanged(); };
    fDel.addEventListener("click", () => { delSel(); frefocus(); });
    fDup.addEventListener("click", () => { dupSel(); frefocus(); });
    fUndo.addEventListener("click", () => { undoF(); frefocus(); });
    fClear.addEventListener("click", () => { if (!S.arr.length) return; fPush(); S.arr = []; fsel = null; fieldChanged(); setStatus(T("Поле очищено — всё снова по кругу (↶ — вернуть)", "Field cleared — everything loops again (↶ to undo)")); });
    fFill.addEventListener("click", () => {
        if (!chans.length) return;
        fPush();
        const len = Math.max(4, ...chans.map(loopBars));
        S.arr = S.arr.filter((b) => !chans.some((c) => c.key === b.ch));
        for (const c of chans) S.arr.push({ id: Math.random().toString(36).slice(2), ch: c.key, bar: 0, len });
        fieldChanged();
    });
    fkeys.addEventListener("keydown", (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        let used = true;
        if (e.key === "Delete" || e.key === "Backspace") delSel();
        else if (ctrl && e.code === "KeyD") dupSel();
        else if (ctrl && e.code === "KeyZ") undoF();
        else if (e.key === " ") { if (P.on) stop(); else { P.only = null; start(); } }
        else used = false;
        if (used) { e.preventDefault(); e.stopPropagation(); }
    });

    // ---------- общий эквалайзер: рисунок ----------
    const FMIN = 20, FMAX = 20000, DBR = 15;
    const xOf = (f, w) => (Math.log10(f / FMIN) / Math.log10(FMAX / FMIN)) * w;
    const fOf = (x, w) => FMIN * Math.pow(FMAX / FMIN, x / w);
    const yOf = (db, h) => h / 2 - (db / DBR) * (h / 2 - 14);
    const curveF = new Float32Array(240).map((_, i) => FMIN * Math.pow(FMAX / FMIN, i / 239));
    const magTmp = new Float32Array(240), phTmp = new Float32Array(240);
    let spec = null;
    let eqDrag = -1, eqHover = -1;
    function drawEq() {
        const { g, w, h } = fitCanvas(eqCv);
        g.clearRect(0, 0, w, h);
        // сетка
        g.font = "9px Segoe UI"; g.textBaseline = "top";
        for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
            const x = Math.round(xOf(f, w)) + 0.5;
            g.fillStyle = "#1f2129"; g.fillRect(x, 0, 1, h);
        }
        for (const db of [-12, -6, 0, 6, 12]) {
            const y = Math.round(yOf(db, h)) + 0.5;
            g.fillStyle = db === 0 ? "#2c303a" : "#1d2028"; g.fillRect(0, y, w, 1);
            g.fillStyle = "#4a4f5c"; g.fillText((db > 0 ? "+" : "") + db, 3, y - 10);
        }
        // живой спектр
        if (A.an && P.on) {
            if (!spec || spec.length !== A.an.frequencyBinCount) spec = new Float32Array(A.an.frequencyBinCount);
            A.an.getFloatFrequencyData(spec);
            const sr = getCtx().sampleRate, n = spec.length;
            const grad = g.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, "rgba(255,159,67,.55)"); grad.addColorStop(0.6, "rgba(84,160,255,.35)"); grad.addColorStop(1, "rgba(84,160,255,.05)");
            g.fillStyle = grad;
            g.beginPath(); g.moveTo(0, h);
            for (let x = 0; x <= w; x += 2) {
                const f = fOf(x, w), i = clamp(Math.round(f / (sr / 2) * n), 1, n - 1);
                const db = Math.max(spec[i], spec[Math.max(1, i - 1)], spec[Math.min(n - 1, i + 1)]);
                const v = clamp((db + 100) / 80, 0, 1);
                g.lineTo(x, h - v * (h - 6));
            }
            g.lineTo(w, h); g.closePath(); g.fill();
        }
        // кривая эквалайзера
        const total = new Float32Array(curveF.length).fill(1);
        if (A.eq.length) {
            for (const b of A.eq) { b.getFrequencyResponse(curveF, magTmp, phTmp); for (let i = 0; i < total.length; i++) total[i] *= magTmp[i]; }
        }
        g.lineWidth = 2.5;
        g.strokeStyle = S.eq_on ? "#ffd166" : "#5a5f6b";
        g.setLineDash(S.eq_on ? [] : [5, 4]);
        g.beginPath();
        for (let i = 0; i < curveF.length; i++) {
            // без звукового движка — та же кривая приблизительно из положений точек
            const db = A.eq.length ? 20 * Math.log10(total[i] || 1e-6) : (S.eq_on ? approx(curveF[i]) : 0);
            const x = xOf(curveF[i], w), y = yOf(clamp(db, -DBR, DBR), h);
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke(); g.setLineDash([]);
        // точки полос
        EQF.forEach((f, i) => {
            const x = xOf(f, w), y = yOf(S.eq[i], h);
            const act = i === eqDrag || i === eqHover;
            g.fillStyle = S.eq[i] !== 0 ? "#ffd166" : "#8b90a0";
            if (!S.eq_on) g.fillStyle = "#5a5f6b";
            g.beginPath(); g.arc(x, y, act ? 7 : 5, 0, Math.PI * 2); g.fill();
            g.strokeStyle = "#121318"; g.lineWidth = 2; g.stroke();
            g.fillStyle = act ? "#fff" : "#8b90a0"; g.textAlign = "center"; g.textBaseline = "bottom";
            g.fillText(fLabel(f), x, h - 2);
            if (act || S.eq[i] !== 0) { g.textBaseline = "bottom"; g.fillStyle = act ? "#fff" : "#ffd166"; g.fillText((S.eq[i] > 0 ? "+" : "") + S.eq[i].toFixed(1), x, y - 8); }
            g.textAlign = "left";
        });
    }
    const approx = (f) => {
        let s = 0;
        EQF.forEach((bf, i) => { const d = Math.log2(f / bf); s += S.eq[i] * Math.exp(-(d * d) * 1.4); });
        return s;
    };
    function nearestBand(x, w) {
        let best = -1, bd = 1e9;
        EQF.forEach((f, i) => { const d = Math.abs(xOf(f, w) - x); if (d < bd) { bd = d; best = i; } });
        return bd < 28 ? best : -1;
    }
    function setBand(i, v) {
        S.eq[i] = Math.round(clamp(v, -12, 12) * 2) / 2;
        S.preset = "custom"; presetSel.value = "custom";
        applyEq(false); save(); drawEq();
        eqInfo.textContent = `${fLabel(EQF[i])} ${T("Гц", "Hz")}: ${(S.eq[i] > 0 ? "+" : "") + S.eq[i].toFixed(1)} dB`;
    }
    eqCv.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        const p = pt(e, eqCv);
        const i = nearestBand(p.x, eqCv.clientWidth);
        if (i < 0) return;
        eqCv.setPointerCapture(e.pointerId);
        eqDrag = i;
        if (!S.eq_on) { S.eq_on = true; applyEq(false); paintRows(); }
        setBand(i, ((eqCv.clientHeight / 2 - p.y) / (eqCv.clientHeight / 2 - 14)) * DBR);
    });
    eqCv.addEventListener("pointermove", (e) => {
        const p = pt(e, eqCv);
        if (eqDrag >= 0) { setBand(eqDrag, ((eqCv.clientHeight / 2 - p.y) / (eqCv.clientHeight / 2 - 14)) * DBR); return; }
        const i = nearestBand(p.x, eqCv.clientWidth);
        if (i !== eqHover) { eqHover = i; drawEq(); }
    });
    const eqUp = () => { eqDrag = -1; drawEq(); };
    eqCv.addEventListener("pointerup", eqUp);
    eqCv.addEventListener("pointercancel", eqUp);
    eqCv.addEventListener("pointerleave", () => { if (eqDrag < 0) { eqHover = -1; drawEq(); } });
    eqCv.addEventListener("dblclick", (e) => { const i = nearestBand(pt(e, eqCv).x, eqCv.clientWidth); if (i >= 0) setBand(i, 0); });
    eqCv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        const i = nearestBand(pt(e, eqCv).x, eqCv.clientWidth);
        if (i >= 0) setBand(i, S.eq[i] + (e.deltaY < 0 ? 0.5 : -0.5));
    }, { passive: false });
    eqOn.addEventListener("click", () => {
        S.eq_on = !S.eq_on; applyEq(false); save(); paintRows(); drawEq();
        setStatus(S.eq_on ? T("Эквалайзер включён", "EQ on") : T("Эквалайзер выключен — слышно, как было", "EQ off — you hear how it was"));
    });
    presetSel.addEventListener("change", () => {
        const p = PRESETS.find((x) => x[0] === presetSel.value);
        if (!p) return;
        S.preset = p[0]; S.eq = p[3].slice(); S.eq_on = true;
        applyEq(false); save(); paintRows(); drawEq();
        eqInfo.textContent = T(p[1], p[2]);
    });
    reset.addEventListener("click", () => { S.eq = EQF.map(() => 0); S.preset = "flat"; presetSel.value = "flat"; applyEq(false); save(); drawEq(); eqInfo.textContent = ""; });

    // ---------- верх ----------
    bypBtn.addEventListener("click", () => {
        S.bypass = !S.bypass; save(); paintRows();
        setStatus(S.bypass ? T("⏭ В Пульт идёт всё как было", "⏭ everything goes to the Pult as it was") : T("Пульт слышит Студию одним каналом", "the Pult hears the Studio as one channel"));
    });
    master.addEventListener("input", () => { S.master = parseFloat(master.value); applyMaster(); save(); });
    master.addEventListener("dblclick", () => { S.master = 1; master.value = "1"; applyMaster(); save(); });
    helpBtn.addEventListener("click", () => { help.style.display = help.style.display === "block" ? "none" : "block"; sizer.fit(); });

    // ---------- анимация: индикаторы, бегунки, спектр ----------
    function loop() {
        P.raf = null;
        if (disposed) return;
        const now = performance.now();
        let alive = P.on;
        const ctx = getCtx();
        for (const c of chans) {
            const r = rows.get(c.key);
            if (!r) continue;
            const ch = A.chains.get(c.key);
            meterStep(r.mL, P.on && ch ? peakOf(ch.tap.aL) : 0, now);
            meterStep(r.mR, P.on && ch ? peakOf(ch.tap.aR) : 0, now);
            drawMeter(r.meter, r.mL, r.mR, true);
            if (r.mL.v > 0.001 || r.mR.v > 0.001) alive = true;
            const b = bufs.get(c.specKey);
            if (P.on && !P.arr && b) { r.head.style.display = "block"; r.head.style.left = ((((ctx.currentTime - P.t0) % b.duration) + b.duration) % b.duration) / b.duration * 100 + "%"; }
            else r.head.style.display = "none";
        }
        if (A.mtap) {
            meterStep(A.mL, P.on ? peakOf(A.mtap.aL) : 0, now);
            meterStep(A.mR, P.on ? peakOf(A.mtap.aR) : 0, now);
            drawMeter(mm, A.mL, A.mR, false);
        }
        drawEq();
        if (P.on && P.arr) drawField();
        if (alive && !document.hidden) P.raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!P.raf) P.raf = requestAnimationFrame(loop); };
    const kickTimer = setInterval(() => { if (P.on) kick(); }, 300);

    // ---------- слежение за проводом ----------
    let sig = null;
    function poll() {
        if (disposed || document.hidden) return;
        const src = sourcesOf(upstreamNode());
        const keys = channelKeys(src.map((x) => x.name));
        const next = src.map((x, i) => ({ ...x, key: keys[i], specKey: JSON.stringify(x.spec) }));
        const s2 = next.map((c) => c.key + "|" + c.specKey).join("||");
        const bn = bpmNow();
        if (bn !== S.bpm) { S.bpm = bn; save(); drawField(); }
        if (s2 === sig) return;
        const namesChanged = next.map((c) => c.key).join("|") !== chans.map((c) => c.key).join("|");
        sig = s2;
        chans = next;
        for (const c of chans) chSet(c.key);
        if (namesChanged || rows.size !== chans.length) buildRows();
        else chans.forEach((c) => load(c).then((b) => { if (b) drawWave(c.key, b); }));
        sizer.fit();
        drawField();
        chans.forEach((c) => load(c).then(() => drawField()));
        if (P.on) start();
        setStatus(chans.length ? T(`Дорожек: ${chans.length}`, `Tracks: ${chans.length}`) : "");
    }
    const pollTimer = setInterval(poll, 800);

    // ---------- нода ----------
    const dom = node.addDOMWidget("neron_studio", "neron_studio", outer, { serialize: false, hideOnZoom: false });
    const helpH = () => (help.style.display === "block" ? help.offsetHeight + 6 : 0);
    const autoH = () => 34 + helpH() + Math.max(60, chans.length * (ROW_H + 4)) + 6 + 28 + FR + Math.max(1, chans.length) * LANE + 6 + 28 + EQ_H + 26;
    const sizer = makeUserSized(node, dom, outer, { minH: 300, autoH, margin: 4, onLayout: () => { drawEq(); drawField(); } });
    outer.style.overflow = "hidden";
    new ResizeObserver(() => { drawEq(); drawField(); }).observe(root);
    const wanted = node.computeSize ? node.computeSize() : [1100, 500];
    node.setSize([Math.max(wanted[0], 1100), Math.max(wanted[1], 200)]);

    fillPresets();
    audio();            // фильтры нужны сразу — по ним рисуется точная кривая эквалайзера
    paintRows();
    buildRows();
    drawEq();
    drawField();
    setTimeout(poll, 60);

    node.neronReload = () => {
        stop();
        S = normalize(parseJ(jw ? jw.value : "{}"));
        fillPresets();
        sig = null;
        applyEq(true); applyMaster();
        buildRows(); paintRows(); drawEq();
        poll();
    };
    node.neronDispose = () => {
        disposed = true;
        stop();
        clearInterval(pollTimer);
        clearInterval(kickTimer);
    };
}

app.registerExtension({
    name: "NeronAudio.StudioUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupStudio(this);
            return r;
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            if (this.neronReload) this.neronReload();
            return r;
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDispose) this.neronDispose();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
