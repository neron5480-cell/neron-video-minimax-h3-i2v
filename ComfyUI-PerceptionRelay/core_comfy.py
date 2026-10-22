# -*- coding: utf-8 -*-
"""Мостик к ComfyUI: папки, прогресс, прерывание. Без Comfy тоже работает (для тестов).

В фоновом потоке живого окна (вне очереди Comfy) прогресс и «прервать» Comfy не трогаем —
там нет выполняемого промпта. Вместо этого прогресс уходит в статус живого окна.
"""
import os
import threading
import time

LOCAL = threading.local()   # LOCAL.live = True в потоке подготовки живого окна; LOCAL.progress_cb(i, total)


def output_dir():
    try:
        import folder_paths
        return folder_paths.get_output_directory()
    except Exception:
        return os.path.abspath("output")


def models_dir():
    try:
        import folder_paths
        d = os.path.join(folder_paths.models_dir, "perception_relay")
    except Exception:
        d = os.path.abspath(os.path.join("models", "perception_relay"))
    os.makedirs(d, exist_ok=True)
    return d


def send(event, data):
    """Сообщение в интерфейс (часы Пульта). Без сервера Comfy — молча ничего."""
    try:
        from server import PromptServer
        PromptServer.instance.send_sync(event, data)
    except Exception:
        pass


def stage(name):
    """Какой этап сейчас идёт — для часов Пульта."""
    LOCAL.stage = name
    if not getattr(LOCAL, "live", False):
        send("perception_relay.progress", {"stage": name, "i": 0, "total": 0})


class Progress:
    def __init__(self, total):
        self.bar = None
        self.total = max(1, total)
        self.i = 0
        self.t_sent = 0.0
        self.live = getattr(LOCAL, "live", False)
        self.cb = getattr(LOCAL, "progress_cb", None) if getattr(LOCAL, "live", False) else None
        if not getattr(LOCAL, "live", False):
            try:
                import comfy.utils
                self.bar = comfy.utils.ProgressBar(self.total)
            except Exception:
                pass

    def step(self):
        self.i += 1
        if self.bar is not None:
            try:
                self.bar.update(1)
            except Exception:
                self.bar = None
        if self.cb is not None:
            try:
                self.cb(self.i, self.total)
            except Exception:
                pass
        if not self.live:
            now = time.time()
            if now - self.t_sent > 0.5 or self.i >= self.total:
                self.t_sent = now
                send("perception_relay.progress",
                     {"stage": getattr(LOCAL, "stage", ""), "i": self.i, "total": self.total})


def check_interrupt():
    if getattr(LOCAL, "live", False):
        return
    try:
        import comfy.model_management as mm
        mm.throw_exception_if_processing_interrupted()
    except ImportError:
        pass
