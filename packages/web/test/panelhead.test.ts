import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";

/**
 * **Every dock panel wears the same header, and this is what makes that true.**
 *
 * The Personas panel shipped with its icon on top of its own title, no padding
 * and no rule beneath it. Nothing was subtly wrong: five panels each
 * hand-rolled a `<header>`, four of them had a private CSS rule to lay it out,
 * and those four rules were **byte-identical**. Personas was the fifth and
 * never got a copy, so its header fell back to `display: block`.
 *
 * The lesson is not "somebody forgot a rule". It is that **four correct copies
 * cannot notice a missing fifth** — and the copy is always correct on the day
 * it is made, which is why review does not catch this and a month later the
 * panel is shipped broken.
 *
 * So the guard is derived rather than listed: it finds the dock panels by
 * reading which components render `dock-panel`, and requires each to use the
 * shared header. A panel added next month is covered by a test written today,
 * without anybody remembering to add it here — which is the only kind of guard
 * that would actually have prevented this.
 */
const dir = fileURLToPath(new URL("../src/components/", import.meta.url));
const read = (file: string) => readFileSync(dir + file, "utf8");
const bare = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Components whose root is a dock panel — found, not listed. */
const dockPanels = readdirSync(dir)
  .filter((f) => f.endsWith(".tsx") && f !== "PanelHead.tsx")
  .filter((f) => /className="[^"]*\bdock-panel\b/.test(bare(read(f))));

describe("the dock panels", () => {
  it("were found at all — a guard that matches nothing proves nothing", () => {
    /* If the class is renamed this test would quietly pass over an empty list,
       which is the failure this repo keeps finding in its own instruments. */
    expect(dockPanels.length).toBeGreaterThanOrEqual(4);
  });

  it("all use the shared header", () => {
    const offenders = dockPanels.filter((f) => !bare(read(f)).includes("<PanelHead"));
    expect(offenders).toEqual([]);
  });

  it("none of them hand-rolls a <header>", () => {
    /* The specific thing that went wrong: a `<header>` written by hand needs a
       CSS rule written by hand, and nothing pairs the two. */
    const offenders = dockPanels.filter((f) => /<header[\s>]/.test(bare(read(f))));
    expect(offenders).toEqual([]);
  });
});

describe("the header's stylesheet", () => {
  const sheet = rules(withoutComments());

  it("lays the DOCK panels' header out in exactly one place", () => {
    /* The duplication itself, guarded: any surviving `…-panel header` rule
       that sets layout is the fifth copy waiting to be forgotten.
     *
     * Two panels are deliberately not in the family and keep their own, which
     * is a decision rather than an oversight. `Trash` has no glyph and no
     * hint and its close is a different control; `Help` is a popover, not a
     * panel in the dock. Dressing either as a dock panel would be a redesign
     * rather than a repair — so they are named here, and anything else that
     * appears in this list is the bug coming back. */
    /* `.modal-card` replaced `.help-panel`: one shell, worn by the shortcut
       list and by What's new, so the two cannot drift. See Modal.tsx. */
    const allowed = new Set([".trash-panel header", ".trash-panel header .spacer", ".modal-card header", ".modal-card header .spacer"]);
    const perPanel = sheet.filter(
      (r) =>
        /-panel header\b/.test(r.selector) &&
        /display\s*:|padding\s*:/.test(r.body) &&
        !allowed.has(r.selector),
    );
    expect(perPanel.map((r) => r.selector)).toEqual([]);
  });

  it("is a flex row with room between the glyph and the name", () => {
    /* The bug, stated as the thing that must hold: `display: block` is what
       put the icon on the word, and no `gap` is what left them touching. */
    const head = sheet.find((r) => r.selector === ".panel-head");
    expect(head?.body).toMatch(/display:\s*flex/);
    expect(head?.body).toMatch(/align-items:\s*center/);
    expect(head?.body).toMatch(/gap:\s*\d/);
    expect(head?.body).toMatch(/padding:\s*\d/);
  });

  it("takes its colours from tokens, so both themes get a header", () => {
    for (const r of sheet.filter((r) => /\.panel-(head|glyph|hint|count)/.test(r.selector))) {
      expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
