"""RU: Одна нода-движок H3. Один нажим — готовое видео.

EN: One H3 engine node. One press - a finished video.

RU: Один вход-шина несёт промт, кадры, размер и длительность от внешнего блока.
    Один выход отдаёт последний кадр для следующего куска. RU/EN меняет процесс целиком.
EN: One data bus carries prompt, frames, size and duration from an external block.
    One output returns the last frame for the next segment. RU/EN switches everything.
"""

from __future__ import annotations

import os

from comfy_api.latest import ComfyExtension, io, ui

from . import h3_bus as bus
from . import h3_catalog as catalog
from . import h3_hw as hw
from .h3_engine import Engine

BundleBus = io.Custom(bus.BUNDLE_TYPE)

PRESETS = ["обычный", "быстрый", "качество", "кино", "стык кадров"]


class NeronH3EngineNode(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        files = bus.input_files()
        return io.Schema(
            node_id="NeronH3Engine",
            display_name="🌀 Neron H3 Engine",
            description="MiniMax H3: пустой кадр, четыре опорных кадра, турбо и мощный режим, раскадровка и звук.",
            category="Neron/H3",
            is_output_node=True,
            not_idempotent=True,
            inputs=[
                BundleBus.Input("bundle", optional=True, tooltip="Шина данных: промт, кадры, размер, длительность"),
                io.String.Input("prompt", multiline=True, socketless=True, tooltip="Что происходит в кадре"),
                io.Int.Input("seconds", default=5, min=5, max=15, socketless=True, tooltip="Длительность, сек"),
                io.Combo.Input("mode", options=["auto", "turbo", "power"], default="auto", socketless=True,
                               tooltip="«По железу» выбирает турбо (8 шагов) или качество (20 шагов) по видеопамяти и оперативке"),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, socketless=True,
                             control_after_generate=True),
                io.Int.Input("width", default=0, min=0, max=2048, socketless=True, advanced=True,
                             tooltip="0 — размер под железо"),
                io.Int.Input("height", default=0, min=0, max=2048, socketless=True, advanced=True,
                             tooltip="0 — размер под железо"),
                io.Int.Input("steps", default=0, min=0, max=40, socketless=True, advanced=True,
                             tooltip="0 — 8 для турбо, 20 для мощного"),
                io.Boolean.Input("previews", default=True, socketless=True, advanced=True,
                                 tooltip="Показывать промежуточные кадры"),
                io.String.Input("lang", default="ru", socketless=True, advanced=True),
                io.String.Input("video_name", default="NeronH3/H3", socketless=True, advanced=True),
                io.Combo.Input("preset", options=PRESETS, default="обычный", socketless=True),
                io.Float.Input("sharpness", default=1.0, min=0.0, max=2.0, step=0.05, socketless=True,
                               tooltip="1.0 — проверенное значение"),
                io.Combo.Input("frame_format", options=list(hw.FORMATS), default="auto", socketless=True),
                io.Boolean.Input("manual_size", default=False, socketless=True),
                io.Combo.Input("first_image", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("mid_image_1", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("mid_image_2", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("last_image", options=files, default=bus.NONE, socketless=True),
                io.Boolean.Input("expert", default=False, socketless=True, advanced=True),
                io.Combo.Input("diffusion_model", options=catalog.diffusion_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Combo.Input("text_turbo_model", options=catalog.text_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Combo.Input("text_power_model", options=catalog.text_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Combo.Input("video_vae_model", options=catalog.vae_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Combo.Input("audio_vae_model", options=catalog.vae_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Combo.Input("turbo_lora", options=catalog.lora_choices(),
                               default=catalog.AUTO, socketless=True, advanced=True),
                io.Float.Input("turbo_lora_strength", default=1.0, min=-3.0, max=3.0,
                               step=0.05, socketless=True, advanced=True),
                *[
                    item
                    for i in range(1, 6)
                    for item in (
                        io.Boolean.Input(f"lora_{i}_enabled", default=False,
                                         socketless=True, advanced=True),
                        io.Combo.Input(f"lora_{i}_name", options=catalog.extra_lora_choices(),
                                       default=catalog.NONE, socketless=True, advanced=True),
                        io.Float.Input(f"lora_{i}_strength", default=1.0, min=-3.0, max=3.0,
                                       step=0.05, socketless=True, advanced=True),
                    )
                ],
            ],
            outputs=[
                io.Image.Output("last_image_out", display_name="Последний кадр",
                                tooltip="Готовый конец ролика — подаётся в следующий прогон"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, prompt="", bundle=None, seconds=5, mode="auto", seed=0,
                width=0, height=0, steps=0, previews=True, lang="ru", video_name="NeronH3/H3",
                preset="обычный", sharpness=1.0, frame_format="auto", manual_size=False,
                first_image=bus.NONE, mid_image_1=bus.NONE,
                mid_image_2=bus.NONE, last_image=bus.NONE, expert=False,
                **kwargs) -> io.NodeOutput:
        # RU: экспертные выборы приходят отдельным пакетом и в схему не лезут.
        option_names = [
            "diffusion_model", "text_turbo_model", "text_power_model",
            "video_vae_model", "audio_vae_model", "turbo_lora", "turbo_lora_strength",
        ]
        for i in range(1, 6):
            option_names += [f"lora_{i}_enabled", f"lora_{i}_name", f"lora_{i}_strength"]
        options = {name: kwargs.get(name) for name in option_names}
        options.setdefault("turbo_lora", catalog.AUTO)
        options.setdefault("turbo_lora_strength", 1.0)
        for i in range(1, 6):
            options.setdefault(f"lora_{i}_name", catalog.NONE)
            options.setdefault(f"lora_{i}_strength", 1.0)
        # RU: одна шина главнее ручных полей; кадры грузятся в самих окнах ноды.
        manual = {
            "first": bus.load_frame(first_image),
            "mid_1": bus.load_frame(mid_image_1),
            "mid_2": bus.load_frame(mid_image_2),
            "last": bus.load_frame(last_image),
        }
        if not isinstance(bundle, dict):
            bundle = None

        engine = Engine(cls.hidden.unique_id, lang, previews)
        try:
            _frames, path, last = engine.run(
                prompt=prompt,
                first_frame=manual["first"],
                mid_1=manual["mid_1"],
                mid_2=manual["mid_2"],
                last_frame=manual["last"],
                seconds=seconds,
                mode=mode,
                seed=seed,
                width=width or None,
                height=height or None,
                steps=steps,
                sharpness=sharpness,
                frame_format=frame_format,
                bus_data=bundle,
                video_name=video_name,
                options=options,
            )
        finally:
            engine.close()
        return io.NodeOutput(
            last,
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
