import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const rail = read("../src/components/CanvasTools.tsx");
const addDoor = read("../src/components/AddPopover.tsx");
const css = read("../src/styles.css");

/**
 * **The rail's tooltips are drawn, beside the button, pointing at it.**
 *
 * Dion, 10 Sep: *"in other tools the tooltip wasn't the builtin one and
 * instead popped out to the side and pointed to the item in a way that was
 * a) faster to pop out, b) clearer to read, c) stays out of the way."*
 *
 * The native `title` tip failed all three on a column of glyph buttons: it
 * waited about a second, it was the browser's small grey box, and it landed
 * at the pointer — which on a vertical rail means ON the buttons below the
 * one it names. The fullscreen button had already left `title` for the same
 * first two reasons (`chrome.test.ts`); the rail follows, with the side
 * placement the column needs.
 */
describe("the tool rail's tooltips", () => {
  it("are drawn from data-tip, not left to title", () => {
    // Every button in the rail — tools, Reactions, History, a canvas's own
    // tools, and the Add door — speaks through the one rule.
    const buttons = rail.match(/<button[\s\S]*?>/g) ?? [];
    const railButtons = buttons.filter((b) => b.includes('"tool-btn') || b.includes("`tool-btn"));
    expect(railButtons.length).toBeGreaterThanOrEqual(4);
    for (const b of railButtons) {
      expect(b, "a rail button must carry data-tip").toMatch(/data-tip=/);
      expect(b, "a rail button must not fall back to title").not.toMatch(/\btitle=/);
    }
    expect(addDoor).toMatch(/data-tip=\{open \? undefined : "Add to the canvas/);
    expect(css).toMatch(/\.tool-btn\[data-tip\]::after\s*\{[^}]*content:\s*attr\(data-tip\)/);
  });

  it("keep the name for screen readers, since a pseudo-element is not read", () => {
    for (const b of rail.match(/<button[\s\S]*?data-tip=[\s\S]*?>/g) ?? []) {
      expect(b).toMatch(/aria-label=/);
    }
  });

  it("pop out to the side and point back at the button", () => {
    const tip = css.slice(css.indexOf(".tool-btn[data-tip]::after {"));
    const bubble = tip.slice(0, tip.indexOf("}"));
    // Left of the button, into open canvas, the way the ink well already goes.
    expect(bubble).toMatch(/right:\s*calc\(100% \+ 12px\)/);
    // Vertically on the button it names, not on the pointer.
    expect(bubble).toMatch(/top:\s*50%/);
    // The chevron is what says WHICH button — a pill beside a column cannot.
    expect(css).toMatch(/\.tool-btn\[data-tip\]::before\s*\{[\s\S]*?rotate\(45deg\)/);
    // The button is the tip's anchor, so it has to be positioned.
    expect(css).toMatch(/\.tool-btn \{\s*position: relative;/);
  });

  it("are quick, but not so quick that sweeping the rail flashes six of them", () => {
    const hover = css.match(/\.tool-btn\[data-tip\]:hover::before \{ opacity: 1; transition-delay: ([\d.]+)s; \}/);
    expect(hover, "hover shows the tip after a delay").not.toBeNull();
    const delay = Number(hover![1]);
    expect(delay).toBeGreaterThanOrEqual(0.15);
    expect(delay).toBeLessThanOrEqual(0.35);
    // Keyboard focus gets it at once: there is no sweep to protect against.
    expect(css).toMatch(/\.tool-btn\[data-tip\]:focus-visible::before \{ opacity: 1; transition-delay: 0s; \}/);
  });

  it("stay out of the way", () => {
    const tip = css.slice(css.indexOf(".tool-btn[data-tip]::after {"));
    const bubble = tip.slice(0, tip.indexOf("}"));
    // Never the thing the pointer meets on its way to the control.
    expect(bubble).toMatch(/pointer-events:\s*none/);
    // Long hints wrap rather than run across the canvas.
    expect(bubble).toMatch(/max-width:\s*\d+px/);
    expect(bubble).toMatch(/white-space:\s*pre-line/);
    // Nothing is said beside something already open — the ink well, the Add
    // popover — or the tip would land on the very thing the button opened.
    // Decided in the markup (no attribute, no pseudo-element) rather than by
    // a `:has()` rule, which `oneblock.test.ts` reads as a stranded state
    // class.
    expect(rail).toContain('data-tip={t.tool === "pen" && activeTool === "pen" ? undefined : tipText(t.hint, t.more)}');
    expect(addDoor).toContain("data-tip={open ? undefined :");
    // A press is an answer: the tip goes the moment the button is pressed.
    expect(css).toMatch(/\.tool-btn\[data-tip\]:active::after,\s*\.tool-btn\[data-tip\]:active::before \{ opacity: 0;/);
  });

  it("put the key on the first line and the behaviour on a second", () => {
    // The name and its letter are what a glance needs; how the tool behaves
    // (a hold, a latch) is the line under it, and only where there is one.
    expect(rail).toContain('hint: "Zoom — Z", more: "tap to latch, hold to zoom a region"');
    expect(rail).toContain('{ tool: "select", label: "Select", hint: "Select — V", icon: CURSOR }');
    expect(rail).toMatch(/return more \? `\$\{hint\}\\n\$\{more\}` : hint/);
  });
});
