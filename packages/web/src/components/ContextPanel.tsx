import { useEffect, useState } from "react";
import type { Actor, CanvasContents, ContextLayer, LinkedCanvas } from "@isocan/core";
import { canvasIdOf, contextLayers, memoryLinks, parseCanvasAddress, sourceOf } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import { openPanel } from "../lib/panels.ts";
import { getSnapshot } from "../lib/api.ts";
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
 * **In layers** (`docs/projects/memory/design.md`, phases 0–1): *This
 * canvas* first, then a heading per canvas this one inherits from — a canvas
 * card wearing `memory=inherit` — with the pieces it contributes, each
 * wearing a *from* chip. A linked canvas is pulled the way the card draws
 * it, and one that cannot be read keeps its heading with the reason.
 *
 * `contextLayers` is shared with `isocan context` — a view the CLI cannot
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
  const linked = useLinkedCanvases(open ? canvas : null);
  if (!open || !canvas) return null;
  void actor;
  const layers = contextLayers(canvas, linked);

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
        {layers.map((layer) => (
          <Layer key={layer.canvasId ?? "this"} layer={layer} />
        ))}
      </div>
      <PanelResizer />
    </aside>
  );
}

function Layer({ layer }: { layer: ContextLayer }) {
  return (
    <section className="ctx-layer" aria-label={layer.heading}>
      <h3 className="ctx-heading">
        <span>{layer.heading}</span>
        {layer.canvasId && <span className="ctx-heading-note">inherited</span>}
      </h3>
      {layer.refused && <div className="ctx-why">{layer.refused}</div>}
      {!layer.refused && layer.canvasId && layer.pieces.length === 0 && (
        <div className="ctx-why">Nothing to inherit yet — no design system, no pins.</div>
      )}
      {layer.pieces.map((piece) => (
        <div
          key={piece.name}
          className={`ctx-row${piece.present ? "" : " absent"}${piece.stale ? " stale" : ""}${piece.overridden ? " overridden" : ""}`}
        >
          <div className="ctx-line">
            <span className="ctx-name">{piece.name}</span>
            {piece.from && <span className="ctx-from">from {piece.from.title}</span>}
            <span className="ctx-size">{piece.present ? (piece.size ?? "yes") : "not here"}</span>
          </div>
          {/* Struck rather than hidden: what the link WOULD have contributed
              is still a fact worth reading, and "this canvas's wins" is why. */}
          {piece.overridden && <div className="ctx-why">{piece.overridden}</div>}
          {/* A reason, never a bare flag: "3 items have changed since it was
              last written" is actionable, and a warning triangle is an
              accusation. */}
          {piece.stale && <div className="ctx-why">{piece.stale}</div>}
          {piece.fix && (piece.stale || !piece.present) && (
            <div className="ctx-fix">{piece.fix}</div>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * The linked canvases, pulled once per change in the set of links — the
 * same `getSnapshot` the inception card uses, with the same two refusals
 * in words: a canvas at another home is not asked for here, and a door
 * that says no is reported as the door said it.
 */
function useLinkedCanvases(canvas: CanvasContents | null): LinkedCanvas[] {
  const links = canvas ? memoryLinks(canvas) : [];
  const key = links.map((item) => `${item.id}:${canvasIdOf(item)}`).join("|");
  const [linked, setLinked] = useState<LinkedCanvas[]>([]);
  useEffect(() => {
    if (!canvas) return;
    let live = true;
    const items = memoryLinks(canvas);
    void Promise.all(
      items.map(async (item): Promise<LinkedCanvas> => {
        const id = canvasIdOf(item)!;
        const address = sourceOf(item);
        const elsewhere = address ? parseCanvasAddress(address)?.origin : null;
        if (elsewhere && elsewhere !== window.location.origin) {
          return { item, canvasId: id, title: item.title, canvas: null, refused: `Lives at ${elsewhere.replace(/^https?:\/\//, "")} — not read from here.` };
        }
        try {
          const snapshot = await getSnapshot(id);
          return { item, canvasId: id, title: snapshot.project.title, canvas: snapshot.canvas };
        } catch (err) {
          const status = (err as { status?: number }).status;
          return {
            item,
            canvasId: id,
            title: item.title,
            canvas: null,
            refused:
              status === 401 || status === 403
                ? "You are not admitted to this canvas — open it to ask at its door."
                : "This canvas could not be read right now.",
          };
        }
      }),
    ).then((rows) => {
      if (live) setLinked(rows);
    });
    return () => {
      live = false;
    };
    // The set of links is the dependency, not the canvas object — every op
    // replaces the canvas, and a pull per keystroke elsewhere is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return links.length === 0 ? [] : linked;
}
