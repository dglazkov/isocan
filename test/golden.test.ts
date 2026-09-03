import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain module, shared with scripts/golden.mjs on purpose
import { fileChecks, loadSuite, matchTags, outerOf, visibleText } from "../scripts/lib/golden.mjs";

/**
 * **The golden suite's own test, browser-free.**
 *
 * Stage 3 of the eval plan says a task is a fixture, an ask and a grader, and
 * that the suite is versioned. This pins the shape, and runs the half of
 * `golden.mjs --selftest` that needs no browser: every reference answer
 * passes its file checks, and every untouched fixture fails at least one.
 * The screen checks (contrast, sideways scroll…) are grade.mjs's and run in
 * the nightly; a task may lean on them for the answer, but must ALSO fail
 * its fixture on a file check here, so a broken browser can never make the
 * suite look like it measures something it does not.
 */
interface Task {
  id: string;
  kind: string;
  fixture: string;
  answer: string;
  ask: string;
  type?: string;
  checks: { kind: string; names?: string[] }[];
  fixturePath: string;
  answerPath: string;
}
const suite = loadSuite() as { version: number; tasks: Task[] };

describe("the golden suite", () => {
  it("is twenty versioned tasks with distinct ids", () => {
    // Bumped whenever a task changes, so a comparison across time says which
    // suite it compared; `history` in tasks.json says why.
    expect(suite.version).toBe(2);
    expect(suite.tasks).toHaveLength(20);
    expect(new Set(suite.tasks.map((t) => t.id)).size).toBe(20);
  });

  it("is weighted the way the corpus is: revise and create first, then restyle and repair", () => {
    const by = (kind: string) => suite.tasks.filter((t) => t.kind === kind).length;
    expect(by("revise")).toBeGreaterThanOrEqual(5);
    expect(by("create")).toBeGreaterThanOrEqual(5);
    expect(by("restyle") + by("repair")).toBeGreaterThanOrEqual(4);
    // The kinds are the corpus's kinds, so a task can be read against the distribution.
    const known = new Set(["create", "revise", "restyle", "variation", "converge", "critique", "repair", "arrange", "document", "question", "orchestrate", "ops", "cancel", "social", "probe"]);
    for (const t of suite.tasks) expect(known.has(t.kind), `${t.id} kind ${t.kind}`).toBe(true);
  });

  it("has a fixture, an answer, an ask and at least one file check per task", () => {
    for (const t of suite.tasks) {
      expect(existsSync(t.fixturePath), `${t.id} fixture`).toBe(true);
      expect(existsSync(t.answerPath), `${t.id} answer`).toBe(true);
      expect(t.ask.length, `${t.id} ask`).toBeGreaterThan(8);
      expect(t.checks.filter((c) => c.kind !== "screen").length, `${t.id} file checks`).toBeGreaterThan(0);
      // Screen checks name only what grade.mjs has.
      const screen = t.checks.find((c) => c.kind === "screen");
      for (const name of screen?.names ?? []) {
        expect(["renders", "no contrast failures", "no stretched images", "no sideways scroll", "every control named", "targets ≥ 24px", "images have alt", "no greppable tells"], `${t.id}: ${name}`).toContain(name);
      }
    }
  });

  it("every reference answer passes its file checks", () => {
    for (const t of suite.tasks) {
      const rows = fileChecks(t, readFileSync(t.answerPath, "utf8"), readFileSync(t.fixturePath, "utf8"));
      const failed = rows.filter((r: { ok: boolean }) => !r.ok);
      expect(failed, `${t.id}: ${failed.map((r: { name: string; why: string }) => `${r.name} (${r.why})`).join("; ")}`).toEqual([]);
    }
  });

  it("every untouched fixture fails at least one file check — the task asks for something", () => {
    for (const t of suite.tasks) {
      const fixture = readFileSync(t.fixturePath, "utf8");
      const rows = fileChecks(t, fixture, fixture);
      expect(rows.some((r: { ok: boolean }) => !r.ok), `${t.id}: the fixture passes everything`).toBe(true);
    }
  });
});

describe("the file checks read HTML the way a person would", () => {
  const html = `<nav class="top"><a href="#a">Home</a></nav><main data-state="empty"><h1 id="t">No orders yet</h1><img alt="x" src="hero-2.png"><button aria-label="Add">+</button></main>`;
  it("matches tag, class, id and attribute selectors, one level deep", () => {
    expect(matchTags(html, "nav.top")).toHaveLength(1);
    expect(matchTags(html, "#t")).toHaveLength(1);
    expect(matchTags(html, "[data-state=empty]")).toHaveLength(1);
    expect(matchTags(html, "img[src*=hero-2]")).toHaveLength(1);
    expect(matchTags(html, "button[aria-label]")).toHaveLength(1);
    expect(matchTags(html, "details[open]")).toHaveLength(0);
  });
  it("walks to the matching close for an element, and reads visible words", () => {
    expect(outerOf(html, "nav")).toBe(`<nav class="top"><a href="#a">Home</a></nav>`);
    expect(outerOf(html, "img")).toBe(`<img alt="x" src="hero-2.png">`);
    expect(visibleText(html)).toBe("Home No orders yet +");
  });
});
