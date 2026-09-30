import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  designRequestBasisCurrent
} from "./chunk-U4ZPMZI4.mjs";
import {
  import_websocket
} from "./chunk-OUU6V4OT.mjs";
import {
  packageRoot
} from "./chunk-2ZAY35XO.mjs";
import {
  ATTEST_ROUTE,
  BADGES_ROUTE,
  CANVAS_GROUPS_REQUIRED,
  CLIENT_FEATURES_HEADER,
  CLIENT_FEATURES_PARAM,
  COMMAND_NAME,
  CURRENT_CLIENT_FEATURES,
  DEFAULT_COMMANDS,
  DESIGN_REQUESTS_REQUIRED,
  DesignPartnerContractError,
  DesignRestoreConflict,
  FILENAME_HEADER,
  FREE_NAME_ROUTE,
  GOOGLE_DRIVE_ABOUT_URL,
  GRANTED_BY_HOME,
  GROUPS_ROUTE,
  GroupConflictError,
  INTERNAL_OP_TYPES,
  LINK,
  MigrationBoundaryError,
  NOT_ADMITTED,
  OpValidationError,
  OplogFencedError,
  PASS_REDEEM_ROUTE,
  PERSONA_DIR,
  QUESTIONNAIRES_REQUIRED,
  REFUSED,
  RUNGS,
  SHELF,
  SOURCE_POLICY_HEADER,
  SPACES_ROUTE,
  TAKEDOWNS_ROUTE,
  TAKEN_DOWN,
  UNKNOWN_ROUTE,
  VIEW_ONLY,
  WITHDRAWN,
  WS_BEHIND,
  WS_NOT_ADMITTED,
  WS_NO_CANVAS,
  activeDesignRepairEntries,
  activityOpType,
  actorAliases,
  actorColors,
  actorJoins,
  actorKinds,
  actorMarks,
  actorNames,
  advanceSeen,
  allocateName,
  ambientContextManifest,
  applyActorColor,
  applyActorJoin,
  applyActorMark,
  applyClaim,
  applyOperation,
  askTemplate,
  askTheDoor,
  atLeast,
  attestationSatisfying,
  badgeRoute,
  bearerHeader,
  bindHandoff,
  bindName,
  blobsInProperties,
  blobsNamedBy,
  buildRecapHead,
  canListGrant,
  canvasGroupMigrationPreview,
  canvasesRoute,
  capabilityOf,
  cidrContains,
  claimsActor,
  clipRecapLabel,
  collectCanvasNames,
  contextManifest,
  designComparisonStates,
  designDecisionIntentHash,
  designDecisionMarkdown,
  designInputTransition,
  designIntentHash,
  designPartnerPolicy,
  designRepairIntentHash,
  designRepairTransitions,
  designSystem,
  designTargetMatches,
  docTitleFrom,
  emptyActorRegistry,
  emptyCanvas,
  encodeFilename,
  enginesSatisfied,
  extensionFor,
  googleDocExportUrl,
  googleDocUrl,
  googleDriveExportUrl,
  googleDriveMetaUrl,
  grantRevokeRoute,
  grantsRoute,
  groupActingRoute,
  groupIdOf,
  groupMemberRoute,
  groupRoute,
  groupSubject,
  harnessOf,
  healthPath,
  inForce,
  inboxRoute,
  invertOperation,
  isAgentHarness,
  isBar,
  isGroupItem,
  isGroupLive,
  isListedGrant,
  isLive,
  isSpaceGrant,
  isSpaceLive,
  isSystemActor,
  legacyQuestionSet,
  mergeCommands,
  narrowed,
  newActorId,
  newId,
  newOpId,
  normalizeHomeUrl,
  notBothActors,
  notYourActor,
  noticeOf,
  ownsAgent,
  parseCidr,
  parseCommandFile,
  parseDesignBrief,
  parseDesignDecisionOperation,
  parseDesignQuestionSet,
  parseDesignReceipt,
  parseDesignRepairOperation,
  parseDesignRequestOperation,
  parseDesignResponse,
  parseLegacyQuestionnaire,
  parsePersona,
  passRoute,
  passesRoute,
  planDesignAnswer,
  positionIsMeaningful,
  publicListingRoute,
  questionnaireArtifacts,
  questionnaireSourceCurrent,
  questionnaireStates,
  rcAnsweringRoute,
  rcAskRoute,
  refusalInForce,
  refusalNoticeOf,
  refusalSentence,
  rejectPublicContext,
  rejectQuestionnaireMetadata,
  resolveActor,
  resolveCanvasGroupMigration,
  resolveCanvasGroupRequest,
  resolveContextOperation,
  resolvePlacement,
  retainedDesignVersion,
  sameDesignValue,
  scopeOf,
  seenMarksRoute,
  seenRoute,
  sortCanvases,
  sourceClassificationRoute,
  sourcePolicyHeader,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute,
  supportsCanvasGroups,
  supportsDesignDecisions,
  supportsDesignRepairs,
  supportsDesignRequests,
  supportsQuestionnaires,
  takedownSentence,
  undoneSeqs,
  upsertAttestation,
  validateContextManifest,
  validateDesignDecisionComment,
  validateDesignRecordState,
  validateDesignRecordVersion,
  validateDesignRepairCanonical,
  validateGroupForest,
  validateQuestionnaireComment
} from "./chunk-CKJONC76.mjs";
import {
  __export
} from "./chunk-JYOOXWJZ.mjs";

// packages/server/src/design-request.ts
import { createHash } from "node:crypto";

// packages/server/src/canvas-group-context.ts
async function hydrateContextManifest(store, state, manifest) {
  const metadata = /* @__PURE__ */ new Map();
  const entries = await Promise.all(manifest.entries.map(async (entry) => {
    const version = entry.version;
    const original = state.canvas.items[entry.itemId]?.versions.find((one) => one.id === version?.id);
    const visual = original?.visual;
    if (!version?.visual || !visual || visual.blobHash === original.blobHash || visual.filename !== void 0 && visual.size !== void 0) return entry;
    let lookup = metadata.get(visual.blobHash);
    if (!lookup) {
      lookup = store.blobMeta(manifest.canvasId, visual.blobHash);
      metadata.set(visual.blobHash, lookup);
    }
    const meta = await lookup;
    if (!meta) throw new OpValidationError("bad-op", `visual context metadata is unavailable for ${entry.itemId}; upload its visual blob before previewing or sending this context`);
    return { ...entry, version: { ...version, visual: {
      ...version.visual,
      ...visual.filename === void 0 ? { filename: meta.filename } : {},
      ...visual.size === void 0 ? { size: meta.size } : {}
    } } };
  }));
  return { ...manifest, entries };
}
async function contextBlobAvailable(store, canvasId, hash) {
  const meta = await store.blobMeta(canvasId, hash);
  if (!meta) return false;
  try {
    const stream = await store.openBlob(canvasId, hash, meta.size > 0 ? { start: 0, end: 0 } : void 0);
    if (!stream) return false;
    for await (const _chunk of stream) break;
    return true;
  } catch {
    return false;
  }
}

// packages/server/src/questionnaire.ts
function questionnaireActorKind(registry, id) {
  const canonical = resolveActor(registry.joined, id);
  const harnesses = Object.entries(registry.harnesses ?? {}).filter(([actorId]) => resolveActor(registry.joined, actorId) === canonical).map(([, harness]) => harness).filter((harness) => harness && harness.toLowerCase() !== "replica");
  if (isSystemActor(canonical) || !harnesses.length) return "unknown";
  return harnesses.some(isAgentHarness) ? "agent" : "human";
}
function questionnaireActors(state, registry, liveActors = []) {
  const actors = [state.project.createdBy, state.project.updatedBy, ...Object.values(state.canvas.items).flatMap((item) => [item.createdBy, item.updatedBy]), ...Object.values(state.canvas.threads).flatMap((thread) => thread.comments.map((comment) => comment.author)), ...Object.values(state.canvas.agents ?? {}).map((agent) => agent.actor), ...liveActors];
  for (const thread of Object.values(state.canvas.threads)) for (const comment of thread.comments) {
    const record = comment.designDecision?.record;
    const ids = record?.kind === "comparison" ? [record.audience.kind === "human" ? record.audience.respondentActorId : record.audience.reporterActorId] : record?.kind === "comparison-response" && record.outcome.kind === "delegate" ? [record.outcome.agentActorId] : [];
    for (const id of ids) {
      const canonical = resolveActor(registry.joined, id);
      actors.push({ id, name: registry.names[canonical]?.name ?? id });
    }
  }
  const found = /* @__PURE__ */ new Map();
  for (const actor of actors) {
    const id = resolveActor(registry.joined, actor.id);
    if (isSystemActor(id)) continue;
    found.set(id, { id, name: registry.names[id]?.name ?? actor.name, kind: questionnaireActorKind(registry, id) });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
var isQuestionnaireOperation = (op) => op.type === "questionnaire.ask" || op.type === "questionnaire.answer";
function bad(message) {
  throw new OpValidationError("bad-op", message);
}
function rejectPublicQuestionnaire(op) {
  try {
    rejectPublicPayload(op);
  } catch (error) {
    refuseContract(error);
  }
}
function refuseContract(error) {
  if (error instanceof DesignPartnerContractError || error instanceof SyntaxError) bad(error.message);
  throw error;
}
function rejectPublicPayload(op) {
  rejectQuestionnaireMetadata(op);
  if (!isQuestionnaireOperation(op)) return;
  const fields = op.type === "questionnaire.ask" ? ["type", "threadId", "commentId", "questions", "legacySource", "contextRequest"] : ["type", "threadId", "commentId", "response"];
  if (Object.keys(op).some((key) => !fields.includes(key))) bad("questionnaire canonical context/references are writer-owned or a field is unsupported");
  if (typeof op.threadId !== "string" || !op.threadId || typeof op.commentId !== "string" || !op.commentId) bad("questionnaire requires stable thread/comment IDs");
  if (op.type === "questionnaire.ask") {
    parseDesignQuestionSet(op.questions);
    if (op.legacySource !== void 0 && (!op.legacySource || typeof op.legacySource !== "object" || Array.isArray(op.legacySource) || Object.keys(op.legacySource).some((key) => !["threadId", "commentId", "body"].includes(key)) || ![op.legacySource.threadId, op.legacySource.commentId, op.legacySource.body].every((v) => typeof v === "string" && v.length > 0))) bad("invalid legacy source");
  } else parseDesignResponse(op.response);
}
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function intent(op) {
  const { context: _context, retainedReferences: _references, ...publicIntent } = op;
  return publicIntent;
}
function questionnaireRetry(entries, op, opId, actorId, registry) {
  const id = op.type === "questionnaire.ask" ? op.questions.id : op.response.id;
  const found = entries.find((entry) => opId !== void 0 && entry.envelope.id === opId) ?? entries.find((entry) => {
    const written = entry.envelope.op;
    return isQuestionnaireOperation(written) && (written.type === "questionnaire.ask" ? written.questions.id : written.response.id) === id;
  });
  if (!found) return null;
  if (!isQuestionnaireOperation(found.envelope.op) || stable(intent(found.envelope.op)) !== stable(intent(op)) || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId)) bad("questionnaire retry identity conflicts with its original payload or authenticated actor");
  return found;
}
async function readText(store, canvasId, hash) {
  const stream = await store.openBlob(canvasId, hash);
  if (!stream) return bad("questionnaire brief bytes are unavailable");
  let size = 0;
  const chunks = [];
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 1024 * 1024) bad("questionnaire brief exceeds one megabyte");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function exactHome(value, home) {
  try {
    const address = new URL(value);
    return address.origin === home && (address.pathname === "/" || address.pathname === "") && !address.search && !address.hash && !address.username && !address.password;
  } catch {
    return false;
  }
}
async function retain(store, state, home, artifact, retained = []) {
  if (artifact.canvasId !== state.project.id || !exactHome(artifact.home, home)) bad("questionnaire references must be readable versions at this canvas's authoritative home; copy external references explicitly first");
  const item = state.canvas.items[artifact.itemId];
  const previous = retained.find((ref) => ref.artifact.home === artifact.home && ref.artifact.canvasId === artifact.canvasId && ref.artifact.itemId === artifact.itemId && ref.artifact.versionId === artifact.versionId && ref.artifact.blobHash === artifact.blobHash);
  const existing = item?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash) ?? previous?.version;
  if (!existing || existing.blobHash !== artifact.blobHash) bad("questionnaire reference does not identify an available item version");
  const version = retainedDesignVersion(existing);
  if (!await contextBlobAvailable(store, state.project.id, version.blobHash)) bad("questionnaire reference bytes are unavailable");
  if (version.visual) {
    if (!await contextBlobAvailable(store, state.project.id, version.visual.blobHash)) bad("questionnaire visual reference bytes are unavailable");
    const metadata = await store.blobMeta(state.project.id, version.visual.blobHash);
    if (!metadata) bad("questionnaire visual reference metadata is unavailable");
    version.visual = { ...version.visual, filename: version.visual.filename ?? metadata.filename, size: version.visual.size ?? metadata.size };
  }
  return { artifact: structuredClone(artifact), version };
}
async function resolveQuestionnaireOperation(store, state, revision, op, actor, registry, home, history = []) {
  try {
    return await materialize(store, state, revision, op, actor, registry, home, history);
  } catch (error) {
    return refuseContract(error);
  }
}
async function materialize(store, state, revision, op, actor, registry, home, history) {
  if (!home) bad("questionnaire writer has no authoritative home address");
  if (!state.canvas.threads[op.threadId]) bad("questionnaire requires an existing thread");
  const source = op.type === "questionnaire.answer" ? questionnaireStates(state.canvas).find((q) => q.source.threadId === op.response.question.threadId && q.source.commentId === op.response.question.commentId && q.source.payloadId === op.response.question.payloadId && q.source.revision === op.response.question.revision) : void 0;
  const questions = op.type === "questionnaire.ask" ? parseDesignQuestionSet(op.questions) : source?.questions;
  if (!questions) bad("questionnaire source is unavailable");
  if (op.type === "questionnaire.answer" && op.threadId !== op.response.question.threadId) bad("answer must be posted to its source thread");
  const retainedBrief = await retain(store, state, home, questions.brief);
  const brief = parseDesignBrief(JSON.parse(await readText(store, state.project.id, retainedBrief.version.blobHash)));
  if (state.canvas.items[questions.brief.itemId]?.versions.find((v) => v.id === questions.brief.versionId)?.designRecord?.kind === "brief") validateAdmittedDesignQuestions(state, brief, questions, history, registry, op.type === "questionnaire.ask");
  if (state.canvas.items[questions.brief.itemId].currentVersionId !== questions.brief.versionId || brief.requestId !== questions.requestId || brief.epoch !== questions.epoch || brief.progress !== "active" || brief.context.canvasId !== state.project.id) bad("questionnaire request is stale, canceled or belongs to another canvas");
  const requestSource = brief.source;
  if (requestSource.entrance === "canvas-chat") {
    const requestComment = state.canvas.threads[requestSource.threadId]?.comments.find((comment) => comment.id === requestSource.commentId);
    if (!requestComment || resolveActor(registry.joined, requestComment.author.id) !== resolveActor(registry.joined, brief.requestingActorId)) bad("questionnaire original request source is unavailable or has a different requesting actor");
  }
  if (questionnaireActorKind(registry, questions.respondentActorId) !== "human") bad("questionnaire respondent is not a known human actor");
  let normalized;
  if (op.type === "questionnaire.ask") {
    if (questions.supersedes) {
      const previous = questionnaireStates(state.canvas).find((q) => sameSource(q.source, questions.supersedes));
      if (!previous || previous.status === "superseded" || previous.questions.requestId !== questions.requestId || resolveActor(registry.joined, previous.author.id) !== resolveActor(registry.joined, actor.id)) bad("questionnaire reissue must name this author's current question");
    }
    if (op.legacySource) {
      const legacy = state.canvas.threads[op.legacySource.threadId]?.comments.find((c) => c.id === op.legacySource.commentId);
      const payload = legacy && legacy.body === op.legacySource.body ? parseLegacyQuestionnaire(legacy.body) : null;
      if (!payload) bad("legacy question changed or is malformed");
      const expected = legacyQuestionSet(payload, questions);
      if (stable(expected) !== stable(questions)) bad("legacy adoption must preserve the normalized questions");
      if (Object.values(state.canvas.threads).some((t) => t.comments.some((c) => c.designLegacySource?.threadId === op.legacySource.threadId && c.designLegacySource.commentId === op.legacySource.commentId))) bad("legacy question has already been adopted");
    }
    normalized = { ...op, questions };
  } else {
    if (!source || source.status === "stale" || source.status === "superseded") bad("questionnaire source changed or was superseded");
    const response = parseDesignResponse(op.response);
    const canonicalActor = resolveActor(registry.joined, actor.id);
    const canonicalResponse = { ...response, respondentActorId: resolveActor(registry.joined, response.respondentActorId) };
    const canonicalQuestions = { ...questions, respondentActorId: resolveActor(registry.joined, questions.respondentActorId) };
    const plan = planDesignAnswer({ response: canonicalResponse, actor: { actorId: canonicalActor, kind: questionnaireActorKind(registry, actor.id) }, context: { request: { brief, ref: questions.brief }, questions: canonicalQuestions, source: source.source, sourceStatus: "current" }, commentId: op.commentId, opId: op.commentId, previousResponses: source.responses.map((r) => ({ ...r.response, respondentActorId: resolveActor(registry.joined, r.response.respondentActorId) })) });
    if (plan.kind === "already-recorded") bad("questionnaire response already exists; retry its original operation identity");
    for (const resolution of response.resolutions) if (resolution.state === "delegated" && questionnaireActorKind(registry, resolution.agentActorId) !== "agent") bad("questionnaire delegation requires a known agent");
    normalized = { ...op, response };
  }
  const design = normalized.type === "questionnaire.ask" ? normalized.questions : normalized.response;
  const references = await Promise.all(questionnaireArtifacts(design).map((artifact) => retain(store, state, home, artifact, normalized.type === "questionnaire.answer" ? source?.references : void 0)));
  for (const artifact of questionnaireArtifacts(design)) {
    const marker = state.canvas.items[artifact.itemId]?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash)?.designRecord;
    for (const retained of marker?.retainedReferences ?? []) if (!references.some((r) => stable(r.artifact) === stable(retained.artifact))) references.push(await retain(store, state, home, retained.artifact, marker.retainedReferences));
  }
  const withReferences = { ...normalized, retainedReferences: references };
  if (normalized.type === "questionnaire.ask" && normalized.contextRequest !== void 0) {
    if (state.project.groupMode !== "groups") bad("frozen selected context requires a group-mode canvas");
    return { ...withReferences, context: await hydrateContextManifest(store, state, contextManifest(state, revision, normalized.contextRequest)) };
  }
  return withReferences;
}
function sameSource(a, b) {
  return a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
}

// packages/server/src/design-request.ts
var bad2 = (message) => {
  throw new OpValidationError("bad-op", message);
};
var sha = (text) => createHash("sha256").update(text).digest("hex");
var sameRef = (a, b) => a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
var sameQuestion = (a, b) => a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
var reference = (home, canvasId, itemId, version) => ({ home, canvasId, itemId, versionId: version.id, blobHash: version.blobHash });
var isDesignRecordOperation = (op) => op.type === "design.request" || op.type === "design.receipt";
function rejectPublicDesignRecord(op) {
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Object.prototype.hasOwnProperty.call(value, "designRecord")) bad2("design admission metadata is writer-owned");
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(op);
  if (isDesignRecordOperation(op)) {
    try {
      parseDesignRequestOperation(op);
    } catch (error) {
      if (error instanceof DesignPartnerContractError) bad2(error.message);
      throw error;
    }
  }
}
function guardDesignRecordEdit(state, op) {
  const inner = op.type === "group.change" && op.action.kind === "content" ? op.action.operation : op;
  if (inner.type !== "item.edit" && inner.type !== "item.addVersion" && inner.type !== "item.setCurrentVersion") return;
  if (state.canvas.items[inner.itemId]?.versions.some((v) => v.designRecord)) bad2("admitted design records use design.request; published receipts are immutable");
}
async function designRecordRetry(entries, op, opId, actorId, registry) {
  const identity = op.type === "design.receipt" ? op.versionId : op.action.versionId;
  const found = entries.find((row) => opId && row.envelope.id === opId) ?? entries.find((row) => isDesignRecordOperation(row.envelope.op) && (row.envelope.op.type === "design.receipt" ? row.envelope.op.versionId : row.envelope.op.action.versionId) === identity);
  if (!found) return null;
  if (!isDesignRecordOperation(found.envelope.op) || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId) || await designIntentHash(found.envelope.op, found.envelope.actor.id) !== await designIntentHash(op, found.envelope.actor.id)) bad2("design retry conflicts with the original intent or authenticated actor");
  return found;
}
async function readRecord(store, canvasId, version) {
  const stream = await store.openBlob(canvasId, version.blobHash);
  if (!stream) return bad2("design record bytes are unavailable");
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes2 = Buffer.from(chunk);
    size += bytes2.length;
    if (size > 1024 * 1024) bad2("design record exceeds one megabyte");
    chunks.push(bytes2);
  }
  const bytes = Buffer.concat(chunks);
  if (sha(bytes) !== version.blobHash || bytes.length !== version.size) bad2("design record bytes differ from their canonical identity");
  return JSON.parse(bytes.toString("utf8"));
}
function currentVersion(state, home, ref) {
  if (ref.home !== home || ref.canvasId !== state.project.id) bad2("design request belongs to another home or canvas");
  const item = state.canvas.items[ref.itemId], version = item?.versions.find((v) => v.id === ref.versionId);
  if (!version || item.currentVersionId !== ref.versionId || version.blobHash !== ref.blobHash) bad2("design request version changed; preserve the draft and reread it");
  return version;
}
async function briefAt(store, state, home, ref) {
  const version = currentVersion(state, home, ref);
  if (version.designRecord?.kind !== "brief") bad2("this JSON item is not an admitted design request");
  validateDesignRecordVersion(version, state.project.id);
  const brief = parseDesignBrief(await readRecord(store, state.project.id, version));
  if (!brief.continuation || brief.requestId !== version.designRecord.requestId || brief.epoch !== version.designRecord.epoch || brief.context.canvasId !== state.project.id) bad2("design brief and admission metadata disagree");
  return brief;
}
function sourceComment(state, source) {
  return source.entrance === "canvas-chat" ? state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId) : void 0;
}
function designRequestReasons(state, brief, registry) {
  const reasons = [];
  if (brief.progress === "cancelled") reasons.push("The request is cancelled.");
  if (brief.source.entrance !== "canvas-chat") return reasons;
  const thread = state.canvas.threads[brief.source.threadId], comment = sourceComment(state, brief.source), capture = brief.continuation?.sourceCapture;
  if (!thread || !comment || resolveActor(registry.joined, comment.author.id) !== resolveActor(registry.joined, brief.requestingActorId)) return [...reasons, "The original request source is unavailable or has a different author."];
  if (!capture || sha(comment.body) !== capture.bodyHash) reasons.push("The original request text changed.");
  const boundary = thread.comments.findIndex((c) => c.id === capture?.boundaryCommentId);
  if (boundary < 0) reasons.push("The captured request boundary is unavailable.");
  else if (thread.comments.slice(boundary + 1).some((c) => c.body.trim() === "/cancel" && resolveActor(registry.joined, c.author.id) === resolveActor(registry.joined, brief.requestingActorId))) reasons.push("The requester cancelled this work in its source thread.");
  return reasons;
}
function localInputReasons(state, home, brief, ownItemId, history = []) {
  const transitions = designRepairTransitions(history);
  const refs = [...brief.context.entries.filter((e) => !e.excluded && !e.unavailable && e.version).map((e) => reference(home, state.project.id, e.itemId, e.version))];
  return [...new Set(refs.filter((ref) => ref.home === home && ref.canvasId === state.project.id && ref.itemId !== ownItemId && (state.canvas.items[ref.itemId]?.currentVersionId !== ref.versionId || state.canvas.items[ref.itemId]?.versions.find((v) => v.id === ref.versionId)?.blobHash !== ref.blobHash) && !designInputTransition(state.canvas, ownItemId, brief.requestId, brief.epoch, ref, transitions)).map((ref) => `Input ${ref.itemId} changed or is unavailable.`))];
}
async function designDecisionRequest(store, state, home, ref, epoch, registry, history = []) {
  const brief = await briefAt(store, state, home, ref);
  const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, ref.itemId, history)];
  if (brief.epoch !== epoch || brief.progress !== "active" || reasons.length) bad2(reasons.join(" ") || "The design request is no longer active at this epoch.");
  return brief;
}
function admittedQuestionEntries(entries, requestId, briefItemId) {
  const versions = /* @__PURE__ */ new Map();
  for (const row of entries) {
    const op = row.envelope.op;
    if (op.type !== "design.request" || !op.effect) continue;
    const effect = op.effect;
    const itemId = op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId;
    if (itemId !== briefItemId) continue;
    const version = effect.type === "group.change" ? effect.action.change.writes.flatMap((w) => w.kind === "create" && w.item.id === briefItemId ? w.item.versions : []).find((v) => v.id === op.action.versionId) : effect.version;
    if (version?.designRecord?.requestId === requestId) versions.set(version.id, version.blobHash);
  }
  return entries.filter((row) => row.envelope.op.type === "questionnaire.ask" && row.envelope.op.questions.requestId === requestId && row.envelope.op.questions.brief.itemId === briefItemId && versions.get(row.envelope.op.questions.brief.versionId) === row.envelope.op.questions.brief.blobHash);
}
function initialDesignQuestionIds(entries, requestId, briefItemId) {
  return [...new Set(admittedQuestionEntries(entries, requestId, briefItemId).flatMap((row) => row.envelope.op.type === "questionnaire.ask" && row.envelope.op.questions.discovery?.purpose === "initial" ? row.envelope.op.questions.questions.map((q) => q.id) : []))];
}
function validateAdmittedDesignQuestions(state, brief, questions, entries, registry, publishing) {
  if (!brief.continuation) return;
  const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, questions.brief.home, brief, questions.brief.itemId, entries)];
  if (reasons.length) bad2(reasons.join(" "));
  if (!publishing) return;
  const discovery = questions.discovery;
  if (!discovery) bad2("admitted request questions require discovery purpose and fact bindings");
  if (discovery.purpose === "initial" && !questions.supersedes && initialDesignQuestionIds(entries, brief.requestId, questions.brief.itemId).length) bad2("initial discovery is one batch; further questions need a consequential reason or explicit interview");
  if (discovery.factBindings.length !== questions.questions.length || discovery.factBindings.some((b) => !questions.questions.some((q) => q.id === b.questionId)) || new Set(discovery.factBindings.map((b) => b.factId)).size !== discovery.factBindings.length) bad2("each question needs one distinct durable fact binding");
  if (discovery.purpose === "initial" && (/* @__PURE__ */ new Set([...initialDesignQuestionIds(entries, brief.requestId, questions.brief.itemId), ...questions.questions.map((q) => q.id)])).size > 3) bad2("the request's initial allowance is three questions; use a consequential reason or explicit interview");
  if (questions.supersedes) {
    const prior = entries.map((row) => row.envelope.op).find((op) => op.type === "questionnaire.ask" && op.questions.id === questions.supersedes.payloadId && op.threadId === questions.supersedes.threadId && op.commentId === questions.supersedes.commentId && op.questions.revision === questions.supersedes.revision && op.questions.requestId === questions.requestId && op.questions.brief.itemId === questions.brief.itemId);
    if (prior?.type === "questionnaire.ask" && prior.questions.discovery?.purpose === "initial" && (discovery.purpose !== "initial" || questions.questions.some((q) => !prior.questions.questions.some((p) => p.id === q.id)) || discovery.factBindings.some((b) => prior.questions.discovery.factBindings.find((p) => p.questionId === b.questionId)?.factId !== b.factId))) bad2("initial reissue must preserve its question and fact identities");
  }
  if (discovery.purpose === "interview") {
    const origin = discovery.source;
    if (origin.entrance === "canvas-chat") {
      const comment = sourceComment(state, origin);
      if (!comment || resolveActor(registry.joined, comment.author.id) !== resolveActor(registry.joined, questions.respondentActorId)) bad2("interview provenance must name the intended respondent's actual request");
    } else if (brief.source.entrance !== "external-agent" || origin.externalRequestId !== brief.source.externalRequestId) bad2("native interview provenance must belong to this external request");
  }
}
async function captureContext(store, state, revision, source, request, previous) {
  const frozen = !previous && request === void 0 ? sourceComment(state, source)?.context : void 0;
  let kind, manifest;
  if (frozen) {
    kind = "source-comment";
    manifest = structuredClone(frozen);
  } else if (request || previous && previous.continuation?.scopeCapture.kind !== "current-ambient") {
    kind = "current-selection";
    manifest = contextManifest(state, revision, request ?? { rootIds: previous.context.rootIds, includeExcluded: previous.context.includeExcluded });
  } else {
    kind = "current-ambient";
    manifest = ambientContextManifest(state, revision);
  }
  manifest.entries = manifest.entries.map((entry) => ({ ...entry, version: entry.version && retainedDesignVersion(entry.version) }));
  return { context: await hydrateContextManifest(store, state, manifest), scopeCapture: { kind, revision: manifest.revision } };
}
function captureSource(state, brief, registry) {
  if (brief.source.entrance === "external-agent") return null;
  const comment = sourceComment(state, brief.source), thread = state.canvas.threads[brief.source.threadId];
  if (!comment || !thread || resolveActor(registry.joined, comment.author.id) !== resolveActor(registry.joined, brief.requestingActorId)) bad2("the original source must exist with its actual author");
  return { bodyHash: sha(comment.body), boundaryCommentId: thread.comments.at(-1).id };
}
function accepted(state, briefItemId, brief, additions = []) {
  const result = [...brief.continuation?.acceptedResponses ?? []];
  const questions = questionnaireStates(state.canvas, { requestId: brief.requestId });
  for (const record of additions) {
    if (result.some((r) => r.responseId === record.responseId && sameQuestion(r.question, record.question))) continue;
    const question = questions.find((q) => q.questions.brief.itemId === briefItemId && sameQuestion(q.source, record.question));
    if (!question || question.status === "superseded" || question.outstandingQuestionIds.length || !questionnaireSourceCurrent(state.canvas, question) || question.questions.epoch !== brief.epoch || !question.responses.some((r) => r.response.id === record.responseId) || question.responses.some((r) => r.response.supersedesResponseId === record.responseId)) bad2("reconciliation requires a settled batch and effective response to this request and epoch");
    result.push(record);
  }
  for (const record of additions) {
    const question = questions.find((q) => q.questions.brief.itemId === briefItemId && sameQuestion(q.source, record.question));
    const effective2 = question?.responses.filter((r) => !question.responses.some((later) => later.response.supersedesResponseId === r.response.id)) ?? [];
    if (effective2.some((r) => !result.some((accepted2) => accepted2.responseId === r.response.id && sameQuestion(accepted2.question, record.question)))) bad2("reconcile every effective response in the settled batch together");
  }
  return result;
}
async function retainReferences(store, state, home, refs, previous = []) {
  const result = [];
  const queue = [...refs];
  while (queue.length) {
    const artifact = queue.shift();
    if (artifact.home !== home || artifact.canvasId !== state.project.id) continue;
    if (result.some((r) => sameRef(r.artifact, artifact))) continue;
    if (result.length >= 4096) bad2("design references exceed the bounded retention limit");
    const original = state.canvas.items[artifact.itemId]?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash) ?? previous.find((r) => sameRef(r.artifact, artifact))?.version;
    if (!original || !await contextBlobAvailable(store, state.project.id, artifact.blobHash)) bad2(`design reference bytes are unavailable: ${artifact.itemId}`);
    const nested = original.designRecord?.retainedReferences ?? [];
    for (const row of nested) {
      queue.push(row.artifact);
      if (!previous.some((p) => sameRef(p.artifact, row.artifact))) previous.push(row);
    }
    const version = retainedDesignVersion(original);
    if (version.visual) {
      const meta = await store.blobMeta(state.project.id, version.visual.blobHash);
      if (!meta || !await contextBlobAvailable(store, state.project.id, version.visual.blobHash)) bad2("design visual evidence is unavailable");
      version.visual = { ...version.visual, filename: version.visual.filename ?? meta.filename, size: version.visual.size ?? meta.size };
    }
    result.push({ artifact: structuredClone(artifact), version });
  }
  return result;
}
function briefReferences(brief, home) {
  return [...brief.context.entries.flatMap((e) => e.version && !e.excluded && !e.unavailable ? [reference(home, brief.context.canvasId, e.itemId, e.version)] : []), ...brief.facts.flatMap((f) => f.sources), ...brief.references.flatMap((r) => r.artifact && r.state === "fetched" ? [r.artifact] : [])];
}
function governingReasons(state, home, receipt) {
  const binding = receipt.governing;
  if (!binding) return ["The receipt has no governing selection."];
  const at = binding.atItemId === null ? void 0 : state.canvas.items[binding.atItemId];
  if (binding.atItemId !== null && !at) return ["The governing scope is unavailable."];
  const none = state.project.properties.design === "none";
  if (none !== binding.explicitNone) return ["The explicit design policy changed."];
  const system = designSystem(state.canvas, at ? { at } : void 0), version = system?.versions.find((v) => v.id === system.currentVersionId);
  if (system && version) return binding.artifact && sameRef(binding.artifact, reference(home, state.project.id, system.id, version)) ? [] : ["The governing design system changed."];
  if (binding.artifact?.home === home && binding.artifact.canvasId === state.project.id) return ["The governing design system is unavailable."];
  return [];
}
async function materializeDesignRecord(store, state, revision, operation, actor, registry, home, opId, history = []) {
  try {
    return await materialize2(store, state, revision, operation, actor, registry, home, opId, history);
  } catch (error) {
    if (error instanceof DesignPartnerContractError || error instanceof SyntaxError) bad2(error.message);
    throw error;
  }
}
async function materialize2(store, state, revision, operation, actor, registry, home, opId, history = []) {
  const op = parseDesignRequestOperation(operation);
  if (isSystemActor(actor.id)) bad2("a design request needs an authenticated acting identity");
  let record, itemId, versionId, title, effect, retained;
  if (op.type === "design.request") {
    const action = op.action;
    itemId = action.kind === "start" ? action.itemId : action.brief.itemId;
    versionId = action.versionId;
    let brief, before;
    if (action.kind === "start") {
      if (action.admission === "automatic" && designPartnerPolicy(state.project.properties) !== "adaptive-v1") bad2("automatic design enrollment is off or unsupported");
      if (Object.values(state.canvas.items).some((item) => item.versions.some((v) => v.designRecord?.requestId === action.requestId && v.designRecord.kind === "brief"))) bad2("this request is already admitted; read or resume its brief");
      const source = action.source, original = sourceComment(state, source);
      if (source.entrance === "canvas-chat" && !original) bad2("the canvas request needs its actual source comment");
      const captured2 = await captureContext(store, state, revision, source, action.contextRequest);
      brief = { schemaVersion: 1, kind: "brief", requestId: action.requestId, epoch: 1, source, requestingActorId: original?.author.id ?? actor.id, progress: "active", ...action.fields, context: captured2.context, continuation: { sourceCapture: null, scopeCapture: captured2.scopeCapture, acceptedResponses: [], factProvenance: [] } };
      brief.continuation.sourceCapture = captureSource(state, brief, registry);
    } else {
      brief = await briefAt(store, state, home, action.brief);
      before = brief;
      if (brief.epoch !== action.epoch) bad2("the request epoch changed");
      if (action.kind !== "resume" && action.kind !== "cancel") {
        const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, itemId, history)];
        if (brief.progress !== "active" || reasons.length) bad2(reasons.join(" ") || "the request is no longer active");
      }
      const prior = brief;
      const settled = action.kind === "cancel" ? prior.continuation.acceptedResponses : accepted(state, itemId, prior, action.acceptedResponses);
      brief = { ...prior, ...action.kind === "cancel" ? {} : action.patch, continuation: { ...prior.continuation, acceptedResponses: settled }, progress: action.kind === "cancel" ? "cancelled" : action.kind === "complete" ? "completed" : "active" };
      if (action.kind === "resume") {
        const captured2 = await captureContext(store, state, revision, brief.source, action.contextRequest, prior);
        brief = { ...brief, epoch: prior.epoch + 1, context: captured2.context, continuation: { ...brief.continuation, sourceCapture: captureSource(state, brief, registry), scopeCapture: captured2.scopeCapture, resumedBy: { actorId: actor.id, reason: action.reason } } };
      }
    }
    const changed = action.kind === "start" ? action.fields : action.kind === "cancel" ? {} : action.patch ?? {};
    const provenance = new Map(brief.continuation.factProvenance.map((p) => [p.field, p]));
    for (const field of Object.keys(changed)) {
      if (!["audience", "primaryTask", "constraints", "facts"].includes(field)) continue;
      const kind = questionnaireActorKind(registry, actor.id) === "human" ? "direct" : "reported";
      if (field === "facts") {
        for (const fact of brief.facts) if (!before || JSON.stringify(before.facts.find((f) => f.id === fact.id)) !== JSON.stringify(fact)) provenance.set(`facts.${fact.id}`, { field: `facts.${fact.id}`, actorId: actor.id, kind });
        for (const key of provenance.keys()) if (key.startsWith("facts.") && !brief.facts.some((f) => key === `facts.${f.id}`)) provenance.delete(key);
      } else if (!before || JSON.stringify(before[field]) !== JSON.stringify(brief[field])) provenance.set(field, { field, actorId: actor.id, kind });
    }
    if (action.kind !== "start" && action.kind !== "cancel") for (const binding of action.acceptedResponses ?? []) {
      const question = questionnaireStates(state.canvas, { requestId: brief.requestId }).find((q) => q.questions.brief.itemId === itemId && sameQuestion(q.source, binding.question));
      const response = question?.responses.find((r) => r.response.id === binding.responseId);
      for (const resolution of response?.response.resolutions ?? []) if (resolution.state === "answered") {
        const factId = question?.questions.discovery?.factBindings.find((b) => b.questionId === resolution.questionId)?.factId;
        const field = factId && (["audience", "primaryTask", "constraints"].includes(factId) ? factId : `facts.${factId}`);
        if (field && (field.startsWith("facts.") ? "facts" in changed : field in changed)) provenance.set(field, { field, actorId: response.author.id, kind: "questionnaire", responseId: binding.responseId });
      }
    }
    brief.continuation.factProvenance = [...provenance.values()];
    if (brief.targetItemId !== null && !state.canvas.items[brief.targetItemId]) bad2("design target is unavailable");
    if (brief.groupId !== null && !state.canvas.items[brief.groupId]) bad2("design scope is unavailable");
    if (brief.outputIds.some((id) => !state.canvas.items[id])) bad2("a declared output is unavailable");
    if (action.kind === "complete" && brief.delivery !== "connected-app" && !brief.outputIds.length) bad2("complete the request with its actual output items");
    record = parseDesignBrief(brief);
    const previous = action.kind === "start" ? [] : currentVersion(state, home, action.brief).designRecord.retainedReferences;
    const captured = brief.context.entries.flatMap((e) => e.version && !e.excluded && !e.unavailable ? [{ artifact: reference(home, state.project.id, e.itemId, e.version), version: retainedDesignVersion(e.version) }] : []);
    retained = await retainReferences(store, state, home, briefReferences(brief, home), [...previous, ...captured]);
    title = action.kind === "start" ? action.title ?? "Design task" : state.canvas.items[itemId].title;
  } else {
    itemId = op.itemId;
    versionId = op.versionId;
    record = parseDesignReceipt(op.receipt);
    title = op.title ?? "Design receipt";
    const brief = await briefAt(store, state, home, record.brief);
    if (brief.progress !== "completed" || brief.epoch !== record.epoch || brief.requestId !== record.requestId) bad2("a receipt requires this exact completed request");
    const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, record.brief.itemId, history), ...governingReasons(state, home, record)];
    const transitions = designRepairTransitions(history);
    for (const ref of record.context) if (ref.home === home && ref.canvasId === state.project.id && !designInputTransition(state.canvas, record.brief.itemId, record.requestId, record.epoch, ref, transitions)) currentVersion(state, home, ref);
    if (reasons.length) bad2(reasons.join(" "));
    if (record.output.kind === "canvas" && record.governing?.atItemId !== record.output.artifact.itemId) bad2("governing selection must use the actual output scope");
    if (record.output.kind === "repository" && record.governing?.atItemId !== (brief.targetItemId ?? brief.groupId)) bad2("repository governing selection must use the request target or scope");
    if (record.output.kind === "canvas") {
      currentVersion(state, home, record.output.artifact);
      if (!brief.outputIds.includes(record.output.artifact.itemId)) bad2("receipt output was not completed by this brief");
    } else if (brief.delivery !== "connected-app") bad2("repository evidence needs a connected-app delivery");
    const refs = [record.brief, ...record.context, ...record.checks.flatMap((c) => c.evidence), ...record.output.kind === "canvas" ? [record.output.artifact] : [], ...record.governing?.artifact ? [record.governing.artifact] : []];
    retained = await retainReferences(store, state, home, refs, [...currentVersion(state, home, record.brief).designRecord.retainedReferences]);
  }
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n");
  if (bytes.length > 1024 * 1024) bad2("design record exceeds one megabyte");
  const blob = await store.putBlob(state.project.id, bytes, { mimeType: "application/json", filename: record.kind === "brief" ? "design-brief.json" : "design-receipt.json" });
  const marker = { schemaVersion: 1, kind: record.kind, requestId: record.requestId, epoch: record.epoch, opId, intentHash: await designIntentHash(op, actor.id), retainedReferences: retained };
  const version = { id: versionId, blobHash: blob.blobHash, size: blob.size, mimeType: "application/json", filename: record.kind === "brief" ? "design-brief.json" : "design-receipt.json", designRecord: marker };
  if (op.type === "design.request" && op.action.kind !== "start") effect = { type: "item.edit", itemId, version, expectedVersionId: op.action.brief.versionId, patch: {} };
  else {
    const position = op.type === "design.request" ? op.action : op;
    effect = { type: "item.add", itemId, version, title, width: position.width ?? 360, height: position.height ?? 280, placement: position.placement ?? (record.kind === "brief" && record.targetItemId ? { anchorItemId: record.targetItemId } : { x: 0, y: 0 }), ...record.kind === "brief" && state.project.groupMode === "groups" && record.groupId ? { containerId: record.groupId } : {} };
  }
  return { ...op, effect };
}
async function readDesignRequests(store, state, home, registry, history) {
  const requests = [], receipts = [], unavailable = [];
  for (const item of Object.values(state.canvas.items)) {
    const version = item.versions.find((v) => v.id === item.currentVersionId), marker = version?.designRecord;
    if (!version || !marker) continue;
    try {
      validateDesignRecordVersion(version, state.project.id);
      const ref = reference(home, state.project.id, item.id, version), value = await readRecord(store, state.project.id, version);
      if (marker.kind === "receipt") {
        const receipt = parseDesignReceipt(value);
        if (receipt.requestId !== marker.requestId || receipt.epoch !== marker.epoch) bad2("receipt admission metadata disagrees with its JSON");
        receipts.push({ ref, receipt, author: version.createdBy, marker, status: "current", reasons: [], checkFreshness: [] });
        continue;
      }
      const brief = parseDesignBrief(value);
      if (!brief.continuation || brief.requestId !== marker.requestId || brief.epoch !== marker.epoch) bad2("brief admission metadata disagrees with its JSON");
      const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, item.id, history)];
      const status = reasons.some((r) => /cancelled/.test(r)) ? "cancelled" : reasons.length ? "stale" : "current";
      const completion = history.find((entry) => entry.envelope.id === marker.opId && entry.envelope.op.type === "design.request" && entry.envelope.op.action.kind === "complete" && entry.envelope.op.action.versionId === ref.versionId);
      const action = completion?.envelope.op.type === "design.request" ? completion.envelope.op.action : void 0;
      const effect = completion?.envelope.op.type === "design.request" ? completion.envelope.op.effect : void 0;
      const exactCompletion = effect?.type === "item.edit" && effect.itemId === ref.itemId && effect.version.id === ref.versionId && effect.version.blobHash === ref.blobHash && effect.version.designRecord?.intentHash === marker.intentHash && effect.version.designRecord?.opId === marker.opId && completion?.envelope.actor.id === version.createdBy.id;
      const completedFrom = exactCompletion && brief.progress === "completed" && action?.kind === "complete" && action.epoch === brief.epoch && action.brief.home === ref.home && action.brief.canvasId === ref.canvasId && action.brief.itemId === ref.itemId && history.filter((entry) => entry.cause?.targetSeq === completion.seq).sort((a, b) => a.seq - b.seq).at(-1)?.cause?.kind !== "undo" ? { brief: action.brief, opId: completion.envelope.id } : null;
      requests.push({ ref, brief, author: version.createdBy, marker, status, reasons, completedFrom, remainingInitialQuestions: initialDesignQuestionIds(history, brief.requestId, item.id).length ? 0 : 3, questions: questionnaireStates(state.canvas, { requestId: brief.requestId }).filter((q) => q.questions.brief.itemId === item.id), receipts: [], allowedActions: status === "current" ? brief.progress === "completed" ? ["resume", "cancel", "receipt"] : ["update", "resume", "cancel", "complete"] : ["resume", "cancel"] });
    } catch (error) {
      unavailable.push({ itemId: item.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  for (const receipt of receipts) {
    const value = receipt.receipt;
    const request = requests.find((r) => r.brief.requestId === value.requestId && r.ref.itemId === value.brief.itemId);
    const shared = !request ? [{ reason: "The request is unavailable.", unavailable: true }] : [...!sameRef(value.brief, request.ref) || value.epoch !== request.brief.epoch || request.brief.progress !== "completed" ? [{ reason: "The completed brief changed.", unavailable: false }] : [], ...request.reasons.map((reason) => ({ reason, unavailable: false }))];
    const policy = [];
    const inspect = async (artifact, label, findings) => {
      if (artifact.home !== home || artifact.canvasId !== state.project.id) return;
      if (!await contextBlobAvailable(store, state.project.id, artifact.blobHash)) findings.push({ reason: `${label} bytes are unavailable.`, unavailable: true });
      else {
        try {
          currentVersion(state, home, artifact);
        } catch {
          findings.push({ reason: `${label} live binding changed or was removed.`, unavailable: false });
        }
      }
    };
    await inspect(value.brief, "Completed brief", shared);
    if (value.output.kind === "canvas") await inspect(value.output.artifact, "Output", shared);
    const transitions = designRepairTransitions(history);
    for (const artifact of value.context) {
      if (artifact.home === home && artifact.canvasId === state.project.id && designInputTransition(state.canvas, value.brief.itemId, value.requestId, value.epoch, artifact, transitions)) {
        if (!await contextBlobAvailable(store, state.project.id, artifact.blobHash)) policy.push({ reason: `Context ${artifact.itemId} bytes are unavailable.`, unavailable: true });
      } else await inspect(artifact, `Context ${artifact.itemId}`, policy);
    }
    policy.push(...governingReasons(state, home, value).map((reason) => ({ reason, unavailable: false })));
    if (value.governing?.artifact) await inspect(value.governing.artifact, "Governing source", policy);
    const all = [...shared, ...policy];
    for (const check of value.checks) {
      const findings = [...shared, ...check.kind === "source" || check.kind === "craft" ? policy : []];
      for (const artifact of check.evidence) if (artifact.home === home && artifact.canvasId === state.project.id && !await contextBlobAvailable(store, state.project.id, artifact.blobHash)) {
        const finding = { reason: `Evidence for ${check.id} is unavailable.`, unavailable: true };
        all.push(finding);
        findings.push(finding);
      }
      receipt.checkFreshness.push({ checkId: check.id, status: findings.some((f) => f.unavailable) ? "unavailable" : findings.length ? "stale" : "current", reasons: [...new Set(findings.map((f) => f.reason))] });
    }
    receipt.reasons = [...new Set(all.map((f) => f.reason))];
    receipt.status = all.some((f) => f.unavailable) ? "unavailable" : all.length ? "stale" : "current";
    if (request) request.receipts.push(receipt);
    else unavailable.push({ itemId: receipt.ref.itemId, reason: "The receipt\u2019s admitted request is unavailable." });
  }
  return { requests, unavailable };
}

// packages/server/src/design-repair.ts
var bad3 = (message) => {
  throw new OpValidationError("bad-op", message);
};
var isDesignRepairOperation = (op) => op.type === "design.repair";
function rejectPublicDesignRepair(op) {
  if (isDesignRepairOperation(op)) {
    try {
      parseDesignRepairOperation(op);
    } catch (error) {
      if (error instanceof DesignPartnerContractError) bad3(error.message);
      throw error;
    }
  }
}
async function designRepairRetry(history, op, opId, actorId, registry) {
  const found = history.find((r) => opId && r.envelope.id === opId) ?? history.find((r) => r.envelope.op.type === "design.repair" && (r.envelope.op.repair.id === op.repair.id || r.envelope.op.repair.version.id === op.repair.version.id));
  if (!found) return null;
  if (found.envelope.op.type !== "design.repair" || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId) || await designRepairIntentHash(found.envelope.op, found.envelope.actor.id) !== await designRepairIntentHash(op, found.envelope.actor.id)) throw new OpValidationError("design-intent-conflict", "This repair identity already belongs to a different canonical intent or actor.");
  return found;
}
async function materializeDesignRepair(store, state, home, operation, actor, registry, history) {
  try {
    const op = parseDesignRepairOperation(operation), r = op.repair, ref = r.target.artifact;
    if (isSystemActor(actor.id) || ref.home !== home || ref.canvasId !== state.project.id || !designTargetMatches(state.canvas, r.target)) bad3("The captured repair target content, metadata or scope changed.");
    const target = state.canvas.items[ref.itemId], before = target.versions.find((v) => v.id === ref.versionId);
    if (before.mimeType !== "text/html" || target.properties.kind === "group" || target.versions.some((v) => v.designRecord)) bad3("A repair requires an ordinary HTML source target.");
    if (target.versions.some((v) => v.id === r.version.id)) bad3("The repair version identity already exists.");
    const { DESIGN_AUDIT_VERSION } = await import("./designaudit-KVT5NFFI.mjs");
    if (r.ruleVersion !== DESIGN_AUDIT_VERSION) bad3("The captured source rule version changed.");
    if (r.request) {
      const brief = await designDecisionRequest(store, state, home, r.request.brief, r.request.epoch, registry, history);
      if (brief.requestId !== r.request.requestId || ref.itemId !== brief.targetItemId && !brief.outputIds.includes(ref.itemId)) bad3("A task repair must target its declared output or original target.");
    }
    const policy = governingReasons(state, home, r);
    if (policy.length) bad3(policy.join(" "));
    const blob = await store.blobMeta(state.project.id, r.version.blobHash);
    if (!blob || blob.size !== r.version.size || !await contextBlobAvailable(store, state.project.id, r.version.blobHash)) bad3("Replacement bytes are unavailable or differ from the prepared size.");
    const refs = [ref, ...r.request ? [r.request.brief] : [], ...r.review ? [r.review.run] : [], ...r.governing.artifact ? [r.governing.artifact] : []];
    const retainedReferences = await retainReferences(store, state, home, refs);
    return { ...op, effect: { type: "item.edit", itemId: ref.itemId, expectedVersionId: ref.versionId, expectedMetadata: { title: r.target.title, properties: r.target.properties }, patch: {}, version: { ...r.version, mimeType: "text/html", filename: before.filename } }, canonical: { intentHash: await designRepairIntentHash(op, actor.id), retainedReferences } };
  } catch (error) {
    if (error instanceof DesignPartnerContractError) bad3(error.message);
    throw error;
  }
}
async function readDesignRepairs(store, state, home, registry, history) {
  const repairs = [], unavailable = [];
  const active = new Set(activeDesignRepairEntries(history).map((r) => r.seq));
  const requests = history.some((row) => row.envelope.op.type === "design.repair" && row.envelope.op.repair.request) ? await readDesignRequests(store, state, home, registry, history) : null;
  for (const row of [...history].sort((a, b) => a.seq - b.seq)) {
    const op = row.envelope.op;
    if (op.type !== "design.repair") continue;
    try {
      validateDesignRepairCanonical(row.envelope);
      const r = op.repair, adopted = { ...r.target.artifact, versionId: r.version.id, blobHash: r.version.blobHash }, reasons = [];
      if (!designTargetMatches(state.canvas, { ...r.target, artifact: adopted })) reasons.push("The repaired output content, metadata or scope changed.");
      reasons.push(...governingReasons(state, home, r));
      if (r.request) {
        const current = requests?.requests.find((one) => one.ref.itemId === r.request.brief.itemId);
        if (!current || !designRequestBasisCurrent(current, r.request)) reasons.push(...current?.reasons.length ? current.reasons : ["The captured repair request changed or is unavailable."]);
      }
      let missing = !await contextBlobAvailable(store, state.project.id, adopted.blobHash);
      for (const ref of op.canonical.retainedReferences) if (!await contextBlobAvailable(store, state.project.id, ref.version.blobHash) || ref.version.visual && !await contextBlobAvailable(store, state.project.id, ref.version.visual.blobHash)) missing = true;
      if (missing) reasons.push("Some exact repair evidence is unavailable.");
      repairs.push({ opId: row.envelope.id, intentHash: op.canonical.intentHash, repair: r, author: { id: row.envelope.actor.id, name: row.envelope.actor.name }, adopted, before: op.canonical.retainedReferences.find((ref) => sameDesignValue(ref.artifact, r.target.artifact)).version, standing: active.has(row.seq) ? "active" : "undone", status: missing ? "unavailable" : reasons.length ? "stale" : "current", reasons, references: op.canonical.retainedReferences });
    } catch (error) {
      unavailable.push({ opId: row.envelope.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { repairs, unavailable };
}

// packages/server/src/grants.ts
async function subjectAdmits(subject, attestations, groupOf) {
  if (subject === LINK) return true;
  const groupId = groupIdOf(subject);
  if (groupId !== null) {
    const group = await groupOf(groupId);
    if (!group || !isGroupLive(group)) return false;
    return attestations.some((row) => group.members.includes(row.attribute));
  }
  return attestationSatisfying(subject, attestations) !== null;
}
function groupMemo(via) {
  const groups = /* @__PURE__ */ new Map();
  return (groupId) => {
    let found = groups.get(groupId);
    if (!found) {
      found = via.group(groupId);
      groups.set(groupId, found);
    }
    return found;
  };
}
async function admittingGrant(desk, canvasId, badge, creator = null, via = desk, scope = "entry") {
  const space = await via.spaceOf(canvasId);
  const grants = [
    ...await desk.grantsFor(canvasId),
    ...space ? await via.grantsForSpace(space.id) : []
  ];
  const live = grants.filter(isLive);
  const attestations = badge.attestations ?? [];
  const groupOf = groupMemo(via);
  let barred = false;
  for (const grant of live) {
    if (isBar(grant) && await subjectAdmits(grant.subject, attestations, groupOf)) {
      barred = true;
      break;
    }
  }
  if (!barred) {
    const rung = (grant) => RUNGS.indexOf(capabilityOf(grant));
    const rows = live.filter((grant) => !isBar(grant) && (scope === "entry" || grant.subject !== LINK)).sort((a, b) => rung(b) - rung(a) || a.at.localeCompare(b.at));
    for (const grant of rows) {
      if (await subjectAdmits(grant.subject, attestations, groupOf)) {
        return { grant, provenance: { root: "grant", grantId: grant.id }, capability: capabilityOf(grant) };
      }
    }
  }
  if (creator !== null || space !== null) {
    const claims = await desk.claimsOf(badge.badgeId);
    if (creator !== null && claimsActor(claims, creator)) {
      return { grant: null, provenance: { root: "created" }, capability: "own" };
    }
    if (space !== null && claimsActor(claims, space.createdBy)) {
      return { grant: null, provenance: { root: "space", spaceId: space.id }, capability: "own" };
    }
  }
  return null;
}
function rungOfAdmission(admission) {
  const root2 = admission.provenance.root;
  if (root2 === "created" || root2 === "space") return "own";
  if (root2 === "operator") return "view";
  return admission.capability ?? "edit";
}
function liveAdmission(admission, nowMs = Date.now()) {
  const root2 = admission.provenance;
  if (root2.root !== "operator") return true;
  const until = Date.parse(root2.until);
  return Number.isFinite(until) && nowMs < until;
}
function keepsAdmission(existing, provenance, capability) {
  return existing !== void 0 && liveAdmission(existing) && (provenance.root !== "pass" || existing.provenance.root === "operator" || atLeast(rungOfAdmission(existing), capability ?? "edit"));
}
function admissionIn(badge, canvasId, nowMs = Date.now()) {
  return badge.admissions.find((a) => a.canvasId === canvasId && liveAdmission(a, nowMs));
}
async function ensureLinkGrant(desk, canvasId, grantedBy) {
  if (await desk.personalSource(canvasId) || await desk.personalReplica(canvasId)) return null;
  const existing = await desk.grantsFor(canvasId);
  if (existing.length > 0) return null;
  const grant = {
    id: newId("gnt"),
    canvasId,
    subject: LINK,
    grantedBy,
    at: (/* @__PURE__ */ new Date()).toISOString()
  };
  await desk.putGrant(grant);
  return grant;
}
function ensureHomeLinkGrant(desk, canvasId) {
  return ensureLinkGrant(desk, canvasId, GRANTED_BY_HOME);
}

// packages/server/src/personal.ts
var PersonalError = class extends Error {
  constructor(message, code = "personal-refused") {
    super(message);
    this.code = code;
  }
  code;
  statusCode = 403;
};

// packages/server/src/engine.ts
import { createHash as createHash2 } from "node:crypto";
import { StringDecoder } from "node:string_decoder";

// packages/server/src/canvas-groups.ts
var CanvasGroupsClientError = class extends Error {
  code = CANVAS_GROUPS_REQUIRED;
  constructor() {
    super("This canvas uses groups. Update isocan and reload the app before opening it.");
    this.name = "CanvasGroupsClientError";
  }
};
function groupOperation(op) {
  if (op.type === "design.request" || op.type === "design.receipt") return op.effect !== void 0 && groupOperation(op.effect);
  if (op.type === "questionnaire.ask") return op.context !== void 0 || op.contextRequest !== void 0;
  if (op.type === "questionnaire.answer") return op.context !== void 0;
  if (op.type === "thread.create" || op.type === "thread.reply") return op.comment.context !== void 0 || op.comment.contextRequest !== void 0;
  if (op.type === "comment.update") return op.context !== void 0 || op.contextRequest !== void 0;
  if (op.type === "comment.restore") return op.comment.context !== void 0;
  if (op.type === "thread.restore") return op.thread.comments.some((comment) => comment.context !== void 0);
  return op.type === "group.change" || op.type === "project.create" && op.groupMode === "groups";
}
function requireGroupClient(features, canvas, entries = []) {
  if (!supportsCanvasGroups(features) && (canvas?.groupMode === "groups" || entries.some((entry) => groupOperation(entry.envelope.op) || entry.inverse !== null && entry.inverse !== void 0 && groupOperation(entry.inverse)))) {
    throw new CanvasGroupsClientError();
  }
}

// packages/server/src/design-repair-capability.ts
var DesignRepairClientError = class extends Error {
  code = "design-repairs-required";
  constructor() {
    super("This history uses design repairs. Update isocan and reload the app.");
    this.name = "DesignRepairClientError";
  }
};
function requireDesignRepairClient(features, entries) {
  if (!supportsDesignRepairs(features) && entries.some((e) => e.envelope.op.type === "design.repair" || e.inverse?.type === "design.repair")) throw new DesignRepairClientError();
}

// packages/server/src/design-request-capability.ts
var DesignRequestClientError = class extends Error {
  code = DESIGN_REQUESTS_REQUIRED;
  constructor() {
    super("This canvas uses admitted design requests. Update isocan and reload the app before opening it.");
    this.name = "DesignRequestClientError";
  }
};
function marked(value) {
  if (!value || typeof value !== "object") return false;
  const v = value;
  if (v.designRecord !== void 0 || v.discovery !== void 0 && v.kind === "questions") return true;
  return Object.values(v).some(marked);
}
function designRequestOperation(op) {
  return op.type === "design.request" || op.type === "design.receipt" || marked(op);
}
function requireDesignRequestClient(features, canvas, entries = []) {
  if (!supportsDesignRequests(features) && (canvas && marked(canvas) || entries.some((entry) => designRequestOperation(entry.envelope.op) || entry.inverse && designRequestOperation(entry.inverse)))) throw new DesignRequestClientError();
}

// packages/server/src/design-decision-capability.ts
var DesignDecisionClientError = class extends Error {
  code = "design-decisions-required";
  constructor() {
    super("This canvas uses design comparisons and decisions. Update isocan and reload the app.");
    this.name = "DesignDecisionClientError";
  }
};
function marked2(value) {
  if (!value || typeof value !== "object") return false;
  if ("designDecision" in value) return true;
  return Object.values(value).some(marked2);
}
function designDecisionOperation(op) {
  return ["design.compare", "design.respond", "design.decide", "design.restore"].includes(op.type) || marked2(op);
}
function requireDesignDecisionClient(features, canvas, entries = []) {
  if (!supportsDesignDecisions(features) && (canvas && marked2(canvas) || entries.some((e) => designDecisionOperation(e.envelope.op) || e.inverse && designDecisionOperation(e.inverse)))) throw new DesignDecisionClientError();
}

// packages/server/src/questionnaire-capability.ts
var QuestionnaireClientError = class extends Error {
  code = QUESTIONNAIRES_REQUIRED;
  constructor() {
    super("This canvas uses typed questionnaires. Update isocan and reload the app before opening it.");
    this.name = "QuestionnaireClientError";
  }
};
var typed = (comment) => !!comment.design || !!comment.designReferences || !!comment.designLegacySource;
function questionnaireOperation(op) {
  return op.type === "questionnaire.ask" || op.type === "questionnaire.answer" || op.type === "comment.restore" && typed(op.comment) || op.type === "thread.restore" && op.thread.comments.some(typed);
}
function requireQuestionnaireClient(features, canvas, entries = []) {
  requireDesignRepairClient(features, entries);
  requireDesignDecisionClient(features, canvas, entries);
  requireDesignRequestClient(features, canvas, entries);
  if (!supportsQuestionnaires(features) && (canvas && Object.values(canvas.threads).some((t) => t.comments.some(typed)) || entries.some((entry) => questionnaireOperation(entry.envelope.op) || entry.inverse && questionnaireOperation(entry.inverse)))) throw new QuestionnaireClientError();
}

// packages/server/src/design-decision.ts
var bad4 = (message) => {
  throw new OpValidationError("bad-op", message);
};
var sameActor = (registry, a, b) => resolveActor(registry.joined, a) === resolveActor(registry.joined, b);
var recordId = (op) => op.type === "design.compare" ? op.comparison.id : op.type === "design.respond" ? op.response.id : op.decision.id;
var isDesignDecisionOperation = (op) => ["design.compare", "design.respond", "design.decide"].includes(op.type);
function rejectPublicDesignDecision(op) {
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if ("designDecision" in value) bad4("design decision metadata is writer-owned");
    for (const v of Object.values(value)) visit(v);
  };
  visit(op);
  if (isDesignDecisionOperation(op)) {
    try {
      parseDesignDecisionOperation(op);
    } catch (error) {
      if (error instanceof DesignPartnerContractError) bad4(error.message);
      throw error;
    }
  }
}
async function designDecisionRetry(entries, op, opId, actorId, registry) {
  const found = entries.find((e) => opId && e.envelope.id === opId) ?? entries.find((e) => isDesignDecisionOperation(e.envelope.op) && (recordId(e.envelope.op) === recordId(op) || e.envelope.op.commentId === op.commentId || e.envelope.op.type === "design.decide" && op.type === "design.decide" && e.envelope.op.decision.versionId === op.decision.versionId));
  if (!found) return null;
  if (!isDesignDecisionOperation(found.envelope.op) || !sameActor(registry, found.envelope.actor.id, actorId) || await designDecisionIntentHash(found.envelope.op, found.envelope.actor.id) !== await designDecisionIntentHash(op, found.envelope.actor.id)) throw new OpValidationError("design-intent-conflict", "This stable design identity already belongs to another canonical intent or actor.");
  return found;
}
function comments(state) {
  return Object.values(state.canvas.threads).flatMap((t) => t.comments.map((comment) => ({ threadId: t.id, comment })));
}
function decisions(state) {
  return comments(state).flatMap((row) => {
    const record = row.comment.designDecision?.record;
    return record?.kind === "adoption-decision" ? [{ ...row, record }] : [];
  });
}
function effective(state) {
  const all = decisions(state);
  return all.filter((r) => !all.some((next) => next.record.input.supersedesDecisionId === r.record.input.id));
}
function currentRef(state, home, ref) {
  const item = state.canvas.items[ref.itemId], version = item?.versions.find((v) => v.id === ref.versionId);
  if (ref.home !== home || ref.canvasId !== state.project.id || !item || item.currentVersionId !== ref.versionId || !version || version.blobHash !== ref.blobHash) bad4("An approved alternative or target changed or is unavailable.");
  return { item, version };
}
function external(brief, registry, actor, id) {
  const owner = brief.continuation?.resumedBy?.actorId ?? brief.requestingActorId;
  if (brief.source.entrance !== "external-agent" || brief.source.externalRequestId !== id || questionnaireActorKind(registry, actor.id) !== "agent" || !sameActor(registry, owner, actor.id)) bad4("Native reports require the original reporter or an explicitly resumed current worker.");
}
function audience(comparison, brief, registry) {
  const a = comparison.audience;
  if (a.kind === "human") {
    if (questionnaireActorKind(registry, a.respondentActorId) !== "human") bad4("The intended respondent is not a known human.");
  } else external(brief, registry, { id: a.reporterActorId, name: "Reporter" }, a.externalRequestId);
}
function human(comparison, registry, actor) {
  if (comparison.audience.kind !== "human" || questionnaireActorKind(registry, actor.id) !== "human" || !sameActor(registry, comparison.audience.respondentActorId, actor.id)) bad4("Only the named known human can supply this response or preference.");
}
function sourceComparison(state, source, allowOldBrief = false) {
  const row = designComparisonStates(state.canvas).find((c) => sameDesignValue(c.source, source));
  if (!row || row.status === "superseded" || row.status === "stale" && !allowOldBrief || row && state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId)?.body !== designDecisionMarkdown(row.comparison)) bad4("The comparison source changed or was superseded; review a refreshed comparison.");
  return row;
}
async function materializeDesignDecision(store, state, home, op, actor, registry, opId, ts, history = []) {
  try {
    return await materialize3(store, state, home, parseDesignDecisionOperation(op), actor, registry, opId, ts, history);
  } catch (error) {
    if (error instanceof DesignPartnerContractError) bad4(error.message);
    throw error;
  }
}
async function materialize3(store, state, home, op, actor, registry, opId, ts, history = []) {
  if (isSystemActor(actor.id) || !state.canvas.threads[op.threadId]) bad4("Design acts require an actual actor and existing thread.");
  if (comments(state).some((row) => row.comment.id === op.commentId)) bad4("The design comment identity already exists.");
  const selected = op.type === "design.respond" ? sourceComparison(state, op.response.comparison) : op.type === "design.decide" && op.decision.source.kind === "comparison" ? sourceComparison(state, op.decision.source.source) : void 0;
  const comparison = op.type === "design.compare" ? op.comparison : selected?.comparison ?? (op.type === "design.decide" && op.decision.source.kind === "direct" ? op.decision.source.proposal : bad4("Missing comparison source."));
  if (selected && selected.source.threadId !== op.threadId) bad4("A design outcome belongs in its comparison thread.");
  const briefRef = op.type === "design.decide" ? op.decision.basis.brief : comparison.brief;
  const brief = await designDecisionRequest(store, state, home, briefRef, comparison.epoch, registry, history);
  if (brief.requestId !== comparison.requestId || !sameDesignValue(briefRef, comparison.brief) || comparison.target.itemId !== brief.targetItemId || comparison.target.groupId !== brief.groupId) bad4("Comparison belongs to another request or target.");
  audience(comparison, brief, registry);
  const previous = effective(state).find((r) => r.record.input.requestId === brief.requestId && r.record.input.basis.brief.itemId === briefRef.itemId && r.record.input.basis.epoch === brief.epoch && r.record.input.decisionKey === comparison.decisionKey);
  if (comparison.correctsDecisionId !== null ? previous?.record.input.id !== comparison.correctsDecisionId : !brief.outstandingDecisionIds.includes(comparison.decisionKey) || previous) bad4("Comparison requires an outstanding decision or explicit correction of the current decision.");
  for (const option of comparison.alternatives) currentRef(state, home, option.artifact);
  const policy = governingReasons(state, home, { governing: comparison.governing });
  if (policy.length) bad4(policy.join(" "));
  let record = comparison;
  let references = [comparison.brief, ...comparison.alternatives.map((a) => a.artifact)];
  let edit;
  if (op.type === "design.compare") {
    if (comparison.supersedes) {
      const prior = sourceComparison(state, comparison.supersedes, true);
      if (!sameActor(registry, prior.author.id, actor.id) || prior.comparison.requestId !== comparison.requestId || prior.comparison.brief.itemId !== comparison.brief.itemId || prior.comparison.epoch !== comparison.epoch || prior.comparison.decisionKey !== comparison.decisionKey || comparison.revision !== prior.comparison.revision + 1) bad4("Reissue requires this author's current exact comparison.");
    }
    if (comparison.followsResponseId) {
      const states = designComparisonStates(state.canvas), visited = /* @__PURE__ */ new Set();
      let predecessor = comparison.supersedes, found = false;
      while (predecessor) {
        const prior = states.find((r) => sameDesignValue(r.source, predecessor)) ?? bad4("Follow-on predecessor is missing.");
        if (!prior || visited.has(prior.comparison.id) || !sameActor(registry, prior.author.id, actor.id) || prior.comparison.requestId !== comparison.requestId || prior.comparison.brief.itemId !== comparison.brief.itemId || prior.comparison.epoch !== comparison.epoch || prior.comparison.decisionKey !== comparison.decisionKey || state.canvas.threads[prior.source.threadId]?.comments.find((c) => c.id === prior.source.commentId)?.body !== designDecisionMarkdown(prior.comparison) || states.filter((r) => sameDesignValue(r.comparison.supersedes, prior.source)).length > 1) bad4("Follow-on comparison requires an exact authored predecessor chain.");
        visited.add(prior.comparison.id);
        const response = prior.effectiveResponse?.response;
        if (response?.id === comparison.followsResponseId) {
          if (response.requestId !== brief.requestId || response.epoch !== brief.epoch || !sameDesignValue(response.comparison, prior.source) || response.outcome.kind !== "more" && response.outcome.kind !== "combine") bad4("Follow-on comparison requires the effective original revision response.");
          found = true;
          break;
        }
        if (prior.comparison.followsResponseId !== comparison.followsResponseId || !prior.comparison.supersedes) break;
        const before = states.find((r) => sameDesignValue(r.source, prior.comparison.supersedes));
        if (!before || prior.comparison.revision !== before.comparison.revision + 1) bad4("Follow-on comparison predecessor is missing or nonconsecutive.");
        predecessor = prior.comparison.supersedes;
      }
      if (!found) bad4("Follow-on comparison must name an effective revision request in its own predecessor chain.");
    }
  } else if (op.type === "design.respond") {
    const response = op.response;
    if (response.requestId !== brief.requestId || response.epoch !== brief.epoch) bad4("Response belongs to another request or epoch.");
    if (response.authority.kind === "human") human(comparison, registry, actor);
    else {
      external(brief, registry, actor, response.authority.externalRequestId);
      if (comparison.audience.kind !== "external-agent" || !sameActor(registry, comparison.audience.reporterActorId, actor.id)) bad4("Native response does not belong to this comparison reporter.");
    }
    const live = selected.responses.filter((r) => !selected.responses.some((next) => next.response.supersedesResponseId === r.response.id));
    if (live.length ? live.length !== 1 || response.supersedesResponseId !== live[0].response.id || !sameActor(registry, live[0].author.id, actor.id) : response.supersedesResponseId !== null) bad4("A response must explicitly supersede this actor's current response.");
    if (response.outcome.kind === "delegate" && questionnaireActorKind(registry, response.outcome.agentActorId) !== "agent") bad4("Delegation requires a known actual agent.");
    if (response.outcome.kind === "combine" && response.outcome.parts.some((p) => !comparison.alternatives.some((a) => a.id === p.optionId))) bad4("Combination names an unknown option.");
    record = response;
  } else {
    const d = op.decision, a = d.authority;
    if (selected?.effectiveResponse && ["more", "combine"].includes(selected.effectiveResponse.response.outcome.kind)) bad4("This comparison has a pending revision request; publish and review the new result before adoption.");
    if (d.requestId !== brief.requestId || d.decisionKey !== comparison.decisionKey || d.basis.epoch !== brief.epoch || !sameDesignValue(d.basis.alternatives, comparison.alternatives.map((o) => o.artifact))) bad4("Approval no longer matches the complete comparison.");
    if (d.supersedesDecisionId !== (previous?.record.input.id ?? null)) bad4("The accepted decision changed.");
    if (a.kind === "human-choice") human(comparison, registry, actor);
    else if (a.kind === "external-report") {
      external(brief, registry, actor, a.externalRequestId);
      if (comparison.audience.kind !== "external-agent" || !sameActor(registry, comparison.audience.reporterActorId, actor.id)) bad4("Native decision does not belong to this comparison reporter.");
    } else if (a.kind === "canvas-delegation") {
      const r = selected?.responses.find((r2) => r2.response.id === a.responseId && !selected.responses.some((next) => next.response.supersedesResponseId === r2.response.id));
      if (questionnaireActorKind(registry, actor.id) !== "agent" || !r || r.response.authority.kind !== "human" || r.response.outcome.kind !== "delegate" || !sameActor(registry, r.response.outcome.agentActorId, actor.id)) bad4("A delegated choice requires the exact effective human delegation to this agent.");
    } else if (questionnaireActorKind(registry, actor.id) !== "agent" || d.source.kind !== "direct" || comparison.mode !== "direct" || comparison.alternatives.length !== 1 || designComparisonStates(state.canvas).some((r) => r.comparison.requestId === brief.requestId && r.comparison.brief.itemId === briefRef.itemId && r.comparison.epoch === brief.epoch && r.comparison.decisionKey === d.decisionKey && r.comparison.audience.kind === "human" && r.status !== "superseded")) bad4("Agent judgment is an explicit direct path and cannot settle a named-human comparison.");
    const chosen = comparison.alternatives.find((o) => o.id === d.chosenAlternativeId);
    if (!chosen) bad4("Unknown chosen option.");
    const target = currentRef(state, home, d.basis.target.artifact), source = currentRef(state, home, chosen.artifact);
    if (!designTargetMatches(state.canvas, d.basis.target) || target.item.id !== (brief.targetItemId ?? chosen.artifact.itemId)) bad4("The approved target metadata or scope changed.");
    if (target.item.properties.kind === "group" || target.item.versions.some((v) => v.designRecord) || target.version.mimeType !== source.version.mimeType || !["text/html", "image/svg+xml"].includes(target.version.mimeType)) bad4("The selected MIME cannot replace this screen target.");
    if (d.basis.governing.atItemId !== target.item.id) bad4("Approval governing scope must name its actual target.");
    const drift = governingReasons(state, home, { governing: d.basis.governing });
    if (drift.length) bad4(drift.join(" "));
    if (target.item.versions.some((v) => v.id === d.versionId)) bad4("The adoption version already exists.");
    const adopted = { ...d.basis.target.artifact, versionId: d.versionId, blobHash: source.version.blobHash };
    record = { schemaVersion: 1, kind: "adoption-decision", input: d, comparison, recommendationAuthor: selected?.author ?? { id: actor.id, name: actor.name }, adopted };
    references.push(d.basis.target.artifact);
    edit = { type: "item.edit", itemId: target.item.id, expectedVersionId: target.version.id, expectedMetadata: { title: d.basis.target.title, properties: d.basis.target.properties }, patch: {}, version: { id: d.versionId, blobHash: source.version.blobHash, mimeType: source.version.mimeType, filename: target.version.filename, size: source.version.size, ...source.version.visual ? { visual: structuredClone(source.version.visual) } : {} } };
  }
  const retained = await retainReferences(store, state, home, references, selected?.references);
  if (edit && record.kind === "adoption-decision") retained.push({ artifact: record.adopted, version: { ...edit.version, createdBy: { id: actor.id, name: actor.name }, createdAt: ts } });
  const comment = { id: op.commentId, author: { id: actor.id, name: actor.name }, createdAt: ts, body: designDecisionMarkdown(record), designDecision: { schemaVersion: 1, opId, intentHash: await designDecisionIntentHash(op, actor.id), record }, designReferences: retained };
  validateDesignDecisionComment(comment, state.project.id);
  return op.type === "design.decide" ? { ...op, effect: { edit, threadId: op.threadId, comment } } : { ...op, canonicalComment: comment };
}
async function readDesignDecisions(store, state, home, registry, history) {
  const comparisons = designComparisonStates(state.canvas), all = decisions(state), current = effective(state), records = [];
  for (const entry of [...history].sort((a, b) => a.seq - b.seq)) {
    const op = entry.envelope.op;
    if (op.type !== "design.decide" || !op.effect) continue;
    const comment = op.effect.comment, decision = comment.designDecision?.record;
    if (decision?.kind !== "adoption-decision") continue;
    const live = all.find((r) => r.record.input.id === decision.input.id), causes = history.filter((h) => h.cause?.targetSeq === entry.seq).sort((a, b) => a.seq - b.seq), undone = causes.at(-1)?.cause?.kind === "undo";
    const standing = live ? current.some((r) => r.record.input.id === decision.input.id) ? "effective" : "superseded" : undone ? "undone" : "removed";
    const reasons = [];
    if (!designTargetMatches(state.canvas, { ...decision.input.basis.target, artifact: decision.adopted })) reasons.push("The adopted output content, metadata or scope changed.");
    const comparison = decision.comparison;
    try {
      await designDecisionRequest(store, state, home, comparison.brief, comparison.epoch, registry, history);
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : String(error));
    }
    for (const option of comparison.alternatives) {
      try {
        currentRef(state, home, option.artifact);
      } catch {
        if (!designInputTransition(state.canvas, comparison.brief.itemId, comparison.requestId, comparison.epoch, option.artifact)) reasons.push(`Alternative ${option.id} changed or is unavailable.`);
      }
    }
    if (decision.input.source.kind === "comparison") {
      const source = decision.input.source.source, saved = state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId);
      if (!saved || saved.body !== designDecisionMarkdown(comparison) || !sameDesignValue(saved.designDecision?.record, comparison)) reasons.push("The original comparison source changed or is unavailable.");
    }
    reasons.push(...governingReasons(state, home, { governing: decision.input.basis.governing }));
    let missing = false;
    for (const ref of comment.designReferences ?? []) if (!await contextBlobAvailable(store, state.project.id, ref.version.blobHash) || ref.version.visual && !await contextBlobAvailable(store, state.project.id, ref.version.visual.blobHash)) missing = true;
    if (missing) reasons.push("Some retained decision evidence is unavailable.");
    records.push({ source: { threadId: op.threadId, commentId: op.commentId, payloadId: decision.input.id, revision: 1 }, decision, author: comment.author, opId: entry.envelope.id, intentHash: comment.designDecision.intentHash, standing, status: missing ? "unavailable" : reasons.length ? "stale" : "current", reasons, references: comment.designReferences ?? [] });
  }
  for (const row of comparisons) {
    const comparison = row.comparison;
    try {
      const brief = await designDecisionRequest(store, state, home, comparison.brief, comparison.epoch, registry, history);
      if (brief.source.entrance === "external-agent") row.currentReporterActorId = brief.continuation?.resumedBy?.actorId ?? brief.requestingActorId;
      for (const option of comparison.alternatives) {
        try {
          currentRef(state, home, option.artifact);
        } catch (error) {
          if (!designInputTransition(state.canvas, comparison.brief.itemId, comparison.requestId, comparison.epoch, option.artifact)) throw error;
        }
      }
      row.reasons.push(...governingReasons(state, home, { governing: comparison.governing }));
    } catch (error) {
      row.reasons.push(error instanceof Error ? error.message : String(error));
    }
    if (row.reasons.length && row.status !== "superseded") row.status = "stale";
  }
  return { comparisons, decisions: records, unavailable: [] };
}

// packages/server/src/undo.ts
var UndoStacks = class _UndoStacks {
  byActor = /* @__PURE__ */ new Map();
  /**
   * **A person may hold several stacks** (multi-identity phase 5). After
   * `actor.join` folds `Dimitri 2` into Dimitri, Dimitri's ⌘Z reaches the ops
   * either id wrote, in log order. The stacks stay per actor id — that is what
   * the log records — and every question below accepts the list of ids that
   * resolve to one person (`actorAliases`), walking them as one stack. A
   * caller with a single id gets exactly the behaviour there always was.
   */
  /** targetSeq → seq of the undo entry that reversed it. */
  undoneBy = /* @__PURE__ */ new Map();
  /**
   * seq → the gesture it was part of, for the entries that named one.
   *
   * A group is what makes one ⌘Z reverse one ACT rather than one operation:
   * a paste of eight items writes eight `item.add`s, and undoing them one at
   * a time is undoing something nobody did. See `LogEntry.group`.
   */
  groupOf = /* @__PURE__ */ new Map();
  static rebuild(entries) {
    const stacks = new _UndoStacks();
    for (const entry of entries) stacks.record(entry);
    return stacks;
  }
  stacksFor(actorId) {
    let stacks = this.byActor.get(actorId);
    if (!stacks) {
      stacks = { undo: [], redo: [] };
      this.byActor.set(actorId, stacks);
    }
    return stacks;
  }
  /** Track an entry as it is appended (or replayed on load). Undo/redo
   * entries affect the stacks of the actor who performed them — which is
   * always the owner of their target, since stacks are per-actor. */
  record(entry) {
    const stacks = this.stacksFor(entry.envelope.actor.id);
    if (entry.cause?.kind === "undo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.set(target, entry.seq);
      for (const other of this.byActor.values()) {
        other.undo = other.undo.filter((seq) => seq !== target);
      }
      stacks.redo.push(target);
    } else if (entry.cause?.kind === "redo") {
      const target = entry.cause.targetSeq;
      this.undoneBy.delete(target);
      for (const other of this.byActor.values()) {
        other.redo = other.redo.filter((seq) => seq !== target);
      }
      stacks.undo.push(target);
    } else {
      const op = entry.envelope.op;
      const migration = op.type === "group.change" && op.action.kind === "apply" && op.action.change.intent === "migrate";
      if (!migration) stacks.redo = [];
      if (entry.group !== void 0 && !migration) this.groupOf.set(entry.seq, entry.group);
      if (entry.inverse !== null) stacks.undo.push(entry.seq);
    }
  }
  /**
   * One person's stack across every id they wrote under. An undo stack is
   * in log order per id, so the merge is a sort by seq. A redo stack is in
   * the order things were UNDONE — the last thing undone is the first thing
   * redone — so the merge sorts by the seq of the undo entry that put each
   * target there, which `undoneBy` remembers.
   */
  merged(who, which) {
    const ids = typeof who === "string" ? [who] : who;
    if (ids.length === 1) return this.stacksFor(ids[0])[which];
    const all = [];
    for (const id of ids) all.push(...this.stacksFor(id)[which]);
    const key = (seq) => which === "undo" ? seq : this.undoneBy.get(seq) ?? 0;
    return all.sort((a, b) => key(a) - key(b));
  }
  /** Seq of the entry this actor's next undo should reverse, or null. */
  nextUndoTarget(who) {
    const undo = this.merged(who, "undo");
    return undo.length > 0 ? undo[undo.length - 1] : null;
  }
  /** Migration rollback audits every actor's retained group-dependent history. */
  dependencyTargets() {
    return [...this.byActor.values()].flatMap((stacks) => [
      ...stacks.undo.map((seq) => ({ seq, kind: "undo" })),
      ...stacks.redo.map((seq) => ({ seq, kind: "redo" }))
    ]);
  }
  /**
   * **Every seq one ⌘Z should reverse** — newest first, which is the order
   * they must be undone in.
   *
   * One entry unless the top of the stack named a gesture, in which case it
   * is the run of entries at the top that share it. A RUN, deliberately, and
   * not every member found anywhere: taking the contiguous top is what stops
   * an undo reaching past an unrelated op that happens to sit between two
   * members. Nothing writes such a sequence today — a gesture's ops are
   * written together — but a rule that cannot reach past its neighbour needs
   * nobody to keep that true.
   *
   * Another actor's ops are not in this stack at all, so their interleaving
   * cannot break a group. That falls out of the stacks being per-actor and is
   * the reason this stays simple.
   */
  nextUndoGroup(who) {
    const undo = this.merged(who, "undo");
    if (undo.length === 0) return [];
    const top = undo[undo.length - 1];
    const group = this.groupOf.get(top);
    if (group === void 0) return [top];
    const members = [];
    for (let i = undo.length - 1; i >= 0; i--) {
      if (this.groupOf.get(undo[i]) !== group) break;
      members.push(undo[i]);
    }
    return members;
  }
  /** The same question for redo: the group at the top of the redo stack,
   *  oldest first — the order they were originally written, which is the
   *  order that re-does them. */
  nextRedoGroup(who) {
    const redo = this.merged(who, "redo");
    if (redo.length === 0) return [];
    const top = redo[redo.length - 1];
    const group = this.groupOf.get(top);
    const seqs = [];
    if (group === void 0) {
      seqs.push(top);
    } else {
      for (let i = redo.length - 1; i >= 0; i--) {
        if (this.groupOf.get(redo[i]) !== group) break;
        seqs.push(redo[i]);
      }
    }
    const out = [];
    for (const targetSeq of seqs) {
      const undoSeq = this.undoneBy.get(targetSeq);
      if (undoSeq === void 0) return out;
      out.push({ targetSeq, undoSeq });
    }
    return out;
  }
  /** For this actor's next redo: the original entry to re-do, plus the undo
   * entry whose stored inverse performs it. */
  nextRedoTarget(who) {
    const redo = this.merged(who, "redo");
    if (redo.length === 0) return null;
    const targetSeq = redo[redo.length - 1];
    const undoSeq = this.undoneBy.get(targetSeq);
    if (undoSeq === void 0) return null;
    return { targetSeq, undoSeq };
  }
  /** Drop an undo candidate whose inverse no longer applies (its objects were
   * removed by another actor). Nothing to redo — the effect is already gone. */
  discardUndoTarget(who, seq) {
    for (const id of typeof who === "string" ? [who] : who) {
      const stacks = this.stacksFor(id);
      stacks.undo = stacks.undo.filter((s) => s !== seq);
    }
  }
  /** Drop a redo candidate that can no longer be re-applied. */
  discardRedoTarget(who, seq) {
    for (const id of typeof who === "string" ? [who] : who) {
      const stacks = this.stacksFor(id);
      stacks.redo = stacks.redo.filter((s) => s !== seq);
    }
  }
};

// packages/server/src/writers.ts
var WriterChains = class {
  /** The last task registered on each key; deleted once it settles and nothing followed it. */
  tails = /* @__PURE__ */ new Map();
  /** The last `exclusive` task — every later task waits for it. */
  barrier = Promise.resolve();
  /** Run `work` once every earlier task on any of `keys` (and any earlier exclusive task) has finished. */
  run(keys, work) {
    const sorted = [...new Set(keys)].sort();
    const prior = Promise.all([this.barrier, ...sorted.map((key) => this.tails.get(key))]);
    const result = prior.then(() => work());
    const done = result.then(settle, settle);
    for (const key of sorted) {
      this.tails.set(key, done);
      void done.then(() => {
        if (this.tails.get(key) === done) this.tails.delete(key);
      });
    }
    return result;
  }
  /** Run `work` after EVERYTHING registered so far, holding off everything registered after it. */
  exclusive(work) {
    const prior = Promise.all([this.barrier, ...this.tails.values()]);
    const result = prior.then(() => work());
    this.barrier = result.then(settle, settle);
    return result;
  }
  /**
   * Resolves when every task registered so far on these keys has finished —
   * or, with no keys, every task registered so far on any key. It registers
   * nothing, so it holds nothing up.
   */
  idle(keys) {
    const waits = keys ? keys.map((key) => this.tails.get(key)) : [...this.tails.values()];
    return Promise.all([this.barrier, ...waits]).then(settle);
  }
};
var canvasKey = (canvasId) => `canvas:${canvasId}`;
var HOME_KEY = "home";
var PERSONAL_KEY = "personal";
function settle() {
}

// packages/server/src/gc.ts
var DEFAULT_KEEP_OPS = 500;
var DEFAULT_GRACE_MS = 10 * 60 * 1e3;
function chooseRetained(entries, keepOps) {
  const bySeq = new Map(entries.map((entry) => [entry.seq, entry]));
  const undoneBy = undoneSeqs(entries);
  const newest = keepOps <= 0 ? [] : entries.slice(-keepOps);
  const retained = new Set(newest.map((e) => e.seq));
  let grew = true;
  while (grew) {
    grew = false;
    for (const seq of [...retained]) {
      const entry = bySeq.get(seq);
      const wants = [];
      if (entry.cause) wants.push(entry.cause.targetSeq);
      const undoer = undoneBy.get(seq);
      if (undoer !== void 0) wants.push(undoer);
      for (const want of wants) {
        if (!retained.has(want) && bySeq.has(want)) {
          retained.add(want);
          grew = true;
        }
      }
    }
  }
  return entries.filter((entry) => retained.has(entry.seq));
}
function hashesInOperation(op) {
  switch (op.type) {
    case "group.change": {
      const versions = op.action.kind === "create" ? [op.action.group.version] : op.action.kind === "insert" ? [op.action.item.version] : op.action.kind === "content" && op.action.operation.type === "item.addVersion" ? [op.action.operation.version] : op.action.kind === "apply" ? [
        ...op.action.change.writes.flatMap((write) => write.kind === "create" ? write.item.versions : write.kind === "patch" ? write.content?.versions ?? [] : []),
        ...op.action.change.expected.flatMap((row) => row.content?.versions ?? [])
      ] : [];
      return versions.flatMap((version) => [version.blobHash, ...version.visual ? [version.visual.blobHash] : []]);
    }
    case "item.add":
    case "item.addVersion":
    case "item.edit":
    case "item.restoreVersion": {
      const hashes = [op.version.blobHash];
      if (op.version.visual?.blobHash) hashes.push(op.version.visual.blobHash);
      return hashes;
    }
    default:
      return [];
  }
}
function reachableHashes(state, retained) {
  const marked3 = /* @__PURE__ */ new Set();
  for (const hash of blobsNamedBy(retained, state).keys()) marked3.add(hash);
  for (const hash of blobsInProperties(state)) marked3.add(hash);
  for (const item of Object.values(state.canvas.items)) {
    for (const version of item.versions) {
      marked3.add(version.blobHash);
      if (version.visual?.blobHash) marked3.add(version.visual.blobHash);
    }
  }
  for (const entry of state.canvas.trash) {
    for (const version of entry.item.versions) {
      marked3.add(version.blobHash);
      if (version.visual?.blobHash) marked3.add(version.visual.blobHash);
    }
  }
  for (const entry of retained) {
    for (const hash of hashesInOperation(entry.envelope.op)) marked3.add(hash);
    if (entry.inverse) {
      for (const hash of hashesInOperation(entry.inverse)) marked3.add(hash);
    }
  }
  return marked3;
}
var DEFAULT_GC_INTERVAL_MS = 60 * 60 * 1e3;
var BOOT_SWEEP_MS = 60 * 1e3;

// packages/server/src/engine.ts
var FREE_NAME_PROBE = " free-name probe";
var OWN_CLAIM_FRESH_MS = 6e4;
var BLOB_RECONFIRM_MS = 6 * 60 * 60 * 1e3;
function fresh(boundAt, now) {
  return Date.parse(now) - Date.parse(boundAt) < OWN_CLAIM_FRESH_MS;
}
var CanvasNotFoundError = class extends Error {
  constructor(id) {
    super(`canvas not found: ${id}`);
    this.name = "CanvasNotFoundError";
  }
};
var NothingToUndoError = class extends Error {
  constructor(kind, actorName) {
    super(actorName ? `nothing to ${kind} for ${actorName}` : `nothing to ${kind}`);
    this.name = "NothingToUndoError";
  }
};
var Engine = class {
  constructor(store, desk, options = {}) {
    this.store = store;
    this.desk = desk;
    this.options = options;
  }
  store;
  desk;
  options;
  canvases = /* @__PURE__ */ new Map();
  /** Loads in flight, so two queues asking for one cold canvas share ONE runtime. */
  loading = /* @__PURE__ */ new Map();
  /** The actor registry, as a promise so concurrent first readers share one load. */
  actorsRuntime = null;
  writers = new WriterChains();
  listeners = /* @__PURE__ */ new Set();
  colorListeners = /* @__PURE__ */ new Set();
  /** Told when `tipSeq` finds this instance's cache behind the store (#85). */
  behindListeners = /* @__PURE__ */ new Set();
  /**
   * The homes this engine is a REPLICA of, per canvas — empty (or null) when
   * this daemon is the home of everything it holds.
   *
   * This one field is the demotion, and phase 10.3 made the demotion **per
   * canvas** rather than per daemon: for a canvas whose row names a home, the
   * engine stops being a writer — the mutation is forwarded, that home assigns
   * the seq, and what comes back is applied here VERBATIM through
   * `applyRemoteEntry`. For a canvas with no row, this daemon IS the home and
   * nothing changes at all. Both kinds of canvas can sit in one store, which
   * is the whole of the phase.
   *
   * The canvas's writer queue does exactly what the single chain always did
   * for it — it serializes forwarded writes and arriving entries against each
   * other instead of serializing writes against writes. There is still
   * exactly one thing mutating a canvas's state at a time; what changed is
   * who decides the order, and that the answer to "who" depends on which
   * canvas. (And, since the queue became per canvas, that a canvas waiting on
   * its home holds up only itself.)
   */
  homes = null;
  /**
   * Point this engine at its homes — the composition root's last wire, set in
   * `startDaemon` before the port is bound, so no request can ever see the
   * engine half-demoted.
   *
   * A setter rather than a constructor argument because the two objects need
   * each other: a home connection applies what it receives THROUGH the engine,
   * and the engine forwards what it is asked THROUGH the connection.
   * Constructing one with the other would be a cycle; one setter at the
   * composition root is the honest cut.
   *
   * It keeps its name under phase 10.3's widening from one connection to a
   * directory, because it still reads correctly — this is still where the
   * engine is told there is somewhere else to send things — and every word of
   * the reasoning above survives with `home` reading `homes`.
   */
  forwardTo(directory) {
    this.homes = directory;
  }
  /** Subscribe to canvas events; returns an unsubscribe function. */
  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /**
   * **This instance has found itself behind the store** (#85): another
   * writer moved the canvas on and nothing here noticed, because the cache
   * is only ever dropped by this instance's OWN fenced append. The listener
   * is `ws.ts`, which hangs up on the room so every client redials through
   * the load balancer to whichever instance is current. By the time it is
   * called the cache is already dropped, so a redial that lands back HERE is
   * answered from the store rather than from the stale runtime.
   */
  onBehind(listener) {
    this.behindListeners.add(listener);
    return () => this.behindListeners.delete(listener);
  }
  emit(canvasId, message) {
    for (const listener of this.listeners) listener(canvasId, message);
  }
  /**
   * Resolves when everything already queued has run — on ONE canvas's queue
   * when given its id, on every queue when not.
   *
   * The replica needed it and the reason is worth keeping: a forwarded write
   * holds its canvas's queue across its HTTP round trip, so between "the home
   * has created this canvas" and "this daemon has written it down" there is a
   * real window — and the home connection's dial, which asks the store how far
   * it has got, was reading that store MID-WRITE. It presented `since=0` for a
   * canvas it was in the middle of creating, was correctly answered with a
   * snapshot, and adopted it over the entry that was one line from landing.
   * Waiting for the queue to drain makes the cursor a fact rather than a
   * guess, and it is the same discipline every other reader here already has
   * — it just had no name.
   *
   * **Per canvas for a dial, all of them for a shutdown.** The window above is
   * a write to THE canvas being dialled — a birth is queued under the id it
   * creates — so a dial asks only that canvas's queue. It used to wait on the
   * one chain, which is how a blob sweep on one canvas left every home link on
   * the machine logging "a dial has been unfinished for over 30s" (lessons
   * #95). `close()` asks with no id, because a shutdown must not race ANY
   * write to the desk or the store.
   */
  settled(canvasId) {
    return this.writers.idle(canvasId === void 0 ? void 0 : [canvasKey(canvasId)]);
  }
  /** Queue work on one canvas's writer queue. */
  enqueue(canvasId, work) {
    return this.writers.run([canvasKey(canvasId)], work);
  }
  /** Queue work on the home-scoped identity queue (`HOME_KEY`). */
  enqueueHome(work) {
    return this.writers.run([HOME_KEY], work);
  }
  /** HomeLink records classification before adopting any private replica bytes. */
  recordPersonalReplica(canvasId, home) {
    return this.desk.recordPersonalReplica(canvasId, home);
  }
  async refusePersonalTransfer(canvasId) {
    if (await this.desk.personalSource(canvasId) || await this.desk.personalReplica(canvasId)) {
      throw new PersonalError("personal sources cannot be teleported or adopted; their private ownership stays at their home", "personal-transfer-refused");
    }
  }
  /** Request policy is rechecked when queued work begins, before any source state is loaded. */
  sourceGuard;
  setSourceGuard(guard) {
    this.sourceGuard = guard;
  }
  /**
   * A private workflow enters the writer once; callbacks use only the
   * unqueued writer port.
   *
   * `canvasId` names the one canvas the workflow writes — a link or unlink
   * writes its destination and nothing else — and then it takes that canvas's
   * queue and `PERSONAL_KEY`, so two personal workflows still never interleave
   * their desk records. With none, the workflow may write a canvas it only
   * discovers inside (a birth mints or finds its source there), so it cannot
   * name its keys up front and takes the whole writer: `exclusive`, the old
   * single chain for exactly one task. The port's `submit` is only safe on the
   * canvas that was named, or on any canvas when none was.
   */
  personalWrite(work, canvasId) {
    const queued = (task) => canvasId === void 0 ? this.writers.exclusive(task) : this.writers.run([canvasKey(canvasId), PERSONAL_KEY], task);
    return queued(() => work({
      snapshot: (id) => this.getSnapshot(id),
      submit: async (request) => {
        await this.requireActor(request.badgeId, request.actor.id);
        if (this.homes?.for(request.canvasId)) throw new Error("personal writes require the authoritative home");
        const prior = request.opId ? await this.alreadyWritten(request) : null;
        return prior ?? this.applyAndPersist(request, void 0);
      },
      birth: (source, actor, badgeId) => this.birthPersonal(source, actor, badgeId)
    }));
  }
  async birthPersonal(source, actor, badgeId) {
    await this.requireActor(badgeId, actor.id);
    const lifecycle = await this.store.canvasLifecycle(source.canvasId);
    if (lifecycle === "live") {
      if (source.birth === "reserved") {
        const first = (await this.store.readBirthLog(source.canvasId))[0];
        const joined = await this.actorJoins();
        if (!first || first.seq !== 1 || first.envelope.id !== source.birthOpId || first.envelope.op.type !== "project.create" || first.envelope.op.canvasId !== source.canvasId || resolveActor(joined, first.envelope.actor.id) !== resolveActor(joined, source.ownerId)) throw new Error("reserved personal birth does not match the existing canvas");
      }
      await this.desk.finishPersonalBirth(source.canvasId, source.birthOpId);
      return false;
    }
    if (source.birth === "created" || !["absent", "incomplete"].includes(lifecycle)) return false;
    if (this.homes) await this.homes.bindLocal(source.canvasId);
    const entries = await this.store.readBirthLog(source.canvasId);
    if (entries.length) {
      const first = entries[0];
      const op = first.envelope.op;
      if (first.seq !== 1 || first.envelope.id !== source.birthOpId || resolveActor(await this.actorJoins(), first.envelope.actor.id) !== resolveActor(await this.actorJoins(), source.ownerId) || op.type !== "project.create" || op.canvasId !== source.canvasId) throw new Error("reserved personal birth log does not match");
      let state = applyOperation(null, first.envelope);
      let seq = 1;
      for (const entry of entries.slice(1)) {
        if (entry.seq !== seq + 1 || !state) throw new Error("personal birth log is incomplete");
        state = applyOperation(state, entry.envelope);
        seq = entry.seq;
      }
      if (!state) throw new Error("personal source was deleted during birth");
      await this.store.saveSnapshot(source.canvasId, state, seq);
      this.canvases.delete(source.canvasId);
    } else {
      await this.createProject(
        {
          canvasId: null,
          actor,
          badgeId,
          opId: source.birthOpId,
          withoutLinkGrant: true,
          op: { type: "project.create", canvasId: source.canvasId, title: `~${actor.name}`, groupMode: "groups" }
        },
        { type: "project.create", canvasId: source.canvasId, title: `~${actor.name}`, groupMode: "groups" },
        source
      );
    }
    await this.desk.finishPersonalBirth(source.canvasId, source.birthOpId);
    return true;
  }
  async listCanvases() {
    return this.store.listCanvases();
  }
  async getSnapshot(canvasId) {
    const runtime = await this.runtime(canvasId);
    return {
      project: runtime.state.project,
      canvas: runtime.state.canvas,
      lastSeq: runtime.lastSeq,
      colors: await this.actorColors(),
      names: await this.actorNames(),
      joined: await this.actorJoins()
    };
  }
  /** Chosen identity colors, actor id → hex. Everything absent is derived
   * from the id, so this map is only ever the exceptions — plus one row per
   * folded actor, wearing the person's colour (multi-identity phase 5). */
  async actorColors() {
    const { registry } = await this.actors();
    return actorColors(registry);
  }
  /** Actors folded into others, old id → new id (`actor.join`). */
  async actorJoins() {
    const { registry } = await this.actors();
    return actorJoins(registry);
  }
  /**
   * Presence as a reader should see it after a join (multi-identity phase
   * 5): a session still beating under a folded id is the person it was
   * folded into, so the facepile draws one face and `isocan who` lists one
   * name. The session keeps its id, kind, label and status; only the actor
   * is resolved, and only on the way out — the beat itself is checked
   * against the badge's claims on the id it actually presented.
   */
  async resolveSessions(sessions) {
    const { registry } = await this.actors();
    const joined = registry.joined ?? {};
    if (Object.keys(joined).length === 0) return sessions;
    return sessions.map((session) => {
      const id = resolveActor(joined, session.actor.id);
      if (id === session.actor.id) return session;
      const name = registry.names[id]?.name ?? session.actor.name;
      return { ...session, actor: { id, name } };
    });
  }
  /**
   * Every slash command available here: what isocan ships with, laid under
   * whatever this home has written. The menu, the CLI, and an agent looking up
   * what `/format` means all read this one list, or they would disagree about
   * what a command does — which is the only thing a command must never do.
   */
  async commands() {
    return mergeCommands(DEFAULT_COMMANDS, await this.store.loadCommands());
  }
  /** Write a command for this home. Shadowing a built-in is allowed and is
   * the point: `rm` gives ours back. */
  async saveCommand(name, text) {
    await this.store.saveCommand(name, text);
  }
  /** Remove a home command. False when there was no file to remove. */
  async deleteCommand(name) {
    return this.store.deleteCommand(name);
  }
  /** The name every actor goes by now, actor id → name. What a client shows
   * instead of the name stamped on a comment when it was written. */
  async actorNames() {
    const { registry } = await this.actors();
    return actorNames(registry);
  }
  /** The mark each actor wears instead of an initial. */
  async actorMarks() {
    const { registry } = await this.actors();
    return actorMarks(registry);
  }
  /** Actor id → "agent" for everyone whose last claim came from a harness
   *  that is not a person's — recorded at claim time, so it outlives the
   *  session (`core/claims.ts` `actorKinds`). */
  async actorKinds() {
    const { registry } = await this.actors();
    return actorKinds(registry);
  }
  /**
   * Choosing the color you wear. Home-scoped like a claim: it lands in the
   * actors log, updates the registry, and is not undoable.
   *
   * BOTH actors are checked, and they are two different assertions: `actor`
   * is who is speaking and `op.actorId` is whose face changes. A badge may
   * repaint only actors it claims — a color is the actor's own choice, and
   * choosing it for somebody else is exactly the impersonation mechanism 5
   * exists to stop.
   */
  setActorColor(request) {
    return this.enqueueHome(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      if (request.op.actorId !== request.actor.id) {
        await this.requireActor(request.badgeId, request.op.actorId);
      }
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map(
            (home) => home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...request.clientId !== void 0 ? { clientId: request.clientId } : {}
            })
          )
        );
      }
      const runtime = await this.actors();
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      const registry = applyActorColor(runtime.registry, request.op);
      const envelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
        ts,
        op: request.op
      };
      const seq = runtime.lastSeq + 1;
      const entry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      this.identityChanged(actorColors(registry), request.op.actorId);
      return entry;
    });
  }
  /**
   * Choosing the mark you wear instead of an initial. The colour's twin in
   * every respect — home-scoped, lands in the actors log, not undoable, both
   * actors checked because choosing a face for somebody else is exactly the
   * impersonation mechanism 5 exists to stop (the one exception is an agent
   * the speaker owns, which is the pointer it wears) — and forwarded to every home
   * for the same reason: the actors log never replicates down, so a home not
   * told keeps drawing the old face forever with nothing to correct it.
   *
   * **What it does NOT do yet, said plainly:** there is no live broadcast. A
   * colour has `onColors`, which repaints open canvases the moment it
   * changes; a mark reaches other people's screens on their next read of the
   * registry — a reload, or opening a canvas. Your own screen updates at
   * once. That is a real limitation rather than a hidden one, and the fix is
   * a broadcast carrying both facts rather than a second one carrying this.
   */
  setActorMark(request) {
    return this.enqueueHome(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      const target = request.op.actorId;
      if (target !== request.actor.id && !claimsActor(await this.desk.claimsOf(request.badgeId), target)) {
        const holders = await Promise.all(
          (await this.desk.claimants(target)).map((held) => this.desk.claimsOf(held.badgeId))
        );
        const { registry: registry2 } = await this.actors();
        const agent = actorKinds(registry2)[resolveActor(registry2.joined, target)] === "agent";
        if (!ownsAgent(holders, request.actor.id, agent, registry2.joined)) throw notYourActor(target);
      }
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map(
            (home) => home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...request.clientId !== void 0 ? { clientId: request.clientId } : {}
            })
          )
        );
      }
      const runtime = await this.actors();
      const registry = applyActorMark(runtime.registry, request.op);
      const envelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        op: request.op
      };
      const seq = runtime.lastSeq + 1;
      const entry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      return entry;
    });
  }
  /**
   * **Two actors become one person** (`actor.join`, multi-identity phase 5).
   * The colour's and the mark's sibling in every mechanical respect:
   * home-scoped, lands in the actors log, replays on load, not undoable, and
   * forwarded to every home because the actors log never replicates down.
   *
   * **The claim check is the whole authorization**: the presenting badge must
   * claim BOTH actors, through `claimsActor`, or the op is refused with
   * `bad-join`. That is exactly what journey 6 leaves a laptop holding after
   * it proved its address and became Dimitri — its own claim on `Dimitri 2`
   * and its vouched claim on Dimitri — and it means no stranger can fold
   * anybody into anybody. The speaker is checked too, as on every write.
   *
   * On success the rooms where `from` appears are repainted, because that is
   * where the comments now wearing the wrong name are.
   */
  joinActors(request) {
    return this.enqueueHome(async () => {
      await this.requireActor(request.badgeId, request.actor.id);
      const { from, into } = request.op;
      const claims = await this.desk.claimsOf(request.badgeId);
      for (const id of [from, into]) {
        if (!claimsActor(claims, id)) throw notBothActors(from, into, id);
      }
      const homes = this.homes?.all() ?? [];
      if (homes.length > 0) {
        await Promise.allSettled(
          homes.map(
            (home) => home.submitOp({
              canvasId: null,
              actor: request.actor,
              op: request.op,
              ...request.clientId !== void 0 ? { clientId: request.clientId } : {}
            })
          )
        );
      }
      const runtime = await this.actors();
      const registry = applyActorJoin(runtime.registry, request.op);
      const envelope = {
        id: newOpId(),
        canvasId: null,
        actor: request.actor,
        ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        op: request.op
      };
      const seq = runtime.lastSeq + 1;
      const entry = { seq, envelope, inverse: null };
      await this.appendActorsOrFence(entry);
      runtime.registry = registry;
      runtime.lastSeq = seq;
      await this.store.saveActors(registry, seq);
      this.identityChanged(actorColors(registry), from);
      return entry;
    });
  }
  /**
   * Told when identity changes — a color chosen, or a name taken — so live
   * canvases can repaint their faces and re-letter what people said.
   *
   * The listener is told WHICH ACTOR changed, and that is mechanism 10's one
   * behavioral narrowing: a color travels with its actor (global, per actor),
   * but the BROADCAST does not. This used to flood every room on the home;
   * the transport now asks `appearances()` which of its open rooms that actor
   * is actually in, and repaints those. On a solo home that is every room it
   * was before; on a multi-tenant one it is the difference between a repaint
   * and a roster leak.
   */
  onColors(listener) {
    this.colorListeners.add(listener);
    return () => this.colorListeners.delete(listener);
  }
  identityChanged(colors, actorId) {
    for (const listener of this.colorListeners) listener(colors, actorId);
  }
  /**
   * Which of these canvases that actor APPEARS on — the rooms a color change
   * or a rename has any business repainting (mechanism 10).
   *
   * Appearance is deliberately wider than presence. A rename has to reach the
   * comments the renamed actor wrote before it, in rooms where nobody by that
   * name is currently connected — so history counts: the canvas's authors,
   * every name the canvas remembers, and the live roster.
   */
  async appearances(actorId, canvasIds) {
    const found = [];
    for (const canvasId of canvasIds) {
      let state;
      try {
        state = (await this.runtime(canvasId)).state;
      } catch {
        continue;
      }
      const here = state.project.createdBy.id === actorId || state.project.updatedBy.id === actorId || collectCanvasNames(state.canvas).some((known) => known.id === actorId) || (this.options.liveness?.(canvasId) ?? []).some((s) => s.actor.id === actorId);
      if (here) found.push(canvasId);
    }
    return found;
  }
  /**
   * Mechanism 5's membership check, at the one place the claims registry
   * lives. Public because presence beats are checked too and presence does
   * not live on a writer queue; the op paths call it INSIDE their queued work.
   *
   * **A claim and an op racing no longer share a queue** — claims are on the
   * home queue, ops on their canvas's — and that is safe because this is a
   * READ, linearized where it happens: an op that passed it is ordered before
   * any claim that lands after, exactly as if it had landed first. A claim
   * only ever rewrites the claiming badge's own rows (`setClaims(badgeId)`),
   * so it can never take away another badge's standing mid-write; revoking a
   * badge is the desk's, and was never on the engine's chain at all.
   */
  async requireActor(badgeId, actorId) {
    if (claimsActor(await this.desk.claimsOf(badgeId), actorId)) return;
    throw notYourActor(actorId);
  }
  /**
   * **How far this canvas has actually got** — the number a tab compares its
   * own cursor against to find out it has stopped hearing (#85).
   *
   * Read from the runtime rather than counted along the broadcast path, and
   * that is the whole point: the failure this answers is broadcasts stopping
   * while the socket stays up, so a tip derived from the thing that stopped
   * would agree with the tab and confirm the freeze.
   *
   * Returns null for a canvas this home cannot produce, because a beat is not
   * the place to raise: the socket is fine, and a heartbeat that threw would
   * take down the one mechanism that is supposed to be steady.
   */
  async tipSeq(canvasId) {
    let tip;
    try {
      tip = await this.store.tipSeq(canvasId);
    } catch {
      return null;
    }
    const cached2 = this.canvases.get(canvasId);
    if (tip !== null && cached2 && cached2.lastSeq < tip) {
      console.error(
        `[isocan] BEHIND on ${canvasId}: the store is at seq ${tip}, this instance's cache at ${cached2.lastSeq}. Dropping the runtime and hanging up on the room so clients redial.`
      );
      this.canvases.delete(canvasId);
      for (const listener of this.behindListeners) listener(canvasId, cached2.lastSeq, tip);
    }
    return tip;
  }
  /**
   * **Send a canvas to another home** — the move half, and a dry run of it.
   *
   * `docs/research/2026-09-01-teleport.md` is the argument. The short form:
   * the log IS the canvas, the reducer is deterministic, so a home holding
   * the same entries holds the same canvas. This is not a data migration, it
   * is a replay — and the order below is chosen so that a failure leaves the
   * canvas somewhere a retry can finish from.
   *
   *   1. the log — verbatim, via `adopt`, which refuses a canvas that exists.
   *      This is what makes the canvas exist at the far home at all.
   *   2. bytes — content-addressed, so sending them twice is free, and sent
   *      INTO the canvas the log just made.
   *   3. the routing row — this daemon stops being the home and starts
   *      forwarding, which is what makes it a MOVE rather than a copy
   *
   * **Why the log leads.** The research note asked for bytes first, so that
   * no item would ever exist anywhere without its bytes, and that is how this
   * shipped — and no canvas naming a blob could move. Every canvas route at
   * the far home, the blob POST included, answers 404 for a canvas it does
   * not hold, and until `adopt` runs it holds nothing: the first upload was
   * refused and the move stopped, safely and uselessly. The other fix — a
   * blob route that takes bytes for a canvas that does not exist — was not
   * taken, because the far home cannot tell a teleporting daemon from any
   * other badge: it would be a write path under every unheld id for anyone
   * at the door, and bytes under an id no canvas ever claims are bytes no
   * sweep ever collects.
   *
   * So the log leads, and the window the research wanted closed is open for
   * the length of step 2, at a home nobody is routed to yet. It is the same
   * window every ordinary upload has — an item's op replicates before its
   * bytes are pushed — which is what the blob keeper exists to close. That is
   * also why a blob the far home refuses after the log has landed is COUNTED
   * and not fatal: stopping there would leave a canvas the far home holds and
   * `adopt` will never take again, with no gesture that retries. The move
   * completes, `behind` says how many bytes did not arrive, and the keeper
   * that heals every replica heals this one — from step 3 on, this daemon is
   * one. A failure before the log lands still leaves the canvas exactly where
   * it was; a failure after it completes the move and says what is behind.
   *
   * Two things deliberately do not travel, and the report says so rather
   * than leaving them to be discovered:
   *
   * **The grants.** Who may enter is a decision about a PLACE, and the new
   * home is a different place with a different operator. A teleport that
   * quietly recreated "anyone with the link can enter" would have widened
   * access without anybody saying so.
   *
   * **The actor registry.** Names, colours and marks are home-scoped and
   * never replicate; the receiving home knows these actors only by what is
   * stamped on their ops. People arrive under the name they had when they
   * wrote, which is a real loss and a visible one.
   */
  teleport(canvasId, toHomeUrl, options, sourceContext, badgeId) {
    return this.enqueue(canvasId, async () => {
      await this.refusePersonalTransfer(canvasId);
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      const already = this.homes?.for(canvasId) ?? null;
      if (already !== null) {
        throw new OpValidationError(
          "bad-op",
          `${canvasId} is not homed here \u2014 it belongs to ${already.homeUrl}, and only its home can send it`
        );
      }
      const link = this.homes?.linkFor(toHomeUrl) ?? null;
      if (!link) {
        throw new OpValidationError("bad-op", `this daemon dials no homes, so it cannot send one`);
      }
      const runtime = await this.runtime(canvasId);
      const archived = await this.store.readArchivedLog(canvasId);
      const entries = [...archived, ...runtime.entries].sort((a, b) => a.seq - b.seq);
      const blobs = await this.store.listBlobs(canvasId);
      const bytes = blobs.reduce((n, b) => n + b.meta.size, 0);
      const report = {
        canvasId,
        to: link.homeUrl,
        entries: entries.length,
        blobs: blobs.length,
        bytes,
        moved: false,
        behind: 0
      };
      if (options.dryRun) return report;
      await link.adopt(canvasId, entries);
      let behind = 0;
      for (const blob of blobs) {
        try {
          if (await link.hasBlob(canvasId, blob.hash) === true) continue;
          const stream = await this.store.openBlob(canvasId, blob.hash);
          if (!stream) continue;
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          await link.putBlob(canvasId, Buffer.concat(chunks), {
            mimeType: blob.meta.mimeType,
            filename: blob.meta.filename
          });
        } catch (err) {
          behind += 1;
          console.error(
            `[isocan] teleport of ${canvasId}: ${link.homeUrl} did not take blob ${blob.hash} (${err.message}); the blob keeper will send it`
          );
        }
      }
      await this.homes?.bind(canvasId, link.homeUrl);
      return { ...report, moved: true, behind };
    });
  }
  /**
   * **Take a canvas whole, as somebody else's log** — the receiving half of a
   * teleport.
   *
   * A canvas IS its log: the snapshot is what you get by folding it, and the
   * reducer is deterministic, so a home holding the same entries holds the
   * same canvas. This writes them VERBATIM — same seq, same `ts`, same
   * envelope — which is the whole reason it exists rather than a loop over
   * `submitOp`.
   *
   * Replaying through the ordinary write path would look equivalent and
   * quietly is not. `PostOpRequest` carries no timestamp, deliberately: a
   * client that stamps its own time is a client that can lie about when
   * something happened. So a replayed canvas would arrive with every comment,
   * every version and every item dated at the moment of the move — the order
   * intact and the history erased. Seqs would survive by luck (an empty
   * canvas numbers 1..N the same way), but times would not, and nobody would
   * notice until they looked at a thread.
   *
   * **Only into nothing.** This refuses a canvas that already exists here,
   * which keeps the surface narrow: it can create, never overwrite, so no
   * sequence of calls to it can damage a canvas anybody is using. Moving a
   * canvas ONTO a home that has it is not a teleport, it is a merge, and
   * merging two orders is the thing `docs/research/2026-09-01-teleport.md`
   * argues is a different product.
   */
  adopt(canvasId, entries, sourceContext, badgeId) {
    return this.enqueue(canvasId, async () => {
      await this.refusePersonalTransfer(canvasId);
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      if (await this.store.canvasExists(canvasId)) {
        throw new OpValidationError(
          "bad-op",
          `${canvasId} is already here \u2014 a teleport creates a canvas, it never merges into one`
        );
      }
      if (entries.length === 0) {
        throw new OpValidationError("bad-op", "a canvas with no history is not a canvas");
      }
      const inOrder = [...entries].sort((a, b) => a.seq - b.seq);
      await this.store.createCanvasDir(canvasId);
      let state = null;
      for (const entry of inOrder) {
        state = applyOperation(state, entry.envelope);
        await this.store.appendLog(canvasId, entry);
      }
      const lastSeq = inOrder[inOrder.length - 1].seq;
      await this.store.saveSnapshot(canvasId, state, lastSeq);
      this.canvases.set(canvasId, {
        state,
        lastSeq,
        entries: [...inOrder],
        undo: new UndoStacks()
      });
      return { seqs: inOrder.length };
    });
  }
  async getLog(canvasId, sinceSeq = 0) {
    const runtime = await this.runtime(canvasId);
    return runtime.entries.filter((entry) => entry.seq > sinceSeq);
  }
  /**
   * What `gc` compacted away, oldest first. Straight from the backing rather
   * than from the runtime — archived entries are exactly the ones the runtime
   * no longer holds. `runtime()` is still called first so an unknown canvas
   * answers "not found" here the same way it does on `getLog`, instead of an
   * empty archive.
   */
  async getArchivedLog(canvasId) {
    await this.runtime(canvasId);
    return this.store.readArchivedLog(canvasId);
  }
  /** Read current state and its complete recent history under the same queue
   * as GC/mutations. Archive materialization is not a bounded backing scan. */
  recapHead(canvasId, badgeId, context, home) {
    return this.enqueue(canvasId, async () => {
      const excluded2 = { ...context, policy: { mode: "exclude" } };
      excluded2.signal?.throwIfAborted();
      if (this.homes?.for(canvasId)) throw new PersonalError("Recent work must be read at its authoritative home");
      if (await this.desk.personalSource(canvasId) || await this.desk.personalReplica(canvasId)) throw new PersonalError("Recent work does not read personal history", "personal-source-excluded");
      await this.sourceGuard?.(canvasId, badgeId, excluded2, "read");
      if (await this.store.canvasLifecycle(canvasId) !== "live") throw new CanvasNotFoundError(canvasId);
      excluded2.signal?.throwIfAborted();
      const runtime = await this.runtime(canvasId);
      const archived = await this.store.readArchivedLog(canvasId);
      excluded2.signal?.throwIfAborted();
      const head = buildRecapHead([...archived, ...runtime.entries], runtime.state.canvas, runtime.lastSeq);
      if (!head) return null;
      const title = clipRecapLabel(runtime.state.project.title);
      if (title.clipped) head.omitted.clippedLabels++;
      return { canvasId, home, title: title.text, revision: runtime.lastSeq, head };
    });
  }
  /**
   * A migration preview reads the home's current revision, even through a
   * replica — and asks it OFF the single-writer chain (lessons #95): the
   * home's answer is a read of the home, and nothing here waits on it but
   * this caller. Asked inside `enqueue`, every write on the machine queued
   * behind the round trip.
   */
  async groupMigrationPreview(canvasId, sourceContext, badgeId) {
    const answer = await this.enqueue(canvasId, async () => {
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "read");
      }
      const home = this.homes?.for(canvasId);
      if (home) return { home };
      const runtime = await this.runtime(canvasId);
      return { preview: canvasGroupMigrationPreview(runtime.state, runtime.lastSeq) };
    });
    return "preview" in answer ? answer.preview : answer.home.groupMigrationPreview(canvasId);
  }
  submit(request) {
    const target = request.canvasId ?? (request.op.type === "project.create" ? request.op.canvasId : null);
    const queued = (work) => target === null ? this.enqueueHome(work) : this.enqueue(target, work);
    return queued(async () => {
      const targetId = request.canvasId ?? (request.op.type === "project.create" ? request.op.canvasId : void 0);
      if (request.sourceContext && targetId) await this.sourceGuard?.(targetId, request.badgeId, request.sourceContext, request.op.type === "project.create" ? "own" : "edit", request.actor.id);
      if (request.op.type === "project.create" && (await this.desk.personalSource(request.op.canvasId) || await this.desk.personalReplica(request.op.canvasId))) {
        throw new PersonalError("a personal source can only be born through its reserved private birth", "personal-birth-reserved");
      }
      if (request.originGroupMode !== void 0 && request.originGroupMode !== "legacy" && request.originGroupMode !== "groups") throw new OpValidationError("bad-op", "originGroupMode must be legacy or groups");
      rejectPublicContext(request.op);
      rejectPublicQuestionnaire(request.op);
      rejectPublicDesignRecord(request.op);
      rejectPublicDesignDecision(request.op);
      rejectPublicDesignRepair(request.op);
      if (request.op.type === "project.create" && request.op.groupMode !== void 0 && request.op.groupMode !== "groups" && request.op.groupMode !== "legacy") {
        throw new OpValidationError("bad-op", "groupMode must be groups or legacy");
      }
      if (request.op.type === "group.change" && request.op.action?.kind === "apply") {
        throw new OpValidationError("internal-op", "resolved group changes cannot be issued directly");
      }
      const systemComment = isSystemActor(request.actor.id) && (request.op.type === "thread.create" || request.op.type === "thread.reply");
      if (!systemComment) await this.requireActor(request.badgeId, request.actor.id);
      const home = await this.homeFor(request);
      if (!home && request.canvasId && isDesignRepairOperation(request.op)) {
        const runtime = await this.runtime(request.canvasId);
        const prior = await designRepairRetry([...runtime.entries, ...await this.store.readArchivedLog(request.canvasId)], request.op, request.opId, request.actor.id, (await this.actors()).registry);
        if (prior) {
          if (request.clientFeatures !== void 0) requireQuestionnaireClient(request.clientFeatures, void 0, [prior]);
          return prior;
        }
      } else if (!home && request.canvasId && isDesignDecisionOperation(request.op)) {
        const runtime = await this.runtime(request.canvasId);
        const prior = await designDecisionRetry([...runtime.entries, ...await this.store.readArchivedLog(request.canvasId)], request.op, request.opId, request.actor.id, (await this.actors()).registry);
        if (prior) {
          if (request.clientFeatures !== void 0) requireQuestionnaireClient(request.clientFeatures, void 0, [prior]);
          return prior;
        }
      } else if (!home && request.canvasId && isDesignRecordOperation(request.op)) {
        const runtime = await this.runtime(request.canvasId);
        const prior = await designRecordRetry([...runtime.entries, ...await this.store.readArchivedLog(request.canvasId)], request.op, request.opId, request.actor.id, (await this.actors()).registry);
        if (prior) {
          if (request.clientFeatures !== void 0) {
            requireGroupClient(request.clientFeatures, void 0, [prior]);
            requireQuestionnaireClient(request.clientFeatures, void 0, [prior]);
          }
          return prior;
        }
      } else if (!home && request.canvasId && isQuestionnaireOperation(request.op)) {
        const runtime = await this.runtime(request.canvasId);
        const registry = (await this.actors()).registry;
        const prior = questionnaireRetry([...runtime.entries, ...await this.store.readArchivedLog(request.canvasId)], request.op, request.opId, request.actor.id, registry);
        if (prior) {
          if (request.clientFeatures !== void 0) {
            requireGroupClient(request.clientFeatures, void 0, [prior]);
            requireQuestionnaireClient(request.clientFeatures, void 0, [prior]);
          }
          return prior;
        }
      } else if (!home && request.opId !== void 0) {
        const live = await this.alreadyWritten(request);
        const archivedDesign = !live && request.canvasId ? (await this.store.readArchivedLog(request.canvasId)).find((entry) => entry.envelope.id === request.opId && (isDesignRepairOperation(entry.envelope.op) || isDesignDecisionOperation(entry.envelope.op) || isDesignRecordOperation(entry.envelope.op) || isQuestionnaireOperation(entry.envelope.op))) : void 0;
        const already = live ?? archivedDesign;
        if (already) {
          if (request.clientFeatures !== void 0) {
            requireGroupClient(request.clientFeatures, void 0, [already]);
            requireQuestionnaireClient(request.clientFeatures, void 0, [already]);
          }
          if (isQuestionnaireOperation(already.envelope.op)) throw new OpValidationError("bad-op", "questionnaire retry identity conflicts with its original operation type");
          if (isDesignRecordOperation(already.envelope.op)) throw new OpValidationError("bad-op", "design retry identity conflicts with its original operation type");
          if (isDesignRepairOperation(already.envelope.op) || isDesignDecisionOperation(already.envelope.op)) throw new OpValidationError("design-intent-conflict", "design retry identity conflicts with its original operation type");
          return already;
        }
      }
      if (home) return this.forwardSubmit(home, request);
      return this.applyAndPersist(request, void 0);
    });
  }
  /**
   * Where this op's write belongs: a home, or null for "this daemon".
   *
   * On the writer chain by construction (its one caller is inside `enqueue`),
   * which is what makes the row `bind` writes and the forward that follows it
   * one indivisible step. Two births of one id cannot interleave and end up
   * with a row from one and a forward from the other.
   */
  async homeFor(request) {
    if (!this.homes) return null;
    if (request.op.type === "project.create") {
      return this.homes.bind(request.op.canvasId, request.home ?? null);
    }
    return request.canvasId === null ? null : this.homes.for(request.canvasId);
  }
  /**
   * Has this exact op already been written here? Then hand back the entry it
   * became, and append nothing.
   *
   * **A backwards scan of the live log rather than an index**, and that is a
   * measured choice rather than laziness. The live log is what compaction
   * keeps (`DEFAULT_KEEP_OPS`), a write is a human gesture rather than a
   * packet, and a scan of a few thousand strings costs microseconds — so the
   * index this does not have would be a second copy of the truth to keep in
   * step across four call sites, bought with nothing. Backwards because a
   * replay is by construction the most recent thing that could match: a queue
   * retries within seconds of the answer it lost.
   *
   * **The horizon, said out loud: compaction.** An op whose entry has been
   * compacted out of the live log is not found here and is applied again — and
   * what happens then is exactly what happened before phase 10 and is
   * therefore already safe. Every op that CREATES something carries a
   * client-minted id and the reducer refuses the second one with
   * `duplicate-id`; everything else is absolute-valued (and so idempotent by
   * shape) or refuses on the second pass. Past the horizon a replay degrades
   * from "here is your entry" to "that was refused" — a worse sentence, never
   * a duplicate item.
   *
   * `project.create` is included, and it has to be: its canvas is named in the
   * op rather than in the request, and a create is the one op whose replay
   * would otherwise meet `duplicate-id` at its most confusing — a person told
   * their canvas could not be made, about a canvas that exists.
   */
  async alreadyWritten(request) {
    const canvasId = request.op.type === "project.create" ? request.op.canvasId : request.canvasId;
    if (canvasId === null) return null;
    const runtime = await this.runtime(canvasId).catch(() => null);
    if (!runtime) return null;
    for (let i = runtime.entries.length - 1; i >= 0; i--) {
      const entry = runtime.entries[i];
      if (entry.envelope.id === request.opId) return entry;
    }
    return null;
  }
  /**
   * Naming yourself, atomically (#57). A writer like any other: two agents
   * claiming at the same moment serialize on this chain, so the second is
   * refused or handed a different name by construction — never by a
   * client-side pre-check both of them can pass at once.
   */
  claim(request) {
    return this.enqueueHome(async () => {
      const entry = await this.applyClaimAndPersist(request);
      for (const home of this.homes?.all() ?? []) void home.announceActor(entry.envelope.actor);
      return entry;
    });
  }
  /**
   * **The pass's handoff: this badge now speaks as this actor** (phase 8).
   *
   * Small and named rather than a widening of `claim()`, because it is not a
   * claim. A claim is an assertion made by whoever is asking, judged against
   * everything the home can see — names, live faces, other claimants — and
   * `applyClaim` is where that judging lives. A handoff has already been
   * judged, by the only party in a position to: the badge that IS this actor
   * said so when it minted the pass, and the pass's own single use is the
   * receipt. Running it through `applyClaim` would mean sending `as`, and
   * `reincarnate` refuses `as` while the actor is visibly somebody — which,
   * at the exact moment Jordan redeems, it is: her tab is open on the canvas
   * she minted from. The gesture would refuse itself.
   *
   * It is on the writer chain like every other claims write. `Desk.setClaims`
   * says it is "called from the engine's chain", and it means it: a handoff
   * and a claim racing must serialize, or the loser's read-modify-write
   * erases the winner's row.
   *
   * **The name is filled in, never overwritten.** At a home the registry
   * already knows this actor (its minter claimed it there), so there is
   * nothing to write. On a replica the actor may be arriving on this machine
   * for the first time — the redemption is what tells this daemon that
   * `usr_jordan` is called Jordan, before any op she wrote has replicated —
   * and a hole in the registry means her own name renders as nothing. Filling
   * a hole is safe; overwriting is not, because the name that travels with a
   * pass is the name as of REDEMPTION and a roster arriving a second later is
   * the authority.
   */
  endowClaim(badgeId, actor, canvasId) {
    return this.enqueueHome(async () => {
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      await this.desk.setClaims(
        badgeId,
        bindHandoff(await this.desk.claimsOf(badgeId), {
          actor,
          ts,
          ...canvasId !== void 0 ? { canvasId } : {}
        })
      );
      if (!actor.name) return;
      const runtime = await this.actors();
      if (runtime.registry.names[actor.id]) return;
      runtime.registry = bindName(runtime.registry, { actor, ts });
      await this.store.saveActors(runtime.registry, runtime.lastSeq);
    });
  }
  /**
   * A name free in the ASKING badge's scope — what a home answers when a
   * replica asks on behalf of a claimant who supplied none. The other end of
   * `preferredName`, and the one thing above that a replica cannot work out
   * for itself.
   *
   * Built from `claimContext`, not from a second gathering that looks like it.
   * The whole point is that the answer comes out of the scope this home would
   * judge the resulting claim in; a lookalike scope here would be the same
   * mismatch again, one layer down.
   *
   * It asks with `"admissible"` reach rather than the claim's `"admitted"`,
   * and that is not a departure from the sentence above — it is what makes it
   * true. The badge asking has been NOWHERE yet; the rooms it is about to be
   * in are the rooms a grant would admit it to, which is where the claim it
   * is allocating for will land. Same reach `GET /api/projects` uses, for the
   * same reason. `claimContext` carries the argument and the disclosure
   * check.
   *
   * One name out, never the taken set. The scope's names are already visible
   * to this badge — a refusal says who holds a name — but a route that handed
   * back a roster on request is the listing `orphanedClaims` refuses to be,
   * and this one has no reason to be it.
   *
   * A read, off the writer chain, like the other reads here: an allocation is
   * advice until a claim acts on it, and the claim that acts on it is
   * serialized like everything else.
   */
  async freeName(badgeId) {
    const runtime = await this.actors();
    return allocateName(
      await this.claimContext(
        // A claim that will never be applied. The session key is a probe: it
        // matches no row, so the context is gathered as it would be for a
        // claimant this badge has not seen before — which is exactly who is
        // being allocated for.
        { badgeId, op: { type: "actor.claim", sessionKey: FREE_NAME_PROBE } },
        runtime.registry,
        (/* @__PURE__ */ new Date()).toISOString(),
        // The scope this question is actually about. A replica's badge is
        // brand new and admitted to nothing when it asks, so "admitted" is
        // the empty scope that makes every roster name look free — the
        // original bug, one layer down. See `claimContext`.
        "admissible"
      )
    );
  }
  /**
   * Who the given session keys (or all of them, when omitted) speak as —
   * SCOPED TO ONE BADGE. A badge sees its own claims and nobody else's, which
   * is the re-key showing up on the wire: `sessionKey` is a client's index
   * into its own list, so an answer that crossed badges would be answering a
   * question nobody asked.
   *
   * Naming a key is also how a legacy claim is COLLECTED. A resuming client
   * asks "who is claude-code:s-1?" before it claims anything — `whoami` never
   * writes — so if adoption only happened inside `applyClaim`, every upgraded
   * agent's first command would resolve to the human instead of itself. A
   * named key is a presentation of that key, which is exactly what the shelf
   * waits for; adoption is still one-time and first-come.
   */
  async actorBindings(badgeId, keys) {
    const { registry } = await this.actors();
    if (keys) {
      const held = new Set((await this.desk.claimsOf(badgeId)).map((row) => row.sessionKey));
      for (const key of keys) {
        if (!held.has(key)) await this.desk.adopt(key, badgeId);
      }
    }
    const wanted = keys ? new Set(keys) : null;
    const claims = await this.desk.claimsOf(badgeId);
    const records = [];
    for (const row of claims) {
      if (row.sessionKey === void 0) continue;
      if (wanted && !wanted.has(row.sessionKey)) continue;
      records.push({
        key: row.sessionKey,
        actor: { id: row.actorId, name: registry.names[row.actorId]?.name ?? "" },
        boundAt: row.boundAt,
        ...row.canvasId !== void 0 ? { canvasId: row.canvasId } : {}
      });
    }
    return records;
  }
  /**
   * Claims on this home that match the given session keys but are held by a
   * DIFFERENT badge — the answer to "I have no identity here; is there an
   * actor I should be resuming?".
   *
   * Deliberately key-scoped rather than a listing of the home. A client asking
   * about `claude-code:s-1` is asking about a conversation it is already
   * inside; a client that could ask "who is on this home?" would be handed a
   * roster of actors to impersonate, and the answer would encourage exactly
   * the mistake `--as` exists to prevent. Nothing here is adopted: the claim
   * stays where it is, and coming back is a deliberate act.
   */
  async orphanedClaims(badgeId, keys) {
    if (keys.length === 0) return [];
    const { registry } = await this.actors();
    const records = [];
    for (const key of new Set(keys)) {
      for (const { badgeId: holder, claim: row } of await this.desk.holdersOf(key)) {
        if (holder === badgeId || row.sessionKey === void 0) continue;
        records.push({
          key: row.sessionKey,
          actor: { id: row.actorId, name: registry.names[row.actorId]?.name ?? "" },
          boundAt: row.boundAt,
          ...row.canvasId !== void 0 ? { canvasId: row.canvasId } : {}
        });
      }
    }
    return records.sort((a, b) => b.boundAt.localeCompare(a.boundAt));
  }
  /**
   * Upload a blob. Not an Operation — but `blobs.json` is a whole-file
   * read-modify-write, and gc rewrites the same file, so an upload is a
   * writer like any other and belongs on the same chain. Off it, two clients
   * uploading at once both read the pre-upload index and the second write
   * erases the first's entry: bytes on disk that nothing can name, and a
   * permanent 404 for the item pointing at them.
   *
   * **The index write is on the chain; the trip to the home is not**
   * (lessons #95). On a replica the bytes go to the home first and wait for
   * its confirmation, and that used to happen inside `enqueue`: one large
   * file to a slow home held every write on the machine — every canvas,
   * every home — for as long as the bytes took to cross. The home's half
   * writes nothing here, and content addressing makes the local half the
   * same write whenever it lands, so only the local half takes the chain.
   */
  async putBlob(canvasId, data, meta, sourceContext, badgeId) {
    const routed = await this.enqueue(canvasId, async () => {
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      const home2 = this.homes?.for(canvasId) ?? null;
      if (!home2) return { stored: await this.store.putBlob(canvasId, data, meta) };
      return { home: home2 };
    });
    if ("stored" in routed) return routed.stored;
    const { home } = routed;
    await home.putBlob(canvasId, data, meta);
    const blobHash = createHash2("sha256").update(data).digest("hex");
    const there = await home.hasBlob(canvasId, blobHash);
    if (there === false) {
      throw new Error(
        `${home.homeUrl} took the bytes for ${meta.filename} and does not have them \u2014 not saved; try again`
      );
    }
    if (there) this.confirmedAtHome(home.homeUrl, canvasId).set(blobHash, Date.now());
    return this.enqueue(canvasId, () => this.store.putBlob(canvasId, data, meta));
  }
  /**
   * **Are the bytes where the ops that name them went — and if not, send them.**
   *
   * A blob is not an Operation, so it does not replicate; `putBlob` pushes it
   * to the home by hand. Anything that makes that push not happen — the
   * routing table not yet read, a home that was down for the one second it
   * mattered, a process killed mid-upload — leaves the op replicated and the
   * bytes behind, forever, in silence. A teammate gets the item, its title
   * and its version number, and "blob not found" where the screen should be.
   *
   * It was reported exactly that way, and neither machine could answer the
   * only question that mattered — *are the bytes at the home?* — so the fix
   * was a hand re-upload and the confirmation was somebody else's reload.
   * That is not a repair, it is a guess that happened to work.
   *
   * This asks, per blob, and pushes the missing ones when told to. It is
   * deliberately NOT an Operation: nothing about the canvas changes. It is
   * two copies of the same content-addressed bytes being made to agree, which
   * is why it is safe to run at any time and safe to run twice.
   *
   * **Only the listing is taken on the single-writer chain; the asking is
   * not.** It used to run whole inside `enqueue`, which held every write on
   * the machine — every canvas, every home — behind one HEAD request per
   * blob. The blob keeper runs this for every replica canvas every ten
   * minutes, and one isocan.io canvas of 1,450 blobs at ~171 ms a question
   * held the chain for ~4 minutes at a time: `isocan set` and `wire link` on an
   * isocan.io canvas sat waiting for a sweep they had nothing to do with,
   * and every home link's dial (which waits on `settled()`) logged "a dial
   * has been unfinished for over 30s" on every canvas at once. Nothing below
   * the listing writes this daemon's state — the uploads go to the home,
   * content-addressed and idempotent — so nothing below it needs the chain.
   * A blob the GC takes between the listing and its upload is garbage by
   * definition, and is skipped the same way a blob gone locally always was.
   */
  async reconcileBlobs(canvasId, options, sourceContext, badgeId) {
    const { home, listing } = await this.enqueue(canvasId, async () => {
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      const home2 = this.homes?.for(canvasId) ?? null;
      return { home: home2, listing: home2 ? await this.store.listBlobs(canvasId) : [] };
    });
    if (!home) return { home: null, checked: 0, missing: [], pushed: [], unknown: [] };
    const missing = [];
    const pushed = [];
    const unknown = [];
    const confirmed = this.confirmedAtHome(home.homeUrl, canvasId, listing);
    const now = Date.now();
    const asked = options.trustConfirmed ? listing.filter((blob) => !(now - (confirmed.get(blob.hash) ?? -Infinity) < BLOB_RECONFIRM_MS)) : listing;
    const answers = asked.length > 0 ? await home.hasBlobs(canvasId, asked.map((blob) => blob.hash)) : /* @__PURE__ */ new Map();
    for (const blob of asked) {
      const there = answers.get(blob.hash) ?? null;
      if (there) confirmed.set(blob.hash, now);
      if (there === null) {
        unknown.push(blob.hash);
        continue;
      }
      if (there) continue;
      missing.push(blob.hash);
      if (!options.push) continue;
      let data;
      try {
        const stream = await this.store.openBlob(canvasId, blob.hash);
        if (!stream) continue;
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        data = Buffer.concat(chunks);
      } catch {
        continue;
      }
      await home.putBlob(canvasId, data, {
        mimeType: blob.meta.mimeType,
        filename: blob.meta.filename
      });
      pushed.push(blob.hash);
    }
    return { home: home.homeUrl, checked: listing.length, missing, pushed, unknown };
  }
  /**
   * **Bytes the home has already said it holds**, per home and canvas: hash →
   * when it said so. The content is addressed by its hash, so a "yes" cannot
   * go stale by the bytes changing — only by the home losing them, which is
   * the thing the keeper exists to catch, so the memory lasts
   * `BLOB_RECONFIRM_MS` and then every blob is asked about again. In between,
   * a steady-state sweep asks only about blobs that are new since the last
   * one — which is what keeps a home that predates the batch route from
   * being asked one HEAD per blob every ten minutes.
   *
   * In memory, deliberately: a restart forgets it and the first sweep asks
   * about everything, which is the sweep that catches whatever was lost while
   * this daemon was down. Pruned to the listing each time it is read, so a
   * collected blob does not stay remembered.
   */
  confirmedBlobs = /* @__PURE__ */ new Map();
  confirmedAtHome(homeUrl, canvasId, listing) {
    const key = `${homeUrl}
${canvasId}`;
    let known = this.confirmedBlobs.get(key);
    if (!known) this.confirmedBlobs.set(key, known = /* @__PURE__ */ new Map());
    if (listing) {
      const listed = new Set(listing.map((blob) => blob.hash));
      for (const hash of known.keys()) if (!listed.has(hash)) known.delete(hash);
    }
    return known;
  }
  /**
   * Somewhere to put bytes this daemon must not receive, or null when the
   * backing has no such thing (every file home). Deliberately NOT on the
   * single-writer chain: it reads one blob record and mints a URL, writing
   * nothing, and minting can involve a round trip to a signing API — putting
   * it on the chain would stall every op behind somebody's video.
   */
  async beginUpload(canvasId, request, sourceContext, badgeId) {
    if (sourceContext) {
      if (!badgeId) throw new Error("source policy requires a badge");
      await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
    }
    return this.store.beginUpload(canvasId, request);
  }
  /**
   * Name bytes that arrived without us. ON the chain, because GC is on the
   * chain: a register that lands mid-sweep would otherwise re-name a blob the
   * sweep has just decided is garbage, and the item pointing at it would 404
   * forever.
   */
  registerBlob(canvasId, request, sourceContext, badgeId) {
    return this.enqueue(canvasId, async () => {
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      return this.store.registerBlob(canvasId, request);
    });
  }
  /**
   * Actor-scoped undo: walk THIS actor's stack. Stored inverses are applied
   * as-is when possible (stale values are accepted — undo restores what you
   * changed); inverses invalidated by other actors' ops are repaired (batch
   * ops shrink to their surviving members) or skipped entirely.
   */
  undo(canvasId, actor, badgeId, clientId, clientFeatures, sourceContext) {
    return this.enqueue(canvasId, async () => {
      if (sourceContext) await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit", actor.id);
      await this.requireActor(badgeId, actor.id);
      const home = this.homes?.for(canvasId) ?? null;
      if (home) {
        return this.landRemote(
          canvasId,
          await home.undo(canvasId, {
            actor,
            ...clientFeatures !== void 0 ? { clientFeatures } : {},
            ...clientId !== void 0 ? { clientId } : {}
          })
        );
      }
      const runtime = await this.runtime(canvasId);
      if (clientFeatures !== void 0) {
        requireGroupClient(clientFeatures, runtime.state.project);
        requireQuestionnaireClient(clientFeatures, runtime.state.canvas, runtime.entries);
      }
      const person = actorAliases((await this.actors()).registry.joined, actor.id);
      let written = null;
      for (; ; ) {
        const group = runtime.undo.nextUndoGroup(person);
        if (group.length === 0) {
          if (written !== null) return written;
          throw new NothingToUndoError("undo", actor.name);
        }
        const targetSeq = group[0];
        checkMigrationHistoryBoundary(runtime, group);
        const inverses = group.map((seq) => undoOperationFor(runtime, runtime.entries.find((entry) => entry.seq === seq)));
        for (const inverse of inverses) checkMigrationRollback(runtime, inverse);
        preflightGroupHistory(runtime.state, inverses, actor, group.map((seq) => runtime.entries.find((entry) => entry.seq === seq)), "undo");
        const target = runtime.entries.find((entry) => entry.seq === targetSeq);
        const op = repairInverse(runtime.state, undoOperationFor(runtime, target));
        if (op !== null) {
          try {
            written = await this.applyAndPersist(
              { canvasId, actor, op, badgeId, ...clientId !== void 0 ? { clientId } : {} },
              { kind: "undo", targetSeq }
            );
            if (group.length === 1) return written;
            continue;
          } catch (err) {
            if (op.type === "group.change" || op.type === "design.restore" || err instanceof GroupConflictError || err instanceof DesignRestoreConflict) throw err;
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        runtime.undo.discardUndoTarget(person, targetSeq);
      }
    });
  }
  redo(canvasId, actor, badgeId, clientId, clientFeatures, sourceContext) {
    return this.enqueue(canvasId, async () => {
      if (sourceContext) await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit", actor.id);
      await this.requireActor(badgeId, actor.id);
      const home = this.homes?.for(canvasId) ?? null;
      if (home) {
        return this.landRemote(
          canvasId,
          await home.redo(canvasId, {
            actor,
            ...clientFeatures !== void 0 ? { clientFeatures } : {},
            ...clientId !== void 0 ? { clientId } : {}
          })
        );
      }
      const runtime = await this.runtime(canvasId);
      if (clientFeatures !== void 0) {
        requireGroupClient(clientFeatures, runtime.state.project);
        requireQuestionnaireClient(clientFeatures, runtime.state.canvas, runtime.entries);
      }
      const person = actorAliases((await this.actors()).registry.joined, actor.id);
      let redone = null;
      for (; ; ) {
        const group = runtime.undo.nextRedoGroup(person);
        if (group.length === 0) {
          if (redone !== null) return redone;
          throw new NothingToUndoError("redo", actor.name);
        }
        const next = group[0];
        checkMigrationHistoryBoundary(runtime, group.map((candidate) => candidate.targetSeq));
        preflightGroupHistory(runtime.state, group.map((candidate) => redoOpFor(
          runtime.entries.find((entry) => entry.seq === candidate.targetSeq),
          runtime.entries.find((entry) => entry.seq === candidate.undoSeq)
        )), actor, group.map((candidate) => runtime.entries.find((entry) => entry.seq === candidate.targetSeq)), "redo");
        const target = runtime.entries.find((entry) => entry.seq === next.targetSeq);
        const undoEntry = runtime.entries.find((entry) => entry.seq === next.undoSeq);
        const op = repairInverse(runtime.state, redoOpFor(target, undoEntry));
        if (op !== null) {
          try {
            redone = await this.applyAndPersist(
              { canvasId, actor, op, badgeId, ...clientId !== void 0 ? { clientId } : {} },
              { kind: "redo", targetSeq: next.targetSeq }
            );
            if (group.length === 1) return redone;
            continue;
          } catch (err) {
            if (op.type === "group.change" || op.type === "design.restore" || err instanceof GroupConflictError || err instanceof DesignRestoreConflict) throw err;
            if (!(err instanceof OpValidationError)) throw err;
          }
        }
        runtime.undo.discardRedoTarget(person, next.targetSeq);
      }
    });
  }
  /**
   * Blob garbage collection: compact the oplog to an undo horizon (dropped
   * entries go to the archive), then sweep blobs unreachable from live state,
   * trash, and the retained log. Runs inside the single-writer queue, so it
   * cannot race a mutation; the mtime grace period covers uploads that have
   * not become items yet. Maintenance, not an Operation — never undoable.
   */
  gc(canvasId, options = {}, sourceContext, badgeId) {
    return this.enqueue(canvasId, async () => {
      if (sourceContext) {
        if (!badgeId) throw new Error("source policy requires a badge");
        await this.sourceGuard?.(canvasId, badgeId, sourceContext, "edit");
      }
      const runtime = await this.runtime(canvasId);
      const keepOps = options.keepOps ?? DEFAULT_KEEP_OPS;
      const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
      const dryRun = options.dryRun ?? false;
      const retained = chooseRetained(runtime.entries, keepOps);
      const retainedSeqs = new Set(retained.map((entry) => entry.seq));
      const dropped = runtime.entries.filter((entry) => !retainedSeqs.has(entry.seq));
      const marked3 = reachableHashes(runtime.state, retained);
      const listing = await this.store.listBlobs(canvasId);
      const report = {
        dryRun,
        retainedEntries: retained.length,
        droppedEntries: dropped.length,
        reachableBlobs: 0,
        reachableBytes: 0,
        sweptBlobs: 0,
        sweptBytes: 0,
        skippedRecentBlobs: 0
      };
      const sweep = [];
      for (const { hash, meta, ageMs } of listing) {
        if (marked3.has(hash)) {
          report.reachableBlobs += 1;
          report.reachableBytes += meta.size;
          continue;
        }
        if (ageMs !== null && ageMs < graceMs) {
          report.skippedRecentBlobs += 1;
          continue;
        }
        sweep.push(hash);
        report.sweptBlobs += 1;
        report.sweptBytes += meta.size;
      }
      if (dryRun) return report;
      if (dropped.length > 0) {
        await this.store.compactOplog(canvasId, retained, dropped);
        runtime.entries = retained;
        runtime.undo = UndoStacks.rebuild(retained);
      }
      if (sweep.length > 0) await this.store.deleteBlobs(canvasId, sweep);
      return report;
    });
  }
  // ---------- the replica side: what arrives from the home ----------
  //
  // Everything below runs on a daemon that has been demoted. Three entry
  // points, all of them queued on the same single-writer chain as a local
  // write, because a forwarded write and an arriving entry are two mutations
  // of one state and letting them interleave is exactly the corruption the
  // chain has always existed to prevent.
  /**
   * One entry from the home, landed here with **the home's seq, verbatim**.
   *
   * The seq is not re-assigned and the entry does not go near
   * `applyAndPersist`'s numbering. That is not an implementation detail, it is
   * the demotion: two machines numbering one log is the disaster the whole
   * design forbids, and a replica that renumbered would make its own oplog
   * un-comparable with the home's — which is the one thing that has to stay
   * true for a seq cursor to mean anything on reconnect.
   *
   * ## The double-application guard
   *
   * A forwarded write's answer and the broadcast of that same write are the
   * SAME entry arriving twice, by two routes, in either order. **Seq is the
   * idempotence key**, and it is the natural one: the home assigns seqs
   * strictly increasing per canvas from one writer, so `seq <= lastSeq` means
   * "already have it" with no bookkeeping to keep, no dedup table to bound,
   * and nothing to get wrong after a restart — the store itself remembers.
   * Whichever route arrives first applies; the other is a no-op. (In practice
   * the broadcast usually wins, because the home broadcasts inside its own
   * write before it writes the HTTP response.)
   *
   * `gap` is the other answer: an entry past `lastSeq + 1` cannot be applied
   * on top of a state that is not its pre-state, so it is refused here and the
   * caller re-dials with the cursor it does hold. Guessing would be the only
   * way to be wrong silently.
   */
  applyRemote(canvasId, entry) {
    return this.enqueue(canvasId, () => this.applyRemoteEntry(canvasId, entry));
  }
  /**
   * The home could not serve a tail, so it sent state instead — take it.
   *
   * The live log is emptied in the same breath, and that is the load-bearing
   * half. The entries this replica holds are a PREFIX the home has told us it
   * cannot join up to; keeping them beside a snapshot from far past their end
   * would leave `load()` replaying a tail that is not a tail, and `getLog`
   * answering a cursor question with entries from before the gap. Emptying it
   * through `compactOplog` rather than by deletion is deliberate: that method
   * archives before it forgets, so the history is preserved for audit, and a
   * backing where a seq must stay claimed forever (the cloud one) is not asked
   * to free anything.
   */
  adoptRemoteSnapshot(canvasId, snapshot) {
    return this.enqueue(canvasId, async () => {
      const state = { project: snapshot.project, canvas: snapshot.canvas };
      if (state.project.id !== canvasId) throw new OpValidationError("bad-op", "snapshot belongs to another canvas");
      if (state.project.groupMode !== void 0 && state.project.groupMode !== "groups" && state.project.groupMode !== "legacy") {
        throw new OpValidationError("bad-op", "groupMode must be groups or legacy");
      }
      validateGroupForest(state);
      validateDesignRecordState(state);
      for (const thread of Object.values(state.canvas.threads)) {
        for (const comment of thread.comments) validateQuestionnaireComment(comment, canvasId);
        for (const comment of thread.comments) if (comment.context !== void 0) {
          if (state.project.groupMode !== "groups") throw new OpValidationError("bad-op", "frozen context requires a group-mode canvas");
          validateContextManifest(comment.context, canvasId);
        }
      }
      let held = [];
      if (await this.store.canvasExists(canvasId)) {
        const runtime = await this.runtime(canvasId).catch(() => null);
        if (runtime && runtime.lastSeq === snapshot.lastSeq) return;
        held = runtime?.entries ?? [];
      } else {
        await this.store.createCanvasDir(canvasId);
      }
      if (held.length > 0) await this.store.compactOplog(canvasId, [], held);
      await this.store.saveSnapshot(canvasId, state, snapshot.lastSeq);
      this.canvases.set(canvasId, {
        state,
        lastSeq: snapshot.lastSeq,
        entries: [],
        undo: UndoStacks.rebuild([])
      });
      await ensureHomeLinkGrant(this.desk, canvasId);
    });
  }
  /**
   * **Forget the in-memory copy of a canvas, without touching the store.**
   *
   * A delete does this as its third step; a TAKEDOWN does only this (operator
   * phase 2). The engine holds a canvas's state, its log tail and its undo
   * stack in `canvases`, and a home that had stopped serving a canvas while
   * still holding it in memory would go on answering `getSnapshot` from the
   * cache — which is the one read the content origin makes on the serve path,
   * so a signed URL minted a minute before would keep working. The phase's
   * acceptance is precisely that it does not.
   *
   * Public and named, rather than the fourth bare `canvases.delete` in this
   * file: the takedown route is outside the engine, and a caller reaching into
   * a private map is how the three deletes above came to be three copies.
   */
  drop(canvasId) {
    this.canvases.delete(canvasId);
  }
  /** The home says this canvas is gone. Soft, like every delete here: the
   * directory is moved aside rather than removed, so a replica that was told
   * to forget a canvas can still be asked what it used to hold. */
  applyRemoteDelete(canvasId) {
    return this.enqueue(canvasId, async () => {
      if (!await this.store.canvasExists(canvasId)) return;
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
    });
  }
  /**
   * Identity's public face, as the home has it — names and chosen colors.
   *
   * These ride on every `snapshot`, every `resumed` and every
   * `presence-roster` already, for the reason `protocol.ts` gives: nothing in
   * an op tail carries them, and a rename has to reach the words somebody
   * wrote before it. On a replica they are also the ONLY route by which a
   * stranger's name arrives — the actors oplog is home-scoped and `/ws` is per
   * canvas, so `isocan who` and `isocan ls` on this machine would otherwise
   * letter everyone by whatever was stamped on their oldest comment.
   *
   * A merge, never a replacement: an actor the home has not heard of yet (one
   * claimed here a second ago, whose announcement is still in flight) keeps
   * its local row instead of being erased by an answer that simply does not
   * mention it.
   *
   * ---
   *
   * **A RENAME THAT DID NOT REACH A HOME IS LOST WHEN THAT HOME COMES BACK.
   * Measured, 2026-08-24 (phase 10.3), not reasoned about.**
   *
   * The mechanism is the loop below: `at: now` is stamped on whatever a roster
   * carries and a differing name is overwritten unconditionally. The wire
   * carries `names: Record<actorId, string>` with **no timestamps**, so
   * last-writer-wins is not available here without a protocol change — the
   * only thing this code can know about a name is that a home said it just
   * now, which is exactly what makes the stale one win.
   *
   * What the measurement did: two homes, one daemon holding a canvas at each.
   * Kenny renames himself to Isaac while H2 is down. The announcement reaches
   * H1. H2 comes back on the same address. What was observed at the daemon:
   *
   * - `Isaac → Kenny`, within a couple of seconds of H2's first roster, **and
   *   it stayed Kenny.** Five seconds of sampling, one transition, no
   *   recovery. H1 went on saying Isaac and H2 went on saying Kenny, so the
   *   two homes now disagree permanently and the machine sides with the stale
   *   one.
   * - **A live relay does NOT correct it.** There was a session on H2's canvas
   *   relaying continuously throughout, which is the mechanism that was
   *   supposed to heal this (`ensureClaim`'s cache is keyed by id AND name, so
   *   a relay carrying the new name would re-claim it). It carried the name
   *   the roster had just overwritten, which is the old one, so the cache was
   *   never asked about the new one.
   * - **A WRITE does correct it — but only if the new name is still held
   *   somewhere outside this daemon.** Posting an op with `actor: {id, name:
   *   "Isaac"}` brought both the daemon and H2 back to Isaac immediately. In
   *   practice a person's CLI resolves its name FROM this registry, which by
   *   then says Kenny, so a real rename is not flapping — it is gone.
   *
   * **And it is NOT new**, which is the half the design got wrong and the half
   * that matters most for what to do about it. The control — the same rename
   * against a daemon with ONE home — flapped identically: `Kenny`, with no
   * transition away from it, from the moment the home returned. Phase 10.3 did
   * not create this seam. It made the WINDOW ordinary: before it, a daemon
   * whose home was down refused every write on the machine, so nobody carried
   * on working through an outage and nobody renamed themselves during one.
   * Now a canvas at a reachable home keeps working while another home is
   * away, so the window is a normal afternoon.
   *
   * Left as a named seam rather than fixed here, deliberately: the fix is
   * timestamps on the wire (`names: Record<actorId, {name, at}>`), which is a
   * protocol change on three message types, and this phase's Work is
   * elsewhere. What is NOT acceptable is the version of this comment that said
   * "transient and self-healing" — that was a hypothesis, and it measured
   * false.
   */
  mergeRemoteIdentity(colors, names) {
    return this.enqueueHome(async () => {
      const runtime = await this.actors();
      const nextNames = { ...runtime.registry.names };
      const nextColors = { ...runtime.registry.colors };
      let changed = false;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const [actorId, name] of Object.entries(names)) {
        if (nextNames[actorId]?.name === name) continue;
        nextNames[actorId] = { name, at: now };
        changed = true;
      }
      for (const [actorId, color] of Object.entries(colors)) {
        if (nextColors[actorId] === color) continue;
        nextColors[actorId] = color;
        changed = true;
      }
      if (!changed) return;
      runtime.registry = { ...runtime.registry, names: nextNames, colors: nextColors };
      await this.store.saveActors(runtime.registry, runtime.lastSeq);
    });
  }
  /** Forward a write and land the home's answer here. Runs INSIDE the queue —
   * hence the private, unqueued `applyRemoteEntry` rather than the public
   * `applyRemote`, which would deadlock waiting on the chain it is already
   * on. */
  async forwardSubmit(home, request) {
    const answer = await home.submitOp({
      ...request.clientFeatures !== void 0 ? { clientFeatures: request.clientFeatures } : {},
      ...request.originGroupMode !== void 0 ? { originGroupMode: request.originGroupMode } : {},
      canvasId: request.canvasId,
      actor: request.actor,
      op: request.op,
      ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
      // The key travels, because the writer it is a question for is up there.
      // A replica has nothing to dedupe against — it holds no order of its own
      // — and passing it through is what lets a CLI's retry mean the same
      // thing at the home as a tab's does.
      ...request.opId !== void 0 ? { opId: request.opId } : {},
      // A birth in a space names the space to the home that holds it (roles
      // phase 4); the home checks `own` there and writes no link grant.
      ...request.spaceId !== void 0 ? { spaceId: request.spaceId } : {}
    });
    const canvasId = request.op.type === "project.create" ? request.op.canvasId : request.canvasId;
    return this.landRemote(canvasId, answer);
  }
  /**
   * Apply what the home answered, and hand the caller the home's own entry.
   *
   * Applying here rather than only waiting for the socket is what makes
   * read-after-write work on a replica: `bindFresh` creates a canvas and reads
   * it straight back, `isocan add` prints the item it just made. A round trip
   * through the socket would be a race the CLI would lose often enough to be a
   * bug report. Applying twice is free — see `applyRemoteEntry`'s seq guard.
   */
  async landRemote(canvasId, answer) {
    const entry = {
      seq: answer.seq,
      envelope: answer.envelope,
      ...answer.inverse !== void 0 ? { inverse: answer.inverse } : {}
    };
    if (canvasId !== null) await this.applyRemoteEntry(canvasId, entry);
    return { inverse: null, ...entry };
  }
  /** The unqueued core. Every caller is already on the chain. */
  async applyRemoteEntry(canvasId, incoming) {
    const { envelope, seq } = incoming;
    const op = envelope.op;
    if (op.type === "project.create") {
      if (await this.store.canvasExists(op.canvasId)) return "skipped";
      const state = applyOperation(null, envelope);
      const entry2 = {
        seq,
        envelope,
        inverse: incoming.inverse !== void 0 ? incoming.inverse : invertOperation(null, op),
        ...incoming.cause !== void 0 ? { cause: incoming.cause } : {}
      };
      await this.store.createCanvasDir(op.canvasId);
      await this.appendOrFence(op.canvasId, entry2);
      await this.store.saveSnapshot(op.canvasId, state, seq);
      this.canvases.set(op.canvasId, {
        state,
        lastSeq: seq,
        entries: [entry2],
        undo: UndoStacks.rebuild([entry2])
      });
      await ensureHomeLinkGrant(this.desk, op.canvasId);
      this.emit(op.canvasId, { type: "op-applied", entry: entry2 });
      return "applied";
    }
    const runtime = await this.runtime(canvasId).catch(() => null);
    if (!runtime) return "gap";
    if (seq <= runtime.lastSeq) return "skipped";
    if (seq !== runtime.lastSeq + 1) return "gap";
    let nextState;
    let inverse;
    try {
      inverse = incoming.inverse !== void 0 ? incoming.inverse : invertOperation(runtime.state, op);
      nextState = applyOperation(runtime.state, envelope);
    } catch {
      return "gap";
    }
    const entry = {
      seq,
      envelope,
      inverse,
      ...incoming.cause !== void 0 ? { cause: incoming.cause } : {}
    };
    await this.appendOrFence(canvasId, entry);
    if (nextState === null) {
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
      return "applied";
    }
    runtime.state = nextState;
    runtime.lastSeq = seq;
    runtime.entries.push(entry);
    runtime.undo.record(entry);
    await this.store.saveSnapshot(canvasId, nextState, seq);
    this.emit(canvasId, { type: "op-applied", entry });
    return "applied";
  }
  async applyClaimAndPersist(request) {
    const runtime = await this.actors();
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    if (request.op.as) {
      const refused = this.options.refusedActor?.(request.op.as);
      if (refused) throw new OpValidationError(REFUSED, refusalSentence(refused));
    }
    const { registry, actor, claims, adopted } = applyClaim(
      await this.claimContext(request, runtime.registry, ts),
      request.op
    );
    const envelope = {
      id: newOpId(),
      canvasId: null,
      actor,
      ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
      ts,
      op: request.op
    };
    const seq = runtime.lastSeq + 1;
    const entry = { seq, envelope, inverse: null };
    await this.appendActorsOrFence(entry);
    runtime.registry = registry;
    runtime.lastSeq = seq;
    await this.store.saveActors(registry, seq);
    if (adopted !== void 0) await this.desk.adopt(adopted, request.badgeId);
    await this.desk.setClaims(request.badgeId, claims);
    this.identityChanged(registry.colors, actor.id);
    return entry;
  }
  /**
   * Everything `applyClaim` is allowed to see, gathered at the single writer.
   *
   * The GATHERING is where mechanism 10 lives, and it lives here rather than
   * in the reducer on purpose: `claims.ts` has never heard of a badge record
   * or an admission, and judging a name against "everyone in scope" is the
   * same code whatever the scope turns out to be. What changed in phase 3 is
   * only what gets put in front of it.
   */
  async claimContext(request, registry, now, reach = "admitted") {
    const badge = await this.desk.badge(request.badgeId);
    const canvasIds = (badge?.admissions ?? []).map((a) => a.canvasId);
    if (reach === "admissible" && badge) {
      for (const canvas of await this.listCanvases()) {
        if (canvasIds.includes(canvas.id)) continue;
        if (await admittingGrant(this.desk, canvas.id, badge)) canvasIds.push(canvas.id);
      }
    }
    const from = request.op.canvasId;
    if (from !== void 0 && !canvasIds.includes(from) && badge) {
      if (await admittingGrant(this.desk, from, badge)) canvasIds.push(from);
    }
    const holders = request.op.as ? await this.desk.claimants(request.op.as) : [];
    const own = await this.desk.claimsOf(request.badgeId);
    const scoped = [...own, ...await this.desk.claimsIn(canvasIds)];
    const shelved = (await this.desk.holdersOf(request.op.sessionKey)).find(
      (row) => row.badgeId === SHELF
    )?.claim;
    return {
      registry,
      own,
      ...shelved !== void 0 ? { shelved } : {},
      ...await this.preferredName(request, own, shelved),
      scoped,
      /**
       * Only `as` asks a global question, so only `as` pays for one.
       *
       * **Rows on THIS badge stop blocking once they are no longer fresh, and
       * that is the fix for #89.** The refusal these feed exists for one
       * reason, stated where it is thrown: letting a second session key an
       * actor a first is holding "would unseat a working agent". On another
       * badge we cannot see whether that agent is working, so the
       * thirty-minute window stands. On THIS badge we can: a working agent is
       * live on a canvas, and `wornLive` refuses for it with better
       * information and no clock at all.
       *
       * The short window that remains covers the one case `wornLive` cannot:
       * an agent that has JUST claimed and has not reached a canvas yet, so
       * it is nobody's face but is seconds from being one. That case is
       * deliberate and tested ("a just-claimed session is presumed alive").
       * Half an hour of it was the bug; a minute of it is the guard.
       *
       * What the window was doing instead was refusing an agent its own past
       * self. A harness gives each conversation a new session key, so a fresh
       * conversation on the same machine, with the same badge, holding a
       * transcript of nothing, was told it "is somebody else here" — for half
       * an hour, even after a clean `session end`, even with the old agent
       * demonstrably gone. That is the reincarnation `--agent-help` documents,
       * refused by the guard meant to protect it. It also reached CI, where a
       * pass test failed on exactly this sentence and passed on a re-run.
       *
       * The badge ids the desk hands back stay dropped from what the reducer
       * SEES — `reincarnate` judges whether an actor is visibly somebody,
       * which is a question about claims and never about who is holding them
       * (mechanism 5's "the reducer judges actors, never badges"). The badge
       * thinking happens here, beside `heldElsewhere`, which is the same
       * shape and the same reason.
       */
      claimants: holders.filter((row) => row.badgeId !== request.badgeId || fresh(row.claim.boundAt, now)).map((row) => row.claim),
      ...request.op.as ? await this.vouch(request.badgeId, request.op.as, request.op.sessionKey, holders) : {},
      held: await this.heldNames(canvasIds),
      now
    };
  }
  /**
   * **Is this claimant allowed to be that actor, and by what?** — the
   * gathering half of mechanism 6, and the tightening that comes with it.
   *
   * Two facts, both about badges, both computed HERE because `claims.ts` has
   * never heard of a badge record and must not start:
   *
   * - `heldElsewhere` — some other badge already speaks as this actor, under a
   *   key that is not the one being presented. That is what turns `as` from an
   *   open assertion into a request that needs a vouch.
   *
   *   **Two exclusions, and both are load-bearing.** The migration SHELF is
   *   not "elsewhere": a shelved pre-badge row belongs to no holder at all,
   *   and treating it as one would lock a legacy session out of its own actor
   *   on the one hop it has to adopt it. And a row under THE SAME SESSION KEY
   *   is not "elsewhere" either, which is the shipped lost-badge recovery and
   *   the reason this tightening stops where it does — see the note on
   *   `heldElsewhere` in `claims.ts`.
   * - `vouchedBy` — the attribute this badge and a badge claiming that actor
   *   have BOTH proved. Jordan's phone and Jordan's laptop, one inbox.
   *
   * **The vouch is a membership test against the listing**, not a second
   * spelling of the rule — the same discipline kill-a-badge takes ("what you
   * may kill and what you are shown cannot drift apart"). What a surface is
   * OFFERED on `GET /api/attest` and what the reducer will ACCEPT are one
   * computation, so a person cannot be shown a button that is refused.
   */
  async vouch(badgeId, as, sessionKey, holders) {
    const elsewhere = holders.some(
      (row) => row.badgeId !== badgeId && row.badgeId !== SHELF && row.claim.sessionKey !== sessionKey
    );
    if (!elsewhere) return {};
    const vouch = (await this.resumable(badgeId)).find((row) => row.actor.id === as);
    return { heldElsewhere: true, ...vouch ? { vouchedBy: vouch.via } : {} };
  }
  /**
   * **Who this badge may resume, and on the strength of what** — mechanism 6's
   * "a badge attesting the same email as the badge that claimed an actor may
   * resume that actor".
   *
   * Every actor claimed by some OTHER live badge that has proved an attribute
   * this badge has also proved, minus the ones this badge already claims
   * (those need no resuming — `claimsActor` already says yes).
   *
   * **A badge with no attestations resumes nobody, in one line and with no
   * query.** That is the whole of "attestation adds a way and removes none":
   * the overwhelming majority of holders have proved nothing, and for them
   * this function is a document read and an empty array.
   *
   * The name comes from the registry as of NOW rather than from the claim row,
   * for `redeemPass`'s reason: a person who renamed herself is offered the name
   * she goes by, which is also the name her work already carries.
   */
  async resumable(badgeId) {
    const me = await this.desk.badge(badgeId);
    const mine = me?.attestations ?? [];
    if (mine.length === 0) return [];
    const names = await this.actorNames();
    const { registry } = await this.actors();
    const seen = new Set(me.claims.map((claim) => claim.actorId));
    const rows = [];
    for (const attestation of mine) {
      for (const badge of await this.desk.badgesAttesting(attestation.attribute)) {
        if (badge.badgeId === badgeId) continue;
        for (const claim of badge.claims) {
          if (seen.has(claim.actorId)) continue;
          seen.add(claim.actorId);
          if (resolveActor(registry.joined, claim.actorId) !== claim.actorId) continue;
          rows.push({
            actor: { id: claim.actorId, name: names[claim.actorId] ?? "" },
            via: attestation.attribute
          });
        }
      }
    }
    return rows;
  }
  /**
   * Ask the home for a name, when this daemon is a replica and the claimant
   * asked for none — the ONE part of a claim that crosses the wire.
   *
   * The split is deliberate and narrow. A claim still does not forward (see
   * `claim()`), because "the process holding sessionKey `claude-code:s-1` is
   * Isaac" is a fact only this daemon can hold. But WHICH name a nameless
   * claimant is handed is not that kind of fact at all: it is a question about
   * a namespace shared with everybody else at the home, and on a replica the
   * home owns that namespace. Answering it locally is how a fresh replica
   * confidently hands out "Isaac" and is then refused by the home a
   * millisecond later — the local answer correct by its own scope, and wrong
   * where it lands.
   *
   * Three ways this stays small:
   *
   * - **Only allocation.** A supplied name is judged, not allocated, and a
   *   collision on one is still refused locally with the message it always
   *   had. A key this badge (or the shelf) already holds is a RESUMPTION,
   *   handed back the name it already has — nothing to allocate, nothing to
   *   ask.
   * - **Only a preference.** The answer arrives as `ClaimContext.preferred`
   *   and is re-checked against the local scope, so a stale answer costs a
   *   roster position rather than a wrong name.
   * - **Never load-bearing.** Any failure — an unreachable home, a home too
   *   old to know the route — falls back to local allocation, which is what a
   *   replica did before and what keeps it usable with no home in sight.
   *
   * **WHICH home is asked, under many of them** (phase 10.3), and this is the
   * one site in the table that did not simply fall out. A nameless claim is
   * not about a canvas, so `for(canvasId)` has nothing to look up; and asking
   * every home and intersecting the answers is **not available**, because
   * `freeName` returns one name out and never the taken set, on purpose (see
   * `heldNames` — a route that could return the taken set would be the home
   * listing its rosters to anyone who knocked).
   *
   * Two things make it tractable. `actor.claim` carries an optional
   * `canvasId` — phase 7's marked hole, exactly the shape needed here — so a
   * claim that names a canvas asks THAT canvas's home. A claim that names none
   * asks `birth()`: the home this machine's next canvas goes to, which is the
   * best available proxy for where this identity is heading.
   *
   * The seam left, named rather than smoothed, and **widened by exactly one
   * notch**: two replicas asking in the same instant can be handed the same
   * name, and now also a name free at one home may be taken at another. Both
   * end the same way — the second one's `announceActor` meets that home's
   * refusal exactly as it does today, with the home's own words. Closing
   * either would mean RESERVING a name at a home, and a reservation is a claim
   * — which is the thing that must not forward. So no reservation is built
   * here; the fallback below is the answer, and it is the same fallback as
   * "the home did not answer".
   */
  async preferredName(request, own, shelved) {
    const op = request.op;
    if (!this.homes) return {};
    if (op.name !== void 0 || op.as !== void 0) return {};
    if (!op.fresh && (own.some((row) => row.sessionKey === op.sessionKey) || shelved)) return {};
    const home = op.canvasId !== void 0 ? this.homes.for(op.canvasId) : this.homes.birth();
    if (!home) return {};
    try {
      return { preferred: await home.freeName() };
    } catch {
      return {};
    }
  }
  /**
   * Everyone the canvases IN SCOPE answer to — live faces (and their labels)
   * plus every name remembered in history, the same set an @-mention resolves
   * against. This is what `heldNames()` in the CLI used to reconstruct by
   * polling; here it is a read the single writer takes mid-claim.
   *
   * It used to walk the whole home. Mechanism 10 stops it at the claiming
   * badge's admissions: name uniqueness is a ROSTER property, so it is asked
   * of exactly the rosters that badge can see. A solo home degenerates to the
   * old walk, because a local daemon's badge is admitted to the canvases it
   * works on — the same code, with the scope emerging from the badge instead
   * of being hard-coded.
   */
  async heldNames(canvasIds) {
    const inScope = new Set(canvasIds);
    const holders = [];
    for (const canvas of await this.listCanvases()) {
      if (!inScope.has(canvas.id)) continue;
      let state;
      try {
        state = (await this.runtime(canvas.id)).state;
      } catch {
        continue;
      }
      const add = (actor, live) => holders.push({ actor, canvas: canvas.title, live });
      add(canvas.createdBy, false);
      add(canvas.updatedBy, false);
      for (const known of collectCanvasNames(state.canvas)) {
        add({ id: known.id, name: known.name }, false);
      }
      for (const session of this.options.liveness?.(canvas.id) ?? []) {
        add(session.actor, true);
        if (session.label) add({ id: session.actor.id, name: session.label }, true);
      }
    }
    return holders;
  }
  /**
   * The actor registry, loaded once. A PROMISE rather than the value, because
   * canvas queues read it concurrently with the home queue writing it: two
   * cold readers that each loaded and assigned their own copy would leave the
   * identity writes landing on one object and the next reader holding the
   * other — a lost name in memory, and the next registry append fenced.
   */
  actors() {
    if (!this.actorsRuntime) {
      const loading = this.store.loadActors();
      this.actorsRuntime = loading;
      loading.catch(() => {
        if (this.actorsRuntime === loading) this.actorsRuntime = null;
      });
    }
    return this.actorsRuntime;
  }
  /** Eligibility is a protected canvas read; joins affect comparison, never historical authorship. */
  async designRespondents(canvasId) {
    const state = (await this.runtime(canvasId)).state;
    return { actors: questionnaireActors(state, (await this.actors()).registry, (this.options.liveness?.(canvasId) ?? []).map((session) => session.actor)) };
  }
  /** The serialized read binds admitted JSON and canonical discovery history at one local state. */
  async designRequests(canvasId, home) {
    return this.enqueue(canvasId, async () => {
      const runtime = await this.runtime(canvasId);
      return readDesignRequests(this.store, runtime.state, home, (await this.actors()).registry, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
    });
  }
  /** Attributed repair acceptance and Undo/Redo standing use live and archived canonical history. */
  async designRepairs(canvasId, home) {
    return this.enqueue(canvasId, async () => {
      const runtime = await this.runtime(canvasId);
      return readDesignRepairs(this.store, runtime.state, home, (await this.actors()).registry, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
    });
  }
  /** Canonical comparison history is read under the same serialized canvas authority as request state. */
  async designDecisions(canvasId, home) {
    return this.enqueue(canvasId, async () => {
      const runtime = await this.runtime(canvasId);
      return readDesignDecisions(this.store, runtime.state, home, (await this.actors()).registry, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
    });
  }
  /** Core pipeline. Runs inside the queue. */
  async applyAndPersist(request, cause) {
    const { op } = request;
    if (cause === void 0 && INTERNAL_OP_TYPES.has(op.type)) {
      throw new OpValidationError("internal-op", `${op.type} cannot be issued directly`);
    }
    if (op.type === "actor.claim") {
      throw new OpValidationError("bad-op", "actor.claim goes through Engine.claim");
    }
    if (op.type === "project.create") {
      return this.createProject(request, op);
    }
    const canvasId = request.canvasId;
    if (canvasId === null) {
      throw new OpValidationError("bad-op", "canvasId is required");
    }
    const runtime = await this.runtime(canvasId);
    if (cause === void 0) guardDesignRecordEdit(runtime.state, op);
    if (request.clientFeatures !== void 0) {
      requireGroupClient(request.clientFeatures, runtime.state.project);
      requireQuestionnaireClient(request.clientFeatures, runtime.state.canvas);
    }
    if (cause === void 0 && request.originGroupMode !== void 0 && request.originGroupMode !== (runtime.state.project.groupMode ?? "legacy")) throw new MigrationBoundaryError(`This write was prepared in ${request.originGroupMode} mode, but the canvas now uses ${runtime.state.project.groupMode ?? "legacy"}. Review the queued work before sending a new request.`);
    let normalizedOp = op.type === "item.add" && runtime.state.project.groupMode !== "groups" ? {
      ...op,
      placement: {
        ...resolvePlacement(
          runtime.state.canvas,
          op.placement,
          op.width,
          op.height,
          positionIsMeaningful(op)
        ),
        // The log keeps WHY it landed there: a chosen spot stays
        // marked, so a replay — and anyone reading the log — sees a
        // person's gesture rather than a coincidence of clear ground.
        ..."x" in op.placement && op.placement.chosen ? { chosen: true } : {}
      }
    } : op;
    const contentOp = normalizedOp.type === "group.change" && normalizedOp.action.kind === "content" ? normalizedOp.action.operation : normalizedOp;
    if (cause === void 0 && runtime.state.project.groupMode === "groups" && (contentOp.type === "item.addVersion" || contentOp.type === "item.setCurrentVersion")) {
      const item = runtime.state.canvas.items[contentOp.itemId];
      if (item && isGroupItem(item) && contentOp.briefHeight === void 0) {
        const version = contentOp.type === "item.addVersion" ? contentOp.version : item.versions.find((one) => one.id === contentOp.versionId);
        if (version?.mimeType === "text/markdown") {
          const stream = await this.store.openBlob(canvasId, version.blobHash);
          if (!stream) throw new OpValidationError("bad-op", "group brief bytes are unavailable; upload them before changing the brief");
          const decoder = new StringDecoder("utf8");
          let nonempty = false;
          for await (const chunk of stream) {
            if (/\S/u.test(decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))) {
              nonempty = true;
              break;
            }
          }
          nonempty ||= /\S/u.test(decoder.end());
          const repaired = { ...contentOp, briefHeight: nonempty ? item.groupLayout?.briefHeight || 120 : 0 };
          normalizedOp = normalizedOp.type === "group.change" ? { type: "group.change", action: { kind: "content", operation: repaired } } : repaired;
        }
      }
    }
    let designDecisionTimestamp;
    if (cause === void 0) {
      if (isDesignRepairOperation(normalizedOp)) {
        request = { ...request, opId: request.opId ?? this.envelope(request, normalizedOp).id };
        if (!request.authoritativeHome) throw new OpValidationError("bad-op", "design writer has no authoritative home address");
        normalizedOp = await materializeDesignRepair(this.store, runtime.state, request.authoritativeHome, normalizedOp, request.actor, (await this.actors()).registry, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
      }
      if (isDesignDecisionOperation(normalizedOp)) {
        const prepared = this.envelope(request, normalizedOp);
        request = { ...request, opId: prepared.id };
        designDecisionTimestamp = prepared.ts;
        if (!request.authoritativeHome) throw new OpValidationError("bad-op", "design writer has no authoritative home address");
        normalizedOp = await materializeDesignDecision(this.store, runtime.state, request.authoritativeHome, normalizedOp, request.actor, (await this.actors()).registry, prepared.id, prepared.ts, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
      }
      if (isDesignRecordOperation(normalizedOp)) {
        const opId = request.opId ?? this.envelope(request, normalizedOp).id;
        request = { ...request, opId };
        if (!request.authoritativeHome) throw new OpValidationError("bad-op", "design writer has no authoritative home address");
        normalizedOp = await materializeDesignRecord(this.store, runtime.state, runtime.lastSeq, normalizedOp, request.actor, (await this.actors()).registry, request.authoritativeHome, opId, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
        const effect = normalizedOp.effect;
        if (effect.type === "item.add" && runtime.state.project.groupMode !== "groups") normalizedOp = { ...normalizedOp, effect: { ...effect, placement: { ...resolvePlacement(runtime.state.canvas, effect.placement, effect.width, effect.height, positionIsMeaningful(effect)), ..."x" in effect.placement && effect.placement.chosen ? { chosen: true } : {} } } };
      }
      if (isQuestionnaireOperation(normalizedOp)) normalizedOp = await resolveQuestionnaireOperation(this.store, runtime.state, runtime.lastSeq, normalizedOp, request.actor, (await this.actors()).registry, request.authoritativeHome, [...runtime.entries, ...await this.store.readArchivedLog(canvasId)]);
      normalizedOp = resolveContextOperation(runtime.state, runtime.lastSeq, normalizedOp);
      if (normalizedOp.type === "thread.create" || normalizedOp.type === "thread.reply") {
        if (normalizedOp.comment.context) normalizedOp = { ...normalizedOp, comment: { ...normalizedOp.comment, context: await hydrateContextManifest(this.store, runtime.state, normalizedOp.comment.context) } };
      } else if (normalizedOp.type === "comment.update" && normalizedOp.context) {
        normalizedOp = { ...normalizedOp, context: await hydrateContextManifest(this.store, runtime.state, normalizedOp.context) };
      }
    }
    const envelope = this.envelope(request, normalizedOp);
    if (designDecisionTimestamp) envelope.ts = designDecisionTimestamp;
    if (cause?.kind === "redo" && isMigrationChange(normalizedOp, "groups")) {
      normalizedOp = { ...normalizedOp, action: { kind: "apply", change: { ...normalizedOp.action.change, migration: { ...normalizedOp.action.change.migration, boundary: { version: 1, opId: envelope.id, seq: runtime.lastSeq + 1 } } } } };
      envelope.op = normalizedOp;
    }
    if (cause === void 0) {
      if (runtime.state.project.groupMode !== "groups") {
        const introducesGroup = op.type === "item.add" ? op.properties?.kind === "group" || "containerId" in op || "groupLayout" in op : op.type === "item.update" ? op.patch.properties?.kind === "group" || "containerId" in op.patch || "groupLayout" in op.patch || "containerId" in op || "briefHeight" in op || "size" in op : (op.type === "item.addVersion" || op.type === "item.setCurrentVersion") && "briefHeight" in op;
        if (introducesGroup) throw new OpValidationError("bad-op", "canvas groups require an explicitly enabled group canvas");
      }
      const stamp = { actor: envelope.actor, ts: envelope.ts, opId: envelope.id };
      if (isDesignRecordOperation(normalizedOp)) {
        const effect = normalizedOp.effect;
        if (effect.type === "item.add" && runtime.state.project.groupMode === "groups") {
          const { designRecord, ...plainVersion } = effect.version;
          const resolved = resolveCanvasGroupRequest(runtime.state, { ...effect, version: plainVersion }, stamp);
          if (resolved.type !== "group.change" || resolved.action.kind !== "apply") throw new OpValidationError("bad-op", "design insertion did not resolve to a canonical group effect");
          const writes = resolved.action.change.writes.map((write) => write.kind === "create" && write.item.id === effect.itemId ? { ...write, item: { ...write.item, versions: write.item.versions.map((version) => version.id === effect.version.id ? { ...version, designRecord } : version) } } : write);
          normalizedOp = { ...normalizedOp, effect: { type: "group.change", action: { kind: "apply", change: { ...resolved.action.change, writes } } } };
        }
      }
      normalizedOp = isDesignRecordOperation(normalizedOp) ? normalizedOp : normalizedOp.type === "group.change" && normalizedOp.action.kind === "migrate" ? resolveCanvasGroupMigration(runtime.state, runtime.lastSeq, normalizedOp.action, stamp) : resolveCanvasGroupRequest(runtime.state, normalizedOp, stamp);
      envelope.op = normalizedOp;
      if (op.type === "group.change" && op.action.kind === "copy" && normalizedOp.type === "group.change" && normalizedOp.action.kind === "apply") {
        const hashes = new Set(normalizedOp.action.change.writes.flatMap((write) => write.kind === "create" ? write.item.versions.flatMap((version) => [version.blobHash, ...version.visual ? [version.visual.blobHash] : []]) : []));
        for (const hash of hashes) if (!await contextBlobAvailable(this.store, canvasId, hash)) throw new OpValidationError("bad-op", `copy content is unavailable: ${hash}; prepare every source and visual blob before pasting`);
      }
    }
    const inverse = invertOperation(runtime.state, normalizedOp);
    const nextState = applyOperation(runtime.state, envelope);
    const seq = runtime.lastSeq + 1;
    const entry = {
      seq,
      envelope,
      inverse,
      ...cause !== void 0 ? { cause } : {},
      ...request.group !== void 0 ? { group: request.group } : {}
    };
    if (request.clientFeatures !== void 0) {
      requireGroupClient(request.clientFeatures, void 0, [entry]);
      requireQuestionnaireClient(request.clientFeatures, void 0, [entry]);
    }
    await this.appendOrFence(canvasId, entry);
    if (nextState === null) {
      await this.store.softDeleteCanvas(canvasId);
      this.canvases.delete(canvasId);
      this.emit(canvasId, { type: "canvas-deleted" });
      return entry;
    }
    runtime.state = nextState;
    runtime.lastSeq = seq;
    runtime.entries.push(entry);
    runtime.undo.record(entry);
    await this.store.saveSnapshot(canvasId, nextState, seq);
    this.emit(canvasId, { type: "op-applied", entry });
    return entry;
  }
  /**
   * A canvas is born, and with it the standing **link grant** (phase 7).
   *
   * "The status quo demoted to data": every canvas born today carries a link
   * grant, so "the address is the secret" stops being a regime and becomes one
   * revocable row. Written here rather than in the route because this is the
   * one place a canvas comes into existence under this daemon's own writership
   * — the CLI's `bindFresh`, the web app's new-canvas button and a
   * materialized marker all arrive through `project.create`, and a grant
   * written per caller would be a grant somebody forgot.
   *
   * **On a replica this method is not reached at all**, and that is correct:
   * the create FORWARDS (see `forwardSubmit`), so the canvas is born at the
   * home and the home writes the grant that governs it. What lands back here
   * is the home's entry, through `applyRemoteEntry`, which writes this
   * machine's own local row — a different sentence in a different ledger. See
   * `ensureHomeLinkGrant`.
   *
   * The grant is written AFTER the canvas exists, deliberately: a grant for a
   * canvas whose creation then failed would be a row admitting people to
   * nothing, and the desk has no transaction that spans both ledgers.
   */
  async createProject(request, op, personalBirth) {
    const reserved = await this.desk.personalSource(op.canvasId);
    if (reserved || await this.desk.personalReplica(op.canvasId)) {
      const joins = await this.actorJoins();
      if (!reserved || !personalBirth || reserved.birth !== "reserved" || reserved.canvasId !== personalBirth.canvasId || reserved.birthOpId !== request.opId || personalBirth.birthOpId !== reserved.birthOpId || resolveActor(joins, reserved.ownerId) !== resolveActor(joins, request.actor.id)) {
        throw new PersonalError("a personal source can only be born through its reserved private birth", "personal-birth-reserved");
      }
    }
    op = { ...op, groupMode: op.groupMode ?? "groups" };
    if (request.clientFeatures !== void 0) requireGroupClient(request.clientFeatures, { groupMode: op.groupMode });
    if (await this.store.canvasExists(op.canvasId)) {
      throw new OpValidationError("duplicate-id", `canvas id already exists: ${op.canvasId}`);
    }
    const envelope = this.envelope({ ...request, canvasId: null }, op);
    const state = applyOperation(null, envelope);
    const entry = { seq: 1, envelope, inverse: invertOperation(null, op) };
    await this.store.createCanvasDir(op.canvasId);
    await this.appendOrFence(op.canvasId, entry);
    await this.store.saveSnapshot(op.canvasId, state, 1);
    this.canvases.set(op.canvasId, {
      state,
      lastSeq: 1,
      entries: [entry],
      undo: UndoStacks.rebuild([entry])
    });
    if (!request.withoutLinkGrant) await ensureLinkGrant(this.desk, op.canvasId, request.badgeId);
    return entry;
  }
  envelope(request, op) {
    return {
      // The client's name for this op when it brought one (phase 10's
      // idempotency key): the id IS the key, so the key has to be what the
      // log remembers, or the next retry has nothing to find. Shape-checked
      // at the route; absent for everything the daemon writes for itself.
      id: request.opId ?? newOpId(),
      canvasId: request.canvasId,
      actor: request.actor,
      ...request.clientId !== void 0 ? { clientId: request.clientId } : {},
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      op
    };
  }
  /**
   * Append, and if this writer has been fenced, forget what it thought it
   * knew about that canvas.
   *
   * The refusal means exactly one thing: another instance already claimed
   * this seq, so our `lastSeq` — and everything we derived from it — is
   * stale. Dropping the runtime is the "re-syncs" half of the map's sentence
   * at CANVAS granularity: the next request re-loads from the store, sees the
   * winner's ops, and numbers its own from there. Nothing was applied (the
   * append happens BEFORE `runtime.state` is touched), so there is nothing to
   * roll back — the state we are dropping is merely behind.
   *
   * Process-level fencing — a draining instance that stops serving, or
   * exits — is deliberately NOT here. It is a rollout question, it can only
   * be observed against a real rollout, and phase 5 is where a rollout
   * exists. The lever is named so nobody has to rediscover it.
   */
  async appendOrFence(canvasId, entry) {
    try {
      await this.store.appendLog(canvasId, entry);
    } catch (err) {
      if (err instanceof OplogFencedError) {
        console.error(
          `[isocan] FENCED on ${canvasId}: another writer already holds seq ${entry.seq}. Dropping this canvas's runtime and re-syncing from the store.`
        );
        this.canvases.delete(canvasId);
      }
      throw err;
    }
  }
  /** The registry's fence. Home-scoped, so it drops the registry runtime
   * rather than a canvas's — same remedy, different cache. */
  async appendActorsOrFence(entry) {
    try {
      await this.store.appendActorsLog(entry);
    } catch (err) {
      if (err instanceof OplogFencedError) {
        console.error(
          `[isocan] FENCED on the actor registry: another writer already holds seq ${entry.seq}.`
        );
        this.actorsRuntime = null;
      }
      throw err;
    }
  }
  /**
   * A canvas's runtime, loaded from the store the first time anyone asks.
   *
   * Loads are shared while in flight, and a load that finishes after the
   * canvas's own queue has already put a runtime in place hands back THAT one
   * rather than replacing it. Both matter since the queue became per canvas:
   * a claim on the home queue reads other canvases' names (`heldNames`), and
   * a cold load of its own racing the canvas's queue must never swap the
   * runtime that queue is writing for an older copy of it.
   */
  runtime(canvasId) {
    const cached2 = this.canvases.get(canvasId);
    if (cached2) return Promise.resolve(cached2);
    let pending = this.loading.get(canvasId);
    if (!pending) {
      pending = this.loadRuntime(canvasId).finally(() => this.loading.delete(canvasId));
      this.loading.set(canvasId, pending);
    }
    return pending;
  }
  async loadRuntime(canvasId) {
    const loaded = await this.store.load(canvasId);
    if (!loaded) throw new CanvasNotFoundError(canvasId);
    const already = this.canvases.get(canvasId);
    if (already) return already;
    const runtime = {
      state: loaded.state,
      lastSeq: loaded.lastSeq,
      entries: loaded.entries,
      undo: UndoStacks.rebuild(loaded.entries)
    };
    this.canvases.set(canvasId, runtime);
    return runtime;
  }
};
function isMigrationChange(op, mode) {
  return op.type === "group.change" && op.action.kind === "apply" && op.action.change.intent === "migrate" && !!op.action.change.migration && (mode === void 0 || op.action.change.migration.mode === mode);
}
function undoOperationFor(runtime, target) {
  if (isMigrationChange(target.envelope.op)) {
    for (let i = runtime.entries.length - 1; i >= 0; i--) {
      const entry = runtime.entries[i];
      if (entry.cause?.kind === "redo" && entry.cause.targetSeq === target.seq && entry.inverse) return entry.inverse;
    }
  }
  return target.inverse;
}
function checkMigrationHistoryBoundary(runtime, targets) {
  const boundary = runtime.state.project.groupMigration;
  if (!boundary) return;
  for (const seq of targets) if (seq < boundary.seq) {
    const entry = runtime.entries.find((candidate) => candidate.seq === seq);
    if (entry && isMigrationChange(entry.envelope.op, "groups")) continue;
    throw new MigrationBoundaryError(`Undo/Redo stops at canvas conversion sequence ${boundary.seq}; earlier history remains readable and its candidate was not consumed.`);
  }
}
function checkMigrationRollback(runtime, op) {
  if (!isMigrationChange(op, "legacy")) return;
  const { state } = runtime;
  const boundary = state.project.groupMigration;
  if (!boundary) return;
  const expected = new Map(op.action.change.expected.map((entry) => [entry.itemId, entry]));
  const depends = (item) => item.properties.kind === "group" || item.containerId !== void 0 || item.groupLayout !== void 0;
  const dependencies = [];
  for (const item of Object.values(state.canvas.items)) if (depends(item) && expected.get(item.id)?.location !== "live") dependencies.push(`live ${item.id}`);
  for (const entry of state.canvas.trash) if ((depends(entry.item) || entry.legacyGroupRestore !== void 0 || entry.cohort !== void 0) && expected.get(entry.item.id)?.location !== "trash") dependencies.push(`trash ${entry.item.id}`);
  for (const thread of Object.values(state.canvas.threads)) for (const comment of thread.comments) if (comment.context) dependencies.push(`saved context ${comment.id}`);
  for (const candidate of runtime.undo.dependencyTargets()) {
    if (candidate.seq < boundary.seq) continue;
    const entry = runtime.entries.find((one) => one.seq === candidate.seq);
    if (entry && !isMigrationChange(entry.envelope.op) && (groupOperation(entry.envelope.op) || entry.inverse !== null && groupOperation(entry.inverse))) dependencies.push(`${candidate.kind} sequence ${candidate.seq}`);
  }
  if (dependencies.length) throw new MigrationBoundaryError(`Migration rollback would strand later group-dependent work: ${dependencies.join(", ")}. Resolve these dependencies explicitly; trash and history were not changed.`);
}
function redoOpFor(target, undoEntry) {
  switch (target.envelope.op.type) {
    case "item.add":
    // re-add would collide with the trashed item → restore it
    case "item.addVersion":
    // restoreVersion keeps original authorship
    case "item.edit":
    // conditional content + metadata edit restores both
    case "thread.create":
    // thread.restore keeps replies added before the undo
    case "thread.reply":
    // comment.restore keeps author + timestamp
    case "questionnaire.ask":
    case "questionnaire.answer":
    case "design.compare":
    case "design.respond":
    case "design.decide":
    case "design.restore":
    case "design.request":
    // restore the admitted version and original provenance
    case "design.receipt":
    case "design.repair":
    // restore the original version without minting a second repair
    case "group.change":
      return undoEntry.inverse;
    default:
      return target.envelope.op;
  }
}
function repairInverse(state, op) {
  switch (op.type) {
    case "group.change": {
      if (op.action.kind !== "apply") return op;
      const change = op.action.change, write = change.writes[0], expected = change.expected[0];
      if (change.intent !== "insert" || change.writes.length !== 1 || write?.kind !== "trash" || change.expected.length !== 1 || expected?.itemId !== write.itemId || expected.location !== "live" || !expected.facts || expected.facts.containerId !== null || expected.facts.groupLayout !== null || expected.facts.kind === "group" || expected.facts.annotates !== null || expected.children?.length || expected.annotations?.length) return op;
      const item = state.canvas.items[write.itemId];
      if (!item) return null;
      if (isGroupItem(item) || item.containerId !== void 0 || item.groupLayout !== void 0 || item.properties.annotates || Object.values(state.canvas.items).some((other) => other.containerId === item.id || other.properties.annotates === item.id)) return op;
      return { type: "item.delete", itemId: item.id };
    }
    case "items.move": {
      const moves = op.moves.filter((move) => state.canvas.items[move.itemId] !== void 0);
      if (moves.length === 0) return null;
      return moves.length === op.moves.length ? op : { ...op, moves };
    }
    case "items.delete": {
      const itemIds = op.itemIds.filter((id) => state.canvas.items[id] !== void 0);
      if (itemIds.length === 0) return null;
      return itemIds.length === op.itemIds.length ? op : { ...op, itemIds };
    }
    case "items.restore": {
      const inTrash = new Set(state.canvas.trash.map((t) => t.item.id));
      const itemIds = op.itemIds.filter((id) => inTrash.has(id));
      if (itemIds.length === 0) return null;
      return itemIds.length === op.itemIds.length ? op : { ...op, itemIds };
    }
    default:
      return op;
  }
}
function preflightGroupHistory(state, ops, actor, targets = [], direction = "undo") {
  if (!ops.some((op) => op.type === "group.change" || op.type === "design.restore") && !targets.some((entry) => entry.envelope.op.type === "design.repair")) return;
  let preview = state;
  for (const [index, candidate] of ops.entries()) {
    const original = targets[index]?.envelope.op;
    if (original?.type === "design.repair") {
      const repair = original.repair;
      const expected = direction === "undo" ? { ...repair.target, artifact: { ...repair.target.artifact, versionId: repair.version.id, blobHash: repair.version.blobHash } } : repair.target;
      if (!designTargetMatches(preview.canvas, expected)) throw new OpValidationError("edit-conflict", "The repair target content, metadata or scope changed; history was not changed.");
    }
    const op = repairInverse(preview, candidate);
    if (!op) continue;
    try {
      const next = applyOperation(preview, { id: "op_preflight", canvasId: state.project.id, actor, ts: (/* @__PURE__ */ new Date()).toISOString(), op });
      if (next) preview = next;
    } catch (err) {
      if (original?.type === "design.repair" || op.type === "group.change" || op.type === "design.restore" || !(err instanceof OpValidationError)) throw err;
    }
  }
}

// packages/server/src/file-store.ts
import { createReadStream, promises as fs2 } from "node:fs";
import { createHash as createHash3 } from "node:crypto";
import path3 from "node:path";

// packages/server/src/fsutil.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
async function writeFileAtomic(filePath, data, mode) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  const handle = await fs.open(tmp, "w", mode);
  try {
    if (mode !== void 0) await handle.chmod(mode);
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, filePath);
}
async function appendLineDurable(filePath, line) {
  const handle = await fs.open(filePath, "a");
  try {
    await handle.writeFile(line + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
async function readJsonLines(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  return raw.split("\n").filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
}

// packages/server/src/paths.ts
var paths_exports = {};
__export(paths_exports, {
  actorsFile: () => actorsFile,
  actorsLogFile: () => actorsLogFile,
  agentsFile: () => agentsFile,
  badgesFile: () => badgesFile,
  badgesLogFile: () => badgesLogFile,
  blobsDir: () => blobsDir,
  blobsIndexFile: () => blobsIndexFile,
  buildDir: () => buildDir,
  buildRoot: () => buildRoot,
  buildsDir: () => buildsDir,
  canvasDir: () => canvasDir,
  canvasFile: () => canvasFile,
  canvasMetaFile: () => canvasMetaFile,
  canvasesDir: () => canvasesDir,
  cliSessionFile: () => cliSessionFile,
  commandFile: () => commandFile,
  commandsDir: () => commandsDir,
  configFile: () => configFile,
  currentLink: () => currentLink,
  daemonFile: () => daemonFile,
  daemonLogFile: () => daemonLogFile,
  deletedCanvasesDir: () => deletedCanvasesDir,
  deskDir: () => deskDir,
  dirsFile: () => dirsFile,
  homesFile: () => homesFile,
  identityFile: () => identityFile,
  isocanHome: () => isocanHome,
  legacySessionFile: () => legacySessionFile,
  linkGrantsMigratedFile: () => linkGrantsMigratedFile,
  oplogArchiveFile: () => oplogArchiveFile,
  oplogFile: () => oplogFile,
  preBadgeActorsFile: () => preBadgeActorsFile,
  purgedFile: () => purgedFile,
  stagingBuildDir: () => stagingBuildDir,
  takedownFile: () => takedownFile,
  trashFile: () => trashFile
});
import os from "node:os";
import path2 from "node:path";
function isocanHome() {
  return process.env.ISOCAN_HOME ?? path2.join(os.homedir(), ".isocan");
}
var canvasesDir = (home) => path2.join(home, "projects");
var deletedCanvasesDir = (home) => path2.join(home, "deleted-projects");
var canvasDir = (home, id) => path2.join(canvasesDir(home), id);
var canvasMetaFile = (home, id) => path2.join(canvasDir(home, id), "project.json");
var canvasFile = (home, id) => path2.join(canvasDir(home, id), "canvas.json");
var trashFile = (home, id) => path2.join(canvasDir(home, id), "trash.json");
var takedownFile = (home, id) => path2.join(canvasDir(home, id), "takendown.json");
var purgedFile = (home, id) => path2.join(canvasDir(home, id), "purged.json");
var oplogFile = (home, id) => path2.join(canvasDir(home, id), "oplog.jsonl");
var oplogArchiveFile = (home, id) => path2.join(canvasDir(home, id), "oplog-archive.jsonl");
var blobsDir = (home, id) => path2.join(canvasDir(home, id), "blobs");
var blobsIndexFile = (home, id) => path2.join(canvasDir(home, id), "blobs.json");
var daemonFile = (home) => path2.join(home, "daemon.json");
var daemonLogFile = (home) => path2.join(home, "daemon.log");
var identityFile = (home) => path2.join(home, "identity.json");
var actorsFile = (home) => path2.join(home, "actors.json");
var actorsLogFile = (home) => path2.join(home, "actors.jsonl");
var preBadgeActorsFile = (home) => path2.join(home, "actors.json.pre-badge");
var deskDir = (home) => path2.join(home, "desk");
var badgesFile = (home) => path2.join(deskDir(home), "badges.json");
var badgesLogFile = (home) => path2.join(deskDir(home), "badges.jsonl");
var linkGrantsMigratedFile = (home) => path2.join(deskDir(home), "link-grants.migrated");
var agentsFile = (home) => path2.join(home, "agents.json");
var legacySessionFile = (home) => path2.join(home, "session.json");
var cliSessionFile = (home, actorId) => path2.join(home, "sessions", `${actorId}.json`);
var configFile = (home) => path2.join(home, "config.json");
var buildsDir = (home) => path2.join(home, "builds");
var buildDir = (home, sha2) => path2.join(buildsDir(home), sha2);
var stagingBuildDir = (home) => path2.join(buildsDir(home), ".staging");
var currentLink = (home) => path2.join(home, "current");
var buildRoot = (dir) => path2.join(dir, "node_modules", "isocan");
var commandsDir = (home) => path2.join(home, "commands");
var commandFile = (home, name) => path2.join(commandsDir(home), `${name}.md`);
var dirsFile = (home) => path2.join(home, "dirs.json");
var homesFile = (home) => path2.join(home, "homes.json");

// packages/server/src/file-store.ts
var FileStore = class {
  constructor(home) {
    this.home = home;
  }
  home;
  async init() {
    await fs2.mkdir(canvasesDir(this.home), { recursive: true });
    await fs2.mkdir(deletedCanvasesDir(this.home), { recursive: true });
  }
  /** Nothing is held open: every write here closes its own handle. The method
   * exists for the backing that does hold something open. */
  async close() {
  }
  async listCanvases() {
    let ids;
    try {
      ids = await fs2.readdir(canvasesDir(this.home));
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
    const canvases = [];
    for (const id of ids) {
      const canvas = await readJson(canvasMetaFile(this.home, id));
      if (canvas) canvases.push(canvas);
    }
    return sortCanvases(canvases, "recent");
  }
  async canvasRecord(id) {
    if (await this.takenDownAt(id) || await this.purgedAt(id)) return null;
    return readJson(canvasMetaFile(this.home, id));
  }
  async canvasLifecycle(id) {
    if (await this.purgedAt(id)) return "purged";
    if (await this.takenDownAt(id)) return "taken-down";
    if (await this.canvasExists(id)) return "live";
    const deleted = await fs2.readdir(deletedCanvasesDir(this.home)).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const name of deleted.filter((name2) => name2.startsWith(`${id}-`))) {
      const record = await readJson(path3.join(deletedCanvasesDir(this.home), name, "project.json"));
      if (record?.id === id) return "deleted";
    }
    return fs2.stat(canvasDir(this.home, id)).then(() => "incomplete", (error) => {
      if (error.code === "ENOENT") return "absent";
      throw error;
    });
  }
  async readBirthLog(id) {
    return readJsonLines(oplogFile(this.home, id));
  }
  async createCanvasDir(id) {
    await fs2.mkdir(blobsDir(this.home, id), { recursive: true });
  }
  async canvasExists(id) {
    return await readJson(canvasMetaFile(this.home, id)) !== null;
  }
  async takenDownAt(id) {
    return (await readJson(takedownFile(this.home, id)))?.at ?? null;
  }
  async setTakenDown(id, at) {
    if (at === null) {
      await fs2.rm(takedownFile(this.home, id), { force: true });
      return;
    }
    await writeFileAtomic(takedownFile(this.home, id), pretty({ at }));
  }
  async purgedAt(id) {
    return (await readJson(purgedFile(this.home, id)))?.at ?? null;
  }
  /**
   * **Everything in the directory but the tombstone and the two marks.**
   *
   * A purge on this backing is the prefix delete a bucket does, spelled for a
   * directory: every entry under `projects/<id>/` goes except `project.json`
   * (the canvas record — the tombstone that keeps `canvasExists` true and the
   * id taken), `takendown.json` (the flag that got us here) and `purged.json`
   * (written first, so a crash mid-way leaves a directory that `load` already
   * refuses rather than a half-erased canvas it would serve). Enumerated
   * rather than named file by file, because a file added to the layout next
   * year must be erased by a purge without somebody remembering this method.
   *
   * **Not `deleted-projects/`.** An owner's delete moves the directory aside,
   * recoverable by hand; this is the act whose whole point is that nothing
   * under the id is recoverable from this home. It counts what it removes on
   * the way, because the counts are the reply to the reporter.
   */
  async purgeCanvas(id) {
    if (await this.takenDownAt(id) === null) {
      throw new Error(`${id} is not taken down; a purge is refused on a canvas this home still serves`);
    }
    const already = await this.purgedAt(id);
    if (already !== null) return { files: 0, bytes: 0, ops: 0, objects: 0, keeps: [] };
    const index = await this.readIndex(id);
    const files = Object.keys(index).length;
    const bytes = Object.values(index).reduce((total, meta) => total + meta.size, 0);
    const ops = (await readJsonLines(oplogFile(this.home, id))).length + (await readJsonLines(oplogArchiveFile(this.home, id))).length;
    await writeFileAtomic(purgedFile(this.home, id), pretty({ at: (/* @__PURE__ */ new Date()).toISOString() }));
    const keep = new Set(
      [canvasMetaFile, takedownFile, purgedFile].map((file) => path3.basename(file(this.home, id)))
    );
    let objects = 0;
    for (const entry of await fs2.readdir(canvasDir(this.home, id), { withFileTypes: true })) {
      if (keep.has(entry.name)) continue;
      const target = path3.join(canvasDir(this.home, id), entry.name);
      if (entry.isDirectory()) {
        objects += (await fs2.readdir(target)).length;
      } else {
        objects += 1;
      }
      await fs2.rm(target, { recursive: true, force: true });
    }
    return { files, bytes, ops, objects, keeps: [] };
  }
  async load(id) {
    if (await this.takenDownAt(id) !== null) return null;
    if (await this.purgedAt(id) !== null) return null;
    const record = await readJson(canvasMetaFile(this.home, id));
    if (!record) return null;
    const snapshot = await readJson(canvasFile(this.home, id));
    const trash = await readJson(trashFile(this.home, id)) ?? [];
    const entries = await readJsonLines(oplogFile(this.home, id));
    let state = {
      project: record,
      canvas: snapshot ? { items: snapshot.items, threads: snapshot.threads, trash, agents: snapshot.agents ?? {}, ...snapshot.groupCohorts ? { groupCohorts: snapshot.groupCohorts } : {} } : { ...emptyCanvas(), trash }
    };
    let lastSeq = snapshot?.lastSeq ?? 0;
    const recoveredSeqs = [];
    for (const entry of entries) {
      if (entry.seq <= lastSeq) continue;
      if (entry.envelope.op.type === "project.create") continue;
      const next = applyOperation(state, entry.envelope);
      if (next === null) return null;
      state = next;
      lastSeq = entry.seq;
      recoveredSeqs.push(entry.seq);
    }
    if (recoveredSeqs.length > 0) {
      await this.saveSnapshot(id, state, lastSeq);
    }
    return { state, lastSeq, entries, recoveredSeqs };
  }
  /**
   * **Canvases whose metadata predates the stamp, repaired once.**
   *
   * `updatedAt`/`updatedBy` used to move only on a rename, and `lastOp` did
   * not exist. So every canvas made before this reports the day it was last
   * retitled and has nothing to say about what happened — which would make a
   * home screen sorted by "recent activity" order the list by something nobody
   * was thinking about, and quietly, which is the worst way to be wrong.
   *
   * Fixing it needs the log's last entry, and reading a log per canvas is
   * exactly the cost the `lastOp` field exists to avoid on the request path.
   * So it happens ONCE: only for canvases that are missing the field, off the
   * request path, and never again for one it has repaired. A home that has
   * been through it does no reads at all.
   *
   * Returns how many it fixed, so the caller can say so rather than doing
   * unexplained work at boot.
   */
  async backfillLastOp(keepGoing = () => true) {
    let fixed = 0;
    for (const canvas of await this.listCanvases()) {
      if (!keepGoing()) break;
      if (canvas.lastOp !== void 0) continue;
      const entries = await readJsonLines(oplogFile(this.home, canvas.id));
      const last = entries[entries.length - 1];
      if (!last) continue;
      await this.saveCanvas({
        ...canvas,
        updatedAt: last.envelope.ts,
        updatedBy: last.envelope.actor,
        lastOp: activityOpType(last.envelope.op)
      });
      fixed += 1;
    }
    return fixed;
  }
  async saveCanvas(canvas) {
    await writeFileAtomic(canvasMetaFile(this.home, canvas.id), pretty(canvas));
  }
  async saveSnapshot(id, state, lastSeq) {
    const snapshot = {
      ...state.canvas.groupCohorts ? { groupCohorts: state.canvas.groupCohorts } : {},
      lastSeq,
      items: state.canvas.items,
      threads: state.canvas.threads,
      agents: state.canvas.agents ?? {}
    };
    await writeFileAtomic(canvasFile(this.home, id), pretty(snapshot));
    await writeFileAtomic(trashFile(this.home, id), pretty(state.canvas.trash));
    await this.saveCanvas(state.project);
  }
  /** The oplog's last line, or the snapshot's seq when the log has been
   * compacted past it — whichever is further along. The file is read whole;
   * a local oplog is small and this runs once per open room per 25 s. */
  async tipSeq(id) {
    if (!await this.canvasExists(id)) return null;
    const snapshot = await readJson(canvasFile(this.home, id));
    const entries = await readJsonLines(oplogFile(this.home, id));
    const last = entries.length > 0 ? entries[entries.length - 1].seq : 0;
    return Math.max(last, snapshot?.lastSeq ?? 0);
  }
  async appendLog(id, entry) {
    await appendLineDurable(oplogFile(this.home, id), JSON.stringify(entry));
  }
  /** project.delete is soft: the directory is moved aside, recoverable by hand. */
  async softDeleteCanvas(id) {
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    await fs2.rename(
      canvasDir(this.home, id),
      path3.join(deletedCanvasesDir(this.home), `${id}-${stamp}`)
    );
  }
  // ---- the actor registry (home-scoped; see core/claims.ts) ----
  /**
   * Load the registry: snapshot plus any oplog tail the snapshot doesn't
   * cover. Replay is trivial — the envelope carries the RESOLVED actor, so a
   * logged claim re-applies without re-validation — which is what makes the
   * jsonl the source of truth and actors.json derived, same as a canvas.
   */
  /**
   * The slash commands this home has written. Read from disk every time
   * rather than cached: these are files a person edits in a text editor, and
   * an editor save should show up in the next menu they open, not the next
   * time they restart the daemon.
   *
   * A file that does not parse is skipped, not fatal. One malformed command
   * must not take the menu down with it.
   */
  async loadCommands() {
    let names;
    try {
      names = await fs2.readdir(commandsDir(this.home));
    } catch {
      return [];
    }
    const commands = [];
    for (const file of names.sort()) {
      if (!file.endsWith(".md")) continue;
      const name = file.slice(0, -3);
      if (!COMMAND_NAME.test(name)) continue;
      try {
        const parsed = parseCommandFile(name, await fs2.readFile(commandFile(this.home, name), "utf8"));
        if (parsed) commands.push(parsed);
      } catch {
      }
    }
    return commands;
  }
  /** Write one, atomically — the menu reads this directory unsynchronised. */
  async saveCommand(name, text) {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    await fs2.mkdir(commandsDir(this.home), { recursive: true });
    await writeFileAtomic(commandFile(this.home, name), text);
  }
  /** Remove one. Removing a shadow gives the built-in back, which is why this
   * says whether a file was actually there. */
  async deleteCommand(name) {
    if (!COMMAND_NAME.test(name)) throw new Error(`not a command name: ${name}`);
    try {
      await fs2.unlink(commandFile(this.home, name));
      return true;
    } catch {
      return false;
    }
  }
  async loadActors() {
    const snapshot = await readJson(
      actorsFile(this.home)
    );
    const { lastSeq: _seq, ...saved } = snapshot ?? {};
    let registry = {
      ...emptyActorRegistry(),
      ...saved,
      names: saved.names ?? {},
      colors: saved.colors ?? {}
    };
    let lastSeq = snapshot?.names === void 0 ? 0 : snapshot?.lastSeq ?? 0;
    const entries = await readJsonLines(actorsLogFile(this.home));
    let recovered = false;
    const backfill = snapshot !== null && snapshot !== void 0 && saved.harnesses === void 0;
    const relayRows = new Set(Object.entries(saved.harnesses ?? {}).filter(([, harness]) => harness.toLowerCase() === "replica").map(([id]) => id));
    const actualHarnesses = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const op = entry.envelope.op;
      if (op.type === "actor.claim" && relayRows.has(entry.envelope.actor.id)) {
        const harness = harnessOf(op.sessionKey);
        if (harness && harness.toLowerCase() !== "replica") actualHarnesses.set(entry.envelope.actor.id, harness);
      }
      if (entry.seq <= lastSeq) {
        if (backfill && op.type === "actor.claim") {
          registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts, sessionKey: op.sessionKey });
          recovered = true;
        }
        continue;
      }
      if (op.type === "actor.claim") {
        registry = bindName(registry, { actor: entry.envelope.actor, ts: entry.envelope.ts, sessionKey: op.sessionKey });
      } else if (op.type === "actor.setColor") {
        registry = applyActorColor(registry, op);
      } else if (op.type === "actor.setMark") {
        registry = applyActorMark(registry, op);
      } else if (op.type === "actor.join") {
        registry = applyActorJoin(registry, op);
      } else {
        continue;
      }
      lastSeq = entry.seq;
      recovered = true;
    }
    if (relayRows.size) {
      const harnesses = { ...registry.harnesses };
      for (const id of relayRows) {
        const actual = actualHarnesses.get(id);
        if (actual) harnesses[id] = actual;
        else delete harnesses[id];
      }
      registry = { ...registry, harnesses };
      recovered = true;
    }
    if (recovered) await this.saveActors(registry, lastSeq);
    return { registry, lastSeq };
  }
  /**
   * **The whole registry, not a list of its fields.**
   *
   * This named `names` and `colors` and therefore dropped `marks` on every
   * write: the op applied, `/api/marks` served it while the process lived,
   * and the file it was saved to never had it. So a chosen emoji survived
   * until the daemon restarted, reached no other machine, and no teammate
   * ever saw it — reported exactly that way.
   *
   * Spread rather than enumerated, so this is the LAST field it can happen
   * to. A writer that lists what it saves is a writer that silently stops
   * saving whatever is added next, and this is the third time that shape has
   * cost something here (`toGrant` dropped `capability` the same way).
   * `actors.test.ts` holds the guard that fails when a field stops round
   * tripping.
   */
  async saveActors(registry, lastSeq) {
    await writeFileAtomic(actorsFile(this.home), pretty({ lastSeq, ...registry }));
  }
  async appendActorsLog(entry) {
    await appendLineDurable(actorsLogFile(this.home), JSON.stringify(entry));
  }
  // ---- blobs ----
  /**
   * Store bytes and name them in the index. Read-modify-write over the whole
   * of `blobs.json`, so like every other writer here it must be called from
   * the engine's single-writer chain — `Engine.putBlob`, never directly.
   */
  async putBlob(id, data, meta) {
    const blobHash = createHash3("sha256").update(data).digest("hex");
    const index = await this.readIndex(id);
    const existing = index[blobHash];
    if (existing) {
      return { blobHash, size: existing.size, mimeType: existing.mimeType };
    }
    const ext = extensionFor(meta.filename, meta.mimeType);
    const file = ext ? `${blobHash}.${ext}` : blobHash;
    await writeFileAtomic(path3.join(blobsDir(this.home, id), file), data);
    index[blobHash] = { file, mimeType: meta.mimeType, filename: meta.filename, size: data.length };
    await writeFileAtomic(blobsIndexFile(this.home, id), pretty(index));
    return { blobHash, size: data.length, mimeType: meta.mimeType };
  }
  async blobMeta(id, blobHash) {
    return (await this.readIndex(id))[blobHash] ?? null;
  }
  async heldBlobs(id, blobHashes) {
    const index = await this.readIndex(id);
    return new Set(blobHashes.filter((hash) => Object.hasOwn(index, hash)));
  }
  async openBlob(id, blobHash, range) {
    const meta = await this.blobMeta(id, blobHash);
    if (!meta) return null;
    const file = path3.join(blobsDir(this.home, id), meta.file);
    return range ? createReadStream(file, { start: range.start, end: range.end }) : createReadStream(file);
  }
  /**
   * No ticket: on a disk the daemon IS the place the bytes go, at any size.
   * Null rather than a throw because the answer is "there is nothing to hand
   * you", not "you asked wrongly" — the client branches on it and posts.
   */
  async beginUpload(_id, _request) {
    return null;
  }
  /** Unreachable in practice — a client only registers after `beginUpload`
   * gave it somewhere to upload to, and this backing never does. It refuses
   * in the vocabulary the route already speaks rather than throwing something
   * that would reach a person as a 500. */
  async registerBlob(_id, _request) {
    throw new OpValidationError("bad-op", "this home takes blob bytes directly; there is nothing to register");
  }
  // ---- garbage collection (the policy lives in Engine.gc) ----
  /** The index, plus an mtime per row. Two calls per blob, exactly as before
   * — what moved is which side of the seam they happen on. */
  async listBlobs(id) {
    const index = await this.readIndex(id);
    const listing = [];
    for (const [hash, meta] of Object.entries(index)) {
      listing.push({ hash, meta, ageMs: await this.ageMs(id, meta) });
    }
    return listing;
  }
  /** Unlink the bytes, then rewrite the index ONCE — the same file semantics
   * as before, including one index rewrite per GC pass. */
  async deleteBlobs(id, hashes) {
    if (hashes.length === 0) return;
    const index = await this.readIndex(id);
    for (const hash of hashes) {
      const meta = index[hash];
      if (!meta) continue;
      await fs2.rm(path3.join(blobsDir(this.home, id), meta.file), { force: true });
      delete index[hash];
    }
    await writeFileAtomic(blobsIndexFile(this.home, id), pretty(index));
  }
  /**
   * Archive first, then replace the live log atomically. Crash-safe in that
   * order: a crash between the two leaves extra history, which is harmless
   * and re-collectable. On a disk a compacted entry really does leave the
   * live log — one process owns this directory, so no reader can be surprised
   * by a seq becoming free again.
   */
  async compactOplog(id, retained, dropped) {
    if (dropped.length > 0) {
      const lines = dropped.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
      await fs2.appendFile(oplogArchiveFile(this.home, id), lines);
    }
    const body = retained.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFileAtomic(oplogFile(this.home, id), body.length > 0 ? body + "\n" : "");
  }
  /** The archive is appended in compaction order and compaction always drops
   * the oldest entries, so the file is already oldest-first. */
  async readArchivedLog(id) {
    return readJsonLines(oplogArchiveFile(this.home, id));
  }
  // ---- internals ----
  async readIndex(id) {
    return await readJson(blobsIndexFile(this.home, id)) ?? {};
  }
  /** Age of a blob file in ms, or null if it is already gone. */
  async ageMs(id, meta) {
    try {
      const stat = await fs2.stat(path3.join(blobsDir(this.home, id), meta.file));
      return Date.now() - stat.mtimeMs;
    } catch {
      return null;
    }
  }
};
function pretty(value) {
  return JSON.stringify(value, null, 2);
}

// packages/server/src/personal-desk.ts
function selectPersonalBinding(ownerIds, owners, sources) {
  const ordered = [.../* @__PURE__ */ new Set([ownerIds[0], ...ownerIds.slice(1).sort()])];
  const found = ordered.flatMap((id) => {
    const pointer = owners.find((owner) => owner.ownerId === id);
    if (!pointer) return [];
    const source = sources.find((row) => row.canvasId === pointer.sourceCanvasId);
    if (!source) throw new Error("personal binding is unavailable");
    return [source];
  });
  const unique = found.filter((row, index) => found.findIndex((other) => other.canvasId === row.canvasId) === index);
  return unique.length ? { source: unique[0], preserved: unique.slice(1) } : null;
}
function assertPersonalIntent(previous, next) {
  for (const key of ["ownerId", "sourceCanvasId", "destinationCanvasId", "requestId"]) {
    if (previous[key] !== next[key]) throw new Error("personal link requestId was reused");
  }
}

// packages/server/src/file-desk.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import { promises as fs3 } from "node:fs";
var TOUCH_DEBOUNCE_MS = 6e4;
var FileDesk = class {
  constructor(home) {
    this.home = home;
  }
  home;
  state = { lastSeq: 0, badges: {}, shelf: {}, grants: {}, passes: {}, spaces: {}, groups: {}, operator: {}, takedowns: {}, refusals: {} };
  chain = Promise.resolve();
  async init() {
    await fs3.mkdir(deskDir(this.home), { recursive: true });
    const snapshot = await readJson(badgesFile(this.home));
    this.state = {
      lastSeq: snapshot?.lastSeq ?? 0,
      personalSources: snapshot?.personalSources ?? {},
      personalReplicas: snapshot?.personalReplicas ?? {},
      personalOwners: snapshot?.personalOwners ?? {},
      personalIntents: snapshot?.personalIntents ?? {},
      personalDelegates: snapshot?.personalDelegates ?? {},
      badges: snapshot?.badges ?? {},
      shelf: snapshot?.shelf ?? {},
      // Absent in every desk written before phase 7 — and correctly EMPTY
      // rather than "everything is granted": the one-time migration in
      // `migrations.ts` writes the rows, so that a canvas whose grant was
      // never written answers nothing here instead of answering helpfully.
      grants: snapshot?.grants ?? {},
      // Absent in every desk written before phase 8, and empty is the only
      // safe reading: a pass nobody can find is a pass nobody can redeem,
      // which is what an unknown row must always mean here.
      passes: snapshot?.passes ?? {},
      // Absent in every desk written before roles phase 4; empty means every
      // canvas is in no space, which is the truth about all of them.
      spaces: snapshot?.spaces ?? {},
      // Absent before roles phase 5; empty means no group exists, so a
      // `group:` row admits nobody, which is the only safe reading.
      groups: snapshot?.groups ?? {},
      // Absent in every desk written before seen-marks; empty means nobody
      // has looked at anything, which is what an inbox should say about a
      // person this home has never seen read a canvas.
      seen: snapshot?.seen ?? {},
      // Absent on every desk written before the operator; empty means no
      // operator act has ever been taken here, which is the truth about a
      // home that has none.
      operator: snapshot?.operator ?? {},
      // Absent on every desk written before takedowns; empty means this home
      // has taken nothing down, which is the truth about all of them.
      takedowns: snapshot?.takedowns ?? {},
      // Absent on every desk written before refusals; empty means this home
      // refuses nobody, which is the truth about all of them.
      refusals: snapshot?.refusals ?? {},
      // Absent until a hosted home first signs a content read. Undefined
      // means "none minted", never "sign with nothing".
      ...snapshot?.contentKey ? { contentKey: snapshot.contentKey } : {}
    };
    let recovered = false;
    for (const entry of await readJsonLines(badgesLogFile(this.home))) {
      if (entry.seq <= this.state.lastSeq) continue;
      this.replay(entry);
      this.state.lastSeq = entry.seq;
      recovered = true;
    }
    if (recovered) await this.writeSnapshot();
  }
  /** Drain the write chain so a shutdown cannot land between a log append and
   * its snapshot; nothing is held open beyond that. */
  async close() {
    await this.chain;
  }
  async personalReplica(canvasId) {
    return this.state.personalReplicas?.[canvasId] ?? null;
  }
  async recordPersonalReplica(canvasId, home) {
    await this.enqueue(async () => {
      const existing = await this.personalReplica(canvasId);
      if (existing === home) return;
      if (existing) throw new Error("personal replica authority changed");
      await this.commitPersonal({ replicas: [{ canvasId, home }] }, (/* @__PURE__ */ new Date()).toISOString());
    });
  }
  async personalSource(canvasId) {
    return structuredClone(this.state.personalSources?.[canvasId] ?? null);
  }
  async personalBinding(ownerIds) {
    return structuredClone(selectPersonalBinding(ownerIds, Object.values(this.state.personalOwners ?? {}), Object.values(this.state.personalSources ?? {})));
  }
  async reservePersonal(request) {
    return this.enqueue(async () => {
      const existing = await this.personalBinding([request.ownerId, ...request.aliases]);
      if (existing) {
        if (!this.state.personalOwners?.[request.ownerId]) await this.commitPersonal({ owners: [{ ownerId: request.ownerId, sourceCanvasId: existing.source.canvasId, enrolledAt: request.at }] }, request.at);
        return existing;
      }
      if (this.state.personalSources?.[request.canvasId]) throw new Error("personal source id is already reserved");
      const source = { canvasId: request.canvasId, ownerId: request.ownerId, birthOpId: request.birthOpId, createdAt: request.at, birth: "reserved" };
      await this.commitPersonal({ sources: [source], owners: [{ ownerId: request.ownerId, sourceCanvasId: request.canvasId, enrolledAt: request.at }] }, request.at);
      return { source, preserved: [] };
    });
  }
  async finishPersonalBirth(canvasId, birthOpId) {
    await this.enqueue(async () => {
      const source = await this.personalSource(canvasId);
      if (!source || source.birthOpId !== birthOpId) throw new Error("personal birth reservation does not match");
      if (source.birth === "created") return;
      await this.commitPersonal({ sources: [{ ...source, birth: "created" }] }, source.createdAt);
    });
  }
  async reservePersonalLink(intent2) {
    return this.enqueue(async () => {
      const key = JSON.stringify([intent2.destinationCanvasId, intent2.ownerId, intent2.requestId]);
      const existing = this.state.personalIntents?.[key];
      if (existing) {
        assertPersonalIntent(existing, intent2);
        return structuredClone(existing);
      }
      if (!this.state.personalSources?.[intent2.sourceCanvasId]) throw new Error("personal source is not reserved");
      if (Object.values(this.state.personalIntents ?? {}).some((row) => row.destinationCanvasId === intent2.destinationCanvasId && row.itemId === intent2.itemId)) throw new Error("personal card id is already reserved");
      await this.commitPersonal({ intents: [intent2] }, intent2.createdAt);
      return structuredClone(intent2);
    });
  }
  async personalLinksFor(destinationCanvasId) {
    return structuredClone(Object.values(this.state.personalIntents ?? {}).filter((row) => row.destinationCanvasId === destinationCanvasId));
  }
  async personalLinkForItem(destinationCanvasId, itemId) {
    return (await this.personalLinksFor(destinationCanvasId)).find((row) => row.itemId === itemId) ?? null;
  }
  async personalDelegations(sourceCanvasId) {
    return structuredClone(Object.values(this.state.personalDelegates?.[sourceCanvasId] ?? {}));
  }
  async setPersonalDelegation(sourceCanvasId, delegation) {
    return this.enqueue(async () => {
      if (!this.state.personalSources?.[sourceCanvasId]) throw new Error("personal source is not reserved");
      await this.commitPersonal({ delegates: [{ sourceCanvasId, delegation }] }, delegation.at);
      return structuredClone(delegation);
    });
  }
  async commitPersonal(rows, at) {
    const entry = { seq: this.state.lastSeq + 1, type: "personal", rows, at };
    await appendLineDurable(badgesLogFile(this.home), JSON.stringify(entry));
    this.replay(entry);
    this.state.lastSeq = entry.seq;
    await this.writeSnapshot();
  }
  async put(badge) {
    await this.enqueue(async () => {
      this.state.badges[badge.badgeId] = { ...badge };
      await this.append({
        type: "badge",
        badgeId: badge.badgeId,
        secretHash: badge.secretHash,
        kind: badge.kind,
        at: badge.createdAt
      });
    });
  }
  /** A killed badge answers null, exactly like one this home never minted —
   * the desk seam's contract, and what turns a kill into `bad-badge` at the
   * next request the holder makes. */
  async badge(badgeId) {
    const found = this.live(badgeId);
    return found ? { ...found } : null;
  }
  async touch(badgeId, at) {
    const badge = this.live(badgeId);
    if (!badge) return;
    const drift = Date.parse(at) - Date.parse(badge.lastSeen);
    badge.lastSeen = at;
    if (!(drift >= TOUCH_DEBOUNCE_MS)) return;
    await this.enqueue(() => this.writeSnapshot());
  }
  async setClaims(badgeId, claims) {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge) return;
      badge.claims = claims;
      await this.append({ type: "claims", badgeId, claims, at: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  async claimsOf(badgeId) {
    return [...this.live(badgeId)?.claims ?? []];
  }
  async claimants(actorId) {
    const rows = [];
    for (const [badgeId, badge] of Object.entries(this.state.badges)) {
      if (badge.killedAt !== void 0) continue;
      for (const row of badge.claims) if (row.actorId === actorId) rows.push({ badgeId, claim: row });
    }
    for (const row of Object.values(this.state.shelf)) {
      if (row.actorId === actorId) rows.push({ badgeId: SHELF, claim: row });
    }
    return rows;
  }
  async holdersOf(sessionKey) {
    const held = [];
    for (const [badgeId, badge] of Object.entries(this.state.badges)) {
      if (badge.killedAt !== void 0) continue;
      for (const row of badge.claims) {
        if (row.sessionKey === sessionKey) held.push({ badgeId, claim: row });
      }
    }
    const shelved = this.state.shelf[sessionKey];
    if (shelved) held.push({ badgeId: SHELF, claim: shelved });
    return held;
  }
  async claimsIn(canvasIds) {
    const wanted = new Set(canvasIds);
    const rows = [...Object.values(this.state.shelf)];
    if (wanted.size > 0) {
      for (const badge of Object.values(this.state.badges)) {
        if (badge.killedAt !== void 0) continue;
        if (!badge.admissions.some((a) => wanted.has(a.canvasId))) continue;
        rows.push(...badge.claims);
      }
    }
    return rows;
  }
  async admit(badgeId, canvasId, provenance, capability) {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge) return;
      const existing = badge.admissions.find((a) => a.canvasId === canvasId);
      if (keepsAdmission(existing, provenance, capability)) return;
      const admission = {
        canvasId,
        provenance,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        // Stored whenever it is not edit (`narrowed`, the one place that
        // decides): absent has meant "edit" since before the field existed, and
        // both backings keep that reading.
        ...narrowed(capability) ? { capability } : {}
      };
      badge.admissions = [
        ...badge.admissions.filter((a) => a.canvasId !== canvasId),
        admission
      ];
      await this.writeSnapshot();
    });
  }
  // ---- the sweep, and kill-a-badge ----
  async badgesIn(canvasId) {
    return Object.values(this.state.badges).filter((badge) => badge.killedAt === void 0).filter((badge) => badge.admissions.some((a) => a.canvasId === canvasId)).map((badge) => ({ ...badge }));
  }
  async reroot(badgeId, canvasId, provenance, capability) {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      const admission = badge?.admissions.find((a) => a.canvasId === canvasId);
      if (!badge || !admission) return;
      badge.admissions = badge.admissions.map(
        (a) => a.canvasId === canvasId ? (
          // Rebuilt rather than spread, so a stale `capability` from the old
          // root cannot survive an upgrade — the new reason says what it
          // admits to, entirely.
          {
            canvasId: a.canvasId,
            at: a.at,
            provenance,
            ...narrowed(capability) ? { capability } : {}
          }
        ) : a
      );
      await this.writeSnapshot();
    });
  }
  async expel(badgeId, canvasId) {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge || !badge.admissions.some((a) => a.canvasId === canvasId)) return;
      badge.admissions = badge.admissions.filter((a) => a.canvasId !== canvasId);
      await this.writeSnapshot();
    });
  }
  async killBadge(badgeId, at, by, end) {
    return this.enqueue(async () => {
      const badge = this.state.badges[badgeId];
      if (!badge || badge.killedAt !== void 0) return null;
      const wasAlive = { ...badge };
      badge.killedAt = at;
      badge.killedBy = by;
      if (end) badge.end = end;
      await this.append({ type: "kill", badgeId, by, at, ...end ? { end } : {} });
      return wasAlive;
    });
  }
  async endedBadge(badgeId) {
    const badge = this.state.badges[badgeId];
    if (!badge || badge.killedAt === void 0) return null;
    return { ...badge };
  }
  async attest(badgeId, attestation) {
    await this.enqueue(async () => {
      const badge = this.live(badgeId);
      if (!badge) return;
      badge.attestations = upsertAttestation(badge.attestations, attestation);
      await this.append({ type: "attest", badgeId, attestation, at: attestation.at });
    });
  }
  async badgesAttesting(attribute) {
    return Object.values(this.state.badges).filter((badge) => badge.killedAt === void 0).filter((badge) => (badge.attestations ?? []).some((row) => row.attribute === attribute)).map((badge) => ({ ...badge }));
  }
  // ---- grants ----
  async grantsFor(canvasId) {
    return Object.values(this.state.grants).filter((grant) => !isSpaceGrant(grant) && grant.canvasId === canvasId).map((grant) => structuredClone(grant));
  }
  async grantsForSpace(spaceId) {
    return Object.values(this.state.grants).filter((grant) => isSpaceGrant(grant) && grant.spaceId === spaceId).map((grant) => structuredClone(grant));
  }
  // ---- spaces (roles phase 4) ----
  async putSpace(space) {
    await this.enqueue(async () => {
      this.spaces()[space.id] = { ...space, canvasIds: [...space.canvasIds] };
      await this.append({ type: "space", space, at: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  async space(spaceId) {
    const found = this.spaces()[spaceId];
    return found ? { ...found, canvasIds: [...found.canvasIds] } : null;
  }
  async spaceOf(canvasId) {
    const found = Object.values(this.spaces()).find(
      (space) => isSpaceLive(space) && space.canvasIds.includes(canvasId)
    );
    return found ? { ...found, canvasIds: [...found.canvasIds] } : null;
  }
  async spacesFor(badge) {
    const seen = /* @__PURE__ */ new Map();
    const keep = (space) => {
      if (space && isSpaceLive(space) && !seen.has(space.id)) {
        seen.set(space.id, { ...space, canvasIds: [...space.canvasIds] });
      }
    };
    const spaces = this.spaces();
    const actorIds = new Set(badge.claims.map((claim) => claim.actorId));
    for (const space of Object.values(spaces)) {
      if (actorIds.has(space.createdBy)) keep(space);
    }
    const attributes = new Set((badge.attestations ?? []).map((row) => row.attribute));
    for (const grant of Object.values(this.state.grants)) {
      if (!isLive(grant) || !attributes.has(grant.subject)) continue;
      const scope = scopeOf(grant);
      if (scope.kind === "space") keep(spaces[scope.id]);
    }
    const inGroups = new Set(
      Object.values(this.groups()).filter((group) => isGroupLive(group) && group.members.some((member) => attributes.has(member))).map((group) => groupSubject(group.id))
    );
    if (inGroups.size > 0) {
      for (const grant of Object.values(this.state.grants)) {
        if (!isLive(grant) || !inGroups.has(grant.subject)) continue;
        const scope = scopeOf(grant);
        if (scope.kind === "space") keep(spaces[scope.id]);
      }
    }
    return [...seen.values()];
  }
  /** The spaces ledger, which a desk from before roles phase 4 lacks. */
  spaces() {
    return this.state.spaces ??= {};
  }
  // ---- seen-marks (#147, #134) ----
  async seenOf(actorId) {
    return { ...this.seen()[actorId] ?? {} };
  }
  /**
   * Read-modify-write on the serialized chain, which is what makes the merge
   * safe: two requests racing cannot interleave a read with the other's
   * write, and `advanceSeen` then makes the ORDER they land in irrelevant.
   * `CloudDesk` gets the same property from a transaction.
   */
  async markSeen(actorId, canvasId, mark) {
    return this.enqueue(async () => {
      const marks = this.seen()[actorId] ??= {};
      const merged = advanceSeen(marks[canvasId], mark);
      marks[canvasId] = merged;
      await this.append({ type: "seen", actorId, canvasId, mark: merged, at: merged.at });
      return merged;
    });
  }
  /** The seen ledger, which every desk written before 12 Sep 2026 lacks —
   *  correctly empty, since a person who has never marked anything has seen
   *  nothing as far as this home knows. */
  seen() {
    return this.state.seen ??= {};
  }
  // ---- groups (roles phase 5) ----
  async putGroup(group) {
    await this.enqueue(async () => {
      this.groups()[group.id] = { ...group, members: [...group.members] };
      await this.append({ type: "group", group, at: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  async group(groupId) {
    const found = this.groups()[groupId];
    return found ? { ...found, members: [...found.members] } : null;
  }
  async groupsFor(badge) {
    const actorIds = new Set(badge.claims.map((claim) => claim.actorId));
    return Object.values(this.groups()).filter((group) => isGroupLive(group) && actorIds.has(group.createdBy)).map((group) => ({ ...group, members: [...group.members] }));
  }
  async grantsBySubject(subject) {
    return Object.values(this.state.grants).filter((grant) => isLive(grant) && grant.subject === subject).map((grant) => structuredClone(grant));
  }
  /** The groups ledger, which a desk from before roles phase 5 lacks. */
  groups() {
    return this.state.groups ??= {};
  }
  async listedGrants() {
    return Object.values(this.state.grants).filter(isListedGrant).map((grant) => structuredClone(grant));
  }
  async setPublicListing(canvasId, grantId, listed, at, by) {
    return this.enqueue(async () => {
      const grant = this.state.grants[grantId];
      if (!grant || !canListGrant(grant) || grant.canvasId !== canvasId) return null;
      const listing = { listed, at, by };
      grant.listing = listing;
      await this.append({ type: "listing", grantId, listing, at });
      return structuredClone(grant);
    });
  }
  async putGrant(grant) {
    await this.enqueue(async () => {
      this.state.grants[grant.id] = structuredClone(grant);
      await this.append({ type: "grant", grant, at: grant.at });
    });
  }
  async revokeGrant(grantId, at, by, via) {
    return this.enqueue(async () => {
      const grant = this.state.grants[grantId];
      if (!grant) return null;
      if (grant.revokedAt !== void 0) return structuredClone(grant);
      grant.revokedAt = at;
      grant.revokedBy = by;
      if (grant.listing !== void 0) grant.listing = { listed: false, at, by };
      if (via) {
        grant.revokedVia = "operator";
        grant.revocation = { ...via };
      }
      await this.append({ type: "revoke", grantId, by, at, ...via ? { via } : {} });
      return structuredClone(grant);
    });
  }
  // ---- passes ----
  async putPass(pass) {
    await this.enqueue(async () => {
      this.state.passes[pass.id] = { ...pass };
      await this.append({ type: "pass", pass, at: pass.createdAt });
    });
  }
  async pass(passId) {
    const found = this.state.passes[passId];
    return found ? { ...found } : null;
  }
  async passesMintedBy(badgeId) {
    return Object.values(this.state.passes).filter((pass) => pass.mintedBy === badgeId).map((pass) => ({ ...pass }));
  }
  /**
   * Single-use, and on a file backing the guarantee comes from the desk's own
   * write chain: `enqueue` serializes this read-modify-write against every
   * other desk write, so two redemptions of one pass arriving in the same
   * millisecond are two runs of this function one after the other, and the
   * second one sees `redeemedAt` set.
   *
   * Both halves of the answer are load-bearing. `redeemed` says who won;
   * `pass` is the row as the WINNER left it, so the loser can be told when it
   * was spent rather than merely refused.
   */
  async redeemPass(passId, at, by) {
    return this.enqueue(async () => {
      const pass = this.state.passes[passId];
      if (!pass) return null;
      if (pass.redeemedAt !== void 0) return { pass: { ...pass }, redeemed: false };
      pass.redeemedAt = at;
      pass.redeemedBy = by;
      await this.append({ type: "redeem", passId, by, at });
      return { pass: { ...pass }, redeemed: true };
    });
  }
  // ---- the migration shelf ----
  async adopt(sessionKey, badgeId) {
    return this.enqueue(async () => {
      const row = this.state.shelf[sessionKey];
      const badge = this.live(badgeId);
      if (!row || !badge) return null;
      delete this.state.shelf[sessionKey];
      badge.claims = [...badge.claims.filter((c) => c.actorId !== row.actorId), row];
      await this.append({ type: "adopt", sessionKey, badgeId, at: (/* @__PURE__ */ new Date()).toISOString() });
      return { ...row };
    });
  }
  async shelve(rows) {
    if (Object.keys(rows).length === 0) return;
    await this.enqueue(async () => {
      for (const [key, row] of Object.entries(rows)) this.state.shelf[key] = row;
      await this.append({ type: "shelve", rows, at: (/* @__PURE__ */ new Date()).toISOString() });
    });
  }
  /**
   * Mint once, then answer the same key forever. The write chain is what
   * makes "once" true here: two callers racing arrive one after the other,
   * and the second sees the first's key rather than replacing it.
   *
   * 256 bits from the CSPRNG — `mintBadge`'s number, because it is the same
   * kind of secret and there is no reason for this home to hold two opinions
   * about how long a secret is.
   */
  async contentKey() {
    if (this.state.contentKey) return this.state.contentKey;
    await this.enqueue(async () => {
      if (this.state.contentKey) return;
      const key = randomBytes2(32).toString("base64url");
      this.state.contentKey = key;
      await this.append({ type: "contentkey", key, at: (/* @__PURE__ */ new Date()).toISOString() });
    });
    return this.state.contentKey;
  }
  // ---- the operator's ledger (operator phase 1) ----
  async recordOperatorAct(act) {
    await this.enqueue(async () => {
      this.state.operator[act.id] = { ...act };
      await this.append({ type: "operator", act, at: act.at });
    });
  }
  /**
   * The outcome, onto the row that is already there.
   *
   * Silent when the row is missing rather than throwing, for `touch`'s reason
   * and a sharper one: this runs on the way OUT of an act, and a settle that
   * threw would turn a successful act into a refusal the person reads as the
   * act having failed. A row that is not there stays not there, and the act's
   * own answer is still the truth about what happened.
   */
  async settleOperatorAct(id, outcome, reach) {
    await this.enqueue(async () => {
      const row = this.state.operator[id];
      if (!row) return;
      const settled = { ...row, outcome, ...reach !== void 0 ? { reach } : {} };
      this.state.operator[id] = settled;
      await this.append({ type: "operator", act: settled, at: settled.at });
    });
  }
  /**
   * Newest first, in memory: this ledger is small by construction — one row
   * per act a person performed by hand, at a sign-in page — so a sort over all
   * of it costs nothing a query would save. The cloud desk pages instead,
   * because Firestore charges by document read rather than by array length.
   */
  async operatorActs(options = {}) {
    const target = options.target ?? null;
    return Object.values(this.state.operator ?? {}).filter((act) => target === null || act.target === target).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, options.limit ?? 100).map((act) => ({ ...act }));
  }
  // ---- takedowns (operator phase 2) ----
  async recordTakedown(row) {
    await this.enqueue(async () => {
      (this.state.takedowns ??= {})[row.canvasId] = { ...row };
      await this.append({ type: "takedown", row, at: row.at });
    });
  }
  async liftTakedown(canvasId, lifted) {
    await this.enqueue(async () => {
      const row = this.state.takedowns?.[canvasId];
      if (!row) return;
      const next = {
        ...row,
        liftedAt: lifted.at,
        liftedBy: lifted.by,
        liftedActId: lifted.actId
      };
      this.state.takedowns[canvasId] = next;
      await this.append({ type: "takedown", row: next, at: lifted.at });
    });
  }
  async markPurged(canvasId, purged) {
    await this.enqueue(async () => {
      const row = this.state.takedowns?.[canvasId];
      if (!row) return;
      const next = {
        ...row,
        purgedAt: purged.at,
        purgedActId: purged.actId,
        purged: { ...purged.counts }
      };
      this.state.takedowns[canvasId] = next;
      await this.append({ type: "takedown", row: next, at: purged.at });
    });
  }
  async takedownFor(canvasId) {
    const row = this.state.takedowns?.[canvasId];
    return row ? { ...row } : null;
  }
  /** In force only — a lifted row is history, and every caller of this wants
   * the set the door and the canvas list act on. `takedownFor` is where the
   * history is read. */
  async takedowns() {
    return Object.values(this.state.takedowns ?? {}).filter(inForce).map((row) => ({ ...row }));
  }
  // ---- refusals (operator phase 6) ----
  async recordRefusal(row) {
    await this.enqueue(async () => {
      (this.state.refusals ??= {})[row.subject] = { ...row };
      await this.append({ type: "refusal", row, at: row.at });
    });
  }
  async liftRefusal(subject, lifted) {
    await this.enqueue(async () => {
      const row = this.state.refusals?.[subject];
      if (!row) return;
      const next = {
        ...row,
        liftedAt: lifted.at,
        liftedBy: lifted.by,
        liftedActId: lifted.actId
      };
      this.state.refusals[subject] = next;
      await this.append({ type: "refusal", row: next, at: lifted.at });
    });
  }
  async refusalFor(subject) {
    const row = this.state.refusals?.[subject];
    return row ? { ...row } : null;
  }
  /** Not lifted — expired rows included, because the desk keeps no clock
   * and the registry is the one reader that judges expiry (see `Desk`). */
  async refusals() {
    return Object.values(this.state.refusals ?? {}).filter((row) => row.liftedAt === void 0).map((row) => ({ ...row }));
  }
  // ---- internals ----
  /**
   * The badge behind an id, **or nothing if it was killed** — the one lookup
   * every method here goes through, so "a killed badge is a badge nobody
   * holds" is a property of the file rather than a rule each method
   * remembers. `killBadge` and `replay` are the two deliberate exceptions:
   * they are the code that reads the tombstone.
   */
  live(badgeId) {
    const badge = this.state.badges[badgeId];
    return badge && badge.killedAt === void 0 ? badge : void 0;
  }
  /** Serialize this desk's own writes. Not the engine's chain: a badge write
   * is not an op and must not be able to stall behind one. */
  enqueue(work) {
    const result = this.chain.then(work);
    this.chain = result.catch(() => {
    });
    return result;
  }
  /** Durable first, derived second — the same order the oplog uses. */
  async append(entry) {
    const seq = this.state.lastSeq + 1;
    await appendLineDurable(badgesLogFile(this.home), JSON.stringify({ seq, ...entry }));
    this.state.lastSeq = seq;
    await this.writeSnapshot();
  }
  async writeSnapshot() {
    await writeFileAtomic(badgesFile(this.home), JSON.stringify(this.state, null, 2));
  }
  replay(entry) {
    switch (entry.type) {
      case "personal": {
        for (const row of entry.rows.replicas ?? []) (this.state.personalReplicas ??= {})[row.canvasId] = row.home;
        for (const row of entry.rows.sources ?? []) (this.state.personalSources ??= {})[row.canvasId] = row;
        for (const row of entry.rows.owners ?? []) (this.state.personalOwners ??= {})[row.ownerId] = row;
        for (const row of entry.rows.intents ?? []) (this.state.personalIntents ??= {})[JSON.stringify([row.destinationCanvasId, row.ownerId, row.requestId])] = row;
        for (const row of entry.rows.delegates ?? []) ((this.state.personalDelegates ??= {})[row.sourceCanvasId] ??= {})[row.delegation.agentId] = row.delegation;
        return;
      }
      case "badge": {
        this.state.badges[entry.badgeId] ??= {
          badgeId: entry.badgeId,
          secretHash: entry.secretHash,
          kind: entry.kind,
          createdAt: entry.at,
          lastSeen: entry.at,
          admissions: [],
          claims: []
        };
        return;
      }
      case "claims": {
        const badge = this.state.badges[entry.badgeId];
        if (badge) badge.claims = entry.claims;
        return;
      }
      case "shelve": {
        for (const [key, row] of Object.entries(entry.rows)) this.state.shelf[key] = row;
        return;
      }
      case "adopt": {
        const row = this.state.shelf[entry.sessionKey];
        const badge = this.state.badges[entry.badgeId];
        if (!row) return;
        delete this.state.shelf[entry.sessionKey];
        if (badge) badge.claims = [...badge.claims.filter((c) => c.actorId !== row.actorId), row];
        return;
      }
      case "grant": {
        this.state.grants[entry.grant.id] ??= { ...entry.grant };
        return;
      }
      case "listing": {
        const grant = this.state.grants[entry.grantId];
        if (grant && canListGrant(grant)) grant.listing = { ...entry.listing };
        return;
      }
      case "revoke": {
        const grant = this.state.grants[entry.grantId];
        if (!grant || grant.revokedAt !== void 0) return;
        grant.revokedAt = entry.at;
        grant.revokedBy = entry.by;
        if (grant.listing !== void 0) grant.listing = { listed: false, at: entry.at, by: entry.by };
        if (entry.via) {
          grant.revokedVia = "operator";
          grant.revocation = { ...entry.via };
        }
        return;
      }
      case "pass": {
        this.state.passes[entry.pass.id] ??= { ...entry.pass };
        return;
      }
      case "redeem": {
        const pass = this.state.passes[entry.passId];
        if (!pass || pass.redeemedAt !== void 0) return;
        pass.redeemedAt = entry.at;
        pass.redeemedBy = entry.by;
        return;
      }
      case "attest": {
        const badge = this.state.badges[entry.badgeId];
        if (badge) badge.attestations = upsertAttestation(badge.attestations, entry.attestation);
        return;
      }
      case "kill": {
        const badge = this.state.badges[entry.badgeId];
        if (!badge || badge.killedAt !== void 0) return;
        badge.killedAt = entry.at;
        badge.killedBy = entry.by;
        if (entry.end) badge.end = entry.end;
        return;
      }
      case "space": {
        this.spaces()[entry.space.id] = { ...entry.space, canvasIds: [...entry.space.canvasIds] };
        return;
      }
      case "group": {
        this.groups()[entry.group.id] = { ...entry.group, members: [...entry.group.members] };
        return;
      }
      case "seen": {
        const marks = this.seen()[entry.actorId] ??= {};
        marks[entry.canvasId] = advanceSeen(marks[entry.canvasId], entry.mark);
        return;
      }
      case "operator": {
        (this.state.operator ??= {})[entry.act.id] = { ...entry.act };
        return;
      }
      case "takedown": {
        (this.state.takedowns ??= {})[entry.row.canvasId] = { ...entry.row };
        return;
      }
      case "refusal": {
        (this.state.refusals ??= {})[entry.row.subject] = { ...entry.row };
        return;
      }
      case "contentkey": {
        this.state.contentKey ??= entry.key;
        return;
      }
    }
  }
};

// packages/server/src/takedowns.ts
var Refusals = class {
  takedownRows = /* @__PURE__ */ new Map();
  refusalRows = /* @__PURE__ */ new Map();
  /** Parsed once per `net:` row, because the meter asks on every knock. */
  nets = /* @__PURE__ */ new Map();
  now;
  constructor(options = {}) {
    this.now = options.now ?? (() => Date.now());
  }
  /** The clock this registry judges expiry against, in epoch ms. The refuse
   * route derives a refusal's `at` and `expiresAt` from it, so the horizon it
   * writes and the horizon the door reads are measured on one clock — which is
   * what lets a test move `--for 10m` past its end without waiting. */
  nowMs() {
    return this.now();
  }
  /** Everything in force, at boot. Called once by `startDaemon`; a home that
   * never calls it answers "nothing is down and nobody is refused", which is
   * the truth about a home that has never had an operator. */
  async load(desk) {
    this.takedownRows = new Map((await desk.takedowns()).map((row) => [row.canvasId, row]));
    this.refusalRows = /* @__PURE__ */ new Map();
    this.nets = /* @__PURE__ */ new Map();
    for (const row of await desk.refusals()) this.remrefuse(row);
  }
  // ---- takedowns (operator phase 2) ----
  /** The act, having written the desk and the store, says so here. */
  remember(row) {
    if (inForce(row)) this.takedownRows.set(row.canvasId, row);
    else this.takedownRows.delete(row.canvasId);
  }
  /** The row in force for this canvas, or null — the door's whole question. */
  of(canvasId) {
    return this.takedownRows.get(canvasId) ?? null;
  }
  /** Is it down: the same question, where only the answer's truth is wanted. */
  has(canvasId) {
    return this.takedownRows.has(canvasId);
  }
  /** Every row in force. The canvas list's read, and it is a read of a handful
   * of rows on a home that has any at all. */
  all() {
    return [...this.takedownRows.values()];
  }
  /** What a surface is handed for one canvas, or null. */
  notice(canvasId) {
    const row = this.of(canvasId);
    return row ? noticeOf(row) : null;
  }
  // ---- refusals (operator phase 6) ----
  /** The act, having written the desk, says so here. A lifted row is
   * forgotten; an in-force row (expiry in the future, or none) is held. The
   * expiry is judged on every READ rather than here, so a row remembered
   * before its horizon and asked after it answers correctly with no timer. */
  rememberRefusal(row) {
    if (row.liftedAt === void 0) this.remrefuse(row);
    else {
      this.refusalRows.delete(row.subject);
      this.nets.delete(row.subject);
    }
  }
  remrefuse(row) {
    this.refusalRows.set(row.subject, row);
    if (row.kind === "net") {
      const cidr = parseCidr(row.subject.slice("net:".length));
      if (cidr) this.nets.set(row.subject, cidr);
    }
  }
  /** The refusal in force for one exact subject, or null. */
  refusalOf(subject) {
    const row = this.refusalRows.get(subject);
    return row && refusalInForce(row, this.now()) ? row : null;
  }
  /**
   * **The refusal that turns this badge away at the door** — the first of the
   * badge's attestations that names a refused address, or null. The door hook
   * and `/api/attest` both ask it: acting with a badge that proved a refused
   * address, and proving it in the first place, are one fact from two sides.
   */
  refusingAttestation(attestations) {
    for (const attestation of attestations) {
      const row = this.refusalOf(attestation.attribute);
      if (row) return row;
    }
    return null;
  }
  /** The refusal on one proved address, for `/api/attest`. */
  refusingAddress(attribute) {
    return this.refusalOf(attribute);
  }
  /** The refusal on a name, for `actor.claim {as}` — `actor:<id>`. */
  refusingActor(actorId) {
    return this.refusalOf(`actor:${actorId}`);
  }
  /**
   * **The refused network this address is inside, or null** — the mint
   * meter's question. A walk over the `net:` rows, which are a handful; an
   * expired row is skipped, which is how a `net:` block ends on its own.
   */
  refusingNet(address) {
    const now = this.now();
    for (const [subject, cidr] of this.nets) {
      const row = this.refusalRows.get(subject);
      if (row && refusalInForce(row, now) && cidrContains(cidr, address)) return row;
    }
    return null;
  }
  /** Every refusal in force right now, for a listing or a lift. */
  allRefusals() {
    const now = this.now();
    return [...this.refusalRows.values()].filter((row) => refusalInForce(row, now));
  }
  /** What a surface is handed for one subject, or null. */
  refusalNotice(subject) {
    const row = this.refusalOf(subject);
    return row ? refusalNoticeOf(row) : null;
  }
};
var TakenDownError = class extends Error {
  constructor(row) {
    super(takedownSentence(row));
    this.row = row;
    this.name = "TakenDownError";
  }
  row;
  code = NOT_ADMITTED;
  reason = TAKEN_DOWN;
  status = 403;
};
var RefusedError = class extends Error {
  constructor(row) {
    super(refusalSentence(row));
    this.row = row;
    this.name = "RefusedError";
    this.notice = refusalNoticeOf(row);
  }
  row;
  code = NOT_ADMITTED;
  reason = REFUSED;
  status = 403;
  notice;
};

// packages/server/src/config.ts
import { promises as fs4 } from "node:fs";
import path4 from "node:path";
async function readConfigFile(home) {
  try {
    const parsed = JSON.parse(await fs4.readFile(configFile(home), "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
async function updateConfigFile(home, patch) {
  const current = await readConfigFile(home);
  await fs4.mkdir(path4.dirname(configFile(home)), { recursive: true });
  await fs4.writeFile(configFile(home), `${JSON.stringify({ ...current, ...patch }, null, 2)}
`);
}
async function resolveHomeUrl(home) {
  const fromEnv = process.env.ISOCAN_HOME_URL?.trim();
  if (fromEnv) return normalizeHomeUrl(fromEnv);
  const config = await readConfigFile(home);
  const configured = typeof config.home === "string" ? config.home.trim() : "";
  return configured ? normalizeHomeUrl(configured) : null;
}

// packages/server/src/google.ts
import { promises as fs5 } from "node:fs";
import path5 from "node:path";
var googleTokenFile = (home) => path5.join(home, "google.json");
async function readGoogleToken(home) {
  try {
    const parsed = JSON.parse(await fs5.readFile(googleTokenFile(home), "utf8"));
    return typeof parsed.token === "string" && parsed.token.trim() ? { ...parsed, token: parsed.token.trim(), savedAt: parsed.savedAt ?? "" } : null;
  } catch {
    return null;
  }
}
async function writeGoogleToken(home, token, account) {
  const record = { token: token.trim(), savedAt: (/* @__PURE__ */ new Date()).toISOString(), ...account ? { account } : {} };
  await fs5.mkdir(home, { recursive: true });
  await fs5.writeFile(googleTokenFile(home), JSON.stringify(record, null, 2) + "\n", { mode: 384 });
  await fs5.chmod(googleTokenFile(home), 384).catch(() => {
  });
  return record;
}
async function clearGoogleToken(home) {
  try {
    await fs5.unlink(googleTokenFile(home));
    return true;
  } catch {
    return false;
  }
}
var DocRefusal = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
  code;
};
var TIMEOUT = 2e4;
async function fetchGoogleDoc(id, token) {
  const fetchedAt = (/* @__PURE__ */ new Date()).toISOString();
  const source = googleDocUrl(id);
  let anonymous;
  try {
    anonymous = await fetch(googleDocExportUrl(id), { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
  } catch (err) {
    throw new DocRefusal(`could not reach Google: ${err.message}`, "doc-unreachable");
  }
  const type = anonymous.headers.get("content-type") ?? "";
  if (anonymous.ok && !/text\/html/i.test(type)) {
    const markdown2 = await anonymous.text();
    return { markdown: markdown2, source, title: docTitleFrom(markdown2, id), fetchedAt, via: "anonymous" };
  }
  if (!token) {
    throw new DocRefusal(
      "Google would not hand this document over anonymously \u2014 share it by link (Anyone with the link), or save a Drive token on this machine with `isocan gdoc auth`",
      "doc-not-public"
    );
  }
  let res;
  try {
    res = await fetch(googleDriveExportUrl(id), { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(TIMEOUT) });
  } catch (err) {
    throw new DocRefusal(`could not reach Drive: ${err.message}`, "doc-unreachable");
  }
  if (res.status === 401 || res.status === 403) {
    throw new DocRefusal(tokenRefusedSentence(token, res.status), "token-refused");
  }
  if (!res.ok) throw new DocRefusal(`Drive answered ${res.status} for this document`, "doc-unreachable");
  const markdown = await res.text();
  return { markdown, source, title: docTitleFrom(markdown, id), fetchedAt, via: "drive" };
}
async function driveModifiedTime(id, token) {
  if (!token) return null;
  const res = await fetch(googleDriveMetaUrl(id), { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(TIMEOUT) });
  if (res.status === 401 || res.status === 403) throw new DocRefusal(tokenRefusedSentence(token, res.status), "token-refused");
  if (!res.ok) return null;
  const body = await res.json();
  return body.modifiedTime ?? null;
}
async function driveAccount(token) {
  const res = await fetch(GOOGLE_DRIVE_ABOUT_URL, { headers: { Authorization: `Bearer ${token.trim()}` }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  const body = await res.json();
  return body.user?.emailAddress ?? body.user?.displayName ?? null;
}
function tokenRefusedSentence(token, status) {
  const age = token.savedAt ? Math.round((Date.now() - Date.parse(token.savedAt)) / 6e4) : null;
  const old = age !== null && age > 55 ? ` \u2014 it was saved ${age} minutes ago, and Google's access tokens last about an hour` : "";
  return `Drive refused the token (${status})${old}. Save a fresh one: \`gcloud auth print-access-token | isocan gdoc auth --stdin\`, or check the account can open this document`;
}

// packages/server/src/badge-store.ts
import { promises as fs6 } from "node:fs";
import { randomUUID } from "node:crypto";
import path6 from "node:path";
async function readBadge(home, base) {
  try {
    const raw = JSON.parse(await fs6.readFile(identityFile(home), "utf8"));
    const badge = raw.auth?.[normalizeHomeUrl(base)];
    return badge?.badgeId && badge.secret ? badge : null;
  } catch {
    return null;
  }
}
var identityWrites = Promise.resolve();
function hasCode(error, code) {
  return error?.code === code;
}
function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}
async function identityLock(home) {
  const directory = path6.join(home, ".identity-write.lock");
  const ownerFile = path6.join(directory, "owner.json");
  const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
  const deadline = Date.now() + 5e3;
  for (; ; ) {
    try {
      await fs6.mkdir(directory, { mode: 448 });
      break;
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
      if (Date.now() >= deadline) {
        throw new Error(`Identity write is locked at ${directory}. Inspect the owner and recover an abandoned lock explicitly; it was not removed.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  const claimed = await fs6.lstat(directory);
  let ownedFile;
  let handle;
  try {
    handle = await fs6.open(ownerFile, "wx", 384);
    ownedFile = await handle.stat();
    await handle.writeFile(owner);
    await handle.close();
    handle = void 0;
  } catch (error) {
    await handle?.close().catch(() => {
    });
    if (sameFile(claimed, await fs6.lstat(directory))) {
      if (ownedFile && sameFile(ownedFile, await fs6.lstat(ownerFile))) await fs6.unlink(ownerFile);
      await fs6.rmdir(directory);
    }
    throw error;
  }
  return async () => {
    if (!sameFile(claimed, await fs6.lstat(directory)) || await fs6.readFile(ownerFile, "utf8") !== owner) {
      throw new Error(`Identity lock ownership changed at ${directory}; the lock was not removed.`);
    }
    await fs6.unlink(ownerFile);
    await fs6.rmdir(directory);
  };
}
function identityObject(value, file) {
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!object(value) || ["id", "name", "createdAt"].some((key) => value[key] !== void 0 && typeof value[key] !== "string") || value.auth !== void 0 && !object(value.auth)) {
    throw new Error(`Unsupported identity data at ${file}; the existing file was not replaced.`);
  }
  return value;
}
async function updateIdentity(home, update) {
  const work = identityWrites.then(async () => {
    await fs6.mkdir(home, { recursive: true });
    const physicalHome = await fs6.realpath(home);
    const release = await identityLock(physicalHome);
    try {
      const file = identityFile(physicalHome);
      let current = {};
      try {
        current = identityObject(JSON.parse(await fs6.readFile(file, "utf8")), file);
      } catch (error) {
        if (!hasCode(error, "ENOENT")) throw error;
      }
      const { next, result } = update(current);
      if (next) {
        const mode = await fs6.stat(file).then((stat) => stat.mode & 511).catch((error) => {
          if (!hasCode(error, "ENOENT")) throw error;
          return 384;
        });
        await writeFileAtomic(file, JSON.stringify(next, null, 2), mode);
      }
      return result;
    } finally {
      await release();
    }
  });
  identityWrites = work.catch(() => {
  });
  return work;
}
async function writeIdentityName(home, name, fresh2 = false) {
  return updateIdentity(home, (current) => {
    const id = !fresh2 && current.id && current.name ? current.id : newActorId();
    const actor = { id, name };
    return { next: { ...current, ...actor, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, result: actor };
  });
}
async function writeBadge(home, base, badge) {
  return updateIdentity(home, (current) => ({
    next: {
      ...current,
      auth: {
        ...current.auth ?? {},
        [normalizeHomeUrl(base)]: badge
      }
    },
    result: void 0
  }));
}
async function adoptIdentity(home, actor) {
  return updateIdentity(home, (current) => {
    const existing = current.id && current.name ? { id: current.id, name: current.name } : null;
    if (existing && existing.id !== actor.id) return { result: { actor: existing, adopted: false } };
    if (!actor.name) return { result: { actor, adopted: false } };
    return {
      next: { ...current, ...actor, createdAt: (/* @__PURE__ */ new Date()).toISOString() },
      result: { actor, adopted: true }
    };
  });
}
async function knockOnDoor(base, timeoutMs = 1e4) {
  const answer = await askTheDoor(base, timeoutMs);
  return "badge" in answer ? answer.badge : null;
}
function fileBadgeStore(home, base) {
  return {
    read: () => readBadge(home, base),
    keep: (badge) => writeBadge(home, base, badge)
  };
}

// packages/server/src/meter.ts
var MINT_PER_MINUTE = 20;
var TOO_MANY_BADGES = "too-many-badges";

// packages/server/src/home-link.ts
import { Readable } from "node:stream";

// packages/server/src/build.ts
import { statSync, readFileSync } from "node:fs";
import path7 from "node:path";
var root = packageRoot();
var WITNESSES = [
  "package.json",
  "packages/server/src/http.ts",
  "packages/core/src/reducer.ts",
  "packages/cli/src/main.ts"
];
var cached = null;
function buildStamp() {
  if (cached) return cached;
  let version = "0.0.0";
  let stamped = {};
  try {
    const pkg = JSON.parse(readFileSync(path7.join(root, "package.json"), "utf8"));
    version = pkg.version ?? version;
    stamped = pkg.isocan ?? {};
  } catch {
  }
  let newest = 0;
  for (const witness of WITNESSES) {
    try {
      newest = Math.max(newest, statSync(path7.join(root, witness)).mtimeMs);
    } catch {
    }
  }
  const envSha = plausibleSha(process.env.ISOCAN_BUILD_SHA);
  const envBuiltAt = envSha ? process.env.ISOCAN_BUILD_DATE || null : null;
  const head = stamped.commit || envSha ? null : gitHead();
  cached = {
    version,
    root,
    codeAt: new Date(newest).toISOString(),
    commit: stamped.commit ?? envSha ?? head?.commit ?? null,
    builtAt: stamped.builtAt ?? envBuiltAt ?? head?.committedAt ?? null
  };
  return cached;
}
function plausibleSha(raw) {
  if (!raw) return null;
  const value = raw.trim();
  return /^[0-9a-f]{7,40}$/.test(value) ? value.slice(0, 7) : null;
}
function gitHead(from = root) {
  try {
    let dir = path7.join(from, ".git");
    const stat = statSync(dir);
    if (stat.isFile()) {
      const pointer = readFileSync(dir, "utf8").match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();
      if (!pointer) return null;
      dir = path7.resolve(from, pointer);
    }
    let refs = dir;
    try {
      const common = readFileSync(path7.join(dir, "commondir"), "utf8").trim();
      if (common) refs = path7.resolve(dir, common);
    } catch {
    }
    const head = readFileSync(path7.join(dir, "HEAD"), "utf8").trim();
    if (head === "ref: refs/heads/.invalid") return null;
    const ref = head.match(/^ref:\s*(.+)$/)?.[1]?.trim();
    let sha2 = ref ? null : head;
    if (ref) {
      try {
        sha2 = readFileSync(path7.join(refs, ref), "utf8").trim();
      } catch {
        const packed = readFileSync(path7.join(refs, "packed-refs"), "utf8");
        sha2 = packed.match(new RegExp(`^([0-9a-f]{40})\\s+${ref}$`, "m"))?.[1] ?? null;
      }
    }
    if (!sha2 || !/^[0-9a-f]{7,40}$/.test(sha2)) return null;
    let committedAt = null;
    try {
      committedAt = new Date(statSync(path7.join(dir, "HEAD")).mtimeMs).toISOString();
    } catch {
    }
    return { commit: sha2.slice(0, 7), committedAt };
  } catch {
    return null;
  }
}
function describeBuild(stamp) {
  const version = stamp.version ?? "(unknown version)";
  const parts = [stamp.commit, stamp.builtAt?.slice(0, 10)].filter(Boolean);
  return parts.length > 0 ? `${version} (${parts.join(", ")})` : version;
}
function stalenessOf(daemon, mine = buildStamp()) {
  if (!daemon.root || !daemon.startedAt) {
    return { stale: true, why: "the daemon predates build stamps \u2014 restart it to know what it is" };
  }
  if (path7.resolve(daemon.root) !== path7.resolve(mine.root)) {
    return { stale: true, why: `the daemon is running another copy of isocan (${daemon.root})` };
  }
  if (daemon.commit && mine.commit && daemon.commit !== mine.commit) {
    return {
      stale: true,
      why: `the daemon is running ${daemon.commit}, this copy is ${mine.commit}`
    };
  }
  if (daemon.codeAt && Date.parse(daemon.startedAt) < Date.parse(mine.codeAt)) {
    return { stale: true, why: "this copy has been updated since the daemon started" };
  }
  return { stale: false, why: "" };
}
function upgradeVerdict(home, mine = buildStamp()) {
  if (!home?.commit || !mine.commit) return null;
  const available = home.commit !== mine.commit;
  return {
    available,
    direction: available ? order(mine.builtAt, home.builtAt) : null,
    home: home.url,
    homeCommit: home.commit,
    homeBuiltAt: home.builtAt,
    mine: mine.commit,
    mineBuiltAt: mine.builtAt,
    /**
     * Facts, in the order a reader needs them: what this copy is, then what
     * the home is. It names no action — the CLI's line adds the command, and
     * whether anybody may run it is a mode's question, not a verdict's.
     */
    why: available ? `this copy is ${dated(mine.commit, mine.builtAt)}; your home ${home.url} runs ${dated(home.commit, home.builtAt)}` : ""
  };
}
function order(mineBuiltAt, homeBuiltAt) {
  if (!mineBuiltAt || !homeBuiltAt) return null;
  const mine = Date.parse(mineBuiltAt);
  const theirs = Date.parse(homeBuiltAt);
  if (Number.isNaN(mine) || Number.isNaN(theirs) || mine === theirs) return null;
  return mine < theirs ? "behind" : "ahead";
}
function dated(commit, builtAt) {
  return builtAt ? `${commit} (${builtAt.slice(0, 10)})` : commit;
}

// packages/server/src/blobs-present.ts
var blobsPresentRoute = (canvasId) => `/api/projects/${encodeURIComponent(canvasId)}/blobs/present`;
var BLOBS_PRESENT_LIMIT = 1e3;

// packages/server/src/home-link.ts
var RECONNECT_MIN_MS = 250;
var RECONNECT_MAX_MS = 1e4;
var DEFAULT_POLL_MS = 2e3;
var BUILD_PROBE_MS = 60 * 60 * 1e3;
var BUILD_PROBE_TIMEOUT_MS = 5e3;
var BATCH_REPROBE_MS = 60 * 60 * 1e3;
var RELAY_COALESCE_MS = 40;
var COMPLAIN_AFTER_FAILURES = 3;
var DIAL_STUCK_MS = 3e4;
var HomeUnreachableError = class extends Error {
  code = "home-unreachable";
  constructor(homeUrl, cause) {
    super(
      `that canvas lives at ${homeUrl}, and this daemon cannot reach it (${cause}) \u2014 the write was NOT made. Canvases whose home is elsewhere (or here) are unaffected. Offline writes are queued in the browser (phase 10) and at birth (phase 13); a replica's CLI writes are not.`
    );
    this.name = "HomeUnreachableError";
  }
};
var HomeRefusedError = class extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HomeRefusedError";
  }
  status;
  code;
};
var HomeLink = class {
  homeUrl;
  home;
  engine;
  presence;
  registry;
  pollMs;
  probeMs;
  /**
   * Did the last poll of this home get an answer? Null until one has been
   * tried.
   *
   * Kept as a by-product of the sweep rather than probed on demand, because
   * the caller that wants it is `GET /api/homes`, which feeds `isocan status`'s
   * role line — a command an agent runs dozens of times. A reachability probe
   * per home per status call would put a network round trip behind `isocan
   * status` on a machine with three homes. `reachable()` below is still there
   * for the caller that genuinely wants to ask NOW (`isocan home <url>`, once,
   * before it changes anything).
   */
  answering = null;
  /**
   * **Which build this home last said it was**, or null for every way of not
   * knowing at once: never asked, asked and got nothing, asked and the home
   * could not say.
   *
   * Read by `HomeLinks.upgrade()` and turned into the health body's `upgrade`
   * field. Cleared on a failed probe rather than left holding the last good
   * answer, because a verdict is a statement about NOW: an oracle that cannot
   * answer must produce no verdict, and a cached one would go on asserting a
   * comparison nobody re-made.
   */
  homeBuild = null;
  badge = null;
  rc;
  links = /* @__PURE__ */ new Map();
  poll = null;
  /** A self-rescheduling timeout, `gc.ts`'s pattern — never a second
   * `setInterval`, which would keep firing into a home that stopped answering
   * and would pile up if a probe ever outran its own interval. */
  probe = null;
  stopped = false;
  syncing = null;
  handshakeLog = /* @__PURE__ */ new Map();
  /** Per canvas, whether its socket has ever carried anything — see
   * `CanvasHealth` for why this outlives the `CanvasLink` it describes. */
  health = /* @__PURE__ */ new Map();
  /** Which (canvas, actor) faces the home has already refused to vouch for.
   * `relay()` drops such a face on every beat; a parked agent beats every few
   * seconds, and a line per beat would bury the one that matters. */
  unvouched = /* @__PURE__ */ new Set();
  /** Cuts every in-flight request to the home when the daemon shuts down, so
   * closing does not wait out a 30-second timeout on a home that has gone. */
  aborter = new AbortController();
  /**
   * Actors this daemon's badge has already been made to vouch for at the home.
   *
   * Mechanism 5, from the local end: each hop vouches for what only it can
   * see. This daemon verifies session-level (that client's `sessionKey`
   * claimed this actor HERE) and the home verifies badge-level (the op's actor
   * is among the presenting badge's claims) — so before this daemon speaks for
   * an actor at the home, that actor has to be on its one badge. Cached
   * exactly as `ws.ts` caches its per-socket `vouched` set, and for the same
   * measurement: presence beats arrive by the hundred under one unchanging
   * actor, and a desk round trip per beat is a desk round trip per mouse move.
   */
  // Classification is immutable from before birth; an ordinary answer may be cached.
  classifiedReplicas = /* @__PURE__ */ new Set();
  async classifyReplica(canvasId) {
    if (this.classifiedReplicas.has(canvasId)) return;
    const answer = await this.api("GET", sourceClassificationRoute({ canvasId, expectedHome: this.homeUrl }));
    if (answer.kind !== "ordinary" && answer.kind !== "personal") throw new HomeRefusedError(403, "source classification is unavailable", "personal-source-unavailable");
    if (answer.kind === "personal") await this.engine.recordPersonalReplica(canvasId, this.homeUrl);
    this.classifiedReplicas.add(canvasId);
  }
  claimed = /* @__PURE__ */ new Set();
  claiming = /* @__PURE__ */ new Map();
  constructor(options) {
    this.homeUrl = normalizeHomeUrl(options.homeUrl);
    this.home = options.home;
    this.engine = options.engine;
    this.presence = options.presence;
    this.registry = options.registry;
    this.rc = options.rc ?? null;
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    this.probeMs = options.probeMs ?? BUILD_PROBE_MS;
    this.presence.onChange((canvasId) => this.scheduleRelay(canvasId));
    this.rc?.onChange((canvasId) => this.scheduleRelay(canvasId));
    this.engine.onEvent((canvasId, message) => {
      if (message.type !== "op-applied") return;
      if (this.stopped || this.links.has(canvasId)) return;
      if (!this.registry.idsFor(this.homeUrl).includes(canvasId)) return;
      this.openCanvas(canvasId);
    });
  }
  /**
   * Open the connection and keep it open. Never throws: a home that is down
   * at boot must not stop a daemon from serving its local CLIs — the retry
   * loop is the whole point.
   *
   * **Idempotent, and it has to be.** `HomeLinks.linkFor` fires `start()` on a
   * link the moment it creates one, and `HomeLinks.start()` then awaits
   * `start()` on every address it dials — so every link created at boot was
   * being started TWICE. That is two `setInterval` polls, of which `close()`
   * can only clear the one the field still holds, and it doubled the sweep
   * rate against every home for the life of the daemon. Measured
   * 2026-08-28 while adding the build probe, which would otherwise have
   * inherited the same doubling; `upgrade-probe.test.ts` counts it now.
   */
  start() {
    return this.starting ??= this.boot();
  }
  starting = null;
  async boot() {
    await Promise.all([this.sync().catch(() => {
    }), this.askBuild()]);
    this.poll = setInterval(() => void this.sync().catch(() => {
    }), this.pollMs);
    this.poll.unref?.();
    this.scheduleProbe();
  }
  /**
   * Shut down with the daemon.
   *
   * Phase 4's finding paid for this once already: a socket left open is a
   * process that never exits. Every canvas socket is terminated, every timer
   * cleared, and the mirrored faces are dropped — because with the connection
   * gone, nobody on the other side of it is visibly here any more, and a
   * roster that went on showing them would be presence lying.
   */
  async close() {
    this.stopped = true;
    this.aborter.abort();
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (this.probe) clearTimeout(this.probe);
    this.probe = null;
    const links = [...this.links.values()];
    this.links.clear();
    for (const link of links) this.closeLink(link);
    this.presence.dropMirror(this.origin());
    await Promise.allSettled(links.map((link) => link.work));
  }
  /** The key this link's mirrored faces are held under. One home, one key. */
  origin() {
    return `home:${this.homeUrl}`;
  }
  // ---- the canvas set ----
  /**
   * Which canvases this replica carries, re-read from both ends.
   *
   * A POLL rather than a subscription, and that is a real limitation rather
   * than a shrug: there is no home-wide socket — `/ws` is per canvas — so
   * "a canvas appeared at the home" has no event to ride on. Polling
   * `GET /api/projects` every couple of seconds is what makes Scene 0's last
   * line true ("her laptop and her desktop show the same canvas") without
   * inventing a home-wide channel this phase would then have to defend.
   *
   * **What it asks for, and why that sentence changed in phase 8.** Phase 6
   * asked the home-wide question and said so out loud: "a replica of a
   * MULTI-TENANT home pulls down more than it should". Phase 7 narrowed the
   * route to the door's own test and found it could go no further, because a
   * fresh replica's badge had no admissions and nothing ever gave it one.
   *
   * The pass gives it one. So this caller now states the narrow question —
   * `?reach=admitted`, see `CanvasesReach` — and a replica mirrors **what it
   * was let into** rather than everything a home will show it. Enumeration
   * was never the design; it was the easiest thing that worked when a home
   * had one member.
   */
  sync() {
    if (this.stopped) return Promise.resolve();
    if (this.syncing) return this.syncing;
    this.syncing = this.sweep().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }
  async sweep() {
    const wanted = /* @__PURE__ */ new Set();
    for (const canvasId of this.registry.idsFor(this.homeUrl)) wanted.add(canvasId);
    const theirs = await this.api("GET", canvasesRoute("admitted")).catch(() => null);
    const was = this.answering;
    this.answering = theirs !== null;
    if (this.answering && was === false) void this.askBuild();
    if (theirs) {
      for (const canvas of theirs) {
        if (this.stopped) return;
        if (await this.registry.mayDial(canvas.id, this.homeUrl)) wanted.add(canvas.id);
      }
    }
    for (const canvasId of wanted) {
      if (this.stopped) return;
      this.repair(canvasId);
    }
  }
  /**
   * **One canvas, brought back to what it should be** — the sweep's third job,
   * and the one it did not have.
   *
   * It used to open a socket for a canvas that had no link and stop there:
   * `links.has(canvasId)` was read as "this canvas is fine". A map entry is
   * not a connection, and the gap between those two sentences is where a
   * canvas can sit for hours — a dial that hung before it ever made a socket
   * leaves an entry with no socket, no retry timer, and nothing that will ever
   * touch it again.
   *
   * **Presence is the reason this matters more than it looks.** Everything
   * else about a home link is level-triggered: the poll re-reads the canvas
   * set, the tail is re-requested from a seq cursor, a write is retried by its
   * caller. The relay alone was edge-triggered — it went up when a face
   * changed or a socket opened, and if that one send was lost or refused,
   * nothing ever tried again. So the repair below re-states the roster on
   * every poll for any canvas that has local faces: it is a few hundred bytes
   * every couple of seconds, and it converts "your face never went up" from a
   * permanent condition into a two-second one.
   *
   * A canvas with no local faces is deliberately left alone. An empty roster
   * that failed to go up costs nothing — the home's own TTL and the socket's
   * close both clear this daemon's mirror without being told.
   */
  repair(canvasId) {
    const link = this.links.get(canvasId);
    if (!link) {
      const health = this.healthOf(canvasId);
      if (
        // A canvas the home has REFUSED — withdrawn, or taken down — is asked
        // again at the slowest rate rather than at the poll's, however many
        // times it has been open before. See `refused` on `CanvasHealth`.
        (health.refused || health.opens === 0 && health.failures >= COMPLAIN_AFTER_FAILURES) && health.attemptedAt !== null && Date.now() - health.attemptedAt < RECONNECT_MAX_MS
      ) {
        return;
      }
      return this.openCanvas(canvasId);
    }
    if (link.closed) return;
    if (link.socket?.readyState === import_websocket.default.OPEN) {
      if (this.presence.localRoster(canvasId).length > 0) this.scheduleRelay(canvasId);
      return;
    }
    if (link.retry) return;
    if (link.dialledAt !== null && Date.now() - link.dialledAt < DIAL_STUCK_MS) return;
    if (link.dialledAt !== null) {
      this.noteFailure(
        canvasId,
        `a dial has been unfinished for over ${Math.round(DIAL_STUCK_MS / 1e3)}s`
      );
    }
    void this.dial(link);
  }
  // ---- one canvas, one socket ----
  openCanvas(canvasId) {
    const link = {
      canvasId,
      socket: null,
      work: Promise.resolve(),
      retry: null,
      backoffMs: RECONNECT_MIN_MS,
      relay: null,
      closed: false,
      carried: false,
      dialSeq: 0,
      dialledAt: null
    };
    this.links.set(canvasId, link);
    void this.dial(link);
  }
  closeLink(link) {
    link.closed = true;
    if (link.retry) clearTimeout(link.retry);
    if (link.relay) clearTimeout(link.relay);
    link.retry = null;
    link.relay = null;
    const socket = link.socket;
    link.socket = null;
    socket?.terminate();
  }
  reconnect(link) {
    if (this.stopped || link.closed || link.retry) return;
    const wait = link.backoffMs;
    link.backoffMs = Math.min(link.backoffMs * 2, RECONNECT_MAX_MS);
    link.retry = setTimeout(() => {
      link.retry = null;
      void this.dial(link);
    }, wait);
    link.retry.unref?.();
  }
  /**
   * Dial one canvas, presenting the cursor this replica actually holds.
   *
   * `since` is the LOCAL `lastSeq` — "I have through N", Scene 4's beat 7 in
   * one query parameter. A canvas this home has never seen sends 0 and gets a
   * snapshot, which is how a replica adopts a canvas somebody else made.
   *
   * A daemon is not a browser: the badge goes in `Authorization` as a bearer,
   * never a cookie. `ws.ts`'s Origin check deliberately exempts the bearer
   * carrier, because an attacker's page cannot read a bearer token and so has
   * nothing to ride.
   */
  async dial(link) {
    if (this.stopped || link.closed) return;
    const attempt = ++link.dialSeq;
    link.carried = false;
    link.dialledAt = Date.now();
    const gaveUp = (why) => {
      if (link.dialSeq !== attempt) return;
      link.dialledAt = null;
      this.noteFailure(link.canvasId, why);
      this.reconnect(link);
    };
    let badge;
    try {
      badge = await this.ensureBadge();
    } catch (error) {
      return gaveUp(`this machine could not keep its badge for the home: ${error.message}`);
    }
    if (link.dialSeq !== attempt) return;
    if (!badge) {
      return gaveUp("the door did not answer, so there is no badge to dial with");
    }
    try {
      await this.classifyReplica(link.canvasId);
    } catch (error) {
      return gaveUp(error.message);
    }
    const since = await this.localSeq(link.canvasId);
    if (link.dialSeq !== attempt) return;
    const wsBase = this.homeUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    const url = `${wsBase}/ws?canvasId=${encodeURIComponent(link.canvasId)}&since=${since}&${CLIENT_FEATURES_PARAM}=${CURRENT_CLIENT_FEATURES}`;
    let socket;
    try {
      socket = new import_websocket.default(url, { headers: bearerHeader(badge) });
    } catch (err) {
      return gaveUp(err.message);
    }
    let failure = null;
    socket.on("error", (err) => {
      failure = err.message;
    });
    if (link.closed || link.dialSeq !== attempt) {
      socket.terminate();
      return;
    }
    link.socket = socket;
    socket.on("open", () => {
      link.dialledAt = null;
      this.scheduleRelay(link.canvasId);
    });
    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      link.work = link.work.then(() => this.receive(link, since, message)).catch(() => {
      });
    });
    socket.on("close", (code, reason) => {
      if (link.socket !== socket) return;
      link.socket = null;
      link.dialledAt = null;
      this.presence.mirror(link.canvasId, this.origin(), []);
      if (code === WS_NOT_ADMITTED) {
        const takenDown = String(reason) === TAKEN_DOWN;
        const why = takenDown ? `the home has taken ${link.canvasId} down (${WS_NOT_ADMITTED} ${TAKEN_DOWN}); your copy is on this machine` : String(reason) === WITHDRAWN ? `the home withdrew this machine's access to ${link.canvasId} (${WS_NOT_ADMITTED} ${WITHDRAWN})` : `the home does not admit this machine to ${link.canvasId} (${WS_NOT_ADMITTED})`;
        const health = this.healthOf(link.canvasId);
        health.failures += 1;
        health.attemptedAt = Date.now();
        health.lastFailure = why;
        health.refused = true;
        if (takenDown) void this.askTakedown(link.canvasId);
        if (!health.complained) {
          health.complained = true;
          console.error(
            `[isocan] ${this.homeUrl}: ${why} \u2014 this canvas is not redialled; ` + (takenDown ? "ops written here stay here, and nothing on this machine has been erased. `isocan status` says so." : "ops written here stay here until an owner lets this machine back in. `isocan home` shows this per canvas.")
          );
        }
        link.closed = true;
        this.links.delete(link.canvasId);
        return;
      }
      if (code === WS_NO_CANVAS) {
        this.noteFailure(
          link.canvasId,
          `the home says it has no canvas ${link.canvasId} (${WS_NO_CANVAS})`
        );
        link.closed = true;
        this.links.delete(link.canvasId);
        return;
      }
      if (code === WS_BEHIND) {
        link.backoffMs = RECONNECT_MIN_MS;
        this.reconnect(link);
        return;
      }
      this.noteFailure(
        link.canvasId,
        failure ?? (link.carried ? `the socket closed (${code})` : `the socket closed before the home said hello (${code})`)
      );
      this.reconnect(link);
    });
  }
  /**
   * The seq this replica actually holds for a canvas — 0 when it holds none of
   * it, which is what asks for a snapshot.
   *
   * `settled()` first, and it is not a nicety. A forwarded write holds the
   * single-writer chain across its round trip to the home, so a canvas can be
   * created AT THE HOME while this daemon is one line from writing it down.
   * Reading the store in that window answered "I have nothing" about a canvas
   * we were in the middle of making — the home dutifully sent a snapshot, and
   * the replica adopted it over the entry it was about to land, losing seq 1
   * from its own log. A cursor has to be a fact.
   *
   * THIS canvas's queue, not every queue: the write that makes the window is
   * a write to the canvas being dialled, and waiting on the whole daemon is
   * how one canvas's slow home once left every dial on the machine unfinished.
   */
  async localSeq(canvasId) {
    try {
      await this.engine.settled(canvasId);
      return (await this.engine.getSnapshot(canvasId)).lastSeq;
    } catch {
      return 0;
    }
  }
  /**
   * One message from the home, applied here.
   *
   * The two hellos are the two halves of one contract and a client must handle
   * either: `resumed` means "keep what you have, here comes the evening",
   * `snapshot` means "what you have cannot be caught up from my live log —
   * take this instead". Treating the fallback as a failure is the misreading
   * `protocol.ts` warns about.
   */
  async receive(link, since, message) {
    const { canvasId } = link;
    switch (message.type) {
      case "resumed":
        this.carrying(link);
        this.hello({ canvasId, type: "resumed", since, lastSeq: message.lastSeq });
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "snapshot":
        this.carrying(link);
        this.hello({ canvasId, type: "snapshot", since, lastSeq: message.lastSeq });
        await this.engine.adoptRemoteSnapshot(canvasId, message);
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      case "op-applied": {
        const applied = await this.engine.applyRemote(canvasId, message.entry);
        if (applied === "gap") this.resync(link);
        return;
      }
      case "canvas-deleted":
        await this.engine.applyRemoteDelete(canvasId);
        link.closed = true;
        this.links.delete(canvasId);
        this.closeLink(link);
        return;
      /**
       * "Someone at the canvas asked to add an agent" (agent-custody
       * mechanism 2), routed here because this link's `rc-relay` said an rc
       * is parked behind it. Handed to the local hold registry: the parked
       * rc's open `/api/rc/hold` carries it the last hop, and the rc makes
       * the same moves `isocan agent add` makes. An ask with nobody parked
       * any more dies in the registry's short queue — the dialog that sent
       * it is already counting down to say nothing answered.
       */
      case "rc-ask": {
        if (this.rc) {
          this.rc.ask(canvasId, {
            askId: message.askId,
            name: message.name,
            from: message.from,
            // Re-read, not trusted: the home that relayed it read it once too.
            ...(() => {
              const t = askTemplate(message);
              return "error" in t ? {} : t;
            })()
          });
        }
        return;
      }
      case "presence-roster": {
        const ours = new Set(
          this.presence.localRoster(canvasId).map((session) => session.sessionId)
        );
        this.presence.mirror(
          canvasId,
          this.origin(),
          message.sessions.filter((session) => !ours.has(session.sessionId))
        );
        await this.engine.mergeRemoteIdentity(message.colors, message.names);
        return;
      }
    }
  }
  /** This socket is carrying its canvas — the home has answered for it. */
  carrying(link) {
    if (link.carried) return;
    link.carried = true;
    link.backoffMs = RECONNECT_MIN_MS;
    this.noteCarrying(link.canvasId);
  }
  hello(hello) {
    const log = this.handshakeLog.get(hello.canvasId) ?? {
      resumed: 0,
      snapshots: 0,
      last: null
    };
    if (hello.type === "resumed") log.resumed += 1;
    else log.snapshots += 1;
    log.last = hello;
    this.handshakeLog.set(hello.canvasId, log);
  }
  /** How this canvas's socket has been answered, every time it has connected.
   * Never absent for a canvas that has connected; zeroes for one that has
   * not. */
  handshakes(canvasId) {
    return this.handshakeLog.get(canvasId) ?? { resumed: 0, snapshots: 0, last: null };
  }
  // ---- is this canvas's socket actually carrying anything ----
  healthOf(canvasId) {
    let health = this.health.get(canvasId);
    if (!health) {
      health = {
        opens: 0,
        connectedAt: null,
        relayedAt: null,
        facesRelayed: 0,
        failures: 0,
        attemptedAt: null,
        lastFailure: null,
        complained: false
      };
      this.health.set(canvasId, health);
    }
    return health;
  }
  /**
   * **Ask the home what it says about the canvas it just refused.**
   *
   * Best-effort and fire-and-forget: a home that cannot answer leaves `isocan
   * status` saying what the close frame said, which is true and shorter. It is
   * a public read — `/api/takedowns?canvas=…` answers anybody about one canvas
   * — so it needs nothing this link does not already carry, and it is asked
   * once per refusal rather than per poll, because the refusal drops the link.
   */
  async askTakedown(canvasId) {
    const answer = await this.api(
      "GET",
      `${TAKEDOWNS_ROUTE}?canvas=${encodeURIComponent(canvasId)}`
    ).catch(() => null);
    const notice = answer?.takedowns.find((row) => row.canvasId === canvasId);
    if (notice) this.healthOf(canvasId).takenDown = notice;
  }
  /**
   * **The home said hello for this canvas**, which is the first moment it is
   * true that this link carries anything.
   *
   * Not the socket's `open` event, and the difference is the whole of a real
   * failure mode: a home that has never heard of a canvas ACCEPTS the upgrade
   * and then closes with 4404. Counting that as a success reset the failure
   * count on every attempt, so a canvas being refused several times a second
   * forever reported itself as healthy — a link in perfect health that had
   * never once carried a face.
   *
   * If it had complained, say that it came back: a line that announces trouble
   * and never announces the end of it is how a log teaches people to distrust
   * it.
   */
  noteCarrying(canvasId) {
    const health = this.healthOf(canvasId);
    health.opens += 1;
    health.connectedAt = (/* @__PURE__ */ new Date()).toISOString();
    health.failures = 0;
    health.lastFailure = null;
    delete health.refused;
    delete health.takenDown;
    if (health.complained) {
      health.complained = false;
      console.error(`[isocan] ${this.homeUrl} is carrying ${canvasId} again`);
    }
  }
  /**
   * An attempt ended without a working socket.
   *
   * **The one place this path is no longer silent.** Every failure here used
   * to be discarded — the `error` listener is empty by necessity (an
   * unhandled one takes the daemon down), `reconnect` backs off without a
   * word, and a 4404 close drops the link for the next sweep to re-make. A
   * canvas could be re-dialled every two seconds for an hour and the only
   * evidence anywhere was a face that never appeared on somebody else's
   * screen.
   */
  noteFailure(canvasId, why) {
    const health = this.healthOf(canvasId);
    health.failures += 1;
    health.attemptedAt = Date.now();
    health.lastFailure = why;
    if (health.complained || health.failures < COMPLAIN_AFTER_FAILURES) return;
    health.complained = true;
    console.error(
      `[isocan] ${this.homeUrl} has not carried ${canvasId} for ${health.failures} attempts (${why}) \u2014 ${health.opens === 0 ? "it has never connected, so nobody here" : "nobody here"} is visible on that canvas, and ops written there are not arriving. \`isocan home\` shows this per canvas.`
    );
  }
  /** Per canvas, for `GET /api/homes`. Every canvas this link is holding OR
   * has ever held: a canvas whose link was dropped by a 4404 is exactly the
   * one somebody is trying to ask about. */
  canvasStates() {
    const ids = /* @__PURE__ */ new Set([...this.links.keys(), ...this.health.keys()]);
    return [...ids].sort().map((canvasId) => {
      const health = this.healthOf(canvasId);
      const link = this.links.get(canvasId);
      return {
        canvasId,
        // Upgraded AND answered for. A socket the home is about to refuse is
        // open for a few milliseconds; reporting that as connected would put
        // the word "live" next to the exact canvas somebody is asking about.
        connected: link?.socket?.readyState === import_websocket.default.OPEN && link.carried,
        opens: health.opens,
        connectedAt: health.connectedAt,
        relayedAt: health.relayedAt,
        facesRelayed: health.facesRelayed,
        failures: health.failures,
        lastFailure: health.lastFailure,
        // Present only for a canvas the home has taken down, and carrying
        // the home's own sentence — journey 4 step 4's `isocan status`.
        ...health.takenDown ? { takenDown: health.takenDown } : {}
      };
    });
  }
  resync(link) {
    const socket = link.socket;
    link.socket = null;
    socket?.terminate();
    link.backoffMs = RECONNECT_MIN_MS;
    this.reconnect(link);
  }
  // ---- presence, going up ----
  scheduleRelay(canvasId) {
    const link = this.links.get(canvasId);
    if (!link || link.relay) return;
    link.relay = setTimeout(() => {
      link.relay = null;
      void this.relay(link).catch(() => {
      });
    }, RELAY_COALESCE_MS);
    link.relay.unref?.();
  }
  /**
   * This machine's faces, up to the home, in one message.
   *
   * One connection carrying several actors is exactly the case mechanism 1
   * drew the badge for — "Priya's daemon carries one connection on behalf of
   * her CLI self AND Isaac, so its badge must vouch for both" — so every actor
   * in the roster is claimed first. Skipping that is not a subtle failure: the
   * home runs `requireActor` on each relayed session and silently DROPS the
   * ones it cannot vouch for, which shows up as faces that never go up.
   */
  async relay(link) {
    const socket = link.socket;
    if (!socket || socket.readyState !== import_websocket.default.OPEN) return;
    const sessions = this.presence.localRoster(link.canvasId);
    const vouched = [];
    for (const session of sessions) {
      const ok = await this.ensureClaim(session.actor).then(
        () => true,
        (err) => {
          const key = `${link.canvasId}\0${session.actor.id}`;
          if (!this.unvouched.has(key)) {
            this.unvouched.add(key);
            console.error(
              `[isocan] ${this.homeUrl} will not vouch for ${session.actor.name} (${session.actor.id}): ${err.message} \u2014 their face stays off ${link.canvasId} until it does`
            );
          }
          return false;
        }
      );
      if (ok) {
        this.unvouched.delete(`${link.canvasId}\0${session.actor.id}`);
        vouched.push(session);
      }
    }
    if (socket.readyState !== import_websocket.default.OPEN) return;
    socket.send(JSON.stringify({ type: "presence-relay", sessions: vouched }));
    const health = this.healthOf(link.canvasId);
    health.relayedAt = (/* @__PURE__ */ new Date()).toISOString();
    health.facesRelayed = vouched.length;
    if (this.rc) {
      const local = this.rc.answeringLocal(link.canvasId);
      const agents = (await this.engine.getSnapshot(link.canvasId).catch(() => null))?.canvas.agents ?? {};
      const answerable = [];
      for (const actorId of local.actorIds) {
        const record = agents[actorId];
        if (!record) continue;
        const key = `${link.canvasId}\0${actorId}`;
        const ok = await this.ensureClaim(record.actor).then(
          () => true,
          (err) => {
            if (!this.unvouched.has(key)) {
              this.unvouched.add(key);
              console.error(
                `[isocan] ${this.homeUrl} will not vouch for ${record.actor.name} (${actorId}): ${err.message} \u2014 they stay unanswerable at the home until it does`
              );
            }
            return false;
          }
        );
        if (!ok) continue;
        this.unvouched.delete(key);
        answerable.push(actorId);
      }
      const owners = [];
      for (const owner of local.owners) {
        const key = `${link.canvasId} owner ${owner.id}`;
        const ok = await this.ensureClaim(owner).then(
          () => true,
          (err) => {
            if (!this.unvouched.has(key)) {
              this.unvouched.add(key);
              console.error(
                `[isocan] ${this.homeUrl} will not vouch for ${owner.name} (${owner.id}): ${err.message} \u2014 whose word their rc takes goes unsaid at the home until it does`
              );
            }
            return false;
          }
        );
        if (!ok) continue;
        this.unvouched.delete(key);
        owners.push(owner);
      }
      const policies = {};
      for (const actorId of answerable) {
        const policy = local.policies[actorId];
        if (policy && owners.some((o) => o.id === policy.owner.id)) policies[actorId] = policy;
      }
      if (socket.readyState === import_websocket.default.OPEN) {
        socket.send(
          JSON.stringify({ type: "rc-relay", parked: local.parked, actorIds: answerable, owners, policies })
        );
      }
    }
  }
  // ---- the badge, and the claims that ride on it ----
  /**
   * The badge this link presents, fetched at most once even when several
   * callers want it at the same instant.
   *
   * **Measured, phase 10.3.** This used to be two awaits with no gate, and it
   * was safe by accident: a link's `start()` was awaited at boot, before the
   * port was bound, so the first `ensureBadge` always ran alone. Under many
   * homes a link is created LAZILY, by the very write that needs it, and its
   * sweep starts in the background at the same moment — so two callers reached
   * the two awaits together, both saw no badge, and both knocked. The door
   * mints a badge per knock, so the daemon ended up holding two: `ensureClaim`
   * put the actor on one, the forwarded op presented the other, and the home
   * answered `not-your-actor` about an actor this machine had just claimed.
   *
   * It reproduced roughly one run in three and it is exactly the shape a
   * comment would have argued was impossible. The gate is the same one
   * `ensureClaim` next door already uses, for the same reason.
   */
  badging = null;
  ensureBadge() {
    if (this.badge) return Promise.resolve(this.badge);
    if (this.badging) return this.badging;
    this.badging = (async () => {
      const stored = await readBadge(this.home, this.homeUrl);
      if (stored) {
        this.badge = stored;
        return stored;
      }
      return this.reBadge();
    })().finally(() => {
      this.badging = null;
    });
    return this.badging;
  }
  async reBadge() {
    const badge = await knockOnDoor(this.homeUrl);
    if (!badge) return null;
    this.badge = badge;
    await writeBadge(this.home, this.homeUrl, badge);
    this.claimed.clear();
    return badge;
  }
  /**
   * Make this daemon's badge at the home vouch for one actor.
   *
   * **Where a local claim becomes a claim at the home**, and the choice is
   * `as` under a session key that belongs to the connection —
   * `replica:<actorId>` — rather than the local client's own key. Two reasons,
   * both mechanism 5's:
   *
   * - A `sessionKey` is "a client's local index for finding its own stored
   *   badge, never something the home trusts". The local keys are the LOCAL
   *   daemon's business — they are how it verifies session-level — and
   *   re-keying them at the home would be this hop claiming to see what only
   *   the hop below it can.
   * - `as` is the right verb because actor ids are global and travel untouched
   *   (mechanism 10, and offline-birth's "actor ids travel untouched"). The
   *   home must end up holding the SAME actor, not a namesake.
   *
   * The name rides along so the home can bring in an actor it has never heard
   * of: `reincarnate` refuses an unknown `as` with no name, and every actor
   * born on a replica is unknown at the home the first time.
   *
   * **The seam this leaves, named rather than smoothed:** if that actor is
   * already claimed at the home by ANOTHER badge within the last half hour —
   * most plausibly the same person's browser tab, which claimed them at the
   * one origin — the home refuses with `name-taken`, correctly, because two
   * badges holding one actor is what a PASS is for (mechanism 1's "Jordan's
   * tab and her daemon"). The refusal is surfaced with the home's own words
   * rather than swallowed.
   *
   * **Phase 8 built the pass, and the seam narrowed rather than closed** —
   * which is the design's answer, not a shortfall. A machine whose person is
   * already somebody at the home enrols by REDEEMING a pass minted from the
   * surface that is her (`redeemPass`, below); after that the home's badge
   * holds the claim outright and this call has nothing left to ask. What is
   * still refused is the thing that should be: announcing your way into an
   * identity somebody else is currently wearing, with nobody vouching. "First
   * surface versus every later surface of the same person" is exactly how
   * mechanism 1 puts it.
   */
  announceActor(actor) {
    return this.ensureClaim(actor).catch((err) => {
      if (this.stopped) return;
      console.error(
        `[isocan] the home would not vouch for ${actor.name} (${actor.id}): ` + err.message
      );
    });
  }
  /**
   * "What name is free where this is going to land?"
   *
   * No claim goes up first, and there is nothing to cache: the answer is about
   * a namespace other machines are also writing to, and a remembered one would
   * be a reservation this link is in no position to hold. The engine treats
   * what comes back as a preference and re-checks it locally, so a stale answer
   * is cheap and an unreachable home costs nothing at all.
   */
  async freeName() {
    const { name } = await this.api("GET", FREE_NAME_ROUTE);
    if (!name) throw new HomeRefusedError(200, "the home named no free name");
    return name;
  }
  ensureClaim(actor) {
    const key = `${actor.id}\0${actor.name}`;
    if (this.claimed.has(key)) return Promise.resolve();
    const inflight = this.claiming.get(key);
    if (inflight) return inflight;
    const work = this.api("POST", "/api/ops", {
      canvasId: null,
      op: {
        type: "actor.claim",
        sessionKey: `replica:${actor.id}`,
        as: actor.id,
        name: actor.name
      }
    }).then(() => {
      this.claimed.add(key);
    }).finally(() => {
      this.claiming.delete(key);
    });
    this.claiming.set(key, work);
    return work;
  }
  async personalRequest(method, path11, body, actor, context, clientFeatures) {
    if (actor) await abortable(this.ensureClaim(actor), context?.signal);
    return this.api(method, path11, body, context?.signal, context, clientFeatures);
  }
  async sourceRequest(method, path11, body, headers, actor, context) {
    context.signal?.throwIfAborted();
    if (actor) await abortable(this.ensureClaim(actor), context.signal);
    const badge = await abortable(this.ensureBadge(), context.signal);
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "the door did not answer");
    const send = (held) => this.fetchHome(path11, {
      method,
      ...context.signal ? { signal: context.signal } : {},
      headers: { [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES, ...headers, ...bearerHeader(held), [SOURCE_POLICY_HEADER]: sourcePolicyHeader(context) },
      ...body === void 0 ? {} : { body: Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body) }
    });
    let response = await send(badge);
    if (response.status === 401) {
      const refusal = await response.clone().json().catch(() => null);
      if (refusal?.reason !== "operator") {
        const fresh2 = await abortable(this.reBadge(), context.signal);
        if (fresh2) response = await send(fresh2);
      }
    }
    return response;
  }
  // ---- HomeConnection: writes, forwarded ----
  async submitOp(body) {
    if (body.actor) await this.ensureClaim(body.actor);
    return this.api("POST", "/api/ops", body);
  }
  groupMigrationPreview(canvasId) {
    return this.api("GET", `/api/projects/${encodeURIComponent(canvasId)}/groups/migration`);
  }
  /** Who may enter this canvas, as the HOME has it. No claim goes up first:
   * a grant is about badges, never about actors. */
  grants(canvasId) {
    return this.api("GET", grantsRoute(canvasId));
  }
  rcAnswering(canvasId) {
    return this.api("GET", rcAnsweringRoute(canvasId));
  }
  rcRelease(canvasId) {
    return this.api("POST", "/api/rc/release", { canvasId });
  }
  async rcAsk(canvasId, body) {
    await this.ensureClaim(body.from);
    return this.api("POST", rcAskRoute(canvasId), body);
  }
  async setPublicListing(canvasId, grantId, listed, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("PUT", publicListingRoute(canvasId, grantId), {
      listed,
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async createGrant(canvasId, subject, capability, actor, bars) {
    if (actor) await this.ensureClaim(actor);
    return this.api("POST", grantsRoute(canvasId), {
      subject,
      // Forwarded whenever it is not edit (`narrowed`), so an older home never
      // sees the field for the one value it has always meant by omission —
      // and refuses, with `bad-grant`, a rung it does not know. A bar is
      // forwarded the same way: `bars: true` or nothing, and a home from
      // before bars refuses the field it does not know.
      ...narrowed(capability) ? { capability } : {},
      ...bars ? { bars: true } : {},
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async revokeGrant(canvasId, grantId, actor, bar) {
    if (actor) await this.ensureClaim(actor);
    return this.api(
      "DELETE",
      grantRevokeRoute(canvasId, grantId, { ...actor ? { actorId: actor.id } : {}, ...bar ? { bar } : {} })
    );
  }
  /** Your surfaces AT THE HOME. This daemon's own badge there is one of them
   * and comes back marked `self` — so `isocan badges` run on a laptop shows
   * that laptop's row as the one it is standing on, which is exactly what a
   * person needs to see before they end the other one. */
  attestOffer() {
    return this.api("GET", ATTEST_ROUTE);
  }
  attest(body) {
    return this.api("POST", ATTEST_ROUTE, body);
  }
  badges() {
    return this.api("GET", BADGES_ROUTE);
  }
  killBadge(badgeId) {
    return this.api("DELETE", badgeRoute(badgeId));
  }
  // ---- the seen routes, forwarded (#147, #134) ----
  //
  // The claim goes up before either call, read included, and that is the one
  // place these differ from the space routes: a read of somebody's own marks
  // is scoped to the actors the home's copy of this badge claims, so a badge
  // that has never introduced this person up there would be handed an empty
  // ledger rather than theirs.
  async inbox(canvasId, actor, label, signal) {
    signal?.throwIfAborted();
    await abortable(this.ensureClaim(actor), signal);
    signal?.throwIfAborted();
    return abortable(this.api("GET", inboxRoute(actor.id, { canvasId, ...label !== void 0 ? { label } : {} }), void 0, signal), signal);
  }
  async seen(actor, canvasId, signal) {
    signal?.throwIfAborted();
    if (actor) await abortable(this.ensureClaim(actor), signal);
    signal?.throwIfAborted();
    return abortable(this.api("GET", seenMarksRoute(actor?.id, canvasId), void 0, signal), signal);
  }
  async markSeen(canvasId, seq, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("PUT", seenRoute(canvasId), {
      seq,
      ...actor ? { actorId: actor.id } : {}
    });
  }
  // ---- the space routes, forwarded (roles phase 4) ----
  //
  // The claim goes up before every write, as it does before a grant write:
  // the home checks the actor is among this badge's claims and then asks
  // `own` of that person. Reads carry nothing — a space is about badges.
  spaces() {
    return this.api("GET", SPACES_ROUTE);
  }
  async createSpace(name, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("POST", SPACES_ROUTE, {
      name,
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async deleteSpace(spaceId, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("DELETE", spaceActingRoute(spaceRoute(spaceId), actor?.id));
  }
  async addToSpace(spaceId, canvasId, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("PUT", spaceCanvasRoute(spaceId, canvasId), {
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async removeFromSpace(spaceId, canvasId, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api(
      "DELETE",
      spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actor?.id)
    );
  }
  spaceGrants(spaceId) {
    return this.api("GET", spaceGrantsRoute(spaceId));
  }
  async createSpaceGrant(spaceId, subject, capability, actor, bars) {
    if (actor) await this.ensureClaim(actor);
    return this.api("POST", spaceGrantsRoute(spaceId), {
      subject,
      ...narrowed(capability) ? { capability } : {},
      ...bars ? { bars: true } : {},
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async revokeSpaceGrant(spaceId, grantId, actor, bar) {
    if (actor) await this.ensureClaim(actor);
    return this.api(
      "DELETE",
      spaceGrantRevokeRoute(spaceId, grantId, { ...actor ? { actorId: actor.id } : {}, ...bar ? { bar } : {} })
    );
  }
  async setSpaceLink(spaceId, capability, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("POST", spaceLinkRoute(spaceId), {
      capability,
      ...actor ? { actorId: actor.id } : {}
    });
  }
  // ---- the group routes, forwarded (roles phase 5) ----
  groups() {
    return this.api("GET", GROUPS_ROUTE);
  }
  async createGroup(name, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("POST", GROUPS_ROUTE, {
      name,
      ...actor ? { actorId: actor.id } : {}
    });
  }
  group(groupId) {
    return this.api("GET", groupRoute(groupId));
  }
  async addGroupMember(groupId, attribute, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("PUT", groupMemberRoute(groupId, attribute), {
      ...actor ? { actorId: actor.id } : {}
    });
  }
  async removeGroupMember(groupId, attribute, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api(
      "DELETE",
      groupActingRoute(groupMemberRoute(groupId, attribute), actor?.id)
    );
  }
  async deleteGroup(groupId, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api("DELETE", groupActingRoute(groupRoute(groupId), actor?.id));
  }
  /**
   * Mint a pass at the home, on this daemon's badge.
   *
   * The claim goes up first, exactly as it does before a forwarded write: the
   * home refuses to endow a pass with an actor the presenting badge does not
   * hold, and the badge that presents here is this daemon's one badge at the
   * home rather than the local CLI's. That is mechanism 5's split doing its
   * job — the local daemon already checked that the asking process may speak
   * as this actor, which the home could never know, and the home checks that
   * this machine may, which is all it can honestly see.
   */
  async mintPass(canvasId, actor) {
    if (actor) await this.ensureClaim(actor);
    return this.api(
      "POST",
      passesRoute(canvasId),
      actor ? { actorId: actor.id } : {}
    );
  }
  /** Read one back at the home, on the badge that minted it there. */
  pass(canvasId, passId) {
    return this.api("GET", passRoute(canvasId, passId));
  }
  /**
   * Redeem one at the home, on this daemon's badge — the enrolling half of
   * Scene 5, from the new machine's end.
   *
   * Two things happen here that are easy to miss, and both are the point:
   *
   * - **This badge comes back admitted at the home**, so the canvas now
   *   appears in `GET /api/projects` for it and the next sweep dials it. That
   *   is how a replica stops discovering canvases by enumerating a home and
   *   starts replicating the ones it was actually let into — phase 7's open
   *   question, answered by the mechanism phase 7 said would answer it.
   * - **The vouch cache is primed rather than left to be discovered.** The
   *   home has just written this actor onto this badge's claims, so
   *   `ensureClaim` has nothing to do; without priming it, the first forwarded
   *   write would spend a round trip re-claiming an actor the badge already
   *   holds. (It would also *succeed* — `reincarnate` lets a badge re-key an
   *   actor it already claims, which phase 8 had to make true anyway, because
   *   after a pass there are legitimately two badges holding one actor and the
   *   other one is a live tab.) A re-badge clears this cache along with
   *   everything else, which is correct: a badge that had to go back to the
   *   door is a different holder, and it holds nothing.
   *
   * A sweep is kicked immediately rather than waiting out the poll interval:
   * the person at the terminal has just typed the enrolling command, and the
   * next thing they expect is their canvas.
   */
  async redeemPass(token) {
    const answer = await this.api("POST", PASS_REDEEM_ROUTE, { token });
    if (answer.actor) this.claimed.add(`${answer.actor.id}\0${answer.actor.name}`);
    void this.sync().catch(() => {
    });
    return answer;
  }
  /**
   * One canvas, asked for by name — the arrival that carries an address and no
   * admission (`HOME_JOIN_ROUTE` says which arrivals those are).
   *
   * **It is an ordinary read, and that is the point.** `GET
   * /api/projects/:id` is a canvas-scoped route, so at the home it passes
   * through the same `admit` hook every other canvas-scoped route does: if a
   * grant admits this badge, the hook writes the admission (`{root: "grant"}`,
   * the provenance phase 9's sweep walks) before the route answers, and if
   * nothing admits it the answer is the door's own 403 — passed back through
   * `HomeRefusedError` with the home's status and code intact, so the person
   * who pasted an address to a canvas whose link is off is TOLD that, rather
   * than watching an empty replica and guessing.
   *
   * Nothing here writes an admission itself, and nothing here decides
   * anything. A replica that granted itself entry to its home's canvases would
   * be a laptop answering a door it does not own.
   *
   * Dialling the socket would ALSO admit — it is how a replica has always got
   * its admissions — but a socket's refusal is a close code arriving some
   * milliseconds later on a connection nobody is awaiting, and the caller here
   * is a person at a terminal waiting for a sentence. So the asking is done
   * with the request that can be answered synchronously, and the sweep kicked
   * below (for `redeemPass`'s reason: somebody just typed the command) opens
   * the socket.
   */
  async join(canvasId, actor, context) {
    await this.classifyReplica(canvasId);
    const canvas = await this.personalRequest(
      "GET",
      `/api/projects/${encodeURIComponent(canvasId)}`,
      void 0,
      actor,
      context
    );
    void this.sync().catch(() => {
    });
    return canvas;
  }
  async undo(canvasId, body) {
    await this.ensureClaim(body.actor);
    return this.api("POST", `/api/projects/${canvasId}/undo`, body);
  }
  async redo(canvasId, body) {
    await this.ensureClaim(body.actor);
    return this.api("POST", `/api/projects/${canvasId}/redo`, body);
  }
  /**
   * Bytes follow the ops that name them.
   *
   * A blob is not an `Operation` — but `item.add` carries a `blobHash`, and an
   * op whose bytes stayed on one laptop is an item that renders as a broken
   * version everywhere else, including in the browser tab that is the whole
   * point of having a home. So an upload on a replica goes to the home FIRST
   * (it is the authority, and its refusal is the one that matters) and the
   * local store keeps its own copy after — Scene 4's "and in Priya's
   * `~/.isocan` by hash" is the local half, and it is not optional either: an
   * agent's hands are the filesystem.
   */
  async putBlob(canvasId, data, meta) {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "no badge");
    const send = async (held) => this.fetchHome(`/api/projects/${canvasId}/blobs`, {
      method: "POST",
      headers: {
        ...bearerHeader(held),
        "Content-Type": meta.mimeType,
        [FILENAME_HEADER]: encodeFilename(meta.filename)
      },
      body: new Uint8Array(data)
    });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh2 = await this.reBadge();
      if (fresh2) res = await send(fresh2);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json;
  }
  async adopt(canvasId, entries) {
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "no badge");
    const send = async (held) => this.fetchHome(`/api/projects/${canvasId}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES, ...bearerHeader(held) },
      body: JSON.stringify({ entries })
    });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh2 = await this.reBadge();
      if (fresh2) res = await send(fresh2);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json;
  }
  async hasBlob(canvasId, blobHash) {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    try {
      const res = await this.fetchHome(`/api/projects/${canvasId}/blobs/${blobHash}`, {
        method: "HEAD",
        headers: { ...bearerHeader(badge) }
      });
      if (res.status === 404) return false;
      if (!res.ok) return null;
      return true;
    } catch {
      return null;
    }
  }
  /**
   * When this home last said it has no `BLOBS_PRESENT_ROUTE`. Remembered so
   * an older home is not asked the batch before every sweep's HEADs, and
   * forgotten after `BATCH_REPROBE_MS` so the deploy that adds the route is
   * noticed without a restart.
   */
  batchAbsentAt = null;
  async hasBlobs(canvasId, blobHashes) {
    const answers = /* @__PURE__ */ new Map();
    const unique = [...new Set(blobHashes)];
    if (unique.length === 0) return answers;
    const batchAbsent = this.batchAbsentAt !== null && Date.now() - this.batchAbsentAt < BATCH_REPROBE_MS;
    if (!batchAbsent) {
      for (let at = 0; at < unique.length; at += BLOBS_PRESENT_LIMIT) {
        const chunk = unique.slice(at, at + BLOBS_PRESENT_LIMIT);
        const missing = await this.askPresent(canvasId, chunk);
        if (missing === "no-route") {
          this.batchAbsentAt = Date.now();
          break;
        }
        if (missing === null) {
          for (const hash of unique) if (!answers.has(hash)) answers.set(hash, null);
          return answers;
        }
        const absent = new Set(missing);
        for (const hash of chunk) answers.set(hash, !absent.has(hash));
      }
      if (answers.size === unique.length) return answers;
    }
    for (const hash of unique) if (!answers.has(hash)) answers.set(hash, await this.hasBlob(canvasId, hash));
    return answers;
  }
  /** One ask of `BLOBS_PRESENT_ROUTE`: the missing hashes, `"no-route"` for a
   * home that predates it, or null for "could not ask". */
  async askPresent(canvasId, hashes) {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    const send = (held) => this.fetchHome(blobsPresentRoute(canvasId), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearerHeader(held) },
      body: JSON.stringify({ hashes })
    });
    try {
      let res = await send(badge);
      if (res.status === 401) {
        const fresh2 = await this.reBadge();
        if (fresh2) res = await send(fresh2);
      }
      const json = await res.json().catch(() => null);
      if (res.ok) {
        const missing = json?.missing;
        return Array.isArray(missing) && missing.every((h) => typeof h === "string") ? missing : null;
      }
      if (res.status === 404 && json?.code === UNKNOWN_ROUTE || res.status === 405) return "no-route";
      if (res.status === 403 && json?.code === VIEW_ONLY) return "no-route";
      return null;
    } catch {
      return null;
    }
  }
  /** Bytes this replica has never held, streamed from the home. What makes an
   * item somebody else added on another machine openable here. */
  async openBlob(canvasId, blobHash, range) {
    const badge = await this.ensureBadge();
    if (!badge) return null;
    const headers = { ...bearerHeader(badge) };
    if (range) headers.Range = `bytes=${range.start}-${range.end}`;
    let res;
    try {
      res = await this.fetchHome(`/api/projects/${canvasId}/blobs/${blobHash}`, { headers });
    } catch {
      return null;
    }
    if (!res.ok || !res.body) return null;
    const size = Number(res.headers.get("content-length") ?? "0");
    return {
      stream: Readable.fromWeb(res.body),
      mimeType: res.headers.get("content-type") ?? "application/octet-stream",
      size
    };
  }
  // ---- the plumbing under all of the above ----
  /**
   * One JSON call at the home, with the badge, healing a 401 exactly once.
   *
   * The recovery is `DaemonClient`'s in shape and deliberately not shared with
   * it: what a holder DOES about a refusal is policy (the CLI re-claims the
   * identity the command speaks as; this re-claims everyone the daemon relays
   * for), while what a badge IS and where it is kept is mechanism — and it is
   * the mechanism that lives in one place, `badge-store.ts`, because two
   * answers to "which credential is in that file" on one machine is the
   * divergence house rule 4 forbids.
   */
  async api(method, path11, body, signal, context, clientFeatures = CURRENT_CLIENT_FEATURES) {
    signal = context?.signal ? AbortSignal.any([context.signal, ...signal ? [signal] : []]) : signal;
    signal?.throwIfAborted();
    const badge = await this.ensureBadge();
    if (!badge) throw new HomeUnreachableError(this.homeUrl, "the door did not answer");
    const send = async (held) => this.fetchHome(path11, {
      method,
      ...signal ? { signal } : {},
      headers: {
        [CLIENT_FEATURES_HEADER]: clientFeatures,
        ...context ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader(context) } : {},
        ...bearerHeader(held),
        ...body !== void 0 ? { "Content-Type": "application/json" } : {}
      },
      ...body !== void 0 ? { body: JSON.stringify(body) } : {}
    });
    let res = await send(badge);
    if (res.status === 401) {
      const fresh2 = await this.reBadge();
      if (fresh2) res = await send(fresh2);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new HomeRefusedError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    }
    return json;
  }
  /**
   * Every HTTP call to the home goes through here, so "the home is down" has
   * one spelling and one message naming the address.
   *
   * Two signals, not one: the timeout, and this link's own shutdown. A daemon
   * closing while a forwarded write is in flight would otherwise wait out the
   * full timeout before its process could exit — the same class of "a socket
   * left open is a process that never exits" that phase 4 paid for once.
   */
  async fetchHome(path11, init) {
    try {
      return await fetch(`${this.homeUrl}${path11}`, {
        ...init,
        signal: AbortSignal.any([this.aborter.signal, AbortSignal.timeout(3e4), ...init.signal ? [init.signal] : []])
      });
    } catch (err) {
      throw new HomeUnreachableError(this.homeUrl, err.message);
    }
  }
  /**
   * **Ask the home which build it is.** Auto-upgrade phase 2's one new
   * request, and the only one this class makes without a badge.
   *
   * The health routes are open by construction — they are the load balancer's
   * probe, and the door cannot ask for what it hands out — so this is a plain
   * `fetch` rather than `api()`. That matters beyond tidiness: a replica whose
   * badge has been swept can still find out that it is behind, which is
   * exactly the machine most likely to be.
   *
   * Every failure is the same answer, null, and null is silence downstream
   * rather than "you are current". A home too old to carry a `commit` reaches
   * here as `{ commit: null }` and is stored as such — the verdict is refused
   * one layer up, in `upgradeVerdict`, so that "the home could not say" and
   * "the home did not answer" stay one behaviour with one test.
   */
  async askBuild() {
    if (this.stopped) return;
    try {
      const res = await fetch(`${this.homeUrl}${healthPath(this.homeUrl)}`, {
        signal: AbortSignal.any([
          this.aborter.signal,
          AbortSignal.timeout(BUILD_PROBE_TIMEOUT_MS)
        ])
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      this.homeBuild = {
        url: this.homeUrl,
        // Re-gated at this end too. The home already applies `plausibleSha`
        // before it reports, so this is belt to that brace — but the value has
        // crossed a network from a machine this one does not control, and a
        // word arriving where a sha belongs must fall to null here rather than
        // be printed at a person as an identity.
        commit: plausibleSha(typeof body.commit === "string" ? body.commit : void 0),
        builtAt: typeof body.builtAt === "string" ? body.builtAt : null
      };
    } catch {
      this.homeBuild = null;
    }
  }
  /** The hourly beat. Unref'd, like every other timer here: a probe pending on
   * a home that went away must not be the reason a daemon will not exit. */
  scheduleProbe() {
    if (this.stopped) return;
    this.probe = setTimeout(() => {
      void this.askBuild().finally(() => this.scheduleProbe());
    }, this.probeMs);
    this.probe.unref?.();
  }
  /** Is the home answering at all? Uses `healthPath`, never a literal: against
   * a hosted home the bare `/healthz` is swallowed by Google's frontend and a
   * live home reads as dead (phase 5's finding). */
  async reachable(timeoutMs = 2e3) {
    try {
      const res = await fetch(`${this.homeUrl}${healthPath(this.homeUrl)}`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};
function abortable(work, signal) {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

// packages/server/src/homes.ts
import { promises as fs7 } from "node:fs";
async function readHomes(home) {
  let parsed;
  try {
    parsed = JSON.parse(await fs7.readFile(homesFile(home), "utf8"));
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const rows = {};
  for (const [canvasId, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim()) rows[canvasId] = normalizeHomeUrl(value);
    else rows[canvasId] = null;
  }
  return rows;
}
async function homesRecorded(home) {
  return fs7.stat(homesFile(home)).then(
    () => true,
    () => false
  );
}
async function writeHomes(home, rows) {
  await fs7.mkdir(home, { recursive: true });
  await writeFileAtomic(homesFile(home), `${JSON.stringify(rows, null, 2)}
`);
}

// packages/server/src/home-links.ts
var HomeLinks = class {
  /** The birth default, normalized. Null when a canvas born here stays here. */
  birthHome;
  options;
  rows = {};
  open = /* @__PURE__ */ new Map();
  /** Writes to `homes.json`, serialized. Two concurrent births would otherwise
   * both read the record, both add their row, and the second write would
   * erase the first — the same read-modify-write hazard `blobs.json` is on the
   * single-writer chain for. */
  writes = Promise.resolve();
  stopped = false;
  /** Which (canvas, home) disagreements have already been said out loud. A
   * sweep runs every couple of seconds forever; a contested canvas would
   * otherwise print a line per poll until somebody killed the daemon. */
  complained = /* @__PURE__ */ new Set();
  constructor(options) {
    this.options = options;
    this.birthHome = options.birthHome === null ? null : normalizeHomeUrl(options.birthHome);
  }
  /**
   * Read the record, open a link per distinct address, and start dialling.
   *
   * **The birth default gets a link even with zero canvases assigned to it**,
   * and that is a deliberate exception rather than an oversight. It costs a
   * badge fetch and a poll, and it dials nothing at all — its `wanted` set is
   * empty. What it buys is three things that would otherwise silently stop
   * working on a machine that has a home configured and has not yet made a
   * canvas there: `runDaemon`'s "home X is answering" boot line, `isocan
   * home`'s reachability report, and `Engine.preferredName`'s upward question,
   * which is the whole of phase 7.5's scope-mismatch fix.
   */
  /**
   * **Read the routing table. Dial nothing.**
   *
   * Split out of `start()` because the two halves want opposite timing, and
   * bundling them cost real bytes. Dialling must wait until the daemon is
   * serving — the first thing down a canvas socket is written through the
   * engine. But the TABLE must be loaded before the daemon answers anything,
   * because `homeOf` is how every write decides where it goes.
   *
   * While it was unloaded, every canvas looked homeless. `Engine.putBlob`
   * reads exactly this to decide whether to push bytes up
   * (`if (home) await home.putBlob(...)`), so an upload landing in that
   * window skipped the home SILENTLY while its `item.addVersion` replicated
   * normally — a teammate got the item, its title and its version, with no
   * bytes behind it and a "blob not found" where the screen should be. It
   * never repairs itself, because nothing ever notices.
   *
   * The window was small — between `listen` and this line — but the clients
   * most likely to be inside it are precisely the ones that reconnect the
   * instant the port opens: a parked agent resuming its lap, a browser tab
   * retrying. On a machine whose daemon restarts often (a dev watcher will
   * do it on every save) that is not a rare shape at all.
   */
  async load() {
    this.rows = await readHomes(this.options.home);
  }
  async start() {
    await this.load();
    const addresses = /* @__PURE__ */ new Set();
    for (const value of Object.values(this.rows)) if (value !== null) addresses.add(value);
    if (this.birthHome !== null) addresses.add(this.birthHome);
    await Promise.all([...addresses].map((address) => this.linkFor(address).start()));
  }
  /**
   * Shut every link down with the daemon.
   *
   * Where `homeLink.close()` used to be in `startDaemon` — before the store,
   * because a link is the one thing here that is still WRITING (an entry may
   * be mid-apply), and phase 4's finding already paid once for a socket left
   * open being a process that never exits.
   */
  async close() {
    this.stopped = true;
    const links = [...this.open.values()];
    this.open.clear();
    await Promise.allSettled(links.map((link) => link.close()));
    await this.writes.catch(() => {
    });
  }
  // ---- the record ----
  /** Where this canvas lives, as this machine has recorded it: a normalized
   * address, or null for "this daemon is its home". Absent and null are the
   * same answer — see `homes.ts` for why both spellings exist. */
  homeOf(canvasId) {
    return this.rows[canvasId] ?? null;
  }
  /** Every row, for `GET /api/homes`. A copy: the caller is a route handler
   * serializing it, and handing out the live object is how a reader becomes a
   * writer by accident. */
  assignments() {
    return { ...this.rows };
  }
  idsFor(homeUrl) {
    const key = normalizeHomeUrl(homeUrl);
    return Object.entries(this.rows).filter(([, value]) => value === key).map(([canvasId]) => canvasId);
  }
  /**
   * **The arbitration rule**, in the one place it is applied: a home has
   * offered this canvas in its admitted listing — may this link dial it?
   *
   * - **No row** → write one naming this home, and dial. This is how the sweep
   *   still discovers what a pass admitted, and what keeps `letBIn()` working:
   *   a machine let into a canvas it has never held learns where that canvas
   *   lives from the only party that could have told it.
   * - **The row names this home** → dial. The ordinary case.
   * - **The row names a DIFFERENT home, or `null`** → do not dial, and say so
   *   once, loudly, naming both addresses and the id.
   *
   * That third branch is the one worth arguing about, and the argument is that
   * **two homes claiming one canvas id is the twin case**, which is phase 13's
   * (adoption and re-homing) and which cannot be resolved by a poll. Silently
   * adopting either one is the worst available outcome: the loser's work is
   * overwritten by `adoptRemoteSnapshot` and nothing anywhere says so.
   *
   * **A log line, not a throw.** A sweep must not die of this — the other
   * canvases at this home are innocent, and a link that stopped sweeping would
   * turn one contested id into a whole home going quiet.
   */
  async mayDial(canvasId, homeUrl) {
    const key = normalizeHomeUrl(homeUrl);
    const row = this.rows[canvasId];
    if (row === void 0) {
      await this.record(canvasId, key);
      return true;
    }
    if (row === key) return true;
    const said = `${canvasId}\0${key}`;
    if (!this.complained.has(said)) {
      this.complained.add(said);
      console.error(
        `[isocan] ${key} offers ${canvasId}, but this machine has recorded that canvas as ${row === null ? "local (this daemon is its home)" : `living at ${row}`} \u2014 not dialling it. Two homes holding one canvas id is a twin, and moving a canvas between homes is a deliberate act (re-homing), never something a poll does.`
      );
    }
    return false;
  }
  /** One row, written through the serialized chain. */
  record(canvasId, homeUrl) {
    return this.enqueue(async () => {
      if (this.rows[canvasId] === homeUrl && canvasId in this.rows) return;
      this.rows = { ...this.rows, [canvasId]: homeUrl };
      await writeHomes(this.options.home, this.rows);
    });
  }
  enqueue(work) {
    const next = this.writes.then(work, work);
    this.writes = next.catch(() => {
    });
    return next;
  }
  // ---- HomeDirectory ----
  for(canvasId) {
    const address = this.homeOf(canvasId);
    return address === null ? null : this.linkFor(address);
  }
  all() {
    return [...this.open.values()];
  }
  birth() {
    return this.birthHome === null ? null : this.linkFor(this.birthHome);
  }
  /**
   * **Does this daemon disagree with its home about which build to be?**
   * (auto-upgrade phase 2.) Null for no verdict, which is the answer whenever
   * anything in the chain cannot say.
   *
   * **Which home answers, on a machine with several.** The birth default, and
   * failing that the single home if there is exactly one. That rule is
   * deliberately narrow: phase 10.3 made the home a property of the CANVAS, so
   * "which build should this machine run" has no forced answer on a machine
   * answering to three homes — picking the newest would be silently choosing
   * a distribution channel on someone's behalf, which is the flapping the
   * design warns about. Until that is decided (it is on this project's
   * Deliberately-open list), an ambiguous machine gets no verdict rather than
   * a guess, and every verdict that IS produced names the home it came from.
   */
  upgrade() {
    const link = this.birthHome !== null ? this.open.get(this.birthHome) : this.open.size === 1 ? [...this.open.values()][0] : void 0;
    return upgradeVerdict(link?.homeBuild ?? null);
  }
  async bindLocal(canvasId) {
    await this.record(canvasId, null);
  }
  async bind(canvasId, homeUrl) {
    const target = homeUrl !== null ? normalizeHomeUrl(homeUrl) : this.birthHome;
    await this.record(canvasId, target);
    return target === null ? null : this.linkFor(target);
  }
  /**
   * That canvas is gone. Drop its row, or a re-created id inherits a dead
   * routing — the same class of bug as a stale pidfile, and harder to see.
   *
   * An orphaned link goes with it: no row names its address any more and it is
   * not the birth default, so nobody will ask it anything again. Checked HERE
   * rather than on the poll, deliberately — **a poll returning nothing is a
   * home being quiet, not a home being gone**, and closing a link because its
   * home had a slow afternoon is how a replica forgets.
   */
  async release(canvasId) {
    const address = this.rows[canvasId];
    if (address === void 0) return;
    await this.enqueue(async () => {
      const { [canvasId]: _gone, ...rest } = this.rows;
      this.rows = rest;
      await writeHomes(this.options.home, this.rows);
    });
    if (address === null) return;
    await this.dropIfUnused(address);
  }
  /**
   * Close the link to this address if nothing needs it any more — no row names
   * it and it is not the birth default.
   *
   * Called after a delete and after a join that the far door refused, and
   * **never on the poll**: a poll returning nothing is a home being quiet, not
   * a home being gone, and a link closed for a slow afternoon is a laptop that
   * has forgotten where its work lives.
   */
  async dropIfUnused(homeUrl) {
    const key = normalizeHomeUrl(homeUrl);
    if (key === this.birthHome) return;
    if (this.idsFor(key).length > 0) return;
    const link = this.open.get(key);
    if (!link) return;
    this.open.delete(key);
    await link.close().catch(() => {
    });
  }
  // ---- the links themselves ----
  /**
   * The link to one address, opened on first ask.
   *
   * Four callers create links this way and all four know an address for a
   * reason: boot (one per distinct row), a birth naming one, a join, and a
   * redeemed pass. Lazily, because the alternative is a daemon that dials
   * every address it has ever heard of at boot whether or not anything needs
   * it — and the poll it would start is the expensive half.
   */
  linkFor(homeUrl) {
    const key = normalizeHomeUrl(homeUrl);
    const existing = this.open.get(key);
    if (existing) return existing;
    const link = new HomeLink({
      homeUrl: key,
      home: this.options.home,
      engine: this.options.engine,
      presence: this.options.presence,
      registry: this,
      ...this.options.pollMs !== void 0 ? { pollMs: this.options.pollMs } : {},
      ...this.options.probeMs !== void 0 ? { probeMs: this.options.probeMs } : {},
      ...this.options.rc !== void 0 ? { rc: this.options.rc } : {}
    });
    this.open.set(key, link);
    if (!this.stopped) void link.start().catch(() => {
    });
    return link;
  }
  /** One link by address, or undefined when this daemon has never dialled it.
   * Exposed for the tests that assert what a link did NOT do — see
   * `HomeHandshakes`, whose interesting question is negative. */
  link(homeUrl) {
    return this.open.get(normalizeHomeUrl(homeUrl));
  }
  /** Every open link, as links rather than as connections. */
  links() {
    return [...this.open.values()];
  }
  /**
   * **The home to ask about something that is not about a canvas** — badges,
   * attestations, a pass being redeemed.
   *
   * A named seam rather than a solved problem. These acts are home-scoped and
   * carry no canvas: `isocan badges` asks "what surfaces of mine exist THERE",
   * and a redeemed pass names a home only implicitly, in the token's own
   * provenance, which nothing here can read. With one home the question did
   * not arise; with several there is no honest local answer.
   *
   * What is answered instead is the narrow case that is honest: the birth
   * default when there is one (where this machine is heading, and on a pure
   * replica the only home there is), else the single link when there is
   * exactly one, else nothing. On a pure replica and on a pure home this is
   * byte-for-byte today's behaviour. On a mixed rig it is a refusal from the
   * wrong home rather than a wrong answer, which is the right side of the
   * cheerful-wrong-address line — and the real fix, when a scene forces it, is
   * for a pass token to name its home the way a canvas address does.
   */
  homeScoped() {
    if (this.birthHome !== null) return this.linkFor(this.birthHome);
    const links = [...this.open.values()];
    return links.length === 1 ? links[0] : null;
  }
  /**
   * **The homes that make `homeScoped` unanswerable**, or null when it has an
   * answer — the difference between "this daemon is the desk" and "this daemon
   * cannot tell which desk you mean".
   *
   * It exists because `homeScoped()` returning null is two completely
   * different situations wearing one shape, and a caller that treated them
   * alike would ship the wrong one:
   *
   * - **No links at all** — a plain home. The local desk IS the answer, which
   *   is what every daemon in this repo was before phase 10.3 and what a
   *   hosted home is now. Null here, and the caller answers locally.
   * - **Several links and no birth default** — a mixed rig with work at two
   *   homes. The local desk is emphatically NOT the answer: a person asking
   *   which of their surfaces exist would be handed this laptop's own ledger,
   *   which is short, plausible and wrong, with nothing saying so. Their real
   *   badges are at the homes named here.
   *
   * So this returns the addresses, the route refuses with `AMBIGUOUS_HOME`,
   * and the person picks. The real fix — for a pass, already made — is for the
   * request to carry its home; `RedeemPassRequest.home` is what that looks
   * like, and a badge route could grow the same field the day a scene wants
   * it.
   */
  homeScopedAmbiguity() {
    if (this.birthHome !== null) return null;
    const links = [...this.open.values()];
    if (links.length <= 1) return null;
    return links.map((link) => link.homeUrl).sort();
  }
};

// packages/server/src/modules.ts
import { existsSync, readdirSync, readFileSync as readFileSync2, realpathSync } from "node:fs";
import path8 from "node:path";
var modulesDir = (home) => path8.join(home, "modules");
function readRuntimeModules(home) {
  const root2 = modulesDir(home);
  if (!existsSync(root2)) return [];
  const found = [];
  for (const entry of readdirSync(root2).sort()) {
    const dir = path8.join(root2, entry);
    const file = path8.join(dir, "manifest.json");
    if (!existsSync(file)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync2(file, "utf8"));
    } catch {
      continue;
    }
    if (typeof manifest.name !== "string" || manifest.name === "") continue;
    const engines = enginesSatisfied(manifest.engines);
    found.push({ dir, manifest, refused: engines.ok ? null : engines.why });
  }
  return found;
}

// packages/server/src/binding.ts
import { promises as fs8 } from "node:fs";
import os2 from "node:os";
import path9 from "node:path";
var markerFile = (dir) => path9.join(dir, ".isocan", "project.json");
async function readMarker(dir) {
  try {
    const raw = JSON.parse(await fs8.readFile(markerFile(dir), "utf8"));
    const canvasId = raw.projectId ?? raw.canvasId;
    if (typeof canvasId !== "string" || canvasId.length === 0) return null;
    if (raw.home !== void 0 && (typeof raw.home !== "string" || raw.home.trim() === "")) {
      return null;
    }
    return {
      canvasId,
      ...typeof raw.title === "string" && raw.title ? { title: raw.title } : {},
      ...typeof raw.home === "string" ? { home: raw.home.trim() } : {}
    };
  } catch {
    return null;
  }
}
function excluded(dir, isocanHome2, userHome) {
  return dir === userHome || path9.dirname(dir) === dir || path9.join(dir, ".isocan") === isocanHome2;
}
var canon = (p) => fs8.realpath(p).catch(() => path9.resolve(p));
async function findBinding(cwd, home) {
  const isocanHome2 = await canon(home);
  const userHome = await canon(os2.homedir());
  let dir = await canon(cwd);
  for (; ; ) {
    if (!excluded(dir, isocanHome2, userHome)) {
      const marker = await readMarker(dir);
      if (marker) return { root: dir, ...marker };
    }
    const parent = path9.dirname(dir);
    if (parent === dir || dir === userHome) return null;
    dir = parent;
  }
}
async function bindableRoot(cwd, home) {
  const isocanHome2 = await canon(home);
  const userHome = await canon(os2.homedir());
  const start = await canon(cwd);
  let toplevel = null;
  let dir = start;
  for (; ; ) {
    if (await fs8.stat(path9.join(dir, ".git")).then(() => true, () => false)) {
      toplevel = dir;
      break;
    }
    const parent = path9.dirname(dir);
    if (parent === dir || dir === userHome) break;
    dir = parent;
  }
  for (const candidate of toplevel && toplevel !== start ? [toplevel, start] : [start]) {
    if (!excluded(candidate, isocanHome2, userHome)) return candidate;
  }
  return null;
}
async function writeMarker(root2, marker) {
  const file = markerFile(root2);
  const onDisk = {
    projectId: marker.canvasId,
    ...marker.title !== void 0 ? { title: marker.title } : {},
    ...marker.home !== void 0 ? { home: marker.home } : {}
  };
  await fs8.mkdir(path9.dirname(file), { recursive: true });
  await fs8.writeFile(file, `${JSON.stringify(onDisk, null, 2)}
`);
  return file;
}
async function readRoster(home) {
  try {
    const raw = JSON.parse(await fs8.readFile(dirsFile(home), "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
async function recordDir(home, root2, canvasId) {
  try {
    const real = await fs8.realpath(root2).catch(() => path9.resolve(root2));
    const roster = await readRoster(home);
    if (roster[real] === canvasId) return;
    roster[real] = canvasId;
    await fs8.mkdir(home, { recursive: true });
    await fs8.writeFile(dirsFile(home), `${JSON.stringify(roster, null, 2)}
`);
  } catch {
  }
}
async function dirsOf(home, canvasId) {
  const roster = await readRoster(home);
  return Object.entries(roster).filter(([, id]) => id === canvasId).map(([dir]) => dir).sort();
}

// packages/server/src/personas.ts
import { promises as fs9 } from "node:fs";
import path10 from "node:path";
var PERSONA_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
function personaPath(root2, name) {
  if (!PERSONA_NAME.test(name)) return null;
  return path10.join(root2, PERSONA_DIR, `${name}.md`);
}
async function readPersonas(root2) {
  const dir = path10.join(root2, PERSONA_DIR);
  const names = await fs9.readdir(dir).catch(() => []);
  const out = [];
  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    const full = path10.join(dir, name);
    const stat = await fs9.lstat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    const text = await fs9.readFile(full, "utf8").catch(() => null);
    if (text === null) continue;
    const persona = parsePersona(text, name);
    if (persona) out.push({ file: `${PERSONA_DIR}/${name}`, persona, text });
  }
  return out;
}
var MAX_PERSONA_BYTES = 256 * 1024;
async function writePersona(root2, name, text) {
  const full = personaPath(root2, name);
  if (!full) return { ok: false, refusal: "bad-name" };
  if (Buffer.byteLength(text, "utf8") > MAX_PERSONA_BYTES) return { ok: false, refusal: "too-big" };
  if (!parsePersona(text, `${name}.md`)) return { ok: false, refusal: "not-a-persona" };
  const existing = await fs9.lstat(full).catch(() => null);
  if (existing?.isSymbolicLink()) return { ok: false, refusal: "symlink" };
  if (existing && !existing.isFile()) return { ok: false, refusal: "failed" };
  try {
    await fs9.mkdir(path10.dirname(full), { recursive: true });
    await fs9.writeFile(full, text, "utf8");
  } catch {
    return { ok: false, refusal: "failed" };
  }
  return { ok: true, file: `${PERSONA_DIR}/${name}.md` };
}
function personaRefusal(refusal) {
  switch (refusal) {
    case "bad-name":
      return "a persona is named in lowercase letters, digits and dashes \u2014 no paths, no dots";
    case "not-a-persona":
      return "a persona needs front matter: a `---` block with at least a description";
    case "too-big":
      return "that is larger than a persona should ever be";
    case "symlink":
      return "there is a symlink at that name, and this route will not write through one";
    case "failed":
      return "that could not be written";
  }
}

export {
  rungOfAdmission,
  liveAdmission,
  keepsAdmission,
  admissionIn,
  CanvasNotFoundError,
  NothingToUndoError,
  Engine,
  paths_exports,
  FileStore,
  selectPersonalBinding,
  assertPersonalIntent,
  FileDesk,
  Refusals,
  TakenDownError,
  RefusedError,
  readConfigFile,
  updateConfigFile,
  resolveHomeUrl,
  googleTokenFile,
  readGoogleToken,
  writeGoogleToken,
  clearGoogleToken,
  DocRefusal,
  fetchGoogleDoc,
  driveModifiedTime,
  driveAccount,
  readBadge,
  writeIdentityName,
  writeBadge,
  adoptIdentity,
  knockOnDoor,
  fileBadgeStore,
  MINT_PER_MINUTE,
  TOO_MANY_BADGES,
  buildStamp,
  plausibleSha,
  describeBuild,
  stalenessOf,
  upgradeVerdict,
  HomeUnreachableError,
  HomeRefusedError,
  HomeLink,
  readHomes,
  homesRecorded,
  writeHomes,
  HomeLinks,
  modulesDir,
  readRuntimeModules,
  markerFile,
  readMarker,
  findBinding,
  bindableRoot,
  writeMarker,
  recordDir,
  dirsOf,
  PERSONA_NAME,
  readPersonas,
  MAX_PERSONA_BYTES,
  writePersona,
  personaRefusal
};
