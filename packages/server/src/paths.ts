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
/** The CLI-era session registry (pre-#57); read only to migrate (#59). */
export const agentsFile = (home: string) => path.join(home, "agents.json");
/** Pre-facepile-fix single pointer; read by nobody, removed on sight. */
export const legacySessionFile = (home: string) => path.join(home, "session.json");
/** One presence-session pointer PER ACTOR — a home-scoped single file was
 * how two agents ended up beating each other's actor into one session. */
export const cliSessionFile = (home: string, actorId: string) =>
  path.join(home, "sessions", `${actorId}.json`);
export const configFile = (home: string) => path.join(home, "config.json");
/** The directory roster: realpath → projectId, a discovery cache healed by
 * the CLI whenever a command runs from a bound directory (#60). The
 * authoritative binding is the `.isocan/project.json` marker in the
 * directory itself; this file only answers "where on disk does that canvas's
 * work live" without a filesystem crawl. */
export const dirsFile = (home: string) => path.join(home, "dirs.json");
