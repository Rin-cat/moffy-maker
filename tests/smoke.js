// 機能テスト: node tests/smoke.js [html のパス]
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'moffy-studio.html'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(file); await p.waitForTimeout(800);
  ok(errs.length === 0, 'ページの読み込みでエラーなし ' + errs.join(' | '));
  // 全レシピで指示書が出る
  const ids = await p.$$eval('[data-recipe]', bs => bs.map(b => b.dataset.recipe));
  ok(ids.length === 16, 'レシピ数 16 = ' + ids.length);
  ok((await p.getAttribute('#r-base', 'aria-pressed')) === 'true', '最初のレシピは「基準画像をつくる」');
  for (const id of ids) {
    await p.click(`#r-${id}`);
    const t = await p.textContent('#out');
    ok(t.length > 120 && !/undefined|NaN|\[object/.test(t), `レシピ ${id} の指示書 (${t.length}文字)`);
  }
  // 添付あり/なしで文面が変わる
  await p.click('#r-outing');
  const a1 = await p.textContent('#out');
  await p.click('[data-attach="0"]');
  const a0 = await p.textContent('#out');
  ok(a1.includes('1枚目の目の見本') && a1.includes('2枚目の画像のモッフィーを正とし') && !/枚目|目の見本/.test(a0), '添付あり/文章だけの切り替え（標準の目の見本が1枚目）');
  ok(a1.indexOf('絶対に守るルール') < a1.indexOf('この子の特徴') && a1.includes('1.5〜2.5頭身'), 'ルールが先頭にあり、頭身の指定がある');
  ok(/アスペクト比は 4:5/.test(a0), 'おでかけにアスペクト比が入る');
  await p.click('[data-attach="1"]');
  // 解説モード
  await p.check('#explain');
  ok(await p.$$eval('.why', w => w.length) > 3, '解説モードで「なぜ」が表示される');
  await p.uncheck('#explain');
  // DNA コードの往復
  await p.click('#sw-pink'); await p.selectOption('#p-h', 'curl'); await p.fill('#nm', 'テストモッフィー');
  const code = await p.textContent('#c-code');
  await p.click('#mode-import'); await p.fill('#imp', 'これ使って！ ' + code + ' よろしく'); await p.click('#imp-go');
  ok((await p.textContent('#c-name')) === 'テストモッフィー', 'DNAコードの往復（名前）');
  ok((await p.$eval('#p-h', s => s.value)) === 'curl', 'DNAコードの往復（ツノ）');
  // Gemini が返す JSON の取り込み（自由記述の値）
  await p.fill('#imp', '```json\n{"name":"ソラ","color":"水色とラベンダーのグラデーション","horn":"なし","ear":"不明","tail":"ふさふさの長いしっぽ","eyes":"３つ","wing":"小さな白い羽","accessory":"黄色い帽子","other":"おなかに星"}\n```');
  await p.click('#imp-go');
  const dl = (await p.textContent('#chip')) + (await p.textContent('#c-dl'));
  ok(dl.includes('水色とラベンダー') && dl.includes('黄色い帽子'), 'JSON 取り込み（自由記述）');
  ok((await p.$eval('#p-y', s => s.value)) === '3', 'JSON 取り込み（全角の目の数）');
  ok((await p.$eval('#p-h', s => s.value)) === 'none', 'JSON 取り込み（なし→none）');
  ok((await p.$eval('#p-e', s => s.value)) === 'auto', 'JSON 取り込み（不明→おまかせ）');
  // 壊れた入力
  await p.fill('#imp', 'MF1.abc'); await p.click('#imp-go');
  ok(((await p.textContent('#imp-msg')) || '').length > 5, '壊れたコードでメッセージ');
  // 既存キャラ名
  await p.click('#mode-new'); await p.fill('#kw', 'ピカチュウみたいな黄色、雷');
  ok(!(await p.$eval('#ipwarn', e => e.hidden)), '既存キャラ名の警告');
  await p.click('#r-base');
  ok(!(await p.textContent('#out')).includes('ピカチュウ'), '指示書から既存キャラ名を除去');
  // 友だち
  const code2 = await p.textContent('#c-code');
  await p.click('#r-friends'); await p.fill('#f-friends-codes', code + '\nおかしな行');
  const fr = await p.textContent('#out');
  ok(fr.includes('2匹') && fr.includes('2枚目の基準画像'), '友だち共演（読めた1匹＋自分）');
  ok((await p.textContent('#rfields')).includes('2行目'), '友だち共演（読めない行のエラー）');
  // スタンプのコマ数と比率
  await p.click('#r-stamps'); await p.selectOption('#f-stamps-panels', '8');
  const s8 = await p.textContent('#out');
  ok(s8.includes('8. 「') && s8.includes('16:9'), 'スタンプ8コマで16:9');
  // QR
  await p.click('#qr-btn'); await p.waitForTimeout(300);
  ok(await p.$('#qr canvas, #qr img') !== null || (await p.textContent('#qr')).includes('読み込めませんでした'), 'QRコードの表示');
  // 横幅 360px でスクロールしない
  for (const w of [360, 414, 768]) {
    await p.setViewportSize({ width: w, height: 900 });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= w, `幅 ${w}px で横スクロールなし (${sw})`);
  }
  // サイクル2: 見本・ガチャ・このあと・言語
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.click('#mode-new');
  await p.click('[data-sample="1"]');
  ok((await p.textContent('#c-name')) === 'ヨミモッフィー', '見本の読み込み');
  const before = await p.textContent('#c-code');
  await p.click('#gacha');
  ok((await p.textContent('#c-code')) !== before && /モッフィー$/.test(await p.textContent('#c-name')), 'ガチャで DNA が変わる');
  await p.click('#r-check');
  ok((await p.textContent('#nextline')).includes('fix_prompt'), '「このあと」がレシピに合わせて変わる');
  ok((await p.textContent('#attachline')).includes('貼り方'), '画像が必要なレシピで貼り方を表示');
  ok((await p.evaluate(() => document.documentElement.lang)) === 'ja', 'html の言語が ja');
  // サイクル4: その子らしさ・プロフィール帳・自分の写真
  await p.click('#mode-new');
  await p.fill('#kw', '登山が好き、ラーメン、みかん色'); await p.fill('#mo', '');
  await p.click('#mo-suggest');
  const mo = await p.inputValue('#mo');
  ok(mo.includes('リュック') && mo.includes('なると'), '言葉からモチーフを提案 (' + mo + ')');
  await p.selectOption('#xi', 'high');
  await p.click('#r-base');
  const sh = await p.textContent('#out');
  ok(sh.includes('その子らしさ') && sh.includes('リュック') && sh.includes('強く出す'), '基準画像にモチーフと強さが入る');
  ok(sh.includes('"motifs"') && sh.includes('"catchphrase"'), '基準画像の JSON にモチーフとプロフィールの欄');
  await p.fill('#mo', ''); await p.fill('#kw', 'ほげほげ'); await p.click('#mo-suggest');
  ok((await p.textContent('#mo-hint')).includes('辞書にない'), '辞書にない言葉の案内');
  ok((await p.textContent('#out')).includes('目に見えるモチーフ2〜3個'), 'モチーフ未定なら基準画像で決めさせる');
  await p.click('#prof summary');
  await p.fill('#pq', 'まかせて！'); await p.fill('#pr', '驚くと毛がぶわっとふくらむ'); await p.fill('#pb', '雷の音');
  await p.click('#r-comic'); await p.selectOption('#f-comic-talk', '短いセリフあり');
  const cm = await p.textContent('#out');
  ok(cm.includes('まかせて！') && cm.includes('雷の音') && cm.includes('ぶわっと'), '4コマに口ぐせ・苦手・クセが入る');
  await p.click('#r-outing');
  ok((await p.textContent('#out')).includes('しぐさとお話'), 'おでかけにクセが入る');
  const code3 = await p.textContent('#c-code');
  await p.click('[data-sample="2"]');
  await p.click('#mode-import'); await p.fill('#imp', code3); await p.click('#imp-go');
  ok((await p.inputValue('#pq')) === 'まかせて！' && (await p.$eval('#xi', s => s.value)) === 'high', 'プロフィールと強さが DNA コードで往復');
  await p.fill('#imp', '{"name":"テスト","motifs":["小さな傘","毛先のしずく"],"catchphrase":"ぴちょん","quirk":"雨音でおどる","intensity":"つよめ"}'); await p.click('#imp-go');
  ok((await p.inputValue('#mo')) === '小さな傘、毛先のしずく' && (await p.inputValue('#pq')) === 'ぴちょん', 'JSON のモチーフ（配列）とプロフィールを取り込む');
  await p.click('#r-photo');
  ok((await p.textContent('#attachline')).includes('3枚目') && (await p.textContent('#out')).includes('3枚目の写真と同じ'), '自分の写真レシピ（目の見本・基準画像・写真の3枚、写真の縦横比）');
  await p.click('[data-attach="0"]');
  const ph0 = await p.textContent('#out');
  ok(!/基準画像|目の見本/.test(ph0) && ph0.includes('1枚目の写真'), '自分の写真レシピ（文章だけ）');
  await p.click('[data-attach="1"]');
  await p.click('#mode-new'); await p.click('[data-sample="1"]');
  await p.click('#qr-btn'); await p.click('#qr-btn'); await p.waitForTimeout(300);
  ok(await p.$('#qr canvas, #qr img') !== null, '長い DNA コードでも QR を表示');
  // サイクル6: 基準画像・設定画・ルールチェック・体のかたちとツノ
  await p.click('#r-base');
  const bs = await p.textContent('#out');
  ok(bs.includes('真正面') && bs.includes('左右対称') && bs.includes('1.5〜2.5頭身') && bs.includes('1:1'), '基準画像は1体・真正面・頭身・正方形');
  ok(!bs.includes('黒目') && bs.includes('黒いだけの目') && bs.includes('左上に白い四角いツヤ'), '「黒目」と書かず、実物の目のとおりに描き方を書く');
  await p.selectOption('#f-base-src', { index: 1 });
  ok((await p.textContent('#out')).includes('2枚目の画像のモッフィーを、基準画像として描き直して'), '基準画像（もとにする画像あり）');
  await p.selectOption('#f-base-src', { index: 0 });
  await p.click('#r-sheet');
  const st6 = await p.textContent('#out');
  ok(!st6.includes('にっこり') && st6.includes('文字は描かない') && st6.includes('コマはこの7つだけ'), '設定画は文字なし・7コマだけ');
  await p.click('#r-check');
  ok((await p.textContent('#out')).includes('白い四芒星がない目（黒いだけの目や点の目）は不合格'), 'ルールチェックで黒いだけの目を不合格にする');
  await p.click('#mode-new'); await p.evaluate(() => { document.querySelector('#adv').open = true; });
  const sOpts = await p.$$eval('#p-s option', os => os.map(o => o.value));
  const hOpts = await p.$$eval('#p-h option', os => os.map(o => o.value));
  ok(sOpts.length === 10 && hOpts.length === 11, `体のかたち ${sOpts.length - 1} 種・ツノ ${hOpts.length - 2} 種（おまかせ・なしを除く）`);
  let drawn = 0;
  for (const v of sOpts) { await p.selectOption('#p-s', v); if (await p.$('#preview svg path')) drawn++; }
  for (const v of hOpts) { await p.selectOption('#p-h', v); if (await p.$('#preview svg path')) drawn++; }
  ok(drawn === sOpts.length + hOpts.length && errs.length === 0, 'すべての体のかたち・ツノでラフが描ける');
  await p.selectOption('#p-s', 'round'); await p.selectOption('#p-h', 'two');
  // サイクル6: 目の見本（このブラウザの中だけ。ファイル選択・貼り付け・保存・削除）
  const mk = (color) => p.evaluate((color) => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 320, 200); g.fillStyle = '#fff'; g.beginPath(); g.arc(160, 100, 50, 0, 7); g.fill(); return c.toDataURL('image/png').split(',')[1]; }, color);
  const pngA = Buffer.from(await mk('#3366ff'), 'base64');
  // 画像を外に出す通信（GET 以外・本文つき・URL に画像データ）がないこと。フォントや QR ライブラリの読み込み（GET）は対象外
  const reqs = []; p.on('request', r => { const u = r.url(); if (/^(data|file|blob):/.test(u)) return; if (r.method() !== 'GET' || (r.postData() || '').length || /base64|data:image/.test(u)) reqs.push(r.method() + ' ' + u.slice(0, 80)); });
  const before6 = reqs.length;
  await p.click('#r-outing');
  ok(!(await p.$eval('#eye-thumb', i => i.hidden)) && (await p.textContent('#eye-kind')).includes('標準') && (await p.$eval('#eye-clear', b => b.hidden)), '最初から標準の目の見本が入っている');
  const sw = await p.$eval('#eye-thumb', i => [i.naturalWidth, i.naturalHeight]);
  ok(sw[0] === 768 && sw[1] === 768, '標準の目の見本は白い正方形 ' + sw.join('x'));
  ok((await p.textContent('#out')).includes('1枚目の目の見本とそっくり') && await p.$('#attachline [data-eyeact="copy"]') !== null, '指示書に標準の目の見本が入り、添付の一覧からコピーできる');
  const defA = await p.$eval('#eye-thumb', i => i.src);
  await p.click('#mode-new'); await p.evaluate(() => { document.querySelector('#adv').open = true; });
  await p.selectOption('#eyestyle', 'classic'); await p.waitForTimeout(100);
  const defC = await p.$eval('#eye-thumb', i => i.src);
  await p.selectOption('#eyestyle', 'g4'); await p.waitForTimeout(100);
  ok(defC !== defA && (await p.$eval('#eye-thumb', i => i.src)) === defA, '目のスタイルを変えると標準の見本も描き直す');
  await p.setInputFiles('#eye-file', { name: 'eye.png', mimeType: 'image/png', buffer: pngA });
  await p.waitForSelector('#eye-thumb:not([hidden])', { timeout: 3000 }).catch(() => {});
  const nat = await p.$eval('#eye-thumb', i => [i.naturalWidth, i.naturalHeight, i.hidden]);
  ok(nat[0] === 768 && nat[1] === 768 && !nat[2] && (await p.textContent('#eye-kind')).includes('自分の画像') && !(await p.$eval('#eye-clear', b => b.hidden)), '自分の画像に差しかえ（白い正方形に整える） ' + nat.join('x'));
  let ou = await p.textContent('#out');
  ok(ou.includes('1枚目の目の見本') && ou.includes('2枚目の画像のモッフィーを正とし'), '目の見本が1枚目、基準画像が2枚目');
  ok(await p.$('#attachline .attach-thumb') !== null && (await p.textContent('#attachline')).includes('2枚（この順番で）'), '添付の順番に目の見本のサムネイル');
  await p.uncheck('#eye-use');
  ou = await p.textContent('#out');
  ok(!ou.includes('目の見本') && ou.includes('1枚目の画像のモッフィーを正とし'), '「指示書で使う」を外すと目の見本が消える');
  await p.check('#eye-use');
  await p.click('[data-attach="0"]');
  ok(!(await p.textContent('#out')).includes('目の見本'), '文章だけでは目の見本を使わない');
  await p.click('[data-attach="1"]');
  await p.click('#r-check');
  ok((await p.textContent('#out')).includes('2枚目の目の見本と同じ'), 'ルールチェックで目を見本と比べる');
  await p.click('#r-fix');
  ok((await p.textContent('#out')).includes('2枚目の目の見本とそっくり'), '部分修正で目を見本どおりに直す');
  const [eyeDl] = await Promise.all([p.waitForEvent('download', { timeout: 3000 }).catch(() => null), p.click('#eye-save')]);
  ok(eyeDl && eyeDl.suggestedFilename() === 'moffy-eye-sample.png', '目の見本を画像として保存できる');
  await p.fill('#eye-zoom', '200'); await p.dispatchEvent('#eye-zoom', 'input'); await p.waitForTimeout(400);
  const srcA = await p.$eval('#eye-thumb', i => i.src);
  const pngB = await mk('#ff3366');
  await p.evaluate((b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const dt = new DataTransfer(); dt.items.add(new File([u], 'paste.png', { type: 'image/png' })); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, pngB);
  await p.waitForTimeout(600);
  ok((await p.$eval('#eye-thumb', i => i.src)) !== srcA && (await p.inputValue('#eye-zoom')) === '100', '画像の貼り付けで目の見本を入れかえる');
  await p.setViewportSize({ width: 360, height: 900 });
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 360, '目の見本を入れても幅 360px で横スクロールなし');
  await p.setViewportSize({ width: 1280, height: 1000 });
  await p.click('#r-outing');
  await p.reload(); await p.waitForTimeout(800);
  ok(!(await p.$eval('#eye-thumb', i => i.hidden)) && (await p.textContent('#out')).includes('1枚目の目の見本'), '再読み込みしても目の見本が残る');
  await p.click('#eye-clear');
  ok((await p.textContent('#eye-clear')).includes('もう一度') && (await p.textContent('#eye-kind')).includes('自分の画像'), '標準に戻すのは1回目で確認');
  await p.click('#eye-clear');
  ok(!(await p.$eval('#eye-thumb', i => i.hidden)) && (await p.textContent('#eye-kind')).includes('標準') && (await p.textContent('#out')).includes('1枚目の目の見本') && (await p.evaluate(() => localStorage.getItem('moffy-eye-sample'))) === null, '2回押すと標準の目の見本に戻る');
  ok(reqs.length === before6, '目の見本の画像をどこにも送信しない ' + reqs.slice(before6).join(' '));
  await p.evaluate(() => localStorage.setItem('moffy-maker-draft', JSON.stringify({ d: { ...DEFAULT_DNA }, recipe: 'sheet', attach: true, explain: false, ro: {} })));
  await p.goto(file); await p.waitForTimeout(600);
  ok((await p.getAttribute('#r-base', 'aria-pressed')) === 'true', '前の版の下書き（設定画）は基準画像から始まる');
  ok(errs.length === 0, '操作中のエラーなし ' + errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} 件失敗` : '\nすべて成功');
  process.exit(fails ? 1 : 0);
})();
