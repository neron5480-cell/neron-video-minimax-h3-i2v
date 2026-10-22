// Показываем текст журнала и путь к итоговому видео прямо в ноде.
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

const NODES = ["PerceptionRelayJournal", "PerceptionRelayFinish", "PerceptionRelayHub"];

app.registerExtension({
    name: "PerceptionRelay.TextOutput",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!NODES.includes(nodeData.name)) return;
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            const text = (message?.text || []).join("\n");
            let w = this.widgets?.find((x) => x.name === "relay_text");
            if (!w) {
                w = ComfyWidgets["STRING"](this, "relay_text", ["STRING", { multiline: true }], app).widget;
                w.inputEl.readOnly = true;
                w.inputEl.style.opacity = 0.9;
                w.inputEl.style.fontFamily = "monospace";
                w.inputEl.style.fontSize = "11px";
            }
            w.value = text;
            const need = nodeData.name === "PerceptionRelayFinish" ? this.size : [520, 420];
            if (this.__relayLive?.fitNode) requestAnimationFrame(() => this.__relayLive.fitNode());
            else this.setSize([Math.max(this.size[0], need[0]), Math.max(this.size[1], need[1])]);
            app.graph.setDirtyCanvas(true, true);
        };
    },
});
