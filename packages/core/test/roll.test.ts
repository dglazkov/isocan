import { describe, expect, it } from "vitest";
import type { Actor } from "../src/index.ts";
import { dispatchReason, lastRoll, mainThread, ROLL_AWAY_MS, rollDue, rollOp, rollWords } from "../src/index.ts";
import { alice, apply, seedState } from "./helpers.ts";

/**
 * **The roll call's pure half** (`roll.ts`): the away rule, what the Chat
 * remembers, the op, and the routing clause that keeps two agents' hellos
 * from being work for each other.
 */
const percy: Actor = { id: "act_percy", name: "Percy" };
const quill: Actor = { id: "act_quill", name: "Quill" };
const T = 10 * 60 * 60_000;

describe("rollDue — the away rule", () => {
  it("first time on a canvas is here; a quick return is nothing; a long one is back", () => {
    expect(rollDue({ last: null, seen: undefined, now: T })).toBe("here");
    expect(rollDue({ last: null, seen: T - 60_000, now: T })).toBeNull();
    expect(rollDue({ last: null, seen: T - ROLL_AWAY_MS - 1, now: T })).toBe("here");
    expect(rollDue({ last: { kind: "here", at: T - 3_600_000 }, seen: T - 60_000, now: T })).toBeNull();
    expect(rollDue({ last: { kind: "here", at: T - 3_600_000 }, seen: T - ROLL_AWAY_MS - 1, now: T })).toBe("back");
    expect(rollDue({ last: { kind: "back", at: T - 3_600_000 }, seen: undefined, now: T })).toBe("back");
  });

  it("a host that remembers nothing says back at most once a window — its own last line is evidence", () => {
    expect(rollDue({ last: { kind: "back", at: T - 60_000 }, seen: undefined, now: T })).toBeNull();
  });

  it("after it said it stepped away, any return is back, however soon", () => {
    expect(rollDue({ last: { kind: "away", at: T - 1_000 }, seen: T - 1_000, now: T })).toBe("back");
  });
});

describe("a roll line on the canvas", () => {
  it("is born as the Chat when there is none, is a record, and is read back as this agent's latest", () => {
    let s = seedState();
    const here = rollOp(s.canvas, "here", rollWords("here", "Percy", "listens only to Alice"));
    expect(here).toMatchObject({ type: "thread.create", main: true, comment: { record: "here" } });
    s = apply(s, here, percy)!;
    const chat = mainThread(s.canvas)!;
    expect(chat.comments[0]).toMatchObject({
      author: percy,
      body: "Percy is here — answering a mention or the Chat; listens only to Alice.",
      record: "here",
    });
    const away = rollOp(s.canvas, "away", rollWords("away", "Percy", ""));
    expect(away.type).toBe("thread.reply");
    s = apply(s, away, percy)!;
    s = apply(s, rollOp(s.canvas, "here", rollWords("here", "Quill", "listens to everyone")), quill)!;
    expect(lastRoll(s.canvas, percy.id)?.kind).toBe("away");
    expect(lastRoll(s.canvas, quill.id)?.kind).toBe("here");
    expect(lastRoll(s.canvas, alice.id)).toBeNull();
  });

  it("wakes nobody — not a mention's reader, not an agent parked on every op, not the agent it names", () => {
    let s = seedState();
    s = apply(s, { type: "agent.enroll", agent: percy })!;
    s = apply(s, { type: "agent.enroll", agent: quill })!;
    const op = rollOp(s.canvas, "here", rollWords("here", "Quill", "listens to everyone"));
    for (const rules of [null, { ops: ["*"] }, { ops: ["thread.*"] }]) {
      const reason = dispatchReason(
        op,
        quill.id,
        { actorId: percy.id, names: [{ id: percy.id, name: percy.name }], rules, policy: { owner: alice, listen: ["*"] } },
        s.canvas,
      );
      expect(reason).toBeNull();
    }
    // A named agent in the words is still nobody summoned.
    const naming = rollOp(s.canvas, "here", "Quill is here — Percy, say hello");
    expect(
      dispatchReason(naming, quill.id, { actorId: percy.id, names: [{ id: percy.id, name: percy.name }], rules: null }, s.canvas),
    ).toBeNull();
  });
});
