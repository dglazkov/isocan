import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One authored skill, many doorways (#44). The canonical copy lives at
 * `.agents/skills/<name>/` — the cross-harness convention pi, agy, Codex,
 * Cursor, Gemini CLI and OpenCode discover on their own — and Claude Code
 * reaches it through a committed symlink at `.claude/skills/<name>`, which
 * its docs support.
 *
 * These tests exist because the obvious "fix" for a harness that can't see a
 * skill is to copy the file, and a copy is a fork with a delay fuse. If one
 * fails, add a doorway; don't add a second original.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const SKILL = "isocan-collab";
const canonical = path.join(repo, ".agents/skills", SKILL);

describe("agent skills are shared, not copied", () => {
  it("the canonical skill lives under .agents/skills", async () => {
    const body = await fs.readFile(path.join(canonical, "SKILL.md"), "utf8");
    // Agent Skills spec: YAML frontmatter, name matching the directory.
    expect(body.startsWith("---\n")).toBe(true);
    const frontmatter = body.slice(4, body.indexOf("\n---", 4));
    expect(frontmatter).toMatch(new RegExp(`^name:\\s*${SKILL}\\s*$`, "m"));
    expect(frontmatter).toMatch(/^description:\s*\S/m);
  });

  it("Claude Code's directory is a symlink to it, never a second copy", async () => {
    const link = path.join(repo, ".claude/skills", SKILL);
    const stat = await fs.lstat(link);
    expect(stat.isSymbolicLink()).toBe(true);
    expect(await fs.realpath(link)).toBe(await fs.realpath(canonical));
    // Relative, so it survives a clone to any path.
    expect(path.isAbsolute(await fs.readlink(link))).toBe(false);
  });

  it("no harness directory holds a rival SKILL.md", async () => {
    /* A rival is a SECOND ORIGINAL of a skill that already has one: the fork
       with a delay fuse this file exists to stop. A skill that belongs to one
       harness and is deliberately not shared is a different thing — `conduct`
       is this repo's own workflow, and `npx skills add dglazkov/isocan` must
       hand a stranger the collaboration skill and nothing else (AGENTS.md,
       "The conductor"). So a harness-only skill is admitted exactly when the
       house rules name it, which keeps the exception from being silent.

       **What counts is what the REPOSITORY holds, which is why this asks git
       rather than the disk.** A checkout is not only the project's files: a
       person's machine syncs things into it. One does — a copy of `conduct`
       lands under `.agents/skills/` every few hours from another maintainer's
       sync — and read off the filesystem that made the TRACKED `.claude`
       copy look like the rival, so this test was red on that machine forever
       while CI stayed green. A guard that is permanently red where the work
       happens is a guard people stop reading, which is worse than the fork it
       watches for.

       It loses nothing: `git ls-files` reports the index as well as HEAD, so
       a real duplicate is caught the moment somebody `git add`s it — before
       the commit, which is the moment that matters. And a checkout with no
       git at all falls back to the disk, so the guard never quietly weakens
       into nothing. */
    const houseRules = await fs.readFile(path.join(repo, "AGENTS.md"), "utf8");
    const skillDirs = [".claude", ".codex", ".cursor", ".gemini", ".pi", ".opencode"];
    let indexed: Set<string> | null = null;
    try {
      const listed = execFileSync("git", ["ls-files", "--", ".agents/skills", ...skillDirs.map((d) => `${d}/skills`)], {
        cwd: repo,
        encoding: "utf8",
        /* A synchronous exec blocks the worker, so it carries its own
           deadline: this is a local index read that takes milliseconds, and
           a second is already generous. */
        timeout: 1000,
      });
      indexed = new Set(listed.split("\n").filter(Boolean));
    } catch {
      indexed = null; // not a git checkout: fall back to the disk
    }
    /** Is this path part of the repository, rather than something a machine
     *  left in the working tree? */
    const held = async (absolute: string, isDir: boolean): Promise<boolean> => {
      const rel = path.relative(repo, absolute);
      if (indexed === null) return fs.stat(absolute).then(() => true, () => false);
      return isDir ? [...indexed].some((f) => f === rel || f.startsWith(`${rel}/`)) : indexed.has(rel);
    };

    const strays: string[] = [];
    for (const dir of skillDirs) {
      const skills = path.join(repo, dir, "skills");
      for (const entry of await fs.readdir(skills, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory()) continue; // a symlink is a doorway, not a copy
        const rival = path.join(skills, entry.name, "SKILL.md");
        if (!(await held(rival, false))) continue;
        const twin = path.join(repo, ".agents/skills", entry.name);
        const shared = await held(twin, true);
        const recorded = houseRules.includes(`${dir}/skills/${entry.name}/`);
        if (shared || !recorded) strays.push(rival);
      }
    }
    expect(strays).toEqual([]);
  });

  it("actually finds the repository's own files, so it cannot pass by seeing nothing", async () => {
    /* The failure mode the git lookup introduces: `ls-files` returning empty
       — a wrong cwd, a detached worktree, a rename — would make every file
       look untracked, no rival would be found, and the guard would go green
       for exactly the reason it should go red. So check it can see the two
       files it reasons about. */
    const listed = execFileSync("git", ["ls-files", "--", ".agents/skills", ".claude/skills"], {
      cwd: repo,
      encoding: "utf8",
      timeout: 1000,
    }).split("\n").filter(Boolean);
    expect(listed, "git sees no skill files at all — the rival guard would pass blind").not.toEqual([]);
    expect(listed).toContain(".claude/skills/conduct/SKILL.md");
    expect(listed).toContain(`.agents/skills/${SKILL}/SKILL.md`);
  });

  it("a harness-only skill is named in the house rules, so the exception is never silent", async () => {
    const houseRules = await fs.readFile(path.join(repo, "AGENTS.md"), "utf8");
    expect(houseRules).toContain(".claude/skills/conduct/");
  });
});
