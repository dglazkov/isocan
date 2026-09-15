import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Actor, DesignQuestionSource } from "@isocan/core";
import { workbenchItemPath } from "@isocan/core";
import { readDesignComparisons, readDesignComparisonReference, type DesignComparisonFilter, type DesignComparisonReadResult, type DesignComparisonReference, type DesignComparisonView, type DesignDecisionView } from "@isocan/api/design-decision";
import { designDecisionIO } from "../lib/design-decision.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { Modal } from "./Modal.tsx";
import { LocalExactReferenceCard } from "./ExactReferenceCard.tsx";
import { DesignComparisonPreview } from "./DesignComparisonPreview.tsx";
import { DesignComparisonRecovery } from "./DesignComparisonRecovery.tsx";
import { DesignComparisonActions } from "./DesignComparisonActions.tsx";
import "./design-comparison.css";

const sourceKey = (source: DesignQuestionSource) => JSON.stringify(source);
/** Shared currentness refreshes around an active prototype without replacing its exact mounted version. */
export function DesignComparisonDialog({ canvasId, actor, filter, initialSource, onClose }: {
  canvasId: string; actor: Actor; filter: DesignComparisonFilter; initialSource?: DesignQuestionSource | undefined; onClose: () => void;
}) {
  const io = useMemo(() => designDecisionIO(actor), [actor]);
  const [read, setRead] = useState<DesignComparisonReadResult | null>(null), [checking, setChecking] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0), refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [selected, setSelected] = useState(initialSource ? sourceKey(initialSource) : null);
  const selectionCaptured = useRef(!!initialSource), seen = useRef(new Map<string, DesignComparisonView>());
  const [preview, setPreview] = useState<DesignComparisonReference | null>(null), [opening, setOpening] = useState(false), [previewError, setPreviewError] = useState("");
  const returnTo = useRef<string | null>(null), body = useRef<HTMLDivElement>(null), previewRequest = useRef<AbortController | null>(null);
  const seq = useCanvasStore((state) => state.lastSeq), filterKey = JSON.stringify(filter);
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setError("");
    void readDesignComparisons(io, { canvasId, filter: JSON.parse(filterKey) as DesignComparisonFilter, signal: controller.signal }).then((value) => {
      if (controller.signal.aborted) return;
      for (const one of value.comparisons) seen.current.set(sourceKey(one.source), one);
      if (!selectionCaptured.current) {
        selectionCaptured.current = true;
        const first = value.comparisons.findLast((one) => one.status !== "superseded") ?? value.comparisons.at(-1);
        setSelected(first ? sourceKey(first.source) : null);
      }
      setRead(value);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The comparison could not be read."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [io, canvasId, filterKey, seq, revision]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...(body.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,iframe') ?? [])].filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const all = controls(), first = all[0], last = all.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } };
    window.addEventListener("keydown", key);
    return () => { previewRequest.current?.abort(); window.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  const back = useCallback(() => { previewRequest.current?.abort(); setOpening(false); setPreview(null); setPreviewError(""); }, []);
  useEffect(() => {
    if (preview || !returnTo.current) return;
    const target = [...(body.current?.querySelectorAll<HTMLElement>("[data-try-key]") ?? [])].find((one) => one.dataset.tryKey === returnTo.current);
    target?.focus();
  }, [preview]);
  const tryOption = async (source: DesignQuestionSource, optionId: string, trigger: HTMLElement) => {
    previewRequest.current?.abort(); const controller = new AbortController(); previewRequest.current = controller;
    returnTo.current = trigger.dataset.tryKey ?? null; setOpening(true); setPreviewError("");
    try { const result = await readDesignComparisonReference(io, { canvasId, source, optionId, signal: controller.signal }); if (!controller.signal.aborted) setPreview(result); }
    catch (cause) { if (!controller.signal.aborted) setPreviewError(cause instanceof Error ? cause.message : "The exact option is unavailable."); }
    finally { if (!controller.signal.aborted) setOpening(false); }
  };
  const currentRow = read?.comparisons.find((one) => sourceKey(one.source) === selected);
  const priorRow = selected ? seen.current.get(selected) : undefined;
  // A removed source remains a disabled recovery surface for its original pending intent.
  const row = currentRow ?? (priorRow ? { ...priorRow, status: "stale" as const, reasons: ["This selected source is no longer available in the current comparison read. Its saved draft and retry identity remain attached to this source."], allowedActions: { respond: false, authorities: [] } } : null);
  return <Modal label="Design comparison" title="Compare a decision worth making" onClose={preview ? back : onClose} wide><div className="design-comparison" ref={body}>
    {preview && <DesignComparisonPreview key={JSON.stringify(preview.artifact)} canvasId={canvasId} artifact={preview.artifact} version={preview.version} title={preview.title} onBack={back} />}<div hidden={!!preview}>
      {checking && <p role="status">Checking the comparison and adoption target…</p>}{error && <p role="alert">{error} <button className="btn secondary" onClick={refresh}>Retry comparison read</button></p>}
      {read && (read.comparisons.length > 1 || !currentRow && read.comparisons.length > 0) && <label className="comparison-batches">Comparison history<select value={row ? sourceKey(row.source) : ""} onChange={(event) => setSelected(event.target.value)}>{!currentRow && <option value={selected ?? ""}>{priorRow ? "Selected source is no longer available" : "Choose a saved comparison"}</option>}{read.comparisons.map((one) => <option key={sourceKey(one.source)} value={sourceKey(one.source)}>Revision {one.comparison.revision} · {one.comparison.alternatives.map((option) => option.title).join(" / ")} · {one.status}</option>)}</select></label>}
      {row && <><ComparisonOptions canvasId={canvasId} row={row} onTry={tryOption} opening={opening} /><DesignComparisonActions key={JSON.stringify([canvasId, actor.id, row.source])} canvasId={canvasId} actor={actor} row={row} decisions={read?.decisions ?? []} checking={checking || !!error} onChanged={refresh} /></>}
      <DesignComparisonRecovery canvasId={canvasId} actor={actor} requestId={filter.requestId} activeSource={row?.source} onChanged={refresh} />
      {!checking && !error && !row && <p>This source is no longer an active comparison. Its accepted history is shown below when available.</p>}
      {previewError && <p role="alert">{previewError}</p>}{opening && <p role="status">Reading the exact option before opening…</p>}
      {read?.unavailable.map((one) => <p role="alert" key={one.id}>Saved design history is unavailable: {one.reason}</p>)}
      {!!read?.decisions.length && <section className="comparison-history" aria-label="Decision history"><h3>Decision history</h3>{read.decisions.map((one) => <DecisionHistory key={one.decision.input.id} canvasId={canvasId} saved={one} onTry={tryOption} opening={opening} checking={checking || !!error} />)}</section>}
    </div>
  </div></Modal>;
}

function ComparisonOptions({ canvasId, row, onTry, opening }: { canvasId: string; row: DesignComparisonView; onTry: (source: DesignQuestionSource, optionId: string, trigger: HTMLElement) => Promise<void>; opening: boolean }) {
  const comparison = row.comparison;
  return <section data-design-comparison={comparison.id}>
    <div className="comparison-heading"><small>{comparison.uncertainty === "structure" ? "Workflow decision" : "Visual direction"} · {comparison.fidelity === "wireframe" ? "Working wireframes" : comparison.fidelity === "designed" ? "Designed alternatives" : "Implementation proposals"}</small><h2>{comparison.mode === "comparison" ? "Try the difference. Choose what fits." : "A recommended direction to keep moving."}</h2><p>{comparison.scenario}</p></div>
    <p className="comparison-recommendation"><strong>Recommended by {row.author.name}: {comparison.alternatives.find((one) => one.id === comparison.recommendedAlternativeId)?.title}</strong><br />{comparison.recommendation}</p>
    <div className="comparison-options">{comparison.alternatives.map((option) => {
      const retained = row.references.find((one) => one.artifact.itemId === option.artifact.itemId && one.artifact.versionId === option.artifact.versionId && one.artifact.blobHash === option.artifact.blobHash);
      return <article key={option.id} className="comparison-option" data-comparison-option={option.id}><h3>{option.title}</h3><p>{option.hypothesis}</p><LocalExactReferenceCard localCanvasId={canvasId} artifact={option.artifact} version={retained?.version} name={option.title} /><p className="comparison-tradeoff"><strong>Tradeoff</strong><br />{option.tradeoff}</p><button data-try-key={`${sourceKey(row.source)}:${option.id}`} className="btn secondary" disabled={opening} onClick={(event) => void onTry(row.source, option.id, event.currentTarget)}>Try {option.title}</button></article>;
    })}</div>
    {row.status === "superseded" && <p role="status">A newer comparison is available in Comparison history. This saved draft remains on the source you reviewed until you explicitly open another.</p>}
    {row.reasons.map((reason) => <p role="status" key={reason}>{reason}</p>)}
    <details><summary>Comparison source and scope</summary><p>Revision {comparison.revision} · request {comparison.requestId}</p><p>{comparison.target.itemId ? `Adoption target: ${comparison.target.itemId}` : "Greenfield: keep the chosen screen as the output."}</p><p>These scenario and fidelity declarations were authored by {row.author.name}; they are not task-verification evidence.</p><code>{row.source.threadId} / {row.source.commentId}</code></details>
  </section>;
}

function DecisionHistory({ canvasId, saved, onTry, opening, checking }: { canvasId: string; saved: DesignDecisionView; onTry: (source: DesignQuestionSource, optionId: string, trigger: HTMLElement) => Promise<void>; opening: boolean; checking: boolean }) {
  const record = saved.decision, input = record.input, authority = input.authority;
  const chosen = record.comparison.alternatives.find((one) => one.id === input.chosenAlternativeId);
  const source = input.source.kind === "comparison" ? input.source.source : saved.source;
  return <article className="comparison-decision" data-adopted-decision={input.id}>
    <h4>{chosen?.title ?? "Saved option"} <small>· {saved.standing}</small></h4>
    <p>{authority.kind === "human-choice" ? `Chosen by ${saved.author.name}` : authority.kind === "canvas-delegation" ? `Decided by ${saved.author.name} under an explicit canvas delegation` : authority.kind === "external-report" ? `Native ${authority.reportedOutcome} reported by ${saved.author.name}` : `Designer judgment by ${saved.author.name}`}</p>
    {authority.kind === "human-choice" ? authority.reason && <blockquote>{authority.reason}</blockquote> : <p>{authority.rationale}</p>}
    {authority.kind === "external-report" && <details><summary>Reported native conversation</summary><p>{authority.statement}</p>{authority.reportedReason && <p>Reported reason: {authority.reportedReason}</p>}</details>}
    <p role="status">{checking ? "Checking present output consistency…" : saved.status === "current" ? "The adopted output and its context are current." : `${saved.status === "stale" ? "The output or its context has changed." : "Current output consistency is unavailable."} The recorded choice remains history.`}</p>
    {!checking && saved.reasons.map((reason) => <p key={reason}>{reason}</p>)}
    <a href={workbenchItemPath(canvasId, record.adopted.itemId)}>Open adopted output</a>
    <details><summary>Compared options and original recommendation</summary><p>Recommended by {record.recommendationAuthor.name}: {record.comparison.recommendation}</p>{record.comparison.alternatives.map((option) => <p key={option.id}><strong>{option.title}</strong> · {option.tradeoff} <button data-try-key={`${sourceKey(source)}:${option.id}`} className="btn secondary" disabled={opening} onClick={(event) => void onTry(source, option.id, event.currentTarget)}>Try saved {option.title}</button></p>)}</details>
  </article>;
}
