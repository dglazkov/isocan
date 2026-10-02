import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  readInheritedCanvases
} from "./chunk-LAY5HA6K.mjs";
import {
  designSkipped,
  normalizeHomeUrl,
  parseDesignQuestionSet,
  parseDesignResponse,
  questionnaireStates,
  resolveActor,
  selectDesignSystem,
  selectGoverningDesign
} from "./chunk-IHPXMWEI.mjs";
import {
  parseDesign
} from "./chunk-7OLMWXEB.mjs";

// packages/api/src/design-governing.ts
async function readGoverningDesign(io, options) {
  const { canvas, canvasId, home, signal } = options;
  let common = { exempt: designSkipped(options.project ?? {}), selection: { level: "none", scopeId: null, scopeDepth: null, reason: "The governing selection could not be read.", candidates: [] }, refusedSources: [] };
  let artifact = null, title = null;
  try {
    signal?.throwIfAborted();
    const at = options.atId === void 0 ? options.point : canvas.items[options.atId];
    if (options.atId !== void 0 && !at) throw new Error(`No item or scope ${options.atId} on this canvas.`);
    const scope = { ...at ? { at } : {}, ...options.groupId !== void 0 ? { groupId: options.groupId } : {} };
    const local = selectDesignSystem(canvas, scope);
    const linked = local.status !== "none" ? [] : options.linked ?? await readInheritedCanvases(io, canvas, home, signal);
    const governing = selectGoverningDesign(canvas, linked, { ...scope, ...options.project ? { project: options.project } : {} });
    const sourceCanvasId = governing.from?.canvasId ?? canvasId;
    const ref = (itemId, version2) => ({ home: normalizeHomeUrl(home), canvasId: sourceCanvasId, itemId, versionId: version2.id, blobHash: version2.blobHash });
    common = { exempt: governing.exempt, refusedSources: governing.refusedSources, selection: { level: governing.level, scopeId: governing.scopeId, scopeDepth: governing.scopeDepth, reason: governing.reason, candidates: governing.candidates.flatMap((item2) => {
      const version2 = item2.versions.find((one) => one.id === item2.currentVersionId);
      return version2 ? [{ artifact: ref(item2.id, version2), title: item2.title, updatedAt: item2.updatedAt }] : [];
    }) } };
    if (!governing.item) return { ...common, status: governing.status === "unavailable" ? "unavailable" : "none", artifact: null, title: null, reason: governing.reason };
    const item = governing.item;
    title = item.title;
    const version = item.versions.find((one) => one.id === item.currentVersionId);
    if (!version) throw new Error("The governing design's current version is unavailable.");
    artifact = ref(item.id, version);
    const key = JSON.stringify([artifact.home, artifact.canvasId, artifact.itemId, artifact.versionId, artifact.blobHash]);
    let pending = options.documents?.get(key);
    if (!pending) {
      pending = (governing.from ? io.sourceBlobText({ canvasId: artifact.canvasId, expectedHome: artifact.home }, version.blobHash, signal) : io.blobText(canvasId, version.blobHash, signal)).then((text2) => ({ text: text2, document: parseDesign(text2) }));
      options.documents?.set(key, pending);
    }
    const { text, document } = await pending;
    signal?.throwIfAborted();
    if (document.problems.length) throw new Error(`The governing design document could not be parsed: ${document.problems.join("; ")}`);
    return { ...common, status: "available", artifact, title, inherited: governing.from !== null, text, document, version, versions: item.versions.length, author: version.createdBy, metadata: { title, properties: item.properties } };
  } catch (error) {
    signal?.throwIfAborted();
    return { ...common, status: "unavailable", artifact, title, reason: error instanceof Error ? error.message : String(error) };
  }
}

// packages/api/src/questionnaire-reader.ts
async function readDesignQuestions(io, canvasId, options = {}) {
  options.signal?.throwIfAborted();
  const { canvas, joined } = await io.snapshot(canvasId, options.signal);
  options.signal?.throwIfAborted();
  return questionnaireStates(canvas, { ...options, ...joined ? { joined } : {} });
}
async function readDesignReference(io, canvasId, request) {
  request.signal?.throwIfAborted();
  const { canvas } = await io.snapshot(canvasId, request.signal);
  const comment = canvas.threads[request.threadId]?.comments.find((one) => one.id === request.commentId);
  if (!comment || comment.design?.kind !== "response") throw new Error("No typed design answer exists at this exact comment.");
  const response = parseDesignResponse(comment.design);
  const references = response.resolutions.flatMap((resolution) => resolution.state === "answered" && resolution.value.kind === "references" ? resolution.value.references : []);
  const matches = references.filter((one) => one.id === request.referenceId);
  if (matches.length > 1) throw new Error("This reference ID occurs in more than one question. Use distinct reference IDs when publishing an answer.");
  const reference = matches[0];
  if (!reference) throw new Error("That reference ID is not attached to this answer.");
  if (reference.state !== "fetched" || !reference.artifact) throw new Error(`Reference ${reference.id} is ${reference.state}${reference.reason ? `: ${reference.reason}` : "; no fetched bytes were recorded"}.`);
  const artifact = reference.artifact;
  const retained = comment.designReferences?.find((one) => one.artifact.home === artifact.home && one.artifact.canvasId === artifact.canvasId && one.artifact.itemId === artifact.itemId && one.artifact.versionId === artifact.versionId && one.artifact.blobHash === artifact.blobHash);
  if (!retained || retained.version.id !== artifact.versionId || retained.version.blobHash !== artifact.blobHash) throw new Error("The writer retained no matching version for this reference.");
  if (artifact.canvasId !== canvasId || normalizeHomeUrl(artifact.home) !== normalizeHomeUrl(await io.home(canvasId))) throw new Error("This reference belongs to another home or canvas; copy it through an authorized canvas path first.");
  const bytes = await io.blobBytes(canvasId, artifact.blobHash, request.signal);
  request.signal?.throwIfAborted();
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== artifact.blobHash || bytes.byteLength !== retained.version.size) throw new Error("Reference bytes do not match their retained version.");
  return { referenceId: reference.id, artifact, version: retained.version, bytes };
}
function identity(request) {
  for (const key of ["canvasId", "threadId", "commentId", "opId"]) {
    if (typeof request[key] !== "string" || !request[key].trim() || request[key].length > 256) throw new Error(`A bounded ${key} is required; retain it when retrying.`);
  }
}
function supportedRequest(request, fields) {
  if (Object.keys(request).some((key) => !fields.includes(key))) throw new Error("Unsupported questionnaire submission field; canonical context and retained references belong to the writer.");
}
function semantic(value) {
  if (Array.isArray(value)) return `[${value.map(semantic).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${semantic(child)}`).join(",")}}`;
  return JSON.stringify(value);
}
function questionnaireFailureStatus(error) {
  const status = error && typeof error === "object" && "status" in error ? error.status : void 0;
  return typeof status === "number" && [400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 426].includes(status) ? "refused" : "pending";
}
async function observedSubmission(io, request, op, result) {
  if (!io.snapshot) return result;
  try {
    const { canvas, joined } = await io.snapshot(request.canvasId, request.signal);
    const comment = canvas.threads[request.threadId]?.comments.find((one) => one.id === request.commentId);
    const payload = op.type === "questionnaire.ask" ? op.questions : op.response;
    const expectedActor = io.actorId ?? (op.type === "questionnaire.answer" ? op.response.respondentActorId : void 0);
    if (!comment || expectedActor === void 0 || resolveActor(joined ?? {}, comment.author.id) !== resolveActor(joined ?? {}, expectedActor) || !comment.design || !comment.designReferences || semantic(comment.design) !== semantic(payload) || op.type === "questionnaire.ask" && semantic(comment.designLegacySource ?? null) !== semantic(op.legacySource ?? null)) return result;
    return { status: "accepted", canvasId: result.canvasId, threadId: result.threadId, commentId: result.commentId, payloadId: result.payloadId, opId: null, submittedOpId: request.opId, confirmedBy: "snapshot" };
  } catch {
    return result;
  }
}
async function submit(io, request, op, payloadId) {
  identity(request);
  request.signal?.throwIfAborted();
  const result = { status: "pending", canvasId: request.canvasId, threadId: request.threadId, commentId: request.commentId, payloadId, opId: null, submittedOpId: request.opId };
  let delivered;
  try {
    delivered = await io.send(request.canvasId, op, { opId: request.opId, ...request.signal ? { signal: request.signal } : {} });
  } catch (error) {
    const failed = { ...result, status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error) };
    return failed.status === "pending" ? observedSubmission(io, request, op, failed) : failed;
  }
  if (delivered.status !== "accepted") {
    const failed = { ...result, status: delivered.status, reason: delivered.reason };
    return delivered.status === "pending" ? observedSubmission(io, request, op, failed) : failed;
  }
  const envelope = delivered.receipt?.envelope, saved = envelope?.op;
  const expectedActor = io.actorId ?? (op.type === "questionnaire.answer" ? op.response.respondentActorId : void 0);
  const expectedPayload = op.type === "questionnaire.ask" ? op.questions : op.response;
  const savedPayload = saved?.type === "questionnaire.ask" ? saved.questions : saved?.type === "questionnaire.answer" ? saved.response : void 0;
  let authorMatches = expectedActor === void 0 || envelope?.actor?.id === expectedActor;
  if (!authorMatches && io.snapshot) {
    try {
      const { joined } = await io.snapshot(request.canvasId, request.signal);
      authorMatches = resolveActor(joined ?? {}, envelope.actor.id) === resolveActor(joined ?? {}, expectedActor);
    } catch {
    }
  }
  if (typeof envelope?.id !== "string" || !envelope.id || envelope.canvasId !== request.canvasId || !authorMatches || saved?.type !== op.type || saved.threadId !== op.threadId || saved.commentId !== op.commentId || semantic(savedPayload) !== semantic(expectedPayload) || op.type === "questionnaire.ask" && saved.type === "questionnaire.ask" && semantic(saved.legacySource ?? null) !== semantic(op.legacySource ?? null)) {
    return observedSubmission(io, request, op, { ...result, reason: "The writer returned no matching questionnaire receipt. Keep this submission and check its IDs before retrying." });
  }
  return { ...result, status: "accepted", opId: envelope.id, seq: delivered.receipt.seq, confirmedBy: "receipt" };
}
async function askDesignQuestions(io, request) {
  supportedRequest(request, ["canvasId", "threadId", "commentId", "opId", "questions", "legacySource", "signal"]);
  const questions = parseDesignQuestionSet(request.questions);
  return submit(io, request, { type: "questionnaire.ask", threadId: request.threadId, commentId: request.commentId, questions, ...request.legacySource ? { legacySource: request.legacySource } : {} }, questions.id);
}
async function answerDesignQuestions(io, request) {
  supportedRequest(request, ["canvasId", "threadId", "commentId", "opId", "response", "signal"]);
  const response = parseDesignResponse(request.response);
  if (request.threadId !== response.question.threadId) throw new Error("The answer must use its question's exact thread.");
  return submit(io, request, { type: "questionnaire.answer", threadId: request.threadId, commentId: request.commentId, response }, response.id);
}
async function questionnaireSubmissionIds(kind, payloadId) {
  if (!payloadId.trim()) throw new Error("A saved payload ID is required.");
  const bytes = new TextEncoder().encode(`questionnaire:${kind}:${payloadId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return { opId: `op_${hash}`, commentId: `cmt_${hash}` };
}

export {
  readGoverningDesign,
  readDesignQuestions,
  readDesignReference,
  questionnaireFailureStatus,
  askDesignQuestions,
  answerDesignQuestions,
  questionnaireSubmissionIds
};
