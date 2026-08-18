import type { ActorColors } from "@isocan/core";
import { actorColor as derive, IDENTITY_COLORS } from "@isocan/core";
import { fetchActorColors } from "./api.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * Unified actor identity colors: one color per actor, used for cursors,
 * remote-selection outlines, comment-pin avatars, the facepile, and the Pen's
 * default ink.
 *
 * The palette and the derivation live in core, so the CLI and the web app can
 * never disagree about what color someone is. What lives HERE is the lookup
 * into the live registry: a color somebody chose (`actor.setColor`) arrives
 * with the snapshot and every presence roster, and overrides the color their
 * id implies.
 */
export { IDENTITY_COLORS };

/** The color an actor wears right now. Imperative — for a stroke's ink or a
 * canvas paint, where a hook cannot go. */
export function actorColor(actorId: string): string {
  return derive(actorId, useCanvasStore.getState().actorColors);
}

/** The same answer, as a subscription: repaints when somebody picks a color. */
export function useActorColor(actorId: string): string {
  return useCanvasStore((s) => derive(actorId, s.actorColors));
}

/**
 * The whole map, for a component that paints MANY actors (a facepile, a
 * thread, a cursor layer). One subscription and a pure lookup per row —
 * a hook cannot go inside a `.map()`, and this is the shape that works there.
 */
export function useActorColors(): ActorColors {
  return useCanvasStore((s) => s.actorColors);
}

/** Pure lookup against a map you already hold. */
export function actorColorIn(colors: ActorColors, actorId: string): string {
  return derive(actorId, colors);
}

/** Seed the colors before any canvas is open — the projects page paints faces
 * too, and the first paint should not be a color somebody replaced. */
export async function loadActorColors(): Promise<void> {
  try {
    useCanvasStore.setState({ actorColors: await fetchActorColors() });
  } catch {
    // No daemon yet: derived colors are a perfectly good answer.
  }
}
