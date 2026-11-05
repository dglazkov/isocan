import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The journeys runner, guarded — because it is the one checker that cannot
 * be checked by the suite it exists to complete.**
 *
 * It closes a real gap: 2,300 tests read source, and source-reading cannot see
 * a header that collapsed to `display: block` or a reducer that stopped
 * stamping (that mutation passed the ENTIRE suite). But a browser walk has
 * many more ways to be quietly broken than a unit test, and this repo's
 * standing failure mode is an instrument reporting healthy while blind.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const runner = read("../scripts/journeys.mjs");
const daemonLib = read("../scripts/lib/daemon.mjs");
const frames = read("../scripts/frames.mjs");
const persona = read("../.agents/personas/journeys.md");
const workflow = read("../.github/workflows/journeys.yml");

const stepNamed = (name: string) => workflow.split(`- name: ${name}\n`)[1]?.split("\n      - ")[0] ?? "";
const shippedShell = (step: string) => step.split("run: |\n")[1]!.split("\n")
  .map((line) => line.replace(/^ {10}/, "")).join("\n").trim();

describe("the workflow reports unsuccessful runs", () => {
  // Execute the actual pipeline and verifier; replace only the browser walk.
  const shell = shippedShell(stepNamed("Walk them"));
  const clean = { version: 1, selected: ["pen"], complete: true, active: null, failing: 0,
    results: [{ name: "pen", ok: true, cleanupComplete: true }] };
  const failed = { ...clean, failing: 1, results: [{ name: "pen", ok: false, cleanupComplete: true }] };
  it.each([
    { name: "success", source: "console.log('1/1 journeys walked')", checkpoint: clean, runnerStatus: 0, verdict: "no" },
    { name: "failed journey", source: "console.log('FAIL  pen'); process.exit(1)", checkpoint: failed, runnerStatus: 1, verdict: "yes" },
    { name: "startup crash", source: "throw new Error('browser failed to boot')", runnerStatus: 1, verdict: "yes" },
    { name: "invalid selection", source: "console.error('unknown journey'); process.exit(2)", runnerStatus: 2, verdict: "yes" },
    { name: "teardown crash", source: "console.log('  ok  pen'); throw new Error('close failed')", checkpoint: { ...clean, complete: false }, runnerStatus: 1, verdict: "yes" },
    { name: "nonzero without FAIL", source: "process.exit(3)", checkpoint: clean, runnerStatus: 3, verdict: "yes" },
    { name: "failure text with a broken exit code", source: "console.log('FAIL  pen')", checkpoint: clean, runnerStatus: 0, verdict: "yes" },
    { name: "missing checkpoint despite exit zero", source: "console.log('1/1 journeys walked')", runnerStatus: 0, verdict: "yes" },
    { name: "incomplete checkpoint despite exit zero", source: "", checkpoint: { ...clean, complete: false }, runnerStatus: 0, verdict: "yes" },
    { name: "lost log from a failed tee", source: "console.log('1/1 journeys walked')", checkpoint: clean, runnerStatus: 0, verdict: "yes", brokenTee: true },
  ])("reports $name", ({ source, checkpoint, runnerStatus, verdict, ...options }) => {
    const dir = mkdtempSync(path.join(tmpdir(), "isocan-journey-report-"));
    try {
      mkdirSync(path.join(dir, "scripts/lib"), { recursive: true });
      mkdirSync(path.join(dir, "bin"));
      writeFileSync(path.join(dir, "scripts/lib/journey-progress.mjs"), read("../scripts/lib/journey-progress.mjs"));
      const save = checkpoint ? `import { writeFileSync } from 'node:fs'; writeFileSync(process.argv[process.argv.indexOf('--checkpoint') + 1], ${JSON.stringify(JSON.stringify(checkpoint))});\n` : "";
      writeFileSync(path.join(dir, "scripts/journeys.mjs"), save + source);
      if ("brokenTee" in options && options.brokenTee) {
        const tee = path.join(dir, "bin/tee");
        writeFileSync(tee, "#!/bin/bash\ncat >/dev/null\nexit 7\n"); chmodSync(tee, 0o755);
      }
      const output = path.join(dir, "outputs");
      const done = spawnSync("bash", ["-e", "-o", "pipefail", "-c", shell], {
        cwd: dir, encoding: "utf8", timeout: 10_000,
        env: { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, JOURNEY_ONLY: "", RUNNER_TEMP: dir, GITHUB_OUTPUT: output },
      });
      expect(done.error).toBeUndefined();
      expect(done.status, done.stdout + done.stderr).toBe(verdict === "yes" ? 1 : 0);
      expect(readFileSync(output, "utf8")).toBe(`failing=${verdict}\n`);
      expect(readFileSync(path.join(dir, "journeys.txt"), "utf8")).toContain(`Runner exit status: ${runnerStatus}`);
      if ("brokenTee" in options && options.brokenTee) expect(readFileSync(path.join(dir, "journeys.txt"), "utf8")).toContain("Log exit status: 7");
    } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });
});

describe("failure is recorded before optional network reporting", () => {
  it("fails the walk itself, then uploads partial evidence and bounds the failure-aware comment", () => {
    const walk = stepNamed("Walk them"), upload = stepNamed("Preserve the walk's evidence"), comment = stepNamed("Say so, on the commit it walked");
    expect(workflow).not.toContain("continue-on-error");
    expect(walk).toContain("exit 1");
    expect(workflow.indexOf("- name: Walk them")).toBeLessThan(workflow.indexOf("- name: Say so"));
    expect(upload).toContain("if: always()");
    expect(upload).toContain("timeout-minutes: 2");
    expect(upload).toContain("journeys.json"); expect(upload).toContain("journeys.txt");
    expect(comment).toContain("always() && (steps.walk.outcome == 'failure' || steps.walk.outcome == 'cancelled')");
    expect(comment).toContain("timeout-minutes: 1");
  });

  it("reserves reporting headroom inside the job even when every step uses its cap", () => {
    const limits = [...workflow.matchAll(/timeout-minutes: (\d+)/g)].map((match) => Number(match[1]));
    expect(limits[0]).toBe(45);
    expect(limits.slice(1).reduce((sum, n) => sum + n, 0)).toBeLessThan(limits[0]!);
    expect(stepNamed("Walk them")).toContain("timeout-minutes: 26");
  });

  it("a failed comment remains a failed reporting step, never a substitute for the verdict", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "isocan-journey-comment-"));
    try {
      writeFileSync(path.join(dir, "journeys.txt"), "FAIL  pen\n");
      writeFileSync(path.join(dir, "gh"), "#!/bin/bash\nexit 9\n"); chmodSync(path.join(dir, "gh"), 0o755);
      const done = spawnSync("bash", ["-e", "-o", "pipefail", "-c", shippedShell(stepNamed("Say so, on the commit it walked"))], {
        cwd: dir, encoding: "utf8", timeout: 2000,
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir, GITHUB_REPOSITORY: "acme/canvas", GITHUB_SHA: "test", GITHUB_RUN_ID: "123" },
      });
      expect(done.status).toBe(9);
      expect(readFileSync(path.join(dir, "journeys-comment.md"), "utf8")).toContain("FAIL  pen");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("the journeys runner", () => {
  it("can prove it is able to report a failure", () => {
    /* A checker that cannot fail proves nothing, and this one drives a
       browser through a daemon — a great deal of machinery to be silently
       broken. `--selftest` runs a journey that must fail and insists it was
       reported as one. */
    expect(runner).toContain("--selftest");
    expect(runner).toMatch(/SILENT: the selftest journey did not fail/);
  });

  it("runs the selftest in CI before believing a clean walk", () => {
    expect(workflow).toContain("node scripts/journeys.mjs --selftest");
    const selftestStep = workflow.indexOf("--selftest");
    const walkStep = workflow.indexOf("Walk them");
    expect(selftestStep).toBeLessThan(walkStep);
  });

  it("exits non-zero when a journey fails", () => {
    /* Otherwise the workflow's `grep` is the only thing standing between a
       broken app and a green tick. */
    expect(runner).toMatch(/process\.exit\(failed\.length > 0 \? 1 : 0\)/);
  });

  it("boots its own daemon, on its own port, in its own home", () => {
    /* It must never touch anybody's canvases, and two runs must not collide.
       The daemon itself is started by `lib/daemon.mjs` (14 Oct 2026), which
       picks the port and is handed the home. */
    expect(runner).toContain("ISOCAN_HOME: home");
    expect(runner).toMatch(/mkdtempSync\(path\.join\(tmpdir\(\), "isocan-journeys-"\)\)/);
    expect(runner).toContain('from "./lib/daemon.mjs"');
    expect(daemonLib).toContain("pickPort");
    expect(daemonLib).toContain("ISOCAN_HOME: home");
  });

  it("retries only a lost port, never a daemon that will not boot", () => {
    /* Retrying everything turns a real failure into four slow ones and a
       misleading message. */
    expect(daemonLib).toMatch(/const RACED = .*EADDRINUSE/);
    expect(daemonLib).toMatch(/if \(port !== null \|\| !RACED\.test\(String\(err\)\)\) throw err;/);
  });

  it("starts the daemon itself, never the `serve` launcher it cannot stop", () => {
    /* `isocan serve` starts a DETACHED `serve --foreground` and exits, so a
       script holding it holds nothing: `proc.kill()` reached a process that
       had already gone, and every run left its daemons behind (~290 on one
       Mac by 14 Oct 2026). `test/owned-daemon.test.ts` proves the helper's
       ownership by killing its owner; this keeps the scripts on the helper. */
    const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [name, source] of [["journeys.mjs", runner], ["frames.mjs", frames]] as const) {
      expect(code(source), name).not.toMatch(/\[\s*cli\s*,\s*"serve"\s*\]/);
      expect(source, name).toMatch(/from "\.\/lib\/daemon\.mjs"/);
    }
    expect(daemonLib).toMatch(/\[cli, "serve", "--foreground"\]/);
    expect(daemonLib).toContain("detached: true");
    expect(daemonLib).toContain("ISOCAN_DAEMON_GUARD_PID: String(process.pid)");
  });

  it("starts every Chrome stock and owned, never with the machine's policy extensions", () => {
    /* A managed Mac force-installs its extensions into every new profile, and
       while they start the page's lazy chunks fail (`net::ERR_FAILED`, a canvas
       that never opens). With a browser per journey that was 10 fresh rigs in
       30 (14 Oct 2026); with `--disable-extensions`, 0 in 30. Every browser the
       runner starts goes through `ownBrowser`, which also reaps it. */
    const code = runner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/await browser\(\{ args: \["--disable-extensions"\] \}\)/);
    expect(code.match(/await browser\(/g)).toHaveLength(1);
    expect(code).toMatch(/reapOnExit\(b\.pid\)/);
  });

  it("gives every journey a rig of its own and closes it before starting the next", async () => {
    // Keep the entry point wired to the same orchestration tested here. A
    // process-wide rig leaks state into subsequent journeys that pass alone.
    expect(runner).toMatch(/await walkJourneys\(list, \{\s*rig, checkpoint/);
    // @ts-expect-error — the shared runner is a plain .mjs module.
    const { walkJourneys } = await import("../scripts/lib/journey-progress.mjs");
    const events: string[] = [];
    let next = 0;
    await walkJourneys(["one", "two"].map((name) => ({ name, what: name,
      run: async (rig: { id: number }) => { events.push(`run ${name} ${rig.id}`); },
    })), { rig: async () => {
      const id = ++next; events.push(`start ${id}`);
      return { id, close: async () => { events.push(`close ${id}`); } };
    } });
    expect(events).toEqual(["start 1", "run one 1", "close 1", "start 2", "run two 2", "close 2"]);
  });

  it("presses where a person would, and checks the browser agrees", () => {
    /**
     * `element.click()` fires the handler directly and bypasses hit-testing,
     * so it succeeds on a control covered by an overlay, sized to zero, or
     * under `pointer-events: none`. A journey built on it cannot tell "this
     * works" from "this is there but nobody can press it".
     *
     * Proven rather than asserted: covering the page with a transparent sheet
     * makes `make-a-canvas` fail with "the Create button is covered by BODY —
     * a person could not press it".
     */
    expect(runner).toContain("elementFromPoint");
    expect(runner).toMatch(/covered by \$\{box\.over\}/);
    expect(runner).toMatch(/has no size/);
    // Containment ONE WAY. The reverse is true for every ancestor, so a
    // full-page overlay on <body> satisfied it and every covered control
    // passed — the bug this test exists to keep out.
    expect(runner).toMatch(/hit: el === top \|\| el\.contains\(top\)/);
    expect(runner).not.toMatch(/top\.contains\(el\)/);
  });

  it("does not fire handlers directly in a journey", () => {
    /* Comments may discuss `.click()`; the journeys may not use it. */
    const code = runner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.click\(\)/);
  });

  it("drives real input rather than synthetic events", () => {
    /* A hand-made PointerEvent is untrusted and creates no active pointer, so
       `setPointerCapture` throws — which reads exactly like the reported Pen
       crash and is the harness. This was not hypothetical: the first Pen
       journey failed that way and passed once it drove Chrome's own pipeline. */
    expect(runner).toContain("Input.dispatchMouseEvent");
  });

  it("waits for conditions, not for durations, when it matters", () => {
    /* `Page.navigate` resolves when navigation STARTS — evaluating against a
       page still on about:blank makes a relative fetch fail with "Failed to
       fetch", which reads as a daemon that is down. */
    expect(runner).toContain("Page.loadEventFired");
    expect(runner).toMatch(/function until\(/);
  });

  it("shares one headless browser with the graders", () => {
    /* Two copies of seventy lines of CDP setup is the mistake
       `docs/development.md` warns about — both correct the day they are made,
       with nothing to notice when one stops being. */
    expect(runner).toContain('from "./lib/browser.mjs"');
    expect(read("../scripts/grade.mjs")).toContain('from "./lib/browser.mjs"');
  });

  it("carries a journey for each bug the suite missed", () => {
    /* The point of the whole file. Each of these shipped green. */
    for (const name of [
      "make-a-canvas",
      "card-says-what-happened",
      "text-tool",
      "pen",
      "panels",
      "history-and-lens",
    ]) {
      expect(runner, name).toContain(`name: "${name}"`);
    }
  });

  it("never asserts that an animation visibly ran", () => {
    /* The harness's own limits: a headless page throttles rAF and background
       timers, so smooth scrolling is a no-op and a 90ms interval fires at
       ~400ms. Two findings that day looked like bugs and were this. */
    expect(runner).not.toMatch(/scrollY\s*[!=]==?\s*0|getAnimations\(\)/);
    expect(runner).toMatch(/requestAnimationFrame/); // named, as the warning
  });
});

describe("an editor chord means what it means on the runner's platform", () => {
  // Two journeys were written on a Mac with a raw ⌘A. The nightly runs on
  // Linux, where CodeMirror's Mod-a is Ctrl, so ⌘A selected nothing and the
  // replacement text was inserted at the caret — a DESIGN.md spliced into
  // itself, reported six nights running as a product bug (lesson #89).
  it("selects all through rig.selectAll, never a hard-coded ⌘A", () => {
    expect(runner).not.toMatch(/modifiers: 4, key: "a"/);
    expect(runner).toMatch(/selectAll: async[\s\S]{0,200}process\.platform === "darwin" \? 4 : 2/);
  });

  // The same mistake one layer up: since #44 (21 Sep) a label prints the
  // platform's spelling, so on the Linux runner the Undo button is titled
  // "Undo (Ctrl+Z)" and a selector naming ⌘ finds nothing.
  it("never selects an element by a ⌘ in its label", () => {
    expect(runner).not.toMatch(/\[(?:title|aria-label)[~^$*|]?="[^"]*⌘/);
  });
});

describe("the journeys persona", () => {
  it("has no push-time goal, however often it walks", () => {
    /* `ratchet.mjs` runs every persona's goals on every push. A ninety-second
       browser walk there would be paid on every commit for a class of bug
       that does not need catching within the minute. */
    expect(persona).not.toMatch(/^goal:/m);
  });

  it("is scheduled on a clock, not on a commit", () => {
    expect(persona).toMatch(/cron: \d+ \d+ \* \* [\d*]/);
    expect(workflow).toMatch(/cron: "17 7 \* \* \*"/);
  });

  it("tells its reader to suspect the harness before reporting a bug", () => {
    expect(persona).toMatch(/harness could have caused it/i);
  });

  it("forbids weakening a journey to make it pass", () => {
    expect(persona).toMatch(/Do not weaken a journey/);
  });
});
