import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The geometry is proved in `core/test/mindmap.test.ts`. This is the drawing,
 * and it exists because of a bug that had no symptom in the DOM at all.
 */
const view = readFileSync(
  fileURLToPath(new URL("../src/edges.tsx", import.meta.url)),
  "utf8",
);
const css = readFileSync(fileURLToPath(new URL("../../../web/src/styles.css", import.meta.url)), "utf8");

describe("the map's lines", () => {
  it("sizes its SVG to the lines inside it", () => {
    /**
     * **The bug this remembers had no symptom to see.** The first version was
     * `width: 0; height: 0; overflow: visible`, on the assumption that an SVG
     * root honours `overflow` the way a div does. Every line had a correct
     * layout box, a correct stroke and a correct position — and none of them
     * painted. Proved by turning the stroke red and 6px wide and still seeing
     * nothing: a zero-sized SVG clips its own painting whatever `overflow`
     * says.
     *
     * The box is measured from the lines now and the `viewBox` carries the
     * world origin, so nothing relies on overflow.
     */
    expect(view).toMatch(/viewBox=\{`\$\{minX\} \$\{minY\} \$\{width\} \$\{height\}`\}/);
    expect(view).toMatch(/style=\{\{ left: minX, top: minY, width, height \}\}/);
    const rule = /\.map-edges\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, "the stylesheet must not put the size back").not.toMatch(/width:\s*0/);
  });

  it("pads the box, so a straight run is not a zero-width viewport", () => {
    // Two nodes in a column give a box of zero width — which paints nothing,
    // for exactly the same reason as above. A map reaches that state
    // immediately, the first time somebody drags a child under its parent.
    expect(view).toMatch(/const PAD = \d+;/);
    expect(view).toMatch(/Math\.min\(\.\.\.xs\) - PAD/);
  });

  it("is drawn in the world, so it needs no listener to stay in step", () => {
    /**
     * This used to be phrased against `LaneTethers`, which has been removed —
     * it joined a chip in a PANEL to a thing on the canvas, two coordinate
     * systems, so it had to be screen space and re-measured on every pan, and
     * it read as a puzzle rather than a connection.
     *
     * The reason it was contrasted with survives it: both ends of a map edge
     * are items, so drawing in the world means they pan, zoom and scale with
     * the nodes for free, with nothing listening at all.
     */
    const viewport = readFileSync(
      fileURLToPath(new URL("../../../web/src/components/CanvasViewport.tsx", import.meta.url)),
      "utf8",
    );
    const world = viewport.slice(viewport.indexOf('className={`world'), viewport.indexOf("{items.map("));
    expect(viewport.indexOf("<ModuleUnderlays />")).toBeGreaterThan(viewport.indexOf('className={`world'));
    expect(world, "and it is inside .world").toBeTruthy();
    // Before the items: a node is chromeless text, and a line over it strikes
    // through the words.
    expect(viewport.indexOf("<ModuleUnderlays />")).toBeLessThan(viewport.indexOf("{items.map("));
  });

  it("rides a drag, so a line does not lag the node it joins", () => {
    // The item has not moved in the replica while a drag is live — the same
    // trick a comment pin uses.
    expect(view).toMatch(/drag\?\.itemIds\.includes\(item\.id\)/);
  });

  it("counter-scales its stroke", () => {
    // A flat 2px would be a hairline at 6% and a rope at 400%: the line lives
    // in world units like everything else inside `.world`.
    const rule = /\.map-edge\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toMatch(/stroke-width: calc\([\d.]+px \/ var\(--scale/);
  });

  it("is visible, which the first colour was not", () => {
    // `--chip-line` is a chip's border: #343a44 on a #0e0f12 ground. The
    // lines were there, correct, and invisible. The edges ARE the map.
    const rule = /\.map-edge\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).not.toMatch(/stroke: var\(--chip-line\)/);
    expect(rule).toMatch(/stroke: var\(--ink-soft\)/);
  });
});
