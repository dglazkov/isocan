import { contrastRatio } from "@isocan/core";

/**
 * The readable ink for a swatch: black or white, whichever wins, and by how
 * much.
 *
 * THIS IS NOT A VERDICT, and the first version of it was presented as one. It
 * takes the BETTER of black-on-colour and white-on-colour, and since those are
 * the extremes of the range, every colour has a good answer: searching the
 * whole sRGB cube, the worst case is 4.58:1 at #008196. The number could never
 * fall below the threshold it appeared to be tested against, so a swatch
 * showing "5.2" and a swatch showing "18.9" both meant "fine" and the badge
 * could not fail. Meanwhile a real failure — `text-muted` at 3.27:1 on its own
 * `surface` — sat two rows away in the same document, unreported.
 *
 * So it is labelled for what it measures, and the actual grading is
 * `checkDesign`, which compares the pairs the system itself declares.
 *
 * Returns null for anything we could not parse — a value we cannot read is a
 * value we cannot grade, and inventing a number would be worse than printing
 * nothing.
 */
export function readableInk(value: string): { color: "#ffffff" | "#000000"; ratio: number } | null {
  const onWhite = contrastRatio(value, "#ffffff");
  const onBlack = contrastRatio(value, "#000000");
  if (onWhite === null || onBlack === null) return null;
  return onWhite >= onBlack
    ? { color: "#ffffff", ratio: onWhite }
    : { color: "#000000", ratio: onBlack };
}

/**
 * A spacing step as a number of pixels, so the scale can be DRAWN rather than
 * listed — the rhythm is the thing a table of numbers hides. `rem` and `em`
 * are taken at the browser default; anything else (a percentage, a clamp, a
 * calc) is not a length we can draw to scale, and says so.
 */
export function lengthPx(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === "rem" || m[2] === "em" ? n * 16 : n;
}
