// Erzeugt build/icon.png (512×512): dunkle, abgerundete Kachel mit leuchtendem Ring + Punkt (Betterfy-Logo).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const S = 512;
const px = Buffer.alloc(S * S * 4);
const c = (S - 1) / 2;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(1, v));

// Abgerundetes Quadrat (Signed Distance)
function roundRect(x, y, half, r) {
  const qx = Math.abs(x - c) - (half - r);
  const qy = Math.abs(y - c) - (half - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const sd = roundRect(x, y, 240, 112);
    const tileA = clamp(0.5 - sd); // weiche Kante
    // Hintergrund: dunkler Verlauf oben links → unten rechts
    const g = (x + y) / (2 * S);
    let r = mix(22, 8, g);
    let gg = mix(26, 10, g);
    let b = mix(32, 14, g);

    const d = Math.hypot(x - c, y - c);
    // Akzentfarbe: Mint → Cyan über den Winkel
    const ang = clamp((x + y) / (2 * S));
    const ar = mix(124, 92, ang);
    const ag = mix(232, 225, ang);
    const ab = mix(210, 255, ang);

    const ring = clamp(1 - Math.abs(d - 132) / 14); // Ring
    const dot = clamp(46 - d); // Punkt
    const glow = Math.exp(-((d - 132) ** 2) / (2 * 30 ** 2)) * 0.45 + Math.exp(-(d ** 2) / (2 * 60 ** 2)) * 0.35;
    const a = clamp(ring + dot);
    r = mix(r, ar, clamp(glow * 0.6));
    gg = mix(gg, ag, clamp(glow * 0.6));
    b = mix(b, ab, clamp(glow * 0.6));
    r = mix(r, ar, a);
    gg = mix(gg, ag, a);
    b = mix(b, ab, a);

    px[i] = Math.round(r);
    px[i + 1] = Math.round(gg);
    px[i + 2] = Math.round(b);
    px[i + 3] = Math.round(tileA * 255);
  }

// PNG schreiben
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c2 = n;
  for (let k = 0; k < 8; k++) c2 = c2 & 1 ? 0xedb88320 ^ (c2 >>> 1) : c2 >>> 1;
  return c2 >>> 0;
});
const crc = (buf) => {
  let c2 = 0xffffffff;
  for (const byte of buf) c2 = crcTable[(c2 ^ byte) & 0xff] ^ (c2 >>> 8);
  return (c2 ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6; // RGBA
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Icon geschrieben:', out);
