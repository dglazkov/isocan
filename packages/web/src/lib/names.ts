import type { Actor, ActorNames } from "@isocan/core";
import { actorNameIn as lookup } from "@isocan/core";
import { useEffect, useMemo } from "react";
import { fetchActorNames } from "./api.ts";
import { rememberName } from "./identity.ts";
import { useCanvasStore } from "./../stores/canvasStore.ts";

/**
 * What to call somebody, now.
 *
 * Every comment, every version, every op carries the Actor who made it — name
 * included, frozen at the moment it was written. That is right for a log and
 * wrong for a face: rename "Dion 2" to "Di" and the canvas still has a
 * hundred places saying Dion 2, none of which is anybody.
 *
 * So the stamped name is a fallback, not the answer. The answer is the actor
 * registry, which arrives with the snapshot and every presence roster — the
 * same channel and the same argument as identity colors (lib/colors.ts).
 * History keeps what it recorded; nobody is shown it.
 */

/** The whole map, for a component naming MANY actors (a thread, a facepile).
 * One subscription and a pure lookup per row. */
export function useActorNames(): ActorNames {
  return useCanvasStore((s) => s.actorNames);
}

/** Pure lookup against a map you already hold. */
export function actorNameIn(names: ActorNames, actor: { id: string; name: string }): string {
  return lookup(names, actor);
}

/**
 * What to call a SESSION — the same question one layer out.
 *
 * `PresenceSession.label` is a display override and it is usually absent: a
 * session only has one when somebody passed `--label`. Interpolating it
 * straight into a string wrote the literal word "null" over an item ("null is
 * working"), for every agent that ever started a session without one. So the
 * rule lives here, in one function that can be tested, rather than being
 * retyped at each place that needs a name — and it falls THROUGH the label to
 * the registry, so a rename reaches the chip too.
 *
 * A blank label is treated as no label, for the same reason `actorNameIn`
 * treats a blank registry name as no name: an empty chip names nobody.
 */
export function sessionName(
  names: ActorNames,
  session: { label: string | null; actor: { id: string; name: string } },
): string {
  return session.label && session.label.trim() ? session.label : lookup(names, session.actor);
}

/**
 * **Who "you" are called, everywhere — one answer.**
 *
 * The header chip showed the actor this browser stored at sign-in while the
 * rename field under it read the registry (424fe95a4), so one menu said
 * "Admiral One" on its button and "Dion Almaer" in its field (14 Oct 2026).
 * App reconciles once, here, and hands the routes the answer: the chip, the
 * menu, your own face in the pile and every other surface that says "you"
 * read the same actor because they are handed the same actor.
 *
 * The registry wins; the stored copy is refreshed (`rememberName`) and the
 * caller told (`refreshed`), so the disagreement is settled rather than
 * re-derived on every render. A registry that has not arrived, or does not
 * know this id, leaves the stored name standing — it is the only answer there
 * is yet.
 */
export function useSelf(actor: Actor | null, refreshed?: (actor: Actor) => void): Actor | null {
  const names = useActorNames();
  const name = actor ? actorNameIn(names, actor) : null;
  const self = useMemo(
    () => (actor && name !== null && name !== actor.name ? { id: actor.id, name } : actor),
    [actor, name],
  );
  useEffect(() => {
    if (!actor || !self || self === actor) return;
    rememberName(self.id, self.name);
    refreshed?.(self);
  }, [actor, self, refreshed]);
  return self;
}

/**
 * **A claim's answer is the registry's newest word about you.** Entering,
 * renaming and switching all come back from the home's own `actor.claim`
 * envelope — fresher than whatever roster this tab last heard. Written into
 * the map so `useSelf` does not put the old name back over a rename that
 * just landed (the canvas list has no roster stream to correct it).
 */
export function noteClaimed(actor: Actor): void {
  const names = useCanvasStore.getState().actorNames;
  if (names[actor.id] === actor.name) return;
  useCanvasStore.setState({ actorNames: { ...names, [actor.id]: actor.name } });
}

/** Imperative — for a title string or a canvas paint, where a hook cannot go. */
export function actorName(actor: { id: string; name: string }): string {
  return lookup(useCanvasStore.getState().actorNames, actor);
}

/** Seed the names before any canvas is open: the canvases page says who
 * touched a canvas last, and the first paint should not be a name its owner
 * has already replaced. */
export async function loadActorNames(): Promise<void> {
  try {
    useCanvasStore.setState({ actorNames: await fetchActorNames() });
  } catch {
    // No daemon yet: the stamped names are a perfectly good answer.
  }
}
