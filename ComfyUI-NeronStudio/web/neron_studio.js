// 🖥 Neron Studio — кнопка-монета «N» на холсте ComfyUI и пункт меню: открывает рабочий стол поверх ComfyUI.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

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

function addCoin() {
    if (document.getElementById("neron-studio-coin")) return;
    const b = document.createElement("button");
    b.id = "neron-studio-coin";
    b.type = "button";
    b.title = "Neron Studio — рабочий стол / desktop";
    b.textContent = "N";
    b.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:9999;width:46px;height:46px;border-radius:50%;" +
        "border:0;cursor:pointer;font:700 22px Georgia,serif;color:#4a2c06;" +
        "background:radial-gradient(circle at 35% 30%,#fff1b8,#f0c75a 35%,#b9821f 75%,#6b4210);" +
        "box-shadow:0 0 18px rgba(255,122,26,.55),inset 0 0 0 2px rgba(107,66,16,.7);";
    b.onclick = openStudio;
    document.body.append(b);
}

app.registerExtension({
    name: "Neron.Studio",
    commands: [{ id: "Neron.Studio.Open", label: "🖥 Neron Studio", icon: "pi pi-th-large", function: openStudio }],
    menuCommands: [{ path: ["Neron"], commands: ["Neron.Studio.Open"] }],
    async setup() { addCoin(); },
});
