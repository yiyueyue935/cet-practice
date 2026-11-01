/* 过级 · 作文批改（AI 评分 + 逐句反馈 + 范文 + 模板） */
var Essay = {
  level: 'cet4',
  prompt: '',          // 当前作文题目/要求
  promptFrom: '',      // 哪套题目
  sample: '',          // 该题的官方范文
  sampleCn: '',
  customPrompt: '',
  grading: false,
  last: null,
  imgs: [],            // 待批改的作文图片（dataURL）

  render: function () {
    this.level = UI.level;
    var el = document.getElementById('scr-essay');
    var sets = Bank.sets(this.level).filter(function (s) { return s.counts && s.counts.writing; });
    var history = Store.essays();

    var html = UI.topbar('批改', '作文 · AI 评分与逐句反馈',
      '<button class="iconbtn ghost" onclick="UI.tabGo(\'practice\')">‹</button>',
      '<button class="iconbtn ghost" onclick="Essay.openTemplate()" title="作文模板">▤</button>');

    html += '<div class="chips">' +
      '<button class="chip on" onclick="Essay.switchTo(\'essay\')">作文</button>' +
      '<button class="chip" onclick="Essay.switchTo(\'trans\')">翻译</button>' +
      '</div>';

    html += '<div class="wrap">';
    var cur = this.promptFrom ? Bank.sets(this.level).filter(function (x) { return x.id === Essay.promptFrom; })[0] : null;
    var curLabel = cur ? (Bank.labelOf(cur) + (cur.writingTitle ? ' · ' + cur.writingTitle : '')) : '自定义题目 / 直接写';
    html += '<div class="card"><div class="card-title">选一道作文题</div>' +
      '<button class="pick-row" onclick="Essay.openPicker()"><span>' + esc(curLabel) + '</span><span class="pick-chev">›</span></button>' +
      (this.sample ? '<div class="row" style="gap:10px;margin-top:10px;align-items:center;flex-wrap:wrap">' +
        '<button class="btn small ghost" onclick="Essay.showSample()">📄 看本题范文</button>' +
        '<span class="muted" style="font-size:12px">参考范文，约 ' + String(this.sample).split(/\s+/).length + ' 词</span></div>' : '');
    if (this.prompt) html += '<div class="hint" style="margin-top:10px;white-space:pre-wrap">' + esc(this.prompt) + '</div>';
    html += '</div>';

    html += '<div class="card"><div class="card-title">你的作文' +
      '<span class="tag" id="essay-count">0 词</span></div>' +
      '<div class="essay-tools">' +
      '<button class="btn small ghost" onclick="Essay.shoot()">📷 拍照</button>' +
      '<button class="btn small ghost" onclick="document.getElementById(\'essay-album\').click()">🖼 相册</button>' +
      '<span class="muted">也可以直接输入</span></div>' +
      '<input type="file" id="essay-camera" accept="image/*" capture="environment" style="display:none" onchange="Essay.addFiles(this)">' +
      '<input type="file" id="essay-album" accept="image/*" multiple style="display:none" onchange="Essay.addFiles(this)">' +
      '<div id="essay-imgs" class="essay-imgs"></div>' +
      '<textarea class="textarea" id="essay-input" placeholder="把写好的作文粘贴到这里，或直接在这里写…" oninput="Essay.count()" style="margin-top:10px"></textarea>' +
      '<div class="row between" style="margin-top:10px;align-items:center">' +
      '<span class="muted">文字或拍照都行</span>' +
      '<span class="row" style="gap:8px">' +
      '<button class="btn small ghost" onclick="Essay.offline()">离线评分</button>' +
      '<button class="btn small dark" onclick="Essay.submit()">AI 批改</button>' +
      '</span></div></div>';

    html += '<div id="essay-result"></div>';

    if (history.length) {
      html += '<div class="card"><div class="card-title">批改记录<span class="tag">' + history.length + '</span></div>';
      history.forEach(function (h) {
        html += '<div class="word-row" onclick="Essay.showHistory(' + h.ts + ')">' +
          '<div><div class="w">' + h.score + ' / 15 分</div><div class="m">' + esc((h.band || '').slice(0, 30)) + '</div></div>' +
          '<div class="x muted">' + fmtDate(h.ts) + '</div></div>';
      });
      html += '</div>';
    }
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
    this.renderImgs();
  },

  /* ---------- 拍照：优先用应用内相机，拿不到权限就退回系统相机 ---------- */
  shoot: function (target) {
    var self = this;
    this._camTarget = target || 'essay';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var el = document.getElementById('essay-camera');
      if (el) el.click();
      return;
    }
    UI.sheet('<div class="cam-wrap"><video id="cam-video" autoplay playsinline muted></video>' +
      '<div class="hint" style="margin-top:8px">对准作文纸，拍清楚一点</div></div>' +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn small ghost" onclick="Essay.closeCam()">取消</button>' +
      '<button class="btn small dark" style="flex:1" onclick="Essay.snap()">拍照</button></div>');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(function (st) {
        self._stream = st;
        var v = document.getElementById('cam-video');
        if (v) { v.srcObject = st; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      })
      .catch(function () {
        self.closeCam();
        UI.toast('拿不到相机权限，改用系统相机');
        var el = document.getElementById('essay-camera');
        if (el) el.click();
      });
  },
  snap: function () {
    var v = document.getElementById('cam-video');
    if (!v || !v.videoWidth) { UI.toast('相机还没准备好，稍等一下'); return; }
    var max = 1600, sc = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(v.videoWidth * sc));
    c.height = Math.max(1, Math.round(v.videoHeight * sc));
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    var url = c.toDataURL('image/jpeg', 0.82);
    var t = this._camTarget === 'trans' ? (window.Trans || this) : this;
    t.imgs = (t.imgs || []).concat([url]).slice(0, 6);
    this.closeCam();
    if (t.renderImgs) t.renderImgs();
    else this.renderImgs();
    UI.toast('已拍照，可以继续拍或直接批改');
  },
  closeCam: function () {
    if (this._stream) {
      this._stream.getTracks().forEach(function (t) { t.stop(); });
      this._stream = null;
    }
    UI.closeSheet();
  },

  /* ---------- 图片：拍照 / 相册 ---------- */
  addFiles: function (input) {
    var self = this;
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    UI.toast('正在处理图片…');
    Promise.all(files.map(function (f) { return self.compress(f); })).then(function (list) {
      var ok = list.filter(Boolean);
      self.imgs = (self.imgs || []).concat(ok).slice(0, 6);
      self.renderImgs();
      UI.hideToast();
      if (ok.length < files.length) UI.toast('有图片读不出来（可能是 HEIC，换 JPG 试试）', 2400);
    });
  },

  compress: function (file) {
    return new Promise(function (resolve) {
      if (!/^image\//.test(file.type || '')) return resolve(null);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        try { resolve(c.toDataURL('image/jpeg', 0.82)); } catch (e) { resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  },

  renderImgs: function () {
    var box = document.getElementById('essay-imgs');
    if (!box) return;
    if (!this.imgs || !this.imgs.length) { box.innerHTML = ''; return; }
    box.innerHTML = this.imgs.map(function (src, i) {
      return '<div class="essay-thumb"><img src="' + src + '" alt="作文照片">' +
        '<button onclick="Essay.removeImg(' + i + ')" title="移除">×</button></div>';
    }).join('');
  },

  removeImg: function (i) {
    this.imgs.splice(i, 1);
    this.renderImgs();
  },

  switchTo: function (which) {
    UI.gradeTab = which;
    UI.tabGo('grade');
  },

  pickPrompt: function (id) {
    var self = this;
    UI.closeSheet();
    if (!id) { this.prompt = ''; this.promptFrom = ''; this.render(); return; }
    Bank.get(id).then(function (d) {
      self.promptFrom = id;
      self.prompt = (d.writing && (d.writing.directions || d.writing.prompt_cn)) || '';
      self.sample = (d.writing && d.writing.sample_essay) || '';
      self.sampleCn = (d.writing && d.writing.sample_essay_cn) || '';
      self.render();
    }).catch(function (e) { UI.toast(e.message); });
  },

  showSample: function () {
    if (!this.sample) { UI.toast('这套题没有范文'); return; }
    UI.sheet('<h3>本题范文</h3>' +
      '<div class="passage" style="font-size:15px;margin-top:8px">' + esc(this.sample) + '</div>' +
      (this.sampleCn ? '<div class="divider"></div><div class="hint">' + esc(this.sampleCn) + '</div>' : '') +
      '<div class="row" style="gap:10px;margin-top:12px">' +
      '<button class="btn small ghost" onclick="Essay.copy(document.getElementById(\'smp-box\').value,\'范文\')">复制范文</button>' +
      '<button class="btn small dark" onclick="Essay.useSample()">用它对照我的作文</button></div>' +
      '<textarea id="smp-box" style="display:none">' + esc(this.sample) + '</textarea>');
  },
  useSample: function () {
    UI.closeSheet();
    var ta = document.getElementById('essay-input');
    if (ta) { ta.value = this.sample; Essay.count(); UI.toast('已填入范文，可直接点「离线评分」看分数'); }
  },

  openPicker: function () {
    var self = this;
    var sets = Bank.sets(this.level).filter(function (s) { return s.counts && s.counts.writing; });
    var html = '<h3>选一道作文题</h3>' +
      '<input class="input" id="pick-search" placeholder="搜年份、月份或作文题目" oninput="Essay.filterPicker(this.value)" style="margin:10px 0 4px">' +
      '<div class="pick-list" id="pick-list">' +
      '<button class="pick-item' + (!this.promptFrom ? ' on' : '') + '" data-k="自定义" onclick="Essay.pickPrompt(\'\')">' +
      '<b>自定义题目 / 直接写</b><span class="muted">不选题目，按自己的题目写</span></button>';
    sets.forEach(function (s) {
      var label = Bank.labelOf(s);
      var title = s.writingTitle || '';
      var key = (label + ' ' + title + ' ' + s.id).toLowerCase();
      html += '<button class="pick-item' + (self.promptFrom === s.id ? ' on' : '') + '" data-k="' + esc(key) + '" onclick="Essay.pickPrompt(\'' + s.id + '\')">' +
        '<b>' + esc(label) + '</b>' + (title ? '<span class="muted">' + esc(title) + '</span>' : '') + '</button>';
    });
    html += '</div>';
    UI.sheet(html);
  },

  filterPicker: function (q) {
    q = String(q || '').trim().toLowerCase();
    var items = document.querySelectorAll('#pick-list .pick-item');
    for (var i = 0; i < items.length; i++) {
      var k = items[i].getAttribute('data-k') || '';
      items[i].style.display = (!q || k.indexOf(q) !== -1) ? '' : 'none';
    }
  },

  fromSet: function (id) {
    UI.gradeTab = 'essay';
    UI.tabGo('grade');
    this.pickPrompt(id);
  },

  count: function () {
    var v = document.getElementById('essay-input').value || '';
    var n = (v.trim().match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
    var el = document.getElementById('essay-count');
    if (el) el.textContent = n + ' 词';
  },

  submit: function () {
    var self = this;
    var text = (document.getElementById('essay-input').value || '').trim();
    var imgs = (this.imgs || []).slice();
    if (!text && !imgs.length) { UI.toast('先写作文，或拍一张照片'); return; }
    if (!imgs.length && text.length < 30) { UI.toast('作文太短了，先多写几句'); return; }
    if (!AI.ready()) {
      document.getElementById('essay-result').innerHTML = '<div class="card"><div class="hint">还没配置 AI 接口。可以先点「离线评分」看词数、句式、衔接的参考分；要逐句精批，去「我的 → AI 配置」接入模型。</div></div>';
      return;
    }
    var box = document.getElementById('essay-result');
    box.innerHTML = '<div class="card"><div class="hint">' +
      (imgs.length ? 'AI 正在识别图片并批改，通常 20~60 秒…' : 'AI 正在批改，通常 10~40 秒…') + '</div></div>';
    this.grading = true;

    /* 本地先算一遍：词数/句数/错误数写进提示词，模型不用数数，更准也更省 token */
    var brief = '';
    try {
      if (text) {
        var g0 = OfflineGrade.grade(text, this.prompt, this.level);
        brief = g0.stats.words + ' 词 / ' + g0.stats.sentences + ' 句 / ' + g0.stats.paragraphs +
          ' 段 / 词汇丰富度 ' + Math.round(g0.stats.ttr * 100) + '% / 常见错误 ' + g0.stats.errors + ' 处';
      }
    } catch (e) {}
    var prompt = AI.essayPrompt(this.level, this.prompt, text, imgs.length, brief);
    var req = imgs.length
      ? AI.jsonImages(prompt, imgs, { timeoutMs: 300000 })
      : AI.json(prompt, { timeoutMs: 240000 });
    req.then(function (r) {
      self.grading = false;
      var recognized = String(r.text || '').trim();
      var finalText = recognized || text;
      if (recognized) {
        var ta = document.getElementById('essay-input');
        if (ta) { ta.value = recognized; Essay.count(); }
      }
      self.last = { ts: Date.now(), level: self.level, prompt: self.prompt, text: finalText, score: r.score, band: r.band, r: r };
      Store.essayAdd(self.last);
      self.renderResult(box, r, finalText);
    }).catch(function (e) {
      self.grading = false;
      box.innerHTML = '<div class="card"><div class="hint">批改失败：' + esc(e.message) + '</div>' +
        '<button class="btn small ghost" style="margin-top:10px" onclick="Essay.offline()">改用离线评分</button></div>';
    });
  },

  offline: function () {
    var text = (document.getElementById('essay-input').value || '').trim();
    if (text.length < 30) { UI.toast('先写作文，至少写几句'); return; }
    var r = OfflineGrade.grade(text, this.prompt, this.level);
    var box = document.getElementById('essay-result');
    this.last = { ts: Date.now(), level: this.level, prompt: this.prompt, text: text, score: r.score, band: r.band, r: r };
    Store.essayAdd(this.last);
    this.renderResult(box, r, text);
  },

  renderResult: function (box, r, text) {
    var score = Number(r.score) || 0;
    var html = '<div class="score-hero"><div class="big">' + score + '<small> / 15 分（约 ' + (score * 7.1).toFixed(1) + ' / 106.5）</small></div>' +
      '<div class="line"><span>' + esc(r.band || '') + '</span>' +
      (r.offline ? '<span class="tag">离线评分</span>' : '') + '</div></div>' +
      (r.offline ? '<div class="card tight"><div class="hint">离线评分基于词数、句式、衔接词和常见错误，不联网，仅供参考。</div></div>' : '') +
      (r.offline && !r.sample
        ? '<div class="card tight"><div class="row between" style="align-items:center">' +
          '<span class="hint" style="margin:0">想要参考范文和逐句润色</span>' +
          '<button class="btn small ghost" onclick="Essay.openTemplate()">看模板库</button></div>' +
          '<div class="hint" style="margin-top:6px">点「AI 批改」会给出同题高分范文（约 150 词）+ 中文译文。</div></div>'
        : '');

    if (r.text) {
      html += '<div class="card tight"><div class="card-title">识别出的作文<span class="tag">图片转文字</span></div>' +
        '<div class="hint" style="margin-top:6px;white-space:pre-wrap">' + esc(r.text) + '</div></div>';
    }

    /* 本地评分给了三维打分（0~5），先画条形，比纯文字直观 */
    if ((r.rubric || []).length) {
      html += '<div class="card"><div class="card-title">三维得分<span class="tag">满分 5</span></div>';
      r.rubric.forEach(function (d) {
        var pct = Math.max(0, Math.min(100, Math.round((d.score || 0) / (d.max || 5) * 100)));
        var tone = pct >= 75 ? 'var(--ok)' : (pct >= 50 ? 'var(--gold)' : 'var(--err)');
        html += '<div class="dim-row"><div class="row between" style="align-items:baseline">' +
          '<b style="font-size:13.5px">' + esc(d.name || d.id) + '</b>' +
          '<span class="muted" style="font-size:12px">' + (Math.round((d.score || 0) * 10) / 10) + ' / ' + (d.max || 5) + '</span>' +
          '</div>' +
          '<div class="dim-bar"><i style="width:' + pct + '%;background:' + tone + '"></i></div>' +
          (d.note ? '<div class="hint" style="margin-top:4px;font-size:12px">' + esc(d.note) + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    }

    var dim = r.dimension || {};
    html += '<div class="card"><div class="card-title">分项点评</div>';
    [['content', '内容'], ['language', '语言'], ['organization', '结构']].forEach(function (d) {
      if (!dim[d[0]]) return;
      html += '<div style="margin-top:10px"><b style="font-size:13px;color:var(--accent)">' + d[1] + '</b>' +
        '<div class="hint" style="margin-top:2px">' + esc(dim[d[0]]) + '</div></div>';
    });
    html += '</div>';

    if ((r.sentences || []).length) {
      html += '<div class="card"><div class="card-title">逐句批改</div>';
      r.sentences.forEach(function (s) {
        var tagCls = s.type === 'good' ? 'ok' : (s.type === 'bad' ? 'err' : 'gold');
        html += '<div class="review-item ' + (s.type === 'good' ? 'ok' : '') + '" style="border-color:var(--line)">' +
          '<span class="tag ' + tagCls + '">' + (s.type === 'good' ? '写得好' : (s.type === 'bad' ? '需重写' : '可优化')) + '</span>' +
          '<div class="q-stem" style="font-size:14px;margin-top:6px">' + esc(s.src) + '</div>' +
          (s.fix ? '<div style="color:var(--ok);font-family:var(--serif);font-size:14px;margin-top:4px">→ ' + esc(s.fix) + '</div>' : '') +
          (s.note ? '<div class="hint" style="margin-top:4px">' + esc(s.note) + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    }

    if ((r.upgrade || []).length) {
      html += '<div class="card"><div class="card-title">最值得先改的</div>';
      r.upgrade.forEach(function (u, i) {
        html += '<div style="margin-top:8px"><b style="color:var(--accent)">' + (i + 1) + '.</b> ' + esc(u) + '</div>';
      });
      html += '</div>';
    }

    if (r.sample) {
      html += '<div class="card"><div class="card-title">同题范文<span class="tag gold">参考</span></div>' +
        '<div class="passage" style="font-size:15px;margin-top:8px">' + esc(r.sample) + '</div>' +
        (r.sample_cn ? '<div class="divider"></div><div class="hint">' + esc(r.sample_cn) + '</div>' : '') +
        '</div>';
    }
    box.innerHTML = html;
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  showHistory: function (ts) {
    var hit = null;
    Store.essays().forEach(function (h) { if (h.ts === ts) hit = h; });
    if (!hit) return;
    var box = document.getElementById('essay-result');
    var input = document.getElementById('essay-input');
    if (input) input.value = hit.text || '';
    this.count();
    this.renderResult(box, hit.r, hit.text);
  },

  openTemplate: function () {
    var t = (window.CET_TEMPLATES || []);
    var html = '<h3>作文模板库' + (t.length ? '<span class="tag" style="margin-left:8px">' + t.length + ' 类</span>' : '') + '</h3>';
    if (!t.length) {
      html += '<div class="hint">模板库加载失败，请刷新页面。</div>';
      UI.sheet(html);
      return;
    }
    t.forEach(function (g, gi) {
      html += '<details class="tpl"' + (gi === 0 ? ' open' : '') + '><summary><b>' + esc(g.name) + '</b>' +
        (g.usage ? '<span class="tpl-usage">' + esc(g.usage) + '</span>' : '') + '</summary>';
      (g.items || []).forEach(function (it) {
        html += '<div class="tpl-item"><div class="tpl-label">' + esc(it.label || '') + '</div>' +
          '<div class="tpl-en">' + esc(it.text) + '</div>' +
          (it.cn ? '<div class="tpl-cn">' + esc(it.cn) + '</div>' : '') + '</div>';
      });
      if ((g.sentences || []).length) {
        html += '<div class="tpl-sents"><b>高分句式</b>';
        g.sentences.forEach(function (s) {
          html += '<div class="tpl-sent"><span>' + esc(s.en) + '</span><span class="muted">' + esc(s.cn) + '</span></div>';
        });
        html += '</div>';
      }
      html += '<button class="btn small ghost" style="margin-top:8px" onclick="Essay.copyTemplate(' + gi + ')">复制这一类</button></details>';
    });
    UI.sheet(html);
  },

  /* 复制：剪贴板 API → execCommand → 弹层手选，三级兜底（WebView 里前两种常被拒） */
  copy: function (text, what) {
    var done = function () { UI.toast((what || '内容') + '已复制'); };
    var manual = function () {
      UI.sheet('<h3>复制失败</h3><div class="hint" style="margin:6px 0 10px">系统不让自动复制，长按下面文字手动全选复制</div>' +
        '<textarea class="textarea" id="cp-box" style="height:200px">' + esc(text) + '</textarea>' +
        '<button class="btn small dark" style="margin-top:10px" onclick="Essay.copyAgain()">再试一次</button>');
      setTimeout(function () {
        var b = document.getElementById('cp-box');
        if (b) { b.focus(); b.select(); }
      }, 80);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { Essay.copyLegacy(text, done, manual); });
        return;
      }
    } catch (e) {}
    Essay.copyLegacy(text, done, manual);
  },
  copyLegacy: function (text, done, manual) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) { done(); return; }
    } catch (e) {}
    manual();
  },
  copyAgain: function () {
    var b = document.getElementById('cp-box');
    if (!b) return;
    b.focus(); b.select();
    Essay.copy(b.value, '模板');
  },

  copyTemplate: function (i) {
    var g = (window.CET_TEMPLATES || [])[i];
    if (!g) return;
    var lines = [g.name];
    (g.items || []).forEach(function (it) { lines.push('', '【' + (it.label || '') + '】', it.text); });
    if ((g.sentences || []).length) {
      lines.push('', '【高分句式】');
      g.sentences.forEach(function (s) { lines.push(s.en); });
    }
    var text = lines.join('\n');
    Essay.copy(text, '模板');
  }
};
