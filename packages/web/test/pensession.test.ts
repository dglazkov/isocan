import { describe, expect, it } from "vitest";
import { HOLD_MS, INK_SETTLE_MS, settleDelay, wasHeld } from "../src/lib/pensession.ts";

describe("when ink settles", () => {
  it("settles a moment after the pen lifts", () => {
    expect(settleDelay({ holdingPen: false })).toBe(INK_SETTLE_MS);
  });

  it("never settles while P is held — the whole hold is one drawing", () => {
    expect(settleDelay({ holdingPen: true })).toBeNull();
  });

  it("holds open for as long as it takes, not for a longer timeout", () => {
    // The point of the mode: no number of seconds between strokes ends it.
    // A bigger INK_SETTLE_MS would only move the cliff, not remove it.
    expect(settleDelay({ holdingPen: true })).not.toBe(INK_SETTLE_MS * 10);
  });
});

describe("tap or hold", () => {
  const at = 10_000;
  it("a quick press is a tap: the tool latches", () => {
    expect(wasHeld(at, at + HOLD_MS - 1)).toBe(false);
  });

  it("a press that outlasts the threshold is a hold: the tool is borrowed", () => {
    expect(wasHeld(at, at + HOLD_MS)).toBe(true);
    expect(wasHeld(at, at + 30_000)).toBe(true);
  });

  it("treats a keyup with no press behind it as a tap", () => {
    // Press P, alt-tab away, come back and release: the keydown went to the
    // other window. Latching a tool is the harmless reading of that.
    expect(wasHeld(0, at)).toBe(false);
  });
});
