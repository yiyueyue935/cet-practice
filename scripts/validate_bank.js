/* 题库校验：结构 / 编号 / 答案唯一性 / 篇幅 / 范文与译文语言
   用法：node scripts/validate_bank.js [--strict]
   退出码 1 表示有错误（CI 里直接跑）。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXAM = path.join(ROOT, 'app', 'data', 'exam');
const LISTEN = path.join(ROOT, 'app', 'data', 'listen');

const errors = [];
const warns = [];
const err = (where, msg) => errors.push(where + ' · ' + msg);
const warn = (where, msg) => warns.push(where + ' · ' + msg);

const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const cjk = s => (String(s || '').match(/[\u4e00-\u9fa5]/g) || []).length;
const hasLatin = s => /[A-Za-z]{3,}/.test(String(s || ''));
const LETTERS = 'ABCDEFGHIJKLMNO'.split('');

/* ---------- 阅读套卷 ---------- */
const files = fs.readdirSync(EXAM).filter(f => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('_'));
const seenPassages = new Map();
const seenStems = new Map();
let nRead = 0, nQ = 0;

for (const f of files) {
  const id = f.replace(/\.json$/, '');
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(EXAM, f), 'utf8')); }
  catch (e) { err(id, 'JSON 解析失败：' + e.message); continue; }

  if (d.schema !== 'cet-bank/1') err(id, 'schema 应为 cet-bank/1');
  const m = d.meta || {};
  if (!['cet4', 'cet6'].includes(m.level)) err(id, 'meta.level 非法：' + m.level);
  if (!(m.year >= 2000 && m.year <= 2100)) err(id, 'meta.year 非法');
  if (!(m.month >= 1 && m.month <= 12)) err(id, 'meta.month 非法');

  const secs = d.reading || [];
  const want = [['A', 'banked_cloze'], ['B', 'paragraph_matching'], ['C1', 'careful_reading'], ['C2', 'careful_reading']];
  if (secs.length !== 4) err(id, 'reading 应为 4 个 section，实际 ' + secs.length);
  want.forEach((w, i) => {
    const s = secs[i] || {};
    if (s.key !== w[0]) err(id, '第 ' + (i + 1) + ' 个 section key 应为 ' + w[0]);
    if (s.type !== w[1]) err(id, '第 ' + (i + 1) + ' 个 section type 应为 ' + w[1]);
    if (!s.name || !s.short) err(id, w[0] + ' 缺 name/short');
  });

  /* A 选词填空 */
  const A = secs[0] || {};
  const blanks = (String(A.passage || '').match(/\[\[(\d+)\]\]/g) || []).map(x => +x.replace(/\D/g, ''));
  const need = Array.from({ length: 10 }, (_, i) => 26 + i);
  if (blanks.length !== 10) err(id, '选词填空应有 10 个 [[n]] 占位，实际 ' + blanks.length);
  need.forEach(n => { if (blanks.filter(x => x === n).length !== 1) err(id, '占位 [[' + n + ']] 缺失或重复'); });
  const wp = words(A.passage);
  if (wp < 180 || wp > 320) warn(id, '选词填空正文 ' + wp + ' 词（建议 220–260）');

  const opts = A.word_options || [];
  if (opts.length !== 15) err(id, '选词填空应有 15 个选项，实际 ' + opts.length);
  const ok = opts.map(o => o.k);
  const ot = opts.map(o => String(o.t || '').toLowerCase());
  if (new Set(ok).size !== ok.length) err(id, '选词填空选项字母重复');
  if (new Set(ot).size !== ot.length) err(id, '选词填空选项单词重复');
  ok.forEach((k, i) => { if (k !== LETTERS[i]) err(id, '选词填空选项字母应为 A–O 顺序，第 ' + (i + 1) + ' 个是 ' + k); });

  const aq = A.questions || [];
  if (aq.length !== 10) err(id, '选词填空应有 10 题，实际 ' + aq.length);
  const aAns = aq.map(q => q.answer);
  if (new Set(aAns).size !== aAns.length) err(id, '选词填空 10 个答案字母必须互不相同');
  aq.forEach((q, i) => {
    if (q.n !== 26 + i) err(id, '选词填空题号应为 26–35，第 ' + (i + 1) + ' 题是 ' + q.n);
    if (!ok.includes(q.answer)) err(id, '第 ' + q.n + ' 题答案 ' + q.answer + ' 不在 A–O');
    if (!q.explanation || q.explanation.length < 20) err(id, '第 ' + q.n + ' 题缺解析');
    else if (q.explanation.indexOf('答案') !== 0) warn(id, '第 ' + q.n + ' 题解析未以「答案」开头');
  });

  /* B 段落匹配 */
  const B = secs[1] || {};
  const paras = B.paragraphs || [];
  if (paras.length !== 10) err(id, '段落匹配应有 10 段，实际 ' + paras.length);
  paras.forEach((p, i) => {
    if (p.label !== LETTERS[i]) err(id, '段落标号应为 A–J，第 ' + (i + 1) + ' 段是 ' + p.label);
    const w = words(p.text);
    if (w < 40 || w > 160) warn(id, '段落 ' + p.label + ' 长度 ' + w + ' 词（建议 60–120）');
  });
  const bq = B.questions || [];
  if (bq.length !== 10) err(id, '段落匹配应有 10 题，实际 ' + bq.length);
  const bAns = bq.map(q => q.answer);
  if (new Set(bAns).size < 8) warn(id, '段落匹配只用到 ' + new Set(bAns).size + ' 个不同段落（建议 ≥8）');
  bq.forEach((q, i) => {
    if (q.n !== 36 + i) err(id, '段落匹配题号应为 36–45，第 ' + (i + 1) + ' 题是 ' + q.n);
    if (!paras.some(p => p.label === q.answer)) err(id, '第 ' + q.n + ' 题答案 ' + q.answer + ' 不在 A–J');
    if (!q.stem || words(q.stem) < 6) err(id, '第 ' + q.n + ' 题缺题干');
    if (!q.explanation || q.explanation.length < 20) err(id, '第 ' + q.n + ' 题缺解析');
    const key = String(q.stem || '').toLowerCase().replace(/\W+/g, ' ').trim();
    if (seenStems.has(key)) err(id, '第 ' + q.n + ' 题与 ' + seenStems.get(key) + ' 题干重复');
    else if (key) seenStems.set(key, id + '#' + q.n);
  });

  /* C 仔细阅读 */
  [2, 3].forEach((idx, k) => {
    const C = secs[idx] || {};
    const base = k === 0 ? 46 : 51;
    const w = words(C.passage);
    if (w < 280 || w > 520) warn(id, '仔细阅读 ' + (k + 1) + ' 正文 ' + w + ' 词（建议 350–450）');
    const cq = C.questions || [];
    if (cq.length !== 5) err(id, '仔细阅读 ' + (k + 1) + ' 应有 5 题，实际 ' + cq.length);
    cq.forEach((q, i) => {
      if (q.n !== base + i) err(id, '仔细阅读 ' + (k + 1) + ' 题号应为 ' + base + '–' + (base + 4) + '，第 ' + (i + 1) + ' 题是 ' + q.n);
      const o = q.options || {};
      if (Object.keys(o).length !== 4) err(id, '第 ' + q.n + ' 题应有 4 个选项');
      ['A', 'B', 'C', 'D'].forEach(x => { if (!o[x]) err(id, '第 ' + q.n + ' 题缺选项 ' + x); });
      if (!o[q.answer]) err(id, '第 ' + q.n + ' 题答案 ' + q.answer + ' 不在 A–D');
      if (!q.stem || words(q.stem) < 4) err(id, '第 ' + q.n + ' 题缺题干');
      if (!q.explanation || q.explanation.length < 20) err(id, '第 ' + q.n + ' 题缺解析');
    });
    const pkey = String(C.passage || '').slice(0, 120).toLowerCase().replace(/\W+/g, ' ').trim();
    if (pkey && seenPassages.has(pkey)) err(id, '仔细阅读 ' + (k + 1) + ' 与 ' + seenPassages.get(pkey) + ' 正文重复');
    else if (pkey) seenPassages.set(pkey, id);
  });

  /* 作文 */
  const W = d.writing || {};
  if (!W.directions || words(W.directions) < 15) err(id, '作文缺 directions');
  if (!W.sample_essay) err(id, '作文缺范文 sample_essay');
  else {
    const w = words(W.sample_essay);
    if (w < 110 || w > 230) err(id, '范文 ' + w + ' 词（要求 110–230）');
    if (!W.sample_essay_cn || cjk(W.sample_essay_cn) < 60) err(id, '范文缺中文译文');
  }

  /* 翻译 */
  const T = d.translation || {};
  if (!T.source_cn) err(id, '翻译缺 source_cn');
  else {
    if (hasLatin(T.source_cn)) err(id, 'source_cn 混入了英文（应只放中文段落）');
    const n = cjk(T.source_cn);
    if (n < 100 || n > 300) warn(id, '翻译原文 ' + n + ' 汉字（建议 140–180）');
  }
  if (T.reference_en_ok) {
    if (!T.reference_en || words(T.reference_en) < 60) err(id, 'reference_en 过短');
  }

  nRead++;
  nQ += (d.reading || []).reduce((s, x) => s + (x.questions || []).length, 0);
}

/* ---------- 听力套卷 ---------- */
let lFiles = [];
try { lFiles = fs.readdirSync(LISTEN).filter(f => f.endsWith('.json')); } catch (e) { lFiles = []; }
let nListen = 0, nLQ = 0;

for (const f of lFiles) {
  const id = f.replace(/\.json$/, '');
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(LISTEN, f), 'utf8')); }
  catch (e) { err(id, 'JSON 解析失败：' + e.message); continue; }

  if (!['cet4', 'cet6'].includes(d.level)) err(id, 'level 非法');
  const secs = d.sections || [];
  const wantQ = [7, 8, 10];
  if (secs.length !== 3) err(id, 'sections 应为 3 节，实际 ' + secs.length);
  let n = 0;
  const groups = new Set();
  secs.forEach((s, si) => {
    const qs = s.questions || [];
    if (qs.length !== wantQ[si]) err(id, '第 ' + (si + 1) + ' 节应有 ' + wantQ[si] + ' 题，实际 ' + qs.length);
    qs.forEach(q => {
      n++;
      if (q.n !== n) err(id, '题号应连续 1–25，期望 ' + n + ' 实际 ' + q.n);
      const o = q.options || {};
      ['A', 'B', 'C', 'D'].forEach(x => { if (!o[x]) err(id, '第 ' + q.n + ' 题缺选项 ' + x); });
      if (Object.keys(o).length !== 4) err(id, '第 ' + q.n + ' 题选项数不为 4');
      if (!q.group) err(id, '第 ' + q.n + ' 题缺 group');
      else groups.add(q.group);
    });
  });
  if (n !== 25) err(id, '总题数应为 25，实际 ' + n);

  const ans = d.answers || {};
  const exp = d.exps || {};
  for (let i = 1; i <= 25; i++) {
    if (!['A', 'B', 'C', 'D'].includes(ans[i])) err(id, '缺第 ' + i + ' 题答案');
    if (!exp[i] || String(exp[i]).length < 10) err(id, '缺第 ' + i + ' 题解析');
  }

  const tr = d.transcripts || {};
  const trk = Object.keys(tr);
  groups.forEach(g => { if (!trk.includes(g)) err(id, 'transcripts 缺 group：' + g); });
  trk.forEach(g => {
    if (!Array.isArray(tr[g]) || !tr[g].length) err(id, 'transcripts[' + g + '] 应为非空数组');
    else if (tr[g].some(p => !String(p).trim())) err(id, 'transcripts[' + g + '] 有空段');
  });
  const tw = trk.reduce((s, g) => s + (Array.isArray(tr[g]) ? tr[g].reduce((a, p) => a + words(p), 0) : 0), 0);
  if (tw < 700) warn(id, '听力原文合计 ' + tw + ' 词（建议 ≥1000）');

  nListen++;
  nLQ += n;
}

/* ---------- 汇总 ---------- */
console.log('阅读 ' + nRead + ' 套 / ' + nQ + ' 题');
console.log('听力 ' + nListen + ' 套 / ' + nLQ + ' 题');
if (warns.length) {
  console.log('\n提醒 ' + warns.length + ' 条：');
  warns.slice(0, 40).forEach(w => console.log('  ! ' + w));
  if (warns.length > 40) console.log('  … 其余 ' + (warns.length - 40) + ' 条省略');
}
if (errors.length) {
  console.log('\n错误 ' + errors.length + ' 条：');
  errors.slice(0, 60).forEach(e => console.log('  ✗ ' + e));
  if (errors.length > 60) console.log('  … 其余 ' + (errors.length - 60) + ' 条省略');
  process.exit(1);
}
console.log('\n校验通过');
