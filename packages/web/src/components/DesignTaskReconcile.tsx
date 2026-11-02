import { useEffect, useState } from "react";
import type { Actor, DesignArtifactRef } from "@isocan/core";
import { newVersionId } from "@isocan/core";
import { parseDesignArtifactRef } from "@isocan/core/design-partner";
import type { DesignAcceptedResponse } from "@isocan/core/design-request";
import type { DesignRequestView } from "@isocan/api/design-request";
import { useDesignMutation } from "../lib/design-request-draft.ts";
import { MutationNotice } from "./DesignTaskPanel.tsx";
import { DesignComment } from "./DesignComment.tsx";
import { useCanvasStore } from "../stores/canvasStore.ts";

type Draft = { brief: DesignArtifactRef; epoch: number; audience: string; primaryTask: string; constraints: string; acceptedResponses: DesignAcceptedResponse[] };
function read(raw: string | null): Draft | null {
  try { const v = JSON.parse(raw ?? "null"); if (!v || !Number.isSafeInteger(v.epoch) || v.epoch < 1 || ["audience", "primaryTask", "constraints"].some((key) => typeof v[key] !== "string") || !Array.isArray(v.acceptedResponses) || v.acceptedResponses.some((one: DesignAcceptedResponse) => !one || typeof one.responseId !== "string" || !one.question || ["threadId", "commentId", "payloadId"].some((key) => typeof one.question[key as keyof typeof one.question] !== "string") || !Number.isSafeInteger(one.question.revision))) return null; return { ...v, brief: parseDesignArtifactRef(v.brief) }; } catch { return null; }
}

/** Settled outcomes stay visible beside deliberate edits; prose is never silently interpreted as a preference. */
export function DesignTaskReconcile({ canvasId, actor, row, checking, done }: { canvasId: string; actor: Actor; row: DesignRequestView; checking: boolean; done: () => void }) {
  const canvas = useCanvasStore((state) => state.canvas);
  const key = `isocan.design.reconcile.v1:${JSON.stringify([canvasId, actor.id, row.brief.requestId])}`;
  const pendingResponses = row.reconciliation;
  const [draft, setDraft] = useState<Draft>(() => { try { return read(localStorage.getItem(key)) ?? { brief: row.ref, epoch: row.brief.epoch, audience: row.brief.audience ?? "", primaryTask: row.brief.primaryTask ?? "", constraints: row.brief.constraints.join("\n"), acceptedResponses: pendingResponses }; } catch { return { brief: row.ref, epoch: row.brief.epoch, audience: row.brief.audience ?? "", primaryTask: row.brief.primaryTask ?? "", constraints: row.brief.constraints.join("\n"), acceptedResponses: pendingResponses }; } });
  const [storageError, setStorageError] = useState("");
  const mutation = useDesignMutation(canvasId, actor, `reconcile:${row.brief.requestId}`, () => { try { localStorage.removeItem(key); } catch { /* The acknowledged patch is durable. */ } done(); });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(draft)); setStorageError(""); } catch { setStorageError("This continuation draft could not be saved for refresh. Keep this page open."); } }, [key, draft]);
  const stale = draft.brief.versionId !== row.ref.versionId || draft.epoch !== row.brief.epoch || draft.acceptedResponses.some((one) => !pendingResponses.some((current) => JSON.stringify(current) === JSON.stringify(one)));
  return <form className="design-task-editor" aria-label="Continue from design answers" onSubmit={(event) => { event.preventDefault(); void mutation.run({ type: "design.request", action: { kind: "update", brief: draft.brief, epoch: draft.epoch, versionId: newVersionId(), acceptedResponses: draft.acceptedResponses, patch: { audience: draft.audience.trim() || null, primaryTask: draft.primaryTask.trim() || null, constraints: draft.constraints.split("\n").map((line) => line.trim()).filter(Boolean) } } }); }}>
    <h4>Continue from the answers</h4><p>Review the outcomes and record what they mean for this brief. Skipping or delegating a decision does not supply a preference.</p>
    {draft.acceptedResponses.map((accepted) => { const comment = canvas?.threads[accepted.question.threadId]?.comments.find((one) => one.design?.kind === "response" && one.design.id === accepted.responseId); return comment ? <DesignComment key={accepted.responseId} comment={comment} /> : <p key={accepted.responseId}>Saved response {accepted.responseId} is unavailable. Refresh before continuing.</p>; })}
    <fieldset disabled={mutation.busy || !!mutation.pending || checking}>{([['audience', 'Audience'], ['primaryTask', 'Main task'], ['constraints', 'Constraints, one per line']] as const).map(([field, label]) => <label key={field}>{label}<textarea value={draft[field]} rows={2} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}</fieldset>
    {stale && <p role="alert">The brief or answers changed. Your proposed fields are retained. <button type="button" className="btn secondary" disabled={!!mutation.pending || checking} onClick={() => setDraft({ ...draft, brief: row.ref, epoch: row.brief.epoch, acceptedResponses: pendingResponses })}>I reviewed the current brief and answers</button></p>}
    {storageError && <p role="alert">{storageError}</p>}<MutationNotice mutation={mutation} /><footer><button type="button" className="btn secondary" onClick={done}>Close</button><button className="btn primary" disabled={mutation.busy || checking || !mutation.pending && (stale || !draft.acceptedResponses.length)}>{mutation.pending ? "Retry continuation" : "Save brief and continue"}</button></footer>
  </form>;
}
