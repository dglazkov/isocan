import { expect, it, vi } from "vitest";
import { emptyCanvas, resolveCanvasGroupRequest, type Actor, type CanvasSnapshotResponse, type PostOpResponse } from "@isocan/core";
import { reduceOperation } from "../../core/src/reducer.ts";
import { questionnaireFixture } from "../../api/test/questionnaire-fixture.ts";
import { ApiError } from "../src/lib/api.ts";
import { prepareDesignReference, submitDesignReference } from "../src/lib/design-reference-submit.ts";
import type { PendingDesignReference } from "../src/lib/design-reference-draft.ts";

const actor: Actor = { id: "usr_acme", name: "Acme" }, ts = "2026-09-15T00:00:00.000Z";
const content = { title: "Acme reference", text: "<main>Acme task</main>", filename: "reference.html", kind: "html" as const };
function empty(): CanvasSnapshotResponse {
  return { project: { id: "prj_acme", title: "Acme", description: "", properties: {}, groupMode: "groups", createdAt: ts, createdBy: actor, updatedAt: ts, updatedBy: actor }, canvas: emptyCanvas(), lastSeq: 0, joined: {}, colors: {}, names: {} };
}
function canonical(before: CanvasSnapshotResponse, intent: PendingDesignReference, author = actor) {
  const envelope = { id: intent.opId, canvasId: intent.canvasId, actor: author, ts, op: intent.originGroupMode === "groups" ? resolveCanvasGroupRequest(before, intent.operation, { actor: author, ts, opId: intent.opId }) : intent.operation };
  const after = { ...before, ...reduceOperation(before, envelope)!, lastSeq: before.lastSeq + 1 };
  return { receipt: { seq: after.lastSeq, envelope }, after };
}
async function fixture() {
  const before = empty(), intent = await prepareDesignReference(before, actor, { kind: "canvas" }, content);
  const { receipt, after } = canonical(before, intent);
  const io = { snapshot: vi.fn(async () => before), upload: vi.fn(async () => ({ blobHash: intent.operation.version.blobHash, size: intent.operation.version.size })), send: vi.fn(async (): Promise<PostOpResponse> => receipt) };
  io.snapshot.mockResolvedValueOnce(before).mockResolvedValue(after);
  return { before, intent, receipt, after, io };
}

it.each([403, 404, 503])("keeps the canonical accepted creation when the following snapshot fails with %i", async status => {
  const { intent, io } = await fixture();
  io.snapshot.mockRejectedValue(new ApiError(status, "Synthetic follow-up refusal"));
  expect(await submitDesignReference(io, intent, actor, false)).toMatchObject({ status: "accepted", itemId: intent.operation.itemId, opId: intent.opId, consistency: { status: "unavailable" } });
  expect(io.send).toHaveBeenCalledOnce();
});

it("never calls a later preflight or upload failure a refusal of an uncertain earlier submission", async () => {
  const { before, intent, io } = await fixture(), frozen = JSON.stringify(intent);
  io.send.mockRejectedValueOnce(new TypeError("Synthetic lost acknowledgement after acceptance"));
  expect(await submitDesignReference(io, intent, actor, false)).toMatchObject({ status: "pending" });
  io.snapshot.mockRejectedValueOnce(new ApiError(403, "Access changed before retry"));
  expect(await submitDesignReference(io, intent, actor, true)).toMatchObject({ status: "pending" });
  io.snapshot.mockResolvedValue(before); io.upload.mockRejectedValueOnce(new ApiError(404, "Retry upload cannot reach the source"));
  expect(await submitDesignReference(io, intent, actor, true)).toMatchObject({ status: "pending" });
  expect(io.send).toHaveBeenCalledOnce();
  expect(JSON.stringify(intent)).toBe(frozen);
});

it.each(["item", "version", "content", "author", "destination", "title", "properties", "intent"])("rejects an unrelated canonical %s even when the snapshot contains matching bytes", async changed => {
  const { intent, receipt, io } = await fixture();
  const wrong = structuredClone(receipt), op = wrong.envelope.op;
  if (op.type !== "group.change" || op.action.kind !== "apply") throw new Error("The real group normalizer must produce an apply record");
  const create = op.action.change.writes.find(one => one.kind === "create");
  if (!create || create.kind !== "create") throw new Error("The insert needs its canonical create");
  if (changed === "item") create.item.id = "itm_someone_else";
  if (changed === "version") create.item.versions[0]!.id = "ver_someone_else";
  if (changed === "content") create.item.versions[0]!.blobHash = "f".repeat(64);
  if (changed === "author") create.item.versions[0]!.createdBy = { id: "usr_other", name: "Other" };
  if (changed === "destination") create.item.containerId = "itm_other_group";
  if (changed === "title") create.item.title = "Different authored title";
  if (changed === "properties") create.item.properties = { role: "design-system" };
  if (changed === "intent") op.action.change.intent = "create";
  io.send.mockResolvedValue(wrong);
  expect(await submitDesignReference(io, intent, actor, true)).toMatchObject({ status: "pending" });
  expect(io.snapshot).toHaveBeenCalledTimes(1);
});

it("uses authoritative joins without rewriting original authorship and reports later metadata drift separately", async () => {
  const { before, intent, after, io } = await fixture(), joinedActor = { id: "usr_joined", name: "Acme Joined" };
  const joined = { [actor.id]: joinedActor.id };
  io.snapshot.mockReset().mockResolvedValueOnce({ ...before, joined }).mockResolvedValue({ ...after, joined });
  expect(await submitDesignReference(io, intent, joinedActor, true)).toMatchObject({ status: "accepted", consistency: { status: "current" } });
  expect(after.canvas.items[intent.operation.itemId]!.createdBy).toEqual(actor);
  after.canvas.items[intent.operation.itemId]!.title = "Changed later";
  io.snapshot.mockReset().mockResolvedValueOnce(before).mockResolvedValue(after);
  expect(await submitDesignReference(io, intent, actor, true)).toMatchObject({ status: "accepted", consistency: { status: "stale" } });
});

it("refuses new legacy creation before any intent exists while retained provable coordinates can recover", async () => {
  const before = empty(); before.project.groupMode = "legacy";
  await expect(prepareDesignReference(before, actor, { kind: "canvas" }, content)).rejects.toThrow(/Migrate this canvas to groups/);
  const prepared = await prepareDesignReference(empty(), actor, { kind: "canvas" }, content);
  const { containerId: _container, groupPlacement: _policy, ...operation } = prepared.operation;
  const intent: PendingDesignReference = { ...prepared, originGroupMode: "legacy", operation: { ...operation, placement: { x: 240, y: 180, chosen: true } } };
  const { receipt, after } = canonical(before, intent);
  const io = { snapshot: vi.fn().mockResolvedValueOnce(before).mockResolvedValue(after), upload: vi.fn(async () => ({ blobHash: intent.operation.version.blobHash, size: intent.operation.version.size })), send: vi.fn(async () => receipt) };
  expect(await submitDesignReference(io, intent, actor, true)).toMatchObject({ status: "accepted" });
  const ambiguous: PendingDesignReference = { ...intent, operation: { ...intent.operation, placement: { anchorItemId: "itm_old_anchor" } } };
  expect(await submitDesignReference(io, ambiguous, actor, true)).toMatchObject({ status: "pending", reason: expect.stringContaining("no longer proves the captured destination") });
});

it("uses actual HTTP receipts for one undoable add, lost acknowledgement recovery and unrelated-receipt refusal", async () => {
  const f = await questionnaireFixture();
  try {
    const author = f.agent.actor;
    const io = {
      snapshot: (canvasId: string) => f.client.snapshot(canvasId),
      upload: (saved: PendingDesignReference) => f.client.uploadBlob(saved.canvasId, new TextEncoder().encode(saved.text), saved.operation.version.mimeType, saved.operation.version.filename),
      send: (saved: PendingDesignReference, by: Actor) => f.client.sendOp(saved.canvasId, by, saved.operation, undefined, undefined, undefined, saved.originGroupMode, undefined, saved.opId),
    };
    const prepare = async () => prepareDesignReference(await io.snapshot(f.canvasId), author, { kind: "canvas" }, content);
    const first = await prepare(); let sent = false;
    const accepted = await submitDesignReference({ ...io,
      snapshot: id => sent ? io.snapshot("prj_acme_absent") : io.snapshot(id),
      send: async (...args) => { const receipt = await io.send(...args); sent = true; return receipt; },
    }, first, author, false);
    expect(accepted).toMatchObject({ status: "accepted", consistency: { status: "unavailable" } });
    expect((await io.snapshot(f.canvasId)).canvas.items[first.operation.itemId]).toBeDefined();
    await f.client.undo(f.canvasId, author);
    expect((await io.snapshot(f.canvasId)).canvas.items[first.operation.itemId]).toBeUndefined();

    const intent = await prepare(), frozen = JSON.stringify(intent), before = (await io.snapshot(f.canvasId)).lastSeq;
    expect(await submitDesignReference({ ...io, send: async (...args) => { await io.send(...args); throw new TypeError("Synthetic lost HTTP acknowledgement"); } }, intent, author, false)).toMatchObject({ status: "pending" });
    expect(await submitDesignReference({ ...io, snapshot: () => io.snapshot("prj_acme_absent") }, intent, author, true)).toMatchObject({ status: "pending" });
    expect(await submitDesignReference({ ...io, upload: saved => f.client.uploadBlob("prj_acme_absent", new TextEncoder().encode(saved.text), saved.operation.version.mimeType, saved.operation.version.filename) }, intent, author, true)).toMatchObject({ status: "pending" });
    expect(JSON.stringify(intent)).toBe(frozen);
    expect(await submitDesignReference(io, intent, author, true)).toMatchObject({ status: "accepted", consistency: { status: "current" } });
    expect((await io.snapshot(f.canvasId)).lastSeq).toBe(before + 1);

    // The generic writer retry can return another same-actor add. Matching snapshot bytes from a different author are not its proof.
    const desired = await prepare(); await io.upload(desired); await io.send({ ...desired, opId: "op_acme_other_author" }, f.other.actor);
    const unrelated = await prepare(); await io.upload(unrelated); await io.send({ ...unrelated, opId: desired.opId }, author);
    expect(await submitDesignReference(io, desired, author, true)).toMatchObject({ status: "pending" });
  } finally { await f.close(); }
});
