/* 过级 · 听力专题（题目+选项 TTS 朗读，答案判分）*/
var Listen = {
  id: null, data: null, answers: null,
  sec: 0, qi: 0, picked: {}, showT: false,

  _au: null,
  _p: null,
  _missing: {},          // 录音文件缺失的套（部署时没带 audio/ 时回退 TTS）
  /* 听力题库 5.2MB，进听力页才加载（网页版按需注入，file:// 同样走这条） */
  ensure: function () {
    if (typeof CET_LISTENING !== 'undefined' && CET_LISTENING) return Promise.resolve();
    if (this._p) return this._p;
    var self = this;
    this._p = Bank.loadScript('data/exam/listening.js').then(function () { self._p = null; });
    return this._p;
  },
  audioUrl: function (id) {
    if (this._missing[id]) return null;
    return (typeof CET_AUDIO !== 'undefined' && CET_AUDIO[id]) || null;
  },
  fmt: function (s) { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); },
  auToggle: function () {
    var a = this._au; if (!a) return;
    this.stop();
    if (a.paused) a.play(); else a.pause();
    this.renderExam();
  },
  auTick: function () {
    var a = this._au; if (!a) return;
    var bar = document.getElementById('au-bar'), cur = document.getElementById('au-cur'), dur = document.getElementById('au-dur');
    if (bar && a.duration) bar.value = Math.round(a.currentTime / a.duration * 1000);
    if (cur) cur.textContent = this.fmt(a.currentTime);
    if (dur && a.duration) dur.textContent = this.fmt(a.duration);
  },
  auSeek: function (v) { var a = this._au; if (a && a.duration) a.currentTime = v / 1000 * a.duration; },
  auPause: function () { if (this._au) this._au.pause(); },

  voices: function () {
    try { return speechSynthesis.getVoices().filter(function (v) { return /^en(-|_)/i.test(v.lang); }); }
    catch (e) { return []; }
  },
  ttsOk: function () { return typeof speechSynthesis !== 'undefined' && speechSynthesis; },
  allVoices: function () {
    try { return speechSynthesis.getVoices() || []; } catch (e) { return []; }
  },
  hasVoice: function () { return this.ttsOk() && this.allVoices().length > 0; },
  ttsInfo: function () {
    var ok = !!this.ttsOk(), all = ok ? this.allVoices() : [];
    var en = all.filter(function (v) { return /^en[-_]/i.test(v.lang); });
    return { ok: ok, count: all.length, en: en.length, name: (en[0] || all[0] || {}).name || '' };
  },
  /* 自检：有引擎但没英语音色时，给安装指引 */
  ttsHelp: function () {
    var info = this.ttsInfo();
    UI.sheet('<h3>安装英语语音</h3>' +
      '<div class="hint" style="margin-top:8px;line-height:1.85">' +
      (info.en ? '当前英语音色：' + esc(info.name) + '<br><br>' : '') +
      '<b>安卓手机</b><br>1. 安装「Google 文字转语音」或讯飞语音引擎<br>' +
      '2. 设置 → 语言和输入法 → 文字转语音输出，选中它<br>' +
      '3. 引擎设置 → 安装语音数据 → English (US)<br><br>' +
      '<b>Windows / Edge</b><br>设置 → 时间和语言 → 语言和区域 → 添加语言 → English (United States)，勾选「语音」安装<br><br>' +
      '<b>macOS</b><br>系统设置 → 辅助功能 → 朗读内容 → 系统声音 → 管理声音，下载英文语音</div>' +
      '<button class="btn small ghost" style="margin-top:12px" onclick="UI.closeSheet();Listen.testTTS()">重新检测并试听</button>');
  },

  testTTS: function () {
    var self = this;
    var go = function () {
      var info = self.ttsInfo();
      if (!info.ok) {
        UI.toast('当前环境不支持语音合成（WebView 版本过旧）', 3000);
        return;
      }
      if (!info.count) {
        self.speak('Hello, this is a voice test. One, two, three.');
        UI.toast('没检测到音色，先用系统默认音色试读', 3000);
        return;
      }
      self.speak('Hello, this is a voice test. One, two, three.');
      if (info.en) UI.toast('正在试听：' + info.name, 3000);
      else UI.toast('没有英语音色，用「' + info.name + '」试读，发音可能不准', 3600);
    };
    /* 音色是异步加载的：先等 voiceschanged，最多 900ms，再判断 */
    if (this.ttsOk() && this.allVoices().length === 0) {
      var done = false;
      var fire = function () { if (done) return; done = true; go(); };
      try { speechSynthesis.addEventListener('voiceschanged', fire); } catch (e) {}
      setTimeout(fire, 900);
    } else {
      go();
    }
  },

  /* 选英语音色：移动端 getVoices 异步加载，缓存并在 voiceschanged 后失效重选 */
  pickVoice: function () {
    var synth = window.speechSynthesis;
    if (!synth) return null;
    if (this._enVoice !== undefined) return this._enVoice;
    var vs = [];
    try { vs = synth.getVoices() || []; } catch (e) {}
    this._enVoice = vs.filter(function (v) { return /^en[-_]/i.test(v.lang); })[0] || vs[0] || null;
    if (!this._voiceHooked) {
      this._voiceHooked = true;
      var self = this;
      var reset = function () { self._enVoice = undefined; };
      try {
        if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', reset);
        else if ('onvoiceschanged' in synth) synth.onvoiceschanged = reset;
      } catch (e) {}
    }
    return this._enVoice;
  },

  /* 关键点（沿用词镜那版的修复）：
     ① speak 必须在用户手势里同步调用，不能包 setTimeout，否则 iOS/Chrome 静音
     ② utterance 全局持有，避免安卓 Chrome 回收导致朗读中断
     ③ iOS 首次先播一条 volume=0 的静音语句“解锁”
     ④ cancel 后若处于 paused 要 resume */
  speak: function (text, onend) {
    var self = this;
    var synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      UI.toast('当前浏览器不支持语音合成');
      return;
    }
    var clean = String(text == null ? '' : text).replace(/^["'\s]+|["'\s]+$/g, '');
    if (!clean) return;

    /* 没在播就别 cancel：安卓部分引擎 cancel 后紧接着 speak 会把新语句一起吞掉 */
    var busy = false;
    try { busy = !!(synth.speaking || synth.pending); } catch (e) {}
    if (busy) { try { synth.cancel(); } catch (e) {} }
    try { if (synth.paused) synth.resume(); } catch (e) {}

    if (!this._unlocked) {
      this._unlocked = true;
      try {
        var w = new SpeechSynthesisUtterance(' ');
        w.volume = 0; w.lang = 'en-US';
        var v0 = this.pickVoice();
        if (v0) w.voice = v0;
        this._utt0 = w;
        synth.speak(w);                 /* 同一次手势内“解锁”（iOS） */
      } catch (e) {}
    }

    var attempt = 0;
    var finished = false;
    var done = function () {
      if (finished) return;
      finished = true;
      if (onend) onend();
    };
    var launch = function () {
      attempt++;
      var u = new SpeechSynthesisUtterance(clean);
      u.lang = 'en-US'; u.rate = 0.92;
      var v = self.pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      var started = false;
      u.onstart = function () { started = true; };
      u.onend = done;
      u.onerror = function (e) {
        var code = e && e.error;
        if (!code || code === 'interrupted' || code === 'canceled') return;
        UI.toast('朗读失败：' + code, 2600);
      };
      self._utt = u;                    /* 防 GC */
      try { synth.speak(u); } catch (e) {}

      /* 看门狗：安卓 WebView 偶尔第一条不响，1 秒没开始就重发一次 */
      clearTimeout(self._wd);
      self._wd = setTimeout(function () {
        if (started) return;
        if (attempt >= 2) {
          UI.toast('系统语音没响应：去「我的 → 语音朗读」检测一下引擎', 3600);
          done();
          return;
        }
        try { synth.cancel(); } catch (e) {}
        setTimeout(launch, 80);
      }, 900);
    };
    launch();
  },

  /* 按钮版朗读：给出「朗读中…」反馈，避免「点了没反应」的错觉 */
  speakBtn: function (btn) {
    if (!btn) return;
    var text = btn.getAttribute('data-tts') || '';
    if (!text) { UI.toast('没有可朗读的内容'); return; }
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    var restore = function () { btn.textContent = old; clearTimeout(btn._t); };
    btn.textContent = '🔊 朗读中…（再点停止）';
    clearTimeout(btn._t);
    btn._t = setTimeout(restore, 45000);
    if (this._speakingBtn && this._speakingBtn !== btn) {
      var prev = this._speakingBtn;
      prev.textContent = prev.getAttribute('data-label') || prev.textContent;
      clearTimeout(prev._t);
    }
    this._speakingBtn = btn;
    this.speak(text, restore);
  },

  stop: function () {
    clearTimeout(this._wd);
    this._utt = null;
    if (this._speakingBtn) {
      this._speakingBtn.textContent = this._speakingBtn.getAttribute('data-label') || this._speakingBtn.textContent;
      clearTimeout(this._speakingBtn._t);
      this._speakingBtn = null;
    }
    if (this.ttsOk()) speechSynthesis.cancel();
  },

  render: function () {
    var el = document.getElementById('scr-listen');
    if (typeof CET_LISTENING === 'undefined' || !CET_LISTENING) {
      el.innerHTML = UI.topbar('听力专题', '正在加载题库',
        '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>', '') +
        '<div class="wrap"><div class="empty">正在加载听力题库…</div></div>';
      var self0 = this;
      this.ensure().then(function () { self0.render(); }).catch(function (e) {
        el.innerHTML = UI.topbar('听力专题', '加载失败',
          '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>', '') +
          '<div class="wrap"><div class="empty">听力题库加载失败：' + esc(e.message) + '</div></div>';
      });
      return;
    }
    var lv = UI.level === 'cet6' ? '六级' : '四级';
    var html = UI.topbar('听力专题', lv + '听力 · TTS 朗读',
      '<button class="iconbtn" onclick="UI.backToPractice()">‹</button>',
      '<span class="tag gold">' + lv + '</span><span class="tag" style="margin-left:4px">TTS</span>');
    html += '<div class="wrap">';
    /* 同一场次三套卷里，重复的听力卷（第三套 / 部分第二套）只保留第一套 */
    var all = Object.keys(CET_LISTENING).filter(function (id) {
      return CET_LISTENING[id].level === UI.level;
    }).sort();
    var seenSig = {}, uniq = [];
    all.forEach(function (id) {
      var sig = JSON.stringify(CET_LISTENING[id].sections || []);
      if (seenSig[sig]) return;
      seenSig[sig] = 1; uniq.push(id);
    });
    var hidden = all.length - uniq.length;
    var ids = uniq.slice().reverse();
    var nAudio = ids.filter(function (id) { return !!Listen.audioUrl(id); }).length;
    var nTts = ids.length - nAudio;
    if (!ids.length) { html += '<div class="empty">当前级别暂无听力数据</div>'; }
    ids.forEach(function (id) {
      var d = CET_LISTENING[id];
      var a = CET_LISTEN_ANSWERS[id] || {};
      var nAns = Object.keys(a).length;
      var hasTra = !!(d.transcripts && Object.keys(d.transcripts).length);
      var hasAu = !!Listen.audioUrl(id);
      var label = d.mock ? ('原创模拟 第' + d.set + '套')
        : (d.year + '年' + (d.month < 10 ? '0' + d.month : d.month) + '月 第' + d.set + '套');
      var sub = '25 题 · 新闻/长对话/短文' + (hasAu ? ' · 内置录音' : ' · TTS 朗读') + (hasTra ? ' · 有原文' : '');
      html += '<div class="paper" onclick="Listen.open(\'' + id + '\')">' +
        '<div class="setno">' + (hasAu ? '🎧' : '听') + '</div>' +
        '<div class="meta"><b>' + label + '</b><div class="muted">' + sub + '</div></div>' +
        (nAns === 25 ? '<span class="tag ok">可判分</span>'
          : (nAns ? '<span class="tag">' + nAns + '/25 答案</span>' : '<span class="tag">仅听题</span>')) +
        '</div>';
    });
    html += '<div class="card tight"><div class="hint">' +
      '<b>说明</b>：' + ids.length + ' 套里 <b>' + nAudio + ' 套</b>带内置录音（🎧 标记，整卷播放），' +
      '<b>' + nTts + ' 套</b>只有题目、用系统 TTS 朗读。' +
      '<br>本仓库不分发录音，默认用系统 TTS 朗读题干与选项；做错的题会自动进错题本。' +
      (hidden ? '<br>同场次重复的 ' + hidden + ' 套听力已隐藏。' : '') + '</div></div>';
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  flat: function () {
    var out = [];
    (this.data.sections || []).forEach(function (s) {
      (s.questions || []).forEach(function (q) { out.push({ sec: s.name, q: q }); });
    });
    return out;
  },

  open: function (id) {
    this.id = id;
    this.data = CET_LISTENING[id];
    this.answers = CET_LISTEN_ANSWERS[id] || null;
    this.picked = {};
    this.sec = 0; this.qi = 0;
    var url = this.audioUrl(id);                    // 预建 Audio，尽早拿到时长
    if (url && (!this._au || this._au.src.indexOf(url) < 0)) {
      var self = this;
      this._au = new Audio();
      this._au.preload = 'metadata';
      this._au.src = url;
      this._au.addEventListener('timeupdate', function () { Listen.auTick(); });
      this._au.addEventListener('loadedmetadata', function () { Listen.auTick(); });
      this._au.addEventListener('ended', function () { Listen.renderExam(); });
      this._au.addEventListener('error', function () {
        Listen._missing[id] = true; Listen._au = null;
        UI.toast('录音文件缺失，已改用 TTS 朗读');
        Listen.renderExam();
      });
    }
    this.renderExam();
    UI.show('scr-listen-exam');
  },

  secNames: function () {
    var seen = [], names = [];
    (this.data.sections || []).forEach(function (s) { if (seen.indexOf(s.name) < 0) { seen.push(s.name); names.push(s.name); } });
    return names;
  },

  renderExam: function () {
    var self = this;
    var el = document.getElementById('scr-listen-exam');
    var d = this.data;
    var flat = this.flat();
    if (this.qi >= flat.length) this.qi = flat.length - 1;
    var cur = flat[this.qi];
    var q = cur.q;
    var title = (d.level === 'cet6' ? '六级' : '四级') + ' ' + d.year + '年' + (d.month < 10 ? '0' + d.month : d.month) + '月 第' + d.set + '套';

    var html = UI.topbar('听力专题', title + ' · ' + (cur.sec || '') + (q.group ? ' · ' + q.group : '') + '',
      '<button class="iconbtn" onclick="Listen.back()">‹</button>', '');

    html += '<div class="wrap">';
    html += '<div class="card tight"><div class="row between">' +
      '<b>第 ' + q.n + ' 题</b><span class="muted">' + (this.qi + 1) + ' / ' + flat.length + '</span></div></div>';

    var ttsText = 'Question ' + q.n + '. ' + Object.keys(q.options).sort().map(function (k) {
      return k + '. ' + q.options[k];
    }).join(' ');
    var ttsAttr = esc(String(ttsText || '').replace(/\s+/g, ' '));
    var ttsBtn = '<button class="btn block ghost" style="margin-top:8px" data-tts="' + ttsAttr + '" onclick="Listen.speakBtn(this)">🔁 只读本题（TTS）</button>';
    if (this.audioUrl(this.id)) {
      var a = this._au, playing = a && !a.paused;
      html += '<div class="card" style="text-align:center;padding:14px 12px">' +
        '<div class="hint" style="margin-bottom:6px">🎧 内置录音 · 完整一套，按真实考试节奏播放</div>' +
        '<div class="row between muted" style="font-size:12px"><span id="au-cur">' + this.fmt(a && a.currentTime) + '</span>' +
        '<span id="au-dur">' + this.fmt(a && a.duration) + '</span></div>' +
        '<input type="range" id="au-bar" min="0" max="1000" value="' + (a && a.duration ? Math.round(a.currentTime / a.duration * 1000) : 0) + '" style="width:100%" oninput="Listen.auSeek(this.value)">' +
        '<div class="row" style="gap:8px;margin-top:10px">' +
        '<button class="btn block dark" onclick="Listen.auToggle()">' + (playing ? '⏸ 暂停' : '▶ 播放录音') + '</button>' +
        '<button class="btn block ghost" onclick="Listen.auPause();Listen.auSeek(0);Listen.renderExam()">■ 重头</button>' +
        '</div>' + ttsBtn +
        (this.ttsOk() ? '' : '<div class="hint" style="margin-top:8px">当前设备无 TTS 引擎，请对照选项作答</div>') +
        '<div class="hint" style="margin-top:6px">没声音？<button class="btn link" onclick="Listen.testTTS()">检测语音引擎</button></div>' +
        '</div>';
    } else {
      var ti = this.ttsInfo();
      html += '<div class="card" style="text-align:center;padding:18px 12px">' +
        '<div class="hint" style="margin-bottom:8px">📄 本套不带录音，用系统语音朗读题干与选项</div>' +
        '<button class="btn block dark" data-tts="' + ttsAttr + '" onclick="Listen.speakBtn(this)">🔊 播放本题（TTS 朗读）</button>' +
        '<button class="btn block ghost" style="margin-top:8px" onclick="Listen.stop()">■ 停止</button>' +
        (this.ttsOk() ? '' : '<div class="hint" style="margin-top:8px">当前设备无 TTS 引擎，请对照选项作答</div>') +
        (ti.ok && !ti.en
          ? '<div class="hint" style="margin-top:8px">当前只有中文音色，英文发音会不自然。' +
            '<button class="btn link" onclick="Listen.ttsHelp()">怎么装英语语音？</button></div>'
          : '') +
        '<div class="hint" style="margin-top:6px">没声音？<button class="btn link" onclick="Listen.testTTS()">检测语音引擎</button></div>' +
        '</div>';
    }

    var tra = (this.data.transcripts || {})[q.group || ''];
    html += '<div class="row" style="gap:8px;margin-bottom:8px">' +
      (tra ? '<button class="btn block ghost" onclick="Listen.toggleT()">' + (this.showT ? '收起原文' : '📖 听后对照原文') + '</button>' : '') +
      '</div>';
    if (tra && this.showT) {
      html += '<div class="card"><div class="passage" style="font-size:13px">' + Listen.traHtml(tra) + '</div></div>';
    }
    html += '<div class="card">';
    ['A', 'B', 'C', 'D'].forEach(function (k) {
      if (!q.options[k]) return;
      html += '<div class="opt ' + (self.picked[q.n] === k ? 'on' : '') + '" onclick="Listen.pick(' + q.n + ',\'' + k + '\')">' +
        '<span class="k">' + k + '</span><span class="t">' + esc(q.options[k]) + '</span></div>';
    });
    html += '</div>';

    html += '<div class="exam-foot"><div class="row" style="gap:8px">' +
      '<button class="btn block ghost" onclick="Listen.prev()" ' + (this.qi === 0 ? 'disabled' : '') + '>‹ 上一题</button>' +
      '<button class="btn block ghost" onclick="Listen.next()" ' + (this.qi === flat.length - 1 ? 'disabled' : '') + '>下一题 ›</button>' +
      '</div>';
    if (this.answers) {
      html += '<button class="btn block dark" style="margin-top:8px" onclick="Listen.submit()">交卷判分</button>';
    } else {
      html += '<div class="muted" style="text-align:center;margin-top:8px">本场次答案整理中，暂不可判分</div>';
    }
    html += '</div>';
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  toggleT: function () { this.showT = !this.showT; this.renderExam(); },
  pick: function (n, k) { this.picked[n] = k; this.renderExam(); },
  prev: function () { if (this.qi > 0) { this.qi--; this.stop(); this.renderExam(); } },
  next: function () { var f = this.flat(); if (this.qi < f.length - 1) { this.qi++; this.stop(); this.renderExam(); } },
  back: function () { this.stop(); this.auPause(); this.render(); UI.show('scr-listen'); },

  /* 原文：数组按段落渲染，字符串按换行 */
  traHtml: function (t) {
    if (!t) return '';
    var ps = Object.prototype.toString.call(t) === '[object Array]' ? t : String(t).split('\n');
    return ps.filter(function (x) { return x && x.trim(); })
      .map(function (x) { return '<p style="margin:0 0 8px">' + esc(x) + '</p>'; }).join('');
  },

  submit: function () {
    var self = this, flat = this.flat();
    var answered = flat.filter(function (x) { return self.picked[x.q.n]; }).length;
    if (!answered) { UI.toast('先作答再交卷'); return; }
    var right = 0, known = 0;
    flat.forEach(function (x) {
      var n = x.q.n, mine = self.picked[n] || '', ans = self.answers[n];
      if (!ans) return;                     // 答案缺失的题不判分
      known++;
      if (mine === ans) { right++; return; }
      Store.wrongAdd({
        id: (self.srcId || self.id) + '-L' + n, setId: self.srcId || self.id,
        level: self.data.level, year: self.data.year, month: self.data.month, set: self.data.set,
        section: 'L', type: 'listening', n: n,
        stem: (x.q.group ? x.q.group + ' ' : '') + '听力第 ' + n + ' 题',
        options: x.q.options, answer: ans, mine: mine, ts: Date.now(), redoOk: false
      });
    });
    this.last = { right: right, answered: answered, known: known };
    this.renderResult();
    this.stop();
    this.auPause();
  },

  renderResult: function () {
    var self = this, flat = this.flat(), d = this.data;
    var exps = (typeof CET_LISTEN_EXPS !== 'undefined' && CET_LISTEN_EXPS[this.id]) || {};
    var trs = d.transcripts || {};
    var right = this.last.right, answered = this.last.answered, known = this.last.known || 25;
    var title = d.year + '年' + (d.month < 10 ? '0' + d.month : d.month) + '月 第' + d.set + '套';

    var html = UI.topbar('听力结果', title,
      '<button class="iconbtn" onclick="Listen.back()">‹</button>');
    html += '<div class="wrap">';
    html += '<div class="score-hero"><div class="big">' + right + '<small> / ' + known + ' 题</small></div>' +
      '<div class="line"><span>正确率 ' + Math.round(known ? right / known * 100 : 0) + '%</span>' +
      '<span>已答 ' + answered + (known < 25 ? ' · 答案缺 ' + (25 - known) + ' 题' : '') + '</span></div></div>';

    // 按组聚合
    var groups = [];
    flat.forEach(function (x) {
      var key = x.q.group || '其他';
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].key === key) { g = groups[i]; break; }
      if (!g) { g = { key: key, sec: x.sec, items: [] }; groups.push(g); }
      g.items.push(x);
    });

    groups.forEach(function (g) {
      var tra = trs[g.key];
      html += '<div class="card">';
      html += '<div class="row between" style="margin-bottom:6px"><b>' + esc(g.key) + '</b>' +
        '<span class="muted" style="font-size:12px">' + esc(g.sec || '') + '</span></div>';
      if (tra) {
        html += '<details class="exp"><summary>查看原文</summary>' +
          '<div class="hint" style="font-size:12.5px;line-height:1.7">' + Listen.traHtml(tra) + '</div></details>';
      }
      g.items.forEach(function (x) {
        var n = x.q.n, ans = self.answers[n] || '', mine = self.picked[n] || '';
        var ok = mine && mine === ans;
        html += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">';
        html += '<div class="row between"><b>第 ' + n + ' 题</b>' +
          '<span style="font-size:13px">' +
          (ans ? '答案 <b>' + ans + '</b>' : '<span class="muted">答案待补</span>') +
          (mine ? ' · 你选 <b style="color:' + (ok ? 'var(--ok)' : 'var(--err)') + '">' + mine + '</b>' : ' · 未答') +
          '</span></div>';
        if (exps[n]) {
          var txt = String(exps[n]);
          var conflict = txt.indexOf('【答案待核对】') === 0;
          if (conflict) txt = txt.replace('【答案待核对】', '');
          html += '<details class="exp"><summary>查看解析' +
            (conflict ? '<span class="tag gold" style="margin-left:6px">答案待核对</span>' : '') +
            '</summary><div class="hint">' + esc(txt) + '</div></details>';
        } else {
          html += '<div class="hint" style="margin-top:6px">本题暂无文字解析' +
            (tra ? ' · 可展开上方「查看原文」定位答案' : '') + '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    html += '<div class="card tight"><button class="btn block dark" onclick="Listen.back()">返回听力专题</button></div>';
    html += '<div style="height:16px"></div></div>';
    var el = document.getElementById('scr-result');
    el.innerHTML = html;
    UI.show('scr-result');
  }
};
