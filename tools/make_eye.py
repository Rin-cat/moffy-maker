#!/usr/bin/env python3
"""標準の目の見本を作る: python3 tools/make_eye.py <もとの画像>

もとの画像は、作者が Gemini で作ったレインボーのモッフィー（正面・白背景、2000x1016）。リポジトリには入れていない。
その右目を、目玉（白目）の円で切り抜いて白い正方形に置く（公式ジェネレーターと同じく、白い正方形の見本）。
目玉に毛がかかっていた所は、見えている白目の陰影から作った色でうめ、円い目玉にそろえる。
虹彩（虹色の輪・内側の深い色・大きな白い四芒星・左上の四角いツヤ・右下の小さな丸いツヤ）は、もとの絵のまま。

書き出すもの
  assets/eye-sample.png          標準の目の見本（768x768。もとの絵）
  moffy-studio.html の EYE_SRC   同じ絵の JPEG（data URL。ツールはこれを目の見本の初期値にする）
  moffy-studio.html の EYE_IRIS  虹彩の上下の位置（クラシックの青→紫に色を置きかえるときに使う）

メモ：虹彩を白目の真ん中に移して「正面を向いた目」に作り直すことも試したが、もとの目は内向きで
遠近がついており、解像度も低い（目玉の直径が約130px）ため、虹彩がゆがんだ。切り抜きのほうが自然。
"""
import base64, io, pathlib, re, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv) < 2:
    sys.exit(__doc__)
src = Image.open(sys.argv[1]).convert("RGB")
if src.size != (2000, 1016):
    sys.exit(f"想定と違う画像です（{src.size}）。座標は 2000x1016 の画像に合わせてあります")

EX, EY, ER = 1113.0, 390.5, 66.5            # 右目の目玉（白目）の円
IX, IY, IRX, IRY = 1101.5, 393.5, 55.5, 58.5  # 虹彩（内向きなので少し横に細い楕円）
S = 768; C = S / 2; RB = S * 0.36; K = RB / ER

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def hsv(I):
    mx = I.max(-1); mn = I.min(-1); dd = mx - mn + 1e-6; R, G, B = I[..., 0], I[..., 1], I[..., 2]
    H = np.where(mx == R, ((G - B) / dd) % 6, np.where(mx == G, (B - R) / dd + 2, (R - G) / dd + 4)) * 60
    return H, np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0), mx

# 1) 目玉のまわりを拡大（圧縮のノイズを少しならしてから。拡大後に輪郭を少し立てる）
aff = (1 / K, 0, EX - C / K, 0, 1 / K, EY - C / K)
I = np.asarray(src.filter(ImageFilter.GaussianBlur(0.5)).transform((S, S), Image.AFFINE, aff, resample=Image.BICUBIC)
               .filter(ImageFilter.UnsharpMask(radius=2.4, percent=70, threshold=2))).astype(np.float32) / 255
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5
r = np.hypot(xx - C, yy - C)
icx, icy, irx, iry = C + (IX - EX) * K, C + (IY - EY) * K, IRX * K, IRY * K
ie = np.hypot((xx - icx) / irx, (yy - icy) / iry)  # 1 が虹彩のふち

# 2) 目玉に毛がかかっていた所を、白目の陰影（位置の2次式をあてはめたもの）でうめる
H, Sa, V = hsv(I)
scl = (r < RB * 0.97) & (ie > 1.06) & (Sa < 0.12) & (V > 0.55)
u, v = (xx - C) / RB, (yy - C) / RB
M = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], -1)
model = np.clip(M @ np.linalg.lstsq(M[scl], I[scl], rcond=None)[0], 0, 1)
bad = np.clip(smooth(0.10, 0.20, Sa) + smooth(0.55, 0.45, V), 0, 1) * smooth(1.02, 1.08, ie)
bad = np.asarray(Image.fromarray((bad * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(3))
                 .filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
fill = (bad * smooth(1.0, 1.04, ie))[..., None]
I = I * (1 - fill) + model * fill

# 3) 白い形（四芒星・ツヤ）は、ふちをくっきりさせ直す
A = np.asarray(src).astype(np.float32) / 255
white = np.clip((A.min(-1) - 0.80) / 0.15, 0, 1)
Wu = np.asarray(Image.fromarray((white * 255).astype(np.uint8), "L").transform((S, S), Image.AFFINE, aff, resample=Image.BICUBIC)).astype(np.float32) / 255
Wm = (smooth(0.42, 0.58, Wu) * (ie < 1.0))[..., None]
I = I * (1 - Wm) + Wm

# 4) 目玉の輪郭にごく細い影をつけ、白い正方形に置く
edge = smooth(RB - 3.0, RB - 0.8, r) * (1 - smooth(RB - 0.6, RB + 0.6, r))
I = I * (1 - 0.18 * edge[..., None]) + np.array([0.55, 0.58, 0.65]) * 0.18 * edge[..., None]
m = (1 - smooth(RB - 0.9, RB + 0.6, r))[..., None]
out = np.ones((S, S, 3), np.float32) * (1 - m) + I * m
img = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
(ROOT / "assets").mkdir(exist_ok=True)
img.save(ROOT / "assets" / "eye-sample.png", optimize=True)

# 5) ツールに埋めこむ
buf = io.BytesIO()
img.save(buf, "JPEG", quality=88, optimize=True, progressive=True)
url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
html = ROOT / "moffy-studio.html"
s = html.read_text(encoding="utf-8")
s, n1 = re.subn(r'^const EYE_SRC=".*?";$', lambda _: f'const EYE_SRC="{url}";', s, flags=re.M)
s, n2 = re.subn(r'^const EYE_IRIS=\{.*?\};$', lambda _: f'const EYE_IRIS={{cy:{icy:.1f},ry:{iry:.1f}}};', s, flags=re.M)
if n1 != 1 or n2 != 1:
    sys.exit("moffy-studio.html に const EYE_SRC= / const EYE_IRIS= の行が見つかりません")
html.write_text(s, encoding="utf-8")
print(f"assets/eye-sample.png（{(ROOT / 'assets' / 'eye-sample.png').stat().st_size // 1024}KB）と、"
      f"moffy-studio.html の EYE_SRC（JPEG {len(buf.getvalue()) // 1024}KB）・EYE_IRIS を書き出しました")
