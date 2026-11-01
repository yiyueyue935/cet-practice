/* 过级 · 题库加载层
   index.json 列出所有套卷；单套 JSON 按需 fetch，首次读入后缓存进内存
   （Service Worker 会把它缓存到本地，之后离线可开）。 */
var Bank = {
  BASE: 'data/exam/',
  _index: null,
  _cache: {},

  /* file:// 双击打开时浏览器禁用 fetch，只能退回打包产物；
     网页版不预载 bank.js（12MB），首屏只读 index.json + 按需取单套 */
  _isFile: function () { return typeof location !== 'undefined' && location.protocol === 'file:'; },
  loadScript: function (src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('资源加载失败：' + src)); };
      document.head.appendChild(s);
    });
  },

  loadIndex: function () {
    var self = this;
    if (self._index) return Promise.resolve(self._index);
    if (window.CET_INDEX) {
      self._index = window.CET_INDEX;
      return Promise.resolve(self._index);
    }
    if (self._isFile()) {
      return self.loadScript(self.BASE + 'bank.js').then(function () {
        if (!window.CET_INDEX) throw new Error('题库目录缺失（bank.js 未包含索引）');
        self._index = window.CET_INDEX;
        return self._index;
      });
    }
    return fetch(self.BASE + 'index.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('题库目录读取失败（HTTP ' + r.status + '）');
        return r.json();
      })
      .then(function (data) {
        self._index = data;
        return data;
      });
  },

  sets: function (level) {
    if (!this._index) return [];
    var arr = this._index.sets || [];
    if (level) arr = arr.filter(function (s) { return s.level === level; });
    return arr;
  },

  /* 场次分组：按「YYYY年MM月」归并，原创模拟卷单独归到「原创模拟」 */
  MOCK_KEY: '原创模拟',
  groups: function (level) {
    var self = this, arr = this.sets(level), map = {}, order = [];
    arr.forEach(function (s) {
      var key = s.mock ? self.MOCK_KEY
        : (s.year + '年' + (s.month < 10 ? '0' + s.month : s.month) + '月');
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(s);
    });
    order.sort(function (a, b) {
      var am = a === self.MOCK_KEY, bm = b === self.MOCK_KEY;
      if (am !== bm) return am ? -1 : 1;      // 原创模拟排最前
      return b.localeCompare(a);              // 其余按时间倒序
    });
    return order.map(function (k) {
      return { key: k, title: k, mock: k === self.MOCK_KEY, sets: map[k] };
    });
  },

  get: function (id) {
    var self = this;
    if (self._cache[id]) return Promise.resolve(self._cache[id]);
    // 测试/离线兜底：window.CET_BANK 预置数据
    if (window.CET_BANK && window.CET_BANK[id]) {
      self._cache[id] = window.CET_BANK[id];
      return Promise.resolve(self._cache[id]);
    }
    if (self._isFile()) {
      return self.loadScript(self.BASE + 'bank.js').then(function () {
        if (window.CET_BANK && window.CET_BANK[id]) {
          self._cache[id] = window.CET_BANK[id];
          return self._cache[id];
        }
        throw new Error('套卷数据缺失：' + id);
      });
    }
    return fetch(self.BASE + id + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('套卷读取失败（HTTP ' + r.status + '）');
        return r.json();
      })
      .then(function (d) { self._cache[id] = d; return d; });
  },

  meta: function (id) {
    if (!this._index) return null;
    var hit = null;
    (this._index.sets || []).some(function (s) { if (s.id === id) { hit = s; return true; } return false; });
    return hit;
  },

  labelOf: function (s) {
    if (!s) return '';
    var lv = s.level === 'cet6' ? '六级' : '四级';
    if (s.mock) return '原创模拟 ' + lv + ' 第' + (s.set || '?') + '套';
    return s.year + '年' + s.month + '月 ' + lv + ' 第' + (s.set || '?') + '套';
  }
};
