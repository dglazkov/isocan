import { describe, expect, it } from "vitest";
import type { Canvas } from "../src/model.ts";
import { fuzzyMatch, litRuns, rankCanvases } from "../src/canvasswitch.ts";
import { inScope, shelvePatch } from "../src/shelf.ts";

/**
 * **The switcher leads with where you were, and takes a few letters to find
 * the rest.**
 *
 * Fuzzy on purpose, where the launcher is not: the launcher's rule guards
 * against a wrong match DOING something, and switching canvases does nothing
 * to any of them. What the scoring must still get right is which of several
 * matches comes first — the obvious reading, not the earliest.
 */
const canvas = (id: string, title: string, updated = "2026-01-01T00:00:00Z", description = ""): Canvas => ({
  id,
  title,
  description,
  properties: {},
  createdAt: "2025-01-01T00:00:00Z",
  createdBy: { id: "u", name: "U" },
  updatedAt: updated,
  updatedBy: { id: "u", name: "U" },
});

describe("fuzzy matching a title", () => {
  it("takes the letters in order, from anywhere", () => {
    expect(fuzzyMatch("lkh", "Lake House")?.positions).toEqual([0, 2, 5]);
  });

  it("refuses a title missing a letter — that is not a low score, it is no match", () => {
    expect(fuzzyMatch("lkz", "Lake House")).toBeNull();
  });

  it("ignores case and the spaces somebody typed", () => {
    expect(fuzzyMatch("LK H", "lake house")?.positions).toEqual([0, 2, 5]);
  });

  it("prefers the word starts over the same letters mid-word", () => {
    // "hs" should land on Home Screen's two capitals, not on the h and s of
    // "Home" alone.
    expect(fuzzyMatch("hs", "Home screen")?.positions).toEqual([0, 5]);
  });

  it("ranks letters together above letters scattered", () => {
    const tight = fuzzyMatch("lake", "Lake House")!.score;
    const loose = fuzzyMatch("lake", "Lonely acre by the keep")!.score;
    expect(tight).toBeGreaterThan(loose);
  });

  it("ranks a prefix above a match that starts later", () => {
    const prefix = fuzzyMatch("road", "Roadmap")!.score;
    const later = fuzzyMatch("road", "The long road")!.score;
    expect(prefix).toBeGreaterThan(later);
  });

  it("matches everything with an empty query", () => {
    expect(fuzzyMatch("", "Anything")).toEqual({ score: 0, positions: [] });
    expect(fuzzyMatch("   ", "Anything")).toEqual({ score: 0, positions: [] });
  });
});

describe("the list the switcher shows", () => {
  const all = [
    canvas("c_lake", "Lake House", "2026-03-01T00:00:00Z"),
    canvas("c_road", "Roadmap", "2026-02-01T00:00:00Z"),
    canvas("c_lab", "Lab notes", "2026-04-01T00:00:00Z"),
    canvas("c_home", "Home screen", "2026-01-01T00:00:00Z", "the front door, redrawn"),
  ];

  it("leads with the recently visited ones, in the order they were visited", () => {
    const rows = rankCanvases(all, "", ["c_road", "c_home"]);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_road", "c_home", "c_lab", "c_lake"]);
    expect(rows.map((r) => r.recent)).toEqual([true, true, false, false]);
  });

  it("orders the rest by activity, the home screen's own default", () => {
    const rows = rankCanvases(all, "", []);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_lab", "c_lake", "c_road", "c_home"]);
  });

  it("never offers the canvas you are on", () => {
    const rows = rankCanvases(all, "", ["c_road", "c_home"], "c_road");
    expect(rows.some((r) => r.canvas.id === "c_road")).toBe(false);
    const typed = rankCanvases(all, "road", ["c_road"], "c_road");
    expect(typed.some((r) => r.canvas.id === "c_road")).toBe(false);
  });

  it("skips a recent id no canvas carries — deleted, or homed elsewhere", () => {
    const rows = rankCanvases(all, "", ["c_gone", "c_lab"]);
    expect(rows[0]!.canvas.id).toBe("c_lab");
    expect(rows).toHaveLength(all.length);
  });

  it("with a query, ranks by the match and lights the letters up", () => {
    const rows = rankCanvases(all, "la", []);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_lab", "c_lake"]);
    expect(rows[0]!.positions).toEqual([0, 1]);
  });

  it("breaks a tie between equal matches by which was visited lately", () => {
    const twins = [
      canvas("c_one", "Design review", "2026-05-01T00:00:00Z"),
      canvas("c_two", "Design review", "2026-01-01T00:00:00Z"),
    ];
    expect(rankCanvases(twins, "de", ["c_two"]).map((r) => r.canvas.id)).toEqual(["c_two", "c_one"]);
    // And with nothing visited, by activity — the same tiebreak as the list.
    expect(rankCanvases(twins, "de", []).map((r) => r.canvas.id)).toEqual(["c_one", "c_two"]);
  });

  it("reaches a description, under every title match, lighting nothing", () => {
    const rows = rankCanvases(all, "door", []);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_home"]);
    expect(rows[0]!.positions).toEqual([]);
    // "re" is in "Roadmap"? No — but it is in "screen" (title) and "redrawn"
    // (description). The title match must come first.
    const both = rankCanvases(all, "re", []);
    expect(both[0]!.canvas.id).toBe("c_home");
  });
});

/**
 * **The switcher's scope: live by default, everything when asked** (#194).
 *
 * The issue asked for a search whose default scope is not everything, and a
 * toggle that widens it to archived canvases. It shipped first without one —
 * archived canvases arrived under every live match once anything was typed —
 * and on 11 Sep the toggle was built as asked: `"live"` hides the shelf from
 * the list AND the search, `"all"` is the toggle, and it is the same
 * `ShelfScope` the terminal's `--with-archived` passes to the same `inScope`.
 */
describe("the shelf, as a scope the switcher is given", () => {
  const shelved = (one: Canvas): Canvas => ({ ...one, properties: shelvePatch("2026-06-01T00:00:00Z").properties! });
  const all = [
    canvas("c_lake", "Lake House", "2026-03-01T00:00:00Z"),
    shelved(canvas("c_lab", "Lab notes", "2026-04-01T00:00:00Z")),
  ];
  const ids = (rows: { canvas: Canvas }[]) => rows.map((r) => r.canvas.id);

  it("keeps it out of the list by default, however lately it was visited", () => {
    // Recency is the strongest reason a row is offered, so it is the one that
    // would smuggle an archived canvas back in.
    expect(ids(rankCanvases(all, "", ["c_lab", "c_lake"]))).toEqual(["c_lake"]);
    expect(ids(rankCanvases(all, "", []))).toEqual(["c_lake"]);
  });

  it("keeps it out of the search by default too — typing is not the toggle", () => {
    // The shipped-first behaviour reached in on any query. The default scope
    // is live, with or without letters in the field.
    expect(ids(rankCanvases(all, "lab", []))).toEqual([]);
    expect(ids(rankCanvases(all, "la", []))).toEqual(["c_lake"]);
  });

  it("includes it when the scope is widened, in the list and the search", () => {
    const list = rankCanvases(all, "", ["c_lab"], null, "all");
    // Visited lately and in scope, so it leads Recent like any other visit.
    expect(ids(list)).toEqual(["c_lab", "c_lake"]);
    expect(list.map((r) => r.recent)).toEqual([true, false]);
    const rows = rankCanvases(all, "lab", [], null, "all");
    expect(ids(rows)).toEqual(["c_lab"]);
    // And the letters still light, because it is a real match.
    expect(rows[0]!.positions).toEqual([0, 1, 2]);
  });

  it("ranks it on its match once asked for, not under every live one", () => {
    /* "Lab notes" is the better match for "la" by a distance — a prefix, two
       letters together. Somebody who widened the search to the shelf is most
       likely looking for something on it, so it is not pushed below a weaker
       live match: one order, as `--with-archived` prints one table. */
    const rows = rankCanvases(all, "la", [], null, "all");
    expect(ids(rows)).toEqual(["c_lab", "c_lake"]);
    expect(rows.map((r) => r.shelved)).toEqual([true, false]);
  });

  it("says so on every row it hands over", () => {
    // The marking is what makes mixing them safe, so `shelved` is asserted as
    // a fact of the row rather than left to the surface to work out. A
    // surface reading `properties` itself would be the second fold this
    // module exists to prevent.
    for (const query of ["", "l"]) {
      for (const row of rankCanvases(all, query, ["c_lab"], null, "all")) {
        expect(row.shelved).toBe(row.canvas.id === "c_lab");
      }
    }
  });

  it("offers exactly the set `inScope` gives the terminal, for every scope", () => {
    /* The parity the both-surfaces rule asks for, held as a set: whatever the
       switcher offers with an empty field under a scope is what
       `canvas list` prints under the flag that names it — `"live"` the
       default, `"shelved"` `--archived`, `"all"` `--with-archived`. */
    for (const scope of ["live", "shelved", "all"] as const) {
      const offered = ids(rankCanvases(all, "", [], null, scope)).sort();
      const listed = all.filter((one) => inScope(one, scope)).map((one) => one.id).sort();
      expect(offered, scope).toEqual(listed);
    }
  });
});

describe("the highlight", () => {
  it("joins adjacent lit letters into one run", () => {
    expect(litRuns("Lake House", [0, 1, 2, 3, 5])).toEqual([
      ["Lake", true],
      [" ", false],
      ["H", true],
      ["ouse", false],
    ]);
  });

  it("lights nothing with no positions", () => {
    expect(litRuns("Lake", [])).toEqual([["Lake", false]]);
  });
});
