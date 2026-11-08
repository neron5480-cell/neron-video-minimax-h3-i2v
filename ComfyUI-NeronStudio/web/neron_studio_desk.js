// 🖥 Neron Studio — монета «N» на холсте ComfyUI и пункт меню: открывает рабочий стол поверх ComfyUI.
// Монету можно перетащить в любое место (щелчок — открыть стол, потянуть — переставить); место запоминается.
// «Открыть» на плитке: процесс открывается в ComfyUI новой вкладкой — и холст надевает «шкуру» Neron Studio:
// полоса стола сверху (монета, процесс, «🏠 Стол», «▶ Создать», часы) и ноды в оформлении стола (через Neron Theme).
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const VERSION = "2026.11.08·4";                 // видно в подсказке монеты и на полосе — какая версия загружена
const POS_KEY = "neron-studio-coin-pos";
const SIZE = 46, MARGIN = 6;
let overlay = null, frame = null;

function openStudio() {
    if (overlay) { overlay.hidden = false; return; }
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;background:#0e0a07;";
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
    let res;
    try { res = await api.fetchApi(`/neron_studio/workflow/${encodeURIComponent(id)}`, { cache: "no-store" }); }
    catch (_) { tellDesk("Нет связи с ComfyUI. Перезапустите ComfyUI и попробуйте ещё раз."); return; }
    if (!res.ok) {
        tellDesk(`Процесс «${title}» не установлен. Обновите пакет Neron (Manager → Neron → Обновить) и перезапустите ComfyUI.`);
        return;
    }
    let data;
    try { data = await res.json(); }
    catch (_) { tellDesk(`Файл процесса «${title}» повреждён. Переустановите пакет Neron.`); return; }
    const file = (res.headers.get("X-Neron-Workflow") || title || "Neron").replace(/\.json$/i, "");
    try {
        await app.loadGraphData(data, true, true, file);
        closeStudio();
        enterStudioMode(title);
    } catch (e) {
        console.error("[Neron Studio] open workflow", e);
        tellDesk(`ComfyUI не смог открыть «${title}»: ${e?.message || e}`);
    }
}


// ================== 🪙 ПРОЦЕСС В ОФОРМЛЕНИИ СТОЛА ==================
const MODE_KEY = "neron-studio-mode";
const M = { on: false, title: "", bar: null, timer: 0, t0: 0, stage: "", i: 0, total: 0, running: false, result: "" };

function fontsOnce() {
    if (document.getElementById("neron-studio-fonts")) return;
    const l = document.createElement("link");
    l.id = "neron-studio-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@700&family=Golos+Text:wght@500;600;700&display=swap";
    document.head.append(l);
}

function css() {
    if (document.getElementById("neron-studio-bar-css")) return;
    const st = document.createElement("style");
    st.id = "neron-studio-bar-css";
    st.textContent = `
#neron-studio-bar { position: fixed; z-index: 9998; top: 46px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 8px; border-radius: 16px;
  background: color-mix(in srgb, #1b130d 78%, transparent); backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25); border: 1px solid #5a3f27;
  box-shadow: 0 12px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(200,135,58,.15);
  font: 600 13px "Golos Text", "Segoe UI", system-ui, sans-serif; color: #f3e6d2; max-width: calc(100vw - 24px); }
#neron-studio-bar .nsb-coin { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 35% 30%, #fff1b8, #f0c75a 35%, #b9821f 75%, #6b4210);
  box-shadow: 0 0 16px rgba(255,122,26,.5), inset 0 0 0 2px rgba(107,66,16,.7); font: 700 17px Georgia, serif; color: #4a2c06; }
#neron-studio-bar .nsb-name { font: 700 17px "Cormorant SC", Georgia, serif; letter-spacing: .08em; color: #f0c75a; white-space: nowrap; }
#neron-studio-bar .nsb-proc { color: #f3e6d2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 30vw; }
#neron-studio-bar .nsb-sep { width: 1px; height: 22px; background: #5a3f27; flex: none; }
#neron-studio-bar button { font: 600 13px "Golos Text", "Segoe UI", system-ui, sans-serif; border-radius: 10px; cursor: pointer;
  padding: 7px 12px; border: 1px solid #5a3f27; background: rgba(36,25,16,.85); color: #f3e6d2; white-space: nowrap; }
#neron-studio-bar button:hover { color: #f0c75a; border-color: #c8873a; }
#neron-studio-bar button.nsb-run { background: linear-gradient(180deg, #e09a48, #c8873a); color: #1b130d; border-color: #f0c75a;
  box-shadow: 0 0 18px rgba(255,122,26,.45); padding: 7px 16px; }
#neron-studio-bar button.nsb-run:hover { color: #0e0a07; background: #f0c75a; }
#neron-studio-bar button.nsb-x { padding: 6px 9px; color: #a8957e; }
#neron-studio-bar .nsb-clock { font: 600 12px ui-monospace, Consolas, monospace; color: #a8957e; white-space: nowrap; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; max-width: 26vw; }
#neron-studio-bar .nsb-clock.run { color: #ffb347; } #neron-studio-bar .nsb-clock.ok { color: #8fd99a; } #neron-studio-bar .nsb-clock.err { color: #ff8a80; }
#neron-studio-bar[hidden], #neron-studio-coin[hidden] { display: none !important; }
/* весь ComfyUI в оформлении стола: смысловые цвета интерфейса → стекло и бронза (только пока включено оформление) */
html.neron-studio-skin, html.neron-studio-skin body, html.neron-studio-skin .dark-theme {
  --background: rgba(22, 15, 10, .72) !important; --card: rgba(36, 25, 16, .78) !important;
  --secondary: rgba(36, 25, 16, .80) !important; --popover: rgba(22, 15, 10, .94) !important;
  --muted: #3a2616 !important; --accent: #4a301b !important; --border: #5a3f27 !important;
  --foreground: #f3e6d2 !important; --muted-foreground: #a8957e !important;
  --primary: #c8873a !important; --primary-fg: #1b130d !important; --primary-hover-bg: #f0c75a !important;
  --primary-hover-fg: #0e0a07 !important; --ring: #c8873a !important; --input: #3a2616 !important;
  --comfy-menu-bg: rgba(20, 14, 9, .78) !important; --comfy-menu-secondary-bg: rgba(36, 25, 16, .82) !important;
  --interface-panel-surface: rgba(22, 15, 10, .72) !important; --shadow-color: rgba(0, 0, 0, .55) !important;
  --node: rgba(27, 19, 13, .82) !important; --node-header: #3a2616 !important; --node-border: #5a3f27 !important;
}
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
    c.classList.toggle("run", M.running); c.classList.toggle("ok", !M.running && M.result === "ok");
    c.classList.toggle("err", !M.running && (M.result === "error" || M.result === "stop"));
    if (M.running) {
        const steps = M.total > 1 ? ` · ${M.i}/${M.total}` : "";
        c.textContent = `⏱ ${fmt(Date.now() - M.t0)}${M.stage ? " · " + M.stage : ""}${steps}`;
    } else if (M.t0) {
        c.textContent = `⏱ ${fmt(M.end - M.t0)} · ` + (M.result === "ok" ? "готово ✓" : M.result === "error" ? "ошибка" : "остановлено");
    } else c.textContent = "⏱ --:--";
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
    b.innerHTML = `<div class="nsb-coin" title="Neron Studio ${VERSION}">N</div><span class="nsb-name">NERON STUDIO</span>
      <span class="nsb-sep"></span><span class="nsb-proc"></span><span class="nsb-sep"></span>
      <button type="button" class="nsb-home" title="Вернуться на рабочий стол">🏠 Стол</button>
      <button type="button" class="nsb-run" title="Запустить этот процесс (как «Запустить» ComfyUI)">▶ Создать</button>
      <span class="nsb-clock">⏱ --:--</span>
      <button type="button" class="nsb-x" title="Снять оформление Studio — обычный ComfyUI">✕</button>`;
    b.querySelector(".nsb-home").onclick = openStudio;
    b.querySelector(".nsb-coin").onclick = openStudio;
    b.querySelector(".nsb-run").onclick = runQueue;
    b.querySelector(".nsb-x").onclick = exitStudioMode;
    document.body.append(b);
    M.bar = b;
    return b;
}

function skin(on, tries = 0) {
    if (typeof window.__neronThemeStudio === "function") { window.__neronThemeStudio(on); return; }
    if (tries < 25) setTimeout(() => skin(on, tries + 1), 200);      // Neron Theme ещё грузится
}

function enterStudioMode(title) {
    M.on = true; M.title = title || M.title || "Neron";
    try { localStorage.setItem(MODE_KEY, JSON.stringify({ on: true, title: M.title })); } catch (_) {}
    const b = buildBar(); b.hidden = false;
    b.querySelector(".nsb-proc").textContent = M.title;
    const coin = document.getElementById("neron-studio-coin"); if (coin) coin.hidden = true;
    skin(true);
    document.documentElement.classList.add("neron-studio-skin");
    drawClock();
}

function exitStudioMode() {
    M.on = false;
    try { localStorage.setItem(MODE_KEY, JSON.stringify({ on: false, title: M.title })); } catch (_) {}
    if (M.bar) M.bar.hidden = true;
    const coin = document.getElementById("neron-studio-coin"); if (coin) coin.hidden = false;
    skin(false);
    document.documentElement.classList.remove("neron-studio-skin");
}

function hookRun() {
    const start = () => { M.running = true; M.t0 = Date.now(); M.stage = ""; M.i = 0; M.total = 0; M.result = "";
        clearInterval(M.timer); M.timer = setInterval(drawClock, 500); drawClock(); };
    const finish = (r) => { if (!M.running) return; M.running = false; M.end = Date.now(); M.result = r; clearInterval(M.timer); drawClock(); };
    api.addEventListener("execution_start", start);
    api.addEventListener("execution_success", () => finish("ok"));
    api.addEventListener("execution_error", () => finish("error"));
    api.addEventListener("execution_interrupted", () => finish("stop"));
    api.addEventListener("executing", (e) => {
        const d = e.detail, id = (d && typeof d === "object") ? (d.display_node ?? d.node) : d;
        if (id == null) { finish("ok"); return; }
        if (!M.running) start();
        const n = app.graph?.getNodeById?.(id);
        if (n) { M.stage = n.title || n.type || ""; M.i = 0; M.total = 0; }
    });
    api.addEventListener("progress", (e) => { const d = e.detail || {}; M.i = d.value || 0; M.total = d.max || 0; });
    for (const ev of ["neron_h3one.progress", "neron_h3story.progress"]) {      // этапы наших движков — по-человечески
        api.addEventListener(ev, (e) => { const d = e.detail || {}; if (d.stage) M.stage = String(d.stage).split(" / ")[0]; });
    }
}

addEventListener("message", (e) => {
    const d = e?.data;
    if (!d || !d.neronStudio) return;
    if (d.neronStudio === "close") closeStudio();
    if (d.neronStudio === "open" && d.id) openWorkflow(String(d.id), String(d.title || d.id));
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
    b.title = `Neron Studio ${VERSION} — щёлкни: открыть стол · потяни: переставить\nclick: open desktop · drag: move`;
    b.textContent = "N";
    b.style.cssText = `position:fixed;z-index:9999;width:${SIZE}px;height:${SIZE}px;border-radius:50%;` +
        "border:0;cursor:pointer;font:700 22px Georgia,serif;color:#4a2c06;touch-action:none;user-select:none;" +
        "background:radial-gradient(circle at 35% 30%,#fff1b8,#f0c75a 35%,#b9821f 75%,#6b4210);" +
        "box-shadow:0 0 18px rgba(255,122,26,.55),inset 0 0 0 2px rgba(107,66,16,.7);transition:box-shadow .2s;";
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
        b.style.boxShadow = "0 0 28px rgba(255,122,26,.85),inset 0 0 0 2px rgba(107,66,16,.7)";
        [x, y] = place(b, drag.x + dx, drag.y + dy);
    });
    const end = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        b.style.cursor = "pointer";
        b.style.boxShadow = "0 0 18px rgba(255,122,26,.55),inset 0 0 0 2px rgba(107,66,16,.7)";
        if (moved) { try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch (_) {} }
        else openStudio();
    };
    b.addEventListener("pointerup", end);
    b.addEventListener("pointercancel", () => { drag = null; });
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStudio(); } });
    addEventListener("resize", () => { [x, y] = place(b, x, y); });
    document.body.append(b);
}

app.registerExtension({
    name: "Neron.Studio",
    commands: [{ id: "Neron.Studio.Open", label: "🖥 Neron Studio", icon: "pi pi-th-large", function: openStudio }],
    menuCommands: [{ path: ["Neron"], commands: ["Neron.Studio.Open"] }],
    async setup() {
        addCoin();
        hookRun();
        try {                                                     // процесс был открыт со стола — оформление на месте
            const m = JSON.parse(localStorage.getItem(MODE_KEY) || "null");
            if (m?.on) enterStudioMode(m.title);
        } catch (_) {}
    },
});
