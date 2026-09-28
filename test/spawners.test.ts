import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHARED_SPAWNER, privateSpawners, startsBinaryItself } from "./deep.ts";

/**
 * **One way to start the binary from a test, and a count that only goes
 * down** (cleanup phase 6, TR-13 / DU-3, 27 Sep 2026).
 *
 * On `6123848e` seventy-one test sources started `bin/isocan.js` themselves,
 * each with its own twenty lines of spawn, scrub and gather — and the copies
 * disagreed about the things that matter when a run goes wrong: whether the
 * streams were decoded (a split UTF-8 character is how `agent-help.test.ts`
 * failed on CI and never on a laptop), whether a child killed by a signal read
 * as exit 0, whether a spawn that failed said so or hung until vitest's
 * timeout. `packages/cli/test/cli.ts` is the one copy now, and the files that
 * used to carry theirs keep only what is their own: a home, a port, a session.
 *
 * ## Why the ceiling is 7 and not 0
 *
 * - `managed.test.ts` and `restart.test.ts` start a *copied build* of the
 *   binary, not the development one — a different path the helper does not
 *   pretend to know. (`restart` walks the development binary through the
 *   helper too; only its copied daemon is its own.)
 * - `daemon-takeover.test.ts` starts a squatting `serve` whose stdout is
 *   ignored rather than piped: piping a daemon's stdout that nobody reads is a
 *   way to wedge it once the pipe fills.
 * - `pass.test.ts` loads an identity hook with `--import` and talks to the
 *   child over an IPC channel.
 * - `ratchetroot.test.ts` and `roadmap.test.ts` run it synchronously
 *   (`execFileSync`), which is a different shape of call, not a copy.
 * - `deeplist.test.ts` quotes a spawn of the binary in the cases that test
 *   the deep lane's own reading — strings are code to this reading, as they
 *   are to that one.
 *
 * Each is a reason, not an exception; lower CEILING when one goes away.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * **The last agreed number of test sources that start the binary themselves.**
 *
 * 7 on 2026-09-27, down from 71 when the copies moved into `SHARED_SPAWNER`.
 * Lower it when you win. Raising it means a new private copy — use
 * `runCli` / `spawnCli` / `collect` from `packages/cli/test/cli.ts` instead.
 */
const CEILING = 7;

/** Every source under a `test/` directory, tracked or new — the way vitest and
 *  `deeplist.test.ts` find them, so a copy is caught before it is committed. */
const sources = (): string[] =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30_000,
  }).split("\n");

describe("test files that start the binary themselves", () => {
  it("are no more than the last number somebody agreed to", () => {
    const found = privateSpawners(repo, sources());
    expect(
      found.length,
      `${found.length} test sources start the development binary themselves, past the agreed ${CEILING}:\n` +
        found.map((file) => `    ${file}`).join("\n") +
        `\n  Start it through ${SHARED_SPAWNER} — runCli(args, { cwd, env: cliEnv({...}) }) for a run to its\n` +
        "  end, spawnCli + collect for a child you need to watch or kill — so the stream decoding, the\n" +
        "  harness scrub and the exit code are the same everywhere.",
    ).toBeLessThanOrEqual(CEILING);
  }, 30_000);

  it("reads a private copy as one, and the shared helper's callers as none", () => {
    // Assembled rather than written out, so this file's own source does not
    // read as a private copy to the rule it is testing.
    const bin = ["cli", "Bin"].join("");
    const call = `${["spa", "wn"].join("")}(process.execPath, [${bin}, ...args])`;
    const path = ["..", "bin", "isocan.js"].join("/");
    expect(startsBinaryItself(`const ${bin} = "${path}"; ${call};`)).toBe(true);
    // Importing the helper's constant and spawning it by hand is still a copy.
    expect(startsBinaryItself(`import { ${bin} } from "./cli.ts"; ${call};`)).toBe(true);
    // A walk through the helper names neither.
    expect(startsBinaryItself('import { runCli } from "./cli.ts"; await runCli(["ls"], { env });')).toBe(false);
    // Writing ABOUT a spawn is not one.
    expect(startsBinaryItself(`// ${call} of ${path}\nconst x = 1;`)).toBe(false);
    // The helper itself is the one place it may live.
    expect(privateSpawners(repo, [SHARED_SPAWNER])).toEqual([]);
  });

  it("reads a private copy under an alias as one — the same reading as the deep lane's", () => {
    // 27 Sep 2026: renaming the import was a way past this ratchet, because
    // the call was read by a fixed list of names. Assembled, as above.
    const bin = ["cli", "Bin"].join("");
    const from = ["node", "child_process"].join(":");
    expect(startsBinaryItself(`import { spawn as run } from "${from}";\nrun(process.execPath, [${bin}]);`)).toBe(true);
    expect(startsBinaryItself(`import * as cp from "${from}";\ncp.exec(\`node \${${bin}}\`);`)).toBe(true);
    // Bound elsewhere, it is not a spawn — the helper's own `runCli` included.
    expect(startsBinaryItself(`import { run } from "./x.ts";\nrun(${bin});`)).toBe(false);
  });
});
