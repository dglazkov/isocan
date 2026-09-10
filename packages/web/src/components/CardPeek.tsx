import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ago, itemPath, majorWhat, opWords } from "@isocan/core";
import { useCardPeek } from "../lib/cardpeek.ts";
import { PEEK_CAP, peekPlacement, type PeekPlacement } from "../lib/peekplace.ts";
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
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<PeekPlacement>({ up: false, maxHeight: PEEK_CAP });

  /**
   * **Open toward the room, and take only the room there is.** The peek
   * hangs below its card — but a card on the last row of a short window
   * would push its preview past the bottom edge, so when there is more room
   * above than below and below is tight, it opens upward instead. Either
   * way the stylesheet's cap is a guess about the window: the real cap is
   * the room on the chosen side, so a short window gets a shorter, scrolling
   * peek rather than one that runs off the screen. Re-measured on open and
   * on RESIZE — the window can shrink under an open preview — but not on
   * scroll, which would flip a box somebody is reading.
   *
   * **`useLayoutEffect`, because `useEffect` runs after paint.** The first
   * frame would render the previous state — side down, cap `PEEK_CAP` — the
   * browser would paint it, and only then would the effect measure and
   * correct. On a card near the bottom of a short window that is a peek
   * painted below the fold and then yanked to the other side of its card:
   * measured at 900×700, a 353px jump between the first frame and the
   * second, and at 800×240 a 240px box hanging 134px off-screen before it
   * clamped to 97. A box that moves after you see it is the bug this whole
   * component was written to stop. Laying out before paint costs one
   * synchronous measure of a box the browser has just laid out anyway.
   *
   * `peek` is deliberately NOT a dependency: the rows arriving do not change
   * the CARD's box, and the card's box is the whole input. That is only true
   * because the peek is an overlay — if it ever re-enters the flow, the card
   * grows when the rows land and this must re-measure with it.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const card = ref.current?.closest(".canvas-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      setPlace(peekPlacement(r.top, r.bottom, window.innerHeight));
    };
    /* A peek with nothing to say renders `null`, so there is no ref to
       measure from and no box to place. Listening for a resize on behalf of
       an element that does not exist is a listener that can only ever bail. */
    if (!ref.current) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  if (!open) return null;
  /* Nothing to say is said, briefly. An empty box that appears on hover and
     explains nothing is worse than no box — and "only the one thing" is a
     real answer about a canvas somebody opened once. */
  if (peek !== null && peek.seams.length <= 1) return null;
  const nowMs = Date.now();
  return (
    <div className={`card-peek${place.up ? " up" : ""}`} ref={ref} style={{ maxHeight: place.maxHeight }}>
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
