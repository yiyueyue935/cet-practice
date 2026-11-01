/* 过级 · 数据层：本机存储（localStorage），无账号、无上传。
   进度 / 错题 / 生词 / 作文批改 / 翻译批改 全部只存本机。 */
var Store = {
  P: 'cet_progress_v1',
  W: 'cet_wrong_v1',
  V: 'cet_words_v1',
  E: 'cet_essays_v1',
  T: 'cet_trans_v1',
  S: 'cet_settings_v1',
  AI: 'cijing_ai_v1',            // AI 配置沿用旧键，老用户无需重填

  _get: function (k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; }
  },
  _set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },

  /* ---------- 设置 ---------- */
  settings: function () {
    var s = this._get(this.S, {}) || {};
    if (!s.level) s.level = 'cet4';
    if (!s.scale) s.scale = 1;
    return s;
  },
  saveSettings: function (s) { this._set(this.S, s); },

  /* ---------- 做题进度 ----------
     { "<setId>": { A:{done,total,right,ts}, B:{...}, C1:{...}, C2:{...}, last:"..." } } */
  progressAll: function () { return this._get(this.P, {}) || {}; },
  progress: function (setId) { return this.progressAll()[setId] || null; },
  saveSection: function (setId, sec, total, right) {
    var all = this.progressAll();
    var rec = all[setId] || {};
    var prev = rec[sec];
    if (!prev || right >= prev.right) rec[sec] = { total: total, right: right, done: true, ts: Date.now() };
    rec.last = new Date().toISOString().slice(0, 10);
    all[setId] = rec;
    this._set(this.P, all);
    return rec;
  },
  setDone: function (setId) {
    var rec = this.progress(setId);
    if (!rec) return false;
    return !!(rec.A && rec.B && (rec.C1 || rec.C2));
  },
  setRate: function (setId) {
    var rec = this.progress(setId);
    if (!rec) return null;
    var total = 0, right = 0;
    ['A', 'B', 'C1', 'C2'].forEach(function (k) {
      if (rec[k] && rec[k].done) { total += rec[k].total; right += rec[k].right; }
    });
    return total ? { total: total, right: right, rate: right / total } : null;
  },

  /* ---------- 错题本 ---------- */
  wrongAll: function () { return this._get(this.W, {}) || {}; },
  wrongList: function () {
    var all = this.wrongAll(), out = [];
    Object.keys(all).forEach(function (k) { out.push(all[k]); });
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out;
  },
  wrongAdd: function (q) {
    var all = this.wrongAll();
    all[q.id] = q;
    this._set(this.W, all);
  },
  wrongRemove: function (id) {
    var all = this.wrongAll();
    delete all[id];
    this._set(this.W, all);
  },
  wrongClear: function () { this._set(this.W, {}); },

  /* ---------- 生词本 ---------- */
  wordsAll: function () { return this._get(this.V, {}) || {}; },
  wordsList: function () {
    var all = this.wordsAll(), out = [];
    Object.keys(all).forEach(function (w) { var r = all[w]; r.w = w; out.push(r); });
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out;
  },
  wordAdd: function (w, t, src, cat) {
    w = String(w || '').trim();
    if (!w) return;
    var all = this.wordsAll();
    if (!all[w]) all[w] = { t: t || '', src: src || '', cat: cat || src || '未分类', ts: Date.now() };
    else {
      if (t && !all[w].t) all[w].t = t;
      if (cat) all[w].cat = cat;
      if (!all[w].cat) all[w].cat = src || '未分类';
    }
    this._set(this.V, all);
  },
  wordSetCat: function (w, cat) {
    var all = this.wordsAll();
    if (!all[w]) return;
    all[w].cat = cat || '未分类';
    this._set(this.V, all);
  },
  wordRemove: function (w) {
    var all = this.wordsAll();
    delete all[w];
    this._set(this.V, all);
  },
  wordHas: function (w) { return !!this.wordsAll()[w]; },

  /* ---------- 作文批改记录 ---------- */
  essays: function () { return this._get(this.E, []) || []; },
  essayAdd: function (rec) {
    var a = this.essays();
    a.unshift(rec);
    if (a.length > 60) a = a.slice(0, 60);
    this._set(this.E, a);
  },
  essayRemove: function (ts) {
    this._set(this.E, this.essays().filter(function (r) { return r.ts !== ts; }));
  },

  /* ---------- 翻译批改记录 ---------- */
  transList: function () { return this._get(this.T, []) || []; },
  transAdd: function (rec) {
    var a = this.transList();
    a.unshift(rec);
    if (a.length > 60) a = a.slice(0, 60);
    this._set(this.T, a);
  },
  transRemove: function (ts) {
    this._set(this.T, this.transList().filter(function (r) { return r.ts !== ts; }));
  },

  /* ---------- 统计 ---------- */
  stats: function () {
    var p = this.progressAll();
    var ids = Object.keys(p), done = 0, total = 0, right = 0;
    ids.forEach(function (id) {
      var rec = p[id], t = 0, r = 0;
      ['A', 'B', 'C1', 'C2'].forEach(function (k) {
        if (rec[k] && rec[k].done) { t += rec[k].total; r += rec[k].right; }
      });
      if (t) { total += t; right += r; }
      if (rec.A && rec.B && (rec.C1 || rec.C2)) done++;
    });
    return {
      setsTouched: ids.length,
      setsDone: done,
      questions: total,
      right: right,
      rate: total ? right / total : 0,
      words: Object.keys(this.wordsAll()).length,
      wrong: Object.keys(this.wrongAll()).length,
      essays: this.essays().length,
      trans: this.transList().length
    };
  },

  /* ---------- 备份 ----------
     只导出学习记录；AI 地址与密钥存在 Store.AI 里，永远不外带。
     v2 比 v1 多了 app 标识与 note，导入仍兼容 v1。 */
  BACKUP_APP: 'guoji',
  BACKUP_VER: 2,

  exportJSON: function () {
    return JSON.stringify({
      app: this.BACKUP_APP,
      v: this.BACKUP_VER,
      exportedAt: new Date().toISOString(),
      note: '只含本机学习记录，不含 AI 地址与密钥',
      settings: this.settings(),
      progress: this.progressAll(),
      wrong: this.wrongAll(),
      words: this.wordsAll(),
      essays: this.essays(),
      trans: this.transList()
    }, null, 2);
  },

  /* 导入：先整体校验，全部通过才落盘，避免导到一半把现有数据弄坏。
     返回各项条数，供界面提示。 */
  importJSON: function (text) {
    var raw = String(text == null ? '' : text).replace(/^\uFEFF/, '').trim();
    if (!raw) throw new Error('文件是空的');
    var d;
    try { d = JSON.parse(raw); } catch (e) { throw new Error('不是合法的 JSON 文件'); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('备份文件内容不对');
    if (d.app && d.app !== this.BACKUP_APP) throw new Error('这不是「过级」的备份文件');
    if (d.v !== 1 && d.v !== this.BACKUP_VER) throw new Error('备份版本不支持（v=' + d.v + '）');

    var isObj = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
    var isArr = function (x) { return Array.isArray(x); };
    var plan = [];
    var pick = function (key, field, test, name) {
      var v = d[field];
      if (v == null) return;
      if (!test(v)) throw new Error('备份里的「' + name + '」格式不对');
      plan.push([key, v]);
    };
    pick(this.P, 'progress', isObj, '进度');
    pick(this.W, 'wrong', isObj, '错题');
    pick(this.V, 'words', isObj, '生词');
    pick(this.E, 'essays', isArr, '作文记录');
    pick(this.T, 'trans', isArr, '翻译记录');
    if (!plan.length) throw new Error('备份里没有任何学习记录');

    /* 设置只回填已知字段，别把陌生字段写进来 */
    if (isObj(d.settings)) {
      var cur = this.settings();
      if (d.settings.level === 'cet4' || d.settings.level === 'cet6') cur.level = d.settings.level;
      if (typeof d.settings.scale === 'number') cur.scale = d.settings.scale;
      this.saveSettings(cur);
    }

    var self = this;
    plan.forEach(function (p) { self._set(p[0], p[1]); });

    return {
      progress: Object.keys(d.progress || {}).length,
      wrong: Object.keys(d.wrong || {}).length,
      words: Object.keys(d.words || {}).length,
      essays: (d.essays || []).length,
      trans: (d.trans || []).length
    };
  },

  /* ---------- 阅读分值（四级/六级同权重） ----------
     选词填空 3.55×10 = 35.5；段落匹配 7.1×10 = 71；仔细阅读 14.2×10 = 142；合计 248.5 */
  WEIGHT: { banked_cloze: 3.55, paragraph_matching: 7.1, careful_reading: 14.2 },
  scoreOf: function (type, rightCount) { return (this.WEIGHT[type] || 0) * rightCount; }
};

/* 小工具 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDate(ts) {
  var d = new Date(ts);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
