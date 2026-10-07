import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docStatus } from "@isocan/core";
// @ts-expect-error — a .mjs script with no types, shared with scripts/roadmap.mjs.
import { checkFrontMatterVsPhases, checkPhaseStatuses, checkProjectsIndex, checkRepoRecords, checkResearchIndex, phaseSections } from "../scripts/lib/records.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const statusSh = path.join(repo, ".claude/skills/conduct/status.sh");
const roadmapScript = path.join(repo, "scripts/roadmap.mjs");

interface SyntheticProject {
  name: string;
  primary: string;
  status: string | null;
  note: string | null;
  phasesPath: string | null;
  phases: ReturnType<typeof phaseSections> | null;
}

function makeProject(
  name: string,
  opts: {
    status?: string | null;
    note?: string | null;
    phasesMd?: string | null;
  } = {},
): SyntheticProject {
  const phases = opts.phasesMd != null ? phaseSections(opts.phasesMd) : null;
  return {
    name,
    primary: `docs/projects/${name}/design.md`,
    status: opts.status ?? "built",
    note: opts.note ?? null,
    phasesPath: phases ? `docs/projects/${name}/phases.md` : null,
    phases,
  };
}

function withTempRepo(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "acme-records-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function runStatusSh(root: string, project: string): { status: number | null; stdout: string; stderr: string } {
  const res = spawnSync("bash", [statusSh, project], {
    cwd: repo,
    env: { ...process.env, ISOCAN_REPO_ROOT: root },
    encoding: "utf8",
    timeout: 15_000,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

describe("records cannot disagree", () => {
  it("finds zero disagreements across the live repository", () => {
    expect(checkRepoRecords(repo, docStatus)).toEqual([]);
  });

  describe("(a) projects index vs front matter and phases", () => {
    it("rejects status contradictions between the Where-it-stands lead and front matter status", () => {
      const cases: Array<{ status: string; where: string }> = [
        { status: "built", where: "**Unbuilt.** Acme widget is designed only." },
        { status: "built", where: "**On branch.** Acme widget awaits merge." },
        { status: "built", where: "**Phase 1 is next.** Nothing shipped yet." },
        { status: "built", where: "**Part-done.** Half of Acme widget is open." },
        { status: "partial", where: "**Unbuilt.** Acme widget has no code." },
        { status: "partial", where: "**All three phases closed.** Everything is done." },
        { status: "designed", where: "**Built.** Acme widget shipped yesterday." },
        { status: "open", where: "**Phase 1 closed.** Acme widget is live." },
        { status: "superseded", where: "**Built.** Acme widget still claims to be active." },
      ];

      for (const { status, where } of cases) {
        const p = makeProject("acme-widget", { status });
        const index = [
          "| Project | What it is | Where it stands |",
          "| --- | --- | --- |",
          `| [acme-widget](acme-widget/) | Synthetic widget. | ${where} |`,
        ].join("\n");
        const problems = checkProjectsIndex([p], index);
        expect(
          problems.some((x: { rule: string }) => x.rule === "projects-index-status"),
          `expected status contradiction for status=${status}, where=${where}`,
        ).toBe(true);
      }
    });

    it("rejects stale phase or stage counts against phases.md and front matter note", () => {
      // mindmap shape: index claims Stages 1, 2 and 4 built, while note says all four stages built.
      const acmeMap = makeProject("acme-map", {
        status: "built",
        note: "all four stages built — synthetic mindmap",
      });
      const mapIndex = [
        "| Project | What it is | Where it stands |",
        "| --- | --- | --- |",
        "| [acme-map](acme-map/) | Synthetic map. | **Stages 1, 2 and 4 built.** Stage 3 open. |",
      ].join("\n");
      expect(checkProjectsIndex([acmeMap], mapIndex)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "projects-index-note",
            detail: expect.stringContaining("acme-map"),
          }),
        ]),
      );

      // anatomy shape: index claims Phases 1–5 built, while phases.md and note have phases 1–8 CLOSED.
      const phases1to8 = Array.from(
        { length: 8 },
        (_, i) => `## Phase ${i + 1} — Step ${i + 1}\n\n**Status: CLOSED**\n`,
      ).join("\n");
      const acmeAnatomy = makeProject("acme-anatomy", {
        status: "built",
        note: "phases 1–8 built — synthetic anatomy",
        phasesMd: phases1to8,
      });
      const anatomyIndex = [
        "| Project | What it is | Where it stands |",
        "| --- | --- | --- |",
        "| [acme-anatomy](acme-anatomy/) | Synthetic anatomy. | **Phases 1–5 built.** Phases 6–8 open. |",
      ].join("\n");
      const anatomyProblems = checkProjectsIndex([acmeAnatomy], anatomyIndex);
      expect(anatomyProblems.map((x: { rule: string }) => x.rule)).toEqual(
        expect.arrayContaining(["projects-index-phases", "projects-index-note"]),
      );

      // first-minute shape: index claims Phases 0–3 built, while note says phases 0 to 5 built.
      const acmeFirst = makeProject("acme-first", {
        status: "built",
        note: "phases 0 to 5 built — synthetic onboarding",
      });
      const firstIndex = [
        "| Project | What it is | Where it stands |",
        "| --- | --- | --- |",
        "| [acme-first](acme-first/) | Synthetic onboarding. | **Phases 0–3 built.** Phases 4–5 open. |",
      ].join("\n");
      expect(checkProjectsIndex([acmeFirst], firstIndex)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: "projects-index-note",
            detail: expect.stringContaining("acme-first"),
          }),
        ]),
      );
    });

    it("rejects missing, malformed, split, and unknown project rows", () => {
      const p1 = makeProject("acme-alpha", { status: "built" });
      const p2 = makeProject("acme-beta", { status: "designed" });
      const index = [
        "| Project | What it is | Where it stands |",
        "| --- | --- | --- |",
        "| [acme-alpha](acme-alpha/) | Split row starts here",
        "and finishes on the next line. | **Built.** |",
        "| [acme-ghost](acme-ghost/) | Unknown dir. | **Built.** |",
      ].join("\n");

      const problems = checkProjectsIndex([p1, p2], index);
      const rules = problems.map((x: { rule: string }) => x.rule);
      expect(rules).toContain("projects-index-row");
      expect(rules).toContain("projects-index-missing");
      expect(rules).toContain("projects-index-unknown");
    });
  });

  describe("(b) status.sh and checkPhaseStatuses on missing Status lines", () => {
    it("fails when phases.md has ## Phase headings and zero Status lines", () => {
      const md = ["# Acme Phases", "", "## Phase 1 — First", "Prose only.", "", "## Phase 2 — Second", "More prose."].join(
        "\n",
      );
      const project = makeProject("acme-zero", { status: "designed", phasesMd: md });
      expect(checkPhaseStatuses([project])).toEqual([
        expect.objectContaining({
          rule: "phase-status",
          detail: expect.stringContaining("2 phases, no **Status: line"),
        }),
      ]);

      withTempRepo((dir) => {
        const pdir = path.join(dir, "docs/projects/acme-zero");
        mkdirSync(pdir, { recursive: true });
        writeFileSync(path.join(pdir, "phases.md"), md);
        const res = runStatusSh(dir, "acme-zero");
        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toContain("no **Status: line");
      });
    });

    it("fails when one phase is missing its Status line", () => {
      const md = [
        "# Acme Phases",
        "",
        "## Phase 1 — First",
        "**Status: CLOSED**",
        "",
        "## Phase 2 — Second",
        "No status line here.",
      ].join("\n");
      const project = makeProject("acme-gap", { status: "partial", phasesMd: md });
      expect(checkPhaseStatuses([project])).toEqual([
        expect.objectContaining({
          rule: "phase-status",
          detail: expect.stringContaining("acme-gap phase 2 has no **Status: line"),
        }),
      ]);

      withTempRepo((dir) => {
        const pdir = path.join(dir, "docs/projects/acme-gap");
        mkdirSync(pdir, { recursive: true });
        writeFileSync(path.join(pdir, "phases.md"), md);
        const res = runStatusSh(dir, "acme-gap");
        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toContain("2 phases, 1 Status lines: every phase must carry a **Status: line");
        expect(res.stdout + res.stderr).toContain("Phase 2 — Second has no **Status: line");
      });
    });
  });

  describe("(c) status.sh and records.mjs reject DONE", () => {
    it("rejects DONE in both checkPhaseStatuses and status.sh", () => {
      const md = ["# Acme Phases", "", "## Phase 1 — First", "**Status: DONE** — wrong word."].join("\n");
      const project = makeProject("acme-done", { status: "built", phasesMd: md });
      expect(checkPhaseStatuses([project])).toEqual([
        expect.objectContaining({
          rule: "phase-status",
          detail: expect.stringContaining("acme-done phase 1 says DONE"),
        }),
      ]);

      withTempRepo((dir) => {
        const pdir = path.join(dir, "docs/projects/acme-done");
        mkdirSync(pdir, { recursive: true });
        writeFileSync(path.join(pdir, "phases.md"), md);
        const res = runStatusSh(dir, "acme-done");
        expect(res.status).not.toBe(0);
        expect(res.stdout + res.stderr).toContain('invalid status "DONE"');
      });
    });
  });

  describe("(d) front matter vs phases", () => {
    it("fails when status: built has an open phase, and when partial or designed has all phases closed", () => {
      const withOpen = [
        "## Phase 1 — First",
        "**Status: CLOSED**",
        "## Phase 2 — Second",
        "**Status: PART-DONE**",
      ].join("\n");
      const allClosed = [
        "## Phase 1 — First",
        "**Status: CLOSED**",
        "## Phase 2 — Second",
        "**Status: RETIRED**",
      ].join("\n");

      const builtButOpen = makeProject("acme-open", { status: "built", phasesMd: withOpen });
      const partialButClosed = makeProject("acme-partial", { status: "partial", phasesMd: allClosed });
      const designedButClosed = makeProject("acme-designed", { status: "designed", phasesMd: allClosed });
      const honestBuilt = makeProject("acme-honest", { status: "built", phasesMd: allClosed });

      const problems = checkFrontMatterVsPhases([
        builtButOpen,
        partialButClosed,
        designedButClosed,
        honestBuilt,
      ]);
      expect(problems).toHaveLength(3);
      expect(problems[0].detail).toContain("acme-open: 1 phase open");
      expect(problems[1].detail).toContain("acme-partial: every phase closed or retired");
      expect(problems[2].detail).toContain("acme-designed: every phase closed or retired");
    });
  });

  describe("(e) unindexed research notes", () => {
    it("fails checkResearchIndex and roadmap.mjs --check when a research note is missing from docs/research/README.md", () => {
      const files = ["README.md", "2026-09-01-acme-indexed.md", "2026-09-02-acme-unindexed.md"];
      const index = [
        "# Research",
        "| Date | Research | What it found |",
        "| --- | --- | --- |",
        "| 2026-09-01 | [Acme indexed](2026-09-01-acme-indexed.md) | Indexed synthetic note. |",
      ].join("\n");

      expect(checkResearchIndex(files, index)).toEqual([
        {
          rule: "research-unindexed",
          path: "docs/research/README.md",
          detail: "docs/research/README.md does not link docs/research/2026-09-02-acme-unindexed.md",
        },
      ]);

      withTempRepo((dir) => {
        mkdirSync(path.join(dir, "docs/research"), { recursive: true });
        mkdirSync(path.join(dir, "docs/verify"), { recursive: true });
        mkdirSync(path.join(dir, "docs/projects/acme-proj"), { recursive: true });
        writeFileSync(
          path.join(dir, "docs/research/2026-09-02-acme-unindexed.md"),
          "---\nstatus: open\nas-of: 2026-09-02\n---\n\n# Acme unindexed\n",
        );
        writeFileSync(
          path.join(dir, "docs/research/README.md"),
          "# Research\n\n| Date | Research | What it found |\n| --- | --- | --- |\n",
        );
        writeFileSync(
          path.join(dir, "docs/projects/acme-proj/design.md"),
          "---\nstatus: built\nas-of: 2026-09-02\n---\n\n# Acme proj\n",
        );
        writeFileSync(
          path.join(dir, "docs/projects/README.md"),
          [
            "| Project | What it is | Where it stands |",
            "| --- | --- | --- |",
            "| [acme-proj](acme-proj/) | Synthetic project. | **Built.** |",
          ].join("\n"),
        );

        const res = spawnSync("node", [roadmapScript, "--check"], {
          cwd: repo,
          env: { ...process.env, ISOCAN_REPO_ROOT: dir },
          encoding: "utf8",
          timeout: 30_000,
        });
        expect(res.status).not.toBe(0);
        expect(res.stderr).toContain("docs/research/README.md does not link docs/research/2026-09-02-acme-unindexed.md");
      });
    });
  });
});
