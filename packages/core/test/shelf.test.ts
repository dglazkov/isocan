import { describe, expect, it } from "vitest";
import {
  SHELVED_PROP,
  inScope,
  isShelved,
  shelvePatch,
  shelvedAt,
  unshelvePatch,
} from "../src/shelf.ts";

/**
 * **Archiving is one property and one comparison** (#194).
 *
 * The behaviour worth holding is not that a flag round-trips — it is the
 * three decisions underneath it: a canvas with nothing set is in the list, so
 * there is no migration; putting one away records WHEN rather than merely
 * that; and bringing it back removes the property rather than writing a
 * second value that means "not any more".
 */
const live = { properties: {} };
const away = { properties: { [SHELVED_PROP]: "2026-09-06T18:20:00.000Z" } };

describe("what the shelf is", () => {
  it("leaves every canvas that predates it in the list", () => {
    // No migration: an absent property is the state every canvas is in today.
    expect(isShelved(live)).toBe(false);
    expect(isShelved({})).toBe(false);
    expect(shelvedAt(live)).toBeNull();
  });

  it("records when it left, because that is the question a shelf raises", () => {
    const patch = shelvePatch("2026-09-06T18:20:00.000Z");
    expect(patch.properties?.[SHELVED_PROP]).toBe("2026-09-06T18:20:00.000Z");
    expect(shelvedAt({ properties: patch.properties! })).toBe("2026-09-06T18:20:00.000Z");
  });

  it("brings one back by removing the property, not by writing a second value", () => {
    // A `shelved: "false"` would be a canvas carrying a fact nobody asked to
    // keep, and `isShelved` would have to know that one string is special.
    expect(unshelvePatch().removeProperties).toEqual([SHELVED_PROP]);
    expect(unshelvePatch().properties).toBeUndefined();
  });

  it("is truthy for any stamp, so a hand-written value still means away", () => {
    expect(isShelved({ properties: { [SHELVED_PROP]: "yes" } })).toBe(true);
  });
});

describe("what a list shows", () => {
  it("defaults to the ones in the list, which is the whole point", () => {
    expect(inScope(live, "live")).toBe(true);
    expect(inScope(away, "live")).toBe(false);
  });

  it("can ask for the shelf alone", () => {
    expect(inScope(away, "shelved")).toBe(true);
    expect(inScope(live, "shelved")).toBe(false);
  });

  it("can ask for both, for the surface that shows which is which", () => {
    expect(inScope(live, "all")).toBe(true);
    expect(inScope(away, "all")).toBe(true);
  });
});
