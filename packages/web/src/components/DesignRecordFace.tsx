import { useCallback, useEffect, useState } from "react";
import type { Actor, DesignBrief, DesignReceipt, ItemVersion } from "@isocan/core";
import { parseDesignBrief } from "@isocan/core/design-brief";
import { parseDesignReceipt } from "@isocan/core/design-partner";
import { readDesignRequests, type DesignRequestView } from "@isocan/api/design-request";
import { blobUrl, readBlobText } from "../lib/api.ts";
import { designRequestReadIO } from "../lib/design-request.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useCanEdit } from "../lib/capability.ts";
import { DesignReviewButton } from "./DesignReviewButton.tsx";
import { DesignTaskCard } from "./DesignTaskCard.tsx";
import { DesignReceiptView } from "./DesignTaskReceipt.tsx";
import { everyWhileVisible } from "../lib/whilevisible.ts";
import "./design-task.css";

/** Only admitted version markers select this lazy face; ordinary JSON never gains workflow standing. */
export function DesignRecordFace({ canvasId, version, actor }: { canvasId: string; version: ItemVersion; actor?: Actor | undefined }) {
  const permitted = useCanEdit();
  const past = useCanvasStore((state) => state.past);
  const canEdit = permitted && !past;
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const seq = useCanvasStore((state) => state.lastSeq);
  const [checking, setChecking] = useState(true);
  useEffect(() => everyWhileVisible(refresh, 10_000), [refresh]);
  const [record, setRecord] = useState<DesignBrief | DesignReceipt | null>(null);
  const [current, setCurrent] = useState<DesignRequestView | null>(null);
  const [error, setError] = useState("");
  const marker = version.designRecord;
  useEffect(() => {
    const controller = new AbortController(); setChecking(true); setError("");
    if (!marker) return;
    void (async () => {
      const raw = JSON.parse(await readBlobText(canvasId, version.blobHash, controller.signal));
      const parsed = marker.kind === "brief" ? parseDesignBrief(raw) : parseDesignReceipt(raw);
      if (controller.signal.aborted) return;
      setRecord(parsed);
      const read = await readDesignRequests(designRequestReadIO, { canvasId, filter: { requestId: marker.requestId }, signal: controller.signal });
      if (!controller.signal.aborted) setCurrent(read.requests[0] ?? null);
    })().catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "This design record could not be read."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [canvasId, version.blobHash, marker, revision, seq]);
  const receipt = current?.receipts.find((saved) => saved.ref.versionId === version.id);
  return <div className="design-record-face" data-design-record={marker?.kind}>
    {error && <p role="alert">{error} <button className="btn secondary" onClick={() => setRevision((value) => value + 1)}>Retry record read</button></p>}
    {current && marker?.kind === "brief" && current.ref.versionId === version.id ? <DesignTaskCard key={JSON.stringify([canvasId, actor?.id, marker.requestId])} canvasId={canvasId} actor={actor ?? null} row={current} canEdit={!!actor && canEdit} checking={checking || !!error} onChanged={() => setRevision((value) => value + 1)} />
      : receipt && marker?.kind === "receipt" ? <DesignReceiptView canvasId={canvasId} requestId={marker.requestId} saved={receipt} checking={checking || !!error} />
      : record ? <article className="design-task-card"><small>{record.kind === "brief" ? "Saved design brief" : "Saved evidence report"} · current standing unavailable</small>{record.kind === "brief" ? <><h3>{record.primaryTask || "Design task"}</h3><p>For {record.audience || "an audience still to clarify"}</p><p>{record.delivery} · {record.progress}</p>{record.facts.map((fact) => <p key={fact.id}><strong>{fact.name}</strong>: {fact.value}{fact.origin === "assumed" ? " (assumption)" : ""}</p>)}</> : <><h3>{record.status === "draft" ? "Unverified draft" : "Reported ready for the agreed scope"}</h3>{record.checks.map((check) => <p key={check.id}>{check.kind} · {check.result}: {check.coverage}</p>)}{record.unresolved.map((limit, index) => <p key={index}>{limit.description}</p>)}</>}</article> : !error && <p role="status">Reading design record…</p>}
    {marker?.kind === "receipt" && <DesignReviewButton canvasId={canvasId} actor={actor ?? null} requestId={marker.requestId} threadId={current?.brief.source.entrance === "canvas-chat" ? current.brief.source.threadId : undefined} canEdit={!!actor && canEdit} />}
    <details><summary>Saved record</summary><a href={blobUrl(canvasId, version.blobHash)} download={version.filename}>Download this exact record</a><p>Version {version.id}</p></details>
  </div>;
}
