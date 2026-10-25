import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { makeUserSized } from "./neron_common.js";

// ============================================================================
//  Neron Video Combine
//  После Queue готовое видео появляется прямо на ноде: со звуком, с перемоткой
//  и во весь размер ноды. Файл сохраняется в output/Neron_Videos.
// ============================================================================

const PANEL_H = 300;

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectStyles() {
    if (document.getElementById("neron-vc-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-vc-styles";
    s.textContent = `
.nv-root{box-sizing:border-box;width:100%;height:${PANEL_H}px;padding:8px;background:var(--nt-panel,#1b1d23);border-radius:8px;
  font-family:"Segoe UI",Arial,sans-serif;color:var(--nt-text,#cfd2d8);display:flex;flex-direction:column;gap:6px;overflow:hidden}
.nv-box{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:var(--nt-well,#101216);border-radius:6px;overflow:hidden}
.nv-box video{max-width:100%;max-height:100%;display:none;background:#000}
.nv-hint{font-size:11px;color:var(--nt-muted,#8b90a0);text-align:center;padding:0 12px;line-height:1.5}
.nv-info{flex:none;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
    document.head.appendChild(s);
}

function setupVideoCombine(node) {
    injectStyles();
    const root = el("div", "nv-root");
    const box = el("div", "nv-box");
    const video = document.createElement("video");
    video.controls = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    const hint = el("div", "nv-hint", "Подключите video (готовое видео) или images (кадры) и нажмите Queue. Результат появится здесь.");
    box.appendChild(video);
    box.appendChild(hint);
    const info = el("div", "nv-info", "");
    root.appendChild(box);
    root.appendChild(info);
    // стрелки и пробел внутри плеера не должны управлять схемой
    root.addEventListener("keydown", (e) => e.stopPropagation());

    const dom = node.addDOMWidget("neron_video_player", "neron_video_player", root, {
        serialize: false,
        hideOnZoom: false,
    });
    // размер задаёт пользователь: плеер растёт вместе с нодой
    makeUserSized(node, dom, root, { minH: 140, autoH: () => PANEL_H });

    node.neronShowVideo = (f) => {
        const q = `/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder || "")}&type=${encodeURIComponent(f.type || "output")}&t=${Date.now()}`;
        video.src = typeof api.apiURL === "function" ? api.apiURL(q) : q;
        video.style.display = "block";
        hint.style.display = "none";
        info.textContent = `Сохранено: output/${f.subfolder ? f.subfolder + "/" : ""}${f.filename}`;
        info.title = info.textContent;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
    };
    node.neronDisposeVideo = () => { try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) { /* ок */ } };

    const wanted = node.computeSize ? node.computeSize() : [420, 460];
    node.setSize([Math.max(wanted[0], 420), Math.max(wanted[1], PANEL_H + 220)]);
}

app.registerExtension({
    name: "NeronAudio.VideoCombineUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronVideoCombine") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupVideoCombine(this);
            return r;
        };

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const r = onExecuted ? onExecuted.apply(this, arguments) : undefined;
            const list = message && message.neron_video;
            if (Array.isArray(list) && list.length && this.neronShowVideo) this.neronShowVideo(list[0]);
            return r;
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            if (this.neronDisposeVideo) this.neronDisposeVideo();
            return onRemoved ? onRemoved.apply(this, arguments) : undefined;
        };
    },
});
