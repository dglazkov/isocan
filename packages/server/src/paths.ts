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
/** Agents that named themselves for one harness session; see cli/identity.ts. */
export const agentsFile = (home: string) => path.join(home, "agents.json");
export const sessionFile = (home: string) => path.join(home, "session.json");
export const configFile = (home: string) => path.join(home, "config.json");
