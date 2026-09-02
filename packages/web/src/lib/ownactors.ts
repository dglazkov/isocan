import { useEffect, useState } from "react";
import { listBadges } from "./api.ts";

/**
 * **The actors this browser's badge speaks for** — the fact the identity
 * menu's roster needs before it may offer to fold one persona into another
 * (multi-identity phase 5).
 *
 * The roster in `localStorage` is memory, not authority: it remembers which
 * personas this browser has worn, and nothing about whether the home still
 * lets this badge speak as them. `actor.join` is refused unless the
 * presenting badge claims both actors, so the control that sends it is drawn
 * only for a persona the badge claims — asked of the desk, through the same
 * `GET /api/badges` the "Your surfaces" dialog reads, where the row marked
 * `self` lists exactly those actors.
 *
 * Cached for the reason `signin.ts` caches the offer: the menu is mounted and
 * unmounted with every click on a face, and the answer changes only when a
 * claim does. `primeOwnActors` hands a test the answer a render would
 * otherwise wait for.
 */
let known: ReadonlySet<string> | null = null;
let asked: Promise<ReadonlySet<string>> | null = null;

function ownActors(refresh = false): Promise<ReadonlySet<string>> {
  if (refresh || !asked) {
    const request = listBadges().then((res) => {
      const mine = res.badges.find((badge) => badge.self);
      const ids: ReadonlySet<string> = new Set((mine?.actors ?? []).map((actor) => actor.id));
      if (asked === request) known = ids;
      return ids;
    });
    request.catch(() => {
      if (asked === request) asked = null;
    });
    asked = request;
  }
  return asked;
}

/** Forget the answer, so the next reader asks again — after a join, a claim,
 * or a re-badge. */
export function invalidateOwnActors(): void {
  known = null;
  asked = null;
}

/** Answer a render without a round trip — for tests, and for a caller that
 * already holds the badge list. */
export function primeOwnActors(ids: Iterable<string>): void {
  known = new Set(ids);
  asked = Promise.resolve(known);
}

/** The actors this badge claims, kept current. `null` until the desk has
 * answered; a control gated on it renders nothing until then. */
export function useOwnActors(): ReadonlySet<string> | null {
  const [ids, setIds] = useState<ReadonlySet<string> | null>(known);
  useEffect(() => {
    let live = true;
    ownActors()
      .then((got) => live && setIds(got))
      .catch(() => live && setIds(null));
    return () => {
      live = false;
    };
  }, []);
  return ids;
}
