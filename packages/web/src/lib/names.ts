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

/** The same answer as a subscription, for a component naming one actor. */
export function useActorName(actor: { id: string; name: string }): string {
  return useCanvasStore((s) => lookup(s.actorNames, actor));
}

/** Imperative — for a title string or a canvas paint, where a hook cannot go. */
export function actorName(actor: { id: string; name: string }): string {
  return lookup(useCanvasStore.getState().actorNames, actor);
}

/** Seed the names before any canvas is open: the projects page says who
 * touched a canvas last, and the first paint should not be a name its owner
 * has already replaced. */
export async function loadActorNames(): Promise<void> {
  try {
    useCanvasStore.setState({ actorNames: await fetchActorNames() });
  } catch {
    // No daemon yet: the stamped names are a perfectly good answer.
  }
}
