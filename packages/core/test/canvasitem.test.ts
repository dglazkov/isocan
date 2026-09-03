import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import { BROWSER_MIME } from "../src/browseritem.ts";
import {
  CANVAS_KIND,
  CANVAS_PROP,
  SOURCE_PROP,
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
