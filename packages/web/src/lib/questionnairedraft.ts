import { parseDesignReference, parseDesignResponse } from "@isocan/core/design-partner";
import type { DesignQuestion, DesignQuestionSet, DesignQuestionSource, DesignReference, DesignResolution, DesignResponse } from "@isocan/core";

/** Local upload identity and retry bytes; it is never an answered reference until acknowledged. */
export interface QuestionUploadDraft {
  id: string; fileKey: string; name: string; mimeType: string; size: number;
  itemId: string; versionId: string; opId: string;
  state: "waiting" | "uploading" | "failed" | "ready";
  destination: { originGroupMode: "legacy" | "groups"; containerId?: string | null };
  blobHash?: string; reference?: DesignReference; error?: string;
}
/** Each question owns its own unsent values and any explicit resolution. */
export interface QuestionDraft {
  fingerprint: string;
  previousFingerprint?: string | null;
  optionIds: string[];
  text: string;
  useText: boolean;
  urlInput: string;
  references: DesignReference[];
  uploads: QuestionUploadDraft[];
  resolution: "answer" | "skipped" | "dismissed" | "delegated";
  agentActorId: string;
  /** Changed definitions never silently reuse an old choice. */
  needsReview: boolean;
}
/** One respondent’s local draft for one immutable published question source. */
export interface QuestionnaireDraft {
  version: 1;
  source: DesignQuestionSource;
  currentQuestionId: string;
  questions: Record<string, QuestionDraft>;
  submission: { opId: string; commentId: string; response: DesignResponse } | null;
}
/** Changes to a published definition make a retained draft require review. */
export const questionFingerprint = (q: DesignQuestion): string => JSON.stringify(q);
/** Start every question with separate empty values, without implying a skipped answer. */
export function emptyQuestionDraft(q: DesignQuestion): QuestionDraft {
  return { fingerprint: questionFingerprint(q), previousFingerprint: null, optionIds: [], text: "", useText: false, urlInput: "", references: [], uploads: [], resolution: "answer", agentActorId: "", needsReview: false };
}
/** Partition drafts by actor, canvas, request epoch and exact published source. */
export function questionnaireDraftKey(canvasId: string, actorId: string, questions: DesignQuestionSet, source: DesignQuestionSource): string {
  return `isocan.questionnaire.v1:${JSON.stringify([canvasId, actorId, questions.requestId, questions.epoch, source.threadId, source.commentId, source.payloadId, source.revision])}`;
}
/** Old drafts stay under their old identity. Only explicitly reissued sources may offer a copy. */
export function reconcileQuestionnaireDraft(saved: QuestionnaireDraft | null, questions: DesignQuestionSet, source: DesignQuestionSource): QuestionnaireDraft {
  const exact = saved?.version === 1 && sameQuestionSource(saved.source, source);
  const previous = exact ? saved : null;
  const drafts = Object.fromEntries(questions.questions.map((q) => {
    const old = previous?.questions[q.id];
    if (!old) return [q.id, emptyQuestionDraft(q)];
    const changed = old.fingerprint !== questionFingerprint(q);
    return [q.id, { ...old, fingerprint: questionFingerprint(q), ...(changed ? { previousFingerprint: old.previousFingerprint ?? old.fingerprint } : {}), needsReview: old.needsReview || changed,
      uploads: old.uploads.map((upload) => upload.state === "uploading" ? { ...upload, state: "failed" as const, error: "Upload interrupted. Retry to check the saved item and finish." } : upload) }];
  }));
  const currentQuestionId = previous && questions.questions.some((q) => q.id === previous.currentQuestionId) ? previous.currentQuestionId : questions.questions[0]!.id;
  return { version: 1, source, currentQuestionId, questions: drafts, submission: previous?.submission ?? null };
}
/** Browser persistence is a convenience, never protocol validation. Corrupt storage starts a fresh draft. */
export function readQuestionnaireDraft(storage: Pick<Storage, "getItem">, key: string): QuestionnaireDraft | null {
  const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
  const string = (value: unknown): value is string => typeof value === "string" && value.length <= 128000;
  const source = (value: unknown): value is DesignQuestionSource => record(value) && ["threadId", "commentId", "payloadId"].every((id) => string(value[id]) && value[id].length > 0) && Number.isSafeInteger(value.revision) && Number(value.revision) > 0;
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (!record(value) || value.version !== 1 || !record(value.questions) || !source(value.source) || !string(value.currentQuestionId)) return null;
    for (const q of Object.values(value.questions)) {
      if (!record(q) || !string(q.fingerprint) || !string(q.text) || !string(q.urlInput) || !string(q.agentActorId) || typeof q.useText !== "boolean" || typeof q.needsReview !== "boolean" || !Array.isArray(q.optionIds) || q.optionIds.some((id) => !string(id)) || !Array.isArray(q.references) || !Array.isArray(q.uploads) || !["answer", "skipped", "dismissed", "delegated"].includes(String(q.resolution))) return null;
      if (q.previousFingerprint !== undefined && q.previousFingerprint !== null && !string(q.previousFingerprint)) return null;
      q.references.forEach(parseDesignReference);
      for (const upload of q.uploads) {
        if (!record(upload) || !["id", "fileKey", "name", "mimeType", "itemId", "versionId", "opId"].every((id) => string(upload[id]) && upload[id].length > 0) || !Number.isSafeInteger(upload.size) || Number(upload.size) < 0 || !["waiting", "uploading", "failed", "ready"].includes(String(upload.state)) || !record(upload.destination) || !["legacy", "groups"].includes(String(upload.destination.originGroupMode)) || (upload.destination.containerId !== undefined && upload.destination.containerId !== null && !string(upload.destination.containerId))) return null;
        if (upload.blobHash !== undefined && (typeof upload.blobHash !== "string" || !/^[a-f0-9]{64}$/.test(upload.blobHash))) return null;
        if (upload.error !== undefined && !string(upload.error)) return null;
        if (upload.reference !== undefined) {
          const reference = parseDesignReference(upload.reference);
          if (reference.id !== upload.id || reference.artifact?.itemId !== upload.itemId || reference.artifact?.versionId !== upload.versionId || reference.artifact?.blobHash !== upload.blobHash) return null;
        }
        if (upload.state === "ready" && (!record(upload.reference) || upload.reference.state !== "fetched" || !upload.reference.artifact)) return null;
      }
    }
    if (value.submission !== null) {
      if (!record(value.submission) || !string(value.submission.opId) || !value.submission.opId || !string(value.submission.commentId) || !value.submission.commentId) return null;
      const response = parseDesignResponse(value.submission.response);
      if (!sameQuestionSource(response.question, value.source)) return null;
    }
    return value as unknown as QuestionnaireDraft;
  } catch { return null; }
}
/** A source identity compares fields, independently of JSON property order. */
function sameQuestionSource(a: DesignQuestionSource, b: DesignQuestionSource): boolean {
  return a.threadId === b.threadId && a.commentId === b.commentId && a.payloadId === b.payloadId && a.revision === b.revision;
}
/** Explicit draft transfer retains stable question IDs; changed definitions require review and submissions never transfer. */
export function transferQuestionnaireDraft(saved: QuestionnaireDraft, questions: DesignQuestionSet, source: DesignQuestionSource): QuestionnaireDraft {
  const remapped = { ...saved, source, submission: null };
  return reconcileQuestionnaireDraft(remapped, questions, source);
}
/** Explain a removed selection with its previously shown title; corrupt or missing history never exposes protocol IDs. */
export function unavailableChoiceMessage(question: DesignQuestion, draft: QuestionDraft): string | null {
  const removed = draft.optionIds.filter((id) => !question.options.some((option) => option.id === id));
  if (!removed.length) return null;
  const fallback = "An earlier choice is no longer available. Choose a current option or write your own answer.";
  try {
    const previous: unknown = JSON.parse(draft.previousFingerprint ?? draft.fingerprint);
    if (!previous || typeof previous !== "object" || !("id" in previous) || previous.id !== question.id || !("options" in previous) || !Array.isArray(previous.options)) return fallback;
    const options = previous.options;
    const titles = removed.map((id) => {
      const found = options.filter((option: unknown) => option && typeof option === "object" && "id" in option && option.id === id);
      const option = found.length === 1 ? found[0] : null;
      return option && typeof option.title === "string" && option.title.trim() && option.title.length <= 32000 ? option.title : null;
    });
    return titles.every((title): title is string => title !== null) ? `Earlier choices are no longer offered: ${titles.join(", ")}. Choose a current option or write your own answer.` : fallback;
  } catch { return fallback; }
}
/** A question is submittable only when its draft expresses an explicit supported outcome. */
export function questionDraftResolution(q: DesignQuestion, draft: QuestionDraft): DesignResolution | null {
  if (draft.needsReview) return null;
  if (draft.resolution === "skipped") return q.skippable ? { questionId: q.id, state: "skipped" } : null;
  if (draft.resolution === "dismissed") return { questionId: q.id, state: "dismissed" };
  if (draft.resolution === "delegated") return q.delegatable && draft.agentActorId ? { questionId: q.id, state: "delegated", agentActorId: draft.agentActorId } : null;
  if (q.renderer === "upload") {
    if (!draft.uploads.length || draft.uploads.some((upload) => upload.state !== "ready" || !upload.reference)) return null;
    return { questionId: q.id, state: "answered", value: { kind: "references", references: draft.uploads.map((upload) => upload.reference!) } };
  }
  if (q.renderer === "url-collection") return draft.references.length ? { questionId: q.id, state: "answered", value: { kind: "references", references: draft.references } } : null;
  if (q.renderer === "freeform" || draft.useText) return draft.text.trim() ? { questionId: q.id, state: "answered", value: { kind: "text", text: draft.text.trim() } } : null;
  const allowed = draft.optionIds.every((id) => q.options.some((option) => option.id === id));
  return allowed && draft.optionIds.length && (q.multiple || draft.optionIds.length === 1) ? { questionId: q.id, state: "answered", value: { kind: "options", optionIds: draft.optionIds } } : null;
}

const FILE_DB = "isocan-questionnaire-files-v1";
function fileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error ?? new Error("Could not keep this upload for retry."));
    request.onsuccess = () => resolve(request.result);
  });
}
/** File bytes survive refresh; a filename never stands in for an attachment. */
export async function keepQuestionFile(key: string, file: File): Promise<void> {
  const db = await fileDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Could not keep this upload for retry."));
    });
  } finally { db.close(); }
}
/** Recover the actual selected bytes after a refresh or interrupted upload. */
export async function readQuestionFile(key: string): Promise<Blob | null> {
  const db = await fileDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction("files", "readonly").objectStore("files").get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
/** Release locally retained bytes only after their versioned reference is acknowledged. */
export async function forgetQuestionFile(key: string): Promise<void> {
  const db = await fileDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
