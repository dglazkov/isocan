import { describe, expect, it, vi, afterEach } from "vitest";
import { registerModule, unregisterModule, isGroupItem } from "@isocan/core";
import { CanvasHandle } from "../src/connect.ts";
import { CanvasGroups } from "../src/canvas-groups.ts";
import type { Ctx } from "../src/ctx.ts";
import { groupFixture } from "./group-fixture.ts";

const moduleName = "acme-copy-relationships";
afterEach(() => { vi.restoreAllMocks(); unregisterModule(moduleName); });
async function graph() {
  const f = groupFixture();
  const handle = new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project);
  const a = await handle.add({ title: "Acme source", content: "Source text", mime: "text/markdown", at: { x: 100, y: 200 } });
  const b = await handle.add({ title: "Acme second", content: "Second text", mime: "text/markdown", at: { x: 130, y: 210 } });
  f.apply({ type: "item.move", itemId: b.id, x: 130, y: 210 });
  const group = (await f.api.wrap([a.id, b.id], "Acme group", { note: "Copied brief" })).itemId!;
  const visual = await f.client.uploadBlob(f.state.project.id, Buffer.from("Acme PNG bytes"), "image/png", "preview.png");
  const current = f.state.canvas.items[a.id]!.versions[0]!;
  f.apply({ type: "item.addVersion", itemId: a.id, version: { ...current, id: "ver_dual", visual: { ...visual, filename: "preview.png" } } });
  return { f, handle, a, b, group, visual };
}

describe("one-act graph copy through the API", () => {
  it("normalizes group+child, preserves internal overlap and visual metadata, and undoes once", async () => {
    const { f, handle, a, b, group, visual } = await graph();
    const before = f.writes.length;
    const copies = await handle.copy([group, a.id], { at: { x: 2000, y: 1000 } });
    expect(f.writes).toHaveLength(before + 1);
    expect(copies.affectedRoots).toHaveLength(1);
    const made = copies.changes.filter((row) => row.boxBefore === null).map((row) => f.state.canvas.items[row.itemId]!);
    expect(made).toHaveLength(3);
    const copiedGroup = made.find(isGroupItem)!;
    const ca = made.find((item) => item.title === a.title)!;
    const cb = made.find((item) => item.title === b.title)!;
    expect(ca.containerId).toBe(copiedGroup.id); expect(cb.containerId).toBe(copiedGroup.id);
    expect({ dx: cb.x - ca.x, dy: cb.y - ca.y }).toEqual({ dx: 30, dy: 10 });
    expect(ca.versions).toHaveLength(1);
    expect(ca.versions[0]!.visual).toMatchObject({ blobHash: visual.blobHash, mimeType: "image/png", filename: "preview.png" });
    expect(copiedGroup.description).toBe("Copied brief");
    expect(copies.changes.find((row) => row.itemId === ca.id)?.boxAfter).toEqual({ x: ca.x, y: ca.y, width: ca.width, height: ca.height });
    f.undo();
    expect(made.every((item) => !f.state.canvas.items[item.id])).toBe(true);
    expect(f.state.canvas.items[group]).toBeDefined();
  });

  it("does no byte work on dry-run and does not copy an ancestor when only its child is selected", async () => {
    const { f, handle, a } = await graph();
    const download = vi.spyOn(f.client, "downloadBlob"); const upload = vi.spyOn(f.client, "uploadBlob");
    const before = f.writes.length;
    const result = await handle.copy([a.id], { dryRun: true });
    expect(result.changes.filter((row) => row.boxBefore === null)).toHaveLength(1);
    expect(result.changes[0]!.parentAfter).toBeNull();
    expect(download).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(before);
  });

  it("refuses a cross-canvas copy when the last visual upload fails, without a partial item write", async () => {
    const { f, group, visual } = await graph(); const target = groupFixture(true, "prj_target");
    const upload = vi.fn(async (...args: Parameters<typeof target.client.uploadBlob>) => {
      if (args[2] === "image/png") throw new Error("Acme visual upload refused");
      return target.client.uploadBlob(...args);
    });
    const client = { ...target.client, snapshot: async (id: string) => (id === f.state.project.id ? f : target).client.snapshot(), downloadBlob: f.client.downloadBlob, uploadBlob: upload };
    const destination = new CanvasGroups(client, target.state.project.id, f.actor);
    await expect(destination.copyFrom(f.state.project.id, [group])).rejects.toThrow("Acme visual upload refused");
    expect(upload).toHaveBeenCalled(); expect(target.writes).toHaveLength(0); expect(Object.keys(target.state.canvas.items)).toEqual([]);
    expect(target.blobs.has(visual.blobHash)).toBe(false);
  });

  it("remaps loaded module identities and internal references, dropping cross-canvas external refs", async () => {
    registerModule({ name: moduleName, itemReferenceProperties: ["acme.ref", "acme.external"], groupIdentityProperties: ["acme.family"] });
    const { f, a, b, group } = await graph();
    await new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project).set(a.id, { properties: { "acme.family": "acme-family", "acme.ref": b.id, "acme.external": "itm_external" } });
    await new CanvasHandle({ client: f.client, actor: f.actor } as unknown as Ctx, f.state.project).set(b.id, { properties: { "acme.family": "acme-family" } });
    const target = groupFixture(true, "prj_target");
    const client = { ...target.client, snapshot: async (id: string) => (id === f.state.project.id ? f : target).client.snapshot(), downloadBlob: f.client.downloadBlob };
    const result = await new CanvasGroups(client, target.state.project.id, f.actor).copyFrom(f.state.project.id, [group]);
    const made = result.changes.filter((row) => row.boxBefore === null).map((row) => target.state.canvas.items[row.itemId]!);
    const ca = made.find((item) => item.title === a.title)!; const cb = made.find((item) => item.title === b.title)!;
    expect(ca.properties["acme.ref"]).toBe(cb.id);
    expect(ca.properties["acme.family"]).toBe(cb.properties["acme.family"]); expect(ca.properties["acme.family"]).not.toBe("acme-family");
    expect(ca.properties["acme.external"]).toBeUndefined(); expect(ca.properties.parent).toBeUndefined();
  });
});
