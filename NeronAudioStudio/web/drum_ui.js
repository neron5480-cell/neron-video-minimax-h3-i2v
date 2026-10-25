import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createProjectBar } from "./neron_common.js";

// ============================================================================
//  Neron Drum Machine - интерфейс
//  * Библиотека звуков: папка input/Neron_Drums/<кит> (по умолчанию default).
//    Кладите туда скачанные паки с любыми вложенными папками.
//  * У каждой дорожки свои: название, цвет, папка с сэмплами, звук, громкость, баланс.
//  * Звук играет прямо в браузере, кнопка Queue для прослушивания не нужна.
// ============================================================================

const STEPS = 16;          // шагов в одном такте
const MIN_BARS = 1;
const MAX_BARS = 8;
const TOTAL = MAX_BARS * STEPS;
const DEFAULT_VOL = 0.8;
const DEFAULT_BPM = 90;
const BPM_MIN = 40;
const BPM_MAX = 300;
const MAX_TRACKS = 24;
const BASE_NODE_HEIGHT = 160;
const panelHeightFor = (rows) => 146 + 28 * rows;

const zeros = () => new Array(TOTAL).fill(0);

// Известные названия папок: для них свой цвет и стартовый рисунок.
const KNOWN = {
    KICKS:       { color: "#ff5a5f", steps: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] },
    HIHATS:      { color: "#ffd166", steps: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
    OPENHIHATS:  { color: "#f4a261" },
    PERCS:       { color: "#06d6a0" },
    SHAKERS:     { color: "#4cc9f0" },
    TAMBOURINES: { color: "#b388ff" },
    TOMS:        { color: "#ff8fab" },
};
const PALETTE = ["#ff9f43", "#54a0ff", "#1dd1a1", "#feca57", "#ff6b81", "#48dbfb", "#c8d6e5", "#ee5253", "#10ac84", "#a29bfe"];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

// "ＨＩＨＡＴＳ", "H I H A T S", "hihats" -> "HIHATS" (для сравнения)
function normKey(name) {
    return String(name).normalize("NFKC").toUpperCase().replace(/\s+/g, "");
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

function lastPart(path) {
    const parts = String(path).split("/");
    return displayName(parts[parts.length - 1]);
}

function knownFor(folder) {
    const parts = String(folder).split("/");
    return KNOWN[normKey(parts[parts.length - 1])];
}

function defaultSteps(folder) {
    const k = knownFor(folder);
    return k && k.steps ? Array.from({ length: TOTAL }, (_, i) => k.steps[i % STEPS]) : zeros();
}

function colorFor(folder, index) {
    const k = knownFor(folder);
    return k ? k.color : PALETTE[index % PALETTE.length];
}

const isHex = (c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);

function injectStyles() {
    if (document.getElementById("neron-drum-styles2")) return;
    const s = document.createElement("style");
    s.id = "neron-drum-styles2";
    s.textContent = `
.neron-root{box-sizing:border-box;width:100%;padding:8px 10px;background:#17181c;border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;user-select:none;display:flex;flex-direction:column;
  gap:4px;overflow:hidden}
.neron-rows{display:flex;flex-direction:column;gap:4px;flex:none}
.neron-row{display:grid;grid-template-columns:150px 112px 100px 56px 56px repeat(16,minmax(0,1fr));column-gap:4px;
  align-items:center;height:24px;flex:none}
.neron-head{height:14px;font-size:9px;color:#7d8290;letter-spacing:.5px}
.neron-head div{overflow:hidden;white-space:nowrap}
.neron-labelbox{display:flex;align-items:center;gap:4px;min-width:0}
.neron-rm{width:16px;height:16px;flex:none;border:none;border-radius:4px;background:#2b2e36;color:#9aa0ae;
  font-size:13px;line-height:16px;padding:0;cursor:pointer}
.neron-rm:hover{background:#b3414a;color:#fff}
.neron-color{width:18px;height:18px;flex:none;padding:0;border:none;border-radius:4px;background:none;cursor:pointer}
.neron-color::-webkit-color-swatch-wrapper{padding:0}
.neron-color::-webkit-color-swatch{border:1px solid #444;border-radius:4px}
.neron-name{flex:1;min-width:0;height:20px;box-sizing:border-box;background:transparent;border:1px solid transparent;
  border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.3px;padding:0 3px;outline:none;color:var(--c)}
.neron-name:hover{border-color:#33363e}
.neron-name:focus{border-color:#4a4f5c;background:#1f2228}
.neron-sample{width:100%;height:22px;box-sizing:border-box;font-size:10px;background:#23252b;color:#cfd2d8;
  border:1px solid #33363e;border-radius:4px;padding:0 2px;outline:none;min-width:0}
.neron-sample option{background:#23252b;color:#cfd2d8}
.neron-range{width:100%;height:14px;margin:0;padding:0;accent-color:var(--c);cursor:pointer}
.neron-cell{height:22px;box-sizing:border-box;border-radius:4px;background:#272a31;border:1px solid #343841;cursor:pointer}
.neron-cell.grp{background:#2f333b}
.neron-cell:hover{border-color:#5a5f6b}
.neron-cell.on{background:var(--c);border-color:var(--c);box-shadow:0 0 5px var(--c)}
.neron-cell.play{outline:2px solid rgba(255,255,255,.65);outline-offset:-2px}
.neron-barsrow{display:flex;align-items:center;gap:6px;height:24px;flex:none}
.neron-lbl2{width:108px;flex:none;font-size:11px;font-weight:700;color:#54a0ff;letter-spacing:.5px}
.neron-tabs{display:flex;gap:4px;flex:none}
.neron-tab{min-width:26px;height:22px;box-sizing:border-box;padding:0 6px;border:1px solid #343841;border-radius:5px;
  background:#272a31;color:#9aa0ae;font-size:11px;font-weight:700;cursor:pointer;position:relative}
.neron-tab:hover{border-color:#5a5f6b;color:#fff}
.neron-tab.sel{background:#54a0ff;border-color:#54a0ff;color:#10151c}
.neron-tab.playing::after{content:"";position:absolute;left:4px;right:4px;bottom:2px;height:2px;background:#fff;border-radius:1px}
.neron-bpm{display:flex;align-items:center;gap:8px;height:24px;flex:none}
.neron-bpm-label{width:108px;flex:none;font-size:11px;font-weight:700;color:#ff9f43;letter-spacing:.5px;cursor:pointer}
.neron-bpm-slider{flex:1;min-width:0;height:16px;margin:0;accent-color:#ff9f43;cursor:pointer}
.neron-num{width:56px;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;
  border-radius:4px;font-size:11px;text-align:center;outline:none}
.neron-bar{display:flex;align-items:center;gap:6px;height:28px;margin-top:2px;flex:none}
.neron-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;
  cursor:pointer;flex:none;line-height:24px}
.neron-btn:hover{filter:brightness(1.15)}
.neron-small{height:22px;padding:0 8px;line-height:22px;font-size:10px}
.neron-status{flex:1;min-width:0;font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;text-align:right}
.neron-status.err{color:#ff8a80}
.neron-addform{display:none;flex:1;min-width:0;align-items:center;gap:6px}
.neron-bar.adding .neron-addform{display:flex}
.neron-bar.adding .neron-status{display:none}
.neron-addform input[type=text]{flex:1;min-width:60px;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;
  border:1px solid #6b4fb3;border-radius:4px;font-size:11px;padding:0 6px;outline:none}
.neron-addform select{width:190px;flex:none;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;
  border:1px solid #6b4fb3;border-radius:4px;font-size:11px;outline:none}
.neron-addform select option{background:#23252b;color:#cfd2d8}
`;
    document.head.appendChild(s);
}

// ----------------------------------------------------------------------------
//  Звуковой движок (общий для всех нод)
// ----------------------------------------------------------------------------

let sharedCtx = null;
const bufferPromises = new Map();
const bufferReady = new Map();

function getCtx() {
    if (!sharedCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        sharedCtx = new AC();
    }
    return sharedCtx;
}

function toStereo(ctx, buf) {
    const out = ctx.createBuffer(2, buf.length, buf.sampleRate);
    const left = buf.getChannelData(0);
    const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
    out.copyToChannel(left, 0);
    out.copyToChannel(right, 1);
    return out;
}

function bufferKey(kit, folder, file) {
    return `${kit}|${folder}|${file}`;
}

function loadBuffer(kit, folder, file) {
    const key = bufferKey(kit, folder, file);
    if (bufferPromises.has(key)) return bufferPromises.get(key);

    const promise = (async () => {
        try {
            const url = `/neron/get_sample?kit=${encodeURIComponent(kit)}&inst=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`;
            const res = await api.fetchApi(url, { cache: "no-store" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.arrayBuffer();
            const ctx = getCtx();
            const decoded = await ctx.decodeAudioData(data);
            const stereo = toStereo(ctx, decoded);
            bufferReady.set(key, stereo);
            return stereo;
        } catch (e) {
            console.warn("[Neron] Не удалось загрузить сэмпл:", folder, file, e);
            return null;
        }
    })();

    bufferPromises.set(key, promise);
    promise.then((b) => { if (!b) bufferPromises.delete(key); });
    return promise;
}

function buildTrackChain(ctx, master) {
    // сэмпл -> разделение на L/R -> баланс -> громкость -> общий выход
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

function setupNeronUI(node) {
    injectStyles();

    const getWidget = (name) => (node.widgets || []).find((x) => x.name === name);

    function hideWidget(w) {
        if (!w) return;
        w.type = "hidden";
        w.hidden = true;
        w.computeSize = () => [0, -4];
    }

    const patternWidget = getWidget("pattern_json");
    const bpmWidget = getWidget("bpm");
    hideWidget(patternWidget);
    hideWidget(bpmWidget); // вместо числа - ползунок в панели ниже

    // tracks: список { id, name, color, folder, sample, steps, vol, pan }
    const state = { tracks: [], bars: 1, auto: false, seeded: false };
    let uid = 1;
    let page = 0;           // какой такт показан сейчас
    let playPage = -1;      // в каком такте сейчас играет
    let playGlobal = -1;    // номер шага, который играет сейчас
    let follow = true;      // переключать страницу вслед за игрой
    let autoTimer = null;
    const ui = new Map();   // id дорожки -> элементы строки
    let kitInfo = { ok: false, instruments: {}, searched: [] };
    let lastSig = "";
    let panelH = panelHeightFor(0);
    let audio = null;
    let playing = false;
    let starting = false;
    let timer = null;
    let raf = null;
    let pollTimer = null;
    let bpmTimer = null;
    let nextTime = 0;
    let stepIndex = 0;
    let lastCol = -1;
    let loadToken = 0;
    const queue = [];
    const sources = new Set();

    // ---------- данные ----------

    function currentKit() {
        const v = getWidget("kit_name")?.value;
        const s = (v === undefined || v === null) ? "" : String(v).trim();
        return s === "" ? "default" : s;
    }

    function getBpm() {
        const v = Number(bpmWidget?.value);
        return clamp(Number.isFinite(v) && v > 0 ? v : DEFAULT_BPM, BPM_MIN, BPM_MAX);
    }

    function allFolders() {
        return kitInfo.ok && kitInfo.instruments ? Object.keys(kitInfo.instruments) : [];
    }

    function filesOf(folder) {
        return (kitInfo.instruments && kitInfo.instruments[folder]) || [];
    }

    function makeTrack(folder, name, color, steps) {
        const files = filesOf(folder);
        return {
            id: uid++, name: name || lastPart(folder), color, folder,
            sample: files.length ? files[0] : "", steps: steps || zeros(), vol: DEFAULT_VOL, pan: 0,
        };
    }

    function cleanTrack(raw, i) {
        if (Array.isArray(raw)) raw = { steps: raw };
        if (!raw || typeof raw !== "object" || typeof raw.folder !== "string" || !raw.folder) return null;
        const folder = raw.folder;
        const t = {
            id: uid++, folder,
            name: typeof raw.name === "string" && raw.name.trim() ? raw.name.slice(0, 40) : lastPart(folder),
            color: isHex(raw.color) ? raw.color : colorFor(folder, i),
            sample: typeof raw.sample === "string" ? raw.sample : "",
            steps: defaultSteps(folder), vol: DEFAULT_VOL, pan: 0,
        };
        if (Array.isArray(raw.steps)) t.steps = Array.from({ length: TOTAL }, (_, k) => (raw.steps[k] ? 1 : 0));
        if (typeof raw.vol === "number") t.vol = clamp(raw.vol, 0, 1);
        if (typeof raw.pan === "number") t.pan = clamp(raw.pan, -1, 1);
        return t;
    }

    // Понимает новый формат (список) и старый (словарь: папка -> дорожка)
    function loadState(value) {
        const tracks = [];
        let bars = null;
        let longest = STEPS;
        let auto = false;
        let seeded = false;
        try {
            const raw = JSON.parse(value);
            if (raw && typeof raw.bars === "number") bars = raw.bars;
            if (raw && raw.auto) auto = true;
            if (raw && raw.seeded) seeded = true;
            const src = raw && (Array.isArray(raw.tracks) || (raw.tracks && typeof raw.tracks === "object")) ? raw.tracks : raw;
            if (Array.isArray(src)) {
                src.forEach((t, i) => {
                    const c = cleanTrack(t, i);
                    if (c) tracks.push(c);
                    if (t && Array.isArray(t.steps)) longest = Math.max(longest, t.steps.length);
                });
            } else if (src && typeof src === "object") {
                let i = 0;
                for (const folder of Object.keys(src)) {
                    let t = src[folder];
                    if (Array.isArray(t)) t = { steps: t };
                    if (!t || typeof t !== "object" || t.hidden) continue;
                    if (Array.isArray(t.steps)) longest = Math.max(longest, t.steps.length);
                    const c = cleanTrack({ ...t, folder, name: displayName(folder) }, i);
                    if (c) { tracks.push(c); i++; }
                }
            }
        } catch (e) { /* оставляем пустое состояние */ }
        state.tracks = tracks.slice(0, MAX_TRACKS);
        state.auto = auto;
        state.seeded = seeded || tracks.length > 0;
        state.bars = clamp(Math.round(bars !== null ? bars : Math.ceil(longest / STEPS)), MIN_BARS, MAX_BARS);
        if (page >= state.bars) page = state.bars - 1;
    }

    function buildJson() {
        return JSON.stringify({
            version: 4, bars: state.bars, auto: state.auto, seeded: state.seeded,
            tracks: state.tracks.map((t) => ({
                name: t.name, color: t.color, folder: t.folder, sample: t.sample, steps: t.steps, vol: t.vol, pan: t.pan,
            })),
        });
    }

    function saveState() {
        if (!patternWidget) return;
        patternWidget.value = buildJson();
        if (typeof patternWidget.callback === "function") {
            try { patternWidget.callback(patternWidget.value); } catch (e) { /* не страшно */ }
        }
        if (state.auto) {
            if (autoTimer) clearTimeout(autoTimer);
            autoTimer = setTimeout(() => { renderToFile(true); }, 1500);
        }
    }

    function freeColor() {
        const used = new Set(state.tracks.map((t) => t.color.toLowerCase()));
        return PALETTE.find((c) => !used.has(c.toLowerCase())) || PALETTE[state.tracks.length % PALETTE.length];
    }

    // Первый запуск: по дорожке на каждую папку первого уровня, где есть звуки
    function seedTracks(withPattern) {
        if (state.seeded || !kitInfo.ok) return false;
        const top = allFolders().filter((f) => !f.includes("/") && filesOf(f).length);
        if (!top.length) return false;
        top.slice(0, MAX_TRACKS).forEach((f, i) => {
            state.tracks.push(makeTrack(f, lastPart(f), colorFor(f, i), withPattern ? defaultSteps(f) : zeros()));
        });
        state.seeded = true;
        return true;
    }

    function fixSamples() {
        let changed = false;
        if (!kitInfo.ok) return changed;
        for (const t of state.tracks) {
            const files = filesOf(t.folder);
            if (files.length && !files.includes(t.sample)) {
                t.sample = files[0];
                changed = true;
            }
        }
        return changed;
    }

    // ---------- каркас панели ----------

    const root = el("div", "neron-root");

    // Проекты: сохранить / открыть (файл проекта, как во FL Studio)
    const autoLabel = el("label", "nc-check");
    autoLabel.title = "Сам сохранять WAV через 1.5 сек после каждой правки";
    const autoChk = el("input");
    autoChk.type = "checkbox";
    autoLabel.appendChild(autoChk);
    autoLabel.appendChild(document.createTextNode("АВТО WAV"));

    const projBar = createProjectBar({
        kind: "drum",
        getData: () => ({ kit: currentKit(), bpm: getBpm(), pattern: JSON.parse(buildJson()) }),
        setData: (d) => applyProject(d),
        onNew: () => newProject(),
        setStatus: (t, e) => setStatus(t, e),
        extra: autoLabel,
    });
    root.appendChild(projBar.root);

    // BPM: ползунок + число
    const bpmRow = el("div", "neron-bpm");
    const bpmLabel = el("span", "neron-bpm-label", "BPM");
    bpmLabel.title = "Темп. Двойной клик - вернуть 90";
    const bpmSlider = el("input", "neron-bpm-slider");
    bpmSlider.type = "range";
    bpmSlider.min = String(BPM_MIN);
    bpmSlider.max = String(BPM_MAX);
    bpmSlider.step = "1";
    const bpmNum = el("input", "neron-num");
    bpmNum.type = "number";
    bpmNum.min = String(BPM_MIN);
    bpmNum.max = String(BPM_MAX);
    bpmRow.appendChild(bpmLabel);
    bpmRow.appendChild(bpmSlider);
    bpmRow.appendChild(bpmNum);
    root.appendChild(bpmRow);

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
    }
    bpmSlider.addEventListener("input", () => setBpmFromUser(bpmSlider.value));
    bpmNum.addEventListener("change", () => setBpmFromUser(bpmNum.value));
    bpmLabel.addEventListener("dblclick", () => setBpmFromUser(DEFAULT_BPM));

    // Такты (страницы): 1 2 3 ... + - x2
    const barsRow = el("div", "neron-barsrow");
    barsRow.appendChild(el("span", "neron-lbl2", "ТАКТЫ"));
    const tabsBox = el("div", "neron-tabs");
    barsRow.appendChild(tabsBox);
    function mkSmall(text, color, title) {
        const b = el("button", "neron-btn neron-small", text);
        b.style.background = color;
        if (title) b.title = title;
        return b;
    }
    const barsMinus = mkSmall("−", "#4a4e5a", "Убрать последний такт (его рисунок не стирается, вернётся при ＋)");
    const barsPlus = mkSmall("＋", "#4a4e5a", "Добавить такт");
    const barsDouble = mkSmall("×2", "#6b4fb3", "Удвоить длину: весь бит копируется во вторую половину");
    const followBtn = mkSmall("СЛЕДИТЬ", "#3fa34d", "При игре страница сама переключается на играющий такт");
    barsRow.appendChild(barsMinus);
    barsRow.appendChild(barsPlus);
    barsRow.appendChild(barsDouble);
    barsRow.appendChild(followBtn);
    root.appendChild(barsRow);

    // шапка
    const head = el("div", "neron-row neron-head");
    ["ДОРОЖКА", "ПАПКА", "ЗВУК", "VOL", "PAN"].forEach((t) => head.appendChild(el("div", "", t)));
    for (let i = 0; i < STEPS; i++) {
        const d = el("div", "", i % 4 === 0 ? String(i / 4 + 1) : "·");
        d.style.textAlign = "center";
        head.appendChild(d);
    }
    root.appendChild(head);

    const rowsBox = el("div", "neron-rows");
    root.appendChild(rowsBox);

    // нижняя панель
    const bar = el("div", "neron-bar");
    function makeButton(text, color, title) {
        const b = el("button", "neron-btn", text);
        b.style.background = color;
        if (title) b.title = title;
        return b;
    }
    const playBtn = makeButton("▶ PLAY", "#3fa34d", "Играть бит по кругу");
    const stopBtn = makeButton("■ STOP", "#b3414a", "Остановить");
    const saveBtn = makeButton("SAVE WAV", "#3b6fb6", "Сохранить бит в файл (папка output/Neron_Loops)");
    const reloadBtn = makeButton("⟳", "#4a4e5a", "Заново прочитать папки с сэмплами");
    const folderBtn = makeButton("ПАПКА ЗВУКОВ", "#4a4e5a", "Открыть библиотеку звуков в проводнике: сюда кладите скачанные сэмплы");
    const addBtn = makeButton("＋ ДОРОЖКА", "#6b4fb3", "Добавить дорожку: название, папка со звуками");
    const status = el("div", "neron-status", "");

    const addForm = el("div", "neron-addform");
    const addName = el("input");
    addName.type = "text";
    addName.placeholder = "Название дорожки";
    const addFolder = el("select");
    const addOk = makeButton("OK", "#6b4fb3");
    const addCancel = makeButton("✕", "#4a4e5a");
    addForm.appendChild(addName);
    addForm.appendChild(addFolder);
    addForm.appendChild(addOk);
    addForm.appendChild(addCancel);

    bar.appendChild(playBtn);
    bar.appendChild(stopBtn);
    bar.appendChild(saveBtn);
    bar.appendChild(reloadBtn);
    bar.appendChild(folderBtn);
    bar.appendChild(addBtn);
    bar.appendChild(status);
    bar.appendChild(addForm);
    root.appendChild(bar);

    function setStatus(text, isError) {
        status.textContent = text;
        status.title = text;
        status.className = "neron-status" + (isError ? " err" : "");
    }

    // ---------- звук ----------

    function ensureAudio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!audio) {
            const master = ctx.createGain();
            master.gain.value = 0.9;
            master.connect(ctx.destination);
            audio = { ctx, master, tracks: new Map() };
        }
        return audio;
    }

    function getChain(t) {
        const a = ensureAudio();
        if (!a.tracks.has(t.id)) {
            a.tracks.set(t.id, buildTrackChain(a.ctx, a.master));
            applyMix(t, true);
        }
        return a.tracks.get(t.id);
    }

    function applyMix(t, immediate) {
        if (!audio) return;
        const tr = audio.tracks.get(t.id);
        if (!tr) return;
        const left = Math.min(1, 1 - t.pan);
        const right = Math.min(1, 1 + t.pan);
        if (immediate) {
            tr.vol.gain.value = t.vol;
            tr.gl.gain.value = left;
            tr.gr.gain.value = right;
        } else {
            const now = audio.ctx.currentTime;
            tr.vol.gain.setTargetAtTime(t.vol, now, 0.01);
            tr.gl.gain.setTargetAtTime(left, now, 0.01);
            tr.gr.gain.setTargetAtTime(right, now, 0.01);
        }
    }

    function trigger(t, when) {
        if (!audio || !t.sample) return false;
        const buf = bufferReady.get(bufferKey(currentKit(), t.folder, t.sample));
        if (!buf) return false;
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(getChain(t).input);
        src.onended = () => sources.delete(src);
        sources.add(src);
        src.start(when);
        return true;
    }

    async function preview(t) {
        ensureAudio();
        if (!t.sample) {
            const where = kitInfo.kit_dir ? kitInfo.kit_dir + "\\" + t.folder.replace(/\//g, "\\") : t.folder;
            setStatus(`В папке «${prettyPath(t.folder)}» нет звуков. Положите их сюда: ${where}`, true);
            return;
        }
        const buf = await loadBuffer(currentKit(), t.folder, t.sample);
        if (!buf) {
            setStatus(`Не удалось загрузить ${t.sample}`, true);
            return;
        }
        trigger(t, 0);
    }

    // ---------- проигрывание по кругу ----------

    function schedule() {
        if (!audio) return;
        const ctx = audio.ctx;
        const stepDur = 60 / getBpm() / 4;
        const total = state.bars * STEPS;
        while (nextTime < ctx.currentTime + 0.15) {
            if (stepIndex >= total) stepIndex = 0;
            for (const t of state.tracks) {
                if (t.steps[stepIndex]) trigger(t, nextTime);
            }
            queue.push({ step: stepIndex, time: nextTime });
            nextTime += stepDur;
            stepIndex = (stepIndex + 1) % total;
        }
        if (queue.length > 64) queue.splice(0, queue.length - 64);
    }

    function markCol(col) {
        if (lastCol >= 0) {
            for (const u of ui.values()) u.cells[lastCol].classList.remove("play");
        }
        if (col >= 0) {
            for (const u of ui.values()) u.cells[col].classList.add("play");
        }
        lastCol = col;
    }

    // g - номер шага с начала бита (или -1, если не играет)
    function setPlayhead(g) {
        playGlobal = g;
        if (g < 0) {
            markCol(-1);
            playPage = -1;
            paintTabs();
            return;
        }
        const gp = g >> 4;
        if (gp !== playPage) {
            playPage = gp;
            if (follow && playing && page !== gp) setPage(gp);
            else paintTabs();
        }
        markCol(gp === page ? (g & 15) : -1);
    }

    function drawLoop() {
        if (!playing || !audio) return;
        const t = audio.ctx.currentTime;
        let step = -1;
        while (queue.length && queue[0].time <= t) step = queue.shift().step;
        if (step >= 0 && step !== playGlobal) setPlayhead(step);
        raf = requestAnimationFrame(drawLoop);
    }

    async function startPlayback() {
        if (playing || starting) return;
        starting = true;
        const a = ensureAudio();
        try {
            const jobs = [];
            for (const t of state.tracks) {
                if (t.sample && t.steps.some(Boolean)) jobs.push(loadBuffer(currentKit(), t.folder, t.sample));
            }
            await Promise.all(jobs);
        } finally {
            starting = false;
        }
        playing = true;
        stepIndex = 0;
        queue.length = 0;
        nextTime = a.ctx.currentTime + 0.08;
        timer = setInterval(schedule, 25);
        raf = requestAnimationFrame(drawLoop);
    }

    function stopPlayback() {
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        for (const s of sources) { try { s.stop(); } catch (e) { /* уже остановлен */ } }
        sources.clear();
        queue.length = 0;
        setPlayhead(-1);
    }

    // ---------- строки дорожек ----------

    function paintCell(t, i) {
        const u = ui.get(t.id);
        if (!u) return;
        u.cells[i].classList.toggle("on", !!t.steps[page * STEPS + i]);
    }

    function paintPage() {
        for (const t of state.tracks) {
            for (let i = 0; i < STEPS; i++) paintCell(t, i);
        }
    }

    function paintTabs() {
        tabsBox.innerHTML = "";
        for (let b = 0; b < state.bars; b++) {
            const tab = el("button", "neron-tab" + (b === page ? " sel" : "") + (b === playPage && playing ? " playing" : ""), String(b + 1));
            tab.title = "Показать такт " + (b + 1);
            tab.addEventListener("click", () => setPage(b));
            tabsBox.appendChild(tab);
        }
        barsMinus.style.opacity = state.bars <= MIN_BARS ? "0.4" : "1";
        barsPlus.style.opacity = state.bars >= MAX_BARS ? "0.4" : "1";
        barsDouble.style.opacity = state.bars * 2 > MAX_BARS ? "0.4" : "1";
        followBtn.style.background = follow ? "#3fa34d" : "#4a4e5a";
    }

    function setPage(p) {
        p = clamp(p, 0, state.bars - 1);
        markCol(-1);
        page = p;
        paintPage();
        paintTabs();
        if (playing && playGlobal >= 0 && (playGlobal >> 4) === page) markCol(playGlobal & 15);
    }

    function setBars(n) {
        n = clamp(n, MIN_BARS, MAX_BARS);
        if (n === state.bars) return;
        state.bars = n;
        if (page >= n) page = n - 1;
        saveState();
        setPage(page);
        setStatus(`Тактов в цикле: ${n}`, false);
    }

    function fillFolderSelect(sel, t) {
        sel.innerHTML = "";
        for (const f of allFolders()) {
            const o = el("option", "", prettyPath(f));
            o.value = f;
            sel.appendChild(o);
        }
        if (!allFolders().includes(t.folder)) {
            const o = el("option", "", prettyPath(t.folder) + " (нет папки)");
            o.value = t.folder;
            sel.appendChild(o);
        }
        sel.value = t.folder;
    }

    function fillSampleSelect(sel, t) {
        sel.innerHTML = "";
        const files = filesOf(t.folder);
        sel.disabled = !files.length;
        if (!files.length) {
            const o = el("option", "", "- нет файлов -");
            o.value = "";
            sel.appendChild(o);
            return;
        }
        for (const f of files) {
            const o = el("option", "", f);
            o.value = f;
            sel.appendChild(o);
        }
        sel.value = files.includes(t.sample) ? t.sample : files[0];
    }

    function colorize(t, row, nameIn) {
        row.style.setProperty("--c", t.color);
        nameIn.style.color = t.color;
    }

    function buildRow(t) {
        const row = el("div", "neron-row");

        const labelBox = el("div", "neron-labelbox");
        const rm = el("button", "neron-rm", "−");
        rm.title = "Убрать дорожку из ноды (файлы на диске остаются)";
        const colorIn = el("input", "neron-color");
        colorIn.type = "color";
        colorIn.value = t.color;
        colorIn.title = "Цвет дорожки";
        const nameIn = el("input", "neron-name");
        nameIn.type = "text";
        nameIn.value = t.name;
        nameIn.title = "Название дорожки (можно переименовать)";
        labelBox.appendChild(rm);
        labelBox.appendChild(colorIn);
        labelBox.appendChild(nameIn);
        row.appendChild(labelBox);
        colorize(t, row, nameIn);

        const folderSel = el("select", "neron-sample");
        folderSel.title = "Из какой папки берутся звуки этой дорожки";
        fillFolderSelect(folderSel, t);
        row.appendChild(folderSel);

        const select = el("select", "neron-sample");
        select.title = "Какой звук играет на этой дорожке";
        fillSampleSelect(select, t);
        row.appendChild(select);

        const vol = el("input", "neron-range");
        vol.type = "range"; vol.min = "0"; vol.max = "1"; vol.step = "0.01";
        vol.value = String(t.vol);
        vol.title = "Громкость (двойной клик - сбросить)";
        row.appendChild(vol);

        const pan = el("input", "neron-range");
        pan.type = "range"; pan.min = "-1"; pan.max = "1"; pan.step = "0.05";
        pan.value = String(t.pan);
        pan.title = "Баланс лево-право (двойной клик - в центр)";
        row.appendChild(pan);

        const cells = [];
        for (let i = 0; i < STEPS; i++) {
            const cell = el("div", "neron-cell" + (((i >> 2) & 1) ? " grp" : ""));
            if (t.steps[page * STEPS + i]) cell.classList.add("on");
            cell.addEventListener("click", () => {
                const idx = page * STEPS + i;
                t.steps[idx] = t.steps[idx] ? 0 : 1;
                paintCell(t, i);
                saveState();
                if (t.steps[idx]) preview(t);
            });
            row.appendChild(cell);
            cells.push(cell);
        }

        ui.set(t.id, { row, select, folderSel, vol, pan, cells });

        rm.addEventListener("click", () => removeTrack(t));
        nameIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") nameIn.blur(); });
        nameIn.addEventListener("change", () => {
            t.name = nameIn.value.trim().slice(0, 40) || lastPart(t.folder);
            nameIn.value = t.name;
            saveState();
        });
        colorIn.addEventListener("input", () => {
            t.color = colorIn.value;
            colorize(t, row, nameIn);
            saveState();
        });
        folderSel.addEventListener("change", () => {
            const oldFolder = t.folder;
            if (t.name === lastPart(oldFolder)) {
                t.name = lastPart(folderSel.value);
                nameIn.value = t.name;
            }
            t.folder = folderSel.value;
            const files = filesOf(t.folder);
            t.sample = files.length ? files[0] : "";
            fillSampleSelect(select, t);
            saveState();
            preview(t);
        });
        vol.addEventListener("input", () => {
            t.vol = parseFloat(vol.value);
            applyMix(t, false);
            saveState();
        });
        vol.addEventListener("dblclick", () => {
            vol.value = String(DEFAULT_VOL);
            vol.dispatchEvent(new Event("input"));
        });
        pan.addEventListener("input", () => {
            t.pan = parseFloat(pan.value);
            applyMix(t, false);
            saveState();
        });
        pan.addEventListener("dblclick", () => {
            pan.value = "0";
            pan.dispatchEvent(new Event("input"));
        });
        select.addEventListener("change", () => {
            t.sample = select.value;
            saveState();
            preview(t);
        });

        rowsBox.appendChild(row);
    }

    function relayout(shrinkBy) {
        root.style.height = panelH + "px";
        if (node.size) {
            const need = BASE_NODE_HEIGHT + panelH;
            let h = node.size[1];
            if (shrinkBy) h = Math.max(need, h - shrinkBy);
            if (h < need) h = need;
            if (h !== node.size[1]) node.setSize([node.size[0], h]);
        }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    }

    function rebuildRows(shrinkBy) {
        lastCol = -1;
        rowsBox.innerHTML = "";
        ui.clear();
        for (const t of state.tracks) buildRow(t);
        for (const t of state.tracks) applyMix(t, false);
        panelH = panelHeightFor(state.tracks.length);
        relayout(shrinkBy);
    }

    // ---------- папки с сэмплами ----------

    function kitSignature(info) {
        return JSON.stringify([info.ok, info.kit_dir, info.instruments]);
    }

    async function fetchKit() {
        try {
            const res = await api.fetchApi(`/neron/list_samples?kit=${encodeURIComponent(currentKit())}&t=${Date.now()}`);
            return await res.json();
        } catch (e) {
            return { ok: false, instruments: {}, searched: [] };
        }
    }

    async function applyKit(info, token) {
        kitInfo = info;
        lastSig = kitSignature(info);
        const kit = currentKit();

        let changed = false;
        if (info.ok) {
            if (seedTracks(true)) changed = true;
            if (fixSamples()) changed = true;
            // старый формат сохранения -> переписать в новый
            if (patternWidget && !String(patternWidget.value).includes('"version":4')) changed = true;
        }
        if (changed) saveState();

        rebuildRows(0);
        paintTabs();

        if (!info.ok) {
            const where = (info.searched && info.searched[0]) || "?";
            setStatus(`Папка со звуками не найдена. Ищу здесь: ${where}`, true);
            return;
        }
        const folders = Object.keys(info.instruments);
        if (folders.length === 0) {
            setStatus(`В библиотеке (${info.kit_dir}) нет папок. Нажмите ПАПКА ЗВУКОВ и положите туда папки со звуками`, true);
            return;
        }
        let total = 0;
        const jobs = [];
        for (const name of folders) total += info.instruments[name].length;
        for (const t of state.tracks) {
            if (t.sample) jobs.push(loadBuffer(kit, t.folder, t.sample));
        }
        if (total === 0) {
            setStatus(`Папок: ${folders.length}, но звуковых файлов в них нет (${info.kit_dir})`, true);
            return;
        }
        const results = await Promise.all(jobs);
        if (token !== loadToken) return;
        const failed = results.filter((r) => !r).length;
        if (failed) setStatus(`Звуков: ${total}. Не загрузились: ${failed} (смотрите консоль F12)`, true);
        else setStatus(`Библиотека «${kit}»: папок ${folders.length}, звуков ${total}`, false);
    }

    async function reloadKit(clearCache) {
        const token = ++loadToken;
        if (clearCache) {
            bufferPromises.clear();
            bufferReady.clear();
        }
        setStatus("Загружаю звуки...", false);
        const info = await fetchKit();
        if (token !== loadToken) return;
        await applyKit(info, token);
    }

    // автоматически подхватываем новые папки и файлы
    async function pollKit() {
        if (document.hidden) return;
        const info = await fetchKit();
        if (kitSignature(info) !== lastSig) {
            const token = ++loadToken;
            await applyKit(info, token);
        }
    }

    function removeTrack(t) {
        const idx = state.tracks.indexOf(t);
        if (idx < 0) return;
        state.tracks.splice(idx, 1);
        if (audio) {
            const ch = audio.tracks.get(t.id);
            if (ch) { try { ch.vol.disconnect(); } catch (e) { /* ок */ } audio.tracks.delete(t.id); }
        }
        saveState();
        rebuildRows(28);
        setStatus(`Дорожка «${t.name}» убрана (файлы остались на диске)`, false);
    }

    // ---------- новая дорожка ----------

    function fillAddFolders() {
        addFolder.innerHTML = "";
        for (const f of allFolders()) {
            const o = el("option", "", prettyPath(f) + (filesOf(f).length ? "" : " (пусто)"));
            o.value = f;
            addFolder.appendChild(o);
        }
        const n = el("option", "", "＋ новая папка с таким названием");
        n.value = "__new__";
        addFolder.appendChild(n);
    }

    function openAddForm() {
        if (state.tracks.length >= MAX_TRACKS) {
            setStatus(`Максимум ${MAX_TRACKS} дорожек`, true);
            return;
        }
        fillAddFolders();
        bar.classList.add("adding");
        addName.value = "";
        addName.focus();
    }
    function closeAddForm() {
        bar.classList.remove("adding");
    }

    async function createTrack() {
        const name = addName.value.trim();
        let folder = addFolder.value;
        closeAddForm();

        if (folder === "__new__") {
            if (!name) {
                setStatus("Введите название: по нему создастся папка", true);
                return;
            }
            try {
                const res = await api.fetchApi("/neron/add_instrument", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kit_name: currentKit(), name }),
                });
                const data = await res.json();
                if (!data.ok) {
                    setStatus("Не удалось создать папку: " + data.error, true);
                    return;
                }
                folder = data.folder;
                await reloadKit(false);
                setStatus(`Папка создана: ${data.path}. Положите в неё звуки (кнопка ПАПКА ЗВУКОВ)`, false);
            } catch (e) {
                setStatus("Ошибка: " + e, true);
                return;
            }
        }
        if (!folder) return;

        const t = makeTrack(folder, name || lastPart(folder), freeColor(), zeros());
        state.tracks.push(t);
        state.seeded = true;
        saveState();
        rebuildRows(0);
        if (!t.sample) {
            const where = kitInfo.kit_dir ? kitInfo.kit_dir + "\\" + folder.replace(/\//g, "\\") : folder;
            setStatus(`Дорожка «${t.name}» добавлена, но в папке нет звуков. Положите их сюда: ${where}`, true);
        } else {
            setStatus(`Дорожка «${t.name}» добавлена`, false);
        }
    }

    addBtn.addEventListener("click", openAddForm);
    addOk.addEventListener("click", createTrack);
    addCancel.addEventListener("click", closeAddForm);
    addName.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") createTrack();
        else if (e.key === "Escape") closeAddForm();
    });

    folderBtn.addEventListener("click", async () => {
        try {
            const res = await api.fetchApi("/neron/open_folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kit_name: currentKit() }),
            });
            const data = await res.json();
            if (data.ok) setStatus("Открыта папка: " + data.path, false);
            else setStatus(`Не удалось открыть папку автоматически. Она здесь: ${data.path || (kitInfo.kit_dir || "?")}`, true);
        } catch (e) {
            setStatus("Ошибка: " + e, true);
        }
    });

    // ---------- кнопки ----------

    playBtn.addEventListener("click", () => { startPlayback(); });
    stopBtn.addEventListener("click", () => { stopPlayback(); });
    reloadBtn.addEventListener("click", () => { reloadKit(true); projBar.refresh(); });
    saveBtn.addEventListener("click", () => { renderToFile(false); });

    async function renderToFile(silent) {
        if (!silent) setStatus("Сохраняю...", false);
        try {
            const res = await api.fetchApi("/neron/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kit_name: currentKit(),
                    bpm: getBpm(),
                    pattern_json: buildJson(),
                    save_name: getWidget("save_name")?.value || "neron_beat_01",
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

    // кнопки тактов
    barsMinus.addEventListener("click", () => setBars(state.bars - 1));
    barsPlus.addEventListener("click", () => setBars(state.bars + 1));
    barsDouble.addEventListener("click", () => {
        if (state.bars * 2 > MAX_BARS) {
            setStatus(`Максимум ${MAX_BARS} тактов`, true);
            return;
        }
        const shift = state.bars * STEPS;
        for (const t of state.tracks) {
            for (let i = 0; i < shift; i++) t.steps[shift + i] = t.steps[i];
        }
        state.bars *= 2;
        saveState();
        setPage(page);
        setStatus(`Тактов в цикле: ${state.bars} (бит скопирован)`, false);
    });
    followBtn.addEventListener("click", () => { follow = !follow; paintTabs(); });
    autoChk.addEventListener("change", () => {
        state.auto = autoChk.checked;
        saveState();
        if (state.auto) setStatus("АВТО WAV включён: бит сам сохраняется в output/Neron_Loops", false);
    });

    // ---------- проекты ----------

    function afterStateReplaced() {
        stopPlayback();
        autoChk.checked = state.auto;
        page = clamp(page, 0, state.bars - 1);
        seedTracks(false);
        fixSamples();
        saveState();
        rebuildRows(0);
        paintTabs();
    }

    function newProject() {
        state.tracks = [];
        state.bars = 1;
        state.seeded = false;
        state.auto = autoChk.checked;
        page = 0;
        afterStateReplaced();
    }

    function applyProject(d) {
        const kitWidget2 = getWidget("kit_name");
        const newKit = d && typeof d.kit === "string" && d.kit.trim() ? d.kit.trim() : currentKit();
        const kitChanged = newKit !== currentKit();
        if (kitChanged && kitWidget2) kitWidget2.value = newKit;
        if (d && d.bpm) setBpmFromUser(d.bpm);
        page = 0;
        loadState(JSON.stringify((d && d.pattern) || {}));
        if (kitChanged) { reloadKit(false); return; }
        afterStateReplaced();
    }

    // смена названия кита -> перечитать папки
    const kitWidget = getWidget("kit_name");
    if (kitWidget) {
        const origCallback = kitWidget.callback;
        kitWidget.callback = function () {
            const r = origCallback ? origCallback.apply(this, arguments) : undefined;
            reloadKit(false);
            return r;
        };
    }

    // ---------- запуск ----------

    loadState(patternWidget ? patternWidget.value : "");
    showBpm(getBpm());
    autoChk.checked = state.auto;
    paintTabs();

    const domWidget = node.addDOMWidget("neron_sequencer", "neron_sequencer", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => panelH,
        getMaxHeight: () => panelH,
    });
    domWidget.computeSize = (width) => [width, panelH];
    root.style.height = panelH + "px";

    const wanted = node.computeSize ? node.computeSize() : [900, 260];
    node.setSize([Math.max(wanted[0], 900), Math.max(wanted[1], BASE_NODE_HEIGHT + panelH)]);

    node.neronReload = () => {
        loadState(patternWidget ? patternWidget.value : "");
        showBpm(getBpm());
        autoChk.checked = state.auto;
        paintTabs();
        reloadKit(false);
    };
    node.neronDispose = () => {
        stopPlayback();
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (bpmTimer) { clearInterval(bpmTimer); bpmTimer = null; }
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    };

    pollTimer = setInterval(pollKit, 4000);
    // BPM могли изменить снаружи (например, микшер синхронизирует темп) - обновить ползунок
    bpmTimer = setInterval(() => {
        if (bpmWidget && Number(bpmWidget.value) !== Number(bpmSlider.value)) showBpm(bpmWidget.value);
    }, 500);
    reloadKit(false);
}

// ----------------------------------------------------------------------------
//  Регистрация расширения
// ----------------------------------------------------------------------------

app.registerExtension({
    name: "NeronAudio.DrumMachineUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronDrumMachine") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupNeronUI(this);
            return r;
        };

        // после загрузки сохранённой схемы - восстановить рисунок бита
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
