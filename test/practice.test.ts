import { describe, expect, it } from "vitest";
import { frontMatterFields, splitFrontMatter } from "@isocan/core";
import {
  assemble,
  changelogHoles,
  commitStats,
  deepCount,
  deepCountsDisagree,
  doneButOpen,
  frontVsPhases,
  gradedCount,
  indexDisagreements,
  issuesNamed,
  loopUntriaged,
  missingStatusLines,
  nonVocabularyStatus,
  numberWord,
  personaUnanswered,
  personasWithoutGoal,
  releaseStats,
  renderPage,
  sortRows,
  stalePRs,
  stalePhases,
  staleInstruments,
  unindexedResearch,
  unlabelled,
  unnamedIssues,
  untrackedSources,
  verifyQueue,
  withWas,
  worsened,
  row,
  // @ts-expect-error plain Node module, used by the nightly script too
} from "../scripts/lib/practice.mjs";

/**
 * **The practice page's checks, each against a fixture** (practice phase 0).
 *
 * Every check is a pure function of plain inputs, so each one is shown to
 * fire on a synthetic tree that has the leak and to stay quiet on one that
 * does not — a check that only ever reads the real repository would pass just
 * as happily if it always returned nothing. All names are made up ("Acme").
 */

const DAY = "2026-10-02";

const phases = (...words: (string | null)[]) =>
  words.map((w, i) => `## Phase ${i} — Acme step\n\n${w ? `**Status: ${w}.** It holds.\n` : "Words.\n"}`).join("\n");

const index = (rows: [string, string][]) =>
  ["| Project | What it is | Where it stands |", "| --- | --- | --- |", ...rows.map(([n, cell]) => `| [${n}](${n}/) | Acme work. | ${cell} |`)].join("\n");

describe("records", () => {
  it("flags an index cell whose lead contradicts front matter, and only its lead", () => {
    const text = index([
      ["acme-a", "**Designed 1 Sep, unbuilt.** Phase 0 is next."],
      ["acme-b", "**All four phases closed 3 Sep.** Done."],
      ["acme-c", "Phases 1–5 built on branch `acme-c`; record in phases.md."],
      ["acme-d", "**Phases 0–3 built.** Phase 4 is next."],
      ["acme-e", "**Built, all phases CLOSED.** Unbuilt follow-ups are listed further on."],
    ]);
    const status = new Map([
      ["acme-a", "partial"],
      ["acme-b", "partial"],
      ["acme-c", "built"],
      ["acme-d", "partial"],
      ["acme-e", "built"],
    ]);
    const found = indexDisagreements(text, status).map((o: { what: string }) => o.what);
    expect(found).toEqual(["acme-a", "acme-b", "acme-c"]);
  });

  it("is quiet when the index agrees", () => {
    const text = index([["acme", "**Designed 1 Sep, unbuilt.**"]]);
    expect(indexDisagreements(text, new Map([["acme", "designed"]]))).toEqual([]);
  });

  it("finds phases files with Phase headings and no Status line", () => {
    const files = [
      { path: "docs/projects/acme/phases.md", text: phases(null, null) },
      { path: "docs/projects/acme-ok/phases.md", text: phases("CLOSED", "NOT STARTED") },
      { path: "docs/projects/acme-none/phases.md", text: "# No phases here\n" },
    ];
    expect(missingStatusLines(files).map((o: { what: string }) => o.what)).toEqual(["docs/projects/acme/phases.md"]);
  });

  it("counts every Status word outside the vocabulary", () => {
    const files = [
      { path: "a.md", text: phases("DONE", "CLOSED", "DONE") },
      { path: "b.md", text: phases("PART-DONE", "RETIRED", "NOT STARTED") },
    ];
    expect(nonVocabularyStatus(files)).toHaveLength(2);
    expect(nonVocabularyStatus(files.slice(1))).toEqual([]);
  });

  it("holds front matter to the phases in both directions", () => {
    const out = frontVsPhases([
      { name: "acme-shut", status: "partial", phases: phases("CLOSED", "RETIRED") },
      { name: "acme-early", status: "built", phases: phases("CLOSED", "PART-DONE") },
      { name: "acme-ok", status: "built", phases: phases("CLOSED", "CLOSED") },
      { name: "acme-ok2", status: "partial", phases: phases("CLOSED", "NOT STARTED") },
      { name: "acme-done-word", status: "partial", phases: phases("DONE") },
    ]);
    expect(out.map((o: { what: string }) => o.what)).toEqual(["acme-shut", "acme-early"]);
  });

  it("finds research notes the index never names", () => {
    const readme = "| 2026-09-01 | [Acme](2026-09-01-acme.md) | found |";
    expect(unindexedResearch(["2026-09-01-acme.md", "2026-09-02-widget.md", "README.md"], readme)).toEqual([
      { what: "docs/research/2026-09-02-widget.md" },
    ]);
  });

  it("finds changelog days with commits and no page, and drafts, inside the window only", () => {
    const commitsByDay = new Map([
      ["2026-09-22", 19],
      ["2026-09-23", 4],
      ["2026-09-24", 0],
      ["2026-08-01", 9], // outside the 30 days
      [DAY, 3], // tonight's is not owed yet
    ]);
    const pages = new Map([
      ["2026-09-23", "# written"],
      ["2026-09-08", "<!-- draft -->\n# draft"],
    ]);
    const holes = changelogHoles({ commitsByDay, pages, day: DAY });
    expect(holes.map((h: { what: string }) => h.what)).toEqual(["docs/changelog/2026-09-08.md", "docs/changelog/2026-09-22.md"]);
    expect(changelogHoles({ commitsByDay: new Map([["2026-09-23", 4]]), pages, day: DAY })).toHaveLength(1);
  });
});

describe("issues", () => {
  const open = [
    { number: 7, title: "Acme named", labels: [{ name: "acme" }] },
    { number: 8, title: "Acme orphan", labels: [] },
    { number: 9, title: "Acme in front matter", labels: [] },
  ];

  it("reads #N, issue: N and /issues/N, and not anchors or entities", () => {
    expect([...issuesNamed("see #7 and [x](https://github.com/acme/acme/issues/12)\nissue: 9\n&#8217; a/#5")].sort()).toEqual([12, 7, 9]);
  });

  it("finds open issues no doc names", () => {
    expect(unnamedIssues(open, ["work on #7", "---\nissue: 9\n---"]).map((o: { what: string }) => o.what)).toEqual(["#8"]);
    expect(unnamedIssues(open, ["#7 #8 #9"])).toEqual([]);
  });

  it("finds finished projects whose issue is still open", () => {
    const projects = [
      { name: "acme-built", status: "built", issue: 7 },
      { name: "acme-gone", status: "superseded", issue: 99 },
      { name: "acme-partial", status: "partial", issue: 8 },
    ];
    expect(doneButOpen(projects, open).map((o: { what: string }) => o.what)).toEqual(["#7"]);
  });

  it("finds unlabelled issues and old PRs", () => {
    expect(unlabelled(open)).toHaveLength(2);
    const prs = [
      { number: 1, title: "Acme old", createdAt: "2026-09-11T10:00:00Z" },
      { number: 2, title: "Acme new", createdAt: "2026-09-30T10:00:00Z" },
    ];
    expect(stalePRs(prs, DAY).map((o: { what: string }) => o.what)).toEqual(["#1"]);
  });
});

describe("queues", () => {
  it("ages verify walks, Loop findings and persona findings, oldest first", () => {
    const walks = [
      { path: "docs/verify/a.md", status: "unverified", since: "2026-09-20" },
      { path: "docs/verify/b.md", status: "works", since: "2026-09-01" },
      { path: "docs/verify/c.md", status: "unverified", since: "2026-09-30" },
    ];
    const v = verifyQueue(walks, DAY);
    expect(v.map((o: { what: string }) => o.what)).toEqual(["docs/verify/a.md", "docs/verify/c.md"]);
    expect(v[0].age).toBe(12);

    const findings = [
      { path: "docs/loop/a.md", decision: "untriaged", added: "2026-10-01" },
      { path: "docs/loop/b.md", decision: "declined", added: "2026-09-01" },
    ];
    expect(loopUntriaged(findings, DAY).map((o: { what: string }) => o.what)).toEqual(["docs/loop/a.md"]);

    const pages = [
      { file: "2026-09-25-acme.md", date: "2026-09-25", open: 2 },
      { file: "2026-09-26-acme.md", date: "2026-09-26", open: 0 },
    ];
    expect(personaUnanswered(pages, DAY).map((o: { what: string }) => o.what)).toEqual(["docs/reviews/2026-09-25-acme.md"]);
  });

  it("counts open phases only in phases files untouched for more than 14 days", () => {
    const out = stalePhases(
      [
        { name: "acme-stale", path: "docs/projects/acme-stale/phases.md", phases: phases("NOT STARTED", "PART-DONE", "CLOSED"), touched: "2026-09-10" },
        { name: "acme-fresh", path: "docs/projects/acme-fresh/phases.md", phases: phases("NOT STARTED"), touched: "2026-09-30" },
        { name: "acme-shut", path: "docs/projects/acme-shut/phases.md", phases: phases("CLOSED"), touched: "2026-08-01" },
        { name: "acme-new", path: "docs/projects/acme-new/phases.md", phases: phases("NOT STARTED"), touched: null },
      ],
      DAY,
    );
    expect(out.map((o: { what: string; n: number }) => [o.what, o.n])).toEqual([["docs/projects/acme-stale/phases.md", 2]]);
  });
});

describe("gates", () => {
  it("sees only untracked TypeScript under packages/", () => {
    expect(untrackedSources(["packages/acme/src/a.ts", "packages/acme/src/b.tsx", "docs/acme.md", "scripts/a.ts"])).toHaveLength(2);
    expect(untrackedSources([])).toEqual([]);
  });

  const deepSource = 'export const DEEP: readonly DeepFile[] = [\n  { file: "a.test.ts", secs: 1 },\n  { file: "b.test.ts", secs: 2 },\n];\nexport const FAST = [\n  { file: "c.test.ts" },\n];';

  it("counts the DEEP list from source and reads counts stated in words", () => {
    expect(deepCount(deepSource)).toBe(2);
    expect(numberWord("fifty-three")).toBe(53);
    expect(numberWord("thirty-five")).toBe(35);
    expect(numberWord("two")).toBe(2);
    expect(numberWord("many")).toBeNull();
  });

  it("flags each stated deep count that disagrees, and none that agree", () => {
    const wrong = deepCountsDisagree({
      switchesText: "since the deep lane — the thirty-five files\n * that spawn the CLI per case.",
      agentsText: "it leaves out the files that spawn the CLI per case (fifty-three on 27 Sep)",
      deepSource,
    });
    expect(wrong.offenders.map((o: { what: string }) => o.what)).toEqual(["scripts/switches.mjs", "AGENTS.md"]);
    const right = deepCountsDisagree({
      switchesText: "the two files that spawn the CLI per case",
      agentsText: "the files that spawn the CLI per case (two on 2 Oct)",
      deepSource,
    });
    expect(right.offenders).toEqual([]);
  });
});

describe("instruments", () => {
  it("finds personas with no goal, reads the grade page's count, and ages one-shots", () => {
    expect(personasWithoutGoal([{ path: "a.md", front: "name: a\ngoal:\n  - x" }, { path: "b.md", front: "name: b" }])).toEqual([{ what: "b.md" }]);
    expect(gradedCount("The pages this repository ships: **1 graded**.")).toBe(1);
    expect(gradedCount("no number")).toBeNull();
    const st = staleInstruments(
      [
        { what: "docs/acme-lift", names: ["2026-09-03-acme.md"] },
        { what: "docs/acme-fresh", names: ["2026-09-30.md"] },
        { what: "docs/acme-never", names: [] },
      ],
      DAY,
    );
    expect(st.map((o: { what: string }) => o.what)).toEqual(["docs/acme-never", "docs/acme-lift"]);
  });
});

describe("build loop", () => {
  it("counts red release runs and their mean minutes", () => {
    const runs = [
      { conclusion: "success", startedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:10:00Z" },
      { conclusion: "failure", startedAt: "2026-10-01T01:00:00Z", updatedAt: "2026-10-01T01:12:00Z", databaseId: 5 },
      { conclusion: "cancelled", startedAt: "2026-10-01T02:00:00Z", updatedAt: "2026-10-01T02:11:00Z" },
    ];
    const s = releaseStats(runs);
    expect(s.red).toHaveLength(1);
    expect(s.total).toBe(3);
    expect(s.meanMinutes).toBe(11);
  });

  it("finds fixes, left-behinds and reverts by subject", () => {
    const s = commitStats([
      { sha: "a".repeat(40), subject: "fix(web): Acme survives a re-render" },
      { sha: "b".repeat(40), subject: "acme phase 2 (the rest): files it left behind" },
      { sha: "c".repeat(40), subject: 'Revert "acme"' },
      { sha: "d".repeat(40), subject: "acme: a prefix fixture" },
    ]);
    expect([s.fixes.length, s.leftBehind.length, s.reverts.length]).toEqual([1, 1, 1]);
  });
});

/** A whole synthetic tree's inputs — clean everywhere, so a test can break one thing. */
function inputs(over: Record<string, unknown> = {}) {
  return {
    day: DAY,
    records: {
      index: index([["acme", "**Built.**"]]),
      statusByProject: new Map([["acme", "built"]]),
      phases: [{ path: "docs/projects/acme/phases.md", text: phases("CLOSED") }],
      projects: [{ name: "acme", path: "docs/projects/acme/phases.md", status: "built", issue: 7, phases: phases("CLOSED"), touched: "2026-10-01" }],
      researchNames: [],
      researchReadme: "",
      commitsByDay: new Map(),
      changelogPages: new Map(),
    },
    docTexts: ["#7"],
    issues: { open: [{ number: 7, title: "Acme", labels: [{ name: "acme" }] }], prs: [], milestones: 0 },
    queues: { walks: [], findings: [], reviewPages: [] },
    gates: {
      ratchets: [{ key: "unused-exports", label: "unused", value: 3, ceiling: 4, offenders: [] }],
      bundle: { bytes: 90_000, ceiling: 100_000 },
      untracked: [],
      deep: { switchesText: "", agentsText: "", deepSource: "" },
    },
    instruments: { personas: [], latestGrade: { path: "docs/grades/x.md", text: "**3 graded**" }, oneShots: [] },
    build: { runs: [], commits: [] },
    was: new Map(),
    ...over,
  };
}

describe("the page", () => {
  it("--offline: no issues rows and no Actions rows, and the page says so", () => {
    const { rows, skipped } = assemble(inputs({ issues: null, build: { runs: null, commits: [] } }));
    expect(rows.filter((r: { group: string }) => r.group === "issues")).toEqual([]);
    expect(rows.find((r: { key: string }) => r.key === "build-release-red")).toBeUndefined();
    expect(skipped.map((s: { group: string }) => s.group)).toEqual(["issues", "build loop (Actions)"]);
    const page = renderPage({ day: DAY, rows, previous: null, skipped });
    expect(page).toContain("Not measured — issues:");
    expect(page).not.toMatch(/^issues-/m);
  });

  it("online: the issues rows are there", () => {
    const { rows, skipped } = assemble(inputs());
    expect(skipped).toEqual([]);
    expect(rows.map((r: { key: string }) => r.key)).toEqual(expect.arrayContaining(["issues-unnamed", "issues-done-but-open", "build-release-red"]));
  });

  it("reads *was* from the previous page's front matter, and marks what got worse", () => {
    const yesterday = assemble(inputs());
    const page = renderPage({ day: "2026-10-01", rows: yesterday.rows, previous: null, skipped: [] });
    const was = frontMatterFields(splitFrontMatter(page)!.front);
    expect(was.get("date")).toBe("2026-10-01");
    expect(was.get("gates-unused-exports")).toBe("3");
    expect(was.get("gates-unused-exports-bound")).toBe("4");

    const worse = inputs({
      was,
      gates: {
        ratchets: [{ key: "unused-exports", label: "unused", value: 5, ceiling: 6, offenders: [] }],
        bundle: { bytes: 90_000, ceiling: 100_000 },
        untracked: ["packages/acme/src/new.ts"],
        deep: { switchesText: "", agentsText: "", deepSource: "" },
      },
    });
    const { rows } = assemble(worse);
    const unused = rows.find((r: { key: string }) => r.key === "gates-unused-exports");
    expect(unused.was).toBe(3);
    expect(worsened(unused)).toBe(true);
    expect(unused.boundMoved).toEqual({ from: 4, to: 6 });
    const untracked = rows.find((r: { key: string }) => r.key === "gates-untracked-ts");
    expect([untracked.was, untracked.count]).toEqual([0, 1]);

    // Worst first: the rows that got worse lead.
    const sorted = sortRows(rows);
    expect(worsened(sorted[0])).toBe(true);
    const today = renderPage({ day: DAY, rows, previous: "2026-10-01", skipped: [] });
    expect(today).toContain("bound moved 4 → 6");
    expect(today).toContain("▲ worse");
  });

  it("a number nobody took writes no number, so tomorrow's was is blank, not zero", () => {
    const rows = withWas([row("gates", "acme", "acme", null, [], { note: "would not run" })], new Map([["gates-acme", "4"]]));
    const page = renderPage({ day: DAY, rows, previous: null, skipped: [] });
    expect(frontMatterFields(splitFrontMatter(page)!.front).has("gates-acme")).toBe(false);
    expect(page).toContain("not measured: would not run");
  });

  it("higher-is-better rows worsen when they fall", () => {
    const [r] = withWas([row("gates", "headroom", "headroom", 15, [], { better: "higher", target: 5000 })], new Map([["gates-headroom", "300"]]));
    expect(worsened(r)).toBe(true);
  });
});
