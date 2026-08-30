import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  CONTEXT_PROP,
  contextMark,
  excludedItems,
  markLabel,
  markPatch,
  pinnedItems,
} from "../src/contextmark.ts";
import { contextPieces } from "../src/context.ts";

/**
 * Stage 2 of `docs/projects/context/design.md`: *"the obvious verbs on that
 * list — pin an item into context, exclude one."* A property, not an
 * operation, so this adds zero new op types — the same answer `mapParent`
 * reached for edges.
 */
const item = (id: string, title: string, props: Record<string, string> = {}): Item =>
  ({
    id,
    title,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    properties: props,
    reactions: {},
    versions: [{ id: `v${id}`, blobHash: "h", mimeType: "text/html", filename: `${id}.html`, size: 1, createdAt: "2026-01-01T00:00:00.000Z", createdBy: { id: "u", name: "u" } }],
    currentVersionId: `v${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) as unknown as Item;

const canvasOf = (items: Item[]) =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads: {} }) as unknown as CanvasContents;

describe("a mark is a property", () => {
  it("reads pinned and excluded, and nothing else", () => {
    expect(contextMark(item("a", "A", { [CONTEXT_PROP]: "pinned" }))).toBe("pinned");
    expect(contextMark(item("b", "B", { [CONTEXT_PROP]: "excluded" }))).toBe("excluded");
    // A value nobody wrote deliberately is not a mark. A typo must not make an
    // item invisible to every agent that reads this list.
    expect(contextMark(item("c", "C", { [CONTEXT_PROP]: "hidden" }))).toBeNull();
    expect(contextMark(item("d", "D"))).toBeNull();
  });

  it("collects each kind separately", () => {
    const canvas = canvasOf([
      item("a", "A", { [CONTEXT_PROP]: "pinned" }),
      item("b", "B", { [CONTEXT_PROP]: "excluded" }),
      item("c", "C"),
    ]);
    expect(pinnedItems(canvas).map((i) => i.id)).toEqual(["a"]);
    expect(excludedItems(canvas).map((i) => i.id)).toEqual(["b"]);
  });
});

describe("clearing a mark actually clears it", () => {
  /**
   * `properties` MERGES, so omitting the key does not remove it — an unpin
   * that quietly left the pin on would be the worst of the three outcomes.
   * The vocabulary already had `removeProperties`; the first version of this
   * invented `{ properties: { context: null } }` and the typechecker refused
   * it, correctly.
   */
  it("uses removeProperties rather than a null the vocabulary does not have", () => {
    expect(markPatch(null)).toEqual({ removeProperties: [CONTEXT_PROP] });
    expect(markPatch("pinned")).toEqual({ properties: { [CONTEXT_PROP]: "pinned" } });
  });

  it("never writes a null into properties", () => {
    const patch = markPatch(null) as { properties?: Record<string, unknown> };
    expect(patch.properties).toBeUndefined();
  });
});

describe("what the view says about them", () => {
  it("lists pinned and marked as different things", () => {
    /**
     * A reaction is a response TO a thing; a pin is a decision about what an
     * agent should read. Stage 1 used reactions as the stand-in because
     * nothing else existed — collapsing them now would lose exactly the
     * distinction stage 2 was asked for.
     */
    const canvas = canvasOf([item("a", "Anchor", { [CONTEXT_PROP]: "pinned" })]);
    const names = contextPieces(canvas).map((p) => p.name);
    expect(names).toContain("Pinned items");
    expect(names).toContain("Marked items");
  });

  it("names the pinned items, because a count is not an answer", () => {
    const canvas = canvasOf([
      item("a", "Anchor", { [CONTEXT_PROP]: "pinned" }),
      item("b", "Brief", { [CONTEXT_PROP]: "pinned" }),
    ]);
    const piece = contextPieces(canvas).find((p) => p.name === "Pinned items");
    expect(piece?.size).toBe("Anchor, Brief");
  });

  it("says how to pin when nothing is pinned", () => {
    const piece = contextPieces(canvasOf([item("a", "A")])).find((p) => p.name === "Pinned items");
    expect(piece?.present).toBe(false);
    expect(piece?.fix).toContain("isocan context pin");
  });

  it("mentions exclusions only when there are some", () => {
    // "Excluded items: 0" on every canvas is a line that has never once been
    // news, and this view is read every session.
    const none = contextPieces(canvasOf([item("a", "A")])).map((p) => p.name);
    expect(none).not.toContain("Excluded items");
    const some = contextPieces(canvasOf([item("a", "A", { [CONTEXT_PROP]: "excluded" })]));
    expect(some.find((p) => p.name === "Excluded items")?.size).toBe("A");
  });

  it("an excluded item is not deleted — it is still on the canvas", () => {
    // The mark changes what a reader is TOLD, not what exists. That is why
    // this is a mark and not the trash.
    const canvas = canvasOf([item("a", "A", { [CONTEXT_PROP]: "excluded" })]);
    const canvasPiece = contextPieces(canvas).find((p) => p.name === "The canvas");
    expect(canvasPiece?.size).toContain("1 item");
  });

  it("says what a mark means in words", () => {
    expect(markLabel("pinned")).toBe("pinned into context");
    expect(markLabel("excluded")).toBe("kept out of context");
  });
});
