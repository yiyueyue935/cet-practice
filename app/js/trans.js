/* 过级 · 翻译练习（段落翻译 + AI 对照参考译文批改） */
var Trans = {
  level: 'cet4',
  source: '',          // 中文原文
  reference: '',       // 参考译文
  curId: '',
  imgs: [],            // 待批改的译文图片           // 已选套卷 id（fromSet 是方法名，不能再当状态用）
  refBad: '',          // 参考译文不可用的原因（OCR 整页抓取等）

  render: function () {
    this.level = UI.level;
    /* 切了四/六级后，已选套卷不属于当前级别就清空，避免「选择套卷…」和原文对不上 */
    if (this.curId && this.curId.indexOf(this.level + '-') !== 0) {
      this.curId = ''; this.source = ''; this.reference = ''; this.refBad = '';
    }
    var el = document.getElementById('scr-trans');
    var sets = Bank.sets(this.level).filter(function (s) { return s.counts && s.counts.translation; });
    var history = Store.transList();

    var html = UI.topbar('批改', '翻译 · 段落 + AI 对照批改',
      '<button class="iconbtn ghost" onclick="UI.tabGo(\'practice\')">‹</button>');
    html += '<div class="chips">' +
      '<button class="chip" onclick="Essay.switchTo(\'essay\')">作文</button>' +
      '<button class="chip on" onclick="Trans.switchTo()">翻译</button>' +
      '</div>';

    html += '<div class="wrap">';
    var cur = this.curId ? sets.filter(function (x) { return x.id === Trans.curId; })[0] : null;
    html += '<div class="card"><div class="card-title">选一道翻译题</div>' +
      '<button class="pick-row" onclick="Trans.openPicker()"><span>' +
      esc(cur ? Bank.labelOf(cur) : '选择套卷…') + '</span><span class="pick-chev">›</span></button>';
    if (this.source) {
      html += '<div class="divider"></div><b style="font-size:13px">中文原文</b>' +
        '<div class="passage" style="font-size:15.5px;margin-top:6px">' + esc(this.source) + '</div>';
    }
    if (this.refBad) {
      html += '<div class="ref-bad">⚠️ ' + esc(this.refBad) +
        '。批改时会由 AI 自行给出参考译文，不影响评分。</div>';
    }
    html += '</div>';

    html += '<div class="card"><div class="card-title">你的译文</div>' +
      '<div class="essay-tools">' +
      '<button class="btn small ghost" onclick="Essay.shoot(\'trans\')">📷 拍照</button>' +
      '<button class="btn small ghost" onclick="document.getElementById(\'trans-album\').click()">🖼 相册</button>' +
      '<span class="muted">也可以直接输入</span></div>' +
      '<input type="file" id="trans-album" accept="image/*" multiple style="display:none" onchange="Trans.addFiles(this)">' +
      '<div id="trans-imgs" class="essay-imgs"></div>' +
      '<textarea class="textarea" id="trans-input" placeholder="把中文段落翻译成英文，写在这里…" style="margin-top:10px"></textarea>' +
      '<div class="row between" style="margin-top:10px;align-items:center">' +
      '<span class="muted">AI 对照参考译文找漏译/误译</span>' +
      '<span class="row" style="gap:8px">' +
      '<button class="btn small ghost" onclick="Trans.offline()">离线评分</button>' +
      '<button class="btn small dark" onclick="Trans.submit()">开始批改</button>' +
      '</span>' +
      '</div></div>';

    html += '<div id="trans-result"></div>';

    if (history.length) {
      html += '<div class="card"><div class="card-title">批改记录<span class="tag">' + history.length + '</span></div>';
      history.forEach(function (h) {
        html += '<div class="word-row" onclick="Trans.showHistory(' + h.ts + ')">' +
          '<div><div class="w">' + h.score + ' / 15 分</div><div class="m">' + esc((h.band || '').slice(0, 30)) + '</div></div>' +
          '<div class="x muted">' + fmtDate(h.ts) + '</div></div>';
      });
      html += '</div>';
    }
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
    this.renderImgs();
  },

  /* ---------- 图片 ---------- */
  addFiles: function (input) {
    var self = this;
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    UI.toast('正在处理图片…');
    Promise.all(files.map(function (f) { return Essay.compress(f); })).then(function (list) {
      var ok = list.filter(Boolean);
      self.imgs = (self.imgs || []).concat(ok).slice(0, 6);
      self.renderImgs();
      UI.hideToast();
      if (ok.length < files.length) UI.toast('有图片读不出来，换 JPG 试试', 2400);
    });
  },
  renderImgs: function () {
    var box = document.getElementById('trans-imgs');
    if (!box) return;
    if (!this.imgs || !this.imgs.length) { box.innerHTML = ''; return; }
    box.innerHTML = this.imgs.map(function (src, i) {
      return '<div class="essay-thumb"><img src="' + src + '" alt="译文照片">' +
        '<button onclick="Trans.removeImg(' + i + ')" title="移除">×</button></div>';
    }).join('');
  },
  removeImg: function (i) { this.imgs.splice(i, 1); this.renderImgs(); },

  switchTo: function () { UI.gradeTab = 'trans'; UI.tabGo('grade'); },

  openPicker: function () {
    var sets = Bank.sets(this.level).filter(function (s) { return s.counts && s.counts.translation; });
    var html = '<h3>选一道翻译题</h3>' +
      '<input class="input" id="pick-search" placeholder="搜年份、月份或第几套" oninput="Trans.filterPicker(this.value)" style="margin:10px 0 4px">' +
      '<div class="pick-list" id="pick-list">' +
      '<button class="pick-item' + (!this.curId ? ' on' : '') + '" data-k="清空 自定义" onclick="Trans.pick(\'\')">' +
      '<b>不选题目</b><span class="muted">清空当前原文</span></button>';
    sets.forEach(function (s) {
      var label = Bank.labelOf(s);
      var key = (label + ' ' + s.id).toLowerCase();
      html += '<button class="pick-item' + (Trans.curId === s.id ? ' on' : '') + '" data-k="' + esc(key) + '" onclick="Trans.pick(\'' + s.id + '\')">' +
        '<b>' + esc(label) + '</b></button>';
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

  pick: function (id) {
    var self = this;
    UI.closeSheet();
    if (!id) { this.source = ''; this.reference = ''; this.curId = ''; this.refBad = ''; this.render(); return; }
    Bank.get(id).then(function (d) {
      self.curId = id;
      self.source = Trans.cleanCn((d.translation && d.translation.source_cn) || '');
      var raw = (d.translation && d.translation.reference_en) || '';
      /* 题库里带 reference_en_ok 标记（scripts/fix_reference.js 生成），优先信标记；
         老数据没有标记时再走启发式质量判定 */
      var q = (d.translation && d.translation.reference_en_ok === false)
        ? { ok: false, reason: '本套暂无可靠参考译文' }
        : Trans.refQuality(raw);
      self.refBad = q.ok ? '' : q.reason;
      self.reference = q.ok ? raw : '';
      self.render();
    }).catch(function (e) { UI.toast(e.message); });
  },

  /* 参考译文质量：段落译文一般 600~2500 字符。
     题库里有 80 套是 OCR 整页抓取（最长 16 万字符，混进作文/听力原文），
     直接塞进 prompt 既烧 token 又带偏评分，这里判为不可用。 */
  /* 题库里 128 套的 source_cn 前面都带着英文题目说明（"Translation (30 minutes) Directions: …"），
     统一从第一个汉字处截断 */
  cleanCn: function (t) {
    var s = String(t || '');
    var m = /[\u4e00-\u9fa5]/.exec(s);
    if (m && m.index > 0) s = s.slice(m.index);
    return s.replace(/^\s+/, '');
  },

  refQuality: function (ref) {
    var t = String(ref || '').trim();
    if (!t) return { ok: false, reason: '本套暂无参考译文' };
    if (t.length > 3000) return { ok: false, reason: '参考译文为 OCR 整页抓取（' + t.length + ' 字符），已忽略' };
    var ws = t.match(/[A-Za-z]+/g) || [];
    if (ws.length > 30) {
      var hit = 0;
      for (var i = 0; i < ws.length; i++) {
        if (typeof Exam !== 'undefined' && Exam.dictLookup && Exam.dictLookup(ws[i])) hit++;
      }
      if (hit / ws.length < 0.75) return { ok: false, reason: '参考译文为 OCR 乱码，已忽略' };
    }
    return { ok: true, reason: '' };
  },

  fromSet: function (id) {
    UI.gradeTab = 'trans';
    UI.tabGo('grade');
    this.pick(id);
  },

  /* 离线评分：不联网，本地规则 + 参考译文对照。定位是「秒出的参考分」，不是精批。
     有参考译文时评「覆盖度 / 漏译 / 否定翻转」；无参考时只评完整性与语言，并明说。 */
  offline: function () {
    var text = (document.getElementById('trans-input').value || '').trim();
    if (text.length < 10) { UI.toast('译文太短了'); return; }
    if (!this.source) { UI.toast('先选一道翻译题'); return; }
    var box = document.getElementById('trans-result');
    if (typeof Rubric === 'undefined') {
      box.innerHTML = '<div class="card"><div class="hint">本地评分模块未加载，请刷新页面重试。</div></div>';
      return;
    }
    var r;
    try {
      r = Rubric.trans(this.source, this.reference, text, this.level);
      if (this.reference) r.reference = this.reference;   /* 有可用参考译文就一并给出 */
    } catch (e) {
      box.innerHTML = '<div class="card"><div class="hint">离线评分失败：' + esc(e.message) + '</div></div>';
      return;
    }
    Store.transAdd({ ts: Date.now(), level: this.level, setId: this.curId, source: this.source, text: text, score: r.score, band: r.band, r: r });
    this.renderResult(box, r);
  },

  submit: function () {
    var self = this;
    var text = (document.getElementById('trans-input').value || '').trim();
    var imgs = (this.imgs || []).slice();
    if (!text && !imgs.length) { UI.toast('先写译文，或拍一张照片'); return; }
    if (!imgs.length && text.length < 10) { UI.toast('译文太短了'); return; }
    if (!this.source) { UI.toast('先选一道翻译题'); return; }
    if (!AI.ready()) {
      /* 没配 AI 也给出参考分，不要直接卡死在这里 */
      this.offline();
      return;
    }
    var box = document.getElementById('trans-result');
    box.innerHTML = '<div class="card"><div class="hint">' +
      (this.reference ? 'AI 正在对照参考译文批改…' : 'AI 正在批改（本套无可用参考译文，由模型自行生成）…') + '</div></div>';

    var req = imgs.length
      ? AI.jsonImages(AI.transPrompt(this.source, this.reference, text, imgs.length), imgs, { timeoutMs: 300000 })
      : AI.json(AI.transPrompt(this.source, this.reference, text), { timeoutMs: 240000 });
    req.then(function (r) {
      var rec = { ts: Date.now(), level: self.level, setId: self.curId, source: self.source, text: text, score: r.score, band: r.band, r: r };
      Store.transAdd(rec);
      self.renderResult(box, r);
    }).catch(function (e) {
      box.innerHTML = '<div class="card"><div class="hint">批改失败：' + esc(e.message) + '</div>' +
        '<button class="btn small ghost" style="margin-top:10px" onclick="Trans.offline()">改用离线评分</button></div>';
    });
  },

  renderResult: function (box, r) {
    var score = Number(r.score) || 0;
    var html = '<div class="score-hero"><div class="big">' + score + '<small> / 15 分（约 ' + (score * 7.1).toFixed(1) + ' / 106.5）</small></div>' +
      '<div class="line"><span>' + esc(r.band || '') + '</span>' + (r.offline ? '<span class="tag">离线评分</span>' : '') + '</div></div>' +
      (r.offline ? '<div class="card tight"><div class="hint">离线评分对照参考译文找漏译、疑似误译和术语缺失，不评语义层面的准确度；要逐句润色，用「开始批改」走 AI。</div></div>' : '');

    if ((r.diffs || []).length) {
      html += '<div class="card"><div class="card-title">逐点对照</div>';
      r.diffs.forEach(function (d) {
        html += '<div class="review-item" style="border-color:var(--line)">' +
          '<span class="tag err">' + esc(d.type || '问题') + '</span>' +
          '<div class="q-stem" style="font-size:14px;margin-top:6px">' + esc(d.src || '') + '</div>' +
          (d.better ? '<div style="color:var(--ok);font-family:var(--serif);font-size:14px;margin-top:4px">→ ' + esc(d.better) + '</div>' : '') +
          (d.note ? '<div class="hint" style="margin-top:4px">' + esc(d.note) + '</div>' : '') +
          '</div>';
      });
      html += '</div>';
    }

    var refText = r.reference || '';
    if (!refText && !r.offline) refText = '';
    if (refText) {
      html += '<div class="card"><div class="card-title">参考译文</div>' +
        '<div class="passage" style="font-size:14.5px;margin-top:8px">' + esc(refText) + '</div>' +
        (r.reference_note ? '<div class="divider"></div><div class="hint">' + esc(r.reference_note) + '</div>' : '') + '</div>';
    }

    if (r.revised) {
      html += '<div class="card"><div class="card-title">润色版<span class="tag gold">保留你的意思</span></div>' +
        '<div class="passage" style="font-size:15px;margin-top:8px">' + esc(r.revised) + '</div></div>';
    }
    if (r.reference_note) {
      html += '<div class="card"><div class="card-title">参考译文里的好表达</div>' +
        '<div class="hint" style="margin-top:8px">' + esc(r.reference_note) + '</div></div>';
    }
    box.innerHTML = html;
    if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  showHistory: function (ts) {
    var hit = null;
    Store.transList().forEach(function (h) { if (h.ts === ts) hit = h; });
    if (!hit) return;
    var input = document.getElementById('trans-input');
    if (input) input.value = hit.text || '';
    this.renderResult(document.getElementById('trans-result'), hit.r);
  }
};
