import { describe, expect, it } from "vitest";
import { type Rule, rules, selectorsOf, sheets } from "./cssrules.ts";

/**
 * **Text that stands on the ground never wears the fill accent.**
 *
 * Reported with a screenshot, smart-contrast phase 0: a selected item's name
 * on a dark canvas, barely there. The rule was
 * `.item.selected .item-titlebar { color: var(--accent) }`, and `--accent` is
 * a FILL colour — brightened in dark so a filled button still reads as
 * selected, and at that value a 3.32:1 ink on the dot grid (3.51 on Galaxy).
 * `--accent-text` is the accent as ink: 8.41 and 8.88 on the same two grounds,
 * and in light the identical cobalt, so the swap is free there.
 *
 * `accent.test.ts` already ratchets `color: var(--accent)` down across the
 * app, but it lets a rule through when the same rule sets a white chip under
 * it — right for a card's own surfaces, wrong here, because a name on the
 * canvas has no chip: what is under it is whatever ground the canvas stands
 * on, which the stylesheet does not choose. So this guard is about WHERE the
 * text is, not what else the rule says: any rule whose selector reaches one
 * of the classes below, as the subject or as an ancestor of it, fails if it
 * paints its text with `--accent`.
 *
 * {@link GROUND_TEXT} is the seed of phase 1's inventory of everything an item
 * draws straight onto the ground. Grow the list; the check stays the same.
 */

/**
 * The selectors whose text stands directly on the canvas ground, not on a
 * card, chip or panel of its own. Each is matched as a selector: every class
 * in it must appear in a rule's selector, the last one in a compound that is
 * the rule's subject or an ancestor of it.
 */
export const GROUND_TEXT: readonly string[] = [
  ".item-titlebar",
  ".name-input",
  ".note-of",
  ".item.textnode .md-view",
  ".kind-icon",
];

/** `.a.b .c` → [["a","b"],["c"]]: the classes of each compound, in order. */
function compounds(selector: string): string[][] {
  return selector
    .split(/\s*[>+~]\s*|\s+/)
    .filter(Boolean)
    .map((part) => [...part.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!));
}

/**
 * Whether one selector (from a rule's list) reaches ground text `target`:
 * some compound holds every class of the target's last compound, and every
 * earlier target compound is matched, in order, by an earlier compound.
 * Anything inside the named element inherits its ground, so a descendant
 * counts — `.item-titlebar b` is still a word on the canvas.
 */
export function reaches(selector: string, target: string): boolean {
  const want = compounds(target);
  const have = compounds(selector);
  let at = 0;
  for (const need of want) {
    while (at < have.length && !need.every((c) => have[at]!.includes(c))) at++;
    if (at === have.length) return false;
    at++;
  }
  return true;
}

/** `color:` (not `background-color:`/`border-color:`) that names the fill
 * accent itself — not `--accent-text`, `--accent-ink` or `--accent-hover`.
 * A `color-mix` of the fill counts too: it is still the fill. */
const PAINTS_FILL_ACCENT = /(^|[;\s])color\s*:[^;]*var\(--accent\)/;

export function fillAccentOnGround(all: Rule[]): string[] {
  const out: string[] = [];
  for (const rule of all) {
    if (!PAINTS_FILL_ACCENT.test(rule.body)) continue;
    for (const selector of selectorsOf(rule)) {
      const hit = GROUND_TEXT.find((target) => reaches(selector, target));
      if (hit) out.push(`${selector}  (reaches ${hit})`);
    }
  }
  return out;
}

describe("text on the ground wears the accent's ink, not its fill", () => {
  it("paints no ground-standing text with var(--accent)", () => {
    const found = sheets.flatMap((s) =>
      fillAccentOnGround(rules(s.text)).map((hit) => `${s.file}: ${hit}`),
    );
    expect(
      found,
      "--accent is a fill colour, 3.32:1 on the dark dot grid as text — use var(--accent-text)",
    ).toEqual([]);
  });

  it("would have caught the rule it was written for", () => {
    const old = rules(".item.selected .item-titlebar { color: var(--accent); }");
    expect(fillAccentOnGround(old)).toEqual([
      ".item.selected .item-titlebar  (reaches .item-titlebar)",
    ]);
  });

  it("reads selectors, not substrings", () => {
    // A descendant of ground text is still on the ground.
    expect(reaches(".item:hover .item-titlebar b", ".item-titlebar")).toBe(true);
    expect(reaches(".item.textnode.selected .md-view p", ".item.textnode .md-view")).toBe(true);
    // A different class that shares a prefix is not this one.
    expect(reaches(".item-titlebar-row", ".item-titlebar")).toBe(false);
    // `.md-view` on a card that is not a text node stands on the card.
    expect(reaches(".item.note .md-view", ".item.textnode .md-view")).toBe(false);
    // The ink tokens are not the fill.
    for (const ink of ["--accent-text", "--accent-ink", "--accent-hover"]) {
      expect(fillAccentOnGround(rules(`.item-titlebar { color: var(${ink}); }`))).toEqual([]);
    }
    expect(fillAccentOnGround(rules(".item-titlebar { border-color: var(--accent); }"))).toEqual([]);
  });
});
