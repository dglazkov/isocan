import { useCallback, useEffect, useMemo, useState } from "react";
import { newCommentId, newOpId, newVersionId, type Actor } from "@isocan/core";
import { parseDesignComparisonResponse } from "@isocan/core/design-decision";
import { prepareDesignDecision, respondDesignComparison, submitDesignDecision, type DesignComparisonView, type DesignDecisionView } from "@isocan/api/design-decision";
import { designDecisionIO } from "../lib/design-decision.ts";
import { designComparisonDraftChanged, designComparisonDraftKey, newDesignComparisonDraft, readDesignComparisonDraft, type DesignComparisonDraft } from "../lib/design-comparison-draft.ts";

type Saved = { draft: DesignComparisonDraft; corrupt: string | null; warning: string };
/** One saved approval belongs to one actor and immutable comparison source, including every rejected option. */
export function DesignComparisonActions({ canvasId, actor, row, decisions, checking, onChanged }: {
  canvasId: string; actor: Actor; row: DesignComparisonView; decisions: DesignDecisionView[]; checking: boolean; onChanged: () => void;
}) {
  const key = designComparisonDraftKey(canvasId, actor.id, row.source);
  const [saved, setSaved] = useState<Saved>(() => {
    const draft = newDesignComparisonDraft(canvasId, actor.id, row);
    try { const raw = localStorage.getItem(key); if (!raw) return { draft, corrupt: null, warning: "" }; try { return { draft: readDesignComparisonDraft(raw, canvasId, actor.id), corrupt: null, warning: "" }; } catch { return { draft, corrupt: raw, warning: "The saved choice could not be read. Its original bytes are preserved until you recover it." }; } }
    catch { return { draft, corrupt: null, warning: "Browser storage is unavailable. A decision cannot be sent until its retry identity can be saved." }; }
  });
  const [archives, setArchives] = useState<string[]>(() => { try { return Object.keys(localStorage).filter((one) => one.startsWith(`${key}:archive:`)).sort().reverse(); } catch { return []; } });
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]), [actorError, setActorError] = useState("");
  const io = useMemo(() => designDecisionIO(actor), [actor]);
  const draft = saved.draft;
  const keep = useCallback((value: DesignComparisonDraft): boolean => {
    if (saved.corrupt !== null) return false;
    setSaved((before) => ({ ...before, draft: value }));
    try { localStorage.setItem(key, JSON.stringify(value)); setSaved((before) => ({ ...before, warning: "" })); return true; }
    catch { setSaved((before) => ({ ...before, warning: "This draft could not be saved for retry. No new action will be sent until browser storage works." })); return false; }
  }, [key, saved.corrupt]);
  useEffect(() => {
    if (draft.responseMode !== "delegate") return;
    const abort = new AbortController();
    void io.decisionActors(canvasId, abort.signal).then((result) => { if (!abort.signal.aborted) { setAgents(result.actors.filter((one) => one.kind === "agent")); setActorError(""); } }).catch((error) => { if (!abort.signal.aborted) setActorError(error instanceof Error ? error.message : "Eligible designers could not be read."); });
    return () => abort.abort();
  }, [io, canvasId, draft.responseMode]);
  const patch = (value: Partial<DesignComparisonDraft>) => { setNotice(""); keep({ ...draft, ...value }); };
  const changed = designComparisonDraftChanged(draft, row);
  const human = row.comparison.audience.kind === "human" && row.allowedActions.respond;
  const hasWords = !!(draft.choice || draft.reason || draft.agentId || draft.count || draft.instruction || draft.parts.some((one) => one.part));
  const chosenBasis = draft.bases.find((one) => one.alternativeId === draft.choice)?.basis;
  const effective = decisions.find((one) => one.standing === "effective" && one.decision.input.requestId === row.comparison.requestId && one.decision.input.basis.brief.itemId === row.comparison.brief.itemId && one.decision.input.basis.epoch === row.comparison.epoch && one.decision.input.decisionKey === row.comparison.decisionKey);
  const correcting = !!effective && row.comparison.correctsDecisionId === effective.decision.input.id;
  const alreadyChosen = !!effective && !correcting;
  const locked = busy || !!draft.pending || !!draft.accepted || saved.corrupt !== null;
  const available = !checking && !changed && human && !alreadyChosen;
  const reset = () => {
    if (draft.pending && !draft.pending.refused) return;
    try {
      const raw = saved.corrupt ?? JSON.stringify(draft);
      const archiveKey = `${key}:archive:${Date.now()}`;
      localStorage.setItem(archiveKey, raw);
      setArchives((before) => [archiveKey, ...before]);
      const next = newDesignComparisonDraft(canvasId, actor.id, row);
      localStorage.setItem(key, JSON.stringify(next));
      setSaved({ draft: next, corrupt: null, warning: "" }); setNotice("The earlier draft was preserved in this browser’s archive. A new draft uses the currently displayed versions.");
    } catch { setNotice("The earlier bytes could not be archived. Nothing was cleared."); }
  };
  const restore = (archiveKey: string) => {
    if (draft.pending || draft.accepted || saved.corrupt !== null) return;
    try {
      const raw = localStorage.getItem(archiveKey);
      if (!raw) throw new Error("The archived bytes are no longer available.");
      const restored = readDesignComparisonDraft(raw, canvasId, actor.id);
      if (designComparisonDraftKey(canvasId, actor.id, restored.source) !== key) throw new Error("This archive belongs to another source.");
      const currentArchive = `${key}:archive:${Date.now()}`;
      localStorage.setItem(currentArchive, JSON.stringify(draft));
      if (keep(restored)) { setArchives((before) => [currentArchive, ...before]); setNotice("The earlier draft is restored with its original versions. Review any changes before using it."); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "The archived draft could not be read. Its bytes remain saved."); }
  };
  const exportDraft = (archiveKey?: string) => {
    const url = URL.createObjectURL(new Blob([archiveKey ? localStorage.getItem(archiveKey) ?? "" : saved.corrupt ?? JSON.stringify(draft, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "design-choice-draft.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function submit() {
    if (busy || draft.accepted || saved.corrupt !== null) return;
    setNotice("");
    let pending = draft.pending;
    try {
      if (!pending) {
        if (!available) throw new Error("Review the current source and target before sending this choice.");
        const common = { canvasId, threadId: draft.source.threadId, commentId: newCommentId(), opId: newOpId() };
        if (draft.responseMode === "choose") {
          if (!row.allowedActions.authorities.includes("human-choice") || !chosenBasis) throw new Error("Choose an available option first.");
          const request = prepareDesignDecision({ ...common, decision: { id: `decision_${crypto.randomUUID()}`, requestId: draft.comparison.requestId, decisionKey: draft.comparison.decisionKey, source: { kind: "comparison", source: draft.source }, basis: chosenBasis, chosenAlternativeId: draft.choice, versionId: newVersionId(), supersedesDecisionId: draft.comparison.correctsDecisionId, authority: { kind: "human-choice", reason: draft.reason.trim() || null } } });
          pending = { kind: "decide", request, refused: false };
        } else {
          const outcome = draft.responseMode === "delegate" ? { kind: "delegate" as const, agentActorId: draft.agentId } : draft.responseMode === "more" ? { kind: "more" as const, count: draft.count.trim() ? Number(draft.count) : null, instruction: draft.instruction.trim() || null } : draft.responseMode === "combine" ? { kind: "combine" as const, parts: draft.parts.filter((one) => one.part.trim()).map((one) => ({ ...one, part: one.part.trim() })), instruction: draft.instruction.trim() } : { kind: draft.responseMode };
          const response = parseDesignComparisonResponse({ schemaVersion: 1, kind: "comparison-response", id: `response_${crypto.randomUUID()}`, requestId: draft.comparison.requestId, epoch: draft.comparison.epoch, comparison: draft.source, authority: { kind: "human" }, outcome, supersedesResponseId: draft.supersedesResponseId });
          pending = { kind: "respond", request: { ...common, response }, refused: false };
        }
      }
      // Every send needs acknowledged local storage, including a retry after an earlier quota failure.
      if (!keep({ ...draft, pending })) return;
      setBusy(true);
      const result = pending.kind === "decide" ? await submitDesignDecision(io, { ...pending.request, retry: !!draft.pending }) : await respondDesignComparison(io, { ...pending.request, retry: !!draft.pending });
      if (result.status === "accepted") {
        keep({ ...draft, pending: null, accepted: { kind: pending.kind, payloadId: result.payloadId, opId: result.opId, submittedOpId: result.submittedOpId, ...(result.confirmedBy ? { confirmedBy: result.confirmedBy } : {}), ...(result.consistency ? { consistency: result.consistency } : {}) } });
        setNotice(result.confirmedBy === "snapshot" ? "Confirmed from the saved design history. The original HTTP acknowledgement was unavailable." : pending.kind === "decide" ? "Choice saved. Adoption and its decision are one undo." : "Response saved. It does not adopt an option.");
        onChanged();
      } else {
        keep({ ...draft, pending: { ...pending, refused: result.status === "refused" } });
        setNotice(result.reason ?? (result.status === "pending" ? "The home has not confirmed this action. Retry keeps its original identity and versions." : "This saved action was refused."));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The action could not be prepared.");
      // Once journaled, an unexpected transport failure cannot release the original identity.
    } finally { setBusy(false); }
  }
  const response = row.effectiveResponse;
  return <section className="comparison-actions" aria-label="Choose or respond">
    <h3>{alreadyChosen ? "A choice is already recorded" : correcting ? "Correct the earlier choice" : "Your choice"}</h3>
    {row.comparison.audience.kind === "external-agent" && <p>This comparison belongs to a native agent conversation. Its reporter records that conversation through the same decision API; this browser does not invent a human response.</p>}
    {!human && !alreadyChosen && row.comparison.audience.kind === "human" && <p>{row.status === "stale" || row.status === "superseded" ? "This source cannot accept a fresh response in its current state. Its original draft and any saved retry are retained." : "Only the named respondent can choose or revise this comparison here. You can still try every option and inspect its history."}</p>}
    {response && <div className="comparison-response"><p><strong>{response.author.name}</strong> {response.response.authority.kind === "external-report" ? "reported" : "requested"} {response.response.outcome.kind === "delegate" ? "a named designer’s decision" : response.response.outcome.kind === "more" ? "more alternatives" : response.response.outcome.kind === "combine" ? "a combination of specific ideas" : response.response.outcome.kind === "skip" ? "to skip this decision" : "to dismiss this comparison"}.</p>{human && !alreadyChosen && !draft.pending && <button className="btn secondary" onClick={() => { keep({ ...draft, accepted: null, supersedesResponseId: response.response.id }); setNotice("Revise the response below. The earlier response remains in history."); }}>Revise my response</button>}</div>}
    {saved.warning && <p role="alert">{saved.warning}</p>}
    {changed && !draft.accepted && <div className="comparison-changed" role="alert"><p>The source, an option, or the adoption target changed after this draft began. Your earlier choice is retained. Review the current target and options before starting a fresh approval.</p><details><summary>Current adoption target to review</summary>{row.approvalBases.map((one) => <div key={one.alternativeId}><strong>{row.comparison.alternatives.find((option) => option.id === one.alternativeId)?.title}</strong>{one.basis ? <><p>{one.basis.target.title}</p><p>{one.basis.target.description || "No description"}</p><pre>{JSON.stringify({ artifact: one.basis.target.artifact, properties: one.basis.target.properties, scope: one.basis.target.scope }, null, 2)}</pre></> : <p>{one.reason ?? "This option cannot currently be adopted."}</p>}</div>)}</details></div>}
    {(human || hasWords) && !alreadyChosen && <fieldset disabled={locked || !available}>
      <legend>{available ? "Choose an option, or keep exploring" : "Your saved draft · retained for review"}</legend>
      <div className="comparison-choice-list">{draft.comparison.alternatives.map((option) => <label key={option.id}><input type="radio" name={`choice-${draft.source.payloadId}`} checked={draft.responseMode === "choose" && draft.choice === option.id} onChange={() => patch({ responseMode: "choose", choice: option.id })} /><span><strong>{option.title}</strong><small>{option.tradeoff}</small></span></label>)}</div>
      {draft.responseMode === "choose" && <label>What matters to you? <small>Optional · left blank means no reason was supplied</small><textarea rows={2} value={draft.reason} onChange={(event) => patch({ reason: event.target.value })} /></label>}
      <label>Another way to continue<select value={draft.responseMode} onChange={(event) => patch({ responseMode: event.target.value as DesignComparisonDraft["responseMode"] })}><option value="choose">Use my selected option</option><option value="delegate">Let a named designer decide</option><option value="more">Explore more alternatives</option><option value="combine">Combine specific ideas</option><option value="skip">Skip this decision</option><option value="dismiss">Dismiss this comparison</option></select></label>
      {draft.responseMode === "delegate" && <label>Designer<select value={draft.agentId} onChange={(event) => patch({ agentId: event.target.value })}><option value="">Choose a registered designer</option>{agents.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}</select>{actorError && <span role="alert">{actorError}</span>}<small>The designer’s rationale will be recorded as their decision.</small></label>}
      {draft.responseMode === "more" && <label>How many alternatives? <small>Optional; they arrive in small linked batches</small><input type="number" min="1" max="100" value={draft.count} onChange={(event) => patch({ count: event.target.value })} /></label>}
      {draft.responseMode === "combine" && draft.parts.map((part, index) => <label key={part.optionId}>Keep from {draft.comparison.alternatives.find((option) => option.id === part.optionId)?.title}<input value={part.part} placeholder="Name the specific idea to keep" onChange={(event) => patch({ parts: draft.parts.map((one, n) => n === index ? { ...one, part: event.target.value } : one) })} /></label>)}
      {(draft.responseMode === "more" || draft.responseMode === "combine") && <label>{draft.responseMode === "combine" ? "How should those ideas work together?" : "What should change? (optional)"}<textarea rows={2} value={draft.instruction} onChange={(event) => patch({ instruction: event.target.value })} /></label>}
    </fieldset>}
    {(draft.pending || human && !alreadyChosen && !draft.accepted) && <button className="btn primary" disabled={busy || !draft.pending && (!available || saved.corrupt !== null || draft.responseMode === "choose" && (!chosenBasis || !row.allowedActions.authorities.includes("human-choice")))} onClick={() => void submit()}>{busy ? "Saving…" : draft.pending ? "Retry saved action" : draft.responseMode === "choose" ? `Use ${draft.comparison.alternatives.find((one) => one.id === draft.choice)?.title ?? "selected option"}` : "Send response"}</button>}
    {draft.accepted && <p role="status">{draft.accepted.kind === "decide" ? "Your choice is saved." : "Your response is saved."} The accepted act remains recorded even if the current source later changes.</p>}
    {draft.accepted?.consistency && draft.accepted.consistency.status !== "current" && <p role="status">The action was accepted, but its follow-up consistency check was {draft.accepted.consistency.status}. {draft.accepted.consistency.reasons.join(" ")} Current history must be read before treating the output as current.</p>}
    {notice && <p role="status">{notice}</p>}
    <details><summary>Saved draft and recovery</summary><button className="btn secondary" onClick={() => exportDraft()}>Export this draft</button>{!draft.accepted && (!draft.pending || draft.pending.refused) && <button className="btn secondary" onClick={reset}>{saved.corrupt !== null ? "Archive unreadable draft and start again" : draft.pending?.refused ? "Archive refused action and review again" : "Archive draft and review current versions"}</button>}<p>Closing this comparison keeps your draft in this browser. A pending action keeps the same versions and IDs on retry.</p>{archives.length > 0 && <ul className="comparison-archives">{archives.map((archiveKey) => <li key={archiveKey}>Draft saved {new Date(Number(archiveKey.split(":").at(-1))).toLocaleString()} <button className="btn secondary" onClick={() => exportDraft(archiveKey)}>Export archive</button><button className="btn secondary" disabled={!!draft.pending || !!draft.accepted || saved.corrupt !== null} onClick={() => restore(archiveKey)}>Restore archive</button></li>)}</ul>}</details>
  </section>;
}
