import { describe, expect, it } from "vitest";
import {
  MIN_SPAN,
  edgeBeacons,
  formatDistance,
  type Insets,
  type RadarItem,
} from "../src/lib/edgeradar.ts";

const VIEW = { width: 1000, height: 600 };
const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const PAD: Insets = { top: 32, right: 32, bottom: 32, left: 32 };
const AT_ORIGIN = { tx: 0, ty: 0, scale: 1 };

const item = (id: string, x: number, y: number, extra: Partial<RadarItem> = {}): RadarItem => ({
  id,
  title: id,
  x,
  y,
  width: 100,
  height: 100,
  ...extra,
});

describe("edgeBeacons", () => {
  it("says nothing about an item that is on screen", () => {
    expect(edgeBeacons([item("visible", 400, 200)], AT_ORIGIN, VIEW.width, VIEW.height, PAD)).toEqual([]);
  });

  it("says nothing about an item that is only partly out of sight", () => {
    // Straddling the right edge: still visible, so it speaks for itself.
    const straddling = item("half", 950, 200);
    expect(edgeBeacons([straddling], AT_ORIGIN, VIEW.width, VIEW.height, PAD)).toEqual([]);
  });

  it("docks an item off to the right on the padded right edge", () => {
    const [beacon] = edgeBeacons([item("east", 2000, 250)], AT_ORIGIN, VIEW.width, VIEW.height, PAD);
    expect(beacon!.x).toBe(VIEW.width - PAD.right);
    expect(beacon!.y).toBeGreaterThan(0);
    expect(beacon!.y).toBeLessThan(VIEW.height);
    expect(Math.abs(beacon!.angle)).toBeLessThan(45); // pointing east-ish
  });

  it("docks an item above on the padded top edge, pointing up", () => {
    const [beacon] = edgeBeacons([item("north", 450, -2000)], AT_ORIGIN, VIEW.width, VIEW.height, PAD);
    expect(beacon!.y).toBe(PAD.top);
    expect(beacon!.angle).toBeCloseTo(-90, 0);
  });

  it("honors asymmetric insets — the rim clears the furniture", () => {
    const insets: Insets = { top: 64, right: 80, bottom: 72, left: 24 };
    const [east] = edgeBeacons([item("east", 5000, 250)], AT_ORIGIN, VIEW.width, VIEW.height, insets);
    expect(east!.x).toBe(VIEW.width - 80);
    const [west] = edgeBeacons([item("west", -5000, 250)], AT_ORIGIN, VIEW.width, VIEW.height, insets);
    expect(west!.x).toBe(24);
  });

  it("measures distance in world units, not screen pixels", () => {
    const zoomedOut = { tx: 0, ty: 0, scale: 0.5 };
    const [beacon] = edgeBeacons([item("far", 4000, 250)], zoomedOut, VIEW.width, VIEW.height, NONE);
    // Item center is at world (4050, 300); screen center is world (1000, 600).
    expect(beacon!.distance).toBe(Math.round(Math.hypot(4050 - 1000, 300 - 600)));
  });

  it("folds neighbours on the rim into one beacon", () => {
    const beacons = edgeBeacons(
      [item("a", 3000, 200), item("b", 3200, 210), item("c", 3400, 190)],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      PAD,
    );
    expect(beacons).toHaveLength(1);
    expect(beacons[0]!.members.map((m) => m.item.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("lists a cluster's members nearest first — that is the reading order", () => {
    const [beacon] = edgeBeacons(
      [item("far", 4000, 200), item("near", 2000, 205), item("middle", 3000, 195)],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      PAD,
    );
    expect(beacon!.members.map((m) => m.item.id)).toEqual(["near", "middle", "far"]);
    expect(beacon!.members[0]!.distance).toBeLessThan(beacon!.members[2]!.distance);
  });

  it("gives every member its own reading, not the primary's", () => {
    const [beacon] = edgeBeacons(
      [item("a", 2000, 200), item("b", 5000, 200)],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      PAD,
    );
    // Radial distance from the middle of the screen — at scale 1 with no
    // translation that is world (500, 300) — to each item's center.
    const [near, far] = beacon!.members;
    expect(near!.distance).toBe(Math.round(Math.hypot(2050 - 500, 250 - 300)));
    expect(far!.distance).toBe(Math.round(Math.hypot(5050 - 500, 250 - 300)));
  });

  it("keeps beacons apart when they are on opposite rims", () => {
    const beacons = edgeBeacons(
      [item("east", 3000, 200), item("west", -3000, 200)],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      PAD,
    );
    expect(beacons).toHaveLength(2);
  });

  it("gives the label to the most recently touched member of a cluster", () => {
    const beacons = edgeBeacons(
      [
        item("old", 3000, 200, { updatedAt: "2026-01-01T00:00:00.000Z" }),
        item("new", 3100, 205, { updatedAt: "2026-08-01T00:00:00.000Z" }),
      ],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      PAD,
    );
    expect(beacons).toHaveLength(1);
    expect(beacons[0]!.primary.id).toBe("new");
  });

  it("names the wall it docked to, so the pill can sit inside it", () => {
    const at = (x: number, y: number) => edgeBeacons([item("t", x, y)], AT_ORIGIN, VIEW.width, VIEW.height, PAD)[0]!;
    expect(at(3000, 250).side).toBe("right");
    expect(at(-3000, 250).side).toBe("left");
    expect(at(450, -3000).side).toBe("top");
    expect(at(450, 3000).side).toBe("bottom");
  });

  it("gives the bar the item's own height, projected onto the wall", () => {
    const tall: RadarItem = { id: "tall", title: "tall", x: 3000, y: 100, width: 100, height: 400 };
    const [beacon] = edgeBeacons([tall], AT_ORIGIN, VIEW.width, VIEW.height, NONE);
    expect(beacon!.span.to - beacon!.span.from).toBe(400);
    expect(beacon!.span.from).toBe(100);
  });

  it("shrinks the bar with the zoom — the rim shows what you would see", () => {
    const tall: RadarItem = { id: "tall", title: "tall", x: 3000, y: 100, width: 100, height: 400 };
    const [beacon] = edgeBeacons([tall], { tx: 0, ty: 0, scale: 0.5 }, VIEW.width, VIEW.height, NONE);
    expect(beacon!.span.to - beacon!.span.from).toBe(200);
  });

  it("never lets a bar shrink below a size you can point at", () => {
    const speck: RadarItem = { id: "speck", title: "speck", x: 3000, y: 300, width: 4, height: 4 };
    const [beacon] = edgeBeacons([speck], AT_ORIGIN, VIEW.width, VIEW.height, NONE);
    expect(beacon!.span.to - beacon!.span.from).toBe(MIN_SPAN);
  });

  it("keeps the bar inside the stretch of wall it is allowed to use", () => {
    // Off to the right AND well above the window: it docks on the right wall,
    // and its span — which by itself would sit above the screen — is pinned
    // into the usable stretch of that wall.
    const high: RadarItem = { id: "high", title: "high", x: 3000, y: -500, width: 100, height: 100 };
    const [beacon] = edgeBeacons([high], AT_ORIGIN, VIEW.width, VIEW.height, PAD);
    expect(beacon!.side).toBe("right");
    expect(beacon!.span.from).toBeGreaterThanOrEqual(PAD.top);
    expect(beacon!.span.to).toBeLessThanOrEqual(VIEW.height - PAD.bottom);
  });

  it("a cluster's bar covers everything it speaks for", () => {
    const beacons = edgeBeacons(
      [item("a", 3000, 150), item("b", 3200, 260)],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      NONE,
    );
    expect(beacons).toHaveLength(1);
    expect(beacons[0]!.span.from).toBe(150);
    expect(beacons[0]!.span.to).toBe(360);
  });

  it("never merges across a corner — one bar, one wall", () => {
    // Two items that dock within a few pixels of each other AT the top-right
    // corner, one on each wall. Close enough to cluster on distance alone, so
    // only the same-wall rule keeps them apart.
    const beacons = edgeBeacons(
      [
        { id: "onTop", title: "onTop", x: 2083, y: -750, width: 100, height: 100 },
        { id: "onRight", title: "onRight", x: 1450, y: -290, width: 100, height: 100 },
      ],
      AT_ORIGIN,
      VIEW.width,
      VIEW.height,
      NONE,
    );
    expect(beacons.map((b) => b.side).sort()).toEqual(["right", "top"]);
    expect(Math.hypot(beacons[0]!.x - beacons[1]!.x, beacons[0]!.y - beacons[1]!.y)).toBeLessThan(56);
  });

  it("has nothing to say about an empty canvas", () => {
    expect(edgeBeacons([], AT_ORIGIN, VIEW.width, VIEW.height, PAD)).toEqual([]);
  });

  it("gives up rather than dock inside a window with no room", () => {
    const huge: Insets = { top: 400, right: 600, bottom: 400, left: 600 };
    expect(edgeBeacons([item("east", 3000, 200)], AT_ORIGIN, VIEW.width, VIEW.height, huge)).toEqual([]);
  });
});

describe("formatDistance", () => {
  it("reads the way a person would say it", () => {
    expect(formatDistance(1400)).toBe("1,400px away");
    expect(formatDistance(42)).toBe("42px away");
  });
});
