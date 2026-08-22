import { promises as fs } from "node:fs";
import type { ActorClaim, ActorRegistry, LogEntry, OpEnvelope } from "@isocan/core";
import { bindName, newOpId } from "@isocan/core";
import * as p from "./paths.ts";
import type { Desk } from "./desk.ts";
import type { Store } from "./store.ts";

/**
 * The one-time migrations, both of them, composed across the two ledgers.
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
  const claimed = await desk.claims();
  const spokenFor = new Set<string>();
  const keysTaken = new Set<string>();
  for (const rows of Object.values(claimed)) {
    for (const row of rows) {
      spokenFor.add(row.actorId);
      if (row.sessionKey) keysTaken.add(row.sessionKey);
    }
  }

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
    if (keysTaken.has(key)) continue;
    if (spokenFor.has(binding.id)) continue;
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
