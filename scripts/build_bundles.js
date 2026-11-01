/* 由套卷 JSON 生成三个派生产物，避免手改：
     app/data/exam/index.json   套卷目录（列表页只读它）
     app/data/exam/bank.js      index + 所有套卷（file:// 双击打开时用，浏览器禁 fetch）
     app/data/exam/listening.js 听力题库（源文件在 app/data/listen/*.json）
     app/data/exam/audio.js     录音清单（本仓库不带录音，生成为空表）

   用法：node scripts/build_bundles.js
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXAM = path.join(ROOT, 'app', 'data', 'exam');
const LISTEN = path.join(ROOT, 'app', 'data', 'listen');

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const kb = n => Math.round(n / 1024) + ' KB';

/* ---------- 1. 阅读套卷 → index.json ---------- */
const files = fs.readdirSync(EXAM)
  .filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'))
  .sort();

const sets = [];
const bank = {};

for (const f of files) {
  const d = readJSON(path.join(EXAM, f));
  const id = f.replace(/\.json$/, '');
  const m = d.meta || {};
  if (!m.level) throw new Error(f + ' 缺少 meta.level');
  const reading = (d.reading || []).reduce((n, s) => n + (s.questions || []).length, 0);
  const w = d.writing || {};
  const dir = String(w.directions || '').replace(/^Directions:\s*/i, '').trim();
  sets.push({
    id: id,
    level: m.level,
    year: m.year,
    month: m.month,
    set: m.set,
    mock: !!m.mock,
    title: m.title || id,
    writingTitle: dir ? dir.slice(0, 40) : '',
    file: f,
    counts: { reading: reading, writing: w.directions ? 1 : 0, translation: d.translation && d.translation.source_cn ? 1 : 0 }
  });
  bank[id] = d;
}

/* 排序：先按级别，再按时间倒序（模拟卷排在前面），同场次按套号 */
const lvRank = { cet4: 0, cet6: 1 };
sets.sort((a, b) => {
  if (a.level !== b.level) return lvRank[a.level] - lvRank[b.level];
  if (!!a.mock !== !!b.mock) return a.mock ? -1 : 1;
  if (a.year !== b.year) return b.year - a.year;
  if (a.month !== b.month) return b.month - a.month;
  return (a.set || 0) - (b.set || 0);
});

const index = {
  schema: 'cet-index/1',
  sets: sets
};
fs.writeFileSync(path.join(EXAM, 'index.json'), JSON.stringify(index, null, 0) + '\n', 'utf8');

/* ---------- 2. 阅读套卷 → bank.js ---------- */
const bankOut = '/* 自动生成：题库打包（file:// 直接打开用）。源文件在 app/data/exam/*.json\n' +
  '   重新生成：node scripts/build_bundles.js */\n' +
  'window.CET_INDEX = ' + JSON.stringify(index) + ';\n' +
  'window.CET_BANK = ' + JSON.stringify(bank) + ';\n';
fs.writeFileSync(path.join(EXAM, 'bank.js'), bankOut, 'utf8');

/* ---------- 3. 听力套卷 → listening.js ---------- */
let lFiles = [];
try {
  lFiles = fs.readdirSync(LISTEN).filter(f => f.endsWith('.json')).sort();
} catch (e) { lFiles = []; }

const L = {}, A = {}, E = {};
for (const f of lFiles) {
  const d = readJSON(path.join(LISTEN, f));
  const id = d.id || f.replace(/\.json$/, '');
  const answers = d.answers || {};
  const exps = d.exps || {};
  delete d.answers; delete d.exps;
  L[id] = d; A[id] = answers; E[id] = exps;
}

const listenOut = '/* 自动生成：听力题库（源文件在 app/data/listen/*.json）\n' +
  '   重新生成：node scripts/build_bundles.js */\n' +
  'var CET_LISTENING = ' + JSON.stringify(L) + ';\n' +
  'var CET_LISTEN_ANSWERS = ' + JSON.stringify(A) + ';\n' +
  'var CET_LISTEN_EXPS = ' + JSON.stringify(E) + ';\n';
fs.writeFileSync(path.join(EXAM, 'listening.js'), listenOut, 'utf8');

/* ---------- 4. 录音清单（本仓库不带录音） ---------- */
const audioOut = '/* 自动生成：录音清单（app/audio/<setId>.mp3）。\n' +
  '   本仓库不分发录音，听力由系统 TTS 朗读；要内置录音就把文件放进 app/audio/\n' +
  '   并在这里补上 "setId": "audio/setId.mp3"。 */\n' +
  'window.CET_AUDIO = {};\n';
fs.writeFileSync(path.join(EXAM, 'audio.js'), audioOut, 'utf8');

console.log('阅读 ' + sets.length + ' 套 → index.json (' + kb(fs.statSync(path.join(EXAM, 'index.json')).size) + ')');
console.log('阅读 ' + sets.length + ' 套 → bank.js (' + kb(fs.statSync(path.join(EXAM, 'bank.js')).size) + ')');
console.log('听力 ' + Object.keys(L).length + ' 套 → listening.js (' + kb(fs.statSync(path.join(EXAM, 'listening.js')).size) + ')');
console.log('录音清单 → audio.js（空表）');
