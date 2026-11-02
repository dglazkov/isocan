import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@isocan/api";
import type { Actor } from "@isocan/core";
import type { RcAgentRow, RoomRows, RoomState } from "@isocan/rc";

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

/** The row type lives in the room module (docs/projects/room/design.md,
 * `rows`); this file keeps the file-backed implementation of its verbs. */
export type { RcAgentRow } from "@isocan/rc";

export const rcAgentsFile = (home: string) => path.join(home, "rc-agents.json");

export async function readRcAgents(home: string): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}

/** Serialize every local read/modify/write across CLI and parked rc processes.
 * Atomic replacement also keeps readers from observing a half-written JSON file.
 * A crashed writer leaves a visible lock rather than silently risking lost rows. */
async function updateRcAgents<T>(home: string, change: (rows: RcAgentRow[]) => T): Promise<T> {
  await fs.mkdir(home, { recursive: true });
  const lock = `${rcAgentsFile(home)}.lock`;
  const until = Date.now() + 5000;
  for (;;) {
    try { await fs.symlink(String(process.pid), lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() >= until) throw new Error(`rc agent records are busy: ${lock}. If its writer has exited, remove that lock and retry.`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  const temporary = `${rcAgentsFile(home)}.${randomUUID()}.tmp`;
  try {
    const rows = await readRcAgents(home);
    const result = change(rows);
    await fs.writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`);
    await fs.rename(temporary, rcAgentsFile(home));
    return result;
  } finally {
    await fs.rm(temporary, { force: true });
    await fs.unlink(lock);
  }
}

function replaceRow(rows: RcAgentRow[], row: RcAgentRow): void {
  const index = rows.findIndex((r) => r.canvasId === row.canvasId && r.actorId === row.actorId);
  if (index < 0) rows.push(row);
  else rows[index] = row;
}

/** Add or update the row for (canvasId, actorId) — re-enrolment updates. */
export async function upsertRcAgent(home: string, row: RcAgentRow): Promise<void> {
  await updateRcAgents(home, (rows) => {
    const next = { ...row };
    delete next.preparationId;
    replaceRow(rows, next);
  });
}

/** Prepare the machine half before publishing enrolment can wake the rc.
 * A definitive daemon refusal restores the previous row only while our token still
 * owns it. All later local writes clear that token, under the same lock, so
 * rollback cannot replace another command's configuration or session. Lost
 * receipts retain the prepared row: the actor may already have been enrolled. */
export async function withPreparedRcAgent<T>(home: string, row: RcAgentRow, publish: () => Promise<T>): Promise<T> {
  const preparationId = randomUUID();
  const previous = await updateRcAgents(home, (rows) => {
    const old = rows.find((r) => r.canvasId === row.canvasId && r.actorId === row.actorId);
    replaceRow(rows, { ...row, preparationId });
    return old;
  });
  let refused = false;
  try {
    const result = await publish();
    return result;
  } catch (error) {
    // A missing receipt or server failure can follow acceptance. Retain the
    // prepared configuration unless the daemon definitively refused it.
    // A 409 may be the local replica failing to append an already accepted
    // remote op (writer fencing); treat every conflict as uncertain here.
    refused = error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 409;
    throw error;
  } finally {
    await updateRcAgents(home, (rows) => {
      const index = rows.findIndex((r) => r.canvasId === row.canvasId && r.actorId === row.actorId && r.preparationId === preparationId);
      if (index < 0) return;
      if (!refused) delete rows[index]!.preparationId;
      else if (previous) rows[index] = previous;
      else rows.splice(index, 1);
    });
  }
}

/** The dispatch guards live in the room module now; re-exported so every
 * import of them from here keeps working (`guards.test.ts` among them). */
export { gateTurn, type GuardLimits, type GuardState, type GuardVerdict } from "@isocan/rc";

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
  return updateRcAgents(home, (rows) => {
    if (rows.some((r) => r.canvasId === row.canvasId && r.actorId === row.actorId)) return false;
    rows.push(row);
    return true;
  });
}

/** The resume handle, once a session exists (phase 3). Best-effort by the
 * spike's finding: a stored id that fails to load twice is replaced by a
 * fresh session, and this row is what records the replacement.
 * Returns whether the row was there to write — a row withdrawn mid-summons
 * is not. */
export async function setRcSessionId(
  home: string,
  canvasId: string,
  actorId: string,
  sessionId: string,
): Promise<boolean> {
  return updateRcAgents(home, (rows) => {
    const row = rows.find((r) => r.canvasId === canvasId && r.actorId === actorId);
    if (!row) return false;
    delete row.preparationId;
    row.sessionId = sessionId;
    return true;
  });
}

/** Withdrawal takes the rc half with it; the oplog keeps the history. */
export async function removeRcAgent(
  home: string,
  canvasId: string,
  actorId: string,
): Promise<void> {
  await updateRcAgents(home, (rows) => {
    const index = rows.findIndex((r) => r.canvasId === canvasId && r.actorId === actorId);
    if (index >= 0) rows.splice(index, 1);
  });
}

/** The rows as the room reads them (docs/projects/room/design.md, `rows`):
 * this file's verbs over `~/.isocan/rc-agents.json`, bound to one home. */
export function fileRcRows(home: string): RoomRows {
  return {
    list: () => readRcAgents(home),
    adopt: (row) => adoptRcAgent(home, row),
    remove: (canvasId, actorId) => removeRcAgent(home, canvasId, actorId),
    setSessionId: (canvasId, actorId, sessionId) => setRcSessionId(home, canvasId, actorId, sessionId),
  };
}

/**
 * **The roll call's memory across a restart** (`roll.ts` in core). The rooms
 * share a `Map` as their state, so nothing survives a restart — right for the
 * guards, wrong for "when was Percy last held here", which is exactly what a
 * restart asks. So the `seen:` keys, and only those, are also kept in
 * `~/.isocan/rc-seen.json`: an rc stopped and started again inside five
 * minutes reads that it was just here and says nothing. Losing the file costs
 * at most one "is back" per canvas, because the Chat's own last line is the
 * other half of the rule.
 */
export function rollMemory(home: string, inner: RoomState): RoomState {
  const file = path.join(home, "rc-seen.json");
  const seen = (key: string) => key.startsWith("seen:");
  let disk: Promise<Record<string, number>> | null = null;
  const load = () =>
    (disk ??= fs
      .readFile(file, "utf8")
      .then((text) => JSON.parse(text) as Record<string, number>)
      .catch(() => ({}) as Record<string, number>));
  // One write at a time from this process, each a whole replacement.
  let writing: Promise<void> = Promise.resolve();
  const save = (all: Record<string, number>) => {
    writing = writing
      .then(async () => {
        await fs.mkdir(home, { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await fs.writeFile(temporary, `${JSON.stringify(all, null, 2)}\n`);
        await fs.rename(temporary, file);
      })
      .catch(() => {});
    return writing;
  };
  return {
    get: async (key) => (seen(key) ? ((await inner.get(key)) ?? (await load())[key]) : inner.get(key)),
    set: async (key, value) => {
      await inner.set(key, value);
      if (!seen(key) || typeof value !== "number") return;
      const all = await load();
      all[key] = value;
      await save(all);
    },
    delete: (key) => inner.delete(key),
  };
}

/**
 * **Who says it in the Chat — nobody, unless asked** (`config.json`'s
 * `rcAnnounce`, and `isocan rc --announce` for one run).
 *
 * On by default for a day (24 Sep 2026), then off: a Chat line is kept
 * history, and "Percy is here" read a week later is noise taking the space a
 * conversation wanted. The web says an arrival now, as a toast by the
 * presence pile that fades (`ArrivalToasts`), derived from presence and
 * written nowhere. The Chat line stays for whoever wants a record of it:
 * `--announce` or `rcAnnounce: true` for every agent and canvas, or a list of
 * agent names/ids and canvas ids for just those.
 */
export function announceRule(
  config: boolean | string[] | undefined,
  flag: boolean,
  canvasId: string,
): ((agent: Actor) => boolean) | undefined {
  if (flag || config === true) return () => true;
  if (!Array.isArray(config)) return undefined;
  const named = new Set(config.map((v) => v.toLowerCase()));
  if (named.has(canvasId.toLowerCase())) return () => true;
  return (agent) => named.has(agent.name.toLowerCase()) || named.has(agent.id.toLowerCase());
}
