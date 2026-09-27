import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { INSTALL_SPEC } from "@isocan/core";

/**
 * **Run a script of this copy's own for a CLI verb, and fail in words**
 * (cleanup phase 4, DC-1, 27 Sep 2026).
 *
 * `isocan canvas shot` and the deck's PDF/PNG export spawn
 * `scripts/canvas-shot.mjs` and `scripts/deck-export.mjs` — the sources in a
 * checkout, a stub importing their bundle in an install. From 18 Sep every
 * install's copy could not start (ERR_MODULE_NOT_FOUND), and the person read a
 * Node stack trace and then "the screenshot did not land (exit 1)": a
 * sentence about a picture when the fault was the install. And the guard in
 * front of it — `existsSync`, "run it from a clone of isocan" — never fired,
 * because the files were there; only what they imported was not.
 *
 * So the three ways a spawn goes wrong are three sentences:
 * - the file is missing: this copy is incomplete, and which file;
 * - it cannot start: which module is missing, and how to reinstall;
 * - it ran and failed: its exit code AND the last thing it said, which in
 *   `--json` mode (`quiet`) was captured and thrown away before.
 *
 * stderr is captured rather than inherited so it can be read, and echoed
 * unless `quiet`; the scripts write only their failures there. `env` is how
 * the verb hands down what its flags said — `--port` above all, since a
 * script that spawns the CLI again cannot see the outer command's flags.
 */
export function runPackageScript(
  script: string,
  args: readonly string[],
  opts: { what: string; input?: string | undefined; quiet?: boolean; env?: Record<string, string> },
): void {
  if (!existsSync(script)) {
    throw new Error(`${opts.what} needs ${script}, which this copy of isocan does not have — reinstall it: npm i -g ${INSTALL_SPEC}`);
  }
  const child = spawnSync(process.execPath, [script, ...args], {
    stdio: [opts.input !== undefined ? "pipe" : "inherit", opts.quiet ? "pipe" : "inherit", "pipe"],
    input: opts.input,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
  });
  const stderr = child.stderr ?? "";
  if (!opts.quiet && stderr) process.stderr.write(stderr);
  if (child.error) throw new Error(`${opts.what} could not start: ${child.error.message}`);
  if (child.status === 0) return;
  const missing = /ERR_MODULE_NOT_FOUND[\s\S]*?Cannot find (?:package|module) '([^']+)' imported from (\S+)/.exec(stderr)
    ?? /Cannot find (?:package|module) '([^']+)' imported from (\S+)[\s\S]*?ERR_MODULE_NOT_FOUND/.exec(stderr);
  if (missing) {
    throw new Error(
      `${opts.what} could not start: ${missing[1]} is missing from this copy of isocan (imported by ${missing[2]}). ` +
        `The install is incomplete — reinstall it: npm i -g ${INSTALL_SPEC}`,
    );
  }
  const said = stderr.trim().split("\n").filter(Boolean).at(-1);
  const how = child.status === null ? `killed by ${child.signal ?? "a signal"}` : `exit ${child.status}`;
  throw new Error(`${opts.what} did not land (${how})${said ? `: ${said}` : ""}`);
}
