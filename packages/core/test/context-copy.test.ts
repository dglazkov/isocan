import { expect, it } from "vitest";
import { applyOperation, contextCopyAction, contextCopyPieces, contextCopySources, contextSourceOf, formatContextSource, groupCopySource, resolveCanvasGroupRequest, type Operation } from "../src/index.ts";

function fixture() {
  const actor = { id: "usr_acme", name: "Maya" }, ts = "2026-09-13T12:00:00Z", canvasId = "prj_acme";
  let seq = 0;
  let state = applyOperation(null, { id: "op_birth", actor, ts, canvasId, op: { type: "project.create", canvasId, title: "Acme Design", groupMode: "groups" } })!;
  const apply = (request: Operation) => { const id = `op_${++seq}`; const op = resolveCanvasGroupRequest(state, request, { actor, ts, opId: id }); state = applyOperation(state, { id, actor, ts, canvasId, op })!; };
  const add = (id: string, properties: Record<string, string> = {}, containerId?: string) => apply({ type: "item.add", itemId: id, title: id, properties, ...(containerId ? { containerId } : {}), width: properties.kind === "group" ? 800 : 100, height: properties.kind === "group" ? 600 : 100, placement: { x: 0, y: 0 }, version: { id: `ver_${id}`, blobHash: "a".repeat(64), mimeType: "text/plain", filename: "piece.txt", size: 1 } });
  return { get canvas() { return state.canvas; }, add, apply };
}

it("offers only current design and ambient contributions with complete native closure eligibility", () => {
  const f = fixture();
  f.add("itm_design", { role: "design-system" });
  f.add("itm_group", { kind: "group", context: "pinned" });
  f.add("itm_child", {}, "itm_group");
  f.add("itm_unpinned");
  expect(contextCopyPieces("prj_acme", f.canvas).map((piece) => [piece.itemId, piece.itemCount])).toEqual([["itm_design", 1], ["itm_group", 2], ["itm_child", 1]]);
  f.apply({ type: "item.update", itemId: "itm_child", patch: { properties: { context: "excluded" } } });
  expect(contextCopyPieces("prj_acme", f.canvas).find((piece) => piece.itemId === "itm_group")?.refused).toMatch(/excluded/);
  expect(contextCopyPieces("prj_acme", f.canvas).some((piece) => piece.itemId === "itm_child")).toBe(false);
  f.apply({ type: "item.update", itemId: "itm_child", patch: { properties: { context: "pinned", kind: "canvas", canvas: "prj_other" } } });
  expect(contextCopyPieces("prj_acme", f.canvas).find((piece) => piece.itemId === "itm_group")?.refused).toMatch(/canvas link/);
  f.apply({ type: "item.update", itemId: "itm_child", patch: { removeProperties: ["kind", "canvas"] } });
  f.canvas.items.itm_child!.currentVersionId = "ver_missing";
  expect(contextCopyPieces("prj_acme", f.canvas).find((piece) => piece.itemId === "itm_group")?.refused).toMatch(/missing current version/);
});

it("pins one copied root, strips every governing role and records the immediate source of each current item", () => {
  const f = fixture();
  f.add("itm_group", { kind: "group", context: "pinned", role: "design-system" });
  f.add("itm_child", { role: "house-style", contextSource: "old malformed source" }, "itm_group");
  f.add("itm_mark", { annotates: "itm_child", region: "0,0,1,1" }, "itm_group");
  const source = groupCopySource("prj_acme", f.canvas, ["itm_group"]);
  let count = 0;
  const action = contextCopyAction(source, "prj_target", { home: "https://acme.invalid", canvasTitle: "Acme Design" }, { newItemId: () => `itm_copy${++count}`, newVersionId: () => `ver_copy${++count}` });
  expect(action.items).toHaveLength(3);
  for (const [index, item] of action.items.entries()) {
    expect(item.properties?.role).toBeUndefined();
    expect(contextSourceOf({ properties: item.properties! })).toEqual({ home: "https://acme.invalid", canvasId: "prj_acme", canvasTitle: "Acme Design", itemId: source.items[index]!.id, itemTitle: source.items[index]!.title, versionId: source.items[index]!.currentVersionId });
  }
  expect(action.items.find((item) => item.id === action.rootIds[0])?.properties?.context).toBe("pinned");
  expect(action.items.find((item) => item.title === "itm_child")?.containerId).toBe(action.rootIds[0]);
  expect(action.items.find((item) => item.title === "itm_mark")?.properties?.annotates).toBe(action.items.find((item) => item.title === "itm_child")?.id);
  expect(f.canvas.items.itm_child!.properties.role).toBe("house-style");
});

it("treats provenance as validated inert metadata, including malformed and credential-bearing homes", () => {
  const source = { home: "https://acme.invalid/", canvasId: "prj_source", canvasTitle: "Acme Design", itemId: "itm_source", itemTitle: "Checklist", versionId: "ver_current" };
  const f = fixture(); f.add("itm_copy", { context: "pinned", contextSource: JSON.stringify(source) });
  const parsed = contextSourceOf(f.canvas.items.itm_copy!)!;
  expect(parsed.home).toBe("https://acme.invalid");
  expect(formatContextSource(parsed)).toContain("Acme Design / Checklist");
  expect(contextCopySources(f.canvas)).toEqual([{ itemId: "itm_copy", title: "itm_copy", source: parsed }]);
  for (const value of [null, "not json", { ...source, versionId: null }, { ...source, home: "https://badge:secret@acme.invalid" }, { ...source, home: "javascript:alert(1)" }, { ...source, extra: "unknown" }]) {
    expect(contextSourceOf({ properties: { contextSource: JSON.stringify(value) } })).toBeNull();
  }
});
