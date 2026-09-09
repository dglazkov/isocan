import { describe, expect, it } from "vitest";
import type { CanvasContents, Item } from "../src/model.ts";
import {
  PREFERRED_OVER_PROP,
  preferPatch,
  preferences,
  preferredOver,
  standings,
  unpreferPatch,
} from "../src/preference.ts";

/**
 * **The only thing in this system that carries taste.**
 *
 * `slop.ts` is honest that its forty tells are a floor — they stop the bad
 * thing and do not produce the good one — and a design system supplies
 * coherence rather than judgement. Until this, nothing on a canvas knew what
 * anybody LIKED. `converge.ts` came closest and said out loud that it did not:
 * *"what actually records the decision is what the canvas already keeps"*,
 * which is the resulting state and not a question anybody can ask later.
 *
 * So what these cases are really protecting is that a preference stays CHEAP.
 * Every one of them is about something that would make a person stop doing it
 * twenty times — a duplicate costing an undo step, a pick that destroys the
 * thing it was comparing, a decision that cannot be taken back.
 */

function item(id: string, properties: Record<string, string> = {}): Item {
  return { id, title: id, properties, versions: [], currentVersionId: "" } as unknown as Item;
}

function canvas(items: Item[]): CanvasContents {
  return {
    items: Object.fromEntries(items.map((i) => [i.id, i])),
    threads: {},
    trash: [],
  } as unknown as CanvasContents;
}

describe("saying which one you liked better", () => {
  it("records the comparison on the winner", () => {
    /* Not being chosen is not a fact about the loser — and the useful question
       runs from what you kept, not from what you did not. */
    const patch = preferPatch(item("itm_a"), ["itm_b"]);
    expect(patch?.properties).toEqual({ [PREFERRED_OVER_PROP]: "itm_b" });
  });

  it("accumulates rather than replacing", () => {
    /* An eye test is many pairs. A winner that only remembered its last
       comparison would throw away the evidence as fast as it was gathered. */
    const a = item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b" });
    expect(preferPatch(a, ["itm_c", "itm_d"])?.properties).toEqual({
      [PREFERRED_OVER_PROP]: "itm_b,itm_c,itm_d",
    });
  });

  it("says nothing rather than writing the same fact twice", () => {
    /**
     * The one that keeps it cheap. A no-op patch still makes a version and
     * still costs an undo step, so clicking left twice would build a stack of
     * nothings to press ⌘Z through — and a gesture that punishes repetition is
     * a gesture nobody repeats.
     */
    const a = item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b" });
    expect(preferPatch(a, ["itm_b"])).toBeNull();
    expect(preferPatch(a, ["itm_b", "itm_c"])?.properties).toEqual({
      [PREFERRED_OVER_PROP]: "itm_b,itm_c",
    });
  });

  it("refuses to prefer a thing over itself", () => {
    /* Reachable by a two-up view that lost track of which side it was on, and
       silent if allowed: an item that beat itself would sit in the standings
       looking like a real result. */
    expect(preferPatch(item("itm_a"), ["itm_a"])).toBeNull();
  });

  it("can be taken back, all the way to no property at all", () => {
    /**
     * A record of first impressions is not a record of taste. And the last one
     * out must REMOVE the property rather than leave an empty string, because
     * `properties` merges — the same reason `paperPatch` clears with
     * `removeProperties`.
     */
    const a = item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b,itm_c" });
    expect(unpreferPatch(a, "itm_b")?.properties).toEqual({ [PREFERRED_OVER_PROP]: "itm_c" });
    const one = item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b" });
    expect(unpreferPatch(one, "itm_b")).toEqual({ removeProperties: [PREFERRED_OVER_PROP] });
    expect(unpreferPatch(one, "itm_zzz")).toBeNull();
  });

  it("reads a canvas as flat comparisons", () => {
    const c = canvas([
      item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b,itm_c" }),
      item("itm_b"),
      item("itm_c", { [PREFERRED_OVER_PROP]: "itm_b" }),
    ]);
    expect(preferences(c)).toEqual([
      { winnerId: "itm_a", loserId: "itm_b" },
      { winnerId: "itm_a", loserId: "itm_c" },
      { winnerId: "itm_c", loserId: "itm_b" },
    ]);
  });

  it("keeps a comparison whose loser was tidied away", () => {
    /* `choose` trashes the losers, and the trash is a place rather than a
       deletion. A comparison that stopped existing when its loser moved would
       lose exactly the evidence gathered before somebody converged — which is
       most of it. */
    const c = canvas([item("itm_a", { [PREFERRED_OVER_PROP]: "itm_gone" })]);
    expect(preferences(c)).toEqual([{ winnerId: "itm_a", loserId: "itm_gone" }]);
  });

  it("counts what won, which is the reading this is for", () => {
    const c = canvas([
      item("itm_a", { [PREFERRED_OVER_PROP]: "itm_b,itm_c" }),
      item("itm_c", { [PREFERRED_OVER_PROP]: "itm_b" }),
      item("itm_b"),
    ]);
    expect(standings(c)).toEqual([
      { itemId: "itm_a", won: 2 },
      { itemId: "itm_c", won: 1 },
    ]);
    expect(standings(canvas([item("itm_a")]))).toEqual([]);
  });

  it("survives a property somebody hand-edited to nonsense", () => {
    /* Properties are strings on a canvas anybody can write to. Reading these
       must never throw — a malformed value is no preferences, the way an
       unknown theme is no theme. */
    expect(preferredOver(item("itm_a", { [PREFERRED_OVER_PROP]: "" }))).toEqual([]);
    expect(preferredOver(item("itm_a", { [PREFERRED_OVER_PROP]: ",,," }))).toEqual([]);
    expect(preferredOver(item("itm_a"))).toEqual([]);
  });
});
