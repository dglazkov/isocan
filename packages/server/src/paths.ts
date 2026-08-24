import os from "node:os";
import path from "node:path";

/** Root of all isocan state. Tests and dev point ISOCAN_HOME at scratch dirs. */
export function isocanHome(): string {
  return process.env.ISOCAN_HOME ?? path.join(os.homedir(), ".isocan");
}

/**
 * **The on-disk layout is a deliberate holdout** (phase 13.5's rename). The
 * helpers say canvas; the directory and file names on disk — `projects/<id>/`,
 * `deleted-projects/`, and the `project.json` record inside each — do not,
 * because every `~/.isocan` on every machine is already laid out that way and
 * a rename would be a migration bought for a word nobody outside this file
 * reads.
 */
export const canvasesDir = (home: string) => path.join(home, "projects");
export const deletedCanvasesDir = (home: string) => path.join(home, "deleted-projects");
export const canvasDir = (home: string, id: string) => path.join(canvasesDir(home), id);
export const canvasMetaFile = (home: string, id: string) => path.join(canvasDir(home, id), "project.json");
export const canvasFile = (home: string, id: string) => path.join(canvasDir(home, id), "canvas.json");
export const trashFile = (home: string, id: string) => path.join(canvasDir(home, id), "trash.json");
export const oplogFile = (home: string, id: string) => path.join(canvasDir(home, id), "oplog.jsonl");
export const oplogArchiveFile = (home: string, id: string) =>
  path.join(canvasDir(home, id), "oplog-archive.jsonl");
export const blobsDir = (home: string, id: string) => path.join(canvasDir(home, id), "blobs");
export const blobsIndexFile = (home: string, id: string) => path.join(canvasDir(home, id), "blobs.json");
export const daemonFile = (home: string) => path.join(home, "daemon.json");
export const daemonLogFile = (home: string) => path.join(home, "daemon.log");
export const identityFile = (home: string) => path.join(home, "identity.json");
/** The actor registry snapshot: which session key speaks as whom (#57). */
export const actorsFile = (home: string) => path.join(home, "actors.json");
/** The home's identity oplog — every actor.claim, append-only. */
export const actorsLogFile = (home: string) => path.join(home, "actors.jsonl");
/** The registry as it was before the badge — claims keyed by session key.
 * Renamed aside by the one-time migration, and kept: it is the record of who
 * held what when the desk opened. */
export const preBadgeActorsFile = (home: string) => path.join(home, "actors.json.pre-badge");
/** The desk's ledgers: innkeeper-private, never replicated (the two-ledger
 * rule). A DIRECTORY rather than a loose file, because the desk grows
 * `grants`, `registrations`, and an audit ledger in phases 7, 9, and 12, and
 * because encryption at rest and key custody for these is a debt innkeeper.md
 * already owes — a directory makes that a directory-level operation later
 * instead of a scavenger hunt. */
export const deskDir = (home: string) => path.join(home, "desk");
/** The badge snapshot: every badge this home has minted. Derived. */
export const badgesFile = (home: string) => path.join(deskDir(home), "badges.json");
/** The desk's durable log — mints, claims, and the migration shelf,
 * append-only, fsynced before a write is acknowledged. A claim carries
 * AUTHORIZATION now, so the claims half is snapshot-plus-tail like everything
 * else in this house: losing one file must not lock somebody out of their own
 * name. Admissions and `lastSeen` are deliberately NOT logged — the address
 * admits, so a returning badge re-admits itself on its next request, and one
 * fsync per (badge, canvas) pair for data that rebuilds itself is ceremony. */
export const badgesLogFile = (home: string) => path.join(deskDir(home), "badges.jsonl");
/** Says the phase 7 link-grant migration has run here. A marker file rather
 * than a renamed-aside input, because that migration has no input file to
 * rename: what it reads is the canvas list. See
 * `grantTheLinkOnOldCanvases` for what a container with no durable
 * filesystem does with it. */
export const linkGrantsMigratedFile = (home: string) =>
  path.join(deskDir(home), "link-grants.migrated");
/** The CLI-era session registry (pre-#57); read only to migrate (#59). */
export const agentsFile = (home: string) => path.join(home, "agents.json");
/** Pre-facepile-fix single pointer; read by nobody, removed on sight. */
export const legacySessionFile = (home: string) => path.join(home, "session.json");
/** One presence-session pointer PER ACTOR — a home-scoped single file was
 * how two agents ended up beating each other's actor into one session. */
export const cliSessionFile = (home: string, actorId: string) =>
  path.join(home, "sessions", `${actorId}.json`);
export const configFile = (home: string) => path.join(home, "config.json");
/** Slash commands this home has written: one markdown file per command, named
 * by the command. A home file shadows the built-in of the same name. */
export const commandsDir = (home: string) => path.join(home, "commands");
export const commandFile = (home: string, name: string) =>
  path.join(commandsDir(home), `${name}.md`);
/** The directory roster: realpath → canvasId, a discovery cache healed by
 * the CLI whenever a command runs from a bound directory (#60). The
 * authoritative binding is the `.isocan/project.json` marker in the
 * directory itself; this file only answers "where on disk does that canvas's
 * work live" without a filesystem crawl. */
export const dirsFile = (home: string) => path.join(home, "dirs.json");
/**
 * **Which home each canvas on this machine belongs to** — `canvasId →
 * homeUrl | null`, phase 10.3's one new file.
 *
 * A sibling of `dirs.json` and `config.json` rather than anything inside
 * `projects/<id>/`, and the placement carries the argument. `project.json` in
 * there IS the replicated `Canvas` record, so a home written into it would be
 * overwritten by the next snapshot from the home — on the machine that most
 * needs it stable. A sidecar beside it would be a fifth file-shaped thing
 * crossing the `Store` seam for data no backing has any business holding:
 * this is a fact about ONE MACHINE's relationship to a canvas, not canvas
 * state, and canvas state is the only thing that replicates.
 *
 * **Absent and `null` mean the same thing** — this daemon is that canvas's
 * home. Both spellings exist because absent is what a pre-10.3 machine has
 * and `null` is what a post-10.3 local birth writes, and collapsing them at
 * read time is exactly what makes the upgrade a no-op for Dion.
 *
 * **Daemon-owned. The CLI never writes it.** `dirs.json` next door is a
 * CLI-owned discovery cache and this is deliberately not modelled on it: this
 * is routing state the daemon needs at boot with no CLI running, and two
 * writers on one file is how a file drifts. The CLI's way to change a row is
 * `POST /api/home/join`, which goes through the daemon like everything else.
 */
export const homesFile = (home: string) => path.join(home, "homes.json");
