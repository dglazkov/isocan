import { describe, expect, it } from "vitest";
import { THEMES, groundPatch, themePatch } from "@isocan/core";

import { TONED, groundTone } from "../src/lib/groundtone.ts";
import { css, rules, selectorsOf } from "./cssrules.ts";

/**
 * **Chrome that washes the ground has to know what the ground is.**
 *
 * Reported 8 Sep 2026: *"when the background is dark, the top fade should be
 * dark, and when it's light it should be light."* The fade was `--ground`,
 * the APP's page ground, on a canvas standing on a starfield — so a person in
 * the light theme got a white bar dissolving into black.
 *
 * The failure mode this file exists for is the SECOND one, not the first: a
 * ground added to `THEMES` with no row in the tone table falls back silently
 * to the app's ground and reintroduces the bug for that ground alone, with
 * everything else still right. The whole point of a table is that a missing
 * row is invisible, so the guard is that there is a row for every name, and
 * that every row names a colour the stylesheet actually declares — a token
 * that does not exist drops the declaration and takes the fade with it.
 */

const declared = (name: string) => new RegExp(`${name}:\\s*[^;]+;`).test(css);

describe("the wash over a canvas knows what it is washing", () => {
  it("has a tone for every ground this build can stand a canvas on", () => {
    /* Not `TONE`'s own keys — that would be the table agreeing with itself.
       The list is core's, so adding a theme there and forgetting this fails
       here rather than in a screenshot. */
    expect(TONED).toEqual(THEMES);
    for (const theme of THEMES) {
      const tone = groundTone({ properties: themePatch(theme).properties as Record<string, string> });
      expect(tone, `${theme} has no ground colour`).not.toBeNull();
      expect(declared(tone!), `${theme} names ${tone}, which the stylesheet does not declare`).toBe(true);
    }
  });

  it("names the same token the ground itself paints with", () => {
    /**
     * The wash and the ground must move together. Asserting the ground's own
     * rule uses the token this hands out is what makes that true by
     * construction rather than by two people remembering — recolour
     * `--theme-ocean` and both the sea and the bar above it change.
     */
    for (const theme of THEMES) {
      const tone = groundTone({ properties: themePatch(theme).properties as Record<string, string> })!;
      /* Every rule that names the class, not the first: the painted grounds
         share one rule for the tile and take a line each for their colour, so
         "the first rule matching" is a fact about source order rather than
         about what the ground paints with. */
      const painting = rules()
        .filter((r) => selectorsOf(r).includes(`.canvas-theme-${theme}`))
        .map((r) => r.body)
        .join("\n");
      expect(painting, `.canvas-theme-${theme} must have a rule`).not.toBe("");
      expect(painting, `${theme}'s ground must paint with ${tone}`).toContain(`var(${tone})`);
    }
  });

  it("gives a picture the backdrop it is composited onto", () => {
    /* No token can name one canvas's photograph. `--ground-under` is what a
       picture is laid on, and a scrimmed picture is dark — so the fade errs
       to the side that reads as ground rather than as a bar. */
    /* A real content address: `groundOf` insists on the sha256 shape, so a
       short fixture would test the parse rather than the tone. */
    const tone = groundTone({ properties: groundPatch("a".repeat(64)).properties as Record<string, string> });
    expect(tone).toBe("--ground-under");
    expect(declared(tone!)).toBe(true);
  });

  it("says nothing about a canvas that has no ground of its own", () => {
    /* The fallback in the stylesheet is the app's `--ground`, which was right
       for every canvas before grounds existed and is still right here. A tone
       invented for a plain canvas would be a third answer to a settled
       question. */
    expect(groundTone({})).toBeNull();
    expect(groundTone(null)).toBeNull();
  });
});
