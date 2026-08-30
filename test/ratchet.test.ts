import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const script = read("../scripts/ratchet.mjs");
const workflow = read("../.github/workflows/review.yml");

/**
 * Review on push, mechanical half. The part of a review that can be CERTAIN
 * should not wait for the part that cannot — so the numbers are taken on every
 * push and the judgement pass stays on the nightly.
 */
describe("the push review", () => {
  it("says something and gates nothing", () => {
    /**
     * A check that goes red on hygiene is a check somebody turns off inside a
     * week, and then the numbers drift with nothing watching — worse than
     * never having had it. `release.yml` is the gate; this is the notice.
     */
    expect(workflow).toContain("|| true");
    expect(workflow).toContain("commits/${GITHUB_SHA}/comments");
    // Nothing in it may advance `green` or touch the release branch.
    expect(workflow).not.toContain("refs/heads/green");
    expect(workflow).not.toContain("npm run release");
  });

  it("runs no model", () => {
    // Running a persona's judgement on every push is the volume failure the
    // night shift research names: a morning of forty items turns sleep into a
    // queue.
    expect(workflow).not.toContain("claude");
    expect(workflow).not.toContain("ANTHROPIC_API_KEY");
  });

  it("builds before it measures a built artifact", () => {
    const before = workflow.slice(0, workflow.indexOf("Take every persona's numbers"));
    expect(before).toContain("npm run build");
  });

  it("keeps only the newest commit of a burst", () => {
    // Six pushes should produce one review of where the tree ended up, not six
    // of where it passed through.
    expect(workflow).toContain("cancel-in-progress: true");
  });

  it("passes the report through a file, not a shell string", () => {
    // It is multi-line and carries backticks. Interpolating that into a shell
    // is how a workflow ends up executing its own report.
    expect(workflow).toContain("/tmp/review.md");
    expect(workflow).not.toMatch(/body="\$\{\{ steps\.ratchet\.outputs/);
  });
});

describe("the ratchet script", () => {
  it("reads goals through the CLI, not with a parser of its own", () => {
    // A second reader is how the check comes to disagree with the personas it
    // is checking.
    expect(script).toContain('"--json", "persona", "ls"');
    expect(script).not.toContain("splitFrontMatter");
  });

  it("never reads an unrunnable command as a zero", () => {
    /**
     * "0 failures" and "nothing could be measured" look identical in a report
     * that does not separate them, and four instruments this week reported the
     * first while meaning the second.
     */
    expect(script).toContain("could not be run");
    expect(script).toContain("not a number");
  });

  it("is silent when nothing moved, so the notice means something", () => {
    expect(script).toMatch(/--quiet/);
    expect(script).toContain("every persona's numbers held");
  });

  it("exits 1 on a miss so a caller can branch, not so a build fails", () => {
    expect(script).toMatch(/process\.exit\(1\)/);
    expect(script).toContain("to SAY something, not whether to fail");
  });
});
