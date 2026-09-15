import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, DesignQuestionSet, DesignQuestionSource, DesignResponse, QuestionnaireState } from "@isocan/core";
import { newItemId, newOpId, newVersionId } from "@isocan/core";
import { parseDesignReference } from "@isocan/core/design-partner";
import { answerDesignQuestions, questionnaireSubmissionIds } from "@isocan/api/questionnaire";
import { questionnaireIO, uploadQuestionReference } from "../lib/questionnaire.ts";
import { creationDestination } from "../lib/groupplacement.ts";
import { mimeTypeOf } from "../lib/mime.ts";
import { forgetQuestionFile, keepQuestionFile, questionDraftResolution, questionnaireDraftKey, readQuestionFile, readQuestionnaireDraft, reconcileQuestionnaireDraft, transferQuestionnaireDraft, unavailableChoiceMessage, type QuestionnaireDraft, type QuestionDraft, type QuestionUploadDraft } from "../lib/questionnairedraft.ts";

import { LocalExactReferenceCard } from "./ExactReferenceCard.tsx";

interface QuestionnaireDockProps {
  canvasId: string;
  actor: Actor;
  state: QuestionnaireState;
  agents: Array<{ id: string; name: string }>;
  onCollapse: () => void;
}
function initialDraft(key: string, questions: DesignQuestionSet, source: DesignQuestionSource): QuestionnaireDraft {
  let saved: QuestionnaireDraft | null = null;
  try { saved = readQuestionnaireDraft(localStorage, key); } catch { /* Storage warning is shown on the first save. */ }
  return reconcileQuestionnaireDraft(saved, questions, source);
}
/** The dock renders shared records. Neither prose nor another participant can settle a question. */
export function QuestionnaireDock({ canvasId, actor, state, agents, onCollapse }: QuestionnaireDockProps) {
  const { questions, source } = state;
  const key = questionnaireDraftKey(canvasId, actor.id, questions, source);
  const [draft, setDraft] = useState(() => initialDraft(key, questions, source));
  const currentDraft = useRef(draft);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(() => {
    try { return localStorage.getItem(key) && !readQuestionnaireDraft(localStorage, key) ? "A saved draft could not be read. It remains in browser storage; this questionnaire starts with empty answers." : ""; }
    catch { return "Browser storage is unavailable. Keep this page open to preserve this draft."; }
  });
  const [transfer, setTransfer] = useState(() => {
    if (!questions.supersedes) return null;
    try { return readQuestionnaireDraft(localStorage, questionnaireDraftKey(canvasId, actor.id, questions, questions.supersedes)); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [refused, setRefused] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const outstanding = questions.questions.filter((q) => state.outstandingQuestionIds.includes(q.id));
  const q = outstanding.find((one) => one.id === draft.currentQuestionId) ?? outstanding[0];
  const idx = q ? outstanding.indexOf(q) : 0;
  useEffect(() => { titleRef.current?.focus(); }, [q?.id]);
  const persist = useCallback((next: QuestionnaireDraft) => {
    currentDraft.current = next;
    setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(""); }
    catch { setStorageError("This browser could not save the draft for refresh. Keep this page open, or free browser storage before continuing."); }
  }, [key]);
  useEffect(() => {
    const submission = currentDraft.current.submission;
    if (submission && state.responses.some((record) => record.response.id === submission.response.id && record.author.id === actor.id)) persist({ ...currentDraft.current, submission: null });
  }, [state.responses, actor.id, persist]);
  function updateQuestion(id: string, patch: Partial<QuestionDraft>) {
    const now = currentDraft.current;
    const old = now.questions[id];
    if (old) persist({ ...now, questions: { ...now.questions, [id]: { ...old, ...patch } } });
  }
  function updateUpload(questionId: string, id: string, patch: Partial<QuestionUploadDraft>) {
    const now = currentDraft.current.questions[questionId];
    if (now) updateQuestion(questionId, { uploads: now.uploads.map((one) => one.id === id ? { ...one, ...patch } : one) });
  }
  async function upload(questionId: string, value: QuestionUploadDraft) {
    updateUpload(questionId, value.id, { state: "uploading", error: "" });
    try {
      const file = await readQuestionFile(value.fileKey);
      const reference = await uploadQuestionReference(canvasId, actor, value, file, (patch) => updateUpload(questionId, value.id, patch));
      updateUpload(questionId, value.id, { state: "ready", reference, error: "" });
      try { await forgetQuestionFile(value.fileKey); } catch { /* A retained retry copy never turns a saved reference into a failure. */ }
    } catch (cause) { updateUpload(questionId, value.id, { state: "failed", error: cause instanceof Error ? cause.message : "Upload failed. Your draft is available to retry." }); }
  }
  async function addFiles(questionId: string, files: File[]) {
    updateQuestion(questionId, { resolution: "answer" });
    if ((currentDraft.current.questions[questionId]?.uploads.length ?? 0) + files.length > 20) { setError("Attach up to 20 files to one question."); return; }
    for (const file of files) {
      const id = `ref_${crypto.randomUUID()}`;
      const destination = creationDestination();
      const value: QuestionUploadDraft = { id, fileKey: `${key}:${id}`, name: file.name, mimeType: mimeTypeOf(file), size: file.size, itemId: newItemId(), versionId: newVersionId(), opId: newOpId(), destination, state: "waiting" };
      try { await keepQuestionFile(`${key}:${id}`, file); }
      catch (cause) { setError(`Could not keep ${file.name} for retry. ${cause instanceof Error ? cause.message : "Browser storage is unavailable or full."}`); continue; }
      const current = currentDraft.current.questions[questionId]!;
      updateQuestion(questionId, { uploads: [...current.uploads, value] });
      await upload(questionId, value);
    }
  }
  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setRefused(false);
    try {
      let submission = currentDraft.current.submission;
      if (!submission) {
        const resolutions = outstanding.map((question) => questionDraftResolution(question, currentDraft.current.questions[question.id]!));
        if (resolutions.some((resolution) => !resolution)) throw new Error("Answer, skip, delegate or dismiss each remaining question before submitting.");
        const response: DesignResponse = { schemaVersion: 1, kind: "response", id: `answer_${crypto.randomUUID()}`, requestId: questions.requestId, epoch: questions.epoch, question: source, respondentActorId: actor.id, resolutions: resolutions.filter((resolution) => resolution !== null), supersedesResponseId: null };
        const ids = await questionnaireSubmissionIds("answer", response.id);
        submission = { ...ids, response };
        persist({ ...currentDraft.current, submission });
      }
      const result = await answerDesignQuestions(questionnaireIO(actor), { canvasId, threadId: source.threadId, ...submission });
      if (result.status !== "accepted") {
        setRefused(result.status === "refused");
        throw new Error(result.reason ?? "The home has not confirmed your answer. Retry sends the same saved answer.");
      }
      persist({ ...currentDraft.current, submission: null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your answer was not confirmed. Retry uses the saved answer IDs."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (!q) return null;
  const answer = draft.questions[q.id]!;
  const locked = busy || draft.submission !== null;
  const isChoice = q.renderer === "choice-list" || q.renderer === "visual-cards";
  const resolved = questionDraftResolution(q, answer);
  const complete = outstanding.every((one) => questionDraftResolution(one, draft.questions[one.id]!));
  function advance() {
    if (idx < outstanding.length - 1) persist({ ...currentDraft.current, currentQuestionId: outstanding[idx + 1]!.id });
  }
  function addUrl() {
    try {
      if (answer.references.length >= 20) throw new Error("Attach up to 20 URLs to one question.");
      const reference = parseDesignReference({ id: `ref_${crypto.randomUUID()}`, state: "supplied", url: answer.urlInput.trim() });
      if (answer.references.some((r) => r.url === reference.url)) throw new Error("That URL is already attached to this question.");
      updateQuestion(q!.id, { references: [...answer.references, reference], urlInput: "", resolution: "answer" }); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enter an absolute HTTP or HTTPS URL."); }
  }
  return <section className="q-dock-container floats" aria-label="Design questions" data-question-payload={questions.id}>
    <header className="q-dock-head">
      <div className="q-dock-title-group"><span className="q-dock-eyebrow">{questions.headline}</span><h3 ref={titleRef} tabIndex={-1} className="q-dock-title">{q.title}</h3><p className="q-dock-desc">{q.consequence}</p></div>
      <button type="button" className="q-dock-close" onClick={onCollapse} aria-label="Minimize questions; keep draft">−</button>
    </header>
    {transfer && <div className="q-help"><p>This replaces earlier questions. You can copy your earlier draft; changed questions will need review.</p><button type="button" className="btn secondary" onClick={() => { persist(transferQuestionnaireDraft(transfer, questions, source)); setTransfer(null); }}>Copy earlier draft</button></div>}
    {questions.inferredAnswers.length > 0 && <details className="q-using"><summary>Using what we already know</summary>{questions.inferredAnswers.map((one) => <p key={one.questionId}>{one.value}</p>)}</details>}
    {outstanding.length > 1 && <nav className="q-dock-steps" aria-label="Questions">{outstanding.map((one, i) => <button type="button" key={one.id} className={`q-dock-step-pill ${one.id === q.id ? "active" : ""}`} aria-current={one.id === q.id ? "step" : undefined} onClick={() => persist({ ...currentDraft.current, currentQuestionId: one.id })}>{i + 1}<span className="q-step-name">. {one.title}</span>{questionDraftResolution(one, draft.questions[one.id]!) ? " ✓" : ""}</button>)}</nav>}
    <div className="q-dock-body">
      {answer.needsReview && <div role="alert"><p>This question changed. Your earlier draft is retained; review it before answering.</p>{unavailableChoiceMessage(q, answer) && <p>{unavailableChoiceMessage(q, answer)}</p>}<button type="button" className="btn secondary" onClick={() => updateQuestion(q.id, { needsReview: false, previousFingerprint: null, optionIds: answer.optionIds.filter((id) => q.options.some((option) => option.id === id)) })}>I reviewed this question</button></div>}
      <fieldset disabled={locked} className="q-fields"><legend className="sr-only">{q.title}</legend>
        {isChoice && <><div className={q.renderer === "visual-cards" ? "q-visual-cards-grid" : "q-choice-list"}>{q.options.map((option) => <div className={`q-card-base q-option ${!answer.useText && answer.optionIds.includes(option.id) ? "selected" : ""}`} key={option.id}>
          {option.preview && <LocalExactReferenceCard localCanvasId={canvasId} artifact={option.preview} version={state.references.find((ref) => ref.artifact.versionId === option.preview!.versionId && ref.artifact.itemId === option.preview!.itemId)?.version} name={option.title} />}
          <label><input type={q.multiple ? "checkbox" : "radio"} name={`${questions.id}-${q.id}`} value={option.id} checked={!answer.useText && answer.optionIds.includes(option.id)} onChange={() => updateQuestion(q.id, { optionIds: q.multiple ? answer.optionIds.includes(option.id) ? answer.optionIds.filter((id) => id !== option.id) : [...answer.optionIds, option.id] : [option.id], useText: false, resolution: "answer" })} /><span><strong>{option.title}</strong>{q.recommendedOptionId === option.id && <small className="q-recommended">Recommended</small>}<span className="q-option-consequence">{option.consequence}</span></span></label>
        </div>)}</div><label className="q-other"><input type="checkbox" checked={answer.useText} onChange={(e) => updateQuestion(q.id, { useText: e.target.checked, resolution: "answer" })} />Write my own answer</label></>}
        {(q.renderer === "freeform" || (isChoice && answer.useText)) && <label className="q-field-label">Your answer<textarea className="q-textarea" rows={3} value={answer.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value, resolution: "answer" })} /></label>}
        {/* The picker and this drop attach files to an answer, not a chosen canvas point;
            uploadQuestionReference requests automatic placement for the saved files. */}
        {q.renderer === "upload" && <div className="q-upload-area" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!locked) void addFiles(q.id, Array.from(e.dataTransfer.files)); }}>
          <label className="q-field-label">Attach sketches, images or documents<input type="file" multiple aria-label={`Upload for ${q.title}`} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void addFiles(q.id, files); }} /></label>
          <p className="q-help">Your files stay attached to this answer after upload. You can also drop them here.</p>
          {answer.uploads.map((one) => <div className="q-upload-row" key={one.id}>{one.reference?.artifact ? <LocalExactReferenceCard localCanvasId={canvasId} artifact={one.reference.artifact} version={{ mimeType: one.mimeType, filename: one.name }} name={one.name} /> : <strong>{one.name}</strong>}<span role="status">{one.state === "ready" ? "Uploaded" : one.state === "uploading" ? "Uploading…" : "Not uploaded"}</span>{one.error && <p role="alert">{one.error}</p>}{one.state === "failed" && <button type="button" className="btn secondary" onClick={() => void upload(q.id, one)}>Retry {one.name}</button>}<button type="button" disabled={one.state === "uploading"} onClick={() => { updateQuestion(q.id, { uploads: answer.uploads.filter((other) => other.id !== one.id) }); void forgetQuestionFile(one.fileKey).catch(() => setStorageError("The attachment was removed from this draft, but its local retry copy could not be cleared.")); }}>Remove {one.name}</button></div>)}
        </div>}
        {q.renderer === "url-collection" && <div className="q-url-area"><label className="q-field-label">Reference URL<input type="url" className="q-text-input" value={answer.urlInput} placeholder="https://…" onChange={(e) => updateQuestion(q.id, { urlInput: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} /></label><button type="button" className="btn secondary" disabled={!answer.urlInput.trim()} onClick={addUrl}>Add URL</button><p className="q-help">Supplied URLs have not been inspected. The designer must report whether each reference is accessible.</p>{answer.references.map((ref) => <div className="q-url-reference" key={ref.id}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.url}</a><span>Supplied · not inspected</span><button type="button" onClick={() => updateQuestion(q.id, { references: answer.references.filter((other) => other.id !== ref.id) })}>Remove URL</button></div>)}</div>}
        <div className="q-resolution-actions">
          {q.skippable && <button type="button" className="q-btn-ghost" aria-pressed={answer.resolution === "skipped"} onClick={() => updateQuestion(q.id, { resolution: "skipped" })}>Skip this question</button>}
          <button type="button" className="q-btn-ghost" aria-pressed={answer.resolution === "dismissed"} onClick={() => updateQuestion(q.id, { resolution: "dismissed" })}>Dismiss this question</button>
          {q.delegatable && agents.length > 0 && <label className="q-field-label">Let a designer decide<select value={answer.resolution === "delegated" ? answer.agentActorId : ""} onChange={(e) => updateQuestion(q.id, { resolution: e.target.value ? "delegated" : "answer", agentActorId: e.target.value })}><option value="">Choose an agent…</option>{agents.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}</select></label>}
        </div>
        {answer.resolution !== "answer" && <p className="q-resolution-note" role="status">{answer.resolution === "skipped" ? "Will be recorded as skipped; no fact is supplied." : answer.resolution === "dismissed" ? "Will be recorded as dismissed." : "Will record your delegation to the selected agent."} <button type="button" onClick={() => updateQuestion(q.id, { resolution: "answer" })}>Answer instead</button></p>}
      </fieldset>
    </div>
    {storageError && <p className="q-error" role="alert">{storageError}</p>}{error && <p className="q-error" role="alert">{error}</p>}
    <footer className="q-dock-foot"><button type="button" className="q-btn-ghost" disabled={idx === 0} onClick={() => persist({ ...currentDraft.current, currentQuestionId: outstanding[idx - 1]!.id })}>Back</button>
      {refused && draft.submission && <button type="button" className="q-btn-ghost" onClick={() => { persist({ ...currentDraft.current, submission: null }); setRefused(false); setError(""); }}>Edit answers</button>}
      {draft.submission || idx === outstanding.length - 1 ? <button type="button" className="btn primary" disabled={busy || (!draft.submission && !complete)} onClick={() => void submit()}>{busy ? "Submitting…" : draft.submission ? "Retry submission" : "Submit answers"}</button> : <button type="button" className="btn primary" disabled={!resolved || locked} onClick={advance}>Continue</button>}
    </footer>
  </section>;
}
