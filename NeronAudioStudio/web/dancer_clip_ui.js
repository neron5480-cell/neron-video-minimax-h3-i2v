import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ============================================================================
//  Neron Dancer (видео)
//  Танцовщица из вашего видеоролика (папка input/Neron_Dancers).
//  Нода слушает звук Neron-нод, определяет темп по ударам и подгоняет под него
//  скорость ролика и момент (фазу) так, чтобы шаги попадали в такт.
//  Музыка стоит - ролик плавно замирает.
//
//  Поля:
//   beats      - сколько ударов (тактов) музыки укладывается в один круг ролика
//   shift      - сдвиг ролика (0..1 круга), чтобы удар музыки попал на нужное движение
//   remove_bg  - убрать однотонный фон (цвет берётся по углам кадра)
//   bg_tolerance - насколько близкие к фону цвета считать фоном
//   background - свой фон за танцовщицей (полосы / сетка / лучи); при выборе
//                зелёный фон ролика вырезается автоматически
//   bg_color   - цвет фона
// ============================================================================

const PANEL_H = 440;
const TAU = Math.PI * 2;

// ---------- подслушивание звука страницы (свой, независимый от Neron Dancer) ----------

const taps = new Map();

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
    if (typeof AudioNode === "undefined" || AudioNode.prototype.__neronClipTapInstalled) return;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
        const r = orig.apply(this, arguments);
        try {
            if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode && !this.__neronClipTapped) {
                this.__neronClipTapped = true;
                orig.call(this, getTap(this.context).analyser);
            }
        } catch (e) { /* подслушивание не должно ничего ломать */ }
        return r;
    };
    AudioNode.prototype.__neronClipTapInstalled = true;
})();

function readLevels() {
    let bass = 0, level = 0;
    for (const t of taps.values()) {
        if (t.ctx.state !== "running") continue;
        t.analyser.getByteFrequencyData(t.data);
        const d = t.data;
        const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += d[i]; return s / (b - a) / 255; };
        bass = Math.max(bass, avg(0, 3));
        level = Math.max(level, avg(0, 120), bass * 0.9);
    }
    return { bass, level };
}

// ---------- свой фон за танцовщицей ----------

const BG_COLORS = {
    "розовая": { c: [255, 111, 181], d: [38, 12, 32] },
    "голубая": { c: [79, 177, 255], d: [8, 22, 42] },
    "сиреневая": { c: [154, 120, 255], d: [22, 14, 48] },
    "рыжая": { c: [255, 135, 80], d: [42, 20, 10] },
    "серебро": { c: [195, 205, 230], d: [22, 26, 38] },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

function drawBg(g, w, h, mode, pal, off, pulse, act, t) {
    g.clearRect(0, 0, w, h);
    if (mode === "нет") return;
    const c = pal.c, d = pal.d;
    const hor = h * 0.42, cx = w / 2;
    g.fillStyle = rgba(d, 1);
    g.fillRect(0, 0, w, h);
    const fl = Math.floor(off), f = off - fl;

    if (mode === "лучи") {
        const N = 20, R = Math.hypot(w, h), cy = h * 0.5, a0 = off * 0.08;
        for (let i = 0; i < N; i += 2) {
            const a = a0 + (i / N) * TAU, b = a0 + ((i + 1) / N) * TAU;
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
            g.lineTo(cx + Math.cos(b) * R, cy + Math.sin(b) * R);
            g.closePath();
            g.fillStyle = rgba(c, 0.16 + 0.1 * act + 0.2 * pulse * act);
            g.fill();
        }
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, h * 0.55);
        rg.addColorStop(0, rgba(c, 0.35 + 0.3 * pulse * act));
        rg.addColorStop(1, rgba(c, 0));
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
        return;
    }

    // небо и свечение у горизонта
    const sky = g.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, rgba(d, 1));
    sky.addColorStop(1, rgba(c, 0.30 + 0.25 * act + 0.2 * pulse * act));
    g.fillStyle = sky; g.fillRect(0, 0, w, hor + 1);

    // пол: полосы или линии сетки, летящие навстречу
    const N = 14, H = h - hor;
    if (mode === "полосы") {
        for (let k = -1; k <= N; k++) {
            const t0 = Math.max(0, (k + f) / N), t1 = Math.min(1, (k + 1 + f) / N);
            if (t1 <= t0) continue;
            const y0 = hor + H * t0 * t0, y1 = hor + H * t1 * t1;
            const par = (((k - fl) % 2) + 2) % 2;
            g.fillStyle = par ? rgba(c, 0.30 + 0.14 * pulse * act) : rgba(c, 0.07);
            g.fillRect(0, y0, w, y1 - y0 + 1);
        }
    } else {
        g.lineCap = "round";
        for (let k = 0; k <= N; k++) {
            const tt = (k + f) / N;
            if (tt <= 0 || tt > 1) continue;
            const y = hor + H * tt * tt;
            g.strokeStyle = rgba(c, (0.25 + 0.7 * tt) * (0.8 + 0.3 * pulse * act));
            g.lineWidth = 0.6 + 3 * tt;
            g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        }
        for (let j = -14; j <= 14; j++) {
            g.strokeStyle = rgba(c, 0.5 + 0.2 * pulse * act);
            g.lineWidth = 1.4;
            g.beginPath();
            g.moveTo(cx + j * w * 0.012, hor);
            g.lineTo(cx + j * w * 0.2, h);
            g.stroke();
        }
    }
    // дымка у горизонта, чтобы полосы уходили вдаль
    const fog = g.createLinearGradient(0, hor, 0, hor + H * 0.45);
    fog.addColorStop(0, rgba(d, 0.95));
    fog.addColorStop(1, rgba(d, 0));
    g.fillStyle = fog; g.fillRect(0, hor, w, H * 0.45);
    // линия горизонта
    const hl = g.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, rgba(c, 0)); hl.addColorStop(0.5, rgba(c, 0.9)); hl.addColorStop(1, rgba(c, 0));
    g.fillStyle = hl; g.fillRect(0, hor - 1, w, 2);
}

// ---------- мелочи ----------

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectStyles() {
    if (document.getElementById("neron-dclip-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-dclip-styles";
    s.textContent = `
.nc-root{box-sizing:border-box;width:100%;height:${PANEL_H}px;padding:8px 10px;background:#1b1d23;border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:7px;overflow:hidden}
.nc-row{display:flex;align-items:center;gap:6px;flex:none;min-width:0}
.nc-lbl{font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.5px;flex:none}
.nc-sel{flex:1;min-width:80px;height:24px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;
  border-radius:4px;font-size:11px;outline:none;padding:0 2px}
.nc-sel option{background:#23252b;color:#cfd2d8}
.nc-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;
  flex:none;line-height:24px;background:#4a4e5a;white-space:nowrap}
.nc-btn:hover{filter:brightness(1.18)}
.nc-stage{position:relative;flex:1;min-height:0;border-radius:8px;overflow:hidden;
  background:linear-gradient(180deg,#232634 0%,#1a1c26 100%)}
.nc-bg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.nc-glow{position:absolute;left:50%;top:50%;width:90%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle,rgba(255,170,220,.55) 0%,rgba(255,170,220,0) 70%);opacity:.15;pointer-events:none}
.nc-vwrap{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;will-change:transform}
.nc-vwrap video,.nc-vwrap canvas{max-width:100%;max-height:100%;object-fit:contain;display:block}
.nc-note{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;
  font-size:11px;color:#8b90a0;text-align:center;padding:0 16px;pointer-events:none;line-height:1.5}
.nc-status{font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}
.nc-status.err{color:#ff8a80}
.nc-ovl{flex:none;display:flex;flex-direction:column;gap:6px;order:-1}
.nc-params{display:none;flex-direction:column;gap:5px}
.nc-prow{display:flex;align-items:center;gap:8px;min-width:0}
.nc-prow label{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#aeb3c2;white-space:nowrap}
.nc-prow input[type=range]{width:70px;accent-color:#6f8cff}
.nc-prow input[type=number]{width:46px;height:20px;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;font-size:11px}
.nc-gear{display:none;position:absolute;right:8px;bottom:8px;width:26px;height:26px;border-radius:13px;border:none;cursor:pointer;
  background:rgba(20,22,30,.65);color:#fff;font-size:14px;line-height:26px;padding:0;z-index:3;opacity:0;transition:opacity .2s}
.nc-clean{padding:0;gap:0;background:transparent;position:relative;border-radius:14px}
.nc-clean .nc-stage{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:14px;cursor:grab}
.nc-clean .nc-ovl{position:absolute;left:0;right:0;top:0;z-index:2;padding:10px 10px 22px;order:0;
  background:linear-gradient(rgba(10,12,18,.94) 0%,rgba(10,12,18,.88) 70%,rgba(10,12,18,0) 100%);
  opacity:0;pointer-events:none;transition:opacity .2s}
.nc-clean .nc-params{display:flex}
.nc-clean .nc-status{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:16px 42px 8px 10px;
  background:linear-gradient(rgba(10,12,18,0),rgba(10,12,18,.9));opacity:0;pointer-events:none;transition:opacity .2s}
.nc-clean.nc-show .nc-ovl,.nc-clean.nc-show .nc-status{opacity:1}
.nc-clean.nc-show .nc-ovl{pointer-events:auto}
.nc-clean .nc-gear{display:block}
.nc-clean.nc-show .nc-gear{opacity:.0}
.nc-clean:hover .nc-gear,.nc-clean.nc-pin .nc-gear{opacity:.85}
`;
    document.head.appendChild(s);
}

function parseValue(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    const k = s.lastIndexOf("/");
    return { name: k >= 0 ? s.slice(k + 1) : s, subfolder: k >= 0 ? s.slice(0, k) : "", type };
}
const toValue = (f) => (f.subfolder ? f.subfolder + "/" : "") + f.name + (f.type && f.type !== "input" ? ` [${f.type}]` : "");
const keyOf = (f) => `${f.type || "input"}|${f.subfolder || ""}|${f.name}`;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function setupClip(node) {
    injectStyles();
    const getWidget = (n) => (node.widgets || []).find((x) => x.name === n);
    const clipW = getWidget("clip");
    if (clipW) { clipW.type = "hidden"; clipW.hidden = true; clipW.computeSize = () => [0, -4]; }
    const beatsW = getWidget("beats");
    const shiftW = getWidget("shift");
    const bgW = getWidget("remove_bg");
    const tolW = getWidget("bg_tolerance");
    const bgModeW = getWidget("background");
    const bgColW = getWidget("bg_color");

    const st = {
        files: [], loadedKey: "", raf: null, last: performance.now(), t: 0,
        bass: 0, level: 0, slow: 0, avgBass: 0, prevBass: 0, lastBeat: 0, beats: [], period: 0.5, measured: false,
        phase: 0, pulse: 0, rate: 0, bgOff: 0, act: 0, rules: { mb: 40, sec: 20, side: 1280 }, ready: false, info: "",
    };

    const root = el("div", "nc-root");
    const r1 = el("div", "nc-row");
    r1.appendChild(el("span", "nc-lbl", "РОЛИК"));
    const sel = el("select", "nc-sel");
    sel.title = "Ролики из папки input/Neron_Dancers";
    const refreshBtn = el("button", "nc-btn", "⟳");
    refreshBtn.title = "Обновить список роликов";
    const uploadBtn = el("button", "nc-btn", "ЗАГРУЗИТЬ");
    uploadBtn.style.background = "#3b6fb6";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "video/*,.webm,.mp4,.m4v,.mov,.gif";
    fileInput.style.display = "none";
    [sel, refreshBtn, uploadBtn, fileInput].forEach((x) => r1.appendChild(x));
    const ovl = el("div", "nc-ovl");
    ovl.appendChild(r1);
    const params = el("div", "nc-params");
    ovl.appendChild(params);

    const stage = el("div", "nc-stage");
    const bgCanvas = el("canvas", "nc-bg");
    const bgCtx = bgCanvas.getContext("2d");
    const glow = el("div", "nc-glow");
    const vwrap = el("div", "nc-vwrap");
    const video = document.createElement("video");
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
    video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
    const canvas = el("canvas");
    canvas.style.display = "none";
    const cctx = canvas.getContext("2d", { willReadFrequently: true });
    vwrap.appendChild(video); vwrap.appendChild(canvas);
    const note = el("div", "nc-note", "Положите ролик с танцем в папку input/Neron_Dancers\nили нажмите ЗАГРУЗИТЬ");
    note.style.whiteSpace = "pre-line";
    stage.appendChild(bgCanvas); stage.appendChild(glow); stage.appendChild(vwrap); stage.appendChild(note);
    root.appendChild(ovl);
    root.appendChild(stage);
    const gear = el("button", "nc-gear", "⚙");
    gear.title = "Настройки (закрепить / скрыть)";
    root.appendChild(gear);

    const status = el("div", "nc-status", "");
    root.appendChild(status);
    function setStatus(t, err) { status.textContent = t; status.title = t; status.className = "nc-status" + (err ? " err" : ""); }
    const rulesText = () => `Правила: до ${st.rules.mb} МБ, до ${st.rules.sec} с, до ${st.rules.side} px. Лучше webm с прозрачным фоном или однотонный фон + remove_bg`;
    setStatus(rulesText(), false);

    const curFile = () => parseValue(clipW ? clipW.value : "");

    function fillSelect() {
        const cur = curFile();
        sel.innerHTML = "";
        const first = el("option", "", st.files.length ? "- выберите ролик -" : "- роликов пока нет: нажмите ЗАГРУЗИТЬ -");
        first.value = "";
        sel.appendChild(first);
        const items = st.files.slice();
        if (cur && !items.some((f) => keyOf(f) === keyOf(cur))) items.unshift(cur);
        for (const f of items) {
            const o = el("option", "", f.name);
            o.value = keyOf(f);
            sel.appendChild(o);
        }
        sel.value = cur ? keyOf(cur) : "";
    }

    async function refreshList() {
        try {
            const res = await api.fetchApi(`/neron/list_dancers?t=${Date.now()}`);
            const d = await res.json();
            st.files = d.ok && Array.isArray(d.files) ? d.files : [];
            if (d.rules) { st.rules = d.rules; }
        } catch (e) { st.files = []; }
        fillSelect();
    }

    function selectFile(f) {
        if (clipW) {
            clipW.value = f ? toValue(f) : "";
            if (typeof clipW.callback === "function") { try { clipW.callback(clipW.value); } catch (e) { /* ок */ } }
        }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
        fillSelect();
        loadClip();
    }

    function loadClip() {
        const f = curFile();
        const key = f ? keyOf(f) : "";
        if (key === st.loadedKey) return;
        st.loadedKey = key;
        st.ready = false;
        video.pause();
        if (!f) {
            video.removeAttribute("src"); video.load();
            note.style.display = "flex";
            note.textContent = "Положите ролик с танцем в папку input/Neron_Dancers\nили нажмите ЗАГРУЗИТЬ";
            return;
        }
        note.style.display = "flex"; note.textContent = "Загружаю ролик...";
        const q = `filename=${encodeURIComponent(f.name)}&subfolder=${encodeURIComponent(f.subfolder)}&type=${encodeURIComponent(f.type)}`;
        video.src = api.apiURL("/view?" + q);
        video.load();
    }

    video.addEventListener("loadedmetadata", () => {
        st.ready = true;
        note.style.display = "none";
        const d = video.duration;
        if (d > st.rules.sec + 0.5) setStatus(`Ролик длинный (${d.toFixed(1)} с), лучше до ${st.rules.sec} с`, true);
        else setStatus(rulesText(), false);
        video.currentTime = 0;
        video.play().then(() => { if (st.rate < 0.07) video.pause(); }).catch(() => {});
    });
    video.addEventListener("error", () => {
        st.ready = false;
        note.style.display = "flex";
        note.textContent = "Браузер не смог открыть этот ролик.\nЛучше всего подходит webm (VP9) или mp4 (h264).";
    });

    // ---------- убрать однотонный фон ----------

    function drawKeyed(tolerance) {
        const vw = video.videoWidth, vh = video.videoHeight;
        if (!vw || !vh) return;
        const sc = Math.min(1, 480 / Math.max(vw, vh));
        const w = Math.max(2, Math.round(vw * sc)), h = Math.max(2, Math.round(vh * sc));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        cctx.drawImage(video, 0, 0, w, h);
        let img;
        try { img = cctx.getImageData(0, 0, w, h); } catch (e) { return; }
        const d = img.data;
        const bs = Math.max(2, Math.min(8, w >> 3, h >> 3));
        let r = 0, g = 0, b = 0, n = 0;
        for (const [x0, y0] of [[0, 0], [w - bs, 0], [0, h - bs], [w - bs, h - bs]]) {
            for (let y = y0; y < y0 + bs; y++) for (let x = x0; x < x0 + bs; x++) {
                const i = (y * w + x) * 4;
                r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
            }
        }
        r /= n; g /= n; b /= n;
        // уже прозрачный ролик (webm с альфой): ничего вырезать не нужно
        let aSum = 0, aN = 0;
        for (const [x0, y0] of [[0, 0], [w - bs, 0], [0, h - bs], [w - bs, h - bs]]) {
            for (let y = y0; y < y0 + bs; y++) for (let x = x0; x < x0 + bs; x++) { aSum += d[(y * w + x) * 4 + 3]; aN++; }
        }
        if (aSum / aN < 200) { cctx.putImageData(img, 0, 0); return; }
        const t = tolerance * 4.4, t2 = t * 1.5 + 1;
        for (let i = 0; i < d.length; i += 4) {
            const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < t) d[i + 3] = 0;
            else if (dist < t2) d[i + 3] = Math.round(d[i + 3] * (dist - t) / (t2 - t));
        }
        cctx.putImageData(img, 0, 0);
    }

    // ---------- такт ----------

    function onBeat(now) {
        if (st.lastBeat) {
            let iv = (now - st.lastBeat) / 1000;
            while (iv > 1.15) iv /= 2;
            if (iv >= 0.26) {
                st.beats.push(iv);
                if (st.beats.length > 8) st.beats.shift();
                const sorted = st.beats.slice().sort((a, b) => a - b);
                const med = sorted[Math.floor(sorted.length / 2)];
                st.period += (med - st.period) * 0.25;
                if (st.beats.length >= 3) st.measured = true;
            }
        }
        st.lastBeat = now;
        st.pulse = 1;
        const err = st.phase < 0.5 ? -st.phase : 1 - st.phase;
        st.phase += err * 0.35;
    }

    function frame(now) {
        st.raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const dt = Math.min(0.05, (now - st.last) / 1000);
        st.last = now;
        st.t += dt;

        const lv = readLevels();
        const k = 1 - Math.exp(-dt * 16);
        st.bass += (lv.bass - st.bass) * k;
        st.level += (lv.level - st.level) * k;
        const tau = lv.level > st.slow ? 0.25 : 0.9;
        st.slow += (lv.level - st.slow) * (1 - Math.exp(-dt / tau));
        st.avgBass += (st.bass - st.avgBass) * (1 - Math.exp(-dt * 2.2));
        const beat = st.bass > 0.3 && st.bass > st.avgBass * 1.22 + 0.04 && st.bass - st.prevBass > 0.01 && (now - st.lastBeat) > 230;
        st.prevBass = st.bass;
        if (beat) onBeat(now);
        st.pulse = Math.max(0, st.pulse - dt * 3);

        const playing = st.slow > 0.05;
        if (!playing) { st.beats.length = 0; st.measured = false; }
        st.act += ((playing ? 1 : 0) - st.act) * (1 - Math.exp(-dt * 2));
        st.phase += dt / st.period;
        if (st.phase >= 1) st.phase -= 1;

        // подсветка и лёгкий "пульс" на удар
        glow.style.opacity = (0.12 + st.act * (0.2 + st.slow * 0.6) + st.pulse * 0.12 * st.act).toFixed(3);
        vwrap.style.transform = `scale(${(1 + st.pulse * 0.025 * st.act).toFixed(4)})`;

        // свой фон: полосы летят тем быстрее, чем громче музыка
        const bgMode = bgModeW ? String(bgModeW.value) : "нет";
        st.bgOff += dt * (0.12 + st.act * (0.4 + st.slow * 2.0));
        const bw = stage.clientWidth, bh = stage.clientHeight;
        if (bw > 8 && bh > 8) {
            if (bgCanvas.width !== bw || bgCanvas.height !== bh) { bgCanvas.width = bw; bgCanvas.height = bh; }
            drawBg(bgCtx, bw, bh, bgMode, BG_COLORS[bgColW ? bgColW.value : "сиреневая"] || BG_COLORS["сиреневая"],
                st.bgOff, st.pulse, st.act, st.t);
        }
        glow.style.display = bgMode === "нет" ? "" : "none";

        if (!st.ready || !(video.duration > 0)) return;

        // ---- скорость и фаза ролика ----
        const L = video.duration;
        const nb = clampN(Math.round(Number(beatsW ? beatsW.value : 8) || 8), 1, 64);
        let rate = L / (nb * st.period), eff = nb;
        while (rate > 2.2) { rate /= 2; eff /= 2; }
        while (rate < 0.45) { rate *= 2; eff *= 2; }
        if (st.measured && playing) {
            const sh = clampN(Number(shiftW ? shiftW.value : 0) || 0, 0, 1);
            const vp = ((video.currentTime / L) * eff + sh) % 1;
            let e = st.phase - vp;
            e -= Math.round(e);                       // -0.5..0.5 удара
            rate *= 1 + clampN(e * 0.7, -0.3, 0.3);   // мягко догоняем фазу
        }
        const target = playing ? rate : 0;
        const tc = target > st.rate ? 2.5 : 1.6;
        st.rate += (target - st.rate) * (1 - Math.exp(-dt * tc));
        if (st.rate < 0.07) {
            if (!video.paused) video.pause();
        } else {
            if (video.paused) video.play().catch(() => {});
            video.playbackRate = clampN(st.rate, 0.0625, 4);
        }

        // ---- показ: видео как есть или с убранным фоном ----
        const keyed = !!(bgW && bgW.value) || bgMode !== "нет";
        if (keyed) {
            drawKeyed(clampN(Number(tolW ? tolW.value : 30) || 30, 1, 100));
            canvas.style.display = ""; video.style.display = "none";
        } else {
            canvas.style.display = "none"; video.style.display = "";
        }

        const bpm = Math.round(60 / st.period);
        const info = playing ? `темп ~${bpm} BPM · скорость x${st.rate.toFixed(2)}${st.measured ? "" : " · ловлю ритм..."}` : "";
        if (info !== st.info) {
            st.info = info;
            if (info) setStatus(info, false); else setStatus(rulesText(), false);
        }
    }

    sel.addEventListener("change", () => {
        if (!sel.value) { selectFile(null); return; }
        const [type, subfolder, ...rest] = sel.value.split("|");
        selectFile({ type, subfolder, name: rest.join("|") });
    });
    sel.addEventListener("keydown", (e) => e.stopPropagation());
    refreshBtn.addEventListener("click", refreshList);
    uploadBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        setStatus("Загружаю " + file.name + "...", false);
        try {
            const fd = new FormData();
            fd.append("file", file, file.name);
            const res = await api.fetchApi("/neron/upload_dancer", { method: "POST", body: fd });
            const d = await res.json();
            if (!d.ok) { setStatus("Не подошло: " + d.error, true); return; }
            await refreshList();
            selectFile({ name: d.name, subfolder: d.subfolder, type: d.type });
            setStatus("Ролик загружен: input/" + d.subfolder + "/" + d.name + (d.warn ? " (" + d.warn + ")" : ""), false);
        } catch (e) {
            setStatus("Ошибка загрузки: " + e, true);
        }
    });

    // ---------- панель настроек поверх картинки ----------

    const ctl = [];
    function setW(w, v) {
        if (!w) return;
        w.value = v;
        if (typeof w.callback === "function") { try { w.callback(v); } catch (e) { /* ок */ } }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }
    function addRow() { const r = el("div", "nc-prow"); params.appendChild(r); return r; }
    function mkRange(row, label, w, min, max, step) {
        const l = el("label"); l.appendChild(document.createTextNode(label));
        const inp = document.createElement("input");
        inp.type = "range"; inp.min = min; inp.max = max; inp.step = step;
        const val = el("span", "", ""); val.style.minWidth = "26px";
        inp.addEventListener("input", () => { setW(w, Number(inp.value)); val.textContent = inp.value; });
        l.appendChild(inp); l.appendChild(val); row.appendChild(l);
        ctl.push(() => { if (w) { inp.value = w.value; val.textContent = String(w.value); } });
    }
    function mkCheck(row, label, w) {
        const l = el("label");
        const inp = document.createElement("input"); inp.type = "checkbox";
        inp.addEventListener("change", () => setW(w, inp.checked));
        l.appendChild(inp); l.appendChild(document.createTextNode(label)); row.appendChild(l);
        ctl.push(() => { if (w) inp.checked = !!w.value; });
    }
    function mkSelect(row, label, w, fallback) {
        const l = el("label"); l.appendChild(document.createTextNode(label));
        const inp = el("select", "nc-sel"); inp.style.flex = "none"; inp.style.minWidth = "70px";
        const vals = (w && w.options && Array.isArray(w.options.values)) ? w.options.values : fallback;
        for (const v of vals) { const o = el("option", "", v); o.value = v; inp.appendChild(o); }
        inp.addEventListener("change", () => setW(w, inp.value));
        inp.addEventListener("keydown", (e) => e.stopPropagation());
        l.appendChild(inp); row.appendChild(l);
        ctl.push(() => { if (w) inp.value = w.value; });
    }
    const pr1 = addRow();
    mkSelect(pr1, "ФОН", bgModeW, ["нет", "полосы", "сетка", "лучи"]);
    mkSelect(pr1, "ЦВЕТ", bgColW, ["розовая", "голубая", "сиреневая", "рыжая", "серебро"]);
    const pr2 = addRow();
    const bl = el("label"); bl.appendChild(document.createTextNode("УДАРОВ В КРУГЕ"));
    const bn = document.createElement("input"); bn.type = "number"; bn.min = 1; bn.max = 64; bn.step = 1;
    bn.addEventListener("change", () => setW(beatsW, clampN(Math.round(Number(bn.value) || 8), 1, 64)));
    bn.addEventListener("keydown", (e) => e.stopPropagation());
    bl.appendChild(bn); pr2.appendChild(bl);
    ctl.push(() => { if (beatsW) bn.value = beatsW.value; });
    mkRange(pr2, "СДВИГ", shiftW, 0, 1, 0.01);
    const pr3 = addRow();
    mkCheck(pr3, "ВЫРЕЗАТЬ ФОН", bgW);
    mkRange(pr3, "ДОПУСК", tolW, 1, 100, 1);
    const pr4 = addRow();
    const cleanLbl = el("label");
    const cleanCb = document.createElement("input"); cleanCb.type = "checkbox";
    cleanLbl.appendChild(cleanCb);
    cleanLbl.appendChild(document.createTextNode("ЧИСТЫЙ ЭКРАН (прятать рамку и заголовок ноды)"));
    pr4.appendChild(cleanLbl);
    const syncCtl = () => ctl.forEach((f) => f());

    // ---------- режим "чистый экран" ----------

    const widgetsToHide = [beatsW, shiftW, bgW, tolW, bgModeW, bgColW].filter(Boolean);
    const LG = () => (typeof window !== "undefined" ? window.LiteGraph : null);
    const getClean = () => !(node.properties && node.properties.neron_clean === false);
    let panelH = PANEL_H;

    function hideW(w) {
        if (!w.__nc) w.__nc = { type: w.type, cs: w.computeSize, hidden: w.hidden };
        w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4];
    }
    function showW(w) {
        if (!w.__nc) return;
        w.type = w.__nc.type; w.hidden = w.__nc.hidden;
        if (w.__nc.cs) w.computeSize = w.__nc.cs; else delete w.computeSize;
        delete w.__nc;
    }

    // режим заголовка: в разных версиях ComfyUI свойство бывает только для чтения,
    // поэтому пробуем несколько способов и ничему не даём бросить ошибку
    function setTitleMode(v) {
        if (v === undefined) return;
        try { Object.defineProperty(node, "title_mode", { get: () => v, configurable: true }); } catch (e) { /* ок */ }
        try { if (node.constructor) node.constructor.title_mode = v; } catch (e) { /* ок */ }
    }
    function trySet(obj, key, val) { try { obj[key] = val; } catch (e) { /* ок */ } }

    function applyChrome(resize) {
        try { applyChromeInner(resize); } catch (e) { console.warn("[Neron] чистый экран не применился:", e); }
    }
    function applyChromeInner(resize) {
        const clean = getClean();
        cleanCb.checked = clean;
        root.classList.toggle("nc-clean", clean);
        const L = LG();
        if (clean) {
            widgetsToHide.forEach(hideW);
            if (!node.__ncSaved) node.__ncSaved = { bg: node.bgcolor, color: node.color };
            trySet(node, "bgcolor", "#15171d"); trySet(node, "color", "#15171d");
            if (L) setTitleMode(L.NO_TITLE);
            panelH = PANEL_H;
        } else {
            widgetsToHide.forEach(showW);
            if (node.__ncSaved) { trySet(node, "bgcolor", node.__ncSaved.bg); trySet(node, "color", node.__ncSaved.color); node.__ncSaved = null; }
            if (L) setTitleMode(L.NORMAL_TITLE);
            panelH = PANEL_H;
        }
        root.style.height = panelH + "px";
        const curH = node.size ? node.size[1] : 0, curW = node.size ? node.size[0] : 340;
        if (clean) {
            // старая сохранённая высота оставляет пустую полосу под картинкой: подрезаем
            if (resize || curH > panelH + 40 || curH < panelH + 10) node.setSize([Math.max(curW, 340), panelH + 24]);
        } else if (resize) {
            const wanted = node.computeSize ? node.computeSize() : [340, 200];
            node.setSize([Math.max(wanted[0], 340), Math.max(wanted[1], panelH + 190)]);
        }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }
    cleanCb.addEventListener("change", () => {
        node.properties = node.properties || {};
        node.properties.neron_clean = cleanCb.checked;
        applyChrome(true);
    });

    // показ настроек при наведении
    let hideTimer = null, pinned = false;
    function showOvl() {
        clearTimeout(hideTimer);
        if (!root.classList.contains("nc-show")) { syncCtl(); root.classList.add("nc-show"); }
    }
    function hideOvlLater() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { if (!pinned && !root.matches(":focus-within")) root.classList.remove("nc-show"); }, 350);
    }
    root.addEventListener("pointerenter", showOvl);
    root.addEventListener("pointermove", showOvl);
    root.addEventListener("pointerleave", hideOvlLater);
    gear.addEventListener("click", (e) => {
        e.stopPropagation();
        pinned = !pinned;
        root.classList.toggle("nc-pin", pinned);
        if (pinned) showOvl(); else hideOvlLater();
    });

    // перетаскивание ноды за картинку (заголовка в чистом режиме нет)
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
        if (!getClean() || e.button !== 0) return;
        const cv = app.canvas;
        try { if (cv && cv.selectNode) cv.selectNode(node); else if (cv && cv.selectItem) cv.selectItem(node); } catch (err) { /* ок */ }
        drag = { x: e.clientX, y: e.clientY, px: node.pos[0], py: node.pos[1], moved: false };
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ок */ }
        stage.style.cursor = "grabbing";
        e.preventDefault();
    });
    stage.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const sc = (app.canvas && app.canvas.ds && app.canvas.ds.scale) || 1;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        node.pos[0] = drag.px + dx / sc;
        node.pos[1] = drag.py + dy / sc;
        if (app.canvas && app.canvas.setDirty) app.canvas.setDirty(true, true);
    });
    const endDrag = (e) => {
        if (!drag) return;
        drag = null; stage.style.cursor = "";
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* ок */ }
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    const domWidget = node.addDOMWidget("neron_dancer_clip", "neron_dancer_clip", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => panelH,
        getMaxHeight: () => panelH,
    });
    domWidget.computeSize = (width) => [width, panelH];

    node.properties = node.properties || {};
    applyChrome(true);
    syncCtl();

    st.raf = requestAnimationFrame(frame);
    node.neronClipReload = () => { st.loadedKey = ""; fillSelect(); loadClip(); applyChrome(false); syncCtl(); };
    node.neronClipDispose = () => { if (st.raf) cancelAnimationFrame(st.raf); st.raf = null; video.pause(); video.removeAttribute("src"); };
    node.neronClipState = st;

    refreshList();
    setTimeout(loadClip, 100);
}

app.registerExtension({
    name: "NeronAudio.DancerClipUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronDancerClip") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupClip(this);
            return r;
        };

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const self = this;
            setTimeout(() => { if (self.neronClipReload) self.neronClipReload(); }, 0);
            return r;
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronClipDispose) this.neronClipDispose();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
