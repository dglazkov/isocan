import { describe, expect, it } from "vitest";
import { applyEdits, foldEdit, uniqueSplice } from "../src/lib/textPatch.ts";

/**
 * The rule that makes in-place editing unable to corrupt a file, shaken the
 * way the tree's jail was: every refusal gets a case that fails without it,
 * and the dangerous inputs are the ones a naive string-replace would eat.
 */
describe("the unique-match rule", () => {
  const page = "<h1>The Lake House</h1><p>Private stays</p><button>Book</button>";

  it("splices a unique text byte-exactly and touches nothing else", () => {
    const out = uniqueSplice(page, { from: "The Lake House", to: "Lake House & Cabin" });
    expect(out).toEqual({
      ok: true,
      source: "<h1>Lake House &amp Cabin</h1><p>Private stays</p><button>Book</button>".replace(
        "&amp Cabin",
        "& Cabin",
      ),
    });
  });

  it("refuses an ambiguous text BY COUNT — the mis-patch a naive replace commits", () => {
    const two = "<button>Submit</button><button>Submit</button>";
    const out = uniqueSplice(two, { from: "Submit", to: "Send" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("2 times");
  });

  it("refuses text the source never spelled — the DOM normalized it", () => {
    // The page says &amp;; the DOM's text node says &. A replace of the DOM
    // text would find nothing — and must SAY so, not silently no-op.
    const entity = "<h1>Lake &amp; House</h1>";
    const out = uniqueSplice(entity, { from: "Lake & House", to: "The Lake" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("editor");
  });

  it("counts matches inside attributes and scripts too — conservatively", () => {
    // "Book" is a headline AND an attribute value. Patching either would be
    // a guess; the rule refuses rather than guessing.
    const tricky = '<h1>Book</h1><a title="Book now">go</a>';
    expect(uniqueSplice(tricky, { from: "Book", to: "Reserve" }).ok).toBe(false);
  });

  it("refuses the empty selection and passes the unchanged one through", () => {
    expect(uniqueSplice(page, { from: "", to: "x" }).ok).toBe(false);
    expect(uniqueSplice(page, { from: "Book", to: "Book" })).toEqual({ ok: true, source: page });
  });
});

describe("several edits, one save", () => {
  const page = "<h1>Title</h1><p>Alpha</p><p>Beta</p>";

  it("applies in order, each judged against the source as patched so far", () => {
    const out = applyEdits(page, [
      { from: "Alpha", to: "Beta" }, // now "Beta" appears twice…
      { from: "Title", to: "Header" },
    ]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.source).toBe("<h1>Header</h1><p>Beta</p><p>Beta</p>");
  });

  it("one refusal refuses the WHOLE save, by name", () => {
    // The first edit makes "Beta" ambiguous; the second then trips on it.
    // A version holding half the edits is a version nobody asked for.
    const out = applyEdits(page, [
      { from: "Alpha", to: "Beta" },
      { from: "Beta", to: "Gamma" },
    ]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("2 times");
  });

  it("a save with nothing to say is refused, not minted", () => {
    expect(applyEdits(page, []).ok).toBe(false);
    expect(applyEdits(page, [{ from: "Title", to: "Title" }]).ok).toBe(false);
  });
});

describe("folding re-edits", () => {
  it("chains a re-edit back to the ORIGINAL the file still holds", () => {
    // Edit "Title"→"Header", then (in the frame, which now shows "Header")
    // edit "Header"→"Heading". The file still says "Title": one entry,
    // Title→Heading — never an intermediate the source cannot match.
    let pending = foldEdit([], { from: "Title", to: "Header" });
    pending = foldEdit(pending, { from: "Header", to: "Heading" });
    expect(pending).toEqual([{ from: "Title", to: "Heading" }]);
  });

  it("an edit that returns to the original disappears", () => {
    let pending = foldEdit([], { from: "Title", to: "Header" });
    pending = foldEdit(pending, { from: "Header", to: "Title" });
    expect(pending).toEqual([]);
  });

  it("keeps unrelated edits apart", () => {
    let pending = foldEdit([], { from: "Alpha", to: "A" });
    pending = foldEdit(pending, { from: "Beta", to: "B" });
    expect(pending).toHaveLength(2);
  });
});
