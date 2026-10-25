import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createProjectBar, makeUserSized } from "./neron_common.js";

// ============================================================================
//  Neron Piano Roll - интерфейс в духе FL Studio
//  * несколько дорожек, у каждой свой инструмент, громкость, баланс, M и S
//  * инструменты: встроенные синтезаторы и сэмплы из папок кита
//    (Neron_Drums/<кит>/<папка>: клавесин, орган, гитара - любые папки)
//  * бит играет по кругу прямо в браузере, кнопка Queue для этого не нужна
//  * звук в браузере и в сохранённом файле делает один и тот же движок
// ============================================================================

const STEPS_PER_BAR = 16;
const MIN_BARS = 1;
const MAX_BARS = 16;
const DEFAULT_BARS = 2;
const MAX_TRACKS = 8;
const MIDI_LO = 24;   // C1
const MIDI_HI = 107;  // B7
const ROWS = MIDI_HI - MIDI_LO + 1;
const ROW_H = 16;
const KEYS_W = 52;
const RULER_H = 24;
const SCROLL_PAD = 16;
const PANEL_H = 676;
const BASE_NODE_H = 150;
const DEFAULT_BPM = 90;
const BPM_MIN = 40;
const BPM_MAX = 300;
const DEFAULT_VOL = 0.8;

const SYNTHS = [
    ["piano", "Piano"], ["epiano", "E-Piano"], ["bell", "Bell"], ["organ", "Organ"],
    ["pluck", "Pluck"], ["bass", "Bass"], ["lead", "Lead"], ["pad", "Pad"], ["sine", "Sine"],
];
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const SNAPS = [["1/32", 0.5], ["1/16", 1], ["1/8", 2], ["1/4", 4], ["1/2", 8], ["такт", 16]];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const noteName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

// Красивое имя для подписи (реальное имя папки не меняется)
function displayName(name) {
    const n = String(name).normalize("NFKC").trim();
    return n.split(/ {2,}/).map((w) => (/^\S( \S)+$/.test(w) ? w.replace(/ /g, "") : w)).join(" ");
}

// "Packs/808/Kicks" -> "Packs / 808 / Kicks"
function prettyPath(path) {
    return String(path).split("/").map(displayName).join(" / ");
}

// "organ_A3.wav" -> 57 (ищем название ноты в имени файла)
function parseRoot(fileName) {
    const m = /(?:^|[^A-Za-z])([A-Ga-g])([#b]?)(-?\d)(?!\d)/.exec(String(fileName));
    if (!m) return null;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
    let pc = base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    const midi = (parseInt(m[3], 10) + 1) * 12 + pc;
    return midi >= 0 && midi <= 127 ? midi : null;
}

function injectStyles() {
    if (document.getElementById("neron-piano-styles2")) return;
    const s = document.createElement("style");
    s.id = "neron-piano-styles2";
    s.textContent = `
.npr-root{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;gap:6px;padding:8px;
  background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;user-select:none;
  outline:none;overflow:hidden}
.npr-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;flex:none}
.npr-grp{display:flex;align-items:center;gap:5px}
.npr-lbl{font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.5px}
.npr-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;
  cursor:pointer;flex:none;line-height:24px;background:#4a4e5a}
.npr-btn:hover{filter:brightness(1.18)}
.npr-btn.sm{height:20px;padding:0 7px;line-height:20px;font-size:11px}
.npr-sel{height:22px;box-sizing:border-box;background:#262a32;color:#cfd2d8;border:1px solid #363a44;border-radius:4px;
  font-size:11px;outline:none;padding:0 2px;min-width:0}
.npr-sel option,.npr-sel optgroup{background:#262a32;color:#cfd2d8}
.npr-num{width:48px;height:22px;box-sizing:border-box;background:#262a32;color:#cfd2d8;border:1px solid #363a44;
  border-radius:4px;font-size:11px;text-align:center;outline:none}
.npr-range{height:14px;margin:0;padding:0;cursor:pointer;accent-color:var(--c,#ff9f43)}
.npr-status{flex:1;min-width:120px;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;text-align:right}
.npr-status.err{color:#ff8a80}
.npr-edit{font-size:10px;font-weight:700;white-space:nowrap}
.npr-main{display:flex;gap:8px;flex:1;min-height:0}
.npr-rack{width:278px;flex:none;display:flex;flex-direction:column;gap:6px;min-height:0}
.npr-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:3px}
.npr-card{flex:none;box-sizing:border-box;background:#252931;border:2px solid #252931;border-radius:7px;padding:5px 6px;
  display:flex;flex-direction:column;gap:4px;cursor:pointer}
.npr-card.sel{border-color:var(--c);background:#2a2f38}
.npr-r{display:flex;align-items:center;gap:5px;min-width:0}
.npr-dot{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
.npr-name{flex:1;min-width:0;height:20px;box-sizing:border-box;background:transparent;color:#e6e8ee;border:1px solid transparent;
  border-radius:4px;font-size:11px;font-weight:700;padding:0 4px;outline:none}
.npr-name:focus{border-color:#4a4f5c;background:#1f2228}
.npr-ms{width:22px;height:20px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:10px;
  font-weight:700;cursor:pointer;flex:none}
.npr-ms.on-m{background:#b3414a;color:#fff}
.npr-ms.on-s{background:#d9a72b;color:#1b1d23}
.npr-x{width:20px;height:20px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:12px;
  cursor:pointer;flex:none}
.npr-x:hover{background:#b3414a;color:#fff}
.npr-card .npr-sel{flex:1}
.npr-mini{display:flex;align-items:center;gap:4px;font-size:9px;color:#8b90a0;flex:1;min-width:0}
.npr-mini input{flex:1;min-width:0;width:100%}
.npr-gate{display:flex;align-items:center;gap:3px;font-size:10px;color:#9aa0ae;white-space:nowrap}
.npr-foot{flex:none;display:flex;flex-direction:column;gap:6px;border-top:1px solid #2c3039;padding-top:6px}
.npr-roll{position:relative;flex:1;min-width:0;background:#15171c;border-radius:6px;overflow:hidden}
.npr-corner{position:absolute;left:0;top:0;width:${KEYS_W}px;height:${RULER_H}px;background:#1d2027;z-index:5}
.npr-ruler{position:absolute;left:${KEYS_W}px;top:0;right:0;height:${RULER_H}px;overflow:hidden;background:#1d2027;z-index:4}
.npr-keys{position:absolute;left:0;top:${RULER_H}px;width:${KEYS_W}px;bottom:0;overflow:hidden;z-index:3;background:#15171c}
.npr-key{box-sizing:border-box;height:${ROW_H}px;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;
  font-size:9px;border-bottom:1px solid #15171c;cursor:pointer}
.npr-key.w{background:#d9dce3;color:#3a3d46}
.npr-key.b{background:#2b2d34;color:#8b90a0}
.npr-key:hover{filter:brightness(1.15)}
.npr-key.down{background:var(--c,#ff9f43);color:#1b1d23}
.npr-scroll{position:absolute;left:${KEYS_W}px;top:${RULER_H}px;right:0;bottom:0;overflow:auto}
.npr-scroll::-webkit-scrollbar{width:11px;height:11px}
.npr-scroll::-webkit-scrollbar-thumb{background:#3a3f4c;border-radius:6px}
.npr-scroll::-webkit-scrollbar-track{background:#1b1d23}
.npr-scroll::-webkit-scrollbar-corner{background:#1b1d23}
.npr-gridin{position:relative;cursor:crosshair}
.npr-gridin canvas{display:block}
.npr-layer{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none}
.npr-note{position:absolute;box-sizing:border-box;border-radius:3px;background:var(--c);border:1px solid rgba(255,255,255,.55);
  box-shadow:0 0 4px var(--c);cursor:grab;pointer-events:auto;overflow:hidden;font-size:9px;color:rgba(0,0,0,.65);
  font-weight:700;line-height:14px;padding-left:3px;white-space:nowrap}
.npr-note.ghost{opacity:.22;pointer-events:none;box-shadow:none;border-color:transparent}
.npr-rs{position:absolute;right:0;top:0;bottom:0;width:7px;cursor:ew-resize;background:rgba(0,0,0,.25)}
.npr-ph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;opacity:.85;pointer-events:none;display:none;z-index:9}
`;
    document.head.appendChild(s);
}

// ----------------------------------------------------------------------------
//  Звуковой движок (общий для всех нод пианино)
// ----------------------------------------------------------------------------

let sharedCtx = null;
const bufCache = new Map();   // ключ -> { promise, buf }
let activeFetches = 0;
const fetchWaiters = [];

// один звуковой движок на всю страницу (общий для всех нод Neron)
function getCtx() {
    if (!sharedCtx) {
        if (!window.__neronAudioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            window.__neronAudioCtx = new AC();
        }
        sharedCtx = window.__neronAudioCtx;
    }
    return sharedCtx;
}

async function limited(fn) {
    if (activeFetches >= 6) await new Promise((r) => fetchWaiters.push(r));
    activeFetches++;
    try {
        return await fn();
    } finally {
        activeFetches--;
        const w = fetchWaiters.shift();
        if (w) w();
    }
}

function noteKey(sp) {
    return [sp.kit, sp.inst, sp.sample, sp.root, sp.gate ? 1 : 0, sp.midi, sp.ms].join("|");
}

function loadNote(sp) {
    const key = noteKey(sp);
    const hit = bufCache.get(key);
    if (hit) return hit.promise;

    const entry = { buf: null, promise: null };
    entry.promise = limited(async () => {
        try {
            const q = new URLSearchParams({
                kit: sp.kit, inst: sp.inst, sample: sp.sample, root: String(sp.root),
                gate: sp.gate ? "1" : "0", midi: String(sp.midi), dur: String((sp.ms || 500) / 1000),
            });
            const res = await api.fetchApi("/neron/piano_note?" + q.toString(), { cache: "no-store" });
            if (!res.ok) throw new Error((await res.text()) || ("HTTP " + res.status));
            const data = await res.arrayBuffer();
            const buf = await getCtx().decodeAudioData(data);
            entry.buf = buf;
            return buf;
        } catch (e) {
            console.warn("[Neron] Не удалось получить звук ноты:", sp, e);
            bufCache.delete(key);
            return null;
        }
    });
    bufCache.set(key, entry);
    if (bufCache.size > 700) {
        let drop = bufCache.size - 560;
        for (const k of bufCache.keys()) {
            if (drop-- <= 0) break;
            bufCache.delete(k);
        }
    }
    return entry.promise;
}

function buildTrackChain(ctx, master) {
    // нота -> разделение на L/R -> баланс -> громкость -> общий выход
    const input = ctx.createGain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    input.channelInterpretation = "speakers";
    const split = ctx.createChannelSplitter(2);
    const gl = ctx.createGain();
    const gr = ctx.createGain();
    const merge = ctx.createChannelMerger(2);
    const vol = ctx.createGain();
    input.connect(split);
    split.connect(gl, 0);
    split.connect(gr, 1);
    gl.connect(merge, 0, 0);
    gr.connect(merge, 0, 1);
    merge.connect(vol);
    vol.connect(master);
    return { input, gl, gr, vol };
}

// ----------------------------------------------------------------------------
//  Интерфейс ноды
// ----------------------------------------------------------------------------

function setupPianoUI(node, host) {
    injectStyles();

    const getWidget = (name) => (node.widgets || []).find((x) => x.name === name);
    function hideWidget(w) {
        if (!w) return;
        w.type = "hidden";
        w.hidden = true;
        w.computeSize = () => [0, -4];
    }
    const projectWidget = getWidget("project_json");
    const bpmWidget = getWidget("bpm");
    hideWidget(projectWidget);
    hideWidget(bpmWidget);

    // ---------- состояние ----------

    const S = { bars: DEFAULT_BARS, master: 0.9, snap: 1, zoom: 28, selected: 0, auto: false, tracks: [] };
    let autoTimer = null;
    let nextId = 1;
    let lastLen = 1;
    let kitInfo = { ok: false, instruments: {}, searched: [] };
    let kitSig = "";
    let audio = null;
    const chains = new Map();
    const undoStack = [];
    let drag = null;
    let clearArmed = null;
    let pollTimer = null;
    let bpmTimer = null;
    let prefetchTimer = null;

    const play = { on: false, starting: false, token: 0, timer: null, raf: null, cursorStep: 0, cursorTime: 0, anchors: [], sources: new Set() };

    function currentKit() {
        const v = getWidget("kit_name")?.value;
        const s = (v === undefined || v === null) ? "" : String(v).trim();
        return s === "" ? "default" : s;
    }
    function getBpm() {
        const v = Number(bpmWidget?.value);
        return clamp(Number.isFinite(v) && v > 0 ? v : DEFAULT_BPM, BPM_MIN, BPM_MAX);
    }
    const stepDurNow = () => 60 / getBpm() / 4;
    const totalSteps = () => S.bars * STEPS_PER_BAR;
    const cur = () => S.tracks[S.selected] || null;

    function newTrack(i) {
        return {
            id: nextId++, name: "Track " + (i + 1), inst: "synth:piano", sample: "", root: 60, gate: false,
            vol: DEFAULT_VOL, pan: 0, mute: false, solo: false, color: COLORS[i % COLORS.length], notes: [],
        };
    }

    function cleanTrack(raw, i) {
        const t = newTrack(i);
        if (!raw || typeof raw !== "object") return t;
        if (typeof raw.name === "string") t.name = raw.name.slice(0, 40);
        if (typeof raw.inst === "string") t.inst = raw.inst;
        if (typeof raw.sample === "string") t.sample = raw.sample;
        if (typeof raw.root === "number") t.root = clamp(Math.round(raw.root), 0, 127);
        t.gate = !!raw.gate;
        if (typeof raw.vol === "number") t.vol = clamp(raw.vol, 0, 1.5);
        if (typeof raw.pan === "number") t.pan = clamp(raw.pan, -1, 1);
        t.mute = !!raw.mute;
        t.solo = !!raw.solo;
        if (typeof raw.color === "string") t.color = raw.color;
        if (Array.isArray(raw.notes)) {
            for (const n of raw.notes) {
                if (!n || typeof n !== "object") continue;
                const m = Math.round(Number(n.m)), s = Number(n.s), l = Number(n.l);
                if (Number.isFinite(m) && Number.isFinite(s) && Number.isFinite(l) && m >= 0 && m <= 127 && s >= 0 && l > 0) {
                    t.notes.push({ m, s, l });
                }
            }
        }
        return t;
    }

    function serialize() {
        return JSON.stringify({
            version: 1, bars: S.bars, master: S.master, snap: S.snap, zoom: S.zoom, selected: S.selected, auto: S.auto,
            tracks: S.tracks.map((t) => ({
                name: t.name, inst: t.inst, sample: t.sample, root: t.root, gate: t.gate, vol: t.vol, pan: t.pan,
                mute: t.mute, solo: t.solo, color: t.color, notes: t.notes,
            })),
        });
    }

    function loadState(value) {
        let o = null;
        try { o = JSON.parse(value); } catch (e) { /* пусто */ }
        if (!o || typeof o !== "object") o = {};
        S.bars = clamp(Math.round(Number(o.bars) || DEFAULT_BARS), MIN_BARS, MAX_BARS);
        S.master = typeof o.master === "number" ? clamp(o.master, 0, 1.5) : 0.9;
        S.snap = SNAPS.some((x) => x[1] === o.snap) ? o.snap : 1;
        S.zoom = typeof o.zoom === "number" ? clamp(o.zoom, 8, 56) : 28;
        S.auto = !!o.auto;
        S.tracks = Array.isArray(o.tracks) ? o.tracks.slice(0, MAX_TRACKS).map((t, i) => cleanTrack(t, i)) : [];
        if (!S.tracks.length) S.tracks.push(newTrack(0));
        S.selected = clamp(Math.round(Number(o.selected) || 0), 0, S.tracks.length - 1);
    }

    function saveState() {
        if (!projectWidget) return;
        projectWidget.value = serialize();
        if (typeof projectWidget.callback === "function") {
            try { projectWidget.callback(projectWidget.value); } catch (e) { /* не страшно */ }
        }
        if (S.auto) {
            if (autoTimer) clearTimeout(autoTimer);
            autoTimer = setTimeout(() => { renderToFile(true); }, 1500);
        }
    }

    function pushUndo(snap) {
        undoStack.push(snap || serialize());
        if (undoStack.length > 60) undoStack.shift();
    }

    // ---------- каркас ----------

    const root = el("div", "npr-root");
    root.tabIndex = 0;

    const top = el("div", "npr-top");
    root.appendChild(top);

    function mkBtn(text, color, title, cls) {
        const b = el("button", "npr-btn" + (cls ? " " + cls : ""), text);
        if (color) b.style.background = color;
        if (title) b.title = title;
        return b;
    }
    function mkGroup(label) {
        const g = el("div", "npr-grp");
        if (label) g.appendChild(el("span", "npr-lbl", label));
        top.appendChild(g);
        return g;
    }

    const gTransport = mkGroup();
    const playBtn = mkBtn("▶ PLAY", "#3fa34d", "Играть по кругу (пробел)");
    const stopBtn = mkBtn("■ STOP", "#b3414a", "Остановить");
    const undoBtn = mkBtn("↶", null, "Отменить (Ctrl+Z)");
    const saveBtn = mkBtn("SAVE WAV", "#3b6fb6", "Сохранить в файл (папка output/Neron_Loops)");
    const reloadBtn = mkBtn("⟳", null, "Заново прочитать папки с сэмплами");
    [playBtn, stopBtn, undoBtn, saveBtn, reloadBtn].forEach((b) => gTransport.appendChild(b));

    const gBpm = mkGroup("BPM");
    const bpmSlider = el("input", "npr-range");
    bpmSlider.type = "range"; bpmSlider.min = String(BPM_MIN); bpmSlider.max = String(BPM_MAX); bpmSlider.step = "1";
    bpmSlider.style.width = "110px";
    const bpmNum = el("input", "npr-num");
    bpmNum.type = "number"; bpmNum.min = String(BPM_MIN); bpmNum.max = String(BPM_MAX);
    gBpm.appendChild(bpmSlider);
    gBpm.appendChild(bpmNum);

    const gBars = mkGroup("ТАКТЫ");
    const barsMinus = mkBtn("−", null, "Убрать такт", "sm");
    const barsLabel = el("span", "npr-lbl");
    barsLabel.style.cssText = "min-width:18px;text-align:center;color:#e6e8ee;font-size:12px";
    const barsPlus = mkBtn("＋", null, "Добавить такт", "sm");
    const barsDouble = mkBtn("×2", "#6b4fb3", "Удвоить длину: все ноты копируются во вторую половину", "sm");
    [barsMinus, barsLabel, barsPlus, barsDouble].forEach((b) => gBars.appendChild(b));

    const gSnap = mkGroup("СЕТКА");
    const snapSel = el("select", "npr-sel");
    for (const [label, v] of SNAPS) {
        const o = el("option", "", label);
        o.value = String(v);
        snapSel.appendChild(o);
    }
    gSnap.appendChild(snapSel);

    const gZoom = mkGroup("ЗУМ");
    const zoomSlider = el("input", "npr-range");
    zoomSlider.type = "range"; zoomSlider.min = "8"; zoomSlider.max = "56"; zoomSlider.step = "1";
    zoomSlider.style.width = "80px";
    zoomSlider.title = "Масштаб по времени (Ctrl + колесо мыши)";
    gZoom.appendChild(zoomSlider);

    const clearBtn = mkBtn("ОЧИСТИТЬ", "#7a3b3b", "Стереть все ноты на выбранной дорожке (нажать дважды)", "sm");
    top.appendChild(clearBtn);

    const editLabel = el("span", "npr-edit");
    top.appendChild(editLabel);
    const status = el("div", "npr-status", "");
    top.appendChild(status);

    // проекты (сохранить / открыть) и автосохранение WAV для микшера
    const autoLabel = el("label", "nc-check");
    autoLabel.title = "Сам сохранять WAV через 1.5 сек после каждой правки - микшер всегда видит свежую версию";
    const autoChk = el("input");
    autoChk.type = "checkbox";
    autoLabel.appendChild(autoChk);
    autoLabel.appendChild(document.createTextNode("АВТО WAV"));
    const projBar = createProjectBar({
        kind: "piano",
        getData: () => ({ kit: currentKit(), bpm: getBpm(), project: JSON.parse(serialize()) }),
        setData: (d) => applyProject(d),
        onNew: () => newProject(),
        setStatus: (t, e) => setStatus(t, e),
        extra: autoLabel,
    });
    projBar.root.style.flex = "1 1 100%";
    top.appendChild(projBar.root);

    function setStatus(text, isError) {
        status.textContent = text;
        status.title = text;
        status.className = "npr-status" + (isError ? " err" : "");
    }

    const main = el("div", "npr-main");
    root.appendChild(main);

    // --- левая колонка: дорожки (микшер) ---
    const rack = el("div", "npr-rack");
    const list = el("div", "npr-list");
    const foot = el("div", "npr-foot");
    const addTrackBtn = mkBtn("＋ ДОРОЖКА", "#6b4fb3", "Добавить дорожку с другим инструментом");
    const masterRow = el("div", "npr-r");
    masterRow.appendChild(el("span", "npr-lbl", "MASTER"));
    const masterSlider = el("input", "npr-range");
    masterSlider.type = "range"; masterSlider.min = "0"; masterSlider.max = "1.2"; masterSlider.step = "0.01";
    masterSlider.style.flex = "1";
    masterSlider.title = "Общая громкость (двойной клик - сбросить)";
    masterRow.appendChild(masterSlider);
    foot.appendChild(addTrackBtn);
    foot.appendChild(masterRow);
    rack.appendChild(list);
    rack.appendChild(foot);
    main.appendChild(rack);

    // --- правая часть: пиано-ролл ---
    const roll = el("div", "npr-roll");
    main.appendChild(roll);
    const corner = el("div", "npr-corner");
    const ruler = el("div", "npr-ruler");
    const rulerIn = el("div");
    const rulerCanvas = el("canvas");
    rulerIn.appendChild(rulerCanvas);
    ruler.appendChild(rulerIn);
    const keys = el("div", "npr-keys");
    const keysIn = el("div");
    const scroller = el("div", "npr-scroll");
    const gridIn = el("div", "npr-gridin");
    const gridCanvas = el("canvas");
    const ghostLayer = el("div", "npr-layer");
    const noteLayer = el("div", "npr-layer");
    const playhead = el("div", "npr-ph");
    gridIn.appendChild(gridCanvas);
    gridIn.appendChild(ghostLayer);
    gridIn.appendChild(noteLayer);
    gridIn.appendChild(playhead);
    scroller.appendChild(gridIn);
    keys.appendChild(keysIn);
    roll.appendChild(scroller);
    roll.appendChild(ruler);
    roll.appendChild(keys);
    roll.appendChild(corner);

    // клавиши
    const keyEls = {};
    for (let m = MIDI_HI; m >= MIDI_LO; m--) {
        const k = el("div", "npr-key " + (isBlack(m) ? "b" : "w"), isBlack(m) ? "" : noteName(m));
        k.dataset.midi = String(m);
        keyEls[m] = k;
        keysIn.appendChild(k);
    }
    const keysPad = el("div");
    keysPad.style.height = SCROLL_PAD + "px";
    keysIn.appendChild(keysPad);

    // ---------- звук ----------

    function ensureAudio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!audio) {
            const master = ctx.createGain();
            master.gain.value = S.master;
            const lim = ctx.createDynamicsCompressor();
            lim.threshold.value = -3;
            lim.knee.value = 0;
            lim.ratio.value = 20;
            lim.attack.value = 0.002;
            lim.release.value = 0.12;
            master.connect(lim);
            lim.connect(ctx.destination);
            audio = { ctx, master };
        }
        return audio;
    }

    function anySolo() { return S.tracks.some((t) => t.solo); }
    function audible(t) { return !t.mute && (!anySolo() || t.solo); }

    function getChain(t) {
        const a = ensureAudio();
        let ch = chains.get(t.id);
        if (!ch) {
            ch = buildTrackChain(a.ctx, a.master);
            chains.set(t.id, ch);
            applyMix(t, true);
        }
        return ch;
    }

    function applyMix(t, immediate) {
        if (!audio) return;
        const ch = chains.get(t.id);
        if (!ch) return;
        const l = Math.min(1, 1 - t.pan), r = Math.min(1, 1 + t.pan);
        const v = audible(t) ? t.vol : 0;
        if (immediate) {
            ch.vol.gain.value = v; ch.gl.gain.value = l; ch.gr.gain.value = r;
        } else {
            const now = audio.ctx.currentTime;
            ch.vol.gain.setTargetAtTime(v, now, 0.01);
            ch.gl.gain.setTargetAtTime(l, now, 0.01);
            ch.gr.gain.setTargetAtTime(r, now, 0.01);
        }
    }
    function applyMixAll() { S.tracks.forEach((t) => applyMix(t, false)); }
    function applyMaster() {
        if (audio) audio.master.gain.setTargetAtTime(S.master, audio.ctx.currentTime, 0.01);
    }

    function specFor(t, note, stepDur) {
        const synth = t.inst.startsWith("synth:");
        const ms = Math.max(20, Math.round(note.l * stepDur * 1000));
        return {
            kit: currentKit(), inst: t.inst, sample: synth ? "" : t.sample, root: synth ? 60 : t.root,
            gate: synth ? false : t.gate, midi: note.m, ms: (synth || t.gate) ? ms : 0,
        };
    }

    function startBuffer(t, buf, when) {
        const a = ensureAudio();
        const src = a.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(getChain(t).input);
        src.onended = () => play.sources.delete(src);
        play.sources.add(src);
        src.start(Math.max(when, a.ctx.currentTime));
    }

    async function preview(t, midi, len) {
        if (!t) return;
        ensureAudio();
        const sp = specFor(t, { m: midi, l: len }, stepDurNow());
        const buf = await loadNote(sp);
        if (!buf) {
            setStatus(t.inst.startsWith("kit:") ? "Нет звука: проверьте папку и файл дорожки" : "Не удалось получить звук от сервера", true);
            return;
        }
        startBuffer(t, buf, 0);
    }

    function primeNote(t, note) {
        loadNote(specFor(t, note, stepDurNow()));
    }

    async function prefetchAll(silent) {
        const stepDur = stepDurNow();
        const specs = new Map();
        for (const t of S.tracks) {
            if (!audible(t)) continue;
            for (const n of t.notes) {
                const sp = specFor(t, n, stepDur);
                specs.set(noteKey(sp), sp);
            }
        }
        const total = specs.size;
        if (!total) return;
        let done = 0;
        if (!silent) setStatus(`Готовлю звук: 0/${total}`, false);
        await Promise.all([...specs.values()].map((sp) => loadNote(sp).then(() => {
            done++;
            if (!silent && (done % 4 === 0 || done === total)) setStatus(`Готовлю звук: ${done}/${total}`, false);
        })));
    }

    function schedulePrefetch() {
        if (prefetchTimer) clearTimeout(prefetchTimer);
        prefetchTimer = setTimeout(() => { if (play.on) prefetchAll(true); }, 400);
    }

    // ---------- проигрывание по кругу ----------

    function scheduleTick() {
        if (!play.on || !audio) return;
        const ctx = audio.ctx;
        const stepDur = stepDurNow();
        const loop = totalSteps();
        const horizon = ctx.currentTime + 0.2;
        if (play.cursorTime >= horizon) return;
        const from = play.cursorStep;
        const adv = (horizon - play.cursorTime) / stepDur;
        const to = from + adv;
        play.anchors.push({ time: play.cursorTime, step: from, stepDur });
        if (play.anchors.length > 200) play.anchors.splice(0, play.anchors.length - 200);

        const segs = to <= loop
            ? [[from, to, play.cursorTime]]
            : [[from, loop, play.cursorTime], [0, to - loop, play.cursorTime + (loop - from) * stepDur]];
        for (const [a, b, t0] of segs) {
            for (const t of S.tracks) {
                if (!audible(t)) continue;
                for (const n of t.notes) {
                    if (n.s >= a && n.s < b) {
                        const sp = specFor(t, n, stepDur);
                        const ent = bufCache.get(noteKey(sp));
                        if (ent && ent.buf) startBuffer(t, ent.buf, t0 + (n.s - a) * stepDur);
                        else loadNote(sp);
                    }
                }
            }
        }
        play.cursorTime = horizon;
        play.cursorStep = to >= loop ? to - loop : to;
    }

    function playheadStep() {
        if (!audio || !play.anchors.length) return null;
        const now = audio.ctx.currentTime;
        let a = null;
        for (let i = play.anchors.length - 1; i >= 0; i--) {
            if (play.anchors[i].time <= now) { a = play.anchors[i]; break; }
        }
        if (!a) return null;
        const loop = totalSteps();
        return (a.step + (now - a.time) / a.stepDur) % loop;
    }

    function drawLoop() {
        if (!play.on) return;
        const st = playheadStep();
        if (st !== null) {
            const x = st * S.zoom;
            playhead.style.display = "block";
            playhead.style.left = x + "px";
            if (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - 30) {
                scroller.scrollLeft = Math.max(0, x - 40);
            }
        }
        play.raf = requestAnimationFrame(drawLoop);
    }

    async function startPlayback() {
        if (play.on || play.starting) return;
        play.starting = true;
        const token = ++play.token;
        const a = ensureAudio();
        try {
            await prefetchAll(false);
        } finally {
            play.starting = false;
        }
        if (token !== play.token) return; // нажали STOP, пока готовился звук
        play.on = true;
        play.anchors = [];
        play.cursorStep = 0;
        play.cursorTime = a.ctx.currentTime + 0.08;
        play.timer = setInterval(scheduleTick, 25);
        play.raf = requestAnimationFrame(drawLoop);
        setStatus("Играет по кругу", false);
    }

    function stopPlayback() {
        play.token++;
        play.starting = false;
        play.on = false;
        if (play.timer) { clearInterval(play.timer); play.timer = null; }
        if (play.raf) { cancelAnimationFrame(play.raf); play.raf = null; }
        for (const s of play.sources) { try { s.stop(); } catch (e) { /* уже остановлен */ } }
        play.sources.clear();
        play.anchors = [];
        playhead.style.display = "none";
    }

    // ---------- рисование сетки ----------

    function redrawGrid() {
        const steps = totalSteps();
        const w = Math.round(steps * S.zoom), h = ROWS * ROW_H;
        gridCanvas.width = w; gridCanvas.height = h;
        gridCanvas.style.width = w + "px"; gridCanvas.style.height = h + "px";
        gridIn.style.width = w + "px"; gridIn.style.height = h + "px";
        const g = gridCanvas.getContext("2d");
        for (let r = 0; r < ROWS; r++) {
            const midi = MIDI_HI - r;
            g.fillStyle = isBlack(midi) ? "#1a1c21" : "#21242b";
            g.fillRect(0, r * ROW_H, w, ROW_H);
            g.fillStyle = midi % 12 === 0 ? "#363c49" : "#17191e";
            g.fillRect(0, r * ROW_H + ROW_H - 1, w, 1);
        }
        for (let b = 0; b < S.bars; b++) {
            if (b % 2 === 1) {
                g.fillStyle = "rgba(255,255,255,0.03)";
                g.fillRect(b * STEPS_PER_BAR * S.zoom, 0, STEPS_PER_BAR * S.zoom, h);
            }
        }
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(s * S.zoom);
            g.fillStyle = s % 16 === 0 ? "#5d6475" : s % 4 === 0 ? "#3b404d" : "#2a2d36";
            g.fillRect(x, 0, 1, h);
        }
        // линейка
        rulerCanvas.width = w + SCROLL_PAD; rulerCanvas.height = RULER_H;
        rulerCanvas.style.width = (w + SCROLL_PAD) + "px"; rulerCanvas.style.height = RULER_H + "px";
        rulerCanvas.style.display = "block";
        const r = rulerCanvas.getContext("2d");
        r.fillStyle = "#1d2027"; r.fillRect(0, 0, w + SCROLL_PAD, RULER_H);
        r.font = "bold 11px Segoe UI, Arial";
        r.textBaseline = "middle";
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(s * S.zoom);
            const bar = s % 16 === 0, beat = s % 4 === 0;
            r.fillStyle = bar ? "#8b90a0" : beat ? "#5a6070" : "#3a3f4b";
            r.fillRect(x, bar ? 0 : beat ? RULER_H - 10 : RULER_H - 5, 1, bar ? RULER_H : beat ? 10 : 5);
            if (bar && s < steps) {
                r.fillStyle = "#e6e8ee";
                r.fillText(String(s / 16 + 1), x + 5, RULER_H / 2);
            }
        }
        r.fillStyle = "#ff9f43"; r.fillRect(w - 2, 0, 2, RULER_H);
        redrawNotes();
    }

    function positionNote(d, note) {
        d.style.left = (note.s * S.zoom) + "px";
        d.style.top = ((MIDI_HI - note.m) * ROW_H) + "px";
        d.style.width = Math.max(4, note.l * S.zoom - 1) + "px";
        d.style.height = (ROW_H - 1) + "px";
        if (d._lbl) d._lbl.textContent = note.l * S.zoom >= 34 ? noteName(note.m) : "";
    }

    function makeNoteEl(note, color, ghost) {
        const d = el("div", "npr-note" + (ghost ? " ghost" : ""));
        d.style.setProperty("--c", color);
        if (!ghost) {
            d._note = note;
            d._lbl = el("span");
            d.appendChild(d._lbl);
            d.appendChild(el("div", "npr-rs"));
        }
        positionNote(d, note);
        return d;
    }

    function redrawNotes() {
        ghostLayer.innerHTML = "";
        noteLayer.innerHTML = "";
        S.tracks.forEach((t, i) => {
            if (i === S.selected) return;
            for (const n of t.notes) ghostLayer.appendChild(makeNoteEl(n, t.color, true));
        });
        const t = cur();
        if (t) for (const n of t.notes) noteLayer.appendChild(makeNoteEl(n, t.color, false));
    }

    // ---------- ввод мышью в пиано-ролле ----------

    function gridPoint(e) {
        const r = gridIn.getBoundingClientRect();
        const sc = gridIn.offsetWidth ? r.width / gridIn.offsetWidth : 1;
        return { x: (e.clientX - r.left) / sc, y: (e.clientY - r.top) / sc };
    }

    function resolveOverlaps(t, note, mode) {
        if (mode === "resize") {
            let next = null;
            for (const o of t.notes) {
                if (o !== note && o.m === note.m && o.s >= note.s + 1e-6 && (next === null || o.s < next)) next = o.s;
            }
            if (next !== null && note.s + note.l > next) note.l = Math.max(0.25, next - note.s);
        } else {
            t.notes = t.notes.filter((o) => o === note || o.m !== note.m || o.s >= note.s + note.l - 1e-6 || o.s + o.l <= note.s + 1e-6);
        }
    }

    gridIn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        root.focus({ preventScroll: true });
        const t = cur();
        if (!t) return;
        const p = gridPoint(e);
        const steps = totalSteps();
        const noteEl = e.target.closest ? e.target.closest(".npr-note") : null;

        if (noteEl && noteEl._note) {
            const note = noteEl._note;
            drag = {
                mode: e.target.classList.contains("npr-rs") ? "resize" : "move", note, el: noteEl,
                startX: p.x, startY: p.y, origS: note.s, origM: note.m, origL: note.l, moved: false, snap: serialize(),
            };
            gridIn.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }

        const snap = S.snap;
        const s = clamp(Math.floor(p.x / S.zoom / snap) * snap, 0, steps - snap);
        const midi = MIDI_HI - Math.floor(p.y / ROW_H);
        if (midi < MIDI_LO || midi > MIDI_HI) return;
        pushUndo();
        const len = Math.max(snap, Math.min(lastLen, steps - s));
        const note = { m: midi, s, l: len };
        t.notes.push(note);
        resolveOverlaps(t, note, "create");
        redrawNotes();
        const el2 = [...noteLayer.children].find((c) => c._note === note);
        drag = { mode: "create", note, el: el2, startX: p.x, startY: p.y, origS: s, origM: midi, origL: len, moved: false, snap: null };
        gridIn.setPointerCapture(e.pointerId);
        preview(t, midi, len);
        e.preventDefault();
    });

    gridIn.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const t = cur();
        const p = gridPoint(e);
        const steps = totalSteps();
        const snap = S.snap;
        const note = drag.note;
        const dxSteps = (p.x - drag.startX) / S.zoom;

        if (drag.mode === "move") {
            const ds = Math.round(dxSteps / snap) * snap;
            const dm = -Math.round((p.y - drag.startY) / ROW_H);
            const ns = clamp(drag.origS + ds, 0, Math.max(0, steps - note.l));
            const nm = clamp(drag.origM + dm, MIDI_LO, MIDI_HI);
            if (ns !== note.s || nm !== note.m) {
                if (!drag.moved && drag.snap) pushUndo(drag.snap);
                drag.moved = true;
                const pitchChanged = nm !== note.m;
                note.s = ns; note.m = nm;
                positionNote(drag.el, note);
                if (pitchChanged) preview(t, nm, note.l);
            }
        } else {
            // resize и create (протягивание после клика задаёт длину)
            if (drag.mode === "create" && !drag.moved && Math.abs(p.x - drag.startX) < 4) return;
            let nl;
            if (drag.mode === "create") nl = Math.round((p.x / S.zoom - note.s) / snap) * snap;
            else nl = Math.round((drag.origL + dxSteps) / snap) * snap;
            nl = clamp(Math.max(snap, nl), snap, steps - note.s);
            if (nl !== note.l) {
                if (drag.mode === "resize" && !drag.moved && drag.snap) pushUndo(drag.snap);
                drag.moved = true;
                note.l = nl;
                positionNote(drag.el, note);
            }
        }
    });

    function endDrag() {
        if (!drag) return;
        const t = cur();
        const d = drag;
        drag = null;
        if (t && (d.moved || d.mode === "create")) {
            resolveOverlaps(t, d.note, d.mode === "resize" ? "resize" : "move");
            lastLen = d.note.l;
            saveState();
            redrawNotes();
            primeNote(t, d.note);
            if (play.on) schedulePrefetch();
        }
    }
    gridIn.addEventListener("pointerup", endDrag);
    gridIn.addEventListener("pointercancel", endDrag);

    function deleteNoteAt(clientX, clientY) {
        // во время перетаскивания мышь "захвачена", поэтому ищем ноту под курсором вручную
        const hit = document.elementFromPoint(clientX, clientY);
        const nEl = hit && hit.closest ? hit.closest(".npr-note") : null;
        const t = cur();
        if (!nEl || !nEl._note || !t) return false;
        pushUndo();
        t.notes = t.notes.filter((n) => n !== nEl._note);
        saveState();
        redrawNotes();
        return true;
    }
    gridIn.addEventListener("dblclick", (e) => { deleteNoteAt(e.clientX, e.clientY); });
    gridIn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNoteAt(e.clientX, e.clientY);
    });

    // клавиши слева - послушать ноту
    let keyDown = null;
    keysIn.addEventListener("pointerdown", (e) => {
        const k = e.target.closest ? e.target.closest(".npr-key") : null;
        if (!k) return;
        const t = cur();
        const m = parseInt(k.dataset.midi, 10);
        if (keyDown) keyDown.classList.remove("down");
        keyDown = k;
        k.style.setProperty("--c", t ? t.color : "#ff9f43");
        k.classList.add("down");
        preview(t, m, 4);
    });
    window.addEventListener("pointerup", () => {
        if (keyDown) { keyDown.classList.remove("down"); keyDown = null; }
    });

    // прокрутка и зум
    scroller.addEventListener("scroll", () => {
        ruler.scrollLeft = scroller.scrollLeft;
        keys.scrollTop = scroller.scrollTop;
    });
    roll.addEventListener("wheel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey) {
            setZoom(S.zoom + (e.deltaY < 0 ? 3 : -3), true);
        } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            scroller.scrollLeft += e.deltaX || e.deltaY;
        } else {
            scroller.scrollTop += e.deltaY;
        }
    }, { passive: false });
    list.addEventListener("wheel", (e) => { e.stopPropagation(); }, { passive: true });

    function setZoom(z, keepCenter) {
        const nz = clamp(Math.round(z), 8, 56);
        if (nz === S.zoom) return;
        const centerStep = keepCenter ? (scroller.scrollLeft + scroller.clientWidth / 2) / S.zoom : 0;
        S.zoom = nz;
        zoomSlider.value = String(nz);
        redrawGrid();
        if (keepCenter) scroller.scrollLeft = Math.max(0, centerStep * nz - scroller.clientWidth / 2);
        saveState();
    }

    // ---------- панель дорожек ----------

    function fillInstSelect(sel, t) {
        sel.innerHTML = "";
        const g1 = el("optgroup");
        g1.label = "Синтезаторы";
        for (const [k, label] of SYNTHS) {
            const o = el("option", "", label);
            o.value = "synth:" + k;
            g1.appendChild(o);
        }
        sel.appendChild(g1);
        const folders = Object.keys(kitInfo.instruments || {}).filter((n) => (kitInfo.instruments[n] || []).length);
        if (folders.length) {
            const g2 = el("optgroup");
            g2.label = "Сэмплы из папок";
            for (const n of folders) {
                const o = el("option", "", prettyPath(n));
                o.value = "kit:" + n;
                g2.appendChild(o);
            }
            sel.appendChild(g2);
        }
        if (![...sel.querySelectorAll("option")].some((o) => o.value === t.inst)) {
            const o = el("option", "", prettyPath(t.inst.replace(/^kit:/, "")) + " (нет папки)");
            o.value = t.inst;
            sel.appendChild(o);
        }
        sel.value = t.inst;
    }

    function fixSampleOf(t) {
        if (!t.inst.startsWith("kit:")) return;
        const files = (kitInfo.instruments && kitInfo.instruments[t.inst.slice(4)]) || [];
        if (files.length && !files.includes(t.sample)) {
            t.sample = files[0];
            const r = parseRoot(t.sample);
            if (r !== null) t.root = r;
        }
    }

    function buildRack() {
        list.innerHTML = "";
        S.tracks.forEach((t, i) => {
            fixSampleOf(t);
            const card = el("div", "npr-card" + (i === S.selected ? " sel" : ""));
            card.style.setProperty("--c", t.color);
            card.addEventListener("pointerdown", () => { if (S.selected !== i) selectTrack(i); });

            const r1 = el("div", "npr-r");
            r1.appendChild(el("div", "npr-dot"));
            const name = el("input", "npr-name");
            name.value = t.name;
            name.addEventListener("change", () => { t.name = name.value.slice(0, 40) || ("Track " + (i + 1)); saveState(); updateEditLabel(); });
            name.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") name.blur(); });
            const mBtn = el("button", "npr-ms" + (t.mute ? " on-m" : ""), "M");
            mBtn.title = "Выключить звук дорожки (Mute)";
            const sBtn = el("button", "npr-ms" + (t.solo ? " on-s" : ""), "S");
            sBtn.title = "Играть только эту дорожку (Solo)";
            const xBtn = el("button", "npr-x", "✕");
            xBtn.title = "Удалить дорожку";
            r1.appendChild(name); r1.appendChild(mBtn); r1.appendChild(sBtn); r1.appendChild(xBtn);
            card.appendChild(r1);

            const r2 = el("div", "npr-r");
            const inst = el("select", "npr-sel");
            fillInstSelect(inst, t);
            r2.appendChild(inst);
            card.appendChild(r2);

            if (t.inst.startsWith("kit:")) {
                const files = (kitInfo.instruments && kitInfo.instruments[t.inst.slice(4)]) || [];
                const r3 = el("div", "npr-r");
                const smp = el("select", "npr-sel");
                smp.style.flex = "1";
                smp.title = "Какой файл из папки играет";
                if (!files.length) {
                    const o = el("option", "", "- нет файлов -"); o.value = ""; smp.appendChild(o); smp.disabled = true;
                } else {
                    for (const f of files) { const o = el("option", "", f); o.value = f; smp.appendChild(o); }
                    smp.value = files.includes(t.sample) ? t.sample : files[0];
                }
                const rootSel = el("select", "npr-sel");
                rootSel.style.width = "58px";
                rootSel.style.flex = "none";
                rootSel.title = "Какой нотой записан сэмпл (с неё он звучит без изменения высоты)";
                for (let m = 24; m <= 96; m++) { const o = el("option", "", noteName(m)); o.value = String(m); rootSel.appendChild(o); }
                rootSel.value = String(clamp(t.root, 24, 96));
                const gateLab = el("label", "npr-gate");
                const gate = el("input"); gate.type = "checkbox"; gate.checked = !!t.gate;
                gateLab.title = "Обрезать сэмпл по длине ноты. Выключено - сэмпл всегда звучит целиком";
                gateLab.appendChild(gate); gateLab.appendChild(document.createTextNode("по длине"));
                r3.appendChild(smp); r3.appendChild(rootSel); r3.appendChild(gateLab);
                card.appendChild(r3);

                smp.addEventListener("change", () => {
                    t.sample = smp.value;
                    const rr = parseRoot(t.sample);
                    if (rr !== null) { t.root = rr; rootSel.value = String(clamp(rr, 24, 96)); }
                    saveState();
                    preview(t, t.root, 8);
                });
                rootSel.addEventListener("change", () => { t.root = parseInt(rootSel.value, 10); saveState(); preview(t, t.root, 8); });
                gate.addEventListener("change", () => { t.gate = gate.checked; saveState(); });
            }

            const r4 = el("div", "npr-r");
            const volBox = el("div", "npr-mini");
            volBox.appendChild(el("span", "", "VOL"));
            const vol = el("input", "npr-range");
            vol.type = "range"; vol.min = "0"; vol.max = "1.2"; vol.step = "0.01"; vol.value = String(t.vol);
            vol.title = "Громкость дорожки (двойной клик - сбросить)";
            volBox.appendChild(vol);
            const panBox = el("div", "npr-mini");
            panBox.appendChild(el("span", "", "PAN"));
            const pan = el("input", "npr-range");
            pan.type = "range"; pan.min = "-1"; pan.max = "1"; pan.step = "0.05"; pan.value = String(t.pan);
            pan.title = "Баланс лево-право (двойной клик - в центр)";
            panBox.appendChild(pan);
            r4.appendChild(volBox); r4.appendChild(panBox);
            card.appendChild(r4);

            mBtn.addEventListener("click", (e) => { e.stopPropagation(); t.mute = !t.mute; mBtn.classList.toggle("on-m", t.mute); applyMixAll(); saveState(); });
            sBtn.addEventListener("click", (e) => { e.stopPropagation(); t.solo = !t.solo; sBtn.classList.toggle("on-s", t.solo); applyMixAll(); saveState(); });
            xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeTrack(i); });
            inst.addEventListener("change", () => {
                t.inst = inst.value;
                if (t.inst.startsWith("kit:")) { t.sample = ""; fixSampleOf(t); }
                saveState();
                buildRack();
                preview(t, t.inst.startsWith("kit:") ? t.root : 60, 8);
            });
            vol.addEventListener("input", () => { t.vol = parseFloat(vol.value); applyMix(t, false); saveState(); });
            vol.addEventListener("dblclick", () => { vol.value = String(DEFAULT_VOL); vol.dispatchEvent(new Event("input")); });
            pan.addEventListener("input", () => { t.pan = parseFloat(pan.value); applyMix(t, false); saveState(); });
            pan.addEventListener("dblclick", () => { pan.value = "0"; pan.dispatchEvent(new Event("input")); });

            list.appendChild(card);
        });
        addTrackBtn.style.display = S.tracks.length >= MAX_TRACKS ? "none" : "";
        updateEditLabel();
    }

    function updateEditLabel() {
        const t = cur();
        editLabel.textContent = t ? "● " + t.name : "";
        editLabel.style.color = t ? t.color : "#8b90a0";
    }

    function selectTrack(i) {
        S.selected = i;
        [...list.children].forEach((c, idx) => c.classList.toggle("sel", idx === i));
        updateEditLabel();
        redrawNotes();
        saveState();
    }

    function removeTrack(i) {
        if (S.tracks.length <= 1) {
            pushUndo();
            S.tracks[0].notes = [];
            saveState(); redrawNotes();
            setStatus("Это последняя дорожка - её ноты стёрты", false);
            return;
        }
        pushUndo();
        const t = S.tracks[i];
        const ch = chains.get(t.id);
        if (ch) { try { ch.vol.disconnect(); } catch (e) { /* ок */ } chains.delete(t.id); }
        S.tracks.splice(i, 1);
        S.selected = clamp(S.selected > i ? S.selected - 1 : S.selected, 0, S.tracks.length - 1);
        applyMixAll();
        saveState();
        buildRack();
        redrawNotes();
    }

    addTrackBtn.addEventListener("click", () => {
        if (S.tracks.length >= MAX_TRACKS) return;
        pushUndo();
        const used = new Set(S.tracks.map((t) => t.color));
        const t = newTrack(S.tracks.length);
        t.color = COLORS.find((c) => !used.has(c)) || t.color;
        S.tracks.push(t);
        S.selected = S.tracks.length - 1;
        saveState();
        buildRack();
        redrawNotes();
        list.scrollTop = list.scrollHeight;
    });

    // ---------- верхняя панель ----------

    function showBpm(v) {
        const n = Math.round(clamp(Number(v) || DEFAULT_BPM, BPM_MIN, BPM_MAX));
        bpmSlider.value = String(n);
        bpmNum.value = String(n);
        return n;
    }
    function setBpmFromUser(v) {
        const n = showBpm(v);
        if (bpmWidget) {
            bpmWidget.value = n;
            if (typeof bpmWidget.callback === "function") {
                try { bpmWidget.callback(n); } catch (e) { /* не страшно */ }
            }
        }
        if (play.on) schedulePrefetch();
    }
    bpmSlider.addEventListener("input", () => setBpmFromUser(bpmSlider.value));
    bpmNum.addEventListener("change", () => setBpmFromUser(bpmNum.value));
    bpmNum.addEventListener("keydown", (e) => e.stopPropagation());

    function showBars() { barsLabel.textContent = String(S.bars); }

    function setBars(n) {
        n = clamp(n, MIN_BARS, MAX_BARS);
        if (n === S.bars) return;
        pushUndo();
        S.bars = n;
        const steps = totalSteps();
        for (const t of S.tracks) {
            t.notes = t.notes.filter((x) => x.s < steps);
            for (const x of t.notes) if (x.s + x.l > steps) x.l = steps - x.s;
        }
        showBars();
        redrawGrid();
        saveState();
    }
    barsMinus.addEventListener("click", () => setBars(S.bars - 1));
    barsPlus.addEventListener("click", () => setBars(S.bars + 1));
    barsDouble.addEventListener("click", () => {
        const nb = Math.min(MAX_BARS, S.bars * 2);
        if (nb === S.bars) { setStatus(`Максимум ${MAX_BARS} тактов`, true); return; }
        pushUndo();
        const shift = S.bars * STEPS_PER_BAR;
        const copyBars = nb - S.bars;
        for (const t of S.tracks) {
            const add = [];
            for (const x of t.notes) {
                if (x.s < copyBars * STEPS_PER_BAR) add.push({ m: x.m, s: x.s + shift, l: x.l });
            }
            t.notes.push(...add);
        }
        S.bars = nb;
        showBars();
        redrawGrid();
        saveState();
        setStatus(`Теперь тактов: ${nb}`, false);
    });

    snapSel.addEventListener("change", () => { S.snap = parseFloat(snapSel.value); saveState(); });
    zoomSlider.addEventListener("input", () => setZoom(parseInt(zoomSlider.value, 10), true));

    masterSlider.addEventListener("input", () => { S.master = parseFloat(masterSlider.value); applyMaster(); saveState(); });
    masterSlider.addEventListener("dblclick", () => { masterSlider.value = "0.9"; masterSlider.dispatchEvent(new Event("input")); });

    clearBtn.addEventListener("click", () => {
        const t = cur();
        if (!t) return;
        if (!clearArmed) {
            clearBtn.textContent = "ТОЧНО?";
            clearArmed = setTimeout(() => { clearArmed = null; clearBtn.textContent = "ОЧИСТИТЬ"; }, 2000);
            return;
        }
        clearTimeout(clearArmed); clearArmed = null; clearBtn.textContent = "ОЧИСТИТЬ";
        pushUndo();
        t.notes = [];
        saveState();
        redrawNotes();
    });

    function undo() {
        const snap = undoStack.pop();
        if (!snap) { setStatus("Отменять больше нечего", false); return; }
        stopPlayback();
        loadState(snap);
        syncAll();
        saveState();
    }
    undoBtn.addEventListener("click", undo);

    playBtn.addEventListener("click", () => { startPlayback(); });
    stopBtn.addEventListener("click", () => { stopPlayback(); setStatus("Остановлено", false); });
    reloadBtn.addEventListener("click", () => { reloadKit(true); projBar.refresh(); });

    saveBtn.addEventListener("click", () => { renderToFile(false); });

    async function renderToFile(silent) {
        if (!silent) setStatus("Сохраняю...", false);
        try {
            const res = await api.fetchApi("/neron/piano_render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kit_name: currentKit(), bpm: getBpm(), project_json: serialize(),
                    save_name: getWidget("save_name")?.value || "neron_piano",
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setStatus((silent ? "Авто-сохранение " + new Date().toLocaleTimeString() + ": " : "Сохранено: ") + data.path, false);
            } else {
                setStatus("Ошибка: " + data.error, true);
            }
        } catch (e) {
            setStatus("Ошибка сохранения: " + e, true);
        }
    }

    autoChk.addEventListener("change", () => {
        S.auto = autoChk.checked;
        saveState();
        if (S.auto) setStatus("АВТО WAV включён: проект сам сохраняется в output/Neron_Loops", false);
    });

    function applyProject(d) {
        stopPlayback();
        pushUndo();
        const kitWidget2 = getWidget("kit_name");
        const newKit = d && typeof d.kit === "string" && d.kit.trim() ? d.kit.trim() : currentKit();
        const kitChanged = newKit !== currentKit();
        if (kitChanged && kitWidget2) kitWidget2.value = newKit;
        if (d && d.bpm) setBpmFromUser(d.bpm);
        loadState(JSON.stringify((d && d.project) || {}));
        syncAll();
        saveState();
        setTimeout(centerView, 50);
        if (kitChanged) reloadKit(false);
    }

    function newProject() {
        stopPlayback();
        pushUndo();
        const keepAuto = S.auto;
        loadState("{}");
        S.auto = keepAuto;
        syncAll();
        saveState();
        setTimeout(centerView, 50);
    }

    root.addEventListener("keydown", (e) => {
        const tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        if (e.code === "Space") {
            e.preventDefault(); e.stopPropagation();
            if (play.on || play.starting) { stopPlayback(); setStatus("Остановлено", false); } else startPlayback();
        } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
            e.preventDefault(); e.stopPropagation();
            undo();
        }
    });

    // ---------- папки с сэмплами ----------

    const kitWidget = getWidget("kit_name");
    if (kitWidget) {
        const orig = kitWidget.callback;
        kitWidget.callback = function () {
            const r = orig ? orig.apply(this, arguments) : undefined;
            reloadKit(false);
            return r;
        };
    }

    async function fetchKit() {
        try {
            const res = await api.fetchApi(`/neron/list_samples?kit=${encodeURIComponent(currentKit())}&t=${Date.now()}`);
            return await res.json();
        } catch (e) {
            return { ok: false, instruments: {}, searched: [] };
        }
    }

    function applyKit(info) {
        kitInfo = info;
        kitSig = JSON.stringify([info.ok, info.kit_dir, info.instruments]);
        buildRack();
        if (!info.ok) {
            setStatus(`Папка кита не найдена (${(info.searched && info.searched[0]) || "?"}). Синтезаторы работают, сэмплы - нет`, true);
            return;
        }
        const folders = Object.keys(info.instruments).filter((n) => info.instruments[n].length);
        setStatus(`Кит «${currentKit()}»: папок с сэмплами ${folders.length}`, false);
    }

    async function reloadKit(clearCache) {
        if (clearCache) bufCache.clear();
        setStatus("Читаю папки...", false);
        applyKit(await fetchKit());
    }

    async function pollKit() {
        if (document.hidden || drag) return;
        const info = await fetchKit();
        if (JSON.stringify([info.ok, info.kit_dir, info.instruments]) !== kitSig) applyKit(info);
    }

    // ---------- запуск ----------

    function syncAll() {
        showBpm(getBpm());
        showBars();
        snapSel.value = String(S.snap);
        zoomSlider.value = String(S.zoom);
        masterSlider.value = String(S.master);
        autoChk.checked = S.auto;
        buildRack();
        redrawGrid();
        applyMixAll();
        applyMaster();
    }

    function centerView() {
        const t = cur();
        let mid = 66;
        if (t && t.notes.length) mid = Math.round(t.notes.reduce((a, n) => a + n.m, 0) / t.notes.length);
        scroller.scrollTop = Math.max(0, (MIDI_HI - mid) * ROW_H - scroller.clientHeight / 2);
        scroller.scrollLeft = 0;
        keys.scrollTop = scroller.scrollTop;
    }

    loadState(projectWidget ? projectWidget.value : "");
    syncAll();

    let domWidget = null;
    if (host) {
        host.mount(root, () => PANEL_H);
    } else {
        domWidget = node.addDOMWidget("neron_piano", "neron_piano", root, {
            serialize: false,
            hideOnZoom: false,
        });
        // размер задаёт пользователь: сетка нот подстраивается и прокручивается
        makeUserSized(node, domWidget, root, { minH: 260, autoH: () => PANEL_H });
    
        const wanted = node.computeSize ? node.computeSize() : [1080, 400];
        node.setSize([Math.max(wanted[0], 1080), Math.max(wanted[1], BASE_NODE_H + PANEL_H)]);
    }
    setTimeout(centerView, 80);

    node.neronReload = () => {
        stopPlayback();
        loadState(projectWidget ? projectWidget.value : "");
        syncAll();
        setTimeout(centerView, 80);
        reloadKit(false);
    };
    node.neronDispose = () => {
        stopPlayback();
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (bpmTimer) { clearInterval(bpmTimer); bpmTimer = null; }
        if (prefetchTimer) { clearTimeout(prefetchTimer); prefetchTimer = null; }
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    };

    pollTimer = setInterval(pollKit, 5000);
    // BPM могли изменить снаружи (например, микшер синхронизирует темп) - обновить ползунок
    bpmTimer = setInterval(() => {
        if (bpmWidget && Number(bpmWidget.value) !== Number(bpmSlider.value)) {
            showBpm(bpmWidget.value);
            if (play.on) schedulePrefetch();
        }
    }, 500);
    reloadKit(false);
}

// ----------------------------------------------------------------------------
//  Регистрация расширения
// ----------------------------------------------------------------------------

app.registerExtension({
    name: "NeronAudio.PianoRollUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronPianoRoll") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupPianoUI(this);
            return r;
        };

        // после загрузки сохранённой схемы - восстановить ноты
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

export { setupPianoUI };
