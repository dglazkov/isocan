import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { DECK_ROUTE, deckPath, deckUrl } from "../src/address.ts";
import { deckFilename, deckHtml, deckPages } from "../src/deckexport.ts";

/**
 * **Taking a deck somewhere else.** The pages are the deck, in the deck's own
 * order; the self-contained file plays them and prints them one to a sheet;
 * the address both surfaces print from is one spelling.
 */
const at = "2026-09-04T10:00:00.000Z";
const actor = { id: "usr_a", name: "A" };
function item(id: string, x: number, y: number, mime = "text/html", extra: Partial<Item> = {}): Item {
  return {
    id,
    title: id,
    x,
    y,
    width: 800,
    height: 450,
    createdAt: at,
    updatedAt: at,
    createdBy: actor,
    updatedBy: actor,
    description: "",
    versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: mime, filename: `${id}.html`, size: 1, createdAt: at, createdBy: actor }],
    currentVersionId: `ver_${id}`,
    properties: {},
    reactions: {},
    ...extra,
  } as Item;
}
const canvas = (items: Item[]): CanvasContents =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {}, edges: {} }) as unknown as CanvasContents;

describe("the pages", () => {
  it("are the marked slides in reading order, or everything when none are marked", () => {
    const a = item("a", 0, 0, "text/html", { properties: { slide: "1" } });
    const b = item("b", 900, 0, "text/html", { properties: { slide: "1" } });
    const c = item("c", 0, 600);
    expect(deckPages(canvas([c, b, a])).map((p) => p.id)).toEqual(["a", "b"]);
    expect(deckPages(canvas([c, item("d", 900, 600), item("e", 0, 0)])).map((p) => p.id)).toEqual(["e", "c", "d"]);
    expect(deckPages(canvas([a]))[0]).toMatchObject({ mimeType: "text/html", blobHash: "hash_a" });
  });
});

describe("the one file that plays the deck", () => {
  const html = deckHtml("Season planning", [
    { id: "a", title: "Rest & Play", mimeType: "text/html", blobHash: "h", html: '<h1 style="color:red">Rest & "Play"</h1>' },
    { id: "b", title: "Photo", mimeType: "image/png", blobHash: "h2", imageDataUrl: "data:image/png;base64,AAAA" },
    { id: "c", title: "Clip", mimeType: "video/mp4", blobHash: "h3" },
  ]);

  it("inlines every screen as a srcdoc frame with the attribute escaped, so a quote cannot end the slide", () => {
    expect(html).toContain('srcdoc="&lt;h1 style=&quot;color:red&quot;&gt;Rest &amp; &quot;Play&quot;&lt;/h1&gt;"'.replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    expect(html).toContain('sandbox="allow-scripts"');
    expect((html.match(/<section class="slide"/g) ?? []).length).toBe(3);
  });

  it("shows an image as itself, and says what it cannot show rather than skipping it", () => {
    expect(html).toContain('<img src="data:image/png;base64,AAAA"');
    expect(html).toContain("video/mp4 — not something a deck can show");
  });

  it("flips with the keys the presenter uses, and prints one slide to a landscape sheet", () => {
    expect(html).toContain('"ArrowRight", "ArrowDown", "PageDown"');
    expect(html).toContain("@page { size: 13.333in 7.5in; margin: 0; }");
    expect(html).toContain("break-after: page;");
    expect(html).toContain("<title>Season planning</title>");
  });

  it("names the file after the canvas", () => {
    expect(deckFilename("Season planning", "html")).toBe("season-planning.html");
    expect(deckFilename("  ", "pdf")).toBe("deck.pdf");
  });
});

describe("the deck's address", () => {
  it("is one spelling for the route, the path and the whole address", () => {
    expect(deckPath("prj_x")).toBe("/p/prj_x/deck");
    expect(deckUrl("https://isocan.io/", "prj_x")).toBe("https://isocan.io/p/prj_x/deck");
    expect(DECK_ROUTE.endsWith("/deck")).toBe(true);
  });
});
