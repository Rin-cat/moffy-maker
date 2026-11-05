// 指示書の矛盾・抜けチェック: node tests/lint.js [html]
// ガチャで作った DNA × 全レシピ × 添付あり/なし × 目の見本あり/なし の組み合わせで、全文に決まりが守られているかを調べる。
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'moffy-studio.html'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(file); await p.waitForTimeout(500);
  const report = await p.evaluate(() => {
    const problems = {}; let cases = 0, maxLen = 0, maxTag = '';
    const note = (rule, ctx) => { (problems[rule] = problems[rule] || []).push(ctx); };
    const IMAGE = r => !['import', 'check', 'gem'].includes(r.id);
    const dnas = [...SAMPLES.map(s => ({ ...s })), { ...BLANK_DNA, n: 'オマカセ' }];
    for (let i = 0; i < 60; i++) dnas.push(gacha());
    // 既存キャラ名入り、取り込み由来の自由記述入り、追加した体のかたち・ツノ
    dnas.push({ ...DEFAULT_DNA, n: 'ピカチュウモッフィー', k: 'ミッフィーみたいな白、ドラえもん', q: 'ピカチュウって呼んで' });
    dnas.push({ ...DEFAULT_DNA, n: 'モチーフなし', m: '', q: '', r: '', g: '', b: '', z: '' });
    dnas.push({ ...DEFAULT_DNA, n: 'クラシック', i: 'classic', y: '3' });
    dnas.push(normalize({ name: 'ソラ', color: '水色とラベンダーのグラデーション', horn: '小さな金色のツノが3本', tail: 'なし', eyes: '３つ', other: 'おなかに星の模様' }));
    for (const s of ['onigiri', 'block', 'drop', 'manju', 'snow']) dnas.push({ ...DEFAULT_DNA, n: 'かたち' + s, s });
    for (const h of ['crystal', 'flower', 'bolt', 'antenna', 'mush']) dnas.push({ ...DEFAULT_DNA, n: 'ツノ' + h, h });
    const friendsCodes = [dnaCode(SAMPLES[1]), dnaCode(SAMPLES[2]), dnaCode(gacha())].join('\n');
    for (const d0 of dnas) {
      const d = promptDNA(d0);
      for (const r of RECIPES) {
        const attachModes = r.usesAttach ? [true, false] : [false];
        for (const attach of attachModes) for (const eyeOn of [true, false]) {
          const o = {};
          for (const f of r.fields) o[f.k] = f.type === 'multi' ? [...f.opts] : (f.def !== undefined ? f.def : (f.opts ? f.opts[0] : ''));
          if (r.id === 'stamps') o.panels = ['4', '6', '8'][cases % 3];
          if (r.id === 'friends') o.codes = friendsCodes;
          if (r.id === 'comic') o.talk = cases % 2 ? '短いセリフあり' : 'なし（絵だけ）';
          if (r.id === 'base') o.src = r.fields[0].opts[cases % 2];
          if (r.id === 'photo') o.pos = r.fields[0].opts[cases % 4];
          if (r.id === 'fix' && cases % 3 === 0) o.parts = ['鼻が出ている', 'ツノ'];
          const friends = r.id === 'friends' ? o.codes.split('\n').map(x => promptDNA(parseDNA(x))) : [];
          const c = buildCtx(r, o, { attach, eye: eyeOn, friends });
          const ratio = r.ratioBy ? r.ratioBy(o) : r.ratio;
          const segs = composeSegs(r, d, o, ratio, c);
          const t = segs.map(s => (s.h ? `【${s.h}】\n` : '') + s.t).join('\n\n');
          const tag = `${r.id}/${attach ? '添付' : '文章'}/${eyeOn ? '目あり' : '目なし'}/${d0.n}`;
          cases++;
          if (t.length > maxLen) { maxLen = t.length; maxTag = tag; }
          const fixEye = r.id === 'fix' && (o.parts || []).includes('目（スパークルアイ）');
          if (/undefined|null|NaN|\[object/.test(t)) note('値の抜け（undefined など）', tag);
          if (IMAGE(r) && r.id !== 'fix' && !/鼻/.test(t)) note('鼻のルールがない', tag);
          if (IMAGE(r) && r.id !== 'fix' && !/アスペクト比は/.test(t)) note('アスペクト比の指定がない', tag);
          if (r.id === 'fix' && !/元の画像と同じ/.test(t)) note('部分修正で構図の維持がない', tag);
          if (IMAGE(r) && !/画像は1枚だけ/.test(t)) note('出力枚数の指定がない', tag);
          if (IMAGE(r) && r.id !== 'fix' && !t.includes('1.5〜2.5頭身')) note('頭身のルールがない', tag);
          if ((IMAGE(r) && r.id !== 'fix' || fixEye) && !/四芒星/.test(t)) note('目の描き方（四芒星）がない', tag);
          if (IMAGE(r) && r.id !== 'fix') { const k = segs.filter(s => s.h !== '添付した画像').findIndex(s => s.h === '絶対に守るルール'); if (k < 0 || k > 2) note('絶対に守るルールが先頭にない', tag + ' ' + k); }
          // 添付した画像の説明：添付があるときは先頭に、何枚目が何かを書く（目の見本はキャラクターではないと明記）
          if (c.refs.length && (segs[0].h !== '添付した画像' || c.refs.some((x, i) => !segs[0].t.includes(`${i + 1}枚目：`)))) note('添付した画像の説明が先頭にない', tag);
          if (!c.refs.length && segs.some(s => s.h === '添付した画像')) note('添付がないのに添付した画像の説明がある', tag);
          if (c.n('eye') && !segs[0].t.includes('キャラクターではない')) note('目の見本がキャラクターではないと書いていない', tag);
          if (r.id === 'import' && !t.includes('キャラクター全体が写った画像を送ってください')) note('取り込みで、目だけの画像などへの返し方がない', tag);
          if (/黒目/.test(t)) note('「黒目」と書いている（黒い瞳孔を描かせる原因）', tag);
          if (r.id !== 'sheet' && /設定画/.test(t)) note('「設定画」の古い言い方が残る', tag);
          // 添付の順番：本文の「N枚目」は添付する枚数の範囲内、添付する画像はすべて本文で使う
          for (const m of t.matchAll(/(\d+)枚目/g)) if (+m[1] > c.refs.length) { note('「N枚目」が添付する枚数をこえる', tag + ' ' + m[0]); break; }
          c.refs.forEach(([k], i) => { if (!t.includes(`${i + 1}枚目`)) note('添付する画像が本文で使われていない', tag + ' ' + k); });
          if (c.n('eye') && !t.includes(`${c.n('eye')}の目の見本`)) note('目の見本の指示がない', tag);
          if (!c.n('eye') && r.id !== 'gem' && /目の見本/.test(t)) note('目の見本を添付しないのに「目の見本」が出る', tag);
          if (c.eye && (IMAGE(r) && r.usesAttach && attach || r.id === 'check' || fixEye) && !c.n('eye')) note('目の見本があるのに添付の順番に入らない', tag);
          if (r.usesAttach && !attach && r.id !== 'photo' && (/添付|枚目|目の見本/.test(t))) note('文章だけなのに添付の指示が出る', tag);
          if (r.id === 'photo' && !attach && (/基準画像|目の見本/.test(t) || !t.includes('1枚目の写真'))) note('写真レシピの文章だけモードがおかしい', tag);
          if (r.id === 'photo' && !/アスペクト比は、[^。]*写真と同じ/.test(t)) note('写真レシピの縦横比が写真に合っていない', tag);
          if (r.id === 'photo' && attach && !t.includes(`${c.refs.length}枚目の写真`)) note('写真レシピで写真の順番がずれる', tag);
          if (r.id === 'sheet') { const lay = segs.find(s => s.h === 'レイアウト'); if (!lay || /「/.test(lay.t) || !/文字は描かない/.test(lay.t)) note('設定画のレイアウトに文字の原因（かぎかっこ）がある', tag); }
          if (r.id === 'comic' && /「起/.test(t)) note('4コマに「起承転結」の見出しの原因がある', tag);
          if (r.id === 'friends' && !t.includes('4匹目')) note('共演の匹数がずれる', tag);
          const ms = motifsOf(d);
          if (ms.length && IMAGE(r) && !['fix', 'friends'].includes(r.id) && !ms.every(m => t.includes(m))) note('モチーフが指示書に入っていない', tag);
          if (!ms.length && d.k && (r.id === 'base' || (r.id === 'sheet' && !c.n('base'))) && !/目に見えるモチーフ2〜3個/.test(t)) note('基準画像でモチーフを決める指示がない', tag);
          if (d.r && IMAGE(r) && !['base', 'sheet', 'fix', 'friends'].includes(r.id) && !t.includes(d.r)) note('クセがしぐさに入っていない', tag);
          if (r.id === 'comic' && o.talk.startsWith('短い') && d.q && !t.includes(d.q)) note('4コマに口ぐせが入っていない', tag);
          if (r.id !== 'base' && /おまかせ/.test(t)) note('「おまかせ」が指示書に漏れる', tag);
          if (/ピカチュウ|ミッフィー|ドラえもん/.test(t)) note('既存キャラ名が残る', tag);
          if (t.length > 3200) note('長すぎる（3200字超）', tag + ' ' + t.length);
          const textAllowed = r.id === 'stamps' || (r.id === 'comic' && o.talk.startsWith('短い'));
          if (IMAGE(r) && r.id !== 'fix' && !textAllowed && !/文字[^。]*入れない/.test(t)) note('文字を入れない指定がない', tag);
          if (r.id === 'stamps') { const n = (t.match(/^\d+\. 「/mg) || []).length; if (n !== +o.panels) note('スタンプの言葉の数がコマ数と違う', tag + ` ${n}/${o.panels}`); }
          if (IMAGE(r) && !['fix', 'friends'].includes(r.id) && !t.includes(`目は${eyeCount(d)}つ`)) note('目の数の記述がない', tag);
        }
      }
    }
    // ゆるい JSON（Gemini の返事によくある形）の取り込み
    const loose = [
      ['コードブロック', '```json\n{"name":"A","color":"青"}\n```'],
      ['末尾のカンマ', '{"name":"B","color":"青",}'],
      ['全角の引用符', '{“name”:“C”,“color”:“ピンク”}'],
      ['コメント行', '{\n // メモ\n "name":"D", "color":"白"\n}'],
      ['前後に説明文', 'はい、書き出しました！\n{"name":"E","horn":"なし"}\nほかにも…'],
    ];
    const looseFail = [];
    for (const [label, txt] of loose) { try { const d = parseDNA(txt); if (!d.n) looseFail.push(label + '（名前なし）'); } catch (e) { looseFail.push(label + '：' + e.message); } }
    return { cases, maxLen, maxTag, problems: Object.fromEntries(Object.entries(problems).map(([k, v]) => [k, { count: v.length, examples: v.slice(0, 3) }])), looseFail };
  });
  console.log(`組み合わせ ${report.cases} 件を検査（いちばん長い指示書：${report.maxLen}文字 ${report.maxTag}）`);
  const keys = Object.keys(report.problems);
  for (const k of keys) console.log(`FAIL ${k}: ${report.problems[k].count} 件  例: ${report.problems[k].examples.join(' / ')}`);
  for (const f of report.looseFail) console.log(`FAIL ゆるい JSON の取り込み: ${f}`);
  if (!keys.length && !report.looseFail.length) console.log('PASS すべての決まりを満たしています');
  await b.close();
  process.exit(keys.length || report.looseFail.length ? 1 : 0);
})();
