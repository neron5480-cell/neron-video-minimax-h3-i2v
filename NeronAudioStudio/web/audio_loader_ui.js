import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { neronTap, makeUserSized } from "./neron_common.js";

// ============================================================================
//  Neron Audio Loader
//  * Выбираете звуковой файл из списка или загружаете со своего компьютера.
//  * Слушаете прямо на ноде (кнопка Queue не нужна), видите волну.
//  * Края отрезка можно перетащить мышкой на волне (или ввести секунды в полях
//    start_sec / end_sec). end_sec = 0 означает "до конца файла".
//  * Подключите выход audio к входу audio_N микшера - файл будет слышно и там.
// ============================================================================

const PANEL_H = 250;
const W = 900, H = 120;

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectStyles() {
    if (document.getElementById("neron-aload-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-aload-styles";
    s.textContent = `
.na-root{box-sizing:border-box;width:100%;height:${PANEL_H}px;padding:8px 10px;background:var(--nt-panel,#1b1d23);border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:var(--nt-text,#cfd2d8);user-select:none;display:flex;flex-direction:column;gap:7px;overflow:hidden}
.na-row{display:flex;align-items:center;gap:6px;flex:none;min-width:0}
.na-lbl{font-size:10px;font-weight:700;color:var(--nt-muted,#8b90a0);letter-spacing:.5px;flex:none}
.na-sel{flex:1;min-width:80px;height:24px;box-sizing:border-box;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);border:1px solid var(--nt-line,#33363e);
  border-radius:4px;font-size:11px;outline:none;padding:0 2px}
.na-sel option{background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8)}
.na-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;
  flex:none;line-height:24px;background:var(--nt-btn,#4a4e5a);white-space:nowrap}
.na-btn:hover{filter:brightness(1.18)}
.na-wave{position:relative;flex:1;min-height:${H}px;background:var(--nt-deep,#15171c);border-radius:6px;overflow:hidden;cursor:ew-resize;touch-action:none}
.na-wave canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.na-note{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;
  font-size:11px;color:var(--nt-muted,#8b90a0);text-align:center;padding:0 10px;pointer-events:none}
.na-ph{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.9;display:none;pointer-events:none}
.na-info{flex:1;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:60px}
.na-check{display:flex;align-items:center;gap:3px;font-size:10px;font-weight:700;color:var(--nt-muted2,#9aa0ae);white-space:nowrap;cursor:pointer;flex:none}
.na-status{font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.na-status.err{color:#ff8a80}
`;
    document.head.appendChild(s);
}

let sharedCtx = null;
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

const fmtT = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
};

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

function setupLoaderUI(node) {
    injectStyles();
    const getWidget = (n) => (node.widgets || []).find((x) => x.name === n);
    const fileW = getWidget("audio_file");
    if (fileW) { fileW.type = "hidden"; fileW.hidden = true; fileW.computeSize = () => [0, -4]; }
    const startW = getWidget("start_sec");
    const endW = getWidget("end_sec");

    const st = { buf: null, loadedKey: "", loading: false, failedKey: "", files: [], play: null, raf: null, drag: null, pos: 0 };

    const root = el("div", "na-root");

    const r1 = el("div", "na-row");
    r1.appendChild(el("span", "na-lbl", "ФАЙЛ"));
    const sel = el("select", "na-sel");
    sel.title = "Звуковые файлы из папок input и output ComfyUI";
    r1.appendChild(sel);
    const refreshBtn = el("button", "na-btn", "⟳");
    refreshBtn.title = "Обновить список файлов";
    const uploadBtn = el("button", "na-btn", "ЗАГРУЗИТЬ");
    uploadBtn.style.background = "#3b6fb6";
    uploadBtn.title = "Выбрать звуковой файл на компьютере (копия ляжет в input/Neron_Audio)";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "audio/*,.wav,.mp3,.flac,.ogg,.opus,.m4a,.aac,.wma,.aif,.aiff";
    fileInput.style.display = "none";
    r1.appendChild(refreshBtn);
    r1.appendChild(uploadBtn);
    r1.appendChild(fileInput);
    root.appendChild(r1);

    const wave = el("div", "na-wave");
    const canvas = el("canvas");
    canvas.width = W; canvas.height = H;
    const ph = el("div", "na-ph");
    const note = el("div", "na-note", "Выберите файл в списке или нажмите ЗАГРУЗИТЬ");
    wave.appendChild(canvas); wave.appendChild(note); wave.appendChild(ph);
    root.appendChild(wave);

    const r3 = el("div", "na-row");
    const playBtn = el("button", "na-btn", "▶ PLAY");
    playBtn.style.background = "#3fa34d";
    const stopBtn = el("button", "na-btn", "■ STOP");
    stopBtn.style.background = "#b3414a";
    const resetBtn = el("button", "na-btn", "СБРОС ОБРЕЗКИ");
    resetBtn.title = "Играть и отдавать файл целиком";
    const loopLbl = el("label", "na-check");
    const loopCb = document.createElement("input");
    loopCb.type = "checkbox";
    loopLbl.appendChild(loopCb);
    loopLbl.appendChild(document.createTextNode("ПО КРУГУ"));
    const info = el("div", "na-info", "");
    [playBtn, stopBtn, resetBtn, loopLbl, info].forEach((x) => r3.appendChild(x));
    root.appendChild(r3);

    const status = el("div", "na-status", "Клик по волне - перемотка. Жёлтые края отрезка можно тянуть мышкой");
    root.appendChild(status);
    function setStatus(t, err) { status.textContent = t; status.title = t; status.className = "na-status" + (err ? " err" : ""); }

    // ---------- данные ----------

    const curFile = () => parseValue(fileW ? fileW.value : "");
    const total = () => (st.buf ? st.buf.duration : 0);
    const getStart = () => Math.max(0, Number(startW ? startW.value : 0) || 0);
    const getEnd = () => {
        const e = Number(endW ? endW.value : 0) || 0;
        const T = total();
        return e > 0 && (!T || e < T) ? e : T;
    };

    function setWidget(w, v) {
        if (!w) return;
        w.value = Math.round(v * 100) / 100;
        if (typeof w.callback === "function") { try { w.callback(w.value); } catch (e) { /* ок */ } }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }

    function fillSelect() {
        const cur = curFile();
        sel.innerHTML = "";
        const first = el("option", "", st.files.length ? "- выберите файл -" : "- файлов пока нет: нажмите ЗАГРУЗИТЬ -");
        first.value = "";
        sel.appendChild(first);
        const items = st.files.slice();
        if (cur && !items.some((f) => keyOf(f) === keyOf(cur))) items.unshift(cur);
        for (const f of items) {
            const o = el("option", "", `[${f.type === "output" ? "out" : "in"}] ${f.subfolder ? f.subfolder + "/" : ""}${f.name}`);
            o.value = keyOf(f);
            sel.appendChild(o);
        }
        sel.value = cur ? keyOf(cur) : "";
    }

    async function refreshList() {
        try {
            const res = await api.fetchApi(`/neron/list_audio?t=${Date.now()}`);
            const d = await res.json();
            st.files = d.ok && Array.isArray(d.files) ? d.files : [];
        } catch (e) { st.files = []; }
        fillSelect();
    }

    // ---------- загрузка звука и волна ----------

    async function loadBuffer() {
        const f = curFile();
        const key = f ? keyOf(f) : "";
        if (!f) {
            st.buf = null; st.loadedKey = "";
            note.style.display = "flex"; note.textContent = "Выберите файл в списке или нажмите ЗАГРУЗИТЬ";
            drawWave(); showInfo();
            return;
        }
        if (st.loading || st.loadedKey === key || st.failedKey === key) return;
        st.loading = true;
        note.style.display = "flex"; note.textContent = "Загружаю звук...";
        try {
            const res = await api.fetchApi("/neron/preview_wav", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "file", name: f.name, subfolder: f.subfolder, kind: f.type, start: 0, end: 0 }),
                cache: "no-store",
            });
            if (!res.ok) throw new Error((await res.text()) || ("HTTP " + res.status));
            const data = await res.arrayBuffer();
            st.buf = await getCtx().decodeAudioData(data);
            st.loadedKey = key;
            st.failedKey = "";
            note.style.display = "none";
            setStatus("Файл загружен. Клик по волне - перемотка, жёлтые края отрезка можно тянуть", false);
            showPosLine();
        } catch (e) {
            st.buf = null; st.loadedKey = ""; st.failedKey = key;
            note.style.display = "flex"; note.textContent = String(e && e.message ? e.message : e);
            setStatus("Не удалось загрузить файл: " + (e && e.message ? e.message : e), true);
        } finally {
            st.loading = false;
        }
        drawWave(); showInfo();
    }

    function drawWave() {
        const g = canvas.getContext("2d");
        g.clearRect(0, 0, W, H);
        const buf = st.buf;
        if (!buf) return;
        const L = buf.getChannelData(0);
        const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
        const per = Math.max(1, Math.floor(buf.length / W));
        const T = buf.duration;
        const a = getStart() / T * W, b = getEnd() / T * W;
        for (let x = 0; x < W; x++) {
            let peak = 0;
            const i0 = x * per, i1 = Math.min(buf.length, i0 + per);
            for (let i = i0; i < i1; i += Math.max(1, per >> 6)) {
                const v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
                if (v > peak) peak = v;
            }
            const h = Math.max(1, peak * H * 0.92);
            g.fillStyle = x >= a && x <= b ? "#1dd1a1" : "#3a4048";
            g.fillRect(x, (H - h) / 2, 1, h);
        }
        g.fillStyle = "#ffd166";
        g.fillRect(Math.max(0, a - 1), 0, 3, H);
        g.fillRect(Math.min(W - 3, b - 1), 0, 3, H);
    }

    function showInfo() {
        if (!st.buf) { info.textContent = ""; return; }
        const s = getStart(), e = getEnd();
        info.textContent = `всего ${fmtT(st.buf.duration)} · отрезок ${fmtT(s)} - ${fmtT(e)} (${(e - s).toFixed(2)} с)`;
        info.title = info.textContent;
    }

    // ---------- перемотка и перетаскивание краёв ----------
    // Клик по волне - перемотать на это место. Жёлтые края отрезка тянутся мышкой.

    function xToTime(clientX) {
        const r = wave.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total();
    }

    function showPosLine() {
        const T = total();
        if (!T) { ph.style.display = "none"; return; }
        ph.style.display = "block";
        ph.style.left = (st.pos / T * 100) + "%";
    }

    wave.addEventListener("pointerdown", (ev) => {
        if (!st.buf) return;
        const r = wave.getBoundingClientRect();
        const T = total();
        const px = (t) => r.left + (t / T) * r.width;
        const dS = Math.abs(ev.clientX - px(getStart()));
        const dE = Math.abs(ev.clientX - px(getEnd()));
        if (Math.min(dS, dE) <= 8) st.drag = dS <= dE ? "start" : "end";
        else st.drag = "seek";
        wave.setPointerCapture(ev.pointerId);
        moveDrag(ev);
        ev.preventDefault();
        ev.stopPropagation();
    });
    function moveDrag(ev) {
        if (!st.drag || !st.buf) return;
        const t = xToTime(ev.clientX);
        const T = total();
        if (st.drag === "seek") {
            st.pos = t;
            showPosLine();
            if (st.play) scheduleSeek();
            return;
        }
        if (st.drag === "start") setWidget(startW, Math.min(t, getEnd() - 0.05));
        else {
            const v = Math.max(t, getStart() + 0.05);
            setWidget(endW, v >= T - 0.01 ? 0 : v);
        }
        drawWave(); showInfo();
    }
    let seekTimer = null;
    function scheduleSeek() {
        if (seekTimer) return;
        seekTimer = setTimeout(() => { seekTimer = null; if (st.play) startPlay(); }, 120);
    }
    wave.addEventListener("pointermove", moveDrag);
    const endDrag = () => {
        if (st.drag && st.play) startPlay();
        st.drag = null;
    };
    wave.addEventListener("pointerup", endDrag);
    wave.addEventListener("pointercancel", endDrag);

    // ---------- проигрывание ----------

    function stopPlay() {
        if (st.play) {
            const p = st.play;
            const el2 = getCtx().currentTime - p.t0;
            if (el2 >= 0) {
                const len = p.e - p.s;
                st.pos = p.loop ? p.s + (((p.start - p.s) + el2) % len) : Math.min(p.start + el2, p.e);
                if (!p.loop && st.pos >= p.e - 0.02) st.pos = p.s;
            }
            try { p.src.onended = null; p.src.stop(); } catch (e) { /* ок */ }
            try { p.src.disconnect(); } catch (e) { /* ок */ }
        }
        st.play = null;
        if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
        showPosLine();
    }

    function startPlay() {
        if (!st.buf) { setStatus("Сначала выберите файл", true); return; }
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const s = getStart(), e = getEnd();
        if (e - s < 0.02) { setStatus("Отрезок пустой: проверьте начало и конец", true); return; }
        // свежая позиция (если уже играло - берём место из выбранной st.pos)
        if (st.play) {
            try { st.play.src.onended = null; st.play.src.stop(); } catch (er) { /* ок */ }
            try { st.play.src.disconnect(); } catch (er) { /* ок */ }
            st.play = null;
        }
        let start = st.pos;
        if (!(start >= s && start < e - 0.02)) start = s;
        const src = ctx.createBufferSource();
        src.buffer = st.buf;
        if (loopCb.checked) { src.loop = true; src.loopStart = s; src.loopEnd = e; }
        const gain = ctx.createGain();
        gain.gain.value = 0.9;
        src.connect(gain); gain.connect(ctx.destination); neronTap(ctx, gain);
        const t0 = ctx.currentTime + 0.03;
        if (loopCb.checked) src.start(t0, start);
        else src.start(t0, start, e - start);
        st.play = { src, t0, s, e, start, loop: loopCb.checked };
        src.onended = () => {
            if (st.play && st.play.src === src && !st.play.loop) {
                st.play = null; st.pos = s;
                if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
                showPosLine();
            }
        };
        if (st.raf) cancelAnimationFrame(st.raf);
        const frame = () => {
            if (!st.play) return;
            const p = st.play;
            const el2 = getCtx().currentTime - p.t0;
            if (el2 >= 0) {
                const len = p.e - p.s;
                let cur;
                if (p.loop) cur = p.s + (((p.start - p.s) + el2) % len);
                else cur = Math.min(p.start + el2, p.e);
                st.pos = cur;
                showPosLine();
            }
            st.raf = requestAnimationFrame(frame);
        };
        st.raf = requestAnimationFrame(frame);
    }
    function restartPlay() { if (st.play) startPlay(); }

    playBtn.addEventListener("click", startPlay);
    stopBtn.addEventListener("click", () => { stopPlay(); setStatus("Пауза: PLAY продолжит с этого места. Клик по волне - перемотка", false); });
    loopCb.addEventListener("change", restartPlay);
    resetBtn.addEventListener("click", () => {
        setWidget(startW, 0); setWidget(endW, 0);
        st.pos = 0;
        drawWave(); showInfo(); showPosLine(); restartPlay();
    });

    // ---------- выбор и загрузка файла ----------

    function selectFile(f) {
        stopPlay();
        if (fileW) {
            fileW.value = f ? toValue(f) : "";
            if (typeof fileW.callback === "function") { try { fileW.callback(fileW.value); } catch (e) { /* ок */ } }
        }
        setWidget(startW, 0); setWidget(endW, 0);
        st.loadedKey = ""; st.failedKey = ""; st.pos = 0;
        fillSelect();
        loadBuffer();
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
            const res = await api.fetchApi("/neron/upload_audio", { method: "POST", body: fd });
            const d = await res.json();
            if (!d.ok) { setStatus("Не удалось загрузить: " + d.error, true); return; }
            await refreshList();
            selectFile({ name: d.name, subfolder: d.subfolder, type: d.type });
            setStatus("Файл загружен: input/" + d.subfolder + "/" + d.name, false);
        } catch (e) {
            setStatus("Ошибка загрузки: " + e, true);
        }
    });

    // ---------- слежение за полями (загрузка схемы, ручной ввод секунд) ----------

    let lastSig = "";
    const poll = setInterval(() => {
        if (document.hidden || st.drag) return;
        loadBuffer();
        const sig = `${getStart()}|${getEnd()}|${st.loadedKey}`;
        if (sig !== lastSig) {
            lastSig = sig;
            drawWave(); showInfo();
            if (fileW && sel.value !== (curFile() ? keyOf(curFile()) : "")) fillSelect();
        }
    }, 400);

    const domWidget = node.addDOMWidget("neron_audio_loader", "neron_audio_loader", root, {
        serialize: false,
        hideOnZoom: false,
    });
    // размер задаёт пользователь; волна растягивается вместе с нодой
    makeUserSized(node, domWidget, root, { minH: 170, autoH: () => PANEL_H, onLayout: () => requestAnimationFrame(() => { try { drawWave(); } catch (e) { /* ок */ } }) });

    const wanted = node.computeSize ? node.computeSize() : [520, 400];
    node.setSize([Math.max(wanted[0], 520), Math.max(wanted[1], PANEL_H + 150)]);

    node.neronReload = () => { stopPlay(); st.loadedKey = ""; st.failedKey = ""; lastSig = ""; fillSelect(); loadBuffer(); };
    node.neronDispose = () => { stopPlay(); clearInterval(poll); };

    refreshList();
    setTimeout(loadBuffer, 150);
}

app.registerExtension({
    name: "NeronAudio.AudioLoaderUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronAudioLoader") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupLoaderUI(this);
            return r;
        };

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
