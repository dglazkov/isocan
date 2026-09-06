import { describe, expect, it } from "vitest";
import type { Canvas } from "../src/model.ts";
import { fuzzyMatch, litRuns, rankCanvases } from "../src/canvasswitch.ts";

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
