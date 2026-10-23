# -*- coding: utf-8 -*-
"""Живое окно Пульта: подвинул ползунок — получил кадр.

1. Подготовка (один раз на ролик, в фоне): Старт, Разведка, Поток — через ту же память, что и полный
   прогон Пульта (потом кнопка «Запустить» возьмёт их готовыми). Плюс опора чёрного и общая яркость
   кадров для Скелета и дефликера.
2. Кадр: читаем окно соседей быстрым поиском и прогоняем через те же покадровые функции, что и
   ноды полного прогона (core_frame). Этапам со сверкой во времени даём прошлый кадр.
   Плавность ×2 в окне не показать — это свойство движения, её видно только в итоговом видео.
"""
import hashlib
import io
import json
import os
import threading
import time
import traceback

import numpy as np
import torch

from . import core_io, core_journal, core_ops, core_frame
from .node_judge import judge_frame

_LOCK = threading.Lock()
_SESS = {}          # ключ ролика → сессия
_PREP = {}          # ключ ролика → {"state": "preparing"/"ready"/"error", "msg": ..., "t0": ...}
_MEMO = {}          # кэш промежуточных кадров: (ключ, этап, подпись) → тензоры
_RENDER = threading.Lock()   # один кадр живого окна за раз; release_job ждёт, пока кадр дорисуется


def _same_dir(a, b):
    try:
        return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))
    except Exception:
        return False


def release_job(job_dir):
    """Основной прогон собирается пересчитать этап этой задачи: живое окно отпускает её файлы.

    Окно держит файлы потока открытыми (быстрый доступ к кадрам), а Windows не даёт
    перезаписывать открытый файл. После этого окно само подготовится заново — и возьмёт
    уже посчитанное из общей памяти Пульта.
    """
    import gc
    with _RENDER:
        with _LOCK:
            keys = [k for k, s in _SESS.items() if _same_dir(s["relay"]["job_dir"], job_dir)]
            for k in keys:
                sess = _SESS.pop(k)
                _PREP.pop(k, None)
                fl = sess.get("flows")
                if fl is not None:
                    try:
                        fl.fs.close()
                    except Exception:
                        pass
                for mk in [mk for mk in _MEMO if mk[0] == k]:
                    _MEMO.pop(mk, None)
    if keys:
        gc.collect()
        print(f"[PerceptionRelay] live: окно отпустило файлы задачи / live released files: {os.path.basename(os.path.normpath(job_dir))}")


class FlowStoreCache:
    """Поток для живого окна: произвольный доступ к кадрам, кэш ограничен (не копим память)."""

    def __init__(self, rep, h, w, dev, limit=24):
        from .node_judge import _FlowStore
        self.fs = _FlowStore(rep, h, w, dev)
        self.limit = limit
        self.order = []
        self.pairs = self.fs.pairs

    def to(self, t, d):
        r = self.fs.to(t, d)
        keys = list(self.fs.cache.keys())
        for k in keys:
            if k in self.order:
                self.order.remove(k)
            self.order.append(k)
        while len(self.order) > self.limit:
            old = self.order.pop(0)
            self.fs.cache.pop(old, None)
        return r


def _key(src, job):
    return hashlib.sha1(f"{src}|{job}".encode()).hexdigest()[:16]


def resolve_source(video_file, video_path):
    if video_file:
        video_file = video_file.strip()
        try:
            import folder_paths
            p = folder_paths.get_annotated_filepath(video_file)
            if p and os.path.isfile(p):
                return p
        except Exception:
            pass
        if os.path.isfile(video_file):
            return video_file
        try:  # «папка/имя» или имя без пометки [input] — ищем во входной папке Comfy
            import folder_paths
            name = video_file.split(" [")[0]
            p = os.path.join(folder_paths.get_input_directory(), name)
            if os.path.isfile(p):
                return p
        except Exception:
            pass
    p = (video_path or "").strip().strip('"')
    return p if p and os.path.isfile(p) else None


def _prepare(key, src, job, cards):
    from .node_hub import ensure_stages
    from . import core_comfy
    core_comfy.LOCAL.live = True
    stage_name = {"v": ""}

    def cb(i, total):
        _PREP[key]["msg"] = f"{stage_name['v']}: кадр {i} из {total} / frame {i} of {total}"
    core_comfy.LOCAL.progress_cb = cb
    print(f"[PerceptionRelay] live: подготовка / preparing {os.path.basename(src)}")
    try:
        prep_cards = {k: v for k, v in cards.items() if k in ("scout", "flow")}
        stage_name["v"] = "Старт, лица, поток / start, faces, motion"
        from .node_hub import _STAGES_LOCK
        _PREP[key]["msg"] = ("ждёт: идёт основной прогон — окно обновится после него / "
                             "waiting for the main run" if _STAGES_LOCK.locked() else stage_name["v"] + "…")
        relay, ran, reused = ensure_stages(job, None, src, prep_cards, only={"scout", "flow"})
        print(f"[PerceptionRelay] live: посчитано {ran or '—'}, из памяти {reused or '—'}")
        v = core_journal.video(relay)
        w, h = v["w"], v["h"]
        _PREP[key]["msg"] = "Опора чёрного и яркость кадров… / black anchors, brightness…"
        anchors, means = [], []
        for f in core_io.FrameReader(core_journal.stage_path(relay, "source.mkv"), w, h, "yuv", v["matrix"], v["range"]):
            small = f[::4, ::4]
            y = 0.2126 * small[..., 0] + 0.7152 * small[..., 1] + 0.0722 * small[..., 2]
            anchors.append(float(np.percentile(y, 0.5)))
            means.append(float(np.log(y.mean() + 0.02)))
        sess = {"relay": relay, "w": w, "h": h, "fps": v["fps"], "n": len(anchors), "v": v,
                "anchors": np.array(anchors), "means": np.array(means), "prep_sig": json.dumps(prep_cards, sort_keys=True),
                "flows": None, "faces": None}
        from .node_scout import load_faces
        sess["faces"] = load_faces(relay)
        frep = core_journal.report(relay, "flow")
        if frep:
            sess["flows"] = FlowStoreCache(frep, h, w, core_ops.device())
        with _LOCK:
            _SESS[key] = sess
            _PREP[key] = {"state": "ready", "msg": "готово / ready", "t0": _PREP[key]["t0"],
                          "prep_sig": sess["prep_sig"]}
        print("[PerceptionRelay] live: готово / ready")
    except Exception as e:
        print("[PerceptionRelay] live: ОШИБКА подготовки / preparation ERROR:")
        traceback.print_exc()
        _PREP[key] = {"state": "error", "msg": f"{type(e).__name__}: {e}", "t0": time.time(),
                      "prep_sig": json.dumps({k: v for k, v in cards.items() if k in ("scout", "flow")}, sort_keys=True)}
    finally:
        core_comfy.LOCAL.live = False
        core_comfy.LOCAL.progress_cb = None


def status(video_file, video_path, job, cards, retry=False):
    src = resolve_source(video_file, video_path)
    if not src:
        return None, {"state": "error", "msg": "Нет видео: выбери файл в Load Video или впиши путь / no video"}
    key = _key(src, job)
    prep_sig = json.dumps({k: v for k, v in cards.items() if k in ("scout", "flow")}, sort_keys=True)
    sess = _SESS.get(key)
    if sess and sess["prep_sig"] == prep_sig and os.path.isfile(sess["relay"]["journal"]):
        return key, {"state": "ready"}
    st = _PREP.get(key)
    if st and st["state"] == "preparing":
        return key, st
    # ошибка не перезапускается молча: показываем её, повтор — кнопкой «обновить окно» или сменой карточек
    if st and st["state"] == "error" and st.get("prep_sig") == prep_sig and not retry:
        return key, st
    _PREP[key] = {"state": "preparing", "msg": "запуск / starting", "t0": time.time()}
    _SESS.pop(key, None)
    threading.Thread(target=_prepare, args=(key, src, job, cards), daemon=True).start()
    return key, _PREP[key]


def _sig(*a):
    return hashlib.sha1(json.dumps(a, sort_keys=True, default=str).encode()).hexdigest()


def render(key, cards, pos, view, max_side=2048):
    """Кадр в позиции pos (0..1) → JPEG-байты и подпись."""
    sess = _SESS[key]
    w, h, n, dev = sess["w"], sess["h"], sess["n"], core_ops.device()
    t = int(round(pos * (n - 1)))
    flows, faces = sess["flows"], sess["faces"]
    relay = sess["relay"]
    v = sess["v"]
    src_path = core_journal.stage_path(relay, "source.mkv")
    map_note = ""

    def src_frames(lo, hi):
        mk = (key, "src", lo, hi)
        if mk not in _MEMO:
            for k in [k for k in _MEMO if k[0] == key and k[1] == "src"]:
                _MEMO.pop(k)
            fr = core_io.read_window(src_path, w, h, lo, hi - lo + 1, sess["fps"], "yuv", v["matrix"], v["range"])
            _MEMO[mk] = {lo + i: core_ops.to_t(f, dev) for i, f in enumerate(fr)}
        return _MEMO[mk]

    with torch.inference_mode():
        R = int(cards.get("judge", {}).get("radius", 2)) if "judge" in cards else 0
        lo, hi = max(0, t - 1 - R), min(n - 1, t + R)
        S = src_frames(lo, hi)
        cur = {u: S[u] for u in (t - 1, t) if u in S}     # текущее состояние двух кадров
        chain_sig = [t]

        def memo(stage, params, fn):
            nonlocal cur
            chain_sig.append([stage, params])
            mk = (key, stage, _sig(chain_sig))
            if mk not in _MEMO:
                _MEMO[mk] = fn()
                stale = [k for k in _MEMO if k[0] == key and k[1] == stage and k != mk]
                for k in stale:
                    _MEMO.pop(k)
            cur = _MEMO[mk]

        if "judge" in cards:
            P = cards["judge"]
            frep = core_journal.report(relay, "flow")
            unstable = set()
            if P.get("trust_flow_report", True) and frep:
                for a, b in frep["stats"].get("unstable_segments", []):
                    unstable.update(range(a, b + 2))
            memo("judge", P, lambda: {u: judge_frame(S, u, flows, faces, P, unstable, h, w, dev)[0]
                                      for u in cur})
        if "edge" in cards:
            P = cards["edge"]
            fc = faces if P.get("skip_faces", True) else None

            def run_edge():
                out, prev = {}, None
                for u in sorted(cur):
                    o, _, _, _, prev = core_frame.edge_frame(cur[u], u, P, fc, flows, prev, h, w, dev)
                    out[u] = o
                return out
            memo("edge", P, run_edge)
        if "tone" in cards:
            P = cards["tone"]
            a = sess["anchors"]
            sig_ = 4.0
            rr = int(sig_ * 3)
            kern = np.exp(-np.arange(-rr, rr + 1) ** 2 / (2 * sig_ * sig_))
            tgt = np.convolve(np.pad(a, rr, mode="edge"), kern / kern.sum(), mode="valid")

            def run_tone():
                out, state = {}, {}
                for u in sorted(cur):
                    out[u] = core_frame.tone_frame(cur[u], u, P, faces if P["face_fill"] > 0 else None, flows,
                                                   state, a[u], tgt[u], h, w, dev)[0]
                return out
            memo("tone", P, run_tone)
        if "seam" in cards:
            P = cards["seam"]

            def run_seam():
                out, prev = {}, None
                for u in sorted(cur):
                    o, _, _, prev = core_frame.seam_frame(cur[u], u, P, flows, prev)
                    out[u] = o
                return out
            memo("seam", P, run_seam)
        x = cur[t]
        if "polish" in cards:
            P = cards["polish"]
            g = 1.0
            if P.get("deflicker", 0) > 0:
                m = sess["means"]
                rr = 9
                kern = np.exp(-np.arange(-rr, rr + 1) ** 2 / 18.0)
                sm = np.convolve(np.pad(m, rr, mode="edge"), kern / kern.sum(), mode="valid")
                g = float(np.clip(np.exp((sm[t] - m[t]) * P["deflicker"]), 0.9, 1.1))
            x = core_frame.polish_tone(x * g, P)
        if "basic" in cards:
            x = core_frame.basic_frame(x, cards["basic"])
        if "points" in cards:
            rows = faces.get(t) if faces else None
            x, _ = core_frame.points_frame(x, cards["points"], rows, t, h, w, dev)

        before = S[t]
        if view.startswith("map") or view.startswith("карта"):
            # карта Доводчика: где сканер нашёл расплывшиеся детали (по уже обработанному кадру)
            from . import core_scan
            from .node_hub import RelayRefine, defaults
            P = cards.get("refine") or defaults(RelayRefine)
            rows = faces.get(t) if faces else None
            m, sinfo = core_scan.scan(x, P.get("sensitivity", 0.5), P.get("protect_edges", True), rows, dev)
            img = core_scan.overlay(x, m)
            map_note = f" · карта / map: {sinfo.get('area_pct', 0):.1f}% кадра"
        elif view.startswith("before") or view.startswith("до"):
            img = before
        elif view.startswith("split") or view.startswith("шторка"):
            half = w // 2
            img = torch.cat([before[..., :half], x[..., half:]], -1).clone()
            img[..., max(0, half - 1):half + 1] = 1.0
        else:
            img = x
        arr = core_ops.to_np(img)

    from PIL import Image
    im = Image.fromarray((arr * 255 + 0.5).astype(np.uint8))
    if max(im.size) > max_side:
        k = max_side / max(im.size)
        im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92)
    secs = t / core_io.fps_float(sess["fps"])
    note = (" · 🛠 Доводчик — после «Запустить»" if "refine" in cards and not view.startswith("map") else "")
    note += map_note
    return buf.getvalue(), f"кадр {t + 1}/{n} · {secs:.2f} с{note}"


def register_routes():
    """Служебный адрес /perception_relay/live внутри сервера Comfy."""
    try:
        from server import PromptServer
        from aiohttp import web
    except Exception:
        return False
    import asyncio
    routes = PromptServer.instance.routes
    busy = _RENDER

    @routes.post("/perception_relay/live")
    async def live(request):
        data = await request.json()
        from .node_hub import resolve_cards
        cards_raw = data.get("cards", [])
        cards, notes = resolve_cards([{"stage": c.get("stage"), "params": c.get("params", {})} for c in cards_raw])
        key, st = status(data.get("video_file"), data.get("video_path"), data.get("job_name", ""), cards,
                         bool(data.get("retry")))
        if st["state"] != "ready":
            el = time.time() - st.get("t0", time.time())
            return web.json_response({"state": st["state"], "msg": st.get("msg", ""), "seconds": round(el)})
        if not busy.acquire(blocking=False):
            return web.json_response({"state": "busy"})
        if key not in _SESS:   # окно только что отпустило файлы для основного прогона
            busy.release()
            return web.json_response({"state": "preparing", "msg": "окно обновляется / refreshing", "seconds": 0})
        try:
            loop = asyncio.get_event_loop()
            jpg, info = await loop.run_in_executor(
                None, render, key, cards, float(data.get("pos", 0.5)), data.get("view", "after"),
                int(data.get("max_side", 2048)))
        except Exception as e:
            traceback.print_exc()
            return web.json_response({"state": "error", "msg": f"{type(e).__name__}: {e}"})
        finally:
            busy.release()
        return web.Response(body=jpg, content_type="image/jpeg",
                            headers={"X-Relay-Info": info.encode("utf-8").hex(), "Cache-Control": "no-store"})

    @routes.post("/perception_relay/live_seq")
    async def live_seq(request):
        data = await request.json()
        from .node_hub import resolve_cards
        cards, _ = resolve_cards([{"stage": c.get("stage"), "params": c.get("params", {})}
                                  for c in data.get("cards", [])])
        key, st = status(data.get("video_file"), data.get("video_path"), data.get("job_name", ""), cards)
        if st["state"] != "ready":
            return web.json_response({"state": st["state"], "msg": st.get("msg", "")})
        if not busy.acquire(blocking=False):
            return web.json_response({"state": "busy"})
        if key not in _SESS:   # окно только что отпустило файлы для основного прогона
            busy.release()
            return web.json_response({"state": "preparing", "msg": "окно обновляется / refreshing", "seconds": 0})
        try:
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(
                None, render_seq, key, cards, float(data.get("pos", 0.5)), int(data.get("count", 24)),
                data.get("view", "after"), int(data.get("max_side", 1280)))
        except Exception as e:
            traceback.print_exc()
            return web.json_response({"state": "error", "msg": f"{type(e).__name__}: {e}"})
        finally:
            busy.release()
        res["state"] = "ok"
        return web.json_response(res)

    return True


def render_seq(key, cards, pos, count, view, max_side=1280):
    """Короткий кусок ролика для проигрывания по кругу: кадры подряд с памятью о предыдущем,
    каждый считается один раз. Плавность ×2 сюда не входит (это свойство движения)."""
    import base64
    from PIL import Image
    sess = _SESS[key]
    w, h, n, dev = sess["w"], sess["h"], sess["n"], core_ops.device()
    flows, faces, relay, v = sess["flows"], sess["faces"], sess["relay"], sess["v"]
    count = max(2, min(int(count), 72))
    t0 = int(round(pos * (n - 1)))
    t0 = max(0, min(t0, n - count))
    t1 = min(n - 1, t0 + count - 1)
    R = int(cards.get("judge", {}).get("radius", 2)) if "judge" in cards else 0
    lo, hi = max(0, t0 - 1 - R), min(n - 1, t1 + R)
    fr = core_io.read_window(core_journal.stage_path(relay, "source.mkv"), w, h, lo, hi - lo + 1,
                             sess["fps"], "yuv", v["matrix"], v["range"])
    S = {lo + i: core_ops.to_t(f, dev) for i, f in enumerate(fr)}
    frep = core_journal.report(relay, "flow")
    unstable = set()
    if "judge" in cards and cards["judge"].get("trust_flow_report", True) and frep:
        for a, b in frep["stats"].get("unstable_segments", []):
            unstable.update(range(a, b + 2))
    a = sess["anchors"]
    rr = 12
    kern = np.exp(-np.arange(-rr, rr + 1) ** 2 / 32.0)
    tgt = np.convolve(np.pad(a, rr, mode="edge"), kern / kern.sum(), mode="valid")
    m = sess["means"]
    kern2 = np.exp(-np.arange(-9, 10) ** 2 / 18.0)
    msm = np.convolve(np.pad(m, 9, mode="edge"), kern2 / kern2.sum(), mode="valid")
    prev_e = prev_s = None
    tone_state = {}
    out = []
    with torch.inference_mode():
        for u in range(max(0, t0 - 1), t1 + 1):
            x = S[u]
            if "judge" in cards:
                x = judge_frame(S, u, flows, faces, cards["judge"], unstable, h, w, dev)[0]
            if "edge" in cards:
                P = cards["edge"]
                x, _, _, _, prev_e = core_frame.edge_frame(x, u, P, faces if P.get("skip_faces", True) else None,
                                                           flows, prev_e, h, w, dev)
            if "tone" in cards:
                P = cards["tone"]
                x = core_frame.tone_frame(x, u, P, faces if P["face_fill"] > 0 else None, flows, tone_state,
                                          a[u], tgt[u], h, w, dev)[0]
            if "seam" in cards:
                x, _, _, prev_s = core_frame.seam_frame(x, u, cards["seam"], flows, prev_s)
            if u < t0:
                continue
            if "polish" in cards:
                P = cards["polish"]
                g = float(np.clip(np.exp((msm[u] - m[u]) * P.get("deflicker", 0)), 0.9, 1.1))
                x = core_frame.polish_tone(x * g, P)
            if "basic" in cards:
                x = core_frame.basic_frame(x, cards["basic"])
            if "points" in cards:
                x, _ = core_frame.points_frame(x, cards["points"], faces.get(u) if faces else None, u, h, w, dev)
            before = S[u]
            if view.startswith("before") or view.startswith("до"):
                img = before
            elif view.startswith("split") or view.startswith("шторка"):
                half = w // 2
                img = torch.cat([before[..., :half], x[..., half:]], -1).clone()
                img[..., max(0, half - 1):half + 1] = 1.0
            else:
                img = x
            im = Image.fromarray((core_ops.to_np(img) * 255 + 0.5).astype(np.uint8))
            if max(im.size) > max_side:
                k = max_side / max(im.size)
                im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=88)
            out.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    fps = core_io.fps_float(sess["fps"])
    return {"frames": out, "fps": fps,
            "info": f"кадры {t0 + 1}–{t1 + 1}/{n} · {t0 / fps:.2f}–{t1 / fps:.2f} с"}
