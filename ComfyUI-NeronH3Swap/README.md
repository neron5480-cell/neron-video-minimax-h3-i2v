# 🎭 Neron H3 Замена героя / Hero Swap

> **dev-сборка / dev build** — проверяется перед выходом в main.

## 🇷🇺 Русский

**Что это.** Тот же клип — танец, камера, фон, свет, звук, — но вместо человека в кадре человек с вашего фото.
Меняется **только человек под маской**. Всё остальное — настоящие пиксели оригинала.

**Как пользоваться** (процесс `workflows/Neron_H3_Swap.json`)
1. **Load Video** — клип. Частота кадров любая: нода сама переведёт его в 24 к/с, скорость движения не изменится.
2. **Load Image** — фото «на кого». Лучше, когда лицо хорошо видно и свет ровный. Для режима «весь облик» нужен
   человек в полный рост.
3. На ноде выберите, **кого менять** (самого крупного, левого, правого, в центре, всех), **что менять** (весь облик
   или только лицо с причёской), **качество** (480p или 768p), **длину** и **звук**. Нажмите Run.
4. Выход **mask_preview** — первый кадр с оранжевой маской. По нему видно, кого нашла нода.

**Пара в кадре.** Одно фото — один человек. Пару меняем за два прогона: сначала «⬅ левый» с фото 1, потом
результат снова подаём в ноду и меняем «➡ правый» с фото 2. Режим «👥 все люди» с одним фото сделает всех одним
человеком.

**С чего начать.** 5 секунд, 480p — проверьте, что замена держится. Потом длиннее (до 15 с) и 768p.
- Лицо не узнаётся — возьмите фото крупнее и чётче; в ⚙ эксперте поставьте «качество фото-образца» = max.
- Обрезаны волосы или край одежды — прибавьте «запас маски».
- Задет фон рядом с человеком — убавьте «запас маски».

**Как устроено.** Только родные ноды ComfyUI; наш код — склейка и маски.
1. **SAM 3.1** (ноды SAM3_Detect / SAM3_VideoTrack / SAM3_TrackToMask) находит человека в первом кадре и ведёт
   его маской по клипу. Кадры, где трекер потерял человека, берут маску соседних кадров. Маска расширяется по
   площади и на ±2 кадра по времени, чтобы влезли волосы, одежда и смаз движения.
2. **Силуэт вместо оригинала (идея Романа, 0.2).** До генерации человек в клипе-образце закрашивается чёрным
   силуэтом. Модели нечего копировать — облик она берёт с фото, а силуэт по-прежнему задаёт движение, место в
   кадре и ритм. Без этого H3 повторяла оригинал и брала с фото только цвет. В ⚙ эксперте — серый силуэт,
   размытие или «оригинал» (как в 0.1, для сравнения).
3. **MiniMax H3 Ref2VA** получает клип с силуэтом как `<Video 1>`, фото как `<Picture 1>`, звук клипа — образцом
   и целью.
4. **Дорисовка по маске:** в латент кладётся закодированный клип (тоже с силуэтом), а маска человека говорит
   сэмплеру менять только то, что под ней.
5. **LoRA «Character Swap V1.5»** (Akatz Labs) учит модель именно замене героя. Турбо-LoRA — 8 шагов,
   `er_sde` / `normal`, CFG 1. Это проверенный рецепт автора LoRA.
6. **Наша правка:** после генерации вне маски вклеиваются настоящие пиксели клипа с мягким краем. Фон совпадает
   с оригиналом точно, а не «почти» после пересчёта через VAE.
7. **Звук** — оригинал клипа, байт в байт (или сгенерированный H3 — на выбор).

Память — по очереди, как в Neron H3 Engine: SAM → выгрузка → текст → выгрузка → модель → выгрузка → VAE.

**Модели** — кнопка **«📥 Модели»** на ноде. Она качает только то, что нужно этой ноде, с докачкой после обрыва:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — модель H3 **Ref2VA** (Comfy-Org). Это **отдельный файл**,
  не тот, что у H3 Story и Engine (`fl2va`): на fl2va замена не работает;
- текстовый энкодер, VAE видео и звука — общие с другими нодами H3 (если уже лежат — не качаются);
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — турбо-LoRA (lightx2v);
- `h3_character_swap_v1.5.safetensors` — LoRA замены (Akatz Labs, лицензия MiniMax H3 Community License; качается
  со страницы автора, мы её не переупаковываем);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1 (Comfy-Org).

**Честно.**
- Модель замены экспериментальная — так пишет и её автор. Лицо, мимика, перекрытия и склейки иногда «плывут»;
  точность движения губ не обещается.
- 768p и длинные клипы тяжелы для видеокарты 16 ГБ: клип идёт в расчёт целиком, рядом с роликом. Начните с 480p
  и 5 секунд.
- Длинные клипы окнами (больше 15 с) — в следующей версии.
- Заменяйте себя и тех, кто согласен.

**Нужно:** свежий ComfyUI с поддержкой MiniMax H3 и SAM3.

**Благодарности.** Идея процесса и LoRA замены — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). Их код (H3 Relay, лицензия GPL-3) мы не копировали — механизм написан заново на родных
нодах ComfyUI, с нашими правками.

---

## 🇬🇧 English

**What it is.** The same clip — dance, camera, background, light, sound — but with the person from your photo
instead of the one in frame. **Only the masked person changes.** Everything else stays the real original pixels.

**How to use** (workflow `workflows/Neron_H3_Swap.json`)
1. **Load Video** — the clip. Any frame rate: the node converts it to 24 fps without changing the motion speed.
2. **Load Image** — the photo of the new person. Best with the face clearly visible and even light. For «whole
   look» use a full-body photo.
3. On the node choose **who** to swap (largest, leftmost, rightmost, center, everyone), **what** to swap (the whole
   look or only face and hair), **quality** (480p or 768p), **length** and **sound**. Press Run.
4. The **mask_preview** output is the first frame with an orange mask: it shows who the node found.

**A couple in frame.** One photo — one person. Swap a couple in two runs: first «⬅ leftmost» with photo 1, then
feed the result back and swap «➡ rightmost» with photo 2. «👥 everyone» with one photo turns everybody into one
person.

**Where to start.** 5 seconds at 480p — check that the swap holds. Then longer (up to 15 s) and 768p.
- Face not recognisable — use a bigger, sharper photo; in ⚙ expert set «photo quality» = max.
- Hair or clothing edges cut off — raise «mask margin».
- Background next to the person touched — lower «mask margin».

**How it works.** Native ComfyUI nodes only; our code is the glue and the masks.
1. **SAM 3.1** (SAM3_Detect / SAM3_VideoTrack / SAM3_TrackToMask) finds the person in the first frame and tracks
   the mask through the clip. Frames where the tracker lost the person take the mask of the nearest frames. The
   mask grows in area and by ±2 frames in time, so hair, clothes and motion blur fit inside.
2. **A silhouette instead of the original (Roman's idea, 0.2).** Before generation the person in the reference
   clip is blanked to a black silhouette. The model has nothing to copy — it takes the look from the photo, while
   the silhouette still drives the motion, position and rhythm. Without this H3 repeated the original and took
   only color from the photo. In ⚙ expert — a gray silhouette, blur or «original» (as in 0.1, for comparison).
3. **MiniMax H3 Ref2VA** gets the silhouette clip as `<Video 1>`, the photo as `<Picture 1>`, and the clip's sound
   as a reference and a target.
4. **Masked repaint:** the latent holds the encoded clip (with the silhouette too), and the person mask tells the
   sampler to change only what is under it.
5. The **«Character Swap V1.5» LoRA** (Akatz Labs) teaches the model to swap characters. Turbo LoRA — 8 steps,
   `er_sde` / `normal`, CFG 1. This is the LoRA author's tested recipe.
6. **Our addition:** after generation the real clip pixels are pasted back outside the mask with a soft edge. The
   background matches the original exactly, not "almost" after a VAE round trip.
7. **Sound** — the clip's original, byte for byte (or generated by H3 — your choice).

Memory goes in turns, as in Neron H3 Engine: SAM → unload → text → unload → model → unload → VAE.

**Models** — the **«📥 Models»** button on the node. It downloads only what this node needs, resuming after a drop:
- `minimax_h3_ref2va_pruned_int8_convrot.safetensors` — the H3 **Ref2VA** model (Comfy-Org). A **separate file**,
  not the one H3 Story and Engine use (`fl2va`): swaps do not work on fl2va;
- the text encoder and the video and audio VAEs — shared with the other H3 nodes (skipped if already there);
- `minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors` — turbo LoRA (lightx2v);
- `h3_character_swap_v1.5.safetensors` — the swap LoRA (Akatz Labs, MiniMax H3 Community License; downloaded from
  the author's page, we do not repackage it);
- `sam3.1_multiplex_fp16.safetensors` — SAM 3.1 (Comfy-Org).

**Honestly.**
- The swap model is experimental — its author says so too. Face, expressions, occlusions and cuts can drift; exact
  lip sync is not promised.
- 768p and long clips are heavy for a 16 GB GPU: the whole clip goes into the computation next to the result. Start
  with 480p and 5 seconds.
- Long clips in windows (over 15 s) — in the next version.
- Swap yourself and people who agreed.

**Needs:** a recent ComfyUI with MiniMax H3 and SAM3 support.

**Credits.** The workflow idea and the swap LoRA — [Akatz Labs](https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA)
(«H3 Character Swap»). We did not copy their code (H3 Relay, GPL-3) — the mechanism is written anew on native
ComfyUI nodes, with our own changes.
