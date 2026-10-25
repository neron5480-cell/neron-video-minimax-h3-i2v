import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createProjectBar, makeUserSized, peakOf, meterStep, drawMeter } from "./neron_common.js";

// ============================================================================
//  Neron Mixer
//  * Ноды (Neron Drum Machine, Neron Piano Roll) подключаются проводами к входам
//    audio_1, audio_2 ... Подключили один вход - сразу появляется следующий.
//  * Для каждого подключённого провода в микшере появляется канал: громкость,
//    баланс, M (выключить), S (только этот).
//  * Слушать можно прямо в браузере, кнопка Queue не нужна.
//  * BPM: темп общий. Поменяли BPM в любой ноде - микшер подхватит и подстроит
//    остальные (галочка СИНХР.). Выход bpm есть у каждой ноды.
//  * ВИДЕО: к входу video подключается любой загрузчик видео - в микшере
//    появляется плеер. Видео играет вместе с музыкой, чтобы сверять звук с
//    картинкой. "ПО ДЛИНЕ ВИДЕО" - музыка зацикливается ровно под длину ролика.
// ============================================================================

const MAX_CHANNELS = 8;
const MAX_REPEATS = 8;
const DEFAULT_VOL = 0.8;
const ROW_H = 48;
const BASE_NODE_H = 120;
const INPUT_H = 22;
const VIDEO_BOX_H = 230;
const panelHeightFor = (rows, videoOpen) => 178 + (ROW_H + 6) * Math.max(1, rows) + (videoOpen ? VIDEO_BOX_H : 0);
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const SLOT_RE = /^audio_(\d+)$/;
// audio_3/2 — 2-й звук кубика «Звук ×8», подключённого к audio_3
const SUB_RE = /^audio_(\d+)(?:\/(\d+))?$/;
const AUDIO_IN_TYPE = "AUDIO,NERON_SOUNDS";
const VCOLORS = ["#4dabf7", "#f783ac", "#69db7c"];
const VIDEO_SLOT = "video_audio";
const SLOT_OK = (k) => SUB_RE.test(k) || k === VIDEO_SLOT;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\s*\[\w+\])?$/i;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const T = (ru, en) => `${ru} / ${en}`;

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16) + ":" + s.length;
}

function injectStyles() {
    if (document.getElementById("neron-mixer-styles3")) return;
    const s = document.createElement("style");
    s.id = "neron-mixer-styles3";
    s.textContent = `
.nm-root{box-sizing:border-box;width:100%;padding:8px 10px;background:#1b1d23;border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.nm-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;flex:none;min-height:26px}
.nm-grp{display:flex;align-items:center;gap:5px}
.nm-lbl{font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.5px}
.nm-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;
  flex:none;line-height:24px;background:#4a4e5a}
.nm-btn:hover{filter:brightness(1.18)}
.nm-btn.sm{height:20px;padding:0 7px;line-height:20px}
.nm-status{flex:1;min-width:120px;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.nm-status.err{color:#ff8a80}
.nm-range{height:14px;margin:0;padding:0;cursor:pointer;accent-color:var(--c,#ff9f43)}
.nm-num{width:44px;height:20px;box-sizing:border-box;background:#23252b;color:#e6e8ee;border:1px solid #33363e;border-radius:4px;
  font-size:11px;text-align:center;outline:none;padding:0}
.nm-num:focus{border-color:#6b4fb3}
.nm-check{display:flex;align-items:center;gap:3px;font-size:10px;font-weight:700;color:#9aa0ae;white-space:nowrap;cursor:pointer}
.nm-sel{width:210px;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;
  font-size:11px;outline:none;padding:0 2px}
.nm-sel option{background:#23252b;color:#cfd2d8}
.nm-vrow{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;flex:none;min-height:24px}
.nm-vinfo{font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:80px}
.nm-vbox{flex:none;height:${VIDEO_BOX_H - 10}px;display:none;align-items:stretch;justify-content:center;gap:6px;position:relative}
.nm-tile{position:relative;flex:1;min-width:0;max-width:100%;background:#000;border-radius:6px;overflow:hidden;cursor:pointer;border:2px solid transparent;box-sizing:border-box}
.nm-tile.on{border-color:#ffd166}
.nm-tile video{width:100%;height:100%;object-fit:contain;display:block}
.nm-tile b{position:absolute;left:6px;top:4px;font-size:12px;text-shadow:0 1px 3px #000;pointer-events:none}
.nm-tile span{position:absolute;left:6px;bottom:4px;right:6px;font-size:9px;color:#cfd2d8;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.nm-vph{flex:1;display:none;align-items:center;justify-content:center;text-align:center;padding:10px;background:#0c0d10;border:2px dashed #3a3e49;
  border-radius:6px;color:#9aa0ae;font-size:12px;font-weight:700;line-height:1.6}
.nm-back{position:absolute;right:6px;top:6px;z-index:3;display:none}
.nm-sum{flex:none;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:11px;font-weight:700;color:#e6e8ee;
  background:#20232a;border-radius:6px;padding:5px 8px}
.nm-sum span{white-space:nowrap}
.nm-sum i{font-style:normal;color:#8b90a0;font-weight:400}
.nm-trow{display:flex;align-items:center;gap:8px;flex:none;height:22px}
.nm-trow input[type=range]{flex:1;min-width:80px;width:auto;height:16px;--c:#4dabf7}
.nm-trow .nm-lbl{min-width:112px;text-align:right;font-variant-numeric:tabular-nums}
.nm-list{display:flex;flex-direction:column;gap:6px;flex:none}
.nm-row{display:flex;align-items:center;gap:7px;height:${ROW_H}px;box-sizing:border-box;background:#242831;border-radius:7px;padding:0 8px;flex:none}
.nm-dot{width:10px;height:10px;border-radius:50%;background:var(--c);flex:none}
.nm-name{width:150px;flex:none;display:flex;flex-direction:column;justify-content:center;min-width:0}
.nm-name b{font-size:12px;color:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm-name span{font-size:9px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm-ms{width:22px;height:20px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:10px;font-weight:700;cursor:pointer;flex:none}
.nm-ms.on-m{background:#b3414a;color:#fff}
.nm-ms.on-s{background:#d9a72b;color:#1b1d23}
.nm-mini{display:flex;align-items:center;gap:4px;font-size:9px;color:#8b90a0;flex:none}
.nm-mini input{width:74px}
.nm-wave{position:relative;flex:1;min-width:120px;height:36px;background:#15171c;border-radius:4px;overflow:hidden}
.nm-wave canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.nm-wave .nm-note{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;
  font-size:10px;color:#8b90a0;text-align:center;padding:0 6px}
.nm-ph{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.85;display:none;pointer-events:none}
.nm-fx{display:flex;align-items:center;gap:2px;flex:none;padding:0 4px;border-left:1px solid #33363e;border-right:1px solid #33363e}
.nm-knob{display:flex;flex-direction:column;align-items:center;width:30px;flex:none;cursor:ns-resize}
.nm-knob canvas{width:26px;height:26px;display:block;touch-action:none}
.nm-knob span{font-size:8px;font-weight:700;color:#8b90a0;line-height:9px;letter-spacing:.3px;white-space:nowrap}
.nm-room{width:40px;height:20px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:9px;font-weight:700;cursor:pointer;flex:none}
.nm-room.on{background:#6b4fb3;color:#fff}
.nm-fxreset{width:16px;height:16px;padding:0;border:none;border-radius:3px;background:transparent;color:#6c7180;font-size:11px;cursor:pointer;flex:none;visibility:hidden}
.nm-fxreset:hover{color:#fff}
.nm-meter{width:14px;height:36px;flex:none;background:#101216;border-radius:3px}
.nm-mmeter{width:140px;height:16px;flex:none;background:#101216;border-radius:3px}
.nm-empty{padding:14px 10px;font-size:11px;color:#8b90a0;line-height:1.55;background:#20232a;border-radius:7px}
`;
    document.head.appendChild(s);
}

// один звуковой движок на всю страницу (общий с «Полем»): меньше нагрузки
function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}

function toStereo(ctx, buf) {
    const out = ctx.createBuffer(2, buf.length, buf.sampleRate);
    const left = buf.getChannelData(0);
    const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
    out.copyToChannel(left, 0);
    out.copyToChannel(right, 1);
    return out;
}

function buildTrackChain(ctx, master) {
    const input = ctx.createGain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    input.channelInterpretation = "speakers";
    const split = ctx.createChannelSplitter(2);
    const gl = ctx.createGain();
    const gr = ctx.createGain();
    const merge = ctx.createChannelMerger(2);
    const vol = ctx.createGain();
    // эквалайзер: низ / середина / верх (как в fx.py)
    const lo = ctx.createBiquadFilter(); lo.type = "lowshelf"; lo.frequency.value = 200; lo.gain.value = 0;
    const mi = ctx.createBiquadFilter(); mi.type = "peaking"; mi.frequency.value = 1000; mi.Q.value = 0.9; mi.gain.value = 0;
    const hi = ctx.createBiquadFilter(); hi.type = "highshelf"; hi.frequency.value = 4000; hi.gain.value = 0;
    // эхо: сухой звук + «помещение» (свёртка)
    const dry = ctx.createGain();
    const conv = ctx.createConvolver(); conv.normalize = false;
    const wet = ctx.createGain(); wet.gain.value = 0;
    const fxOut = ctx.createGain();
    input.connect(lo); lo.connect(mi); mi.connect(hi);
    hi.connect(dry); dry.connect(fxOut);
    hi.connect(conv); conv.connect(wet); wet.connect(fxOut);
    fxOut.connect(split);
    split.connect(gl, 0);
    split.connect(gr, 1);
    gl.connect(merge, 0, 0);
    gr.connect(merge, 0, 1);
    merge.connect(vol);
    vol.connect(master);
    // отвод на индикатор уровня: звук не меняет, только «подслушивает»
    const tap = ctx.createChannelSplitter(2);
    const aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
    aL.fftSize = 512; aR.fftSize = 512;
    vol.connect(tap);
    tap.connect(aL, 0);
    tap.connect(aR, 1);
    return { input, gl, gr, vol, aL, aR, lo, mi, hi, dry, conv, wet, room: null };
}

// ---------- эхо: отклик помещения (тот же шум, что в fx.py) ----------
const ROOMS = { room: [0.9, 0.008], hall: [2.2, 0.02], cathedral: [4.5, 0.035] };
const ROOM_ORDER = ["room", "hall", "cathedral"];
const ROOM_NAME = { room: ["КОМН", "ROOM"], hall: ["ЗАЛ", "HALL"], cathedral: ["СОБОР", "CHURCH"] };
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function roomImpulse(ctx, room) {
    window.__neronIR = window.__neronIR || {};
    const key = room + "@" + ctx.sampleRate;
    if (window.__neronIR[key]) return window.__neronIR[key];
    const [dur, preS] = ROOMS[room] || ROOMS.hall;
    const sr = ctx.sampleRate, n = Math.floor(dur * sr), pre = Math.floor(preS * sr);
    const buf = ctx.createBuffer(2, pre + n, sr);
    [1234, 5678].forEach((seed, ch) => {
        const rnd = mulberry32(seed + room.length);
        const d = buf.getChannelData(ch);
        let e2 = 0;
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-6.9 * t / dur) * Math.min(1, t / 0.004 + 0.05);
            const v = (rnd() * 2 - 1) * env;
            d[pre + i] = v; e2 += v * v;
        }
        const k = 1 / (Math.sqrt(e2) + 1e-9);
        for (let i = 0; i < d.length; i++) d[i] *= k;
    });
    window.__neronIR[key] = buf;
    return buf;
}

// ---------- ручка (крутилка) ----------
function makeKnob(o) {
    const box = el("div", "nm-knob");
    const cv = el("canvas");
    cv.width = 52; cv.height = 52;
    const lab = el("span", "", o.label);
    box.appendChild(cv); box.appendChild(lab);
    let v = o.value;
    const span = o.max - o.min;
    const draw = () => {
        const g = cv.getContext("2d");
        g.clearRect(0, 0, 52, 52);
        const cx = 26, cy = 26, r = 19;
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        const frac = (v - o.min) / span;
        const av = a0 + (a1 - a0) * frac;
        const az = o.bipolar ? a0 + (a1 - a0) * ((0 - o.min) / span) : a0;
        g.lineCap = "round";
        g.lineWidth = 5; g.strokeStyle = "#363a44";
        g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
        const active = Math.abs(v - o.def) > 1e-3;
        if (active) {
            g.strokeStyle = o.color;
            g.beginPath(); g.arc(cx, cy, r, Math.min(az, av), Math.max(az, av)); g.stroke();
        }
        g.fillStyle = active ? "#2b2f3a" : "#22252d";
        g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
        g.strokeStyle = active ? "#fff" : "#8b90a0"; g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(cx + Math.cos(av) * 4, cy + Math.sin(av) * 4); g.lineTo(cx + Math.cos(av) * 12, cy + Math.sin(av) * 12); g.stroke();
        box.title = o.title + "\n" + o.fmt(v) + "\n" + T("тянуть вверх/вниз или колесо · двойной клик — сброс", "drag up/down or wheel · double-click — reset");
        lab.style.color = active ? o.color : "";
    };
    const setV = (nv, fire) => {
        nv = Math.max(o.min, Math.min(o.max, nv));
        if (o.step) nv = Math.round(nv / o.step) * o.step;
        if (Math.abs(nv - o.def) < (o.step || 0.01) * 0.5) nv = o.def;   // притягивается к середине
        if (nv === v) return;
        v = nv; draw();
        if (fire) o.onChange(v);
    };
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        cv.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, v };
    });
    cv.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const k = e.shiftKey ? 600 : 150;
        setV(drag.v + (drag.y - e.clientY) * span / k, true);
    });
    const end = () => { if (drag) { drag = null; if (o.onEnd) o.onEnd(v); } };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("dblclick", (e) => { e.stopPropagation(); setV(o.def, true); if (o.onEnd) o.onEnd(v); });
    cv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        setV(v + (e.deltaY < 0 ? 1 : -1) * (o.wheel || span / 24), true);
        if (o.onEnd) o.onEnd(v);
    }, { passive: false });
    draw();
    box.setValue = (nv) => { v = nv; draw(); };
    return box;
}


function viewUrl(v) {
    const path = `/view?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}`;
    return typeof api.apiURL === "function" ? api.apiURL(path) : path;
}

const videoKey = (v) => (v ? `${v.type || "input"}|${v.subfolder || ""}|${v.name}` : "");

function parseVideoValue(raw) {
    if (typeof raw !== "string") return null;
    let s = raw.trim();
    if (!VIDEO_RE.test(s)) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    if (s.startsWith("/") || /^[A-Za-z]:/.test(s) || s.split("/").includes("..")) return null;
    const k = s.lastIndexOf("/");
    const name = k >= 0 ? s.slice(k + 1) : s;
    const subfolder = k >= 0 ? s.slice(0, k) : "";
    if (!name) return null;
    return { name, subfolder, type: ["input", "output", "temp"].includes(type) ? type : "input" };
}

// имя файла из поля загрузчика звука: "папка/файл.mp3 [input]"
function parseFileValue(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    if (s.startsWith("/") || /^[A-Za-z]:/.test(s) || s.split("/").includes("..")) return null;
    const k = s.lastIndexOf("/");
    const name = k >= 0 ? s.slice(k + 1) : s;
    if (!name) return null;
    return { name, subfolder: k >= 0 ? s.slice(0, k) : "", kind: ["input", "output", "temp"].includes(type) ? type : "input" };
}

function setupMixerUI(node) {
    injectStyles();

    const getWidget = (name) => (node.widgets || []).find((x) => x.name === name);
    function hideWidget(w) {
        if (!w) return;
        w.type = "hidden";
        w.hidden = true;
        w.computeSize = () => [0, -4];
    }
    const mixerWidget = getWidget("mixer_json");
    hideWidget(mixerWidget);

    // ---------- состояние ----------

    // S.ch["audio_1"] = { vol, pan, mute, solo, color }
    const S = { repeats: 1, master: 0.9, ch: {}, bpm: null, syncBpm: true, fit: false, video: null };
    let chs = [];
    let structSig = "";
    let audio = null;
    let videoDur = 0;
    let videoShown = false;
    let videoCur = "";            // ключ видео, загруженного в плеер
    let curVideos = [];           // ролики, которые сейчас используются (с провода или выбранный вручную), до 3
    let videoList = [];
    let panelH = panelHeightFor(0, false);
    let pollTimer = null;
    let syncing = false;
    const chains = new Map();
    const loaded = new Map();
    const play = { only: null, on: false, starting: false, token: 0, t0: 0, tReal: 0, T: 0, raf: null, items: [], D: 0, nextCycle: 0, timer: null, lastSeek: 0 };
    const ui = new Map();

    function settingFor(slot) {
        if (!S.ch[slot]) {
            const m = SUB_RE.exec(slot);
            const color = m ? COLORS[(parseInt(m[1], 10) - 1 + (m[2] ? parseInt(m[2], 10) - 1 : 0)) % COLORS.length] : "#c9ccd6";
            S.ch[slot] = { vol: DEFAULT_VOL, pan: 0, mute: false, solo: false, color, low: 0, mid: 0, high: 0, rev: 0, room: "hall" };
        }
        return S.ch[slot];
    }

    const fxOf = (st) => ({ low: st.low || 0, mid: st.mid || 0, high: st.high || 0, rev: st.rev || 0, room: st.room || "hall" });
    const fitActive = () => S.fit && videoDur > 0 && videoShown;

    function serialize() {
        return JSON.stringify({
            version: 3, repeats: S.repeats, master: S.master,
            bpm: Math.round(S.bpm == null ? 90 : S.bpm), bpm_set: S.bpm != null, sync_bpm: S.syncBpm,
            fit: S.fit, fit_sec: fitActive() ? Math.round(videoDur * 1000) / 1000 : 0,
            video: curVideos[0] || null, videos: curVideos, video_manual: S.video,
            tracks: Object.keys(S.ch).map((slot) => ({
                slot, vol: S.ch[slot].vol, pan: S.ch[slot].pan, mute: S.ch[slot].mute, solo: S.ch[slot].solo, ...fxOf(S.ch[slot]),
            })),
        });
    }

    function loadState(value) {
        let o = null;
        try { o = JSON.parse(value); } catch (e) { /* пусто */ }
        if (!o || typeof o !== "object") o = {};
        S.repeats = clamp(Math.round(Number(o.repeats) || 1), 1, MAX_REPEATS);
        S.master = typeof o.master === "number" ? clamp(o.master, 0, 1.5) : 0.9;
        S.bpm = o.bpm_set === true && typeof o.bpm === "number" ? clamp(o.bpm, 40, 300) : null;
        S.syncBpm = o.sync_bpm !== false;
        S.fit = o.fit === true;
        const v = o.video_manual;
        S.video = v && typeof v === "object" && typeof v.name === "string"
            ? { name: v.name, subfolder: String(v.subfolder || ""), type: String(v.type || "input") } : null;
        S.ch = {};
        if (Array.isArray(o.tracks)) {
            for (const t of o.tracks) {
                if (!t || typeof t.slot !== "string" || !SLOT_OK(t.slot)) continue;
                const s = settingFor(t.slot);
                if (typeof t.vol === "number") s.vol = clamp(t.vol, 0, 1.5);
                if (typeof t.pan === "number") s.pan = clamp(t.pan, -1, 1);
                s.mute = !!t.mute;
                s.solo = !!t.solo;
                for (const k of ["low", "mid", "high"]) if (typeof t[k] === "number") s[k] = clamp(t[k], -12, 12);
                if (typeof t.rev === "number") s.rev = clamp(t.rev, 0, 1);
                if (ROOMS[t.room]) s.room = t.room;
            }
        }
    }

    function saveState() {
        if (!mixerWidget) return;
        mixerWidget.value = serialize();
        if (typeof mixerWidget.callback === "function") {
            try { mixerWidget.callback(mixerWidget.value); } catch (e) { /* не страшно */ }
        }
    }

    // ---------- входы-провода ----------

    function audioSlots() {
        const out = [];
        (node.inputs || []).forEach((inp, i) => {
            const m = SLOT_RE.exec(inp.name || "");
            if (m) out.push({ inp, i, n: parseInt(m[1], 10) });
        });
        return out;
    }

    function syncInputs() {
        if (syncing) return;
        syncing = true;
        try {
            let slots = audioSlots();
            let lastConn = -1;
            slots.forEach((s, k) => { if (s.inp.link !== null && s.inp.link !== undefined) lastConn = k; });
            const want = clamp(lastConn + 2, 1, MAX_CHANNELS);
            for (let k = slots.length - 1; k >= want; k--) {
                const s = slots[k];
                if (s.inp.link === null || s.inp.link === undefined) node.removeInput(s.i);
            }
            slots = audioSlots();
            let maxN = Math.max(0, ...slots.map((s) => s.n));
            while (slots.length < want) {
                maxN += 1;
                node.addInput("audio_" + maxN, AUDIO_IN_TYPE);
                slots = audioSlots();
            }
            relayout();
        } finally {
            syncing = false;
        }
    }

    function getLink(id) {
        const g = node.graph;
        if (!g || !g.links) return null;
        return g.links instanceof Map ? g.links.get(id) : g.links[id];
    }

    function widgetValue(n, name) {
        const w = (n.widgets || []).find((x) => x.name === name);
        return w ? w.value : undefined;
    }

    function describe(o) {
        const cls = o.comfyClass || o.type;
        const title = o.title || cls;
        const kit = String(widgetValue(o, "kit_name") || "default").trim() || "default";
        const bpm = clamp(Number(widgetValue(o, "bpm")) || 90, 40, 300);
        if (cls === "NeronDrumMachine") {
            return { originId: o.id, node: o, kind: "drum", label: "DRUM MACHINE", sub: title, spec: { type: "drum", kit_name: kit, bpm, json: String(widgetValue(o, "pattern_json") || "{}") } };
        }
        if (cls === "NeronPianoRoll") {
            return { originId: o.id, node: o, kind: "piano", label: "PIANO ROLL", sub: title, spec: { type: "piano", kit_name: kit, bpm, json: String(widgetValue(o, "project_json") || "{}") } };
        }
        if (cls === "NeronMusic") {
            // модуль «Музыка»: барабаны и пианино — два отдельных канала
            return {
                originId: o.id, node: o, kind: "cube", multi: [
                    { originId: o.id + "/0", node: o, kind: "drum", label: "🥁 " + T("БАРАБАНЫ", "DRUMS"), sub: title,
                      spec: { type: "drum", kit_name: kit, bpm, json: String(widgetValue(o, "pattern_json") || "{}") } },
                    { originId: o.id + "/1", node: o, kind: "piano", label: "🎹 " + T("ПИАНИНО", "PIANO"), sub: title,
                      spec: { type: "piano", kit_name: kit, bpm, json: String(widgetValue(o, "project_json") || "{}") } },
                ],
            };
        }
        if (cls === "NeronAudioLoader" || cls === "LoadAudio") {
            const f = parseFileValue(widgetValue(o, cls === "LoadAudio" ? "audio" : "audio_file"));
            const start = Math.max(0, Number(widgetValue(o, "start_sec")) || 0);
            const end = Math.max(0, Number(widgetValue(o, "end_sec")) || 0);
            return {
                originId: o.id, node: o, kind: "file", label: cls === "LoadAudio" ? "LOAD AUDIO" : "AUDIO FILE",
                sub: f ? f.name : "файл не выбран",
                spec: f ? { type: "file", name: f.name, subfolder: f.subfolder, kind: f.kind, start, end } : null,
            };
        }
        if (cls === "NeronSampler" && typeof o.neronCube === "function") {
            const st = o.neronCube();
            if (st.bypass) {
                // ⏭ ПРОПУСТИТЬ: все звуки идут насквозь, каждый своим каналом
                return {
                    originId: o.id, node: o, kind: "cube", multi: st.items.map((f, k) => ({
                        originId: o.id + "/" + k, node: o, kind: "file", label: `🎵 ${k + 1}. ${f.name}`, sub: T("Сэмплер ⏭ пропущен", "Sampler ⏭ bypassed"),
                        spec: { type: "file", name: f.name, subfolder: f.subfolder || "", kind: f.type || "input", start: f.start || 0, end: f.end || 0 },
                    })),
                };
            }
            return { originId: o.id, node: o, kind: "sampler", label: "🎛 " + T("СЭМПЛЕР", "SAMPLER"), sub: title, spec: st.spec };
        }
        if (cls === "NeronSoundCube") {
            // кубик «Звук ×8»: каждый звук — свой канал
            const items = typeof o.neronCube === "function" ? o.neronCube().items : [];
            return {
                originId: o.id, node: o, kind: "cube", multi: items.map((f, k) => ({
                    originId: o.id + "/" + k, node: o, kind: "file", label: `🎵 ${k + 1}. ${f.name}`, sub: T("Звук ×8", "Sound ×8"),
                    spec: { type: "file", name: f.name, subfolder: f.subfolder || "", kind: f.type || "input", start: f.start || 0, end: f.end || 0 },
                })),
            };
        }
        if (cls === "NeronArrange") {
            // поле слышно заранее: сервер сводит его целиком (вместе с его входами)
            const inputs = typeof o.neronArrangeInputs === "function" ? o.neronArrangeInputs() : {};
            return { originId: o.id, node: o, kind: "arrange", label: "FIELD / ПОЛЕ", sub: title, spec: { type: "arrange", json: String(widgetValue(o, "field_json") || "{}"), inputs } };
        }
        return { originId: o.id, node: o, kind: "other", label: String(title).toUpperCase(), sub: cls, spec: null };
    }

    // идём по проводу назад, через Reroute, до настоящей ноды
    function resolveNode(linkId) {
        let id = linkId;
        for (let hop = 0; hop < 6; hop++) {
            const link = getLink(id);
            if (!link) return null;
            const o = node.graph.getNodeById(link.origin_id);
            if (!o) return null;
            if (o.type === "Reroute") {
                const i0 = o.inputs && o.inputs[0];
                if (i0 && i0.link !== null && i0.link !== undefined) { id = i0.link; continue; }
                return { empty: true, node: o };
            }
            return { node: o };
        }
        return null;
    }

    function resolveSource(linkId) {
        const r = resolveNode(linkId);
        if (!r) return null;
        if (r.empty) return { originId: r.node.id, node: r.node, kind: "other", label: "REROUTE", sub: "ничего не подключено", spec: null };
        return describe(r.node);
    }

    function readChannels() {
        const out = [];
        for (const s of audioSlots()) {
            if (s.inp.link === null || s.inp.link === undefined) continue;
            const src = resolveSource(s.inp.link);
            if (!src) continue;
            if (src.multi) {
                src.multi.forEach((m, k) => {
                    const specKey = m.spec ? hashString(JSON.stringify(m.spec)) : "";
                    out.push({ slot: `${s.inp.name}/${k + 1}`, n: s.n + (k + 1) / 100, ...m, specKey });
                });
                continue;
            }
            const specKey = src.spec ? hashString(JSON.stringify(src.spec)) : "";
            out.push({ slot: s.inp.name, n: s.n, ...src, specKey });
        }
        out.sort((a, b) => a.n - b.n);
        return out;
    }

    // видео, подключённое проводом: кубик «Видео ×3» (до 3 роликов) или обычный загрузчик видео
    function wiredVideos() {
        const inp = (node.inputs || []).find((x) => x.name === "video");
        if (!inp || inp.link === null || inp.link === undefined) return { wired: false, videos: [] };
        const r = resolveNode(inp.link);
        if (!r || r.empty) return { wired: true, videos: [] };
        if ((r.node.comfyClass || r.node.type) === "NeronVideoSampler" && typeof r.node.neronCube === "function") {
            const st = r.node.neronCube();
            return { wired: true, cube: true, videos: st.items.slice(0, 3), mute: !!st.mute, vsampler: true, note: st.note || "" };
        }
        if ((r.node.comfyClass || r.node.type) === "NeronVideoCube" && typeof r.node.neronCube === "function") {
            return { wired: true, cube: true, videos: r.node.neronCube().items.slice(0, 3) };
        }
        for (const w of r.node.widgets || []) {
            const v = parseVideoValue(w.value);
            if (v) return { wired: true, videos: [v] };
        }
        return { wired: true, videos: [] };
    }

    // BPM, подключённый проводом к входу bpm: берём число из ноды-источника
    function wiredBpm() {
        const inp = (node.inputs || []).find((x) => x.name === "bpm");
        if (!inp || inp.link === null || inp.link === undefined) return null;
        const r = resolveNode(inp.link);
        if (!r || r.empty) return null;
        const ws = r.node.widgets || [];
        const w = ws.find((x) => x.name === "bpm") || ws.find((x) => typeof x.value === "number" && x.type !== "toggle");
        const v = w ? Number(w.value) : NaN;
        return Number.isFinite(v) ? Math.round(clamp(v, 40, 300)) : null;
    }

    // ---------- каркас ----------

    const root = el("div", "nm-root");

    const projBar = createProjectBar({
        kind: "mixer",
        getData: () => ({ mixer: JSON.parse(serialize()) }),
        setData: (d) => {
            stopPlayback();
            pos.t = 0;
            loadState(JSON.stringify((d && d.mixer) || {}));
            saveState();
            syncAll();
        },
        onNew: () => {
            stopPlayback();
            pos.t = 0;
            loadState("{}");
            saveState();
            syncAll();
        },
        setStatus: (t, e) => setStatus(t, e),
    });
    root.appendChild(projBar.root);

    const top = el("div", "nm-top");
    root.appendChild(top);
    // сводка: что подключено и сколько (Пульт видит всех)
    const sumRow = el("div", "nm-sum");
    root.appendChild(sumRow);
    function showSummary() {
        const nV = curVideos.length;
        const audioCh = chs.filter((c) => !c.isVideo);
        const fmt = (t) => { const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`; };
        let len = videoDur > 0 ? videoDur : 0;
        if (!len) for (const c of audioCh) { const b = readyBuf(c.slot, c.specKey); if (b && b.duration > len) len = b.duration; }
        const parts = [
            `🎬 ${T("Видео", "Video")}: ${nV}${nV ? ` <i>(${nV > 1 ? T("подряд", "in a row") : T("ролик", "clip")})</i>` : ""}`,
            `🎵 ${T("Звук", "Sound")}: ${audioCh.length} <i>${T("каналов", "channels")}</i>`,
            `⏱ ${T("Длина", "Length")}: ${len > 0 ? fmt(len) : "—"}`,
        ];
        sumRow.innerHTML = parts.map((x) => `<span>${x}</span>`).join("");
    }
    function mkBtn(text, color, title, cls) {
        const b = el("button", "nm-btn" + (cls ? " " + cls : ""), text);
        if (color) b.style.background = color;
        if (title) b.title = title;
        return b;
    }
    const gT = el("div", "nm-grp");
    const playBtn = mkBtn("▶ PLAY", "#3fa34d", "Играть все подключённые ноды вместе по кругу (и видео, если оно есть)");
    const stopBtn = mkBtn("■ STOP", "#b3414a", "Остановить");
    const saveBtn = mkBtn("SAVE WAV", "#3b6fb6", "Свести в один файл (output/Neron_Loops)");
    const saveVidBtn = mkBtn("SAVE VIDEO", "#8e44ad", "Склеить подключённое видео со свёденным звуком в mp4 (output/Neron_Videos)");
    saveVidBtn.style.display = "none";
    [playBtn, stopBtn, saveBtn, saveVidBtn].forEach((b) => gT.appendChild(b));
    top.appendChild(gT);

    const gB = el("div", "nm-grp");
    gB.appendChild(el("span", "nm-lbl", "BPM"));
    const bpmSlider = el("input", "nm-range");
    bpmSlider.type = "range"; bpmSlider.min = "40"; bpmSlider.max = "300"; bpmSlider.step = "1";
    bpmSlider.style.width = "100px";
    bpmSlider.title = "Общий темп. При включённой СИНХР. меняет BPM у всех подключённых нод";
    const bpmNum = el("input", "nm-num");
    bpmNum.type = "text";
    bpmNum.title = "Общий темп (введите число и нажмите Enter)";
    const syncLbl = el("label", "nm-check");
    const syncCb = el("input");
    syncCb.type = "checkbox";
    syncLbl.appendChild(syncCb);
    syncLbl.appendChild(document.createTextNode("СИНХР."));
    syncLbl.title = "Одинаковый BPM у всех подключённых нод. Поменяли темп в любой ноде - остальные подстроятся сами";
    [bpmSlider, bpmNum, syncLbl].forEach((b) => gB.appendChild(b));
    top.appendChild(gB);

    const gR = el("div", "nm-grp");
    gR.appendChild(el("span", "nm-lbl", "ПОВТОРОВ"));
    const repMinus = mkBtn("−", null, "Меньше повторов", "sm");
    const repLabel = el("span", "nm-lbl");
    repLabel.style.cssText = "min-width:16px;text-align:center;color:#e6e8ee;font-size:12px";
    const repPlus = mkBtn("＋", null, "Больше повторов", "sm");
    [repMinus, repLabel, repPlus].forEach((b) => gR.appendChild(b));
    gR.title = "Сколько раз самый длинный луп повторится в сохранённом файле (при прослушивании играет бесконечно)";
    top.appendChild(gR);

    const gM = el("div", "nm-grp");
    gM.appendChild(el("span", "nm-lbl", "MASTER"));
    const masterSlider = el("input", "nm-range");
    masterSlider.type = "range"; masterSlider.min = "0"; masterSlider.max = "1.2"; masterSlider.step = "0.01";
    masterSlider.style.width = "100px";
    masterSlider.title = "Общая громкость (двойной клик - сбросить)";
    gM.appendChild(masterSlider);
    const mMeter = el("canvas", "nm-mmeter");
    mMeter.title = "Общий уровень: левый и правый канал. Красное - слишком громко / Master level: left and right. Red - too loud";
    gM.appendChild(mMeter);
    top.appendChild(gM);

    const status = el("div", "nm-status", "");
    top.appendChild(status);
    function setStatus(text, isError) {
        status.textContent = text;
        status.title = text;
        status.className = "nm-status" + (isError ? " err" : "");
    }

    // строка видео
    const vrow = el("div", "nm-vrow");
    vrow.appendChild(el("span", "nm-lbl", "ВИДЕО"));
    const vSel = el("select", "nm-sel");
    vSel.title = "Видео для сверки. Обычно берётся с провода (вход video), но можно выбрать файл вручную";
    vrow.appendChild(vSel);
    const vRefresh = mkBtn("⟳", null, "Обновить список видео", "sm");
    vrow.appendChild(vRefresh);
    const fitLbl = el("label", "nm-check");
    const fitCb = el("input");
    fitCb.type = "checkbox";
    fitLbl.appendChild(fitCb);
    fitLbl.appendChild(document.createTextNode("ПО ДЛИНЕ ВИДЕО"));
    fitLbl.title = "Музыка зациклится ровно под длину видео (и при прослушивании, и в SAVE WAV, и в выходе audio)";
    vrow.appendChild(fitLbl);
    const vInfo = el("div", "nm-vinfo", "");
    vrow.appendChild(vInfo);
    root.appendChild(vrow);

    const vbox = el("div", "nm-vbox");
    const backBtn = mkBtn("◀ " + T("ВСЕ РОЛИКИ", "ALL CLIPS"), "#4a4e5a", T("Снова показать все ролики рядом", "Show all clips side by side again"), "sm nm-back");
    vbox.appendChild(backBtn);
    // Видео-сэмплер включён, а монтаж ещё пуст или собирается — один блок с подсказкой
    const vph = el("div", "nm-vph");
    vbox.appendChild(vph);
    root.appendChild(vbox);

    // RU: До 3 роликов. Рядом — все сразу (играющий в жёлтой рамке); клик по ролику —
    //     он на весь экран и звук переходит к его началу; «ВСЕ РОЛИКИ» — снова рядом.
    //     В итоговом клипе ролики идут друг за другом: 1 -> 2 -> 3.
    // EN: Up to 3 clips side by side (the playing one has a yellow frame). Click a clip —
    //     it fills the screen and playback jumps to its start. In the saved clip they
    //     play one after another: 1 -> 2 -> 3.
    const VS = { tiles: [], focus: -1, lastSeek: 0 };
    function vsStarts() {
        const st = [];
        let a = 0;
        for (const t of VS.tiles) { st.push(a); a += t.dur || 0; }
        return st;
    }
    function vsBuild(list) {
        for (const t of VS.tiles) { try { t.v.pause(); t.v.removeAttribute("src"); t.v.load(); } catch (e) { /* ок */ } t.wrap.remove(); }
        VS.tiles = [];
        VS.focus = -1;
        list.forEach((ref, k) => {
            const wrap = el("div", "nm-tile");
            const v = document.createElement("video");
            v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = "auto"; v.controls = false;
            v.src = viewUrl(ref);
            const n = el("b", "", String(k + 1));
            n.style.color = VCOLORS[k % VCOLORS.length];
            const info = el("span", "", ref.label || ref.name);
            wrap.appendChild(v); wrap.appendChild(n); wrap.appendChild(info);
            wrap.title = list.length > 1 ? T("Клик — этот ролик на весь экран", "Click — this clip full screen") : ref.name;
            const t = { ref, v, wrap, info, dur: 0 };
            v.addEventListener("loadedmetadata", () => {
                const wasFit = fitActive();
                t.dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
                info.textContent = `${ref.label || ref.name} · ${t.dur.toFixed(2)} ${T("с", "s")}`;
                vsTotal();
                if (wasFit !== fitActive() || fitActive()) restartIfPlaying();
            });
            v.addEventListener("error", () => setStatus(T("Не удалось загрузить видео в плеер: ", "Cannot load the video: ") + ref.name, true));
            wrap.addEventListener("click", () => {
                if (VS.tiles.length < 2) return;
                VS.focus = k;
                seekTo(vsStarts()[k] + 0.001, true);
                vsLayout(k);
            });
            vbox.appendChild(wrap);
            VS.tiles.push(t);
        });
        vsLayout(0);
        vsTotal();
    }
    function vsTotal() {
        const all = VS.tiles.length && VS.tiles.every((t) => t.dur > 0);
        videoDur = all ? VS.tiles.reduce((a, t) => a + t.dur, 0) : 0;
        updateVideoInfo(effectiveVideo());
        saveState();
        showSummary();
    }
    function vsLayout(active) {
        VS.tiles.forEach((t, i) => {
            t.wrap.style.display = VS.focus < 0 || i === active ? "" : "none";
            t.wrap.classList.toggle("on", VS.tiles.length > 1 && i === active);
        });
        backBtn.style.display = VS.focus >= 0 && VS.tiles.length > 1 ? "block" : "none";
    }
    function vsAt(t) {
        const st = vsStarts();
        const tt = videoDur > 0 ? ((t % videoDur) + videoDur) % videoDur : 0;
        let k = 0;
        for (let i = 0; i < st.length; i++) if (tt >= st[i]) k = i;
        return { k, local: tt - (st[k] || 0) };
    }
    // играет: активный ролик идёт в такт звуку, остальные стоят
    function vsSync(t, playing) {
        if (!VS.tiles.length || !(videoDur > 0)) return;
        const { k, local } = vsAt(t);
        if (VS.focus >= 0) VS.focus = k;      // на весь экран — тот, что сейчас играет
        vsLayout(k);
        const nowMs = performance.now();
        VS.tiles.forEach((tl, i) => {
            const v = tl.v;
            if (i !== k) { if (!v.paused) { try { v.pause(); } catch (e) { /* ок */ } } return; }
            if (playing) {
                if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
                if (Math.abs(v.currentTime - local) > 0.12 && nowMs - VS.lastSeek > 400) {
                    VS.lastSeek = nowMs;
                    try { v.currentTime = local; } catch (e) { /* ок */ }
                }
            } else {
                if (!v.paused) { try { v.pause(); } catch (e) { /* ок */ } }
                try { v.currentTime = local; } catch (e) { /* ок */ }
            }
        });
    }
    function vsPause() { for (const t of VS.tiles) { try { t.v.pause(); } catch (e) { /* ок */ } } }
    backBtn.addEventListener("click", (e) => { e.stopPropagation(); VS.focus = -1; vsLayout(vsAt(play.on ? currentPos() : pos.t).k); });

    // перемотка: бегунок по времени (работает и на паузе, и во время игры)
    const trow = el("div", "nm-trow");
    const homeBtn = mkBtn("⏮", null, "В начало", "sm");
    const tSlider = el("input", "nm-range");
    tSlider.type = "range"; tSlider.min = "0"; tSlider.max = "1"; tSlider.step = "1"; tSlider.value = "0";
    tSlider.title = "Перемотка: потяните, чтобы выбрать момент (и звук, и видео)";
    const tLabel = el("span", "nm-lbl", "0:00.00 / 0:00.00");
    [homeBtn, tSlider, tLabel].forEach((x) => trow.appendChild(x));
    root.appendChild(trow);

    const list = el("div", "nm-list");
    root.appendChild(list);

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
            const tap = ctx.createChannelSplitter(2);
            const aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
            aL.fftSize = 512; aR.fftSize = 512;
            lim.connect(tap);
            tap.connect(aL, 0);
            tap.connect(aR, 1);
            audio = { ctx, master, aL, aR };
        }
        return audio;
    }

    const anySolo = () => chs.some((c) => settingFor(c.slot).solo);
    const audible = (slot) => {
        if (play.only) return slot === play.only;   // отдельное прослушивание: M и S не мешают
        const s = settingFor(slot);
        return !s.mute && (!anySolo() || s.solo);
    };

    function getChain(slot) {
        const a = ensureAudio();
        let ch = chains.get(slot);
        if (!ch) {
            ch = buildTrackChain(a.ctx, a.master);
            chains.set(slot, ch);
            applyMix(slot, true);
        }
        return ch;
    }

    function applyMix(slot, immediate) {
        if (!audio) return;
        const ch = chains.get(slot);
        if (!ch) return;
        const s = settingFor(slot);
        const l = Math.min(1, 1 - s.pan), r = Math.min(1, 1 + s.pan);
        const v = audible(slot) ? s.vol : 0;
        if (immediate) {
            ch.vol.gain.value = v; ch.gl.gain.value = l; ch.gr.gain.value = r;
        } else {
            const now = audio.ctx.currentTime;
            ch.vol.gain.setTargetAtTime(v, now, 0.01);
            ch.gl.gain.setTargetAtTime(l, now, 0.01);
            ch.gr.gain.setTargetAtTime(r, now, 0.01);
        }
        applyFx(slot, immediate);
    }

    function applyFx(slot, immediate) {
        if (!audio) return;
        const ch = chains.get(slot);
        if (!ch) return;
        const s = settingFor(slot);
        const set = (param, val) => {
            if (immediate) param.value = val;
            else param.setTargetAtTime(val, audio.ctx.currentTime, 0.02);
        };
        set(ch.lo.gain, s.low || 0);
        set(ch.mi.gain, s.mid || 0);
        set(ch.hi.gain, s.high || 0);
        const rev = s.rev || 0;
        if (rev > 0.005 && ch.room !== s.room) {
            ch.conv.buffer = roomImpulse(audio.ctx, s.room || "hall");
            ch.room = s.room;
        }
        set(ch.wet.gain, rev > 0.005 ? 0.9 * rev : 0);
        set(ch.dry.gain, 1 - 0.35 * rev);
    }
    const applyMixAll = () => chs.forEach((c) => applyMix(c.slot, false));

    // ---------- загрузка звука подключённых нод ----------

    async function loadChannel(c) {
        if (!c.spec && !c.isVideo) return;
        const key = c.specKey;
        const cur = loaded.get(c.slot);
        if (cur && cur.key === key) return;
        if (c.failedKey === key) return;
        try {
            const res = c.isVideo
                ? (c.vsrc.length > 1
                    ? await api.fetchApi("/neron/videos_audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videos: c.vsrc }), cache: "no-store" })
                    : await api.fetchApi(`/neron/video_audio?filename=${encodeURIComponent(c.vsrc[0].name)}&subfolder=${encodeURIComponent(c.vsrc[0].subfolder || "")}&type=${encodeURIComponent(c.vsrc[0].type || "input")}&t=${Date.now()}`))
                : await api.fetchApi("/neron/preview_wav", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(c.spec),
                    cache: "no-store",
                });
            if (!res.ok) throw new Error((await res.text()) || ("HTTP " + res.status));
            const data = await res.arrayBuffer();
            const ctx = getCtx();
            const buf = toStereo(ctx, await ctx.decodeAudioData(data));
            loaded.set(c.slot, { key, buf });
            c.error = "";
            c.failedKey = null;
            drawWave(c);
            showSummary();
        } catch (e) {
            c.error = String(e && e.message ? e.message : e);
            c.failedKey = key;
            console.warn("[Neron] Микшер: не удалось получить звук от", c.label, e);
            const u = ui.get(c.slot);
            if (c.isVideo) {
                if (u && u.note) { u.note.style.display = "flex"; u.note.textContent = c.error; }
                setStatus(`Звук видео: ${c.error}`, false);
            } else {
                setStatus(`${c.label}: ${c.error}`, true);
            }
        }
    }

    function readyBuf(slot, key) {
        const e = loaded.get(slot);
        return e && e.key === key ? e.buf : null;
    }

    // ---------- волна ----------

    function drawWave(c) {
        const u = ui.get(c.slot);
        if (!u) return;
        const cv = u.canvas;
        const W = 700, H = 72;
        cv.width = W; cv.height = H;
        const g = cv.getContext("2d");
        g.clearRect(0, 0, W, H);
        const buf = readyBuf(c.slot, c.specKey);
        const color = settingFor(c.slot).color;
        if (!buf) return;
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const per = Math.max(1, Math.floor(buf.length / W));
        g.fillStyle = color;
        g.globalAlpha = 0.9;
        for (let x = 0; x < W; x++) {
            let peak = 0;
            const a = x * per, b = Math.min(buf.length, a + per);
            for (let i = a; i < b; i += 4) {
                const v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
                if (v > peak) peak = v;
            }
            const h = Math.max(1, peak * H * 0.95);
            g.fillRect(x, (H - h) / 2, 1, h);
        }
        if (u.note) u.note.style.display = "none";
    }

    // ---------- проигрывание по кругу ----------

    const pos = { t: 0 };          // выбранная позиция (секунды): с неё начнётся проигрывание
    const scrub = { active: false, timer: null };
    const fmtT = (t) => {
        t = Math.max(0, t || 0);
        const m = Math.floor(t / 60);
        return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
    };

    // общая длина шкалы времени: под видео, либо самый длинный звук/видео
    function timelineLen() {
        if (fitActive()) return videoDur;
        let T = videoShown && videoDur > 0 ? videoDur : 0;
        for (const c of chs) {
            const b = readyBuf(c.slot, c.specKey);
            if (b && b.duration > T) T = b.duration;
        }
        return T;
    }

    function currentPos() {
        if (play.on && audio) {
            const now = audio.ctx.currentTime - play.t0;
            const T = play.D || play.T || 0;
            return T > 0 ? Math.max(0, now) % T : Math.max(0, now);
        }
        return pos.t;
    }

    function showPos(t) {
        const T = timelineLen();
        tSlider.disabled = !(T > 0);
        tSlider.max = String(Math.max(1, Math.round(T * 100)));
        if (!scrub.active) tSlider.value = String(Math.round(Math.min(t, T) * 100));
        tLabel.textContent = `${fmtT(Math.min(t, T || t))} / ${fmtT(T)}`;
        if (!play.on) showHeads(t);
    }

    // палочки на дорожках: показывают, где сейчас находится каждый трек (и на паузе тоже)
    function showHeads(t) {
        const D = fitActive() ? videoDur : 0;
        const inCycle = D ? t % D : t;
        for (const c of chs) {
            const u = ui.get(c.slot);
            const b = readyBuf(c.slot, c.specKey);
            if (!u) continue;
            if (!b) { u.ph.style.display = "none"; continue; }
            u.ph.style.display = "block";
            u.ph.style.left = (((inCycle % b.duration) / b.duration) * 100) + "%";
        }
    }

    function stopSources() {
        for (const it of play.items) { try { it.src.stop(); } catch (e) { /* уже остановлен */ } }
        play.items = [];
    }

    // в режиме "по длине видео" звук играется циклами ровно по D секунд
    function scheduleCycle(k) {
        const a = audio;
        const start = play.t0 + k * play.D;
        const when = Math.max(start, play.tReal);
        const inCycle = when - start;
        for (const c of chs) {
            const buf = readyBuf(c.slot, c.specKey);
            if (!buf || (play.only && c.slot !== play.only)) continue;
            const src = a.ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            src.connect(getChain(c.slot).input);
            src.start(when, inCycle % buf.duration);
            src.stop(start + play.D);
            play.items.push({ src, slot: c.slot, dur: buf.duration, end: start + play.D });
        }
    }

    function fitPump() {
        if (!play.on || !audio || !play.D) return;
        const now = audio.ctx.currentTime;
        while (play.t0 + play.nextCycle * play.D < now + 0.5) scheduleCycle(play.nextCycle++);
        play.items = play.items.filter((it) => !(it.end !== undefined && it.end < now - 0.3));
    }

    // запустить звук и видео с позиции offset (секунды); буферы уже загружены
    function launch(offset) {
        const a = ensureAudio();
        const playable = chs.filter((c) => readyBuf(c.slot, c.specKey) && (!play.only || c.slot === play.only));
        const t0 = a.ctx.currentTime + 0.06;
        for (const c of chs) {
            const u = ui.get(c.slot);
            if (u && !playable.includes(c)) u.ph.style.display = "none";
        }
        play.D = fitActive() ? videoDur : 0;
        play.T = timelineLen();
        if (play.D) offset = offset % play.D;
        else if (play.T > 0) offset = offset % play.T;
        play.tReal = t0;
        play.t0 = t0 - offset;
        play.nextCycle = 0;
        for (const c of playable) applyMix(c.slot, true);
        if (play.D) {
            play.on = true;
            fitPump();
            play.timer = setInterval(fitPump, 100);
        } else {
            for (const c of playable) {
                const buf = readyBuf(c.slot, c.specKey);
                const src = a.ctx.createBufferSource();
                src.buffer = buf;
                src.loop = true;
                src.connect(getChain(c.slot).input);
                src.start(t0, offset % buf.duration);
                play.items.push({ src, slot: c.slot, dur: buf.duration });
            }
            play.on = true;
        }
        if (videoShown && videoDur > 0) vsSync(offset, true);
        if (!play.raf) play.raf = requestAnimationFrame(drawLoop);
        startMeters();
        const only = play.only ? chs.find((c) => c.slot === play.only) : null;
        setStatus(only ? `Играет только: ${only.label}` : (play.D ? `Играет под видео (${videoDur.toFixed(2)} с)` : "Играет по кругу"), false);
        refreshRowButtons();
    }

    async function startPlayback() {
        if (play.on || play.starting) return;
        play.starting = true;
        const token = ++play.token;
        ensureAudio();
        try {
            await Promise.all(chs.map((c) => loadChannel(c)));
        } finally {
            play.starting = false;
        }
        if (token !== play.token) return;
        if (!chs.some((c) => readyBuf(c.slot, c.specKey) && (!play.only || c.slot === play.only))) {
            setStatus(chs.length ? "Нечего играть: подключённые ноды не поддерживают предпрослушивание" : "Сначала подключите провод от ноды Drum Machine или Piano Roll", true);
            return;
        }
        launch(pos.t);
    }

    // остановка запоминает позицию: PLAY продолжит с того же места
    function stopPlayback() {
        if (play.on) pos.t = currentPos();
        play.token++;
        play.starting = false;
        play.on = false;
        if (play.raf) { cancelAnimationFrame(play.raf); play.raf = null; }
        if (play.timer) { clearInterval(play.timer); play.timer = null; }
        stopSources();
        vsPause();
        showPos(pos.t);
        refreshRowButtons();
        startMeters();          // столбики плавно опустятся и цикл остановится
    }

    function restartIfPlaying() {
        if (play.on || play.starting) {
            stopPlayback();
            startPlayback();
        }
    }

    function refreshRowButtons() {
        for (const [slot, u] of ui.entries()) {
            if (!u.rowPlay) continue;
            const act = play.on && (play.only ? play.only === slot : false);
            u.rowPlay.style.background = act ? "#2e8b3d" : "#3a4a3d";
            u.rowPlay.style.color = act ? "#fff" : "#9ad8a4";
        }
    }

    // перемотка: на любую секунду, и когда играет, и когда стоит
    function seekTo(t, immediate) {
        const T = timelineLen();
        pos.t = Math.max(0, Math.min(T > 0 ? T - 0.001 : 0, t));
        showPos(pos.t);
        if (videoShown && videoDur > 0) vsSync(pos.t, false);
        if (play.on) {
            const go = () => {
                scrub.timer = null;
                if (!play.on) return;
                stopSources();
                if (play.timer) { clearInterval(play.timer); play.timer = null; }
                play.on = false;
                launch(pos.t);
            };
            if (immediate) go();
            else if (!scrub.timer) scrub.timer = setTimeout(go, 120);
        }
    }

    function syncVideoToAudio(t) {
        if (!videoShown || !(videoDur > 0)) return;
        vsSync(t, true);
    }

    const mm = { L: {}, R: {}, raf: null };
    function meterLoop() {
        mm.raf = null;
        if (!audio) return;
        const now = performance.now();
        let alive = play.on;
        for (const [slot, u] of ui.entries()) {
            if (!u.meter) continue;
            const ch = chains.get(slot);
            meterStep(u.mL, play.on && ch ? peakOf(ch.aL) : 0, now);
            meterStep(u.mR, play.on && ch ? peakOf(ch.aR) : 0, now);
            drawMeter(u.meter, u.mL, u.mR, true);
            if (u.mL.v > 0.001 || u.mR.v > 0.001 || u.mL.hold > 0.02) alive = true;
        }
        meterStep(mm.L, play.on ? peakOf(audio.aL) : 0, now);
        meterStep(mm.R, play.on ? peakOf(audio.aR) : 0, now);
        drawMeter(mMeter, mm.L, mm.R, false);
        if (mm.L.v > 0.001 || mm.R.v > 0.001 || mm.L.hold > 0.02) alive = true;
        if (alive && !document.hidden) mm.raf = requestAnimationFrame(meterLoop);
    }
    const startMeters = () => { if (!mm.raf) mm.raf = requestAnimationFrame(meterLoop); };

    function drawLoop() {
        if (!play.on || !audio) { play.raf = null; return; }
        const now = audio.ctx.currentTime - play.t0;
        if (now >= 0) {
            const inCycle = play.D ? now % play.D : now;
            for (const it of play.items) {
                const u = ui.get(it.slot);
                if (!u) continue;
                u.ph.style.display = "block";
                u.ph.style.left = (((inCycle % it.dur) / it.dur) * 100) + "%";
            }
            syncVideoToAudio(now);
            showPos(currentPos());
        }
        play.raf = requestAnimationFrame(drawLoop);
    }

    // ---------- видео ----------

    function effectiveVideo() {
        const w = wiredVideos();
        const videos = S.video ? [S.video] : w.videos;
        return { videos, video: videos[0] || null, wired: w.wired, cube: !!w.cube, fromWire: !S.video && w.videos.length > 0, mute: !S.video && !!w.mute, note: !S.video ? w.note || "" : "" };
    }

    function fillVideoSelect() {
        const want = S.video ? videoKey(S.video) : "";
        vSel.innerHTML = "";
        const first = el("option", "", "— авто (по проводу video) —");
        first.value = "";
        vSel.appendChild(first);
        const items = videoList.slice();
        if (S.video && !items.some((v) => videoKey(v) === want)) items.unshift(S.video);
        for (const v of items) {
            const label = `[${v.type === "output" ? "out" : "in"}] ${v.subfolder ? v.subfolder + "/" : ""}${v.name}`;
            const o = el("option", "", label);
            o.value = videoKey(v);
            vSel.appendChild(o);
        }
        vSel.value = want;
    }

    async function refreshVideoList() {
        try {
            const res = await api.fetchApi(`/neron/list_videos?t=${Date.now()}`);
            const d = await res.json();
            videoList = d.ok && Array.isArray(d.videos) ? d.videos : [];
        } catch (e) {
            videoList = [];
        }
        fillVideoSelect();
    }

    function updateVideoInfo(ev) {
        let t;
        const n = ev.videos.length;
        const what = n > 1 ? T(`${n} ролика подряд`, `${n} clips in a row`) : (ev.video ? ev.video.label || ev.video.name : "");
        if (!n && ev.note) t = T("Видео-сэмплер: ждёт монтаж", "Video Sampler: waiting for the edit");
        else if (!n) t = ev.wired ? T("провод подключён, но ролик не выбран", "wired, but no clip chosen") : T("подключите «Видео ×3» или загрузчик видео к входу video", "wire \"Video ×3\" or a video loader into the video input");
        else if (videoDur > 0) t = `${what} · ${videoDur.toFixed(2)} ${T("с", "s")}` + (ev.fromWire ? " · " + T("с провода", "wired") : " · " + T("выбрано вручную", "chosen by hand"));
        else t = `${what} · ${T("загружаю...", "loading...")}`;
        vInfo.textContent = t;
        vInfo.title = t;
    }

    function applyVideo() {
        const ev = effectiveVideo();
        const key = ev.videos.map(videoKey).join("||");
        const wasFit = fitActive();
        curVideos = ev.videos.slice(0, 3);
        if (key !== videoCur) {
            videoCur = key;
            videoDur = 0;
            vsBuild(curVideos);
            saveState();
        }
        const shown = curVideos.length > 0;
        saveVidBtn.style.display = shown ? "" : "none";
        const note = !shown && ev.note ? ev.note : "";
        vph.textContent = note;
        vph.style.display = note ? "flex" : "none";
        const boxOn = shown || !!note;
        if (shown !== videoShown || boxOn !== (vbox.style.display === "flex")) {
            videoShown = shown;
            vbox.style.display = boxOn ? "flex" : "none";
            relayout();
        }
        updateVideoInfo(ev);
        if (wasFit !== fitActive()) { saveState(); restartIfPlaying(); }
    }

    vSel.addEventListener("change", () => {
        const v = vSel.value;
        S.video = null;
        if (v) {
            const [type, subfolder, ...rest] = v.split("|");
            S.video = { type, subfolder, name: rest.join("|") };
        }
        saveState();
        applyVideo();
    });
    vRefresh.addEventListener("click", () => { refreshVideoList(); });
    fitCb.addEventListener("change", () => {
        S.fit = fitCb.checked;
        saveState();
        if (S.fit && !fitActive()) setStatus("Подключите видео - тогда музыка подстроится под его длину", true);
        restartIfPlaying();
    });

    // ---------- BPM ----------

    function showBpm() {
        const v = Math.round(S.bpm == null ? 90 : S.bpm);
        bpmSlider.value = String(v);
        if (document.activeElement !== bpmNum) bpmNum.value = String(v);
        syncCb.checked = S.syncBpm;
        fitCb.checked = S.fit;
    }

    function pushBpm(value, exceptSlot) {
        let n = 0;
        for (const c of chs) {
            if (!c.spec || c.slot === exceptSlot || !c.node) continue;
            const w = (c.node.widgets || []).find((x) => x.name === "bpm");
            if (!w) continue;
            if (Math.round(Number(w.value)) !== value) {
                w.value = value;
                if (typeof w.callback === "function") { try { w.callback(value); } catch (e) { /* ок */ } }
                n++;
            }
            c.lastBpm = value;
            c.lastBpmOrigin = c.originId;
        }
        if (n && typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
        return n;
    }

    // Слежение за темпом нод. Первая нода задаёт темп проекта. Поменяли BPM в любой ноде -
    // он становится общим и передаётся остальным.
    function bpmTick() {
        const wb = wiredBpm();
        const locked = wb !== null;
        bpmSlider.disabled = locked;
        bpmNum.disabled = locked;
        gB.style.opacity = locked ? "0.75" : "1";
        gB.title = locked ? "Темп приходит по проводу со входа bpm" : "";
        if (locked) {
            if (S.bpm !== wb) { S.bpm = wb; saveState(); showBpm(); }
            for (const c of chs) {
                if (!c.spec || !c.node || typeof c.spec.bpm !== "number") continue;
                if (S.syncBpm && Math.round(c.spec.bpm) !== wb) pushBpm(wb, null);
                c.lastBpm = S.syncBpm ? wb : Math.round(c.spec.bpm);
                c.lastBpmOrigin = c.originId;
            }
            return;
        }
        const src = chs.filter((c) => c.spec && c.node && typeof c.spec.bpm === "number");
        if (!src.length) return;
        let changed = null;
        for (const c of src) {
            const cur = Math.round(c.spec.bpm);
            if (c.lastBpmOrigin !== c.originId) {
                c.lastBpmOrigin = c.originId;
                c.lastBpm = cur;
                if (S.bpm == null) { S.bpm = cur; saveState(); showBpm(); }
                else if (S.syncBpm && cur !== Math.round(S.bpm)) pushBpm(Math.round(S.bpm), null);
                continue;
            }
            if (cur !== c.lastBpm) {
                c.lastBpm = cur;
                if (!changed) changed = cur;
            }
        }
        if (changed !== null && S.syncBpm) {
            S.bpm = changed;
            pushBpm(changed, null);
            saveState();
            showBpm();
        } else if (changed !== null && S.bpm == null) {
            S.bpm = changed;
            saveState();
            showBpm();
        }
    }

    function setMixerBpm(v) {
        v = Math.round(clamp(v, 40, 300));
        S.bpm = v;
        showBpm();
        if (S.syncBpm) pushBpm(v, null);
        saveState();
    }
    bpmSlider.addEventListener("input", () => setMixerBpm(parseFloat(bpmSlider.value)));
    bpmNum.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            const v = parseFloat(bpmNum.value.replace(",", "."));
            if (Number.isFinite(v)) setMixerBpm(v);
            else showBpm();
            bpmNum.blur();
        }
    });
    bpmNum.addEventListener("blur", () => {
        const v = parseFloat(bpmNum.value.replace(",", "."));
        if (Number.isFinite(v) && Math.round(v) !== Math.round(S.bpm == null ? 90 : S.bpm)) setMixerBpm(v);
        else showBpm();
    });
    syncCb.addEventListener("change", () => {
        S.syncBpm = syncCb.checked;
        if (S.syncBpm) {
            if (S.bpm == null) S.bpm = 90;
            pushBpm(Math.round(S.bpm), null);
            setStatus(`Синхронизация включена: у всех нод ${Math.round(S.bpm)} BPM`, false);
        }
        saveState();
        showBpm();
    });

    // ---------- каналы на экране ----------

    function buildList() {
        list.innerHTML = "";
        ui.clear();
        if (!chs.length) {
            const e = el("div", "nm-empty");
            e.textContent = "Подключите провод от выхода audio ноды Neron Drum Machine к входу audio_1 этого микшера. "
                + "Сразу появится следующий вход: туда можно подключить Neron Piano Roll или другую ноду. "
                + "Для каждого провода здесь появится свой канал с громкостью и балансом.";
            list.appendChild(e);
        }
        chs.forEach((c) => {
            const st = settingFor(c.slot);
            const row = el("div", "nm-row");
            row.style.setProperty("--c", st.color);
            row.appendChild(el("div", "nm-dot"));

            const name = el("div", "nm-name");
            name.appendChild(el("b", "", c.label));
            name.appendChild(el("span", "", c.isVideo ? `свой звук видео · ${c.sub}` : `вход ${c.slot}` + (c.sub && c.sub !== c.label ? " · " + c.sub : "")));
            row.appendChild(name);
            const meter = el("canvas", "nm-meter");
            meter.title = "Уровень канала / Channel level";
            row.appendChild(meter);

            const rowPlay = el("button", "nm-ms", "▶");
            rowPlay.title = "Слушать только этот трек (с текущего места)";
            const rowStop = el("button", "nm-ms", "■");
            rowStop.title = "Остановить";
            rowStop.style.color = "#e58a92";
            row.appendChild(rowPlay);
            row.appendChild(rowStop);

            const mBtn = el("button", "nm-ms" + (st.mute ? " on-m" : ""), "M");
            mBtn.title = c.isVideo ? "Выключить родной звук видео (останется только ваша музыка)" : "Выключить канал (Mute)";
            const sBtn = el("button", "nm-ms" + (st.solo ? " on-s" : ""), "S");
            sBtn.title = "Играть только этот канал (Solo)";
            row.appendChild(mBtn);
            row.appendChild(sBtn);

            const vb = el("div", "nm-mini");
            vb.appendChild(el("span", "", "VOL"));
            const vol = el("input", "nm-range");
            vol.type = "range"; vol.min = "0"; vol.max = "1.2"; vol.step = "0.01"; vol.value = String(st.vol);
            vol.title = "Громкость (двойной клик - сбросить)";
            vb.appendChild(vol);
            row.appendChild(vb);

            const pb = el("div", "nm-mini");
            pb.appendChild(el("span", "", "PAN"));
            const pan = el("input", "nm-range");
            pan.type = "range"; pan.min = "-1"; pan.max = "1"; pan.step = "0.05"; pan.value = String(st.pan);
            pan.title = "Баланс лево-право (двойной клик - в центр)";
            pb.appendChild(pan);
            row.appendChild(pb);

            // ---------- эквалайзер + эхо ----------
            const fx = el("div", "nm-fx");
            const fxReset = el("button", "nm-fxreset", "↺");
            fxReset.title = T("Сбросить эквалайзер и эхо", "Reset EQ and reverb");
            const showReset = () => { fxReset.style.visibility = (st.low || st.mid || st.high || st.rev) ? "visible" : "hidden"; };
            const dB = (x) => (x > 0 ? "+" : "") + x.toFixed(1) + " dB";
            const knobs = {};
            const band = (key, label, title) => {
                knobs[key] = makeKnob({
                    label, title, min: -12, max: 12, def: 0, step: 0.5, wheel: 1, bipolar: true, color: st.color, value: st[key] || 0, fmt: dB,
                    onChange: (x) => { st[key] = x; applyFx(c.slot, false); showReset(); },
                    onEnd: () => saveState(),
                });
                fx.appendChild(knobs[key]);
            };
            band("low", "НИЗ", T("НИЗ — бас, 200 Гц", "LOW — bass, 200 Hz"));
            band("mid", "СЕР", T("СЕРЕДИНА — голос, 1 кГц", "MID — voice, 1 kHz"));
            band("high", "ВЕРХ", T("ВЕРХ — блеск, 4 кГц", "HIGH — brightness, 4 kHz"));
            const roomBtn = el("button", "nm-room");
            const showRoom = () => {
                roomBtn.textContent = ROOM_NAME[st.room || "hall"][0];
                roomBtn.classList.toggle("on", (st.rev || 0) > 0.005);
                roomBtn.title = T("Где звучит эхо: комната → зал → собор (клик — сменить)", "Where the echo sounds: room → hall → cathedral (click to change)")
                    + "\n" + ROOM_NAME[st.room || "hall"].join(" / ");
            };
            knobs.rev = makeKnob({
                label: "ЭХО", title: T("ЭХО — сколько", "REVERB — amount"), min: 0, max: 1, def: 0, step: 0.01, wheel: 0.05, color: "#b197fc", value: st.rev || 0,
                fmt: (x) => Math.round(x * 100) + "%",
                onChange: (x) => { st.rev = x; applyFx(c.slot, false); showRoom(); showReset(); },
                onEnd: () => saveState(),
            });
            fx.appendChild(knobs.rev);
            roomBtn.addEventListener("click", () => {
                const i = ROOM_ORDER.indexOf(st.room || "hall");
                st.room = ROOM_ORDER[(i + 1) % ROOM_ORDER.length];
                if (!(st.rev > 0.005)) { st.rev = 0.3; knobs.rev.setValue(0.3); }   // выбрал помещение — сразу слышно
                applyFx(c.slot, false); showRoom(); showReset(); saveState();
            });
            fx.appendChild(roomBtn);
            fxReset.addEventListener("click", () => {
                st.low = st.mid = st.high = st.rev = 0;
                for (const k of ["low", "mid", "high", "rev"]) knobs[k].setValue(0);
                applyFx(c.slot, false); showRoom(); showReset(); saveState();
            });
            fx.appendChild(fxReset);
            showRoom(); showReset();
            row.appendChild(fx);

            const wave = el("div", "nm-wave");
            const canvas = el("canvas");
            const ph = el("div", "nm-ph");
            const note = el("div", "nm-note");
            note.textContent = c.isVideo ? "Достаю звук из видео..." : (c.spec ? "Готовлю звук..." : "Эту ноду не слышно заранее: звук появится после Queue");
            wave.appendChild(canvas);
            wave.appendChild(note);
            wave.appendChild(ph);
            row.appendChild(wave);

            ui.set(c.slot, { ph, canvas, note, rowPlay, meter, mL: {}, mR: {} });
            rowPlay.addEventListener("click", () => {
                if (play.on || play.starting) stopPlayback();
                play.only = c.slot;
                startPlayback();
            });
            rowStop.addEventListener("click", () => { stopPlayback(); setStatus("Пауза: PLAY продолжит с этого места", false); });
            const waveSeek = (ev) => {
                const b = readyBuf(c.slot, c.specKey);
                if (!b) return;
                const r = wave.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
                seekTo(frac * b.duration, true);
            };
            wave.style.cursor = "pointer";
            wave.title = "Клик - перемотать на это место";
            wave.addEventListener("pointerdown", (ev) => { wave.setPointerCapture(ev.pointerId); waveSeek(ev); });
            wave.addEventListener("pointermove", (ev) => { if (ev.buttons & 1) waveSeek(ev); });

            mBtn.addEventListener("click", () => { st.mute = !st.mute; mBtn.classList.toggle("on-m", st.mute); applyMixAll(); saveState(); });
            sBtn.addEventListener("click", () => { st.solo = !st.solo; sBtn.classList.toggle("on-s", st.solo); applyMixAll(); saveState(); });
            vol.addEventListener("input", () => { st.vol = parseFloat(vol.value); applyMix(c.slot, false); saveState(); });
            vol.addEventListener("dblclick", () => { vol.value = String(DEFAULT_VOL); vol.dispatchEvent(new Event("input")); });
            pan.addEventListener("input", () => { st.pan = parseFloat(pan.value); applyMix(c.slot, false); saveState(); });
            pan.addEventListener("dblclick", () => { pan.value = "0"; pan.dispatchEvent(new Event("input")); });

            list.appendChild(row);
            drawWave(c);
        });
        relayout();
        showPos(play.on ? currentPos() : pos.t);
    }

    let lastW = 0;
    let sizer = null;
    function relayout() {
        panelH = panelHeightFor(chs.length, videoShown);
        // реальная высота содержимого (верхняя строка может переноситься)
        root.style.height = "auto";
        const natural = root.offsetHeight;
        if (natural > 80) panelH = natural + 2;
        lastW = root.clientWidth;
        if (sizer) { sizer.fit(); return; }    // размер задаёт пользователь (см. makeUserSized)
        root.style.height = panelH + "px";
        if (node.size) {
            const need = BASE_NODE_H + INPUT_H * Math.max(1, (node.inputs || []).length) + panelH;
            if (node.size[1] < need) node.setSize([node.size[0], need]);
        }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }

    // ---------- слежение за проводами и за настройками подключённых нод ----------

    function tick() {
        if (document.hidden) return;
        const cur = readChannels();
        const ev0 = effectiveVideo();
        if (ev0.videos.length && !ev0.mute) {
            cur.unshift({
                slot: VIDEO_SLOT, n: 0, originId: "video", node: null, kind: "video", isVideo: true,
                label: "ЗВУК ВИДЕО", sub: ev0.videos.map((v) => v.label || v.name).join(" → "), spec: null, vsrc: ev0.videos.slice(0, 3),
                specKey: ev0.videos.map(videoKey).join("||"),
            });
        }
        const sig = cur.map((c) => `${c.slot}:${c.originId}:${c.kind}:${c.isVideo ? c.specKey : ""}`).join("|");
        if (sig !== structSig) {
            structSig = sig;
            const old = new Map(chs.map((c) => [c.slot, c]));
            chs = cur.map((c) => Object.assign(old.get(c.slot) || { seenKey: null, seenAt: 0, loading: false, error: "" }, c));
            for (const slot of [...loaded.keys()]) if (!chs.some((c) => c.slot === slot)) loaded.delete(slot);
            for (const [slot, ch] of [...chains.entries()]) {
                if (!chs.some((c) => c.slot === slot)) { try { ch.vol.disconnect(); } catch (e) { /* ок */ } chains.delete(slot); }
            }
            buildList();
            showSummary();
            if (play.on || play.starting) restartIfPlaying();
            setStatus(chs.length ? `Подключено нод: ${chs.length}` : "Подключите ноды проводами к входам audio_N", false);
        } else {
            for (const n of cur) {
                const c = chs.find((x) => x.slot === n.slot);
                if (c) Object.assign(c, { spec: n.spec, specKey: n.specKey, sub: n.sub, node: n.node, vsrc: n.vsrc });
            }
        }

        bpmTick();
        applyVideo();
        if (root.clientWidth !== lastW && root.clientWidth > 0) relayout();
        if (!play.on && !scrub.active) showPos(pos.t);

        const now = Date.now();
        for (const c of chs) {
            if (!c.spec && !c.isVideo) continue;
            if (c.failedKey === c.specKey) continue;
            if (c.specKey !== c.seenKey) { c.seenKey = c.specKey; c.seenAt = c.seenAt === 0 && !loaded.has(c.slot) ? 0 : now; }
            const have = loaded.get(c.slot);
            if ((!have || have.key !== c.specKey) && !c.loading && now - c.seenAt >= 600) {
                c.loading = true;
                const wasUpdate = !!have;
                loadChannel(c).then(() => {
                    c.loading = false;
                    if (wasUpdate && readyBuf(c.slot, c.specKey)) {
                        setStatus(`${c.label}: звук обновлён`, false);
                        if (play.on) restartIfPlaying();
                    }
                });
            }
        }
    }

    // ---------- верхняя панель ----------

    function showRepeats() { repLabel.textContent = String(S.repeats); }
    repMinus.addEventListener("click", () => { S.repeats = clamp(S.repeats - 1, 1, MAX_REPEATS); showRepeats(); saveState(); });
    repPlus.addEventListener("click", () => { S.repeats = clamp(S.repeats + 1, 1, MAX_REPEATS); showRepeats(); saveState(); });

    masterSlider.addEventListener("input", () => {
        S.master = parseFloat(masterSlider.value);
        if (audio) audio.master.gain.setTargetAtTime(S.master, audio.ctx.currentTime, 0.01);
        saveState();
    });
    masterSlider.addEventListener("dblclick", () => { masterSlider.value = "0.9"; masterSlider.dispatchEvent(new Event("input")); });

    playBtn.addEventListener("click", () => {
        if (play.on && play.only) stopPlayback();
        play.only = null;
        startPlayback();
    });
    stopBtn.addEventListener("click", () => { stopPlayback(); setStatus("Пауза: PLAY продолжит с этого места, ⏮ - в начало", false); });
    homeBtn.addEventListener("click", () => seekTo(0, true));
    tSlider.addEventListener("pointerdown", () => { scrub.active = true; });
    const endScrub = () => {
        if (!scrub.active) return;
        scrub.active = false;
        seekTo(parseFloat(tSlider.value) / 100, true);
    };
    tSlider.addEventListener("pointerup", endScrub);
    tSlider.addEventListener("pointercancel", endScrub);
    tSlider.addEventListener("input", () => seekTo(parseFloat(tSlider.value) / 100, false));
    tSlider.addEventListener("keydown", (e) => e.stopPropagation());

    async function doSave(withVideo) {
        const live = chs.filter((c) => c.spec);
        if (!live.length && !(curVideos.length && !chs.find((c) => c.isVideo && c.error))) {
            setStatus("Нечего сводить: подключите Drum Machine или Piano Roll (другие ноды сводятся через Queue)", true);
            return;
        }
        setStatus("Свожу...", false);
        try {
            const res = await api.fetchApi("/neron/mixer_render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channels: live.map((c) => {
                        const st = settingFor(c.slot);
                        return { src: c.spec, vol: st.vol, pan: st.pan, mute: st.mute, solo: st.solo, ...fxOf(st) };
                    }),
                    repeats: S.repeats,
                    master: S.master,
                    fit_sec: fitActive() ? videoDur : 0,
                    video: curVideos[0] || null,
                    videos: curVideos,
                    video_audio: curVideos.length ? { ...settingFor(VIDEO_SLOT), ...fxOf(settingFor(VIDEO_SLOT)) } : null,
                    with_video: !!withVideo,
                    save_name: getWidget("save_name")?.value || "neron_mix",
                }),
            });
            const data = await res.json();
            if (!data.ok) setStatus("Ошибка: " + data.error, true);
            else if (withVideo && data.video_path) setStatus("Видео сохранено: " + data.video_path, false);
            else if (withVideo) setStatus(data.video_error || "Видео не удалось склеить", true);
            else setStatus("Сохранено: " + data.path, false);
        } catch (e) {
            setStatus("Ошибка сохранения: " + e, true);
        }
    }
    saveBtn.addEventListener("click", () => doSave(false));
    saveVidBtn.addEventListener("click", () => {
        if (!curVideos.length) { setStatus(T("Сначала подключите видео к входу video", "Wire a video into the video input first"), true); return; }
        doSave(true);
    });

    // ---------- запуск ----------

    function syncAll() {
        showRepeats();
        showBpm();
        masterSlider.value = String(S.master);
        for (const c of chs) settingFor(c.slot);
        fillVideoSelect();
        buildList();
        applyMixAll();
        applyVideo();
        for (const c of chs) { c.lastBpmOrigin = null; }
        if (audio) audio.master.gain.setTargetAtTime(S.master, audio.ctx.currentTime, 0.01);
    }

    loadState(mixerWidget ? mixerWidget.value : "");
    showRepeats();
    showBpm();
    masterSlider.value = String(S.master);
    fillVideoSelect();

    const domWidget = node.addDOMWidget("neron_mixer", "neron_mixer", root, {
        serialize: false,
        hideOnZoom: false,
    });
    sizer = makeUserSized(node, domWidget, root, { minH: 160, autoH: () => panelH });
    buildList();

    const wanted = node.computeSize ? node.computeSize() : [900, 400];
    node.setSize([Math.max(wanted[0], 900), Math.max(wanted[1], BASE_NODE_H + INPUT_H * 2 + panelH)]);

    node.neronSyncInputs = () => { syncInputs(); tick(); };
    node.neronReload = () => {
        stopPlayback();
        loadState(mixerWidget ? mixerWidget.value : "");
        showRepeats();
        showBpm();
        masterSlider.value = String(S.master);
        fillVideoSelect();
        structSig = "";
        videoCur = "\u0000";
        syncInputs();
        tick();
    };
    node.neronDispose = () => {
        stopPlayback();
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        vsBuild([]);
    };

    syncInputs();
    refreshVideoList();
    pollTimer = setInterval(tick, 500);
    setTimeout(tick, 100);
}

app.registerExtension({
    name: "NeronAudio.MixerUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronMixer") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupMixerUI(this);
            return r;
        };

        // подключили или отключили провод -> обновить входы и каналы
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type) {
            const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined;
            if (type === 1 && this.neronSyncInputs) {
                const self = this;
                setTimeout(() => { if (self.neronSyncInputs) self.neronSyncInputs(); }, 0);
            }
            return r;
        };

        // после загрузки сохранённой схемы - восстановить настройки каналов
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const self = this;
            setTimeout(() => { if (self.neronReload) self.neronReload(); }, 0);
            return r;
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDispose) this.neronDispose();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
