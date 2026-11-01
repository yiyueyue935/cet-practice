/* 过级 · 阅读作答引擎
   支持三种题型：banked_cloze（选词填空）/ paragraph_matching（段落匹配）/ careful_reading（仔细阅读） */
var Exam = {
  id: null,
  set: null,
  drill: false,
  srcId: null,
  sec: 'A',
  answers: {},        // {"26":"K","36":"D"}
  careOpts: true,     // 仔细阅读：吸顶卡里是否展开选项（收起后原文能多显示一半）
  activeBlank: null,  // 选词填空当前待填的题号

  open: function (id) {
    var self = this;
    UI.toast('正在读取套卷…');
    Bank.get(id).then(function (d) {
      self.id = id;
      self.drill = false;
      self.srcId = null;
      self.set = d;
      self.answers = {};
      self.sec = (self.orderedSections()[0] || {}).key || 'A';
      var rec = Store.progress(id) || {};
      // 已做过的节次默认从第一节开始，可自由切换
      self.activeBlank = null;
      self.render();
      UI.show('scr-exam');
      UI.hideToast();
    }).catch(function (e) { UI.toast(e.message, 3000); });
  },

  /* 阅读专项：直接以合成套开练（不读写套卷进度） */
  openDrill: function (setObj, type, srcId) {
    this.id = setObj.id;
    this.drill = true;
    this.srcId = srcId || null;
    this.set = setObj;
    this.answers = {};
    this.activeBlank = null;
    this.matchSel = null;
    this.careSel = null;
    this.matchNums = false;
    this.careNums = false;
    this.sec = (setObj.reading[0] && setObj.reading[0].key) || 'A';
    this.render();
    UI.show('scr-exam');
  },

  sections: function () { return (this.set && this.set.reading) || []; },

  /* 做题顺序：仔细阅读在前，段落匹配居中，选词填空殿后 */
  orderedSections: function () {
    var rank = { careful_reading: 0, paragraph_matching: 1, banked_cloze: 2 };
    return this.sections().slice().sort(function (a, b) {
      var ra = rank[a.type] !== undefined ? rank[a.type] : 9;
      var rb = rank[b.type] !== undefined ? rank[b.type] : 9;
      return ra - rb;
    });
  },
  section: function (key) {
    var hit = null;
    this.sections().forEach(function (s) { if (s.key === key) hit = s; });
    return hit;
  },

  /* ---------- 渲染 ---------- */
  render: function (keepScroll) {
    var self = this, set = this.set;
    if (!set) return;
    var el = document.getElementById('scr-exam');
    var keepTop = keepScroll ? el.scrollTop : 0;
    var meta = set.meta || {};
    var secObj = this.section(this.sec) || {};
    var setLabel = Bank.labelOf({ level: meta.level, mock: meta.mock, year: meta.year, month: meta.month, set: meta.set });
    var title = this.drill ? '阅读专项' : setLabel;
    var backBtn = this.drill
      ? '<button class="iconbtn" onclick="UI.show(\'scr-drill\');Drill.render()">‹</button>'
      : '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>';

    var html = UI.topbar(title, this.drill
        ? ((secObj.name || '训练') + ' · ' + setLabel)
        : ('阅读 · ' + this.sections().length + ' 节'),
      backBtn,
      '<button class="iconbtn" onclick="Exam.reviewAll()" title="查看已提交">✓</button>');

    // 节次切换（仔细阅读在前）
    var ordered = this.orderedSections();
    html += '<div class="chips">';
    ordered.forEach(function (s) {
      var done = false;
      var rec = Store.progress(self.id) || {};
      if (rec[s.key] && rec[s.key].done) done = true;
      html += '<button class="chip ' + (self.sec === s.key ? 'on' : '') + '" onclick="Exam.switchSec(\'' + s.key + '\')">' +
        esc(s.short || s.name || ('Section ' + s.key)) + (done ? ' ✓' : '') + '</button>';
    });
    html += '</div>';

    var s = this.section(this.sec);
    if (s) {
      html += '<div class="wrap">';
      /* 节名和题数在 chips 上已经有了，只有带 directions 的节才单独占一块，省出纵向空间给原文 */
      if (s.instructions) {
        html += '<div class="card tight"><div class="row between">' +
          '<b>' + esc(s.name || ('Section ' + s.key)) + '</b>' +
          '<span class="muted">' + (s.questions || []).length + ' 题</span></div>' +
          '<div class="hint" style="margin-top:6px">' + esc(s.instructions) + '</div></div>';
      }
      html += '<div class="card">' + this.renderSection(s) + '</div>';
      html += '<div class="exam-foot"><div class="row" style="gap:10px;align-items:center">' +
        '<button class="btn dark" style="flex:1" onclick="Exam.submitSec()">提交本节并判分</button>' +
        '<span class="muted" style="flex:none;font-size:12px">' + this.answeredIn(s) + '/' + (s.questions || []).length + '</span>' +
        '</div></div>';
      html += '</div>';
    }
    el.innerHTML = html;
    el.scrollTop = keepTop;
  },

  answeredIn: function (s) {
    var self = this, n = 0;
    (s.questions || []).forEach(function (q) { if (self.answers[q.n]) n++; });
    return n;
  },

  renderSection: function (s) {
    if (s.type === 'banked_cloze') return this.renderCloze(s);
    if (s.type === 'paragraph_matching') return this.renderMatching(s);
    return this.renderCareful(s);
  },

  /* 选词填空：原文占位；点空格 → 底部弹出词库面板 */
  renderCloze: function (s) {
    var self = this;
    var parts = String(s.passage || '').split(/\[\[(\d+)\]\]/);
    var html = '<div class="passage">';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        var n = parseInt(parts[i], 10);
        var picked = this.answers[n] || '';
        html += '<span class="blank-chip ' + (this.activeBlank === n ? 'on' : '') + '" onclick="Exam.setBlank(' + n + ')">' + (picked || n) + '</span>';
      } else {
        html += this.wrapWords(parts[i]).replace(/\n/g, '<br>');
      }
    }
    html += '</div>';
    if (this.activeBlank) {
      html += '<div class="bank-scrim" onclick="Exam.closeBank()"></div>';
      html += '<div class="bank-panel"><div class="bank-grip"></div>' +
        '<div class="row between" style="margin-bottom:8px"><b>填第 ' + this.activeBlank + ' 空</b>' +
        '<button class="btn link" onclick="Exam.clearBlank()">收起</button></div>';
      html += '<div class="word-opt-grid">';
      (s.word_options || []).forEach(function (o) {
        var usedBy = null;
        Object.keys(self.answers).forEach(function (n) { if (self.answers[n] === o.k) usedBy = n; });
        html += '<div class="word-opt ' + (usedBy ? 'on' : '') + '" onclick="Exam.assign(\'' + o.k + '\')">' +
          '<b>' + o.k + '</b>' + esc(o.t) + (usedBy ? '<div class="muted">→ ' + usedBy + '</div>' : '') +
          (o.m ? '<div class="muted">' + esc(o.m) + '</div>' : '') + '</div>';
      });
      html += '</div></div>';
    }
    return html;
  },

  setBlank: function (n) { this.activeBlank = n; this.render(); },
  clearBlank: function () { if (this.activeBlank) { delete this.answers[this.activeBlank]; this.render(); } },
  closeBank: function () { this.activeBlank = null; this.render(); },
  assign: function (letter) {
    var self = this;
    if (!this.activeBlank) { UI.toast('先点原文里的空格'); return; }
    // 同一个词不能重复用：先清掉别处的占用
    Object.keys(this.answers).forEach(function (n) {
      if (self.answers[n] === letter) delete self.answers[n];
    });
    this.answers[this.activeBlank] = letter;
    // 自动跳到下一个未填的空
    var s = this.section(this.sec), next = null;
    (s.questions || []).forEach(function (q) { if (!next && !self.answers[q.n]) next = q.n; });
    this.activeBlank = next;
    this.render(true);
  },

  /* 段落匹配：默认只显示第一段 + 连续题目列表；点题号 → 全文 + 题干置顶 */
  renderMatching: function (s) {
    var self = this;
    var sel = this.matchSel;
    var paras = s.paragraphs || [];
    var qs = s.questions || [];

    if (sel == null) {
      var html = '<div class="hint" style="margin:4px 0 6px">点题号查看全文并选择段落</div>';
      html += '<div class="q-list">';
      qs.forEach(function (q) {
        var a = self.answers[q.n];
        html += '<div class="q-row' + (a ? ' done' : '') + '" onclick="Exam.matchTap(' + q.n + ')">' +
          '<button class="q-badge">' + q.n + '</button>' +
          '<div class="q-row-stem">' + esc(q.stem) + '</div>' +
          (a ? '<span class="q-ans">' + a + '</span>' : '') +
          '</div>';
      });
      html += '</div>';
      return html;
    }

    var q = null;
    qs.forEach(function (x) { if (x.n === sel) q = x; });
    if (!q) { this.matchSel = null; return this.renderMatching(s); }

    var nums = '';
    if (this.matchNums) {
      nums = '<div class="qnum-row">';
      qs.forEach(function (x) {
        var a = self.answers[x.n];
        nums += '<button class="qnum' + (x.n === sel ? ' on' : '') + (a ? ' done' : '') +
          '" onclick="Exam.matchJump(' + x.n + ')">' + x.n + '</button>';
      });
      nums += '</div><div class="qnum-foot"><button class="btn link" onclick="Exam.matchTap(' + sel + ')">返回题目列表</button></div>';
    }
    var out = '<div class="read-detail"><div class="stem-card sticky-q">' +
      '<div class="q-stem" style="margin:0"><button class="q-badge">' + q.n + '</button> ' + this.wrapWords(q.stem) + '</div>' +
      '<div class="stem-tools"><button class="btn link" onclick="Exam.matchNumsToggle()">' + (this.matchNums ? '收起题号' : '展开题号') + '</button></div>' +
      nums + '<div class="para-chips">';
    paras.forEach(function (p) {
      out += '<button class="pchip ' + (self.answers[q.n] === p.label ? 'on' : '') + '" onclick="Exam.pick(' + q.n + ',\'' + p.label + '\')">' + p.label + '</button>';
    });
    out += '</div></div><div class="passage">';
    paras.forEach(function (p) {
      out += '<div style="margin:10px 0"><b class="p-label">' + esc(p.label) + '</b>  ' + self.wrapWords(p.text) + '</div>';
    });
    out += '</div></div>';
    return out;
  },

  matchTap: function (n) {
    this.matchSel = (this.matchSel === n) ? null : n;
    if (!this.matchSel) this.matchNums = false;
    this.render();
  },
  matchNumsToggle: function () { this.matchNums = !this.matchNums; this.render(true); },
  matchJump: function (n) { this.matchSel = n; this.render(); },

  /* 仔细阅读：默认只显示第一段 + 题目列表（不带选项）；点题号 → 全文 + 题干与选项吸顶 */
  renderCareful: function (s) {
    var self = this;
    var sel = this.careSel;
    var paras = String(s.passage || '').split('\n').filter(function (x) { return x.trim(); });
    var qs = s.questions || [];

    var optsHtml = function (q) {
      var h = '';
      ['A', 'B', 'C', 'D'].forEach(function (k) {
        if (!q.options || !q.options[k]) return;
        h += '<div class="opt ' + (self.answers[q.n] === k ? 'on' : '') + '" onclick="event.stopPropagation();Exam.pick(' + q.n + ',\'' + k + '\')">' +
          '<span class="k">' + k + '</span><span class="t">' + esc(q.options[k]) + '</span></div>';
      });
      return h;
    };

    if (sel == null) {
      var html = '';
      if (paras.length) {
        html += '<div class="passage first-para">' + this.wrapWords(paras[0]) + '</div>' +
          '<div class="hint" style="margin:10px 0 4px">全文共 ' + paras.length + ' 段 · 点题号看全文并作答</div>';
      }
      html += '<div class="q-list">';
      qs.forEach(function (q) {
        var a = self.answers[q.n];
        html += '<div class="q-row' + (a ? ' done' : '') + '" onclick="Exam.careTap(' + q.n + ')">' +
          '<button class="q-badge">' + q.n + '</button>' +
          '<div class="q-row-stem">' + esc(q.stem) + '</div>' +
          (a ? '<span class="q-ans">' + a + '</span>' : '') +
          '</div>';
      });
      html += '</div>';
      return html;
    }

    var q = null;
    qs.forEach(function (x) { if (x.n === sel) q = x; });
    if (!q) { this.careSel = null; return this.renderCareful(s); }

    var nums = '';
    if (this.careNums) {
      nums = '<div class="qnum-row">';
      qs.forEach(function (x) {
        var a = self.answers[x.n];
        nums += '<button class="qnum' + (x.n === sel ? ' on' : '') + (a ? ' done' : '') +
          '" onclick="Exam.careJump(' + x.n + ')">' + x.n + '</button>';
      });
      nums += '</div><div class="qnum-foot"><button class="btn link" onclick="Exam.careTap(' + sel + ')">返回题目列表</button></div>';
    }
    var tools = '<div class="stem-tools">' +
      '<button class="btn link" onclick="Exam.careOptsToggle()">' + (this.careOpts ? '收起选项 ⌃' : '展开选项 ⌄') + '</button>' +
      '<button class="btn link" onclick="Exam.careNumsToggle()">' + (this.careNums ? '收起题号' : '展开题号') + '</button>' +
      '</div>';
    var out = '<div class="read-detail">' +
      '<div class="stem-card sticky-q">' +
      '<div class="q-stem" style="margin:0"><button class="q-badge">' + q.n + '</button> ' + this.wrapWords(q.stem) + '</div>' +
      tools + nums + (this.careOpts ? optsHtml(q) : '') + '</div>' +
      '<div class="passage">' + paras.map(function (x) {
        return '<p style="margin:0 0 14px">' + self.wrapWords(x) + '</p>';
      }).join('') + '</div></div>';
    return out;
  },

  careOptsToggle: function () { this.careOpts = !this.careOpts; this.render(true); },

  careTap: function (n) {
    this.careSel = (this.careSel === n) ? null : n;
    if (!this.careSel) this.careNums = false;
    this.render();
  },
  careNumsToggle: function () { this.careNums = !this.careNums; this.render(true); },
  careJump: function (n) { this.careSel = n; this.render(); },

  /* 原文单词点击查义 */
  STOP: ('the a an and or but if of to in on at for with from by as is are was were be been being ' +
    'have has had do does did will would can could may might must should this that these those ' +
    'i you he she it we they me him her them us my your his its their our there here not no so ' +
    'than then when while because which who whom whose what how why where all any some more most ' +
    'very just also too only out up down over into about after before again once').split(' '),

  kwMap: function (text) {
    var map = {}, ws = String(text || '').toLowerCase().match(/[a-z]{3,}/g) || [];
    for (var i = 0; i < ws.length; i++) if (this.STOP.indexOf(ws[i]) === -1) map[ws[i]] = 1;
    return map;
  },

  scoreText: function (text, qk, ek) {
    var k = this.kwMap(text), sc = 0, w;
    for (w in qk) if (k[w]) sc += 2;
    for (w in ek) if (k[w]) sc += 1;
    return sc;
  },

  markSentence: function (text, qk, ek) {
    var arr = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)];
    var best = -1, bestScore = 0;
    for (var i = 0; i < arr.length; i++) {
      var sc = this.scoreText(arr[i], qk, ek);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    if (best < 0) return this.wrapWords(text);
    var out = '';
    for (var j = 0; j < arr.length; j++) {
      out += (j === best) ? '<span class="hl">' + this.wrapWords(arr[j]) + '</span>' : this.wrapWords(arr[j]);
    }
    return out;
  },

  bestSentence: function (text, qk, ek) {
    var arr = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)];
    var best = -1, bestScore = 0;
    for (var i = 0; i < arr.length; i++) {
      var sc = this.scoreText(arr[i], qk, ek);
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    return best >= 0 ? arr[best].trim() : '';
  },

  /* 解析里直接贴出的原文定位句（红色高亮） */
  sourceQuote: function (s, q) {
    if (!s) return '';
    var qk = this.kwMap((q.stem || '') + ' ' + ((q.options || {})[q.answer] || ''));
    var ek = this.kwMap(q.explanation || '');
    if (s.type === 'paragraph_matching') {
      var p = (s.paragraphs || []).filter(function (x) { return x.label === q.answer; })[0];
      if (!p) return '';
      var sent = this.bestSentence(p.text, qk, ek) || p.text.slice(0, 180);
      return '<div class="src-quote"><span class="src-tag">原文 ' + esc(p.label) + ' 段</span><span class="hl">' +
        this.wrapWords(sent) + '</span></div>';
    }
    if (s.type === 'careful_reading') {
      var paras = String(s.passage || '').split('\n').filter(function (x) { return x.trim(); });
      var qs = s.questions || [];
      var bi = this.bestPara(paras, qk, ek, this.properWords(q.stem), qs.indexOf(q), qs.length);
      if (bi < 0) return '';
      var sent2 = this.bestSentence(paras[bi], qk, ek) || paras[bi].slice(0, 180);
      return '<div class="src-quote"><span class="src-tag">原文定位</span><span class="hl">' +
        this.wrapWords(sent2) + '</span></div>';
    }
    return '';
  },

  /* 题干里的专有名词（Lao、Keynes 等），对定位帮助很大 */
  properWords: function (text) {
    var out = [], ws = String(text || '').match(/\b[A-Z][a-z]{2,}\b/g) || [];
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i].toLowerCase();
      if (this.STOP.indexOf(w) === -1 && out.indexOf(ws[i]) === -1) out.push(ws[i]);
    }
    return out;
  },

  /* qi/qn：第几题/共几题，用题目顺序做弱先验（四六级仔细阅读基本按段落顺序出题） */
  bestPara: function (paras, qk, ek, pn, qi, qn) {
    var sets = [], df = {}, i, w;
    for (i = 0; i < paras.length; i++) {
      var k = this.kwMap(paras[i]);
      sets.push(k);
      for (w in k) df[w] = (df[w] || 0) + 1;
    }
    var expected = (qn && qn > 1) ? Math.round((qi || 0) * (paras.length - 1) / (qn - 1)) : 0;
    var best = -1, bestScore = -1;
    for (i = 0; i < paras.length; i++) {
      var sc = 0;
      for (w in qk) if (sets[i][w]) sc += 2 / (1 + (df[w] || 0));   // 稀有关键词权重更高
      for (w in ek) if (sets[i][w]) sc += 1 / (1 + (df[w] || 0));
      for (var j = 0; j < (pn || []).length; j++) {
        if (paras[i].indexOf(pn[j]) !== -1) sc += 2;
      }
      if (Math.abs(i - expected) <= 1) sc += 0.3;
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    return best;
  },

  /* 回看原文：段落匹配标出答案段；仔细阅读按题干+解析找最相关段并高亮句子 */
  sourceHtml: function (s, q) {
    if (!s) return '';
    var qk = this.kwMap((q.stem || '') + ' ' + ((q.options || {})[q.answer] || ''));
    var ek = this.kwMap(q.explanation || '');
    if (s.type === 'paragraph_matching') {
      var out = '';
      (s.paragraphs || []).forEach(function (p) {
        var hit = p.label === q.answer;
        out += '<div class="src-para' + (hit ? ' para-hl' : '') + '"><b>' + esc(p.label) + '</b> ' +
          (hit ? this.markSentence(p.text, qk, ek) : this.wrapWords(p.text)) + '</div>';
      }, this);
      return out;
    }
    if (s.type === 'careful_reading') {
      var paras = String(s.passage || '').split('\n').filter(function (x) { return x.trim(); });
      var qs = s.questions || [];
      var best = this.bestPara(paras, qk, ek, this.properWords(q.stem), qs.indexOf(q), qs.length);
      var out2 = '';
      paras.forEach(function (p, i) {
        out2 += '<div class="src-para' + (i === best ? ' para-hl' : '') + '">' +
          (i === best ? this.markSentence(p, qk, ek) : this.wrapWords(p)) + '</div>';
      }, this);
      return out2;
    }
    return '';
  },

  /* 解析原文常有 OCR 分页标记/页眉，渲染前清掉 */
  cleanExp: function (t) {
    var s = String(t == null ? '' : t);
    s = s.replace(/={3,}\s*第\s*\d+\s*页\s*={3,}/g, ' ');
    s = s.replace(/\d{4}\s*[.．]\s*\d{1,2}\s*\/\s*\d+\s*[（(]\s*第\s*\d+\s*套\s*[）)]/g, ' ');
    s = s.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return s;
  },

  expDirty: function (t) {
    var s = String(t || '');
    return /={3,}/.test(s) || /第\s*\d+\s*页/.test(s) || s.length < 20;
  },

  wrapWords: function (text) {
    /* 先按单词切分，再逐段转义：避免把 &quot; 里的 quot 当成单词拆开 */
    var s = String(text == null ? '' : text);
    var re = /[A-Za-z][A-Za-z'’\-]*/g, m, out = '', last = 0;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      var w = m[0], clean = w.replace(/[^A-Za-z\-]/g, '');
      out += '<span class="w-tap" onclick="event.stopPropagation();Exam.tapWord(\'' + clean + '\')">' + esc(w) + '</span>';
      last = m.index + w.length;
    }
    return out + esc(s.slice(last));
  },

  IRR: {
    said: 'say', were: 'be', was: 'be', went: 'go', gone: 'go', children: 'child', men: 'man',
    women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', better: 'good', best: 'good',
    worse: 'bad', worst: 'bad', took: 'take', taken: 'take', made: 'make', got: 'get',
    gave: 'give', given: 'give', found: 'find', thought: 'think', brought: 'bring',
    bought: 'buy', came: 'come', saw: 'see', seen: 'see', knew: 'know', known: 'know',
    wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak', ran: 'run',
    began: 'begin', begun: 'begin', felt: 'feel', left: 'leave', kept: 'keep', held: 'hold',
    stood: 'stand', lost: 'lose', paid: 'pay', met: 'meet', sent: 'send', built: 'build',
    spent: 'spend', grew: 'grow', grown: 'grow', fell: 'fall', fallen: 'fall',
    broke: 'break', broken: 'break', drove: 'drive', driven: 'drive', ate: 'eat',
    eaten: 'eat', threw: 'throw', thrown: 'throw', caught: 'catch', taught: 'teach',
    fought: 'fight', chose: 'choose', chosen: 'choose', rose: 'rise', risen: 'rise',
    done: 'do', shown: 'show', became: 'become', told: 'tell', led: 'lead', spent: 'spend',
    meant: 'mean', dealt: 'deal', sought: 'seek', won: 'win', sang: 'sing', drank: 'drink',
    wore: 'wear', wore2: 'wear', lay: 'lie', laid: 'lay', hung: 'hang', stuck: 'stick'
  },

  BASE: {
    do: 'v. 做；干', does: 'v. 做（do 的第三人称单数）', did: 'v. 做（do 的过去式）',
    is: 'v. 是', are: 'v. 是', am: 'v. 是', be: 'v. 是；存在',
    has: 'v. 有（have 的第三人称单数）', have: 'v. 有；吃；进行', had: 'v. 有（have 的过去式）',
    will: 'aux. 将；会', would: 'aux. 将会；愿意', can: 'aux. 能；可以',
    could: 'aux. 能（can 的过去式）', may: 'aux. 可能；可以', might: 'aux. 可能',
    must: 'aux. 必须', should: 'aux. 应该', been: 'v. 是（be 的过去分词）',
    being: 'v. 是（be 的现在分词）', other: 'adj. 其他的；另外的', others: 'pron. 其他人/物',
    thing: 'n. 事情；东西', things: 'n. 事情；东西（复数）',
    a: 'art. 一个（不定冠词）', an: 'art. 一个（用于元音前）',
    cannot: 'v. 不能', tech: 'n. 技术（technology 的缩写）', email: 'n. 电子邮件',
    wellbeing: 'n. 幸福；健康', "long-term": 'adj. 长期的',
    
    how: "怎样；如何",
    what: "什么",
    when: "什么时候",
    where: "哪里",
    why: "为什么",
    who: "谁",
    which: "哪一个",
    whose: "谁的",
    this: "这个",
    that: "那个；那",
    these: "这些",
    those: "那些",
    it: "它",
    its: "它的",
    they: "他们",
    them: "他们",
    their: "他们的",
    we: "我们",
    our: "我们的",
    you: "你；你们",
    your: "你的",
    he: "他",
    him: "他",
    his: "他的",
    she: "她",
    her: "她的",
    i: "我",
    me: "我",
    my: "我的",
    us: "我们",
    there: "那里；存在",
    here: "这里",
    not: "不；没有",
    no: "不；没有",
    yes: "是",
    and: "和",
    or: "或者",
    but: "但是",
    so: "所以",
    if: "如果",
    because: "因为",
    while: "当……时；然而",
    although: "虽然",
    though: "虽然",
    than: "比",
    then: "然后",
    as: "作为；当……时",
    of: "……的",
    to: "到；向",
    in: "在……里",
    on: "在……上",
    at: "在",
    for: "为了",
    with: "和；带有",
    from: "从",
    by: "通过；被",
    about: "关于",
    into: "进入",
    over: "在……上方；超过",
    after: "在……之后",
    before: "在……之前",
    between: "在……之间",
    during: "在……期间",
    through: "通过",
    up: "向上",
    down: "向下",
    out: "出去",
    off: "离开",
    again: "再次",
    also: "也",
    too: "也；太",
    very: "非常",
    just: "只是；刚刚",
    only: "只",
    more: "更多",
    most: "最",
    some: "一些",
    any: "任何",
    all: "所有",
    both: "两者都",
    each: "每个",
    every: "每个",
    such: "这样的",
    own: "自己的",
    same: "相同的",
    many: "许多",
    much: "许多",
    few: "很少",
    little: "很少",
    first: "第一",
    second: "第二",
    last: "最后的",
    next: "下一个",
    new: "新的",
    old: "旧的",
    good: "好的",
    bad: "坏的",
    big: "大的",
    small: "小的",
    long: "长的",
    short: "短的",
    high: "高的",
    low: "低的",
    right: "正确的；右边",
    wrong: "错误的",
    true: "真的",
    false: "假的"
  },

  dictLookup: function (w) {
    if (typeof CET_DICT === 'undefined' || !CET_DICT) return '';
    var k = String(w || '').toLowerCase();
    if (this.BASE[k]) return this.BASE[k];
    var irr = this.IRR[k];
    if (irr && CET_DICT[irr]) return CET_DICT[irr];
    var base = k.split("'")[0];                 // wouldn't → wouldn
    var cands = [k, base, base.replace(/n$/, ''), base.replace(/d$/, ''), base + 's', base + 'es',
      base + 'ed', base + 'ing', base + 'd', base + 'ly', base + 'er', base + 'est',
      base.replace(/ies$/, 'y'), base.replace(/ied$/, 'y'), base.replace(/ing$/, ''),
      base.replace(/ing$/, 'e'), base.replace(/ed$/, ''), base.replace(/ed$/, 'e'),
      base.replace(/d$/, ''), base.replace(/n$/, '')];
    for (var i = 0; i < cands.length; i++) {
      if (CET_DICT[cands[i]]) return CET_DICT[cands[i]];
      if (this.BASE[cands[i]]) return this.BASE[cands[i]];
    }
    var pref = k.replace(/^(un|in|im|dis|non)/, '');
    if (pref !== k && pref.length >= 3 && CET_DICT[pref]) return CET_DICT[pref];
    return '';
  },

  /* ---------- 点词：本文意思 + 常用意思 ---------- */
  /* 词形还原候选：复数 / 三单 / 过去式 / 进行式 / 比较级 / 副词 / 双写辅音 */
  forms: function (k) {
    var out = [k];
    var add = function (x) { if (x && x.length >= 2 && out.indexOf(x) === -1) out.push(x); };
    if (/[^s]s$/.test(k)) add(k.slice(0, -1));
    if (/ies$/.test(k)) add(k.slice(0, -3) + 'y');
    if (/ied$/.test(k)) add(k.slice(0, -3) + 'y');
    if (/es$/.test(k)) add(k.slice(0, -2));
    if (/ed$/.test(k)) { add(k.slice(0, -2)); add(k.slice(0, -1)); }
    if (/ing$/.test(k)) { add(k.slice(0, -3)); add(k.slice(0, -3) + 'e'); }
    if (/ly$/.test(k)) { add(k.slice(0, -2)); }
    if (/er$/.test(k)) { add(k.slice(0, -2)); add(k.slice(0, -1)); }
    if (/iest$/.test(k)) add(k.slice(0, -4) + 'y');
    if (/ier$/.test(k)) add(k.slice(0, -3) + 'y');
    if (/est$/.test(k)) { add(k.slice(0, -3)); add(k.slice(0, -2)); }
    var more = out.slice();
    more.forEach(function (x) { if (/([b-df-hj-np-tv-z])\1$/.test(x)) add(x.slice(0, -1)); });
    return out;
  },

  dictEntry: function (w) {
    if (typeof CET_DICT === 'undefined' || !CET_DICT) return null;
    var k = String(w || '').toLowerCase();
    if (k.indexOf('-') > 0) {
      var parts = k.split('-').filter(function (x) { return x.length > 1; });
      for (var pi = 0; pi < parts.length; pi++) {
        if (CET_DICT[parts[pi]]) return { key: parts[pi], text: CET_DICT[parts[pi]] + '（' + k + ' 的一部分）' };
      }
    }
    if (this.BASE[k]) return { key: k, text: this.BASE[k], base: true };
    var irr = this.IRR[k];
    if (irr && CET_DICT[irr]) return { key: irr, text: CET_DICT[irr] };
    var neg = { "don't": 'do', "doesn't": 'do', "didn't": 'do', "isn't": 'is', "aren't": 'is',
      "wasn't": 'is', "weren't": 'is', "won't": 'will', "wouldn't": 'will', "can't": 'can',
      "couldn't": 'can', "shouldn't": 'should', "haven't": 'have', "hasn't": 'have',
      "hadn't": 'have', "mustn't": 'must', "ain't": 'is' };
    var kk = k.replace(/[\u2019]/g, "'");
    if (neg[kk] && CET_DICT[neg[kk]]) return { key: neg[kk], text: CET_DICT[neg[kk]] };
    var base = k.split("'")[0];
    var cands = this.forms(k).concat(this.forms(base));
    for (var i = 0; i < cands.length; i++) {
      if (CET_DICT[cands[i]]) return { key: cands[i], text: CET_DICT[cands[i]] };
      if (this.BASE[cands[i]]) return { key: cands[i], text: this.BASE[cands[i]], base: true };
    }
    /* 再来一层：researchers → researcher → research */
    for (var j = 0; j < cands.length && j < 6; j++) {
      var f2 = this.forms(cands[j]);
      for (var m = 1; m < f2.length; m++) {
        if (CET_DICT[f2[m]]) return { key: f2[m], text: CET_DICT[f2[m]], prefix: true };
      }
    }
    /* 派生词：fully → full，meaningful → meaning，affordable → afford，cultural → culture */
    var sufs = ['ness', 'ment', 'less', 'ful', 'able', 'ible', 'ous', 'ical', 'ally', 'al', 'ic',
      'ive', 'ity', 'dom', 'ship', 'ance', 'ence', 'ly', 'er', 'ist', 'ism'];
    for (var si = 0; si < sufs.length; si++) {
      var sf = sufs[si];
      if (k.length > sf.length + 2 && k.slice(-sf.length) === sf) {
        var stem = k.slice(0, -sf.length);
        var tries = [stem, stem + 'e', stem + 'y'];
        if (/i$/.test(stem)) tries.push(stem.slice(0, -1) + 'y');
        for (var ti = 0; ti < tries.length; ti++) {
          if (CET_DICT[tries[ti]]) return { key: tries[ti], text: CET_DICT[tries[ti]], prefix: true };
        }
      }
    }
    var pref = k.replace(/^(un|in|im|dis|non)/, '');
    if (pref !== k && pref.length >= 3 && CET_DICT[pref]) return { key: pref, text: CET_DICT[pref], prefix: true };
    return null;
  },

  dictLookup: function (w) {
    var e = this.dictEntry(w);
    return e ? e.text : '';
  },

  /* 一个词条里可能有多个义项（用；分隔） */
  dictSenses: function (text) {
    return String(text || '').split(/[；;]/).map(function (x) { return x.trim(); })
      .filter(Boolean).slice(0, 5);
  },

  guessPos: function (w) {
    var k = String(w || '').toLowerCase();
    if (/(tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|er|or|ics)$/.test(k)) return 'n.';
    if (/ly$/.test(k)) return 'adv.';
    if (/(ous|ful|less|able|ible|ive|al|ic|ary|ant|ent)$/.test(k)) return 'adj.';
    if (/(ize|ise|ify|ate|en)$/.test(k)) return 'v.';
    if (/(ed|ing)$/.test(k)) return 'v.';
    return '';
  },

  /* 取当前文章里包含该词的句子 */
  ctxSentence: function (w) {
    var s = this.section(this.sec);
    if (!s) return '';
    var text = s.passage || '';
    if (!text && s.paragraphs) {
      text = s.paragraphs.map(function (x) { return x.text || ''; }).join(' ');
    }
    if (!text) return '';
    var safe = String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = new RegExp('[^.!?]*\\b' + safe + '\\b[^.!?]*[.!?]', 'i').exec(text);
    return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 240) : '';
  },

  tapWord: function (w) {
    w = String(w || '').replace(/[^A-Za-z'\u2019\-]/g, '');
    if (!w) return;
    var bank = this.section(this.sec) || {};
    var bm = '';
    (bank.word_options || []).forEach(function (o) { if (String(o.t).toLowerCase() === w.toLowerCase() && o.m) bm = o.m; });
    var entry = this.dictEntry(w);
    var senses = entry ? this.dictSenses(entry.text) : [];
    var ctx = this.ctxSentence(w);
    var pos = this.guessPos(w);

    /* 本文意思：完形词库 > AI 结合上下文 > 按词性推测 */
    var ctxHtml, ctxSrc;
    if (bm) {
      ctxHtml = esc(bm); ctxSrc = '本篇完形填空词库';
    } else if (senses.length === 1) {
      ctxHtml = esc(senses[0]); ctxSrc = '词典释义（该词只有一个常用义）';
    } else if (senses.length && pos) {
      var hit = senses.filter(function (x) { return x.indexOf(pos) === 0; })[0];
      ctxHtml = esc(hit || senses[0]); ctxSrc = '按词性推测（' + pos + '），接入 AI 可按上下文判断';
    } else if (senses.length) {
      ctxHtml = esc(senses[0]); ctxSrc = '词典首义，接入 AI 可按上下文判断';
    } else {
      ctxHtml = AI.ready() ? '查询中…' : '内置词典未收录';
      ctxSrc = '';
    }

    var sensesHtml = senses.length
      ? senses.map(function (x) { return '<div class="ws-sense">' + esc(x) + '</div>'; }).join('')
      : '<div class="ws-sense muted">内置词典未收录这个词' + (AI.ready() ? '，正在用 AI 查询' : '，接入 AI 后可查') + '</div>';

    UI.sheet('<h3 style="margin-bottom:4px">' + esc(w) +
        (entry && entry.key !== w.toLowerCase() ? '<span class="tag" style="margin-left:8px">' + esc(entry.key) + '</span>' : '') +
        '</h3>' +
      '<div id="w-meaning">' +
        '<div class="ws-block"><div class="ws-label">本文意思</div>' +
          '<div class="ws-text" id="w-ctx">' + ctxHtml + '</div>' +
          '<div class="ws-src" id="w-ctx-src">' + esc(ctxSrc) + '</div></div>' +
        '<div class="ws-block"><div class="ws-label">常用意思</div><div class="ws-senses">' + sensesHtml + '</div></div>' +
        (ctx ? '<div class="ws-ctx"><b>原句</b> ' + this.wrapWords(ctx) + '</div>' : '') +
      '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn small dark" data-w="' + esc(w) + '" onclick="Words.quickAdd(this.dataset.w)">加入生词本</button>' +
      (AI.ready() ? '<button class="btn small ghost" data-w="' + esc(w) + '" onclick="Exam.aiWord(this.dataset.w)">AI 详解</button>' : '') +
      '</div>');

    /* 没收录 / 想知道本句具体意思时，交给 AI 结合上下文判断 */
    if (AI.ready() && ctx && !bm) {
      var box = document.getElementById('w-ctx');
      AI.wordLookup(w, ctx).then(function (r) {
        if (!box || !r.ctx) return;
        box.innerHTML = esc(r.ctx);
        var src = document.getElementById('w-ctx-src');
        if (src) src.textContent = 'AI 结合上下文判断';
      }).catch(function () {});
    }
  },

  aiWord: function (w) {
    if (!AI.ready()) { UI.toast('先在「我的 → AI 配置」接入模型'); return; }
    var box = document.getElementById('w-meaning');
    if (box) box.innerHTML = '<div class="ai-explain">AI 查询中…</div>';
    AI.wordLookup(w).then(function (r) {
      if (!box) return;
      box.innerHTML = '<div class="ai-explain">' +
        (r.phonetic ? '<div class="muted" style="margin-bottom:4px">' + esc(r.phonetic) + '</div>' : '') +
        '<div><b>' + esc(r.pos || '') + '</b> ' + esc(r.meaning || '') + '</div>' +
        (r.example ? '<div class="muted" style="margin-top:8px"><i>' + esc(r.example) + '</i></div>' : '') + '</div>';
    }).catch(function (e) {
      if (box) box.innerHTML = '<div class="ai-explain">查询失败：' + esc(e.message) + '</div>';
    });
  },

  pick: function (n, v) {
    if (v) this.answers[n] = v; else delete this.answers[n];
    this.render(true);
  },

  switchSec: function (key) {
    this.sec = key;
    this.activeBlank = null;
    this.matchSel = null;
    this.careSel = null;
    this.matchNums = false;
    this.careNums = false;
    this.render();
  },

  /* ---------- 判分 ---------- */
  submitSec: function () {
    var s = this.section(this.sec);
    if (!s) return;
    var all = s.questions || [];
    /* 答案缺失的题不计分、不进错题本（数据里目前没有，防御性处理） */
    var qs = all.filter(function (q) { return String(q.answer || '').trim(); });
    var answered = this.answeredIn(s);
    if (!answered) { UI.toast('先作答再交卷'); return; }
    if (answered < qs.length && !confirm('还有 ' + (qs.length - answered) + ' 题没答，确定提交？')) return;

    var self = this, right = 0;
    qs.forEach(function (q) {
      if (self.answers[q.n] === q.answer) right++;
      else {
        Store.wrongAdd({
          id: (self.srcId || self.id) + '-' + q.n,
          setId: (self.srcId || self.id),
          level: (self.set.meta || {}).level,
          year: (self.set.meta || {}).year,
          month: (self.set.meta || {}).month,
          set: (self.set.meta || {}).set,
          section: s.key,
          type: s.type,
          n: q.n,
          stem: q.stem || ('第 ' + q.n + ' 题'),
          passage: self.contextOf(s, q),
          options: q.options || null,
          answer: q.answer,
          mine: self.answers[q.n] || '',
          ts: Date.now(),
          redoOk: false
        });
      }
    });
    if (!this.drill) Store.saveSection(this.id, s.key, qs.length, right);
    this.renderResult(s, right, qs.length);
  },

  renderResult: function (s, right, total) {
    var self = this;
    var score = Store.scoreOf(s.type, right);
    var full = Store.scoreOf(s.type, total);
    var el = document.getElementById('scr-result');
    var html = UI.topbar('本节结果', s.name || ('Section ' + s.key),
      '<button class="iconbtn" onclick="Exam.back()">‹</button>');

    html += '<div class="wrap">';
    html += '<div class="score-hero"><div class="big">' + score.toFixed(1) + '<small> / ' + full.toFixed(1) + ' 分</small></div>' +
      '<div class="line"><span>答对 ' + right + ' / ' + total + ' 题</span><span>正确率 ' + (total ? Math.round(right / total * 100) : 0) + '%</span></div></div>';

    html += '<div class="card"><div class="card-title">逐题回顾<span class="tag ' + (right === total ? 'ok' : 'gold') + '">' + (right === total ? '全对' : '错 ' + (total - right) + ' 题') + '</span></div>';
    (s.questions || []).forEach(function (q) {
      var mine = self.answers[q.n] || '';
      var noAns = !String(q.answer || '').trim();
      var ok = !noAns && mine === q.answer;
      var srcHtml = self.sourceHtml(s, q);
      var srcQuote = self.sourceQuote(s, q);
      var expText = self.cleanExp(q.explanation);
      var tags = '';
      if (noAns) tags += '<span class="tag">答案缺失</span>';
      if (q.check === 'conflict') tags += '<span class="tag gold">答案待核对</span>';
      if (q.expIssue === 'mismatch') tags += '<span class="tag">解析待校对</span>';
      tags += '<span class="tag ' + (noAns ? '' : (ok ? 'ok' : 'err')) + '">' + (noAns ? '不计分' : (ok ? '正确' : '错误')) + '</span>';
      html += '<div class="review-item ' + (noAns ? '' : (ok ? 'ok' : 'no')) + '">' +
        '<div class="row between"><b>第 ' + q.n + ' 题</b><span class="row" style="gap:4px">' + tags + '</span></div>' +
        (q.stem ? '<div class="q-stem" style="margin:6px 0">' + self.wrapWords(q.stem) + '</div>' : '') +
        '<div class="hint">你选：' + (mine || '未答') + ' · 正确答案：<b style="color:var(--ok)">' + esc(q.answer || '缺失') + '</b></div>' +
        (q.check === 'conflict' ? '<div class="hint" style="color:var(--gold)">本题解析里写的答案与题库不一致，已标记待核对；以题库答案判分。</div>' : '') +
        (q.expIssue === 'mismatch' ? '<div class="hint">原解析与本题不匹配，已移除，可点「AI 讲解」。</div>' : '') +
        (expText
          ? '<details class="exp"><summary>查看解析' + (q.auto ? '<span class="tag" style="margin-left:6px">自动定位</span>' : '') +
            (self.expDirty(q.explanation) ? '<span class="tag gold" style="margin-left:6px">OCR 原文</span>' : '') +
            '</summary><div class="hint" style="white-space:pre-line">' + esc(expText) + '</div>' + srcQuote +
            '<div class="exp-note">解析仅供参考，与官方答案冲突时以答案为准；如仍有疑问可点「AI 讲解」。</div></details>'
          : (q.expIssue === 'mismatch' ? '' : '<div class="hint" style="margin-top:6px">本题暂无文字解析 · 可点下方「AI 讲解」，或回到原文定位答案</div>')) +
        (srcHtml ? '<details class="exp src"><summary>回看原文' +
          (s.type === 'paragraph_matching' ? '（答案段已标出）' : '（对应段落已标出）') +
          '</summary><div class="src-box">' + srcHtml + '</div></details>' : '') +
        '<button class="btn small ghost" style="margin-top:8px" onclick="Exam.explain(' + q.n + ')">AI 讲解</button>' +
        '<div id="ai-' + q.n + '"></div>' +
        '</div>';
    });
    html += '</div>';

    if (this.drill) {
      html += '<div class="card tight"><div class="row between">' +
        '<button class="btn small" onclick="Drill.again()">再来一组 ↻</button>' +
        '<button class="btn small dark" onclick="UI.show(\'scr-drill\');Drill.render()">返回专项</button>' +
        '</div></div>';
    } else {
      var keys = this.orderedSections().map(function (x) { return x.key; });
      var idx = keys.indexOf(s.key);
      html += '<div class="card tight"><div class="row between">' +
        '<div class="muted">已提交 ' + Object.keys(Store.progress(this.id) || {}).filter(function (k) { return ['A', 'B', 'C1', 'C2'].indexOf(k) >= 0; }).length + ' / ' + keys.length + ' 节</div>' +
        (idx >= 0 && idx < keys.length - 1
          ? '<button class="btn small" onclick="Exam.nextSec(\'' + keys[idx + 1] + '\')">下一节 ›</button>'
          : '<button class="btn small dark" onclick="Exam.overall()">查看总成绩</button>') +
        '</div></div>';
    }
    html += '<div style="height:16px"></div></div>';
    el.innerHTML = html;
    UI.show('scr-result');
  },

  back: function () { this.render(); UI.show('scr-exam'); },
  nextSec: function (key) { this.sec = key; this.render(); UI.show('scr-exam'); },

  /* ---------- AI 逐题讲解 ---------- */
  /* 错题本里要能看到原文：仔细阅读取定位段，段落匹配取答案段，选词填空取所在句 */
  contextOf: function (s, q) {
    if (!s) return '';
    if (s.type === 'paragraph_matching') {
      var p = (s.paragraphs || []).filter(function (x) { return x.label === q.answer; })[0];
      return p ? (p.label + '. ' + p.text) : '';
    }
    if (s.type === 'banked_cloze') {
      var mark = '[[' + q.n + ']]';
      var hit = '';
      (String(s.passage || '').split('\n') || []).forEach(function (t) {
        if (!hit && t.indexOf(mark) !== -1) hit = t;
      });
      if (!hit) return '';
      var sent = String(hit).split(/(?<=[.!?])\s+/).filter(function (x) { return x.indexOf(mark) !== -1; })[0] || hit;
      return sent.replace(/\[\[\s*\d+\s*\]\]/g, '____').replace(/\s+/g, ' ').trim();
    }
    return this.focusPassage(s, q);
  },

  /* 只取与本题最相关的 1~2 段，给 AI 讲解省 token */
  focusPassage: function (s, q) {
    var qk = this.kwMap((q.stem || '') + ' ' + ((q.options || {})[q.answer] || ''));
    var ek = this.kwMap(q.explanation || '');
    if (s.type === 'paragraph_matching') {
      var p = (s.paragraphs || []).filter(function (x) { return x.label === q.answer; })[0];
      return p ? (p.label + '. ' + p.text) : '';
    }
    var paras = String(s.passage || '').split('\n').filter(function (x) { return x.trim(); });
    if (!paras.length) return '';
    var qs = s.questions || [];
    var i = this.bestPara(paras, qk, ek, this.properWords(q.stem), qs.indexOf(q), qs.length);
    if (i < 0) return paras.slice(0, 3).join('\n');
    return paras.slice(Math.max(0, i - 1), Math.min(paras.length, i + 2)).join('\n');
  },

  explain: function (n) {
    var self = this;
    var box = document.getElementById('ai-' + n);
    if (!box) return;
    if (!AI.ready()) { box.innerHTML = '<div class="ai-explain">先在「我的 → AI 配置」里设置接口，才能用 AI 讲解。</div>'; return; }
    if (box.getAttribute('data-done')) return;

    var s = this.section(this.sec), q = null;
    (s.questions || []).forEach(function (x) { if (x.n === n) q = x; });
    if (!q) return;
    var passage = s.passage || (s.paragraphs || []).map(function (p) { return p.label + '. ' + p.text; }).join('\n');
    box.innerHTML = '<div class="ai-explain">AI 正在讲解第 ' + n + ' 题…</div>';

    AI.json(AI.explainPrompt({
      n: q.n, stem: q.stem || '', options: q.options || null,
      answer: q.answer, type: s.type, typeName: s.name
    }, passage, this.answers[n], self.focusPassage(s, q))).then(function (r) {
      box.setAttribute('data-done', '1');
      var html = '<div class="ai-explain"><b>为什么选 ' + esc(r.answer || q.answer) + '</b><br>' + esc(r.why || '') +
        (r.others ? '<br><br><b>其余选项</b><br>' + esc(r.others) : '') +
        (r.key_phrase ? '<br><br><b>定位句</b><br><i>' + esc(r.key_phrase) + '</i>' : '');
      (r.vocab || []).forEach(function (v) {
        html += '<div class="row between" style="margin-top:8px"><span><b>' + esc(v.w) + '</b> ' + esc(v.t) + '</span>' +
          '<button class="btn small ghost" onclick="Exam.addWord(\'' + esc(v.w).replace(/'/g, '\\\'') + '\',\'' + esc(v.t).replace(/'/g, '\\\'') + '\')">收藏</button></div>';
      });
      html += '</div>';
      box.innerHTML = html;
    }).catch(function (e) {
      box.innerHTML = '<div class="ai-explain">讲解失败：' + esc(e.message) + '</div>';
    });
  },

  addWord: function (w, t) {
    Store.wordAdd(w, t, this.id || '');
    UI.toast('已加入生词本：' + w);
  },

  /* ---------- 总成绩 ---------- */
  overall: function () {
    var self = this;
    var p = Store.progress(this.id) || {};
    var el = document.getElementById('scr-result');
    var total = 0, right = 0, fullScore = 0, gotScore = 0;
    this.sections().forEach(function (s) {
      var rec = p[s.key];
      var n = (s.questions || []).length;
      fullScore += Store.scoreOf(s.type, n);
      if (rec && rec.done) {
        total += n; right += rec.right;
        gotScore += Store.scoreOf(s.type, rec.right);
      }
    });
    var html = UI.topbar('总成绩', Bank.labelOf({ level: this.set.meta.level, mock: this.set.meta.mock, year: this.set.meta.year, month: this.set.meta.month, set: this.set.meta.set }),
      '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>');
    html += '<div class="wrap"><div class="score-hero"><div class="big">' + gotScore.toFixed(1) + '<small> / ' + fullScore.toFixed(1) + ' 分</small></div>' +
      '<div class="line"><span>已做 ' + total + ' 题 · 答对 ' + right + '</span><span>正确率 ' + (total ? Math.round(right / total * 100) : 0) + '%</span></div></div>';
    (this.set.reading || []).forEach(function (s) {
      var rec = p[s.key];
      var full = Store.scoreOf(s.type, (s.questions || []).length);
      html += '<div class="card tight"><div class="row between"><b>' + esc(s.name || ('Section ' + s.key)) + '</b>' +
        '<span class="tag ' + (rec && rec.done ? 'ok' : '') + '">' + (rec && rec.done ? Store.scoreOf(s.type, rec.right).toFixed(1) + ' / ' + full.toFixed(1) : '未做') + '</span></div></div>';
    });
    html += '<div style="margin-top:12px"><button class="btn block ghost" onclick="Essay.fromSet(\'' + this.id + '\')">写这套的作文</button></div>';
    html += '<div style="margin-top:10px"><button class="btn block ghost" onclick="Trans.fromSet(\'' + this.id + '\')">练这套的翻译</button></div>';
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
    UI.show('scr-result');
  },

  /* 错题重做入口 */
  redo: function (wid) {
    var w = Store.wrongAll()[wid];
    if (!w) return;
    UI.sheet('<h3>错题重做</h3>' +
      (w.passage ? '<details class="exp" open><summary>原文</summary><div class="passage" style="font-size:13.5px">' +
        esc(w.passage) + '</div></details>' : '') +
      '<div class="q-stem" style="margin-top:10px">' + esc(w.stem) + '</div>' +
      (w.options ? ['A', 'B', 'C', 'D'].map(function (k) {
        return w.options[k] ? '<div class="opt" onclick="Exam.redoPick(\'' + wid + '\',\'' + k + '\')"><span class="k">' + k + '</span><span class="t">' + esc(w.options[k]) + '</span></div>' : '';
      }).join('') : '<div class="hint">段落匹配题：正确段落为 ' + esc(w.answer) + '</div>') +
      '<div id="redo-msg"></div>');
  },
  redoPick: function (wid, k) {
    var w = Store.wrongAll()[wid];
    var ok = w && w.answer === k;
    var msg = document.getElementById('redo-msg');
    if (msg) msg.innerHTML = '<div class="ai-explain" style="margin-top:10px">' + (ok ? '答对了，这题已从错题本移除。' : '还是不对，正确答案是 <b>' + esc(w.answer) + '</b>。') + '</div>';
    if (ok) { Store.wrongRemove(wid); UI.toast('已移出错题本'); }
  }
};
