import { isAgentHarness, isSystemActor, resolveActor, OpValidationError, contextManifest, type Actor, type ActorRegistry, type CanvasState, type DesignActorKind, type DesignArtifactRef, type LogEntry, type Operation, type QuestionnaireActor, type QuestionnaireOperation, type QuestionnaireRetainedReference } from "@isocan/core";
import { DesignPartnerContractError, parseDesignBrief, parseDesignQuestionSet, parseDesignResponse } from "@isocan/core/design-partner";
import { planDesignAnswer } from "@isocan/core/design-partner-plan";
import { questionnaireStates, questionnaireArtifacts, legacyQuestionSet, parseLegacyQuestionnaire, rejectQuestionnaireMetadata } from "@isocan/core/questionnaire";
import type { Store } from "./store.ts";
import { contextBlobAvailable, hydrateContextManifest } from "./canvas-group-context.ts";
import { retainedDesignVersion } from "@isocan/core/design-record";
import { validateAdmittedDesignQuestions } from "./design-request.ts";

/** Joins preserve identity while known harness records establish eligibility; absence remains unknown. */
export function questionnaireActorKind(registry: ActorRegistry, id: string): DesignActorKind {
  const canonical = resolveActor(registry.joined, id);
  const harnesses = Object.entries(registry.harnesses ?? {}).filter(([actorId]) => resolveActor(registry.joined, actorId) === canonical).map(([, harness]) => harness).filter((harness) => harness && harness.toLowerCase() !== "replica");
  if (isSystemActor(canonical) || !harnesses.length) return "unknown";
  return harnesses.some(isAgentHarness) ? "agent" : "human";
}
/** Exposes canvas authors and current faces through registry-backed eligibility, never private session or credential data. */
export function questionnaireActors(state: CanvasState, registry: ActorRegistry, liveActors: readonly Actor[] = []): QuestionnaireActor[] {
  const actors = [state.project.createdBy, state.project.updatedBy, ...Object.values(state.canvas.items).flatMap((item) => [item.createdBy, item.updatedBy]), ...Object.values(state.canvas.threads).flatMap((thread) => thread.comments.map((comment) => comment.author)), ...Object.values(state.canvas.agents ?? {}).map((agent) => agent.actor), ...liveActors];
  for (const thread of Object.values(state.canvas.threads)) for (const comment of thread.comments) {
    const record = comment.designDecision?.record;
    const ids = record?.kind === "comparison" ? [record.audience.kind === "human" ? record.audience.respondentActorId : record.audience.reporterActorId] : record?.kind === "comparison-response" && record.outcome.kind === "delegate" ? [record.outcome.agentActorId] : [];
    for (const id of ids) { const canonical = resolveActor(registry.joined, id); actors.push({ id, name: registry.names[canonical]?.name ?? id }); }
  }
  const found = new Map<string, QuestionnaireActor>();
  for (const actor of actors) {
    const id = resolveActor(registry.joined, actor.id); if (isSystemActor(id)) continue;
    found.set(id, { id, name: registry.names[id]?.name ?? actor.name, kind: questionnaireActorKind(registry, id) });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
/** Narrows the refusing public acts before their writer-only materialization fields are added. */
export const isQuestionnaireOperation = (op: Operation): op is QuestionnaireOperation => op.type === "questionnaire.ask" || op.type === "questionnaire.answer";
function bad(message: string): never { throw new OpValidationError("bad-op", message); }
/** Rejects invented authority or retained metadata before forwarding and idempotency lookup. */
export function rejectPublicQuestionnaire(op: Operation): void {
  try { rejectPublicPayload(op); } catch (error) { refuseContract(error); }
}
function refuseContract(error: unknown): never {
  if (error instanceof DesignPartnerContractError || error instanceof SyntaxError) bad(error.message);
  throw error;
}
function rejectPublicPayload(op: Operation): void {
  rejectQuestionnaireMetadata(op);
  if (!isQuestionnaireOperation(op)) return;
  const fields = op.type === "questionnaire.ask" ? ["type", "threadId", "commentId", "questions", "legacySource", "contextRequest"] : ["type", "threadId", "commentId", "response"];
  if (Object.keys(op).some((key) => !fields.includes(key))) bad("questionnaire canonical context/references are writer-owned or a field is unsupported");
  if (typeof op.threadId !== "string" || !op.threadId || typeof op.commentId !== "string" || !op.commentId) bad("questionnaire requires stable thread/comment IDs");
  if (op.type === "questionnaire.ask") {
    parseDesignQuestionSet(op.questions);
    if (op.legacySource !== undefined && (!op.legacySource || typeof op.legacySource !== "object" || Array.isArray(op.legacySource) || Object.keys(op.legacySource).some((key) => !["threadId", "commentId", "body"].includes(key)) || ![op.legacySource.threadId, op.legacySource.commentId, op.legacySource.body].every((v) => typeof v === "string" && v.length > 0))) bad("invalid legacy source");
  } else parseDesignResponse(op.response);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function intent(op: QuestionnaireOperation): unknown {
  const { context: _context, retainedReferences: _references, ...publicIntent } = op;
  return publicIntent;
}
/** Called before the general op-id fast path; canonical fields alone are ignored. */
export function questionnaireRetry(entries: readonly LogEntry[], op: QuestionnaireOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): LogEntry | null {
  const id = op.type === "questionnaire.ask" ? op.questions.id : op.response.id;
  const found = entries.find((entry) => opId !== undefined && entry.envelope.id === opId) ?? entries.find((entry) => {
    const written = entry.envelope.op;
    return isQuestionnaireOperation(written) && (written.type === "questionnaire.ask" ? written.questions.id : written.response.id) === id;
  });
  if (!found) return null;
  if (!isQuestionnaireOperation(found.envelope.op) || stable(intent(found.envelope.op)) !== stable(intent(op)) || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId)) bad("questionnaire retry identity conflicts with its original payload or authenticated actor");
  return found;
}
async function readText(store: Store, canvasId: string, hash: string): Promise<string> {
  const stream = await store.openBlob(canvasId, hash); if (!stream) return bad("questionnaire brief bytes are unavailable");
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of stream) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 1024 * 1024) bad("questionnaire brief exceeds one megabyte"); chunks.push(bytes); }
  return Buffer.concat(chunks).toString("utf8");
}
function exactHome(value: string, home: string): boolean {
  try { const address = new URL(value); return address.origin === home && (address.pathname === "/" || address.pathname === "") && !address.search && !address.hash && !address.username && !address.password; } catch { return false; }
}
async function retain(store: Store, state: CanvasState, home: string, artifact: DesignArtifactRef, retained: readonly QuestionnaireRetainedReference[] = []): Promise<QuestionnaireRetainedReference> {
  if (artifact.canvasId !== state.project.id || !exactHome(artifact.home, home)) bad("questionnaire references must be readable versions at this canvas's authoritative home; copy external references explicitly first");
  const item = state.canvas.items[artifact.itemId];
  // A replacement may keep an exact reference the same question already retained.
  // Only canonical records from that source are eligible; callers supply no metadata.
  const previous = retained.find((ref) => ref.artifact.home === artifact.home && ref.artifact.canvasId === artifact.canvasId && ref.artifact.itemId === artifact.itemId && ref.artifact.versionId === artifact.versionId && ref.artifact.blobHash === artifact.blobHash);
  const existing = item?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash) ?? previous?.version;
  if (!existing || existing.blobHash !== artifact.blobHash) bad("questionnaire reference does not identify an available item version");
  const version = retainedDesignVersion(existing);
  if (!(await contextBlobAvailable(store, state.project.id, version.blobHash))) bad("questionnaire reference bytes are unavailable");
  if (version.visual) {
    if (!(await contextBlobAvailable(store, state.project.id, version.visual.blobHash))) bad("questionnaire visual reference bytes are unavailable");
    const metadata = await store.blobMeta(state.project.id, version.visual.blobHash);
    if (!metadata) bad("questionnaire visual reference metadata is unavailable");
    version.visual = { ...version.visual, filename: version.visual.filename ?? metadata.filename, size: version.visual.size ?? metadata.size };
  }
  return { artifact: structuredClone(artifact), version };
}
/** This function runs within Engine's single writer chain, after custody and ordinary canvas grants. */
export async function resolveQuestionnaireOperation(store: Store, state: CanvasState, revision: number, op: QuestionnaireOperation, actor: Actor, registry: ActorRegistry, home: string | undefined, history: readonly LogEntry[] = []): Promise<QuestionnaireOperation> {
  try { return await materialize(store, state, revision, op, actor, registry, home, history); } catch (error) { return refuseContract(error); }
}
async function materialize(store: Store, state: CanvasState, revision: number, op: QuestionnaireOperation, actor: Actor, registry: ActorRegistry, home: string | undefined, history: readonly LogEntry[]): Promise<QuestionnaireOperation> {
  if (!home) bad("questionnaire writer has no authoritative home address");
  if (!state.canvas.threads[op.threadId]) bad("questionnaire requires an existing thread");
  const source = op.type === "questionnaire.answer" ? questionnaireStates(state.canvas).find((q) => q.source.threadId === op.response.question.threadId && q.source.commentId === op.response.question.commentId && q.source.payloadId === op.response.question.payloadId && q.source.revision === op.response.question.revision) : undefined;
  const questions = op.type === "questionnaire.ask" ? parseDesignQuestionSet(op.questions) : source?.questions;
  if (!questions) bad("questionnaire source is unavailable");
  if (op.type === "questionnaire.answer" && op.threadId !== op.response.question.threadId) bad("answer must be posted to its source thread");
  const retainedBrief = await retain(store, state, home, questions.brief);
  const brief = parseDesignBrief(JSON.parse(await readText(store, state.project.id, retainedBrief.version.blobHash)));
  if (state.canvas.items[questions.brief.itemId]?.versions.find((v) => v.id === questions.brief.versionId)?.designRecord?.kind === "brief") validateAdmittedDesignQuestions(state, brief, questions, history, registry, op.type === "questionnaire.ask");
  if (state.canvas.items[questions.brief.itemId]!.currentVersionId !== questions.brief.versionId || brief.requestId !== questions.requestId || brief.epoch !== questions.epoch || brief.progress !== "active" || brief.context.canvasId !== state.project.id) bad("questionnaire request is stale, canceled or belongs to another canvas");
  const requestSource = brief.source;
  if (requestSource.entrance === "canvas-chat") {
    const requestComment = state.canvas.threads[requestSource.threadId]?.comments.find((comment) => comment.id === requestSource.commentId);
    if (!requestComment || resolveActor(registry.joined, requestComment.author.id) !== resolveActor(registry.joined, brief.requestingActorId)) bad("questionnaire original request source is unavailable or has a different requesting actor");
  }
  if (questionnaireActorKind(registry, questions.respondentActorId) !== "human") bad("questionnaire respondent is not a known human actor");
  let normalized: QuestionnaireOperation;
  if (op.type === "questionnaire.ask") {
    if (questions.supersedes) {
      const previous = questionnaireStates(state.canvas).find((q) => sameSource(q.source, questions.supersedes!));
      if (!previous || previous.status === "superseded" || previous.questions.requestId !== questions.requestId || resolveActor(registry.joined, previous.author.id) !== resolveActor(registry.joined, actor.id)) bad("questionnaire reissue must name this author's current question");
    }
    if (op.legacySource) {
      const legacy = state.canvas.threads[op.legacySource.threadId]?.comments.find((c) => c.id === op.legacySource!.commentId);
      const payload = legacy && legacy.body === op.legacySource.body ? parseLegacyQuestionnaire(legacy.body) : null;
      if (!payload) bad("legacy question changed or is malformed");
      const expected = legacyQuestionSet(payload, questions);
      if (stable(expected) !== stable(questions)) bad("legacy adoption must preserve the normalized questions");
      if (Object.values(state.canvas.threads).some((t) => t.comments.some((c) => c.designLegacySource?.threadId === op.legacySource!.threadId && c.designLegacySource.commentId === op.legacySource!.commentId))) bad("legacy question has already been adopted");
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
  const references = await Promise.all(questionnaireArtifacts(design).map((artifact) => retain(store, state, home, artifact, normalized.type === "questionnaire.answer" ? source?.references : undefined)));
  // A retained brief/reference may itself root exact evidence. Copy only those
  // canonical flat roots; stripping its marker must not make its citations collectible.
  for (const artifact of questionnaireArtifacts(design)) {
    const marker = state.canvas.items[artifact.itemId]?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash)?.designRecord;
    for (const retained of marker?.retainedReferences ?? []) if (!references.some((r) => stable(r.artifact) === stable(retained.artifact))) references.push(await retain(store, state, home, retained.artifact, marker!.retainedReferences));
  }
  const withReferences = { ...normalized, retainedReferences: references };
  if (normalized.type === "questionnaire.ask" && normalized.contextRequest !== undefined) {
    if (state.project.groupMode !== "groups") bad("frozen selected context requires a group-mode canvas");
    return { ...withReferences, context: await hydrateContextManifest(store, state, contextManifest(state, revision, normalized.contextRequest)) };
  }
  return withReferences;
}
function sameSource(a: import("@isocan/core").DesignQuestionSource, b: import("@isocan/core").DesignQuestionSource): boolean { return a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision; }
