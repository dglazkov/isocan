import { useMemo, useState } from "react";
import type { Actor, DesignQuestionSource } from "@isocan/core";
import { respondDesignComparison, submitDesignDecision } from "@isocan/api/design-decision";
import { designDecisionIO } from "../lib/design-decision.ts";
import { designComparisonDraftKey, readDesignComparisonDraft, type DesignComparisonDraft } from "../lib/design-comparison-draft.ts";

type Journal = { key: string; raw: string; draft: DesignComparisonDraft | null; problem: string | null };
function journals(canvasId: string, actorId: string, requestId?: string): Journal[] {
  try {
    return Object.keys(localStorage).flatMap<Journal>((key) => {
      if (!key.startsWith("isocan.design.comparison.v1:") || key.includes(":archive:")) return [];
      const raw = localStorage.getItem(key); if (!raw) return [];
      let value: Record<string, any>; try { value = JSON.parse(raw); } catch { return []; }
      if (!value || value.canvasId !== canvasId || value.actorId !== actorId || requestId && value.comparison?.requestId !== requestId || !value.pending) return [];
      try {
        const draft = readDesignComparisonDraft(raw, canvasId, actorId);
        if (designComparisonDraftKey(canvasId, actorId, draft.source) !== key) throw new Error("Saved source and storage identity differ.");
        return [{ key, raw, draft, problem: null }];
      } catch { return [{ key, raw, draft: null, problem: "This saved action cannot be validated. Its original bytes remain available for export." }]; }
    });
  } catch { return []; }
}
/** Local journal recovery never invents a live comparison, author or fresh approval when its source has disappeared. */
export function DesignComparisonRecovery({ canvasId, actor, requestId, activeSource, onChanged }: {
  canvasId: string; actor: Actor; requestId?: string | undefined; activeSource?: DesignQuestionSource | undefined; onChanged: () => void;
}) {
  const [saved] = useState(() => journals(canvasId, actor.id, requestId));
  const activeKey = activeSource ? designComparisonDraftKey(canvasId, actor.id, activeSource) : null;
  const visible = saved.filter((one) => one.key !== activeKey);
  if (!visible.length) return null;
  return <section className="comparison-history" aria-label="Saved choice recovery"><h3>Saved actions from this task</h3><p>The original comparison is not the current displayed source. These browser journals can retry the same action; they cannot approve newer versions.</p>{visible.map((one) => <RecoveredAction key={one.key} journal={one} actor={actor} onChanged={onChanged} />)}</section>;
}
function RecoveredAction({ journal, actor, onChanged }: { journal: Journal; actor: Actor; onChanged: () => void }) {
  const [draft, setDraft] = useState(journal.draft), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [archived, setArchived] = useState(false);
  const io = useMemo(() => designDecisionIO(actor), [actor]);
  const pending = draft?.pending;
  const save = (next: DesignComparisonDraft) => {
    setDraft(next);
    try { localStorage.setItem(journal.key, JSON.stringify(next)); }
    catch { setNotice("The result is shown here, but browser storage could not record it. Keep this page open; retry retains the original operation identity."); }
  };
  const retry = async () => {
    if (!draft || !pending || busy) return;
    setBusy(true); setNotice("");
    try {
      const result = pending.kind === "decide" ? await submitDesignDecision(io, { ...pending.request, retry: true }) : await respondDesignComparison(io, { ...pending.request, retry: true });
      if (result.status === "accepted") {
        save({ ...draft, pending: null, accepted: { kind: pending.kind, payloadId: result.payloadId, opId: result.opId, submittedOpId: result.submittedOpId, ...(result.confirmedBy ? { confirmedBy: result.confirmedBy } : {}), ...(result.consistency ? { consistency: result.consistency } : {}) } });
        setNotice("The original action is confirmed. No newer version was substituted."); onChanged();
      } else { save({ ...draft, pending: { ...pending, refused: result.status === "refused" } }); setNotice(result.reason ?? "The original action is still unconfirmed."); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "The original retry is still unconfirmed."); }
    finally { setBusy(false); }
  };
  const exportJournal = () => { const url = URL.createObjectURL(new Blob([draft ? JSON.stringify(draft, null, 2) : journal.raw], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "saved-design-action.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const archive = () => {
    if (pending && !pending.refused || busy) return;
    try { localStorage.setItem(`${journal.key}:archive:${Date.now()}`, draft ? JSON.stringify(draft) : journal.raw); localStorage.removeItem(journal.key); setArchived(true); }
    catch { setNotice("The original bytes could not be archived. They remain saved."); }
  };
  if (archived) return <div><p role="status">The refused or unreadable journal was archived in this browser.</p><button className="btn secondary" onClick={exportJournal}>Export archived action</button></div>;
  return <article className="comparison-decision" data-comparison-recovery={draft?.source.payloadId ?? "unreadable"}>
    <h4>{pending?.kind === "decide" ? "Saved choice awaiting confirmation" : "Saved response awaiting confirmation"}</h4>
    <p>Original source unavailable in this view · its current author and eligibility have not been established.</p>
    {draft && <><p>Saved option: {draft.comparison.alternatives.find((one) => one.id === draft.choice)?.title ?? "No option was adopted by this response"}</p>{draft.reason && <p>Your saved words: {draft.reason}</p>}<details><summary>Original source and captured intent</summary><pre>{JSON.stringify({ source: draft.source, pending: draft.pending, accepted: draft.accepted }, null, 2)}</pre></details></>}
    {journal.problem && <p role="alert">{journal.problem}</p>}
    {pending && <button className="btn primary" disabled={busy} onClick={() => void retry()}>{busy ? "Checking saved action…" : "Retry original saved action"}</button>}
    {draft?.accepted && <p role="status">Original action accepted.{draft.accepted.consistency?.status !== "current" && ` Current consistency ${draft.accepted.consistency?.status ?? "unavailable"}: ${draft.accepted.consistency?.reasons.join(" ") ?? "Read current history to check the output."}`}</p>}
    <button className="btn secondary" onClick={exportJournal}>Export original saved action</button>
    {(!draft || pending?.refused) && <button className="btn secondary" onClick={archive}>Archive refused or unreadable action</button>}
    {notice && <p role="status">{notice}</p>}
  </article>;
}
