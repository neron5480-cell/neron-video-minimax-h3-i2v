# -*- coding: utf-8 -*-
"""Точное превью для нод обработки картинки Neron / Exact preview for Neron image nodes.

RU: Живое превью в браузере считается быстро, но браузер увеличивает и уменьшает картинку другими
    фильтрами, чем Python. Поэтому, когда человек перестал двигать ползунок, нода просит сервер
    сделать кадр ТЕМ ЖЕ кодом, что и при генерации (размер + цвет + резкость), и показывает его.
    Что видит глаз — то и уходит в генератор.
    Считается на процессоре и не трогает видеокарту и загруженные модели: превью можно двигать
    даже во время генерации видео. AI-апскейл в превью не входит (его делает только Queue).
EN: The browser preview is fast but resamples with different filters than Python. When the user stops
    moving a slider, the node asks the server for the frame made by the SAME code as the real run.
    Runs on the CPU and never touches the GPU or loaded models. AI upscale is not part of the preview.
"""
import io
import logging

import numpy as np
import torch
from PIL import Image

log = logging.getLogger("Neron.ImagePreview")

ROUTE = "/neron/image_preview"
_registered = False


def _render(data, loader_cls, color_cls):
    class Loader(loader_cls):
        PRESET_FIT = bool(data.get("preset_fit", False))

    image, _mask, _w, _h = Loader().load_and_resize(
        image=data["image"],
        resize_mode=data.get("resize_mode", "Disabled / Отключено"),
        ai_preset=data.get("ai_preset", "1024x1024 (1:1 Square)"),
        aspect_ratio=data.get("aspect_ratio", "1:1"),
        max_dimension=int(data.get("max_dimension", 1024)),
        manual_width=int(data.get("manual_width", 1024)),
        manual_height=int(data.get("manual_height", 1024)),
        megapixels=data.get("megapixels", "1.0 MP (1024x1024)"),
        divisible_by=int(data.get("divisible_by", 32)),
    )
    b = float(data.get("brightness", 0.0))
    c = float(data.get("contrast", 1.0))
    s = float(data.get("saturation", 1.0))
    sh = float(data.get("sharpness", 0.0))
    if b != 0.0 or c != 1.0 or s != 1.0 or sh != 0.0:
        image = color_cls._apply_color_correction(image, b, c, s, sh, torch.device("cpu"))
    arr = (image[0, ..., :3].clamp(0.0, 1.0) * 255.0).round().to(torch.uint8).cpu().numpy()
    buf = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(arr)).save(buf, format="PNG", compress_level=1)
    return buf.getvalue()


def register(loader_cls, color_cls):
    """Один раз на сервер, сколько бы нод ни загрузилось. / Once per server."""
    global _registered
    if _registered:
        return
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return
    _registered = True

    @PromptServer.instance.routes.post(ROUTE)
    async def neron_image_preview(request):
        try:
            data = await request.json()
            if not data.get("image"):
                return web.Response(status=400, text="no image")
            import asyncio
            png = await asyncio.get_running_loop().run_in_executor(None, _render, data, loader_cls, color_cls)
            return web.Response(body=png, content_type="image/png", headers={"Cache-Control": "no-store"})
        except Exception as e:
            log.warning("[Neron] точное превью не получилось: %s", e)
            return web.Response(status=500, text=str(e))
