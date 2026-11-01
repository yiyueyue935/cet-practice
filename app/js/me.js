/* 过级 · 我的（统计 / AI 配置 / 数据） */
var Me = {
  cfgDraft: null,

  render: function () {
    var el = document.getElementById('scr-me');
    var st = Store.stats();
    var c = AI.cfg();

    var html = UI.topbar('我的', '统计、AI 设置与数据');

    html += '<div class="wrap">';

    html += '<div class="card"><div class="card-title">学习统计</div>' +
      '<div class="row between" style="margin-top:12px;text-align:center">' +
      '<div style="flex:1"><div style="font-size:22px;font-weight:800">' + st.setsDone + '</div><div class="muted">完成套卷</div></div>' +
      '<div style="flex:1"><div style="font-size:22px;font-weight:800">' + st.questions + '</div><div class="muted">做题数</div></div>' +
      '<div style="flex:1"><div style="font-size:22px;font-weight:800">' + Math.round(st.rate * 100) + '%</div><div class="muted">正确率</div></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="row between"><span class="hint">生词 / 错题 / 作文 / 翻译</span><span class="hint">' +
      st.words + ' / ' + st.wrong + ' / ' + st.essays + ' / ' + st.trans + '</span></div>' +
      '</div>';

    /* ---------- 考试级别 ---------- */
    var forcedLv = (typeof window.APP_LEVEL === 'string') ? window.APP_LEVEL : '';
    if (forcedLv) {
      html += '<div class="card"><div class="card-title">考试级别</div>' +
        '<div class="row between" style="margin-top:8px"><b>' + (forcedLv === 'cet6' ? '六级 CET-6' : '四级 CET-4') + '</b>' +
        '<span class="tag">本安装包固定</span></div>' +
        '<div class="hint" style="margin-top:8px">需要另一级别请安装对应的「过级·四级 / 过级·六级」</div></div>';
    } else {
      html += '<div class="card"><div class="card-title">考试级别</div>' +
        '<div class="chips" style="padding-top:10px">' +
        '<button class="chip ' + (UI.level === 'cet4' ? 'on' : '') + '" onclick="Me.setLevel(\'cet4\')">四级 CET-4</button>' +
        '<button class="chip ' + (UI.level === 'cet6' ? 'on' : '') + '" onclick="Me.setLevel(\'cet6\')">六级 CET-6</button>' +
        '</div><div class="hint" style="margin-top:8px">切换后练习、听力、作文、翻译都会跟着换题库</div></div>';
    }

    /* ---------- 语音朗读 ---------- */
    html += '<div class="card"><div class="card-title">语音朗读（TTS）<span class="tag" id="tts-tag">检测中…</span></div>' +
      '<div class="hint" style="margin-top:6px">听力里不带录音的套卷，用系统语音朗读题干。不需要装本 App 的插件，但手机要有 TTS 引擎和英语语音包。</div>' +
      '<div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn small ghost" onclick="Listen.testTTS()">检测并试听</button>' +
      '<button class="btn link" onclick="Listen.ttsHelp()">怎么装英语语音？</button></div></div>';

    /* ---------- AI 配置 ---------- */
    html += '<div class="card"><div class="card-title">AI 配置<span class="tag ' + (AI.ready() ? 'ok' : '') + '">' + (AI.ready() ? '已就绪' : '未配置') + '</span></div>' +
      '<div class="hint" style="margin-top:6px">批改与讲解都由你自己配置的模型完成，地址和密钥只存本机浏览器。支持 Ollama / LM Studio / vLLM / 任何 OpenAI 兼容云 API。</div>' +
      '<div class="chips" style="padding:10px 0 0;flex-wrap:wrap">';
    AI.PRESETS.forEach(function (p, i) {
      html += '<button class="chip" onclick="Me.preset(' + i + ')">' + esc(p.name) + '</button>';
    });
    html += '</div>';

    html += '<label class="field"><span>Base URL（以 /v1 结尾）</span>' +
      '<input class="input" id="ai-base" value="' + esc(c.base || '') + '" placeholder="http://localhost:11434/v1" autocomplete="off"></label>';
    html += '<label class="field"><span>API Key（本地服务可留空）</span>' +
      '<input class="input" id="ai-key" type="password" value="' + esc(c.key || '') + '" placeholder="sk-…" autocomplete="off"></label>';
    html += '<label class="field"><span>模型名</span>' +
      '<input class="input" id="ai-model" value="' + esc(c.model || '') + '" placeholder="qwen3:8b / gpt-4o-mini …" autocomplete="off">' +
      '<div id="ai-models" style="margin-top:6px"></div></label>';

    html += '<div class="row" style="gap:8px;flex-wrap:wrap">' +
      '<button class="btn small ghost" onclick="Me.listModels()">拉取模型列表</button>' +
      '<button class="btn small ghost" onclick="Me.test()">测试连接</button>' +
      '<button class="btn small dark" onclick="Me.saveAI()">保存</button>' +
      '</div><div id="ai-msg" class="hint" style="margin-top:8px"></div>' +
      '</div>';

    /* ---------- 数据 ---------- */
    html += '<div class="card"><div class="card-title">数据</div>' +
      '<div class="hint" style="margin-top:6px">所有记录都在本机，不上传。备份只含学习记录，' +
      '<b>不含 AI 地址与密钥</b>。换手机或清缓存前，先做一次备份。</div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn small dark" onclick="Me.exportData()">导出备份</button>' +
      '<button class="btn small ghost" onclick="document.getElementById(\'imp-file\').click()">导入备份</button>' +
      '<button class="btn small ghost" onclick="Me.importPaste()">粘贴导入</button>' +
      '</div>' +
      '<button class="btn link" style="margin-top:6px" onclick="Me.copyBackupText()">复制备份文本（发到聊天窗口也能存）</button>' +
      '<input type="file" id="imp-file" accept="application/json,.json,text/plain" style="display:none" onchange="Me.importData(this)">' +
      '</div>';

    html += '<div class="card"><div class="card-title">关于</div>' +
      '<div class="hint" style="margin-top:6px">过级 · 四六级备考练习。仓库自带的题库是原创模拟题（非真题），按 <b>docs/BANK-FORMAT.md</b> 也可以放自己的套卷。<br>' +
      '阅读题判分权重按四级/六级官方分值换算：选词填空 3.55/题，段落匹配 7.1/题，仔细阅读 14.2/题。<br>' +
      '个人学习项目，与考试机构无关；仅供非商业使用，禁止售卖。题目与 AI 批改仅供参考，不保证与真实考试一致。</div>' +
      '<button class="btn link" style="margin-top:6px;color:var(--err)" onclick="Me.wipe()">清除本机全部数据</button>' +
      '</div>';

    html += '<div style="height:24px"></div></div>';
    el.innerHTML = html;
    setTimeout(function () {
      var t = document.getElementById('tts-tag');
      if (!t || typeof Listen === 'undefined') return;
      var i = Listen.ttsInfo();
      t.textContent = i.en ? ('可用 · ' + i.en + ' 个英语音色')
        : (i.count ? ('仅 ' + i.count + ' 个中文音色') : (i.ok ? '未检测到音色' : '不支持'));
      t.className = 'tag ' + (i.en ? 'ok' : (i.count ? 'gold' : ''));
    }, 400);
  },

  setLevel: function (lv) {
    UI.setLevel(lv);
    this.render();
  },

  preset: function (i) {
    var p = AI.PRESETS[i];
    var base = document.getElementById('ai-base');
    if (base && p.base) base.value = p.base;
    var msg = document.getElementById('ai-msg');
    if (msg) msg.textContent = p.note || '';
  },

  saveAI: function () {
    var c = {
      base: (document.getElementById('ai-base').value || '').trim(),
      key: (document.getElementById('ai-key').value || '').trim(),
      model: (document.getElementById('ai-model').value || '').trim()
    };
    AI.save(c);
    this.render();
    UI.toast(AI.ready() ? '已保存' : '已保存，但还缺地址或模型名');
  },

  listModels: function () {
    var msg = document.getElementById('ai-msg');
    var box = document.getElementById('ai-models');
    this.saveAISilent();
    msg.textContent = '正在拉取…';
    AI.models().then(function (arr) {
      var html = '<div class="chips" style="padding:4px 0 0;flex-wrap:wrap">';
      arr.slice(0, 40).forEach(function (m) {
        html += '<button class="chip" onclick="document.getElementById(\'ai-model\').value=\'' + esc(m).replace(/'/g, '\\\'') + '\'">' + esc(m) + '</button>';
      });
      html += '</div>';
      box.innerHTML = html;
      msg.textContent = '共 ' + arr.length + ' 个模型，点选即可填入';
    }).catch(function (e) {
      msg.textContent = '拉取失败：' + e.message;
    });
  },

  saveAISilent: function () {
    var base = document.getElementById('ai-base');
    var key = document.getElementById('ai-key');
    var model = document.getElementById('ai-model');
    if (!base) return;
    AI.save({
      base: (base.value || '').trim(),
      key: (key && key.value || '').trim(),
      model: (model && model.value || '').trim()
    });
  },

  test: function () {
    var msg = document.getElementById('ai-msg');
    this.saveAISilent();
    msg.textContent = '正在测试…';
    AI.test().then(function (r) { msg.textContent = r.msg; });
  },

  /* ---------- 备份：导出 ----------
     三条路依次尝试：原生写文件+系统分享（APK）→ 浏览器下载 → 摊开文本让用户复制。
     任何一条通了就算成功，不再出现「点了没反应」。 */
  exportData: function () {
    var text = Store.exportJSON();
    var name = 'guoji-backup-' + todayStr() + '.json';
    var self = this;
    var cap = (window.Capacitor && window.Capacitor.Plugins) || {};
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    /* 原生（APK）：WebView 不支持 a[download]，必须走文件系统 + 系统分享 */
    if (native) {
      if (!cap.Filesystem || !cap.Share) { this.exportFallback(text, name); return; }
      cap.Filesystem.writeFile({ path: name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true })
        .then(function () { return cap.Filesystem.getUri({ path: name, directory: 'DOCUMENTS' }); })
        .then(function (u) {
          return cap.Share.share({ title: name, url: u.uri, dialogTitle: '保存或发送备份文件' });
        })
        .then(function () { UI.toast('已导出 ' + name, 2600); })
        .catch(function (e) { self.exportFallback(text, name, e); });
      return;
    }

    try {
      var blob = new Blob([text], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 3000);
      UI.toast('已导出 ' + name + '，看浏览器的下载列表', 3000);
    } catch (e) {
      this.exportFallback(text, name, e);
    }
  },

  /* 兜底：把备份摊成一段文本，能复制就能存下来 */
  exportFallback: function (text, name, err) {
    var why = err ? ('自动保存没成功（' + esc(String(err.message || err)) + '）。')
      : '当前环境不支持直接下载文件。';
    UI.sheet('<h3>备份文本</h3>' +
      '<div class="hint" style="margin-bottom:8px">' + why +
      '点「复制」后粘贴到备忘录、聊天窗口或文件里保存即可。</div>' +
      '<textarea class="textarea" id="backup-text" readonly style="height:180px;font-size:12px">' + esc(text) + '</textarea>' +
      '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button class="btn small ghost" onclick="Me.copyBackup()">复制</button>' +
      '<button class="btn small dark" onclick="UI.closeSheet()">关闭</button></div>');
  },

  copyBackupText: function () {
    this.exportFallback(Store.exportJSON(), 'guoji-backup-' + todayStr() + '.json');
  },

  copyBackup: function () {
    var el = document.getElementById('backup-text');
    if (!el) return;
    var manual = function () { el.focus(); el.select(); UI.toast('已全选，长按复制', 2600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value).then(function () { UI.toast('已复制'); }).catch(manual);
      return;
    }
    try { el.select(); if (document.execCommand('copy')) UI.toast('已复制'); else manual(); }
    catch (e) { manual(); }
  },

  /* ---------- 备份：导入 ---------- */
  importData: function (input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var self = this;
    var rd = new FileReader();
    rd.onerror = function () { UI.toast('读不了这个文件', 2600); input.value = ''; };
    rd.onload = function () { self.doImport(String(rd.result)); input.value = ''; };
    rd.readAsText(f, 'utf-8');
  },

  /* 文件选择器在某些 WebView 里不灵时的第二条路 */
  importPaste: function () {
    UI.sheet('<h3>粘贴备份</h3>' +
      '<div class="hint" style="margin-bottom:8px">把备份 JSON 的全部内容粘到这里（以 { 开头）。</div>' +
      '<textarea class="textarea" id="imp-text" placeholder="{\"app\":\"guoji\",…}" style="height:160px;font-size:12px"></textarea>' +
      '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button class="btn small ghost" onclick="UI.closeSheet()">取消</button>' +
      '<button class="btn small dark" onclick="Me.doImport(document.getElementById(\'imp-text\').value)">导入</button></div>');
  },

  doImport: function (text) {
    var st = Store.stats();
    var hasData = !!(st.questions || st.words || st.wrong || st.essays || st.trans);
    if (hasData && !confirm('导入会覆盖本机现有的学习记录（进度 / 错题 / 生词 / 批改），继续？')) return;
    try {
      var n = Store.importJSON(text);
      UI.closeSheet();
      UI.level = Store.settings().level || UI.level;
      var parts = [];
      if (n.progress) parts.push('进度 ' + n.progress + ' 套');
      if (n.words) parts.push('生词 ' + n.words);
      if (n.wrong) parts.push('错题 ' + n.wrong);
      if (n.essays) parts.push('作文 ' + n.essays + ' 篇');
      if (n.trans) parts.push('翻译 ' + n.trans + ' 篇');
      UI.toast('已导入：' + (parts.join(' · ') || '无记录'), 3200);
      this.render();
    } catch (e) {
      UI.toast('导入失败：' + e.message, 3200);
    }
  },

  wipe: function () {
    if (!confirm('清空本机全部学习数据（进度/错题/生词/批改记录）？AI 配置会保留。')) return;
    [Store.P, Store.W, Store.V, Store.E, Store.T].forEach(function (k) { localStorage.removeItem(k); });
    UI.toast('已清空');
    this.render();
  }
};
