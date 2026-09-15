import { useCallback, useEffect, useState } from "react";
import type { Actor, DesignBrief } from "@isocan/core";
import { newItemId, newVersionId } from "@isocan/core";
import { readDesignRequests, type DesignRequestFilter, type DesignRequestReadResult } from "@isocan/api/design-request";
import { designRequestReadIO } from "../lib/design-request.ts";
import { useDesignMutation } from "../lib/design-request-draft.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useCanEdit } from "../lib/capability.ts";
import { DesignTaskCard } from "./DesignTaskCard.tsx";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import "./design-task.css";

/** One permission-bearing projection is shared by chat and the output disclosure. */
export function DesignTaskPanel({ canvasId, actor, filter, startSource, onStarted, presentation = "chat" }: { canvasId: string; actor: Actor; filter?: DesignRequestFilter | undefined; startSource?: Extract<DesignBrief["source"], { entrance: "canvas-chat" }> | null | undefined; onStarted?: (() => void) | undefined; presentation?: "chat" | "inspector" | "disclosure" }) {
  const seq = useCanvasStore((state) => state.lastSeq);
  const permitted = useCanEdit();
  const past = useCanvasStore((state) => state.past);
  const canEdit = permitted && !past;
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [loaded, setLoaded] = useState<{ scope: string; value: DesignRequestReadResult } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filter ?? {});
  const scope = JSON.stringify([canvasId, actor.id, filterKey]);
  const result = loaded?.scope === scope ? loaded.value : null;
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void readDesignRequests(designRequestReadIO, { canvasId, filter: JSON.parse(filterKey) as DesignRequestFilter, signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setLoaded({ scope, value }); }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not read design tasks."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canvasId, filterKey, seq, revision, scope]);
  if (presentation !== "chat" && !result?.requests.length && !error) return null;
  const content = <section className="design-task-panel" aria-label="Design tasks" aria-busy={loading}>
    {startSource && canEdit && <DesignTaskStart key={JSON.stringify([canvasId, actor.id, startSource])} canvasId={canvasId} actor={actor} source={startSource} done={() => { refresh(); onStarted?.(); }} cancel={() => onStarted?.()} />}
    {loading && !result && <p role="status">Reading design tasks…</p>}
    {error && <p role="alert">{error} <button className="btn secondary" onClick={refresh}>Retry task read</button></p>}
    {result?.requests.map((row) => <DesignTaskCard key={JSON.stringify([canvasId, actor.id, row.brief.requestId])} canvasId={canvasId} actor={actor} row={row} onChanged={refresh} checking={loading || !!error} canEdit={canEdit} />)}
    {result?.unavailable.map((one) => <p role="alert" key={one.itemId}>A saved design record could not be read: {one.reason}</p>)}
    {!loading && !error && !startSource && result?.requests.length === 0 && <p>No design task is associated with this view.</p>}
  </section>;
  return presentation === "inspector" ? <aside className="wb-inspector" aria-label="Design task">{content}</aside> : presentation === "disclosure" ? <details className="design-task-disclosure"><summary>Design task and evidence</summary>{content}</details> : content;
}

function DesignTaskStart({ canvasId, actor, source, done, cancel }: { canvasId: string; actor: Actor; source: Extract<DesignBrief["source"], { entrance: "canvas-chat" }>; done: () => void; cancel: () => void }) {
  const canvas = useCanvasStore((state) => state.canvas);
  const body = canvas?.threads[source.threadId]?.comments.find((comment) => comment.id === source.commentId)?.body;
  const draftKey = `isocan.design.start.v1:${JSON.stringify([canvasId, actor.id, source.threadId, source.commentId])}`;
  const [saved] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(draftKey) ?? "null"); return value && typeof value.audience === "string" && typeof value.task === "string" && typeof value.target === "string" && ["html-node", "connected-app", "wireframe", "exploration"].includes(value.delivery) && ["create", "extend", "refine"].includes(value.intent) ? value as { audience: string; task: string; target: string; delivery: DesignBrief["delivery"]; intent: DesignBrief["intent"] } : null; } catch { return null; }
  });
  const [audience, setAudience] = useState(saved?.audience ?? "");
  const [task, setTask] = useState(saved?.task ?? "");
  const [target, setTarget] = useState(saved?.target ?? "");
  const [delivery, setDelivery] = useState<DesignBrief["delivery"]>(saved?.delivery ?? "html-node");
  const [intent, setIntent] = useState<DesignBrief["intent"]>(saved?.intent ?? "create");
  const [storageError, setStorageError] = useState("");
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify({ audience, task, target, delivery, intent })); setStorageError(""); } catch { setStorageError("The task draft could not be saved for refresh. Keep this page open."); } }, [draftKey, audience, task, target, delivery, intent]);
  const mutation = useDesignMutation(canvasId, actor, `start:${source.threadId}:${source.commentId}`, () => { try { localStorage.removeItem(draftKey); } catch { /* Canonical task is already saved. */ } done(); });
  return <section className="design-task-card" aria-label="Start a design task"><h3>Start design task</h3><blockquote>{body ?? "The source message is unavailable."}</blockquote>
    <form onSubmit={(event) => { event.preventDefault(); void mutation.run({ type: "design.request", action: { kind: "start", admission: "explicit", requestId: `request_${crypto.randomUUID()}`, itemId: newItemId(), versionId: newVersionId(), title: "Design task", source, fields: { audience: audience.trim() || null, primaryTask: task.trim() || null, intent, delivery, fidelity: delivery === "wireframe" ? "wireframe" : "designed", targetItemId: target || null, groupId: null, constraints: [], facts: [], references: [], outstandingDecisionIds: [], outputIds: [] } } }); }}>
      <fieldset disabled={mutation.busy || !!mutation.pending}><legend>Use what is already known</legend><p className="design-task-help">The designer can continue from this message and its context. These details are optional.</p>
        <label>Who is it for?<input value={audience} onChange={(event) => setAudience(event.target.value)} /></label><label>Main task<input value={task} onChange={(event) => setTask(event.target.value)} /></label>
        <details><summary>Delivery and existing work</summary><label>Deliver as<select value={delivery} onChange={(event) => setDelivery(event.target.value as DesignBrief["delivery"])}><option value="html-node">Runnable HTML node</option><option value="connected-app">Connected application</option><option value="wireframe">Working wireframe</option><option value="exploration">Design exploration</option></select></label><label>Intent<select value={intent} onChange={(event) => setIntent(event.target.value as DesignBrief["intent"])}><option value="create">Create something new</option><option value="extend">Extend existing work</option><option value="refine">Refine existing work</option></select></label><label>Existing output to extend or refine<select required={intent !== "create"} value={target} onChange={(event) => setTarget(event.target.value)}><option value="">No existing output</option>{Object.values(canvas?.items ?? {}).filter((item) => !item.versions.find((version) => version.id === item.currentVersionId)?.designRecord).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></details>
      </fieldset>{storageError && <p role="alert">{storageError}</p>}<MutationNotice mutation={mutation} /><footer><button className="btn secondary" type="button" onClick={cancel}>Close</button><button className="btn primary" disabled={!body || mutation.busy}>{mutation.pending ? "Retry start" : "Start task"}</button></footer>
    </form></section>;
}

/** Every lifecycle control exposes the same saved retry and definitive-refusal recovery. */
export function MutationNotice({ mutation }: { mutation: ReturnType<typeof useDesignMutation> }) {
  return <>{mutation.error && <p role="alert">{mutation.error}</p>}{mutation.storageError && <p role="alert">{mutation.storageError}</p>}{mutation.pending && <p role="status">This action keeps its original retry identity.{mutation.refused && <> <button className="btn secondary" type="button" onClick={mutation.clear}>Edit draft after refusal</button></>}</p>}</>;
}

