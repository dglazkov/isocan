import { afterEach, describe, expect, it } from "vitest";
import { registerModule, unregisterModule, type CoreModule, type Item } from "@isocan/core";
import critiqueCore, {
  CRITIC_PROP,
  CRITICS_POINT,
  DEFAULT_BUDGET,
  NOTE_KINDS,
  canvasClashes,
  creditPerson,
  criticItems,
  criticMarkdown,
  criticProblems,
  criticSlug,
  doneLine,
  draftFromRoster,
  findCritic,
  findRequest,
  findInRoster,
  lensPath,
  mentionWord,
  noteBody,
  readCritic,
  readLens,
  readNote,
  readNoteBody,
  refuseJoin,
  requestBody,
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

  it("finds a canvas's critic by its card's names or, through the roster, by the id it was added under", () => {
    const on = [{ itemId: "itm_q", critic: { name: "quiet-hands", agentName: "Quiet Hands" } }];
    const list = [{ module: "@acme/critics", critic: PACK }];
    for (const ref of ["quiet-hands", "Quiet Hands", "quiet", "@Quiet", "acme", "ACME"]) expect(findCritic(on, ref, list)?.itemId, ref).toBe("itm_q");
    expect(findCritic(on, "loud", list)).toBeUndefined();
    // A roster entry with no card on this canvas finds nothing here.
    expect(findCritic([], "acme", list)).toBeUndefined();
  });

  it("slugs a name into the critic's id", () => {
    expect(criticSlug("Form Follows Emotion")).toBe("form-follows-emotion");
  });
});

describe("a critic's note", () => {
  it("writes the kind and the question itself, and reads them back", () => {
    const body = noteBody({ kind: "risk", question: 2, questionText: "What could go?", text: "Two filled buttons compete. Keep Pay; make Save a link." });
    expect(body.split("\n")[0]).toBe("**Risk** · question 2 · *What could go?*");
    expect(readNoteBody(body)).toEqual({ kind: "risk", question: 2, questionText: "What could go?", text: "Two filled buttons compete. Keep Pay; make Save a link." });
    for (const kind of NOTE_KINDS) expect(readNoteBody(noteBody({ kind, question: 1, text: "Leave it." }))?.kind).toBe(kind);
  });

  it("is not a note unless the first line is the verb's — prose cannot promote itself", () => {
    expect(readNoteBody("This is a **Blocker** · question 1\nreally")).toBeNull();
    expect(readNoteBody("**Fatal** · question 1\nno such kind")).toBeNull();
    expect(readNoteBody("Looks fine to me")).toBeNull();
  });

  it("reads a pinned thread back into who, where, kind, question and text", () => {
    const screen = { id: "itm_screen", width: 400, height: 800 } as Item;
    const critic = { id: "act_quiet", name: "Quiet Hands" };
    const thread = {
      id: "thr_1",
      x: 248,
      y: 648,
      anchorItemId: screen.id,
      comments: [{ id: "cmt_1", author: critic, body: noteBody({ kind: "working", question: 3, text: "The total leads. Leave it." }), createdAt: "2026-10-14T10:00:00.000Z" }],
      createdAt: "2026-10-14T10:00:00.000Z",
      createdBy: critic,
    };
    expect(readNote(thread, { [screen.id]: screen })).toEqual({
      threadId: "thr_1",
      critic: "Quiet Hands",
      criticId: "act_quiet",
      item: "itm_screen",
      at: { x: 0.62, y: 0.81 },
      kind: "working",
      question: 3,
      text: "The total leads. Leave it.",
      createdAt: "2026-10-14T10:00:00.000Z",
    });
    expect(readNote({ ...thread, anchorItemId: null }, { [screen.id]: screen })).toBeNull();
    expect(readNote({ ...thread, main: true }, { [screen.id]: screen })).toBeNull();
  });
});

describe("asking, and the last word", () => {
  const ada = { id: "usr_ada", name: "Ada" };
  const request = (id: string, threadId: string, anchor: string | null, items: string[], at: string) => ({
    id: threadId,
    x: 0,
    y: 0,
    anchorItemId: anchor,
    comments: [{ id, author: ada, body: requestBody("Quiet Hands", "Acme checkout"), mentions: ["act_quiet"], items, createdAt: at }],
    createdAt: at,
    createdBy: ada,
  });

  it("mentions the critic by its first word and names the screen by its title", () => {
    expect(mentionWord("Quiet Hands")).toBe("Quiet");
    expect(requestBody("Quiet Hands", "Acme checkout")).toMatch(/^@Quiet what do you make of #Acme checkout\?/);
  });

  it("finds the newest request about this screen, anchored to it or naming it in the Chat", () => {
    const threads = {
      a: request("cmt_a", "thr_a", "itm_screen", [], "2026-10-14T10:00:00.000Z"),
      b: { ...request("cmt_b", "thr_main", null, ["itm_screen"], "2026-10-14T11:00:00.000Z"), main: true },
      c: request("cmt_c", "thr_c", "itm_other", [], "2026-10-14T12:00:00.000Z"),
    };
    expect(findRequest({ threads }, "act_quiet", "itm_screen")).toEqual({ threadId: "thr_main", commentId: "cmt_b", createdAt: "2026-10-14T11:00:00.000Z" });
    expect(findRequest({ threads }, "act_somebody", "itm_screen")).toBeNull();
  });

  it("says how many notes, of what", () => {
    const n = (kind: (typeof NOTE_KINDS)[number]) => ({ kind }) as never;
    expect(doneLine([n("risk"), n("working"), n("risk")], "Acme checkout")).toBe("Done — 3 notes on #Acme checkout: 1 working, 2 risk.");
    expect(doneLine([], "Acme checkout")).toBe("Done — no notes on #Acme checkout.");
  });
});
