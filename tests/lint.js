// 指示書の矛盾・抜けチェック: node tests/lint.js [html]
// ガチャで作った DNA × 全レシピ × 添付あり/なし の組み合わせで、全文に決まりが守られているかを調べる。
const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '..', 'moffy-studio.html'));
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(file); await p.waitForTimeout(500);
  const report = await p.evaluate(() => {
    const problems = {}; let cases = 0;
    const note = (rule, ctx) => { (problems[rule] = problems[rule] || []).push(ctx); };
    const IMAGE = r => !['import', 'check', 'gem'].includes(r.id);
    const dnas = [...SAMPLES.map(s => ({ ...s })), { ...BLANK_DNA, n: 'オマカセ' }];
    for (let i = 0; i < 60; i++) dnas.push(gacha());
    // 既存キャラ名入り、取り込み由来の自由記述入り
    dnas.push({ ...DEFAULT_DNA, n: 'ピカチュウモッフィー', k: 'ミッフィーみたいな白、ドラえもん' });
    dnas.push(normalize({ name: 'ソラ', color: '水色とラベンダーのグラデーション', horn: '小さな金色のツノが3本', tail: 'なし', eyes: '３つ', other: 'おなかに星の模様' }));
    const friendsCodes = [dnaCode(SAMPLES[1]), dnaCode(SAMPLES[2]), dnaCode(gacha())].join('\n');
    for (const d0 of dnas) {
      const d = promptDNA(d0);
      for (const r of RECIPES) {
        const attachModes = r.usesAttach ? [true, false] : [false];
        for (const attach of attachModes) {
          const o = {};
          for (const f of r.fields) o[f.k] = f.type === 'multi' ? [...f.opts] : (f.def !== undefined ? f.def : (f.opts ? f.opts[0] : ''));
          if (r.id === 'stamps') o.panels = ['4', '6', '8'][cases % 3];
          if (r.id === 'friends') o.codes = friendsCodes;
          if (r.id === 'comic') o.talk = cases % 2 ? '短いセリフあり' : 'なし（絵だけ）';
          if (r.id === 'sheet') o.src = cases % 2 ? 'あり（公式ジェネレーターの画像など）' : 'なし（言葉から作る）';
          const friends = r.id === 'friends' ? o.codes.split('\n').map(x => promptDNA(parseDNA(x))) : [];
          const c = { attach, how: attach ? 'attach' : 'text', friends };
          const ratio = r.ratioBy ? r.ratioBy(o) : r.ratio;
          const segs = r.build(d, o, ratio, c);
          const t = segs.map(s => (s.h ? `【${s.h}】\n` : '') + s.t).join('\n\n');
          const tag = `${r.id}/${attach ? '添付' : '文章'}/${d0.n}`;
          cases++;
          if (/undefined|null|NaN|\[object/.test(t)) note('値の抜け（undefined など）', tag);
          if (IMAGE(r) && r.id !== 'fix' && !/鼻/.test(t)) note('鼻のルールがない', tag);
          if (IMAGE(r) && r.id !== 'fix' && !/アスペクト比は/.test(t)) note('アスペクト比の指定がない', tag);
          if (r.id === 'fix' && !/元の画像と同じ/.test(t)) note('部分修正で構図の維持がない', tag);
          if (IMAGE(r) && !/画像は1枚だけ/.test(t)) note('出力枚数の指定がない', tag);
          if (r.usesAttach && !attach && /添付/.test(t)) note('文章だけなのに「添付」が出る', tag);
          if (r.id !== 'sheet' && /おまかせ/.test(t)) note('「おまかせ」が指示書に漏れる', tag);
          if (/ピカチュウ|ミッフィー|ドラえもん/.test(t)) note('既存キャラ名が残る', tag);
          if (t.length > 3200) note('長すぎる（3200字超）', tag + ' ' + t.length);
          const textAllowed = r.id === 'stamps' || (r.id === 'comic' && o.talk.startsWith('短い'));
          if (IMAGE(r) && r.id !== 'fix' && !textAllowed && !/文字[^。]*入れない/.test(t)) note('文字を入れない指定がない', tag);
          if (r.id === 'stamps') { const n = (t.match(/^\d+\. 「/mg) || []).length; if (n !== +o.panels) note('スタンプの言葉の数がコマ数と違う', tag + ` ${n}/${o.panels}`); }
          if (IMAGE(r) && !['fix', 'friends'].includes(r.id) && !t.includes(`目は${eyeCount(d)}つ`)) note('目の数の記述がない', tag);
          if (r.id === 'friends' && attach && !t.includes('4枚の設定画')) note('共演の枚数がずれる', tag);
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
    return { cases, problems: Object.fromEntries(Object.entries(problems).map(([k, v]) => [k, { count: v.length, examples: v.slice(0, 3) }])), looseFail };
  });
  console.log(`組み合わせ ${report.cases} 件を検査`);
  const keys = Object.keys(report.problems);
  for (const k of keys) console.log(`FAIL ${k}: ${report.problems[k].count} 件  例: ${report.problems[k].examples.join(' / ')}`);
  for (const f of report.looseFail) console.log(`FAIL ゆるい JSON の取り込み: ${f}`);
  if (!keys.length && !report.looseFail.length) console.log('PASS すべての決まりを満たしています');
  await b.close();
  process.exit(keys.length || report.looseFail.length ? 1 : 0);
})();
