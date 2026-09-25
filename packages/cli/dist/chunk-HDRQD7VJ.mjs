import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  canvasIdOf,
  checkDesign,
  contextLayers,
  designSkipped,
  designSystem,
  memoryLinks,
  normalizeHomeUrl,
  parseCanvasAddress,
  parseDesignQuestionSet,
  parseDesignResponse,
  personalMemoryLinks,
  questionnaireStates,
  resolveActor,
  selectDesignSystem,
  selectGoverningDesign,
  sourceOf
} from "./chunk-GXGIYXSG.mjs";
import {
  parseDesign
} from "./chunk-ZRGI5I2I.mjs";

// packages/api/src/context-reader.ts
function failure(error) {
  return error instanceof Error ? error.message : String(error);
}
async function classifyAutomaticSource(io, target, signal) {
  signal?.throwIfAborted();
  let home;
  try {
    const url = new URL(target.home);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid home");
    home = normalizeHomeUrl(target.home);
  } catch {
    return { kind: "unavailable", refused: "The source's authoritative home is unknown \u2014 not read from here." };
  }
  if (!target.canvasId) return { kind: "unavailable", refused: "This card has no source canvas address." };
  if (target.source) {
    let address;
    try {
      address = parseCanvasAddress(target.source);
    } catch {
      address = null;
    }
    if (!address || address.canvasId !== target.canvasId) return { kind: "unavailable", refused: "This card's source address does not match its canvas." };
    if (normalizeHomeUrl(address.origin) !== home) return { kind: "unavailable", refused: `lives at ${address.origin} \u2014 not read from here` };
  }
  try {
    const answer = await io.classifySource({ canvasId: target.canvasId, expectedHome: home }, signal);
    signal?.throwIfAborted();
    if (answer.kind === "ordinary") return { kind: "ordinary", expectedHome: home };
    if (answer.kind === "personal") return { kind: "personal", refused: "Personal canvas \u2014 automatic previews and inheritance are private." };
    return { kind: "unavailable", refused: "The source's authoritative home could not classify it \u2014 not read from here." };
  } catch (error) {
    signal?.throwIfAborted();
    return { kind: "unavailable", refused: failure(error) };
  }
}
async function readInheritedCanvases(io, canvas, home, signal) {
  const linked = [];
  for (const item of memoryLinks(canvas)) {
    signal?.throwIfAborted();
    const canvasId = canvasIdOf(item);
    const row = { item, canvasId, title: item.title, canvas: null };
    const access = await classifyAutomaticSource(io, { canvasId, home, source: sourceOf(item) }, signal);
    if (access.kind !== "ordinary") {
      linked.push({ ...row, refused: access.refused });
      continue;
    }
    try {
      const snapshot = await io.sourceSnapshot({ canvasId, expectedHome: access.expectedHome }, signal);
      signal?.throwIfAborted();
      linked.push({ item, canvasId, title: snapshot.project.title, canvas: snapshot.canvas });
    } catch (error) {
      signal?.throwIfAborted();
      linked.push({ ...row, refused: failure(error) });
    }
  }
  return linked;
}
async function readLayeredContext(io, options) {
  const { canvas, canvasId, home, signal } = options;
  signal?.throwIfAborted();
  let designProblems;
  let unavailable;
  const design = designSystem(canvas);
  const version = design?.versions.find((one) => one.id === design.currentVersionId);
  if (version && io.designText) {
    try {
      const text = await io.designText(canvasId, version.blobHash, signal);
      signal?.throwIfAborted();
      designProblems = checkDesign(parseDesign(text)).length;
    } catch (error) {
      signal?.throwIfAborted();
      unavailable = `Design system could not be read: ${failure(error)}`;
    }
  }
  const inherited = await readInheritedCanvases(io, canvas, home, signal);
  for (const link of inherited) {
    signal?.throwIfAborted();
    if (!link.canvas) continue;
    try {
      if (!io.sourceRecap) throw new Error("Recent work is unavailable from this connection.");
      const response = await io.sourceRecap({ canvasId: link.canvasId, expectedHome: normalizeHomeUrl(home) }, signal);
      signal?.throwIfAborted();
      let sourceHome = null;
      try {
        const parsed = new URL(response.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(response.home);
      } catch {
      }
      if (response.canvasId !== link.canvasId || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Recent work returned a different source \u2014 not shown.");
      }
      link.recap = { value: response };
    } catch (error) {
      signal?.throwIfAborted();
      link.recap = { refused: failure(error) };
    }
  }
  const layers = contextLayers(canvas, inherited, { ...options.extras, ...designProblems === void 0 ? {} : { designProblems } });
  if (unavailable) {
    const piece = layers[0]?.pieces.find((one) => one.name === "Design system");
    if (piece) piece.stale = unavailable;
  }
  if (options.personal === "exclude") return layers;
  const actorId = options.personal.actorId;
  if (!actorId) throw new Error("Personal Context requires an explicit claimed actor.");
  for (const item of personalMemoryLinks(canvas)) {
    signal?.throwIfAborted();
    const sourceCanvasId = canvasIdOf(item);
    try {
      const summary = await io.readPersonal(canvasId, { actorId, itemId: item.id, mode: "summary" }, signal);
      signal?.throwIfAborted();
      let sourceHome = null;
      try {
        const parsed = new URL(summary.home);
        if (["http:", "https:"].includes(parsed.protocol)) sourceHome = normalizeHomeUrl(summary.home);
      } catch {
      }
      if (summary.kind !== "personal" || summary.mode !== "summary" || summary.itemId !== item.id || summary.sourceCanvasId !== sourceCanvasId || sourceHome === null || sourceHome !== normalizeHomeUrl(home)) {
        throw new Error("Personal Context returned a different source \u2014 not shown.");
      }
      const heading = `${summary.owner.name}'s canvas`;
      layers.push({
        kind: "personal",
        itemId: item.id,
        canvasId: sourceCanvasId,
        owner: summary.owner,
        heading,
        pieces: summary.pieces.map((piece) => ({
          name: piece.kind === "design" ? "Design system" : piece.title,
          source: "canvas",
          present: !piece.unavailable,
          from: { canvasId: sourceCanvasId, title: heading },
          ...piece.unavailable ? { stale: piece.unavailable } : {}
        }))
      });
      if (summary.truncated) layers.at(-1).pieces.push({
        name: "More personal context",
        source: "canvas",
        present: false,
        stale: "This summary is truncated; use an explicit personal read for its current contributions."
      });
    } catch (error) {
      signal?.throwIfAborted();
      layers.push({ kind: "personal", itemId: item.id, canvasId: sourceCanvasId, owner: null, heading: item.title, pieces: [], refused: failure(error) });
    }
  }
  return layers;
}

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
  classifyAutomaticSource,
  readInheritedCanvases,
  readLayeredContext,
  readGoverningDesign,
  readDesignQuestions,
  readDesignReference,
  questionnaireFailureStatus,
  askDesignQuestions,
  answerDesignQuestions,
  questionnaireSubmissionIds
};
