import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const night = readFileSync(fileURLToPath(new URL("../scripts/converge-night.mjs", import.meta.url)), "utf8");

/**
 * **The converge lane may land only what the graders can vouch for, and only
 * one thing a night.** These pin the lane's rules in its source — the
 * night-shift note's "verified, and allowed to land" — because a lane that
 * quietly widened its budget or its verdict would be the failure mode the
 * note lists first: a morning of forty items nobody can face.
 */
describe("the converge lane", () => {
  it("is one item wide, and never the same item two nights running", () => {
    expect(night).toContain("const pick = candidates[0];");
    expect(night).toContain("if (recent(item)) continue;");
    expect(night).not.toMatch(/for \(const pick of candidates\)/);
  });

  it("lands only when every targeted check passes, nothing regressed, and the words are the same", () => {
    expect(night).toContain("const verdict = !dry && stillFailing.length === 0 && regressed.length === 0 && sameWords && after.renders;");
    expect(night).toContain("if (!verdict) {");
    expect(night).toContain("**Discarded.**");
  });

  it("chases only mechanical checks, with an agent that can touch nothing but the file", () => {
    expect(night).toContain('const TARGETS = ["no contrast failures", "every control named", "images have alt", "no stretched images", "no sideways scroll"];');
    expect(night).toContain('"--allowedTools", "Read", "Edit", "Write"]');
    expect(night).not.toContain("Bash(");
  });

  it("records the landing where `isocan evals converge` reads it, and tells the morning how to say no", () => {
    expect(night).toContain('"--prop", `converged=');
    expect(night).toContain("bringing the previous version back");
    expect(night).toContain("isocan evals converge");
  });

  it("writes a page either way, so a night that landed nothing is still a night that ran", () => {
    expect(night).toContain("Nothing to converge");
    expect(night).toContain("Dry run — nothing landed.");
    expect(night).toContain("writeFileSync(page, md);");
  });
});
