import { contrastRatio } from "@isocan/core";

/**
 * The readable ink for a swatch, and how readable it is.
 *
 * A design system's job is to say whether a colour can carry words, so the
 * swatch says it: black or white, whichever wins, with the ratio printed on
 * it. A palette that cannot hold text becomes visible where the palette is,
 * rather than in an audit three weeks later.
 *
 * Returns null for anything we could not parse — a value we cannot read is a
 * value we cannot grade, and inventing a number for it would be worse than
 * printing nothing.
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
