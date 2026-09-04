import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const view = read("../src/components/ItemView.tsx");
const store = read("../src/stores/uiStore.ts");

/**
 * **A Google Doc, live** (research note, stage 4): the `/preview` frame in
 * place of the words, in the same item, remembered per person, never a
 * second item. The words stay the record — what is searched, versioned,
 * read by agents and kept current by `gdoc sync` — and live is a lens this
 * browser flips over the same thing.
 */
describe("live is a mode of the same item", () => {
  it("is offered only on a document whose source is a Google Doc", () => {
    expect(view).toContain("const docId = source && current.mimeType === DOC_MIME ? googleDocId(source) : null;");
    expect(view).toContain("{docId && (");
  });

  it("frames the preview address in place of the words, and never adds an item", () => {
    expect(view).toContain("liveDoc={liveDoc && docId ? googleDocPreviewUrl(docId) : null}");
    expect(view).toContain('className="browser-view doc-live"');
    const toggle = view.slice(view.indexOf('className={`doc-live-toggle'), view.indexOf("{isBrowser && ("));
    expect(toggle).toContain("setDocLive(item.id, !liveDoc)");
    expect(toggle).not.toContain("item.add");
    expect(toggle).not.toContain("sendEchoed");
  });

  it("is remembered per browser, like the theme, and an unreadable store means the words", () => {
    expect(store).toContain('const LIVE_DOCS_KEY = "isocan.liveDocs";');
    expect(store).toContain("liveDocs: readIdList(LIVE_DOCS_KEY),");
    expect(store).toContain("setDocLive: (itemId, live) =>");
  });

  it("says which state you are in, in a word, and counts a live frame as interactive", () => {
    expect(view).toContain('{liveDoc ? "Words" : "Live"}');
    expect(view).toContain('interactive: current.mimeType === "text/html" || isBrowser || liveDoc,');
  });
});
