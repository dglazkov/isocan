/**
 * **Pure mood-board swatch maths** (`docs/projects/moodboard/design.md` §4,
 * moodboard phase 2). Pixel decoding stays at the edge (browser `<canvas>`,
 * daemon `sharp`, or picture-capable `textModel`); this module owns the
 * deterministic k-means clustering over RGBA bytes, CIE L*a*b* (D65) distance,
 * and JSON serialization on `moodSwatches`.
 */
/** Route that computes swatches for an image item on the daemon. */
export declare const SWATCHES_ROUTE = "/api/image/swatches";
/** Refusal code when neither `sharp` nor a picture-capable text model is available. */
export declare const IMAGE_SWATCHES_UNAVAILABLE = "image-swatches-unavailable";
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
/** Convert 8-bit sRGB channels (`0..255`) to CIE L*a*b* under D65 (2° observer). */
export declare function rgbToLab(r: number, g: number, b: number): [number, number, number];
/** CIE76 colour difference (`ΔE*ab`) between two `#rrggbb` hex strings in CIE L*a*b* D65. */
export declare function deltaE(hexA: string, hexB: string): number;
/** Parse a stored `moodSwatches` JSON string into validated swatches. */
export declare function parseMoodSwatches(raw: string | undefined): MoodSwatch[];
/** Format swatches as the canonical JSON string stored on `properties.moodSwatches`. */
export declare function formatMoodSwatches(swatches: readonly MoodSwatch[]): string;
/**
 * **Deterministic k-means swatches from RGBA pixels** (design §4):
 * - Ignores pixels with `alpha < 128`.
 * - Seeds up to 6 centroids deterministically via farthest-first in CIE Lab
 *   starting from the most populated 5-bit quantized RGB bin (never `Math.random()`).
 * - Runs k-means in CIE Lab, then merges clusters whose centroids are within
 *   `ΔE < 6` (summing their pixel counts and RGB totals).
 * - Orders by `share` descending (rounded to 3 decimals) and returns up to 6.
 */
export declare function swatchesFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): MoodSwatch[];
