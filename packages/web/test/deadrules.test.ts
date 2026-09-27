import { describe, expect, it } from "vitest";
import { rules, selectorsOf, sheets } from "./cssrules.ts";
import { classesOf, namedBy, sources } from "./cssuse.ts";

/**
 * **A rule nothing renders is a rule nobody can see go wrong.**
 *
 * BC-3, 27 Sep 2026. `styles.css` carried 46 rules and two selectors in
 * shared lists whose classes no source file names anywhere — the panel switch
 * the dock outgrew, the Shelf's glyph and badge, full screen's old bar, a
 * whole questionnaire card vocabulary (`.q-choice-card`, `.q-opt-*`,
 * `.q-dropzone`, chips) that the dock was rebuilt without. Two guards were
 * still asserting on them: `worldchrome.test.ts` held `.chrome-right` to
 * `margin-left: auto` a month after the star it placed left the row, and
 * `accent.test.ts` listed `.shelf-glyph` as a debt to pay. A dead rule is not
 * inert: it is read by every guard that walks the sheet, it is what a search
 * for a class name finds first, and it is copied by whoever wants that look.
 *
 * "Dead": a selector requiring a class that no source names — what "names"
 * means, and why it errs towards "used", is `cssuse.ts`.
 */

const used = namedBy(sources);

/** Every selector, in every sheet the page loads, naming a class no source does. */
function deadSelectors(): string[] {
  const dead: string[] = [];
  for (const sheet of sheets) {
    for (const rule of rules(sheet.text)) {
      for (const selector of selectorsOf(rule)) {
        const missing = classesOf(selector).filter((c) => !used(c));
        if (missing.length) dead.push(`${sheet.file}: ${selector}   (nothing renders .${missing.join(", .")})`);
      }
    }
  }
  return dead;
}

describe("the stylesheets", () => {
  it("read some source to judge by", () => {
    // A walk that finds nothing makes every class dead, and a walk that finds
    // the wrong thing makes every class live; both are a broken instrument,
    // and only the second is silent (lessons.md #8).
    expect(sources.length, "no sources read — the walk is wrong").toBeGreaterThan(300);
    expect(used("item-titlebar"), "a class ItemView plainly renders reads as unused").toBe(true);
    expect(used("zq-nobody-renders-this"), "an invented class reads as used — the walk is too generous").toBe(
      false,
    );
  });

  it("hold no rule for a class nothing renders", () => {
    expect(
      deadSelectors(),
      "delete the rule (or the selector from its list); if the class is built at runtime, " +
        "keep its stem with the hyphen in the source (`kind-${kind}`) so it can be found",
    ).toEqual([]);
  });
});
