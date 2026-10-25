// Neron Music / Музыка — барабаны и пианино в одной ноде (вкладки), общий темп.
// Drums and piano in one node (tabs), one tempo.
import { app } from "../../scripts/app.js";
import { makeUserSized } from "./neron_common.js";
import { setupNeronUI } from "./drum_ui.js";
import { setupPianoUI } from "./piano_roll_ui.js";

const TAB_H = 40;

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectStyles() {
    if (document.getElementById("neron-music-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-music-styles";
    s.textContent = `
.nmu-root{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:6px;background:#15171c;border-radius:8px;padding:6px;overflow:hidden;
  font-family:"Segoe UI",Arial,sans-serif;user-select:none}
.nmu-tabs{display:flex;align-items:center;gap:6px;flex:none;height:${TAB_H - 6}px}
.nmu-tab{height:30px;padding:0 16px;border:none;border-radius:7px 7px 0 0;background:#23252b;color:#8b90a0;font-size:12px;font-weight:800;
  cursor:pointer;letter-spacing:.4px;border-bottom:3px solid transparent;flex:none}
.nmu-tab:hover{color:#cfd2d8}
.nmu-tab.on{background:#2b2f3a;color:#fff;border-bottom-color:var(--c)}
.nmu-tab i{font-style:normal;font-size:10px;font-weight:600;color:#8b90a0;margin-left:6px}
.nmu-tab .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3fa34d;margin-left:7px;vertical-align:1px;visibility:hidden}
.nmu-tab .dot.on{visibility:visible;animation:nmuPulse .9s infinite alternate}
@keyframes nmuPulse{from{opacity:1}to{opacity:.35}}
.nmu-sp{flex:1}
.nmu-btn{height:28px;padding:0 14px;border:none;border-radius:6px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;flex:none}
.nmu-btn:hover{filter:brightness(1.15)}
.nmu-hint{font-size:10px;color:#8b90a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:60px;flex:0 1 auto}
.nmu-part{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.nmu-part > *{flex:1 1 auto}
.nmu-help{display:none;flex:none;background:#20232a;border-radius:7px;padding:8px 10px;font-size:11px;line-height:1.55;color:#cfd2d8}
.nmu-help b{color:#ffd166}
`;
    document.head.appendChild(s);
}

function setupMusicUI(node) {
    injectStyles();
    node.properties = node.properties || {};
    let tab = node.properties.neron_music_tab === "piano" ? "piano" : "drums";
    let sizer = null;

    const root = el("div", "nmu-root");
    const tabs = el("div", "nmu-tabs");
    const mkTab = (key, icon, ru, en, color) => {
        const b = el("button", "nmu-tab");
        b.style.setProperty("--c", color);
        b.innerHTML = `${icon} ${ru}<i>${en}</i><span class="dot"></span>`;
        b.title = `${ru} / ${en}`;
        b.addEventListener("click", () => show(key));
        tabs.appendChild(b);
        return b;
    };
    const tabD = mkTab("drums", "🥁", "БАРАБАНЫ", "Drums", "#ff9f43");
    const tabP = mkTab("piano", "🎹", "ПИАНИНО", "Piano", "#54a0ff");
    tabs.appendChild(el("div", "nmu-sp"));
    const hint = el("div", "nmu-hint", "В Пульт идут 2 канала: барабаны и пианино / 2 channels go to the Pult");
    tabs.appendChild(hint);
    const playAll = el("button", "nmu-btn", "▶ ВСЁ ВМЕСТЕ / ALL");
    playAll.style.background = "#3fa34d";
    playAll.title = "Играть барабаны и пианино вместе / Play drums and piano together";
    const stopAll = el("button", "nmu-btn", "■");
    stopAll.style.background = "#b3414a";
    stopAll.title = "Остановить всё / Stop all";
    const helpBtn = el("button", "nmu-btn", "📖");
    helpBtn.style.background = "#4a4e5a";
    helpBtn.title = "Помощь / Help";
    tabs.appendChild(playAll);
    tabs.appendChild(stopAll);
    tabs.appendChild(helpBtn);
    root.appendChild(tabs);

    const help = el("div", "nmu-help");
    help.innerHTML =
        "<b>RU:</b> Вкладки сверху — <b>🥁 барабаны</b> и <b>🎹 пианино</b>. Темп общий: поменяли в одной вкладке — поменялся и в другой. "
        + "<b>▶ ВСЁ ВМЕСТЕ</b> — играть обе части разом. Подключите выход <b>sounds</b> к Пульту: там будет <b>2 канала</b> "
        + "(у каждого своя громкость, эквалайзер и эхо). Выход <b>audio</b> — всё вместе одним звуком.<br>"
        + "<b>EN:</b> Tabs on top — <b>🥁 drums</b> and <b>🎹 piano</b>. One tempo for both. <b>▶ ALL</b> plays both parts together. "
        + "Wire <b>sounds</b> into the Pult: you get <b>2 channels</b> (each with its own volume, EQ and reverb). <b>audio</b> is everything as one sound.";
    root.appendChild(help);
    helpBtn.addEventListener("click", () => {
        help.style.display = help.style.display === "block" ? "none" : "block";
        if (sizer) sizer.fit();
    });

    const partD = el("div", "nmu-part");
    const partP = el("div", "nmu-part");
    root.appendChild(partD);
    root.appendChild(partP);

    let autoD = () => 300, autoP = () => 676;
    const hostFor = (part, setAuto) => ({
        mount(r, autoH) { part.appendChild(r); setAuto(autoH); },
        fit() { if (sizer) sizer.fit(); },
    });

    // обе части строятся теми же функциями, что и отдельные ноды
    setupNeronUI(node, hostFor(partD, (f) => { autoD = f; }));
    const reloadD = node.neronReload, disposeD = node.neronDispose;
    setupPianoUI(node, hostFor(partP, (f) => { autoP = f; }));
    const reloadP = node.neronReload, disposeP = node.neronDispose;

    const btnIn = (part, text) => [...part.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));
    const playD = () => btnIn(partD, "▶ PLAY"), stopD = () => btnIn(partD, "■ STOP");
    const playP = () => btnIn(partP, "▶ PLAY"), stopP = () => btnIn(partP, "■ STOP");

    // игра — видно по точке на вкладке
    const playing = { d: false, p: false };
    const paintDots = () => {
        tabD.querySelector(".dot").classList.toggle("on", playing.d);
        tabP.querySelector(".dot").classList.toggle("on", playing.p);
    };
    const watch = (btn, key, on) => btn && btn.addEventListener("click", () => { playing[key] = on; paintDots(); });
    watch(playD(), "d", true); watch(stopD(), "d", false);
    watch(playP(), "p", true); watch(stopP(), "p", false);

    playAll.addEventListener("click", () => {
        stopD()?.click(); stopP()?.click();
        playD()?.click(); playP()?.click();
    });
    stopAll.addEventListener("click", () => { stopD()?.click(); stopP()?.click(); });

    function show(key) {
        tab = key;
        node.properties.neron_music_tab = key;
        partD.style.display = key === "drums" ? "flex" : "none";
        partP.style.display = key === "piano" ? "flex" : "none";
        tabD.classList.toggle("on", key === "drums");
        tabP.classList.toggle("on", key === "piano");
        // части меряют себя по ширине — дать им пересчитаться
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
            if (sizer) sizer.fit();
        });
    }

    const dom = node.addDOMWidget("neron_music", "neron_music", root, { serialize: false, hideOnZoom: false });
    const helpH = () => (help.style.display === "block" ? help.offsetHeight + 6 : 0);
    sizer = makeUserSized(node, dom, root, {
        minH: 240,
        autoH: () => TAB_H + 12 + helpH() + (tab === "drums" ? autoD() : autoP()),
    });
    show(tab);
    const wanted = node.computeSize ? node.computeSize() : [1100, 500];
    node.setSize([Math.max(wanted[0], 1100), wanted[1]]);
    setTimeout(() => sizer.fit(), 120);

    node.neronReload = () => {
        if (reloadD) reloadD();
        if (reloadP) reloadP();
        tab = node.properties.neron_music_tab === "piano" ? "piano" : "drums";
        show(tab);
    };
    node.neronDispose = () => {
        if (disposeD) disposeD();
        if (disposeP) disposeP();
    };
}

app.registerExtension({
    name: "NeronAudio.MusicUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronMusic") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupMusicUI(this);
            return r;
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            if (this.neronReload) this.neronReload();
            return r;
        };
        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDispose) this.neronDispose();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
