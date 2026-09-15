import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CURRENT_CLIENT_FEATURES, CLIENT_FEATURES_HEADER, CLIENT_FEATURES_PARAM, WS_STALE_CLIENT, SOURCE_POLICY_HEADER, sourcePolicyHeader, applyOperation, type Operation, type Actor, type Comment } from "@isocan/core";
import { designDecisionScope, designComparisonActions, type DesignComparison, type DesignDecisionInput } from "@isocan/core/design-decision";
import { designInputTransition, validateDesignDecisionComment } from "../../core/src/design-decision-state.ts";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { WebSocket } from "ws";
import { startDaemon } from "../src/daemon.ts";
import { mintTestBadge } from "./badge.ts";
import { mintBadge } from "../src/badges.ts";
const human = { id: "usr_acme_human", name: "Acme Person" }, agent = { id: "usr_acme_agent", name: "Acme Builder" }, other = { id: "usr_acme_other", name: "Acme Teammate" };
const canvasId = "prj_compare", threadId = "thr_compare";
let home = "https://example.test";
let dir: string, store: FileStore, desk: FileDesk, engine: Engine, badgeId: string, badgeToken: string;
const post = (op: Operation, actor: Actor = agent, opId?: string) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES, op, ...(opId ? { opId } : {}) });
async function add(id: string, body: string, mimeType = "text/html", visualBody?: string) { const visual = visualBody ? { ...await engine.putBlob(canvasId, Buffer.from(visualBody), { mimeType: "image/svg+xml", filename: id + ".svg" }), filename: id + ".svg" } : undefined; const blob = await engine.putBlob(canvasId, Buffer.from(body), { mimeType, filename: id + ".html" }); await post({ type: "item.add", itemId: id, title: id, description: "Acme target metadata", properties: { purpose: "comparison" }, width: 320, height: 240, placement: { x: 0, y: 0 }, version: { id: "ver_" + id, ...blob, filename: id + ".html", ...(visual ? { visual } : {}) } }); return { home, canvasId, itemId: id, versionId: "ver_" + id, blobHash: blob.blobHash }; }
async function setup(existing = true, external = false, publishNow = true) {
  const a = await add("itm_a", "<!doctype html><title>Acme continuous</title>Continuous", "text/html", '<svg xmlns="http://www.w3.org/2000/svg"><text>Acme continuous</text></svg>'), b = await add("itm_b", "<!doctype html><title>Acme confirmation</title>Confirm", "text/html", '<svg xmlns="http://www.w3.org/2000/svg"><text>Acme confirmation</text></svg>'), target = existing ? await add("itm_target", "<!doctype html><title>Acme original</title>Original") : a;
  await post({ type: "design.request", action: { kind: "start", requestId: "req_acme", itemId: "itm_brief", versionId: "ver_brief", admission: "explicit", source: external ? { entrance: "external-agent", externalRequestId: "native_acme" } : { entrance: "canvas-chat", threadId, commentId: "cmt_source" }, fields: { intent: "create", fidelity: "wireframe", delivery: "html-node", targetItemId: existing ? target.itemId : null, groupId: null, audience: "Acme receivers", primaryTask: "Receive stock", constraints: [], facts: [], references: [], outstandingDecisionIds: ["scan-mode"], outputIds: [] }, contextRequest: { rootIds: [target.itemId] } } });
  const row = (await engine.designRequests(canvasId, home)).requests[0]!;
  const comparison: DesignComparison = { schemaVersion: 1, kind: "comparison", id: "cmp_acme", revision: 1, requestId: "req_acme", epoch: 1, brief: row.ref, decisionKey: "scan-mode", audience: external ? { kind: "external-agent", externalRequestId: "native_acme", reporterActorId: agent.id } : { kind: "human", respondentActorId: human.id }, mode: "comparison", uncertainty: "structure", scenario: "Receive the same three Acme stock items", fidelity: "wireframe", alternatives: [{ id: "continuous", title: "Continuous", hypothesis: "Keep scanning", tradeoff: "Review at end", artifact: a }, { id: "confirm", title: "Confirm", hypothesis: "Confirm each line", tradeoff: "Slower batches", artifact: b }], recommendedAlternativeId: "continuous", recommendation: "Keep batch entry fast, then review", target: { itemId: existing ? target.itemId : null, groupId: null }, governing: { atItemId: existing ? target.itemId : null, artifact: null, explicitNone: false }, supersedes: null, correctsDecisionId: null, followsResponseId: null };
  const publish: Operation = { type: "design.compare", threadId, commentId: "cmt_comparison", comparison }; if (publishNow) await post(publish);
  const snapshot = await engine.getSnapshot(canvasId), item = snapshot.canvas.items[target.itemId]!;
  const decision: DesignDecisionInput = { id: "decision_acme", requestId: "req_acme", decisionKey: "scan-mode", source: { kind: "comparison", source: { threadId, commentId: "cmt_comparison", payloadId: comparison.id, revision: 1 } }, basis: { brief: row.ref, epoch: 1, alternatives: [a, b], target: { artifact: target, title: item.title, description: item.description, properties: item.properties, scope: designDecisionScope(snapshot.canvas, item) }, governing: { atItemId: target.itemId, artifact: null, explicitNone: false } }, chosenAlternativeId: "continuous", versionId: "ver_adopted", supersedesDecisionId: null, authority: external ? { kind: "external-report", externalRequestId: "native_acme", reportedOutcome: "choice", statement: "The user chose continuous in the external conversation", reportedReason: null, rationale: "Apply the reported choice" } : { kind: "human-choice", reason: null } };
  const op: Extract<Operation, { type: "design.decide" }> = { type: "design.decide", threadId, commentId: "cmt_decision", decision };
  return { row, comparison, publish, target, a, b, op };
}
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-decisions-")); store = new FileStore(dir); await store.init(); desk = new FileDesk(dir); await desk.init(); const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; badgeToken = badge.token; await desk.put(badge.record); engine = new Engine(store, desk); for (const [actor, harness] of [[human, "web"], [agent, "codex"], [other, "web"]] as const) await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `${harness}:${actor.id}`, as: actor.id, name: actor.name } }); await post({ type: "project.create", canvasId, title: "Acme decisions", groupMode: "groups" }, human); await post({ type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_source", body: "Make receiving faster" } }, human); });
afterEach(async () => { await store.close(); await desk.close(); await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); home = "https://example.test"; });
describe("canonical paired adoption", () => {
  it("adopts once, keeps context current, refuses conflicting Undo without consumption, and restores original authorship", async () => {
    const s = await setup(), before = await engine.getSnapshot(canvasId);
    await post(s.op, human, "op_adopt");
    expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq + 1);
    expect((await engine.designRequests(canvasId, home)).requests[0]!.status).toBe("current");
    expect(designComparisonActions((await engine.designDecisions(canvasId, home)).comparisons[0]!, { ...human, kind: "human" })).toEqual({ respond: false, authorities: [] });
    expect((await engine.designDecisions(canvasId, home)).decisions[0]).toMatchObject({ author: human, standing: "effective", status: "current", decision: { input: { authority: { kind: "human-choice", reason: null } } } });
    const blob = await engine.putBlob(canvasId, Buffer.from("Teammate content"), { mimeType: "text/html", filename: "later.html" });
    await post({ type: "item.addVersion", itemId: s.target.itemId, version: { id: "ver_later", ...blob, filename: "later.html" } }, other);
    const later = await engine.getSnapshot(canvasId);
    await expect(engine.undo(canvasId, human, badgeId)).rejects.toThrow(/neither half/);
    expect((await engine.getSnapshot(canvasId)).canvas).toEqual(later.canvas);
    await engine.undo(canvasId, other, badgeId); await engine.undo(canvasId, human, badgeId);
    expect((await engine.designDecisions(canvasId, home)).decisions[0]!.standing).toBe("undone");
    await engine.redo(canvasId, human, badgeId);
    expect((await engine.designDecisions(canvasId, home)).decisions[0]).toMatchObject({ standing: "effective", author: human });
  });
  it("keeps greenfield adoption current and proves full accepted retry identity after Undo", async () => {
    const s = await setup(false), accepted = await post(s.op, human, "op_adopt");
    expect((await engine.designDecisions(canvasId, home)).decisions[0]!.status).toBe("current");
    expect((await engine.designDecisions(canvasId, home)).comparisons[0]!.status).toBe("settled");
    await engine.undo(canvasId, human, badgeId); const before = await engine.getSnapshot(canvasId);
    expect((await post(s.op, human, "op_adopt")).seq).toBe(accepted.seq);
    expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq);
    await expect(post({ ...s.op, decision: { ...s.op.decision, authority: { kind: "human-choice", reason: "Changed meaning" } } }, human, "op_adopt")).rejects.toMatchObject({ code: "design-intent-conflict" });
    await expect(post(s.op, other, "op_adopt")).rejects.toMatchObject({ code: "design-intent-conflict" });
  });
  it("reissues after a changed brief and honors four more options through two consecutive authored batches", async () => {
    const s = await setup();
    await post({ type: "design.request", action: { kind: "update", brief: s.row.ref, epoch: 1, versionId: "ver_updated_brief", patch: { audience: "Acme receiving team" } } });
    await expect(post(s.op, human)).rejects.toThrow(/source changed/);
    const row = (await engine.designRequests(canvasId, home)).requests[0]!;
    const refreshed: DesignComparison = { ...s.comparison, id: "cmp_refreshed", revision: 2, brief: row.ref, supersedes: s.op.decision.source.kind === "comparison" ? s.op.decision.source.source : null };
    await post({ type: "design.compare", threadId, commentId: "cmt_refreshed", comparison: refreshed });
    const source = { threadId, commentId: "cmt_refreshed", payloadId: refreshed.id, revision: 2 };
    await post({ type: "design.respond", threadId, commentId: "cmt_more", response: { schemaVersion: 1, kind: "comparison-response", id: "rsp_more", requestId: refreshed.requestId, epoch: 1, comparison: source, authority: { kind: "human" }, outcome: { kind: "more", count: 4, instruction: "Explore four additional workflows" }, supersedesResponseId: null } }, human);
    let prior = source;
    for (const n of [1, 2]) {
      const comparison: DesignComparison = { ...refreshed, id: `cmp_more${n}`, revision: n + 2, supersedes: prior, followsResponseId: "rsp_more", alternatives: await Promise.all([0, 1].map(async (i) => ({ ...s.comparison.alternatives[i]!, artifact: await add(`itm_more${n}_${i}`, `<title>Acme more ${n} ${i}</title>` ) }))) };
      await post({ type: "design.compare", threadId, commentId: `cmt_more${n}`, comparison });
      prior = { threadId, commentId: `cmt_more${n}`, payloadId: comparison.id, revision: comparison.revision };
    }
    const latest = (await engine.designDecisions(canvasId, home)).comparisons.at(-1)!;
    expect(latest.comparison.followsResponseId).toBe("rsp_more");
    const before = await engine.getSnapshot(canvasId);
    await expect(post({ type: "design.compare", threadId, commentId: "cmt_unrelated", comparison: { ...latest.comparison, id: "cmp_unrelated", revision: 1, supersedes: null } })).rejects.toThrow(/own predecessor chain/);
    expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq);
  });
  it("keeps correction chains exact and never bridges a missing edge or unrelated metadata edit", async () => {
    const s = await setup(); await post(s.op, human);
    const oldSource = s.op.decision.source.kind === "comparison" ? s.op.decision.source.source : null;
    const comparison = { ...s.comparison, id: "cmp_correction", revision: 2, supersedes: oldSource, correctsDecisionId: s.op.decision.id };
    await post({ type: "design.compare", threadId, commentId: "cmt_correction", comparison });
    const snapshot = await engine.getSnapshot(canvasId), target = snapshot.canvas.items[s.target.itemId]!;
    const correction = { ...s.op, commentId: "cmt_corrected", decision: { ...s.op.decision, id: "decision_corrected", source: { kind: "comparison" as const, source: { threadId, commentId: "cmt_correction", payloadId: comparison.id, revision: 2 } }, chosenAlternativeId: "confirm", versionId: "ver_corrected", supersedesDecisionId: s.op.decision.id, basis: { ...s.op.decision.basis, target: { ...s.op.decision.basis.target, artifact: { ...s.target, versionId: target.currentVersionId, blobHash: s.a.blobHash } } } } };
    await post(correction, human);
    const corrected = await engine.getSnapshot(canvasId);
    expect((await engine.designRequests(canvasId, home)).requests[0]!.status).toBe("current");
    expect((await engine.designDecisions(canvasId, home)).decisions.map((r) => r.standing)).toEqual(["superseded", "effective"]);
    expect(designInputTransition(corrected.canvas, s.row.ref.itemId, s.row.brief.requestId, 1, s.target)).toBe(true);
    const missing = structuredClone(corrected.canvas); missing.threads[threadId]!.comments = missing.threads[threadId]!.comments.filter((c) => c.id !== s.op.commentId);
    expect(designInputTransition(missing, s.row.ref.itemId, s.row.brief.requestId, 1, s.target)).toBe(false);
    await post({ type: "item.update", itemId: target.id, patch: { description: "An unrelated teammate change" } }, other);
    expect((await engine.designRequests(canvasId, home)).requests[0]!.status).toBe("stale");
  });
  it("rejects malformed retained metadata and forged canonical pairs without applying either member", async () => {
    const s = await setup(), before = await engine.getSnapshot(canvasId), accepted = await post(s.op, human);
    const canonical = accepted.envelope.op; if (canonical.type !== "design.decide" || !canonical.effect) throw new Error("Missing canonical pair");
    const mutate = (fn: (comment: Comment) => void) => { const comment = structuredClone(canonical.effect!.comment); fn(comment); expect(() => validateDesignDecisionComment(comment, canvasId)).toThrow(); };
    mutate((c) => { c.designReferences = []; });
    mutate((c) => { c.designReferences![0]!.version.visual = { blobHash: "not-a-sha", mimeType: "image/svg+xml", filename: "face.svg", size: 3 }; });
    mutate((c) => { c.designReferences![0]!.version.size = -1; });
    mutate((c) => { c.designReferences![0]!.version.createdBy = { id: "", name: "" }; });
    mutate((c) => { const r = c.designDecision!.record; if (r.kind === "adoption-decision") r.input.basis.alternatives = []; });
    mutate((c) => { const r = c.designDecision!.record; if (r.kind === "adoption-decision") r.input.source = { kind: "comparison", source: { threadId, commentId: "cmt_fake", payloadId: "cmp_fake", revision: 1 } }; });
    const badPair = structuredClone(accepted.envelope); if (badPair.op.type === "design.decide") badPair.op.effect!.threadId = "thr_missing";
    expect(() => applyOperation(before, badPair)).toThrow();
    expect(before.canvas.items[s.target.itemId]!.currentVersionId).toBe(s.target.versionId);
    const unknownEffect = structuredClone(accepted.envelope);
    if (unknownEffect.op.type === "design.decide") Object.assign(unknownEffect.op.effect!.edit, { futureRule: "silently change target" });
    expect(() => applyOperation(before, unknownEffect)).toThrow();
    const replayed = applyOperation(before, accepted.envelope)!;
    expect(replayed.canvas).toEqual((await engine.getSnapshot(canvasId)).canvas);
  });

  it("reserves archived canonical operation IDs against ordinary writes after Undo and GC", async () => {
    const s = await setup(); await post(s.op, human, "op_archived_choice");
    await engine.undo(canvasId, human, badgeId); await engine.undo(canvasId, agent, badgeId);
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    const before = await engine.getSnapshot(canvasId), ordinary: Operation = { type: "item.update", itemId: s.target.itemId, patch: { title: "Reused identity" } };
    await expect(post(ordinary, human, "op_archived_choice")).rejects.toMatchObject({ code: "design-intent-conflict" });
    await expect(engine.submit({ canvasId, actor: human, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES.replace(/,?design-decisions-v1/, ""), op: ordinary, opId: "op_archived_choice" })).rejects.toMatchObject({ code: "design-decisions-required" });
    expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq);
  });

  it("refuses typed delivery and archived collisions through HTTP, sockets and a transparent replica relay", async () => {
    await store.close(); await desk.close();
    const daemon = await startDaemon({ port: 0, home: dir, birthHome: null });
    const address = daemon.app.server.address(); if (!address || typeof address === "string") throw new Error("No daemon port");
    home = `http://127.0.0.1:${address.port}`; engine = daemon.engine;
    const oldFeatures = CURRENT_CLIENT_FEATURES.replace(/,?design-decisions-v1/, ""), headers = { Authorization: `Bearer ${badgeToken}` }, sockets: WebSocket[] = [];
    let relay: Awaited<ReturnType<typeof startDaemon>> | undefined;
    const request = (url: string, body: unknown = undefined, features = CURRENT_CLIENT_FEATURES) => fetch(home + url, { method: body === undefined ? "GET" : "POST", headers: { ...headers, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    try {
      const s = await setup(true, false, false), initial = await engine.getSnapshot(canvasId);
      expect((await request("/api/ops", { canvasId, actor: agent, op: s.publish }, oldFeatures)).status).toBe(426);
      expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(initial.lastSeq);
      const socket = new WebSocket(`${home.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=0&${CLIENT_FEATURES_PARAM}=${encodeURIComponent(oldFeatures)}`, { headers }); sockets.push(socket);
      await new Promise<void>((resolve, reject) => { socket.once("message", () => resolve()); socket.once("error", reject); });
      const messages: unknown[] = []; socket.on("message", (data) => messages.push(JSON.parse(String(data))));
      const closed = new Promise<number>((resolve) => socket.once("close", resolve));
      await post(s.publish); expect(await closed).toBe(WS_STALE_CLIENT); expect(messages).toEqual([]);
      const response = await request("/api/ops", { canvasId, actor: human, op: s.op, opId: "op_http_choice" }); expect(response.status, await response.clone().text()).toBe(200);
      for (const route of [`/api/projects/${canvasId}/canvas`, `/api/projects/${canvasId}/oplog`, `/api/projects/${canvasId}/oplog/archive`]) expect((await request(route, undefined, oldFeatures)).status).toBe(426);
      await engine.undo(canvasId, human, badgeId); await engine.undo(canvasId, agent, badgeId); await engine.gc(canvasId, { keepOps: 0, graceMs: 0 });
      const before = await engine.getSnapshot(canvasId), collision = { canvasId, actor: human, opId: "op_http_choice", op: { type: "item.update", itemId: s.target.itemId, patch: { title: "Identity collision" } } };
      expect((await request("/api/ops", collision, oldFeatures)).status).toBe(426);
      const conflict = await request("/api/ops", collision); expect(conflict.status).toBe(400); expect(await conflict.json()).toMatchObject({ code: "design-intent-conflict" });
      expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(before.lastSeq);
      // Replication understands current state, but must not upgrade the caller's decoder.
      relay = await startDaemon({ port: 0, home: path.join(dir, "relay"), birthHome: null, homePollMs: 50 });
      const relayAddress = relay.app.server.address(); if (!relayAddress || typeof relayAddress === "string") throw new Error("No relay port");
      const relayHome = `http://127.0.0.1:${relayAddress.port}`, relayBadge = await mintTestBadge(relayHome); await relayBadge.speakAs(human, "web:acme-decision-relay");
      const pass = await request(`/api/projects/${canvasId}/passes`, { actorId: human.id }); expect(pass.status).toBe(200); const { token } = await pass.json() as { token: string };
      const redeemed = await fetch(relayHome + "/api/passes/redeem", { method: "POST", headers: { ...relayBadge.headers, "Content-Type": "application/json" }, body: JSON.stringify({ home, token }) }); expect(redeemed.status, await redeemed.clone().text()).toBe(200);
      await expect.poll(() => relay!.store.canvasExists(canvasId)).toBe(true);
      const policy = sourcePolicyHeader({ policy: { mode: "direct", actorId: human.id, intent: "edit" }, expectedHome: home });
      for (const [url, body] of [[`/api/projects/${canvasId}/oplog/archive`, undefined], ["/api/ops", { canvasId, actor: human, opId: "op_http_choice", op: s.op }]] as const) for (const features of [oldFeatures, CURRENT_CLIENT_FEATURES]) {
        const result = await fetch(relayHome + url, { method: body === undefined ? "GET" : "POST", headers: { ...relayBadge.headers, [SOURCE_POLICY_HEADER]: policy, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        expect(result.status, await result.clone().text()).toBe(features === oldFeatures ? 426 : 200); await result.arrayBuffer();
      }
    } finally { for (const socket of sockets) socket.terminate(); await relay?.close(); await daemon.close(); }
  });

  it("preflights the entire grouped Undo when the paired target was edited by a teammate", async () => {
    const s = await setup(), group = "gesture_choose_and_note";
    await engine.submit({ canvasId, actor: human, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES, group, op: s.op });
    await engine.submit({ canvasId, actor: human, badgeId, authoritativeHome: home, clientFeatures: CURRENT_CLIENT_FEATURES, group, op: { type: "thread.reply", threadId, comment: { id: "cmt_group_note", body: "Keep this note with my choice" } } });
    await post({ type: "item.update", itemId: s.target.itemId, patch: { description: "Teammate changed this" } }, other);
    const before = await engine.getSnapshot(canvasId);
    await expect(engine.undo(canvasId, human, badgeId)).rejects.toThrow(/neither half/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
    await engine.undo(canvasId, other, badgeId); await engine.undo(canvasId, human, badgeId);
    const undone = await engine.getSnapshot(canvasId);
    expect(undone.canvas.threads[threadId]!.comments.some((c) => c.id === "cmt_group_note" || c.id === s.op.commentId)).toBe(false);
    expect(undone.canvas.items[s.target.itemId]!.currentVersionId).toBe(s.target.versionId);
  });
  it("retains exact rejected, selected and visual bytes through pruning, trash, GC, restart and archived retry", async () => {
    const s = await setup(), original = await post(s.op, human, "op_retained_decision");
    const row = (await engine.designDecisions(canvasId, home)).decisions[0]!, expected = new Map<string, Buffer>();
    for (const ref of row.references) for (const hash of [ref.version.blobHash, ...(ref.version.visual ? [ref.version.visual.blobHash] : [])]) { const stream = await store.openBlob(canvasId, hash); const chunks: Buffer[] = []; for await (const part of stream!) chunks.push(Buffer.from(part)); expected.set(hash, Buffer.concat(chunks)); }
    expect(new Set(row.references.flatMap((r) => r.version.visual ? [r.version.visual.blobHash] : [])).size).toBe(2);
    await engine.undo(canvasId, agent, badgeId); // The published comparison may be removed independently.
    const later = await engine.putBlob(canvasId, Buffer.from("Later target content"), { mimeType: "text/html", filename: "later.html" });
    await post({ type: "item.addVersion", itemId: s.target.itemId, version: { id: "ver_after_choice", ...later, filename: "later.html" } }, other);
    await post({ type: "item.pruneVersions", itemId: s.target.itemId, keep: 1 }, other);
    for (const itemId of [s.a.itemId, s.b.itemId, s.row.ref.itemId]) await post({ type: "item.delete", itemId }, other);
    await post({ type: "trash.empty" }, other);
    const orphan = await store.putBlob(canvasId, Buffer.from("Acme orphan control"), { mimeType: "text/plain", filename: "orphan.txt" });
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    expect(await store.blobMeta(canvasId, orphan.blobHash)).toBeNull();
    for (const [hash, bytes] of expected) { const stream = await store.openBlob(canvasId, hash); expect(stream).not.toBeNull(); const chunks: Buffer[] = []; for await (const part of stream!) chunks.push(Buffer.from(part)); expect(Buffer.concat(chunks)).toEqual(bytes); }
    expect((await engine.designDecisions(canvasId, home)).decisions[0]).toMatchObject({ standing: "effective", status: "stale", author: human });
    const before = await engine.getSnapshot(canvasId); expect((await post(s.op, human, "op_retained_decision")).seq).toBe(original.seq); expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

  it("refuses incompatible selected MIME and moved target scope without a partial adoption", async () => {
    const s = await setup(true, false, false), text = await add("itm_text", "Acme source notes", "text/plain");
    const comparison = { ...s.comparison, alternatives: [s.comparison.alternatives[0]!, { ...s.comparison.alternatives[1]!, artifact: text }] };
    await post({ type: "design.compare", threadId, commentId: "cmt_comparison", comparison });
    const incompatible = { ...s.op, decision: { ...s.op.decision, chosenAlternativeId: "confirm", basis: { ...s.op.decision.basis, alternatives: [s.a, text] } } };
    let before = await engine.getSnapshot(canvasId);
    await expect(post(incompatible, human)).rejects.toThrow(/selected MIME/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
    const blob = await engine.putBlob(canvasId, Buffer.from("Acme scoped work"), { mimeType: "text/markdown", filename: "scope.md" });
    await post({ type: "group.change", action: { kind: "create", group: { id: "itm_new_scope", title: "Acme scope", version: { id: "ver_new_scope", ...blob, filename: "scope.md" } }, itemIds: [s.target.itemId] } }, other);
    before = await engine.getSnapshot(canvasId);
    await expect(post({ ...incompatible, decision: { ...incompatible.decision, chosenAlternativeId: "continuous" } }, human)).rejects.toThrow(/metadata or scope changed/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

});
