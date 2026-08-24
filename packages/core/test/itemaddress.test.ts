import { describe, expect, it } from "vitest";
import {
  CANVAS_ROUTE,
  ITEM_ROUTE,
  canvasPath,
  canvasUrl,
  itemPath,
  itemUrl,
  parseCanvasAddress,
} from "../src/index.ts";

/**
 * The address of ONE item, filling the screen.
 *
 * Full screen is a route rather than an operation, and this file is where that
 * decision is held. An operation is a mutation — the reducer applies it, it
 * lands in the oplog, it undoes, both surfaces see it. What somebody is
 * looking at is none of those: your zoom is not my zoom, and an `item.focus`
 * op would drag every open tab to one screen because one person pressed Enter.
 *
 * A route is the third thing: private to a tab, and an ADDRESS — so Back
 * leaves it, a link to one screen is a link to one screen, and `isocan open
 * <item>` can hand somebody the exact view it means. That is how the CLI takes
 * part in a feature with no op to send.
 */

describe("one item's address", () => {
  it("is the canvas's address with the item on the end", () => {
    // Built FROM `canvasPath`, never spelled independently — the whole reason
    // address.ts exists is a second spelling that drifted (`/c/` vs `/p/`).
    expect(itemPath("prj_1", "itm_2")).toBe(`${canvasPath("prj_1")}/i/itm_2`);
  });

  it("agrees with the router's pattern", () => {
    expect(ITEM_ROUTE).toBe(`${CANVAS_ROUTE}/i/:itemId`);
    expect(ITEM_ROUTE.startsWith(CANVAS_ROUTE)).toBe(true);
  });

  it("builds a whole URL the way the canvas does, trailing slash and all", () => {
    expect(itemUrl("https://isocan.io", "prj_1", "itm_2")).toBe(
      "https://isocan.io/p/prj_1/i/itm_2",
    );
    expect(itemUrl("https://isocan.io/", "prj_1", "itm_2")).toBe(
      "https://isocan.io/p/prj_1/i/itm_2",
    );
    expect(itemUrl("http://127.0.0.1:4441", "prj_1", "itm_2")).toBe(
      "http://127.0.0.1:4441/p/prj_1/i/itm_2",
    );
  });

  it("escapes an id that would otherwise change the path", () => {
    expect(itemPath("prj_1", "a/b")).toBe("/p/prj_1/i/a%2Fb");
    expect(itemPath("a/b", "itm_2")).toBe("/p/a%2Fb/i/itm_2");
  });

  it("is NOT a canvas address, and `setup` must keep refusing it", () => {
    // `isocan setup <address>` enrols a machine on a canvas. An address
    // pointing at one screen INSIDE a canvas is a thing to look at, not a
    // thing to set a machine up from — and a parser that quietly widened to
    // accept it would answer a question nobody asked with a canvas nobody
    // named. The canvas address itself still parses, which is the control.
    expect(parseCanvasAddress(itemUrl("https://isocan.io", "prj_1", "itm_2"))).toBeNull();
    expect(parseCanvasAddress(canvasUrl("https://isocan.io", "prj_1"))).toMatchObject({
      canvasId: "prj_1",
    });
  });
});
