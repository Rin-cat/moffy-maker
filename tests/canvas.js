// Canvas 版のテスト（Gemini API の返事をまねて動かす）: node tests/canvas.js [canvas/moffy-canvas.html]
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'canvas', 'moffy-canvas.html'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // 1x1 の PNG（返ってくる画像のかわり）
  const PNG = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#8EC9F2'; g.fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1]; }).catch(() => '');
  const reqs = []; const mode = { next: [] };
  await p.route('https://generativelanguage.googleapis.com/**', async route => {
    const url = route.request().url(); const body = JSON.parse(route.request().postData() || '{}');
    reqs.push({ url, body });
    const forced = mode.next.shift();
    if (forced === 500) return route.fulfill({ status: 500, body: 'boom' });
    if (forced === 'cfg400') return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"message":"Invalid JSON payload received. Unknown name \\"imageConfig\\" at \'generation_config\'"}}' });
    if (forced === 403) return route.fulfill({ status: 403, body: 'denied' });
    if (forced === 'noimg') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'NO_IMAGE', content: { parts: [] } }] }) });
    const text = (body.contents[0].parts.find(x => x.text) || {}).text || '';
    if (/image/.test(url)) {
      const parts = [{ inlineData: { mimeType: 'image/png', data: PNG } }];
      if ((body.generationConfig.responseModalities || []).includes('TEXT')) parts.push({ text: '{"name":"ソラモッフィー","color":"水色","horn":"なし","eyes":2,"motifs":"雲、虹"}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts } }] }) });
    }
    const reply = /判定してください/.test(text)
      ? '{"results":[{"item":"鼻が描かれていない","pass":true,"reason":"鼻がない"},{"item":"目が2つ（3つまで）","pass":false,"reason":"目が3つある"}],"score":"1/2","fix_prompt":"目を2つにして、3つめの目を毛並みでうめる"}'
      : '```json\n{"name":"トリコモッフィー","color":"レモン色","horn":"1本","eyes":"1","other":"しっぽにリボン"}\n```';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: reply }] } }] }) });
  });
  await p.goto(file); await p.waitForTimeout(900);
  ok(errs.length === 0, 'Canvas 版の読み込みでエラーなし ' + errs.join(' | '));
  ok(!(await p.$eval('#gen-go', e => e.hidden)) && !(await p.$eval('#base-ref', e => e.hidden)) && (await p.textContent('.flow li:last-child')).includes('このページで生成'), 'Canvas モードの表示（生成ボタン・基準画像の欄）');
  ok((await p.$$eval('[data-recipe]', bs => bs.length)) === 16, '全16レシピがある');
  const waitCard = async () => { await p.waitForFunction(() => !document.querySelector('.gen-card .gen-wait'), null, { timeout: 15000 }); };
  // 基準画像を生成 → 自動で基準画像になる
  await p.click('#r-base'); await p.click('#gen-go'); await waitCard();
  let q = reqs[reqs.length - 1];
  const imgs = q.body.contents[0].parts.filter(x => x.inlineData).length, txt = q.body.contents[0].parts.find(x => x.text).text;
  ok(/gemini-2\.5-flash-image-preview:generateContent\?key=$/.test(q.url) && imgs === 1 && q.body.contents[0].parts[0].inlineData && txt.startsWith('【添付した画像】\n1枚目：目の見本'), '基準画像：目の見本を1枚目に添付して画像モデルを呼ぶ');
  ok(q.body.generationConfig.imageConfig && q.body.generationConfig.imageConfig.aspectRatio === '1:1' && q.body.systemInstruction && /\[seed:/.test(txt), '基準画像：1:1・システム指示・seed つき');
  ok(await p.$('.gen-card .gen-img') !== null && !(await p.$eval('#base-thumb', e => e.hidden)), '生成した画像が出て、自動で基準画像になる');
  // おでかけ：目の見本＋基準画像の2枚、4:5
  await p.click('#r-outing'); await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.contents[0].parts.filter(x => x.inlineData).length === 2 && q.body.generationConfig.imageConfig.aspectRatio === '4:5', 'おでかけ：目の見本と基準画像の2枚を添付し、4:5 で生成');
  // 文章だけ：画像を添付しない
  await p.click('[data-attach="0"]'); await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.contents[0].parts.filter(x => x.inlineData).length === 0, '文章だけ：画像を添付せずに生成');
  await p.click('[data-attach="1"]');
  // 写真が足りないと押せない → 入れると押せる
  await p.click('#r-photo');
  ok(await p.$eval('#gen-go', e => e.disabled) && (await p.textContent('#gen-miss')).includes('自分で撮った写真'), '写真レシピ：写真がないと生成できず、案内が出る');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-genpick="photo"]')]);
  await fc.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }); await p.waitForTimeout(400);
  ok(!(await p.$eval('#gen-go', e => e.disabled)), '写真を入れると生成できる');
  await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.contents[0].parts.filter(x => x.inlineData).length === 3 && !q.body.generationConfig.imageConfig, '写真レシピ：3枚を添付し、縦横比は写真に合わせる（指定しない）');
  // 部分修正へ → 直したい画像が入る
  await p.click('.gen-card [data-genact="fix"]'); await p.waitForTimeout(300);
  ok((await p.getAttribute('#r-fix', 'aria-pressed')) === 'true' && !(await p.$eval('#gen-go', e => e.disabled)), '結果から「部分修正へ」で、直したい画像が入る');
  await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.contents[0].parts.filter(x => x.inlineData).length === 2 && q.body.contents[0].parts.find(x => x.text).text.includes('1枚目：直してほしい画像'), '部分修正：直したい画像と目の見本を添付');
  // ルールチェック → この直し方で直す
  await p.click('.gen-card [data-genact="check"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#gen-go')).includes('Gemini に聞く'), 'ルールチェックは「Gemini に聞く」');
  await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(/gemini-3-flash-preview/.test(q.url) && q.body.generationConfig.responseMimeType === 'application/json', 'ルールチェック：文字のモデルに JSON で聞く');
  ok((await p.textContent('.gen-card')).includes('不合格') && await p.$('.gen-card [data-genact="applyfix"]') !== null, '判定の結果（合格・不合格）と「この直し方で直す」が出る');
  await p.click('.gen-card [data-genact="applyfix"]'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.contents[0].parts.find(x => x.text).text.includes('目を2つにして') && q.body.contents[0].parts.filter(x => x.inlineData).length === 2, 'この直し方で直す：判定した画像と直し方で生成');
  // 取り込み：画像を入れて聞く → 取り込む
  await p.click('#r-import');
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-genpick="src"]')]);
  await fc2.setFiles({ name: 'moffy.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') }); await p.waitForTimeout(400);
  await p.click('#gen-go'); await waitCard();
  await p.click('.gen-card [data-genact="import"]'); await p.waitForTimeout(300);
  ok((await p.textContent('#c-name')) === 'トリコモッフィー' && (await p.$eval('#p-y', s => s.value)) === '1', '取り込み：返事をボタンで DNA に取り込める');
  // 基準画像で「文字でも受け取る」
  await p.click('#r-base'); await p.selectOption('#f-base-json', { index: 1 }); await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(q.body.generationConfig.responseModalities.includes('TEXT') && await p.$('.gen-card [data-genact="import"]') !== null, '基準画像で「文字でも受け取る」：画像と文字を受け取り、取り込める');
  await p.selectOption('#f-base-json', { index: 0 });
  // 失敗と再試行
  let n0 = reqs.length; mode.next = [500]; await p.click('#gen-go'); await waitCard();
  ok(reqs.length === n0 + 2 && await p.$('.gen-card .gen-img') !== null, 'Gemini 側のエラー（500）は待って再試行する');
  n0 = reqs.length; mode.next = ['cfg400']; await p.click('#gen-go'); await waitCard();
  q = reqs[reqs.length - 1];
  ok(reqs.length === n0 + 2 && q.body.generationConfig.aspectRatio === '1:1' && !q.body.generationConfig.imageConfig, 'imageConfig が通らないときは、公式と同じ書き方に切りかえる');
  mode.next = ['noimg']; await p.click('#gen-go'); await waitCard();
  ok((await p.textContent('.gen-card .gen-err')).includes('安全のための制限'), '画像が作られなかったときの案内');
  mode.next = [403]; await p.click('#gen-go'); await waitCard();
  ok((await p.textContent('.gen-card .gen-err')).includes('Canvas の中で開いて'), 'Canvas の外（権限なし）のときの案内');
  // Gem は生成しない
  await p.click('#r-gem');
  ok(await p.$eval('#gen-go', e => e.hidden), 'Gem にするでは生成ボタンを出さない');
  // 再読み込みしても基準画像が残る
  await p.click('#r-outing'); await p.reload(); await p.waitForTimeout(900);
  ok(!(await p.$eval('#base-thumb', e => e.hidden)) && !(await p.$eval('#gen-go', e => e.disabled)), '再読み込みしても基準画像が残る');
  // 外す（2回押し）
  await p.click('#base-clear'); await p.click('#base-clear'); await p.waitForTimeout(200);
  ok(await p.$eval('#base-thumb', e => e.hidden) && await p.$eval('#gen-go', e => e.disabled), '基準画像を外すと、おでかけは生成できない');
  // 横スクロールなし・アクセシビリティ（結果カードがある状態）
  await p.click('#r-base'); await p.click('#gen-go'); await waitCard();
  for (const w of [360, 768]) { await p.setViewportSize({ width: w, height: 900 }); ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= w, `幅 ${w}px で横スクロールなし`); }
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const ax = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] })).violations.map(v => `${v.id}(${v.nodes.length})`));
  ok(ax.length === 0, 'アクセシビリティ違反なし（結果カードあり） ' + ax.join(' '));
  ok(errs.length === 0, '操作中のエラーなし ' + errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} 件失敗` : '\nすべて成功');
  process.exit(fails ? 1 : 0);
})();
