import { designSkipped, normalizeHomeUrl, resolveActor, sourceFaceOf, visualFaceOf, type CanvasSnapshotResponse, type ItemVersion, type PostOpResponse, type SourceClassificationRequest } from "@isocan/core";
import { designPartnerPolicy, type DesignArtifactRef } from "@isocan/core/design-partner";
import { sameDesignArtifact } from "@isocan/core/design-partner-plan";
import { designIntentHash, parseDesignRequestOperation, type DesignAcceptedResponse, type DesignRequestAction, type DesignRecordOperation, type DesignReceiptPublication, type DesignRequestsResponse, type DesignRequestState, type DesignReceiptState, type DesignGoverningBinding } from "@isocan/core/design-request";
import type { DesignRetainedReference } from "@isocan/core/design-record";
import { questionnaireSourceCurrent } from "@isocan/core/questionnaire";
import type { DesignAuditReadPort } from "./design-audit-reader.ts";
import { readGoverningDesign, type GoverningDesignRead } from "./design-governing.ts";
import { designWorkflowProcedure } from "./design-workflow.ts";
import { questionnaireFailureStatus } from "./questionnaire-reader.ts";
import { effectiveOutstandingDecisionIds, type DesignDecisionsResponse } from "@isocan/core/design-decision";
import type { DesignComparisonView, DesignDecisionView } from "./design-decision-reader.ts";

/** Request selection uses canonical identities; neither client scans arbitrary JSON artifacts. */
export interface DesignRequestFilter { requestId?: string; threadId?: string; commentId?: string; outputItemId?: string }
/** Browsers and Node inject their existing authenticated and source-policy-bearing transports. */
export interface DesignRequestReadPort extends DesignAuditReadPort {
  actorId?: string | undefined;
  snapshot(canvasId: string, signal?: AbortSignal): Promise<CanvasSnapshotResponse>;
  home(canvasId: string, signal?: AbortSignal): Promise<string>;
  requests(canvasId: string, signal?: AbortSignal): Promise<DesignRequestsResponse>;
  decisions(canvasId: string, signal?: AbortSignal): Promise<DesignDecisionsResponse>;
  decisionActors(canvasId: string, signal?: AbortSignal): Promise<{ actors: Array<{ id: string; name: string; kind: "human" | "agent" | "unknown" }> }>;
  blobBytes(canvasId: string, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
  sourceBlobBytes(source: SourceClassificationRequest, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
}
/** Currentness describes named inputs; it does not promote an attributed browser report into attestation. */
export interface DesignReceiptView extends DesignReceiptState { affectedChecks: string[]; runtimeFreshness: "not-applicable" | "reported" }
/** One view drives CLI continuation, chat cards, the brief face and output association. */
export interface DesignRequestView extends Omit<DesignRequestState, "receipts"> {
  governing: GoverningDesignRead;
  governingBinding: DesignGoverningBinding;
  outputGovernings: Array<{ itemId: string; governing: GoverningDesignRead; binding: DesignGoverningBinding }>;
  contextReferences: DesignArtifactRef[];
  receipts: DesignReceiptView[];
  reconciliation: DesignAcceptedResponse[];
  missingFactIds: string[];
  comparisons: DesignComparisonView[];
  decisionHistory: DesignDecisionView[];
  effectiveDecisions: DesignDecisionView[];
  outstandingDecisionIds: string[];
  nextAction: "clarify" | "reconcile" | "answer" | "compare" | "decide" | "build" | "verify" | "resume" | "review";
}
/** Unreadable admitted records remain visible alongside usable request views. */
export interface DesignRequestReadResult { requests: DesignRequestView[]; unavailable: DesignRequestsResponse["unavailable"] }
/** The shared procedure travels with current canvas policy and the same request projection. */
export interface DesignWorkflowView extends DesignRequestReadResult { policy: "off" | "adaptive-v1" | "unsupported"; procedure: string; reviews?: import("./design-review-reader.ts").DesignReviewReadResult }
/** Delivery uncertainty preserves the caller's retry identity and never invents an accepted operation ID. */
export interface DesignRequestSubmission {
  status: "accepted" | "pending" | "refused";
  canvasId: string;
  itemId: string;
  versionId: string;
  submittedOpId: string;
  opId: string | null;
  confirmedBy?: "receipt" | "snapshot";
  seq?: number;
  reason?: string;
}
/** One canonical operation is sent through a writer-observed result, never a local optimistic queue alone. */
export interface DesignRequestWritePort extends Pick<DesignRequestReadPort, "actorId" | "snapshot"> {
  send(canvasId: string, operation: DesignRecordOperation, options: { opId: string; signal?: AbortSignal }): Promise<{ status: "accepted"; receipt: PostOpResponse } | { status: "pending" | "refused"; reason: string }>;
}
/** A stable prepared intent is retained unchanged across retries. */
export interface DesignStartRequest { canvasId: string; opId: string; action: Extract<DesignRequestAction, { kind: "start" }>; signal?: AbortSignal }
/** Updates capture their exact brief and epoch; resume is an explicit lifecycle act. */
export interface DesignChangeRequest { canvasId: string; opId: string; action: Exclude<DesignRequestAction, { kind: "start" }>; signal?: AbortSignal }
/** Receipt publication identifies its separate canvas artifact and the completed brief it reports. */
export interface DesignPublishRequest extends DesignReceiptPublication { canvasId: string; opId: string; signal?: AbortSignal }

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const sameRef = (a: DesignArtifactRef | null, b: DesignArtifactRef | null) => a === null ? b === null : b !== null && sameDesignArtifact(a, b);
function capturedContextReferences(state: DesignRequestState): DesignArtifactRef[] {
  return state.brief.context.entries.flatMap(entry => !entry.excluded && !entry.unavailable && entry.version ? [{ home: state.ref.home, canvasId: state.brief.context.canvasId, itemId: entry.itemId, versionId: entry.version.id, blobHash: entry.version.blobHash }] : []);
}
const matches = (state: DesignRequestState, filter: DesignRequestFilter, decisions: readonly DesignDecisionView[]) => (!filter.requestId || state.brief.requestId === filter.requestId)
  && (!filter.outputItemId || state.brief.outputIds.includes(filter.outputItemId) || decisions.some(one => one.decision.input.requestId === state.brief.requestId && one.decision.input.basis.brief.itemId === state.ref.itemId && one.decision.adopted.itemId === filter.outputItemId))
  && (!filter.threadId || state.brief.source.entrance === "canvas-chat" && state.brief.source.threadId === filter.threadId)
  && (!filter.commentId || state.brief.source.entrance === "canvas-chat" && state.brief.source.commentId === filter.commentId);

/** Read canonical admission, then re-resolve current governing inputs through permitted source reads. */
export async function readDesignRequests(io: DesignRequestReadPort, options: { canvasId: string; filter?: DesignRequestFilter; signal?: AbortSignal }): Promise<DesignRequestReadResult> {
  const { canvasId, signal } = options;
  signal?.throwIfAborted();
  const response = await io.requests(canvasId, signal);
  const [snapshot, home] = await Promise.all([io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  const { readDesignComparisons } = await import("./design-decision-reader.ts");
  const choices = await readDesignComparisons(io, { canvasId, ...(signal ? { signal } : {}) });
  const requests: DesignRequestView[] = [];
  const sourceSnapshots = new Map<string, Promise<CanvasSnapshotResponse>>();
  const sourceBytes = new Map<string, Promise<Uint8Array>>();
  const exactCitations = new Map<string, Promise<void>>();
  const foreignSource = (artifact: DesignArtifactRef) => ({ canvasId: artifact.canvasId, expectedHome: normalizeHomeUrl(artifact.home) });
  const sourceSnapshot = (source: SourceClassificationRequest) => {
    const key = JSON.stringify(source);
    let pending = sourceSnapshots.get(key);
    if (!pending) { pending = io.sourceSnapshot(source, signal); sourceSnapshots.set(key, pending); }
    return pending;
  };
  const sourceContent = (source: SourceClassificationRequest, hash: string) => {
    const key = JSON.stringify([source, hash]);
    let pending = sourceBytes.get(key);
    if (!pending) { pending = io.sourceBlobBytes(source, hash, signal); sourceBytes.set(key, pending); }
    return pending;
  };
  const foreignSnapshot = (artifact: DesignArtifactRef) => sourceSnapshot(foreignSource(artifact));
  const foreignBytes = (artifact: DesignArtifactRef) => sourceContent(foreignSource(artifact), artifact.blobHash);
  const governingIo: DesignAuditReadPort = { ...io, sourceSnapshot, sourceBlobText: async (source, hash) => new TextDecoder().decode(await sourceContent(source, hash)) };
  const exactCitation = (artifact: DesignArtifactRef) => {
    const key = JSON.stringify([normalizeHomeUrl(artifact.home), artifact.canvasId, artifact.itemId, artifact.versionId, artifact.blobHash]);
    let pending = exactCitations.get(key);
    if (!pending) {
      pending = (async () => {
        const source = await foreignSnapshot(artifact);
        const version = source.canvas.items[artifact.itemId]?.versions.find(one => one.id === artifact.versionId && one.blobHash === artifact.blobHash);
        if (!version) throw new Error("The exact cited version is no longer available.");
        const bytes = await foreignBytes(artifact);
        const hash = await globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
        if (bytes.length !== version.size || [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("") !== artifact.blobHash) throw new Error("The cited bytes disagree with their exact identity.");
      })();
      exactCitations.set(key, pending);
    }
    return pending;
  };
  const governingReads = new Map<string, Promise<GoverningDesignRead>>();
  const governingAt = (atItemId: string | null) => {
    const key = atItemId ?? "";
    let value = governingReads.get(key);
    if (!value) {
      value = readGoverningDesign(governingIo, { canvasId, canvas: snapshot.canvas, project: snapshot.project, home, ...(atItemId ? { atId: atItemId } : {}), ...(signal ? { signal } : {}) });
      governingReads.set(key, value);
    }
    return value;
  };
  for (const state of response.requests.filter(one => matches(one, options.filter ?? {}, choices.decisions))) {
    const atItemId = state.brief.targetItemId ?? state.brief.groupId;
    const governing = await governingAt(atItemId);
    const explicitNone = designSkipped(snapshot.project);
    const governingBinding: DesignGoverningBinding = { atItemId, artifact: governing.artifact, explicitNone };
    const reasons = [...state.reasons];
    const current = snapshot.canvas.items[state.ref.itemId];
    const changedDuringRead = !current || current.currentVersionId !== state.ref.versionId;
    if (changedDuringRead) reasons.push("The brief changed while its continuation was being read; refresh before acting.");
    const unavailableCitations: string[] = [];
    const historical = [...state.brief.references.flatMap(reference => reference.artifact ? [reference.artifact] : []), ...state.brief.facts.flatMap(fact => fact.sources)];
    for (const artifact of historical) {
      if (artifact.canvasId === canvasId && normalizeHomeUrl(artifact.home) === normalizeHomeUrl(home)) continue;
      try { await exactCitation(artifact); }
      catch (error) { signal?.throwIfAborted(); unavailableCitations.push(`Reference ${artifact.itemId}@${artifact.versionId} is unavailable at its source: ${message(error)}`); }
    }
    reasons.push(...new Set(unavailableCitations));
    const receipts: DesignReceiptView[] = [];
    for (const saved of state.receipts) {
      const receiptReasons = [...saved.reasons];
      const checkFreshness = saved.receipt.checks.map(check => structuredClone(saved.checkFreshness.find(one => one.checkId === check.id) ?? { checkId: check.id, status: "current" as const, reasons: [] as string[] }));
      const affect = (reason: string, status: "stale" | "unavailable", checkIds = saved.receipt.checks.map(check => check.id)) => {
        receiptReasons.push(reason);
        for (const current of checkFreshness.filter(one => checkIds.includes(one.checkId))) {
          if (current.status !== "unavailable") current.status = status;
          current.reasons = [...new Set([...current.reasons, reason])];
        }
      };
      const policyChecks = saved.receipt.checks.filter(check => check.kind !== "browser-task").map(check => check.id);
      let unavailable = saved.status === "unavailable" || unavailableCitations.length > 0;
      for (const reason of new Set(unavailableCitations)) affect(reason, "unavailable", policyChecks);
      if (!current || current.currentVersionId !== saved.receipt.brief.versionId) affect("The completed brief changed while its receipt was being read.", "stale");
      if (saved.receipt.output.kind === "canvas") {
        const output = saved.receipt.output.artifact, item = snapshot.canvas.items[output.itemId];
        if (!item || item.currentVersionId !== output.versionId || item.versions.find(one => one.id === output.versionId)?.blobHash !== output.blobHash) affect("The output changed or is unavailable.", "stale");
      }
      const expected = saved.receipt.governing;
      if (expected) {
        const actual = await governingAt(saved.receipt.output.kind === "canvas" ? saved.receipt.output.artifact.itemId : expected.atItemId);
        if (actual.status === "unavailable") { unavailable = true; affect(actual.reason, "unavailable", policyChecks); }
        else if (!sameRef(expected.artifact, actual.artifact) || expected.explicitNone !== explicitNone) affect("The design system governing this output changed.", "stale", policyChecks);
      } else affect("This receipt has no captured governing selection.", "stale", policyChecks);
      for (const input of saved.receipt.context) {
        if (input.canvasId === canvasId && normalizeHomeUrl(input.home) === normalizeHomeUrl(home)) {
          // The writer's per-check reading already validates local context through
          // exact active adoption/repair transitions. A latest-pointer comparison
          // here would contradict that proof and stale a successfully repaired task.
          continue;
        }
        try {
          const sourceSnapshot = await foreignSnapshot(input);
          const item = sourceSnapshot.canvas.items[input.itemId];
          if (!item || item.currentVersionId !== input.versionId || item.versions.find(v => v.id === input.versionId)?.blobHash !== input.blobHash) affect(`Context ${input.itemId} changed at its source.`, "stale", policyChecks);
          else await foreignBytes(input);
        } catch (error) { signal?.throwIfAborted(); unavailable = true; affect(`Context ${input.itemId} is unavailable: ${message(error)}`, "unavailable", policyChecks); }
      }
      for (const check of saved.receipt.checks) for (const evidence of check.evidence) {
        if (evidence.canvasId === canvasId && normalizeHomeUrl(evidence.home) === normalizeHomeUrl(home)) continue;
        try {
          await exactCitation(evidence);
        } catch (error) { signal?.throwIfAborted(); unavailable = true; affect(`Evidence for ${check.id} is unavailable: ${message(error)}`, "unavailable", [check.id]); }
      }
      const changed = receiptReasons.length > 0;
      receipts.push({ ...saved, status: unavailable ? "unavailable" : changed ? "stale" : "current", reasons: [...new Set(receiptReasons)], checkFreshness, affectedChecks: checkFreshness.filter(one => one.status !== "current").map(one => one.checkId), runtimeFreshness: saved.receipt.output.kind === "repository" ? "reported" : "not-applicable" });
    }
    const stale = state.status === "stale" || reasons.length > state.reasons.length;
    const open = state.questions.some(question => question.status === "open");
    const accepted = state.brief.continuation?.acceptedResponses ?? [];
    const reconciliation = state.questions.filter(question => question.status !== "superseded" && question.questions.epoch === state.brief.epoch && !question.outstandingQuestionIds.length && questionnaireSourceCurrent(snapshot.canvas, question)).flatMap(question => question.responses.filter(one => !question.responses.some(later => later.response.supersedesResponseId === one.response.id) && !accepted.some(prior => prior.responseId === one.response.id && prior.question.threadId === question.source.threadId && prior.question.commentId === question.source.commentId && prior.question.payloadId === question.source.payloadId && prior.question.revision === question.source.revision)).map(one => ({ question: question.source, responseId: one.response.id })));
    const missingFactIds = [!state.brief.audience ? "audience" : null, !state.brief.primaryTask ? "primaryTask" : null].filter((one): one is string => one !== null);
    const initialDiscovery = missingFactIds.length > 0 && !state.questions.length && state.remainingInitialQuestions > 0;
    const outputGovernings = await Promise.all(state.brief.outputIds.map(async itemId => { const governing = await governingAt(itemId); return { itemId, governing, binding: { atItemId: itemId, artifact: governing.artifact, explicitNone } }; }));
    const comparisons = choices.comparisons.filter(one => one.comparison.requestId === state.brief.requestId && one.comparison.brief.itemId === state.ref.itemId);
    const decisionHistory = choices.decisions.filter(one => one.decision.input.requestId === state.brief.requestId && one.decision.input.basis.brief.itemId === state.ref.itemId);
    const effectiveDecisions = decisionHistory.filter(one => one.standing === "effective");
    const outstandingDecisionIds = effectiveOutstandingDecisionIds(state.brief, state.ref.itemId, decisionHistory);
    const unresolvedComparisonKeys = effectiveOutstandingDecisionIds({ ...state.brief, outstandingDecisionIds: comparisons.map(one => one.comparison.decisionKey) }, state.ref.itemId, decisionHistory);
    const pendingChoice = comparisons.find(one => one.comparison.epoch === state.brief.epoch && one.status !== "superseded" && unresolvedComparisonKeys.includes(one.comparison.decisionKey) && !["skip", "dismiss"].includes(one.effectiveResponse?.response.outcome.kind ?? ""));
    const choiceAction = pendingChoice && (pendingChoice.effectiveResponse?.response.outcome.kind === "delegate" || pendingChoice.comparison.audience.kind === "external-agent") && pendingChoice.status !== "stale" && !["more", "combine"].includes(pendingChoice.effectiveResponse?.response.outcome.kind ?? "") ? "decide" : "compare";
    requests.push({ ...state, status: stale ? "stale" : state.status, reasons, allowedActions: changedDuringRead ? [] : unavailableCitations.length ? state.allowedActions.filter(action => action === "resume" || action === "cancel") : state.allowedActions, governing, governingBinding, outputGovernings, contextReferences: capturedContextReferences(state), receipts, reconciliation, missingFactIds, comparisons, decisionHistory, effectiveDecisions, outstandingDecisionIds,
      nextAction: state.status === "cancelled" || stale ? "resume" : open ? "answer" : reconciliation.length ? "reconcile" : pendingChoice ? choiceAction : state.brief.progress === "completed" ? receipts.some(one => one.status === "current" && one.receipt.status === "ready") ? "review" : "verify" : initialDiscovery ? "clarify" : "build" });
  }
  return { requests, unavailable: response.unavailable };
}

/** Both entrances discover the same compact procedure and shared canvas-owned enrollment policy. */
export async function readDesignWorkflow(io: DesignRequestReadPort, options: { canvasId: string; filter?: DesignRequestFilter; signal?: AbortSignal }): Promise<DesignWorkflowView> {
  const [read, snapshot] = await Promise.all([readDesignRequests(io, options), io.snapshot(options.canvasId, options.signal)]);
  const reviewIO = io as Partial<import("./design-review-reader.ts").DesignReviewReadPort>;
  const reviews = reviewIO.history && reviewIO.repairs && reviewIO.sessions && reviewIO.answering ? await (await import("./design-review-reader.ts")).readDesignReviews(io as import("./design-review-reader.ts").DesignReviewReadPort, { canvasId: options.canvasId, ...(options.filter?.requestId ? { requestId: options.filter.requestId } : {}), ...(options.signal ? { signal: options.signal } : {}) }) : undefined;
  const requests = read.requests.map(request => {
    // Keep task discovery, custody and choice decisions ahead of review continuation.
    if (request.nextAction !== "build" || request.status !== "current" || request.brief.progress !== "active") return request;
    const reviewing = reviews?.runs.some(row => {
      const output = row.run.passes.at(-1)!.output;
      return row.run.request.requestId === request.brief.requestId && row.run.request.epoch === request.brief.epoch && sameDesignArtifact(row.run.request.brief, request.ref) && (output.kind === "repository" ? request.brief.delivery === "connected-app" : request.brief.outputIds.includes(output.artifact.itemId) || request.brief.targetItemId === output.artifact.itemId);
    });
    return reviewing ? { ...request, nextAction: "verify" as const } : request;
  });
  return { ...read, requests, policy: designPartnerPolicy(snapshot.project.properties ?? {}), procedure: designWorkflowProcedure, ...(reviews ? { reviews } : {}) };
}

async function submit(io: DesignRequestWritePort, canvasId: string, opId: string, input: DesignRecordOperation, signal?: AbortSignal): Promise<DesignRequestSubmission> {
  if (!opId.trim()) throw new Error("A stable operation ID is required.");
  const op = parseDesignRequestOperation(input);
  const itemId = op.type === "design.receipt" ? op.itemId : op.action.kind === "start" ? op.action.itemId : op.action.brief.itemId;
  const versionId = op.type === "design.receipt" ? op.versionId : op.action.versionId;
  const result: DesignRequestSubmission = { status: "pending", canvasId, itemId, versionId, submittedOpId: opId, opId: null };
  signal?.throwIfAborted();
  let delivered: Awaited<ReturnType<DesignRequestWritePort["send"]>>;
  try { delivered = await io.send(canvasId, op, { opId, ...(signal ? { signal } : {}) }); }
  catch (error) { delivered = { status: questionnaireFailureStatus(error), reason: message(error) }; }
  if (delivered.status === "refused") return { ...result, status: "refused", reason: delivered.reason };
  let snapshot: CanvasSnapshotResponse | undefined;
  try { snapshot = await io.snapshot(canvasId, signal); } catch { /* Receipt identity can still prove an unchanged actor. */ }
  const sameAuthor = (id: string) => !!io.actorId && (id === io.actorId || !!snapshot?.joined && resolveActor(snapshot.joined, id) === resolveActor(snapshot.joined, io.actorId));
  if (delivered.status === "accepted") {
    const { envelope } = delivered.receipt;
    if (envelope?.canvasId === canvasId && sameAuthor(envelope.actor.id)) {
      try {
        if (await designIntentHash(envelope.op as DesignRecordOperation, envelope.actor.id) === await designIntentHash(op, envelope.actor.id)) return { ...result, status: "accepted", opId: envelope.id, seq: delivered.receipt.seq, confirmedBy: "receipt" };
      } catch { /* A mismatched receipt is no proof that this intent was accepted. */ }
    }
  }
  const version = snapshot?.canvas.items[itemId]?.versions.find(one => one.id === versionId);
  const marker = version?.designRecord;
  if (marker && version && sameAuthor(version.createdBy.id) && marker.intentHash === await designIntentHash(op, version.createdBy.id)) return { ...result, status: "accepted", opId: marker.opId, confirmedBy: "snapshot" };
  return { ...result, reason: delivered.status === "pending" ? delivered.reason : "No receipt or canonical version confirmed this exact intent. Keep its IDs and retry after reconciling." };
}

/** Start is explicit in the wire vocabulary, with all retry IDs owned by the prepared intent. */
export function startDesignRequest(io: DesignRequestWritePort, request: DesignStartRequest): Promise<DesignRequestSubmission> {
  return submit(io, request.canvasId, request.opId, { type: "design.request", action: request.action }, request.signal);
}
/** Lifecycle changes preserve the same conditional writer boundary across browser and CLI. */
export function changeDesignRequest(io: DesignRequestWritePort, request: DesignChangeRequest): Promise<DesignRequestSubmission> {
  return submit(io, request.canvasId, request.opId, { type: "design.request", action: request.action }, request.signal);
}
/** Evidence publication is a separate undoable item, bound to its completed brief. */
export function publishDesignReceipt(io: DesignRequestWritePort, request: DesignPublishRequest): Promise<DesignRequestSubmission> {
  const { canvasId, opId, signal, ...publication } = request;
  return submit(io, canvasId, opId, { type: "design.receipt", ...publication }, signal);
}

/** Exact bytes retain their source identity, source/visual face metadata and availability. */
export interface DesignRequestReferenceContent { artifact: DesignArtifactRef; version: ItemVersion; title: string; face: "source" | "visual"; bytes: Uint8Array }
/** Reads only named request inputs/evidence; foreign bytes keep their source-policy transport. */
export async function readDesignRequestReference(io: DesignRequestReadPort, request: { canvasId: string; requestId: string; artifact: DesignArtifactRef; face?: "source" | "visual"; signal?: AbortSignal }): Promise<DesignRequestReferenceContent> {
  const { canvasId, artifact, signal } = request;
  const response = await io.requests(canvasId, signal);
  const state = response.requests.find(one => one.brief.requestId === request.requestId);
  if (!state) throw new Error("No admitted request has this identity.");
  const [snapshot, home] = await Promise.all([io.snapshot(canvasId, signal), io.home(canvasId, signal)]);
  const choices = await io.decisions(canvasId, signal);
  const comparisonReferences = [...choices.comparisons.filter(one => one.comparison.requestId === request.requestId).flatMap(one => one.references), ...choices.decisions.filter(one => one.decision.input.requestId === request.requestId).flatMap(one => one.references)];
  const retained: DesignRetainedReference[] = [...[state.marker, ...state.receipts.map(one => one.marker)].flatMap(marker => marker.retainedReferences), ...comparisonReferences];
  const known = [state.ref, ...capturedContextReferences(state), ...state.brief.references.flatMap(one => one.artifact ? [one.artifact] : []), ...state.brief.facts.flatMap(one => one.sources), ...state.receipts.flatMap(one => [one.ref, ...one.receipt.context, ...one.receipt.checks.flatMap(check => check.evidence), ...(one.receipt.governing?.artifact ? [one.receipt.governing.artifact] : []), ...(one.receipt.output.kind === "canvas" ? [one.receipt.output.artifact] : [])]), ...retained.map(one => one.artifact)];
  // A declared output is current-bound. This adds no latest-version fallback for historical citations.
  for (const itemId of state.brief.outputIds) {
    const item = snapshot.canvas.items[itemId], version = item?.versions.find(one => one.id === item.currentVersionId);
    if (version) known.push({ home: normalizeHomeUrl(home), canvasId, itemId, versionId: version.id, blobHash: version.blobHash });
  }
  if (!known.some(one => sameDesignArtifact(one, artifact))) {
    let identified = false;
    for (const atId of new Set([state.brief.targetItemId ?? state.brief.groupId, ...state.brief.outputIds])) {
      const governing = await readGoverningDesign(io, { canvasId, canvas: snapshot.canvas, project: snapshot.project, home, ...(atId ? { atId } : {}), ...(signal ? { signal } : {}) });
      if (governing.status === "available" && sameDesignArtifact(governing.artifact, artifact)) { identified = true; break; }
    }
    if (!identified) throw new Error("This artifact is not an identified input, governing document or evidence of this request.");
  }
  const local = artifact.canvasId === canvasId && normalizeHomeUrl(artifact.home) === normalizeHomeUrl(home);
  const source = { canvasId: artifact.canvasId, expectedHome: normalizeHomeUrl(artifact.home) };
  const origin = local ? snapshot : await io.sourceSnapshot(source, signal);
  const item = origin.canvas.items[artifact.itemId];
  const version = (local ? retained.find(one => sameDesignArtifact(one.artifact, artifact))?.version : undefined) ?? item?.versions.find(one => one.id === artifact.versionId);
  if (!version || version.blobHash !== artifact.blobHash) throw new Error("The exact referenced version is unavailable; a current version cannot replace it.");
  const face = request.face ?? "source";
  const content = face === "visual" ? visualFaceOf(version) : sourceFaceOf(version);
  const bytes = local ? await io.blobBytes(canvasId, content.blobHash, signal) : await io.sourceBlobBytes(source, content.blobHash, signal);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  const actualHash = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (actualHash !== content.blobHash || bytes.length !== content.size) throw new Error("The reference bytes disagree with their retained identity.");
  return { artifact, version, title: item?.title ?? version.filename, face, bytes };
}
