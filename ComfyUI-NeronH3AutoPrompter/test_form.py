# -*- coding: utf-8 -*-
"""Проверка склейки бланка: form.py и web/prompt_form.js должны давать одинаковый текст.
Запуск: python test_form.py (нужен Node.js для сверки с JS). Run: python test_form.py"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import form  # noqa: E402

T = {"format": "text"}
CASES = [
    dict(T, lang="RU", place="1978 год, гараж на окраине, осень, вечер",
         heroes="1) Мужчина лет 55, седые усы, кепка\n2) Мотоцикл «Урал» с коляской",
         action="0–2 с: мужчина затягивает гайку, ключ срывается\n2–4 с: трясёт рукой\n4–5 с: садится на ящик.",
         camera="Стоит у ворот, не двигается", sound="Скрип ключа, гудение лампы",
         speech="Мужчина хрипло: «Ну и зараза…»", pictures="<Картинка 1> — этот мужчина, <image 2> — мотоцикл"),
    dict(T, lang="RU", action="Иван открывает дверь\nВходит в комнату\nСадится за стол", music="тихое пианино"),
    dict(T, lang="EN", place="A rainy street at night", heroes="- A woman in a red coat\n- A black umbrella",
         action="She walks\nShe stops\nShe turns", camera="Camera follows her from behind"),
    dict(T, lang="EN", action="1.5-3 s: the dog jumps", links=False, sound="barking"),
    dict(T, lang="RU", camera="камера медленно наезжает", no_music=False),
    {"lang": "RU"},
    dict(T, lang="RU", action="5 секунд тишины\nпотом взрыв"),
    dict(T, lang="RU", action="Она шепчет: «Кто здесь?»", speech="«Кто здесь?»"),
    dict(T, lang="EN", heroes="Мужчина в кепке\nСобака", camera="стоит"),
    dict(T, lang="RU", heroes="A man\nA dog", sound="barking"),
    dict(T, action="бежит", seconds=1), dict(T, action="бежит", seconds=3), dict(T, action="бежит", seconds=11),
    dict(T, action="бежит", seconds=21), dict(T, action="runs", seconds=1), dict(T, action="runs", seconds=99),
    dict(T, action="бежит", seconds="abc"), dict(T, action="бежит", time=False),
    # --- родной формат H3 ---
    {"seconds": 10, "place": "солнечное лето, двор", "heroes": "старый москвич, стоит на месте\nвзрослый мужчина",
     "action": "мужчина напряжённо ремонтирует под капотом.", "camera": "медленно облетает машину",
     "sound": "звук двора. пение птиц.", "speech": "нет", "music": "нет", "pictures": "<картинка 1> — двор"},
    {"seconds": 5, "lang": "EN", "heroes": "A man\nA woman", "action": "They argue",
     "speech": "the man, angry, in English: \"Get out!\"\nthe woman, calm: “No.”", "music": "soft piano"},
    {"seconds": 15, "action": "дождь", "no_speech": False, "no_music": False, "time": False},
    {"pictures": "<Picture 1>"},
]

EXPECT_0 = ("Длительность ролика — 5 секунд (0–5 с). 1978 год, гараж на окраине, осень, вечер. В кадре: Мужчина лет "
            "55, седые усы, кепка. Также в кадре: Мотоцикл «Урал» с коляской. 0–2 с: мужчина затягивает гайку, ключ "
            "срывается. 2–4 с: трясёт рукой. 4–5 с: садится на ящик. Камера: Стоит у ворот, не двигается. Звук сцены: "
            "Скрип ключа, гудение лампы. Речь: Мужчина хрипло: «Ну и зараза…» Образцы: <Picture 1> — этот мужчина, "
            "<Picture 2> — мотоцикл. Без музыки.")
EXPECT_H3 = """How the reference pictures align with the target video - <Picture 1> — двор. Target duration 10.13 seconds.

summary:
солнечное лето, двор. мужчина напряжённо ремонтирует под капотом.

subject_definitions:
<Subject 1> — старый москвич, стоит на месте.
<Subject 2> — взрослый мужчина.

integrated_multimodal_description: [Shot 1] медленно облетает машину. мужчина напряжённо ремонтирует под капотом.

overall_soundscape: звук двора. пение птиц. Голосов и речи нет.

non_diegetic_music: N/A"""


def py_all():
    return [form.compile_form(c) for c in CASES]


def js_all():
    node_bin = shutil.which("node")
    if not node_bin:
        print("Node.js нет — сверка с JS пропущена")
        return None
    src = open(os.path.join(HERE, "web", "autoprompter_blank.js"), encoding="utf-8").read()
    src = "\n".join(l for l in src.splitlines() if not l.startswith("import "))
    src = "const app = { registerExtension() {} };\n" + src
    src += "\nconsole.log(JSON.stringify(%s.map(compileForm)));\n" % json.dumps(CASES, ensure_ascii=False)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.mjs")
        open(p, "w", encoding="utf-8").write(src)
        out = subprocess.run([node_bin, p], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    return json.loads(out)


if __name__ == "__main__":
    py = py_all()
    for c, t in zip(CASES, py):
        print("—", t)
    assert py[0] == EXPECT_0, py[0]
    assert py[5] == "", py[5]
    assert "Голосов и речи нет." in py[1] and "Без музыки" not in py[1], py[1]
    assert py[10].startswith("Длительность ролика — 1 секунда (0–1 с)."), py[10]
    assert py[11].startswith("Длительность ролика — 3 секунды"), py[11]
    assert py[12].startswith("Длительность ролика — 11 секунд"), py[12]
    assert py[14].startswith("Video duration: 1 second (0–1 s)."), py[14]
    assert py[15].startswith("Video duration: 15 seconds (0–15 s)."), py[15]
    assert not py[17].startswith("Длительность"), py[17]
    assert py[18] == EXPECT_H3, py[18]
    assert "(S1) the man, angry, in English: <d>Get out!</d>" in py[19] and "(S2) the woman, calm: <d>No.</d>" in py[19]
    assert "non_diegetic_music: soft piano." in py[19] and "No voices" not in py[19] and "Target duration 5.17" in py[19]
    assert "Target duration" not in py[20] and "N/A" not in py[20] and "Голосов" not in py[20], py[20]
    assert "Камера неподвижна." in py[20], py[20]
    assert py[21] == "", py[21]
    assert [form.grid_seconds_text(x) for x in (5, 10, 15)] == ["5.17", "10.13", "15.08"]
    assert form.parse("просто текст")["action"] == "просто текст"
    # бриф для LLM
    b = form.build_brief({"seconds": 10, "heroes": "машина\nмужчина", "action": "чинит", "speech": "нет",
                          "music": "-"}, 1, True)
    assert b.startswith("TARGET DURATION: 10.13 seconds.\nREFERENCES: Picture 1, Last frame attached"), b
    assert "SUBJECTS:\n1. машина\n2. мужчина" in b and "SPEECH: none — nobody speaks." in b and "MUSIC: none." in b, b
    assert "CAMERA: not specified — the camera remains static." in b, b
    b2 = form.build_brief({"action": "x", "speech": "он: «Привет»", "camera": "наезд"})
    assert "no pictures attached — text-to-video" in b2 and "SPEECH:\n1. он: «Привет»" in b2 and "CAMERA: наезд" in b2
    assert form.clean_answer("Ok!\n<think>..</think>```\nTarget duration 5.17 seconds.\n```") == \
        "Target duration 5.17 seconds."
    t = form.build_brief({"seconds": 10, "action": "чинит"})
    assert "- 0.00–3.38 s: чинит" in t and "- 6.75–10.13 s: continues the same activity" in t, t
    t = form.build_brief({"seconds": 5, "action": "a\nb\nc\nd"})
    assert "- 0.00–1.29 s: a" in t and "- 3.88–5.17 s: d" in t, t
    t = form.build_brief({"seconds": 10, "action": "0-2 с: a\n2-5 с: b"})
    assert "own timings" in t and "10.13 seconds" in t and "- 0-2 с: a" in t, t
    assert not form.has_content({"music": "piano", "pictures": "x"}) and form.has_content({"camera": "static"})
    js = js_all()
    if js is not None:
        for i, (a, b) in enumerate(zip(py, js)):
            assert a == b, f"случай {i}: PY={a!r}\nJS={b!r}"
        print(f"PY == JS: {len(py)} случаев совпали")
    print("OK")
