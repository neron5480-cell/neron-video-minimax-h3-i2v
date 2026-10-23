import { app } from "../../scripts/app.js";

const NODE_NAME = "NeronDialogAutoprompter";

const EXPERT_WIDGETS = [
    "model", "mmproj", "director_prompt", "dialog_mode",
    "clear_history", "max_tokens", "temperature",
    "n_ctx", "n_gpu_layers", "session_id", "save_session",
];

const EXPERT_INPUTS = ["ref_image_1", "ref_image_2", "last_frame"];
const IMAGE_INPUTS = ["ref_image_0", "ref_image_1", "ref_image_2", "last_frame"];
const ALWAYS_HIDDEN = ["user_message", "run_trigger"];

// Все виджеты, связанные с разрешением
const RESOLUTION_WIDGETS = [
    "resolution_mode", "resolution_preset",
    "manual_width", "manual_height",
    "divisible_by",
];


function toggleWidget(widget, show) {
    if (!widget) return;
    if (widget.__origType === undefined) {
        widget.__origType = widget.type;
        widget.__origComputeSize = widget.computeSize;
    }
    widget.type = show ? widget.__origType : "converted-widget";
    widget.computeSize = show ? widget.__origComputeSize : () => [0, -4];
    widget.hidden = !show;
}


// Есть ли подключение к width/height (размеры от фотошопа)
function hasImageSizeInput(node) {
    const w = node.inputs?.find((i) => i.name === "width");
    const h = node.inputs?.find((i) => i.name === "height");
    return (w?.link != null) && (h?.link != null);
}


function updateVisibility(node) {
    const expertWidget = node.widgets?.find((w) => w.name === "expert_mode");
    const expert = !!expertWidget?.value;

    // ── Экспертные виджеты ──
    for (const name of EXPERT_WIDGETS) {
        toggleWidget(node.widgets?.find((w) => w.name === name), expert);
    }
    for (const name of EXPERT_INPUTS) {
        const input = node.inputs?.find((i) => i.name === name);
        if (input) input.hidden = !expert;
    }

    for (const name of ALWAYS_HIDDEN) {
        toggleWidget(node.widgets?.find((w) => w.name === name), false);
    }

    // ── Разрешение ──
    // Логика:
    //   ПРОФИ:  всё видно всегда, независимо от фотошопа.
    //   НОВИЧОК:
    //     - фотошоп подключён → всё скрыто (размеры берутся оттуда);
    //     - фотошопа нет → показать mode, preset/manual, divisible_by.

    const hasPhotoSize = hasImageSizeInput(node);
    const manualMode = (node.widgets?.find((w) => w.name === "resolution_mode")?.value) === "Ручной";

    if (expert) {
        // Профи — всё видно
        toggleWidget(node.widgets?.find((w) => w.name === "resolution_mode"), true);
        toggleWidget(node.widgets?.find((w) => w.name === "divisible_by"), true);
        toggleWidget(node.widgets?.find((w) => w.name === "resolution_preset"), !manualMode);
        toggleWidget(node.widgets?.find((w) => w.name === "manual_width"), manualMode);
        toggleWidget(node.widgets?.find((w) => w.name === "manual_height"), manualMode);
    } else {
        // Новичок
        if (hasPhotoSize) {
            for (const name of RESOLUTION_WIDGETS) {
                toggleWidget(node.widgets?.find((w) => w.name === name), false);
            }
        } else {
            toggleWidget(node.widgets?.find((w) => w.name === "resolution_mode"), true);
            toggleWidget(node.widgets?.find((w) => w.name === "divisible_by"), true);
            toggleWidget(node.widgets?.find((w) => w.name === "resolution_preset"), !manualMode);
            toggleWidget(node.widgets?.find((w) => w.name === "manual_width"), manualMode);
            toggleWidget(node.widgets?.find((w) => w.name === "manual_height"), manualMode);
        }
    }

    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
}


function getSessionKey(node) {
    const sid = node.widgets?.find((w) => w.name === "session_id")?.value || "default";
    const model = node.widgets?.find((w) => w.name === "model")?.value || "";
    const mmproj = node.widgets?.find((w) => w.name === "mmproj")?.value || "";
    return `${sid}|${model}|${mmproj}`;
}


function findUpstreamImage(node, inputName) {
    const input = node.inputs?.find((i) => i.name === inputName);
    if (!input || input.link == null) return null;

    const link = node.graph?.links?.[input.link];
    if (!link) return null;

    const originNode = node.graph.getNodeById(link.origin_id);
    if (!originNode) return null;

    let filename = null;
    for (const w of originNode.widgets ?? []) {
        if (["image", "filename", "file"].includes(w.name) && w.value) {
            filename = String(w.value);
            break;
        }
    }
    if (!filename) return null;

    let type = "input";
    const ann = filename.match(/\s+\[(input|output|temp)\]$/i);
    if (ann) {
        type = ann[1].toLowerCase();
        filename = filename.slice(0, ann.index);
    }
    filename = filename.replaceAll("\\", "/");
    const slash = filename.lastIndexOf("/");
    const subfolder = slash >= 0 ? filename.slice(0, slash) : "";
    if (slash >= 0) filename = filename.slice(slash + 1);

    return { filename, subfolder, type, originId: originNode.id };
}


function findAllUpstreamImages(node) {
    const result = {};
    for (const slot of IMAGE_INPUTS) {
        const info = findUpstreamImage(node, slot);
        if (info) result[slot] = info;
    }
    return result;
}


function extractArtisticPrompt(text) {
    if (!text) return null;

    const closed = text.match(/\[ARTISTIC_PROMPT\]([\s\S]*?)\[\/ARTISTIC_PROMPT\]/i);
    if (closed) return closed[1].trim();

    const openOnly = text.match(/\[ARTISTIC_PROMPT\]([\s\S]*)/i);
    if (openOnly) {
        let inner = openOnly[1].trim();
        inner = inner.replace(/\[\/ARTISTIC_PROMPT\]\s*$/i, "").trim();
        if (inner) return inner;
    }

    return null;
}

function stripArtisticPrompt(text) {
    if (!text) return text;
    let out = text.replace(/\[ARTISTIC_PROMPT\][\s\S]*?\[\/ARTISTIC_PROMPT\]/gi, "").trim();
    out = out.replace(/\[ARTISTIC_PROMPT\][\s\S]*/gi, "").trim();
    return out;
}


async function pushParams(node, sessionKey) {
    const get = (name, fallback) =>
        node.widgets?.find((w) => w.name === name)?.value ?? fallback;

    const params = {
        model: get("model", ""),
        mmproj: get("mmproj", ""),
        n_gpu_layers: get("n_gpu_layers", -1),
        n_ctx: get("n_ctx", 8192),
        max_tokens: get("max_tokens", 4096),
        temperature: get("temperature", 0.7),
        director_prompt: get("director_prompt", ""),
    };

    try {
        await fetch("/neron_dialog/set_params", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: sessionKey, params }),
        });
    } catch (e) {
        console.warn("[Neron Dialog] set_params failed:", e);
    }
}


async function pushImages(node, sessionKey) {
    const all = findAllUpstreamImages(node);

    const signature = Object.entries(all)
        .map(([k, v]) => `${k}:${v.filename}|${v.subfolder}|${v.type}|${v.originId}`)
        .sort()
        .join("||");

    if (node.__lastImagesSignature === signature) return;
    node.__lastImagesSignature = signature;

    try {
        const resp = await fetch("/neron_dialog/set_images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: sessionKey, images: all }),
        });
        const data = await resp.json();
        if (data.error) {
            console.warn("[Neron Dialog] set_images error:", data.error);
        } else if (data.changed) {
            node.__greetedSessions?.delete(sessionKey);
            if (node.__chatPanel) node.__chatPanel.refresh();
        }
    } catch (e) {
        console.warn("[Neron Dialog] set_images failed:", e);
    }
}


async function autoGreet(node, sessionKey) {
    if (!node.__greetedSessions) node.__greetedSessions = new Set();
    if (node.__greetedSessions.has(sessionKey)) return;

    try {
        const resp = await fetch(`/neron_dialog/history?session_key=${encodeURIComponent(sessionKey)}`);
        const data = await resp.json();
        const log = data.log || [];
        if (log.some(m => m.role === "assistant")) {
            node.__greetedSessions.add(sessionKey);
            return;
        }
    } catch (e) {
        return;
    }

    try {
        const resp = await fetch("/neron_dialog/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_key: sessionKey }),
        });
        const data = await resp.json();
        if (data.response || data.skipped) {
            node.__greetedSessions.add(sessionKey);
            if (node.__chatPanel) node.__chatPanel.refresh();
        }
    } catch (e) {
        console.warn("[Neron Dialog] start failed:", e);
    }
}


function createChatPanel(node) {
    const root = document.createElement("div");
    root.style.cssText =
        "display:flex;flex-direction:column;width:100%;height:100%;" +
        "min-width:0;box-sizing:border-box;overflow:hidden;" +
        "background:#151515;border:1px solid #383838;" +
        "font-family:sans-serif;color:#d0d0d0;";

    const log = document.createElement("div");
    log.style.cssText =
        "flex:1 1 auto;min-height:120px;overflow-y:auto;padding:8px;" +
        "display:flex;flex-direction:column;gap:6px;background:#101010;";

    const card = document.createElement("div");
    card.style.cssText =
        "display:none;flex-direction:column;gap:8px;margin:6px;" +
        "padding:10px 12px;background:#1a2e1a;border:1px solid #2d7a2d;" +
        "border-radius:6px;font-family:sans-serif;box-sizing:border-box;";

    const cardTitle = document.createElement("div");
    cardTitle.textContent = "📝 ГОТОВЫЙ ПРОМПТ";
    cardTitle.style.cssText =
        "font-size:12px;font-weight:bold;color:#7dd87d;" +
        "letter-spacing:0.5px;";

    const cardText = document.createElement("div");
    cardText.style.cssText =
        "font-size:13px;line-height:1.5;color:#e0e0e0;" +
        "white-space:pre-wrap;word-wrap:break-word;" +
        "max-height:200px;overflow-y:auto;" +
        "padding:6px 8px;background:#0f1a0f;border-radius:3px;" +
        "border:1px solid #2a4a2a;";

    const cardButtons = document.createElement("div");
    cardButtons.style.cssText = "display:flex;gap:8px;";

    const btnEdit = document.createElement("button");
    btnEdit.textContent = "✏️ Исправить";
    btnEdit.style.cssText =
        "flex:1;padding:6px;background:#3a3a3a;color:#e0e0e0;" +
        "border:1px solid #555;border-radius:3px;cursor:pointer;" +
        "font:12px sans-serif;";

    const btnAccept = document.createElement("button");
    btnAccept.textContent = "✅ Готово";
    btnAccept.style.cssText =
        "flex:1;padding:6px;background:#2d7a2d;color:#fff;" +
        "border:none;border-radius:3px;cursor:pointer;" +
        "font:12px sans-serif;font-weight:bold;";

    cardButtons.append(btnEdit, btnAccept);
    card.append(cardTitle, cardText, cardButtons);

    const input = document.createElement("textarea");
    input.placeholder = "Напиши сообщение...";
    input.style.cssText =
        "width:100%;box-sizing:border-box;min-height:48px;max-height:120px;" +
        "padding:6px 8px;background:#0d0d0d;color:#e0e0e0;" +
        "border:1px solid #333;border-radius:3px;font:13px sans-serif;" +
        "resize:vertical;outline:none;";

    const btnRow = document.createElement("div");
    btnRow.style.cssText =
        "display:flex;gap:6px;padding:6px;background:#1a1a1a;" +
        "border-top:1px solid #333;";

    const btnSend = document.createElement("button");
    btnSend.textContent = "Отправить";
    btnSend.style.cssText =
        "flex:1;padding:6px;background:#2a5d9c;color:#fff;border:none;" +
        "border-radius:3px;cursor:pointer;font:12px sans-serif;";

    const btnReset = document.createElement("button");
    btnReset.textContent = "Сброс";
    btnReset.style.cssText =
        "padding:6px 10px;background:#5d2a2a;color:#fff;border:none;" +
        "border-radius:3px;cursor:pointer;font:12px sans-serif;";

    btnRow.append(btnSend, btnReset);
    root.append(log, card, input, btnRow);

    let isSending = false;
    let cardPrompt = "";
    let dismissedFor = "";

    function showCard(prompt) {
        cardPrompt = prompt;
        cardText.textContent = prompt;
        card.style.display = "flex";
        card.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }

    function hideCard() {
        card.style.display = "none";
    }

    function renderLog(messages) {
        log.innerHTML = "";
        let lastArtistic = null;

        for (const m of messages) {
            const bubble = document.createElement("div");
            const isUser = m.role === "user";
            const isError = m.role === "error";

            let content = m.content;
            if (!isUser && !isError) {
                const ap = extractArtisticPrompt(content);
                if (ap) {
                    lastArtistic = ap;
                    content = stripArtisticPrompt(content);
                }
            }

            if (!content) continue;

            bubble.style.cssText =
                `padding:6px 10px;border-radius:6px;max-width:85%;` +
                `font-size:13px;line-height:1.4;word-wrap:break-word;` +
                `white-space:pre-wrap;` +
                (isUser
                    ? "align-self:flex-end;background:#2a5d9c;color:#fff;"
                    : isError
                        ? "align-self:flex-start;background:#5d2a2a;color:#fff;"
                        : "align-self:flex-start;background:#2a2a2a;color:#d0d0d0;");

            bubble.textContent = content;
            log.append(bubble);
        }

        if (lastArtistic && lastArtistic !== dismissedFor) {
            showCard(lastArtistic);
        } else if (!lastArtistic) {
            hideCard();
        }

        log.scrollTop = log.scrollHeight;
    }

    async function fetchHistory() {
        const key = getSessionKey(node);
        try {
            const resp = await fetch(`/neron_dialog/history?session_key=${encodeURIComponent(key)}`);
            const data = await resp.json();
            renderLog(data.log || []);
        } catch (e) {
            console.warn("[Neron Dialog] history fetch failed:", e);
        }
    }

    async function sendMessage() {
        if (isSending) return;
        const text = input.value.trim();
        if (!text) return;

        const key = getSessionKey(node);

        isSending = true;
        btnSend.disabled = true;
        btnSend.textContent = "Думаю...";
        input.value = "";

        const bubble = document.createElement("div");
        bubble.style.cssText =
            "padding:6px 10px;border-radius:6px;max-width:85%;" +
            "font-size:13px;line-height:1.4;word-wrap:break-word;" +
            "white-space:pre-wrap;align-self:flex-end;background:#2a5d9c;color:#fff;";
        bubble.textContent = text;
        log.append(bubble);
        log.scrollTop = log.scrollHeight;

        try {
            await pushParams(node, key);

            const resp = await fetch("/neron_dialog/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_key: key, message: text }),
            });
            const data = await resp.json();

            if (data.error) {
                const err = document.createElement("div");
                err.style.cssText =
                    "padding:6px 10px;border-radius:6px;max-width:85%;" +
                    "font-size:13px;background:#5d2a2a;color:#fff;align-self:flex-start;";
                err.textContent = "⚠ " + data.error;
                log.append(err);
            } else {
                const fullText = data.response || "(пусто)";
                const ap = extractArtisticPrompt(fullText);
                const visibleText = ap ? stripArtisticPrompt(fullText) : fullText;

                if (visibleText) {
                    const reply = document.createElement("div");
                    reply.style.cssText =
                        "padding:6px 10px;border-radius:6px;max-width:85%;" +
                        "font-size:13px;line-height:1.4;word-wrap:break-word;" +
                        "white-space:pre-wrap;align-self:flex-start;background:#2a2a2a;color:#d0d0d0;";
                    reply.textContent = visibleText;
                    log.append(reply);
                }

                if (ap) {
                    if (ap !== dismissedFor) dismissedFor = "";
                    showCard(ap);
                }
            }
            log.scrollTop = log.scrollHeight;
        } catch (e) {
            console.error("[Neron Dialog] send error:", e);
        } finally {
            isSending = false;
            btnSend.disabled = false;
            btnSend.textContent = "Отправить";
        }
    }

    async function resetHistory() {
        const key = getSessionKey(node);
        try {
            await fetch("/neron_dialog/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_key: key }),
            });
            log.innerHTML = "";
            input.value = "";
            hideCard();
            dismissedFor = "";
            node.__greetedSessions?.delete(key);
            setTimeout(() => autoGreet(node, key), 300);
        } catch (e) {
            console.warn("[Neron Dialog] reset failed:", e);
        }
    }

    btnEdit.addEventListener("click", () => {
        dismissedFor = cardPrompt;
        hideCard();
        input.focus();
    });

    btnAccept.addEventListener("click", async () => {
        if (!cardPrompt) return;
        const key = getSessionKey(node);

        btnAccept.disabled = true;
        btnAccept.textContent = "Отправляю...";

        try {
            await fetch("/neron_dialog/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_key: key, prompt: cardPrompt }),
            });

            const trig = node.widgets?.find((w) => w.name === "run_trigger");
            if (trig) {
                trig.value = (Number(trig.value) || 0) + 1;
                trig.callback?.(trig.value);
            }

            hideCard();
            const sent = document.createElement("div");
            sent.style.cssText =
                "padding:6px 10px;border-radius:6px;max-width:85%;" +
                "font-size:12px;font-style:italic;color:#7dd87d;" +
                "align-self:flex-start;";
            sent.textContent = "(промпт отправлен в генерацию)";
            log.append(sent);
            log.scrollTop = log.scrollHeight;

            console.log("[Neron Dialog] Запуск графа с готовым промптом...");
            app.queuePrompt(0, 1);

        } catch (e) {
            console.error("[Neron Dialog] finalize error:", e);
        } finally {
            btnAccept.disabled = false;
            btnAccept.textContent = "✅ Готово";
        }
    });

    btnSend.addEventListener("click", sendMessage);
    btnReset.addEventListener("click", resetHistory);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    setTimeout(fetchHistory, 200);

    return { root, refresh: fetchHistory };
}


app.registerExtension({
    name: "Neron.DialogAutoprompter",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        const origConfigure = nodeType.prototype.onConfigure;

        nodeType.prototype.onNodeCreated = function () {
            const r = origCreated?.apply(this, arguments);
            const node = this;

            const chat = createChatPanel(node);
            node.__chatPanel = chat;

            node.addDOMWidget("neron_chat_panel", "chat", chat.root, {
                serialize: false,
                hideOnZoom: false,
                getMinHeight: () => 320,
            });

            const watch = [
                "expert_mode", "session_id", "model", "mmproj",
                "n_ctx", "n_gpu_layers", "max_tokens", "temperature",
                "director_prompt",
                "resolution_mode", "resolution_preset",
                "manual_width", "manual_height", "divisible_by",
            ];
            for (const widget of node.widgets ?? []) {
                if (!watch.includes(widget.name)) continue;
                const orig = widget.callback;
                widget.callback = function () {
                    const result = orig?.apply(this, arguments);
                    updateVisibility(node);

                    const key = getSessionKey(node);
                    if (widget.name === "session_id") {
                        chat.refresh();
                        node.__lastImagesSignature = null;
                    }
                    if (["model", "mmproj", "n_ctx", "n_gpu_layers",
                         "max_tokens", "temperature", "director_prompt"].includes(widget.name)) {
                        pushParams(node, key);
                    }

                    return result;
                };
            }

            const poll = setInterval(async () => {
                if (!node.graph) {
                    clearInterval(poll);
                    return;
                }
                const key = getSessionKey(node);
                await pushImages(node, key);
                await autoGreet(node, key);
                updateVisibility(node);
            }, 1500);
            node.__pollInterval = poll;

            setTimeout(async () => {
                const key = getSessionKey(node);
                await pushParams(node, key);
                await pushImages(node, key);
                await autoGreet(node, key);
                updateVisibility(node);
            }, 600);

            node.setSize([
                Math.max(Number(node.size?.[0] ?? 420), 480),
                Math.max(Number(node.size?.[1] ?? 600), 720),
            ]);

            return r;
        };

        nodeType.prototype.onConfigure = function () {
            const r = origConfigure?.apply(this, arguments);
            const node = this;
            setTimeout(async () => {
                const key = getSessionKey(node);
                await pushParams(node, key);
                await pushImages(node, key);
                await autoGreet(node, key);
                updateVisibility(node);
                node.__lastImagesSignature = null;
            }, 500);
            return r;
        };

        nodeType.prototype.onRemoved = function () {
            if (this.__pollInterval) clearInterval(this.__pollInterval);
        };
    },
});