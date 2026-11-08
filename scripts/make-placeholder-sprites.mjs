// Generates placeholder 16x16 pixel-art PNGs into public/sprites/.
// The game only loads the PNG files, so real art can replace them with the same names.
// Usage: node scripts/make-placeholder-sprites.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/sprites/', import.meta.url);

const SLIME = [
  '................',
  '................',
  '................',
  '................',
  '......oooo......',
  '....oolllbboo...',
  '...olllbbbbbbo..',
  '..olwlbbbbbbbbo.',
  '..olbbbbbbbbbbo.',
  '.obbbkbbbbkbbbdo',
  '.obbbkbbbbkbbbdo',
  '.obbbbbbbbbbbbdo',
  '.obbbbbkkbbbbddo',
  '.odbbbbbbbbbbddo',
  '..oddddddddddoo.',
  '...oooooooooo...',
];

const CROWN = { 1: '.....y..y..y....', 2: '.....yy.yy.yy...', 3: '.....yyyyyyyy...' };
const KING = SLIME.map((row, i) => (CROWN[i] ? CROWN[i] : row));

const FIGHTER = [
  '......oooo......',
  '.....ohhhho.....',
  '....ohhhhhho....',
  '....ohssssho.w..',
  '....osksskso.w..',
  '....osssssso.w..',
  '.....osssso..w..',
  '...ooaaaaaaoow..',
  '..oaaarraaaaos..',
  '..osaarraaaaogg.',
  '...oaaaaaaaao...',
  '...orrrrrrrro...',
  '...orrroorrro...',
  '...oAAAooAAAo...',
  '...obbbo.obbbo..',
  '...oooo..oooo...',
];

const BASE = { o: '#1a1420', w: '#ffffff', k: '#1a1420', y: '#ffd23f' };
const slime = (b, l, d) => ({ ...BASE, b, l, d });

const SPRITES = {
  fighter: [FIGHTER, { ...BASE, h: '#7a4a2a', s: '#f2c79b', a: '#b8c4d6', A: '#5a6478', r: '#c0392b', b: '#6b3e1e', g: '#ffd23f', w: '#e8eef5' }],
  'slime-green': [SLIME, slime('#5cc85c', '#a8f0a0', '#2e8a3e')],
  'slime-blue': [SLIME, slime('#4a8ff0', '#9cc8ff', '#2a56a8')],
  'slime-mud': [SLIME, slime('#9a6a3a', '#c89a6a', '#5e3e1e')],
  'slime-red': [SLIME, slime('#e04848', '#ff9a8a', '#8e2424')],
  'slime-king': [KING, slime('#8a5ae0', '#c4a4ff', '#4e2e9a')],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Row ${y} has width ${row.length}, expected ${w}`);
    [...row].forEach((ch, x) => {
      const i = y * (w * 4 + 1) + 1 + x * 4;
      if (ch === '.') return;
      const hex = palette[ch];
      if (!hex) throw new Error(`No colour for '${ch}'`);
      raw[i] = parseInt(hex.slice(1, 3), 16);
      raw[i + 1] = parseInt(hex.slice(3, 5), 16);
      raw[i + 2] = parseInt(hex.slice(5, 7), 16);
      raw[i + 3] = 255;
    });
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, [rows, palette]] of Object.entries(SPRITES)) {
  writeFileSync(new URL(`${name}.png`, OUT), png(rows, palette));
  console.log(`wrote public/sprites/${name}.png`);
}
