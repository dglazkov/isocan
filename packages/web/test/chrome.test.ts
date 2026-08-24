import { describe, expect, it } from "vitest";
import type { CanvasState, CommentThread, Item } from "@isocan/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CHROME_INSET,
  GLYPH_ROOM,
  MIN_NAME_ROOM,
  PIN_REACH,
  STAR_ROOM,
  badgeCorner,
  hasRoomForChrome,
  nameFits,
  nameRoom,
  underSlotFor,
} from "../src/lib/chrome.ts";

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
  const box = item(0, 0); // bottom-right at (200, 150)

  it("is bottom-right, the same place on every item", () => {
    expect(badgeCorner(box, canvasWith([thread(-500, -500)]), 1)).toBe("se");
    expect(badgeCorner(item(900, 900), canvasWith([]), 1)).toBe("se");
  });

  it("leaves a pin dropped on that corner alone and goes up instead", () => {
    expect(badgeCorner(box, canvasWith([thread(205, 154)]), 1)).toBe("ne");
  });

  it("stays put for a pin somewhere else on the item", () => {
    // Top-right, where a pin used to displace it: the badge no longer lives
    // there, so it has nothing to do.
    expect(badgeCorner(box, canvasWith([thread(198, 2)]), 1)).toBe("se");
  });

  it("follows a pin that rides its anchor item", () => {
    // The thread stores an offset; the pin is wherever the item is now.
    const anchored = thread(198, 148, "itm_1");
    expect(badgeCorner(box, canvasWith([anchored], [box]), 1)).toBe("ne");
    const movedAway = { ...box, x: 900 };
    // Same offset, item elsewhere: the pin went with it, so the corner of the
    // ORIGINAL box is free again.
    expect(badgeCorner(box, canvasWith([anchored], [movedAway]), 1)).toBe("se");
  });

  it("ignores the main thread, which is a panel and has no pin", () => {
    expect(badgeCorner(box, canvasWith([thread(205, 154, null, true)]), 1)).toBe("se");
  });

  it("gives a pin more world to claim as you zoom out", () => {
    // 60 world units below the corner: outside a 46px pin at 1:1, inside it
    // once the zoom makes that pin worth 92 world units.
    const nearby = canvasWith([thread(200, 150 + 60)]);
    expect(badgeCorner(box, nearby, 1)).toBe("se");
    expect(badgeCorner(box, nearby, 0.5)).toBe("ne");
    expect(PIN_REACH / 0.5).toBeGreaterThan(60);
  });

  it("holds its home with no canvas to look at", () => {
    expect(badgeCorner(box, null, 1)).toBe("se");
  });
});

/**
 * **A minimum that exceeds what exists is not a minimum, it is an overlap.**
 *
 * The name's width was `Math.max(MIN_NAME_ROOM, width * scale - STAR_ROOM)`.
 * At 13% a 480-unit item is 62 screen pixels; the star wants 26 and the row is
 * inset 5 a side, so 26 is what is left — and the floor handed the name 48, so
 * it was drawn straight through the star. It shipped, and it shipped with the
 * whole suite green, because the rule lived inline in a component that no test
 * could reach (lessons.md #5).
 *
 * These cases are stated without the constants wherever they can be, so
 * retuning the star's room or the row's inset does not make them lie.
 */
describe("the room a name is given", () => {
  const SCALES = [0.02, 0.05, 0.13, 0.5, 1, 3];
  const WIDTHS = [40, 80, 200, 480, 1200, 4000];

  it("is linear in what the item is worth on screen — there is no floor to bend it", () => {
    // A floor is a BEND in this line, and the bend is where the name went
    // through the star. Stated with no constant in it: doubling the item's
    // width adds exactly the item's screen width to the room, at every size
    // and every zoom. `Math.max(48, …)` flattens it to zero below the knee.
    for (const scale of SCALES) {
      for (const width of WIDTHS) {
        expect(
          nameRoom(2 * width, scale) - nameRoom(width, scale),
          `a bend at ${width} world units @ ${scale}`,
        ).toBeCloseTo(width * scale, 6);
      }
    }
  });

  it("never claims more of the item than is left after everything sharing the row", () => {
    // Only where the name is actually SHOWN: below that it is hidden, and what
    // a hidden element was offered is not a thing anybody can see.
    for (const scale of SCALES) {
      for (const width of WIDTHS) {
        if (!nameFits(width, scale)) continue;
        expect(
          nameRoom(width, scale),
          `${width} world units @ ${scale} overflows the star or the kind glyph`,
        ).toBeLessThanOrEqual(
          width * scale - STAR_ROOM - GLYPH_ROOM - CHROME_INSET * 2 + 1e-9,
        );
      }
    }
  });

  it("hides the name rather than squeezing it — the 13% item this was found on", () => {
    // 480 world units at 13% is 62.4 screen px. Measured on the real canvas.
    expect(nameRoom(480, 0.13)).toBeLessThan(MIN_NAME_ROOM);
    expect(nameRoom(480, 0.13)).toBeGreaterThan(0); // there IS room, just not enough
    expect(nameFits(480, 0.13)).toBe(false);
    // …and the same item at 100% is fine, so this is about the zoom and not
    // about the item.
    expect(nameFits(480, 1)).toBe(true);
  });

  it("depends only on what the item is worth on SCREEN, not on how it got there", () => {
    // A big item zoomed out and a small item at 1:1 are the same problem.
    expect(nameRoom(480, 0.13)).toBeCloseTo(nameRoom(62.4, 1), 6);
    expect(nameFits(480, 0.13)).toBe(nameFits(62.4, 1));
  });

  it("brackets the width where a name starts to say something", () => {
    // Room to tune, none to delete. Under ~12 screen px a name is a smudge;
    // over ~120 the threshold would start hiding names on items that plainly
    // have space for one.
    expect(MIN_NAME_ROOM).toBeGreaterThan(12);
    expect(MIN_NAME_ROOM).toBeLessThan(120);
    // And the star's room is real: an item with nothing left over must not be
    // told it can show a name.
    expect(nameFits(STAR_ROOM + GLYPH_ROOM + CHROME_INSET * 2, 1)).toBe(false);
  });
});

/**
 * One number, two homes. `CHROME_INSET` is what ItemView subtracts from the
 * name's width; `.item-titlebar`'s horizontal padding is what actually insets
 * the row. Nothing but this test connects them, and the day they disagree the
 * name is measured against a width it was not given — which is the same
 * arithmetic that drew it through the star.
 */
describe("the row's inset is one number", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../src/styles.css", import.meta.url)),
    "utf8",
  );

  /** `.item-titlebar`'s own rule, comments stripped. */
  function titlebarRule(): string | null {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selectors = (rule[1] ?? "").split(",").map((one) => one.trim());
      if (selectors.includes(".item-titlebar")) return rule[2] ?? "";
    }
    return null;
  }

  it("matches the stylesheet's padding, in screen pixels", () => {
    const rule = titlebarRule();
    expect(rule, "no .item-titlebar rule — renamed, or the parser is wrong").not.toBeNull();
    // Two legal spellings, and only two. A screen-measured inset must divide by
    // --scale; a zero inset has no unit to measure, so it is written `0`.
    // Anything else — `padding: 0 3px` — is WORLD pixels: a different number at
    // every zoom, while ItemView subtracts a screen one.
    const scaled = /padding:\s*0\s+calc\(\s*([\d.]+)px\s*\/\s*var\(--scale/.exec(rule!);
    const zero = /(^|[;{\s])padding:\s*0\s*(;|$)/.test(rule!);
    expect(
      scaled !== null || zero,
      ".item-titlebar must inset by calc(<n>px / var(--scale)), or by `0` when " +
        "there is no inset at all — a bare `<n>px` is world pixels",
    ).toBe(true);
    expect(Number(scaled?.[1] ?? 0), "styles.css and CHROME_INSET disagree").toBe(CHROME_INSET);
  });

  it("does not change when the item is selected", () => {
    // ItemView computes ONE number for both states, so a selected-only inset
    // in CSS is a width the name was never told about. This is the shape that
    // made the row hop 7px in the moment you clicked it.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selector = (rule[1] ?? "").trim();
      if (!/\.item\.selected\b/.test(selector) || !/\.item-titlebar\b/.test(selector)) continue;
      expect(
        rule[2] ?? "",
        `${selector} moves or insets the row only while selected — ItemView cannot see that`,
      ).not.toMatch(/(^|[;{\s])(padding|padding-left|padding-right|top|bottom|left|right)\s*:/);
    }
  });
});

/**
 * One slot under the item, two things that want it.
 *
 * The size chip and "double-click to interact" occupy the same strip. They can
 * share it because their triggers differ, but "differ" is only true if
 * something enforces the precedence — otherwise the day both apply you get two
 * pills stacked under the card, in the space comment pins land in.
 */
describe("the strip under an item", () => {
  const idle = { entered: false, resizing: false, soleSelection: false, interactive: false };

  it("says nothing under a plain unselected image", () => {
    expect(underSlotFor(idle)).toBeNull();
  });

  it("offers the hint on something you could open", () => {
    expect(underSlotFor({ ...idle, interactive: true })).toBe("hint");
  });

  it("shows the size once the item is the sole selection", () => {
    expect(underSlotFor({ ...idle, soleSelection: true })).toBe("size");
  });

  it("prefers the size when both apply — the collision this rule exists for", () => {
    expect(underSlotFor({ ...idle, soleSelection: true, interactive: true })).toBe("size");
    expect(underSlotFor({ ...idle, resizing: true, interactive: true })).toBe("size");
  });

  it("shows the size mid-resize even when the item is not the sole selection", () => {
    // Resizing IS the gesture the number reports on; nothing outranks it.
    expect(underSlotFor({ ...idle, resizing: true })).toBe("size");
  });

  it("says nothing at all once you are inside the item", () => {
    // Entered, your clicks belong to the page — chrome stops talking over it.
    for (const on of [{ soleSelection: true }, { resizing: true }, { interactive: true }]) {
      expect(underSlotFor({ ...idle, ...on, entered: true })).toBeNull();
    }
  });
});
