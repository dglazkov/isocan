import { describe, expect, it } from "vitest";
import { OpValidationError, applyOperation } from "../src/index.ts";
import type { Operation } from "../src/index.ts";
import { apply, envelope, nv, seedState } from "./helpers.ts";

function expectRejects(op: Operation, code: string) {
  const s = seedState();
  try {
    applyOperation(s, envelope(op));
    expect.unreachable(`expected ${op.type} to throw ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(OpValidationError);
    expect((err as OpValidationError).code).toBe(code);
  }
}

describe("validation", () => {
  it("rejects ops against unknown items", () => {
    expectRejects({ type: "item.move", itemId: "itm_nope", x: 0, y: 0 }, "unknown-item");
    expectRejects({ type: "item.delete", itemId: "itm_nope" }, "unknown-item");
  });

  it("rejects ops against trashed items (they are not on the canvas)", () => {
    expectRejects({ type: "item.move", itemId: "itm_trashed", x: 0, y: 0 }, "unknown-item");
  });

  it("rejects duplicate ids", () => {
    expectRejects(
      {
        type: "item.add",
        itemId: "itm_1",
        version: nv("ver_dup"),
        width: 10,
        height: 10,
        placement: { x: 0, y: 0 },
      },
      "duplicate-id",
    );
    // ids in the trash are still taken
    expectRejects(
      {
        type: "item.add",
        itemId: "itm_trashed",
        version: nv("ver_dup"),
        width: 10,
        height: 10,
        placement: { x: 0, y: 0 },
      },
      "duplicate-id",
    );
  });

  it("rejects unknown placement anchor", () => {
    expectRejects(
      {
        type: "item.add",
        itemId: "itm_new",
        version: nv("ver_new"),
        width: 10,
        height: 10,
        placement: { anchorItemId: "itm_nope" },
      },
      "unknown-anchor",
    );
  });

  it("rejects restore of an item not in trash", () => {
    expectRejects({ type: "item.restore", itemId: "itm_1" }, "not-in-trash");
  });

  it("rejects unknown version in setCurrentVersion", () => {
    expectRejects(
      { type: "item.setCurrentVersion", itemId: "itm_1", versionId: "ver_nope" },
      "unknown-version",
    );
  });

  it("rejects empty comment bodies", () => {
    expectRejects(
      {
        type: "thread.create",
        threadId: "thr_new",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_new", body: "   " },
      },
      "empty-body",
    );
    expectRejects(
      { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_new", body: "" } },
      "empty-body",
    );
  });

  it("rejects anchoring a thread to a missing item", () => {
    expectRejects(
      {
        type: "thread.create",
        threadId: "thr_new",
        x: 0,
        y: 0,
        anchorItemId: "itm_nope",
        comment: { id: "cmt_new", body: "hi" },
      },
      "unknown-item",
    );
  });

  it("rejects removing the last comment of a thread", () => {
    expectRejects(
      { type: "comment.remove", threadId: "thr_2", commentId: "cmt_3" },
      "last-comment",
    );
  });

  it("rejects removing an item's only version", () => {
    expectRejects(
      {
        type: "item.removeVersion",
        itemId: "itm_2",
        versionId: "ver_2",
        prevCurrentVersionId: "ver_2",
      },
      "bad-op",
    );
  });

  it("rejects ops on a missing project", () => {
    expect(() =>
      applyOperation(null, envelope({ type: "item.move", itemId: "itm_1", x: 0, y: 0 })),
    ).toThrow(OpValidationError);
  });
});

describe("semantics", () => {
  it("item.add defaults title to the filename", () => {
    const s = apply(seedState(), {
      type: "item.add",
      itemId: "itm_new",
      version: nv("ver_new"),
      width: 10,
      height: 10,
      placement: { x: 0, y: 0 },
    })!;
    expect(s.canvas.items["itm_new"]!.title).toBe("ver_new.md");
  });

  it("addVersion makes the new version current; versions stay in creation order", () => {
    const s = seedState();
    const item = s.canvas.items["itm_1"]!;
    expect(item.versions.map((v) => v.id)).toEqual(["ver_1", "ver_1b"]);
    expect(item.currentVersionId).toBe("ver_1b");
  });

  it("mutations stamp updatedBy with the acting identity", () => {
    const s = seedState();
    // itm_1's last mutation in the seed is bob's addVersion
    expect(s.canvas.items["itm_1"]!.updatedBy.name).toBe("Bob");
    expect(s.canvas.items["itm_1"]!.createdBy.name).toBe("Alice");
  });

  it("delete moves the item and all its versions to trash; trash.empty clears it", () => {
    let s = seedState();
    expect(s.canvas.trash).toHaveLength(1);
    expect(s.canvas.trash[0]!.item.versions).toHaveLength(1);
    s = apply(s, { type: "item.delete", itemId: "itm_1" })!;
    expect(s.canvas.trash).toHaveLength(2);
    expect(s.canvas.trash[1]!.item.versions.map((v) => v.id)).toEqual(["ver_1", "ver_1b"]);
    s = apply(s, { type: "trash.empty" })!;
    expect(s.canvas.trash).toHaveLength(0);
  });

  it("threads anchored to a deleted item keep their dangling anchor (rendered freestanding)", () => {
    const s = apply(seedState(), { type: "item.delete", itemId: "itm_1" })!;
    expect(s.canvas.threads["thr_1"]!.anchorItemId).toBe("itm_1");
  });

  it("applyOperation is pure — inputs are never mutated", () => {
    const s = seedState();
    const snapshot = JSON.parse(JSON.stringify(s));
    apply(s, { type: "item.move", itemId: "itm_1", x: 9, y: 9 });
    apply(s, { type: "item.delete", itemId: "itm_2" });
    apply(s, { type: "project.update", patch: { title: "x" } });
    expect(s).toEqual(snapshot);
  });
});
