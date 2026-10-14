import { crc32, deflateSync, inflateSync } from "node:zlib";
import type { TextImage } from "@isocan/core/jev";

/**
 * **The pictures a summary that looks at them sends** (Semantic Zoom design
 * §11, phase 3b): a picture's bytes, made ready for a model — at most
 * `PICTURE_SIDE` pixels on the long side — or nothing, said honestly.
 *
 * The home has no image library and no browser, and Semantic Zoom does not
 * add either: a PNG — what `isocan canvas shot` and a screen's render are —
 * is decoded and box-averaged down here with `node:zlib` alone; a JPEG, a
 * GIF or a WebP is measured from its header and sent as it is when it is
 * already small enough, and not sent at all when it is not (the summary then
 * names it by its title, and the prompt says so). What this refuses it
 * refuses by returning null, never by throwing: a picture that cannot be
 * sent is a title, not a failed summary.
 */

/** The long side a picture is sent at, at most (design §11). */
const PICTURE_SIDE = 1024;
/** Bytes a picture may be read from at all: anything bigger is a title. */
export const PICTURE_READ_MAX = 20 * 1024 * 1024;
/** Pixels a PNG may be decoded at: 25 MP is a 5000 × 5000 screenshot, about 100 MB of RGBA while it is scaled. */
const DECODE_MAX_PIXELS = 25_000_000;
/** Bytes one picture may go to a model at, under Claude's 5 MB a picture once in base64. */
const SEND_MAX_BYTES = 3_500_000;

/** A picture's width and height from its header, for the four formats a model takes; null when it cannot be read. */
function sizeOf(bytes: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType === "image/png") return bytes.length >= 24 && bytes.readUInt32BE(12) === 0x49484452 ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
  if (mimeType === "image/gif") return bytes.length >= 10 ? { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) } : null;
  if (mimeType === "image/webp") {
    if (bytes.length < 30 || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (mimeType === "image/jpeg") {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1]!;
      // Start-of-frame markers carry the size; DHT (C4), JPG (C8) and DAC (CC) share the range and do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  return null;
}

/** One PNG chunk: length, type, data, CRC over type and data. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * A PNG as RGBA, eight bits a channel, or null for what this does not read:
 * interlaced, sixteen bits a channel, fewer than eight (but for a palette of
 * eight), or anything malformed.
 */
function decodePng(bytes: Buffer): { width: number; height: number; rgba: Uint8Array } | null {
  if (bytes.length < 33 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
  let at = 8;
  let width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  let palette: Buffer | null = null, alpha: Buffer | null = null;
  const data: Buffer[] = [];
  while (at + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("ascii", at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]!; color = body[9]!; interlace = body[12]!;
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") alpha = body;
    else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
  if (!width || !height || depth !== 8 || interlace !== 0 || !channels || width * height > DECODE_MAX_PIXELS || (color === 3 && !palette)) return null;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(data));
  } catch {
    return null;
  }
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const rgba = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const above = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0, b = above[i]!, c = i >= channels ? above[i - channels]! : 0;
      const x = row[i]!;
      line[i] = (filter === 0 ? x : filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    }
    for (let px = 0; px < width; px++) {
      const o = (y * width + px) * 4, i = px * channels;
      if (color === 6) rgba.set(line.subarray(i, i + 4), o);
      else if (color === 2) rgba.set([line[i]!, line[i + 1]!, line[i + 2]!, 255], o);
      else if (color === 0) rgba.set([line[i]!, line[i]!, line[i]!, 255], o);
      else if (color === 4) rgba.set([line[i]!, line[i]!, line[i]!, line[i + 1]!], o);
      else {
        const n = line[i]!;
        rgba.set([palette![n * 3] ?? 0, palette![n * 3 + 1] ?? 0, palette![n * 3 + 2] ?? 0, alpha?.[n] ?? 255], o);
      }
    }
    above.set(line);
  }
  return { width, height, rgba };
}

/** RGBA box-averaged down to `width` × `height`: each pixel the mean of the source pixels under it. */
function shrink(from: { width: number; height: number; rgba: Uint8Array }, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * from.height) / height), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * from.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * from.width) / width), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * from.width) / width));
      const sum = [0, 0, 0, 0];
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) for (let k = 0; k < 4; k++) sum[k]! += from.rgba[(sy * from.width + sx) * 4 + k]!;
      const n = (y1 - y0) * (x1 - x0);
      for (let k = 0; k < 4; k++) out[(y * width + x) * 4 + k] = Math.round(sum[k]! / n);
    }
  }
  return out;
}

/** RGBA as a PNG, each row Sub-filtered (screens are flat colour, which Sub turns into runs of zeros). */
function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 1;
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (rgba[y * stride + i]! - (i >= 4 ? rgba[y * stride + i - 4]! : 0)) & 0xff;
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * **A picture made ready to send, or null** — the picture whole when its
 * long side is already within `PICTURE_SIDE`; a PNG over it decoded and
 * box-averaged down to it; anything else over it, or that cannot be read, or
 * too big to send, null (and it goes by its title).
 */
export function pictureToSend(bytes: Buffer, mimeType: string): (TextImage & { width: number; height: number }) | null {
  const size = sizeOf(bytes, mimeType);
  if (!size || !size.width || !size.height) return null;
  const long = Math.max(size.width, size.height);
  if (long <= PICTURE_SIDE) return bytes.length <= SEND_MAX_BYTES ? { mediaType: mimeType, data: bytes.toString("base64"), ...size } : null;
  if (mimeType !== "image/png") return null;
  const decoded = decodePng(bytes);
  if (!decoded) return null;
  const scale = PICTURE_SIDE / long;
  const width = Math.max(1, Math.round(decoded.width * scale)), height = Math.max(1, Math.round(decoded.height * scale));
  const png = encodePng(width, height, shrink(decoded, width, height));
  return png.length <= SEND_MAX_BYTES ? { mediaType: "image/png", data: png.toString("base64"), width, height } : null;
}
