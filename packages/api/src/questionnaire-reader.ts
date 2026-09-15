import { normalizeHomeUrl, resolveActor, type CanvasSnapshotResponse, type Operation, type PostOpResponse, type ItemVersion } from "@isocan/core";
import { parseDesignQuestionSet, parseDesignResponse, type DesignQuestionSet, type DesignResponse, type DesignArtifactRef } from "@isocan/core/design-partner";
import { questionnaireStates } from "@isocan/core/questionnaire";

type QuestionnaireOperation = Extract<Operation, { type: "questionnaire.ask" | "questionnaire.answer" }>;
/** Readers can narrow a conversation without changing selection or marking it answered. */
export interface DesignQuestionsOptions {
  threadId?: string;
  requestId?: string;
  respondentActorId?: string;
  signal?: AbortSignal;
}
/** The public API carries the same effective answers and outstanding questions as the dock. */
export type DesignQuestionsResult = ReturnType<typeof questionnaireStates>;
/** Transport uncertainty must retain the intent instead of looking like a rejected or saved answer. */
export type QuestionnaireDelivery =
  | { status: "accepted"; receipt: PostOpResponse }
  | { status: "pending" | "refused"; reason: string };
/** Browser and Node provide transport only; they use the same records and receipts. */
export interface QuestionnairePort {
  actorId?: string;
  snapshot(canvasId: string, signal?: AbortSignal): Promise<Pick<CanvasSnapshotResponse, "canvas" | "joined">>;
  send(canvasId: string, operation: QuestionnaireOperation, options: { opId: string; signal?: AbortSignal }): Promise<QuestionnaireDelivery>;
}
/** References read through the same authority as the canvas, including retained historical blobs. */
export interface QuestionnaireReferencePort {
  snapshot(canvasId: string, signal?: AbortSignal): Promise<Pick<CanvasSnapshotResponse, "canvas">>;
  home(canvasId: string): Promise<string>;
  blobBytes(canvasId: string, hash: string, signal?: AbortSignal): Promise<Uint8Array>;
}
/** An exact answer location prevents a reference name from resolving against another conversation. */
export interface DesignReferenceRequest {
  threadId: string;
  commentId: string;
  referenceId: string;
  signal?: AbortSignal;
}
/** Verified bytes remain paired with the writer-retained version that supplied them. */
export interface DesignReferenceContent {
  referenceId: string;
  artifact: DesignArtifactRef;
  version: ItemVersion;
  bytes: Uint8Array;
}
/** Publishing binds an immutable question set to one existing thread and retry identity. */
export interface DesignAskRequest {
  canvasId: string;
  threadId: string;
  commentId: string;
  opId: string;
  questions: DesignQuestionSet;
  legacySource?: { threadId: string; commentId: string; body: string };
  signal?: AbortSignal;
}
/** A saved answer intent keeps its original source and IDs through failed delivery and retries. */
export interface DesignAnswerRequest {
  canvasId: string;
  threadId: string;
  commentId: string;
  opId: string;
  response: DesignResponse;
  signal?: AbortSignal;
}
/** Both surfaces report matching writer evidence; an uncertain result keeps the same retry IDs. */
export interface QuestionnaireSubmission {
  status: "accepted" | "pending" | "refused";
  canvasId: string;
  threadId: string;
  commentId: string;
  payloadId: string;
  /** Actual receipt identity, unknown when a saved comment alone confirms delivery. */
  opId: string | null;
  /** The caller's original retry identity is retained even if the writer returned an older receipt. */
  submittedOpId: string;
  reason?: string;
  seq?: number;
  confirmedBy?: "receipt" | "snapshot";
}

/** Fetch once, then let the core resolver derive open and resolved questions from typed comments. */
export async function readDesignQuestions(io: Pick<QuestionnairePort, "snapshot">, canvasId: string, options: DesignQuestionsOptions = {}): Promise<DesignQuestionsResult> {
  options.signal?.throwIfAborted();
  const { canvas, joined } = await io.snapshot(canvasId, options.signal);
  options.signal?.throwIfAborted();
  return questionnaireStates(canvas, { ...options, ...(joined ? { joined } : {}) });
}

/** Opens the exact immutable source attached to this answer, including after an item edit or removal. */
export async function readDesignReference(io: QuestionnaireReferencePort, canvasId: string, request: DesignReferenceRequest): Promise<DesignReferenceContent> {
  request.signal?.throwIfAborted();
  const { canvas } = await io.snapshot(canvasId, request.signal);
  const comment = canvas.threads[request.threadId]?.comments.find(one => one.id === request.commentId);
  if (!comment || comment.design?.kind !== "response") throw new Error("No typed design answer exists at this exact comment.");
  const response = parseDesignResponse(comment.design);
  const references = response.resolutions.flatMap(resolution => resolution.state === "answered" && resolution.value.kind === "references" ? resolution.value.references : []);
  const matches = references.filter(one => one.id === request.referenceId);
  if (matches.length > 1) throw new Error("This reference ID occurs in more than one question. Use distinct reference IDs when publishing an answer.");
  const reference = matches[0];
  if (!reference) throw new Error("That reference ID is not attached to this answer.");
  if (reference.state !== "fetched" || !reference.artifact) throw new Error(`Reference ${reference.id} is ${reference.state}${reference.reason ? `: ${reference.reason}` : "; no fetched bytes were recorded"}.`);
  const artifact = reference.artifact;
  const retained = comment.designReferences?.find(one => one.artifact.home === artifact.home && one.artifact.canvasId === artifact.canvasId && one.artifact.itemId === artifact.itemId && one.artifact.versionId === artifact.versionId && one.artifact.blobHash === artifact.blobHash);
  if (!retained || retained.version.id !== artifact.versionId || retained.version.blobHash !== artifact.blobHash) throw new Error("The writer retained no matching version for this reference.");
  if (artifact.canvasId !== canvasId || normalizeHomeUrl(artifact.home) !== normalizeHomeUrl(await io.home(canvasId))) throw new Error("This reference belongs to another home or canvas; copy it through an authorized canvas path first.");
  const bytes = await io.blobBytes(canvasId, artifact.blobHash, request.signal);
  request.signal?.throwIfAborted();
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (hash !== artifact.blobHash || bytes.byteLength !== retained.version.size) throw new Error("Reference bytes do not match their retained version.");
  return { referenceId: reference.id, artifact, version: retained.version, bytes };
}

function identity(request: { canvasId: string; threadId: string; commentId: string; opId: string }): void {
  for (const key of ["canvasId", "threadId", "commentId", "opId"] as const) {
    if (typeof request[key] !== "string" || !request[key].trim() || request[key].length > 256) throw new Error(`A bounded ${key} is required; retain it when retrying.`);
  }
}
function supportedRequest(request: object, fields: readonly string[]): void {
  if (Object.keys(request).some(key => !fields.includes(key))) throw new Error("Unsupported questionnaire submission field; canonical context and retained references belong to the writer.");
}

function semantic(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(semantic).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${semantic(child)}`).join(",")}}`;
  return JSON.stringify(value);
}

type QuestionnaireWritePort = Pick<QuestionnairePort, "send" | "actorId"> & Partial<Pick<QuestionnairePort, "snapshot">>;

/** Only explicit validation/admission failures prove non-acceptance; timeouts and server failures do not. */
export function questionnaireFailureStatus(error: unknown): "refused" | "pending" {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return typeof status === "number" && [400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 426].includes(status) ? "refused" : "pending";
}

async function observedSubmission(io: QuestionnaireWritePort, request: DesignAskRequest | DesignAnswerRequest, op: QuestionnaireOperation, result: QuestionnaireSubmission): Promise<QuestionnaireSubmission> {
  if (!io.snapshot) return result;
  try {
    const { canvas, joined } = await io.snapshot(request.canvasId, request.signal);
    const comment = canvas.threads[request.threadId]?.comments.find(one => one.id === request.commentId);
    const payload = op.type === "questionnaire.ask" ? op.questions : op.response;
    const expectedActor = io.actorId ?? (op.type === "questionnaire.answer" ? op.response.respondentActorId : undefined);
    if (!comment || expectedActor === undefined || resolveActor(joined ?? {}, comment.author.id) !== resolveActor(joined ?? {}, expectedActor) || !comment.design || !comment.designReferences ||
        semantic(comment.design) !== semantic(payload) || op.type === "questionnaire.ask" && semantic(comment.designLegacySource ?? null) !== semantic(op.legacySource ?? null)) return result;
    return { status: "accepted", canvasId: result.canvasId, threadId: result.threadId, commentId: result.commentId, payloadId: result.payloadId, opId: null, submittedOpId: request.opId, confirmedBy: "snapshot" };
  } catch { return result; }
}

async function submit(io: QuestionnaireWritePort, request: DesignAskRequest | DesignAnswerRequest, op: QuestionnaireOperation, payloadId: string): Promise<QuestionnaireSubmission> {
  identity(request);
  request.signal?.throwIfAborted();
  const result: QuestionnaireSubmission = { status: "pending", canvasId: request.canvasId, threadId: request.threadId, commentId: request.commentId, payloadId, opId: null, submittedOpId: request.opId };
  let delivered: QuestionnaireDelivery;
  try { delivered = await io.send(request.canvasId, op, { opId: request.opId, ...(request.signal ? { signal: request.signal } : {}) }); }
  catch (error) {
    const failed = { ...result, status: questionnaireFailureStatus(error), reason: error instanceof Error ? error.message : String(error) };
    return failed.status === "pending" ? observedSubmission(io, request, op, failed) : failed;
  }
  if (delivered.status !== "accepted") {
    const failed = { ...result, status: delivered.status, reason: delivered.reason };
    return delivered.status === "pending" ? observedSubmission(io, request, op, failed) : failed;
  }
  const envelope = delivered.receipt?.envelope, saved = envelope?.op;
  const expectedActor = io.actorId ?? (op.type === "questionnaire.answer" ? op.response.respondentActorId : undefined);
  const expectedPayload = op.type === "questionnaire.ask" ? op.questions : op.response;
  const savedPayload = saved?.type === "questionnaire.ask" ? saved.questions : saved?.type === "questionnaire.answer" ? saved.response : undefined;
  let authorMatches = expectedActor === undefined || envelope?.actor?.id === expectedActor;
  if (!authorMatches && io.snapshot) {
    try {
      const { joined } = await io.snapshot(request.canvasId, request.signal);
      authorMatches = resolveActor(joined ?? {}, envelope.actor.id) === resolveActor(joined ?? {}, expectedActor!);
    } catch { /* An unverified alias cannot establish writer authorship. */ }
  }
  if (typeof envelope?.id !== "string" || !envelope.id || envelope.canvasId !== request.canvasId || !authorMatches ||
      saved?.type !== op.type || saved.threadId !== op.threadId || saved.commentId !== op.commentId || semantic(savedPayload) !== semantic(expectedPayload) ||
      op.type === "questionnaire.ask" && saved.type === "questionnaire.ask" && semantic(saved.legacySource ?? null) !== semantic(op.legacySource ?? null)) {
    return observedSubmission(io, request, op, { ...result, reason: "The writer returned no matching questionnaire receipt. Keep this submission and check its IDs before retrying." });
  }
  return { ...result, status: "accepted", opId: envelope.id, seq: delivered.receipt.seq, confirmedBy: "receipt" };
}

/** IDs belong to the caller's draft. A timeout keeps them retryable; it is never success. */
export async function askDesignQuestions(io: QuestionnaireWritePort, request: DesignAskRequest): Promise<QuestionnaireSubmission> {
  supportedRequest(request, ["canvasId", "threadId", "commentId", "opId", "questions", "legacySource", "signal"]);
  const questions = parseDesignQuestionSet(request.questions);
  return submit(io, request, { type: "questionnaire.ask", threadId: request.threadId, commentId: request.commentId, questions, ...(request.legacySource ? { legacySource: request.legacySource } : {}) }, questions.id);
}

/** Answers travel as refusing canonical operations; prose is never substituted for a typed response. */
export async function answerDesignQuestions(io: QuestionnaireWritePort, request: DesignAnswerRequest): Promise<QuestionnaireSubmission> {
  supportedRequest(request, ["canvasId", "threadId", "commentId", "opId", "response", "signal"]);
  const response = parseDesignResponse(request.response);
  if (request.threadId !== response.question.threadId) throw new Error("The answer must use its question's exact thread.");
  return submit(io, request, { type: "questionnaire.answer", threadId: request.threadId, commentId: request.commentId, response }, response.id);
}

/** Stable wire identities for a saved payload ID, shared by both client surfaces. */
export async function questionnaireSubmissionIds(kind: "ask" | "answer", payloadId: string): Promise<{ opId: string; commentId: string }> {
  if (!payloadId.trim()) throw new Error("A saved payload ID is required.");
  const bytes = new TextEncoder().encode(`questionnaire:${kind}:${payloadId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return { opId: `op_${hash}`, commentId: `cmt_${hash}` };
}
