// 🖼 Neron H3 Кадры — оформление Neron и справка на двух языках.
import { app } from "../../scripts/app.js";

const NODE = "NeronH3Frames";

const HELP_TEXT = `
🖼 NERON H3 FRAMES
===================================================

📌 WHAT IT IS 📌
All pictures of the video in ONE wire into the
📝 Story AutoPrompter (input 'frames').

📌 INPUTS (all optional) 📌
first_frame — the opening frame. It is also the
              appearance reference <Picture 1> in
              every block (faces, hair, clothes).
mid_frame_1/2 — what appears during the video: a
              place, a creature, an object. WHEN it
              appears — the AutoPrompter decides by
              the scenario (if the scenario doesn't
              say — about 1/3 and 2/3 of the video).
last_frame  — how the video ends; pinned to the very
              last frame. Use a frame of the same scene
              and angle, otherwise the picture will
              "morph" into it.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Все картинки ролика ОДНИМ проводом в 📝 Story
AutoPrompter (вход 'frames').

📌 ВХОДЫ (все необязательные) 📌
first_frame — начало ролика. Он же образец внешности
              <Picture 1> во всех блоках (лица,
              волосы, одежда).
mid_frame_1/2 — что появится по ходу ролика: место,
              существо, предмет. КОГДА — решает
              AutoPrompter по сценарию (не сказано —
              примерно на 1/3 и 2/3 ролика).
last_frame  — чем ролик закончится; прикалывается к
              самому последнему кадру. Ставь кадр той
              же сцены и ракурса, иначе картинка
              «перетечёт» в него.

===================================================
`;

function showHelpDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;" +
        "align-items:center;justify-content:center;";
    const box = document.createElement("div");
    box.style.cssText = "background:#1a1a1a;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:20px;" +
        "max-width:820px;max-height:85vh;overflow-y:auto;font:13px/1.5 monospace;white-space:pre-wrap;" +
        "box-shadow:0 8px 32px rgba(0,0,0,0.8);";
    box.textContent = HELP_TEXT;
    const btn = document.createElement("button");
    btn.textContent = "Close / Закрыть";
    btn.style.cssText = "display:block;margin:16px auto 0;padding:8px 24px;background:#2a5d9c;color:#fff;" +
        "border:none;border-radius:4px;cursor:pointer;font:13px sans-serif;";
    btn.onclick = () => overlay.remove();
    box.append(btn);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box);
    document.body.append(overlay);
}

app.registerExtension({
    name: "Neron.H3.Frames",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const origCreated = nodeType.prototype.onNodeCreated;
        const origExecuted = nodeType.prototype.onExecuted;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            this.color = "#1e3a4a";
            this.bgcolor = "#10232e";
            this.resizable = true;
            this.__neronSummary = "";
            this.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            try { this.setSize([Math.max(this.size[0], 280), Math.max(this.size[1], 150)]); } catch (_) {}
            return r;
        };
        nodeType.prototype.onExecuted = function (msg) {
            const r = origExecuted?.apply(this, arguments);
            this.__neronSummary = (msg?.text || []).join(" ");
            app.graph?.setDirtyCanvas(true, false);
            return r;
        };
        nodeType.prototype.onDrawForeground = function (ctx) {
            const r = origDrawFg?.apply(this, arguments);
            if (this.flags?.collapsed || !this.__neronSummary) return r;
            ctx.save();
            ctx.textAlign = "left"; ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(170, 210, 230, 0.9)";
            ctx.fillText(this.__neronSummary, 10, this.size[1] - 8);
            ctx.restore();
            return r;
        };
    },
});
