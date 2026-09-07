import { describe, expect, it } from "vitest";
import type { Canvas } from "../src/model.ts";
import { fuzzyMatch, litRuns, rankCanvases } from "../src/canvasswitch.ts";
import { shelvePatch } from "../src/shelf.ts";

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
 * **A canvas somebody put away, and a switcher that is two things at once**
 * (#194).
 *
 * With an empty field this window is a LIST, and the shelf exists because a
 * list that only grows stops meaning "my canvases" — so an archived canvas is
 * out of it, exactly as it is out of the home screen. With something typed it
 * is a SEARCH, and the issue's title asks for one that can reach in: refusing
 * to find a canvas whose name somebody just typed is the other half of this
 * feature failing.
 *
 * Both halves have to hold at once, which is why they are tested together.
 */
describe("the shelf, in a window that is a list and a search", () => {
  const shelved = (one: Canvas): Canvas => ({ ...one, properties: shelvePatch("2026-06-01T00:00:00Z").properties! });
  const all = [
    canvas("c_lake", "Lake House", "2026-03-01T00:00:00Z"),
    shelved(canvas("c_lab", "Lab notes", "2026-04-01T00:00:00Z")),
  ];

  it("keeps it out of the list, however lately it was visited", () => {
    // Recency is the strongest reason a row is offered, so it is the one that
    // would smuggle an archived canvas back in.
    expect(rankCanvases(all, "", ["c_lab", "c_lake"]).map((r) => r.canvas.id)).toEqual(["c_lake"]);
    expect(rankCanvases(all, "", []).map((r) => r.canvas.id)).toEqual(["c_lake"]);
  });

  it("finds it once something is typed — that is the reaching in", () => {
    const rows = rankCanvases(all, "lab", []);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_lab"]);
    expect(rows[0]!.shelved).toBe(true);
    // And the letters still light, because it is a real match, not a
    // consolation row.
    expect(rows[0]!.positions).toEqual([0, 1, 2]);
  });

  it("puts it under every live match, whatever it scored", () => {
    /* "Lab notes" is the better match for "la" by a distance — a prefix, two
       letters together — and it still comes second. The rule is not "usually
       lower": a person scanning for the canvas they are working on must never
       have to look past one they put away. */
    const rows = rankCanvases(all, "la", []);
    expect(rows.map((r) => r.canvas.id)).toEqual(["c_lake", "c_lab"]);
    expect(rows.map((r) => r.shelved)).toEqual([false, true]);
  });

  it("says so on every row it hands over", () => {
    // The marking is what makes offering them safe, so `shelved` is asserted
    // as a fact of the row rather than left to the surface to work out. A
    // surface reading `properties` itself would be the second fold this
    // module exists to prevent.
    for (const row of rankCanvases(all, "l", [])) {
      expect(row.shelved).toBe(row.canvas.id === "c_lab");
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
