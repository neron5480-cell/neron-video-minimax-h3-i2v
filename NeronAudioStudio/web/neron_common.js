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

export { el, createProjectBar };
