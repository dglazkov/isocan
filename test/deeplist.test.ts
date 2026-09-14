import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEEP, filteredRun, runningDeep, skippedLine } from "./deep.ts";

/**
 * **The lane's own guards.** A list that excludes files is a list that can
 * silently exclude nothing (a typo) or silently exclude everything a rename
 * left behind — and either way the reader sees a green run.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));

describe("the deep lane", () => {
  it("names files that exist — a typo would exclude nothing and look the same", () => {
    const missing = DEEP.filter((d) => !existsSync(path.join(repo, d.file))).map((d) => d.file);
    expect(missing, "renamed or deleted; fix test/deep.ts").toEqual([]);
  });

  it("holds nothing under the ten-second rule it states", () => {
    const cheap = DEEP.filter((d) => d.secs < 10).map((d) => `${d.file} (${d.secs}s)`);
    expect(cheap, "fast enough for the fast lane — take it out of deep.ts").toEqual([]);
  });

  it("names each file once", () => {
    const seen = new Set(DEEP.map((d) => d.file));
    expect(seen.size).toBe(DEEP.length);
  });

  it("holds only files that spawn real processes — the rule the list states", async () => {
    const { promises: fs } = await import("node:fs");
    /* Through its own text or through a fixture beside it: `rc.test.ts` became
       three files over two fixture modules when it was de-flaked, and a rule
       that only reads the test file would have called the result a mistake. */
    const drivesBinary = async (file: string): Promise<boolean> => {
      const body = await fs.readFile(path.join(repo, file), "utf8");
      if (/bin\/isocan\.js|canvas-board\.mjs|\bnpx\b/.test(body)) return true;
      const dir = path.dirname(file);
      for (const [, rel] of body.matchAll(/from "(\.\/[^"]+)"/g)) {
        const sibling = path.join(dir, rel);
        const text = await fs.readFile(path.join(repo, sibling), "utf8").catch(() => "");
        if (/bin\/isocan\.js/.test(text)) return true;
      }
      return false;
    };
    const wrong: string[] = [];
    for (const d of DEEP) if (!(await drivesBinary(d.file))) wrong.push(d.file);
    expect(wrong, "not a CLI walk: if it is slow for another reason, say so in deep.ts").toEqual([]);
  });

  it("is EMPTY of exclusions when CI's anti-skip switch is set", () => {
    // The switch exists so the release run cannot skip. If `runningDeep` ever
    // stopped reading it, the gate would quietly become the fast lane.
    expect(runningDeep({ ISOCAN_REQUIRE_DEEP: "1" })).toBe(true);
    expect(runningDeep({ ISOCAN_DEEP: "1" })).toBe(true);
    expect(runningDeep({})).toBe(false);
  });

  it("does not narrow a run that names a file — the green-for-nothing trap", () => {
    expect(filteredRun(["packages/cli/test/pass.test.ts"])).toBe(true);
    expect(filteredRun(["-t", "some name"])).toBe(false);
    expect(filteredRun([])).toBe(false);
    // And the two together: naming a deep file is enough, no variable needed.
    expect(runningDeep({})).toBe(filteredRun());
  });

  it("says what it skipped, with the command that does not", () => {
    expect(skippedLine()).toMatch(/npm run test:deep/);
    expect(skippedLine()).toMatch(new RegExp(`${DEEP.length} files`));
  });
});
