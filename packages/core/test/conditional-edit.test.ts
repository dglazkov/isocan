import { describe, expect, it } from "vitest";
import { applyOperation, invertOperation, type Operation } from "../src/index.ts";
import { envelope, nv, seedState } from "./helpers.ts";

describe("conditional content and metadata edits", () => {
  it("applies and reverses one edit without changing geometry", () => {
    const before = seedState();
    const item = before.canvas.items.itm_1!;
    const op: Operation = { type: "item.edit", itemId: item.id,
      version: nv("ver_guarded"), patch: { title: "Revised", properties: { reviewed: "yes" } },
      expectedVersionId: item.currentVersionId,
      expectedMetadata: { title: item.title, properties: item.properties },
    };
    const inverse = invertOperation(before, op)!;
    const edited = applyOperation(before, envelope(op))!;
    expect(edited.canvas.items.itm_1).toMatchObject({ title: "Revised", x: item.x, y: item.y, currentVersionId: "ver_guarded" });
    const redo = invertOperation(edited, inverse)!;
    const undone = applyOperation(edited, envelope(inverse))!;
    expect(undone.canvas.items.itm_1).toMatchObject({ title: item.title, properties: item.properties, currentVersionId: item.currentVersionId, versions: item.versions });
    const redone = applyOperation(undone, envelope(redo))!;
    expect(redone.canvas.items.itm_1).toMatchObject({ title: "Revised", properties: { reviewed: "yes" }, currentVersionId: "ver_guarded" });
  });
  it("rejects changes after the read, including metadata-only edits, atomically", () => {
    const before = seedState();
    const item = before.canvas.items.itm_1!;
    const op: Operation = { type: "item.edit", itemId: item.id, version: nv("ver_draft"), patch: { title: "Draft" }, expectedVersionId: item.currentVersionId, expectedMetadata: { title: item.title, properties: item.properties } };
    for (const change of [
      { type: "item.addVersion", itemId: item.id, version: nv("ver_other") },
      { type: "item.update", itemId: item.id, patch: { title: "Other writer" } },
      { type: "item.update", itemId: item.id, patch: { properties: { relationship: "new" } } },
    ] satisfies Operation[]) {
      const changed = applyOperation(before, envelope(change))!;
      expect(() => applyOperation(changed, envelope(op))).toThrow("changed while editing");
      expect(changed.canvas.items.itm_1!.versions.some(v => v.id === "ver_draft")).toBe(false);
    }
    const moved = applyOperation(before, envelope({ type: "item.move", itemId: item.id, x: 999, y: 888 }))!;
    expect(applyOperation(moved, envelope(op))!.canvas.items.itm_1).toMatchObject({ title: "Draft", x: 999, y: 888 });
  });
});
