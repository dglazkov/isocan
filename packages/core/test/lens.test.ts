import { describe, expect, it } from "vitest";
import type { Item } from "../src/model.ts";
import {
  filterLens,
  LENS_REFUSAL,
  LENS_WINDOWS,
  lensEntries,
  lensGroups,
  lensKinds,
  lensSubjects,
  type LensEntry,
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
