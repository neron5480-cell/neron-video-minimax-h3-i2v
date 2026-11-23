// Neron Theme — 🪙 мост для Neron Studio: процесс открыт со стола → холст в оформлении стола
// (стеклянные ноды в цветах стола). Если на холсте стоит своя нода Neron Theme — её выбор главнее.
import { setStudio } from "./nts_engine.js";
import { BUILTIN } from "./nts_core.js";

window.__neronThemeStudio = (on) => {
    const t = on ? BUILTIN.find((x) => x.id === "studio") : null;
    try { setStudio(t); } catch (e) { console.warn("[Neron Theme] studio skin", e); }
    return !!t;
};
