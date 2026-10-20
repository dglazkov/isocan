/**
 * **Pure mood-board swatch maths** (`docs/projects/moodboard/design.md` §4,
 * moodboard phase 2). Pixel decoding stays at the edge (browser `<canvas>`,
 * daemon `sharp`, or picture-capable `textModel`); this module owns the
 * deterministic k-means clustering over RGBA bytes, CIE L*a*b* (D65) distance,
 * and JSON serialization on `moodSwatches`.
 */

/** Route that computes swatches for an image item on the daemon. */
export const SWATCHES_ROUTE = "/api/image/swatches";

/** Refusal code when neither `sharp` nor a picture-capable text model is available. */
export const IMAGE_SWATCHES_UNAVAILABLE = "image-swatches-unavailable";

/** One dominant colour swatch on a kept or reference mood-board tile. */
export interface MoodSwatch {
  hex: string;
  share: number;
  estimated?: boolean;
}

/** `POST /api/image/swatches` request body. */
export interface SwatchesRequest {
  canvasId: string;
  itemId: string;
}

/** `POST /api/image/swatches` response body. */
export interface SwatchesResponse {
  swatches: MoodSwatch[];
  source: "sharp" | "estimated";
}

const MAX_SWATCHES = 6;
const MIN_ALPHA = 128;
const MERGE_DELTA_E = 6;
const KMEANS_ITERATIONS = 15;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim();
  if (!HEX_RE.test(clean)) return null;
  const n = Number.parseInt(clean.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

const LAB_EPSILON = (6 / 29) ** 3;
const LAB_KAPPA = 1 / (3 * (6 / 29) ** 2);

function xyzToLabF(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : t * LAB_KAPPA + 4 / 29;
}

/** Convert 8-bit sRGB channels (`0..255`) to CIE L*a*b* under D65 (2° observer). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1.0;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
  const fx = xyzToLabF(x);
  const fy = xyzToLabF(y);
  const fz = xyzToLabF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDistSq(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return dl * dl + da * da + db * db;
}

/** CIE76 colour difference (`ΔE*ab`) between two `#rrggbb` hex strings in CIE L*a*b* D65. */
export function deltaE(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return Number.POSITIVE_INFINITY;
  return Math.sqrt(labDistSq(rgbToLab(...rgbA), rgbToLab(...rgbB)));
}

function roundShare(share: number): number {
  return Math.round(share * 1000) / 1000;
}

/** Parse a stored `moodSwatches` JSON string into validated swatches. */
export function parseMoodSwatches(raw: string | undefined): MoodSwatch[] {
  if (!raw || typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: MoodSwatch[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { hex, share, estimated } = entry as { hex?: unknown; share?: unknown; estimated?: unknown };
    if (typeof hex !== "string" || !HEX_RE.test(hex)) continue;
    if (typeof share !== "number" || !Number.isFinite(share) || share <= 0 || share > 1) continue;
    const rounded = roundShare(share);
    if (rounded <= 0) continue;
    out.push({
      hex: hex.toLowerCase(),
      share: rounded,
      ...(estimated === true ? { estimated: true } : {}),
    });
    if (out.length >= MAX_SWATCHES) break;
  }
  return out;
}

/** Format swatches as the canonical JSON string stored on `properties.moodSwatches`. */
export function formatMoodSwatches(swatches: readonly MoodSwatch[]): string {
  const normalized = swatches
    .slice(0, MAX_SWATCHES)
    .map((s) => ({
      hex: s.hex.toLowerCase(),
      share: roundShare(s.share),
      ...(s.estimated ? { estimated: true } : {}),
    }))
    .filter((s) => HEX_RE.test(s.hex) && s.share > 0);
  return JSON.stringify(normalized);
}

interface ColorBin {
  key: number;
  count: number;
  sumR: number;
  sumG: number;
  sumB: number;
  lab: [number, number, number];
}

interface Cluster {
  count: number;
  sumR: number;
  sumG: number;
  sumB: number;
  hex: string;
  lab: [number, number, number];
}

function makeCluster(count: number, sumR: number, sumG: number, sumB: number): Cluster {
  const r = Math.round(sumR / count);
  const g = Math.round(sumG / count);
  const b = Math.round(sumB / count);
  return {
    count,
    sumR,
    sumG,
    sumB,
    hex: rgbToHex(r, g, b),
    lab: rgbToLab(r, g, b),
  };
}

/**
 * **Deterministic k-means swatches from RGBA pixels** (design §4):
 * - Ignores pixels with `alpha < 128`.
 * - Seeds up to 6 centroids deterministically via farthest-first in CIE Lab
 *   starting from the most populated 5-bit quantized RGB bin (never `Math.random()`).
 * - Runs k-means in CIE Lab, then merges clusters whose centroids are within
 *   `ΔE < 6` (summing their pixel counts and RGB totals).
 * - Orders by `share` descending (rounded to 3 decimals) and returns up to 6.
 */
export function swatchesFromRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): MoodSwatch[] {
  const totalPixels = Math.min(width * height, Math.floor(rgba.length / 4));
  if (totalPixels <= 0) return [];

  const binMap = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>();
  let opaqueCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const a = rgba[offset + 3]!;
    if (a < MIN_ALPHA) continue;
    const r = rgba[offset]!;
    const g = rgba[offset + 1]!;
    const b = rgba[offset + 2]!;
    opaqueCount++;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const existing = binMap.get(key);
    if (existing) {
      existing.count++;
      existing.sumR += r;
      existing.sumG += g;
      existing.sumB += b;
    } else {
      binMap.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
    }
  }

  if (opaqueCount === 0) return [];

  const bins: ColorBin[] = [...binMap.entries()]
    .map(([key, b]) => {
      const r = b.sumR / b.count;
      const g = b.sumG / b.count;
      const bl = b.sumB / b.count;
      return { key, ...b, lab: rgbToLab(r, g, bl) };
    })
    .sort((a, b) => b.count - a.count || a.key - b.key);

  const k = Math.min(MAX_SWATCHES, bins.length);
  const centroids: [number, number, number][] = [[...bins[0]!.lab]];
  const chosen = new Set<number>([0]);

  while (centroids.length < k) {
    let bestIndex = -1;
    let bestDistSq = -1;
    for (let i = 0; i < bins.length; i++) {
      if (chosen.has(i)) continue;
      const candidateLab = bins[i]!.lab;
      let minDistSq = Number.POSITIVE_INFINITY;
      for (const c of centroids) {
        const d = labDistSq(candidateLab, c);
        if (d < minDistSq) minDistSq = d;
      }
      if (minDistSq > bestDistSq) {
        bestDistSq = minDistSq;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    chosen.add(bestIndex);
    centroids.push([...bins[bestIndex]!.lab]);
  }

  const assignments = new Int32Array(bins.length).fill(-1);
  for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
    let changed = false;
    const sums = Array.from({ length: centroids.length }, () => ({ count: 0, r: 0, g: 0, b: 0 }));

    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i]!;
      let bestCluster = 0;
      let bestDist = labDistSq(bin.lab, centroids[0]!);
      for (let c = 1; c < centroids.length; c++) {
        const d = labDistSq(bin.lab, centroids[c]!);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
      const acc = sums[bestCluster]!;
      acc.count += bin.count;
      acc.r += bin.sumR;
      acc.g += bin.sumG;
      acc.b += bin.sumB;
    }

    for (let c = 0; c < centroids.length; c++) {
      const acc = sums[c]!;
      if (acc.count > 0) {
        centroids[c] = rgbToLab(acc.r / acc.count, acc.g / acc.count, acc.b / acc.count);
      }
    }
    if (!changed) break;
  }

  const rawClusters = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>();
  for (let i = 0; i < bins.length; i++) {
    const clusterIdx = assignments[i]!;
    const bin = bins[i]!;
    const cur = rawClusters.get(clusterIdx);
    if (cur) {
      cur.count += bin.count;
      cur.sumR += bin.sumR;
      cur.sumG += bin.sumG;
      cur.sumB += bin.sumB;
    } else {
      rawClusters.set(clusterIdx, { count: bin.count, sumR: bin.sumR, sumG: bin.sumG, sumB: bin.sumB });
    }
  }

  const clusters: Cluster[] = [...rawClusters.values()]
    .map((c) => makeCluster(c.count, c.sumR, c.sumG, c.sumB))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));

  // Merge clusters whose centroids are within ΔE < 6, folding smaller into larger.
  const merged: Cluster[] = [];
  for (const candidate of clusters) {
    const targetIdx = merged.findIndex((existing) => Math.sqrt(labDistSq(existing.lab, candidate.lab)) < MERGE_DELTA_E);
    if (targetIdx >= 0) {
      const target = merged[targetIdx]!;
      merged[targetIdx] = makeCluster(
        target.count + candidate.count,
        target.sumR + candidate.sumR,
        target.sumG + candidate.sumG,
        target.sumB + candidate.sumB,
      );
    } else {
      merged.push(candidate);
    }
  }

  merged.sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));

  return merged
    .slice(0, MAX_SWATCHES)
    .map((c) => ({ hex: c.hex, share: roundShare(c.count / opaqueCount) }))
    .filter((s) => s.share > 0);
}
