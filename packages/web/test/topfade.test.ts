import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HIDEABLE } from "../src/lib/hideable.ts";

/**
 * **The top fade** — the wash of the ground under the top controls, the
 * effect Stitch has at the top of a scrolled canvas. Structural: it is the
 * page's own ground token in both themes rather than a colour of its own,
 * it sits over the items and under the chrome with no pointer target, and
 * it is chrome a person can turn off and get back by every door the
 * registry promises.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");
const page = read("../src/pages/CanvasPage.tsx");
const actions = read("../src/lib/actions.ts");

describe("the top fade", () => {
  it("is the ground token fading to nothing — white on light, near-black on dark, by construction", () => {
    const rule = css.slice(css.indexOf(".top-fade {"), css.indexOf("}", css.indexOf(".top-fade {")));
    expect(rule).toContain("linear-gradient(to bottom, var(--ground), transparent)");
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it("lies over the items and under the chrome, and is not a pointer target", () => {
    const rule = css.slice(css.indexOf(".top-fade {"), css.indexOf("}", css.indexOf(".top-fade {")));
    expect(rule).toContain("z-index: var(--z-canvas)");
    expect(rule).toContain("pointer-events: none");
    expect(page).toContain('<div className="top-fade" aria-hidden />');
  });

  it("is chrome you can turn off: in the registry, with the palette as its other door", () => {
    const entry = HIDEABLE.find((e) => e.id === "canvas.topfade");
    expect(entry).toMatchObject({ where: "the top edge", command: "top-fade" });
    expect(page).toContain('useChromeHidden("canvas.topfade")');
    expect(page).toContain("{!topFadeHidden && ");
    expect(actions).toContain('id: "top-fade"');
  });
});
