// RU: Один процесс = один язык. Кнопка RU/EN меняет подписи, статусы и оформление сразу.
// EN: One process = one language. The RU/EN button switches labels, statuses and the look together.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE = "NeronH3Engine";

const LABELS = {
  prompt: { ru: "Что происходит в кадре", en: "What happens in the frame" },
  first_frame: { ru: "Первый кадр", en: "Starting frame" },
  last_frame: { ru: "Последний кадр", en: "Ending frame" },
  seconds: { ru: "Длительность, сек", en: "Duration, sec" },
  mode: { ru: "Режим", en: "Mode" },
  seed: { ru: "Зерно", en: "Seed" },
  control_after_generate: { ru: "После генерации", en: "After generate" },
  width: { ru: "Ширина (0 — авто)", en: "Width (0 = auto)" },
  height: { ru: "Высота (0 — авто)", en: "Height (0 = auto)" },
  steps: { ru: "Шаги (0 — авто)", en: "Steps (0 = auto)" },
  previews: { ru: "Промежуточные кадры", en: "Intermediate frames" },
  lang: { ru: "Язык", en: "Language" },
  video_name: { ru: "Имя файла", en: "File name" },
  h3_run: { ru: "▶ Создать видео", en: "▶ Create video" },
  h3_lang: { ru: "RU / EN", en: "RU / EN" },
};

const PALETTES = {
  ru: { bg: "#17120e", node: "#3d3025", head: "#74563f" },
  en: { bg: "#10161b", node: "#26333d", head: "#40586a" },
};

const panel = document.createElement("div");
panel.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:9999;display:none;max-width:560px;padding:8px 10px;border-radius:10px;box-shadow:0 8px 30px #0008;font:13px sans-serif;color:#eee;pointer-events:none";
const panelText = document.createElement("div");
panelText.style.cssText = "margin-bottom:6px;opacity:.85";
const panelImg = document.createElement("img");
panelImg.style.cssText = "display:block;max-width:540px;max-height:260px;border-radius:6px";
panel.append(panelText, panelImg);
document.body.appendChild(panel);

function ourNodes() {
  return (app.graph?._nodes || []).filter((n) => n && n.type === NODE);
}

function langOf(node) {
  const w = node?.widgets?.find((x) => x.name === "lang");
  return String(w?.value || "").toLowerCase().startsWith("en") ? "en" : "ru";
}

function applyLabels(node, lang) {
  for (const w of node.widgets || []) {
    const label = LABELS[w.name];
    if (label) w.label = label[lang];
  }
  for (const name of ["h3_run", "h3_lang"]) {
    const b = node.widgets?.find((x) => x.name === name);
    if (b) b.label = LABELS[name][lang];
  }
  node.setDirtyCanvas?.(true, true);
}

function applyTheme() {
  const nodes = ourNodes();
  const active = nodes.length > 0;
  const lang = active ? langOf(nodes[0]) : "ru";
  const p = PALETTES[lang] || PALETTES.ru;
  let style = document.getElementById("neron-h3-theme");

  if (!active) {
    if (style) style.remove();
    document.body.classList.remove("neron-h3-active");
    for (const n of nodes) { n.color = null; n.bgcolor = null; }
    panel.style.display = "none";
    return;
  }

  document.body.classList.add("neron-h3-active");
  if (!style) {
    style = document.createElement("style");
    style.id = "neron-h3-theme";
    document.head.appendChild(style);
  }
  style.textContent = `body.neron-h3-active { background: ${p.bg} !important; }`;
  for (const n of nodes) { n.color = p.head; n.bgcolor = p.node; }
}

function setLang(node, lang) {
  const w = node.widgets?.find((x) => x.name === "lang");
  if (w) w.value = lang;
  for (const n of ourNodes()) applyLabels(n, lang);
  applyTheme();
  node.setDirtyCanvas?.(true, true);
}

function setup(node) {
  if (node.__h3ready) return;
  node.__h3ready = true;
  const lang = langOf(node);

  const run = node.addWidget("button", "h3_run", LABELS.h3_run[lang], () => {
    try { app.queuePrompt(0, 1); } catch (_) {}
  });
  run.serialize = false;

  const language = node.addWidget("button", "h3_lang", LABELS.h3_lang[lang], () => {
    setLang(node, langOf(node) === "ru" ? "en" : "ru");
  });
  language.serialize = false;

  // RU: кнопки сверху, поля ниже.
  for (const name of ["h3_lang", "h3_run"]) {
    const i = node.widgets.findIndex((w) => w.name === name);
    if (i > 0) node.widgets.unshift(node.widgets.splice(i, 1)[0]);
  }
  applyLabels(node, lang);
  applyTheme();
}

api.addEventListener("neron_h3_status", (event) => {
  const d = event.detail || {};
  const node = ourNodes().find((n) => String(n.id) === String(d.id));
  if (!node) return;
  panel.style.display = "block";
  panel.style.background = (PALETTES[langOf(node)] || PALETTES.ru).node + "f0";
  panelText.textContent = d.text || "";
  if (d.image) panelImg.src = "data:image/jpeg;base64," + d.image;
  node.setDirtyCanvas?.(true, false);
});

app.registerExtension({
  name: "Neron.H3Engine",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE) return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = created ? created.apply(this, arguments) : undefined;
      setup(this);
      return r;
    };
    const configured = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = configured ? configured.apply(this, arguments) : undefined;
      setup(this);
      applyLabels(this, langOf(this));
      applyTheme();
      return r;
    };
    const removed = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      const r = removed ? removed.apply(this, arguments) : undefined;
      queueMicrotask(applyTheme);
      return r;
    };
  },
  async setup() {
    // RU: страховка на случай undo/redo — состояние проверяется, а не предполагается.
    setInterval(applyTheme, 1000);
    applyTheme();
  },
});
