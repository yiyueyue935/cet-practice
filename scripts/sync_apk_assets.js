/* 同步 app/ 到 APK 工程两处（cap/www + android assets/public）
 * 策略：纯覆盖拷贝（不删除）+ 差异检测（报告 dst 有而 src 没有的残留文件）。
 * 正常迭代（app/ 不删文件）时零删除操作即可完成同步；出现差异残留时手动处理。 */
const fs = require('fs');
const path = require('path');

const WITH_AUDIO = process.argv.includes('--with-audio');
const AUDIO_LEVEL = (process.argv.find(a => a.indexOf('--audio-level=') === 0) || '').split('=')[1] || '';
const AUDIO_SRC = (process.argv.find(a => a.indexOf('--audio-src=') === 0) || '').split('=')[1] || '';

function walkList(root) {
  const out = [];
  (function rec(p, rel) {
    for (const f of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, f.name), r = rel ? rel + '/' + f.name : f.name;
      if (r === 'audio' && !WITH_AUDIO) continue;   // 默认不打包录音（586MB）；--with-audio 可打进 APK
      if (r === 'audio_opus') continue;             // Opus 版只通过 --audio-src 单独注入
      if (r === 'audio_opus') continue;             // Opus 版只通过 --audio-src 单独注入
      if (AUDIO_LEVEL && r.indexOf('audio/') === 0 && r.indexOf('audio/' + AUDIO_LEVEL + '-') !== 0) continue;  // 只带某级别
      if (f.isDirectory()) rec(fp, r);
      else out.push(r);
    }
  })(root, '');
  return out;
}

function cpOver(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const rel of walkList(src)) {
    const d = path.join(dst, rel);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(path.join(src, rel), d);
  }
}

function leftovers(src, dst) {
  const a = new Set(walkList(src));
  return walkList(dst).filter(r => !a.has(r));
}

const ROOT = path.join(__dirname, '..');
/* Capacitor cap sync 官方生成到 assets/public 的运行时文件，非残留 */
const WHITELIST = new Set(['cordova.js', 'cordova_plugins.js']);
cpOver(ROOT + '/app', ROOT + '/cap/www');
cpOver(ROOT + '/app', ROOT + '/cap/android/app/src/main/assets/public');

/* 外部音频目录（如 Opus 版）：整目录替换 APK 内 audio/，并覆盖 audio.js 指向对应扩展名 */
if (AUDIO_SRC) {
  const src = path.join(ROOT, AUDIO_SRC);
  const dst = ROOT + '/cap/android/app/src/main/assets/public/audio';
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    if (f === 'audio.js') continue;
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  const aj = path.join(src, 'audio.js');
  if (fs.existsSync(aj)) fs.copyFileSync(aj, ROOT + '/cap/android/app/src/main/assets/public/data/exam/audio.js');
}

const sw = fs.readFileSync(ROOT + '/cap/android/app/src/main/assets/public/sw.js', 'utf8');
const l1 = leftovers(ROOT + '/app', ROOT + '/cap/www');
const l2 = leftovers(ROOT + '/app', ROOT + '/cap/android/app/src/main/assets/public').filter(r => !WHITELIST.has(r));
console.log('sync done |', sw.match(/var VER[^;]+;/)[0]);
console.log('cap/www 残留:', l1.length ? l1.join(', ') : '无');
console.log('android assets 残留:', l2.length ? l2.join(', ') : '无');
if (l1.length || l2.length) process.exit(1);
