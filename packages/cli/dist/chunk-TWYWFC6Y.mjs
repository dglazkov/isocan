import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  questionnaireFailureStatus,
  readGoverningDesign
} from "./chunk-HDRQD7VJ.mjs";
import {
  designComparisonActions,
  designDecisionScope
} from "./chunk-24RYMSE5.mjs";
import {
  designDecisionIntentHash,
  normalizeHomeUrl,
  parseDesignCompareOperation,
  parseDesignDecideOperation,
  parseDesignRespondOperation,
  resolveActor,
  sameDesignArtifact,
  sourceFaceOf,
  visualFaceOf
} from "./chunk-GXGIYXSG.mjs";

// packages/api/src/design-decision-reader.ts
var message = (error) => error instanceof Error ? error.message : String(error);
var sameSource = (a, b) => a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
var sameBinding = (a, b) => a.atItemId === b.atItemId && a.explicitNone === b.explicitNone && (a.artifact === null ? b.artifact === null : b.artifact !== null && sameDesignArtifact(a.artifact, b.artifact));
var matches = (comparison, source, filter, targetItemId) => (!filter.requestId || comparison.requestId === filter.requestId) && (!filter.targetItemId || filter.targetItemId === (targetItemId ?? comparison.target.itemId) || comparison.target.itemId === null && comparison.alternatives.some((one) => one.artifact.itemId === filter.targetItemId)) && (!filter.threadId || source.threadId === filter.threadId) && (!filter.commentId || source.commentId === filter.commentId) && (!filter.decisionKey || comparison.decisionKey === filter.decisionKey);
var binding = (atItemId, governing) => ({ atItemId, artifact: governing.artifact, explicitNone: governing.exempt });
async function readDesignComparisons(io, options) {
  const { canvasId, signal } = options, filter = options.filter ?? {};
  const [records, snapshot, home, eligible] = await Promise.all([io.decisions(canvasId, signal), io.snapshot(canvasId, signal), io.home(canvasId, signal), io.decisionActors(canvasId, signal)]);
  if (snapshot.project.id !== canvasId) throw new Error("The comparison read returned a different canvas.");
  const reads = /* @__PURE__ */ new Map();
  const at = (itemId) => {
    const key = itemId ?? "";
    let promise = reads.get(key);
    if (!promise) {
      promise = readGoverningDesign(io, { canvasId, canvas: snapshot.canvas, project: snapshot.project, home, ...itemId ? { atId: itemId } : {}, ...signal ? { signal } : {} });
      reads.set(key, promise);
    }
    return promise;
  };
  const comparisons = [];
  for (const state of records.comparisons.filter((one) => matches(one.comparison, one.source, filter))) {
    const comparison = state.comparison, governing = await at(comparison.governing.atItemId);
    const reasons = [...state.reasons];
    if (governing.status === "unavailable") reasons.push(governing.reason);
    else if (!sameBinding(comparison.governing, binding(comparison.governing.atItemId, governing))) reasons.push("The design governing this comparison changed; review a refreshed comparison.");
    const approvalBases = [];
    for (const alternative of comparison.alternatives) {
      const item = snapshot.canvas.items[comparison.target.itemId ?? alternative.artifact.itemId];
      const version = item?.versions.find((one) => one.id === item.currentVersionId);
      if (!item || !version) {
        approvalBases.push({ alternativeId: alternative.id, basis: null, reason: "The adoption target is unavailable." });
        continue;
      }
      const selectedGoverning = await at(item.id);
      if (selectedGoverning.status === "unavailable") {
        approvalBases.push({ alternativeId: alternative.id, basis: null, reason: selectedGoverning.reason });
        continue;
      }
      approvalBases.push({ alternativeId: alternative.id, basis: { brief: structuredClone(comparison.brief), epoch: comparison.epoch, alternatives: comparison.alternatives.map((one) => structuredClone(one.artifact)), target: { artifact: { home: normalizeHomeUrl(home), canvasId, itemId: item.id, versionId: version.id, blobHash: version.blobHash }, title: item.title, description: item.description, properties: structuredClone(item.properties), scope: designDecisionScope(snapshot.canvas, item) }, governing: binding(item.id, selectedGoverning) } });
    }
    const status = state.status === "superseded" ? state.status : reasons.length ? "stale" : state.status;
    const actorId = io.actorId ? resolveActor(snapshot.joined, io.actorId) : "";
    const actor = eligible.actors.find((one) => resolveActor(snapshot.joined, one.id) === actorId);
    const allowedActions = designComparisonActions({ ...state, status }, { id: actorId, kind: actor?.kind ?? "unknown" }, snapshot.joined);
    comparisons.push({ ...state, status, reasons: [...new Set(reasons)], governing, approvalBases, allowedActions });
  }
  const decisions = [];
  for (const state of records.decisions.filter((one) => matches(one.decision.comparison, one.source, filter, one.decision.adopted.itemId) || one.decision.input.source.kind === "comparison" && matches(one.decision.comparison, one.decision.input.source.source, filter, one.decision.adopted.itemId))) {
    const expected = state.decision.input.basis.governing, governing = await at(expected.atItemId);
    const reasons = [...state.reasons];
    if (governing.status === "unavailable") reasons.push(governing.reason);
    else if (!sameBinding(expected, binding(expected.atItemId, governing))) reasons.push("The design governing the adopted output changed.");
    decisions.push({ ...state, status: state.status === "unavailable" || governing.status === "unavailable" ? "unavailable" : reasons.length ? "stale" : state.status, reasons: [...new Set(reasons)], governing });
  }
  return { comparisons, decisions, unavailable: records.unavailable };
}
function identifiers(request) {
  for (const value of [request.canvasId, request.threadId, request.commentId, request.opId]) if (typeof value !== "string" || !value.trim()) throw new Error("A saved intent needs stable canvas, thread, comment and operation identities.");
}
function prepareDesignDecision(request) {
  identifiers(request);
  const operation = parseDesignDecideOperation({ type: "design.decide", threadId: request.threadId, commentId: request.commentId, decision: request.decision });
  return { ...request, decision: structuredClone(operation.decision) };
}
async function preflight(io, request, op) {
  const bindings = [];
  if (op.type === "design.compare") bindings.push(op.comparison.governing);
  else {
    if (op.type === "design.decide") bindings.push(op.decision.basis.governing);
    const source = op.type === "design.respond" ? op.response.comparison : op.decision.source.kind === "comparison" ? op.decision.source.source : null;
    if (source) {
      const records = await io.decisions(request.canvasId, request.signal);
      const comparison = records.comparisons.find((one) => sameSource(one.source, source));
      if (!comparison) throw new Error("The captured comparison source is unavailable. Preserve the draft and review its history.");
      bindings.push(comparison.comparison.governing);
    } else if (op.type === "design.decide" && op.decision.source.kind === "direct") bindings.push(op.decision.source.proposal.governing);
  }
  const [snapshot, home] = await Promise.all([io.snapshot(request.canvasId, request.signal), io.home(request.canvasId, request.signal)]);
  if (snapshot.project.id !== request.canvasId) throw new Error("The decision preflight returned a different canvas.");
  const checked = /* @__PURE__ */ new Set();
  for (const expected of bindings) {
    const key = JSON.stringify(expected);
    if (checked.has(key)) continue;
    checked.add(key);
    const actual = await readGoverningDesign(io, { canvasId: request.canvasId, home, canvas: snapshot.canvas, project: snapshot.project, ...expected.atItemId ? { atId: expected.atItemId } : {}, ...request.signal ? { signal: request.signal } : {} });
    if (actual.status === "unavailable" || !sameBinding(expected, binding(expected.atItemId, actual))) throw new Error(actual.status === "unavailable" ? actual.reason : "The captured governing design changed. Preserve the draft and review a refreshed basis.");
  }
}
async function submit(io, request, op) {
  identifiers(request);
  const payloadId = op.type === "design.compare" ? op.comparison.id : op.type === "design.respond" ? op.response.id : op.decision.id;
  const result = { status: "pending", canvasId: request.canvasId, threadId: request.threadId, commentId: request.commentId, payloadId, submittedOpId: request.opId, opId: null };
  if (!request.retry) {
    try {
      await preflight(io, request, op);
    } catch (error) {
      return { ...result, status: "refused", reason: message(error) };
    }
  }
  let delivered;
  try {
    delivered = await io.sendDecision(request.canvasId, op, { opId: request.opId, ...request.signal ? { signal: request.signal } : {} });
  } catch (error) {
    delivered = { status: questionnaireFailureStatus(error), reason: message(error), ...error && typeof error === "object" && "code" in error && typeof error.code === "string" ? { code: error.code } : {} };
  }
  if (delivered.status === "refused") return { ...result, status: request.retry && delivered.code !== "design-intent-conflict" ? "pending" : "refused", reason: delivered.reason };
  let snapshot;
  try {
    const current = await io.snapshot(request.canvasId, request.signal);
    if (current.project.id === request.canvasId) snapshot = current;
  } catch {
  }
  const sameAuthor = (id) => !!io.actorId && (id === io.actorId || !!snapshot?.joined && resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, io.actorId));
  let accepted;
  if (delivered.status === "accepted") {
    const envelope = delivered.receipt?.envelope;
    if (envelope?.canvasId === request.canvasId && sameAuthor(envelope.actor.id)) {
      try {
        if (await designDecisionIntentHash(envelope.op, envelope.actor.id) === await designDecisionIntentHash(op, envelope.actor.id)) accepted = { ...result, status: "accepted", opId: envelope.id, confirmedBy: "receipt", seq: delivered.receipt.seq };
      } catch {
      }
    }
  }
  const comment = snapshot?.canvas.threads[request.threadId]?.comments.find((one) => one.id === request.commentId);
  if (!accepted && comment?.designDecision && sameAuthor(comment.author.id)) {
    if (comment.designDecision.intentHash === await designDecisionIntentHash(op, comment.author.id)) accepted = { ...result, status: "accepted", opId: comment.designDecision.opId, confirmedBy: "snapshot" };
  }
  if (!accepted) return { ...result, reason: delivered.status === "pending" ? delivered.reason : "No matching canonical intent and actor confirmed this submission. Retain the exact saved intent for retry." };
  if (!snapshot) return { ...accepted, consistency: { status: "unavailable", reasons: ["Accepted by the writer; current consistency could not be read."] } };
  try {
    const read = await readDesignComparisons(io, { canvasId: request.canvasId, ...request.signal ? { signal: request.signal } : {} });
    const saved = op.type === "design.decide" ? read.decisions.find((one) => one.source.threadId === request.threadId && one.source.commentId === request.commentId) : op.type === "design.compare" ? read.comparisons.find((one) => one.source.threadId === request.threadId && one.source.commentId === request.commentId) : read.comparisons.find((one) => sameSource(one.source, op.response.comparison));
    return { ...accepted, consistency: saved ? { status: saved.status === "stale" || saved.status === "superseded" ? "stale" : saved.status === "unavailable" ? "unavailable" : "current", reasons: saved.reasons } : { status: "unavailable", reasons: ["Accepted history is no longer available in the current comparison read."] } };
  } catch (error) {
    return { ...accepted, consistency: { status: "unavailable", reasons: [message(error)] } };
  }
}
function publishDesignComparison(io, request) {
  return submit(io, request, parseDesignCompareOperation({ type: "design.compare", threadId: request.threadId, commentId: request.commentId, comparison: request.comparison }));
}
function respondDesignComparison(io, request) {
  return submit(io, request, parseDesignRespondOperation({ type: "design.respond", threadId: request.threadId, commentId: request.commentId, response: request.response }));
}
async function submitDesignDecision(io, request) {
  const prepared = prepareDesignDecision(request);
  return submit(io, prepared, parseDesignDecideOperation({ type: "design.decide", threadId: prepared.threadId, commentId: prepared.commentId, decision: prepared.decision }));
}
async function readDesignComparisonReference(io, request) {
  const response = await io.decisions(request.canvasId, request.signal);
  const comparison = response.comparisons.find((one) => sameSource(one.source, request.source));
  const history = response.decisions.filter((one) => sameSource(one.source, request.source) || one.decision.input.source.kind === "comparison" && sameSource(one.decision.input.source.source, request.source));
  const record = comparison?.comparison ?? history[0]?.decision.comparison;
  const option = record?.alternatives.find((one) => one.id === request.optionId);
  if (!option) throw new Error("No option exists at this exact comparison source.");
  const artifact = option.artifact, retained = [...comparison?.references ?? [], ...history.flatMap((one) => one.references)].find((one) => sameDesignArtifact(one.artifact, artifact));
  const home = normalizeHomeUrl(await io.home(request.canvasId, request.signal));
  const local = artifact.canvasId === request.canvasId && normalizeHomeUrl(artifact.home) === home;
  const source = { canvasId: artifact.canvasId, expectedHome: normalizeHomeUrl(artifact.home) };
  const snapshot = local ? await io.snapshot(request.canvasId, request.signal) : await io.sourceSnapshot(source, request.signal);
  const version = (local ? retained?.version : void 0) ?? snapshot.canvas.items[artifact.itemId]?.versions.find((one) => one.id === artifact.versionId);
  if (!version || version.blobHash !== artifact.blobHash) throw new Error("The exact option version is unavailable; its current version cannot replace it.");
  const face = request.face ?? "source", content = face === "visual" ? visualFaceOf(version) : sourceFaceOf(version);
  const bytes = local ? await io.blobBytes(request.canvasId, content.blobHash, request.signal) : await io.sourceBlobBytes(source, content.blobHash, request.signal);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== content.blobHash || bytes.length !== content.size) throw new Error("The option bytes disagree with their retained identity.");
  return { artifact, version, title: option.title, face, bytes };
}

export {
  readDesignComparisons,
  prepareDesignDecision,
  publishDesignComparison,
  respondDesignComparison,
  submitDesignDecision,
  readDesignComparisonReference
};
