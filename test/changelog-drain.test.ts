import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — a plain .mjs script, imported for its two pure halves.
import { FLOOR_DAYS, drainPlan, indexWithDraftRow } from "../scripts/changelog-drain.mjs";

/**
 * **The changelog queue drains itself** (AGENTS.md, "The night shift's pull
 * requests"). The rule was a paragraph for weeks and a 22 Sep draft sat open
 * five days; these hold the program that replaced the paragraph.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const NOW = new Date("2026-09-27T09:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const pr = (over: Record<string, unknown> = {}) => ({
  number: 1,
  headRefName: "changelog/2026-09-20",
  author: { login: "app/github-actions" },
  createdAt: ago(1),
  files: [{ path: "docs/changelog/2026-09-20.md" }],
  ...over,
});
type Step = { act: string; why: string };
const act = (p: ReturnType<typeof pr>, onMain: string[] = []) => (drainPlan([p], onMain, NOW) as Step[])[0]!;

describe("drainPlan", () => {
  it("waits for a writer, then merges what stands after the floor", () => {
    expect(act(pr({ createdAt: ago(FLOOR_DAYS - 0.1) })).act).toBe("wait");
    expect(act(pr({ createdAt: ago(FLOOR_DAYS) })).act).toBe("merge");
  });

  it("closes its own PR when somebody already wrote the day on main — however young the PR", () => {
    expect(act(pr({ createdAt: ago(0.1) }), ["2026-09-20"])).toMatchObject({ act: "close", why: "docs/changelog/2026-09-20.md is already on main" });
  });

  it("touches only the workflow's own changelog PRs, and only a changelog-only diff", () => {
    expect(act(pr({ author: { login: "acme-person" }, createdAt: ago(9) })).act).toBe("leave");
    expect(act(pr({ headRefName: "personas/2026-09-20", createdAt: ago(9) })).act).toBe("leave");
    expect(act(pr({ files: [{ path: "docs/changelog/2026-09-20.md" }, { path: "package.json" }], createdAt: ago(9) })).act).toBe("leave");
    expect(act(pr({ files: [], createdAt: ago(9) })).act).toBe("leave");
    // A page by hand on main does not license closing a PR that is not the workflow's.
    expect(act(pr({ author: { login: "acme-person" } }), ["2026-09-20"]).act).toBe("leave");
  });
});

describe("indexWithDraftRow", () => {
  const index = [
    "| Day | | What happened |",
    "| --- | --- | --- |",
    "| **[26 Sep](2026-09-26.md)** | Newer | … |",
    "| **[21 Sep](2026-09-21.md)** | Older | … |",
    "",
  ].join("\n");

  it("places a draft's row by date, newest at the top, and says it is a draft", () => {
    const out = indexWithDraftRow(index, "2026-09-22").split("\n");
    expect(out[3]).toBe("| **[22 Sep](2026-09-22.md)** | *Draft* | Not written up yet: the day's commits, quoted in full. Whoever writes the entry replaces this row. |");
    expect(out[2]).toContain("26 Sep");
    expect(out[4]).toContain("21 Sep");
    expect(indexWithDraftRow(index, "2026-09-30").split("\n")[2]).toContain("(2026-09-30.md)");
    expect(indexWithDraftRow(index, "2026-09-01").split("\n")[4]).toContain("(2026-09-01.md)");
  });

  it("leaves a day already linked alone — a written entry brings its own row", () => {
    expect(indexWithDraftRow(index, "2026-09-21")).toBe(index);
  });

  it("reads the real index", async () => {
    const real = await fs.readFile(path.join(repo, "docs/changelog/README.md"), "utf8");
    const out = indexWithDraftRow(real, "2001-01-01");
    expect(out.split("\n").length).toBe(real.split("\n").length + 1);
    expect(out).toContain("(2001-01-01.md)");
  });
});

describe("the workflow", () => {
  it("drains every night, whether or not the day had commits", async () => {
    const workflow = await fs.readFile(path.join(repo, ".github/workflows/changelog.yml"), "utf8");
    const step = workflow.slice(workflow.indexOf("- name: Drain the queue"));
    expect(step).toContain("node scripts/changelog-drain.mjs");
    // The gather step skips the rest on a quiet day; the drain must not be skipped with it.
    expect(step.split(/\n\s*- name:/)[0]).not.toContain("steps.gather.outputs.day");
  });
});
