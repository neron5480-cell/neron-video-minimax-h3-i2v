// 🖥 Neron Studio — монета «N» на холсте ComfyUI и пункт меню: открывает рабочий стол поверх ComfyUI.
// Монету можно перетащить в любое место (щелчок — открыть стол, потянуть — переставить); место запоминается.
// «Открыть» на плитке: процесс открывается в ComfyUI новой вкладкой — и холст надевает «шкуру» Neron Studio:
// полоса стола сверху (монета, процесс, «🏠 Стол», «▶ Создать», часы) и ноды в оформлении стола (через Neron Theme).
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const VERSION = "2026.11.13·14";                 // видно в подсказке монеты и на полосе — какая версия загружена
const POS_KEY = "neron-studio-coin-pos";
// язык: как выбран на столе, иначе — по языку системы (русский/украинский/белорусский/казахский → RU, остальное → EN)
const LANG_KEY = "neron-studio-lang";
function lang() {
    try { const v = localStorage.getItem(LANG_KEY); if (v === "ru" || v === "en") return v; } catch (_) {}
    return /^(ru|uk|be|kk)\b/i.test(navigator.language || "") ? "ru" : "en";
}
const L = (ru, en) => (lang() === "ru" ? ru : en);
// последняя ошибка ComfyUI — для «✉ Написать создателю» на столе (хранится только в этом браузере)
const ERR_KEY = "neron-studio-last-error";
const SIZE = 46, MARGIN = 6;
let overlay = null, frame = null;

function openStudio() {
    if (overlay) { overlay.hidden = false; setTimeout(tellRun, 50); return; }
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;background:#e9ecef;";
    frame = document.createElement("iframe");
    frame.src = api.apiURL("/neron_studio");
    frame.title = "Neron Studio";
    frame.style.cssText = "border:0;width:100%;height:100%;display:block;";
    overlay.append(frame);
    document.body.append(overlay);
}

function closeStudio() { if (overlay) overlay.hidden = true; }

function tellDesk(text) {
    try { frame?.contentWindow?.postMessage({ neronStudioToast: text }, "*"); } catch (_) {}
}

// открыть процесс плитки в ComfyUI — тем же путём, что и перетащенный файл: новая вкладка, ваша работа не трогается
async function openWorkflow(id, title) {
    const have = Object.keys(TABS).find((k) => TABS[k] === title && openKeys().includes(k));
    if (have) {                                                        // уже открыт со стола — просто вернуться к нему
        closeStudio();
        if (await switchTo(have)) { enterStudioMode(title, true); M.since = Date.now(); return; }
        openStudio();
    }
    let res;
    try { res = await api.fetchApi(`/neron_studio/workflow/${encodeURIComponent(id)}`, { cache: "no-store" }); }
    catch (_) { tellDesk(L("Нет связи с ComfyUI. Перезапустите ComfyUI и попробуйте ещё раз.", "No connection to ComfyUI. Restart ComfyUI and try again.")); return; }
    if (!res.ok) {
        tellDesk(L(`Процесс «${title}» не установлен. Обновите пакет Neron (Manager → Neron → Обновить) и перезапустите ComfyUI.`,
                   `«${title}» is not installed. Update the Neron pack (Manager → Neron → Update) and restart ComfyUI.`));
        return;
    }
    let data;
    try { data = await res.json(); }
    catch (_) { tellDesk(L(`Файл процесса «${title}» повреждён. Переустановите пакет Neron.`, `The «${title}» workflow file is damaged. Reinstall the Neron pack.`)); return; }
    const file = (res.headers.get("X-Neron-Workflow") || title || "Neron").replace(/\.json$/i, "");
    try {
        await app.loadGraphData(data, true, true, file);
        closeStudio();
        enterStudioMode(title);
    } catch (e) {
        console.error("[Neron Studio] open workflow", e);
        tellDesk(L(`ComfyUI не смог открыть «${title}»: `, `ComfyUI could not open «${title}»: `) + (e?.message || e));
    }
}


// ================== 🪙 ПРОЦЕСС В ОФОРМЛЕНИИ СТОЛА ==================
const MODE_KEY = "neron-studio-mode";
const M = { on: false, title: "", bar: null, timer: 0, t0: 0, stage: "", i: 0, total: 0, running: false, result: "", runKey: null, runTitle: "" };

function fontsOnce() {
    if (document.getElementById("neron-studio-fonts")) return;
    const l = document.createElement("link");
    l.id = "neron-studio-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Golos+Text:wght@500;600;700&display=swap";
    document.head.append(l);
}

function css() {
    if (document.getElementById("neron-studio-bar-css")) return;
    const st = document.createElement("style");
    st.id = "neron-studio-bar-css";
    st.textContent = `
#neron-studio-bar { position: fixed; z-index: 9998; top: var(--nsb-top, 46px); left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 8px; border-radius: 16px;
  background: color-mix(in srgb, var(--nsb-bg) 88%, transparent); backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2); border: 1px solid var(--nsb-line);
  box-shadow: 0 8px 28px var(--nsb-shadow);
  font: 600 13px "Golos Text", "Segoe UI", system-ui, sans-serif; color: var(--nsb-text); max-width: calc(100vw - 24px); }
#neron-studio-bar .nsb-coin { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
  background: var(--nsb-acc); color: var(--nsb-acc-ink); font: 700 16px "Golos Text", "Segoe UI", system-ui, sans-serif; }
#neron-studio-bar .nsb-name { font: 700 15px "Golos Text", "Segoe UI", system-ui, sans-serif; letter-spacing: .06em; color: var(--nsb-text); white-space: nowrap; }
#neron-studio-bar .nsb-proc { color: var(--nsb-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 30vw; }
#neron-studio-bar .nsb-sep { width: 1px; height: 22px; background: var(--nsb-line); flex: none; }
#neron-studio-bar button { font: 600 13px "Golos Text", "Segoe UI", system-ui, sans-serif; border-radius: 10px; cursor: pointer;
  padding: 7px 12px; border: 1px solid var(--nsb-line); background: var(--nsb-btn); color: var(--nsb-text); white-space: nowrap; }
#neron-studio-bar button:hover { color: var(--nsb-acc); border-color: var(--nsb-acc); }
#neron-studio-bar button.nsb-run { background: var(--nsb-acc); color: var(--nsb-acc-ink); border-color: var(--nsb-acc); padding: 7px 16px; }
#neron-studio-bar button.nsb-run:hover { filter: brightness(1.12); color: var(--nsb-acc-ink); }
#neron-studio-bar button.nsb-x { padding: 6px 9px; color: var(--nsb-muted); }
#neron-studio-bar button.nsb-up { color: var(--nsb-acc); border-color: var(--nsb-acc); }
#neron-studio-bar .nsb-clock { font: 600 12px ui-monospace, Consolas, monospace; color: var(--nsb-muted); white-space: nowrap; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; max-width: 26vw; }
#neron-studio-bar .nsb-clock.warn { white-space: normal; max-width: 46vw; font-size: 11px; line-height: 1.3; }
#neron-studio-bar .nsb-clock.run { color: #c77a12; } #neron-studio-bar .nsb-clock.ok { color: #2e8b47; } #neron-studio-bar .nsb-clock.err { color: #c0392b; }
#neron-studio-bar[hidden], #neron-studio-coin[hidden], #neron-studio-bar button[hidden] { display: none !important; }
#neron-studio-bar button.nsb-theme { padding: 6px 10px; }
#neron-studio-themes { position: fixed; z-index: 9999; top: calc(var(--nsb-top, 46px) + 58px); left: 50%; transform: translateX(-50%);
  width: min(620px, calc(100vw - 24px)); max-height: calc(100vh - var(--nsb-top, 46px) - 80px); display: flex; flex-direction: column;
  border-radius: 14px; background: var(--nsb-bg); border: 1px solid var(--nsb-line); box-shadow: 0 14px 40px var(--nsb-shadow);
  font: 500 13px "Golos Text", "Segoe UI", system-ui, sans-serif; color: var(--nsb-text); overflow: hidden; }
#neron-studio-themes[hidden] { display: none !important; }
#neron-studio-themes .nst-top { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--nsb-line); }
#neron-studio-themes .nst-head { flex: 1; font-weight: 700; font-size: 13px; }
#neron-studio-themes button { font: 600 12px "Golos Text", "Segoe UI", system-ui, sans-serif; border-radius: 8px; padding: 5px 10px; cursor: pointer;
  border: 1px solid var(--nsb-line); background: var(--nsb-btn); color: var(--nsb-text); }
#neron-studio-themes .nst-host { overflow: auto; min-height: 0; flex: 1; }
#neron-studio-themes .nst-host > * { height: auto !important; max-height: none !important; }
/* окно ComfyUI красит тема Neron Theme (та же, что выбрана на столе); здесь — только «стекло» панелей */
html.neron-studio-skin .bg-background, html.neron-studio-skin .bg-secondary, html.neron-studio-skin .bg-card,
html.neron-studio-skin .bg-popover, html.neron-studio-skin .bg-comfy-menu-bg, html.neron-studio-skin .bg-interface-panel-surface {
  backdrop-filter: blur(12px) saturate(1.2); -webkit-backdrop-filter: blur(12px) saturate(1.2); }
html.neron-studio-skin .minimap-canvas, html.neron-studio-skin .minimap-viewport { border-radius: 10px; }
@media (max-width: 900px) { #neron-studio-bar .nsb-name, #neron-studio-bar .nsb-sep { display: none; } }`;
    document.head.append(st);
}

function fmt(ms) {
    const t = Math.max(0, Math.round(ms / 1000)), m = Math.floor(t / 60), s = t % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function drawClock() {
    const c = M.bar?.querySelector(".nsb-clock");
    if (!c) return;
    const stop = M.bar?.querySelector(".nsb-stop"); if (stop) stop.hidden = !M.running;
    c.classList.toggle("run", M.running); c.classList.toggle("ok", !M.running && M.result === "ok");
    c.classList.toggle("err", !M.running && (M.result === "error" || M.result === "stop"));
    if (M.running) {
        const steps = M.total > 1 ? ` · ${M.i}/${M.total}` : "";
        c.textContent = `⏱ ${fmt(Date.now() - M.t0)}${M.stage ? " · " + M.stage : ""}${steps}`;
    } else if (M.t0) {
        c.textContent = `⏱ ${fmt(M.end - M.t0)} · ` + (M.result === "ok" ? L("готово ✓", "done ✓") : M.result === "error" ? L("ошибка", "error") : L("остановлено", "stopped"));
    } else c.textContent = "⏱ --:--";
    c.classList.toggle("warn", !!M.skinWarn);
    if (M.skinWarn) { c.textContent = "⚠ " + M.skinWarn; c.classList.add("err"); }
}

function runQueue() {
    try {
        const cmd = app.extensionManager?.command;
        if (cmd?.execute) { cmd.execute("Comfy.QueuePrompt"); return; }
    } catch (_) {}
    app.queuePrompt?.(0, 1);
}

function buildBar() {
    if (M.bar) return M.bar;
    fontsOnce(); css();
    const b = document.createElement("div");
    b.id = "neron-studio-bar";
    b.innerHTML = `<div class="nsb-coin" title="Neron Studio ${VERSION} · Neron Theme ${window.__neronThemeVersion || "—"}">N</div><span class="nsb-name">NERON STUDIO</span>
      <span class="nsb-sep"></span><span class="nsb-proc"></span><button type="button" class="nsb-up" hidden></button><span class="nsb-sep"></span>
      <button type="button" class="nsb-theme"></button>
      <button type="button" class="nsb-home"></button>
      <button type="button" class="nsb-run"></button>
      <button type="button" class="nsb-stop" hidden></button>
      <span class="nsb-clock">⏱ --:--</span>
      <button type="button" class="nsb-x">✕</button>`;
    b.querySelector(".nsb-home").onclick = goHome;
    b.querySelector(".nsb-theme").onclick = (e) => { e.stopPropagation(); themePanel(); };
    b.querySelector(".nsb-coin").onclick = goHome;
    b.querySelector(".nsb-run").onclick = runQueue;
    b.querySelector(".nsb-stop").onclick = () => { try { api.interrupt?.(); } catch (_) {} };
    b.querySelector(".nsb-x").onclick = () => exitStudioMode();
    b.querySelector(".nsb-up").onclick = exitSubgraph;
    document.body.append(b);
    M.bar = b;
    barText();
    return b;
}
function barText() {                                               // подписи полосы — на языке стола
    const b = M.bar; if (!b) return;
    const set = (sel, text, tip) => { const el = b.querySelector(sel); if (text != null) el.textContent = text; el.title = tip; };
    set(".nsb-home", L("🏠 Стол", "🏠 Desktop"), L("Вернуться на рабочий стол", "Back to the desktop"));
    set(".nsb-theme", "🎨", L("Тема этого процесса — запомнится за ним", "Theme of this workflow — it remembers it"));
    set(".nsb-run", L("▶ Создать", "▶ Create"), L("Запустить этот процесс (как «Запустить» ComfyUI)", "Run this workflow (same as ComfyUI «Run»)"));
    set(".nsb-stop", L("■ Стоп", "■ Stop"), L("Остановить генерацию", "Stop generation"));
    set(".nsb-up", L("⤴ Наверх", "⤴ Up"), L("Выйти из подграфа на основной холст", "Leave the subgraph, back to the main canvas"));
    set(".nsb-x", null, L("Снять оформление Studio — обычный ComfyUI", "Leave the Studio look — plain ComfyUI"));
}
function coinTip() {
    const c = document.getElementById("neron-studio-coin");
    if (c) c.title = `Neron Studio ${VERSION} · Neron Theme ${window.__neronThemeVersion || L("старая или нет", "old or missing")} — ` + L("щёлкни: открыть стол · потяни: переставить", "click: open desktop · drag: move");
}

// Тема стола («🎨 Тема» на столе) → та же тема в процессе. Стол и ComfyUI — один адрес, общий localStorage.
const DESK_THEME_KEY = "neron-studio-theme";
const DESK_LIGHT = { bg: "#f8f9fa", line: "#d5dae0", text: "#1d232a", muted: "#5a6470", acc: "#2f5d8a", btn: "#f1f3f5", light: true };
function deskThemeId() {
    let id = "calm";
    try { id = localStorage.getItem(DESK_THEME_KEY) || "calm"; } catch (_) {}
    // «Как в ComfyUI»: есть на холсте нода Neron Theme — решает она; нет — как на столе в этом режиме, светлая
    if (id === "comfy") return "studio-light";                       // «Как в ComfyUI» без своей темы — как стол, светлая
    return id === "calm" ? "studio-light" : id === "aureus" ? "studio" : id;
}
function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return 1;
    const v = parseInt(m[1], 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
}
function barColors(t) {
    const c = t?.c, p = c ? { bg: c.menu || c.body, line: c.line, text: c.text, muted: c.text, acc: c.accent, btn: c.body, light: lum(c.bg) > 0.35 } : DESK_LIGHT;
    const r = document.documentElement.style;
    r.setProperty("--nsb-bg", p.bg); r.setProperty("--nsb-line", p.line); r.setProperty("--nsb-text", p.text);
    r.setProperty("--nsb-muted", c ? `color-mix(in srgb, ${p.text} 60%, ${p.bg})` : p.muted);
    r.setProperty("--nsb-acc", p.acc); r.setProperty("--nsb-btn", p.btn);
    r.setProperty("--nsb-acc-ink", lum(p.acc) > 0.6 ? "#111111" : "#ffffff");
    r.setProperty("--nsb-shadow", p.light ? "rgba(20,30,45,.16)" : "rgba(0,0,0,.5)");
    const coin = document.getElementById("neron-studio-coin");
    if (coin) { coin.style.background = p.acc; coin.style.color = lum(p.acc) > 0.6 ? "#111111" : "#ffffff"; }
}
// Свой вид процесса: человек поставил в процесс ноду Neron Theme и выбрал тему — процесс запоминает её
// (у каждого процесса своя). Удалил ноду — снова тема стола. Процесс со стола закрывается без сохранения,
// поэтому тема хранится здесь, в браузере, по названию процесса.
const PROC_KEY = (title) => "neron-studio-proc-theme:" + title;
function procTheme() { try { return JSON.parse(localStorage.getItem(PROC_KEY(M.title)) || "null"); } catch (_) { return null; } }
function wantedTheme() {                                               // своя тема процесса, иначе тема стола
    const saved = M.on ? procTheme() : null;
    return saved ? { obj: saved } : { id: deskThemeId() || "studio-light" };
}
function setProcTheme(theme) {                                         // null — снова тема стола
    try { if (theme) localStorage.setItem(PROC_KEY(M.title), JSON.stringify(theme)); else localStorage.removeItem(PROC_KEY(M.title)); } catch (_) {}
    const n = themeNodeOf(rootGraph());                                // нода темы из файла процесса — показывает то же
    if (n) { setNodeTheme(n, theme || deskTheme()); M.nodeSet = nodeThemeSig(n); }
    skin(true);
}
// прошлые версии могли запомнить за процессами тему из их файла (не выбор человека) — один раз забываем
try {
    if (localStorage.getItem("neron-studio-proc-v") !== "2") {
        for (const k of Object.keys(localStorage)) if (k.startsWith("neron-studio-proc-theme:")) localStorage.removeItem(k);
        localStorage.setItem("neron-studio-proc-v", "2");
    }
} catch (_) {}
// ---------- нода «Neron Theme 🎨» в каждом процессе со стола ----------
// Стол сам ставит её на холст (файл процесса не меняется). В ней — тема процесса: своя, если человек её выбирал,
// иначе — тема стола. Человек сменил тему в ноде — процесс запомнил; удалил ноду — снова тема стола.
const THEME_NODE = "NeronThemeStudio";
function themeNodeOf(g) { return ((g && g._nodes) || []).find((n) => (n.comfyClass || n.type) === THEME_NODE) || null; }
function deskTheme() {
    const id = deskThemeId() || "studio-light";
    return window.__neronThemeBuiltin?.(id) || window.__neronThemeBuiltin?.("studio-light") || null;
}
function setNodeTheme(n, theme) {
    const w = (n.widgets || []).find((x) => x.name === "theme_json");
    if (!w || !theme) return;
    let o = {}; try { o = JSON.parse(w.value || "{}") || {}; } catch (_) { o = {}; }
    w.value = JSON.stringify({ ...o, v: 1, theme, tab: o.tab || "install" });
    n.__ntsConfigured = true;
    try { n.__ntsReload?.(); } catch (_) {}
}
function nodeThemeSig(n) {
    const w = (n?.widgets || []).find((x) => x.name === "theme_json");
    try { return JSON.stringify((JSON.parse(w?.value || "{}") || {}).theme || null); } catch (_) { return "null"; }
}
// Нода темы, если она есть в файле процесса (Audio Studio, LTX Engine): показывает тему процесса;
// человек выбрал в ней другую — запоминаем за процессом (как кнопкой «🎨» на полосе).
function checkThemeNode() {
    const g = rootGraph(), LGx = window.LiteGraph;
    if (!M.on || !g || !LGx || !window.__neronThemeBuiltin || !LGx.registered_node_types?.[THEME_NODE]) return;
    if (M.nodeGraph !== g) { M.nodeGraph = g; M.nodeSet = ""; M.nodeDone = false; M.nodeAt = Date.now(); }
    let n = themeNodeOf(g);
    if (!M.nodeDone) {
        if (Date.now() - M.nodeAt < 400) return;                        // холст только что загрузился — дать ему встать
        if (n) { setNodeTheme(n, procTheme() || deskTheme()); M.nodeSet = nodeThemeSig(n); app.canvas?.setDirty?.(true, true); }
        M.nodeDone = true;
        try { const w = app.extensionManager.workflow.activeWorkflow; if (w) w.isModified = false; } catch (_) {}
        return;
    }
    if (!n) return;
    const sig = nodeThemeSig(n);
    if (sig !== M.nodeSet && sig !== "null") {                          // выбрали другую тему — запомнить за процессом
        M.nodeSet = sig; try { localStorage.setItem(PROC_KEY(M.title), sig); } catch (_) {}
        skin(true);
    }
}

function skin(on, tries = 0) {
    const w = wantedTheme();
    M.wantSig = JSON.stringify(w);
    if (typeof window.__neronThemeStudio === "function") {
        const t = window.__neronThemeStudio(on && !w.node, w.obj || w.id || null, on);
        barColors(t || (w.node ? window.__neronThemeEngine?.current : null)); return;
    }
    barColors(null);                                                   // без Neron Theme — полоса в цветах стола
    if (tries < 25) setTimeout(() => skin(on, tries + 1), 200);       // Neron Theme ещё грузится
}


// ---------- чистый экран: только холст, фон и наша полоса — штатными выключателями ComfyUI ----------
const CHROME_KEY = "neron-studio-chrome-before";
const CHROME_SETTINGS = ["Comfy.Minimap.Visible", "Comfy.Graph.CanvasMenu"];
function setting(id, val) {
    const st = app.extensionManager?.setting;
    try {
        if (val === undefined) return st?.get ? st.get(id) : app.ui?.settings?.getSettingValue?.(id);
        if (st?.set) return st.set(id, val);
        return app.ui?.settings?.setSettingValue?.(id, val);
    } catch (_) { return undefined; }
}
// режим фокуса ComfyUI (прячет меню, вкладки, панели) — трогаем, только если ComfyUI говорит, включён ли он
function focusKnown() { try { return typeof app.extensionManager?.focusMode === "boolean"; } catch (_) { return false; } }
function focusOn() { try { return app.extensionManager.focusMode === true; } catch (_) { return false; } }
function setFocus(on) {
    if (!focusKnown() || focusOn() === on) return;
    try { app.extensionManager.focusMode = on; } catch (_) {}
    if (focusOn() !== on) {                                       // хранилище не дало записать — штатной командой
        try { app.extensionManager?.command?.execute?.("Workspace.ToggleFocusMode"); } catch (_) {}
    }
}
function cleanScreen(on) {
    if (on) {
        let before = null;
        try { before = JSON.parse(localStorage.getItem(CHROME_KEY) || "null"); } catch (_) {}
        if (!before) {                                             // запомнить «как было» один раз
            before = { focus: focusOn() };
            for (const id of CHROME_SETTINGS) before[id] = setting(id);
            try { localStorage.setItem(CHROME_KEY, JSON.stringify(before)); } catch (_) {}
        }
        for (const id of CHROME_SETTINGS) setting(id, false);
        setFocus(true);
        document.documentElement.style.setProperty("--nsb-top", "12px");
    } else {
        let before = null;
        try { before = JSON.parse(localStorage.getItem(CHROME_KEY) || "null"); } catch (_) {}
        if (before) {
            for (const id of CHROME_SETTINGS) if (before[id] !== undefined && before[id] !== null) setting(id, before[id]);
            setFocus(!!before.focus);
            try { localStorage.removeItem(CHROME_KEY); } catch (_) {}
        }
        document.documentElement.style.removeProperty("--nsb-top");
    }
}

// Оформление живёт во вкладках, открытых со стола: переключились на свою вкладку — обычный ComfyUI,
// вернулись — снова стол. «✕» (на полосе или «✕ В ComfyUI» на столе) — обычный ComfyUI сразу.
const TABS_KEY = "neron-studio-tabs";
let TABS = {};
try { TABS = JSON.parse(localStorage.getItem(TABS_KEY) || "{}") || {}; } catch (_) { TABS = {}; }
function saveTabs() { try { localStorage.setItem(TABS_KEY, JSON.stringify(TABS)); } catch (_) {} }
function activeKey() {
    try {
        const w = app.extensionManager?.workflow?.activeWorkflow;
        return w ? String(w.path || w.key || w.filename || "") : null;      // null — эта сборка ComfyUI не говорит
    } catch (_) { return null; }
}
function rememberTab(title) {
    setTimeout(() => { const k = activeKey(); if (k) { TABS[k] = title; saveTabs(); } }, 400);
}
// подграф: штатная навигация спрятана чистым экраном — даём свою кнопку «⤴ Наверх»
function rootGraph() { try { return app.graph?.rootGraph || app.graph; } catch (_) { return null; } }
function inSubgraph() { try { const g = app.canvas?.graph, r = rootGraph(); return !!(g && r && g !== r); } catch (_) { return false; } }
function exitSubgraph() {
    try { app.extensionManager?.command?.execute?.("Comfy.Graph.ExitSubgraph"); } catch (_) {}
    setTimeout(() => {                                                  // команды нет в этой сборке — сразу на основной холст
        if (inSubgraph()) { try { app.canvas.setGraph(rootGraph()); app.canvas.setDirty?.(true, true); } catch (_) {} }
        upButton();
    }, 200);
}
function upButton() { const u = M.bar?.querySelector(".nsb-up"); if (u) u.hidden = !(M.on && inSubgraph()); }

// ---------- вкладки ComfyUI: список, переключение, закрытие — штатными командами ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cmd(id) { try { await app.extensionManager?.command?.execute?.(id); return true; } catch (_) { return false; } }
function openKeys() {
    try { return (app.extensionManager?.workflow?.openWorkflows || []).map((w) => String(w.path || w.key || w.filename || "")); }
    catch (_) { return []; }
}
async function switchTo(key) {
    for (let i = 0; i < 40 && activeKey() !== key; i++) {
        if (!openKeys().includes(key)) return false;
        await cmd("Workspace.NextOpenedWorkflow"); await sleep(80);
    }
    return activeKey() === key;
}
// «🏠 Стол»: процесс со стола не запущен — закрываем его вкладку, чтобы не копились. Идёт генерация — вкладка живёт,
// а стол показывает, что работает. Меняли что-то в процессе — ComfyUI сам спросит, сохранить ли.
async function goHome() {
    const k = activeKey();
    if (M.on && k && TABS[k] && !(M.running && M.runKey === k)) {
        // процесс со стола — как приложение: закрываем без вопроса «сохранить?», в следующий раз он откроется чистым
        try { const w = app.extensionManager.workflow.activeWorkflow; if (w) w.isModified = false; } catch (_) {}
        await cmd("Workspace.CloseWorkflow"); await sleep(150);
        if (openKeys().includes(k) && activeKey() === k) return;      // человек передумал в окне «сохранить?» — остаёмся
        delete TABS[k]; saveTabs();
        exitStudioMode(true);
    }
    openStudio();
}
// стол видит, что идёт: процесс, время, этап — раз в секунду, пока стол открыт
function tellRun() {
    if (!overlay || overlay.hidden || !frame?.contentWindow) return;
    const st = { running: M.running, title: M.runTitle, key: M.runKey, t0: M.t0, end: M.end || 0, stage: M.stage, i: M.i, total: M.total,
        result: M.result, open: !!(M.runKey && openKeys().includes(M.runKey)) };
    try { frame.contentWindow.postMessage({ neronStudioRun: st }, "*"); } catch (_) {}
}
setInterval(tellRun, 1000);
// оформление стола в процессе должно стоять — если что-то его сбило (смена вкладок, сворачивание), ставим снова
// ---------- «🎨» на полосе: тема только этого процесса (встроенные темы Neron Theme и «Мои») ----------
// Панель — это сама нода Neron Theme (все вкладки и «для спецов»), только не на холсте, а под полосой.
let themeBox = null, themeUI = null, themeOff = null;
function themePanel() {
    if (themeBox && !themeBox.hidden) { themeBox.hidden = true; themeUI?.saveProps(); return; }
    if (!window.__neronThemePanel) { tellBar(L("Нужна Neron Theme", "Needs Neron Theme")); return; }
    const cur = procTheme() || deskTheme();
    if (!themeBox) {
        themeBox = document.createElement("div"); themeBox.id = "neron-studio-themes";
        const top = document.createElement("div"); top.className = "nst-top";
        const head = document.createElement("div"); head.className = "nst-head";
        const reset = document.createElement("button"); reset.type = "button"; reset.className = "nst-reset";
        const close = document.createElement("button"); close.type = "button"; close.className = "nst-close"; close.textContent = "✕";
        reset.onclick = () => { setProcTheme(null); themeUI?.setTheme(deskTheme()); paintHead(); };
        close.onclick = () => themePanel();
        top.append(head, reset, close);
        const host = document.createElement("div"); host.className = "nst-host";
        themeBox.append(top, host);
        themeBox.addEventListener("pointerdown", (e) => e.stopPropagation());
        document.body.append(themeBox);
        themeUI = window.__neronThemePanel(host, cur, (t) => { setProcTheme(t); paintHead(); });
        themeOff = (ev) => {                                             // щелчок мимо панели — закрыть
            if (!themeBox || themeBox.hidden || themeBox.contains(ev.target) || ev.target.closest?.(".nsb-theme")) return;
            themeBox.hidden = true; themeUI?.saveProps();
        };
        addEventListener("pointerdown", themeOff, true);
    } else themeUI?.setTheme(cur);
    paintHead();
    themeBox.hidden = false;
}
function paintHead() {
    if (!themeBox) return;
    themeBox.querySelector(".nst-head").textContent = L("🎨 Тема процесса «", "🎨 Workflow theme «") + M.title + "» — "
        + (procTheme() ? L("своя, запомнена", "its own, remembered") : L("как на столе", "same as the desk"));
    const r = themeBox.querySelector(".nst-reset");
    r.textContent = L("↺ Как на столе", "↺ Same as desk"); r.hidden = !procTheme();
}
function tellBar(text) { const c = M.bar?.querySelector(".nsb-clock"); if (c) c.textContent = text; }

function healSkin() {
    const E = window.__neronThemeEngine;
    if (!M.on) { M.skinWarn = ""; return; }
    checkThemeNode();
    const w = wantedTheme();
    if (JSON.stringify(w) !== M.wantSig) skin(true);
    const id = w.id || "своя";
    if (!E || typeof window.__neronThemeStudio !== "function") {
        M.skinWarn = L("нет Neron Theme — холст не перекрашен", "no Neron Theme — canvas not restyled"); drawClock(); return;
    }
    // проверяем не «что думает тема», а что реально на холсте: фон и цвет нод по умолчанию
    const t = E.studio, cv = app.canvas, LGx = window.LiteGraph;
    const bg = cv?.clear_background_color, nodeBg = LGx?.NODE_DEFAULT_BGCOLOR;
    const real = !!(t && E.applied && JSON.stringify(E.applied) === JSON.stringify(t) && (bg === t.c.bg || bg === "transparent"));
    if (real) { M.skinWarn = ""; M.warned = false; M.fixes = 0; drawClock(); return; }
    if ((M.fixes || 0) < 5) {                                            // перекрасить заново: выключить и включить
        M.fixes = (M.fixes || 0) + 1;
        try { window.__neronThemeStudio(false, id); } catch (_) {}
        skin(true);
    }
    if (Date.now() - (M.enteredAt || 0) > 4000) {
        const u = E.uni;
        M.skinWarn = L("тема не встала", "theme not applied") + ` [${E.studio?.id || "-"}/${E.applied?.id || "-"} фон ${bg || "-"} нода ${nodeBg || "-"}`
            + ` нод ${u ? u.nodes.size : "?"} групп ${u ? u.groups.size : "?"}${E.lastError ? " · " + E.lastError : ""}]`;
        if (!M.warned) { M.warned = true; console.warn("[Neron Studio] skin:", M.skinWarn); }
    }
    drawClock();
}

function followTabs() {
    healSkin();
    upButton();
    if (Date.now() - (M.since || 0) < 1200) return;                     // вкладка только что открыта — даём ей встать
    const k = activeKey();
    if (k === null) return;                                             // не знаем вкладку — ничего не трогаем
    const t = TABS[k];
    if (t && !M.on) enterStudioMode(t, true);
    else if (!t && M.on) exitStudioMode(true);
    else if (t && M.on && M.bar) { M.title = t; M.bar.querySelector(".nsb-proc").textContent = t; }
}

function enterStudioMode(title, quiet) {
    M.on = true; M.title = title || M.title || "Neron"; M.enteredAt = Date.now(); M.fixes = 0; M.warned = false; M.nodeGraph = null;
    if (!quiet) { rememberTab(M.title); M.since = Date.now(); }
    try { localStorage.setItem(MODE_KEY, JSON.stringify({ on: true, title: M.title })); } catch (_) {}
    const b = buildBar(); b.hidden = false;
    b.querySelector(".nsb-proc").textContent = M.title;
    const coin = document.getElementById("neron-studio-coin"); if (coin) coin.hidden = true;
    skin(true);
    document.documentElement.classList.add("neron-studio-skin");
    cleanScreen(true);
    drawClock();
}

function exitStudioMode(quiet) {
    M.on = false;
    if (!quiet) { TABS = {}; saveTabs(); }                       // «✕» — выход из Studio целиком; вернётся только через стол
    try { localStorage.setItem(MODE_KEY, JSON.stringify({ on: false, title: M.title })); } catch (_) {}
    if (M.bar) M.bar.hidden = true;
    if (themeBox && !themeBox.hidden) { themeBox.hidden = true; themeUI?.saveProps(); }
    const coin = document.getElementById("neron-studio-coin"); if (coin) coin.hidden = false;
    skin(false);
    document.documentElement.classList.remove("neron-studio-skin");
    cleanScreen(false);
}

function saveError(d) {
    d = d || {};
    const cut = (v, n) => String(v ?? "").slice(0, n);
    const tb = Array.isArray(d.traceback) ? d.traceback.join("").split("\n").filter(Boolean).slice(-14).join("\n") : "";
    const rec = { at: new Date().toISOString(), workflow: M.on ? M.title : (app.extensionManager?.workflow?.activeWorkflow?.filename || ""),
        node: cut(d.node_type, 120), node_id: cut(d.node_id, 20), type: cut(d.exception_type, 120),
        message: cut(d.exception_message, 1500), traceback: cut(tb, 3000) };
    try { localStorage.setItem(ERR_KEY, JSON.stringify(rec)); } catch (_) {}
}

function hookRun() {
    const start = () => { M.running = true; M.t0 = Date.now(); M.stage = ""; M.i = 0; M.total = 0; M.result = "";
        M.runKey = activeKey(); M.runTitle = (M.runKey && TABS[M.runKey]) || (() => { try { return app.extensionManager.workflow.activeWorkflow.filename || ""; } catch (_) { return ""; } })();
        clearInterval(M.timer); M.timer = setInterval(drawClock, 500); drawClock(); };
    const finish = (r) => { if (!M.running) return; M.running = false; M.end = Date.now(); M.result = r; clearInterval(M.timer); drawClock(); };
    api.addEventListener("execution_start", start);
    api.addEventListener("execution_success", () => finish("ok"));
    api.addEventListener("execution_error", (e) => { finish("error"); saveError(e.detail); });
    api.addEventListener("execution_interrupted", () => finish("stop"));
    api.addEventListener("executing", (e) => {
        const d = e.detail, id = (d && typeof d === "object") ? (d.display_node ?? d.node) : d;
        if (id == null) { finish("ok"); return; }
        if (!M.running) start();
        const n = app.graph?.getNodeById?.(id);
        if (n) { M.stage = n.title || n.type || ""; M.i = 0; M.total = 0; }
    });
    api.addEventListener("progress", (e) => { const d = e.detail || {}; M.i = d.value || 0; M.total = d.max || 0; });
    for (const ev of ["neron_h3story.progress"]) {      // этапы наших движков — по-человечески
        api.addEventListener(ev, (e) => { const d = e.detail || {}; if (d.stage) M.stage = String(d.stage).split(" / ")[0]; });
    }
}

addEventListener("message", (e) => {
    const d = e?.data;
    if (!d || !d.neronStudio) return;
    if (d.neronStudio === "close") { closeStudio(); if (M.on) exitStudioMode(); }
    if (d.neronStudio === "open" && d.id) openWorkflow(String(d.id), String(d.title || d.id));
    if (d.neronStudio === "lang") { barText(); coinTip(); }
    if (d.neronStudio === "theme") {                                    // на столе сменили тему — процесс следом
        if (M.on && !procTheme()) { const n = themeNodeOf(rootGraph()); if (n) { setNodeTheme(n, deskTheme()); M.nodeSet = nodeThemeSig(n); } }
        skin(M.on);
    }
    if (d.neronStudio === "goto" && d.key) (async () => {               // «Вернуться к процессу» с окошка на столе
        closeStudio();
        if (!(await switchTo(String(d.key)))) { openStudio(); tellDesk(L("Вкладка этого процесса уже закрыта.", "This workflow's tab is already closed.")); return; }
        M.since = 0; followTabs();
    })();                          // на столе сменили тему — процесс следом
});
addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay && !overlay.hidden) closeStudio(); });

function clampPos(x, y) {
    return [Math.max(MARGIN, Math.min(innerWidth - SIZE - MARGIN, x)), Math.max(MARGIN, Math.min(innerHeight - SIZE - MARGIN, y))];
}

function loadPos() {
    try {
        const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
        if (p && isFinite(p.x) && isFinite(p.y)) return clampPos(p.x, p.y);
    } catch (_) {}
    return clampPos(14, innerHeight - SIZE - 14);              // по умолчанию — слева внизу
}

function place(b, x, y) { [x, y] = clampPos(x, y); b.style.left = x + "px"; b.style.top = y + "px"; return [x, y]; }

function addCoin() {
    if (document.getElementById("neron-studio-coin")) return;
    const b = document.createElement("button");
    b.id = "neron-studio-coin";
    b.type = "button";

    b.textContent = "N";
    b.style.cssText = `position:fixed;z-index:9999;width:${SIZE}px;height:${SIZE}px;border-radius:50%;` +
        "border:0;cursor:pointer;font:700 20px 'Golos Text','Segoe UI',system-ui,sans-serif;color:#ffffff;touch-action:none;user-select:none;" +
        "background:#2f5d8a;box-shadow:0 4px 14px rgba(20,30,45,.35);transition:box-shadow .2s;";
    let [x, y] = loadPos();
    place(b, x, y);

    let drag = null;
    b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        drag = { sx: e.clientX, sy: e.clientY, x, y, moved: false };
        b.setPointerCapture(e.pointerId);
    });
    b.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;          // дрожь руки — ещё не перетаскивание
        drag.moved = true;
        b.style.cursor = "grabbing";
        b.style.boxShadow = "0 8px 24px rgba(20,30,45,.5)";
        [x, y] = place(b, drag.x + dx, drag.y + dy);
    });
    const end = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        b.style.cursor = "pointer";
        b.style.boxShadow = "0 4px 14px rgba(20,30,45,.35)";
        if (moved) { try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch (_) {} }
        else openStudio();
    };
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", () => { drag = null; });
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudio(); } });
    addEventListener("resize", () => { [x, y] = place(b, x, y); });
    document.body.append(b);
    coinTip(); skin(M.on);
}

app.registerExtension({
    name: "Neron.Studio",
    commands: [{ id: "Neron.Studio.Open", label: "🖥 Neron Studio", icon: "pi pi-th-large", function: openStudio }],
    menuCommands: [{ path: ["Neron"], commands: ["Neron.Studio.Open"] }],
    async setup() {
        addCoin();
        addEventListener("storage", (e) => { if (e.key === LANG_KEY) { barText(); coinTip(); } });
        hookRun();
        try {                                                     // процесс был открыт со стола — оформление на месте
            const m = JSON.parse(localStorage.getItem(MODE_KEY) || "null");
            if (m?.on && activeKey() === null) enterStudioMode(m.title, true);   // сборка без вкладок — как раньше
        } catch (_) {}
        setInterval(followTabs, 700);                                         // оформление — по вкладке
        setTimeout(followTabs, 300);
        setTimeout(coinTip, 4000);                                            // Neron Theme уже загрузилась — её версия в подсказке
        setTimeout(() => {                                                    // закрыли ComfyUI в оформлении стола,
            if (!M.on && localStorage.getItem(CHROME_KEY)) cleanScreen(false); // а открыта своя вкладка — вернуть как было
        }, 2500);
    },
});
