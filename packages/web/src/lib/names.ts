import type { ActorNames } from "@isocan/core";
import { actorNameIn as lookup } from "@isocan/core";
import { fetchActorNames } from "./api.ts";
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
