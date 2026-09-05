import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import { BROWSER_MIME } from "../src/browseritem.ts";
import { registerModule, unregisterModule } from "../src/modules.ts";
import { describeLosses, toJsonCanvas } from "../src/jsoncanvas.ts";

/**
 * `docs/research/json-canvas.md` costed this and recommended export first. Its
 * coordinate model is ours almost exactly — same units, same origin — which is
 * why the mapping below is straight across with no scaling and no flipped axis.
 */
const item = (
  id: string,
  x: number,
  y: number,
  extra: Partial<Item> = {},
  mime = "text/html",
  filename = `${id}.html`,
): Item =>
  ({
    id,
    title: id,
    x,
    y,
    width: 200,
    height: 100,
    properties: {},
    reactions: {},
    // Real items carry these; `mapNodes` sorts on `createdAt` and a fixture
    // without it fails inside the code under test rather than at the seam.
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    versions: [{ id: `v_${id}`, blobHash: "h", mimeType: mime, filename, size: 1, createdAt: "2026-01-01", createdBy: { id: "u", name: "u" } }],
    currentVersionId: `v_${id}`,
    ...extra,
  }) as unknown as Item;

const canvasOf = (items: Item[], threads: Record<string, unknown> = {}) =>
  ({ items: Object.fromEntries(items.map((i) => [i.id, i])), threads }) as unknown as CanvasContents;

describe("what crosses", () => {
  it("geometry goes straight across", () => {
    const { file } = toJsonCanvas(canvasOf([item("a", 40, -12)]));
    expect(file.nodes[0]).toMatchObject({ id: "a", type: "file", x: 40, y: -12, width: 200, height: 100 });
  });

  it("a file node names the item's current filename", () => {
    const { file } = toJsonCanvas(canvasOf([item("a", 0, 0, {}, "text/html", "hero.html")]));
    expect(file.nodes[0]!.file).toBe("hero.html");
  });

  it("a caller that can read bytes gets link nodes; one that cannot still gets the item", () => {
    /**
     * The URL lives in the BYTES of a `text/uri-list` blob, not in the version
     * record, so core cannot reach it. An exporter that pretended otherwise
     * would silently downgrade every link to a file — so the resolver is
     * explicit, and its absence loses the TYPE, never the node.
     */
    const site = item("s", 0, 0, {}, BROWSER_MIME, "example.uri");
    const withBytes = toJsonCanvas(canvasOf([site]), { bodyOf: () => "https://example.com\n" });
    expect(withBytes.file.nodes[0]).toMatchObject({ type: "link", url: "https://example.com" });
    const without = toJsonCanvas(canvasOf([site]));
    expect(without.file.nodes[0]).toMatchObject({ type: "file" });
  });
});

describe("edges — the question the research could not answer", () => {
  /**
   * `json-canvas.md` listed edges as "the whole question", unanswered, because
   * isocan had no relationship primitive. Mind maps shipped on 29 Aug and
   * answered it: an edge is a PROPERTY (`mapParent`), not a new op. So a canvas
   * holding a map exports as a graph rather than as a pile of boxes.
   *
   * Since 4 Sep the mind map is a module, and core asks the registry for
   * edges rather than the map by name (`core/modules.ts`). So this exercises
   * the seam with a module of its own — the mind map's real edges are proved
   * in `packages/modules/mindmap/test`.
   */
  const root = item("root", 0, 0, { properties: { "test.parent": "" } });
  const child = item("kid", 300, 0, { properties: { "test.parent": "root" } });
  const testModule = {
    name: "@isocan/test-edges",
    edges: (canvas: CanvasContents) =>
      Object.values(canvas.items).flatMap((to) => {
        const from = to.properties?.["test.parent"] ? canvas.items[to.properties["test.parent"]] : undefined;
        return from ? [{ from, to }] : [];
      }),
  };

  it("a module's edges become real edges, parent to child, with an arrow", () => {
    registerModule(testModule);
    try {
      const { file } = toJsonCanvas(canvasOf([root, child]));
      expect(file.edges).toEqual([{ id: "root-kid", fromNode: "root", toNode: "kid", toEnd: "arrow" }]);
    } finally {
      unregisterModule(testModule.name);
    }
  });

  it("a canvas with no edges exports none rather than inventing them, and so does a core with no module", () => {
    expect(toJsonCanvas(canvasOf([item("a", 0, 0)])).file.edges).toEqual([]);
    expect(toJsonCanvas(canvasOf([root, child])).file.edges).toEqual([]);
  });
});

describe("what does not cross, counted rather than dropped in silence", () => {
  /**
   * The format carries no versions, no threads, no properties, no reactions
   * and no oplog. An export that quietly drops half a canvas is the worst kind
   * of success, so the losses come back beside the file and every surface says
   * the same sentence.
   */
  it("counts every older version, thread, property and reaction", () => {
    const many = item("a", 0, 0, {
      properties: { kind: "screen", star: "1" },
      reactions: { "👍": ["u"] },
    });
    many.versions = [...many.versions, { ...many.versions[0]!, id: "v2" }, { ...many.versions[0]!, id: "v3" }];
    const { lost } = toJsonCanvas(canvasOf([many], { t1: { id: "t1", comments: [] } }));
    expect(lost).toEqual({ versions: 2, threads: 1, properties: 2, reactions: 1 });
  });

  it("says it in words, and says nothing when nothing was lost", () => {
    expect(describeLosses({ versions: 2, threads: 1, properties: 0, reactions: 0 })).toEqual([
      "2 older versions",
      "1 comment thread",
    ]);
    expect(describeLosses({ versions: 0, threads: 0, properties: 0, reactions: 0 })).toEqual([]);
  });
});
