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
  /**
   * The plumbing moved to `scripts/lib/browser.mjs` when the journeys runner
   * needed the same headless browser — one copy rather than two, for the
   * reason `docs/development.md` gives. These assertions follow it there: the
   * decision they protect is unchanged, and it now protects both callers at
   * once rather than only this one.
   */
  const grader = read("../scripts/lib/browser.mjs");

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

/**
 * **The rule the grader did not know, and the count that sent you hunting.**
 *
 * The front door failed twelve contrast checks and three target checks. The
 * twelve were three CSS rules — the report showed the same heading style three
 * times and called it three problems — and ALL THREE target failures were
 * false: ordinary prose links, which WCAG 2.5.8 explicitly exempts as "in a
 * sentence". Padding them to 24px would have broken the line rhythm to satisfy
 * a rule that was never about them.
 *
 * Both halves matter for the same reason. A grader that reports false failures
 * gets ignored, and a grader that reports true ones without saying WHERE gets
 * ignored a little more slowly. The night shift's own list of ways this fails
 * ends with the graders drifting into decoration.
 */
describe("the graders are actionable, and right", () => {
  const grader = read("../scripts/grade.mjs");

  it("knows WCAG 2.5.8's inline exception", () => {
    expect(grader).toContain("inSentence");
    // Close to the spec's words: it lays out inline, and the element holding
    // it has text of its own outside it.
    expect(grader).toMatch(/getComputedStyle\(el\)\.display !== "inline"/);
  });

  it("says which element failed, not just how many", () => {
    expect(grader).toContain("smallTargetDetail");
    // And the nightly's page prints them, or the detail is collected for
    // nobody — which is how `worstContrast` sat at three for weeks.
    expect(read("../scripts/grade-night.mjs")).toContain("smallTargetDetail");
  });
});

describe("a wait that cannot hang", () => {
  const grader = read("../scripts/grade.mjs");

  /**
   * Waiting for the page rather than for two seconds fixed a grader that read
   * a half-built document. Waiting for it FOREVER is a different bug in the
   * same family: measured under 16 spinners on 14 cores, one grader test sat
   * for **nineteen minutes** before vitest's own limit ended it, with nothing
   * said about what it had been waiting for.
   */
  it("puts a deadline on the page load, and says what it waited for", () => {
    expect(grader).toContain("withDeadline");
    expect(grader).toMatch(/withDeadline\(\s*loaded,\s*\d+/);
    expect(grader, "the failure must name the condition").toContain("never fired Page.loadEventFired");
  });

  it("clears the timer either way, so a fast load cannot hold the process open", () => {
    const fn = grader.slice(grader.indexOf("async function withDeadline"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("clearTimeout(timer)");
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

/**
 * **The grader may not wait for a duration.**
 *
 * It did, and it cost a red main. `Page.navigate` resolves when navigation
 * STARTS, and the render path followed it with `sleep(1400)` and `sleep(600)`
 * — a bet that a page would be loaded and settled in two seconds. A loaded CI
 * runner loses that bet, and loses it in the dangerous direction: the probe
 * measures a half-built document, finds fewer contrast failures than exist,
 * and the grader reports a page as HEALTHIER than it is. An instrument that
 * fails toward good news is worse than one that fails loudly.
 *
 * These are source assertions rather than behavioural ones, deliberately: the
 * behaviour they protect only misbehaves under load, which is the one
 * condition a test cannot reliably create. What CAN be pinned is the rule —
 * the render path waits on conditions the page declares, and on nothing else.
 */
describe("the grader waits for conditions, never for a clock", () => {
  const grader = read("../scripts/grade.mjs");
  /** The render path only: `browser()`'s startup poll and `close()`'s bounded
   * kill are deadlines on conditions, and are not what this is about. */
  const renderPath = grader.slice(grader.indexOf("async function gradeFile"));

  it("does not sleep between navigating and measuring", () => {
    expect(renderPath).not.toMatch(/await sleep\(/);
  });

  it("waits for the load event, and arms it before navigating", () => {
    // Armed after `navigate` is a race a fast load wins, and losing it hangs.
    expect(renderPath).toContain('once("Page.loadEventFired")');
    expect(renderPath.indexOf('once("Page.loadEventFired")')).toBeLessThan(
      renderPath.indexOf('send("Page.navigate"'),
    );
  });

  it("waits for fonts and a served paint before it measures", () => {
    // Contrast and target size are read off RENDERED text: a fallback font is
    // a different reading, and an unpainted frame is no reading at all.
    expect(renderPath).toContain("document.fonts.ready");
    expect(renderPath).toMatch(/requestAnimationFrame\(\(\) => requestAnimationFrame/);
  });

  it("lets Chrome choose its own debugging port", () => {
    // Reads the shared plumbing, where the spawn now lives.
    const grader = read("../scripts/lib/browser.mjs");
    // `9500 + (pid % 400)` collided two ways: two graders 400 pids apart, and
    // a Chrome left behind by an aborted run still holding the port — where
    // the next grader would attach to somebody else's browser and drive it.
    //
    // Comments stripped first, the way the hard-coded-path guard above does
    // it: the doc that EXPLAINS the old formula names it, and a guard that
    // cannot tell prose from code fails on its own explanation.
    const code = grader.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("--remote-debugging-port=0");
    expect(code).toContain("DevToolsActivePort");
    expect(code).not.toMatch(/9500 \+/);
  });
});

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

  /**
   * The front door is the page the graders were pointed at first, and the one
   * whose failures argued for pointing them anywhere. It passes now; this is
   * what stops it drifting back while nobody is reading the nightly.
   */
  it("the front door passes every check", () => {
    const grader = fileURLToPath(new URL("../scripts/grade.mjs", import.meta.url));
    const page = fileURLToPath(new URL("../docs/index.html", import.meta.url));
    const out = JSON.parse(
      execFileSync("node", [grader, "--file", page, "--json"], { encoding: "utf8" }),
    ) as Array<{ checks: Record<string, boolean> }>;
    const failed = Object.entries(out[0]!.checks).filter(([, ok]) => !ok).map(([n]) => n);
    expect(failed).toEqual([]);
  }, 120_000);
});
