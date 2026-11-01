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

  exportJSON: function () {
    return JSON.stringify({
      v: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings(),
      progress: this.progressAll(),
      wrong: this.wrongAll(),
      words: this.wordsAll(),
      essays: this.essays(),
      trans: this.transList()
    }, null, 2);
  },
  importJSON: function (text) {
    var d = JSON.parse(text);
    if (!d || d.v !== 1) throw new Error('文件格式不对');
    if (d.settings) this._set(this.S, d.settings);
    if (d.progress) this._set(this.P, d.progress);
    if (d.wrong) this._set(this.W, d.wrong);
    if (d.words) this._set(this.V, d.words);
    if (d.essays) this._set(this.E, d.essays);
    if (d.trans) this._set(this.T, d.trans);
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
