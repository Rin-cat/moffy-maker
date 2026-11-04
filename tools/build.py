#!/usr/bin/env python3
"""moffy-studio.html から GitHub Pages 用の docs/index.html を作る。

使い方:
  python3 tools/build.py                       # 共有リンクなし（QR は DNA コードの文字）
  python3 tools/build.py https://<user>.github.io/<repo>/   # 共有リンクと OG 画像の絶対 URL を入れる
"""
import html, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "moffy-studio.html").read_text(encoding="utf-8")
site_url = sys.argv[1].strip() if len(sys.argv) > 1 else ""
if site_url and not site_url.endswith("/"):
    site_url += "/"

head, sep, body = src.partition('<div class="app">')
if not sep:
    sys.exit("moffy-studio.html に <div class=\"app\"> が見つかりません")
body = sep + body

title = re.search(r"<title>(.*?)</title>", head).group(1)
desc = re.search(r'<meta name="description" content="(.*?)">', head).group(1)
head = head.replace('<meta name="moffy-site-url" content="">',
                    f'<meta name="moffy-site-url" content="{html.escape(site_url)}">')
# 共有プレビュー（Discord・X・LINE などでリンクを貼ったときのカード）
og_image = (site_url + "og.png") if site_url else "og.png"
icon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
        "%3Ccircle cx='32' cy='34' r='26' fill='%238EC9F2'/%3E"
        "%3Ccircle cx='23' cy='32' r='8' fill='%231E1B2C'/%3E%3Ccircle cx='41' cy='32' r='8' fill='%231E1B2C'/%3E"
        "%3Cpath d='M23 26l2 6 6 0-6 2-2 6-2-6-6-2 6 0z M41 26l2 6 6 0-6 2-2 6-2-6-6-2 6 0z' fill='%23fff'/%3E%3C/svg%3E")
extra = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#4C5BD4">
<link rel="icon" href="{icon}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{og_image}">
{f'<meta property="og:url" content="{site_url}">' if site_url else ''}
<meta name="twitter:card" content="summary_large_image">
"""
reset = "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}</style>\n"
out = f"<!doctype html>\n<html lang=\"ja\">\n<head>\n{extra}{head.strip()}\n{reset}</head>\n<body>\n{body.strip()}\n</body>\n</html>\n"
(ROOT / "docs").mkdir(exist_ok=True)
(ROOT / "docs" / "index.html").write_text(out, encoding="utf-8")
(ROOT / "docs" / ".nojekyll").write_text("", encoding="utf-8")
print("docs/index.html を書き出しました", "(共有リンク: " + site_url + ")" if site_url else "(共有リンクなし)")
