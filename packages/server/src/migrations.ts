import { promises as fs } from "node:fs";
import type { ActorClaim, ActorRegistry, LogEntry, OpEnvelope } from "@isocan/core";
import { bindName, GRANTED_BY_MIGRATION, newOpId, normalizeHomeUrl } from "@isocan/core";
import * as p from "./paths.ts";
import type { Desk } from "./desk.ts";
import { ensureLinkGrant } from "./grants.ts";
import { readBadge } from "./badge-store.ts";
import { homesRecorded, writeHomes, type HomeAssignments } from "./homes.ts";
import type { Store } from "./store.ts";

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
export async function runMigrations(
  home: string,
  store: Store,
  desk: Desk,
  /** The home this machine has configured, as `resolveHomeUrl` answers it —
   * the birth default from phase 10.3 on. Null when nothing is configured,
   * which is every daemon in this repo and every hosted home. */
  configuredHome: string | null,
): Promise<void> {
  await migrateLegacyClaims(home, store, desk);
  await migrateLegacyAgents(home, store, desk);
  await grantTheLinkOnOldCanvases(home, store, desk);
  await recordWhereTheCanvasesAlreadyLive(home, store, configuredHome);
}

/**
 * **Write down what is true today** — phase 10.3's one migration, and the
 * whole of it is one wrinkle the upgrade must not fall into.
 *
 * From 10.3 on, a canvas with no row in `homes.json` is one this daemon is the
 * home of. That reading is correct for Dion — his canvases were born local,
 * their markers name no home, and they keep working with nothing done. It is
 * catastrophically wrong for the OTHER upgraded machine: one whose
 * `config.json` already carries a `home`, holding canvases that were born on
 * it as a replica in the phase 6→7.5 window. Their markers say nothing (the
 * marker only started carrying an address later), they genuinely live at that
 * home, and re-reading "absent" as "local" would silently FORK every one of
 * them — two divergent copies of one canvas id, which is the twin case this
 * codebase refuses by name everywhere else.
 *
 * So: **if there is no `homes.json` yet and a home is configured, every canvas
 * this store currently holds gets a row naming that home. Otherwise nothing is
 * written at all.**
 *
 * The "otherwise" is not a shrug, it is the load-bearing half:
 *
 * - **A hosted home writes nothing.** It has no configured home, and — the
 *   part that would hurt — a container starts from a fresh filesystem and
 *   re-runs its migrations at EVERY cold start (see
 *   `grantTheLinkOnOldCanvases`, which pays that cost knowingly and says so).
 *   A per-canvas write there, once per cold start, for canvases that are all
 *   local by definition, would be unacceptable. This writes zero bytes.
 * - **Dion writes nothing.** No configured home, so absent-means-local is
 *   already the truth about his machine and there is nothing to record.
 * - **The replica writes its truth once**, explicitly, and is then frozen at
 *   that home — which is exactly the promise: `config.json`'s `home` is
 *   re-purposed as the BIRTH default, so what it means for new canvases
 *   changes, and what it means for existing ones is pinned here so it does
 *   not.
 *
 * The file's existence is its own marker. An empty `{}` is a real answer (this
 * machine has a home configured and holds nothing yet) and must be written, or
 * the migration re-runs at the next boot and freezes canvases that arrived in
 * between — which would be harmless today and is the kind of "harmless" that
 * stops being true when somebody adds a case.
 */
async function recordWhereTheCanvasesAlreadyLive(
  home: string,
  store: Store,
  configuredHome: string | null,
): Promise<void> {
  if (await homesRecorded(home)) return;
  const rows: HomeAssignments = {};
  /**
   * **The file is written even when it is empty, and that is the whole guard.**
   *
   * This used to `return` before writing when no home was configured, which
   * left the migration ARMED on exactly the machine it was least meant for.
   * Dion's rig has no configured home and no rows, so nothing was written; then
   * the first `isocan home <address>` wrote `config.json` and restarted, the
   * restart walked back into this function, and the branch below froze every
   * locally-born canvas at a home it had never been to — under a verb whose own
   * output says *"nothing already here moved"*. Measured on a reconstructed
   * rig: both canvases 404'd and `isocan add` answered `canvas not found`.
   *
   * Writing `{}` disarms it. The comment above this function has said so since
   * the day it was written ("an empty `{}` is a real answer and must be
   * written, or the migration re-runs at the next boot") — the reasoning was
   * right and the code returned before reaching it, which is the most ordinary
   * way for a guard to be missing.
   *
   * The hosted home pays one tiny write per cold start rather than one per
   * canvas, because with no configured home there are no rows to build.
   */
  /**
   * **A configured home is not evidence that this machine was ever a replica**,
   * and that is the second half of the same bug.
   *
   * `isocan home <address>` writes `config.json` and THEN restarts the daemon,
   * so if it is the first thing run on upgraded code the daemon's very first
   * boot already sees a configured home — and "write the empty file on the
   * boot before" never happens, because there was no boot before. Freezing on
   * the config key alone would repoint Dion's canvases on the one path most
   * likely to be his actual first command.
   *
   * The evidence that this machine really was a phase 6→7.5 replica is a
   * **badge at that address**. A replica dialled its home and was recognised
   * by it, and `identity.json`'s `auth` block has held one badge per address
   * since phase 6 — durable, local, and already there before the upgrade. A
   * machine that has merely been TOLD an address has never knocked on its
   * door.
   *
   * The narrow way this is wrong is a replica whose badge was deleted between
   * its last run and this upgrade; its canvases then read as local. That is
   * the lost-badge recovery path, it is rare, and it fails toward "this is
   * mine" — which loses nothing and is repaired by pointing the machine at the
   * home again. The other direction silently hands somebody's local work to a
   * stranger's home, so this is the side to be wrong on.
   */
  const everDialled =
    configuredHome !== null && (await readBadge(home, normalizeHomeUrl(configuredHome))) !== null;
  if (configuredHome !== null && everDialled) {
    for (const canvas of await store.listCanvases()) {
      rows[canvas.id] = normalizeHomeUrl(configuredHome);
    }
  }
  await writeHomes(home, rows);
}

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
 * **The marker, and its honest limit.** A file beside the desk says this ran,
 * so the ordinary case is one `stat` at boot. It is a FILE, so a container
 * that starts from a fresh filesystem re-runs it — the hosted home does
 * exactly that on every cold start — and what that costs is one `grantsFor`
 * query per canvas, writing nothing once the rows exist. That is acceptable
 * at journey scale and would not be at ten thousand canvases; the fix when it
 * matters is to move the marker onto the desk itself, where it survives the
 * container. Named here rather than discovered there.
 *
 * `grantedBy` is the migration rather than a badge id, so "who opened this
 * canvas up?" answers "nobody — it predates the question" instead of
 * fingering whichever badge happened to be around.
 */
async function grantTheLinkOnOldCanvases(home: string, store: Store, desk: Desk): Promise<void> {
  const marker = p.linkGrantsMigratedFile(home);
  if (await fs.stat(marker).then(() => true, () => false)) return;
  for (const canvas of await store.listCanvases()) {
    await ensureLinkGrant(desk, canvas.id, GRANTED_BY_MIGRATION);
  }
  await fs.mkdir(p.deskDir(home), { recursive: true }).catch(() => {});
  await fs.writeFile(marker, new Date().toISOString()).catch(() => {});
}

/** The registry as it looked before the badge. */
interface PreBadgeActors {
  lastSeq?: number;
  claims?: Record<string, { id?: string; name?: string; boundAt?: string; canvasId?: string }>;
  colors?: ActorRegistry["colors"];
  names?: ActorRegistry["names"];
}

/**
 * `actors.json` keyed by session key → the split registry.
 *
 * The public name lands in the registry carrying its ORIGINAL `boundAt` as
 * its `at`, so recency carries over exactly; the private half lands on the
 * shelf. The old file is renamed aside as `actors.json.pre-badge` — house
 * precedent, and the record of who held what when the desk opened. The
 * `actors.jsonl` is left alone: its envelopes replay into names correctly
 * under `bindName`.
 */
async function migrateLegacyClaims(home: string, store: Store, desk: Desk): Promise<void> {
  let legacy: PreBadgeActors;
  try {
    legacy = JSON.parse(await fs.readFile(p.actorsFile(home), "utf8")) as PreBadgeActors;
  } catch {
    return; // no registry yet, or unreadable — nothing to split
  }
  if (!legacy.claims || legacy.names !== undefined) return; // already the new shape

  const names: ActorRegistry["names"] = {};
  const shelf: Record<string, ActorClaim> = {};
  for (const [key, binding] of Object.entries(legacy.claims)) {
    if (!binding?.id || !binding.name) continue;
    const boundAt = binding.boundAt ?? new Date(0).toISOString();
    const current = names[binding.id];
    if (!current || current.at < boundAt) names[binding.id] = { name: binding.name, at: boundAt };
    shelf[key] = {
      actorId: binding.id,
      boundAt,
      sessionKey: key,
      ...(binding.canvasId !== undefined ? { canvasId: binding.canvasId } : {}),
    };
  }

  // Rename first: `saveActors` writes the same path, and the record has to
  // survive rather than be overwritten by its own successor.
  await fs.rename(p.actorsFile(home), p.preBadgeActorsFile(home)).catch(() => {});
  await store.saveActors({ names, colors: legacy.colors ?? {} }, legacy.lastSeq ?? 0);
  await desk.shelve(shelf);
}

/**
 * Fold the CLI-era session registry (`agents.json`, pre-#57) into the two
 * ledgers, then move the file aside so this runs once (#59). Actor ids must
 * survive — they are what the canvases remember — so each binding becomes a
 * logged reincarnation claim (`as` + name) stamped with its original
 * boundAt, and a shelved claim row. A lost snapshot recovers the name from
 * the jsonl like any other claim, and the claim itself from the desk's own
 * log.
 */
async function migrateLegacyAgents(home: string, store: Store, desk: Desk): Promise<void> {
  interface LegacyBinding {
    id?: string;
    name?: string;
    boundAt?: string;
  }
  const file = p.agentsFile(home);
  let legacy: { sessions?: Record<string, LegacyBinding> };
  try {
    legacy = JSON.parse(await fs.readFile(file, "utf8")) as typeof legacy;
  } catch {
    return; // no file, or unreadable — nothing to fold in
  }
  const { registry, lastSeq } = await store.loadActors();
  // Asked row by row rather than by reading the whole table: the desk's
  // claim reads are queries now (phase 3), and a migration bounded by the
  // number of legacy sessions can afford one lookup each.
  const spokenFor = new Set<string>();
  const keysTaken = new Set<string>();

  let current = registry;
  let seq = lastSeq;
  const shelf: Record<string, ActorClaim> = {};
  // Oldest first, so when several keys held one actor (nested sessions), the
  // newest binding is the one that survives.
  const sessions = Object.entries(legacy?.sessions ?? {}).sort(([, a], [, b]) =>
    (a?.boundAt ?? "").localeCompare(b?.boundAt ?? ""),
  );
  for (const [key, binding] of sessions) {
    if (!binding?.id || !binding.name) continue;
    // The new registry wins: a key or actor already claimed post-#57 is
    // living its own life, and the legacy row is history.
    if (keysTaken.has(key) || (await desk.holdersOf(key)).length > 0) continue;
    if (spokenFor.has(binding.id) || (await desk.claimants(binding.id)).length > 0) continue;
    const ts = binding.boundAt ?? new Date().toISOString();
    const op = {
      type: "actor.claim",
      sessionKey: key,
      name: binding.name,
      as: binding.id,
    } as const;
    const envelope: OpEnvelope = {
      id: newOpId(),
      canvasId: null,
      actor: { id: binding.id, name: binding.name },
      ts,
      op,
    };
    seq += 1;
    const entry: LogEntry = { seq, envelope, inverse: null };
    await store.appendActorsLog(entry);
    // `bindName` judges by the stamp, not by arrival: these entries land at
    // the END of a log whose other entries are newer, so a two-month-old
    // legacy row must not re-letter an actor renamed last week.
    current = bindName(current, { actor: envelope.actor, ts, sessionKey: key });
    shelf[key] = { actorId: binding.id, boundAt: ts, sessionKey: key };
    spokenFor.add(binding.id);
    keysTaken.add(key);
  }
  if (seq !== lastSeq) await store.saveActors(current, seq);
  await desk.shelve(shelf);
  await fs.rename(file, `${file}.migrated`).catch(() => {});
}
