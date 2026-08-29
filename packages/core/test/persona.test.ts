import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PERSONA_DIR,
  PERSONA_DOORWAY,
  goalLine,
  parseBound,
  parsePersona,
  personaWarnings,
  splitFrontMatter,
  withBaseline,
} from "../src/persona.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

const file = (front: string, body = "Do the thing.\n") => `---\n${front}\n---\n${body}`;

describe("reading a persona", () => {
  it("takes the lens verbatim — it is the part a model actually reads", () => {
    const p = parsePersona(file("name: percy\ndescription: Watches the numbers.", "## Read before you look\n\nThe index first.\n"), "percy.md")!;
    expect(p.name).toBe("percy");
    expect(p.description).toBe("Watches the numbers.");
    expect(p.body).toBe("## Read before you look\n\nThe index first.\n");
  });

  it("falls back to the filename, so two surfaces cannot call it different things", () => {
    const p = parsePersona(file("description: x"), "darren-tokens.md")!;
    expect(p.name).toBe("darren-tokens");
  });

  it("is not a persona at all without front matter", () => {
    // A README in the same directory is not a malformed persona; it is a
    // README. Saying so is what keeps the listing honest.
    expect(parsePersona("# Notes\n\nsome prose\n", "notes.md")).toBeNull();
    expect(splitFrontMatter("no front matter")).toBeNull();
  });

  it("survives CRLF, because these files are committed and cloned", () => {
    const p = parsePersona("---\r\nname: percy\r\ndescription: x\r\n---\r\nbody\r\n", "percy.md");
    expect(p?.name).toBe("percy");
  });

  it("keeps front-matter keys it does not know", () => {
    // A round trip through an editor must not silently delete somebody else's
    // vendor key. This build not understanding `color` is not a licence to
    // drop it.
    const p = parsePersona(file("name: p\ndescription: d\ncolor: cyan\nfuture_thing: 7"), "p.md")!;
    expect(p.extra["future_thing"]).toBe("7");
  });
});

describe("a goal is a number, a bound, and the command that produces it", () => {
  it("reads all three off a block a person can type", () => {
    const p = parsePersona(
      file(
        "name: percy\ndescription: d\ngoal:\n  - name: pan p90\n    at most: 12ms\n    measured by: scripts/perf-census.mjs --pan",
      ),
      "percy.md",
    )!;
    expect(p.goals).toHaveLength(1);
    expect(p.goals[0]).toMatchObject({
      name: "pan p90",
      bound: { kind: "at most", value: 12 },
      unit: "ms",
      measuredBy: "scripts/perf-census.mjs --pan",
    });
  });

  it("DROPS a goal missing any of the three", () => {
    /**
     * Half a goal is a bound with nothing measuring it, or a command with no
     * line to cross — and either one reports success forever. That is the
     * exact failure this feature exists to make impossible, so a half-written
     * goal must not be kept and quietly counted.
     */
    const noCommand = parsePersona(file("name: p\ndescription: d\ngoal:\n  - name: contrast\n    at most: 0"), "p.md")!;
    expect(noCommand.goals).toEqual([]);
    const noBound = parsePersona(file("name: p\ndescription: d\ngoal:\n  - name: contrast\n    measured by: grade.mjs"), "p.md")!;
    expect(noBound.goals).toEqual([]);
  });

  it("reads both directions and a bare count", () => {
    expect(parseBound("at most 12ms")).toMatchObject({ bound: { kind: "at most", value: 12 }, unit: "ms" });
    expect(parseBound("at least 95%")).toMatchObject({ bound: { kind: "at least", value: 95 }, unit: "%" });
    expect(parseBound("at most 0")?.unit).toBeUndefined();
    expect(parseBound("roughly fine")).toBeNull();
  });

  it("says a goal was never measured rather than implying it passes", () => {
    const p = parsePersona(
      file("name: p\ndescription: d\ngoal:\n  - name: contrast failures\n    at most: 0\n    measured by: grade.mjs"),
      "p.md",
    )!;
    expect(goalLine(p.goals[0]!)).toBe("contrast failures — at most 0, never measured");
  });

  it("says MISSED when the baseline is on the wrong side of the line", () => {
    const p = parsePersona(
      file("name: p\ndescription: d\ngoal:\n  - name: pan p90\n    at most: 12ms\n    measured by: x\n    baseline: 33, 2026-08-29"),
      "p.md",
    )!;
    expect(goalLine(p.goals[0]!)).toContain("MISSED");
    const fixed = withBaseline(p, "pan p90", { value: 9, at: "2026-08-29" });
    expect(goalLine(fixed.goals[0]!)).not.toContain("MISSED");
  });
});

describe("what a persona is warned about", () => {
  /**
   * The build rule from the design, as a function, so every surface says it in
   * the same words: three instruments this week reported nothing and were
   * believed. A persona with a trigger and no measured goal is the fourth,
   * on a schedule.
   */
  it("names a persona that cannot fail", () => {
    const p = parsePersona(file("name: p\ndescription: d"), "p.md")!;
    expect(personaWarnings(p).join(" ")).toContain("cannot report a number");
  });

  it("names a goal that has never been measured", () => {
    const p = parsePersona(
      file("name: p\ndescription: d\ngoal:\n  - name: x\n    at most: 0\n    measured by: y"),
      "p.md",
    )!;
    expect(personaWarnings(p).join(" ")).toContain("never measured");
  });

  it("says nothing about a persona that is fully armed", () => {
    const p = parsePersona(
      file(
        "name: p\ndescription: d\ntrigger:\n  cron: 3 8 * * *\ngoal:\n  - name: x\n    at most: 0\n    measured by: y\n    baseline: 0, 2026-08-29",
      ),
      "p.md",
    )!;
    expect(p.trigger).toEqual({ kind: "schedule", cron: "3 8 * * *" });
    expect(personaWarnings(p)).toEqual([]);
  });

  it("reads a push trigger with its paths", () => {
    const p = parsePersona(
      file("name: p\ndescription: d\ntrigger:\n  on: push\n  to: main\n  paths: packages/web, styles.css"),
      "p.md",
    )!;
    expect(p.trigger).toEqual({ kind: "push", to: "main", paths: ["packages/web", "styles.css"] });
  });
});

/**
 * **The doorway, and why it is a test rather than a convention.**
 *
 * `.agents/personas/<name>.md` is the file; `.claude/agents/<name>.md` is a
 * relative symlink to it. The failure this guards is specific and silent: the
 * moment one of those links becomes a real file — copied by a tool, restored
 * by an editor, committed by somebody on a filesystem without symlinks —
 * there are two personas with one name, they drift, and only one harness sees
 * the drift.
 */
describe("one copy, several doorways", () => {
  it("every persona lives in .agents and is a real file there", async () => {
    const dir = path.join(repo, PERSONA_DIR);
    const names = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const stat = await fs.lstat(path.join(dir, name));
      expect(stat.isFile(), `${name} must be a real file in ${PERSONA_DIR}`).toBe(true);
    }
  });

  it("every doorway is a LINK, and points at that file", async () => {
    const dir = path.join(repo, PERSONA_DIR);
    const names = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    for (const name of names) {
      const doorway = path.join(repo, PERSONA_DOORWAY, name);
      const stat = await fs.lstat(doorway).catch(() => null);
      expect(stat, `${PERSONA_DOORWAY}/${name} is missing`).not.toBeNull();
      expect(stat!.isSymbolicLink(), `${PERSONA_DOORWAY}/${name} is a COPY, not a doorway`).toBe(true);
      // Relative, so it survives being moved or cloned — the same rule
      // `installSkill` follows for the skill.
      const target = await fs.readlink(doorway);
      expect(path.isAbsolute(target), `${name}'s doorway must be relative`).toBe(false);
      expect(path.resolve(path.dirname(doorway), target)).toBe(path.join(dir, name));
    }
  });

  it("the doorway is not carrying a persona .agents has never heard of", async () => {
    const known = new Set((await fs.readdir(path.join(repo, PERSONA_DIR))).filter((f) => f.endsWith(".md")));
    const doorways = await fs.readdir(path.join(repo, PERSONA_DOORWAY)).catch(() => [] as string[]);
    for (const name of doorways.filter((f) => f.endsWith(".md"))) {
      expect(known.has(name), `${PERSONA_DOORWAY}/${name} has no file in ${PERSONA_DIR}`).toBe(true);
    }
  });

  it("and each one parses, including the four this repo runs on itself", async () => {
    const dir = path.join(repo, PERSONA_DIR);
    for (const name of (await fs.readdir(dir)).filter((f) => f.endsWith(".md"))) {
      const persona = parsePersona(await fs.readFile(path.join(dir, name), "utf8"), name);
      expect(persona, `${name} did not parse`).not.toBeNull();
      expect(persona!.description, `${name} has no description`).not.toBe("");
      expect(persona!.tools.length, `${name} lists no tools`).toBeGreaterThan(0);
    }
  });
});
