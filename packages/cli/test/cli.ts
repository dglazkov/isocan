import { spawn, type ChildProcess, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { harnessVars } from "@isocan/api";

/**
 * **The one way a test starts the real binary** (cleanup phase 6, TR-13 /
 * DU-3, 27 Sep 2026).
 *
 * Seventy-one test sources carried their own copy of the same twenty lines —
 * resolve `bin/isocan.js`, scrub the harness variables, spawn, gather stdout
 * and stderr, resolve on `close` — and the copies had drifted apart the way
 * copies do. Some set the stream encoding and some did not, which is the bug
 * `agent-help.test.ts` paid for on CI. Most read a process killed by a signal
 * as exit 0. A few listened for `error`; the rest would hang until vitest's
 * timeout on a spawn that failed, instead of saying why.
 *
 * So the spawning, the gathering and the scrubbing live here, and a test file
 * keeps only what is actually its own: which home, which port, which
 * directory, which session. `test/spawners.test.ts` counts the files that
 * still start the binary themselves, and that number only goes down.
 *
 * It sits in a `test/` directory, and is imported by relative path — `./cli.ts`
 * here, `../../cli/test/cli.ts` from another package — for a reason
 * `test/deep.ts` states: the deep lane decides a file walks the CLI by reading
 * its source AND the test modules it imports, and this file is what that
 * reading finds.
 */

/** The development binary, the one every test in this package drives. */
export const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CliOptions {
  /** The whole environment the child sees — build it with `cliEnv`. */
  env: NodeJS.ProcessEnv;
  /** Never the repo root by default: a directory identity there would outrank
   *  the home identity a test wrote (see `wait.test.ts`). */
  cwd?: string | undefined;
}

/**
 * **`process.env` with the runner's harness taken out, then the test's own on
 * top.**
 *
 * The order is the point. `harnessVars` includes `ISOCAN_SESSION_ID` and
 * `CLAUDE_CODE_SESSION_ID`, and a test that SETS one of them is usually the
 * test about it — clearing after setting would delete the thing it is
 * testing, and the symptom is a verb that hangs rather than a failed
 * assertion (`operator.test.ts`). Clearing at all is `park.test.ts`'s rule: a
 * test that inherits the runner's session passes inside an agent harness and
 * fails on CI, which exports none. An `undefined` in `overrides` removes the
 * variable, because `spawn` leaves undefined values out.
 */
export function cliEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of harnessVars) delete env[name];
  return { ...env, ...overrides };
}

/** Start the binary with piped output, for a test that needs the process
 *  itself — to read it as it runs, or to kill it. `collect` finishes it. */
export function spawnCli(args: readonly string[], options: CliOptions): ChildProcessByStdio<null, Readable, Readable> {
  return spawn(process.execPath, [cliBin, ...args], {
    env: options.env,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * **Everything a child printed, and how it ended.**
 *
 * `setEncoding` on both streams, always. `stdout += chunk` on a raw stream
 * decodes each buffer on its own, so a UTF-8 character that straddles a chunk
 * boundary lands as two broken halves; the encoding puts a `StringDecoder` in
 * the way, which holds a partial character back until the rest arrives.
 * `agent-help.test.ts` failed exactly so on CI and never on a laptop — where
 * the OS splits a stream depends on how loaded the machine is — with one
 * em-dash of the guide mangled and every other intact.
 *
 * A child killed by a signal has no exit code; it reads as 1 here, never 0,
 * so a timeout cannot pass for success. A spawn that fails rejects rather than
 * leaving the test waiting for a `close` that will not come. `timeoutMs`
 * kills a child still running then, and says so on its stderr — for the tests
 * that would rather fail with what the child printed than on vitest's
 * anonymous deadline.
 */
export function collect(child: ChildProcess, timeoutMs?: number): Promise<Run> {
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => (stdout += chunk));
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => (stderr += chunk));
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          stderr += `\n(killed: still running after ${timeoutMs} ms)`;
          child.kill("SIGKILL");
        }, timeoutMs);
  timer?.unref();
  return new Promise((resolve, reject) => {
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** Run the binary to completion: `spawnCli`, then `collect`. */
export function runCli(args: readonly string[], options: CliOptions): Promise<Run> {
  return collect(spawnCli(args, options));
}
