import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runFindings, tallyOutcomes } from "@isocan/core";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const runner = read("../scripts/persona-run.mjs");
const workflow = read("../.github/workflows/persona.yml");

/**
 * Step 4 of `docs/projects/personas/design.md` — the night shift's step 2:
 * *"one agent, one canvas, posts one summary. No changes at all. Proves the
 * ritual before trusting it with work."*
 */
describe("a persona run changes nothing", () => {
  it("may not edit the persona, and checks that it did not", () => {
    /**
     * The rule that matters most: **a runner that can edit its own goal can
     * pass by lowering the bar.** Checked against a snapshot of the files
     * taken before the run — not `git status`, which was the first version
     * and could not tell "the runner changed this" from "this was already
     * edited", and duly accused the runner of somebody else's change.
     */
    expect(runner).toContain("snapshotPersonas");
    expect(runner).toMatch(/const before = snapshotPersonas\(\);/);
    expect(runner).toMatch(/const after = snapshotPersonas\(\);/);
    expect(runner).toContain("the run modified a persona, which it must never do");
    // And nothing in it writes into the persona directory.
    const code = runner.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/writeFileSync\([^)]*PERSONA_DIR/);
  });

  it("reads personas through the CLI, so there is one parser", () => {
    // `@isocan/core` is TypeScript and this is a plain script, so the tempting
    // shortcut is a second little front-matter reader — and then one persona
    // says two things depending on who asked.
    expect(runner).toMatch(/--json persona ls/);
    expect(runner).not.toContain("splitFrontMatter");
  });

  it("never reads a broken instrument as a zero", () => {
    /**
     * "0 contrast failures" and "nothing could be measured" look identical in
     * a report that does not separate them, and this week produced three
     * instruments that reported the first while meaning the second.
     */
    expect(runner).toContain("instrument broken");
    expect(runner).toContain("expected a number on stdout");
  });

  it("fails on a broken instrument and NOT on a missed goal", () => {
    // A page that goes red every morning trains everybody to stop looking, so
    // a missed goal is news. A number nobody could take is different: it must
    // never be filed as fine.
    expect(runner).toMatch(/process\.exit\(brokenTotal > 0 \? 1 : 0\)/);
  });
});

describe("the nightly", () => {
  it("is scheduled, and opens a pull request rather than pushing", () => {
    expect(workflow).toContain("cron:");
    expect(workflow).toContain("gh pr create");
    expect(workflow, "a machine must not write into main every night").not.toMatch(
      /git push[^\n]*origin main/,
    );
  });

  it("builds before it measures", () => {
    // The goals point at commands that grade a page in a browser and run
    // eslint; both need the workspace installed and built.
    const steps = workflow.indexOf("Take each persona's numbers");
    expect(workflow.slice(0, steps)).toContain("npm ci");
    expect(workflow.slice(0, steps)).toContain("npm run build");
  });
});

/**
 * Step 5: *"a finding is accepted, rejected, or unanswered. Still no score,
 * just the column."*
 */
describe("what a run found, and what was decided", () => {
  const page = (rows: string) =>
    `# p — 2026-08-29\n\n## Findings\n\n| Finding | Outcome |\n| --- | --- |\n${rows}\n`;

  it("reads the three words out of the page itself", () => {
    const found = runFindings(
      page("| contrast is 3, past 0 | accepted |\n| targets are small | rejected |\n| a third | unanswered |"),
    );
    expect(found.map((f) => f.outcome)).toEqual(["accepted", "rejected", "unanswered"]);
    expect(found[0]!.finding).toBe("contrast is 3, past 0");
  });

  it("treats anything else as undecided rather than guessing", () => {
    // A cell somebody typed a sentence into is a finding nobody has decided.
    expect(runFindings(page("| x | maybe next week |"))[0]!.outcome).toBe("unanswered");
    expect(runFindings(page("| x |  |"))[0]!.outcome).toBe("unanswered");
  });

  it("skips the header and the empty-table placeholder", () => {
    expect(runFindings(page("| — | — |"))).toEqual([]);
    expect(runFindings("no findings section here")).toEqual([]);
  });

  it("stops at the next heading, so a later section is not read as findings", () => {
    const withTail = page("| real | accepted |") + "\n## Notes\n\n| not | a finding |\n";
    expect(runFindings(withTail)).toHaveLength(1);
  });

  it("counts, and computes no ratio", () => {
    const tally = tallyOutcomes(runFindings(page("| a | accepted |\n| b | unanswered |")));
    expect(tally).toEqual({ accepted: 1, rejected: 0, unanswered: 1 });
    // An accept rate over five findings is noise; the ratio is somebody's to
    // compute when there is enough to argue about.
    expect(Object.keys(tally)).not.toContain("rate");
  });
});
