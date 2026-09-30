import { describe, expect, it } from "vitest";
import { rules } from "./cssrules.ts";

/**
 * **The stylesheet half of `cursorhotspot.test.ts`**: a marked pointer's tip
 * stays on the hotspot because nothing in CSS is allowed to move it.
 */
describe("the stylesheet keeps the tip on the hotspot", () => {
  const all = rules();
  const body = (selector: string) => all.find((rule) => rule.selector === selector)?.body ?? "";

  it("shrinks the arrow in place — a size, never an offset", () => {
    // The arrow's point is at the top-left of its viewBox, so resizing it
    // about that corner keeps the point where it was; a margin, position or
    // transform here would move every pointer on the canvas off its target.
    const shrink = body(".remote-cursor.marked svg");
    expect(shrink).toMatch(/width:\s*9px/);
    expect(shrink).not.toMatch(/margin|transform|translate|position|left|top/);
  });

  it("lays the glyph over the arrow's body, out of flow and a fixed screen size", () => {
    // Absolute, so it cannot push the tip; px rather than a calc over
    // `--scale`, because this layer is screen space and must not zoom.
    const glyph = body(".cursor-glyph");
    expect(glyph).toMatch(/position:\s*absolute/);
    expect(glyph).toMatch(/font-size:\s*22px/);
    expect(glyph).not.toContain("--scale");
  });
});
