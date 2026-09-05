import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **The deck, laid out for paper** — structural, because the print pipeline is
 * a browser's. What can be read from the source: the route is core's spelling
 * and mounts inside CanvasPage like full screen; the frames use the one
 * src/sandbox pair; the print stylesheet puts one slide on each landscape
 * sheet; the download builds core's file, not a second one.
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const app = read("../src/App.tsx");
const page = read("../src/pages/CanvasPage.tsx");
const view = read("../src/components/DeckPrint.tsx");
const css = read("../src/styles.css");
const actions = read("../src/lib/actions.ts");

describe("the deck view", () => {
  it("is a route from core, mounted inside CanvasPage so the open replica is what it prints", () => {
    expect(app).toContain("<Route path={DECK_ROUTE}");
    expect(page).toContain("useMatch(DECK_ROUTE)");
    expect(page).toContain("<DeckPrint canvasId={canvasId} />");
    expect(view).not.toMatch(/["'`]\/p\//);
  });

  it("frames each slide with the itemFrame pair and reads the pages from core", () => {
    expect(view).toContain("itemFrame(contentBase(), canvasId, blobHash)");
    expect(view).toContain("sandbox={frame.sandbox}");
    expect(view).toContain("deckPages(canvas)");
  });

  it("prints one slide to a landscape sheet and hides the bar", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain("size: 13.333in 7.5in");
    expect(print).toContain(".deck-page { break-after: page;");
    expect(print).toContain(".deck-bar { display: none; }");
    // Measured, not assumed: with the shell still a fixed, clipped viewport,
    // two slides printed as one page holding the first screenful.
    expect(print).toContain("html, body, #root { height: auto; overflow: visible; }");
    expect(print).toContain(".canvas-page { position: static; overflow: visible; }");
  });

  it("downloads the file core builds, named after the canvas, and reaches the view from the palette", () => {
    expect(view).toContain("deckHtml(title, contents)");
    expect(view).toContain('deckFilename(title, "html")');
    expect(actions).toContain('id: "export-deck"');
    expect(actions).toContain("ctx.navigate(deckPath(ctx.canvasId!))");
  });
});
