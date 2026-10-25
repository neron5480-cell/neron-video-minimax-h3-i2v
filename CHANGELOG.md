# Changelog / История изменений

## 2026-10-25 — Neron Audio Studio: размер нод и индикаторы уровня / node size and level meters

**RU:**
- **Размер задаёт пользователь** у Piano Roll, Drum Machine, Микшера, Audio Loader и Video Combine. Раньше высота была жёсткой (Piano Roll был огромным и не уменьшался). Теперь ноду можно растянуть или сжать: содержимое подстраивается, лишнее прокручивается, размер запоминается в схеме. Пока ноду не трогали, она, как раньше, подстраивается сама. Правый клик → «↕ Авто-размер» возвращает подгонку.
- **Индикаторы уровня в Микшере:** прыгающие столбики у каждого канала (левый и правый) и общий L/R рядом с MASTER. Зелёный — нормально, жёлтый — громко, красный — перегруз; пиковая метка держится секунду. Пока звук не играет, индикаторы ничего не нагружают.
- Исправлено: «Поле» и Audio Loader использовали одинаковые имена стилей и могли портить вид друг другу на одной схеме.

**EN:**
- **The user sets the size** of Piano Roll, Drum Machine, Mixer, Audio Loader and Video Combine. The height used to be fixed (Piano Roll was huge and could not shrink). Now the content adapts and scrolls, the size is saved in the workflow; an untouched node still fits itself. Right click → "↕ Auto size" restores fitting.
- **Level meters in the Mixer:** bouncing bars per channel (left and right) and a master L/R meter next to MASTER. Green — fine, yellow — loud, red — clipping; the peak mark holds for a second. No load while nothing plays.
- Fixed: the Field and the Audio Loader shared style names and could spoil each other's look on one canvas.

## 2026-10-25 — Neron Audio Studio: новая нода «Поле» / new node "Field"

**RU:**
- **Neron Field / Поле** — общее поле в духе Playlist из FL Studio. На холсте — маленькая карточка (картинка, обзор, ▶ / ■, «Открыть»), которую можно растягивать как угодно. Большое окно открывается поверх всего, двигается, тянется, разворачивается на весь экран и помнит своё место.
- **Видео:** до 3 роликов. Ролик сдвигается мышкой или по кадру (◀ / ▶, стрелки), два разделителя решают, где какой ролик идёт. Склейка или наплыв. Где у ролика нет кадров — красная штриховка (в итоге чёрный экран). Родной звук роликов режется по тем же разделителям и выключается кнопкой M.
- **Звук:** куски из файлов и из нод студии (входы `audio_N`). Двигать, переносить между дорожками, обрезать, резать (S), копия (Ctrl+D), появление и затухание, громкость куска; у дорожки M, S, громкость, баланс. Прилипание к краям и разделителям. Отмена и повтор.
- Файлы можно просто перетащить на окно. Слушать и смотреть — сразу, без Queue.
- **💾 СОБРАТЬ** сохраняет WAV и mp4 (H.264 CRF 17) без Queue; Queue отдаёт `audio`, `video`, `fps`, `seconds`. Итог точен до кадра и ровно по длине видео.
- Микшер слышит Поле сразу, без Queue.
- Пока окно Поля активно, клавиши не уходят в ComfyUI: Ctrl+Z не откатывает граф, Delete не удаляет ноду.
- **Оптимизация:** все ноды студии теперь используют один общий звуковой движок на страницу (раньше у каждой был свой). Окно Поля ничего не рисует, пока закрыто; во время игры двигается только курсор.

**EN:**
- **Neron Field** — a shared field in the spirit of the FL Studio Playlist. On the canvas: a small, freely resizable card (picture, overview, ▶ / ■, "Open"). The big window opens above everything; it can be moved, resized, made full screen and remembers its place.
- **Video:** up to 3 clips, shifted by mouse or frame by frame; two dividers decide which clip plays where; cut or dissolve. Missing frames are shown with red stripes (black in the result). The clips' own sound follows the same dividers and can be muted.
- **Sound:** pieces from files and from studio nodes (`audio_N` inputs): move, move between tracks, trim, split, copy, fades, piece volume; tracks have M, S, volume, pan. Snapping, undo / redo.
- Drop files onto the window. Watch and listen at once, no Queue.
- **💾 BUILD** saves WAV and mp4 without Queue; Queue outputs `audio`, `video`, `fps`, `seconds`. Frame-accurate, exactly as long as the video.
- The Mixer hears the Field without Queue.
- While the Field window is focused, keys stay in it: Ctrl+Z does not undo the graph, Delete does not delete the node.
- **Performance:** all studio nodes now share one audio engine per page. The Field window draws nothing while closed; during playback only the cursor moves.

## 2026-10-23 — Perception Relay: защита от нехватки памяти / out-of-memory guard

**RU:** Если выход «кадры» (`frames_out`) не влезает в оперативку (нужно больше половины свободной), Пульт его пропускает вместо вылета; готовый ролик сохраняется в файл, в отчёте — пояснение.

**EN:** If the `frames_out` output would not fit in RAM (more than half of the free memory), the Pult skips it instead of crashing; the final video is still saved to a file and the report explains why.

## 2026-10-23 — Perception Relay: место на диске / disk space

**RU:** Рабочие папки задач (~5 ГБ на 10 с видео) больше не копятся бесконечно. Хранятся только 2 последних ролика, старые удаляются сами после прогона; файлы этапов, которых нет в цепочке, тоже удаляются. Готовые видео и отчёты не трогаются. Настройка: `output/perception_relay/settings.json` → `keep_jobs`.

**EN:** Work folders (~5 GB per 10 s of video) no longer pile up. Only the 2 most recent clips keep them, older ones are deleted after a run, and stage files no longer in the chain are removed. Final videos and reports are untouched. Setting: `output/perception_relay/settings.json` → `keep_jobs`.

## 2026-10-23 — Perception Relay: растягивание Пульта / Pult resizing

**RU:** Пульт больше не «борется» с мышью. Раньше при растягивании нода сама возвращала свою высоту, и раскладка разваливалась (окно уезжало, внизу оставалось пустое поле). Теперь размер задаёте вы: окно заполняет всё свободное место, кадр вписывается с сохранением пропорций. Размер запоминается в схеме и не меняется при включении режима эксперта. Новая нода, пока её не трогали руками, по-прежнему подстраивается под кадр сама.

**EN:** The Pult no longer fights the mouse. It used to snap its height back while being resized, breaking the layout (the window shifted, an empty area stayed below). Now you own the size: the live window fills the free space and the frame keeps its aspect ratio. The size is saved in the workflow and is kept when expert mode is toggled. A new, untouched node still fits itself to the frame.

## 2026-10-23 — порядок в репозитории / repository cleanup

### 🇷🇺 Что изменилось

**Установка**
- Весь репозиторий теперь ставится **одной ссылкой**: ComfyUI Manager → Install via Git URL. Раньше ComfyUI после такой установки не видел ни одной ноды.
- Добавлен корневой загрузчик (`__init__.py`). Он находит все ноды, подключает их оформление и пропускает ноды, которые уже стоят отдельно. При ручной установке он не участвует.
- Добавлен общий `requirements.txt` (`imageio-ffmpeg`, `soundfile`): Manager поставит их сам.

**Переименования**
| Было | Стало | Почему |
|---|---|---|
| `NeronH3Engine Full/` | `ComfyUI-NeronH3Engine/` | пробел в имени папки мешает ссылкам и установке |
| `Neron_Studio_H3/ComfyUI-Interactive-Processor/` | `Neron_Studio_H3/NeronStudio-Image-Processor/` | совпадало с самостоятельной нодой в корне: одна папка затирала другую |
| `Neron_Studio_H3/neron_dialog_autoprompter/` | `Neron_Studio_H3/NeronStudio-AutoPrompter/` | то же самое |
| нода `InteractiveImageProcessor` (в студии) | нода `NeronStudioImageProcessor` | две разные ноды носили одно имя |
| `workflow/фотошоп.json` | `workflow/Neron_Restore_Studio_Photoshop.json` | русские буквы в имени файла ломаются в архивах |
| `NeronH3Engine Full.json` | `Neron_H3_Engine.json` | без пробелов |

**Исправления**
- Студийный AutoPrompter больше не регистрирует Dialog Autoprompter и Multi-Image LLM: их регистрирует самостоятельная нода из корня. Раньше обе копии занимали одни и те же адреса `/neron_dialog/*`, и одна из них работала не так, как ожидалось.
- У студийного Image Processor своё имя расширения интерфейса: раньше две копии с одним именем мешали друг другу.
- Старые сохранения студийного пайплайна открываются как раньше: нода сама переводится на новое имя.
- Dialog Autoprompter находит `ComfyUI-LLM-text-processor` и при установке через Manager.
- Из `requirements.txt` автопромтера убран `torch`: его нельзя ставить поверх ComfyUI Desktop.
- AudioStudio получил свой `requirements.txt` (`soundfile`, `imageio-ffmpeg`): раньше `soundfile` не был указан нигде.
- Добавлены README на двух языках для Lora Selector, Static Camera, Interactive Processor и студийного AutoPrompter, раздел установки в README H3 Engine и Neron Studio.

**Что не тронуто**
- Код самих нод (генерация, обработка, интерфейс) не менялся.
- Самостоятельные ноды в корне и их воркфлоу v1.0 / v2.0 работают как раньше.

### 🇬🇧 What changed

**Installation**
- The whole repository now installs with **one link**: ComfyUI Manager → Install via Git URL. Before, ComfyUI saw no nodes after such an install.
- Added a root loader (`__init__.py`). It finds all nodes, registers their UI and skips nodes already installed on their own. It is not involved in a manual install.
- Added a shared `requirements.txt` (`imageio-ffmpeg`, `soundfile`): Manager installs them automatically.

**Renames**
| Was | Now | Why |
|---|---|---|
| `NeronH3Engine Full/` | `ComfyUI-NeronH3Engine/` | the space in the folder name gets in the way of links and installs |
| `Neron_Studio_H3/ComfyUI-Interactive-Processor/` | `Neron_Studio_H3/NeronStudio-Image-Processor/` | same name as the standalone root node: one folder overwrote the other |
| `Neron_Studio_H3/neron_dialog_autoprompter/` | `Neron_Studio_H3/NeronStudio-AutoPrompter/` | same reason |
| node `InteractiveImageProcessor` (Studio) | node `NeronStudioImageProcessor` | two different nodes had one id |
| `workflow/фотошоп.json` | `workflow/Neron_Restore_Studio_Photoshop.json` | Cyrillic file names break in archives |
| `NeronH3Engine Full.json` | `Neron_H3_Engine.json` | no spaces |

**Fixes**
- The Studio AutoPrompter no longer registers Dialog Autoprompter and Multi-Image LLM: the standalone root node does. Before, both copies took the same `/neron_dialog/*` routes.
- The Studio Image Processor has its own UI extension name: before, two copies with one name got in each other's way.
- Old Studio pipeline saves open as before: the node switches to the new id by itself.
- Dialog Autoprompter finds `ComfyUI-LLM-text-processor` when installed via Manager too.
- Removed `torch` from the autoprompter `requirements.txt`: it must not be installed over ComfyUI Desktop.
- AudioStudio got its own `requirements.txt` (`soundfile`, `imageio-ffmpeg`): `soundfile` was not listed anywhere before.
- Added bilingual READMEs for Lora Selector, Static Camera, Interactive Processor and the Studio AutoPrompter, plus install sections in the H3 Engine and Neron Studio READMEs.

**Untouched**
- The nodes' own code (generation, processing, UI) did not change.
- The standalone root nodes and their v1.0 / v2.0 workflows work as before.
