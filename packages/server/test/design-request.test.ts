import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { CURRENT_CLIENT_FEATURES, CANVAS_GROUPS_FEATURE, QUESTIONNAIRES_FEATURE, DESIGN_REQUESTS_REQUIRED, CLIENT_FEATURES_HEADER, CLIENT_FEATURES_PARAM, WS_STALE_CLIENT, SOURCE_POLICY_HEADER, sourcePolicyHeader, type Operation, type Actor, type DesignQuestionSet, type DesignResponse, type DesignReceipt } from "@isocan/core";
import { designIntentHash, type DesignRequestAction, type DesignRequestState, type DesignBriefFields } from "@isocan/core/design-request";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { mintBadge } from "../src/badges.ts";
import { startDaemon } from "../src/daemon.ts";
import { mintTestBadge } from "./badge.ts";

const person = { id: "usr_owner", name: "Acme Owner" }, agent = { id: "usr_builder", name: "Acme Builder" };
const canvasId = "prj_design", authority = "https://example.test", threadId = "thr_source";
let directory: string, store: FileStore, desk: FileDesk, engine: Engine, badgeId: string;
const post = (op: Operation, by: Actor = agent, opId?: string) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor: by, badgeId, authoritativeHome: authority, clientFeatures: CURRENT_CLIENT_FEATURES, op, ...(opId ? { opId } : {}) });
const fields = (): DesignBriefFields => ({ intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: null, primaryTask: "Receive stock", constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [] });
const start = (kind: "canvas-chat" | "external-agent" = "canvas-chat"): Extract<Operation, { type: "design.request" }> => ({ type: "design.request", action: { kind: "start", requestId: "req_receiving", itemId: "itm_brief", versionId: "ver_brief", admission: "explicit", source: kind === "canvas-chat" ? { entrance: kind, threadId, commentId: "cmt_source" } : { entrance: kind, externalRequestId: "external_acme" }, fields: fields() } });
const read = async () => (await engine.designRequests(canvasId, authority)).requests[0]!;
const change = (state: DesignRequestState, kind: "update" | "cancel" | "complete", versionId: string, patch?: Partial<DesignBriefFields>): Operation => ({ type: "design.request", action: { kind, brief: state.ref, epoch: state.brief.epoch, versionId, ...(patch ? { patch } : {}) } as DesignRequestAction });
async function add(itemId: string, versionId: string, text: string, mimeType = "text/html") {
  const bytes = Buffer.from(text), blob = await engine.putBlob(canvasId, bytes, { mimeType, filename: `${versionId}.html` });
  await post({ type: "item.add", itemId, version: { id: versionId, ...blob, filename: `${versionId}.html` }, title: "Acme artifact", width: 320, height: 240, placement: { x: 400, y: 0 } });
  return { home: authority, canvasId, itemId, versionId, blobHash: blob.blobHash };
}
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-design-request-"));
  store = new FileStore(directory); await store.init(); desk = new FileDesk(directory); await desk.init();
  const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; await desk.put(badge.record);
  engine = new Engine(store, desk);
  for (const [actor, harness] of [[person, "web"], [agent, "codex"]] as const) await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `${harness}:acme`, as: actor.id, name: actor.name } });
  await post({ type: "project.create", canvasId, title: "Acme design", groupMode: "groups" }, person);
  await post({ type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_source", body: "Build a receiving app" } }, person);
});
afterEach(async () => { await store.close(); await desk.close(); await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

describe("canonical request lifecycle", () => {
  it("admits and reads through a real daemon while refusing an old request decoder", async () => {
    const daemon = await startDaemon({ home: directory, port: 0, contentPort: "off", birthHome: null, servesWorld: true });
    try {
      const base = `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}`;
      const badge = await mintTestBadge(base), by = { id: "usr_http_agent", name: "Acme HTTP" };
      await badge.speakAs(by, "codex:http");
      const op = start("external-agent");
      const headers = { ...badge.headers, "content-type": "application/json", "x-isocan-features": CURRENT_CLIENT_FEATURES };
      const sent = await fetch(`${base}/api/ops`, { method: "POST", headers, body: JSON.stringify({ canvasId, actor: by, opId: "op_http_start", op }) });
      expect(sent.status, await sent.clone().text()).toBe(200);
      const read = await fetch(`${base}/api/projects/${canvasId}/design/requests`, { headers });
      expect(read.status, await read.clone().text()).toBe(200);
      expect(await read.json()).toMatchObject({ requests: [{ brief: { source: { entrance: "external-agent" }, requestingActorId: by.id } }] });
      const old = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: { ...headers, "x-isocan-features": "canvas-groups-v4,questionnaires-v1" } });
      expect(old.status).toBe(426);
    } finally { await daemon.close(); }
  });
  it("refuses old typed writes, actual receipts and inverses, socket delivery and transparent relay upgrades", async () => {
    const daemon = await startDaemon({ home: directory, port: 0, contentPort: "off", birthHome: null });
    const base = `http://127.0.0.1:${(daemon.app.server.address() as { port: number }).port}`;
    const badge = await mintTestBadge(base), by = { id: "usr_http_agent", name: "Acme HTTP" };
    await badge.speakAs(by, "codex:transport");
    const oldFeatures = `${CANVAS_GROUPS_FEATURE},${QUESTIONNAIRES_FEATURE}`, sockets: WebSocket[] = [];
    let relay: Awaited<ReturnType<typeof startDaemon>> | undefined;
    async function request(url: string, body?: unknown, features = CURRENT_CLIENT_FEATURES) {
      return fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { ...badge.headers, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    function connect(since: number, features: string) {
      const socket = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=${since}&${CLIENT_FEATURES_PARAM}=${encodeURIComponent(features)}`, { headers: badge.headers }); sockets.push(socket); return socket;
    }
    try {
      const op = start("external-agent"), body = { canvasId, actor: by, opId: "op_transport_start", op };
      expect((await request("/api/ops", body, oldFeatures)).status).toBe(426);
      const old = connect(0, oldFeatures), oldMessages: { type: string }[] = [];
      await new Promise<void>((resolve, reject) => { old.on("message", (data) => { oldMessages.push(JSON.parse(String(data))); resolve(); }); old.on("error", reject); });
      const closed = new Promise<number>((resolve, reject) => { old.on("close", resolve); old.on("error", reject); });
      const accepted = await request("/api/ops", body); expect(accepted.status, await accepted.clone().text()).toBe(200);
      expect(await closed).toBe(WS_STALE_CLIENT);
      expect(oldMessages.some((m) => m.type === "op-applied")).toBe(false);
      expect((await request("/api/ops", body, oldFeatures)).status).toBe(426);
      const collision = { ...body, op: { type: "thread.reply", threadId, comment: { id: "cmt_collision", body: "Unrelated" } } };
      expect((await request("/api/ops", collision, oldFeatures)).status).toBe(426);
      expect((await request("/api/ops", collision)).status).toBe(400);
      expect((await request(`/api/projects/${canvasId}/undo`, { actor: by }, oldFeatures)).status).toBe(426);
      const undone = await request(`/api/projects/${canvasId}/undo`, { actor: by }); expect(undone.status, await undone.clone().text()).toBe(200);
      expect((await request(`/api/projects/${canvasId}/redo`, { actor: by }, oldFeatures)).status).toBe(426);
      const redone = await request(`/api/projects/${canvasId}/redo`, { actor: by }); expect(redone.status, await redone.clone().text()).toBe(200);
      for (const url of [`/api/projects/${canvasId}/canvas`, `/api/projects/${canvasId}/oplog`, `/api/projects/${canvasId}/oplog/archive`, `/api/projects/${canvasId}/design/requests`]) {
        const denied = await request(url, undefined, oldFeatures); expect(denied.status, url).toBe(426); expect(await denied.json()).toMatchObject({ code: DESIGN_REQUESTS_REQUIRED });
      }
      for (const since of [0, 1]) {
        const socket = connect(since, oldFeatures), messages: unknown[] = []; socket.on("message", (data) => messages.push(JSON.parse(String(data))));
        expect(await new Promise<number>((resolve, reject) => { socket.on("close", resolve); socket.on("error", reject); })).toBe(WS_STALE_CLIENT); expect(messages).toEqual([]);
      }
      const current = connect(1, CURRENT_CLIENT_FEATURES);
      expect(await new Promise<string>((resolve, reject) => { current.on("message", (data) => { const m = JSON.parse(String(data)); if (m.entry?.envelope.op.type === "design.request") resolve(m.entry.envelope.op.type); }); current.on("error", reject); })).toBe("design.request");
      relay = await startDaemon({ home: path.join(directory, "relay"), port: 0, contentPort: "off", birthHome: null, homePollMs: 50 });
      const relayBase = `http://127.0.0.1:${(relay.app.server.address() as { port: number }).port}`, relayBadge = await mintTestBadge(relayBase);
      await relayBadge.speakAs(by, "codex:relay");
      const pass = await request(`/api/projects/${canvasId}/passes`, { actorId: by.id }); expect(pass.status, await pass.clone().text()).toBe(200);
      const { token } = await pass.json() as { token: string };
      const redeemed = await fetch(`${relayBase}/api/passes/redeem`, { method: "POST", headers: { ...relayBadge.headers, "content-type": "application/json" }, body: JSON.stringify({ home: base, token }) }); expect(redeemed.status, await redeemed.clone().text()).toBe(200);
      await expect.poll(() => relay!.store.canvasExists(canvasId)).toBe(true);
      const policy = sourcePolicyHeader({ policy: { mode: "direct", actorId: by.id, intent: "edit" }, expectedHome: base });
      for (const [url, value] of [[`/api/projects/${canvasId}/canvas`, undefined], [`/api/projects/${canvasId}/design/requests`, undefined], ["/api/oplog/watch", { only: [canvasId], cursors: { [canvasId]: 0 }, waitMs: 0 }], ["/api/ops", body]] as const) for (const features of [oldFeatures, CURRENT_CLIENT_FEATURES]) {
        const result = await fetch(relayBase + url, { method: value === undefined ? "GET" : "POST", headers: { ...relayBadge.headers, [SOURCE_POLICY_HEADER]: policy, [CLIENT_FEATURES_HEADER]: features, ...(value === undefined ? {} : { "content-type": "application/json" }) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
        expect(result.status, await result.clone().text()).toBe(features === oldFeatures ? 426 : 200); await result.arrayBuffer();
      }
    } finally { for (const socket of sockets) socket.terminate(); await relay?.close(); await daemon.close(); }
  });
  it("materializes one group-aware JSON record, actual requester and stable authenticated intent", async () => {
    const op = start(); const entry = await post(op, agent, "op_start");
    expect(entry.envelope.op.type).toBe("design.request");
    const state = await read();
    expect(state.brief).toMatchObject({ requestingActorId: person.id, progress: "active", epoch: 1, continuation: { scopeCapture: { kind: "current-ambient" }, factProvenance: expect.arrayContaining([{ field: "audience", actorId: agent.id, kind: "reported" }]) } });
    expect(state.marker.intentHash).toBe(await designIntentHash(op, agent.id));
    expect(await post(op, agent, "op_retry")).toEqual(entry);
    expect((await engine.getSnapshot(canvasId)).lastSeq).toBe(entry.seq);
    const changed = start(); if (changed.action.kind === "start") changed.action.fields.primaryTask = "Another task";
    await expect(post(changed, agent, "op_start")).rejects.toThrow(/conflict/);
    await expect(post(op, person, "op_start")).rejects.toThrow(/conflict/);
  });
  it("admits selected Markdown source context while retaining only the original public actor identity", async () => {
    const content = Buffer.from("Acme design context: preserve the existing green controls.");
    const blob = await engine.putBlob(canvasId, content, { mimeType: "text/markdown", filename: "context.md" });
    const boundActor = { ...person, key: "web:acme-local-binding" };
    await post({ type: "item.add", itemId: "itm_context", title: "Acme context", version: { id: "ver_context", ...blob, filename: "context.md" }, placement: { x: 400, y: 0 }, width: 320, height: 200 }, boundActor);
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_selected", body: "Build an inventory app", contextRequest: { rootIds: ["itm_context"] } } }, person);
    const op = start(); if (op.action.kind === "start") op.action.source = { entrance: "canvas-chat", threadId, commentId: "cmt_selected" };
    await post(op); const admitted = await read();
    expect(admitted.status).toBe("current");
    expect(admitted.brief.continuation!.scopeCapture.kind).toBe("source-comment");
    expect(admitted.brief.context.entries[0]!.version!.createdBy).toEqual(person);
    expect(admitted.marker.retainedReferences[0]!.version).toMatchObject({ id: "ver_context", blobHash: blob.blobHash, createdBy: person });
    expect(admitted.marker.retainedReferences[0]!.version.createdBy).toEqual(person);
    engine = new Engine(store, desk); expect((await read()).marker).toEqual(admitted.marker);
  });
  it("enforces shared automatic policy and retains explicit starts while off", async () => {
    const op = start(); if (op.action.kind === "start") op.action.admission = "automatic";
    await expect(post(op)).rejects.toThrow(/off or unsupported/);
    await post({ type: "project.update", patch: { properties: { "design.workflow": "future" } } }, person);
    await expect(post(op)).rejects.toThrow(/off or unsupported/);
    await post({ type: "project.update", patch: { properties: { "design.workflow": "adaptive-v1" } } }, person);
    await post(op); expect((await read()).brief.requestId).toBe("req_receiving");
  });
  it("refuses changed source and current cancellation, then deliberately resumes or restores through undo", async () => {
    const original = await post(start(), agent, "op_start"); const first = await read();
    await post(change(first, "cancel", "ver_cancel"), person);
    await expect(post(change(first, "update", "ver_late", { audience: "Staff" }))).rejects.toThrow(/changed/);
    expect(await post(start(), agent, "op_start")).toEqual(original);
    await engine.undo(canvasId, person, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    expect((await read()).status).toBe("current");
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_other_cancel", body: "/cancel" } }, agent);
    expect((await read()).status).toBe("current");
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_cancel", body: "/cancel" } }, person);
    expect((await read()).status).toBe("cancelled");
    await expect(post(change(first, "update", "ver_blocked"))).rejects.toThrow(/cancelled/);
    await post({ type: "design.request", action: { kind: "resume", brief: first.ref, epoch: 1, versionId: "ver_resume", reason: "Continue deliberately" } }, person);
    const resumed = await read(); expect(resumed.brief.epoch).toBe(2);
    await post({ type: "comment.update", threadId, commentId: "cmt_source", body: "Build stock lookup instead" }, person);
    await expect(post(change(resumed, "update", "ver_source_changed"))).rejects.toThrow(/text changed/);
  });
  it("preserves external authorship while attributing a human correction to its actual editor", async () => {
    const native = start("external-agent"); if (native.action.kind === "start") native.action.fields.facts = [{ id: "density", name: "Density", value: "Compact", origin: "supplied", sources: [] }, { id: "input", name: "Input", value: "Keyboard", origin: "supplied", sources: [] }];
    await post(native); const first = await read();
    expect(first.brief.requestingActorId).toBe(agent.id);
    await post(change(first, "update", "ver_correction", { audience: "Warehouse staff", facts: first.brief.facts.map((fact) => fact.id === "density" ? { ...fact, value: "Comfortable" } : fact) }), person);
    const next = await read();
    expect(next.brief.requestingActorId).toBe(agent.id);
    expect(next.brief.source.entrance).toBe("external-agent");
    expect(next.brief.continuation!.factProvenance).toContainEqual({ field: "audience", actorId: person.id, kind: "direct" });
    expect(next.brief.continuation!.factProvenance).toContainEqual({ field: "facts.density", actorId: person.id, kind: "direct" });
    expect(next.brief.continuation!.factProvenance).toContainEqual({ field: "facts.input", actorId: agent.id, kind: "reported" });
    const item = (await engine.getSnapshot(canvasId)).canvas.items[first.ref.itemId]!;
    await expect(post({ type: "item.addVersion", itemId: item.id, version: { id: "forged", blobHash: first.ref.blobHash, mimeType: "application/json", filename: "fake.json", size: item.versions[0]!.size } })).rejects.toThrow(/design.request/);
    await expect(post({ type: "item.add", itemId: "forged", version: { ...item.versions[0]!, id: "fake" }, width: 100, height: 100, placement: { x: 0, y: 0 } })).rejects.toThrow(/writer-owned/);
  });
  it("requires discovery metadata and one initial batch, preserving allowance through archive and resume", async () => {
    await post(start()); const first = await read();
    const questions: DesignQuestionSet = { schemaVersion: 1, kind: "questions", requestId: first.brief.requestId, epoch: 1, id: "qs_first", revision: 1, brief: first.ref, respondentActorId: person.id, headline: "Who receives stock?", inferredAnswers: [], supersedes: null, questions: [{ id: "audience", title: "Who uses this?", consequence: "Controls density", renderer: "freeform", options: [], multiple: false, skippable: true, delegatable: true }] };
    await expect(post({ type: "questionnaire.ask", threadId, commentId: "cmt_invalid", questions })).rejects.toThrow(/discovery/);
    questions.discovery = { purpose: "initial", factBindings: [{ questionId: "audience", factId: "audience" }] };
    const legacy = await add("itm_legacy_brief", "ver_legacy_brief", JSON.stringify(first.brief), "application/json");
    await post({ type: "questionnaire.ask", threadId, commentId: "cmt_legacy_q", questions: { ...questions, id: "qs_legacy", brief: legacy } });
    expect((await read()).remainingInitialQuestions).toBe(3);
    await post({ type: "questionnaire.ask", threadId, commentId: "cmt_q", questions });
    expect((await read()).remainingInitialQuestions).toBe(0);
    await expect(post({ type: "questionnaire.ask", threadId, commentId: "cmt_repeat", questions: { ...questions, id: "qs_repeat" } })).rejects.toThrow(/one batch/);
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    expect((await read()).remainingInitialQuestions).toBe(0);
    await post({ type: "design.request", action: { kind: "resume", brief: first.ref, epoch: 1, versionId: "ver_discovery_resume", reason: "Continue the same request" } });
    const resumed = await read();
    await expect(post({ type: "questionnaire.ask", threadId, commentId: "cmt_again", questions: { ...questions, id: "qs_after_resume", epoch: 2, brief: resumed.ref } })).rejects.toThrow(/one batch/);
  });
  it("reconciles a whole settled batch after a brief correction while preserving exact answer custody", async () => {
    await post(start()); const first = await read();
    const questions: DesignQuestionSet = { schemaVersion: 1, kind: "questions", requestId: first.brief.requestId, epoch: 1, id: "qs_settled", revision: 1, brief: first.ref, respondentActorId: person.id, headline: "Two material details", inferredAnswers: [], supersedes: null, discovery: { purpose: "initial", factBindings: [{ questionId: "who", factId: "audience" }, { questionId: "task", factId: "primaryTask" }] }, questions: ["who", "task"].map((id) => ({ id, title: id, consequence: "Sets the screen", renderer: "freeform", options: [], multiple: false, skippable: true, delegatable: true })) };
    await post({ type: "questionnaire.ask", threadId, commentId: "cmt_settled", questions });
    const source = { threadId, commentId: "cmt_settled", payloadId: questions.id, revision: 1 };
    const response = (id: string, questionId: string, text: string): DesignResponse => ({ schemaVersion: 1, kind: "response", requestId: first.brief.requestId, epoch: 1, id, question: source, respondentActorId: person.id, resolutions: [{ questionId, state: "answered", value: { kind: "text", text } }], supersedesResponseId: null });
    await post({ type: "questionnaire.answer", threadId, commentId: "cmt_who", response: response("response_who", "who", "Warehouse staff") }, person);
    const accepted = ["response_who", "response_task"].map((responseId) => ({ question: source, responseId }));
    const reconciliation = (state: DesignRequestState, responses = accepted): Operation => ({ type: "design.request", action: { kind: "update", brief: state.ref, epoch: 1, versionId: "ver_reconciled", patch: { audience: "Warehouse staff", primaryTask: "Receive a delivery" }, acceptedResponses: responses } });
    await expect(post(reconciliation(first, accepted.slice(0, 1)))).rejects.toThrow(/settled batch/);
    await post({ type: "questionnaire.answer", threadId, commentId: "cmt_task", response: response("response_task", "task", "Receive a delivery") }, person);
    await post(change(first, "update", "ver_plain_correction", { constraints: ["Keyboard supported"] }), person);
    const corrected = await read(); expect(corrected.questions[0]?.status).toBe("stale");
    await expect(post(reconciliation(corrected, accepted.slice(0, 1)))).rejects.toThrow(/every effective response/);
    await post({ type: "comment.update", threadId, commentId: "cmt_settled", body: "Question text changed" }, agent);
    await expect(post(reconciliation(corrected))).rejects.toThrow(/settled batch/);
    await engine.undo(canvasId, agent, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    await post(reconciliation(corrected)); const reconciled = await read();
    expect(reconciled.brief.continuation!.acceptedResponses).toEqual(accepted);
    expect(reconciled.brief.continuation!.factProvenance).toContainEqual({ field: "audience", actorId: person.id, kind: "questionnaire", responseId: "response_who" });
  });
  it("retains two historical versions and their visual faces through prune, GC, restart and undo restoration", async () => {
    const refs = [], exactBytes = new Map<string, Buffer>();
    for (let index = 1; index <= 2; index++) {
      const source = await engine.putBlob(canvasId, Buffer.from(`Acme source ${index}`), { mimeType: "text/plain", filename: `source${index}.txt` });
      const visual = await engine.putBlob(canvasId, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${index}</text></svg>`), { mimeType: "image/svg+xml", filename: `face${index}.svg` });
      const version = { id: `ver_ref${index}`, ...source, filename: `source${index}.txt`, visual };
      if (index === 1) await post({ type: "item.add", itemId: "itm_reference", title: "Acme reference", width: 100, height: 100, placement: { x: 800, y: 0 }, version });
      else await post({ type: "item.addVersion", itemId: "itm_reference", version });
      refs.push({ home: authority, canvasId, itemId: "itm_reference", versionId: version.id, blobHash: source.blobHash }); exactBytes.set(source.blobHash, Buffer.from(`Acme source ${index}`)); exactBytes.set(visual.blobHash, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><text>${index}</text></svg>`));
    }
    const op = start(); if (op.action.kind === "start") { op.action.fields.references = refs.map((artifact, i) => ({ id: `reference${i}`, state: "fetched", artifact })); op.action.contextRequest = { rootIds: [] }; }
    const original = await post(op, agent, "op_retained_start"); const first = await read();
    await engine.undo(canvasId, agent, badgeId, undefined, CURRENT_CLIENT_FEATURES); await engine.redo(canvasId, agent, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    expect((await read()).marker).toEqual(first.marker);
    await post({ type: "item.pruneVersions", itemId: "itm_reference", keep: 1 }); await post({ type: "item.delete", itemId: "itm_reference" }); await post({ type: "trash.empty" });
    const orphan = await store.putBlob(canvasId, Buffer.from("Acme unreachable bytes"), { mimeType: "text/plain", filename: "orphan.txt" });
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    expect(await store.blobMeta(canvasId, orphan.blobHash)).toBeNull();
    for (const [hash, expected] of exactBytes) { const stream = await store.openBlob(canvasId, hash); expect(stream).not.toBeNull(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); expect(Buffer.concat(chunks)).toEqual(expected); }
    const retained = await read(); expect(retained.status).toBe("current"); expect(retained.marker.retainedReferences).toHaveLength(2); expect(retained.marker.retainedReferences.every((r) => !("designRecord" in r.version) && r.version.visual?.filename)).toBe(true);
    expect(await post(op, agent, "op_retained_start")).toEqual(original);
    await post(change(retained, "update", "ver_retained_update", { audience: "Acme staff" })); expect((await read()).marker.retainedReferences).toEqual(retained.marker.retainedReferences);
  });
  it("publishes attributed draft evidence for completed output and detects output drift", async () => {
    await post(start()); const first = await read(), output = await add("itm_output", "ver_output", "<button>Receive</button>");
    await post(change(first, "complete", "ver_complete", { outputIds: [output.itemId] }));
    const complete = await read(), context = await add("itm_context", "ver_context", "Acme context", "text/plain");
    const receipt: DesignReceipt = { schemaVersion: 1, kind: "receipt", requestId: complete.brief.requestId, epoch: 1, id: "receipt_draft", brief: complete.ref, output: { kind: "canvas", artifact: output }, context: [context], fidelity: "designed", status: "draft", governing: { atItemId: output.itemId, artifact: null, explicitNone: false }, checks: [{ id: "source", kind: "source", tool: "Acme source", toolVersion: "1", result: "passed", coverage: "Source inspection", state: "receiving", viewport: null, evidence: [] }, { id: "browser", kind: "browser-task", tool: "Acme browser", toolVersion: "1", result: "unavailable", coverage: "No browser capability", state: "receiving", viewport: null, evidence: [] }], unresolved: [] };
    await post({ type: "design.receipt", itemId: "itm_receipt", versionId: "ver_receipt", receipt });
    expect((await read()).receipts[0]).toMatchObject({ status: "current", receipt: { status: "draft" }, author: agent });
    const changedContext = await engine.putBlob(canvasId, Buffer.from("Changed context"), { mimeType: "text/plain", filename: "changed.txt" });
    await post({ type: "item.addVersion", itemId: context.itemId, version: { id: "ver_context2", ...changedContext, filename: "changed.txt" } });
    expect((await read()).receipts[0]).toMatchObject({ status: "stale", checkFreshness: [{ checkId: "source", status: "stale" }, { checkId: "browser", status: "current" }] });
    const blob = await engine.putBlob(canvasId, Buffer.from("<button>Changed</button>"), { mimeType: "text/html", filename: "changed.html" });
    await post({ type: "item.addVersion", itemId: output.itemId, version: { id: "ver_changed", ...blob, filename: "changed.html" } });
    expect((await read()).receipts[0]).toMatchObject({ status: "stale", checkFreshness: [{ status: "stale" }, { status: "stale" }] });
    await store.deleteBlobs(canvasId, [output.blobHash]);
    expect((await read()).receipts[0]).toMatchObject({ status: "unavailable", checkFreshness: [{ status: "unavailable" }, { status: "unavailable" }] });
  });
});
