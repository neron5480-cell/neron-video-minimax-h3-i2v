import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { mix, rgba, clamp, toComfyPalette, comfyBase, uiTokens, gridImage, wireColor, SLOT_BASE, isLight, roleOf, hex2rgb } from "./nts_core.js";

// ============================================================================
//  Neron Theme — движок / engine
//  RU: Красит весь ComfyUI (окно, стол, ноды по ролям, провода) и рисует живость.
//      Всё обратимо: перед покраской запоминаем, как было, и возвращаем при выключении.
//      Сам workflow (цвета, которые вы задали нодам вручную) не трогаем: ручной цвет
//      всегда главнее темы.
//  EN: Themes the whole ComfyUI (window, canvas, nodes by role, wires) and draws the
//      "life". Fully reversible: we remember what was there and put it back.
//      The workflow itself is never changed: a color you set on a node by hand
//      always wins over the theme.
// ============================================================================

const LG_KEYS = [
    "NODE_TITLE_COLOR", "NODE_SELECTED_TITLE_COLOR", "NODE_TEXT_COLOR", "NODE_TEXT_HIGHLIGHT_COLOR", "NODE_DEFAULT_COLOR",
    "NODE_DEFAULT_BGCOLOR", "NODE_DEFAULT_BOXCOLOR", "NODE_BOX_OUTLINE_COLOR", "DEFAULT_SHADOW_COLOR", "WIDGET_BGCOLOR",
    "WIDGET_OUTLINE_COLOR", "WIDGET_TEXT_COLOR", "WIDGET_SECONDARY_TEXT_COLOR", "WIDGET_DISABLED_TEXT_COLOR", "LINK_COLOR",
    "CONNECTING_LINK_COLOR", "BADGE_FG_COLOR", "BADGE_BG_COLOR", "nodeOpacity",
];
const CANVAS_KEYS = ["node_title_color", "default_link_color", "clear_background_color", "background_image"];

const E = {
    current: null,        // тема с ноды (или null — темы нет)
    preview: null,        // тема под мышкой (временный показ)
    applied: null,        // что сейчас реально на экране
    sig: "",
    ours: null,           // значения, которые поставили мы (чтобы заметить, если их кто-то сменил)
    bk: null,             // как было до нас
    ctorRole: new Map(),  // класс ноды -> роль
    fx: { raf: 0, last: 0, t: 0, flash: 0, slow: 0, lastHit: 0 },
    run: { id: null, start: 0, progress: new Map(), done: new Map(), err: new Map() },
    onChange: null,
};
window.__neronThemeEngine = E;   // для проверки / for tests

// ---------------------------------------------------------------------------
//  Роли: ComfyUI сообщает описание каждой ноды при регистрации
// ---------------------------------------------------------------------------
export function registerType(nodeType, nodeData) {
    try { E.ctorRole.set(nodeType, roleOf(nodeData)); } catch (e) { /* не страшно */ }
}
function roleOfNode(n) {
    return E.ctorRole.get(n.constructor) || "util";
}

const LGC = () => window.LGraphCanvas || (app.canvas && app.canvas.constructor);
const LG = () => window.LiteGraph;

// ---------------------------------------------------------------------------
//  Покраска / Applying
// ---------------------------------------------------------------------------
function backupAll() {
    const lg = LG(), cv = app.canvas, L = LGC();
    const bk = { lg: {}, canvas: {}, links: {}, byType: {}, ctors: new Map(), userBg: false };
    if (lg) for (const k of LG_KEYS) bk.lg[k] = lg[k];
    if (cv) for (const k of CANVAS_KEYS) bk.canvas[k] = cv[k];
    // свой фон-картинка в настройках ComfyUI: фон стола не трогаем
    bk.userBg = !!(cv && cv.clear_background_color === "transparent");
    if (L && L.link_type_colors) for (const [k, v] of Object.entries(L.link_type_colors)) bk.links[k] = v;
    if (cv && cv.default_connection_color_byType) for (const [k, v] of Object.entries(cv.default_connection_color_byType)) bk.byType[k] = v;
    for (const ctor of E.ctorRole.keys()) {
        bk.ctors.set(ctor, { has: Object.prototype.hasOwnProperty.call(ctor, "color") || Object.prototype.hasOwnProperty.call(ctor, "bgcolor"), color: ctor.color, bgcolor: ctor.bgcolor });
    }
    return bk;
}

function linkTypes() {
    const set = new Set(Object.keys(SLOT_BASE));
    for (const k of Object.keys(E.bk?.links || {})) if (k !== "-1" && k !== "number" && k !== "node") set.add(k);
    return [...set];
}

// цвета панелей нод Neron (Audio Studio, DJ Пульт и др.): они берут их из переменных --nt-*
export function neronNodeVars(t) {
    const c = t.c, light = isLight(t);
    return {
        "nt-panel": mix(c.body, c.bg, 0.35), "nt-card": mix(c.body, c.text, 0.04), "nt-card2": mix(c.body, c.bg, 0.15),
        "nt-row": mix(c.body, c.text, 0.06), "nt-row2": mix(c.body, c.text, 0.09), "nt-input": c.widget,
        "nt-deep": mix(c.bg, c.body, 0.3), "nt-well": light ? mix(c.bg, c.text, 0.06) : mix(c.bg, "#000000", 0.25),
        "nt-btn": mix(c.title, c.text, 0.14), "nt-btn2": mix(c.title, c.body, 0.5), "nt-line": c.line, "nt-line2": mix(c.line, c.text, 0.15),
        "nt-text": c.text, "nt-muted": mix(c.text, c.body, 0.45), "nt-muted2": mix(c.text, c.body, 0.3),
        "nt-bright": light ? "#000000" : "#ffffff", "nt-acc": c.accent,
    };
}
function themeCss(t) {
    const nt = Object.entries(neronNodeVars(t)).map(([k, v]) => `--${k}:${v};`).join("");
    let css = `:root:root{${nt}}`;
    if (t.ui) {
        const vars = { ...comfyBase(t), ...uiTokens(t) };
        const body = Object.entries(vars).map(([k, v]) => `--${k}:${v} !important;`).join("");
        css += `:root:root{${body}color-scheme:${isLight(t) ? "light" : "dark"}}`;
    }
    return css;
}

function applyTheme(t) {
    const lg = LG(), cv = app.canvas, L = LGC();
    if (!lg || !cv) return false;
    if (!E.bk) E.bk = backupAll();
    const pal = toComfyPalette(t).colors.litegraph_base;
    const ours = { lg: {}, canvas: {}, links: {}, byType: {} };
    for (const k of LG_KEYS) if (pal[k] !== undefined) { lg[k] = pal[k]; ours.lg[k] = pal[k]; }
    // полупрозрачные ноды: тело ноды (как настройка ComfyUI «Node opacity») и чуть-чуть поля
    lg.nodeOpacity = t.opacity; ours.lg.nodeOpacity = t.opacity;
    if (t.opacity < 1) { const wb = rgba(t.c.widget, Math.max(0.55, t.opacity)); lg.WIDGET_BGCOLOR = wb; ours.lg.WIDGET_BGCOLOR = wb; }
    const cvVals = { node_title_color: pal.NODE_TITLE_COLOR, default_link_color: t.c.link };
    if (!E.bk.userBg) { cvVals.clear_background_color = t.c.bg; cvVals.background_image = gridImage(t); }
    for (const [k, v] of Object.entries(cvVals)) { cv[k] = v; ours.canvas[k] = v; }
    cv._pattern = undefined;
    // провода: по типу (в гамме темы), один цвет или свои цвета по типам
    for (const type of linkTypes()) {
        let base = E.bk.links[type] || SLOT_BASE[type];
        if (base && /^#[0-9a-f]{3}$/i.test(base)) base = "#" + base.slice(1).split("").map((x) => x + x).join("");
        if ((!base || !/^#[0-9a-f]{6}$/i.test(base)) && t.wires.mode === "type") continue;
        const col = wireColor(t, type, base);
        if (L && L.link_type_colors) { L.link_type_colors[type] = col; ours.links[type] = col; }
        if (cv.default_connection_color_byType) { cv.default_connection_color_byType[type] = col; ours.byType[type] = col; }
    }
    // ноды по ролям: цвет «класса» — ручной цвет ноды всё равно главнее
    for (const [ctor, role] of E.ctorRole) {
        let b = E.bk.ctors.get(ctor);
        if (!b) { b = { has: Object.prototype.hasOwnProperty.call(ctor, "color"), color: ctor.color, bgcolor: ctor.bgcolor }; E.bk.ctors.set(ctor, b); }
        if (b.has && b.color) continue;          // у ноды свой фирменный цвет (например, заметка) — не трогаем
        const rc = t.roles[role] || t.roles.util;
        ctor.color = mix(t.c.title, rc, t.tint);
        ctor.bgcolor = mix(t.c.body, rc, t.btint);
    }
    // окно ComfyUI
    let st = document.getElementById("nts-vars");
    const css = themeCss(t);
    if (css) {
        if (!st) { st = document.createElement("style"); st.id = "nts-vars"; document.head.appendChild(st); }
        if (st.textContent !== css) st.textContent = css;
    } else if (st) st.remove();
    E.ours = ours;
    cv.setDirty && cv.setDirty(true, true);
    return true;
}

function restoreAll() {
    const lg = LG(), cv = app.canvas, L = LGC();
    const bk = E.bk;
    document.getElementById("nts-vars")?.remove();
    if (!bk) return;
    if (lg) for (const [k, v] of Object.entries(bk.lg)) lg[k] = v;
    if (cv) { for (const [k, v] of Object.entries(bk.canvas)) cv[k] = v; cv._pattern = undefined; }
    if (L && L.link_type_colors && E.ours) {
        for (const k of Object.keys(E.ours.links)) { if (k in bk.links) L.link_type_colors[k] = bk.links[k]; else delete L.link_type_colors[k]; }
    }
    if (cv && cv.default_connection_color_byType && E.ours) {
        for (const k of Object.keys(E.ours.byType)) { if (k in bk.byType) cv.default_connection_color_byType[k] = bk.byType[k]; else delete cv.default_connection_color_byType[k]; }
    }
    for (const [ctor, b] of bk.ctors) {
        if (b.has && b.color) continue;
        if (b.has) { ctor.color = b.color; ctor.bgcolor = b.bgcolor; }
        else { delete ctor.color; delete ctor.bgcolor; }
    }
    E.bk = null; E.ours = null;
    cv && cv.setDirty && cv.setDirty(true, true);
}

// ComfyUI сменил палитру, пока наша тема включена: запоминаем новое «как было» и красим снова
function guard() {
    const t = E.applied;
    if (!t || !E.ours || !E.bk) return;
    const lg = LG(), cv = app.canvas, L = LGC();
    let changed = false;
    if (lg) for (const [k, v] of Object.entries(E.ours.lg)) if (lg[k] !== v) { E.bk.lg[k] = lg[k]; changed = true; }
    if (cv) for (const [k, v] of Object.entries(E.ours.canvas)) if (cv[k] !== v) { E.bk.canvas[k] = cv[k]; changed = true; }
    if (L && L.link_type_colors) for (const [k, v] of Object.entries(E.ours.links)) if (L.link_type_colors[k] !== v) { E.bk.links[k] = L.link_type_colors[k]; changed = true; }
    if (cv && cv.clear_background_color === "transparent" && !E.bk.userBg) { E.bk.userBg = true; changed = true; }
    // новые типы нод (поставили пакет без перезапуска) — тоже покрасить
    for (const ctor of E.ctorRole.keys()) if (!E.bk.ctors.has(ctor)) { changed = true; break; }
    if (changed) applyTheme(t);
}

function refresh() {
    const want0 = E.preview || E.current;
    const want = want0 && want0.__none ? null : want0;      // примерка «обычного ComfyUI»
    const sig = want ? JSON.stringify(want) : "";
    if (sig === E.sig) return;
    E.sig = sig;
    if (!want) { restoreAll(); E.applied = null; }
    else if (applyTheme(want)) E.applied = want;
    else { E.sig = ""; return; }    // холст ещё не готов — попробуем позже
    startFx();
    // ноды Neron (Audio Studio и др.) перерисовывают ручки и индикаторы в цветах темы
    try { window.dispatchEvent(new Event("neron-theme")); } catch (e) { /* ок */ }
    if (E.onChange) try { E.onChange(E.applied); } catch (e) { /* ок */ }
}

export function setCurrent(t) { E.current = t || null; refresh(); }
export function setPreview(t) { E.preview = t || null; refresh(); }
export function getApplied() { return E.applied; }
export function engineReady() { return !!(LG() && app.canvas); }

// ---------------------------------------------------------------------------
//  Работа схемы: какая нода считается, какая готова, где ошибка
//  Workflow run: which node is running, which is done, where the error is
// ---------------------------------------------------------------------------
function idOf(x) {
    if (x === null || x === undefined) return null;
    if (typeof x === "object") x = x.display_node ?? x.node ?? x.node_id;
    if (x === null || x === undefined) return null;
    return String(x);
}
function hookApi() {
    if (E.apiHooked) return;
    E.apiHooked = true;
    const R = E.run;
    api.addEventListener("execution_start", () => { R.id = null; R.progress.clear(); R.err.clear(); });
    api.addEventListener("executing", (e) => {
        const id = idOf(e.detail);
        if (R.id && R.id !== id) R.done.set(R.id, performance.now());
        R.id = id; R.start = performance.now();
        startFx();
    });
    api.addEventListener("progress", (e) => {
        const d = e.detail || {};
        const id = idOf(d.node) || R.id;
        if (id && d.max) R.progress.set(id, clamp(d.value / d.max, 0, 1));
    });
    api.addEventListener("executed", (e) => { const id = idOf(e.detail); if (id) R.done.set(id, performance.now()); });
    api.addEventListener("execution_error", (e) => {
        const id = idOf(e.detail?.node_id ?? e.detail?.node);
        if (id) R.err.set(id, performance.now());
        R.id = null; startFx();
    });
    for (const ev of ["execution_success", "execution_interrupted"]) api.addEventListener(ev, () => { if (R.id) R.done.set(R.id, performance.now()); R.id = null; });
}
function nodeById(g, id) {
    if (!g || id === null) return null;
    const last = String(id).split(":").pop();
    return g.getNodeById(Number(last)) || g.getNodeById(last) || null;
}

// ---------------------------------------------------------------------------
//  Живость / Life
// ---------------------------------------------------------------------------
const tbuf = new Float32Array(1024);
function listenBeat(dt) {
    const F = E.fx;
    const an = window.__neronBusAn;      // звук нод Neron Audio Studio, если они есть
    let lvl = 0;
    if (an) {
        an.getFloatTimeDomainData(tbuf);
        let s = 0;
        for (let i = 0; i < tbuf.length; i++) s += tbuf[i] * tbuf[i];
        lvl = Math.sqrt(s / tbuf.length);
    }
    const now = performance.now();
    if (lvl > 0.03 && lvl > F.slow * 1.45 && now - F.lastHit > 170) { F.flash = Math.min(1, 0.55 + lvl * 3); F.lastHit = now; }
    F.slow = F.slow * 0.95 + lvl * 0.05;
    F.flash *= Math.pow(0.04, dt);
}

function busy() {
    const R = E.run, now = performance.now();
    if (R.id) return true;
    for (const t of R.done.values()) if (now - t < 900) return true;
    for (const t of R.err.values()) if (now - t < 4000) return true;
    return false;
}

function startFx() {
    hookCanvas();
    const F = E.fx;
    if (F.raf) return;
    F.last = performance.now();
    const step = () => {
        F.raf = 0;
        const t = E.applied;
        if (!t || t.life.level === 0) { app.canvas && app.canvas.setDirty(true, true); return; }
        const now = performance.now();
        const dt = Math.min(0.1, (now - F.last) / 1000);
        const L = t.life;
        const fps = L.fps || [0, 30, 45, 60][L.level];
        if (dt >= 1 / fps - 0.002 && !document.hidden) {
            F.last = now;
            F.t += dt * L.speed;
            if (L.beat) listenBeat(dt);
            const bgAnim = L.bgfx !== "none" && !(L.quietRun && E.run.id);
            app.canvas && app.canvas.setDirty(true, bgAnim);
        }
        F.raf = requestAnimationFrame(step);
    };
    F.raf = requestAnimationFrame(step);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function nodeBox(n) {
    const TH = (LG() && LG().NODE_TITLE_HEIGHT) || 30;
    const collapsed = n.flags?.collapsed;
    const w = collapsed ? (n._collapsed_width || 120) : n.size[0];
    const h = collapsed ? 0 : n.size[1];
    return [n.pos[0] - 1.5, n.pos[1] - TH - 1.5, w + 3, h + TH + 3];
}
function visible(b, area) {
    return !(area && (b[0] > area[0] + area[2] || b[0] + b[2] < area[0] || b[1] > area[1] + area[3] || b[1] + b[3] < area[1]));
}

function drawFrame(ctx, n, col, t, many) {
    const L = t.life, lvl = L.level;
    const b = nodeBox(n);
    const [x, y, w, h] = b;
    const per = 2 * (w + h);
    const glow = !many && lvl >= 2;
    const F = E.fx;
    ctx.save();
    if (F.flash > 0.05 && L.beat) {
        ctx.strokeStyle = rgba(col, Math.min(0.9, F.flash * 0.8));
        ctx.lineWidth = 2 + F.flash * 2;
        if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 24 * F.flash * (0.4 + t.glow); }
        roundRect(ctx, x, y, w, h, 10); ctx.stroke();
    }
    const runners = lvl === 3 ? 2 : 1;
    const speed = [0, 26, 45, 70][lvl];
    const phase = ((n.id * 97) % 997) / 997 * per;
    const len = [0, 50, 80, 110][lvl];
    for (let r = 0; r < runners; r++) {
        const head = (F.t * speed * 1.6 + phase + r * per / 2) % per;
        const layers = glow ? [[len * 3, 0.12, 5], [len * 1.6, 0.3, 3.5], [len, 0.9, 2.5]] : [[len * 2, 0.15, 3], [len, 0.75, 2]];
        for (const [ln, a, lw] of layers) {
            ctx.setLineDash([ln, Math.max(1, per - ln)]);
            ctx.lineDashOffset = -(head - ln);
            ctx.strokeStyle = rgba(col, a * (0.6 + 0.4 * t.glow));
            ctx.lineWidth = lw;
            if (glow) { ctx.shadowColor = col; ctx.shadowBlur = 6 + 14 * t.glow; }
            roundRect(ctx, x, y, w, h, 10); ctx.stroke();
        }
    }
    ctx.restore();
}

// нода считается — пульсирует рамка и полоска прогресса; готова — короткая вспышка; ошибка — мигает красным
function drawWork(ctx, g, t, now) {
    const R = E.run;
    const one = (id, fn) => { const n = nodeById(g, id); if (n) fn(n); };
    if (R.id) one(R.id, (n) => {
        const col = t.roles[roleOfNode(n)] || t.c.accent;
        const [x, y, w, h] = nodeBox(n);
        const p = 0.5 + 0.5 * Math.sin((now - R.start) / 180);
        ctx.save();
        ctx.strokeStyle = rgba(col, 0.55 + 0.45 * p);
        ctx.lineWidth = 3 + 2 * p;
        ctx.shadowColor = col; ctx.shadowBlur = 10 + 18 * p * (0.5 + t.glow);
        roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 12); ctx.stroke();
        const pr = R.progress.get(R.id);
        if (pr !== undefined) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = rgba(col, 0.25);
            ctx.fillRect(x + 6, y + h - 6, w - 12, 3);
            ctx.fillStyle = col;
            ctx.fillRect(x + 6, y + h - 6, (w - 12) * pr, 3);
        }
        ctx.restore();
    });
    for (const [id, at] of R.done) {
        const k = (now - at) / 700;
        if (k >= 1) { R.done.delete(id); continue; }
        one(id, (n) => {
            const col = t.roles[roleOfNode(n)] || t.c.accent;
            const [x, y, w, h] = nodeBox(n);
            const grow = 2 + k * 14;
            ctx.save();
            ctx.strokeStyle = rgba(col, 0.8 * (1 - k));
            ctx.lineWidth = 3 * (1 - k) + 1;
            ctx.shadowColor = col; ctx.shadowBlur = 16 * (1 - k);
            roundRect(ctx, x - grow, y - grow, w + grow * 2, h + grow * 2, 12 + grow); ctx.stroke();
            ctx.restore();
        });
    }
    for (const [id, at] of R.err) {
        const age = now - at;
        if (age > 4000) { R.err.delete(id); continue; }
        one(id, (n) => {
            const [x, y, w, h] = nodeBox(n);
            const on = Math.floor(age / 300) % 2 === 0;
            ctx.save();
            ctx.strokeStyle = on ? "rgba(255,60,60,.95)" : "rgba(255,60,60,.35)";
            ctx.lineWidth = 4;
            ctx.shadowColor = "#ff3c3c"; ctx.shadowBlur = on ? 20 : 4;
            roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 12); ctx.stroke();
            ctx.restore();
        });
    }
}

function linkPoints(g, l) {
    const a = g.getNodeById(l.origin_id), b = g.getNodeById(l.target_id);
    if (!a || !b) return null;
    const pa = new Float32Array(2), pb = new Float32Array(2);
    try {
        const ra = a.getConnectionPos(false, l.origin_slot, pa);
        const rb = b.getConnectionPos(true, l.target_slot, pb);
        return { a, b, pa: ra || pa, pb: rb || pb };
    } catch (e) { return null; }
}

function drawSparks(ctx, g, t, area, now) {
    const L = t.life, lvl = L.level;
    const links = g.links instanceof Map ? [...g.links.values()] : Object.values(g.links || {});
    const LGx = LG() || {};
    const mode = app.canvas.links_render_mode;
    const straight = mode === LGx.STRAIGHT_LINK || mode === LGx.LINEAR_LINK;
    const Lc = LGC();
    const runTarget = E.run.id;
    const sc = app.canvas.ds ? app.canvas.ds.scale : 1;
    let drawn = 0;
    ctx.save();
    for (const l of links) {
        if (!l || drawn > 400) continue;
        const e = linkPoints(g, l);
        if (!e) continue;
        const [x0, y0] = e.pa, [x3, y3] = e.pb;
        if (area && (Math.max(x0, x3) < area[0] || Math.min(x0, x3) > area[0] + area[2] || Math.max(y0, y3) < area[1] || Math.min(y0, y3) > area[1] + area[3])) continue;
        const feeding = L.work && runTarget && String(e.b.id) === String(runTarget).split(":").pop();
        if (!L.wires && !feeding) continue;
        const col = l.color || (Lc && Lc.link_type_colors && Lc.link_type_colors[l.type]) || t.c.link;
        const dist = Math.hypot(x3 - x0, y3 - y0);
        const off = dist * 0.25;
        const n = feeding ? 4 : [0, 1, 2, 3][lvl];
        const sp = feeding ? 2.2 : 0.5;
        for (let k = 0; k < n; k++) {
            const u0 = ((E.fx.t * sp * 160) / Math.max(150, dist) + k / n + (l.id % 7) / 7) % 1;
            let px, py;
            if (straight) { px = x0 + (x3 - x0) * u0; py = y0 + (y3 - y0) * u0; }
            else {
                const s = u0, u = 1 - s;
                const x1 = x0 + off, x2 = x3 - off;
                px = u * u * u * x0 + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3;
                py = u * u * u * y0 + 3 * u * u * s * y0 + 3 * u * s * s * y3 + s * s * s * y3;
            }
            const rad = ((feeding ? 3.2 : 2.2) + E.fx.flash * 2) / Math.max(0.5, Math.min(1.5, sc));
            ctx.fillStyle = col;
            if (lvl >= 2 || feeding) { ctx.shadowColor = col; ctx.shadowBlur = 10 * (0.4 + t.glow); }
            ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(255,255,255,.85)";
            ctx.beginPath(); ctx.arc(px, py, rad * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        drawn++;
    }
    ctx.restore();
}

// фон: переливы, частицы, звёзды (в координатах стола, размер точек постоянный на экране)
function drawBgFx(ctx, t, area) {
    const L = t.life;
    const F = E.fx;
    const sc = app.canvas.ds ? app.canvas.ds.scale : 1;
    const [ax, ay, aw, ah] = area;
    ctx.save();
    const roles = Object.values(t.roles);
    if (L.bgfx === "flow") {
        const blobs = [[t.c.accent, 0.13, 0.31], [roles[2], 0.09, 0.47], [roles[6], 0.07, 0.23]];
        blobs.forEach(([col, a, s], i) => {
            const cx = ax + aw * (0.5 + 0.38 * Math.sin(F.t * s * 0.35 + i * 2.1));
            const cy = ay + ah * (0.5 + 0.34 * Math.cos(F.t * s * 0.29 + i * 1.3));
            const r = Math.max(aw, ah) * (0.45 + 0.1 * Math.sin(F.t * 0.2 + i));
            const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            const al = a * (0.5 + t.glow) * (1 + F.flash * 0.8);
            gr.addColorStop(0, rgba(col, al)); gr.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = gr;
            ctx.fillRect(ax, ay, aw, ah);
        });
    } else if (L.bgfx === "particles" || L.bgfx === "stars") {
        const stars = L.bgfx === "stars";
        const N = stars ? 140 : 70;
        for (let i = 0; i < N; i++) {
            const r1 = ((i * 9301 + 49297) % 233280) / 233280, r2 = ((i * 4096 + 150889) % 714025) / 714025, r3 = ((i * 1103 + 12345) % 9973) / 9973;
            let fx, fy, a, size;
            if (stars) {
                fx = r1; fy = r2;
                a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(F.t * (0.8 + r3 * 2.5) + i));
                size = 0.8 + r3 * 1.6;
            } else {
                fx = (r1 + Math.sin(F.t * 0.15 + i) * 0.02 + 1) % 1;
                fy = (r2 - F.t * (0.012 + r3 * 0.025) + 10) % 1;
                a = 0.18 + 0.3 * r3;
                size = 1.2 + r3 * 2.4;
            }
            const col = stars ? (i % 5 === 0 ? t.c.accent : t.c.text) : roles[i % roles.length];
            ctx.fillStyle = rgba(col, Math.min(1, a * (1 + F.flash)));
            ctx.beginPath();
            ctx.arc(ax + fx * aw, ay + fy * ah, size / sc, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

// подсветка: мягкое свечение из-под каждой ноды цветом её роли (рисуется под нодами)
function drawHalo(ctx, g, t, area) {
    const nodes = (g && g._nodes) || [];
    const vis = nodes.filter((n) => visible(nodeBox(n), [area[0] - 60, area[1] - 60, area[2] + 120, area[3] + 120]));
    const cheap = vis.length > 200;
    const sc = app.canvas.ds ? app.canvas.ds.scale : 1;
    const beat = t.life.level > 0 && t.life.beat ? E.fx.flash : 0;
    const k = t.halo * (1 + beat * 0.8);
    ctx.save();
    for (const n of vis) {
        if (n.mode === 2 || n.mode === 4) continue;         // выключенные и пропущенные ноды не светятся
        const col = t.roles[roleOfNode(n)] || t.c.accent;
        const [x, y, w, h] = nodeBox(n);
        ctx.strokeStyle = rgba(col, Math.min(1, 0.35 + 0.6 * k));
        ctx.lineWidth = 3 + 5 * k;
        if (!cheap) { ctx.shadowColor = col; ctx.shadowBlur = (12 + 38 * k) * Math.max(0.4, Math.min(1.6, sc)); }
        roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 10);
        ctx.stroke();
        if (!cheap) { ctx.stroke(); }                        // второй проход — свечение плотнее
    }
    ctx.restore();
}

function hookCanvas() {
    const cv = app.canvas;
    if (!cv || cv.__ntsHooked) return;
    cv.__ntsHooked = true;
    hookApi();
    const fg0 = cv.onDrawForeground;
    cv.onDrawForeground = function (ctx, area) {
        const r = fg0 ? fg0.apply(this, arguments) : undefined;
        const t = E.applied;
        if (!t || t.life.level === 0) return r;
        try {
            const g = this.graph || app.graph;
            if (!g) return r;
            const now = performance.now();
            const quiet = t.life.quietRun && E.run.id;
            if (!quiet) {
                if (t.life.wires || t.life.work) drawSparks(ctx, g, t, area, now);
                if (t.life.frame) {
                    const nodes = g._nodes || [];
                    const vis = nodes.filter((n) => visible(nodeBox(n), area));
                    const many = vis.length > 120;
                    for (const n of vis) drawFrame(ctx, n, t.roles[roleOfNode(n)] || t.c.accent, t, many);
                }
            } else if (t.life.work) drawSparks(ctx, g, { ...t, life: { ...t.life, wires: false } }, area, now);
            if (t.life.work) drawWork(ctx, g, t, now);
        } catch (e) { /* рисование не должно ломать стол */ }
        return r;
    };
    const bg0 = cv.onDrawBackground;
    cv.onDrawBackground = function (ctx, area) {
        const r = bg0 ? bg0.apply(this, arguments) : undefined;
        const t = E.applied;
        try {
            if (t && t.life.level > 0 && t.life.bgfx !== "none" && area && !(t.life.quietRun && E.run.id)) drawBgFx(ctx, t, area);
            if (t && t.halo > 0 && area) drawHalo(ctx, this.graph || app.graph, t, area);
        } catch (e) { /* ок */ }
        return r;
    };
}

// раз в секунду: не сменил ли кто палитру; есть ли холст
setInterval(() => {
    try {
        if (!engineReady()) return;
        if (E.applied) guard();
        else if (E.current || E.preview) { E.sig = ""; refresh(); }
        if (E.applied && E.applied.life.level > 0) startFx();
    } catch (e) { /* ок */ }
}, 1000);

export function themeVarsForNode(t) {
    // цвета для панели самой ноды (берутся из темы, чтобы нода выглядела в тон)
    const c = t.c;
    return {
        "--nts-panel": mix(c.body, c.bg, 0.35), "--nts-card": mix(c.body, c.text, 0.05), "--nts-input": c.widget, "--nts-line": c.line,
        "--nts-text": c.text, "--nts-muted": mix(c.text, c.body, 0.45), "--nts-acc": c.accent, "--nts-btn": mix(c.title, c.text, 0.12),
    };
}
export { E as engineState, roleOfNode };
export function rgbOf(c) { return hex2rgb(c); }
