import { describe, expect, it } from "vitest";
import { skillNameFrom, skillSource } from "../src/index.ts";

describe("finding the file behind a skill reference", () => {
  it("takes the owner/repo/path a README gives you", () => {
    expect(skillSource("mattpocock/skills/skills/productivity/grilling/SKILL.md")).toEqual({
      url: "https://raw.githubusercontent.com/mattpocock/skills/HEAD/skills/productivity/grilling/SKILL.md",
      label: "mattpocock/skills",
    });
  });

  it("takes the URL the address bar gives you, and un-blobs it", () => {
    expect(
      skillSource("https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md"),
    ).toEqual({
      url: "https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grilling/SKILL.md",
      label: "mattpocock/skills",
    });
  });

  it("takes any https URL, and names the host so the origin is sayable", () => {
    expect(skillSource("https://example.com/skills/polish.md")).toMatchObject({
      url: "https://example.com/skills/polish.md",
      label: "example.com",
    });
  });

  it("refuses plain http", () => {
    // The body of a skill is instructions every future agent will follow.
    // Fetching that over a channel anyone can rewrite is not a small thing.
    expect(skillSource("http://example.com/polish.md")).toBeNull();
  });

  it("refuses what it cannot name a source for", () => {
    for (const ref of ["", "   ", "grilling", "mattpocock/skills", "../../etc/passwd", "file:///etc/passwd"]) {
      expect(skillSource(ref), ref).toBeNull();
    }
  });
});

describe("naming the command", () => {
  it("uses the skill's own directory, not the word SKILL", () => {
    expect(skillNameFrom("mattpocock/skills/skills/productivity/grilling/SKILL.md")).toBe("grilling");
    expect(skillNameFrom("https://github.com/o/r/blob/main/a/b/design-audit/skill.md")).toBe("design-audit");
  });

  it("falls back to the filename when there is no directory to use", () => {
    expect(skillNameFrom("https://example.com/polish.md")).toBe("polish");
  });

  it("produces something a command may legally be called", () => {
    expect(skillNameFrom("o/r/My Great Skill.md")).toBe("my-great-skill");
    expect(skillNameFrom("o/r/---.md")).toBeNull();
  });
});
