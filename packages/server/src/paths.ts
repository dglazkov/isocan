import os from "node:os";
import path from "node:path";

/** Root of all isocan state. Tests and dev point ISOCAN_HOME at scratch dirs. */
export function isocanHome(): string {
  return process.env.ISOCAN_HOME ?? path.join(os.homedir(), ".isocan");
}

export const projectsDir = (home: string) => path.join(home, "projects");
export const deletedProjectsDir = (home: string) => path.join(home, "deleted-projects");
export const projectDir = (home: string, id: string) => path.join(projectsDir(home), id);
export const projectFile = (home: string, id: string) => path.join(projectDir(home, id), "project.json");
export const canvasFile = (home: string, id: string) => path.join(projectDir(home, id), "canvas.json");
export const trashFile = (home: string, id: string) => path.join(projectDir(home, id), "trash.json");
export const oplogFile = (home: string, id: string) => path.join(projectDir(home, id), "oplog.jsonl");
export const oplogArchiveFile = (home: string, id: string) =>
  path.join(projectDir(home, id), "oplog-archive.jsonl");
export const blobsDir = (home: string, id: string) => path.join(projectDir(home, id), "blobs");
export const blobsIndexFile = (home: string, id: string) => path.join(projectDir(home, id), "blobs.json");
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
/** The directory roster: realpath → projectId, a discovery cache healed by
 * the CLI whenever a command runs from a bound directory (#60). The
 * authoritative binding is the `.isocan/project.json` marker in the
 * directory itself; this file only answers "where on disk does that canvas's
 * work live" without a filesystem crawl. */
export const dirsFile = (home: string) => path.join(home, "dirs.json");
