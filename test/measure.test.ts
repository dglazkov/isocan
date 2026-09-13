import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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
 * **A guard's failure message names a command, and a named command is a
 * checkable claim.**
 *
 * `test/copied-rules.test.ts` has ended its failure with *"Which ones: node
 * scripts/measure.mjs copied-rules --names"* since the day it was written.
 * The flag was dispatched by an `if` on one metric's name —
 * `argv[0] === "unused-exports"` — so that command fell through to the count
 * and exited 0. Somebody reading the line at the moment the guard reddened
 * their commit got back the number the same message had just printed them.
 * `undocumented-exports` carried the identical dead instruction.
 *
 * Nothing was wrong when either line was written; both went stale because a
 * third metric grew the flag and the dispatch did not. That is the shape the
 * reviewer persona exists for, and a comment cannot be held to it by another
 * comment — so every `--names` any guard hands somebody is RUN here. These
 * instructions are read at exactly one moment: when the reader is already
 * stuck, and least able to discover that the advice is fiction.
 */
describe("`--names` is a flag the script really has, wherever a guard promises it", () => {
  /** Every `measure.mjs <metric> --names` this repo tells somebody to run. */
  const asked = new Set<string>();
  for (const rel of ["../test/", "../.agents/personas/"]) {
    const dir = new URL(rel, import.meta.url);
    for (const file of readdirSync(dir).filter((f) => /\.(ts|md)$/.test(f))) {
      const src = readFileSync(new URL(file, dir), "utf8");
      for (const m of src.matchAll(/measure\.mjs ([a-z0-9-]+) --names/g)) asked.add(m[1]!);
    }
  }

  it("is promised by the guards this test believes it is reading", () => {
    // Otherwise a drifted regex finds nothing and the `it.each` below passes by
    // running nothing at all — a green check for an empty list, which is the
    // same silence one level up.
    expect(asked.has("copied-rules"), "copied-rules.test.ts no longer names the flag").toBe(true);
    expect(asked.size).toBeGreaterThanOrEqual(3);
  });

  it.each([...asked])("`measure.mjs %s --names` runs, and answers with more than the count", (metric) => {
    // execFileSync throws on a non-zero exit, so "the script accepts it" is
    // asserted by getting here at all.
    const opts = { cwd: repo, encoding: "utf8" as const, timeout: 120_000 };
    const named = execFileSync("node", [measure, metric, "--names"], opts).trim();
    const count = execFileSync("node", [measure, metric], opts).trim();
    expect(named, `\`${metric} --names\` printed the count and nothing else`).not.toBe(count);
    expect(named, `\`${metric} --names\` printed a bare number`).not.toMatch(/^\d+$/);
  }, 120_000);

  /**
   * **The list and the number come from one scan**, which is `lessons.md` #5
   * applied inside a single metric: a `--names` that walked the sheet
   * separately could print a set whose size is not the number the guard failed
   * on, and the reader would have no way to tell which of the two was lying.
   */
  it("prints the copied bodies, who declared each, and who repeats it — adding up to the count", () => {
    const opts = { cwd: repo, encoding: "utf8" as const, timeout: 120_000 };
    const out = execFileSync("node", [measure, "copied-rules", "--names"], opts);
    const count = Number(execFileSync("node", [measure, "copied-rules"], opts).trim());

    const perBody = [...out.matchAll(/^\S.*?  (\d+) cop(?:y|ies)$/gm)].map((m) => Number(m[1]));
    expect(perBody.length, "no copied bodies printed").toBeGreaterThan(0);
    expect(perBody.reduce((a, b) => a + b, 0)).toBe(count);
    // Biggest family first: five selectors agreeing is a vocabulary asking to
    // be named, two is usually one rule written twice, and the reader should
    // meet them in that order.
    expect(perBody).toEqual([...perBody].sort((a, b) => b - a));

    // The body itself, under the selector — "is this one thing written twice,
    // or two things that agree?" cannot be answered from selector names alone.
    expect(out).toMatch(/\n {4}[a-z-]+: [^\n]*;/);

    // And every selector it names is one somebody can go and find. Comma
    // selectors are skipped: those are printed with their commas normalised and
    // would not match the sheet byte for byte.
    const css = readFileSync(new URL("../packages/web/src/styles.css", import.meta.url), "utf8");
    const selectors = [
      ...[...out.matchAll(/^(\S.*?)  \d+ cop(?:y|ies)$/gm)].map((m) => m[1]!),
      ...[...out.matchAll(/^ {4}repeated by {2}(.+)$/gm)].map((m) => m[1]!),
    ].filter((s) => !s.includes(","));
    expect(selectors.length).toBeGreaterThan(10);
    for (const sel of selectors) {
      expect(css, `"${sel}" is printed as a selector but is not in the sheet`).toContain(sel);
    }
  }, 120_000);
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
