import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **The guard for a check that was not one.**
 *
 * `release.yml` ran `grade.mjs --selftest` on every commit for weeks under a
 * comment reading "Chrome is on the GitHub runner already". True — at
 * `/usr/bin/google-chrome`. The script spawned the macOS-only path, failed
 * with `ENOENT` every single time, and `continue-on-error: true` turned that
 * into a green checkmark. **The check that exists to stop us believing a
 * silent zero was itself a silent zero**, in the exact place we pointed at
 * when we said the graders were verified. Found by reading a real run's log
 * while wiring the nightly.
 *
 * Three things have to stay true, and each one is a way this came back:
 * Chrome is looked for in more than one place; the selftest is a real gate in
 * both workflows that run it; and `--json` carries its own verdicts, because
 * the nightly re-derived them by hand and reported "0 failing checks" on a
 * page whose contrast failures it printed three lines below.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("the graders can actually start", () => {
  const grader = read("../scripts/grade.mjs");

  it("looks for Chrome in more than one place, on both platforms", () => {
    expect(grader).toContain("CHROME_PATH");
    expect(grader).toContain("/usr/bin/google-chrome");
    expect(grader).toContain("/Applications/Google Chrome.app");
  });

  it("never spawns a hard-coded browser path", () => {
    // The shape of the bug: one literal, passed straight to spawn.
    const code = grader.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/spawn\(chromeOrDie\(\)/);
    expect(code).not.toMatch(/spawn\(\s*["'`]\//);
  });

  it("says what it looked for rather than throwing a bare ENOENT", () => {
    // The whole failure above was somebody reading an error that did not name
    // its own cause — inside a step allowed to fail.
    expect(grader).toContain("no Chrome found");
  });
});

describe("the selftest is a gate", () => {
  it("release.yml does not let it fail quietly", () => {
    const yml = read("../.github/workflows/release.yml");
    const step = yml.slice(yml.indexOf("The graders still measure something"));
    expect(step.slice(0, 400)).not.toContain("continue-on-error");
  });

  it("the nightly runs it before it grades anything", () => {
    const night = read("../scripts/grade-night.mjs");
    expect(night).toContain("--selftest");
    // And reports NOTHING when it fails, rather than a page of zeroes.
    expect(night).toContain("did not pass their own selftest");
  });

  it("the nightly writes to no canvas", () => {
    // Step 1 of the night shift measures; it does not repair. A grader with an
    // interest in what it finds is a grader nobody can read.
    const night = read("../scripts/grade-night.mjs");
    const code = night.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const write of ['"comment"', '"item"', "sendOp", '"add"', '"save"']) {
      expect(code).not.toContain(write);
    }
  });
});

/**
 * The one case here that needs a real browser. It skips where there is none —
 * LOUDLY, the way the cloud suites do — because `npm test` is what moves
 * `green` and a laptop without Chrome is not a broken commit. CI has Chrome
 * and does not skip, which is where this has to hold.
 */
const chrome = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].some((p) => p && existsSync(p));
if (!chrome) console.warn("graders: no Chrome — the --json verdict case was NOT checked");

describe.skipIf(!chrome)("--json carries its own verdicts", () => {
  it("every reading comes with the check it decides", () => {
    // Measured, not asserted about the source: the nightly consumed `checks`
    // and got zeroes because the field did not exist.
    const grader = fileURLToPath(new URL("../scripts/grade.mjs", import.meta.url));
    const fixture = fileURLToPath(new URL("./fixtures/deliberately-bad.html", import.meta.url));
    const out = JSON.parse(
      execFileSync("node", [grader, "--file", fixture, "--json"], { encoding: "utf8" }),
    ) as Array<{ checks?: Record<string, boolean> }>;
    expect(out).toHaveLength(1);
    const checks = out[0]!.checks;
    expect(checks).toBeDefined();
    // The fixture is built to break everything, so the verdicts must say so —
    // a `checks` object of all-true here would be the silent zero again.
    expect(Object.values(checks!).filter((ok) => !ok).length).toBeGreaterThan(4);
  }, 120_000);
});
