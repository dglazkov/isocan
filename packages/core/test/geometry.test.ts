import { describe, expect, it } from "vitest";
import { OpValidationError } from "../src/index.ts";
import type { Operation } from "../src/index.ts";
import { apply, nv, seedState } from "./helpers.ts";

/**
 * Every coordinate and every size that reaches the canvas is a real number.
 *
 * `NaN` is the one bad input that does not announce itself. It compares false
 * against everything, so no comparison downstream throws; it lays out, it
 * renders as a blank, and then `JSON.stringify(NaN)` is **`null`** — so what
 * actually lands in the oplog is `"x": null`, permanently, and the item is
 * unreachable from both surfaces from then on. There is no undo for it either:
 * the op applied.
 *
 * Found by typing `isocan mv <item> --to 300,200`. `mv` allows unknown options
 * so that `mv itm -80 420` can pass a negative x, and the same permission made
 * `--to` an operand — so `Number("--to")` was the x. The CLI now refuses that
 * with a better message, but the CLI is not the only writer, and this is the
 * layer both writers share.
 */

const bad = [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["-Infinity", Number.NEGATIVE_INFINITY],
] as const;

/** Every op that carries a coordinate or a size, per bad value. */
function refusals(value: number): Array<[string, Operation]> {
  return [
    ["item.move x", { type: "item.move", itemId: "itm_1", x: value, y: 10 }],
    ["item.move y", { type: "item.move", itemId: "itm_1", x: 10, y: value }],
    ["item.resize", { type: "item.resize", itemId: "itm_1", width: value, height: 10 }],
    [
      "items.move",
      { type: "items.move", moves: [{ itemId: "itm_1", x: value, y: 0 }] },
    ],
    [
      "item.add size",
      {
        type: "item.add",
        itemId: "itm_new",
        version: nv("ver_new"),
        width: value,
        height: 100,
        placement: { x: 0, y: 0 },
      },
    ],
    [
      "item.add placement",
      {
        type: "item.add",
        itemId: "itm_new2",
        version: nv("ver_new2"),
        width: 100,
        height: 100,
        placement: { x: value, y: 0 },
      },
    ],
    [
      "thread.create",
      {
        type: "thread.create",
        threadId: "thr_new",
        x: value,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_new", body: "hi" },
      },
    ],
    [
      "thread.setAnchor",
      { type: "thread.setAnchor", threadId: "thr_1", anchorItemId: null, x: value, y: 0 },
    ],
  ] as Array<[string, Operation]>;
}

describe("geometry is finite", () => {
  for (const [name, value] of bad) {
    for (const [what, op] of refusals(value)) {
      it(`refuses ${name} in ${what}`, () => {
        expect(() => apply(seedState(), op)).toThrow(OpValidationError);
      });
    }
  }

  it("says which field was wrong", () => {
    // A refusal nobody can act on is only half a guard.
    expect(() =>
      apply(seedState(), { type: "item.move", itemId: "itm_1", x: Number.NaN, y: 10 }),
    ).toThrow(/x must be a finite number/);
  });

  it("refuses the batch WHOLE when one move is bad", () => {
    // A batch is one undo step, so a batch that half-applies is a batch undo
    // cannot take back.
    const before = seedState();
    expect(() =>
      apply(before, {
        type: "items.move",
        moves: [
          { itemId: "itm_1", x: 500, y: 500 },
          { itemId: "itm_2", x: Number.NaN, y: 0 },
        ],
      }),
    ).toThrow(OpValidationError);
    expect(before.canvas.items["itm_1"]!.x).not.toBe(500);
  });

  it("still allows the coordinates people actually use", () => {
    // The negative control. Negative, zero and fractional are all ordinary —
    // a guard that took those would be worse than the bug.
    for (const [x, y] of [
      [-80, 420],
      [0, 0],
      [12.5, -0.5],
    ]) {
      const after = apply(seedState(), { type: "item.move", itemId: "itm_1", x: x!, y: y! });
      expect(after!.canvas.items["itm_1"]).toMatchObject({ x, y });
    }
  });
});
