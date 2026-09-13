import { describe, expect, it } from "vitest";
import { ambientContextManifest, applyOperation, blobsNamedBy, contextContentPage, contextManifest, deckPages, describeLosses, groupCopyAction, groupCopySource, groupRestorePreview, invertOperation, rejectPublicContext, resolveCanvasGroupRequest, resolveContextOperation, toJsonCanvas, validateContextManifest } from "../src/index.ts";
import type { CanvasState, Item, Operation } from "../src/index.ts";

const actor = { id: "usr_test", name: "Test" };
const ts = "2026-09-13T12:00:00.000Z";
const version = (id: string) => ({ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 17, createdAt: ts, createdBy: actor });
function item(id: string, parent?: string, properties: Record<string, string> = {}): Item {
  return { id, title: `Acme ${id}`, description: "", x: 80, y: 220, width: 200, height: 200, ...(parent ? { containerId: parent } : {}), properties, versions: [version(id)], currentVersionId: `ver_${id}`, createdAt: ts, createdBy: actor, updatedAt: ts, updatedBy: actor };
}
function seed(): CanvasState {
  const state = applyOperation(null, { id: "op_birth", actor, ts, canvasId: "prj_context", op: { type: "project.create", canvasId: "prj_context", title: "Acme context", groupMode: "groups" } })!;
  const outer = { ...item("outer", undefined, { kind: "group" }), x: 0, y: 0, width: 800, height: 800 };
  const inner = { ...item("inner", "outer", { kind: "group" }), x: 40, y: 110, width: 600, height: 600 };
  const a = item("a", "inner");
  a.versions[0]!.visual = { blobHash: "hash_visual", mimeType: "image/png" };
  const b = { ...item("b", "inner", { context: "excluded" }), x: 100, y: 240 };
  const mark = { ...item("ink", "inner", { kind: "drawing", annotates: "a", region: "0,0,1,1" }), x: 90, y: 240, width: 60, height: 60 };
  mark.versions[0]!.mimeType = "image/svg+xml";
  const outside = item("outside");
  state.canvas.items = Object.fromEntries([outer, inner, a, b, mark, outside].map((one) => [one.id, one]));
  return state;
}
function apply(state: CanvasState, op: Operation, seq = 10): { state: CanvasState; op: Operation; inverse: Operation | null } {
  const context = resolveContextOperation(state, seq, op);
  const resolved = resolveCanvasGroupRequest(state, context, { actor, ts, opId: `op_${seq}` });
  return { state: applyOperation(state, { id: `op_${seq}`, actor, ts, canvasId: state.project.id, op: resolved })!, op: resolved, inverse: invertOperation(state, resolved) };
}
const message = (rootIds: string[], expectedRevision?: number): Operation => ({ type: "thread.create", threadId: "thr_context", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_context", body: "Review Acme", contextRequest: { rootIds, ...(expectedRevision !== undefined ? { expectedRevision } : {}) } } });

describe("complete frozen canvas-group context", () => {
  it("keeps actual roots while deduplicating hierarchy in either group-plus-child selection order", () => {
    const state = seed();
    const a = contextManifest(state, 10, { rootIds: ["a", "outer", "a"] });
    const b = contextManifest(state, 10, { rootIds: ["outer", "a"] });
    expect(a.rootIds).toEqual(["a", "outer"]);
    expect(a.entries).toEqual(b.entries);
    expect(a.expandedIds).toEqual(["outer", "inner", "a", "ink", "b"]);
    expect(a.entries.map((entry) => entry.depth)).toEqual([0, 1, 2, 2, 2]);
    expect(a.counts).toEqual({ included: 4, excluded: 1, unavailable: 0 });
    expect(a.entries.find((entry) => entry.itemId === "a")!.version!.visual).toEqual({ blobHash: "hash_visual", mimeType: "image/png", filename: "a.md", size: 17 });
    expect(a.expandedIds).not.toContain("outside");
    expect(a.entries.find((entry) => entry.itemId === "ink")!.annotation).toEqual({ targetId: "a", region: "0,0,1,1" });
    state.canvas.items.ink!.y = 140;
    expect(contextManifest(state, 11, { rootIds: ["outer"] }).entries.find((entry) => entry.itemId === "ink")!.depth).toBe(2);
  });

  it("shows exclusions and missing entries, and overrides only explicitly requested exclusions", () => {
    const state = seed();
    state.canvas.items.inner!.properties.context = "excluded";
    state.canvas.items.outer!.properties.context = "pinned";
    state.canvas.items.a!.properties.context = "pinned";
    const ambient = ambientContextManifest(state, 10);
    expect(ambient.entries.find((entry) => entry.itemId === "a")!.excluded).toBe(true);
    const explicit = contextManifest(state, 10, { rootIds: ["inner", "missing"] });
    expect(explicit.entries.find((entry) => entry.itemId === "a")!.excluded).toBe(false);
    expect(explicit.entries.find((entry) => entry.itemId === "missing")!.unavailable).toMatch(/not live/);
    const page = contextContentPage(explicit, { limit: 20 });
    expect(page.entries.find((entry) => entry.itemId === "b")).toEqual({ itemId: "b", versionId: "ver_b", face: "source", status: "excluded", reason: "content excluded for this request" });
    expect(contextManifest(state, 10, { rootIds: ["inner"], includeExcluded: true }).counts.excluded).toBe(0);
  });

  it("resolves writer provenance once, refuses stale previews and caller-supplied frozen metadata", () => {
    const state = seed();
    expect(() => apply(state, message(["outer"], 9))).toThrow(/changed since preview/);
    const sent = apply(state, message(["outer"], 10));
    const comment = sent.state.canvas.threads.thr_context!.comments[0]!;
    expect(comment.items).toEqual(["outer", "inner", "a", "ink", "b"]);
    expect(comment.context!.revision).toBe(10);
    expect(() => rejectPublicContext({ type: "thread.reply", threadId: "thr_context", comment: { id: "forged", body: "forged", context: comment.context } } as Operation)).toThrow(/writer/);
    const next = structuredClone(sent.state);
    next.canvas.items.a!.containerId = "outer";
    next.canvas.items.a!.versions = [version("new")]; next.canvas.items.a!.currentVersionId = "ver_new";
    expect(next.canvas.threads.thr_context!.comments[0]!.context).toEqual(comment.context);
    expect(contextContentPage(comment.context!, { face: "visual" }).entries.find((entry) => entry.itemId === "a")!.blob!.blobHash).toBe("hash_visual");
  });

  it("preserves old context through ordinary body edits and exactly undoes an explicit scope replacement", () => {
    const sent = apply(seed(), message(["outer"])).state;
    const before = sent.canvas.threads.thr_context!.comments[0]!;
    const edited = apply(sent, { type: "comment.update", threadId: "thr_context", commentId: "cmt_context", body: "Reworded" }).state;
    expect(edited.canvas.threads.thr_context!.comments[0]!.context).toEqual(before.context);
    expect(edited.canvas.threads.thr_context!.comments[0]!.items).toEqual(before.items);
    const replaced = apply(edited, { type: "comment.update", threadId: "thr_context", commentId: "cmt_context", body: "Narrowed", contextRequest: { rootIds: ["a"] } });
    const undone = applyOperation(replaced.state, { id: "op_undo", actor, ts, canvasId: sent.project.id, op: replaced.inverse! })!;
    expect(undone.canvas.threads.thr_context!.comments[0]!.context).toEqual(before.context);
  });

  it("gates new context to group canvases while replaying ordinary historical comments unchanged", () => {
    const legacy = seed(); delete legacy.project.groupMode;
    expect(() => apply(legacy, message(["a"]))).toThrow(/group-mode/);
    const op: Operation = { type: "thread.create", threadId: "thr_plain", anchorItemId: null, x: 0, y: 0, comment: { id: "cmt_plain", body: "Acme plain", items: ["a"] } };
    expect(resolveContextOperation(legacy, 3, op)).toBe(op);
    expect(() => apply(seed(), { ...message(["outer"]), comment: { id: "bad", body: "Bad", contextRequest: null } } as unknown as Operation)).toThrow(/context/);
  });

  it("retains source and distinct visual metadata after every original item and version is gone", () => {
    const sent = apply(seed(), message(["outer"])).state;
    sent.canvas.items = {}; sent.canvas.trash = [];
    const named = blobsNamedBy([], sent);
    expect(named.get("hash_a")).toEqual({ mimeType: "text/markdown", filename: "a.md", size: 17 });
    expect(named.get("hash_visual")).toEqual({ mimeType: "image/png", filename: "a.md", size: 17 });
    const context = sent.canvas.threads.thr_context!.comments[0]!.context!;
    expect(() => validateContextManifest(context, "other_canvas")).toThrow(/manifest/);
  });

  it("returns a complete 1000-member manifest and bounded pages rather than truncating scope", () => {
    const state = seed();
    state.canvas.items = { outer: state.canvas.items.outer! };
    for (let i = 0; i < 1000; i++) state.canvas.items[`child_${i}`] = { ...item(`child_${i}`, "outer"), y: i * 240 };
    const result = contextManifest(state, 100, { rootIds: ["outer"] });
    expect(result.entries).toHaveLength(1001);
    expect(result.counts.included).toBe(1001);
    const collected = [];
    for (let offset = 0; offset < result.entries.length; offset += 200) collected.push(...contextContentPage(result, { offset, limit: 200 }).entries);
    expect(collected.map((entry) => entry.itemId)).toEqual(result.expandedIds);
    expect(contextContentPage(result, { offset: 1000, limit: 200 }).nextOffset).toBeNull();
  });
});

describe("atomic copy and cohort lifecycle", () => {
  const copied = (state: CanvasState, roots: string[], into?: string, sourceState = state) => {
    let next = 0;
    return groupCopyAction(groupCopySource(sourceState.project.id, sourceState.canvas, roots), state.project.id, { newItemId: () => `copy_${++next}`, newVersionId: () => `copy_ver_${++next}`, ...(into ? { containerId: into } : {}), at: { x: 900, y: 100 }, groupPlacement: "preserve" });
  };
  it("copies nested ownership and overlaps in one canonical creation with an exact inverse", () => {
    const original = seed();
    original.canvas.items.a!.properties.literal = "inner";
    const action = copied(original, ["outer", "a"]);
    expect(action.rootIds).toHaveLength(1);
    const made = apply(original, { type: "group.change", action });
    expect(made.op).toMatchObject({ type: "group.change", action: { kind: "apply", change: { intent: "create" } } });
    const find = (name: string) => Object.values(made.state.canvas.items).find((one) => one.title === `Acme ${name}` && one.id.startsWith("copy_"))!;
    expect(find("a").containerId).toBe(find("inner").id);
    expect(find("inner").containerId).toBe(find("outer").id);
    expect(find("ink").properties.annotates).toBe(find("a").id);
    expect(find("b").x - find("a").x).toBe(20);
    expect(find("b").y - find("a").y).toBe(20);
    expect(find("a").properties.parent).toBe("a");
    expect(find("a").properties.literal).toBe("inner");
    const restored = applyOperation(made.state, { id: "undo", actor, ts, canvasId: original.project.id, op: made.inverse! })!;
    expect(restored.canvas.items).toEqual(original.canvas.items);
  });
  it("copies a member alone without its frame and detaches cross-canvas external annotations", () => {
    const source = seed();
    const destination = seed(); destination.project.id = "prj_destination"; destination.canvas.items = {};
    const member = copied(destination, ["a"], undefined, source);
    expect(member.items).toHaveLength(2);
    expect(member.items.every((one) => one.containerId === undefined)).toBe(true);
    expect(member.items.find((one) => one.title === "Acme ink")!.properties!.annotates).toBe(member.rootIds[0]);
    const mark = copied(destination, ["ink"], undefined, source);
    const made = apply(destination, { type: "group.change", action: mark });
    const ink = made.state.canvas.items[mark.rootIds[0]!]!;
    expect(ink.properties.annotates).toBeUndefined(); expect(ink.properties.region).toBeUndefined();
  });
  it("retains same-canvas external ink only at its target's parent and detaches it elsewhere", () => {
    const state = seed();
    const sameParent = copied(state, ["ink"], "inner");
    const kept = apply(state, { type: "group.change", action: sameParent }).state.canvas.items[sameParent.rootIds[0]!]!;
    expect(kept.properties.annotates).toBe("a");
    const rootCopy = copied(state, ["ink"]);
    const detached = apply(state, { type: "group.change", action: rootCopy }).state.canvas.items[rootCopy.rootIds[0]!]!;
    expect(detached.properties.annotates).toBeUndefined(); expect(detached.properties.region).toBeUndefined();
    expect(detached.width).toBe(state.canvas.items.ink!.width);
  });
  it("refuses malformed copy payloads without changing the original canvas", () => {
    const state = seed(); const original = JSON.stringify(state);
    const action = copied(state, ["outer"]);
    const variants = [
      { ...action, rootIds: ["not_copied"] },
      { ...action, items: [{ ...action.items[0]!, createdBy: actor }, ...action.items.slice(1)] },
      { ...action, items: [{ ...action.items[0]!, box: { ...action.items[0]!.box, id: "injected" } }, ...action.items.slice(1)] },
      { ...action, items: [{ ...action.items[0]!, containerId: "outer" }, ...action.items.slice(1)] },
    ];
    for (const candidate of variants) expect(() => apply(state, { type: "group.change", action: candidate } as Operation)).toThrow();
    expect(JSON.stringify(state)).toBe(original);
  });
  it("restores only the ancestor's original cohort after a child was restored and deleted again", () => {
    let state = apply(seed(), { type: "group.change", action: { kind: "delete", itemIds: ["outer"] } }, 11).state;
    state = apply(state, { type: "group.change", action: { kind: "restore", itemIds: ["a"] } }, 12).state;
    state = apply(state, { type: "group.change", action: { kind: "delete", itemIds: ["a"] } }, 13).state;
    expect(groupRestorePreview(state, ["outer"]).skippedIds).toContain("a");
    const restored = apply(state, { type: "group.change", action: { kind: "restore", itemIds: ["outer"] } }, 14).state;
    expect(restored.canvas.items.a).toBeUndefined();
    expect(restored.canvas.trash.find((entry) => entry.item.id === "a")!.cohort!.id).toBe("op_13");
  });
});

it("extracts decks by membership and reports the JSON Canvas projection's group losses", () => {
  const state = apply(seed(), message(["outer"])).state;
  expect(deckPages(state.canvas, "outer").map((page) => page.id)).not.toContain("outside");
  expect(deckPages(state.canvas, "outer").map((page) => page.id)).not.toContain("inner");
  const projected = toJsonCanvas(state.canvas);
  expect(projected.file.nodes.find((node) => node.id === "outer")).toMatchObject({ type: "group", label: "Acme outer" });
  expect(projected.lost.groupMemberships).toBe(4);
  expect(projected.lost.contextRequests).toBe(1);
  expect(describeLosses(projected.lost).join("; ")).toMatch(/explicit group memberships.*frozen request context/);
});
