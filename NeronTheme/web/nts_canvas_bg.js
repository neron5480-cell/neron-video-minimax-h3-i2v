// ============================================================================
//  Neron Theme — 🖼 фон под холстом / background under the canvas
//  RU: Тот же фон, что на рабочем столе Neron Studio (фото, гифка или видео), — под нодами ComfyUI.
//      Устроено как официальная настройка ComfyUI «Canvas background image»: холст становится прозрачным,
//      а под ним — наш слой (картинка или видео + затемнение, чтобы провода и ноды читались).
//      Файл хранится только в этом браузере (его кладёт Neron Studio). Выключили — всё как было.
//  EN: The Neron Studio desktop background (photo, GIF or video) under the ComfyUI canvas, the same way the
//      official «Canvas background image» setting works: transparent canvas + our layer underneath.
// ============================================================================
import { app } from "../../scripts/app.js";

const SET_KEY = "neron-studio-bg-settings";
const S = { on: false, prev: null, layer: null, img: null, vid: null, dim: null, url: null, fileKey: "", timer: 0 };

function settings() {
    try { return { canvas: true, dim: 0.45, blur: 0, ...(JSON.parse(localStorage.getItem(SET_KEY) || "{}")) }; }
    catch (_) { return { canvas: true, dim: 0.45, blur: 0 }; }
}

function idbFile() {
    return new Promise((ok) => {
        try {
            const r = indexedDB.open("neron-studio", 1);
            r.onupgradeneeded = () => r.result.createObjectStore("bg");
            r.onerror = () => ok(null);
            r.onsuccess = () => {
                try {
                    const g = r.result.transaction("bg").objectStore("bg").get("file");
                    g.onsuccess = () => ok(g.result || null);
                    g.onerror = () => ok(null);
                } catch (_) { ok(null); }
            };
        } catch (_) { ok(null); }
    });
}

function themeBg() {
    const E = window.__neronThemeEngine, t = E?.applied || E?.current || E?.studio;
    return t?.c?.bg || getComputedStyle(document.body).getPropertyValue("--bg-color").trim() || "#111111";
}

function makeLayer() {
    if (S.layer) return;
    S.layer = document.createElement("div");
    S.layer.id = "neron-canvas-bg";
    // z-index:-1 — под всем интерфейсом ComfyUI, но над фоном страницы
    S.layer.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;";
    const media = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.04);";
    S.img = document.createElement("img"); S.img.alt = ""; S.img.style.cssText = media; S.img.hidden = true;
    S.vid = document.createElement("video"); S.vid.muted = true; S.vid.loop = true; S.vid.playsInline = true; S.vid.autoplay = true;
    S.vid.style.cssText = media; S.vid.hidden = true;
    S.dim = document.createElement("div"); S.dim.style.cssText = "position:absolute;inset:0;";
    S.layer.append(S.img, S.vid, S.dim);
    document.body.prepend(S.layer);
}

function canvasTransparent(on) {
    const cv = app.canvas;
    if (!cv) return;
    if (on) {
        if (!S.prev) S.prev = { clear: cv.clear_background_color, image: cv.background_image };
        if (cv.clear_background_color !== "transparent" || cv.background_image) {
            cv.clear_background_color = "transparent";
            cv.background_image = null;          // сетку не рисуем поверх фото — фон и есть «стол»
            cv._pattern = undefined;
            cv.setDirty?.(true, true);
        }
    } else if (S.prev) {
        cv.clear_background_color = S.prev.clear;
        cv.background_image = S.prev.image;
        cv._pattern = undefined;
        S.prev = null;
        cv.setDirty?.(true, true);
    }
}

async function sync() {
    const st = settings();
    const rec = st.canvas ? await idbFile() : null;
    if (!rec || !rec.blob) {
        if (S.on) {
            S.on = false;
            if (S.layer) S.layer.hidden = true;
            if (S.vid) { S.vid.pause(); S.vid.removeAttribute("src"); }
            if (S.url) { URL.revokeObjectURL(S.url); S.url = null; }
            S.fileKey = "";
            canvasTransparent(false);
            // вернуть фон темы: двигатель темы перекрасит при следующем обновлении
            try { const E = window.__neronThemeEngine; if (E) { E.bk && (E.bk.userBg = false); E.sig = ""; } } catch (_) {}
        }
        return;
    }
    makeLayer();
    const key = `${rec.name}|${rec.blob.size}|${rec.type}`;
    if (key !== S.fileKey) {
        if (S.url) URL.revokeObjectURL(S.url);
        S.url = URL.createObjectURL(rec.blob);
        S.fileKey = key;
        const video = String(rec.type).startsWith("video/");
        S.img.hidden = video; S.vid.hidden = !video;
        if (video) { S.vid.src = S.url; S.vid.play().catch(() => {}); S.img.removeAttribute("src"); }
        else { S.img.src = S.url; S.vid.pause(); S.vid.removeAttribute("src"); }
    }
    const blur = Math.max(0, Number(st.blur) || 0);
    S.img.style.filter = S.vid.style.filter = blur ? `blur(${blur}px)` : "";
    S.dim.style.background = themeBg();
    S.dim.style.opacity = String(Math.max(0, Math.min(0.9, Number(st.dim ?? 0.45))));
    S.layer.hidden = false;
    S.on = true;
    canvasTransparent(true);
}

app.registerExtension({
    name: "Neron.Theme.CanvasBackground",
    async setup() {
        // Neron Studio сообщает о смене фона; настройки меняются в том же браузере — ловим и событие хранилища
        addEventListener("message", (e) => { if (e?.data?.neronStudio === "bg-changed") sync(); });
        addEventListener("storage", (e) => { if (e.key === SET_KEY) sync(); });
        addEventListener("neron-theme", () => { if (S.on && S.dim) S.dim.style.background = themeBg(); });
        // палитра ComfyUI или тема могли вернуть цвет холста — держим прозрачным, пока фон включён
        S.timer = setInterval(() => { if (S.on) canvasTransparent(true); }, 1500);
        setTimeout(sync, 300);
    },
});
