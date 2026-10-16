import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Actor, CanvasContents, Item } from "@isocan/core";
import { citeLabel, designWordSpans, goodnightNotes, parentOf, proposalCites, proposalsOf, PROMISE_TAKE_PROP, PROPOSAL_PROP, PROPOSAL_WHY_PROP, type NightNote } from "@isocan/core";
import { useCanEdit } from "../lib/capability.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useUiStore } from "../stores/uiStore.ts";
import "./proposal-marks.css";

/**
 * **The proposal marks** (proactive-agent phase 1, design §2–§3) — the
 * wireframe *maybe*'s mark, generalised: under the items, in world units,
 * OUTSIDE each open proposal — a dashed outline beyond its edge, a dashed
 * connector up to the item it came from, and a note: the trigger chip (ochre:
 * what prompted it, never the agent's name), the why, its design words
 * dotted-underlined and defined in place, and Keep, Compare and Delete.
 * Nothing is drawn over the proposal or its source.
 *
 * **Where the note goes is measured, not assumed** (`placeCards`). It used to
 * hang beside the frame's top-right corner, always — and frames hang beneath
 * screens that stand side by side, so the space beside a frame is the NEXT
 * screen's column. At 33% a counter-scaled 254px note is 770 world units
 * wide and covered the neighbour's frame and its note; at 100% it still
 * reached 174 units into an 80-unit gutter. So the note now prefers its own
 * frame's column (beneath it, as wide as the frame looks, up to a limit),
 * goes beside only when that space is actually empty, and otherwise steps
 * down the way far-zoom chrome does: to the chip alone, then to nothing but
 * the outline. A stepped-down note opens on hover, focus or selection.
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
  const selected = useUiStore((s) => s.selectedItemIds);
  const [measured, setMeasured] = useState<Record<string, Measured>>({});
  const onMeasure = useCallback((id: string, m: Measured) => {
    setMeasured((was) => (was[id]?.w === m.w && was[id]?.h === m.h ? was : { ...was, [id]: m }));
  }, []);
  const proposals = useMemo(() => (canvas ? proposalsOf(canvas) : []), [canvas]);
  const nights = useMemo(() => (canvas ? goodnightNotes(canvas).filter(({ note }) => note.lines.length > 0) : []), [canvas]);
  const boxes = useMemo(() => Object.values(canvas?.items ?? {}).map(boxOf), [canvas]);
  const asks = useMemo<CardAsk[]>(
    () => [
      ...nights.map(({ item, note }) => ({ id: item.id, frame: boxOf(item), measured: measured[item.id], guess: ticksGuess(note) })),
      ...proposals.map((item) => ({ id: item.id, frame: boxOf(item), measured: measured[item.id], guess: noteGuess(item, canEdit) })),
    ],
    [nights, proposals, measured, canEdit],
  );
  // One string per placement, so a zoom re-renders the marks only when a
  // note changes slot or steps down — the `zoomDecisions` idea, for notes.
  const key = useUiStore((s) => JSON.stringify(placeCards(asks, boxes, s.viewport.scale).map((p) => [p.id, p.mode, p.slot, p.width])));
  const places = useMemo(() => new Map((JSON.parse(key) as [string, CardMode, CardSlot, number][]).map(([id, mode, slot, width]) => [id, { mode, slot, width }])), [key]);
  if (!canvas) return null;
  const place = (id: string): Placed => places.get(id) ?? { mode: "none", slot: "beneath", width: CARD_W };
  return (
    <>
      {proposals.map((item) => (
        <ProposalMark key={item.id} canvas={canvas} item={item} canvasId={canvasId} actor={actor} canEdit={canEdit} place={place(item.id)} open={selected.includes(item.id)} onMeasure={onMeasure} />
      ))}
      {nights.map(({ item, note }) => (
        <NightTicks key={item.id} item={item} note={note} canvasId={canvasId} actor={actor} canEdit={canEdit} place={place(item.id)} open={selected.includes(item.id)} onMeasure={onMeasure} />
      ))}
    </>
  );
}

// ---------- where a note goes

/** A rectangle in world units. */
type Box = { x: number; y: number; width: number; height: number };
type Measured = { w: number; h: number };
/** Where a note hangs off its frame: under it, in its own column, or beside its top-right corner. */
type CardSlot = "beneath" | "right";
/** The whole note; the chip alone (opens on hover, focus or selection); nothing but the outline (opens on selection). */
type CardMode = "full" | "chip" | "none";
type Placed = { mode: CardMode; slot: CardSlot; width: number };

/**
 * The room every item keeps around itself, in SCREEN pixels, which no note
 * may enter: its name strip above, the row under it (`UNDER_ROW_PAD`'s 8 and
 * the row's 22px buttons), and the selection outline and handles at either
 * side. `UNDER_ROW_PAD` is written out rather than imported: it lives in the
 * entry chunk, and importing one constant from this lazy chunk made the entry
 * export it — 26 bytes on every first visit for the number 8.
 */
const TITLE_ROOM = 26;
const UNDER_ROOM = 8 + 22;
const EDGE_ROOM = 8;
/** Screen gap between a frame's right edge and a note beside it: clear of the corner handle and a pin's nudge. */
const SIDE_GAP = 14;
/** A note's width beside its frame, and an opened chip's. */
const CARD_W = 240;
/** Beneath, a note is as wide as its frame looks — never wider than this… */
const COLUMN_MAX = 320;
/** …and never narrower than this, below which the words stop reading as a note: the chip instead. */
const FULL_MIN = 180;
/** The chip alone: one line. Narrower than CHIP_MIN it says nothing, so the outline stands alone. */
const CHIP_H = 22;
const CHIP_MIN = 48;
/** The part of a note's height that does not grow when it narrows: padding, chip, actions, gaps. */
const FIXED_H = 64;

/** One note to place: the frame it belongs to, and how tall it is at a width (measured once drawn, guessed before). */
interface CardAsk {
  id: string;
  frame: Box;
  measured?: Measured | undefined;
  guess: number;
}

/** A note's place: what it shows, which slot, its width and height in screen pixels, and the box it covers in world units. */
interface CardPlace extends Placed {
  id: string;
  height: number;
  box: Box;
}

function boxOf(item: Item): Box {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function contains(outer: Box, inner: Box): boolean {
  return outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
}

/** A note's height at screen width `w`: the words re-flow, the rest does not. */
function heightAt(ask: CardAsk, w: number): number {
  const base = ask.measured ?? { w: CARD_W, h: ask.guess };
  return Math.ceil(FIXED_H + Math.max(0, base.h - FIXED_H) * (base.w / w));
}

/** Where the note's box sits relative to its anchor, in screen pixels — the one source both the placement and the drawing read. */
function cardOffset(slot: CardSlot): { left: number; top: number } {
  return slot === "beneath" ? { left: 0, top: UNDER_ROOM } : { left: SIDE_GAP, top: 0 };
}

/** The anchor's world point for a slot: the frame's bottom-left, or its top-right. */
function anchorOf(frame: Box, slot: CardSlot): { x: number; y: number } {
  return slot === "beneath" ? { x: frame.x, y: frame.y + frame.height } : { x: frame.x + frame.width, y: frame.y };
}

/**
 * **Where each note goes, at this zoom, measured against what is actually
 * there** — every item, and every note already placed.
 *
 * Each item keeps a margin no note may enter (its name strip, its under-row,
 * its handles), measured in screen pixels and so divided by the scale here.
 * A note tries, in order: **beneath its frame**, in the frame's own column
 * and as wide as the frame looks (up to `COLUMN_MAX`, at least `FULL_MIN`);
 * then **beside its top-right corner**, only when that space is clear. A
 * frame drawn narrower than `FULL_MIN` gets neither: that is far zoom, and a
 * whole note would be bigger than the thing it is about. The
 * column comes first because frames hang beneath screens that stand side by
 * side, so the space beside one is the neighbour's — and the column is the
 * one place nobody else's note claims. Failing both, it steps down: the chip
 * alone, no wider than the frame looks, beneath or else beside; and failing
 * that, nothing but the outline. An item that contains the frame (an area, a group) is
 * what it stands in, not a neighbour, and is not counted against it.
 *
 * Pure, so `proposalmarks.test.ts` can hold three frames side by side to
 * "no note touches another item or note" at every zoom without a browser.
 */
export function placeCards(asks: readonly CardAsk[], items: readonly Box[], scale: number): CardPlace[] {
  const s = scale > 0 ? scale : 1;
  const kept = items.map((b) => ({
    box: b,
    room: { x: b.x - EDGE_ROOM / s, y: b.y - TITLE_ROOM / s, width: b.width + (2 * EDGE_ROOM) / s, height: b.height + (TITLE_ROOM + UNDER_ROOM) / s },
  }));
  const placed: Box[] = [];
  const out: CardPlace[] = [];
  const order = [...asks].sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x);
  for (const ask of order) {
    const f = ask.frame;
    const walls = [
      ...kept.filter((k) => !contains(k.box, f) || (k.box.x === f.x && k.box.y === f.y && k.box.width === f.width && k.box.height === f.height)).map((k) => k.room),
      ...placed,
    ];
    const at = (slot: CardSlot, width: number, height: number): Box => {
      const a = anchorOf(f, slot);
      const o = cardOffset(slot);
      return { x: a.x + o.left / s, y: a.y + o.top / s, width: width / s, height: height / s };
    };
    const clear = (box: Box) => !walls.some((w) => overlaps(box, w));
    const column = Math.min(COLUMN_MAX, f.width * s);
    // A frame drawn narrower than a readable note is far-zoom: a whole note
    // beside it would be bigger than the thing it is about, so it steps down
    // even where the side is empty — every note in a row the same way.
    const tries: [CardSlot, number][] = column >= FULL_MIN ? [["beneath", column], ["right", CARD_W]] : [];
    let done: CardPlace | null = null;
    for (const [slot, width] of tries) {
      const height = heightAt(ask, width);
      const box = at(slot, width, height);
      if (clear(box)) { done = { id: ask.id, mode: "full", slot, width, height, box }; break; }
    }
    if (!done) {
      const width = Math.min(CARD_W, f.width * s);
      for (const slot of ["beneath", "right"] as const) {
        const box = at(slot, width, CHIP_H);
        if (width >= CHIP_MIN && clear(box)) { done = { id: ask.id, mode: "chip", slot, width, height: CHIP_H, box }; break; }
      }
      done ??= { id: ask.id, mode: "none", slot: "beneath", width, height: 0, box: { ...at("beneath", width, 0) } };
    }
    if (done.mode !== "none") placed.push(done.box);
    out.push(done);
  }
  return out;
}

/** A first guess at a proposal's note height at `CARD_W`, before it has been drawn and measured. */
function noteGuess(item: Item, canEdit: boolean): number {
  const why = item.properties[PROPOSAL_WHY_PROP] ?? "";
  const lines = why ? Math.ceil(why.length / 34) : 0;
  return 18 + CHIP_H + (lines ? 8 + lines * 18 : 0) + (canEdit ? 8 + 28 : 0);
}

/** The same guess for tonight's list. */
function ticksGuess(note: NightNote): number {
  return 18 + CHIP_H + note.lines.reduce((h, line) => h + 8 + Math.ceil((line.text.length + 8) / 30) * 18, 0);
}

/**
 * The anchor every note hangs from: counter-scaled at its slot's corner, with
 * the note's width and offset in screen pixels, and a measurement taken while
 * the whole note shows so the next placement knows its real height.
 */
function CardAnchor({ id, frame, place, open, onMeasure, children }: { id: string; frame: Item; place: Placed; open: boolean; onMeasure: (id: string, m: Measured) => void; children: (compact: boolean) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const a = anchorOf(boxOf(frame), place.slot);
  const o = cardOffset(place.slot);
  const full = place.mode === "full";
  useEffect(() => {
    const el = ref.current?.firstElementChild as HTMLElement | null | undefined;
    if (!el || !full || typeof ResizeObserver === "undefined") return;
    const read = () => onMeasure(id, { w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) });
    const watch = new ResizeObserver(read);
    watch.observe(el);
    read();
    return () => watch.disconnect();
  }, [id, full, place.width, onMeasure]);
  const style = { left: a.x, top: a.y, "--card-x": `${o.left}px`, "--card-y": `${o.top}px`, "--card-w": `${place.width}px`, "--card-open-w": `${Math.max(place.width, CARD_W)}px` } as CSSProperties;
  return (
    <div ref={ref} className="proposal-anchor" data-card={place.mode} data-slot={place.slot} data-open={open ? "" : undefined} style={style}>
      {children(!full)}
    </div>
  );
}

/** What a promise's chip says: whose goodnight, which line. */
function promiseLabel(canvas: CanvasContents, item: Item): string {
  const ref = proposalCites(item).find((c) => c.kind === "promise")?.ref ?? "";
  const [noteId, n] = ref.split("#");
  const note = goodnightNotes(canvas).find((one) => one.item.id === noteId)?.note;
  return note ? `${note.person.name}'s goodnight · line ${n}` : "a goodnight";
}

function ProposalMark({ canvas, item, canvasId, actor, canEdit, place, open, onMeasure }: { canvas: CanvasContents; item: Item; canvasId: string; actor: Actor; canEdit: boolean; place: Placed; open: boolean; onMeasure: (id: string, m: Measured) => void }) {
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
      <CardAnchor id={item.id} frame={item} place={place} open={open} onMeasure={onMeasure}>
        {(compact) => (
        <div className="proposal-note" onPointerDown={stop}>
          <span className="proposal-chip" title={label ? `Prompted by ${label}` : undefined} tabIndex={compact ? 0 : undefined}>
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
        )}
      </CardAnchor>
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
function NightTicks({ item, note, canvasId, actor, canEdit, place, open, onMeasure }: { item: Item; note: NightNote; canvasId: string; actor: Actor; canEdit: boolean; place: Placed; open: boolean; onMeasure: (id: string, m: Measured) => void }) {
  const mine = canEdit && note.person.id === actor.id;
  const untick = (n: number) => void import("../lib/goodnight.ts").then((m) => m.untickGoodnight(canvasId, actor, item, n));
  return (
    <CardAnchor id={item.id} frame={item} place={place} open={open} onMeasure={onMeasure}>
      {(compact) => (
      <div className="proposal-note night-ticks" data-handoff={item.id} onPointerDown={(e) => e.stopPropagation()}>
        <span className="proposal-chip" tabIndex={compact ? 0 : undefined}><b>tonight</b><span>{mine ? "untick what you do not want" : `${note.person.name}'s goodnight`}</span></span>
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
      )}
    </CardAnchor>
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
