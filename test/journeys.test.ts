import { readFileSync } from "node:fs";
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
const persona = read("../.agents/personas/journeys.md");
const workflow = read("../.github/workflows/journeys.yml");

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
    /* It must never touch anybody's canvases, and two runs must not collide. */
    expect(runner).toContain("ISOCAN_HOME: home");
    expect(runner).toMatch(/mkdtempSync\(path\.join\(tmpdir\(\), "isocan-journeys-"\)\)/);
    expect(runner).toContain("pickPort");
  });

  it("retries only a lost port, never a daemon that will not boot", () => {
    /* Retrying everything turns a real failure into four slow ones and a
       misleading message. */
    expect(runner).toMatch(/const raced = .*EADDRINUSE/);
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

describe("the journeys persona", () => {
  it("has no push-time goal, because it is a weekly walk", () => {
    /* `ratchet.mjs` runs every persona's goals on every push. A ninety-second
       browser walk there would be paid on every commit for a class of bug
       that does not need catching within the minute. */
    expect(persona).not.toMatch(/^goal:/m);
  });

  it("is scheduled regularly rather than often", () => {
    expect(persona).toMatch(/cron: \d+ \d+ \* \* \d/);
    expect(workflow).toMatch(/cron: "17 7 \* \* 1"/);
  });

  it("tells its reader to suspect the harness before reporting a bug", () => {
    expect(persona).toMatch(/harness could have caused it/i);
  });

  it("forbids weakening a journey to make it pass", () => {
    expect(persona).toMatch(/Do not weaken a journey/);
  });
});
