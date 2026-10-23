import { app } from "../../scripts/app.js";

// ============================================================================
//  Neron Dancer
//  Героиня слушает звук Neron-нод (драм-машина, пианоролл, микшер, загрузчик
//  звука) и танцует под него. Никуда не подключается.
//
//  Как она слышит: при загрузке страницы мы "подслушиваем" вывод звука страницы
//  (AudioNode.connect -> destination) и ставим на него анализатор. Звук при этом
//  не меняется, анализатор только смотрит на уровни.
//
//  Как танцует: по ударам она определяет темп музыки и двигается в такт плавно
//  (пружины и инерция), а не дёргается от каждого скачка звука.
// ============================================================================

const PANEL_H = 450;

// ---------- подслушивание звука страницы ----------

const taps = new Map();   // AudioContext -> { analyser, data }

function getTap(ctx) {
    let t = taps.get(ctx);
    if (!t) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        t = { analyser, data: new Uint8Array(analyser.frequencyBinCount), ctx };
        taps.set(ctx, t);
    }
    return t;
}

(function installTap() {
    if (typeof AudioNode === "undefined" || AudioNode.prototype.__neronTapInstalled) return;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
        const r = orig.apply(this, arguments);
        try {
            if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode && !this.__neronTapped) {
                this.__neronTapped = true;
                orig.call(this, getTap(this.context).analyser);
            }
        } catch (e) { /* подслушивание не должно ничего ломать */ }
        return r;
    };
    AudioNode.prototype.__neronTapInstalled = true;
})();

// низкие / средние / высокие частоты и общий уровень (0..1) по всем звучащим контекстам
function readLevels() {
    let bass = 0, mid = 0, high = 0, level = 0;
    for (const t of taps.values()) {
        if (t.ctx.state !== "running") continue;
        t.analyser.getByteFrequencyData(t.data);
        const d = t.data;
        const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += d[i]; return s / (b - a) / 255; };
        bass = Math.max(bass, avg(0, 3));
        mid = Math.max(mid, avg(3, 25));
        high = Math.max(high, avg(25, 120));
        level = Math.max(level, avg(0, 120), bass * 0.9);
    }
    return { bass, mid, high, level };
}

// ---------- палитры ----------

const PALETTES = {
    "розовая": { hair: "#ffa3cf", hair2: "#e66fae", eye: "#b45be0", eye2: "#6a2a9a", outfit: "#ff7fa8", shirt: "#fff8fb", accent: "#ffd6e8" },
    "голубая": { hair: "#8bd8ff", hair2: "#4fb1ec", eye: "#3f7bf2", eye2: "#173f9a", outfit: "#58aefc", shirt: "#f4fbff", accent: "#cdeeff" },
    "сиреневая": { hair: "#c1aaff", hair2: "#8f74e8", eye: "#ff7fb2", eye2: "#b83a72", outfit: "#9a78ff", shirt: "#f9f6ff", accent: "#e4dbff" },
    "рыжая": { hair: "#ffa766", hair2: "#e0742c", eye: "#3dbd78", eye2: "#17703f", outfit: "#ff8750", shirt: "#fff9f2", accent: "#ffdcc3" },
    "серебро": { hair: "#eef1f8", hair2: "#b6c0d8", eye: "#46cfe0", eye2: "#1b7f90", outfit: "#63708f", shirt: "#f6f8fc", accent: "#d3dcee" },
};

const SVG_NS = "http://www.w3.org/2000/svg";

function buildMarkup(u) {
    const SKIN = "#ffe4d3", SKIN2 = "#f4c3ab", LINE = "#d99c86";
    return `
<svg viewBox="0 0 300 430" xmlns="${SVG_NS}" style="width:100%;height:100%;display:block">
  <defs>
    <radialGradient id="glow${u}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.9"/>
      <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"/>
    </radialGradient>
    <linearGradient id="hair${u}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--hair)"/>
      <stop offset="100%" style="stop-color:var(--hair2)"/>
    </linearGradient>
    <linearGradient id="eye${u}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--eye2)"/>
      <stop offset="55%" style="stop-color:var(--eye)"/>
      <stop offset="100%" style="stop-color:var(--accent)"/>
    </linearGradient>
    <linearGradient id="skin${u}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${SKIN2}"/>
      <stop offset="45%" stop-color="${SKIN}"/>
      <stop offset="100%" stop-color="${SKIN}"/>
    </linearGradient>
  </defs>
  <circle class="glow" cx="150" cy="215" r="140" fill="url(#glow${u})" opacity="0.25"/>
  <ellipse class="shadow" cx="150" cy="406" rx="58" ry="8" fill="#000" opacity="0.3"/>
  <g class="body" transform="translate(150 405)">

    <!-- длинные волосы сзади -->
    <g class="hairBack" transform="translate(0 -300)">
      <path d="M -36 -46 C -52 -4 -52 52 -44 92 C -34 118 -12 124 0 118 C 12 124 34 118 44 92 C 52 52 52 -4 36 -46 Z" fill="url(#hair${u})"/>
      <path d="M -22 -10 C -28 30 -26 70 -20 104 M 22 -10 C 28 30 26 70 20 104 M 0 0 C -2 40 0 80 0 112" fill="none" stroke="var(--hair2)" stroke-width="1.6" opacity="0.45"/>
    </g>

    <!-- ноги -->
    <g class="legL" transform="translate(-12 -180)">
      <path d="M -10.5 -4 C -12.5 28 -11.5 60 -8.5 86 L 8.5 86 C 11.5 60 12.5 28 10.5 -4 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.8"/>
      <g class="shinL" transform="translate(0 86)">
        <path d="M -8.5 -1 C -9 20 -8.5 50 -6 78 L 6 78 C 8.5 50 9 20 8.5 -1 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.8"/>
        <path d="M -8.8 14 C -9.2 36 -8.6 56 -6.3 74 L 6.3 74 C 8.6 56 9.2 36 8.8 14 Z" fill="var(--shirt)"/>
        <rect x="-9" y="14" width="18" height="5" rx="2.2" fill="var(--outfit)"/>
        <path d="M -7 70 L 7 70 C 9 80 19 84 21 90 C 21 93 -9 93 -10 90 C -10 84 -8 78 -7 70 Z" fill="#4a3f63" stroke="#2f2744" stroke-width="0.8"/>
        <path d="M -7 70 L 7 70 L 6 74 L -6 74 Z" fill="var(--outfit)"/>
      </g>
    </g>
    <g class="legR" transform="translate(12 -180)">
      <path d="M -10.5 -4 C -12.5 28 -11.5 60 -8.5 86 L 8.5 86 C 11.5 60 12.5 28 10.5 -4 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.8" transform="scale(-1 1)"/>
      <g class="shinR" transform="translate(0 86)">
        <path d="M -8.5 -1 C -9 20 -8.5 50 -6 78 L 6 78 C 8.5 50 9 20 8.5 -1 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.8" transform="scale(-1 1)"/>
        <path d="M -8.8 14 C -9.2 36 -8.6 56 -6.3 74 L 6.3 74 C 8.6 56 9.2 36 8.8 14 Z" fill="var(--shirt)"/>
        <rect x="-9" y="14" width="18" height="5" rx="2.2" fill="var(--outfit)"/>
        <g transform="scale(-1 1)">
          <path d="M -7 70 L 7 70 C 9 80 19 84 21 90 C 21 93 -9 93 -10 90 C -10 84 -8 78 -7 70 Z" fill="#4a3f63" stroke="#2f2744" stroke-width="0.8"/>
          <path d="M -7 70 L 7 70 L 6 74 L -6 74 Z" fill="var(--outfit)"/>
        </g>
      </g>
    </g>

    <!-- юбка -->
    <g class="skirt" transform="translate(0 -200)">
      <path d="M -19 -2 L 19 -2 C 26 20 38 48 52 78 C 30 90 -30 90 -52 78 C -38 48 -26 20 -19 -2 Z" fill="var(--outfit)"/>
      <path d="M -10 0 L -30 86 M 0 0 L 0 90 M 10 0 L 30 86 M -20 0 L -46 82 M 20 0 L 46 82" stroke="#000" stroke-width="1" opacity="0.12" fill="none"/>
      <path d="M -52 78 C -30 90 30 90 52 78 L 51 72 C 30 83 -30 83 -51 72 Z" fill="var(--shirt)"/>
    </g>

    <!-- верхняя часть -->
    <g class="torso" transform="translate(0 -208)">
      <path d="M -16.5 2 C -18 -14 -22 -30 -22.5 -44 C -23 -56 -26 -62 -29 -68 L -12 -77 L 12 -77 L 29 -68 C 26 -62 23 -56 22.5 -44 C 22 -30 18 -14 16.5 2 Z" fill="var(--shirt)" stroke="${LINE}" stroke-width="0.6"/>
      <path d="M -17 4 C -18 -3 -17.5 -8 -17 -12 L 17 -12 C 17.5 -8 18 -3 17 4 Z" fill="var(--outfit)"/>
      <rect x="-6" y="-92" width="12" height="18" rx="5" fill="url(#skin${u})"/>
      <path d="M -29 -68 L -12 -77 L 0 -64 L 12 -77 L 29 -68 L 20 -58 L 0 -50 L -20 -58 Z" fill="var(--outfit)"/>
      <path d="M -12 -77 L 0 -64 L 12 -77" fill="none" stroke="var(--shirt)" stroke-width="2"/>
      <path d="M 0 -52 L -11 -44 C -13 -50 -13 -58 -9 -60 Z M 0 -52 L 11 -44 C 13 -50 13 -58 9 -60 Z" fill="var(--accent)" stroke="${LINE}" stroke-width="0.5"/>
      <circle cx="0" cy="-52" r="3" fill="var(--outfit)"/>

      <!-- руки -->
      <g class="armL" transform="translate(-30 -66)">
        <path d="M -6.2 -3 C -8 14 -7 34 -5 52 L 5 52 C 7 34 8 14 6.2 -3 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
        <ellipse cx="0" cy="3" rx="11" ry="10" fill="var(--shirt)" stroke="${LINE}" stroke-width="0.5"/>
        <g class="foreL" transform="translate(0 50)">
          <path d="M -5 -1 C -6 16 -5 32 -3.5 46 L 3.5 46 C 5 32 6 16 5 -1 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
          <ellipse cx="0" cy="52" rx="5.6" ry="8" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
          <ellipse cx="-4.2" cy="49" rx="2.2" ry="4.4" fill="${SKIN}" stroke="${LINE}" stroke-width="0.5" transform="rotate(25 -4.2 49)"/>
        </g>
      </g>
      <g class="armR" transform="translate(30 -66)">
        <g transform="scale(-1 1)">
          <path d="M -6.2 -3 C -8 14 -7 34 -5 52 L 5 52 C 7 34 8 14 6.2 -3 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
          <ellipse cx="0" cy="3" rx="11" ry="10" fill="var(--shirt)" stroke="${LINE}" stroke-width="0.5"/>
        </g>
        <g class="foreR" transform="translate(0 50)">
          <g transform="scale(-1 1)">
            <path d="M -5 -1 C -6 16 -5 32 -3.5 46 L 3.5 46 C 5 32 6 16 5 -1 Z" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
            <ellipse cx="0" cy="52" rx="5.6" ry="8" fill="url(#skin${u})" stroke="${LINE}" stroke-width="0.7"/>
            <ellipse cx="-4.2" cy="49" rx="2.2" ry="4.4" fill="${SKIN}" stroke="${LINE}" stroke-width="0.5" transform="rotate(25 -4.2 49)"/>
          </g>
        </g>
      </g>

      <!-- голова -->
      <g class="head" transform="translate(0 -81)">
        <path d="M -31 -44 C -36 -102 36 -102 31 -44 Z" fill="url(#hair${u})"/>
        <ellipse cx="-24" cy="-44" rx="3.6" ry="6.5" fill="${SKIN}" stroke="${LINE}" stroke-width="0.6"/>
        <ellipse cx="24" cy="-44" rx="3.6" ry="6.5" fill="${SKIN}" stroke="${LINE}" stroke-width="0.6"/>
        <path d="M -24.5 -46 C -24.5 -26 -13 -12 0 -10.5 C 13 -12 24.5 -26 24.5 -46 C 24.5 -70 -24.5 -70 -24.5 -46 Z" fill="${SKIN}" stroke="${LINE}" stroke-width="0.7"/>
        <ellipse cx="-16" cy="-26" rx="6.2" ry="3.2" fill="#ff8fa3" opacity="0.45"/>
        <ellipse cx="16" cy="-26" rx="6.2" ry="3.2" fill="#ff8fa3" opacity="0.45"/>
        <g class="brows" fill="none" stroke="var(--hair2)" stroke-width="1.7" stroke-linecap="round">
          <path d="M -18 -56 Q -11 -59.5 -5 -57"/>
          <path d="M 5 -57 Q 11 -59.5 18 -56"/>
        </g>
        <g class="eyes">
          <g transform="translate(-11.5 -40)">
            <path d="M -8.6 -2 C -8.4 -9.5 8.4 -9.5 8.6 -2 C 8.4 6 -8.4 6 -8.6 -2 Z" fill="#fff"/>
            <ellipse cx="0" cy="0.8" rx="6.3" ry="8.4" fill="url(#eye${u})"/>
            <ellipse cx="0" cy="1.6" rx="2.7" ry="4.2" fill="#2a1f3a"/>
            <circle cx="-2.4" cy="-3" r="2.5" fill="#fff"/>
            <circle cx="2.6" cy="4" r="1.2" fill="#fff" opacity="0.9"/>
            <path d="M -9.4 -2.5 C -8 -10.5 8 -10.5 9.4 -2.5" fill="none" stroke="#2a1f3a" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M -9.4 -2.5 L -12 -5" stroke="#2a1f3a" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M -6 6 Q 0 8.5 6 6" fill="none" stroke="#2a1f3a" stroke-width="0.7" opacity="0.6"/>
          </g>
          <g transform="translate(11.5 -40)">
            <path d="M -8.6 -2 C -8.4 -9.5 8.4 -9.5 8.6 -2 C 8.4 6 -8.4 6 -8.6 -2 Z" fill="#fff"/>
            <ellipse cx="0" cy="0.8" rx="6.3" ry="8.4" fill="url(#eye${u})"/>
            <ellipse cx="0" cy="1.6" rx="2.7" ry="4.2" fill="#2a1f3a"/>
            <circle cx="-2.4" cy="-3" r="2.5" fill="#fff"/>
            <circle cx="2.6" cy="4" r="1.2" fill="#fff" opacity="0.9"/>
            <path d="M -9.4 -2.5 C -8 -10.5 8 -10.5 9.4 -2.5" fill="none" stroke="#2a1f3a" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M 9.4 -2.5 L 12 -5" stroke="#2a1f3a" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M -6 6 Q 0 8.5 6 6" fill="none" stroke="#2a1f3a" stroke-width="0.7" opacity="0.6"/>
          </g>
        </g>
        <g class="eyesHappy" style="display:none" fill="none" stroke="#2a1f3a" stroke-width="2.6" stroke-linecap="round">
          <path d="M -19 -37 Q -11.5 -49 -4 -37"/>
          <path d="M 4 -37 Q 11.5 -49 19 -37"/>
        </g>
        <path d="M -1 -29 Q 0.5 -27.5 2 -29" fill="none" stroke="${LINE}" stroke-width="1.2" stroke-linecap="round"/>
        <path class="mouth" d="M -4.5 -20 Q 0 -17.5 4.5 -20" fill="#c25663" stroke="#8a3340" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>

        <!-- чёлка и боковые пряди -->
        <path d="M -29 -46 C -33 -94 33 -94 29 -46 C 27 -58 22 -65 14 -70 C 11 -59 3 -52 -6 -53.5 C -9 -61 -14 -67 -20 -71 C -26 -63 -29 -55 -29 -46 Z" fill="url(#hair${u})"/>
        <path d="M -29 -46 C -33 -26 -36 4 -32 36 C -30 44 -24 42 -24 34 C -24 10 -22 -16 -24.5 -40 Z" fill="url(#hair${u})"/>
        <path d="M 29 -46 C 33 -26 36 4 32 36 C 30 44 24 42 24 34 C 24 10 22 -16 24.5 -40 Z" fill="url(#hair${u})"/>
        <path d="M -20 -80 C -8 -90 12 -90 22 -78" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.35" stroke-linecap="round"/>
        <path d="M 14 -70 C 18 -60 20 -52 20 -46 M -20 -71 C -17 -62 -15 -56 -14 -50" fill="none" stroke="var(--hair2)" stroke-width="1.1" opacity="0.5"/>
        <!-- бант в волосах -->
        <g transform="translate(-24 -70) rotate(-18)">
          <path d="M 0 0 L -12 -7 C -14 -2 -14 3 -12 7 Z M 0 0 L 12 -7 C 14 -2 14 3 12 7 Z" fill="var(--outfit)" stroke="var(--shirt)" stroke-width="1"/>
          <circle cx="0" cy="0" r="3.2" fill="var(--accent)" stroke="var(--shirt)" stroke-width="0.8"/>
        </g>
      </g>
    </g>
  </g>
  <g class="notes"></g>
</svg>`;
}

function injectStyles() {
    if (document.getElementById("neron-dancer-styles2")) return;
    const s = document.createElement("style");
    s.id = "neron-dancer-styles2";
    s.textContent = `
.nd-root{box-sizing:border-box;width:100%;height:${PANEL_H}px;border-radius:10px;overflow:hidden;position:relative;
  background:linear-gradient(180deg,#232634 0%,#1a1c26 100%);cursor:pointer;user-select:none}
.nd-root .nd-hint{position:absolute;left:0;right:0;bottom:6px;text-align:center;font:10px "Segoe UI",Arial,sans-serif;color:#7b8096;pointer-events:none}
`;
    document.head.appendChild(s);
}

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function setupDancer(node) {
    injectStyles();
    const getWidget = (n) => (node.widgets || []).find((x) => x.name === n);
    const palW = getWidget("palette");
    const enW = getWidget("energy");

    const uid = String(node.id || 0) + "_" + Math.floor(Math.random() * 1e6);
    const root = document.createElement("div");
    root.className = "nd-root";
    root.innerHTML = buildMarkup(uid);
    const hint = document.createElement("div");
    hint.className = "nd-hint";
    hint.textContent = "включите любую Neron-ноду, и она станцует · клик по ней - поздороваться";
    root.appendChild(hint);
    const svg = root.querySelector("svg");
    const q = (c) => svg.querySelector("." + c);
    const P = {};
    for (const k of ["glow", "shadow", "body", "hairBack", "legL", "legR", "shinL", "shinR", "skirt", "torso", "armL", "armR", "foreL", "foreR",
        "head", "eyes", "eyesHappy", "mouth", "notes", "brows"]) P[k] = q(k);
    for (const k of ["hairBack", "legL", "legR", "shinL", "shinR", "skirt", "torso", "armL", "armR", "foreL", "foreR", "head"]) {
        P[k].__base = P[k].getAttribute("transform") || "";
    }

    function applyPalette() {
        const name = palW ? palW.value : "розовая";
        const p = PALETTES[name] || PALETTES["розовая"];
        for (const [k, v] of Object.entries(p)) root.style.setProperty("--" + k, v);
    }
    applyPalette();
    if (palW) {
        const orig = palW.callback;
        palW.callback = function () {
            const r = orig ? orig.apply(this, arguments) : undefined;
            applyPalette();
            return r;
        };
    }

    // ---------- состояние ----------
    const st = {
        raf: null, t: 0, last: performance.now(),
        bass: 0, mid: 0, high: 0, level: 0, slow: 0, act: 0,
        avgBass: 0, prevBass: 0, lastBeat: 0, beats: [], period: 0.52,
        phase: 0, count: 0, pulse: 0,
        blink: 0, nextBlink: 2, wave: 0, notes: [], springs: {},
    };

    // пружина: значение плавно догоняет цель (инерция, без рывков)
    function spr(name, target, w, dt) {
        const s = st.springs[name] || (st.springs[name] = { x: target, v: 0 });
        const n = Math.max(1, Math.ceil(dt * w / 0.5));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
            s.v += (w * w * (target - s.x) - 2 * w * s.v) * h;
            s.x += s.v * h;
        }
        return s.x;
    }
    const rot = (g, a) => g.setAttribute("transform", g.__base + ` rotate(${a.toFixed(2)} 0 0)`);

    function spawnNote(x, y) {
        const e = document.createElementNS(SVG_NS, "text");
        e.textContent = Math.random() < 0.5 ? "♪" : "♫";
        e.setAttribute("font-size", String(16 + Math.random() * 10));
        e.setAttribute("fill", getComputedStyle(root).getPropertyValue("--hair") || "#ff8fc4");
        e.setAttribute("font-family", "Segoe UI Symbol, Arial, sans-serif");
        P.notes.appendChild(e);
        st.notes.push({ e, x, y, vx: (Math.random() - 0.5) * 24, vy: -34 - Math.random() * 24, life: 1 });
    }

    function onBeat(now) {
        // темп музыки: медиана последних интервалов между ударами
        if (st.lastBeat) {
            let iv = (now - st.lastBeat) / 1000;
            while (iv > 1.15) iv /= 2;
            if (iv >= 0.26) {
                st.beats.push(iv);
                if (st.beats.length > 8) st.beats.shift();
                const sorted = st.beats.slice().sort((a, b) => a - b);
                const med = sorted[Math.floor(sorted.length / 2)];
                st.period += (med - st.period) * 0.25;
            }
        }
        st.lastBeat = now;
        st.pulse = 1;
        // подстраиваем фазу танца под удар (мягко, без скачка)
        const err = st.phase < 0.5 ? -st.phase : 1 - st.phase;
        st.phase += err * 0.35;
        if (Math.random() < 0.4) spawnNote(150 + (Math.random() - 0.5) * 140, 80 + Math.random() * 30);
    }

    function frame(now) {
        st.raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const dt = Math.min(0.05, (now - st.last) / 1000);
        st.last = now;
        st.t += dt;
        const t = st.t;
        const E = clampN(enW ? Number(enW.value) || 1 : 1, 0.2, 2);

        // ---- звук ----
        const lv = readLevels();
        const k = 1 - Math.exp(-dt * 16);
        st.bass += (lv.bass - st.bass) * k;
        st.mid += (lv.mid - st.mid) * k;
        st.high += (lv.high - st.high) * k;
        st.level += (lv.level - st.level) * k;
        // медленный уровень: быстро нарастает, плавно затихает
        const tau = lv.level > st.slow ? 0.25 : 0.9;
        st.slow += (lv.level - st.slow) * (1 - Math.exp(-dt / tau));

        st.avgBass += (st.bass - st.avgBass) * (1 - Math.exp(-dt * 2.2));
        const beat = st.bass > 0.3 && st.bass > st.avgBass * 1.22 + 0.04 && st.bass - st.prevBass > 0.01 && (now - st.lastBeat) > 230;
        st.prevBass = st.bass;
        if (beat) onBeat(now);
        st.pulse = Math.max(0, st.pulse - dt * 3);

        const playing = st.slow > 0.05;
        st.act += ((playing ? 1 : 0) - st.act) * (1 - Math.exp(-dt * (playing ? 2.2 : 1.4)));
        const A = st.act;
        // интенсивность танца: зависит от громкости, но меняется медленно
        const I = clampN(A * (0.75 + 0.85 * clampN(st.slow * 2.2, 0, 1)) * E, 0, 1.7);

        // ---- такт: фаза идёт сама в найденном темпе ----
        if (!playing) st.beats.length = 0;
        st.phase += dt / st.period;
        if (st.phase >= 1) { st.phase -= 1; st.count++; }
        const ph = st.phase;
        const psi = (ph + (st.count & 1)) / 2;        // фаза на два удара (шаг влево - шаг вправо)
        const s1 = Math.sin(TAU * ph);
        const s2 = Math.sin(TAU * psi);
        const bar = st.count % 8;
        const armsUp = bar >= 5 ? 1 : 0;              // раз в 8 ударов - обе руки вверх

        // ---- движения (цели), потом плавное догоняние пружинами ----
        const idleSway = Math.sin(t * 0.9) * 1.4 * (1 - A * 0.6);
        const sway = spr("sway", s2 * 9 * I + idleSway, 9, dt);
        const dip = spr("dip", (0.5 + 0.5 * Math.cos(TAU * ph)) * 10 * I - st.pulse * 7 * I + Math.sin(t * 1.7) * 0.8 * (1 - A), 12, dt);
        const bodyX = spr("bx", s2 * 10 * I, 8, dt);
        const breathe = Math.sin(t * 1.8) * 0.004 * (1 - A * 0.5);

        P.body.setAttribute("transform", `translate(${(150 + bodyX).toFixed(2)} ${(405 + dip).toFixed(2)}) scale(1 ${(1 + breathe).toFixed(4)})`);
        P.shadow.setAttribute("rx", (58 - dip * 0.5).toFixed(1));
        P.glow.setAttribute("opacity", (0.16 + A * (0.18 + st.slow * 0.6) + st.pulse * 0.1 * A).toFixed(3));
        P.glow.setAttribute("r", (130 + st.pulse * 8 * A + st.slow * 14).toFixed(1));

        rot(P.torso, -sway * 0.55);
        rot(P.skirt, sway * 0.9);
        const headTilt = spr("ht", Math.sin(TAU * psi + 0.7) * 11 * I + (st.wave > 0 ? 6 : 0), 8, dt);
        const headNod = spr("hn", -s1 * 1.6 * I, 10, dt);
        rot(P.head, headTilt + headNod + sway * 0.4);

        // руки
        const wave = st.wave > 0 ? Math.sin(t * 9) * 16 : 0;
        const sL = spr("sL", 7 + I * (40 + 34 * s2) + armsUp * 130 * Math.min(1, I * 1.4), 7, dt);
        let rTarget = 7 + I * (40 - 34 * s2) + armsUp * 130 * Math.min(1, I * 1.4);
        if (st.wave > 0) rTarget = 150;
        const sR = spr("sR", rTarget, 8, dt);
        rot(P.armL, clampN(sL, 0, 175));
        rot(P.armR, -clampN(sR, 0, 175));
        const fL = spr("fL", -(5 + I * (22 + 24 * (0.5 + 0.5 * Math.sin(TAU * ph + 0.5)))), 9, dt);
        const fR = spr("fR", 5 + I * (22 + 24 * (0.5 + 0.5 * Math.sin(TAU * ph + 2.1))) + (st.wave > 0 ? wave : 0), 9, dt);
        rot(P.foreL, fL);
        rot(P.foreR, fR);

        // ноги: шаг в сторону и обратно
        const lift = Math.max(0, s2), liftR = Math.max(0, -s2);
        rot(P.legL, spr("tL", 1.5 + lift * 16 * I, 10, dt));
        rot(P.legR, -spr("tR", 1.5 + liftR * 16 * I, 10, dt));
        rot(P.shinL, -spr("kL", lift * 24 * I + (dip * 1.1), 11, dt));
        rot(P.shinR, spr("kR", liftR * 24 * I + (dip * 1.1), 11, dt));

        // волосы запаздывают за движением (пружинка помягче)
        const hairA = spr("hair", -sway * 1.8 - bodyX * 1.0 + Math.sin(TAU * psi + 1.6) * 2.2 * I + Math.sin(t * 1.3) * 0.8, 5.5, dt);
        rot(P.hairBack, hairA);

        // глаза
        st.nextBlink -= dt;
        if (st.nextBlink <= 0) { st.blink = 0.13; st.nextBlink = 2 + Math.random() * 3; }
        if (st.blink > 0) st.blink -= dt;
        const happy = (I > 0.6 && Math.sin(t * 0.7) > 0.25) || st.wave > 0;
        P.eyes.style.display = happy ? "none" : "";
        P.eyesHappy.style.display = happy ? "" : "none";
        P.eyes.setAttribute("transform", st.blink > 0 ? "translate(0 -40) scale(1 0.1) translate(0 40)" : "");

        // рот: открывается по громкости (плавно)
        const open = spr("mouth", clampN(st.slow * 1.4 * A + st.pulse * 0.15 * A, 0, 0.9), 12, dt);
        const y0 = -20;
        P.mouth.setAttribute("d", open < 0.14
            ? `M -4.5 ${y0} Q 0 ${y0 + 2.5} 4.5 ${y0}`
            : `M -5 ${y0} Q 0 ${(y0 + 3 + open * 12).toFixed(1)} 5 ${y0} Q 0 ${y0 - 1.5} -5 ${y0} Z`);

        if (st.wave > 0) st.wave -= dt;

        // нотки
        for (let i = st.notes.length - 1; i >= 0; i--) {
            const n = st.notes[i];
            n.life -= dt * 0.5;
            n.x += n.vx * dt; n.y += n.vy * dt;
            n.e.setAttribute("x", n.x.toFixed(1));
            n.e.setAttribute("y", n.y.toFixed(1));
            n.e.setAttribute("opacity", Math.max(0, n.life).toFixed(2));
            if (n.life <= 0) { n.e.remove(); st.notes.splice(i, 1); }
        }
    }

    root.addEventListener("pointerdown", (e) => { st.wave = 1.8; e.stopPropagation(); });

    const dom = node.addDOMWidget("neron_dancer", "neron_dancer", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => PANEL_H,
        getMaxHeight: () => PANEL_H,
    });
    dom.computeSize = (width) => [width, PANEL_H];

    const wanted = node.computeSize ? node.computeSize() : [300, 200];
    node.setSize([Math.max(wanted[0], 300), Math.max(wanted[1], PANEL_H + 90)]);

    st.raf = requestAnimationFrame(frame);
    node.neronDisposeDancer = () => { if (st.raf) cancelAnimationFrame(st.raf); st.raf = null; };
    node.neronDancerState = st;
}

app.registerExtension({
    name: "NeronAudio.DancerUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronDancer") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupDancer(this);
            return r;
        };

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const self = this;
            setTimeout(() => {
                const w = (self.widgets || []).find((x) => x.name === "palette");
                if (w && typeof w.callback === "function") { try { w.callback(w.value); } catch (e) { /* ок */ } }
            }, 0);
            return r;
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDisposeDancer) this.neronDisposeDancer();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
