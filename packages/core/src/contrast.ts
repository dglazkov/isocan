/**
 * Contrast, computed rather than judged.
 *
 * "That grey looks a bit light" is an opinion nobody can act on; "3.1:1, and
 * body text needs 4.5" is a number and a fix. It is a dozen lines of sRGB
 * maths, and having it in core is what lets an audit and a linter agree —
 * and what keeps a palette honest at the moment it is written, rather than
 * after somebody ships it.
 */

/** WCAG 2.2 minimums. Large is 18.66px bold or 24px regular. */
export const CONTRAST_BODY = 4.5;
const CONTRAST_LARGE = 3;
/** Non-text: the boundary of a control, an icon that carries meaning. */
export const CONTRAST_UI = 3;

/** #rgb / #rrggbb → channels, or null for anything else. Named colours and
 * oklch() are legal in DESIGN.md and are not resolvable without a browser, so
 * they get an honest null rather than a guess. */
export function parseHex(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, per WCAG. */
export function luminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** The ratio between two colours, 1–21, or null when either is not a hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

/** Does this pair carry text at that size? */
export function passesContrast(a: string, b: string, need = CONTRAST_BODY): boolean | null {
  const ratio = contrastRatio(a, b);
  return ratio === null ? null : ratio >= need;
}
