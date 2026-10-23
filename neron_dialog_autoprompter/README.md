\# Neron Dialog Autoprompter



\*\*First conversational node for ComfyUI.\*\*



Talk to the director — get a video. No prompt writing, no reference hunting.



\---



\## What it is



A node that \*\*talks to you\*\* like an experienced film director and assembles

the prompt itself. Comes with a second node — \*\*Neron Multi-Image LLM\*\* — that

converts the artistic description into a technical prompt for MiniMax H3.



\---



\## Features



\- 💬 \*\*Conversational director\*\* — talk in plain words, in Russian or English.

\- 🖼 \*\*Up to 4 reference images\*\* — main frame, 2 extra refs, last frame.

\- 🌫 \*\*Works without images\*\* — creates a black placeholder frame, generator

&#x20; draws from scratch (text-to-video mode).

\- 📝 \*\*Prompt card\*\* — the finished prompt appears in a card with

&#x20; "Edit" / "Ready" buttons.

\- 🧠 \*\*Auto-select\*\* — model, mmproj and system prompt are picked automatically.

\- 🌐 \*\*Two languages\*\* — Russian and English system prompts. Swap in one click.

\- 💾 \*\*Shared model\*\* — uses the same `llama-server` as

&#x20; `ComfyUI-LLM-text-processor`. VRAM is not doubled.



\---



\## Requirements



\- ComfyUI (recent version)

\- Python 3.10+

\- \*\*ComfyUI-LLM-text-processor\*\* — provides `llama-server.exe`

&#x20; (https://github.com/KingManiya/ComfyUI-LLM-text-processor)

\- A vision-capable GGUF model (Qwen 2.5-VL, Qwen 3.5, LLaVA, MiniCPM-V, etc.)

\- Matching `mmproj` file

\- VRAM: 8+ GB for 7B, 16+ GB for 9B



\---



\## Installation



1\. Copy the `neron\_dialog\_autoprompter` folder into

&#x20;  `ComfyUI/custom\_nodes/`.

2\. Install dependencies:

