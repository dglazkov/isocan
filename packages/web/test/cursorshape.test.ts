import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const layer = read("../src/components/CursorLayer.tsx");
const own = read("../src/components/OwnCursor.tsx");
const hook = read("../src/lib/wearscursor.ts");

/**
 * **A ground gives everybody a cursor, and takes nobody's colour** (#195).
 *
 * The themed cursor is half of that issue's title and shipped without being
 * built — the grounds landed, the costume did not, and Dion found it a day
 * later. These hold the two things that would make building it worse than not
 * having it.
 */
describe("the cursor wears the ground", () => {
  it("draws whatever the canvas says, in both places", () => {
    /**
     * Two components draw a cursor and they must not drift: core holds the one
     * fold, the same rule the minimap's kind colours were rewritten for on
     * 6 Sep.
     *
     * **This case has now been rewritten twice for naming the mechanism**, and
     * that is the finding rather than an annoyance. It said `themeCursor`,
     * then `canvasCursor`, and both times it failed on components that were
     * still correct — because the fold kept moving as the feature grew: up a
     * level when a picture ground had no theme to derive from (8 Sep), and
     * into a hook when the shapes went behind an `import()` so a canvas with
     * no ground fetches none of them (9 Sep).
     *
     * The invariant never moved. **Both components get the shape from ONE
     * place, and neither spells a path of its own.** That is what is asserted
     * now: not which function, but that there is a single one and they both
     * use it.
     */
    const asked = new Set<string>();
    for (const [name, src] of [["CursorLayer", layer], ["OwnCursor", own]] as const) {
      const call = /(\w+)\(\)/.exec(/const cursorPath = ([^;]+);/.exec(src)?.[1] ?? "");
      expect(call, `${name} must get its shape from a shared fold`).toBeTruthy();
      asked.add(call![1]!);
      expect(src, `${name} spells no path of its own`).not.toMatch(/d="M1\.5 0\.5/);
    }
    expect(asked.size, "both must ask the SAME question, or the two can drift").toBe(1);
  });

  it("keeps the actor's colour, which is the whole risk", () => {
    /* Seven `IDENTITY_COLORS` also land on items during remote selection, so a
       cursor that carried the theme's colour instead would delete the one
       signal that says who is who. The issue's words: "a sheep that makes six
       people identical is a regression dressed as a feature." */
    for (const [name, src] of [["CursorLayer", layer], ["OwnCursor", own]] as const) {
      expect(src, `${name} still fills with the actor's colour`).toMatch(/fill=\{color\}/);
    }
  });

  it("reads the ground without re-rendering on every op", () => {
    /* Cursors redraw on every pointer move. The store selector must RESOLVE to
       a value — a string — so zustand compares by value and an unrelated op
       does not re-render every cursor on the canvas. Taking the whole project
       is the shape of the bug that burned a core for two days on 6 Sep.

       It lives in the hook now rather than in each component, which is the
       point of having a hook: one selector to get right instead of two. */
    expect(hook, "the selector must resolve to a value").toMatch(
      /useCanvasStore\(\(s\) => \w+\(s\.project/,
    );
    expect(hook, "and never hand back the whole project").not.toMatch(
      /useCanvasStore\(\(s\) => s\.project\)/,
    );
  });
});
