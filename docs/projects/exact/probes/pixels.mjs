// Decode two PNGs to raw RGBA-ish scanlines (IHDR + inflated, unfiltered IDAT) and compare.
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
function decode(file) {
  const b = readFileSync(file); let o = 8; const idat = []; let w, h, bpp;
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString("ascii", o + 4, o + 8), data = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); const ct = data[9]; bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[ct] * (data[8] / 8); }
    if (type === "IDAT") idat.push(data); o += 12 + len; }
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(h * stride); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : (() => { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? up : c; })();
      cur[x] = (line[x] + p) & 255; } prev = cur; }
  return { w, h, out };
}
let differ = 0;
for (let i = 2; i < process.argv.length; i += 2) {
  const A = decode(process.argv[i]), B = decode(process.argv[i + 1]);
  let n = 0; if (A.w !== B.w || A.h !== B.h) n = -1; else for (let k = 0; k < A.out.length; k++) if (A.out[k] !== B.out[k]) n++;
  console.log(`${process.argv[i].split("/").pop()} ${A.w}x${A.h}: ${n === 0 ? "pixel-identical" : `${n} bytes differ`}`); if (n) differ++;
}
process.exit(differ ? 1 : 0);
