// ============================================================================
//  Neron Theme — ядро / core
//  RU: Цвета, роли нод, встроенные темы, генератор темы из одного цвета и из
//      картинки, проверка читаемости, код темы для обмена, экспорт в палитру ComfyUI.
//      Здесь нет ничего, что трогает экран, — только расчёты.
//  EN: Colors, node roles, built-in themes, a theme generator from one color and
//      from a picture, readability check, a share code, ComfyUI palette export.
//      Nothing here touches the screen — just math.
// ============================================================================

export const T = (ru, en) => `${ru} / ${en}`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------------------
//  Цвет / Color
// ---------------------------------------------------------------------------
export function hexOk(c) { return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c); }
export function hex2rgb(c) {
    let s = String(c || "#000000").trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) s = "#" + s.slice(1).split("").map((x) => x + x).join("");
    const n = parseInt(s.slice(1, 7), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}
export function mix(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
export function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s, l];
}
export function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
export function toHsl(c) { return rgb2hsl(...hex2rgb(c)); }
export function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = hex2rgb(c);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}
// сделать цвет текста читаемым на фоне: двигаем светлоту, пока контраст не станет достаточным
export function readable(text, bg, need = 4.5) {
    if (contrast(text, bg) >= need) return text;
    const [h, s] = toHsl(text);
    const darkBg = lum(bg) < 0.3;
    for (let k = 0; k <= 20; k++) {
        const l = darkBg ? 0.6 + k * 0.02 : 0.4 - k * 0.02;
        const c = hsl(h, Math.min(s, 0.5), l);
        if (contrast(c, bg) >= need) return c;
    }
    return darkBg ? "#ffffff" : "#000000";
}

// ---------------------------------------------------------------------------
//  Роли нод: по ним нода получает свой цвет
//  Node roles: each role has its own color
// ---------------------------------------------------------------------------
export const ROLES = [
    { id: "model", ru: "Модели", en: "Models", tip: T("загрузка моделей, LoRA, VAE, ControlNet", "model, LoRA, VAE, ControlNet loaders") },
    { id: "input", ru: "Вход", en: "Input", tip: T("загрузка картинок, видео, звука", "image, video, audio loaders") },
    { id: "text", ru: "Текст", en: "Text", tip: T("промпты, кондишены", "prompts, conditioning") },
    { id: "gen", ru: "Генерация", en: "Generate", tip: T("сэмплеры (KSampler и т. п.)", "samplers (KSampler etc.)") },
    { id: "latent", ru: "Латент", en: "Latent", tip: T("латент, VAE Decode / Encode", "latents, VAE Decode / Encode") },
    { id: "image", ru: "Обработка", en: "Process", tip: T("обработка картинок, масок, видео", "image, mask, video processing") },
    { id: "audio", ru: "Звук", en: "Audio", tip: T("ноды звука и музыки", "audio and music nodes") },
    { id: "output", ru: "Выход", en: "Output", tip: T("сохранение и просмотр", "save and preview") },
    { id: "util", ru: "Прочее", en: "Other", tip: T("утилиты, числа, заметки", "utilities, numbers, notes") },
];
export const ROLE_IDS = ROLES.map((r) => r.id);

const MODEL_T = ["MODEL", "CLIP", "VAE", "CONTROL_NET", "CLIP_VISION", "UPSCALE_MODEL", "STYLE_MODEL", "GLIGEN", "PHOTOMAKER", "LORA_MODEL", "IPADAPTER", "INSIGHTFACE", "AUDIO_ENCODER", "MODEL_PATCH", "LATENT_UPSCALE_MODEL"];
const MEDIA_T = ["IMAGE", "MASK", "VIDEO"];

// nodeData — описание ноды от ComfyUI (name, category, output, output_node, input)
export function roleOf(nd) {
    if (!nd) return "util";
    const name = String(nd.name || "");
    const lname = name.toLowerCase();
    const cat = String(nd.category || "").toLowerCase();
    const outs = (Array.isArray(nd.output) ? nd.output : []).map((x) => String(Array.isArray(x) ? "COMBO" : x).toUpperCase());
    const has = (list) => outs.some((o) => list.includes(o) || o.split(",").some((p) => list.includes(p)));
    if (name === "NeronThemeStudio") return "util";
    const isAudio = cat.includes("audio") || cat.includes("music") || lname.includes("audio") || has(["AUDIO", "NERON_SOUNDS"]);
    if (nd.output_node) return isAudio && !outs.length ? "audio" : "output";
    if (cat.includes("sampling") || /sampler/.test(lname) && !lname.includes("select") || /ksampler/.test(lname)) return "gen";
    if (cat.includes("loaders") || has(MODEL_T)) return "model";
    if (has(["CONDITIONING"]) || cat.includes("conditioning") || /textencode|prompt/.test(lname)) return "text";
    if (cat.includes("latent") || has(["LATENT"])) return "latent";
    if (isAudio) return "audio";
    if (/^load|load(image|video|audio)/.test(lname) && (has(MEDIA_T) || !outs.length)) return "input";
    if (has(MEDIA_T) || /image|mask|video|upscal|compositing/.test(cat)) return "image";
    return "util";
}

// ---------------------------------------------------------------------------
//  Тема: описание / Theme model
// ---------------------------------------------------------------------------
//  c: bg (фон стола), grid (сетка), title (шапка ноды), body (тело ноды), text (текст),
//     widget (поля), line (рамки полей), link (провода по умолчанию), menu (панели окна),
//     accent (главный цвет окна)
//  roles: цвет каждой роли;  tint/btint: сколько цвета роли в шапке и теле;  glow: свечение
//  life: живость — level 0..3, frame, wires, bgfx, work, beat, speed
//  ui: красить ли всё окно ComfyUI
export const LIFE_LEVELS = [["ВЫКЛ", "OFF"], ["СПОКОЙНО", "CALM"], ["ЖИВО", "LIVELY"], ["НА ПОЛНУЮ", "FULL"]];
export const BGFX = [
    ["none", "нет", "none"], ["flow", "переливы", "flow"], ["particles", "частицы", "particles"], ["stars", "звёзды", "stars"],
];
export const C_KEYS = [
    ["bg", "Фон стола", "Canvas"], ["grid", "Сетка", "Grid"], ["title", "Шапка ноды", "Node title"], ["body", "Тело ноды", "Node body"],
    ["text", "Текст", "Text"], ["widget", "Поля", "Fields"], ["line", "Рамки полей", "Field borders"], ["link", "Провода", "Wires"],
    ["menu", "Панели окна", "Window panels"], ["accent", "Главный цвет", "Main color"],
];

export function defaultLife(level = 1) {
    return { level, frame: true, wires: true, bgfx: level >= 2 ? "particles" : "none", work: true, beat: true, speed: 1, fps: 0, quietRun: false };
}

// полная, проверенная тема из чего угодно (защита от битых кодов и файлов)
export function normalizeTheme(t) {
    t = t && typeof t === "object" ? t : {};
    const base = generateFromColor(hexOk(t.c?.accent) ? t.c.accent : "#b388ff");
    const out = {
        v: 1,
        id: String(t.id || "").replace(/[^\w\-]/g, "").slice(0, 40) || ("t" + Date.now().toString(36)),
        name: String(t.name || base.name).slice(0, 40),
        author: String(t.author || "").slice(0, 40),
        c: {}, roles: {},
        tint: clamp(Number(t.tint ?? base.tint), 0, 1),
        btint: clamp(Number(t.btint ?? base.btint), 0, 0.6),
        glow: clamp(Number(t.glow ?? base.glow), 0, 1),
        ui: t.ui !== false,
        life: { ...defaultLife(1), ...(t.life && typeof t.life === "object" ? t.life : {}) },
    };
    for (const [k] of C_KEYS) out.c[k] = hexOk(t.c?.[k]) ? t.c[k].toLowerCase() : base.c[k];
    for (const r of ROLE_IDS) out.roles[r] = hexOk(t.roles?.[r]) ? t.roles[r].toLowerCase() : base.roles[r];
    const L = out.life;
    L.level = [0, 1, 2, 3].includes(Number(L.level)) ? Number(L.level) : 1;
    for (const k of ["frame", "wires", "work", "beat", "quietRun"]) L[k] = !!L[k];
    L.bgfx = BGFX.some((b) => b[0] === L.bgfx) ? L.bgfx : "none";
    L.speed = clamp(Number(L.speed) || 1, 0.25, 3);
    L.fps = [0, 30, 45, 60].includes(Number(L.fps)) ? Number(L.fps) : 0;
    return out;
}

// ---------------------------------------------------------------------------
//  Генератор: тема из одного цвета / Generator: a theme from one color
//  scheme: "harmony" (соседние оттенки), "rainbow" (вся радуга), "mono" (один оттенок)
// ---------------------------------------------------------------------------
export function generateFromColor(main, opts = {}) {
    const scheme = opts.scheme || "harmony";
    const light = !!opts.light;
    const [h0, s0raw] = toHsl(hexOk(main) ? main : "#b388ff");
    const s0 = Math.max(0.25, s0raw);
    const tone = (l, s = 0.3) => hsl(h0, s0 * s, l);
    let c;
    if (!light) {
        c = {
            bg: tone(0.065, 0.45), grid: tone(0.12, 0.4), title: tone(0.2, 0.4), body: tone(0.135, 0.35),
            text: tone(0.88, 0.25), widget: tone(0.09, 0.4), line: tone(0.3, 0.35), link: hsl(h0, Math.min(0.75, s0), 0.62),
            menu: tone(0.095, 0.45), accent: hsl(h0, Math.min(0.85, s0), 0.6),
        };
    } else {
        c = {
            bg: tone(0.93, 0.35), grid: tone(0.86, 0.35), title: tone(0.8, 0.45), body: tone(0.9, 0.3),
            text: tone(0.16, 0.4), widget: tone(0.97, 0.25), line: tone(0.65, 0.3), link: hsl(h0, Math.min(0.7, s0), 0.45),
            menu: tone(0.95, 0.3), accent: hsl(h0, Math.min(0.85, s0), 0.45),
        };
    }
    const n = ROLE_IDS.length;
    const roles = {};
    ROLE_IDS.forEach((r, i) => {
        let h;
        if (scheme === "rainbow") h = h0 + (360 / n) * i;
        else if (scheme === "mono") h = h0 + (i % 2 ? 8 : -8);
        else h = h0 - 70 + (140 / (n - 1)) * i;     // соседние оттенки ±70°
        const l = scheme === "mono" ? (light ? 0.38 : 0.5) + (i / n) * 0.25 : (light ? 0.44 : 0.62);
        roles[r] = hsl(h, Math.min(0.85, 0.45 + s0 * 0.45), l);
    });
    return {
        v: 1, id: "gen_" + main.replace("#", ""), name: opts.name || T("Моя тема", "My theme"), author: "",
        c, roles, tint: light ? 0.3 : 0.35, btint: light ? 0.08 : 0.06, glow: light ? 0.15 : 0.45, ui: true,
        life: defaultLife(opts.level ?? 1),
    };
}

// ---------------------------------------------------------------------------
//  Тема из картинки / A theme from a picture
//  img — HTMLImageElement / ImageBitmap / canvas. Возвращает тему.
// ---------------------------------------------------------------------------
export function paletteFromImage(img, k = 8) {
    const W = 64;
    const ratio = (img.height || img.naturalHeight || 1) / (img.width || img.naturalWidth || 1);
    const w = W, h = Math.max(8, Math.round(W * ratio));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const px = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push([d[i], d[i + 1], d[i + 2]]);
    if (!px.length) return [];
    // k-средних по цветам (повторяемо: стартовые центры — по равномерной выборке)
    let cent = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) * px.length / k)].slice());
    let lab = new Int32Array(px.length);
    for (let it = 0; it < 12; it++) {
        const sum = cent.map(() => [0, 0, 0, 0]);
        for (let p = 0; p < px.length; p++) {
            let best = 0, bd = Infinity;
            for (let c = 0; c < k; c++) {
                const dr = px[p][0] - cent[c][0], dg = px[p][1] - cent[c][1], db = px[p][2] - cent[c][2];
                const dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
                if (dd < bd) { bd = dd; best = c; }
            }
            lab[p] = best;
            const s = sum[best]; s[0] += px[p][0]; s[1] += px[p][1]; s[2] += px[p][2]; s[3]++;
        }
        cent = cent.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
        cent.n = sum.map((s) => s[3]);
    }
    const out = cent.map((c, i) => {
        const hx = rgb2hex(...c);
        const [hh, ss, ll] = rgb2hsl(...c);
        return { hex: hx, h: hh, s: ss, l: ll, share: (cent.n[i] || 0) / px.length };
    }).filter((x) => x.share > 0.004);
    return out.sort((a, b) => b.share - a.share);
}

export function themeFromPalette(pal, opts = {}) {
    if (!pal || !pal.length) return generateFromColor("#b388ff", opts);
    // главный цвет — самый «яркий и заметный»: насыщенность × доля, без почти чёрных и белых
    const vivid = pal.filter((p) => p.l > 0.18 && p.l < 0.85);
    const pick = (vivid.length ? vivid : pal).slice().sort((a, b) => (b.s * Math.sqrt(b.share)) - (a.s * Math.sqrt(a.share)))[0];
    const t = generateFromColor(pick.hex, opts);
    // фон — из самого тёмного заметного цвета картинки
    const dark = pal.filter((p) => p.share > 0.03).sort((a, b) => a.l - b.l)[0];
    if (dark && !opts.light) {
        const [h, s] = [dark.h, dark.s];
        t.c.bg = hsl(h, Math.min(0.5, s), 0.065);
        t.c.menu = hsl(h, Math.min(0.5, s), 0.095);
        t.c.grid = hsl(h, Math.min(0.45, s), 0.12);
        t.c.body = hsl(h, Math.min(0.4, s), 0.135);
        t.c.widget = hsl(h, Math.min(0.45, s), 0.09);
    }
    // роли — из цветов картинки (самые насыщенные и разные по оттенку), остальное генератор
    const cand = (vivid.length ? vivid : pal).slice().sort((a, b) => b.s - a.s);
    const used = [];
    for (const p of cand) {
        if (used.every((u) => Math.min(Math.abs(u.h - p.h), 360 - Math.abs(u.h - p.h)) > 22)) used.push(p);
        if (used.length >= ROLE_IDS.length) break;
    }
    used.forEach((p, i) => {
        const l = opts.light ? 0.44 : clamp(p.l, 0.55, 0.7);
        t.roles[ROLE_IDS[i]] = hsl(p.h, clamp(p.s, 0.45, 0.85), l);
    });
    t.c.accent = hsl(pick.h, clamp(pick.s, 0.5, 0.85), opts.light ? 0.45 : 0.6);
    t.c.link = t.c.accent;
    t.id = "img_" + Date.now().toString(36);
    return t;
}

// ---------------------------------------------------------------------------
//  Проверка читаемости: текст всегда читается на своём фоне
//  Readability: text is always readable on its background
// ---------------------------------------------------------------------------
export function fixReadable(t) {
    const fixes = [];
    const want = (key, bgKey, need) => {
        const v = readable(t.c[key], t.c[bgKey], need);
        if (v !== t.c[key]) { fixes.push(key); t.c[key] = v; }
    };
    want("text", "body", 4.5);
    want("text", "widget", 4.5);
    // заголовок ноды подкрашен ролью — текст должен читаться и там
    for (const r of ROLE_IDS) {
        const tt = mix(t.c.title, t.roles[r], t.tint);
        if (contrast(t.c.text, tt) < 3.5) { t.tint = Math.max(0.05, t.tint - 0.1); fixes.push("tint"); break; }
    }
    return fixes;
}

// ---------------------------------------------------------------------------
//  Встроенные темы / Built-in themes
// ---------------------------------------------------------------------------
function make(main, name, opts, patch) {
    const t = generateFromColor(main, { ...opts, name });
    if (patch) {
        if (patch.c) Object.assign(t.c, patch.c);
        if (patch.roles) Object.assign(t.roles, patch.roles);
        for (const k of ["tint", "btint", "glow", "ui"]) if (patch[k] !== undefined) t[k] = patch[k];
        if (patch.life) Object.assign(t.life, patch.life);
    }
    t.author = "Neron";
    return t;
}
export const BUILTIN = [
    Object.assign(make("#8a9099", T("Графит", "Graphite"), { scheme: "rainbow" }, {
        c: { bg: "#151618", grid: "#1d1f22", title: "#2e3034", body: "#26282b", text: "#d6d8dc", widget: "#1c1d20", line: "#4a4d54", link: "#9aa0aa", menu: "#18191b", accent: "#8ab4f8" },
        roles: { model: "#b39ddb", input: "#64b5f6", text: "#ffb74d", gen: "#e57373", latent: "#f48fb1", image: "#4dd0e1", audio: "#81c784", output: "#aed581", util: "#90a4ae" },
        tint: 0.3, btint: 0.03, glow: 0.2, life: { level: 1, bgfx: "none" },
    }), { id: "graphite" }),
    Object.assign(make("#f3a453", "Neron Brown", { scheme: "harmony" }, {
        c: { bg: "#170e07", grid: "#21150c", title: "#4a2f1e", body: "#2e1c10", text: "#eedcc6", widget: "#1c120b", line: "#5e412b", link: "#d9904a", menu: "#22160e", accent: "#f3a453" },
        roles: { model: "#e090d8", input: "#7fb2e0", text: "#ffcf70", gen: "#f3a453", latent: "#f29ab4", image: "#97d17f", audio: "#97d17f", output: "#c9e07f", util: "#c9ab8c" },
        tint: 0.32, btint: 0.05, glow: 0.35, life: { level: 1, bgfx: "none" },
    }), { id: "brown" }),
    Object.assign(make("#ff2bd6", T("Неон", "Neon"), { scheme: "rainbow" }, {
        c: { bg: "#06040f", grid: "#0f0a22", title: "#1a1033", body: "#0c0820", text: "#ece7ff", widget: "#0d0822", line: "#4f39a8", link: "#00e5ff", menu: "#0b0718", accent: "#ff2bd6" },
        roles: { model: "#ff2bd6", input: "#00e5ff", text: "#ffe600", gen: "#ff3b6b", latent: "#b26bff", image: "#39ff88", audio: "#39ff88", output: "#ff9f1c", util: "#8f88cc" },
        tint: 0.35, btint: 0.06, glow: 1, life: { level: 2, bgfx: "stars" },
    }), { id: "neon" }),
    Object.assign(make("#ff7a45", T("Закат", "Sunset"), { scheme: "harmony" }, {
        c: { bg: "#140a10", menu: "#1b0e15", grid: "#22121b" }, glow: 0.5, life: { level: 1, bgfx: "flow" },
    }), { id: "sunset" }),
    Object.assign(make("#2fb8e0", T("Океан", "Ocean"), { scheme: "harmony" }, { glow: 0.45, life: { level: 1, bgfx: "flow" } }), { id: "ocean" }),
    Object.assign(make("#5fbf6a", T("Лес", "Forest"), { scheme: "harmony" }, { glow: 0.3, life: { level: 1, bgfx: "particles" } }), { id: "forest" }),
    Object.assign(make("#ff7eb6", T("Сакура", "Sakura"), { scheme: "harmony" }, { glow: 0.4, life: { level: 1, bgfx: "particles" } }), { id: "sakura" }),
    Object.assign(make("#c0c0c0", T("Монохром", "Mono"), { scheme: "mono" }, {
        c: { bg: "#0d0d0d", grid: "#171717", title: "#2b2b2b", body: "#1e1e1e", text: "#eeeeee", widget: "#141414", line: "#4d4d4d", link: "#bdbdbd", menu: "#121212", accent: "#ffffff" },
        roles: { model: "#e0e0e0", input: "#cfcfcf", text: "#bdbdbd", gen: "#ffffff", latent: "#a8a8a8", image: "#d6d6d6", audio: "#c4c4c4", output: "#f0f0f0", util: "#8f8f8f" },
        tint: 0.2, glow: 0.2, life: { level: 0 },
    }), { id: "mono" }),
    Object.assign(make("#3b6fd6", T("Бумага (светлая)", "Paper (light)"), { scheme: "rainbow", light: true }, {
        c: { bg: "#ecebe6", grid: "#dfddd5", title: "#d9d6cc", body: "#f6f5f1", text: "#22242a", widget: "#ffffff", line: "#b8b5aa", link: "#5a6b8a", menu: "#f3f2ee", accent: "#3b6fd6" },
        tint: 0.35, btint: 0.05, glow: 0.1, life: { level: 0 },
    }), { id: "paper" }),
].map((t) => { fixReadable(t); return normalizeTheme(t); });

export function isLight(t) { return lum(t.c.bg) > 0.35; }

// ---------------------------------------------------------------------------
//  Код темы: короткая строчка для обмена / Share code
//  NERON-THEME1:<base64url сжатого JSON>
// ---------------------------------------------------------------------------
const CODE_PREFIX = "NERON-THEME1:";
function b64urlEncode(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
async function pipe(bytes, stream) {
    const r = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await r.arrayBuffer());
}
// компактный вид: только данные темы, без лишнего
export function themeForShare(t) {
    const n = normalizeTheme(t);
    return { v: 1, name: n.name, author: n.author, c: n.c, roles: n.roles, tint: n.tint, btint: n.btint, glow: n.glow, ui: n.ui, life: n.life };
}
export async function encodeCode(t) {
    const json = new TextEncoder().encode(JSON.stringify(themeForShare(t)));
    let body;
    if (typeof CompressionStream === "function") {
        try { body = "z" + b64urlEncode(await pipe(json, new CompressionStream("deflate-raw"))); } catch (e) { body = null; }
    }
    if (!body) body = "j" + b64urlEncode(json);
    return CODE_PREFIX + body;
}
// принимает код, JSON темы или JSON-файл; возвращает тему или бросает понятную ошибку
export async function decodeAny(text) {
    let s = String(text || "").trim();
    if (!s) throw new Error(T("пусто", "empty"));
    let obj;
    const at = s.indexOf(CODE_PREFIX);
    if (at >= 0) {
        s = s.slice(at + CODE_PREFIX.length).split(/\s/)[0];
        if (s[0] === "z" && typeof DecompressionStream !== "function") throw new Error(T("браузер не умеет распаковывать код", "the browser can't unpack the code"));
        try {
            const kind = s[0], data = b64urlDecode(s.slice(1));
            const bytes = kind === "z" ? await pipe(data, new DecompressionStream("deflate-raw")) : data;
            obj = JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            throw new Error(T("код повреждён — скопируйте его целиком", "the code is damaged — copy it whole"));
        }
    } else if (s[0] === "{") {
        obj = JSON.parse(s);
        if (obj && obj.neron_theme) obj = obj.neron_theme;
        else if (obj && obj.colors && obj.colors.litegraph_base) obj = themeFromComfyPalette(obj);
    } else {
        throw new Error(T("это не код темы Neron", "this is not a Neron theme code"));
    }
    if (!obj || typeof obj !== "object" || !obj.c) throw new Error(T("в коде нет темы", "no theme in the code"));
    const t = normalizeTheme({ ...obj, id: "s" + Date.now().toString(36) });
    fixReadable(t);
    return t;
}

// файл темы: свой формат (с пометкой neron_theme) — его же понимает вставка кода
export function themeFile(t) {
    return JSON.stringify({ neron_theme: themeForShare(t), app: "Neron Theme", made: new Date().toISOString().slice(0, 10) }, null, 2);
}

// ---------------------------------------------------------------------------
//  Палитра ComfyUI (Настройки → Appearance → Color Palette → Import)
//  ComfyUI palette (Settings → Appearance → Color Palette → Import)
// ---------------------------------------------------------------------------
// цвета проводов по типу: исходный цвет ComfyUI + немного цвета темы — типы остаются различимыми
export const SLOT_BASE = {
    CLIP: "#FFD500", CLIP_VISION: "#A8DADC", CLIP_VISION_OUTPUT: "#ad7452", CONDITIONING: "#FFA931", CONTROL_NET: "#6EE7B7",
    IMAGE: "#64B5F6", LATENT: "#FF9CF9", MASK: "#81C784", MODEL: "#B39DDB", STYLE_MODEL: "#C2FFAE", VAE: "#FF6E6E",
    NOISE: "#B0B0B0", GUIDER: "#66FFFF", SAMPLER: "#ECB4B4", SIGMAS: "#CDFFCD", TAESD: "#DCC274",
    AUDIO: "#69db7c", VIDEO: "#4dabf7", NERON_SOUNDS: "#97d17f", NERON_VIDEOS: "#7fb2e0",
};
export function slotColor(t, base) {
    const [h, s, l] = toHsl(base);
    const [ah] = toHsl(t.c.accent);
    const light = isLight(t);
    // оттенок типа сохраняется, яркость и насыщенность — под тему, чуть-чуть оттенка темы
    const dh = ((ah - h + 540) % 360) - 180;
    const glowish = 0.55 + t.glow * 0.3;
    return hsl(h + dh * 0.12, clamp(s * glowish + 0.15, 0.3, 0.95), light ? clamp(l * 0.6, 0.3, 0.45) : clamp(l, 0.55, 0.72));
}
export function toComfyPalette(t) {
    const n = normalizeTheme(t);
    const c = n.c;
    const light = isLight(n);
    const node_slot = {};
    for (const [k, v] of Object.entries(SLOT_BASE)) node_slot[k] = slotColor(n, v);
    const sub = mix(c.text, c.body, 0.4);
    return {
        id: "neron_" + (n.name || "theme").toLowerCase().replace(/[^\w]+/g, "_").slice(0, 30),
        name: "Neron · " + n.name,
        light_theme: light,
        colors: {
            node_slot,
            litegraph_base: {
                BACKGROUND_IMAGE: gridImage(n),
                CLEAR_BACKGROUND_COLOR: c.bg, NODE_TITLE_COLOR: mix(c.text, c.title, 0.15), NODE_SELECTED_TITLE_COLOR: light ? "#000" : "#FFF",
                NODE_TEXT_COLOR: c.text, NODE_TEXT_HIGHLIGHT_COLOR: light ? "#000" : "#FFF",
                NODE_DEFAULT_COLOR: c.title, NODE_DEFAULT_BGCOLOR: c.body, NODE_DEFAULT_BOXCOLOR: c.line, NODE_DEFAULT_SHAPE: 2,
                NODE_BOX_OUTLINE_COLOR: c.accent, NODE_BYPASS_BGCOLOR: "#FF00FF", NODE_ERROR_COLOUR: "#E00", DEFAULT_SHADOW_COLOR: light ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.5)",
                WIDGET_BGCOLOR: c.widget, WIDGET_OUTLINE_COLOR: c.line, WIDGET_TEXT_COLOR: c.text, WIDGET_SECONDARY_TEXT_COLOR: sub,
                WIDGET_DISABLED_TEXT_COLOR: mix(c.text, c.widget, 0.6), LINK_COLOR: c.link, EVENT_LINK_COLOR: "#A86", CONNECTING_LINK_COLOR: c.accent,
                BADGE_FG_COLOR: light ? "#000" : "#FFF", BADGE_BG_COLOR: mix(c.body, c.accent, 0.25),
            },
            comfy_base: comfyBase(n),
            theme: uiTokens(n),
        },
    };
}
export function comfyBase(n) {
    const c = n.c;
    const light = isLight(n);
    const sub = mix(c.text, c.menu, 0.4);
    return {
        "fg-color": c.text, "bg-color": c.bg, "comfy-menu-bg": c.menu, "comfy-menu-secondary-bg": mix(c.menu, c.text, light ? 0.05 : 0.07),
        "comfy-input-bg": c.widget, "input-text": c.text, "descrip-text": sub, "drag-text": c.text, "error-text": "#ff4444",
        "border-color": c.line, "tr-even-bg-color": c.menu, "tr-odd-bg-color": mix(c.menu, c.text, 0.05),
        "content-bg": mix(c.menu, c.accent, 0.2), "content-fg": c.text, "content-hover-bg": mix(c.menu, c.accent, 0.12), "content-hover-fg": c.text,
        "bar-shadow": light ? "rgba(0,0,0,0.15) 0 0 0.5rem" : "rgba(0,0,0,0.5) 0 0 0.5rem",
    };
}
// кнопки ComfyUI пишут белым по главному цвету: темним цвет, пока белый текст не станет читаемым
export function buttonColor(col) {
    const [h, s, l] = toHsl(col);
    let out = col;
    for (let k = 0; k < 40 && contrast("#ffffff", out) < 3.2; k++) out = hsl(h, s, l - k * 0.015);
    return out;
}
export function uiTokens(n) {
    const c = n.c;
    const light = isLight(n);
    return {
        background: c.menu, foreground: c.text, card: mix(c.menu, c.text, light ? 0.04 : 0.06), popover: c.menu,
        primary: buttonColor(c.accent), secondary: mix(c.menu, c.text, light ? 0.06 : 0.09), muted: mix(c.menu, c.text, light ? 0.08 : 0.12),
        "muted-foreground": mix(c.text, c.menu, 0.4), accent: mix(c.menu, c.accent, 0.16), destructive: "#c4473a",
        border: mix(c.menu, c.line, 0.8), input: c.widget, ring: c.accent, node: c.body, "node-foreground": c.text,
        "node-header": c.title, "node-border": c.line, warning: "#fd9903", "shadow-color": light ? "rgb(0 0 0 / 0.15)" : "rgb(0 0 0 / 0.45)",
    };
}
// встречная дорога: палитра ComfyUI -> тема Neron (для вставки чужих палитр)
export function themeFromComfyPalette(p) {
    const lb = p.colors?.litegraph_base || {}, cb = p.colors?.comfy_base || {};
    const accent = hexOk(lb.LINK_COLOR) ? lb.LINK_COLOR : "#8ab4f8";
    const t = generateFromColor(accent, { light: !!p.light_theme, name: String(p.name || "ComfyUI palette") });
    const take = (k, v) => { if (hexOk(v)) t.c[k] = v.toLowerCase(); };
    take("bg", lb.CLEAR_BACKGROUND_COLOR); take("title", lb.NODE_DEFAULT_COLOR); take("body", lb.NODE_DEFAULT_BGCOLOR);
    take("text", lb.NODE_TEXT_COLOR); take("widget", lb.WIDGET_BGCOLOR); take("line", lb.WIDGET_OUTLINE_COLOR);
    take("link", lb.LINK_COLOR); take("menu", cb["comfy-menu-bg"]);
    return t;
}

// сетка фона: маленькая картинка-плитка (как у ComfyUI)
const gridCache = new Map();
export function gridImage(t) {
    const key = t.c.bg + t.c.grid;
    if (gridCache.has(key)) return gridCache.get(key);
    const cv = document.createElement("canvas");
    cv.width = 100; cv.height = 100;
    const g = cv.getContext("2d");
    g.fillStyle = t.c.bg; g.fillRect(0, 0, 100, 100);
    g.fillStyle = t.c.grid;
    for (let i = 0; i < 100; i += 10) { g.fillRect(i, 0, 1, 100); g.fillRect(0, i, 100, 1); }
    g.fillStyle = mix(t.c.grid, t.c.text, 0.08);
    g.fillRect(0, 0, 1, 100); g.fillRect(0, 0, 100, 1);
    const url = cv.toDataURL("image/png");
    gridCache.set(key, url);
    return url;
}
