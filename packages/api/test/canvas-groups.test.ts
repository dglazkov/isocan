import { describe, expect, it } from "vitest";
import { CanvasGroups } from "../src/canvas-groups.ts";
import { groupFixture } from "./group-fixture.ts";
import { resolveCanvasGroupRequest } from "@isocan/core";
import { insertedItemBox } from "../src/operation-receipt.ts";
import { CanvasHandle } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";

describe("the shared canvas-group API", () => {
  it.each(["nw", "ne", "sw", "se"] as const)("scales both axes about fixed %s and undo restores exact native frames", async (anchor) => {
    const f = groupFixture(); f.card("a");
    const group = (await f.api.wrap(["a"], "Acme Frame")).itemId!;
    const count = f.writes.length;
    const old = f.state.canvas.items[group]!;
    expect(old).toMatchObject({ x: 76, y: 120, width: 448, height: 528 });
    const expectedX = anchor.endsWith("e") ? 188 : 76;
    const expectedY = anchor.startsWith("s") ? 252 : 120;
    const preview = await f.api.resize(group, { width: 336, height: 396 }, { anchor, dryRun: true });
    expect(preview.changes.find((row) => row.itemId === "a")?.boxAfter).toEqual({ x: expectedX + 24, y: expectedY + 80, width: 288, height: 268 });
    expect(f.writes).toHaveLength(count);
    await f.api.resize(group, { width: 336, height: 396 }, { anchor });
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items[group]).toMatchObject({ x: expectedX, y: expectedY, width: 336, height: 396 });
    expect(f.state.canvas.items.a).toMatchObject({ x: expectedX + 24, y: expectedY + 80, width: 288, height: 268 });
    f.undo();
    expect(f.state.canvas.items.a).toMatchObject({ x: 100, y: 200, width: 400, height: 400 });
    expect(f.state.canvas.items[group]).toMatchObject({ x: 76, y: 120, width: 448, height: 528 });
  });

  it("fits a frame without scaling and refuses stale geometry while allowing unrelated text edits", async () => {
    const f = groupFixture(); f.card("a"); f.card("elsewhere", "Acme unrelated", 2000);
    const group = (await f.api.wrap(["a"], "Acme Frame")).itemId!;
    await f.api.frame([group], { size: { width: 900, height: 1000 } });
    await f.api.frame([group], { fit: true });
    expect(f.state.canvas.items[group]).toMatchObject({ width: 448, height: 528 });
    expect(f.state.canvas.items.a).toMatchObject({ x: 100, y: 200, width: 400, height: 400 });
    f.setBeforeWrite(() => f.apply({ type: "item.update", itemId: "elsewhere", patch: { title: "Acme changed" } }));
    await f.api.move(group, { by: { x: 10, y: 20 } });
    expect(f.state.canvas.items.a).toMatchObject({ x: 110, y: 220 });
    const count = f.writes.length;
    f.setBeforeWrite(() => f.apply(resolveCanvasGroupRequest(f.state, { type: "item.move", itemId: "a", x: 120, y: 220 }, { actor: f.actor, ts: "2026-09-12T15:01:00.000Z", opId: "op_concurrent" })));
    await expect(f.api.resize(group, { width: 600, height: 700 })).rejects.toThrow(/conflict|changed|stale/i);
    expect(f.writes).toHaveLength(count);
    expect(f.state.canvas.items.a).toMatchObject({ x: 120, y: 220, width: 400, height: 400 });
  });

  it("inserts through the public API with explicit membership and a writer receipt, then updates metadata and size atomically", async () => {
    const f = groupFixture();
    const group = (await f.api.new("Acme destination", { at: { x: 0, y: 0 }, size: { width: 600, height: 500 } })).itemId!;
    const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
    const before = f.writes.length;
    const item = await handle.add({ title: "Acme inserted", content: "A card", mime: "text/markdown", in: group, size: { width: 400, height: 400 } });
    expect(f.writes).toHaveLength(before + 1);
    expect(item.containerId).toBe(group);
    expect(item).toMatchObject({ x: 24, y: 80, width: 400, height: 400 });
    expect(insertedItemBox(f.writes.at(-1)!.envelope.op, item.id)).toEqual({ x: 24, y: 80, width: 400, height: 400 });
    expect(f.state.canvas.items[group]!.height).toBeGreaterThanOrEqual(528);
    await handle.set(group, { properties: { theme: "blue" }, size: { width: 900, height: 900 } });
    expect(f.writes).toHaveLength(before + 2);
    expect(f.state.canvas.items[group]!.properties.theme).toBe("blue");
    expect(f.state.canvas.items[group]).toMatchObject({ width: 900, height: 900 });
    f.undo();
    expect(f.state.canvas.items[group]!.properties.theme).toBeUndefined();
    expect(f.state.canvas.items[item.id]).toMatchObject({ x: 24, y: 80, width: 400, height: 400 });
  });

  it("saves grid bands without moving members and refuses cell overflow without a write", async () => {
    const f = groupFixture(); f.card("a");
    const group = (await f.api.new("Acme grid", { at: { x: 0, y: 0 }, size: { width: 1200, height: 1000 } })).itemId!;
    await f.api.grid(group, { rows: 2, columns: 2 }, { rows: ["One", "Two"], columns: ["A", "B"] });
    await f.api.add(group, ["a"], { place: true, cell: { row: 2, column: 2 } });
    expect(f.state.canvas.items.a?.containerId).toBe(group);
    expect(f.state.canvas.items.a!.x).toBeGreaterThan(600);
    expect(f.state.canvas.items.a!.y).toBeGreaterThan(500);
    f.card("huge");
    const count = f.writes.length;
    await expect(f.api.add(group, ["huge"], { place: true, cell: { row: 3, column: 1 } })).rejects.toThrow(/cell|row/i);
    expect(f.writes).toHaveLength(count);
    expect(f.state.canvas.items.huge?.containerId).toBeUndefined();
  });

  it("fits mixed native/group targets once and refuses a cached box after a concurrent structural edit", async () => {
    const f = groupFixture(); f.card("a"); f.card("b", "Acme second", 1400);
    const group = (await f.api.wrap(["a"], "Acme frame")).itemId!;
    await f.api.frame(group, { size: { width: 900, height: 900 } });
    const count = f.writes.length;
    await f.api.fit([{ itemId: group }, { itemId: "a", width: 900, height: 900 }, { itemId: "b", width: 200, height: 250 }]);
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items[group]).toMatchObject({ width: 448, height: 528 });
    expect(f.state.canvas.items.a).toMatchObject({ width: 400, height: 400 });
    expect(f.state.canvas.items.b).toMatchObject({ width: 200, height: 250 });
    f.setBeforeWrite(() => f.apply({ type: "item.move", itemId: "b", x: 2000, y: 200 }));
    await expect(f.api.fit([{ itemId: "b", width: 300, height: 350 }])).rejects.toThrow(/conflict|changed|stale/i);
    expect(f.writes).toHaveLength(count + 1);
    expect(f.state.canvas.items.b).toMatchObject({ x: 2000, width: 200, height: 250 });
  });
  it("previews actual boxes without writing or uploading, and keeps note bytes on creation", async () => {
    const f = groupFixture(); f.card("a"); f.card("overlap");
    const before = JSON.stringify(f.state);
    const note = "    Acme code\n\n";
    const preview = await f.api.wrap(["a"], "Acme Ideas", { note, dryRun: true });
    expect(f.writes).toHaveLength(0); expect(f.blobs.size).toBe(0); expect(JSON.stringify(f.state)).toBe(before);
    const made = await f.api.wrap(["a"], "Acme Ideas", { note });
    const previewBox = preview.changes.find((row) => row.itemId === preview.itemId)!.boxAfter;
    expect(made.changes.find((row) => row.itemId === made.itemId)!.boxAfter).toEqual(previewBox);
    expect(f.writes).toHaveLength(1); expect(f.blobs.size).toBe(1);
    expect([...f.blobs.values()][0]!.toString()).toBe(note);
    expect(f.state.canvas.items.a?.containerId).toBe(made.itemId);
    expect(f.state.canvas.items.overlap?.containerId).toBeUndefined();
    expect(f.state.canvas.items[made.itemId!]!.description).toBe(note);
    expect(f.state.canvas.items.a).toMatchObject({ x: 100, y: 200 });
    const shown = await f.api.show("Acme Ideas");
    expect(shown).toMatchObject({ directMemberIds: ["a"], directCount: 1, descendantCount: 1, layout: { briefHeight: 120 } });
  });

  it("reports exact members, refuses ambiguous references and handles one-act remove/ungroup", async () => {
    const f = groupFixture(); f.card("a", "Acme first"); f.card("b", "Acme second", 900);
    const inner = (await f.api.wrap(["a"], "Acme inner")).itemId!;
    const outer = (await f.api.wrap([inner], "Acme outer")).itemId!;
    expect((await f.api.show(outer, true)).members.map((item) => item.id)).toEqual([inner, "a"]);
    expect((await f.api.list()).map((item) => item.id)).toContain(inner);
    await expect(f.api.show("Acme")).rejects.toThrow(/ambiguous/);
    await expect(f.api.add(outer, ["Acme"])).rejects.toThrow(/ambiguous/);
    const count = f.writes.length;
    await f.api.remove(["a"]);
    expect(f.writes).toHaveLength(count + 1); expect(f.state.canvas.items.a?.containerId).toBe(outer);
    f.undo(); expect(f.state.canvas.items.a?.containerId).toBe(inner);
    await f.api.remove(["a"], { toRoot: true }); expect(f.state.canvas.items.a?.containerId).toBeUndefined();
    await f.api.add(inner, ["a"]);
    await f.api.ungroup([inner]);
    expect(f.state.canvas.items[inner]).toBeUndefined(); expect(f.state.canvas.items.a?.containerId).toBe(outer);
  });

  it("refuses disabled mode, reader writes, and invalid geometry before uploading", async () => {
    const legacy = groupFixture(false);
    await expect(legacy.api.new("Acme")).rejects.toThrow(/not enabled/);
    expect(legacy.blobs.size).toBe(0);
    const f = groupFixture();
    await expect(f.api.new("Acme", { size: { width: 10, height: 10 } })).rejects.toThrow(/canvas group:.*positive dimensions/);
    expect(f.blobs.size).toBe(0);
    const reader = new CanvasGroups({ ...f.client, snapshot: async () => ({ ...await f.client.snapshot(), capability: "view" as const }) }, f.state.project.id, f.actor);
    expect(await reader.list()).toEqual([]);
    await expect(reader.new("Acme")).rejects.toThrow(/edit access/);
  });

  it("returns the accepted canonical facts after a concurrent move, without a false post-success failure", async () => {
    const f = groupFixture(); f.card("a");
    const group = (await f.api.new("Acme target")).itemId!;
    f.setBeforeWrite(() => f.apply({ type: "item.move", itemId: "a", x: 1200, y: 1400 }));
    const result = await f.api.add(group, ["a"]);
    expect(result).toMatchObject({ seq: 2, affectedRoots: ["a"] });
    expect(result.changes.find((row) => row.itemId === "a")).toMatchObject({ parentBefore: null, parentAfter: group, boxBefore: { x: 1200, y: 1400 }, boxAfter: { x: 1200, y: 1400 } });
    expect(f.state.canvas.items.a).toMatchObject({ x: 1200, y: 1400, containerId: group });
  });

  it("reports normalized roots from accepted membership after a concurrent reparent", async () => {
    const f = groupFixture(); f.card("a"); f.card("b", "Acme b", 900);
    const inner = (await f.api.wrap(["a"], "Acme inner")).itemId!;
    const outer = (await f.api.new("Acme outer")).itemId!;
    f.setBeforeWrite(() => f.apply({ type: "group.change", action: { kind: "reparent", containerId: inner, itemIds: ["b"] } }));
    const result = await f.api.add(outer, [inner, "b"]);
    expect(result.affectedRoots).toEqual([inner]);
    expect(f.state.canvas.items.b?.containerId).toBe(inner);
  });
});
