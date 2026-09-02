import { describe, expect, it } from "vitest";
import { DESK_OF_PROP, deskOf, deskTitle } from "../src/sprint.ts";

/**
 * **The desk** (sprint phase 3): a private canvas that knows its sprint.
 * The record is one property on the desk canvas; the privacy is the door's
 * (link off, one pass), which the CLI test proves over the wire.
 */
describe("a desk knows its sprint", () => {
  it("reads the sprint off the canvas record, and nothing off a canvas that is not a desk", () => {
    expect(deskOf({ properties: { [DESK_OF_PROP]: "prj_sprint" } })).toBe("prj_sprint");
    expect(deskOf({ properties: {} })).toBeNull();
    expect(deskOf({})).toBeNull();
  });

  it("is named for its sketcher", () => {
    expect(deskTitle("Theo")).toBe("Theo's desk");
    expect(deskTitle("  Nia ")).toBe("Nia's desk");
    // The one rule of English possessives the name has to survive.
    expect(deskTitle("Ross")).toBe("Ross' desk");
  });
});
