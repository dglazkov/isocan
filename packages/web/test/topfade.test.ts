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
  it("fades from the ground it is washing, and names no colour of its own", () => {
    /**
     * It used to fade from `--ground` — the APP's page ground — which is
     * right on a canvas with no ground and wrong on every canvas with one.
     * Reported 8 Sep 2026 from a Space Galaxy canvas in the light theme: a
     * white bar dissolving into a starfield. The invariant is that the fade
     * begins at the colour of whatever it is over, so the assertion is that
     * the canvas's own ground comes FIRST and the app's is only the fallback.
     */
    const rule = css.slice(css.indexOf(".top-fade {"), css.indexOf("}", css.indexOf(".top-fade {")));
    expect(rule).toContain("linear-gradient(to bottom, var(--canvas-ground, var(--ground)), transparent)");
    expect(rule, "a colour of its own is a colour that cannot follow the ground").not.toMatch(
      /#[0-9a-f]{3,8}\b|rgba?\(/i,
    );
    expect(page, "the page must hand it the canvas's ground").toContain("--canvas-ground");
  });

  it("lies over the items and under the chrome, and is not a pointer target", () => {
    const rule = css.slice(css.indexOf(".top-fade {"), css.indexOf("}", css.indexOf(".top-fade {")));
    expect(rule).toContain("z-index: var(--z-canvas)");
    expect(rule).toContain("pointer-events: none");
    /* The element itself: named, and hidden from the accessibility tree —
       it is a wash, and a screen reader has no ground to read it against.
       Asserted as its two facts rather than as one line of JSX, because the
       line grew a style attribute and the facts did not change. */
    expect(page).toContain('className="top-fade"');
    expect(page.slice(page.indexOf('className="top-fade"')), "still hidden from a reader").toMatch(
      /^[^>]*aria-hidden/,
    );
  });

  it("is chrome you can turn off: in the registry, with the palette as its other door", () => {
    const entry = HIDEABLE.find((e) => e.id === "canvas.topfade");
    expect(entry).toMatchObject({ where: "the top edge", command: "top-fade" });
    expect(page).toContain('useChromeHidden("canvas.topfade")');
    expect(page).toContain("{!topFadeHidden && ");
    expect(actions).toContain('id: "top-fade"');
  });
});
