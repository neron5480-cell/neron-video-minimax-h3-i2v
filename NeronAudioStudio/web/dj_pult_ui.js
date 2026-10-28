import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { el, makeUserSized, makeKnob, peakOf, meterStep, drawMeter, meterTap, neronTap } from "./neron_common.js";

// ============================================================================
//  Neron DJ Пульт / DJ Controller
//  RU: Две деки (A, B) с джогами и пэдами, микшер с кроссфейдером, запись сета.
//      Треки приходят проводами (deck_a, deck_b). Играть можно сразу, без Queue.
//      ⏺ ЗАПИСЬ пишет то, что вы слышите; по Queue запись идёт на выход audio.
//  EN: Two decks (A, B) with jog wheels and pads, a mixer with a crossfader,
//      set recording. Tracks come by wire (deck_a, deck_b). Play right away,
//      no Queue needed. ⏺ REC records what you hear; on Queue it goes out.
// ============================================================================

const T = (ru, en) => `${ru} / ${en}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COL = { a: "#ff9f43", b: "#54a0ff", acc: "#b388ff", rec: "#e5484d", loop: "#1dd1a1", cue: "#feca57" };
const PAD_COLORS = ["#ff6b81", "#feca57", "#1dd1a1", "#48dbfb", "#a29bfe", "#ff9f43", "#54a0ff", "#ee5253"];
const LOOP_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
const LOOP_NAMES = ["1/4", "1/2", "1", "2", "4", "8", "16", "32"];
const SYNTH = [
    { id: "kick", ru: "БОЧКА", en: "KICK" },
    { id: "snare", ru: "СНЕЙР", en: "SNARE" },
    { id: "clap", ru: "ХЛОПОК", en: "CLAP" },
    { id: "hat", ru: "ХЭТ", en: "HAT" },
    { id: "ohat", ru: "ОТКР. ХЭТ", en: "OPEN HAT" },
    { id: "horn", ru: "ГУДОК", en: "HORN" },
    { id: "laser", ru: "ЛАЗЕР", en: "LASER" },
    { id: "siren", ru: "СИРЕНА", en: "SIREN" },
];
const SEC_PER_REV = 1.8;          // один оборот джога = 1,8 с (как пластинка 33⅓)
const RANGES = [8, 16, 50];       // диапазон ползунка темпа, %
const ZOOM_SEC = 6;               // окно «близкой» волны
const PPS = 200;                  // точек волны на секунду

// один звуковой движок на всю страницу (общий с Пультом и «Полем»)
function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}

function fmtFine(sec) {
    if (!(sec >= 0) || !isFinite(sec)) return "0:00.0";
    const m = Math.floor(sec / 60), s = sec - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function fmtTime(sec) {
    if (!(sec >= 0) || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
//  Стиль / Styles
// ---------------------------------------------------------------------------
function injectStyles() {
    if (document.getElementById("neron-dj-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-dj-styles";
    s.textContent = `
.ndj-root{box-sizing:border-box;width:100%;padding:10px;background:var(--nt-panel,#1b1d23);border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:var(--nt-text,#cfd2d8);user-select:none}
.ndj-wrap{display:flex;flex-direction:column;gap:8px}
.ndj-head{display:flex;align-items:center;gap:8px;min-width:0}
.ndj-head b{font-size:14px;letter-spacing:1px;color:var(--nt-bright,#fff);white-space:nowrap}
.ndj-head .ndj-sub{flex:1;min-width:0;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndj-btn{height:24px;padding:0 10px;border:none;border-radius:6px;background:var(--nt-btn,#4a4e5a);color:#fff;font-size:11px;font-weight:800;
  cursor:pointer;white-space:nowrap;flex:none;letter-spacing:.4px}
.ndj-btn:hover{filter:brightness(1.18)}
.ndj-btn.on{background:var(--nt-acc,#6b4fb3)}
.ndj-help{display:none;font-size:11px;line-height:1.55;background:var(--nt-card,#20232a);border-radius:7px;padding:8px 10px}
.ndj-help b{color:#ffd166}
.ndj-waves{display:flex;flex-direction:column;gap:4px}
.ndj-wave{position:relative;height:58px;background:var(--nt-well,#101216);border-radius:6px;overflow:hidden;cursor:pointer}
.ndj-wave canvas{width:100%;height:100%;display:block}
.ndj-main{display:flex;gap:10px;align-items:stretch}
.ndj-deck{flex:1 1 0;min-width:230px;background:var(--nt-card,#20232a);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:7px;
  border-top:3px solid var(--c)}
.ndj-dhead{display:flex;align-items:center;gap:7px;min-width:0}
.ndj-badge{width:24px;height:24px;border-radius:6px;background:var(--c);color:#111;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none}
.ndj-name{flex:1;min-width:0;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndj-name small{display:block;font-size:9px;font-weight:600;color:var(--nt-muted,#8b90a0)}
.ndj-tempo{font-size:10px;font-weight:800;color:var(--nt-muted2,#9aa0ae);text-align:right;white-space:nowrap;flex:none}
.ndj-body{display:flex;gap:8px;align-items:stretch}
.ndj-body.rev{flex-direction:row-reverse}
.ndj-jogw{flex:1;min-width:110px;display:flex;justify-content:center;align-items:center}
.ndj-jog{width:100%;max-width:250px;aspect-ratio:1/1;display:block;cursor:grab;touch-action:none}
.ndj-jog:active{cursor:grabbing}
.ndj-trans{display:flex;gap:6px}
.ndj-trans .ndj-btn{flex:1;height:30px;font-size:12px}
.ndj-modes{display:flex;border-radius:7px;overflow:hidden;border:1px solid var(--nt-line,#33363e)}
.ndj-modes button{flex:1;height:22px;border:none;background:var(--nt-input,#23252b);color:var(--nt-muted2,#9aa0ae);font-size:9px;font-weight:800;
  cursor:pointer;white-space:nowrap;padding:0 4px}
.ndj-modes button.on{background:var(--c);color:#111}
.ndj-pads{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.ndj-pad{height:38px;border-radius:7px;border:1px solid var(--nt-line,#2c2f37);background:var(--nt-input,#191b21);color:var(--nt-muted,#8b90a0);font-size:9px;font-weight:800;
  display:flex;align-items:center;justify-content:center;text-align:center;line-height:10px;cursor:pointer;padding:2px;box-sizing:border-box;
  overflow:hidden;transition:background .06s,box-shadow .06s;touch-action:none}
.ndj-pad.lit{background:color-mix(in srgb, var(--p) 32%, var(--nt-input,#191b21));border-color:var(--p);color:var(--nt-bright,#fff)}
.ndj-pad.hit{background:var(--p);color:#111;box-shadow:0 0 14px var(--p)}
.ndj-mix{flex:0 0 236px;background:var(--nt-card,#20232a);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:8px;
  border-top:3px solid var(--nt-acc,${COL.acc})}
.ndj-lbl{font-size:9px;font-weight:800;color:var(--nt-muted,#8b90a0);letter-spacing:.5px;text-align:center;white-space:nowrap}
.ndj-row{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ndj-krow{display:flex;justify-content:space-around;align-items:flex-start}
.ndj-xp{display:none;flex-direction:column;gap:6px;border-bottom:1px dashed var(--nt-line,#33363e);padding-bottom:6px}
.ndj-faders{display:flex;align-items:stretch;justify-content:space-between;gap:6px;height:150px}
.ndj-fcol{display:flex;flex-direction:column;align-items:center;gap:3px}
.ndj-meter{width:12px;flex:none;align-self:stretch;background:var(--nt-well,#101216);border-radius:3px}
.ndj-fader{position:relative;background:var(--nt-well,#0e1014);border-radius:5px;border:1px solid var(--nt-line,#2c2f37);touch-action:none;cursor:pointer;flex:none}
.ndj-fader.v{width:22px}
.ndj-fader.h{height:22px}
.ndj-fader .ndj-slot{position:absolute;background:var(--nt-line,#2a2d35);border-radius:2px}
.ndj-fader.v .ndj-slot{left:9px;width:3px;top:7px;bottom:7px}
.ndj-fader.h .ndj-slot{top:9px;height:3px;left:7px;right:7px}
.ndj-fader .ndj-mid{position:absolute;background:var(--nt-muted,#5a5f6b)}
.ndj-fader.v .ndj-mid{left:3px;right:3px;height:1px;top:50%}
.ndj-fader.h .ndj-mid{top:3px;bottom:3px;width:1px;left:50%}
.ndj-thumb{position:absolute;border-radius:3px;background:linear-gradient(#e8e9ee,#9ea2ad);box-shadow:0 1px 3px #000}
.ndj-fader.v .ndj-thumb{left:1px;right:1px;height:14px}
.ndj-fader.h .ndj-thumb{top:1px;bottom:1px;width:14px}
.ndj-thumb::after{content:"";position:absolute;background:var(--c,#444)}
.ndj-fader.v .ndj-thumb::after{left:2px;right:2px;top:6px;height:2px}
.ndj-fader.h .ndj-thumb::after{top:2px;bottom:2px;left:6px;width:2px}
.ndj-rec{height:38px;border:none;border-radius:9px;background:#3a2226;color:#ff8f93;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:.6px}
.ndj-rec.on{background:${COL.rec};color:#fff;animation:ndjPulse 1s infinite}
@keyframes ndjPulse{50%{box-shadow:0 0 16px ${COL.rec}}}
.ndj-out{font-size:10px;line-height:1.4;color:var(--nt-muted2,#9aa0ae);background:var(--nt-well,#101216);border-radius:6px;padding:6px 7px;display:flex;gap:6px;align-items:flex-start}
.ndj-out span{flex:1;min-width:0}
.ndj-out button{flex:none;height:18px;border:none;border-radius:4px;background:#4a2a2e;color:#ffb3b6;font-size:10px;font-weight:800;cursor:pointer}
.ndj-sel{height:20px;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);border:1px solid var(--nt-line,#33363e);border-radius:4px;font-size:10px;outline:none}
.ndj-status{font-size:10px;color:var(--nt-muted,#8b90a0);min-height:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ndj-status.err{color:#ff8f93}
.ndj-root .nm-knob{display:flex;flex-direction:column;align-items:center;min-width:34px;flex:none;cursor:ns-resize}
.ndj-root .nm-knob canvas{width:28px;height:28px;display:block;touch-action:none}
.ndj-root .nm-knob span{font-size:8px;font-weight:800;color:var(--nt-muted,#8b90a0);line-height:9px;letter-spacing:.3px;white-space:nowrap}
`;
    document.head.appendChild(s);
}

// ---------------------------------------------------------------------------
//  Ползунок (вертикальный или горизонтальный) / Fader
// ---------------------------------------------------------------------------
function makeFader(o) {
    const tr = el("div", "ndj-fader " + (o.vertical ? "v" : "h"));
    tr.appendChild(el("div", "ndj-slot"));
    if (o.center) tr.appendChild(el("div", "ndj-mid"));
    const th = el("div", "ndj-thumb");
    if (o.color) th.style.setProperty("--c", o.color);
    tr.appendChild(th);
    if (o.length) tr.style[o.vertical ? "height" : "width"] = o.length;
    tr.title = o.title || "";
    let v = o.value;
    const span = o.max - o.min;
    const paint = () => {
        const f = (v - o.min) / span;
        if (o.vertical) th.style.bottom = `calc((100% - 14px) * ${f})`;
        else th.style.left = `calc((100% - 14px) * ${f})`;
    };
    const fromEvent = (e) => {
        const r = tr.getBoundingClientRect();
        const f = o.vertical ? 1 - (e.clientY - r.top - 7) / Math.max(1, r.height - 14) : (e.clientX - r.left - 7) / Math.max(1, r.width - 14);
        return o.min + clamp(f, 0, 1) * span;
    };
    const setV = (nv, fire) => {
        nv = clamp(nv, o.min, o.max);
        if (o.def !== undefined && Math.abs(nv - o.def) < span * 0.012) nv = o.def;     // притягивается к середине
        if (nv === v) return;
        v = nv; paint();
        if (fire && o.onChange) o.onChange(v);
    };
    let drag = false;
    tr.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        tr.setPointerCapture(e.pointerId);
        drag = true;
        setV(fromEvent(e), true);
    });
    tr.addEventListener("pointermove", (e) => { if (drag) setV(fromEvent(e), true); });
    const end = () => { if (drag) { drag = false; if (o.onEnd) o.onEnd(v); } };
    tr.addEventListener("pointerup", end);
    tr.addEventListener("pointercancel", end);
    tr.addEventListener("dblclick", (e) => { e.stopPropagation(); if (o.def !== undefined) { setV(o.def, true); if (o.onEnd) o.onEnd(v); } });
    tr.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        setV(v + (e.deltaY < 0 ? 1 : -1) * span / 50, true);
        if (o.onEnd) o.onEnd(v);
    }, { passive: false });
    paint();
    return { el: tr, set: (nv) => { v = clamp(nv, o.min, o.max); paint(); }, get: () => v };
}

// ---------------------------------------------------------------------------
//  Встроенные звуки пэдов (синтезируются, файлы не нужны)
//  Built-in pad sounds (synthesized, no files needed)
// ---------------------------------------------------------------------------
async function synthBuffer(ctx, id) {
    window.__neronDjSynth = window.__neronDjSynth || {};
    const key = id + "@" + ctx.sampleRate;
    if (window.__neronDjSynth[key]) return window.__neronDjSynth[key];
    const sr = ctx.sampleRate;
    const dur = { kick: 0.6, snare: 0.35, clap: 0.45, hat: 0.12, ohat: 0.5, horn: 1.3, laser: 0.5, siren: 1.8 }[id] || 0.5;
    const len = Math.ceil(dur * sr);
    const oc = new OfflineAudioContext(2, len, sr);
    const out = oc.createGain();
    out.gain.value = 0.9;
    out.connect(oc.destination);
    const noise = () => {
        const b = oc.createBuffer(1, len, sr);
        const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const n = oc.createBufferSource();
        n.buffer = b;
        return n;
    };
    const env = (g, t0, peak, attack, decay) => {
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    };
    const filt = (type, f, q) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };

    if (id === "kick") {
        const o = oc.createOscillator(); o.type = "sine";
        o.frequency.setValueAtTime(160, 0); o.frequency.exponentialRampToValueAtTime(42, 0.13);
        const g = oc.createGain(); env(g, 0, 1.0, 0.002, 0.5);
        chain(o, g, out); o.start(0);
        const n = noise(), gc = oc.createGain(); env(gc, 0, 0.3, 0.001, 0.012);
        chain(n, filt("highpass", 3000), gc, out); n.start(0);
    } else if (id === "snare") {
        const n = noise(), g = oc.createGain(); env(g, 0, 0.7, 0.001, 0.22);
        chain(n, filt("highpass", 1200), g, out); n.start(0);
        const o = oc.createOscillator(); o.type = "triangle";
        o.frequency.setValueAtTime(190, 0); o.frequency.exponentialRampToValueAtTime(150, 0.1);
        const g2 = oc.createGain(); env(g2, 0, 0.5, 0.001, 0.1);
        chain(o, g2, out); o.start(0);
    } else if (id === "clap") {
        const n = noise(), g = oc.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        for (const t of [0, 0.011, 0.022]) {
            g.gain.setValueAtTime(0.9, t);
            g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
        }
        g.gain.setValueAtTime(0.8, 0.033);
        g.gain.exponentialRampToValueAtTime(0.0001, 0.033 + 0.2);
        chain(n, filt("bandpass", 1300, 0.8), g, out); n.start(0);
    } else if (id === "hat" || id === "ohat") {
        const n = noise(), g = oc.createGain(); env(g, 0, 0.5, 0.001, id === "hat" ? 0.05 : 0.4);
        chain(n, filt("highpass", 7500), g, out); n.start(0);
    } else if (id === "horn") {
        const lp = filt("lowpass", 3000), g = oc.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        for (const [a, b] of [[0, 0.16], [0.2, 0.36], [0.42, 1.2]]) {
            g.gain.setValueAtTime(0.0001, a);
            g.gain.exponentialRampToValueAtTime(0.25, a + 0.01);
            g.gain.setValueAtTime(0.25, b - 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, b);
        }
        chain(lp, g, out);
        for (const f of [440, 443, 660]) { const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(0); }
    } else if (id === "laser") {
        const o = oc.createOscillator(); o.type = "square";
        o.frequency.setValueAtTime(2400, 0); o.frequency.exponentialRampToValueAtTime(120, 0.4);
        const g = oc.createGain(); env(g, 0, 0.3, 0.002, 0.42);
        chain(o, filt("lowpass", 5000), g, out); o.start(0);
    } else if (id === "siren") {
        const o = oc.createOscillator(); o.type = "sine"; o.frequency.value = 900;
        const lfo = oc.createOscillator(); lfo.frequency.value = 3.5;
        const lg = oc.createGain(); lg.gain.value = 350;
        lfo.connect(lg); lg.connect(o.frequency);
        const g = oc.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(0.4, 0.05);
        g.gain.setValueAtTime(0.4, 1.5);
        g.gain.exponentialRampToValueAtTime(0.0001, 1.78);
        chain(o, g, out); o.start(0); lfo.start(0);
    }
    const buf = await oc.startRendering();
    window.__neronDjSynth[key] = buf;
    return buf;
}

// ---------------------------------------------------------------------------
//  Разбор трека: волна, темп (BPM) и где первый удар
//  Track analysis: waveform, tempo (BPM) and the first beat
// ---------------------------------------------------------------------------
function analyzeBuffer(buf, knownBpm) {
    const sr = buf.sampleRate, n = buf.length;
    const L = buf.getChannelData(0);
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const step = sr / PPS;
    const peaks = new Float32Array(Math.ceil(n / step) + 1);
    const fps = 344;
    const hop = Math.max(1, Math.round(sr / fps));
    const realFps = sr / hop;
    const maxFrames = Math.min(Math.floor(n / hop), Math.floor(150 * realFps));
    const eLow = new Float32Array(maxFrames), eAll = new Float32Array(maxFrames);
    // огибающие: бас (до 150 Гц) и весь звук, сглаженные ~8 мс — чтобы не «слышать» колебания самого баса
    const a = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    const ks = 1 - Math.exp(-1 / (0.008 * sr));
    let y = 0, envL = 0, envA = 0;
    for (let i = 0; i < n; i++) {
        const x = (L[i] + R[i]) * 0.5;
        const ax = Math.abs(x);
        const pi = (i / step) | 0;
        if (ax > peaks[pi]) peaks[pi] = ax;
        const f = (i / hop) | 0;
        if (f < maxFrames) {
            y += a * (x - y);
            envL += ks * (y * y - envL);
            envA += ks * (x * x - envA);
            if (i % hop === hop - 1) { eLow[f] = envL; eAll[f] = envA; }
        }
    }
    const res = { peaks, pps: PPS, duration: buf.duration, bpm: 0, offset: 0, known: false };
    if (maxFrames < realFps * 4) {
        if (knownBpm) { res.bpm = knownBpm; res.known = true; }
        return res;
    }
    const on = new Float32Array(maxFrames);
    let mean = 0;
    const cL = Math.log(1 + 1000 * eLow.reduce((m, v) => (v > m ? v : m), 0) || 1), cA = Math.log(1 + 1000 * eAll.reduce((m, v) => (v > m ? v : m), 0) || 1);
    for (let f = 3; f < maxFrames; f++) {
        const d1 = (Math.log(1 + 1000 * eLow[f]) - Math.log(1 + 1000 * eLow[f - 3])) / cL;
        const d2 = (Math.log(1 + 1000 * eAll[f]) - Math.log(1 + 1000 * eAll[f - 3])) / cA;
        on[f] = Math.max(0, d1) + 0.7 * Math.max(0, d2);
        mean += on[f];
    }
    mean /= maxFrames;
    for (let f = 0; f < maxFrames; f++) on[f] -= mean;

    let bpm = knownBpm || 0;
    if (!bpm) {
        const lagMin = Math.floor(realFps * 60 / 200), lagMax = Math.ceil(realFps * 60 / 60);
        const r = new Float32Array(lagMax * 2 + 2);
        const ac = (l) => {
            if (r[l]) return r[l];
            let s = 0;
            for (let f = 0; f + l < maxFrames; f++) s += on[f] * on[f + l];
            r[l] = s / (maxFrames - l) + 1e-12;
            return r[l];
        };
        let best = -Infinity, bestLag = 0;
        for (let l = lagMin; l <= lagMax; l++) {
            const b = realFps * 60 / l;
            const prior = Math.exp(-0.5 * Math.pow(Math.log2(b / 120) / 0.9, 2));
            const sc = (ac(l) + 0.5 * (2 * l < maxFrames ? ac(2 * l) : 0)) * prior;
            if (sc > best) { best = sc; bestLag = l; }
        }
        if (bestLag && best > 0) {
            const y0 = ac(bestLag - 1), y1 = ac(bestLag), y2 = ac(bestLag + 1);
            const den = y0 - 2 * y1 + y2;
            const shift = den !== 0 ? clamp(0.5 * (y0 - y2) / den, -0.5, 0.5) : 0;
            bpm = realFps * 60 / (bestLag + shift);
            while (bpm < 75) bpm *= 2;
            while (bpm > 185) bpm /= 2;
            bpm = Math.round(bpm * 10) / 10;
        }
    }
    if (bpm > 0) {
        // фаза: где стоят удары (сдвиг первого удара от начала); для найденного темпа — ещё и точная подстройка
        const comb = (b) => {
            const p = realFps * 60 / b;
            let best = -Infinity, bestPh = 0;
            for (let ph = 0; ph < p; ph += 0.5) {
                let s = 0;
                for (let t = ph; t < maxFrames; t += p) s += on[Math.round(t)] || 0;
                if (s > best) { best = s; bestPh = ph; }
            }
            return { s: best, ph: bestPh };
        };
        let top = comb(bpm);
        if (!knownBpm) {
            const base = bpm;
            for (let d = -0.4; d <= 0.4001; d += 0.02) {
                const b = Math.round((base + d) * 100) / 100;
                const c = comb(b);
                if (c.s > top.s) { top = c; bpm = b; }
            }
            // ровный темп (120, 128…) — если он звучит не хуже
            const ri = Math.round(bpm);
            if (Math.abs(bpm - ri) < 0.15) {
                const c = comb(ri);
                if (c.s >= top.s * 0.995) { top = c; bpm = ri; }
            }
            bpm = Math.round(bpm * 100) / 100;
        }
        res.offset = knownBpm ? 0 : top.ph / realFps;
        res.bpm = bpm;
        res.known = !!knownBpm;
    }
    return res;
}

// ---------------------------------------------------------------------------
//  Откуда пришёл звук (идём по проводу назад) — те же правила, что у Пульта
//  Where the sound comes from (walk the wire back) — same rules as the Pult
// ---------------------------------------------------------------------------
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

function widgetValue(n, name) {
    const w = (n.widgets || []).find((x) => x.name === name);
    return w ? w.value : undefined;
}

// результат: { label, specs: [spec...], bpm } — specs пуст, если источник слышен только после Queue
function describeSource(o) {
    const cls = o.comfyClass || o.type;
    const title = o.title || cls;
    const kit = String(widgetValue(o, "kit_name") || "default").trim() || "default";
    const bpm = clamp(Number(widgetValue(o, "bpm")) || 90, 40, 300);
    const fileSpec = (f) => ({ type: "file", name: f.name, subfolder: f.subfolder || "", kind: f.kind || f.type || "input", start: f.start || 0, end: f.end || 0 });
    if (cls === "NeronDrumMachine") return { label: title, specs: [{ type: "drum", kit_name: kit, bpm, json: String(widgetValue(o, "pattern_json") || "{}") }], bpm };
    if (cls === "NeronPianoRoll") return { label: title, specs: [{ type: "piano", kit_name: kit, bpm, json: String(widgetValue(o, "project_json") || "{}") }], bpm };
    if (cls === "NeronMusic") {
        return { label: title, bpm, specs: [
            { type: "drum", kit_name: kit, bpm, json: String(widgetValue(o, "pattern_json") || "{}") },
            { type: "piano", kit_name: kit, bpm, json: String(widgetValue(o, "project_json") || "{}") },
        ] };
    }
    if (cls === "NeronAudioLoader" || cls === "LoadAudio") {
        const f = parseFileValue(widgetValue(o, cls === "LoadAudio" ? "audio" : "audio_file"));
        if (!f) return { label: title, specs: [], empty: true };
        const start = Math.max(0, Number(widgetValue(o, "start_sec")) || 0);
        const end = Math.max(0, Number(widgetValue(o, "end_sec")) || 0);
        return { label: f.name, specs: [{ ...fileSpec(f), start, end }] };
    }
    if (cls === "NeronSoundCube" && typeof o.neronCube === "function") {
        const items = o.neronCube().items || [];
        return { label: title, specs: items.map(fileSpec), multi: true };
    }
    if (cls === "NeronSampler" && typeof o.neronCube === "function") {
        const st = o.neronCube();
        if (st.bypass) return { label: title, specs: (st.items || []).map(fileSpec), multi: true };
        return { label: title, specs: st.spec ? [st.spec] : [] };
    }
    if (cls === "NeronArrange") {
        const inputs = typeof o.neronArrangeInputs === "function" ? o.neronArrangeInputs() : {};
        return { label: title, specs: [{ type: "arrange", json: String(widgetValue(o, "field_json") || "{}"), inputs }] };
    }
    if (cls === "NeronStudio" && typeof o.neronStudio === "function") {
        const st = o.neronStudio();
        if (st.bypass) return st.upstream ? describeSource(st.upstream) : { label: title, specs: [], empty: true };
        if (!st.sources || !st.sources.length) return { label: title, specs: [], empty: true };
        return { label: title, specs: [{ type: "studio", json: st.json, sources: st.sources }] };
    }
    return { label: title, specs: [] };     // любой другой источник: слышно после Queue
}

// ---------------------------------------------------------------------------
//  Запись того, что слышно (AudioWorklet, запасной путь — ScriptProcessor)
//  Recording what you hear
// ---------------------------------------------------------------------------
const REC_WORKLET = `
class NeronDjRec extends AudioWorkletProcessor {
  constructor(){super();this.on=false;this.n=0;this.L=new Float32Array(8192);this.R=new Float32Array(8192);
    this.port.onmessage=(e)=>{ if(e.data==='stop'){this.on=false;this.flush();this.port.postMessage('stopped');return;} this.on=!!e.data; };}
  flush(){ if(this.n){ this.port.postMessage([this.L.slice(0,this.n),this.R.slice(0,this.n)]); this.n=0; } }
  push(l,r){ let k=0; while(k<l.length){ const m=Math.min(l.length-k,8192-this.n);
      this.L.set(l.subarray(k,k+m),this.n); this.R.set(r.subarray(k,k+m),this.n); this.n+=m; k+=m;
      if(this.n===8192){ this.port.postMessage([this.L.slice(0),this.R.slice(0)]); this.n=0; } } }
  process(inputs){ if(this.on){ const i=inputs[0];
      if(i && i.length){ this.push(i[0], i[1]||i[0]); } else { const z=new Float32Array(128); this.push(z,z); } }
    return true; }
}
registerProcessor('neron-dj-rec', NeronDjRec);`;

async function makeRecorderNode(ctx, onData, onStopped) {
    try {
        if (ctx.audioWorklet) {
            if (!window.__neronDjWorklet || window.__neronDjWorklet.ctx !== ctx) {
                const url = URL.createObjectURL(new Blob([REC_WORKLET], { type: "application/javascript" }));
                await ctx.audioWorklet.addModule(url);
                window.__neronDjWorklet = { ctx };
            }
            const node = new AudioWorkletNode(ctx, "neron-dj-rec", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit" });
            node.port.onmessage = (e) => { if (e.data === "stopped") onStopped(); else onData(e.data[0], e.data[1]); };
            return { node, start: () => node.port.postMessage(true), stop: () => node.port.postMessage("stop") };
        }
    } catch (e) {
        console.warn("[Neron DJ] AudioWorklet недоступен, запасной путь / fallback", e);
    }
    const node = ctx.createScriptProcessor(4096, 2, 2);
    let on = false;
    node.onaudioprocess = (e) => {
        if (!on) return;
        const ib = e.inputBuffer;
        onData(ib.getChannelData(0).slice(0), (ib.numberOfChannels > 1 ? ib.getChannelData(1) : ib.getChannelData(0)).slice(0));
    };
    return { node, start: () => { on = true; }, stop: () => { on = false; setTimeout(onStopped, 0); } };
}

// ============================================================================
//  Сама нода / The node
// ============================================================================
function setupDJ(node) {
    injectStyles();
    const ctx = getCtx();

    const getWidget = (name) => (node.widgets || []).find((x) => x.name === name);
    const djWidget = getWidget("dj_json");
    if (djWidget) { djWidget.type = "hidden"; djWidget.hidden = true; djWidget.computeSize = () => [0, -4]; }
    const saveNameW = getWidget("save_name");

    // ---------- состояние (сохраняется в схеме) ----------
    const S = {
        version: 1, rec: null, xfade: 8, xf: 0, master: 0.9, smp: 0.8, curve: "smooth", range: 8,
        vol: { a: 0.85, b: 0.85 }, filt: { a: 0, b: 0 }, tempo: { a: 0, b: 0 }, mode: { a: "cue", b: "cue" },
        eq: { a: { trim: 0, hi: 0, mid: 0, lo: 0 }, b: { trim: 0, hi: 0, mid: 0, lo: 0 } },
        cues: { a: { sig: "", pts: Array(8).fill(null), main: 0 }, b: { sig: "", pts: Array(8).fill(null), main: 0 } },
    };
    function loadState() {
        let d = {};
        try { d = JSON.parse(djWidget ? djWidget.value : "{}") || {}; } catch (e) { d = {}; }
        if (typeof d !== "object") d = {};
        S.rec = d.rec && typeof d.rec.name === "string" ? d.rec : null;
        S.xfade = clamp(Number(d.xfade ?? 8), 0, 60);
        S.xf = clamp(Number(d.xf ?? 0), -1, 1);
        S.master = clamp(Number(d.master ?? 0.9), 0, 1.5);
        S.smp = clamp(Number(d.smp ?? 0.8), 0, 1.5);
        S.curve = d.curve === "cut" ? "cut" : "smooth";
        S.range = RANGES.includes(Number(d.range)) ? Number(d.range) : 8;
        for (const k of ["a", "b"]) {
            S.vol[k] = clamp(Number(d.vol?.[k] ?? 0.85), 0, 1);
            S.filt[k] = clamp(Number(d.filt?.[k] ?? 0), -1, 1);
            S.tempo[k] = clamp(Number(d.tempo?.[k] ?? 0), -50, 50);
            S.mode[k] = ["cue", "smp", "loop"].includes(d.mode?.[k]) ? d.mode[k] : "cue";
            for (const e of ["trim", "hi", "mid", "lo"]) S.eq[k][e] = clamp(Number(d.eq?.[k]?.[e] ?? 0), -1, 1);
            const c = d.cues?.[k] || {};
            S.cues[k] = {
                sig: String(c.sig || ""),
                pts: Array.from({ length: 8 }, (_, i) => (Array.isArray(c.pts) && typeof c.pts[i] === "number" ? c.pts[i] : null)),
                main: Number(c.main) || 0,
            };
        }
    }
    let saveT = null;
    function saveState() {
        clearTimeout(saveT);
        saveT = setTimeout(() => { if (djWidget) djWidget.value = JSON.stringify(S); }, 250);
    }
    loadState();

    // ---------- звуковой граф / audio graph ----------
    const master = ctx.createGain();
    master.gain.value = S.master;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    const masterMeter = meterTap(ctx, limiter);
    neronTap(ctx, limiter);
    const smpGain = ctx.createGain();
    smpGain.gain.value = S.smp;
    smpGain.connect(master);

    const dB = (d) => Math.pow(10, d / 20);

    // ---------- дека / deck ----------
    function makeDeck(id) {
        const D = { id, buf: null, ana: null, label: "", srcSig: "", srcKind: "none", loading: false, err: "",
            playing: false, offset: 0, t0: 0, rate: 1, bend: 0, src: null, loop: null, loopIdx: -1, ended: false };
        D.trim = ctx.createGain();
        D.lo = ctx.createBiquadFilter(); D.lo.type = "lowshelf"; D.lo.frequency.value = 220;
        D.mid = ctx.createBiquadFilter(); D.mid.type = "peaking"; D.mid.frequency.value = 1000; D.mid.Q.value = 0.8;
        D.hi = ctx.createBiquadFilter(); D.hi.type = "highshelf"; D.hi.frequency.value = 3500;
        D.flt = ctx.createBiquadFilter(); D.flt.type = "lowpass"; D.flt.frequency.value = 22000; D.flt.Q.value = 0.7;
        D.fader = ctx.createGain();
        D.xg = ctx.createGain();
        D.trim.connect(D.lo); D.lo.connect(D.mid); D.mid.connect(D.hi); D.hi.connect(D.flt); D.flt.connect(D.fader); D.fader.connect(D.xg); D.xg.connect(master);
        D.meter = meterTap(ctx, D.fader);
        D.mL = {}; D.mR = {};

        D.baseRate = () => 1 + S.tempo[id] / 100;
        D.dur = () => (D.buf ? D.buf.duration : 0);
        D.pos = () => {
            if (!D.playing) return D.offset;
            let p = D.offset + (ctx.currentTime - D.t0) * D.rate;
            if (D.loop && p >= D.loop.end) {
                const ln = D.loop.end - D.loop.start;
                p = D.loop.start + ((p - D.loop.start) % ln);
            }
            return Math.min(p, D.dur());
        };
        const rebase = () => { D.offset = D.pos(); D.t0 = ctx.currentTime; };
        const killSrc = () => {
            if (!D.src) return;
            const s = D.src; D.src = null;
            s.onended = null;
            try { s.stop(); } catch (e) { /* уже остановлен */ }
            try { s.disconnect(); } catch (e) { /* ок */ }
        };
        D.startSrc = () => {
            killSrc();
            const s = ctx.createBufferSource();
            s.buffer = D.buf;
            s.playbackRate.value = D.rate;
            if (D.loop) { s.loop = true; s.loopStart = D.loop.start; s.loopEnd = D.loop.end; }
            s.connect(D.trim);
            s.onended = () => {
                if (D.src !== s) return;
                D.src = null; D.playing = false; D.offset = D.dur(); D.ended = true;
                paintTransport();
            };
            D.t0 = ctx.currentTime;
            s.start(0, clamp(D.offset, 0, Math.max(0, D.dur() - 0.001)));
            D.src = s;
        };
        D.play = () => {
            if (!D.buf) return;
            if (ctx.state !== "running") ctx.resume();
            if (D.offset >= D.dur() - 0.01) D.offset = 0;
            D.ended = false;
            D.rate = D.baseRate() * (1 + D.bend);
            D.playing = true;
            D.startSrc();
            paintTransport();
        };
        D.pause = () => {
            if (!D.playing) return;
            D.offset = D.pos();
            D.playing = false;
            killSrc();
            paintTransport();
        };
        D.seek = (t) => {
            if (!D.buf) return;
            D.offset = clamp(t, 0, D.dur());
            if (D.loop && (D.offset < D.loop.start || D.offset >= D.loop.end)) D.exitLoop();
            if (D.playing) D.startSrc();
        };
        D.applyRate = () => {
            const r = D.baseRate() * (1 + D.bend);
            if (Math.abs(r - D.rate) < 1e-5) return;
            if (D.playing) rebase();
            D.rate = r;
            if (D.src) D.src.playbackRate.setValueAtTime(r, ctx.currentTime);
        };
        D.setLoop = (beats, idx) => {
            const a = D.ana;
            if (!D.buf || !a || !a.bpm) return false;
            const ln = beats * 60 / a.bpm;
            if (D.playing) rebase();
            const p = D.offset;
            let start = a.offset + Math.floor((p - a.offset) / ln) * ln;
            if (start < 0) start = Math.max(0, p);
            const end = Math.min(D.dur(), start + ln);
            if (end - start < 0.01) return false;
            D.loop = { start, end, beats }; D.loopIdx = idx;
            if (D.src) { D.src.loop = true; D.src.loopStart = start; D.src.loopEnd = end; }
            return true;
        };
        D.exitLoop = () => {
            if (!D.loop) return;
            if (D.playing) rebase();
            D.loop = null; D.loopIdx = -1;
            if (D.src) D.src.loop = false;
        };
        D.applyMix = () => {
            const e = S.eq[id];
            D.trim.gain.setTargetAtTime(dB(e.trim * 12), ctx.currentTime, 0.01);
            const eqDb = (v) => (v < 0 ? v * 26 : v * 6);
            D.lo.gain.setTargetAtTime(eqDb(e.lo), ctx.currentTime, 0.01);
            D.mid.gain.setTargetAtTime(eqDb(e.mid), ctx.currentTime, 0.01);
            D.hi.gain.setTargetAtTime(eqDb(e.hi), ctx.currentTime, 0.01);
            const f = S.filt[id];
            if (Math.abs(f) < 0.02) {
                D.flt.type = "lowpass"; D.flt.Q.value = 0.7;
                D.flt.frequency.setTargetAtTime(22000, ctx.currentTime, 0.01);
            } else if (f < 0) {
                D.flt.type = "lowpass"; D.flt.Q.value = 1.2;
                D.flt.frequency.setTargetAtTime(20000 * Math.pow(60 / 20000, -f), ctx.currentTime, 0.01);
            } else {
                D.flt.type = "highpass"; D.flt.Q.value = 1.2;
                D.flt.frequency.setTargetAtTime(20 * Math.pow(8000 / 20, f), ctx.currentTime, 0.01);
            }
            const v = S.vol[id];
            D.fader.gain.setTargetAtTime(v * v, ctx.currentTime, 0.01);
        };
        D.unload = () => {
            D.pause(); killSrc();
            D.buf = null; D.ana = null; D.label = ""; D.offset = 0; D.loop = null; D.loopIdx = -1; D.err = "";
        };
        D.setBuffer = (buf, label, knownBpm, sig) => {
            D.pause(); killSrc();
            D.buf = buf; D.label = label; D.offset = 0; D.loop = null; D.loopIdx = -1; D.err = "";
            D.ana = analyzeBuffer(buf, knownBpm);
            const c = S.cues[id];
            if (c.sig !== sig) { c.sig = sig; c.pts = Array(8).fill(null); c.main = 0; saveState(); }
            D.offset = clamp(c.main, 0, buf.duration);
        };
        D.applyMix();
        return D;
    }
    const decks = { a: makeDeck("a"), b: makeDeck("b") };
    const other = (id) => decks[id === "a" ? "b" : "a"];

    function applyXfader() {
        const x = S.xf;
        let ga, gb;
        if (S.curve === "cut") {
            ga = clamp((1 - x) / 0.2, 0, 1); gb = clamp((1 + x) / 0.2, 0, 1);
        } else {
            const t = (x + 1) / 2;
            ga = Math.cos(t * Math.PI / 2); gb = Math.sin(t * Math.PI / 2);
        }
        decks.a.xg.gain.setTargetAtTime(ga, ctx.currentTime, 0.008);
        decks.b.xg.gain.setTargetAtTime(gb, ctx.currentTime, 0.008);
    }
    applyXfader();

    // ---------- звуки пэдов / pad sounds ----------
    const padBufs = Array(8).fill(null);          // свои звуки (если подключены)
    const padNames = Array(8).fill("");
    let padSig = "", padKind = "none";
    async function padBuffer(i) {
        if (padBufs[i]) return padBufs[i];
        return synthBuffer(ctx, SYNTH[i].id);
    }
    function padLabel(i) {
        if (padBufs[i]) return padNames[i] || `#${i + 1}`;
        return SYNTH[i].ru + "\n" + SYNTH[i].en;
    }
    async function hitSample(i) {
        if (ctx.state !== "running") ctx.resume();
        const b = await padBuffer(i);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(smpGain);
        s.start();
    }
    // заранее отрисовать встроенные звуки, чтобы первый удар был без задержки
    SYNTH.forEach((x) => synthBuffer(ctx, x.id).catch(() => {}));

    // ======================================================================
    //  Интерфейс / UI
    // ======================================================================
    const root = el("div", "ndj-root");
    const wrap = el("div", "ndj-wrap");
    root.appendChild(wrap);
    // события мыши остаются внутри пульта (не двигают холст)
    root.addEventListener("pointerdown", (e) => e.stopPropagation());
    root.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    root.addEventListener("contextmenu", (e) => { if (e.target.closest(".ndj-pad")) e.preventDefault(); });

    // ---------- шапка ----------
    const head = el("div", "ndj-head");
    head.appendChild(el("b", "", "🎧 NERON DJ"));
    const sub = el("span", "ndj-sub", T("пульт сведения: две деки, кроссфейдер, пэды", "mixing controller: two decks, crossfader, pads"));
    head.appendChild(sub);
    const xBtn = el("button", "ndj-btn", "⚙ " + T("ДЛЯ СПЕЦОВ", "EXPERT"));
    xBtn.title = T("Эквалайзер, громкость входа, кривая кроссфейдера, диапазон темпа, громкость пэдов, авто-переход",
        "EQ, input gain, crossfader curve, tempo range, pad volume, auto transition");
    const helpBtn = el("button", "ndj-btn", "📖");
    helpBtn.title = T("Помощь", "Help");
    head.appendChild(xBtn);
    head.appendChild(helpBtn);
    wrap.appendChild(head);

    const help = el("div", "ndj-help");
    help.innerHTML =
        "<b>RU:</b> Подключите треки проводами к <b>deck_a</b> и <b>deck_b</b> (Load Audio, Neron Audio Loader, Drum Machine, «Музыка»…). "
        + "Трек сразу появится на деке. Если источник необычный (например, AI-музыка), нажмите Queue один раз — трек подтянется. "
        + "<b>▶</b> играть / пауза. <b>CUE</b>: на паузе ставит точку старта, во время игры возвращает к ней. "
        + "<b>SYNC</b> подгоняет темп и удары этой деки под другую. Ползунок у джога — темп (вверх быстрее; меняет и высоту, как винил). "
        + "<b>Джог</b>: на паузе крутите — ищете место, во время игры — чуть подгоняете ускорением или торможением. "
        + "<b>Пэды</b> (3 режима, кнопки над пэдами): "
        + "<b>ТОЧКИ</b> — закладки в треке, звуков тут нет. Цифры 1–8 = пустые ячейки. Нажмите пустой пэд во время игры — он запомнит место и покажет время; потом нажатие — прыжок туда; правый клик — стереть. "
        + "<b>ЗВУКИ</b> — бочка, снейр, хлопок, хэты, гудок, лазер, сирена. <b>Свои звуки:</b> нода «Звук ×8» (до 8 файлов) → провод в <b>pad_sounds</b>: звук 1 на пэд 1, звук 2 на пэд 2… "
        + "Один Load Audio → <b>pad_sounds</b> займёт пэд 1. Пэд берёт первые 30 с звука. "
        + "<b>ПЕТЛЯ</b> — повтор 1/4…32 удара, нажмите ещё раз — выход (нужен найденный темп). "
        + "Посередине: <b>ФИЛЬТР</b> (влево — глуше, вправо — тоньше), громкость каналов и <b>кроссфейдер</b> A ↔ B. "
        + "<b>⏺ ЗАПИСЬ</b> пишет всё, что вы слышите. Потом Queue — запись выходит на <b>audio</b> (и лежит в output/Neron_DJ). "
        + "Без записи на выход идёт <b>авто-переход</b>: трек A, в конце плавно перетекает в B.<br>"
        + "<b>EN:</b> Wire tracks to <b>deck_a</b> and <b>deck_b</b> (Load Audio, Neron Audio Loader, Drum Machine, Music…). "
        + "The track shows up on the deck right away. For unusual sources (e.g. AI music) press Queue once and it loads. "
        + "<b>▶</b> play / pause. <b>CUE</b>: when paused it sets the start point, while playing it jumps back to it. "
        + "<b>SYNC</b> matches this deck's tempo and beats to the other deck. The slider by the jog is tempo (up = faster; changes pitch too, like vinyl). "
        + "<b>Jog</b>: paused — spin to find a spot; playing — nudge faster or slower. "
        + "<b>Pads</b> (3 modes, buttons above the pads): "
        + "<b>CUES</b> — bookmarks in the track, no sounds here. Numbers 1–8 = empty slots. Press an empty pad while playing — it remembers the spot and shows the time; then pressing it jumps there; right-click clears. "
        + "<b>SAMPLES</b> — kick, snare, clap, hats, horn, laser, siren. <b>Your own sounds:</b> a Sound ×8 node (up to 8 files) → wire to <b>pad_sounds</b>: sound 1 on pad 1, sound 2 on pad 2… "
        + "One Load Audio → <b>pad_sounds</b> fills pad 1. A pad uses the first 30 s of a sound. "
        + "<b>LOOP</b> — repeat 1/4…32 beats, press again to exit (needs a detected tempo). "
        + "Center: <b>FILTER</b> (left — muffled, right — thin), channel volume and the <b>crossfader</b> A ↔ B. "
        + "<b>⏺ REC</b> records everything you hear. Then Queue — the recording goes out on <b>audio</b> (and is saved in output/Neron_DJ). "
        + "With no recording the output is an <b>auto transition</b>: track A blending into B at its end.";
    wrap.appendChild(help);

    // ---------- волны ----------
    const waves = el("div", "ndj-waves");
    const waveCv = {};
    for (const id of ["a", "b"]) {
        const w = el("div", "ndj-wave");
        const cv = el("canvas");
        w.appendChild(cv);
        w.title = T("Клик — перейти в это место трека (внизу — весь трек, сверху — крупно)", "Click — jump to that spot (bottom — whole track, top — close-up)");
        w.addEventListener("pointerdown", (e) => {
            const D = decks[id];
            if (!D.buf) return;
            const r = cv.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width, y = e.clientY - r.top;
            if (y > r.height - 14) D.seek(x * D.dur());
            else D.seek(D.pos() + (x - 0.5) * ZOOM_SEC);
        });
        waves.appendChild(w);
        waveCv[id] = cv;
    }
    wrap.appendChild(waves);

    // ---------- основная часть: дека A | микшер | дека B ----------
    const main = el("div", "ndj-main");
    wrap.appendChild(main);
    const ui = {};

    function buildDeck(id) {
        const D = decks[id];
        const c = COL[id];
        const box = el("div", "ndj-deck");
        box.style.setProperty("--c", c);

        const dh = el("div", "ndj-dhead");
        dh.appendChild(el("div", "ndj-badge", id.toUpperCase()));
        const name = el("div", "ndj-name");
        dh.appendChild(name);
        const tempoLbl = el("div", "ndj-tempo");
        dh.appendChild(tempoLbl);
        box.appendChild(dh);

        const body = el("div", "ndj-body" + (id === "b" ? " rev" : ""));
        const tf = makeFader({
            vertical: true, value: S.tempo[id], min: -S.range, max: S.range, def: 0, center: true, color: c,
            title: T("Темп: вверх — быстрее, вниз — медленнее. Двойной клик — 0", "Tempo: up — faster, down — slower. Double-click — 0"),
            onChange: (v) => { S.tempo[id] = v; D.applyRate(); paintDeckHead(id); },
            onEnd: () => saveState(),
        });
        body.appendChild(tf.el);
        const jw = el("div", "ndj-jogw");
        const jog = el("canvas", "ndj-jog");
        jog.title = T("Джог: на паузе — поиск места, во время игры — подгонка (быстрее/медленнее)",
            "Jog: paused — find a spot, playing — nudge faster/slower");
        jw.appendChild(jog);
        body.appendChild(jw);
        box.appendChild(body);

        // джог: вращение мышью
        let jdrag = null;
        const angleOf = (e) => {
            const r = jog.getBoundingClientRect();
            return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
        };
        const turn = (da) => {
            if (!D.buf) return;
            if (D.playing) {
                D.bend = clamp(D.bend + da * 0.9, -0.6, 0.6);
                D.applyRate();
            } else {
                D.seek(D.pos() + da / (2 * Math.PI) * SEC_PER_REV);
            }
        };
        jog.addEventListener("pointerdown", (e) => {
            e.preventDefault(); e.stopPropagation();
            jog.setPointerCapture(e.pointerId);
            jdrag = { a: angleOf(e) };
        });
        jog.addEventListener("pointermove", (e) => {
            if (!jdrag) return;
            const a = angleOf(e);
            let da = a - jdrag.a;
            if (da > Math.PI) da -= 2 * Math.PI;
            if (da < -Math.PI) da += 2 * Math.PI;
            jdrag.a = a;
            turn(da);
        });
        const jend = () => { jdrag = null; };
        jog.addEventListener("pointerup", jend);
        jog.addEventListener("pointercancel", jend);
        jog.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); turn((e.deltaY < 0 ? 1 : -1) * 0.12); }, { passive: false });

        // транспорт
        const tr = el("div", "ndj-trans");
        const syncB = el("button", "ndj-btn", "SYNC");
        syncB.style.background = "var(--nt-acc,#6b4fb3)"; syncB.style.color = "#111";
        syncB.title = T("Подогнать темп и удары под другую деку", "Match tempo and beats to the other deck");
        const cueB = el("button", "ndj-btn", "CUE");
        cueB.style.background = "#8a6a1f";
        cueB.title = T("На паузе — поставить точку старта. Во время игры — вернуться к ней и остановиться",
            "Paused — set the start point. Playing — jump back to it and stop");
        const playB = el("button", "ndj-btn", "▶");
        playB.title = T("Играть / пауза", "Play / pause");
        tr.appendChild(syncB); tr.appendChild(cueB); tr.appendChild(playB);
        box.appendChild(tr);
        syncB.addEventListener("click", () => doSync(id));
        cueB.addEventListener("click", () => {
            if (!D.buf) return setStatus(T("Сначала подключите трек к deck_" + id, "Wire a track to deck_" + id + " first"), true);
            const cc = S.cues[id];
            if (D.playing) { D.pause(); D.seek(cc.main); }
            else { cc.main = D.pos(); saveState(); setStatus(T(`Дека ${id.toUpperCase()}: точка старта ${fmtFine(cc.main)}`, `Deck ${id.toUpperCase()}: start point ${fmtFine(cc.main)}`)); }
        });
        playB.addEventListener("click", () => {
            if (!D.buf) return setStatus(T("Сначала подключите трек к deck_" + id, "Wire a track to deck_" + id + " first"), true);
            if (D.playing) D.pause(); else D.play();
        });

        // режимы пэдов
        const modes = el("div", "ndj-modes");
        const modeBtns = {};
        for (const [m, ru, en, tip] of [
            ["cue", "ТОЧКИ", "CUES", T("Пэд запоминает место в треке и прыгает туда", "A pad remembers a spot and jumps there")],
            ["smp", "ЗВУКИ", "SAMPLES", T("Пэды играют звуки поверх музыки", "Pads play sounds over the music")],
            ["loop", "ПЕТЛЯ", "LOOP", T("Пэд зацикливает кусок: 1/4 … 32 удара", "A pad loops a piece: 1/4 … 32 beats")],
        ]) {
            const b = el("button", "", `${ru} / ${en}`);
            b.title = tip;
            b.addEventListener("click", () => { S.mode[id] = m; saveState(); paintPads(id); });
            modes.appendChild(b);
            modeBtns[m] = b;
        }
        box.appendChild(modes);

        const pads = el("div", "ndj-pads");
        const padEls = [];
        for (let i = 0; i < 8; i++) {
            const p = el("div", "ndj-pad");
            p.addEventListener("pointerdown", (e) => {
                e.preventDefault(); e.stopPropagation();
                padPress(id, i, e.button === 2 || e.shiftKey);
            });
            pads.appendChild(p);
            padEls.push(p);
        }
        box.appendChild(pads);

        ui[id] = { box, name, tempoLbl, tf, jog, syncB, cueB, playB, modeBtns, padEls };
        return box;
    }

    function flash(p) {
        p.classList.add("hit");
        setTimeout(() => p.classList.remove("hit"), 110);
    }

    function padPress(id, i, clear) {
        const D = decks[id];
        const p = ui[id].padEls[i];
        const mode = S.mode[id];
        if (mode === "smp") {
            hitSample(i).catch((e) => setStatus(T("Звук пэда не сыграл: ", "Pad sound failed: ") + e, true));
            flash(p);
            return;
        }
        if (!D.buf) return setStatus(T("Сначала подключите трек к deck_" + id, "Wire a track to deck_" + id + " first"), true);
        if (mode === "cue") {
            const cc = S.cues[id];
            if (clear) { cc.pts[i] = null; saveState(); paintPads(id); return; }
            if (cc.pts[i] === null) {
                cc.pts[i] = D.pos(); saveState();
            } else {
                D.seek(cc.pts[i]);
                if (!D.playing) D.play();
            }
            flash(p);
            paintPads(id);
            return;
        }
        if (mode === "loop") {
            if (D.loopIdx === i) { D.exitLoop(); paintPads(id); return; }
            if (!D.ana || !D.ana.bpm) return setStatus(T("Темп этого трека не найден — петля не может встать по ударам", "This track's tempo was not found — the loop can't snap to beats"), true);
            if (D.loop) D.exitLoop();
            if (D.setLoop(LOOP_BEATS[i], i) && !D.playing) D.play();
            paintPads(id);
        }
    }

    function paintPads(id) {
        const u = ui[id], D = decks[id], mode = S.mode[id];
        for (const [m, b] of Object.entries(u.modeBtns)) b.classList.toggle("on", m === mode);
        u.padEls.forEach((p, i) => {
            p.style.setProperty("--p", PAD_COLORS[i]);
            let lit = false, txt = "";
            if (mode === "cue") {
                const t = S.cues[id].pts[i];
                lit = t !== null;
                txt = lit ? fmtFine(t) : `${i + 1}`;
                p.title = lit ? T("Прыжок сюда · правый клик — стереть", "Jump here · right-click — clear") : T("Запомнить текущее место", "Remember the current spot");
            } else if (mode === "smp") {
                lit = true;
                txt = padLabel(i);
                p.title = padBufs[i] ? T("Ваш звук: ", "Your sound: ") + padNames[i] : T("Встроенный звук", "Built-in sound");
            } else {
                lit = D.loopIdx === i;
                txt = LOOP_NAMES[i];
                p.title = T(`Петля ${LOOP_NAMES[i]} удара · ещё раз — выход`, `Loop ${LOOP_NAMES[i]} beat · press again to exit`);
            }
            p.textContent = txt;
            p.style.whiteSpace = "pre-line";
            p.classList.toggle("lit", lit);
        });
    }

    function paintDeckHead(id) {
        const u = ui[id], D = decks[id];
        if (D.loading) {
            u.name.innerHTML = "";
            u.name.appendChild(document.createTextNode(T("загружаю…", "loading…")));
        } else if (D.buf) {
            u.name.innerHTML = "";
            u.name.appendChild(document.createTextNode(D.label));
            const sm = el("small", "", `${fmtTime(D.dur())}` + (D.ana && D.ana.bpm ? ` · ${D.ana.known ? "" : "≈"}${D.ana.bpm.toFixed(1)} BPM` : " · BPM ?"));
            u.name.appendChild(sm);
        } else {
            u.name.innerHTML = "";
            u.name.appendChild(document.createTextNode(D.err || (D.srcKind === "queue"
                ? T("нажмите Queue один раз — трек появится", "press Queue once — the track will appear")
                : T(`подключите трек к deck_${id}`, `wire a track to deck_${id}`))));
        }
        const pct = S.tempo[id];
        u.tempoLbl.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%\n±${S.range}`;
        u.tempoLbl.style.whiteSpace = "pre";
    }

    function paintTransport() {
        for (const id of ["a", "b"]) {
            const u = ui[id];
            if (!u) continue;
            const D = decks[id];
            u.playB.textContent = D.playing ? "❚❚" : "▶";
            u.playB.style.background = D.playing ? "#3fa34d" : "";
        }
    }

    function doSync(id) {
        const D = decks[id], O = other(id);
        if (!D.buf || !O.buf) return setStatus(T("Для SYNC нужны треки на обеих деках", "SYNC needs tracks on both decks"), true);
        if (!D.ana?.bpm || !O.ana?.bpm) return setStatus(T("Темп одного из треков не найден — SYNC не сработает", "One track's tempo was not found — SYNC can't work"), true);
        let target = O.ana.bpm * O.baseRate();
        let rate = target / D.ana.bpm;
        // темп вдвое больше/меньше — берём ближайший к 1
        if (rate > 1.45) { target /= 2; rate = target / D.ana.bpm; }
        if (rate < 0.69) { target *= 2; rate = target / D.ana.bpm; }
        let pct = (rate - 1) * 100;
        if (Math.abs(pct) > S.range) {
            const r = RANGES.find((x) => x >= Math.abs(pct));
            if (!r) return setStatus(T("Темпы слишком разные для SYNC", "The tempos are too far apart for SYNC"), true);
            S.range = r; refreshRange();
        }
        S.tempo[id] = pct;
        ui[id].tf.set(pct);
        D.applyRate();
        // удары: подвинуть эту деку, чтобы удар совпал с ударом другой
        if (D.playing && O.playing) {
            const bD = 60 / D.ana.bpm, bO = 60 / O.ana.bpm;
            const phO = (((O.pos() - O.ana.offset) / bO) % 1 + 1) % 1;
            const phD = (((D.pos() - D.ana.offset) / bD) % 1 + 1) % 1;
            let diff = phO - phD;
            if (diff > 0.5) diff -= 1;
            if (diff < -0.5) diff += 1;
            D.seek(D.pos() + diff * bD);
        }
        paintDeckHead(id);
        saveState();
        setStatus(T(`Дека ${id.toUpperCase()} подогнана: ${(D.ana.bpm * D.baseRate()).toFixed(1)} BPM`, `Deck ${id.toUpperCase()} synced: ${(D.ana.bpm * D.baseRate()).toFixed(1)} BPM`));
    }

    // ---------- микшер ----------
    const mix = el("div", "ndj-mix");
    const knob = (o) => makeKnob({ step: 0.01, def: 0, min: -1, max: 1, bipolar: true, fmt: (v) => (v === 0 ? "0" : (v > 0 ? "+" : "") + Math.round(v * 100) + "%"), ...o });

    const xp = el("div", "ndj-xp");
    const eqKnobs = { a: {}, b: {} };
    for (const [e, ru, en] of [["trim", "ВХОД", "GAIN"], ["hi", "ВЕРХ", "HI"], ["mid", "СЕР", "MID"], ["lo", "НИЗ", "LOW"]]) {
        const r = el("div", "ndj-row");
        for (const id of ["a", "b"]) {
            const k = knob({
                label: "", value: S.eq[id][e], color: COL[id],
                title: e === "trim" ? T(`Громкость входа деки ${id.toUpperCase()} (±12 дБ)`, `Deck ${id.toUpperCase()} input gain (±12 dB)`)
                    : T(`${ru} деки ${id.toUpperCase()}: влево до нуля, вправо +6 дБ`, `Deck ${id.toUpperCase()} ${en}: left kills, right +6 dB`),
                onChange: (v) => { S.eq[id][e] = v; decks[id].applyMix(); },
                onEnd: () => saveState(),
            });
            eqKnobs[id][e] = k;
            r.appendChild(k);
            if (id === "a") r.appendChild(el("span", "ndj-lbl", T(ru, en)));
        }
        xp.appendChild(r);
    }
    // кривая кроссфейдера, диапазон темпа, громкость пэдов, авто-переход
    const xr1 = el("div", "ndj-row");
    const curveSel = el("select", "ndj-sel");
    for (const [v, t] of [["smooth", T("плавно", "smooth")], ["cut", T("резко (скретч)", "sharp (scratch)")]]) { const o = el("option", "", t); o.value = v; curveSel.appendChild(o); }
    curveSel.title = T("Кривая кроссфейдера", "Crossfader curve");
    curveSel.value = S.curve;
    curveSel.addEventListener("change", () => { S.curve = curveSel.value; applyXfader(); saveState(); });
    curveSel.addEventListener("pointerdown", (e) => e.stopPropagation());
    xr1.appendChild(el("span", "ndj-lbl", T("КРОССФЕЙДЕР", "XFADER")));
    xr1.appendChild(curveSel);
    xp.appendChild(xr1);
    const xr2 = el("div", "ndj-row");
    const rangeSel = el("select", "ndj-sel");
    for (const r of RANGES) { const o = el("option", "", `±${r}%`); o.value = String(r); rangeSel.appendChild(o); }
    rangeSel.title = T("Диапазон ползунков темпа", "Tempo slider range");
    rangeSel.addEventListener("change", () => { S.range = Number(rangeSel.value); refreshRange(); saveState(); });
    rangeSel.addEventListener("pointerdown", (e) => e.stopPropagation());
    xr2.appendChild(el("span", "ndj-lbl", T("ДИАПАЗОН ТЕМПА", "TEMPO RANGE")));
    xr2.appendChild(rangeSel);
    xp.appendChild(xr2);
    const xr3 = el("div", "ndj-krow");
    const smpK = makeKnob({
        label: T("ПЭДЫ", "PADS"), value: S.smp, min: 0, max: 1.5, def: 0.8, step: 0.01, color: COL.acc,
        title: T("Громкость звуков пэдов", "Pad sounds volume"), fmt: (v) => Math.round(v * 100) + "%",
        onChange: (v) => { S.smp = v; smpGain.gain.setTargetAtTime(v, ctx.currentTime, 0.01); }, onEnd: () => saveState(),
    });
    const xfK = makeKnob({
        label: T("АВТО, с", "AUTO, s"), value: S.xfade, min: 0, max: 60, def: 8, step: 0.5, color: COL.acc,
        title: T("Авто-переход (выход без записи): сколько секунд A и B звучат вместе", "Auto transition (output with no recording): how many seconds A and B overlap"),
        fmt: (v) => v.toFixed(1) + " " + T("с", "s"), wheel: 1,
        onChange: (v) => { S.xfade = v; paintOut(); }, onEnd: () => saveState(),
    });
    xr3.appendChild(smpK); xr3.appendChild(xfK);
    xp.appendChild(xr3);
    mix.appendChild(xp);

    // фильтры
    const fr = el("div", "ndj-row");
    const filtK = {};
    for (const id of ["a", "b"]) {
        filtK[id] = knob({
            label: "", value: S.filt[id], color: COL[id],
            title: T(`Фильтр деки ${id.toUpperCase()}: влево — глуше (только низ), вправо — тоньше (только верх)`,
                `Deck ${id.toUpperCase()} filter: left — muffled (lows only), right — thin (highs only)`),
            onChange: (v) => { S.filt[id] = v; decks[id].applyMix(); },
            onEnd: () => saveState(),
        });
        fr.appendChild(filtK[id]);
        if (id === "a") fr.appendChild(el("span", "ndj-lbl", T("ФИЛЬТР", "FILTER")));
    }
    mix.appendChild(fr);

    // громкость каналов и мастер
    const fd = el("div", "ndj-faders");
    const meters = {};
    const chF = {};
    const mkCol = (children) => { const c = el("div", "ndj-fcol"); children.forEach((x) => c.appendChild(x)); return c; };
    for (const id of ["a", "b"]) {
        const m = el("canvas", "ndj-meter");
        meters[id] = m;
        chF[id] = makeFader({
            vertical: true, value: S.vol[id], min: 0, max: 1, color: COL[id],
            title: T(`Громкость деки ${id.toUpperCase()}`, `Deck ${id.toUpperCase()} volume`),
            onChange: (v) => { S.vol[id] = v; decks[id].applyMix(); }, onEnd: () => saveState(),
        });
        chF[id].el.style.flex = "1";
    }
    const mm = el("canvas", "ndj-meter");
    mm.style.width = "18px"; mm.style.flex = "1";
    const masterK = makeKnob({
        label: T("ОБЩАЯ", "MASTER"), value: S.master, min: 0, max: 1.5, def: 0.9, step: 0.01, color: "#b9bdc6",
        title: T("Общая громкость (и в записи тоже)", "Master volume (also in the recording)"), fmt: (v) => Math.round(v * 100) + "%",
        onChange: (v) => { S.master = v; master.gain.setTargetAtTime(v, ctx.currentTime, 0.01); }, onEnd: () => saveState(),
    });
    fd.appendChild(mkCol([el("span", "ndj-lbl", "A"), chF.a.el]));
    fd.appendChild(meters.a);
    fd.appendChild(mkCol([masterK, mm]));
    fd.appendChild(meters.b);
    fd.appendChild(mkCol([el("span", "ndj-lbl", "B"), chF.b.el]));
    mix.appendChild(fd);

    // кроссфейдер
    const xfRow = el("div", "ndj-row");
    const xfa = el("span", "ndj-lbl", "A"); xfa.style.color = COL.a;
    const xfb = el("span", "ndj-lbl", "B"); xfb.style.color = COL.b;
    const xfader = makeFader({
        vertical: false, value: S.xf, min: -1, max: 1, def: 0, center: true, color: COL.acc,
        title: T("Кроссфейдер: влево — слышно A, вправо — B, посередине — обе. Двойной клик — середина",
            "Crossfader: left — A, right — B, middle — both. Double-click — center"),
        onChange: (v) => { S.xf = v; applyXfader(); }, onEnd: () => saveState(),
    });
    xfader.el.style.flex = "1";
    xfRow.appendChild(xfa); xfRow.appendChild(xfader.el); xfRow.appendChild(xfb);
    mix.appendChild(xfRow);
    mix.appendChild(el("div", "ndj-lbl", T("КРОССФЕЙДЕР", "CROSSFADER")));

    // запись
    const recB = el("button", "ndj-rec", "⏺ " + T("ЗАПИСЬ", "REC"));
    recB.title = T("Записать всё, что вы слышите. Нажмите ещё раз — стоп. Потом Queue — запись выйдет на audio",
        "Record everything you hear. Press again to stop. Then Queue — the recording goes to audio");
    mix.appendChild(recB);
    const out = el("div", "ndj-out");
    const outTxt = el("span");
    const outClr = el("button", "", "✖");
    outClr.title = T("Забыть запись (выход снова — авто-переход). Файл останется в output/Neron_DJ",
        "Forget the recording (output goes back to auto transition). The file stays in output/Neron_DJ");
    out.appendChild(outTxt); out.appendChild(outClr);
    mix.appendChild(out);
    outClr.addEventListener("click", () => { S.rec = null; saveState(); paintOut(); });

    main.appendChild(buildDeck("a"));
    main.appendChild(mix);
    main.appendChild(buildDeck("b"));

    const status = el("div", "ndj-status");
    wrap.appendChild(status);
    let statusT = null;
    function setStatus(text, err) {
        status.textContent = text || "";
        status.classList.toggle("err", !!err);
        clearTimeout(statusT);
        if (text) statusT = setTimeout(() => { status.textContent = ""; status.classList.remove("err"); }, 6000);
    }

    function paintOut() {
        if (rec.on) { outTxt.textContent = T("Идёт запись…", "Recording…"); outClr.style.display = "none"; return; }
        if (S.rec) {
            outTxt.innerHTML = "";
            outTxt.appendChild(document.createTextNode(T("Выход: запись ", "Output: recording ")));
            const b = el("b", "", `${S.rec.name} (${fmtTime(S.rec.seconds || 0)})`);
            b.style.color = "var(--nt-bright,#fff)";
            outTxt.appendChild(b);
            outClr.style.display = "";
        } else {
            outTxt.textContent = T(`Выход: авто-переход A → B (${S.xfade.toFixed(1)} с). Запишите сет ⏺ — выйдет он.`,
                `Output: auto transition A → B (${S.xfade.toFixed(1)} s). Record a set ⏺ — it goes out instead.`);
            outClr.style.display = "none";
        }
    }

    function refreshRange() {
        rangeSel.value = String(S.range);
        for (const id of ["a", "b"]) {
            S.tempo[id] = clamp(S.tempo[id], -S.range, S.range);
            const old = ui[id].tf.el;
            const nf = makeFader({
                vertical: true, value: S.tempo[id], min: -S.range, max: S.range, def: 0, center: true, color: COL[id],
                title: old.title,
                onChange: (v) => { S.tempo[id] = v; decks[id].applyRate(); paintDeckHead(id); },
                onEnd: () => saveState(),
            });
            old.replaceWith(nf.el);
            ui[id].tf = nf;
            decks[id].applyRate();
            paintDeckHead(id);
        }
    }

    // ---------- для спецов ----------
    const paintExpert = () => {
        const on = node.properties && node.properties.neron_expert === true;
        xp.style.display = on ? "flex" : "none";
        xBtn.classList.toggle("on", on);
        relayout();
    };
    xBtn.addEventListener("click", () => {
        node.properties = node.properties || {};
        node.properties.neron_expert = !(node.properties.neron_expert === true);
        paintExpert();
    });
    helpBtn.addEventListener("click", () => {
        help.style.display = help.style.display === "block" ? "none" : "block";
        relayout();
    });

    // ======================================================================
    //  Запись сета / Set recording
    // ======================================================================
    const rec = { on: false, busy: false, id: "", part: 0, pend: [], pendBytes: 0, q: Promise.resolve(), err: "", frames: 0, t0: 0, r: null, stopWait: null };
    function newId() {
        const a = new Uint8Array(12);
        crypto.getRandomValues(a);
        return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
    }
    function sendPending() {
        if (!rec.pendBytes) return;
        const total = rec.pendBytes;
        const buf = new Uint8Array(total);
        let o = 0;
        for (const p of rec.pend) { buf.set(new Uint8Array(p.buffer), o); o += p.byteLength; }
        rec.pend = []; rec.pendBytes = 0;
        const part = rec.part++, id = rec.id;
        rec.q = rec.q.then(async () => {
            if (rec.err) return;
            const r = await api.fetchApi(`/neron/dj_rec_part?id=${id}&part=${part}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: buf });
            if (!r.ok) {
                let msg = "HTTP " + r.status;
                try { msg = (await r.json()).error || msg; } catch (e) { /* ок */ }
                throw new Error(msg);
            }
        }).catch((e) => { rec.err = String(e.message || e); });
    }
    function onRecData(l, r) {
        const n = l.length;
        const pcm = new Int16Array(n * 2);
        for (let i = 0; i < n; i++) {
            pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767)));
            pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767)));
        }
        rec.frames += n;
        rec.pend.push(pcm);
        rec.pendBytes += pcm.byteLength;
        if (rec.pendBytes >= 2 * 1024 * 1024) sendPending();
        if (rec.err && rec.on) { setStatus(T("Запись прервана: ", "Recording stopped: ") + rec.err, true); stopRec(true); }
    }
    async function startRec() {
        if (rec.busy) return;
        if (ctx.state !== "running") await ctx.resume();
        if (!rec.r) {
            rec.r = await makeRecorderNode(ctx, onRecData, () => { if (rec.stopWait) { const f = rec.stopWait; rec.stopWait = null; f(); } });
            limiter.connect(rec.r.node);
            const z = ctx.createGain(); z.gain.value = 0;
            rec.r.node.connect(z); z.connect(ctx.destination);
        }
        Object.assign(rec, { on: true, id: newId(), part: 0, pend: [], pendBytes: 0, q: Promise.resolve(), err: "", frames: 0, t0: performance.now() });
        rec.r.start();
        recB.classList.add("on");
        paintOut();
        setStatus(T("Запись пошла — играйте! Нажмите ⏺ ещё раз, чтобы закончить", "Recording — play! Press ⏺ again to finish"));
    }
    async function stopRec(failed) {
        if (!rec.on) return;
        rec.on = false;
        rec.busy = true;
        recB.classList.remove("on");
        recB.textContent = "… " + T("СОХРАНЯЮ", "SAVING");
        await new Promise((res) => { rec.stopWait = res; rec.r.stop(); setTimeout(() => { if (rec.stopWait) { rec.stopWait = null; res(); } }, 1500); });
        sendPending();
        await rec.q;
        try {
            if (failed || rec.err) throw new Error(rec.err || "stopped");
            if (rec.frames < ctx.sampleRate * 0.5) throw new Error(T("слишком короткая запись", "recording too short"));
            const r = await api.fetchApi("/neron/dj_rec_done", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: rec.id, sr: ctx.sampleRate, name: saveNameW ? saveNameW.value : "neron_dj_set" }),
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error || "HTTP " + r.status);
            S.rec = d.rec;
            if (djWidget) djWidget.value = JSON.stringify(S);
            setStatus(T(`Сет записан: ${d.rec.name} (${fmtTime(d.rec.seconds)}). Нажмите Queue — он выйдет на audio`,
                `Set recorded: ${d.rec.name} (${fmtTime(d.rec.seconds)}). Press Queue — it goes out on audio`));
        } catch (e) {
            setStatus(T("Запись не сохранилась: ", "Recording not saved: ") + (e.message || e), true);
        }
        rec.busy = false;
        recB.textContent = "⏺ " + T("ЗАПИСЬ", "REC");
        paintOut();
    }
    recB.addEventListener("click", () => {
        if (rec.busy) return;
        if (rec.on) stopRec(false);
        else startRec().catch((e) => setStatus(T("Запись не запустилась: ", "Recording failed to start: ") + e, true));
    });

    // ======================================================================
    //  Треки по проводам / Tracks by wire
    // ======================================================================
    function getLink(id) {
        const g = node.graph;
        if (!g || !g.links) return null;
        return g.links instanceof Map ? g.links.get(id) : g.links[id];
    }
    function upstreamOf(inputName) {
        const inp = (node.inputs || []).find((x) => x.name === inputName);
        if (!inp || inp.link === null || inp.link === undefined) return null;
        let id = inp.link;
        for (let hop = 0; hop < 6; hop++) {
            const link = getLink(id);
            if (!link) return null;
            const o = node.graph.getNodeById(link.origin_id);
            if (!o) return null;
            if (o.type === "Reroute") {
                const i0 = o.inputs && o.inputs[0];
                if (i0 && i0.link !== null && i0.link !== undefined) { id = i0.link; continue; }
                return null;
            }
            return o;
        }
        return null;
    }

    async function fetchSpec(spec) {
        const r = await api.fetchApi("/neron/preview_wav", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec) });
        if (!r.ok) throw new Error((await r.text()) || "HTTP " + r.status);
        return ctx.decodeAudioData(await r.arrayBuffer());
    }
    async function fetchView(f) {
        const q = `/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || "")}&type=${encodeURIComponent(f.type || "temp")}&t=${Date.now()}`;
        const r = await api.fetchApi(q);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return ctx.decodeAudioData(await r.arrayBuffer());
    }
    function sumBuffers(bufs) {
        if (bufs.length === 1) return bufs[0];
        const len = Math.max(...bufs.map((b) => b.length));
        const out = ctx.createBuffer(2, len, bufs[0].sampleRate);
        for (const b of bufs) {
            for (let c = 0; c < 2; c++) {
                const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
                const dst = out.getChannelData(c);
                for (let i = 0; i < src.length; i++) dst[i] += src[i];
            }
        }
        return out;
    }

    let loadSeq = { a: 0, b: 0, p: 0 };
    async function checkDeck(id) {
        const D = decks[id];
        const o = upstreamOf("deck_" + id);
        let sig, info = null;
        if (!o) sig = "none";
        else {
            info = describeSource(o);
            sig = info.specs.length ? "spec:" + JSON.stringify(info.specs) : (info.empty ? "empty:" + o.id : "queue:" + o.id);
        }
        if (sig === D.srcSig) return;
        D.srcSig = sig;
        const seq = ++loadSeq[id];
        if (!o || (info && info.empty)) {
            D.unload(); D.srcKind = "none";
            if (info && info.empty) D.err = T("в загрузчике не выбран файл", "no file chosen in the loader");
            paintDeckHead(id); paintPads(id);
            return;
        }
        if (!info.specs.length) {
            // необычный источник: звук приходит после Queue
            if (D.srcKind !== "queue" || !D.buf) { D.unload(); }
            D.srcKind = "queue";
            paintDeckHead(id);
            return;
        }
        D.srcKind = "spec";
        D.loading = true; D.err = "";
        paintDeckHead(id);
        try {
            const specs = info.multi ? info.specs.slice(0, 1) : info.specs;
            const bufs = await Promise.all(specs.map(fetchSpec));
            if (seq !== loadSeq[id]) return;
            D.loading = false;
            D.setBuffer(sumBuffers(bufs), info.label, info.bpm || 0, sig);
        } catch (e) {
            if (seq !== loadSeq[id]) return;
            D.loading = false;
            D.unload();
            D.err = T("не загрузился: ", "failed to load: ") + String(e.message || e).slice(0, 120);
        }
        paintDeckHead(id); paintPads(id); paintTransport();
    }

    async function checkPads() {
        const o = upstreamOf("pad_sounds");
        let sig, info = null;
        if (!o) sig = "none";
        else {
            info = describeSource(o);
            sig = info.specs.length ? "spec:" + JSON.stringify(info.specs) : "queue:" + o.id;
        }
        if (sig === padSig) return;
        padSig = sig;
        const seq = ++loadSeq.p;
        padBufs.fill(null); padNames.fill("");
        if (!o) { padKind = "none"; paintPads("a"); paintPads("b"); return; }
        if (!info.specs.length) { padKind = "queue"; paintPads("a"); paintPads("b"); return; }
        padKind = "spec";
        const specs = info.specs.slice(0, 8);
        const res = await Promise.allSettled(specs.map(fetchSpec));
        if (seq !== loadSeq.p) return;
        res.forEach((r, i) => {
            if (r.status === "fulfilled") {
                padBufs[i] = r.value;
                padNames[i] = String(specs[i].name || info.label || "").replace(/\.[^.]+$/, "").slice(0, 14);
            }
        });
        paintPads("a"); paintPads("b");
    }

    function onExecuted(msg) {
        const list = msg && msg.neron_dj;
        if (!Array.isArray(list)) return;
        for (const f of list) {
            if (f.deck === "a" || f.deck === "b") {
                const D = decks[f.deck];
                if (D.srcKind !== "queue") continue;
                const seq = ++loadSeq[f.deck];
                D.loading = true; paintDeckHead(f.deck);
                fetchView(f).then((buf) => {
                    if (seq !== loadSeq[f.deck]) return;
                    D.loading = false;
                    const o = upstreamOf("deck_" + f.deck);
                    D.setBuffer(buf, o ? (o.title || o.type) : "deck " + f.deck, 0, D.srcSig + "@" + Math.round(buf.duration * 100));
                    paintDeckHead(f.deck); paintPads(f.deck); paintTransport();
                }).catch((e) => { D.loading = false; D.err = T("не загрузился: ", "failed to load: ") + e; paintDeckHead(f.deck); });
            } else if (/^pad\d$/.test(f.deck) && padKind === "queue") {
                const i = Number(f.deck.slice(3));
                fetchView(f).then((buf) => { padBufs[i] = buf; padNames[i] = `#${i + 1}`; paintPads("a"); paintPads("b"); }).catch(() => {});
            }
        }
    }

    // ======================================================================
    //  Рисование / Drawing
    // ======================================================================
    // цвета для рисования (джоги, волны) — из темы: переменные --nt-* (их задаёт Neron Theme)
    const PAL = { t: 0 };
    const toRgb = (str, fb) => {
        str = String(str || "").trim();
        let m = /^#([0-9a-f]{6})$/i.exec(str);
        if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
        m = /^#([0-9a-f]{3})$/i.exec(str);
        if (m) return m[1].split("").map((x) => parseInt(x + x, 16));
        m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(str);
        if (m) return [+m[1], +m[2], +m[3]];
        return fb;
    };
    function pal() {
        const now = performance.now();
        if (now - PAL.t < 500) return PAL;
        PAL.t = now;
        const cs = getComputedStyle(root);
        const v = (k, fb) => toRgb(cs.getPropertyValue("--nt-" + k), fb);
        PAL.well = v("well", [11, 12, 16]); PAL.card = v("card", [34, 37, 45]); PAL.line = v("line", [44, 47, 55]);
        PAL.input = v("input", [21, 23, 28]); PAL.muted = v("muted", [139, 144, 160]); PAL.text = v("text", [207, 210, 216]);
        PAL.bright = v("bright", [255, 255, 255]);
        return PAL;
    }
    const css = (rgb, a = 1) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    const shade = (rgb, k) => rgb.map((x) => Math.max(0, Math.min(255, Math.round(x * k))));
    // глубже фона: на тёмной теме — темнее, на светлой — чуть-чуть
    const deep = (rgb) => shade(rgb, (rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11) > 140 ? 0.96 : 0.8);

    function fitCanvas(cv) {
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth, h = cv.clientHeight;
        if (!w || !h) return null;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const g = cv.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { g, w, h };
    }

    function drawJog(id) {
        const D = decks[id], u = ui[id];
        const f = fitCanvas(u.jog);
        if (!f) return;
        const { g, w } = f;
        const c = COL[id];
        const cx = w / 2, cy = w / 2, r = w / 2 - 3;
        g.clearRect(0, 0, w, w);
        // корпус
        const P = pal();
        g.fillStyle = css(P.well);
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = css(P.line); g.lineWidth = 2; g.stroke();
        // прогресс трека
        const dur = D.dur(), pos = D.pos();
        g.lineWidth = 4; g.lineCap = "round";
        g.strokeStyle = css(P.input);
        g.beginPath(); g.arc(cx, cy, r - 6, 0, Math.PI * 2); g.stroke();
        if (dur > 0) {
            g.strokeStyle = c;
            g.beginPath(); g.arc(cx, cy, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pos / dur, 0, 1)); g.stroke();
            // точки (cue) на кольце
            S.cues[id].pts.forEach((t, i) => {
                if (t === null) return;
                const a = -Math.PI / 2 + Math.PI * 2 * (t / dur);
                g.fillStyle = PAD_COLORS[i];
                g.beginPath(); g.arc(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6), 3, 0, Math.PI * 2); g.fill();
            });
        }
        // вращающаяся пластина
        const ang = (pos / SEC_PER_REV) * Math.PI * 2;
        const pr = r * 0.82;
        const grad = g.createRadialGradient(cx, cy, pr * 0.2, cx, cy, pr);
        grad.addColorStop(0, css(P.card)); grad.addColorStop(1, css(shade(P.card, 0.7)));
        g.fillStyle = grad;
        g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = css(P.text, 0.05); g.lineWidth = 1;
        for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(cx, cy, pr * (0.55 + k * 0.08), 0, Math.PI * 2); g.stroke(); }
        for (let k = 0; k < 16; k++) {
            const a = ang + k * Math.PI / 8;
            g.fillStyle = D.playing ? (k === 0 ? css(P.bright) : css(P.text, 0.22)) : (k === 0 ? css(P.text) : css(P.text, 0.12));
            g.beginPath(); g.arc(cx + Math.cos(a) * pr * 0.9, cy + Math.sin(a) * pr * 0.9, k === 0 ? 3.2 : 1.6, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = D.playing ? css(P.bright) : css(P.muted); g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * pr * 0.52, cy + Math.sin(ang) * pr * 0.52); g.lineTo(cx + Math.cos(ang) * pr * 0.84, cy + Math.sin(ang) * pr * 0.84); g.stroke();
        // экран в центре
        const ir = r * 0.48;
        g.fillStyle = css(deep(P.well));
        g.beginPath(); g.arc(cx, cy, ir, 0, Math.PI * 2); g.fill();
        g.strokeStyle = D.loop ? COL.loop : c; g.lineWidth = D.playing ? 2.5 : 1.5;
        if (D.playing) { g.shadowColor = D.loop ? COL.loop : c; g.shadowBlur = 10; }
        g.stroke();
        g.shadowBlur = 0;
        g.textAlign = "center"; g.textBaseline = "middle";
        const fs = Math.max(9, ir * 0.36);
        if (D.buf) {
            const bpm = D.ana && D.ana.bpm ? D.ana.bpm * D.rate : 0;
            g.fillStyle = css(P.bright);
            g.font = `800 ${fs}px "Segoe UI",Arial,sans-serif`;
            g.fillText(bpm ? bpm.toFixed(1) : "—", cx, cy - fs * 0.35);
            g.fillStyle = css(P.muted);
            g.font = `700 ${fs * 0.42}px "Segoe UI",Arial,sans-serif`;
            g.fillText("BPM", cx, cy + fs * 0.25);
            g.fillStyle = D.loop ? COL.loop : c;
            g.font = `800 ${fs * 0.5}px "Segoe UI",Arial,sans-serif`;
            g.fillText(D.loop ? `LOOP ${LOOP_NAMES[D.loopIdx]}` : `-${fmtTime(Math.max(0, dur - pos))}`, cx, cy + fs * 0.85);
        } else {
            g.fillStyle = css(P.muted, 0.7);
            g.font = `800 ${fs * 0.9}px "Segoe UI",Arial,sans-serif`;
            g.fillText(id.toUpperCase(), cx, cy - fs * 0.2);
            g.font = `700 ${fs * 0.36}px "Segoe UI",Arial,sans-serif`;
            g.fillText(D.loading ? T("ЗАГРУЗКА", "LOADING") : T("НЕТ ТРЕКА", "NO TRACK"), cx, cy + fs * 0.55);
        }
    }

    const overviewCache = { a: null, b: null };
    function drawWave(id) {
        const D = decks[id];
        const f = fitCanvas(waveCv[id]);
        if (!f) return;
        const { g, w, h } = f;
        const c = COL[id];
        g.clearRect(0, 0, w, h);
        const P = pal();
        const zh = h - 15;
        g.fillStyle = css(deep(P.well));
        g.fillRect(0, 0, w, zh);
        g.fillStyle = c;
        g.font = `900 11px "Segoe UI",Arial,sans-serif`;
        g.textAlign = "left"; g.textBaseline = "top";
        if (!D.buf || !D.ana) {
            g.fillStyle = css(P.muted, 0.8);
            g.fillText(id.toUpperCase() + "  ·  " + (D.loading ? T("загружаю…", "loading…") : T(`подключите трек к deck_${id}`, `wire a track to deck_${id}`)), 8, 6);
            g.fillStyle = css(P.input); g.fillRect(0, zh + 2, w, 13);
            return;
        }
        const a = D.ana, pos = D.pos(), dur = D.dur();
        const pxs = w / ZOOM_SEC;
        const t0 = pos - ZOOM_SEC / 2;
        // петля
        if (D.loop) {
            g.fillStyle = "rgba(29,209,161,.16)";
            g.fillRect((D.loop.start - t0) * pxs, 0, (D.loop.end - D.loop.start) * pxs, zh);
        }
        // сетка ударов
        if (a.bpm) {
            const bl = 60 / a.bpm;
            const k0 = Math.floor((t0 - a.offset) / bl), k1 = Math.ceil((t0 + ZOOM_SEC - a.offset) / bl);
            for (let k = k0; k <= k1; k++) {
                const x = (a.offset + k * bl - t0) * pxs;
                g.fillStyle = ((k % 4) + 4) % 4 === 0 ? css(P.text, 0.28) : css(P.text, 0.08);
                g.fillRect(Math.round(x), 0, 1, zh);
            }
        }
        // крупная волна
        const mid = zh / 2;
        for (let x = 0; x < w; x++) {
            const t = t0 + x / pxs;
            if (t < 0 || t > dur) continue;
            const i0 = Math.floor(t * a.pps), i1 = Math.max(i0 + 1, Math.floor((t + 1 / pxs) * a.pps));
            let p = 0;
            for (let i = i0; i < i1 && i < a.peaks.length; i++) if (a.peaks[i] > p) p = a.peaks[i];
            const hh = Math.max(1, Math.min(1, p) * (zh / 2 - 3));
            g.fillStyle = t < pos ? css(P.text, 0.35) : c;
            g.fillRect(x, mid - hh, 1, hh * 2);
        }
        // точки (cue)
        S.cues[id].pts.forEach((t, i) => {
            if (t === null) return;
            const x = (t - t0) * pxs;
            if (x < -6 || x > w + 6) return;
            g.fillStyle = PAD_COLORS[i];
            g.fillRect(Math.round(x), 0, 2, zh);
            g.beginPath(); g.moveTo(x - 4, 0); g.lineTo(x + 6, 0); g.lineTo(x + 1, 6); g.fill();
        });
        // центр (где играет)
        g.fillStyle = css(P.bright);
        g.fillRect(Math.round(w / 2) - 1, 0, 2, zh);
        g.fillStyle = c;
        g.fillText(id.toUpperCase(), 6, 4);
        // весь трек
        const oy = zh + 2, oh = 13;
        let ov = overviewCache[id];
        const ovKey = P.input.join(",");
        if (!ov || ov.w !== w || ov.ana !== a || ov.key !== ovKey) {
            const oc = document.createElement("canvas");
            oc.width = w; oc.height = oh;
            const og = oc.getContext("2d");
            og.fillStyle = css(P.input); og.fillRect(0, 0, w, oh);
            og.fillStyle = c;
            const per = a.peaks.length / w;
            for (let x = 0; x < w; x++) {
                let p = 0;
                for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) if (a.peaks[i] > p) p = a.peaks[i];
                const hh = Math.max(0.5, Math.min(1, p) * (oh / 2 - 1));
                og.fillRect(x, oh / 2 - hh, 1, hh * 2);
            }
            ov = overviewCache[id] = { w, ana: a, cv: oc, key: ovKey };
        }
        g.drawImage(ov.cv, 0, oy, w, oh);
        const px = dur > 0 ? (pos / dur) * w : 0;
        g.fillStyle = "rgba(0,0,0,.45)";
        g.fillRect(0, oy, px, oh);
        g.fillStyle = css(P.bright);
        g.fillRect(Math.round(px), oy, 2, oh);
    }

    // ======================================================================
    //  Жизнь пульта / Main loop
    // ======================================================================
    let disposed = false, raf = 0, pollT = null;
    function frame() {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        if (!root.isConnected || root.offsetParent === null) return;
        for (const id of ["a", "b"]) {
            const D = decks[id];
            if (Math.abs(D.bend) > 0.001) { D.bend *= 0.86; if (Math.abs(D.bend) < 0.002) D.bend = 0; D.applyRate(); }
            // если петля была, а трек уже ушёл дальше (сдвинули темп) — синхронизируем позицию
            drawJog(id);
            drawWave(id);
            const now = performance.now();
            meterStep(D.mL, peakOf(D.meter.aL), now);
            meterStep(D.mR, peakOf(D.meter.aR), now);
            drawMeter(meters[id], D.mL, D.mR, true);
        }
        const now = performance.now();
        meterStep(mmL, peakOf(masterMeter.aL), now);
        meterStep(mmR, peakOf(masterMeter.aR), now);
        drawMeter(mm, mmL, mmR, true);
        if (rec.on) recB.textContent = "⏹ " + T("СТОП", "STOP") + "  " + fmtTime(rec.frames / ctx.sampleRate);
    }
    const mmL = {}, mmR = {};

    let sizer = null;
    function relayout() {
        if (sizer) { sizer.fit(); sizer.apply(); }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }

    const domWidget = node.addDOMWidget("neron_dj", "neron_dj", root, { serialize: false, hideOnZoom: false });
    sizer = makeUserSized(node, domWidget, root, { minH: 220, autoH: () => Math.max(300, wrap.offsetHeight + 22) });

    paintDeckHead("a"); paintDeckHead("b");
    paintPads("a"); paintPads("b");
    paintTransport();
    paintOut();
    paintExpert();
    rangeSel.value = String(S.range);

    const wanted = node.computeSize ? node.computeSize() : [1180, 700];
    node.setSize([Math.max(wanted[0], 1180), Math.max(wanted[1], 700)]);

    function poll() {
        checkDeck("a"); checkDeck("b"); checkPads();
    }
    pollT = setInterval(poll, 700);
    setTimeout(poll, 50);
    raf = requestAnimationFrame(frame);

    node.neronDJExecuted = onExecuted;
    node.neronDJReload = () => {
        loadState();
        for (const id of ["a", "b"]) {
            for (const e of ["trim", "hi", "mid", "lo"]) eqKnobs[id][e].setValue(S.eq[id][e]);
            filtK[id].setValue(S.filt[id]);
            chF[id].set(S.vol[id]);
            decks[id].applyMix();
        }
        xfader.set(S.xf); applyXfader();
        masterK.setValue(S.master); master.gain.value = S.master;
        smpK.setValue(S.smp); smpGain.gain.value = S.smp;
        xfK.setValue(S.xfade);
        curveSel.value = S.curve;
        refreshRange();
        decks.a.srcSig = ""; decks.b.srcSig = ""; padSig = "";
        paintPads("a"); paintPads("b"); paintOut(); paintExpert();
        poll();
    };
    node.neronDJDispose = () => {
        disposed = true;
        cancelAnimationFrame(raf);
        clearInterval(pollT);
        if (rec.on) stopRec(false);
        for (const id of ["a", "b"]) { decks[id].unload(); try { decks[id].xg.disconnect(); } catch (e) { /* ок */ } }
        try { smpGain.disconnect(); master.disconnect(); limiter.disconnect(); } catch (e) { /* ок */ }
    };
}

app.registerExtension({
    name: "NeronAudio.DJPultUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronDJPult") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupDJ(this);
            return r;
        };
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (msg) {
            const r = onExecuted ? onExecuted.apply(this, arguments) : undefined;
            if (this.neronDJExecuted) this.neronDJExecuted(msg);
            return r;
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const self = this;
            setTimeout(() => { if (self.neronDJReload) self.neronDJReload(); }, 0);
            return r;
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDJDispose) this.neronDJDispose();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
