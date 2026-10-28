import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import * as THREE from "./lib/three.module.min.js";
import { OrbitControls } from "./lib/OrbitControls.js";
import * as SC from "./stage_core.js";

// ============================================================================
//  🎬 Neron Stage — Площадка режиссёра / Director's Stage
//
//  RU: Объёмная сцена из фото, по ней ходит скелет-дублёр от точки к точке.
//      В каждой точке — поза и подсказка словами. Камера ставится мышкой.
//      На выходе ноды: видео скелета позы глазами камеры + раскадровка текстом.
//  EN: 3D scene from a photo, a stand-in skeleton walks from point to point.
//      Each point has a pose and a text hint. The camera is placed by mouse.
//      Node outputs: a pose skeleton video from the camera + a text storyboard.
// ============================================================================

const T = (ru, en) => `${ru} / ${en}`;
const ACC = "#b388ff";
const ASPECTS = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:3": [4, 3], "3:4": [3, 4] };
const SHOT_DIST = { wide: 7, medium: 4, close: 2.2 };

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

// ---------------------------------------------------------------- стили
function injectStyles() {
    if (document.getElementById("nsg-styles")) return;
    const s = document.createElement("style");
    s.id = "nsg-styles";
    s.textContent = `
.nsg-root{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:5px;font-family:"Segoe UI",Arial,sans-serif;
  color:var(--nt-text,#cfd2d8);user-select:none;overflow:hidden}
.nsg-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;flex:none}
.nsg-title{font-size:12px;font-weight:800;color:${ACC};letter-spacing:.6px;margin-right:6px;white-space:nowrap}
.nsg-btn{height:24px;padding:0 9px;border:none;border-radius:5px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;
  background:var(--nt-btn,#4a4e5a);white-space:nowrap;flex:none}
.nsg-btn:hover{filter:brightness(1.18)}
.nsg-btn.on{background:#6b4fb3;box-shadow:0 0 0 1px ${ACC} inset}
.nsg-btn.go{background:#2f7d4f}
.nsg-btn.warn{background:#7a3b3b}
.nsg-sp{flex:1}
.nsg-body{display:flex;gap:6px;flex:1;min-height:0}
.nsg-view{position:relative;flex:1;min-width:200px;background:#0f1014;border-radius:6px;overflow:hidden;border:1px solid var(--nt-line,#33363e)}
.nsg-view canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
.nsg-hint{position:absolute;left:8px;bottom:6px;right:8px;font-size:10px;color:#c9c2e8;text-shadow:0 1px 3px #000;pointer-events:none}
.nsg-tag{position:absolute;left:8px;top:6px;font-size:10px;font-weight:700;color:#fff;background:rgba(107,79,179,.75);padding:2px 7px;border-radius:4px;pointer-events:none}
.nsg-side{width:250px;flex:none;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:6px;padding-right:2px}
.nsg-sec{background:var(--nt-card,#1c1e24);border:1px solid var(--nt-line,#33363e);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:5px}
.nsg-h{font-size:10px;font-weight:800;color:${ACC};letter-spacing:.5px}
.nsg-row{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.nsg-lbl{font-size:10px;color:var(--nt-muted,#8b90a0)}
.nsg-small{font-size:10px;color:var(--nt-muted,#8b90a0);line-height:1.3}
.nsg-seg{display:flex;border-radius:5px;overflow:hidden;border:1px solid var(--nt-line,#33363e)}
.nsg-seg button{border:none;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);font-size:10px;font-weight:700;padding:3px 7px;cursor:pointer}
.nsg-seg button.on{background:#6b4fb3;color:#fff}
.nsg-in,.nsg-sel,.nsg-ta{box-sizing:border-box;background:var(--nt-input,#23252b);color:var(--nt-text,#cfd2d8);border:1px solid var(--nt-line,#33363e);
  border-radius:4px;font-size:11px;outline:none;font-family:inherit}
.nsg-in{height:22px;padding:0 5px;width:58px}
.nsg-sel{height:22px;flex:1;min-width:0}
.nsg-sel option{background:var(--nt-input,#23252b)}
.nsg-ta{width:100%;min-height:38px;resize:vertical;padding:4px 5px;user-select:text}
.nsg-in:focus,.nsg-sel:focus,.nsg-ta:focus{border-color:#6b4fb3}
.nsg-range{flex:1;accent-color:${ACC}}
.nsg-card{border:1px solid var(--nt-line,#33363e);border-radius:6px;padding:5px;display:flex;flex-direction:column;gap:4px;cursor:pointer;background:var(--nt-input,#23252b)}
.nsg-card.sel{border-color:${ACC};box-shadow:0 0 0 1px ${ACC} inset}
.nsg-num{width:18px;height:18px;border-radius:50%;background:#6b4fb3;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.nsg-x{border:none;background:transparent;color:#a66;font-size:13px;cursor:pointer;padding:0 3px}
.nsg-tl{flex:none;height:30px;width:100%;display:block;border-radius:5px;cursor:pointer;background:var(--nt-deep,#15171c)}
.nsg-status{flex:none;font-size:10px;color:var(--nt-muted,#8b90a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:13px}
.nsg-status.err{color:#e5787b}
.nsg-status.warn{color:#e0b030}
.nsg-help{position:absolute;inset:0;background:rgba(12,13,17,.96);overflow:auto;padding:12px 16px;font-size:12px;line-height:1.5;color:#dcdfe6;display:none;user-select:text;z-index:5}
.nsg-help h3{margin:4px 0;color:${ACC};font-size:13px}
.nsg-help b{color:#fff}
.nsg-expert{display:none}
.nsg-root.expert .nsg-expert{display:flex}
`;
    document.head.appendChild(s);
}

const HELP = `
<h3>🎬 Площадка — как пользоваться</h3>
<b>1.</b> Подключите <b>Load Image</b> с фото места (поляна, комната, улица) ко входу <b>scene</b>. Площадка сама сделает его объёмным (в первый раз скачается модель глубины ~100 МБ).<br>
<b>2.</b> Фото героя подключите ко входу <b>actor</b> — оно пройдёт дальше к генератору как образец.<br>
<b>3.</b> <b>Клик по полу</b> — новая точка маршрута. Точки можно <b>тащить мышкой</b>. Скелет пойдёт от точки к точке.<br>
<b>4.</b> В каждой точке выберите <b>позу</b> и напишите словами, <b>что происходит</b> («наклонилась и сорвала цветок»).<br>
<b>5.</b> Выделенную точку можно «гнуть»: тяните за <b>кисти, локти, колени, стопы, голову</b> скелета.<br>
<b>6.</b> Кнопка <b>🎥 Камера</b> — вид глазами камеры: в нём мышкой двигаете саму камеру. Или выберите готовый ракурс справа.<br>
<b>7.</b> <b>▶</b> — репетиция. Нажмите «Очередь» — нода отдаст видео скелета и раскадровку.<br><br>
<b>Мышь:</b> левая — крутить, правая — сдвигать, колёсико — ближе/дальше.<br>
<b>Выходы:</b> <i>pose_video</i> → H3 Fun ControlNet (поза), <i>storyboard</i> → автопромтер, <i>frames/width/height</i> → генератор, <i>scene/actor</i> → образцы.<br>
Сцена из одного фото — это макет: если повернуть сильно вбок, видны «рваные» края. Это нормально, фон дорисует генерация.
<h3>🎬 Stage — how to use</h3>
<b>1.</b> Connect a <b>Load Image</b> with the place photo to the <b>scene</b> input. The stage makes it 3D (the depth model, ~100 MB, downloads the first time).<br>
<b>2.</b> Connect the character photo to <b>actor</b> — it is passed on to the generator as a reference.<br>
<b>3.</b> <b>Click the floor</b> to add a route point. <b>Drag</b> points with the mouse. The skeleton walks from point to point.<br>
<b>4.</b> At each point pick a <b>pose</b> and describe <b>what happens</b> in words.<br>
<b>5.</b> Bend the selected point's pose by dragging the skeleton's <b>hands, elbows, knees, feet, head</b>.<br>
<b>6.</b> <b>🎥 Camera</b> shows the camera's view; in it the mouse moves the camera itself. Or pick a ready angle on the right.<br>
<b>7.</b> <b>▶</b> rehearses. Press “Queue” — the node outputs the pose video and the storyboard.<br><br>
<b>Mouse:</b> left — orbit, right — pan, wheel — zoom.<br>
A scene from one photo is a mock-up: from far side angles torn edges are visible. That's fine — generation paints the background.
`;

// ---------------------------------------------------------------- размер ноды (как в нодах Neron)
function makeUserSized(node, domWidget, root, opts) {
    const minH = opts.minH || 200;
    node.properties = node.properties || {};
    const manual = () => node.properties.neron_manual_size === true;
    const curH = () => {
        if (!manual()) return opts.autoH;
        const h = Number(node.properties.neron_panel_h);
        return h > 0 ? Math.max(minH, h) : opts.autoH;
    };
    const o = domWidget.options || (domWidget.options = {});
    o.getMinHeight = () => (manual() ? minH : curH());
    o.getHeight = () => curH();
    o.getMaxHeight = () => curH();
    domWidget.computeSize = (width) => [width, manual() && app.canvas?.resizing_node === node ? minH : curH()];
    const apply = () => { root.style.height = curH() + "px"; opts.onLayout?.(); };
    let fitting = false, tries = 0;
    const fit = () => {
        apply();
        const top = domWidget.last_y;
        if (top == null && tries++ < 30) { setTimeout(fit, 100); return; }
        if (fitting || top == null || !node.size) return;
        const need = Math.round(top + curH() + 14);
        if (manual() ? node.size[1] < need : Math.abs(node.size[1] - need) > 2) {
            fitting = true; node.setSize([node.size[0], need]); fitting = false;
        }
        node.setDirtyCanvas?.(true, true);
    };
    const onResize0 = node.onResize;
    node.onResize = function () {
        const r = onResize0 ? onResize0.apply(this, arguments) : undefined;
        if (!fitting && app.canvas?.resizing_node === node) {
            node.properties.neron_manual_size = true;
            const top = domWidget.last_y;
            if (top != null) node.properties.neron_panel_h = Math.max(minH, Math.round(node.size[1] - top - 14));
        }
        requestAnimationFrame(apply);
        return r;
    };
    const menu0 = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        const r = menu0 ? menu0.apply(this, arguments) : undefined;
        if (manual() && Array.isArray(options)) {
            options.push(null, { content: "↕ Авто-размер / Auto size", callback: () => { node.properties.neron_manual_size = false; fit(); } });
        }
        return r;
    };
    apply();
    setTimeout(fit, 60);
    return { fit, apply };
}

// ---------------------------------------------------------------- фото по проводу
function linkOf(graph, id) {
    if (!graph || !graph.links || id == null) return null;
    return graph.links instanceof Map ? graph.links.get(id) : graph.links[id];
}
function parseFileValue(raw) {
    let s = String(raw || "").trim();
    if (!s) return null;
    let type = "input";
    const m = /\s*\[(\w+)\]$/.exec(s);
    if (m) { type = m[1].toLowerCase(); s = s.slice(0, m.index); }
    s = s.replace(/\\/g, "/");
    if (s.startsWith("/") || /^[A-Za-z]:/.test(s) || s.split("/").includes("..")) return null;
    const k = s.lastIndexOf("/");
    const name = k >= 0 ? s.slice(k + 1) : s;
    if (!name || !/\.(png|jpe?g|webp|bmp|gif)$/i.test(name)) return null;
    return { name, subfolder: k >= 0 ? s.slice(0, k) : "", type: ["input", "output", "temp"].includes(type) ? type : "input" };
}
// идём по проводу вверх до загрузчика картинки (через ноды-обработчики тоже)
function findImage(node, inputName) {
    const g = node.graph;
    const inp = (node.inputs || []).find((i) => i.name === inputName);
    if (!inp || inp.link == null) return { wired: false };
    let cur = node.graph.getNodeById(linkOf(g, inp.link)?.origin_id);
    for (let depth = 0; cur && depth < 8; depth++) {
        const w = (cur.widgets || []).find((x) => x.name === "image" && typeof x.value === "string");
        const spec = w && parseFileValue(w.value);
        if (spec) return { wired: true, spec, via: cur.title || cur.type };
        const up = (cur.inputs || []).find((i) => i.link != null && /IMAGE/i.test(String(i.type)));
        if (!up) break;
        cur = g.getNodeById(linkOf(g, up.link)?.origin_id);
    }
    return { wired: true, spec: null };
}
function viewUrl(spec) {
    const p = `/view?filename=${encodeURIComponent(spec.name)}&subfolder=${encodeURIComponent(spec.subfolder || "")}&type=${encodeURIComponent(spec.type || "input")}`;
    return typeof api.apiURL === "function" ? api.apiURL(p) : p;
}

// ---------------------------------------------------------------- состояние
function defaultState() {
    return {
        v: 1, seconds: 5, aspect: "16:9", env: "outdoor", photo_fov: 60, actor_h: 1.7, quality: 1.0,
        points: [{ x: 0, z: -4, pose: "stand", text: "" }],
        camera: { pos: [0, 1.6, 0], target: [0, 1.0, -4], fov: 45, preset: "photo", shot: "medium" },
    };
}
function normState(s) {
    const d = defaultState();
    s = s && typeof s === "object" ? s : {};
    const o = Object.assign({}, d, s);
    o.camera = Object.assign({}, d.camera, s.camera || {});
    o.points = Array.isArray(s.points) && s.points.length ? s.points.filter((p) => p && isFinite(p.x) && isFinite(p.z)) : d.points;
    o.seconds = Math.max(5, Math.min(15, Number(o.seconds) || 5));
    if (!ASPECTS[o.aspect]) o.aspect = "16:9";
    return o;
}

// ---------------------------------------------------------------- сама площадка
async function setupStage(node) {
    injectStyles();
    if (!SC.poses()) {
        try {
            const r = await fetch(new URL("./stage_poses.json", import.meta.url).href + "?v=1");
            SC.setPoses(await r.json());
        } catch (e) {
            console.error("[Neron Stage] poses not loaded", e);
            return;
        }
    }
    const P = SC.poses();

    // скрытое поле со всей сценой
    const jw = (node.widgets || []).find((w) => w.name === "stage_json");
    if (jw) { jw.type = "hidden"; jw.hidden = true; jw.computeSize = () => [0, -4]; }
    let state;
    try { state = normState(JSON.parse(jw?.value || "{}")); } catch (e) { state = defaultState(); }
    const save = () => { if (jw) jw.value = JSON.stringify(state); node.setDirtyCanvas?.(true, false); };
    save();

    // ---------- разметка ----------
    const root = el("div", "nsg-root");
    const bar = el("div", "nsg-bar");
    bar.appendChild(el("span", "nsg-title", "🎬 ПЛОЩАДКА · STAGE"));
    const vb = {};
    for (const [k, txt, tip] of [
        ["free", "🔄", T("Свободный вид: крутите мышкой", "Free view: orbit with the mouse")],
        ["top", "⬇ " + T("Сверху", "Top"), T("Вид сверху — удобно ставить точки", "Top view — easy to place points")],
        ["side", "↔ " + T("Сбоку", "Side"), T("Вид сбоку — видно высоту", "Side view — shows heights")],
        ["camera", "🎥 " + T("Камера", "Camera"), T("Глазами камеры: ровно то, что попадёт в кадр. Мышь двигает камеру", "Through the camera: exactly what's in frame. The mouse moves the camera")],
    ]) {
        const b = el("button", "nsg-btn", txt);
        b.title = tip;
        b.onclick = () => setView(k);
        vb[k] = b; bar.appendChild(b);
    }
    const playBtn = el("button", "nsg-btn go", "▶");
    playBtn.title = T("Репетиция: проиграть движение", "Rehearsal: play the motion");
    bar.appendChild(playBtn);
    bar.appendChild(el("span", "nsg-sp"));
    const expBtn = el("button", "nsg-btn", "⚙ " + T("Эксперт", "Expert"));
    expBtn.title = T("Тонкие настройки", "Fine settings");
    const helpBtn = el("button", "nsg-btn", "📖 " + T("Справка", "Help"));
    bar.appendChild(expBtn); bar.appendChild(helpBtn);
    root.appendChild(bar);

    const body = el("div", "nsg-body");
    const view = el("div", "nsg-view");
    const tag = el("div", "nsg-tag", "");
    const hint = el("div", "nsg-hint", "");
    const help = el("div", "nsg-help");
    help.innerHTML = HELP;
    const side = el("div", "nsg-side");
    body.appendChild(view); body.appendChild(side);
    root.appendChild(body);
    const tl = el("canvas", "nsg-tl");
    root.appendChild(tl);
    const status = el("div", "nsg-status", "");
    root.appendChild(status);
    const setStatus = (t, kind) => { status.textContent = t || ""; status.className = "nsg-status" + (kind ? " " + kind : ""); };

    helpBtn.onclick = () => { help.style.display = help.style.display === "block" ? "none" : "block"; };
    help.onclick = () => { help.style.display = "none"; };
    expBtn.onclick = () => {
        node.properties.nsg_expert = !node.properties.nsg_expert;
        root.classList.toggle("expert", !!node.properties.nsg_expert);
        expBtn.classList.toggle("on", !!node.properties.nsg_expert);
    };
    node.properties = node.properties || {};
    root.classList.toggle("expert", !!node.properties.nsg_expert);
    expBtn.classList.toggle("on", !!node.properties.nsg_expert);

    // ---------- 3D ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x0f1014);
    renderer.autoClear = false;
    view.appendChild(renderer.domElement);
    view.appendChild(tag); view.appendChild(hint); view.appendChild(help);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;

    const scene3 = new THREE.Scene();
    const grid = new THREE.GridHelper(40, 40, 0x4a3f78, 0x262833);
    scene3.add(grid);
    const viewCam = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
    viewCam.position.set(6, 6, 4);
    const stageCam = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 500);
    const ctlView = new OrbitControls(viewCam, canvas);
    const ctlCam = new OrbitControls(stageCam, canvas);
    for (const c of [ctlView, ctlCam]) { c.enableDamping = false; c.screenSpacePanning = true; }
    ctlCam.enabled = false;
    ctlView.target.set(0, 0.8, -4);

    // декорация из фото
    const backdrop = new THREE.Group();
    scene3.add(backdrop);
    let photoTex = null, photoAspect = 16 / 9, photoCam = null, sceneKey = "", depthBusy = false;

    // скелет
    const skel = new THREE.Group();
    scene3.add(skel);
    const jointGeo = new THREE.SphereGeometry(0.035, 12, 8);
    const boneGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 8, 1);
    boneGeo.translate(0, 0.5, 0);
    const joints = SC.COLORS.map((c) => {
        const m = new THREE.Mesh(jointGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255) }));
        skel.add(m); return m;
    });
    const bones = SC.LIMBS.map((l, n) => {
        const c = SC.COLORS[n];
        const m = new THREE.Mesh(boneGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0] / 255 * 0.7, c[1] / 255 * 0.7, c[2] / 255 * 0.7) }));
        skel.add(m); return m;
    });
    const HANDLES = [0, 1, 3, 4, 6, 7, 9, 10, 12, 13];
    const handleRings = HANDLES.map(() => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthTest: false }));
        m.renderOrder = 10; skel.add(m); return m;
    });
    const up = new THREE.Vector3(0, 1, 0);
    function setBody(pts, showHandles) {
        pts.forEach((p, i) => joints[i].position.set(p[0], p[1], p[2]));
        SC.LIMBS.forEach(([a, b], n) => {
            const A = new THREE.Vector3(...pts[a]), B = new THREE.Vector3(...pts[b]);
            const d = B.clone().sub(A);
            const len = d.length();
            bones[n].position.copy(A);
            bones[n].scale.set(1, Math.max(0.001, len), 1);
            bones[n].quaternion.setFromUnitVectors(up, d.normalize());
        });
        HANDLES.forEach((j, n) => { handleRings[n].position.copy(joints[j].position); handleRings[n].visible = !!showHandles; });
    }

    // точки маршрута
    const marks = new THREE.Group();
    scene3.add(marks);
    const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xb388ff, dashSize: 0.25, gapSize: 0.15 }));
    scene3.add(pathLine);
    function numberSprite(n, selected) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d");
        g.fillStyle = selected ? "#b388ff" : "#6b4fb3";
        g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.font = "bold 34px Segoe UI, Arial"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(n), 32, 34);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
        s.scale.set(0.42, 0.42, 1); s.renderOrder = 11;
        return s;
    }
    let selected = 0;
    function rebuildMarks() {
        while (marks.children.length) {
            const m = marks.children.pop();
            m.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
        }
        state.points.forEach((p, i) => {
            const g = new THREE.Group();
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: i === selected ? 0xb388ff : 0x6b4fb3, side: THREE.DoubleSide, depthTest: false }));
            ring.rotation.x = -Math.PI / 2; ring.renderOrder = 9;
            const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, side: THREE.DoubleSide }));
            disc.rotation.x = -Math.PI / 2;
            const sp = numberSprite(i + 1, i === selected);
            sp.position.y = 2.05;
            g.add(ring); g.add(disc); g.add(sp);
            g.position.set(p.x, 0.01, p.z);
            g.userData.index = i;
            marks.add(g);
        });
        const pos = state.points.map((p) => new THREE.Vector3(p.x, 0.02, p.z));
        pathLine.geometry.dispose();
        pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pos.length > 1 ? pos : [pos[0], pos[0]]);
        pathLine.computeLineDistances();
    }

    // рамка камеры
    const camGroup = new THREE.Group();
    scene3.add(camGroup);
    const camLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd36b }));
    camGroup.add(camLines);
    function aspectNum() { const a = ASPECTS[state.aspect]; return a[0] / a[1]; }
    function applyCamState() {
        const c = state.camera;
        stageCam.position.set(...c.pos);
        stageCam.fov = c.fov || 45;
        stageCam.aspect = aspectNum();
        stageCam.lookAt(new THREE.Vector3(...c.target));
        stageCam.updateProjectionMatrix();
        ctlCam.target.set(...c.target);
        drawFrustum();
    }
    function drawFrustum() {
        stageCam.updateMatrixWorld();
        // рамка-пирамидка
        const d = 0.9, hh = Math.tan(THREE.MathUtils.degToRad(stageCam.fov / 2)) * d, ww = hh * stageCam.aspect;
        const loc = [[0, 0, 0], [-ww, hh, -d], [ww, hh, -d], [ww, -hh, -d], [-ww, -hh, -d], [0, hh * 1.5, -d]]
            .map((v) => new THREE.Vector3(...v).applyMatrix4(stageCam.matrixWorld));
        const seg = [0, 1, 0, 2, 0, 3, 0, 4, 1, 2, 2, 3, 3, 4, 4, 1, 1, 5, 5, 2];
        camLines.geometry.dispose();
        camLines.geometry = new THREE.BufferGeometry().setFromPoints(seg.map((i) => loc[i]));
    }
    function storeCamFromStage(preset) {
        state.camera.pos = stageCam.position.toArray().map((v) => +v.toFixed(3));
        state.camera.target = ctlCam.target.toArray().map((v) => +v.toFixed(3));
        if (preset) state.camera.preset = preset;
        save();
    }

    // ---------- ракурсы камеры ----------
    function centroid() {
        const pts = state.points;
        const x = pts.reduce((s, p) => s + p.x, 0) / pts.length, z = pts.reduce((s, p) => s + p.z, 0) / pts.length;
        return new THREE.Vector3(x, 1.0, z);
    }
    function frontDir(C) {
        if (photoCam) {
            const d = new THREE.Vector3(photoCam.pos[0] - C.x, 0, photoCam.pos[2] - C.z);
            if (d.lengthSq() > 1e-4) return d.normalize();
        }
        return new THREE.Vector3(0, 0, 1);
    }
    function applyPreset(preset) {
        const c = state.camera;
        c.preset = preset;
        if (preset === "photo" && photoCam) {
            const p = new THREE.Vector3(...photoCam.pos), d = new THREE.Vector3(...photoCam.dir);
            c.pos = p.toArray(); c.target = p.clone().addScaledVector(d, 5).toArray();
            const vf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(state.photo_fov / 2)) / photoAspect);
            c.fov = +THREE.MathUtils.radToDeg(vf).toFixed(1);
        } else {
            const C = centroid(), f = frontDir(C);
            const dist = SHOT_DIST[c.shot] || 4;
            const right = new THREE.Vector3().crossVectors(up, f).normalize();   // правая сторона кадра глазами камеры спереди
            let pos;
            if (preset === "left") pos = C.clone().addScaledVector(right, -dist);
            else if (preset === "right") pos = C.clone().addScaledVector(right, dist);
            else if (preset === "back") pos = C.clone().addScaledVector(f, -dist);
            else pos = C.clone().addScaledVector(f, dist);
            pos.y = 1.5;
            const tgt = C.clone();
            if (preset === "top") { pos = C.clone().addScaledVector(f, dist * 0.45); pos.y = dist * 1.3 + 1; tgt.y = 0.6; }
            if (preset === "low") { pos.y = 0.35; tgt.y = 1.3; }
            if (preset === "photo") { pos = C.clone().addScaledVector(f, dist); pos.y = 1.6; }
            c.pos = pos.toArray(); c.target = tgt.toArray(); c.fov = 45;
        }
        c.pos = c.pos.map((v) => +(+v).toFixed(3)); c.target = c.target.map((v) => +(+v).toFixed(3));
        applyCamState(); save(); refreshPanel();
    }

    // ---------- вид ----------
    let mode = node.properties.nsg_view || "free";
    function setView(m) {
        mode = m;
        node.properties.nsg_view = m;
        for (const k in vb) vb[k].classList.toggle("on", k === m);
        ctlView.enabled = m !== "camera";
        ctlCam.enabled = m === "camera";
        const C = centroid();
        if (m === "top") { viewCam.position.set(C.x, 16, C.z + 0.01); ctlView.target.set(C.x, 0, C.z); }
        if (m === "side") {
            const f = frontDir(C), r = new THREE.Vector3().crossVectors(up, f).normalize();
            viewCam.position.copy(C).addScaledVector(r, 9); viewCam.position.y = 1.4; ctlView.target.copy(C);
        }
        ctlView.update();
        dirty = true;
        tag.textContent = { free: T("Свободный вид", "Free view"), top: T("Сверху", "Top"), side: T("Сбоку", "Side"), camera: "🎥 " + T("Глазами камеры — мышь двигает камеру", "Camera view — the mouse moves the camera") }[m];
        updateHint();
    }
    function updateHint() {
        hint.textContent = mode === "camera"
            ? T("Крутите и сдвигайте — так встанет камера в ролике", "Orbit and pan — this is where the clip camera goes")
            : T("Клик по полу — новая точка · тащите точки и суставы скелета", "Click the floor — new point · drag points and skeleton joints");
    }

    // ---------- отрисовка ----------
    let raf = 0, alive = true, playing = false, t = 0, lastTs = 0, dirty = true;
    const markDirty = () => { dirty = true; };
    ctlView.addEventListener("change", markDirty);
    ctlCam.addEventListener("change", () => {
        if (mode !== "camera") return;
        state.camera.pos = stageCam.position.toArray().map((v) => +v.toFixed(3));
        state.camera.target = ctlCam.target.toArray().map((v) => +v.toFixed(3));
        state.camera.preset = "custom";
        drawFrustum(); markDirty(); camSave();
    });
    let camSaveT = 0;
    function camSave() { clearTimeout(camSaveT); camSaveT = setTimeout(() => { save(); refreshPanel(); }, 300); }
    for (const ev of ["wheel", "keydown", "keyup"]) { view.addEventListener(ev, (e) => e.stopPropagation()); side.addEventListener(ev, (e) => e.stopPropagation()); }

    function resize() {
        const w = Math.max(50, view.clientWidth), h = Math.max(50, view.clientHeight);
        if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
            renderer.setSize(w, h, false);
            dirty = true;
        }
        viewCam.aspect = w / h; viewCam.updateProjectionMatrix();
        return [w, h];
    }

    let pl = SC.plan(state);
    function replan() { pl = SC.plan(state); drawTimeline(); warnPace(); dirty = true; }

    function currentBody() {
        if (!playing && !scrubbing && state.points[selected]) {
            const p = state.points[selected];
            const seg = pl.segments.find((s) => s.kind === "hold" && s.i === selected);
            const yaw = pl.yaws[selected];
            const local = SC.fk(SC.targetAngles(p, 0), state.actor_h);
            void seg;
            return { pts: SC.placeBody(local, p.x, p.z, yaw), handles: true };
        }
        return { pts: SC.worldPoints(pl, t, state.actor_h), handles: false };
    }

    function frame(ts) {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        if (!canvas.isConnected || document.hidden) return;
        const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
        lastTs = ts;
        if (playing) {
            t += dt;
            if (t >= pl.seconds) { t = pl.seconds; playing = false; playBtn.textContent = "▶"; }
            dirty = true; drawTimeline();
        }
        const [w, h] = resize();
        if (!dirty) return;
        dirty = false;
        const b = currentBody();
        // глазами камеры — только то, что попадёт в кадр: без меток и рамок
        setBody(b.pts, b.handles && mode !== "camera");
        camGroup.visible = marks.visible = pathLine.visible = mode !== "camera";
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        renderer.clear();
        if (mode === "camera") {
            // кадр с полями: ровно пропорции ролика
            const a = aspectNum();
            let vw = w, vh = w / a;
            if (vh > h) { vh = h; vw = h * a; }
            const x = (w - vw) / 2, y = (h - vh) / 2;
            renderer.setScissorTest(true);
            renderer.setScissor(x, y, vw, vh);
            renderer.setViewport(x, y, vw, vh);
            renderer.setClearColor(0x15171c); renderer.clear();
            renderer.render(scene3, stageCam);
            renderer.setScissorTest(false);
            renderer.setClearColor(0x0f1014);
        } else {
            renderer.render(scene3, viewCam);
        }
    }

    // ---------- шкала времени ----------
    let scrubbing = false;
    function drawTimeline() {
        const dpr = window.devicePixelRatio || 1;
        const w = tl.clientWidth || 300, h = tl.clientHeight || 30;
        if (tl.width !== Math.round(w * dpr) || tl.height !== Math.round(h * dpr)) { tl.width = Math.round(w * dpr); tl.height = Math.round(h * dpr); }
        const g = tl.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, w, h);
        const k = w / pl.seconds;
        for (const s of pl.segments) {
            const x0 = s.t0 * k, x1 = s.t1 * k;
            g.fillStyle = s.kind === "hold" ? (s.i === selected ? "#8a6ad6" : "#5a4594") : "#2c3a52";
            g.fillRect(x0 + 1, 4, Math.max(1, x1 - x0 - 2), h - 8);
            g.fillStyle = "#fff"; g.font = "bold 10px Segoe UI, Arial"; g.textBaseline = "middle";
            if (x1 - x0 > 16) {
                const label = s.kind === "hold" ? String(s.i + 1) : (s.move === "run" ? "🏃" : "→");
                g.fillText(label, x0 + 5, h / 2);
            }
        }
        g.fillStyle = "#8b90a0"; g.font = "9px Segoe UI, Arial";
        for (let sec = 1; sec < pl.seconds; sec++) g.fillRect(sec * k, h - 4, 1, 4);
        g.fillStyle = "#ffd36b";
        g.fillRect(Math.round(t * k) - 1, 0, 2, h);
    }
    function scrubAt(e) {
        const r = tl.getBoundingClientRect();
        t = Math.max(0, Math.min(pl.seconds, (e.clientX - r.left) / r.width * pl.seconds));
        dirty = true; drawTimeline();
    }
    tl.addEventListener("pointerdown", (e) => { e.stopPropagation(); scrubbing = true; playing = false; playBtn.textContent = "▶"; tl.setPointerCapture(e.pointerId); scrubAt(e); });
    tl.addEventListener("pointermove", (e) => { if (scrubbing) scrubAt(e); });
    tl.addEventListener("pointerup", () => { scrubbing = false; dirty = true; });
    playBtn.onclick = () => {
        playing = !playing;
        if (playing && t >= pl.seconds - 0.01) t = 0;
        playBtn.textContent = playing ? "⏸" : "▶";
        dirty = true;
    };

    function warnPace() {
        if (pl.speedK < 0.6) setStatus(T(`Много действий на ${pl.seconds} с — героиня будет торопиться. Увеличьте длину или уберите точку`, `Too much for ${pl.seconds} s — add time or remove a point`), "warn");
        else if (pl.speedK > 2.6 && state.points.length > 1) setStatus(T("Движение получится медленным — можно сократить длину ролика", "Motion will be slow — you can shorten the clip"), "warn");
        else if (status.classList.contains("warn")) setStatus("");
    }

    // ---------- мышь в 3D ----------
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    function setNdc(e) {
        const r = canvas.getBoundingClientRect();
        let x = e.clientX - r.left, y = e.clientY - r.top, w = r.width, h = r.height;
        if (mode === "camera") {
            const a = aspectNum();
            let vw = w, vh = w / a;
            if (vh > h) { vh = h; vw = h * a; }
            x -= (w - vw) / 2; y -= (h - vh) / 2; w = vw; h = vh;
        }
        ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
        ray.setFromCamera(ndc, mode === "camera" ? stageCam : viewCam);
    }
    function floorHit() { const p = new THREE.Vector3(); return ray.ray.intersectPlane(floorPlane, p) ? p : null; }
    function toScreen(v) {
        const cam = mode === "camera" ? stageCam : viewCam;
        const p = new THREE.Vector3(...v).project(cam);
        return [p.x, p.y];
    }

    let drag = null;
    canvas.addEventListener("pointerdown", (e) => {
        canvas.focus();
        if (help.style.display === "block") return;
        setNdc(e);
        const down = { x: e.clientX, y: e.clientY, button: e.button };
        if (e.button === 0 && !playing && mode !== "camera") {
            // 1) сустав выделенной точки
            const hj = ray.intersectObjects(handleRings.filter((m) => m.visible), false)[0];
            if (hj) {
                const j = HANDLES[handleRings.indexOf(hj.object)];
                drag = { kind: "joint", j, x: e.clientX, y: e.clientY, down };
                ctlView.enabled = false; canvas.setPointerCapture(e.pointerId); e.stopPropagation(); return;
            }
            // 2) точка маршрута
            const hm = ray.intersectObjects(marks.children, true)[0];
            if (hm) {
                let o = hm.object; while (o && o.userData.index == null) o = o.parent;
                if (o) {
                    select(o.userData.index);
                    drag = { kind: "point", i: o.userData.index, moved: false, down };
                    ctlView.enabled = false; canvas.setPointerCapture(e.pointerId); e.stopPropagation(); return;
                }
            }
        }
        drag = { kind: "click", down };
    }, true);
    canvas.addEventListener("pointermove", (e) => {
        if (!drag) return;
        if (drag.kind === "point") {
            setNdc(e);
            const p = floorHit();
            if (p) {
                const pt = state.points[drag.i];
                pt.x = +p.x.toFixed(3); pt.z = +p.z.toFixed(3);
                drag.moved = true;
                rebuildMarks(); replan();
            }
        } else if (drag.kind === "joint") {
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            drag.x = e.clientX; drag.y = e.clientY;
            bendJoint(drag.j, dx, dy);
        }
    });
    canvas.addEventListener("pointerup", (e) => {
        const d = drag; drag = null;
        if (mode !== "camera") ctlView.enabled = true;
        if (!d) return;
        if (d.kind === "point") { if (d.moved) { save(); refreshPanel(); } return; }
        if (d.kind === "joint") { save(); refreshPanel(); return; }
        const moved = Math.hypot(e.clientX - d.down.x, e.clientY - d.down.y);
        if (d.down.button === 0 && moved < 5 && mode !== "camera" && !playing) {
            setNdc(e);
            const p = floorHit();
            if (p && p.distanceTo(viewCam.position) < 120) addPoint(p.x, p.z);
        }
    });

    // гнём сустав мышкой: вверх-вниз и в стороны
    function bendJoint(j, dx, dy) {
        const p = state.points[selected];
        if (!p) return;
        p.adj = p.adj || {};
        const pts = joints.map((m) => m.position.toArray());
        const sx = (i) => toScreen(pts[i])[0];
        const outward = (a, b) => (sx(a) >= sx(b) ? 1 : -1);    // в какую сторону экрана «наружу»
        const A = (k, v) => { p.adj[k] = Math.max(-180, Math.min(180, (p.adj[k] || 0) + v)); };
        const L = new Set([5, 6, 7, 11, 12, 13]);
        const left = L.has(j);
        if (j === 7 || j === 4) { A(left ? "lsp" : "rsp", -dy * 0.6); A(left ? "lsr" : "rsr", dx * 0.6 * outward(left ? 5 : 2, 1)); }
        else if (j === 6 || j === 3) { A(left ? "le" : "re", -dy * 0.7); }
        else if (j === 13 || j === 10) { A(left ? "lhp" : "rhp", -dy * 0.5); A(left ? "lhr" : "rhr", dx * 0.5 * outward(left ? 11 : 8, 1)); }
        else if (j === 12 || j === 9) { A(left ? "lk" : "rk", -dy * 0.7); }
        else if (j === 0) { A("hp", dy * 0.5); A("hy", dx * 0.5 * outward(15, 0)); }
        else if (j === 1) { A("tp", dy * 0.4); A("ty", dx * 0.4 * outward(5, 1)); }
        if (p.pose === "stand" || !p.pose) p.pose = "idle";
        replan();
    }

    // ---------- точки ----------
    function addPoint(x, z) {
        const prev = state.points[state.points.length - 1];
        state.points.push({ x: +x.toFixed(3), z: +z.toFixed(3), pose: "stand", text: "", move: prev ? (prev.move || "walk") : "walk" });
        selected = state.points.length - 1;
        save(); rebuildMarks(); replan(); refreshPanel();
        setStatus(T(`Точка ${selected + 1} добавлена — выберите позу и напишите, что тут происходит`, `Point ${selected + 1} added — pick a pose and describe what happens`));
    }
    function select(i) {
        selected = Math.max(0, Math.min(state.points.length - 1, i));
        const seg = pl.segments.find((s) => s.kind === "hold" && s.i === selected);
        if (seg) t = (seg.t0 + seg.t1) / 2;
        rebuildMarks(); drawTimeline(); refreshPanel(); dirty = true;
    }

    // ---------- панель справа ----------
    const secScene = el("div", "nsg-sec"), secClip = el("div", "nsg-sec"), secCam = el("div", "nsg-sec"),
        secPts = el("div", "nsg-sec"), secExp = el("div", "nsg-sec nsg-expert");
    secExp.style.flexDirection = "column";
    side.append(secScene, secClip, secCam, secPts, secExp);

    function seg(options, value, onPick, title) {
        const s = el("div", "nsg-seg");
        if (title) s.title = title;
        for (const [v, txt] of options) {
            const b = el("button", value === v ? "on" : "", txt);
            b.onclick = (e) => { e.stopPropagation(); onPick(v); };
            s.appendChild(b);
        }
        return s;
    }
    const stop = (inp) => { for (const ev of ["keydown", "keyup", "keypress", "pointerdown", "wheel"]) inp.addEventListener(ev, (e) => e.stopPropagation()); return inp; };

    let sceneInfo = { text: T("Подключите Load Image с фото места ко входу scene", "Connect a Load Image with the place photo to the scene input") };
    let actorInfo = "";
    function refreshPanel() {
        // сцена
        secScene.innerHTML = "";
        secScene.appendChild(el("div", "nsg-h", T("СЦЕНА", "SCENE")));
        const st = el("div", "nsg-small", sceneInfo.text);
        if (sceneInfo.err) st.style.color = "#e5787b";
        secScene.appendChild(st);
        if (actorInfo) secScene.appendChild(el("div", "nsg-small", actorInfo));
        const r1 = el("div", "nsg-row");
        r1.appendChild(seg([["indoor", "🏠 " + T("Комната", "Room")], ["outdoor", "🌳 " + T("Улица", "Outdoor")]], state.env,
            (v) => { state.env = v; save(); refreshPanel(); rebuildDepth(true); }, T("Подсказка модели глубины: где снято фото", "Depth model hint: where the photo was taken")));
        secScene.appendChild(r1);
        // ролик
        secClip.innerHTML = "";
        secClip.appendChild(el("div", "nsg-h", T("РОЛИК", "CLIP")));
        const r2 = el("div", "nsg-row");
        const rng = stop(el("input", "nsg-range"));
        rng.type = "range"; rng.min = 5; rng.max = 15; rng.step = 1; rng.value = state.seconds;
        const sl = el("span", "nsg-lbl", `${state.seconds} ${T("с", "s")} · ${SC.framesFor(state.seconds)} ${T("кадров", "frames")}`);
        rng.oninput = () => { state.seconds = Number(rng.value); sl.textContent = `${state.seconds} ${T("с", "s")} · ${SC.framesFor(state.seconds)} ${T("кадров", "frames")}`; save(); replan(); };
        r2.append(rng, sl);
        secClip.appendChild(r2);
        secClip.appendChild(seg(Object.keys(ASPECTS).map((a) => [a, a]), state.aspect,
            (v) => { state.aspect = v; save(); applyCamState(); refreshPanel(); dirty = true; }, T("Формат кадра", "Frame format")));
        // камера
        secCam.innerHTML = "";
        secCam.appendChild(el("div", "nsg-h", T("КАМЕРА", "CAMERA")));
        const sel = stop(el("select", "nsg-sel"));
        for (const [v, txt] of [["photo", T("Как на фото", "As in photo")], ["front", T("Спереди", "Front")], ["left", T("Слева", "Left")],
            ["right", T("Справа", "Right")], ["back", T("Сзади", "Back")], ["top", T("Сверху", "Top")], ["low", T("Снизу", "Low")], ["custom", T("Своя (мышкой)", "Custom (mouse)")]]) {
            const o = el("option", "", txt); o.value = v; sel.appendChild(o);
        }
        sel.value = state.camera.preset || "custom";
        sel.onchange = () => { if (sel.value !== "custom") applyPreset(sel.value); };
        const r3 = el("div", "nsg-row"); r3.appendChild(sel); secCam.appendChild(r3);
        secCam.appendChild(seg([["wide", T("Общий", "Wide")], ["medium", T("Средний", "Medium")], ["close", T("Крупный", "Close")]], state.camera.shot || "medium",
            (v) => { state.camera.shot = v; applyPreset(state.camera.preset === "custom" ? "front" : state.camera.preset); }, T("План", "Shot size")));
        const fromHere = el("button", "nsg-btn", "📷 " + T("Камера отсюда", "Camera from here"));
        fromHere.title = T("Поставить камеру туда, откуда вы сейчас смотрите", "Put the camera where you are looking from now");
        fromHere.onclick = () => {
            stageCam.position.copy(viewCam.position);
            ctlCam.target.copy(ctlView.target);
            stageCam.lookAt(ctlCam.target);
            applyCamState(); storeCamFromStage("custom"); refreshPanel(); dirty = true;
        };
        secCam.appendChild(fromHere);
        secCam.appendChild(el("div", "nsg-small", T("Камера в ролике стоит неподвижно", "The clip camera stays still")));
        // точки
        secPts.innerHTML = "";
        const hp = el("div", "nsg-row");
        hp.appendChild(el("div", "nsg-h", T("ТОЧКИ МАРШРУТА", "ROUTE POINTS")));
        hp.appendChild(el("span", "nsg-sp"));
        const clr = el("button", "nsg-btn warn", "🗑");
        clr.title = T("Оставить одну точку (нажать дважды)", "Keep one point (press twice)");
        let armed = null;
        clr.onclick = () => {
            if (!armed) { clr.textContent = T("Точно?", "Sure?"); armed = setTimeout(() => { armed = null; clr.textContent = "🗑"; }, 2000); return; }
            clearTimeout(armed);
            state.points = [Object.assign({}, state.points[0], { text: "", pose: "stand", adj: {} })];
            selected = 0; save(); rebuildMarks(); replan(); refreshPanel();
        };
        hp.appendChild(clr);
        secPts.appendChild(hp);
        secPts.appendChild(el("div", "nsg-small", T("Клик по полу — новая точка. Тащите точки мышкой.", "Click the floor — new point. Drag points with the mouse.")));
        state.points.forEach((p, i) => secPts.appendChild(pointCard(p, i)));
        // эксперт
        secExp.innerHTML = "";
        secExp.appendChild(el("div", "nsg-h", T("ЭКСПЕРТ", "EXPERT")));
        secExp.appendChild(numRow(T("Рост героя, м", "Actor height, m"), state.actor_h, 1.0, 2.2, 0.01, (v) => { state.actor_h = v; save(); replan(); }));
        secExp.appendChild(numRow(T("Угол обзора фото, °", "Photo field of view, °"), state.photo_fov, 30, 120, 1, (v) => { state.photo_fov = v; save(); rebuildDepth(true); }));
        secExp.appendChild(numRow(T("Угол обзора камеры, °", "Camera field of view, °"), state.camera.fov, 15, 100, 1, (v) => { state.camera.fov = v; save(); applyCamState(); dirty = true; }));
        secExp.appendChild(numRow(T("Масштаб размера кадра", "Frame size scale"), state.quality || 1, 0.5, 1.5, 0.05, (v) => { state.quality = v; save(); }));
        secExp.appendChild(el("div", "nsg-small", T("Размер выхода: ", "Output size: ") + outSize().join("×")));
    }
    function outSize() {
        const base = { "16:9": [1280, 704], "9:16": [704, 1280], "1:1": [960, 960], "4:3": [1024, 768], "3:4": [768, 1024] }[state.aspect];
        const q = state.quality || 1;
        return base.map((v) => Math.max(256, Math.floor(v * q / 32 + 0.5) * 32));
    }
    function numRow(label, value, min, max, step, onSet) {
        const r = el("div", "nsg-row");
        r.appendChild(el("span", "nsg-lbl", label));
        r.appendChild(el("span", "nsg-sp"));
        const inp = stop(el("input", "nsg-in"));
        inp.type = "number"; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
        inp.onchange = () => { const v = Math.max(min, Math.min(max, Number(inp.value) || value)); inp.value = v; onSet(v); };
        r.appendChild(inp);
        return r;
    }
    function pointCard(p, i) {
        const c = el("div", "nsg-card" + (i === selected ? " sel" : ""));
        c.onclick = () => { if (i !== selected) select(i); };
        const s = pl.segments.find((x) => x.kind === "hold" && x.i === i);
        const head = el("div", "nsg-row");
        head.appendChild(el("span", "nsg-num", String(i + 1)));
        head.appendChild(el("span", "nsg-lbl", s ? `${s.t0.toFixed(1)}–${s.t1.toFixed(1)} ${T("с", "s")}` : ""));
        head.appendChild(el("span", "nsg-sp"));
        if (state.points.length > 1) {
            const x = el("button", "nsg-x", "✕");
            x.title = T("Удалить точку", "Delete point");
            x.onclick = (e) => {
                e.stopPropagation();
                state.points.splice(i, 1);
                selected = Math.min(selected, state.points.length - 1);
                save(); rebuildMarks(); replan(); refreshPanel();
            };
            head.appendChild(x);
        }
        c.appendChild(head);
        const sel = stop(el("select", "nsg-sel"));
        for (const k of P.order) {
            if (P.poses[k].move) continue;            // «идёт / бежит» — это переход между точками
            const o = el("option", "", T(P.poses[k].ru, P.poses[k].en)); o.value = k; sel.appendChild(o);
        }
        sel.value = p.pose || "stand";
        sel.onchange = () => { p.pose = sel.value; p.adj = {}; save(); replan(); refreshPanel(); };
        const r = el("div", "nsg-row"); r.appendChild(sel);
        if (p.adj && Object.keys(p.adj).length) {
            const rs = el("button", "nsg-btn", "↺");
            rs.title = T("Сбросить подгибания мышкой", "Reset mouse bends");
            rs.onclick = (e) => { e.stopPropagation(); p.adj = {}; save(); replan(); refreshPanel(); };
            r.appendChild(rs);
        }
        c.appendChild(r);
        const ta = stop(el("textarea", "nsg-ta"));
        ta.placeholder = T("что тут происходит…", "what happens here…");
        ta.value = p.text || "";
        ta.oninput = () => { p.text = ta.value; save(); replan(); };
        c.appendChild(ta);
        // эксперт: время, как пришла, поворот
        const ex = el("div", "nsg-row nsg-expert");
        ex.appendChild(el("span", "nsg-lbl", T("пауза, с", "hold, s")));
        const hold = stop(el("input", "nsg-in"));
        hold.type = "number"; hold.min = 0; hold.max = 15; hold.step = 0.1; hold.value = p.hold ?? "";
        hold.placeholder = T("авто", "auto");
        hold.onchange = () => { const v = Number(hold.value); p.hold = hold.value === "" || !(v > 0) ? null : v; save(); replan(); refreshPanel(); };
        ex.appendChild(hold);
        if (i > 0) {
            ex.appendChild(seg([["walk", T("идёт", "walk")], ["run", T("бежит", "run")]], p.move || "walk",
                (v) => { p.move = v; save(); replan(); refreshPanel(); }, T("Как добирается до этой точки", "How the actor gets here")));
        }
        const rot = (d) => { const b = el("button", "nsg-btn", d > 0 ? "⟲" : "⟳"); b.title = T("Повернуть героиню", "Turn the actor"); b.onclick = (e) => { e.stopPropagation(); p.yaw = (((p.yaw ?? pl.yaws[i]) + d) % 360); save(); replan(); }; return b; };
        ex.appendChild(rot(45)); ex.appendChild(rot(-45));
        if (p.yaw != null) {
            const a = el("button", "nsg-btn", T("авто", "auto"));
            a.title = T("Смотреть по ходу движения", "Face the direction of travel");
            a.onclick = (e) => { e.stopPropagation(); p.yaw = null; save(); replan(); refreshPanel(); };
            ex.appendChild(a);
        }
        c.appendChild(ex);
        return c;
    }

    // ---------- декорация из фото ----------
    function clearBackdrop() {
        while (backdrop.children.length) {
            const m = backdrop.children.pop();
            m.geometry?.dispose?.(); m.material?.dispose?.();
        }
    }
    function flatBackdrop() {
        clearBackdrop();
        if (!photoTex) return;
        const d = 12, w = 2 * d * Math.tan(THREE.MathUtils.degToRad(state.photo_fov / 2)), h = w / photoAspect;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: photoTex, side: THREE.DoubleSide }));
        m.position.set(0, 1.6, -d);
        backdrop.add(m);
        dirty = true;
    }
    function meshBackdrop(res) {
        clearBackdrop();
        const gw = res.gw, gh = res.gh;
        const bin = atob(res.pos);
        const buf = new ArrayBuffer(bin.length);
        const u8 = new Uint8Array(buf);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const pos = new Float32Array(buf);
        const uv = new Float32Array(gw * gh * 2);
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
            const k = y * gw + x;
            uv[k * 2] = x / (gw - 1); uv[k * 2 + 1] = 1 - y / (gh - 1);
        }
        const camP = new THREE.Vector3(...res.photo_cam.pos);
        const dist = (k) => Math.hypot(pos[k * 3] - camP.x, pos[k * 3 + 1] - camP.y, pos[k * 3 + 2] - camP.z);
        const idx = [];
        const far = Number(res.far) || 1e9;   // дальний план (небо, лес вдали) не рвём — это задник
        const ok = (a, b) => { const da = dist(a), db = dist(b); return Math.min(da, db) > far || Math.max(da, db) / Math.max(0.01, Math.min(da, db)) < 1.12; };
        for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) {
            const a = y * gw + x, b = a + 1, c = a + gw, d = c + 1;
            if (ok(a, b) && ok(a, c) && ok(b, c)) idx.push(a, c, b);       // рвём «плёнку» на краях предметов
            if (ok(b, d) && ok(c, d) && ok(b, c)) idx.push(b, c, d);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        backdrop.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: photoTex, side: THREE.DoubleSide })));
        dirty = true;
    }
    async function rebuildDepth(force) {
        const found = findImage(node, "scene");
        if (!found.spec || depthBusy) return;
        depthBusy = true;
        setStatus(T("Делаю сцену объёмной… (в первый раз скачивается модель глубины, ~100 МБ)", "Making the scene 3D… (the depth model, ~100 MB, downloads the first time)"));
        try {
            const r = await api.fetchApi("/neron/stage/depth", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: found.spec, env: state.env, fov: state.photo_fov }),
            });
            const res = await r.json();
            if (!res.ok) { setStatus(T("Объём не получился: ", "3D failed: ") + res.error, "err"); flatBackdrop(); return; }
            photoCam = res.photo_cam;
            meshBackdrop(res);
            const firstTime = !node.properties.nsg_scene_key || node.properties.nsg_scene_key !== sceneKey;
            node.properties.nsg_scene_key = sceneKey;
            if (firstTime || force) {
                // героиню — на пол перед камерой фото, камеру — «как на фото»
                if (state.points.length === 1 && !state.points[0].text) {
                    const p = new THREE.Vector3(...photoCam.pos).addScaledVector(new THREE.Vector3(photoCam.dir[0], 0, photoCam.dir[2]).normalize(), 4);
                    state.points[0].x = +p.x.toFixed(3); state.points[0].z = +p.z.toFixed(3);
                    rebuildMarks(); replan();
                }
                if (state.camera.preset === "photo" || firstTime) applyPreset("photo");
                setView(mode);
            }
            setStatus(res.ground_ok ? T("Сцена готова — пол найден", "Scene ready — floor found")
                : T("Сцена готова, но пол не найден — считаю, что фото снято с высоты глаз", "Scene ready, floor not found — assuming eye-level photo"), res.ground_ok ? "" : "warn");
        } catch (e) {
            setStatus(T("Ошибка объёма: ", "3D error: ") + e, "err");
            flatBackdrop();
        } finally { depthBusy = false; }
    }
    function checkInputs() {
        const s = findImage(node, "scene");
        const key = s.spec ? `${s.spec.type}|${s.spec.subfolder}|${s.spec.name}` : (s.wired ? "?" : "");
        if (key !== sceneKey) {
            sceneKey = key;
            if (!s.wired) { sceneInfo = { text: T("Подключите Load Image с фото места ко входу scene", "Connect a Load Image with the place photo to the scene input") }; photoTex = null; photoCam = null; clearBackdrop(); }
            else if (!s.spec) { sceneInfo = { text: T("Не вижу файла фото: подключите сцену от Load Image", "Can't see the photo file: wire the scene from Load Image"), err: true }; }
            else {
                sceneInfo = { text: "🖼 " + s.spec.name };
                new THREE.TextureLoader().load(viewUrl(s.spec), (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    photoTex = tex; photoAspect = tex.image.width / tex.image.height;
                    flatBackdrop(); rebuildDepth(false);
                }, undefined, () => setStatus(T("Не удалось открыть фото сцены", "Could not open the scene photo"), "err"));
            }
            refreshPanel(); dirty = true;
        }
        const a = findImage(node, "actor");
        const ai = a.spec ? "🧍 " + a.spec.name : a.wired ? "🧍 " + T("героиня подключена", "actor connected") : "";
        if (ai !== actorInfo) { actorInfo = ai; refreshPanel(); }
    }

    // ---------- сборка ----------
    const PANEL_H = 520;
    const dom = node.addDOMWidget("neron_stage", "neron_stage", root, { serialize: false, hideOnZoom: false });
    makeUserSized(node, dom, root, { minH: 300, autoH: PANEL_H, onLayout: () => { dirty = true; drawTimeline(); } });
    const wanted = node.computeSize ? node.computeSize() : [960, 600];
    node.setSize([Math.max(wanted[0], 960), Math.max(wanted[1], PANEL_H + 120)]);

    applyCamState();
    rebuildMarks();
    replan();
    refreshPanel();
    setView(mode);
    updateHint();
    raf = requestAnimationFrame(frame);
    const inputTimer = setInterval(checkInputs, 1200);
    checkInputs();
    const ro = new ResizeObserver(() => { dirty = true; drawTimeline(); });
    ro.observe(view);

    const onRemoved0 = node.onRemoved;
    node.onRemoved = function () {
        alive = false;
        cancelAnimationFrame(raf);
        clearInterval(inputTimer);
        ro.disconnect();
        ctlView.dispose(); ctlCam.dispose();
        renderer.dispose();
        return onRemoved0?.apply(this, arguments);
    };
    // для автотестов: где на экране сустав / точка (ничего не меняет)
    node.__nsgProbe = {
        joint(j) {
            const r = canvas.getBoundingClientRect();
            const p = joints[j].position.clone().project(mode === "camera" ? stageCam : viewCam);
            return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
        },
        mark(i) {
            const r = canvas.getBoundingClientRect();
            const pt = state.points[i];
            const p = new THREE.Vector3(pt.x, 0, pt.z).project(viewCam);
            return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height];
        },
    };
    // схема загружена из файла — подхватить сохранённое
    node.__nsgLoad = (json) => {
        try { state = normState(JSON.parse(json)); } catch (e) { return; }
        selected = 0;
        applyCamState(); rebuildMarks(); replan(); refreshPanel();
    };
}

app.registerExtension({
    name: "neron.stage",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "NeronStage") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setupStage(this).catch((e) => console.error("[Neron Stage]", e));
            return r;
        };
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const node = this;
            setTimeout(() => {
                const jw = (node.widgets || []).find((w) => w.name === "stage_json");
                if (jw && node.__nsgLoad) node.__nsgLoad(jw.value);
            }, 50);
            return r;
        };
    },
});
