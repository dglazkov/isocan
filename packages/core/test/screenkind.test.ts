import { describe, expect, it } from "vitest";
import { BROWSER_MIME, ITEM_KINDS, itemKind } from "../src/index.ts";
import type { Item, ItemKind } from "../src/index.ts";

/**
 * A SCREEN is its own kind.
 *
 * It was "document" until the cards grew a type icon, at which point one glyph
 * had to stand for a designed screen and for a paragraph of notes. Those are
 * not the same object — you review a screen and you read a document — and the
 * canvas mostly holds the first.
 *
 * The vocabulary is shared (`isocan ls --kind`, the Files panel, the icon on
 * the card), so this is about all three at once: `kinds.ts` says a kind that
 * means one thing in a list and another in a filter is worse than no kinds at
 * all.
 */

function itemOf(mimeType: string, properties: Record<string, string> = {}): Item {
  return {
    id: "itm_1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "T",
    description: "",
    properties,
    currentVersionId: "ver_1",
    versions: [
      { id: "ver_1", blobHash: "h", mimeType, filename: `f`, size: 1 } as Item["versions"][number],
    ],
  } as unknown as Item;
}

describe("what an item is", () => {
  it("calls an HTML page a screen", () => {
    expect(itemKind(itemOf("text/html"))).toBe("screen");
  });

  it("still calls prose a document", () => {
    // The distinction only earns its place if the other side of it survives.
    expect(itemKind(itemOf("text/markdown"))).toBe("document");
    expect(itemKind(itemOf("text/plain"))).toBe("document");
    expect(itemKind(itemOf("application/pdf"))).toBe("document");
  });

  it("keeps a live site separate, though its mime is a text/ one too", () => {
    // A mini-browser item is somebody else's page being watched, not a page
    // that lives here. Its mime is `text/uri-list`, so it is caught by the
    // `text/` prefix test the moment anything reorders these checks — which is
    // why the constant is imported rather than spelled out here.
    expect(BROWSER_MIME.startsWith("text/"), "the ordering hazard is gone").toBe(true);
    expect(itemKind(itemOf(BROWSER_MIME))).toBe("site");
  });

  it("leaves the other kinds where they were", () => {
    expect(itemKind(itemOf("image/png"))).toBe("image");
    expect(itemKind(itemOf("video/mp4"))).toBe("video");
    expect(itemKind(itemOf("application/zip"))).toBe("other");
  });

  it("is in the list every surface offers", () => {
    // `ls --kind` builds its choices from ITEM_KINDS, so a kind that exists in
    // the function but not the list is a kind you cannot filter for.
    expect(ITEM_KINDS).toContain("screen" as ItemKind);
    const seen = new Set<ItemKind>();
    for (const kind of ITEM_KINDS) {
      expect(seen.has(kind), `${kind} listed twice`).toBe(false);
      seen.add(kind);
    }
  });
});
