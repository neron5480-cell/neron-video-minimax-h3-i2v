// 🎨 Neron H3 LoRA — набор LoRA для блока Neron H3 Story: оформление Neron, итог набора и справка.
import { app } from "../../scripts/app.js";

const NODE = "NeronH3LoraPack";

const HELP_TEXT = `
🎨 NERON H3 LORA — LoRA SET
===================================================

📌 WHAT IT IS 📌
Picks LoRAs and their strength for ONE block of
Neron H3 Story — or for the whole video.
It loads nothing itself: the engine applies the
set only to its block.

📌 WHERE TO CONNECT 📌
loras > lora_2   — only block 2 (the fight, say).
loras > lora_all — the whole video (style, character).
Block LoRAs are added on top of lora_all.

📌 MORE THAN THREE 📌
Chain sets: output 'loras' of one set > input 'pack'
of another. All of them go to the block together.

📌 MISSING FILE 📌
A LoRA from someone else's workflow that you don't
have is skipped with a note — no red error.

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Выбор LoRA и их силы для ОДНОГО блока Neron H3
Story — или для всего ролика. Сама нода ничего не
грузит: движок наложит набор только на свой блок.

📌 КУДА ПОДКЛЮЧАТЬ 📌
loras > lora_2   — только блок 2 (например, драка).
loras > lora_all — весь ролик (стиль, персонаж).
LoRA блока добавляются поверх lora_all.

📌 БОЛЬШЕ ТРЁХ 📌
Наборы цепляются: выход 'loras' одного набора >
вход 'pack' другого. В блок уйдут все вместе.

📌 НЕТ ФАЙЛА 📌
LoRA из чужой схемы, которой у тебя нет,
пропускается с пояснением — без красного окна.

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
    name: "Neron.H3.LoraPack",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const origCreated = nodeType.prototype.onNodeCreated;
        const origExecuted = nodeType.prototype.onExecuted;
        const origDrawBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            this.color = "#3a2350";
            this.bgcolor = "#24152f";
            this.__neronSummary = "";
            this.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            try { this.setSize([Math.max(this.size[0], 340), this.computeSize()[1] + 64]); } catch (_) {}   // место под итог
            return r;
        };
        nodeType.prototype.onExecuted = function (msg) {
            const r = origExecuted?.apply(this, arguments);
            this.__neronSummary = (msg?.text || []).join("\n");
            app.graph?.setDirtyCanvas(true, false);
            return r;
        };
        nodeType.prototype.onDrawBackground = function (ctx) {
            origDrawBg?.apply(this, arguments);
            if (this.flags?.collapsed || !this.__neronSummary) return;
            ctx.save();
            ctx.font = "12px sans-serif"; ctx.fillStyle = "rgba(225, 180, 255, 0.95)"; ctx.textAlign = "left";
            const lines = this.__neronSummary.split("\n").slice(0, 6);
            let y = this.size[1] - 8 - (lines.length - 1) * 15;
            for (const l of lines) { ctx.fillText(l, 12, y); y += 15; }
            ctx.restore();
        };
    },
});
