import type { Actor } from "@isocan/core";
import { contextPieces } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { PanelResizer } from "./PanelResizer.tsx";
import { ContextGlyph } from "./Glyphs.tsx";
import { PanelHead } from "./PanelHead.tsx";

/**
 * **What an agent will actually read when it starts work here.**
 *
 * Nobody could answer that, including the agents — the answer was scattered
 * across the guide, the design system, the Chat, the bound directory and the
 * items, assembled by habit and differently every time, with the person
 * unable to see what had been assembled.
 *
 * **It stores nothing.** Every line is counted from the canvas at the moment
 * you look, which is why this stage came first: there is no context record to
 * keep in step with the thing it describes, so the view itself can never be
 * stale about anything except by being closed.
 *
 * `contextPieces` is shared with `isocan context` — a view the CLI cannot
 * print is a view agents cannot use, and the whole point is that both read the
 * same thing.
 *
 * The machine facts are absent HERE on purpose. A bound directory is a fact
 * about somebody's laptop; listing it in a browser as "not here" would report
 * the absence of a thing that cannot exist on this surface.
 */
export function ContextPanel({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const open = useUiStore((s) => s.contextPanelOpen);
  const canvas = useCanvasStore((s) => s.canvas);
  const panelWidth = useUiStore((s) => s.panelWidth);
  if (!open || !canvas) return null;
  void actor;
  const pieces = contextPieces(canvas);

  return (
    <aside
      className="context-panel dock-panel floats"
      style={{ width: panelWidth }}
      aria-label="What an agent reads here"
    >
      <PanelHead
        glyph={<ContextGlyph size={13} />}
        name="Context"
        hint="what an agent reads before it starts"
        closeTitle="Collapse"
        closeLabel="Close the context view"
        onClose={() => openPanel(canvasId, null)}
      />
      <div className="context-body">
        {pieces.map((piece) => (
          <div
            key={piece.name}
            className={`ctx-row${piece.present ? "" : " absent"}${piece.stale ? " stale" : ""}`}
          >
            <div className="ctx-line">
              <span className="ctx-name">{piece.name}</span>
              <span className="ctx-size">{piece.present ? (piece.size ?? "yes") : "not here"}</span>
            </div>
            {/* A reason, never a bare flag: "3 items have changed since it was
                last written" is actionable, and a warning triangle is an
                accusation. */}
            {piece.stale && <div className="ctx-why">{piece.stale}</div>}
            {piece.fix && (piece.stale || !piece.present) && (
              <div className="ctx-fix">{piece.fix}</div>
            )}
          </div>
        ))}
      </div>
      <PanelResizer />
    </aside>
  );
}
