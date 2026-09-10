import { describe, expect, it } from "vitest";
import { classifyAddable, normalizeSiteUrl } from "@isocan/core";
import { classifyAddableDraft } from "../src/lib/adddraft.ts";

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
