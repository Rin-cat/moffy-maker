#!/usr/bin/env python3
"""Gemini の Canvas に貼る1ファイル版を作る: python3 tools/build_canvas.py

moffy-studio.html（GitHub 版と同じ中身）を、Canvas モードで書き出す。
  - 画面の中で画像まで生成する（目の見本・基準画像などは、指示書の順番で自動で添付する）
  - 共有リンクと QR は、GitHub Pages の版（https://rin-cat.github.io/moffy-maker/）を指す
  - ページ上部の絵は GitHub Pages から読む（読めなければ隠す）

書き出すもの: canvas/moffy-canvas.html
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://rin-cat.github.io/moffy-maker/"
src = (ROOT / "moffy-studio.html").read_text(encoding="utf-8")
head, sep, body = src.partition('<div class="app">')
if not sep:
    sys.exit('moffy-studio.html に <div class="app"> が見つかりません')
body = sep + body

def sub1(pattern, repl, text):
    out, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        sys.exit(f"見つかりません: {pattern}")
    return out

head = sub1(r'<meta name="moffy-mode" content="">', '<meta name="moffy-mode" content="canvas">', head)
head = sub1(r'<meta name="moffy-site-url" content="">', f'<meta name="moffy-site-url" content="{SITE}">', head)
head = sub1(r"<title>(.*?)</title>", r"<title>\1（Canvas 版）</title>", head)
body = sub1(r'<img src="assets/hero\.jpg"', f'<img src="{SITE}assets/hero.jpg" onerror="this.closest(\'figure\').hidden=true"', body)

out = ("<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n"
       "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
       f"{head.strip()}\n<style>body{{margin:0}}img{{max-width:100%}}</style>\n</head>\n<body>\n{body.strip()}\n</body>\n</html>\n")
(ROOT / "canvas").mkdir(exist_ok=True)
dst = ROOT / "canvas" / "moffy-canvas.html"
dst.write_text(out, encoding="utf-8")
print(f"canvas/moffy-canvas.html を書き出しました（{len(out.encode('utf-8')) // 1024}KB）")
