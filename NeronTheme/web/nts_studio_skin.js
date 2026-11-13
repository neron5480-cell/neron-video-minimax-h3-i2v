// Neron Theme — 🪙 мост для Neron Studio: процесс открыт со стола → холст в оформлении стола.
// id — тема, выбранная на столе («🎨 Тема»): studio-light (светлый, по умолчанию), studio (Аурей) и другие встроенные.
// В режиме стола нода Neron Theme на холсте не главнее: оформление меняют на столе (там же — «Как в ComfyUI»).
import { setStudio } from "./nts_engine.js";
import { BUILTIN } from "./nts_core.js";

window.__neronThemeVersion = "2026.11.13·8";            // стол показывает её в подсказке монеты — видно, какая загружена
window.__neronThemeStudio = (on, id) => {
    const t = on ? (BUILTIN.find((x) => x.id === (id || "studio-light")) || BUILTIN.find((x) => x.id === "studio-light")) : null;
    try { setStudio(t); } catch (e) { console.warn("[Neron Theme] studio skin", e); }
    return t;
};
