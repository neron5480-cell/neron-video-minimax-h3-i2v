# 🎭 Neron H3 Замена героя / Hero Swap

> **⚠ ОТКАЗ ОТ ОТВЕТСТВЕННОСТИ. АВТОР НЕ НЕСЁТ ОТВЕТСТВЕННОСТИ ЗА ИСПОЛЬЗОВАНИЕ ЭТОГО ИНСТРУМЕНТА И ЗА СОЗДАННЫЙ С ЕГО
> ПОМОЩЬЮ КОНТЕНТ — В ТОМ ЧИСЛЕ ФЕЙКИ, ПОДМЕНУ ЛИЧНОСТИ И ЭРОТИЧЕСКИЙ КОНТЕНТ. ЭТО ТОЛЬКО ИНСТРУМЕНТ. ВСЯ
> ОТВЕТСТВЕННОСТЬ — НА ПОЛЬЗОВАТЕЛЕ. ИСПОЛЬЗУЙТЕ ТОЛЬКО С СОГЛАСИЯ ЛЮДЕЙ НА ФОТО И В ВИДЕО И В РАМКАХ ЗАКОНА.**
>
> **⚠ DISCLAIMER. THE AUTHOR IS NOT RESPONSIBLE FOR HOW THIS TOOL IS USED OR FOR CONTENT MADE WITH IT, INCLUDING
> DEEPFAKES, IDENTITY SUBSTITUTION AND EROTIC CONTENT. IT IS ONLY A TOOL. ALL RESPONSIBILITY LIES WITH THE USER. USE IT
> ONLY WITH THE CONSENT OF THE PEOPLE IN THE PHOTO AND VIDEO AND WITHIN THE LAW.**

> dev-сборка / dev build — на тесте.

## 🇷🇺 Русский

**Что делает.** Меняет человека в клипе на человека с фото. Движение, камера, свет и звук — из клипа.
- **🧍 весь облик** — человек целиком с фото; одежда по форме и цвету клипа.
- **🙂 лицо и причёска** — голова с фото (с волосами); тело и одежда — из клипа.
- **👤 только лицо** — лицо с фото; причёска, тело и одежда — из клипа.

**Как пользоваться** (процесс `workflows/Neron_H3_Swap.json`)
1. **Load Video** — клип. Любая частота кадров: нода переводит в 24 к/с без изменения скорости.
2. **Load Image** — фото: лицо хорошо видно, ровный свет; для «весь облик» — в полный рост.
3. На ноде: кого менять, что менять, качество, длина. **Run.**
4. Окно **«Маска»**: слева — кого нашла нода (оранжевым), справа — что получила модель (размытый образец).

**Время** (RTX 5070 Ti 16 ГБ, 5 с клипа): 480p — 5–7 мин. 768p — заметно дольше, резче. Порядок работы: проба на 480p →
понравился сид (⚙ «управление после генерации» = fixed) → тот же сид на 768p.

**Умолчания** (проверены прогонами):
- **рисовать = 🤖 авто**: весь облик → «весь кадр», лицо и лицо с причёской → «только человека»;
- **быстрое внимание = выкл** — чище, время почти то же;
- **сила размытия = 0.5**; **запас маски = 0 (авто)**: голова и лицо — 1 пикс., весь облик — 25.

**⚙ Эксперт — настройки**
- **Сила размытия (0.4–1.0).** Насколько размыт оригинал в образце. 0.5 — норма; 1.0 — ещё больше от фото; 0.4 —
  смесь оригинала и фото. На крупном плане — не ниже 0.5.
- **Рисовать.** 🎯 только человека — вокруг остаются пиксели клипа. 🖼 весь кадр — модель рисует кадр целиком: нет
  краёв и ореола, фон нарисован заново (очень похож); для лица может взять с фото и причёску, и одежду.
- **Быстрое внимание INT8.** Вкл — легче для памяти, но бывают огрехи и возврат к оригиналу.
- **Запас маски.** Больше — модели свободнее (пышная причёска, банты); меньше — ближе к клипу.
- **Точные края** (вкл). После генерации SAM находит нового человека и вклеивает только его; фон вокруг — пиксели клипа.
- **Качество фото-образца.** match — быстрее; max — лицо узнаётся лучше, медленнее.
- **Входы width / height.** Кадр не больше width × height, форма — как у клипа; «качество» отключается.

**Подгонка под фото и клип.** Одной настройки на все фото и видео нет. Сравнивайте на одном сиде (fixed).

| Что видно | Что поменять |
|---|---|
| тень, «призрак» вокруг всей фигуры | рисовать = 🖼 весь кадр |
| лицо «подмешивается», мелкие огрехи | быстрое внимание = выкл |
| «только лицо» берёт с фото причёску и одежду | рисовать = 🎯 только человека |
| пышная причёска, банты, заколки срезаны («лицо и причёска») | запас маски 25–40 |
| подбородок или шея не на месте | сообщите: правится в самой ноде |

**Как устроено**
1. **SAM 3.1** (родные ноды SAM3) находит человека в первом кадре и ведёт маску по клипу; потерянные кадры находит
   заново. Голова, волосы и лицо ищутся на каждом кадре. Подбородок продлевается вниз (SAM обрезает его).
2. **Размытие образца.** Человек (или голова, лицо) в клипе размывается: черт оригинала модель не видит, свет, цвета и
   движение остаются. Сила подстраивается под крупность плана на каждом кадре. Чёрный, серый силуэт и скелет позы
   модель копирует буквально — поэтому размытие.
3. **Фото** — человек вырезается на ровный серый фон: фон фото не попадает в кадр.
4. **MiniMax H3 Ref2VA**: размытый клип — `<Video 1>`, фото — `<Picture 1>`, звук клипа — образец (губы ложатся на звук).
5. **LoRA Character Swap V1.5** + турбо-LoRA: 8 шагов, `er_sde` / `normal`, CFG 1.
6. **Сборка.** «Только человека»: перерисовывается зона маски, вне её — пиксели клипа, при неподвижной камере — чистый
   фон, собранный из клипа. «Весь кадр»: модель рисует кадр целиком.
7. **Звук** — оригинал клипа, байт в байт (или звук H3 — на выбор).

Память — по очереди: SAM → выгрузка → текст → выгрузка → модель → выгрузка → VAE → SAM. Клип читается только на нужную
длину.

**Модели** — кнопка **«📥 Модели»** на ноде; качает только недостающее, с докачкой:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — H3 **Ref2VA** (отдельный файл, не `fl2va` от H3 Story / Engine);
- текстовый энкодер, VAE видео и звука — общие с нодами H3;
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — турбо-LoRA;
- `h3_character_swap_v1.5.safetensors` — LoRA замены (Akatz Labs, MiniMax H3 Community License; со страницы автора);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1.

**Ограничения**
- Клип — до 15 с за прогон.
- Пара в кадре — два прогона: «⬅ левый» с фото 1, затем результат — «➡ правый» с фото 2.
- Быстрые движения, профиль, руки перед лицом — возможны огрехи.
- 768p и длинные клипы тяжелы для 16 ГБ.

**Нужно:** свежий ComfyUI с поддержкой MiniMax H3 и SAM3.

**Благодарности.** Идея процесса и LoRA замены — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). Их код (H3 Relay, GPL-3) не копировался: механизм написан на родных нодах ComfyUI.

---

## 🇬🇧 English

**What it does.** Replaces the person in a clip with the person from a photo. Motion, camera, light and sound come from
the clip.
- **🧍 whole look** — the whole person from the photo; clothing follows the clip's shape and colors.
- **🙂 face & hair** — the head from the photo (with hair); body and clothes from the clip.
- **👤 face only** — the face from the photo; hair, body and clothes from the clip.

**How to use** (workflow `workflows/Neron_H3_Swap.json`)
1. **Load Video** — the clip. Any frame rate: the node converts to 24 fps without changing the speed.
2. **Load Image** — the photo: face clearly visible, even light; full body for «whole look».
3. On the node: who, what, quality, length. **Run.**
4. The **«Mask»** window: left — who was found (orange), right — what the model got (the blurred reference).

**Time** (RTX 5070 Ti 16 GB, 5 s clip): 480p — 5–7 min. 768p — noticeably longer, sharper. Workflow: try at 480p → keep
the seed you like (⚙ «control after generate» = fixed) → the same seed at 768p.

**Defaults** (tested):
- **draw = 🤖 auto**: whole look → «whole frame», face and face & hair → «person only»;
- **fast attention = off** — cleaner, about the same time;
- **blur strength = 0.5**; **mask margin = 0 (auto)**: head and face — 1 px, whole look — 25.

**⚙ Expert — settings**
- **Blur strength (0.4–1.0).** How blurred the original is in the reference. 0.5 — normal; 1.0 — even more from the
  photo; 0.4 — a mix of original and photo. On a close-up keep 0.5+.
- **Draw.** 🎯 person only — the clip's pixels stay around. 🖼 whole frame — the model paints the full frame: no edges or
  halo, the background is re-painted (very close); for a face it may take the hair and clothes from the photo too.
- **Fast attention INT8.** On — lighter on memory, but glitches and drifting back to the original happen.
- **Mask margin.** More — more room for the model (big hair, bows); less — closer to the clip.
- **Tight edges** (on). After generation SAM finds the new person and only they are pasted in; the background around is
  the clip's pixels.
- **Photo quality.** match — faster; max — better likeness, slower.
- **width / height inputs.** The frame fits inside width × height with the clip's shape; «quality» is ignored.

**Fitting your photo and clip.** No single setting fits every photo and video. Compare on one seed (fixed).

| What you see | What to change |
|---|---|
| a shadow, a «ghost» around the whole figure | draw = 🖼 whole frame |
| the face «blends», small glitches | fast attention = off |
| «face only» takes the hair and clothes from the photo | draw = 🎯 person only |
| big hair, bows, clips are cut («face & hair») | mask margin 25–40 |
| the chin or neck is off | report it: it is tuned inside the node |

**How it works**
1. **SAM 3.1** (native SAM3 nodes) finds the person in the first frame and tracks the mask; lost frames are found again.
   Head, hair and face are searched on every frame. The chin is extended down (SAM cuts it).
2. **Reference blur.** The person (or head, face) in the clip is blurred: the model cannot see the original's features,
   while light, colors and motion stay. The strength follows the shot size on every frame. Black or gray silhouettes and
   a pose skeleton are copied literally by the model — hence the blur.
3. **Photo** — the person is cut out onto flat gray: the photo's background does not get into the frame.
4. **MiniMax H3 Ref2VA**: the blurred clip — `<Video 1>`, the photo — `<Picture 1>`, the clip's sound — a reference (lips
   follow the sound).
5. **Character Swap V1.5 LoRA** + turbo LoRA: 8 steps, `er_sde` / `normal`, CFG 1.
6. **Compositing.** «Person only»: the mask zone is repainted, outside it — the clip's pixels; with a still camera — a
   clean background assembled from the clip. «Whole frame»: the model paints the full frame.
7. **Sound** — the clip's original, byte for byte (or H3's sound — your choice).

Memory goes in turns: SAM → unload → text → unload → model → unload → VAE → SAM. Only the needed length of the clip is read.

**Models** — the **«📥 Models»** button on the node; downloads only what is missing, with resume:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — H3 **Ref2VA** (a separate file, not the `fl2va` of H3 Story / Engine);
- the text encoder, video and audio VAEs — shared with the H3 nodes;
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — turbo LoRA;
- `h3_character_swap_v1.5.safetensors` — swap LoRA (Akatz Labs, MiniMax H3 Community License; from the author's page);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1.

**Limits**
- Up to 15 s of clip per run.
- A couple in frame — two runs: «⬅ leftmost» with photo 1, then the result — «➡ rightmost» with photo 2.
- Fast moves, profile, hands in front of the face — glitches are possible.
- 768p and long clips are heavy for 16 GB.

**Needs:** a recent ComfyUI with MiniMax H3 and SAM3 support.

**Credits.** The workflow idea and the swap LoRA — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). Their code (H3 Relay, GPL-3) was not copied: the mechanism is built on native ComfyUI nodes.
