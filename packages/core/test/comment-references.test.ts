import { describe, expect, it } from "vitest";
import { applyOperation, commentReferencedItemIds, contextContentPage, resolveContextOperation, threadTargetItem, type CanvasState, type Comment, type CommentThread, type Item } from "../src/index.ts";

const actor = { id: "usr_test", name: "Test" };
const ts = "2026-09-13T12:00:00.000Z";
function item(id: string, properties: Record<string, string> = {}, containerId?: string): Item {
  return { id, title: `Acme ${id}`, description: "", x: 0, y: 0, width: 200, height: 200,
    properties, ...(containerId ? { containerId } : {}),
    currentVersionId: `ver_${id}`, versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 10, createdAt: ts, createdBy: actor }],
    createdAt: ts, createdBy: actor, updatedAt: ts, updatedBy: actor };
}
function seed(): CanvasState {
  const state = applyOperation(null, { id: "op_birth", actor, ts, canvasId: "prj_test", op: { type: "project.create", canvasId: "prj_test", title: "Acme", groupMode: "groups" } })!;
  state.canvas.items = Object.fromEntries([
    item("group", { kind: "group" }), item("child", {}, "group"), item("linked"),
    item("nearby"), item("excluded", { context: "excluded" }), item("deleted"), item("unavailable"),
  ].map((one) => [one.id, one]));
  state.canvas.items.unavailable!.versions = [];
  return state;
}
function saved(state: CanvasState, roots: string[]): Comment {
  const op = resolveContextOperation(state, 12, { type: "thread.create", threadId: "thr_test", x: 0, y: 0, anchorItemId: null,
    comment: { id: "cmt_test", body: "Review this selection", contextRequest: { rootIds: roots } } });
  return applyOperation(state, { id: "op_comment", actor, ts, canvasId: "prj_test", op })!.canvas.threads.thr_test!.comments[0]!;
}

describe("current previews of recorded message references", () => {
  it("keeps explicit reference order once, ignoring deleted items and unrelated work by the same author at the same time and position", () => {
    const state = seed();
    delete state.canvas.items.deleted;
    expect(commentReferencedItemIds(state.canvas, { items: ["linked", "deleted", "linked", "unavailable"] })).toEqual(["linked"]);
    expect(commentReferencedItemIds(state.canvas, {})).toEqual([]);
  });

  it("uses saved roots rather than the writer-expanded comment.items, including an explicitly selected child only once", () => {
    const state = seed();
    const comment = saved(state, ["group", "linked", "group"]);
    expect(comment.items).toContain("child"); // Real canonical expansion is the regression boundary.
    expect(commentReferencedItemIds(state.canvas, comment)).toEqual(["group", "linked"]);
    expect(commentReferencedItemIds(state.canvas, saved(state, ["group", "child", "child"]))).toEqual(["group", "child"]);
  });

  it("never previews a saved excluded or unavailable root, even if it is available now", () => {
    const state = seed();
    const comment = saved(state, ["excluded", "unavailable", "missing", "linked"]);
    state.canvas.items.excluded!.properties = {};
    state.canvas.items.unavailable = item("unavailable");
    state.canvas.items.missing = item("missing");
    expect(commentReferencedItemIds(state.canvas, comment)).toEqual(["linked"]);
    comment.context!.entries = comment.context!.entries.filter((entry) => entry.itemId !== "linked");
    expect(commentReferencedItemIds(state.canvas, comment)).toEqual([]); // No fallback to expanded item IDs.
  });

  it("shows the live selected item after edits without changing frozen versions, and removes cards when no current item exists", () => {
    const state = seed();
    const comment = saved(state, ["linked", "deleted"]);
    const frozen = structuredClone(comment.context!);
    state.canvas.items.linked!.versions.push({ ...state.canvas.items.linked!.versions[0]!, id: "ver_new", blobHash: "hash_new" });
    state.canvas.items.linked!.currentVersionId = "ver_new";
    delete state.canvas.items.deleted;
    expect(commentReferencedItemIds(state.canvas, comment)).toEqual(["linked"]);
    expect(comment.context).toEqual(frozen);
    expect(contextContentPage(comment.context!).entries[0]!.blob!.blobHash).toBe("hash_linked");
    state.canvas.items.linked!.currentVersionId = "no-longer-available";
    expect(commentReferencedItemIds(state.canvas, comment)).toEqual([]);
  });
});

describe("threadTargetItem", () => {
  it("resolves anchored items first, then explicit comment item refs (including on the main chat thread)", () => {
    const state = seed();
    const anchored: CommentThread = {
      id: "thr_anchored",
      x: 10,
      y: 20,
      anchorItemId: "linked",
      comments: [{ id: "c1", author: actor, body: "Look here", createdAt: ts }],
      createdAt: ts,
      createdBy: actor,
    };
    expect(threadTargetItem(state.canvas, anchored)?.id).toBe("linked");

    // Main chat thread has anchorItemId: null, but comments carry selected `items`.
    const mainChat: CommentThread = {
      id: "thr_main",
      x: 400,
      y: 500,
      anchorItemId: null,
      main: true,
      comments: [
        { id: "c_old", author: actor, body: "Hi", createdAt: ts },
        { id: "c_ask", author: actor, body: "Work on this yellow box", items: ["nearby"], createdAt: ts },
      ],
      createdAt: ts,
      createdBy: actor,
    };
    expect(threadTargetItem(state.canvas, mainChat)?.id).toBe("nearby");

    // Explicit extra item ids from the summoning op win when the thread has no anchor.
    expect(threadTargetItem(state.canvas, mainChat, ["linked"])?.id).toBe("linked");

    // Freestanding thread with no item references returns undefined.
    const free: CommentThread = {
      id: "thr_free",
      x: 100,
      y: 100,
      anchorItemId: null,
      comments: [{ id: "c_free", author: actor, body: "General question", createdAt: ts }],
      createdAt: ts,
      createdBy: actor,
    };
    expect(threadTargetItem(state.canvas, free)).toBeUndefined();
  });
});
