"""RU: Одна нода-движок H3. Один нажим — готовое видео.
EN: One H3 engine node. One press - a finished video.

RU: Лишние входы спрятаны штатным механизмом ComfyUI (advanced). RU/EN меняет
    весь процесс целиком: подписи, статусы и оформление.
EN: Optional inputs are hidden by ComfyUI's native advanced mechanism. RU/EN
    switches the whole process: labels, statuses and the look.
"""

from __future__ import annotations

import os

from comfy_api.latest import ComfyExtension, io, ui

from .h3_engine import Engine


class NeronH3EngineNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="NeronH3Engine",
            display_name="🌀 Neron H3 Engine",
            description="MiniMax H3: empty frame or image, turbo or power, live storyboard while rendering. Models are found or downloaded automatically.",
            category="Neron/H3",
            is_output_node=True,
            not_idempotent=True,
            inputs=[
                io.String.Input("prompt", multiline=True, tooltip="Что происходит в кадре / what happens in the frame"),
                io.Image.Input("first_frame", optional=True),
                io.Image.Input("last_frame", optional=True),
                io.Int.Input("seconds", default=5, min=5, max=15, tooltip="Длительность, сек; модель считает короткими только от пяти"),
                io.Combo.Input("mode", options=["auto", "turbo", "power"], default="auto", tooltip="Авто выбирает по видеопамяти и оперативке"),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, control_after_generate=True),
                io.Int.Input("width", default=0, min=0, max=2048, advanced=True, tooltip="0 — размер под железо"),
                io.Int.Input("height", default=0, min=0, max=2048, advanced=True, tooltip="0 — размер под железо"),
                io.Int.Input("steps", default=0, min=0, max=40, advanced=True, tooltip="0 — 8 для турбо, 20 для мощного"),
                io.Boolean.Input("previews", default=True, advanced=True, tooltip="Показывать промежуточные кадры"),
                io.String.Input("lang", default="ru", socketless=True, advanced=True),
                io.String.Input("video_name", default="NeronH3/H3", socketless=True, advanced=True),
            ],
            outputs=[
                io.Image.Output("frames"),
                io.String.Output("path"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, prompt, first_frame=None, last_frame=None, seconds=5, mode="auto", seed=0,
                width=0, height=0, steps=0, previews=True, lang="ru",
                video_name="NeronH3/H3") -> io.NodeOutput:
        engine = Engine(cls.hidden.unique_id, lang, previews)
        try:
            frames, path = engine.run(
                prompt=prompt,
                first_frame=first_frame,
                last_frame=last_frame,
                seconds=seconds,
                mode=mode,
                seed=seed,
                width=width or None,
                height=height or None,
                steps=steps,
                video_name=video_name,
            )
        finally:
            engine.close()
        return io.NodeOutput(
            frames,
            path,
            ui=ui.PreviewVideo([
                ui.SavedResult(
                    os.path.basename(path),
                    os.path.dirname(path).replace("\\", "/"),
                    io.FolderType.output,
                )
            ]),
        )


class NeronH3Extension(ComfyExtension):
    async def get_node_list(self):
        return [NeronH3EngineNode]


async def comfy_entrypoint():
    return NeronH3Extension()
