import type { Desk } from "./desk.js";
import type { Store } from "./store.js";
/**
 * The one-time migrations — two across the two ledgers, and phase 7's third,
 * which writes the door's rows for a world full of canvases born before there
 * was a door to have rows.
 *
 * They live here rather than on the `Store` because they are FILE-SHAPED —
 * an `agents.json`, an old-shaped `actors.json`, files only a disk backing
 * has ever had — and because a claim now has a public half and a private
 * half, so neither of them is one store's business any more. Phase 1 named
 * `Store.migrateLegacyAgents()` as one of three leaks in that seam; claims
 * became desk state, so it left on its own.
 *
 * THE SHELF IS THE TRICK. An upgraded home has claims keyed by `sessionKey`
 * and clients holding no secret; the daemon cannot retroactively hand one
 * out. So the migration writes the public name into the registry and puts
 * the private half on the desk's SHELF — a claim that belongs to no badge
 * yet, adoptable exactly once by the first badge that presents its
 * `sessionKey`. That is not a loosening: it is precisely today's posture — a
 * client asserting a sessionKey is handed that actor, with no credential in
 * the picture at all — preserved for one hop and then extinguished. The shelf
 * empties itself, and its size is bounded by how many legacy keys a home has.
 *
 * Who loses, plainly: a client whose sessionKey is gone anyway (already lost
 * today; `--as` is still the way back), a browser whose localStorage was
 * cleared (ditto), and — the genuinely new one — a second client presenting a
 * sessionKey another badge already adopted, which gets `name-taken` and must
 * use `--as`. A sessionKey names one conversation on one machine, so that
 * should be approximately nobody.
 */
export declare function runWorkstationMigrations(home: string, store: Store, desk: Desk, 
/** The home this machine has configured, as `resolveHomeUrl` answers it —
 * the birth default from phase 10.3 on. Null when nothing is configured,
 * which is every daemon in this repo and every hosted home. */
configuredHome: string | null): Promise<void>;
/**
 * Every canvas that predates grants gets the standing link grant it would
 * have been born with (phase 7).
 *
 * **Why this is not optional.** The door now refuses a badge no grant admits.
 * Every canvas already in the world — on every laptop, and at dev.isocan.io —
 * has no grant row, so without this every one of them becomes unreachable the
 * moment its daemon is upgraded: not degraded, not read-only, gone.
 *
 * **Why not "no grants means link is implied".** That is the same fallback
 * `desk.ts` forbids for the claim queries, for exactly the same reason: it
 * would make a canvas whose grant was never written admit everybody anyway,
 * so a birth path that forgot to write the row would look perfect until the
 * day somebody turned a link off and it did not go off. The rows are written.
 *
 * **The marker lives on the desk** (`linkGrantsMigrated` /
 * `markLinkGrantsMigrated`), so a hosted container starting from a fresh
 * filesystem sees the marker in Firestore and skips the per-canvas scan on
 * every cold start.
 *
 * `grantedBy` is the migration rather than a badge id, so "who opened this
 * canvas up?" answers "nobody — it predates the question" instead of
 * fingering whichever badge happened to be around.
 */
export declare function grantTheLinkOnOldCanvases(store: Store, desk: Desk): Promise<void>;
