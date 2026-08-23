import { promises as fs } from "node:fs";
import type { ActorClaim, ActorRegistry, LogEntry, OpEnvelope } from "@isocan/core";
import { bindName, GRANTED_BY_MIGRATION, newOpId } from "@isocan/core";
import * as p from "./paths.ts";
import type { Desk } from "./desk.ts";
import { ensureLinkGrant } from "./grants.ts";
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
export async function runMigrations(home: string, store: Store, desk: Desk): Promise<void> {
  await migrateLegacyClaims(home, store, desk);
  await migrateLegacyAgents(home, store, desk);
  await grantTheLinkOnOldCanvases(home, store, desk);
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
  for (const project of await store.listProjects()) {
    await ensureLinkGrant(desk, project.id, GRANTED_BY_MIGRATION);
  }
  await fs.mkdir(p.deskDir(home), { recursive: true }).catch(() => {});
  await fs.writeFile(marker, new Date().toISOString()).catch(() => {});
}

/** The registry as it looked before the badge. */
interface PreBadgeActors {
  lastSeq?: number;
  claims?: Record<string, { id?: string; name?: string; boundAt?: string; projectId?: string }>;
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
      ...(binding.projectId !== undefined ? { projectId: binding.projectId } : {}),
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
      projectId: null,
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
    current = bindName(current, { actor: envelope.actor, ts });
    shelf[key] = { actorId: binding.id, boundAt: ts, sessionKey: key };
    spokenFor.add(binding.id);
    keysTaken.add(key);
  }
  if (seq !== lastSeq) await store.saveActors(current, seq);
  await desk.shelve(shelf);
  await fs.rename(file, `${file}.migrated`).catch(() => {});
}
