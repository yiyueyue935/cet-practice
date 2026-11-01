/* 内容合规检查：确保仓库里**只有原创内容**，没有四六级真题/录音/扫描件。
 *
 * 背景：代码可以开源，但真题原文、听力原文、官方范文、出版社解析、考试录音
 * 都受著作权保护，随仓库分发属于侵权。这条线要靠机器守住，不能靠记性。
 *
 * 用法：node scripts/check_content.js
 * 退出码 1 表示发现问题（CI 里直接跑）。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const errors = [];
const notes = [];
const err = msg => errors.push(msg);

/* ---------- 取文件清单：优先用 git（只看会被提交的文件） ---------- */
let files = [];
try {
  files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean);
  notes.push('文件清单来自 git ls-files（' + files.length + ' 个）');
} catch (e) {
  const skip = new Set(['.git', 'node_modules', 'private', 'dist', 'cap', 'build-env', 'test', 'wordtest', 'listen', '.workbuddy', '.workbuddy-ai']);
  (function walk(dir, rel) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(f.name)) continue;
      const r = rel ? rel + '/' + f.name : f.name;
      if (f.isDirectory()) walk(path.join(dir, f.name), r);
      else files.push(r);
    }
  })(ROOT, '');
  notes.push('不在 git 仓库里，按目录扫描（' + files.length + ' 个）');
}

const size = f => { try { return fs.statSync(path.join(ROOT, f)).size; } catch (e) { return 0; } };
const readJSON = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

/* ---------- 1. 不允许的扩展名：录音 / 扫描件 / 真题包 ---------- */
const BANNED = {
  '.mp3': '音频', '.ogg': '音频', '.m4a': '音频', '.wav': '音频', '.aac': '音频',
  '.pdf': '文档', '.doc': '文档', '.docx': '文档', '.rar': '压缩包', '.7z': '压缩包',
  '.apk': '安装包', '.ipa': '安装包'
};
files.forEach(f => {
  const ext = path.extname(f).toLowerCase();
  if (BANNED[ext]) err('不该入库的' + BANNED[ext] + '：' + f);
});

/* ---------- 2. 文件名里带「年份-月份」的套卷，一律当成真题 ---------- */
files.forEach(f => {
  if (/\bcet[46]-(19|20)\d\d-\d\d\b/i.test(path.basename(f))) {
    err('文件名像真题套卷（cet4-2023-06-1 这种命名）：' + f + '\n     原创模拟题请用 cet4-mock-1 / cet6-mock-2');
  }
});

/* ---------- 3. 阅读套卷必须显式声明原创 ---------- */
const EXAM = path.join(ROOT, 'app', 'data', 'exam');
const examFiles = fs.existsSync(EXAM)
  ? fs.readdirSync(EXAM).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'))
  : [];

let qTotal = 0, setTotal = 0;
examFiles.forEach(f => {
  let d;
  try { d = readJSON('app/data/exam/' + f); }
  catch (e) { err('套卷 JSON 解析失败：' + f); return; }
  const m = d.meta || {};
  if (m.mock !== true) {
    err('套卷没有标 mock:true，疑似真题：' + f + '\n     原创模拟题必须写 "mock": true');
  }
  if (/真题/.test(String(m.source || '')) && !/非真题/.test(String(m.source || ''))) {
    err('meta.source 里写了「真题」，容易被当成真题分发：' + f);
  }
  const kb = size('app/data/exam/' + f) / 1024;
  if (kb > 200) err('单套 ' + Math.round(kb) + 'KB 偏大（' + f + '），真题合订本常这样，确认一下');
  setTotal++;
  qTotal += (d.reading || []).reduce((n, s) => n + (s.questions || []).length, 0);
});

/* ---------- 4. 听力源同样要求原创 ---------- */
const LISTEN = path.join(ROOT, 'app', 'data', 'listen');
const listenFiles = fs.existsSync(LISTEN) ? fs.readdirSync(LISTEN).filter(f => f.endsWith('.json')) : [];
listenFiles.forEach(f => {
  let d;
  try { d = readJSON('app/data/listen/' + f); }
  catch (e) { err('听力 JSON 解析失败：' + f); return; }
  if (d.mock !== true) err('听力套卷没有标 mock:true，疑似真题：' + f);
});

/* ---------- 5. 录音目录：本地留着自用可以，但一个都不能入库 ---------- */
['app/audio', 'app/audio_opus'].forEach(dir => {
  const tracked = files.filter(f => f.indexOf(dir + '/') === 0);
  if (tracked.length) err(dir + '/ 里有 ' + tracked.length + ' 个文件被 git 跟踪了；录音不能入库');
  else {
    const p = path.join(ROOT, dir);
    if (fs.existsSync(p) && fs.readdirSync(p).length) {
      notes.push(dir + '/ 本地有文件，但未入库（.gitignore 生效）');
    }
  }
});

/* ---------- 6. 题库总体积 ---------- */
const bankBytes = examFiles.reduce((s, f) => s + size('app/data/exam/' + f), 0)
  + listenFiles.reduce((s, f) => s + size('app/data/listen/' + f), 0)
  + size('app/data/exam/dict.js') + size('app/data/exam/templates.js');
const bankMB = bankBytes / 1048576;
if (bankMB > 6) err('题库总体积 ' + bankMB.toFixed(1) + 'MB 偏大，确认没有把真题/录音打进来');

/* ---------- 汇总 ---------- */
console.log('阅读 ' + setTotal + ' 套 / ' + qTotal + ' 题，听力 ' + listenFiles.length + ' 套');
console.log('内容体积 ' + bankMB.toFixed(2) + ' MB');
notes.forEach(n => console.log('· ' + n));

if (errors.length) {
  console.log('\n发现 ' + errors.length + ' 处不符合「只放原创内容」的地方：');
  errors.forEach(e => console.log('  ✗ ' + e));
  console.log('\n说明见 docs/CONTENT-POLICY.md');
  process.exit(1);
}
console.log('\n内容边界检查通过：仓库里只有原创模拟题，没有真题 / 录音 / 扫描件');
