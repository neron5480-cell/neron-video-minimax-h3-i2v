// Живое окно Пульта / Live window of the Pult.
// Крутишь ползунок любой подключённой карточки — Пульт просит у сервера один кадр и показывает его.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const HUB = "PerceptionRelayHub";
const CARD_STAGE = {
    PerceptionRelayCardScout: "scout",
    PerceptionRelayCardFlow: "flow",
    PerceptionRelayCardJudge: "judge",
    PerceptionRelayCardEdge: "edge",
    PerceptionRelayCardTone: "tone",
    PerceptionRelayCardSeam: "seam",
    PerceptionRelayCardPolish: "polish",
    PerceptionRelayCardBasic: "basic",
    PerceptionRelayCardPoints: "points",
};
const SKIP_WIDGETS = new Set(["control_after_generate", "control_before_generate"]);
const HUB_TRIGGERS = new Set(["live", "live_frame", "live_view", "job_name", "video_path"]);

function wv(node, name) {
    const w = node.widgets?.find((x) => x.name === name);
    return w ? w.value : undefined;
}

function originNode(node, inputName) {
    const inp = node.inputs?.find((i) => i.name === inputName);
    if (!inp || inp.link == null) return null;
    const link = app.graph.links[inp.link] ?? app.graph.links.get?.(inp.link);
    if (!link) return null;
    return app.graph.getNodeById(link.origin_id);
}

function gatherCards(hub) {
    const cards = [];
    for (const inp of hub.inputs || []) {
        if (!inp.name.startsWith("этап_")) continue;
        const n = originNode(hub, inp.name);
        if (!n || n.mode === 2 || n.mode === 4) continue; // выключена / bypass — этап пропущен
        const stage = CARD_STAGE[n.type];
        if (!stage) continue;
        const params = {};
        for (const w of n.widgets || []) {
            if (!w.name || SKIP_WIDGETS.has(w.name) || w.type === "button") continue;
            params[w.name] = w.value;
        }
        cards.push({ stage, params });
    }
    return cards;
}

const VIDEO_RE = /\.(mp4|mov|mkv|webm|avi|m4v|gif|mpg|mpeg|wmv|flv)(\s*\[\w+\])?$/i;

function valuesOf(node) {
    const vals = [];
    for (const w of node.widgets || []) vals.push([w.name, w.value]);
    if (Array.isArray(node.widgets_values)) node.widgets_values.forEach((v, i) => vals.push([`#${i}`, v]));
    return vals;
}

// Ищем имя видеофайла в ноде, подключённой ко входу video (через reroute и подобные — тоже).
function videoSource(hub) {
    let n = originNode(hub, "video");
    const seen = new Set();
    while (n && !seen.has(n.id)) {
        seen.add(n.id);
        for (const [, v] of valuesOf(n)) {
            if (typeof v === "string" && VIDEO_RE.test(v.trim())) return { file: v.trim() };
            if (v && typeof v === "object" && typeof v.filename === "string" && VIDEO_RE.test(v.filename))
                return { file: v.subfolder ? `${v.subfolder}/${v.filename}` : v.filename };
        }
        // промежуточная нода (reroute и т.п.) — идём дальше по первому входу
        const inp = (n.inputs || []).find((i) => i.link != null);
        if (!inp) break;
        n = originNode(n, inp.name);
    }
    const first = originNode(hub, "video");
    if (!first) return { error: "вход video не подключён / video input not connected" };
    const names = valuesOf(first).map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 30) : typeof v}`).join(", ");
    console.warn("[PerceptionRelay] video file not found in node", first.type, valuesOf(first));
    return { error: `в ноде «${first.type}» не выбран файл — выбери видео заново в её поле file / no file selected (${names})` };
}

function decodeHex(hex) {
    if (!hex) return "";
    const bytes = new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    return new TextDecoder("utf-8").decode(bytes);
}

function setupLive(hub) {
    if (hub.__relayLive) return;
    const box = document.createElement("div");
    box.style.cssText = "width:100%;display:flex;flex-direction:column;gap:4px;";
    const status = document.createElement("div");
    status.style.cssText = "font:11px monospace;color:#cfd8dc;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    status.textContent = "живое окно: подключи видео и карточки / live: connect video and cards";
    const img = document.createElement("img");
    img.style.cssText = "width:100%;object-fit:contain;background:#111;border-radius:4px;min-height:60px;display:block;";
    const stage = document.createElement("div");
    stage.style.cssText = "position:relative;width:100%;";
    const lens = document.createElement("div");
    lens.style.cssText = "position:absolute;width:180px;height:180px;border-radius:50%;border:2px solid rgba(255,255,255,.85);" +
        "box-shadow:0 4px 18px rgba(0,0,0,.6);background-repeat:no-repeat;pointer-events:none;display:none;";
    stage.append(img, lens);
    box.append(status, stage);

    // лупа: навёл — увеличил (колесо — сила увеличения). Показывает кадр в его настоящем разрешении.
    let zoom = 0;
    const showLens = (e) => {
        if (!img.src || !img.naturalWidth) return;
        const r = img.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        if (x < 0 || y < 0 || x > r.width || y > r.height) { lens.style.display = "none"; return; }
        const native = img.naturalWidth / r.width;
        const z = zoom || Math.max(2.5, native);
        const R = 90;
        lens.style.display = "block";
        lens.style.left = `${x - R}px`;
        lens.style.top = `${y - R}px`;
        lens.style.backgroundImage = `url(${img.src})`;
        lens.style.backgroundSize = `${r.width * z}px ${r.height * z}px`;
        lens.style.backgroundPosition = `${-(x * z - R)}px ${-(y * z - R)}px`;
    };
    stage.addEventListener("mousemove", showLens);
    stage.addEventListener("mouseleave", () => { lens.style.display = "none"; });
    stage.addEventListener("wheel", (e) => {
        if (lens.style.display !== "block") return;
        e.preventDefault(); e.stopPropagation();
        const r = img.getBoundingClientRect();
        const base = zoom || Math.max(2.5, img.naturalWidth / r.width);
        zoom = Math.min(10, Math.max(1.5, base * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        showLens(e);
    }, { passive: false });
    const st = { timer: null, seq: 0, url: null, inflight: false, again: false, ar: 9 / 16 };
    // высота окна: от ширины ноды и пропорций кадра; меняется только при смене пропорций или ширины
    // высота окна: от ширины ноды и пропорций кадра, но не выше MAX_H — вертикальное видео
    // вписывается целиком (с полями по бокам), а не растягивает ноду на весь экран
    const MAX_H = 640;
    const imgH = (width) => Math.min(MAX_H, Math.max(120, Math.round((width - 20) * st.ar)));
    const layout = () => { img.style.height = `${imgH(hub.size[0])}px`; };
    img.style.objectFit = "contain";
    let fitting = false;
    const fitNode = () => {                     // нода ровно под окно (и кнопки/текст над ним)
        if (fitting) return;
        const top = st.widget?.last_y;
        if (top == null) return;
        let extra = 0;                          // то, что стоит под окном (текст журнала после прогона)
        const ws = hub.widgets || [];
        for (let i = ws.indexOf(st.widget) + 1; i > 0 && i < ws.length; i++) {
            const w = ws[i];
            let hh = 120;
            try { const cs = w.computeSize?.(hub.size[0]); if (cs && cs[1] > 0) hh = cs[1]; } catch (_) {}
            extra += hh + 6;
        }
        const need = Math.round(top + imgH(hub.size[0]) + 40 + extra);
        if (Math.abs(hub.size[1] - need) > 2) {
            fitting = true;
            hub.setSize([hub.size[0], need]);
            fitting = false;
            app.graph.setDirtyCanvas(true, true);
        }
    };
    st.fitNode = fitNode;
    img.onload = () => {
        const ar = img.naturalHeight / Math.max(1, img.naturalWidth);
        if (Math.abs(ar - st.ar) > 0.01) {      // другие пропорции (например, вертикальное видео)
            st.ar = ar;
            layout();
            requestAnimationFrame(fitNode);
        }
    };
    hub.__relayLive = st;

    const request = async (retry = false) => {
        if (wv(hub, "live") === false) {
            status.textContent = "живое окно выключено / live off";
            return;
        }
        if (st.inflight) { st.again = true; return; }
        const cards = gatherCards(hub);
        const vs = videoSource(hub);
        const body = {
            video_file: vs.file || null,
            video_path: wv(hub, "video_path") || "",
            job_name: wv(hub, "job_name") || "",
            pos: Number(wv(hub, "live_frame") ?? 0.5),
            view: wv(hub, "live_view") || "after",
            cards,
            max_side: 2048,
            retry,
        };
        if (!body.video_file && !body.video_path) {
            status.textContent = vs.error || "нет видео: выбери файл в Load Video / no video";
            return;
        }
        st.inflight = true;
        const mySeq = ++st.seq;
        const t0 = performance.now();
        try {
            const r = await api.fetchApi("/perception_relay/live", { method: "POST", body: JSON.stringify(body) });
            const ct = r.headers.get("content-type") || "";
            if (ct.includes("image")) {
                const blob = await r.blob();
                if (st.url) URL.revokeObjectURL(st.url);
                st.url = URL.createObjectURL(blob);
                img.src = st.url;
                const info = decodeHex(r.headers.get("X-Relay-Info"));
                status.textContent = `${info} · ${Math.round(performance.now() - t0)} мс · ${cards.length} карт.`;
            } else {
                const j = await r.json();
                if (j.state === "preparing") {
                    status.textContent = `подготовка ${j.seconds ?? 0} с (длинное/большое видео — дольше, это нормально): ${j.msg || ""}`;
                    setTimeout(() => { if (mySeq === st.seq) request(); }, 1500);
                } else if (j.state === "busy") {
                    st.again = true;
                } else if (j.state === "error") {
                    status.textContent = `ошибка / error: ${j.msg} — подробности в консоли Comfy, повтор: 🔄`;
                }
            }
        } catch (e) {
            status.textContent = `нет связи с живым окном / live unavailable: ${e}`;
        } finally {
            st.inflight = false;
            if (st.again) { st.again = false; schedule(120); }
        }
    };
    const schedule = (ms = 220) => {
        hub.__relayStopPlay?.();
        clearTimeout(st.timer);
        st.timer = setTimeout(request, ms);
    };
    hub.__relaySchedule = schedule;

    for (const w of hub.widgets || []) {
        if (!HUB_TRIGGERS.has(w.name)) continue;
        const cb = w.callback;
        w.callback = function () {
            const r = cb?.apply(this, arguments);
            schedule(w.name === "live_frame" ? 150 : 250);
            return r;
        };
    }
    hub.addWidget("button", "🔄 обновить окно / refresh live", null, () => { clearTimeout(st.timer); request(true); });

    // ▶ проиграть: секунда ролика по кругу (чтобы видеть дрожь и движение, а не стоп-кадр)
    const stopPlay = () => {
        if (st.play) { clearInterval(st.play.timer); st.play = null; }
        if (playBtn) playBtn.name = "▶ проиграть 1 с / play 1 s";
    };
    hub.__relayStopPlay = stopPlay;
    const playBtn = hub.addWidget("button", "▶ проиграть 1 с / play 1 s", null, async () => {
        if (st.play) { stopPlay(); schedule(0); return; }
        const vs = videoSource(hub);
        const body = { video_file: vs.file || null, video_path: wv(hub, "video_path") || "",
                       job_name: wv(hub, "job_name") || "", pos: Number(wv(hub, "live_frame") ?? 0.5),
                       view: wv(hub, "live_view") || "after", cards: gatherCards(hub), count: 24, max_side: 1280 };
        playBtn.name = "⏳ готовлю… / preparing…";
        app.graph.setDirtyCanvas(true, true);
        const t0 = performance.now();
        try {
            const r = await api.fetchApi("/perception_relay/live_seq", { method: "POST", body: JSON.stringify(body) });
            const j = await r.json();
            if (j.state !== "ok") { status.textContent = `проигрывание: ${j.state} ${j.msg || ""}`; stopPlay(); return; }
            const urls = j.frames.map((b64) => `data:image/jpeg;base64,${b64}`);
            let i = 0;
            st.play = { timer: setInterval(() => { img.src = urls[i]; i = (i + 1) % urls.length; },
                                           1000 / (j.fps || 24)) };
            playBtn.name = "⏹ стоп / stop";
            status.textContent = `${j.info} · по кругу · собрано за ${Math.round(performance.now() - t0)} мс`;
        } catch (e) {
            status.textContent = `проигрывание недоступно / play unavailable: ${e}`;
            stopPlay();
        }
        app.graph.setDirtyCanvas(true, true);
    });

    const widget = hub.addDOMWidget("relay_live", "div", box, {
        serialize: false, hideOnZoom: false,
        getMinHeight: () => imgH(hub.size[0]) + 26,
        getMaxHeight: () => imgH(hub.size[0]) + 26,
    });
    widget.computeSize = (width) => [width, imgH(width) + 26];
    st.widget = widget;
    const onResize = hub.onResize;
    hub.onResize = function () {
        const r = onResize?.apply(this, arguments);
        layout();
        if (!fitting) requestAnimationFrame(fitNode);   // растянул ширину — высота подстроится
        return r;
    };
    layout();
    setTimeout(fitNode, 500);
    const ocf = hub.onConfigure;
    hub.onConfigure = function () {
        const r = ocf?.apply(this, arguments);
        schedule(1200);           // схема загружена из файла — провода уже на месте
        return r;
    };
    const occ = hub.onConnectionsChange;
    hub.onConnectionsChange = function () {
        const r = occ?.apply(this, arguments);
        schedule(400);
        return r;
    };
    setTimeout(() => schedule(800), 300);
}

function hubsDownstream(node) {
    const hubs = [];
    for (const out of node.outputs || []) {
        for (const lid of out.links || []) {
            const link = app.graph.links[lid] ?? app.graph.links.get?.(lid);
            const n = link && app.graph.getNodeById(link.target_id);
            if (n && n.type === HUB) hubs.push(n);
        }
    }
    return hubs;
}

const CARD_DEFAULTS = {};

function addResetButton(node) {
    const defs = CARD_DEFAULTS[node.type];
    if (!defs || node.__relayReset) return;
    node.__relayReset = true;
    node.addWidget("button", "↺ сброс / reset", null, () => {
        for (const w of node.widgets || []) {
            if (!(w.name in defs)) continue;
            w.value = defs[w.name];
        }
        for (const hub of hubsDownstream(node)) hub.__relaySchedule?.(150);
        app.graph.setDirtyCanvas(true, true);
    });
}

function hookCard(node) {
    if (node.__relayCardHooked) return;
    node.__relayCardHooked = true;
    addResetButton(node);
    for (const w of node.widgets || []) {
        const cb = w.callback;
        w.callback = function () {
            const r = cb?.apply(this, arguments);
            for (const hub of hubsDownstream(node)) hub.__relaySchedule?.(250);
            return r;
        };
    }
}

app.registerExtension({
    name: "PerceptionRelay.Live",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === HUB) {
            const onCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onCreated?.apply(this, arguments);
                setupLive(this);
                return r;
            };
        } else if (CARD_STAGE[nodeData.name]) {
            // значения по умолчанию — из описания ноды (для кнопки сброса)
            const defs = {};
            for (const [name, spec] of Object.entries(nodeData.input?.required || {})) {
                const opts = Array.isArray(spec) ? spec[1] : null;
                if (opts && "default" in opts) defs[name] = opts.default;
                else if (Array.isArray(spec) && Array.isArray(spec[0])) defs[name] = spec[0][0];
            }
            CARD_DEFAULTS[nodeData.name] = defs;
            const onCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onCreated?.apply(this, arguments);
                hookCard(this);
                return r;
            };
        }
    },
    // после загрузки схемы: провода подключены — обновляем окна всех пультов
    async loadedGraphNode(node) {
        if (node.type === HUB) node.__relaySchedule?.(1500);
        else if (CARD_STAGE[node.type]) hookCard(node);
    },
    // смена файла в Load Video тоже обновляет окно
    async nodeCreated(node) {
        if (node.type !== "LoadVideo") return;
        for (const w of node.widgets || []) {
            const cb = w.callback;
            w.callback = function () {
                const r = cb?.apply(this, arguments);
                for (const hub of hubsDownstream(node)) hub.__relaySchedule?.(500);
                return r;
            };
        }
    },
});
