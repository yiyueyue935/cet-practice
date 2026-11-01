/* 过级 · 生词本与错题本 */
var Words = {
  tab: 'word',
  cat: '全部',        // 生词本当前分类

  render: function () {
    var el = document.getElementById('scr-words');
    var st = Store.stats();
    var html = UI.topbar('生词与错题', '只存在本机',
      '<button class="iconbtn ghost" onclick="UI.tabGo(\'practice\')">‹</button>');

    html += '<div class="chips">' +
      '<button class="chip ' + (this.tab === 'word' ? 'on' : '') + '" onclick="Words.switchTo(\'word\')">生词本 ' + st.words + '</button>' +
      '<button class="chip ' + (this.tab === 'wrong' ? 'on' : '') + '" onclick="Words.switchTo(\'wrong\')">错题本 ' + st.wrong + '</button>' +
      '</div>';

    html += '<div class="wrap">';
    html += this.tab === 'word' ? this.renderWords() : this.renderWrong();
    html += '<div style="height:20px"></div></div>';
    el.innerHTML = html;
  },

  switchTo: function (t) { this.tab = t; this.render(); },

  newSheet: function () {
    UI.sheet('<h3 style="margin-bottom:10px">新建生词</h3>' +
      '<input class="input" id="nw-word" placeholder="单词，如 alleviate" autocomplete="off" style="margin-bottom:8px">' +
      '<input class="input" id="nw-t" placeholder="释义（留空则自动查询）" autocomplete="off" style="margin-bottom:8px">' +
      '<input class="input" id="nw-cat" list="cat-list" placeholder="分类，如 高频词 / 阅读 / 听力（可留空）" autocomplete="off">' +
      '<datalist id="cat-list">' + Words.catNames().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
      '<div class="row" style="gap:8px;margin-top:12px">' +
      '<button class="btn small dark" onclick="Words.saveNew()">保存</button></div>' +
      '<div id="nw-msg"></div>');
    setTimeout(function () { var el = document.getElementById('nw-word'); if (el) el.focus(); }, 60);
  },

  saveNew: function () {
    var w = (document.getElementById('nw-word').value || '').trim();
    var t = (document.getElementById('nw-t').value || '').trim();
    var catEl = document.getElementById('nw-cat');
    var cat = catEl ? (catEl.value || '').trim() : '';
    if (!w) { UI.toast('先填单词'); return; }
    if (Store.wordHas(w)) { UI.toast('这个词已在生词本里'); return; }
    if (t) { Store.wordAdd(w, t, '手动', cat); UI.closeSheet(); Words.render(); UI.toast('已加入生词本'); return; }
    Store.wordAdd(w, '', '手动', cat); UI.closeSheet(); Words.render();
    if (!AI.ready()) { UI.toast('已收录（接 AI 后可自动补释义）'); return; }
    UI.toast('已收录，释义查询中…');
    AI.wordLookup(w).then(function (r) {
      Store.wordAdd(w, (r.pos ? r.pos + ' ' : '') + (r.meaning || ''), '手动');
      if (Words.tab === 'word') Words.render();
    }).catch(function () {});
  },

  catNames: function () {
    var out = [], all = Store.wordsAll();
    Object.keys(all).forEach(function (w) {
      var c = all[w].cat || '未分类';
      if (out.indexOf(c) === -1) out.push(c);
    });
    return out.sort();
  },
  setCat: function (c) { this.cat = c; this.render(); },
  newCat: function () {
    UI.sheet('<h3>新建分类</h3><div class="hint" style="margin:6px 0 10px">建好后可以把词条移到这个分类</div>' +
      '<input class="input" id="nc-name" placeholder="分类名，如 高频词">' +
      '<button class="btn small dark" style="margin-top:12px" onclick="Words.saveCat()">创建</button>');
    setTimeout(function () { var el = document.getElementById('nc-name'); if (el) el.focus(); }, 60);
  },
  saveCat: function () {
    var v = (document.getElementById('nc-name').value || '').trim();
    if (!v) { UI.toast('先填分类名'); return; }
    this.cat = v; UI.closeSheet(); this.render(); UI.toast('已切到「' + v + '」，新建生词时可填这个分类');
  },
  moveSheet: function (w) {
    var cats = this.catNames();
    var html = '<h3>移到分类</h3><div class="hint" style="margin:6px 0 10px">' + esc(w) + '</div>';
    cats.forEach(function (c) {
      html += '<button class="pick-item" onclick="Words.moveTo(\'' + esc(w).replace(/'/g, "\\'") + '\',\'' + esc(c).replace(/'/g, "\\'") + '\')"><b>' + esc(c) + '</b></button>';
    });
    html += '<input class="input" id="mv-cat" placeholder="或输入新分类名" style="margin-top:10px">' +
      '<button class="btn small dark" style="margin-top:10px" onclick="Words.moveTo(\'' + esc(w).replace(/'/g, "\\'") + '\', document.getElementById(\'mv-cat\').value)">确定</button>';
    UI.sheet(html);
  },
  moveTo: function (w, c) {
    c = String(c || '').trim();
    if (!c) { UI.toast('分类不能为空'); return; }
    Store.wordSetCat(w, c);
    UI.closeSheet(); this.render(); UI.toast('已移到「' + c + '」');
  },

  renderWords: function () {
    var all = Store.wordsList();
    var cats = this.catNames();
    var chips = '<div class="chips" style="margin-bottom:8px">' +
      '<button class="chip ' + (this.cat === '全部' ? 'on' : '') + '" onclick="Words.setCat(\'全部\')">全部 ' + all.length + '</button>';
    cats.forEach(function (c) {
      var n = all.filter(function (w) { return (w.cat || '未分类') === c; }).length;
      chips += '<button class="chip ' + (Words.cat === c ? 'on' : '') + '" onclick="Words.setCat(\'' + esc(c).replace(/'/g, "\\'") + '\')">' + esc(c) + ' ' + n + '</button>';
    });
    chips += '<button class="chip" onclick="Words.newCat()">＋ 分类</button></div>';

    var list = this.cat === '全部' ? all : all.filter(function (w) { return (w.cat || '未分类') === Words.cat; });
    var head = chips + '<div class="row between" style="margin-bottom:8px">' +
      '<span class="muted">' + (this.cat === '全部' ? '共 ' + list.length + ' 词' : '「' + esc(this.cat) + '」' + list.length + ' 词') + '</span>' +
      '<button class="btn small dark" onclick="Words.newSheet()">＋ 新建</button></div>';
    if (!list.length) {
      return head + '<div class="empty"><div class="big">✎</div>' +
        (this.cat === '全部' ? '还没有生词<br>做题时点原文单词查义加入，或点上方「＋ 新建」'
          : '这个分类还没有词<br>新建时填这个分类名，或用「移动」把词挪过来') + '</div>';
    }
    var html = head + '<div class="card">';
    list.forEach(function (w) {
      html += '<div class="word-row"><div style="flex:1;min-width:0">' +
        '<div class="w">' + esc(w.w) + '</div>' +
        '<div class="m">' + esc(w.t || '') + '</div>' +
        '<div class="muted" style="font-size:11px;margin-top:2px">' + esc(w.cat || '未分类') + '</div></div>' +
        '<div class="x row" style="gap:6px">' +
        '<button class="btn small ghost" onclick="Words.moveSheet(\'' + esc(w.w).replace(/'/g, '\\\'') + '\')">移动</button>' +
        '<button class="btn small ghost" onclick="Words.deep(\'' + esc(w.w).replace(/'/g, '\\\'') + '\')">深讲</button>' +
        '<button class="btn small ghost" onclick="Words.remove(\'' + esc(w.w).replace(/'/g, '\\\'') + '\')">移除</button>' +
        '</div></div>';
    });
    html += '</div>';
    return html;
  },

  renderWrong: function () {
    var list = Store.wrongList();
    if (!list.length) {
      return '<div class="empty"><div class="big">✓</div>错题本是空的<br>做题时答错的题会自动收进来</div>';
    }
    var html = '<div class="card"><div class="row between"><span class="muted">按时间倒序</span>' +
      '<button class="btn link" onclick="Words.clearWrong()">清空</button></div>';
    list.forEach(function (w) {
      var label = (w.level === 'cet6' ? '六级' : '四级') + ' ' + w.year + '年' + w.month + '月 第' + w.set + '套 · 第' + w.n + '题';
      html += '<div class="word-row" style="align-items:flex-start">' +
        '<div style="flex:1;min-width:0"><div class="muted">' + esc(label) + '</div>' +
        '<div class="q-stem" style="font-size:14px;margin:4px 0">' + esc(w.stem) + '</div>' +
        (w.passage ? '<details class="exp"><summary>看原文</summary><div class="passage" style="font-size:13px">' +
          esc(w.passage) + '</div></details>' : '') +
        '<div class="muted">你选 ' + (w.mine || '未答') + ' · 正确 <b style="color:var(--ok)">' + esc(w.answer) + '</b></div></div>' +
        '<div class="x"><button class="btn small" onclick="Words.redo(\'' + w.id + '\')">重做</button></div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  },

  /* 阅读页点词后「加入生词本」：内置词典优先，缺释义再交给 AI 补 */
  quickAdd: function (w) {
    w = String(w || '').trim();
    if (!w) return;
    if (Store.wordHas(w)) { UI.toast('「' + w + '」已在生词本'); Words.markAdded(w); return; }
    var t = '';
    try { if (typeof Exam !== 'undefined' && Exam.dictLookup) t = Exam.dictLookup(w); } catch (e) {}
    Store.wordAdd(w, t, '阅读', '阅读');
    Words.markAdded(w);
    UI.toast(t ? '已加入生词本' : '已加入生词本，释义待补');
    if (!t && AI.ready()) {
      AI.wordLookup(w).then(function (r) {
        var m = (r.pos ? r.pos + ' ' : '') + (r.meaning || '');
        if (m) { Store.wordAdd(w, m, '阅读', '阅读'); if (Words.tab === 'word') Words.render(); }
      }).catch(function () {});
    }
    if (Words.tab === 'word' && document.getElementById('scr-words') && document.getElementById('scr-words').classList.contains('on')) Words.render();
  },

  markAdded: function (w) {
    var btns = document.querySelectorAll('#overlay [data-w]');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-w') === w) {
        btns[i].textContent = '已在生词本';
        btns[i].disabled = true;
        btns[i].className = 'btn small ghost';
      }
    }
  },

  remove: function (w) { Store.wordRemove(w); this.render(); },
  clearWrong: function () {
    if (!confirm('清空全部错题？此操作不可恢复。')) return;
    Store.wrongClear(); this.render();
  },
  redo: function (id) { Exam.redo(id); },

  deep: function (w) {
    var rec = Store.wordsAll()[w] || {};
    if (!AI.ready()) {
      var senses = [];
      try { if (typeof Exam !== 'undefined' && Exam.dictEntry) { var e = Exam.dictEntry(w); senses = e ? Exam.dictSenses(e.text) : []; } } catch (e2) {}
      UI.sheet('<h3>' + esc(w) + '</h3>' +
        (senses.length
          ? '<div class="ws-block"><div class="ws-label">常用意思</div><div class="ws-senses">' +
            senses.map(function (x) { return '<div class="ws-sense">' + esc(x) + '</div>'; }).join('') + '</div></div>'
          : '<div class="hint">内置词典没有收录这个词。</div>') +
        '<div class="hint" style="margin-top:10px">词根助记、辨析、例句需要 AI：去「我的 → AI 配置」接入模型后点「深讲」。</div>');
      return;
    }
    UI.sheet('<h3>' + esc(w) + '</h3><div id="deep-box" class="hint">AI 正在拆解…</div>');
    AI.json(AI.deepPrompt(w, rec.t || '')).then(function (r) {
      var html = '<h3>' + esc(w) + '</h3>';
      if (r.root) html += '<div class="card tight"><b>构词 / 词根</b><div class="hint">' + esc(r.root) + '</div></div>';
      if (r.mnemonic) html += '<div class="card tight"><b>助记</b><div class="hint">' + esc(r.mnemonic) + '</div></div>';
      if (r.confusion) html += '<div class="card tight"><b>易混辨析</b><div class="hint">' + esc(r.confusion) + '</div></div>';
      if ((r.collocations || []).length) html += '<div class="card tight"><b>常用搭配</b><div class="hint">' + r.collocations.map(esc).join('<br>') + '</div></div>';
      if (r.example) html += '<div class="card tight"><b>例句</b><div class="hint">' + esc(r.example.en) + '<br>' + esc(r.example.zh || '') + '</div></div>';
      UI.sheet(html);
    }).catch(function (e) { UI.sheet('<h3>' + esc(w) + '</h3><div class="hint">讲解失败：' + esc(e.message) + '</div>'); });
  }
};
