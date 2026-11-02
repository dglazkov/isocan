/**
 * **What the local judge's phase 1 scripts share** (local-judge phase 1):
 * where the real set lives, the refusal to put it in a repository, and an
 * atomic write. The real set is a person's own canvas text — it stays in
 * `<isocan home>/local-judge/`, never in a git work tree, never committed.
 */
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** The isocan home — `ISOCAN_HOME`, else `~/.isocan` (the server's `isocanHome()`). */
export function isocanHome() {
  return process.env.ISOCAN_HOME || path.join(os.homedir(), ".isocan");
}

/** Where the real evaluation set lives: beside the home's keys and models, never in a repository. */
export function judgeDir(home = isocanHome()) {
  return path.join(home, "local-judge");
}

/** The real asks, drafted and reviewed. */
export const ASKS_FILE = "asks.json";

/**
 * The git work tree a path would land in, or null — the same walk
 * `isocan judge corpus` makes (packages/modules/judge/src/cli.ts `gitRootOf`;
 * that file imports its guide as Markdown, which a plain script cannot load).
 */
export function gitRootOf(dir) {
  let at = path.resolve(dir);
  for (;;) {
    if (existsSync(path.join(at, ".git"))) return at;
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

/** Refuse a directory inside a repository, in words. */
export function refuseInRepo(dir, what = "the real set") {
  const repo = gitRootOf(dir);
  if (repo) {
    throw new Error(
      `REFUSED: ${dir} is inside a git work tree (${repo}) — ${what} carries a person's own canvas text and stays on this machine, outside any repository. Name a directory outside it.`,
    );
  }
}

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Write through a temp file and rename, so a crash never leaves half a labels file. */
export function writeJsonAtomic(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

/**
 * Speak as the machine's person, not as an agent session: the harness
 * variables an agent's shell carries make the CLI's identity walk look for a
 * session claim. Removed from THIS process's environment only.
 */
export function asPerson() {
  for (const k of Object.keys(process.env)) if (/^(CLAUDE|CODEX|GEMINI_CLI|ISOCAN_SESSION_ID|ISOCAN_HARNESS)/.test(k)) delete process.env[k];
}

export const argOf = (argv) => (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
