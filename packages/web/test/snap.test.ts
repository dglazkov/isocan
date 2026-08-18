import { describe, expect, it } from "vitest";
import { snapBox, unionBox, type Box } from "../src/lib/snap.ts";

const box = (x: number, y: number, width = 100, height = 100): Box => ({ x, y, width, height });

describe("snapBox", () => {
  const anchor = box(200, 200);

  it("snaps nothing when the threshold is zero, however close", () => {
    expect(snapBox(box(201, 200), [anchor], 0)).toEqual({ dx: 0, dy: 0, guides: [], spacing: [] });
  });

  it("pulls a near-aligned left edge onto the line, and says which line", () => {
    const snap = snapBox(box(204, 500), [anchor], 6);
    expect(snap.dx).toBe(-4);
    expect(snap.guides).toContainEqual({ axis: "x", at: 200 });
  });

  it("leaves an edge alone once it is further than the threshold", () => {
    expect(snapBox(box(210, 500), [anchor], 6).dx).toBe(0);
  });

  it("aligns centers, not just edges", () => {
    // Moving box is 50 wide: its center sits at x+25, the anchor's at 250.
    const snap = snapBox({ x: 222, y: 500, width: 50, height: 50 }, [anchor], 6);
    expect(snap.dx).toBe(3);
    expect(snap.guides).toContainEqual({ axis: "x", at: 250 });
  });

  it("snaps a right edge to a left edge — abutting counts as alignment", () => {
    const snap = snapBox(box(98, 500), [anchor], 6);
    expect(snap.dx).toBe(2); // right edge 198 → 200
    expect(snap.guides).toContainEqual({ axis: "x", at: 200 });
  });

  it("takes the nearest candidate when several are in reach", () => {
    const snap = snapBox(box(203, 500), [anchor, box(196, 900)], 8);
    expect(snap.dx).toBe(-3); // 200 is 3 away, 196 is 7
  });

  it("snaps both axes at once, and reports a line for each", () => {
    const snap = snapBox(box(203, 197), [anchor], 6);
    expect([snap.dx, snap.dy]).toEqual([-3, 3]);
    expect(snap.guides).toEqual(
      expect.arrayContaining([
        { axis: "x", at: 200 },
        { axis: "y", at: 200 },
      ]),
    );
  });

  it("reports every line the settled position satisfies, once each", () => {
    // Two anchors sharing a left edge. Landing on it aligns the left edges,
    // and — same size — the centers and right edges too: three lines, and the
    // shared 200 is one line rather than one per anchor.
    const snap = snapBox(box(203, 500), [anchor, box(200, 700)], 6);
    expect(snap.guides.filter((g) => g.axis === "x").map((g) => g.at)).toEqual([200, 250, 300]);
  });

  it("has nothing to align to on an empty canvas", () => {
    expect(snapBox(box(0, 0), [], 12)).toEqual({ dx: 0, dy: 0, guides: [], spacing: [] });
  });
});

describe("unionBox", () => {
  it("is null for nothing", () => {
    expect(unionBox([])).toBeNull();
  });

  it("contains every box — a group drag snaps as one shape", () => {
    expect(unionBox([box(10, 10), box(100, 200, 50, 50)])).toEqual({
      x: 10,
      y: 10,
      width: 140,
      height: 240,
    });
  });
});

describe("equal spacing", () => {
  // Three boxes in a row: 100 wide each, at x=0 and x=400, same band.
  const left = { x: 0, y: 0, width: 100, height: 100 };
  const right = { x: 400, y: 0, width: 100, height: 100 };

  it("centers a box between its neighbours so both gaps match", () => {
    // Dead center is x=200 (gaps of 100). Start 5 short of it.
    const snap = snapBox({ x: 195, y: 0, width: 100, height: 100 }, [left, right], 8);
    expect(snap.dx).toBe(5);
    const spacing = snap.spacing.find((s) => s.axis === "x")!;
    expect(spacing.gaps).toEqual([
      [100, 200],
      [300, 400],
    ]);
    expect(spacing.at).toBe(50); // the bars are drawn across the box's middle
  });

  it("stays out of reach beyond the threshold", () => {
    const snap = snapBox({ x: 180, y: 0, width: 100, height: 100 }, [left, right], 8);
    expect(snap.dx).toBe(0);
    expect(snap.spacing).toEqual([]);
  });

  it("ignores boxes in another band — an item on another row is not beside it", () => {
    const elsewhere = { x: 400, y: 900, width: 100, height: 100 };
    const snap = snapBox({ x: 195, y: 0, width: 100, height: 100 }, [left, elsewhere], 8);
    expect(snap.spacing).toEqual([]);
  });

  it("yields to alignment on the same axis — landing on a line is the stronger claim", () => {
    // A fourth box whose left edge is 2 away: alignment takes x, and the
    // equal-gap measure does not also try to move it.
    const aligned = { x: 197, y: 900, width: 100, height: 100 };
    const snap = snapBox({ x: 195, y: 0, width: 100, height: 100 }, [left, right, aligned], 8);
    expect(snap.dx).toBe(2);
    expect(snap.spacing.some((s) => s.axis === "x")).toBe(false);
  });

  it("works down the other axis too", () => {
    const above = { x: 0, y: 0, width: 100, height: 100 };
    const below = { x: 0, y: 400, width: 100, height: 100 };
    const snap = snapBox({ x: 0, y: 196, width: 100, height: 100 }, [above, below], 8);
    expect(snap.dy).toBe(4);
    expect(snap.spacing.find((s) => s.axis === "y")!.gaps).toEqual([
      [100, 200],
      [300, 400],
    ]);
  });

  it("refuses to call an overlap a gap", () => {
    const touching = { x: 100, y: 0, width: 100, height: 100 };
    const snap = snapBox({ x: 99, y: 0, width: 100, height: 100 }, [left, touching], 8);
    expect(snap.spacing).toEqual([]);
  });
});
