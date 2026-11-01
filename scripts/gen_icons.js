/* 生成「过级」PWA 应用图标（PNG，无第三方依赖：手写 PNG 编码器 + 程序化绘制书本轮廓） */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'app', 'icons');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- PNG 编码 ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function pngEncode(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 绘制 ---------- */
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BG_TOP = hex('#1B3168'), BG_BOT = hex('#081331');
const GOLD = hex('#FFD983'), LAV = hex('#A9AEFF'), WHITE = hex('#E5E8F0');

/* 四角星（星芒曲线 astroid）：|dx|^(2/3) + |dy|^(2/3) <= R^(2/3)，返回归一化 t（<=1 在星内） */
function starInside(x, y, cx, cy, R) {
  const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
  const a = Math.pow(dx, 2 / 3) + Math.pow(dy, 2 / 3);
  return a / Math.pow(R, 2 / 3);
}
function render(size, opts) {
  const SS = 3, S = size * SS;
  const buf = Buffer.alloc(size * size * 4);
  const corner = size * 0.225;
  const cx = S / 2, cy = S / 2, R = S * (opts.maskable ? 0.25 : 0.30);
  const tiny = [
    { x: 0.24, y: 0.22, r: 0.055, c: LAV },
    { x: 0.78, y: 0.30, r: 0.042, c: WHITE },
    { x: 0.72, y: 0.74, r: 0.050, c: LAV },
    { x: 0.24, y: 0.78, r: 0.034, c: WHITE }
  ];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const X = px * SS + sx + 0.5, Y = py * SS + sy + 0.5;
          /* 背景：垂直渐变 */
          const gt = Y / S;
          let br = BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * gt;
          let bg = BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * gt;
          let bb = BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * gt;
          let ba = 255;
          /* 圆角遮罩（any 用） */
          if (!opts.maskable) {
            const dx = Math.max(corner - X, X - (S - corner), 0);
            const dy = Math.max(corner - Y, Y - (S - corner), 0);
            if (dx > 0 && dy > 0 && dx * dx + dy * dy > corner * corner) ba = 0;
          }
          /* 主星 */
          let cr = br, cg = bg, cb = bb, ca = ba;
          const t = starInside(X, Y, cx, cy, R);
          if (t <= 1) { cr = GOLD[0]; cg = GOLD[1]; cb = GOLD[2]; }
          else if (t < 1.55) {
            const glow = 0.26 * (1.55 - t) / 0.55;
            cr = br + (GOLD[0] - br) * glow; cg = bg + (GOLD[1] - bg) * glow; cb = bb + (GOLD[2] - bb) * glow;
          }
          /* 点缀小星 */
          for (const s of tiny) {
            const ts = starInside(X, Y, s.x * S, s.y * S, S * s.r);
            if (ts <= 1) { cr = s.c[0]; cg = s.c[1]; cb = s.c[2]; break; }
          }
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS, i = (py * size + px) * 4;
      buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = Math.round(a / n);
    }
  }
  return buf;
}

const files = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-512-maskable.png', 512, { maskable: true }]
];
for (const [name, size, opts] of files) {
  const png = pngEncode(size, size, render(size, opts));
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(name, size + 'x' + size, png.length, 'bytes');
}
console.log('ICONS_OK');
