import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The changelog is a page per day and an index that points at every one of
 * them. Both halves are written by hand or by the nightly workflow, and both
 * halves are easy to half-do — a day written up and never linked is a day
 * nobody finds, which is the same as not writing it.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const dir = path.join(repo, "docs/changelog");
const entries = async () =>
  (await fs.readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort();

describe("the changelog", () => {
  it("links every day from the index", async () => {
    const index = await fs.readFile(path.join(dir, "README.md"), "utf8");
    for (const entry of await entries()) {
      expect(index, `${entry} is not linked from docs/changelog/README.md`).toContain(`(${entry})`);
    }
  });

  it("links nothing that is not there", async () => {
    const index = await fs.readFile(path.join(dir, "README.md"), "utf8");
    const linked = [...index.matchAll(/\((\d{4}-\d{2}-\d{2}\.md)\)/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(0);
    expect([...new Set(linked)].sort()).toEqual(await entries());
  });

  // The generator's first duty is to leave written prose alone. It runs
  // unattended every night against a directory of finished pages, and a bug
  // here overwrites work with a commit dump.
  it("refuses to overwrite a day somebody wrote", async () => {
    const [first] = await entries();
    const day = first.replace(".md", "");
    const before = await fs.readFile(path.join(dir, first), "utf8");
    const said = execFileSync("node", ["scripts/changelog-day.mjs", day], {
      cwd: repo,
      encoding: "utf8",
      // A sync exec blocks the worker, so vitest's deadline cannot fire —
      // the child carries its own. See `canvas-board.test.ts` for the
      // 42-minute measurement that made this a rule.
      timeout: 60_000,
    });
    expect(said).toContain("already written");
    expect(await fs.readFile(path.join(dir, first), "utf8")).toBe(before);
  });

  it("writes nothing for a day nothing landed on", async () => {
    const said = execFileSync("node", ["scripts/changelog-day.mjs", "2001-01-01"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(said).toContain("nothing landed");
    expect(await entries()).not.toContain("2001-01-01.md");
  });

  it("runs after midnight where the people are, not where the runner is", async () => {
    const workflow = await fs.readFile(path.join(repo, ".github/workflows/changelog.yml"), "utf8");
    expect(workflow).toContain("scripts/changelog-day.mjs");
    // 08:03 UTC is past midnight on the US west coast in both halves of the
    // year; an earlier hour is yesterday's evening for five months of it.
    expect(workflow).toContain('cron: "3 8 * * *"');
  });
});
