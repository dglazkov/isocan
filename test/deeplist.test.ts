import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEEP, FAST_SPAWNERS, audit, filteredRun, runningDeep, skippedLine, walksBinary } from "./deep.ts";

/**
 * **The lane's own guards, and they run both ways.**
 *
 * A list that excludes files is a list that can silently exclude nothing (a
 * typo) or silently exclude everything a rename left behind — and either way
 * the reader sees a green run. That is the first direction, and it was all
 * this file used to check.
 *
 * The second direction is the one sheep's `rings.test.ts` taught: a file that
 * GROWS a walk does not add itself, and until something reads the source and
 * asks the question independently, silence means "fast" for every file nobody
 * thought about. `walksBinary` is that reading, `FAST_SPAWNERS` is the answer
 * for every walker deliberately left in the fast lane, and the case below
 * fails when the two disagree. It found three misfiled files the first time it
 * ran, one of which `deep.ts`'s own header was holding up as an example.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));

/**
 * Every test file in the repository, the way vitest finds them — tracked and
 * not. `--others --exclude-standard` is what makes the guard useful while
 * somebody is writing the file: a brand-new walk is caught before it is
 * committed, rather than on the run after.
 */
const testFiles = (): string[] =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repo,
    encoding: "utf8",
    timeout: 30_000,
  })
    .split("\n")
    .filter((file) => /\.(test|spec)\.tsx?$/.test(file));

describe("the deep lane", () => {
  it("names files that exist — a typo would exclude nothing and look the same", () => {
    const named = [...DEEP.map((d) => d.file), ...FAST_SPAWNERS.map((f) => f.file)];
    const missing = named.filter((file) => !existsSync(path.join(repo, file)));
    expect(missing, "renamed or deleted; fix test/deep.ts").toEqual([]);
  });

  it("holds nothing under the ten-second rule it states", () => {
    const cheap = DEEP.filter((d) => d.secs < 10).map((d) => `${d.file} (${d.secs}s)`);
    expect(cheap, "fast enough for the fast lane — move it to FAST_SPAWNERS").toEqual([]);
  });

  it("keeps the fast walkers under the same line, from the other side", () => {
    const slow = FAST_SPAWNERS.filter((f) => f.secs >= 10).map((f) => `${f.file} (${f.secs}s)`);
    expect(slow, "past the line: move it into DEEP, or argue the rule in deep.ts").toEqual([]);
    expect(FAST_SPAWNERS.filter((f) => !f.why.trim()).map((f) => f.file)).toEqual([]);
  });

  it("names each file once, and never in both lanes", () => {
    expect(new Set(DEEP.map((d) => d.file)).size).toBe(DEEP.length);
    expect(new Set(FAST_SPAWNERS.map((f) => f.file)).size).toBe(FAST_SPAWNERS.length);
    const deep = new Set(DEEP.map((d) => d.file));
    expect(FAST_SPAWNERS.filter((f) => deep.has(f.file)).map((f) => f.file)).toEqual([]);
  });

  it("holds only files that walk the CLI — the rule, read from the source", () => {
    const wrong = audit(repo, [...DEEP.map((d) => d.file), ...FAST_SPAWNERS.map((f) => f.file)])
      .filter((row) => !row.walks)
      .map((row) => row.file);
    expect(wrong, "no longer spawns anything: take it out of test/deep.ts").toEqual([]);
  });

  it("leaves no walker in neither lane — the direction silence used to win", () => {
    const orphans = audit(repo, testFiles())
      .filter((row) => row.walks && row.declared === undefined)
      .map((row) => row.file);
    expect(
      orphans,
      "this file spawns the CLI and is in neither list. Time it in a deep run: " +
        "ten seconds or more goes in DEEP, less goes in FAST_SPAWNERS with a reason.",
    ).toEqual([]);
  });

  it("reads code and not comments — the way its own header would have fooled it", () => {
    // The fixture carries a `timeout:` it never runs under, because
    // `syncexec.test.ts` reads this file as text and cannot tell a quoted call
    // from a real one — the same false positive this guard has about itself,
    // one level over. Every real sync exec here has the deadline anyway, so
    // the fixture is the more honest for having it.
    const walk = 'execFileSync(process.execPath, [cliBin], { timeout: 30_000 }); const cliBin = "../bin/isocan.js";';
    expect(walksBinary(walk)).toBe(true);
    // A file writing ABOUT the walk. `deeplist.test.ts` itself is one of four.
    expect(walksBinary("// spawn() the bin/isocan.js binary\n/* npx too */\nconst x = 1;")).toBe(false);
    // A target with nothing that runs it: `packaging` asserts the bin field,
    // `onpath` and `upgrade` use "npx" as the name of an install kind.
    expect(walksBinary('expect(pkg.bin.isocan).toBe("packages/cli/bin/isocan.js");')).toBe(false);
    // A spawn with no target: spawning `git` is not what makes a file deep.
    expect(walksBinary('spawnSync("git", ["status"]);')).toBe(false);
    // Through a fixture beside it, which is how `rc.test.ts` reaches it.
    expect(walksBinary('import { run } from "./fixture.ts";', ['execFile("node", ["bin/isocan.js"])'])).toBe(true);
    const mcp = 'new StdioClientTransport({ args: ["design-partner-mcp.mjs"] }); client.callTool({ name: "cli", arguments: { args: ["ls"] } });';
    expect(walksBinary(mcp)).toBe(true);
    expect(walksBinary(mcp.replace('name: "cli"', 'name: "read_file"'))).toBe(false);
    expect(walksBinary(mcp.replace("design-partner-mcp.mjs", "another-server.mjs"))).toBe(false);
    expect(walksBinary(mcp.replace("new StdioClientTransport", "describeTransport"))).toBe(false);
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
