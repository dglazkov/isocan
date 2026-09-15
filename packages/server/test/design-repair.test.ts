import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CURRENT_CLIENT_FEATURES, CLIENT_FEATURES_HEADER, CLIENT_FEATURES_PARAM, WS_STALE_CLIENT, SOURCE_POLICY_HEADER, sourcePolicyHeader, applyOperation, type Operation, type Actor, type DesignReceipt } from "@isocan/core";
import { DESIGN_AUDIT_VERSION } from "@isocan/core/design-audit";
import { designDecisionScope, type DesignComparison } from "@isocan/core/design-decision";
import { type DesignRepairOperation, parseDesignRepairBasis } from "@isocan/core/design-repair";
import { validateDesignRepairCanonical, designRepairTransitions } from "../../core/src/design-repair-state.ts";
import { designRequestBasisCurrent } from "@isocan/core/design-request";
import { readDesignRequests } from "../src/design-request.ts";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { mintBadge } from "../src/badges.ts";
import { startDaemon } from "../src/daemon.ts";
import { mintTestBadge } from "./badge.ts";
import { WebSocket } from "ws";
const human = { id: "usr_repair_human", name: "Acme Person" }, agent = { id: "usr_repair_agent", name: "Acme Builder" }, other = { id: "usr_repair_other", name: "Acme Teammate" };
const canvasId = "prj_repair", threadId = "thr_repair";
let home = "https://example.test", dir: string, store: FileStore, desk: FileDesk, engine: Engine, badgeId: string, badgeToken: string;
const post = (op: Operation, actor: Actor = agent, opId?: string) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES, op, ...(opId ? { opId } : {}) });
async function add(id: string, body: string, mimeType = "text/html") {
  const blob = await engine.putBlob(canvasId, Buffer.from(body), { mimeType, filename: id + ".html" });
  const visual = id === "itm_target" ? { ...await engine.putBlob(canvasId, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Acme before</text></svg>'), { mimeType: "image/svg+xml", filename: "before.svg" }), filename: "before.svg" } : undefined;
  await post({ type: "item.add", itemId: id, title: id, description: "Acme captured metadata", properties: { purpose: "receiving" }, width: 320, height: 240, placement: { x: 0, y: 0 }, version: { id: "ver_" + id, ...blob, filename: id + ".html", ...(visual ? { visual } : {}) } });
  return { home, canvasId, itemId: id, versionId: "ver_" + id, blobHash: blob.blobHash };
}
async function setup(task = true, decision = false) {
  const target = await add("itm_target", "<!doctype html><button>Save receipt</button>"), review = await add("itm_review", '{"synthetic":"authored review citation"}', "application/json");
  if (task) await post({ type: "design.request", action: { kind: "start", requestId: "req_repair", itemId: "itm_brief", versionId: "ver_brief", admission: "explicit", source: { entrance: "canvas-chat", threadId, commentId: "cmt_source" }, fields: { intent: "refine", fidelity: "designed", delivery: "html-node", targetItemId: target.itemId, groupId: null, audience: "Acme receivers", primaryTask: "Receive stock", constraints: [], facts: [], references: [], outstandingDecisionIds: decision ? ["approach"] : [], outputIds: [target.itemId] }, contextRequest: { rootIds: [target.itemId] } } });
  const row = (await engine.designRequests(canvasId, home)).requests[0], snapshot = await engine.getSnapshot(canvasId), item = snapshot.canvas.items[target.itemId]!;
  const blob = await engine.putBlob(canvasId, Buffer.from('<!doctype html><button onclick="this.textContent=\'Saved\'">Save receipt</button>'), { mimeType: "text/html", filename: "replacement.html" });
  const op: DesignRepairOperation = { type: "design.repair", repair: { id: "repair_acme", request: row ? { brief: row.ref, requestId: row.brief.requestId, epoch: 1 } : null, review: row ? { run: review, runId: "run_acme", passId: "pass_acme_1" } : null, target: { artifact: target, title: item.title, description: item.description, properties: item.properties, scope: designDecisionScope(snapshot.canvas, item) }, governing: { atItemId: target.itemId, artifact: null, explicitNone: false }, ruleVersion: DESIGN_AUDIT_VERSION, version: { id: "ver_repaired", blobHash: blob.blobHash, size: blob.size! } } };
  return { target, review, row, op };
}
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-repair-")); store = new FileStore(dir); await store.init(); desk = new FileDesk(dir); await desk.init(); const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; badgeToken = badge.token; await desk.put(badge.record); engine = new Engine(store, desk);
  for (const [actor, harness] of [[human, "web"], [agent, "codex"], [other, "web"]] as const) await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `${harness}:${actor.id}`, as: actor.id, name: actor.name } });
  await post({ type: "project.create", canvasId, title: "Acme repair", groupMode: "groups" }, human); await post({ type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_source", body: "Fix receiving stock" } }, human);
});
afterEach(async () => { await store.close(); await desk.close(); await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); home = "https://example.test"; });
describe("canonical conditional design repair", () => {
  it("keeps original task context through repair, Undo/Redo, completion and an attributed receipt", async () => {
    const s = await setup(), before = await engine.getSnapshot(canvasId), accepted = await post(s.op, agent, "op_repair_accept");
    expect(accepted.envelope.op.type).toBe("design.repair"); expect(accepted.inverse?.type).toBe("item.removeVersion");
    const after = await engine.getSnapshot(canvasId), item = after.canvas.items[s.target.itemId]!;
    expect(after.lastSeq).toBe(before.lastSeq + 1); expect(item.versions.at(-1)).toMatchObject({ id: s.op.repair.version.id, filename: "itm_target.html", mimeType: "text/html", createdBy: agent });
    expect(item.versions.at(-1)?.designRecord).toBeUndefined(); expect(after.canvas.threads).toEqual(before.canvas.threads);
    expect((await engine.designRequests(canvasId, home)).requests[0]).toMatchObject({ status: "current", brief: { epoch: 1, context: s.row!.brief.context } });
    await engine.undo(canvasId, agent, badgeId); expect((await engine.designRepairs(canvasId, home)).repairs[0]?.standing).toBe("undone");
    expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("current");
    await engine.redo(canvasId, agent, badgeId); expect((await engine.designRepairs(canvasId, home)).repairs[0]).toMatchObject({ standing: "active", status: "current", author: agent });
    await post({ type: "design.request", action: { kind: "complete", brief: s.row!.ref, epoch: 1, versionId: "ver_complete" } });
    const completed = (await engine.designRequests(canvasId, home)).requests[0]!;
    expect(completed.brief.context).toEqual(s.row!.brief.context); expect(completed.brief.epoch).toBe(1);
    expect(completed.completedFrom?.brief).toEqual(s.row!.ref); expect(designRequestBasisCurrent(completed, s.op.repair.request!)).toBe(true);
    expect((await engine.designRepairs(canvasId, home)).repairs[0]).toMatchObject({ standing: "active", status: "current" });
    const receipt: DesignReceipt = { schemaVersion: 1, kind: "receipt", id: "receipt_acme", requestId: "req_repair", epoch: 1, brief: completed.ref, output: { kind: "canvas", artifact: { ...s.target, versionId: s.op.repair.version.id, blobHash: s.op.repair.version.blobHash } }, context: [s.target], fidelity: "designed", status: "draft", governing: s.op.repair.governing, checks: [{ id: "browser", kind: "browser-task", tool: "Acme test fixture", toolVersion: "1", result: "unavailable", coverage: "No actual browser was used in this server test", state: "receiving", viewport: null, evidence: [s.review] }], unresolved: [{ severity: "noncritical", description: "Task inspection remains unavailable" }] };
    await post({ type: "design.receipt", itemId: "itm_receipt", versionId: "ver_receipt", receipt });
    expect((await engine.designRequests(canvasId, home)).requests[0]?.receipts[0]).toMatchObject({ status: "current", receipt: { status: "draft" } });
  });
  it("refuses changed target metadata, content, scope, governing input, cancellation and epoch without effects", async () => {
    const s = await setup();
    for (const patch of [{ title: "Teammate title" }, { description: "Teammate description" }, { properties: { purpose: "changed" } }]) {
      await post({ type: "item.update", itemId: s.target.itemId, patch }, other); const before = await engine.getSnapshot(canvasId);
      await expect(post(s.op)).rejects.toThrow(/metadata or scope changed/); expect(await engine.getSnapshot(canvasId)).toEqual(before); await engine.undo(canvasId, other, badgeId);
    }
    await post({ type: "comment.update", threadId, commentId: "cmt_source", body: "A different request" }, human); await expect(post(s.op)).rejects.toThrow(/original request text changed/); await engine.undo(canvasId, human, badgeId);
    const later = await engine.putBlob(canvasId, Buffer.from("Teammate HTML"), { mimeType: "text/html", filename: "later.html" });
    await post({ type: "item.addVersion", itemId: s.target.itemId, version: { id: "ver_teammate", ...later, filename: "later.html" } }, other); await expect(post(s.op)).rejects.toThrow(/metadata or scope changed/); await engine.undo(canvasId, other, badgeId);
    const groupBlob = await engine.putBlob(canvasId, Buffer.from("Acme scope"), { mimeType: "text/markdown", filename: "scope.md" });
    await post({ type: "group.change", action: { kind: "create", group: { id: "itm_scope", title: "Acme scope", version: { id: "ver_scope", ...groupBlob, filename: "scope.md" } }, itemIds: [s.target.itemId] } }, other); await expect(post(s.op)).rejects.toThrow(/metadata or scope changed/); await engine.undo(canvasId, other, badgeId);
    const system = await add("itm_system", "---\nname: Acme controls\n---\n", "text/markdown"); await post({ type: "item.update", itemId: system.itemId, patch: { properties: { role: "design-system" } } }, other); await expect(post(s.op)).rejects.toThrow(/governing design system changed/); await engine.undo(canvasId, other, badgeId);
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_cancel", body: "/cancel" } }, human); await expect(post(s.op)).rejects.toThrow(/cancelled/); await engine.undo(canvasId, human, badgeId);
    await post({ type: "design.request", action: { kind: "resume", brief: s.row!.ref, epoch: 1, versionId: "ver_resume", reason: "Explicit takeover" } }); await expect(post(s.op)).rejects.toThrow();
  });
  it("validates actual canonical retention and reserves accepted identity after Undo, GC and restart", async () => {
    const s = await setup(), before = await engine.getSnapshot(canvasId), accepted = await post(s.op, agent, "op_repair_archived");
    expect(applyOperation(before, accepted.envelope)?.canvas).toEqual((await engine.getSnapshot(canvasId)).canvas);
    for (const alter of [(op: DesignRepairOperation) => { op.canonical!.retainedReferences = []; }, (op: DesignRepairOperation) => { op.effect!.version.filename = "forged.html"; }, (op: DesignRepairOperation) => { op.canonical!.retainedReferences[0]!.version.size = -1; }]) {
      const envelope = structuredClone(accepted.envelope); alter(envelope.op as DesignRepairOperation); expect(() => validateDesignRepairCanonical(envelope)).toThrow();
    }
    const forged = structuredClone(accepted.envelope.op); await expect(post(forged)).rejects.toThrow();
    await engine.undo(canvasId, agent, badgeId); await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    const undone = await engine.getSnapshot(canvasId); expect((await post(s.op, agent, "op_repair_archived")).seq).toBe(accepted.seq); expect(await engine.getSnapshot(canvasId)).toEqual(undone);
    expect((await engine.designRepairs(canvasId, home)).repairs[0]?.standing).toBe("undone");
    await expect(post({ ...s.op, repair: { ...s.op.repair, ruleVersion: "changed" } }, agent, "op_repair_archived")).rejects.toMatchObject({ code: "design-intent-conflict" });
    await expect(post(s.op, other, "op_repair_archived")).rejects.toMatchObject({ code: "design-intent-conflict" });
    await expect(post({ type: "item.update", itemId: s.target.itemId, patch: { title: "Collision" } }, agent, "op_repair_archived")).rejects.toMatchObject({ code: "design-intent-conflict" });
    const joined = { id: "usr_repair_joined", name: "Acme Resumed Builder" };
    await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "codex:repair-joined", as: joined.id, name: joined.name } });
    await engine.joinActors({ badgeId, actor: joined, op: { type: "actor.join", from: agent.id, into: joined.id } });
    expect((await post(s.op, joined, "op_repair_archived")).envelope.actor).toEqual(accepted.envelope.actor);
    expect((await engine.designRepairs(canvasId, home)).repairs[0]?.author).toEqual(agent);
    const badHistory = structuredClone(accepted); (badHistory.envelope.op as DesignRepairOperation).canonical!.retainedReferences = [];
    expect(() => designRepairTransitions([badHistory])).toThrow();
  });
  it("preserves explicit audit repair with known absent policy and rejects semantic fields before IDs exist", async () => {
    const s = await setup(false), { id: _id, version: _version, ...basis } = s.op.repair;
    expect(parseDesignRepairBasis(basis)).toEqual(basis); expect(() => parseDesignRepairBasis({ ...basis, futureOverride: true })).toThrow();
    await post(s.op); expect((await engine.designRepairs(canvasId, home)).repairs[0]).toMatchObject({ status: "current", repair: { request: null, review: null } });
  });
  it("gates actual repair history and returned receipts through HTTP, sockets and a transparent replica, while plain snapshots remain readable", async () => {
    await store.close(); await desk.close(); const daemon = await startDaemon({ port: 0, home: dir, birthHome: null });
    home = `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}`; engine = daemon.engine;
    const oldFeatures = CURRENT_CLIENT_FEATURES.replace(/,?design-repairs-v1/, ""), headers = { Authorization: `Bearer ${badgeToken}` }, sockets: WebSocket[] = [];
    let relay: Awaited<ReturnType<typeof startDaemon>> | undefined;
    const request = (url: string, body: unknown = undefined, features = CURRENT_CLIENT_FEATURES) => fetch(home + url, { method: body === undefined ? "GET" : "POST", headers: { ...headers, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    try {
      const s = await setup(false), initial = await engine.getSnapshot(canvasId), body = { canvasId, actor: agent, opId: "op_http_repair", op: s.op };
      expect((await request("/api/ops", body, oldFeatures)).status).toBe(426); expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(initial.lastSeq);
      const socket = new WebSocket(`${home.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=0&${CLIENT_FEATURES_PARAM}=${encodeURIComponent(oldFeatures)}`, { headers }); sockets.push(socket);
      await new Promise<void>((resolve, reject) => { socket.once("message", () => resolve()); socket.once("error", reject); });
      const messages: unknown[] = []; socket.on("message", (data) => messages.push(JSON.parse(String(data)))); const closed = new Promise<number>((resolve) => socket.once("close", resolve));
      const response = await request("/api/ops", body); expect(response.status, await response.clone().text()).toBe(200);
      expect(await closed).toBe(WS_STALE_CLIENT); expect(messages).toEqual([]);
      expect((await request(`/api/projects/${canvasId}/canvas`, undefined, oldFeatures)).status).toBe(200);
      expect((await request(`/api/projects/${canvasId}/oplog/archive`, undefined, oldFeatures)).status).toBe(200); // Empty archive exposes no repair semantics.
      for (const url of [`/api/projects/${canvasId}/oplog`, `/api/projects/${canvasId}/design/repairs`]) expect((await request(url, undefined, oldFeatures)).status, url).toBe(426);
      expect((await request(`/api/projects/${canvasId}/undo`, { actor: agent }, oldFeatures)).status).toBe(426);
      await engine.undo(canvasId, agent, badgeId);
      expect((await request(`/api/projects/${canvasId}/redo`, { actor: agent }, oldFeatures)).status).toBe(426);
      await engine.gc(canvasId, { keepOps: 0, graceMs: 0 });
      const collision = { ...body, op: { type: "item.update", itemId: s.target.itemId, patch: { title: "Reused archived identity" } } }, before = await engine.getSnapshot(canvasId);
      expect((await request("/api/ops", collision, oldFeatures)).status).toBe(426); const conflict = await request("/api/ops", collision); expect(conflict.status).toBe(400); expect(await conflict.json()).toMatchObject({ code: "design-intent-conflict" });
      relay = await startDaemon({ port: 0, home: path.join(dir, "relay"), birthHome: null, homePollMs: 50 });
      const relayHome = `http://127.0.0.1:${(relay.app.server.address() as { port: number }).port}`, relayBadge = await mintTestBadge(relayHome); await relayBadge.speakAs(agent, "codex:acme-repair-relay");
      const pass = await request(`/api/projects/${canvasId}/passes`, { actorId: agent.id }); expect(pass.status).toBe(200); const { token } = await pass.json() as { token: string };
      const redeemed = await fetch(relayHome + "/api/passes/redeem", { method: "POST", headers: { ...relayBadge.headers, "Content-Type": "application/json" }, body: JSON.stringify({ home, token }) }); expect(redeemed.status, await redeemed.clone().text()).toBe(200);
      await expect.poll(() => relay!.store.canvasExists(canvasId)).toBe(true);
      const policy = sourcePolicyHeader({ policy: { mode: "direct", actorId: agent.id, intent: "edit" }, expectedHome: home });
      for (const [url, payload] of [[`/api/projects/${canvasId}/design/repairs`, undefined], [`/api/projects/${canvasId}/oplog/archive`, undefined], ["/api/ops", body]] as const) for (const features of [oldFeatures, CURRENT_CLIENT_FEATURES]) {
        const result = await fetch(relayHome + url, { method: payload === undefined ? "GET" : "POST", headers: { ...relayBadge.headers, [SOURCE_POLICY_HEADER]: policy, [CLIENT_FEATURES_HEADER]: features, ...(payload === undefined ? {} : { "Content-Type": "application/json" }) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
        expect(result.status, await result.clone().text()).toBe(features === oldFeatures ? 426 : 200); await result.arrayBuffer();
      }
      expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq); expect((await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]?.currentVersionId).toBe(s.target.versionId);
    } finally { for (const socket of sockets) socket.terminate(); await relay?.close(); await daemon.close(); }
  });

  it("does not replace a teammate's newer target while undoing the repair", async () => {
    const s = await setup(); await post(s.op);
    const blob = await engine.putBlob(canvasId, Buffer.from("Teammate latest content"), { mimeType: "text/html", filename: "teammate.html" });
    await post({ type: "item.addVersion", itemId: s.target.itemId, version: { id: "ver_newer_teammate", ...blob, filename: "teammate.html" } }, other);
    const before = await engine.getSnapshot(canvasId);
    await expect(engine.undo(canvasId, agent, badgeId)).rejects.toMatchObject({ code: "edit-conflict" });
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
    await engine.undo(canvasId, other, badgeId); await engine.undo(canvasId, agent, badgeId);
    expect((await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]?.currentVersionId).toBe(s.target.versionId);
    await post({ type: "item.update", itemId: s.target.itemId, patch: { description: "Teammate after undo" } }, other);
    await expect(engine.redo(canvasId, agent, badgeId)).rejects.toMatchObject({ code: "edit-conflict" });
    await engine.undo(canvasId, other, badgeId); await engine.redo(canvasId, agent, badgeId);
    expect((await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]?.currentVersionId).toBe(s.op.repair.version.id);
  });

  it("continues an adopted target through two repairs and rejects missing edges or unrelated edits", async () => {
    const s = await setup(true, true), candidate = await add("itm_candidate", "<!doctype html><button>Chosen approach</button>");
    const proposal: DesignComparison = { schemaVersion: 1, kind: "comparison", id: "cmp_direct", revision: 1, requestId: "req_repair", epoch: 1, brief: s.row!.ref, decisionKey: "approach", audience: { kind: "human", respondentActorId: human.id }, mode: "direct", uncertainty: "structure", scenario: "Receive the same Acme delivery", fidelity: "designed", alternatives: [{ id: "chosen", title: "Chosen", hypothesis: "Focused receiving", tradeoff: "Inventory follows", artifact: candidate }], recommendedAlternativeId: "chosen", recommendation: "Prioritize receiving", target: { itemId: s.target.itemId, groupId: null }, governing: s.op.repair.governing, supersedes: null, correctsDecisionId: null, followsResponseId: null };
    await post({ type: "thread.create", threadId: "thr_adoption", x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_adoption_intro", body: "Acme direction" } });
    await post({ type: "design.decide", threadId: "thr_adoption", commentId: "cmt_direct_decision", decision: { id: "decision_direct", requestId: "req_repair", decisionKey: "approach", source: { kind: "direct", proposal }, basis: { brief: s.row!.ref, epoch: 1, alternatives: [candidate], target: s.op.repair.target, governing: s.op.repair.governing }, chosenAlternativeId: "chosen", versionId: "ver_adopted", supersedesDecisionId: null, authority: { kind: "agent-judgment", rationale: "A focused path fits the supplied task" } } });
    const first = { ...s.op, repair: { ...s.op.repair, target: { ...s.op.repair.target, artifact: { ...s.target, versionId: "ver_adopted", blobHash: candidate.blobHash } } } };
    await post(first); const blob = await engine.putBlob(canvasId, Buffer.from("<!doctype html><button>Corrected mobile layout</button>"), { mimeType: "text/html", filename: "mobile.html" });
    const second: DesignRepairOperation = { ...first, repair: { ...first.repair, id: "repair_second", review: { ...first.repair.review!, passId: "pass_acme_2" }, target: { ...first.repair.target, artifact: { ...s.target, versionId: first.repair.version.id, blobHash: first.repair.version.blobHash } }, version: { id: "ver_repaired2", blobHash: blob.blobHash, size: blob.size! } } };
    await post(second); expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("current");
    await post({ type: "design.request", action: { kind: "update", brief: s.row!.ref, epoch: 1, versionId: "ver_corrected_brief", patch: { audience: "Acme receiving crew" } } });
    expect((await engine.designRequests(canvasId, home)).requests[0]).toMatchObject({ status: "current", brief: { context: s.row!.brief.context, epoch: 1 } });
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk); expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("current");
    await post({ type: "thread.delete", threadId: "thr_adoption" }, other); expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("stale"); await engine.undo(canvasId, other, badgeId);
    expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("current");
    await post({ type: "item.update", itemId: s.target.itemId, patch: { description: "Unrelated later design change" } }, other); expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("stale");
  });
  it("retains flat repair inputs while its log owns them and reports unavailable bytes after every owner is removed", async () => {
    const s = await setup(false), visual = (await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]!.versions[0]!.visual!;
    await post(s.op, agent, "op_repair_retention");
    await post({ type: "item.pruneVersions", itemId: s.target.itemId, keep: 1 }, other);
    const orphan = await engine.putBlob(canvasId, Buffer.from("Acme orphan"), { mimeType: "text/plain", filename: "orphan.txt" });
    await engine.gc(canvasId, { keepOps: 100, graceMs: 0 });
    expect(await store.blobMeta(canvasId, s.target.blobHash)).not.toBeNull(); expect(await store.blobMeta(canvasId, visual.blobHash)).not.toBeNull(); expect(await store.blobMeta(canvasId, orphan.blobHash)).toBeNull();
    const row = (await engine.designRepairs(canvasId, home)).repairs[0]!; expect(row.references[0]!.version.visual?.blobHash).toBe(visual.blobHash); expect(row.status).toBe("current");
    await post({ type: "item.delete", itemId: s.target.itemId }, other); await post({ type: "trash.empty" }, other); await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    expect(await store.blobMeta(canvasId, s.target.blobHash)).toBeNull(); expect(await store.blobMeta(canvasId, visual.blobHash)).toBeNull(); expect((await engine.designRepairs(canvasId, home)).repairs[0]).toMatchObject({ standing: "active", status: "unavailable" });
    const before = await engine.getSnapshot(canvasId); await post(s.op, agent, "op_repair_retention"); expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

  it("preflights grouped repair history sequentially and leaves conflicts non-consuming without requiring current request eligibility", async () => {
    const s = await setup(), group = "gesture_repairs", submit = (op: DesignRepairOperation) => engine.submit({ canvasId, actor: agent, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES, group, op });
    await submit(s.op);
    const blob = await engine.putBlob(canvasId, Buffer.from("Second Acme repair"), { mimeType: "text/html", filename: "second.html" });
    const second: DesignRepairOperation = { ...s.op, repair: { ...s.op.repair, id: "repair_group2", review: { ...s.op.repair.review!, passId: "pass_acme_2" }, target: { ...s.op.repair.target, artifact: { ...s.target, versionId: s.op.repair.version.id, blobHash: s.op.repair.version.blobHash } }, version: { id: "ver_group2", blobHash: blob.blobHash, size: blob.size! } } };
    await submit(second);
    await post({ type: "item.update", itemId: s.target.itemId, patch: { properties: { purpose: "teammate metadata" } } }, other);
    let before = await engine.getSnapshot(canvasId); await expect(engine.undo(canvasId, agent, badgeId)).rejects.toMatchObject({ code: "edit-conflict" }); expect(await engine.getSnapshot(canvasId)).toEqual(before);
    await engine.undo(canvasId, other, badgeId);
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_cancel_history", body: "/cancel" } }, human);
    await engine.undo(canvasId, agent, badgeId); expect((await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]?.currentVersionId).toBe(s.target.versionId);
    expect((await engine.designRepairs(canvasId, home)).repairs.map((r) => r.standing)).toEqual(["undone", "undone"]);
    const scoped = await engine.putBlob(canvasId, Buffer.from("Acme scope after undo"), { mimeType: "text/markdown", filename: "scope.md" });
    await post({ type: "group.change", action: { kind: "create", group: { id: "itm_redo_scope", title: "Acme redo scope", version: { id: "ver_redo_scope", ...scoped, filename: "scope.md" } }, itemIds: [s.target.itemId] } }, other);
    before = await engine.getSnapshot(canvasId); await expect(engine.redo(canvasId, agent, badgeId)).rejects.toMatchObject({ code: "edit-conflict" }); expect(await engine.getSnapshot(canvasId)).toEqual(before);
    await engine.undo(canvasId, other, badgeId); await engine.redo(canvasId, agent, badgeId);
    expect((await engine.getSnapshot(canvasId)).canvas.items[s.target.itemId]?.currentVersionId).toBe(second.repair.version.id);
    expect((await engine.designRepairs(canvasId, home)).repairs.map((r) => r.standing)).toEqual(["active", "active"]);
    expect((await engine.designRequests(canvasId, home)).requests[0]?.status).toBe("cancelled");
  });

  it("replays a group of ordinary dependent conditional edits in original order", async () => {
    const target = await add("itm_order", "First content"), group = "gesture_dependent_edits";
    let previous = target.versionId;
    for (const versionId of ["ver_order2", "ver_order3"]) {
      const blob = await engine.putBlob(canvasId, Buffer.from(versionId), { mimeType: "text/html", filename: "order.html" });
      await engine.submit({ canvasId, actor: agent, badgeId, clientFeatures: CURRENT_CLIENT_FEATURES, group, op: { type: "item.edit", itemId: target.itemId, expectedVersionId: previous, patch: {}, version: { id: versionId, ...blob, filename: "order.html" } } }); previous = versionId;
    }
    await engine.undo(canvasId, agent, badgeId); expect((await engine.getSnapshot(canvasId)).canvas.items[target.itemId]?.currentVersionId).toBe(target.versionId);
    engine = new Engine(store, desk); await engine.redo(canvasId, agent, badgeId);
    expect((await engine.getSnapshot(canvasId)).canvas.items[target.itemId]?.currentVersionId).toBe("ver_order3");
    await engine.undo(canvasId, agent, badgeId); expect((await engine.getSnapshot(canvasId)).canvas.items[target.itemId]?.currentVersionId).toBe(target.versionId);
  });

  it("uses only exact canonical completion history and never treats corrected, resumed or tampered briefs as the inspected request", async () => {
    const s = await setup(); await post(s.op);
    const completion = await post({ type: "design.request", action: { kind: "complete", brief: s.row!.ref, epoch: 1, versionId: "ver_exact_complete" } });
    const state = await engine.getSnapshot(canvasId), history = await engine.getLog(canvasId), registry = (await store.loadActors()).registry;
    const current = (await engine.designRequests(canvasId, home)).requests[0]!; expect(designRequestBasisCurrent(current, s.op.repair.request!)).toBe(true);
    const absent = (await readDesignRequests(store, state, home, registry, history.filter((e) => e.seq !== completion.seq))).requests[0]!;
    expect(absent.completedFrom).toBeNull(); expect(designRequestBasisCurrent(absent, s.op.repair.request!)).toBe(false);
    const tampered = structuredClone(state); tampered.canvas.items[s.row!.ref.itemId]!.versions.find((v) => v.id === current.ref.versionId)!.designRecord!.intentHash = "0".repeat(64);
    const mismatch = (await readDesignRequests(store, tampered, home, registry, history)).requests[0]!; expect(mismatch.completedFrom).toBeNull();
    const missingEdge = (await readDesignRequests(store, state, home, registry, history.filter((e) => e.envelope.op.type !== "design.repair"))).requests[0]!; expect(designRequestBasisCurrent(missingEdge, s.op.repair.request!)).toBe(false);
    await engine.undo(canvasId, agent, badgeId);
    await post({ type: "design.request", action: { kind: "update", brief: s.row!.ref, epoch: 1, versionId: "ver_changed_facts", patch: { audience: "Changed audience" } } });
    const corrected = (await engine.designRequests(canvasId, home)).requests[0]!; expect(designRequestBasisCurrent(corrected, s.op.repair.request!)).toBe(false);
    await post({ type: "design.request", action: { kind: "complete", brief: corrected.ref, epoch: 1, versionId: "ver_corrected_complete" } });
    expect(designRequestBasisCurrent((await engine.designRequests(canvasId, home)).requests[0]!, s.op.repair.request!)).toBe(false);
    const completed = (await engine.designRequests(canvasId, home)).requests[0]!;
    await post({ type: "design.request", action: { kind: "resume", brief: completed.ref, epoch: 1, versionId: "ver_new_epoch", reason: "New inspection scope" } });
    expect(designRequestBasisCurrent((await engine.designRequests(canvasId, home)).requests[0]!, s.op.repair.request!)).toBe(false);
  });

});
