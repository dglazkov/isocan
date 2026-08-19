import { describe, expect, it } from "vitest";
import { invertOperation } from "../src/index.ts";
import { apply, bob, seedState } from "./helpers.ts";

/**
 * A working note: one comment that says "on it", then what it found, then what
 * it did. Three comments would say the same thing three times, and the thread
 * a person actually reads is the one that stayed short.
 */
describe("comment.update", () => {
  const edit = (body: string) =>
    ({ type: "comment.update", threadId: "thr_1", commentId: "cmt_1", body }) as const;

  it("rewrites the comment in place and stamps when", () => {
    const before = seedState();
    const original = before.canvas.threads.thr_1!.comments[0]!;
    expect(original.editedAt).toBeUndefined();

    const after = apply(before, edit("On it — reading the spec now"))!;
    const comment = after.canvas.threads.thr_1!.comments[0]!;
    expect(comment.body).toBe("On it — reading the spec now");
    expect(comment.id).toBe(original.id);
    expect(comment.author).toEqual(original.author);
    expect(comment.createdAt).toBe(original.createdAt); // when it STARTED
    expect(comment.editedAt).toBeTruthy(); // when it last changed
  });

  it("leaves the rest of the thread alone", () => {
    const after = apply(seedState(), edit("changed"))!;
    const thread = after.canvas.threads.thr_1!;
    expect(thread.comments).toHaveLength(2);
    expect(thread.comments[1]!.body).toBe("Reply");
  });

  it("refuses to put words in somebody else's mouth", () => {
    // cmt_1 is Alice's; Bob may not rewrite it.
    expect(() => apply(seedState(), edit("not mine to change"), bob)).toThrow(/belongs to its author/);
  });

  it("re-resolves mentions, so an edit that drops a name drops the mention", () => {
    const withMention = apply(seedState(), {
      type: "comment.update",
      threadId: "thr_1",
      commentId: "cmt_1",
      body: "@Bob can you look?",
      mentions: [bob.id],
    })!;
    expect(withMention.canvas.threads.thr_1!.comments[0]!.mentions).toEqual([bob.id]);

    const withoutMention = apply(withMention, edit("never mind, sorted"))!;
    expect(withoutMention.canvas.threads.thr_1!.comments[0]!.mentions).toBeUndefined();
  });

  it("says so when the comment is not there", () => {
    expect(() =>
      apply(seedState(), { type: "comment.update", threadId: "thr_1", commentId: "cmt_nope", body: "x" }),
    ).toThrow(/unknown comment/);
  });

  it("undoes to exactly the words that were there", () => {
    const before = seedState();
    const original = before.canvas.threads.thr_1!.comments[0]!;
    const op = edit("done — took the long way round");
    const inverse = invertOperation(before, op)!;
    const after = apply(before, op)!;
    const undone = apply(after, inverse!)!;
    const comment = undone.canvas.threads.thr_1!.comments[0]!;
    expect(comment.body).toBe(original.body);
    // The undo is itself an edit — the canvas does not pretend it never
    // happened, it just puts the words back.
    expect(comment.editedAt).toBeTruthy();
  });
});
