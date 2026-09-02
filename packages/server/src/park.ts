import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { writeFileAtomic } from "./fsutil.ts";

/**
 * **The park's cursor, out of the parked process** (on-demand phase 1).
 *
 * `isocan wait` used to keep its cursor in a `let` inside the blocked
 * process: kill the process and the cursor died with it, so the next park
 * started from *now* and silently missed everything in the gap — `--since`
 * existed as the manual repair. This store is the fix: one durable row per
 * actor per canvas, held by the daemon the park polls.
 *
 * **Custody is deliberately daemon-local** (phase 1 door, decided
 * 2026-08-30). For a locally-homed canvas this daemon IS the home; for a
 * remote one it is the replica the park actually talks to — and the seqs in
 * a row are the home's seqs either way, because a replica writes them
 * verbatim (`home-link.ts`). The row is never replicated: it is reachable
 * exactly when a park can poll (the CLI's one address is 127.0.0.1, link up
 * or down), and a replacement `rc` is same-machine anyway — `cwd` and
 * harness are machine facts. Moving custody to the true home later is a
 * data move, not a semantic change.
 *
 * **One reader per row, newest adopts** (the second door). Every claim
 * mints a fresh `parkId` lease; a delivery or advance carrying a stale one
 * is refused, so a displaced park stands down at the moment it would have
 * double-delivered — never after.
 *
 * **At-least-once, never twice as new** (the third door). The row is three
 * watermarks, `cursor ≤ rehanded ≤ delivered`:
 *
 * - `cursor` — settled: handled by a turn, or noise that matched nobody.
 * - `delivered` — handed to a park at least once.
 * - `rehanded` — handed at least twice.
 *
 * A wake records `delivered` without touching `cursor`; the cursor advances
 * only when a later claim finds evidence the turn completed. The evidence,
 * in order: the actor authored an op after the delivery (the reply is the
 * proof — machine-checked, not agent-trusted), or the actor came back to
 * park after the batch was already re-handed once (a full turn with the
 * batch in hand, marked, is a turn that saw it). Absent both, the batch is
 * handed again with `redeliverUpTo` set so the park presents it marked
 * redelivered, never as new. Journey 3's acceptance is both halves at once:
 * nothing in a gap is missed, and the same comment is never new twice.
 *
 * The file lives beside the daemon's other machine-local facts
 * (`homes.json`, `daemon.json`) — it is not canvas state and never goes
 * through the `Store` seam, which is what keeps a hosted home's backing
 * untouched by a feature only local parks use.
 */

interface ParkRow {
  cursor: number;
  delivered: number;
  rehanded: number;
  parkId: string;
}

interface ParkClaim {
  parkId: string;
  cursor: number;
  redeliverUpTo: number | null;
}

export const parkCursorsFile = (home: string) => path.join(home, "park-cursors.json");

export class ParkCursors {
  private rows: Record<string, ParkRow> | null = null;

  constructor(private readonly home: string) {}

  private key(canvasId: string, actorId: string): string {
    return `${canvasId} ${actorId}`;
  }

  private async load(): Promise<Record<string, ParkRow>> {
    if (this.rows) return this.rows;
    try {
      const raw = await fs.readFile(parkCursorsFile(this.home), "utf8");
      this.rows = JSON.parse(raw) as Record<string, ParkRow>;
    } catch {
      // Missing or torn: torn cannot happen (writes are atomic), missing is
      // every home that has never parked. Either way, start empty — a lost
      // row degrades to today's behavior, never to a wrong delivery.
      this.rows = {};
    }
    return this.rows;
  }

  private async save(): Promise<void> {
    await writeFileAtomic(
      parkCursorsFile(this.home),
      `${JSON.stringify(this.rows ?? {}, null, 2)}\n`,
    );
  }

  /**
   * Open (and adopt) the row. `seed` supplies "now" for a first-ever park;
   * `actorSpoke` answers whether the actor authored anything after the given
   * seq — the completion evidence for an outstanding delivery.
   */
  async claim(
    canvasId: string,
    actorId: string,
    opts: {
      since?: number | undefined;
      /** Floor for a row being CREATED — an enrolled agent's standing began
       * at its enrolment op, not at its first claim (journey 3). Ignored
       * when the row exists: it is a birth fact, never a rewind. */
      seedAt?: number | undefined;
      seed: () => Promise<number>;
      actorSpoke: (afterSeq: number) => Promise<boolean>;
    },
  ): Promise<ParkClaim> {
    const rows = await this.load();
    const key = this.key(canvasId, actorId);
    const parkId = `park_${randomBytes(8).toString("hex")}`;
    let row = rows[key];

    if (opts.since !== undefined || !row) {
      const at = opts.since ?? opts.seedAt ?? (await opts.seed());
      row = { cursor: at, delivered: at, rehanded: at, parkId };
      rows[key] = row;
      await this.save();
      return { parkId, cursor: row.cursor, redeliverUpTo: null };
    }

    row.parkId = parkId; // newest adopts — the displaced reader learns at its next write
    let redeliverUpTo: number | null = null;
    if (row.delivered > row.cursor) {
      if (await opts.actorSpoke(row.delivered)) {
        // The turn left its trace in the log: the delivery completed.
        row.cursor = row.delivered;
        row.rehanded = row.delivered;
      } else {
        // No trace. What was already handed twice is settled — the actor
        // came back after a marked redelivery, which is the door's bound on
        // how many times one entry can be handed. The rest goes out again,
        // marked.
        row.cursor = row.rehanded;
        redeliverUpTo = row.delivered > row.cursor ? row.delivered : null;
      }
    }
    await this.save();
    return { parkId, cursor: row.cursor, redeliverUpTo };
  }

  /** A wake handed entries out, up to `tip`. Records the high-water; the
   * cursor stays put until a claim finds completion. False = lease lost. */
  async delivered(canvasId: string, actorId: string, parkId: string, tip: number): Promise<boolean> {
    const rows = await this.load();
    const row = rows[this.key(canvasId, actorId)];
    if (!row || row.parkId !== parkId) return false;
    row.rehanded = row.delivered;
    row.delivered = Math.max(row.delivered, tip);
    await this.save();
    return true;
  }

  /** A lap matched nothing: settle up to `to` without a turn. False = lease
   * lost — the one other moment a displaced park finds out. */
  async advance(canvasId: string, actorId: string, parkId: string, to: number): Promise<boolean> {
    const rows = await this.load();
    const row = rows[this.key(canvasId, actorId)];
    if (!row || row.parkId !== parkId) return false;
    row.cursor = Math.max(row.cursor, to);
    row.rehanded = Math.max(row.rehanded, row.cursor);
    row.delivered = Math.max(row.delivered, row.cursor);
    await this.save();
    return true;
  }
}
