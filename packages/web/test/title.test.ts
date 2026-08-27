import { describe, expect, it } from "vitest";
import { pageTitle } from "../src/lib/title.ts";

/**
 * A tab strip truncates hard, so what a title puts FIRST is the whole of what
 * it communicates once somebody has six canvases open.
 */
describe("what the tab says", () => {
  it("is just the product with no canvas open", () => {
    expect(pageTitle({})).toBe("isocan");
  });

  it("leads with the canvas, not the product", () => {
    // "isocan: Acme…" renders identically for every tab, which is exactly
    // the problem the title was changed to fix.
    expect(pageTitle({ canvas: "Acme Board" })).toBe("Acme Board · isocan");
  });

  it("names the workbench, because it is a different place", () => {
    expect(pageTitle({ canvas: "Acme Board", cover: "workbench" })).toBe(
      "Acme Board · workbench · isocan",
    );
  });

  it("leads with the screen when one is full size, and keeps its canvas", () => {
    // "View · Start" means nothing on its own across three projects.
    expect(pageTitle({ canvas: "Acme Board", cover: "item", item: "View · Start" })).toBe(
      "View · Start · Acme Board · isocan",
    );
  });

  it("puts the unread count ahead of everything", () => {
    // A badge that scrolls off the left of a truncated tab is not a badge.
    expect(pageTitle({ canvas: "Acme Board", unread: 3 })).toBe("(3) Acme Board · isocan");
    expect(pageTitle({ unread: 1 })).toBe("(1) isocan");
  });

  it("degrades to the product when a part is missing", () => {
    // A canvas whose snapshot has not landed yet, and a cover with no item.
    expect(pageTitle({ canvas: null, cover: "workbench" })).toBe("workbench · isocan");
    expect(pageTitle({ canvas: "Acme Board", cover: "item", item: null })).toBe(
      "Acme Board · isocan",
    );
  });
});
