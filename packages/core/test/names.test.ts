import { describe, expect, it } from "vitest";
import { actorNameIn, actorNames, emptyActorRegistry, type ActorRegistry } from "../src/index.ts";

/**
 * A name is stamped onto every comment and every op at the moment it is
 * written, which is right for a log and wrong for a face: rename an actor and
 * the canvas is still full of the old name, spoken by nobody. The registry is
 * the one row that answers for all of them.
 */

const registry = (claims: Record<string, { id: string; name: string; boundAt: string }>): ActorRegistry => ({
  ...emptyActorRegistry(),
  claims: Object.fromEntries(Object.entries(claims).map(([key, c]) => [key, { ...c }])),
});

describe("the name an actor goes by now", () => {
  it("comes from the registry, not from what was stamped", () => {
    const names = actorNames(
      registry({ "web:1": { id: "usr_dion", name: "Di", boundAt: "2026-08-21T09:00:00.000Z" } }),
    );
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
      registry({
        "web:old": { id: "usr_dion", name: "Dion 2", boundAt: "2026-08-19T10:00:00.000Z" },
        "web:new": { id: "usr_dion", name: "Di", boundAt: "2026-08-21T09:00:00.000Z" },
      }),
    );
    expect(names["usr_dion"]).toBe("Di");
  });

  it("does not let a later key with an older claim win", () => {
    const names = actorNames(
      registry({
        "web:new": { id: "usr_dion", name: "Di", boundAt: "2026-08-21T09:00:00.000Z" },
        "web:old": { id: "usr_dion", name: "Dion 2", boundAt: "2026-08-19T10:00:00.000Z" },
      }),
    );
    expect(names["usr_dion"]).toBe("Di");
  });

  it("names everybody in the registry, one row each", () => {
    const names = actorNames(
      registry({
        "web:1": { id: "usr_a", name: "Di", boundAt: "2026-08-21T09:00:00.000Z" },
        "cli:2": { id: "usr_b", name: "Fable", boundAt: "2026-08-20T09:00:00.000Z" },
      }),
    );
    expect(names).toEqual({ usr_a: "Di", usr_b: "Fable" });
  });

  it("ignores a blank name rather than showing nobody", () => {
    expect(actorNameIn({ usr_a: "   " }, { id: "usr_a", name: "Dion 2" })).toBe("Dion 2");
  });
});
