import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createProjectBar } from "./neron_common.js";

// ============================================================================
//  Neron Field / Поле
//  RU: Общее поле в духе Playlist из FL Studio. На холсте нода — маленькая
//      карточка (картинка, обзор, PLAY, «Открыть»). Большое окно открывается
//      поверх всего: сверху склейка до 3 роликов, под ней дорожки со звуком.
//      Слушать и смотреть можно сразу, без Queue.
//  EN: A shared field in the spirit of the FL Studio Playlist. On the canvas the
//      node is a small card (picture, overview, PLAY, "Open"). The big window
//      opens above everything: up to 3 video clips on top, audio tracks below.
//      Watch and listen right away, no Queue needed.
//
//  Оптимизация / performance:
//   * один общий звуковой движок на страницу (window.__neronAudioCtx);
//   * окно ничего не рисует, пока закрыто; дорожки перерисовываются только
//     при изменениях, во время игры двигается лишь линия-курсор (отдельный слой);
//   * волны и превью кадров считаются один раз и кешируются.
// ============================================================================

const NODE = "NeronArrange";
const MAX_VIDEO = 3, MAX_TRACKS = 8, MAX_INPUTS = 6, MAX_CLIPS = 96, MAX_SEC = 900;
const COLORS = ["#ff9f43", "#54a0ff", "#1dd1a1", "#ff6b81", "#feca57", "#a29bfe", "#48dbfb", "#ee5253"];
const VCOLORS = ["#4dabf7", "#f783ac", "#69db7c"];
const SLOT_RE = /^audio_(\d+)$/;
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\s*\[\w+\])?$/i;
const AUDIO_EXT_RE = /\.(wav|mp3|flac|ogg|opus|m4a|aac|wma|aif|aiff)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv)$/i;
const VROW_H = 46, RES_H = 44, VA_H = 44, TROW_H = 60, ADD_H = 32, HEAD_W = 200, RULER_H = 24;
const CARD_MIN = 120, CARD_DEF = 260;
const PEAK_BLOCK = 256;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const T = (ru, en) => `${ru} / ${en}`;

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function fmtT(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60);
    return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
}

function hashString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16) + ":" + s.length;
}

let uidN = 0;
const uid = () => Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

function getCtx() {
    if (!window.__neronAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        window.__neronAudioCtx = new AC();
    }
    return window.__neronAudioCtx;
}

function viewUrl(v) {
    const path = `/view?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}`;
    return typeof api.apiURL === "function" ? api.apiURL(path) : path;
}
const mediaKey = (v) => (v ? `${v.type || "input"}|${v.subfolder || ""}|${v.name}` : "");

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
    return { name, subfolder: k >= 0 ? s.slice(0, k) : "", type: ["input", "output", "temp"].includes(type) ? type : "input" };
}

// ----------------------------------------------------------------------------
//  Стили
// ----------------------------------------------------------------------------

function injectStyles() {
    if (document.getElementById("neron-field-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-field-styles";
    s.textContent = `
.nf-card{box-sizing:border-box;width:100%;padding:6px 8px;background:#1b1d23;border-radius:8px;font-family:"Segoe UI",Arial,sans-serif;
  color:#cfd2d8;display:flex;flex-direction:column;gap:5px;overflow:hidden;user-select:none}
.nf-bar{display:flex;align-items:center;gap:6px;flex:none;flex-wrap:wrap}
.nf-btn{height:24px;padding:0 10px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;background:#4a4e5a;
  white-space:nowrap;line-height:24px;flex:none;font-family:inherit}
.nf-btn:hover{filter:brightness(1.18)}
.nf-btn.sm{height:20px;line-height:20px;padding:0 7px;font-size:10px}
.nf-btn.on{box-shadow:inset 0 0 0 2px #ffd166}
.nf-btn:disabled{opacity:.4;cursor:default;filter:none}
.nf-time{font:700 12px/1 Consolas,"Courier New",monospace;color:#e6e8ee;white-space:nowrap}
.nf-status{font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none;min-height:13px}
.nf-status.err{color:#ff8a80}
.nf-stagehost{flex:1;min-height:0;display:flex;background:#0e0f12;border-radius:6px;overflow:hidden}
.nf-stage{position:relative;flex:1;min-width:0;min-height:0;background:#000}
.nf-stage video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;opacity:0;pointer-events:none;background:transparent}
.nf-miss{position:absolute;left:0;right:0;top:0;bottom:0;display:none;align-items:center;justify-content:center;text-align:center;
  font-size:11px;color:#ff8a80;padding:6px;pointer-events:none}
.nf-novid{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;
  font-size:11px;color:#6b7080;padding:8px;line-height:1.5;pointer-events:none}
.nf-ov{flex:none;height:44px;width:100%;display:block;background:#15171c;border-radius:5px;cursor:pointer}
.nf-win{position:fixed;z-index:9000;display:none;flex-direction:column;background:#1b1d23;border:1px solid #3a3e48;border-radius:10px;
  box-shadow:0 14px 44px rgba(0,0,0,.65);font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;user-select:none;overflow:hidden;outline:none}
.nf-title{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;background:#23262e;cursor:move;flex:none;border-bottom:1px solid #2f323b}
.nf-title b{font-size:12px;color:#ffd166;letter-spacing:.5px;margin-right:4px;white-space:nowrap}
.nf-sep{width:1px;height:18px;background:#3a3e48;flex:none}
.nf-sp{flex:1;min-width:4px}
.nf-body{flex:1;min-height:0;display:flex;flex-direction:column}
.nf-wstage{flex:none;display:flex;background:#0e0f12;min-height:60px}
.nf-split{flex:none;height:7px;cursor:ns-resize;background:#23262e;border-top:1px solid #2f323b;border-bottom:1px solid #2f323b}
.nf-split:hover{background:#2f333d}
.nf-rrow{flex:none;display:flex;height:${RULER_H}px;background:#1f2229;border-bottom:1px solid #2f323b}
.nf-rhead{flex:none;width:${HEAD_W}px;display:flex;align-items:center;padding:0 6px;box-sizing:border-box;font-size:10px;color:#8b90a0;gap:4px}
.nf-rcv{flex:1;min-width:0;position:relative}
.nf-rcv canvas{position:absolute;left:0;top:0;cursor:pointer}
.nf-tl{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative}
.nf-tlin{display:flex;align-items:stretch;position:relative}
.nf-heads{flex:none;width:${HEAD_W}px;display:flex;flex-direction:column}
.nf-head{box-sizing:border-box;border-bottom:1px solid #2a2d35;padding:3px 6px;display:flex;flex-direction:column;justify-content:center;gap:3px;
  background:#20232a;overflow:hidden;font-size:11px}
.nf-hl{display:flex;align-items:center;gap:4px;min-width:0}
.nf-hl b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.nf-hl input[type=range]{flex:1;min-width:30px;height:12px;margin:0;accent-color:var(--c,#4dabf7);cursor:pointer}
.nf-hl span{font-size:9px;color:#8b90a0;flex:none}
.nf-ms{width:20px;height:18px;padding:0;border:none;border-radius:4px;background:#363a44;color:#9aa0ae;font-size:10px;font-weight:700;cursor:pointer;flex:none}
.nf-ms.on-m{background:#b3414a;color:#fff}
.nf-ms.on-s{background:#d9a72b;color:#1b1d23}
.nf-dot{width:9px;height:9px;border-radius:50%;flex:none}
.nf-lanes{flex:1;min-width:0;position:relative}
.nf-lanes canvas{position:absolute;left:0;top:0}
.nf-hs{flex:none;display:flex;align-items:center;gap:6px;padding:2px 8px 2px ${HEAD_W + 8}px;background:#1f2229}
.nf-hs input{flex:1;margin:0;height:12px;accent-color:#6b7080}
.nf-selp{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:6px 8px;background:#20232a;min-height:32px;
  box-sizing:border-box;font-size:11px;border-top:1px solid #2f323b}
.nf-selp b{color:#e6e8ee}
.nf-hint{color:#8b90a0;font-size:10px;line-height:1.5}
.nf-f{display:flex;align-items:center;gap:4px;font-size:10px;color:#9aa0ae;white-space:nowrap}
.nf-f input[type=range]{width:110px;height:12px;margin:0;cursor:pointer;accent-color:#ffd166}
.nf-num{width:70px;height:20px;box-sizing:border-box;background:#23252b;color:#e6e8ee;border:1px solid #33363e;border-radius:4px;font-size:11px;
  text-align:center;outline:none;padding:0}
.nf-num:focus{border-color:#6b4fb3}
.nf-sel{height:20px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;border-radius:4px;font-size:10px;outline:none}
.nf-exp{flex:none;display:none;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:6px 8px;background:#262119;border-top:2px solid #d9a72b}
.nf-grip{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 55%,#6b7080 55%,#6b7080 62%,transparent 62%,transparent 72%,#6b7080 72%,#6b7080 79%,transparent 79%)}
.nf-menu{position:fixed;z-index:9200;background:#23262e;border:1px solid #3a3e48;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.6);
  min-width:260px;max-width:440px;max-height:60vh;display:flex;flex-direction:column;font-family:"Segoe UI",Arial,sans-serif;color:#cfd2d8;font-size:11px}
.nf-menu input{margin:6px;height:22px;box-sizing:border-box;background:#1b1d23;color:#e6e8ee;border:1px solid #3a3e48;border-radius:4px;padding:0 6px;outline:none}
.nf-mlist{overflow-y:auto;padding:2px 0 6px}
.nf-mh{padding:6px 10px 2px;font-size:10px;font-weight:700;color:#8b90a0;letter-spacing:.5px}
.nf-mi{padding:5px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nf-mi:hover{background:#2f333d}
.nf-mi.dis{color:#6b7080;cursor:default;background:none}
.nf-drop{position:absolute;inset:0;background:rgba(77,171,247,.12);border:2px dashed #4dabf7;border-radius:10px;display:none;align-items:center;
  justify-content:center;font-size:16px;font-weight:700;color:#4dabf7;pointer-events:none;z-index:5}
`;
    document.head.appendChild(s);
}

// ----------------------------------------------------------------------------
//  Справка
// ----------------------------------------------------------------------------

const HELP_TEXT = `NERON FIELD
===================================================
One field for video and sound, in the spirit of the FL Studio Playlist.

THE CARD (on the canvas)
  ▶ / ■ — play and pause right on the node, no Queue needed.
  🎬 OPEN — opens the big window. Close it and the canvas stays tidy.
  The card can be resized freely; it remembers its size.

THE BIG WINDOW
  Drag it by the title bar, resize it by the bottom-right corner,
  ⛶ — full screen. The window remembers its place and size.
  The bar between the picture and the tracks can be dragged too.

VIDEO (up to 3 clips)
  + VIDEO — pick a clip from the list or upload one (or just drop a file
  onto the window). Each clip has its own row.
  Drag a clip left/right to shift it. Exact shift: select the clip and use
  ◀ / ▶ (1 frame) or the arrow keys (Shift = 10 frames).
  RESULT row: two dividers decide where clip 1 ends and clip 2 begins,
  and where clip 3 begins. Drag them.
  ✂ cut / 🌫 dissolve — how one clip turns into the next.
  Red stripes = the clip has no frames there (black screen in the result).
  VIDEO SOUND row: the clips' own sound. M switches it off.

SOUND
  + SOUND — a file from the list, an upload, or a node wired into audio_N
  (Drum Machine, Piano Roll, Audio Loader...). The piece lands at the
  white cursor. You can also drop audio files onto a track.
  Drag a piece to move it (also to another track). Drag its edges to trim.
  The small squares at the top corners set fade in / fade out.
  Every piece: volume, fades, ✂ split, ⧉ copy, 🗑 delete (bottom panel).
  Every track: M (mute), S (solo), volume, pan.
  🧲 — pieces stick to edges, dividers and the cursor.

KEYS (window focused)
  Space — play/pause · Home — to start · S — split at cursor
  Delete — delete · Ctrl+D — copy · Ctrl+Z / Ctrl+Y — undo / redo
  ← → — nudge selection · Wheel — scroll · Ctrl+Wheel — zoom

SAVE
  💾 BUILD — saves the sound to output/Neron_Mixes and the video (mp4,
  H.264 CRF 17) to output/Neron_Videos. Queue does the same and passes
  audio / video / fps / seconds down the graph.
  If there is video, the result is exactly as long as the video.

EXPERT
  Exact numbers for pieces and shifts, dissolve length, master volume,
  projects (save / open).

===================================================
🇷🇺 РУССКИЙ
===================================================
Одно поле для видео и звука, в духе Playlist из FL Studio.

КАРТОЧКА (на холсте)
  ▶ / ■ — играть и пауза прямо на ноде, Queue не нужна.
  🎬 ОТКРЫТЬ — большое окно. Закрыли — на холсте снова порядок.
  Карточку можно растягивать как угодно, размер запоминается.

БОЛЬШОЕ ОКНО
  Двигается за заголовок, растягивается за правый нижний угол,
  ⛶ — на весь экран. Окно помнит своё место и размер.
  Полоску между картинкой и дорожками тоже можно тянуть.

ВИДЕО (до 3 роликов)
  + ВИДЕО — выбрать ролик из списка или загрузить (или просто перетащить
  файл на окно). У каждого ролика своя строка.
  Тяните ролик влево-вправо, чтобы сдвинуть. Точно: выделите ролик и
  жмите ◀ / ▶ (1 кадр) или стрелки на клавиатуре (Shift = 10 кадров).
  Строка ИТОГ: два разделителя решают, где кончается 1-й ролик и
  начинается 2-й, и где начинается 3-й. Тяните их.
  ✂ склейка / 🌫 наплыв — как один ролик сменяет другой.
  Красные полосы — у ролика в этом месте нет кадров (в итоге будет чёрный экран).
  Строка ЗВУК ВИДЕО — родной звук роликов. M выключает его.

ЗВУК
  + ЗВУК — файл из списка, загрузка с компьютера или нода, подключённая
  ко входу audio_N (Drum Machine, Piano Roll, Audio Loader...). Кусок
  ложится на белый курсор. Файлы можно и перетащить прямо на дорожку.
  Тяните кусок — двигается (и на другую дорожку). Тяните края — обрезка.
  Квадратики в верхних углах — появление и затухание.
  У каждого куска: громкость, появление, затухание, ✂ разрезать,
  ⧉ копия, 🗑 удалить (панель внизу).
  У каждой дорожки: M (выключить), S (только она), громкость, баланс.
  🧲 — куски прилипают к краям, разделителям и курсору.

КЛАВИШИ (когда окно активно)
  Пробел — играть/пауза · Home — в начало · S — разрезать по курсору
  Delete — удалить · Ctrl+D — копия · Ctrl+Z / Ctrl+Y — отмена / повтор
  ← → — сдвинуть выделенное · Колёсико — прокрутка · Ctrl+колёсико — масштаб

СОХРАНЕНИЕ
  💾 СОБРАТЬ — звук в output/Neron_Mixes, видео (mp4, H.264 CRF 17)
  в output/Neron_Videos. Queue делает то же и отдаёт дальше по схеме
  audio / video / fps / seconds.
  Если видео есть, итог ровно такой длины, как видео.

ЭКСПЕРТ
  Точные числа для кусков и сдвигов, длина наплыва, общая громкость,
  проекты (сохранить / открыть).
`;

function showHelp() {
    const overlay = el("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";
    const box = el("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;max-width:820px;max-height:85vh;" +
        "overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP_TEXT;
    const btn = el("button", "", "Close / Закрыть");
    btn.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;border:none;border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.addEventListener("keydown", (e) => e.stopPropagation());
    overlay.append(box);
    document.body.append(overlay);
}

// ----------------------------------------------------------------------------
//  Общий кеш звука и сведений о видео (на всю страницу)
// ----------------------------------------------------------------------------

const media = {
    bufs: new Map(),    // key -> {state, buf, peaks, err, p}
    infos: new Map(),   // mediaKey -> {state, info, p}
};

function computePeaks(buf) {
    const L = buf.getChannelData(0);
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const n = Math.ceil(buf.length / PEAK_BLOCK);
    const out = new Float32Array(n);
    for (let b = 0; b < n; b++) {
        let p = 0;
        const a = b * PEAK_BLOCK, e = Math.min(buf.length, a + PEAK_BLOCK);
        for (let i = a; i < e; i += 2) {
            const v = Math.abs(L[i]); if (v > p) p = v;
            const w = Math.abs(R[i]); if (w > p) p = w;
        }
        out[b] = p;
    }
    return out;
}

function trimBufCache() {
    if (media.bufs.size <= 40) return;
    for (const k of media.bufs.keys()) {
        if (media.bufs.size <= 32) break;
        const e = media.bufs.get(k);
        if (e.state !== "loading") media.bufs.delete(k);
    }
}

const hooked = new WeakSet();
// перерисовать, когда звук догрузится (один раз на загрузку)
function whenLoaded(p, fn) {
    if (!p || hooked.has(p)) return;
    hooked.add(p);
    p.then(fn);
}

function loadBuf(key, fetcher) {
    let e = media.bufs.get(key);
    if (e) return e;
    e = { state: "loading", buf: null, peaks: null, err: "" };
    media.bufs.set(key, e);
    e.p = (async () => {
        try {
            const res = await fetcher();
            if (!res.ok) throw new Error((await res.text()) || ("HTTP " + res.status));
            const data = await res.arrayBuffer();
            const buf = await getCtx().decodeAudioData(data);
            e.buf = buf;
            e.peaks = computePeaks(buf);
            e.state = "ok";
        } catch (err) {
            e.state = "err";
            e.err = String(err && err.message ? err.message : err);
        }
        trimBufCache();
        return e;
    })();
    return e;
}

const postJson = (url, body) => api.fetchApi(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
});
const fileBufKey = (s) => "f|" + mediaKey(s);
const specBufKey = (spec) => "s|" + hashString(JSON.stringify(spec));
const vaBufKey = (v) => "va|" + mediaKey(v);

function loadFileBuf(s) {
    return loadBuf(fileBufKey(s), () => postJson("/neron/preview_wav", { type: "file", name: s.name, subfolder: s.subfolder || "", kind: s.type || "input", start: 0, end: 0 }));
}
function loadSpecBuf(spec) {
    return loadBuf(specBufKey(spec), () => postJson("/neron/preview_wav", spec));
}
function loadVideoAudio(v) {
    return loadBuf(vaBufKey(v), () => api.fetchApi(`/neron/video_audio?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}&t=${Date.now()}`));
}
function loadInfo(v) {
    const key = mediaKey(v);
    let e = media.infos.get(key);
    if (e) return e;
    e = { state: "loading", info: null };
    media.infos.set(key, e);
    e.p = (async () => {
        try {
            const res = await api.fetchApi(`/neron/video_info?filename=${encodeURIComponent(v.name)}&subfolder=${encodeURIComponent(v.subfolder || "")}&type=${encodeURIComponent(v.type || "input")}`);
            const d = await res.json();
            if (!d.ok) throw new Error(d.error || "error");
            e.info = d;
            e.state = "ok";
        } catch (err) {
            e.state = "err";
            e.err = String(err && err.message ? err.message : err);
        }
        return e;
    })();
    return e;
}

async function uploadFile(file) {
    const isVideo = VIDEO_EXT_RE.test(file.name);
    const isAudio = AUDIO_EXT_RE.test(file.name);
    if (!isVideo && !isAudio) throw new Error(T("это не звук и не видео: ", "not audio or video: ") + file.name);
    const fd = new FormData();
    fd.append("file", file, file.name);
    const res = await api.fetchApi(isVideo ? "/neron/upload_video" : "/neron/upload_audio", { method: "POST", body: fd });
    const d = await res.json();
    if (!d.ok) throw new Error(d.error || "upload error");
    return { kind: isVideo ? "video" : "audio", ref: { name: d.name, subfolder: d.subfolder, type: d.type } };
}

// ----------------------------------------------------------------------------
//  Звуковая цепочка дорожки: громкость и баланс
// ----------------------------------------------------------------------------

function buildTrackChain(ctx, master) {
    const input = ctx.createGain();
    input.channelCount = 2;
    input.channelCountMode = "explicit";
    input.channelInterpretation = "speakers";
    const split = ctx.createChannelSplitter(2);
    const gl = ctx.createGain(), gr = ctx.createGain();
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
//  Всплывающее меню (выбор файла, ролика, входа)
// ----------------------------------------------------------------------------

let openMenuEl = null;
function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } }

function showMenu(anchor, sections, withSearch) {
    closeMenu();
    const m = el("div", "nf-menu");
    m.tabIndex = -1;
    const search = withSearch ? el("input") : null;
    if (search) { search.placeholder = T("поиск...", "search..."); m.appendChild(search); }
    const list = el("div", "nf-mlist");
    m.appendChild(list);
    function fill() {
        list.innerHTML = "";
        const q = search ? search.value.trim().toLowerCase() : "";
        for (const sec of sections) {
            const items = sec.items.filter((it) => !q || it.label.toLowerCase().includes(q));
            if (!items.length && !sec.always) continue;
            if (sec.title) list.appendChild(el("div", "nf-mh", sec.title));
            if (!items.length) { list.appendChild(el("div", "nf-mi dis", sec.empty || "—")); continue; }
            for (const it of items.slice(0, 300)) {
                const d = el("div", "nf-mi" + (it.disabled ? " dis" : ""), it.label);
                d.title = it.title || it.label;
                if (!it.disabled) d.addEventListener("click", () => { closeMenu(); it.action(); });
                list.appendChild(d);
            }
        }
    }
    fill();
    if (search) search.addEventListener("input", fill);
    m.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") closeMenu(); });
    m.addEventListener("wheel", (e) => e.stopPropagation());
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = clamp(r.left, 4, window.innerWidth - mw - 4) + "px";
    m.style.top = (r.bottom + 4 + mh > window.innerHeight ? Math.max(4, r.top - mh - 4) : r.bottom + 4) + "px";
    openMenuEl = m;
    if (search) setTimeout(() => search.focus(), 0);
    setTimeout(() => {
        const off = (e) => {
            if (!openMenuEl) { document.removeEventListener("pointerdown", off, true); return; }
            if (!openMenuEl.contains(e.target)) { closeMenu(); document.removeEventListener("pointerdown", off, true); }
        };
        document.addEventListener("pointerdown", off, true);
    }, 0);
}

// ============================================================================
//  Нода
// ============================================================================

function blankField() {
    return {
        version: 1, master: 0.9, snap: true,
        video: { clips: [], cuts: [], trans: "cut", trans_dur: 0.5, audio: { vol: 0.8, mute: false, solo: false } },
        tracks: [],
    };
}

function normalizeField(o) {
    const F = blankField();
    if (!o || typeof o !== "object") return F;
    if (typeof o.master === "number") F.master = clamp(o.master, 0, 1.5);
    F.snap = o.snap !== false;
    const v = o.video && typeof o.video === "object" ? o.video : {};
    for (const c of (Array.isArray(v.clips) ? v.clips : []).slice(0, MAX_VIDEO)) {
        if (!c || !c.src || typeof c.src.name !== "string") continue;
        F.video.clips.push({
            id: c.id || uid(),
            src: { name: c.src.name, subfolder: String(c.src.subfolder || ""), type: String(c.src.type || "input") },
            offset: Number(c.offset) || 0, dur: Number(c.dur) || 0, fps: Number(c.fps) || 0,
            w: Number(c.w) || 0, h: Number(c.h) || 0,
        });
    }
    F.video.cuts = (Array.isArray(v.cuts) ? v.cuts : []).map(Number).filter(Number.isFinite).slice(0, MAX_VIDEO - 1);
    F.video.trans = v.trans === "fade" ? "fade" : "cut";
    F.video.trans_dur = clamp(Number(v.trans_dur) || 0.5, 0.04, 3);
    const a = v.audio && typeof v.audio === "object" ? v.audio : {};
    F.video.audio = { vol: typeof a.vol === "number" ? clamp(a.vol, 0, 1.5) : 0.8, mute: !!a.mute, solo: !!a.solo };
    let n = 0;
    for (const [i, t] of (Array.isArray(o.tracks) ? o.tracks : []).slice(0, MAX_TRACKS).entries()) {
        if (!t || typeof t !== "object") continue;
        const tr = {
            id: t.id || uid(), name: String(t.name || "🎵 " + (i + 1)).slice(0, 40),
            color: typeof t.color === "string" ? t.color : COLORS[i % COLORS.length],
            vol: typeof t.vol === "number" ? clamp(t.vol, 0, 1.5) : 0.8, pan: typeof t.pan === "number" ? clamp(t.pan, -1, 1) : 0,
            mute: !!t.mute, solo: !!t.solo, clips: [],
        };
        for (const c of Array.isArray(t.clips) ? t.clips : []) {
            if (n >= MAX_CLIPS || !c || !c.src) continue;
            const s = c.src;
            let src;
            if (s.kind === "input" && SLOT_RE.test(String(s.slot))) src = { kind: "input", slot: s.slot };
            else if (typeof s.name === "string") src = { kind: "file", name: s.name, subfolder: String(s.subfolder || ""), type: String(s.type || "input") };
            else continue;
            tr.clips.push({
                id: c.id || uid(), src, start: Math.max(0, Number(c.start) || 0), in: Math.max(0, Number(c.in) || 0),
                len: Math.max(0.02, Number(c.len) || 1), gain: typeof c.gain === "number" ? clamp(c.gain, 0, 2) : 1,
                fin: Math.max(0, Number(c.fin) || 0), fout: Math.max(0, Number(c.fout) || 0), autoLen: !!c.autoLen,
            });
            n++;
        }
        F.tracks.push(tr);
    }
    return F;
}

function setupFieldUI(node) {
    injectStyles();
    node.properties = node.properties || {};

    const getWidget = (name) => (node.widgets || []).find((x) => x.name === name);
    const fieldW = getWidget("field_json");
    const hideW = (w) => { if (w) { w.type = "hidden"; w.hidden = true; w.computeSize = () => [0, -4]; } };
    hideW(fieldW);
    hideW(getWidget("save_name"));      // имя файла меняется в окне, в режиме эксперта

    // ---------- состояние ----------
    let F = blankField();
    let sel = null;                 // {kind:'a', id} | {kind:'v', id}
    const undoS = [], redoS = [];
    let inputs = new Map();         // slot -> {spec, label, key}
    let structSig = "";
    let disposed = false;
    const expert = () => node.properties.arr_expert === true;

    function loadFromWidget() {
        let o = null;
        try { o = JSON.parse(fieldW ? fieldW.value : "{}"); } catch (e) { o = null; }
        F = normalizeField(o);
    }

    let saveTimer = null;
    function saveSoon() {
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            if (!fieldW) return;
            fieldW.value = JSON.stringify(F);
            if (typeof fieldW.callback === "function") { try { fieldW.callback(fieldW.value); } catch (e) { /* ок */ } }
        }, 150);
    }

    function pushUndo() {
        undoS.push(JSON.stringify(F));
        if (undoS.length > 60) undoS.shift();
        redoS.length = 0;
    }
    function undo() {
        if (!undoS.length) { setStatus(T("отменять нечего", "nothing to undo")); return; }
        redoS.push(JSON.stringify(F));
        F = normalizeField(JSON.parse(undoS.pop()));
        changed(true);
    }
    function redo() {
        if (!redoS.length) return;
        undoS.push(JSON.stringify(F));
        F = normalizeField(JSON.parse(redoS.pop()));
        changed(true);
    }

    const findClip = (id) => {
        for (const t of F.tracks) for (const c of t.clips) if (c.id === id) return { t, c };
        return null;
    };
    const trackOf = (id) => F.tracks.find((t) => t.clips.some((c) => c.id === id));
    const vIndex = (id) => F.video.clips.findIndex((c) => c.id === id);

    // ---------- входы-провода (как в микшере) ----------

    function audioSlots() {
        const out = [];
        (node.inputs || []).forEach((inp, i) => {
            const m = SLOT_RE.exec(inp.name || "");
            if (m) out.push({ inp, i, n: parseInt(m[1], 10) });
        });
        return out;
    }
    let syncing = false;
    function syncInputs() {
        if (syncing) return;
        syncing = true;
        try {
            let slots = audioSlots();
            let lastConn = -1;
            slots.forEach((s, k) => { if (s.inp.link !== null && s.inp.link !== undefined) lastConn = k; });
            const want = clamp(lastConn + 2, 1, MAX_INPUTS);
            for (let k = slots.length - 1; k >= want; k--) {
                const s = slots[k];
                if (s.inp.link === null || s.inp.link === undefined) node.removeInput(s.i);
            }
            slots = audioSlots();
            let maxN = Math.max(0, ...slots.map((s) => s.n));
            while (slots.length < want) {
                maxN += 1;
                node.addInput("audio_" + maxN, "AUDIO");
                slots = audioSlots();
            }
            ensureFits();
        } finally {
            syncing = false;
        }
    }

    function getLink(id) {
        const g = node.graph;
        if (!g || !g.links) return null;
        return g.links instanceof Map ? g.links.get(id) : g.links[id];
    }
    const widgetValue = (n, name) => { const w = (n.widgets || []).find((x) => x.name === name); return w ? w.value : undefined; };
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
                return null;
            }
            return o;
        }
        return null;
    }
    function describe(o) {
        const cls = o.comfyClass || o.type;
        const title = o.title || cls;
        const kit = String(widgetValue(o, "kit_name") || "default").trim() || "default";
        const bpm = clamp(Number(widgetValue(o, "bpm")) || 90, 40, 300);
        if (cls === "NeronDrumMachine") return { label: "Drum Machine", sub: title, spec: { type: "drum", kit_name: kit, bpm, json: String(widgetValue(o, "pattern_json") || "{}") } };
        if (cls === "NeronPianoRoll") return { label: "Piano Roll", sub: title, spec: { type: "piano", kit_name: kit, bpm, json: String(widgetValue(o, "project_json") || "{}") } };
        if (cls === "NeronAudioLoader" || cls === "LoadAudio") {
            const f = parseFileValue(widgetValue(o, cls === "LoadAudio" ? "audio" : "audio_file"));
            const start = Math.max(0, Number(widgetValue(o, "start_sec")) || 0);
            const end = Math.max(0, Number(widgetValue(o, "end_sec")) || 0);
            return { label: f ? f.name : "Audio", sub: title, spec: f ? { type: "file", name: f.name, subfolder: f.subfolder, kind: f.type, start, end } : null };
        }
        return { label: String(title), sub: cls, spec: null };
    }
    function readInputs() {
        const m = new Map();
        for (const s of audioSlots()) {
            if (s.inp.link === null || s.inp.link === undefined) continue;
            const o = resolveNode(s.inp.link);
            if (!o) continue;
            const d = describe(o);
            m.set(s.inp.name, { ...d, key: d.spec ? specBufKey(d.spec) : "" });
        }
        return m;
    }
    // для микшера: что подключено ко входам поля (чтобы он слышал поле без Queue)
    node.neronArrangeInputs = () => {
        const out = {};
        for (const [slot, d] of inputs) if (d.spec) out[slot] = d.spec;
        return out;
    };

    // ---------- источники звука кусков ----------

    function clipSource(c) {
        const s = c.src;
        if (s.kind === "input") {
            const d = inputs.get(s.slot);
            if (!d) return { label: `${s.slot} · ` + T("не подключён", "not wired"), state: "nowire", buf: null, peaks: null };
            if (!d.spec) return { label: `${s.slot} · ${d.label}`, state: "noprev", buf: null, peaks: null };
            const e = loadSpecBuf(d.spec);
            return { label: `${s.slot} · ${d.label}`, state: e.state, buf: e.buf, peaks: e.peaks, err: e.err, p: e.p };
        }
        const e = loadFileBuf(s);
        return { label: s.name, state: e.state, buf: e.buf, peaks: e.peaks, err: e.err, p: e.p };
    }

    // ---------- план видео (то же самое считает сервер) ----------

    function vplan() {
        const V = F.video.clips;
        if (!V.length) return null;
        if (V.some((c) => !(c.dur > 0))) return { loading: true };
        const fps = V[0].fps || 24, fr = 1 / fps;
        const snap = (x) => Math.round(x / fr) * fr;
        const cuts = F.video.cuts.slice(0, V.length - 1).map(snap).sort((a, b) => a - b);
        while (cuts.length < V.length - 1) { const k = cuts.length; cuts.push(snap(V[k].offset + V[k].dur)); }
        let end = snap(V[V.length - 1].offset + V[V.length - 1].dur);
        const minSeg = 2 * fr;
        const bounds = [0];
        for (const x of cuts) bounds.push(Math.max(bounds[bounds.length - 1] + minSeg, x));
        if (end < bounds[bounds.length - 1] + minSeg) end = bounds[bounds.length - 1] + minSeg;
        end = Math.min(end, MAX_SEC);
        bounds.push(end);
        const segs = V.map((c, k) => ({ k, id: c.id, a: bounds[k], b: bounds[k + 1], off: snap(c.offset), dur: c.dur }));
        const td = Math.min(F.video.trans_dur, Math.max(fr, (end / V.length) / 2));
        return { fps, fr, end, segs, bounds, trans: F.video.trans, td, snap, minSeg };
    }
    const audioEnd = () => { let e = 0; for (const t of F.tracks) for (const c of t.clips) e = Math.max(e, c.start + c.len); return e; };
    function outLen() {
        const p = vplan();
        if (p && !p.loading) return p.end;
        return audioEnd();
    }
    function viewLen() {
        let e = Math.max(outLen(), audioEnd(), 10);
        for (const c of F.video.clips) if (c.dur > 0) e = Math.max(e, c.offset + c.dur);
        return e + 2;
    }
    const frameDur = () => { const p = vplan(); return p && !p.loading ? p.fr : 1 / 24; };

    // ======================================================================
    //  КАРТОЧКА на холсте
    // ======================================================================

    const card = el("div", "nf-card");
    const bar = el("div", "nf-bar");
    const mk = (text, color, title, cls) => {
        const b = el("button", "nf-btn" + (cls ? " " + cls : ""), text);
        if (color) b.style.background = color;
        if (title) b.title = title;
        return b;
    };
    const cPlay = mk("▶", "#3fa34d", T("Играть (пауза — ещё раз)", "Play (again — pause)"));
    const cStop = mk("■", "#b3414a", T("Пауза", "Pause"));
    const cTime = el("span", "nf-time", "0:00.00");
    const cOpen = mk("🎬 " + T("ОТКРЫТЬ ПОЛЕ", "OPEN FIELD"), "#6b4fb3", T("Открыть большое окно поля", "Open the big field window"));
    const cHelp = mk("📖", null, T("Справка", "Help"), "sm");
    [cPlay, cStop, cTime, cOpen, cHelp].forEach((b) => bar.appendChild(b));
    card.appendChild(bar);
    const status = el("div", "nf-status", "");
    card.appendChild(status);
    const stageHost = el("div", "nf-stagehost");
    card.appendChild(stageHost);
    const ov = el("canvas", "nf-ov");
    card.appendChild(ov);

    let statusTimer = null;
    function setStatus(text, isError) {
        status.textContent = text || "";
        status.title = text || "";
        status.className = "nf-status" + (isError ? " err" : "");
        if (win) { wStatus.textContent = text || ""; wStatus.title = text || ""; wStatus.className = "nf-status" + (isError ? " err" : ""); }
        if (statusTimer) clearTimeout(statusTimer);
    }

    // ---------- сцена: 3 видео-элемента, переезжают между карточкой и окном ----------

    const stage = el("div", "nf-stage");
    const vids = new Map();          // id клипа -> <video>
    const miss = el("div", "nf-miss", T("нет кадров — чёрный экран", "no frames — black screen"));
    const novid = el("div", "nf-novid", T("Видео нет. Добавьте ролик в окне поля (🎬 ОТКРЫТЬ ПОЛЕ → + ВИДЕО).",
        "No video. Add a clip in the field window (🎬 OPEN FIELD → + VIDEO)."));
    stage.appendChild(novid);
    stage.appendChild(miss);
    stageHost.appendChild(stage);

    function syncVideoEls() {
        const ids = new Set(F.video.clips.map((c) => c.id));
        for (const [id, v] of [...vids.entries()]) {
            if (!ids.has(id)) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* ок */ } v.remove(); vids.delete(id); }
        }
        for (const c of F.video.clips) {
            let v = vids.get(c.id);
            const url = viewUrl(c.src);
            if (!v) {
                v = document.createElement("video");
                v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = "auto"; v.controls = false;
                v.dataset.url = "";
                v.addEventListener("seeked", () => {
                    if (v._pending !== undefined && v._pending !== null) { const t = v._pending; v._pending = null; seekPaused(v, t); }
                });
                stage.insertBefore(v, novid);
                vids.set(c.id, v);
            }
            if (v.dataset.url !== url) { v.dataset.url = url; v.src = url; v.load(); }
        }
        novid.style.display = F.video.clips.length ? "none" : "flex";
    }

    function seekPaused(v, t) {
        if (v.seeking) { v._pending = t; return; }
        if (Math.abs(v.currentTime - t) > 0.02) { try { v.currentTime = t; } catch (e) { /* ещё не готово */ } }
    }

    // ======================================================================
    //  ПРОИГРЫВАНИЕ
    // ======================================================================

    const P = { on: false, t0: 0, c0: 0, end: 0, srcs: [], raf: null, master: null, lim: null, chains: new Map(), restartT: null, primed: new Set(), lastSeek: 0 };
    let pos = 0;

    function ensureAudio() {
        const ctx = getCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        if (!P.master) {
            P.master = ctx.createGain();
            P.master.gain.value = F.master;
            P.lim = ctx.createDynamicsCompressor();
            P.lim.threshold.value = -3; P.lim.knee.value = 0; P.lim.ratio.value = 20; P.lim.attack.value = 0.002; P.lim.release.value = 0.12;
            P.master.connect(P.lim);
            P.lim.connect(ctx.destination);
        }
        return ctx;
    }
    function chainFor(id) {
        const ctx = ensureAudio();
        let ch = P.chains.get(id);
        if (!ch) { ch = buildTrackChain(ctx, P.master); P.chains.set(id, ch); }
        return ch;
    }
    const anySolo = () => F.video.audio.solo || F.tracks.some((t) => t.solo);
    const audible = (o) => !o.mute && (!anySolo() || o.solo);
    function applyMix(immediate) {
        if (!P.master) return;
        const ctx = getCtx();
        const set = (param, v) => { if (immediate) param.value = v; else param.setTargetAtTime(v, ctx.currentTime, 0.01); };
        set(P.master.gain, F.master);
        const va = P.chains.get("va");
        if (va) { set(va.vol.gain, audible(F.video.audio) ? F.video.audio.vol : 0); set(va.gl.gain, 1); set(va.gr.gain, 1); }
        for (const t of F.tracks) {
            const ch = P.chains.get(t.id);
            if (!ch) continue;
            set(ch.vol.gain, audible(t) ? t.vol : 0);
            set(ch.gl.gain, Math.min(1, 1 - t.pan));
            set(ch.gr.gain, Math.min(1, 1 + t.pan));
        }
        for (const [id, ch] of [...P.chains.entries()]) {
            if (id !== "va" && !F.tracks.some((t) => t.id === id)) { try { ch.vol.disconnect(); } catch (e) { /* ок */ } P.chains.delete(id); }
        }
    }

    // кусок звука: появление/затухание через громкость
    function schedulePiece(ctx, chain, buf, piece, t0, now) {
        const { start, len, fin, fout, gain } = piece;
        let inn = piece.in;
        if (start + len <= t0) return;
        const skip = Math.max(0, t0 - start);
        const off = inn + skip;
        if (off >= buf.duration) return;
        const dur = Math.min(len - skip, buf.duration - off);
        if (dur <= 0.002) return;
        const when = now + Math.max(0, start - t0);
        const cs = now + (start - t0);           // начало куска во времени звукового движка
        const env = (t) => {
            let v = 1;
            if (fin > 0 && t < fin) v = Math.min(v, t / fin);
            if (fout > 0 && t > len - fout) v = Math.min(v, (len - t) / fout);
            return Math.max(0, v) * gain;
        };
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        src.connect(g);
        g.connect(chain.input);
        g.gain.setValueAtTime(env(skip), when);
        if (fin > 0 && skip < fin) g.gain.linearRampToValueAtTime(env(fin), cs + fin);
        if (fout > 0) {
            const fs = len - fout;
            if (skip < fs) g.gain.setValueAtTime(env(fs), cs + fs);
            g.gain.linearRampToValueAtTime(0, cs + len);
        }
        src.start(when, off, dur);
        P.srcs.push(src);
    }

    function launch(from) {
        const ctx = ensureAudio();
        applyMix(true);
        const now = ctx.currentTime + 0.06;
        P.c0 = now;
        P.t0 = from;
        const L = outLen();
        P.end = L > 0 ? L : viewLen();
        // звук роликов
        const plan = vplan();
        if (plan && !plan.loading) {
            const ext = plan.trans === "fade" ? plan.td / 2 : 0.005;
            const last = plan.segs.length - 1;
            const ch = chainFor("va");
            for (const s of plan.segs) {
                const c = F.video.clips[s.k];
                const e = loadVideoAudio(c.src);
                if (e.state !== "ok" || !e.buf) continue;
                const el_ = s.k > 0 ? ext : 0, er = s.k < last ? ext : 0;
                let start = s.a - el_, len = (s.b + er) - start, inn = start - s.off;
                if (inn < 0) { start -= inn; len += inn; inn = 0; }
                if (len <= 0) continue;
                schedulePiece(ctx, ch, e.buf, { start, len, in: inn, gain: 1, fin: s.k > 0 ? 2 * el_ : 0, fout: s.k < last ? 2 * er : 0 }, from, now);
            }
        }
        // дорожки
        for (const t of F.tracks) {
            const ch = chainFor(t.id);
            for (const c of t.clips) {
                const src = clipSource(c);
                if (src.state !== "ok" || !src.buf) continue;
                schedulePiece(ctx, ch, src.buf, c, from, now);
            }
        }
        applyMix(true);
        P.on = true;
        P.primed.clear();
        if (!P.raf) P.raf = requestAnimationFrame(frame);
        showPlayState();
    }

    async function play() {
        if (P.on) return;
        ensureAudio();
        if (pos >= (outLen() || viewLen()) - 0.01) pos = 0;
        // дождаться звука, который ещё грузится (быстро: всё уже в кеше)
        const waits = [];
        for (const t of F.tracks) for (const c of t.clips) { const s = clipSource(c); if (s.state === "loading" && s.p) waits.push(s.p); }
        for (const c of F.video.clips) { const e = loadVideoAudio(c.src); if (e.state === "loading") waits.push(e.p); }
        if (waits.length) { setStatus(T("Готовлю звук...", "Preparing sound...")); await Promise.all(waits); if (disposed) return; }
        launch(pos);
        setStatus(T("Играет", "Playing"));
    }

    function stopSources() {
        for (const s of P.srcs) { try { s.stop(); } catch (e) { /* ок */ } }
        P.srcs = [];
    }
    function pause() {
        if (P.on) pos = curPos();
        P.on = false;
        stopSources();
        if (P.raf) { cancelAnimationFrame(P.raf); P.raf = null; }
        for (const v of vids.values()) { try { v.pause(); } catch (e) { /* ок */ } }
        syncVideo(pos, false);
        showTime(pos);
        drawOverlay();
        drawOverview();
        showPlayState();
    }
    function curPos() {
        if (!P.on) return pos;
        return P.t0 + (getCtx().currentTime - P.c0);
    }
    function seek(t) {
        pos = clamp(t, 0, viewLen());
        if (P.on) {
            stopSources();
            P.on = false;
            launch(pos);
        } else {
            syncVideo(pos, false);
            showTime(pos);
            drawOverlay();
            drawOverview();
        }
    }
    function restartSoon() {
        if (!P.on) return;
        if (P.restartT) clearTimeout(P.restartT);
        P.restartT = setTimeout(() => { P.restartT = null; if (P.on) { const t = curPos(); stopSources(); P.on = false; launch(t); } }, 120);
    }

    function frame() {
        P.raf = null;
        if (!P.on || disposed) return;
        const t = curPos();
        if (t >= P.end) {
            pos = P.end;
            pause();
            pos = 0;
            seek(0);
            setStatus(T("Конец. PLAY — сначала", "End. PLAY — from the start"));
            return;
        }
        syncVideo(t, true);
        showTime(t);
        drawOverlay(t);
        drawOverviewHead(t);
        if (winOpen()) follow(t);
        P.raf = requestAnimationFrame(frame);
    }

    // какой ролик видно в момент t (с наплывом — два сразу)
    function syncVideo(t, playing) {
        const plan = vplan();
        let missing = false;
        if (!plan || plan.loading) {
            for (const v of vids.values()) v.style.opacity = "0";
            miss.style.display = "none";
            return;
        }
        const want = new Map();     // k -> opacity
        let k = plan.segs.findIndex((s) => t >= s.a && t < s.b);
        if (k < 0) k = t >= plan.end ? plan.segs.length - 1 : 0;
        want.set(k, 1);
        if (plan.trans === "fade") {
            const h = plan.td / 2;
            for (let j = 0; j < plan.bounds.length - 2; j++) {
                const c = plan.bounds[j + 1];
                if (t > c - h && t < c + h) {
                    const x = (t - (c - h)) / plan.td;
                    want.clear();
                    want.set(j, 1);
                    want.set(j + 1, x);
                }
            }
        }
        const nowMs = performance.now();
        plan.segs.forEach((s) => {
            const v = vids.get(s.id);
            if (!v) return;
            const op = want.get(s.k);
            const st = t - s.off;
            const has = st >= 0 && st < s.dur;
            if (op === undefined || !has) {
                v.style.opacity = "0";
                if (op !== undefined && !has && op > 0.5) missing = true;
                if (!v.paused) { try { v.pause(); } catch (e) { /* ок */ } }
                // подготовить следующий ролик заранее, чтобы склейка не дёргалась
                if (playing && op === undefined && s.k > 0) {
                    const a = s.a - (plan.trans === "fade" ? plan.td / 2 : 0);
                    if (t > a - 0.8 && t < a && !P.primed.has(s.id)) {
                        P.primed.add(s.id);
                        seekPaused(v, Math.max(0, a - s.off));
                    }
                }
                return;
            }
            v.style.opacity = String(op);
            v.style.zIndex = String(op < 1 ? 2 : 1);
            if (playing) {
                if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
                if (Math.abs(v.currentTime - st) > 0.15 && nowMs - P.lastSeek > 350) {
                    P.lastSeek = nowMs;
                    try { v.currentTime = st; } catch (e) { /* ок */ }
                }
            } else {
                if (!v.paused) { try { v.pause(); } catch (e) { /* ок */ } }
                seekPaused(v, st);
            }
        });
        miss.style.display = missing ? "flex" : "none";
    }

    function showTime(t) {
        const s = fmtT(t);
        cTime.textContent = s;
        if (win) {
            const plan = vplan();
            const fr = plan && !plan.loading ? ` · ${T("кадр", "frame")} ${Math.round(t / plan.fr)}` : "";
            wTime.textContent = `${s} / ${fmtT(outLen())}${fr}`;
        }
    }
    function showPlayState() {
        cPlay.style.background = P.on ? "#2e8b3d" : "#3fa34d";
        if (win) wPlay.style.background = P.on ? "#2e8b3d" : "#3fa34d";
    }

    // ======================================================================
    //  ОБЗОР на карточке
    // ======================================================================

    let ovBase = null;
    function drawOverview() {
        const W = Math.max(10, Math.round(ov.clientWidth)), H = 44;
        const dpr = window.devicePixelRatio || 1;
        if (ov.width !== Math.round(W * dpr) || ov.height !== Math.round(H * dpr)) { ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr); }
        if (!ovBase) ovBase = document.createElement("canvas");
        ovBase.width = ov.width; ovBase.height = ov.height;
        const g = ovBase.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = "#15171c"; g.fillRect(0, 0, W, H);
        const L = viewLen();
        const X = (t) => (t / L) * W;
        const plan = vplan();
        const vh = plan ? 12 : 0;
        if (plan && !plan.loading) {
            for (const s of plan.segs) {
                g.fillStyle = VCOLORS[s.k % VCOLORS.length];
                g.globalAlpha = 0.85;
                g.fillRect(X(s.a), 2, Math.max(1, X(s.b) - X(s.a) - 1), vh - 2);
            }
            g.globalAlpha = 1;
        }
        const n = Math.max(1, F.tracks.length);
        const th = (H - vh - 4) / n;
        F.tracks.forEach((t, i) => {
            g.fillStyle = t.color;
            g.globalAlpha = audible(t) ? 0.8 : 0.25;
            for (const c of t.clips) g.fillRect(X(c.start), vh + 2 + i * th + 1, Math.max(1, X(c.len)), Math.max(1, th - 2));
        });
        g.globalAlpha = 1;
        if (!F.tracks.length && !plan) {
            g.fillStyle = "#6b7080"; g.font = "10px Segoe UI, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(T("пусто — откройте поле", "empty — open the field"), W / 2, H / 2);
        }
        drawOverviewHead(curPos());
    }
    function drawOverviewHead(t) {
        if (!ovBase) return;
        const g = ov.getContext("2d");
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(ovBase, 0, 0);
        const dpr = window.devicePixelRatio || 1;
        const x = Math.round((t / viewLen()) * ov.width);
        g.fillStyle = "#ffffff";
        g.fillRect(x, 0, Math.max(1, Math.round(dpr * 1.5)), ov.height);
    }
    ov.addEventListener("pointerdown", (e) => {
        const r = ov.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * viewLen());
    });

    // ======================================================================
    //  БОЛЬШОЕ ОКНО (создаётся при первом открытии)
    // ======================================================================

    let win = null, wStatus = null, wTime = null, wPlay = null;
    let W = {};                      // элементы окна
    const view = { pps: 0, sx: 0 };   // пикселей в секунде, прокрутка (пиксели)
    let rows = [];
    let drawPending = false;
    const winOpen = () => !!win && win.style.display !== "none";

    function geom() {
        const g = node.properties.arr_win || {};
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = clamp(Number(g.w) || Math.round(vw * 0.82), 520, vw);
        const h = clamp(Number(g.h) || Math.round(vh * 0.84), 380, vh);
        return { x: clamp(Number.isFinite(g.x) ? g.x : (vw - w) / 2, 0, Math.max(0, vw - 80)), y: clamp(Number.isFinite(g.y) ? g.y : (vh - h) / 2, 0, Math.max(0, vh - 40)),
            w, h, full: !!g.full, split: clamp(Number(g.split) || 0.36, 0.12, 0.7) };
    }
    function saveGeom(patch) { node.properties.arr_win = Object.assign(geom(), node.properties.arr_win || {}, patch); }
    function applyGeom() {
        const g = geom();
        if (g.full) { Object.assign(win.style, { left: "0px", top: "0px", width: "100vw", height: "100vh", borderRadius: "0" }); }
        else Object.assign(win.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px", borderRadius: "10px" });
        W.full.classList.toggle("on", g.full);
        layoutStage();
    }
    function layoutStage() {
        if (!win) return;
        const g = geom();
        const has = F.video.clips.length > 0;
        const bodyH = W.body.clientHeight || 400;
        W.wstage.style.height = has ? Math.round(bodyH * g.split) + "px" : "0px";
        W.wstage.style.display = has ? "flex" : "none";
        W.split.style.display = has ? "block" : "none";
    }

    function buildWindow() {
        win = el("div", "nf-win");
        win.tabIndex = 0;
        // ---- заголовок ----
        const title = el("div", "nf-title");
        title.appendChild(el("b", "", "🎬 NERON " + T("ПОЛЕ", "FIELD")));
        wPlay = mk("▶", "#3fa34d", T("Играть (Пробел)", "Play (Space)"));
        const wStop = mk("■", "#b3414a", T("Пауза (Пробел)", "Pause (Space)"));
        const wHome = mk("⏮", null, T("В начало (Home)", "To start (Home)"), "sm");
        wTime = el("span", "nf-time", "0:00.00");
        wTime.style.minWidth = "170px";
        const addV = mk("+ " + T("ВИДЕО", "VIDEO"), "#2f6f9f", T("Добавить ролик (до 3)", "Add a clip (up to 3)"));
        const addA = mk("+ " + T("ЗВУК", "SOUND"), "#2f7d4a", T("Добавить звук на курсор", "Add sound at the cursor"));
        const addT = mk("+ " + T("ДОРОЖКА", "TRACK"), null, T("Новая дорожка", "New track"));
        const magnet = mk("🧲", null, T("Прилипание к краям, разделителям и курсору", "Snap to edges, dividers and the cursor"), "sm");
        const zoomOut = mk("−", null, T("Мельче (Ctrl+колёсико)", "Zoom out (Ctrl+wheel)"), "sm");
        const zoomIn = mk("＋", null, T("Крупнее (Ctrl+колёсико)", "Zoom in (Ctrl+wheel)"), "sm");
        const zoomFit = mk("⤢", null, T("Показать всё", "Fit all"), "sm");
        const expBtn = mk("⚙ " + T("ЭКСПЕРТ", "EXPERT"), null, T("Точные настройки", "Fine settings"), "sm");
        const help = mk("📖", null, T("Справка", "Help"), "sm");
        const build = mk("💾 " + T("СОБРАТЬ", "BUILD"), "#8e44ad", T("Сохранить звук (WAV) и видео (mp4)", "Save the sound (WAV) and the video (mp4)"));
        const full = mk("⛶", null, T("На весь экран", "Full screen"), "sm");
        const close = mk("✕", "#7a3b3b", T("Закрыть окно (Esc)", "Close the window (Esc)"), "sm");
        const sep = () => el("span", "nf-sep");
        [wPlay, wStop, wHome, wTime, sep(), addV, addA, addT, sep(), magnet, zoomOut, zoomIn, zoomFit, el("span", "nf-sp"), expBtn, help, build, full, close]
            .forEach((b) => title.appendChild(b));
        win.appendChild(title);
        wStatus = el("div", "nf-status", "");
        wStatus.style.padding = "2px 8px";
        wStatus.style.background = "#1f2229";
        win.appendChild(wStatus);

        // ---- тело ----
        const body = el("div", "nf-body");
        const wstage = el("div", "nf-wstage");
        const split = el("div", "nf-split");
        split.title = T("Потяните, чтобы поменять высоту картинки", "Drag to change the picture height");
        const rrow = el("div", "nf-rrow");
        const rhead = el("div", "nf-rhead", T("время", "time"));
        const rcv = el("div", "nf-rcv");
        const ruler = el("canvas");
        rcv.appendChild(ruler);
        rrow.appendChild(rhead);
        rrow.appendChild(rcv);
        const tl = el("div", "nf-tl");
        const tlin = el("div", "nf-tlin");
        const heads = el("div", "nf-heads");
        const lanesBox = el("div", "nf-lanes");
        const lanes = el("canvas");
        const over = el("canvas");
        over.style.pointerEvents = "none";
        lanesBox.appendChild(lanes);
        lanesBox.appendChild(over);
        tlin.appendChild(heads);
        tlin.appendChild(lanesBox);
        tl.appendChild(tlin);
        const hs = el("div", "nf-hs");
        const hsr = el("input");
        hsr.type = "range"; hsr.min = "0"; hsr.max = "1000"; hsr.value = "0";
        hsr.title = T("Прокрутка по времени", "Scroll in time");
        hs.appendChild(hsr);
        [wstage, split, rrow, tl, hs].forEach((x) => body.appendChild(x));
        win.appendChild(body);

        const selp = el("div", "nf-selp");
        win.appendChild(selp);
        const exp = el("div", "nf-exp");
        win.appendChild(exp);
        const grip = el("div", "nf-grip");
        grip.title = T("Потяните, чтобы изменить размер", "Drag to resize");
        win.appendChild(grip);
        const drop = el("div", "nf-drop", T("Отпустите файл: звук или видео", "Drop the file: audio or video"));
        win.appendChild(drop);
        const fileIn = el("input");
        fileIn.type = "file"; fileIn.multiple = true; fileIn.style.display = "none";
        win.appendChild(fileIn);
        // RU: Клавиши окна принимает скрытое поле. ComfyUI не трогает нажатия, когда
        //     активно поле ввода, — поэтому Ctrl+Z, Delete и Пробел не уходят в граф
        //     (раньше Ctrl+Z откатывал весь граф, а Delete мог удалить ноду).
        // EN: A hidden text field takes the window's keys. ComfyUI ignores key presses
        //     while a text field is focused, so Ctrl+Z, Delete and Space stay here.
        keyCatcher = el("textarea");
        keyCatcher.readOnly = true;
        keyCatcher.setAttribute("aria-hidden", "true");
        keyCatcher.tabIndex = -1;
        keyCatcher.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
        win.appendChild(keyCatcher);
        document.body.appendChild(win);

        W = { title, body, wstage, split, rrow, ruler, rcv, tl, tlin, heads, lanesBox, lanes, over, hsr, selp, exp, grip, drop, fileIn,
            addV, addA, addT, magnet, expBtn, full, build };

        // ---- кнопки ----
        wPlay.addEventListener("click", () => (P.on ? pause() : play()));
        wStop.addEventListener("click", () => pause());
        wHome.addEventListener("click", () => seek(0));
        help.addEventListener("click", showHelp);
        close.addEventListener("click", closeWindow);
        full.addEventListener("click", () => { saveGeom({ full: !geom().full }); applyGeom(); fitZoomIfNeeded(); requestDraw(); });
        magnet.addEventListener("click", () => { F.snap = !F.snap; magnet.classList.toggle("on", F.snap); saveSoon(); });
        zoomIn.addEventListener("click", () => zoomAt(1.5, laneW() / 2));
        zoomOut.addEventListener("click", () => zoomAt(1 / 1.5, laneW() / 2));
        zoomFit.addEventListener("click", () => { fitZoom(); requestDraw(); });
        expBtn.addEventListener("click", () => { node.properties.arr_expert = !expert(); buildExpert(); buildSel(); });
        addT.addEventListener("click", () => addTrack(true));
        addV.addEventListener("click", () => menuVideo(addV));
        addA.addEventListener("click", () => menuAudio(addA));
        build.addEventListener("click", doBuild);
        hsr.addEventListener("input", () => {
            const max = Math.max(0, viewLen() * view.pps - laneW());
            view.sx = (Number(hsr.value) / 1000) * max;
            requestDraw();
        });
        hsr.addEventListener("keydown", (e) => e.stopPropagation());
        fileIn.addEventListener("change", async () => {
            const files = [...fileIn.files];
            fileIn.value = "";
            await addFiles(files, null);
        });

        // ---- перетаскивание окна, размер, полоска ----
        title.addEventListener("pointerdown", (e) => {
            if (e.target !== title && e.target.tagName !== "B") return;
            if (geom().full) return;
            const g = geom();
            const sx = e.clientX - g.x, sy = e.clientY - g.y;
            title.setPointerCapture(e.pointerId);
            const mv = (ev) => {
                const x = clamp(ev.clientX - sx, -g.w + 120, window.innerWidth - 80);
                const y = clamp(ev.clientY - sy, 0, window.innerHeight - 40);
                win.style.left = x + "px"; win.style.top = y + "px";
            };
            const up = () => {
                title.removeEventListener("pointermove", mv);
                title.removeEventListener("pointerup", up);
                saveGeom({ x: parseFloat(win.style.left), y: parseFloat(win.style.top) });
            };
            title.addEventListener("pointermove", mv);
            title.addEventListener("pointerup", up);
        });
        grip.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (geom().full) saveGeom({ full: false });
            const g = geom();
            const r = win.getBoundingClientRect();
            const sx = e.clientX, sy = e.clientY;
            grip.setPointerCapture(e.pointerId);
            const mv = (ev) => {
                win.style.width = clamp(r.width + ev.clientX - sx, 520, window.innerWidth - r.left) + "px";
                win.style.height = clamp(r.height + ev.clientY - sy, 380, window.innerHeight - r.top) + "px";
                layoutStage();
                requestDraw();
            };
            const up = () => {
                grip.removeEventListener("pointermove", mv);
                grip.removeEventListener("pointerup", up);
                saveGeom({ x: r.left, y: r.top, w: win.offsetWidth, h: win.offsetHeight, full: false });
                W.full.classList.remove("on");
            };
            grip.addEventListener("pointermove", mv);
            grip.addEventListener("pointerup", up);
            void g;
        });
        split.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            split.setPointerCapture(e.pointerId);
            const top = body.getBoundingClientRect().top;
            const mv = (ev) => {
                const f = clamp((ev.clientY - top) / Math.max(1, body.clientHeight), 0.12, 0.7);
                node.properties.arr_win = Object.assign(node.properties.arr_win || {}, { split: f });
                layoutStage();
                requestDraw();
            };
            const up = () => { split.removeEventListener("pointermove", mv); split.removeEventListener("pointerup", up); };
            split.addEventListener("pointermove", mv);
            split.addEventListener("pointerup", up);
        });

        // ---- клавиши: окно перехватывает их, чтобы ComfyUI не удалил ноду по Delete ----
        win.addEventListener("keydown", onKey);
        win.addEventListener("keyup", (e) => e.stopPropagation());
        win.addEventListener("pointerdown", (e) => {
            win.style.zIndex = String(9000 + (++zTop));
            if (!["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) setTimeout(focusKeys, 0);
        });
        win.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
        win.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); });

        // ---- файлы, брошенные на окно ----
        let dragDepth = 0;
        win.addEventListener("dragenter", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); dragDepth++; drop.style.display = "flex"; } });
        win.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.style.display = "none"; });
        win.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); e.stopPropagation(); } });
        win.addEventListener("drop", async (e) => {
            dragDepth = 0;
            drop.style.display = "none";
            if (!e.dataTransfer || !e.dataTransfer.files.length) return;
            e.preventDefault();
            e.stopPropagation();
            const at = laneHitInfo(e.clientX, e.clientY);
            await addFiles([...e.dataTransfer.files], at);
        });

        // ---- поле с дорожками ----
        lanes.addEventListener("pointerdown", onLaneDown);
        lanes.addEventListener("pointermove", onLaneHover);
        lanes.addEventListener("dblclick", onLaneDbl);
        lanes.addEventListener("wheel", onWheel, { passive: false });
        ruler.addEventListener("wheel", onWheel, { passive: false });
        ruler.addEventListener("pointerdown", (e) => {
            ruler.setPointerCapture(e.pointerId);
            const go = (ev) => { const r = ruler.getBoundingClientRect(); seek(tAt(ev.clientX - r.left)); };
            go(e);
            const mv = (ev) => go(ev);
            const up = () => { ruler.removeEventListener("pointermove", mv); ruler.removeEventListener("pointerup", up); };
            ruler.addEventListener("pointermove", mv);
            ruler.addEventListener("pointerup", up);
        });

        const ro = new ResizeObserver(() => { if (winOpen()) { layoutStage(); requestDraw(); } });
        ro.observe(win);
        W.ro = ro;
    }
    let zTop = 0;
    let keyCatcher = null;
    const focusKeys = () => { if (keyCatcher && winOpen()) keyCatcher.focus({ preventScroll: true }); };

    function openWindow() {
        if (!win) buildWindow();
        win.style.display = "flex";
        win.style.zIndex = String(9000 + (++zTop));
        applyGeom();
        W.wstage.appendChild(stage);
        W.magnet.classList.toggle("on", F.snap);
        buildHeads();
        buildSel();
        buildExpert();
        if (!view.pps) fitZoom();
        requestDraw();
        showTime(curPos());
        showPlayState();
        setTimeout(() => { focusKeys(); requestDraw(); startThumbs(); }, 30);
    }
    function closeWindow() {
        if (!win) return;
        if (keyCatcher && document.activeElement === keyCatcher) keyCatcher.blur();
        win.style.display = "none";
        closeMenu();
        stageHost.appendChild(stage);
        thumbsStop = true;
        drawOverview();
    }

    // ---------- геометрия поля ----------

    const laneW = () => (W.lanesBox ? Math.max(50, W.lanesBox.clientWidth) : 600);
    const xAt = (t) => t * view.pps - view.sx;
    const tAt = (x) => (x + view.sx) / view.pps;
    function fitZoom() {
        view.pps = clamp((laneW() - 16) / viewLen(), 2, 2000);
        view.sx = 0;
    }
    function fitZoomIfNeeded() { if (viewLen() * view.pps < laneW() * 0.5) fitZoom(); }
    function clampScroll() {
        const max = Math.max(0, viewLen() * view.pps - laneW() + 40);
        view.sx = clamp(view.sx, 0, max);
        if (W.hsr) W.hsr.value = String(max > 0 ? Math.round((view.sx / max) * 1000) : 0);
    }
    function zoomAt(f, x) {
        const t = tAt(x);
        view.pps = clamp(view.pps * f, 2, 2000);
        view.sx = t * view.pps - x;
        requestDraw();
    }
    function onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        const r = W.lanes.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left);
        else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { W.tl.scrollTop += e.deltaY; view.sx += e.deltaX; requestDraw(); }
        else { view.sx += e.deltaY; requestDraw(); }
    }
    function follow(t) {
        const x = xAt(t);
        if (x > laneW() - 30 || x < 0) { view.sx = Math.max(0, t * view.pps - 40); requestDraw(); }
    }

    function layoutRows() {
        rows = [];
        let y = 0;
        const add = (r) => { r.y = y; rows.push(r); y += r.h; };
        if (F.video.clips.length) {
            F.video.clips.forEach((c, k) => add({ type: "video", k, id: c.id, h: VROW_H }));
            add({ type: "result", h: RES_H });
            add({ type: "vaudio", h: VA_H });
        } else add({ type: "vempty", h: VROW_H });
        F.tracks.forEach((t, i) => add({ type: "track", i, id: t.id, h: TROW_H }));
        add({ type: "add", h: ADD_H });
        return y;
    }
    const rowAtY = (y) => rows.find((r) => y >= r.y && y < r.y + r.h) || null;

    // ---------- заголовки строк (слева) ----------

    function buildHeads() {
        if (!win) return;
        const H = layoutRows();
        const box = W.heads;
        box.innerHTML = "";
        W.tlin.style.height = H + "px";
        for (const r of rows) {
            const h = el("div", "nf-head");
            h.style.height = r.h + "px";
            if (r.type === "video") {
                const c = F.video.clips[r.k];
                const l1 = el("div", "nf-hl");
                const dot = el("span", "nf-dot"); dot.style.background = VCOLORS[r.k % VCOLORS.length];
                const nm = el("b", "", `🎬 ${r.k + 1}. ${c.src.name}`);
                nm.title = c.src.name;
                const rm = el("button", "nf-ms", "✕");
                rm.title = T("Убрать ролик", "Remove the clip");
                rm.addEventListener("click", () => removeVideo(c.id));
                [dot, nm, rm].forEach((x) => l1.appendChild(x));
                const l2 = el("div", "nf-hl");
                const info = el("span", "", c.dur > 0 ? `${fmtT(c.dur)} · ${Math.round((c.fps || 0) * 100) / 100} fps · ${c.w}×${c.h}` : T("загрузка...", "loading..."));
                l2.appendChild(info);
                h.appendChild(l1); h.appendChild(l2);
            } else if (r.type === "result") {
                const l1 = el("div", "nf-hl");
                const b = el("b", "", T("ИТОГ", "RESULT"));
                b.style.color = "#ffd166";
                const l2 = el("div", "nf-hl");
                const ts = el("select", "nf-sel");
                [["cut", "✂ " + T("склейка", "cut")], ["fade", "🌫 " + T("наплыв", "dissolve")]].forEach(([v, t]) => { const o = el("option", "", t); o.value = v; ts.appendChild(o); });
                ts.value = F.video.trans;
                ts.title = T("Как один ролик сменяет другой", "How one clip turns into the next");
                ts.addEventListener("change", () => { pushUndo(); F.video.trans = ts.value; changed(); buildExpert(); });
                ts.addEventListener("keydown", (e) => e.stopPropagation());
                l1.appendChild(b); l2.appendChild(ts);
                h.appendChild(l1); h.appendChild(l2);
            } else if (r.type === "vaudio") {
                const a = F.video.audio;
                const l0 = el("div", "nf-hl");
                l0.appendChild(el("b", "", "🔊 " + T("ЗВУК ВИДЕО", "VIDEO SOUND")));
                h.appendChild(l0);
                const l1 = el("div", "nf-hl");
                const m = el("button", "nf-ms" + (a.mute ? " on-m" : ""), "M");
                m.title = T("Выключить родной звук роликов", "Mute the clips' own sound");
                const s = el("button", "nf-ms" + (a.solo ? " on-s" : ""), "S");
                s.title = T("Только этот звук", "Solo");
                m.addEventListener("click", () => { a.mute = !a.mute; m.classList.toggle("on-m", a.mute); mixChanged(); });
                s.addEventListener("click", () => { a.solo = !a.solo; s.classList.toggle("on-s", a.solo); mixChanged(); });
                l1.appendChild(m); l1.appendChild(s);
                const vol = slider(0, 1.2, 0.01, a.vol, "#4dabf7", T("Громкость (двойной клик — сброс)", "Volume (double click — reset)"), (v) => { a.vol = v; mixChanged(); }, 0.8);
                l1.appendChild(el("span", "", "VOL"));
                l1.appendChild(vol);
                h.appendChild(l1);
            } else if (r.type === "vempty") {
                const l1 = el("div", "nf-hl");
                const b = mk("+ " + T("ВИДЕО", "VIDEO"), "#2f6f9f", T("Добавить ролик", "Add a clip"), "sm");
                b.addEventListener("click", () => menuVideo(b));
                l1.appendChild(b);
                h.appendChild(l1);
                h.appendChild(el("div", "nf-hint", T("до 3 роликов", "up to 3 clips")));
            } else if (r.type === "track") {
                const t = F.tracks[r.i];
                h.style.setProperty("--c", t.color);
                const l1 = el("div", "nf-hl");
                const dot = el("span", "nf-dot"); dot.style.background = t.color;
                const nm = el("b", "", t.name);
                nm.style.color = t.color;
                nm.title = T("Двойной клик — переименовать", "Double click — rename");
                nm.addEventListener("dblclick", () => renameTrack(t, nm));
                const m = el("button", "nf-ms" + (t.mute ? " on-m" : ""), "M");
                m.title = T("Выключить дорожку", "Mute the track");
                const s = el("button", "nf-ms" + (t.solo ? " on-s" : ""), "S");
                s.title = T("Только эта дорожка", "Solo");
                const rm = el("button", "nf-ms", "✕");
                rm.title = T("Удалить дорожку (дважды)", "Delete the track (twice)");
                m.addEventListener("click", () => { t.mute = !t.mute; m.classList.toggle("on-m", t.mute); mixChanged(); });
                s.addEventListener("click", () => { t.solo = !t.solo; s.classList.toggle("on-s", t.solo); mixChanged(); });
                let armed = null;
                rm.addEventListener("click", () => {
                    if (!armed) { rm.textContent = "?"; armed = setTimeout(() => { armed = null; rm.textContent = "✕"; }, 1800); return; }
                    clearTimeout(armed);
                    removeTrack(t.id);
                });
                [dot, nm, m, s, rm].forEach((x) => l1.appendChild(x));
                const l2 = el("div", "nf-hl");
                l2.appendChild(el("span", "", "VOL"));
                l2.appendChild(slider(0, 1.2, 0.01, t.vol, t.color, T("Громкость дорожки (двойной клик — сброс)", "Track volume (double click — reset)"), (v) => { t.vol = v; mixChanged(); }, 0.8));
                l2.appendChild(el("span", "", "PAN"));
                l2.appendChild(slider(-1, 1, 0.05, t.pan, t.color, T("Баланс лево-право (двойной клик — центр)", "Pan left-right (double click — center)"), (v) => { t.pan = v; mixChanged(); }, 0));
                h.appendChild(l1); h.appendChild(l2);
            } else if (r.type === "add") {
                const l1 = el("div", "nf-hl");
                const b = mk("+ " + T("ДОРОЖКА", "TRACK"), null, T("Новая дорожка", "New track"), "sm");
                b.disabled = F.tracks.length >= MAX_TRACKS;
                b.addEventListener("click", () => addTrack(true));
                l1.appendChild(b);
                h.appendChild(l1);
            }
            box.appendChild(h);
        }
    }

    function slider(min, max, step, value, color, title, onInput, def) {
        const s = el("input");
        s.type = "range"; s.min = String(min); s.max = String(max); s.step = String(step); s.value = String(value);
        s.style.setProperty("--c", color);
        s.title = title;
        s.addEventListener("input", () => onInput(parseFloat(s.value)));
        s.addEventListener("dblclick", () => { s.value = String(def); onInput(def); });
        s.addEventListener("keydown", (e) => e.stopPropagation());
        return s;
    }

    function renameTrack(t, nm) {
        const inp = el("input", "nf-num");
        inp.style.width = "110px";
        inp.value = t.name;
        nm.replaceWith(inp);
        inp.focus();
        inp.select();
        const done = (ok) => {
            if (ok && inp.value.trim()) { pushUndo(); t.name = inp.value.trim().slice(0, 40); saveSoon(); }
            buildHeads();
        };
        inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
        inp.addEventListener("blur", () => done(true));
    }

    // ---------- рисование поля ----------

    function requestDraw() {
        if (!winOpen() || drawPending) return;
        drawPending = true;
        requestAnimationFrame(() => { drawPending = false; if (winOpen()) drawAll(); });
    }

    function sizeCanvas(cv, w, h) {
        const dpr = window.devicePixelRatio || 1;
        const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
        cv.style.width = w + "px"; cv.style.height = h + "px";
        const g = cv.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return g;
    }

    function tickStep() {
        const steps = [0.04, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
        for (const s of steps) if (s * view.pps >= 70) return s;
        return 600;
    }

    function drawAll() {
        drawStamp++;
        const H = layoutRows();
        if (W.heads.childElementCount !== rows.length) buildHeads();
        clampScroll();
        const w = laneW();
        // линейка
        const rg = sizeCanvas(W.ruler, w, RULER_H);
        rg.fillStyle = "#1f2229"; rg.fillRect(0, 0, w, RULER_H);
        const st = tickStep();
        const t0 = Math.floor(tAt(0) / st) * st;
        rg.fillStyle = "#8b90a0"; rg.font = "10px Segoe UI, Arial"; rg.textBaseline = "top";
        for (let t = t0; xAt(t) < w; t += st) {
            const x = Math.round(xAt(t)) + 0.5;
            if (x < -1) continue;
            rg.fillRect(x, 12, 1, RULER_H - 12);
            rg.fillText(st < 1 ? t.toFixed(st < 0.1 ? 2 : 1) + "s" : fmtT(t).replace(/\.00$/, ""), x + 3, 2);
            for (let k = 1; k < 4; k++) { const xx = Math.round(xAt(t + (st * k) / 4)) + 0.5; rg.fillRect(xx, 18, 1, RULER_H - 18); }
        }
        const L = outLen();
        if (L > 0) { rg.fillStyle = "#ffd166"; rg.fillRect(Math.round(xAt(L)), 0, 2, RULER_H); }

        // дорожки
        const g = sizeCanvas(W.lanes, w, H);
        sizeCanvas(W.over, w, H);
        g.clearRect(0, 0, w, H);
        const plan = vplan();
        for (const r of rows) {
            g.fillStyle = (r.type === "track" && r.i % 2) ? "#1d2027" : "#191b21";
            if (r.type === "result") g.fillStyle = "#22201a";
            g.fillRect(0, r.y, w, r.h);
            g.fillStyle = "#2a2d35"; g.fillRect(0, r.y + r.h - 1, w, 1);
        }
        // сетка секунд
        g.fillStyle = "rgba(255,255,255,0.04)";
        for (let t = t0; xAt(t) < w; t += st) g.fillRect(Math.round(xAt(t)), 0, 1, H);
        if (L > 0) { g.fillStyle = "rgba(255,209,102,0.35)"; g.fillRect(Math.round(xAt(L)), 0, 1, H); }

        for (const r of rows) {
            if (r.type === "video") drawVideoRow(g, r, plan, w);
            else if (r.type === "result") drawResultRow(g, r, plan, w);
            else if (r.type === "vaudio") drawVAudioRow(g, r, plan, w);
            else if (r.type === "track") drawTrackRow(g, r, w);
            else if (r.type === "vempty") {
                g.fillStyle = "#6b7080"; g.font = "11px Segoe UI, Arial"; g.textBaseline = "middle";
                g.fillText(T("Видео нет: + ВИДЕО или перетащите ролик на окно", "No video: + VIDEO or drop a clip onto the window"), 10, r.y + r.h / 2);
            } else if (r.type === "add" && !F.tracks.length) {
                g.fillStyle = "#6b7080"; g.font = "11px Segoe UI, Arial"; g.textBaseline = "middle";
                g.fillText(T("Звука нет: + ЗВУК или перетащите файл на окно", "No sound: + SOUND or drop a file onto the window"), 10, r.y + r.h / 2);
            }
        }
        // разделители: линия через строки видео
        if (plan && !plan.loading) {
            const vr = rows.filter((r) => r.type === "video" || r.type === "result");
            if (vr.length) {
                const y0 = vr[0].y, y1 = vr[vr.length - 1].y + vr[vr.length - 1].h;
                for (let j = 1; j < plan.bounds.length - 1; j++) {
                    const x = Math.round(xAt(plan.bounds[j]));
                    g.fillStyle = "#ffd166";
                    g.fillRect(x - 1, y0, 2, y1 - y0);
                    const rr = rows.find((r) => r.type === "result");
                    const cy = rr.y + rr.h / 2;
                    g.beginPath(); g.moveTo(x, cy - 9); g.lineTo(x + 7, cy); g.lineTo(x, cy + 9); g.lineTo(x - 7, cy); g.closePath();
                    g.fillStyle = hover && hover.type === "cut" && hover.j === j - 1 ? "#ffffff" : "#ffd166";
                    g.fill();
                }
            }
        }
        drawOverlay();
        if (W.hsr) {
            W.hsr.parentElement.style.display = viewLen() * view.pps > laneW() + 2 ? "flex" : "none";
        }
    }

    function hatch(g, x, y, w, h, color) {
        g.save();
        g.beginPath(); g.rect(x, y, w, h); g.clip();
        g.strokeStyle = color; g.lineWidth = 2;
        for (let i = -h; i < w; i += 8) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); }
        g.restore();
    }

    function drawVideoRow(g, r, plan, w) {
        const c = F.video.clips[r.k];
        const col = VCOLORS[r.k % VCOLORS.length];
        const y = r.y + 4, h = r.h - 8;
        if (!(c.dur > 0)) {
            g.fillStyle = "#6b7080"; g.font = "11px Segoe UI, Arial"; g.textBaseline = "middle";
            g.fillText(T("загрузка ролика...", "loading the clip..."), 10, r.y + r.h / 2);
            return;
        }
        const x0 = xAt(c.offset), x1 = xAt(c.offset + c.dur);
        if (x1 < 0 || x0 > w) return;
        g.fillStyle = "#0e0f12"; g.fillRect(x0, y, x1 - x0, h);
        // превью кадров
        const th = thumbs.get(mediaKey(c.src));
        if (th && th.imgs.length) {
            const tw = Math.max(20, Math.round(h * (th.ar || 16 / 9)));
            g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, h); g.clip();
            g.globalAlpha = 0.85;
            for (let x = Math.max(x0, x0 + Math.floor((0 - x0) / tw) * tw); x < Math.min(x1, w); x += tw) {
                const tt = tAt(x + tw / 2) - c.offset;
                const i = clamp(Math.floor(tt / th.step), 0, th.imgs.length - 1);
                const im = th.imgs[i] || th.imgs.find(Boolean);
                if (im) g.drawImage(im, x, y, tw, h);
            }
            g.restore();
            g.globalAlpha = 1;
        }
        // часть, которая идёт в итог, ярче; остальное притушено
        if (plan && !plan.loading) {
            const s = plan.segs[r.k];
            g.fillStyle = "rgba(0,0,0,0.55)";
            const ua = xAt(s.a), ub = xAt(s.b);
            if (ua > x0) g.fillRect(x0, y, Math.min(ua, x1) - x0, h);
            if (ub < x1) g.fillRect(Math.max(ub, x0), y, x1 - Math.max(ub, x0), h);
            g.strokeStyle = col; g.lineWidth = 2;
            g.strokeRect(Math.max(ua, x0) + 1, y + 1, Math.max(0, Math.min(ub, x1) - Math.max(ua, x0) - 2), h - 2);
        }
        const isSel = sel && sel.kind === "v" && sel.id === c.id;
        g.strokeStyle = isSel ? "#ffffff" : col; g.lineWidth = isSel ? 2 : 1;
        g.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
        g.fillStyle = "rgba(0,0,0,0.55)";
        const label = `${r.k + 1}. ${c.src.name}` + (c.offset ? `  (${c.offset > 0 ? "+" : ""}${c.offset.toFixed(2)} с/s)` : "");
        g.font = "bold 10px Segoe UI, Arial";
        const lw = g.measureText(label).width + 8;
        const lx = clamp(x0 + 2, 2, Math.max(2, x1 - lw - 2));
        g.fillRect(lx, y + 2, lw, 14);
        g.fillStyle = col; g.textBaseline = "top";
        g.fillText(label, lx + 4, y + 3);
    }

    function drawResultRow(g, r, plan, w) {
        if (!plan || plan.loading) return;
        const y = r.y + 5, h = r.h - 10;
        for (const s of plan.segs) {
            const xa = xAt(s.a), xb = xAt(s.b);
            if (xb < 0 || xa > w) continue;
            g.fillStyle = VCOLORS[s.k % VCOLORS.length];
            g.globalAlpha = 0.75;
            g.fillRect(xa, y, xb - xa, h);
            g.globalAlpha = 1;
            // где у ролика нет кадров — красная штриховка
            const ha = Math.max(s.a, s.off), hb = Math.min(s.b, s.off + s.dur);
            if (ha > s.a) hatch(g, xa, y, xAt(Math.min(ha, s.b)) - xa, h, "#ff5252");
            if (hb < s.b) hatch(g, xAt(Math.max(hb, s.a)), y, xb - xAt(Math.max(hb, s.a)), h, "#ff5252");
            g.fillStyle = "#111"; g.font = "bold 11px Segoe UI, Arial"; g.textBaseline = "middle";
            if (xb - xa > 16) g.fillText(String(s.k + 1), Math.max(xa, 0) + 6, y + h / 2);
        }
        if (plan.trans === "fade") {
            g.fillStyle = "rgba(255,255,255,0.25)";
            for (let j = 1; j < plan.bounds.length - 1; j++) {
                const c = plan.bounds[j];
                g.fillRect(xAt(c - plan.td / 2), y, plan.td * view.pps, h);
            }
        }
    }

    function drawWave(g, peaks, sr, inSec, x0, x1, y, h, clipX0) {
        // sr: частота буфера; inSec: с какого места источника начинается кусок
        if (!peaks) return;
        const mid = y + h / 2;
        const xa = Math.max(0, Math.floor(x0)), xb = Math.min(laneW(), Math.ceil(x1));
        for (let x = xa; x < xb; x++) {
            const ta = inSec + (x - clipX0) / view.pps, tb = inSec + (x + 1 - clipX0) / view.pps;
            let ia = Math.floor((ta * sr) / PEAK_BLOCK), ib = Math.max(ia + 1, Math.floor((tb * sr) / PEAK_BLOCK));
            if (ia >= peaks.length) break;
            ib = Math.min(ib, peaks.length);
            let p = 0;
            for (let i = Math.max(0, ia); i < ib; i++) if (peaks[i] > p) p = peaks[i];
            const hh = Math.max(1, p * h * 0.92);
            g.fillRect(x, mid - hh / 2, 1, hh);
        }
    }

    function drawVAudioRow(g, r, plan, w) {
        if (!plan || plan.loading) return;
        const y = r.y + 4, h = r.h - 8;
        const on = audible(F.video.audio);
        for (const s of plan.segs) {
            const c = F.video.clips[s.k];
            const xa = xAt(s.a), xb = xAt(s.b);
            if (xb < 0 || xa > w) continue;
            g.fillStyle = "#23262e"; g.fillRect(xa, y, xb - xa, h);
            const e = loadVideoAudio(c.src);
            g.fillStyle = VCOLORS[s.k % VCOLORS.length];
            g.globalAlpha = on ? 0.8 : 0.25;
            if (e.state === "ok") {
                g.save(); g.beginPath(); g.rect(xa, y, xb - xa, h); g.clip();
                drawWave(g, e.peaks, e.buf.sampleRate, s.a - s.off, xa, xb, y, h, xa);
                g.restore();
            } else if (e.state === "err") {
                g.globalAlpha = 1; g.fillStyle = "#6b7080"; g.font = "10px Segoe UI, Arial"; g.textBaseline = "middle";
                g.fillText(T("без звука", "no sound"), xa + 6, y + h / 2);
            } else whenLoaded(e.p, requestDraw);
            g.globalAlpha = 1;
        }
    }

    function drawTrackRow(g, r, w) {
        const t = F.tracks[r.i];
        const on = audible(t);
        for (const c of t.clips) {
            const x0 = xAt(c.start), x1 = xAt(c.start + c.len);
            if (x1 < 0 || x0 > w) continue;
            const y = r.y + 3, h = r.h - 6;
            const src = clipSource(c);
            if (src.state === "loading") whenLoaded(src.p, () => { fixAutoLen(); requestDraw(); drawOverview(); });
            g.fillStyle = on ? "#2a2f3a" : "#22252c";
            g.fillRect(x0, y, x1 - x0, h);
            g.fillStyle = t.color;
            g.globalAlpha = on ? 0.95 : 0.3;
            g.fillRect(x0, y, x1 - x0, 14);
            g.save(); g.beginPath(); g.rect(x0, y + 14, x1 - x0, h - 14); g.clip();
            if (src.state === "ok") drawWave(g, src.peaks, src.buf.sampleRate, c.in, x0, x1, y + 14, h - 14, x0);
            else {
                hatch(g, x0, y + 14, x1 - x0, h - 14, "rgba(255,255,255,0.08)");
                g.globalAlpha = 1; g.fillStyle = "#9aa0ae"; g.font = "10px Segoe UI, Arial"; g.textBaseline = "middle";
                const msg = src.state === "noprev" ? T("звук появится после Queue", "sound appears after Queue")
                    : src.state === "nowire" ? T("вход не подключён", "input not wired")
                    : src.state === "err" ? T("ошибка: ", "error: ") + (src.err || "") : T("загрузка...", "loading...");
                g.fillText(msg, Math.max(x0, 0) + 6, y + 14 + (h - 14) / 2);
            }
            g.restore();
            g.globalAlpha = 1;
            // появление / затухание
            g.fillStyle = "rgba(0,0,0,0.35)";
            if (c.fin > 0) { g.beginPath(); g.moveTo(x0, y + 14); g.lineTo(x0 + c.fin * view.pps, y + 14); g.lineTo(x0, y + h); g.closePath(); g.fill(); }
            if (c.fout > 0) { g.beginPath(); g.moveTo(x1, y + 14); g.lineTo(x1 - c.fout * view.pps, y + 14); g.lineTo(x1, y + h); g.closePath(); g.fill(); }
            const isSel = sel && sel.kind === "a" && sel.id === c.id;
            g.strokeStyle = isSel ? "#ffffff" : "rgba(0,0,0,0.6)"; g.lineWidth = isSel ? 2 : 1;
            g.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1);
            // ручки появления/затухания
            g.fillStyle = "#ffffff";
            if (x1 - x0 > 24) {
                g.fillRect(x0 + c.fin * view.pps - 3, y + 1, 6, 6);
                g.fillRect(x1 - c.fout * view.pps - 3, y + 1, 6, 6);
            }
            // подпись
            g.fillStyle = "#111"; g.font = "bold 10px Segoe UI, Arial"; g.textBaseline = "top";
            g.save(); g.beginPath(); g.rect(x0 + 8, y, Math.max(0, x1 - x0 - 16), 14); g.clip();
            const gainTxt = Math.abs(c.gain - 1) > 0.005 ? `  ${Math.round(c.gain * 100)}%` : "";
            g.fillText(src.label + gainTxt, Math.max(x0, 0) + 8, y + 2);
            g.restore();
        }
    }

    function drawOverlay(tNow) {
        if (!winOpen()) return;
        const t = tNow === undefined ? curPos() : tNow;
        const w = laneW();
        const H = W.over.height / (window.devicePixelRatio || 1);
        const g = W.over.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, H);
        const x = Math.round(xAt(t));
        if (x >= -2 && x <= w + 2) {
            g.fillStyle = "#ffffff";
            g.fillRect(x - 1, 0, 2, H);
        }
        // курсор и на линейке
        const rg = W.ruler.getContext("2d");
        if (!W.rulerBase || W.rulerBase.width !== W.ruler.width || W.rulerBase.height !== W.ruler.height || W.rulerStamp !== drawStamp) {
            W.rulerBase = W.rulerBase || document.createElement("canvas");
            W.rulerBase.width = W.ruler.width; W.rulerBase.height = W.ruler.height;
            W.rulerBase.getContext("2d").drawImage(W.ruler, 0, 0);
            W.rulerStamp = drawStamp;
        }
        rg.setTransform(1, 0, 0, 1, 0, 0);
        rg.drawImage(W.rulerBase, 0, 0);
        rg.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (x >= -6 && x <= w + 6) {
            rg.fillStyle = "#ffffff";
            rg.beginPath(); rg.moveTo(x - 6, 0); rg.lineTo(x + 6, 0); rg.lineTo(x, 9); rg.closePath(); rg.fill();
            rg.fillRect(x - 1, 0, 2, RULER_H);
        }
    }
    let drawStamp = 0;          // каждое полное перерисование — новая «подложка» линейки

    // ======================================================================
    //  МЫШЬ на поле
    // ======================================================================

    let drag = null;
    let hover = null;

    function hitTest(x, y) {
        const r = rowAtY(y);
        if (!r) return { type: "none" };
        const plan = vplan();
        if ((r.type === "video" || r.type === "result") && plan && !plan.loading) {
            for (let j = 1; j < plan.bounds.length - 1; j++) {
                if (Math.abs(x - xAt(plan.bounds[j])) <= 7) return { type: "cut", j: j - 1, r };
            }
        }
        if (r.type === "video") {
            const c = F.video.clips[r.k];
            if (c && c.dur > 0 && x >= xAt(c.offset) && x <= xAt(c.offset + c.dur)) return { type: "vclip", id: c.id, k: r.k, r };
            return { type: "empty", r };
        }
        if (r.type === "track") {
            const t = F.tracks[r.i];
            for (let i = t.clips.length - 1; i >= 0; i--) {
                const c = t.clips[i];
                const x0 = xAt(c.start), x1 = xAt(c.start + c.len);
                if (x < x0 - 2 || x > x1 + 2) continue;
                const yy = y - r.y;
                if (yy <= 12 && x1 - x0 > 24) {
                    if (Math.abs(x - (x0 + c.fin * view.pps)) <= 6) return { type: "fin", id: c.id, t, c, r };
                    if (Math.abs(x - (x1 - c.fout * view.pps)) <= 6) return { type: "fout", id: c.id, t, c, r };
                }
                if (x - x0 <= 6) return { type: "edgeL", id: c.id, t, c, r };
                if (x1 - x <= 6) return { type: "edgeR", id: c.id, t, c, r };
                return { type: "aclip", id: c.id, t, c, r };
            }
            return { type: "empty", r };
        }
        return { type: "empty", r };
    }

    const CURSORS = { cut: "ew-resize", vclip: "grab", aclip: "grab", edgeL: "w-resize", edgeR: "e-resize", fin: "pointer", fout: "pointer" };
    function onLaneHover(e) {
        if (drag) return;
        const p = lanePt(e);
        const h = hitTest(p.x, p.y);
        W.lanes.style.cursor = CURSORS[h.type] || "default";
        const was = hover && hover.type === "cut" ? hover.j : -1;
        hover = h;
        if ((h.type === "cut" ? h.j : -1) !== was) requestDraw();
    }
    function lanePt(e) {
        const r = W.lanes.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function laneHitInfo(cx, cy) {
        if (!W.lanes) return null;
        const r = W.lanes.getBoundingClientRect();
        if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
        const x = cx - r.left, y = cy - r.top;
        const row = rowAtY(y);
        return { t: Math.max(0, tAt(x)), track: row && row.type === "track" ? F.tracks[row.i] : null };
    }

    // точки, к которым прилипают куски
    function snapPoints(exceptId) {
        const pts = [0, curPos()];
        const plan = vplan();
        if (plan && !plan.loading) { for (const b of plan.bounds) pts.push(b); }
        for (const t of F.tracks) for (const c of t.clips) if (c.id !== exceptId) { pts.push(c.start, c.start + c.len); }
        return pts;
    }
    function snapT(t, pts) {
        if (!F.snap) return t;
        const tol = 8 / view.pps;
        let best = t, bd = tol;
        for (const p of pts) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
        return best;
    }

    function onLaneDown(e) {
        if (e.button === 2) {
            const p = lanePt(e);
            const h = hitTest(p.x, p.y);
            if (h.type === "aclip" || h.type === "edgeL" || h.type === "edgeR") { select({ kind: "a", id: h.id }); deleteSel(); }
            return;
        }
        if (e.button !== 0) return;
        const p = lanePt(e);
        const h = hitTest(p.x, p.y);
        W.lanes.setPointerCapture(e.pointerId);
        const t0 = tAt(p.x);
        if (h.type === "empty" || h.type === "none") {
            select(null);
            seek(Math.max(0, t0));
            drag = { type: "seek" };
        } else if (h.type === "cut") {
            drag = { type: "cut", j: h.j, moved: false };
        } else if (h.type === "vclip") {
            const c = F.video.clips[h.k];
            select({ kind: "v", id: c.id });
            drag = { type: "vclip", id: c.id, x0: p.x, off0: c.offset, moved: false };
        } else {
            select({ kind: "a", id: h.id });
            const c = h.c;
            drag = { type: h.type, id: h.id, x0: p.x, y0: p.y, o: { start: c.start, in: c.in, len: c.len, fin: c.fin, fout: c.fout }, moved: false, pts: snapPoints(h.id) };
        }
        const mv = (ev) => onLaneDrag(ev);
        const up = () => {
            W.lanes.removeEventListener("pointermove", mv);
            W.lanes.removeEventListener("pointerup", up);
            W.lanes.removeEventListener("pointercancel", up);
            const d = drag;
            drag = null;
            if (d && d.moved) { changed(); buildSel(); }
        };
        W.lanes.addEventListener("pointermove", mv);
        W.lanes.addEventListener("pointerup", up);
        W.lanes.addEventListener("pointercancel", up);
    }

    function startMove(d) { if (!d.moved) { pushUndo(); d.moved = true; } }

    function onLaneDrag(e) {
        const d = drag;
        if (!d) return;
        const p = lanePt(e);
        if (d.type === "seek") { seek(Math.max(0, tAt(p.x))); return; }
        if (d.type === "cut") {
            const plan = vplan();
            if (!plan || plan.loading) return;
            startMove(d);
            const prev = plan.bounds[d.j], next = plan.bounds[d.j + 2];
            let t = plan.snap(tAt(p.x));
            if (F.snap) {
                // прилипнуть к курсору
                const cp = curPos();
                if (Math.abs(t - cp) < 8 / view.pps) t = plan.snap(cp);
            }
            t = clamp(t, prev + plan.minSeg, next - plan.minSeg);
            const cuts = plan.bounds.slice(1, -1);
            cuts[d.j] = t;
            F.video.cuts = cuts;
            setStatus(`${T("Разделитель", "Divider")} ${d.j + 1}: ${fmtT(t)} · ${T("кадр", "frame")} ${Math.round(t / plan.fr)}`);
            if (!P.on) seek(t);
            requestDraw();
            drawOverview();
            restartSoon();
            return;
        }
        if (d.type === "vclip") {
            const c = F.video.clips[vIndex(d.id)];
            if (!c) return;
            if (Math.abs(p.x - d.x0) < 3 && !d.moved) return;
            startMove(d);
            const fr = frameDur();
            c.offset = Math.round((d.off0 + (p.x - d.x0) / view.pps) / fr) * fr;
            setStatus(`${T("Сдвиг ролика", "Clip shift")} ${vIndex(d.id) + 1}: ${c.offset >= 0 ? "+" : ""}${c.offset.toFixed(3)} ${T("с", "s")} · ${Math.round(c.offset / fr)} ${T("кадров", "frames")}`);
            syncVideo(curPos(), P.on);
            requestDraw();
            return;
        }
        const f = findClip(d.id);
        if (!f) return;
        const c = f.c, o = d.o;
        if (Math.abs(p.x - d.x0) < 3 && Math.abs(p.y - d.y0) < 3 && !d.moved) return;
        startMove(d);
        const dt = (p.x - d.x0) / view.pps;
        const src = clipSource(c);
        const srcDur = src.state === "ok" ? src.buf.duration : Infinity;
        if (d.type === "aclip") {
            let s = Math.max(0, o.start + dt);
            const s1 = snapT(s, d.pts), s2 = snapT(s + o.len, d.pts) - o.len;
            s = Math.abs(s1 - s) <= Math.abs(s2 - s) ? s1 : s2;
            c.start = Math.max(0, s);
            // на другую дорожку
            const row = rowAtY(p.y);
            if (row && row.type === "track" && F.tracks[row.i] !== f.t) {
                f.t.clips.splice(f.t.clips.indexOf(c), 1);
                F.tracks[row.i].clips.push(c);
            }
        } else if (d.type === "edgeL") {
            let ns = snapT(o.start + dt, d.pts);
            ns = clamp(ns, Math.max(0, o.start - o.in), o.start + o.len - 0.05);
            const k = ns - o.start;
            c.start = ns; c.in = o.in + k; c.len = o.len - k;
            c.fin = Math.min(c.fin, c.len - c.fout);
        } else if (d.type === "edgeR") {
            let ne = snapT(o.start + o.len + dt, d.pts);
            ne = clamp(ne, o.start + 0.05, o.start + Math.min(MAX_SEC, srcDur - o.in));
            c.len = ne - o.start;
            c.fout = Math.min(c.fout, c.len - c.fin);
            delete c.autoLen;
        } else if (d.type === "fin") {
            c.fin = clamp(o.fin + dt, 0, c.len - c.fout);
            setStatus(`${T("Появление", "Fade in")}: ${c.fin.toFixed(2)} ${T("с", "s")}`);
        } else if (d.type === "fout") {
            c.fout = clamp(o.fout - dt, 0, c.len - c.fin);
            setStatus(`${T("Затухание", "Fade out")}: ${c.fout.toFixed(2)} ${T("с", "s")}`);
        }
        requestDraw();
    }

    function onLaneDbl(e) {
        const p = lanePt(e);
        const h = hitTest(p.x, p.y);
        if (h.type === "aclip") { seek(tAt(p.x)); select({ kind: "a", id: h.id }); splitSel(); }
        else if (h.type === "empty" && h.r && h.r.type === "track") { select(null); menuAudio(W.addA, F.tracks[h.r.i], Math.max(0, tAt(p.x))); }
    }

    // ======================================================================
    //  ДЕЙСТВИЯ
    // ======================================================================

    function select(s) {
        sel = s;
        buildSel();
        requestDraw();
    }

    function changed(structural) {
        saveSoon();
        syncVideoEls();
        ensureMedia();
        if (structural) { buildHeads(); buildSel(); buildExpert(); layoutStage(); }
        requestDraw();
        drawOverview();
        applyMix(false);
        restartSoon();
        if (!P.on) { syncVideo(pos, false); showTime(pos); }
        ensureFits();
    }
    function mixChanged() {
        applyMix(false);
        saveSoon();
        requestDraw();
        drawOverview();
    }

    function addTrack(user) {
        if (F.tracks.length >= MAX_TRACKS) { setStatus(T("Больше 8 дорожек нельзя", "No more than 8 tracks"), true); return null; }
        if (user) pushUndo();
        const used = new Set(F.tracks.map((t) => t.color));
        const color = COLORS.find((c) => !used.has(c)) || COLORS[F.tracks.length % COLORS.length];
        const t = { id: uid(), name: "🎵 " + (F.tracks.length + 1), color, vol: 0.8, pan: 0, mute: false, solo: false, clips: [] };
        F.tracks.push(t);
        if (user) changed(true);
        return t;
    }
    function removeTrack(id) {
        pushUndo();
        F.tracks = F.tracks.filter((t) => t.id !== id);
        if (sel && sel.kind === "a" && !findClip(sel.id)) sel = null;
        changed(true);
    }

    function clipCount() { let n = 0; for (const t of F.tracks) n += t.clips.length; return n; }

    function addAudio(src, track, at) {
        if (clipCount() >= MAX_CLIPS) { setStatus(T("Слишком много кусков (до 96)", "Too many pieces (up to 96)"), true); return; }
        pushUndo();
        let t = track && F.tracks.includes(track) ? track : null;
        if (!t && sel && sel.kind === "a") t = trackOf(sel.id) || null;
        if (!t) t = F.tracks[0] || addTrack(false);
        if (!t) return;
        const c = { id: uid(), src, start: Math.max(0, at === undefined || at === null ? curPos() : at), in: 0, len: 5, gain: 1, fin: 0, fout: 0, autoLen: true };
        t.clips.push(c);
        sel = { kind: "a", id: c.id };
        const s = clipSource(c);
        if (s.state === "ok") fixAutoLen();
        else if (s.p) s.p.then(() => { fixAutoLen(); requestDraw(); drawOverview(); });
        changed(true);
        setStatus(T("Кусок добавлен: ", "Piece added: ") + s.label);
    }
    // как только длина источника известна — кусок становится по длине звука
    function fixAutoLen() {
        let any = false;
        for (const t of F.tracks) for (const c of t.clips) {
            if (!c.autoLen) continue;
            const s = clipSource(c);
            if (s.state === "ok") { c.len = Math.max(0.05, Math.min(MAX_SEC, s.buf.duration - c.in)); delete c.autoLen; any = true; }
            else if (s.state === "err" || s.state === "noprev" || s.state === "nowire") { delete c.autoLen; any = true; }
        }
        if (any) { saveSoon(); buildSel(); drawOverview(); }
    }

    function addVideo(ref) {
        if (F.video.clips.length >= MAX_VIDEO) { setStatus(T("Роликов не больше 3", "No more than 3 clips"), true); return; }
        pushUndo();
        const prev = F.video.clips[F.video.clips.length - 1];
        const off = prev && prev.dur > 0 ? prev.offset + prev.dur : 0;
        const c = { id: uid(), src: ref, offset: off, dur: 0, fps: 0, w: 0, h: 0 };
        F.video.clips.push(c);
        if (prev) {
            const cuts = (vplan() && !vplan().loading) ? vplan().bounds.slice(1, -1) : F.video.cuts.slice();
            cuts.splice(F.video.clips.length - 2);
            cuts.push(off);
            F.video.cuts = cuts;
        }
        sel = { kind: "v", id: c.id };
        changed(true);
        if (view.pps) setTimeout(() => { fitZoomIfNeeded(); requestDraw(); }, 400);
        setStatus(T("Ролик добавлен: ", "Clip added: ") + ref.name);
    }
    function removeVideo(id) {
        const k = vIndex(id);
        if (k < 0) return;
        pushUndo();
        const plan = vplan();
        let cuts = plan && !plan.loading ? plan.bounds.slice(1, -1) : F.video.cuts.slice();
        if (cuts.length) cuts.splice(k === 0 ? 0 : k - 1, 1);
        F.video.clips.splice(k, 1);
        F.video.cuts = cuts;
        if (sel && sel.kind === "v" && sel.id === id) sel = null;
        changed(true);
    }

    function deleteSel() {
        if (!sel) return;
        if (sel.kind === "v") { removeVideo(sel.id); return; }
        const f = findClip(sel.id);
        if (!f) return;
        pushUndo();
        f.t.clips.splice(f.t.clips.indexOf(f.c), 1);
        sel = null;
        changed(true);
    }
    function splitSel() {
        if (!sel || sel.kind !== "a") { setStatus(T("Выделите кусок звука, потом S", "Select a sound piece, then S"), true); return; }
        const f = findClip(sel.id);
        if (!f) return;
        const c = f.c, t = curPos();
        if (t <= c.start + 0.02 || t >= c.start + c.len - 0.02) { setStatus(T("Поставьте курсор внутрь куска", "Put the cursor inside the piece"), true); return; }
        pushUndo();
        const k = t - c.start;
        const c2 = { ...c, id: uid(), start: t, in: c.in + k, len: c.len - k, fin: 0 };
        c.len = k;
        c.fout = 0;
        c.fin = Math.min(c.fin, c.len);
        c2.fout = Math.min(c2.fout, c2.len);
        f.t.clips.push(c2);
        sel = { kind: "a", id: c2.id };
        changed(true);
        setStatus(T("Разрезано", "Split"));
    }
    function duplicateSel() {
        if (!sel || sel.kind !== "a") return;
        const f = findClip(sel.id);
        if (!f || clipCount() >= MAX_CLIPS) return;
        pushUndo();
        const c2 = { ...f.c, id: uid(), start: f.c.start + f.c.len };
        f.t.clips.push(c2);
        sel = { kind: "a", id: c2.id };
        changed(true);
        setStatus(T("Копия поставлена сразу после", "Copy placed right after"));
    }
    function nudgeSel(dir, big) {
        if (!sel) return;
        const fr = frameDur();
        const step = (big ? 10 : 1) * fr * dir;
        pushUndo();
        if (sel.kind === "v") {
            const c = F.video.clips[vIndex(sel.id)];
            if (!c) return;
            c.offset = Math.round((c.offset + step) / fr) * fr;
            setStatus(`${T("Сдвиг ролика", "Clip shift")}: ${c.offset >= 0 ? "+" : ""}${c.offset.toFixed(3)} ${T("с", "s")} · ${Math.round(c.offset / fr)} ${T("кадров", "frames")}`);
        } else {
            const f = findClip(sel.id);
            if (!f) return;
            f.c.start = Math.max(0, f.c.start + step);
        }
        changed();
        buildSel();
    }

    function onKey(e) {
        const tag = e.target && e.target.tagName;
        e.stopPropagation();
        if ((tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") && e.target !== keyCatcher) return;
        const k = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        if (k === " ") { e.preventDefault(); P.on ? pause() : play(); }
        else if (k === "Escape") { closeMenu(); closeWindow(); }
        else if (k === "Home") { e.preventDefault(); seek(0); }
        else if (k === "Delete" || k === "Backspace") { e.preventDefault(); deleteSel(); }
        else if (ctrl && (k === "z" || k === "Z" || k === "я" || k === "Я")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (ctrl && (k === "y" || k === "Y" || k === "н" || k === "Н")) { e.preventDefault(); redo(); }
        else if (ctrl && (k === "d" || k === "D" || k === "в" || k === "В")) { e.preventDefault(); duplicateSel(); }
        else if (!ctrl && (k === "s" || k === "S" || k === "ы" || k === "Ы")) { e.preventDefault(); splitSel(); }
        else if (k === "ArrowLeft") { e.preventDefault(); if (sel) nudgeSel(-1, e.shiftKey); else seek(curPos() - frameDur() * (e.shiftKey ? 10 : 1)); }
        else if (k === "ArrowRight") { e.preventDefault(); if (sel) nudgeSel(1, e.shiftKey); else seek(curPos() + frameDur() * (e.shiftKey ? 10 : 1)); }
    }

    // ---------- меню добавления ----------

    async function fetchList(url, key) {
        try { const res = await api.fetchApi(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now()); const d = await res.json(); return d.ok ? d[key] || [] : []; }
        catch (e) { return []; }
    }
    const refLabel = (v) => `[${v.type === "output" ? "out" : "in"}] ${v.subfolder ? v.subfolder + "/" : ""}${v.name}`;

    async function menuVideo(anchor) {
        if (F.video.clips.length >= MAX_VIDEO) { setStatus(T("Роликов не больше 3. Уберите один (✕ в его строке)", "No more than 3 clips. Remove one (✕ in its row)"), true); return; }
        const vids_ = await fetchList("/neron/list_videos", "videos");
        showMenu(anchor, [
            { title: "", items: [{ label: "⬆ " + T("Загрузить с компьютера...", "Upload from computer..."), action: () => { W.fileIn.accept = "video/*,.mp4,.webm,.mov,.m4v"; W.fileIn.click(); } }] },
            { title: T("РОЛИКИ (input / output)", "CLIPS (input / output)"), always: true, empty: T("роликов нет", "no clips"),
                items: vids_.map((v) => ({ label: refLabel(v), action: () => addVideo(v) })) },
        ], true);
    }

    async function menuAudio(anchor, track, at) {
        const files = await fetchList("/neron/list_audio", "files");
        const ins = [];
        for (const s of audioSlots()) {
            const d = inputs.get(s.inp.name);
            if (!d) continue;
            ins.push({ label: `🔌 ${s.inp.name} · ${d.label}` + (d.spec ? "" : " (" + T("после Queue", "after Queue") + ")"),
                action: () => addAudio({ kind: "input", slot: s.inp.name }, track, at) });
        }
        showMenu(anchor, [
            { title: "", items: [{ label: "⬆ " + T("Загрузить с компьютера...", "Upload from computer..."), action: () => { pendingAt = { track, at }; W.fileIn.accept = "audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac"; W.fileIn.click(); } }] },
            { title: T("ВХОДЫ НОДЫ (провода audio_N)", "NODE INPUTS (audio_N wires)"), always: true,
                empty: T("подключите ноду к входу audio_1", "wire a node into audio_1"), items: ins },
            { title: T("ФАЙЛЫ (input / output)", "FILES (input / output)"), always: true, empty: T("файлов нет", "no files"),
                items: files.map((v) => ({ label: refLabel(v), action: () => addAudio({ kind: "file", name: v.name, subfolder: v.subfolder, type: v.type }, track, at) })) },
        ], true);
    }
    let pendingAt = null;

    async function addFiles(files, at) {
        if (!files.length) return;
        const where = at || pendingAt || {};
        pendingAt = null;
        for (const f of files) {
            setStatus(T("Загружаю ", "Uploading ") + f.name + "...");
            try {
                const r = await uploadFile(f);
                if (r.kind === "video") addVideo(r.ref);
                else addAudio({ kind: "file", ...r.ref }, where.track || null, where.t !== undefined ? where.t : where.at);
            } catch (e) {
                setStatus(T("Не удалось загрузить: ", "Upload failed: ") + (e.message || e), true);
            }
        }
    }

    // ---------- панель выделенного (внизу) ----------

    function numField(label, value, onSet, title) {
        const f = el("label", "nf-f");
        f.appendChild(document.createTextNode(label));
        const n = el("input", "nf-num");
        n.type = "text";
        n.value = String(Math.round(value * 1000) / 1000);
        n.title = title || "";
        const apply = () => { const v = parseFloat(n.value.replace(",", ".")); if (Number.isFinite(v)) onSet(v); else n.value = String(Math.round(value * 1000) / 1000); };
        n.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { apply(); n.blur(); } });
        n.addEventListener("blur", apply);
        f.appendChild(n);
        return f;
    }
    function rangeField(label, min, max, step, value, fmt, onInput, title) {
        const f = el("label", "nf-f");
        f.appendChild(document.createTextNode(label));
        const s = el("input");
        s.type = "range"; s.min = String(min); s.max = String(max); s.step = String(step); s.value = String(value);
        s.title = title || "";
        const v = el("span", "", fmt(value));
        let pushed = false;
        s.addEventListener("pointerdown", () => { if (!pushed) { pushUndo(); pushed = true; } });
        s.addEventListener("input", () => { if (!pushed) { pushUndo(); pushed = true; } const x = parseFloat(s.value); v.textContent = fmt(x); onInput(x); });
        s.addEventListener("change", () => { pushed = false; changed(); });
        s.addEventListener("keydown", (e) => e.stopPropagation());
        f.appendChild(s);
        f.appendChild(v);
        return f;
    }

    function buildSel() {
        if (!win) return;
        const p = W.selp;
        p.innerHTML = "";
        if (sel && sel.kind === "a") {
            const f = findClip(sel.id);
            if (!f) { sel = null; return buildSel(); }
            const c = f.c;
            const src = clipSource(c);
            const nm = el("b", "", "🔊 " + src.label);
            nm.style.color = f.t.color;
            p.appendChild(nm);
            p.appendChild(rangeField(T("Громкость", "Volume"), 0, 2, 0.01, c.gain, (x) => Math.round(x * 100) + "%", (x) => { c.gain = x; requestDraw(); restartSoon(); },
                T("Громкость куска", "Piece volume")));
            const fmax = Math.max(0.01, Math.min(10, c.len));
            p.appendChild(rangeField(T("Появление", "Fade in"), 0, fmax, 0.01, c.fin, (x) => x.toFixed(2) + " с/s", (x) => { c.fin = Math.min(x, c.len - c.fout); requestDraw(); restartSoon(); }));
            p.appendChild(rangeField(T("Затухание", "Fade out"), 0, fmax, 0.01, c.fout, (x) => x.toFixed(2) + " с/s", (x) => { c.fout = Math.min(x, c.len - c.fin); requestDraw(); restartSoon(); }));
            const bs = mk("✂ " + T("Разрезать", "Split"), null, T("Разрезать по курсору (S)", "Split at the cursor (S)"), "sm");
            bs.addEventListener("click", splitSel);
            const bd = mk("⧉ " + T("Копия", "Copy"), null, T("Такой же кусок сразу после (Ctrl+D)", "The same piece right after (Ctrl+D)"), "sm");
            bd.addEventListener("click", duplicateSel);
            const bx = mk("🗑 " + T("Удалить", "Delete"), "#7a3b3b", T("Удалить кусок (Delete)", "Delete the piece (Delete)"), "sm");
            bx.addEventListener("click", deleteSel);
            [bs, bd, bx].forEach((b) => p.appendChild(b));
            if (expert()) {
                const sec = T("с", "s");
                p.appendChild(numField(T("Начало", "Start") + ", " + sec, c.start, (v) => { pushUndo(); c.start = Math.max(0, v); changed(); buildSel(); }));
                p.appendChild(numField(T("С места", "From"), c.in, (v) => {
                    pushUndo(); const sd = src.state === "ok" ? src.buf.duration : Infinity;
                    c.in = clamp(v, 0, Math.max(0, sd - 0.05)); c.len = Math.min(c.len, sd - c.in); changed(); buildSel();
                }, T("С какой секунды источника начинается кусок", "Which second of the source the piece starts from")));
                p.appendChild(numField(T("Длина", "Length"), c.len, (v) => {
                    pushUndo(); const sd = src.state === "ok" ? src.buf.duration : Infinity;
                    c.len = clamp(v, 0.05, Math.min(MAX_SEC, sd - c.in)); c.fin = Math.min(c.fin, c.len); c.fout = Math.min(c.fout, c.len - c.fin); changed(); buildSel();
                }));
            }
        } else if (sel && sel.kind === "v") {
            const k = vIndex(sel.id);
            const c = F.video.clips[k];
            if (!c) { sel = null; return buildSel(); }
            const fr = frameDur();
            const nm = el("b", "", `🎬 ${k + 1}. ${c.src.name}`);
            nm.style.color = VCOLORS[k % VCOLORS.length];
            p.appendChild(nm);
            const info = el("span", "nf-hint", `${T("сдвиг", "shift")}: ${c.offset >= 0 ? "+" : ""}${c.offset.toFixed(3)} ${T("с", "s")} · ${Math.round(c.offset / fr)} ${T("кадров", "frames")}`);
            const b = (txt, n, title) => { const x = mk(txt, null, title, "sm"); x.addEventListener("click", () => { nudgeSel(Math.sign(n), Math.abs(n) > 1); }); return x; };
            p.appendChild(b("◀◀", -10, T("На 10 кадров раньше (Shift+←)", "10 frames earlier (Shift+←)")));
            p.appendChild(b("◀", -1, T("На 1 кадр раньше (←)", "1 frame earlier (←)")));
            p.appendChild(info);
            p.appendChild(b("▶", 1, T("На 1 кадр позже (→)", "1 frame later (→)")));
            p.appendChild(b("▶▶", 10, T("На 10 кадров позже (Shift+→)", "10 frames later (Shift+→)")));
            if (expert()) {
                p.appendChild(numField(T("Сдвиг, с", "Shift, s"), c.offset, (v) => { pushUndo(); c.offset = Math.round(v / fr) * fr; changed(); buildSel(); }));
            }
            const bx = mk("🗑 " + T("Убрать", "Remove"), "#7a3b3b", T("Убрать ролик", "Remove the clip"), "sm");
            bx.addEventListener("click", () => removeVideo(c.id));
            p.appendChild(bx);
        } else {
            p.appendChild(el("span", "nf-hint", T(
                "Тяните ролики и куски мышкой · жёлтые ромбики — разделители роликов · перетащите файл прямо на окно · Пробел — играть · S — разрезать · Delete — удалить · двойной клик по пустой дорожке — добавить звук",
                "Drag clips and pieces · yellow diamonds are clip dividers · drop a file onto the window · Space — play · S — split · Delete — delete · double click an empty track — add sound")));
        }
    }

    // ---------- панель эксперта ----------

    let projBar = null;
    function buildExpert() {
        if (!win) return;
        W.expBtn.classList.toggle("on", expert());
        W.exp.style.display = expert() ? "flex" : "none";
        if (!expert()) return;
        W.exp.innerHTML = "";
        if (!projBar) {
            projBar = createProjectBar({
                kind: "arrange",
                getData: () => ({ field: JSON.parse(JSON.stringify(F)) }),
                setData: (d) => { pause(); pushUndo(); F = normalizeField(d && d.field); sel = null; changed(true); fitZoom(); requestDraw(); },
                onNew: () => { pause(); pushUndo(); F = blankField(); sel = null; changed(true); fitZoom(); requestDraw(); },
                setStatus: (t, e) => setStatus(t, e),
            });
            projBar.root.style.minWidth = "420px";
            projBar.root.querySelectorAll("input,select").forEach((x) => x.addEventListener("keydown", (e) => e.stopPropagation()));
        }
        W.exp.appendChild(projBar.root);
        const m = el("label", "nf-f");
        m.appendChild(document.createTextNode("MASTER"));
        m.appendChild(slider(0, 1.2, 0.01, F.master, "#ffd166", T("Общая громкость (двойной клик — сброс)", "Master volume (double click — reset)"), (v) => { F.master = v; mixChanged(); }, 0.9));
        W.exp.appendChild(m);
        if (F.video.trans === "fade" && F.video.clips.length > 1) {
            W.exp.appendChild(rangeField(T("Наплыв", "Dissolve"), 0.04, 3, 0.02, F.video.trans_dur, (x) => x.toFixed(2) + " с/s",
                (x) => { F.video.trans_dur = x; requestDraw(); }, T("Длина наплыва между роликами", "Length of the dissolve between clips")));
        }
        const sn = el("label", "nf-f");
        const name = getWidget("save_name");
        sn.appendChild(document.createTextNode(T("Имя файла", "File name")));
        const ni = el("input", "nf-num");
        ni.style.width = "140px";
        ni.value = name ? String(name.value) : "neron_field";
        ni.addEventListener("keydown", (e) => e.stopPropagation());
        ni.addEventListener("change", () => { if (name) { name.value = ni.value.trim() || "neron_field"; } });
        sn.appendChild(ni);
        W.exp.appendChild(sn);
    }

    // ---------- сборка файла без Queue ----------

    async function doBuild() {
        if (!F.video.clips.length && !clipCount()) { setStatus(T("Собирать нечего: поле пустое", "Nothing to build: the field is empty"), true); return; }
        const noPrev = [];
        for (const t of F.tracks) for (const c of t.clips) if (c.src.kind === "input") { const d = inputs.get(c.src.slot); if (!d || !d.spec) noPrev.push(c.src.slot); }
        setStatus(T("Собираю... (видео может занять до минуты)", "Building... (video can take up to a minute)"));
        W.build.disabled = true;
        try {
            const res = await postJson("/neron/arrange_render", {
                json: JSON.stringify(F), inputs: node.neronArrangeInputs(), save_name: getWidget("save_name")?.value || "neron_field",
                with_video: F.video.clips.length > 0,
            });
            const d = await res.json();
            if (!d.ok) setStatus(T("Ошибка: ", "Error: ") + d.error, true);
            else {
                let msg = (d.video_path ? T("Видео: ", "Video: ") + d.video_path + " · " : "") + T("Звук: ", "Sound: ") + d.path + ` · ${d.seconds} ${T("с", "s")}`;
                if (noPrev.length) msg += " · ⚠ " + T("входы без звука до Queue: ", "inputs silent before Queue: ") + [...new Set(noPrev)].join(", ");
                setStatus(msg, false);
            }
        } catch (e) {
            setStatus(T("Ошибка сборки: ", "Build error: ") + e, true);
        } finally {
            W.build.disabled = false;
        }
    }

    // ======================================================================
    //  Превью кадров (только когда окно открыто)
    // ======================================================================

    const thumbs = new Map();      // mediaKey -> {imgs:[], step, ar, done}
    let thumbsStop = true, thumbsBusy = false;
    async function startThumbs() {
        thumbsStop = false;
        if (thumbsBusy) return;
        thumbsBusy = true;
        try {
            for (const c of F.video.clips) {
                if (thumbsStop || disposed) break;
                const key = mediaKey(c.src);
                if (!(c.dur > 0)) continue;
                let th = thumbs.get(key);
                if (th && th.done) continue;
                const n = clamp(Math.ceil(c.dur / 0.5), 4, 48);
                if (!th) { th = { imgs: new Array(n), step: c.dur / n, ar: c.w && c.h ? c.w / c.h : 16 / 9, done: false }; thumbs.set(key, th); }
                const v = document.createElement("video");
                v.muted = true; v.preload = "auto"; v.src = viewUrl(c.src);
                await new Promise((res) => { v.addEventListener("loadeddata", res, { once: true }); v.addEventListener("error", res, { once: true }); setTimeout(res, 8000); });
                const ch = 54, cw = Math.round(ch * th.ar);
                for (let i = 0; i < n; i++) {
                    if (thumbsStop || disposed) break;
                    if (th.imgs[i]) continue;
                    await new Promise((res) => { v.addEventListener("seeked", res, { once: true }); setTimeout(res, 3000); try { v.currentTime = Math.min(c.dur - 0.05, (i + 0.5) * th.step); } catch (e) { res(); } });
                    const cv = document.createElement("canvas");
                    cv.width = cw; cv.height = ch;
                    try { cv.getContext("2d").drawImage(v, 0, 0, cw, ch); th.imgs[i] = cv; } catch (e) { /* ок */ }
                    if (i % 6 === 5) requestDraw();
                }
                if (!thumbsStop) th.done = true;
                try { v.removeAttribute("src"); v.load(); } catch (e) { /* ок */ }
                requestDraw();
            }
        } finally {
            thumbsBusy = false;
        }
    }

    // ======================================================================
    //  Загрузка сведений и звука по мере надобности
    // ======================================================================

    function ensureMedia() {
        for (const c of F.video.clips) {
            const e = loadInfo(c.src);
            const apply = () => {
                if (e.state !== "ok") { if (e.state === "err") setStatus(T("Видео не прочитано: ", "Video not read: ") + c.src.name + " — " + e.err, true); return; }
                const i = e.info;
                if (c.dur !== i.duration || c.fps !== i.fps || c.w !== i.width || c.h !== i.height) {
                    c.dur = i.duration; c.fps = i.fps; c.w = i.width; c.h = i.height;
                    saveSoon();
                    buildHeads();
                    requestDraw();
                    drawOverview();
                    if (winOpen()) startThumbs();
                    if (!P.on) syncVideo(pos, false);
                }
            };
            if (e.state === "loading") e.p.then(apply); else apply();
            loadVideoAudio(c.src);
        }
        for (const t of F.tracks) for (const c of t.clips) clipSource(c);
    }

    // ======================================================================
    //  Карточка: размер (как в Пульте — размер задаёт пользователь)
    // ======================================================================

    const manual = () => node.properties.arr_manual === true;
    const curH = () => (manual() ? Math.max(CARD_MIN, Number(node.properties.arr_card_h) || CARD_DEF) : CARD_DEF);
    const widget = node.addDOMWidget("neron_field", "neron_field", card, {
        serialize: false, hideOnZoom: false,
        getMinHeight: () => CARD_MIN, getHeight: () => curH(), getMaxHeight: () => curH(),
    });
    widget.computeSize = (width) => {
        if (manual() && app.canvas?.resizing_node === node) return [width, CARD_MIN];
        return [width, curH()];
    };
    let fitting = false;
    function layoutCard() {
        card.style.height = curH() + "px";
        drawOverview();
    }
    function ensureFits() {
        const top = widget.last_y;
        if (top == null || fitting) return;
        const need = Math.round(top + curH() + 10);
        if (node.size[1] < need || (!manual() && Math.abs(node.size[1] - need) > 2)) {
            fitting = true;
            node.setSize([node.size[0], need]);
            fitting = false;
            app.graph?.setDirtyCanvas(true, true);
        }
    }
    const onResize0 = node.onResize;
    node.onResize = function () {
        const r = onResize0 ? onResize0.apply(this, arguments) : undefined;
        if (!fitting && app.canvas?.resizing_node === node) {
            node.properties.arr_manual = true;
            const top = widget.last_y;
            if (top != null) node.properties.arr_card_h = Math.max(CARD_MIN, Math.round(node.size[1] - top - 10));
        }
        requestAnimationFrame(layoutCard);
        return r;
    };

    // ---------- кнопки карточки ----------
    cPlay.addEventListener("click", () => (P.on ? pause() : play()));
    cStop.addEventListener("click", () => pause());
    cOpen.addEventListener("click", openWindow);
    cHelp.addEventListener("click", showHelp);

    // ======================================================================
    //  Слежение за проводами (раз в полсекунды, ничего не рисует без нужды)
    // ======================================================================

    function tick() {
        if (document.hidden || disposed) return;
        const cur = readInputs();
        const sig = [...cur.entries()].map(([k, d]) => `${k}:${d.key}:${d.label}`).join("|");
        if (sig !== structSig) {
            structSig = sig;
            inputs = cur;
            ensureMedia();
            fixAutoLen();
            requestDraw();
            drawOverview();
            if (P.on) restartSoon();
        }
        if (card.clientWidth && ov.width !== Math.round(ov.clientWidth * (window.devicePixelRatio || 1))) drawOverview();
    }

    // ---------- запуск ----------

    loadFromWidget();
    syncVideoEls();
    ensureMedia();
    layoutCard();
    const sz = node.computeSize ? node.computeSize() : [560, 380];
    node.setSize([Math.max(sz[0], 560), Math.max(sz[1], 200)]);
    setTimeout(() => { layoutCard(); ensureFits(); }, 50);

    node.neronSyncInputs = () => { syncInputs(); tick(); };
    node.neronReload = () => {
        pause();
        loadFromWidget();
        undoS.length = 0; redoS.length = 0;
        sel = null;
        structSig = "";
        syncInputs();
        tick();
        syncVideoEls();
        ensureMedia();
        if (win) { buildHeads(); buildSel(); buildExpert(); layoutStage(); fitZoom(); requestDraw(); }
        layoutCard();
        ensureFits();
        syncVideo(pos, false);
        showTime(pos);
    };
    node.neronDispose = () => {
        disposed = true;
        pause();
        if (pollTimer) clearInterval(pollTimer);
        for (const v of vids.values()) { try { v.removeAttribute("src"); v.load(); } catch (e) { /* ок */ } }
        if (win) { try { W.ro.disconnect(); } catch (e) { /* ок */ } win.remove(); win = null; }
        closeMenu();
        for (const ch of P.chains.values()) { try { ch.vol.disconnect(); } catch (e) { /* ок */ } }
        if (P.lim) { try { P.lim.disconnect(); } catch (e) { /* ок */ } }
    };

    syncInputs();
    const pollTimer = setInterval(tick, 500);
    setTimeout(tick, 120);
    setStatus(T("Готово. Откройте поле: 🎬 ОТКРЫТЬ ПОЛЕ", "Ready. Open the field: 🎬 OPEN FIELD"));
}

app.registerExtension({
    name: "NeronAudio.FieldUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupFieldUI(this);
            return r;
        };
        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type) {
            const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined;
            if (type === 1 && this.neronSyncInputs) {
                const self = this;
                setTimeout(() => { if (self.neronSyncInputs) self.neronSyncInputs(); }, 0);
            }
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
