import { describe, expect, it } from "vitest";
import { titleRoom, type Neighbour } from "../src/titleroom.ts";

/**
 * Everything here is world units, y increasing downward, `y` the top edge.
 * The strip is the title row, which sits ON TOP of the item — so the band a
 * reaching name occupies is `y - strip .. y`, and what collides with it is
 * not what a first guess suggests.
 */
const box = (x: number, y: number, w = 100, h = 80) => ({ x, y, width: w, height: h });
const STRIP = 16;

describe("how far a name may reach", () => {
  it("takes the open canvas when nothing is beside it", () => {
    expect(titleRoom(box(0, 0), [], STRIP)).toBe(Infinity);
  });

  it("reaches straight over a neighbour on the same row", () => {
    /**
     * **The case that looks like a collision and is not**, and the reason the
     * first version of these tests was wrong rather than the code.
     *
     * Three cards side by side: the name floats in the band ABOVE them, and
     * that band is empty over every one of them. Stopping at the neighbour's
     * left edge would refuse the space this feature exists to use.
     */
    expect(titleRoom(box(0, 0), [box(260, 0)], STRIP)).toBe(Infinity);
  });

  it("stops at something that actually reaches into the band", () => {
    /* A neighbour sitting higher — its card occupies -40..40 and the name's
       band is -16..0, so the name would be written across it. */
    expect(titleRoom(box(0, 0), [box(260, -40)], STRIP)).toBe(260);
  });

  it("leaves a gap when asked, so the name does not touch what it stopped for", () => {
    expect(titleRoom(box(0, 0), [box(260, -40)], STRIP, 10)).toBe(250);
  });

  it("stops short of a SELECTED neighbour's own name", () => {
    /**
     * The collision the design is actually about. A neighbour a little BELOW
     * us does not reach our band with its card — but if it is selected it is
     * showing its own title, and that row rises into exactly the space our
     * name wants. Cards that do not overlap, names that would.
     */
    const below = box(260, 10);
    expect(titleRoom(box(0, 0), [below], STRIP), "unselected: no name, no clash").toBe(Infinity);
    const selected: Neighbour = { ...below, titled: true };
    expect(titleRoom(box(0, 0), [selected], STRIP)).toBe(260);
  });

  it("ignores a neighbour far below", () => {
    expect(titleRoom(box(0, 0), [box(260, 500)], STRIP)).toBe(Infinity);
  });

  it("ignores anything to its left, which the name grows away from", () => {
    expect(titleRoom(box(300, 0), [box(0, -40)], STRIP)).toBe(Infinity);
  });

  it("never returns less than the card, so hovering cannot shrink a label", () => {
    expect(titleRoom(box(0, 0, 100), [box(40, -40)], STRIP)).toBe(100);
  });

  it("takes the nearest of several", () => {
    expect(titleRoom(box(0, 0), [box(600, -40), box(260, -40), box(900, -40)], STRIP)).toBe(260);
  });
});
