import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Where the pan is wired, which is the half a pure function cannot prove.**
 *
 * `railpan.test.ts` proves the arithmetic. These are the four ways the
 * arithmetic can be correct and the feature still wrong: panning on load,
 * panning from the wrong door, taking the wheel off somebody who was
 * following a colleague, and animating for a person who cannot see it.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

describe("the rail pan is wired to the doors and to nothing else", () => {
  it("does not pan when a remembered rail is restored on load", () => {
    /**
     * The failure this prevents is silent and cumulative: a canvas that
     * scrolls 340px sideways every time it is opened. The restored viewport
     * was SAVED with the rail open, so it is already correct, and panning it
     * again compensates twice for one rail.
     *
     * Verified in the browser as well as here: with the Chat restored open,
     * a reload moves the camera by the same ~15px the app already drifts with
     * the rail SHUT, and not by the 340 this would add.
     */
    const panel = read("components/MainThreadPanel.tsx");
    const call = /openPanel\(canvasId, stored[^\n]*\)/.exec(panel)?.[0] ?? "";
    expect(call, "the restore call must exist to be checked").not.toBe("");
    expect(call, "the mount restore must opt out of the pan").toMatch(/,\s*false\s*\)/);
    // And the toggles must NOT opt out — they are the whole feature.
    expect(panel).toMatch(/openPanel\(canvasId, open \? "main" : null\)/);
  });

  it("routes every width change through the door that pans", () => {
    // The drag, the arrow keys, Home and the double-click reset all land on
    // the resizer's `onChange`. If that default goes back to `setPanelWidth`,
    // the canvas stops tracking the edge under the hand and only the open and
    // close cases still work — which reads as the feature half-breaking.
    const resizer = read("components/PanelResizer.tsx");
    expect(resizer).toMatch(/props\.onChange \?\? setRailWidth/);
  });

  it("leaves the workbench's own column alone", () => {
    // `PanelResizer` is shared. The workbench column is a REAL column that
    // reflows its neighbours, so panning the canvas for it would be a
    // correction for an overlap that never happens. It passes its own
    // `onChange`, and the default above is what keeps the two apart.
    const wb = read("components/Workbench.tsx");
    expect(wb, "the workbench must keep passing its own onChange").toMatch(
      /onChange=\{/,
    );
  });

  it("keeps follow alive, because opening a panel is not taking the wheel", () => {
    /**
     * `setViewport` drops follow mode — correctly, for every one of its
     * callers, which are all a person grabbing the wheel. Someone watching a
     * colleague who opens the Chat to ask them a question should still be
     * watching them afterwards; using `setViewport` here would make the Chat
     * button a silent "stop following".
     */
    const railpan = read("lib/railpan.ts");
    expect(railpan).toMatch(/followViewport\(/);
    expect(railpan, "setViewport would drop follow on every rail toggle").not.toMatch(
      /\.setViewport\(/,
    );
  });

  it("does not animate a pan nobody can see", () => {
    /**
     * `requestAnimationFrame` does not fire in a hidden tab, so an eased pan
     * started there does not run slowly — it stops half-applied and finishes
     * when the tab is next looked at, sliding the canvas for no visible
     * reason. Found in the harness, which reports `document.hidden === true`
     * and never fired a frame; the same fact is why phase 1's blur-under-
     * motion number could not be taken there.
     */
    const railpan = read("lib/railpan.ts");
    expect(railpan).toMatch(/document\.hidden/);
    expect(railpan, "reduced motion still counts too").toMatch(/prefers-reduced-motion/);
  });

  it("measures the distance with dockEdges rather than measuring the rail again", () => {
    // A second derivation of "what the rail takes" is how the pan and the
    // framing would come to disagree about one rail — the same mistake that
    // put the minimap on the panel's corner, one level up.
    const railpan = read("lib/railpan.ts");
    expect(railpan).toMatch(/dockEdges\(/);
    expect(railpan, "no fresh measurement of the rail").not.toMatch(/RAIL_INSET|getBoundingClientRect/);
  });
});
