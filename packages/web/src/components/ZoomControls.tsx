import { useState } from "react";
import type { Actor } from "@isocan/core";
import { redo, undo } from "../lib/api.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { useDismissOnOutside } from "../lib/dismiss.ts";
import { zoomBy, zoomTo100, zoomToFit, zoomToSelection } from "../lib/zoomactions.ts";

/**
 * Bottom-right navigation cluster (Stitch-style): undo/redo, then a zoom group
 * whose percentage opens a menu of the jumps — 100%, Fit, Selection — each also
 * a keyboard shortcut. History and navigation only; nothing here mutates the
 * canvas's content (that lives up top now).
 */
export function ZoomControls({ projectId, actor }: { projectId: string; actor: Actor }) {
  const scale = useUiStore((s) => s.viewport.scale);
  const hasSelection = useUiStore((s) => s.selectedItemIds.length > 0);
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
      <button
        className="btn icon"
        title="Undo (⌘Z)"
        onClick={() => void undo(projectId, actor).catch(() => {})}
      >
        ↩︎
      </button>
      <button
        className="btn icon"
        title="Redo (⇧⌘Z)"
        onClick={() => void redo(projectId, actor).catch(() => {})}
      >
        ↪︎
      </button>
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
