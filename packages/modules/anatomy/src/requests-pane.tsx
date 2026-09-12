import { useEffect, useState } from "react";
import type { Canvas, CanvasContents, WorkspaceHost } from "@isocan/core";
import { projectsOn } from "./manifest.ts";
import { listRuns, resolveAnalysisTarget, requestAnalysis, retryRun, updateRun, dispatchRun } from "./runs.ts";
import type { AnatomyIO } from "./operations.ts";

/** Native request receipts keep dispatch and executor reports visible in the workspace. */
export function AnalysisRequests({ io, canvas, record, analysis, canEdit, host }: { io: AnatomyIO; canvas: CanvasContents; record: Canvas; analysis: string | undefined; canEdit: boolean; host: WorkspaceHost }) {
  const [choice, setChoice] = useState(analysis ?? "");
  const [target, setTarget] = useState<Awaited<ReturnType<typeof resolveAnalysisTarget>> | null>(null);
  const [problem, setProblem] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listRuns>>>([]);
  useEffect(() => setChoice(analysis ?? ""), [analysis]);
  useEffect(() => {
    let live = true;
    resolveAnalysisTarget(io, choice === "new" ? { create: true } : choice ? { analysis: choice } : {}).then(value => { if (live) { setTarget(value); setProblem(""); } }).catch(error => { if (live) { setTarget(null); setProblem(error.message); } });
    listRuns(io).then(value => { if (live) setRuns(value); }).catch(error => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, [io, canvas, record, choice]);
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <details className="anatomy-requests">
    <summary>Analysis requests{runs.length ? ` (${runs.length})` : ""}</summary>
    <label>Target analysis <select aria-label="Request target analysis" value={choice} onChange={e => setChoice(e.target.value)}>
      <option value="">Project default</option>
      {projectsOn(canvas).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      <option value="new">New analysis</option>
    </select></label>
    {target && <p>{target.repository} → {target.analysisTitle}</p>}
    {problem && <p role="alert">{problem}</p>}
    {canEdit && <button disabled={busy || !target} onClick={() => void act(async () => {
      const receipt = await requestAnalysis(io, choice === "new" ? { create: true } : choice ? { analysis: choice } : {});
      setMessage(`Request ${receipt.id} is ${receipt.run.status}. An agent with repository access must claim it before work starts.`); host.openChat();
    })}>Ask agent to {target?.analysisId ? "update analysis" : "analyze"}</button>}
    {message && <p role="status">{message}</p>}
    {runs.length > 0 && <p>Work status is reported by its executor. A claim does not prove the worker is still connected.</p>}
    <ol>{runs.slice(0, 10).map(receipt => <li key={receipt.id}>
      <strong>{receipt.run?.analysisTitle ?? receipt.item.title}</strong>{" — "}
      {receipt.run ? <>
        <span>{receipt.run.status === "requested" ? (receipt.dispatched ? "Requested; awaiting agent" : "Recorded; not posted in Chat") : receipt.run.status === "running" ? `Claimed by ${receipt.run.executor?.name ?? "executor"}` : receipt.run.status}</span>
        {receipt.run.cancelRequested && <span> · Cancellation requested{receipt.run.status === "cancelled" ? "; acknowledged" : ""}</span>}
        <p>{receipt.run.repository}{receipt.run.revision ? ` · Reviewed ${receipt.run.revision}` : ""}</p>
        {receipt.run.message && <p>{receipt.run.message}</p>}
        {receipt.run.retryOf && <p>Retry of {receipt.run.retryOf}</p>}
        {receipt.run.resultId && <button onClick={() => host.navigateView({ project: receipt.run!.resultId!, lens: "overview", focus: null })}>View result</button>}
        <button onClick={() => host.openChat()}>Open Chat</button>
        {canEdit && ["requested", "running"].includes(receipt.run.status) && !receipt.run.cancelRequested && <button disabled={busy} onClick={() => void act(() => updateRun(io, receipt.id, { type: "cancel-request" }))}>Request cancellation</button>}
        {canEdit && receipt.run.status === "requested" && !receipt.run.cancelRequested && !receipt.dispatched && <button disabled={busy} onClick={() => void act(() => dispatchRun(io, receipt.id))}>Post request in Chat</button>}
        {canEdit && ["failed", "cancelled"].includes(receipt.run.status) && <button disabled={busy} onClick={() => void act(() => retryRun(io, receipt.id))}>Retry request</button>}
      </> : <p role="alert">{receipt.error}</p>}
      <button onClick={() => host.openItem(receipt.id)}>Open request record</button>
    </li>)}</ol>
  </details>;
}
