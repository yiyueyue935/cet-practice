/* 极简静态服务器：node scripts/serve.js [端口]
   只为本地开发用（题库走 fetch，直接双击 index.html 会退回 bank.js 打包产物）。 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const PORT = Number(process.argv[2] || process.env.PORT || 8765);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + rel); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('过级 → http://127.0.0.1:' + PORT + '/');
});
