import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * **A synchronous exec cannot be interrupted, so vitest's deadline is a wish.**
 *
 * `execFileSync` blocks the worker thread. The timer that would fire
 * `testTimeout` — or the per-test budget written beside the `it` — is on that
 * thread, so it cannot run until the child returns. The test does eventually
 * fail, and it reports the budget rather than the truth.
 *
 * Measured on 31 Aug, four suite runs under 16 spinners on 14 cores.
 * `canvas-board.test.ts`'s "NO SIGNAL" test declares `120_000` and ran for:
 *
 * ```
 * 2,025,845ms   2,218,012ms   2,502,849ms      (34, 37 and 42 minutes)
 * Error: Test timed out in 120000ms.
 * ```
 *
 * Three of four runs were dominated by one test that nothing on screen showed
 * was still going, and the message understates it seventeenfold. `lessons.md`
 * #6 is the rule it breaks: *a hang that never fails is the thing to avoid,
 * not a slow test that eventually does.*
 *
 * **Derived, not listed.** This finds its own subjects — every sync exec in
 * every test file — because the seven that existed when it was written are not
 * the interesting ones. The eighth is.
 */
const SYNC_EXEC = /\b(execFileSync|execSync)\s*\(/g;

/** How far past the call to look for the options object. A call spanning more
 * lines than this is hard enough to read that a reviewer will see the missing
 * bound anyway. */
const WINDOW = 12;

function testFiles(): string[] {
  return execFileSync("git", ["ls-files", "test", "packages/*/test"], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30_000,
  })
    .split("\n")
    .filter((f) => f.endsWith(".test.ts") || f.endsWith(".ts"));
}

describe("a synchronous exec in a test carries its own deadline", () => {
  const files = testFiles();

  it("finds the calls at all — a search over nothing always passes", () => {
    /* The bug that let an earlier guard in this repo pass while doing nothing:
       its pathspec matched no files. If this count is zero, the finder is
       broken, not the tree. */
    const total = files
      .map((f) => (readFileSync(path.join(repo, f), "utf8").match(SYNC_EXEC) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(total, "no sync execs found — the finder is wrong").toBeGreaterThan(5);
  });

  it("bounds every one of them", () => {
    const naked: string[] = [];
    for (const file of files) {
      const lines = readFileSync(path.join(repo, file), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/\bimport\b/.test(line)) return;
        if (!new RegExp(SYNC_EXEC.source).test(line)) return;
        const window = lines.slice(i, i + WINDOW).join("\n");
        /* Any value but `undefined` — the first version of this asked for a
           digit and so reported three calls carrying a named `CHILD_BUDGET_MS`
           as unbounded. A guard that cannot read the fix is a guard that
           teaches people to work around it. */
        if (!/\btimeout:\s*(?!undefined\b)\S/.test(window)) naked.push(`${file}:${i + 1}`);
      });
    }
    expect(
      naked,
      "these block the worker with no deadline of their own — pass `timeout:` " +
        "in the options, under whatever budget the test declares",
    ).toEqual([]);
  });
});
