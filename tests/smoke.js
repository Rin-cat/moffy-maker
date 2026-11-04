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
  ok(ids.length === 15, 'レシピ数 15 = ' + ids.length);
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
  ok(a1.includes('添付した画像') && !a0.includes('添付した画像'), '添付あり/文章だけの切り替え');
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
  const dl = await p.textContent('#c-dl');
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
  await p.click('#r-sheet');
  ok(!(await p.textContent('#out')).includes('ピカチュウ'), '指示書から既存キャラ名を除去');
  // 友だち
  const code2 = await p.textContent('#c-code');
  await p.click('#r-friends'); await p.fill('#f-friends-codes', code + '\nおかしな行');
  const fr = await p.textContent('#out');
  ok(fr.includes('2枚の設定画') || fr.includes('2匹'), '友だち共演（読めた1匹＋自分）');
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
  await p.click('#r-sheet');
  const sh = await p.textContent('#out');
  ok(sh.includes('【その子らしさ】') && sh.includes('リュック') && sh.includes('強く出す'), '設定画にモチーフと強さが入る');
  ok(sh.includes('"motifs"') && sh.includes('"catchphrase"'), '設定画の JSON にモチーフとプロフィールの欄');
  await p.fill('#mo', ''); await p.fill('#kw', 'ほげほげ'); await p.click('#mo-suggest');
  ok((await p.textContent('#mo-hint')).includes('辞書にない'), '辞書にない言葉の案内');
  ok((await p.textContent('#out')).includes('目に見えるモチーフ2〜3個'), 'モチーフ未定なら設定画で決めさせる');
  await p.click('#prof summary');
  await p.fill('#pq', 'まかせて！'); await p.fill('#pr', '驚くと毛がぶわっとふくらむ'); await p.fill('#pb', '雷の音');
  await p.click('#r-comic'); await p.selectOption('#f-comic-talk', '短いセリフあり');
  const cm = await p.textContent('#out');
  ok(cm.includes('まかせて！') && cm.includes('雷の音') && cm.includes('ぶわっと'), '4コマに口ぐせ・苦手・クセが入る');
  await p.click('#r-outing');
  ok((await p.textContent('#out')).includes('【しぐさとお話】'), 'おでかけにクセが入る');
  const code3 = await p.textContent('#c-code');
  await p.click('[data-sample="2"]');
  await p.click('#mode-import'); await p.fill('#imp', code3); await p.click('#imp-go');
  ok((await p.inputValue('#pq')) === 'まかせて！' && (await p.$eval('#xi', s => s.value)) === 'high', 'プロフィールと強さが DNA コードで往復');
  await p.fill('#imp', '{"name":"テスト","motifs":["小さな傘","毛先のしずく"],"catchphrase":"ぴちょん","quirk":"雨音でおどる","intensity":"つよめ"}'); await p.click('#imp-go');
  ok((await p.inputValue('#mo')) === '小さな傘、毛先のしずく' && (await p.inputValue('#pq')) === 'ぴちょん', 'JSON のモチーフ（配列）とプロフィールを取り込む');
  await p.click('#r-photo');
  ok((await p.textContent('#attachline')).includes('2枚目') && (await p.textContent('#out')).includes('2枚目の写真と同じ'), '自分の写真レシピ（2枚添付、写真の縦横比）');
  await p.click('[data-attach="0"]');
  const ph0 = await p.textContent('#out');
  ok(!ph0.includes('設定画') && ph0.includes('添付した写真'), '自分の写真レシピ（文章だけ）');
  await p.click('[data-attach="1"]');
  await p.click('#mode-new'); await p.click('[data-sample="1"]');
  await p.click('#qr-btn'); await p.click('#qr-btn'); await p.waitForTimeout(300);
  ok(await p.$('#qr canvas, #qr img') !== null, '長い DNA コードでも QR を表示');
  ok(errs.length === 0, '操作中のエラーなし ' + errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} 件失敗` : '\nすべて成功');
  process.exit(fails ? 1 : 0);
})();
