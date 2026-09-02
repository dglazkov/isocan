import { useEffect, useState } from "react";
import type { ActorMarks } from "@isocan/core";

import { fetchActorMarks } from "./api.ts";

/**
 * **The mark each actor wears instead of an initial.**
 *
 * Names ride the snapshot and every presence roster, because a name is on
 * every op and has to be corrected everywhere at once. A mark is a
 * preference nobody's history depends on, so it takes a read instead of a
 * place in the protocol — which is the cheaper half of a trade worth naming:
 * **somebody else's new emoji reaches your screen on your next load, not the
 * instant they pick it.** Your own updates immediately, because the picker
 * writes here as well as sending the op.
 *
 * One fetch shared by every component that asks. A canvas draws a face in
 * eight places and none of them should be a request.
 */
let cached: ActorMarks | null = null;
/** The one fetch, kept only so it is never made twice. It resolves
 *  NOTHING on purpose — see `loadActorMarks`. */
let inFlight: Promise<void> | null = null;
const listeners = new Set<(marks: ActorMarks) => void>();

/** Fetch once per tab, then answer from the cache. Named to match
 *  `loadActorColors`, and exported so a test can prove the answer stays
 *  current after a pick. */
export function loadActorMarks(): Promise<ActorMarks> {
  inFlight ??= fetchActorMarks()
    .then((marks) => {
      cached = marks;
      for (const listener of listeners) listener(marks);
    })
    .catch(() => {
      // A home that will not answer leaves everybody on their initials, which
      // is what they had before and reads as nothing being wrong.
      cached = {};
    });
  // Resolve what the cache holds NOW, not what the fetch saw. `inFlight` is
  // memoised for the life of the tab, so it keeps answering with the snapshot
  // from the very first request — and a component mounting after somebody
  // picked an emoji would take that stale answer and overwrite what
  // `rememberMark` had already told everybody. That is the identity menu
  // showing `D` while the facepile two inches above it wears the emoji you
  // just chose: the facepile subscribed before the pick, the menu mounted
  // after it.
  const done = inFlight;
  return done.then(() => cached ?? {});
}

/** Ask again — after `actor.join` (multi-identity phase 5), when the map the
 * home serves has changed for ids this tab did not touch itself. */
export function refreshActorMarks(): Promise<ActorMarks> {
  inFlight = null;
  return loadActorMarks();
}

/** Say locally what the home has been told, so your own face changes at once
 *  rather than on the next reload. */
export function rememberMark(actorId: string, mark: string | null): void {
  const next = { ...(cached ?? {}) };
  if (mark === null) delete next[actorId];
  else next[actorId] = mark;
  cached = next;
  for (const listener of listeners) listener(next);
}

export function useActorMarks(): ActorMarks {
  const [marks, setMarks] = useState<ActorMarks>(cached ?? {});
  useEffect(() => {
    listeners.add(setMarks);
    void loadActorMarks().then((m) => setMarks(m));
    return () => {
      listeners.delete(setMarks);
    };
  }, []);
  return marks;
}
