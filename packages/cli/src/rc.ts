import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * **The enrolment record's rc half** (agents-on-demand phase 2).
 *
 * The record splits along custody: the home half — which agents answer on a
 * canvas, and their rules — lives in canvas state (`agent.enroll` /
 * `agent.withdraw` ops), because everything that must see it reads canvas
 * state. THIS half is what running the agent needs — harness, working
 * directory, and (from phase 3) the ACP session handle — and it is a
 * machine fact: only this machine can honor a `cwd`, so it lives in a
 * machine-local file and never replicates, the same split `backing.ts`
 * draws for files ("where a file belongs is a canvas fact; whether it is
 * written is a fact about one machine").
 *
 * One file for the whole machine rather than one per rc, because the verbs
 * that write it (`isocan agent add`, `isocan rc add`) run wherever the
 * caller stands, and an rc reads the rows for its own canvas and no others.
 */

export interface RcAgentRow {
  canvasId: string;
  actorId: string;
  /** The name at enrolment, for saying so without a registry round trip.
   * The registry stays the authority on names. */
  name: string;
  /** How to start a session — the enrolling caller's harness, a flag, or
   * null for "not yet said"; phase 3 reads it. */
  harness: string | null;
  /** Where the agent's sessions run. The agent verb takes no --dir: this is
   * always where the enrolling caller already stood. */
  cwd: string;
  /** The ACP resume handle, once phase 3 mints one. Null until then. */
  sessionId: string | null;
}

export const rcAgentsFile = (home: string) => path.join(home, "rc-agents.json");

export async function readRcAgents(home: string): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}

async function writeRcAgents(home: string, rows: RcAgentRow[]): Promise<void> {
  await fs.writeFile(rcAgentsFile(home), `${JSON.stringify(rows, null, 2)}\n`);
}

/** Add or update the row for (canvasId, actorId) — re-enrolment updates. */
export async function upsertRcAgent(home: string, row: RcAgentRow): Promise<void> {
  const rows = await readRcAgents(home);
  const kept = rows.filter((r) => !(r.canvasId === row.canvasId && r.actorId === row.actorId));
  kept.push(row);
  await writeRcAgents(home, kept);
}

/**
 * **The dispatch guards, as arithmetic** (phase 5). This function is the
 * whole decision — the ceiling, the cycle guard, the announce-once rule —
 * pulled out of the rc's loop so it can be tested as what it is: pure
 * bookkeeping over timestamps and a counter. The loop's job is only to
 * gather the inputs and obey the verdict. (The first version lived inline
 * and was "tested" by a four-process cascade that flaked on every loaded
 * CI box — an end-to-end pretending to be a unit test, as the first person
 * to watch it fail put it.)
 *
 * State is mutated in place the way the loop already owned it:
 * - `dispatch`: push `now` to turnTimes, set the chain (person word resets
 *   it), clear any hold.
 * - `hold-cycle`: no timer — only a person's word lifts it (the caller
 *   dispatches again when `hasPersonWord` makes the verdict change).
 * - `hold-ceiling`: `retryAfter` says when the sliding window frees.
 * - `announce` is true exactly once per hold: the refusal is said where
 *   people look, not once per lap.
 */
export interface GuardState {
  /** Turn-start times inside the sliding hour. */
  turnTimes: number[];
  /** Consecutive turns whose batch held no person's word. */
  agentChain: number;
  /** The limit currently holding this agent's batch, if any. */
  held: "ceiling" | "cycle" | null;
}

export interface GuardLimits {
  turnsPerHour: number;
  agentChain: number;
}

export type GuardVerdict =
  | { verdict: "dispatch" }
  | { verdict: "hold-cycle"; announce: boolean }
  | { verdict: "hold-ceiling"; announce: boolean; retryAfter: number; freesAt: number };

export function gateTurn(
  state: GuardState,
  hasPersonWord: boolean,
  limits: GuardLimits,
  now: number,
): GuardVerdict {
  // The cycle guard: A waking B waking A ends here. A person's word —
  // anywhere in the batch — resets the chain and lifts the hold.
  if (!hasPersonWord && state.agentChain >= limits.agentChain) {
    const announce = state.held !== "cycle";
    state.held = "cycle";
    return { verdict: "hold-cycle", announce };
  }
  // The ceiling: turns per agent per hour, a sliding window.
  const hourAgo = now - 3_600_000;
  state.turnTimes = state.turnTimes.filter((t) => t > hourAgo);
  if (state.turnTimes.length >= limits.turnsPerHour) {
    const freesAt = state.turnTimes[0]! + 3_600_000;
    const announce = state.held !== "ceiling";
    state.held = "ceiling";
    return {
      verdict: "hold-ceiling",
      announce,
      freesAt,
      retryAfter: Math.min(freesAt, now + 60_000),
    };
  }
  state.held = null;
  state.turnTimes.push(now);
  state.agentChain = hasPersonWord ? 0 : state.agentChain + 1;
  return { verdict: "dispatch" };
}

/**
 * The rc's reconciliation write (phase 2.5, decided 2026-08-30): an agent
 * added from the web has a home half but no rc half — a browser cannot write
 * this file — so the parked rc supplies WHERE and HOW itself: its own
 * directory, harness unsaid. Writes only when the row is missing (a verb run
 * on this machine already said more than the rc can guess) and returns
 * whether it wrote, so the caller can narrate an adoption and stay quiet
 * about a no-op.
 */
export async function adoptRcAgent(home: string, row: RcAgentRow): Promise<boolean> {
  const rows = await readRcAgents(home);
  if (rows.some((r) => r.canvasId === row.canvasId && r.actorId === row.actorId)) return false;
  rows.push(row);
  await writeRcAgents(home, rows);
  return true;
}

/** The resume handle, once a session exists (phase 3). Best-effort by the
 * spike's finding: a stored id that fails to load twice is replaced by a
 * fresh session, and this row is what records the replacement. */
export async function setRcSessionId(
  home: string,
  canvasId: string,
  actorId: string,
  sessionId: string,
): Promise<void> {
  const rows = await readRcAgents(home);
  const row = rows.find((r) => r.canvasId === canvasId && r.actorId === actorId);
  if (!row) return;
  row.sessionId = sessionId;
  await writeRcAgents(home, rows);
}

/** Withdrawal takes the rc half with it; the oplog keeps the history. */
export async function removeRcAgent(
  home: string,
  canvasId: string,
  actorId: string,
): Promise<void> {
  const rows = await readRcAgents(home);
  await writeRcAgents(
    home,
    rows.filter((r) => !(r.canvasId === canvasId && r.actorId === actorId)),
  );
}
