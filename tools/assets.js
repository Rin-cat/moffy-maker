// OG 画像（1200x630）と Gem 用の指示文を作る: node tools/assets.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'moffy-studio.html')); await p.waitForTimeout(800);
  const svgs = [];
  for (const i of [0, 1, 2]) { await p.click(`[data-sample="${i}"]`); svgs.push(await p.$eval('#preview', e => e.innerHTML)); }
  // だれでも使える工房版の Gem 指示文
  await p.click('#r-gem');
  const gem = await p.evaluate(() => { const r = RECIPES.find(x => x.id === 'gem'); const segs = r.build(promptDNA(st.d), { scope: 'だれでも使える工房' }, null, {}); return segs.map(s => `## ${s.h}\n\n${s.h === 'カスタム指示' ? '```\n' + s.t + '\n```' : s.t}`).join('\n\n'); });
  fs.writeFileSync(path.join(ROOT, 'gem-instructions.md'), `# Gem「モッフィー工房（非公式）」\n\nツールのレシピ「Gemにする」→「だれでも使える工房」と同じ内容です。gemini.google.com（パソコン）→ Gem マネージャー →「新しい Gem」で、それぞれの欄に貼ってください。\n\n${gem}\n`);
  // OG 画像
  const card = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await card.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@700;900&family=BIZ+UDPGothic:wght@400;700&display=swap"><style>
  body{margin:0;width:1200px;height:630px;background:#F3F2F8;font-family:"BIZ UDPGothic",sans-serif;color:#24233A;display:grid;grid-template-columns:1fr 1fr;align-items:center;overflow:hidden}
  .l{padding:0 0 0 80px;display:grid;gap:22px}
  .e{font:500 22px "IBM Plex Mono",monospace;color:#625F7C;letter-spacing:.06em}
  h1{font:900 66px/1.2 "Zen Maru Gothic",sans-serif;margin:0;white-space:nowrap}
  p{font-size:28px;line-height:1.6;color:#4A4766;margin:0}
  .r{position:relative;height:630px}
  .m{position:absolute;width:300px}
  .m svg{width:100%;height:auto}
  </style></head><body><div class="l"><div class="e">✦ 非公式・ファンメイド</div><h1>モッフィー<br>指示書メーカー</h1><p>自分のモッフィーを、同じ見た目のまま<br>Gemini で遊ばせる指示書をつくる</p></div>
  <div class="r"><div class="m" style="left:150px;top:40px;width:330px">${svgs[0]}</div><div class="m" style="left:20px;top:330px;width:250px">${svgs[1]}</div><div class="m" style="left:310px;top:340px;width:260px">${svgs[2]}</div></div></body></html>`);
  await card.waitForTimeout(1200);
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  await card.screenshot({ path: path.join(ROOT, 'docs', 'og.png') });
  await b.close();
  console.log('docs/og.png と gem-instructions.md を書き出しました');
})();
