import { accessSync, constants, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Where `isocan` can be found — and where it cannot, whatever `which` says.
 *
 * Run through npx, this process's own directory is on PATH: a cache npm made
 * for one command and will delete afterwards. `which isocan` answers yes from
 * in there while the shell running the NEXT command answers "command not
 * found" — which is how `setup` came to report "already on PATH" and install
 * nothing (#48). So the lookup skips directories that do not outlive the
 * command, and everything that reports or hands out a path goes through it.
 */

const NPX_CACHE = `${path.sep}_npx${path.sep}`;
const LOCAL_BIN = `${path.sep}node_modules${path.sep}.bin`;

/** A directory whose contents vanish: npx's cache, or a project's local bin. */
export function transientDir(dir: string): boolean {
  return dir.includes(NPX_CACHE) || dir.endsWith(LOCAL_BIN);
}

function runnable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function real(file: string): string {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

/**
 * `which <command>`, minus the copies that are about to disappear. Returns the
 * path a later shell would find, or null when there is no such copy.
 */
export function findOnPath(
  command: string,
  pathVar: string = process.env.PATH ?? "",
  executable: (file: string) => boolean = runnable,
): string | null {
  const names =
    process.platform === "win32" ? [`${command}.cmd`, `${command}.exe`, command] : [command];
  for (const dir of pathVar.split(path.delimiter)) {
    if (!dir || transientDir(dir)) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      // The link can lead back into the cache the directory scan just skipped.
      if (executable(file) && !transientDir(real(file))) return file;
    }
  }
  return null;
}

/**
 * The package root of a copy of isocan, given its bin — `bin/isocan.js` sits
 * in the same relative place in a checkout and in an install, which is what
 * lets one copy be compared with another (`stalenessOf`).
 */
export function rootOfBin(bin: string): string {
  return path.resolve(path.dirname(real(bin)), "../../..");
}

/**
 * Where `npm i -g` puts binaries. Under nvm, fnm, asdf or volta this is a
 * version-specific directory a non-login shell may never have been told
 * about — so setup says where the CLI went rather than assuming you can see
 * it.
 */
export function globalBinDir(): string | null {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const prefix = spawnSync(npm, ["prefix", "-g"], { encoding: "utf8" }).stdout?.trim();
  if (!prefix) return null;
  return process.platform === "win32" ? prefix : path.join(prefix, "bin");
}
