// 📝 Neron H3 Бланк промпта / Prompt Form — окна бланка прямо в ноде.
// Весь бланк хранится в скрытом поле «form» (JSON). Склейка — та же, что в form.py (держать одинаковой!).
import { app } from "../../scripts/app.js";

const NODE = "NeronH3PromptForm";
const SECTIONS = ["place", "heroes", "action", "camera", "sound", "speech", "music", "pictures"];

// ---------------- надписи: RU / EN ----------------
const UI = {
    RU: {
        place: ["🌍 Место и время", "держит эпоху и настроение до конца ролика",
            "напр.: 1978 год, гараж на окраине городка, поздняя осень, вечер. Одна лампа под жестяным абажуром. Настроение тихое, усталое."],
        heroes: ["👤 Герои и механизмы", "каждого — с новой строки; у машин — стоит / едет",
            "напр.:\nМужчина лет 55, седые усы, кепка, засаленная клетчатая рубашка, на руках мазут.\nМотоцикл «Урал» с коляской, тёмно-зелёный, стоит на месте, заглушен."],
        action: ["🎬 Действие", "что происходит, по порядку; можно по секундам",
            "напр.:\n0–2 с: мужчина затягивает гайку, ключ срывается.\n2–4 с: трясёт ушибленной рукой.\n4–5 с: садится на ящик, вытирает лоб."],
        camera: ["🎥 Камера", "без этого H3 сама гуляет камерой или режет план",
            "напр.: стоит у ворот на уровне груди, не двигается. Один непрерывный план."],
        sound: ["🔊 Звук сцены", "что реально слышно в кадре",
            "напр.: скрип ключа, звон металла о бетон, гудение лампы, дождь по жестяной крыше."],
        speech: ["🗣 Речь", "слова — в кавычках «…»; пусто — никто не говорит",
            "напр.: мужчина хрипло, по-русски, себе под нос: «Ну и зараза…»\nкаждая реплика — с новой строки"],
        music: ["🎵 Музыка", "отдельно от шумов; пусто — без музыки",
            "напр.: тихая гитара издалека, из радиоприёмника"],
        pictures: ["🖼 Картинки", "кто или что на каждом образце",
            "напр.: <Picture 1> — этот мужчина, <Picture 2> — этот мотоцикл"],
        time: "⏱ Длина ролика", timeHint: "пишется в начало промпта — движки любят знать время", sec: "с",
        timeOpt: "Длина ролика в начале промпта",
        format: "Формат:", fmtH3: "родной H3", fmtText: "простой текст",
        noSpeech: "Речь пуста → дописать «Голосов и речи нет.»",
        preview: "👁 Что уйдёт в движок", empty: "Заполни участки — здесь появится готовый промпт.",
        chars: "знаков", of: "из", filled: "участков", copy: "📋 Копировать", copied: "✓ Скопировано",
        expert: "⚙ эксперт", help: "📖 справка",
        links: "Связки между участками («В кадре:», «Камера:»…) — для простого текста",
        noMusic: "Музыка пуста → «Без музыки» (в H3: N/A)",
        clear: "🧹 Очистить бланк", clearAsk: "Очистить все участки бланка?",
    },
    EN: {
        place: ["🌍 Place and time", "keeps the era and mood to the end of the clip",
            "e.g.: 1978, a garage on the edge of a small town, late autumn, evening. One lamp under a tin shade. Quiet, tired mood."],
        heroes: ["👤 Characters and machines", "each on a new line; for machines — parked / moving",
            "e.g.:\nA man of about 55, grey moustache, cap, greasy checked shirt, oil on his hands.\nA dark green Ural motorcycle with a sidecar, parked, engine off."],
        action: ["🎬 Action", "what happens, in order; per second is fine",
            "e.g.:\n0–2 s: the man tightens a nut, the wrench slips.\n2–4 s: he shakes his hurt hand.\n4–5 s: sits on a crate, wipes his forehead."],
        camera: ["🎥 Camera", "without it H3 moves the camera or cuts on its own",
            "e.g.: stands at the gate at chest height, does not move. One continuous shot."],
        sound: ["🔊 Scene sound", "what is really heard in the frame",
            "e.g.: the wrench creaking, metal ringing on concrete, the lamp humming, rain on the tin roof."],
        speech: ["🗣 Speech", "words in quotes \"…\"; empty — nobody speaks",
            "e.g.: the man, hoarse, in English, under his breath: \"Damn thing…\"\neach line on a new line"],
        music: ["🎵 Music", "separate from noises; empty — no music",
            "e.g.: a quiet guitar far away, from a radio"],
        pictures: ["🖼 Pictures", "who or what is on each reference",
            "e.g.: <Picture 1> — this man, <Picture 2> — this motorcycle"],
        time: "⏱ Clip length", timeHint: "goes to the start of the prompt — engines like to know the time", sec: "s",
        timeOpt: "Clip length at the start of the prompt",
        format: "Format:", fmtH3: "native H3", fmtText: "plain text",
        noSpeech: "Speech empty → add «No voices or speech.»",
        preview: "👁 What goes to the engine", empty: "Fill in the sections — the finished prompt appears here.",
        chars: "chars", of: "of", filled: "sections", copy: "📋 Copy", copied: "✓ Copied",
        expert: "⚙ expert", help: "📖 help",
        links: "Links between sections («In the frame:», «Camera:»…) — plain text only",
        noMusic: "Music empty → «No music» (in H3: N/A)",
        clear: "🧹 Clear the form", clearAsk: "Clear all sections of the form?",
    },
};

const HELP = `📝 NERON H3 БЛАНК ПРОМПТА

🇷🇺 ЗАЧЕМ
H3 лучше всего работает с подробным промптом. Обычно его пишут «простынёй» — и теряют половину: забыли звук, не сказали про камеру, смешали двух героев в одну фразу. Бланк делит промпт на участки: у каждого видно, что сюда писать и зачем. Пишешь сам — это не автопромтер. Нода собирает всё в один промпт и отдаёт его проводом в движок.

КАК
0. ⏱ Длина ролика — ползунок сверху (1–15 с). Нода сама пишет её в начало промпта. Ставь ту же длину, что в движке.
1. Заполни нужные участки. Пустые в промпт не идут — для простой сцены хватит двух-трёх.
2. Герои — каждый с новой строки. У машин и механизмов укажи состояние: стоит, едет, заглушена.
3. Действие — по порядку, можно по секундам («0–2 с: …»).
4. Речь — слова в кавычках «…», каждая реплика с новой строки, лучше указать язык («по-русски»). Пусто или «нет» — никто не говорит.
5. Внизу — «Что уйдёт в движок»: ровно тот текст, что получит модель.
6. Выход «prompt» — в вход prompt движка (например, 🎬 Neron H3 Engine — Hard).

ФОРМАТ (⚙ эксперт)
• Родной H3 (по умолчанию) — так модель учили: поля summary, subject_definitions, integrated_multimodal_description, overall_soundscape, non_diegetic_music. Названия полей английские — это служебные метки, их ставит нода. Твой текст остаётся на твоём языке. Реплики идут как (S1) <d>слова</d>; нет реплик — нет <d>. Музыки нет — N/A.
• Простой текст — связный абзац со связками («В кадре:», «Камера:»…).
Сравни оба на одном бланке — где модель слушается лучше.

ЯЗЫК
Пиши на русском или английском — H3 понимает оба. Плашка RU / EN меняет только надписи ноды.

ОБРАЗЦЫ
<Картинка 1>, <image 2> и т. п. нода сама превратит в <Picture 1>, <Picture 2> — так модель их узнаёт.

────────────────────────

📝 NERON H3 PROMPT FORM

🇬🇧 WHY
H3 works best with a detailed prompt. People usually write one long wall of text and lose half of it: forgot the sound, said nothing about the camera, merged two characters into one phrase. The form splits the prompt into sections, each showing what goes there and why. You write it yourself — this is not an autoprompter. The node builds one prompt and sends it to the engine by wire.

HOW
0. ⏱ Clip length — the slider at the top (1–15 s). The node writes it at the start of the prompt. Set the same length as in the engine.
1. Fill in the sections you need. Empty ones are skipped — two or three are enough for a simple scene.
2. Characters — each on a new line. For cars and machines give their state: parked, moving, engine off.
3. Action — in order, per second is fine ("0–2 s: …").
4. Speech — words in quotes "…", each line on a new line, better name the language ("in English"). Empty or "no" — nobody speaks.
5. At the bottom, "What goes to the engine" shows exactly the text the model gets.
6. The "prompt" output goes into the engine's prompt input (e.g. 🎬 Neron H3 Engine — Hard).

FORMAT (⚙ expert)
• Native H3 (default) — the way the model was trained: fields summary, subject_definitions, integrated_multimodal_description, overall_soundscape, non_diegetic_music. Field names are English service labels set by the node; your text stays in your language. Speech goes as (S1) <d>words</d>; no speech — no <d>. No music — N/A.
• Plain text — one paragraph with links ("In the frame:", "Camera:"…).
Compare both on the same form to see which the model follows better.

LANGUAGE
Write in Russian or English — H3 understands both. The RU / EN switch changes only the node's labels.

REFERENCES
<Картинка 1>, <image 2> etc. become <Picture 1>, <Picture 2> — that is how the model recognises them.`;

// ---------------- склейка (как form.py) ----------------
const LINKS = {
    RU: { hero1: "В кадре: ", heroN: "Также в кадре: ", first: "Сначала: ", then: "Затем: ", last: "В конце: ",
          camera: "Камера: ", sound: "Звук сцены: ", speech: "Речь: ", music: "Музыка: ", no_music: "Без музыки.",
          pictures: "Образцы: ", camera_word: ["камер"], is: " — ", static: "Камера неподвижна.",
          no_speech: "Голосов и речи нет." },
    EN: { hero1: "In the frame: ", heroN: "Also in the frame: ", first: "First: ", then: "Then: ", last: "Finally: ",
          camera: "Camera: ", sound: "Scene sound: ", speech: "Speech: ", music: "Music: ", no_music: "No music.",
          pictures: "References: ", camera_word: ["camera"], is: " is ", static: "The camera remains static.",
          no_speech: "No voices or speech." },
};
const BULLET = /^\s*(?:\d{1,2}\s*[).]|[-–—•*])\s+/u;
const TIME = /^\s*\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:с|сек|s|sec)(?![\p{L}\p{N}_])/iu;
const TAG = /<\s*(?:картинка|картинке|изображение|фото|picture|image|pic|img)\s*(\d+)\s*>/giu;
const QUOTE = /«([^»]*)»|“([^”]*)”|"([^"]*)"/gu;
const ENDS = ".!?…";
const NEG = new Set(["нет", "не", "без", "ничего", "никакой", "никакая", "никакой музыки", "без музыки", "без речи",
    "тишина", "no", "none", "nothing", "n/a", "na", "-", "—", "–", "0"]);

function end(s) {
    s = s.trim();
    if (!s) return s;
    const last = s[s.length - 1];
    if (ENDS.includes(last)) return s;
    if ("»\"”)'".includes(last) && s.length > 1 && ENDS.includes(s[s.length - 2])) return s;
    return s + ".";
}
function lines(text) {
    return String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(BULLET, "").trim()).filter(Boolean);
}
function negative(ls) {
    const t = ls.join(" ").trim().toLowerCase().replace(/^[.!…,; ]+|[.!…,; ]+$/gu, "");
    return NEG.has(t);
}
// язык связок — по самому тексту (как text_lang в form.py); плашка RU / EN меняет только надписи
function textLang(data) {
    const allt = SECTIONS.map((k) => String(data[k] || "")).join(" ").replace(TAG, " ");
    const cyr = (allt.match(/[а-яё]/giu) || []).length;
    const lat = (allt.match(/[a-z]/gi) || []).length;
    if (cyr || lat) return cyr >= lat ? "RU" : "EN";
    return String(data.lang || "RU").toUpperCase() === "EN" ? "EN" : "RU";
}
const SEC_MIN = 1, SEC_MAX = 15, SEC_DEFAULT = 5, FPS = 24;
function seconds(data) {
    let v = Math.round(Number(data.seconds ?? SEC_DEFAULT));
    if (!Number.isFinite(v)) v = SEC_DEFAULT;
    return Math.max(SEC_MIN, Math.min(SEC_MAX, v));
}
function gridFrames(sec) {
    let n = Math.max(5, sec * FPS);
    while (n % 17 !== 5) n++;
    return n;
}
function gridSecondsText(sec) {
    const c = Math.floor((gridFrames(sec) * 200 + FPS) / (2 * FPS));
    return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}
function durationLine(n, lang) {
    if (lang === "EN") return `Video duration: ${n} second${n === 1 ? "" : "s"} (0–${n} s).`;
    const word = (n % 10 === 1 && n % 100 !== 11) ? "секунда"
        : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) ? "секунды" : "секунд";
    return `Длительность ролика — ${n} ${word} (0–${n} с).`;
}
function dialogue(line, k) {
    const body = line.replace(QUOTE, (m, a, b, c) => "<d>" + [a, b, c].find((g) => g !== undefined).trim() + "</d>");
    return `(S${k}) ` + end(body);
}
const joined = (ls) => ls.map(end).join(" ");

function compileText(data, f, lang) {
    const L = LINKS[lang];
    const useLinks = data.links !== false, noMusic = data.no_music !== false, noSpeech = data.no_speech !== false;
    const parts = [];
    if (f.place.length) parts.push(joined(f.place));
    if (f.heroes.length) {
        parts.push(useLinks ? f.heroes.map((h, i) => end((i === 0 ? L.hero1 : L.heroN) + h)).join(" ")
                            : joined(f.heroes));
    }
    if (f.action.length) {
        const a = f.action;
        if (!useLinks || a.length === 1 || a.some((x) => TIME.test(x))) parts.push(joined(a));
        else parts.push(a.map((x, i) => end((i === 0 ? L.first : i === a.length - 1 ? L.last : L.then) + x)).join(" "));
    }
    for (const key of ["camera", "sound", "speech", "music", "pictures"]) {
        const ls = f[key];
        if (!ls.length) continue;
        let text = joined(ls);
        if (useLinks) {
            if (key === "camera" && L.camera_word.some((w) => text.toLowerCase().startsWith(w))) { parts.push(text); continue; }
            text = L[key] + text;
        }
        parts.push(text);
    }
    if (useLinks && noSpeech && !f.speech.length && parts.length) parts.push(L.no_speech);
    if (useLinks && noMusic && !f.music.length && parts.length) parts.push(L.no_music);
    if (parts.length && data.time !== false) parts.unshift(durationLine(seconds(data), lang));
    return parts.join(" ");
}

function compileH3(data, f, lang) {
    const L = LINKS[lang];
    const noMusic = data.no_music !== false, noSpeech = data.no_speech !== false;
    if (!["place", "heroes", "action", "camera", "sound", "speech", "music"].some((k) => f[k].length)) return "";
    const blocks = [], head = [];
    if (f.pictures.length) head.push("How the reference pictures align with the target video - " + joined(f.pictures));
    if (data.time !== false) head.push(`Target duration ${gridSecondsText(seconds(data))} seconds.`);
    if (head.length) blocks.push(head.join(" "));
    const summary = joined(f.place.concat(f.action.slice(0, 1)));
    if (summary) blocks.push("summary:\n" + summary);
    if (f.heroes.length) {
        blocks.push("subject_definitions:\n" + f.heroes.map((h, i) => end(`<Subject ${i + 1}>${L.is}${h.replace(/\.+$/u, "")}`)).join("\n"));
    }
    const shot = [f.camera.length ? joined(f.camera) : L.static];
    if (f.action.length) shot.push(joined(f.action));
    f.speech.forEach((s, i) => shot.push(dialogue(s, i + 1)));
    blocks.push("integrated_multimodal_description: [Shot 1] " + shot.join(" "));
    let sound = joined(f.sound);
    if (noSpeech && !f.speech.length) sound = (sound + " " + L.no_speech).trim();
    if (sound) blocks.push("overall_soundscape: " + sound);
    if (f.music.length) blocks.push("non_diegetic_music: " + joined(f.music));
    else if (noMusic) blocks.push("non_diegetic_music: N/A");
    return blocks.join("\n\n");
}

export function compileForm(data) {
    const lang = textLang(data);
    const f = {};
    for (const k of SECTIONS) f[k] = lines(data[k]);
    for (const k of ["speech", "music"]) if (negative(f[k])) f[k] = [];
    const out = String(data.format || "h3") === "text" ? compileText(data, f, lang) : compileH3(data, f, lang);
    return out.replace(TAG, (_, n) => `<Picture ${n}>`).trim();
}

// ---------------- оформление ----------------
const CSS = `
.nrf{box-sizing:border-box;width:100%;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#e6e6e6;padding:2px 2px 6px}
.nrf *{box-sizing:border-box}
.nrf-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.nrf-pill{background:#262626;border:1px solid #555;border-radius:14px;padding:3px 11px;font-size:12px;color:#bbb;cursor:pointer;user-select:none}
.nrf-pill:hover{border-color:#888;color:#fff}
.nrf-pill.on{background:#3d5a80;border-color:#6d9ad0;color:#fff}
.nrf-sp{flex:1}
.nrf-sec{margin-bottom:7px}
.nrf-time{display:flex;align-items:center;gap:10px;margin:2px 0 4px}
.nrf-time input[type=range]{flex:1;accent-color:#6d9ad0;cursor:pointer}
.nrf-time .v{min-width:46px;text-align:right;font-weight:600;color:#fff;font-size:14px}
.nrf-time.off{opacity:.45}
.nrf-lab{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:2px}
.nrf-lab b{color:#f0f0f0;font-weight:600;white-space:nowrap}
.nrf-lab i{color:#8d9aa8;font-style:normal;font-size:11.5px;text-align:right}
.nrf textarea{display:block;width:100%;resize:none;overflow:hidden;background:#222;color:#e8e8e8;border:1px solid #4b4b4b;
  border-left:3px solid #555;border-radius:6px;padding:6px 8px;font:12.5px/1.42 "Segoe UI",Arial,sans-serif;min-height:32px}
.nrf textarea:focus{outline:none;border-color:#6d9ad0}
.nrf textarea.ok{border-left-color:#5fb36b}
.nrf textarea::placeholder{color:#6f6f6f;font-style:italic}
.nrf-exp{background:#2b2b2b;border:1px solid #444;border-radius:6px;padding:6px 9px;margin-bottom:8px;font-size:12px;color:#ccc}
.nrf-exp label{display:flex;gap:7px;align-items:center;margin:3px 0;cursor:pointer}
.nrf-prevh{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#9cc3f0;margin:10px 0 3px}
.nrf-prevh span.n{color:#7d8b99;font-size:11.5px}
.nrf-prev{background:#1d2530;border:1px solid #3d5a80;border-radius:6px;padding:7px 9px;font-size:12px;line-height:1.45;color:#cfe0f5;
  white-space:pre-wrap;word-break:break-word;min-height:34px;user-select:text}
.nrf-prev.empty{color:#6c7a8a;font-style:italic}
.nrf-help{position:fixed;inset:0;background:#000a;z-index:10000;display:flex;align-items:center;justify-content:center}
.nrf-help>div{background:#2a2a2a;color:#e6e6e6;border:1px solid #555;border-radius:10px;max-width:760px;width:92vw;max-height:84vh;
  overflow:auto;padding:18px 22px;white-space:pre-wrap;font:13px/1.5 "Segoe UI",Arial,sans-serif;position:relative}
.nrf-help button{position:sticky;top:0;float:right;background:#3d5a80;color:#fff;border:0;border-radius:6px;padding:4px 12px;cursor:pointer}
`;
function addCss() {
    if (document.getElementById("neron-prompt-form-css")) return;
    const s = document.createElement("style");
    s.id = "neron-prompt-form-css";
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
    const wrap = el("div", "nrf-help");
    const box = el("div");
    const close = el("button", null, "✕");
    close.onclick = () => wrap.remove();
    box.appendChild(close);
    box.appendChild(document.createTextNode(HELP));
    wrap.appendChild(box);
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    document.body.appendChild(wrap);
}

// ---------------- нода ----------------
function hideWidget(w) {
    if (!w) return;
    w.hidden = true;
    w.type = "hidden";
    w.computeSize = () => [0, -4];
}

function readState(node) {
    const w = node.widgets?.find((x) => x.name === "form");
    let data = {};
    try { data = JSON.parse(w?.value || "{}") || {}; } catch (_) { data = { action: String(w?.value || ""), links: false }; }
    if (typeof data !== "object" || Array.isArray(data)) data = {};
    if (!data.lang) data.lang = defaultLang();
    if (data.seconds == null) data.seconds = SEC_DEFAULT;
    if (!data.format) data.format = "h3";
    return data;
}
function writeState(node) {
    const w = node.widgets?.find((x) => x.name === "form");
    if (w) w.value = JSON.stringify(node.__nrf.state);
}

function build(node) {
    addCss();
    const st = { state: readState(node), boxes: {}, labels: {} };
    node.__nrf = st;
    const root = el("div", "nrf");
    const inner = el("div");
    root.appendChild(inner);
    // мышь и клавиши — окнам, а не холсту
    for (const ev of ["pointerdown", "mousedown", "wheel", "keydown", "contextmenu"]) {
        root.addEventListener(ev, (e) => { if (e.target.closest("textarea,.nrf-prev")) e.stopPropagation(); }, { passive: true });
    }

    const bar = el("div", "nrf-bar");
    const ru = el("span", "nrf-pill", "RU");
    const en = el("span", "nrf-pill", "EN");
    const exp = el("span", "nrf-pill");
    const hlp = el("span", "nrf-pill");
    bar.append(ru, en, el("span", "nrf-sp"), exp, hlp);
    inner.appendChild(bar);

    const timeSec = el("div", "nrf-sec");
    const timeLab = el("div", "nrf-lab");
    const tb = el("b"), ti = el("i");
    timeLab.append(tb, ti);
    const timeRow = el("div", "nrf-time");
    const range = document.createElement("input");
    range.type = "range"; range.min = SEC_MIN; range.max = SEC_MAX; range.step = 1;
    range.value = seconds(st.state);
    const tv = el("span", "v");
    timeRow.append(range, tv);
    timeSec.append(timeLab, timeRow);
    inner.appendChild(timeSec);
    range.addEventListener("input", () => { st.state.seconds = Number(range.value); paintTime(); changed(); });
    for (const ev of ["pointerdown", "mousedown", "wheel"]) range.addEventListener(ev, (e) => e.stopPropagation());

    const expBox = el("div", "nrf-exp");
    const mk = (key) => {
        const lab = el("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = st.state[key] !== false;
        cb.onchange = () => { st.state[key] = cb.checked; changed(); };
        const t = el("span");
        lab.append(cb, t);
        expBox.appendChild(lab);
        return t;
    };
    const fmtRow = el("div");
    fmtRow.style.cssText = "display:flex;gap:6px;align-items:center;margin:2px 0 5px";
    const fmtLab = el("span"), fH3 = el("span", "nrf-pill"), fText = el("span", "nrf-pill");
    fmtRow.append(fmtLab, fH3, fText);
    expBox.appendChild(fmtRow);
    fH3.onclick = () => { st.state.format = "h3"; changed(); paint(); };
    fText.onclick = () => { st.state.format = "text"; changed(); paint(); };
    const tTime = mk("time");
    const tNoSpeech = mk("no_speech");
    const tLinks = mk("links");
    const tNoMusic = mk("no_music");
    const clr = el("span", "nrf-pill");
    clr.style.display = "inline-block";
    clr.style.marginTop = "4px";
    expBox.appendChild(clr);
    inner.appendChild(expBox);

    for (const key of SECTIONS) {
        const sec = el("div", "nrf-sec");
        const lab = el("div", "nrf-lab");
        const b = el("b"), i = el("i");
        lab.append(b, i);
        const ta = document.createElement("textarea");
        ta.rows = 1;
        ta.spellcheck = false;
        ta.value = st.state[key] || "";
        ta.addEventListener("input", () => { st.state[key] = ta.value; grow(ta); changed(); });
        sec.append(lab, ta);
        inner.appendChild(sec);
        st.boxes[key] = ta;
        st.labels[key] = [b, i];
    }

    const prevh = el("div", "nrf-prevh");
    const prevTitle = el("span");
    const right = el("span");
    const count = el("span", "n");
    const copy = el("span", "nrf-pill");
    copy.style.marginLeft = "8px";
    right.append(count, copy);
    prevh.append(prevTitle, right);
    const prev = el("div", "nrf-prev");
    inner.append(prevh, prev);

    function grow(ta) {
        ta.style.height = "auto";
        ta.style.height = Math.max(32, ta.scrollHeight + 2) + "px";
    }
    function lang() { return st.state.lang === "EN" ? "EN" : "RU"; }
    function paintTime() {
        const T = UI[lang()];
        tv.textContent = `${seconds(st.state)} ${T.sec}`;
        timeRow.classList.toggle("off", st.state.time === false);
    }
    function paint() {
        const T = UI[lang()];
        ru.classList.toggle("on", lang() === "RU");
        en.classList.toggle("on", lang() === "EN");
        exp.textContent = T.expert;
        exp.classList.toggle("on", !!st.state.expert);
        hlp.textContent = T.help;
        expBox.style.display = st.state.expert ? "" : "none";
        tb.textContent = T.time;
        ti.textContent = T.timeHint;
        tTime.textContent = T.timeOpt;
        paintTime();
        fmtLab.textContent = T.format;
        fH3.textContent = T.fmtH3;
        fText.textContent = T.fmtText;
        const h3 = (st.state.format || "h3") !== "text";
        fH3.classList.toggle("on", h3);
        fText.classList.toggle("on", !h3);
        tNoSpeech.textContent = T.noSpeech;
        tLinks.parentElement.style.opacity = h3 ? "0.45" : "1";
        tLinks.textContent = T.links;
        tNoMusic.textContent = T.noMusic;
        clr.textContent = T.clear;
        for (const key of SECTIONS) {
            const [b, i] = st.labels[key];
            b.textContent = T[key][0];
            i.textContent = T[key][1];
            st.boxes[key].placeholder = T[key][2];
        }
        prevTitle.textContent = T.preview;
        copy.textContent = T.copy;
        refresh();
    }
    function refresh() {
        const T = UI[lang()];
        let n = 0;
        for (const key of SECTIONS) {
            const ls = lines(st.state[key]);
            const ok = ls.length > 0 && !((key === "speech" || key === "music") && negative(ls));
            st.boxes[key].classList.toggle("ok", ok);
            if (ok) n++;
        }
        const text = compileForm(st.state);
        prev.textContent = text || T.empty;
        prev.classList.toggle("empty", !text);
        count.textContent = `${text.length} ${T.chars} · ${n} ${T.of} ${SECTIONS.length} ${T.filled}`;
        for (const key of SECTIONS) grow(st.boxes[key]);
        fit();
    }
    function changed() { writeState(node); refresh(); }

    ru.onclick = () => { st.state.lang = "RU"; writeState(node); paint(); };
    en.onclick = () => { st.state.lang = "EN"; writeState(node); paint(); };
    exp.onclick = () => { st.state.expert = !st.state.expert; writeState(node); paint(); };
    hlp.onclick = () => showHelp();
    clr.onclick = () => {
        if (!confirm(UI[lang()].clearAsk)) return;
        for (const key of SECTIONS) { st.state[key] = ""; st.boxes[key].value = ""; }
        changed();
    };
    copy.onclick = async () => {
        const text = compileForm(st.state);
        if (!text) return;
        try { await navigator.clipboard.writeText(text); } catch (_) {
            const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
            try { document.execCommand("copy"); } catch (_) {} t.remove();
        }
        copy.textContent = UI[lang()].copied;
        setTimeout(() => { copy.textContent = UI[lang()].copy; }, 1200);
    };

    // высота ноды — по содержимому
    let lastH = 0;
    function contentH() { return Math.ceil(inner.scrollHeight) + 10; }
    function fit() {
        requestAnimationFrame(() => {
            const h = contentH();
            if (Math.abs(h - lastH) < 2) return;
            lastH = h;
            try {
                const sz = node.computeSize();
                node.setSize([Math.max(node.size[0], sz[0]), sz[1]]);
            } catch (_) {}
            app.graph?.setDirtyCanvas(true, true);
        });
    }

    const w = node.addDOMWidget("neron_prompt_form", "neron_prompt_form", root, {
        serialize: false, hideOnZoom: false,
        getMinHeight: () => contentH(), getHeight: () => contentH(),
    });
    if (w) {
        w.serialize = false;
        w.computeSize = (width) => [width, contentH()];
    }
    st.reload = () => {
        st.state = readState(node);
        for (const key of SECTIONS) st.boxes[key].value = st.state[key] || "";
        const cbs = expBox.querySelectorAll("input");
        cbs[0].checked = st.state.time !== false;
        cbs[1].checked = st.state.no_speech !== false;
        cbs[2].checked = st.state.links !== false;
        cbs[3].checked = st.state.no_music !== false;
        range.value = seconds(st.state);
        paint();
    };
    writeState(node);
    paint();
    // DOM-окна меряются только после вставки в страницу
    setTimeout(() => { lastH = 0; refresh(); }, 50);
    setTimeout(() => { lastH = 0; refresh(); }, 400);
}

app.registerExtension({
    name: "Neron.H3PromptForm",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== NODE) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created?.apply(this, arguments);
            hideWidget(this.widgets?.find((x) => x.name === "form"));
            try { build(this); } catch (e) { console.error("[Neron H3 Бланк]", e); }
            if (this.size[0] < 560) this.setSize([560, this.size[1]]);
            return r;
        };
        const configure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = configure?.apply(this, arguments);
            try { this.__nrf?.reload(); } catch (e) { console.error("[Neron H3 Бланк]", e); }
            return r;
        };
    },
});
