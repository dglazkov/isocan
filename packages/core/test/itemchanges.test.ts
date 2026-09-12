import { describe, expect, it } from "vitest";
import { applyOperation, guardItem, invertOperation, itemsTouchedBy, opMatchesFilters,
  MAX_ITEM_CHANGES, type Operation, type ItemScope } from "../src/index.ts";
import { envelope, normalize, nv, seedState } from "./helpers.ts";

describe("atomic item changes", () => {
  const changes = (): Extract<Operation, { type: "items.change" }> => ({ type: "items.change", changes: [
    { type: "item.update", itemId: "itm_1", patch: { title: "Reviewed title" } },
    { type: "item.restore", itemId: "itm_trashed" },
    { type: "item.edit", itemId: "itm_trashed", version: nv("ver_restored"), patch: { properties: { review: "yes" } }, expectedVersionId: "ver_t" },
    { type: "item.delete", itemId: "itm_2" },
  ] });

  it("publishes the entire result, inverts in reverse order and redoes original versions", () => {
    const state = seedState(), op = changes(), env = envelope(op);
    const inverse = invertOperation(state, op, env)!;
    const next = applyOperation(state, env)!;
    expect(next.project.lastOp).toBe("items.change");
    expect(next.canvas.items.itm_1!.title).toBe("Reviewed title");
    expect(next.canvas.items.itm_trashed!.versions).toHaveLength(2);
    expect(next.canvas.items.itm_2).toBeUndefined();
    expect(next.canvas.threads).toBe(state.canvas.threads);
    const redo = invertOperation(next, inverse)!;
    const undone = applyOperation(next, envelope(inverse))!;
    expect(normalize(undone)).toEqual(normalize(state));
    expect(normalize(applyOperation(undone, envelope(redo)))).toEqual(normalize(next));
  });

  it("leaves the original state intact when the last child fails, including inverse computation", () => {
    const state = seedState(), before = structuredClone(state), op = changes();
    op.changes.push({ type: "item.delete", itemId: "itm_missing" });
    expect(() => applyOperation(state, envelope(op))).toThrow("unknown item");
    expect(() => invertOperation(state, op)).toThrow("unknown item");
    expect(state).toEqual(before);
  });

  it("refuses stale content, metadata, trash identity and graph membership while allowing moves and comments", () => {
    const state = seedState(), op = changes();
    op.guards = [guardItem(state.canvas.items.itm_1!), guardItem(state.canvas.trash[0]!.item, "trash"), { itemId: "itm_new", location: "absent" }];
    op.scope = { property: "kind", value: "note", mimeTypes: ["text/markdown"], itemIds: ["itm_1"] };
    const moved = applyOperation(state, envelope({ type: "item.move", itemId: "itm_1", x: 999, y: 555 }))!;
    const commented = applyOperation(moved, envelope({ type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_more", body: "Still reviewing" } }))!;
    expect(applyOperation(commented, envelope(op))!.canvas.items.itm_1!.x).toBe(999);
    for (const change of [
      { type: "item.update", itemId: "itm_1", patch: { title: "Another title" } },
      { type: "item.addVersion", itemId: "itm_1", version: nv("ver_other") },
      { type: "item.restore", itemId: "itm_trashed" },
      { type: "item.update", itemId: "itm_2", patch: { properties: { kind: "note" } } },
      { type: "item.add", itemId: "itm_new", version: nv("ver_new"), width: 1, height: 1, placement: { x: 0, y: 0 } },
    ] as Operation[]) {
      const competing = applyOperation(state, envelope(change))!;
      expect(() => applyOperation(competing, envelope(op))).toThrow(/changed since review/);
    }
  });

  it("rejects untyped nesting, non-item operations, empty and oversized changes", () => {
    for (const children of [[], [{ type: "items.change", changes: [] }], [{ type: "trash.empty" }], Array(MAX_ITEM_CHANGES + 1).fill(changes().changes[0])]) {
      expect(() => applyOperation(seedState(), envelope({ type: "items.change", changes: children } as Operation))).toThrow(/flat item changes/);
    }
  });

  it("matches child type and item together for filtered wait, and deduplicates touched items", () => {
    const op = changes();
    expect(itemsTouchedBy(op)).toEqual(["itm_1", "itm_trashed", "itm_2"]);
    expect(opMatchesFilters(op, { types: ["item.edit"], items: ["itm_trashed"] })).toBe(true);
    expect(opMatchesFilters(op, { types: ["item.edit"], items: ["itm_1"] })).toBe(false);
    expect(opMatchesFilters(op, { types: ["items.change"], items: ["itm_1"] })).toBe(true);
  });
});
