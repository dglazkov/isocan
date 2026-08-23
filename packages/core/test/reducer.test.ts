import { describe, expect, it } from "vitest";
import { OpValidationError, applyOperation } from "../src/index.ts";
import type { Operation } from "../src/index.ts";
import { apply, bob, envelope, nv, seedState } from "./helpers.ts";

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

  it("rejects setAnchor on a missing thread or missing item", () => {
    expectRejects(
      { type: "thread.setAnchor", threadId: "thr_nope", anchorItemId: "itm_1", x: 0, y: 0 },
      "unknown-thread",
    );
    expectRejects(
      { type: "thread.setAnchor", threadId: "thr_2", anchorItemId: "itm_nope", x: 0, y: 0 },
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

  it("batch ops reject empty lists, duplicates, and unknown items atomically", () => {
    expectRejects({ type: "items.move", moves: [] }, "bad-op");
    expectRejects(
      {
        type: "items.move",
        moves: [
          { itemId: "itm_1", x: 0, y: 0 },
          { itemId: "itm_1", x: 1, y: 1 },
        ],
      },
      "duplicate-id",
    );
    // One bad id in the batch → nothing applies.
    expectRejects(
      {
        type: "items.move",
        moves: [
          { itemId: "itm_1", x: 0, y: 0 },
          { itemId: "itm_nope", x: 1, y: 1 },
        ],
      },
      "unknown-item",
    );
    expectRejects({ type: "items.delete", itemIds: ["itm_1", "itm_nope"] }, "unknown-item");
    expectRejects({ type: "items.restore", itemIds: ["itm_trashed", "itm_1"] }, "not-in-trash");
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

  it("setAnchor re-pins a freestanding thread to an item and back", () => {
    let s = apply(seedState(), {
      type: "thread.setAnchor",
      threadId: "thr_2",
      anchorItemId: "itm_2",
      x: 312, // itm_2.width + 12
      y: 0,
    })!;
    expect(s.canvas.threads["thr_2"]).toMatchObject({ anchorItemId: "itm_2", x: 312, y: 0 });
    s = apply(s, {
      type: "thread.setAnchor",
      threadId: "thr_2",
      anchorItemId: null,
      x: -50,
      y: 300,
    })!;
    expect(s.canvas.threads["thr_2"]).toMatchObject({ anchorItemId: null, x: -50, y: 300 });
    // Comments ride along untouched.
    expect(s.canvas.threads["thr_2"]!.comments.map((c) => c.id)).toEqual(["cmt_3"]);
  });

  it("setAnchor can re-point a thread whose anchor item was deleted", () => {
    let s = apply(seedState(), { type: "item.delete", itemId: "itm_1" })!;
    s = apply(s, {
      type: "thread.setAnchor",
      threadId: "thr_1",
      anchorItemId: "itm_2",
      x: 0,
      y: 0,
    })!;
    expect(s.canvas.threads["thr_1"]!.anchorItemId).toBe("itm_2");
  });

  it("setMain keeps at most one main thread; null demotes", () => {
    let s = apply(seedState(), { type: "thread.setMain", threadId: "thr_1" })!;
    expect(s.canvas.threads["thr_1"]!.main).toBe(true);
    s = apply(s, { type: "thread.setMain", threadId: "thr_2" })!;
    expect("main" in s.canvas.threads["thr_1"]!).toBe(false);
    expect(s.canvas.threads["thr_2"]!.main).toBe(true);
    s = apply(s, { type: "thread.setMain", threadId: null })!;
    expect(Object.values(s.canvas.threads).some((t) => t.main)).toBe(false);
  });

  it("rejects a second thread born main while one exists", () => {
    const s = apply(seedState(), { type: "thread.setMain", threadId: "thr_1" })!;
    try {
      applyOperation(
        s,
        envelope({
          type: "thread.create",
          threadId: "thr_x",
          x: 0,
          y: 0,
          anchorItemId: null,
          main: true,
          comment: { id: "cmt_x", body: "hi" },
        }),
      );
      expect.unreachable("expected main-exists");
    } catch (err) {
      expect((err as OpValidationError).code).toBe("main-exists");
    }
  });

  it("restoring a deleted main thread yields if another main appeared since", () => {
    let s = apply(seedState(), { type: "thread.setMain", threadId: "thr_1" })!;
    const deleted = s.canvas.threads["thr_1"]!;
    s = apply(s, { type: "thread.delete", threadId: "thr_1" })!;
    s = apply(s, { type: "thread.setMain", threadId: "thr_2" })!;
    s = apply(s, { type: "thread.restore", thread: deleted })!;
    expect("main" in s.canvas.threads["thr_1"]!).toBe(false);
    expect(s.canvas.threads["thr_2"]!.main).toBe(true);
  });

  it("comments store resolved @-mentions; absent when none were passed", () => {
    let s = apply(seedState(), {
      type: "thread.reply",
      threadId: "thr_1",
      comment: { id: "cmt_m", body: "@Alice take a look", mentions: ["usr_alice"] },
    })!;
    const withMention = s.canvas.threads["thr_1"]!.comments.find((c) => c.id === "cmt_m")!;
    expect(withMention.mentions).toEqual(["usr_alice"]);
    // Seed comments were created without mentions — the field stays absent.
    expect("mentions" in s.canvas.threads["thr_1"]!.comments[0]!).toBe(false);
  });

  /**
   * The reducer's own contract: "Every mutation stamps updatedAt/updatedBy
   * from the envelope." It was believed rather than checked. Only ONE op's
   * stamp was under test (addVersion, incidentally, through the seed), and
   * the round-trip and random-walk properties are blind here on purpose —
   * `normalize()` strips the audit keys so undo comparisons can ignore them.
   *
   * So this asserts the rule over the whole vocabulary rather than over the
   * op that happened to break: delete the stamp from item.move and this goes
   * red, which it did not before.
   */
  it("every mutation stamps updatedAt/updatedBy from the envelope", () => {
    const mutations: Array<{ op: Operation; touches: string[] }> = [
      { op: { type: "item.move", itemId: "itm_1", x: 9, y: 9 }, touches: ["itm_1"] },
      { op: { type: "item.resize", itemId: "itm_1", width: 11, height: 12 }, touches: ["itm_1"] },
      { op: { type: "item.update", itemId: "itm_1", patch: { title: "renamed" } }, touches: ["itm_1"] },
      {
        op: { type: "item.update", itemId: "itm_1", patch: {}, filename: "new.md" },
        touches: ["itm_1"],
      },
      { op: { type: "item.addVersion", itemId: "itm_1", version: nv("ver_stamp") }, touches: ["itm_1"] },
      {
        op: { type: "item.setCurrentVersion", itemId: "itm_1", versionId: "ver_1" },
        touches: ["itm_1"],
      },
      {
        op: {
          type: "item.removeVersion",
          itemId: "itm_1",
          versionId: "ver_1b",
          prevCurrentVersionId: "ver_1",
        },
        touches: ["itm_1"],
      },
      {
        op: {
          type: "items.move",
          moves: [
            { itemId: "itm_1", x: 1, y: 1 },
            { itemId: "itm_2", x: 2, y: 2 },
          ],
        },
        touches: ["itm_1", "itm_2"],
      },
      {
        op: {
          type: "item.add",
          itemId: "itm_stamped",
          version: nv("ver_stamped"),
          width: 10,
          height: 10,
          placement: { x: 0, y: 0 },
        },
        touches: ["itm_stamped"],
      },
    ];

    for (const { op, touches } of mutations) {
      const env = envelope(op, bob);
      const after = applyOperation(seedState(), env)!;
      for (const itemId of touches) {
        const item = after.canvas.items[itemId]!;
        expect(item.updatedBy, `${op.type} did not stamp ${itemId} with the acting identity`).toEqual(bob);
        expect(item.updatedAt, `${op.type} did not stamp ${itemId} with the envelope ts`).toBe(env.ts);
      }
    }
  });

  it("project.update stamps the project, and deletes stamp the trash entry", () => {
    const meta = envelope({ type: "project.update", patch: { title: "T" } }, bob);
    const updated = applyOperation(seedState(), meta)!;
    expect(updated.project.updatedBy).toEqual(bob);
    expect(updated.project.updatedAt).toBe(meta.ts);

    const one = envelope({ type: "item.delete", itemId: "itm_1" }, bob);
    const afterOne = applyOperation(seedState(), one)!;
    const entry = afterOne.canvas.trash.find((t) => t.item.id === "itm_1")!;
    expect(entry.deletedBy).toEqual(bob);
    expect(entry.deletedAt).toBe(one.ts);

    const many = envelope({ type: "items.delete", itemIds: ["itm_1", "itm_2"] }, bob);
    const afterMany = applyOperation(seedState(), many)!;
    for (const itemId of ["itm_1", "itm_2"]) {
      const trashed = afterMany.canvas.trash.find((t) => t.item.id === itemId)!;
      expect(trashed.deletedBy, `items.delete did not stamp ${itemId}`).toEqual(bob);
      expect(trashed.deletedAt).toBe(many.ts);
    }
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
