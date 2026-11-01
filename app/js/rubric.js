/* 过级 · 本地评分引擎（作文 + 翻译）
 *
 * 设计约束：
 *   1. 纯 ES5、零 DOM、零 window —— 必须能被 scripts/calibrate.js 用 vm.runInNewContext 裸跑，
 *      否则 2000+ 条语料的校准就只能靠浏览器，本机 Python 又坏了，等于做不了。
 *   2. 确定性：同一篇文本重复评分结果完全一致，不依赖时间/随机。
 *   3. 可解释：每个扣分都能溯源到具体特征或规则，`rubric` 字段给出三维明细。
 *
 * 依赖全局：
 *   RUBRIC_LEX（词表，scripts/gen_lexicon.js 生成）
 *   RUBRIC_COEF（拟合系数，scripts/calibrate.js 生成；为 null 时用内置初值）
 *   CET_DICT（可选，词典；缺省时拼写检查降级）
 *
 * 对外：
 *   Rubric.essay(text, prompt, level)   → 与 AI 批改同结构的结果
 *   Rubric.trans(sourceCn, referenceEn, userText, level) → 翻译结果
 *   Rubric.features(text, prompt, level) → 33 维特征（校准用）
 *   Rubric.detail(text, prompt, level)   → 特征 + 错误明细（调试用）
 */
var Rubric = {
  LEX: null,
  COEF: null,
  _re: {},
  _dictSet: null,
  _dictKeys: null,
  _commonSet: null,
  _verbSet: null,
  _nounOnly: null,
  _adjOnly: null,
  _verbOnly: null,
  _transSet: null,
  _funcSet: null,
  _uncountSet: null,

  /* ================= 初始化 ================= */
  init: function () {
    if (this.LEX) return this;
    var lex = (typeof RUBRIC_LEX !== 'undefined' && RUBRIC_LEX) ? RUBRIC_LEX : null;
    if (!lex) throw new Error('RUBRIC_LEX 未加载：请确认 js/rubric_w.js 在 js/rubric.js 之前');
    this.LEX = lex;
    this.COEF = (typeof RUBRIC_COEF !== 'undefined' && RUBRIC_COEF) ? RUBRIC_COEF : null;

    var self = this;
    function set(str) {
      var o = {};
      String(str || '').split(/\s+/).forEach(function (w) { if (w) o[w] = 1; });
      return o;
    }
    this._commonSet = set(lex.COMMON);
    this._verbSet = set(lex.VERB_BASE);
    this._nounOnly = set(lex.NOUN_ONLY);
    this._adjOnly = set(lex.ADJ_ONLY);
    this._verbOnly = set(lex.VERB_ONLY);
    this._transSet = set(lex.TRANSITIVE);
    this._funcSet = set(lex.FUNC);
    this._uncountSet = set(lex.UNCOUNT);

    var dict = (typeof CET_DICT !== 'undefined' && CET_DICT) ? CET_DICT : null;
    if (dict) {
      this._dictKeys = Object.keys(dict);
      var ds = {};
      this._dictKeys.forEach(function (k) { ds[k] = 1; });
      this._dictSet = ds;
    } else {
      this._dictKeys = [];
      this._dictSet = null;
    }

    /* 拼写检查用：按首字母分桶，避免每个生词都跟 7631 条词典全量比 */
    this._buckets = {};
    var keys = this._dictKeys;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], c = k.charAt(0);
      (this._buckets[c] = this._buckets[c] || []).push(k);
    }

    /* 连接词 → 类别，用于语义覆盖度 */
    this._connList = [];
    var CONN = lex.CONN || {};
    for (var cat in CONN) {
      if (!CONN.hasOwnProperty(cat)) continue;
      CONN[cat].forEach(function (p) { self._connList.push({ p: p, cat: cat }); });
    }
    this._connCats = Object.keys(CONN);

    /* 搭配、介词错式预编译 */
    this._collocRe = (lex.COLLOC || []).map(function (p) { return self._phraseRe(p); });
    this._prepErr = (lex.PREP_ERR || []).filter(function (x) { return x[0] !== x[1]; })
      .map(function (x) { return { re: self._phraseRe(x[0]), want: x[1], bad: x[0] }; });
    return this;
  },

  _phraseRe: function (p) {
    var key = 'p:' + p;
    if (this._re[key]) return this._re[key];
    var body = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var re = new RegExp('\\b' + body + '\\b', 'gi');
    this._re[key] = re;
    return re;
  },

  /* ================= 词形归一 ================= */
  /* 所有候选形态必须命中词典才接受 —— 否则 bus→bu、gas→ga 这种会被误判 */
  lemma: function (w) {
    var s = String(w || '').toLowerCase().replace(/[^a-z'-]/g, '').replace(/^[-']+|[-']+$/g, '');
    if (!s) return '';
    var L = this.LEX;
    if (L.IRREG[s]) return L.IRREG[s];
    if (!this._dictSet) return s;
    if (s.length < 4) return s;
    var cands = [];
    if (/ies$/.test(s)) cands.push(s.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes|zes)$/.test(s)) cands.push(s.slice(0, -2));
    if (/s$/.test(s) && !/(ss|us|is|as)$/.test(s)) cands.push(s.slice(0, -1));
    if (/ing$/.test(s) && s.length > 5) {
      var c = s.slice(0, -3);
      cands.push(c); cands.push(c + 'e');
      if (/([bdgklmnprt])\1$/.test(c)) cands.push(c.slice(0, -1));
    }
    if (/ed$/.test(s) && s.length > 4) {
      var e = s.slice(0, -2);
      cands.push(e); cands.push(e + 'e');
      if (/([bdgklmnprt])\1$/.test(e)) cands.push(e.slice(0, -1));
      if (/i$/.test(e)) cands.push(e.slice(0, -1) + 'y');
    }
    for (var i = 0; i < cands.length; i++) {
      if (this._dictSet[cands[i]]) return cands[i];
    }
    return s;
  },

  /* ================= 分词 / 分句 ================= */
  words: function (s) { return String(s || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []; },

  splitSents: function (raw) {
    var s = String(raw || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
    var out = [], buf = '', i = 0;
    while (i < s.length) {
      var ch = s.charAt(i);
      buf += ch;
      if (ch === '.' || ch === '!' || ch === '?') {
        var nxt = s.charAt(i + 1);
        /* 小数 3.5 / 编号 2,000 不切 */
        if (ch === '.' && nxt && /\d/.test(nxt)) { i++; continue; }
        var j = i + 1;
        while (j < s.length && /["')\]]/.test(s.charAt(j))) { buf += s.charAt(j); j++; }
        /* 句号后直接跟大写字母也算句末：题库里的参考译文普遍写成 "population.People"，
           只认空格会把整段判成一句，进而触发「句数<3」的错误封顶 */
        if (j >= s.length || s.charAt(j) === ' ' || /[A-Z]/.test(s.charAt(j))) {
          out.push(buf.trim()); buf = ''; i = j; continue;
        }
        i = j; continue;
      }
      i++;
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(function (x) { return x; });
  },

  /* 从网页/PDF 复制来的作文常把标点后的空格吃掉，导致分句失败、句长虚高、
     还会被当成一堆格式错误。先补空格再分析；原始文本单独留着统计真实排版问题。 */
  normPunct: function (raw) {
    return String(raw || '')
      /* 范文里常见 「experience.1 This」这种句号+编号的排版，先把编号去掉 */
      .replace(/([.!?])(\d{1,2})(\s+)(?=[A-Z])/g, '$1 ')
      .replace(/([a-z0-9])([,;:])([A-Za-z])/g, '$1$2 $3')
      .replace(/([a-z])([.!?])([A-Z])/g, '$1$2 $3')
      .replace(/([.!?][\"'\)\]])([A-Z])/g, '$1 $2')
      .replace(/[ \t]{2,}/g, ' ');
  },

  splitParas: function (raw) {
    return String(raw || '').replace(/\r/g, '').split(/\n+/)
      .map(function (s) { return s.trim(); }).filter(Boolean);
  },

  clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  /* ================= 词性近似标注 ================= */
  /* 只区分「限定动词 / 名词 / 形容词 / 副词 / 其他」，够规则用即可 */
  isFiniteVerb: function (w) {
    var L = this.LEX;
    if (/^(am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|may|might|must|should|shall)$/.test(w)) return true;
    if (this._verbSet[w]) return true;
    if (L.IRREG[w]) return true;
    if (/s$/.test(w) && this._verbSet[w.slice(0, -1)]) return true;
    if (/ed$/.test(w) && this._verbSet[w.slice(0, -2)]) return true;
    /* 不把 -ing 当限定动词：现在分词单独出现不是谓语，
       否则 "Because I like reading." 会被判成两个谓语而漏掉「句子片段」 */
    return false;
  },

  isThirdPersonVerb: function (w) {
    return /s$/.test(w) && !/(ss|us|is|as)$/.test(w) && !!this._verbSet[w.slice(0, -1)];
  },

  isPluralNoun: function (w) {
    if (!this._dictSet) return /s$/.test(w) && !/(ss|us|is|as)$/.test(w);
    if (!/s$/.test(w) || /(ss|us|is|as)$/.test(w)) return false;
    var b = w.slice(0, -1);
    if (this._nounOnly[b] || this._dictSet[b]) return true;
    if (/ies$/.test(w) && this._dictSet[w.slice(0, -3) + 'y']) return true;
    if (/(ches|shes|xes|zes)$/.test(w) && this._dictSet[w.slice(0, -2)]) return true;
    return false;
  },

  /* ================= 十条语法规则 ================= */
  /* 每条都返回命中的「证据片段」数组，便于逐句点评；误报抑制写在规则内部 */

  _r1_sva: function (toks) {
    var out = [];
    var SING = { he: 1, she: 1, it: 1, this: 1, that: 1, everyone: 1, everybody: 1, nobody: 1, someone: 1 };
    var PLUR = { they: 1, we: 1, you: 1, people: 1 };
    var AUX = /^(will|would|can|could|may|might|must|should|shall|do|does|did|not|to|let|make|help)$/;
    var ADV = /ly$/;
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i].toLowerCase();
      var isSing = !!SING[w];
      var isPlur = !!PLUR[w] || this.isPluralNoun(w);
      if (!isSing && !isPlur) continue;
      /* 主语与谓语之间隔了逗号或从属连词 → 从句错位，跳过 */
      var j = i + 1, guard = 0, blocked = false;
      while (j < toks.length && guard++ < 4) {
        var t = toks[j].toLowerCase();
        if (t === ',' || t === ';' || /^(which|who|that|because|although|while|when|if|where)$/.test(t)) { blocked = true; break; }
        if (ADV.test(t) || /^(very|really|also|often|always|usually|never|still|just|only|not)$/.test(t)) { j++; continue; }
        break;
      }
      if (blocked || j >= toks.length) continue;
      /* 前 3 词里有助动词/情态 → 合法（does not go / will go） */
      var auxBefore = false;
      for (var k = Math.max(0, i - 3); k < i; k++) { if (AUX.test(toks[k].toLowerCase())) { auxBefore = true; break; } }
      if (auxBefore) continue;
      var v = toks[j].toLowerCase();
      /* 系动词/助动词/情态词本身不是「动词原形」，否则 "it is" 会被误判 */
      var NOT_BASE = /^(am|is|are|was|were|be|been|being|has|have|had|do|does|did|will|would|can|could|may|might|must|should|shall)$/;
      if (isSing && this._verbSet[v] && !NOT_BASE.test(v)) out.push(toks[i] + ' ' + toks[j]);
      else if (isPlur && this.isThirdPersonVerb(v) && !NOT_BASE.test(v)) out.push(toks[i] + ' ' + toks[j]);
    }
    /* there is + 复数 / there are + 单数 */
    for (var m = 0; m < toks.length - 2; m++) {
      var a = toks[m].toLowerCase(), b = toks[m + 1].toLowerCase(), c = toks[m + 2].toLowerCase();
      if (a !== 'there') continue;
      if (b === 'is' && this.isPluralNoun(c)) out.push('there is ' + toks[m + 2]);
      if (b === 'are' && !this.isPluralNoun(c) && this._nounOnly[c]) out.push('there are ' + toks[m + 2]);
    }
    return out;
  },

  _r2_tense: function (toks, sent) {
    var out = [];
    var low = sent.toLowerCase();
    /* ① 过去时间状语 + 现在系动词 */
    var PAST = /\b(yesterday|last\s+(year|month|week|night|summer|winter)|ago|at\s+that\s+time|formerly|in\s+(19|20)\d\d)\b/;
    if (PAST.test(low)) {
      var m = low.match(/\b(is|are|am)\b/);
      if (m && !/\b(since|for)\b/.test(low)) out.push(m[0]);
    }
    /* ② 情态 + 过去式（can went / should went） */
    var MODAL = /^(can|could|may|might|must|should|would|will|shall)$/;
    for (var i = 0; i < toks.length - 1; i++) {
      if (!MODAL.test(toks[i].toLowerCase())) continue;
      var nxt = toks[i + 1].toLowerCase();
      if (this.LEX.IRREG[nxt] && !/^(be|have|do|go|come|get|make|take|see|know)$/.test(nxt)) {
        out.push(toks[i] + ' ' + toks[i + 1]);
      }
    }
    return out;
  },

  _r3_article: function (toks) {
    var out = [];
    var AN_EXC = /^(hour|honest|honor|honour|heir|heirloom)/;
    var A_EXC = /^(university|user|useful|european|one|once|unique|unit|united|us|usual|uniform|union)/;
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i].toLowerCase();
      var nxt = (toks[i + 1] || '').toLowerCase();
      if (!nxt) continue;
      /* ① a + 元音开头 */
      if (w === 'a' && /^[aeiou]/.test(nxt) && !AN_EXC.test(nxt) && !A_EXC.test(nxt)) out.push('a ' + toks[i + 1]);
      /* ② an + 辅音开头 */
      if (w === 'an' && /^[^aeiou]/.test(nxt) && !AN_EXC.test(nxt)) out.push('an ' + toks[i + 1]);
      /* ③ a/an + 复数或不可数 */
      if ((w === 'a' || w === 'an') && (this._uncountSet[nxt] || this.isPluralNoun(nxt))) out.push(toks[i] + ' ' + toks[i + 1]);
      /* ④「介词 + 裸单数名词」不做了：in class / at school / for example 这类固定搭配太多，
         误报率远高于收益，规则宁可少也不要错。 */
    }
    return out;
  },

  _r4_number: function (toks) {
    var out = [];
    var QTY = /^(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|hundred|thousand|million|several|many|few|both|various|different|numerous|such|these|those)$/;
    var UNIT = /^(yuan|dollar|cent|kilometer|kilometre|meter|metre|mile|hour|day|year|month|week|percent|degree|ton|kilo|gram|jin|mu)$/;
    for (var i = 0; i < toks.length - 1; i++) {
      var w = toks[i].toLowerCase(), nxt = toks[i + 1].toLowerCase();
      if (!QTY.test(w)) continue;
      if (w === 'many' && nxt === 'a') continue;
      if (UNIT.test(nxt)) continue;
      if (this._nounOnly[nxt] && !/s$/.test(nxt) && !this._uncountSet[nxt]) out.push(toks[i] + ' ' + toks[i + 1]);
    }
    /* one of the + 单数 */
    for (var j = 0; j < toks.length - 3; j++) {
      if (toks[j].toLowerCase() === 'one' && toks[j + 1].toLowerCase() === 'of' &&
        toks[j + 2].toLowerCase() === 'the' && this._nounOnly[toks[j + 3].toLowerCase()] &&
        !/s$/.test(toks[j + 3].toLowerCase())) out.push('one of the ' + toks[j + 3]);
    }
    return out;
  },

  _r5_prep: function (text) {
    var out = [];
    for (var i = 0; i < this._prepErr.length; i++) {
      var e = this._prepErr[i];
      e.re.lastIndex = 0;
      var m = e.re.exec(text);
      if (m) out.push(m[0] + ' → ' + e.want);
    }
    return out;
  },

  _r6_fragment: function (sent, toks) {
    var low = sent.toLowerCase().trim();
    if (/\?$/.test(low)) return [];
    /* 介词短语开头不是从句 */
    if (/^(because of|due to|despite|in spite of|as a result of|thanks to|instead of|owing to|in terms of|according to)\b/.test(low)) return [];
    var SUB = /^(because|although|though|while|if|when|since|which|that|who|whereas|unless|as long as|even though|even if|where|whose|whom)$/;
    var first = (toks[0] || '').toLowerCase();
    if (!SUB.test(first)) {
      /* ② 全句没有任何限定动词（≥5 词） */
      if (toks.length >= 5) {
        var anyV = false;
        for (var k = 0; k < toks.length; k++) { if (this.isFiniteVerb(toks[k].toLowerCase())) { anyV = true; break; } }
        if (!anyV) return [sent.slice(0, 40)];
      }
      return [];
    }
    /* ① 从属连词开头，但全句只有一个限定动词 → 片段 */
    var nv = 0;
    for (var i = 0; i < toks.length; i++) { if (this.isFiniteVerb(toks[i].toLowerCase())) nv++; }
    if (nv <= 1) return [sent.slice(0, 40)];
    return [];
  },

  _r7_runon: function (sent, toks) {
    var low = sent.toLowerCase();
    if (toks.length < 20) return [];
    if (/;/.test(sent)) return [];
    if (/\b(and|but|so|or|yet|for|nor)\b/.test(low)) return [];
    if (/\b(however|therefore|moreover|besides|in addition|for example|for instance|thus|consequently)\b/.test(low)) return [];
    /* 按逗号切块，数「有主语 + 限定动词」的块 */
    var chunks = sent.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
    if (chunks.length < 2) return [];
    var full = 0;
    for (var i = 0; i < chunks.length; i++) {
      var t = this.words(chunks[i]).map(function (x) { return x.toLowerCase(); });
      if (t.length < 3) continue;
      var hasSubj = false, hasVerb = false;
      for (var j = 0; j < t.length; j++) {
        if (/^(i|you|he|she|it|we|they|this|that|these|those|there|people|students)$/.test(t[j]) || this._nounOnly[t[j]]) hasSubj = true;
        if (this.isFiniteVerb(t[j])) hasVerb = true;
      }
      if (hasSubj && hasVerb) full++;
    }
    return full >= 2 ? [sent.slice(0, 50)] : [];
  },

  _r8_form: function (toks) {
    var out = [];
    for (var i = 0; i < toks.length - 1; i++) {
      var w = toks[i].toLowerCase(), nxt = toks[i + 1].toLowerCase();
      /* very + 纯动词（I very like it）—— 高精度 */
      if (w === 'very' && this._verbOnly[nxt]) out.push('very ' + toks[i + 1]);
      /* make/let + 宾语 + to + 动词（make me to go）—— 高精度 */
      if ((w === 'make' || w === 'let' || w === 'made') && /^(me|him|her|us|them|you|it)$/.test(nxt) &&
        (toks[i + 2] || '').toLowerCase() === 'to') out.push(toks[i] + ' ' + toks[i + 1] + ' to');
      /* 「冠词 + 名词」和「介词 + 形容词」这两条不做了：
         "the lesson" / "of mobile phones" 都是正确英语，之前误报太多。 */
    }
    return out;
  },

  /* 编辑距离 ≤1（只看替换/插入/删除各一次） */
  _nearDict: function (w) {
    if (!this._dictSet || w.length < 6) return false;
    var bucket = this._buckets[w.charAt(0)] || [];
    for (var i = 0; i < bucket.length; i++) {
      var d = bucket[i];
      if (Math.abs(d.length - w.length) > 1) continue;
      if (d === w) return false;
      if (this._edit1(w, d)) return true;
    }
    return false;
  },

  _edit1: function (a, b) {
    var la = a.length, lb = b.length;
    if (la === lb) {
      var diff = 0;
      for (var i = 0; i < la; i++) { if (a.charAt(i) !== b.charAt(i)) { if (++diff > 1) return false; } }
      return diff === 1;
    }
    if (Math.abs(la - lb) !== 1) return false;
    var s = la < lb ? a : b, l = la < lb ? b : a;
    var i2 = 0, j2 = 0, skipped = 0;
    while (i2 < s.length && j2 < l.length) {
      if (s.charAt(i2) === l.charAt(j2)) { i2++; j2++; continue; }
      if (++skipped > 1) return false;
      j2++;
    }
    return true;
  },

  _r9_spell: function (toks, rawToks) {
    var out = [];
    var WHITE = /^(email|emails|online|website|websites|smartphone|smartphones|app|apps|internet|blog|blogs|video|videos|photo|photos|wechat|weibo|alipay|taobao|covid|ai|ok|okay|tv|pc|cet|cet4|cet6|siheyuan|dumpling|dumplings|kungfu|taiji|qipao|hanfu|yuan|renminbi|jin|mu|li|hutong|guangdong|sichuan|beijing|shanghai|china|chinese|english|american|british|european|asian|african|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december)$/i;
    for (var i = 0; i < toks.length; i++) {
      var raw = rawToks[i];
      var w = toks[i].toLowerCase();
      if (w.length < 4) continue;
      if (this._funcSet[w] || this.LEX.IRREG[w] || WHITE.test(w)) continue;
      if (/^[A-Z]{2,}$/.test(raw)) continue;          /* 全大写缩写 */
      if (/^[A-Z]/.test(raw) && i > 0) continue;      /* 句中大写多半是专有名词 */
      if (!this._dictSet) continue;
      if (this._dictSet[w] || this._dictSet[this.lemma(w)]) continue;
      if (this._nearDict(w)) out.push(raw);
    }
    return out;
  },

  _r10_mech: function (raw, sents, paras) {
    var out = [];
    var dbl = raw.match(/\b([A-Za-z]+)\s+\1\b/gi) || [];
    dbl.forEach(function (x) { out.push('重复词 ' + x); });
    var noSpace = raw.match(/[,;:!?][A-Za-z]/g) || [];
    /* 偶发一两处算笔误；整篇都没有空格是复制/排版问题，不扣语言分 */
    if (noSpace.length < Math.max(3, sents.length * 0.5)) {
      noSpace.forEach(function (x) { out.push('标点后缺空格 ' + x); });
    }
    var spBefore = raw.match(/\s+[,.!?]/g) || [];
    spBefore.forEach(function (x) { out.push('标点前有空格'); });
    for (var i = 1; i < sents.length; i++) {
      if (/^[a-z]/.test(sents[i])) { out.push('句首小写 ' + sents[i].slice(0, 20)); break; }
    }
    var bareI = raw.match(/\bi\b/g) || [];
    if (bareI.length) out.push('小写 i ×' + bareI.length);
    if (/[，。；：！？、]/.test(raw)) out.push('混入中文标点');
    if (/ {2,}/.test(raw)) out.push('连续空格');
    paras.forEach(function (p) {
      var tail = p.replace(/["')\]]+\s*$/, '');
      if (tail && !/[.!?]$/.test(tail)) out.push('段末缺标点');
    });
    return out;
  },

  /* ================= 特征提取 ================= */
  features: function (text, prompt, level) {
    this.init();
    var self = this;
    var rawOrig = String(text || '').replace(/\r/g, '');
    var raw = this.normPunct(rawOrig);
    var wordToks = this.words(raw);
    var n = wordToks.length;
    var lower = wordToks.map(function (w) { return w.toLowerCase(); });
    var lemmas = lower.map(function (w) { return self.lemma(w); });
    var sents = this.splitSents(raw);
    var paras = this.splitParas(raw);
    var minW = level === 'cet6' ? 150 : 120;

    /* --- 逐句规则 --- */
    var err = { mech: 0, sva: 0, tense: 0, art: 0, prep: 0, num: 0, frag: 0, runon: 0, form: 0, spell: 0 };
    var evidence = [];
    var cleanSents = 0;
    var sentToksList = sents.map(function (s) { return self.words(s); });

    for (var si = 0; si < sents.length; si++) {
      var st = sentToksList[si].map(function (x) { return x.toLowerCase(); });
      var hits = [];
      hits = hits.concat(this._r1_sva(st).map(function (x) { return ['sva', x]; }));
      hits = hits.concat(this._r2_tense(st, sents[si]).map(function (x) { return ['tense', x]; }));
      hits = hits.concat(this._r3_article(st).map(function (x) { return ['art', x]; }));
      hits = hits.concat(this._r4_number(st).map(function (x) { return ['num', x]; }));
      hits = hits.concat(this._r6_fragment(sents[si], st).map(function (x) { return ['frag', x]; }));
      hits = hits.concat(this._r7_runon(sents[si], st).map(function (x) { return ['runon', x]; }));
      hits = hits.concat(this._r8_form(st).map(function (x) { return ['form', x]; }));
      if (!hits.length) cleanSents++;
      hits.forEach(function (h) { err[h[0]]++; evidence.push({ type: h[0], src: h[1], sent: sents[si].slice(0, 80) }); });
    }
    this._r5_prep(raw).forEach(function (x) { err.prep++; evidence.push({ type: 'prep', src: x, sent: '' }); });
    this._r9_spell(lower, wordToks).forEach(function (x) { err.spell++; evidence.push({ type: 'spell', src: x, sent: '' }); });
    var mechList = this._r10_mech(rawOrig, sents, paras);
    err.mech = mechList.length;
    mechList.forEach(function (x) { evidence.push({ type: 'mech', src: x, sent: '' }); });

    /* 每百词归一：修掉「错误多的长作文被过度惩罚」和「7 个错封顶后多错不扣」 */
    function per100(c) { return n ? c * 100 / n : 0; }
    var errTotalW = 0.5 * per100(err.mech)
      + per100(err.sva) + per100(err.tense) + per100(err.art) + per100(err.prep)
      + per100(err.num) + per100(err.frag) * 1.2 + per100(err.runon) * 1.2
      + per100(err.form) * 0.8 + per100(err.spell) * 0.6;

    /* --- A 任务完成 --- */
    var ratio = n / minW;
    var lenFit;
    if (ratio < 0.5) lenFit = 0.15;
    else if (ratio < 0.8) lenFit = 0.15 + 0.35 * (ratio - 0.5) / 0.3;
    else if (ratio < 1.0) lenFit = 0.5 + 0.5 * (ratio - 0.8) / 0.2;
    else if (ratio <= 1.2) lenFit = 1;
    else if (ratio <= 1.6) lenFit = 1 - 0.15 * (ratio - 1.2) / 0.4;
    else lenFit = 0.7;

    var topic = this._topic(prompt, lemmas, paras, sents);
    var copyRatio = this._copyRatio(prompt, lemmas);

    /* --- C 词汇 --- */
    var uniq = {}, uniqN = 0;
    lemmas.forEach(function (w) { if (w && !uniq[w]) { uniq[w] = 1; uniqN++; } });
    var rttr = n ? uniqN / Math.sqrt(n) : 0;
    var mattr = this._mattr(lemmas, 50);
    var contentLemmas = lemmas.filter(function (w) { return w && !self._funcSet[w] && w.length > 2; });
    var advN = contentLemmas.filter(function (w) { return !self._commonSet[w]; }).length;
    var advRate = contentLemmas.length ? advN / contentLemmas.length : 0;
    var acadN = lower.filter(function (w) { return /(tion|sion|ity|ous|ment|ance|ence|ive|ical|ally)$/.test(w); }).length;
    var acadRate = n ? acadN / n : 0;
    var meanWlen = contentLemmas.length ? contentLemmas.reduce(function (a, w) { return a + w.length; }, 0) / contentLemmas.length : 0;
    var collocN = 0;
    this._collocRe.forEach(function (re) { re.lastIndex = 0; if (re.test(raw)) collocN++; });
    var collocRate = n ? collocN * 100 / n : 0;

    /* --- D 结构 --- */
    var lowText = ' ' + lower.join(' ') + ' ';
    var connCount = 0, connKinds = {}, connCats = {};
    this._connList.forEach(function (c) {
      var re = self._phraseRe(c.p);
      re.lastIndex = 0;
      var m = lowText.match(re);
      if (m) { connCount += m.length; connKinds[c.p] = 1; connCats[c.cat] = 1; }
    });
    var connRate = n ? connCount * 100 / n : 0;
    var connVariety = Math.min(1, Object.keys(connKinds).length / 8);
    var connCatCov = this._connCats.length ? Object.keys(connCats).length / this._connCats.length : 0;

    var paraFit = this._paraFit(paras);
    var thesis = this._thesis(topic, sents, connCats);

    /* --- E 句式 --- */
    var lens = sentToksList.map(function (t) { return t.length; }).filter(function (x) { return x > 0; });
    var avgLen = lens.length ? lens.reduce(function (a, b) { return a + b; }, 0) / lens.length : 0;
    var sd = lens.length ? Math.sqrt(lens.reduce(function (a, b) { return a + Math.pow(b - avgLen, 2); }, 0) / lens.length) : 0;
    var longRatio = lens.length ? lens.filter(function (x) { return x >= 25; }).length / lens.length : 0;
    var subN = 0;
    sents.forEach(function (s) {
      if (/\b(which|that|who|whom|whose|because|although|though|while|if|when|since|unless|where|as)\b/i.test(s)) subN++;
    });
    var subRate = sents.length ? subN / sents.length : 0;
    var patternN = this._patterns(raw);

    return {
      /* A */
      len_fit: lenFit, topic_cov: topic.cov, topic_cov_core: topic.core,
      topic_spread: topic.spread, off_topic: topic.off ? 1 : 0, copy_ratio: copyRatio,
      /* B */
      err_mech_100: per100(err.mech), err_sva_100: per100(err.sva), err_tense_100: per100(err.tense),
      err_art_100: per100(err.art), err_prep_100: per100(err.prep), err_num_100: per100(err.num),
      err_frag_100: per100(err.frag), err_runon_100: per100(err.runon), err_form_100: per100(err.form),
      err_spell_100: per100(err.spell), err_total_w: errTotalW,
      clean_sent_ratio: sents.length ? cleanSents / sents.length : 0,
      /* C */
      rttr: rttr, mattr50: mattr, adv_rate: advRate, acad_suffix_rate: acadRate,
      mean_wlen: meanWlen, colloc_rate: collocRate,
      /* D */
      conn_rate: connRate, conn_cat_cov: connCatCov, conn_variety: connVariety,
      para_fit: paraFit, thesis_hit: thesis,
      /* E */
      sent_len_sd: sd, long_sent_ratio: longRatio, sub_rate: subRate, pattern_hits: patternN,
      /* 辅助（不进模型） */
      _n: n, _sent: sents.length, _para: paras.length, _ttr: n ? uniqN / n : 0,
      _errs: err.mech + err.sva + err.tense + err.art + err.prep + err.num + err.frag + err.runon + err.form + err.spell,
      _evidence: evidence, _minW: minW, _err: err,
      _dup: (rawOrig.match(/\b([A-Za-z]+)\s+\1\b/gi) || []).length,
      _cjk: (rawOrig.match(/[\u4e00-\u9fa5]/g) || []).length
    };
  },

  /* 题面关键词覆盖：去套话 + lemma 归一 + 按题面词频加权 + 计数而非存在 */
  _topic: function (prompt, lemmas, paras, sents) {
    var STOP = { suppose: 1, university: 1, students: 1, student: 1, write: 1, essay: 1, composition: 1,
      word: 1, words: 1, direction: 1, directions: 1, according: 1, opinion: 1, express: 1, view: 1,
      should: 1, time: 1, minute: 1, minutes: 1, part: 1, allow: 1, allowed: 1, least: 1, most: 1,
      you: 1, your: 1, they: 1, their: 1, following: 1, statement: 1, base: 1, based: 1, write: 1 };
    var pw = this.words(prompt);
    if (!pw.length) return { cov: 0.6, core: 0.6, spread: 0.5, off: false, keys: [] };
    var pf = {};
    pw.forEach(function (w) {
      var l = w.toLowerCase();
      if (l.length < 3 || STOP[l] || this._funcSet[l]) return;
      var lm = this.lemma(l);
      if (lm.length < 3) return;
      pf[lm] = (pf[lm] || 0) + 1;
    }, this);
    var keys = Object.keys(pf).map(function (k) {
      return { w: k, wgt: 1 + Math.log(1 + pf[k]), core: !!(this._nounOnly[k] || this._verbSet[k]) };
    }, this).sort(function (a, b) { return b.wgt - a.wgt; }).slice(0, 8);

    if (!keys.length) return { cov: 0.6, core: 0.6, spread: 0.5, off: false, keys: [] };

    var cnt = {};
    lemmas.forEach(function (w) { cnt[w] = (cnt[w] || 0) + 1; });
    var sumW = 0, gotW = 0, coreKeys = keys.filter(function (k) { return k.core; }).slice(0, 4);
    keys.forEach(function (k) {
      sumW += k.wgt;
      gotW += k.wgt * Math.min(1, (cnt[k.w] || 0) / 2);
    });
    var cov = sumW ? gotW / sumW : 0;

    var coreSum = 0, coreGot = 0;
    coreKeys.forEach(function (k) {
      coreSum += k.wgt;
      coreGot += k.wgt * Math.min(1, (cnt[k.w] || 0) / 2);
    });
    var core = coreSum ? coreGot / coreSum : cov;

    /* 关键词跨段分布 */
    var hitParas = 0;
    paras.forEach(function (p) {
      var pl = this.words(p).map(function (x) { return this.lemma(x.toLowerCase()); }, this);
      for (var i = 0; i < keys.length; i++) {
        if (pl.indexOf(keys[i].w) !== -1) { hitParas++; return; }
      }
    }, this);
    var spread = paras.length ? Math.min(1, hitParas / Math.max(2, Math.min(paras.length, 3))) : 0;

    var total = lemmas.filter(function (w) { return w; }).length;
    var off = cov < 0.12 && total >= 60;
    return { cov: cov, core: core, spread: spread, off: off, keys: keys.map(function (k) { return k.w; }) };
  },

  /* 与题面的 n-gram 重合率：抄题不给分 */
  _copyRatio: function (prompt, lemmas) {
    var pw = this.words(prompt).map(function (w) { return this.lemma(w.toLowerCase()); }, this);
    if (pw.length < 5 || !lemmas.length) return 0;
    var grams = {};
    for (var i = 0; i + 2 < pw.length; i++) grams[pw[i] + ' ' + pw[i + 1] + ' ' + pw[i + 2]] = 1;
    var hit = 0;
    for (var j = 0; j + 2 < lemmas.length; j++) {
      if (grams[lemmas[j] + ' ' + lemmas[j + 1] + ' ' + lemmas[j + 2]]) hit++;
    }
    return lemmas.length > 3 ? hit / (lemmas.length - 2) : 0;
  },

  _mattr: function (lemmas, win) {
    if (!lemmas.length) return 0;
    if (lemmas.length <= win) {
      var u = {};
      lemmas.forEach(function (w) { u[w] = 1; });
      return Object.keys(u).length / lemmas.length;
    }
    var total = 0, cnt = 0;
    for (var i = 0; i + win <= lemmas.length; i++) {
      var u2 = {};
      for (var j = i; j < i + win; j++) u2[lemmas[j]] = 1;
      total += Object.keys(u2).length / win;
      cnt++;
    }
    return cnt ? total / cnt : 0;
  },

  _paraFit: function (paras) {
    if (!paras.length) return 0.2;
    var lens = paras.map(function (p) { return this.words(p).length; }, this);
    var total = lens.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return 0.2;
    var base;
    if (paras.length >= 3 && paras.length <= 5) base = 1;
    else if (paras.length === 2) base = 0.7;
    else if (paras.length === 1) base = 0.5;   /* 一段到底扣分，但不至于判成「结构很差」 */
    else base = 0.6;
    /* 段长均衡：只有一段时 maxShare 恒为 1，不该再叠加扣分 */
    var maxShare = Math.max.apply(null, lens) / total;
    var bal = paras.length === 1 ? 1 : (maxShare > 0.7 ? 0.6 : (maxShare > 0.55 ? 0.85 : 1));
    return base * bal;
  },

  _thesis: function (topic, sents, connCats) {
    if (!sents.length) return 0;
    var first = sents[0].toLowerCase();
    var last = sents[sents.length - 1].toLowerCase();
    var keys = topic.keys || [];
    var firstHit = keys.some(function (k) { return first.indexOf(k) !== -1; });
    var lastSum = !!(connCats.conclusion);
    if (firstHit && lastSum) return 1;
    if (firstHit || lastSum) return 0.5;
    return 0;
  },

  _patterns: function (raw) {
    var n = 0;
    if (/\bonly\s+(in\s+this\s+way|by\s+doing\s+so|then)\b[^.]*\b(can|could|will|do|does)\b/i.test(raw)) n++;
    if (/\bnot\s+only\b[^.]{0,80}\bbut\s+also\b/i.test(raw)) n++;
    if (/\bnever\s+(have|has|had)\b/i.test(raw)) n++;
    if (/(^|[.!?]\s+)(faced|given|compared|considering|regarding|judging)\s+(with|by|to|that)\b/i.test(raw)) n++;
    if (/\bit\s+is\s+\w+\s+(that|to)\b/i.test(raw)) n++;
    if (/\bthere\s+is\s+no\s+(denying|doubt)\b/i.test(raw)) n++;
    return Math.min(5, n);
  },

  /* ================= 打分 ================= */
  /* 33 维原始特征高度共线，直接回归会被符号投影清零。先聚成 10 个子分，
     每个子分内部权重固定（教育学依据），回归只学子分之间的组合。
     注意：这里的聚合必须和 scripts/calibrate.js 的 derive() 完全一致。 */
  _derive: function (f) {
    function cl(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    return {
      len: f.len_fit,
      topic: 0.7 * f.topic_cov + 0.3 * f.topic_cov_core,
      spread: f.topic_spread,
      off: f.off_topic,
      copy: f.copy_ratio,
      lex: 0.35 * cl((f.rttr - 4) / 6, 0, 1) + 0.25 * cl(f.adv_rate * 4, 0, 1)
        + 0.2 * cl(f.acad_suffix_rate * 8, 0, 1) + 0.2 * cl(f.colloc_rate / 2, 0, 1),
      acc: cl(1 - f.err_total_w / 12, 0, 1),
      clean: f.clean_sent_ratio,
      coh: 0.3 * f.conn_cat_cov + 0.2 * f.conn_variety + 0.3 * f.para_fit + 0.2 * f.thesis_hit,
      /* 句式多样：以「从属句占比」为主 —— 把复合句拆成短句会直接压低它。
         标准差只做倒 U 的小权重（sd≈4 最好），否则「拆句」会让 sd 变大反而加分。 */
      syn: 0.50 * cl(f.sub_rate, 0, 1) + 0.35 * cl(f.pattern_hits / 2, 0, 1)
        + 0.15 * cl(1 - Math.abs(f.sent_len_sd - 4) / 6, 0, 1)
    };
  },

  _dim: function (feat, which) {
    var C = this.COEF;
    if (!C || !C.groups || !C.groups[which]) return null;
    var g = C.groups[which];
    var d = this._derive(feat);
    var z = 0;
    for (var i = 0; i < g.keys.length; i++) {
      if (!g.beta[i]) continue;
      var v = d[g.keys[i]];
      if (typeof v !== 'number') continue;
      var zi = (v - g.mean[i]) / (g.sd[i] || 1);
      if (zi > 4) zi = 4; else if (zi < -4) zi = -4;
      z += g.beta[i] * zi;
    }
    return this.clamp(1 + 4 * (1 / (1 + Math.exp(-z))), 1, 5);
  },

  /* 未校准时的手调初值：同一套子分，权重按 CET 阅卷经验给 */
  _dimDefault: function (feat, which) {
    var d = this._derive(feat);
    var s;
    if (which === 'content') {
      s = 0.5 * d.len + 0.3 * d.topic + 0.1 * d.spread + 0.1 * (1 - Math.min(1, d.copy * 2));
      if (d.off) s = Math.min(s, 0.25);
    } else if (which === 'language') {
      s = 0.55 * d.lex + 0.35 * d.acc + 0.10 * d.clean;
    } else {
      s = 0.6 * d.coh + 0.4 * d.syn;
    }
    return this.clamp(1 + 4 * this.clamp(s, 0, 1), 1, 5);
  },

  score: function (feat) {
    var c = this._dim(feat, 'content') || this._dimDefault(feat, 'content');
    var l = this._dim(feat, 'language') || this._dimDefault(feat, 'language');
    var o = this._dim(feat, 'organization') || this._dimDefault(feat, 'organization');
    c = this.clamp(c, 1, 5); l = this.clamp(l, 1, 5); o = this.clamp(o, 1, 5);

    /* 权重 0.28/0.44/0.28：CET 阅卷是「整体印象 + 语言为主」，不是三维等权 */
    var T = 2 + 12 * (0.28 * c + 0.44 * l + 0.28 * o - 1) / 4;
    T = this.clamp(Math.round(T), 2, 14);

    /* 封顶（顺序执行，取最小值） */
    var ratio = feat._n / feat._minW;
    if (ratio < 0.5) T = Math.min(T, 4);
    else if (ratio < 0.75) T = Math.min(T, 8);
    else if (ratio < 0.9) T = Math.min(T, 10);
    if (feat._sent < 3) T = Math.min(T, 5);
    if (feat.off_topic) T = Math.min(T, 6);
    if (feat.err_total_w > 10) T = Math.min(T, 6);
    else if (feat.err_total_w > 6) T = Math.min(T, 8);
    if (l <= 2) T = Math.min(T, 8);
    /* 连续重复词是硬伤，出现 3 次以上直接压档 */
    if (feat._dup >= 3) T = Math.min(T, 7);
    /* 中文整段混进英文作文，阅卷会判不成文 */
    if (feat._cjk >= 8) T = Math.min(T, 7);

    /* 下限兜底：防好作文被低估 */
    if (feat.err_total_w < 0.5 && feat.len_fit >= 1 && feat.para_fit >= 0.6 && feat.sub_rate >= 0.2) {
      T = Math.max(T, 9);
    }
    return { total: T, c: c, l: l, o: o };
  },

  bandOf: function (t) {
    if (t >= 13) return '切题、语言流畅、结构清晰';
    if (t >= 11) return '切题、表达较连贯、少量错误';
    if (t >= 8) return '基本切题、语言错误较多';
    if (t >= 5) return '基本切题、仅句子可读';
    return '条理不清';
  },

  /* ================= 对外：作文 ================= */
  essay: function (text, prompt, level) {
    this.init();
    var feat = this.features(text, prompt, level);
    var s = this.score(feat);
    var n = feat._n, minW = feat._minW;
    var maxW = level === 'cet6' ? 200 : 180;

    /* 逐句点评：从证据里挑最值得改的（最多 4 条，含 1 条好的） */
    var TYPE_CN = {
      sva: '主谓一致', tense: '时态', art: '冠词', prep: '介词搭配', num: '名词单复数',
      frag: '句子不完整', runon: '逗号粘连', form: '词形/词性', spell: '拼写', mech: '标点与格式'
    };
    var tips = [];
    var seen = {};
    feat._evidence.forEach(function (e) {
      if (tips.length >= 4) return;
      var key = e.type + '|' + (e.sent || e.src).slice(0, 24);
      if (seen[key]) return;
      seen[key] = 1;
      tips.push({
        src: (e.sent || e.src).slice(0, 90),
        type: 'fix',
        fix: '',
        note: TYPE_CN[e.type] + '：' + String(e.src).slice(0, 60)
      });
    });
    if (!tips.length) {
      tips.push(n >= minW * 0.8
        ? { src: '', type: 'good', fix: '', note: '没有检测到主谓一致、时态、冠词、拼写等常见错误。' }
        : { src: '', type: 'fix', fix: '', note: '篇幅偏短（' + n + ' 词，目标 ' + minW + ' 词以上），先写够长度再谈语言质量。' });
    }

    var upgrade = [];
    if (s.c < 3.5) {
      upgrade.push('内容：目标 ' + minW + '–' + maxW + ' 词，开头直接回应题目；' +
        (feat.topic_cov < 0.3 ? '题目关键词几乎没出现，容易判为偏题。' : '把题目的核心词自然复述一遍，确保切题。'));
    }
    if (s.l < 3.5) {
      var worst = Object.keys(feat._err).filter(function (k) { return feat._err[k] > 0; })
        .sort(function (a, b) { return feat._err[b] - feat._err[a]; })[0];
      upgrade.push('语言：' + (worst ? '「' + TYPE_CN[worst] + '」出现 ' + feat._err[worst] + ' 处，优先改这类；'
        : '') + '用同义表达替换重复词，避免同一句式连着用。');
    }
    if (s.o < 3.5) {
      upgrade.push('结构：分 3 段（引入—论证—总结），用 however / moreover / therefore / in conclusion 串起来。');
    }
    if (!upgrade.length) upgrade.push('整体不错：继续补充具体例子，避免空泛口号。');
    upgrade.push('本地评分看的是语言特征，评不了立意与论证深度；要逐句改写和范文，用「AI 批改」。');

    var dim = {
      content: '共 ' + n + ' 词（目标 ' + minW + '–' + maxW + '），' +
        (n >= minW ? '长度达标' : '偏短') +
        (feat.topic_cov > 0 ? '；题目关键词覆盖 ' + Math.round(feat.topic_cov * 100) + '%' : '') + '。',
      language: '词汇丰富度 ' + Math.round(feat._ttr * 100) + '%，高级词占比 ' +
        Math.round(feat.adv_rate * 100) + '%；检出 ' + feat._errs + ' 处问题（主谓/时态/冠词/拼写等）。',
      organization: feat._para + ' 段，连接词 ' + Math.round(feat.conn_rate) + '/百词，语义类别覆盖 ' +
        Math.round(feat.conn_cat_cov * 100) + '%，平均句长 ' +
        Math.round(feat._n / Math.max(1, feat._sent)) + ' 词，句长波动 ' + Math.round(feat.sent_len_sd) + '。'
    };

    return {
      score: s.total,
      band: this.bandOf(s.total),
      dimension: dim,
      sentences: tips,
      upgrade: upgrade,
      sample: '',
      sample_cn: '',
      offline: true,
      rubric: [
        { id: 'content', name: '任务完成', score: Math.round(s.c * 10) / 10, max: 5, note: dim.content },
        { id: 'language', name: '语言准确', score: Math.round(s.l * 10) / 10, max: 5, note: dim.language },
        { id: 'organization', name: '结构连贯', score: Math.round(s.o * 10) / 10, max: 5, note: dim.organization }
      ],
      stats: {
        words: n, sentences: feat._sent, paragraphs: feat._para,
        ttr: Math.round(feat._ttr * 100) / 100, errors: feat._errs
      }
    };
  },

  /* ================= 对外：翻译 ================= */
  trans: function (sourceCn, referenceEn, userText, level) {
    this.init();
    var cn = String(sourceCn || '');
    /* 去掉前置英文题目说明 */
    var m0 = /[\u4e00-\u9fa5]/.exec(cn);
    if (m0 && m0.index > 0) cn = cn.slice(m0.index);

    var units = this._cnUnits(cn);
    var user = String(userText || '');
    var userWords = this.words(user);
    var n = userWords.length;
    /* 学生译文的词形只算一次，别在单元循环里反复算 */
    var uLem = userWords.map(function (w) { return this.lemma(w.toLowerCase()); }, this);
    var ref = String(referenceEn || '').trim();
    var refOk = ref && ref.split(/\s+/).length <= 400 &&
      (ref.match(/[\u4e00-\u9fa5]/g) || []).length / ref.length < 0.05;

    /* 语言质量：复用作文的规则与词汇特征 */
    var feat = this.features(user, '', level);
    var lang01 = this.clamp((this._dim(feat, 'language') || this._dimDefault(feat, 'language')) / 5, 0, 1);

    var acc, diffs = [], stats = { units: units.length, words: n, mode: refOk ? 'ref' : 'noref' };

    if (refOk) {
      /* 有参考：中文单元 ↔ 英文句 单调对齐，算覆盖度 */
      var refSents = this.splitSents(ref);
      var totalCn = units.reduce(function (a, u) { return a + u.chars; }, 0) || 1;
      var refWordTotal = this.words(ref).length || 1;
      var accSum = 0, accW = 0;
      var cnAcc = 0, refAcc = 0;
      for (var ui = 0; ui < units.length; ui++) {
        var u = units[ui];
        cnAcc += u.chars;
        var target = cnAcc / totalCn * refWordTotal;
        var mapped = [];
        while (refAcc < target && mapped.length < refSents.length) {
          mapped.push(refSents[Math.min(mapped.length, refSents.length - 1)]);
          refAcc += this.words(mapped[mapped.length - 1]).length;
        }
        var refText = mapped.length ? mapped[mapped.length - 1] : (refSents[refSents.length - 1] || '');
        var rLem = this.words(refText).map(function (w) { return this.lemma(w.toLowerCase()); }, this)
          .filter(function (w) { return w && !this._funcSet[w] && w.length > 2; }, this);
        var hit = 0;
        rLem.forEach(function (w) { if (uLem.indexOf(w) !== -1) hit++; });
        var cov = rLem.length ? hit / rLem.length : 1;
        accSum += cov * u.chars;
        accW += u.chars;
        if (cov < 0.34) diffs.push({ type: '漏译', src: u.text.slice(0, 60), better: refText.slice(0, 90), note: '这一句的要点没有译出来' });
      }
      acc = accW ? accSum / accW : 0;

      /* 否定翻转：参考句有否定而学生片段没有 → 疑似误译（高精度） */
      var refNeg = /\b(not|no|never|none|nothing|nobody|neither|nor)\b/i.test(ref);
      var userNeg = /\b(not|no|never|none|nothing|nobody|neither|nor)\b/i.test(user);
      if (refNeg && !userNeg) diffs.push({ type: '疑似误译', src: '', better: '', note: '参考译文含否定，你的译文里没有否定，检查是否漏了否定含义' });
    } else {
      /* 无参考：只能评完整性与语言，不能假装能评准确度 */
      var cnChars = (cn.match(/[\u4e00-\u9fa5]/g) || []).length || 1;
      var expectWords = cnChars * 0.65;
      var lenFit = this.clamp(n / (expectWords || 1), 0, 1.2) / 1.2;
      var unitFit = units.length ? this.clamp(1 - Math.abs(this.splitSents(user).length - units.length) / Math.max(4, units.length), 0, 1) : 0.6;
      var gloss = (cn.match(/\(([a-zA-Z][a-zA-Z\s-]{1,20})\)/g) || []).map(function (x) { return x.replace(/[()]/g, '').trim(); });
      var glossHit = 1;
      if (gloss.length) {
        var lowU = user.toLowerCase();
        var gh = gloss.filter(function (g) { return lowU.indexOf(g.toLowerCase().split(/\s+/)[0]) !== -1; }).length;
        glossHit = gh / gloss.length;
      }
      acc = 0.5 * lenFit + 0.3 * unitFit + 0.2 * glossHit;
      if (unitFit < 0.5) diffs.push({ type: '疑似漏译', src: '', better: '', note: '中文 ' + units.length + ' 句，你的译文只有 ' + this.splitSents(user).length + ' 句，可能有整句漏译' });
      if (glossHit < 1) diffs.push({ type: '术语', src: gloss.filter(function (g) { return user.toLowerCase().indexOf(g.toLowerCase().split(/\s+/)[0]) === -1; }).join(' / '), better: '', note: '原文给出的英文术语没有用上' });
    }

    var rawScore = 2 + 12 * (0.6 * this.clamp(acc, 0, 1) + 0.4 * lang01);
    var total = this.clamp(Math.round(rawScore), 2, 14);
    if (!refOk) total = Math.min(total, 11);   /* 无参考时不给高分，避免虚高 */

    return {
      score: total,
      band: (refOk ? '' : '（本题无参考译文，只评语言与完整性）') + this.bandOf(total),
      diffs: diffs.slice(0, 6),
      revised: '',
      reference_note: '',
      offline: true,
      stats: stats
    };
  },

  /* 中文分句：按 。！？； 硬切，过短并入前句 */
  _cnUnits: function (cn) {
    var parts = String(cn || '').split(/[。！？；\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      var chars = (p.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (out.length && chars < 8) { out[out.length - 1].text += '，' + p; out[out.length - 1].chars += chars; }
      else out.push({ text: p, chars: chars });
    });
    return out;
  },

  /* 调试用：特征 + 证据 */
  detail: function (text, prompt, level) {
    var f = this.features(text, prompt, level);
    var s = this.score(f);
    return { features: f, score: s };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = Rubric;
