import type { CanvasContents, Item } from "./model.ts";

/**
 * **What an image's bytes and its canvas say about it** — shared between the
 * View Focus Metadata Inspector (`/i/:itemId`) and any CLI or test caller.
 *
 * Pure and dependency-free: PNG `IHDR` / `tEXt` / `iTXt`, JPEG `SOF` + `APP1`
 * EXIF TIFF tags, WebP `VP8` / `VP8L` / `VP8X`, GIF headers, and SVG root
 * attributes are read straight from a `Uint8Array` with bounds checks at every
 * offset, so a truncated upload returns whatever facts are readable rather
 * than throwing.
 */

/** Dimensions, color format, and embedded PNG/JPEG/SVG header metadata of an image blob. */
export interface ImageBinaryMetadata {
  format: "png" | "jpeg" | "webp" | "svg" | "gif" | "unknown";
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  bitDepth?: number;
  colorType?: string;
  hasAlpha?: boolean;
  /** PNG `tEXt` / uncompressed `iTXt` keyword-value pairs (e.g. `Software`, `Description`, `parameters`, `prompt`). */
  textTags: Record<string, string>;
  /** JPEG `APP1` EXIF TIFF tags (e.g. `Make`, `Model`, `Software`, `DateTime`, `ImageDescription`, `Artist`). */
  exifTags: Record<string, string>;
}

/** A canvas item or comment thread that references an image by id, blob hash, or filename. */
export interface ImageBacklink {
  kind: "item-content" | "item-property" | "thread";
  itemId?: string;
  threadId?: string;
  title: string;
  detail: string;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Human-readable aspect ratio (`"16:9"`, `"4:3"`, `"1:1"`). Falls back to a
 * compact decimal ratio (`"1.85:1"`) when the simplified terms exceed 32.
 */
export function formatAspectRatio(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const d = gcd(width, height);
  const rw = Math.round(width / d);
  const rh = Math.round(height / d);
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  const ratio = width / height;
  const formatted = Number(ratio.toFixed(2)).toString();
  return `${formatted}:1`;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 8) | bytes[offset + 1]!) >>> 0;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8)) >>> 0;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function readAscii(bytes: Uint8Array, start: number, end: number): string {
  const clampedEnd = Math.min(bytes.length, Math.max(start, end));
  let out = "";
  for (let i = start; i < clampedEnd; i++) {
    const code = bytes[i]!;
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return readAscii(bytes, 0, bytes.length);
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const PNG_COLOR_TYPES: Record<number, { name: string; alpha: boolean }> = {
  0: { name: "grayscale", alpha: false },
  2: { name: "rgb", alpha: false },
  3: { name: "indexed", alpha: false },
  4: { name: "grayscale+alpha", alpha: true },
  6: { name: "rgba", alpha: true },
};

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

function parsePng(bytes: Uint8Array): ImageBinaryMetadata {
  let width: number | null = null;
  let height: number | null = null;
  let bitDepth: number | undefined;
  let colorType: string | undefined;
  let hasAlpha: boolean | undefined;
  const textTags: Record<string, string> = {};

  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = readAscii(bytes, offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) break;

    if (type === "IHDR" && length >= 13) {
      width = readU32BE(bytes, dataStart);
      height = readU32BE(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      const ct = bytes[dataStart + 9]!;
      const info = PNG_COLOR_TYPES[ct];
      if (info) {
        colorType = info.name;
        hasAlpha = info.alpha;
      }
    } else if (type === "tRNS") {
      hasAlpha = true;
    } else if (type === "tEXt" && length > 0) {
      let nul = dataStart;
      while (nul < dataEnd && bytes[nul] !== 0) nul++;
      if (nul < dataEnd) {
        const key = readAscii(bytes, dataStart, nul).trim();
        const val = decodeUtf8(bytes.subarray(nul + 1, dataEnd)).trim();
        if (key && val) textTags[key] = val;
      }
    } else if (type === "iTXt" && length > 5) {
      // iTXt: keyword \0 compressionFlag(1) compressionMethod(1) languageTag \0 translatedKeyword \0 text
      let nul = dataStart;
      while (nul < dataEnd && bytes[nul] !== 0) nul++;
      if (nul + 2 < dataEnd) {
        const key = readAscii(bytes, dataStart, nul).trim();
        const compFlag = bytes[nul + 1]!;
        if (compFlag === 0) {
          let cursor = nul + 3;
          while (cursor < dataEnd && bytes[cursor] !== 0) cursor++;
          cursor++; // past languageTag \0
          while (cursor < dataEnd && bytes[cursor] !== 0) cursor++;
          cursor++; // past translatedKeyword \0
          if (cursor <= dataEnd) {
            const val = decodeUtf8(bytes.subarray(cursor, dataEnd)).trim();
            if (key && val) textTags[key] = val;
          }
        }
      }
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4; // skip 4-byte CRC
  }

  return {
    format: "png",
    width,
    height,
    aspectRatio: width && height ? formatAspectRatio(width, height) : null,
    ...(bitDepth !== undefined ? { bitDepth } : {}),
    ...(colorType !== undefined ? { colorType } : {}),
    ...(hasAlpha !== undefined ? { hasAlpha } : {}),
    textTags,
    exifTags: {},
  };
}

const EXIF_TAG_NAMES: Record<number, string> = {
  0x010e: "ImageDescription",
  0x010f: "Make",
  0x0110: "Model",
  0x0112: "Orientation",
  0x0131: "Software",
  0x0132: "DateTime",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x9003: "DateTimeOriginal",
  0xa002: "PixelXDimension",
  0xa003: "PixelYDimension",
};

function parseExifTiff(tiff: Uint8Array, out: Record<string, string>): void {
  if (tiff.length < 8) return;
  const endianA = tiff[0];
  const endianB = tiff[1];
  const little = endianA === 0x49 && endianB === 0x49;
  const big = endianA === 0x4d && endianB === 0x4d;
  if (!little && !big) return;

  const u16 = (off: number) => (little ? readU16LE(tiff, off) : readU16BE(tiff, off));
  const u32 = (off: number) => (little ? readU32LE(tiff, off) : readU32BE(tiff, off));

  if (u16(2) !== 42) return;
  const ifd0 = u32(4);

  const readIfd = (ifdOffset: number, visited: Set<number>) => {
    if (ifdOffset <= 0 || ifdOffset + 2 > tiff.length || visited.has(ifdOffset)) return;
    visited.add(ifdOffset);
    const count = u16(ifdOffset);
    for (let i = 0; i < count; i++) {
      const entry = ifdOffset + 2 + i * 12;
      if (entry + 12 > tiff.length) break;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const numValues = u32(entry + 4);
      const valueOffsetField = entry + 8;

      if (tag === 0x8769) {
        // ExifIFDPointer
        const subIfd = u32(valueOffsetField);
        readIfd(subIfd, visited);
        continue;
      }

      const name = EXIF_TAG_NAMES[tag];
      if (!name) continue;

      if (type === 2 && numValues > 0) {
        // ASCII string
        const strStart = numValues <= 4 ? valueOffsetField : u32(valueOffsetField);
        if (strStart >= 0 && strStart + numValues <= tiff.length) {
          const val = readAscii(tiff, strStart, strStart + numValues).trim();
          if (val) out[name] = val;
        }
      } else if (type === 3 && numValues === 1) {
        // SHORT
        out[name] = String(u16(valueOffsetField));
      } else if (type === 4 && numValues === 1) {
        // LONG
        out[name] = String(u32(valueOffsetField));
      }
    }
  };

  readIfd(ifd0, new Set());
}

function parseJpeg(bytes: Uint8Array): ImageBinaryMetadata {
  let width: number | null = null;
  let height: number | null = null;
  let bitDepth: number | undefined;
  const exifTags: Record<string, string> = {};

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset]!;
    offset++;

    // Standalone markers without length
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      if (marker === 0xd9) break;
      continue;
    }

    if (offset + 2 > bytes.length) break;
    const segLen = readU16BE(bytes, offset);
    if (segLen < 2 || offset + segLen > bytes.length) break;
    const segStart = offset + 2;
    const segEnd = offset + segLen;

    // APP1 Exif
    if (marker === 0xe1 && segLen >= 8) {
      const header = readAscii(bytes, segStart, segStart + 6);
      if (header === "Exif" && bytes[segStart + 4] === 0 && bytes[segStart + 5] === 0) {
        parseExifTiff(bytes.subarray(segStart + 6, segEnd), exifTags);
      }
    }

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (segStart + 5 <= segEnd) {
        bitDepth = bytes[segStart];
        height = readU16BE(bytes, segStart + 1);
        width = readU16BE(bytes, segStart + 3);
      }
    }

    if (marker === 0xda) {
      // Start of Scan: image data follows
      break;
    }

    offset = segEnd;
  }

  return {
    format: "jpeg",
    width,
    height,
    aspectRatio: width && height ? formatAspectRatio(width, height) : null,
    ...(bitDepth !== undefined ? { bitDepth } : {}),
    colorType: "rgb",
    hasAlpha: false,
    textTags: {},
    exifTags,
  };
}

function parseWebp(bytes: Uint8Array): ImageBinaryMetadata {
  let width: number | null = null;
  let height: number | null = null;
  let hasAlpha = false;

  if (bytes.length >= 30) {
    const chunk = readAscii(bytes, 12, 16);
    if (chunk === "VP8X") {
      const flags = bytes[20]!;
      hasAlpha = (flags & 0x10) !== 0;
      width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    } else if (chunk === "VP8 " && bytes.length >= 30) {
      width = readU16LE(bytes, 26) & 0x3fff;
      height = readU16LE(bytes, 28) & 0x3fff;
    } else if (chunk === "VP8L" && bytes.length >= 25) {
      const b0 = bytes[21]!;
      const b1 = bytes[22]!;
      const b2 = bytes[23]!;
      const b3 = bytes[24]!;
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      hasAlpha = (b3 & 0x10) !== 0;
    }
  }

  return {
    format: "webp",
    width,
    height,
    aspectRatio: width && height ? formatAspectRatio(width, height) : null,
    hasAlpha,
    textTags: {},
    exifTags: {},
  };
}

function parseGif(bytes: Uint8Array): ImageBinaryMetadata {
  const width = bytes.length >= 10 ? readU16LE(bytes, 6) : null;
  const height = bytes.length >= 10 ? readU16LE(bytes, 8) : null;
  return {
    format: "gif",
    width,
    height,
    aspectRatio: width && height ? formatAspectRatio(width, height) : null,
    colorType: "indexed",
    textTags: {},
    exifTags: {},
  };
}

function parseSvg(bytes: Uint8Array): ImageBinaryMetadata {
  const head = decodeUtf8(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const svgTag = head.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  let width: number | null = null;
  let height: number | null = null;

  const wMatch = svgTag.match(/\bwidth\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)(?:px)?\s*["']/i);
  const hMatch = svgTag.match(/\bheight\s*=\s*["']\s*([0-9]+(?:\.[0-9]+)?)(?:px)?\s*["']/i);
  if (wMatch) width = Number(wMatch[1]);
  if (hMatch) height = Number(hMatch[1]);

  const vbMatch = svgTag.match(
    /\bviewBox\s*=\s*["']\s*[-+0-9.]+\s+[-+0-9.]+\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s*["']/i,
  );
  if (vbMatch) {
    if (!width) width = Number(vbMatch[1]);
    if (!height) height = Number(vbMatch[2]);
  }

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = head.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i);
  const textTags: Record<string, string> = {};
  if (titleMatch?.[1]?.trim()) textTags.Title = titleMatch[1].trim();
  if (descMatch?.[1]?.trim()) textTags.Description = descMatch[1].trim();

  return {
    format: "svg",
    width: width && Number.isFinite(width) ? Math.round(width) : null,
    height: height && Number.isFinite(height) ? Math.round(height) : null,
    aspectRatio: width && height ? formatAspectRatio(width, height) : null,
    hasAlpha: true,
    textTags,
    exifTags: {},
  };
}

/**
 * Inspect an image's binary header for dimensions, color format, PNG `tEXt` /
 * `iTXt` generation tags, JPEG EXIF fields, or SVG root dimensions.
 */
export function parseImageMetadata(bytes: Uint8Array, mimeType?: string): ImageBinaryMetadata {
  if (isPng(bytes)) return parsePng(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpeg(bytes);
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 12) === "WEBP"
  ) {
    return parseWebp(bytes);
  }
  if (bytes.length >= 6) {
    const sig = readAscii(bytes, 0, 6);
    if (sig === "GIF87a" || sig === "GIF89a") return parseGif(bytes);
  }
  const trimmedHead = decodeUtf8(bytes.subarray(0, Math.min(bytes.length, 512))).trimStart();
  if (mimeType === "image/svg+xml" || trimmedHead.startsWith("<svg") || trimmedHead.includes("<svg")) {
    return parseSvg(bytes);
  }
  return {
    format: "unknown",
    width: null,
    height: null,
    aspectRatio: null,
    textTags: {},
    exifTags: {},
  };
}

/**
 * Find every place on `canvas` that references `item` (or any of its versions'
 * blob hashes or filenames):
 * - Other items' `properties` naming `item.id` or a version's `blobHash`.
 * - Other items' text bodies (`itemTexts[otherId]`, e.g. HTML screens or
 *   Markdown docs) referencing a version's `blobHash`, `item.id`, or filename.
 * - Comment threads anchored to `item.id` or citing `#item` via `itemRefs`.
 */
export function imageBacklinksIn(
  canvas: CanvasContents,
  item: Item,
  itemTexts: Readonly<Record<string, string>> = {},
): ImageBacklink[] {
  const results: ImageBacklink[] = [];
  const hashes = new Set(item.versions.map((v) => v.blobHash));
  const filenames = new Set(
    item.versions
      .map((v) => v.filename.trim())
      .filter((name) => name.length > 3),
  );

  for (const other of Object.values(canvas.items)) {
    if (other.id === item.id) continue;

    // 1. Property references
    for (const [key, val] of Object.entries(other.properties ?? {})) {
      if (val === item.id || hashes.has(val)) {
        results.push({
          kind: "item-property",
          itemId: other.id,
          title: other.title || other.id,
          detail: `property ${key}`,
        });
      }
    }

    // 2. Text content references (HTML <img src> / Markdown links)
    const body = itemTexts[other.id];
    if (body) {
      let matchedDetail: string | null = null;
      for (const hash of hashes) {
        if (body.includes(hash)) {
          matchedDetail = `embeds blob ${hash.slice(0, 8)}…`;
          break;
        }
      }
      if (!matchedDetail && body.includes(item.id)) {
        matchedDetail = `references ${item.id}`;
      }
      if (!matchedDetail) {
        for (const name of filenames) {
          if (body.includes(name)) {
            matchedDetail = `references ${name}`;
            break;
          }
        }
      }
      if (matchedDetail) {
        results.push({
          kind: "item-content",
          itemId: other.id,
          title: other.title || other.id,
          detail: matchedDetail,
        });
      }
    }
  }

  // 3. Comment threads anchored to this item or referencing it via #items
  for (const thread of Object.values(canvas.threads)) {
    if (thread.anchorItemId === item.id) {
      const first = thread.comments[0];
      results.push({
        kind: "thread",
        itemId: item.id,
        threadId: thread.id,
        title: `Thread on ${item.title || item.id}`,
        detail: first ? `${first.author.name}: ${first.body.slice(0, 60)}` : "Anchored thread",
      });
      continue;
    }
    const cites = thread.comments.some((c) => c.items?.includes(item.id));
    if (cites) {
      const first = thread.comments[0];
      results.push({
        kind: "thread",
        ...(thread.anchorItemId ? { itemId: thread.anchorItemId } : {}),
        threadId: thread.id,
        title: thread.anchorItemId
          ? `Thread on ${canvas.items[thread.anchorItemId]?.title ?? thread.anchorItemId}`
          : "Canvas thread",
        detail: first ? `mentions #${item.title || item.id}` : `mentions #${item.id}`,
      });
    }
  }

  return results;
}
