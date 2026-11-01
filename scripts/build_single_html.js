/* 把 app/ 打成一个可直接双击的 HTML（内联 CSS/JS/题库/听力） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

const read = rel => fs.readFileSync(path.join(APP, rel), 'utf8');
const inline = rel => '<script>\n' + read(rel).replace(/<\/script/gi, '<\\/script') + '\n</script>';

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="css/app.css">', function () { return '<style>\n' + read('css/app.css') + '\n</style>'; });
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '');

const order = ['flavor.js', 'js/app.js', 'js/ai.js', 'data/exam/audio.js', 'data/exam/dict.js', 'js/bank.js',
  'js/ui.js', 'js/exam.js', 'data/exam/templates.js', 'js/rubric_w.js', 'js/rubric.js', 'js/offline.js',
  'js/essay.js', 'js/trans.js', 'js/words.js', 'js/listen.js', 'js/me.js'];
const dataTags = inline('data/exam/bank.js') + '\n' + inline('data/exam/listening.js');

for (const f of order) {
  const tag = '<script src="' + f + '"></script>';
  if (html.indexOf(tag) === -1) throw new Error('找不到脚本标签: ' + f);
  let block = inline(f);
  if (f === 'js/bank.js') block += '\n' + dataTags;   // 题库紧跟加载器
  if (f === 'data/exam/audio.js') {
    block += '\n<script>if(location.protocol==="file:"){Object.keys(window.CET_AUDIO||{}).forEach(function(k){' +
      'window.CET_AUDIO[k]="../app/audio/"+k+".mp3";});}</script>';
  }
  html = html.replace(tag, function () { return block; });   // 用函数：避免 $& / $' 被当作替换模式
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'guoji-preview.html');
fs.writeFileSync(out, html);
console.log('已生成 ' + out + '  ' + (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
