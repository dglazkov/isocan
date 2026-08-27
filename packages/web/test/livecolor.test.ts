import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A colour you just chose has to appear on the thing you chose it for.**
 *
 * `lib/colors.ts` offers the same answer in two spellings, and the difference
 * is invisible at the call site:
 *
 *   - `actorColor(id)` reads `getState()` ONCE. For a stroke's ink, or for
 *     building a style string — places a hook cannot go.
 *   - `useActorColor(id)` / `useActorColors()` SUBSCRIBE, so the component
 *     repaints when somebody picks a colour.
 *
 * Your own cursor used the first. It kept whatever colour it was last painted
 * with and only changed on a reload — reported exactly that way. Picking a
 * colour is a thing you do in order to watch it happen, and the one surface
 * where it must be live is the pointer under your hand.
 *
 * Guarded by name rather than by a blanket rule, because the imperative form
 * is CORRECT elsewhere in a component: `CanvasViewport` captures the ink
 * colour inside a pointerdown handler, which is precisely the case the
 * imperative spelling exists for. A rule that banned it from `.tsx` would be
 * wrong about that one and would teach the next person the wrong lesson.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("every cursor paints the colour that is current now", () => {
  it("paints your own cursor from a subscription", () => {
    const src = read("../src/components/OwnCursor.tsx");
    expect(src, "the pointer under your hand must repaint on a colour change").toMatch(
      /useActorColor\(/,
    );
    // The IMPORT, not the text: the file's own comment explains the bug it
    // once had and quotes the wrong call, so matching source characters would
    // fail on the explanation. What must not come back is the dependency.
    const imports = src.slice(0, src.indexOf("export"));
    expect(imports, "importing the one-shot read is how this regressed").not.toMatch(
      /\bactorColor\b/,
    );
  });

  it("paints everybody else's cursors from a subscription too", () => {
    const src = read("../src/components/CursorLayer.tsx");
    expect(src).toMatch(/useActorColors\(\)/);
  });

  it("still allows the imperative read where a hook cannot go", () => {
    // Not an exception grudgingly kept: a stroke's colour is decided once, at
    // pointer-down, and must NOT change under the person mid-drag.
    const src = read("../src/components/CanvasViewport.tsx");
    expect(src, "capturing ink at pointer-down is the imperative form's job").toMatch(
      /actorColor\(actor\.id\)/,
    );
  });
});
