# Neron Theme 🎨 — themes for the whole ComfyUI

Russian version: [README.md](README.md).

### Install

Part of the Neron pack: **ComfyUI Manager → Install via Git URL** → the repository link. Or copy the `NeronTheme` folder into `ComfyUI/custom_nodes`.
Find it: double-click the canvas → `Neron Theme`, or the **Neron → Neron Theme 🎨** menu.

### The gist in 30 seconds

1. Put **Neron Theme 🎨** on the canvas — "Neron Brown" turns on right away.
2. Hover any card — the canvas shows how it will look. Click — the theme is on.
3. Save the workflow — the theme is saved with it. Whoever downloads your workflow sees it the way you styled it.

The node does not have to be wired. The `image` input is only for "theme from picture".

### What gets themed

| What | How |
|---|---|
| **ComfyUI window** (menus, panels, lists) | Theme colors. Can be turned off in ⚙ → "theme the ComfyUI window" |
| **Canvas** | Background and grid |
| **Nodes** | By **role**: each role has its own title color and a light body tint |
| **Wires** | Each type (MODEL, CLIP, IMAGE…) keeps its own color as in ComfyUI, but in the theme's palette — types stay easy to tell apart |
| **Fields and text** | Match the theme; text always stays readable — the node watches the contrast |

**Node roles:** Models · Input (image, video, audio loaders) · Text (prompts) · Generate (KSampler etc.) · Latent (latents, VAE Decode/Encode) · Process (images, masks, video) · Audio · Output (save, preview) · Other.
The role is detected automatically from what a node does and outputs. Works with any nodes, not only Neron.

**Your color wins.** A node you colored by hand (right-click → Colors) is not repainted. Nodes with their own signature color (e.g. notes) are left alone too.
The workflow itself is not changed: role colors are not written into nodes, so without our node the workflow looks as usual.

### INSTALL tab

- **Built-in:** Plain ComfyUI (theme off), Graphite, Neron Brown, Neon, **Backlight** (each node glows from underneath in its own color, like LED lighting), Sunset, Ocean, Forest, Sakura, Mono, Paper (light).
- **Mine:** themes you saved. Stored as files in `ComfyUI/user/neron_themes` — copy and send them around. ✖ on a card deletes it (press twice).
- **Someone's theme:** paste a `NERON-THEME1:…` **code** and press 📥 APPLY, or drop a theme **file** (`.json`) right onto the node. It is saved to **Mine** at once. A ComfyUI palette (`.json` from Settings → Appearance → Export) works too.

### CREATE tab

**For everyone:**
- **Main color** — pick a color and the node builds the whole theme from it. Three ways to spread colors over roles: **HARMONY** (neighbouring shades), **RAINBOW** (the whole rainbow — nodes are easy to tell apart), **MONO**. **light** — a light background with dark text.
- **🖼 From picture** — wire **Load Image** to the `image` input and press the button: the theme is built from the picture's colors. Works instantly with Load Image; with any other image node — after one Queue.
  - A preview of the picture appears in the node. **Drag a frame** over the spot you want (e.g. just a neon sign) — the theme takes colors only from that area. **Double-click** the preview — the whole picture again.
  - Under the preview there is a **strip of found colors**. Click a color — it becomes the main theme color (click again to undo).
  - The frame and the chosen color are saved with the workflow; a different picture resets them.
- **Name** and **Author** — your nickname is visible to everyone you share the theme with.
- **Life:** OFF · CALM · LIVELY · FULL.
- **Node opacity** — node bodies become see-through, the grid and wires show through (100% — normal nodes). While the theme is on it overrides ComfyUI's "Node opacity" setting; remove the node and yours comes back.
- **Node backlight** — a soft glow under each node in its role color. Not an animation: it works with Life OFF too. Muted and bypassed nodes don't glow.
- **Wires:** **BY TYPE** (like ComfyUI — each type its own color, in the theme's palette), **ONE COLOR** (all wires one color, picked right there), **CUSTOM** (your own color per type — MODEL, CLIP, VAE, CONDITIONING, LATENT, IMAGE, MASK, CONTROL_NET, AUDIO, VIDEO — in ⚙).
- **💾 Save to Mine** — the theme shows up under INSTALL.

Everything you change shows on the canvas right away.

**⚙ EXPERT** — the full set: every color (canvas, grid, node title, node body, text, fields, field borders, wires, window panels, main color), each of the 9 role colors, wire color per type ("Custom" mode — changing one switches to it), role strength in title and body, glow, and life details: frame lights · wire sparks · workflow run · on the beat · quieter while generating · theme the ComfyUI window; background (none / flow / particles / stars); FPS limit (auto / 30 / 45 / 60); speed.

### Life

- **Frame lights** — a light runs along each node frame in its role color.
- **Wire sparks** — run from output to input.
- **Background** — flowing colors, particles or twinkling stars.
- **Workflow run** — the running node **glows and shows a progress bar**, fast sparks run along the wires into it; a finished node **flashes**; a node with an error **blinks red**. You see at once where the work is and where it got stuck.
- **On the beat** — flashes on the beat of Neron Audio Studio sound.

> ⚠️ **Bro, don't chase the animation.**
> The browser draws it. On big canvases (hundreds of nodes) ComfyUI can feel heavy even without it, and "Full" mode may stutter while dragging. If it lags, set "Life" to "Calm" or off — the colors stay, only the motion goes.

### Share

At the bottom of the node, always visible. It shares the theme that is on **now**:
- **📋 CODE** — copies a short `NERON-THEME1:…` line for a chat or a comment.
- **💾 FILE** — a `.json` theme file to drop on the node.
- **🎨 FOR COMFYUI** — a palette for ComfyUI's own settings (**Settings → Appearance → Color Palette → Import**). Works **without our node**, but without life and role colors.

The code and the file carry the theme's name and author.

### Good to know

- **Two** Neron Theme nodes on the canvas — the first one is in charge; the other shows a warning.
- The **Neron Audio Studio "Theme"** node paints the studio nodes its own way. If both are on the canvas, keep one (the node warns you).
- If you have **your own background picture** in ComfyUI settings, the theme leaves the canvas background alone.
- Switching the ComfyUI palette while the theme is on keeps the theme on top; remove the node and your chosen palette comes back.
- The theme works with the classic ComfyUI node look. In **Nodes 2.0** mode (Settings → "Modern Node Design") nodes are drawn differently — role colors and frame lights may not appear there.
- How it was tested: automatically, in the real ComfyUI interface (frontend 1.58) in Chromium, on a stand-in server without image generation. ComfyUI updates its interface often — if something stops being themed after an update, let us know.
