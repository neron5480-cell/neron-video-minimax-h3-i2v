// 🖥 Neron Studio — монета «N» на холсте ComfyUI и пункт меню: открывает рабочий стол поверх ComfyUI.
// Монету можно перетащить в любое место (щелчок — открыть стол, потянуть — переставить); место запоминается.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const POS_KEY = "neron-studio-coin-pos";
const SIZE = 46, MARGIN = 6;
let overlay = null;

function openStudio() {
    if (overlay) { overlay.hidden = false; return; }
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:100000;background:#0e0a07;";
    const frame = document.createElement("iframe");
    frame.src = api.apiURL("/neron_studio");
    frame.title = "Neron Studio";
    frame.style.cssText = "border:0;width:100%;height:100%;display:block;";
    overlay.append(frame);
    document.body.append(overlay);
}

function closeStudio() { if (overlay) overlay.hidden = true; }

addEventListener("message", (e) => { if (e?.data?.neronStudio === "close") closeStudio(); });
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
    b.title = "Neron Studio — щёлкни: открыть стол · потяни: переставить\nclick: open desktop · drag: move";
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
    async setup() { addCoin(); },
});
