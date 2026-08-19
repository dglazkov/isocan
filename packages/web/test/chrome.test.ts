import { describe, expect, it } from "vitest";
import type { CanvasState, CommentThread, Item } from "@isocan/core";
import { PIN_REACH, badgeCorner, hasRoomForChrome } from "../src/lib/chrome.ts";

const actor = { id: "usr_a", name: "A" };
const stamp = { createdAt: "", createdBy: actor, updatedAt: "", updatedBy: actor };

const item = (x: number, y: number, width = 200, height = 150): Item => ({
  id: "itm_1",
  x,
  y,
  width,
  height,
  title: "Thing",
  description: "",
  properties: {},
  versions: [],
  currentVersionId: "",
  ...stamp,
});

const thread = (x: number, y: number, anchorItemId: string | null = null, main = false): CommentThread => ({
  id: `thr_${x}_${y}`,
  x,
  y,
  anchorItemId,
  comments: [],
  ...(main ? { main: true } : {}),
  createdAt: "",
  createdBy: actor,
});

const canvasWith = (threads: CommentThread[], items: Item[] = []): CanvasState => ({
  items: Object.fromEntries(items.map((one) => [one.id, one])),
  threads: Object.fromEntries(threads.map((one) => [one.id, one])),
  trash: [],
});

describe("hasRoomForChrome", () => {
  it("says yes to an item you can actually read", () => {
    expect(hasRoomForChrome(200, 150, 1)).toBe(true);
  });

  it("says no once the zoom has made it a speck", () => {
    expect(hasRoomForChrome(200, 150, 0.2)).toBe(false);
  });

  it("measures the item on SCREEN, not in the world", () => {
    // A big item still has room until the zoom actually shrinks it: 2000 world
    // units at 5% is a legible 100px, at 2% it is 40px and there is nowhere to
    // put a label.
    expect(hasRoomForChrome(2000, 1500, 0.05)).toBe(true);
    expect(hasRoomForChrome(2000, 1500, 0.02)).toBe(false);
    expect(hasRoomForChrome(60, 44, 1)).toBe(true);
  });

  it("wants both dimensions — a wide sliver has no room either", () => {
    expect(hasRoomForChrome(400, 20, 1)).toBe(false);
  });
});

describe("badgeCorner", () => {
  const box = item(0, 0); // corner at (200, 0)

  it("keeps the top-right corner when nothing is there", () => {
    expect(badgeCorner(box, canvasWith([thread(-500, -500)]), 1)).toBe("ne");
  });

  it("yields the corner to a pin dropped on it", () => {
    expect(badgeCorner(box, canvasWith([thread(205, 4)]), 1)).toBe("se");
  });

  it("follows a pin that rides its anchor item", () => {
    // The thread stores an offset; the pin is wherever the item is now.
    const anchored = thread(198, 2, "itm_1");
    expect(badgeCorner(box, canvasWith([anchored], [box]), 1)).toBe("se");
    const movedAway = { ...box, x: 900 };
    // Same offset, item elsewhere: the pin went with it, so the corner of the
    // ORIGINAL box is free again.
    expect(badgeCorner(box, canvasWith([anchored], [movedAway]), 1)).toBe("ne");
  });

  it("ignores the main thread, which is a panel and has no pin", () => {
    expect(badgeCorner(box, canvasWith([thread(205, 4, null, true)]), 1)).toBe("ne");
  });

  it("gives a pin more world to claim as you zoom out", () => {
    // 60 world units away: within a 46px pin at 0.5 zoom (92 world units),
    // outside it at 1:1.
    const nearby = canvasWith([thread(200 + 60, 0)]);
    expect(badgeCorner(box, nearby, 1)).toBe("ne");
    expect(badgeCorner(box, nearby, 0.5)).toBe("se");
    expect(PIN_REACH / 0.5).toBeGreaterThan(60);
  });

  it("holds its corner with no canvas to look at", () => {
    expect(badgeCorner(box, null, 1)).toBe("ne");
  });
});
