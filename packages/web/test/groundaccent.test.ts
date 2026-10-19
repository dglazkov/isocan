import { describe, expect, it } from "vitest";
import { rules, sheets } from "./cssrules.ts";
import { GROUND_INVENTORY, compounds, fillAccentOnGround, reaches } from "./groundtext.ts";

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
 * text is, not what else the rule says: any rule whose selector reaches a
 * word or a mark on the inventory (`groundtext.ts`), as the subject or as an
 * ancestor of it, fails if it paints with `--accent`.
 *
 * The inventory began here as five selectors and moved beside `cssrules.ts`
 * in phase 1, so this file and `groundcontrast.test.ts` read one list.
 */

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
    expect(reaches(".item.textnode.selected .md-view p", ".item.textnode:not(.paper) .md-view")).toBe(true);
    // A different class that shares a prefix is not this one.
    expect(reaches(".item-titlebar-row", ".item-titlebar")).toBe(false);
    // `.md-view` on a card that is not a text node stands on the card…
    expect(reaches(".item.note .md-view", ".item.textnode:not(.paper) .md-view")).toBe(false);
    // …and so does one on paper, which is a fill of its own.
    expect(reaches(".item.textnode.paper .md-view", ".item.textnode:not(.paper) .md-view")).toBe(false);
    // A class inside `:not()` is one the element does NOT have.
    expect(reaches(".item.entered:not(.textnode) .md-view", ".item.textnode:not(.paper) .md-view")).toBe(false);
    expect(compounds(".a:not(.b, .c) > .d[data-x='e .f']")).toEqual([
      { classes: ["a"], not: ["b", "c"] },
      { classes: ["d"], not: [] },
    ]);
    // A line is its subject's: the card inside a selected item is not a ring.
    expect(reaches(".item.selected .item-titlebar", ".item.selected", false)).toBe(false);
    expect(reaches(".canvas-viewport:not(.pen) .item.selected.hover-target", ".item.hover-target", false)).toBe(true);
    // The ink tokens are not the fill.
    for (const ink of ["--accent-text", "--accent-ink", "--accent-hover"]) {
      expect(fillAccentOnGround(rules(`.item-titlebar { color: var(${ink}); }`))).toEqual([]);
    }
    expect(fillAccentOnGround(rules(".item-titlebar { border-color: var(--accent); }"))).toEqual([]);
  });

  it("names only things the stylesheet actually styles", () => {
    /* An inventory entry nothing matches is a promise the guard cannot keep —
       a renamed class would leave it reading nothing. The subject's classes
       must appear together in some rule's selector, in any sheet. */
    const selectors = sheets.flatMap((s) => rules(s.text)).flatMap((r) => r.selector.split(","));
    const stale = GROUND_INVENTORY.filter(({ selector }) => {
      const subject = compounds(selector).at(-1)!;
      return !selectors.some((one) => compounds(one).some((c) => subject.classes.every((k) => c.classes.includes(k))));
    }).map((e) => e.selector);
    expect(stale).toEqual([]);
  });
});
