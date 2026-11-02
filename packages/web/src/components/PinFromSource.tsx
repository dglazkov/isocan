import { useRef, useState } from "react";
import type { Actor, CanvasContents } from "@isocan/core";
import { pinFromSource, readPinSource, type PinSourceOffer } from "@isocan/api/context-pin";
import { contextPinIO } from "../lib/context-pin.ts";
import { useCanEdit } from "../lib/capability.ts";

/**
 * **Copy a piece here** (`docs/projects/memory/pin-from-source.md`).
 *
 * The picker for one ordinary inherited layer. It does none of the deciding:
 * what a source offers, what refuses and what lands is
 * `@isocan/api/context-pin`, shared with `isocan context pin --from`, because a
 * panel that decided eligibility for itself would be a second answer to a
 * question the terminal already answers.
 *
 * What this file owns is what somebody SEES: that the offer is read fresh when
 * the picker opens rather than derived from the Context summary beside it;
 * that a piece which cannot be copied says why instead of disappearing; that a
 * group says how many items it will bring BEFORE the button is pressed; and
 * that the sentence about this being a copy of the current version is on the
 * screen at the moment of the decision rather than in a tooltip afterwards.
 */
export function PinFromSource({ canvasId, canvas, actor, home, from, refresh }: {
  canvasId: string;
  canvas: CanvasContents;
  actor: Actor;
  home: string;
  /** The inheritance card on this canvas — the concrete visible edge. */
  from: string;
  refresh: () => void;
}) {
  const canEdit = useCanEdit();
  const [offer, setOffer] = useState<PinSourceOffer | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const control = useRef<AbortController | null>(null);

  async function act(work: (signal: AbortSignal) => Promise<void>) {
    control.current?.abort();
    const controller = new AbortController();
    control.current = controller;
    setBusy(true); setError(null);
    try { await work(controller.signal); }
    catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  if (!canEdit) return null;
  const piece = offer?.pieces.find((one) => one.itemId === chosen) ?? null;
  return <div className="ctx-pin" aria-label="Copy a piece here">
    {!offer && <button className="btn" disabled={busy} onClick={() => void act(async (signal) => {
      const answer = await readPinSource(contextPinIO, { canvas, home, from, signal });
      signal.throwIfAborted();
      setOffer(answer);
      setChosen(answer.pieces.find((one) => !one.refused)?.itemId ?? null);
    })}>Copy a piece here</button>}
    {offer && <div className="ctx-pin-picker">
      <p className="ctx-why">Pieces on “{offer.title}” you can keep here.</p>
      {offer.pieces.length === 0 && <p className="ctx-why">This source has no design system and no pinned items yet.</p>}
      {offer.pieces.map((one) => <label key={one.itemId} className={`ctx-pin-piece${one.refused ? " refused" : ""}`}>
        <input
          type="radio" name={`ctx-pin-${from}`} value={one.itemId}
          checked={chosen === one.itemId} disabled={busy || !!one.refused}
          onChange={() => { setChosen(one.itemId); setDone(null); }}
        />
        <span className="ctx-pin-name">{one.title}</span>
        <span className="ctx-pin-kind">{one.kind === "design" ? "design system" : "pinned"}</span>
        {/* How many items, before the decision rather than after it: a pinned
            group is the case where "copy this" and "copy these eleven" are the
            same gesture, and the count is the only thing that says which. */}
        {!one.refused && one.count > 1 && <span className="ctx-pin-count">copies {one.count} items</span>}
        {one.refused && <span className="ctx-why">{one.refused}</span>}
      </label>)}
      {/* The sentence belongs HERE, at the moment of the decision. */}
      <p className="ctx-why">
        This copies the current version, including a group's contents. Later edits on “{offer.title}” will not update it.
      </p>
      <div className="ctx-pin-actions">
        <button className="btn" disabled={busy || !piece} onClick={() => void act(async (signal) => {
          const result = await pinFromSource(contextPinIO, { canvasId, home, actor, from, piece: piece!.itemId, signal });
          signal.throwIfAborted();
          setDone(`“${result.title}” is copied here and pinned — ${result.count} item${result.count === 1 ? "" : "s"} from ${result.source.canvasTitle}.`);
          setOffer(null); setChosen(null);
          refresh();
        })}>Copy and pin</button>
        <button className="btn" disabled={busy} onClick={() => { control.current?.abort(); setOffer(null); setChosen(null); setBusy(false); }}>Cancel</button>
      </div>
    </div>}
    {busy && <p className="ctx-why" role="status">Working…</p>}
    {done && <p className="ctx-why" role="status">{done}</p>}
    {error && <p className="ctx-why" role="alert">{error}</p>}
  </div>;
}
