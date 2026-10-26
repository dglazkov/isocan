/**
 * **An animated GIF, frame by frame** (motion phase 3;
 * `docs/projects/motion/design.md` §4) — the encoder behind the render
 * page's GIF, our own: a palette per frame, LZW, and the file around them.
 * About two hundred lines, so no dependency (`gifenc`, MIT, was the
 * alternative; it ships no types and does more than a motion needs).
 *
 * - **A palette per frame.** A frame with at most 256 colours keeps them
 *   exactly — flat vector art often has that few, and then nothing is lost.
 *   Past 256 (anti-aliased edges, a fade) the colours are cut to 256 by
 *   median cut over a 5-bit-a-channel histogram, each palette entry the mean
 *   of the real colours it stands for, every pixel mapped to the nearest.
 *   No dithering: on flat art it adds speckle and weight and no fidelity.
 * - **Only what changed.** Each frame after the first is the rectangle of
 *   pixels that differ from the frame before, drawn over it (disposal 1, "do
 *   not dispose"); a frame that changed nothing is one pixel. A decoder still
 *   shows a full picture for every frame — the frame count is the movie's.
 * - **It loops** (the NETSCAPE2.0 block, forever), as a video item does on
 *   the canvas; `renderedFrom.seconds` says how long one pass is.
 */

/** A growing byte buffer. */
class Bytes {
  private buf = new Uint8Array(1 << 16);
  length = 0;

  private room(n: number): void {
    if (this.length + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(b: number): void {
    this.room(1);
    this.buf[this.length++] = b;
  }

  u16(v: number): void {
    this.byte(v & 0xff);
    this.byte((v >> 8) & 0xff);
  }

  bytes(src: ArrayLike<number>): void {
    this.room(src.length);
    this.buf.set(src, this.length);
    this.length += src.length;
  }

  text(s: string): void {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  out(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** A frame's colours as at most 256 palette entries, and every pixel's index into them. */
interface Indexed {
  palette: Uint8Array; // 256 × RGB
  indices: Uint8Array;
}

/** The pixels of `rect` of an RGBA frame, as packed 0xRRGGBB. */
function regionRgb(rgba: Uint8ClampedArray, width: number, rect: Rect): Uint32Array {
  const out = new Uint32Array(rect.w * rect.h);
  let k = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    let i = (y * width + rect.x) * 4;
    for (let x = 0; x < rect.w; x++, i += 4) out[k++] = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
  }
  return out;
}

/** At most 256 colours, kept exactly; or `null` when there are more. */
function exact(rgb: Uint32Array): Indexed | null {
  const seen = new Map<number, number>();
  const indices = new Uint8Array(rgb.length);
  let last = -1, lastIndex = 0;
  for (let i = 0; i < rgb.length; i++) {
    const c = rgb[i]!;
    if (c !== last) {
      let n = seen.get(c);
      if (n === undefined) {
        if (seen.size === 256) return null;
        n = seen.size;
        seen.set(c, n);
      }
      last = c;
      lastIndex = n;
    }
    indices[i] = lastIndex;
  }
  const palette = new Uint8Array(768);
  for (const [c, n] of seen) {
    palette[n * 3] = c >> 16;
    palette[n * 3 + 1] = (c >> 8) & 0xff;
    palette[n * 3 + 2] = c & 0xff;
  }
  return { palette, indices };
}

const binOf = (c: number) => ((c >> 19) << 10) | (((c >> 11) & 0x1f) << 5) | ((c >> 3) & 0x1f);

/** Median cut to 256 colours over a 5-bit-a-channel histogram; each entry the mean of what it stands for. */
function cut(rgb: Uint32Array): Indexed {
  const count = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
  for (let i = 0; i < rgb.length; i++) {
    const c = rgb[i]!, b = binOf(c);
    count[b] = count[b]! + 1;
    sr[b] = sr[b]! + (c >> 16);
    sg[b] = sg[b]! + ((c >> 8) & 0xff);
    sb[b] = sb[b]! + (c & 0xff);
  }
  const occupied: number[] = [];
  for (let b = 0; b < 32768; b++) if (count[b]! > 0) occupied.push(b);
  const axis = (b: number, a: number) => (b >> (10 - a * 5)) & 0x1f;
  interface Box { bins: number[]; total: number; range: number; along: number }
  const boxOf = (bins: number[]): Box => {
    let total = 0, range = -1, along = 0;
    for (let a = 0; a < 3; a++) {
      let lo = 31, hi = 0;
      for (const b of bins) { const v = axis(b, a); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > range) { range = hi - lo; along = a; }
    }
    for (const b of bins) total += count[b]!;
    return { bins, total, range, along };
  };
  const boxes = [boxOf(occupied)];
  while (boxes.length < 256) {
    let pick = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      const score = box.bins.length > 1 ? box.total * (box.range + 1) : 0;
      if (score > best) { best = score; pick = i; }
    }
    if (pick < 0) break;
    const box = boxes[pick]!;
    const sorted = [...box.bins].sort((p, q) => axis(p, box.along) - axis(q, box.along));
    let acc = 0, at = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += count[sorted[i]!]!;
      at = i + 1;
      if (acc * 2 >= box.total) break;
    }
    boxes.splice(pick, 1, boxOf(sorted.slice(0, at)), boxOf(sorted.slice(at)));
  }
  const palette = new Uint8Array(768);
  boxes.forEach((box, n) => {
    let r = 0, g = 0, bl = 0;
    for (const b of box.bins) { r += sr[b]!; g += sg[b]!; bl += sb[b]!; }
    palette[n * 3] = Math.round(r / box.total);
    palette[n * 3 + 1] = Math.round(g / box.total);
    palette[n * 3 + 2] = Math.round(bl / box.total);
  });
  // Each occupied bin to the palette entry nearest its own mean colour.
  const lut = new Uint8Array(32768);
  for (const b of occupied) {
    const r = sr[b]! / count[b]!, g = sg[b]! / count[b]!, bl = sb[b]! / count[b]!;
    let near = 0, d = Infinity;
    for (let n = 0; n < boxes.length; n++) {
      const dr = palette[n * 3]! - r, dg = palette[n * 3 + 1]! - g, db = palette[n * 3 + 2]! - bl;
      const e = dr * dr + dg * dg + db * db;
      if (e < d) { d = e; near = n; }
    }
    lut[b] = near;
  }
  const indices = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) indices[i] = lut[binOf(rgb[i]!)]!;
  return { palette, indices };
}

interface Rect { x: number; y: number; w: number; h: number }

/** The rectangle of pixels that differ between two frames; one pixel when none do. */
function changed(prev: Uint8ClampedArray, next: Uint8ClampedArray, width: number, height: number): Rect {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    let i = y * width * 4;
    for (let x = 0; x < width; x++, i += 4) {
      if (prev[i] !== next[i] || prev[i + 1] !== next[i + 1] || prev[i + 2] !== next[i + 2]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: 1, h: 1 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * **An animated GIF.** `add` each frame's RGBA (the full picture, `width` ×
 * `height`) with its delay in hundredths of a second; `finish` returns the
 * file. `bytes` is how big it is so far, for a caller holding it to a cap.
 */
export class GifWriter {
  private readonly out = new Bytes();
  private prev: Uint8ClampedArray | null = null;
  // The LZW table, (prefix, byte) → code, kept across frames: an entry
  // counts only when its stamp is this table's generation, so a clear is
  // one increment rather than a megabyte of writes.
  private readonly codes = new Uint16Array(4096 * 256);
  private readonly stamps = new Uint32Array(4096 * 256);
  private generation = 0;

  constructor(private readonly width: number, private readonly height: number) {
    const o = this.out;
    o.text("GIF89a");
    o.u16(width);
    o.u16(height);
    o.byte(0x70); // no global colour table; 8 bits of colour resolution
    o.byte(0);
    o.byte(0);
    o.bytes([0x21, 0xff, 0x0b]);
    o.text("NETSCAPE2.0");
    o.bytes([0x03, 0x01, 0x00, 0x00, 0x00]); // loop forever
  }

  get bytes(): number {
    return this.out.length;
  }

  add(rgba: Uint8ClampedArray, delay: number): void {
    const rect = this.prev ? changed(this.prev, rgba, this.width, this.height) : { x: 0, y: 0, w: this.width, h: this.height };
    this.prev = rgba.slice();
    const rgb = regionRgb(rgba, this.width, rect);
    const { palette, indices } = exact(rgb) ?? cut(rgb);
    const o = this.out;
    o.bytes([0x21, 0xf9, 0x04, 0x04]); // graphic control: disposal 1 (keep), no transparency
    o.u16(delay);
    o.bytes([0x00, 0x00]);
    o.byte(0x2c);
    o.u16(rect.x);
    o.u16(rect.y);
    o.u16(rect.w);
    o.u16(rect.h);
    o.byte(0x87); // a local colour table of 256
    o.bytes(palette);
    this.lzw(indices);
  }

  finish(): Uint8Array {
    this.out.byte(0x3b);
    return this.out.out();
  }

  /** GIF's LZW, minimum code size 8, written as 255-byte sub-blocks. */
  private lzw(indices: Uint8Array): void {
    const o = this.out;
    o.byte(8);
    const clear = 256, eoi = 257;
    const block = new Uint8Array(255);
    let fill = 0, acc = 0, bits = 0;
    let size = 9, next = eoi + 1;
    const flush = () => {
      if (fill === 0) return;
      o.byte(fill);
      o.bytes(block.subarray(0, fill));
      fill = 0;
    };
    const emit = (code: number) => {
      acc |= code << bits;
      bits += size;
      while (bits >= 8) {
        block[fill++] = acc & 0xff;
        if (fill === 255) flush();
        acc >>>= 8;
        bits -= 8;
      }
    };
    const reset = () => {
      this.generation++;
      next = eoi + 1;
    };
    reset();
    emit(clear);
    let prefix = indices[0]!;
    for (let i = 1; i < indices.length; i++) {
      const c = indices[i]!;
      const key = (prefix << 8) | c;
      if (this.stamps[key] === this.generation) {
        prefix = this.codes[key]!;
        continue;
      }
      emit(prefix);
      if (next === 4096) {
        emit(clear);
        reset();
        size = 9;
      } else {
        // Widen BEFORE the entry that would not fit: the decoder widens as
        // it adds the same entry, one code later.
        if (next >= 1 << size) size++;
        this.codes[key] = next++;
        this.stamps[key] = this.generation;
      }
      prefix = c;
    }
    emit(prefix);
    emit(eoi);
    if (bits > 0) {
      block[fill++] = acc & 0xff;
      if (fill === 255) flush();
    }
    flush();
    o.byte(0);
  }
}
