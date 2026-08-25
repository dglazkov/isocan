import { describe, expect, it } from "vitest";
import {
  OpValidationError,
  hasReacted,
  itemsWearing,
  reactionGroups,
  reactionsOf,
} from "../src/index.ts";
import type { Operation } from "../src/index.ts";
import { alice, apply, bob, seedState } from "./helpers.ts";

/**
 * Reactions are a SET of actors per emoji, and an operation rather than a
 * property — both for the same reason, which is worth stating once.
 *
 * A count would have to be incremented, so two people reacting in the same
 * instant would each read it, add one, and write the same value: one reaction
 * lost, silently and permanently. A property would fare no better —
 * `applyMetaPatch` merges at the KEY level, so two clients each writing their
 * own computed list of who-has-reacted is a read-modify-write over a shared
 * string, and the second wins.
 *
 * Adding an id to a set is idempotent and commutative. That is the whole
 * design, and everything below is a consequence of it.
 */

const react = (itemId: string, emoji: string, on: boolean): Operation =>
  ({ type: "item.react", itemId, emoji, on }) as Operation;

describe("wearing an emoji", () => {
  it("records the actor, not a number", () => {
    const after = apply(seedState(), react("itm_1", "👍", true), alice)!;
    expect(after.canvas.items["itm_1"]!.reactions).toEqual({ "👍": [alice.id] });
  });

  it("counts distinct people, and two who react at once both land", () => {
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", true), bob);
    const item = state!.canvas.items["itm_1"]!;
    expect(item.reactions!["👍"]).toEqual([alice.id, bob.id]);
    expect(reactionsOf(item, alice.id)[0]).toMatchObject({ count: 2, mine: true });
    expect(reactionsOf(item, bob.id)[0]!.mine).toBe(true);
  });

  it("is idempotent — reacting twice is not reacting twice", () => {
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", true), alice);
    expect(state!.canvas.items["itm_1"]!.reactions!["👍"]).toEqual([alice.id]);
  });

  it("takes back only your own", () => {
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", true), bob);
    state = apply(state, react("itm_1", "👍", false), alice);
    expect(state!.canvas.items["itm_1"]!.reactions!["👍"]).toEqual([bob.id]);
  });

  it("drops an emoji nobody wears rather than keeping it at zero", () => {
    // A chip showing 0 is a chip nobody can get rid of.
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", false), alice);
    expect(state!.canvas.items["itm_1"]!.reactions).toBeUndefined();
  });

  it("keeps the other emoji when one is taken back", () => {
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "🎉", true), alice);
    state = apply(state, react("itm_1", "👍", false), alice);
    expect(Object.keys(state!.canvas.items["itm_1"]!.reactions!)).toEqual(["🎉"]);
  });

  it("un-reacting something you never wore changes nothing", () => {
    const before = seedState();
    const after = apply(before, react("itm_1", "👍", false), alice)!;
    expect(after.canvas.items["itm_1"]!.reactions).toBeUndefined();
  });

  it("refuses an empty emoji and an unknown item", () => {
    expect(() => apply(seedState(), react("itm_1", "   ", true), alice)).toThrow(
      OpValidationError,
    );
    expect(() => apply(seedState(), react("itm_nope", "👍", true), alice)).toThrow(
      OpValidationError,
    );
  });
});

describe("reading them back", () => {
  it("sorts by count so the row does not reshuffle under the pointer", () => {
    let state = apply(seedState(), react("itm_1", "🎉", true), alice);
    state = apply(state, react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", true), bob);
    const order = reactionsOf(state!.canvas.items["itm_1"]!).map((r) => r.emoji);
    expect(order).toEqual(["👍", "🎉"]);
  });

  it("answers 'did I already?' — which is what makes a chip a toggle", () => {
    const state = apply(seedState(), react("itm_1", "👍", true), alice)!;
    const item = state.canvas.items["itm_1"]!;
    expect(hasReacted(item, "👍", alice.id)).toBe(true);
    expect(hasReacted(item, "👍", bob.id)).toBe(false);
    expect(hasReacted(item, "🎉", alice.id)).toBe(false);
  });

  it("says nothing about an item nobody has reacted to", () => {
    expect(reactionsOf(seedState().canvas.items["itm_1"]!)).toEqual([]);
  });
});

describe("undo", () => {
  it("takes back the reaction and nothing else", () => {
    // The inverse is `on: !on`, which is exact WITHOUT knowing the actor
    // because undo is per-actor: it replays stamped with the same person.
    let state = apply(seedState(), react("itm_1", "👍", true), alice);
    state = apply(state, react("itm_1", "👍", true), bob);
    // Alice undoes hers.
    state = apply(state, react("itm_1", "👍", false), alice);
    expect(state!.canvas.items["itm_1"]!.reactions!["👍"]).toEqual([bob.id]);
  });
});

/**
 * The canvas grouped by its marks — what replaced the starred shortlist.
 *
 * A star was one shared bit with nobody's name on it, so a team wanting
 * "needs review" AND "signed off" AND "in progress" had one flag and an
 * argument. These groups are whatever the team decided, and cost nothing to
 * invent.
 */
describe("the canvas by its marks", () => {
  it("groups items under every emoji they wear", () => {
    let state = apply(seedState(), react("itm_1", "👀", true), alice);
    state = apply(state, react("itm_2", "👀", true), alice);
    state = apply(state, react("itm_1", "✅", true), bob);
    const groups = reactionGroups(state!.canvas);
    expect(groups.map((g) => g.emoji)).toEqual(["👀", "✅"]);
    expect(groups[0]!.count).toBe(2);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["itm_1"]);
  });

  it("counts ITEMS wearing a mark, not people wearing it", () => {
    // The two counts are different questions and the bar shows both: how many
    // screens are in review, and how many people agreed on each.
    let state = apply(seedState(), react("itm_1", "👀", true), alice);
    state = apply(state, react("itm_1", "👀", true), bob);
    const group = reactionGroups(state!.canvas)[0]!;
    expect(group.count).toBe(1);
    expect(group.items[0]!.reactions!["👀"]).toHaveLength(2);
  });

  it("sorts by how many items wear it, then by emoji so ties are stable", () => {
    // A bar that reshuffles as people react is a bar nobody can aim at.
    let state = apply(seedState(), react("itm_1", "🎉", true), alice);
    state = apply(state, react("itm_1", "👀", true), alice);
    state = apply(state, react("itm_2", "👀", true), alice);
    expect(reactionGroups(state!.canvas).map((g) => g.emoji)).toEqual(["👀", "🎉"]);
  });

  it("answers one mark on its own, for `ls --reaction`", () => {
    let state = apply(seedState(), react("itm_1", "🚧", true), alice);
    state = apply(state, react("itm_2", "✅", true), alice);
    expect(itemsWearing(state!.canvas, "🚧").map((i) => i.id)).toEqual(["itm_1"]);
    expect(itemsWearing(state!.canvas, "❓")).toEqual([]);
  });

  it("says nothing about a canvas nobody has marked", () => {
    expect(reactionGroups(seedState().canvas)).toEqual([]);
  });
});
