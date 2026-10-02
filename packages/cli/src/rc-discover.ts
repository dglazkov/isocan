import type { ActorBindingRecord, Canvas, EnrolledAgent } from "@isocan/core";
import type { RcAgentRow } from "./rc.ts";

/**
 * **The rc hears invites** (pets phase 1, docs/projects/pets/phases.md).
 *
 * `isocan rc --all` used to decide where to park once, at start, from
 * `~/.isocan/rc-agents.json` — and a row is written only by a room already
 * parked on the canvas, or by `rc add`/`agent add`. An `agent.invite` (`isocan
 * bench join`, the web's Join, `@Name join`) writes no row, so an agent brought
 * to a canvas the rc had never parked on stood there and answered nothing, and
 * a restart did not help. This is the half that looks: which canvases have an
 * agent this machine holds standing on them.
 *
 * Kept out of `main.ts` and free of the daemon client, so the decision is
 * pure over what a pass read and a unit test can hold it.
 */

/**
 * **How often a running `rc --all` looks**: thirty seconds. Scene 1 asks for
 * "within a minute", and a look is one `listCanvases()` (one metadata file per
 * canvas at the home) plus a snapshot only of a canvas whose `updatedAt` moved
 * since the last look — every op stamps it (`reducer.ts`), an invite included —
 * so a quiet home costs one listing per interval and nothing else. The room's
 * own long poll is thirty seconds too; this keeps the two on one scale.
 * `ISOCAN_RC_DISCOVER_MS` overrides it, for tests that cannot sleep a minute.
 */
export const RC_DISCOVER_MS = 30_000;

export function discoverEvery(env: NodeJS.ProcessEnv = process.env): number {
  const asked = Number(env.ISOCAN_RC_DISCOVER_MS);
  return Number.isFinite(asked) && asked > 0 ? asked : RC_DISCOVER_MS;
}

/**
 * **The agents this machine holds**: every actor this badge has claimed under
 * an agent key (`agent:` — the machine keys `agent-key.ts` derives, and the
 * legacy name keys not yet moved), and every actor this machine's rc rows
 * name. The person's own actor and their interactive harness sessions are not
 * agents the rc answers for, so a canvas they merely stand on is not a reason
 * to park there. Whether the badge really holds one is still the room's to
 * find out — its cursor claim is refused `not-your-actor` otherwise, and it
 * says so — so this only decides where it is worth asking.
 */
export function heldAgents(bindings: readonly ActorBindingRecord[], rows: readonly RcAgentRow[], owner: string): Set<string> {
  const held = new Set<string>(rows.map((row) => row.actorId));
  for (const binding of bindings) if (binding.key.startsWith("agent:")) held.add(binding.actor.id);
  held.delete(owner);
  return held;
}

/** Whether a roster names anybody this machine holds. A withdrawn agent is
 * not in the roster at all (`agent.withdraw` deletes the row), so standing
 * is the whole question. */
export function holdsHere(roster: Record<string, EnrolledAgent> | undefined, held: ReadonlySet<string>): boolean {
  return Object.keys(roster ?? {}).some((id) => held.has(id));
}

/** What one look found, per canvas it read: whether an agent this machine
 * holds stands there. A canvas whose stamp had not moved is not in it. */
export type Survey = Map<string, { canvas: Canvas; holds: boolean }>;

/**
 * **One look.** Reads a canvas's roster only when its stamp moved since the
 * last look, or when the held set itself changed (a new agent claimed here is
 * a reason to read everything once more). `memory` is the caller's, kept
 * across looks; a canvas that could not be read is left out of it, so the
 * next look tries again.
 */
export async function survey(
  canvases: readonly Canvas[],
  held: ReadonlySet<string>,
  memory: { stamps: Map<string, string>; held: string },
  rosterOf: (canvasId: string) => Promise<Record<string, EnrolledAgent> | null>,
): Promise<Survey> {
  const heldKey = [...held].sort().join(",");
  if (heldKey !== memory.held) {
    memory.stamps.clear();
    memory.held = heldKey;
  }
  const found: Survey = new Map();
  for (const canvas of canvases) {
    if (memory.stamps.get(canvas.id) === canvas.updatedAt) continue;
    const roster = await rosterOf(canvas.id);
    if (roster === null) continue;
    memory.stamps.set(canvas.id, canvas.updatedAt);
    found.set(canvas.id, { canvas, holds: holdsHere(roster, held) });
  }
  return found;
}

/**
 * **What to do about one look**: open a room where an agent this machine
 * holds stands and none is parked; close one where nobody it holds stands any
 * more — except the bound canvas, which `rc` parks on whoever is enrolled,
 * because "nobody is enrolled yet" there is a promise to pick the next one up.
 */
export function decide(
  found: Survey,
  parked: ReadonlySet<string>,
  bound: string | null,
): { open: Canvas[]; close: string[] } {
  const open: Canvas[] = [];
  const close: string[] = [];
  for (const [id, { canvas, holds }] of found) {
    if (holds && !parked.has(id)) open.push(canvas);
    else if (!holds && parked.has(id) && id !== bound) close.push(id);
  }
  return { open, close };
}
