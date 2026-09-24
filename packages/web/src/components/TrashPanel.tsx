import { useMemo, useState } from "react";
import { formatBytes, groupRestorePreview, isGroupItem, type Actor, type GcReport } from "@isocan/core";
import { runGc } from "../lib/api.ts";
import { sendEchoed, sendEchoedResult, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useCanEdit } from "../lib/capability.ts";

/** Must match .trash-panel's width in styles.css. */

export function TrashPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.trashOpen);
  // Select the stable reference; deriving `?? []` in the selector would mint
  // a new array per call and loop useSyncExternalStore forever.
  const canvas = useCanvasStore((s) => s.canvas);
  const project = useCanvasStore((s) => s.record);
  const canEdit = useCanEdit();
  const trash = canvas?.trash ?? [];
  const [confirming, setConfirming] = useState(false);
  const [gcBusy, setGcBusy] = useState(false);
  const [gcResult, setGcResult] = useState<GcReport | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [result, setResult] = useState("");
  const preview = useMemo(() => {
    if (!open || !inspecting || !canvas || !project || project.groupMode !== "groups") return null;
    try { return { ...groupRestorePreview({ project, canvas }, [inspecting]), error: "" }; }
    catch (err) { return { restoredIds: [], skippedIds: [], parents: {}, error: (err as Error).message }; }
  }, [open, inspecting, canvas, project]);

  if (!open) return null;

  async function reclaim() {
    setGcBusy(true);
    try {
      const answer = await runGc(canvasId);
      if (useCanvasStore.getState().canvasId === canvasId) setGcResult(answer);
    } finally {
      setGcBusy(false);
    }
  }

  async function restore(itemId: string) {
    if (!canEdit || busy || queued) return;
    setBusy(true); setResult("");
    try {
      let answer = await sendEchoedResult(canvasId, actor, { type: "item.restore", itemId });
      if (useCanvasStore.getState().canvasId !== canvasId) return;
      if (answer.status === "queued") {
        setQueued(true); setResult("Restore queued. Wait for the home before restoring again.");
        if (!answer.completion) return;
        answer = await answer.completion;
        if (useCanvasStore.getState().canvasId !== canvasId) return;
        setQueued(false);
      }
      if (answer.status === "refused") setResult(answer.message ?? "Restore was refused.");
      else {
        const op = answer.envelope?.op;
        const change = op?.type === "group.change" && op.action.kind === "apply" ? op.action.change : null;
        const count = change?.writes.filter((write) => write.kind === "restore").length ?? 1;
        const skipped = change?.skippedIds ?? [];
        setResult(`Restored ${count} item${count === 1 ? "" : "s"}.${skipped.length ? ` Left ${skipped.length} previously restored or re-deleted items untouched: ${skipped.join(", ")}.` : ""}`);
        setInspecting(null);
      }
    } catch (err) { if (useCanvasStore.getState().canvasId === canvasId) setResult((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="trash-panel">
      <header>
        Trash
        <span className="spacer" />
        <button className="btn icon" onClick={() => useUiStore.getState().setTrashOpen(false)}>
          ✕
        </button>
      </header>
      <div className="trash-list">
        {result && <p role="status">{result}</p>}
        {trash.length === 0 && <div className="trash-none">Trash is empty</div>}
        {trash.map((entry) => (
          <div className="trash-entry" key={entry.item.id}>
            <div className="info">
              <div className="name">{entry.item.title}</div>
              <div className="meta">
                {entry.item.versions.length} version{entry.item.versions.length === 1 ? "" : "s"} ·
                deleted by {entry.deletedBy.name}
              </div>
              {project?.groupMode === "groups" && <button className="btn" onClick={() => setInspecting(inspecting === entry.item.id ? null : entry.item.id)} aria-expanded={inspecting === entry.item.id}>Inspect {isGroupItem(entry.item) ? "group " : ""}restore</button>}
              {inspecting === entry.item.id && preview && <div aria-label="Restore preview">
                {preview.error ? <p role="alert">{preview.error}</p> : <>
                  <p>{preview.restoredIds.length} items will return. {preview.skippedIds.length} previously restored or re-deleted items stay untouched.</p>
                  <ul>{preview.restoredIds.map((id) => <li key={id}>{trash.find((row) => row.item.id === id)?.item.title ?? id} · {id} → {preview.parents[id] ? canvas?.items[preview.parents[id]!]?.title ?? preview.parents[id] : "Canvas"}</li>)}</ul>
                  {preview.skippedIds.length > 0 && <p>Skipped: {preview.skippedIds.join(", ")}</p>}
                  {canEdit && <button className="btn" disabled={busy || queued} onClick={() => void restore(entry.item.id)}>Restore {preview.restoredIds.length} items</button>}
                </>}
              </div>}
            </div>
            {canEdit && project?.groupMode !== "groups" && <button
              className="btn"
              disabled={busy || queued}
              onClick={() => void restore(entry.item.id)}
            >
              Restore
            </button>}
          </div>
        ))}
      </div>
      {canEdit && <div className="trash-empty-zone gc-zone">
        <button className="btn" onClick={reclaim} disabled={gcBusy}>
          {gcBusy ? "Reclaiming…" : "Reclaim storage"}
        </button>
        {gcResult && (
          <span className="gc-result">
            {gcResult.sweptBlobs > 0
              ? `freed ${formatBytes(gcResult.sweptBytes)} (${gcResult.sweptBlobs} blob${gcResult.sweptBlobs === 1 ? "" : "s"})`
              : "nothing to free"}
            {` · ${formatBytes(gcResult.reachableBytes)} in use`}
          </span>
        )}
      </div>}
      {canEdit && trash.length > 0 && (
        <div className="trash-empty-zone">
          {confirming ? (
            <>
              <button
                className="btn danger"
                onClick={() => {
                  setConfirming(false);
                  void sendEchoed(canvasId, actor, { type: "trash.empty" });
                }}
              >
                Really empty {trash.length} item{trash.length === 1 ? "" : "s"} — can't be undone
              </button>{" "}
              <button className="btn" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => setConfirming(true)}>
              Empty trash…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
