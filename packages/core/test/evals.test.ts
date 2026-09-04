import { describe, expect, it } from "vitest";
import {
  buildCorpus,
  categoriseAsk,
  harvestConverge,
  withLanding,
  harvestPreferences,
  type CanvasContents,
  type LogEntry,
  type Operation,
} from "../src/index.ts";

/**
 * **The corpus is a report about evidence, so its tests are about evidence.**
 *
 * Every case here was written for a mutation that walked past the first draft.
 * The two that matter most, because they are the ways this report could lie
 * and still look right:
 *
 * 1. **A guess counted as a fact.** `how` is the whole discipline of the
 *    module. If `window` rows were reported without the label, or folded into
 *    `opsByAnchorOrReference`, the number a reader trusts would silently
 *    include work nobody established was related. Two tests hold that line
 *    from both directions.
 * 2. **A number that cannot go down.** `silent` is the interesting outcome —
 *    it is the ask nobody answered — and a classifier that never returns it
 *    would read as a healthy canvas. So there is a case per outcome and a
 *    case proving they are exclusive.
 */

const DI = { id: "usr_di", name: "Di" };
const FABLE = { id: "usr_fable", name: "Fable" };

function version(id: string, at: string) {
  return {
    id,
    blobHash: "h",
    mimeType: "text/html",
    filename: "s.html",
    size: 1,
    createdAt: at,
    createdBy: FABLE,
  };
}

function item(id: string, title: string, at: string, versionIds = ["v1"]) {
  const versions = versionIds.map((v) => version(v, at));
  return {
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    title,
    description: "",
    properties: {},
    versions,
    currentVersionId: versions[versions.length - 1]!.id,
    createdAt: at,
    createdBy: FABLE,
    updatedAt: at,
    updatedBy: FABLE,
  };
}

type Comment = CanvasContents["threads"][string]["comments"][number];

function comment(
  id: string,
  body: string,
  author: typeof DI,
  at: string,
  over: Partial<Comment> = {},
): Comment {
  return { id, body, author, createdAt: at, ...over };
}

function thread(
  id: string,
  comments: Comment[],
  over: Partial<CanvasContents["threads"][string]> = {},
): CanvasContents["threads"][string] {
  return {
    id,
    x: 0,
    y: 0,
    anchorItemId: null,
    comments,
    createdAt: comments[0]!.createdAt,
    createdBy: comments[0]!.author,
    ...over,
  };
}

const canvas = (over: Partial<CanvasContents> = {}): CanvasContents => ({
  items: {},
  threads: {},
  trash: [],
  ...over,
});

let seq = 0;
function entry(op: Operation, at: string, actor = FABLE, over: Partial<LogEntry> = {}): LogEntry {
  return {
    seq: ++seq,
    envelope: { id: `op_${seq}`, canvasId: "prj_1", actor, ts: at, op },
    inverse: null,
    ...over,
  };
}

const addOp = (itemId: string, versionId = "v1"): Operation => ({
  type: "item.add",
  itemId,
  version: version(versionId, "2026-08-01T00:00:00.000Z"),
  width: 10,
  height: 10,
  placement: { x: 0, y: 0 },
});

describe("the request corpus", () => {
  it("counts a mentioned comment as an ask and a bare one as ether", () => {
    // The rule the canvas already enforces: outside the Chat, a comment that
    // mentions nobody wakes nobody, so it is not an ask.
    const state = canvas({
      threads: {
        t1: thread("t1", [
          comment("c1", "@Fable build the pricing page", DI, "2026-08-01T10:00:00.000Z", {
            mentions: [FABLE.id],
          }),
        ]),
        t2: thread("t2", [comment("c2", "note to self", DI, "2026-08-01T11:00:00.000Z")]),
      },
    });
    const corpus = buildCorpus(state, []);
    expect(corpus.summary.asks).toBe(1);
    expect(corpus.asks[0]!.commentId).toBe("c1");
  });

  it("treats everything in the Chat as an ask, mention or not", () => {
    // The Chat reaches every agent with no @-mention needed, which is exactly
    // what makes it the Chat. A corpus that required a mention there would
    // report zero asks on the channel people actually use.
    const state = canvas({
      threads: {
        t1: thread("t1", [comment("c1", "make the empty state", DI, "2026-08-01T10:00:00.000Z")], {
          main: true,
        }),
      },
    });
    expect(buildCorpus(state, []).summary.asks).toBe(1);
  });

  it("does not count an enrolled agent's own Chat comment as an ask", () => {
    // Measured on a real canvas: 7 of 11 rows were an agent's own receipts,
    // because in the Chat an answer and a question have the same shape. Where
    // somebody has enrolled the agent, the canvas knows which is which and
    // this must use it.
    const state = canvas({
      agents: { [FABLE.id]: { actor: FABLE } },
      threads: {
        t1: thread(
          "t1",
          [
            comment("c1", "make the empty state", DI, "2026-08-01T10:00:00.000Z"),
            comment("c2", "done — see #Empty", FABLE, "2026-08-01T10:05:00.000Z"),
          ],
          { main: true },
        ),
      },
    });
    const { summary, asks } = buildCorpus(state, []);
    expect(summary.asks).toBe(1);
    expect(asks[0]!.askedBy.name).toBe("Di");
    expect(summary.broadcastUnfiltered).toBe(false);
  });

  it("counts addressed and broadcast apart, and says when broadcast is unfiltered", () => {
    // The split is the honest half of the report: `addressed` is a fact
    // somebody recorded, `broadcast` is an upper bound while nobody has been
    // enrolled. Collapsing them would hand a reader one number with two
    // meanings in it.
    const state = canvas({
      threads: {
        chat: thread("chat", [comment("c1", "make the empty state", DI, "2026-08-01T10:00:00.000Z")], {
          main: true,
        }),
        pin: thread("pin", [
          comment("c2", "@Fable fix this", DI, "2026-08-01T11:00:00.000Z", { mentions: [FABLE.id] }),
        ]),
      },
    });
    const { summary } = buildCorpus(state, []);
    expect(summary).toMatchObject({ asks: 2, addressed: 1, broadcast: 1, broadcastUnfiltered: true });
    expect(summary.addressed + summary.broadcast).toBe(summary.asks);
  });

  it("separates answered, cancelled and silent, and they are exclusive", () => {
    const state = canvas({
      threads: {
        answered: thread("answered", [
          comment("a1", "@Fable do it", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
          comment("a2", "done", FABLE, "2026-08-01T10:05:00.000Z"),
        ]),
        cancelled: thread("cancelled", [
          comment("b1", "@Fable do it", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
          comment("b2", "/cancel", DI, "2026-08-01T10:01:00.000Z"),
        ]),
        silent: thread("silent", [
          comment("c1", "@Fable do it", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
        ]),
      },
    });
    const { summary, asks } = buildCorpus(state, []);
    expect(summary).toMatchObject({ asks: 3, answered: 1, cancelled: 1, silent: 1 });
    // Exclusive: the three counts are the whole of `asks`, so a row cannot be
    // scored twice and none can go uncounted.
    expect(summary.answered + summary.cancelled + summary.silent).toBe(summary.asks);
    expect(asks.find((a) => a.threadId === "answered")!.answeredIn).toBe(300);
    expect(asks.find((a) => a.threadId === "answered")!.answeredBy).toBe("Fable");
  });

  it("does not let the asker answer or cancel on somebody else's behalf", () => {
    // Two halves of one rule, and both were wrong in the first draft. The
    // asker's own follow-up must not close their ask (that is how a thread of
    // "any update?" reads as answered), and a /cancel typed by somebody ELSE
    // is them calling off their own thing, not this.
    const followUp = canvas({
      threads: {
        t1: thread("t1", [
          comment("c1", "@Fable do it", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
          comment("c2", "any update?", DI, "2026-08-01T12:00:00.000Z"),
        ]),
      },
    });
    expect(buildCorpus(followUp, []).summary.silent).toBe(1);

    const othersCancel = canvas({
      threads: {
        t1: thread("t1", [
          comment("c1", "@Fable do it", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
          comment("c2", "/cancel", FABLE, "2026-08-01T10:01:00.000Z"),
        ]),
      },
    });
    expect(buildCorpus(othersCancel, []).summary.cancelled).toBe(0);
  });

  it("lets one /cancel call off the ask it follows, not every ask that person made in the Chat", () => {
    // Measured 3 Sep 2026: one `/cancel` typed in the Chat after sixteen asks
    // marked all sixteen cancelled, because the Chat is one thread and the
    // first reading was "any later /cancel by the asker". The cancel belongs
    // to the asker's most recent ask before it; the answered ones before that
    // stay answered.
    const state = canvas({
      threads: {
        main: thread(
          "main",
          [
            comment("c1", "build the tracker", DI, "2026-08-01T10:00:00.000Z"),
            comment("c2", "done", FABLE, "2026-08-01T10:05:00.000Z"),
            comment("c3", "now a gallery", DI, "2026-08-01T10:10:00.000Z"),
            comment("c4", "done", FABLE, "2026-08-01T10:15:00.000Z"),
            comment("c5", "and grill me on it", DI, "2026-08-01T10:20:00.000Z"),
            comment("c6", "/cancel", DI, "2026-08-01T10:21:00.000Z"),
          ],
          { main: true },
        ),
      },
    });
    const { summary, asks } = buildCorpus(state, []);
    // Nobody is enrolled here, so Fable's "done"s are counted as asks too
    // (the upper-bound case); the person's four are the ones under test.
    const mine = asks.filter((a) => a.askedBy.id === DI.id);
    // The `/cancel` row is itself counted (it is a Chat comment by a person)
    // and nobody spoke after it, so it reads silent — which is right: it asked
    // for nothing.
    expect(mine.map((a) => a.outcome)).toEqual(["answered", "answered", "cancelled", "silent"]);
    expect(summary.cancelled).toBe(1);
  });

  it("reads what kind of ask it is, and carries the caveat that it is a reading", () => {
    // The categories came out of hand-labelling every human ask at one home
    // (the research note); these are the shapes each one was named for, so a
    // rewrite of the classifier that loses one of them fails here rather than
    // in the next distribution.
    const cases: [string, string | null, ReturnType<typeof categoriseAsk>][] = [
      ["Can you build me a greeting card for Yu?", null, "create"],
      ["sketch a picture of dion, line art like a 5 year old", null, "create"],
      ["Can you replace the screenshot in slide 02 with the one selected here?", null, "revise"],
      ["can we reorder the days so they show up sorted by recency", null, "revise"],
      ["Can you redesign this as though it is a high end Airbnb listing?", null, "restyle"],
      ["Can you give me 3 variations that just change the font?", null, "variation"],
      ["Take the best of both and come up with a new version", null, "converge"],
      ["Can you both critique each of your versions and tell me which one is superior?", null, "critique"],
      ["When I full screen the slides they aren't taking the full width — can you fix that?", null, "repair"],
      ["can you rearrange the screens so they are organized well?", null, "arrange"],
      ["Can you create a README.md on the canvas that keeps an up to date spec?", null, "document"],
      ["how did you build it? This is amazing.", null, "question"],
      ["@Cana this one's for you", null, "orchestrate"],
      ["@Canny 🤖", null, "orchestrate"],
      ["Can we push the quiz to github pages so it can be hosted?", null, "ops"],
      ["amazing", null, "social"],
      ["/format grid", "format", "arrange"],
      ["/variation very different styles", "variation", "variation"],
      ["/design-audit", "design-audit", "critique"],
      ["/cancel changed my mind", "cancel", "cancel"],
      ["/sprint", "sprint", "orchestrate"],
    ];
    for (const [body, command, want] of cases) expect(categoriseAsk(body, command), body).toBe(want);

    const state = canvas({
      threads: {
        t1: thread("t1", [
          comment("c1", "@Fable build me a card", DI, "2026-08-01T10:00:00.000Z", { mentions: [FABLE.id] }),
        ]),
      },
    });
    const { summary, asks } = buildCorpus(state, []);
    expect(asks[0]!.category).toBe("create");
    expect(summary.categories).toEqual([{ name: "create", count: 1, silent: 1 }]);
  });

  it("reads the slash command an ask opens with, and only at the start", () => {
    // `/format` halfway through a sentence is somebody TALKING about the
    // command. The guide says so to agents; the corpus must not disagree.
    const state = canvas({
      threads: {
        t1: thread("t1", [
          comment("c1", "/design-audit the header", DI, "2026-08-01T10:00:00.000Z", {
            mentions: [FABLE.id],
          }),
        ]),
        t2: thread("t2", [
          comment("c2", "should we run /format here?", DI, "2026-08-01T11:00:00.000Z", {
            mentions: [FABLE.id],
          }),
        ]),
      },
    });
    const { summary, asks } = buildCorpus(state, []);
    expect(summary.commands).toEqual([{ name: "design-audit", count: 1 }]);
    expect(asks.find((a) => a.threadId === "t2")!.command).toBeNull();
  });
});

describe("attribution says how it knows", () => {
  const ask = comment("c1", "@Fable fix this", DI, "2026-08-01T10:00:00.000Z", {
    mentions: [FABLE.id],
  });

  it("calls an op on the anchored item `anchor`", () => {
    const state = canvas({
      items: { itm_a: item("itm_a", "Header", "2026-08-01T09:00:00.000Z") },
      threads: { t1: thread("t1", [ask], { anchorItemId: "itm_a" }) },
    });
    const log = [
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v2", "2026-08-01T10:01:00.000Z") }, "2026-08-01T10:01:00.000Z"),
    ];
    const [row] = buildCorpus(state, log).asks;
    expect(row!.produced).toEqual([
      { seq: log[0]!.seq, type: "item.addVersion", itemId: "itm_a", how: "anchor", undone: false },
    ]);
  });

  it("calls an op on a referenced item `reference`, from the ask or the answer", () => {
    const state = canvas({
      items: { itm_b: item("itm_b", "Footer", "2026-08-01T09:00:00.000Z") },
      threads: {
        t1: thread("t1", [
          comment("c1", "@Fable fix #Footer", DI, "2026-08-01T10:00:00.000Z", {
            mentions: [FABLE.id],
            items: ["itm_b"],
          }),
        ]),
      },
    });
    const log = [entry({ type: "item.move", itemId: "itm_b", x: 5, y: 5 }, "2026-08-01T10:02:00.000Z")];
    expect(buildCorpus(state, log).asks[0]!.produced[0]!.how).toBe("reference");
  });

  it("prefers `anchor` when the item is both anchored and named", () => {
    // The module's comment claims this precedence in words. Swapping the two
    // branches passed every other case here, because no other case has an
    // item that is both — which is the shape of a comment asserting behaviour
    // nothing checks. `anchor` is the stronger claim and must win: reporting
    // `reference` would understate what is known about the row.
    const state = canvas({
      items: { itm_a: item("itm_a", "Header", "2026-08-01T09:00:00.000Z") },
      threads: {
        t1: thread(
          "t1",
          [
            comment("c1", "@Fable fix #Header", DI, "2026-08-01T10:00:00.000Z", {
              mentions: [FABLE.id],
              items: ["itm_a"],
            }),
          ],
          { anchorItemId: "itm_a" },
        ),
      },
    });
    const log = [entry({ type: "item.move", itemId: "itm_a", x: 2, y: 2 }, "2026-08-01T10:01:00.000Z")];
    expect(buildCorpus(state, log).asks[0]!.produced[0]!.how).toBe("anchor");
  });

  it("labels a merely-timely op `window`, and keeps it out of the trusted count", () => {
    // This is the test the module exists to make possible. The op is on an
    // item nobody named, by the agent who was asked, inside the window — a
    // reasonable guess and nothing more. It is reported, and it does NOT
    // count toward `opsByAnchorOrReference`.
    const state = canvas({
      items: { itm_c: item("itm_c", "Something else", "2026-08-01T09:00:00.000Z") },
      threads: { t1: thread("t1", [ask]) },
    });
    const log = [entry(addOp("itm_c"), "2026-08-01T10:03:00.000Z")];
    const { summary, asks } = buildCorpus(state, log);
    expect(asks[0]!.produced[0]!.how).toBe("window");
    expect(summary.opsAttributed).toBe(1);
    expect(summary.opsByAnchorOrReference).toBe(0);
  });

  it("closes the window at the next thing said, and ignores ops by other people", () => {
    const state = canvas({
      threads: {
        t1: thread("t1", [
          ask,
          comment("c2", "thanks", DI, "2026-08-01T10:10:00.000Z"),
        ]),
      },
    });
    const log = [
      entry(addOp("itm_in"), "2026-08-01T10:05:00.000Z"),
      // After the next word: outside the window.
      entry(addOp("itm_late"), "2026-08-01T10:20:00.000Z"),
      // Inside the window, but by somebody the ask did not address.
      entry(addOp("itm_other"), "2026-08-01T10:06:00.000Z", DI),
    ];
    expect(buildCorpus(state, log).asks[0]!.produced.map((p) => p.itemId)).toEqual(["itm_in"]);
  });

  it("never attributes an op that happened before the ask", () => {
    const state = canvas({
      items: { itm_a: item("itm_a", "Header", "2026-08-01T09:00:00.000Z") },
      threads: { t1: thread("t1", [ask], { anchorItemId: "itm_a" }) },
    });
    const log = [entry({ type: "item.move", itemId: "itm_a", x: 1, y: 1 }, "2026-08-01T09:30:00.000Z")];
    expect(buildCorpus(state, log).asks[0]!.produced).toEqual([]);
  });

  it("reports an undone op as work the person reversed, not as work undone twice", () => {
    // An undo is a verdict, and it arrives as its own log entry. Counting the
    // undo entry as work the ask produced would credit it twice and with the
    // wrong sign; the signal belongs on the op that was reversed.
    const state = canvas({
      items: { itm_a: item("itm_a", "Header", "2026-08-01T09:00:00.000Z") },
      threads: { t1: thread("t1", [ask], { anchorItemId: "itm_a" }) },
    });
    // Deliberately NOT setting `undoneBy` on the entry: it never crosses the
    // wire, so a corpus that read it would report zero undone for every canvas
    // in the world. The undo entry below is the whole evidence.
    const done = entry({ type: "item.move", itemId: "itm_a", x: 9, y: 9 }, "2026-08-01T10:01:00.000Z");
    const theUndo = entry({ type: "item.move", itemId: "itm_a", x: 0, y: 0 }, "2026-08-01T10:02:00.000Z", FABLE, {
      cause: { kind: "undo", targetSeq: done.seq },
    });
    const { summary, asks } = buildCorpus(state, [done, theUndo]);
    expect(asks[0]!.produced).toHaveLength(1);
    expect(asks[0]!.produced[0]!.undone).toBe(true);
    expect(summary.opsUndone).toBe(1);
  });
});

describe("the converge lane's landings, and whether people kept them", () => {
  const T0 = "2026-09-03T03:00:00.000Z";
  const later = Date.parse(T0) + 13 * 3600e3; // a morning has passed
  const stacked = (id: string, versions: string[], current: string, converged?: string) => {
    const it = item(id, id, "2026-09-01T00:00:00.000Z", versions);
    return { ...it, currentVersionId: current, properties: { ...it.properties, ...(converged ? { converged } : {}) } };
  };

  it("appends a landing to the property rather than replacing the last one", () => {
    expect(withLanding(undefined, "v2", T0)).toBe(`v2@${T0}`);
    expect(withLanding(`v2@${T0}`, "v3", "2026-09-04T03:00:00.000Z")).toBe(`v2@${T0},v3@2026-09-04T03:00:00.000Z`);
  });

  it("calls a landing kept, built on, reverted or standing by the stack alone", () => {
    const state = canvas({
      items: {
        kept: stacked("kept", ["v1", "v2"], "v2", `v2@${T0}`),
        builtOn: stacked("builtOn", ["v1", "v2", "v3"], "v3", `v2@${T0}`),
        reverted: stacked("reverted", ["v1", "v2"], "v1", `v2@${T0}`),
        standing: stacked("standing", ["v1", "v2"], "v2", `v2@${new Date(later - 3600e3).toISOString()}`),
        untouched: stacked("untouched", ["v1"], "v1"),
      },
    });
    const report = harvestConverge(state, later);
    const by = Object.fromEntries(report.landings.map((l) => [l.itemId, l.status]));
    expect(by).toEqual({ kept: "kept", builtOn: "built-on", reverted: "reverted", standing: "standing" });
    // Standing is excluded from the rate, so a fresh night cannot move the battery before anyone looked.
    expect(report).toMatchObject({ kept: 2, reverted: 1, standing: 1 });
    expect(report.acceptRate).toBeCloseTo(2 / 3);
  });

  it("has no rate until something has been judged", () => {
    const state = canvas({ items: { s: stacked("s", ["v1", "v2"], "v2", `v2@${new Date(later).toISOString()}`) } });
    expect(harvestConverge(state, later).acceptRate).toBeNull();
  });
});

describe("preference pairs, harvested from version stacks", () => {
  it("is a pair only when an earlier version was chosen over later ones", () => {
    const state = canvas({ items: { itm_a: item("itm_a", "Hero", "2026-08-01T09:00:00.000Z", ["v1", "v2", "v3"]) } });
    const log = [
      entry(addOp("itm_a", "v1"), "2026-08-01T09:00:00.000Z"),
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v2", "2026-08-01T09:01:00.000Z") }, "2026-08-01T09:01:00.000Z"),
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v3", "2026-08-01T09:02:00.000Z") }, "2026-08-01T09:02:00.000Z"),
      entry({ type: "item.setCurrentVersion", itemId: "itm_a", versionId: "v2" }, "2026-08-01T09:03:00.000Z", DI),
    ];
    const pairs = harvestPreferences(state, log);
    expect(pairs).toEqual([
      {
        itemId: "itm_a",
        title: "Hero",
        chosen: "v2",
        chosenAt: "2026-08-01T09:03:00.000Z",
        chosenBy: "Di",
        chosenById: "usr_di",
        against: ["v1", "v3"],
      },
    ]);
  });

  it("is not a pair when the newest version is made current — that is a save", () => {
    // The mutation this exists for: dropping the `at === stack.length - 1`
    // check inflates the harvest with every ordinary save, and an inflated
    // count here reads as "Stage 4's calibration problem is solved."
    const state = canvas({ items: { itm_a: item("itm_a", "Hero", "2026-08-01T09:00:00.000Z", ["v1", "v2"]) } });
    const log = [
      entry(addOp("itm_a", "v1"), "2026-08-01T09:00:00.000Z"),
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v2", "2026-08-01T09:01:00.000Z") }, "2026-08-01T09:01:00.000Z"),
      entry({ type: "item.setCurrentVersion", itemId: "itm_a", versionId: "v2" }, "2026-08-01T09:02:00.000Z", DI),
    ];
    expect(harvestPreferences(state, log)).toEqual([]);
  });

  it("is not a pair when there was only ever one version", () => {
    const state = canvas({ items: { itm_a: item("itm_a", "Hero", "2026-08-01T09:00:00.000Z") } });
    const log = [
      entry(addOp("itm_a", "v1"), "2026-08-01T09:00:00.000Z"),
      entry({ type: "item.setCurrentVersion", itemId: "itm_a", versionId: "v1" }, "2026-08-01T09:02:00.000Z", DI),
    ];
    expect(harvestPreferences(state, log)).toEqual([]);
  });

  it("counts only the versions that existed at the time of the choice", () => {
    // `against` must mean "and rejected these", which is a fact about that
    // moment. A version added afterwards was never in the running, and
    // reading the item's CURRENT stack instead of replaying the log is how it
    // would end up in the list.
    const state = canvas({ items: { itm_a: item("itm_a", "Hero", "2026-08-01T09:00:00.000Z", ["v1", "v2", "v3"]) } });
    const log = [
      entry(addOp("itm_a", "v1"), "2026-08-01T09:00:00.000Z"),
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v2", "2026-08-01T09:01:00.000Z") }, "2026-08-01T09:01:00.000Z"),
      entry({ type: "item.setCurrentVersion", itemId: "itm_a", versionId: "v1" }, "2026-08-01T09:02:00.000Z", DI),
      entry({ type: "item.addVersion", itemId: "itm_a", version: version("v3", "2026-08-01T09:03:00.000Z") }, "2026-08-01T09:03:00.000Z"),
    ];
    expect(harvestPreferences(state, log)[0]!.against).toEqual(["v2"]);
  });
});
