import { actorNameIn, collectCanvasActors } from "@isocan/core";
import type { CanvasSnapshotResponse, CommentThread, Item, WatchedLogEntry } from "@isocan/core";

/**
 * **Pure helpers the room speaks with** (docs/projects/room/design.md): they
 * lived in `packages/cli/src/main.ts` by accident of history and moved here
 * unchanged, except that `summonsPrompt` takes the canvas title it used to
 * capture. `main.ts` imports them back.
 */

/** World center of an item — where narration points the cursor. */
export function itemCenter(item: Item): { x: number; y: number } {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

/** Where a thread sits in world coordinates, anchored or freestanding. */
export function threadLocus(
  snapshot: CanvasSnapshotResponse,
  thread: CommentThread,
): { x: number; y: number } {
  const anchor = thread.anchorItemId ? snapshot.canvas.items[thread.anchorItemId] : undefined;
  return anchor ? { x: anchor.x + thread.x, y: anchor.y + thread.y } : { x: thread.x, y: thread.y };
}

/**
 * An actor id → the name this canvas would show, for `listenWords`. The
 * registry's current name, not the one stamped on an old op — a gate that
 * says who somebody USED to be is a gate nobody can act on.
 *
 * **The registry is asked FIRST, and that is the fix rather than the
 * tidy-up.** `collectCanvasActors` walks canvas state, so it knows the
 * people who have written something here — which is exactly not the person
 * a fresh gate usually names: enrolling an agent and pointing it at
 * yourself is often the first thing you do on a canvas, and it left `who`
 * printing *listens to usr_nico*. An unreadable gate is the silent gate in
 * different clothes, so the map that knows everyone the home knows is the
 * one that answers.
 */
export function actorNamesOn(snapshot: CanvasSnapshotResponse): Map<string, string> {
  const names = new Map<string, string>(Object.entries(snapshot.names ?? {}));
  for (const actor of collectCanvasActors(snapshot.canvas)) {
    if (!names.has(actor.id)) names.set(actor.id, actorNameIn(snapshot.names, actor));
  }
  return names;
}

export function nameResolver(snapshot: CanvasSnapshotResponse): (actorId: string) => string | undefined {
  const names = actorNamesOn(snapshot);
  return (actorId) => names.get(actorId);
}

/**
 * The session key the injected environment presents — and the exact key the
 * enrol verb claims, which is the whole trick. Moved here from
 * `packages/cli/src/acp.ts`, which re-exports it, because the room claims
 * with it at every summons.
 *
 * **Scoped to the NAME, not to a canvas** (standing agents, phase 1). It was
 * `agent:<canvasId>:<name>`, which made "Percy on a second canvas" a second
 * session key on the same badge — refused by the desk as a name already worn,
 * the same gate #89 hit. One machine answers for one Percy: the same key on
 * every canvas resumes the same actor, so enrolling the name elsewhere hands
 * the one Percy back, history intact, with no `as` and no vouch.
 */
export function enrolmentKey(agentName: string): string {
  return `agent:${agentName}`;
}

/** The fixed brief around the wait-shaped payload (phase 4's door):
 * identical for fresh and loaded sessions — delivery differs, content
 * never does — with orientation and the guide pointer carrying the
 * cold-arrival weight instead of 15k inlined tokens. */
export const summonsPrompt = (
  canvasTitle: string,
  agentName: string,
  payload: { reason: string; entries: WatchedLogEntry[] },
): string =>
  `You are ${agentName}, an agent enrolled on the isocan canvas "${canvasTitle}". ` +
  `This is a summons: activity addressed to you arrived while nothing was running for you. ` +
  `Work from this directory through the \`isocan\` CLI — \`isocan --agent-help\` is the full ` +
  `protocol if you need orientation, and \`isocan comment reply <threadId> "…"\` answers a comment. ` +
  `Address what the payload below carries, reply on its thread, and then simply finish your ` +
  `turn: do NOT run \`isocan wait\` — your session rests when you stop, and new activity ` +
  `summons you again.\n\n` +
  `The payload (the same shape \`isocan wait --json\` returns):\n` +
  JSON.stringify(payload, null, 2);
