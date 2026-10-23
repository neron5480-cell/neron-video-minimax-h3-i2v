# Changelog / История изменений

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
