import { describe, expect, it } from "vitest";
import type { Operation, ProjectState } from "../src/index.ts";
import { applyOperation, invertOperation } from "../src/index.ts";
import { alice, bob, envelope, nv, normalize, seedState } from "./helpers.ts";

/**
 * The core guarantee: for every undoable op, apply(apply(s, op), invert(s, op))
 * restores s — up to audit stamps, which undo intentionally does not restore.
 *
 * One documented exception: the inverse of item.add is item.delete, which
 * parks the item in the trash rather than erasing it (trash is the single
 * holding pen so redo == restore). Those cases compare items/threads and
 * assert the expected trash delta explicitly.
 */
function roundTrip(state: ProjectState, op: Operation): ProjectState {
  const inverse = invertOperation(state, op);
  expect(inverse).not.toBeNull();
  const after = applyOperation(state, envelope(op, bob));
  expect(after).not.toBeNull();
  const back = applyOperation(after, envelope(inverse!, bob));
  expect(back).not.toBeNull();
  return back!;
}

function expectIdentity(state: ProjectState, op: Operation) {
  const back = roundTrip(state, op);
  expect(normalize(back)).toEqual(normalize(state));
}

describe("apply ∘ invert round-trips", () => {
  const s = seedState();

  it("project.create → project.delete", () => {
    const op: Operation = {
      type: "project.create",
      projectId: "prj_new",
      title: "New",
    };
    const inverse = invertOperation(null, op);
    const after = applyOperation(null, {
      ...envelope(op),
      projectId: null,
    });
    expect(after?.project.title).toBe("New");
    expect(applyOperation(after, envelope(inverse!))).toBeNull();
  });

  it("project.update (title, description, props set/add/remove)", () => {
    expectIdentity(s, {
      type: "project.update",
      patch: {
        title: "Renamed",
        description: "changed",
        properties: { env: "prod", added: "yes" },
        removeProperties: ["env"],
      },
    });
  });

  it("item.add → item.delete leaves items/threads intact, item parked in trash", () => {
    const op: Operation = {
      type: "item.add",
      itemId: "itm_new",
      version: nv("ver_new"),
      width: 120,
      height: 80,
      placement: { x: 10, y: 20 },
    };
    const back = roundTrip(s, op);
    expect(normalize(back.canvas.items)).toEqual(normalize(s.canvas.items));
    expect(normalize(back.canvas.threads)).toEqual(normalize(s.canvas.threads));
    expect(back.canvas.trash.map((t) => t.item.id)).toEqual([
      ...s.canvas.trash.map((t) => t.item.id),
      "itm_new",
    ]);
  });

  it("item.add with anchor placement resolves left of anchor", () => {
    const op: Operation = {
      type: "item.add",
      itemId: "itm_new",
      version: nv("ver_new"),
      width: 120,
      height: 80,
      placement: { anchorItemId: "itm_1" },
    };
    const after = applyOperation(s, envelope(op))!;
    const added = after.canvas.items["itm_new"]!;
    // anchor itm_1 is at (100, 100): x = 100 - 40 - 120
    expect(added.x).toBe(-60);
    expect(added.y).toBe(100);
  });

  it("item.move", () => {
    expectIdentity(s, { type: "item.move", itemId: "itm_1", x: -500, y: 42 });
  });

  it("item.resize", () => {
    expectIdentity(s, { type: "item.resize", itemId: "itm_2", width: 640, height: 480 });
  });

  it("item.update (all patch fields)", () => {
    expectIdentity(s, {
      type: "item.update",
      itemId: "itm_1",
      patch: {
        title: "New title",
        description: "New desc",
        properties: { kind: "sketch", extra: "x" },
        removeProperties: ["kind"],
      },
    });
  });

  it("item.addVersion → item.removeVersion (restores currentVersionId)", () => {
    expectIdentity(s, { type: "item.addVersion", itemId: "itm_1", version: nv("ver_1c") });
  });

  it("item.setCurrentVersion", () => {
    expectIdentity(s, { type: "item.setCurrentVersion", itemId: "itm_1", versionId: "ver_1" });
  });

  it("item.delete → item.restore", () => {
    expectIdentity(s, { type: "item.delete", itemId: "itm_1" });
  });

  it("item.restore → item.delete", () => {
    expectIdentity(s, { type: "item.restore", itemId: "itm_trashed" });
  });

  it("thread.create → thread.delete (anchored and freestanding)", () => {
    expectIdentity(s, {
      type: "thread.create",
      threadId: "thr_new",
      x: 1,
      y: 2,
      anchorItemId: "itm_2",
      comment: { id: "cmt_new", body: "hello" },
    });
    expectIdentity(s, {
      type: "thread.create",
      threadId: "thr_new",
      x: 1,
      y: 2,
      anchorItemId: null,
      comment: { id: "cmt_new", body: "hello" },
    });
  });

  it("thread.reply → comment.remove", () => {
    expectIdentity(s, {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_new", body: "another" },
    });
  });

  it("thread.delete → thread.restore (full snapshot, comments intact)", () => {
    expectIdentity(s, { type: "thread.delete", threadId: "thr_1" });
  });

  it("non-undoable ops invert to null", () => {
    expect(invertOperation(s, { type: "trash.empty" })).toBeNull();
    expect(invertOperation(s, { type: "project.delete" })).toBeNull();
  });
});

describe("undo → redo preserves authorship", () => {
  it("redo of addVersion restores the original version author", () => {
    const s = seedState();
    const op: Operation = { type: "item.addVersion", itemId: "itm_1", version: nv("ver_x") };
    const undoOp = invertOperation(s, op)!;
    const afterOp = applyOperation(s, envelope(op, alice))!;
    const redoOp = invertOperation(afterOp, undoOp)!; // computed before undo applies
    const afterUndo = applyOperation(afterOp, envelope(undoOp, bob))!;
    const afterRedo = applyOperation(afterUndo, envelope(redoOp, bob))!;

    expect(normalize(afterRedo)).toEqual(normalize(afterOp));
    const version = afterRedo.canvas.items["itm_1"]!.versions.find((v) => v.id === "ver_x")!;
    expect(version.createdBy).toEqual(alice); // not restamped to bob
  });

  it("redo of reply restores the original comment author", () => {
    const s = seedState();
    const op: Operation = {
      type: "thread.reply",
      threadId: "thr_2",
      comment: { id: "cmt_x", body: "mine" },
    };
    const undoOp = invertOperation(s, op)!;
    const afterOp = applyOperation(s, envelope(op, alice))!;
    const redoOp = invertOperation(afterOp, undoOp)!;
    const afterUndo = applyOperation(afterOp, envelope(undoOp, bob))!;
    const afterRedo = applyOperation(afterUndo, envelope(redoOp, bob))!;

    expect(normalize(afterRedo)).toEqual(normalize(afterOp));
    const comment = afterRedo.canvas.threads["thr_2"]!.comments.find((c) => c.id === "cmt_x")!;
    expect(comment.author).toEqual(alice);
  });
});
