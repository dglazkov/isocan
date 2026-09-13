import { describe, expect, it } from "vitest";
import { CanvasGroups } from "../src/canvas-groups.ts";
import { groupFixture } from "./group-fixture.ts";

describe("the shared canvas-group API", () => {
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
