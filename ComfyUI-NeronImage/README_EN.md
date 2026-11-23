# 🖼 Neron Image — text to image (Krea 2)

Russian version: [README.md](README.md).

## Install — three steps

1. Put the `ComfyUI-NeronImage` folder into `ComfyUI/custom_nodes/` (Comfy Desktop has its own custom_nodes folder; open it from the app menu).
2. Restart Comfy Desktop.
3. Open `workflows/Neron_Image_Krea2.json`, press «📥 Models» on the node — it downloads what is missing and puts it in the right folders. Then write what to draw and press Run.

Even easier once the pack shows up in Manager: find **Neron Image — Krea 2** and press Install — updates arrive on their own, no folder swapping.

If Manager says «'neron-image' is not a CNR node», its list is one step behind right after publication. Close and reopen Comfy Desktop once: the list refreshes and Install works. If the `ComfyUI-NeronImage` folder is already in `custom_nodes`, remove it before installing from Manager so you don't get two copies.

The **RU / EN** buttons in the top row of the node switch the whole process: labels, help, model window and the ready workflow.

**The theme is already on.** The process brings its own look and switches it on by itself; you do not need to install a separate theme node. Pick another look with **«🎨 Change look»** in the ⚙ expert section. The small collapsed **«🎨 Theme»** node on the left only keeps the choice — you do not need to touch it. The look follows the language and belongs only to this workflow: open another one and ComfyUI returns to its normal look.

## How to use

One node: write what to draw (in any language) and get a picture up to 2K with **Krea 2 Turbo**. The models are official, from Comfy-Org.

**Always visible:** what to draw · prompter · aspect · quality (1K / 1.5K / **2K**) · sharpness · seed.
**Behind ⚙ expert:** image count, steps, CFG, sampler, prompter settings, style LoRA, keep models loaded, model files.

### Prompter
- **🎨 every detail** (default) — your words stay as written and come first. Everything you did not specify is filled with concrete details: clothing and fabrics, materials, mechanism parts, setting, light, lens, style.
- **✨ expand** — the official Krea instruction: restrained, no invented details.
- **🌐 polish** — translation and light polishing only.
- **✍ as is** — your text goes to the model unchanged.

It is the same Qwen3-VL 4B that encodes text for Krea, so there is nothing extra to download. In «expand» the instruction is the official one (Comfy-Org / Krea) with two changes:
- text in the picture follows the Krea authors' rule: only words in quotes;
- input in any language becomes an English prompt.

The final prompt is shown at the bottom of the node. If the text and mode have not changed, the prompter does not run again. **✏ Edit final prompt** puts the prompt into the text field so you can edit it by hand. Long prompts are easiest in the **📝 Big prompt editor**: it opens from the button under the field, and by itself when you pick «✍ as is». A prompt can also come by wire into the `prompt_text` input.

> ⚠ **Where the prompter falls short** (tested live). It is small (4B) and great for light scenes: one or two characters, a landscape, an object, a machine. A busy scene with many characters, each described separately, is beyond it: the people come out alike, and no instruction tweak fixes that. For such scenes write the prompt yourself (in English) or ask a big AI (Gemini, ChatGPT, Claude…) to describe *every character separately and differently*, then paste its answer with **✍ as is**.

### Example in the ready workflow
`workflows/Neron_Image_Krea2.json` has a green **«📝 Example big prompt»** node. It is **not connected on purpose**: it is a sample of a detailed prompt for a complex scene. To draw it:
1. Connect its `STRING` output to `prompt_text`.
2. Set the prompter to «✍ as is».
3. Use aspect 16:9, quality 2K, sharpness 0.6–0.8.

### Sharpness
After drawing, a gentle unsharp mask makes the edges crisper without adding new detail. The default is **1.0**, tested at 2K. Tune it to the picture:
- close-up portraits — 0.5–0.8, so the skin does not look grainy;
- landscapes, fabric, machines — 1.0–1.3;
- 0 — exactly as the model drew it.

### Models — the «📥 Models» button (Comfy-Org/Krea-2)
- `krea2_turbo_bf16` — 26.3 GB, goes to `models/diffusion_models`;
- `qwen3vl_4b_fp8_scaled` — 4.9 GB, goes to `models/text_encoders`;
- `qwen_image_vae` — 242 MB, goes to `models/vae`.

If bf16 is missing, the node uses a compressed Turbo (fp8 / int8 / nvfp4) when one is present and says so.

**Why Turbo, not RAW.** The Krea authors' advice: «train on RAW, run on Turbo». Turbo is tuned for looks and draws up to 2K in 8 steps. RAW is a base model for training LoRAs: up to 1K, 52 steps, CFG 3.5.

**Recipe** (Krea 2 Turbo authors): 8 steps, CFG 1, euler / simple, shift 1.15. ComfyUI sets the shift itself.

**Krea 2 license:** the authors' community license. Personal use is allowed; commercial use needs a separate license from Krea.
