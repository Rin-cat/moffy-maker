// Canvas の読み込み版のテスト: node tests/loader.js
// canvas/loader.html を開き、GitHub Pages の canvas.html の代わりに手元の docs/canvas.html を返して、本体が表示され生成まで動くかを見る
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'canvas.html'), 'utf8');
  await p.route('https://rin-cat.github.io/moffy-maker/canvas.html', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: html }));
  let calls = 0;
  await p.route('https://generativelanguage.googleapis.com/**', r => { calls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }] } }] }) }); });
  await p.goto('file://' + path.join(ROOT, 'canvas', 'loader.html')); await p.waitForTimeout(1500);
  ok((await p.$$eval('[data-recipe]', bs => bs.length)) === 16 && !(await p.$eval('#gen-go', e => e.hidden)), '読み込み版：本体（Canvas モード）が表示される');
  await p.click('#r-base'); await p.click('#gen-go');
  await p.waitForFunction(() => document.querySelector('.gen-card .gen-img'), null, { timeout: 15000 }).catch(() => {});
  ok(calls === 1 && await p.$('.gen-card .gen-img') !== null, '読み込み版：このページで生成が動く');
  ok(errs.length === 0, '読み込み版：エラーなし ' + errs.join(' | '));
  // 読み込めないとき
  const p2 = await b.newPage();
  await p2.route('https://rin-cat.github.io/moffy-maker/canvas.html', r => r.fulfill({ status: 404, body: 'no' }));
  await p2.goto('file://' + path.join(ROOT, 'canvas', 'loader.html')); await p2.waitForTimeout(800);
  ok((await p2.textContent('#msg')).includes('読み込めませんでした'), '読み込めないときは案内を出す');
  await b.close();
  console.log(fails ? `\n${fails} 件失敗` : '\nすべて成功'); process.exit(fails ? 1 : 0);
})();
