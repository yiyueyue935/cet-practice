/* 过级 · 界面路由与公共组件 */
var UI = {
  screen: null,
  tab: 'practice',
  gradeTab: 'essay',      // grade tab 内：essay | trans
  wordsTab: 'word',       // words tab 内：word | wrong
  level: 'cet4',

  init: function () {
    var self = this;
    var st = Store.settings();
    var forced = (typeof window.APP_LEVEL === 'string') ? window.APP_LEVEL : '';
    if (forced) { st.level = forced; st.levelChosen = true; Store.saveSettings(st); }
    self.level = st.level || 'cet4';
    Bank.loadIndex()
      .then(function () {
        document.getElementById('loading').classList.add('hide');
        self.go('practice');
        /* 首次进入不再弹选级：默认四级，需要六级在「我的 → 考试级别」切换 */
      })
      .catch(function (e) {
        document.getElementById('loadingText').textContent = '题库读取失败：' + e.message;
      });
  },

  /* ---------- 路由 ---------- */
  show: function (id) {
    var els = document.querySelectorAll('.screen');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('on');
    var el = document.getElementById(id);
    if (el) {
      el.classList.add('on');
      el.scrollTop = 0;
    }
    this.screen = id;
  },

  tabGo: function (tab) {
    this.tab = tab;
    var tb = document.getElementById('tabbar');
    if (tb) tb.style.display = 'flex';            // 选级弹层会临时隐藏，切 tab 时恢复
    var tabs = document.querySelectorAll('#tabbar .tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === tab);
    if (tab === 'practice') { this.show('scr-practice'); Practice.render(); }
    else if (tab === 'grade') {
      if (this.gradeTab === 'trans') { this.show('scr-trans'); Trans.render(); }
      else { this.show('scr-essay'); Essay.render(); }
    }
    else if (tab === 'words') { this.show('scr-words'); Words.render(); }
    else { this.show('scr-me'); Me.render(); }
  },

  go: function (tab) { this.tabGo(tab); },
  backToPractice: function () { this.tabGo('practice'); },

  /* ---------- 公共组件 ---------- */
  topbar: function (title, sub, leftHtml, rightHtml) {
    return '<div class="topbar">' + (leftHtml || '') +
      '<div style="flex:1;min-width:0"><h1>' + esc(title) + '</h1>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + '</div>' +
      (rightHtml || '') + '</div>';
  },

  hideToast: function () {
    var el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(el._t);
    el.classList.remove('on');
  },
  toast: function (msg, ms) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('on'); }, ms || 1800);
  },

  sheet: function (html) {
    var ov = document.getElementById('overlay');
    ov.innerHTML = '<div class="sheet">' + html + '</div>';
    ov.classList.add('on');
    ov.onclick = function (e) { if (e.target === ov) UI.closeSheet(); };
  },
  closeSheet: function () {
    var ov = document.getElementById('overlay');
    ov.classList.remove('on', 'center');
    ov.innerHTML = '';
  },

  levelSwitch: function () {
    return '<div class="chips">' +
      '<button class="chip ' + (UI.level === 'cet4' ? 'on' : '') + '" onclick="UI.setLevel(\'cet4\')">四级</button>' +
      '<button class="chip ' + (UI.level === 'cet6' ? 'on' : '') + '" onclick="UI.setLevel(\'cet6\')">六级</button>' +
      '</div>';
  },

  /* 首次进入：必须选一次四/六级；之后在「我的」里改 */
  chooseLevel: function () {
    var tb = document.getElementById('tabbar');
    if (tb) tb.style.display = 'none';            // 选级期间不显示底部导航，避免挡住按钮
    var ov = document.getElementById('overlay');
    ov.innerHTML = '<div class="sheet level-onboard">' +
      '<h2>先选你的考试</h2>' +
      '<div class="hint" style="margin:6px 0 16px">之后可以在「我的 → 考试级别」随时改</div>' +
      '<button class="level-pick" onclick="UI.pickLevel(\'cet4\')"><b>四级</b><span>CET-4</span></button>' +
      '<button class="level-pick" onclick="UI.pickLevel(\'cet6\')"><b>六级</b><span>CET-6</span></button>' +
      '</div>';
    ov.classList.add('on', 'center');
    ov.onclick = null;                              // 必须选，点背景不关闭
  },
  pickLevel: function (lv) {
    var s = Store.settings();
    s.level = lv; s.levelChosen = true;
    Store.saveSettings(s);
    this.level = lv;
    this.closeSheet();
    this.go('practice');
  },

  /* 级别切换面板（合并成一个安装包后，用这里代替首次选级弹窗） */
  levelSheet: function () {
    UI.sheet('<h3>考试级别</h3>' +
      '<div class="hint" style="margin:6px 0 12px">切换后题库、听力、作文、翻译都跟着换</div>' +
      '<button class="pick-item' + (this.level === 'cet4' ? ' on' : '') + '" onclick="UI.setLevel(\'cet4\');UI.closeSheet()">' +
      '<b>四级 CET-4</b><span class="muted">' + (this.level === 'cet4' ? '当前' : '') + '</span></button>' +
      '<button class="pick-item' + (this.level === 'cet6' ? ' on' : '') + '" onclick="UI.setLevel(\'cet6\');UI.closeSheet()">' +
      '<b>六级 CET-6</b><span class="muted">' + (this.level === 'cet6' ? '当前' : '') + '</span></button>');
  },

  setLevel: function (lv) {
    this.level = lv;
    var s = Store.settings(); s.level = lv; Store.saveSettings(s);
    if (this.screen === 'scr-practice') Practice.render();
    if (this.screen === 'scr-drill') Drill.render();
    if (this.screen === 'scr-essay') Essay.render();
    if (this.screen === 'scr-trans') Trans.render();
    if (this.screen === 'scr-listen') Listen.render();
    if (this.screen === 'scr-me') Me.render();
  }
};

/* ---------- 练习列表 ---------- */
var Practice = {
  view: 'menu',   // menu | grid | sits
  sel: null,      // 当前选中的场次 {y, m}

  render: function () {
    if (this.view === 'grid') return this.renderGrid();
    if (this.view === 'sits') return this.renderSits();
    this.renderMenu();
  },

  back: function () {
    this.view = (this.view === 'sits') ? 'grid' : 'menu';
    this.render();
  },

  showGrid: function () { this.view = 'grid'; this.render(); },
  openSitting: function (key) { this.sel = key; this.view = 'sits'; this.render(); },

  /* ---------- 主菜单 ---------- */
  renderMenu: function () {
    var el = document.getElementById('scr-practice');
    var st = Store.stats();
    var html = UI.topbar('过级', '四六级备考 · 阅读 / 听力 / 作文 / 翻译',
      '<button class="iconbtn ghost" onclick="UI.tabGo(\'me\')" title="我的">☰</button>',
      '<button class="tag gold tag-btn" onclick="UI.levelSheet()">' + (UI.level === 'cet6' ? '六级' : '四级') + ' ▾</button>');
    html += '<div class="wrap">';
    html += '<div class="card tight"><div class="row between">' +
      '<div><b>已练 ' + st.setsDone + ' 套</b><div class="muted">累计 ' + st.questions + ' 题 · 正确率 ' + Math.round(st.rate * 100) + '%</div></div>' +
      '<div class="muted" style="text-align:right">生词 ' + st.words + '<br>错题 ' + st.wrong + '</div>' +
      '</div></div>';
    html += '<div class="opt-grid">' +
      '<div class="opt-card" onclick="Practice.showGrid()">' +
        '<div class="oc-no">▤</div><b>整卷练习</b>' +
        '<div class="muted">按场次选套卷<br>阅读 + 作文 + 翻译</div></div>' +
      '<div class="opt-card" onclick="UI.show(\'scr-drill\');Drill.render()">' +
        '<div class="oc-no">✎</div><b>阅读专项</b>' +
        '<div class="muted">选词 / 匹配 / 仔细<br>按题型随机抽题</div></div>' +
      '<div class="opt-card wide" onclick="UI.show(\'scr-listen\');Listen.render()">' +
        '<div class="oc-no">🔊</div><b>听力专题</b>' +
        '<div class="muted">25 题 · 新闻 / 对话 / 短文<br>TTS 朗读模拟听音</div></div>' +
      '</div>';
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  /* ---------- 年份宫格 ---------- */
  renderGrid: function () {
    var el = document.getElementById('scr-practice');
    var groups = Bank.groups(UI.level);
    var lv = UI.level === 'cet6' ? '六级' : '四级';
    var html = UI.topbar('整卷练习', lv + ' · 选场次进入',
      '<button class="iconbtn" onclick="Practice.back()">‹</button>', '');
    html += '<div class="wrap"><div class="sit-grid">';
    groups.forEach(function (g) {
      var isMock = !!g.mock;
      var mt = isMock ? null : g.title.match(/(\d{4})年(\d{2})月/);
      var y = mt ? mt[1] : '', mo = mt ? parseInt(mt[2], 10) : 0;
      var done = g.sets.filter(function (s) { return Store.setDone(s.id); }).length;
      var allDone = done === g.sets.length && g.sets.length > 0;
      html += '<div class="sit-card" onclick="Practice.openSitting(\'' + esc(g.key) + '\')">' +
        '<div class="sit-date">' + (isMock
          ? '<b class="sit-mock">模拟</b><span>原创</span>'
          : '<b>' + y + '</b><span>' + mo + '月</span>') + '</div>' +
        '<div class="sit-meta"><b>' + g.sets.length + ' 套</b>' +
        '<div class="muted">' + (allDone ? '已完成' : '已完成 ' + done) + '</div></div>' +
        '<span class="chev">›</span></div>';
    });
    html += '</div><div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  /* ---------- 场次内套卷列表 ---------- */
  renderSits: function () {
    var el = document.getElementById('scr-practice');
    var sel = this.sel || '';
    var groups = Bank.groups(UI.level).filter(function (g) { return g.key === sel; });
    var g0 = groups[0];
    var label = g0 ? (g0.mock ? '原创模拟卷' : g0.title) : '未选择场次';
    var html = UI.topbar(label, (UI.level === 'cet6' ? '六级' : '四级') + ' · 点套卷开始',
      '<button class="iconbtn" onclick="Practice.back()">‹</button>', '');
    html += '<div class="wrap">';
    if (!groups.length) {
      html += '<div class="empty"><div class="big">▤</div>题库还没有这一级别/场次</div>';
    }
    groups.forEach(function (g) {
      g.sets.forEach(function (s) {
        var pr = Store.setRate(s.id);
        var done = Store.setDone(s.id);
        html += '<div class="paper" onclick="Exam.open(\'' + s.id + '\')">' +
          '<div class="setno">' + (s.set || '?') + '</div>' +
          '<div class="meta"><b>' + esc(Bank.labelOf(s)) + '</b>' +
          '<div class="muted">阅读 ' + (s.counts && s.counts.reading || 0) + ' 题' +
          (s.counts && s.counts.writing ? ' · 作文' : '') +
          (s.counts && s.counts.translation ? ' · 翻译' : '') + '</div>' +
          '<div class="bar"><i style="width:' + (pr ? Math.round(pr.rate * 100) : 0) + '%"></i></div>' +
          '</div>' +
          (done ? '<span class="tag ok">已完成</span>' : (pr ? '<span class="tag accent">' + Math.round(pr.rate * 100) + '%</span>' : '<span class="tag">未开始</span>')) +
          '</div>';
      });
    });
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  }
};

/* ---------- 阅读专项 ---------- */
var Drill = {
  lastType: null,

  render: function () {
    var el = document.getElementById('scr-drill');
    var lv = UI.level === 'cet6' ? '六级' : '四级';
    var html = UI.topbar('阅读专项', lv + ' · 按题型随机抽题',
      '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>',
      '<span class="tag gold">' + lv + '</span>');
    html += '<div class="wrap">';

    var items = [
      { t: 'careful_reading', name: '仔细阅读', desc: '一篇精读 5 道四选一', no: 'C' },
      { t: 'paragraph_matching', name: '段落匹配', desc: '一篇长文 10 道陈述 · 找对应段落', no: 'B' },
      { t: 'banked_cloze', name: '选词填空', desc: '一篇原文 10 个空 · 从 15 词词库选题', no: 'A' }
    ];
    items.forEach(function (it) {
      html += '<div class="paper" onclick="Drill.start(\'' + it.t + '\')">' +
        '<div class="setno">' + it.no + '</div>' +
        '<div class="meta"><b>' + it.name + '</b><div class="muted">' + it.desc + '</div></div>' +
        '<span class="tag gold">开练</span></div>';
    });

    html += '<div class="card tight"><div class="hint">从' + lv + '题库里随机抽一套的对应题型，做完自动判分；' +
      '做错的题会自动收进错题本。点上方“四级 / 六级”可切换题库。</div></div>';
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  start: function (type) {
    var self = this;
    var sets = Bank.sets(UI.level);
    if (!sets.length) { UI.toast('当前级别暂无套卷'); return; }
    var pick = sets[Math.floor(Math.random() * sets.length)];
    UI.toast('正在抽题…');
    Bank.get(pick.id).then(function (d) {
      var sec = null;
      if (type === 'banked_cloze') sec = d.reading[0];
      else if (type === 'paragraph_matching') sec = d.reading[1];
      else {
        var cs = (d.reading || []).filter(function (x) { return x.type === 'careful_reading'; });
        if (!cs.length) { UI.toast('这套没有仔细阅读，再抽一次'); return; }
        sec = cs[Math.floor(Math.random() * cs.length)];
      }
      if (!sec || !(sec.questions || []).length) { UI.toast('抽到的题不完整，再试一次'); return; }
      var names = { banked_cloze: '选词填空', paragraph_matching: '段落匹配', careful_reading: '仔细阅读' };
      var ds = JSON.parse(JSON.stringify(sec));
      ds.name = names[type];
      var setObj = {
        id: 'drill-' + type + '-' + pick.id,
        meta: { level: d.meta.level, year: d.meta.year, month: d.meta.month, set: d.meta.set, title: '阅读专项 · ' + names[type] },
        reading: [ds]
      };
      self.lastType = type;
      Exam.openDrill(setObj, type, pick.id);
    }).catch(function (e) { UI.toast(e.message, 3000); });
  },

  again: function () { if (this.lastType) this.start(this.lastType); else UI.backToPractice(); }
};
