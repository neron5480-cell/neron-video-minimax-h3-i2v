// 🎥 Neron H3 Generator — Бланк / Form: лицо в стиле бланка для мотора Lite.
// Родные поля ноды (те же имена, что у Lite) спрятаны — их правят окна ниже. Входы раскрываются по одному.
// Синхронизация: подключил автопромтер к prompt — нода сама тянет его frames_count → length_in.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3GeneratorBlank";
const AUTOPROMPTERS = ["NeronH3AutoPrompterBlank", "NeronAutoPrompter"];
const W_MODE = "MODE / РЕЖИМ", W_SEC = "SECONDS / СЕКУНДЫ", W_FREE = "FREE AFTER RUN / ОЧИСТКА ПОСЛЕ";
const HD_MODES = ["Баланс HD / Balance HD", "Чисто HD / Clean HD", "⚡ Быстро HD / Fast HD"];

// входы, которыми управляет нода: порядок и тип
const INPUTS = [["prompt", "STRING"], ["length_in", "INT"], ["ref_image_0", "IMAGE"], ["ref_image_1", "IMAGE"],
    ["ref_image_2", "IMAGE"], ["ref_image_3", "IMAGE"], ["ref_video", "IMAGE"], ["ref_video_audio", "AUDIO"],
    ["ref_audio", "AUDIO"], ["width", "INT"], ["height", "INT"]];
const EXPERT_INPUTS = ["ref_video", "ref_video_audio", "ref_audio", "width", "height"];

const UI = {
    RU: {
        mode: "🎬 Режим", modeHint: "Турбо — быстро; Обычный — 20 шагов; HD — полный размер модели",
        size: "📐 Размер", sizeHint: "паспорт модели: короткая сторона 768",
        time: "⏱ Длина ролика", timeHint: "свои секунды — если автопромтер не подключён", sec: "с",
        synced: "⏱ Длина — из автопромтера", syncedHint: "провод length_in подключён — секунды берутся оттуда",
        frames: "кадров",
        pics: "🖼 Картинки: подключи image к ref_image_0 — появится следующий слот (до 4)",
        progress: "⏳ Ход работы", idle: "Ждёт запуска.",
        st: { model: "Модель", text: "Текст", sample: "Генерация", upscale: "Увеличение", decode: "Раскодировка",
              audio: "Звук" },
        step: "шаг", passed: "прошло", left: "осталось ~", done: "✅ Готово за", error: "❌ Ошибка — подробности в консоли",
        expert: "⚙ эксперт", help: "📖 справка",
        manual: "свой размер", w: "ширина", h: "высота", div: "кратно",
        lora: "LoRA", strength: "сила", models: "Модели", unet: "модель H3", clip: "текстовый энкодер",
        vae_v: "VAE видео", vae_a: "VAE звука", turbo_lora: "турбо-LoRA",
        steps_n: "шаги «Обычный»", steps_t: "шаги «Турбо»", seed: "сид", after: "после запуска",
        tile: "плитка раскодировки (0 — авто)", free: "очищать память после запуска",
        moreIn: "Пока открыт эксперт, сверху видны входы видео-образца, звука и размера.",
    },
    EN: {
        mode: "🎬 Mode", modeHint: "Turbo — fast; Normal — 20 steps; HD — the model's full size",
        size: "📐 Size", sizeHint: "model passport: short side 768",
        time: "⏱ Clip length", timeHint: "own seconds — when no autoprompter is connected", sec: "s",
        synced: "⏱ Length — from the autoprompter", syncedHint: "length_in is connected — seconds come from there",
        frames: "frames",
        pics: "🖼 Pictures: connect an image to ref_image_0 — the next slot appears (up to 4)",
        progress: "⏳ Progress", idle: "Waiting for a run.",
        st: { model: "Model", text: "Text", sample: "Generating", upscale: "Upscale", decode: "Decoding",
              audio: "Sound" },
        step: "step", passed: "elapsed", left: "left ~", done: "✅ Done in", error: "❌ Error — see the console",
        expert: "⚙ expert", help: "📖 help",
        manual: "custom size", w: "width", h: "height", div: "multiple of",
        lora: "LoRA", strength: "strength", models: "Models", unet: "H3 model", clip: "text encoder",
        vae_v: "video VAE", vae_a: "audio VAE", turbo_lora: "turbo LoRA",
        steps_n: "Normal steps", steps_t: "Turbo steps", seed: "seed", after: "after run",
        tile: "decode tile (0 — auto)", free: "free memory after the run",
        moreIn: "While expert is open, reference video, audio and size inputs show at the top.",
    },
};

const HELP = `🎥 NERON H3 GENERATOR — БЛАНК

🇷🇺 ЧТО ЭТО
Генератор видео со звуком на MiniMax H3. Мотор — проверенный Neron MiniMax H3 Generator (Lite), без изменений. Новое — вид: только нужное, остальное за ⚙, и полоса хода работы.

КАК
1. Провод prompt — от 🎬 Neron H3 AutoPrompter — Бланк. Как только подключишь, нода сама протянет и длину (frames_count → length_in): длина задаётся в одном месте — на бланке.
2. Режим: Турбо (8 шагов, быстро), Обычный (20 шагов), Баланс HD / Чисто HD (полный размер модели, дольше).
3. Размер — пресеты по паспорту модели (короткая сторона 768). Нестандартный размер даёт глюки.
4. Картинки — подключи к ref_image_0, появится следующий слот (до 4). Нет картинок — текст → видео.
5. ▶ Run. Полоса покажет этапы: модель → текст → генерация (шаги, сколько осталось) → раскодировка → звук → «Готово за …».

⚙ ЭКСПЕРТ
Свой размер, 3 LoRA, модели, шаги, сид, плитка раскодировки, очистка памяти, входы видео-образца / звука / размера.

────────────────────────

🎥 NERON H3 GENERATOR — FORM

🇬🇧 WHAT IT IS
A video-with-sound generator on MiniMax H3. The engine is the proven Neron MiniMax H3 Generator (Lite), unchanged. New: the look — only what you need, the rest under ⚙, and a progress bar.

HOW
1. The prompt wire — from 🎬 Neron H3 AutoPrompter — Form. Once connected, the node also wires the length (frames_count → length_in): the length is set in one place — on the form.
2. Mode: Turbo (8 steps, fast), Normal (20 steps), Balance HD / Clean HD (the model's full size, slower).
3. Size — presets on the model passport (short side 768). Odd sizes cause glitches.
4. Pictures — connect to ref_image_0, the next slot appears (up to 4). No pictures — text to video.
5. ▶ Run. The bar shows the stages: model → text → generating (steps, time left) → decoding → sound → "Done in …".

⚙ EXPERT
Custom size, 3 LoRAs, models, steps, seed, decode tile, memory cleanup, reference video / audio / size inputs.`;

// ---------------- оформление ----------------
const CSS = `
.ngb{box-sizing:border-box;width:100%;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#e6e6e6;padding:2px 2px 6px}
.ngb *{box-sizing:border-box}
.ngb-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.ngb-pill{background:#262626;border:1px solid #555;border-radius:14px;padding:3px 11px;font-size:12px;color:#bbb;cursor:pointer;user-select:none}
.ngb-pill:hover{border-color:#888;color:#fff}
.ngb-pill.on{background:#3d5a80;border-color:#6d9ad0;color:#fff}
.ngb-sp{flex:1}
.ngb-sec{margin-bottom:9px}
.ngb-lab{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:4px}
.ngb-lab b{color:#f0f0f0;font-weight:600;white-space:nowrap}
.ngb-lab i{color:#8d9aa8;font-style:normal;font-size:11.5px;text-align:right}
.ngb-row{display:flex;gap:6px;flex-wrap:wrap}
.ngb select,.ngb input[type=number]{background:#222;color:#e8e8e8;border:1px solid #4b4b4b;border-radius:6px;padding:4px 7px;
  font:12.5px "Segoe UI",Arial,sans-serif;width:100%}
.ngb-time{display:flex;align-items:center;gap:10px}
.ngb-time input[type=range]{flex:1;accent-color:#6d9ad0;cursor:pointer}
.ngb-time .v{min-width:52px;text-align:right;font-weight:600;color:#fff;font-size:14px}
.ngb-sync{background:#1f2a1f;border:1px solid #4d7a4d;border-radius:6px;padding:6px 9px;color:#bfe3bf;font-size:12.5px}
.ngb-note{font-size:11.5px;color:#8d9aa8;margin-top:3px}
.ngb-exp{background:#2b2b2b;border:1px solid #444;border-radius:6px;padding:7px 9px;margin-bottom:9px;font-size:12px;color:#ccc}
.ngb-exp h4{margin:6px 0 4px;font-size:12px;color:#9cc3f0;font-weight:600}
.ngb-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center}
.ngb-grid span{color:#aab}
.ngb-lora{display:grid;grid-template-columns:auto 1fr 70px;gap:4px 6px;align-items:center;margin-bottom:3px}
.ngb-exp label{display:flex;gap:7px;align-items:center;cursor:pointer}
.ngb-prog{background:#1d2530;border:1px solid #3d5a80;border-radius:8px;padding:8px 10px}
.ngb-stages{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:7px}
.ngb-stage{font-size:11px;padding:2px 8px;border-radius:10px;background:#263040;color:#7d8b99;border:1px solid #33435a;transition:all .3s}
.ngb-stage.now{background:#3d5a80;color:#fff;border-color:#6d9ad0;box-shadow:0 0 8px #6d9ad088}
.ngb-stage.ok{background:#25402a;color:#bfe3bf;border-color:#4d7a4d}
.ngb-track{position:relative;height:12px;border-radius:6px;background:#141b24;overflow:hidden;border:1px solid #2b3a4f}
.ngb-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:6px;
  background:linear-gradient(90deg,#2f7d4f,#4fbf7a);transition:width .6s cubic-bezier(.2,.8,.2,1)}
.ngb-fill.run::after{content:"";position:absolute;inset:0;border-radius:6px;
  background:linear-gradient(110deg,transparent 0%,rgba(255,255,255,.0) 35%,rgba(255,255,255,.35) 50%,rgba(255,255,255,0) 65%,transparent 100%);
  background-size:200% 100%;animation:ngbShine 1.6s linear infinite}
.ngb-fill.err{background:linear-gradient(90deg,#7d2f2f,#bf4f4f)}
@keyframes ngbShine{from{background-position:200% 0}to{background-position:-200% 0}}
.ngb-ptext{display:flex;justify-content:space-between;font-size:12px;color:#cfe0f5;margin-top:5px}
.ngb-ptext .r{color:#8d9aa8}
.ngb-report{white-space:pre-wrap;font-size:11.5px;color:#9fb2c8;margin-top:6px;user-select:text}
.ngb-help{position:fixed;inset:0;background:#000a;z-index:10000;display:flex;align-items:center;justify-content:center}
.ngb-help>div{background:#2a2a2a;color:#e6e6e6;border:1px solid #555;border-radius:10px;max-width:760px;width:92vw;max-height:84vh;
  overflow:auto;padding:18px 22px;white-space:pre-wrap;font:13px/1.5 "Segoe UI",Arial,sans-serif;position:relative}
.ngb-help button{position:sticky;top:0;float:right;background:#3d5a80;color:#fff;border:0;border-radius:6px;padding:4px 12px;cursor:pointer}
`;
function addCss() {
    if (document.getElementById("neron-h3-generator-blank-css")) return;
    const s = document.createElement("style");
    s.id = "neron-h3-generator-blank-css";
    s.textContent = CSS;
    document.head.appendChild(s);
}
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}
function defaultLang() {
    try {
        const loc = app.ui?.settings?.getSettingValue?.("Comfy.Locale") || navigator.language || "";
        return String(loc).toLowerCase().startsWith("ru") ? "RU" : "EN";
    } catch (_) { return "RU"; }
}
function showHelp() {
    const wrap = el("div", "ngb-help");
    const box = el("div");
    const close = el("button", null, "✕");
    close.onclick = () => wrap.remove();
    box.append(close, document.createTextNode(HELP));
    wrap.appendChild(box);
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    document.body.appendChild(wrap);
}
// «Turbo / Турбо», «Баланс HD / Balance HD» → часть на нужном языке
function pick(label, lang) {
    const parts = String(label).split(" / ");
    if (parts.length < 2) return String(label);
    const cyr = (s) => /[а-яё]/i.test(s);
    const ru = parts.find(cyr), en = parts.find((p) => !cyr(p));
    return (lang === "RU" ? ru : en) || parts[0];
}
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
function gridFrames(sec) {
    let n = Math.max(5, Math.round(Number(sec) * 24));
    while (n % 17 !== 5) n++;
    return n;
}

// ---------------- нода: поля, входы ----------------
const W = (node, name) => node.widgets?.find((x) => x.name === name);
function hideWidget(w) {
    if (!w) return;
    w.hidden = true;
    w.type = "hidden";
    w.computeSize = () => [0, -4];
}
function getLink(id) {
    const g = app.graph;
    if (id == null || !g) return null;
    return g.getLink?.(id) ?? g.links?.get?.(id) ?? g.links?.[id] ?? null;
}
const inIdx = (node, name) => (node.inputs || []).findIndex((i) => i.name === name);
const linked = (node, name) => { const i = inIdx(node, name); return i >= 0 && node.inputs[i].link != null; };

// входы: картинки — по одной, редкие — в эксперте. Убираем только свободные, добавляем в конец.
function syncInputs(node) {
    if (node.__ngbSyncing) return;
    node.__ngbSyncing = true;
    try {
        const expert = !!node.properties?.ngb_expert;
        let last = -1;
        for (let k = 0; k < 4; k++) if (linked(node, `ref_image_${k}`)) last = k;
        const want = new Set(["prompt", "length_in"]);
        for (let k = 0; k <= Math.min(3, last + 1); k++) want.add(`ref_image_${k}`);
        for (const n of EXPERT_INPUTS) if (expert) want.add(n);
        for (const [n] of INPUTS) if (linked(node, n)) want.add(n);
        for (let i = (node.inputs || []).length - 1; i >= 0; i--) {
            const inp = node.inputs[i];
            if (INPUTS.some(([n]) => n === inp.name) && !want.has(inp.name) && inp.link == null) node.removeInput(i);
        }
        // новые слоты — только в конец: порядок существующих не трогаем, номера у проводов не сдвигаются
        for (const [n, t] of INPUTS) if (want.has(n) && inIdx(node, n) < 0) node.addInput(n, t);
        node.setDirtyCanvas?.(true, true);
    } finally {
        node.__ngbSyncing = false;
    }
}

// синхронизация длины: prompt от автопромтера → его frames_count в наш length_in
function autoLength(node) {
    const pi = inIdx(node, "prompt");
    if (pi < 0 || node.inputs[pi].link == null || linked(node, "length_in")) return;
    const l = getLink(node.inputs[pi].link);
    const src = l && app.graph.getNodeById(l.origin_id);
    if (!src || !AUTOPROMPTERS.includes(src.type || src.comfyClass)) return;
    const out = (src.outputs || []).findIndex((o) => o.name === "frames_count");
    const li = inIdx(node, "length_in");
    if (out >= 0 && li >= 0) src.connect(out, node, li);
}
function sourceSeconds(node) {
    const li = inIdx(node, "length_in");
    const l = li >= 0 ? getLink(node.inputs[li].link) : null;
    const src = l && app.graph.getNodeById(l.origin_id);
    const fw = src && src.widgets?.find((w) => w.name === "form");
    try { const s = JSON.parse(fw?.value || "{}").seconds; return s != null ? Number(s) : null; } catch (_) { return null; }
}

function build(node) {
    addCss();
    node.properties = node.properties || {};
    const P = node.properties;
    if (!P.ngb_lang) P.ngb_lang = defaultLang();
    const lang = () => (P.ngb_lang === "EN" ? "EN" : "RU");
    const root = el("div", "ngb"), inner = el("div");
    root.appendChild(inner);
    for (const ev of ["pointerdown", "mousedown", "wheel", "keydown", "contextmenu"]) {
        root.addEventListener(ev, (e) => { if (e.target.closest("select,input,.ngb-report")) e.stopPropagation(); },
            { passive: true });
    }
    const set = (name, v) => { const w = W(node, name); if (!w) return; w.value = v; w.callback?.(v); };
    const get = (name) => W(node, name)?.value;

    // верх
    const bar = el("div", "ngb-bar");
    const ru = el("span", "ngb-pill", "RU"), en = el("span", "ngb-pill", "EN");
    const exp = el("span", "ngb-pill"), hlp = el("span", "ngb-pill");
    bar.append(ru, en, el("span", "ngb-sp"), exp, hlp);
    inner.appendChild(bar);

    // режим
    const modeSec = el("div", "ngb-sec"), modeLab = el("div", "ngb-lab"), mb = el("b"), mi = el("i");
    modeLab.append(mb, mi);
    const modeRow = el("div", "ngb-row");
    modeSec.append(modeLab, modeRow);
    inner.appendChild(modeSec);
    const modeVals = (W(node, W_MODE)?.options?.values || []).filter((v) => v !== HD_MODES[2]);
    const modePills = modeVals.map((v) => {
        const p = el("span", "ngb-pill");
        p.onclick = () => { set(W_MODE, v); paint(); };
        modeRow.appendChild(p);
        return [v, p];
    });

    // размер
    const sizeSec = el("div", "ngb-sec"), sizeLab = el("div", "ngb-lab"), sb = el("b"), si = el("i");
    sizeLab.append(sb, si);
    const sizeSel = document.createElement("select");
    for (const v of W(node, "resolution_preset")?.options?.values || []) {
        const o = document.createElement("option"); o.value = v; o.textContent = v; sizeSel.appendChild(o);
    }
    sizeSel.onchange = () => { set("resolution_preset", sizeSel.value); set("resolution_mode", "Пресеты / Presets"); paint(); };
    sizeSec.append(sizeLab, sizeSel);
    inner.appendChild(sizeSec);

    // длина
    const timeSec = el("div", "ngb-sec"), timeLab = el("div", "ngb-lab"), tb = el("b"), ti = el("i");
    timeLab.append(tb, ti);
    const timeRow = el("div", "ngb-time");
    const range = document.createElement("input");
    range.type = "range"; range.min = 1; range.max = 15; range.step = 0.5;
    const tv = el("span", "v");
    timeRow.append(range, tv);
    const syncBox = el("div", "ngb-sync");
    timeSec.append(timeLab, timeRow, syncBox);
    inner.appendChild(timeSec);
    range.addEventListener("input", () => { set(W_SEC, Number(range.value)); paintTime(); });
    for (const ev of ["pointerdown", "mousedown", "wheel"]) range.addEventListener(ev, (e) => e.stopPropagation());
    const picNote = el("div", "ngb-note");
    inner.appendChild(picNote);

    // эксперт
    const expBox = el("div", "ngb-exp");
    inner.appendChild(expBox);
    const ctl = [];             // [имя поля, элемент, подпись-ключ]
    function field(parent, key, name, kind, bare) {
        const w = W(node, name);
        if (!w) return;
        const t = el("span");
        const put = (input) => (bare ? parent.append(input) : parent.append(t, input));
        let input;
        if (kind === "check") {
            const lab = el("label");
            input = document.createElement("input"); input.type = "checkbox";
            input.onchange = () => set(name, input.checked);
            if (bare) parent.append(input);
            else { lab.append(input, t); parent.appendChild(lab); }
        } else if (Array.isArray(w.options?.values)) {
            input = document.createElement("select");
            const vals = [...w.options.values];
            if (w.value != null && !vals.includes(w.value)) vals.unshift(w.value);   // файл из схемы, которого нет в списке
            for (const v of vals) {
                const o = document.createElement("option"); o.value = v; o.textContent = String(v).split(/[\\/]/).pop();
                input.appendChild(o);
            }
            input.onchange = () => set(name, input.value);
            put(input);
        } else {
            input = document.createElement("input"); input.type = "number";
            input.step = w.options?.step2 ?? (Number.isInteger(w.value) ? 1 : 0.05);
            input.onchange = () => { const v = Number(input.value); if (Number.isFinite(v)) set(name, v); input.value = get(name); };
            put(input);
        }
        ctl.push([name, input, t, key]);
    }
    const hSize = el("h4"); expBox.appendChild(hSize);
    const gSize = el("div", "ngb-grid"); expBox.appendChild(gSize);
    const manLab = el("label"), manCb = document.createElement("input"), manT = el("span");
    manCb.type = "checkbox";
    manCb.onchange = () => { set("resolution_mode", manCb.checked ? "Ручной / Manual" : "Пресеты / Presets"); paint(); };
    manLab.append(manCb, manT);
    gSize.append(manLab, el("span"));
    field(gSize, "w", "manual_width"); field(gSize, "h", "manual_height"); field(gSize, "div", "divisible_by");
    const hLora = el("h4"); expBox.appendChild(hLora);
    for (const k of [1, 2, 3]) {
        const row = el("div", "ngb-lora");
        field(row, null, `slot_${k}_enabled`, "check", true);
        field(row, null, `slot_${k}_lora`, null, true);
        field(row, null, `slot_${k}_strength`, null, true);
        expBox.appendChild(row);
    }
    const hMod = el("h4"); expBox.appendChild(hMod);
    const gMod = el("div", "ngb-grid"); expBox.appendChild(gMod);
    for (const [key, name] of [["unet", "unet_model"], ["clip", "clip_model"], ["vae_v", "vae_video_model"],
        ["vae_a", "vae_audio_model"], ["turbo_lora", "turbo_lora_model"], ["steps_n", "normal_steps"],
        ["steps_t", "turbo_steps"], ["seed", "seed"], ["after", "control_after_generate"], ["tile", "decode_tile_size"]]) {
        field(gMod, key, name);
    }
    field(expBox, "free", W_FREE, "check");
    const moreIn = el("div", "ngb-note"); expBox.appendChild(moreIn);

    // ход работы
    const progSec = el("div", "ngb-sec"), progLab = el("div", "ngb-lab"), pb = el("b"), pi = el("i");
    progLab.append(pb, pi);
    const prog = el("div", "ngb-prog");
    const stages = el("div", "ngb-stages");
    const track = el("div", "ngb-track"), fill = el("div", "ngb-fill");
    track.appendChild(fill);
    const ptext = el("div", "ngb-ptext"), pl = el("span"), pr = el("span", "r");
    ptext.append(pl, pr);
    const report = el("div", "ngb-report");
    prog.append(stages, track, ptext, report);
    progSec.append(progLab, prog);
    inner.appendChild(progSec);

    // ---------------- рисование ----------------
    function paintTime() {
        const T = UI[lang()];
        const isSynced = linked(node, "length_in");
        timeRow.style.display = isSynced ? "none" : "";
        syncBox.style.display = isSynced ? "" : "none";
        tb.textContent = isSynced ? T.synced : T.time;
        ti.textContent = isSynced ? T.syncedHint : T.timeHint;
        const s = Number(get(W_SEC) ?? 5);
        range.value = s;
        tv.textContent = `${s} ${T.sec}`;
        const ss = sourceSeconds(node);
        syncBox.textContent = ss != null ? `${ss} ${T.sec} · ${gridFrames(ss)} ${T.frames}` : "length_in ✓";
    }
    function paint() {
        const T = UI[lang()];
        ru.classList.toggle("on", lang() === "RU");
        en.classList.toggle("on", lang() === "EN");
        exp.textContent = T.expert;
        exp.classList.toggle("on", !!P.ngb_expert);
        hlp.textContent = T.help;
        mb.textContent = T.mode; mi.textContent = T.modeHint;
        const m = get(W_MODE);
        for (const [v, p] of modePills) { p.textContent = pick(v, lang()); p.classList.toggle("on", v === m); }
        sb.textContent = T.size; si.textContent = T.sizeHint;
        const manual = get("resolution_mode") === "Ручной / Manual";
        sizeSel.value = get("resolution_preset");
        sizeSel.disabled = manual;
        sizeSel.style.opacity = manual ? "0.45" : "1";
        paintTime();
        picNote.textContent = T.pics;
        expBox.style.display = P.ngb_expert ? "" : "none";
        hSize.textContent = T.size; hLora.textContent = T.lora; hMod.textContent = T.models;
        manCb.checked = manual; manT.textContent = T.manual;
        for (const [name, input, t, key] of ctl) {
            if (key) t.textContent = T[key] || key;
            const v = get(name);
            if (input.type === "checkbox") input.checked = !!v; else input.value = v;
        }
        moreIn.textContent = T.moreIn;
        pb.textContent = T.progress;
        paintProgress();
        fit();
    }

    // ---------------- ход работы ----------------
    const run = node.__ngbRun = node.__ngbRun || { state: "idle" };
    function order() {
        const hd = HD_MODES.includes(get(W_MODE));
        return hd ? ["text", "model", "sample", "upscale", "decode", "audio"] : ["model", "text", "sample", "decode", "audio"];
    }
    // доли полосы по этапам
    const SHARE = { model: 0.06, text: 0.1, sample: 0.66, upscale: 0.04, decode: 0.11, audio: 0.03 };
    function fraction() {
        if (run.state === "done") return 1;
        const ord = order();
        let f = 0;
        for (const s of ord) {
            if (s === run.stage) {
                let part = 0.15;
                if (s === "sample" && run.max) {
                    const hd = ord.includes("upscale");
                    const p = run.value / run.max;
                    part = hd ? ((run.pass > 1 ? 0.5 : 0) + p * 0.5) : p;
                }
                return Math.min(0.99, f + SHARE[s] * part);
            }
            f += SHARE[s] || 0;
        }
        return run.state === "run" ? 0.02 : 0;
    }
    function paintProgress() {
        const T = UI[lang()];
        stages.innerHTML = "";
        const ord = order();
        const cur = ord.indexOf(run.stage);
        for (const [i, s] of ord.entries()) {
            const c = el("span", "ngb-stage", T.st[s]);
            if (run.state === "done" || (run.state === "run" && i < cur)) c.classList.add("ok");
            if (run.state === "run" && i === cur) c.classList.add("now");
            stages.appendChild(c);
        }
        const fr = fraction();
        run.shown = Math.max(run.state === "run" ? (run.shown || 0) : 0, fr);
        fill.style.width = `${(run.state === "idle" ? 0 : run.state === "done" ? 1 : run.shown) * 100}%`;
        fill.classList.toggle("run", run.state === "run");
        fill.classList.toggle("err", run.state === "error");
        const el_ = run.t0 ? (Date.now() - run.t0) / 1000 : 0;
        if (run.state === "idle") { pl.textContent = T.idle; pr.textContent = ""; }
        else if (run.state === "error") { pl.textContent = T.error; pr.textContent = `${T.passed} ${fmt(el_)}`; }
        else if (run.state === "done") { pl.textContent = `${T.done} ${fmt(run.took ?? el_)}`; pr.textContent = ""; }
        else {
            let s = T.st[run.stage] || "…";
            if (run.stage === "sample" && run.max) s += ` · ${T.step} ${run.value}/${run.max}`;
            pl.textContent = s;
            let left = "";
            if (run.stage === "sample" && run.max && run.value > 0 && run.tStep) {
                const per = (Date.now() - run.tStep) / 1000 / run.value;
                const rest = per * (run.max - run.value);
                if (rest > 0) left = ` · ${T.left}${fmt(rest)}`;
            }
            pr.textContent = `${T.passed} ${fmt(el_)}${left}`;
        }
        report.textContent = run.state === "done" ? String(run.report || "").replace(/\n?Готово за[^\n]*$/, "") : "";
        report.style.display = report.textContent ? "" : "none";
    }
    run.repaint = () => { paintProgress(); fit(); };

    ru.onclick = () => { P.ngb_lang = "RU"; paint(); };
    en.onclick = () => { P.ngb_lang = "EN"; paint(); };
    exp.onclick = () => { P.ngb_expert = !P.ngb_expert; syncInputs(node); paint(); };
    hlp.onclick = () => showHelp();

    let lastH = 0;
    function contentH() { return Math.ceil(inner.scrollHeight) + 10; }
    function fit() {
        requestAnimationFrame(() => {
            const h = contentH();
            if (Math.abs(h - lastH) < 2) return;
            lastH = h;
            try { const sz = node.computeSize(); node.setSize([Math.max(node.size[0], sz[0]), sz[1]]); } catch (_) {}
            app.graph?.setDirtyCanvas(true, true);
        });
    }
    const w = node.addDOMWidget("neron_h3_generator_face", "neron_h3_generator_face", root, {
        serialize: false, hideOnZoom: false, getMinHeight: () => contentH(), getHeight: () => contentH(),
    });
    if (w) { w.serialize = false; w.computeSize = (width) => [width, contentH()]; }
    node.__ngbPaint = paint;
    paint();
    setTimeout(() => { lastH = 0; paint(); }, 60);
    setTimeout(() => { lastH = 0; paint(); }, 400);
}

// ---------------- события ComfyUI: этапы, шаги, конец ----------------
let current = null;            // id ноды, которая сейчас работает
const ours = (id) => {
    const n = id != null && app.graph?.getNodeById?.(Number(id));
    return n && (n.type === NODE || n.comfyClass === NODE) ? n : null;
};
let ticker = null;
function tick() {
    const n = ours(current);
    if (n?.__ngbRun?.state === "run") n.__ngbRun.repaint?.();
    else { clearInterval(ticker); ticker = null; }
}
api.addEventListener("executing", (e) => {
    const d = e.detail;
    const id = d && typeof d === "object" ? (d.node ?? d.display_node) : d;
    current = id;
    const n = ours(id);
    if (n) {
        Object.assign(n.__ngbRun, { state: "run", stage: null, t0: Date.now(), value: 0, max: 0, pass: 0, shown: 0,
            took: null, report: "" });
        n.__ngbRun.repaint?.();
        if (!ticker) ticker = setInterval(tick, 1000);
    }
});
api.addEventListener("neron.h3gen.stage", (e) => {
    const n = ours(current);
    if (!n) return;
    const d = e.detail || {};
    if (d.stage === "start") return;
    Object.assign(n.__ngbRun, { stage: d.stage });
    if (d.stage === "sample") Object.assign(n.__ngbRun, { pass: d.n || 1, value: 0, max: 0, tStep: Date.now() });
    n.__ngbRun.repaint?.();
});
api.addEventListener("progress", (e) => {
    const d = e.detail || {};
    const n = ours(d.node ?? current);
    if (!n || n.__ngbRun.stage !== "sample") return;
    Object.assign(n.__ngbRun, { value: d.value, max: d.max });
    n.__ngbRun.repaint?.();
});
api.addEventListener("execution_error", (e) => {
    const n = ours(e.detail?.node_id ?? current);
    if (n) { n.__ngbRun.state = "error"; n.__ngbRun.repaint?.(); }
});

app.registerExtension({
    name: "Neron.H3GeneratorBlank",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== NODE) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created?.apply(this, arguments);
            for (const w of this.widgets || []) hideWidget(w);
            try { build(this); } catch (e) { console.error("[Neron H3 Generator Бланк]", e); }
            // новая нода — сразу убрать лишние входы; при открытии схемы — не трогать (входы придут из файла)
            setTimeout(() => { if (!this.__ngbConfigured) syncInputs(this); this.__ngbPaint?.(); }, 0);
            if (this.size[0] < 520) this.setSize([520, this.size[1]]);
            return r;
        };
        const configure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            this.__ngbConfigured = true;
            const r = configure?.apply(this, arguments);
            setTimeout(() => { try { this.__ngbPaint?.(); } catch (e) { console.error(e); } }, 0);
            return r;
        };
        const conn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type) {
            const r = conn?.apply(this, arguments);
            if (type === 1 && !this.__ngbSyncing) {               // 1 — вход
                setTimeout(() => {
                    try { autoLength(this); syncInputs(this); this.__ngbPaint?.(); } catch (e) { console.error(e); }
                }, 0);
            }
            return r;
        };
        const executed = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const r = executed?.apply(this, arguments);
            const run = this.__ngbRun;
            if (run) {
                const text = String(message?.text?.[0] || "");
                const m = text.match(/(\d+)\s*мин\s*(\d+)\s*с/);
                run.state = "done";
                run.took = m ? Number(m[1]) * 60 + Number(m[2]) : (run.t0 ? (Date.now() - run.t0) / 1000 : 0);
                run.report = text;
                run.repaint?.();
            }
            return r;
        };
    },
});
