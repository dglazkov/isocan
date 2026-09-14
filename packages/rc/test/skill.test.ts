import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLLAB_SKILL } from "../src/index.ts";

/**
 * **The skill constant is the skill** (docs/projects/room/design.md, "skill:
 * not a dep"). A host with no disk is handed `COLLAB_SKILL` instead of reading
 * `.agents/skills/isocan-collab/SKILL.md`, so the two must never disagree.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("COLLAB_SKILL", () => {
  it("equals .agents/skills/isocan-collab/SKILL.md", () => {
    const file = readFileSync(path.join(repo, ".agents/skills/isocan-collab/SKILL.md"), "utf8");
    expect(
      COLLAB_SKILL === file,
      "packages/rc/src/skill.ts is stale — regenerate it with `node scripts/rc-skill.mjs`",
    ).toBe(true);
  });

  it("is the generator's output byte for byte", async () => {
    // Held to the script, so a hand edit of skill.ts that happens to keep the
    // text equal is still caught as a file the script did not write.
    const generator: string = "../../../scripts/rc-skill.mjs"; // plain JS, no declarations
    const { skillModule, CONSTANT_FILE, SKILL_FILE } = (await import(generator)) as {
      skillModule(text: string): string;
      CONSTANT_FILE: string;
      SKILL_FILE: string;
    };
    const expected = skillModule(readFileSync(path.join(repo, SKILL_FILE), "utf8"));
    expect(
      readFileSync(path.join(repo, CONSTANT_FILE), "utf8") === expected,
      "packages/rc/src/skill.ts is not what the generator writes — regenerate it with `node scripts/rc-skill.mjs`",
    ).toBe(true);
  });
});
