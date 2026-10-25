import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// ============================================================================
//  Общие детали для всех нод Neron: панель проектов (СОХРАНИТЬ / ОТКРЫТЬ / НОВЫЙ)
//  Проекты лежат в  output/Neron_Projects/<тип>/<название>.json
// ============================================================================

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

function injectCommonStyles() {
    if (document.getElementById("neron-common-styles")) return;
    const s = document.createElement("style");
    s.id = "neron-common-styles";
    s.textContent = `
.nc-proj{display:flex;align-items:center;gap:6px;min-width:0;height:24px;flex:none;
  font-family:"Segoe UI",Arial,sans-serif}
.nc-lbl{font-size:11px;font-weight:700;color:#b388ff;letter-spacing:.5px;flex:none}
.nc-in{flex:1;min-width:60px;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;
  border-radius:4px;font-size:11px;padding:0 6px;outline:none}
.nc-in:focus{border-color:#6b4fb3}
.nc-sel{width:150px;flex:none;height:22px;box-sizing:border-box;background:#23252b;color:#cfd2d8;border:1px solid #33363e;
  border-radius:4px;font-size:11px;outline:none;padding:0 2px}
.nc-sel option{background:#23252b;color:#cfd2d8}
.nc-btn{height:22px;padding:0 9px;border:none;border-radius:5px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;
  flex:none;line-height:22px;background:#4a4e5a;white-space:nowrap}
.nc-btn:hover{filter:brightness(1.18)}
.nc-check{display:flex;align-items:center;gap:3px;font-size:10px;font-weight:700;color:#9aa0ae;white-space:nowrap;
  cursor:pointer;flex:none}
`;
    document.head.appendChild(s);
}

// opts: { kind, getData(), setData(data), onNew(), setStatus(text, isError), extra (необязательно: элемент справа) }
function createProjectBar(opts) {
    injectCommonStyles();
    const { kind, getData, setData, onNew, setStatus, extra } = opts;

    const root = el("div", "nc-proj");
    root.appendChild(el("span", "nc-lbl", "ПРОЕКТ"));

    const nameIn = el("input", "nc-in");
    nameIn.type = "text";
    nameIn.placeholder = "название проекта";
    nameIn.title = "Название, под которым сохранится проект";
    nameIn.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") saveBtn.click();
    });
    root.appendChild(nameIn);

    const sel = el("select", "nc-sel");
    sel.title = "Ранее сохранённые проекты";
    root.appendChild(sel);

    function mk(text, color, title) {
        const b = el("button", "nc-btn", text);
        if (color) b.style.background = color;
        if (title) b.title = title;
        return b;
    }
    const saveBtn = mk("СОХРАНИТЬ", "#3b6fb6", "Сохранить проект в файл (output/Neron_Projects)");
    const openBtn = mk("ОТКРЫТЬ", "#4a4e5a", "Открыть проект, выбранный в списке");
    const newBtn = mk("НОВЫЙ", "#7a3b3b", "Начать с чистого листа (нажать дважды)");
    root.appendChild(saveBtn);
    root.appendChild(openBtn);
    root.appendChild(newBtn);
    if (extra) root.appendChild(extra);

    let names = [];

    async function refresh(selectName) {
        try {
            const res = await api.fetchApi(`/neron/project_list?kind=${encodeURIComponent(kind)}&t=${Date.now()}`);
            const d = await res.json();
            names = d.ok && Array.isArray(d.names) ? d.names : [];
        } catch (e) {
            names = [];
        }
        sel.innerHTML = "";
        const first = el("option", "", names.length ? `- сохранённые (${names.length}) -` : "- пока пусто -");
        first.value = "";
        sel.appendChild(first);
        for (const n of names) {
            const o = el("option", "", n);
            o.value = n;
            sel.appendChild(o);
        }
        if (selectName && names.includes(selectName)) sel.value = selectName;
    }

    sel.addEventListener("change", () => {
        if (sel.value) nameIn.value = sel.value;
    });

    saveBtn.addEventListener("click", async () => {
        const name = nameIn.value.trim() || sel.value;
        if (!name) {
            setStatus("Введите название проекта и нажмите СОХРАНИТЬ", true);
            nameIn.focus();
            return;
        }
        try {
            const res = await api.fetchApi("/neron/project_save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, name, data: getData() }),
            });
            const d = await res.json();
            if (!d.ok) {
                setStatus("Не удалось сохранить проект: " + d.error, true);
                return;
            }
            nameIn.value = d.name;
            await refresh(d.name);
            setStatus(`Проект «${d.name}» сохранён: ${d.path}`, false);
        } catch (e) {
            setStatus("Ошибка сохранения проекта: " + e, true);
        }
    });

    openBtn.addEventListener("click", async () => {
        const name = sel.value || nameIn.value.trim();
        if (!name) {
            setStatus("Выберите проект в списке и нажмите ОТКРЫТЬ", true);
            return;
        }
        try {
            const res = await api.fetchApi(`/neron/project_load?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}&t=${Date.now()}`);
            const d = await res.json();
            if (!d.ok) {
                setStatus("Не удалось открыть проект: " + d.error, true);
                return;
            }
            setData(d.data || {});
            nameIn.value = d.name;
            setStatus(`Проект «${d.name}» открыт`, false);
        } catch (e) {
            setStatus("Ошибка открытия проекта: " + e, true);
        }
    });

    let armed = null;
    newBtn.addEventListener("click", () => {
        if (!armed) {
            newBtn.textContent = "ТОЧНО?";
            armed = setTimeout(() => { armed = null; newBtn.textContent = "НОВЫЙ"; }, 2000);
            return;
        }
        clearTimeout(armed);
        armed = null;
        newBtn.textContent = "НОВЫЙ";
        nameIn.value = "";
        sel.value = "";
        onNew();
        setStatus("Новый пустой проект", false);
    });

    refresh();
    return { root, refresh, nameInput: nameIn };
}


// ============================================================================
//  Размер ноды задаёт пользователь (как в Пульте Perception Relay)
//  RU: Пока ноду не трогали, она подстраивает высоту под содержимое (autoH).
//      Как только её растянули мышью, размер запоминается в схеме и нода больше
//      сама его не меняет: содержимое подстраивается, лишнее прокручивается.
//      Правый клик по ноде → «Авто-размер» возвращает подгонку.
//  EN: Until touched, the node fits its content (autoH). Once resized by mouse,
//      the size is saved in the workflow and the node never changes it again:
//      the content adapts and scrolls. Right click → "Auto size" undoes it.
// ============================================================================
function makeUserSized(node, domWidget, root, opts) {
    const minH = opts.minH || 120;
    const autoH = opts.autoH;
    const margin = opts.margin ?? 14;
    node.properties = node.properties || {};
    const manual = () => node.properties.neron_manual_size === true;
    const curH = () => {
        if (!manual()) return autoH();
        const h = Number(node.properties.neron_panel_h);
        return h > 0 ? Math.max(minH, h) : autoH();
    };
    const o = domWidget.options || (domWidget.options = {});
    o.getMinHeight = () => (manual() ? minH : curH());
    o.getHeight = () => curH();
    o.getMaxHeight = () => curH();
    // пока ноду тянут мышью — просим минимум, чтобы её можно было и уменьшить
    domWidget.computeSize = (width) => [width, manual() && app.canvas?.resizing_node === node ? minH : curH()];
    let fitting = false;
    const apply = () => {
        root.style.height = curH() + "px";
        if (opts.onLayout) { try { opts.onLayout(curH()); } catch (e) { /* ок */ } }
    };
    // высота ноды под содержимое — только пока размер не трогали руками
    let tries = 0;
    const fit = () => {
        apply();
        const top = domWidget.last_y;
        // нода ещё не нарисована: позиция панели неизвестна — попробовать чуть позже
        if (top == null && tries++ < 30) { setTimeout(fit, 100); return; }
        if (fitting || top == null || !node.size) return;
        tries = 0;
        const need = Math.round(top + curH() + margin);
        if (manual() ? node.size[1] < need : Math.abs(node.size[1] - need) > 2) {
            fitting = true;
            node.setSize([node.size[0], need]);
            fitting = false;
        }
        if (typeof node.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
    };
    const onResize0 = node.onResize;
    node.onResize = function () {
        const r = onResize0 ? onResize0.apply(this, arguments) : undefined;
        if (!fitting && app.canvas?.resizing_node === node) {
            node.properties.neron_manual_size = true;
            const top = domWidget.last_y;
            if (top != null) node.properties.neron_panel_h = Math.max(minH, Math.round(node.size[1] - top - margin));
            requestAnimationFrame(apply);
        } else if (!fitting && !manual()) {
            requestAnimationFrame(fit);      // ширина поменялась — высота под содержимое
        } else {
            requestAnimationFrame(apply);
        }
        return r;
    };
    const menu0 = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        const r = menu0 ? menu0.apply(this, arguments) : undefined;
        if (manual() && Array.isArray(options)) {
            options.push(null, {
                content: "↕ Авто-размер / Auto size",
                callback: () => { node.properties.neron_manual_size = false; fit(); },
            });
        }
        return r;
    };
    root.style.overflow = "auto";
    apply();
    setTimeout(fit, 60);
    return { curH, manual, fit, apply };
}

// ============================================================================
//  Индикаторы уровня (прыгающие столбики) — общие для Пульта и Сэмплера
// ----------------------------------------------------------------------------

const meterBuf = new Float32Array(512);
function peakOf(an) {
    if (!an) return 0;
    an.getFloatTimeDomainData(meterBuf);
    let p = 0;
    for (let i = 0; i < meterBuf.length; i++) { const v = Math.abs(meterBuf[i]); if (v > p) p = v; }
    return p;
}
// 0..1 по шкале -48..0 дБ
const toLevel = (p) => (p > 0.00001 ? Math.max(0, Math.min(1, (20 * Math.log10(p) + 48) / 48)) : 0);
// сглаживание: подскакивает сразу, опускается плавно; пиковая метка держится 1 с
function meterStep(m, peak, now) {
    const v = toLevel(peak);
    m.v = Math.max(v, (m.v || 0) - 0.025);
    if (v >= (m.hold || 0) || now - (m.holdT || 0) > 1000) { m.hold = v; m.holdT = now; }
    return m;
}
const ledColor = (f) => (f > 0.9 ? "#e5484d" : f > 0.72 ? "#e0b030" : "#3fbf5a");
// vertical=true: два столбика снизу вверх (L, R); иначе две полосы слева направо
function drawMeter(cv, mL, mR, vertical) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 14, h = cv.clientHeight || 36;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const bars = [mL, mR];
    const seg = 3, gap = 1;
    for (let b = 0; b < 2; b++) {
        const m = bars[b] || {};
        if (vertical) {
            const bw = (w - 3) / 2, x = 1 + b * (bw + 1);
            const n = Math.floor((h - 2) / (seg + gap));
            const on = Math.round((m.v || 0) * n);
            for (let i = 0; i < n; i++) {
                const f = (i + 1) / n;
                g.fillStyle = i < on ? ledColor(f) : "#23262e";
                g.fillRect(x, h - 1 - (i + 1) * (seg + gap) + gap, bw, seg);
            }
            if (m.hold > 0.02) { const i = Math.min(n - 1, Math.round(m.hold * n) - 1); g.fillStyle = ledColor((i + 1) / n); g.fillRect(x, h - 1 - (i + 1) * (seg + gap) + gap, bw, seg); }
        } else {
            const bh = (h - 3) / 2, y = 1 + b * (bh + 1);
            const n = Math.floor((w - 2) / (seg + gap));
            const on = Math.round((m.v || 0) * n);
            for (let i = 0; i < n; i++) {
                const f = (i + 1) / n;
                g.fillStyle = i < on ? ledColor(f) : "#23262e";
                g.fillRect(1 + i * (seg + gap), y, seg, bh);
            }
            if (m.hold > 0.02) { const i = Math.min(n - 1, Math.round(m.hold * n) - 1); g.fillStyle = ledColor((i + 1) / n); g.fillRect(1 + i * (seg + gap), y, seg, bh); }
        }
    }
}

// отвод на индикатор: слушает узел, звук не меняет
function meterTap(ctx, nodeOut) {
    const tap = ctx.createChannelSplitter(2);
    const aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
    aL.fftSize = 512; aR.fftSize = 512;
    nodeOut.connect(tap);
    tap.connect(aL, 0);
    tap.connect(aR, 1);
    return { aL, aR };
}

// ============================================================================
//  Эхо и ручки — общие для Пульта и Студии
// ----------------------------------------------------------------------------
const T = (ru, en) => `${ru} / ${en}`;

// ---------- эхо: отклик помещения (тот же шум, что в fx.py) ----------
const ROOMS = { room: [0.9, 0.008], hall: [2.2, 0.02], cathedral: [4.5, 0.035] };
const ROOM_ORDER = ["room", "hall", "cathedral"];
const ROOM_NAME = { room: ["КОМН", "ROOM"], hall: ["ЗАЛ", "HALL"], cathedral: ["СОБОР", "CHURCH"] };
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function roomImpulse(ctx, room) {
    window.__neronIR = window.__neronIR || {};
    const key = room + "@" + ctx.sampleRate;
    if (window.__neronIR[key]) return window.__neronIR[key];
    const [dur, preS] = ROOMS[room] || ROOMS.hall;
    const sr = ctx.sampleRate, n = Math.floor(dur * sr), pre = Math.floor(preS * sr);
    const buf = ctx.createBuffer(2, pre + n, sr);
    [1234, 5678].forEach((seed, ch) => {
        const rnd = mulberry32(seed + room.length);
        const d = buf.getChannelData(ch);
        let e2 = 0;
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-6.9 * t / dur) * Math.min(1, t / 0.004 + 0.05);
            const v = (rnd() * 2 - 1) * env;
            d[pre + i] = v; e2 += v * v;
        }
        const k = 1 / (Math.sqrt(e2) + 1e-9);
        for (let i = 0; i < d.length; i++) d[i] *= k;
    });
    window.__neronIR[key] = buf;
    return buf;
}

// ---------- ручка (крутилка) ----------
function makeKnob(o) {
    const box = el("div", "nm-knob");
    const cv = el("canvas");
    cv.width = 52; cv.height = 52;
    const lab = el("span", "", o.label);
    box.appendChild(cv); box.appendChild(lab);
    let v = o.value;
    const span = o.max - o.min;
    const draw = () => {
        const g = cv.getContext("2d");
        g.clearRect(0, 0, 52, 52);
        const cx = 26, cy = 26, r = 19;
        const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
        const frac = (v - o.min) / span;
        const av = a0 + (a1 - a0) * frac;
        const az = o.bipolar ? a0 + (a1 - a0) * ((0 - o.min) / span) : a0;
        g.lineCap = "round";
        g.lineWidth = 5; g.strokeStyle = "#363a44";
        g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
        const active = Math.abs(v - o.def) > 1e-3;
        if (active) {
            g.strokeStyle = o.color;
            g.beginPath(); g.arc(cx, cy, r, Math.min(az, av), Math.max(az, av)); g.stroke();
        }
        g.fillStyle = active ? "#2b2f3a" : "#22252d";
        g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
        g.strokeStyle = active ? "#fff" : "#8b90a0"; g.lineWidth = 3.5;
        g.beginPath(); g.moveTo(cx + Math.cos(av) * 4, cy + Math.sin(av) * 4); g.lineTo(cx + Math.cos(av) * 12, cy + Math.sin(av) * 12); g.stroke();
        box.title = o.title + "\n" + o.fmt(v) + "\n" + T("тянуть вверх/вниз или колесо · двойной клик — сброс", "drag up/down or wheel · double-click — reset");
        lab.style.color = active ? o.color : "";
    };
    const setV = (nv, fire) => {
        nv = Math.max(o.min, Math.min(o.max, nv));
        if (o.step) nv = Math.round(nv / o.step) * o.step;
        if (Math.abs(nv - o.def) < (o.step || 0.01) * 0.5) nv = o.def;   // притягивается к середине
        if (nv === v) return;
        v = nv; draw();
        if (fire) o.onChange(v);
    };
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        cv.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, v };
    });
    cv.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const k = e.shiftKey ? 600 : 150;
        setV(drag.v + (drag.y - e.clientY) * span / k, true);
    });
    const end = () => { if (drag) { drag = null; if (o.onEnd) o.onEnd(v); } };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("dblclick", (e) => { e.stopPropagation(); setV(o.def, true); if (o.onEnd) o.onEnd(v); });
    cv.addEventListener("wheel", (e) => {
        e.preventDefault(); e.stopPropagation();
        setV(v + (e.deltaY < 0 ? 1 : -1) * (o.wheel || span / 24), true);
        if (o.onEnd) o.onEnd(v);
    }, { passive: false });
    draw();
    box.setValue = (nv) => { v = nv; draw(); };
    return box;
}

export { el, createProjectBar, makeUserSized, peakOf, meterStep, drawMeter, meterTap, ROOMS, ROOM_ORDER, ROOM_NAME, roomImpulse, makeKnob };

