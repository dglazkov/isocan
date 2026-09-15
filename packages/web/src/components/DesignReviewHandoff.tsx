import { useCallback, useEffect, useRef, useState } from "react";
import { newCommentId, newOpId, newThreadId, type Actor } from "@isocan/core";
import { prepareDesignReviewHandoff, submitDesignReviewWrite, type DesignReviewView, type DesignVerifierView } from "@isocan/api/design-review";
import { designReviewIO } from "../lib/design-review.ts";
import { designReviewHandoffKey, keepDesignReviewHandoff, readDesignReviewHandoffDraft, type DesignReviewHandoffDraft } from "../lib/design-review-draft.ts";

/** A person asks an actually available collaborator; this action records delivery, never browser results. */
export function DesignReviewHandoff({ canvasId, actor, requestId, threadId, row, offers, canEdit, changed }: {
  canvasId: string; actor: Actor; requestId: string; threadId: string | undefined; row: DesignReviewView | null;
  offers: DesignVerifierView[]; canEdit: boolean; changed: () => void;
}) {
  const key = designReviewHandoffKey(canvasId, actor.id, requestId);
  const [draft, setDraft] = useState<DesignReviewHandoffDraft | null>(null);
  const saved = useRef<DesignReviewHandoffDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [corrupt, setCorrupt] = useState(false);
  const keep = useCallback((value: DesignReviewHandoffDraft) => {
    keepDesignReviewHandoff(localStorage, key, value); saved.current = value; setDraft(value);
  }, [key]);
  useEffect(() => {
    let cancelled = false;
    void (async () => { const raw = localStorage.getItem(key); return raw === null ? null : readDesignReviewHandoffDraft(raw, canvasId, actor.id, requestId); })().then(value => {
      if (!cancelled) { saved.current = value; setDraft(value); }
    }).catch(cause => { if (!cancelled) { setCorrupt(true); setError(`Saved request recovery failed: ${cause instanceof Error ? cause.message : String(cause)}. Its storage remains untouched.`); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, canvasId, actor.id, requestId]);
  async function send(offer?: DesignVerifierView) {
    if (busy || loading || corrupt || !canEdit) return;
    const previous = saved.current;
    setBusy(true); setError("");
    try {
      if (previous?.state === "accepted") throw new Error("This verification request was already accepted. Its delivery does not establish inspection.");
      const prepared = previous?.prepared ?? (row && offer ? await prepareDesignReviewHandoff(designReviewIO(actor), { canvasId, runId: row.run.id, offer: offer.ref, threadId: threadId ?? newThreadId(), commentId: newCommentId(), opId: newOpId() }) : null);
      if (!prepared) throw new Error("Choose a current authorized verifier offer.");
      const intent: DesignReviewHandoffDraft = { schemaVersion: 1, canvasId, actorId: actor.id, requestId, prepared, state: "pending", result: null };
      keep(intent);
      const result = await submitDesignReviewWrite(designReviewIO(actor), prepared, { retry: !!previous });
      keep({ ...intent, state: result.status, result }); changed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  function archive() {
    if (saved.current?.state === "pending" || busy) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) localStorage.setItem(`${key}:archive:${Date.now()}`, raw);
      localStorage.removeItem(key); saved.current = null; setDraft(null); setCorrupt(false); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  const relevant = offers.filter(one => one.offer.runId === row?.run.id);
  return <section className="design-review-verifiers" aria-label="Verification handoff">
    <h5>Available verification</h5><p>A current tool offer and permission to contact its live collaborator are required. The request itself does not run a check.</p>
    {!!row?.handoffs.length && <details><summary>Saved verification requests</summary>{row.handoffs.map(one => <p key={one.opId}>{one.author.name} requested verification · {one.standing === "removed" ? "request removed" : "requested"}. Observations are recorded separately.<small>Original request: {one.commentId}</small></p>)}</details>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Recovering any saved request…</p>}
    {draft && <div role="status" data-review-handoff={draft.state}><strong>{draft.state === "accepted" ? "Verification requested" : draft.state === "pending" ? "Verification request awaiting confirmation" : "Verification request refused"}</strong><p>{draft.result?.reason}</p>{draft.result?.consistency && draft.result.consistency.status !== "current" && <p>Request currentness {draft.result.consistency.status}: {draft.result.consistency.reasons.join(" ")}</p>}<p>Only the collaborator’s subsequently recorded observations establish what was inspected.</p><details><summary>Original addressed request</summary><pre>{(draft.prepared.operation.type === "thread.reply" || draft.prepared.operation.type === "thread.create") ? draft.prepared.operation.comment.body : ""}</pre><code>{draft.prepared.opId}</code></details>{draft.state !== "accepted" && <button type="button" className="btn secondary" disabled={busy || !canEdit} onClick={() => void send()}>Retry original verification request</button>}{draft.state !== "pending" && <button type="button" className="btn secondary" disabled={busy} onClick={archive}>Keep history and close request</button>}</div>}
    {!draft && !corrupt && relevant.map(one => <div key={one.ref.versionId}><strong>{one.author.name}</strong><span>{one.eligible ? "Available for this output" : "Unavailable for this handoff"}</span>{one.reasons.map(reason => <p key={reason}>{reason}</p>)}<small>Reported tools: {one.offer.tools.map(tool => `${tool.name} ${tool.version}`).join(", ") || "None available"}</small>{one.eligible && row?.allowedActions.handoff && <button type="button" className="btn secondary" disabled={busy || loading || !canEdit} onClick={() => void send(one)}>Ask {one.author.name} to verify</button>}</div>)}
    {!relevant.some(one => one.eligible) && <p>No eligible verifier is available. Missing checks remain unverified.</p>}
    {!canEdit && <p>This view is read-only or its current inputs are being checked.</p>}
  </section>;
}
