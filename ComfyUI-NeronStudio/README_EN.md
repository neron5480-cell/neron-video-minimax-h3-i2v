# 🖥 Neron Studio — your own desktop inside ComfyUI

Russian version: [README.md](README.md).

**What it is.** The Neron desktop right inside ComfyUI: tiles, folders and your own background — and every Neron
workflow one click away. Adds no nodes. 📖 Details with screenshots: [article on Civitai](https://civitai.com/articles/38373).

**How to open.** The gold **«N»** coin on the canvas (you can drag it anywhere) or the menu **Neron → Neron Studio**.
Close with «✕ To ComfyUI» or Esc.

**Folders.** Desktop › **Video** · **Images** · **Sound** · **Models**; inside — tiles by task (Photo → video,
Long video, Dialogue…), and inside those — workflow variants. The path "Desktop › Video › …" is at the top: click any
part of it to go back. Back — «‹ Back» or Esc. A folder with no installed workflow hides itself.

**Live tiles.** Drag, resize, remove and bring back, «⊞ Tidy up». Every folder has its own layout, remembered in the
browser. Tile size 50–140 %, your own tile and accent colors.

**«Open» on a tile** loads the real Neron workflow into ComfyUI in a new tab — your current work is not touched.
No workflow installed — the tile says «Not installed». Tested workflows ship inside as they are
(`ComfyUI-NeronStudio/workflows`); their models — see the notes inside each workflow.

**Workflow in the desk look.** At the top — the Neron Studio strip: workflow name, «▶ Create», «■ Stop», a clock,
«⤴ Up» (out of a subgraph), «🏠 Desktop» and «✕». Nodes are "glass" in the desk colors (the Neron Studio theme from
Neron Theme). The menu, tabs, minimap and zoom buttons are hidden with ComfyUI's own switches — the canvas, background
and strip remain. The look lives only in tabs opened from the desk. «✕» on the strip — plain ComfyUI, everything comes
back as it was (and the desk forgets its tabs).

**🖼 Your own background** — a photo, GIF or video, full screen (drop it on the desk or «🎨 Theme» → «📂 Choose a file…»),
with dimming, blur and "glass" tiles. With the Neron Theme node the background also shows **under the ComfyUI
canvas**. The file is stored only in this browser. A video background puts a little load on the GPU: on a strong
computer you won't notice; if the computer is weak or every second of generation counts — use a photo or a GIF.

**🎨 Theme** — the same themes as the Neron Theme node (Graphite, Neon, Ocean, the light «Paper» and others), or
«🔗 As in ComfyUI» — the desk switches together with the theme set by the Neron Theme node.

**RU / EN** — from the system language, plus a switch on the desk. The workflow strip is bilingual too.

**Installation.** By one link (ComfyUI Manager → Install via Git URL →
`https://github.com/neron5480-cell/neron-video-minimax-h3-i2v`) or manually: put the `ComfyUI-NeronStudio` folder into
`ComfyUI/custom_nodes` and restart ComfyUI. Comfy Desktop remembers old desk files: when updating by hand, delete the
old folder first, then put in the new one.
