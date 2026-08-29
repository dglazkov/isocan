import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findNextItem } from "../src/lib/spatialnav.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
const pad = read("components/NeighbourPad.tsx");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

/**
 * ⌘← ⌘→ ⌘↑ ⌘↓ have walked the canvas from a full-screen slide for a while and
 * nothing said so — or said whether the walk would land anywhere. These are
 * the properties that make the arrows worth having rather than four more
 * pixels of chrome.
 */
describe("the neighbour pad", () => {
  it("asks the same function the keystroke does", () => {
    /**
     * The arrows must be exactly as true as the key. Any second source —
     * a cached list, a count, a guess from item positions — drifts from the
     * behaviour it advertises the first time somebody adds an item, and an
     * arrow that does nothing is worse than no arrow.
     */
    expect(pad).toContain("findNextItem");
    const handler = read("components/FullScreen.tsx");
    expect(handler, "and the keys still answer with it too").toContain("findNextItem");
  });

  it("draws nothing for a direction with nothing in it", () => {
    // The silhouette IS the information: one arrow on the right means the left
    // end of a row. So the list is filtered, never rendered-then-disabled.
    expect(pad).toMatch(/\.filter\(/);
    expect(pad).toContain("to !== null");
  });

  it("is one pill on the bar's line, not a cross standing off it", () => {
    /**
     * The first version was a 2D cross so that position said direction. It was
     * wrong twice: it stood taller than the pill beside it and dropped the
     * arrows below the bar's single centreline — which is what it looked like
     * — and it was solving a problem the glyph had already solved. **An arrow
     * says which way it points.** Position was repeating the shape.
     */
    const rule = /\.neighbour-pad\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, ".neighbour-pad must have a rule").not.toBe("");
    expect(rule, "a row on the bar's line").toContain("inline-flex");
    expect(rule, "not a grid that stands off it").not.toContain("grid-template");
    // No fixed height: the padding matches the button beside it, so they share
    // a centreline for a reason rather than by two numbers kept equal by hand.
    expect(rule).not.toMatch(/\bheight:/);
  });

  it("draws one arrow and turns it, rather than four that can drift apart", () => {
    expect(read("components/Glyphs.tsx")).toContain("export function ArrowGlyph");
    for (const [cell, deg] of [["up", "-90deg"], ["down", "90deg"], ["left", "180deg"]] as const) {
      expect(css, `${cell} must be the same glyph, turned`).toContain(
        `.neighbour-arrow.${cell} svg { transform: rotate(${deg}); }`,
      );
    }
  });

  it("uses an icon, not a text character", () => {
    // `←` in a button is a character in whatever font the bar happens to have,
    // at whatever weight it happens to be — beside a family of stroked glyphs
    // that all match. It read as three loose characters, which is what it was.
    expect(pad).toContain("<ArrowGlyph />");
    expect(pad, "no bare arrow characters").not.toMatch(/glyph: "[←→↑↓]"/);
  });

  it("is a button, and says where it goes and by which key", () => {
    // A control that only describes a shortcut is a footnote; clicking must do
    // what the key does, and resting on it must name the destination.
    expect(pad).toContain("navigate(itemPath(");
    expect(pad).toMatch(/title=\{`\$\{title\} · \$\{key\}`\}/);
    expect(pad, "and be reachable without a mouse").toMatch(/aria-label=\{`Go to \$\{title\}`\}/);
  });

  it("shows only in full screen, where those keys flip slides", () => {
    // On the workbench ⌘-arrows move the canvas selection and the rail is
    // already the way around, so the pad would be a second answer to a
    // question that has one.
    expect(read("components/ArtifactStage.tsx")).toMatch(
      /surface === "fullscreen" && \(\s*<NeighbourPad/,
    );
  });

  it("respects a person who asked for less motion", () => {
    expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,320}\.neighbour-arrow:hover \{ transform: none; \}/);
  });
});

/**
 * The arithmetic itself, so the pad's promise is checked and not merely its
 * wiring: an item at the top-left of a grid offers right and down, and nothing
 * else.
 */
describe("what the pad would offer", () => {
  const grid = [
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 200, y: 0, width: 100, height: 100 },
    { id: "c", x: 0, y: 200, width: 100, height: 100 },
  ];
  it("offers exactly the directions that move", () => {
    const from = grid[0]!;
    expect(findNextItem(from, grid, "ArrowRight")?.id).toBe("b");
    expect(findNextItem(from, grid, "ArrowDown")?.id).toBe("c");
    expect(findNextItem(from, grid, "ArrowLeft")).toBeNull();
    expect(findNextItem(from, grid, "ArrowUp")).toBeNull();
  });

  it("offers nothing at all on a canvas of one", () => {
    const only = [grid[0]!];
    for (const dir of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const) {
      expect(findNextItem(grid[0]!, only, dir)).toBeNull();
    }
    // …and the pad renders nothing rather than an empty cross.
    expect(pad).toContain("if (neighbours.length === 0) return null;");
  });
});
