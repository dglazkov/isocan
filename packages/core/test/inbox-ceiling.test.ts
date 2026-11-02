import { describe, expect, it } from "vitest";
import { dispatchReason, inboxOn, type CanvasContents, type Operation } from "../src/index.ts";

/**
 * **A capped critic wakes only when it is mentioned** (critique phase 3).
 * An agent whose enrolment row on a canvas carries the `note` ceiling is a
 * critic there: the Chat being loud, or somebody saying "thanks" in a
 * thread it was asked in, is not a critique. Only a mention of it is. Any
 * other agent routes exactly as before. Synthetic throughout.
 */

const ADA = { id: "usr_ada", name: "Ada" };
const QUIET = { id: "act_quiet", name: "Quiet Hands" };
const SCOUT = { id: "act_scout", name: "Scout" };

const canvas = (): CanvasContents =>
  ({
    items: {},
    agents: {
      [QUIET.id]: { actor: QUIET, ceiling: "note", ceilingBy: ADA },
      [SCOUT.id]: { actor: SCOUT },
    },
    threads: {
      thr_main: { id: "thr_main", main: true, x: 0, y: 0, anchorItemId: null, createdAt: "2026-10-14T10:00:00.000Z", createdBy: ADA, comments: [] },
      thr_ask: {
        id: "thr_ask",
        x: 0,
        y: 0,
        anchorItemId: "itm_screen",
        createdAt: "2026-10-14T10:00:00.000Z",
        createdBy: ADA,
        comments: [
          { id: "cmt_ask", author: ADA, body: "@Quiet and @Scout — what do you make of #Acme checkout?", mentions: [QUIET.id, SCOUT.id], createdAt: "2026-10-14T10:00:00.000Z" },
        ],
      },
    },
  }) as unknown as CanvasContents;

const reply = (threadId: string, comment: Record<string, unknown>): Operation => ({ type: "thread.reply", threadId, comment: { id: "cmt_new", ...comment } }) as Operation;
const wakes = (op: Operation, who: { id: string; name: string }, c = canvas()) => dispatchReason(op, ADA.id, { actorId: who.id, names: [who] }, c);

describe("a capped critic, routed", () => {
  it("is not woken by the Chat", () => {
    const chat = reply("thr_main", { body: "Morning all — the Acme checkout is up." });
    expect(wakes(chat, QUIET)).toBeNull();
    expect(wakes(chat, SCOUT)).toBe("main-thread");
  });

  it("is not woken by a person's thanks in the thread it was asked in", () => {
    const thanks = reply("thr_ask", { body: "thanks both" });
    expect(wakes(thanks, QUIET)).toBeNull();
    expect(wakes(thanks, SCOUT)).toBe("in-your-thread");
  });

  it("is woken by a mention of it, in the Chat or a thread", () => {
    expect(wakes(reply("thr_main", { body: "@Quiet what do you make of #Acme checkout?", mentions: [QUIET.id] }), QUIET)).toBe("mentioned");
    expect(wakes(reply("thr_ask", { body: "@Quiet one more look?", mentions: [QUIET.id] }), QUIET)).toBe("mentioned");
  });

  it("is not woken by changes, whatever its rules say", () => {
    const c = canvas();
    (c.agents as Record<string, { rules?: unknown }>)[QUIET.id]!.rules = { ops: ["*"] };
    expect(dispatchReason({ type: "item.move", itemId: "itm_screen", x: 1, y: 1 } as Operation, ADA.id, { actorId: QUIET.id, names: [QUIET], rules: { ops: ["*"] } }, c)).toBeNull();
    expect(dispatchReason({ type: "item.move", itemId: "itm_screen", x: 1, y: 1 } as Operation, ADA.id, { actorId: SCOUT.id, names: [SCOUT], rules: { ops: ["*"] } }, c)).toBe("change");
  });

  it("its inbox says the same: mentions only", () => {
    const c = canvas();
    c.threads.thr_ask!.comments.push({ id: "cmt_thanks", author: ADA, body: "thanks both", createdAt: "2026-10-14T10:01:00.000Z" } as never);
    c.threads.thr_main!.comments.push({ id: "cmt_chat", author: ADA, body: "Morning all", createdAt: "2026-10-14T10:02:00.000Z" } as never);
    expect(inboxOn(c, QUIET, [QUIET], "prj_acme").map((e) => [e.comment.id, e.reason])).toEqual([["cmt_ask", "mentioned"]]);
    expect(inboxOn(c, SCOUT, [SCOUT], "prj_acme").map((e) => [e.comment.id, e.reason])).toEqual([
      ["cmt_ask", "mentioned"],
      ["cmt_thanks", "in-your-thread"],
      ["cmt_chat", "main-thread"],
    ]);
  });
});
