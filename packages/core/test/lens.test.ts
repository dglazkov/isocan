import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import type { LogEntry } from "../src/ops.ts";
import {
  filterLens,
  LENS_REFUSAL,
  LENS_WINDOWS,
  lensEntries,
  lensGroups,
  lensKinds,
  lensSubjects,
  type LensEntry,
  lensActs,
  lensShape,
  type LensSource,
} from "../src/lens.ts";

/**
 * **A lens is not a canvas, and the tests are where that stays true.**
 *
 * An item's `x`/`y` belong to the canvas it is on. A view gathering an agent's
 * work from five canvases can hold references to those items but not the
 * items — so it derives its arrangement, stores nothing, and refuses the drag.
 * Copying the items in is the version that looks easiest in week one and is
 * unrecoverable by week four.
 */
const ada = { id: "usr_ada", name: "Ada" };
const bo = { id: "usr_bo", name: "Bo" };

const item = (id: string, by = ada, at = "2026-08-01T00:00:00Z", touchedBy = by): Item =>
  ({
    id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    title: id,
    description: "",
    properties: {},
    versions: [
      {
        id: `ver_${id}`,
        blobHash: "h",
        mimeType: "text/markdown",
        filename: `${id}.md`,
        size: 1,
        createdAt: at,
        createdBy: by,
      },
    ],
    currentVersionId: `ver_${id}`,
    createdAt: at,
    createdBy: by,
    updatedAt: at,
    updatedBy: touchedBy,
  }) as unknown as Item;

const source = (id: string, title: string, items: Item[]): LensSource => ({
  canvasId: id,
  canvasTitle: title,
  canvas: {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: {},
    trash: [],
  },
});

const sources = [
  source("prj_1", "Lake House", [
    item("itm_a", ada, "2026-08-10T00:00:00Z"),
    item("itm_b", bo, "2026-08-11T00:00:00Z"),
  ]),
  source("prj_2", "Sprint", [
    item("itm_c", ada, "2026-08-20T00:00:00Z", bo),
    item("itm_d", ada, "2026-08-05T00:00:00Z"),
  ]),
];

describe("what one actor made, across canvases", () => {
  it("gathers from every canvas, newest first", () => {
    expect(lensEntries(sources, ada.id).map((e) => e.itemId)).toEqual([
      "itm_c",
      "itm_a",
      "itm_d",
    ]);
  });

  it("says which canvas each thing really lives on", () => {
    /* The reference is the whole point — a lens that lost the address would be
       a list of things you cannot get to. */
    const c = lensEntries(sources, ada.id).find((e) => e.itemId === "itm_c");
    expect(c?.canvasId).toBe("prj_2");
    expect(c?.canvasTitle).toBe("Sprint");
  });

  it("is about what somebody MADE, not what they touched", () => {
    /* Moving somebody else's note is not authorship, and a lens that counted
       it would fill an agent's page with other people's work. */
    expect(lensEntries(sources, ada.id).map((e) => e.itemId)).not.toContain("itm_b");
    expect(lensEntries(sources, bo.id).map((e) => e.itemId)).toEqual(["itm_b"]);
  });

  it("notes when other hands have been on it since", () => {
    const byId = new Map(lensEntries(sources, ada.id).map((e) => [e.itemId, e]));
    expect(byId.get("itm_c")?.editedSince).toBe(true);
    expect(byId.get("itm_a")?.editedSince).toBe(false);
  });

  it("has nothing to say about somebody who made nothing", () => {
    expect(lensEntries(sources, "usr_nobody")).toEqual([]);
  });
});

describe("how a lens arranges itself", () => {
  const entries = lensEntries(sources, ada.id);

  it("groups by canvas, newest group first", () => {
    const groups = lensGroups(entries, "canvas");
    expect(groups.map((g) => g.label)).toEqual(["Sprint", "Lake House"]);
    // Both of Ada's Sprint items, newest first within the group.
    expect(groups[0]!.entries.map((e) => e.itemId)).toEqual(["itm_c", "itm_d"]);
  });

  it("groups by day when asked", () => {
    expect(lensGroups(entries, "day").map((g) => g.key)).toEqual([
      "2026-08-20",
      "2026-08-10",
      "2026-08-05",
    ]);
  });

  it("groups by kind when asked", () => {
    expect(lensGroups(entries, "kind").every((g) => g.entries.length > 0)).toBe(true);
  });

  it("opens on the most recent work whichever arrangement is chosen", () => {
    /* Somebody arrives asking "what has this thing been up to". An
       alphabetical wall of canvases answers a different question. */
    for (const by of ["canvas", "day", "kind"] as const) {
      const groups = lensGroups(entries, by);
      const firsts = groups.map((g) => g.entries[0]!.at);
      expect([...firsts].sort().reverse(), by).toEqual(firsts);
    }
  });

  it("is stable — the same entries always arrange the same way", () => {
    expect(lensGroups(entries, "canvas")).toEqual(lensGroups([...entries], "canvas"));
  });
});

describe("the lens refuses the drag", () => {
  it("has one sentence for it, so both surfaces say the same thing", () => {
    expect(LENS_REFUSAL).toMatch(/own canvases/);
  });

  it("stores no position of its own", () => {
    /* The physics: if an entry carried x/y, something would eventually try to
       write them, and there is nowhere true for that write to land. */
    const entry = lensEntries(sources, ada.id)[0]!;
    expect(entry).not.toHaveProperty("x");
    expect(entry).not.toHaveProperty("y");
  });
});

describe("who a lens can be pointed at", () => {
  it("is everybody who made something, by name", () => {
    expect(lensSubjects(sources).map((a) => a.name)).toEqual(["Ada", "Bo"]);
  });
});

/**
 * **Narrowing** (phase 2) — because at three hundred things the gallery is a
 * wall, and the questions somebody arrives with are narrower than "everything
 * this agent ever made".
 */
describe("narrowing a lens", () => {
  const NOW = Date.parse("2026-08-30T12:00:00Z");
  const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
  const entry = (over: Partial<LensEntry>): LensEntry => ({
    itemId: "itm_1",
    canvasId: "prj_1",
    canvasTitle: "One",
    title: "A thing",
    kind: "screen",
    at: hoursAgo(1),
    editedSince: false,
    ...over,
  });

  it("keeps only the kind asked for", () => {
    const all = [entry({ itemId: "a" }), entry({ itemId: "b", kind: "drawing" })];
    expect(filterLens(all, { kind: "drawing" }, NOW).map((e) => e.itemId)).toEqual(["b"]);
  });

  it("keeps only what falls inside the window", () => {
    const all = [
      entry({ itemId: "recent", at: hoursAgo(2) }),
      entry({ itemId: "old", at: hoursAgo(200) }),
    ];
    expect(filterLens(all, { withinHours: 24 }, NOW).map((e) => e.itemId)).toEqual(["recent"]);
  });

  it("treats an unreadable date as not recent", () => {
    /* A filter that lets unknowns through is one somebody stops trusting the
       first time a mystery shows up under "today". */
    const all = [entry({ itemId: "broken", at: "not a date" })];
    expect(filterLens(all, { withinHours: 24 }, NOW)).toEqual([]);
  });

  it("keeps only what nobody else has touched, when asked", () => {
    const all = [
      entry({ itemId: "mine" }),
      entry({ itemId: "theirs", editedSince: true }),
    ];
    expect(filterLens(all, { untouched: true }, NOW).map((e) => e.itemId)).toEqual(["mine"]);
  });

  it("composes — every filter narrows the last", () => {
    const all = [
      entry({ itemId: "keep", kind: "screen", at: hoursAgo(1) }),
      entry({ itemId: "wrongKind", kind: "drawing", at: hoursAgo(1) }),
      entry({ itemId: "tooOld", kind: "screen", at: hoursAgo(500) }),
      entry({ itemId: "touched", kind: "screen", at: hoursAgo(1), editedSince: true }),
    ];
    const got = filterLens(all, { kind: "screen", withinHours: 24, untouched: true }, NOW);
    expect(got.map((e) => e.itemId)).toEqual(["keep"]);
  });

  it("is everything when nothing is asked", () => {
    const all = [entry({ itemId: "a" }), entry({ itemId: "b", kind: "drawing" })];
    expect(filterLens(all, {}, NOW)).toHaveLength(2);
  });

  it("offers only the kinds that are actually there, commonest first", () => {
    /* A chooser listing kinds nobody has made is a menu of dead ends, and the
       count is what makes the choice worth making. */
    const all = [
      entry({ itemId: "a", kind: "screen" }),
      entry({ itemId: "b", kind: "screen" }),
      entry({ itemId: "c", kind: "drawing" }),
    ];
    expect(lensKinds(all)).toEqual([
      { kind: "screen", count: 2 },
      { kind: "drawing", count: 1 },
    ]);
  });

  it("names its windows in the words somebody would choose them by", () => {
    expect(LENS_WINDOWS.map((w) => w.label)).toEqual(["Today", "This week", "This month"]);
    expect(LENS_WINDOWS.every((w) => w.hours > 0)).toBe(true);
  });
});

/**
 * **What somebody DID** (phase 3) — the half a portfolio cannot show.
 *
 * `lensEntries` reads the canvas, so it can only ever show what is still
 * there. An agent that made nine screens and deleted eight looks, in a
 * portfolio, like an agent that made one. The log remembers all nine.
 */
describe("what somebody did, from the log", () => {
  const act = (seq: number, actorId: string, type: string, ts: string): LogEntry =>
    ({
      seq,
      envelope: {
        id: `op${seq}`,
        canvasId: "prj_1",
        actor: { id: actorId, name: actorId === "usr_ada" ? "Ada" : "Bo" },
        ts,
        op: { type },
      },
      inverse: null,
    }) as unknown as LogEntry;

  const logs = [
    {
      canvasId: "prj_1",
      canvasTitle: "One",
      entries: [
        act(1, "usr_ada", "item.add", "2026-08-01T00:00:00Z"),
        act(2, "usr_bo", "item.add", "2026-08-02T00:00:00Z"),
        act(3, "usr_ada", "item.delete", "2026-08-03T00:00:00Z"),
      ],
    },
    {
      canvasId: "prj_2",
      canvasTitle: "Two",
      entries: [act(1, "usr_ada", "item.add", "2026-08-04T00:00:00Z")],
    },
  ];

  it("shows work that no longer exists", () => {
    /* The point of reading the log. `item.delete` is in Ada's history — a
       portfolio would show neither the deleted thing nor the deleting. */
    const acts = lensActs(logs, "usr_ada");
    expect(acts.map((a) => a.op)).toContain("item.delete");
  });

  it("is newest first, across every canvas at once", () => {
    expect(lensActs(logs, "usr_ada").map((a) => a.canvasTitle)).toEqual(["Two", "One", "One"]);
  });

  it("is only that actor's acts", () => {
    expect(lensActs(logs, "usr_bo")).toHaveLength(1);
    expect(lensActs(logs, "usr_nobody")).toEqual([]);
  });

  it("keeps an undo, unlike a timeline's seams", () => {
    /* `majors` skips both ends of an undo pair, because a TRACK that ticks for
       the doing and the undoing tells a story that did not happen. A record of
       what somebody DID is the other question: undoing something is a thing
       they did, and dropping it would be the tidied version. */
    const undone = [
      {
        canvasId: "prj_1",
        canvasTitle: "One",
        entries: [
          { ...act(1, "usr_ada", "item.add", "2026-08-01T00:00:00Z"), undoneBy: 2 },
          { ...act(2, "usr_ada", "item.delete", "2026-08-01T00:01:00Z"), cause: { kind: "undo", targetSeq: 1 } },
        ] as unknown as LogEntry[],
      },
    ];
    expect(lensActs(undone, "usr_ada")).toHaveLength(2);
  });

  it("says the shape of the stretch: how much, where, and mostly what", () => {
    /* The count answers "were they busy"; the commonest act answers "doing
       what", which is what somebody actually asks of an agent nobody watched. */
    expect(lensShape(lensActs(logs, "usr_ada"))).toEqual({
      acts: 3,
      canvases: 2,
      mostly: "item.add",
    });
  });

  it("has a shape for nothing at all", () => {
    expect(lensShape([])).toEqual({ acts: 0, canvases: 0, mostly: null });
  });

  it("takes a predicate, for the selections an id cannot express", () => {
    /* `isocan history di` matches a name prefix and `isocan history` with no
       argument wants everyone. Neither is an id, and neither is a reason for
       a second fold — which is what the CLI had until this existed. */
    const byPrefix = lensActs(logs, (a) => a.name.toLowerCase().startsWith("ad"));
    expect(byPrefix.map((a) => a.actor)).toEqual(["Ada", "Ada", "Ada"]);
    expect(lensActs(logs, () => true)).toHaveLength(4);
  });

  it("can be told what to call somebody, when the log's name is stale", () => {
    /* An agent renamed twice has three names in the log and is one agent. The
       app wants the name AT THE TIME — an honest label on an old act — so
       that stays the default; a CLI table wants one row per person. */
    const renamed = lensActs(logs, "usr_ada", () => "Ada Lovelace");
    expect(new Set(renamed.map((a) => a.actor))).toEqual(new Set(["Ada Lovelace"]));
    expect(lensActs(logs, "usr_ada")[0]!.actor).toBe("Ada");
  });
});
