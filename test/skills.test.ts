import { describe, expect, it } from "vitest";
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
       house rules name it, which keeps the exception from being silent. */
    const houseRules = await fs.readFile(path.join(repo, "AGENTS.md"), "utf8");
    const strays: string[] = [];
    for (const dir of [".claude", ".codex", ".cursor", ".gemini", ".pi", ".opencode"]) {
      const skills = path.join(repo, dir, "skills");
      for (const entry of await fs.readdir(skills, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory()) continue; // a symlink is a doorway, not a copy
        const rival = path.join(skills, entry.name, "SKILL.md");
        if (!(await fs.stat(rival).then(() => true, () => false))) continue;
        const twin = path.join(repo, ".agents/skills", entry.name);
        const shared = await fs.stat(twin).then(() => true, () => false);
        const recorded = houseRules.includes(`${dir}/skills/${entry.name}/`);
        if (shared || !recorded) strays.push(rival);
      }
    }
    expect(strays).toEqual([]);
  });

  it("a harness-only skill is named in the house rules, so the exception is never silent", async () => {
    const houseRules = await fs.readFile(path.join(repo, "AGENTS.md"), "utf8");
    expect(houseRules).toContain(".claude/skills/conduct/");
  });
});
