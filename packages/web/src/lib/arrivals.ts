import type { ActorJoins, ActorKinds, PresenceSession } from "@isocan/core";
import { rollDue, sameActor } from "@isocan/core";

/**
 * **Who just showed up, read from presence the page already has** — the
 * toast by the presence pile (Dion, 24 Sep 2026: a Chat line is kept
 * history and wastes space; a note that fades is what "Scout is here" wants
 * to be).
 *
 * No op and no write: the facts are the ones the pile already draws — the
 * agents a live rc answers for, and agent sessions on this canvas — and this
 * only says when that set GROWS. It is pure, so the rules a component cannot
 * be tested for are tested here:
 *
 * - **Opening a canvas is quiet.** Whoever is already here when you arrive
 *   did not just join; the first reads of a canvas (until its rc poll has
 *   answered, and a few seconds more for sessions and kinds to land) only
 *   fill the memory.
 * - **A first sighting is "joined"; a return after more than five minutes
 *   is "back"; anything quicker is nothing.** The same window as the rc's
 *   Chat roll call (`rollDue`, `ROLL_AWAY_MS`), so the two can never
 *   disagree about what "away" means. A flapping connection, which drops
 *   an agent out of the rc poll for one read, says nothing.
 * - **Leaving is not said.** From a browser, a deliberate stop and a dropped
 *   poll look the same until minutes have passed, and a "left" that arrives
 *   minutes late is noise; the face leaving the pile already says it.
 *
 * Who counts — agents only, never you — is the caller's to decide; this is
 * handed ids.
 */

/** How long after a canvas opens (and after its first rc answer) presence is
 * still being learned, not watched. Sessions, the rc poll and the actor
 * kinds arrive separately, and each landing would otherwise read as a join. */
export const ARRIVAL_SETTLE_MS = 3_000;

/** What one tab remembers about one canvas's arrivals. */
export interface ArrivalMemory {
  canvasId: string | null;
  /** When presence was first readable here (ms); null until it is. */
  since: number | null;
  present: ReadonlySet<string>;
  /** When each id was last known to be here (ms). */
  seen: ReadonlyMap<string, number>;
}

/** Say "joined" or "is back" for these ids, in the order they appeared. */
export interface Arrival {
  id: string;
  kind: "joined" | "back";
}

/** Nothing remembered: what a tab starts with. */
export const NO_ARRIVALS: ArrivalMemory = { canvasId: null, since: null, present: new Set(), seen: new Map() };

/**
 * One read of presence: the new memory, and who arrived since the last read.
 * `ready` is whether presence is known at all yet (the canvas has loaded and
 * the rc poll has answered once); until it is, nothing is remembered.
 */
export function arrivalsFor(
  memory: ArrivalMemory,
  canvasId: string,
  present: ReadonlySet<string>,
  ready: boolean,
  now: number,
): { memory: ArrivalMemory; arrived: Arrival[] } {
  if (memory.canvasId !== canvasId) memory = { ...NO_ARRIVALS, canvasId };
  if (!ready) return { memory, arrived: [] };
  const since = memory.since ?? now;
  const learning = now - since < ARRIVAL_SETTLE_MS;
  const seen = new Map(memory.seen);
  const arrived: Arrival[] = [];
  for (const id of present) {
    if (learning || memory.present.has(id)) continue;
    // Seen before in this tab counts as having been said to be here then.
    const at = seen.get(id);
    const due = rollDue({ last: at === undefined ? null : { kind: "here", at }, seen: at, now });
    if (due) arrived.push({ id, kind: due === "here" ? "joined" : "back" });
  }
  // Here until now: both who is here, and who just went — the gap a return
  // is measured by starts when they left, not when they were last looked at.
  for (const id of present) seen.set(id, now);
  for (const id of memory.present) if (!present.has(id)) seen.set(id, now);
  return { memory: { canvasId, since, present: new Set(present), seen }, arrived };
}

/**
 * **Who counts as an agent here now**: every agent a live rc answers for
 * (the pile's "standing by"), and every agent with a session on this canvas —
 * one that names a harness, is known to be an agent, or is enrolled here.
 * Never you, under any of your names: your own arrival is not news to you.
 * People are left out on purpose; a colleague opening the canvas is what the
 * pile's faces already say, and a toast per tab-open would be the noise the
 * Chat line was.
 */
export function agentsPresent(
  answerable: ReadonlySet<string>,
  sessions: readonly { actor: { id: string }; kind: PresenceSession["kind"]; harness?: string | null | undefined }[],
  enrolled: Readonly<Record<string, unknown>> | undefined,
  kinds: ActorKinds,
  selfId: string,
  joined?: ActorJoins,
): Set<string> {
  const ids = new Set(answerable);
  for (const s of sessions) {
    const id = s.actor.id;
    if (s.kind !== "rc" && (s.harness || kinds[id] === "agent" || enrolled?.[id])) ids.add(id);
  }
  for (const id of ids) if (sameActor(joined, id, selfId)) ids.delete(id);
  return ids;
}
