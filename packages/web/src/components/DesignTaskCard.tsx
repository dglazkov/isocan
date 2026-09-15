import { useCallback, useState } from "react";
import type { Actor, DesignBrief } from "@isocan/core";
import { newVersionId, workbenchItemPath } from "@isocan/core";
import type { DesignRequestView } from "@isocan/api/design-request";
import type { DesignBriefFields, DesignRequestAction } from "@isocan/core/design-request";
import { readDesignFieldDraft, useDesignMutation, type DesignFieldDraft } from "../lib/design-request-draft.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { MutationNotice } from "./DesignTaskPanel.tsx";
import { DesignReceiptView, DesignReceiptEditor } from "./DesignTaskReceipt.tsx";
import { DesignTaskReconcile } from "./DesignTaskReconcile.tsx";
import { RequestReferenceCard } from "./RequestReferenceCard.tsx";
import { DesignSystemsButton } from "./DesignSystemsButton.tsx";

const deliveryName: Record<DesignBrief["delivery"], string> = { "html-node": "Runnable HTML node", "connected-app": "Connected application", wireframe: "Working wireframe", exploration: "Design exploration" };

/** A compact task is the same facts and conditional controls in chat, its brief face and beside the result. */
export function DesignTaskCard({ canvasId, actor, row, canEdit, checking = false, onChanged }: { canvasId: string; actor: Actor | null; row: DesignRequestView; canEdit: boolean; checking?: boolean; onChanged: () => void }) {
  const canvas = useCanvasStore((state) => state.canvas);
  const names = useCanvasStore((state) => state.actorNames);
  const brief = row.brief;
  const key = `isocan.design.field.v1:${JSON.stringify([canvasId, actor?.id ?? "reader", brief.requestId])}`;
  const [edit, setEdit] = useState<DesignFieldDraft | null>(() => { try { return readDesignFieldDraft(localStorage.getItem(key)); } catch { return null; } });
  const [storageError, setStorageError] = useState(() => { try { return localStorage.getItem(key) && !readDesignFieldDraft(localStorage.getItem(key)) ? "An earlier correction could not be read. It remains in browser storage; review the brief before starting another correction." : ""; } catch { return "Browser storage is unavailable. Keep this page open while correcting the brief."; } });
  const [publishing, setPublishing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const keep = useCallback((value: DesignFieldDraft | null) => {
    setEdit(value);
    try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); setStorageError(""); }
    catch { setStorageError("This correction could not be saved for refresh. Keep the page open until it is confirmed."); }
  }, [key]);
  const mutation = useDesignMutation(canvasId, actor, brief.requestId, () => { keep(null); onChanged(); });
  const editable = canEdit && !checking && row.allowedActions.includes("update");
  const staleDraft = !!edit && (edit.base.versionId !== row.ref.versionId || edit.epoch !== brief.epoch);
  const begin = (mode: DesignFieldDraft["mode"], text = "", factId = "") => keep({ mode, text, factId, base: row.ref, epoch: brief.epoch, outputIds: brief.outputIds });
  const provenance = (field: string) => {
    const fact = brief.continuation?.factProvenance.findLast((one) => one.field === field);
    if (!fact) return null;
    const name = names[fact.actorId] ?? (row.author.id === fact.actorId ? row.author.name : "a collaborator");
    return <small>{fact.kind === "reported" ? `Reported by ${name}` : fact.kind === "questionnaire" ? `Answered by ${name} in design questions` : `Provided by ${name}`}</small>;
  };
  function operation(): Extract<DesignRequestAction, { kind: "update" | "complete" }> | Exclude<DesignRequestAction, { kind: "start" | "update" | "complete" }> {
    if (!edit) throw new Error("Open a correction first.");
    const basis = { brief: edit.base, epoch: edit.epoch, versionId: newVersionId() };
    if (edit.mode === "resume") return { ...basis, kind: "resume", reason: edit.text.trim() };
    if (edit.mode === "cancel") return { ...basis, kind: "cancel", reason: edit.text.trim() };
    if (edit.mode === "complete") return { ...basis, kind: "complete", patch: { outputIds: edit.outputIds } };
    const patch: Partial<DesignBriefFields> = edit.mode === "audience" ? { audience: edit.text.trim() || null } : edit.mode === "primaryTask" ? { primaryTask: edit.text.trim() || null } : edit.mode === "constraints" ? { constraints: edit.text.split("\n").map((line) => line.trim()).filter(Boolean) } : { facts: brief.facts.map((fact) => fact.id === edit.factId ? { ...fact, value: edit.text.trim(), origin: "supplied" as const } : fact) };
    return { ...basis, kind: "update", patch };
  }
  return <article className="design-task-card" data-design-request={brief.requestId}>
    <header><div><small>Design task · {brief.source.entrance === "external-agent" ? "Started through an external agent" : "Started in canvas chat"}</small><h3>{brief.primaryTask || "A design task in progress"}</h3></div><span className="design-task-status">{row.status === "cancelled" ? "Cancelled" : row.status === "stale" ? "Needs reconciliation" : brief.progress === "completed" ? "Task completed" : "In progress"}</span></header>
    <dl className="design-task-facts"><dt>For</dt><dd>{brief.audience || "Audience to clarify"}{brief.audience && provenance("audience")}{editable && <button onClick={() => begin("audience", brief.audience ?? "")}>Correct audience</button>}</dd><dt>Main task</dt><dd>{brief.primaryTask || "To be clarified from the request"}{brief.primaryTask && provenance("primaryTask")}{editable && <button onClick={() => begin("primaryTask", brief.primaryTask ?? "")}>Correct main task</button>}</dd><dt>Delivery</dt><dd>{deliveryName[brief.delivery]} · {brief.fidelity}</dd></dl>
    {brief.facts.length > 0 && <section className="design-task-fact-list">{brief.facts.map((fact) => <div key={fact.id}><strong>{fact.origin === "assumed" ? "Assuming: " : "Using: "}{fact.name}</strong><p>{fact.value}</p>{provenance(`facts.${fact.id}`)}{editable && <button onClick={() => begin("fact", fact.value, fact.id)}>Correct {fact.name}</button>}</div>)}</section>}
    <details><summary>Context, constraints and references</summary><p>{brief.constraints.length ? brief.constraints.join(" · ") : "No additional constraints recorded."}</p>{editable && <button className="btn secondary" onClick={() => begin("constraints", brief.constraints.join("\n"))}>Correct constraints</button>}
      <p>Using {brief.context.entries.filter((entry) => !entry.excluded && !entry.unavailable).map((entry) => entry.title).join(", ") || "the supplied request"}.</p>
      <p>{row.governing.status === "unavailable" ? `Design context unavailable: ${row.governing.reason}` : row.governing.artifact ? `Using the governing design system.${row.governingBinding.explicitNone ? " This canvas is exempt from requiring a system." : ""}` : row.governingBinding.explicitNone ? "No written system is required on this canvas." : "No governing design system was found; a provisional direction is needed."}</p>
      {actor && <DesignSystemsButton canvasId={canvasId} actor={actor} target={brief.targetItemId ? { kind: "item", itemId: brief.targetItemId } : brief.groupId ? { kind: "group", groupId: brief.groupId } : { kind: "canvas" }} />}
      {row.governing.artifact && <RequestReferenceCard canvasId={canvasId} requestId={brief.requestId} artifact={row.governing.artifact} />}
      {brief.references.map((reference) => reference.artifact ? <RequestReferenceCard key={reference.id} canvasId={canvasId} requestId={brief.requestId} artifact={reference.artifact} /> : <p key={reference.id}><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.url}</a> · {reference.state === "supplied" ? "Supplied, not inspected" : reference.state}{reference.reason && `: ${reference.reason}`}</p>)}
      <small>{brief.continuation?.resumedBy ? "Context refreshed when this task resumed." : brief.continuation?.scopeCapture.kind === "source-comment" ? "Context captured with the original message." : "Context captured when this task started; the source had no saved selection."}</small>
    </details>
    {row.questions.length > 0 && <details><summary>Design questions · {row.questions.filter((question) => question.status === "open").length} open</summary>{row.questions.map((question) => <p key={question.source.payloadId}>{question.questions.headline} · {question.outstandingQuestionIds.length ? `${question.outstandingQuestionIds.length} unresolved` : question.resolutions.map((one) => one.state).join(", ") || "no response"}</p>)}<p>{brief.continuation?.acceptedResponses.length ?? 0} accepted responses retained in this brief.</p></details>}
    {row.nextAction === "reconcile" && editable && !reconciling && <button className="btn secondary" onClick={() => setReconciling(true)}>Continue from answers…</button>}
    {reconciling && canEdit && actor && <DesignTaskReconcile key={JSON.stringify([canvasId, actor.id, brief.requestId])} canvasId={canvasId} actor={actor} row={row} checking={checking} done={() => { setReconciling(false); onChanged(); }} />}
    {row.nextAction === "clarify" && <p className="design-task-help">Resolve the missing audience or main task using the request’s context, a stated assumption, or a small set of consequential questions. You can keep moving without an interview.</p>}
    {row.reasons.map((reason) => <p role="status" key={reason}>{reason}</p>)}
    {checking && <p role="status">Checking current task and evidence…</p>}
    {brief.outputIds.map((id) => <a key={id} className="design-task-result" href={workbenchItemPath(canvasId, id)}>Open result · {canvas?.items[id]?.title ?? "Saved output"}</a>)}
    {row.receipts.map((receipt) => <DesignReceiptView key={receipt.ref.versionId} canvasId={canvasId} requestId={brief.requestId} saved={receipt} checking={checking} />)}
    {brief.progress === "completed" && row.receipts.length === 0 && <p className="design-task-help">Unverified draft · this completed task has no published evidence yet.</p>}
    {edit && canEdit && <form className="design-task-editor" onSubmit={(event) => { event.preventDefault(); void mutation.run({ type: "design.request", action: operation() }); }}>
      <h4>{edit.mode === "complete" ? "Finish this task" : edit.mode === "resume" ? "Resume this task" : edit.mode === "cancel" ? "Cancel this task" : "Correct the brief"}</h4>
      {staleDraft && <p role="alert">The brief changed after you began this correction. Your draft is retained. Review the current brief before applying it to the newer version.</p>}
      <fieldset disabled={mutation.busy || !!mutation.pending}>{edit.mode === "complete" ? <><p>Completed progress does not claim the result was checked. Publish evidence separately.</p><label>Output items<select multiple value={edit.outputIds} onChange={(event) => keep({ ...edit, outputIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{Object.values(canvas?.items ?? {}).filter((item) => !item.versions.find((version) => version.id === item.currentVersionId)?.designRecord).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></> : <label>{edit.mode === "resume" || edit.mode === "cancel" ? "Reason" : edit.mode === "constraints" ? "Constraints, one per line" : "Your correction"}<textarea autoFocus rows={3} required={edit.mode === "resume" || edit.mode === "fact"} value={edit.text} onChange={(event) => keep({ ...edit, text: event.target.value })} /></label>}</fieldset>
      {staleDraft && !mutation.pending && <button className="btn secondary" type="button" onClick={() => keep({ ...edit, base: row.ref, epoch: brief.epoch })}>I reviewed the newer brief; keep my correction</button>}
      <footer><button className="btn secondary" type="button" disabled={!!mutation.pending} onClick={() => keep(null)}>Close correction</button><button className="btn primary" disabled={mutation.busy || checking || staleDraft && !mutation.pending}>{mutation.pending ? "Retry saved action" : edit.mode === "complete" ? "Finish task" : edit.mode === "resume" ? "Resume task" : edit.mode === "cancel" ? "Cancel task" : "Save correction"}</button></footer>
    </form>}
    <MutationNotice mutation={mutation} />{storageError && <p role="alert">{storageError}</p>}
    {canEdit && mutation.pending && !edit && <button className="btn secondary" disabled={mutation.busy} onClick={() => void mutation.run()}>Retry saved task action</button>}
    {canEdit && !checking && !edit && !mutation.pending && <footer>{row.allowedActions.includes("resume") && <button className="btn secondary" onClick={() => begin("resume")}>Resume task</button>}{row.allowedActions.includes("cancel") && <button className="btn secondary" onClick={() => begin("cancel")}>Cancel task</button>}{row.allowedActions.includes("complete") && <button className="btn secondary" onClick={() => begin("complete")}>Finish task…</button>}{row.allowedActions.includes("receipt") && <button className="btn secondary" onClick={() => setPublishing(!publishing)}>Publish evidence…</button>}</footer>}
    {publishing && canEdit && actor && <DesignReceiptEditor key={JSON.stringify([canvasId, actor.id, brief.requestId])} canvasId={canvasId} actor={actor} row={row} checking={checking} done={() => { setPublishing(false); onChanged(); }} />}
    <details><summary>Task provenance</summary><p>Original requester: {names[brief.requestingActorId] ?? brief.requestingActorId}</p><p>Request {brief.requestId} · epoch {brief.epoch}</p><p>Brief version {row.ref.versionId}</p><p>{row.remainingInitialQuestions > 0 ? "Canvas discovery: initial batch unused (up to 3 questions)." : "Canvas initial batch already used."}{brief.source.entrance === "external-agent" && " Native dialogue is not counted here."}</p></details>
  </article>;
}
