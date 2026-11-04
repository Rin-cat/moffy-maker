// アクセシビリティ検査: node tests/a11y.js [html]
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'moffy-studio.html'));
(async () => {
  const b = await chromium.launch();
  let total = 0;
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 1000 } });
    const p = await ctx.newPage();
    await p.goto(file); await p.waitForTimeout(800);
    // 目の見本を入れて、拡大・ずらし・コピーなどの操作部品も表示した状態にする
    const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#4C7FE0'; g.fillRect(0, 0, 200, 120); return c.toDataURL('image/png').split(',')[1]; });
    await p.setInputFiles('#eye-file', { name: 'eye.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }); await p.waitForTimeout(500);
    await p.click('#r-friends'); await p.check('#explain'); // 解説と入力欄が多い状態で検査
    await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
    const res = await p.evaluate(async () => await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] }));
    console.log(`== ${scheme}: 違反 ${res.violations.length} 種類`);
    for (const v of res.violations) {
      total++;
      console.log(`- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}件)`);
      v.nodes.slice(0, 4).forEach(n => console.log('    ' + n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ')));
    }
    await ctx.close();
  }
  await b.close();
  process.exit(total ? 1 : 0);
})();
