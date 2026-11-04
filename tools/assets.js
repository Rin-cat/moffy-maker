// サムネイル画像と Gem 用の指示文を作る: node tools/assets.js
//   docs/og.jpg              リンクを貼ったときのプレビュー（1200x630、Discord・X・LINE など）
//   docs/social-preview.jpg  GitHub の Settings → Social preview 用（1280x640）
//   gem-instructions.md      Gem「モッフィー工房」に貼る文章
// 絵は assets/og-base.jpg（Gemini / Nano Banana で生成した文字なしの絵）を使い、文字はサイトと同じフォントで重ねる。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'assets', 'og-base.jpg');
const SITE = 'rin-cat.github.io/moffy-maker';

// w, h: 出力サイズ。s: 1200 幅を基準にした文字の倍率
function cardHTML(w, h, s, img) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=BIZ+UDPGothic:wght@400;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#ECEAF3 url(${img}) center/cover no-repeat;color:#24233A;font-family:"BIZ UDPGothic",sans-serif}
  .t{position:absolute;left:${56 * s}px;top:0;bottom:0;width:${400 * s}px;display:flex;flex-direction:column;justify-content:center;gap:${18 * s}px}
  .e{font:500 ${17 * s}px "IBM Plex Mono",monospace;letter-spacing:.08em;color:#5E5A78}
  .e b{background:linear-gradient(135deg,#4285F4,#EA4335 40%,#FBBC04 65%,#34A853);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:${19 * s}px}
  h1{margin:0;font:900 ${51 * s}px/1.18 "Zen Maru Gothic",sans-serif;letter-spacing:.01em;white-space:nowrap}
  p{margin:0;font-weight:700;font-size:${21 * s}px;line-height:1.6;color:#46425F}
  .u{margin-top:${6 * s}px;font:500 ${14 * s}px "IBM Plex Mono",monospace;color:#5E5A78}
</style></head><body><div class="t">
  <div class="e"><b>✦</b> 非公式・ファンメイド</div>
  <h1>モッフィー<br>指示書メーカー</h1>
  <p>自分のモッフィーを、<br>同じ見た目のまま Gemini で</p>
  <div class="u">${SITE}</div>
</div></body></html>`;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'moffy-studio.html')); await p.waitForTimeout(800);
  // だれでも使える工房版の Gem 指示文
  const gem = await p.evaluate(() => { const r = RECIPES.find(x => x.id === 'gem'); const segs = r.build(promptDNA(st.d), { scope: 'だれでも使える工房' }, null, {}); return segs.map(s => `## ${s.h}\n\n${s.h === 'カスタム指示' ? '```\n' + s.t + '\n```' : s.t}`).join('\n\n'); });
  fs.writeFileSync(path.join(ROOT, 'gem-instructions.md'), `# Gem「モッフィー工房（非公式）」\n\nツールのレシピ「Gemにする」→「だれでも使える工房」と同じ内容です。gemini.google.com（パソコン）→ Gem マネージャー →「新しい Gem」で、それぞれの欄に貼ってください。\n\n${gem}\n`);
  // サムネイル
  if (!fs.existsSync(BASE)) throw new Error('assets/og-base.jpg がありません');
  const img = 'data:image/jpeg;base64,' + fs.readFileSync(BASE).toString('base64');
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  for (const [w, h, s, name] of [[1200, 630, 1, 'og.jpg'], [1280, 640, 1280 / 1200, 'social-preview.jpg']]) {
    const card = await b.newPage({ viewport: { width: w, height: h } });
    await card.setContent(cardHTML(w, h, s, img));
    await card.evaluate(() => document.fonts.ready); await card.waitForTimeout(400);
    await card.screenshot({ path: path.join(ROOT, 'docs', name), type: 'jpeg', quality: 90 });
    await card.close();
  }
  await b.close();
  console.log('docs/og.jpg・docs/social-preview.jpg・gem-instructions.md を書き出しました');
})();
