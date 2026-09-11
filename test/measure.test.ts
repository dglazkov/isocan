import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error — a .mjs script with no types, imported for its reading on
// purpose: `op-types` and the isomorphism audit must mean one thing by
// "the operations".
import { operationMembers, operations } from "../scripts/isomorphism.mjs";

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
    // Digits included: `a11y-failures` is a metric, and a name pattern that
    // stopped at the "1" extracted "a" and reported a metric that does not
    // exist — found by this test on the day the metric was added.
    const known = new Set(
      [...source.matchAll(/^ {2}"([a-z0-9-]+)": \{$/gm)].map((m) => m[1]!),
    );
    expect(known.size).toBeGreaterThan(3);
    const dir = path.join(repo, PERSONA_DIR);
    for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith(".md"))) {
      const persona = parsePersona(await fs.readFile(path.join(dir, file), "utf8"), file);
      for (const goal of persona?.goals ?? []) {
        const named = /measure\.mjs\s+([a-z0-9-]+)/.exec(goal.measuredBy)?.[1];
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

/**
 * **"35 operations" was a counting bug** (9–11 Sep 2026).
 *
 * `op-types` counted every line shaped like `  | {` in `ops.ts`. `c8213d70`
 * reformatted `Placement` — a type an operation carries — into a multi-line
 * union, its first member opened with exactly that line, and the architect
 * filed "operations in the vocabulary is 35, past 33" two nights running
 * against a commit that added no operation. The selftest had passed the whole
 * time, because its mutation appended a new union beside `Operation`: it proved
 * the instrument counted unions and let everybody believe it counted
 * operations.
 */
describe("the op vocabulary is the Operation union, and nothing beside it", () => {
  /** `Placement` as `c8213d70` left it, byte for byte in the lines that matter,
   *  beside an `Operation` with three members — one of which carries a
   *  multi-line union of its own at a deeper indent. */
  const trap = [
    "export type Placement =",
    "  | {",
    "      x: number;",
    "      y: number;",
    "      resizedArea?: { width: number; height: number };",
    "    }",
    "  | { anchorItemId: string };",
    "",
    "export type Operation =",
    "  // ---- items ----",
    "  | {",
    '      type: "item.add";',
    "      placement: Placement;",
    "      face?:",
    "        | { kind: \"visual\" }",
    "        | { kind: \"source\" };",
    "    }",
    '  | { type: "item.move"; itemId: string; x: number; y: number }',
    "  | {",
    '      type: "trash.empty";',
    "    };",
    "",
    'export type OperationType = Operation["type"];',
    "",
  ].join("\n");

  it("counts the members of Operation, not every union in the file", () => {
    expect(operationMembers(trap)).toEqual(["item.add", "item.move", "trash.empty"]);
  });

  it("uses a fixture that still springs the trap it is named for", () => {
    // Otherwise the case above could pass because the fixture drifted away from
    // the shape that fooled the old reading, and prove nothing. The line-shape
    // count the metric used to take reads these three operations as five.
    expect((trap.match(/^ {2}\| \{/gm) ?? []).length).toBe(5);
  });

  it("moves when an operation is added, and not when a union is added beside it", () => {
    const withOp = trap.replace("export type Operation =\n", 'export type Operation =\n  | { type: "selftest.noop" }\n');
    expect(operationMembers(withOp)).toHaveLength(4);
    const withUnion = `${trap}\ntype Extra =\n  | { type: "selftest.noop" }\n  | { type: "selftest.other" };\n`;
    expect(operationMembers(withUnion)).toHaveLength(3);
  });

  it("is a broken instrument, not a zero, when the declaration is gone", () => {
    expect(() => operationMembers(trap.replace("type Operation =", "type Op ="))).toThrow(/no `type Operation`/);
  });

  it("is what the persona's command prints, and what the isomorphism audit lists", () => {
    const real = readFileSync(fileURLToPath(new URL("../packages/core/src/ops.ts", import.meta.url)), "utf8");
    const members = operationMembers(real);
    const printed = Number(
      execFileSync("node", [measure, "op-types"], { cwd: repo, encoding: "utf8", timeout: 60_000 }).trim(),
    );
    expect(printed).toBe(members.length);
    // Every member is dispatchable — a string `type` — and no two share one,
    // so the count and the audit's list are the same set said two ways.
    expect(members).not.toContain(null);
    expect(operations()).toHaveLength(members.length);
  });
});
