import type { Rule } from "./cssrules.ts";
import { selectorsOf } from "./cssrules.ts";

/**
 * **What an item draws straight onto the ground** — the inventory smart
 * contrast is built on (design §2), and the reader its guards share.
 *
 * The rule for what is on it: an element is here if, and only if, the pixels
 * behind its ink are the canvas's ground. Anything with its own opaque fill —
 * the `×11` version badge, the size chip under a card, a paper note, a comment
 * pin, the glass toolbar — is not, because its ink is measured against its
 * own fill and the app's tokens are already right for it.
 *
 * Three kinds of ink, because they answer to different floors and are found
 * in different properties:
 *
 * - `text` — words (`CONTRAST_BODY`). A descendant counts: a word inside the
 *   name row stands where the row stands.
 * - `mark` — a glyph or icon that is not a word (`CONTRAST_UI`). Descendants
 *   count, for the same reason.
 * - `line` — an outline or border drawn around a thing (`CONTRAST_UI`). The
 *   subject only: the selection ring is `.item.selected`'s outline, and the
 *   card inside a selected item is not on the ground.
 *
 * Phase 0 began this as five text selectors (`GROUND_TEXT`); this is that
 * list grown, one list rather than two. `groundaccent.test.ts` reads it today;
 * phase 2's "the inventory holds" reads it once the tier exists.
 */
export type GroundInk = "text" | "mark" | "line";

/** One thing on the ground: a selector as `reaches` reads it, what kind of
 *  ink it carries, and why it is here rather than on a surface of its own. */
export interface OnTheGround {
  selector: string;
  ink: GroundInk;
  why: string;
}

export const GROUND_INVENTORY: readonly OnTheGround[] = [
  // The name row above every card, and everything in it.
  { selector: ".item-titlebar", ink: "text", why: "the name row sits 6px above the card, on the ground" },
  { selector: ".name-input", ink: "text", why: "the name being renamed, in place, with a transparent field" },
  { selector: ".kind-icon", ink: "mark", why: "the kind glyph ahead of the name" },
  { selector: ".file-mark", ink: "mark", why: "the file-state square in the name row" },
  { selector: ".item-open-source", ink: "mark", why: "the ↗ in the name row, no fill until hovered" },
  { selector: ".browser-reload", ink: "mark", why: "the ↻ in a site's name row" },
  { selector: ".memory-mark", ink: "text", why: "a hairline pill in the name row; its active wash is translucent" },
  { selector: ".doc-live-toggle", ink: "text", why: "a hairline pill in the name row; its active wash is translucent" },
  // A text node is a caption with no card; paper gives it one.
  { selector: ".item.textnode:not(.paper) .md-view", ink: "text", why: "a chromeless note's words" },
  { selector: ".item.textnode:not(.paper) .text-mark", ink: "text", why: "a far-away note's opening words" },
  { selector: ".note-of", ink: "text", why: "the speaker-note caption, above the note even on paper" },
  { selector: ".text-composer:not(.on-paper) textarea", ink: "text", why: "a note being typed, onto the canvas: a transparent field" },
  // Groups: the frame is a 40% wash, the band label stands on it.
  { selector: ".item.canvas-group .area-title", ink: "text", why: "a group's band label" },
  { selector: ".stack-band", ink: "text", why: "a stacked group's band; the stacked frame is transparent" },
  { selector: ".group-column-label", ink: "text", why: "a group grid's column name" },
  { selector: ".group-row-label", ink: "text", why: "a group grid's row name" },
  // The lines drawn around things, outside their box.
  { selector: ".item.selected", ink: "line", why: "the selection ring, outside the card" },
  { selector: ".item.hover-target", ink: "line", why: "the hover dash, 2px outside the card" },
  { selector: ".item.reach-inside", ink: "line", why: "the ⌘ group outline" },
  { selector: ".item.reach-among", ink: "line", why: "the ⌘ member outline" },
  { selector: ".item.peeked", ink: "line", why: "the frame of a thing pointed at from a pill" },
  { selector: ".item.group-drop-target", ink: "line", why: "the frame a drop would land in" },
  { selector: ".marquee", ink: "line", why: "the selection box, a translucent wash on the ground" },
  { selector: ".guide", ink: "line", why: "an alignment guide" },
  { selector: ".spacing", ink: "line", why: "an equal-spacing measure" },
];

/** A selector's compounds, each as the classes it requires and the classes it
 *  refuses (`:not(.x)`). Attribute selectors and other functional
 *  pseudo-classes are dropped: `:is(h1, h2)` names no class this reads, and a
 *  class inside `:not()` is the opposite of a class the element has. */
export function compounds(selector: string): { classes: string[]; not: string[] }[] {
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of selector.replace(/\[[^\]]*\]/g, "")) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      if (cur) parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) parts.push(cur);
  const classesIn = (s: string) => [...s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
  return parts.map((part) => ({
    classes: classesIn(part.replace(/:[\w-]+\((?:[^()]|\([^()]*\))*\)/g, "")),
    not: [...part.matchAll(/:not\(([^()]*)\)/g)].flatMap((m) => classesIn(m[1]!)),
  }));
}

/**
 * Whether one selector (from a rule's list) reaches `target`: each of the
 * target's compounds is matched, in order, by a compound of the selector that
 * has every class it requires and none it refuses. With `descendants` (text
 * and marks) the last may be matched anywhere, so `.item-titlebar b` is still
 * a word on the ground; without it (lines) it must be the selector's subject.
 */
export function reaches(selector: string, target: string, descendants = true): boolean {
  const want = compounds(target);
  const have = compounds(selector);
  const fits = (need: (typeof want)[number], got: (typeof have)[number]) =>
    need.classes.every((c) => got.classes.includes(c)) && !need.not.some((c) => got.classes.includes(c));
  let at = 0;
  for (const [i, need] of want.entries()) {
    const last = i === want.length - 1;
    if (last && !descendants) return at < have.length && fits(need, have[have.length - 1]!);
    while (at < have.length && !fits(need, have[at]!)) at++;
    if (at === have.length) return false;
    at++;
  }
  return true;
}

/** The inventory entry a selector reaches, if any. */
export function onTheGround(selector: string): OnTheGround | undefined {
  return GROUND_INVENTORY.find((entry) => reaches(selector, entry.selector, entry.ink !== "line"));
}

/** `color:` (not `background-color:`/`border-color:`) that names the fill
 * accent itself — not `--accent-text`, `--accent-ink` or `--accent-hover`.
 * A `color-mix` of the fill counts too: it is still the fill. */
const PAINTS_FILL_ACCENT = /(^|[;\s])color\s*:[^;]*var\(--accent\)/;

/** Every selector that paints words or marks on the ground in the fill
 *  accent — the phase 0 guard. Lines are not read here: their colour is an
 *  outline's, and the accent as a ring is phase 2's to move. */
export function fillAccentOnGround(all: Rule[]): string[] {
  const out: string[] = [];
  for (const rule of all) {
    if (!PAINTS_FILL_ACCENT.test(rule.body)) continue;
    for (const selector of selectorsOf(rule)) {
      const hit = GROUND_INVENTORY.find((e) => e.ink !== "line" && reaches(selector, e.selector));
      if (hit) out.push(`${selector}  (reaches ${hit.selector})`);
    }
  }
  return out;
}

/** The app's own inks — measured against the app's surfaces, not the ground.
 *  Exact names: `--accent-wash`, `--ink-on-x` and friends are other tokens. */
const APP_INK = /var\(--(ink|ink-muted|ink-soft|accent|accent-text)\)/;

/** The properties whose colour is ink: the text colour, and every way a
 *  border or outline can be given one (the shorthands included). */
const INK_PROPERTY = /^(color|outline|outline-color|border|border-color|border-(top|right|bottom|left)(-color)?)$/;

/** A rule that gives its element an opaque fill of its own — a hovered ↗ on
 *  `--chip`, say — has stepped off the ground for that state, and its ink is
 *  measured against the fill. The tokens are the opaque surfaces only. */
const OWN_FILL = /(^|[;\s])background(-color)?\s*:\s*var\(--(chip|card|panel|accent|paper)\)/;

/**
 * **The inventory holds** (design §6): every rule that reaches something on
 * the ground and names one of the app's inks for its colour, border or
 * outline, as `selector  property: value`. Only the ground tier
 * (`--ground-ink*`, `--ground-accent`, `--ground-ring`) may paint there — the
 * same shape as `dimmed.test.ts`, which refuses faded text on sight.
 */
export function appInkOnGround(all: Rule[]): string[] {
  const out: string[] = [];
  for (const rule of all) {
    if (OWN_FILL.test(rule.body)) continue;
    const inked = rule.body
      .split(";")
      .map((d) => d.split(/:(.*)/s).map((s) => s.trim()))
      .filter(([prop, value]) => prop && value && INK_PROPERTY.test(prop) && APP_INK.test(value));
    if (inked.length === 0) continue;
    for (const selector of selectorsOf(rule)) {
      if (!onTheGround(selector)) continue;
      for (const [prop, value] of inked) out.push(`${selector}  ${prop}: ${value}`);
    }
  }
  return out;
}
