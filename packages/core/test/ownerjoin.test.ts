import { describe, expect, it } from "vitest";
import { ownerOf, ownsCanvas } from "../src/grants.ts";

/**
 * **A canvas whose creator was folded into somebody else is still theirs.**
 *
 * Multi-identity phase 5 gave a person one identity out of two: `actor.join`
 * writes `{ from → into }` into the registry, the log keeps every id it ever
 * recorded, and readers resolve before they compare. Phase 5 converted every
 * reader that DISPLAYS an actor — names, colours, marks, the inbox, the
 * roster, the unread counts. It did not convert the one that AUTHORIZES on
 * one, and `project.createdBy` is exactly that.
 *
 * So the gesture that promised to make somebody one person took away the
 * owner controls on everything their older name had made: the Share dialog
 * disabled its buttons and said "Made by Dimitri 2", and on a second machine —
 * whose badge never claimed `Dimitri 2` — the daemon refused as well. That is
 * the shape of the lockout the owner floor exists to prevent, arriving through
 * the floor itself.
 */
const CREATOR = "usr_dimitri_2";
const SURVIVOR = "usr_dimitri";
const canvas = { createdBy: { id: CREATOR } };
const joined = { [CREATOR]: SURVIVOR };

describe("ownership after two actors become one person", () => {
  it("answers with the person, not the id the log recorded", () => {
    expect(ownerOf(canvas)).toBe(CREATOR); // no map: exactly as before
    expect(ownerOf(canvas, joined)).toBe(SURVIVOR);
  });

  it("recognises the survivor as the owner of what the folded actor made", () => {
    // The bug, in one line: this was false, and the owner lost their canvas.
    expect(ownsCanvas(canvas, SURVIVOR, joined)).toBe(true);
  });

  it("still recognises the folded id, which is what old ops and claims carry", () => {
    // Both sides resolve, so it does not matter which of a person's ids the
    // caller happens to hold — an op's author, a claim a badge still carries,
    // or the actor they present as today.
    expect(ownsCanvas(canvas, CREATOR, joined)).toBe(true);
  });

  it("does not make strangers owners", () => {
    expect(ownsCanvas(canvas, "usr_priya", joined)).toBe(false);
    // And a stranger who was folded into some OTHER person is still a stranger.
    expect(ownsCanvas(canvas, "usr_jordan", { usr_jordan: "usr_priya" })).toBe(false);
  });

  it("follows a chain, because a person may fold more than once", () => {
    const twice = { usr_a: "usr_b", usr_b: "usr_c" };
    expect(ownsCanvas({ createdBy: { id: "usr_a" } }, "usr_c", twice)).toBe(true);
  });

  it("is unchanged on a home that has never seen a join", () => {
    expect(ownsCanvas(canvas, CREATOR)).toBe(true);
    expect(ownsCanvas(canvas, SURVIVOR)).toBe(false);
    expect(ownsCanvas(canvas, CREATOR, {})).toBe(true);
  });
});
