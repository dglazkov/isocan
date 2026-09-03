import { Link } from "react-router-dom";
import { ago, itemPath, majorWhat, opWords } from "@isocan/core";
import { useCardPeek } from "../lib/cardpeek.ts";
import { ItemThumb } from "./ItemThumb.tsx";

/**
 * **What happened here before the last thing — shown, not only said.**
 *
 * The card already says the most recent act. This is the two or three before
 * it — the seams, from the same significance function the timeline track and
 * `isocan timeline` read, so a peek says what a tick on that track would say.
 *
 * Each row is the THING when there is one to show: a thumbnail of the item
 * the seam is about, drawn by the same `ItemThumb` the lens and the files
 * panel use, beside the words. "Beckham added something · 4d" five times over
 * was reported as a view that tells you nothing; "Beckham added — a picture
 * of the sketch — 4d" tells you what the canvas is for. A seam about a
 * conversation quotes its opening line, which for a summons or a slash
 * command is what was asked of the agent. A row with an item is a link to
 * that item, full screen; the card around it is a link to the canvas.
 *
 * A component of its own because the reading is lazy and a hook cannot live
 * inside the map that draws the cards. That is also the point: nothing is
 * fetched until somebody points at a card, so a hundred canvases cost a
 * hundred metadata files and no logs at all.
 */
export function CardPeek({ canvasId, open }: { canvasId: string; open: boolean }) {
  const peek = useCardPeek(canvasId, open);
  if (!open) return null;
  /* Nothing to say is said, briefly. An empty box that appears on hover and
     explains nothing is worse than no box — and "only the one thing" is a
     real answer about a canvas somebody opened once. */
  if (peek !== null && peek.seams.length <= 1) return null;
  const nowMs = Date.now();
  return (
    <div className="card-peek">
      {peek === null ? (
        <span className="card-peek-quiet">reading…</span>
      ) : (
        peek.seams.map((seam) => {
          const item = seam.itemId ? peek.items[seam.itemId] : undefined;
          const words = `${seam.actor} ${opWords(seam.kind) ?? seam.kind}`;
          const row = (
            <>
              {item && (
                <span className="card-peek-thumb" aria-hidden>
                  <ItemThumb canvasId={canvasId} itemId={item.id} item={item} width={62} height={44} />
                </span>
              )}
              <span className="card-peek-text">
                <span className="card-peek-what">{item ? words : majorWhat(seam)}</span>
                {item && <span className="card-peek-about">{item.title}</span>}
              </span>
              <span className="card-peek-when">{ago(seam.ts, nowMs)}</span>
            </>
          );
          return item ? (
            <Link
              key={seam.seq}
              className="card-peek-row linked"
              to={itemPath(canvasId, item.id)}
              title={`Open “${item.title}”`}
            >
              {row}
            </Link>
          ) : (
            <span className="card-peek-row" key={seam.seq}>
              {row}
            </span>
          );
        })
      )}
    </div>
  );
}
