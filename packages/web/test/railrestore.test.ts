import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A remembered rail is restored before the first paint.**
 *
 * The restore used to wait for `canvas` — a network round-trip — so for that
 * whole time the store said "closed" and everything positioned against the
 * rail was drawn in the wrong place. When the canvas landed the rail opened
 * and the minimap slid 340px across the screen on its own transition.
 *
 * Reported as "the minimap icon jumps across from the left on reload", and it
 * was never a minimap bug: it was a restore that happened too late, and a
 * transition doing exactly what it was told with a wrong starting point.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

describe("the rail comes back where it was, without travelling there", () => {
  it("applies a remembered choice without waiting for the canvas", () => {
    // The stored choice is a string in localStorage and needs nothing from
    // the network. Only "nobody has ever chosen here" has to wait, because
    // "open if this canvas already has a Chat" is a question about the canvas.
    const panel = read("components/MainThreadPanel.tsx");
    const layout = panel.slice(panel.indexOf("useLayoutEffect(()"), panel.indexOf("}, [canvasId]);"));
    expect(layout, "the remembered choice must be applied in a layout effect").toMatch(
      /openPanel\(canvasId, stored, false\)/,
    );
    expect(layout, "and it must not depend on the canvas having loaded").not.toMatch(/!canvas/);
  });

  it("does not animate the minimap into its first position", () => {
    // `left` eases over 0.22s, which is right for opening a rail and wrong
    // for arriving. The first position is where the map BELONGS, not
    // somewhere it moved to.
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.minimap-dock:not\(\.placed\) \{ transition: none; \}/);
  });

  it("becomes placed on a timer, not a frame", () => {
    /**
     * The phase-2 lesson applied rather than relearned: `requestAnimationFrame`
     * does not fire in a hidden tab. A canvas opened in a background tab would
     * never become `.placed`, and would keep its transition disabled until
     * somebody looked at it. The first version of this fix used rAF and was
     * caught by the harness reporting `placed: false` forever.
     */
    const map = read("components/Minimap.tsx");
    const effect = map.slice(map.indexOf("const [placed, setPlaced]"), map.indexOf("}, []);") + 8);
    expect(effect).toMatch(/setTimeout\(/);
    expect(effect, "rAF does not fire in a hidden tab").not.toMatch(/requestAnimationFrame/);
  });
});
