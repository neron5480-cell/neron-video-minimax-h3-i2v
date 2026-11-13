// Neron Theme — 🪙 мост для Neron Studio: процесс открыт со стола → холст в оформлении стола.
// id — тема, выбранная на столе («🎨 Тема»): studio-light (светлый, по умолчанию), studio (Аурей) и другие встроенные.
// В режиме стола нода Neron Theme на холсте не главнее: оформление меняют на столе (там же — «Как в ComfyUI»).
import { setStudio, setDesk } from "./nts_engine.js";
import { BUILTIN, normalizeTheme } from "./nts_core.js";

window.__neronThemeVersion = "2026.11.13·12";            // стол показывает её в подсказке монеты — видно, какая загружена
// встроенная тема по id — стол ставит её в ноду темы своих процессов
window.__neronThemeBuiltin = (id) => { const t = BUILTIN.find((b) => b.id === id); return t ? JSON.parse(JSON.stringify(t)) : null; };
// x — id встроенной темы или сама тема (своя тема процесса, сохранённая со стола); desk — процесс открыт со стола
window.__neronThemeStudio = (on, x, desk) => {
    let t = null;
    if (on) {
        if (x && typeof x === "object") { try { t = normalizeTheme(x); } catch (_) { t = null; } }
        if (!t) t = BUILTIN.find((b) => b.id === (x || "studio-light")) || BUILTIN.find((b) => b.id === "studio-light");
    }
    try { setDesk(desk === undefined ? on : desk); setStudio(t); } catch (e) { console.warn("[Neron Theme] studio skin", e); }
    return t;
};
