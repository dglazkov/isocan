import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
const item = read("../src/components/ItemView.tsx");

/** The body of the rule whose selector list is exactly this. */
const rule = (selector: string): string => {
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if ((m[1] ?? "").split(",").map((s) => s.trim()).includes(selector)) return m[2] ?? "";
  }
  throw new Error(`no rule for ${selector}`);
};
const decl = (body: string, property: string): string | undefined =>
  body.match(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+)`))?.[1]?.trim();

/**
 * **Selected, the ring is the outermost edge** (19 Oct 2026).
 *
 * A selected version stack read as "thin blue line => grey => more
 * see-through grey": the ring sat on the top card, two translucent plies
 * peeked past it, and a 64px halo past those. Figma's rule, read off its
 * canvas at several zooms, is that selection is the node's bounds and the last
 * mark on it. Each of the things that used to sit outside the ring is pinned
 * here, because each was a separate rule that could come back on its own.
 */
describe("the edge of a selected item", () => {
  it("hides the version plies", () => {
    expect(decl(rule(".item.selected > .ply"), "display")).toBe("none");
  });

  it("flattens the resting halo to the contact shadow, and the lift still wins", () => {
    expect(decl(rule(".item.selected"), "box-shadow")).toBe("var(--shadow-card)");
    // Paper's own rule outweighs `.item.selected`, so it must say it again.
    expect(decl(rule(".item.textnode.paper.selected"), "box-shadow")).toBe("var(--shadow-card)");
    // Same weight, so ORDER decides: the lift must come after the flattening.
    expect(css.indexOf(".item.lifted {")).toBeGreaterThan(css.indexOf(".item.selected {"));
    expect(css.indexOf(".item.textnode.paper.lifted")).toBeGreaterThan(css.indexOf(".item.textnode.paper.selected"));
  });

  it("sits the ring on the hairline, so nothing grey lies between blue and content", () => {
    const sel = rule(".item.selected");
    // One SCREEN pixel in: a world pixel lands between screen pixels at low
    // zoom and smears the ring (measured at 40%, where hover all but vanished).
    expect(decl(sel, "outline-offset")).toBe("calc(-1px / var(--scale, 1))");
    // The ring's own colour: `--ground-ring` follows the canvas ground (smart contrast).
    expect(decl(sel, "border-color")).toBe("var(--ground-ring)");
  });

  it("previews inside the ring it would become, so a click fills the dashes in", () => {
    // Hover: 1 screen px, outward from the border edge. Selection: 2 screen
    // px, starting 1 screen px in. The first lies inside the second.
    expect(decl(rule(".canvas-viewport:not(.pen) .item.hover-target"), "outline-offset")).toBe("0");
    expect(decl(rule(".canvas-viewport:not(.pen) .item.hover-target"), "outline")).toMatch(/^calc\(1px \/ var\(--scale/);
    expect(decl(rule(".item.selected"), "outline")).toMatch(/^calc\(2px \/ var\(--scale/);
    expect(decl(rule(".item.peeked"), "outline-offset")).toBe(decl(rule(".item.selected"), "outline-offset"));
  });

  it("draws somebody else's selection counter-scaled, on the same line", () => {
    // The hover outline's bug, in the one ring that is an inline style: a
    // literal `2px` is 0.4 screen pixels at 20%.
    const remote = item.match(/remoteHolder && !selected[\s\S]*?\{ outline: `([^`]+)`, outlineOffset: "([^"]+)" \}/);
    expect(remote, "the remote-holder outline moved — find it and keep it counter-scaled").not.toBeNull();
    expect(remote![1]).toMatch(/^calc\(2px \/ var\(--scale/);
    expect(remote![2]).toBe(decl(rule(".item.selected"), "outline-offset"));
  });
});

/**
 * **Plies are opaque sheets a fixed distance apart on screen.** Translucent
 * plies let a photo ground through as grey mud, and world offsets made "this
 * has versions" vanish at 20% and grow into 30px bands at 300%.
 */
describe("the version plies", () => {
  it("never use opacity, inline or in CSS", () => {
    expect(item).not.toMatch(/className="ply[^"]*"[^>]*opacity/);
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (/\.ply\b/.test(m[1] ?? "")) expect(m[2], m[1]).not.toMatch(/(?:^|[;\s])opacity\s*:/);
    }
  });

  it("step a clamped, screen-bounded distance", () => {
    const body = rule(".item .ply");
    expect(decl(body, "--ply-step")).toMatch(/^clamp\([^)]*var\(--scale[^)]*\)/);
    expect(decl(body, "transform")).toContain("var(--ply-step)");
    expect(item).toContain('className="ply ply-1"');
    expect(item).toContain('className="ply ply-2"');
  });
});
