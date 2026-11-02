import { describe, expect, it, vi } from "vitest";
import { canvasItemOf, designSystemProperties, invertOperation, CONTEXT_PROP, CONTEXT_SOURCE_PROP, contextSourceOf, designSystem, isGroupItem, type Actor, type Operation, type SourceClassificationResponse } from "@isocan/core";
import { CanvasHandle } from "../src/connect.ts";
import type { Ctx } from "../src/ctx.ts";
import { nodeCopyBytes } from "../src/canvas-groups.ts";
import { pinFromSource, readPinSource, type ContextPinPort } from "../src/context-pin.ts";
import { groupFixture } from "./group-fixture.ts";

/**
 * **Copy a source piece into a local pin** (memory phase 6,
 * `docs/projects/memory/pin-from-source.md`).
 *
 * The transport is in memory; the state, the resolution and the undo are the
 * actual shared production reducer, and the copy is the actual shared copy act.
 * What is proved here is the ORDER — classify before read, verify before
 * upload, recheck before submit — and that every refusal leaves the
 * destination exactly as it was. Every name is synthetic (AGENTS.md).
 */

const HOME = "https://acme.invalid";

async function world() {
  const src = groupFixture(true, "prj_design");
  const dst = groupFixture(true, "prj_local");
  const on = (fixture: ReturnType<typeof groupFixture>) =>
    new CanvasHandle({ client: fixture.client, actor: fixture.actor } as unknown as Ctx, fixture.state.project);
  const source = on(src);

  const design = await source.add({ title: "Acme DESIGN.md", content: "# Acme\n\nspacing: 8px\n", mime: "text/markdown", at: { x: 0, y: 0 } });
  await source.set(design.id, { properties: designSystemProperties() });
  const checklist = await source.add({ title: "Review checklist", content: "- read the brief\n", mime: "text/markdown", at: { x: 0, y: 300 } });
  await source.set(checklist.id, { properties: { [CONTEXT_PROP]: "pinned" } });

  const one = await source.add({ title: "Acme step one", content: "one\n", mime: "text/markdown", at: { x: 600, y: 0 } });
  const two = await source.add({ title: "Acme step two", content: "two\n", mime: "text/markdown", at: { x: 640, y: 20 } });
  const pack = (await src.api.wrap([one.id, two.id], "Acme review pack", { note: "Copied brief" })).itemId!;
  await source.set(pack, { properties: { [CONTEXT_PROP]: "pinned" } });
  // A distinct visual face, so a copy that only moved source bytes would fail.
  const visual = await src.client.uploadBlob("prj_design", Buffer.from("Acme PNG bytes"), "image/png", "preview.png");
  const current = src.state.canvas.items[one.id]!.versions[0]!;
  src.apply({ type: "item.addVersion", itemId: one.id, version: { ...current, id: "ver_dual", visual: { ...visual, filename: "preview.png" } } });

  const link = (itemId: string, canvasId: string, title: string, y: number, extra: Record<string, string> = {}) =>
    dst.apply({
      type: "item.add", itemId, title, width: 800, height: 600, placement: { x: 0, y, chosen: true },
      properties: { ...canvasItemOf(HOME, canvasId).properties, memory: "inherit", ...extra },
      version: { id: `ver_${itemId}`, blobHash: `hash_${itemId}`, mimeType: "text/uri-list", filename: "canvas.uri", size: 20 },
    } as Operation);
  link("itm_link", "prj_design", "Acme Design System", 0);

  const reads = { classify: 0, snapshot: 0, blobs: 0 };
  let classify: () => Promise<SourceClassificationResponse> = async () => ({ kind: "ordinary" }) as SourceClassificationResponse;
  let sourceSnapshot = async () => src.client.snapshot();
  let destinationSnapshot = async () => dst.client.snapshot();
  const port: ContextPinPort = {
    classifySource: async () => { reads.classify++; return classify(); },
    sourceSnapshot: async () => { reads.snapshot++; return sourceSnapshot(); },
    snapshot: async (canvasId) => (canvasId === "prj_design" ? src.client.snapshot() : destinationSnapshot()),
    copyBytes: (from, destinationCanvasId) => nodeCopyBytes({
      downloadBlob: async (_canvasId: string, hash: string) => { reads.blobs++; return src.client.downloadBlob("prj_design", hash); },
      uploadBlob: async (_canvasId: string, bytes: Buffer, mime: string, filename: string) => dst.client.uploadBlob("prj_local", bytes, mime, filename),
    } as never, from.canvasId, destinationCanvasId),
    submit: (canvasId, actor: Actor, action, opId) => dst.client.changeGroup(canvasId, actor, action, opId),
  };
  const copy = (piece: string, from = "prj_design", over: Partial<ContextPinPort> = {}, signal?: AbortSignal) =>
    pinFromSource({ ...port, ...over }, { canvasId: "prj_local", home: HOME, actor: dst.actor, from, piece, ...(signal ? { signal } : {}) });

  return {
    src, dst, source, port, reads, copy, link, design, checklist, pack, visual,
    set classification(next: () => Promise<SourceClassificationResponse>) { classify = next; },
    set sourceRead(next: () => Promise<Awaited<ReturnType<typeof src.client.snapshot>>>) { sourceSnapshot = next; },
    set destinationRead(next: () => Promise<Awaited<ReturnType<typeof dst.client.snapshot>>>) { destinationSnapshot = next; },
    localItems: () => Object.values(dst.state.canvas.items),
  };
}

describe("one deliberate copy, one accepted act", () => {
  it("copies a pinned piece's current version, pins it, records its source, and undoes and redoes as one", async () => {
    const w = await world();
    const before = w.dst.writes.length;
    const sourceWrites = w.src.writes.length;
    const result = await w.copy("Review checklist");
    expect(w.dst.writes).toHaveLength(before + 1);
    expect(w.dst.writes.at(-1)!.envelope.op.type).toBe("group.change");

    const copied = w.localItems().find((item) => item.title === "Review checklist")!;
    expect(copied.id).toBe(result.rootId);
    expect(copied.properties[CONTEXT_PROP]).toBe("pinned");
    expect(contextSourceOf(copied)).toEqual({
      home: HOME, canvasId: "prj_design", canvasTitle: "Acme Board",
      itemId: w.checklist.id, itemTitle: "Review checklist", versionId: w.checklist.currentVersionId,
    });
    // The bytes are the source's exact bytes, verified and re-uploaded here.
    const face = copied.versions[0]!;
    expect((await w.dst.client.downloadBlob("prj_local", face.blobHash)).toString("utf8")).toBe("- read the brief\n");
    // The source is untouched: no write of ours, same item, same versions.
    expect(w.src.writes).toHaveLength(sourceWrites);
    expect(w.src.state.canvas.items[w.checklist.id]!.versions).toHaveLength(1);

    // One undo removes the complete copy AND its pin; redo restores both —
    // which is the whole reason the pin rides the copy act rather than a
    // second write.
    const redo = invertOperation(w.dst.state, w.dst.writes.at(-1)!.inverse!)!;
    w.dst.undo();
    expect(w.dst.state.canvas.items[copied.id]).toBeUndefined();
    w.dst.apply(redo);
    expect(w.dst.state.canvas.items[copied.id]!.properties[CONTEXT_PROP]).toBe("pinned");
    expect(contextSourceOf(w.dst.state.canvas.items[copied.id]!)!.canvasId).toBe("prj_design");
  });

  it("copies a nested group with its children and its distinct visual face", async () => {
    const w = await world();
    const result = await w.copy("Acme review pack");
    expect(result.count).toBe(3);
    const made = result.itemIds.map((id) => w.dst.state.canvas.items[id]!);
    const frame = made.find(isGroupItem)!;
    expect(frame.description).toBe("Copied brief");
    expect(made.filter((item) => item.containerId === frame.id)).toHaveLength(2);
    // Only the chosen root is pinned; the children are ordinary local items.
    expect(made.filter((item) => item.properties[CONTEXT_PROP] === "pinned").map((item) => item.id)).toEqual([result.rootId]);
    const withVisual = made.find((item) => item.title === "Acme step one")!;
    expect(withVisual.versions[0]!.visual).toMatchObject({ blobHash: w.visual.blobHash, mimeType: "image/png", filename: "preview.png" });
    expect(w.dst.blobs.has(w.visual.blobHash)).toBe(true);
    // Every copied item carries its own provenance, not only the root.
    for (const item of made) expect(contextSourceOf(item)!.canvasId).toBe("prj_design");
  });

  it("keeps a copied design note a reference: the local governing design is unchanged", async () => {
    const w = await world();
    const local = await new CanvasHandle({ client: w.dst.client, actor: w.dst.actor } as unknown as Ctx, w.dst.state.project)
      .add({ title: "Local DESIGN.md", content: "# Local\n", mime: "text/markdown", at: { x: 0, y: 900 } });
    await new CanvasHandle({ client: w.dst.client, actor: w.dst.actor } as unknown as Ctx, w.dst.state.project)
      .set(local.id, { properties: designSystemProperties() });
    const result = await w.copy("Acme DESIGN.md");
    const copied = w.dst.state.canvas.items[result.rootId]!;
    expect(copied.properties.role).toBeUndefined();
    expect(copied.properties[CONTEXT_PROP]).toBe("pinned");
    expect(designSystem(w.dst.state.canvas)!.id).toBe(local.id);
  });

  it("leaves the copy alone when the source is edited, removed and unlinked afterwards", async () => {
    const w = await world();
    const result = await w.copy("Review checklist");
    const copied = w.dst.state.canvas.items[result.rootId]!;
    const face = copied.versions[0]!.blobHash;

    const edited = await w.src.client.uploadBlob("prj_design", Buffer.from("- rewritten by the source team\n"), "text/markdown", "checklist.md");
    w.src.apply({ type: "item.addVersion", itemId: w.checklist.id, version: { id: "ver_rewritten", blobHash: edited.blobHash, mimeType: "text/markdown", filename: "checklist.md", size: edited.size } });
    w.src.apply({ type: "item.delete", itemId: w.checklist.id });
    w.dst.apply({ type: "item.update", itemId: "itm_link", patch: { removeProperties: ["memory"] } } as Operation);

    const after = w.dst.state.canvas.items[result.rootId]!;
    expect(after.title).toBe("Review checklist");
    expect(after.versions[0]!.blobHash).toBe(face);
    expect(contextSourceOf(after)!.itemId).toBe(w.checklist.id);
    expect((await w.dst.client.downloadBlob("prj_local", face)).toString("utf8")).toBe("- read the brief\n");
  });
});

describe("what refuses, and what it leaves behind", () => {
  const untouched = async (w: Awaited<ReturnType<typeof world>>, act: Promise<unknown>, message: RegExp) => {
    const items = w.localItems().map((item) => item.id).sort();
    const writes = w.dst.writes.length;
    await expect(act).rejects.toThrow(message);
    expect(w.dst.writes).toHaveLength(writes);
    expect(w.localItems().map((item) => item.id).sort()).toEqual(items);
  };

  it("refuses a personal source before any snapshot or blob read", async () => {
    const w = await world();
    // A personal card relabelled `memory=inherit` is still personal:
    // classification decides, never the label.
    w.classification = async () => ({ kind: "personal" }) as SourceClassificationResponse;
    await untouched(w, w.copy("Review checklist"), /Personal canvas/);
    expect(w.reads.classify).toBe(1);
    expect(w.reads.snapshot).toBe(0);
    expect(w.reads.blobs).toBe(0);
  });

  it("refuses another home's address without even asking the classifier", async () => {
    const w = await world();
    w.link("itm_foreign", "prj_foreign", "Acme Elsewhere", 700, { source: "https://elsewhere.invalid/p/prj_foreign" });
    await untouched(w, w.copy("Review checklist", "prj_foreign"), /elsewhere\.invalid/);
    expect(w.reads.classify).toBe(0);
  });

  it("refuses an address this canvas does not visibly inherit, naming the links it has", async () => {
    const w = await world();
    await untouched(w, w.copy("Review checklist", "prj_absent"), /no visible inherited source/);
    // And an excluded card is not a visible edge at all.
    w.dst.apply({ type: "item.update", itemId: "itm_link", patch: { properties: { [CONTEXT_PROP]: "excluded" } } } as Operation);
    await untouched(w, w.copy("Review checklist"), /this canvas inherits:/);
    expect(w.reads.classify).toBe(0);
  });

  it("refuses an ambiguous source and an ambiguous piece with the candidates", async () => {
    const w = await world();
    w.link("itm_second", "prj_designs", "Acme Design Notes", 700);
    await untouched(w, w.copy("Review checklist", "Acme Design"), /ambiguous source/);
    await untouched(w, w.copy("Acme"), /ambiguous piece/);
    await untouched(w, w.copy("Acme sprint plan"), /no piece called/);
  });

  it("gives a legacy destination its conversion guidance before any source content is read", async () => {
    const legacy = groupFixture(false, "prj_legacy");
    const w = await world();
    w.destinationRead = async () => legacy.client.snapshot();
    await expect(w.copy("Review checklist")).rejects.toThrow(/canvas group migrate --dry-run/);
    expect(w.reads.classify).toBe(0);
    expect(w.reads.blobs).toBe(0);
  });

  it("refuses a read-only destination before it reads the source", async () => {
    const w = await world();
    w.destinationRead = async () => ({ ...(await w.dst.client.snapshot()), capability: "read" as const });
    await untouched(w, w.copy("Review checklist"), /requires edit access/);
    expect(w.reads.classify).toBe(0);
  });

  it("refuses when revoked source access stops the snapshot, with nothing transferred", async () => {
    const w = await world();
    w.sourceRead = async () => { throw new Error("source access was revoked"); };
    await untouched(w, w.copy("Review checklist"), /revoked/);
    expect(w.reads.blobs).toBe(0);
  });

  it("refuses the whole copy when one face's bytes do not match their hash", async () => {
    const w = await world();
    const download = vi.spyOn(w.src.client, "downloadBlob").mockImplementation(async (_id: string, hash: string) =>
      hash === w.visual.blobHash ? Buffer.from("Acme corrupted bytes") : w.src.blobs.get(hash) ?? Buffer.from("Acme content"));
    await untouched(w, w.copy("Acme review pack"), /could not verify saved bytes/);
    expect(download).toHaveBeenCalled();
    // Uploaded unreferenced blobs are left to existing GC; no item was written.
    expect(w.localItems().some((item) => item.title === "Acme review pack")).toBe(false);
  });

  it("refuses a piece whose closure holds an excluded child, and says which", async () => {
    const w = await world();
    const children = Object.values(w.src.state.canvas.items).filter((item) => item.containerId === w.pack);
    await w.source.set(children[0]!.id, { properties: { [CONTEXT_PROP]: "excluded" } });
    await untouched(w, w.copy("Acme review pack"), /kept out of context on the source/);
    const offer = await readPinSource(w.port, { canvas: w.dst.state.canvas, home: HOME, from: "prj_design" });
    expect(offer.pieces.find((piece) => piece.title === "Acme review pack")!.refused).toContain("kept out of context");
  });

  it("stops when the inheritance card disappears while the bytes are still moving", async () => {
    const w = await world();
    let reads = 0;
    // The recheck after byte transfer is the point: the first read planned the
    // copy, the second is asked whether the edge is still there.
    w.destinationRead = async () => {
      if (++reads === 2) w.dst.apply({ type: "item.delete", itemId: "itm_link" });
      return w.dst.client.snapshot();
    };
    await expect(w.copy("Review checklist")).rejects.toThrow(/no longer a visible inherited source/);
    expect(w.reads.blobs).toBeGreaterThan(0);
    expect(w.localItems().some((item) => item.title === "Review checklist")).toBe(false);
  });

  it("stops on a cancelled or changed browser identity mid-transfer", async () => {
    const w = await world();
    const controller = new AbortController();
    await untouched(w, w.copy("Review checklist", "prj_design", {
      copyBytes: () => ({
        downloadBlob: async () => { controller.abort(new Error("this browser changed identity")); return Buffer.from("Acme content"); },
        uploadBlob: async () => ({ blobHash: "unused" }),
        digest: async () => "unused",
      }),
    }, controller.signal), /changed identity/);
  });
});

describe("the picker reads the source itself", () => {
  it("names the source and offers only its current design and pins", async () => {
    const w = await world();
    const offer = await readPinSource(w.port, { canvas: w.dst.state.canvas, home: HOME, from: "itm_link" });
    expect(offer).toMatchObject({ itemId: "itm_link", canvasId: "prj_design", title: "Acme Board", home: HOME });
    expect(offer.pieces.map((piece) => [piece.title, piece.count])).toEqual([
      ["Acme DESIGN.md", 1], ["Acme review pack", 3], ["Review checklist", 1],
    ]);
  });

  it("does not trust that list when the copy runs: the source is read again", async () => {
    const w = await world();
    await readPinSource(w.port, { canvas: w.dst.state.canvas, home: HOME, from: "itm_link" });
    const snapshots = w.reads.snapshot;
    await w.copy("Review checklist");
    expect(w.reads.snapshot).toBe(snapshots + 1);
    expect(w.reads.classify).toBe(2);
  });

  it("carries no badge, credential or private field in the provenance it writes", async () => {
    const w = await world();
    const result = await w.copy("Review checklist");
    const raw = JSON.parse(w.dst.state.canvas.items[result.rootId]!.properties[CONTEXT_SOURCE_PROP]!);
    expect(Object.keys(raw).sort()).toEqual(["canvasId", "canvasTitle", "home", "itemId", "itemTitle", "versionId"]);
  });
});
