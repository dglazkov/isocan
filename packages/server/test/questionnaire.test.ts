import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";
import { startDaemon } from "../src/daemon.ts";
import { mintTestBadge } from "./badge.ts";
import { CURRENT_CLIENT_FEATURES, CANVAS_GROUPS_FEATURE, CLIENT_FEATURES_HEADER, CLIENT_FEATURES_PARAM, WS_STALE_CLIENT, QUESTIONNAIRES_REQUIRED, SOURCE_POLICY_HEADER, sourcePolicyHeader, blobsNamedBy, type Actor, type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignResponse, type Operation } from "@isocan/core";
import { questionnaireStates, legacyQuestionSet, parseLegacyQuestionnaire } from "@isocan/core/questionnaire";
import { Engine } from "../src/engine.ts";
import { FileStore } from "../src/file-store.ts";
import { FileDesk } from "../src/file-desk.ts";
import { mintBadge } from "../src/badges.ts";
import { questionnaireActorKind } from "../src/questionnaire.ts";
import { questionnaireOperation, requireQuestionnaireClient } from "../src/questionnaire-capability.ts";

const actor = { id: "usr_person", name: "Acme Person" }, agent = { id: "usr_designer", name: "Acme Designer" }, other = { id: "usr_helper", name: "Acme Helper" };
const canvasId = "prj_questionnaire", authoritativeHome = "https://example.test", threadId = "thr_request";
let home: string, store: FileStore, desk: FileDesk, engine: Engine, badgeId: string, otherBadge: string;
let brief: DesignBrief, questions: DesignQuestionSet;
const post = (op: Operation, by: Actor = actor, opId?: string, badge = badgeId) => engine.submit({ canvasId: op.type === "project.create" ? null : canvasId, actor: by, badgeId: badge, clientFeatures: CURRENT_CLIENT_FEATURES, authoritativeHome, op, ...(opId ? { opId } : {}) });
const askOp = () => ({ type: "questionnaire.ask" as const, threadId, commentId: "cmt_questions", questions: structuredClone(questions) });
const answer = (): DesignResponse => ({ schemaVersion: 1, kind: "response", id: "answer_inventory", requestId: brief.requestId, epoch: brief.epoch, question: { threadId, commentId: "cmt_questions", payloadId: questions.id, revision: questions.revision }, respondentActorId: actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["batch"] } }], supersedesResponseId: null });
const answerOp = () => ({ type: "questionnaire.answer" as const, threadId, commentId: "cmt_answer", response: answer() });
async function version(id: string, bytes: Buffer, mimeType = "application/json", visual?: Buffer) {
  const blob = await store.putBlob(canvasId, bytes, { mimeType, filename: `${id}.txt` });
  const face = visual && await store.putBlob(canvasId, visual, { mimeType: "image/png", filename: `${id}.png` });
  return { id, blobHash: blob.blobHash, mimeType, filename: `${id}.txt`, size: bytes.length, ...(face ? { visual: { blobHash: face.blobHash, mimeType: "image/png" } } : {}) };
}
async function bytes(backing: FileStore, hash: string) {
  const stream = await backing.openBlob(canvasId, hash); if (!stream) throw new Error("missing blob");
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks);
}
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-questionnaire-core-"));
  store = new FileStore(home); await store.init(); desk = new FileDesk(home); await desk.init();
  const badge = mintBadge("bearer"); badgeId = badge.record.badgeId; await desk.put(badge.record);
  const second = mintBadge("bearer"); otherBadge = second.record.badgeId; await desk.put(second.record);
  engine = new Engine(store, desk);
  await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "web:acme", as: actor.id, name: actor.name } });
  await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "codex:acme", as: agent.id, name: agent.name } });
  await engine.claim({ badgeId: otherBadge, op: { type: "actor.claim", sessionKey: "codex:helper", as: other.id, name: other.name } });
  await post({ type: "project.create", canvasId, title: "Acme questionnaire" });
  await post({ type: "thread.create", threadId, anchorItemId: null, x: 0, y: 0, main: true, comment: { id: "cmt_request", body: "Create an inventory screen" } });
  brief = { schemaVersion: 1, kind: "brief", requestId: "req_acme_inventory", epoch: 1, requestingActorId: actor.id, source: { entrance: "canvas-chat", threadId, commentId: "cmt_request" }, progress: "active", intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: "Receiving staff", primaryTask: "Receive stock", constraints: [], facts: [], context: { canvasId, revision: 2, rootIds: [], expandedIds: [], includeExcluded: false, ambient: true, entries: [], counts: { included: 0, excluded: 0, unavailable: 0 } }, references: [], outstandingDecisionIds: ["workflow"], outputIds: [] };
  const v = await version("ver_brief", Buffer.from(JSON.stringify(brief)));
  await post({ type: "item.add", itemId: "itm_brief", title: "Acme brief", width: 200, height: 200, placement: { x: 0, y: 0 }, version: v }, agent);
  questions = { schemaVersion: 1, kind: "questions", requestId: brief.requestId, epoch: 1, id: "qset_acme", revision: 1, brief: { home: authoritativeHome, canvasId, itemId: "itm_brief", versionId: v.id, blobHash: v.blobHash }, respondentActorId: actor.id, headline: "Choose the receiving flow", inferredAnswers: [], supersedes: null, questions: [{ id: "workflow", title: "When should review happen?", consequence: "Changes the confirmation step", renderer: "choice-list", options: [{ id: "batch", title: "Review a batch", consequence: "Fewer taps" }, { id: "each", title: "Review each item", consequence: "Earlier correction" }], multiple: false, skippable: true, delegatable: true }] };
});
afterEach(async () => { await desk.close(); await store.close(); await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

describe("serialized questionnaire authority and retry", () => {
  it("derives known respondent eligibility, rejects custody/actor/option errors, and never records refused writes", async () => {
    expect((await engine.designRespondents(canvasId)).actors).toEqual(expect.arrayContaining([{ ...actor, kind: "human" }, { ...agent, kind: "agent" }]));
    expect(questionnaireActorKind({ names: {}, colors: {}, joined: {}, harnesses: {} }, "usr_unknown")).toBe("unknown");
    expect(questionnaireActorKind({ names: {}, colors: {}, harnesses: { usr_legacy_relay: "replica" } }, "usr_legacy_relay")).toBe("unknown");
    const start = await engine.getSnapshot(canvasId);
    await expect(post({ ...askOp(), questions: { ...questions, respondentActorId: "usr_unknown" } }, agent)).rejects.toMatchObject({ code: "bad-op" });
    expect(await engine.getSnapshot(canvasId)).toEqual(start);
    await post(askOp(), agent, "op_ask");
    const before = await engine.getSnapshot(canvasId);
    await expect(post(answerOp(), other, "op_wrong", otherBadge)).rejects.toMatchObject({ code: "bad-op" });
    await expect(post(answerOp(), actor, "op_stolen", otherBadge)).rejects.toThrow();
    const bad = answerOp(); bad.response.resolutions = [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["removed"] } }];
    await expect(post(bad)).rejects.toMatchObject({ code: "bad-op" });
    bad.response.resolutions = [{ questionId: "workflow", state: "delegated", agentActorId: "usr_unknown" }];
    await expect(post(bad)).rejects.toMatchObject({ code: "bad-op" });
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
  });

  it("keeps actual human and agent provenance through relay claims while a relay-only actor remains unknown", async () => {
    for (const person of [actor, agent]) {
      await engine.endowClaim(otherBadge, person, canvasId);
      await engine.claim({ badgeId: otherBadge, op: { type: "actor.claim", sessionKey: `replica:${person.id}`, as: person.id, name: person.name } });
    }
    const relayOnly = { id: "usr_relay_only", name: "Acme Relay" };
    await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: `replica:${relayOnly.id}`, as: relayOnly.id, name: relayOnly.name } });
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_relay_only", body: "A relay reported progress" } }, relayOnly);
    expect((await engine.designRespondents(canvasId)).actors).toEqual(expect.arrayContaining([{ ...actor, kind: "human" }, { ...agent, kind: "agent" }, { ...relayOnly, kind: "unknown" }]));
    await post(askOp(), agent); await post(answerOp());
    engine = new Engine(store, desk);
    expect((await engine.designRespondents(canvasId)).actors).toEqual(expect.arrayContaining([{ ...actor, kind: "human" }, { ...agent, kind: "agent" }, { ...relayOnly, kind: "unknown" }]));
  });

  it("refuses metadata smuggling before both normal writes and matching-op-id receipts", async () => {
    const ask = askOp(); await post(ask, agent, "op_ask");
    const state = await engine.getSnapshot(canvasId);
    const saved = state.canvas.threads[threadId]!.comments.at(-1)!;
    const variants = [
      { type: "thread.reply", threadId, comment: { id: "cmt_smuggle", body: "Fake", design: questions } },
      { type: "comment.update", threadId, commentId: saved.id, body: "Fake", designReferences: saved.designReferences },
      { ...ask, retainedReferences: saved.designReferences },
      { ...ask, context: null },
      { ...ask, legacySource: null },
      { ...ask, legacySource: false },
      { ...ask, questions: { ...questions, silentApproval: true } },
    ];
    for (const op of variants) await expect(post(op as Operation, agent, "op_ask")).rejects.toMatchObject({ code: "bad-op" });
    await expect(post({ type: "comment.restore", threadId, comment: saved, index: 0 } as Operation, agent)).rejects.toMatchObject({ code: "internal-op" });
    expect(await engine.getSnapshot(canvasId)).toEqual(state);
  });

  it("retries identical accepted work after completion, cancellation, joins and archive without accepting changed intent", async () => {
    await post(askOp(), agent, "op_ask");
    const original = await post(answerOp(), actor, "op_answer");
    const before = await engine.getSnapshot(canvasId);
    expect(await post(answerOp(), actor, "op_different_retry")).toEqual(original);
    const changed = answerOp(); changed.response.resolutions = [{ questionId: "workflow", state: "skipped" }];
    await expect(post(changed, actor, "op_answer")).rejects.toThrow(/conflict/);
    await expect(post(answerOp(), other, "op_answer", otherBadge)).rejects.toThrow(/conflict/);
    await expect(post({ ...answerOp(), commentId: "cmt_different" }, actor, "op_answer")).rejects.toThrow(/conflict/);
    expect(await engine.getSnapshot(canvasId)).toEqual(before);
    const joined = { id: "usr_person_joined", name: "Acme Joined" };
    await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "web:joined", as: joined.id, name: joined.name } });
    await engine.joinActors({ badgeId, actor: joined, op: { type: "actor.join", from: actor.id, into: joined.id } });
    expect(await post(answerOp(), joined, "op_answer")).toEqual(original);
    for (const progress of ["completed", "cancelled"] as const) {
      await post({ type: "item.addVersion", itemId: "itm_brief", version: await version(`ver_${progress}`, Buffer.from(JSON.stringify({ ...brief, progress }))) }, agent);
      expect(await post(answerOp(), joined, "op_answer")).toEqual(original);
    }
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 }); engine = new Engine(store, desk);
    const compacted = await engine.getSnapshot(canvasId);
    expect(await post(answerOp(), joined, "op_answer")).toEqual(original);
    await expect(post(changed, joined, "op_answer")).rejects.toThrow(/conflict/);
    expect(await engine.getSnapshot(canvasId)).toEqual(compacted);
    expect(questionnaireStates(compacted.canvas)[0]).toMatchObject({ status: "stale", responses: [{ author: actor }] });
  });

  it("lets a joined intended respondent answer while preserving original actor IDs and one undo/redo", async () => {
    await post(askOp(), agent, "op_ask");
    const joined = { id: "usr_joined", name: "Acme Joined" };
    await engine.claim({ badgeId, op: { type: "actor.claim", sessionKey: "web:joined", as: joined.id, name: joined.name } });
    await engine.joinActors({ badgeId, actor: joined, op: { type: "actor.join", from: actor.id, into: joined.id } });
    await post(answerOp(), joined, "op_answer");
    const saved = (await engine.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)!;
    expect(saved.author).toEqual(joined); expect(saved.design).toMatchObject({ respondentActorId: actor.id });
    await engine.undo(canvasId, joined, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    expect(questionnaireStates((await engine.getSnapshot(canvasId)).canvas)[0]?.status).toBe("open");
    const redo = await engine.redo(canvasId, joined, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    expect(redo.envelope.op.type).toBe("comment.restore");
    expect((await engine.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)).toEqual(saved);
  });

  it("serializes duplicate concurrent requests into one accepted operation", async () => {
    const asks = await Promise.all([post(askOp(), agent, "op_ask"), post(askOp(), agent, "op_ask")]);
    expect(asks[0]).toEqual(asks[1]);
    const responses = await Promise.all([post(answerOp(), actor, "op_answer"), post(answerOp(), actor, "op_answer")]);
    expect(responses[0]).toEqual(responses[1]);
    expect(questionnaireStates((await engine.getSnapshot(canvasId)).canvas)[0]?.responses).toHaveLength(1);
  });

  it("refuses changed source, brief version and request epoch before recording an answer", async () => {
    await post(askOp(), agent);
    await post({ type: "comment.update", threadId, commentId: "cmt_questions", body: "Changed question" }, agent);
    await expect(post(answerOp())).rejects.toMatchObject({ code: "bad-op" });
    await engine.undo(canvasId, agent, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    const stale = answerOp(); stale.response.epoch = 2;
    await expect(post(stale)).rejects.toMatchObject({ code: "bad-op" });
    await post({ type: "item.addVersion", itemId: "itm_brief", version: await version("ver_same_brief", Buffer.from(JSON.stringify(brief))) }, agent);
    await expect(post(answerOp())).rejects.toMatchObject({ code: "bad-op" });
    expect(questionnaireStates((await engine.getSnapshot(canvasId)).canvas)[0]?.responses).toHaveLength(0);
  });

  it("refuses missing or wrongly attributed original canvas-chat request sources", async () => {
    const changed = { ...brief, requestingActorId: agent.id };
    const v = await version("ver_wrong_request", Buffer.from(JSON.stringify(changed)));
    await post({ type: "item.addVersion", itemId: "itm_brief", version: v }, agent);
    questions.brief = { ...questions.brief, versionId: v.id, blobHash: v.blobHash };
    await expect(post(askOp(), agent)).rejects.toThrow(/requesting actor/);
    const missing = { ...brief, source: { entrance: "canvas-chat", threadId, commentId: "cmt_missing" } };
    const absent = await version("ver_missing_request", Buffer.from(JSON.stringify(missing)));
    await post({ type: "item.addVersion", itemId: "itm_brief", version: absent }, agent);
    questions.brief = { ...questions.brief, versionId: absent.id, blobHash: absent.blobHash };
    await expect(post(askOp(), agent)).rejects.toThrow(/unavailable/);
  });

  it("requires exact unchanged legacy content and an explicit known respondent for visible adoption", async () => {
    const body = '/ask {"headline":"Acme layout","questions":[{"id":"workflow","title":"Choose a flow","renderer":"choice-list","options":[{"id":"batch","title":"Batch"},{"id":"each","title":"Each"}]}]}';
    await post({ type: "thread.reply", threadId, comment: { id: "cmt_legacy", body } }, agent);
    const adopted = legacyQuestionSet(parseLegacyQuestionnaire(body)!, questions);
    const op = { ...askOp(), questions: adopted, legacySource: { threadId, commentId: "cmt_legacy", body } };
    await expect(post({ ...op, legacySource: { ...op.legacySource, body: body + " " } }, agent)).rejects.toThrow(/changed/);
    const altered = structuredClone(op); altered.questions.questions[0]!.title = "Silently different";
    await expect(post(altered, agent)).rejects.toThrow(/preserve/);
    await post(op, agent);
    const saved = (await engine.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)!;
    expect(saved.body).toContain("Adopted legacy questionnaire"); expect(saved.designLegacySource).toEqual(op.legacySource);
    await post({ type: "comment.update", threadId, commentId: "cmt_legacy", body: "Changed legacy" }, agent);
    await expect(post(answerOp())).rejects.toThrow(/changed/);
  });
});

describe("exact retained versions and refusing readers", () => {
  it("retains two versions of one item and both visual faces through pruning, deletion, GC, restart and history adoption", async () => {
    const sources = [Buffer.from("Acme sketch first"), Buffer.from("Acme sketch revised")], faces = [Buffer.from("Acme first visual"), Buffer.from("Acme second visual")];
    const versions = [];
    for (const [index, source] of sources.entries()) versions.push(await version(`ver_sketch_${index}`, source, "text/plain", faces[index]));
    await post({ type: "item.add", itemId: "itm_sketch", title: "Acme sketch", width: 200, height: 200, placement: { x: 300, y: 0 }, version: versions[0]! });
    await post({ type: "item.addVersion", itemId: "itm_sketch", version: versions[1]! });
    questions.questions = [{ ...questions.questions[0]!, renderer: "upload", options: [] }, { id: "notes", title: "What should change?", consequence: "Guides the iteration", renderer: "freeform", options: [], multiple: false, skippable: true, delegatable: true }]; await post(askOp(), agent, "op_ask");
    const refs = versions.map((v, index) => ({ id: `ref_${index}`, state: "fetched" as const, artifact: { home: authoritativeHome, canvasId, itemId: "itm_sketch", versionId: v.id, blobHash: v.blobHash } }));
    const op = answerOp(); op.response.resolutions = [{ questionId: "workflow", state: "answered", value: { kind: "references", references: refs } }, { questionId: "notes", state: "answered", value: { kind: "text", text: "Keep the first arrangement" } }];
    await post(op, actor, "op_answer");
    const saved = (await engine.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)!;
    expect(saved.designReferences?.map((r) => r.version.id)).toEqual(versions.map((v) => v.id));
    expect(saved.designReferences?.every((r) => r.version.visual?.size && r.version.visual.filename)).toBe(true);
    const undone = await engine.undo(canvasId, actor, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    // The retained inverse itself names both visual faces, even without live source items.
    for (const hash of versions.flatMap((v) => [v.blobHash, v.visual!.blobHash])) expect(blobsNamedBy([undone]).has(hash)).toBe(true);
    await engine.redo(canvasId, actor, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    await post({ type: "item.pruneVersions", itemId: "itm_sketch", keep: 1 });
    await post({ type: "item.delete", itemId: "itm_sketch" }); await post({ type: "trash.empty" });
    const orphan = await store.putBlob(canvasId, Buffer.from("Acme orphan"), { mimeType: "text/plain", filename: "orphan.txt" });
    await engine.gc(canvasId, { keepOps: 0, graceMs: 0 });
    expect(await store.blobMeta(canvasId, orphan.blobHash)).toBeNull();
    engine = new Engine(store, desk); const snapshot = await engine.getSnapshot(canvasId);
    expect(snapshot.canvas.items.itm_sketch).toBeUndefined(); expect(snapshot.canvas.trash).toEqual([]);
    expect(snapshot.canvas.threads[threadId]!.comments.at(-1)).toEqual(saved);
    for (const [index, v] of versions.entries()) { expect(await bytes(store, v.blobHash)).toEqual(sources[index]); expect(await bytes(store, v.visual!.blobHash)).toEqual(faces[index]); }
    const entries = [...await engine.getArchivedLog(canvasId), ...await engine.getLog(canvasId)];
    const replicaStore = new FileStore(path.join(home, "replica")); await replicaStore.init(); const replica = new Engine(replicaStore, desk);
    try {
      await replica.adopt(canvasId, entries);
      for (const [hash, metadata] of blobsNamedBy(entries, snapshot)) if (await store.blobMeta(canvasId, hash)) await replicaStore.putBlob(canvasId, await bytes(store, hash), metadata);
      expect((await replica.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)).toEqual(saved);
      for (const [index, v] of versions.entries()) { expect(await bytes(replicaStore, v.blobHash)).toEqual(sources[index]); expect(await bytes(replicaStore, v.visual!.blobHash)).toEqual(faces[index]); }
    } finally { await replicaStore.close(); }
    // Replacing only the text retains every prior resolution, including the exact
    // uploaded versions that no longer appear in a live item or in trash.
    const replacement = structuredClone(op);
    replacement.commentId = "cmt_replacement"; replacement.response.id = "answer_replacement";
    replacement.response.supersedesResponseId = op.response.id;
    replacement.response.resolutions[1] = { questionId: "notes", state: "answered", value: { kind: "text", text: "Use the revised arrangement" } };
    await post(replacement, actor, "op_replacement");
    const revised = (await engine.getSnapshot(canvasId)).canvas.threads[threadId]!.comments.at(-1)!;
    expect(revised.designReferences).toEqual(saved.designReferences);
    expect(questionnaireStates((await engine.getSnapshot(canvasId)).canvas)[0]).toMatchObject({ status: "answered", responses: [{ response: op.response }, { response: replacement.response }], resolutions: replacement.response.resolutions });
  });

  it("refuses unavailable, hash-mismatched, cross-home and cross-canvas references without fetching supplied URLs", async () => {
    questions.questions = [{ ...questions.questions[0]!, renderer: "url-collection", options: [] }]; await post(askOp(), agent);
    const good: DesignArtifactRef = questions.brief;
    for (const artifact of [{ ...good, home: "https://other.example" }, { ...good, canvasId: "prj_other" }, { ...good, blobHash: "c".repeat(64) }, { ...good, versionId: "ver_missing" }]) {
      const op = answerOp(); op.response.resolutions = [{ questionId: "workflow", state: "answered", value: { kind: "references", references: [{ id: "ref_forged", state: "fetched", artifact }] } }];
      await expect(post(op)).rejects.toMatchObject({ code: "bad-op" });
    }
    const op = answerOp(); op.response.resolutions = [{ questionId: "workflow", state: "answered", value: { kind: "references", references: [{ id: "ref_url", state: "supplied", url: "https://reference.example/sketch" }, { id: "ref_unavailable", state: "inaccessible", url: "https://reference.example/private", reason: "Requires login" }] } }];
    const entry = await post(op); expect(entry.envelope.op).toMatchObject({ retainedReferences: [], response: op.response });
  });

  it("refuses old readers for canonical operations, snapshots and restore inverses, even after answer undo", async () => {
    const entry = await post(askOp(), agent);
    const snapshot = await engine.getSnapshot(canvasId);
    expect(() => requireQuestionnaireClient(CANVAS_GROUPS_FEATURE, snapshot.canvas)).toThrow(/Update/);
    expect(() => requireQuestionnaireClient(CURRENT_CLIENT_FEATURES, snapshot.canvas, [entry])).not.toThrow();
    await post(answerOp()); const undo = await engine.undo(canvasId, actor, badgeId, undefined, CURRENT_CLIENT_FEATURES);
    expect(questionnaireOperation(undo.envelope.op)).toBe(false); expect(questionnaireOperation(undo.inverse!)).toBe(true);
    expect(() => requireQuestionnaireClient(CANVAS_GROUPS_FEATURE, undefined, [undo])).toThrow(/Update/);
    await expect(engine.redo(canvasId, actor, badgeId, undefined, CANVAS_GROUPS_FEATURE)).rejects.toThrow(/Update/);
  });

  it("rejects corrupted canonical reference snapshots before changing persistent state", async () => {
    await post(askOp(), agent);
    const before = await engine.getSnapshot(canvasId), log = await engine.getLog(canvasId);
    const corrupted = structuredClone(before); corrupted.lastSeq += 20;
    corrupted.canvas.threads[threadId]!.comments.at(-1)!.designReferences![0]!.artifact.blobHash = "e".repeat(64);
    await expect(engine.adoptRemoteSnapshot(canvasId, corrupted)).rejects.toMatchObject({ code: "bad-op" });
    expect(await engine.getSnapshot(canvasId)).toEqual(before); expect(await engine.getLog(canvasId)).toEqual(log);
    expect(await new Engine(store, desk).getSnapshot(canvasId)).toEqual(before);
  });
});


describe("questionnaire HTTP and socket capability boundary", () => {
  it("checks actual HTTP authority, original-client features, snapshot/log/watch and sockets before typed state delivery", async () => {
    const daemon = await startDaemon({ port: 0, home: path.join(home, "http"), birthHome: null });
    const address = daemon.app.server.address();
    if (!address || typeof address === "string") throw new Error("No daemon port");
    const base = `http://127.0.0.1:${address.port}`;
    const badge = await mintTestBadge(base); await badge.speakAs(actor, "web:acme"); await badge.speakAs(agent, "codex:acme");
    const sockets: WebSocket[] = [];
    let relay: Awaited<ReturnType<typeof startDaemon>> | undefined;
    async function request(url: string, body?: unknown, features = CURRENT_CLIENT_FEATURES) {
      const result = await fetch(base + url, { method: body === undefined ? "GET" : "POST", headers: { ...badge.headers, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: result.status, body: await result.json() as { code?: string; entries?: unknown[]; seq?: number } };
    }
    async function accepted(op: Operation, extra = {}) {
      const result = await request("/api/ops", { canvasId: op.type === "project.create" ? null : canvasId, actor, op, ...extra });
      expect(result.status, JSON.stringify(result.body)).toBe(200); return result;
    }
    function connect(since: number, features: string) {
      const socket = new WebSocket(`${base.replace("http:", "ws:")}/ws?canvasId=${canvasId}&since=${since}&${CLIENT_FEATURES_PARAM}=${encodeURIComponent(features)}`, { headers: badge.headers });
      sockets.push(socket); return socket;
    }
    try {
      await accepted({ type: "project.create", canvasId, title: "Acme HTTP", groupMode: "legacy" });
      await accepted({ type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_request", body: "Design Acme inventory" } });
      const content = Buffer.from(JSON.stringify(brief));
      const blob = await daemon.store.putBlob(canvasId, content, { mimeType: "application/json", filename: "brief.json" });
      await accepted({ type: "item.add", itemId: "itm_brief", title: "Acme brief", width: 200, height: 200, placement: { x: 0, y: 0 }, version: { id: "ver_brief", blobHash: blob.blobHash, mimeType: "application/json", filename: "brief.json", size: content.length } });
      const op = askOp(); op.questions.brief = { ...questions.brief, home: base, blobHash: blob.blobHash };
      const before = await daemon.engine.getSnapshot(canvasId);
      expect((await request("/api/ops", { canvasId, actor, op }, CANVAS_GROUPS_FEATURE)).status).toBe(426);
      expect((await request("/api/ops", { canvasId, actor, op, clientFeatures: CANVAS_GROUPS_FEATURE })).status).toBe(426);
      // Body fields cannot replace the transport-selected authoritative home.
      const forged = structuredClone(op); forged.questions.brief.home = "https://forged.example";
      expect((await request("/api/ops", { canvasId, actor, op: forged, authoritativeHome: "https://forged.example" })).status).toBe(400);
      expect(await daemon.engine.getSnapshot(canvasId)).toEqual(before);
      const old = connect(0, CANVAS_GROUPS_FEATURE);
      const received: { type: string }[] = [];
      await new Promise<void>((resolve, reject) => { old.on("message", (data) => { received.push(JSON.parse(String(data))); resolve(); }); old.on("error", reject); });
      const closed = new Promise<number>((resolve, reject) => { old.on("close", resolve); old.on("error", reject); });
      await accepted(op, { opId: "op_http_ask" });
      expect(await closed).toBe(WS_STALE_CLIENT);
      expect(received.some((message) => message.type === "op-applied")).toBe(false);
      const collision = { canvasId, actor: agent, opId: "op_http_ask", op: { type: "thread.reply", threadId, comment: { id: "cmt_collision", body: "Different operation" } } };
      expect((await request("/api/ops", collision, CANVAS_GROUPS_FEATURE)).status).toBe(426);
      expect((await request("/api/ops", collision)).status).toBe(400);
      for (const url of [`/api/projects/${canvasId}/canvas`, `/api/projects/${canvasId}/oplog`, `/api/projects/${canvasId}/oplog/archive`]) {
        expect(await request(url, undefined, CANVAS_GROUPS_FEATURE)).toMatchObject({ status: 426, body: { code: QUESTIONNAIRES_REQUIRED } });
      }
      for (const body of [{ cursors: {}, only: [canvasId], waitMs: 0 }, { only: [canvasId], waitMs: 0 }]) expect((await request("/api/oplog/watch", body, CANVAS_GROUPS_FEATURE)).status).toBe(426);
      expect(await request("/api/oplog/watch", { cursors: {}, waitMs: 0 }, CANVAS_GROUPS_FEATURE)).toMatchObject({ status: 200, body: { entries: [] } });
      for (const since of [0, 1]) {
        const socket = connect(since, CANVAS_GROUPS_FEATURE), messages: unknown[] = [];
        socket.on("message", (data) => messages.push(JSON.parse(String(data))));
        expect(await new Promise<number>((resolve, reject) => { socket.on("close", resolve); socket.on("error", reject); })).toBe(WS_STALE_CLIENT);
        expect(messages).toEqual([]);
      }
      const current = connect(1, CURRENT_CLIENT_FEATURES);
      const delivered = await new Promise<{ type: string; entry?: { envelope: { op: Operation } } }>((resolve, reject) => { current.on("message", (data) => { const message = JSON.parse(String(data)); if (message.entry?.envelope.op.type === "questionnaire.ask") resolve(message); }); current.on("error", reject); });
      expect(delivered.entry?.envelope.op.type).toBe("questionnaire.ask");
      // A transparent source-policy relay must use the caller's decoder, even
      // though its own replica connection can process the new protocol.
      relay = await startDaemon({ port: 0, home: path.join(home, "relay"), birthHome: null, homePollMs: 50 });
      const relayAddress = relay.app.server.address();
      if (!relayAddress || typeof relayAddress === "string") throw new Error("No relay port");
      const relayBase = `http://127.0.0.1:${relayAddress.port}`, relayBadge = await mintTestBadge(relayBase);
      await relayBadge.speakAs(actor, "web:acme-relay");
      const pass = await fetch(`${base}/api/projects/${canvasId}/passes`, { method: "POST", headers: { ...badge.headers, [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES, "Content-Type": "application/json" }, body: JSON.stringify({ actorId: actor.id }) });
      expect(pass.status, await pass.clone().text()).toBe(200);
      const { token } = await pass.json() as { token: string };
      const redeemed = await fetch(`${relayBase}/api/passes/redeem`, { method: "POST", headers: { ...relayBadge.headers, "Content-Type": "application/json" }, body: JSON.stringify({ home: base, token }) });
      expect(redeemed.status, await redeemed.clone().text()).toBe(200);
      await expect.poll(() => relay!.store.canvasExists(canvasId)).toBe(true);
      const policy = sourcePolicyHeader({ policy: { mode: "direct", actorId: actor.id, intent: "edit" }, expectedHome: base });
      async function relayed(url: string, body: unknown, features: string) {
        return fetch(relayBase + url, { method: body === undefined ? "GET" : "POST", headers: { ...relayBadge.headers, [SOURCE_POLICY_HEADER]: policy, [CLIENT_FEATURES_HEADER]: features, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      }
      for (const [url, body] of [[`/api/projects/${canvasId}/canvas`, undefined], [`/api/projects/${canvasId}/oplog`, undefined], ["/api/oplog/watch", { only: [canvasId], cursors: { [canvasId]: 0 }, waitMs: 0 }], ["/api/ops", { canvasId, actor, op, opId: "op_http_ask" }]] as const) {
        for (const features of ["", CANVAS_GROUPS_FEATURE]) {
          const denied = await relayed(url, body, features);
          expect(denied.status, await denied.clone().text()).toBe(426);
          expect(await denied.json()).toMatchObject({ code: QUESTIONNAIRES_REQUIRED });
        }
        const supported = await relayed(url, body, CURRENT_CLIENT_FEATURES);
        expect(supported.status, await supported.clone().text()).toBe(200); await supported.arrayBuffer();
      }
    } finally { for (const socket of sockets) socket.terminate(); await relay?.close(); await daemon.close(); }
  });
});
