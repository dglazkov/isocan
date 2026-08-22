import { describe, expect, it } from "vitest";
import {
  actorNameIn,
  actorNames,
  bindName,
  emptyActorRegistry,
  type Actor,
  type ActorRegistry,
} from "../src/index.ts";

/**
 * A name is stamped onto every comment and every op at the moment it is
 * written, which is right for a log and wrong for a face: rename an actor and
 * the canvas is still full of the old name, spoken by nobody. The registry is
 * the one row that answers for all of them.
 *
 * The fixture is a registry BUILT BY CLAIMS rather than a literal, because
 * names are no longer a projection of the claims table — they are their own
 * row, written by `bindName` as each claim is logged, and they outlive the
 * claim that wrote them. Feeding claims in is the only way to say what the
 * registry knows.
 */

const claim = (actor: Actor, at: string) => ({ actor, ts: at });

const registry = (...claims: { actor: Actor; ts: string }[]): ActorRegistry =>
  claims.reduce((r, c) => bindName(r, c), emptyActorRegistry());

const dion = (name: string) => ({ id: "usr_dion", name });

describe("the name an actor goes by now", () => {
  it("comes from the registry, not from what was stamped", () => {
    const names = actorNames(registry(claim(dion("Di"), "2026-08-21T09:00:00.000Z")));
    // The comment still carries the old name; nobody is shown it.
    expect(actorNameIn(names, { id: "usr_dion", name: "Dion 2" })).toBe("Di");
  });

  it("keeps the stamped name for an actor the registry never met", () => {
    // Another machine's actor, or one from before the registry existed. A name
    // we cannot improve on is still a name they are owed.
    expect(actorNameIn({}, { id: "usr_ghost", name: "Wise Andy" })).toBe("Wise Andy");
    expect(actorNameIn(undefined, { id: "usr_ghost", name: "Wise Andy" })).toBe("Wise Andy");
  });

  it("takes the most recent claim when one actor holds several keys", () => {
    // A second machine, or an `as` reincarnation. A rename is the newest claim
    // by construction, so newest wins — not first-seen, not last-in-the-object.
    const names = actorNames(
      registry(
        claim(dion("Dion 2"), "2026-08-19T10:00:00.000Z"),
        claim(dion("Di"), "2026-08-21T09:00:00.000Z"),
      ),
    );
    expect(names["usr_dion"]).toBe("Di");
  });

  it("does not let a later key with an older claim win", () => {
    // Arrival order is not time order: the one-time migrations append claims
    // stamped with their ORIGINAL timestamps onto the end of a log whose other
    // entries are newer, so a two-month-old legacy row must not re-letter an
    // actor renamed last week.
    const names = actorNames(
      registry(
        claim(dion("Di"), "2026-08-21T09:00:00.000Z"),
        claim(dion("Dion 2"), "2026-08-19T10:00:00.000Z"),
      ),
    );
    expect(names["usr_dion"]).toBe("Di");
  });

  it("names everybody in the registry, one row each", () => {
    const names = actorNames(
      registry(
        claim({ id: "usr_a", name: "Di" }, "2026-08-21T09:00:00.000Z"),
        claim({ id: "usr_b", name: "Fable" }, "2026-08-20T09:00:00.000Z"),
      ),
    );
    expect(names).toEqual({ usr_a: "Di", usr_b: "Fable" });
  });

  it("ignores a blank name rather than showing nobody", () => {
    expect(actorNameIn({ usr_a: "   " }, { id: "usr_a", name: "Dion 2" })).toBe("Dion 2");
  });
});
