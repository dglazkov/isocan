import { ago, majorWhat } from "@isocan/core";
import { useCardPeek } from "../lib/cardpeek.ts";

/**
 * **What happened here before the last thing.**
 *
 * The card already says the most recent act. This is the two or three before
 * it — the seams, from the same significance function the timeline track and
 * `isocan timeline` read, so a peek says what a tick on that track would say.
 *
 * A component of its own because the reading is lazy and a hook cannot live
 * inside the map that draws the cards. That is also the point: nothing is
 * fetched until somebody points at a card, so a hundred canvases cost a
 * hundred metadata files and no logs at all.
 */
export function CardPeek({ canvasId, open }: { canvasId: string; open: boolean }) {
  const seams = useCardPeek(canvasId, open);
  if (!open) return null;
  /* Nothing to say is said, briefly. An empty box that appears on hover and
     explains nothing is worse than no box — and "only the one thing" is a
     real answer about a canvas somebody opened once. */
  if (seams !== null && seams.length <= 1) return null;
  const nowMs = Date.now();
  return (
    <div className="card-peek" aria-hidden>
      {seams === null ? (
        <span className="card-peek-quiet">reading…</span>
      ) : (
        seams.map((seam) => (
          <span className="card-peek-row" key={seam.seq}>
            <span className="card-peek-what">{majorWhat(seam)}</span>
            <span className="card-peek-when">{ago(seam.ts, nowMs)}</span>
          </span>
        ))
      )}
    </div>
  );
}
