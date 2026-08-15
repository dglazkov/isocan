import { useState } from "react";
import type { Actor } from "@isocan/core";
import { sendOp } from "../lib/api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";

export function TrashPanel({ projectId, actor }: { projectId: string; actor: Actor }) {
  const open = useUiStore((s) => s.trashOpen);
  // Select the stable reference; deriving `?? []` in the selector would mint
  // a new array per call and loop useSyncExternalStore forever.
  const canvas = useCanvasStore((s) => s.canvas);
  const trash = canvas?.trash ?? [];
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

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
                void sendOp(projectId, actor, { type: "item.restore", itemId: entry.item.id })
              }
            >
              Restore
            </button>
          </div>
        ))}
      </div>
      {trash.length > 0 && (
        <div className="trash-empty-zone">
          {confirming ? (
            <>
              <button
                className="btn danger"
                onClick={() => {
                  setConfirming(false);
                  void sendOp(projectId, actor, { type: "trash.empty" });
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
