import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newOpId, newVersionId, type CanvasSnapshotResponse, type PostOpResponse } from "@isocan/core";
import { prepareDesignRepair } from "@isocan/api/design-repair";
import { captureDesignAuditRepair, saveDesignRepair } from "../src/lib/design-audit.ts";
import { ApiError, getArchivedOplog } from "../src/lib/api.ts";
import { archiveDesignRepairDraft, designRepairDraftKey, keepDesignRepairDraft, readDesignRepairDraft, type DesignRepairDraft } from "../src/lib/design-repair-draft.ts";
import { auditFixture, auditHome } from "../../api/test/design-audit-fixture.ts";

const actor = { id: "usr_acme", name: "Acme" };
const replacement = '<p style="padding:16px">Acme</p>';
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const { send, state } = vi.hoisted(() => ({ send: vi.fn(), state: { canvasId: "prj_dest", past: null } }));
vi.mock("../src/stores/canvasStore.ts", () => ({ useCanvasStore: { getState: () => state } }));
vi.mock("../src/lib/api.ts", async importOriginal => ({ ...await importOriginal<typeof import("../src/lib/api.ts")>(), postOp: send }));
vi.mock("../src/lib/capability.ts", () => ({ canEditNow: () => true }));
vi.mock("../src/lib/groupplacement.ts", () => ({ creationDestination: () => ({ originGroupMode: "groups" }) }));
beforeEach(() => { vi.stubGlobal("window", { location: { origin: auditHome } }); send.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function fixture() {
  const { canvas, blobs } = auditFixture();
  // Strict repair references name real hashes, even in this bounded transport fixture.
  for (const item of Object.values(canvas.items)) for (const version of item.versions) {
    const text = blobs[version.blobHash] ?? "fixture"; delete blobs[version.blobHash];
    version.blobHash = sha(text); version.size = Buffer.byteLength(text); blobs[version.blobHash] = text;
  }
  let denied = false; let uploads = 0;
  const snapshot = { canvas, project: { id: "prj_dest" }, lastSeq: 1 } as CanvasSnapshotResponse;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/homes") return Response.json({ canvases: { prj_dest: null } });
    if (url === "/api/projects/prj_dest/canvas") return denied ? Response.json({ error: "read unavailable" }, { status: 503 }) : Response.json(snapshot);
    if (url === "/api/projects/prj_dest/design/repairs") return denied ? Response.json({ error: "history unavailable" }, { status: 503 }) : Response.json({ repairs: [], unavailable: [] });
    if (url === "/api/projects/prj_dest/blobs" && init?.method === "POST") { uploads++; return Response.json({ blobHash: sha(replacement), size: Buffer.byteLength(replacement) }); }
    const hash = url.split("/blobs/")[1];
    if (hash && blobs[hash]) return new Response(blobs[hash]);
    throw new Error(`Unexpected fixture request ${url}`);
  }));
  const basis = await captureDesignAuditRepair("prj_dest", "nested", structuredClone(snapshot));
  const prepared = await prepareDesignRepair({ basis, text: replacement, actorId: actor.id, opId: newOpId(), versionId: newVersionId(), repairId: "repair_fixture" });
  const receipt = (as = actor): PostOpResponse => ({ seq: 2, envelope: { id: prepared.opId, canvasId: "prj_dest", actor: as, ts: new Date().toISOString(), op: prepared.operation } } as PostOpResponse);
  return { snapshot, basis, prepared, receipt, deny: () => { denied = true; }, uploads: () => uploads };
}

it("captures editor metadata before opening; a concurrent title edit refuses without uploading", async () => {
  const f = await fixture(); f.snapshot.canvas.items.nested!.title = "A collaborator changed this title";
  const result = await saveDesignRepair(actor, f.prepared);
  expect(result).toMatchObject({ status: "refused", reason: expect.stringContaining("metadata") });
  expect(f.uploads()).toBe(0); expect(send).not.toHaveBeenCalled();
});

it("an HTTP408 and a matching current version prove no acceptance; exact retry recovers its full receipt", async () => {
  const f = await fixture();
  send.mockImplementationOnce(() => { const item = f.snapshot.canvas.items.nested!; item.versions.push({ ...item.versions[0]!, ...f.prepared.operation.repair.version }); item.currentVersionId = f.prepared.operation.repair.version.id; throw new ApiError(408, "lost acknowledgement"); });
  const pending = await saveDesignRepair(actor, f.prepared);
  expect(pending.status).toBe("pending");
  f.deny(); send.mockResolvedValueOnce(f.receipt());
  const accepted = await saveDesignRepair(actor, f.prepared, true);
  expect(accepted).toMatchObject({ status: "accepted", opId: f.prepared.opId, consistency: { status: "unavailable" } });
  expect(send.mock.calls.map(call => call[3])).toEqual([f.prepared.opId, f.prepared.opId]);
  expect(f.uploads()).toBe(1);
});

it("a receipt from another actor never confirms this saved repair", async () => {
  const f = await fixture(); send.mockResolvedValue(f.receipt({ id: "usr_other", name: "Other" }));
  expect(await saveDesignRepair(actor, f.prepared)).toMatchObject({ status: "pending", reason: expect.stringContaining("full repair intent") });
});

it("repair recovery validates nested bytes and ownership and cannot archive uncertain work", async () => {
  const f = await fixture();
  const draft: DesignRepairDraft = { schemaVersion: 1, canvasId: "prj_dest", actorId: actor.id, itemId: "nested", basis: f.basis, editorBaseVersionId: f.basis.repair.target.artifact.versionId, pending: { prepared: f.prepared, refused: false }, accepted: null };
  const read = (value: unknown, owner = actor.id) => readDesignRepairDraft(JSON.stringify(value), "prj_dest", owner, "nested");
  expect((await read(draft)).pending?.prepared.opId).toBe(f.prepared.opId);
  await expect(read({ ...draft, pending: { prepared: { ...f.prepared, text: "<p>Changed</p>" }, refused: false } })).rejects.toThrow();
  await expect(read({ ...draft, basis: { ...draft.basis, repair: { target: null } } })).rejects.toThrow();
  await expect(read(draft, "usr_other")).rejects.toThrow();
  const storage = { getItem: vi.fn(() => JSON.stringify(draft)), setItem: vi.fn(), removeItem: vi.fn() };
  const key = designRepairDraftKey("prj_dest", actor.id, "nested");
  expect(() => archiveDesignRepairDraft(storage, key, draft)).toThrow("awaiting confirmation"); expect(storage.removeItem).not.toHaveBeenCalled();
  const unavailable = { setItem: () => { throw new Error("quota"); } };
  expect(() => keepDesignRepairDraft(unavailable, key, draft)).toThrow("quota");
});

it("strict archived history failure stays unavailable while the legacy optional read stays compatible", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "archive unavailable" }, { status: 503 })));
  await expect(getArchivedOplog("prj_dest", { strict: true })).rejects.toThrow("archive unavailable");
  expect(await getArchivedOplog("prj_dest")).toEqual([]);
});
