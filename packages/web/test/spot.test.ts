import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { spotInView } from "../src/lib/spot.ts";

/**
 * **Somewhere clear, and somewhere you can see.**
 *
 * New items were already kept off each other — `resolvePlacement` runs every
 * `item.add` through `nearestFreeSpot`. What that rule cannot know is where
 * the viewport is, and it searches outward in rings of the ITEM'S OWN SIZE:
 * for a projected site, 800x600, one ring is most of a screen. So the item
 * was placed correctly and arrived somewhere you were not looking, which
 * reads as nothing having happened at all.
 *
 * Asked for after moving the control to the tool rail: "be smart on the
 * placement… it shouldn't show up over something if possible."
 */

const item = (x: number, y: number, width: number, height: number): Item =>
  ({
    id: `itm_${x}_${y}`,
    x,
    y,
    width,
    height,
    title: "",
    description: "",
    properties: {},
    versions: [],
    currentVersionId: "",
    reactions: {},
  }) as unknown as Item;

// Identity viewport: one world unit is one screen pixel, origin at 0,0, so a
// screen box and a world box are the same numbers and the arithmetic under
// test is visible rather than buried in a transform.
const VP = { tx: 0, ty: 0, scale: 1 };
const BOX = { left: 0, top: 0, right: 1000, bottom: 800 };

describe("placing something you asked for where you can see it", () => {
  it("takes the middle of what you are looking at when it is empty", () => {
    const at = spotInView(VP, [], 200, 100, BOX);
    expect(at).toEqual({ x: 400, y: 350 });
  });

  it("steps aside rather than landing on something", () => {
    // An item sitting exactly where the middle would put it.
    const at = spotInView(VP, [item(400, 350, 200, 100)], 200, 100, BOX);
    expect(at, "the centre is taken").not.toEqual({ x: 400, y: 350 });
    // …and what it chose really is clear of it.
    const clear =
      at.x + 200 <= 400 || at.x >= 600 || at.y + 100 <= 350 || at.y >= 450;
    expect(clear, `landed on the occupant at ${JSON.stringify(at)}`).toBe(true);
  });

  it("keeps the whole item inside the area it was given", () => {
    // The point of the exercise: not merely clear, but VISIBLE. A spot that
    // is free because it is off the edge of the screen is the bug.
    const crowd = [item(300, 300, 400, 200), item(0, 0, 300, 300)];
    const at = spotInView(VP, crowd, 200, 100, BOX);
    expect(at.x).toBeGreaterThanOrEqual(BOX.left);
    expect(at.y).toBeGreaterThanOrEqual(BOX.top);
    expect(at.x + 200).toBeLessThanOrEqual(BOX.right);
    expect(at.y + 100).toBeLessThanOrEqual(BOX.bottom);
  });

  it("would rather hand back the middle than a spot off the edge", () => {
    // The whole visible area occupied except a strip past the right edge.
    // A search that forgot to keep the item INSIDE would happily report that
    // strip: genuinely clear, and completely invisible — which is the exact
    // failure this function exists to prevent, dressed as a success.
    const wall = [item(BOX.left, BOX.top, 900, 800)];
    const at = spotInView(VP, wall, 200, 100, BOX);
    expect(at.x + 200, "a clear spot outside the view is not an answer").toBeLessThanOrEqual(
      BOX.right,
    );
    // Nothing inside fits, so the documented fallback is the centre — and
    // the daemon's own rule takes it from there.
    expect(at).toEqual({ x: 400, y: 350 });
  });

  it("falls back to the middle when nothing on screen fits", () => {
    // A cramped view is not a reason to refuse: hand over the centre and let
    // the daemon's own rule do what it always did.
    const at = spotInView(VP, [item(-5000, -5000, 20000, 20000)], 200, 100, BOX);
    expect(at).toEqual({ x: 400, y: 350 });
  });

  it("reads the area it is given, not the window", () => {
    // The left dock is a panel somebody opened at a width they chose, so the
    // placeable area is measured and passed in. Shifting it must move the
    // answer, or the item lands behind the Chat.
    const shifted = spotInView(VP, [], 200, 100, { ...BOX, left: 400 });
    expect(shifted.x).toBeGreaterThan(spotInView(VP, [], 200, 100, BOX).x);
  });
});

/**
 * **Dropped files land where you dropped them.**
 *
 * Reported: images dropped on the canvas "often show up off screen and you
 * have to go hunt for them". `addFiles` sent every file with the SAME
 * placement, so a drop of five asked for five items at one point — and the
 * daemon keeps items off each other by searching outward in rings of the
 * item's own size, which for a 480x360 photo puts the third ring most of a
 * screen away. The drop scattered.
 *
 * Asking for ground that is actually free gives the ring search nothing to
 * do, so the files stay where they were put.
 */
describe("a drop of several files", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../src/lib/upload.ts", import.meta.url)),
    "utf8",
  );
  const addFiles = src.slice(src.indexOf("export async function addFiles"), src.indexOf("export async function addBrowserItem"));

  it("asks for a different spot per file, not one spot for all", () => {
    // The exact shape that broke it: `placement` passed straight through to
    // every op in the loop.
    expect(addFiles, "every file at one point is a scatter, not a drop").toMatch(
      /placement: at\b/,
    );
    expect(addFiles).not.toMatch(/\n\s+placement,\n/);
  });

  it("keeps an anchored placement anchored", () => {
    // "Beside that item" is a relationship, and turning it into coordinates
    // would silently drop it — so only coordinate placements spread.
    expect(addFiles).toMatch(/"x" in placement/);
  });

  it("is one gesture, so one undo takes the whole drop back", () => {
    expect(addFiles).toMatch(/newGroupId\(\)/);
  });
});
