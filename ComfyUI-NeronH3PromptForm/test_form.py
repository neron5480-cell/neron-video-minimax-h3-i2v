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

CASES = [
    {"lang": "RU", "place": "1978 год, гараж на окраине, осень, вечер",
     "heroes": "1) Мужчина лет 55, седые усы, кепка\n2) Мотоцикл «Урал» с коляской",
     "action": "0–2 с: мужчина затягивает гайку, ключ срывается\n2–4 с: трясёт рукой\n4–5 с: садится на ящик.",
     "camera": "Стоит у ворот, не двигается", "sound": "Скрип ключа, гудение лампы",
     "speech": "Мужчина хрипло: «Ну и зараза…»", "pictures": "<Картинка 1> — этот мужчина, <image 2> — мотоцикл"},
    {"lang": "RU", "action": "Иван открывает дверь\nВходит в комнату\nСадится за стол", "music": "тихое пианино"},
    {"lang": "EN", "place": "A rainy street at night", "heroes": "- A woman in a red coat\n- A black umbrella",
     "action": "She walks\nShe stops\nShe turns", "camera": "Camera follows her from behind"},
    {"lang": "EN", "action": "1.5-3 s: the dog jumps", "links": False, "sound": "barking"},
    {"lang": "RU", "camera": "камера медленно наезжает", "no_music": False},
    {"lang": "RU"},
    {"lang": "RU", "action": "5 секунд тишины\nпотом взрыв"},
    {"lang": "RU", "action": "Она шепчет: «Кто здесь?»", "speech": "«Кто здесь?»"},
    {"lang": "EN", "heroes": "Мужчина в кепке\nСобака", "camera": "стоит"},
    {"lang": "RU", "heroes": "A man\nA dog", "sound": "barking"},
]

EXPECT_0 = ("1978 год, гараж на окраине, осень, вечер. В кадре: Мужчина лет 55, седые усы, кепка. Также в кадре: "
            "Мотоцикл «Урал» с коляской. 0–2 с: мужчина затягивает гайку, ключ срывается. 2–4 с: трясёт рукой. "
            "4–5 с: садится на ящик. Камера: Стоит у ворот, не двигается. Звук сцены: Скрип ключа, гудение лампы. "
            "Речь: Мужчина хрипло: «Ну и зараза…» Образцы: <Picture 1> — этот мужчина, <Picture 2> — мотоцикл. "
            "Без музыки.")


def py_all():
    return [form.compile_form(c) for c in CASES]


def js_all():
    node_bin = shutil.which("node")
    if not node_bin:
        print("Node.js нет — сверка с JS пропущена")
        return None
    src = open(os.path.join(HERE, "web", "prompt_form.js"), encoding="utf-8").read()
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
    assert py[8].startswith("В кадре:") and py[8].endswith("Без музыки."), py[8]
    assert py[9].startswith("In the frame:") and py[9].endswith("No music."), py[9]
    assert form.parse("просто текст") == {"action": "просто текст", "links": False}
    js = js_all()
    if js is not None:
        for i, (a, b) in enumerate(zip(py, js)):
            assert a == b, f"случай {i}: PY={a!r}\nJS={b!r}"
        print(f"PY == JS: {len(py)} случаев совпали")
    print("OK")
