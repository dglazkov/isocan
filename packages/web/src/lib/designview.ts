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

/**
 * **What a component IS, guessed from what it is called.**
 *
 * A design system's `components` are a name and a free bag of properties —
 * the spec fixes neither the property names nor a type. So the only thing
 * saying whether `button-primary` is a button is the word "button", and
 * reading it is the difference between a specification and a showroom: a
 * property list tells you `background: #00E58A`, a drawn button tells you
 * whether you would press it.
 *
 * Guessing is allowed to be wrong here, and that is why it degrades to a
 * plain labelled block rather than to nothing. A component this does not
 * recognise still gets its colours, its corner and its padding — it just
 * does not pretend to know what shape it wanted to be.
 */
export type ComponentShape = "button" | "chip" | "input" | "card" | "block";

export function componentShape(name: string): ComponentShape {
  const n = name.toLowerCase();
  if (/\b(button|btn|cta|action)\b|button|btn/.test(n)) return "button";
  if (/chip|badge|tag|pill|label/.test(n)) return "chip";
  if (/input|field|text-?area|select|search/.test(n)) return "input";
  if (/card|panel|sheet|surface|dialog|modal|container/.test(n)) return "card";
  return "block";
}

/**
 * The properties, as CSS that can actually be applied.
 *
 * Deliberately tolerant about names: the spec lets an author call the
 * background `background`, `bg`, `fill` or `surface`, and a system that only
 * rendered one spelling would silently draw a colourless box for everybody
 * else's. Anything unrecognised is left to the value list beside the preview,
 * which still shows every property verbatim — the preview is an addition to
 * the specification, never a replacement for it.
 */
export function componentCss(
  resolve: (value: string) => unknown,
  props: Record<string, string>,
): Record<string, string> {
  const css: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") css[key] = value;
    else if (typeof value === "number") css[key] = String(value);
  };
  for (const [rawKey, rawValue] of Object.entries(props)) {
    const key = rawKey.toLowerCase().replace(/[_\s]/g, "-");
    // A reference resolves; a literal is itself. `{colors.primary}` and
    // `#00E58A` both have to arrive here as a colour.
    const resolved = resolve(rawValue);
    const value = resolved === null || resolved === undefined ? rawValue : resolved;
    if (/^(background|bg|fill|surface)(-color)?$/.test(key)) put("background", value);
    else if (/^(color|text|foreground|ink|on)(-color)?$/.test(key)) put("color", value);
    else if (/^(radius|rounded|corner|border-radius)$/.test(key)) put("borderRadius", value);
    else if (/^(padding|pad|inset)$/.test(key)) put("padding", value);
    else if (/^(border|outline|stroke)(-color)?$/.test(key)) {
      if (typeof value === "string" && /^\d/.test(value)) put("border", value);
      else put("border", `1px solid ${String(value)}`);
    } else if (/^(shadow|elevation|box-shadow)$/.test(key)) put("boxShadow", value);
    else if (/^(font-size|size)$/.test(key)) put("fontSize", value);
    else if (/^(font-weight|weight)$/.test(key)) put("fontWeight", value);
    else if (/^(font-family|family)$/.test(key)) put("fontFamily", value);
    else if (/^(font|typography|type|text-style)$/.test(key) && value && typeof value === "object") {
      // A typography reference resolves to the whole style, not a string.
      const t = value as Record<string, unknown>;
      put("fontFamily", t.fontFamily);
      put("fontSize", t.fontSize);
      put("fontWeight", t.fontWeight);
      put("lineHeight", t.lineHeight);
      put("letterSpacing", t.letterSpacing);
    }
  }
  return css;
}
