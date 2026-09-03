import { useState } from "react";
import type { Actor } from "@isocan/core";
import { OfflineError, redo, undo } from "../lib/api.ts";
import { setNotice } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { zoomBy, zoomTo100, zoomToFit, zoomToSelection } from "../lib/zoomactions.ts";
import { useCanEdit } from "../lib/capability.ts";

/**
 * Bottom-right navigation cluster (Stitch-style): undo/redo, then a zoom group
 * whose percentage opens a menu of the jumps — 100%, Fit, Selection — each also
 * a keyboard shortcut. History and navigation only; nothing here mutates the
 * canvas's content (that lives up top now).
 */
/**
 * Undo that could not happen, said out loud (phase 10).
 *
 * These two `catch`es used to be `() => {}` — "nothing to undo" is the
 * ordinary answer and not worth a word — and that swallow was fine until there
 * was a second reason to fail. Offline, the button did nothing and said
 * nothing, which is precisely the shape of failure this phase is about.
 * `OfflineError` is the one refusal here worth a sentence: nothing left on the
 * stack still is not.
 */
function sayWhy(err: unknown): void {
  if (err instanceof OfflineError) setNotice(err.message);
}

export function ZoomControls({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const hasSelection = useUiStore((s) => s.selectedItemIds.length > 0);
  const canEdit = useCanEdit();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismissOnOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));

  const rows: { label: string; keys: string; run: () => void; disabled?: boolean }[] = [
    { label: "Zoom in", keys: "⌘ +", run: () => zoomBy(1.25) },
    { label: "Zoom out", keys: "⌘ −", run: () => zoomBy(1 / 1.25) },
    { label: "Zoom to 100%", keys: "⇧ 0", run: zoomTo100 },
    { label: "Zoom to Fit", keys: "⇧ 1", run: zoomToFit },
    { label: "Zoom to Selection", keys: "⇧ 2", run: zoomToSelection, disabled: !hasSelection },
  ];

  return (
    <div className="zoom-controls" onPointerDown={(e) => e.stopPropagation()}>
      {/* Undo and redo are writes — a reader keeps the zoom group and loses
          these two (roles phase 1, `HIDDEN_WRITES`). */}
      {canEdit && (
        <>
          <button className="btn icon" title="Undo (⌘Z)" onClick={() => void undo(canvasId, actor).catch(sayWhy)}>
            ↩︎
          </button>
          <button className="btn icon" title="Redo (⇧⌘Z)" onClick={() => void redo(canvasId, actor).catch(sayWhy)}>
            ↪︎
          </button>
        </>
      )}
      <div className="zoom-group" ref={menuRef}>
        <button className="zoom-step" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          −
        </button>
        <button
          className={`zoom-pct${menuOpen ? " active" : ""}`}
          title="Zoom options"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {Math.round(scale * 100)}%
        </button>
        <button className="zoom-step" title="Zoom in" onClick={() => zoomBy(1.25)}>
          +
        </button>
        {menuOpen && (
          <div className="zoom-menu">
            {rows.map((r) => (
              <button
                key={r.label}
                className="zoom-menu-row"
                disabled={r.disabled}
                onClick={() => {
                  r.run();
                  setMenuOpen(false);
                }}
              >
                <span>{r.label}</span>
                <span className="zoom-menu-keys">{r.keys}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
