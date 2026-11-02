import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CanvasState, Item, Operation, OpEnvelope } from "@isocan/core";
import { applyOperation, contextContentPage, contextManifest, groupRestorePreview, mainThread, resolveCanvasGroupRequest, resolveContextOperation } from "@isocan/core";
import { ContextManifestView } from "../src/components/GroupContext.tsx";
import { fetchContextContent, fetchContextManifest } from "../src/lib/api.ts";
import { captureClipboard, pasteInto } from "../src/lib/clipboard.ts";
import { deleteItems } from "../src/lib/itemactions.ts";
import { messageContextRoots } from "../src/lib/messagecontext.ts";
import { postToMain } from "../src/lib/mainthread.ts";
import { sendEchoedResult, useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";
import { canvasGroupEntries, groupDeleteLabel } from "../src/lib/canvasgroupmenus.ts";

const actor = { id: "usr_acme", name: "Acme" };
const stamp = { createdAt: "2026-09-13T00:00:00Z", createdBy: actor, updatedAt: "2026-09-13T00:00:00Z", updatedBy: actor };
function item(id: string, x: number, y: number, parent?: string, group = false): Item {
  return { id, title: id, description: "", x, y, width: group ? 500 : 120, height: group ? 500 : 100, properties: group ? { kind: "group" } : {}, ...(parent ? { containerId: parent } : {}), currentVersionId: `ver_${id}`, versions: [{ id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 4, ...stamp }], ...stamp };
}
function fixture(id = "prj_acme"): CanvasState {
  const state = applyOperation(null, { id: "op_birth", canvasId: id, actor, ts: stamp.createdAt, op: { type: "project.create", canvasId: id, title: "Acme", groupMode: "groups" } })!;
  const outer = { ...item("itm_outer", 0, 0, undefined, true), width: 1100, height: 1100 };
  const nested = item("itm_nested", 50, 100, outer.id, true);
  const a = item("itm_a", 80, 200, nested.id);
  a.versions[0]!.visual = { blobHash: "hash_visual", mimeType: "image/png", filename: "acme-visual.png", size: 7 };
  const b = item("itm_b", 85, 205, nested.id); b.properties.context = "excluded";
  const mark = item("itm_mark", 80, 200, nested.id); mark.properties = { annotates: a.id, region: "0,0,1,1" };
  state.canvas.items = Object.fromEntries([outer, nested, a, b, mark, item("itm_outside", 1400, 300)].map((entry) => [entry.id, entry]));
  return state;
}
let state: CanvasState;
let seq: number;
let posted: Operation[];
let urls: string[];
let refuse: boolean;
function land() { useCanvasStore.setState({ canvasId: state.project.id, record: state.project, canvas: state.canvas, confirmed: state, lastSeq: seq, queue: [], refused: [], past: null, capability: "edit", connection: "live" }); }
function apply(op: Operation) {
  const envelope: OpEnvelope = { id: `op_${seq + 1}`, canvasId: state.project.id, actor, ts: stamp.createdAt, op: resolveContextOperation(state, seq, op) };
  envelope.op = resolveCanvasGroupRequest(state, envelope.op, { actor, ts: stamp.createdAt, opId: envelope.id });
  state = applyOperation(state, envelope)!; seq++; return envelope;
}
beforeEach(() => {
  state = fixture(); seq = 1; posted = []; urls = []; refuse = false; land();
  useUiStore.setState({ activeGroupId: null, selectedItemIds: [], viewport: { tx: 0, ty: 0, scale: 1 } });
  vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 900 });
  vi.stubGlobal("fetch", vi.fn(async (raw: string, init?: RequestInit) => {
    const url = new URL(raw, "https://acme.test"); urls.push(url.pathname + url.search);
    if (url.pathname.endsWith("/context")) return Response.json(contextManifest(state, seq, { rootIds: url.searchParams.get("roots")?.split(",").filter(Boolean) ?? [], includeExcluded: url.searchParams.get("includeExcluded") === "true" }));
    if (url.pathname.endsWith("/context/content")) {
      const saved = mainThread(state.canvas)?.comments[0]?.context;
      const manifest = url.pathname.includes("/comments/") && saved ? saved : contextManifest(state, seq, { rootIds: url.searchParams.get("roots")?.split(",").filter(Boolean) ?? [], includeExcluded: url.searchParams.get("includeExcluded") === "true", expectedRevision: Number(url.searchParams.get("expectedRevision")) });
      return Response.json(contextContentPage(manifest, { offset: Number(url.searchParams.get("offset")), limit: 50, face: url.searchParams.get("face") as "source" | "visual" }));
    }
    if (url.pathname.includes("/blobs/") || url.pathname.includes("/blob/")) return new Response("Acme bytes");
    if (url.pathname.endsWith("/blobs")) return Response.json({ blobHash: `uploaded_${urls.length}`, size: 10 });
    const request = JSON.parse(String(init?.body)); posted.push(request.op);
    if (refuse) return Response.json({ error: "Acme refused", code: "group-conflict" }, { status: 409 });
    try { const envelope = apply(request.op); return Response.json({ seq, envelope: { ...envelope, id: request.opId } }); }
    catch (err) { return Response.json({ error: (err as Error).message, code: "group-conflict" }, { status: 409 }); }
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("the real composer request and frozen disclosure", () => {
  it("keeps group-plus-child roots, shows exclusions, and sends the exact preview revision", async () => {
    const roots = messageContextRoots(state.canvas, "Review #itm_a", ["itm_outer", "itm_a"]);
    expect(roots).toEqual(["itm_outer", "itm_a"]);
    const manifest = await fetchContextManifest(state.project.id, roots);
    expect(manifest.counts).toEqual({ included: 4, excluded: 1, unavailable: 0 });
    const result = await postToMain(state.project.id, actor, "Acme review", roots, { rootIds: roots, expectedRevision: manifest.revision });
    expect(result.status).toBe("accepted");
    const request = posted[0]!;
    expect(request.type === "thread.create" && request.comment.contextRequest).toEqual({ rootIds: roots, expectedRevision: 1 });
    expect(request.type === "thread.create" && request.comment.context).toBeUndefined();
    const comment = mainThread(state.canvas)!.comments[0]!;
    expect(comment.context).toEqual(manifest);
    expect(comment.items).toEqual(manifest.expandedIds);
    apply({ type: "item.update", itemId: "itm_a", patch: { title: "Changed later" } });
    expect(mainThread(state.canvas)!.comments[0]!.context).toEqual(manifest);
    const page = await fetchContextContent(manifest, 0, "visual", { threadId: mainThread(state.canvas)!.id, commentId: comment.id });
    expect(page.entries.find((entry) => entry.itemId === "itm_a")?.blob?.blobHash).toBe("hash_visual");
  });
  it("refuses a stale preview without adding a message, then accepts an explicit refreshed override", async () => {
    const preview = await fetchContextManifest(state.project.id, ["itm_outer"]);
    apply({ type: "item.update", itemId: "itm_a", patch: { title: "Acme changed" } }); land();
    const beforeRefusal = seq;
    expect((await postToMain(state.project.id, actor, "Acme review", ["itm_outer"], { rootIds: ["itm_outer"], expectedRevision: preview.revision })).status).toBe("refused");
    expect(mainThread(state.canvas)).toBeNull();
    expect(seq).toBe(beforeRefusal);
    const refreshed = await fetchContextManifest(state.project.id, ["itm_outer"], true);
    expect(refreshed.counts.excluded).toBe(0);
    expect((await postToMain(state.project.id, actor, "Acme review", ["itm_outer"], { rootIds: ["itm_outer"], includeExcluded: true, expectedRevision: refreshed.revision })).status).toBe("accepted");
    expect(mainThread(state.canvas)!.comments[0]!.context?.entries.find((entry) => entry.itemId === "itm_a")?.title).toBe("Acme changed");
  });
  it("renders complete 1,000-item scope as a count and at most 50 identity rows, without previews", () => {
    const original = state.canvas.items.itm_a!;
    state.canvas.items = { itm_outer: state.canvas.items.itm_outer!, ...Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`itm_${i}`, { ...original, id: `itm_${i}`, containerId: "itm_outer" }])) };
    const manifest = contextManifest(state, seq, { rootIds: ["itm_outer"] });
    const closed = renderToStaticMarkup(createElement(ContextManifestView, { manifest }));
    expect(closed).toContain("1001 items"); expect(closed).toContain("Group itm_outer");
    expect(closed).not.toContain("data-context-item-id");
    const opened = renderToStaticMarkup(createElement(ContextManifestView, { manifest, initiallyOpen: true }));
    expect(opened.match(/data-context-item-id=/g)).toHaveLength(50);
    expect(opened).toContain("of 1001"); expect(opened).toContain("Next");
    expect(opened).not.toMatch(/<iframe|<img|item-thumb|md-view/);
    expect(manifest.entries).toHaveLength(1001);
  });
  it("keeps Inspect context reachable without marking it as a mutation", () => {
    const entries = canvasGroupEntries([state.canvas.items.itm_outer!], { canvasId: state.project.id, actor, navigate: () => {} });
    expect(entries.find((entry) => "label" in entry && entry.label === "Inspect context")).toMatchObject({ label: "Inspect context" });
    expect(entries.find((entry) => "label" in entry && entry.label === "Inspect context")).not.toHaveProperty("writes");
  });
});

describe("copy and trash use real atomic writer effects", () => {
  it("copies nested membership and intentional overlap once, including the distinct visual", async () => {
    const source = captureClipboard(state.project.id, ["itm_outer", "itm_a"]);
    expect(source.rootIds).toEqual(["itm_outer"]); expect(source.items).toHaveLength(5);
    state.canvas.items.itm_a!.title = "Edited after copy";
    const made = await pasteInto(source, state.project.id, actor, { x: 2000, y: 0 });
    expect(posted).toHaveLength(1); expect(made).toHaveLength(1);
    const newRoot = state.canvas.items[made[0]!]!;
    const copied = Object.values(state.canvas.items).filter((item) => item.id !== "itm_a" && item.title === "itm_a")[0]!;
    const copiedB = Object.values(state.canvas.items).find((item) => item.id !== "itm_b" && item.title === "itm_b")!;
    expect(copied.containerId).not.toBe("itm_nested");
    expect(state.canvas.items[copied.containerId!]!.containerId).toBe(newRoot.id);
    expect(copiedB.x - copied.x).toBe(5); expect(copiedB.y - copied.y).toBe(5);
    expect(copied.versions[0]!.visual?.blobHash).toBe("hash_visual");
    expect(Object.values(state.canvas.items).find((item) => item.id !== "itm_mark" && item.title === "itm_mark")!.properties.annotates).toBe(copied.id);
  });
  it("uploads every cross-canvas face before its one copy operation", async () => {
    const source = captureClipboard(state.project.id, ["itm_outer"]);
    state = fixture("prj_destination"); land();
    const made = await pasteInto(source, state.project.id, actor);
    expect(made).toHaveLength(1); expect(posted).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith("/blobs"))).toHaveLength(6);
    expect(urls[urls.length - 1]).toContain("/ops");
    expect(Object.values(state.canvas.items).find((item) => item.id !== "itm_a" && item.title === "itm_a")!.versions[0]!.visual?.blobHash).toMatch(/^uploaded_/);
  });
  it("does not submit a partial subtree when a copied face is unavailable", async () => {
    const source = captureClipboard(state.project.id, ["itm_outer"]);
    state = fixture("prj_destination"); land();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("hash_visual") ? new Response("gone", { status: 404 }) : url.endsWith("/blobs") ? Response.json({ blobHash: "uploaded", size: 4 }) : new Response("Acme")));
    expect(await pasteInto(source, state.project.id, actor)).toEqual([]);
    expect(posted).toEqual([]); expect(Object.keys(state.canvas.items)).toHaveLength(6);
    expect(useCanvasStore.getState().notice).toContain("Could not complete paste");
  });
  it("returns actual cohort skips in the accepted receipt and labels group deletion honestly", async () => {
    expect(groupDeleteLabel([state.canvas.items.itm_outer!])).toBe("Delete group and 4 items");
    await deleteItems(state.project.id, actor, ["itm_outer"]); land();
    apply({ type: "item.restore", itemId: "itm_a" }); land();
    const preview = groupRestorePreview(state, ["itm_outer"]);
    expect(preview.skippedIds).toContain("itm_a");
    const result = await sendEchoedResult(state.project.id, actor, { type: "item.restore", itemId: "itm_outer" });
    expect(result.status).toBe("accepted");
    expect(result.envelope?.op.type === "group.change" && result.envelope.op.action.kind === "apply" && result.envelope.op.action.change.skippedIds).toContain("itm_a");
    expect(state.canvas.items.itm_a!.containerId).toBeUndefined();
  });
  it("does not clear a selection after refused deletion or a delayed deletion of another canvas", async () => {
    useUiStore.getState().setSelection(["itm_a"]); refuse = true;
    await deleteItems(state.project.id, actor, ["itm_a"]);
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_a"]);
    let release!: () => void;
    vi.stubGlobal("fetch", vi.fn(async () => { await new Promise<void>((resolve) => { release = resolve; }); return Response.json({ seq: 2 }); }));
    const pending = deleteItems(state.project.id, actor, ["itm_a"]);
    state = fixture("prj_destination"); land(); useUiStore.getState().setSelection(["itm_outside"]);
    release(); await pending;
    expect(useUiStore.getState().selectedItemIds).toEqual(["itm_outside"]);
  });
});
