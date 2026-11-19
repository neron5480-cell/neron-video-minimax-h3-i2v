// 🎬 Neron H3 AutoPrompter — Бланк / Form: лицо — бланк, мотор — LLM.
// Бланк хранится в скрытом поле «form» (JSON). Настройки LLM — родные поля ноды, спрятаны; их правит панель ⚙.
// Склейка «без LLM» — та же, что в form.py (держать одинаковой! test_form.py сверяет).
import { app } from "../../scripts/app.js";

const NODE = "NeronH3AutoPrompterBlank";
const SECTIONS = ["place", "heroes", "action", "camera", "sound", "speech", "music", "pictures"];
const LLM_WIDGETS = ["model", "mmproj", "system_prompt", "max_tokens", "temperature", "n_ctx", "n_gpu_layers",
    "unload_after", "auto_download"];

// ---------------- надписи: RU / EN ----------------
const UI = {
    RU: {
        place: ["🌍 Место и время", "держит эпоху и настроение до конца ролика",
            "напр.: 1978 год, гараж на окраине городка, поздняя осень, вечер. Одна лампа под жестяным абажуром. Настроение тихое, усталое."],
        heroes: ["👤 Герои и механизмы", "каждого — с новой строки; у машин — стоит / едет",
            "напр.:\nМужчина лет 55, седые усы, кепка, засаленная клетчатая рубашка, на руках мазут.\nМотоцикл «Урал» с коляской, тёмно-зелёный, стоит на месте, заглушен."],
        action: ["🎬 Действие", "что происходит, по порядку; можно по секундам",
            "напр.:\n0–2 с: мужчина затягивает гайку, ключ срывается.\n2–4 с: трясёт ушибленной рукой.\n4–5 с: садится на ящик, вытирает лоб."],
        camera: ["🎥 Камера", "как написано — так и снимет; пусто — неподвижна",
            "напр.: стоит у ворот на уровне груди, не двигается. Или: медленно облетает машину по кругу."],
        sound: ["🔊 Звук сцены", "что реально слышно в кадре",
            "напр.: скрип ключа, звон металла о бетон, гудение лампы, дождь по жестяной крыше."],
        speech: ["🗣 Речь", "слова — в кавычках «…»; пусто — никто не говорит",
            "напр.: мужчина хрипло, по-русски, себе под нос: «Ну и зараза…»\nкаждая реплика — с новой строки"],
        music: ["🎵 Музыка", "отдельно от шумов; пусто — без музыки",
            "напр.: тихая гитара издалека, из радиоприёмника"],
        pictures: ["🖼 Картинки", "кто или что на каждой картинке (image_0 = <Picture 1>…)",
            "напр.: <Picture 1> — этот мужчина, <Picture 2> — этот мотоцикл"],
        time: "⏱ Длина ролика", timeHint: "кадры уходят в движок сами (frames_count)", sec: "с",
        preview: "👁 Что уйдёт в движок",
        waitLLM: "Нажми ▶ Run — LLM распишет бланк в подробный английский промпт, он появится здесь.",
        empty: "Заполни участки — здесь появится промпт.",
        stale: "⚠ бланк изменён после запуска — промпт обновится при следующем запуске",
        chars: "знаков", of: "из", filled: "участков", copy: "📋 Копировать", copied: "✓ Скопировано",
        expert: "⚙ эксперт", help: "📖 справка",
        useLLM: "LLM расписывает бланк (выкл — бланк сразу в движок, родной формат H3)",
        model: "модель", mmproj: "зрение (mmproj)", system_prompt: "системник", max_tokens: "лимит ответа",
        temperature: "температура", n_ctx: "окно памяти", n_gpu_layers: "слоёв на видеокарте (-1 — все)",
        unload_after: "выгружать LLM после запуска", auto_download: "скачивать LLM сама (Qwen 3.5 9B)",
        clear: "🧹 Очистить бланк", clearAsk: "Очистить все участки бланка?",
    },
    EN: {
        place: ["🌍 Place and time", "keeps the era and mood to the end of the clip",
            "e.g.: 1978, a garage on the edge of a small town, late autumn, evening. One lamp under a tin shade. Quiet, tired mood."],
        heroes: ["👤 Characters and machines", "each on a new line; for machines — parked / moving",
            "e.g.:\nA man of about 55, grey moustache, cap, greasy checked shirt, oil on his hands.\nA dark green Ural motorcycle with a sidecar, parked, engine off."],
        action: ["🎬 Action", "what happens, in order; per second is fine",
            "e.g.:\n0–2 s: the man tightens a nut, the wrench slips.\n2–4 s: he shakes his hurt hand.\n4–5 s: sits on a crate, wipes his forehead."],
        camera: ["🎥 Camera", "shot exactly as written; empty — static",
            "e.g.: stands at the gate at chest height, does not move. Or: slowly circles the car."],
        sound: ["🔊 Scene sound", "what is really heard in the frame",
            "e.g.: the wrench creaking, metal ringing on concrete, the lamp humming, rain on the tin roof."],
        speech: ["🗣 Speech", "words in quotes \"…\"; empty — nobody speaks",
            "e.g.: the man, hoarse, in English, under his breath: \"Damn thing…\"\neach line on a new line"],
        music: ["🎵 Music", "separate from noises; empty — no music",
            "e.g.: a quiet guitar far away, from a radio"],
        pictures: ["🖼 Pictures", "who or what is on each picture (image_0 = <Picture 1>…)",
            "e.g.: <Picture 1> — this man, <Picture 2> — this motorcycle"],
        time: "⏱ Clip length", timeHint: "frames go to the engine by themselves (frames_count)", sec: "s",
        preview: "👁 What goes to the engine",
        waitLLM: "Press ▶ Run — the LLM expands the form into a detailed English prompt, shown here.",
        empty: "Fill in the sections — the prompt appears here.",
        stale: "⚠ form changed after the run — the prompt updates on the next run",
        chars: "chars", of: "of", filled: "sections", copy: "📋 Copy", copied: "✓ Copied",
        expert: "⚙ expert", help: "📖 help",
        useLLM: "LLM expands the form (off — form straight to the engine, native H3 format)",
        model: "model", mmproj: "vision (mmproj)", system_prompt: "system prompt", max_tokens: "max answer",
        temperature: "temperature", n_ctx: "context", n_gpu_layers: "GPU layers (-1 — all)",
        unload_after: "unload the LLM after the run", auto_download: "download the LLM itself (Qwen 3.5 9B)",
        clear: "🧹 Clear the form", clearAsk: "Clear all sections of the form?",
    },
};

const HELP = `🎬 NERON H3 AUTOPROMPTER — БЛАНК

🇷🇺 ЧТО ЭТО
Бланк + автопромтер в одной ноде. H3 слушается только очень подробного промпта — и лучше всего по-английски (русский текст модель начинает «проговаривать» вслух). Ты коротко заполняешь участки — хоть по-русски, — а LLM (Qwen 3.5 9B, качается и запускается сама) расписывает их в подробный английский промпт в родном формате H3.

КАК
1. ⏱ Длина ролика — ползунок. Кадры уходят в движок сами: выход frames_count → вход length_in.
2. Заполни участки. Пустые не нужны: для простой сцены хватит трёх-четырёх.
3. Герои — каждый с новой строки. У машин и механизмов — состояние: стоит, едет, заглушена.
4. Камера — словами: как написал, так и снимет. Пусто — камера неподвижна. Пресетов нет — они не нужны.
5. Речь — слова в кавычках «…», лучше указать язык. Пусто или «нет» — никто не говорит. Музыка пуста — музыки нет.
6. Картинки — по желанию: image_0 = <Picture 1>, image_1 = <Picture 2>… last_frame — последний кадр. Нет картинок — текст → видео.
7. ▶ Run. Внизу появится готовый промпт — ровно то, что уйдёт в движок. Выход minimax_prompt → вход prompt движка.

⚙ ЭКСПЕРТ
Модель, зрение, системник, лимит ответа, температура, окно памяти, выгрузка после запуска (включена), автоскачивание. «LLM выкл» — бланк сразу в движок, без расписывания (быстро, но коротко).

────────────────────────

🎬 NERON H3 AUTOPROMPTER — FORM

🇬🇧 WHAT IT IS
A form and an autoprompter in one node. H3 follows only very detailed prompts — best in English (with Russian text the model starts speaking the prompt aloud). You fill in the sections briefly, in any language, and the LLM (Qwen 3.5 9B, downloads and starts by itself) expands them into a detailed English prompt in H3's native format.

HOW
1. ⏱ Clip length — the slider. Frames go to the engine by themselves: frames_count output → length_in input.
2. Fill in the sections. Two or three empty ones are fine.
3. Characters — each on a new line. For machines give their state: parked, moving, engine off.
4. Camera — in words: shot exactly as written. Empty — static. No presets — they are not needed.
5. Speech — words in quotes "…", better name the language. Empty or "no" — nobody speaks. Music empty — no music.
6. Pictures — optional: image_0 = <Picture 1>, image_1 = <Picture 2>… last_frame — the final frame. No pictures — text to video.
7. ▶ Run. The finished prompt appears at the bottom — exactly what goes to the engine. minimax_prompt output → engine prompt input.

⚙ EXPERT
Model, vision, system prompt, answer limit, temperature, context, unload after run (on), auto download. "LLM off" — the form goes straight to the engine without expansion (fast but short).`;

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
.nap{box-sizing:border-box;width:100%;font:13px/1.4 "Segoe UI",Arial,sans-serif;color:#e6e6e6;padding:2px 2px 6px}
.nap *{box-sizing:border-box}
.nap-bar{display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.nap-pill{background:#262626;border:1px solid #555;border-radius:14px;padding:3px 11px;font-size:12px;color:#bbb;cursor:pointer;user-select:none}
.nap-pill:hover{border-color:#888;color:#fff}
.nap-pill.on{background:#3d5a80;border-color:#6d9ad0;color:#fff}
.nap-sp{flex:1}
.nap-sec{margin-bottom:7px}
.nap-time{display:flex;align-items:center;gap:10px;margin:2px 0 4px}
.nap-time input[type=range]{flex:1;accent-color:#6d9ad0;cursor:pointer}
.nap-time .v{min-width:46px;text-align:right;font-weight:600;color:#fff;font-size:14px}
.nap-lab{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:2px}
.nap-lab b{color:#f0f0f0;font-weight:600;white-space:nowrap}
.nap-lab i{color:#8d9aa8;font-style:normal;font-size:11.5px;text-align:right}
.nap textarea{display:block;width:100%;resize:none;overflow:hidden;background:#222;color:#e8e8e8;border:1px solid #4b4b4b;
  border-left:3px solid #555;border-radius:6px;padding:6px 8px;font:12.5px/1.42 "Segoe UI",Arial,sans-serif;min-height:32px}
.nap textarea:focus{outline:none;border-color:#6d9ad0}
.nap textarea.ok{border-left-color:#5fb36b}
.nap textarea::placeholder{color:#6f6f6f;font-style:italic}
.nap-exp{background:#2b2b2b;border:1px solid #444;border-radius:6px;padding:6px 9px;margin-bottom:8px;font-size:12px;color:#ccc}
.nap-exp label{display:flex;gap:7px;align-items:center;margin:3px 0;cursor:pointer}
.nap-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;margin:6px 0}
.nap-grid span{color:#aab}
.nap-grid select,.nap-grid input{width:100%;background:#222;color:#e8e8e8;border:1px solid #4b4b4b;border-radius:5px;padding:3px 6px;font:12px "Segoe UI",Arial,sans-serif}
.nap-prevh{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#9cc3f0;margin:10px 0 3px}
.nap-prevh span.n{color:#7d8b99;font-size:11.5px}
.nap-prev{background:#1d2530;border:1px solid #3d5a80;border-radius:6px;padding:7px 9px;font-size:12px;line-height:1.45;color:#cfe0f5;
  white-space:pre-wrap;word-break:break-word;min-height:34px;user-select:text;max-height:420px;overflow:auto}
.nap-prev.empty{color:#6c7a8a;font-style:italic}
.nap-note{font-size:11.5px;color:#8d9aa8;margin-top:3px}
.nap-note.warn{color:#e0b860}
.nap-help{position:fixed;inset:0;background:#000a;z-index:10000;display:flex;align-items:center;justify-content:center}
.nap-help>div{background:#2a2a2a;color:#e6e6e6;border:1px solid #555;border-radius:10px;max-width:760px;width:92vw;max-height:84vh;
  overflow:auto;padding:18px 22px;white-space:pre-wrap;font:13px/1.5 "Segoe UI",Arial,sans-serif;position:relative}
.nap-help button{position:sticky;top:0;float:right;background:#3d5a80;color:#fff;border:0;border-radius:6px;padding:4px 12px;cursor:pointer}
`;
function addCss() {
    if (document.getElementById("neron-h3-autoprompter-blank-css")) return;
    const s = document.createElement("style");
    s.id = "neron-h3-autoprompter-blank-css";
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
    const wrap = el("div", "nap-help");
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
const W = (node, name) => node.widgets?.find((x) => x.name === name);

function readState(node) {
    const w = W(node, "form");
    let data = {};
    try { data = JSON.parse(w?.value || "{}") || {}; } catch (_) { data = { action: String(w?.value || "") }; }
    if (typeof data !== "object" || Array.isArray(data)) data = {};
    if (!data.lang) data.lang = defaultLang();
    if (data.seconds == null) data.seconds = SEC_DEFAULT;
    return data;
}
function writeState(node) {
    const w = W(node, "form");
    if (w) w.value = JSON.stringify(node.__nap.state);
}
// «отпечаток» бланка: чтобы понять, что промпт внизу устарел
function fingerprint(s) {
    return JSON.stringify([s.seconds, s.llm !== false, ...SECTIONS.map((k) => String(s[k] || "").trim())]);
}

function build(node) {
    addCss();
    const st = { state: readState(node), boxes: {}, labels: {}, ctl: {} };
    node.__nap = st;
    const root = el("div", "nap");
    const inner = el("div");
    root.appendChild(inner);
    for (const ev of ["pointerdown", "mousedown", "wheel", "keydown", "contextmenu"]) {
        root.addEventListener(ev, (e) => { if (e.target.closest("textarea,select,input,.nap-prev")) e.stopPropagation(); },
            { passive: true });
    }

    const bar = el("div", "nap-bar");
    const ru = el("span", "nap-pill", "RU");
    const en = el("span", "nap-pill", "EN");
    const exp = el("span", "nap-pill");
    const hlp = el("span", "nap-pill");
    bar.append(ru, en, el("span", "nap-sp"), exp, hlp);
    inner.appendChild(bar);

    // ⏱ длина
    const timeSec = el("div", "nap-sec");
    const timeLab = el("div", "nap-lab");
    const tb = el("b"), ti = el("i");
    timeLab.append(tb, ti);
    const timeRow = el("div", "nap-time");
    const range = document.createElement("input");
    range.type = "range"; range.min = SEC_MIN; range.max = SEC_MAX; range.step = 1;
    range.value = seconds(st.state);
    const tv = el("span", "v");
    timeRow.append(range, tv);
    timeSec.append(timeLab, timeRow);
    inner.appendChild(timeSec);
    range.addEventListener("input", () => { st.state.seconds = Number(range.value); paintTime(); changed(); });
    for (const ev of ["pointerdown", "mousedown", "wheel"]) range.addEventListener(ev, (e) => e.stopPropagation());

    // ⚙ эксперт: LLM вкл/выкл + родные поля ноды (спрятаны) — здесь их правим
    const expBox = el("div", "nap-exp");
    const llmLab = el("label");
    const llmCb = document.createElement("input");
    llmCb.type = "checkbox";
    const llmT = el("span");
    llmLab.append(llmCb, llmT);
    expBox.appendChild(llmLab);
    llmCb.onchange = () => { st.state.llm = llmCb.checked; changed(); };
    const grid = el("div", "nap-grid");
    expBox.appendChild(grid);
    for (const name of LLM_WIDGETS) {
        const w = W(node, name);
        if (!w) continue;
        let input;
        if (name === "unload_after" || name === "auto_download") {
            const lab = el("label");
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!w.value;
            input.onchange = () => { w.value = input.checked; w.callback?.(w.value); };
            const t = el("span");
            lab.append(input, t);
            expBox.appendChild(lab);
            st.ctl[name] = { input, label: t, w };
            continue;
        }
        const t = el("span");
        if (Array.isArray(w.options?.values)) {
            input = document.createElement("select");
            for (const v of w.options.values) {
                const o = document.createElement("option");
                o.value = v; o.textContent = String(v).split("/").pop();
                input.appendChild(o);
            }
            input.value = w.value;
            input.onchange = () => { w.value = input.value; w.callback?.(w.value); };
        } else {
            input = document.createElement("input");
            input.type = "number";
            if (w.options?.step != null) input.step = name === "temperature" ? 0.05 : 1;
            input.value = w.value;
            input.onchange = () => {
                const v = Number(input.value);
                if (Number.isFinite(v)) { w.value = name === "temperature" ? v : Math.round(v); w.callback?.(w.value); }
                input.value = w.value;
            };
        }
        grid.append(t, input);
        st.ctl[name] = { input, label: t, w };
    }
    const clr = el("span", "nap-pill");
    clr.style.display = "inline-block";
    clr.style.marginTop = "4px";
    expBox.appendChild(clr);
    inner.appendChild(expBox);

    for (const key of SECTIONS) {
        const sec = el("div", "nap-sec");
        const lab = el("div", "nap-lab");
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

    const prevh = el("div", "nap-prevh");
    const prevTitle = el("span");
    const right = el("span");
    const count = el("span", "n");
    const copy = el("span", "nap-pill");
    copy.style.marginLeft = "8px";
    right.append(count, copy);
    prevh.append(prevTitle, right);
    const prev = el("div", "nap-prev");
    const note = el("div", "nap-note");
    inner.append(prevh, prev, note);

    function grow(ta) {
        ta.style.height = "auto";
        ta.style.height = Math.max(32, ta.scrollHeight + 2) + "px";
    }
    function lang() { return st.state.lang === "EN" ? "EN" : "RU"; }
    function res() { return (node.properties && node.properties.neron_result) || {}; }
    function paintTime() { tv.textContent = `${seconds(st.state)} ${UI[lang()].sec}`; }
    function shownText() {
        if (st.state.llm === false) return compileForm(Object.assign({}, st.state, { format: "h3" }));
        return res().text || "";
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
        paintTime();
        llmT.textContent = T.useLLM;
        llmCb.checked = st.state.llm !== false;
        for (const [name, c] of Object.entries(st.ctl)) {
            c.label.textContent = T[name] || name;
            if (c.input.type === "checkbox") c.input.checked = !!c.w.value;
            else c.input.value = c.w.value;
        }
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
        const text = shownText();
        const llmOn = st.state.llm !== false;
        prev.textContent = text || (llmOn ? T.waitLLM : T.empty);
        prev.classList.toggle("empty", !text);
        count.textContent = `${text.length} ${T.chars} · ${n} ${T.of} ${SECTIONS.length} ${T.filled}`;
        const stale = llmOn && text && res().fp && res().fp !== fingerprint(st.state);
        note.textContent = stale ? T.stale : (llmOn && text ? (res().note || "") : "");
        note.classList.toggle("warn", !!stale);
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
        node.properties = node.properties || {};
        delete node.properties.neron_result;
        changed();
    };
    copy.onclick = async () => {
        const text = shownText();
        if (!text) return;
        try { await navigator.clipboard.writeText(text); } catch (_) {
            const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
            try { document.execCommand("copy"); } catch (_) {} t.remove();
        }
        copy.textContent = UI[lang()].copied;
        setTimeout(() => { copy.textContent = UI[lang()].copy; }, 1200);
    };

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

    const w = node.addDOMWidget("neron_h3_autoprompter_form", "neron_h3_autoprompter_form", root, {
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
        range.value = seconds(st.state);
        paint();
    };
    // готовый промпт — в свойствах ноды: сохраняется с процессом, но не меняет вход «form» (иначе LLM гонялась бы
    // заново на каждом запуске)
    st.executed = (text, noteText) => {
        node.properties = node.properties || {};
        node.properties.neron_result = { text, fp: fingerprint(st.state), note: noteText || "" };
        refresh();
    };
    writeState(node);
    paint();
    setTimeout(() => { lastH = 0; refresh(); }, 50);
    setTimeout(() => { lastH = 0; refresh(); }, 400);
}

app.registerExtension({
    name: "Neron.H3AutoPrompterBlank",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== NODE) return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = created?.apply(this, arguments);
            for (const name of ["form", ...LLM_WIDGETS]) hideWidget(W(this, name));
            try { build(this); } catch (e) { console.error("[Neron H3 AutoPrompter Бланк]", e); }
            if (this.size[0] < 560) this.setSize([560, this.size[1]]);
            return r;
        };
        const configure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = configure?.apply(this, arguments);
            try { this.__nap?.reload(); } catch (e) { console.error("[Neron H3 AutoPrompter Бланк]", e); }
            return r;
        };
        const executed = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const r = executed?.apply(this, arguments);
            try {
                const text = message?.text?.[0];
                if (text != null) this.__nap?.executed(String(text), String(message?.note?.[0] || ""));
            } catch (e) { console.error("[Neron H3 AutoPrompter Бланк]", e); }
            return r;
        };
    },
});
