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
        heroes: ["👤 Герои и механизмы", "каждого — с новой строки, чтобы не было клонов",
            "напр.:\nМужчина лет 55, седые усы, кепка, засаленная клетчатая рубашка, на руках мазут.\nМотоцикл «Урал» с коляской, тёмно-зелёный, краска облуплена."],
        action: ["🎬 Действие", "что происходит, по порядку; можно по секундам",
            "напр.:\n0–2 с: мужчина затягивает гайку, ключ срывается.\n2–4 с: трясёт ушибленной рукой.\n4–5 с: садится на ящик, вытирает лоб."],
        camera: ["🎥 Камера", "без этого H3 сама гуляет камерой или режет план",
            "напр.: стоит у ворот на уровне груди, не двигается. Один непрерывный план."],
        sound: ["🔊 Звук сцены", "что реально слышно в кадре",
            "напр.: скрип ключа, звон металла о бетон, гудение лампы, дождь по жестяной крыше."],
        speech: ["🗣 Речь", "кто, что и каким голосом",
            "напр.: мужчина хрипло, себе под нос: «Ну и зараза…»"],
        music: ["🎵 Музыка", "отдельно от шумов; пусто — без музыки",
            "напр.: тихая гитара издалека, из радиоприёмника"],
        pictures: ["🖼 Картинки", "кто или что на каждом образце",
            "напр.: <Picture 1> — этот мужчина, <Picture 2> — этот мотоцикл"],
        preview: "👁 Что уйдёт в движок", empty: "Заполни участки — здесь появится готовый промпт.",
        chars: "знаков", of: "из", filled: "участков", copy: "📋 Копировать", copied: "✓ Скопировано",
        expert: "⚙ эксперт", help: "📖 справка",
        links: "Связки между участками («В кадре:», «Камера:»…)",
        noMusic: "Музыка пуста → дописать «Без музыки.»",
        clear: "🧹 Очистить бланк", clearAsk: "Очистить все участки бланка?",
    },
    EN: {
        place: ["🌍 Place and time", "keeps the era and mood to the end of the clip",
            "e.g.: 1978, a garage on the edge of a small town, late autumn, evening. One lamp under a tin shade. Quiet, tired mood."],
        heroes: ["👤 Characters and machines", "each on a new line, so there are no clones",
            "e.g.:\nA man of about 55, grey moustache, cap, greasy checked shirt, oil on his hands.\nA dark green Ural motorcycle with a sidecar, peeling paint."],
        action: ["🎬 Action", "what happens, in order; per second is fine",
            "e.g.:\n0–2 s: the man tightens a nut, the wrench slips.\n2–4 s: he shakes his hurt hand.\n4–5 s: sits on a crate, wipes his forehead."],
        camera: ["🎥 Camera", "without it H3 moves the camera or cuts on its own",
            "e.g.: stands at the gate at chest height, does not move. One continuous shot."],
        sound: ["🔊 Scene sound", "what is really heard in the frame",
            "e.g.: the wrench creaking, metal ringing on concrete, the lamp humming, rain on the tin roof."],
        speech: ["🗣 Speech", "who says what, in what voice",
            "e.g.: the man, hoarse, under his breath: \"Damn thing…\""],
        music: ["🎵 Music", "separate from noises; empty — no music",
            "e.g.: a quiet guitar far away, from a radio"],
        pictures: ["🖼 Pictures", "who or what is on each reference",
            "e.g.: <Picture 1> — this man, <Picture 2> — this motorcycle"],
        preview: "👁 What goes to the engine", empty: "Fill in the sections — the finished prompt appears here.",
        chars: "chars", of: "of", filled: "sections", copy: "📋 Copy", copied: "✓ Copied",
        expert: "⚙ expert", help: "📖 help",
        links: "Links between sections («In the frame:», «Camera:»…)",
        noMusic: "Music empty → add «No music.»",
        clear: "🧹 Clear the form", clearAsk: "Clear all sections of the form?",
    },
};

const HELP = `📝 NERON H3 БЛАНК ПРОМПТА

🇷🇺 ЗАЧЕМ
H3 лучше всего работает с подробным промптом. Обычно его пишут «простынёй» — и теряют половину: забыли звук, не сказали про камеру, смешали двух героев в одну фразу. Бланк делит промпт на участки: у каждого видно, что сюда писать и зачем. Пишешь сам — это не автопромтер. Нода склеивает всё в один связный текст и отдаёт его проводом в движок.

КАК
1. Заполни нужные участки. Пустые в промпт не идут — для простой сцены хватит двух-трёх.
2. Герои — каждый с новой строки. Действие — по порядку, можно по секундам («0–2 с: …»).
3. Внизу — «Что уйдёт в движок»: ровно тот текст, что получит модель.
4. Выход «prompt» — в вход prompt движка (например, 🎬 Neron H3 Engine — Hard).

ЯЗЫК
Пиши на русском или английском — H3 понимает оба одинаково. Плашка RU / EN меняет только надписи ноды. Связки между участками нода берёт на языке твоего текста — промпт не превратится в смесь языков.

ОБРАЗЦЫ
<Картинка 1>, <image 2> и т. п. нода сама превратит в <Picture 1>, <Picture 2> — так модель их узнаёт.

⚙ ЭКСПЕРТ
• Связки — «В кадре:», «Камера:», «Звук сцены:»… Выключи — участки пойдут как есть, через пробел.
• «Без музыки.» — если участок «Музыка» пуст, дописывается явно (иначе H3 может добавить музыку сама).

────────────────────────

📝 NERON H3 PROMPT FORM

🇬🇧 WHY
H3 works best with a detailed prompt. People usually write one long wall of text and lose half of it: forgot the sound, said nothing about the camera, merged two characters into one phrase. The form splits the prompt into sections, each showing what goes there and why. You write it yourself — this is not an autoprompter. The node joins everything into one coherent text and sends it to the engine by wire.

HOW
1. Fill in the sections you need. Empty ones are skipped — two or three are enough for a simple scene.
2. Characters — each on a new line. Action — in order, per second is fine ("0–2 s: …").
3. At the bottom, "What goes to the engine" shows exactly the text the model gets.
4. The "prompt" output goes into the engine's prompt input (e.g. 🎬 Neron H3 Engine — Hard).

LANGUAGE
Write in Russian or English — H3 understands both equally. The RU / EN switch changes only the node's labels. The links between sections follow the language of your text, so the prompt never becomes a mix of languages.

REFERENCES
<Картинка 1>, <image 2> etc. become <Picture 1>, <Picture 2> — that is how the model recognises them.

⚙ EXPERT
• Links — «In the frame:», «Camera:», «Scene sound:»… Turn off to join sections as they are.
• «No music.» — if Music is empty it is added explicitly (otherwise H3 may add music by itself).`;

// ---------------- склейка (как form.py) ----------------
const LINKS = {
    RU: { hero1: "В кадре: ", heroN: "Также в кадре: ", first: "Сначала: ", then: "Затем: ", last: "В конце: ",
          camera: "Камера: ", sound: "Звук сцены: ", speech: "Речь: ", music: "Музыка: ", no_music: "Без музыки.",
          pictures: "Образцы: ", camera_word: ["камер"] },
    EN: { hero1: "In the frame: ", heroN: "Also in the frame: ", first: "First: ", then: "Then: ", last: "Finally: ",
          camera: "Camera: ", sound: "Scene sound: ", speech: "Speech: ", music: "Music: ", no_music: "No music.",
          pictures: "References: ", camera_word: ["camera"] },
};
const BULLET = /^\s*(?:\d{1,2}\s*[).]|[-–—•*])\s+/u;
const TIME = /^\s*\d+(?:[.,]\d+)?\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:с|сек|s|sec)(?![\p{L}\p{N}_])/iu;
const TAG = /<\s*(?:картинка|картинке|изображение|фото|picture|image|pic|img)\s*(\d+)\s*>/giu;
const ENDS = ".!?…";

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
// язык связок — по самому тексту (как text_lang в form.py); плашка RU / EN меняет только надписи
function textLang(data) {
    const allt = SECTIONS.map((k) => String(data[k] || "")).join(" ").replace(TAG, " ");
    const cyr = (allt.match(/[а-яё]/giu) || []).length;
    const lat = (allt.match(/[a-z]/gi) || []).length;
    if (cyr || lat) return cyr >= lat ? "RU" : "EN";
    return String(data.lang || "RU").toUpperCase() === "EN" ? "EN" : "RU";
}
export function compileForm(data) {
    const lang = textLang(data);
    const L = LINKS[lang];
    const useLinks = data.links !== false;
    const noMusic = data.no_music !== false;
    const f = {};
    for (const k of SECTIONS) f[k] = lines(data[k]);
    const joined = (ls) => ls.map(end).join(" ");
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
    if (useLinks && noMusic && !f.music.length && parts.length) parts.push(L.no_music);
    return parts.join(" ").replace(TAG, (_, n) => `<Picture ${n}>`).trim();
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
    function paint() {
        const T = UI[lang()];
        ru.classList.toggle("on", lang() === "RU");
        en.classList.toggle("on", lang() === "EN");
        exp.textContent = T.expert;
        exp.classList.toggle("on", !!st.state.expert);
        hlp.textContent = T.help;
        expBox.style.display = st.state.expert ? "" : "none";
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
            const ok = lines(st.state[key]).length > 0;
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
        cbs[0].checked = st.state.links !== false;
        cbs[1].checked = st.state.no_music !== false;
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
