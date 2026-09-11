import { describe, expect, it } from "vitest";
import { addableWords, classifyAddable, normalizeSiteUrl } from "@isocan/core";
import { classifyAddableDraft, siteDraftWords } from "../src/lib/adddraft.ts";

const canvases = [{ id: "prj_acme", title: "Acme" }];

describe("an address being typed is not a submitted URL", () => {
  it.each(["https://example.com/docs", "http://localhost:5173/path", "http://[::1]:3000/"])(
    "can preview every keystroke of %s without throwing",
    (url) => {
      for (let end = 0; end <= url.length; end++) {
        expect(() => classifyAddableDraft(url.slice(0, end), canvases)).not.toThrow();
      }
    },
  );

  it.each(["https://", "http://[", "ftp://example.com", "http://[::"])(
    "holds %s as a draft without weakening submit validation",
    (input) => {
      expect(classifyAddableDraft(input, canvases)).toEqual({ kind: "site", url: input });
      expect(() => normalizeSiteUrl(input)).toThrow();
    },
  );

  it.each(["https://example.com/x", "localhost:5173", "Acme", "unmatched words", "", "   ", "https://isocan.example/p/prj_acme"])(
    "preserves the shared classifier's result for %j",
    (input) => {
      expect(classifyAddableDraft(input, canvases)).toEqual(classifyAddable(input, canvases));
    },
  );
});

/**
 * **A preview never promises what submit will refuse.** The draft kind exists
 * so a half-typed address stays in the field, but `addableWords` reads that
 * kind as "Add <label> as a live site" — and for `https://` the label is empty,
 * so the line rendered "Add  as a live site". Worse, an unsupported scheme was
 * announced as a live site directly above the error refusing it.
 */
describe("what the preview says about a draft", () => {
  /* Only site-shaped input reaches here: `looksLikeSite` gates the draft
     fallback, so "https:/" (one slash, no dot) is words to search with and
     never wears kind "site" at all. */
  it.each(["https://", "http://", "http://[::", "https://["])(
    "waits for %j rather than describing it as a site",
    (input) => {
      expect(siteDraftWords(input)).toBe("Keep typing — that is not a whole address yet.");
    },
  );

  it.each([
    ["ftp://example.com", "ftp"],
    ["file:///etc/passwd", "file"],
    ["chrome://flags", "chrome"],
  ])("says why %j will never be projected, before submit does", (input, scheme) => {
    expect(siteDraftWords(input)).toBe(`Only http:// and https:// can be projected — not ${scheme}://`);
  });

  it.each(["https://example.com/x", "localhost:5173", "127.0.0.1:3000/app"])(
    "stands aside for %j, so the shared words still describe a real address",
    (input) => {
      expect(siteDraftWords(input)).toBeNull();
    },
  );

  it("never leaves a blank where the address should be", () => {
    for (const url of ["https://example.com/docs", "http://localhost:5173/path"]) {
      for (let end = 0; end <= url.length; end++) {
        const draft = classifyAddableDraft(url.slice(0, end), canvases);
        if (draft.kind !== "site") continue;
        const words = siteDraftWords(draft.url) ?? addableWords(draft);
        expect(words).not.toMatch(/ {2}/);
        expect(words).not.toMatch(/^Add\s+as a live site$/);
      }
    }
  });
});
