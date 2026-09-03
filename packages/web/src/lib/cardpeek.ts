import { useEffect, useState } from "react";
import type { Item, LogEntry, Major } from "@isocan/core";
import { majors } from "@isocan/core";

import { getOplog, getSnapshot } from "./api.ts";

/**
 * **The last few seams on a canvas, fetched when somebody asks to see them.**
 *
 * The card already says what happened LAST — "Di moved something · 2h", from
 * the stamp the reducer keeps. The question a card cannot answer from a
 * metadata file is what happened *before* that, and answering it needs the
 * canvas's log.
 *
 * So it is lazy, and that is the whole design rather than an optimisation.
 * Reading a log per canvas is exactly the cost `lastOp` exists to keep off the
 * home screen: at a hundred canvases an eager version would be a hundred log
 * reads to draw a list. One canvas, when a person points at it, is a different
 * bargain entirely.
 *
 * **Seams, not entries.** `majors` is the same significance function the
 * timeline track and `isocan timeline` use, so a peek says what a tick on the
 * track would say. Forty moves are one ripple; a list of the last five raw
 * entries would show the same drag five times and tell nobody anything.
 *
 * **And the things themselves.** A seam names its item; the snapshot holds
 * the item, and a thumbnail of it says more than any verb — "added
 * something" was reported as exactly that, a row that said who moved and
 * nothing about what. The snapshot is read with the log, once, on the same
 * pointer; an item that has since been deleted is still described by the
 * words the op carried (`Major.about`), and simply has no picture.
 */
export interface Peek {
  seams: Major[];
  /** The canvas's items as they are now, for the thumbnails. */
  items: Record<string, Item>;
}

const seen = new Map<string, Peek>();

/**
 * The peek for one canvas, read the first time `want` turns true and
 * remembered after — `null` until there is an answer.
 */
export function useCardPeek(canvasId: string | null, want: boolean): Peek | null {
  const [peek, setPeek] = useState<Peek | null>(canvasId ? (seen.get(canvasId) ?? null) : null);

  useEffect(() => {
    if (!canvasId || !want) return;
    const cached = seen.get(canvasId);
    if (cached) {
      setPeek(cached);
      return;
    }
    let live = true;
    (async () => {
      try {
        const [entries, snapshot] = await Promise.all([
          getOplog(canvasId) as Promise<LogEntry[]>,
          // A snapshot that will not open still leaves the words: the log
          // alone can say what happened, just not show it.
          getSnapshot(canvasId).catch(() => null),
        ]);
        /* Newest first, because a peek is read downward and the thing somebody
           wants is at the top. The track reads oldest-first for the opposite
           reason: it is a timeline. */
        const found: Peek = {
          seams: majors(entries).slice(-5).reverse(),
          items: snapshot?.canvas.items ?? {},
        };
        seen.set(canvasId, found);
        if (live) setPeek(found);
      } catch {
        // A canvas whose log will not open simply has no peek. The card still
        // says what it last did, which is where the useful half already was.
      }
    })();
    return () => {
      live = false;
    };
  }, [canvasId, want]);

  return peek;
}
