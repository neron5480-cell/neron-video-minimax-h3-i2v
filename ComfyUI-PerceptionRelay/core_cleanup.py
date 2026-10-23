# -*- coding: utf-8 -*-
"""
Уборка рабочих папок Эстафеты / Perception Relay work-folder cleanup.

RU: Для каждого ролика Эстафета хранит результат каждого этапа (без потерь, 16 бит),
    чтобы при смене одного ползунка пересчитывать только этапы после него.
    Это ~5 ГБ на 10 секунд видео. Раньше старые папки не удалялись никогда.
    Теперь:
      * полные рабочие папки хранятся только для последних `keep_jobs` роликов
        (по умолчанию 2), более старые удаляются после прогона;
      * внутри текущей задачи удаляются файлы этапов, которых уже нет в цепочке.
    Готовые ролики (…_pult_001.mp4, …_compare_001.mp4) лежат рядом с папками
    задач и НЕ удаляются. Папка «для_отправки» (отчёты) НЕ трогается.
    Настройка: output/perception_relay/settings.json → "keep_jobs" (0 — не удалять ничего).

EN: Relay keeps every stage result per clip (lossless 16-bit) so changing one slider only
    recomputes later stages — about 5 GB per 10 s of video. Old folders were never removed.
    Now only the last `keep_jobs` clips (default 2) keep their full work folders; older ones
    are deleted after a run, and stage files no longer in the chain are removed.
    Final videos and the report folder are never touched.
    Setting: output/perception_relay/settings.json → "keep_jobs" (0 = never delete).
"""
import json
import os
import shutil

from . import core_comfy

DEFAULT_KEEP_JOBS = 2
REPORTS_DIR = "для_отправки"
_TAG = "[PerceptionRelay]"


def _root():
    return os.path.join(core_comfy.output_dir(), "perception_relay")


def _settings():
    path = os.path.join(_root(), "settings.json")
    data = {}
    try:
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                data = json.load(f) or {}
        else:
            os.makedirs(_root(), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump({
                    "keep_jobs": DEFAULT_KEEP_JOBS,
                    "_help_ru": "Сколько последних роликов хранят полные рабочие папки (для быстрой "
                                "подстройки ползунков). Старые удаляются после прогона. 0 — не удалять ничего. "
                                "Готовые видео и отчёты не удаляются никогда.",
                    "_help_en": "How many recent clips keep full work folders (for fast slider tweaks). "
                                "Older ones are deleted after a run. 0 = never delete. "
                                "Final videos and reports are never deleted.",
                }, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"{_TAG} settings.json не прочитан / not read: {e}")
    return data


def keep_jobs():
    try:
        return max(0, int(_settings().get("keep_jobs", DEFAULT_KEEP_JOBS)))
    except Exception:
        return DEFAULT_KEEP_JOBS


def _size(path):
    total = 0
    for d, _, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(d, f))
            except OSError:
                pass
    return total


def _gb(n):
    return f"{n / 1024 ** 3:.2f} ГБ/GB"


def _same(a, b):
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def _is_job_dir(path):
    return (os.path.isdir(path) and not os.path.islink(path)
            and os.path.basename(path) != REPORTS_DIR
            and os.path.isfile(os.path.join(path, "journal.json")))


def _release(job_dir):
    try:
        from . import core_live
        core_live.release_job(job_dir)
    except Exception:
        pass


def prune_old_jobs(current_job_dir):
    """Оставить полные папки только последних keep_jobs задач (текущая — одна из них)."""
    keep = keep_jobs()
    root = _root()
    if keep <= 0 or not os.path.isdir(root):
        return
    jobs = []
    for name in os.listdir(root):
        p = os.path.join(root, name)
        if _is_job_dir(p) and not _same(p, current_job_dir):
            try:
                jobs.append((os.path.getmtime(os.path.join(p, "journal.json")), p))
            except OSError:
                pass
    jobs.sort(reverse=True)                  # свежие первыми
    old = jobs[max(0, keep - 1):]            # текущая задача занимает одно место
    freed = 0
    for _, p in old:
        size = _size(p)
        _release(p)
        shutil.rmtree(p, ignore_errors=True)
        if not os.path.exists(p):
            freed += size
            print(f"{_TAG} удалена старая рабочая папка / old work folder removed: {os.path.basename(p)}")
    if freed:
        print(f"{_TAG} освобождено / freed: {_gb(freed)} (хранить задач / keep jobs = {keep})")


def prune_unused_stages(job_dir):
    """Удалить видео этапов, на которые больше не ссылается память Пульта (hub_cache.json)."""
    cache_path = os.path.join(job_dir, "hub_cache.json")
    if not os.path.isfile(cache_path):
        return
    try:
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f) or {}
    except Exception:
        return
    used = set()
    for entry in cache.values():
        try:
            used.add(os.path.normcase(os.path.abspath(entry["relay"]["current"]["path"])))
        except Exception:
            pass
    if not used:
        return
    freed = 0
    for name in os.listdir(job_dir):
        if not name.lower().endswith(".mkv") or name.lower() == "source.mkv":
            continue
        p = os.path.join(job_dir, name)
        if os.path.normcase(os.path.abspath(p)) in used:
            continue
        try:
            size = os.path.getsize(p)
            os.remove(p)
            freed += size
        except OSError:
            pass
    temp = os.path.join(job_dir, "final_noaudio.mp4")       # промежуточный файл Финиша
    if os.path.isfile(temp):
        try:
            freed += os.path.getsize(temp)
            os.remove(temp)
        except OSError:
            pass
    if freed:
        print(f"{_TAG} убраны лишние файлы этапов / unused stage files removed: {_gb(freed)}")
