# 🖥 Neron Studio — рабочий стол (прототип / prototype)

**RU.** Рабочий стол Neron внутри ComfyUI: плитки процессов можно тянуть, растягивать, убирать и выравнивать,
плитки живые. Открывается золотой монетой «N» (её можно перетащить в любое место) или в меню **Neron → Neron Studio**.
Закрыть — «✕ В ComfyUI» или Esc. Раскладка запоминается в браузере. **«Открыть»** на плитке загружает настоящий
процесс Neron в ComfyUI новой вкладкой (ваша текущая работа не трогается). Процесса нет — плитка пишет «Не установлено».
Открытый процесс — в оформлении стола: сверху полоса Neron Studio (процесс, «🏠 Стол», «▶ Создать», часы),
ноды «стеклянные» в цветах стола (тема Neron Studio из Neron Theme). Меню, вкладки, мини-карта и кнопки масштаба
прячутся штатными выключателями ComfyUI (режим фокуса и настройки) — остаются холст, фон и полоса.
Оформление живёт только во вкладках, открытых со стола. «✕» на полосе или «✕ В ComfyUI» на столе — обычный ComfyUI,
всё возвращается как было. Нод не добавляет.

**🖼 Свой фон** — фото, гифка или видео на весь экран (перетащить на стол или «🎨 Тема» → «Выбрать файл»), с
затемнением, размытием и «стеклянными» плитками. Файл хранится только в этом браузере.
Видео-фон немного нагружает видеокарту. На мощном компьютере это незаметно; если компьютер слабый или каждая секунда генерации на счету — поставьте фото или гифку.

**🎨 Тема** — те же темы, что у ноды Neron Theme (Графит, Neon, Океан, светлая «Бумага» и др.), или «🔗 Как в
ComfyUI» — стол сам переключается вместе с темой, которую ставит нода Neron Theme.

**EN.** Neron desktop inside ComfyUI: live tiles you can drag, resize, remove and align. Open it with the gold «N»
coin at the bottom left of the canvas or **Neron → Neron Studio** in the menu. Close with «✕ В ComfyUI» or Esc. **Open** on a tile loads the real Neron workflow into ComfyUI in a new tab.
Adds no nodes. **🖼 Own background**: photo, GIF or video, full screen (drop it on the desk), stored only in this browser. A video background uses a little GPU. On a strong PC you won't notice; on a weak one, use a photo or a GIF. **🎨 Theme**: the same themes as the Neron Theme node, or «as in ComfyUI» — follows Neron Theme live.

Установка / install: папку `ComfyUI-NeronStudio` — в `ComfyUI/custom_nodes`, перезапустить ComfyUI.
