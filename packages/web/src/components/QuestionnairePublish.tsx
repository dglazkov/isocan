import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor, DesignQuestion, DesignQuestionSet, QuestionnaireActor, LegacyQuestionSource } from "@isocan/core";
import { parseLegacyQuestionnaire } from "@isocan/core/questionnaire";
import { legacyQuestionSet } from "@isocan/core/questionnaire-adoption";
import { parseDesignQuestionSet } from "@isocan/core/design-partner";
import { askDesignQuestions, questionnaireSubmissionIds } from "@isocan/api/questionnaire";
import { browserDesignBriefs, questionnaireIO, type BrowserDesignBrief } from "../lib/questionnaire.ts";

interface QuestionInput { id: string; title: string; consequence: string; renderer: DesignQuestion["renderer"]; optionA: string; consequenceA: string; optionB: string; consequenceB: string; recommended: string; skippable: boolean; delegatable: boolean }
const newQuestion = (): QuestionInput => ({ id: `question_${crypto.randomUUID()}`, title: "", consequence: "", renderer: "freeform", optionA: "", consequenceA: "", optionB: "", consequenceB: "", recommended: "", skippable: true, delegatable: false });
/** Explicit publishing, bounded to the default question budget; no protocol JSON in the authoring flow. */
export function QuestionnairePublish({ canvasId, threadId, actor, actors, legacySource, onClose }: {
  canvasId: string; threadId: string; actor: Actor; actors: QuestionnaireActor[]; legacySource?: LegacyQuestionSource | undefined; onClose: () => void;
}) {
  const storageKey = `isocan.questionnaire.publish.v1:${JSON.stringify([canvasId, actor.id, threadId, legacySource?.commentId ?? null])}`;
  const [saved] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (!value || typeof value.briefId !== "string" || typeof value.respondent !== "string" || typeof value.headline !== "string" || !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 3 || value.questions.some((q: unknown) => !q || typeof q !== "object" || ["id", "title", "consequence", "renderer", "optionA", "consequenceA", "optionB", "consequenceB", "recommended"].some((key) => typeof (q as Record<string, unknown>)[key] !== "string") || !["freeform", "choice-list", "upload", "url-collection"].includes(String((q as QuestionInput).renderer)) || typeof (q as QuestionInput).skippable !== "boolean" || typeof (q as QuestionInput).delegatable !== "boolean")) return null;
      if (value.pending !== null && (!value.pending || typeof value.pending.opId !== "string" || typeof value.pending.commentId !== "string")) return null;
      if (value.pending) parseDesignQuestionSet(value.pending.questions);
      return value as { briefId: string; respondent: string; headline: string; questions: QuestionInput[]; pending: { questions: DesignQuestionSet; commentId: string; opId: string } | null };
    } catch { return null; }
  });
  const [briefs, setBriefs] = useState<BrowserDesignBrief[]>([]);
  const [briefId, setBriefId] = useState(saved?.briefId ?? "");
  const [respondent, setRespondent] = useState(saved?.respondent ?? "");
  const [headline, setHeadline] = useState(saved?.headline ?? "A few decisions for the design");
  const [questions, setQuestions] = useState<QuestionInput[]>(saved?.questions ?? [newQuestion()]);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [briefError, setBriefError] = useState("");
  const [readAttempt, setReadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ questions: DesignQuestionSet; commentId: string; opId: string } | null>(saved?.pending ?? null);
  const [refused, setRefused] = useState(false);
  const keep = useCallback((pendingValue = pending) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ briefId, respondent, headline, questions, pending: pendingValue })); setStorageError(""); }
    catch { setStorageError("The publishing draft could not be saved for refresh. Keep this page open until the home confirms it."); }
  }, [storageKey, briefId, respondent, headline, questions, pending]);
  useEffect(() => { keep(); }, [keep]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const controller = new AbortController();
    setLoading(true); setBriefError("");
    void browserDesignBriefs(canvasId, controller.signal).then(setBriefs).catch((cause) => { if (!controller.signal.aborted) { setBriefs([]); setBriefError(cause instanceof Error ? cause.message : "Could not read design briefs."); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canvasId, readAttempt]);
  function patch(id: string, value: Partial<QuestionInput>) { setQuestions((current) => current.map((one) => one.id === id ? { ...one, ...value } : one)); }
  async function publish() {
    if (busy) return;
    setBusy(true); setError(""); setRefused(false);
    try {
      let submission = pending;
      if (!submission) {
        const basis = briefs.find((one) => one.artifact.itemId === briefId);
        if (!basis) throw new Error("Choose a current design brief.");
        if (!actors.some((one) => one.id === respondent && one.kind === "human")) throw new Error("Choose the person who should answer.");
        const identity = { requestId: basis.brief.requestId, epoch: basis.brief.epoch, brief: basis.artifact, respondentActorId: respondent, id: `questions_${crypto.randomUUID()}`, revision: 1 };
        let payload: DesignQuestionSet;
        if (legacySource) {
          const legacy = parseLegacyQuestionnaire(legacySource.body);
          if (!legacy) throw new Error("The legacy questionnaire is no longer valid.");
          payload = legacyQuestionSet(legacy, identity);
        } else payload = { schemaVersion: 1, kind: "questions", ...identity, headline, inferredAnswers: [], supersedes: null, questions: questions.map((q) => ({ id: q.id, title: q.title.trim(), consequence: q.consequence.trim(), renderer: q.renderer, multiple: false, skippable: q.skippable, delegatable: q.delegatable,
          options: q.renderer === "choice-list" ? [{ id: `${q.id}_a`, title: q.optionA.trim(), consequence: q.consequenceA.trim() }, { id: `${q.id}_b`, title: q.optionB.trim(), consequence: q.consequenceB.trim() }] : [],
          ...(q.renderer === "choice-list" && q.recommended ? { recommendedOptionId: `${q.id}_${q.recommended}` } : {}),
        })) };
        payload = parseDesignQuestionSet(payload);
        const ids = await questionnaireSubmissionIds("ask", payload.id);
        submission = { questions: payload, ...ids }; keep(submission); setPending(submission);
      }
      const result = await askDesignQuestions(questionnaireIO(actor), { canvasId, threadId, ...submission, ...(legacySource ? { legacySource } : {}) });
      if (result.status !== "accepted") { setRefused(result.status === "refused"); throw new Error(result.reason ?? "The home did not confirm this question. Retry uses the same question IDs."); }
      try { localStorage.removeItem(storageKey); } catch { /* Receipt already proves this was published. */ }
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The question could not be published."); }
    finally { setBusy(false); }
  }
  const disabled = busy || pending !== null;
  return <section className="q-publish q-dock-container" aria-label="Publish design questions"><header className="q-dock-head"><h3 tabIndex={-1} ref={heading}>{legacySource ? "Adopt these legacy questions" : "Ask a design question"}</h3><button type="button" onClick={onClose} aria-label="Close question publisher">✕</button></header>
    <form onSubmit={(e) => { e.preventDefault(); void publish(); }}>
      <fieldset className="q-fields" disabled={disabled}><legend className="sr-only">Question details</legend>
        <label className="q-field-label">Design brief<select required value={briefId} onChange={(e) => setBriefId(e.target.value)}><option value="">{loading ? "Reading briefs…" : "Choose a brief…"}</option>{briefs.map((one) => <option key={one.artifact.itemId} value={one.artifact.itemId}>{one.title}</option>)}</select></label>
        {!loading && !briefError && briefs.length === 0 && <p className="q-help">This canvas has no active design brief yet. Add a design brief before publishing questions.</p>}
        <label className="q-field-label">Who should answer?<select required value={respondent} onChange={(e) => setRespondent(e.target.value)}><option value="">Choose a person…</option>{actors.filter((one) => one.kind === "human").map((one) => <option key={one.id} value={one.id}>{one.name}{one.id === actor.id ? " (you)" : ""}</option>)}</select></label>
        {!actors.some((one) => one.kind === "human") && <p className="q-help">The home has not identified an eligible human respondent.</p>}
        {legacySource ? <p className="q-help">The original questions remain in the conversation. Publishing explicitly binds them to this brief and person; earlier replies are not treated as answers.</p> : <>
          <label className="q-field-label">Introduction<input required maxLength={240} value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
          {questions.map((q, index) => <div className="q-publish-question" key={q.id}><h4>Question {index + 1}</h4><label className="q-field-label">Question<input required value={q.title} onChange={(e) => patch(q.id, { title: e.target.value })} /></label><label className="q-field-label">Why this affects the design<textarea required rows={2} value={q.consequence} onChange={(e) => patch(q.id, { consequence: e.target.value })} /></label><label className="q-field-label">Answer format<select value={q.renderer} onChange={(e) => patch(q.id, { renderer: e.target.value as DesignQuestion["renderer"] })}><option value="freeform">Written answer</option><option value="choice-list">Two choices, or a written answer</option><option value="upload">Upload references</option><option value="url-collection">Reference URLs</option></select></label>
            {q.renderer === "choice-list" && <><label className="q-field-label">First choice<input required value={q.optionA} onChange={(e) => patch(q.id, { optionA: e.target.value })} /></label><label className="q-field-label">First choice consequence<input required value={q.consequenceA} onChange={(e) => patch(q.id, { consequenceA: e.target.value })} /></label><label className="q-field-label">Second choice<input required value={q.optionB} onChange={(e) => patch(q.id, { optionB: e.target.value })} /></label><label className="q-field-label">Second choice consequence<input required value={q.consequenceB} onChange={(e) => patch(q.id, { consequenceB: e.target.value })} /></label><label className="q-field-label">Recommendation<select value={q.recommended} onChange={(e) => patch(q.id, { recommended: e.target.value })}><option value="">No recommendation yet</option><option value="a">First choice</option><option value="b">Second choice</option></select></label></>}
            <label className="q-other"><input type="checkbox" checked={q.skippable} onChange={(e) => patch(q.id, { skippable: e.target.checked })} />Allow skipping</label><label className="q-other"><input type="checkbox" checked={q.delegatable} onChange={(e) => patch(q.id, { delegatable: e.target.checked })} />Allow delegation to an agent</label>{questions.length > 1 && <button type="button" onClick={() => setQuestions((old) => old.filter((one) => one.id !== q.id))}>Remove question {index + 1}</button>}
          </div>)}
          {questions.length < 3 && <button type="button" className="btn secondary" onClick={() => setQuestions((old) => [...old, newQuestion()])}>Add question</button>}
        </>}
      </fieldset>
      {briefError && <div className="q-error" role="alert"><p>{briefError}</p><button type="button" className="btn secondary" onClick={() => setReadAttempt((value) => value + 1)}>Retry loading briefs</button></div>}
      {storageError && <p className="q-error" role="alert">{storageError}</p>}
      {error && <p className="q-error" role="alert">{error}</p>}
      <footer className="q-dock-foot">{refused && pending && <button type="button" className="btn secondary" onClick={() => { setPending(null); setRefused(false); }}>Edit questions</button>}<button type="submit" className="btn primary" disabled={busy || (!pending && (loading || briefs.length === 0))}>{busy ? "Publishing…" : pending ? "Retry publication" : legacySource ? "Adopt and publish" : "Publish questions"}</button></footer>
    </form>
  </section>;
}
