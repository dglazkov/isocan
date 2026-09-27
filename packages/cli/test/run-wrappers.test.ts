import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Command } from "commander";
import { ApiError } from "@isocan/api";
import { BADGE_ENDED } from "@isocan/core";
import type { Ctx } from "../src/ctx.ts";
import { run, withContext } from "../src/run.ts";

/**
 * **One way for a verb to fail** (cleanup TS-5, 27 Sep 2026).
 *
 * `run` is the wrapper every verb in `main.ts` goes through: it prints
 * `error: <message>`, adds the sentence for a badge the operator ended, and
 * sets the exit code. The command families registered beside `main.ts` did
 * not use it. Each had its own copy of the catch, ten of them on the day this
 * was written, and every copy printed the bare message and never said the
 * ended-badge sentence. So a verb's failure read differently depending on
 * which file registered it. They go through `withContext` / `onCanvas` in
 * `run.ts` now, which fail through `run`.
 *
 * The count is of the SHAPE that made them: a `catch` that sets
 * `process.exitCode = 1` and never rethrows, meaning every error ends there.
 * `run.ts` holds the one allowed. A catch that handles one error and rethrows
 * the rest (`passForAgent`'s in `main.ts`) is not a wrapper and is not
 * counted.
 */

const src = fileURLToPath(new URL("../src/", import.meta.url));

/** The last agreed number of private catch-and-exit wrappers outside
 * `run.ts`. 10 before cleanup TS-5, 0 after it. It can only go down, and
 * it cannot go lower than this. */
const CEILING = 0;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(path.join(dir, entry.name))
      : entry.name.endsWith(".ts") ? [path.join(dir, entry.name)] : [],
  );
}

/** Every catch in `packages/cli/src` that ends every error in an exit code,
 * as `file:line`. */
function privateRunWrappers(): string[] {
  const found: string[] = [];
  for (const file of sources(src)) {
    if (path.basename(file) === "run.ts") continue;
    const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isCatchClause(node)) {
        const block = node.block.getText(sf);
        if (/process\.exitCode\s*=\s*1\b/.test(block) && !/\bthrow\b/.test(block)) {
          found.push(`${path.relative(src, file)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

describe("a verb fails one way, whichever file registered it", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("has no private catch-and-exit wrapper beside run()", () => {
    const found = privateRunWrappers();
    expect(
      found.length,
      `${found.length} catch blocks in packages/cli/src end every error in an exit code themselves,\n` +
        `  past the agreed ${CEILING}:\n    ${found.join("\n    ")}\n` +
        "  Wrap the action in run(), withContext() or onCanvas() from src/run.ts instead, so it\n" +
        "  prints `error: …` and the ended-badge sentence the way every other verb does.",
    ).toBeLessThanOrEqual(CEILING);
  });

  it("gives a family's action run()'s words, not its own", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const ctx = {} as Ctx;
    const action = withContext(async () => ctx, async () => {
      throw new ApiError(401, "badge ended by the operator", BADGE_ENDED);
    });
    await action({} as Command);
    expect(errors.mock.calls[0]).toEqual(["error: badge ended by the operator"]);
    expect(String(errors.mock.calls[1]?.[0])).toContain("ended by the operator of that home");
    expect(process.exitCode).toBe(1);
  });

  it("says a thrown non-Error as itself rather than `undefined`", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await run(async () => {
      throw "refused";
    })();
    expect(errors).toHaveBeenCalledWith("error: refused");
  });
});
