import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  DESIGN_REVIEW_PROPERTY,
  designReviewSourceAudit,
  parseDesignReviewRun,
  parseDesignVerifierOffer,
  readDesignRequestReference,
  readDesignRequests
} from "./chunk-DEZYUUTP.mjs";
import {
  designRequestBasisCurrent
} from "./chunk-U4ZPMZI4.mjs";
import {
  readGoverningDesign
} from "./chunk-OY7MZFSI.mjs";
import {
  designDecisionScope
} from "./chunk-JNO6CSXZ.mjs";
import {
  mayWake,
  normalizeHomeUrl,
  parseDesignArtifactRef,
  resolveActor,
  sameDesignArtifact
} from "./chunk-5CQWGZGQ.mjs";

// packages/api/src/design-review-reader.ts
function designReviewSemantic(value) {
  return Array.isArray(value) ? `[${value.map(designReviewSemantic).join(",")}]` : value && typeof value === "object" ? "{" + Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${designReviewSemantic(value[k])}`).join(",") + "}" : JSON.stringify(value);
}
var same = (a, b) => designReviewSemantic(a) === designReviewSemantic(b);
var reason = (error) => error instanceof Error ? error.message : String(error);
function created(op) {
  if (op.type === "item.add") return [{ itemId: op.itemId, properties: op.properties ?? {}, version: op.version }];
  if (op.type === "group.change" && op.action.kind === "apply") return op.action.change.writes.flatMap((w) => w.kind === "create" ? w.item.versions.map((version) => ({ itemId: w.item.id, properties: w.item.properties, version })) : []);
  return [];
}
function versions(op) {
  const adds = created(op);
  if (adds.length) return adds;
  if (op.type === "item.edit" || op.type === "item.addVersion" || op.type === "item.restoreVersion") return [{ itemId: op.itemId, version: op.version }];
  if (op.type === "group.change" && op.action.kind === "apply") return op.action.change.writes.flatMap((w) => w.kind === "patch" || w.kind === "patchTrash" ? w.content?.versions?.map((version) => ({ itemId: w.itemId, version })) ?? [] : []);
  return [];
}
function designReviewReadings(run) {
  const pass = run.passes.at(-1), record = pass.record;
  const audit = record ? designReviewSourceAudit(record.source) : null;
  const rows = audit ? "items" in audit ? audit.items : [audit] : [];
  const limits = [];
  for (const row of rows) if (row.status === "unavailable") limits.push(row.reason);
  else {
    limits.push(...row.coverage.unexamined.map((one) => one.explanation));
    if (row.coverage.omittedCategories.length) limits.push(`Static analysis does not govern ${row.coverage.omittedCategories.join(", ")}.`);
    if (row.coverage.checkedValues === 0) limits.push("Static analysis checked no governed values.");
  }
  const source = !rows.length || rows.some((row) => row.status === "unavailable") ? "unavailable" : rows.some((row) => row.status === "audited" && (row.diagnostics.length || row.offSystem.length)) ? "failed" : limits.length ? "unsupported" : "passed";
  const missingObligationIds = run.obligations.filter((o) => o.required && !record?.observations.some((one) => one.obligationId === o.id && one.result === "passed")).map((o) => o.id);
  const reading = (kind) => {
    const required = run.obligations.filter((o) => o.kind === kind && o.required);
    if (record && (record.findings.some((f) => f.kind === kind && f.severity === "critical") || required.some((o) => record.observations.some((one) => one.obligationId === o.id && one.result === "failed")))) return "failed";
    if (!record || !required.length || required.some((o) => !record.observations.some((one) => one.obligationId === o.id) || record.observations.some((one) => one.obligationId === o.id && one.result === "unavailable"))) return "unavailable";
    return required.every((o) => record.observations.some((one) => one.obligationId === o.id && one.result === "passed")) ? "passed" : "unavailable";
  };
  return { source, task: reading("browser-task"), craft: reading("craft"), missingObligationIds, sourceAudit: audit, limits: [...new Set(limits)] };
}
async function readDesignReviewReference(io, options) {
  const { canvasId, artifact, signal } = options, home = normalizeHomeUrl(await io.home(canvasId, signal));
  const local = artifact.canvasId === canvasId && normalizeHomeUrl(artifact.home) === home;
  const source = { canvasId: artifact.canvasId, expectedHome: normalizeHomeUrl(artifact.home) };
  const snapshot = local ? await io.snapshot(canvasId, signal) : await io.sourceSnapshot(source, signal);
  const item = snapshot.canvas.items[artifact.itemId], version = item?.versions.find((one) => one.id === artifact.versionId);
  if (!version || version.blobHash !== artifact.blobHash) {
    if (local) {
      const requests = await io.requests(canvasId, signal);
      const owner = requests.requests.find((row) => [row.marker, ...row.receipts.map((one) => one.marker)].some((marker) => marker.retainedReferences.some((one) => sameDesignArtifact(one.artifact, artifact))));
      if (owner) {
        const retained = await readDesignRequestReference(io, { canvasId, requestId: owner.brief.requestId, artifact, ...signal ? { signal } : {} });
        return { artifact, version: retained.version, bytes: retained.bytes, local };
      }
    }
    throw new Error("The exact evidence version is unavailable; its current version cannot replace it.");
  }
  const bytes = local ? await io.blobBytes(canvasId, artifact.blobHash, signal) : await io.sourceBlobBytes(source, artifact.blobHash, signal);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== artifact.blobHash || bytes.length !== version.size) throw new Error("The evidence bytes disagree with their exact version.");
  return { artifact, version, bytes, local };
}
async function readDesignReviews(io, options) {
  const { canvasId, signal } = options, now = options.now ?? Date.now();
  const [snapshot, home, log, requests, repairs] = await Promise.all([io.snapshot(canvasId, signal), io.home(canvasId, signal), io.history(canvasId, signal), readDesignRequests(io, { canvasId, ...options.requestId ? { filter: { requestId: options.requestId } } : {}, ...signal ? { signal } : {} }), io.repairs(canvasId, signal)]);
  if (snapshot.project.id !== canvasId) throw new Error("Review read returned a different canvas.");
  const knownSeqs = new Set(log.map((entry) => entry.seq));
  for (let seq = 1; seq <= snapshot.lastSeq; seq++) if (!knownSeqs.has(seq)) throw new Error(`Canonical review history is incomplete at sequence ${seq}; its consumed budget is unavailable, never reset.`);
  const ids = new Set(Object.values(snapshot.canvas.items).filter((i) => ["run-v1", "offer-v1"].includes(i.properties[DESIGN_REVIEW_PROPERTY] ?? "")).map((i) => i.id));
  for (const entry of log) for (const one of [...created(entry.envelope.op), ...entry.inverse ? created(entry.inverse) : []]) if (["run-v1", "offer-v1"].includes(one.properties[DESIGN_REVIEW_PROPERTY] ?? "")) ids.add(one.itemId);
  const bindings = /* @__PURE__ */ new Map();
  const addBinding = (itemId, binding) => {
    const list = bindings.get(itemId) ?? [];
    if (!list.some((one) => same(one, binding))) bindings.set(itemId, [...list, binding]);
  };
  for (const entry of log) if (!entry.cause) {
    for (const one of created(entry.envelope.op)) if (ids.has(one.itemId)) {
      const requestId = one.properties["design.review.request"], runId = one.properties["design.review.run"];
      if (requestId?.trim() && runId?.trim()) addBinding(one.itemId, { requestId, runId });
    }
  }
  const inScope = (itemId) => !bindings.has(itemId) || bindings.get(itemId).some((one) => (!options.requestId || one.requestId === options.requestId) && (!options.runId || one.runId === options.runId));
  for (const itemId of ids) if (!inScope(itemId)) ids.delete(itemId);
  if (ids.size > 256) throw new Error("Review discovery exceeds its bounded artifact limit; select a narrower canvas.");
  const records = /* @__PURE__ */ new Map(), conflicts = [];
  for (const entry of [...log].sort((a, b) => a.seq - b.seq)) if (!entry.cause) {
    for (const one of versions(entry.envelope.op)) if (ids.has(one.itemId)) {
      const key = `${one.itemId}/${one.version.id}`, previous = records.get(key);
      const author = "createdBy" in one.version ? one.version.createdBy : entry.envelope.actor;
      if (previous && (previous.version.blobHash !== one.version.blobHash || previous.version.size !== one.version.size || previous.author.id !== author.id)) conflicts.push({ itemId: one.itemId, reason: `Historical review version ${one.version.id} has conflicting content or authorship; its first identity cannot be replaced.` });
      if (!previous) records.set(key, { ...one, author, seq: entry.seq });
    }
  }
  for (const itemId of ids) for (const version of snapshot.canvas.items[itemId]?.versions ?? []) if (!records.has(`${itemId}/${version.id}`)) records.set(`${itemId}/${version.id}`, { itemId, version, author: version.createdBy, seq: 0 });
  if (records.size > 2048) throw new Error("Review history exceeds its bounded read limit; history is unavailable, not reset.");
  const unavailable = [...conflicts], runs = [], offers = [];
  for (const itemId of ids) if ((bindings.get(itemId)?.length ?? 0) > 1) unavailable.push({ itemId, reason: "Canonical review creations name conflicting request/run bindings; mutable metadata cannot select one history." });
  const parsed = /* @__PURE__ */ new Map();
  for (const row of records.values()) {
    try {
      const bytes = await io.blobBytes(canvasId, row.version.blobHash, signal);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hash !== row.version.blobHash || bytes.length !== row.version.size) throw new Error("Historical report bytes disagree with their saved identity.");
      const value = JSON.parse(new TextDecoder().decode(bytes));
      const report = value?.kind === "review-run" ? parseDesignReviewRun(value) : parseDesignVerifierOffer(value);
      const binding = report.kind === "review-run" ? { requestId: report.request.requestId, runId: report.id } : { requestId: report.requestId, runId: report.runId };
      const captured = bindings.get(row.itemId);
      if (captured && !captured.some((one) => same(one, binding))) throw new Error("Report body contradicts its original request/run discovery binding.");
      const ref = { home: normalizeHomeUrl(home), canvasId, itemId: row.itemId, versionId: row.version.id, blobHash: row.version.blobHash };
      parsed.set(row.itemId, [...parsed.get(row.itemId) ?? [], { ...row, ref, report }]);
    } catch (error) {
      unavailable.push({ itemId: row.itemId, reason: `Review history ${row.version.id}: ${reason(error)}` });
    }
  }
  for (const [itemId, history] of parsed) if (!bindings.has(itemId)) for (const one of history) addBinding(itemId, one.report.kind === "review-run" ? { requestId: one.report.request.requestId, runId: one.report.id } : { requestId: one.report.requestId, runId: one.report.runId });
  for (const [itemId, history] of parsed) {
    history.sort((a, b) => a.seq - b.seq);
    const currentId = snapshot.canvas.items[itemId]?.currentVersionId, latest = history.find((one) => one.version.id === currentId) ?? history.at(-1);
    if (latest.report.kind === "verifier-offer") {
      const offer = latest.report;
      if ((!options.requestId || offer.requestId === options.requestId) && (!options.runId || offer.runId === options.runId)) offers.push({ ref: latest.ref, offer, author: latest.author, eligible: false, reasons: currentId === latest.version.id ? [] : ["The offer is no longer a current artifact."] });
      continue;
    }
    const run = latest.report;
    if (options.requestId && run.request.requestId !== options.requestId || options.runId && run.id !== options.runId) continue;
    const reasons = unavailable.filter((one) => one.itemId === itemId).map((one) => one.reason);
    if (!currentId) reasons.push("The shared run was removed. Its consumed reservations remain historical.");
    const prior = history.filter((one) => one.report.kind === "review-run");
    const passIds = new Set(prior.flatMap((one) => one.report.passes.map((p) => p.id)));
    if (passIds.size > run.passes.length) reasons.push("The visible run omits later reservations. Restore its cumulative version before continuing; the budget has not reset.");
    if (prior.some((one) => one.report.id !== run.id || !same(one.report.request, run.request) || !same(one.report.obligations, run.obligations) || !same(one.report.basis, run.basis))) reasons.push("Review history has contradictory immutable scope or obligations.");
    for (const p of run.passes) {
      const reservations = prior.filter((one) => one.report.passes.some((old) => old.id === p.id));
      const original = reservations[0]?.report.passes.find((old) => old.id === p.id);
      const firstRecorded = reservations.find((one) => one.report.passes.some((old) => old.id === p.id && old.record))?.report.passes.find((old) => old.id === p.id);
      if (reservations.some((one) => {
        const old = one.report.passes.find((old2) => old2.id === p.id);
        return old.kind !== p.kind || old.reservationVersionId !== p.reservationVersionId || old.sessionId !== p.sessionId || old.reservedAt !== p.reservedAt;
      })) reasons.push(`Reservation ${p.id} changed its identity.`);
      if (firstRecorded && reservations.some((one) => {
        const old = one.report.passes.find((old2) => old2.id === p.id);
        return old.record !== null && !same(old, firstRecorded);
      })) reasons.push(`Recorded pass ${p.id} was rewritten; its original observer cannot be credited for changed evidence.`);
      const firstRecordedAt = reservations.findIndex((one) => one.report.passes.some((old) => old.id === p.id && old.record));
      if (firstRecordedAt >= 0 && reservations.slice(firstRecordedAt + 1).some((one) => one.report.passes.find((old) => old.id === p.id).record === null)) reasons.push(`Recorded pass ${p.id} was reset to pending; consumed work is not available again.`);
      if (original && reservations.some((one) => {
        const old = one.report.passes.find((old2) => old2.id === p.id);
        return !old.record && !same(old.output, original.output);
      })) reasons.push(`Pending pass ${p.id} changed its captured output.`);
      if (original && firstRecorded && !same(original.output, firstRecorded.output)) {
        const before = original.output, after = firstRecorded.output;
        const edge = before.kind === "canvas" && after.kind === "canvas" && repairs.repairs.some((r) => r.repair.review?.runId === run.id && r.repair.review.passId === p.id && r.repair.review.run.itemId === itemId && r.repair.review.run.versionId === p.reservationVersionId && sameDesignArtifact(r.repair.target.artifact, before.artifact) && sameDesignArtifact(r.adopted, after.artifact));
        const reportedRepositoryRepair = p.kind === "repair" && before.kind === "repository" && after.kind === "repository" && before.repository === after.repository;
        if (!edge && !reportedRepositoryRepair) reasons.push(`Pass ${p.id} relabeled its inspected output without a matching repair transition.`);
      }
    }
    const request = requests.requests.find((one) => one.brief.requestId === run.request.requestId && one.ref.itemId === run.request.brief.itemId);
    if (!request || !designRequestBasisCurrent(request, run.request)) reasons.push("The admitted request or captured epoch/brief changed.");
    const pass = run.passes.at(-1);
    if (pass.output.kind === "canvas") {
      const item = snapshot.canvas.items[pass.output.artifact.itemId];
      if (!item || item.currentVersionId !== pass.output.artifact.versionId) reasons.push("The inspected output changed; its prior observations remain historical.");
      if (item && run.basis.target && !same({ title: item.title, description: item.description, properties: item.properties, scope: designDecisionScope(snapshot.canvas, item) }, { title: run.basis.target.title, description: run.basis.target.description, properties: run.basis.target.properties, scope: run.basis.target.scope })) reasons.push("The reviewed target metadata or scope changed.");
    }
    const governing = await readGoverningDesign(io, { canvasId, home, canvas: snapshot.canvas, project: snapshot.project, ...run.basis.governing.atItemId ? { atId: run.basis.governing.atItemId } : {}, ...signal ? { signal } : {} });
    if (governing.status === "unavailable") reasons.push(governing.reason);
    else if (!same({ atItemId: run.basis.governing.atItemId, artifact: governing.artifact, explicitNone: governing.exempt }, run.basis.governing)) reasons.push("The governing design changed.");
    const evidence = pass.record?.observations.flatMap((o) => o.evidence) ?? [];
    for (const artifact of [...new Map(evidence.map((ref) => [designReviewSemantic(ref), ref])).values()]) try {
      await readDesignReviewReference(io, { canvasId, artifact, ...signal ? { signal } : {} });
    } catch (error) {
      reasons.push(`Evidence unavailable: ${reason(error)}`);
    }
    const incompleteHistory = unavailable.some((one) => one.itemId === itemId) || reasons.some((r) => /contradictory|rewritten|reset to pending|changed its identity|relabeled|Pending pass/.test(r));
    if (incompleteHistory) reasons.push("The consumed repair budget is unavailable; no further reservation is permitted.");
    const readings = designReviewReadings(run), remainingRepairs = incompleteHistory ? null : Math.max(0, 3 - passIds.size);
    const ready = !reasons.length && pass.record?.outcome === "reviewed" && ["passed", "unsupported"].includes(readings.source) && readings.task === "passed" && readings.craft === "passed" && !pass.record.findings.some((f) => f.severity === "critical");
    const active = !reasons.length && !run.finished;
    const allowedActions = { record: active && !pass.record, beginRepair: active && !!pass.record && !ready && run.mode !== "audit-only" && remainingRepairs !== null && remainingRepairs > 0, finish: active && !!pass.record, handoff: active && readings.task !== "passed" };
    const handoffs = log.flatMap((entry) => {
      const op = entry.envelope.op;
      if (entry.cause || op.type !== "thread.reply" && op.type !== "thread.create" || !op.comment.body.startsWith("/ask ") || op.comment.mentions?.length !== 1) return [];
      const line = op.comment.body.split("\n").find((line2) => line2.startsWith("Exact run: "));
      if (!line) return [];
      try {
        const ref = parseDesignArtifactRef(JSON.parse(line.slice("Exact run: ".length)));
        if (ref.itemId !== itemId || ref.canvasId !== canvasId || !history.some((one) => sameDesignArtifact(one.ref, ref))) return [];
      } catch {
        return [];
      }
      const present = snapshot.canvas.threads[op.threadId]?.comments.some((c) => c.id === op.comment.id);
      return [{ opId: entry.envelope.id, threadId: op.threadId, commentId: op.comment.id, author: entry.envelope.actor, verifierActorId: op.comment.mentions[0], status: "requested", standing: present ? "active" : "removed" }];
    });
    runs.push({ ref: latest.ref, run, author: latest.author, status: reasons.length ? incompleteHistory ? "unavailable" : "stale" : "current", reasons: [...new Set(reasons)], remainingRepairs, ready, readings, nextAction: !active ? "review-inputs" : !pass.record ? "record" : ready || !allowedActions.beginRepair ? "finish" : "repair", allowedActions, passes: run.passes.map((p) => {
      const first = prior.find((one) => one.report.passes.some((old) => old.id === p.id));
      const recorded = prior.find((one) => one.report.passes.some((old) => old.id === p.id && old.record));
      return { id: p.id, reservedBy: first?.author ?? null, recordedBy: recorded?.author ?? null, repairs: repairs.repairs.filter((one) => one.repair.review?.runId === run.id && one.repair.review.passId === p.id && one.repair.review.run.itemId === itemId) };
    }), versions: history.map((one) => ({ ref: one.ref, author: one.author, seq: one.seq })), handoffs });
  }
  let sessions = [], answering = null, actors = { actors: [] };
  try {
    [sessions, answering, actors] = await Promise.all([io.sessions(canvasId, signal), io.answering(canvasId, signal), io.decisionActors(canvasId, signal)]);
  } catch {
  }
  for (const row of offers) {
    const offer = row.offer, run = runs.find((one) => one.run.id === offer.runId && sameDesignArtifact(one.ref, offer.run));
    if (!run || !same(run.run.passes.at(-1).output, offer.output)) row.reasons.push("The offered run/output scope changed.");
    if (!offer.available) row.reasons.push(offer.reason);
    if (Date.parse(offer.observedAt) > now || Date.parse(offer.expiresAt) <= now) row.reasons.push("The tool probe is expired or has a future timestamp.");
    if (!actors.actors.some((a) => a.kind === "agent" && resolveActor(snapshot.joined, a.id) === resolveActor(snapshot.joined, row.author.id)) || !sessions.some((s) => s.kind !== "web" && s.sessionId === offer.sessionId && resolveActor(snapshot.joined, s.actor.id) === resolveActor(snapshot.joined, row.author.id))) row.reasons.push("The offering native agent/session is not live or its actor classification is unavailable.");
    const policy = Object.entries(answering?.policies ?? {}).find(([id]) => resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, row.author.id))?.[1];
    if (!io.actorId || !answering?.actorIds.some((id) => resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, row.author.id)) || !policy || !mayWake(policy, io.actorId, snapshot.joined, void 0, now)) row.reasons.push("The current actor has no confirmed authorization to wake this verifier.");
    row.eligible = row.reasons.length === 0;
  }
  return { runs, offers, unavailable: unavailable.filter((one) => inScope(one.itemId)) };
}

export {
  designReviewSemantic,
  designReviewReadings,
  readDesignReviewReference,
  readDesignReviews
};
