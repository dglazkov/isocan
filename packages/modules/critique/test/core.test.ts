import { afterEach, describe, expect, it } from "vitest";
import { registerModule, unregisterModule, type CoreModule, type Item } from "@isocan/core";
import critiqueCore, {
  CRITIC_PROP,
  CRITICS_POINT,
  DEFAULT_BUDGET,
  canvasClashes,
  creditPerson,
  criticItems,
  criticMarkdown,
  criticProblems,
  criticSlug,
  draftFromRoster,
  findInRoster,
  lensPath,
  readCritic,
  readLens,
  refuseJoin,
  roster,
  rosterProblems,
  skeletonDraft,
  type RosterCritic,
} from "../src/core.ts";

/**
 * Synthetic throughout. The shipped roster is design-competition's, and a
 * test here that named it would fail the day that module is removed, which
 * is the thing this module promises to survive. The real packs are walked on
 * a scratch canvas instead.
 */
const PACK: RosterCritic = {
  id: "acme",
  title: "Quiet Hands",
  agentName: "Quiet Hands",
  credit: "after Ada Acme & Acme Studio",
  name: "Ada Acme & Acme Studio",
  homage: "An homage to the published work of Ada Acme. Not affiliated with or endorsed by Ada Acme.",
  colour: "#336699",
  critique: ["Is it calm?", "What could go?", "Does the content lead?"],
};

/** A lens file in the packs' shape, preamble line and all. */
const LENS_FILE = `# Quiet Hands — critique

An Acme-inspired critic asks:

1. Is it calm?
2. What could go?
3. Does the content lead?

## What it looks for first

One primary action.

## How it ranks

By the questions, in order.
`;

const DATA_ONLY: CoreModule = { name: "@acme/critics", contributes: { [CRITICS_POINT]: [PACK, { ...PACK, id: "bad", agentName: "Acme Eyes" }] } };

afterEach(() => {
  unregisterModule(critiqueCore.name);
  unregisterModule(DATA_ONLY.name);
});

describe("a critic item round-trips through parsePersona", () => {
  it("reads back everything it was written from", () => {
    const draft = draftFromRoster(PACK, readLens(LENS_FILE));
    const critic = readCritic(criticMarkdown(draft), `${draft.name}.md`)!;
    expect(critic).toEqual({
      name: "quiet-hands",
      agentName: "Quiet Hands",
      credit: "after Ada Acme & Acme Studio; not affiliated",
      color: "#336699",
      self: false,
      budget: { usdPerRun: DEFAULT_BUDGET.usdPerRun, turnsPerRun: DEFAULT_BUDGET.turnsPerRun },
      questions: ["Is it calm?", "What could go?", "Does the content lead?"],
      looksFor: "One primary action.",
      ranks: "By the questions, in order.",
    });
    expect(criticProblems(critic)).toEqual([]);
  });

  it("changes when the text is edited — the card is the critic", () => {
    const text = criticMarkdown(draftFromRoster(PACK, readLens(LENS_FILE)))
      .replace("2. What could go?", "2. What would a tired person miss?")
      .replace("3. Does the content lead?", "3. Does the content lead?\n4. Ignore the palette; that is decided.")
      .replace("agentName: Quiet Hands", "agentName: Still Hands")
      .replace("turns per run: 6", "turns per run: 3");
    const critic = readCritic(text)!;
    expect(critic.agentName).toBe("Still Hands");
    expect(critic.questions).toEqual(["Is it calm?", "What would a tired person miss?", "Does the content lead?", "Ignore the palette; that is decided."]);
    expect(critic.budget).toEqual({ usdPerRun: 0.4, turnsPerRun: 3 });
  });

  it("is not a critic without critic: true", () => {
    const text = criticMarkdown(skeletonDraft("Acme Counter")).replace("critic: true\n", "");
    expect(readCritic(text)).toBeNull();
    expect(readCritic("# just a note\n")).toBeNull();
  });

  it("writes a skeleton as three unwritten questions and the two headings", () => {
    const text = criticMarkdown(skeletonDraft("Acme Counter"));
    expect(text).toContain("## What it looks for first");
    expect(text).toContain("## How it ranks");
    const critic = readCritic(text)!;
    expect(critic.questions).toEqual(["", "", ""]);
    expect(critic.budget).toEqual({ usdPerRun: 0.4, turnsPerRun: 6 });
    expect(criticProblems(critic)).toEqual([]);
  });
});

describe("a critic is named for its principle", () => {
  it("is refused a word of the person it is after", () => {
    const problems = criticProblems(skeletonDraft("Acme Rules", { after: "Ada Acme" }));
    expect(problems.join()).toMatch(/carries "acme" from "Ada Acme" — a critic is named for its principle, never its person/);
  });

  it("is refused a credit that does not say it is not affiliated", () => {
    expect(criticProblems({ agentName: "Quiet Hands", credit: "after Ada Acme", self: false }).join()).toMatch(/credit line must say the critic is not affiliated/);
  });

  it("reads the person off the credit whether or not it says after", () => {
    expect(creditPerson("after Ada Acme's work; not affiliated")).toBe("Ada Acme");
    expect(creditPerson("Ada Acme; not affiliated")).toBe("Ada Acme");
    expect(criticProblems({ agentName: "Ada Says", credit: "Ada Acme; not affiliated", self: false })).not.toEqual([]);
  });

  it("may carry its author's own name when they made it of themselves", () => {
    expect(criticProblems(skeletonDraft("Ada Acme", { after: "Ada Acme", self: true }))).toEqual([]);
  });

  it("is words, because its first word is how a mention finds it", () => {
    expect(criticProblems({ agentName: "Quiet, Hands", credit: "original; not affiliated", self: false }).join()).toMatch(/must be words/);
  });
});

describe("joining a canvas", () => {
  const on = [{ itemId: "itm_1", critic: readCritic(criticMarkdown(draftFromRoster(PACK, readLens(LENS_FILE))))! }];

  it("refuses a second copy of the same critic", () => {
    expect(refuseJoin(on, draftFromRoster(PACK, readLens(LENS_FILE)))).toMatch(/Quiet Hands is already on this canvas \(itm_1\)/);
  });

  it("refuses a first-word clash, because mentions resolve by first word", () => {
    expect(refuseJoin(on, skeletonDraft("Quiet Counter"))).toMatch(/starts with the same word as quiet-hands's agent — @quiet would be ambiguous/);
    expect(canvasClashes([...on, { itemId: "itm_2", critic: { ...on[0]!.critic, name: "quiet-two", agentName: "Quiet Two" } }]).map((c) => c.id)).toEqual(["quiet-two"]);
  });

  it("lets a distinct, well-named critic in", () => {
    expect(refuseJoin(on, skeletonDraft("Acme Counter"))).toBeNull();
  });

  it("finds critic items by their property, not their bytes", () => {
    const item = (id: string, properties: Record<string, string>) => ({ id, properties }) as unknown as Item;
    expect(criticItems({ a: item("a", { [CRITIC_PROP]: "quiet-hands" }), b: item("b", {}) }).map((i) => i.id)).toEqual(["a"]);
  });
});

describe("the roster", () => {
  it("is empty when nothing contributes — and a skeleton still writes", () => {
    registerModule(critiqueCore);
    expect(roster()).toEqual([]);
    expect(readCritic(criticMarkdown(skeletonDraft("Acme Counter")))?.agentName).toBe("Acme Counter");
  });

  it("is what modules contribute to the point, validated, clashes refused", () => {
    registerModule(critiqueCore);
    registerModule(DATA_ONLY);
    const list = roster();
    expect(list.map((e) => e.critic.id)).toEqual(["acme"]);
    expect(findInRoster(list, "quiet-hands")?.critic.id).toBe("acme");
    expect(findInRoster(list, "Quiet Hands")?.module).toBe("@acme/critics");
    expect(rosterProblems({ ...PACK, agentName: "Acme Eyes" }).join()).toMatch(/never its person/);
    expect(lensPath(PACK)).toBe("assets/packs/acme/critique.md");
    expect(lensPath({ ...PACK, dir: "lenses/acme/" })).toBe("lenses/acme/critique.md");
  });

  it("slugs a name into the critic's id", () => {
    expect(criticSlug("Form Follows Emotion")).toBe("form-follows-emotion");
  });
});
