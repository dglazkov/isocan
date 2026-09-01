/**
 * `~/.isocan/homes.json`, read and written — **where the daemon learns which
 * home each canvas belongs to** (phase 10.3).
 *
 * The whole phase turns on one sentence: *the home is a property of the
 * CANVAS, not of the daemon.* The marker has asserted that since Scene 0 (it
 * carries an address) and the configuration model contradicted it from phase 6
 * to here (one `home` key, one connection, whole-daemon demotion). This file
 * is where the contradiction is resolved, and it holds the only thing that
 * could resolve it: a per-canvas record, on the machine that has to route.
 *
 * **Three rules, each load-bearing.**
 *
 * 1. **A row is written at BINDING, never inferred.** Birth (a forwarded
 *    `project.create`), a join (`POST /api/home/join`), a redeemed pass, and a
 *    sweep meeting a canvas with no row all know which link they went through,
 *    and each writes the row. Nothing here guesses from a listing.
 * 2. **Absent means "this daemon is its home."** Not "consult the default" —
 *    and that is phase 14's safety property in one line: a shipped default
 *    address is consulted only when a canvas is MINTED, so flipping it
 *    re-points nothing that already exists.
 * 3. **The record and the marker must agree, or the command is refused.**
 *    Neither silently wins. (The refusal itself is the CLI's, where the
 *    marker is read.)
 *
 * **Why not a field on the replicated `Canvas` record**, which is the obvious
 * alternative and is wrong three ways: no `Operation` produces it, so it is
 * not canvas state; **a home does not know its own public address** —
 * `homeUrl` means "the address I answer to", and the hosted daemon at
 * dev.isocan.io has none, so it could never write the field truthfully for a
 * canvas born there; and `adoptRemoteSnapshot` rewrites the local canvas
 * record from the home's copy, so the field would be clobbered by replication
 * on exactly the machine whose routing depends on it.
 *
 * **Why not `dirs.json`.** Its own doc says it is a discovery cache, "never
 * trusted over the marker", "stale until someone works there again". It is
 * empty for a canvas with no directory (born in a browser; joined too near
 * `$HOME` to hold a marker), and it is MULTI-VALUED — several rows may name
 * one canvas (worktrees, clones) — so two clones carrying markers naming two
 * different homes would hand the daemon a contradiction with no arbiter.
 */
/** `canvasId → homeUrl | null`. A normalized address, or null for "here". */
export type HomeAssignments = Record<string, string | null>;
/**
 * Every row, with each address normalized on the way out.
 *
 * Normalizing at READ time rather than trusting the file is deliberate: this
 * file is small, hand-inspectable, and a person who edits it to fix a typo
 * should not have to know that `https://Isocan.io/` and `https://isocan.io`
 * are two different links. See `normalizeHomeUrl` in core for why one spelling
 * matters at all now that a daemon holds several.
 *
 * A missing or malformed file is NO ROWS, never a crash — `readConfigFile`'s
 * posture next door, for the same reason: a hand-editable file must not be
 * able to stop a daemon booting. What that costs, said plainly, is that a
 * corrupt `homes.json` makes every canvas on this machine read as locally
 * homed, which is the safe direction (writes stay here and are refused by
 * nothing) rather than the dangerous one (writes go to a home that is not
 * theirs).
 */
export declare function readHomes(home: string): Promise<HomeAssignments>;
/** Whether the file exists at all — the one question the boot migration asks,
 * and the reason it is asked rather than inferred from emptiness: a machine
 * whose canvases are all locally homed has a file full of nulls, and a machine
 * that has never been upgraded has no file. Those are different facts. */
export declare function homesRecorded(home: string): Promise<boolean>;
/**
 * Write the whole record. Callers serialize; see `HomeLinks` for the one
 * writer this file has at runtime, and `migrations.ts` for the one that runs
 * before it exists.
 *
 * **Atomically**, and that is not ceremony — it was measured. A plain
 * `writeFile` truncates and then fills, so a reader in that window sees a
 * TORN file, and this file's tolerant reader answers a torn file with no rows.
 * No rows means "every canvas on this machine is locally homed", which is the
 * safe direction for one read and a very bad direction for the read that
 * happens at BOOT: a daemon that started in that window would forward nothing,
 * serve pages for canvases it does not host, and — worst — let a sweep re-claim
 * them one by one under the "this id has no row" branch. The suite caught it as
 * `Unexpected end of JSON input` on a test that happened to read while a delete
 * was writing, which is a millisecond a real machine has too.
 */
export declare function writeHomes(home: string, rows: HomeAssignments): Promise<void>;
