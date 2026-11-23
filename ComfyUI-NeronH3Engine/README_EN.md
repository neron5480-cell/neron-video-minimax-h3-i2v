# 🌀 Neron H3 Engine — MiniMax H3 engine

Russian version: [README.md](README.md).
## Install

1. Put the `ComfyUI-NeronH3Engine` folder into `ComfyUI/custom_nodes/`. Comfy Desktop has its own `custom_nodes` folder; open it from the app menu.
2. Restart Comfy Desktop.
3. Open `workflows/Neron_H3_Engine.json`. Nothing else to set up: models are found automatically and missing files resume downloading.

ComfyUI **0.46.2 or newer** is required.

## How to use

The workflow has one node, **one data-bus input** and **one output — the last frame**. Everything else lives inside the node panel.

- **RU / EN** switches the whole process: labels, statuses, help and colours. The look follows this workflow and leaves when it is gone. Other processes are untouched.
- **Preset** is a quick choice: ordinary, fast, quality, cinema, seam. Moving a slider afterwards overrides the preset.
- **Size** is standard (auto, 16:9, 9:16, 1:1, 4:3, 3:2) or **custom**: turn on «Custom size» and move the width and height sliders. Exact numbers and steps stay under **⚙ expert**.
- **Sliders** set duration and sharpness. Sharpness stays visible even when the engine runs from the bus.
- **⚙ expert** is not only numbers. It holds the main diffusion model, text encoder, video and audio VAE, turbo LoRA and up to five extra LoRAs. Each extra LoRA has its own on/off switch, file and weight from −3 to 3; enabled LoRAs are applied to the model in order. A file that does not fit is skipped and the rest keep working. If you change nothing, everything stays on default — exactly like the tested ready workflow.
- **Four frame windows.** Drop pictures into First, Middle 1, Middle 2 and Last. There are no separate frame wires any more.
- **Data bus.** Connect an external block to the single input and the panel turns bare: prompt, frames, size and duration arrive on the bus; only quality, sharpness, progress, video and expert remain. Priority: bus, then manual, then preset.
- **Last frame** is the only output. Feed it into the next run or back into the autoprompter to continue the same scene.
- **Duration** runs from 5 to 15 seconds. Shorter clips are not supported; 24 fps and native stereo audio.
- **Sharpness** is applied to finished frames before saving. `1.0` changes nothing and is the tested default.

The finished clip appears inside the node and the file is saved under `output/NeronH3`. The storyboard during rendering shows the clip taking shape and never changes the video.

### Avoiding cloned characters

MiniMax H3 does not understand words like "different", "several" or "of different ages". Describe each person in a separate sentence: where they stand, age, build, face, hair, clothes and action. Do not write "two different men" — write "A man in a grey coat … Another man, older, in a dark jacket …". The reference-video branch is never used because it pulls the model toward cloning.

### Models

| File | Folder | Size |
|---|---|---|
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | 19.5 GB |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | 14.6 GB |
| `qwen3vl_32b_minimax_h3_int8_convrot.safetensors` | `models/text_encoders` | 25.3 GB, quality only |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | 3.0 GB |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | 577 MB |
| `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `models/loras` | 1.8 GB, turbo only |

All files are official, from Comfy-Org and LightX2V. Existing files in any model folder are reused. Interrupted downloads resume from the same place. Expert lists come from the installed model folders; the Refresh button shows newly added files without restarting ComfyUI.
