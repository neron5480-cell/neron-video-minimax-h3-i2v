import { app } from "../../scripts/app.js";

// ============================================================================
//  Neron Theme / Тема 🎨
//  RU: Нода-«настройка»: ни к чему не подключается. Есть на столе — ноды Neron в теме
//      (Графит / Neron Brown / Неон), а с «живостью» по рамкам бегут огоньки, по проводам —
//      искры, на ударах музыки всё вспыхивает. Нет ноды — обычный серый вид.
//  EN: A "settings" node, not wired to anything. On the canvas — Neron nodes take the theme
//      (Graphite / Neron Brown / Neon); with "life" on, lights run along the frames, sparks
//      along the wires and everything flashes on the beat. No node — the plain grey look.
// ============================================================================

const NODE = "NeronTheme";
const T = (ru, en) => `${ru} / ${en}`;

// ноды студии и их «семья» (цвет кубика)
const FAMILY = {
    NeronVideoCube: "video", NeronVideoSampler: "video", NeronVideoCombine: "video",
    NeronSoundCube: "sound", NeronSampler: "sound", NeronAudioLoader: "sound",
    NeronMusic: "music", NeronStudio: "music", NeronDrumMachine: "music", NeronPianoRoll: "music", NeronArrange: "music",
    NeronMixer: "pult",
    NeronDancer: "fun", NeronDancerClip: "fun",
    NeronTheme: "theme",
};
// по какому типу провода какой цвет
const WIRE = { NERON_VIDEOS: "video", NERON_SOUNDS: "sound", AUDIO: "music" };

const THEMES = {
    graphite: {
        name: ["Графит", "Graphite"], life: 0,
        vars: null,
        title: "#353535", body: "#262626",
        acc: { video: "#4dabf7", sound: "#69db7c", music: "#ffa94d", pult: "#da77f2", fun: "#f783ac", theme: "#ffd43b" },
        preview: ["#1b1d23", "#242831", "#353535"],
    },
    brown: {
        name: ["Neron Brown", "Neron Brown"], life: 1,
        title: "#4a2f1e", body: "#2e1c10", mixTitle: 0.32,
        vars: {
            panel: "#22160e", card: "#2a1b11", row: "#30200f", input: "#1c120b", deep: "#170e07", well: "#110a05",
            btn: "#5c3c26", btn2: "#3f2a1a", line: "#4d3524", line2: "#5e412b", text: "#eedcc6", muted: "#ab8f74",
            bright: "#fff3e3", muted2: "#c9ab8c", row2: "#352416", card2: "#26180e",
        },
        acc: { video: "#7fb2e0", sound: "#97d17f", music: "#f3a453", pult: "#e090d8", fun: "#f29ab4", theme: "#ffcf70" },
        glow: 0.35,
        preview: ["#2e1c10", "#4a2f1e", "#f3a453"],
    },
    neon: {
        name: ["Неон", "Neon"], life: 2,
        title: "#1a1033", body: "#0c0820", mixTitle: 0.35,
        vars: {
            panel: "#0b0718", card: "#120c26", row: "#170f30", input: "#0d0822", deep: "#08051a", well: "#050312",
            btn: "#2c1e5c", btn2: "#201645", line: "#3c2b7c", line2: "#4f39a8", text: "#ece7ff", muted: "#9389cc",
            bright: "#ffffff", muted2: "#b9afee", row2: "#1b1338", card2: "#100a24",
        },
        acc: { video: "#00e5ff", sound: "#39ff88", music: "#ff9f1c", pult: "#ff2bd6", fun: "#ff5ea0", theme: "#ffe600" },
        glow: 1,
        preview: ["#0c0820", "#ff2bd6", "#00e5ff"],
    },
};
const LIFE = [["ВЫКЛ", "OFF"], ["СПОКОЙНО", "CALM"], ["НА ПОЛНУЮ", "FULL"]];
const ROOTS = ".nm-root,.nsp-root,.nvs-root,.nst-root,.ncb-root,.nmu-root,.neron-root,.npr-root,.na-root,.nv-root,.nc-root,.nd-root,.nth-root";

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

// ---------------------------------------------------------------------------
//  Текущая тема: берётся с первой ноды «Тема» на столе
// ---------------------------------------------------------------------------
const STATE = { key: "graphite", life: 0, sig: "", node: null };

function readTheme() {
    const g = app.graph;
    const nodes = (g && g._nodes) || [];
    const tn = nodes.find((n) => (n.comfyClass || n.type) === NODE);
    STATE.node = tn || null;
    if (!tn) return { key: "graphite", life: 0 };
    const w = (tn.widgets || []).find((x) => x.name === "theme_json");
    let o = {};
    try { o = JSON.parse(w ? w.value : "{}") || {}; } catch (e) { o = {}; }
    const key = THEMES[o.theme] ? o.theme : "brown";
    const life = [0, 1, 2].includes(o.life) ? o.life : THEMES[key].life;
    return { key, life };
}

// цвета провода по типу: запоминаем исходные, чтобы вернуть «как было»
let wireBackup = null;
function applyWires(th, on) {
    const LGC = window.LGraphCanvas || (app.canvas && app.canvas.constructor);
    const map = LGC && LGC.link_type_colors;
    if (!map) return;
    if (!wireBackup) { wireBackup = {}; for (const t of Object.keys(WIRE)) wireBackup[t] = map[t]; }
    for (const [t, fam] of Object.entries(WIRE)) {
        if (on) map[t] = th.acc[fam];
        else if (wireBackup[t] === undefined) delete map[t]; else map[t] = wireBackup[t];
    }
    if (app.canvas && app.canvas.default_connection_color_byType) {
        for (const [t, fam] of Object.entries(WIRE)) {
            if (on) app.canvas.default_connection_color_byType[t] = th.acc[fam];
            else delete app.canvas.default_connection_color_byType[t];
        }
    }
}

function applyCss(th, on) {
    let st = document.getElementById("neron-theme-vars");
    if (!on || !th.vars) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement("style"); st.id = "neron-theme-vars"; document.head.appendChild(st); }
    const v = Object.entries(th.vars).map(([k, c]) => `--nt-${k}:${c};`).join("");
    const g = th.glow || 0;
    st.textContent = `
:root{${v}}
${ROOTS}{box-shadow:0 0 0 1px color-mix(in srgb, var(--nt-acc,#888) ${Math.round(18 + 30 * g)}%, transparent),
  0 0 calc(${(3 + 6 * g).toFixed(1)}px + var(--nt-pulse,0) * ${Math.round(8 + 22 * g)}px) color-mix(in srgb, var(--nt-acc,#888) ${Math.round(20 + 35 * g)}%, transparent) !important;
  transition:box-shadow .35s ease-out}
${th === THEMES.neon ? `${ROOTS}{text-shadow:0 0 6px rgba(150,120,255,.25)}` : ""}
`;
}

function familyOf(n) { return FAMILY[n.comfyClass || n.type]; }

function applyNodes(th, on) {
    for (const n of (app.graph && app.graph._nodes) || []) {
        const fam = familyOf(n);
        if (!fam) continue;
        n.properties = n.properties || {};
        if (on) {
            const acc = th.acc[fam];
            n.color = mix(th.title, acc, th.mixTitle || 0.2);
            n.bgcolor = th.body;
            n.properties.neron_themed = true;
            for (const w of n.widgets || []) if (w.element && w.element.style) w.element.style.setProperty("--nt-acc", acc);
        } else if (n.properties.neron_themed) {
            n.color = undefined; n.bgcolor = undefined;       // у новых нод цвет — свойство-«сеттер»: просто delete не срабатывает
            try { delete n.color; delete n.bgcolor; } catch (e) { /* ок */ }
            delete n.properties.neron_themed;
            for (const w of n.widgets || []) if (w.element && w.element.style) w.element.style.removeProperty("--nt-acc");
        }
        n.__ntSig = STATE.sig;
    }
}

// группы рабочего стола Neron (заголовок начинается с 🎬 🎵 🥁 🎚 🎨) — в тон теме
const GROUP_FAM = [["🎬", "video"], ["🎵", "sound"], ["🥁", "music"], ["🎚", "pult"], ["🎨", "theme"]];
const GROUP_DEFAULT = { video: "#3f789e", sound: "#88aa88", music: "#b06634", pult: "#a1309b", theme: "#8a7a3a" };
function applyGroups(th, on, key) {
    for (const g of (app.graph && (app.graph._groups || app.graph.groups)) || []) {
        const title = String(g.title || "").trim();
        const hit = GROUP_FAM.find(([e]) => title.startsWith(e));
        if (!hit) continue;
        const fam = hit[1];
        g.color = !on ? GROUP_DEFAULT[fam] : mix(key === "neon" ? "#0c0820" : th.body, th.acc[fam] || "#888888", key === "neon" ? 0.28 : 0.3);
    }
}

function refresh(force) {
    const t = readTheme();
    const nodesN = ((app.graph && app.graph._nodes) || []).length;
    const sig = `${t.key}|${t.life}`;
    const on = t.key !== "graphite";
    const th = THEMES[t.key];
    const changed = sig !== STATE.sig;
    STATE.key = t.key; STATE.life = t.life; STATE.sig = sig;
    if (changed || force) {
        applyCss(th, on);
        applyWires(th, on || !!STATE.node);
        applyNodes(th, on);
        applyGroups(th, on, t.key);
        app.graph && app.graph.setDirtyCanvas(true, true);
    } else {
        // новые ноды на столе — докрасить
        let fresh = false;
        for (const n of (app.graph && app.graph._nodes) || []) if (familyOf(n) && n.__ntSig !== sig) { fresh = true; break; }
        if (fresh) { applyNodes(th, on); app.graph.setDirtyCanvas(true, true); }
    }
    STATE.count = nodesN;
    for (const n of (app.graph && app.graph._nodes) || []) if ((n.comfyClass || n.type) === NODE && n.__nthPaint) n.__nthPaint();
    startFx();
}

// ---------------------------------------------------------------------------
//  Живость: огоньки по рамкам, искры по проводам, вспышки на ударах
// ---------------------------------------------------------------------------
const FX = { raf: null, last: 0, t: 0, lvl: 0, slow: 0, flash: 0, flashT: 0, lastHit: 0, playing: 0, hits: 0, kick: 0, kickT: 0, prevBass: 0, hist: [], bassSeen: 0 };
window.__neronFX = FX;   // для проверки
const buf = new Float32Array(1024);
let fbuf = null;

// удар: всплеск басов (бочка). Если басов в музыке нет совсем — всплеск общей громкости.
function listen(dt) {
    const an = window.__neronBusAn, af = window.__neronBusAf;
    let lvl = 0;
    if (an) {
        an.getFloatTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        lvl = Math.sqrt(s / buf.length);
    }
    const now = performance.now();
    let beat = 0;
    if (af) {
        if (!fbuf || fbuf.length !== af.frequencyBinCount) fbuf = new Float32Array(af.frequencyBinCount);
        af.getFloatFrequencyData(fbuf);
        const hz = af.context.sampleRate / af.fftSize;
        const i0 = Math.max(1, Math.ceil(40 / hz)), i1 = Math.max(i0 + 1, Math.floor(160 / hz));
        let bass = 0;
        for (let i = i0; i <= i1; i++) bass += Math.pow(10, fbuf[i] / 20);
        bass /= (i1 - i0 + 1);
        const flux = Math.max(0, bass - FX.prevBass);
        FX.prevBass = bass;
        FX.bassSeen = Math.max(bass, FX.bassSeen * 0.995);
        const h = FX.hist;
        h.push(flux); if (h.length > 50) h.shift();
        const mean = h.reduce((a, b) => a + b, 0) / h.length;
        const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) * (b - mean), 0) / h.length);
        if (flux > mean + 1.6 * sd && flux > 0.0015 && now - FX.lastHit > 170) beat = Math.min(1, 0.6 + flux * 40);
    }
    // в музыке нет басов (пианино, хэты) — удар по общей громкости
    if (!beat && FX.bassSeen < 0.002 && lvl > 0.03 && lvl > FX.slow * 1.45 && now - FX.lastHit > 170) beat = Math.min(1, 0.55 + lvl * 3);
    FX.lvl = lvl;
    FX.slow = FX.slow * 0.95 + lvl * 0.05;
    if (beat) {
        FX.flashT = Math.max(FX.flashT, beat);
        FX.kickT += (STATE.life === 2 ? 620 : 300) * beat;     // рывок огня вперёд
        FX.lastHit = now; FX.hits++;
    }
    // плавно: вспышка разгорается за ~0,06 с и тает ~0,9 с; рывок набирается мягко и сходит на нет
    FX.flash += (FX.flashT - FX.flash) * Math.min(1, dt * (FX.flashT > FX.flash ? 16 : 5));
    FX.flashT *= Math.pow(0.05, dt);
    FX.kick += (FX.kickT - FX.kick) * Math.min(1, dt * 10);
    FX.kickT *= Math.exp(-3.2 * dt);
    FX.playing = FX.playing * 0.9 + (lvl > 0.004 ? 1 : 0) * 0.1;
}

function startFx() {
    if (FX.raf) return;
    if (STATE.key === "graphite" || STATE.life === 0) {
        document.documentElement.style.removeProperty("--nt-pulse");
        return;
    }
    FX.last = performance.now();
    const step = () => {
        FX.raf = null;
        if (STATE.key === "graphite" || STATE.life === 0) { document.documentElement.style.removeProperty("--nt-pulse"); app.graph && app.graph.setDirtyCanvas(true, false); return; }
        const now = performance.now();
        const dt = Math.min(0.1, (now - FX.last) / 1000);
        const minDt = STATE.life === 2 ? 1 / 60 : 1 / 30;
        if (dt >= minDt && !document.hidden) {
            FX.last = now;
            listen(dt);
            // между ударами огонь ползёт медленно, на ударе — рывок
            const base = (STATE.life === 2 ? 55 : 28) + FX.playing * (STATE.life === 2 ? 40 : 18);
            FX.t += dt * (base + FX.kick);
            const p = (FX.flash * (STATE.life === 2 ? 1 : 0.6)).toFixed(2);
            if (document.documentElement.style.getPropertyValue("--nt-pulse") !== p) document.documentElement.style.setProperty("--nt-pulse", p);
            app.graph && app.graph.setDirtyCanvas(true, false);
        }
        FX.raf = requestAnimationFrame(step);
    };
    FX.raf = requestAnimationFrame(step);
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.rect(x, y, w, h);
}

function drawNodeLights(ctx, n, th) {
    const fam = familyOf(n);
    if (!fam || n.flags?.collapsed) return;
    const acc = th.acc[fam];
    const TH = (window.LiteGraph && window.LiteGraph.NODE_TITLE_HEIGHT) || 30;
    const x = n.pos[0] - 1.5, y = n.pos[1] - TH - 1.5, w = n.size[0] + 3, h = n.size[1] + TH + 3;
    const per = 2 * (w + h);
    const full = STATE.life === 2;
    ctx.save();
    // вспышка на удар — вся рамка
    if (FX.flash > 0.05) {
        ctx.strokeStyle = rgba(acc, Math.min(0.95, FX.flash * (full ? 0.95 : 0.6)));
        ctx.lineWidth = (full ? 3 : 2) + FX.flash * 2;
        ctx.shadowColor = acc; ctx.shadowBlur = (full ? 34 : 16) * FX.flash;
        roundRectPath(ctx, x, y, w, h, 10); ctx.stroke();
    }
    // бегущий огонёк с хвостом (в «на полную» — два, навстречу друг другу)
    const runners = full ? 2 : 1;
    const phase = (n.id * 97) % per;
    for (let r = 0; r < runners; r++) {
        const head = (FX.t + phase + r * per / 2) % per;
        const L = (full ? 110 : 70) * (1 + FX.flash * 1.4);
        const layers = [[L * 3.2, 0.12, 5], [L * 1.7, 0.3, 3.5], [L, 0.95, 2.5]];
        for (const [len, a, lw] of layers) {
            ctx.setLineDash([len, Math.max(1, per - len)]);
            ctx.lineDashOffset = -(head - len);
            ctx.strokeStyle = rgba(acc, a);
            ctx.lineWidth = lw + FX.flash * 1.5;
            ctx.shadowColor = acc; ctx.shadowBlur = (full ? 14 : 6) + FX.flash * 18;
            roundRectPath(ctx, x, y, w, h, 10); ctx.stroke();
        }
    }
    ctx.restore();
}

function linkEnds(link) {
    const g = app.graph;
    const a = g.getNodeById(link.origin_id), b = g.getNodeById(link.target_id);
    if (!a || !b || a.flags?.collapsed || b.flags?.collapsed) return null;
    const pa = [0, 0], pb = [0, 0];
    try {
        if (a.getConnectionPos) a.getConnectionPos(false, link.origin_slot, pa); else return null;
        if (b.getConnectionPos) b.getConnectionPos(true, link.target_slot, pb); else return null;
    } catch (e) { return null; }
    return { a, b, pa, pb };
}

function drawWireSparks(ctx, th) {
    const g = app.graph;
    const links = g.links instanceof Map ? [...g.links.values()] : Object.values(g.links || {});
    const full = STATE.life === 2;
    const active = FX.playing > 0.2;
    if (!full && !active) return;
    const LG = window.LiteGraph || {};
    const straight = app.canvas && (app.canvas.links_render_mode === LG.STRAIGHT_LINK || app.canvas.links_render_mode === LG.LINEAR_LINK);
    ctx.save();
    for (const l of links) {
        if (!l) continue;
        const e = linkEnds(l);
        if (!e || (!familyOf(e.a) && !familyOf(e.b))) continue;
        const fam = WIRE[l.type] || familyOf(e.a) || "music";
        const acc = th.acc[fam] || "#fff";
        const [x0, y0] = e.pa, [x3, y3] = e.pb;
        const dist = Math.hypot(x3 - x0, y3 - y0);
        const off = Math.max(30, dist * 0.25);
        const x1 = x0 + off, y1 = y0, x2 = x3 - off, y2 = y3;
        const n = full ? 3 : 2;
        const sp = active ? 0.55 : 0.18;
        for (let k = 0; k < n; k++) {
            const t = ((FX.t / Math.max(200, dist)) * sp * 2.2 + k / n + (l.id % 7) / 7) % 1;
            let px, py;
            if (straight) { px = x0 + (x3 - x0) * t; py = y0 + (y3 - y0) * t; }
            else {
                const u = 1 - t;
                px = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
                py = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
            }
            const rad = (full ? 3.2 : 2.4) + FX.flash * 3.5;
            ctx.fillStyle = acc;
            ctx.shadowColor = acc; ctx.shadowBlur = full ? 16 : 8;
            ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(px, py, rad * 0.4, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
}

function hookCanvas() {
    const cv = app.canvas;
    if (!cv || cv.__neronFx) return;
    cv.__neronFx = true;
    const orig = cv.onDrawForeground;
    cv.onDrawForeground = function (ctx, area) {
        const r = orig ? orig.apply(this, arguments) : undefined;
        try {
            if (STATE.key !== "graphite" && STATE.life > 0 && app.graph) {
                const th = THEMES[STATE.key];
                drawWireSparks(ctx, th);
                for (const n of app.graph._nodes || []) {
                    if (area && (n.pos[0] > area[0] + area[2] || n.pos[0] + n.size[0] < area[0] || n.pos[1] - 40 > area[1] + area[3] || n.pos[1] + n.size[1] < area[1])) continue;
                    drawNodeLights(ctx, n, th);
                }
            }
        } catch (e) { /* рисование не должно ломать стол */ }
        return r;
    };
}

// ---------------------------------------------------------------------------
//  Сама нода: карточки тем и «живость»
// ---------------------------------------------------------------------------
function injectStyles() {
    if (document.getElementById("neron-theme-node-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-theme-node-styles";
    s.textContent = `
.nth-root{box-sizing:border-box;width:100%;height:100%;padding:10px;background:var(--nt-panel,#1b1d23);border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:var(--nt-text,#cfd2d8);user-select:none;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.nth-head{display:flex;align-items:center;gap:8px}
.nth-head b{font-size:13px;letter-spacing:.6px}
.nth-head span{flex:1;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nth-btn{height:22px;padding:0 8px;border:none;border-radius:5px;background:var(--nt-btn,#4a4e5a);color:#fff;font-size:10px;font-weight:700;cursor:pointer}
.nth-cards{display:flex;gap:8px}
.nth-card{flex:1;min-width:0;border-radius:9px;padding:6px;cursor:pointer;border:2px solid transparent;background:var(--nt-card,#20232a);display:flex;flex-direction:column;gap:5px;transition:transform .12s}
.nth-card:hover{transform:translateY(-2px)}
.nth-card.on{border-color:var(--c);box-shadow:0 0 14px color-mix(in srgb, var(--c) 55%, transparent)}
.nth-prev{position:relative;height:58px;border-radius:6px;overflow:hidden}
.nth-prev i{position:absolute;border-radius:3px}
.nth-card b{font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nth-life{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nth-life span{font-size:10px;font-weight:800;color:var(--nt-muted,#8b90a0);letter-spacing:.5px}
.nth-seg{display:flex;border-radius:6px;overflow:hidden;border:1px solid var(--nt-line,#33363e)}
.nth-seg button{height:24px;padding:0 10px;border:none;background:var(--nt-input,#23252b);color:var(--nt-muted2,#9aa0ae);font-size:10px;font-weight:800;cursor:pointer}
.nth-seg button.on{background:var(--c,#6b4fb3);color:#111}
.nth-note{font-size:10px;line-height:1.45;color:var(--nt-muted,#8b90a0)}
.nth-help{display:none;font-size:11px;line-height:1.55;background:var(--nt-card,#20232a);border-radius:7px;padding:8px}
.nth-help b{color:#ffd166}
.nth-dup{display:none;font-size:11px;font-weight:700;color:#ffd166;background:rgba(217,167,43,.12);border-radius:6px;padding:6px 8px}
`;
    document.head.appendChild(s);
}

function setupThemeNode(node) {
    injectStyles();
    const w = (node.widgets || []).find((x) => x.name === "theme_json");
    if (w) { w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4]; }
    const get = () => { try { return JSON.parse(w ? w.value : "{}") || {}; } catch (e) { return {}; } };
    const set = (o) => { if (w) { w.value = JSON.stringify(o); if (typeof w.callback === "function") { try { w.callback(w.value); } catch (e) { /* ок */ } } } refresh(true); };

    const root = document.createElement("div");
    root.className = "nth-root";
    const head = document.createElement("div");
    head.className = "nth-head";
    head.innerHTML = `<b>🎨 ТЕМА / THEME</b><span>${T("ни к чему не подключается", "not wired to anything")}</span>`;
    const helpBtn = document.createElement("button");
    helpBtn.className = "nth-btn"; helpBtn.textContent = "📖";
    head.appendChild(helpBtn);
    root.appendChild(head);
    const dup = document.createElement("div");
    dup.className = "nth-dup";
    dup.textContent = T("Тема уже задана другой нодой «Тема» — эта не действует", "The theme is already set by another Theme node — this one is inactive");
    root.appendChild(dup);
    const cards = document.createElement("div");
    cards.className = "nth-cards";
    root.appendChild(cards);
    const cardEls = {};
    for (const [key, th] of Object.entries(THEMES)) {
        const c = document.createElement("div");
        c.className = "nth-card";
        c.style.setProperty("--c", key === "graphite" ? "#9aa0ae" : key === "brown" ? "#f3a453" : "#ff2bd6");
        const pv = document.createElement("div");
        pv.className = "nth-prev";
        const bg = key === "graphite" ? "#1b1d23" : th.vars.panel;
        pv.style.background = bg;
        // мини-стол: три кубика и провода
        const box = (l, t, wd, ht, col, title) => {
            const i = document.createElement("i");
            i.style.cssText = `left:${l}%;top:${t}%;width:${wd}%;height:${ht}%;background:${key === "graphite" ? "#2a2c33" : th.body};border-top:5px solid ${title};` +
                (key === "neon" ? `box-shadow:0 0 8px ${col}` : key === "brown" ? `box-shadow:0 0 0 1px ${rgba(col, 0.45)}` : "");
            pv.appendChild(i);
        };
        const ac = th.acc;
        box(6, 12, 26, 30, ac.video, key === "graphite" ? "#353535" : mix(th.title, ac.video, th.mixTitle));
        box(6, 58, 26, 30, ac.sound, key === "graphite" ? "#353535" : mix(th.title, ac.sound, th.mixTitle));
        box(64, 22, 30, 56, ac.pult, key === "graphite" ? "#353535" : mix(th.title, ac.pult, th.mixTitle));
        const wire = (t, col) => {
            const i = document.createElement("i");
            i.style.cssText = `left:32%;top:${t}%;width:32%;height:2px;background:${key === "graphite" ? "#777" : col};` + (key === "neon" ? `box-shadow:0 0 6px ${col}` : "");
            pv.appendChild(i);
        };
        wire(28, ac.video); wire(72, ac.sound);
        const name = document.createElement("b");
        name.textContent = th.name[0] === th.name[1] ? th.name[0] : T(th.name[0], th.name[1]);
        c.appendChild(pv); c.appendChild(name);
        c.addEventListener("click", () => { const o = get(); set({ theme: key, life: THEMES[key].life, ...(o.theme === key ? { life: o.life } : {}) }); });
        cards.appendChild(c);
        cardEls[key] = c;
    }
    const lifeRow = document.createElement("div");
    lifeRow.className = "nth-life";
    const lifeLbl = document.createElement("span");
    lifeLbl.textContent = "✨ " + T("ЖИВОСТЬ", "LIFE");
    lifeRow.appendChild(lifeLbl);
    const seg = document.createElement("div");
    seg.className = "nth-seg";
    const segBtns = LIFE.map((nm, i) => {
        const b = document.createElement("button");
        b.textContent = nm[0];
        b.title = T(["Без анимации", "Огонёк ползёт спокойно, искры — когда играет музыка", "Огни бегут всегда, искры по проводам, вспышки на ударах"][i],
            ["No animation", "A calm light, sparks while music plays", "Running lights, wire sparks, flashes on the beat"][i]);
        b.addEventListener("click", () => { const o = get(); set({ theme: THEMES[o.theme] ? o.theme : "brown", life: i }); });
        seg.appendChild(b);
        return b;
    });
    lifeRow.appendChild(seg);
    root.appendChild(lifeRow);
    const note = document.createElement("div");
    note.className = "nth-note";
    note.textContent = T("Есть нода на столе — тема работает и сохраняется со схемой. Удалите ноду — снова обычный серый вид.",
        "With this node on the canvas the theme works and is saved with the workflow. Delete it — back to the plain grey look.");
    root.appendChild(note);
    const help = document.createElement("div");
    help.className = "nth-help";
    help.innerHTML = "<b>RU:</b> Выберите тему карточкой. <b>Графит</b> — спокойный серый. <b>Neron Brown</b> — фирменная тёплая. <b>Неон</b> — яркая, светящаяся. "
        + "У каждого кубика свой цвет: видео — синий, звук — зелёный, музыка — оранжевый, Пульт — фиолетовый; так же окрашены провода. "
        + "<b>✨ Живость</b>: ВЫКЛ — без анимации; СПОКОЙНО — огонёк медленно ползёт по рамкам, искры по проводам, пока играет музыка; "
        + "НА ПОЛНУЮ — огни бегут всегда и вспыхивают на каждом ударе. На слабом компьютере выберите ВЫКЛ или СПОКОЙНО.<br>"
        + "<b>EN:</b> Pick a theme card. <b>Graphite</b> — calm grey. <b>Neron Brown</b> — the warm signature one. <b>Neon</b> — bright and glowing. "
        + "Every cube has its colour (video blue, sound green, music orange, Pult purple) and so do the wires. "
        + "<b>✨ Life</b>: OFF — no animation; CALM — a slow light on the frames and wire sparks while music plays; FULL — lights always run and flash on every beat. "
        + "On a slow computer pick OFF or CALM.";
    root.appendChild(help);
    helpBtn.addEventListener("click", () => { help.style.display = help.style.display === "block" ? "none" : "block"; fit(); });

    node.__nthPaint = () => {
        const o = get();
        const key = THEMES[o.theme] ? o.theme : "brown";
        const life = [0, 1, 2].includes(o.life) ? o.life : THEMES[key].life;
        for (const [k, c] of Object.entries(cardEls)) c.classList.toggle("on", k === key);
        const col = key === "graphite" ? "#9aa0ae" : key === "brown" ? "#f3a453" : "#ff2bd6";
        seg.style.setProperty("--c", col);
        segBtns.forEach((b, i) => b.classList.toggle("on", i === life));
        const first = STATE.node === node;
        dup.style.display = first ? "none" : "block";
        root.style.opacity = first ? "1" : "0.55";
    };

    const dom = node.addDOMWidget("neron_theme", "neron_theme", root, { serialize: false, hideOnZoom: false });
    const H = () => 190 + (help.style.display === "block" ? help.offsetHeight + 8 : 0) + (dup.style.display === "block" ? 34 : 0);
    dom.computeSize = (width) => [width, H()];
    const fit = () => { root.style.height = H() + "px"; const s = node.computeSize(); node.setSize([Math.max(node.size[0], 420), s[1]]); app.graph && app.graph.setDirtyCanvas(true, true); };
    node.setSize([460, 260]);
    setTimeout(() => { fit(); refresh(true); }, 50);
    node.__nthPaint();
}

app.registerExtension({
    name: "Neron.Theme",
    setup() {
        hookCanvas();
        setInterval(() => { try { hookCanvas(); refresh(false); } catch (e) { /* ок */ } }, 700);
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupThemeNode(this);
            return r;
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            setTimeout(() => refresh(true), 50);
            return r;
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            const r = onRemoved ? onRemoved.apply(this, arguments) : undefined;
            setTimeout(() => refresh(true), 30);
            return r;
        };
    },
});
