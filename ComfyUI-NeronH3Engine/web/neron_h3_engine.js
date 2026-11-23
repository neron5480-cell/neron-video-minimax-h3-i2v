// 🌀 Neron H3 Engine — общий вид Neron: шина, эксперт, ход работы и окно моделей.
// Всё видимое живёт здесь и целиком переключается RU / EN.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Engine";
const NONE = "— нет —";
const AUTO = "по умолчанию";

const UI = {
  RU: {
    prompt: "ЧТО ПРОИСХОДИТ",
    promptHint: "Своими словами — можно по-русски",
    promptPh: "Например: вечерний город после дождя, велосипедист проезжает по мосту, камера следует сбоку, звук шин и далёкий трафик",
    preset: "Пресет",
    frame: "РОЛИК",
    aspect: "Форма кадра",
    duration: "Длительность",
    mode: "Режим",
    modeHint: "По железу: турбо (8 шагов) или качество (20 шагов). Авто само решает по видеопамяти.",
    sharp: "Резкость",
    sharpHint: "1.0 — проверенное значение",
    frames: "КАДРЫ",
    frameHint: "нажми или перетащи картинку — окно подстроится под неё",
    first: "Первый",
    mid1: "Промежуточный 1",
    mid2: "Промежуточный 2",
    last: "Последний",
    variant: "ВАРИАНТ",
    seed: "Номер ролика",
    after: "После запуска",
    progress: "ХОД РАБОТЫ",
    idle: "Ждёт запуска.",
    waiting: "ждёт своей очереди",
    done: "✅ Готово",
    error: "❌ Ошибка — подробности в консоли",
    step: "шаг",
    models: "📥 Модели",
    run: "▶ Создать видео",
    help: "📖 справка",
    expert: "⚙ эксперт",
    expertNote: "Здесь выбираются файлы моделей и лоры. Для обычной работы не нужно.",
    modelsTitle: "ФАЙЛЫ МОДЕЛЕЙ",
    mainModel: "Основная модель",
    textTurbo: "Текст: турбо",
    textPower: "Текст: качество",
    videoVae: "Видео-кодек",
    audioVae: "Звук-кодек",
    turboLora: "Турбо-лора",
    turboWeight: "Сила",
    lorasTitle: "ДОПОЛНИТЕЛЬНЫЕ ЛОРЫ",
    loraHint: "Включённые лоры применяются по порядку. Неподходящий файл пропускается.",
    refreshModels: "🔄 Обновить списки",
    fineTitle: "ТОЧНЫЕ ЧИСЛА",
    autoModel: "по умолчанию",
    noneModel: "нет",
    sizeMode: "Свой размер",
    width: "Ширина",
    height: "Высота",
    steps: "Шаги",
    previews: "Раскадровка во время счёта",
    file: "Имя файла",
    reset: "🔄 Сбросить настройки",
    busNote: "Данные приходят с шины: промт, кадры, размер и длительность.",
    modelsText: "Модели H3 ищутся сами во всех папках ComfyUI. Недостающие файлы докачиваются с места обрыва. Ничего указывать не надо.",
    helpText: "1. Напиши, что происходит в кадре, хоть по-русски.\n2. Выбери пресет или двигай ползунки: длительность и резкость. Размер «от первого кадра» возьмёт пропорции картинки; свой размер главнее.\n3. При желании положи картинки в четыре окна кадров — окно само подстроится под картинку и покажет её целиком.\n4. «Режим — по железу» сам выберет турбо (8 шагов) или качество (20 шагов); подробности появятся в ходе работы.\n5. Нажми «Создать видео».\n\nЕсли подключить внешний блок к единственному входу-шине, движок станет голым: промт, кадры, размер и длительность придут с шины, останутся качество, резкость, ход работы, видео и «⚙ эксперт». Ролик появится в ноде, а последний кадр подаётся в следующий прогон.",
    aspectNames: { auto: "от первого кадра", "16:9": "16:9 широкий", "9:16": "9:16 высокий", "1:1": "1:1 квадрат", "4:3": "4:3 — классика", "3:2": "3:2 — фото" },
    modeNames: { auto: "по железу", turbo: "турбо — быстро", power: "качество — медленно" },
    presetNames: { "обычный": "обычный", "быстрый": "быстрый", "качество": "качество", "кино": "кино", "стык кадров": "стык кадров" },
    afterNames: { fixed: "не менять", increment: "увеличить", decrement: "уменьшить", randomize: "случайно" },
  },
  EN: {
    prompt: "WHAT HAPPENS",
    promptHint: "In your own words — any language works",
    promptPh: "For example: a rainy city bridge at dusk, a cyclist crossing, side tracking shot, tyre hiss and distant traffic",
    preset: "Preset",
    frame: "CLIP",
    aspect: "Frame shape",
    duration: "Duration",
    mode: "Mode",
    modeHint: "By hardware: turbo (8 steps) or quality (20 steps). Auto decides from available VRAM.",
    sharp: "Sharpness",
    sharpHint: "1.0 is the tested value",
    frames: "FRAMES",
    frameHint: "click or drop a picture — the window fits it",
    first: "First",
    mid1: "Middle 1",
    mid2: "Middle 2",
    last: "Last",
    variant: "VARIANT",
    seed: "Clip number",
    after: "After run",
    progress: "PROGRESS",
    idle: "Waiting for a run.",
    waiting: "waiting in queue",
    done: "✅ Done",
    error: "❌ Error — see the console",
    step: "step",
    models: "📥 Models",
    run: "▶ Create video",
    help: "📖 help",
    expert: "⚙ expert",
    expertNote: "Model files and extra LoRAs live here. Not needed for ordinary work.",
    modelsTitle: "MODEL FILES",
    mainModel: "Main model",
    textTurbo: "Text: turbo",
    textPower: "Text: quality",
    videoVae: "Video VAE",
    audioVae: "Audio VAE",
    turboLora: "Turbo LoRA",
    turboWeight: "Weight",
    lorasTitle: "EXTRA LoRAS",
    loraHint: "Enabled LoRAs are applied in order. A file that does not fit is skipped.",
    refreshModels: "🔄 Refresh lists",
    fineTitle: "EXACT NUMBERS",
    autoModel: "default",
    noneModel: "none",
    sizeMode: "Custom size",
    width: "Width",
    height: "Height",
    steps: "Steps",
    previews: "Storyboard while rendering",
    file: "File name",
    reset: "🔄 Reset settings",
    busNote: "Data comes from the bus: prompt, frames, size and duration.",
    modelsText: "H3 models are discovered in every ComfyUI model folder. Missing files resume automatically. Nothing to set up.",
    helpText: "1. Describe what happens in the frame — any language works.\n2. Pick a preset or move the sliders: duration and sharpness. «From first frame» takes the picture's proportions; a custom size wins.\n3. Optionally drop pictures into the four frame windows — each window fits its picture and shows it whole.\n4. «By hardware» picks turbo (8 steps) or quality (20 steps); the exact choice appears in progress.\n5. Press «Create video».\n\nConnect an external block to the single data bus and the engine turns bare: prompt, frames, size and duration arrive on the bus; only quality, sharpness, progress, video and «⚙ expert» stay. The clip appears in the node; its last frame feeds the next run.",
    aspectNames: { auto: "from first frame", "16:9": "16:9 wide", "9:16": "9:16 tall", "1:1": "1:1 square", "4:3": "4:3 — classic", "3:2": "3:2 — photo" },
    modeNames: { auto: "by hardware", turbo: "turbo — fast", power: "quality — slow" },
    presetNames: { "обычный": "ordinary", "быстрый": "fast", "качество": "quality", "кино": "cinema", "стык кадров": "seam" },
    afterNames: { fixed: "keep", increment: "increase", decrement: "decrease", randomize: "random" },
  },
};

const PALETTES = {
  RU: { bg: "#101722", node: "#17212e", head: "#2a3b52", accent: "#4c78ad" },
  EN: { bg: "#0f1a1a", node: "#18292b", head: "#27504d", accent: "#3d8a83" },
};

const PRESETS = {
  "обычный": { seconds: 5, mode: "auto", sharpness: 1.0, frame_format: "auto", steps: 0, manual_size: false, width: 0, height: 0 },
  "быстрый": { seconds: 5, mode: "turbo", sharpness: 1.15, frame_format: "auto", steps: 8, manual_size: false, width: 0, height: 0 },
  "качество": { seconds: 8, mode: "power", sharpness: 1.0, frame_format: "auto", steps: 20, manual_size: false, width: 0, height: 0 },
  "кино": { seconds: 12, mode: "power", sharpness: 1.1, frame_format: "16:9", steps: 20, manual_size: false, width: 0, height: 0 },
  "стык кадров": { seconds: 8, mode: "turbo", sharpness: 1.05, frame_format: "auto", steps: 8, manual_size: false, width: 0, height: 0 },
};

const FRAME_SLOTS = [
  ["first_image", "first"],
  ["mid_image_1", "mid1"],
  ["mid_image_2", "mid2"],
  ["last_image", "last"],
];

let LANG = "RU";
let CLOCK_HOOKED = false;

const CSS = `
.nh{box-sizing:border-box;width:100%;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#e7eef7;padding:2px 2px 6px}
.nh *{box-sizing:border-box}
.nh-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.nh-pill{background:#202b38;border:1px solid #4b5d73;border-radius:14px;padding:3px 10px;font-size:12px;color:#c3ccd8;cursor:pointer;user-select:none}
.nh-pill:hover{border-color:var(--nh-accent);color:#fff}
.nh-pill.on{background:var(--nh-head);border-color:var(--nh-accent);color:#fff}
.nh-sp{flex:1}
.nh-sec{margin-bottom:9px}
.nh-lab{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:4px}
.nh-lab b{color:#f2f6fb;font-weight:600;letter-spacing:.3px;font-size:12px}
.nh-lab i{color:#93a2b4;font-style:normal;font-size:11.5px;text-align:right}
.nh select,.nh input,.nh textarea{background:#141f2c;color:#e9f0fa;border:1px solid #43556c;border-radius:6px;padding:5px 8px;font:12.5px "Segoe UI",Arial,sans-serif;width:100%}
.nh textarea{background:#101a2b;border-color:#334c72;border-radius:7px;padding:8px 10px;resize:vertical;outline:none}
.nh .nh-prompt{min-height:72px}
.nh-btn{background:#2f4561;color:#fff;border:1px solid #52749b;border-radius:6px;padding:5px 11px;cursor:pointer;font:12px "Segoe UI",Arial,sans-serif;margin-top:5px}
.nh-btn:hover{background:var(--nh-head)}
.nh-btn.main{background:var(--nh-accent);border-color:var(--nh-accent);font-weight:600;width:100%;padding:8px;margin-top:5px}
.nh-row{display:flex;gap:7px;align-items:center;margin-bottom:4px}
.nh-row>span{color:#a9b8c9;font-size:12px;min-width:86px}
.nh-row>input,.nh-row>select{flex:1}
.nh-row .nh-val{color:#e8f1ff;min-width:54px;text-align:right;font-variant-numeric:tabular-nums}
.nh input[type=range]{padding:0;border:0;background:transparent;accent-color:var(--nh-accent)}
.nh-check{display:flex;gap:8px;align-items:center;color:#c4d0de;font-size:12.5px;cursor:pointer;margin:4px 0}
.nh-check input{width:auto}
.nh-exp{background:#1a2532;border:1px solid #4a4b3d;border-radius:7px;padding:8px 10px;margin:6px 0 9px}
.nh-exp h4{margin:7px 0 4px;font-size:11.5px;color:#f0cd8a;font-weight:600;letter-spacing:.4px}
.nh-exp .nh-row{margin:3px 0}
.nh-exp .nh-row>span{min-width:98px;font-size:11.5px}
.nh-exp select{padding:4px 6px;font-size:11.5px}
.nh-lora{display:grid;grid-template-columns:20px 1fr 70px 34px;gap:6px;align-items:center;margin:3px 0}
.nh-lora input[type=checkbox]{width:auto;margin:0}
.nh-lora select{padding:4px 6px;font-size:11.5px}
.nh-lora .nh-val{min-width:34px;text-align:right;font-size:11px}
.nh-lora input[type=range]{padding:0;border:0;background:transparent;accent-color:var(--nh-accent)}
.nh-mini{font-size:11px;color:#a9b8c9;margin:3px 0 5px}
.nh-note{font-size:11.5px;color:#e0b98a;background:#2c261c;border:1px solid #615338;border-radius:6px;padding:6px 9px;margin:5px 0}
.nh-frames{display:grid;grid-template-columns:1fr 1fr;gap:6px;align-items:start}
.nh-frame{position:relative;height:var(--nh-frame-h,76px);min-height:76px;border:1px dashed #465b73;border-radius:7px;background:#101a26;overflow:hidden;cursor:pointer;transition:height .12s}
.nh-frame img{width:100%;height:100%;object-fit:contain;display:block}
.nh-frame span{position:absolute;left:4px;bottom:3px;font-size:10.5px;color:#e7eef7;background:#0009;padding:1px 5px;border-radius:5px}
.nh-frame b{position:absolute;right:3px;top:3px;font-size:13px;color:#fff;background:#0009;width:18px;height:18px;line-height:17px;text-align:center;border-radius:50%;display:none}
.nh-frame:hover b{display:block}
.nh-prog{background:#18212d;border:1px solid #36516f;border-radius:8px;padding:8px 10px}
.nh-track{height:10px;border-radius:5px;background:#101822;border:1px solid #2b3a4f;overflow:hidden;margin:6px 0}
.nh-fill{height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,#2f7d4f,#5fd09a);transition:width .4s}
.nh-fill.err{background:linear-gradient(90deg,#7d2f2f,#c95b5b)}
.nh-board{display:flex;gap:4px;min-height:44px}
.nh-board img{width:33.33%;height:44px;object-fit:cover;border-radius:4px;border:1px solid #33445c}
.nh-dlg{position:fixed;inset:0;background:#000a;z-index:100001;display:flex;align-items:center;justify-content:center}
.nh-dlg-box{background:#14202a;color:#e2eaf4;border:1px solid #3d6273;border-radius:10px;padding:18px 20px;width:min(620px,92vw);max-height:86vh;overflow:auto;font:13px/1.55 "Segoe UI",Arial,sans-serif;box-shadow:0 10px 40px #000a}
.nh-dlg-close{float:right;background:var(--nh-head);color:#fff;border:0;border-radius:6px;padding:4px 12px;cursor:pointer}
`;

let CSS_ADDED = false;
function addCss() {
  if (CSS_ADDED) return;
  CSS_ADDED = true;
  const s = document.createElement("style");
  s.id = "neron-h3-common-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function W(node, name) { return (node.widgets || []).find((w) => w.name === name); }
function setw(node, name, value) {
  const w = W(node, name);
  if (!w) return;
  w.value = value;
  try { w.callback?.(value, app.canvas, node, [0, 0], null); } catch (_) {}
}
function linked(node, name) {
  return (node.inputs || []).some((i) => i.name === name && i.link != null);
}
function langOf(node) {
  const v = String(W(node, "lang")?.value || "").toLowerCase();
  return v.startsWith("en") ? "EN" : "RU";
}
function T(node) { return UI[langOf(node)]; }
function ourNodes() {
  return (app.graph?._nodes || []).filter((n) => n && n.type === NODE);
}
function manualOf(node) {
  if (!node.__nhManual) node.__nhManual = new Set();
  return node.__nhManual;
}
function hideNative(node) {
  for (const w of node.widgets || []) {
    w.hidden = true;
    w.type = "hidden";
    w.computeSize = () => [0, -4];
  }
}
function syncSlotLabels(node) {
  const ins = {
    bundle: langOf(node) === "RU" ? "Шина данных" : "Data bus",
  };
  const outRu = langOf(node) === "RU";
  const outs = {
    last_image_out: outRu ? "Последний кадр" : "Last frame",
    "Последний кадр": outRu ? "Последний кадр" : "Last frame",
    "Last frame": outRu ? "Последний кадр" : "Last frame",
  };
  for (const i of node.inputs || []) if (ins[i.name]) i.label = ins[i.name];
  for (const o of node.outputs || []) if (outs[o.name]) o.label = outs[o.name];
}

function applyTheme() {
  const nodes = ourNodes();
  for (const n of nodes) if (!n.__nhReady) setupNode(n);
  const active = nodes.length > 0;
  const lang = active ? langOf(nodes[0]) : "RU";
  LANG = lang;
  let style = document.getElementById("neron-h3-theme");
  if (!active) {
    if (style) style.remove();
    document.body.classList.remove("neron-h3-active");
    for (const n of nodes) { n.color = null; n.bgcolor = null; }
    return;
  }
  const p = PALETTES[lang];
  document.body.classList.add("neron-h3-active");
  if (!style) {
    style = document.createElement("style");
    style.id = "neron-h3-theme";
    document.head.appendChild(style);
  }
  style.textContent = `body.neron-h3-active{background:${p.bg} !important;--nh-accent:${p.accent};--nh-head:${p.head}}`;
  for (const n of nodes) { n.color = p.head; n.bgcolor = p.node; }
}

function setLang(node, lang) {
  for (const n of ourNodes()) {
    setw(n, "lang", lang.toLowerCase());
    n.__nhPaint?.();
  }
  LANG = lang;
  applyTheme();
  for (const n of ourNodes()) n.setDirtyCanvas?.(true, true);
}

function applyPreset(node, key) {
  const values = PRESETS[key];
  if (!values) return;
  const manual = manualOf(node);
  for (const [name, value] of Object.entries(values)) {
    if (manual.has(name)) continue;
    setw(node, name, value);
  }
  setw(node, "preset", key);
  node.__nhPaint?.();
}

async function refreshExpertOptions(node, btn) {
  if (btn) btn.disabled = true;
  try {
    const r = await api.fetchApi("/object_info/NeronH3Engine");
    const j = await r.json();
    const info = j.NeronH3Engine || {};
    const defs = { ...(info.input?.required || {}), ...(info.input?.optional || {}) };
    for (const w of node.widgets || []) {
      const values = defs[w.name]?.[1]?.options;
      if (!Array.isArray(values)) continue;
      w.options = w.options || {};
      w.options.values = values;
    }
    node.__nhPaint?.();
  } catch (e) {
    console.warn("[Neron H3] model list refresh failed", e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function dialog(node, title, text) {
  const wrap = el("div", "nh-dlg");
  const box = el("div", "nh-dlg-box");
  const close = el("button", "nh-dlg-close", T(node) === UI.RU ? "Закрыть" : "Close");
  const body = el("div");
  body.style.whiteSpace = "pre-wrap";
  body.textContent = text;
  close.onclick = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  box.append(close, el("h3", "", title), body);
  wrap.appendChild(box);
  document.body.appendChild(wrap);
}

function frameUrl(value) {
  if (!value || value === NONE) return "";
  const i = value.lastIndexOf("/");
  const sub = i >= 0 ? value.slice(0, i) : "";
  const file = i >= 0 ? value.slice(i + 1) : value;
  return api.apiURL(`/view?filename=${encodeURIComponent(file)}&type=input&subfolder=${encodeURIComponent(sub)}`);
}

function fitFrameTile(slot) {
  const img = slot.img;
  if (!img.naturalWidth || !img.naturalHeight) return;
  const width = slot.tile.clientWidth || 160;
  const height = Math.max(76, Math.min(190, Math.round(width * img.naturalHeight / img.naturalWidth)));
  slot.tile.style.setProperty("--nh-frame-h", `${height}px`);
  app.graph?.setDirtyCanvas?.(true, false);
}

async function uploadFrame(node, widgetName, file) {
  if (!file || !file.type?.startsWith("image/")) return;
  const body = new FormData();
  body.append("image", file);
  body.append("type", "input");
  try {
    const r = await api.fetchApi("/upload/image", { method: "POST", body });
    if (r.status !== 200) return;
    const d = await r.json();
    const value = d.subfolder ? `${d.subfolder}/${d.name}` : d.name;
    const w = W(node, widgetName);
    const opts = w?.options?.values || w?.options?.options || [];
    if (Array.isArray(opts) && !opts.includes(value)) opts.push(value);
    setw(node, widgetName, value);
    manualOf(node).add(widgetName);
    node.__nhPaint?.();
  } catch (e) {
    console.warn("[Neron H3] upload failed", e);
  }
}

function buildPanel(node) {
  addCss();
  hideNative(node);
  const t0 = T(node);
  const root = el("div", "nh");
  const inner = el("div");
  root.appendChild(inner);
  for (const ev of ["pointerdown", "mousedown", "wheel", "keydown", "contextmenu"]) {
    root.addEventListener(ev, (e) => {
      if (e.target.closest("select,input,textarea,button")) e.stopPropagation();
    }, { passive: true });
  }

  const bar = el("div", "nh-bar");
  const ru = el("span", "nh-pill", "RU"), en = el("span", "nh-pill", "EN");
  const exp = el("span", "nh-pill"), hlp = el("span", "nh-pill");
  const presetSel = el("select");
  presetSel.style.width = "118px";
  presetSel.style.flex = "0 0 118px";
  for (const key of Object.keys(PRESETS)) {
    const o = document.createElement("option");
    o.value = key;
    presetSel.appendChild(o);
  }
  bar.append(ru, en, el("span", "nh-sp"), presetSel, exp, hlp);
  inner.appendChild(bar);
  ru.onclick = () => setLang(node, "RU");
  en.onclick = () => setLang(node, "EN");
  hlp.onclick = () => dialog(node, t0.help, t0.helpText);
  exp.onclick = () => {
    setw(node, "expert", !W(node, "expert")?.value);
    node.__nhPaint?.();
    if (W(node, "expert")?.value) refreshExpertOptions(node);
  };
  presetSel.onchange = () => applyPreset(node, presetSel.value);

  const promptSec = el("div", "nh-sec");
  const promptLab = el("div", "nh-lab");
  const promptB = el("b"), promptI = el("i");
  promptLab.append(promptB, promptI);
  const promptArea = el("textarea", "nh-prompt");
  promptArea.spellcheck = false;
  promptArea.oninput = () => {
    setw(node, "prompt", promptArea.value);
    manualOf(node).add("prompt");
  };
  promptSec.append(promptLab, promptArea);
  inner.appendChild(promptSec);

  const clipSec = el("div", "nh-sec");
  const clipLab = el("div", "nh-lab"), clipB = el("b"), clipI = el("i");
  clipLab.append(clipB, clipI);
  clipSec.appendChild(clipLab);
  const controls = {};
  function rowSelect(name, key) {
    const r = el("div", "nh-row"), s = el("span"), sel = el("select");
    const w = W(node, name);
    const vals = [...(w?.options?.values || w?.options?.options || [])];
    for (const v of vals) {
      const o = document.createElement("option");
      o.value = v;
      sel.appendChild(o);
    }
    sel.onchange = () => { setw(node, name, sel.value); manualOf(node).add(name); node.__nhPaint?.(); };
    r.append(s, sel);
    clipSec.appendChild(r);
    controls[key] = { row: r, select: sel, label: s, name };
    return sel;
  }
  function rowSlider(name, key, min, max, step, human) {
    const r = el("div", "nh-row"), s = el("span"), val = el("span", "nh-val"), range = document.createElement("input");
    range.type = "range";
    range.min = min; range.max = max; range.step = step;
    range.oninput = () => {
      setw(node, name, Number(range.value));
      manualOf(node).add(name);
      val.textContent = human(Number(range.value), T(node));
      app.graph?.setDirtyCanvas(true, false);
    };
    r.append(s, range, val);
    clipSec.appendChild(r);
    controls[key] = { row: r, range, val, label: s, name, human };
  }
  rowSelect("frame_format", "aspect");
  rowSlider("seconds", "duration", 5, 15, 1, (v) => `${v} ${LANG === "RU" ? "с" : "s"}`);
  rowSelect("mode", "mode");
  rowSlider("sharpness", "sharp", 0, 2, 0.05, (v) => Number(v).toFixed(2));
  const sizeCheck = el("label", "nh-check"), sizeBox = document.createElement("input");
  sizeBox.type = "checkbox";
  sizeBox.onchange = () => {
    if (sizeBox.checked && !W(node, "width")?.value) {
      setw(node, "width", 768);
      setw(node, "height", 448);
    }
    setw(node, "manual_size", sizeBox.checked);
    manualOf(node).add("manual_size");
    node.__nhPaint?.();
  };
  const sizeLabel = el("span");
  sizeCheck.append(sizeBox, sizeLabel);
  clipSec.appendChild(sizeCheck);
  rowSlider("width", "widthSlider", 256, 1344, 32, (v) => `${v} px`);
  rowSlider("height", "heightSlider", 256, 1344, 32, (v) => `${v} px`);
  inner.appendChild(clipSec);

  const framesSec = el("div", "nh-sec");
  const framesLab = el("div", "nh-lab"), framesB = el("b"), framesI = el("i");
  framesLab.append(framesB, framesI);
  const grid = el("div", "nh-frames");
  const frameEls = {};
  for (const [widgetName, key] of FRAME_SLOTS) {
    const tile = el("div", "nh-frame");
    const img = document.createElement("img");
    const cap = el("span");
    const clear = el("b", "", "×");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/bmp,image/gif";
    input.style.display = "none";
    tile.append(img, cap, clear, input);
    tile.onclick = (e) => { if (e.target !== clear) input.click(); };
    tile.ondragover = (e) => e.preventDefault();
    tile.ondrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.[0]) uploadFrame(node, widgetName, e.dataTransfer.files[0]);
    };
    input.onchange = () => { if (input.files?.[0]) uploadFrame(node, widgetName, input.files[0]); };
    clear.onclick = (e) => {
      e.stopPropagation();
      setw(node, widgetName, NONE);
      manualOf(node).add(widgetName);
      node.__nhPaint?.();
    };
    grid.appendChild(tile);
    const slot = { img, cap, tile, widgetName };
    img.onload = () => fitFrameTile(slot);
    frameEls[key] = slot;
  }
  framesSec.append(framesLab, grid);
  inner.appendChild(framesSec);

  const varSec = el("div", "nh-sec");
  const varLab = el("div", "nh-lab"), varB = el("b");
  varLab.append(varB);
  const seedRow = el("div", "nh-row"), seedSpan = el("span"), seedInput = document.createElement("input");
  seedInput.type = "number";
  seedInput.onchange = () => { setw(node, "seed", Number(seedInput.value)); manualOf(node).add("seed"); };
  seedRow.append(seedSpan, seedInput);
  const afterRow = el("div", "nh-row"), afterSpan = el("span"), afterSel = el("select");
  afterRow.append(afterSpan, afterSel);
  varSec.append(varLab, seedRow, afterRow);
  inner.appendChild(varSec);

  const progSec = el("div", "nh-sec nh-prog");
  const progLab = el("div", "nh-lab"), progB = el("b"), progR = el("i");
  progLab.append(progB, progR);
  const board = el("div", "nh-board");
  const track = el("div", "nh-track"), fill = el("div", "nh-fill");
  track.appendChild(fill);
  progSec.append(progLab, board, track);
  inner.appendChild(progSec);

  const note = el("div", "nh-note");
  note.style.display = "none";
  inner.appendChild(note);

  const modelsBtn = el("button", "nh-btn", t0.models);
  modelsBtn.onclick = () => dialog(node, T(node).models, T(node).modelsText + "\n\n" + (node.__nhLastStatus || ""));
  inner.appendChild(modelsBtn);

  const runBtn = el("button", "nh-btn main", t0.run);
  runBtn.onclick = () => { try { app.queuePrompt(0, 1); } catch (_) {} };
  inner.appendChild(runBtn);

  const expBox = el("div", "nh-exp");
  const expNote = el("div", "nh-note");
  expBox.appendChild(expNote);
  const modelsTitle = el("h4"), lorasTitle = el("h4"), hFine = el("h4");
  function expRow(name, key, kind) {
    const r = el("div", "nh-row"), s = el("span"), input = document.createElement("input");
    input.type = kind === "check" ? "checkbox" : (kind === "number" ? "number" : "text");
    input.onchange = () => {
      const v = kind === "check" ? input.checked : (kind === "number" ? Number(input.value) : input.value);
      setw(node, name, v);
      manualOf(node).add(name);
      node.__nhPaint?.();
    };
    r.append(s, input);
    expBox.appendChild(r);
    controls[key] = { input, label: s, name, kind };
    return r;
  }
  function expSelect(name, key) {
    const r = el("div", "nh-row"), s = el("span"), sel = el("select");
    sel.onchange = () => { setw(node, name, sel.value); manualOf(node).add(name); node.__nhPaint?.(); };
    r.append(s, sel);
    expBox.appendChild(r);
    controls[key] = { select: sel, label: s, name };
    return r;
  }
  function expWeight(name, key) {
    const r = el("div", "nh-row"), s = el("span"), val = el("span", "nh-val"), range = document.createElement("input");
    range.type = "range"; range.min = -3; range.max = 3; range.step = 0.05;
    range.oninput = () => {
      setw(node, name, Number(range.value));
      manualOf(node).add(name);
      val.textContent = Number(range.value).toFixed(2);
    };
    r.append(s, range, val);
    expBox.appendChild(r);
    controls[key] = { range, val, label: s, name };
    return r;
  }
  function loraRow(i) {
    const wrap = el("div", "nh-lora");
    const on = document.createElement("input"); on.type = "checkbox";
    const sel = document.createElement("select");
    const range = document.createElement("input");
    range.type = "range"; range.min = -3; range.max = 3; range.step = 0.05;
    const val = el("span", "nh-val");
    on.onchange = () => { setw(node, `lora_${i}_enabled`, on.checked); manualOf(node).add(`lora_${i}_enabled`); };
    sel.onchange = () => { setw(node, `lora_${i}_name`, sel.value); manualOf(node).add(`lora_${i}_name`); };
    range.oninput = () => {
      setw(node, `lora_${i}_strength`, Number(range.value));
      manualOf(node).add(`lora_${i}_strength`);
      val.textContent = Number(range.value).toFixed(2);
    };
    wrap.append(on, sel, range, val);
    expBox.appendChild(wrap);
    controls[`lora${i}On`] = { input: on, name: `lora_${i}_enabled` };
    controls[`lora${i}Name`] = { select: sel, name: `lora_${i}_name` };
    controls[`lora${i}Weight`] = { range, val, name: `lora_${i}_strength` };
    return wrap;
  }

  expBox.appendChild(modelsTitle);
  expSelect("diffusion_model", "mainModel");
  expSelect("text_turbo_model", "textTurbo");
  expSelect("text_power_model", "textPower");
  expSelect("video_vae_model", "videoVae");
  expSelect("audio_vae_model", "audioVae");
  expSelect("turbo_lora", "turboLora");
  expWeight("turbo_lora_strength", "turboWeight");
  const refreshBtn = el("button", "nh-btn", t0.refreshModels);
  refreshBtn.onclick = () => refreshExpertOptions(node, refreshBtn);
  expBox.appendChild(refreshBtn);

  expBox.appendChild(lorasTitle);
  expBox.appendChild(el("div", "nh-mini", t0.loraHint));
  const loraHint = expBox.lastChild;
  for (let i = 1; i <= 5; i++) loraRow(i);

  expBox.appendChild(hFine);
  const widthRow = expRow("width", "width", "number");
  const heightRow = expRow("height", "height", "number");
  expRow("steps", "steps", "number");
  const previewCheck = el("label", "nh-check"), previewBox = document.createElement("input");
  previewBox.type = "checkbox";
  previewBox.onchange = () => { setw(node, "previews", previewBox.checked); manualOf(node).add("previews"); };
  const previewLabel = el("span");
  previewCheck.append(previewBox, previewLabel);
  expBox.appendChild(previewCheck);
  expRow("video_name", "file", "text");
  const resetBtn = el("button", "nh-btn", t0.reset);
  resetBtn.onclick = () => {
    node.__nhManual = new Set();
    applyPreset(node, W(node, "preset")?.value || "обычный");
    for (const [widgetName] of FRAME_SLOTS) setw(node, widgetName, NONE);
    for (const name of ["diffusion_model", "text_turbo_model", "text_power_model",
                        "video_vae_model", "audio_vae_model", "turbo_lora"]) {
      setw(node, name, AUTO);
    }
    setw(node, "turbo_lora_strength", 1);
    for (let i = 1; i <= 5; i++) {
      setw(node, `lora_${i}_enabled`, false);
      setw(node, `lora_${i}_name`, NONE);
      setw(node, `lora_${i}_strength`, 1);
    }
    setw(node, "prompt", "");
    node.__nhPaint?.();
  };
  expBox.appendChild(resetBtn);
  inner.appendChild(expBox);

  node.__nhEls = {
    root, inner, ru, en, exp, hlp, presetSel,
    promptSec, promptB, promptI, promptArea, clipB, clipI, controls, framesSec, framesB, framesI,
    frameEls, varSec, varB, seedSpan, seedInput, afterSpan, afterSel,
    progB, progR, board, fill, note, modelsBtn,
    runBtn, expBox, expNote, modelsTitle, lorasTitle, loraHint, refreshBtn, hFine,
    sizeCheck, sizeBox, sizeLabel, widthRow, heightRow, previewBox, previewLabel, resetBtn,
  };
  node.__nhBoard = [];

  function height() { return Math.ceil(inner.scrollHeight) + 8; }
  const domWidget = node.addDOMWidget("neron_h3_panel", "neron_h3_panel", root, {
    serialize: false, hideOnZoom: false,
    getMinHeight: height, getHeight: height,
  });
  if (domWidget) {
    domWidget.serialize = false;
    domWidget.computeSize = () => [node.size[0], height()];
  }

  let lastH = 0;
  function fit() {
    clearTimeout(node.__nhFitTimer);
    node.__nhFitTimer = setTimeout(() => {
      const h = height();
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      try { node.setSize([Math.max(node.size[0], 420), h]); } catch (_) {}
      app.graph?.setDirtyCanvas(true, true);
    }, 30);
  }
  function renderBoard() {
    board.innerHTML = "";
    for (const src of node.__nhBoard.slice(-3)) {
      const im = document.createElement("img");
      im.src = src;
      board.appendChild(im);
    }
  }
  node.__nhRenderBoard = renderBoard;

  function paint() {
    const t = T(node);
    const e = node.__nhEls;
    function fillSelect(sel, values) {
      const list = Array.isArray(values) ? values : [];
      const same = sel.options.length === list.length &&
        [...sel.options].every((o, i) => o.value === list[i]);
      if (!same) {
        sel.innerHTML = "";
        for (const v of list) {
          const o = document.createElement("option");
          o.value = v;
          sel.appendChild(o);
        }
      }
      for (const o of sel.options) {
        o.textContent = o.value === AUTO ? t.autoModel : (o.value === NONE ? t.noneModel : o.value);
      }
    }
    syncSlotLabels(node);
    e.ru.classList.toggle("on", langOf(node) === "RU");
    e.en.classList.toggle("on", langOf(node) === "EN");
    e.exp.textContent = t.expert;
    e.exp.classList.toggle("on", !!W(node, "expert")?.value);
    e.hlp.textContent = t.help;
    for (const o of e.presetSel.options) o.textContent = t.presetNames[o.value] || o.value;
    e.presetSel.value = W(node, "preset")?.value || "обычный";

    const onBus = linked(node, "bundle");
    const manualSize = !!W(node, "manual_size")?.value;
    e.promptSec.style.display = onBus ? "none" : "";
    e.framesSec.style.display = onBus ? "none" : "";
    e.varSec.style.display = onBus ? "none" : "";
    e.presetSel.style.display = onBus ? "none" : "";
    e.controls.aspect.row.style.display = onBus ? "none" : "";
    e.controls.duration.row.style.display = onBus ? "none" : "";
    e.sizeCheck.style.display = onBus ? "none" : "";
    e.controls.widthSlider.row.style.display = (!onBus && manualSize) ? "" : "none";
    e.controls.heightSlider.row.style.display = e.controls.widthSlider.row.style.display;
    e.promptB.textContent = t.prompt;
    e.promptI.textContent = t.promptHint;
    e.promptArea.placeholder = t.promptPh;
    if (document.activeElement !== e.promptArea) e.promptArea.value = W(node, "prompt")?.value ?? "";

    e.clipB.textContent = t.frame;
    e.clipI.textContent = t.modeHint;
    e.framesB.textContent = t.frames;
    e.framesI.textContent = t.frameHint;
    e.varB.textContent = t.variant;
    e.progB.textContent = t.progress;
    e.modelsBtn.textContent = t.models;
    e.runBtn.textContent = t.run;
    e.expNote.textContent = t.expertNote;
    e.modelsTitle.textContent = t.modelsTitle;
    e.lorasTitle.textContent = t.lorasTitle;
    e.loraHint.textContent = t.loraHint;
    e.refreshBtn.textContent = t.refreshModels;
    e.hFine.textContent = t.fineTitle;
    e.sizeLabel.textContent = t.sizeMode;
    e.previewLabel.textContent = t.previews;
    e.resetBtn.textContent = t.reset;

    e.controls.aspect.label.textContent = t.aspect;
    e.controls.duration.label.textContent = t.duration;
    e.controls.mode.label.textContent = t.mode;
    e.controls.mode.select.title = t.modeHint;
    e.controls.sharp.label.textContent = t.sharp;
    for (const key of ["aspect", "mode"]) {
      const c = e.controls[key], w = W(node, c.name);
      const vals = [...(w?.options?.values || w?.options?.options || [])];
      if (c.select.options.length !== vals.length) {
        c.select.innerHTML = "";
        for (const v of vals) {
          const o = document.createElement("option");
          o.value = v;
          c.select.appendChild(o);
        }
      }
      for (const o of c.select.options) {
        o.textContent = key === "aspect" ? (t.aspectNames[o.value] || o.value) : (t.modeNames[o.value] || o.value);
      }
      c.select.value = w?.value;
    }
    const sec = e.controls.duration, sh = e.controls.sharp;
    sec.range.value = W(node, "seconds")?.value ?? 5;
    sec.val.textContent = sec.human(Number(sec.range.value), t);
    sh.range.value = W(node, "sharpness")?.value ?? 1;
    sh.val.textContent = sh.human(Number(sh.range.value), t);
    const ws = e.controls.widthSlider, hs = e.controls.heightSlider;
    ws.label.textContent = t.width;
    hs.label.textContent = t.height;
    for (const c of [ws, hs]) {
      const v = Number(W(node, c.name)?.value || 0);
      c.range.value = v || c.range.min;
      c.val.textContent = `${c.range.value} px`;
    }

    for (const [key, slot] of Object.entries(e.frameEls)) {
      const value = W(node, slot.widgetName)?.value || NONE;
      slot.cap.textContent = t[key] + (value === NONE ? "" : " · " + value.split("/").pop());
      const url = frameUrl(value);
      if (slot.img.getAttribute("src") !== url) slot.img.src = url;
      if (url) fitFrameTile(slot);
      else slot.tile.style.removeProperty("--nh-frame-h");
      slot.img.style.opacity = url ? "1" : "0";
    }

    const after = W(node, "control_after_generate");
    if (after) {
      const vals = after.options?.values || ["fixed", "increment", "decrement", "randomize"];
      if (e.afterSel.options.length !== vals.length) {
        e.afterSel.innerHTML = "";
        for (const v of vals) {
          const o = document.createElement("option");
          o.value = v;
          e.afterSel.appendChild(o);
        }
      }
      for (const o of e.afterSel.options) o.textContent = t.afterNames[o.value] || o.value;
      e.afterSel.value = after.value;
      e.afterSel.onchange = () => setw(node, "control_after_generate", e.afterSel.value);
      e.afterSpan.textContent = t.after;
    }
    e.seedSpan.textContent = t.seed;
    if (document.activeElement !== e.seedInput) e.seedInput.value = W(node, "seed")?.value ?? 0;

    e.widthRow.style.display = manualSize ? "" : "none";
    e.heightRow.style.display = e.widthRow.style.display;
    e.sizeBox.checked = manualSize;
    e.previewBox.checked = !!W(node, "previews")?.value;
    for (const key of ["width", "height", "steps", "file"]) {
      const c = e.controls[key];
      if (!c) continue;
      c.label.textContent = key === "file" ? t.file : t[key];
      if (document.activeElement !== c.input) c.input.value = W(node, c.name)?.value ?? "";
    }
    const modelRows = [
      ["mainModel", t.mainModel], ["textTurbo", t.textTurbo],
      ["textPower", t.textPower], ["videoVae", t.videoVae],
      ["audioVae", t.audioVae], ["turboLora", t.turboLora],
    ];
    for (const [key, label] of modelRows) {
      const c = e.controls[key];
      if (!c) continue;
      c.label.textContent = label;
      const w = W(node, c.name);
      fillSelect(c.select, w?.options?.values || w?.options?.options || []);
      c.select.value = w?.value ?? AUTO;
    }
    const tw = e.controls.turboWeight;
    if (tw) {
      tw.label.textContent = t.turboWeight;
      tw.range.value = W(node, tw.name)?.value ?? 1;
      tw.val.textContent = Number(tw.range.value).toFixed(2);
    }
    for (let i = 1; i <= 5; i++) {
      const on = e.controls[`lora${i}On`];
      const name = e.controls[`lora${i}Name`];
      const weight = e.controls[`lora${i}Weight`];
      if (!on || !name || !weight) continue;
      on.input.checked = !!W(node, on.name)?.value;
      const w = W(node, name.name);
      fillSelect(name.select, w?.options?.values || w?.options?.options || []);
      name.select.value = w?.value ?? NONE;
      weight.range.value = W(node, weight.name)?.value ?? 1;
      weight.val.textContent = Number(weight.range.value).toFixed(2);
      const dim = on.input.checked ? "1" : ".55";
      name.select.style.opacity = dim;
      weight.range.style.opacity = dim;
      weight.val.style.opacity = dim;
    }
    const why = onBus ? t.busNote : "";
    e.note.textContent = why;
    e.note.style.display = why ? "" : "none";
    e.expBox.style.display = W(node, "expert")?.value ? "" : "none";
    renderBoard();
    fit();
  }
  node.__nhPaint = paint;
  paint();
}

function hookClock() {
  if (CLOCK_HOOKED) return;
  CLOCK_HOOKED = true;
  api.addEventListener("execution_start", () => {
    for (const n of ourNodes()) {
      n.__nhBoard = [];
      n.__nhRenderBoard?.();
      n.__nhLastStatus = "";
      if (n.__nhEls) {
        n.__nhEls.fill.style.width = "3%";
        n.__nhEls.fill.classList.remove("err");
        n.__nhEls.progR.textContent = "";
      }
    }
  });
  api.addEventListener("execution_success", () => {
    for (const n of ourNodes()) {
      if (!n.__nhEls) continue;
      n.__nhEls.fill.style.width = "100%";
      n.__nhEls.fill.classList.remove("err");
      n.__nhEls.progR.textContent = T(n).done;
    }
  });
  api.addEventListener("execution_error", () => {
    for (const n of ourNodes()) {
      if (!n.__nhEls) continue;
      n.__nhEls.fill.classList.add("err");
      n.__nhEls.progR.textContent = T(n).error;
    }
  });
}

api.addEventListener("neron_h3_status", (event) => {
  const d = event.detail || {};
  const node = ourNodes().find((n) => String(n.id) === String(d.id));
  if (!node || !node.__nhEls) return;
  hookClock();
  const e = node.__nhEls;
  e.progR.textContent = d.text || "";
  node.__nhLastStatus = d.text || "";
  if (d.pct != null) e.fill.style.width = Math.max(2, Math.min(100, Number(d.pct))) + "%";
  if (d.image) {
    node.__nhBoard.push("data:image/jpeg;base64," + d.image);
    e.renderBoard?.();
    node.__nhRenderBoard?.();
  }
});

function setupNode(node) {
  if (node.__nhReady) return;
  node.__nhReady = true;
  buildPanel(node);
  applyTheme();
}

app.registerExtension({
  name: "Neron.H3Engine",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE) return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = created ? created.apply(this, arguments) : undefined;
      setupNode(this);
      return r;
    };
    const configured = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = configured ? configured.apply(this, arguments) : undefined;
      setupNode(this);
      this.__nhPaint?.();
      applyTheme();
      return r;
    };
    const removed = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      const r = removed ? removed.apply(this, arguments) : undefined;
      queueMicrotask(applyTheme);
      return r;
    };
  },
  async setup() {
    hookClock();
    setInterval(applyTheme, 1000);
    applyTheme();
    for (const n of ourNodes()) setupNode(n);
  },
});
