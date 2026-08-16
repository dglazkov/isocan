import { statSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Which copy of isocan is this, and how old is it?
 *
 * The daemon outlives the command that started it — often across an upgrade,
 * because `ensureDaemon` only starts one when the port is silent. So a new CLI
 * talking to an old daemon is the normal outcome of `npm i -g …` or a moved
 * `main`, and until a build could say which one it was, nothing could notice.
 *
 * `root` is exact: an npx cache directory, a global install and a checkout are
 * three different paths. `codeAt` is a heuristic — the newest mtime among a
 * few files that every layout has — and it is a good one, because npm rewrites
 * the whole tree on install, so an in-place upgrade moves it even though the
 * path did not.
 */
export interface BuildStamp {
  version: string;
  /** Package root this build runs from. */
  root: string;
  /** When this copy's code was last written (ISO). */
  codeAt: string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Files present in a checkout and in an install alike. */
const WITNESSES = [
  "package.json",
  "packages/server/src/http.ts",
  "packages/core/src/reducer.ts",
  "packages/cli/src/main.ts",
];

let cached: BuildStamp | null = null;

export function buildStamp(): BuildStamp {
  if (cached) return cached;
  let version = "0.0.0";
  try {
    version = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version?: string })
      .version ?? version;
  } catch {
    // An unreadable manifest is not worth failing a health check over.
  }
  let newest = 0;
  for (const witness of WITNESSES) {
    try {
      newest = Math.max(newest, statSync(path.join(root, witness)).mtimeMs);
    } catch {
      // Missing witness: the others still date this copy.
    }
  }
  cached = { version, root, codeAt: new Date(newest).toISOString() };
  return cached;
}

/**
 * Is `daemon` running code that has since been replaced? Two ways to be stale,
 * and the messages differ because the fixes do: another copy holds the port,
 * or this copy changed under a daemon that started before it.
 */
export function stalenessOf(
  daemon: { root?: string; codeAt?: string; startedAt?: string },
  mine: BuildStamp = buildStamp(),
): { stale: boolean; why: string } {
  if (!daemon.root || !daemon.startedAt) {
    return { stale: true, why: "the daemon predates build stamps — restart it to know what it is" };
  }
  if (path.resolve(daemon.root) !== path.resolve(mine.root)) {
    return { stale: true, why: `the daemon is running another copy of isocan (${daemon.root})` };
  }
  if (daemon.codeAt && Date.parse(daemon.startedAt) < Date.parse(mine.codeAt)) {
    return { stale: true, why: "this copy has been updated since the daemon started" };
  }
  return { stale: false, why: "" };
}
