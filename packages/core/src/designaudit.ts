import type { DesignTokens } from "./designmd.ts";

/**
 * **Does this screen actually use the system it was built under?**
 *
 * `/design-audit` has existed since the design system did, is well written,
 * and — measured on 8 Sep 2026 across six live canvases — **has never once
 * been run.** Zero audit documents, everywhere. That is not a failure of the
 * command; it is what happens to a step somebody has to remember to type. The
 * fix this repo reaches for every time is to give the thing a NUMBER, so it
 * can be watched instead of remembered.
 *
 * ## What is checkable, and what deliberately is not
 *
 * `slop.ts` holds forty tells and is the right list, but its `spot` fields are
 * prose written for an agent to read — *"font-family lists Inter, and no
 * second face is declared anywhere"*. Prose is not a checker, and dressing it
 * up as one would be this codebase's own lesson #14: a check whose answer
 * cannot be "no". So none of that is here.
 *
 * What IS here is the one finding the design system exists to prevent, stated
 * as an integer: **values a screen uses that the system never named.** Six
 * type scales and four blues is the failure `designsystem.ts` opens with, and
 * it is arithmetic — a colour is in the palette or it is not.
 *
 * That leaves taste entirely alone, which is correct. A screen with zero
 * off-system values can still be dull; this says it is not INCOHERENT, which
 * is the floor a system can enforce and the most a machine should claim.
 *
 * ## Why literals rather than a rendered page
 *
 * The audit command already argues this and it is worth keeping: *"a ratio you
 * computed beats a colour you looked at, and half of what matters — the scale,
 * the spacing unit, the focus states — is invisible in a screenshot."* This
 * reads the source for the same reason, and gains a second: a source read is
 * deterministic, so it can be a standing number rather than a judgement that
 * moves when the renderer does.
 */

/** One value a screen used that its design system never named, and enough to
 *  point at it: a report that cannot cite the line is a report about vibes. */
interface OffSystemValue {
  /** The literal as written in the screen. */
  value: string;
  /** How the system names this kind of thing, for the message. */
  kind: "colour" | "type size" | "radius";
  /** How many times it appears. */
  count: number;
  /** The first line it appears on, 1-based, so a finding can be pointed at. */
  line: number;
}

/** One screen's reading. Both halves matter: the departures are what to fix,
 *  and the conformance is what to keep — a report with no green is a report
 *  people stop believing. */
export interface ScreenAudit {
  /** Values used that the design system never named. */
  offSystem: OffSystemValue[];
  /** What it did use from the system, so a report can say what is GOOD —
   *  a report with no green is a report people stop believing. */
  onSystem: number;
}

/** `#abc` and `#AABBCC` are one colour. Anything else is left as written. */
function normaliseColour(value: string): string {
  const hex = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,8}$/.test(hex)) return hex.replace(/\s+/g, " ");
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  // `#rrggbbff` is `#rrggbb`: a fully opaque colour written the long way.
  if (hex.length === 9 && hex.endsWith("ff")) return hex.slice(0, 7);
  return hex;
}

/** Lengths the same way: `0.5rem` and `8px` are not the same string and the
 *  system may name either, so only the obvious equivalences are folded. */
function normaliseLength(value: string): string {
  const v = value.trim().toLowerCase().replace(/\s+/g, " ");
  return v.replace(/^(\d*\.?\d+)0+(?=[a-z%])/, "$1").replace(/^0(px|rem|em)$/, "0");
}

/**
 * **A shorthand is several decisions, and grading it as one is grading none.**
 *
 * `border-radius: 0 0 8px 8px` is a card with square shoulders, and read whole
 * it reports the literal string "0 0 8px 8px" as an off-system radius —
 * a finding that is true, useless, and impossible to act on. Split, it is two
 * decisions, and `8px` is very likely one the system already named.
 *
 * Measured on the first real run: this alone was 2 of 46 findings on a canvas
 * whose design system is the best one there is.
 */
function parts(declaration: string): string[] {
  return declaration
    .trim()
    .split(/[\s/]+/)
    .filter((piece) => piece !== "" && piece !== "/");
}

/**
 * **A colour used at an opacity is still that colour.**
 *
 * `rgba(60, 64, 67, .28)` is a shadow written from `#3c4043`, and a screen
 * that dims a token to make a shadow is following the system rather than
 * departing from it. Reading it as a fifth grey would make the number mostly
 * shadows, which is the fastest way to a measurement nobody reads — this
 * repo's lesson #14 in a new place: a check that says "no" to everything is a
 * check with no answer.
 *
 * So a translucent colour is compared by its opaque base as well. Only rgb
 * forms, because that is what a person actually writes for a shadow; an
 * `hsla()` would need a conversion, and guessing at one would be inventing
 * agreement rather than finding it.
 */
function opaqueBase(value: string): string | null {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value.trim().toLowerCase());
  if (!m) return null;
  const channels = [m[1], m[2], m[3]].map((n) => Math.round(Number(n)));
  if (channels.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab)\([^)]*\)/g;
const FONT_SIZE = /font-size\s*:\s*([^;}\n]+)/gi;
const RADIUS = /border-radius\s*:\s*([^;}\n]+)/gi;

/**
 * **The two ways a screen can be right, and only one of them is a literal.**
 *
 * A screen built the way the guide asks — *"build against the variables rather
 * than the literals; a screen full of hex codes is a screen that cannot follow
 * the system when it changes"* — contains almost no colours at all, because it
 * says `var(--primary)`. So a `var()` reference is not just excused, it is the
 * GOOD case, and is counted as such.
 *
 * Anything inside a `var(...)` is therefore skipped, including its fallback:
 * `var(--ink, #222)` is a screen naming a token and saying what to do if it is
 * missing, which is careful rather than off-system.
 */
function withoutVarReferences(css: string): { text: string; references: number } {
  let references = 0;
  const text = css.replace(/var\(\s*--[a-zA-Z0-9-]+[^)]*\)/g, (match) => {
    references += 1;
    // Same length, so line numbers computed afterwards still point at the
    // right place — a finding whose line is wrong is a finding nobody trusts.
    return " ".repeat(match.length);
  });
  return { text, references };
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line += 1;
  return line;
}

/**
 * Every value this screen uses that the system never named.
 *
 * `source` is the screen's HTML, read whole — inline `<style>`, a `style=`
 * attribute and a linked stylesheet's contents all look the same to a regex,
 * and all three are equally a place to write a fourth blue.
 */
export function auditScreen(source: string, tokens: DesignTokens): ScreenAudit {
  const { text, references } = withoutVarReferences(source);

  const palette = new Set(Object.values(tokens.colors ?? {}).map(normaliseColour));
  const sizes = new Set(
    Object.values(tokens.typography ?? {})
      .map((t) => (t.fontSize === undefined ? null : normaliseLength(String(t.fontSize))))
      .filter((v): v is string => v !== null),
  );
  const radii = new Set(Object.values(tokens.rounded ?? {}).map((v) => normaliseLength(String(v))));

  const found = new Map<string, OffSystemValue>();
  let onSystem = references;

  const note = (raw: string, kind: OffSystemValue["kind"], known: Set<string>, index: number) => {
    const value = kind === "colour" ? normaliseColour(raw) : normaliseLength(raw);
    // `transparent`, `inherit`, `currentColor` and friends name no colour and
    // belong to no palette; counting them would make every screen fail.
    if (value === "" || /^(inherit|initial|unset|currentcolor|transparent|none|auto)$/.test(value)) return;
    // `0` is the absence of a corner rather than a choice about one, and no
    // design system names it. Lengths only: `#000` is a real colour, and a
    // palette that never named it has been departed from.
    if (kind !== "colour" && /^0[a-z%]*$/.test(value)) return;
    if (known.has(value)) {
      onSystem += 1;
      return;
    }
    // The same colour, dimmed. See `opaqueBase`.
    if (kind === "colour") {
      const base = opaqueBase(value);
      if (base !== null && known.has(base)) {
        onSystem += 1;
        return;
      }
    }
    // A system that named nothing of this kind cannot be departed from. This
    // is the `omitted` case the spec already has a word for: silence is not a
    // rule, and grading against an empty set would report every value on the
    // screen as a violation of nothing.
    if (known.size === 0) return;
    const existing = found.get(`${kind}:${value}`);
    if (existing) existing.count += 1;
    else found.set(`${kind}:${value}`, { value, kind, count: 1, line: lineOf(text, index) });
  };

  for (const m of text.matchAll(COLOUR_LITERAL)) note(m[0], "colour", palette, m.index ?? 0);
  for (const m of text.matchAll(FONT_SIZE)) note(m[1] ?? "", "type size", sizes, m.index ?? 0);
  // A radius shorthand is up to four decisions. See `parts`.
  for (const m of text.matchAll(RADIUS)) {
    for (const piece of parts(m[1] ?? "")) note(piece, "radius", radii, m.index ?? 0);
  }

  return {
    offSystem: [...found.values()].sort((a, b) => b.count - a.count || a.line - b.line),
    onSystem,
  };
}

/** One number for a canvas: how many distinct off-system values its screens
 *  use between them. The thing a persona would watch. */
export function offSystemTotal(audits: ScreenAudit[]): number {
  return audits.reduce((sum, a) => sum + a.offSystem.length, 0);
}
