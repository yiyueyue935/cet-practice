/* 过级 Web 无头冒烟测试（jsdom）
   覆盖：题库加载 / 列表 / 三题型作答 / 判分 / 进度 / 错题 / 生词 / AI 解析容错 / 作文与翻译渲染 / 数据导出导入 */
const fs = require('fs');
const path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { console.error('缺少 jsdom，先运行：npm install'); process.exit(1); }

const APP = path.join(__dirname, '..', 'app');
const read = p => fs.readFileSync(path.join(APP, p), 'utf8');

const errors = [];
const dom = new JSDOM(read('index.html'), { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;
window.addEventListener('error', e => errors.push('window.onerror: ' + e.message));

window.fetch = u => new Promise((res, rej) => {
  const f = path.join(APP, decodeURIComponent(String(u).replace(/^https?:\/\/[^/]+/, '')));
  if (!fs.existsSync(f)) return rej(new Error('404 ' + u));
  res({ ok: true, json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) });
});
window.confirm = () => true;
window.alert = () => {};
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
window.URL.revokeObjectURL = () => {};

const tick = ms => new Promise(r => setTimeout(r, ms));
const assert = (cond, msg) => { if (!cond) { errors.push('ASSERT: ' + msg); console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

/* 从题库动态取第一套四级卷：id、场次名、标准答案都不写死，换题库也能跑 */
const IDX = JSON.parse(read('data/exam/index.json'));
const CET4 = IDX.sets.filter(x => x.level === 'cet4');
const SID = CET4[0].id;
const SIT = CET4[0].mock ? '原创模拟'
  : (CET4[0].year + '年' + (CET4[0].month < 10 ? '0' + CET4[0].month : CET4[0].month) + '月');
const SET = JSON.parse(read('data/exam/' + SID + '.json'));
const ANS = {};
SET.reading.forEach(sec => (sec.questions || []).forEach(q => { ANS[q.n] = q.answer; }));

(async () => {
  ['app.js', 'ai.js', 'bank.js', 'ui.js', 'exam.js', 'rubric_w.js', 'rubric.js', 'offline.js', 'essay.js', 'trans.js', 'words.js', 'me.js', 'listen.js']
    .forEach(f => window.eval(read('js/' + f)));
  window.eval(read('data/exam/dict.js'));
  window.eval(read('data/exam/templates.js'));
  window.eval(read('data/exam/listening.js'));
  window.eval(read('data/exam/audio.js'));
  window.eval('UI.init()');
  await tick(500);

  const doc = window.document;
  const $ = s => doc.querySelector(s);

  console.log('\n== 首次进入：默认四级，不再弹选级 ==');
  assert(!doc.getElementById('overlay').classList.contains('on'), '首次进入不弹选级');
  assert(window.UI.level === 'cet4', '默认进入四级');
  assert(doc.querySelector('#scr-practice .opt-card'), '直接进练习主页');
  assert(doc.querySelector('#scr-practice .chips') === null, '练习页不放等级切换');
  assert(doc.querySelector('#scr-practice .tag-btn'), '顶栏有级别切换按钮');
  window.eval('UI.levelSheet()');
  await tick(50);
  assert(doc.querySelectorAll('#overlay .pick-item').length === 2, '级别面板两个选项');
  window.eval("UI.setLevel('cet6');UI.closeSheet()");
  await tick(60);
  assert(window.UI.level === 'cet6', '顶栏可切到六级');
  assert(doc.querySelector('#scr-practice .tag-btn').textContent.indexOf('六级') !== -1, '顶栏标签跟着变');
  window.eval("UI.setLevel('cet4')");
  await tick(60);

  console.log('\n== 练习主页：双入口 ==');
  assert(doc.getElementById('scr-practice').textContent.indexOf('整卷练习') !== -1, '入口卡：整卷练习');
  assert(doc.getElementById('scr-practice').textContent.indexOf('阅读专项') !== -1, '入口卡：阅读专项');
  assert(doc.querySelectorAll('#scr-practice .opt-card').length === 3, '三入口卡渲染（整卷/专项/听力）');
  assert(typeof window.CET_LISTENING === 'object' && Object.keys(window.CET_LISTENING).length >= 4, '听力题库加载');
  assert(typeof window.Listen === 'object', '听力模块加载');

  console.log('\n== 整卷练习：年份宫格 ==');
  window.eval("Practice.showGrid()");
  await tick(50);
  const sits = doc.querySelectorAll('#scr-practice .sit-card');
  assert(sits.length >= 1, '场次宫格渲染（' + sits.length + ' 个场次）');
  assert(doc.querySelector('#scr-practice .sit-date b'), '日期标识渲染');

  console.log('\n== 场次内套卷 ==');
  window.eval("Practice.openSitting(" + JSON.stringify(SIT) + ")");
  await tick(50);
  assert(doc.getElementById('scr-practice').textContent.indexOf(SIT) !== -1, '场次标题渲染');
  assert(doc.querySelectorAll('#scr-practice .paper').length >= 3, '该场次套卷齐全');

  console.log('\n== 级别切换 ==');  console.log('\n== 级别切换 ==');
  window.eval("UI.setLevel('cet6')");
  await tick(50);
  assert(doc.querySelectorAll('#scr-practice .sit-card, #scr-practice .paper').length > 0, '六级切换正常（有数据展示）');
  window.eval("UI.setLevel('cet4')");
  await tick(50);

  console.log('\n== 做题：选词填空（底部词库面板）==');
  window.eval("Exam.open('" + SID + "')");
  await tick(400);
  assert(doc.getElementById('scr-exam').classList.contains('on'), '进入做题页');
  const firstChip = doc.querySelector('#scr-exam .chips .chip');
  assert(firstChip && firstChip.textContent.indexOf('仔细阅读') !== -1, '节次排序：仔细阅读在前');
  window.eval("Exam.switchSec('A')");
  await tick(50);
  const blanks = doc.querySelectorAll('#scr-exam .blank-chip');
  assert(blanks.length === 10, '渲染 10 个空位');
  assert(!doc.querySelector('#scr-exam .bank-panel'), '未选空位时词库面板隐藏');
  window.eval('Exam.setBlank(26)');
  await tick(30);
  assert(doc.querySelector('#scr-exam .bank-panel'), '点空位弹出底部词库面板');
  const wopts = doc.querySelectorAll('#scr-exam .bank-panel .word-opt');
  assert(wopts.length === 15, '面板渲染 15 个单词选项');
  window.eval("Exam.assign('" + ANS[26] + "')");
  await tick(30);
  assert(window.Exam.answers[26] === ANS[26], '点词填入 26 空');
  assert(window.Exam.activeBlank === 27, '自动跳到下一个空');
  assert(doc.querySelector('#scr-exam .bank-panel'), '面板保持展开可继续填下一空');
  window.eval('Exam.clearBlank()');
  await tick(30);
  assert(window.Exam.answers[27] === undefined && window.Exam.activeBlank === 27, '清空第 27 空的答案，面板保持');
  window.eval('Exam.closeBank()');
  await tick(30);
  assert(!doc.querySelector('#scr-exam .bank-panel'), '点遮罩/收起 → 词库面板隐藏');

  console.log('\n== 段落匹配：连续题目 + 点题看全文 ==');
  window.eval("Exam.switchSec('B')");
  await tick(50);
  assert(!doc.querySelector('#scr-exam .pane-left'), '不再有左侧题号列');
  assert(doc.querySelectorAll('#scr-exam .q-row').length === 10, '连续列出 10 道题');
  assert(doc.querySelectorAll('#scr-exam .q-row .q-badge').length === 10, '蓝色题号可点');
  assert(!doc.querySelector('#scr-exam .para-chips'), '题目列表里不含段落选项');
  window.eval('Exam.matchTap(36)');
  await tick(50);
  assert(doc.querySelector('#scr-exam .stem-card.sticky-q'), '选中题目 → 题干卡片吸顶');
  assert(doc.querySelectorAll('#scr-exam .pchip').length >= 10, '段落选择 chips 就位');
  assert(doc.querySelectorAll('#scr-exam .passage > div').length >= 10, '展示长篇阅读全文');
  window.eval("Exam.pick(36,'" + ANS[36] + "')");
  assert(window.Exam.answers[36] === ANS[36], '段落匹配作答');
  assert(doc.querySelector('#scr-exam .stem-card .btn.link').textContent.indexOf('展开题号') !== -1, '段落匹配也有「展开题号」');
  window.eval('Exam.matchNumsToggle()');
  await tick(30);
  assert(doc.querySelectorAll('#scr-exam .qnum').length === 10, '展开 10 个题号');
  window.eval('Exam.matchJump(37)');
  await tick(30);
  assert(doc.querySelector('#scr-exam .q-badge').textContent === '37', '跳到第 37 题');
  window.eval('Exam.matchTap(37)');
  await tick(30);
  assert(doc.querySelectorAll('#scr-exam .q-row').length === 10, '返回题目列表');

  console.log('\n== 仔细阅读：首段 + 题目列表 ==');
  window.eval("Exam.switchSec('C1')");
  await tick(50);
  assert(!doc.querySelector('#scr-exam .pane-left'), '没有左侧题号列');
  assert(doc.querySelectorAll('#scr-exam .first-para .w-tap').length > 5, '原文单词可点');
  assert(doc.querySelector('#scr-exam .first-para'), '默认展示第一段');
  assert(doc.querySelectorAll('#scr-exam .q-row').length === 5, '连续列出 5 道题');
  assert(!doc.querySelector('#scr-exam .opt'), '题目列表不带选项');
  window.eval('Exam.careTap(46)');
  await tick(50);
  assert(doc.querySelector('#scr-exam .stem-card.sticky-q'), '选中题目 → 题干卡片吸顶');
  assert(doc.querySelectorAll('#scr-exam .stem-card .opt').length === 4, '吸顶卡片带 4 个选项');
  assert(doc.querySelectorAll('#scr-exam .passage p').length >= 2, '展示全文');
  window.eval("Exam.pick(46,'B')");
  assert(window.Exam.answers[46] === 'B', '仔细阅读作答');
  const toolBtns = [...doc.querySelectorAll('#scr-exam .stem-tools .btn.link')].map(x => x.textContent);
  assert(toolBtns.some(t => t.indexOf('展开题号') !== -1), '工具条有「展开题号」');
  assert(toolBtns.some(t => t.indexOf('收起选项') !== -1), '工具条有「收起选项」');
  assert(doc.querySelector('#scr-exam .read-detail'), '题目卡与原文包在 read-detail 里（平板分栏用）');
  window.eval('Exam.careOptsToggle()');
  await tick(30);
  assert(doc.querySelectorAll('#scr-exam .stem-card .opt').length === 0, '收起选项后卡片里没有选项');
  assert(doc.querySelector('#scr-exam .stem-card').textContent.indexOf('展开选项') !== -1, '按钮变「展开选项」');
  window.eval('Exam.careOptsToggle()');
  await tick(30);
  assert(doc.querySelectorAll('#scr-exam .stem-card .opt').length === 4, '再点恢复 4 个选项');
  window.eval('Exam.careNumsToggle()');
  await tick(30);
  assert(doc.querySelectorAll('#scr-exam .qnum').length === 5, '展开 5 个题号');
  window.eval('Exam.careJump(47)');
  await tick(30);
  assert(doc.querySelector('#scr-exam .q-badge').textContent === '47', '点题号跳到第 47 题');
  assert(doc.querySelector('#scr-exam .stem-card.sticky-q'), '跳题后题干仍吸顶');
  window.eval('Exam.careTap(47)');
  await tick(30);
  assert(doc.querySelector('#scr-exam .first-para'), '返回题目列表');

  console.log('\n== 点词查义 / 原文高亮 ==');
  assert(window.CET_DICT && Object.keys(window.CET_DICT).length > 5000, '内置词典加载（' + Object.keys(window.CET_DICT).length + ' 词）');
  assert(window.Exam.dictLookup('abruptly').indexOf('突然') !== -1, '内置词典直接命中');
  assert(window.Exam.dictLookup('studies') !== '', '词典词形还原（studies）');
  window.eval("Exam.tapWord('abruptly')");
  const wtxt = doc.getElementById('w-meaning').textContent;
  assert(wtxt.indexOf('突然') !== -1, '点词直接显示内置释义');
  assert(wtxt.indexOf('本文意思') !== -1 && wtxt.indexOf('常用意思') !== -1, '点词分「本文意思 / 常用意思」');
  const wBefore = Object.keys(window.Store.wordsAll()).length;
  window.eval("Words.quickAdd('abruptly')");
  assert(Object.keys(window.Store.wordsAll()).length === wBefore + 1, '加入生词本真的写入了');
  assert(window.Store.wordsAll()['abruptly'].t.indexOf('突然') !== -1, '生词本自动带上词典释义');
  window.eval("Words.quickAdd('abruptly')");
  assert(Object.keys(window.Store.wordsAll()).length === wBefore + 1, '重复加入不产生重复词条');
  window.eval('UI.closeSheet()');
  assert(typeof window.Exam.ctxSentence === 'function', '点词能取到所在句');
  const secB0 = window.Exam.section(window.Exam.sec);
  const srcText = secB0 ? (secB0.passage || (secB0.paragraphs || []).map(function (x) { return x.text; }).join(' ')) : '';
  const anyWord = (srcText.match(/[A-Za-z]{5,}/) || [''])[0];
  assert(anyWord && window.Exam.ctxSentence(anyWord) !== '', '当前文章里能定位到含该词的句子');
  const secB2 = window.Exam.section('B');
  const srcB = window.Exam.sourceHtml(secB2, secB2.questions[0]);
  assert(srcB.indexOf('para-hl') !== -1, '段落匹配：答案段标出');
  const secC2 = window.Exam.section('C1');
  const srcC = window.Exam.sourceHtml(secC2, secC2.questions[0]);
  assert(srcC.indexOf('para-hl') !== -1, '仔细阅读：对应段标出');
  assert(srcC.indexOf('class="hl"') !== -1, '仔细阅读：匹配句高亮');
  assert(window.Exam.sourceQuote(secC2, secC2.questions[0]).indexOf('src-quote') !== -1, '仔细阅读解析含原文定位');
  assert(window.Exam.sourceQuote(secB2, secB2.questions[0]).indexOf('src-quote') !== -1, '段落匹配解析含原文定位');

  console.log('\n== 判分与进度 ==');
  window.eval(`(function(){
    var a = {};
    Exam.sections().forEach(function(s){ s.questions.forEach(function(q){ a[q.n] = q.answer; }); });
    a[26] = (a[26] === 'A' ? 'B' : 'A');   // 故意错一题
    Exam.answers = a;
    ['A','B','C1','C2'].forEach(function(k){ Exam.sec = k; Exam.render(); Exam.submitSec(); });
  })()`);
  await tick(300);
  const prog = window.Store.progress(SID);
  assert(prog && prog.A && prog.A.done, 'A 节进度已保存');
  assert(prog.A.right === 9 && prog.A.total === 10, 'A 节 9/10 判分正确');
  assert(doc.getElementById('scr-result').classList.contains('on'), '结果页展示');
  assert(doc.getElementById('scr-result').textContent.indexOf('71.0') !== -1, '分数换算展示（仔细 14.2/题）');
  assert(doc.querySelector('#scr-result details.src'), '结果页有「回看原文」');
  assert(doc.querySelector('#scr-result .para-hl'), '结果页原文段落高亮');
  assert(doc.querySelector('#scr-result details.exp .src-quote'), '解析内嵌原文定位');
  assert(doc.querySelector('#scr-result details.exp .exp-note'), '解析标注「仅供参考」');
  assert(doc.querySelectorAll('#scr-result .review-item .q-stem .w-tap').length > 0, '回顾页题干单词可点');
  assert(window.Exam.cleanExp('答案 A ===== 第 12 页 ===== 解析').indexOf('第 12 页') === -1, '解析分页标记被清掉');
  assert(Object.keys(window.Store.wrongAll()).length === 1, '错题自动入错题本');
  const w0 = window.Store.wrongList()[0];
  assert(w0.passage && w0.passage.length > 20, '错题带上原文上下文（' + (w0.passage || '').length + ' 字）');

  console.log('\n== 总成绩页 ==');
  window.eval('Exam.overall()');
  await tick(100);
  const overTxt = doc.getElementById('scr-result').textContent;
  assert(overTxt.indexOf('/ 248.5 分') !== -1, '总成绩满分 248.5');
  assert(overTxt.indexOf('已做 30 题') !== -1, '总成绩统计 30 题');

  console.log('\n== 判分细则与解析渲染 ==');
  const S = window.Store;
  assert(S.scoreOf('banked_cloze', 10) === 35.5 && S.scoreOf('paragraph_matching', 10) === 71 && S.scoreOf('careful_reading', 10) === 142, '三题型满分权重 35.5 / 71 / 142');
  assert(Math.abs((S.scoreOf('banked_cloze', 10) + S.scoreOf('paragraph_matching', 10) + S.scoreOf('careful_reading', 5) * 2) - 248.5) < 1e-9, '四节合计 248.5（仔细阅读两节各 5 题）');
  assert(Math.abs(S.scoreOf('banked_cloze', 6) - 21.3) < 1e-9, '部分得分按题数线性换算（6×3.55）');
  const rateAll = S.setRate(SID);
  assert(rateAll && rateAll.total === 30 && rateAll.right === 29, 'setRate 只统计已提交的节（30 题 / 29 对）');

  let expQ = 0, expN = 0, autoN = 0;
  fs.readdirSync(path.join(APP, 'data/exam')).filter(f => /^cet[46]-.*\.json$/.test(f)).forEach(f => {
    const d = JSON.parse(read('data/exam/' + f));
    (d.reading || []).forEach(s => (s.questions || []).forEach(q => {
      expN++;
      if (q.explanation && String(q.explanation).trim()) { expQ++; if (q.auto) autoN++; }
    }));
  });
  assert(expQ / expN >= 0.99, '阅读解析覆盖 ≥99%（' + expQ + '/' + expN + '）');

  let conflictN = 0, mismatchN = 0, genN = 0;
  fs.readdirSync(path.join(APP, 'data/exam')).filter(f => /^cet[46]-.*\.json$/.test(f)).forEach(f => {
    const d = JSON.parse(read('data/exam/' + f));
    (d.reading || []).forEach(s => (s.questions || []).forEach(q => {
      if (q.check === 'conflict') conflictN++;
      if (q.expIssue === 'mismatch') mismatchN++;
      if (q.expGen === 1 || q.expRw === 1 || q.expAi === 1) genN++;
    }));
  });
  /* 选词填空 15 空必须对应 15 个不同字母，重复就是答案键错了 */
  let dupCloze = 0;
  fs.readdirSync(path.join(APP, 'data/exam')).filter(f => /^cet[46]-.*\.json$/.test(f)).forEach(f => {
    const d = JSON.parse(read('data/exam/' + f));
    (d.reading || []).forEach(s => {
      if (s.type !== 'banked_cloze') return;
      const a2 = (s.questions || []).map(q => q.answer);
      if (new Set(a2).size < a2.length) dupCloze++;
    });
  });
  assert(dupCloze === 0, '选词填空答案无重复字母（' + dupCloze + ' 套重复）');
  assert(conflictN >= 0, '待核对标记可读（' + conflictN + ' 题）');
  /* 每套都要有作文范文 */
  let noSample = 0;
  fs.readdirSync(path.join(APP, 'data/exam')).filter(f => /^cet[46]-.*\.json$/.test(f)).forEach(f => {
    const d = JSON.parse(read('data/exam/' + f));
    const s2 = (d.writing && d.writing.sample_essay || '').trim();
    if (s2.length < 80) noSample++;
  });
  assert(noSample === 0, '每套都有作文范文（缺 ' + noSample + ' 套）');
  assert(mismatchN === 0, '已无「解析挂错题」的残留（' + mismatchN + ' 题）');
  assert(autoN === 0, '旧 auto 标记已清理（' + autoN + ' 题）');

  const dupAns = [];
  fs.readdirSync(path.join(APP, 'data/exam')).filter(f => /^cet[46]-.*\.json$/.test(f)).forEach(f => {
    const d = JSON.parse(read('data/exam/' + f));
    const cloze = (d.reading || [])[0];
    if (!cloze) return;
    const as = (cloze.questions || []).map(q => q.answer);
    if (new Set(as).size !== as.length) dupAns.push(f);
  });
  assert(dupAns.length === 0, '选词填空答案字母不重复（重复 ' + dupAns.length + ' 套）');

  let lq = 0, le = 0;
  Object.keys(window.CET_LISTENING).forEach(id => (window.CET_LISTENING[id].sections || []).forEach(s => (s.questions || []).forEach(q => {
    lq++;
    const t = (window.CET_LISTEN_EXPS[id] || {})[q.n];
    if (t && String(t).trim()) le++;
  })));
  assert(le / lq >= 0.96, '听力解析覆盖 ≥96%（' + le + '/' + lq + '）');

  const sec0 = window.Exam.sections()[0];
  const q0 = sec0.questions[0];
  const bak = { e: q0.explanation, a: q0.auto };
  q0.explanation = '人工解析示例'; delete q0.auto;
  window.Exam.renderResult(sec0, 1, sec0.questions.length);
  assert(doc.querySelector('#scr-result details.exp') !== null, '有解析时渲染「查看解析」折叠块');
  q0.explanation = '【自动定位】答案依据：test sentence'; q0.auto = true;
  window.Exam.renderResult(sec0, 1, sec0.questions.length);
  assert(doc.getElementById('scr-result').textContent.indexOf('自动定位') !== -1, '自动解析带「自动定位」标签');
  q0.explanation = ''; delete q0.auto;
  window.Exam.renderResult(sec0, 1, sec0.questions.length);
  assert(doc.getElementById('scr-result').textContent.indexOf('暂无文字解析') !== -1, '无解析时给提示而不是空白');
  q0.explanation = '冲突示例'; q0.check = 'conflict';
  window.Exam.renderResult(sec0, 1, sec0.questions.length);
  assert(doc.getElementById('scr-result').textContent.indexOf('答案待核对') !== -1, '答案冲突时显示「答案待核对」');
  delete q0.check;
  q0.explanation = ''; q0.expIssue = 'mismatch';
  window.Exam.renderResult(sec0, 1, sec0.questions.length);
  assert(doc.getElementById('scr-result').textContent.indexOf('解析待校对') !== -1, '解析挂错题时显示「解析待校对」');
  delete q0.expIssue;
  const bakAns = q0.answer; q0.answer = '';
  window.Exam.renderResult(sec0, 0, sec0.questions.length);
  assert(doc.getElementById('scr-result').textContent.indexOf('答案缺失') !== -1, '答案缺失时显示「答案缺失」并标不计分');
  q0.answer = bakAns;
  q0.explanation = bak.e;
  if (bak.a) q0.auto = true;
  window.Exam.back();
  await tick(100);

  console.log('\n== 生词本 ==');
  window.eval("Store.wordAdd('beneficial','adj. 有益的','" + SID + "')");
  assert(window.Store.wordHas('beneficial'), '生词加入');
  window.eval("Store.wordAdd('alleviate','v. 减轻','阅读','高频词')");
  assert(window.Store.wordsAll()['alleviate'].cat === '高频词', '生词带分类');
  assert(window.Words.catNames().indexOf('高频词') !== -1, '分类列表含自定义分类');
  window.eval("Words.setCat('高频词')");
  await tick(30);
  assert(doc.getElementById('scr-words').textContent.indexOf('高频词') !== -1, '按分类筛选渲染');
  window.eval("Words.setCat('全部')");
  await tick(30);
  window.eval("UI.tabGo('words')");
  await tick(100);
  assert(doc.getElementById('scr-words').textContent.indexOf('beneficial') !== -1, '生词本渲染');
  window.eval("Store.wordRemove('beneficial')");
  assert(!window.Store.wordHas('beneficial'), '生词移除');

  console.log('\n== 错题本重做 ==');
  window.eval("Words.switchTo('wrong')");
  await tick(50);
  assert(doc.getElementById('scr-words').textContent.indexOf('第26题') !== -1, '错题列表展示 26 题');
  const w = window.Store.wrongList()[0];
  window.eval(`Exam.redo('${w.id}')`);
  window.eval(`Exam.redoPick('${w.id}','${w.answer}')`);
  await tick(50);
  assert(!window.Store.wrongAll()[w.id], '做对后移出错题本');

  console.log('\n== AI 解析容错 ==');
  const pj = window.AI.parseJSON;
  assert(pj('```json\n{"a":1}\n```').a === 1, '剥离 markdown 围栏');
  assert(pj('<think>思考</think>{"b":2}').b === 2, '剥离 think 块');
  const salv = pj('{"c":[1,2,{"d":"x"');
  assert(salv && salv.c && salv.c.length === 3, '截断 JSON 修复');
  let threw = false;
  try { pj('没有 JSON'); } catch (e) { threw = true; }
  assert(threw, '非 JSON 报错');
  assert(window.AI.ready() === false, '未配置时 ready=false');

  console.log('\n== 点词查义 / 首屏瘦身 ==');
  assert(typeof window.AI.wordLookup === 'function' && window.AI.wordPrompt('prompt').indexOf('prompt') !== -1, 'AI.wordLookup 已实现且提示词带入目标词');
  const origJson = window.AI.json;
  window.AI.json = () => Promise.resolve({ phonetic: '/ˈprɒmpt/', pos: 'adj.', meaning: '迅速的；及时的', example: 'She gave a prompt reply.' });
  const wr = await window.AI.wordLookup('prompt');
  assert(wr.phonetic === 'ˈprɒmpt' && wr.pos === 'adj.' && wr.meaning.indexOf('迅速') !== -1 && wr.example, 'wordLookup 解析音标/词性/释义/例句（音标去掉斜杠）');
  window.AI.json = origJson;
  let wrErr = false;
  await window.AI.wordLookup('').catch(() => { wrErr = true; });
  assert(wrErr, '空单词直接拒绝，不发请求');

  const idxHtml = read('index.html');
  assert(idxHtml.indexOf('data/exam/bank.js') === -1 && idxHtml.indexOf('data/exam/listening.js') === -1, '首屏不再预载 17MB 题库打包产物');
  assert(idxHtml.indexOf('data/exam/audio.js') !== -1, '录音清单（1KB）仍随首屏加载');
  assert(window.Bank._isFile() === false && typeof window.Bank.loadScript === 'function', 'http 环境走 index.json + 按需 fetch，不注入打包产物');
  assert(read('js/bank.js').indexOf("location.protocol === 'file:'") !== -1, 'file:// 双击时回退到打包产物');
  let ensured = false;
  await window.Listen.ensure().then(() => { ensured = true; });
  assert(ensured, '听力数据已在内存时 ensure 直接放行');
  const swSrc = read('sw.js');
  assert(swSrc.indexOf("'./data/exam/bank.js'") === -1 && swSrc.indexOf("'./data/exam/listening.js'") === -1, 'SW 不再预缓存题库打包产物');
  assert(swSrc.indexOf('/\\/audio\\//') !== -1, 'SW 跳过真题录音缓存（单套 10MB）');
  assert(swSrc.indexOf("'cet-v39'") !== -1, 'Service Worker 版本已升到 cet-v39');

  console.log('\n== 作文 / 翻译页 ==');
  window.eval("UI.gradeTab='essay'; UI.tabGo('grade')");
  await tick(200);
  assert(doc.getElementById('scr-essay').textContent.indexOf('选一道作文题') !== -1, '作文页渲染');
  assert($('#scr-essay .pick-row'), '套卷选择行渲染');
  window.eval('Essay.openPicker()');
  await tick(50);
  assert(doc.querySelectorAll('#overlay .pick-item').length >= 4, '选择面板列出套卷');
  window.eval("Essay.filterPicker('第2套')");
  const shown = [...doc.querySelectorAll('#overlay .pick-item')].filter(x => x.style.display !== 'none').length;
  assert(shown >= 1 && shown < doc.querySelectorAll('#overlay .pick-item').length, '搜索过滤生效');
  window.eval("Essay.pickPrompt('" + SID + "')");
  await tick(300);
  assert(!doc.getElementById('overlay').classList.contains('on'), '选择后关闭面板');
  assert(doc.getElementById('scr-essay').textContent.indexOf(SET.writing.directions.slice(0, 24)) !== -1, '作文题目带出');
  assert(window.CET_TEMPLATES.length >= 10, '作文模板库加载（' + window.CET_TEMPLATES.length + ' 类）');
  window.eval('Essay.openTemplate()');
  assert(doc.querySelectorAll('#overlay .tpl').length >= 10, '模板弹层渲染 10 类');
  assert(doc.querySelectorAll('#overlay .tpl-item').length >= 3, '模板条目渲染');
  window.eval('UI.closeSheet()');
  assert([...doc.querySelectorAll('#scr-essay .btn.ghost')].some(b => b.textContent.indexOf('离线评分') !== -1), '作文页有离线评分入口');
  const poorEssay = 'I think library is good. It is good. I like it. The library is good. I go there every day.';
  const goodEssay = 'Nowadays, university libraries have undergone significant changes. On the one hand, digital resources enable students to access information efficiently. On the other hand, quiet reading areas remain essential for deep thinking. For example, when I prepare for an exam, I usually borrow reference books and study in the reading room. Moreover, librarians provide valuable guidance on academic research. Therefore, libraries should combine technology with traditional services. Only in this way can they meet the diverse needs of students and promote independent learning.';
  const poorR = window.OfflineGrade.grade(poorEssay, 'Suppose your university is seeking students opinions on the library.', 'cet4');
  const goodR = window.OfflineGrade.grade(goodEssay, 'Suppose your university is seeking students opinions on the library.', 'cet4');
  assert(poorR.offline === true && goodR.offline === true, '离线评分返回 offline 标记');
  assert(goodR.score > poorR.score, '离线评分：好作文高于差作文（' + goodR.score + ' vs ' + poorR.score + '）');
  assert(goodR.score >= 2 && goodR.score <= 14, '离线评分在 2–14 区间');
  assert(goodR.dimension && goodR.dimension.content && goodR.dimension.language && goodR.dimension.organization, '离线评分三项维度齐全');
  assert(Array.isArray(goodR.rubric) && goodR.rubric.length === 3, '离线评分返回三维明细');
  /* 本地评分引擎：语法规则要能命中，也不能误报常见正确句式 */
  assert(typeof window.Rubric === 'object' && typeof window.Rubric.essay === 'function', '本地评分引擎已加载');
  const ruleErr = (t) => window.Rubric.features(t, 'Suppose your university is discussing campus life.', 'cet4')._err;
  assert(ruleErr('He go to school every day.').sva >= 1, '主谓一致：He go 被检出');
  assert(ruleErr('He does not go to school.').sva === 0, '主谓一致：He does not go 不误报');
  assert(ruleErr('It is a good idea.').sva === 0, '主谓一致：It is 不误报');
  assert(ruleErr('Yesterday the library is very crowded.').tense >= 1, '时态：Yesterday + 现在时被检出');
  assert(ruleErr('I saw a apple in the shop.').art >= 1, '冠词：a apple 被检出');
  assert(ruleErr('Many student like phone.').num >= 1, '名词单复数：many student 被检出');
  assert(ruleErr('Because I like reading.').frag >= 1, '句子片段：Because 从句单独成句被检出');
  assert(ruleErr('He made me to go there.').form >= 1, '词形：make sb to do 被检出');
  const okErr = ruleErr('The teacher explained the lesson clearly, and the students took notes carefully.');
  assert(okErr.sva === 0 && okErr.art === 0 && okErr.num === 0, '正确句式不误报（sva/art/num）');
  /* 错误越多分越低（旧版 7 个错封顶后不再扣分） */
  const baseText = 'The library is an important place for students. It provides many books and quiet rooms.';
  const noisy = (k) => baseText + ' ' + 'It help us a lot. '.repeat(k);
  const s3 = window.Rubric.essay(noisy(3), 'Suppose your university is discussing the library.', 'cet4').score;
  const s6 = window.Rubric.essay(noisy(6), 'Suppose your university is discussing the library.', 'cet4').score;
  assert(s6 <= s3, '错误越多分越低（' + s6 + ' <= ' + s3 + '）');
  window.eval("document.getElementById('essay-input').value = " + JSON.stringify(goodEssay));
  window.eval('Essay.offline()');
  await tick(80);
  assert(doc.getElementById('essay-result').textContent.indexOf('离线评分') !== -1, '离线评分结果渲染');
  assert(doc.getElementById('essay-result').textContent.indexOf('分项点评') !== -1, '离线评分分项点评渲染');
  assert(doc.querySelectorAll('#essay-result .dim-bar').length === 3, '三维得分条渲染');
  assert(doc.querySelector('#essay-result .dim-bar i').style.width !== '', '得分条按比例填充');
  assert(doc.querySelector('#scr-essay .essay-tools'), '作文页有拍照/相册入口');
  assert(doc.getElementById('essay-camera').getAttribute('capture') === 'environment', '拍照走后置摄像头');
  assert(doc.getElementById('essay-album').hasAttribute('multiple'), '相册支持多选');
  window.Essay.imgs = ['data:image/jpeg;base64,AAA'];
  window.Essay.renderImgs();
  assert(doc.querySelectorAll('#scr-essay .essay-thumb').length === 1, '图片预览');
  window.Essay.removeImg(0);
  assert(doc.querySelectorAll('#scr-essay .essay-thumb').length === 0, '移除图片');
  assert(window.AI.essayPrompt('cet4', '题目', '', 1).indexOf('识别图片') !== -1, '图片作文 prompt 要求识别');
  let vmsg = null;
  const bakChat = window.AI.chat;
  window.AI.chat = function (m) { vmsg = m; return Promise.resolve('{"score":10,"text":"hello"}'); };
  await window.AI.jsonImages('p', ['data:image/jpeg;base64,AAA']);
  window.AI.chat = bakChat;
  assert(vmsg && vmsg[1].content[1].type === 'image_url', '视觉请求带 image_url');
  assert(window.AI.essayPrompt('cet4', '题目', 'My essay.', 0, '119 词 / 8 句').indexOf('119 词') !== -1, '作文提示词带本地统计');
  assert(window.AI.MAX_CHARS <= 4000, '送模型的原文上限收紧（省 token）');
  assert(window.AI.explainPrompt({ n: 1, stem: 's', answer: 'A' }, 'P', '', 'FOCUS-PARA').indexOf('FOCUS-PARA') !== -1, '讲解只送定位段落');
  // 直接注入批改结果，验证渲染
  window.eval(`Essay.renderResult(document.getElementById('essay-result'), {score:11,band:'切题、表达较连贯',dimension:{content:'内容',language:'语言',organization:'结构'},sentences:[{src:'I think library is good.',type:'fix',fix:'I believe the library is beneficial.',note:'用词更正式'}],upgrade:['多使用连接词'],sample:'Sample essay text.',sample_cn:'范文译文'}, 'x')`);
  await tick(50);
  assert(doc.getElementById('essay-result').textContent.indexOf('11') !== -1, '作文评分渲染');
  assert(doc.getElementById('essay-result').textContent.indexOf('用词更正式') !== -1, '逐句点评渲染');
  assert(doc.getElementById('essay-result').textContent.indexOf('范' ) !== -1, '范文区渲染');

  window.eval("UI.gradeTab='trans'; UI.tabGo('grade')");
  await tick(200);
  assert(doc.getElementById('scr-trans').textContent.indexOf('选一道翻译题') !== -1, '翻译页渲染');
  assert(!doc.querySelector('#scr-trans select'), '翻译页不再用原生 select');
  assert(doc.querySelector('#scr-trans .pick-row'), '翻译页改为选择行');
  window.eval('Trans.openPicker()');
  await tick(50);
  assert(doc.querySelectorAll('#overlay .pick-item').length >= 4, '翻译选择面板列出套卷');
  window.eval("Trans.filterPicker('第2套')");
  const tShown = [...doc.querySelectorAll('#overlay .pick-item')].filter(x => x.style.display !== 'none').length;
  assert(tShown >= 1 && tShown < doc.querySelectorAll('#overlay .pick-item').length, '翻译选择支持搜索过滤');
  window.eval("Trans.pick('" + SID + "')");
  await tick(300);
  assert(!doc.getElementById('overlay').classList.contains('on'), '翻译选择后关闭面板');
  assert(window.Trans.curId === SID, '翻译选中套卷已记录');
  assert(typeof window.Trans.fromSet === 'function', 'fromSet 方法没被状态覆盖');
  assert(window.Trans.source.indexOf('Directions') === -1, '中文原文已去掉英文题目说明');
  assert(/[一-龥]/.test(window.Trans.source.slice(0,3)), '中文原文从汉字开始');
  /* 参考译文质量校验：题库里曾有 80 套是 OCR 整页抓取，不能塞进 prompt */
  assert(!window.Trans.refQuality('x '.repeat(3000)).ok, '超长参考译文判为不可用');
  assert(!window.Trans.refQuality('').ok, '空参考译文判为不可用');
  assert(window.Trans.refQuality('The Great Wall is a famous place in China.').ok, '正常参考译文可用');
  assert(window.AI.transPrompt('中文', 'y '.repeat(3000), 'x').indexOf('无可用参考译文') !== -1, '超长参考译文不进 prompt');
  assert(window.AI.transPrompt('中文', 'z '.repeat(400), 'x').indexOf('无可用参考译文') !== -1, '中长乱码也不进 prompt');
  window.eval("UI.setLevel('cet6')");
  await tick(60);
  const SID6 = IDX.sets.filter(x => x.level === 'cet6')[0].id;
  window.eval("Trans.pick('" + SID6 + "')");
  await tick(400);
  assert(window.Trans.refBad === '', '六级参考译文可用');
  assert(window.Trans.reference.length > 50, '六级参考译文已载入');
  window.eval("UI.setLevel('cet4')");
  await tick(60);
  window.eval("Trans.pick('" + SID + "')");
  await tick(300);
  assert(/[\u4e00-\u9fa5]{2}/.test(doc.getElementById('scr-trans').textContent), '翻译原文带出');
  /* 翻译离线评分：有参考时对照覆盖度，无参考时明确降级 */
  assert(window.Trans.reference && window.Trans.reference.length > 50, '参考译文已载入用于离线对照');
  const fullTr = window.Rubric.trans(window.Trans.source, window.Trans.reference, window.Trans.reference, 'cet4');
  const partTr = window.Rubric.trans(window.Trans.source, window.Trans.reference, window.Trans.reference.split(/\s+/).slice(0, 18).join(' '), 'cet4');
  assert(fullTr.score > partTr.score, '翻译离线：完整译文高于只译一小段（' + fullTr.score + ' vs ' + partTr.score + '）');
  const noRefTr = window.Rubric.trans(window.Trans.source, '', window.Trans.reference, 'cet4');
  assert(noRefTr.band.indexOf('无参考译文') !== -1, '翻译离线：无参考时明确标注');
  assert([...doc.querySelectorAll('#scr-trans .btn.ghost')].some(b => b.textContent.indexOf('离线评分') !== -1), '翻译页有离线评分入口');
  window.eval("document.getElementById('trans-input').value = " + JSON.stringify(window.Trans.reference));
  window.eval('Trans.offline()');
  await tick(80);
  assert(doc.getElementById('trans-result').textContent.indexOf('离线评分') !== -1, '翻译离线结果渲染');
  window.eval(`Trans.renderResult(document.getElementById('trans-result'), {score:10,band:'基本准确',diffs:[{type:'漏译',src:'traditional',better:'传统的',note:'漏了修饰语'}],revised:'Siheyuan is a traditional Chinese residential building.',reference_note:'be characterized by 常用表达'})`);
  await tick(50);
  assert(doc.getElementById('trans-result').textContent.indexOf('漏译') !== -1, '翻译逐点对照渲染');

  console.log('\n== 听力专题：作答 / 原文 / 解析 ==');
  window.eval("UI.setLevel('cet4'); Listen.render()");
  await tick(80);
  assert(doc.querySelectorAll('#scr-listen .paper').length >= 2, '听力列表渲染（' + doc.querySelectorAll('#scr-listen .paper').length + ' 套）');
  assert(doc.getElementById('scr-listen').textContent.indexOf('TTS') !== -1, '听力标注 TTS 朗读');
  assert(typeof window.CET_LISTEN_EXPS === 'object', '听力解析数据加载');
  const auKeys = Object.keys(window.CET_AUDIO || {});
  assert(auKeys.length === 0, '默认不带录音（录音清单为空，走 TTS）');
  assert(doc.getElementById('scr-listen').textContent.indexOf('套带内置录音') !== -1, '听力列表标注录音/TTS 套数');
  assert(doc.querySelectorAll('#scr-listen .paper .setno').length >= 2, '列表左侧有播放标记');
  window.eval("UI.setLevel('cet6'); Listen.render()");
  await tick(60);
  const lSet = Object.keys(window.CET_LISTENING).filter(function (k) { return window.CET_LISTENING[k].level === 'cet6'; })[0];
  window.eval("Listen.open('" + lSet + "')");
  await tick(60);
  assert(doc.getElementById('scr-listen-exam').textContent.indexOf('本套不带录音') !== -1, '无录音的套显示备注');
  const ttsBtn = doc.querySelector('#scr-listen-exam button[data-tts]');
  assert(ttsBtn && ttsBtn.getAttribute('onclick') === 'Listen.speakBtn(this)', 'TTS 按钮用 data-tts 传题干（不破坏 onclick 引号）');
  /* 按钮反馈：点击后变「朗读中…」，stop 后复原 */
  const nb = doc.querySelector('#scr-listen-exam button[data-tts]');
  const nbLabel = nb.textContent;
  nb.click();
  await tick(30);
  assert(nb.textContent.indexOf('朗读中') !== -1, '点播放后按钮显示「朗读中…」');
  window.eval('Listen.stop()');
  await tick(30);
  assert(nb.textContent === nbLabel, '停止后按钮文字复原');
  window.eval("Listen.back()");

  console.log('\n== TTS 朗读 ==');
  let spoken = null;
  const calls = [];
  window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; this.rate = 1; this.volume = 1; };
  window.speechSynthesis = {
    cancel() {}, speak(u) { calls.push(u); spoken = u; },
    getVoices() { return [{ lang: 'en-US', name: 'Test' }]; },
    addEventListener() {}, paused: false, resume() {}
  };
  assert(window.Listen.ttsInfo().count >= 1, 'TTS 自检能识别英语音色');
  assert(typeof window.Listen.ttsHelp === 'function', 'TTS 安装帮助入口');
  window.Listen.speak('"Question 1. Hello"');
  assert(spoken && spoken.text === 'Question 1. Hello', 'TTS 同步朗读（不包 setTimeout，保住手势）');
  assert(spoken.lang === 'en-US', 'TTS 使用英语音色');
  assert(window.Listen._utt === spoken, 'utterance 全局持有，防安卓 GC');
  assert(calls[0] && calls[0].volume === 0, '首次朗读先播静音语句解锁（iOS）');
  assert(read('js/listen.js').indexOf('JSON.stringify(JSON.stringify') === -1, '内联 onclick 不再双重编码');
  calls.length = 0; spoken = null;
  window.speechSynthesis.getVoices = function () { return []; };
  window.Listen._enVoice = undefined;
  window.Listen.speak('Hello');
  assert(spoken && spoken.text === 'Hello', '没有英语音色时也能直接朗读（用默认音色）');
  assert(window.Listen._utt && window.Listen._utt.text === 'Hello', '无音色时仍持有 utterance');
  spoken = null;
  window.Listen.speak('He said "hello" and it\'s fine.');
  assert(spoken && spoken.text === 'He said "hello" and it\'s fine.', '题干含引号也能朗读');
  const lFull = Object.keys(window.CET_LISTENING).find(function (k) {
    return window.CET_LISTENING[k].level === 'cet4' &&
      Object.keys(window.CET_LISTEN_ANSWERS[k] || {}).length === 25 &&
      window.CET_LISTENING[k].transcripts;
  });
  assert(!!lFull, '存在答案+原文完整的听力套');
  window.eval("Listen.open('" + lFull + "')");
  await tick(80);
  const lflat = window.Listen.flat();
  assert(lflat.length === 25, '听力套 25 题');
  lflat.forEach(function (x) { window.Listen.picked[x.q.n] = window.CET_LISTEN_ANSWERS[lFull][x.q.n] || 'A'; });
  window.eval("Listen.submit()");
  await tick(120);
  const rTxt = doc.getElementById('scr-result').textContent;
  assert(rTxt.indexOf('查看解析') !== -1, '结果页逐题解析入口');
  assert(rTxt.indexOf('查看原文') !== -1, '结果页听力原文入口');
  assert(rTxt.indexOf('25 / 25') !== -1, '满分显示 25/25');

  console.log('\n== 我的 / AI 配置 / 数据 ==');
  window.eval("UI.tabGo('me')");
  await tick(200);
  const meTxt = doc.getElementById('scr-me').textContent;
  assert(meTxt.indexOf('学习统计') !== -1 && meTxt.indexOf('AI 配置') !== -1, '我的页渲染');
  assert(meTxt.indexOf('考试级别') !== -1, '我的页可改考试级别');
  assert(meTxt.indexOf('语音朗读') !== -1, '我的页有语音朗读自检');
  assert(meTxt.indexOf('怎么装英语语音') !== -1, '我的页有安装英语语音入口');
  assert(doc.getElementById('ai-base') !== null && doc.getElementById('ai-model') !== null, 'AI 配置输入框存在');
  assert(meTxt.indexOf('未配置') !== -1, 'AI 未配置状态');
  const dump = window.Store.exportJSON();
  assert(dump.indexOf(SID) !== -1, '导出包含进度');
  const before = window.Store.stats().words;
  window.Store.importJSON(dump);
  assert(window.Store.stats().words === before, '导入幂等');

  console.log('\n== 清理与错误汇总 ==');
  const errCount = errors.length;
  assert(errCount === 0, '无 JS 错误 / 断言失败（实际 ' + errCount + ' 条）');
  if (errCount) errors.forEach(e => console.log('   -', e));
  console.log('\n' + (errCount === 0 ? '全部通过' : '存在失败项'));
  process.exit(errCount === 0 ? 0 : 1);
})();
