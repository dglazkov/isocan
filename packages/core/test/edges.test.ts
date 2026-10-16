import { describe, expect, it } from "vitest";
import {
  declaredEdgesOf,
  directionalEdgeGeometry,
  edgeLabelProperty,
  edgePatch,
  EDGES_PROP,
  EDGE_PROP_PREFIX,
  groupCopyAction,
  groupCopySource,
  isEdgeReferenceProperty,
  nodeEdges,
  removeEdgePatch,
  toJsonCanvas,
  type CanvasContents,
  type Item,
} from "../src/index.ts";

const actor = { id: "usr_a", name: "Alice" };
const stamp = {
  createdAt: "2026-01-01T00:00:00Z",
  createdBy: actor,
  updatedAt: "2026-01-01T00:00:00Z",
  updatedBy: actor,
};

function makeItem(
  id: string,
  x: number,
  y: number,
  width = 200,
  height = 100,
  properties: Record<string, string> = {},
  extra: Partial<Item> = {},
): Item {
  return {
    id,
    title: id,
    description: "",
    x,
    y,
    width,
    height,
    properties,
    currentVersionId: `ver_${id}`,
    versions: [
      {
        id: `ver_${id}`,
        blobHash: `hash_${id}`,
        mimeType: "text/markdown",
        filename: `${id}.md`,
        size: 12,
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: actor,
      },
    ],
    ...stamp,
    ...extra,
  };
}

function makeCanvas(items: Item[]): CanvasContents {
  return {
    items: Object.fromEntries(items.map((item) => [item.id, item])),
    threads: {},
    trash: [],
  };
}

describe("node-declared directional edges", () => {
  it("recognizes edge reference properties and preserves edge label properties separately", () => {
    expect(isEdgeReferenceProperty("edge:next")).toBe(true);
    expect(isEdgeReferenceProperty("edge:next:label")).toBe(false);
    expect(isEdgeReferenceProperty(EDGES_PROP)).toBe(false);
    expect(isEdgeReferenceProperty("module")).toBe(false);
    expect(edgeLabelProperty(`${EDGE_PROP_PREFIX}submit`)).toBe("edge:submit:label");
  });

  it("extracts declared edges from edge:<key> and JSON or comma-separated edges properties", () => {
    const item = makeItem("a", 0, 0, 200, 100, {
      "edge:submit": "b",
      "edge:submit:label": "On submit",
      "edge:cancel": "c",
      edges: "d, b, e",
    });

    const declared = declaredEdgesOf(item);
    expect(declared).toEqual([
      { key: "cancel", to: "c" },
      { key: "submit", to: "b", label: "On submit" },
      { key: "d", to: "d" },
      { key: "b", to: "b" },
      { key: "e", to: "e" },
    ]);

    const jsonItem = makeItem("j", 0, 0, 200, 100, {
      edges: JSON.stringify([
        { key: "flow", to: "b", label: "Next" },
        "c",
      ]),
    });
    expect(declaredEdgesOf(jsonItem)).toEqual([
      { key: "flow", to: "b", label: "Next" },
      { key: "c", to: "c" },
    ]);
  });

  it("resolves canvas-wide nodeEdges against live items and ignores self or missing targets", () => {
    const a = makeItem("a", 0, 0, 200, 100, {
      "edge:ok": "b",
      "edge:ok:label": "Continue",
      "edge:self": "a",
      "edge:missing": "nope",
    });
    const b = makeItem("b", 400, 0, 200, 100);

    const edges = nodeEdges(makeCanvas([a, b]));
    expect(edges).toHaveLength(1);
    expect(edges[0]?.from.id).toBe("a");
    expect(edges[0]?.to.id).toBe("b");
    expect(edges[0]?.key).toBe("ok");
    expect(edges[0]?.label).toBe("Continue");
  });

  it("builds patches to declare and remove edges", () => {
    expect(edgePatch("b")).toEqual({ "edge:b": "b" });
    expect(edgePatch("b", { key: "submit", label: "Submit" })).toEqual({
      "edge:submit": "b",
      "edge:submit:label": "Submit",
    });
    expect(removeEdgePatch("edge:submit")).toEqual({
      "edge:submit": null,
      "edge:submit:label": null,
    });
  });

  it("computes directional cubic bezier geometry from source boundary to target boundary", () => {
    const a = makeItem("a", 0, 0, 200, 100);
    const b = makeItem("b", 400, 0, 200, 100);
    const geom = directionalEdgeGeometry(a, b);
    expect(geom.x1).toBeCloseTo(200, 1);
    expect(geom.y1).toBeCloseTo(50, 1);
    expect(geom.x2).toBeCloseTo(400, 1);
    expect(geom.y2).toBeCloseTo(50, 1);
    expect(geom.mx).toBeCloseTo(300, 1);
    expect(geom.my).toBeCloseTo(50, 1);
  });

  it("remaps edge:<key> target IDs when duplicating a group", () => {
    const g = makeItem("g", 0, 0, 600, 400, { kind: "group" });
    const n1 = makeItem(
      "n1",
      20,
      20,
      160,
      80,
      {
        "edge:next": "n2",
        "edge:next:label": "Step 2",
      },
      { containerId: "g" },
    );
    const n2 = makeItem("n2", 240, 20, 160, 80, {}, { containerId: "g" });
    const canvas = makeCanvas([g, n1, n2]);

    const source = groupCopySource("c1", canvas, ["g"]);
    let itemSeq = 0;
    let verSeq = 0;
    const action = groupCopyAction(source, "c1", {
      newItemId: () => `dup_${++itemSeq}`,
      newVersionId: () => `dver_${++verSeq}`,
    });

    const dup1 = action.items.find((i) => i.title === "n1");
    const dup2 = action.items.find((i) => i.title === "n2");
    expect(dup1).toBeDefined();
    expect(dup2).toBeDefined();
    expect(dup1?.properties?.["edge:next"]).toBe(dup2?.id);
    expect(dup1?.properties?.["edge:next:label"]).toBe("Step 2");
  });

  it("exports declared node edges to JSON Canvas edges", () => {
    const canvas = makeCanvas([
      makeItem("a", 0, 0, 200, 100, {
        "edge:flow": "b",
        "edge:flow:label": "Next screen",
      }),
      makeItem("b", 400, 0, 200, 100),
    ]);

    const exported = toJsonCanvas(canvas);
    expect(exported.file.edges).toEqual([
      {
        id: "a-flow-b",
        fromNode: "a",
        toNode: "b",
        toEnd: "arrow",
        label: "Next screen",
      },
    ]);
  });
});
