// 🎞 Neron H3 Блок — оформление Neron, подпись «какой это блок» (по тому, куда подключён) и справка.
import { app } from "../../scripts/app.js";

const NODE = "NeronH3Block";

const HELP_TEXT = `
🎞 NERON H3 BLOCK — ONE SCENE
===================================================

📌 WHAT IT IS 📌
One block (scene) of a Neron H3 Story video: its
pictures, what happens and its LoRAs — in one wire.
Which block it is depends on where you connect it:
block_2 on the engine = block 2.
The header shows it: "→ block 2".

📌 PICTURES 📌
first_frame — block 1: the opening frame of the video.
              Blocks 2+ start from the previous block's
              tail (seamless, with sound); here it is a
              "who / where" reference.
mid_frame_1/2 — navigators: "the action goes here" —
              another room, a place, an object.
last_frame  — how this block must end; pinned to its
              last frame.
All optional except block 1's first frame (or the
engine's first_frame input).

📌 TEXT 📌
In your own words, any language.
Without the AutoPrompter it IS the block prompt.
With the AutoPrompter (engine expert + story): your
text REPLACES that block's prompt; leave it empty to
keep the AutoPrompter's prompt and only add LoRAs.
Refer to pictures yourself as <Picture N> (the
engine's report shows which is which).

📌 LORA 📌
🎨 LoRA set > loras — only for this block
(a fight here, a sunset in the next one).

===================================================
🇷🇺 РУССКИЙ
===================================================

📌 ЧТО ЭТО 📌
Один блок (сцена) ролика Neron H3 Story: его
картинки, что происходит и его LoRA — одним проводом.
Какой это блок — решает, куда подключил:
block_2 на движке = блок 2.
В заголовке так и видно: «→ блок 2».

📌 КАРТИНКИ 📌
first_frame — блок 1: первый кадр ролика.
              Блоки 2+ начинаются с хвоста прошлого
              блока (без шва, со звуком); здесь —
              образец «кто / где».
mid_frame_1/2 — навигаторы: «действие идёт сюда» —
              другая комната, место, предмет.
last_frame  — чем блок должен закончиться;
              прикалывается к его последнему кадру.
Всё необязательно, кроме первого кадра блока 1
(или входа first_frame на движке).

📌 ТЕКСТ 📌
Своими словами, на любом языке.
Без AutoPrompter это и есть промпт блока.
С AutoPrompter (эксперт движка + story): твой текст
ЗАМЕНЯЕТ промпт этого блока; оставь пустым — промпт
AutoPrompter останется, добавятся только LoRA.
На картинки ссылайся сам как <Picture N> (какая
какая — видно в отчёте движка).

📌 LORA 📌
🎨 Набор LoRA > loras — только для этого блока
(здесь драка, в следующем — закат).

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

// куда подключён: имя входа на ноде-получателе (block_2 → «блок 2»)
function targetLabel(node) {
    const links = node.outputs?.[0]?.links || [];
    const names = [];
    for (const id of links) {
        const l = app.graph?.links?.[id] ?? app.graph?.links?.get?.(id);
        if (!l) continue;
        const t = app.graph.getNodeById(l.target_id);
        const inp = t?.inputs?.[l.target_slot];
        const m = inp?.name?.match(/^block_(\d+)$/);
        if (m) names.push(m[1]);
    }
    return names.length ? `→ блок ${names.join(", ")} / block ${names.join(", ")}` : "не подключён / not connected";
}

app.registerExtension({
    name: "Neron.H3.Block",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE) return;
        const origCreated = nodeType.prototype.onNodeCreated;
        const origExecuted = nodeType.prototype.onExecuted;
        const origDrawFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            this.color = "#1e3a4a";
            this.bgcolor = "#10232e";
            this.__neronSummary = "";
            this.addWidget("button", "📖 Help / Справка", null, () => showHelpDialog());
            try { this.setSize([Math.max(this.size[0], 360), Math.max(this.size[1], 300)]); } catch (_) {}
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
            if (this.flags?.collapsed) return r;
            ctx.save();
            ctx.font = "bold 12px sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = "rgba(150, 220, 255, 0.95)";
            ctx.fillText(targetLabel(this), this.size[0] - 10, -8);
            if (this.__neronSummary) {
                ctx.textAlign = "left"; ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(170, 210, 230, 0.9)";
                let t = this.__neronSummary;
                const maxW = this.size[0] - 20;
                while (t.length > 4 && ctx.measureText(t).width > maxW) t = t.slice(0, -2);
                ctx.fillText(t, 10, this.size[1] - 8);
            }
            ctx.restore();
            return r;
        };
    },
});
