import { useState } from "react";
import type { Actor, GcReport } from "@isocan/core";
import { runGc } from "../lib/api.ts";
import { sendEchoed, useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

/** Must match .trash-panel's width in styles.css. */

export function TrashPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.trashOpen);
  // Select the stable reference; deriving `?? []` in the selector would mint
  // a new array per call and loop useSyncExternalStore forever.
  const canvas = useCanvasStore((s) => s.canvas);
  const trash = canvas?.trash ?? [];
  const [confirming, setConfirming] = useState(false);
  const [gcBusy, setGcBusy] = useState(false);
  const [gcResult, setGcResult] = useState<GcReport | null>(null);

  if (!open) return null;

  async function reclaim() {
    setGcBusy(true);
    try {
      setGcResult(await runGc(canvasId));
    } finally {
      setGcBusy(false);
    }
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
        {trash.length === 0 && <div className="trash-none">Trash is empty</div>}
        {trash.map((entry) => (
          <div className="trash-entry" key={entry.item.id}>
            <div className="info">
              <div className="name">{entry.item.title}</div>
              <div className="meta">
                {entry.item.versions.length} version{entry.item.versions.length === 1 ? "" : "s"} ·
                deleted by {entry.deletedBy.name}
              </div>
            </div>
            <button
              className="btn"
              onClick={() =>
                void sendEchoed(canvasId, actor, { type: "item.restore", itemId: entry.item.id })
              }
            >
              Restore
            </button>
          </div>
        ))}
      </div>
      <div className="trash-empty-zone gc-zone">
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
      </div>
      {trash.length > 0 && (
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
