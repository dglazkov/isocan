import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Actor, CanvasContents, Item } from "@isocan/core";
import { citeLabel, designWordSpans, goodnightNotes, parentOf, proposalCites, proposalsOf, PROMISE_TAKE_PROP, PROPOSAL_PROP, PROPOSAL_WHY_PROP, type NightNote } from "@isocan/core";
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
      {goodnightNotes(canvas).map(({ item, note }) => (
        <NightTicks key={item.id} item={item} note={note} canvasId={canvasId} actor={actor} canEdit={canEdit} />
      ))}
    </>
  );
}

/** What a promise's chip says: whose goodnight, which line. */
function promiseLabel(canvas: CanvasContents, item: Item): string {
  const ref = proposalCites(item).find((c) => c.kind === "promise")?.ref ?? "";
  const [noteId, n] = ref.split("#");
  const note = goodnightNotes(canvas).find((one) => one.item.id === noteId)?.note;
  return note ? `${note.person.name}'s goodnight · line ${n}` : "a goodnight";
}

function ProposalMark({ canvas, item, canvasId, actor, canEdit }: { canvas: CanvasContents; item: Item; canvasId: string; actor: Actor; canEdit: boolean }) {
  const source = canvas.items[parentOf(item) ?? ""];
  const state = item.properties[PROPOSAL_PROP];
  const hunch = state === "hunch";
  const promised = state === "promised";
  const failed = state === "failed";
  // A failed promise can be kept or compared only when it carries the take it would have shown.
  const take = !failed || Boolean(item.properties[PROMISE_TAKE_PROP]);
  const cite = proposalCites(item)[0];
  const why = item.properties[PROPOSAL_WHY_PROP] ?? "";
  const stop = (e: ReactPointerEvent) => e.stopPropagation();
  const keep = () => void import("../lib/choose.ts").then((m) => m.chooseVariation(canvasId, actor, item.id));
  const compare = () => void import("./VersionCompare.tsx").then((m) => m.openCompare({ canvasId, actor, itemId: item.id, source: true }));
  const remove = () => void import("../lib/proposalDelete.ts").then((m) => m.deleteProposals(canvasId, actor, [item.id]));
  const label = cite?.kind === "promise" ? promiseLabel(canvas, item) : cite ? citeLabel(canvas, cite) : "";
  return (
    <div data-proposal={item.id} data-hunch={hunch ? "" : undefined} data-promise={promised ? "promised" : failed ? "failed" : undefined}>
      {source && <Connector from={source} to={item} />}
      <div className="proposal-outline" style={{ left: item.x, top: item.y, width: item.width, height: item.height }} aria-hidden />
      <div className="proposal-anchor" style={{ left: item.x + item.width, top: item.y } as CSSProperties}>
        <div className="proposal-note" onPointerDown={stop}>
          <span className="proposal-chip" title={label ? `Prompted by ${label}` : undefined}>
            <b>{promised ? "promised tonight" : failed ? "did not work" : hunch ? "hunch" : "proposal"}</b>
            {label && <span>{label}</span>}
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
          {canEdit && promised && (
            <div className="proposal-actions" role="toolbar" aria-label={`Promise: ${item.title}`}>
              <button type="button" className="btn" onClick={remove} title="Take this line off tonight's list (⌫) — it stays an offer on the note">Not tonight</button>
            </div>
          )}
          {canEdit && !promised && (
            <div className="proposal-actions" role="toolbar" aria-label={`Proposal: ${item.title}`}>
              {take && <button type="button" className="btn" onClick={keep} title="Make this the next version of what it came from">Keep</button>}
              {take && <button type="button" className="btn" onClick={compare} title="Side by side with what it came from">Compare</button>}
              <button type="button" className="btn" onClick={remove} title="Delete it (⌫) — the agent is asked what it should learn">Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * **Tonight's list, tickable** (proactive-agent phase 2): beside a goodnight
 * note, its lines with their boxes. Unticking one — only the note's own
 * person may — keeps it on the note as an offer and takes its empty frame,
 * one undo. A line cannot be ticked back here: a new promise is the lead's
 * to make, against the cap, in the conversation.
 */
function NightTicks({ item, note, canvasId, actor, canEdit }: { item: Item; note: NightNote; canvasId: string; actor: Actor; canEdit: boolean }) {
  const mine = canEdit && note.person.id === actor.id;
  if (note.lines.length === 0) return null;
  const untick = (n: number) => void import("../lib/goodnight.ts").then((m) => m.untickGoodnight(canvasId, actor, item, n));
  return (
    <div className="proposal-anchor" style={{ left: item.x + item.width, top: item.y } as CSSProperties}>
      <div className="proposal-note night-ticks" data-handoff={item.id} onPointerDown={(e) => e.stopPropagation()}>
        <span className="proposal-chip"><b>tonight</b><span>{mine ? "untick what you do not want" : `${note.person.name}'s goodnight`}</span></span>
        {note.lines.map((line) => (
          <label key={line.n} className="night-line" data-line={line.n}>
            <input
              type="checkbox"
              checked={line.ticked}
              disabled={!mine || !line.ticked || Boolean(line.result)}
              onChange={() => untick(line.n)}
            />
            <span>{line.text}{line.result ? ("failed" in line.result ? " — did not work" : " — done") : ""}</span>
          </label>
        ))}
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
