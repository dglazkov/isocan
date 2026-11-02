import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RcAgentRow } from "@isocan/rc";

/**
 * **The enrolment record's rc half, as this package reads and writes it**
 * (agents-on-demand phase 2).
 *
 * The record splits along custody: the home half — which agents answer on a
 * canvas, and their rules — lives in canvas state (`agent.enroll` /
 * `agent.withdraw` ops), because everything that must see it reads canvas
 * state. This half is what running the agent needs — harness, working
 * directory, session handle — and it is a machine fact: only this machine can
 * honor a `cwd`, so it lives in a machine-local file and never replicates.
 *
 * `packages/cli/src/rc.ts` is where the format is written down and the
 * authority on it; `~/.isocan/rc-agents.json` is the file both readers share.
 * This package keeps its own reader and writer rather than importing the
 * CLI's, for the same reason the file is machine-local at all: it is a file
 * in the home, and a thing that can read the home does not need another
 * package to hand it the logic. Nothing here reads the CLI's source, and the
 * CLI does not need to know this package exists.
 *
 * A second implementation is deliberate, and the price is stated rather than
 * hidden: the lock discipline below (`rc-agents.json.lock`, a symlink holding
 * the pid, atomic replace) has to keep agreeing with `rc.ts`'s copy, or two
 * writers clobber each other's rows. The one place a voice agent writes —
 * standing itself up at the microphone, or renaming with the actor — is rare
 * and human-paced, so the window is small; the lock is what makes it zero.
 */

/** The file the whole machine's rows live in, one per (canvas, actor). Named
 * rather than inlined because the lock and the temporary file are its
 * neighbours and have to agree with it. */
export const rcAgentsFile = (home: string) => path.join(home, "rc-agents.json");

/** Every row this machine keeps: which agents answer on which canvas, how to
 * start each one, and where it runs. An absent or unreadable file is "no
 * rows" rather than an error — a machine that has never enrolled an agent is
 * a normal machine, and a reader is never the wrong party here. */
export async function readRcAgents(home: string): Promise<RcAgentRow[]> {
  try {
    return JSON.parse(await fs.readFile(rcAgentsFile(home), "utf8")) as RcAgentRow[];
  } catch {
    return [];
  }
}

/** Serialize every local read/modify/write across CLI, this harness and
 * parked rc processes. Atomic replacement also keeps readers from observing a
 * half-written JSON file. A crashed writer leaves a visible lock rather than
 * silently risking lost rows. */
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

/** The row for (canvasId, actorId) replaced in place, or appended when it is
 * new — the one write shape every verb here has, so the key a row is filed
 * under is stated once. */
function replaceRow(rows: RcAgentRow[], row: RcAgentRow): void {
  const index = rows.findIndex((r) => r.canvasId === row.canvasId && r.actorId === row.actorId);
  if (index < 0) rows.push(row);
  else rows[index] = row;
}

/** Add or update the row for (canvasId, actorId) — re-enrolment updates.
 * `preparationId` is another writer's compare-and-restore token and never
 * survives a write from here. */
export async function upsertRcAgent(home: string, row: RcAgentRow): Promise<void> {
  await updateRcAgents(home, (rows) => {
    const next = { ...row };
    delete next.preparationId;
    replaceRow(rows, next);
  });
}
