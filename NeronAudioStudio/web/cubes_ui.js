import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { makeUserSized } from "./neron_common.js";

// ============================================================================
//  Кубики для Пульта / Cubes for the Pult
//  RU: «Видео ×3» — до трёх загрузчиков видео в одной ноде. «Звук ×8» — до
//      восьми загрузчиков звука. Загрузили один — открылся следующий, пустые
//      скрыты. Кубик одним проводом идёт в Пульт (Neron Mixer).
//  EN: "Video ×3" — up to three video loaders in one node. "Sound ×8" — up to
//      eight audio loaders. Load one and the next opens, empty ones stay hidden.
//      A cube goes into the Pult (Neron Mixer) with a single wire.
// ============================================================================

const MAX_V = 3, MAX_S = 8;
const VCOLORS = ["#4dabf7", "#f783ac", "#69db7c"];
const SCOLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const T = (ru, en) => `${ru} / ${en}`;

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}
const refKey = (v) => (v ? `${v.type || "input"}|${v.subfolder || ""}|${v.name}` : "");
const refLabel = (v) => `[${v.type === "output" ? "out" : "in"}] ${v.subfolder ? v.subfolder + "/" : ""}${v.name}`;
function viewUrl(v) {
    const p = `/view?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}`;
    return typeof api.apiURL === "function" ? api.apiURL(p) : p;
}
function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}

function injectStyles() {
    if (document.getElementById("neron-cube-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-cube-styles";
    s.textContent = `
.ncb-root{box-sizing:border-box;width:100%;padding:8px 10px;background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:#cfd2d8;user-select:none;display:flex;flex-direction:column;gap:6px;overflow:auto}
.ncb-top{display:flex;align-items:center;gap:8px;flex:none}
.ncb-top b{font-size:12px;letter-spacing:.5px;white-space:nowrap}
.ncb-status{flex:1;min-width:0;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncb-status.err{color:#ff8a80}
.ncb-btn{height:22px;padding:0 8px;border:none;border-radius:5px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;background:#4a4e5a;
  white-space:nowrap;line-height:22px;flex:none;font-family:inherit}
.ncb-btn:hover{filter:brightness(1.18)}
.ncb-sel{flex:1;min-width:60px;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;
  font-size:11px;outline:none;padding:0 2px}
.ncb-sel option{background:#23252b;color:#cfd2d8}
.ncb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;flex:1;min-height:0}
.ncb-card{display:flex;flex-direction:column;gap:5px;background:#242831;border-radius:7px;padding:6px;border:2px solid transparent;min-height:0}
.ncb-card.drop{border-color:#4dabf7}
.ncb-row{display:flex;align-items:center;gap:5px;min-width:0}
.ncb-num{font-size:12px;font-weight:700;flex:none}
.ncb-vbox{position:relative;flex:1;min-height:110px;background:#0e0f12;border-radius:5px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.ncb-vbox video{width:100%;height:100%;object-fit:contain;background:#000}
.ncb-empty{font-size:11px;color:#6b7080;text-align:center;padding:8px;line-height:1.5}
.ncb-info{font-size:9px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncb-list{display:flex;flex-direction:column;gap:4px}
.ncb-srow{display:flex;align-items:center;gap:6px;height:30px;background:#242831;border-radius:6px;padding:0 6px;border:2px solid transparent}
.ncb-srow.drop{border-color:#4dabf7}
.ncb-wave{flex:none;width:130px;height:22px;background:#15171c;border-radius:3px}
.ncb-dot{width:9px;height:9px;border-radius:50%;flex:none}
`;
    document.head.appendChild(s);
}

const HELP = {
    video: `NERON VIDEO ×3
===================================================
Up to three video clips in one node.
  • Pick a clip in slot 1 (list of input/output videos) or ⬆ upload it,
    or drop a video file onto the slot. Slot 2 opens, then slot 3.
  • Each clip can be watched right in the node.
  • ✕ removes a clip; the next ones move up.
  • Wire the "videos" output into the video input of the Neron Mixer (Pult).
    The Pult shows all clips; in the saved clip they play one after another
    (1 → 2 → 3).

===================================================
🇷🇺 РУССКИЙ
===================================================
До трёх роликов в одной ноде.
  • Выберите ролик в слоте 1 (список роликов из input и output) или ⬆ загрузите,
    или перетащите файл прямо на слот. Откроется слот 2, потом слот 3.
  • Каждый ролик можно посмотреть прямо в ноде.
  • ✕ убирает ролик, следующие сдвигаются вверх.
  • Выход videos подключите ко входу video у Neron Mixer (Пульта).
    Пульт покажет все ролики; в сохранённом клипе они идут друг за другом
    (1 → 2 → 3).
`,
    sound: `NERON SOUND ×8
===================================================
Up to eight sounds in one node.
  • Pick a file in row 1 or ⬆ upload it (or drop an audio file onto the row).
    The next row opens; empty rows stay hidden.
  • ▶ — listen to the sound right here.
  • ✕ removes a sound; the next ones move up.
  • Wire the "sounds" output into any audio_N input of the Neron Mixer (Pult).
    Every sound becomes its own channel there: volume, pan, M, S, level meter.

===================================================
🇷🇺 РУССКИЙ
===================================================
До восьми звуков в одной ноде.
  • Выберите файл в строке 1 или ⬆ загрузите (или перетащите звук на строку).
    Откроется следующая строка, пустые скрыты.
  • ▶ — послушать звук прямо здесь.
  • ✕ убирает звук, следующие сдвигаются вверх.
  • Выход sounds подключите к любому входу audio_N у Neron Mixer (Пульта).
    Там каждый звук станет своим каналом: громкость, баланс, M, S, уровни.
`,
};

function showHelp(text) {
    const overlay = el("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";
    const box = el("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;max-width:760px;max-height:85vh;" +
        "overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = text;
    const btn = el("button", "", "Close / Закрыть");
    btn.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;border:none;border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

async function fetchList(kind) {
    try {
        const res = await api.fetchApi(kind === "video" ? `/neron/list_videos?t=${Date.now()}` : `/neron/list_audio?t=${Date.now()}`);
        const d = await res.json();
        return d.ok ? (kind === "video" ? d.videos : d.files) || [] : [];
    } catch (e) {
        return [];
    }
}

async function upload(file, kind) {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await api.fetchApi(kind === "video" ? "/neron/upload_video" : "/neron/upload_audio", { method: "POST", body: fd });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || "upload error");
    return { name: d.name, subfolder: d.subfolder, type: d.type };
}

// ----------------------------------------------------------------------------
//  Общее: слоты, которые открываются по одному
// ----------------------------------------------------------------------------

function setupCube(node, kind) {
    injectStyles();
    const isV = kind === "video";
    const MAX = isV ? MAX_V : MAX_S;
    const key = isV ? "clips" : "sounds";
    const w = (node.widgets || []).find((x) => x.name === "cube_json");
    if (w) { w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4]; }

    let items = [];
    const load = () => {
        let o = null;
        try { o = JSON.parse(w ? w.value : "{}"); } catch (e) { o = null; }
        items = (o && Array.isArray(o[key]) ? o[key] : []).filter((x) => x && typeof x.name === "string").slice(0, MAX);
    };
    const save = () => {
        if (!w) return;
        w.value = JSON.stringify({ [key]: items });
        if (typeof w.callback === "function") { try { w.callback(w.value); } catch (e) { /* ок */ } }
        app.graph?.setDirtyCanvas(true, true);
    };
    // Пульт читает содержимое кубика прямо отсюда (без Queue)
    node.neronCube = () => ({ kind: isV ? "videos" : "sounds", items: items.map((x) => ({ ...x })) });

    const root = el("div", "ncb-root");
    const top = el("div", "ncb-top");
    const title = el("b", "", isV ? "🎬 " + T("ВИДЕО ×3", "VIDEO ×3") : "🎵 " + T("ЗВУК ×8", "SOUND ×8"));
    title.style.color = isV ? "#4dabf7" : "#ff9f43";
    const status = el("div", "ncb-status", "");
    const help = el("button", "ncb-btn", "📖");
    help.title = T("Справка", "Help");
    help.addEventListener("click", () => showHelp(HELP[kind]));
    [title, status, help].forEach((x) => top.appendChild(x));
    root.appendChild(top);
    const box = el("div", isV ? "ncb-grid" : "ncb-list");
    root.appendChild(box);
    const fileIn = el("input");
    fileIn.type = "file";
    fileIn.accept = isV ? "video/*,.mp4,.webm,.mov,.m4v" : "audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac";
    fileIn.style.display = "none";
    root.appendChild(fileIn);
    root.addEventListener("keydown", (e) => e.stopPropagation());

    function setStatus(t, err) { status.textContent = t || ""; status.title = t || ""; status.className = "ncb-status" + (err ? " err" : ""); }
    function summary() {
        setStatus(items.length
            ? (isV ? T(`роликов: ${items.length} из 3`, `clips: ${items.length} of 3`) : T(`звуков: ${items.length} из 8`, `sounds: ${items.length} of 8`))
                + " · " + T("провод → Пульт", "wire → Pult")
            : (isV ? T("выберите ролик в слоте 1", "pick a clip in slot 1") : T("выберите звук в строке 1", "pick a sound in row 1")));
    }

    let list = [];
    let uploadSlot = 0;
    function setItem(i, ref) {
        if (!ref) return;
        const v = { name: ref.name, subfolder: ref.subfolder || "", type: ref.type || "input" };
        if (!isV) { v.start = 0; v.end = 0; }
        if (i < items.length) items[i] = v; else items.push(v);
        save();
        build();
    }
    function removeItem(i) {
        stopSound();
        items.splice(i, 1);
        save();
        build();
    }
    async function onFiles(files, i) {
        for (const f of files) {
            const ok = isV ? /\.(mp4|webm|mov|m4v|ogv)$/i.test(f.name) : /\.(wav|mp3|flac|ogg|opus|m4a|aac|wma|aif|aiff)$/i.test(f.name);
            if (!ok) { setStatus(T("не тот тип файла: ", "wrong file type: ") + f.name, true); continue; }
            if (i >= MAX) break;
            setStatus(T("загружаю ", "uploading ") + f.name + "...");
            try { const r = await upload(f, kind); list = await fetchList(kind); setItem(i, r); i = Math.min(items.length, MAX); }
            catch (e) { setStatus(T("не удалось загрузить: ", "upload failed: ") + (e.message || e), true); }
        }
    }
    fileIn.addEventListener("change", () => { const fs = [...fileIn.files]; fileIn.value = ""; onFiles(fs, uploadSlot); });

    function makeSelect(i) {
        const sel = el("select", "ncb-sel");
        const fill = () => {
            const cur = items[i];
            sel.innerHTML = "";
            const o0 = el("option", "", cur ? "" : (isV ? T("— выберите ролик —", "— pick a clip —") : T("— выберите звук —", "— pick a sound —")));
            o0.value = "";
            sel.appendChild(o0);
            const arr = list.slice();
            if (cur && !arr.some((v) => refKey(v) === refKey(cur))) arr.unshift(cur);
            for (const v of arr) { const o = el("option", "", refLabel(v)); o.value = refKey(v); sel.appendChild(o); }
            sel.value = cur ? refKey(cur) : "";
            if (cur) sel.options[0].remove();
        };
        fill();
        sel.title = T("Файл из папок input / output", "A file from the input / output folders");
        sel.addEventListener("mousedown", async () => { const l = await fetchList(kind); if (l.length !== list.length) { list = l; fill(); } });
        sel.addEventListener("change", () => {
            if (!sel.value) return;
            const [type, subfolder, ...rest] = sel.value.split("|");
            setItem(i, { type, subfolder, name: rest.join("|") });
        });
        return sel;
    }
    function dropTarget(elm, i) {
        elm.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); e.stopPropagation(); elm.classList.add("drop"); } });
        elm.addEventListener("dragleave", () => elm.classList.remove("drop"));
        elm.addEventListener("drop", (e) => {
            elm.classList.remove("drop");
            if (!e.dataTransfer?.files?.length) return;
            e.preventDefault(); e.stopPropagation();
            onFiles([...e.dataTransfer.files], i);
        });
    }
    function upBtn(i) {
        const b = el("button", "ncb-btn", "⬆");
        b.title = T("Загрузить с компьютера", "Upload from computer");
        b.addEventListener("click", () => { uploadSlot = i; fileIn.click(); });
        return b;
    }
    function rmBtn(i) {
        const b = el("button", "ncb-btn", "✕");
        b.style.background = "#7a3b3b";
        b.title = T("Убрать", "Remove");
        b.addEventListener("click", () => removeItem(i));
        return b;
    }

    // ---------- звук: прослушивание прямо в строке ----------
    const snd = { src: null, i: -1, bufs: new Map() };
    function stopSound() {
        if (snd.src) { try { snd.src.stop(); } catch (e) { /* ок */ } }
        snd.src = null;
        snd.i = -1;
        for (const b of box.querySelectorAll(".ncb-play")) b.textContent = "▶";
    }
    async function bufFor(v) {
        const k = refKey(v);
        if (snd.bufs.has(k)) return snd.bufs.get(k);
        const res = await api.fetchApi("/neron/preview_wav", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "file", name: v.name, subfolder: v.subfolder || "", kind: v.type || "input", start: 0, end: 0 }),
        });
        if (!res.ok) throw new Error(await res.text());
        const buf = await getCtx().decodeAudioData(await res.arrayBuffer());
        if (snd.bufs.size > 12) snd.bufs.clear();
        snd.bufs.set(k, buf);
        return buf;
    }
    function drawWave(cv, buf, color) {
        const W = 260, H = 44;
        cv.width = W; cv.height = H;
        const g = cv.getContext("2d");
        g.clearRect(0, 0, W, H);
        if (!buf) return;
        const L = buf.getChannelData(0);
        const per = Math.max(1, Math.floor(buf.length / W));
        g.fillStyle = color;
        for (let x = 0; x < W; x++) {
            let p = 0;
            for (let j = x * per, e = Math.min(L.length, j + per); j < e; j += 8) { const a = Math.abs(L[j]); if (a > p) p = a; }
            const h = Math.max(1, p * H * 0.95);
            g.fillRect(x, (H - h) / 2, 1, h);
        }
    }

    // ---------- построение ----------
    function build() {
        stopSound();
        box.innerHTML = "";
        const shown = Math.min(MAX, items.length + 1);
        for (let i = 0; i < shown; i++) {
            const v = items[i];
            if (isV) {
                const card = el("div", "ncb-card");
                const row = el("div", "ncb-row");
                const n = el("span", "ncb-num", `${i + 1}`);
                n.style.color = VCOLORS[i];
                row.appendChild(n);
                row.appendChild(makeSelect(i));
                row.appendChild(upBtn(i));
                if (v) row.appendChild(rmBtn(i));
                card.appendChild(row);
                const vb = el("div", "ncb-vbox");
                if (v) {
                    const vid = document.createElement("video");
                    vid.controls = true; vid.muted = true; vid.preload = "metadata"; vid.playsInline = true;
                    vid.src = viewUrl(v);
                    const info = el("div", "ncb-info", v.name);
                    vid.addEventListener("loadedmetadata", () => {
                        info.textContent = `${v.name} · ${vid.duration.toFixed(2)} ${T("с", "s")} · ${vid.videoWidth}×${vid.videoHeight}`;
                    });
                    vb.appendChild(vid);
                    card.appendChild(vb);
                    card.appendChild(info);
                } else {
                    vb.appendChild(el("div", "ncb-empty", T("Выберите ролик в списке, ⬆ загрузите или перетащите файл сюда",
                        "Pick a clip in the list, ⬆ upload or drop a file here")));
                    card.appendChild(vb);
                }
                dropTarget(card, i);
                box.appendChild(card);
            } else {
                const row = el("div", "ncb-srow");
                const dot = el("span", "ncb-dot");
                dot.style.background = SCOLORS[i];
                const n = el("span", "ncb-num", `${i + 1}`);
                n.style.color = SCOLORS[i];
                row.appendChild(dot);
                row.appendChild(n);
                row.appendChild(makeSelect(i));
                row.appendChild(upBtn(i));
                if (v) {
                    const play = el("button", "ncb-btn ncb-play", "▶");
                    play.style.background = "#3fa34d";
                    play.title = T("Послушать (ещё раз — стоп)", "Listen (again — stop)");
                    const wave = el("canvas", "ncb-wave");
                    play.addEventListener("click", async () => {
                        if (snd.i === i) { stopSound(); return; }
                        stopSound();
                        try {
                            const buf = await bufFor(v);
                            const ctx = getCtx();
                            if (ctx.state === "suspended") await ctx.resume();
                            const src = ctx.createBufferSource();
                            src.buffer = buf;
                            src.connect(ctx.destination);
                            src.onended = () => { if (snd.src === src) stopSound(); };
                            src.start();
                            snd.src = src; snd.i = i;
                            play.textContent = "■";
                        } catch (e) { setStatus(T("не удалось прочитать: ", "cannot read: ") + (e.message || e), true); }
                    });
                    row.appendChild(play);
                    row.appendChild(wave);
                    row.appendChild(rmBtn(i));
                    bufFor(v).then((buf) => drawWave(wave, buf, SCOLORS[i])).catch(() => {});
                }
                dropTarget(row, i);
                box.appendChild(row);
            }
        }
        summary();
        if (sizer) sizer.fit();
    }

    const domWidget = node.addDOMWidget(isV ? "neron_video_cube" : "neron_sound_cube", "neron_cube", root, { serialize: false, hideOnZoom: false });
    let sizer = null;
    const autoH = () => {
        const shown = Math.min(MAX, items.length + 1);
        if (!isV) return 40 + shown * 34;
        const cols = Math.max(1, Math.floor(((node.size?.[0] || 700) - 30) / 238));
        return 44 + Math.ceil(shown / cols) * 220;
    };
    sizer = makeUserSized(node, domWidget, root, { minH: isV ? 200 : 80, autoH });
    const wanted = node.computeSize ? node.computeSize() : [600, 200];
    node.setSize([Math.max(wanted[0], isV ? 760 : 560), Math.max(wanted[1], 80)]);

    node.neronReload = () => { load(); build(); };
    node.neronDispose = () => { stopSound(); for (const v of root.querySelectorAll("video")) { try { v.removeAttribute("src"); v.load(); } catch (e) { /* ок */ } } };
    load();
    fetchList(kind).then((l) => { list = l; build(); });
    build();
}

app.registerExtension({
    name: "NeronAudio.CubesUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const kind = nodeData.name === "NeronVideoCube" ? "video" : nodeData.name === "NeronSoundCube" ? "sound" : null;
        if (!kind) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created ? created.apply(this, arguments) : undefined;
            setupCube(this, kind);
            return r;
        };
        const conf = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = conf ? conf.apply(this, arguments) : undefined;
            const self = this;
            setTimeout(() => { if (self.neronReload) self.neronReload(); }, 0);
            return r;
        };
        const removed = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDispose) this.neronDispose();
            return removed ? removed.apply(this, arguments) : undefined;
        };
    },
});
