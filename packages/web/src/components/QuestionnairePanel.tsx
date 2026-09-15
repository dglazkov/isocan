import { useEffect, useMemo, useState } from "react";
import type { Actor, CanvasContents, CommentThread, QuestionnaireActor, LegacyQuestionSource } from "@isocan/core";
import { parseLegacyQuestionnaire, questionnaireActorsRoute, questionnaireStates } from "@isocan/core/questionnaire";
import { request } from "../lib/api.ts";
import { questionnaireDraftKey, readQuestionnaireDraft } from "../lib/questionnairedraft.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { QuestionnaireDock } from "./QuestionnaireDock.tsx";
import { QuestionnairePublish } from "./QuestionnairePublish.tsx";
import "./questionnaire.css";

/** Present open questions for the current respondent, with explicit publishing and legacy adoption. */
export function QuestionnairePanel({ canvasId, canvas, actor, thread, canEdit, startPublishing = false }: { canvasId: string; canvas: CanvasContents; actor: Actor; thread: CommentThread | null; canEdit: boolean; startPublishing?: boolean }) {
  const [actors, setActors] = useState<QuestionnaireActor[]>([]);
  const [actorError, setActorError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [collapsed, setCollapsed] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(startPublishing);
  const [legacySource, setLegacySource] = useState<LegacyQuestionSource | undefined>();
  const joined = useCanvasStore((state) => state.actorJoins);
  const states = useMemo(() => questionnaireStates(canvas, { joined }), [canvas, joined]);
  const own = useMemo(() => questionnaireStates(canvas, { joined, respondentActorId: actor.id }), [canvas, joined, actor.id]);
  const active = own.findLast((one) => one.status === "open");
  useEffect(() => {
    // A page can close after the writer accepts but before its HTTP reply. Observing the
    // canonical answer on return retires only that saved submission, including before Undo.
    try {
      for (const row of own) {
        const key = questionnaireDraftKey(canvasId, actor.id, row.questions, row.source);
        const draft = readQuestionnaireDraft(localStorage, key);
        if (draft?.submission && row.responses.some((one) => one.response.id === draft.submission!.response.id)) localStorage.setItem(key, JSON.stringify({ ...draft, submission: null }));
      }
    } catch { setDraftError("A submitted draft could not be cleared from browser storage. Its saved IDs can still be checked safely if you retry."); }
  }, [own, canvasId, actor.id]);
  const legacy = thread?.comments.filter((comment) => parseLegacyQuestionnaire(comment.body) && !states.some((one) => one.legacySource?.commentId === comment.id && one.legacySource.threadId === thread.id)).at(-1);
  const legacyPayload = legacy ? parseLegacyQuestionnaire(legacy.body) : null;
  useEffect(() => {
    const controller = new AbortController();
    void request<{ actors: QuestionnaireActor[] }>("GET", questionnaireActorsRoute(canvasId), undefined, controller.signal).then((result) => { setActors(result.actors); setActorError(""); }).catch((error) => { if (!controller.signal.aborted) setActorError(error instanceof Error ? error.message : "The home could not identify eligible respondents."); });
    return () => controller.abort();
  }, [canvasId, publishing, active?.source.payloadId]);
  return <div className="questionnaire-panel">
    {active && canEdit && !publishing && (collapsed === active.source.payloadId ? <button type="button" className="q-resume" onClick={() => setCollapsed(null)}>Resume design questions · draft kept</button> : <QuestionnaireDock key={JSON.stringify(active.source)} canvasId={canvasId} actor={actor} state={active} agents={actors.filter((one) => one.kind === "agent")} onCollapse={() => setCollapsed(active.source.payloadId)} />)}
    {publishing && thread && canEdit && <QuestionnairePublish canvasId={canvasId} threadId={legacySource?.threadId ?? thread.id} actor={actor} actors={actors} legacySource={legacySource} onClose={() => { setPublishing(false); setLegacySource(undefined); }} />}
    {legacyPayload && !publishing && <details className="q-legacy-summary"><summary>{legacyPayload.headline ?? "Legacy design questions"}</summary><p>These need an explicit brief and respondent before answering.</p>{legacyPayload.questions.map((q) => <div key={q.id}><strong>{q.title}</strong>{q.description && <p>{q.description}</p>}{q.options?.map((option) => <p key={option.id}>{option.title}{option.body || option.description ? ` — ${option.body ?? option.description}` : ""}</p>)}</div>)}</details>}
    {!publishing && canEdit && thread && <div className="q-tools"><button type="button" onClick={() => { setLegacySource(undefined); setPublishing(true); }}>Ask design questions</button>{legacy && <button type="button" onClick={() => { setLegacySource({ threadId: thread.id, commentId: legacy.id, body: legacy.body }); setPublishing(true); }}>Adopt legacy questions…</button>}</div>}
    {draftError && <p className="q-error" role="alert">{draftError}</p>}
    {actorError && publishing && <p className="q-error" role="alert">{actorError}</p>}
    {!active && own.some((one) => one.status === "stale") && <p className="q-help">Earlier questions refer to a changed brief. Their answers and drafts remain available. Review the current design task before asking again.</p>}
  </div>;
}
