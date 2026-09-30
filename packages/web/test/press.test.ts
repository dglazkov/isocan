import { describe, expect, it } from "vitest";
import { pressSelection } from "../src/lib/press.ts";

/**
 * The press rule behind `ItemView.onPointerDown`. Shift used to toggle on
 * pointer-DOWN, so Shift-dragging one of three selected frames took it out of
 * the selection before the drag began. The press now decides what a drag
 * carries; only a Shift-click that never moved takes a selected item out, on
 * release — which the caller reads as "the press kept the selection".
 */
describe("pressSelection", () => {
  const selected = ["brand", "designed", "real"];
  /** What the release does: a Shift-click on a kept selection toggles. */
  const click = (was: string[], id: string, shift: boolean) => {
    const chosen = pressSelection(was, id, shift);
    return shift && chosen === was ? was.filter((one) => one !== id) : chosen;
  };

  it("Shift-drag from a selected item drags the whole selection and leaves it as it was", () => {
    const drag = pressSelection(selected, "designed", true);
    expect(drag).toBe(selected);
    expect(drag).toEqual(["brand", "designed", "real"]);
  });

  it("a plain press on a selected item then a drag moves all of them", () => {
    expect(pressSelection(selected, "real", false)).toBe(selected);
  });

  it("Shift-click on a selected item takes it out, on release", () => {
    expect(click(selected, "designed", true)).toEqual(["brand", "real"]);
  });

  it("Shift-click on an unselected item adds it", () => {
    expect(click(["brand"], "real", true)).toEqual(["brand", "real"]);
  });

  it("Shift-drag from an unselected item adds it and drags the lot", () => {
    const drag = pressSelection(["brand", "designed"], "real", true);
    expect(drag).toEqual(["brand", "designed", "real"]);
    // Not the old array: the press changes the selection, and the release
    // must not toggle the item straight back out.
    expect(drag).not.toBe(selected);
  });

  it("a plain click on a selected item keeps the selection — the existing rule, unchanged", () => {
    expect(click(selected, "brand", false)).toEqual(selected);
  });

  it("a plain press on an unselected item selects it alone", () => {
    expect(pressSelection(selected, "acme", false)).toEqual(["acme"]);
    expect(pressSelection([], "acme", false)).toEqual(["acme"]);
  });
});
