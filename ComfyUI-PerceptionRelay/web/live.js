// Живое окно Пульта / Live window of the Pult.
// Крутишь ползунок любой подключённой карточки — Пульт просит у сервера один кадр и показывает его.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const HUB = "PerceptionRelayHub";
const CARD_STAGE = {
    PerceptionRelayCardScout: "scout",
    PerceptionRelayCardFlow: "flow",
    PerceptionRelayCardJudge: "judge",
    PerceptionRelayCardRefine: "refine",
    PerceptionRelayCardStabilize: "stabilize",
    PerceptionRelayCardPicture: "picture",
    PerceptionRelayCardMotion: "motion",
    PerceptionRelayCardEdge: "edge",
    PerceptionRelayCardTone: "tone",
    PerceptionRelayCardSeam: "seam",
    PerceptionRelayCardPolish: "polish",
    PerceptionRelayCardBasic: "basic",
    PerceptionRelayCardPoints: "points",
};
const SKIP_WIDGETS = new Set(["control_after_generate", "control_before_generate"]);
const HUB_TRIGGERS = new Set(["live", "live_frame", "live_view", "job_name", "video_path", "refine",
                              "refine_sensitivity", "refine_protect_edges"]);
// Доводчик, встроенный в Пульт: имена ползунков Пульта → параметры этапа
const PULT_REFINE = { refine_size: "size", refine_strength: "refine_strength", refine_model: "gen_model",
    refine_sensitivity: "sensitivity", refine_upscale_detail: "upscale_detail", refine_stick: "stick",
    refine_protect_edges: "protect_edges", refine_face_detail: "face_detail", refine_window: "window" };

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
    if (wv(hub, "refine") === true) {
        const params = {};
        for (const [k, v] of Object.entries(PULT_REFINE)) { const x = wv(hub, k); if (x !== undefined) params[v] = x; }
        cards.push({ stage: "refine", params });
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

// Обёртка, в которую Comfy кладёт окно, бывает выше самого окна (высота от прошлого размера ноды) —
// и тогда невидимый хвост под картинкой ловит мышь: клик по холсту выделяет кадр синим, лупа
// вылезает под нодой. Обёртке запрещаем ловить мышь; ловит только сама картинка.
function relayStyle() {
    if (document.getElementById("relay-live-style")) return;
    const css = document.createElement("style");
    css.id = "relay-live-style";
    css.textContent = ":has(> .relay-live-box){pointer-events:none !important;}" +
        ".relay-live-box{pointer-events:none !important;}" +
        ".relay-live-box img{pointer-events:auto !important;}" +
        ".relay-live-box img.relay-before{pointer-events:none !important;}" +
        ".relay-live-box .relay-lens-btn{pointer-events:auto !important;}";
    document.head.append(css);
}

// ---------- часы Пульта: время прогона, текущий этап, «осталось» ----------
function fmtTime(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    const p = (x) => String(x).padStart(2, "0");
    return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

function setupClock(hub) {
    if (hub.__relayClock) return;
    const c = { start: null, end: null, running: false, result: "", stage: "", i: 0, total: 0, stageT0: 0,
                current: null, timer: null };
    hub.__relayClock = c;
    const redraw = () => app.graph?.setDirtyCanvas(true, false);
    const finish = (result) => {
        if (!c.running) return;
        c.running = false; c.end = Date.now(); c.result = result;
        clearInterval(c.timer); c.timer = null;
        redraw();
    };
    const L = {
        execution_start: () => {
            c.start = Date.now(); c.end = null; c.running = true; c.result = "";
            c.stage = ""; c.i = 0; c.total = 0; c.current = null;
            clearInterval(c.timer);
            c.timer = setInterval(redraw, 500);
            redraw();
        },
        executing: (e) => {
            const d = e.detail;
            const id = (d && typeof d === "object") ? (d.display_node ?? d.node) : d;
            c.current = id;
            if (id == null) finish("ok");
        },
        execution_success: () => finish("ok"),
        execution_error: () => finish("error"),
        execution_interrupted: () => finish("stop"),
        "perception_relay.progress": (e) => {
            const d = e.detail || {};
            if (d.stage !== c.stage) { c.stage = d.stage; c.stageT0 = Date.now(); }
            c.i = d.i || 0; c.total = d.total || 0;
        },
    };
    for (const [k, f] of Object.entries(L)) api.addEventListener(k, f);
    const onRemoved = hub.onRemoved;
    hub.onRemoved = function () {
        clearInterval(c.timer);
        for (const [k, f] of Object.entries(L)) api.removeEventListener(k, f);
        return onRemoved?.apply(this, arguments);
    };

    const odf = hub.onDrawForeground;
    hub.onDrawForeground = function (ctx) {
        const r = odf?.apply(this, arguments);
        if (this.flags?.collapsed) return r;
        const cx = this.size[0] / 2;
        const maxW = Math.max(120, this.size[0] - 300);     // между подписями входов и выходов
        const fit = (txt) => {
            if (ctx.measureText(txt).width <= maxW) return txt;
            while (txt.length > 4 && ctx.measureText(txt + "…").width > maxW) txt = txt.slice(0, -1);
            return txt + "…";
        };
        ctx.save();
        ctx.textAlign = "center";
        const now = Date.now();
        let big, line2 = "", line3 = "", color = "#cfd8dc";
        if (c.running) {
            big = "⏱ " + fmtTime(now - c.start);
            color = "#ffffff";
            if (String(c.current) === String(this.id) && c.stage) {
                line2 = c.total > 1 ? `${c.stage} · ${c.i}/${c.total}` : c.stage;
                if (c.i > 0 && c.total > c.i) {
                    const left = (now - c.stageT0) / c.i * (c.total - c.i);
                    line3 = `≈ ещё ${fmtTime(left)} на этап / left for this stage`;
                }
            } else if (c.current != null) {
                const n = app.graph?.getNodeById?.(c.current);
                line2 = `работает / running: ${n?.title || n?.type || c.current}`;
            }
        } else if (c.start) {
            big = "⏱ " + fmtTime(c.end - c.start);
            color = c.result === "ok" ? "#9be7a0" : c.result === "error" ? "#ff8a80" : "#ffd180";
            line2 = c.result === "ok" ? "весь прогон / total run" :
                    c.result === "error" ? "ошибка — время до неё / failed after" : "остановлено / stopped after";
        } else {
            big = "⏱ --:--";
            color = "#78909c";
            line2 = "время генерации / run time";
        }
        ctx.fillStyle = color;
        ctx.font = "bold 30px monospace";
        ctx.fillText(big, cx, 56);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#b0bec5";
        if (line2) ctx.fillText(fit(line2), cx, 80);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#90a4ae";
        if (line3) ctx.fillText(fit(line3), cx, 99);
        ctx.restore();
        return r;
    };
}

function setupLive(hub) {
    if (hub.__relayLive) return;
    relayStyle();
    const box = document.createElement("div");
    box.className = "relay-live-box";
    box.style.cssText = "width:100%;display:flex;flex-direction:column;gap:4px;overflow:hidden;" +
        "pointer-events:none;user-select:none;-webkit-user-select:none;";
    const status = document.createElement("div");
    status.style.cssText = "font:11px monospace;color:#cfd8dc;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    status.textContent = "живое окно: подключи видео и карточки / live: connect video and cards";
    const img = document.createElement("img");
    img.style.cssText = "width:100%;object-fit:contain;background:#111;border-radius:4px;min-height:60px;display:block;" +
        "pointer-events:auto;user-select:none;-webkit-user-select:none;";
    img.draggable = true;   // перетащить кадр на холст → нода «Загрузить изображение»
    const stage = document.createElement("div");
    stage.style.cssText = "position:relative;width:100%;";
    const lens = document.createElement("div");
    lens.style.cssText = "position:absolute;width:180px;height:180px;border-radius:50%;border:2px solid rgba(255,255,255,.85);" +
        "box-shadow:0 4px 18px rgba(0,0,0,.6);background-repeat:no-repeat;pointer-events:none;display:none;";
    // шторка: кадр «до» лежит поверх кадра «после» и обрезан по линии — двигается без запросов к серверу
    const imgB = document.createElement("img");
    imgB.className = "relay-before";
    imgB.draggable = false;
    imgB.style.cssText = "position:absolute;left:0;top:0;width:100%;object-fit:contain;border-radius:4px;display:none;";
    const divider = document.createElement("div");
    divider.style.cssText = "position:absolute;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,.7);" +
        "pointer-events:none;display:none;";
    const knob = document.createElement("div");
    knob.style.cssText = "position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
        "background:#fff;color:#222;font:bold 12px sans-serif;display:flex;align-items:center;justify-content:center;" +
        "box-shadow:0 1px 5px rgba(0,0,0,.6);";
    knob.textContent = "⇔";
    divider.append(knob);
    // кнопка лупы: по умолчанию выключена, состояние запоминается в этом браузере
    const lensBtn = document.createElement("div");
    lensBtn.className = "relay-lens-btn";
    lensBtn.title = "лупа вкл/выкл / magnifier on/off (колесо — увеличение / wheel — zoom)";
    lensBtn.style.cssText = "position:absolute;right:6px;top:6px;padding:2px 7px;border-radius:12px;cursor:pointer;" +
        "font:12px sans-serif;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.5);";
    stage.append(img, imgB, divider, lens, lensBtn);
    box.append(status, stage);

    // лупа: навёл — увеличил (колесо — сила увеличения). Показывает кадр в его настоящем разрешении.
    let zoom = 0;
    let lensOn = false;
    try { lensOn = localStorage.getItem("relay_lens") === "1"; } catch (_) {}
    let splitPos = 0.5;          // где стоит шторка (0..1 по ширине кадра)
    let dragging = false;
    const isSplit = () => String(wv(hub, "live_view") || "").startsWith("split") && !hub.__relayLive?.play;
    const paintLensBtn = () => {
        lensBtn.textContent = lensOn ? "🔍 лупа: вкл" : "🔍 лупа: выкл";
        lensBtn.style.background = lensOn ? "rgba(40,120,220,.85)" : "rgba(0,0,0,.55)";
    };
    lensBtn.addEventListener("mousedown", (e) => e.stopPropagation());
    lensBtn.addEventListener("click", (e) => {
        e.stopPropagation(); e.preventDefault();
        lensOn = !lensOn;
        try { localStorage.setItem("relay_lens", lensOn ? "1" : "0"); } catch (_) {}
        if (!lensOn) lens.style.display = "none";
        paintLensBtn();
    });
    // Где на самом деле лежит картинка внутри окна (в «своих» пикселях ноды, без масштаба холста).
    // 1) Холст Comfy масштабируется (колесо мыши): экранные пиксели ≠ пиксели ноды — делим на масштаб.
    // 2) object-fit: contain — у кадра могут быть поля сверху/снизу или по бокам, их вычитаем.
    const geometry = (e) => {
        const r = img.getBoundingClientRect();
        const cw = img.offsetWidth, ch = img.offsetHeight;
        if (!cw || !ch || !r.width || !r.height) return null;
        const sx = r.width / cw, sy = r.height / ch;               // масштаб холста
        const x = (e.clientX - r.left) / sx, y = (e.clientY - r.top) / sy;
        const nw = img.naturalWidth, nh = img.naturalHeight;
        const k = Math.min(cw / nw, ch / nh);
        const dw = nw * k, dh = nh * k;                             // видимый кадр без полей
        const ox = (cw - dw) / 2, oy = (ch - dh) / 2;
        return { x, y, dw, dh, ox, oy, nw };
    };
    // положение шторки и обрезка кадра «до» под текущий размер окна
    const paintSplit = () => {
        const on = isSplit() && imgB.src && imgB.naturalWidth;
        imgB.style.display = on ? "block" : "none";
        divider.style.display = on ? "block" : "none";
        img.draggable = !isSplit();          // в режиме шторки тянем линию, а не кадр
        if (!on) return;
        imgB.style.height = img.style.height;
        const cw = img.offsetWidth, ch = img.offsetHeight;
        const nw = img.naturalWidth || imgB.naturalWidth, nh = img.naturalHeight || imgB.naturalHeight;
        const k = Math.min(cw / nw, ch / nh), dw = nw * k, dh = nh * k;
        const ox = (cw - dw) / 2, oy = (ch - dh) / 2;
        const xl = ox + splitPos * dw;
        imgB.style.clipPath = `inset(0 ${Math.max(0, cw - xl)}px 0 0)`;
        divider.style.left = `${xl}px`;
        divider.style.top = `${oy}px`;
        divider.style.height = `${dh}px`;
    };
    const moveSplit = (e) => {
        const g = geometry(e);
        if (!g) return;
        splitPos = Math.min(1, Math.max(0, (g.x - g.ox) / g.dw));
        paintSplit();
    };
    img.addEventListener("mousedown", (e) => {
        if (!isSplit() || e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        dragging = true;
        lens.style.display = "none";
        moveSplit(e);
        const mv = (ev) => { if (dragging) moveSplit(ev); };
        const up = () => { dragging = false; window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
        window.addEventListener("mousemove", mv);
        window.addEventListener("mouseup", up);
    });
    const showLens = (e) => {
        if (!lensOn || dragging) { lens.style.display = "none"; return; }
        if (!img.src || !img.naturalWidth) return;
        const g = geometry(e);
        if (!g) return;
        const u = g.x - g.ox, v = g.y - g.oy;                       // точка внутри самого кадра
        if (u < 0 || v < 0 || u > g.dw || v > g.dh) { lens.style.display = "none"; return; }
        // в шторке лупа показывает ту сторону, над которой мышь: слева «до», справа «после»
        const src = (isSplit() && imgB.src && u < splitPos * g.dw) ? imgB.src : img.src;
        const native = g.nw / g.dw;
        const z = zoom || Math.max(2.5, native);
        const R = 90;
        lens.style.display = "block";
        lens.style.left = `${g.x - R}px`;
        lens.style.top = `${g.y - R}px`;
        if (lens.__src !== src) { lens.style.backgroundImage = `url(${src})`; lens.__src = src; }
        lens.style.backgroundSize = `${g.dw * z}px ${g.dh * z}px`;
        lens.style.backgroundPosition = `${-(u * z - R)}px ${-(v * z - R)}px`;
    };
    // мышь ловит только сама картинка: пустое место под окном остаётся холсту Comfy
    img.addEventListener("mousemove", showLens);
    img.addEventListener("mouseleave", () => { lens.style.display = "none"; });
    img.addEventListener("wheel", (e) => {
        if (!lensOn || lens.style.display !== "block") return;
        e.preventDefault(); e.stopPropagation();
        const g = geometry(e);
        if (!g) return;
        const base = zoom || Math.max(2.5, g.nw / g.dw);
        zoom = Math.min(10, Math.max(1.5, base * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        showLens(e);
    }, { passive: false });
    img.addEventListener("dragstart", () => { lens.style.display = "none"; });
    const st = { timer: null, seq: 0, url: null, inflight: false, again: false, ar: 9 / 16 };
    // высота окна: от ширины ноды и пропорций кадра; меняется только при смене пропорций или ширины
    // высота окна: от ширины ноды и пропорций кадра, но не выше MAX_H — вертикальное видео
    // вписывается целиком (с полями по бокам), а не растягивает ноду на весь экран
    const MAX_H = 640;
    const imgH = (width) => Math.min(MAX_H, Math.max(120, Math.round((width - 20) * st.ar)));
    const layout = () => { img.style.height = `${imgH(hub.size[0])}px`; paintSplit(); };
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
    imgB.onload = () => paintSplit();
    img.onload = () => {
        paintSplit();
        const ar = img.naturalHeight / Math.max(1, img.naturalWidth);
        if (Math.abs(ar - st.ar) > 0.01) {      // другие пропорции (например, вертикальное видео)
            st.ar = ar;
            layout();
            requestAnimationFrame(fitNode);
        }
    };
    hub.__relayLive = st;
    paintLensBtn();
    setupClock(hub);

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
            view: isSplit() ? "after" : (wv(hub, "live_view") || "after"),
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
                // кадр «до» не зависит от ползунков карточек — берём заново только при смене момента/ролика
                const bKey = `${body.video_file}|${body.video_path}|${body.job_name}|${body.pos}`;
                if (isSplit() && st.beforeKey !== bKey) {
                    const rb = await api.fetchApi("/perception_relay/live",
                        { method: "POST", body: JSON.stringify({ ...body, view: "before", retry: false }) });
                    if ((rb.headers.get("content-type") || "").includes("image")) {
                        if (st.urlB) URL.revokeObjectURL(st.urlB);
                        st.urlB = URL.createObjectURL(await rb.blob());
                        imgB.src = st.urlB;
                        st.beforeKey = bKey;
                    } else {
                        st.again = true;   // сервер занят — повторим
                    }
                }
                paintSplit();
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
        paintSplit();
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
            paintSplit();          // при проигрывании шторку рисует сервер (посередине)
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
            if (!(w.name in defs) || w.name === "expert") continue;
            w.value = defs[w.name];
        }
        for (const hub of hubsDownstream(node)) hub.__relaySchedule?.(150);
        app.graph.setDirtyCanvas(true, true);
    });
}

// ---------- режим эксперта: главные ползунки видны всегда, тонкие — по переключателю ----------
const CARD_SPECS = {};

function applyExpert(node) {
    const specs = CARD_SPECS[node.type];
    if (!specs) return;
    const ex = wv(node, "expert") === true;
    let prevHidden = false;
    for (const w of node.widgets || []) {
        if (w.type === "button" || w.name === "expert") { prevHidden = false; continue; }
        let hide;
        if (w.name === "control_after_generate" || w.name === "control_before_generate") hide = prevHidden;
        else {
            const opts = specs[w.name];
            if (!opts) { prevHidden = false; continue; }      // не наш ползунок — не трогаем
            hide = !ex && !opts.relay_main;
            if (opts.relay_requires && wv(node, opts.relay_requires) !== true) hide = true;   // напр. Доводчик выключен
        }
        if (w.hidden !== hide) w.hidden = hide;
        prevHidden = hide;
    }
    try {
        const sz = node.computeSize();
        node.setSize([Math.max(node.size[0], sz[0]), sz[1]]);
    } catch (_) {}
    if (node.__relayLive?.fitNode) requestAnimationFrame(() => node.__relayLive.fitNode());   // Пульт: окно под новый размер
    app.graph?.setDirtyCanvas(true, true);
}

function hookExpert(node) {
    if (!CARD_SPECS[node.type] || node.__relayExpert) return;
    node.__relayExpert = true;
    const specs = CARD_SPECS[node.type];
    const watch = new Set(["expert"]);
    for (const o of Object.values(specs)) if (o.relay_requires) watch.add(o.relay_requires);
    for (const w of node.widgets || []) {
        if (!watch.has(w.name)) continue;
        const cb = w.callback;
        w.callback = function () {
            const r = cb?.apply(this, arguments);
            applyExpert(node);
            return r;
        };
    }
    const oc = node.onConfigure;
    node.onConfigure = function () {
        const r = oc?.apply(this, arguments);
        requestAnimationFrame(() => applyExpert(node));   // значения из файла уже на месте
        return r;
    };
    requestAnimationFrame(() => applyExpert(node));
}

function hookCard(node) {
    if (node.__relayCardHooked) return;
    node.__relayCardHooked = true;
    addResetButton(node);
    hookExpert(node);
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
            const hs = {};
            for (const grp of ["required", "optional"])
                for (const [name, spec] of Object.entries(nodeData.input?.[grp] || {}))
                    hs[name] = (Array.isArray(spec) && spec[1] && typeof spec[1] === "object") ? spec[1] : {};
            CARD_SPECS[HUB] = hs;
            nodeType.prototype.onNodeCreated = function () {
                const r = onCreated?.apply(this, arguments);
                setupLive(this);
                hookExpert(this);
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
            const specs = {};
            let expertCapable = false;
            for (const [name, spec] of Object.entries(nodeData.input?.required || {})) {
                const opts = (Array.isArray(spec) && spec[1] && typeof spec[1] === "object") ? spec[1] : {};
                specs[name] = opts;
                if (opts.relay_main) expertCapable = true;
            }
            if (expertCapable) CARD_SPECS[nodeData.name] = specs;
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
