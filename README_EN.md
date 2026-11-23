# Neron's ComfyUI Projects — English version

Russian version: [README.md](README.md).

Hi friends!

This repository contains my custom nodes for ComfyUI. It holds **independent projects**: video (H3 Story, LTX), images (Krea 2, restoration), video post-processing, music, themes and a desktop. **Every folder works on its own** — its own nodes and code, no neighbours needed.

---

## 🚀 Installation (2 minutes)

### Option 1. ComfyUI itself (Desktop and browser) — easiest

The pack is in the official ComfyUI catalog (Comfy Registry, publisher **neron**).

- **Opened our workflow and the nodes are red?** ComfyUI offers to install the missing nodes — accept, then
  **restart ComfyUI completely** (in Desktop, also from the tray).
- **Or via Manager:** open **Manager** (built into Comfy Desktop) → search **Neron** → **Install** → restart.

**All nodes** from this repository are installed at once. The ComfyUI console will show:
```
[Neron pack] loaded: ...
```
with the list of loaded nodes.

### Option 1b. By link (browser version with ComfyUI Manager)

**Manager** → **Install via Git URL** → paste the link and restart ComfyUI:
```
https://github.com/neron5480-cell/neron-video-minimax-h3-i2v
```
> ℹ️ Comfy Desktop may not have this item, or a security setting blocks it — use Option 1 or 2 then.

### Option 2. Manually (only the nodes you need)

1. Click the green **Code** button → **Download ZIP** and unpack it.
2. Copy the **node folders you need** straight into `ComfyUI/custom_nodes/`. In ComfyUI Desktop this is usually:
   `C:\Users\<name>\AppData\Local\Comfy-Desktop\ComfyUI-Shared\custom_nodes\`
3. Restart ComfyUI.

A node folder must sit **directly** in `custom_nodes`, with no extra level:
```
✅ custom_nodes/ComfyUI-NeronH3Story/__init__.py
❌ custom_nodes/neron-video-minimax-h3-i2v-main/ComfyUI-NeronH3Story/__init__.py
```
**Every folder is self-contained** — copy only the one you need; it does not need its neighbours.

### ⚠️ Do not mix the two options

If you installed nodes manually before and now install by link, **delete the old manual copies** from `custom_nodes`. The pack skips nodes that are already installed on their own and says so in the console. But if an old copy sits under a different folder name, two versions of the same node will get in each other's way.

### The node did not show up?

1. Close ComfyUI completely (in Desktop, also from the tray) and open it again.
2. Check the startup console: the `[Neron pack]` and `IMPORT FAILED` lines tell what happened.
3. Check that the node folder sits in the right place (see above).
4. Write to me in the comments on Civitai and attach a piece of the console.

---

## 🖥 NERON STUDIO — your own desktop inside ComfyUI (new)

Tiles, folders and your own background — and every Neron workflow one click away. 📖 Details with screenshots: [article on Civitai](https://civitai.com/articles/38373/neron-studio-svoj-rabochij-stol-vnutri-comfyui-your-own-desktop-inside-comfyui). After install a golden **N** coin appears on the canvas (drag it anywhere), or use the menu **Neron → Neron Studio**.

- **Folders:** Video · Images · Sound · Models; inside — tiles by task and workflow variants. A path on top; go back with «‹ Back» or Esc.
- **Live tiles:** drag, resize, remove and bring back; the layout is remembered.
- **Your own background:** a photo, GIF or video — on the desk and under the ComfyUI canvas (needs Neron Theme). Tile size 50–140 %, your own tile and accent colors.
- **Workflow in the desk look:** «▶ Create», «■ Stop», a clock, «⤴ Up» out of a subgraph, «🏠 Desktop»; «✕» — plain ComfyUI.
- **RU / EN** — from the system language, with a switch on the desk.
- Tested workflows ship inside as they are (`ComfyUI-NeronStudio/workflows`). Their models — see the notes inside each workflow.

## 🎬 NERON H3 STORY — long MiniMax H3 videos up to 45 seconds (new)

👋 The nodes and workflows live in the **[`ComfyUI-NeronH3Story`](ComfyUI-NeronH3Story/)** folder.

The same quality H3 engine, but a **5–45 s video with sound** — a chain of blocks joined without visible seams: every next block continues the previous one's tail **with its sound**.

* **🖼 Frames** — first, two middle and last frames loaded right inside one node, no spaghetti.
* **📝 Story AutoPrompter** — one scenario in your words → a prompt per part with timing, physics and sound; the camera stays locked unless the scenario asks for a move.
* Or **without the AutoPrompter** — with **🎞 Block** nodes (own text, pictures and LoRAs per part).
* **🚀 Fast / ⚡ Turbo / Quality / Maximum** modes; downloads its models.
* Tuned for quality — it takes time (30 s ≈ 45 min – 1.5 h on an RTX 5070 Ti); how to speed up — in the README.

*Details are in the [README inside the folder](ComfyUI-NeronH3Story/README.md).*

---

## 🖼 NERON IMAGE — text to image with Krea 2 (new)

👋 The node and workflow live in the **[`ComfyUI-NeronImage`](ComfyUI-NeronImage/)** folder.

Write what to draw, in any language, and get a picture up to **2K**. One node instead of twenty in the official template.

* Model — **Krea 2 Turbo bf16** (official, Comfy-Org): 8 steps, ≈ 1 min at 2K on 16 GB.
* A **prompter** runs on the same Qwen3-VL, so there is nothing extra to download. By default it uses **🎨 every detail**: your words stay as written, and it adds clothing, materials, mechanism parts, light and camera. The final prompt is shown on the node.
* Aspect, quality 1K / 1.5K / 2K, a **sharpness** slider, official style LoRAs.
* Downloads its models (the **📥 Models** button).

*Details are in the [README inside the folder](ComfyUI-NeronImage/README.md).*

---

## 🎬 NERON LTX ENGINE — LTX 2.5 video in one node

👋 Folder **[`ComfyUI-NeronLTXEngine`](ComfyUI-NeronLTXEngine/)**.

* **🎬 Neron LTX Engine** — first / middle / last frames, audio, downloads its models.
* **🎬 Neron LTX AutoPrompter** — an LTX prompt with physics and camera; lives in the same folder, downloads its LLM.

---

## 🎨 RESTORE STUDIO — old photo restoration

👋 Folder **[`restore_studio`](restore_studio/)**, workflow `restore_studio/workflows/Neron_Restore_Studio_Photoshop.json`.

* White balance, levels, denoise, scratches, color, sharpness, upscale; presets; 🖥 Live Preview.
* Face restore and colorization use packs you have installed (CodeFormer / DDColor), if present.

---

## 🎛 PERCEPTION RELAY (Video Post-processing)

👋 All nodes, workflows and instructions live in the **[`ComfyUI-PerceptionRelay`](ComfyUI-PerceptionRelay/)** folder.

AI video looks "fake" not because of resolution. It looks fake because the viewer's brain keeps getting disturbed: details boil and crawl, eyes and the face edge jitter, shadows are flat, colour leaks across borders. **Perception Relay does not invent a single detail.** It removes what disturbs the eye, and the brain sees the picture as sharp and alive on its own. It works with any video, including clips from H3.

**Main feature — 🎛 the Pult with a live preview.** Move any slider and see the frame (up to 2K) within a fraction of a second. You get a before/after split, a full-resolution magnifier and a **▶ play 1 s** button that loops one second of the clip, so you see shimmer, not just a still.

**Stage cards** (each plugs into the Pult with one wire, in any order):
*   **👁 Scout** — finds and tracks faces and eyes.
*   **🌊 Flow** — motion between frames (RAFT, or DIS with no download).
*   **⚖ Judge** — tells physics from drift and calms boiling detail. Honest motion is left alone.
*   **💎 Edge cut** — sharpens edges only, and only where the edge holds steady in time.
*   **🌑 Tone skeleton** — shadows and blacks as the frame of the picture: depth and volume, no detail loss.
*   **🎨 Colour seam** — clean colour borders, no halos, no "razor" look.
*   **✨ Polish** — deflicker, light, smoothness (×2 half-frame or motion blur).
*   **🎚 Basic** — simple brightness, contrast, sharpness, saturation.
*   **🎯 Attention points** — eyes and face edge pulled to "lens focus".

**Outputs:** frames, audio and fps for Create Video, a before/after comparison video, and a **run report** with all settings and how each stage worked. The report contains no paths, file names or video, so it is safe to send to me. Your reports will become presets.

**Hardware:** 12–16 GB VRAM, 32–48 GB RAM. Models are tiny (face detector 230 KB, RAFT ~20 MB) and download automatically. Nodes are in English and Russian.

⚠️ **Important:** the project is in **Alpha**. Bugs are possible, and your reports help a lot. Installation, every slider and troubleshooting are in the **[README inside ComfyUI-PerceptionRelay](ComfyUI-PerceptionRelay/README.md)**.

---

## 🎹 NERON AUDIO STUDIO (Music Studio)

👋 All audio nodes live in the **[`NeronAudioStudio`](NeronAudioStudio/)** folder.

This is a separate project that turns ComfyUI into a small digital audio workstation (DAW).

**What's inside:**
*   **Drum Machine:** step sequencer for drums (like FL Studio) with custom sample support.
*   **Piano Roll:** draw melodies with your mouse, 9 built-in synths.
*   **Audio Loader:** load, listen to and trim any audio file.
*   **Mixer:** up to 8 channels. Volume, pan, Mute/Solo, BPM sync, and video support (fully replace/mute video audio, overlay multiple tracks, sync by length).
*   **Video Combine:** smart muxing of video (or image batches) with the mixed audio.
*   **Video ×3 and Sound ×8 (cubes):** up to 3 clips and 8 sounds in one node, one wire into the Pult (Mixer). The Pult shows a summary, clips side by side or full screen, each sound as its own channel.
*   **Field:** a shared field like the FL Studio Playlist. Frame-accurate cutting of up to 3 clips (drag to shift, two dividers, cut or dissolve) plus audio tracks: move, trim, split, fade in and out. The big window opens above the canvas; the canvas keeps a tidy card.
*   **Dancer:** just for fun — a little dancer (or your own dance clip) that moves in time with the music.

**🆕 Version 2.0 — a modular studio: cubes + the Pult as the heart.**
*   **Pult:** LOW / MID / HIGH EQ and REVERB (room / hall / cathedral) on every channel, live meters; music fits the clip length and fades out at the end; a yellow frame on the wave picks which part of the track plays; ⚙ expert — tempo to video.
*   **Video Sampler:** cut pieces from 3 clips into a frame-accurate edit; ⏭ bypass, 🔇 no clip sound, 🧲 cut on the beat.
*   **Sampler:** build sound from track pieces on a bar grid, 4 layers, ▶ per layer.
*   **Music:** drums and piano in one node, one tempo, ▶ play all.
*   **Studio:** every track is a channel with EQ and reverb, an FL-Studio-like arrange field, a 10-band master EQ with a live spectrum.
*   **Theme 🎨:** the ready workflow now uses the new **Neron Theme** (Project 5) — it themes the studio nodes and the DJ Controller too; lights on the frames and sparks on the wires follow the kick. The old "Theme" node is kept for old workflows.

Ready workflows: `NeronAudioStudio/workflow/Neron_Audio_Studio_v2.0.json` (new) and `Neron_Audio_Studio_v1.0_Beta.json` (previous).

Main feature: **audio plays directly on the node, no need to hit Queue just to listen!** Everything runs in the browser and doesn't load your GPU.

⚠️ **Important:** the project is in **Beta**. The interface is currently in Russian only (English will be added later), but it's highly intuitive. Bugs are possible. Detailed instructions for all buttons and folders are in the **[README inside NeronAudioStudio](NeronAudioStudio/README.md)**.

---

## 🎨 NERON THEME (Themes for the whole ComfyUI)

👋 The node lives in the **[`NeronTheme`](NeronTheme/)** folder.

One node — and the **whole ComfyUI is themed**: window, canvas, nodes and wires. Delete the node — everything is back.

*   **Nodes by role:** models, prompts, sampling, latent, processing, audio, output — each role has its own color. Works with any nodes, not only Neron. A color you set by hand always wins.
*   **INSTALL:** 10 built-in themes (Graphite, Neron Brown, Neon, Backlight, Sunset, Ocean, Forest, Sakura, Mono, light Paper) + your own. Hover a card to try it, click to apply.
*   **CREATE:** a theme from one color, a **theme from a picture** (Load Image → the `image` input), see-through nodes, node backlight, wire colors (by type / one / custom), and every color by hand in ⚙.
*   **SHARE:** 📋 code (a line for a chat), 💾 file, 🎨 a palette for ComfyUI's own settings.
*   **Life:** lights on frames, sparks on wires, background; the running node glows with a progress bar, a finished one flashes, an error blinks red.
*   The theme is **saved with the workflow**: whoever downloads your workflow sees it the way you styled it.

⚠️ **Bro, don't chase the animation.** The browser draws it; big canvases may stutter — then set Life to Calm or Off.

Details in the **[README inside NeronTheme](NeronTheme/README.md)**.

---

## 🗺 Map: which node to use

| Task | Use | Folder |
|---|---|---|
| Long H3 video (5–45 s) | **🎬 Neron H3 Story** + **🖼 Frames** + **📝 Story AutoPrompter** (or **🎞 Block**) | `ComfyUI-NeronH3Story` |
| LTX 2.5 video | **🎬 Neron LTX Engine** + **🎬 Neron LTX AutoPrompter** | `ComfyUI-NeronLTXEngine` |
| Text to image | **🖼 Neron Image (Krea 2)** | `ComfyUI-NeronImage` |
| Photo restoration | **🎨 Restore Studio** + 🖥 Live Preview | `restore_studio` |
| Enhance video | **Perception Relay** — pult and cards | `ComfyUI-PerceptionRelay` |
| Music and sound | **Neron Audio Studio** | `NeronAudioStudio` |
| UI theme | **Neron Theme 🎨** | `NeronTheme` |
| Desktop | **🖥 Neron Studio** | `ComfyUI-NeronStudio` |

## ❓ FAQ

**The AutoPrompter refuses explicit scenes. Which "uncensored" model should I use?**
I don't give advice on uncensored models: Neron nodes are made for general creative video — nature, people,
scenes, music clips. The AutoPrompter works with any vision GGUF model you put in `models/LLM`, so which model
to use is your own choice and responsibility.

---

📜 License: MIT. Author: **neron5480922** on Civitai · [neron5480-cell](https://github.com/neron5480-cell) on GitHub.
