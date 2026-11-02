import { GROUND_SCRIM } from "./theme.ts";

/** `#rrggbb` from three 0–255 channels. */
const hexOf = (rgb: number[]): string => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** sRGB channel (0–1) to linear light, and back. */
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);

/**
 * **What colour a picture actually is under the scrim** (smart contrast
 * phase 3, design §4: "take a look"). `pixels` is RGBA, as a canvas hands
 * them back — the web draws the decoded picture into 16×16 once. Averaged in
 * linear light, because that is the mean an eye sees (an sRGB average of half
 * white and half black is too dark), then composited under black at `scrim`
 * the way the browser blends the scrim element, in sRGB. A transparent pixel
 * is the black the picture is laid on (`--ground-under`).
 *
 * Under today's 0.7 every picture lands `dark` — flat white is
 * `BRIGHTEST_PICTURE` exactly — so this changes nothing anyone sees. It is
 * what makes a lighter scrim for pale pictures a one-number change.
 */
export function sampledGround(pixels: Uint8ClampedArray | number[], scrim: number = GROUND_SCRIM): string {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]! / 255;
    for (let c = 0; c < 3; c++) sum[c]! += toLinear(pixels[i + c]! / 255) * a;
    n++;
  }
  if (n === 0) return hexOf([0, 0, 0]);
  return hexOf(sum.map((l) => toSrgb(l / n) * 255 * (1 - scrim)));
}

