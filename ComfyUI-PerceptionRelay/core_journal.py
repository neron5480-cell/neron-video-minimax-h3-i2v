# -*- coding: utf-8 -*-
"""Бортовой журнал эстафеты и «палочка» RELAY.

RELAY — маленький словарь, который нода передаёт следующей:
  job_dir  — папка задачи
  journal  — путь к journal.json
  current  — {"path", "kind"} — видео, которое отдал последний этап
  chain    — список пройденных этапов (по нему читаются только актуальные отчёты)
Каждая нода возвращает НОВЫЙ словарь, поэтому байпас ноды в Comfy работает честно.
"""
import copy
import json
import os
import time

STAGE_TITLES = {
    "start": "Старт",
    "scout": "Разведка",
    "flow": "Поток",
    "judge": "Судья",
    "edge": "Огранка",
    "tone": "Тональный скелет",
    "seam": "Цветовой шов",
    "polish": "Полировка",
    "basic": "Основное",
    "refine": "Доводчик",
    "finish": "Финиш",
}


def load(relay):
    with open(relay["journal"], "r", encoding="utf-8") as f:
        return json.load(f)


def save(relay, data):
    tmp = relay["journal"] + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, relay["journal"])


def new_journal(path, source, video):
    data = {"version": 1, "created": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": source, "video": video, "tasks": {}, "reports": {}}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def write_stage(relay, stage, task, summary, stats=None, files=None, seconds=None):
    """Нода записывает своё задание и отчёт."""
    data = load(relay)
    data["tasks"][stage] = task
    data["reports"][stage] = {
        "time": time.strftime("%H:%M:%S"),
        "seconds": round(seconds, 1) if seconds is not None else None,
        "summary": summary,
        "stats": stats or {},
        "files": files or {},
    }
    save(relay, data)


def report(relay, stage):
    """Отчёт этапа — только если этап реально в цепочке (не байпаснут и не устарел)."""
    if stage not in relay.get("chain", []):
        return None
    return load(relay)["reports"].get(stage)


def video(relay):
    return load(relay)["video"]


def size(relay):
    """Текущий размер кадра: Доводчик может увеличить видео, дальше по эстафете — уже новый размер."""
    v = video(relay)
    cur = relay.get("current", {})
    return int(cur.get("w", v["w"])), int(cur.get("h", v["h"]))


def advance(relay, stage, current=None):
    r = copy.deepcopy(relay)
    if current is not None:
        r["current"] = current
    r["chain"] = [s for s in r.get("chain", []) if s != stage] + [stage]
    return r


def stage_path(relay, name):
    return os.path.join(relay["job_dir"], name)


def render_text(relay):
    data = load(relay)
    v = data["video"]
    lines = [f"Задача: {os.path.basename(relay['job_dir'])}",
             f"Исходник: {data['source']}",
             f"Видео: {v['w']}x{v['h']}, {v['fps']} к/с, {v['frames']} кадров, "
             f"звук: {'есть' if v.get('has_audio') else 'нет'}",
             f"Цепочка: {' → '.join(STAGE_TITLES.get(s, s) for s in relay.get('chain', []))}",
             ""]
    for s in relay.get("chain", []):
        rep = data["reports"].get(s)
        if not rep:
            continue
        sec = f", {rep['seconds']} с" if rep.get("seconds") is not None else ""
        lines.append(f"■ {STAGE_TITLES.get(s, s)} ({rep['time']}{sec})")
        for ln in rep["summary"]:
            lines.append("   " + ln)
        lines.append("")
    return "\n".join(lines)
