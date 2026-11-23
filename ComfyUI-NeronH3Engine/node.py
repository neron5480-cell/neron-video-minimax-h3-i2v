"""RU: Одна нода-движок H3. Один нажим — готовое видео.

EN: One H3 engine node. One press - a finished video.

RU: Общий канал кадров и будущего автопромптера живёт внутри Process-шины.
    RU/EN меняет весь процесс целиком: подписи, статусы и оформление.
EN: The shared frame channel and the future autoprompter live on one process bus.
    RU/EN switches the whole process: labels, statuses and the look.
"""

from __future__ import annotations

import os

from comfy_api.latest import ComfyExtension, io, ui

from . import h3_bus as bus
from . import h3_catalog as catalog
from . import h3_hw as hw
from .h3_engine import Engine

FramesBus = io.Custom(bus.FRAMES_TYPE)
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
                io.String.Input("prompt", multiline=True, tooltip="Что происходит в кадре / what happens in the frame"),
                io.String.Input("prompt_in", optional=True, advanced=True, tooltip="Промт проводом: главнее ручного поля"),
                io.Image.Input("first_frame", optional=True),
                io.Image.Input("mid_frame_1", optional=True, advanced=True),
                io.Image.Input("mid_frame_2", optional=True, advanced=True),
                io.Image.Input("last_frame", optional=True),
                FramesBus.Input("frames_bus", optional=True, advanced=True, tooltip="Шина четырёх кадров"),
                BundleBus.Input("bundle", optional=True, advanced=True, tooltip="Шина процесса: промт, длительность, кадры"),
                io.Int.Input("seconds", default=5, min=5, max=15, tooltip="Длительность, сек; модель считает короткими только от пяти"),
                io.Combo.Input("mode", options=["auto", "turbo", "power"], default="auto", tooltip="Авто выбирает по видеопамяти и оперативке"),
                io.Int.Input("seed", default=0, min=0, max=0xFFFFFFFFFFFFFFFF, control_after_generate=True),
                io.Int.Input("width", default=0, min=0, max=2048, advanced=True, tooltip="0 — размер под железо"),
                io.Int.Input("height", default=0, min=0, max=2048, advanced=True, tooltip="0 — размер под железо"),
                io.Int.Input("steps", default=0, min=0, max=40, advanced=True, tooltip="0 — 8 для турбо, 20 для мощного"),
                io.Boolean.Input("previews", default=True, advanced=True, tooltip="Показывать промежуточные кадры"),
                io.String.Input("lang", default="ru", socketless=True, advanced=True),
                io.String.Input("video_name", default="NeronH3/H3", socketless=True, advanced=True),
                io.Combo.Input("preset", options=PRESETS, default="обычный", socketless=True),
                io.Float.Input("sharpness", default=1.0, min=0.0, max=2.0, step=0.05, socketless=True,
                               tooltip="1.0 — проверенное значение; больше — легкая резкость по готовым кадрам"),
                io.Combo.Input("frame_format", options=list(hw.FORMATS), default="auto", socketless=True),
                io.Boolean.Input("manual_size", default=False, socketless=True, advanced=True),
                io.String.Input("prompt_override", default="", socketless=True, advanced=True,
                                tooltip="Итоговый промт: можно поправить перед отправкой в модель"),
                io.Combo.Input("first_image", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("mid_image_1", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("mid_image_2", options=files, default=bus.NONE, socketless=True),
                io.Combo.Input("last_image", options=files, default=bus.NONE, socketless=True),
                io.Boolean.Input("prompt_wire", default=False, socketless=True, advanced=True),
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
                io.Image.Output("frames", display_name="Кадры", tooltip="Все кадры готового ролика"),
                io.String.Output("path", display_name="Файл", tooltip="Путь к сохранённому MP4"),
                io.Image.Output("last_image_out", display_name="Последний кадр",
                                tooltip="Готовый конец ролика — можно подать в следующий прогон"),
            ],
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, prompt="", prompt_in=None, first_frame=None, mid_frame_1=None, mid_frame_2=None,
                last_frame=None, frames_bus=None, bundle=None, seconds=5, mode="auto", seed=0,
                width=0, height=0, steps=0, previews=True, lang="ru", video_name="NeronH3/H3",
                preset="обычный", sharpness=1.0, frame_format="auto", manual_size=False,
                prompt_override="", first_image=bus.NONE, mid_image_1=bus.NONE,
                mid_image_2=bus.NONE, last_image=bus.NONE, prompt_wire=False, expert=False,
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
        # RU: шина главнее; провод промта главнее ручного поля; ручной кадр главнее пресета.
        manual = {
            "first": first_frame if first_frame is not None else bus.load_frame(first_image),
            "mid_1": mid_frame_1 if mid_frame_1 is not None else bus.load_frame(mid_image_1),
            "mid_2": mid_frame_2 if mid_frame_2 is not None else bus.load_frame(mid_image_2),
            "last": last_frame if last_frame is not None else bus.load_frame(last_image),
        }
        if isinstance(frames_bus, dict):
            bundle = bundle if isinstance(bundle, dict) else {}
            bundle = dict(bundle)
            bundle["frames"] = frames_bus
        prompt_text = prompt_in if prompt_in not in (None, "") else (prompt_override or prompt)
        # RU: ширина и высота остаются рабочими и при проводе, и в ручном размере.

        engine = Engine(cls.hidden.unique_id, lang, previews)
        try:
            frames, path, last = engine.run(
                prompt=prompt_text,
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
            frames,
            path,
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
