# 🎭 Neron H3 Замена героя / Hero Swap

> **dev-сборка / dev build** — проверяется перед выходом в main.

## 🇷🇺 Русский

**Что это.** Тот же клип — танец, камера, фон, свет, звук, — но с человеком с вашего фото.
- **🙂 лицо и причёска** — вся голова с фото (причёска тоже); тело и одежда — из клипа.
- **👤 только лицо** — меняется одно лицо; причёска, тело и одежда остаются из клипа.
- **🧍 весь облик** — новый человек целиком; наряд модель рисует по форме и цвету клипа.

**Как пользоваться** (процесс `workflows/Neron_H3_Swap.json`)
1. **Load Video** — клип. Частота кадров любая: нода сама переведёт его в 24 к/с, скорость движения не изменится.
2. **Load Image** — фото «на кого». Лучше, когда лицо хорошо видно и свет ровный.
3. На ноде выберите, **кого менять** (самого крупного, левого, правого, в центре, всех), **что менять**,
   **качество** (480p или 768p), **длину** и **звук**. Нажмите Run.
4. Окно **«Маска»** показывает две картинки: оранжевым — кого нашла нода; рядом — что увидела модель
   (человек или голова размыты).

**Рецепт (проверен на 16 ГБ).**
1. 480p, 5 с — быстрая проба, около 4 минут. Понравилось — запомните сид (в ⚙ эксперте «управление после
   генерации» = fixed).
2. Тот же сид на 768p — чистовик: резко и естественно, около 11 минут на 5 секунд.

**Размер кадра.** «Качество» 480p / 768p — короткая сторона; форма всегда как у клипа. Входы **width / height**
главнее: кадр будет не больше width × height (форма клипа), «качество» прячется. Больше паспорта H3 не будет.
Сменить форму кадра (вертикальное → широкое) — отдельный шаг, не в этой ноде: так нет швов.

**Пара в кадре.** Одно фото — один человек. Пару меняем за два прогона: сначала «⬅ левый» с фото 1, потом
результат снова подаём в ноду и меняем «➡ правый» с фото 2.

**⚙ Эксперт — главное.**
- **Сила размытия** (0.5 — лучшее по проверкам). 1.0 — больше от фото. 0.4 — смесь оригинала и фото
  («двойник»). На крупном плане (лицо на весь кадр) — не ниже 0.5, иначе лицо теряется.
- **Запас маски:** 0 — авто (лицо 1, весь облик 25). Для всего облика мало не ставь: тонкие пряди оригинала выйдут за маску. Меньше — одежда ближе к клипу, больше — модели свободнее.
- **Точные края** (вкл.) — после генерации SAM находит нового человека, и вклеивается только он: фон вокруг
  остаётся резким, как в клипе.

**Как устроено.** Только родные ноды ComfyUI; наш код — склейка, маски и размытие.
1. **SAM 3.1** (ноды SAM3_Detect / SAM3_VideoTrack / SAM3_TrackToMask) находит человека в первом кадре — или
   его голову с волосами — и ведёт маску по клипу. Где трекер потерял человека, SAM находит его заново рядом с
   прошлым местом; голова и волосы ищутся **на каждом кадре** — наезд и отъезд камеры, повороты и волосы в
   танце маску не срывают.
   Запас маски круглый, по контуру.
2. **Размытие вместо оригинала (идея Романа).** До генерации человек (или голова) в клипе-образце размывается.
   Черт оригинала модели не видно — копировать нечего; свет, цвета одежды и движение остаются. Без этого H3
   повторяла оригинал и брала с фото только цвет. Мы пробовали чёрный и серый силуэт и скелет позы — размытие
   вышло лучше всех: естественнее и чётче.
3. **MiniMax H3 Ref2VA** получает размытый клип как `<Video 1>`, фото как `<Picture 1>`, звук клипа — образцом
   и целью: губы ложатся на песню сами.
4. **Дорисовка по маске:** сэмплер меняет только то, что под маской.
5. **LoRA «Character Swap V1.5»** (Akatz Labs) + турбо-LoRA — 8 шагов, `er_sde` / `normal`, CFG 1.
6. **Точные края:** после генерации SAM ещё раз находит уже нового человека; вклеивается только он (и место
   старого), мягкий переход — снаружи, по фону. Всё остальное — настоящие пиксели клипа.
7. **Звук** — оригинал клипа, байт в байт (или сгенерированный H3 — на выбор).

Память — по очереди, как в Neron H3 Engine: SAM → выгрузка → текст → выгрузка → модель → выгрузка → VAE → SAM.

**Модели** — кнопка **«📥 Модели»** на ноде. Она качает только то, что нужно этой ноде, с докачкой после обрыва:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — модель H3 **Ref2VA** (Comfy-Org). Это **отдельный файл**,
  не тот, что у H3 Story и Engine (`fl2va`): на fl2va замена не работает;
- текстовый энкодер, VAE видео и звука — общие с другими нодами H3 (если уже лежат — не качаются);
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — турбо-LoRA (lightx2v);
- `h3_character_swap_v1.5.safetensors` — LoRA замены (Akatz Labs, лицензия MiniMax H3 Community License; качается
  со страницы автора, мы её не переупаковываем);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1 (Comfy-Org).

**Честно.**
- Проверено на одном клипе с одним фото. На других видео возможны сюрпризы: быстрые движения, профиль, руки
  перед лицом.
- 768p и длинные клипы тяжелы для видеокарты 16 ГБ. Начните с 480p и 5 секунд.
- Длинные клипы окнами (больше 15 с) — в следующей версии.
- Заменяйте себя и тех, кто согласен.

**Нужно:** свежий ComfyUI с поддержкой MiniMax H3 и SAM3.

**Благодарности.** Идея процесса и LoRA замены — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). Их код (H3 Relay, лицензия GPL-3) мы не копировали — механизм написан заново на родных
нодах ComfyUI. Размытие образца и точные края — наши.

---

## 🇬🇧 English

**What it is.** The same clip — dance, camera, background, light, sound — with the person from your photo.
- **🙂 face & hair** — the whole head from the photo (hair too); body and clothes from the clip.
- **👤 face only** — only the face changes; hair, body and clothes stay from the clip.
- **🧍 whole look** — a whole new person; the model draws the outfit following the clip's shape and colors.

**How to use** (workflow `workflows/Neron_H3_Swap.json`)
1. **Load Video** — the clip. Any frame rate: the node converts it to 24 fps without changing the motion speed.
2. **Load Image** — the photo of the new person. Best with the face clearly visible and even light.
3. On the node choose **who** to swap (largest, leftmost, rightmost, center, everyone), **what** to swap,
   **quality** (480p or 768p), **length** and **sound**. Press Run.
4. The **«Mask»** window shows two pictures: in orange — who was found; next to it — what the model saw (the
   person or the head blurred).

**Recipe (tested on 16 GB).**
1. 480p, 5 s — a quick try, about 4 minutes. Like it — keep the seed (⚙ expert «control after generate» = fixed).
2. The same seed at 768p — the final: sharp and natural, about 11 minutes for 5 seconds.

**Frame size.** «Quality» 480p / 768p — the short side; the shape always follows the clip. The **width / height**
inputs win: the frame fits inside width × height (clip shape) and «quality» hides. Never above the H3 passport.
Changing the frame shape (vertical → wide) is a separate step, not in this node: no seams.

**A couple in frame.** One photo — one person. Swap a couple in two runs: first «⬅ leftmost» with photo 1, then
feed the result back and swap «➡ rightmost» with photo 2.

**⚙ Expert — the main things.**
- **Blur strength** (0.5 — best in tests). 1.0 — more of the photo. 0.4 — a mix of the original and the photo
  («look-alike»). On a close-up (face fills the frame) keep 0.5+, or the face is lost.
- **Mask margin:** 0 — auto (face 1, whole look 25). Not low for the whole look: thin strands of the original's hair escape the mask. Less — clothing closer to the clip, more — more freedom.
- **Tight edges** (on) — after generation SAM finds the new person and only they are pasted in: the background
  around stays as sharp as in the clip.

**How it works.** Native ComfyUI nodes only; our code is the glue, the masks and the blur.
1. **SAM 3.1** (SAM3_Detect / SAM3_VideoTrack / SAM3_TrackToMask) finds the person in the first frame — or
   their head with hair — and tracks the mask through the clip. Where the tracker lost the person, SAM finds them
   again next to their last place; the head and hair are found **on every frame** — camera zoom, turns and hair
   flying in a dance do not break the mask. The mask margin is round, following the contour.
2. **Blur instead of the original (Roman's idea).** Before generation the person (or head) in the reference clip
   is blurred. The original's features are hidden — nothing to copy; light, clothing colors and motion stay.
   Without this H3 repeated the original and took only color from the photo. We tried black and gray silhouettes
   and a pose skeleton — blur came out best: more natural and sharper.
3. **MiniMax H3 Ref2VA** gets the blurred clip as `<Video 1>`, the photo as `<Picture 1>`, and the clip's sound
   as a reference and a target: lips follow the song by themselves.
4. **Masked repaint:** the sampler changes only what is under the mask.
5. **«Character Swap V1.5» LoRA** (Akatz Labs) + turbo LoRA — 8 steps, `er_sde` / `normal`, CFG 1.
6. **Tight edges:** after generation SAM finds the new person; only they (and the old person's place) are pasted
   in, with the soft transition outside, on the background. Everything else is the clip's real pixels.
7. **Sound** — the clip's original, byte for byte (or generated by H3 — your choice).

Memory goes in turns, as in Neron H3 Engine: SAM → unload → text → unload → model → unload → VAE → SAM.

**Models** — the **«📥 Models»** button on the node. It downloads only what this node needs, resuming after a drop:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — the H3 **Ref2VA** model (Comfy-Org). A **separate file**,
  not the one H3 Story and Engine use (`fl2va`): swaps do not work on fl2va;
- the text encoder and the video and audio VAEs — shared with the other H3 nodes (skipped if already there);
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — turbo LoRA (lightx2v);
- `h3_character_swap_v1.5.safetensors` — the swap LoRA (Akatz Labs, MiniMax H3 Community License; downloaded from
  the author's page, we do not repackage it);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1 (Comfy-Org).

**Honestly.**
- Tested on one clip with one photo. Other videos may bring surprises: fast moves, profile, hands in front of the
  face.
- 768p and long clips are heavy for a 16 GB GPU. Start with 480p and 5 seconds.
- Long clips in windows (over 15 s) — in the next version.
- Swap yourself and people who agreed.

**Needs:** a recent ComfyUI with MiniMax H3 and SAM3 support.

**Credits.** The workflow idea and the swap LoRA — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). We did not copy their code (H3 Relay, GPL-3) — the mechanism is written anew on native
ComfyUI nodes. The reference blur and tight edges are ours.
