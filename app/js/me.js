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
      '<div class="hint" style="margin-top:6px">所有记录都在本机。换手机或清缓存前，先导出备份。</div>' +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn small ghost" onclick="Me.exportData()">导出备份</button>' +
      '<button class="btn small ghost" onclick="document.getElementById(\'imp-file\').click()">导入备份</button>' +
      '<input type="file" id="imp-file" accept="application/json,.json" style="display:none" onchange="Me.importData(this)">' +
      '</div></div>';

    html += '<div class="card"><div class="card-title">关于</div>' +
      '<div class="hint" style="margin-top:6px">过级 · 四六级备考练习。仓库自带的题库是原创模拟题（非真题），按 <b>docs/BANK-FORMAT.md</b> 也可以放自己的套卷。<br>' +
      '阅读题判分权重按四级/六级官方分值换算：选词填空 3.55/题，段落匹配 7.1/题，仔细阅读 14.2/题。</div>' +
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

  exportData: function () {
    var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'guoji-backup-' + todayStr() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  },

  importData: function (input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        Store.importJSON(String(rd.result));
        UI.toast('导入成功');
        Me.render();
      } catch (e) { UI.toast('导入失败：' + e.message, 3000); }
      input.value = '';
    };
    rd.readAsText(f, 'utf-8');
  },

  wipe: function () {
    if (!confirm('清空本机全部学习数据（进度/错题/生词/批改记录）？AI 配置会保留。')) return;
    [Store.P, Store.W, Store.V, Store.E, Store.T].forEach(function (k) { localStorage.removeItem(k); });
    UI.toast('已清空');
    this.render();
  }
};
