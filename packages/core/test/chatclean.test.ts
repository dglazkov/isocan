import { describe, expect, it } from "vitest";
import type { Actor, CanvasState, CommentThread, Operation } from "../src/index.ts";
import { applyOperation, invertOperation, SYSTEM_ACTOR } from "../src/index.ts";
import {
  cleanupNoun,
  cleanupOps,
  cleanupSelection,
  matchesFilter,
  mayRemoveComment,
  parseBefore,
  removableComment,
} from "../src/chatclean.ts";
import { alice, apply, bob, envelope, normalize } from "./helpers.ts";

/**
 * **The Chat's clean-up, decided once** (24 Sep 2026). The web's "Clean up…"
 * menu and `isocan comment clean` both call these, so what they select and
 * what they write can only differ if these do. Fixtures are synthetic: Acme.
 */

const scout: Actor = { id: "agt_acme_scout", name: "Scout" };

/** A Chat with a mix: two people, an agent, and the system voice failing into it. */
function chat(): CanvasState {
  let s = apply(null, { type: "project.create", canvasId: "prj_test", title: "Acme" });
  s = apply(s, { type: "thread.create", threadId: "thr_chat", anchorItemId: null, x: 0, y: 0, main: true, comment: { id: "c1", body: "Kick-off" } }, alice);
  s = apply(s, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c2", body: "Scout couldn't answer — trajectory not found" } }, SYSTEM_ACTOR);
  s = apply(s, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c3", body: "On it" } }, scout);
  s = apply(s, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c4", body: "Scout couldn't answer — again" } }, SYSTEM_ACTOR);
  s = apply(s, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c5", body: "Thanks" } }, bob);
  s = apply(s, { type: "thread.reply", threadId: "thr_chat", comment: { id: "c6", body: "Scout couldn't answer — third time" } }, SYSTEM_ACTOR);
  return s!;
}

const threadOf = (s: CanvasState): CommentThread => s.canvas.threads.thr_chat!;
const ids = (t: CommentThread, ...args: Parameters<typeof cleanupSelection> extends [unknown, ...infer R] ? R : never) =>
  cleanupSelection(t, ...args).map((c) => c.id);

describe("which messages a clean-up takes", () => {
  const t = threadOf(chat());

  it("system: every system-voice notice, and nothing else", () => {
    expect(ids(t, { kind: "system" }, alice.id, true)).toEqual(["c2", "c4", "c6"]);
  });

  it("from: one author's messages, the system voice included when named", () => {
    expect(ids(t, { kind: "from", actorId: scout.id }, alice.id, true)).toEqual(["c3"]);
    expect(ids(t, { kind: "from", actorId: SYSTEM_ACTOR.id }, alice.id, true)).toEqual(["c2", "c4", "c6"]);
  });

  it("from: a folded identity is the same person (actor.join)", () => {
    const joined = { usr_bob_old: bob.id };
    expect(ids(t, { kind: "from", actorId: "usr_bob_old" }, alice.id, true, joined)).toEqual(["c5"]);
  });

  it("before: strictly earlier than the instant, by the home's timestamps", () => {
    const at = t.comments.find((c) => c.id === "c4")!.createdAt;
    expect(ids(t, { kind: "before", before: at }, alice.id, true)).toEqual(["c1", "c2", "c3"]);
  });

  it("all: every message", () => {
    expect(ids(t, { kind: "all" }, alice.id, true)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
  });

  it("a non-owner takes only their own, whatever the filter", () => {
    expect(ids(t, { kind: "all" }, bob.id, false)).toEqual(["c5"]);
    expect(ids(t, { kind: "system" }, bob.id, false)).toEqual([]);
  });

  it("design records are never taken", () => {
    const withDesign: CommentThread = { ...t, comments: [...t.comments, { ...t.comments[0]!, id: "c7", design: {} as never }] };
    expect(removableComment(withDesign.comments[6]!)).toBe(false);
    expect(ids(withDesign, { kind: "all" }, alice.id, true)).not.toContain("c7");
  });

  it("matchesFilter answers per comment", () => {
    expect(matchesFilter(t.comments[1]!, { kind: "system" })).toBe(true);
    expect(matchesFilter(t.comments[0]!, { kind: "system" })).toBe(false);
  });
});

describe("who may remove", () => {
  const t = threadOf(chat());
  it("the author, always; anybody else only as owner", () => {
    expect(mayRemoveComment(t.comments[4]!, bob.id, false)).toBe(true);
    expect(mayRemoveComment(t.comments[1]!, bob.id, false)).toBe(false);
    expect(mayRemoveComment(t.comments[1]!, bob.id, true)).toBe(true);
    expect(mayRemoveComment(t.comments[4]!, "usr_bob_old", false, { usr_bob_old: bob.id })).toBe(true);
  });
});

describe("the ops a clean-up writes", () => {
  it("one comment.remove per message, in thread order", () => {
    const t = threadOf(chat());
    expect(cleanupOps(t, ["c6", "c2", "c4"])).toEqual([
      { type: "comment.remove", threadId: "thr_chat", commentId: "c2" },
      { type: "comment.remove", threadId: "thr_chat", commentId: "c4" },
      { type: "comment.remove", threadId: "thr_chat", commentId: "c6" },
    ]);
  });

  it("taking every message is the thread going — a thread is never empty", () => {
    const t = threadOf(chat());
    expect(cleanupOps(t, t.comments.map((c) => c.id))).toEqual([{ type: "thread.delete", threadId: "thr_chat" }]);
  });

  it("ids that are not in the thread write nothing", () => {
    expect(cleanupOps(threadOf(chat()), ["nope"])).toEqual([]);
  });
});

describe("one act, one undo: applying the inverses newest-first restores the thread exactly", () => {
  /** What the engine's group undo does: each member inverted against the state it met, undone newest first. */
  function removeAndUndo(state: CanvasState, ops: Operation[]): { removed: CanvasState; restored: CanvasState } {
    let s = state;
    const inverses: Operation[] = [];
    for (const op of ops) {
      inverses.push(invertOperation(s, op)!);
      s = applyOperation(s, envelope(op, alice))!;
    }
    const removed = s;
    for (const inverse of inverses.reverse()) s = applyOperation(s, envelope(inverse, alice))!;
    return { removed, restored: s };
  }

  it("system notices out of the middle come back in their places", () => {
    const s = chat();
    const t = threadOf(s);
    const { removed, restored } = removeAndUndo(s, cleanupOps(t, ids(t, { kind: "system" }, alice.id, true)));
    expect(threadOf(removed).comments.map((c) => c.id)).toEqual(["c1", "c3", "c5"]);
    expect(normalize(threadOf(restored))).toEqual(normalize(t));
  });

  it("the whole Chat comes back whole, main included", () => {
    const s = chat();
    const t = threadOf(s);
    const { removed, restored } = removeAndUndo(s, cleanupOps(t, ids(t, { kind: "all" }, alice.id, true)));
    expect(removed.canvas.threads.thr_chat).toBeUndefined();
    expect(normalize(threadOf(restored))).toEqual(normalize(t));
  });

  it("a restore written before positions existed still appends", () => {
    const s = chat();
    const t = threadOf(s);
    const gone = applyOperation(s, envelope({ type: "comment.remove", threadId: "thr_chat", commentId: "c2" }))!;
    const back = applyOperation(gone, envelope({ type: "comment.restore", threadId: "thr_chat", comment: t.comments[1]! }))!;
    expect(threadOf(back).comments.map((c) => c.id)).toEqual(["c1", "c3", "c4", "c5", "c6", "c2"]);
  });
});

describe("dates as people type them", () => {
  it("a bare day is that day's local midnight", () => {
    expect(parseBefore("2026-09-16")).toBe(new Date(2026, 8, 16).toISOString());
  });
  it("an ISO time is itself", () => {
    expect(parseBefore("2026-09-16T12:00:00Z")).toBe("2026-09-16T12:00:00.000Z");
  });
  it("nonsense is null", () => {
    expect(parseBefore("last tuesday")).toBeNull();
  });
});

describe("the count the confirm asks about", () => {
  it("says what and how many", () => {
    expect(cleanupNoun({ kind: "system" }, 37)).toBe("37 system notices");
    expect(cleanupNoun({ kind: "from", actorId: scout.id }, 1, "Scout")).toBe("1 message from Scout");
    expect(cleanupNoun({ kind: "all" }, 2)).toBe("2 messages");
  });
});
