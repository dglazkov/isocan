import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PERSONA_DIR,
  PERSONA_DOORWAY,
  escalatedTo,
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

  it("reads what a debt is a debt against, and leaves it off when there is none", () => {
    /**
     * A goal bounded `at most 0` on an OVERSHOOT has a bound that cannot move,
     * so a report of it says nothing about which number it overshot. `against`
     * is the command that prints that number — see `PersonaGoal`, and
     * `test/review-queue.test.ts` for what went wrong without it.
     */
    const p = parsePersona(
      file(
        "name: p\ndescription: d\ngoal:\n  - name: bytes past the last size somebody agreed to\n" +
          "    at most: 0\n    measured by: node scripts/measure.mjs bundle-over-ceiling\n" +
          "    against: node scripts/bundle-ceiling.mjs",
      ),
      "p.md",
    )!;
    expect(p.goals[0]).toMatchObject({ against: "node scripts/bundle-ceiling.mjs" });
    const plain = parsePersona(
      file("name: p\ndescription: d\ngoal:\n  - name: contrast\n    at most: 0\n    measured by: grade.mjs"),
      "p.md",
    )!;
    // Absent rather than empty: a goal measured against nothing says nothing.
    expect(plain.goals[0]!).not.toHaveProperty("against");
    // And both surfaces say so: `goalLine` is what `isocan persona ls` prints
    // and what the board's panel renders, so "at most 0" on its own would read
    // as an absolute in the two places a person meets this goal.
    expect(goalLine(p.goals[0]!)).toContain("at most 0 of what `node scripts/bundle-ceiling.mjs` prints");
    expect(goalLine(plain.goals[0]!)).toBe("contrast — at most 0, never measured");
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
 * **The cheap tier's three keys** — `docs/research/2026-09-07-small-personas.md`
 * phase 1: a declared cost (D3), an idle trigger with its scope (D2), and who
 * a small persona hands off to (#197's "cheap finds, expensive decides").
 */
describe("a small persona: what it may spend, when it runs, who decides", () => {
  const small = (extra: string) =>
    parsePersona(
      file(
        "name: s\ndescription: d\nmodel: haiku\ngoal:\n  - name: x\n    at most: 0\n    measured by: y\n    baseline: 0, 2026-09-24\n" +
          extra,
      ),
      "s.md",
    )!;

  it("reads a budget in rcLimits' shape — named limits, each a number", () => {
    const p = small("budget:\n  usd per run: 0.05\n  turns per run: 6\nescalate: reviewer");
    expect(p.budget).toEqual({ usdPerRun: 0.05, turnsPerRun: 6 });
    expect(p.escalate).toBe("reviewer");
    // Known keys, so they are not ALSO kept as unknown ones.
    expect(p.extra).not.toHaveProperty("budget");
    expect(p.extra).not.toHaveProperty("escalate");
  });

  it("reads a typo as NO budget, never as an unlimited one", () => {
    /**
     * The runner runs no model for a persona without a budget. A value it
     * cannot read therefore has to land on that side — "machinery will not
     * run this" — and not on "no cap", which is the expensive way to be wrong.
     */
    expect(small("budget:\n  usd per run: lots").budget).toBeUndefined();
    expect(small("budget:\n  usd per run: 0").budget).toBeUndefined();
    expect(small("budget:\n  dollars: 0.05").budget).toBeUndefined();
    expect(small("budget:\n  usd per run: $0.10").budget).toEqual({ usdPerRun: 0.1 });
  });

  it("reads idle with its scope, and drops one that does not say which idleness", () => {
    /**
     * D2: two idlenesses, named separately from the start. A bare `idle: 20m`
     * is exactly the conflation that would start a heavy run while somebody
     * is mid-sprint on an unrelated canvas, so it is not guessed at.
     */
    expect(small("trigger:\n  cron: 43 8 * * *\n  idle: machine 15m").trigger).toEqual({
      kind: "schedule",
      cron: "43 8 * * *",
      idle: { scope: "machine", minutes: 15 },
    });
    expect(small("trigger:\n  cron: 43 8 * * *\n  idle: canvas 20 minutes").trigger).toMatchObject({
      idle: { scope: "canvas", minutes: 20 },
    });
    expect(small("trigger:\n  cron: 43 8 * * *\n  idle: 20m").trigger).toEqual({ kind: "schedule", cron: "43 8 * * *" });
  });

  it("warns about a hand-off with nothing to hand off from", () => {
    expect(personaWarnings(small("escalate: reviewer")).join(" ")).toContain("declares no budget");
    expect(personaWarnings(small("budget:\n  usd per run: 0.05\nescalate: reviewer"))).toEqual([
      "no trigger — somebody has to remember to run it",
    ]);
  });

  it("reads who a run page handed its finding to, off the page", () => {
    expect(escalatedTo("# p\n\n## Escalation\n\n**Escalated to `reviewer`** — what the small pass could not settle:\n")).toBe(
      "reviewer",
    );
    expect(escalatedTo("# p\n\nNothing was escalated to `reviewer` here.\n")).toBeNull();
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
