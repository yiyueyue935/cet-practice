/* 过级 · AI 接口层（OpenAI 兼容协议，支持自主部署模型）
   —— 可接 Ollama / LM Studio / vLLM / one-api / 各家云 API 等任意 OpenAI 兼容服务。
   隐私约定：地址与密钥仅保存在本机 localStorage；请求由浏览器直连你配置的模型服务，
   不经过任何中间服务器；AI 生成结果也只存在本机。 */
var AI = {
  KEY: 'cijing_ai_v1',
  MAX_CHARS: 4000,                      // 送入模型的文本上限（本地小模型上下文有限）
  PRESETS: [
    { name: 'Ollama', base: 'http://localhost:11434/v1', note: '本机 Ollama，需开启跨域' },
    { name: 'LM Studio', base: 'http://localhost:1234/v1', note: '本机 LM Studio Server' },
    { name: 'vLLM', base: 'http://localhost:8000/v1', note: '自部署 vLLM' },
    { name: '云 API', base: '', note: '任意 OpenAI 兼容地址' }
  ],
  /* 统一系统提示：强制 JSON 输出、中文讲解 */
  SYS: '你是四六级英语老师。讲解用简体中文，英文原词保留原文。只输出一个合法 JSON 对象，不要 markdown 代码块，不要任何多余文字。',

  /* ---------- 配置 ---------- */
  cfg: function () { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
  save: function (c) { try { localStorage.setItem(this.KEY, JSON.stringify(c || {})); } catch (e) {} },
  ready: function () { var c = this.cfg(); return !!(c.base && String(c.base).indexOf('http') === 0 && c.model); },
  /* 全角→半角 + 去空格：防中文输入法把「:」打成「：」（Ollama 会报 invalid model name） */
  normChar: function (s) { return String(s || '').replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }); },
  normModel: function (s) { return this.normChar(s).replace(/\s+/g, ''); },
  normBase: function (s) { return this.normChar(s).replace(/\s+/g, '').trim(); },
  endPoint: function () { return this.normBase(this.cfg().base || '').replace(/\/+$/, '') + '/chat/completions'; },
  headers: function () {
    var c = this.cfg(), h = { 'Content-Type': 'application/json' };
    if (c.key) h.Authorization = 'Bearer ' + c.key;
    return h;
  },

  /* ---------- 基础对话（流式读取，客户端累积）----------
     用 stream:true：部分 Ollama 版本对思考型模型（qwen3 等）的非流式请求会返回空正文，
     流式增量则正常；客户端把增量拼回完整文本即可。 */
  chat: function (messages, opts) {
    opts = opts || {};
    var c = this.cfg();
    if (!this.ready()) return Promise.reject(new Error('尚未配置 AI 接口'));
    var body = { model: this.normModel(c.model), messages: messages, stream: true };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = null;
    if (ctrl && opts.timeoutMs) timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs);
    return fetch(this.endPoint(), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().catch(function () { return ''; }).then(function (t) {
          var msg = 'HTTP ' + res.status, em = '';
          try { var j = JSON.parse(t); em = j && j.error ? (typeof j.error === 'string' ? j.error : (j.error.message || '')) : ''; } catch (e) {}
          if (em) msg += '：' + em;
          if (res.status === 401 || res.status === 403) msg += '（API Key 无效或无权限）';
          if (res.status === 404) msg += '（接口路径不对，确认 Base URL 以 /v1 结尾）';
          if (res.status === 429) msg += '（调用频率或额度受限）';
          if (/invalid model name/i.test(em) || (res.status === 400 && !em)) msg += '（模型名称格式不对：中文输入法的全角冒号「：」要改成英文冒号，如 qwen3:4b）';
          else if (/not found|not pulled/i.test(em)) msg += '（服务上没有这个模型：Ollama 需在电脑终端执行 ollama pull 模型名 先下载）';
          throw new Error(msg);
        });
      }
      if (!(res.body && res.body.getReader)) return res.json().then(function (d) { return AI._pickOut(d); });
      var reader = res.body.getReader();
      var dec = (typeof TextDecoder !== 'undefined') ? new TextDecoder() : null;
      var buf = '', raw = '', content = '', reason = '', fin = '', saw = false;
      function toStr(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          var chunk = dec ? dec.decode(r.value, { stream: true }) : toStr(r.value);
          raw += chunk; buf += chunk;
          var lines = buf.split('\n'); buf = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var ln = lines[i].trim();
            if (ln.indexOf('data:') !== 0) continue;
            saw = true;
            var p = ln.slice(5).trim();
            if (p === '[DONE]') continue;
            try {
              var j = JSON.parse(p), ch0 = j.choices && j.choices[0], d = (ch0 && (ch0.delta || ch0.message)) || {};
              if (d.content) content += d.content;
              var rz = d.reasoning || d.reasoning_content;
              if (rz) reason += rz;
              if (ch0 && ch0.finish_reason) fin = ch0.finish_reason;
            } catch (e) {}
          }
          return pump();
        });
      }
      return pump().then(function () {
        if (!saw) {
          try { return AI._pickOut(JSON.parse(raw)); }
          catch (e) { if (e.name === 'SyntaxError') throw new Error('模型服务未返回流式数据：确认接口为 OpenAI 兼容 /v1 地址'); throw e; }
        }
        if (!content) {
          if (reason) throw new Error('模型只输出了思考过程就被截断：qwen3 等思考模型默认先思考再回答，重试一次；仍失败建议换非思考模型（如 qwen2.5:7b）');
          if (fin === 'length') throw new Error('回复被 max_tokens 截断为空：思考型模型耗尽了输出额度，重试或换更小/非思考模型');
          throw new Error('模型返回为空');
        }
        return content;
      });
    }).then(function (out) {
      if (timer) clearTimeout(timer);
      return out;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('请求超时：本地小模型可尝试换更小的文章或更大的模型');
      if (e instanceof TypeError) throw new Error('无法连接模型服务：检查地址是否可达，且服务已开启跨域（CORS）');
      throw e;
    });
  },

  /* 从响应 JSON 中取正文；空正文按思考模型/截断给出诊断 */
  _pickOut: function (data) {
    var ch = data && data.choices && data.choices[0], out = ch && ch.message && ch.message.content;
    if (!out) {
      var m = (ch && ch.message) || {};
      var think = m.reasoning || m.reasoning_content || m.thinking || '';
      if (think) throw new Error('模型只输出了思考过程就被截断：qwen3 等思考模型默认先思考再回答，重试一次；仍失败建议换非思考模型（如 qwen2.5:7b）');
      if (ch && ch.finish_reason === 'length') throw new Error('回复被 max_tokens 截断为空：思考型模型耗尽了输出额度，重试或换更小/非思考模型');
      throw new Error('模型返回为空');
    }
    return out;
  },

  /* 让模型输出结构化 JSON：chat + 容错解析 */
  json: function (user, opts) {
    return this.chat([{ role: 'system', content: this.SYS }, { role: 'user', content: user }], opts)
      .then(function (out) { return AI.parseJSON(out); });
  },

  /* 带图片的结构化请求：OpenAI 兼容的 image_url（Ollama 新版同样支持） */
  jsonImages: function (user, images, opts) {
    var content = [{ type: 'text', text: user }];
    (images || []).forEach(function (url) {
      content.push({ type: 'image_url', image_url: { url: url } });
    });
    return this.chat([{ role: 'system', content: this.SYS }, { role: 'user', content: content }], opts)
      .then(function (out) { return AI.parseJSON(out); });
  },

  /* JSON 容错解析：剥 ```json 围栏、剥思考模型内联 <think> 块、截取首尾大括号之间；
     输出被 max_tokens 截断时自动修复（丢尾部残片、补齐括号），救回已生成的部分 */
  parseJSON: function (text) {
    var s = String(text || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
    var a = s.indexOf('{');
    if (a === -1) throw new Error('模型没有输出 JSON（可能只输出了思考或解释文字）：' + s.slice(0, 60));
    var obj = null, tail = s.slice(a);
    try { obj = JSON.parse(tail); } catch (e) { obj = null; }
    if (obj && typeof obj === 'object') return obj;
    obj = AI._salvageJSON(tail);
    if (obj) return obj;
    try { obj = JSON.parse(s.slice(a, s.lastIndexOf('}') + 1)); return obj; } catch (e) {}
    throw new Error('模型输出不完整或不是合法 JSON，可重试一次；反复失败建议换更强的模型或缩短文章');
  },

  /* 截断 JSON 修复：找到最后一个完整闭合点，丢掉尾部残片，补齐未闭合的括号 */
  _salvageJSON: function (s) {
    var stack = [], inStr = false, esc = false, lastSafe = -1, i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') { inStr = false; lastSafe = i; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') { stack.pop(); lastSafe = i; }
    }
    if (!stack.length && !inStr && !esc) { try { return JSON.parse(s); } catch (e) { return null; } }
    if (lastSafe < 0) return null;
    var t = s.slice(0, lastSafe + 1)
      .replace(/,\s*$/, '')
      .replace(/,\s*"[^"]*"\s*:\s*$/, '')
      .replace(/,\s*\{?\s*"[^"]*"$/, '');
    var st = []; inStr = false; esc = false;
    for (i = 0; i < t.length; i++) {
      ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') st.push(ch);
      else if (ch === '}' || ch === ']') st.pop();
    }
    if (inStr || esc) return null;
    while (st.length) t += (st.pop() === '{') ? '}' : ']';
    try { var o = JSON.parse(t); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; }
  },

  /* ---------- 服务管理 ---------- */
  models: function () {
    var c = this.cfg();
    if (!c.base) return Promise.reject(new Error('先填写 Base URL'));
    return fetch(this.normBase(c.base).replace(/\/+$/, '') + '/models', { headers: this.headers() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var arr = (d && d.data ? d.data : []).map(function (x) { return x && x.id; }).filter(Boolean);
        if (!arr.length) throw new Error('服务未返回模型列表');
        return arr;
      });
  },
  /* 连接测试：一句极短补全。不设 max_tokens——思考模型默认先输出思考过程 */
  test: function () {
    var t0 = Date.now();
    return this.chat([{ role: 'user', content: '请只回复两个字：成功' }], { temperature: 0, timeoutMs: 120000 })
      .then(function (out) { var s = String(out).replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); return { ok: true, msg: '连接成功（' + ((Date.now() - t0) / 1000).toFixed(1) + 's）：' + (s || '（模型返回了思考内容）').slice(0, 40) }; })
      .catch(function (e) { return { ok: false, msg: e.message }; });
  },

  /* ---------- 提示词（讲解全部中文） ---------- */
  /* 逐题讲解：题干 + 选项 + 原文 → 答案依据、干扰项、关键词汇 */
  explainPrompt: function (q, passage, userAnswer, focus) {
    var opts = '';
    if (q.options) {
      opts = Object.keys(q.options).map(function (k) { return k + ') ' + q.options[k]; }).join('\n');
    } else if (q.type === 'paragraph_matching') {
      opts = '（段落匹配题：在原文段落 A–O 中找对应段落）';
    }
    return '请讲解这道四六级阅读理解题。\n' +
      '题型：' + (q.typeName || q.type || '阅读') + '\n' +
      (focus
        ? '本题定位段落（只给相关段落，不必看全文）：\n' + String(focus).slice(0, 1200) + '\n\n'
        : (passage ? '原文（节选）：\n' + String(passage).slice(0, this.MAX_CHARS) + '\n\n' : '')) +
      '题目：第' + q.n + '题 ' + (q.stem || '') + '\n' +
      (opts ? '选项：\n' + opts + '\n' : '') +
      '官方答案：' + (q.answer || '（未知）') + '\n' +
      (userAnswer ? '学生选择：' + userAnswer + '\n' : '') +
      '要求：用中文讲清楚为什么选这个答案、其余选项错在哪、怎么快速定位。\n' +
      '只输出 JSON：{"answer":"选项字母","why":"依据：定位句+推理，100字内","others":"其余选项为何错，80字内","key_phrase":"定位句英文片段（30词内）","vocab":[{"w":"词或短语","t":"词性+中文"}]}';
  },

  /* 作文批改：对齐 CET 15 分制（106.5 分制换算 score×7.1） */
  essayPrompt: function (level, directions, essay, imgCount, brief) {
    var lv = level === 'cet6' ? '六级' : '四级';
    return '按大学英语' + lv + '作文评分标准批改下面这篇学生作文。\n' +
      '题目：\n' + String(directions || '（未提供，按作文内容推断）').slice(0, 400) + '\n\n' +
      (brief ? '本地统计（已算好，不要复述）：' + brief + '\n\n' : '') +
      (imgCount
        ? '学生作文：见附图，共 ' + imgCount + ' 张（可能是手写或拍照）。请先逐行识别图片里的英文作文，把识别结果放进 JSON 的 "text" 字段（保持原文拼写，不要改写），再批改。\n\n'
        : '学生作文：\n' + essay + '\n\n') +
      '15 分制：14 切题深刻流畅；11 切题较连贯少量错；8 基本切题错误较多；5 仅句子可读；2 条理不清。\n' +
      '语气友善具体，挑 3~5 句最值得改的（含 1 句写得好的）。\n' +
      '只输出 JSON：{"text":"识别出的作文原文（无图片时为空字符串）","score":11,"band":"一句话档次描述","dimension":{"content":"内容与切题，60字内","language":"语言，60字内","organization":"结构，60字内"},"sentences":[{"src":"原句","type":"good或fix或bad","fix":"改后句子（good 可空）","note":"中文点评，40字内"}],"upgrade":["优先改进 2~3 条"],"sample":"同题范文（120~150词）","sample_cn":"范文译文"}';
  },

  /* 翻译批改：对照参考译文找漏译/误译/搭配问题 */
  transPrompt: function (sourceCn, referenceEn, userTrans, imgCount) {
    /* 参考译文守卫：题库里有几套是 OCR 整页抓取（最长 1.7 万词，混进听力原文和中文解析），
       直接塞进 prompt 既烧 token 又把评分带偏。按「词数 + 中文占比」兜住 —— 只卡字符数不够，
       1000 字符的乱码照样能过。 */
    var ref = String(referenceEn || '').trim();
    if (ref) {
      var refWords = ref.split(/\s+/).filter(function (x) { return /[A-Za-z]/.test(x); }).length;
      var refCjk = (ref.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (refWords < 40 || refWords > 320 || refCjk / ref.length >= 0.05) ref = '';
    }
    return '批改这道四六级段落翻译。\n' +
      '中文原文：\n' + String(sourceCn || '').slice(0, 1200) + '\n\n' +
      '参考译文：\n' + (ref || '（无可用参考译文，请自行给出高质量译文后再对照）') + '\n\n' +
      (imgCount
        ? '学生译文：见附图，共 ' + imgCount + ' 张。请先识别图片里的英文译文，放进 JSON 的 "text" 字段，再批改。\n\n'
        : '学生译文：\n' + String(userTrans || '').slice(0, 3000) + '\n\n') +
      '评分标准（15 分制）：译文准确、通顺、无重大语法错误为高分；漏译、误译、中式表达按程度扣分。\n' +
      '只输出 JSON：{"text":"识别出的译文原文（无图片时为空字符串）","score":10,"band":"一句话档次描述","diffs":[{"type":"漏译或误译或搭配或时态或拼写","src":"学生译文片段","better":"更好的表达","note":"中文说明"}],"revised":"在学生译文基础上的润色版（保持原意与结构，只修错）","reference":"整段的高分参考译文（英文，完整一段）","reference_note":"参考译文里 2~3 个值得学习的表达，中文讲解"}';
  },

  /* 生词深讲：词根词缀/助记/辨析/搭配/例句 */
  deepPrompt: function (word, meaning, example) {
    return '请为单词或短语「' + word + '」生成记忆卡片' +
      (meaning ? '（词典释义：' + meaning + '）' : '') +
      (example ? '（词典例句：' + example + '）' : '') + '。\n' +
      '只输出 JSON：{"root":"词根词缀拆解，无词根则讲构词或词源，40字内","mnemonic":"中文联想助记，可用谐音/场景/图像化，40字内","confusion":"与最易混词的辨析（形近或义近），60字内","collocations":["常用搭配1（附中文）","常用搭配2（附中文）","常用搭配3（附中文）"],"example":{"en":"一个地道的新例句","zh":"例句中文翻译"}}';
  },

  /* 点词查义：原文里点到任意单词时补音标/词性/释义/例句。
     调用方：exam.js 的 Exam.tapWord、words.js 的新建生词自动补释义。 */
  wordPrompt: function (w, ctx) {
    return '解释四六级词汇「' + w + '」' + (ctx ? '在下面这句话里的意思' : '在考试语境下的含义') + '。\n' +
      (ctx ? '所在句：' + String(ctx).slice(0, 200) + '\n' : '') +
      '只输出 JSON：{"ctx":"该词在本句中的意思，中文，20字内","phonetic":"国际音标，不带斜杠","pos":"词性缩写，如 n. / v. / adj.","meaning":"常用释义，多个义项用；分隔，40字内","example":"一个四六级难度的英文例句，20词内"}';
  },
  wordLookup: function (w, ctx) {
    var word = String(w || '').trim();
    if (!word) return Promise.reject(new Error('单词为空'));
    return this.json(this.wordPrompt(word, ctx), { temperature: 0.2, maxTokens: 300, timeoutMs: 60000 })
      .then(function (r) {
        return {
          w: word,
          ctx: String((r && r.ctx) || ''),
          phonetic: String((r && r.phonetic) || '').replace(/^\/+|\/+$/g, ''),
          pos: String((r && r.pos) || ''),
          meaning: String((r && r.meaning) || ''),
          example: String((r && r.example) || '')
        };
      });
  }
};
