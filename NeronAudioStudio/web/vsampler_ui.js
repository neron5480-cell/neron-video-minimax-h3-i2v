import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { makeUserSized } from "./neron_common.js";

// ============================================================================
//  Neron Video Sampler / Видео-сэмплер
//  RU: Между «Видео ×3» и Пультом. Сверху три дорожки — три ролика (кадры-превью):
//      мышкой выделяете кусок «откуда — докуда», ▶ — посмотреть, ➜ или перетащить
//      вниз — кусок попадает в МОНТАЖ. Внизу монтажная лента: куски идут друг за
//      другом; их можно резать (✂), переставлять (тянуть), обрезать (тянуть края),
//      копировать, удалять. Экран слева показывает результат. ⏭ ПРОПУСТИТЬ — ролики
//      идут в Пульт как есть. 🔇 — без звука роликов (звук у нас делает Пульт).
//  EN: Between Video ×3 and the Pult. Three source rows (thumbnails): select a piece,
//      ▶ to watch, ➜ or drag it down into the EDIT. The edit strip: pieces play one
//      after another; cut (✂), reorder (drag), trim (drag edges), copy, delete. The
//      screen shows the result. ⏭ BYPASS — clips go to the Pult as they are.
//      🔇 — no clip sound (the Pult does the sound).
// ============================================================================

const NODE = "NeronVideoSampler";
const MAX_SRC = 3, MAX_PIECES = 200;
const VCOLORS = ["#4dabf7", "#f783ac", "#69db7c"];
const SRC_H = 46, RULER_H = 18, LANE_H = 66, EDGE = 9, THUMB_W = 96, THUMB_H = 54;
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
const refKey = (v) => (v ? `${v.type || "input"}|${v.subfolder || ""}|${v.name}` : "");
function viewUrl(v) {
    const p = `/view?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}`;
    return typeof api.apiURL === "function" ? api.apiURL(p) : p;
}
// координаты мыши внутри холста с учётом зума схемы ComfyUI
function pt(e, cv) {
    const r = cv.getBoundingClientRect();
    const kx = cv.clientWidth / (r.width || 1), ky = cv.clientHeight / (r.height || 1);
    return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
}
function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
}
const once = (o, ev, ms = 4000) => new Promise((res) => {
    let done = false;
    const f = () => { if (done) return; done = true; o.removeEventListener(ev, f); res(true); };
    o.addEventListener(ev, f);
    setTimeout(() => { if (!done) { done = true; o.removeEventListener(ev, f); res(false); } }, ms);
});

function injectStyles() {
    if (document.getElementById("neron-vsampler-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-vsampler-styles";
    s.textContent = `
.nvs-outer{box-sizing:border-box;width:100%;padding-bottom:10px}
.nvs-root{box-sizing:border-box;width:100%;height:100%;padding:8px 10px;background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:6px;overflow:hidden;position:relative}
.nvs-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;flex:none}
.nvs-btn{height:26px;padding:0 11px;border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;background:#4a4e5a;
  white-space:nowrap;line-height:26px;flex:none;font-family:inherit}
.nvs-btn:hover{filter:brightness(1.18)}
.nvs-btn:disabled{opacity:.4;cursor:default;filter:none}
.nvs-btn.sm{height:22px;line-height:22px;padding:0 8px;font-size:10px}
.nvs-byp.on{background:#d9a72b;color:#1b1d23}
.nvs-mute.on{background:#b3414a}
.nvs-status{flex:1;min-width:120px;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.nvs-status.err{color:#ff8a80}
.nvs-status.ok{color:#8ce99a}
.nvs-help{display:none;flex:none;background:#20232a;border-radius:7px;padding:8px 10px;font-size:11px;line-height:1.55}
.nvs-help b{color:#ffd166}
.nvs-main{display:flex;gap:10px;flex:1;min-height:120px}
.nvs-monwrap{display:flex;flex-direction:column;gap:4px;flex:none;height:100%;max-width:46%}
.nvs-mon{position:relative;flex:1;min-height:0;aspect-ratio:16/9;background:#000;border-radius:7px;overflow:hidden;border:2px solid #2b2f3a}
.nvs-mon video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;background:#000}
.nvs-mon .tag{position:absolute;left:8px;top:6px;font-size:11px;font-weight:800;text-shadow:0 1px 3px #000;pointer-events:none;z-index:2}
.nvs-mon .empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;font-size:11px;color:#8b90a0;line-height:1.5}
.nvs-time{flex:none;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:#e6e8ee}
.nvs-time i{font-style:normal;color:#8b90a0;font-weight:400}
.nvs-srcs{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;overflow:hidden}
.nvs-h{font-size:11px;font-weight:800;color:#9aa0ae;letter-spacing:.5px;flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nvs-h i{font-style:normal;font-weight:400;color:#6c7180;letter-spacing:0}
.nvs-src{display:flex;align-items:center;gap:6px;height:${SRC_H}px;flex:none;background:#20232a;border-radius:7px;padding:0 6px}
.nvs-sname{width:118px;flex:none;display:flex;flex-direction:column;min-width:0}
.nvs-sname b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nvs-sname span{font-size:9px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.nvs-scv{flex:1;min-width:60px;height:${SRC_H - 8}px;border-radius:4px;background:#111;cursor:crosshair;touch-action:none;display:block}
.nvs-sempty{flex:1;padding:12px;font-size:11px;color:#8b90a0;background:#20232a;border-radius:7px;line-height:1.5}
.nvs-edit{flex:none;display:flex;flex-direction:column;gap:3px}
.nvs-ecv{width:100%;height:${RULER_H + LANE_H}px;display:block;border-radius:6px;background:#15171c;touch-action:none;cursor:default}
.nvs-hs{width:100%;height:10px;margin:0;flex:none;accent-color:#6b4fb3}
.nvs-pbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;flex:none;min-height:24px;font-size:11px}
.nvs-pbar b{font-variant-numeric:tabular-nums}
.nvs-banner{position:absolute;left:0;right:0;top:${RULER_H}px;bottom:0;display:none;align-items:center;justify-content:center;pointer-events:none;
  font-size:11px;font-weight:700;color:#ffd166;background:rgba(21,23,28,.55);text-align:center;padding:0 10px}
.nvs-ewrap{position:relative}
`;
    document.head.appendChild(s);
}

function setupVSampler(node) {
    injectStyles();
    const getWidget = (n) => (node.widgets || []).find((w) => w.name === n);
    const jw = getWidget("vsampler_json");
    if (jw) { jw.type = "hidden"; jw.hidden = true; jw.computeSize = () => [0, -4]; }

    // ---------- состояние ----------
    function normalize(o) {
        o = o && typeof o === "object" ? o : {};
        const S = {
            version: 1, bypass: o.bypass !== false, mute: !!o.mute,
            pieces: [], zoom: Number(o.zoom) > 0 ? Number(o.zoom) : 0, x0: Math.max(0, Number(o.x0) || 0),
            cur: Math.max(0, Number(o.cur) || 0), sel: {}, selId: null,
        };
        for (const p of Array.isArray(o.pieces) ? o.pieces.slice(0, MAX_PIECES) : []) {
            if (!p || !(Number(p.len) > 0.03)) continue;
            S.pieces.push({ id: p.id || uid(), src: clamp(Math.round(Number(p.src) || 0), 0, MAX_SRC - 1), in: Math.max(0, Number(p.in) || 0), len: Number(p.len) });
        }
        if (o.sel && typeof o.sel === "object") {
            for (const k of Object.keys(o.sel)) {
                const v = o.sel[k];
                if (v && Number(v.b) > Number(v.a)) S.sel[k] = { a: Number(v.a), b: Number(v.b) };
            }
        }
        S.selId = S.pieces.some((p) => p.id === o.selId) ? o.selId : null;
        return S;
    }
    let S = normalize((() => { try { return JSON.parse(jw ? jw.value : "{}"); } catch (e) { return {}; } })());
    let disposed = false;
    const save = () => { if (jw) jw.value = JSON.stringify(S); };
    const undoS = [], redoS = [];
    const pushUndo = () => { undoS.push(JSON.stringify(S)); if (undoS.length > 80) undoS.shift(); redoS.length = 0; };
    const undo = () => { if (!undoS.length) return; redoS.push(JSON.stringify(S)); S = normalize(JSON.parse(undoS.pop())); changed(); };
    const redo = () => { if (!redoS.length) return; undoS.push(JSON.stringify(S)); S = normalize(JSON.parse(redoS.pop())); changed(); };

    // ---------- что пришло по проводу ----------
    let items = [];
    const info = [];          // {dur, fps, w, h}
    const thumbs = [];        // [{t, c}]
    function getLink(id) { const g = node.graph; if (!g || !g.links) return null; return g.links instanceof Map ? g.links.get(id) : g.links[id]; }
    function upstream() {
        const inp = (node.inputs || []).find((x) => x.name === "videos");
        if (!inp || inp.link === null || inp.link === undefined) return [];
        let id = inp.link;
        for (let hop = 0; hop < 6; hop++) {
            const l = getLink(id);
            if (!l) return [];
            const o = node.graph.getNodeById(l.origin_id);
            if (!o) return [];
            if (o.type === "Reroute") { const i0 = o.inputs && o.inputs[0]; if (i0 && i0.link != null) { id = i0.link; continue; } return []; }
            if (o !== node && typeof o.neronCube === "function") { const c = o.neronCube(); return c && c.kind === "videos" ? c.items.slice(0, MAX_SRC) : []; }
            return [];
        }
        return [];
    }

    // ---------- монтаж: где какой кусок ----------
    const editLen = () => S.pieces.reduce((a, p) => a + p.len, 0);
    const starts = () => { const r = []; let t = 0; for (const p of S.pieces) { r.push(t); t += p.len; } return r; };
    const fpsOf = (k) => (info[k] && info[k].fps) || 24;
    const frame = () => 1 / fpsOf(S.pieces.length ? S.pieces[0].src : 0);
    const pieceAt = (t) => {
        let a = 0;
        for (let i = 0; i < S.pieces.length; i++) {
            const p = S.pieces[i];
            if (t >= a && t < a + p.len) return { i, p, a, o: t - a };
            a += p.len;
        }
        return null;
    };
    const selPiece = () => S.pieces.find((p) => p.id === S.selId) || null;

    // ---------- для Пульта ----------
    const R = { ref: null, key: "", busy: false, timer: null, err: "", len: 0 };
    const editKey = () => JSON.stringify([S.mute, items.map(refKey), S.pieces.map((p) => [p.src, +p.in.toFixed(4), +p.len.toFixed(4)])]);
    node.neronCube = () => {
        if (S.bypass || !S.pieces.length) return { kind: "videos", items: items.map((x) => ({ ...x })), mute: S.mute, bypass: true };
        return { kind: "videos", items: R.ref && R.key === editKey() ? [{ ...R.ref }] : [], mute: S.mute, bypass: false };
    };

    // ---------- каркас ----------
    const outer = el("div", "nvs-outer");
    const root = el("div", "nvs-root");
    outer.appendChild(root);
    const bar = el("div", "nvs-bar");
    const bypBtn = el("button", "nvs-btn nvs-byp", "⏭ ПРОПУСТИТЬ / BYPASS");
    bypBtn.title = T("Нажата: ролики идут в Пульт как есть. Отжата: Пульт видит только монтаж",
        "On: clips go to the Pult as they are. Off: the Pult sees only the edit");
    const playBtn = el("button", "nvs-btn", "▶");
    playBtn.style.background = "#3fa34d";
    playBtn.title = T("Смотреть монтаж с курсора (пробел)", "Play the edit from the cursor (space)");
    const stopBtn = el("button", "nvs-btn", "■");
    stopBtn.style.background = "#b3414a";
    stopBtn.title = T("Стоп", "Stop");
    const muteBtn = el("button", "nvs-btn nvs-mute", "🔇 БЕЗ ЗВУКА РОЛИКОВ");
    muteBtn.title = T("Убрать звук роликов совсем (и здесь, и в Пульте, и в готовом видео)", "Remove the clip sound completely (here, in the Pult and in the final video)");
    const fitBtn = el("button", "nvs-btn sm", "⤢");
    fitBtn.title = T("Показать весь монтаж", "Fit the whole edit");
    const helpBtn = el("button", "nvs-btn sm", "📖");
    helpBtn.title = T("Помощь", "Help");
    const status = el("div", "nvs-status");
    [bypBtn, playBtn, stopBtn, muteBtn, fitBtn, status, helpBtn].forEach((b) => bar.appendChild(b));
    root.appendChild(bar);

    const help = el("div", "nvs-help");
    help.innerHTML =
        "<b>RU:</b> ① Сверху — ваши ролики (из «Видео ×3»). Ведите мышкой по кадрам — выделится кусок «откуда — докуда»; "
        + "▶ — посмотреть кусок; <b>➜</b> или просто перетащите выделенное вниз — кусок встанет в монтаж. Двойной клик — весь ролик. "
        + "② <b>МОНТАЖ</b> — куски идут друг за другом. Тянуть кусок — переставить; тянуть края — обрезать; клик — поставить курсор; "
        + "<b>✂</b> (или S) — разрезать на курсоре; <b>⧉</b> (Ctrl+D) — копия; <b>🗑</b> (Delete) — убрать; Ctrl+Z — отменить. "
        + "Колёсико — приблизить, Shift+колёсико — прокрутка. Пробел — смотреть. "
        + "<b>⏭ ПРОПУСТИТЬ</b> — ролики идут в Пульт как есть. <b>🔇</b> — без звука роликов. "
        + "Монтаж сам собирается в точный по кадрам mp4 и уходит в Пульт.<br>"
        + "<b>EN:</b> ① Your clips from Video ×3 on top. Drag across the frames to select a piece; ▶ watches it; <b>➜</b> or drag it down — "
        + "it goes into the edit. Double-click selects the whole clip. ② <b>EDIT</b> — pieces play one after another. Drag a piece to reorder, "
        + "drag its edges to trim, click to set the cursor; <b>✂</b> (S) cuts at the cursor; <b>⧉</b> (Ctrl+D) copies; <b>🗑</b> (Delete) removes; "
        + "Ctrl+Z undoes. Wheel zooms, Shift+wheel scrolls, space plays. <b>⏭ BYPASS</b> sends the clips as they are; <b>🔇</b> drops the clip sound. "
        + "The edit is built into a frame-accurate mp4 for the Pult automatically.";
    root.appendChild(help);

    const main = el("div", "nvs-main");
    const monWrap = el("div", "nvs-monwrap");
    const mon = el("div", "nvs-mon");
    const monTag = el("div", "tag");
    const monEmpty = el("div", "empty", T("Подключите «Видео ×3» ко входу videos", "Wire Video ×3 into videos"));
    mon.appendChild(monTag);
    mon.appendChild(monEmpty);
    const timeRow = el("div", "nvs-time");
    const timeLbl = el("span", "", "0:00.00");
    const timeTot = el("i", "", "");
    timeRow.appendChild(timeLbl);
    timeRow.appendChild(timeTot);
    monWrap.appendChild(mon);
    monWrap.appendChild(timeRow);
    main.appendChild(monWrap);
    const srcs = el("div", "nvs-srcs");
    main.appendChild(srcs);
    root.appendChild(main);

    const edit = el("div", "nvs-edit");
    const eh = el("div", "nvs-h");
    eh.innerHTML = "② МОНТАЖ / EDIT <i>— куски идут друг за другом; это видит Пульт / pieces play one after another; the Pult sees this</i>";
    edit.appendChild(eh);
    const ewrap = el("div", "nvs-ewrap");
    const ecv = el("canvas", "nvs-ecv");
    const banner = el("div", "nvs-banner", T("⏭ ПРОПУСТИТЬ включено: в Пульт идут ролики как есть. Отожмите, чтобы Пульт видел монтаж",
        "⏭ BYPASS is on: the clips go to the Pult as they are. Turn it off so the Pult sees the edit"));
    ewrap.appendChild(ecv);
    ewrap.appendChild(banner);
    edit.appendChild(ewrap);
    const hs = el("input", "nvs-hs");
    hs.type = "range"; hs.min = "0"; hs.max = "1000"; hs.value = "0";
    hs.title = T("Прокрутка монтажа (Shift+колёсико)", "Scroll the edit (Shift+wheel)");
    edit.appendChild(hs);
    const pbar = el("div", "nvs-pbar");
    edit.appendChild(pbar);
    root.appendChild(edit);

    const keys = el("textarea");
    keys.readOnly = true; keys.tabIndex = -1;
    keys.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    root.appendChild(keys);
    const refocus = () => setTimeout(() => { if (!disposed) keys.focus({ preventScroll: true }); }, 0);

    function setStatus(t, kind) { status.textContent = t || ""; status.title = t || ""; status.className = "nvs-status" + (kind ? " " + kind : ""); }

    // ---------- плееры: по одному <video> на ролик ----------
    const vids = [];
    let shown = -1;
    function syncPlayers() {
        for (let k = 0; k < MAX_SRC; k++) {
            const it = items[k];
            let v = vids[k];
            if (!it) { if (v) { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); vids[k] = null; } continue; }
            const url = viewUrl(it);
            if (!v) { v = el("video"); v.preload = "auto"; v.playsInline = true; mon.insertBefore(v, monTag); vids[k] = v; }
            if (v.dataset.url !== url) { v.dataset.url = url; v.src = url; }
            v.muted = S.mute;
        }
        showPlayer(shown);
    }
    function showPlayer(k) {
        shown = k;
        vids.forEach((v, i) => { if (v) v.style.display = i === k ? "block" : "none"; });
        monEmpty.style.display = k >= 0 && vids[k] ? "none" : "flex";
        monTag.textContent = k >= 0 && items[k] ? `${k + 1}. ${items[k].name}` : "";
        monTag.style.color = VCOLORS[k] || "#fff";
        mon.style.borderColor = k >= 0 ? VCOLORS[k] : "#2b2f3a";
    }
    function seekShow(k, t) {
        const v = vids[k];
        if (!v) return;
        showPlayer(k);
        try { v.currentTime = Math.max(0, t); } catch (e) { /* ещё не загрузилось */ }
    }
    // кадр монтажа на курсоре
    function showEditAt(t) {
        const h = pieceAt(Math.min(t, Math.max(0, editLen() - 1e-4)));
        if (h) seekShow(h.p.src, h.p.in + h.o);
    }

    // ---------- кадры-превью ----------
    let thumbToken = 0;
    async function makeThumbs(k, token) {
        const it = items[k];
        thumbs[k] = [];
        if (!it) return;
        const v = el("video");
        v.muted = true; v.preload = "auto"; v.src = viewUrl(it);
        if (!(await once(v, "loadeddata", 15000)) || token !== thumbToken) return;
        const dur = v.duration || 0;
        if (!info[k]) info[k] = {};
        info[k].dur = dur;
        drawAll();
        const n = clamp(Math.ceil(dur * 2), 6, 30);
        for (let i = 0; i < n; i++) {
            if (token !== thumbToken || disposed) return;
            const t = (i + 0.5) * dur / n;
            v.currentTime = t;
            await once(v, "seeked", 4000);
            const c = document.createElement("canvas");
            c.width = THUMB_W; c.height = THUMB_H;
            const g = c.getContext("2d");
            g.fillStyle = "#000"; g.fillRect(0, 0, THUMB_W, THUMB_H);
            const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
            const sc = Math.min(THUMB_W / vw, THUMB_H / vh);
            try { g.drawImage(v, (THUMB_W - vw * sc) / 2, (THUMB_H - vh * sc) / 2, vw * sc, vh * sc); } catch (e) { /* кадр не готов */ }
            thumbs[k].push({ t, c });
            if (i % 3 === 2 || i === n - 1) drawAll();
        }
        v.removeAttribute("src"); v.load();
    }
    async function fetchInfo(k) {
        const it = items[k];
        if (!it) return;
        try {
            const r = await api.fetchApi(`/neron/video_info?filename=${encodeURIComponent(it.name)}&subfolder=${encodeURIComponent(it.subfolder || "")}&type=${encodeURIComponent(it.type || "input")}`);
            const d = await r.json();
            if (d.ok) { info[k] = { ...(info[k] || {}), dur: d.duration || (info[k] && info[k].dur) || 0, fps: d.fps || 24, w: d.width, h: d.height }; drawAll(); }
        } catch (e) { /* не страшно */ }
    }
    const thumbAt = (k, t) => {
        const a = thumbs[k];
        if (!a || !a.length) return null;
        let best = a[0], bd = Infinity;
        for (const x of a) { const d = Math.abs(x.t - t); if (d < bd) { bd = d; best = x; } }
        return best.c;
    };
    // полоса кадров в прямоугольнике (x,y,w,h) для отрезка времени [t0,t1] ролика k
    function filmstrip(g, k, t0, t1, x, y, w, h) {
        g.save();
        g.beginPath(); g.rect(x, y, w, h); g.clip();
        g.fillStyle = "#0d0e11"; g.fillRect(x, y, w, h);
        const tw = Math.max(20, h * 16 / 9);
        for (let px = x; px < x + w; px += tw) {
            const c = thumbAt(k, t0 + ((px - x + tw / 2) / Math.max(1, w)) * (t1 - t0));
            if (c) g.drawImage(c, px, y, tw, h);
        }
        g.restore();
    }

    // ---------- ① источники ----------
    const srcUI = [];
    function buildSources() {
        srcs.innerHTML = "";
        srcUI.length = 0;
        const h = el("div", "nvs-h");
        h.innerHTML = "① РОЛИКИ / CLIPS <i>— ведите мышкой по кадрам; ➜ или перетащите вниз / drag across the frames; ➜ or drag it down</i>";
        srcs.appendChild(h);
        if (!items.length) {
            srcs.appendChild(el("div", "nvs-sempty", T("Подключите «Видео ×3» ко входу videos и выберите ролики — они появятся здесь, каждый своей дорожкой.",
                "Wire Video ×3 into the videos input and pick clips — each one appears here as its own row.")));
            return;
        }
        items.forEach((it, k) => {
            const row = el("div", "nvs-src");
            const nm = el("div", "nvs-sname");
            const b = el("b", "", `${k + 1}. ${it.name}`);
            b.style.color = VCOLORS[k];
            b.title = it.name;
            const sub = el("span", "", "");
            nm.appendChild(b); nm.appendChild(sub);
            const pv = el("button", "nvs-btn sm", "▶");
            pv.style.background = "#3fa34d";
            pv.title = T("Посмотреть выделенный кусок (или с курсора)", "Watch the selected piece (or from the cursor)");
            const cv = el("canvas", "nvs-scv");
            const go = el("button", "nvs-btn sm", "➜");
            go.style.background = "#6b4fb3";
            go.title = T("В конец монтажа (выделенное или весь ролик)", "To the end of the edit (selection or the whole clip)");
            row.appendChild(nm); row.appendChild(pv); row.appendChild(cv); row.appendChild(go);
            srcs.appendChild(row);
            const ui = { cv, sub, cursor: 0 };
            srcUI[k] = ui;
            pv.addEventListener("click", () => { if (P.on && P.mode === "src" && P.k === k) stopPlay(); else playSource(k); refocus(); });
            go.addEventListener("click", () => { addPiece(k, null); refocus(); });
            bindSource(k, cv);
        });
    }
    const durOf = (k) => (info[k] && info[k].dur) || 0;
    function drawSource(k) {
        const ui = srcUI[k];
        if (!ui) return;
        const { g, w, h } = fitCanvas(ui.cv);
        const dur = durOf(k);
        g.clearRect(0, 0, w, h);
        if (!dur) { g.fillStyle = "#8b90a0"; g.font = "10px Segoe UI"; g.fillText(T("загружаю кадры…", "loading frames…"), 8, h / 2 + 3); return; }
        filmstrip(g, k, 0, dur, 0, 0, w, h);
        const sel = S.sel[k];
        const X = (t) => (t / dur) * w;
        if (sel) {
            g.fillStyle = "rgba(0,0,0,.6)";
            g.fillRect(0, 0, X(sel.a), h);
            g.fillRect(X(sel.b), 0, w - X(sel.b), h);
            g.strokeStyle = VCOLORS[k]; g.lineWidth = 2;
            g.strokeRect(X(sel.a) + 1, 1, Math.max(2, X(sel.b) - X(sel.a) - 2), h - 2);
            g.fillStyle = VCOLORS[k];
            g.fillRect(X(sel.a), 0, 4, h); g.fillRect(X(sel.b) - 4, 0, 4, h);
        }
        // куски этого ролика, уже лежащие в монтаже — тонкая полоска снизу
        g.fillStyle = VCOLORS[k];
        for (const p of S.pieces) if (p.src === k) g.fillRect(X(p.in), h - 3, Math.max(2, X(p.in + p.len) - X(p.in)), 3);
        const cx = X(ui.cursor);
        g.fillStyle = "#fff"; g.fillRect(cx - 1, 0, 2, h);
        if (P.on && P.mode === "src" && P.k === k && vids[k]) { g.fillStyle = "#ffd166"; g.fillRect(X(vids[k].currentTime) - 1, 0, 2, h); }
        ui.sub.textContent = sel ? `${fmt(sel.a)} – ${fmt(sel.b)} · ${(sel.b - sel.a).toFixed(2)} c/s` : `${fmt(dur)} · ${T("весь", "full")}`;
    }
    function bindSource(k, cv) {
        let d = null;
        const tOf = (e) => clamp(pt(e, cv).x / Math.max(1, cv.clientWidth), 0, 1) * durOf(k);
        cv.addEventListener("pointerdown", (e) => {
            if (e.button !== 0 || !durOf(k)) return;
            e.preventDefault(); e.stopPropagation();
            cv.setPointerCapture(e.pointerId);
            const t = tOf(e), p = pt(e, cv);
            const sel = S.sel[k];
            const px = (x) => (x / durOf(k)) * cv.clientWidth;
            let mode = "pending";
            if (sel && Math.abs(p.x - px(sel.a)) < 7) mode = "edgea";
            else if (sel && Math.abs(p.x - px(sel.b)) < 7) mode = "edgeb";
            d = { mode, t0: t, x0: e.clientX, y0: e.clientY, inSel: !!(sel && t > sel.a && t < sel.b), sel0: sel ? { ...sel } : null, undo: false };
        });
        cv.addEventListener("pointermove", (e) => {
            if (!d) { // курсор мыши: края выделения тянутся
                const sel = S.sel[k]; if (!sel || !durOf(k)) { cv.style.cursor = "crosshair"; return; }
                const p = pt(e, cv), px = (x) => (x / durOf(k)) * cv.clientWidth;
                cv.style.cursor = Math.abs(p.x - px(sel.a)) < 7 || Math.abs(p.x - px(sel.b)) < 7 ? "ew-resize" : (p.x > px(sel.a) && p.x < px(sel.b) ? "grab" : "crosshair");
                return;
            }
            const t = tOf(e);
            const dx = Math.abs(e.clientX - d.x0), dy = e.clientY - d.y0;
            // мышь уже над монтажом — значит, кусок несут вниз (даже если вели наискосок)
            if ((d.mode === "pending" || d.mode === "select") && pt(e, ecv).inside) {
                if (d.inSel && d.sel0) S.sel[k] = { ...d.sel0 };
                if (S.sel[k]) d.mode = "grab";
            }
            if (d.mode === "pending") {
                if (d.inSel && dy > 10 && dy > dx * 0.6) d.mode = "grab";
                else if (dx > 3) { d.mode = "select"; pushUndo(); }
                else return;
            }
            if (d.mode === "select") {
                S.sel[k] = { a: Math.min(d.t0, t), b: Math.max(d.t0, t) };
                if (S.sel[k].b - S.sel[k].a < 0.04) delete S.sel[k];
                drawSource(k); seekShow(k, t);
            } else if (d.mode === "edgea" || d.mode === "edgeb") {
                if (!d.undo) { pushUndo(); d.undo = true; }
                const sel = S.sel[k];
                if (d.mode === "edgea") sel.a = clamp(t, 0, sel.b - 0.04); else sel.b = clamp(t, sel.a + 0.04, durOf(k));
                drawSource(k); seekShow(k, d.mode === "edgea" ? sel.a : sel.b);
            } else if (d.mode === "grab") {
                const q = pt(e, ecv);
                drag.ghost = q.inside ? { idx: insertIndex(q.x), src: k } : null;
                cv.style.cursor = "grabbing";
                drawEdit();
            }
        });
        const up = (e) => {
            if (!d) return;
            const m = d.mode;
            if (m === "pending") {           // клик — курсор «смотреть отсюда»
                srcUI[k].cursor = d.t0;
                delete S.sel[k];
                if (P.on && P.mode === "src" && P.k === k) playSource(k, d.t0); else seekShow(k, d.t0);
                drawSource(k); save();
            } else if (m === "grab") {
                const g = drag.ghost;
                drag.ghost = null;
                if (g) addPiece(k, g.idx);
                else drawEdit();
            } else save();
            d = null;
            refocus();
        };
        cv.addEventListener("pointerup", up);
        cv.addEventListener("pointercancel", up);
        cv.addEventListener("dblclick", (e) => {
            e.preventDefault();
            if (!durOf(k)) return;
            pushUndo();
            S.sel[k] = { a: 0, b: durOf(k) };
            drawSource(k); save();
        });
    }

    // ---------- ② монтаж ----------
    const drag = { ghost: null };
    const pxPerSec = () => {
        if (!(S.zoom > 0)) {
            const w = Math.max(100, ecv.clientWidth - 20);
            return w / Math.max(4, editLen() * 1.08);
        }
        return S.zoom;
    };
    const X = (t) => (t - S.x0) * pxPerSec();
    const tAt = (x) => S.x0 + x / pxPerSec();
    function insertIndex(x) {
        const t = tAt(x), st = starts();
        for (let i = 0; i < S.pieces.length; i++) if (t < st[i] + S.pieces[i].len / 2) return i;
        return S.pieces.length;
    }
    function rulerStep(pps) {
        const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
        for (const s of steps) if (s * pps >= 60) return s;
        return 600;
    }
    function drawEdit() {
        const { g, w, h } = fitCanvas(ecv);
        g.clearRect(0, 0, w, h);
        const pps = pxPerSec();
        // линейка
        g.fillStyle = "#1e2027"; g.fillRect(0, 0, w, RULER_H);
        const step = rulerStep(pps);
        g.font = "9px Segoe UI"; g.textBaseline = "middle";
        const tFirst = Math.floor(S.x0 / step) * step;
        for (let t = tFirst; X(t) < w; t += step) {
            const x = Math.round(X(t)) + 0.5;
            if (x < 0) continue;
            g.fillStyle = "#3a3e49"; g.fillRect(x, RULER_H - 6, 1, 6);
            g.fillStyle = "#8b90a0"; g.fillText(step < 1 ? t.toFixed(2) + "s" : fmt(t).replace(/\.00$/, ""), x + 3, RULER_H / 2);
        }
        // дорожка
        const y0 = RULER_H + 4, lh = LANE_H - 8;
        g.fillStyle = "#191b21"; g.fillRect(0, RULER_H, w, LANE_H);
        const st = starts();
        S.pieces.forEach((p, i) => {
            const x0 = X(st[i]), x1 = X(st[i] + p.len);
            if (x1 < 0 || x0 > w) return;
            const col = VCOLORS[p.src] || "#aaa";
            filmstrip(g, p.src, p.in, p.in + p.len, x0, y0, Math.max(2, x1 - x0), lh);
            g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x0, y0 + lh - 16, Math.max(2, x1 - x0), 16);
            g.fillStyle = col; g.fillRect(x0, y0, Math.max(2, x1 - x0), 3);
            const sel = p.id === S.selId;
            g.strokeStyle = sel ? "#fff" : "rgba(0,0,0,.8)"; g.lineWidth = sel ? 2 : 1;
            g.strokeRect(x0 + 0.5, y0 + 0.5, Math.max(1, x1 - x0 - 1), lh - 1);
            if (sel) { g.fillStyle = "#fff"; g.fillRect(x0, y0 + lh / 2 - 9, 4, 18); g.fillRect(x1 - 4, y0 + lh / 2 - 9, 4, 18); }
            if (x1 - x0 > 46) {
                g.save(); g.beginPath(); g.rect(x0 + 4, y0, x1 - x0 - 8, lh); g.clip();
                g.fillStyle = "#fff"; g.font = "bold 10px Segoe UI";
                g.fillText(`${p.src + 1} · ${fmt(p.in)}–${fmt(p.in + p.len)}`, x0 + 6, y0 + lh - 8);
                g.restore();
            }
        });
        if (!S.pieces.length) {
            g.fillStyle = "#8b90a0"; g.font = "11px Segoe UI"; g.textAlign = "center";
            g.fillText(T("Пусто: выделите кусок ролика сверху и нажмите ➜ или перетащите его сюда",
                "Empty: select a piece of a clip above and press ➜ or drag it here"), w / 2, RULER_H + LANE_H / 2);
            g.textAlign = "left";
        }
        // куда встанет перетаскиваемый кусок
        if (drag.ghost) {
            const gi = drag.ghost.idx;
            const gx = X(gi < S.pieces.length ? st[gi] : editLen());
            g.fillStyle = VCOLORS[drag.ghost.src] || "#ffd166";
            g.fillRect(gx - 2, RULER_H, 4, LANE_H);
            g.beginPath(); g.moveTo(gx - 6, RULER_H); g.lineTo(gx + 6, RULER_H); g.lineTo(gx, RULER_H + 7); g.fill();
        }
        // курсор
        const ct = P.on && P.mode === "edit" ? P.t : S.cur;
        const cx = X(ct);
        if (cx >= -2 && cx <= w + 2) {
            g.fillStyle = P.on && P.mode === "edit" ? "#ffd166" : "#fff";
            g.fillRect(cx - 1, 0, 2, h);
            g.beginPath(); g.moveTo(cx - 6, 0); g.lineTo(cx + 6, 0); g.lineTo(cx, 8); g.fill();
        }
        // прокрутка
        const total = editLen() * pps, view = w;
        hs.style.visibility = total > view + 4 ? "visible" : "hidden";
        if (total > view) hs.value = String(Math.round(1000 * (S.x0 * pps) / Math.max(1, total - view)));
        banner.style.display = S.bypass && S.pieces.length ? "flex" : "none";
        timeTot.textContent = `/ ${fmt(editLen())} · ${S.pieces.length} ${T("кусков", "pieces")}`;
        if (!(P.on && P.mode === "src")) timeLbl.textContent = fmt(ct);
    }
    hs.addEventListener("input", () => {
        const pps = pxPerSec(), total = editLen() * pps, view = ecv.clientWidth;
        if (!(S.zoom > 0)) S.zoom = pps;
        S.x0 = Math.max(0, (Number(hs.value) / 1000) * Math.max(0, total - view)) / pps;
        drawEdit();
    });
    hs.addEventListener("pointerup", () => { save(); refocus(); });

    let ed = null;
    ecv.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        ecv.setPointerCapture(e.pointerId);
        const p = pt(e, ecv), t = tAt(p.x);
        const st = starts();
        let hit = -1, edge = null;
        if (p.y > RULER_H) {
            for (let i = 0; i < S.pieces.length; i++) {
                const x0 = X(st[i]), x1 = X(st[i] + S.pieces[i].len);
                if (p.x >= x0 - 3 && p.x <= x1 + 3) {
                    hit = i;
                    if (p.x - x0 < EDGE) edge = "l"; else if (x1 - p.x < EDGE) edge = "r";
                    break;
                }
            }
        }
        if (hit < 0) {
            S.selId = null;
            ed = { mode: "cursor" };
            setCursor(t);
        } else {
            const pc = S.pieces[hit];
            S.selId = pc.id;
            ed = { mode: edge ? "trim" + edge : "move", i: hit, id: pc.id, x0: p.x, in0: pc.in, len0: pc.len, moved: false, t };
            if (!edge) setCursor(t);
        }
        drawEdit(); showPiece();
    });
    ecv.addEventListener("pointermove", (e) => {
        const p = pt(e, ecv);
        if (!ed) {
            // подсказка курсором: края — обрезать, кусок — тянуть
            const st = starts();
            let c = "default";
            if (p.y > RULER_H) for (let i = 0; i < S.pieces.length; i++) {
                const x0 = X(st[i]), x1 = X(st[i] + S.pieces[i].len);
                if (p.x >= x0 - 3 && p.x <= x1 + 3) { c = p.x - x0 < EDGE || x1 - p.x < EDGE ? "ew-resize" : "grab"; break; }
            }
            ecv.style.cursor = c;
            return;
        }
        if (ed.mode === "cursor") { setCursor(tAt(p.x)); return; }
        const pc = S.pieces.find((x) => x.id === ed.id);
        if (!pc) return;
        const dt = (p.x - ed.x0) / pxPerSec();
        if (!ed.moved && Math.abs(p.x - ed.x0) < 3) return;
        if (!ed.moved) { pushUndo(); ed.moved = true; }
        const dur = durOf(pc.src) || (pc.in + pc.len);
        if (ed.mode === "trimr") {
            pc.len = clamp(ed.len0 + dt, 0.1, dur - pc.in);
            const st = starts(), i = S.pieces.indexOf(pc);
            seekShow(pc.src, pc.in + pc.len - 0.02);
            S.cur = st[i] + pc.len;
        } else if (ed.mode === "triml") {
            const ni = clamp(ed.in0 + dt, 0, ed.in0 + ed.len0 - 0.1);
            pc.len = ed.len0 - (ni - ed.in0); pc.in = ni;
            seekShow(pc.src, pc.in);
            S.cur = starts()[S.pieces.indexOf(pc)];
        } else if (ed.mode === "move") {
            drag.ghost = { idx: insertIndex(p.x), src: pc.src };
            ecv.style.cursor = "grabbing";
        }
        drawEdit(); showPiece();
    });
    const edUp = () => {
        if (!ed) return;
        if (ed.mode === "move" && ed.moved && drag.ghost) {
            const from = S.pieces.findIndex((x) => x.id === ed.id);
            let to = drag.ghost.idx;
            if (from >= 0 && to !== from && to !== from + 1) {
                const [pc] = S.pieces.splice(from, 1);
                if (to > from) to--;
                S.pieces.splice(to, 0, pc);
                S.cur = starts()[to];
            }
        }
        drag.ghost = null;
        const was = ed;
        ed = null;
        if (was.moved || was.mode === "cursor") changed();
        else { drawEdit(); showPiece(); save(); }
        refocus();
    };
    ecv.addEventListener("pointerup", edUp);
    ecv.addEventListener("pointercancel", edUp);
    ecv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        const pps = pxPerSec();
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            if (!(S.zoom > 0)) S.zoom = pps;
            S.x0 = Math.max(0, S.x0 + (e.shiftKey ? e.deltaY : e.deltaX) / pps);
        } else {
            const p = pt(e, ecv), tm = tAt(p.x);
            S.zoom = clamp(pps * (e.deltaY < 0 ? 1.25 : 0.8), 4, 2000);
            S.x0 = Math.max(0, tm - p.x / S.zoom);
        }
        drawEdit(); save();
    }, { passive: false });
    fitBtn.addEventListener("click", () => { S.zoom = 0; S.x0 = 0; drawEdit(); save(); refocus(); });

    function setCursor(t) {
        S.cur = clamp(t, 0, editLen());
        if (P.on && P.mode === "edit") playEdit(S.cur);
        else showEditAt(S.cur);
        drawEdit();
    }

    // ---------- действия с кусками ----------
    function addPiece(k, idx) {
        const dur = durOf(k);
        if (!dur) { setStatus(T("Ролик ещё загружается…", "The clip is still loading…"), "err"); return; }
        if (S.pieces.length >= MAX_PIECES) return;
        pushUndo();
        const sel = S.sel[k] || { a: 0, b: dur };
        const pc = { id: uid(), src: k, in: sel.a, len: Math.max(0.1, sel.b - sel.a) };
        const at = idx == null ? S.pieces.length : clamp(idx, 0, S.pieces.length);
        S.pieces.splice(at, 0, pc);
        S.selId = pc.id;
        S.cur = starts()[at];
        if (S.bypass) {
            // положили кусок — значит, хотят монтаж: Пульт теперь видит его
            S.bypass = false;
            setStatus(T("⏭ выключено: теперь Пульт видит монтаж", "⏭ off: the Pult now sees the edit"), "ok");
        }
        if (!(S.zoom > 0)) S.x0 = 0;
        changed();
        showEditAt(S.cur);
    }
    function splitAtCursor() {
        let h = pieceAt(S.cur);
        const sp = selPiece();
        if (sp && (!h || h.p !== sp)) {           // курсор не на выделенном куске — режем его посередине
            const i = S.pieces.indexOf(sp);
            h = { i, p: sp, a: starts()[i], o: sp.len / 2 };
        }
        if (!h || h.o < 0.05 || h.p.len - h.o < 0.05) { setStatus(T("Поставьте курсор внутрь куска", "Put the cursor inside a piece"), "err"); return; }
        pushUndo();
        const fr = 1 / fpsOf(h.p.src);
        const o = Math.round(h.o / fr) * fr;
        const b = { id: uid(), src: h.p.src, in: h.p.in + o, len: h.p.len - o };
        h.p.len = o;
        S.pieces.splice(h.i + 1, 0, b);
        S.selId = b.id;
        S.cur = h.a + o;
        changed();
    }
    function dupSel() {
        const sp = selPiece();
        if (!sp) return;
        pushUndo();
        const i = S.pieces.indexOf(sp);
        const c = { ...sp, id: uid() };
        S.pieces.splice(i + 1, 0, c);
        S.selId = c.id;
        S.cur = starts()[i + 1];
        changed();
    }
    function delSel() {
        const sp = selPiece();
        if (!sp) return;
        pushUndo();
        const i = S.pieces.indexOf(sp);
        S.pieces.splice(i, 1);
        S.selId = S.pieces[Math.min(i, S.pieces.length - 1)]?.id || null;
        S.cur = Math.min(S.cur, editLen());
        changed();
    }
    function moveSel(dir) {
        const sp = selPiece();
        if (!sp) return;
        const i = S.pieces.indexOf(sp), j = i + dir;
        if (j < 0 || j >= S.pieces.length) return;
        pushUndo();
        S.pieces.splice(i, 1);
        S.pieces.splice(j, 0, sp);
        S.cur = starts()[j];
        changed();
    }

    // нижняя строка: что выделено
    function showPiece() {
        pbar.innerHTML = "";
        const sp = selPiece();
        const mk = (txt, title, fn, bg) => {
            const b = el("button", "nvs-btn sm", txt);
            b.title = title;
            if (bg) b.style.background = bg;
            b.addEventListener("click", () => { fn(); refocus(); });
            pbar.appendChild(b);
            return b;
        };
        mk("✂ " + T("РЕЗАТЬ", "CUT"), T("Разрезать на курсоре (S)", "Cut at the cursor (S)"), splitAtCursor, "#3b6fb6");
        if (sp) {
            const i = S.pieces.indexOf(sp);
            const info2 = el("b", "", `${i + 1}/${S.pieces.length} · ${T("ролик", "clip")} ${sp.src + 1} · ${fmt(sp.in)} – ${fmt(sp.in + sp.len)} · ${sp.len.toFixed(2)} c/s`);
            info2.style.color = VCOLORS[sp.src];
            pbar.insertBefore(info2, pbar.firstChild);
            mk("◀", T("Переставить левее", "Move left"), () => moveSel(-1)).disabled = i === 0;
            mk("▶", T("Переставить правее", "Move right"), () => moveSel(1)).disabled = i === S.pieces.length - 1;
            mk("⧉ " + T("КОПИЯ", "COPY"), T("Копия рядом (Ctrl+D)", "Copy next to it (Ctrl+D)"), dupSel);
            mk("🗑", T("Убрать кусок (Delete)", "Remove the piece (Delete)"), delSel, "#7a2f36");
        } else {
            pbar.insertBefore(el("span", "", T("Клик по куску — выделить; края — обрезать; тянуть — переставить", "Click a piece to select; edges trim; drag to reorder")), pbar.firstChild);
            pbar.firstChild.style.color = "#8b90a0";
        }
        const und = mk("↶", T("Отменить (Ctrl+Z)", "Undo (Ctrl+Z)"), undo);
        und.disabled = !undoS.length;
        und.style.marginLeft = "auto";
        mk("↷", T("Вернуть (Ctrl+Y)", "Redo (Ctrl+Y)"), redo).disabled = !redoS.length;
    }

    // ---------- просмотр ----------
    const P = { on: false, mode: "edit", k: -1, i: 0, t: 0, raf: null, endAt: 0, startT: 0, fromT: 0 };
    function stopPlay() {
        P.on = false;
        if (P.raf) cancelAnimationFrame(P.raf);
        P.raf = null;
        vids.forEach((v) => { if (v) v.pause(); });
        playBtn.textContent = "▶";
        drawAll();
    }
    function playSource(k, from) {
        stopPlay();
        const v = vids[k];
        if (!v) return;
        const sel = S.sel[k];
        const a = from != null ? from : sel ? sel.a : srcUI[k].cursor;
        const b = sel && (from == null || (from >= sel.a && from < sel.b)) ? sel.b : durOf(k);
        P.on = true; P.mode = "src"; P.k = k; P.endAt = b;
        v.muted = S.mute;
        showPlayer(k);
        v.currentTime = a;
        v.play().catch(() => {});
        playBtn.textContent = "❚❚";
        const loop = () => {
            if (!P.on) return;
            timeLbl.textContent = `${k + 1}: ${fmt(v.currentTime)}`;
            drawSource(k);
            if (v.currentTime >= P.endAt - 0.01 || v.ended) { stopPlay(); seekShow(k, a); return; }
            P.raf = requestAnimationFrame(loop);
        };
        P.raf = requestAnimationFrame(loop);
    }
    function startPiece(i, o) {
        const p = S.pieces[i];
        const v = vids[p.src];
        if (!v) { stopPlay(); return; }
        vids.forEach((x, k) => { if (x && k !== p.src) x.pause(); });
        P.i = i;
        v.muted = S.mute;
        const want = p.in + o;
        if (Math.abs(v.currentTime - want) > 0.05) v.currentTime = want;
        showPlayer(p.src);
        v.play().catch(() => {});
        // следующий кусок из другого ролика — заранее перемотать, чтобы стык был без задержки
        const n = S.pieces[i + 1];
        if (n && n.src !== p.src && vids[n.src]) { try { vids[n.src].currentTime = n.in; } catch (e) { /* ок */ } }
    }
    function playEdit(from) {
        if (!S.pieces.length) { setStatus(T("Монтаж пуст: положите сюда кусок ролика", "The edit is empty: put a clip piece here"), "err"); return; }
        if (P.on) { vids.forEach((v) => { if (v) v.pause(); }); if (P.raf) cancelAnimationFrame(P.raf); }
        let t = from == null ? S.cur : from;
        if (t >= editLen() - 0.02) t = 0;
        const h = pieceAt(t);
        if (!h) return;
        P.on = true; P.mode = "edit"; P.fromT = t;
        playBtn.textContent = "❚❚";
        startPiece(h.i, h.o);
        const loop = () => {
            if (!P.on || P.mode !== "edit") return;
            const p = S.pieces[P.i];
            if (!p) { stopPlay(); return; }
            const v = vids[p.src];
            const st = starts();
            P.t = st[P.i] + clamp(v.currentTime - p.in, 0, p.len);
            if (v.currentTime >= p.in + p.len - 0.008 || v.ended) {
                if (P.i + 1 >= S.pieces.length) { stopPlay(); S.cur = P.fromT; showEditAt(S.cur); drawEdit(); return; }
                const n = S.pieces[P.i + 1];
                if (n.src === p.src && Math.abs(n.in - (p.in + p.len)) < 0.02) P.i++;   // кусок продолжается — просто дальше
                else startPiece(P.i + 1, 0);
            }
            // следить за курсором при приближении
            const pps = pxPerSec();
            if (S.zoom > 0 && X(P.t) > ecv.clientWidth - 30) { S.x0 = P.t - 30 / pps; }
            drawEdit();
            P.raf = requestAnimationFrame(loop);
        };
        P.raf = requestAnimationFrame(loop);
    }
    playBtn.addEventListener("click", () => { if (P.on) { const t = P.mode === "edit" ? P.t : null; stopPlay(); if (t != null) { S.cur = t; drawEdit(); } } else playEdit(); refocus(); });
    stopBtn.addEventListener("click", () => { const back = P.on && P.mode === "edit" ? P.fromT : null; stopPlay(); if (back != null) { S.cur = back; showEditAt(back); drawEdit(); } refocus(); });

    // ---------- кнопки ----------
    function paintTop() {
        bypBtn.classList.toggle("on", S.bypass);
        muteBtn.classList.toggle("on", S.mute);
        muteBtn.textContent = S.mute ? "🔇 БЕЗ ЗВУКА РОЛИКОВ" : "🔊 ЗВУК РОЛИКОВ";
        vids.forEach((v) => { if (v) v.muted = S.mute; });
    }
    bypBtn.addEventListener("click", () => {
        pushUndo(); S.bypass = !S.bypass; changed();
        setStatus(S.bypass ? T("⏭ Пульт видит ролики как есть", "⏭ the Pult sees the clips as they are") : T("Пульт видит монтаж", "the Pult sees the edit"), "ok");
        refocus();
    });
    muteBtn.addEventListener("click", () => { pushUndo(); S.mute = !S.mute; changed(); refocus(); });
    helpBtn.addEventListener("click", () => { help.style.display = help.style.display === "block" ? "none" : "block"; sizer.fit(); });

    // ---------- клавиши ----------
    keys.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
        let used = true;
        if (k === " ") { if (P.on) playBtn.click(); else playEdit(); }
        else if (k === "delete" || k === "backspace") delSel();
        else if (ctrl && (e.code === "KeyZ") && e.shiftKey) redo();
        else if (ctrl && e.code === "KeyZ") undo();
        else if (ctrl && e.code === "KeyY") redo();
        else if (ctrl && e.code === "KeyD") dupSel();
        else if (!ctrl && (e.code === "KeyS" || e.code === "KeyB")) splitAtCursor();
        else if (k === "arrowleft") setCursor(S.cur - (e.shiftKey ? 1 : frame()));
        else if (k === "arrowright") setCursor(S.cur + (e.shiftKey ? 1 : frame()));
        else if (k === "home") setCursor(0);
        else if (k === "end") setCursor(editLen());
        else used = false;
        if (used) { e.preventDefault(); e.stopPropagation(); }
    });
    root.addEventListener("pointerdown", (e) => { if (!["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) refocus(); });

    // ---------- изменения -> Пульт ----------
    function changed() {
        save();
        paintTop();
        drawAll();
        showPiece();
        scheduleRender();
    }
    function scheduleRender() {
        if (R.timer) clearTimeout(R.timer);
        if (S.bypass || !S.pieces.length) {
            if (!R.busy) setStatus(S.bypass ? T("⏭ ролики идут в Пульт как есть", "⏭ clips go to the Pult as they are") : "", "");
            return;
        }
        if (R.ref && R.key === editKey()) { setStatus(T(`🎬 Монтаж готов для Пульта · ${fmt(R.len)}`, `Edit ready for the Pult · ${fmt(R.len)}`), "ok"); return; }
        setStatus(T("Монтаж изменён — соберу для Пульта…", "Edit changed — building it for the Pult…"), "");
        R.timer = setTimeout(renderNow, 1400);
    }
    async function renderNow() {
        R.timer = null;
        if (S.bypass || !S.pieces.length || disposed) return;
        if (R.busy) { R.timer = setTimeout(renderNow, 600); return; }
        const key = editKey();
        R.busy = true;
        setStatus(T("🎬 Собираю монтаж для Пульта…", "🎬 Building the edit for the Pult…"), "");
        try {
            const res = await api.fetchApi("/neron/vsampler_render", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ json: JSON.stringify({ pieces: S.pieces, mute: S.mute }), videos: items }),
            });
            const d = await res.json();
            if (!d.ok) throw new Error(d.error || "error");
            if (key === editKey()) {
                R.ref = d.ref; R.key = key; R.len = d.length || 0;
                setStatus(T(`🎬 Монтаж готов для Пульта · ${fmt(R.len)}`, `Edit ready for the Pult · ${fmt(R.len)}`), "ok");
            }
        } catch (e) {
            setStatus(T("Не удалось собрать монтаж: ", "Could not build the edit: ") + e.message, "err");
        } finally {
            R.busy = false;
            if (key !== editKey() && !S.bypass) scheduleRender();
        }
    }

    function drawAll() {
        items.forEach((_, k) => drawSource(k));
        drawEdit();
    }

    // ---------- слежение за проводом ----------
    let itemsSig = null;
    function poll() {
        if (disposed || document.hidden) return;
        const cur = upstream();
        const sig = cur.map(refKey).join("||");
        if (sig === itemsSig) return;
        const old = items.map(refKey);
        itemsSig = sig;
        items = cur;
        // поменяли ролик в слоте — старые кадры и данные этого слота уже не годятся
        for (let k = 0; k < MAX_SRC; k++) if (old[k] !== refKey(items[k])) { info[k] = null; thumbs[k] = []; }
        stopPlay();
        syncPlayers();
        buildSources();
        thumbToken++;
        const tok = thumbToken;
        (async () => { for (let k = 0; k < items.length; k++) { if (!info[k] || !thumbs[k] || !thumbs[k].length) { fetchInfo(k); await makeThumbs(k, tok); } } })();
        if (shown < 0 || !items[shown]) showPlayer(items.length ? 0 : -1);
        if (S.pieces.length) showEditAt(S.cur); else if (items.length) seekShow(0, 0);
        sizer.fit();
        drawAll();
        scheduleRender();
    }
    const pollTimer = setInterval(poll, 700);

    // ---------- нода ----------
    const dom = node.addDOMWidget("neron_vsampler", "neron_vsampler", outer, { serialize: false, hideOnZoom: false });
    const helpH = () => (help.style.display === "block" ? help.offsetHeight + 6 : 0);
    const autoH = () => 34 + helpH() + Math.max(250, 18 + Math.max(1, items.length) * (SRC_H + 4)) + 6 + 18 + RULER_H + LANE_H + 14 + 30 + 34;
    const sizer = makeUserSized(node, dom, outer, { minH: 300, autoH, margin: 4, onLayout: () => drawAll() });
    outer.style.overflow = "hidden";
    new ResizeObserver(() => drawAll()).observe(root);
    const wanted = node.computeSize ? node.computeSize() : [1000, 520];
    node.setSize([Math.max(wanted[0], 1000), Math.max(wanted[1], 200)]);

    paintTop();
    showPiece();
    buildSources();
    drawAll();
    setTimeout(poll, 50);

    node.neronReload = () => {
        stopPlay();
        S = normalize((() => { try { return JSON.parse(jw ? jw.value : "{}"); } catch (e) { return {}; } })());
        undoS.length = 0; redoS.length = 0;
        itemsSig = null;
        paintTop(); showPiece();
        poll();
    };
    node.neronDispose = () => {
        disposed = true;
        stopPlay();
        clearInterval(pollTimer);
        if (R.timer) clearTimeout(R.timer);
        vids.forEach((v) => { if (v) { v.pause(); v.removeAttribute("src"); v.load(); } });
    };
}

app.registerExtension({
    name: "NeronAudio.VideoSamplerUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupVSampler(this);
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
