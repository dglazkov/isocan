import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const layer = read("../src/components/CursorLayer.tsx");
const own = read("../src/components/OwnCursor.tsx");

/**
 * **A ground gives everybody a cursor, and takes nobody's colour** (#195).
 *
 * The themed cursor is half of that issue's title and shipped without being
 * built — the grounds landed, the costume did not, and Dion found it a day
 * later. These hold the two things that would make building it worse than not
 * having it.
 */
describe("the cursor wears the ground", () => {
  it("draws whatever the theme says, in both places", () => {
    // Two components draw a cursor and they must not drift: `themeCursor` in
    // core is the one fold, the same rule the minimap's kind colours were
    // rewritten for on 6 Sep.
    for (const [name, src] of [["CursorLayer", layer], ["OwnCursor", own]] as const) {
      expect(src, `${name} asks core for the shape`).toContain("themeCursor(");
      expect(src, `${name} spells no path of its own`).not.toMatch(/d="M1\.5 0\.5/);
    }
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
    /* These redraw on every pointer move. Selecting the PATH keeps that cheap;
       taking the whole project would re-render every cursor whenever anything
       on the canvas changed — the shape of the bug that burned a core for two
       days on 6 Sep. */
    for (const src of [layer, own]) {
      expect(src).toMatch(/useCanvasStore\(\(s\) => themeCursor\(/);
    }
  });
});
