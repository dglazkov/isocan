import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **The instrument a persona's goal points at.**
 *
 * `docs/projects/personas/design.md` makes it a build rule rather than advice:
 * no persona may declare a goal whose measuring command has not been shown to
 * fail on something broken. Three instruments this week reported nothing and
 * were believed — a CI selftest spawning a Chrome path that does not exist on
 * the runner, a nightly printing "0 failing checks" above the failures it had
 * measured, and an event-loop monitor calling a 1500ms stall `0ms`.
 *
 * `--selftest` breaks each metric on purpose and checks the number moves. This
 * file is what keeps THAT honest: a selftest nothing invokes is the same hole
 * one level up, which is exactly how the graders went unrun for weeks.
 */
const repo = fileURLToPath(new URL("..", import.meta.url));
const measure = fileURLToPath(new URL("../scripts/measure.mjs", import.meta.url));
const source = readFileSync(measure, "utf8");

describe("every metric can fail", () => {
  it("declares a way to break each one — no exceptions, and the selftest refuses", () => {
    // The refusal is the interesting half: a metric with no `breakIt` is
    // REFUSED rather than skipped, because a skipped check reads as a passing
    // one in a list of passes.
    expect(source).toContain("no way to break it is declared");
    // And none is left declaring `null` — the escape hatch exists so the
    // selftest can REFUSE loudly, not so a metric can sit in it.
    expect(source).not.toMatch(/breakIt:\s*null/);
  });

  /**
   * **The selftest is NOT run from here, and that is a finding rather than a
   * gap.** Proving `contrast-failures` fires means breaking `docs/index.html`
   * for a few seconds — and the first version of this test did exactly that
   * while another worker was grading that same page, failing a neighbour it
   * had nothing to do with. A check that mutates the tree cannot run beside a
   * suite that reads it.
   *
   * So it is a CI step of its own, and what THIS file guards is that the step
   * still exists — the same hole, one level up, and precisely how
   * `grade.mjs --selftest` sat in CI for weeks without ever running.
   */
  it("is a step CI actually runs", () => {
    const yml = readFileSync(fileURLToPath(new URL("../.github/workflows/release.yml", import.meta.url)), "utf8");
    expect(yml).toContain("node scripts/measure.mjs --selftest");
    const step = yml.slice(yml.indexOf("Every persona metric still moves"));
    expect(step.slice(0, 300)).not.toContain("continue-on-error");
  });

  it("refuses to run when it would clobber uncommitted work", () => {
    expect(source).toContain("git status --porcelain".replace(/ /g, " ").slice(0, 0) + "refusing:");
    expect(source).toMatch(/status", "--porcelain"/);
  });
});

describe("a goal points at a metric that exists", () => {
  it("every `measured by` in every persona names a real one", async () => {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    const { parsePersona, PERSONA_DIR } = await import("@isocan/core");
    const known = new Set(
      [...source.matchAll(/^ {2}"([a-z-]+)": \{$/gm)].map((m) => m[1]!),
    );
    expect(known.size).toBeGreaterThan(3);
    const dir = path.join(repo, PERSONA_DIR);
    for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith(".md"))) {
      const persona = parsePersona(await fs.readFile(path.join(dir, file), "utf8"), file);
      for (const goal of persona?.goals ?? []) {
        const named = /measure\.mjs\s+([a-z-]+)/.exec(goal.measuredBy)?.[1];
        // Goals may point at other commands; this only checks the ones that
        // claim to use this instrument, so a typo cannot produce a goal whose
        // command exits 2 and is read as "nothing to report".
        if (named) {
          expect(known.has(named), `${file}: no metric called "${named}"`).toBe(true);
        }
      }
    }
  });
});
