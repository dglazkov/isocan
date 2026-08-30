import { describe, expect, it } from "vitest";
import type { Canvas, CanvasState } from "../src/model.ts";
import { applyOperation } from "../src/reducer.ts";
import {
  CANVAS_SORTS,
  filterCanvases,
  isCanvasSort,
  sortCanvases,
} from "../src/canvassort.ts";
import { opWords } from "../src/opwords.ts";

/**
 * **A hundred canvases is a different screen from ten.**
 *
 * The list was `createdAt` ascending forever, which at ten is a quirk and at a
 * hundred is a wall — and it already produced a reported bug: a new canvas
 * landed at the far end of a list somebody was standing at the top of, so
 * `Create` read as a button that did nothing.
 */
const canvas = (id: string, title: string, created: string, updated: string): Canvas => ({
  id,
  title,
  description: "",
  properties: {},
  createdAt: created,
  createdBy: { id: "u", name: "U" },
  updatedAt: updated,
  updatedBy: { id: "u", name: "U" },
});

const old = canvas("prj_a", "Zebra", "2026-01-01T00:00:00Z", "2026-08-30T00:00:00Z");
const mid = canvas("prj_b", "apple", "2026-05-01T00:00:00Z", "2026-02-01T00:00:00Z");
const fresh = canvas("prj_c", "Ápple", "2026-08-01T00:00:00Z", "2026-06-01T00:00:00Z");
const all = [old, mid, fresh];

describe("ordering a list of canvases", () => {
  it("puts the most recently touched first, by default", () => {
    /* And this is only true because the reducer now stamps the canvas on
       EVERY operation — before that, `updatedAt` moved on a rename, so
       "recent" would have meant "recently retitled". */
    expect(sortCanvases(all, "recent").map((c) => c.id)).toEqual(["prj_a", "prj_c", "prj_b"]);
  });

  it("sorts by name without caring about case or accents", () => {
    /* "apple", "Ápple", "Zebra" — a reader scanning a list does not think
       about code points. */
    expect(sortCanvases(all, "name").map((c) => c.title)).toEqual(["apple", "Ápple", "Zebra"]);
  });

  it("sorts newest-created first, which is the opposite of what shipped", () => {
    // fresh (Aug), mid (May), old (Jan) — newest first.
    expect(sortCanvases(all, "created").map((c) => c.id)).toEqual(["prj_c", "prj_b", "prj_a"]);
  });

  it("breaks ties the same way every time", () => {
    /* Two canvases touched in the same millisecond must not swap places
       between renders, or between the app and the CLI. */
    const same = [
      canvas("prj_z", "One", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
      canvas("prj_a", "Two", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
    ];
    for (const sort of CANVAS_SORTS) {
      const once = sortCanvases(same, sort).map((c) => c.id);
      const twice = sortCanvases([...same].reverse(), sort).map((c) => c.id);
      expect(once, sort).toEqual(twice);
    }
  });

  it("does not mutate what it was given", () => {
    const before = all.map((c) => c.id);
    sortCanvases(all, "name");
    expect(all.map((c) => c.id)).toEqual(before);
  });

  it("recognises only the orderings that exist", () => {
    expect(isCanvasSort("recent")).toBe(true);
    expect(isCanvasSort("size")).toBe(false);
    expect(isCanvasSort(undefined)).toBe(false);
  });
});

describe("finding one among a hundred", () => {
  it("matches every term, in any order", () => {
    /* "lake rules" must find "Rules of the Lake" — nobody remembers the word
       order somebody else used. */
    const rules = canvas("prj_r", "Rules of the Lake", "2026-01-01Z", "2026-01-01Z");
    expect(filterCanvases([rules, old], "lake rules").map((c) => c.id)).toEqual(["prj_r"]);
  });

  it("looks in the description too", () => {
    const noted = { ...old, description: "the sprint board" };
    expect(filterCanvases([noted, mid], "sprint").map((c) => c.id)).toEqual(["prj_a"]);
  });

  it("is everything when nothing is typed", () => {
    expect(filterCanvases(all, "   ")).toHaveLength(3);
  });
});

describe("what a canvas last did, in words", () => {
  it("says the same thing the timeline says", () => {
    expect(opWords("item.add")).toBe("added something");
    expect(opWords("thread.create")).toBe("started a conversation");
  });

  it("has words for every operation a person can cause", () => {
    /* The gap this closes: a card falling back to "did something" for an
       ordinary op is the vocabulary leaking through a screen meant for a
       person. */
    for (const type of ["item.move", "item.update", "item.resize", "thread.reply", "item.react"]) {
      expect(opWords(type), type).toBeDefined();
    }
  });

  it("has nothing to say about an op that does not exist", () => {
    /* And the CALLER decides what to do about that — the track names the raw
       type, a card says "did something". */
    expect(opWords("odd.op")).toBeUndefined();
    expect(opWords(undefined)).toBeUndefined();
  });
});

/**
 * **The stamp itself** — the root of everything above.
 *
 * `withCanvas` returned the project untouched, so `updatedAt`/`updatedBy` moved
 * only for `project.update`. The home screen shows exactly that field and
 * called it activity: the Lake House card read "17 Aug, Admiral One" while the
 * last real operation was twelve days later by somebody else.
 *
 * Nothing asserted this, which is why it survived — the mutation that removes
 * the stamp passed every other test in the suite.
 */
describe("every operation stamps the canvas", () => {
  const seed = () =>
    applyOperation(
      null,
      {
        id: "op_1",
        canvasId: null,
        actor: { id: "usr_a", name: "Ada" },
        ts: "2026-01-01T00:00:00.000Z",
        op: { type: "project.create", canvasId: "prj_1", title: "Board" },
      } as never,
    )!;

  const move = (state: CanvasState, ts: string): CanvasState =>
    applyOperation(state, {
      id: "op_2",
      canvasId: "prj_1",
      actor: { id: "usr_b", name: "Bo" },
      ts,
      op: {
        type: "item.add",
        itemId: "itm_1",
        version: { id: "ver_1", blobHash: "h", mimeType: "text/plain", filename: "f", size: 1 },
        width: 10,
        height: 10,
        placement: { x: 0, y: 0 },
      },
    } as never)!;

  it("moves updatedAt on an ITEM operation, not only on a rename", () => {
    const after = move(seed(), "2026-08-30T00:00:00.000Z");
    expect(after.project.updatedAt).toBe("2026-08-30T00:00:00.000Z");
  });

  it("records who, so a card can name them", () => {
    expect(move(seed(), "2026-08-30T00:00:00.000Z").project.updatedBy.name).toBe("Bo");
  });

  it("records WHAT, so a card need not open a log to find out", () => {
    /* The whole reason the field exists: `listCanvases` reads one metadata
       file per canvas, and a tail read per canvas would make the home screen
       O(canvases) log reads. */
    expect(move(seed(), "2026-08-30T00:00:00.000Z").project.lastOp).toBe("item.add");
  });

  it("leaves a fresh canvas saying it was created", () => {
    expect(seed().project.lastOp).toBeUndefined();
    expect(seed().project.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
