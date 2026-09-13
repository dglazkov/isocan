import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { BROWSER_MIME } from "../src/browseritem.ts";
import {
  CANVAS_KIND,
  CANVAS_PROP,
  SOURCE_PROP,
  automaticCanvasTarget,
  canvasIdFromBlob,
  canvasIdOf,
  canvasItemOf,
  isCanvasItem,
  sourceOf,
} from "../src/canvasitem.ts";
import { itemKind } from "../src/kinds.ts";

/**
 * **A canvas placed on a canvas** (`docs/projects/inception/design.md`,
 * phase 0): a site's blob, told apart by kind, pointing at a canvas by id
 * and at an address by `source`.
 */
const item = (props: Record<string, string>, mimeType = BROWSER_MIME): Item =>
  ({
    id: "itm_1",
    title: "t",
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    properties: props,
    versions: [{ id: "v", blobHash: "h", mimeType, filename: "canvas.uri", size: 1 }],
    currentVersionId: "v",
  }) as unknown as Item;

describe("what a canvas item is", () => {
  it("is one function's answer on both surfaces: kind, id, source, and the blob", () => {
    const made = canvasItemOf("https://isocan.io", "prj_abc");
    expect(made.properties).toEqual({ kind: CANVAS_KIND, [CANVAS_PROP]: "prj_abc", [SOURCE_PROP]: "https://isocan.io/p/prj_abc" });
    expect(made.blob).toBe("https://isocan.io/p/prj_abc\n");
    expect(made.mimeType).toBe(BROWSER_MIME);
  });

  it("is told apart from a site by kind, not by its blob", () => {
    const canvas = item(canvasItemOf("https://isocan.io", "prj_abc").properties);
    const site = item({});
    expect(isCanvasItem(canvas)).toBe(true);
    expect(isCanvasItem(site)).toBe(false);
    expect(itemKind(canvas)).toBe("canvas");
    expect(itemKind(site)).toBe("site");
  });

  it("says which canvas and what to open", () => {
    const canvas = item(canvasItemOf("http://127.0.0.1:4441", "prj_abc").properties);
    expect(canvasIdOf(canvas)).toBe("prj_abc");
    expect(sourceOf(canvas)).toBe("http://127.0.0.1:4441/p/prj_abc");
    expect(canvasIdOf(item({}))).toBeNull();
    expect(sourceOf(item({}))).toBeNull();
  });

  it("can still read the canvas out of the blob when the properties do not say", () => {
    expect(canvasIdFromBlob("https://isocan.io/p/prj_abc\n")).toBe("prj_abc");
    expect(canvasIdFromBlob("# nothing\n")).toBeNull();
    expect(canvasIdFromBlob("https://isocan.io/p/prj_abc/i/itm_1\n")).toBeNull();
  });
});

describe("automatic preview targets", () => {
  it("keeps a declared source behind classification when kind is missing or changed", () => {
    for (const kind of [undefined, "site", "document", "image"]) {
      const card = item({ ...(kind ? { kind } : {}), source: "https://acme.invalid/p/prj_private" });
      expect(canvasIdOf(card)).toBeNull(); // Ordinary item-kind semantics stay intact.
      expect(automaticCanvasTarget(card.properties.canvas ?? null, sourceOf(card))).toEqual({
        kind: "canvas", canvasId: "prj_private", source: "https://acme.invalid/p/prj_private",
      });
    }
    expect(automaticCanvasTarget("prj_private", null)).toMatchObject({ kind: "canvas", canvasId: "prj_private" });
  });

  it("refuses malformed declarations and mismatched addresses instead of a renderer fallback", () => {
    for (const [id, source] of [
      ["", null], [" prj_private", null], ["prj_bad/id", null],
      ["prj_public", "https://acme.invalid/p/prj_private"],
      ["prj_private", "https://example.test/article"],
      [null, "https://acme.invalid/p/%FF"], [null, "https://acme.invalid/p/"],
      [null, "/p/prj_private"], [null, "https://acme.invalid/p/prj_bad%2Fother"],
    ] as const) expect(automaticCanvasTarget(id, source)).toMatchObject({ kind: "unavailable" });
  });

  it("recognizes item, deck and workbench addresses without widening the setup parser", () => {
    for (const suffix of ["/i/itm_card", "/deck", "/w/itm_card", "/?thread=thr_acme#reply"]) {
      expect(automaticCanvasTarget(null, `https://acme.invalid/p/prj_private${suffix}`)).toEqual({
        kind: "canvas", canvasId: "prj_private", source: "https://acme.invalid/p/prj_private",
      });
    }
    expect(automaticCanvasTarget(null, "localhost:4441/p/prj_private")).toEqual({
      kind: "canvas", canvasId: "prj_private", source: "http://localhost:4441/p/prj_private",
    });
    expect(canvasIdFromBlob("https://acme.invalid/p/prj_private/i/itm_card")).toBeNull();
  });

  it("leaves ordinary website and document sources in their existing renderers", () => {
    for (const source of [null, "", "https://example.test", "http://localhost:5173/app", "https://docs.google.com/document/d/acme/edit", "https://example.test/article?next=/p/prj_private"]) {
      expect(automaticCanvasTarget(null, source)).toEqual({ kind: "none" });
    }
  });
});
