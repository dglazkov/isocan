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
let inFlight: Promise<ActorMarks> | null = null;
const listeners = new Set<(marks: ActorMarks) => void>();

function load(): Promise<ActorMarks> {
  inFlight ??= fetchActorMarks()
    .then((marks) => {
      cached = marks;
      for (const listener of listeners) listener(marks);
      return marks;
    })
    .catch(() => {
      // A home that will not answer leaves everybody on their initials, which
      // is what they had before and reads as nothing being wrong.
      cached = {};
      return {};
    });
  return inFlight;
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
    void load().then((m) => setMarks(m));
    return () => {
      listeners.delete(setMarks);
    };
  }, []);
  return marks;
}
