// 🖼 Neron Image — общий вид Neron: панель с RU/EN, эксперт, ход работы и окно моделей.
// Генерация, закачка и раскладка моделей не тронуты: node.py / engine.py / downloader.py работают как раньше.
// Всё видимое живёт здесь и целиком переключается одним нажатием RU / EN.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { BUILTIN, normalizeTheme } from "./nts_core.js";
import { setCurrent, registerType } from "./nts_engine.js";

const NODE = "NeronImage";
const THEME_NODE = "NeronThemeStudio";   // тема вшита в процесс и говорит на том же языке
const ROUTE = "/neron_image";
const EVENT_PROGRESS = "neron_image.progress";
const EVENT_DOWNLOAD = "neron_image.download";
const LANG_KEY = "neron-image-lang";
const DESK_LANG_KEY = "neron-studio-lang";
const NAMED = "neron_values";
const NOTE_FLAG = "ni_note";
const PROMPT_FLAG = "ni_prompt";
const TITLE_RU = "🖼 Neron Image — картинка";
const TITLE_EN = "🖼 Neron Image — text to image";
const TITLE_ALIASES = new Set(["🖼 Neron Image / Картинка (Krea 2)", TITLE_RU, TITLE_EN]);
const nodeTitle = () => (LANG === "RU" ? TITLE_RU : TITLE_EN);

// ============================================================
//  ЯЗЫК
// ============================================================
const UI = {
    RU: {
        expert: "⚙ эксперт", help: "📖 справка",
        prompt: "ЧТО НАРИСОВАТЬ", promptHint: "Своими словами — можно по-русски",
        promptPh: "Например: рыжий кот-астронавт в стеклянном шлеме на фоне Земли, 3D мультфильм",
        bigEditor: "📝 Большой редактор",
        prompter: "АВТОПРОМТЕР", prompterHint: "Допишет то, чего ты не написал: ткани, свет, детали, место",
        frame: "КАДР", aspect: "Форма кадра", quality: "Качество",
        sharpness: "Резкость", sharpHint: "1.0 — проверенное значение; портрет — меньше",
        variant: "ВАРИАНТ", seed: "Номер картинки", after: "После запуска",
        count: "Картинок за раз", countHint: "На 2K лучше по одной",
        sampling: "РИСОВАНИЕ", steps: "Шаги", cfg: "CFG", sampler: "Сэмплер", scheduler: "Расписание",
        prompterFine: "ПРОМПТЕР", instruction: "Своя инструкция", promptVariant: "Вариант промпта", creativity: "Фантазия",
        style: "СТИЛЬ", styleLora: "Стиль (LoRA)", styleStrength: "Сила стиля",
        modelsFine: "МОДЕЛИ И ПАМЯТЬ", keepLoaded: "Держать модели в памяти",
        unet: "Модель Krea 2", clip: "Текстовый энкодер", vae: "VAE",
        progress: "ХОД РАБОТЫ", idle: "Ждёт запуска.", waiting: "ждёт своей очереди",
        elapsed: "прошло", left: "осталось ~", done: "✅ Готово за", error: "❌ Ошибка — подробности в консоли",
        step: "шаг", sec: "с",
        final: "ИТОГОВЫЙ ПРОМПТ", finalPh: "Здесь появится промпт, который ушёл в модель.",
        editFinal: "✏ Править итоговый промпт",
        models: "📥 Модели", modelsOk: "✅ Модели на месте", modelsBusy: "⏬ Качаю модели…",
        modelsNeed: (m, n) => `📥 Скачать модели (нет ${m} из ${n})`,
        reset: "🔄 Сбросить настройки", themeCycle: "🎨 Сменить оформление", close: "Закрыть", cancel: "Отмена", save: "✅ Сохранить",
        stop: "⏹ Остановить", resume: "⏬ Докачать", downloadPack: "⏬ Скачать пакет",
        wiredSize: "Провода width + height подключены — форма кадра и качество не работают.",
        wiredPrompt: "Промпт идёт проводом — поле «что нарисовать» не работает.",
        expertNote: "Здесь только тонкие настройки. Для обычной работы не нужны.",
        words: (n) => `${n} слов`, chars: (n) => `${n} знаков`,
    },
    EN: {
        expert: "⚙ expert", help: "📖 help",
        prompt: "WHAT TO DRAW", promptHint: "In your own words — any language works",
        promptPh: "For example: a ginger cat astronaut in a glass helmet, Earth behind, 3D cartoon",
        bigEditor: "📝 Big editor",
        prompter: "AUTO-PROMPTER", prompterHint: "Fills in what you did not write: fabrics, light, details, setting",
        frame: "FRAME", aspect: "Aspect ratio", quality: "Quality",
        sharpness: "Sharpness", sharpHint: "1.0 is tested; portraits — less",
        variant: "VARIANT", seed: "Picture number", after: "After run",
        count: "Pictures per run", countHint: "At 2K, one at a time is best",
        sampling: "SAMPLING", steps: "Steps", cfg: "CFG", sampler: "Sampler", scheduler: "Scheduler",
        prompterFine: "PROMPTER", instruction: "Custom instruction", promptVariant: "Prompt variant", creativity: "Creativity",
        style: "STYLE", styleLora: "Style (LoRA)", styleStrength: "Style strength",
        modelsFine: "MODELS AND MEMORY", keepLoaded: "Keep models loaded",
        unet: "Krea 2 model", clip: "Text encoder", vae: "VAE",
        progress: "PROGRESS", idle: "Waiting for a run.", waiting: "waiting in queue",
        elapsed: "elapsed", left: "left ~", done: "✅ Done in", error: "❌ Error — see the console",
        step: "step", sec: "s",
        final: "FINAL PROMPT", finalPh: "The prompt sent to the model appears here.",
        editFinal: "✏ Edit final prompt",
        models: "📥 Models", modelsOk: "✅ Models are ready", modelsBusy: "⏬ Getting models…",
        modelsNeed: (m, n) => `📥 Download models (${m} of ${n} missing)`,
        reset: "🔄 Reset settings", themeCycle: "🎨 Change look", close: "Close", cancel: "Cancel", save: "✅ Save",
        stop: "⏹ Stop", resume: "⏬ Resume", downloadPack: "⏬ Download pack",
        wiredSize: "width + height wires are connected — aspect and quality are ignored.",
        wiredPrompt: "A prompt wire is connected — the «what to draw» field is ignored.",
        expertNote: "Fine settings only. Not needed for ordinary work.",
        words: (n) => `${n} words`, chars: (n) => `${n} characters`,
    },
};

function initialLang() {
    try {
        const own = localStorage.getItem(LANG_KEY);
        if (own === "RU" || own === "EN") return own;
        const desk = localStorage.getItem(DESK_LANG_KEY);
        if (desk === "ru" || desk === "en") return desk === "ru" ? "RU" : "EN";
        const loc = app.ui?.settings?.getSettingValue?.("Comfy.Locale") || navigator.language || "";
        return String(loc).toLowerCase().startsWith("ru") ? "RU" : "EN";
    } catch (_) { return "RU"; }
}
let LANG = initialLang();
const T = () => UI[LANG];
const L = (ru, en) => (LANG === "RU" ? ru : en);

// «⬜ 1:1 квадрат / square» → только нужная половина
function pick(value) {
    const s = String(value ?? "");
    const system = {
        fixed: L("фиксированный", "fixed"), increment: L("увеличить", "increment"),
        decrement: L("уменьшить", "decrement"), randomize: L("случайно", "randomize"),
    };
    if (Object.prototype.hasOwnProperty.call(system, s)) return system[s];
    const mark = s.indexOf("\n\nEN:");
    const src = mark >= 0 ? (LANG === "RU" ? s.slice(0, mark) : s.slice(mark + 5)) : s;
    const parts = src.split(" / ");
    if (parts.length < 2) return src.trim();
    const clean = (x) => x.trim().replace(/^\s*[—-]+\s*|\s*[—-]+\s*$/g, "");
    return LANG === "RU" ? clean(parts[0]) : clean(parts[parts.length - 1]);
}

const NODES = new Set();
const DIALOGS = new Set();
function setLang(v) {
    if (v !== "RU" && v !== "EN") return;
    LANG = v;
    try {
        localStorage.setItem(LANG_KEY, v);
        localStorage.setItem(DESK_LANG_KEY, v.toLowerCase());   // чтобы весь стол говорил на одном языке
    } catch (_) {}
    for (const n of NODES) {
        try { if (!n.title || TITLE_ALIASES.has(n.title)) n.title = nodeTitle(); } catch (_) {}
        try { n.__niPaint?.(); } catch (_) {}
    }
    for (const d of DIALOGS) { try { d.render?.(); } catch (_) {} }
    for (const n of (app.graph?._nodes || [])) {
        if ((n.type || n.comfyClass) !== THEME_NODE) continue;
        try { n.title = L("🎨 Тема", "🎨 Theme"); } catch (_) {}
        try { n.__ntsReload?.(); } catch (_) {}   // панель тем перекрасится на выбранном языке
    }
    syncNotes();
    refreshButtons();
}

// ============================================================
//  ТЕМА: одна панель оформления, одна тема, один язык
// ============================================================
function themeNode() {
    return (app.graph?._nodes || []).find((n) => (n.type || n.comfyClass) === THEME_NODE) || null;
}
function themeState(n) {
    const w = (n?.widgets || []).find((x) => x.name === "theme_json");
    if (!w) return null;
    try { return JSON.parse(w.value) || null; } catch (_) { return null; }
}
// Оформление принадлежит тому процессу, который открыт на холсте. Как только ноды темы
// на открытом процессе нет (перешли в другую схему), снимаем краску — чужие процессы
// должны оставаться в своём обычном виде. Две проверки подряд — чтобы не мигало при загрузке.
let themeApplied = false;
let themeMisses = 0;
function applyTheme() {
    const st = themeState(themeNode());
    if (!st?.theme) {
        themeMisses++;
        if (themeApplied && themeMisses >= 2) {
            themeApplied = false;
            try { setCurrent(null); } catch (_) {}
        }
        return;
    }
    themeMisses = 0;
    try {
        setCurrent(normalizeTheme(st.theme));
        themeApplied = true;
    } catch (_) {}
}
setTimeout(applyTheme, 300);
setInterval(applyTheme, 600);

let themeCursor = -1;
function cycleTheme() {
    const n = themeNode();
    const w = (n?.widgets || []).find((x) => x.name === "theme_json");
    if (!n || !w || !BUILTIN.length) return;
    const st = themeState(n) || { v: 1, tab: "install" };
    let i = BUILTIN.findIndex((t) => t.id === st.theme?.id);
    if (i < 0) i = themeCursor;
    i = (i + 1) % BUILTIN.length;
    themeCursor = i;
    st.theme = BUILTIN[i];
    try { w.value = JSON.stringify(st); } catch (_) {}
    applyTheme();
}

// ============================================================
//  СПРАВКА И ЗАМЕТКИ
// ============================================================
const HELP_RU = `🖼 NERON IMAGE — КАРТИНКА ПО ТЕКСТУ

ЧТО ДЕЛАЕТ
Рисует картинку по твоему описанию на Krea 2 Turbo. Модели официальные. Пиши как хочешь, хоть по-русски: встроенный промптер переведёт и допишет детали.

КАК
1. Напиши, что нарисовать. Слова, которые должны быть НА картинке, — в кавычках. Длинный текст — кнопка «Большой редактор».
2. Выбери форму кадра и качество. 2K — максимум, это честный предел модели, а не нехватка памяти.
3. Нажми кнопку запуска. В готовом процессе результат сразу сохраняется.
4. Внизу ноды — итоговый промпт: что на самом деле ушло в модель.

АВТОПРОМТЕР
• до мелочей — твои слова остаются первыми, остальное промптер придумывает конкретно;
• расписать — сдержанно, по официальной инструкции Krea;
• подправить — только перевод и лёгкая правка;
• как есть — текст уходит без изменений (пиши по-английски).
Тот же текст и режим второй раз не переписывается: «вариант» меняет только картинку.

КОГДА ПРОМПТЕР НЕ СПРАВИТСЯ
Он маленький. Один-два героя, пейзаж, предмет, механизм — отлично. Много персонажей, каждого надо описать отдельно — ему не по силам. Напиши промпт сам или попроси большую ИИ, затем поставь «как есть». В готовом процессе есть зелёная нода с примером такого промпта — она не подключена нарочно.

РЕЗКОСТЬ
1.0 — по умолчанию. Крупный портрет — 0.5–0.8, пейзаж и техника — 1.0–1.3.

⚙ ЭКСПЕРТ
Шаги, CFG, сэмплер, настройки промптера, стиль, выбор файлов моделей, «держать модели». Обычно менять не нужно.

МОДЕЛИ
Кнопка «Модели» сама покажет, чего не хватает, скачает и разложит по папкам Comfy Desktop. Уже лежащее не трогает, оборванную закачку продолжает с того места. Ничего указывать руками не надо.`;

const HELP_EN = `🖼 NERON IMAGE — TEXT TO IMAGE

WHAT IT DOES
Draws a picture from your description with Krea 2 Turbo. The models are official. Write in any language: the built-in prompter translates and fills in the details.

HOW
1. Write what to draw. Words that must appear IN the picture go in quotes. For a long text, use «Big editor».
2. Choose the aspect and quality. 2K is the model's honest maximum, not a memory limit.
3. Press Run. In the ready workflow the result is saved automatically.
4. The bottom of the node shows the final prompt — what actually went to the model.

AUTO-PROMPTER
• every detail — your words stay first, the rest is filled in concretely;
• expand — restrained, the official Krea instruction;
• polish — translation and a light touch only;
• as is — the text goes unchanged (write in English).
The same text and mode are not re-written: «seed» only changes the picture.

WHEN THE PROMPTER FALLS SHORT
It is small. One or two characters, a landscape, an object, a machine — fine. Many characters, each needing its own description — beyond it. Write the prompt yourself or ask a large AI, then choose «as is». The ready workflow has a green node with such an example; it is intentionally disconnected.

SHARPNESS
1.0 by default. Close-up portrait — 0.5–0.8; landscapes and machines — 1.0–1.3.

⚙ EXPERT
Steps, CFG, sampler, prompter settings, style, model files, keep models loaded. Usually you do not need to touch them.

MODELS
The «Models» button shows what is missing, downloads it and puts it into the right Comfy Desktop folders. It leaves existing files alone and resumes an interrupted download. You do not have to set anything by hand.`;

const NOTE_RU = `🖼 NERON IMAGE — готовый процесс

1. «📥 Модели» — если чего-то не хватает, нода скачает сама и разложит по папкам. Уже лежащее не трогает.
2. Напиши, что нарисовать — можно по-русски. Нажми кнопку запуска.
3. Внизу ноды видно итоговый промпт — что ушло в модель.

ЗЕЛЁНАЯ НОДА С ПРИМЕРОМ НЕ ПОДКЛЮЧЕНА НАРОЧНО.
Это образец подробного промпта для сложной сцены. Чтобы нарисовать его:
• соедини выход STRING со входом prompt_text у Neron Image;
• автопромтер — «как есть»;
• форма кадра 16:9, качество 2K, резкость 0.6–0.8.
Свой промпт пиши в зелёной ноде вместо примера. Убери провод — снова работает поле «что нарисовать».`;

const NOTE_EN = `🖼 NERON IMAGE — ready workflow

1. «📥 Models» — if anything is missing, the node downloads it and puts it in the right folders. Existing files are left alone.
2. Write what to draw — any language works. Press Run.
3. The bottom of the node shows the final prompt sent to the model.

THE GREEN EXAMPLE NODE IS INTENTIONALLY DISCONNECTED.
It holds a detailed prompt for a complex scene. To draw it:
• connect its STRING output to the prompt_text input of Neron Image;
• set the prompter to «as is»;
• aspect 16:9, quality 2K, sharpness 0.6–0.8.
Write your own prompt in the green node instead. Remove the wire to use the «what to draw» field again.`;

function syncNotes() {
    const g = app.graph;
    if (!g?._nodes) return;
    for (const n of g._nodes) {
        if (n.properties?.[NOTE_FLAG] && Array.isArray(n.widgets_values)) {
            n.widgets_values[0] = LANG === "RU" ? NOTE_RU : NOTE_EN;
        }
        if (n.properties?.[PROMPT_FLAG]) {
            n.title = L("📝 Пример большого промпта", "📝 Big prompt example");
        }
        if (n.type === NODE && (!n.title || TITLE_ALIASES.has(n.title))) n.title = nodeTitle();
    }
    try { g.setDirtyCanvas(true, true); } catch (_) {}
}

function showHelp() {
    const overlay = el("div", "ni-help");
    const box = el("div", "ni-help-box");
    const close = el("button", "ni-help-close", "✕");
    close.title = T().close;
    close.onclick = () => overlay.remove();
    const text = el("div", "ni-help-text", LANG === "RU" ? HELP_RU : HELP_EN);
    box.append(close, text);
    overlay.appendChild(box);
    overlay.onclick = (e) => { if (e.target === overlay) closeHelp(); };
    document.body.appendChild(overlay);
    const rec = { render: () => { text.textContent = LANG === "RU" ? HELP_RU : HELP_EN; close.title = T().close; } };
    function closeHelp() { overlay.remove(); DIALOGS.delete(rec); }
    close.onclick = closeHelp;
    DIALOGS.add(rec);
}

// ============================================================
//  ОФОРМЛЕНИЕ
// ============================================================
const CSS = `
.ni{box-sizing:border-box;width:100%;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#e7eef7;padding:2px 2px 6px}
.ni *{box-sizing:border-box}
.ni-bar{display:flex;gap:6px;align-items:center;margin-bottom:9px;flex-wrap:wrap}
.ni-pill{background:#262d38;border:1px solid #55606f;border-radius:14px;padding:3px 11px;font-size:12px;color:#c3ccd8;cursor:pointer;user-select:none}
.ni-pill:hover{border-color:#8aa0b8;color:#fff}
.ni-pill.on{background:#3d5a80;border-color:#78a3d4;color:#fff}
.ni-sp{flex:1}
.ni-sec{margin-bottom:9px}
.ni-lab{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:4px}
.ni-lab b{color:#f2f6fb;font-weight:600;letter-spacing:.3px;font-size:12px}
.ni-lab i{color:#93a2b4;font-style:normal;font-size:11.5px;text-align:right}
.ni select,.ni input{background:#1d2634;color:#e9f0fa;border:1px solid #46566b;border-radius:6px;padding:5px 8px;font:12.5px "Segoe UI",Arial,sans-serif;width:100%}
.ni textarea{background:#101a2b;color:#e8f1ff;border:1px solid #334c72;border-radius:7px;padding:8px 10px;font:13px/1.5 "Segoe UI",Arial,sans-serif;width:100%;resize:vertical;outline:none}
.ni .ni-prompt{min-height:76px}
.ni .ni-final{min-height:82px;font-size:12px}
.ni-btn{background:#2f4561;color:#fff;border:1px solid #52749b;border-radius:6px;padding:5px 11px;cursor:pointer;font:12px "Segoe UI",Arial,sans-serif;margin-top:5px}
.ni-btn:hover{background:#3b567a}
.ni-btn.main{background:#2a7fc4;border-color:#4fa5e0;font-weight:600;width:100%;padding:8px;margin-top:4px}
.ni-btn.warn{background:#7a3c3c;border-color:#a55a5a}
.ni-row{display:flex;gap:7px;align-items:center;margin-bottom:4px}
.ni-row>span{color:#a9b8c9;font-size:12px;min-width:96px}
.ni-row>input,.ni-row>select{flex:1}
.ni-check{display:flex;gap:8px;align-items:center;color:#c4d0de;font-size:12.5px;cursor:pointer;margin:4px 0}
.ni-check input{width:auto}
.ni-exp{background:#222b38;border:1px solid #4a4b3d;border-radius:7px;padding:8px 10px;margin:6px 0 9px}
.ni-exp h4{margin:7px 0 4px;font-size:11.5px;color:#f0cd8a;font-weight:600;letter-spacing:.4px}
.ni-note{font-size:11.5px;color:#e0b98a;background:#2c261c;border:1px solid #615338;border-radius:6px;padding:6px 9px;margin:5px 0}
.ni-prog{background:#18212d;border:1px solid #36516f;border-radius:8px;padding:8px 10px}
.ni-stages{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:7px}
.ni-stage{font-size:11px;padding:2px 8px;border-radius:10px;background:#263040;color:#8291a2;border:1px solid #33435a}
.ni-stage.now{background:#3d5a80;color:#fff;border-color:#78a3d4}
.ni-stage.ok{background:#25402a;color:#bfe3bf;border-color:#4d7a4d}
.ni-track{height:12px;border-radius:6px;background:#101822;border:1px solid #2b3a4f;overflow:hidden}
.ni-fill{height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#2f7d4f,#5fd09a);transition:width .5s}
.ni-fill.err{background:linear-gradient(90deg,#7d2f2f,#c95b5b)}
.ni-pt{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:#cfe0f5;margin-top:5px}
.ni-pt span:last-child{color:#93a2b4}
.ni-help{position:fixed;inset:0;background:#000a;z-index:100000;display:flex;align-items:center;justify-content:center}
.ni-help-box{background:#18202c;color:#e6edf6;border:1px solid #48617e;border-radius:10px;max-width:760px;width:92vw;max-height:86vh;overflow:auto;padding:16px 22px;position:relative;box-shadow:0 10px 40px #000a}
.ni-help-close{position:sticky;top:0;float:right;background:#3d5a80;color:#fff;border:0;border-radius:6px;padding:4px 12px;cursor:pointer}
.ni-help-text{white-space:pre-wrap;font:13px/1.55 "Segoe UI",Arial,sans-serif}
.ni-dlg{position:fixed;inset:0;background:#000a;z-index:100001;display:flex;align-items:center;justify-content:center}
.ni-dlg-box{background:#14202a;color:#e2eaf4;border:1px solid #3d6273;border-radius:10px;padding:18px 20px;width:min(680px,92vw);max-height:88vh;overflow:auto;font:13px/1.5 "Segoe UI",Arial,sans-serif;box-shadow:0 10px 40px #000a}
`;
let CSS_ADDED = false;
function addCss() {
    if (CSS_ADDED) return;
    CSS_ADDED = true;
    const s = document.createElement("style");
    s.id = "neron-image-common-css";
    s.textContent = CSS;
    document.head.appendChild(s);
}
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}
function button(text, cls, onClick) {
    const b = el("button", "ni-btn " + (cls || ""), text);
    b.onclick = onClick;
    return b;
}
function fmt(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (x) => String(x).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ============================================================
//  ПОЛЯ НОДЫ
// ============================================================
const W = (node, name) => node.widgets?.find((x) => x.name === name);
function comboList(w) {
    const v = w?.options?.values;
    try { return typeof v === "function" ? v(w) : v; } catch (_) { return null; }
}
function setw(node, name, value) {
    const w = W(node, name);
    if (!w) return;
    w.value = value;
    try { w.callback?.(value, app.canvas, node, [0, 0], null); } catch (_) {}
}
function linked(node, name) {
    return (node.inputs || []).some((i) => i.name === name && i.link != null);
}
function hideNative(node) {
    for (const w of node.widgets || []) {
        w.hidden = true;
        w.type = "hidden";     // иначе старый холст всё равно рисует подписи поверх панели
        w.computeSize = () => [0, -4];
    }
}

// В процессе «текст → картинка» размер задаётся внутри ноды: форма кадра + качество.
// Внешние входы размера и выход готового промпта тут не нужны — убираем их с лица.
// Если в сохранённом процессе к ним уже подключён провод, трогать не будем.
function trimSlots(node) {
    for (const name of ["width", "height"]) {
        const i = (node.inputs || []).findIndex((x) => x.name === name);
        if (i >= 0 && node.inputs[i].link == null) node.removeInput?.(i);
    }
    const o = (node.outputs || []).findIndex((x) => x.name === "prompt");
    if (o >= 0 && !(node.outputs[o].links || []).length) node.removeOutput?.(o);
}

// Провода и выходы тоже должны говорить на одном языке с панелью.
// name не трогаем — по нему Comfy передаёт значения; меняем только видимую подпись.
function syncSlotLabels(node) {
    const ins = {
        width: L("Ширина", "Width"),
        height: L("Высота", "Height"),
        prompt_text: L("Промпт проводом", "Prompt by wire"),
    };
    const outs = {
        image: L("Картинка", "Image"),
        prompt: L("Промпт", "Prompt"),
    };
    for (const i of node.inputs || []) if (ins[i.name]) i.label = ins[i.name];
    for (const o of node.outputs || []) if (outs[o.name]) o.label = outs[o.name];
}
function saneWidget(w, o) {
    if (!w || !o) return;
    if (w.type === "combo") {
        const list = comboList(w);
        if (Array.isArray(list) && list.length && !list.includes(w.value))
            w.value = ("default" in o && list.includes(o.default)) ? o.default : list[0];
        return;
    }
    if (!("default" in o)) return;
    const d = o.default;
    if (typeof d === "number") {
        const v = Number(w.value);
        if (!isFinite(v) || (o.min != null && v < o.min) || (o.max != null && v > o.max)) w.value = d;
    } else if (typeof d === "boolean") {
        if (typeof w.value !== "boolean") w.value = d;
    } else if (typeof d === "string") {
        if (typeof w.value !== "string") w.value = d;
    }
}
function namedValues(node, specs) {
    const out = {};
    for (const w of node.widgets || [])
        if (w.name && (specs[w.name] || w.name === "control_after_generate")) out[w.name] = w.value;
    return out;
}
function restoreNamed(node, specs, named) {
    for (const w of node.widgets || []) {
        if (!w.name || !(specs[w.name] || w.name === "control_after_generate")) continue;
        if (named && Object.prototype.hasOwnProperty.call(named, w.name)) w.value = named[w.name];
        saneWidget(w, specs[w.name]);
    }
}

// ============================================================
//  ХОД РАБОТЫ
// ============================================================
const CLOCK = { start: null, end: null, running: false, result: "", stage: "", i: 0, total: 0, t0: 0,
                current: null, hooked: false };
function hookClock() {
    if (CLOCK.hooked) return;
    CLOCK.hooked = true;
    api.addEventListener("execution_start", () => {
        Object.assign(CLOCK, { start: Date.now(), end: null, running: true, result: "", stage: "", i: 0, total: 0, current: null });
        repaintAll();
    });
    api.addEventListener("executing", (e) => {
        const d = e.detail;
        CLOCK.current = (d && typeof d === "object") ? (d.display_node ?? d.node) : d;
        if (!CLOCK.running) CLOCK.start = CLOCK.start || Date.now();
    });
    api.addEventListener("execution_success", () => { CLOCK.running = false; CLOCK.end = Date.now(); CLOCK.result = "ok"; repaintAll(); });
    api.addEventListener("execution_error", () => { CLOCK.running = false; CLOCK.end = Date.now(); CLOCK.result = "error"; repaintAll(); });
    api.addEventListener("execution_interrupted", () => { CLOCK.running = false; CLOCK.end = Date.now(); CLOCK.result = "stop"; repaintAll(); });
    api.addEventListener(EVENT_PROGRESS, (e) => {
        const d = e.detail || {};
        if (CLOCK.stage !== (d.stage || "")) CLOCK.t0 = Date.now();
        CLOCK.stage = d.stage || "";
        CLOCK.i = d.i || 0;
        CLOCK.total = d.total || 0;
        CLOCK.running = true;
        if (!CLOCK.start) CLOCK.start = Date.now();
        repaintAll();
    });
    api.addEventListener("progress", (e) => {
        const d = e.detail || {};
        if (!d.max || String(d.node) !== String(CLOCK.current)) return;
        if (app.graph?.getNodeById?.(d.node)?.type !== NODE) return;
        CLOCK.i = d.value; CLOCK.total = d.max;
        CLOCK.stage = CLOCK.stage || "🎨 рисую / drawing";
        repaintAll();
    });
    setInterval(() => { if (CLOCK.running) repaintAll(); }, 1000);
}
function repaintAll() {
    for (const n of NODES) { try { n.__niPaintProgress?.(); } catch (_) {} }
}

// ============================================================
//  ОКНО МОДЕЛЕЙ
// ============================================================
const DL = { status: null, hooked: false, dialog: null, autoShown: false, nodes: new Set() };
const gb = (b) => (b / 1024 ** 3).toFixed(1);
async function fetchStatus() {
    try {
        const r = await api.fetchApi(ROUTE + "/status");
        DL.status = await r.json();
    } catch (_) { DL.status = null; }
    refreshButtons();
    return DL.status;
}
function refreshButtons() {
    const s = DL.status;
    let label = T().models;
    if (s) {
        const miss = s.files.filter((f) => !f.present).length;
        const st = s.download?.state;
        if (st === "downloading" || st === "probing") label = T().modelsBusy;
        else if (miss === 0) label = T().modelsOk;
        else label = T().modelsNeed(miss, s.files.length);
    }
    for (const n of DL.nodes) {
        if (n.__niModelsBtn) n.__niModelsBtn.textContent = label;
    }
}
function hookDownload() {
    if (DL.hooked) return;
    DL.hooked = true;
    api.addEventListener(EVENT_DOWNLOAD, (e) => {
        if (DL.status) DL.status.download = e.detail || {};
        const st = e.detail?.state;
        if (st === "done") {
            try { app.refreshComboInNodes?.(); } catch (_) {}
            fetchStatus().then(() => DL.dialog?.render());
        } else { refreshButtons(); DL.dialog?.render(); }
    });
}

function openModelsDialog(greeting) {
    if (DL.dialog) { DL.dialog.render(); return; }
    const overlay = el("div", "ni-dlg");
    const box = el("div", "ni-dlg-box");
    overlay.appendChild(box);
    const close = () => { overlay.remove(); DIALOGS.delete(rec); DL.dialog = null; };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const render = () => {
        const t = T(), s = DL.status;
        box.innerHTML = "";
        box.append(el("div", "", "📥 " + pick(L("Модели для Neron Image", "Models for Neron Image"))));
        box.lastChild.style.cssText = "font:bold 17px sans-serif;margin-bottom:8px;color:#bfe9ff;";
        if (!s) {
            box.append(el("div", "", L("Не удалось узнать состояние моделей. Перезапусти ComfyUI.", "Could not read model status. Restart ComfyUI.")));
            box.lastChild.style.color = "#ff8a80";
            box.append(button(t.close, "", close));
            return;
        }
        const missing = s.files.filter((f) => !f.present);
        const d = s.download || {};
        if (greeting && missing.length) {
            const g = el("div", "", L(
                "👋 Каких-то моделей пока нет. Нажми «Скачать пакет» — нода скачает недостающее сама и разложит по папкам. Что уже лежит — не трогает.",
                "👋 Some models are missing. Press «Download pack» — the node gets what is missing and puts it in the right folders. Existing files are left alone."));
            g.style.cssText = "background:#1f3a2a;border:1px solid #3f7a52;border-radius:6px;padding:10px;margin:8px 0;white-space:pre-wrap;";
            box.append(g);
        }
        box.append(el("div", "", pick(s.pack_title || "")));
        box.lastChild.style.cssText = "font:bold 14px sans-serif;margin-top:8px;";
        const desc = el("div", "", pick(s.pack_description || ""));
        desc.style.cssText = "color:#b0bec5;white-space:pre-wrap;margin:4px 0 8px;";
        box.append(desc);
        const list = el("div", "");
        list.style.cssText = "background:#0d171e;border-radius:6px;padding:8px 12px;margin:6px 0;font:12px monospace;";
        for (const f of s.files) {
            const part = (!f.present && f.partial_bytes) ? `  (${L("скачано", "downloaded")} ${gb(f.partial_bytes)} ${L("ГБ", "GB")} — ${L("докачаю", "will resume")})` : "";
            const alt = (f.present && f.have && f.have !== f.name) ? `  (${L("есть замена", "have")}: ${f.have})` : "";
            const line = el("div", "", `${f.present ? "✅" : "❌"} ${f.name}${alt}${part}`);
            line.style.color = f.present ? "#9be7a0" : "#ffcc80";
            list.append(line);
        }
        box.append(list);
        const info = [];
        if (s.size_note) info.push(L("Объём пакета", "Pack size") + ": " + pick(s.size_note));
        if (s.free_gb != null) info.push(L("Свободно на диске", "Free disk") + ": " + s.free_gb.toFixed(0) + " " + L("ГБ", "GB"));
        if (s.vram_gb) info.push(L("Видеокарта", "GPU") + ": " + s.vram_gb.toFixed(0) + " " + L("ГБ", "GB") +
            (s.ram_gb ? ", " + L("оперативка", "RAM") + ": " + s.ram_gb.toFixed(0) + " " + L("ГБ", "GB") : ""));
        const inf = el("div", "", info.join("\n"));
        inf.style.cssText = "color:#90a4ae;white-space:pre-wrap;margin-bottom:8px;";
        box.append(inf);

        const busy = d.state === "downloading" || d.state === "probing";
        if (!missing.length) {
            const ok = el("div", "", "✅ " + L("Всё на месте! Напиши, что нарисовать, и жми кнопку запуска.", "All set! Write what to draw and press Run."));
            ok.style.cssText = "color:#9be7a0;font:bold 14px sans-serif;margin:10px 0;white-space:pre-wrap;";
            box.append(ok, button(t.close, "", close));
            return;
        }
        const needToken = missing.some((f) => f.gated) || ["gated", "no_token"].includes(d.error);
        let tokenInput = null;
        if (needToken) {
            const tok = el("div", "");
            tok.style.cssText = "border:1px solid #3d6273;border-radius:6px;padding:10px;margin:8px 0;";
            const head = el("div", "", s.token_set ? "🔑 " + L("Доступ сохранён", "Access saved") + " ✅" : "🔑 " + L("Доступ к Hugging Face — один раз", "Hugging Face sign-in — once"));
            head.style.cssText = "font:bold 13px sans-serif;margin-bottom:5px;";
            const how = el("div", "", L(
                "Это бесплатно и один раз: открой страницу модели, войди, согласись с условиями, если попросят. Потом страница токенов → создать новый токен → разрешение только на чтение → скопируй. Вставь сюда, сохрани и нажми «Докачать». Токен остаётся только на твоём компьютере.",
                "It is free and one time: open the model page, sign in, accept if asked. Then the tokens page → Create new token → Read → copy it. Paste here, save, press Resume. The token stays on your computer."));
            how.style.cssText = "color:#b0bec5;white-space:pre-wrap;";
            tok.append(head, how);
            const row = el("div", "");
            row.style.marginTop = "6px";
            row.append(button("1. " + L("Страница модели", "Model page"), "", () => window.open(s.license_url, "_blank")));
            row.append(button("2. " + L("Страница токенов", "Tokens page"), "", () => window.open(s.token_url, "_blank")));
            tok.append(row);
            if (!s.token_from_env) {
                const r2 = el("div", "");
                r2.style.cssText = "display:flex;gap:6px;align-items:center;margin-top:5px;";
                tokenInput = el("input");
                tokenInput.type = "password";
                tokenInput.placeholder = s.token_set ? L("токен уже сохранён", "token saved") : "hf_…";
                r2.append(tokenInput, button("3. " + t.save, "", async () => {
                    const v = tokenInput.value.trim();
                    if (!v) return;
                    await api.fetchApi(ROUTE + "/token", { method: "POST", body: JSON.stringify({ token: v }) });
                    await fetchStatus(); render();
                }));
                tok.append(r2);
            }
            box.append(tok);
        }
        if (busy || d.state === "error" || d.state === "cancelled") {
            const p = el("div", ""); p.style.margin = "8px 0";
            if (busy) {
                const pct = d.total ? Math.min(100, d.done / d.total * 100) : 0;
                p.append(el("div", "", d.state === "probing" ? L("Проверяю файлы…", "Checking files…") :
                    `${L("Файл", "File")} ${d.file_i} ${L("из", "of")} ${d.files_n}: ${d.file}`));
                const bar = el("div", "");
                bar.style.cssText = "height:14px;background:#0d171e;border-radius:7px;overflow:hidden;margin:6px 0;";
                const fill = el("div", "");
                fill.style.cssText = `height:100%;width:${pct.toFixed(1)}%;background:linear-gradient(90deg,#2a8fc4,#5fd0ff);`;
                bar.append(fill); p.append(bar);
                p.append(el("div", "", `${gb(d.done)} / ${gb(d.total)} ${L("ГБ", "GB")} · ${pct.toFixed(1)}% · ${(d.speed || 0).toFixed(1)} ${L("МБ/с", "MB/s")}` +
                    (d.speed > 0 ? ` · ≈ ${L("осталось", "left")} ${fmt((d.total - d.done) / (d.speed * 1024 * 1024) * 1000)}` : "")));
                p.append(el("div", "", L("Окно можно закрыть — скачивание продолжится.", "You can close this window — the download continues.")));
            } else {
                const err = el("div", "", pick(d.message || L("Ошибка", "Error")));
                err.style.cssText = "color:#ff8a80;white-space:pre-wrap;background:#2a1414;border-radius:6px;padding:8px 10px;";
                p.append(err);
            }
            box.append(p);
        }
        const row = el("div", ""); row.style.marginTop = "10px";
        if (busy) {
            row.append(button(t.stop, "warn", async () => {
                await api.fetchApi(ROUTE + "/cancel", { method: "POST", body: "{}" });
            }));
        } else {
            const resume = s.files.some((f) => !f.present && f.partial_bytes);
            row.append(button(resume ? t.resume : t.downloadPack, "", async () => {
                if (needToken && !s.token_set && tokenInput && tokenInput.value.trim()) {
                    await api.fetchApi(ROUTE + "/token", { method: "POST", body: JSON.stringify({ token: tokenInput.value.trim() }) });
                }
                await api.fetchApi(ROUTE + "/download", { method: "POST", body: JSON.stringify({ pack: s.pack_id }) });
                await fetchStatus(); render();
            }));
        }
        row.append(button(t.close, "", close));
        box.append(row);
    };

    const rec = { render };
    DIALOGS.add(rec);
    DL.dialog = rec;
    document.body.append(overlay);
    fetchStatus().then(render);
    render();
}

// ============================================================
//  БОЛЬШОЙ РЕДАКТОР ПРОМПТА
// ============================================================
function openEditor(node) {
    const tw = W(node, "text");
    if (!tw) return;
    const t = T();
    const overlay = el("div", "ni-dlg");
    const box = el("div", "ni-dlg-box");
    box.style.cssText += "width:min(1000px,94vw);height:min(760px,88vh);display:flex;flex-direction:column;gap:9px;";
    box.append(el("div", "", "📝 " + (L("Промпт целиком", "The whole prompt"))));
    box.lastChild.style.cssText = "font:bold 16px sans-serif;color:#bfe0ff;";
    box.append(el("div", "", L(
        "Пиши свободно, абзацами. Ctrl+Enter — сохранить, Esc — отмена. Свой готовый промпт — ставь автопромтер «как есть».",
        "Write freely, in paragraphs. Ctrl+Enter — save, Esc — cancel. For your own finished prompt choose the «as is» prompter.")));
    box.lastChild.style.color = "#93a2b4";
    const ta = el("textarea");
    ta.style.cssText = "flex:1;width:100%;box-sizing:border-box;resize:none;background:#0b1320;color:#e8f0ff;border:1px solid #334c72;border-radius:8px;padding:14px;font:15px/1.6 sans-serif;outline:none;";
    ta.value = tw.value || "";
    const count = el("div", "");
    count.style.cssText = "color:#8291a2;font:12px monospace;";
    const upd = () => {
        const s = ta.value.trim();
        count.textContent = `${t.words(s ? s.split(/\s+/).length : 0)} · ${t.chars(ta.value.length)}`;
    };
    ta.addEventListener("input", upd); upd();
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey, true); DIALOGS.delete(rec); };
    const save = () => {
        setw(node, "text", ta.value);
        node.__niPaint?.();
        close();
    };
    const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); save(); }
    };
    document.addEventListener("keydown", onKey, true);
    const foot = el("div", ""); foot.style.cssText = "display:flex;gap:8px;align-items:center;";
    foot.append(count, button(t.cancel, "", close), button(t.save, "", save));
    box.append(ta, foot);
    overlay.append(box);
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.body.append(overlay);
    const rec = { render: () => {} };
    DIALOGS.add(rec);
    setTimeout(() => ta.focus(), 30);
}

// ============================================================
//  ПАНЕЛЬ НОДЫ
// ============================================================
function buildPanel(node, specs) {
    addCss();
    hookClock();
    hookDownload();
    hideNative(node);
    trimSlots(node);
    const root = el("div", "ni"), inner = el("div");
    root.appendChild(inner);
    for (const ev of ["pointerdown", "mousedown", "wheel", "keydown", "contextmenu"]) {
        root.addEventListener(ev, (e) => {
            if (e.target.closest("select,input,textarea,button")) e.stopPropagation();
        }, { passive: true });
    }

    // верхняя панель
    const bar = el("div", "ni-bar");
    const ru = el("span", "ni-pill", "RU"), en = el("span", "ni-pill", "EN");
    const exp = el("span", "ni-pill"), hlp = el("span", "ni-pill");
    bar.append(ru, en, el("span", "ni-sp"), exp, hlp);
    inner.appendChild(bar);
    ru.onclick = () => setLang("RU");
    en.onclick = () => setLang("EN");
    hlp.onclick = () => showHelp();
    exp.onclick = () => { setw(node, "expert", W(node, "expert")?.value !== true); node.__niPaint?.(); };

    const ctl = [];   // [имя поля, элемент, подпись, ключ словаря]
    function field(parent, key, name, kind) {
        const w = W(node, name);
        if (!w) return null;
        let input, label = null;
        if (kind === "check") {
            const wrap = el("label", "ni-check");
            input = document.createElement("input"); input.type = "checkbox";
            label = el("span");
            input.onchange = () => setw(node, name, input.checked);
            wrap.append(input, label); parent.append(wrap);
        } else if (w.type === "combo" || Array.isArray(comboList(w))) {
            input = document.createElement("select");
            const vals = [...(comboList(w) || [])];
            if (w.value != null && !vals.includes(w.value)) vals.unshift(w.value);
            for (const v of vals) {
                const o = document.createElement("option");
                o.value = v; o.textContent = pick(v);
                input.appendChild(o);
            }
            input.onchange = () => setw(node, name, input.value);
            parent.append(input);
        } else {
            input = document.createElement("input");
            input.type = "number";
            if (w.options?.min != null) input.min = w.options.min;
            if (w.options?.max != null) input.max = w.options.max;
            input.step = w.options?.step ?? (Number.isInteger(w.value) ? 1 : 0.05);
            input.onchange = () => {
                const v = Number(input.value);
                if (isFinite(v)) setw(node, name, v);
                input.value = W(node, name)?.value;
            };
            parent.append(input);
        }
        ctl.push([name, input, label, key]);
        return input;
    }
    function row(parent, key, name) {
        const r = el("div", "ni-row");
        const s = el("span");
        r.append(s);
        const input = field(r, key, name);
        parent.append(r);
        if (input) ctl[ctl.length - 1][2] = s;
        return input;
    }

    // что нарисовать
    const promptSec = el("div", "ni-sec");
    const [promptB, promptI] = (() => {
        const r = el("div", "ni-lab"), b = el("b"), i = el("i");
        r.append(b, i); promptSec.append(r);
        return [b, i];
    })();
    const promptArea = el("textarea", "ni-prompt");
    promptArea.spellcheck = false;
    promptArea.oninput = () => {
        const w = W(node, "text");
        if (w) w.value = promptArea.value;
    };
    promptSec.append(promptArea);
    const editorBtn = button("", "", () => openEditor(node));
    promptSec.append(editorBtn);
    inner.appendChild(promptSec);

    // автопромтер
    const autSec = el("div", "ni-sec");
    const autLab = el("div", "ni-lab"), autB = el("b"), autI = el("i");
    autLab.append(autB, autI); autSec.append(autLab);
    field(autSec, "prompter", "prompter");
    inner.append(autSec);

    // кадр
    const frameSec = el("div", "ni-sec");
    const frameLab = el("div", "ni-lab"), frameB = el("b"), frameI = el("i");
    frameLab.append(frameB, frameI); frameSec.append(frameLab);
    const aspectRow = row(frameSec, "aspect", "aspect");
    const qualityRow = row(frameSec, "quality", "quality");
    const sharpRow = row(frameSec, "sharpness", "sharpness");
    inner.append(frameSec);

    // вариант
    const varSec = el("div", "ni-sec");
    const varLab = el("div", "ni-lab"), varB = el("b"), varI = el("i");
    varLab.append(varB, varI); varSec.append(varLab);
    const seedRow = row(varSec, "seed", "seed");
    const afterRow = row(varSec, "after", "control_after_generate");
    inner.append(varSec);

    // ход работы
    const progSec = el("div", "ni-sec");
    const progLab = el("div", "ni-lab"), progB = el("b");
    progLab.append(progB); progSec.append(progLab);
    const prog = el("div", "ni-prog");
    const stages = el("div", "ni-stages");
    const track = el("div", "ni-track"), fill = el("div", "ni-fill");
    track.append(fill);
    const pt = el("div", "ni-pt"), ptL = el("span"), ptR = el("span");
    pt.append(ptL, ptR);
    prog.append(stages, track, pt);
    progSec.append(prog);
    inner.append(progSec);

    // итоговый промпт
    const finalSec = el("div", "ni-sec");
    const finalLab = el("div", "ni-lab"), finalB = el("b");
    finalLab.append(finalB); finalSec.append(finalLab);
    const finalArea = el("textarea", "ni-final");
    finalArea.readOnly = true;
    finalSec.append(finalArea);
    const editBtn = button("", "", () => {
        if (!node.__neronFinal) {
            alert(L("Сначала сделай картинку — тогда появится итоговый промпт.", "Make a picture first — the final prompt will appear here."));
            return;
        }
        const w = W(node, "text");
        if (w) w.value = node.__neronPrompt || "";
        const pw = W(node, "prompter");
        if (pw) {
            const asis = (comboList(pw) || []).find((x) => String(x).startsWith("✍"));
            if (asis) pw.value = asis;
        }
        node.__niPaint?.();
        openEditor(node);
    });
    finalSec.append(editBtn);
    inner.append(finalSec);

    // кнопка моделей
    const modelsBtn = button(T().models, "main", () => openModelsDialog(false));
    node.__niModelsBtn = modelsBtn;
    DL.nodes.add(node);
    inner.append(modelsBtn);

    // предупреждение про провода
    const wireNote = el("div", "ni-note");
    wireNote.style.display = "none";
    inner.append(wireNote);

    // эксперт
    const expBox = el("div", "ni-exp");
    const expNote = el("div", "ni-note"); expBox.append(expNote);
    const hSample = el("h4"); expBox.append(hSample);
    row(expBox, "count", "count");
    row(expBox, "steps", "steps");
    row(expBox, "cfg", "cfg");
    row(expBox, "sampler", "sampler");
    row(expBox, "scheduler", "scheduler");
    const hPrompter = el("h4"); expBox.append(hPrompter);
    const instrSec = el("div", "ni-sec");
    const instrLab = el("div", "ni-lab"), instrB = el("b");
    instrLab.append(instrB); instrSec.append(instrLab);
    const instrArea = el("textarea", "ni-prompt");
    instrArea.style.minHeight = "52px";
    instrArea.oninput = () => { const w = W(node, "prompter_instruction"); if (w) w.value = instrArea.value; };
    instrSec.append(instrArea); expBox.append(instrSec);
    row(expBox, "promptVariant", "prompter_seed");
    row(expBox, "creativity", "prompter_creativity");
    const hStyle = el("h4"); expBox.append(hStyle);
    row(expBox, "styleLora", "style_lora");
    row(expBox, "styleStrength", "style_strength");
    const hModels = el("h4"); expBox.append(hModels);
    field(expBox, "keepLoaded", "keep_loaded", "check");
    row(expBox, "unet", "unet_model");
    row(expBox, "clip", "clip_model");
    row(expBox, "vae", "vae_model");
    const resetBtn = button("", "", () => {
        for (const w of node.widgets || []) {
            const o = specs[w.name];
            if (!o || w.name.endsWith("_model") || !("default" in o)) continue;
            setw(node, w.name, o.default);
        }
        node.__niPaint?.();
    });
    expBox.append(resetBtn);
    const themeBtn = button("", "", () => cycleTheme());
    expBox.append(themeBtn);
    inner.append(expBox);

    // размер панели
    function height() { return Math.ceil(inner.scrollHeight) + 8; }
    let lastH = 0;
    function fit() {
        requestAnimationFrame(() => {
            const h = height();
            if (Math.abs(h - lastH) < 2) return;
            lastH = h;
            try { const sz = node.computeSize(); node.setSize([Math.max(node.size[0], sz[0]), sz[1]]); } catch (_) {}
            try { app.graph?.setDirtyCanvas(true, true); } catch (_) {}
        });
    }
    function paintProgress() {
        const t = T();
        const c = CLOCK, mine = c.current == null || String(c.current) === String(node.id);
        let text = t.idle, right = "", pct = 0;
        if (c.running) {
            if (mine && c.stage) {
                text = pick(c.stage) + (c.total > 1 ? ` · ${c.i}/${c.total}` : "");
                if (c.i > 0 && c.total > c.i && c.t0) {
                    const per = (Date.now() - c.t0) / 1000 / c.i;
                    right = `${t.elapsed} ${fmt(Date.now() - c.start)} · ${t.left} ${fmt(per * (c.total - c.i) * 1000)}`;
                } else right = `${t.elapsed} ${fmt(Date.now() - c.start)}`;
                pct = c.total > 1 ? c.i / c.total : 0.12;
            } else {
                text = t.waiting;
                right = c.start ? fmt(Date.now() - c.start) : "";
                pct = 0.03;
            }
        } else if (c.end) {
            text = c.result === "error" ? t.error : `${t.done} ${fmt(c.end - c.start)}`;
            pct = 1;
        }
        ptL.textContent = text;
        ptR.textContent = right;
        fill.style.width = `${Math.min(100, pct * 100)}%`;
        fill.classList.toggle("err", c.result === "error");
        const wanted = c.running && mine ? [pick(c.stage || "🎨 рисую / drawing")] : [];
        if (stages.childElementCount !== wanted.length || stages.firstChild?.textContent !== wanted[0]) {
            stages.innerHTML = "";
            for (const s of wanted) stages.append(el("span", "ni-stage now", s));
        }
    }
    node.__niPaintProgress = paintProgress;

    function paint() {
        const t = T();
        syncSlotLabels(node);
        ru.classList.toggle("on", LANG === "RU");
        en.classList.toggle("on", LANG === "EN");
        exp.textContent = t.expert;
        exp.classList.toggle("on", W(node, "expert")?.value === true);
        hlp.textContent = t.help;
        promptB.textContent = t.prompt; promptI.textContent = t.promptHint;
        promptArea.placeholder = t.promptPh;
        if (document.activeElement !== promptArea) promptArea.value = W(node, "text")?.value ?? "";
        if (document.activeElement !== instrArea) instrArea.value = W(node, "prompter_instruction")?.value ?? "";
        editorBtn.textContent = t.bigEditor;
        autB.textContent = t.prompter; autI.textContent = t.prompterHint;
        frameB.textContent = t.frame; frameI.textContent = "";
        varB.textContent = t.variant; varI.textContent = "";
        progB.textContent = t.progress;
        finalB.textContent = t.final;
        finalArea.placeholder = t.finalPh;
        editBtn.textContent = t.editFinal;
        modelsBtn.textContent = t.models;
        resetBtn.textContent = t.reset;
        themeBtn.textContent = t.themeCycle;
        expNote.textContent = t.expertNote;
        hSample.textContent = t.sampling;
        hPrompter.textContent = t.prompterFine;
        hStyle.textContent = t.style;
        hModels.textContent = t.modelsFine;
        instrB.textContent = t.instruction;
        for (const [name, input, label, key] of ctl) {
            if (!name || !input) continue;
            if (label && key) label.textContent = t[key] ?? key;
            const w = W(node, name);
            if (!w) continue;
            if (input.type === "checkbox") input.checked = !!w.value;
            else if (input.tagName === "SELECT") {
                if (w.value != null && [...input.options].every((o) => o.value !== w.value)) {
                    const o = document.createElement("option");
                    o.value = w.value; o.textContent = pick(w.value);
                    input.insertBefore(o, input.firstChild);
                }
                input.value = w.value;
                for (const o of input.options) o.textContent = pick(o.value);
            } else input.value = w.value;
        }
        const wSized = linked(node, "width") && linked(node, "height");
        const wPrompt = linked(node, "prompt_text");
        for (const inp of [aspectRow, qualityRow]) if (inp) inp.style.display = wSized ? "none" : "";
        sharpRow.style.display = wSized ? "none" : "";
        promptArea.style.display = wPrompt ? "none" : "";
        editorBtn.style.display = wPrompt ? "none" : "";
        autSec.style.display = wPrompt ? "none" : "";
        wireNote.style.display = (wSized || wPrompt) ? "" : "none";
        wireNote.textContent = wPrompt ? t.wiredPrompt : t.wiredSize;
        expBox.style.display = W(node, "expert")?.value === true ? "" : "none";
        if (node.__neronFinal) finalArea.value = node.__neronFinal;
        paintProgress();
        fit();
    }
    node.__niPaint = paint;

    const w = node.addDOMWidget("neron_image_panel", "neron_image_panel", root, {
        serialize: false, hideOnZoom: false,
        getMinHeight: height, getHeight: height,
    });
    if (w) { w.serialize = false; w.computeSize = () => [node.size[0], height()]; }
    setTimeout(() => { paint(); syncNotes(); }, 60);
    return paint;
}

// ============================================================
//  РЕГИСТРАЦИЯ
// ============================================================
// Если процесс стоит и отдельным пакетом, и в общей базе — панель рисуется один раз.
const registerOnce = (ext) => {
    if ((app.extensions || []).some((e) => e && e.name === ext.name)) return;
    app.registerExtension(ext);
};
registerOnce({
    name: "Neron.Image.Common",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        // красим ноды ourselves: чужие движки тем выключены, чтобы цвета не оставались после выхода
        try { registerType(nodeType, nodeData); } catch (_) {}
        if (nodeData.name === THEME_NODE) {
            // длинный текст темы человеку не показываем: оформление меняется кнопкой в панели
            const made0 = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = made0?.apply(this, arguments);
                const hide = () => {
                    for (const w of this.widgets || []) {
                        if (w?.name !== "theme_json") continue;
                        w.hidden = true;
                        w.type = "hidden";
                        w.computeSize = () => [0, -4];
                    }
                };
                hide();
                setTimeout(hide, 100);
                return r;
            };
            return;
        }
        if (nodeData.name !== NODE) return;
        const specs = {};
        for (const grp of ["required", "optional"])
            for (const [k, s] of Object.entries(nodeData.input?.[grp] || {}))
                specs[k] = (Array.isArray(s) && s[1] && typeof s[1] === "object") ? s[1] : {};

        const origCreated = nodeType.prototype.onNodeCreated;
        const origExecuted = nodeType.prototype.onExecuted;
        const origConfigure = nodeType.prototype.onConfigure;
        const origSerialize = nodeType.prototype.onSerialize;
        const origRemoved = nodeType.prototype.onRemoved;
        const origConn = nodeType.prototype.onConnectionsChange;

        nodeType.prototype.onRemoved = function () {
            NODES.delete(this); DL.nodes.delete(this);
            return origRemoved?.apply(this, arguments);
        };
        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;
            node.color = "#23345a";
            node.bgcolor = "#141e33";
            if (!node.title || TITLE_ALIASES.has(node.title)) node.title = nodeTitle();
            buildPanel(node, specs);
            NODES.add(node);
            node.__neronFinal = node.__neronFinal || "";
            const fix = () => {
                for (const w of node.widgets || []) saneWidget(w, specs[w.name]);
                node.__niPaint?.();
            };
            setTimeout(fix, 0);
            setTimeout(fix, 300);
            fetchStatus().then((s) => {
                if (s && !s.all_present && !DL.autoShown) { DL.autoShown = true; openModelsDialog(true); }
            });
            return r;
        };
        nodeType.prototype.onExecuted = function (message) {
            const r = origExecuted?.apply(this, arguments);
            const p = message?.neron_prompt?.[0];
            const info = message?.neron_info?.[0];
            if (p != null) {
                this.__neronPrompt = String(p);
                this.__neronFinal = String(p) + (info ? "\n\n— — —\n" + String(info) : "");
                this.__niPaint?.();
            }
            return r;
        };
        nodeType.prototype.onConnectionsChange = function () {
            const r = origConn?.apply(this, arguments);
            clearTimeout(this.__niWire);
            this.__niWire = setTimeout(() => this.__niPaint?.(), 30);
            return r;
        };
        nodeType.prototype.onSerialize = function (o) {
            const r = origSerialize?.apply(this, arguments);
            try {
                o.properties = o.properties || {};
                o.properties[NAMED] = namedValues(this, specs);
            } catch (_) {}
            return r;
        };
        nodeType.prototype.onConfigure = function (info) {
            const r = origConfigure?.apply(this, arguments);
            const named = info?.properties?.[NAMED] || this.properties?.[NAMED];
            const fix = () => {
                restoreNamed(this, specs, named);
                trimSlots(this);
                if (!this.title || TITLE_ALIASES.has(this.title)) this.title = nodeTitle();
                this.__niPaint?.();
            };
            fix();
            for (const t of [50, 300, 800]) setTimeout(fix, t);
            return r;
        };
    },
});
