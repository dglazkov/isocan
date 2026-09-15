import { useCallback, useEffect, useState } from "react";
import type { Actor, DesignArtifactRef } from "@isocan/core";
import { readDesignReviews, readDesignReviewReference, type DesignReviewReadResult, type DesignReviewView } from "@isocan/api/design-review";
import { designReviewIO } from "../lib/design-review.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import { useContentOrigin } from "../lib/contentBase.ts";
import { useFrameSrc } from "../lib/frame.ts";
import { DesignReviewHandoff } from "./DesignReviewHandoff.tsx";
import "./design-review.css";

/** Current workflow facts come from the shared reader; inspecting this panel never executes its checks. */
export function DesignReviewPanel({ canvasId, actor, requestId, threadId, canEdit, selected, select }: { canvasId: string; actor: Actor | null; requestId: string; threadId: string | undefined; canEdit: boolean; selected: string | null; select: (runId: string) => void }) {
  const seq = useCanvasStore(state => state.lastSeq);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const [result, setResult] = useState<DesignReviewReadResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setError("");
    void readDesignReviews(designReviewIO(actor), { canvasId, requestId, signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      setResult(value); if (selected === null && value.runs.at(-1)) select(value.runs.at(-1)!.run.id);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The review could not be read."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [canvasId, actor, requestId, seq, revision, selected, select]);
  const row = result?.runs.find(one => one.run.id === selected);
  return <section className="design-review" aria-label="Design review" data-design-review-request={requestId} aria-busy={checking}>
    <header><div><h4>Review for this task</h4><p>Source, task behavior and craft are separate readings.</p></div><button type="button" className="btn secondary" onClick={refresh} disabled={checking}>Refresh review</button></header>
    {checking && <p role="status">Checking the saved review and its inputs…</p>}
    {error && <p role="alert">{error} Saved evidence has not been revalidated.</p>}
    {result?.unavailable.map((one, index) => <p role="status" key={`${one.itemId}:${index}`}>Review history unavailable: {one.reason}</p>)}
    {!!result?.runs.length && <label className="design-review-select">Review history<select value={selected ?? ""} onChange={event => select(event.target.value)}>{result.runs.map(one => <option key={one.run.id} value={one.run.id}>{one.author.name} · {one.run.mode === "audit-only" ? "Audit only" : "Review"} · {new Date(one.run.passes[0]!.reservedAt).toLocaleDateString()}</option>)}</select></label>}
    {row ? <ReviewSummary canvasId={canvasId} row={row} checking={checking || !!error} /> : !checking && <p className="design-review-empty">No readable review is available yet. The designer will use the task’s saved context to inspect its actual result. Opening a preview does not mark it checked.</p>}
    {actor && <DesignReviewHandoff key={JSON.stringify([canvasId, actor.id, requestId])} canvasId={canvasId} actor={actor} requestId={requestId} threadId={threadId} row={row ?? null} offers={result?.offers ?? []} canEdit={canEdit && !checking && !error} changed={refresh} />}
  </section>;
}

function ReviewSummary({ canvasId, row, checking }: { canvasId: string; row: DesignReviewView; checking: boolean }) {
  const pass = row.run.passes.at(-1)!;
  const [history, setHistory] = useState(false);
  const [details, setDetails] = useState(false);
  return <article data-design-review-run={row.run.id}>
    <p className="design-review-standing" role="status">{checking ? "Evidence currentness is being checked" : row.status !== "current" ? `Evidence ${row.status}` : row.run.finished?.status === "ready" && row.ready ? "Checked for the agreed scope" : row.run.finished ? "Draft with named limits" : row.ready ? "Checks complete for the agreed scope" : "Verification in progress"}</p>
    <p>{row.run.mode === "audit-only" ? "Audit only · no repairs authorized by this run" : row.remainingRepairs === null ? "Repair budget unavailable" : `${2 - row.remainingRepairs} of 2 repair attempts used`}{row.remainingRepairs === 0 && row.run.mode !== "audit-only" ? " · automatic repair limit reached" : ""}</p>
    <dl className="design-review-readings">{([['source', 'Source'], ['task', 'Task checks'], ['craft', 'Craft']] as const).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{row.readings[key]}{checking || row.status !== "current" ? " · historical result" : ""}</dd></div>)}</dl>
    {row.reasons.map(reason => <p key={reason} role="status">{reason}</p>)}
    {[...new Set([...row.run.finished?.limits ?? [], ...row.readings.limits])].map(limit => <p key={limit}>{limit}</p>)}
    {row.readings.sourceAudit && <SourceReading row={row} />}
    {row.readings.missingObligationIds.length > 0 && <section><h5>Still to establish</h5><ul>{row.run.obligations.filter(one => row.readings.missingObligationIds.includes(one.id)).map(one => <li key={one.id}>{one.task} · {one.state}{one.viewport ? ` · ${one.viewport.width} × ${one.viewport.height}` : ""}</li>)}</ul></section>}
    {pass.output.kind === "canvas" ? <ReviewReference canvasId={canvasId} artifact={pass.output.artifact} label="Inspected output" /> : <p>Connected application: <a href={pass.output.runtimeUrl} target="_blank" rel="noopener noreferrer">Open reported runtime</a><small>Revision {pass.output.revision} · build {pass.output.buildId}. Runtime freshness is an attributed observation.</small></p>}
    <details open={details} onToggle={event => setDetails(event.currentTarget.open)}><summary>What was observed</summary>{details && <PassReading canvasId={canvasId} row={row} passId={pass.id} />}</details>
    <details open={history} onToggle={event => setHistory(event.currentTarget.open)}><summary>Inspection and repair history</summary>{history && row.run.passes.map(one => <section className="design-review-pass" key={one.id}><h5>{one.kind === "initial" ? "Initial inspection" : `Repair attempt ${row.run.passes.filter(p => p.kind === "repair").indexOf(one) + 1}`}</h5><p>Reserved by {row.passes.find(p => p.id === one.id)?.reservedBy?.name ?? "an unavailable author"}{one.record ? ` · ${one.record.outcome}` : " · observations pending"}</p>{row.passes.find(p => p.id === one.id)?.repairs.map(repair => <p key={repair.opId}>Repair by {repair.author.name} · {repair.standing} · {repair.status}{repair.reasons.length ? `: ${repair.reasons.join(" ")}` : ""}</p>)}<PassReading canvasId={canvasId} row={row} passId={one.id} /></section>)}</details>
    <small>{row.passes.find(one => one.id === pass.id)?.recordedBy ? `Observations recorded by ${row.passes.find(one => one.id === pass.id)!.recordedBy!.name}` : "Observations have not been recorded for this attempt"} · See the evidence for each check.</small>
  </article>;
}

function PassReading({ canvasId, row, passId }: { canvasId: string; row: DesignReviewView; passId: string }) {
  const pass = row.run.passes.find(one => one.id === passId)!;
  if (!pass.record) return <p>No observations have been recorded for this reserved attempt.</p>;
  const author = row.passes.find(one => one.id === passId)?.recordedBy;
  return <div className="design-review-observations"><p>Observations by {author?.name ?? "an unavailable author"}{pass.record.note ? ` · ${pass.record.note}` : ""}</p>{pass.record.source.kind === "unavailable" && <p>Source analysis unavailable: {pass.record.source.reason}</p>}{pass.record.observations.map(one => { const obligation = row.run.obligations.find(required => required.id === one.obligationId); return <section key={one.id}><h5>{obligation?.kind === "craft" ? "Craft" : "Task"} · {obligation?.state ?? one.obligationId} · {one.result}</h5><p>{one.action}</p><p><strong>Expected:</strong> {one.expected}<br /><strong>Observed:</strong> {one.observed}</p><small>{one.tool} · {one.toolVersion}{obligation?.viewport ? ` · ${obligation.viewport.width} × ${obligation.viewport.height}` : ""}</small>{one.evidence.map(ref => <ReviewReference key={JSON.stringify(ref)} canvasId={canvasId} artifact={ref} label="Evidence" />)}</section>; })}{pass.record.findings.map(finding => <p key={finding.id}><strong>{finding.severity === "critical" ? "Blocks this task: " : "Remaining detail: "}{finding.description}</strong><br />{finding.rationale}</p>)}</div>;
}

/** Exact evidence is read under its source policy; only verified local HTML uses the supported content origin. */
function ReviewReference({ canvasId, artifact, label }: { canvasId: string; artifact: DesignArtifactRef; label: string }) {
  const [value, setValue] = useState<Awaited<ReturnType<typeof readDesignReviewReference>> | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!opened) return;
    const controller = new AbortController(); setValue(null); setError("");
    void readDesignReviewReference(designReviewIO(null), { canvasId, artifact, signal: controller.signal }).then(result => { if (!controller.signal.aborted) setValue(result); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Evidence unavailable."); });
    return () => controller.abort();
  }, [canvasId, artifact, opened, retry]);
  useEffect(() => { if (!value) { setUrl(""); return; } const next = URL.createObjectURL(new Blob([new Uint8Array(value.bytes)], { type: value.version.mimeType })); setUrl(next); return () => URL.revokeObjectURL(next); }, [value]);
  return <div className="design-review-reference"><button type="button" className="btn secondary" onClick={() => { setOpened(true); setRetry(n => n + 1); }}>{value ? value.version.filename : `Read exact ${label.toLowerCase()}`}</button>{opened && !value && !error && <span role="status">Reading this version…</span>}{error && <p role="status">{error}</p>}{value && <><small>{label} · {value.version.filename}</small>{value.version.mimeType.startsWith("image/") && url && <img src={url} alt={`${label}: ${value.version.filename}`} />}{value.local && value.version.mimeType === "text/html" && <LocalReviewOutput canvasId={canvasId} hash={artifact.blobHash} />}{url && <a href={url} download={value.version.filename}>Download evidence</a>}<details><summary>Exact identity</summary><code>{artifact.itemId}<br />{artifact.versionId}<br />{artifact.blobHash}</code></details></>}</div>;
}

/** Content tickets are minted only after the exact reader proves local authority, never for an arbitrary foreign reference. */
function LocalReviewOutput({ canvasId, hash }: { canvasId: string; hash: string }) {
  const origin = useContentOrigin(canvasId, [hash]);
  const frame = useFrameSrc(origin, canvasId, hash);
  return frame ? <a href={frame.src} target="_blank" rel="noopener noreferrer">Open this exact version</a> : <span role="status">Preparing the supported output address…</span>;
}

function SourceReading({ row }: { row: DesignReviewView }) {
  const audit = row.readings.sourceAudit;
  if (!audit) return null;
  const items = "items" in audit ? audit.items : [audit];
  return <details className="design-review-source"><summary>Source check details</summary>{items.map((item, index) => <section key={index}>{item.status === "unavailable" ? <p>{item.reason}</p> : <><p>{item.diagnostics.length} findings · {item.coverage.checkedValues} values checked · {item.coverage.complete ? "Declared coverage complete" : "Partial coverage"}</p>{item.diagnostics.map((finding, n) => <div key={n}><p>Line {finding.range.start.line}: {finding.explanation}</p>{finding.candidates.length > 0 && <ul>{finding.candidates.map(candidate => <li key={candidate.token}>{candidate.value} · {candidate.explanation}{candidate.prerequisites.map(one => <p key={one}>{one}</p>)}</li>)}</ul>}</div>)}{item.coverage.unexamined.map((one, n) => <p key={n}>Not examined: {one.explanation}</p>)}</> }<details><summary>Exact source record</summary><pre>{JSON.stringify(item, null, 2)}</pre></details></section>)}</details>;
}
