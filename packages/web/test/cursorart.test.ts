import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CURSORS, THEMES, themeCursorName } from "@isocan/core";

import { ARROW } from "../src/lib/arrow.ts";
import { CURSOR_ART } from "../src/lib/cursorart.ts";

/**
 * **The drawings, in the surface that draws them** (9 Sep 2026).
 *
 * These assertions used to live in `core/test/theme.test.ts`, and they moved
 * with the paths. Dion, reading the size gate's answer about what a cursor
 * costs a first visit: *"A cursor should only be loaded if a theme is
 * loaded."* Core is one barrel with no subpath exports, so there was no way to
 * make part of it arrive later — the paths went to the only place that draws
 * them, and core kept the decision.
 *
 * What this file has to hold, beyond the shapes themselves, is the SEAM: core
 * names a cursor and this module draws one, and nothing but a test can notice
 * the day those two lists stop agreeing. A name with no drawing is a pointer
 * that vanishes.
 */

describe("the shapes a cursor can be drawn as", () => {
  it("draws every name core can hand it, and no name it cannot", () => {
    /**
     * The seam. `CURSORS` is core's vocabulary and this table is the web's
     * answer to it; a name in one and not the other is a cursor that either
     * cannot be drawn or cannot be chosen, and neither announces itself at
     * runtime — the first is a blank pointer, the second is dead bytes.
     */
    expect(Object.keys(CURSOR_ART).sort()).toEqual([...CURSORS].sort());
  });

  it("draws the cursor every ground asks for", () => {
    /* The other half of the seam, one step up: a theme names a cursor, and
       that name has to be drawable. Adding a ground without a shape leaves the
       canvas wearing an arrow that means "no ground" on a canvas that has one. */
    for (const theme of THEMES) {
      expect(CURSOR_ART[themeCursorName(theme)], `${theme} names an undrawable cursor`).toBeTruthy();
    }
  });

  it("starts every shape at the hotspot, so the thing still points", () => {
    /* A cursor's tip is where the click lands. A shape whose mass sits below
       and right of (1.5, 0.5) is a decoration you have to aim; every path
       begins there for that reason — including the sparkle, whose long
       upper-left ray is a pointer before it is a star. */
    for (const [name, path] of Object.entries(CURSOR_ART)) {
      expect(path.startsWith("M1.5 0.5"), `${name} points`).toBe(true);
    }
  });

  it("gives every shape a silhouette of its own", () => {
    /* Two entries that look alike at the size they are used is a picker that
       costs a decision and returns nothing — which is why a leaf and a petal
       were drawn, rendered at 18, and rejected for being the fish without its
       tail. Identical paths are the case a machine can catch; the rest is a
       person looking, and that is what the note in `cursorart.ts` records. */
    expect(new Set(Object.values(CURSOR_ART)).size).toBe(CURSORS.length);
  });

  it("carries no colour of its own", () => {
    /* The constraint #195 is emphatic about, and the reason a cursor is CHOSEN
       rather than uploaded: an image cannot be tinted, so six people would
       share one pointer and the only signal saying who is who would be gone. */
    for (const [name, path] of Object.entries(CURSOR_ART)) {
      expect(path, `${name} brought a colour`).not.toMatch(/#|rgb|fill|hsl/);
    }
  });

  it("keeps the shapes out of what a first visit downloads", () => {
    /**
     * **The first version of this case asserted the wrong thing and passed.**
     *
     * It checked that `wearscursor.ts` reached the table through `import()`
     * and imported nothing else statically. Both were true, and all seven
     * paths were still in the entry chunk — because `ARROW` was exported from
     * `cursorart.ts` too, and a bundler merges a module that is imported both
     * ways, turning the dynamic import into a no-op. The split saved 12 bytes
     * and cost 81. Lesson #4, exactly: a test written around the keystroke
     * instead of the invariant.
     *
     * So this reads the BUILT chunks. The invariant is not "there is a dynamic
     * import", it is "the shapes are not in the first download" — which stays
     * true however somebody later rearranges the modules, and goes red the
     * moment a static importer appears anywhere in the app.
     *
     * Skipped rather than failed when `dist` is stale, in the shape
     * `bundle-budget.test.ts` already uses: a guard that fails because nobody
     * has built is a guard people learn to ignore.
     */
    const dist = fileURLToPath(new URL("../dist/assets/", import.meta.url));
    let chunks: string[];
    try {
      chunks = readdirSync(dist).filter((f) => f.endsWith(".js"));
    } catch {
      return; // never built here
    }
    const entry = chunks
      .filter((f) => f.startsWith("index-"))
      .map((f) => ({ f, size: statSync(dist + f).size }))
      .sort((a, b) => b.size - a.size)[0];
    if (!entry) return;
    const src = fileURLToPath(new URL("../src/lib/cursorart.ts", import.meta.url));
    if (statSync(src).mtimeMs > statSync(dist + entry.f).mtimeMs) return; // stale build

    const first = readFileSync(dist + entry.f, "utf8");
    const everything = chunks.map((f) => readFileSync(dist + f, "utf8")).join("\n");
    for (const [name, path] of Object.entries(CURSOR_ART)) {
      if (name === "arrow") continue;
      expect(first.includes(path), `${name} is in the first download`).toBe(false);
      expect(everything.includes(path), `${name} is in no chunk at all`).toBe(true);
    }
    // And the arrow IS there, because every canvas draws it — including for
    // the frame before a themed shape arrives.
    expect(first.includes(ARROW), "the arrow must not be lazy").toBe(true);
  });
});
