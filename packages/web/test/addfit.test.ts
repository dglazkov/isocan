import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Two small things a person asked for on 5 Sep 2026.
 *
 * **The Add popover fits the window.** It hung off the top of the rail's +
 * button and grew downward; the + is the last thing on the rail, so on a
 * short window the list of canvases ran off the bottom and its last rows
 * were unreachable. It is placed against the viewport now — centred beside
 * the rail, never taller than the window, its list scrolling inside it.
 *
 * **Items that lead away say so.** A canvas card, a live site, a Google Doc
 * wear a dashed border in their own token, so a wall of cards says which
 * ones are doorways before you find the ↗.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const css = read("../src/styles.css");
const itemView = read("../src/components/ItemView.tsx");

describe("the Add popover fits the window", () => {
  it("is placed against the viewport, centred beside the rail, and never taller than the window", () => {
    const rule = css.slice(css.indexOf(".add-door .add-popover {"), css.indexOf("}", css.indexOf(".add-door .add-popover {")));
    expect(rule).toContain("position: fixed");
    expect(rule).toContain("top: 50%");
    expect(rule).toContain("transform: translateY(-50%)");
    expect(rule).toContain("max-height: calc(100vh - 2 * var(--edge))");
    expect(rule).toContain("overflow: auto");
  });

  it("lets the list of canvases scroll inside it rather than grow past it", () => {
    expect(css).toContain(".canvas-picker-list { display: flex; flex-direction: column; gap: 2px; max-height: min(280px, 36vh); overflow: auto; }");
  });
});

describe("the rail fits a short window", () => {
  it("is centred by pinning both edges, so a rail taller than the window pins to the top rather than losing both ends", () => {
    const rule = css.slice(css.indexOf(".tool-rail {"), css.indexOf("}", css.indexOf(".tool-rail {")));
    expect(rule).toContain("top: var(--edge); bottom: var(--edge);");
    expect(rule).toContain("margin: auto 0; height: fit-content;");
    expect(rule).not.toContain("translateY(-50%)");
    expect(rule).not.toMatch(/overflow/);
  });

  it("shrinks its buttons on a short window instead of scrolling, so the popovers that hang off it are not clipped", () => {
    expect(css).toContain("@media (max-height: 560px) {\n  .tool-rail { gap: 2px; padding: 4px; }\n  .tool-btn { width: 32px; height: 32px; border-radius: var(--radius); }");
    expect(css).toContain("@media (max-height: 420px) {\n  .tool-btn { width: 28px; height: 28px; }");
  });

  it("puts the short-window rules after the base ones, since at equal specificity the later rule wins", () => {
    // Found the first time: the media blocks sat above `.tool-btn {` and lost to it; the rail stayed 396px tall on a 340px window.
    expect(css.indexOf("@media (max-height: 560px)")).toBeGreaterThan(css.indexOf("\n.tool-btn {\n"));
    expect(css.indexOf("@media (max-height: 420px)")).toBeGreaterThan(css.indexOf("\n.tool-sep {"));
  });
});

describe("items that lead away wear a dashed border in their own colour", () => {
  it("marks a card with a source, and a live site, as away", () => {
    expect(itemView).toContain('const away = source !== null || kind === "site";');
    expect(itemView).toContain('${away ? " away" : ""}');
  });

  it("draws it from one token defined in both themes, dashed, and lit on hover like a slide", () => {
    expect(css).toContain(".item.away { border-style: dashed; border-color: var(--away); }");
    expect(css).toContain(".item.away:hover { box-shadow: var(--shadow-card), 0 0 0 1px var(--away); }");
    expect((css.match(/^  --away: #[0-9a-f]{6};$/gm) ?? []).length).toBe(2);
  });
});
