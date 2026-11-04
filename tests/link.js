// 共有リンク（?dna=）から開けるか: node tests/link.js [docs/index.html]
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs', 'index.html'));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + file); await p.waitForTimeout(500);
  await p.click('[data-sample="2"]');
  const code = await p.textContent('#c-code');
  const linkVisible = !(await p.$eval('#copy-link', e => e.hidden));
  await p.click('#qr-btn'); await p.waitForTimeout(300);
  const qrTitle = await p.$eval('#qr', e => (e.querySelector('[title]') || {}).title || '');
  await p.evaluate(() => localStorage.clear());
  const p2 = await b.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('file://' + file + '?dna=' + code); await p2.waitForTimeout(500);
  const name = await p2.textContent('#c-name'); const msg = await p2.textContent('#imp-msg');
  const ok = linkVisible && /dna=MF1\./.test(qrTitle) && name === 'ハナビモッフィー' && msg.includes('共有リンク') && !errs.length;
  console.log(ok ? 'PASS 共有リンク・QR・?dna= の読み込み' : `FAIL link=${linkVisible} qr=${qrTitle.slice(0, 60)} name=${name} errs=${errs}`);
  await b.close(); process.exit(ok ? 0 : 1);
})();
