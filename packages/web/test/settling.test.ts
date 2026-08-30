import { describe, expect, it } from "vitest";
import type { Operation } from "@isocan/core";

import { SETTLING_MS, newWrite, settlingItems, type QueuedWrite } from "../src/lib/writequeue.ts";

/**
 * **The cost of optimism, paid honestly.**
 *
 * Every write is applied locally the instant it is made, so a gesture never
 * appears to do nothing — that is the fix for "⌘Enter and nothing is added",
 * which happened because `addTextNode` posted with `sendOp` and the node
 * appeared only when the home's broadcast arrived. On a dead socket it never
 * did.
 *
 * But a change shown instantly and never confirmed looks exactly like a change
 * that worked, right up until it is lost. So the view has to be able to say
 * "this has not landed". The whole design is in WHEN it says it: waiting
 * `SETTLING_MS` first turns the mark from "this is new" — which would fire on
 * every gesture and teach people to ignore it — into "this is late".
 */
const actor = { id: "usr_1", name: "Priya" };
const move = (itemId: string): Operation => ({ type: "item.move", itemId, x: 1, y: 2 });
const at = (write: QueuedWrite, when: number): QueuedWrite => ({ ...write, at: when });

describe("what is still settling", () => {
  const now = 1_000_000;

  it("says nothing about a change that has only just been made", () => {
    /* The flicker this avoids is the whole reason for the delay. A signal that
       fires on every gesture is one nobody sees when it matters. */
    const queue = [at(newWrite("op1", actor, move("itm_1")), now - 100)];
    expect(settlingItems(queue, now)).toEqual(new Set());
  });

  it("names the item once the change is late", () => {
    const queue = [at(newWrite("op1", actor, move("itm_1")), now - SETTLING_MS - 1)];
    expect(settlingItems(queue, now)).toEqual(new Set(["itm_1"]));
  });

  it("forgets it the moment the home answers", () => {
    /* `seq` set means the home took it. It stays in the queue until the tail
       reaches it — that is rule 3 — but it is no longer WAITING. */
    const answered = { ...at(newWrite("op1", actor, move("itm_1")), now - 5_000), seq: 12 };
    expect(settlingItems([answered], now)).toEqual(new Set());
  });

  it("does not call a refused write 'still working on it'", () => {
    /* A refusal is over, not pending. The person is already being told in
       words by the refusal banner; leaving the item marked would say the
       opposite of what happened. */
    const refused = {
      ...at(newWrite("op1", actor, move("itm_1")), now - 5_000),
      refused: { message: "no" },
    };
    expect(settlingItems([refused], now)).toEqual(new Set());
  });

  it("covers every item a multi-item gesture touched", () => {
    const many: Operation = {
      type: "items.move",
      moves: [
        { itemId: "itm_1", x: 0, y: 0 },
        { itemId: "itm_2", x: 1, y: 1 },
      ],
    };
    const queue = [at(newWrite("op1", actor, many), now - SETTLING_MS - 1)];
    expect(settlingItems(queue, now)).toEqual(new Set(["itm_1", "itm_2"]));
  });

  it("is a threshold worth having — not zero, not a wait", () => {
    /* Zero is a flicker on every gesture; several seconds is a person already
       wondering whether the app is broken before it admits anything. */
    expect(SETTLING_MS).toBeGreaterThanOrEqual(300);
    expect(SETTLING_MS).toBeLessThanOrEqual(1500);
  });
});

describe("a gesture stays one gesture", () => {
  it("keeps its group, so a flush re-sends the same undo unit", () => {
    /* A revise is three ops under one group id. A flush is a RE-send, so the
       group has to survive in the queue — otherwise a reconnect turns one
       gesture into three separate undos. */
    const write = newWrite("op1", actor, move("itm_1"), "grp_1");
    expect(write.group).toBe("grp_1");
    expect(newWrite("op2", actor, move("itm_1")).group).toBeUndefined();
  });
});
