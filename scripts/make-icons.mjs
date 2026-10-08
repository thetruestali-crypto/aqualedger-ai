// Generates public/pwa-192x192.png and public/pwa-512x512.png:
// dark rounded background + cyan droplet (circle + triangle) + highlight.
// Pure Node (zlib), no imaging dependency.
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function roundedRectDist(x, y, S, r) {
  // Signed distance-ish: inside check for rounded rect [0,S]^2 radius r.
  const cx = Math.min(Math.max(x, r), S - r);
  const cy = Math.min(Math.max(y, r), S - r);
  const dx = x - cx;
  const dy = y - cy;
  if (x >= r && x <= S - r) return Math.min(y, S - y) >= 0 ? -1 : 1;
  if (y >= r && y <= S - r) return Math.min(x, S - x) >= 0 ? -1 : 1;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

function inDroplet(x, y, S) {
  const cx = S / 2;
  const cy = S * 0.58;
  const R = S * 0.22;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) return true;
  // Triangle: apex (cx, S*0.18), base half-width S*0.14 at y=S*0.52
  const apexY = S * 0.18;
  const baseY = S * 0.52;
  const halfW = S * 0.14;
  if (y < apexY || y > baseY) return false;
  const w = halfW * ((y - apexY) / (baseY - apexY));
  return Math.abs(x - cx) <= w;
}

function highlight(x, y, S) {
  const hx = S * 0.44;
  const hy = S * 0.56;
  const hr = S * 0.055;
  return (x - hx) ** 2 + (y - hy) ** 2 <= hr * hr;
}

function makeIcon(S) {
  const px = Buffer.alloc(S * S * 4);
  const BG = [2, 6, 23, 255];
  const CYAN = [34, 211, 238, 255];
  const LIGHT = [165, 243, 252, 255];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let c = BG;
      if (roundedRectDist(x + 0.5, y + 0.5, S, S * 0.22) > 0) c = [0, 0, 0, 0];
      else if (highlight(x + 0.5, y + 0.5, S)) c = LIGHT;
      else if (inDroplet(x + 0.5, y + 0.5, S)) c = CYAN;
      const o = (y * S + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
    }
  }
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

for (const S of [192, 512]) {
  writeFileSync(new URL(`../public/pwa-${S}x${S}.png`, import.meta.url), makeIcon(S));
  console.log(`wrote public/pwa-${S}x${S}.png`);
}
