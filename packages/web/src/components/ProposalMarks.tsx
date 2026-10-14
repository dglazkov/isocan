import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Actor, CanvasContents, Item } from "@isocan/core";
import { citeLabel, designWordSpans, parentOf, proposalCites, proposalsOf, PROPOSAL_PROP, PROPOSAL_WHY_PROP } from "@isocan/core";
import { useCanEdit } from "../lib/capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import "./proposal-marks.css";

/**
 * **The proposal marks** (proactive-agent phase 1, design §2–§3) — the
 * wireframe *maybe*'s mark, generalised: under the items, in world units,
 * OUTSIDE each open proposal — a dashed outline beyond its edge, a dashed
 * connector up to the item it came from, and beside its top right corner a
 * note: the trigger chip (ochre: what prompted it, never the agent's name),
 * the why, its design words dotted-underlined and defined in place, and Keep,
 * Compare and Delete. Beside rather than above or below: the item's own title
 * strip owns the space above its top edge, and a second proposal of the same
 * source hangs below the first. Nothing is drawn over the proposal or its source.
 *
 * Derived on every render (`proposalsOf`), so a Keep — which trashes the
 * proposal — takes the mark with it, and its undo brings it back. Drawn the
 * same way for a screen and for a note or a DESIGN.md (the default chosen
 * for design §3's open question, Dion to confirm).
 *
 * Loaded only on a canvas that has a proposal: `CanvasViewport` asks one
 * scan of the items first, so every other canvas fetches none of this.
 */
export default function ProposalMarks({ canvasId, actor }: { canvasId: string; actor: Actor }) {
  const canvas = useCanvasStore((s) => s.past?.canvas ?? s.canvas);
  const past = useCanvasStore((s) => s.past !== null && s.past !== undefined);
  const canEdit = useCanEdit() && !past;
  if (!canvas) return null;
  return (
    <>
      {proposalsOf(canvas).map((item) => (
        <ProposalMark key={item.id} canvas={canvas} item={item} canvasId={canvasId} actor={actor} canEdit={canEdit} />
      ))}
    </>
  );
}

function ProposalMark({ canvas, item, canvasId, actor, canEdit }: { canvas: CanvasContents; item: Item; canvasId: string; actor: Actor; canEdit: boolean }) {
  const source = canvas.items[parentOf(item) ?? ""];
  const hunch = item.properties[PROPOSAL_PROP] === "hunch";
  const cite = proposalCites(item)[0];
  const why = item.properties[PROPOSAL_WHY_PROP] ?? "";
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const keep = () => void import("../lib/choose.ts").then((m) => m.chooseVariation(canvasId, actor, item.id));
  const compare = () => void import("./VersionCompare.tsx").then((m) => m.openCompare({ canvasId, actor, itemId: item.id, source: true }));
  const remove = () => void import("../lib/proposalDelete.ts").then((m) => m.deleteProposals(canvasId, actor, [item.id]));
  return (
    <div data-proposal={item.id} data-hunch={hunch ? "" : undefined}>
      {source && <Connector from={source} to={item} />}
      <div className="proposal-outline" style={{ left: item.x, top: item.y, width: item.width, height: item.height }} aria-hidden />
      <div className="proposal-anchor" style={{ left: item.x + item.width, top: item.y } as CSSProperties}>
        <div className="proposal-note" onPointerDown={stop}>
          <span className="proposal-chip" title={cite ? `Prompted by ${citeLabel(canvas, cite)}` : undefined}>
            <b>{hunch ? "hunch" : "proposal"}</b>
            {cite && <span>{citeLabel(canvas, cite)}</span>}
          </span>
          {why && (
            <p className="proposal-why">
              {designWordSpans(why).map((span, i) =>
                span.word ? (
                  <span key={i} className="proposal-term" tabIndex={0}>
                    {span.text}
                    <span role="tooltip" className="proposal-term-def">
                      <b>{span.word.term}</b> — {span.word.means}
                    </span>
                  </span>
                ) : (
                  <span key={i}>{span.text}</span>
                ),
              )}
            </p>
          )}
          {canEdit && (
            <div className="proposal-actions" role="toolbar" aria-label={`Proposal: ${item.title}`}>
              <button type="button" className="btn" onClick={keep} title="Make this the next version of what it came from">Keep</button>
              <button type="button" className="btn" onClick={compare} title="Side by side with what it came from">Compare</button>
              <button type="button" className="btn" onClick={remove} title="Delete it (⌫) — the agent is asked what it should learn">Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A dashed line from the source's bottom edge to the proposal's top edge, centre to centre. */
function Connector({ from, to }: { from: Item; to: Item }) {
  const a = { x: from.x + from.width / 2, y: from.y + from.height };
  const b = { x: to.x + to.width / 2, y: to.y };
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.max(1, Math.abs(a.x - b.x));
  const height = Math.max(1, Math.abs(a.y - b.y));
  return (
    <svg className="proposal-connector" style={{ left, top, width, height }} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <line x1={a.x - left} y1={a.y - top} x2={b.x - left} y2={b.y - top} />
    </svg>
  );
}
