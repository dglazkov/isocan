import { createHash } from "node:crypto";
import { ambientContextManifest, contextManifest, designSystem, isSystemActor, resolveActor, OpValidationError, type Actor, type ActorRegistry, type CanvasState, type ItemVersion, type LogEntry, type Operation, type ContextManifest, type ContextRequest } from "@isocan/core";
import { designPartnerPolicy, parseDesignBrief, parseDesignReceipt, DesignPartnerContractError, type DesignArtifactRef, type DesignBrief, type DesignQuestionSet, type DesignReceipt } from "@isocan/core/design-partner";
import { designIntentHash, parseDesignRequestOperation, type DesignRecordOperation, type DesignRequestAction, type DesignRequestsResponse, type DesignRequestState, type DesignContinuation, type DesignAcceptedResponse, type DesignReceiptState } from "@isocan/core/design-request";
import { retainedDesignVersion, validateDesignRecordVersion, type DesignRecordMarker, type DesignRetainedReference, type DesignRecordEffect } from "@isocan/core/design-record";
import { questionnaireStates, questionnaireSourceCurrent } from "@isocan/core/questionnaire";
import { questionnaireActorKind } from "./questionnaire.ts";
import { hydrateContextManifest, contextBlobAvailable } from "./canvas-group-context.ts";
import type { Store } from "./store.ts";
import { designInputTransition } from "../../core/src/design-decision-state.ts";

const bad = (message: string): never => { throw new OpValidationError("bad-op", message); };
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const sameRef = (a: DesignArtifactRef, b: DesignArtifactRef) => a.home === b.home && a.canvasId === b.canvasId && a.itemId === b.itemId && a.versionId === b.versionId && a.blobHash === b.blobHash;
const sameQuestion = (a: DesignAcceptedResponse["question"], b: DesignAcceptedResponse["question"]) => a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
const reference = (home: string, canvasId: string, itemId: string, version: ItemVersion): DesignArtifactRef => ({ home, canvasId, itemId, versionId: version.id, blobHash: version.blobHash });
/** Identifies the two refusing wire acts without changing ordinary item or comment vocabulary. */
export const isDesignRecordOperation = (op: Operation): op is DesignRecordOperation => op.type === "design.request" || op.type === "design.receipt";
/** Public callers cannot inject admission through generic item, group, restore or nested version fields. */
export function rejectPublicDesignRecord(op: Operation): void {
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Object.prototype.hasOwnProperty.call(value, "designRecord")) bad("design admission metadata is writer-owned");
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(op);
  if (isDesignRecordOperation(op)) { try { parseDesignRequestOperation(op); } catch (error) { if (error instanceof DesignPartnerContractError) bad(error.message); throw error; } }
}
/** Content edits and version switching cannot bypass lifecycle guards on admitted records. */
export function guardDesignRecordEdit(state: CanvasState, op: Operation): void {
  const inner = op.type === "group.change" && op.action.kind === "content" ? op.action.operation : op;
  if (inner.type !== "item.edit" && inner.type !== "item.addVersion" && inner.type !== "item.setCurrentVersion") return;
  if (state.canvas.items[inner.itemId]?.versions.some((v) => v.designRecord)) bad("admitted design records use design.request; published receipts are immutable");
}
/** Retry compares original validated intent and join-aware custody before current lifecycle checks. */
export async function designRecordRetry(entries: readonly LogEntry[], op: DesignRecordOperation, opId: string | undefined, actorId: string, registry: ActorRegistry): Promise<LogEntry | null> {
  const identity = op.type === "design.receipt" ? op.versionId : op.action.versionId;
  const found = entries.find((row) => opId && row.envelope.id === opId) ?? entries.find((row) => isDesignRecordOperation(row.envelope.op) && (row.envelope.op.type === "design.receipt" ? row.envelope.op.versionId : row.envelope.op.action.versionId) === identity);
  if (!found) return null;
  if (!isDesignRecordOperation(found.envelope.op) || resolveActor(registry.joined, found.envelope.actor.id) !== resolveActor(registry.joined, actorId) || await designIntentHash(found.envelope.op, found.envelope.actor.id) !== await designIntentHash(op, found.envelope.actor.id)) bad("design retry conflicts with the original intent or authenticated actor");
  return found;
}
async function readRecord(store: Store, canvasId: string, version: ItemVersion): Promise<unknown> {
  const stream = await store.openBlob(canvasId, version.blobHash); if (!stream) return bad("design record bytes are unavailable");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 1024 * 1024) bad("design record exceeds one megabyte"); chunks.push(bytes); }
  const bytes = Buffer.concat(chunks);
  if (sha(bytes) !== version.blobHash || bytes.length !== version.size) bad("design record bytes differ from their canonical identity");
  return JSON.parse(bytes.toString("utf8"));
}
function currentVersion(state: CanvasState, home: string, ref: DesignArtifactRef): ItemVersion {
  if (ref.home !== home || ref.canvasId !== state.project.id) bad("design request belongs to another home or canvas");
  const item = state.canvas.items[ref.itemId], version = item?.versions.find((v) => v.id === ref.versionId);
  if (!version || item!.currentVersionId !== ref.versionId || version.blobHash !== ref.blobHash) bad("design request version changed; preserve the draft and reread it");
  return version!;
}
async function briefAt(store: Store, state: CanvasState, home: string, ref: DesignArtifactRef): Promise<DesignBrief> {
  const version = currentVersion(state, home, ref);
  if (version.designRecord?.kind !== "brief") bad("this JSON item is not an admitted design request");
  validateDesignRecordVersion(version, state.project.id);
  const brief = parseDesignBrief(await readRecord(store, state.project.id, version));
  if (!brief.continuation || brief.requestId !== version.designRecord!.requestId || brief.epoch !== version.designRecord!.epoch || brief.context.canvasId !== state.project.id) bad("design brief and admission metadata disagree");
  return brief;
}
function sourceComment(state: CanvasState, source: DesignBrief["source"]) {
  return source.entrance === "canvas-chat" ? state.canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId) : undefined;
}
/** Current source/cancellation standing is shared by lifecycle writes, questions and request reads. */
function designRequestReasons(state: CanvasState, brief: DesignBrief, registry: ActorRegistry): string[] {
  const reasons: string[] = [];
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
function localInputReasons(state: CanvasState, home: string, brief: DesignBrief, ownItemId: string): string[] {
  const refs = [...brief.context.entries.filter((e) => !e.excluded && !e.unavailable && e.version).map((e) => reference(home, state.project.id, e.itemId, e.version!))];
  return [...new Set(refs.filter((ref) => ref.home === home && ref.canvasId === state.project.id && ref.itemId !== ownItemId && (state.canvas.items[ref.itemId]?.currentVersionId !== ref.versionId || state.canvas.items[ref.itemId]?.versions.find((v) => v.id === ref.versionId)?.blobHash !== ref.blobHash) && !designInputTransition(state.canvas, ownItemId, brief.requestId, brief.epoch, ref)).map((ref) => `Input ${ref.itemId} changed or is unavailable.`))];
}
/** Comparison acts use the same live request, source, cancellation and input guards as lifecycle writes. */
export async function designDecisionRequest(store: Store, state: CanvasState, home: string, ref: DesignArtifactRef, epoch: number, registry: ActorRegistry): Promise<DesignBrief> {
  const brief = await briefAt(store, state, home, ref);
  const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, ref.itemId)];
  if (brief.epoch !== epoch || brief.progress !== "active" || reasons.length) bad(reasons.join(" ") || "The design request is no longer active at this epoch.");
  return brief;
}
function admittedQuestionEntries(entries: readonly LogEntry[], requestId: string, briefItemId: string): LogEntry[] {
  const versions = new Map<string, string>();
  for (const row of entries) {
    const op = row.envelope.op; if (op.type !== "design.request" || !op.effect) continue;
    const effect = op.effect;
    const itemId = op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId;
    if (itemId !== briefItemId) continue;
    const version = effect.type === "group.change" ? effect.action.change.writes.flatMap((w) => w.kind === "create" && w.item.id === briefItemId ? w.item.versions : []).find((v) => v.id === op.action.versionId) : effect.version;
    if (version?.designRecord?.requestId === requestId) versions.set(version.id, version.blobHash);
  }
  return entries.filter((row) => row.envelope.op.type === "questionnaire.ask" && row.envelope.op.questions.requestId === requestId && row.envelope.op.questions.brief.itemId === briefItemId && versions.get(row.envelope.op.questions.brief.versionId) === row.envelope.op.questions.brief.blobHash);
}
/** Count canonical initial publication history across epochs, removals and archived operations. */
function initialDesignQuestionIds(entries: readonly LogEntry[], requestId: string, briefItemId: string): string[] {
  return [...new Set(admittedQuestionEntries(entries, requestId, briefItemId).flatMap((row) => row.envelope.op.type === "questionnaire.ask" && row.envelope.op.questions.discovery?.purpose === "initial" ? row.envelope.op.questions.questions.map((q) => q.id) : []))];
}
/** Admitted requests add source and effort guards while historical manual briefs keep phase-1 semantics. */
export function validateAdmittedDesignQuestions(state: CanvasState, brief: DesignBrief, questions: DesignQuestionSet, entries: readonly LogEntry[], registry: ActorRegistry, publishing: boolean): void {
  if (!brief.continuation) return;
  const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, questions.brief.home, brief, questions.brief.itemId)]; if (reasons.length) bad(reasons.join(" "));
  if (!publishing) return;
  const discovery = questions.discovery; if (!discovery) bad("admitted request questions require discovery purpose and fact bindings");
  if (discovery!.purpose === "initial" && !questions.supersedes && initialDesignQuestionIds(entries, brief.requestId, questions.brief.itemId).length) bad("initial discovery is one batch; further questions need a consequential reason or explicit interview");
  if (discovery!.factBindings.length !== questions.questions.length || discovery!.factBindings.some((b) => !questions.questions.some((q) => q.id === b.questionId)) || new Set(discovery!.factBindings.map((b) => b.factId)).size !== discovery!.factBindings.length) bad("each question needs one distinct durable fact binding");
  if (discovery!.purpose === "initial" && new Set([...initialDesignQuestionIds(entries, brief.requestId, questions.brief.itemId), ...questions.questions.map((q) => q.id)]).size > 3) bad("the request's initial allowance is three questions; use a consequential reason or explicit interview");
  if (questions.supersedes) {
    const prior = entries.map((row) => row.envelope.op).find((op) => op.type === "questionnaire.ask" && op.questions.id === questions.supersedes!.payloadId && op.threadId === questions.supersedes!.threadId && op.commentId === questions.supersedes!.commentId && op.questions.revision === questions.supersedes!.revision && op.questions.requestId === questions.requestId && op.questions.brief.itemId === questions.brief.itemId);
    if (prior?.type === "questionnaire.ask" && prior.questions.discovery?.purpose === "initial" && (discovery!.purpose !== "initial" || questions.questions.some((q) => !prior.questions.questions.some((p) => p.id === q.id)) || discovery!.factBindings.some((b) => prior.questions.discovery!.factBindings.find((p) => p.questionId === b.questionId)?.factId !== b.factId))) bad("initial reissue must preserve its question and fact identities");
  }
  if (discovery!.purpose === "interview") {
    const origin = discovery!.source!;
    if (origin.entrance === "canvas-chat") {
      const comment = sourceComment(state, origin);
      if (!comment || resolveActor(registry.joined, comment.author.id) !== resolveActor(registry.joined, questions.respondentActorId)) bad("interview provenance must name the intended respondent's actual request");
    } else if (brief.source.entrance !== "external-agent" || origin.externalRequestId !== brief.source.externalRequestId) bad("native interview provenance must belong to this external request");
  }
}
async function captureContext(store: Store, state: CanvasState, revision: number, source: DesignBrief["source"], request?: ContextRequest, previous?: DesignBrief): Promise<{ context: ContextManifest; scopeCapture: DesignContinuation["scopeCapture"] }> {
  const frozen = !previous && request === undefined ? sourceComment(state, source)?.context : undefined;
  let kind: DesignContinuation["scopeCapture"]["kind"], manifest: ContextManifest;
  if (frozen) { kind = "source-comment"; manifest = structuredClone(frozen); }
  else if (request || previous && previous.continuation?.scopeCapture.kind !== "current-ambient") { kind = "current-selection"; manifest = contextManifest(state, revision, request ?? { rootIds: previous!.context.rootIds, includeExcluded: previous!.context.includeExcluded }); }
  else { kind = "current-ambient"; manifest = ambientContextManifest(state, revision); }
  manifest.entries = manifest.entries.map((entry) => ({ ...entry, version: entry.version && retainedDesignVersion(entry.version) }));
  return { context: await hydrateContextManifest(store, state, manifest), scopeCapture: { kind, revision: manifest.revision } };
}
function captureSource(state: CanvasState, brief: Pick<DesignBrief, "source" | "requestingActorId">, registry: ActorRegistry): DesignContinuation["sourceCapture"] {
  if (brief.source.entrance === "external-agent") return null;
  const comment = sourceComment(state, brief.source), thread = state.canvas.threads[brief.source.threadId];
  if (!comment || !thread || resolveActor(registry.joined, comment.author.id) !== resolveActor(registry.joined, brief.requestingActorId)) bad("the original source must exist with its actual author");
  return { bodyHash: sha(comment!.body), boundaryCommentId: thread!.comments.at(-1)!.id };
}
function accepted(state: CanvasState, briefItemId: string, brief: DesignBrief, additions: DesignAcceptedResponse[] = []): DesignAcceptedResponse[] {
  const result = [...brief.continuation?.acceptedResponses ?? []];
  const questions = questionnaireStates(state.canvas, { requestId: brief.requestId });
  for (const record of additions) {
    if (result.some((r) => r.responseId === record.responseId && sameQuestion(r.question, record.question))) continue;
    const question = questions.find((q) => q.questions.brief.itemId === briefItemId && sameQuestion(q.source, record.question));
    if (!question || question.status === "superseded" || question.outstandingQuestionIds.length || !questionnaireSourceCurrent(state.canvas, question) || question.questions.epoch !== brief.epoch || !question.responses.some((r) => r.response.id === record.responseId) || question.responses.some((r) => r.response.supersedesResponseId === record.responseId)) bad("reconciliation requires a settled batch and effective response to this request and epoch");
    result.push(record);
  }
  for (const record of additions) {
    const question = questions.find((q) => q.questions.brief.itemId === briefItemId && sameQuestion(q.source, record.question));
    const effective = question?.responses.filter((r) => !question.responses.some((later) => later.response.supersedesResponseId === r.response.id)) ?? [];
    if (effective.some((r) => !result.some((accepted) => accepted.responseId === r.response.id && sameQuestion(accepted.question, record.question)))) bad("reconcile every effective response in the settled batch together");
  }
  return result;
}
/** Retains exact local source and visual bytes with flat metadata; inherited references remain permission-bearing. */
export async function retainReferences(store: Store, state: CanvasState, home: string, refs: DesignArtifactRef[], previous: DesignRetainedReference[] = []): Promise<DesignRetainedReference[]> {
  const result: DesignRetainedReference[] = [];
  const queue = [...refs];
  while (queue.length) {
    const artifact = queue.shift()!;
    // Inherited/private identities stay permission-bearing and are not copied into local retention.
    if (artifact.home !== home || artifact.canvasId !== state.project.id) continue;
    if (result.some((r) => sameRef(r.artifact, artifact))) continue;
    if (result.length >= 4096) bad("design references exceed the bounded retention limit");
    const original: ItemVersion | undefined = state.canvas.items[artifact.itemId]?.versions.find((v) => v.id === artifact.versionId && v.blobHash === artifact.blobHash) ?? previous.find((r) => sameRef(r.artifact, artifact))?.version;
    if (!original || !(await contextBlobAvailable(store, state.project.id, artifact.blobHash))) bad(`design reference bytes are unavailable: ${artifact.itemId}`);
    const nested = original!.designRecord?.retainedReferences ?? [];
    for (const row of nested) { queue.push(row.artifact); if (!previous.some((p) => sameRef(p.artifact, row.artifact))) previous.push(row); }
    const version = retainedDesignVersion(original!);
    if (version.visual) {
      const meta = await store.blobMeta(state.project.id, version.visual.blobHash);
      if (!meta || !(await contextBlobAvailable(store, state.project.id, version.visual.blobHash))) bad("design visual evidence is unavailable");
      version.visual = { ...version.visual, filename: version.visual.filename ?? meta!.filename, size: version.visual.size ?? meta!.size };
    }
    result.push({ artifact: structuredClone(artifact), version });
  }
  return result;
}
function briefReferences(brief: DesignBrief, home: string): DesignArtifactRef[] {
  return [...brief.context.entries.flatMap((e) => e.version && !e.excluded && !e.unavailable ? [reference(home, brief.context.canvasId, e.itemId, e.version)] : []), ...brief.facts.flatMap((f) => f.sources), ...brief.references.flatMap((r) => r.artifact && r.state === "fetched" ? [r.artifact] : [])];
}
/** Reuses canonical scope selection for request receipts and approval guards, without fetching supplied URLs. */
export function governingReasons(state: CanvasState, home: string, receipt: Pick<DesignReceipt, "governing">): string[] {
  const binding = receipt.governing; if (!binding) return ["The receipt has no governing selection."];
  const at = binding.atItemId === null ? undefined : state.canvas.items[binding.atItemId];
  if (binding.atItemId !== null && !at) return ["The governing scope is unavailable."];
  const none = state.project.properties.design === "none";
  if (none !== binding.explicitNone) return ["The explicit design policy changed."];
  const system = designSystem(state.canvas, at ? { at } : undefined), version = system?.versions.find((v) => v.id === system.currentVersionId);
  if (system && version) return binding.artifact && sameRef(binding.artifact, reference(home, state.project.id, system.id, version)) ? [] : ["The governing design system changed."];
  if (binding.artifact?.home === home && binding.artifact.canvasId === state.project.id) return ["The governing design system is unavailable."];
  return [];
}
/** Materializes JSON and one item effect while Engine holds the existing single-writer chain. */
export async function materializeDesignRecord(store: Store, state: CanvasState, revision: number, operation: DesignRecordOperation, actor: Actor, registry: ActorRegistry, home: string, opId: string): Promise<DesignRecordOperation> {
  try { return await materialize(store, state, revision, operation, actor, registry, home, opId); }
  catch (error) { if (error instanceof DesignPartnerContractError || error instanceof SyntaxError) bad(error.message); throw error; }
}
async function materialize(store: Store, state: CanvasState, revision: number, operation: DesignRecordOperation, actor: Actor, registry: ActorRegistry, home: string, opId: string): Promise<DesignRecordOperation> {
  const op = parseDesignRequestOperation(operation);
  if (isSystemActor(actor.id)) bad("a design request needs an authenticated acting identity");
  let record: DesignBrief | DesignReceipt, itemId: string, versionId: string, title: string, effect: DesignRecordEffect, retained: DesignRetainedReference[];
  if (op.type === "design.request") {
    const action = op.action; itemId = action.kind === "start" ? action.itemId : action.brief.itemId; versionId = action.versionId;
    let brief: DesignBrief, before: DesignBrief | undefined;
    if (action.kind === "start") {
      if (action.admission === "automatic" && designPartnerPolicy(state.project.properties) !== "adaptive-v1") bad("automatic design enrollment is off or unsupported");
      if (Object.values(state.canvas.items).some((item) => item.versions.some((v) => v.designRecord?.requestId === action.requestId && v.designRecord.kind === "brief"))) bad("this request is already admitted; read or resume its brief");
      const source = action.source, original = sourceComment(state, source);
      if (source.entrance === "canvas-chat" && !original) bad("the canvas request needs its actual source comment");
      const captured = await captureContext(store, state, revision, source, action.contextRequest);
      brief = { schemaVersion: 1, kind: "brief", requestId: action.requestId, epoch: 1, source, requestingActorId: original?.author.id ?? actor.id, progress: "active", ...action.fields, context: captured.context, continuation: { sourceCapture: null, scopeCapture: captured.scopeCapture, acceptedResponses: [], factProvenance: [] } };
      brief.continuation!.sourceCapture = captureSource(state, brief, registry);
    } else {
      brief = await briefAt(store, state, home, action.brief);
      before = brief;
      if (brief.epoch !== action.epoch) bad("the request epoch changed");
      if (action.kind !== "resume" && action.kind !== "cancel") {
        const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, itemId)];
        if (brief.progress !== "active" || reasons.length) bad(reasons.join(" ") || "the request is no longer active");
      }
      const prior = brief;
      const settled = action.kind === "cancel" ? prior.continuation!.acceptedResponses : accepted(state, itemId, prior, action.acceptedResponses);
      brief = { ...prior, ...(action.kind === "cancel" ? {} : action.patch), continuation: { ...prior.continuation!, acceptedResponses: settled }, progress: action.kind === "cancel" ? "cancelled" : action.kind === "complete" ? "completed" : "active" };
      if (action.kind === "resume") {
        const captured = await captureContext(store, state, revision, brief.source, action.contextRequest, prior);
        brief = { ...brief, epoch: prior.epoch + 1, context: captured.context, continuation: { ...brief.continuation!, sourceCapture: captureSource(state, brief, registry), scopeCapture: captured.scopeCapture, resumedBy: { actorId: actor.id, reason: action.reason } } };
      }
    }
    const changed = action.kind === "start" ? action.fields : action.kind === "cancel" ? {} : action.patch ?? {};
    const provenance = new Map(brief.continuation!.factProvenance.map((p) => [p.field, p]));
    for (const field of Object.keys(changed)) {
      if (!["audience", "primaryTask", "constraints", "facts"].includes(field)) continue;
      const kind = questionnaireActorKind(registry, actor.id) === "human" ? "direct" as const : "reported" as const;
      if (field === "facts") {
        for (const fact of brief.facts) if (!before || JSON.stringify(before.facts.find((f) => f.id === fact.id)) !== JSON.stringify(fact)) provenance.set(`facts.${fact.id}`, { field: `facts.${fact.id}`, actorId: actor.id, kind });
        for (const key of provenance.keys()) if (key.startsWith("facts.") && !brief.facts.some((f) => key === `facts.${f.id}`)) provenance.delete(key);
      } else if (!before || JSON.stringify(before[field as "audience" | "primaryTask" | "constraints"]) !== JSON.stringify(brief[field as "audience" | "primaryTask" | "constraints"])) provenance.set(field, { field, actorId: actor.id, kind });
    }
    if (action.kind !== "start" && action.kind !== "cancel") for (const binding of action.acceptedResponses ?? []) {
      const question = questionnaireStates(state.canvas, { requestId: brief.requestId }).find((q) => q.questions.brief.itemId === itemId && sameQuestion(q.source, binding.question));
      const response = question?.responses.find((r) => r.response.id === binding.responseId);
      for (const resolution of response?.response.resolutions ?? []) if (resolution.state === "answered") {
        const factId = question?.questions.discovery?.factBindings.find((b) => b.questionId === resolution.questionId)?.factId;
        const field = factId && (["audience", "primaryTask", "constraints"].includes(factId) ? factId : `facts.${factId}`);
        if (field && (field.startsWith("facts.") ? "facts" in changed : field in changed)) provenance.set(field, { field, actorId: response!.author.id, kind: "questionnaire", responseId: binding.responseId });
      }
    }
    brief.continuation!.factProvenance = [...provenance.values()];
    if (brief.targetItemId !== null && !state.canvas.items[brief.targetItemId]) bad("design target is unavailable");
    if (brief.groupId !== null && !state.canvas.items[brief.groupId]) bad("design scope is unavailable");
    if (brief.outputIds.some((id) => !state.canvas.items[id])) bad("a declared output is unavailable");
    if (action.kind === "complete" && brief.delivery !== "connected-app" && !brief.outputIds.length) bad("complete the request with its actual output items");
    record = parseDesignBrief(brief);
    const previous = action.kind === "start" ? [] : currentVersion(state, home, action.brief).designRecord!.retainedReferences;
    const captured = brief.context.entries.flatMap((e) => e.version && !e.excluded && !e.unavailable ? [{ artifact: reference(home, state.project.id, e.itemId, e.version), version: retainedDesignVersion(e.version) }] : []);
    retained = await retainReferences(store, state, home, briefReferences(brief, home), [...previous, ...captured]);
    title = action.kind === "start" ? action.title ?? "Design task" : state.canvas.items[itemId]!.title;
  } else {
    itemId = op.itemId; versionId = op.versionId; record = parseDesignReceipt(op.receipt); title = op.title ?? "Design receipt";
    const brief = await briefAt(store, state, home, record.brief);
    if (brief.progress !== "completed" || brief.epoch !== record.epoch || brief.requestId !== record.requestId) bad("a receipt requires this exact completed request");
    const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, record.brief.itemId), ...governingReasons(state, home, record)];
    for (const ref of record.context) if (ref.home === home && ref.canvasId === state.project.id) currentVersion(state, home, ref);
    if (reasons.length) bad(reasons.join(" "));
    if (record.output.kind === "canvas" && record.governing?.atItemId !== record.output.artifact.itemId) bad("governing selection must use the actual output scope");
    if (record.output.kind === "repository" && record.governing?.atItemId !== (brief.targetItemId ?? brief.groupId)) bad("repository governing selection must use the request target or scope");
    if (record.output.kind === "canvas") { currentVersion(state, home, record.output.artifact); if (!brief.outputIds.includes(record.output.artifact.itemId)) bad("receipt output was not completed by this brief"); }
    else if (brief.delivery !== "connected-app") bad("repository evidence needs a connected-app delivery");
    const refs = [record.brief, ...record.context, ...record.checks.flatMap((c) => c.evidence), ...(record.output.kind === "canvas" ? [record.output.artifact] : []), ...(record.governing?.artifact ? [record.governing.artifact] : [])];
    retained = await retainReferences(store, state, home, refs, [...currentVersion(state, home, record.brief).designRecord!.retainedReferences]);
  }
  const bytes = Buffer.from(JSON.stringify(record, null, 2) + "\n");
  if (bytes.length > 1024 * 1024) bad("design record exceeds one megabyte");
  const blob = await store.putBlob(state.project.id, bytes, { mimeType: "application/json", filename: record.kind === "brief" ? "design-brief.json" : "design-receipt.json" });
  const marker: DesignRecordMarker = { schemaVersion: 1, kind: record.kind, requestId: record.requestId, epoch: record.epoch, opId, intentHash: await designIntentHash(op, actor.id), retainedReferences: retained };
  const version = { id: versionId, blobHash: blob.blobHash, size: blob.size, mimeType: "application/json", filename: record.kind === "brief" ? "design-brief.json" : "design-receipt.json", designRecord: marker };
  if (op.type === "design.request" && op.action.kind !== "start") effect = { type: "item.edit", itemId, version, expectedVersionId: op.action.brief.versionId, patch: {} };
  else {
    const position = op.type === "design.request" ? op.action as Extract<DesignRequestAction, { kind: "start" }> : op;
    effect = { type: "item.add", itemId, version, title, width: position.width ?? 360, height: position.height ?? 280, placement: position.placement ?? (record.kind === "brief" && record.targetItemId ? { anchorItemId: record.targetItemId } : { x: 0, y: 0 }), ...(record.kind === "brief" && state.project.groupMode === "groups" && record.groupId ? { containerId: record.groupId } : {}) };
  }
  return { ...op, effect };
}

/** Reads admitted records only; malformed JSON remains an explicit unavailable row, never inferred admission. */
export async function readDesignRequests(store: Store, state: CanvasState, home: string, registry: ActorRegistry, history: readonly LogEntry[]): Promise<DesignRequestsResponse> {
  const requests: DesignRequestState[] = [], receipts: DesignReceiptState[] = [], unavailable: DesignRequestsResponse["unavailable"] = [];
  for (const item of Object.values(state.canvas.items)) {
    const version = item.versions.find((v) => v.id === item.currentVersionId), marker = version?.designRecord;
    if (!version || !marker) continue;
    try {
      validateDesignRecordVersion(version, state.project.id);
      const ref = reference(home, state.project.id, item.id, version), value = await readRecord(store, state.project.id, version);
      if (marker.kind === "receipt") { const receipt = parseDesignReceipt(value); if (receipt.requestId !== marker.requestId || receipt.epoch !== marker.epoch) bad("receipt admission metadata disagrees with its JSON"); receipts.push({ ref, receipt, author: version.createdBy, marker, status: "current", reasons: [], checkFreshness: [] }); continue; }
      const brief = parseDesignBrief(value);
      if (!brief.continuation || brief.requestId !== marker.requestId || brief.epoch !== marker.epoch) bad("brief admission metadata disagrees with its JSON");
      const reasons = [...designRequestReasons(state, brief, registry), ...localInputReasons(state, home, brief, item.id)];
      const status = reasons.some((r) => /cancelled/.test(r)) ? "cancelled" : reasons.length ? "stale" : "current";
      requests.push({ ref, brief, author: version.createdBy, marker, status, reasons, remainingInitialQuestions: initialDesignQuestionIds(history, brief.requestId, item.id).length ? 0 : 3, questions: questionnaireStates(state.canvas, { requestId: brief.requestId }).filter((q) => q.questions.brief.itemId === item.id), receipts: [], allowedActions: status === "current" ? brief.progress === "completed" ? ["resume", "cancel", "receipt"] : ["update", "resume", "cancel", "complete"] : ["resume", "cancel"] });
    } catch (error) { unavailable.push({ itemId: item.id, reason: error instanceof Error ? error.message : String(error) }); }
  }
  for (const receipt of receipts) {
    const value = receipt.receipt;
    const request = requests.find((r) => r.brief.requestId === value.requestId && r.ref.itemId === value.brief.itemId);
    type Finding = { reason: string; unavailable: boolean };
    const shared: Finding[] = !request ? [{ reason: "The request is unavailable.", unavailable: true }] : [...(!sameRef(value.brief, request.ref) || value.epoch !== request.brief.epoch || request.brief.progress !== "completed" ? [{ reason: "The completed brief changed.", unavailable: false }] : []), ...request.reasons.map((reason) => ({ reason, unavailable: false }))];
    const policy: Finding[] = [];
    const inspect = async (artifact: DesignArtifactRef, label: string, findings: Finding[]) => {
      if (artifact.home !== home || artifact.canvasId !== state.project.id) return;
      if (!(await contextBlobAvailable(store, state.project.id, artifact.blobHash))) findings.push({ reason: `${label} bytes are unavailable.`, unavailable: true });
      else { try { currentVersion(state, home, artifact); } catch { findings.push({ reason: `${label} live binding changed or was removed.`, unavailable: false }); } }
    };
    await inspect(value.brief, "Completed brief", shared);
    if (value.output.kind === "canvas") await inspect(value.output.artifact, "Output", shared);
    for (const artifact of value.context) await inspect(artifact, `Context ${artifact.itemId}`, policy);
    policy.push(...governingReasons(state, home, value).map((reason) => ({ reason, unavailable: false })));
    if (value.governing?.artifact) await inspect(value.governing.artifact, "Governing source", policy);
    const all = [...shared, ...policy];
    for (const check of value.checks) {
      const findings = [...shared, ...(check.kind === "source" || check.kind === "craft" ? policy : [])];
      for (const artifact of check.evidence) if (artifact.home === home && artifact.canvasId === state.project.id && !(await contextBlobAvailable(store, state.project.id, artifact.blobHash))) { const finding = { reason: `Evidence for ${check.id} is unavailable.`, unavailable: true }; all.push(finding); findings.push(finding); }
      receipt.checkFreshness.push({ checkId: check.id, status: findings.some((f) => f.unavailable) ? "unavailable" : findings.length ? "stale" : "current", reasons: [...new Set(findings.map((f) => f.reason))] });
    }
    receipt.reasons = [...new Set(all.map((f) => f.reason))]; receipt.status = all.some((f) => f.unavailable) ? "unavailable" : all.length ? "stale" : "current";
    if (request) request.receipts.push(receipt);
    else unavailable.push({ itemId: receipt.ref.itemId, reason: "The receipt’s admitted request is unavailable." });
  }
  return { requests, unavailable };
}
