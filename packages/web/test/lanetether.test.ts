import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The tether's honesty rules are proved in `tether.test.ts`. This is the
 * drawing: where it lives, when it stops, and what it must never do.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
const layer = read("components/LaneTethers.tsx");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("the tether layer", () => {
  it("stops while the canvas is moving under the hand", () => {
    /**
     * A pan changes the viewport every frame, and this measures live DOM
     * rectangles — so leaving it on forces a layout per frame for a drawing
     * that is only glanced at. A drag moves the item itself, and a dashed
     * line re-measured against a moving target trails what it points at
     * during the one gesture where a person most needs to see where things
     * are.
     *
     * `panning` had to be lifted into the store for this: it was local state
     * in `CanvasViewport`, which was fine only while nothing outside that
     * component needed to know.
     */
    expect(layer).toMatch(/const quiet = drag !== null \|\| panning \|\| resizing;/);
    expect(layer).toMatch(/if \(quiet[^)]*\) \{\s*setLines\(\[\]\);/);
    expect(read("stores/uiStore.ts"), "panning must be readable across components").toMatch(
      /setPanning: \(panning\) => set\(\{ panning \}\)/,
    );
  });

  it("is screen space, never inside the world", () => {
    // A tether joins a chip in a panel to a thing on the canvas, and those
    // live in different coordinate systems. Drawn inside `.world` it would
    // scale with the zoom while one end stayed pinned to a panel that does
    // not scale at all.
    const rule = /\.lane-tethers\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toMatch(/position: fixed/);
    expect(layer, "positions come from the live viewport, not cached world units").toMatch(
      /tetherFor\(/,
    );
  });

  it("cannot be clicked, and cannot cover the panel that owns it", () => {
    // It is a drawing ABOUT other things: catching a click would make the
    // canvas unreachable in a band nobody can see. And at the canvas layer it
    // passes under every panel, so a line can never be drawn across the
    // message it belongs to.
    const rule = /\.lane-tethers\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toMatch(/pointer-events: none/);
    expect(rule).toMatch(/z-index: var\(--z-canvas\)/);
  });

  it("re-measures when the panel scrolls, which nothing else would notice", () => {
    // Where a chip sits depends on how long the messages above it are and
    // whether the panel is scrolled — neither of which is in any store, so a
    // scroll would leave every line pointing at where a chip used to be.
    expect(layer).toMatch(/addEventListener\("scroll", measure, true\)/);
  });
});
