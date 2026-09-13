import { describe, expect, it } from "vitest";
import { groupFixture } from "../../api/test/group-fixture.ts";
import { groupPlacementFor, insertionOperation, insertionReceiptPlacement, parseGroupCell } from "../src/group-placement.ts";
import { insertedItemBox } from "@isocan/api";
import type { Operation } from "@isocan/core";

describe("the CLI atomic insertion adapter", () => {
  it("preserves explicit --in when --at also names world coordinates and lifts hints off placement once", async () => {
    const f = groupFixture();
    const group = (await f.api.new("Acme group", { at: { x: 0, y: 0 }, size: { width: 1000, height: 900 } })).itemId!;
    const placement = groupPlacementFor(await f.client.snapshot(), { in: group, at: "200,300" })!;
    const op = insertionOperation({ type: "item.add", itemId: "new", title: "Acme", placement, width: 200, height: 200, version: { id: "vnew", blobHash: "hash", mimeType: "text/markdown", filename: "card.md", size: 4 } });
    expect(op).toMatchObject({ containerId: group, groupPlacement: "exact", placement: { x: 200, y: 300, chosen: true } });
    expect((op as Extract<Operation, { type: "item.add" }>).placement).not.toHaveProperty("containerId");
    const count = f.writes.length;
    const receipt = await f.client.sendOp(f.state.project.id, f.actor, op);
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items.new).toMatchObject({ x: 200, y: 300, containerId: group });
    expect(insertedItemBox(receipt.envelope.op, "new")).toEqual({ x: 200, y: 300, width: 200, height: 200 });
    expect(insertionReceiptPlacement(receipt.envelope.op, "new")).toEqual({ x: 200, y: 300, width: 200, height: 200 });
    f.undo(); expect(f.state.canvas.items.new).toBeUndefined();
  });

  it("validates cells and keeps legacy placement separate", async () => {
    expect(parseGroupCell("2,3")).toEqual({ row: 2, column: 3 });
    for (const bad of ["0,1", "2,-1", "1.5,2", "1,2,3", "x,1", ",1"]) expect(() => parseGroupCell(bad)).toThrow(/cell/);
    const f = groupFixture(false);
    expect(groupPlacementFor(await f.client.snapshot(), { in: "Acme sheet" })).toBeUndefined();
  });

  it.each([true, false] as const)("keeps legacy placement JSON without introducing dimensions (chosen=%s)", async (chosen) => {
    const f = groupFixture(false);
    const placement = { x: 0, y: 0, ...(chosen ? { chosen: true } : {}) };
    const receipt = await f.client.sendOp(f.state.project.id, f.actor, {
      type: "item.add", itemId: "legacy", placement, width: 119, height: 34,
      version: { id: "vlegacy", blobHash: "hash", mimeType: "text/markdown", filename: "text.md", size: 4 },
    });
    expect(f.state.canvas.items.legacy).toMatchObject({ x: 0, y: 0, width: 119, height: 34 });
    expect(insertionReceiptPlacement(receipt.envelope.op, "legacy")).toEqual(placement);
  });
});
