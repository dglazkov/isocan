/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **Calibrated per-kind sizing** (Open Stitch phase 1B, ADR 0257).
 *
 * Zoom 1.0 is reading distance: media items land at their true pixels up to a
 * 1280px long edge so a 1024px image is not shrunk into a postage stamp;
 * documents live in a readable 480/640/800 width band; screens default to a
 * native desktop viewport (1280×800) or their declared natural viewport; text
 * notes default to a calibrated 240×240 square.
 *
 * Keeping defaults, clamps, caps and reading bands in one table per built-in
 * kind stops initial placement, resizer bounds, and `--actual-size` from
 * drifting apart.
 */

import { isBuiltinKind, type BuiltinKind, type ItemKind } from "./kinds.ts";

/** Explicit width and height in canvas world units. */
export interface Size2D {
  width: number;
  height: number;
}

/** Per-kind sizing contract used for initial drop, resize clamping, and actual-size resets. */
interface KindSizePolicy {
  /** Initial width at zoom 1.0 when no natural size is known. */
  defaultWidth: number;
  /** Initial height at zoom 1.0 when no natural size is known. */
  defaultHeight: number;
  /** Minimum legal width when resizing or clamping. */
  minWidth: number;
  /** Minimum legal height when resizing or clamping. */
  minHeight: number;
  /** Maximum legal width for calibrated placement and actual-size resets. */
  maxWidth: number;
  /** Maximum legal height for calibrated placement and actual-size resets. */
  maxHeight: number;
  /** Maximum long edge on initial drop for media kinds (true pixels below this cap). */
  mediaCapLongEdge?: number;
  /** Readable width stops for prose/document items (snapped on initial calibrated sizing). */
  widthBand?: readonly number[];
  /** Preserve aspect ratio when scaling natural dimensions into bounds. */
  lockAspect?: boolean;
}

/** Long-edge cap in world pixels for calibrated media placement (ADR 0257). */
export const MEDIA_CALIBRATED_LONG_EDGE = 1280;

/** Readable width stops for document items at zoom 1.0 (ADR 0257). */
export const DOCUMENT_WIDTH_BAND: readonly number[] = [480, 640, 800];

/** Single source of truth for per-kind calibrated defaults, bounds, and caps. */
export const KIND_SIZE_POLICY: Record<BuiltinKind, KindSizePolicy> = {
  image: {
    defaultWidth: 640,
    defaultHeight: 480,
    minWidth: 64,
    minHeight: 64,
    maxWidth: 2560,
    maxHeight: 2560,
    mediaCapLongEdge: MEDIA_CALIBRATED_LONG_EDGE,
    lockAspect: true,
  },
  video: {
    defaultWidth: 640,
    defaultHeight: 360,
    minWidth: 160,
    minHeight: 90,
    maxWidth: 2560,
    maxHeight: 2560,
    mediaCapLongEdge: MEDIA_CALIBRATED_LONG_EDGE,
    lockAspect: true,
  },
  screen: {
    defaultWidth: 1280,
    defaultHeight: 800,
    minWidth: 240,
    minHeight: 200,
    maxWidth: 2560,
    maxHeight: 2400,
  },
  site: {
    defaultWidth: 1280,
    defaultHeight: 800,
    minWidth: 320,
    minHeight: 240,
    maxWidth: 2560,
    maxHeight: 2400,
  },
  document: {
    defaultWidth: 640,
    defaultHeight: 480,
    minWidth: 240,
    minHeight: 160,
    maxWidth: 1280,
    maxHeight: 2400,
    widthBand: DOCUMENT_WIDTH_BAND,
  },
  text: {
    defaultWidth: 240,
    defaultHeight: 240,
    minWidth: 120,
    minHeight: 48,
    maxWidth: 1200,
    maxHeight: 1600,
  },
  drawing: {
    defaultWidth: 480,
    defaultHeight: 360,
    minWidth: 48,
    minHeight: 48,
    maxWidth: 2560,
    maxHeight: 2560,
    mediaCapLongEdge: MEDIA_CALIBRATED_LONG_EDGE,
  },
  canvas: {
    defaultWidth: 480,
    defaultHeight: 320,
    minWidth: 200,
    minHeight: 140,
    maxWidth: 1600,
    maxHeight: 1200,
  },
  other: {
    defaultWidth: 360,
    defaultHeight: 240,
    minWidth: 120,
    minHeight: 80,
    maxWidth: 1600,
    maxHeight: 1600,
  },
};

function validNatural(natural: Size2D | undefined): natural is Size2D {
  return (
    natural !== undefined &&
    Number.isFinite(natural.width) &&
    Number.isFinite(natural.height) &&
    natural.width > 0 &&
    natural.height > 0
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundSize(width: number, height: number): Size2D {
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function nearestBandStop(width: number, band: readonly number[]): number {
  let best = band[0]!;
  let bestDist = Math.abs(width - best);
  for (let i = 1; i < band.length; i++) {
    const candidate = band[i]!;
    const dist = Math.abs(width - candidate);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function fitWithinBounds(width: number, height: number, policy: KindSizePolicy, preserveAspect: boolean): Size2D {
  let w = width;
  let h = height;
  if (preserveAspect && w > 0 && h > 0) {
    if (w > policy.maxWidth || h > policy.maxHeight) {
      const scale = Math.min(policy.maxWidth / w, policy.maxHeight / h);
      w *= scale;
      h *= scale;
    }
    if (w < policy.minWidth || h < policy.minHeight) {
      const scale = Math.max(policy.minWidth / w, policy.minHeight / h);
      w = Math.min(policy.maxWidth, w * scale);
      h = Math.min(policy.maxHeight, h * scale);
    }
    return roundSize(clamp(w, policy.minWidth, policy.maxWidth), clamp(h, policy.minHeight, policy.maxHeight));
  }
  return roundSize(clamp(w, policy.minWidth, policy.maxWidth), clamp(h, policy.minHeight, policy.maxHeight));
}

/** Look up the sizing policy for any built-in or module-contributed item kind. */
export function sizePolicyFor(kind: ItemKind): KindSizePolicy {
  return isBuiltinKind(kind) ? KIND_SIZE_POLICY[kind] : KIND_SIZE_POLICY.other;
}

/**
 * Calibrated reading-distance size for an item on initial drop (zoom 1.0).
 *
 * - Media kinds (`image`, `video`, `drawing`) use true natural pixels capped at
 *   a 1280px long edge so high-res assets do not swallow the board.
 * - Documents snap to the nearest width in the 480 / 640 / 800 reading band.
 * - Screens and sites keep their natural viewport (or 1280×800 by default).
 * - Missing or invalid natural dimensions fall back to the kind's default box.
 */
export function calibratedSizeFor(kind: ItemKind, natural?: Size2D): Size2D {
  const policy = sizePolicyFor(kind);
  if (!validNatural(natural)) {
    return { width: policy.defaultWidth, height: policy.defaultHeight };
  }

  let w = natural.width;
  let h = natural.height;

  if (policy.mediaCapLongEdge !== undefined) {
    const longEdge = Math.max(w, h);
    if (longEdge > policy.mediaCapLongEdge) {
      const scale = policy.mediaCapLongEdge / longEdge;
      w *= scale;
      h *= scale;
    }
    return fitWithinBounds(w, h, policy, true);
  }

  if (policy.widthBand && policy.widthBand.length > 0) {
    const snappedW = nearestBandStop(w, policy.widthBand);
    return roundSize(snappedW, clamp(h, policy.minHeight, policy.maxHeight));
  }

  return fitWithinBounds(w, h, policy, Boolean(policy.lockAspect));
}

/**
 * 100% natural ("Actual size") box for an item, capped cleanly only by the
 * kind's hard max bounds so an oversized 8K asset stays controllable.
 *
 * Unlike `calibratedSizeFor`, media kinds do NOT stop at the 1280px initial-drop
 * cap — a 1600×1200 image resets to 1600×1200 — while items without a natural
 * size reset to their calibrated reading-distance default.
 */
export function actualSizeFor(kind: ItemKind, natural?: Size2D): Size2D {
  const policy = sizePolicyFor(kind);
  if (!validNatural(natural)) {
    return { width: policy.defaultWidth, height: policy.defaultHeight };
  }
  return fitWithinBounds(natural.width, natural.height, policy, Boolean(policy.lockAspect || policy.mediaCapLongEdge));
}
