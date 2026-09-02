import { describe, expect, it } from "vitest";
import type { Actor, CanvasContents } from "../src/model.ts";
import type { ActorRegistry, ClaimContext } from "../src/claims.ts";
import {
  actorColors,
  actorMarks,
  actorNames,
  applyActorJoin,
  applyClaim,
  emptyActorRegistry,
} from "../src/claims.ts";
import { actorAliases, actorColor, resolveActor, sameActor } from "../src/identity.ts";
import { inboxOn, namesFor, reasonFor } from "../src/inbox.ts";
import { actorsAnswerTo } from "../src/mentions.ts";
import { OpValidationError } from "../src/errors.ts";

/**
 * **Two actors become one person** (`actor.join`, multi-identity phase 5).
 *
 * The registry gains one map and every reader resolves through it before it
 * compares; the log is never touched. What is held here: the reducer's
 * refusals (self, unknown, cycle, already folded), the resolver's
 * transitivity and its cycle safety, and that the wire shapes and the inbox
 * answer for the old id as the new person — the mechanism journey 6's last
 * step depends on.
 */

const dimitri: Actor = { id: "usr_d1", name: "Dimitri" };
const second: Actor = { id: "usr_d2", name: "Dimitri 2" };
const third: Actor = { id: "usr_d3", name: "Dimitri 3" };
const kenny: Actor = { id: "usr_kenny", name: "Kenny" };

function registryWith(...actors: Actor[]): ActorRegistry {
  const registry = emptyActorRegistry();
  for (const actor of actors) {
    registry.names[actor.id] = { name: actor.name, at: "2026-09-01T00:00:00.000Z" };
  }
  return registry;
}

const join = (registry: ActorRegistry, from: string, into: string) =>
  applyActorJoin(registry, { type: "actor.join", from, into });

const codeOf = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof OpValidationError ? err.code : String(err);
  }
};

describe("applyActorJoin", () => {
  it("records the fold and nothing else", () => {
    const before = registryWith(dimitri, second);
    const after = join(before, second.id, dimitri.id);
    expect(after.joined).toEqual({ [second.id]: dimitri.id });
    expect(after.names).toEqual(before.names); // no name moved
    expect(before.joined).toEqual({}); // and the input was not touched
  });

  it("refuses an actor folded into itself", () => {
    expect(codeOf(() => join(registryWith(dimitri), dimitri.id, dimitri.id))).toBe("bad-join");
  });

  it("refuses an id the home does not know, on either side", () => {
    const registry = registryWith(dimitri);
    expect(codeOf(() => join(registry, "usr_nobody", dimitri.id))).toBe("unknown-actor");
    expect(codeOf(() => join(registry, dimitri.id, "usr_nobody"))).toBe("unknown-actor");
  });

  it("refuses a cycle, however long", () => {
    const registry = registryWith(dimitri, second, third);
    const one = join(registry, second.id, dimitri.id);
    expect(codeOf(() => join(one, dimitri.id, second.id))).toBe("bad-join");
    const two = join(one, dimitri.id, third.id);
    expect(codeOf(() => join(two, third.id, second.id))).toBe("bad-join");
  });

  it("refuses to fold an actor that is already folded", () => {
    const registry = join(registryWith(dimitri, second, third), second.id, dimitri.id);
    expect(codeOf(() => join(registry, second.id, third.id))).toBe("bad-join");
  });
});

describe("resolveActor", () => {
  it("is transitive: a chain of joins resolves to its end", () => {
    const registry = join(
      join(registryWith(dimitri, second, third), second.id, dimitri.id),
      dimitri.id,
      third.id,
    );
    expect(resolveActor(registry.joined, second.id)).toBe(third.id);
    expect(resolveActor(registry.joined, dimitri.id)).toBe(third.id);
    expect(resolveActor(registry.joined, third.id)).toBe(third.id);
    expect(resolveActor(registry.joined, kenny.id)).toBe(kenny.id);
    expect(resolveActor(undefined, kenny.id)).toBe(kenny.id);
  });

  it("does not hang on a map that loops", () => {
    // The reducer refuses to write one; the resolver still must not spin if
    // a hand-edited file ever holds one.
    const looped = { a: "b", b: "c", c: "a" };
    expect(["a", "b", "c"]).toContain(resolveActor(looped, "a"));
  });

  it("names every alias of one person, the person first", () => {
    const registry = join(
      join(registryWith(dimitri, second, third), second.id, dimitri.id),
      third.id,
      dimitri.id,
    );
    expect(actorAliases(registry.joined, second.id)).toEqual([dimitri.id, second.id, third.id]);
    expect(actorAliases(registry.joined, kenny.id)).toEqual([kenny.id]);
    expect(sameActor(registry.joined, second.id, third.id)).toBe(true);
    expect(sameActor(registry.joined, second.id, kenny.id)).toBe(false);
  });
});

describe("the wire shapes answer for the old id", () => {
  const registry: ActorRegistry = {
    ...join(registryWith(dimitri, second, kenny), second.id, dimitri.id),
    colors: { [dimitri.id]: "#c93a55", [second.id]: "#0f8a80" },
    marks: { [dimitri.id]: "🦊", [second.id]: "🐙" },
  };

  it("names: Dimitri 2's comments show Dimitri", () => {
    expect(actorNames(registry)[second.id]).toBe("Dimitri");
    expect(actorNames(registry)[kenny.id]).toBe("Kenny");
  });

  it("colours: the folded actor wears the person's colour, chosen or derived", () => {
    expect(actorColors(registry)[second.id]).toBe("#c93a55");
    const unchosen = { ...registry, colors: {} };
    expect(actorColors(unchosen)[second.id]).toBe(actorColor(dimitri.id));
    expect(actorColors(unchosen)[kenny.id]).toBeUndefined(); // still only the exceptions
  });

  it("marks: the folded actor wears the person's mark, or none", () => {
    expect(actorMarks(registry)[second.id]).toBe("🦊");
    expect(actorMarks({ ...registry, marks: { [second.id]: "🐙" } })[second.id]).toBeUndefined();
  });
});

describe("the inbox resolves before it compares", () => {
  const at = "2026-09-01T10:00:00.000Z";
  const canvas: CanvasContents = {
    items: {},
    trash: [],
    threads: {
      thr_1: {
        id: "thr_1",
        x: 0,
        y: 0,
        anchorItemId: null,
        createdBy: kenny,
        createdAt: at,
        comments: [
          {
            id: "cmt_1",
            author: kenny,
            body: "hey, can you look?",
            createdAt: at,
            mentions: [second.id],
          },
          { id: "cmt_2", author: second, body: "looking", createdAt: at },
        ],
      },
      thr_2: {
        id: "thr_2",
        x: 0,
        y: 0,
        anchorItemId: null,
        createdBy: second,
        createdAt: at,
        comments: [
          { id: "cmt_3", author: second, body: "a note to self", createdAt: at },
          { id: "cmt_4", author: kenny, body: "reply", createdAt: at },
        ],
      },
    },
  } as unknown as CanvasContents;
  const joined = { [second.id]: dimitri.id };

  it("a thread mentioning Dimitri 2 is in Dimitri's inbox", () => {
    const entries = inboxOn(canvas, dimitri, namesFor(dimitri), "prj_1", "P", joined);
    expect(entries.map((e) => [e.comment.id, e.reason])).toEqual([
      ["cmt_1", "mentioned"],
      ["cmt_4", "in-your-thread"],
    ]);
    // Without the map, the same canvas holds nothing for Dimitri: the join
    // is what made these his.
    expect(inboxOn(canvas, dimitri, namesFor(dimitri), "prj_1", "P")).toEqual([]);
  });

  it("Dimitri's own words under the old id are never in his inbox", () => {
    const entries = inboxOn(canvas, dimitri, namesFor(dimitri), "prj_1", "P", joined);
    expect(entries.map((e) => e.comment.id)).not.toContain("cmt_2");
    expect(entries.map((e) => e.comment.id)).not.toContain("cmt_3");
  });

  it("reasonFor answers the same way for an op in flight", () => {
    const comment = { id: "cmt_9", body: "ping", mentions: [second.id] };
    expect(reasonFor(comment, undefined, dimitri.id, namesFor(dimitri), joined)).toBe("mentioned");
    expect(reasonFor(comment, undefined, dimitri.id, namesFor(dimitri))).toBeNull();
  });
});

describe("mention candidates resolve to the person", () => {
  it("a new @Dimitri 2 is stored as a mention of Dimitri", () => {
    const joined = { [second.id]: dimitri.id };
    const names = { [second.id]: "Dimitri", [dimitri.id]: "Dimitri" };
    const candidates = actorsAnswerTo([second, kenny], names, joined);
    expect(candidates).toEqual([
      { id: dimitri.id, name: "Dimitri 2" },
      { id: kenny.id, name: "Kenny" },
      { id: dimitri.id, name: "Dimitri" },
    ]);
  });
});

describe("the old name is released", () => {
  const now = "2026-09-01T12:00:00.000Z";
  const context = (registry: ActorRegistry): ClaimContext => ({
    registry,
    own: [],
    scoped: [{ actorId: second.id, boundAt: now, sessionKey: "web:laptop" }],
    claimants: [],
    held: [{ actor: second, canvas: "P", live: false }],
    now,
    mintId: () => "usr_new",
  });

  it("a new claim may take the folded actor's name; before the join it could not", () => {
    const before = registryWith(dimitri, second);
    expect(
      codeOf(() =>
        applyClaim(context(before), {
          type: "actor.claim",
          sessionKey: "codex:s-9",
          name: "Dimitri 2",
        }),
      ),
    ).toBe("name-taken");
    const after = join(before, second.id, dimitri.id);
    const claimed = applyClaim(context(after), {
      type: "actor.claim",
      sessionKey: "codex:s-9",
      name: "Dimitri 2",
    });
    expect(claimed.actor).toEqual({ id: "usr_new", name: "Dimitri 2" });
  });
});
