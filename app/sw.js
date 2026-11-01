/* 过级 Service Worker：缓存外壳与题库索引；单套题目运行时缓存，离线可开已做过的卷 */
var VER = 'cet-v39';
var SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/ai.js',
  './js/bank.js',
  './js/ui.js',
  './js/exam.js',
  './js/rubric_w.js',
  './js/rubric.js',
  './js/offline.js',
  './js/essay.js',
  './js/trans.js',
  './js/words.js',
  './js/me.js',
  './js/listen.js',
  './data/exam/audio.js',
  './data/exam/index.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VER).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});   // 单个资源缺失不阻塞安装
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 外壳与题库：缓存命中立即返回并后台更新；题库单套 JSON 首次访问写入缓存 */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  /* 内置录音单套约 10MB，不进缓存（播放走浏览器 HTTP 缓存）；
     Range 请求也不缓存，避免只存到半段音频 */
  if (/\/audio\//.test(url.pathname) || req.headers.get('range')) return;
  e.respondWith(
    caches.open(VER).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
