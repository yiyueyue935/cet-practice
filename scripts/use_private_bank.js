/* 切到本机私有题库（private/bank/，不入库）
 *
 * 有些人手上有自己有权使用、但无权再分发的套卷（例如买的真题册）。
 * 把它们放在 private/bank/ 下（结构同 app/data/exam/），跑这个脚本就能本地用起来：
 *
 *   private/bank/reading/*.json   单套阅读卷
 *   private/bank/listening.js     听力打包产物（可选）
 *   private/bank/audio.js         录音清单（可选）
 *   private/bank/index.json       套卷目录（可选，缺省会按 reading/*.json 现生成）
 *
 * 恢复成仓库自带的原创题库：
 *   git checkout -- app/data/exam && git clean -fd app/data/exam
 *
 * 注意：切过去之后 app/data/exam 会变成「已修改」，提交前务必切回来。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'private', 'bank');
const DST = path.join(ROOT, 'app', 'data', 'exam');

if (!fs.existsSync(SRC)) {
  console.error('没有 private/bank/。先把私有套卷按 app/data/exam/ 的结构放进去。');
  process.exit(1);
}

/* 1. 覆盖阅读套卷 */
const reading = path.join(SRC, 'reading');
const ids = [];
if (fs.existsSync(reading)) {
  for (const f of fs.readdirSync(reading)) {
    if (!f.endsWith('.json')) continue;
    fs.copyFileSync(path.join(reading, f), path.join(DST, f));
    ids.push(f.replace(/\.json$/, ''));
  }
}

/* 2. 覆盖听力与录音清单 */
for (const f of ['listening.js', 'audio.js']) {
  const p = path.join(SRC, f);
  if (fs.existsSync(p)) { fs.copyFileSync(p, path.join(DST, f)); console.log('已覆盖 ' + f); }
}

/* 3. 目录：有现成的就用，没有就按套卷生成（只写 index.json，不动 bank.js） */
const idxSrc = path.join(SRC, 'index.json');
if (fs.existsSync(idxSrc)) {
  fs.copyFileSync(idxSrc, path.join(DST, 'index.json'));
  console.log('已覆盖 index.json');
} else {
  const sets = [];
  for (const id of ids) {
    const d = JSON.parse(fs.readFileSync(path.join(DST, id + '.json'), 'utf8'));
    const m = d.meta || {};
    const dir = String((d.writing || {}).directions || '').replace(/^Directions:\s*/i, '').trim();
    sets.push({
      id: id, level: m.level, year: m.year, month: m.month, set: m.set, mock: !!m.mock,
      title: m.title || id, writingTitle: dir ? dir.slice(0, 40) : '', file: id + '.json',
      counts: {
        reading: (d.reading || []).reduce((n, s) => n + (s.questions || []).length, 0),
        writing: d.writing && d.writing.directions ? 1 : 0,
        translation: d.translation && d.translation.source_cn ? 1 : 0
      }
    });
  }
  fs.writeFileSync(path.join(DST, 'index.json'),
    JSON.stringify({ schema: 'cet-index/1', sets: sets }) + '\n', 'utf8');
  console.log('已按 ' + sets.length + ' 套重建 index.json（bank.js 未动，需要时跑 npm run build）');
}

console.log('已切到私有题库：' + ids.length + ' 套阅读卷');
