import { useEffect, useState } from "react";

import { fetchRcAnswering } from "./api.ts";

/**
 * **Who a live rc answers for on this canvas** — core's `roster()` fourth
 * argument, which the app did not pass for as long as this hook did not exist.
 *
 * The cost of not passing it was invisible and specific: `roster()` says
 * `answerable` when an rc holds a connection claiming an actor and `enrolled`
 * when the record stands but nothing is listening. Omit the set and every
 * standing agent reads `enrolled` — so the app told people "nobody is
 * listening right now" while an agent sat ready to answer, and `isocan who`
 * on the same canvas said otherwise. `AgentRow` had the `answerable` branch
 * written and reachable by nothing.
 *
 * One poll shared by every component that asks, because four rosters on one
 * screen is one question, not four. Connection-bound facts cannot be cached
 * across canvases, so the entry is dropped when the last reader leaves.
 */
const ANSWERING_EVERY_MS = 10_000;

interface Watch {
  ids: ReadonlySet<string>;
  readers: number;
  timer: ReturnType<typeof setInterval> | null;
  listeners: Set<(ids: ReadonlySet<string>) => void>;
}

const watches = new Map<string, Watch>();

const EMPTY: ReadonlySet<string> = new Set();

export function useAnswerable(canvasId: string | null): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(
    () => (canvasId ? (watches.get(canvasId)?.ids ?? EMPTY) : EMPTY),
  );

  useEffect(() => {
    if (!canvasId) {
      setIds(EMPTY);
      return;
    }
    let watch = watches.get(canvasId);
    if (!watch) {
      watch = { ids: EMPTY, readers: 0, timer: null, listeners: new Set() };
      watches.set(canvasId, watch);
    }
    const here = watch;
    here.readers += 1;
    here.listeners.add(setIds);
    setIds(here.ids);

    const read = () => {
      fetchRcAnswering(canvasId)
        .then((r) => {
          here.ids = new Set(r.actorIds);
          for (const listener of here.listeners) listener(here.ids);
        })
        .catch(() => {
          /* A daemon that will not answer this leaves every standing row
             reading `enrolled`, which is the honest fallback: not knowing
             whether anybody is listening is not knowing. */
        });
    };
    if (here.timer === null) {
      read();
      here.timer = setInterval(read, ANSWERING_EVERY_MS);
    }

    return () => {
      here.listeners.delete(setIds);
      here.readers -= 1;
      if (here.readers > 0) return;
      if (here.timer !== null) clearInterval(here.timer);
      // Dropped rather than kept: this is a fact about a connection that is
      // open right now, and a stale answer to "is anybody listening" is the
      // one answer worse than none.
      watches.delete(canvasId);
    };
  }, [canvasId]);

  return ids;
}
