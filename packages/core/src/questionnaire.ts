import type { Actor, CanvasContents, Comment, ItemVersion } from "./model.ts";
import type { Operation } from "./ops.ts";
import { validateDesignRetainedReferences } from "./design-retention.ts";
import { OpValidationError } from "./errors.ts";
import { DesignPartnerContractError, parseDesignArtifactRef, parseDesignQuestionSet, parseDesignResponse, type DesignArtifactRef, type DesignQuestionSet, type DesignQuestionSource, type DesignResolution, type DesignResponse } from "./design-partner.ts";
import { sameActor, type ActorJoins } from "./identity.ts";
import { validateDesignDecisionComment } from "./design-decision-state.ts";

/** Exact legacy text selected for explicit adoption; another reply cannot infer its respondent. */
export interface LegacyQuestionSource { threadId: string; commentId: string; body: string }
/** Writer-retained version metadata keeps both source and visual bytes reachable after source pruning. */
export interface QuestionnaireRetainedReference { artifact: DesignArtifactRef; version: ItemVersion }
/** Public intent and canonical writer output share a refusing operation type; callers cannot provide retained fields. */
export type QuestionnaireOperation =
  Extract<Operation, { type: "questionnaire.ask" | "questionnaire.answer" }>;
/** Answer history keeps immutable typed outcomes beside the operation's actual authored comment. */
interface QuestionnaireResponseRecord { response: DesignResponse; commentId: string; author: Actor }
/** One projection used by CLI, dock and standing; source freshness never erases accepted history. */
export interface QuestionnaireState {
  source: DesignQuestionSource;
  questions: DesignQuestionSet;
  author: Actor;
  responses: QuestionnaireResponseRecord[];
  resolutions: DesignResolution[];
  outstandingQuestionIds: string[];
  references: QuestionnaireRetainedReference[];
  status: "open" | "answered" | "superseded" | "stale";
  legacySource?: LegacyQuestionSource;
}
/** Public eligibility exposes resolved kind and identity, without private claim or credential records. */
export interface QuestionnaireActor { id: string; name: string; kind: "human" | "agent" | "unknown" }
/** Both clients reach the writer's eligibility read through the ordinary canvas permission boundary. */
export const questionnaireActorsRoute = (canvasId: string): string => `/api/projects/${encodeURIComponent(canvasId)}/questionnaire/actors`;
const sameSource = (a: DesignQuestionSource, b: DesignQuestionSource) => a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;

/** Exact authored question text remains a valid response source even when its brief version later changes. */
export function questionnaireSourceCurrent(canvas: CanvasContents, question: Pick<QuestionnaireState, "source" | "questions" | "legacySource">): boolean {
  const { source, questions, legacySource } = question;
  const comment = canvas.threads[source.threadId]?.comments.find((c) => c.id === source.commentId);
  if (!comment || comment.design?.kind !== "questions" || comment.design.id !== source.payloadId || comment.design.revision !== source.revision || comment.body !== questionnaireQuestionMarkdown(questions, !!legacySource)) return false;
  return !legacySource || canvas.threads[legacySource.threadId]?.comments.find((c) => c.id === legacySource.commentId)?.body === legacySource.body;
}
/** Only typed, writer-stamped responses resolve questions. Retained history survives stale inputs. */
export function questionnaireStates(canvas: CanvasContents, filter: { threadId?: string; requestId?: string; respondentActorId?: string; joined?: ActorJoins } = {}): QuestionnaireState[] {
  const all = Object.values(canvas.threads).flatMap((thread) => thread.comments.map((comment) => ({ thread, comment })));
  const asks = all.filter(({ comment }) => comment.design?.kind === "questions");
  return asks.flatMap(({ thread, comment }) => {
    const questions = comment.design as DesignQuestionSet;
    if (filter.threadId && filter.threadId !== thread.id || filter.requestId && filter.requestId !== questions.requestId || filter.respondentActorId && !sameActor(filter.joined, filter.respondentActorId, questions.respondentActorId)) return [];
    const source: DesignQuestionSource = { threadId: thread.id, commentId: comment.id, payloadId: questions.id, revision: questions.revision };
    const responses = all.flatMap(({ thread: answerThread, comment: answer }) => {
      const response = answer.design;
      return response?.kind === "response" && answerThread.id === source.threadId && sameSource(response.question, source) && response.requestId === questions.requestId && response.epoch === questions.epoch ? [{ response, commentId: answer.id, author: answer.author }] : [];
    });
    const live = responses.filter((r) => !responses.some((other) => other.response.supersedesResponseId === r.response.id));
    const resolutions = live.flatMap((r) => r.response.resolutions);
    const outstandingQuestionIds = questions.questions.filter((q) => !resolutions.some((r) => r.questionId === q.id)).map((q) => q.id);
    const brief = canvas.items[questions.brief.itemId];
    const superseded = asks.some(({ comment: other }) => other.design?.kind === "questions" && other.design.supersedes && sameSource(other.design.supersedes, source));
    const legacy = comment.designLegacySource;
    const stale = !questionnaireSourceCurrent(canvas, { source, questions, ...(legacy ? { legacySource: legacy } : {}) }) || !brief || brief.currentVersionId !== questions.brief.versionId || brief.versions.find((v) => v.id === questions.brief.versionId)?.blobHash !== questions.brief.blobHash;
    const references = [comment, ...responses.map((r) => all.find(({ thread: t, comment: c }) => t.id === source.threadId && c.id === r.commentId)!.comment)].flatMap((c) => c.designReferences ?? []);
    return [{ source, questions, author: comment.author, responses, resolutions, outstandingQuestionIds, references, status: superseded ? "superseded" : stale ? "stale" : outstandingQuestionIds.length ? "open" : "answered", ...(legacy ? { legacySource: legacy } : {}) } satisfies QuestionnaireState];
  });
}
/** Human-readable projection; structured outcome readers never parse this generated prose. */
export function questionnaireQuestionMarkdown(questions: DesignQuestionSet, adopted = false): string {
  return [...(adopted ? ["Adopted legacy questionnaire for the named respondent.", ""] : []), questions.headline,
    ...questions.inferredAnswers.map((a) => `Using ${a.questionId}: ${a.value}`),
    ...questions.questions.map((q) => [`${q.title} — ${q.consequence}`, ...q.options.map((o) => `- ${o.title}: ${o.consequence}`)].join("\n")),
  ].join("\n\n");
}
/** Exact identities requiring writer reads and retention, excluding URLs merely supplied as text. */
export function questionnaireArtifacts(design: DesignQuestionSet | DesignResponse): DesignArtifactRef[] {
  const references = design.kind === "questions" ? [design.brief, ...design.inferredAnswers.flatMap((a) => a.sources), ...design.questions.flatMap((q) => q.options.flatMap((o) => o.preview ? [o.preview] : []))]
    : design.resolutions.flatMap((r) => r.state === "answered" && r.value.kind === "references" ? r.value.references.flatMap((reference) => reference.artifact ? [reference.artifact] : []) : []);
  if (references.length > 1024) throw new OpValidationError("bad-op", "questionnaire has too many retained references");
  return references;
}
/** Ordinary comment acts cannot mint typed authority; internal restores retain already canonical records. */
export function rejectQuestionnaireMetadata(op: Operation): void {
  const raw = op as unknown as Record<string, unknown>;
  const comment = op.type === "thread.create" || op.type === "thread.reply" ? op.comment as unknown as Record<string, unknown> : op.type === "comment.update" ? raw : null;
  const fields = ["design", "designReferences", "designLegacySource"];
  if (comment && fields.some((key) => key in comment) || fields.some((key) => key in raw)) throw new OpValidationError("bad-op", "typed questionnaire metadata is writer-owned; use questionnaire.ask or questionnaire.answer");
}
/** Validates canonical replay metadata without looking at now-pruned live items. */
export function validateQuestionnaireComment(comment: Comment, canvasId: string): void {
  try { validateCanonicalComment(comment, canvasId); }
  catch (error) {
    if (error instanceof DesignPartnerContractError) throw new OpValidationError("bad-op", error.message);
    throw error;
  }
}
function validateCanonicalComment(comment: Comment, canvasId: string): void {
  if (comment.designDecision !== undefined) { validateDesignDecisionComment(comment, canvasId); return; }
  if (comment.design === undefined) {
    if (comment.designReferences !== undefined || comment.designLegacySource !== undefined) throw new OpValidationError("bad-op", "questionnaire metadata requires a typed record");
    return;
  }
  const design = comment.design?.kind === "questions" ? parseDesignQuestionSet(comment.design) : parseDesignResponse(comment.design);
  if (comment.designLegacySource !== undefined && (design.kind !== "questions" || !obj(comment.designLegacySource, ["threadId", "commentId", "body"]) || !str(comment.designLegacySource.threadId) || !str(comment.designLegacySource.commentId) || !parseLegacyQuestionnaire(comment.designLegacySource.body))) throw new OpValidationError("bad-op", "invalid retained legacy questionnaire source");
  validateDesignRetainedReferences(comment.designReferences, canvasId, questionnaireArtifacts(design), 1024);
}

/** Old visual cards may contain swatches; adoption never claims these are actual artifact previews. */
interface LegacyQuestionOption { id: string; title: string; body?: string; eyebrow?: string; colors?: string[]; description?: string }
/** Compatible legacy rendering shape, validated before the dock sees optional fields. */
interface LegacyQuestionSpec { id: string; title: string; description?: string; renderer: "choice-list" | "visual-cards" | "upload" | "url-collection" | "freeform"; label?: string; multiSelect?: boolean; skippable?: boolean; placeholder?: string; options?: LegacyQuestionOption[] }
/** Legacy data remains readable without acquiring author/response authority from surrounding prose. */
export interface LegacyQuestionnaire { headline?: string; inferredAnswers?: Array<{ questionId: string; displayValue: string }>; questions: LegacyQuestionSpec[] }
const obj = (value: unknown, fields: string[]): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => fields.includes(key));
const str = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 32000;
const optionalStrings = (value: Record<string, unknown>, names: string[]) => names.every((key) => value[key] === undefined || str(value[key]));
/** Legacy parsing is a conservative read-only adapter. Malformed text stays text. */
export function parseLegacyQuestionnaire(body: string): LegacyQuestionnaire | null {
  if (!/^\/ask\s+\{/.test(body) || body.length > 256000) return null;
  try {
    const value: unknown = JSON.parse(body.slice(4).trim());
    if (!obj(value, ["headline", "inferredAnswers", "questions"]) || !optionalStrings(value, ["headline"]) || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > 32) return null;
    const questionIds = new Set<string>();
    for (const q of value.questions) {
      if (!obj(q, ["id", "title", "description", "renderer", "label", "multiSelect", "skippable", "placeholder", "options"]) || !str(q.id) || questionIds.has(q.id as string) || !str(q.title) || !optionalStrings(q, ["description", "label", "placeholder"]) || !["choice-list", "visual-cards", "upload", "url-collection", "freeform"].includes(q.renderer as string) || ["multiSelect", "skippable"].some((key) => q[key] !== undefined && typeof q[key] !== "boolean")) return null;
      questionIds.add(q.id as string);
      const isChoice = q.renderer === "choice-list" || q.renderer === "visual-cards";
      if (isChoice && (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12) || !isChoice && q.options !== undefined && (!Array.isArray(q.options) || q.options.length !== 0)) return null;
      const optionIds = new Set<string>();
      for (const o of (q.options ?? []) as unknown[]) {
        if (!obj(o, ["id", "title", "body", "eyebrow", "colors", "description"]) || !str(o.id) || optionIds.has(o.id as string) || !str(o.title) || !optionalStrings(o, ["body", "eyebrow", "description"]) || o.colors !== undefined && (!Array.isArray(o.colors) || o.colors.length > 12 || o.colors.some((color) => typeof color !== "string" || !/^#[\da-f]{3,8}$/i.test(color)))) return null;
        optionIds.add(o.id as string);
      }
    }
    if (value.inferredAnswers !== undefined && (!Array.isArray(value.inferredAnswers) || value.inferredAnswers.length > 1000 || new Set(value.inferredAnswers.map((a) => a?.questionId)).size !== value.inferredAnswers.length || value.inferredAnswers.some((a) => !obj(a, ["questionId", "displayValue"]) || !str(a.questionId) || !str(a.displayValue)))) return null;
    return structuredClone(value) as unknown as LegacyQuestionnaire;
  } catch { return null; }
}
export { legacyQuestionSet } from "./questionnaire-adoption.ts";
