import { useEffect, useState } from "react";
import type { LogEntry, Major } from "@isocan/core";
import { majors } from "@isocan/core";

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
 */
const seen = new Map<string, Major[]>();

export function useCardPeek(canvasId: string | null, want: boolean): Major[] | null {
  const [peek, setPeek] = useState<Major[] | null>(
    canvasId ? (seen.get(canvasId) ?? null) : null,
  );

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
        const entries: LogEntry[] = await fetch(
          `/api/projects/${encodeURIComponent(canvasId)}/oplog?since=0`,
        ).then((r) => (r.ok ? r.json() : []));
        /* Newest first, because a peek is read downward and the thing somebody
           wants is at the top. The track reads oldest-first for the opposite
           reason: it is a timeline. */
        const found = majors(entries).slice(-5).reverse();
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

/** Forget what was read — the log has moved on. */
export function forgetPeeks(): void {
  seen.clear();
}
