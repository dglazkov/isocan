import { useEffect, useState } from "react";
import { checkDesignCraft, readDesignCraft, type DesignCraftPacket, type DesignCraftStage } from "@isocan/api/design-craft";
import { designRequestReadIO } from "../lib/design-request.ts";
import { Markdown } from "../lib/markdown.tsx";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { everyWhileVisible } from "../lib/whilevisible.ts";

const captures = new Map<string, DesignCraftPacket>();

/** The lazy optional surface displays the shared packet; opening it never publishes a craft verdict. */
export default function DesignCraftPanel({ canvasId, requestId, scopeKey, stage, select }: { canvasId: string; requestId: string; scopeKey: string; stage: string; select(stage: string): void }) {
  const key = JSON.stringify([scopeKey, stage]);
  const seq = useCanvasStore(state => state.canvasId === canvasId ? state.lastSeq : 0);
  const [packet, setPacket] = useState<DesignCraftPacket | null>(null), [error, setError] = useState<string | null>(null), [refresh, setRefresh] = useState(0);
  const [tick, setTick] = useState(0), [consistency, setConsistency] = useState<Awaited<ReturnType<typeof checkDesignCraft>> | null>(null);
  useEffect(() => everyWhileVisible(() => setTick(value => value + 1), 15000), []);
  useEffect(() => {
    const controller = new AbortController(), saved = captures.get(key); setPacket(saved ?? null); setError(null); setConsistency(null);
    if (!saved) readDesignCraft(designRequestReadIO, { canvasId, requestId, stage: stage as DesignCraftStage, signal: controller.signal }).then(value => { if (!controller.signal.aborted) { captures.set(key, value); setPacket(value); } }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : String(error)); });
    return () => controller.abort();
  }, [canvasId, requestId, stage, key, refresh]);
  useEffect(() => {
    const controller = new AbortController(); setConsistency(null);
    if (packet) void checkDesignCraft(designRequestReadIO, { canvasId, requestId, packet, signal: controller.signal }).then(value => { if (!controller.signal.aborted) setConsistency(value); }).catch(error => { if (!controller.signal.aborted) setConsistency({ packetId: packet.packetId, status: "unavailable", reasons: [error instanceof Error ? error.message : String(error)] }); });
    return () => controller.abort();
  }, [canvasId, requestId, packet, seq, tick]);
  const guidance = packet?.files.find(file => file.path === "GUIDANCE.md");
  const guidanceText = guidance ? new TextDecoder().decode(Uint8Array.from(atob(guidance.data), character => character.charCodeAt(0))) : "";
  const workingGuidance = guidanceText.split("\n").filter(line => line.startsWith("- ") || line.startsWith("Delivery:")).join("\n\n");
  const download = () => { if (!packet) return; const url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "CRAFT.manifest.json"; link.click(); URL.revokeObjectURL(url); };
  return <div className="design-craft-panel" data-design-craft-panel={requestId} style={{ overflowWrap: "anywhere", minWidth: 0 }}>
    <h4>Craft guidance for this task</h4>
    <p>Optional adapted guidance. The saved brief and existing workflow remain authoritative.</p>
    <label>Stage <select aria-label="Craft stage" value={stage} onChange={event => select(event.target.value)}><option value="new-work">Starting the work</option><option value="critique">Critique</option><option value="finish">Finishing</option></select></label>{" "}
    <button type="button" className="btn secondary" onClick={() => { captures.delete(key); setRefresh(value => value + 1); }}>Refresh craft context</button>
    {error && <><p role="alert">Context could not be checked. Try refreshing when you’re ready.</p><details><summary>Sources and check details</summary><p>{error}</p></details></>}
    {!packet && !error && <p role="status">Checking context</p>}
    {packet && <>
      <p data-design-craft-status={consistency?.status ?? "checking"}><strong>{consistency?.status === "current" ? "Context is up to date" : consistency?.status === "stale" ? "Context has changed" : consistency?.status === "unavailable" ? "Context could not be checked" : "Checking context"}</strong><br /><small>Adapted guidance; native playbooks unsupported</small></p>
      {consistency?.status === "stale" && <p>The saved brief, answers or design references have changed. Review and refresh when you’re ready; your current working context stays available.</p>}
      {consistency?.status === "unavailable" && <p>Your current working context stays available. Review the source details or try refreshing when you’re ready.</p>}
      <p><strong>{packet.request.brief.primaryTask ?? "Task unresolved"}</strong><br />For {packet.request.brief.audience ?? "the audience still to be resolved"} · {packet.request.brief.delivery === "connected-app" ? "Connected app" : "Canvas output"}</p>
      {packet.request.brief.constraints.length > 0 && <><h4>Keep these constraints</h4><ul>{packet.request.brief.constraints.map((constraint, index) => <li key={index}>{constraint}</li>)}</ul></>}
      {packet.request.brief.facts.length > 0 && <><h4>What this guidance builds on</h4><ul>{packet.request.brief.facts.map(fact => {
        const provenance = packet.request.brief.continuation?.factProvenance.find(one => one.field === `facts.${fact.id}`);
        const label = fact.origin === "assumed" ? "Assumption" : provenance?.kind === "reported" ? "Agent-reported" : provenance?.kind === "questionnaire" ? "Answered in canvas" : fact.origin === "context" ? "From saved context" : "Supplied";
        return <li key={fact.id}><strong>{fact.name}:</strong> {fact.value} <small>{label}</small></li>;
      })}</ul></>}
      {packet.decisions.length > 0 && <><h4>Accepted direction</h4>{packet.decisions.map(decision => {
        const chosen = decision.comparison.alternatives.find(option => option.id === decision.input.chosenAlternativeId)!, authority = decision.input.authority;
        return <section key={decision.input.id}><p><strong>{chosen.title}</strong> · {authority.kind === "human-choice" ? "Chosen" : authority.kind === "external-report" ? "Native choice reported" : "Agent decision"} by {decision.author.name}</p><p>{chosen.hypothesis}</p><p>Tradeoff: {chosen.tradeoff}</p><p>{authority.kind === "human-choice" ? authority.reason ? `Reason: ${authority.reason}` : "No reason was supplied with this choice." : authority.kind === "external-report" ? `Reported conversation: ${authority.statement}${authority.reportedReason ? ` Reason reported: ${authority.reportedReason}` : ""} Agent rationale: ${authority.rationale}` : authority.rationale}</p><details><summary>Original recommendation</summary><p>{decision.comparison.alternatives.find(option => option.id === decision.comparison.recommendedAlternativeId)?.title} · recommended by {decision.recommendationAuthor.name}</p><p>{decision.recommendation}</p></details></section>;
      })}</>}
      {packet.questions.length > 0 && <details><summary>Saved answers and corrections</summary>{packet.questions.map(question => <section key={question.questions.id}><p><strong>{question.questions.headline}</strong></p>{question.responses.map(response => <ul key={response.response.id}>{response.response.resolutions.map(resolution => {
        const source = question.questions.questions.find(one => one.id === resolution.questionId);
        const outcome = resolution.state !== "answered" ? resolution.state : resolution.value.kind === "text" ? resolution.value.text : resolution.value.kind === "options" ? resolution.value.optionIds.map(id => source?.options.find(option => option.id === id)?.title ?? id).join(", ") : "Exact references supplied";
        return <li key={resolution.questionId}>{source?.title ?? resolution.questionId}: {outcome} · by {response.author.name}</li>;
      })}</ul>)}</section>)}<p>Saved response history includes corrections. The current brief above remains the working context; this guidance asks no additional questions.</p></details>}
      <p>Governing system: {packet.governing.status === "available" ? `${packet.governing.projection.expectedMetadata.title} · by ${packet.governing.author.name}` : `${packet.governing.status}: ${packet.governing.reason}`}</p>
      {packet.runtimeReports.length > 0 && <><h4>Reported connected delivery</h4>{packet.runtimeReports.map(report => <p key={report.receipt.versionId}>{report.output.repository} · {report.status}<br />Revision {report.output.revision}, build {report.output.buildId}<br />{report.output.runtimeUrl}<br />Reported by {report.author.name}; this packet did not inspect or execute it.</p>)}</>}
      {guidance && <div data-design-craft-guidance><h4>Focus for this stage</h4><Markdown>{workingGuidance}</Markdown><p>Use the existing review for verification. This guidance adds no repair allowance.</p></div>}
      <details><summary>Sources, identities and full saved context</summary>{!!consistency?.reasons.length && <ul>{consistency.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}<p>Packet {packet.packetId}. Revision {packet.revision}; request {packet.request.brief.requestId}, epoch {packet.request.brief.epoch}; brief {packet.request.ref.itemId}@{packet.request.ref.versionId}.</p><ul>{packet.references.map((reference, index) => <li key={index}>{reference.title} · {reference.artifact.itemId}@{reference.artifact.versionId} · {reference.path ?? reference.reason}</li>)}</ul><p>Impeccable skill {packet.upstream.skillVersion}, commit {packet.upstream.commit}. Package installation was not inspected; native execution unsupported/not run.</p><ul>{packet.upstream.resources.map(source => <li key={source.path}>{source.path} · SHA256 {source.sha256}</li>)}</ul><Markdown>{guidanceText}</Markdown><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ request: packet.request, questions: packet.questions, decisions: packet.decisions, runtimeReports: packet.runtimeReports }, null, 2)}</pre></details>
      <button type="button" className="btn secondary" onClick={download}>Download context packet</button>
      <p>CLI export writes the standalone files into a new folder. Opening or downloading records no inspection.</p>
    </>}
  </div>;
}
